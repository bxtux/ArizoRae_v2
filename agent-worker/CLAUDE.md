# agent-worker/ — FastAPI + Claude Agent SDK

Service Python qui invoque le skill `rae-generic` via le Claude Agent SDK. Tous les appels IA du système passent par ici. Jamais exposé publiquement : écoute en interne sur `agent:8000`, authentifié par header `X-Agent-Secret`.

## Structure

```
agent-worker/
├── pyproject.toml
├── Dockerfile
└── app/
    ├── main.py                # FastAPI app, routes
    ├── config.py              # settings (env vars)
    ├── auth.py                # middleware X-Agent-Secret
    ├── sdk_client.py          # WRAPPER SDK, model routing, prompt caching
    ├── skill_loader.py        # monte /skills/rae-generic au SDK
    ├── quota.py               # admin key vs user key, tracking
    ├── db.py                  # SQLAlchemy async (ai_jobs, users, job_offers)
    ├── fs.py                  # helpers users_datas/<uid>/
    └── workflows/
        ├── init.py            # /init (opus) + SSE
        ├── recherche.py       # /recherche (opus)
        ├── scraper_gen.py     # (sonnet)
        ├── scraper_demo.py    # (haiku)
        ├── scraper_adapt.py   # (sonnet)
        ├── analyse.py         # /analyse (sonnet)
        ├── cv.py              # /cv (sonnet)
        ├── lettre.py          # /lettre (sonnet)
        ├── entretien.py       # /entretien (opus)
        ├── mark_applied.py    # (haiku)
        └── chat.py            # chat (haiku défaut, escalade sonnet)
```

## Règles dures

### Model routing (non négociable)

Table dans `sdk_client.py`, synchrone avec `docs/adr/0002-model-routing.md` :

```python
WORKFLOW_MODELS = {
    "init":          "claude-opus-4-7",
    "recherche":     "claude-opus-4-7",
    "scraper_gen":   "claude-sonnet-4-6",
    "scraper_demo":  "claude-haiku-4-5",
    "scraper_adapt": "claude-sonnet-4-6",
    "analyse":       "claude-sonnet-4-6",
    "cv":            "claude-sonnet-4-6",
    "lettre":        "claude-sonnet-4-6",
    "entretien":     "claude-opus-4-7",
    "mark_applied":  "claude-haiku-4-5",
    "chat":          "claude-haiku-4-5",
    "chat_escalated":"claude-sonnet-4-6",
}
```

Modifier cette table → PR + mise à jour ADR.

### Prompt caching (non négociable)

Chaque appel passe par `sdk_client.build_cached_system(user_id)` qui retourne deux blocs système avec `cache_control: {type: "ephemeral"}` :

1. `SKILL.md` du skill rae-generic (stable entre tous les users).
2. Concatenation `FACTS.md + BULLET_LIBRARY.md + preset.md` du user (stable entre workflows d'un même user).

Voir `docs/adr/0003-prompt-caching-strategy.md`.

### Tracking ai_jobs

Chaque appel :
- Crée row `ai_jobs` avec `status='running'` au début.
- Met à jour `tokens_in`, `tokens_out`, `tokens_in_cached`, `tokens_in_uncached`, `status='done'` ou `'error'`, `finished_at` à la fin.
- Incrémente `users.quota_used_tokens` si la clé utilisée est la clé admin.
- Si `users.quota_used_tokens >= quota_limit_tokens` et pas de `anthropic_key_encrypted` : retourner HTTP 402.

### Choix de la clé (quota.py)

```python
def pick_api_key(user_id) -> tuple[str, Literal["admin", "user"]]:
    user = db.get_user(user_id)
    if user.anthropic_key_encrypted:
        return decrypt(user.anthropic_key_encrypted), "user"
    if user.quota_used_tokens < user.quota_limit_tokens:
        return settings.ANTHROPIC_API_KEY_ADMIN, "admin"
    raise QuotaExceeded()
```

## Pattern workflow (à suivre)

```python
async def run(user_id: UUID, **kwargs) -> Result:
    job = await db.start_ai_job(user_id, workflow="analyse", model=WORKFLOW_MODELS["analyse"])
    try:
        api_key, which = quota.pick_api_key(user_id)
        system = sdk_client.build_cached_system(user_id)
        response = await sdk_client.call(
            api_key=api_key,
            model=WORKFLOW_MODELS["analyse"],
            system=system,
            messages=[...],
        )
        await db.finish_ai_job(job.id, response.usage, status="done")
        if which == "admin":
            await db.inc_quota(user_id, response.usage.input_tokens + response.usage.output_tokens)
        return Result(...)
    except Exception as e:
        await db.finish_ai_job(job.id, None, status="error", error=str(e))
        raise
```

Ne pas dévier de ce pattern. C'est la garantie que quotas, tracking et caching restent cohérents.

## SSE pour workflows longs

`/init` et `/entretien` streament via SSE. Utiliser `starlette.responses.StreamingResponse` ou `sse-starlette`. Events : `{type: "progress", step: "parsing_cv", percent: 20}`, `{type: "question", text: "..."}`, `{type: "done", result: {...}}`.

## Interdits

- Jamais d'appel direct `anthropic.Client()` hors de `sdk_client.py`.
- Jamais de prompt sans `cache_control` sur les blocs système.
- Jamais d'écriture dans `skills/rae-generic/` (read-only).
- Jamais de `print()` : utiliser `structlog` configuré dans `config.py`.

## Tests

- `pytest` sur chaque workflow avec mock SDK.
- Test dédié : `test_model_routing.py` vérifie que chaque workflow appelle le bon modèle.
- Test dédié : `test_prompt_caching.py` vérifie que `cache_control` est présent sur les bons blocs.
