# ADR 0008 — Support multi-provider IA (Claude + OpenAI)

Statut : accepté
Date : 2026-05-02

## Contexte

Après la finalisation V2 (M1–M7), le code a été étendu pour supporter OpenAI
comme provider alternatif à Claude. Cette fonctionnalité n'était pas planifiée
dans le cahier des charges initial mais est implémentée dans le code de
production. Cet ADR documente la décision a posteriori pour aligner la doc sur
le code.

**Motivation** : permettre aux utilisateurs de choisir leur provider IA (Claude
ou OpenAI) en fournissant leur propre clé API, ou d'utiliser la clé admin
OpenAI si configurée. Offre un fallback et réduit la dépendance à un seul
fournisseur.

## Décision

L'agent-worker supporte deux providers : `"claude"` (défaut) et `"openai"`.
Le provider est stocké par user dans `users.ai_provider` (défaut `"claude"`).
La logique de routage est centralisée dans `_base.run_simple()`.

### Table de routage OpenAI (`OPENAI_WORKFLOW_MODELS` dans `sdk_client.py`)

| Workflow | Modèle OpenAI | Équivalent Claude |
|---|---|---|
| init | `gpt-4o` | `claude-opus-4-7` |
| recherche | `gpt-4o` | `claude-opus-4-7` |
| scraper_gen | `gpt-4o` | `claude-sonnet-4-6` |
| scraper_demo | `gpt-4o-mini` | `claude-haiku-4-5` |
| scraper_adapt | `gpt-4o` | `claude-sonnet-4-6` |
| analyse | `gpt-4o` | `claude-sonnet-4-6` |
| cv | `gpt-4o` | `claude-sonnet-4-6` |
| lettre | `gpt-4o` | `claude-sonnet-4-6` |
| entretien | `gpt-4o` | `claude-opus-4-7` |
| mark_applied | `gpt-4o-mini` | `claude-haiku-4-5` |
| chat | `gpt-4o-mini` | `claude-haiku-4-5` |
| chat_escalated | `gpt-4o` | `claude-sonnet-4-6` |

### Architecture

- `users.ai_provider` : enum `"claude"` \| `"openai"` (défaut `"claude"`).
- `users.openai_key_encrypted` : clé OpenAI user chiffrée AES-256-GCM (même
  algorithme que `anthropic_key_encrypted`, même `AUTH_SECRET_KEY`).
- `quota.pick_openai_key(user_id)` : choisit clé user si présente, sinon
  `OPENAI_API_KEY_ADMIN` (optionnel), sinon HTTP 400.
- `sdk_client.build_system_text(user_id)` : version plain-text du contexte
  système pour OpenAI (pas de `cache_control` — l'API OpenAI ne supporte pas
  le prompt caching Anthropic).
- `sdk_client.call_openai()` / `stream_openai()` : wrappers AsyncOpenAI avec
  interface identique à `call()` / `stream()`.
- `_base.run_simple()` : route vers OpenAI ou Anthropic selon `user.ai_provider`.

### Invariants conservés

- Model routing par workflow conservé (même logique, tables différentes).
- Tracking `ai_jobs` inchangé (tokens, status, erreurs).
- Quota admin/user : pour OpenAI, `increment_quota` s'applique aussi si clé
  admin utilisée (uncached tokens uniquement). Clé user → pas d'impact quota.
- Header `X-Agent-Secret` et auth middleware inchangés.

## Trade-offs

| Aspect | Impact |
|---|---|
| Prompt caching | **Absent pour OpenAI** — pas de `cache_control` ephemeral. Coût tokens plus élevé si provider = openai. |
| Qualité skill rae-generic | Skill SKILL.md injecté en system text plain — OpenAI l'utilise mais sans optimisation Anthropic. |
| Quota tracking | Tokens OpenAI trackés mais `cache_read_input_tokens` est toujours 0 côté OpenAI. |
| Clé admin | `OPENAI_API_KEY_ADMIN` est optionnel (champ vide dans `.env.example`). Si absent et pas de clé user, HTTP 400. |

## Variables d'environnement

- `OPENAI_API_KEY_ADMIN` (optionnel) : clé OpenAI admin pour users sans clé
  personnelle. Vide par défaut dans `.env.example`.

## Alternatives considérées

- **Claude uniquement** : simple, conforme au plan initial, mais limiterait les
  users souhaitant utiliser leur compte OpenAI existant.
- **Routage automatique par disponibilité** : rejeté — imprévisible pour le user.
- **Provider par workflow** : rejeté — trop complexe, le user choisit un provider
  global.

## Conséquences

- Modifier `WORKFLOW_MODELS` ou `OPENAI_WORKFLOW_MODELS` → nouvelle PR + mise
  à jour de `docs/adr/0002-model-routing.md` (pour Claude) ou de cet ADR (pour
  OpenAI).
- Tests unitaires `test_model_routing.py` couvrent les deux providers.
- `settings` page portal expose le choix du provider et la saisie de la clé
  OpenAI user.
