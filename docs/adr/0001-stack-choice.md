# ADR 0001 — Choix de stack

Statut : accepté
Date : 2026-04-21

## Contexte

ArizoRAE V2 est un SaaS auto-hébergé multi-utilisateurs qui orchestre des appels Claude et des jobs longs (scraping, génération de documents) derrière un portail web.

## Décision

- **Portal** : Next.js 14 App Router + TypeScript. Server components par défaut, Prisma comme ORM, NextAuth pour l'authentification.
- **Agent-worker** : FastAPI (Python 3.12) + Claude Agent SDK Python. Expose des endpoints internes consommés par le portal.
- **Scraper-worker** : Celery + Redis + Playwright. Un worker qui exécute les scrapers Python générés par user.
- **Base de données** : PostgreSQL 16.
- **Reverse proxy** : Caddy 2.
- **Notif admin** : Gotify.
- **Déploiement** : Docker Compose.

## Alternatives considérées

- **Next.js API routes seules** (sans FastAPI) : rejeté car la lib Anthropic Python (SDK + skill natif) est plus mature, et les workflows IA sont des jobs longs mieux gérés côté Python.
- **Traefik** au lieu de Caddy : équivalent fonctionnellement, Caddy choisi pour syntaxe plus lisible et TLS auto out-of-the-box.
- **APScheduler** au lieu de Celery : rejeté pour manque de scalabilité et fragilité au restart (pas de persistance jobs en cours).

## Conséquences

- Deux codebases principales à maintenir (TS + Python), mais chaque service reste petit.
- Communication portal ↔ agent-worker en HTTP + header secret partagé (`AGENT_WORKER_SECRET`).
- Prisma est la source de vérité du schéma DB ; agent-worker et scraper-worker lisent via SQLAlchemy async.
