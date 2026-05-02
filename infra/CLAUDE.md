# infra/ — Docker Compose stack

Topologie Docker du stack ArizoRAE V2. Un seul `docker-compose.yml` orchestre tout. Secrets dans `.env` (racine repo, non versionné), défauts dans `.env.example`.

## Services

| Service | Image/Dockerfile | Ports | Rôle |
|---|---|---|---|
| `caddy` | Dockerfile (caddy + plugin duckdns) | 443, 80 | Reverse proxy TLS auto DuckDNS |
| `portal` | `portal/Dockerfile` | 3000 (interne) | Next.js 14 App Router — frontend + BFF |
| `agent` | `agent-worker/Dockerfile` | 8000 (interne) | FastAPI + Claude Agent SDK |
| `scraper` | `scraper-worker/Dockerfile` (cmd: worker) | — | Celery worker (queues default + scrapers) |
| `beat` | idem scraper (cmd: beat) | — | Celery Beat — digest mail + backup Postgres |
| `postgres` | `postgres:16-alpine` | 5432 (interne) | DB principale |
| `redis` | `redis:7-alpine` | 6379 (interne) | Broker Celery + result backend |
| `terminal` | Dockerfile ttyd + claude CLI | 7681 (via caddy /terminal) | Debug power-user, auth TERMINAL_PASSWORD_HASH (bcrypt) |
| `gotify` | `gotify/server` | 80 (via caddy /gotify) | Notifications admin (support, alertes) |
| `ngrok` | `ngrok/ngrok` | — | Profile `ngrok` (optionnel, CGNAT) |

## Volumes

| Nom | Montage | Services | Contenu |
|---|---|---|---|
| `caddy_data` | `/data` | caddy | Certificats TLS Let's Encrypt |
| `postgres_data` | `/var/lib/postgresql/data` | postgres | Données DB |
| `redis_data` | `/data` | redis | Persistance AOF |
| `gotify_data` | `/app/data` | gotify | Messages Gotify |
| `backups_data` | `/backups` | scraper, beat | Dumps Postgres quotidiens (7j rétention) |
| bind `./users_datas` | `/users_datas` | portal, agent, scraper, beat, terminal | Données par user (FACTS, scraper.py, outputs, .trash/) |
| bind `../skills` | `/skills` (`:ro`) | agent, terminal | Skills read-only |

## Réseaux

- `arizorae_net` (bridge) : tous les services
- Seul `caddy` est exposé sur le host (443, 80)

## Variables `.env` critiques

Voir `.env.example` pour la liste exhaustive.

| Domaine | Variables |
|---|---|
| TLS/DNS | `DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN`, `DOMAIN`, `ACME_EMAIL` |
| Auth | `AUTH_SECRET_KEY` — signe les cookies NextAuth **et** chiffre les clés Anthropic user (AES-256-GCM) |
| DB | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` |
| DB backup | `POSTGRES_HOST=postgres`, `POSTGRES_PORT=5432` (pour pg_dump dans scraper-worker) |
| Cache/broker | `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME` |
| Anthropic | `ANTHROPIC_API_KEY_ADMIN` — quota gratuit users (clé admin) |
| OpenAI | `OPENAI_API_KEY_ADMIN` — optionnel, clé admin OpenAI si provider openai utilisé sans clé user |
| Agent | `AGENT_WORKER_URL=http://agent:8000`, `AGENT_WORKER_SECRET` |
| Gotify | `GOTIFY_URL`, `GOTIFY_ADMIN_TOKEN` |
| Terminal | `TERMINAL_PASSWORD_HASH` — bcrypt hash du mot de passe terminal (généré via `htpasswd -nbB user pass \| cut -d: -f2`) |
| Ngrok | `NGROK_AUTHTOKEN` |
| Divers | `TZ=Europe/Brussels`, `PUBLIC_URL` |

> **Attention rotation `AUTH_SECRET_KEY`** : invalide toutes les sessions actives ET toutes les clés Anthropic **et OpenAI** chiffrées des utilisateurs. Voir `docs/RUNBOOK.md` section 3.

## Commandes courantes

```bash
# Démarrer le stack
cd infra && docker compose up -d

# Avec ngrok (si CGNAT)
docker compose --profile ngrok up -d

# Stopper (données conservées)
docker compose down

# Rebuild d'un service après modif code
docker compose build portal && docker compose up -d portal

# Logs en temps réel
docker compose logs -f --tail=100 agent

# Shell dans un conteneur
docker compose exec portal sh
docker compose exec agent bash

# Migration Prisma
docker compose exec portal npx prisma migrate dev --name <nom>
docker compose exec portal npx prisma migrate deploy  # prod

# Backup Postgres manuel (aussi déclenché automatiquement par Celery Beat toutes les 24h)
docker compose exec scraper celery -A app.celery_app call app.beat_tasks.backup_postgres

# Restaurer un backup
gunzip < backups/arizorae_<ts>.sql.gz | \
  docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB
```

## Routage Caddy (résumé)

```
https://${DOMAIN}/             → portal:3000
https://${DOMAIN}/terminal/*   → terminal:7681  (basic auth TERMINAL_PASSWORD)
https://${DOMAIN}/gotify/*     → gotify:80
```

Agent-worker (`agent:8000`), scraper, postgres, redis — **jamais** routés publiquement.

## Règles

- Modifier `docker-compose.yml` → mettre à jour ce fichier et `.env.example` si nouvelles variables.
- Ajouter un service structurant → ADR dédié dans `docs/adr/`.
- Chaque service doit avoir `restart: unless-stopped` (sauf `ngrok`, profile-driven).
- Healthchecks obligatoires pour `postgres` et `redis` — les autres dépendent via `depends_on.condition: service_healthy`.

## Interdits

- Pas de port bindé sur le host hors de 443 (et 80 pour redirect HTTP→HTTPS).
- Pas de secret en clair dans `docker-compose.yml` — toujours `${VAR}` depuis `.env`.
- Pas de `network_mode: host`.
