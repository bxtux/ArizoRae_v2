# ADR 0003 — Stratégie de prompt caching

Statut : accepté
Date : 2026-04-21

## Contexte

Les workflows RAE injectent à chaque appel : `SKILL.md` du skill rae-generic (~5k tokens), `FACTS.md` user (~2k), `BULLET_LIBRARY.md` user (~3k), `preset.md` user (~2k). Soit ~12k tokens de contexte stable par appel. Sans cache : 12k × prix input × N appels. Avec cache ephemeral : 90% d'économie.

## Décision

Toute requête à l'API Anthropic via le SDK utilise `cache_control: {type: "ephemeral"}` sur les blocs suivants, dans cet ordre exact :

1. System prompt contenant `SKILL.md` (cached)
2. System prompt contenant `FACTS.md` + `BULLET_LIBRARY.md` + `preset.md` par user (cached)
3. Messages spécifiques à l'appel (non cached)

Cache TTL Anthropic = 5 min. Les workflows chainés (`/analyse` → `/cv` → `/lettre`) profitent du cache chaud s'ils s'enchaînent dans la fenêtre.

## Règles d'implémentation (dans `agent-worker/app/sdk_client.py`)

- Helper `build_cached_system(user_id) → list[dict]` qui construit les 2 blocs système avec `cache_control`.
- Ne **jamais** concaténer les 4 fichiers en un seul bloc : le cache doit se segmenter par niveau de changement (skill = changera rarement, user = change à chaque edit).
- Invalider manuellement le cache user après chaque `write FACTS.md` ou `write BULLET_LIBRARY.md` : le SDK recalcule le hash automatiquement, rien à faire.
- Tracker dans `ai_jobs` les champs `tokens_in_cached` et `tokens_in_uncached` pour mesurer l'efficacité.

## Alternatives considérées

- **Cache persistant (Anthropic prompt caching beta)** : TTL plus long mais coût à l'écriture + complexité. À réévaluer si volume justifie.
- **Pas de cache** : simple mais multiplie la facture par ~10.

## Conséquences

- Coût par user divisé par ~10 sur input tokens.
- Monitoring obligatoire via `ai_jobs.tokens_in_cached / (tokens_in_cached + tokens_in_uncached)` pour détecter régressions.
- Tests unitaires : un test par workflow vérifie que le SDK est appelé avec `cache_control` sur les bons blocs.
