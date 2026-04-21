# infra/ — Docker Compose stack

Topologie Docker du stack ArizoRAE V2. Un seul `docker-compose.yml` orchestre tout. Secrets dans `.env` (racine repo, non versionné), défauts dans `.env.example`.

## Services

| Service | Image/Dockerfile | Ports | Rôle |
|---|---|---|---|
| `caddy` | Dockerfile (caddy + plugin duckdns) | 443 (80 optionnel) | Reverse proxy TLS |
| `portal` | `portal/Dockerfile` | 3000 (interne) | Next.js frontend + BFF |
| `agent` | `agent-worker/Dockerfile` | 8000 (interne) | FastAPI + Claude SDK |
| `scraper` | `scraper-worker/Dockerfile` (cmd: worker) | — | Celery worker |
| `beat` | idem scraper (cmd: beat) | — | Celery Beat |
| `postgres` | `postgres:16-alpine` | 5432 (interne) | DB principale |
| `redis` | `redis:7-alpine` | 6379 (interne) | Broker + cache |
| `terminal` | `tsl0922/ttyd` + claude CLI | 7681 (via caddy /terminal) | Debug power-user |
| `gotify` | `gotify/server` | 80 (via caddy /gotify) | Notif admin |
| `ngrok` | `ngrok/ngrok` | — | Profile `ngrok` (optionnel) |

## Volumes

- `caddy_data` → `/data` (certificats TLS)
- `postgres_data` → `/var/lib/postgresql/data`
- `redis_data` → `/data`
- `gotify_data` → `/app/data`
- `users_datas` bind mount → `./users_datas/` (partagé portal + agent + scraper + terminal)
- `skills` bind mount → `../skills/` (read-only, monté dans agent et terminal)

## Réseaux

- `arizorae_net` (bridge) : services internes
- Caddy seul est exposé sur le host (port 443)

## Variables `.env` critiques

Voir `.env.example` pour la liste exhaustive.

Clés par domaine :
- **TLS/DNS** : `DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN`, `DOMAIN`, `ACME_EMAIL`
- **Auth** : `AUTH_SECRET_KEY` (signe cookies + chiffre clés user Anthropic)
- **DB** : `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
- **Cache/broker** : `REDIS_URL`
- **SMTP** : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Anthropic** : `ANTHROPIC_API_KEY_ADMIN` (clé admin pour quota gratuit users)
- **Agent-worker** : `AGENT_WORKER_SECRET` (header partagé portal ↔ agent)
- **Gotify** : `GOTIFY_ADMIN_TOKEN` (pour poster notifs support)
- **Terminal** : `TERMINAL_PASSWORD`
- **Ngrok** : `NGROK_AUTHTOKEN`
- **Divers** : `TZ`, `PUBLIC_URL`

## Commandes courantes

```bash
# Démarrer
docker compose up -d

# Stopper
docker compose down

# Avec ngrok (CGNAT)
docker compose --profile ngrok up -d

# Rebuild un service après modif Dockerfile
docker compose build portal
docker compose up -d portal

# Logs
docker compose logs -f --tail=100 agent

# Shell dans un service
docker compose exec portal sh
docker compose exec agent bash

# Migration Prisma
docker compose exec portal npx prisma migrate dev --name <nom>

# Backup Postgres
docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql

# Restore
cat backup.sql | docker compose exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB
```

## Routage Caddy (résumé)

```
https://${DOMAIN}/                → portal:3000
https://${DOMAIN}/terminal/*      → terminal:7681 (basic auth TERMINAL_PASSWORD)
https://${DOMAIN}/gotify/*        → gotify:80
```

Agent-worker, scraper-worker, postgres, redis ne sont **jamais** routés publiquement.

## Règles

- Modifier `docker-compose.yml` → mettre à jour ce fichier et `.env.example` si nouvelles vars.
- Ajouter un service → ADR dédié si c'est une décision structurante.
- Chaque service doit avoir `restart: unless-stopped` sauf ngrok (profile-driven).
- Healthchecks Docker obligatoires pour postgres et redis (les autres en dépendent via `depends_on.condition: service_healthy`).

## Interdits

- Pas de port bindé sur le host hors de 443 (et 80 si redirect HTTP→HTTPS).
- Pas de secret dans `docker-compose.yml` : toujours via `${VAR}` depuis `.env`.
- Pas de `network_mode: host` sauf pour ngrok en profil dev ponctuel.
