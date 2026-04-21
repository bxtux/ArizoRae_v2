# agent-worker/ — FastAPI + Claude Agent SDK

Service Python qui invoque le skill `rae-generic` via le Claude Agent SDK. Tous les appels IA du système passent par ici. Jamais exposé publiquement : écoute en interne sur `agent:8000`, authentifié par header `X-Agent-Secret`.

## Structure

```
agent-worker/
├── pyproject.toml
├── Dockerfile
└── app/
    ├── main.py                # FastAPI app, toutes les routes
    ├── config.py              # settings (env vars via pydantic-settings)
    ├── auth.py                # middleware X-Agent-Secret (Depends)
    ├── sdk_client.py          # WRAPPER SDK — model routing, prompt caching, LLMResult
    ├── skill_loader.py        # charge /skills/rae-generic (SKILL.md)
    ├── quota.py               # pick_api_key() — admin key vs user key, QuotaExceeded → 402
    ├── db.py                  # SQLAlchemy async — ai_jobs, users (get/start/finish/increment)
    ├── fs.py                  # helpers users_datas/<uid>/ — read/write FACTS, chat_log, etc.
    └── workflows/
        ├── _base.py           # run_simple() — pattern standard: job track + quota + cache
        ├── init.py            # POST /workflows/init — SSE, opus
        ├── recherche.py       # POST /workflows/recherche — opus
        ├── scraper_gen.py     # POST /scraper/generate — sonnet
        ├── scraper_adapt.py   # POST /scraper/adapt — sonnet
        ├── analyse.py         # POST /workflows/analyse — sonnet
        ├── cv.py              # POST /workflows/cv — sonnet
        ├── lettre.py          # POST /workflows/lettre — sonnet
        ├── entretien.py       # POST /workflows/entretien — opus
        └── chat.py            # POST /chat — haiku défaut, routing scraper_adapt si intent détecté
```

> **Note** : `scraper_demo.py` et `mark_applied.py` ne sont pas implémentés. La démo scraper est gérée par la tâche Celery `run_scraper_demo` (appel direct runner). La fonctionnalité `mark_applied` est intégrée dans le workflow `analyse`.

## Règles dures

### Model routing (non négociable)

Table dans `sdk_client.py`, synchrone avec `docs/adr/0002-model-routing.md` :

```python
WORKFLOW_MODELS = {
    "init":           "claude-opus-4-7",
    "recherche":      "claude-opus-4-7",
    "scraper_gen":    "claude-sonnet-4-6",
    "scraper_adapt":  "claude-sonnet-4-6",
    "analyse":        "claude-sonnet-4-6",
    "cv":             "claude-sonnet-4-6",
    "lettre":         "claude-sonnet-4-6",
    "entretien":      "claude-opus-4-7",
    "chat":           "claude-haiku-4-5",
    "chat_escalated": "claude-sonnet-4-6",
}
```

Modifier cette table → mise à jour obligatoire de `docs/adr/0002-model-routing.md`.

### Prompt caching (non négociable)

Chaque appel passe par `sdk_client.build_cached_system(user_id)` qui retourne deux blocs système avec `cache_control: {type: "ephemeral"}` :

1. `SKILL.md` du skill rae-generic (stable entre tous les users).
2. Concaténation `FACTS.md + BULLET_LIBRARY.md + preset.md` de l'utilisateur.

Voir `docs/adr/0003-prompt-caching-strategy.md`.

### Tracking ai_jobs (non négociable)

Chaque appel passe par `_base.run_simple()` qui :
- Crée row `ai_jobs` avec `status='running'` avant l'appel.
- Met à jour `tokens_in`, `tokens_out`, `tokens_in_cached`, `tokens_in_uncached`, `status`, `finished_at` après.
- Incrémente `users.quota_used_tokens` si clé admin utilisée (uncached tokens uniquement).
- Si `quota_used_tokens >= quota_limit_tokens` et pas de `anthropic_key_encrypted` : `raise QuotaExceeded()` → HTTP 402.

### Choix de la clé (quota.py)

```python
async def pick_api_key(user_id) -> tuple[str, Literal["admin", "user"]]:
    user = await db.get_user(user_id)
    if user["anthropic_key_encrypted"]:
        key = decrypt(user["anthropic_key_encrypted"])  # AES-256-GCM, voir portal/lib/crypto.ts
        return key, "user"
    if user["quota_used_tokens"] < user["quota_limit_tokens"]:
        return settings.ANTHROPIC_API_KEY_ADMIN, "admin"
    raise QuotaExceeded()
```

La clé Anthropic user est chiffrée par le portal via `portal/src/lib/crypto.ts` (AES-256-GCM, `AUTH_SECRET_KEY`). L'agent-worker doit la déchiffrer avec le même algorithme.

## Pattern workflow standard

Tous les workflows utilisent `_base.run_simple()` — ne pas bypasser :

```python
from ._base import run_simple

async def run(user_id: UUID, ...) -> str:
    result = await run_simple(
        user_id=user_id,
        workflow="analyse",          # clé dans WORKFLOW_MODELS
        messages=[{"role": "user", "content": prompt}],
        input_payload={...},         # stocké dans ai_jobs.input
        max_tokens=4096,
        temperature=0.7,
    )
    return result.text
```

## Workflow chat — routing scraper_adapt

`workflows/chat.py` détecte automatiquement les intentions de modification scraper par matching de patterns (liste `_SCRAPER_ADAPT_TRIGGERS`). Si détecté :
1. Appelle `scraper_adapt.run(user_id, diff_request=message)` directement.
2. Retourne un message de confirmation sans appel LLM supplémentaire.

Sinon : appel normal haiku (ou sonnet si `escalate=True` transmis par le portal).

## SSE pour workflows longs

`/workflows/init` streame via `sse-starlette`. Events : `{type: "progress", step: "...", percent: N}`, `{type: "done"}`, `{type: "error", message: "..."}`.

## Interdits

- Jamais d'appel direct `anthropic.Client()` hors de `sdk_client.py`.
- Jamais de prompt sans `cache_control` sur les blocs système.
- Jamais d'écriture dans `skills/rae-generic/` (read-only, volume monté en `:ro`).
- Jamais de `print()` : utiliser `structlog`.

## Tests

- `pytest` sur chaque workflow avec mock `sdk_client.call`.
- Test dédié : `test_model_routing.py` — vérifie que chaque workflow appelle le bon modèle.
- Test dédié : `test_prompt_caching.py` — vérifie que `cache_control` est présent sur les blocs système.
