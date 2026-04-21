# ArizoRAE V2 — contexte racine

SaaS auto-hébergé d'assistance à la recherche d'emploi basé sur le skill `rae-generic` (Cliff Simpkins). Chaque user a un agent personnalisé qui parse son CV, génère un scraper Python, score les offres, produit CV/lettre adaptés, prépare les entretiens. Chatbot omniprésent, mails périodiques, notif admin via Gotify.

## Stack

- Portal : **Next.js 14 App Router + TS** (`portal/`)
- Agent-worker : **FastAPI Python + Claude Agent SDK** (`agent-worker/`)
- Scraper-worker : **Celery + Playwright** (`scraper-worker/`)
- DB : **PostgreSQL 16** (schéma = `portal/prisma/schema.prisma`)
- Broker : **Redis**
- Reverse proxy : **Caddy 2** (DuckDNS TLS)
- Notif admin : **Gotify**
- Déploiement : **Docker Compose** (`infra/docker-compose.yml`)

## Où lire avant de coder

- `docs/ROADMAP.md` : jalons M1-M7
- `docs/GLOSSARY.md` : termes métier et techniques
- `docs/adr/` : décisions d'architecture, ne pas les contredire sans écrire un nouvel ADR
- `skills/rae-generic/SKILL.md` : le skill que l'agent-worker invoque, source de vérité du comportement métier

Pour un module, lire **seulement** le `CLAUDE.md` de ce module (pas les autres). C'est le principe d'économie de tokens : contexte hiérarchique, chargé à la demande.

## Conventions générales

- User-facing en **français**. Code, logs, commits, messages d'erreur interne en **anglais**.
- Pas d'emoji dans le code ni la doc, sauf demande explicite.
- Secrets jamais dans le code : `.env` à la racine (non versionné), `.env.example` à jour.
- Git commits : style conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Un `user_id` est toujours l'UUID Postgres, jamais l'email.

## Flux d'exécution typique (mental model)

```
User (portal) → Next API route → [enqueue Celery task | POST agent-worker]
                                      ↓                      ↓
                              scraper-worker          agent-worker
                                      ↓                      ↓
                                 scraper.py         Claude SDK + skill
                                      ↓                      ↓
                                 job_offers  ←→  FACTS/BULLET/preset (users_datas)
                                      ↑                      ↑
                                       \—————— DB ——————————/
```

## Commandes utiles

```bash
# Démarrer le stack complet
cd infra && docker compose up -d

# Logs d'un service
docker compose logs -f portal

# Migrations Prisma
docker compose exec portal npx prisma migrate dev

# Exécuter le scraper d'un user en dev
docker compose exec scraper python -m app.runner --user-id <uuid>

# Linter/type-check portal
docker compose exec portal npm run check
```

## Règles de modification

1. **Ne jamais** toucher à `skills/rae-generic/` (read-only, mirror du skill upstream).
2. Toute modification de la table de routage modèle (opus/sonnet/haiku) passe par une mise à jour de `docs/adr/0002-model-routing.md`.
3. Nouveau workflow IA → suivre `skills/arizorae-workflow-add/SKILL.md`.
4. Bug scraper user → `skills/arizorae-debug-scraper/SKILL.md`.
5. Ajouter un jobboard → `skills/arizorae-add-jobboard/SKILL.md`.

## Interdits

- Pas de `use client` Next.js par défaut (server components sauf nécessité).
- Pas d'appel direct à l'API Anthropic depuis le portal : tout passe par `agent-worker`.
- Pas de secret en dur, jamais.
- Pas de requêtes SQL brutes quand Prisma peut typer.
- Pas de modification de `FACTS.md` / `BULLET_LIBRARY.md` user sans confirmation user (règle skill rae-generic).
