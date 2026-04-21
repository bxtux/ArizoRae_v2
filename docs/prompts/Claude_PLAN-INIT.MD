# Plan d'implémentation ArizoRAE V2

## Context

ArizoRAE V2 est un portail web multi-utilisateurs qui transforme le skill `rae-generic` (assistant de recherche active d'emploi, basé sur l'idée de Cliff Simpkins) en SaaS auto-hébergé. Chaque chercheur d'emploi obtient un agent personnalisé qui : parse son CV, construit un profil (`FACTS.md` + `BULLET_LIBRARY.md` + `preset.md`), génère un scraper Python dédié, score les offres, produit CV/lettre adaptés et prépare les entretiens. Un chatbot omniprésent relaie les demandes au skill, des mails périodiques poussent les nouvelles offres, Gotify notifie l'admin pour le support.

La V2 a pour but de livrer un **MVP complet** (inscription, onboarding, scraper, candidatures, chatbot, mails, stats, support) mais **sans admin panel avancé ni multi-langue**. L'architecture cible est un **stack Docker auto-hébergé** derrière un reverse proxy Caddy, exposé via DuckDNS.

## Décisions d'architecture (choisies avec l'utilisateur)

| Domaine | Choix retenu |
|---|---|
| Frontend portail | Next.js 14 App Router + TypeScript |
| Auth | NextAuth (Credentials + Email magic link, SMTP .env) |
| Orchestration IA | Service dédié `agent-worker` (FastAPI + Claude Agent SDK Python) + `ttyd` exposé en mode power-user |
| Scraper | 1 script Python Playwright par user, exécuté en worker Celery |
| Scheduler | Celery + Redis + Celery Beat |
| Persistance | PostgreSQL (users, offres, candidatures, stats) + fichiers MD par user (`infra/users_datas/<user_id>/`) |
| Clé Anthropic | Hybride (clé admin avec quota gratuit, user peut ajouter sa clé au-delà) |
| Reverse proxy | Caddy (TLS auto via DuckDNS/Let's Encrypt) |
| Notif support | Gotify (webhook admin) |
| Doc Claude | CLAUDE.md hiérarchiques + skills `arizorae-*` + ADR |

## Topologie Docker cible

```
infra/
├── docker-compose.yml                (orchestration globale)
├── .env                              (existant, à compléter)
├── caddy/
│   ├── Caddyfile                     (routage TLS, reverse proxy)
│   └── data/                         (certificats, volume)
├── portal/                           (Next.js 14, service "portal")
│   ├── Dockerfile
│   ├── package.json
│   └── src/app/...                   (voir section Portal)
├── agent-worker/                     (FastAPI + Claude Agent SDK, service "agent")
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── app/
│       ├── main.py                   (FastAPI, endpoints internes)
│       ├── workflows/                (init, recherche, analyse, cv, lettre, entretien, chat)
│       ├── sdk_client.py             (wrapper Claude Agent SDK, routage modèle par workflow)
│       ├── quota.py                  (clé admin vs clé user, tracking)
│       └── skill_loader.py           (monte /skills/rae-generic au SDK)
├── scraper-worker/                   (Celery worker + Playwright, service "scraper")
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── app/
│       ├── tasks.py                  (run_scraper_for_user, run_scraper_demo)
│       ├── celery_app.py
│       └── runner.py                 (exécute users_datas/<user_id>/scraper.py en sandbox)
├── beat/                             (Celery Beat, service "beat" - périodiques mails)
├── redis/                            (broker Celery, cache Next)
├── postgres/                         (DB principale, volume persistant)
├── terminal/                         (ttyd + claude CLI, service "terminal", restreint via Caddy auth)
├── gotify/                           (service "gotify", push notifications admin)
├── ngrok/                            (optionnel, profile ngrok)
└── users_datas/                      (volume partagé agent+scraper+terminal)
    └── <user_id>/
        ├── config.json               (pointé par rae-generic)
        ├── FACTS.md
        ├── BULLET_LIBRARY.md
        ├── preset.md
        ├── cv_raw.txt
        ├── cv_original.pdf
        ├── scraper.py                (généré par Claude Code sonnet)
        ├── scraper_config.json       (préférences user: nb offres, filtres éliminatoires)
        ├── chat_log.md               (chatbot, traité par rae-generic)
        └── outputs/                  (CV/lettre/fiches entretien générés)
```

## Modèle de données PostgreSQL

Tables principales (schéma dans `portal/prisma/schema.prisma`, source de vérité) :

- `users(id, email, first_name, password_hash, email_verified_at, created_at, deleted_at, anthropic_key_encrypted, quota_used_tokens, quota_limit_tokens, mail_frequency_days NULL, last_mail_at)`
- `email_verification_tokens(token, user_id, expires_at)`
- `password_reset_tokens(token, user_id, expires_at)`
- `sessions(id, user_id, expires_at)` (NextAuth)
- `job_offers(id, user_id, external_id, source, title, company, location, url, scraped_at, score, score_reasons_json, raw_json, status enum[new,applied,rejected,not_interested], not_interested_reason)`
- `applications(id, offer_id, user_id, cv_path, letter_path, created_at, notes)`
- `chat_messages(id, user_id, role, content, created_at)` (miroir DB du chat_log.md pour requêtes rapides)
- `ai_jobs(id, user_id, workflow, model, status, input_json, output_json, tokens_in, tokens_out, started_at, finished_at, error)` (tracking SDK)
- `support_tickets(id, user_id, subject, body, created_at)`

Migrations gérées par **Prisma** (portal) pour partager le schéma avec Next. `agent-worker` et `scraper-worker` lisent via SQLAlchemy async en ne touchant que les tables nécessaires (`job_offers`, `ai_jobs`, `applications`, `chat_messages`, `users.quota*`).

## Routage modèle Claude par workflow (économie tokens)

Centralisé dans `agent-worker/app/sdk_client.py`, table dure :

| Workflow | Modèle | Raison |
|---|---|---|
| `/init` | `claude-opus-4-7` | Extraction CV + construction BULLET/FACTS (complexe, one-shot) |
| `/recherche` initiale | `claude-opus-4-7` | Scoring + sélection jobboards |
| génération scraper.py | `claude-sonnet-4-6` | Code Python standard |
| démo scraper | `claude-haiku-4-5` | Exécution + formatting liste |
| adaptation scraper | `claude-sonnet-4-6` | Édition ciblée |
| `/analyse` | `claude-sonnet-4-6` | Analyse offre |
| `/cv`, `/lettre` | `claude-sonnet-4-6` | Génération documents |
| marquage "postulé" | `claude-haiku-4-5` | Simple toggle + log |
| `/entretien` | `claude-opus-4-7` | Préparation approfondie |
| chatbot (réponses courtes) | `claude-haiku-4-5` | Défaut ; escalade à sonnet si user demande action complexe |

**Prompt caching systématique** : le `SKILL.md` de `rae-generic` + `FACTS.md` + `BULLET_LIBRARY.md` sont injectés avec `cache_control: ephemeral` dans chaque requête du user. Gain attendu : 90% tokens input réutilisés entre workflows d'une même session.

## Flux clés

### 1. Inscription
`POST /api/auth/signup` (portal) → crée `users` row (unverified) → envoie mail SMTP avec `email_verification_tokens.token` → `GET /api/auth/verify?token=…` → `email_verified_at` set → redirect `/onboarding`.

### 2. Onboarding (setup)
`/onboarding` (portal) collecte : upload CV, métier visé, pays, localisation, préférences. Stocke CV dans `users_datas/<user_id>/cv_original.pdf`, crée job Celery `onboard_user(user_id)` →

1. `agent-worker` exécute `/init` via SDK (opus) : lit CV, pose questions de complétion (via polling WebSocket / SSE vers portal), écrit `FACTS.md` + `BULLET_LIBRARY.md` + `preset.md`.
2. `/recherche` (opus) : scoring jobboards, liste initiale, demande remarques user.
3. Génération `scraper.py` (sonnet, Claude Code style) depuis template + preset.
4. Démo scraper (haiku) : exécute `scraper.py --demo --limit 5`, retourne aperçu.
5. User précise préférences → adaptation scraper (sonnet) → commit `scraper.py`.

Status tracké dans `ai_jobs` + WebSocket `/api/ws/onboarding/<user_id>`.

### 3. Usage courant
Dashboard `/dashboard` : bouton "Lancer scraper" → `POST /api/scraper/run` → Celery task → `scraper-worker` exécute `users_datas/<user_id>/scraper.py` → résultats insérés dans `job_offers` (status `new`).

Par offre, actions :
- **Postuler** : `/analyse` (sonnet) → modal de confirmation → `/cv` (sonnet) → proposition lettre → si oui `/lettre` (sonnet) → stockage dans `outputs/` + `applications` row → marquage `applied` (haiku job trivial mais pour traçabilité IA).
- **Pas intéressé** : raison optionnelle → si donnée, `agent-worker` (sonnet) propose diff sur `scraper.py` → user valide → commit.
- **Préparer entretien** : `/entretien` (opus) → fiche MD téléchargeable (PDF via `weasyprint` côté agent-worker).

### 4. Chatbot omniprésent
Composant `<RaeChat>` (avatar `docs/ui-design/.../rae-avatar.png`) monté dans layout racine. Messages → `POST /api/chat` → `agent-worker/chat` (haiku défaut) avec contexte : `FACTS.md`, `preset.md`, derniers 10 messages, page courante. Persistance : insert `chat_messages` + append à `chat_log.md`.

### 5. Mails périodiques
Celery Beat lit `users.mail_frequency_days` → pour chaque user éligible → query `job_offers WHERE status='new' AND scraped_at > last_mail_at` → template HTML → SMTP → update `last_mail_at`.

### 6. Support
`/settings/support` → `POST /api/support` → insert ticket + POST Gotify `https://gotify/message` avec priorité 8.

## Structure `portal/` (Next.js 14)

```
portal/src/
├── app/
│   ├── (public)/               (landing, login, signup, reset)
│   ├── (auth)/
│   │   ├── onboarding/         (stepper: CV upload, métier, démo scraper)
│   │   ├── dashboard/          (offres scrapées)
│   │   ├── applications/       (postulations effectuées)
│   │   ├── settings/           (mail freq, clé Anthropic, supprimer compte, support)
│   │   └── stats/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── scraper/run/
│       ├── offers/[id]/{apply,reject,interview}/
│       ├── chat/
│       ├── support/
│       └── ws/                 (SSE streaming pour jobs IA longs)
├── components/
│   ├── rae-chat/               (chatbot, inspiré du prototype HTML)
│   ├── offer-card/
│   └── stepper/
├── lib/
│   ├── db.ts                   (Prisma client)
│   ├── agent-client.ts         (HTTP vers agent-worker)
│   ├── celery-client.ts        (enqueue via redis)
│   └── auth.ts                 (NextAuth config)
└── styles/                     (port du CSS du prototype RAE UI)
```

Le **design system** vient du prototype `docs/ui-design/rae-assistant/project/RAE UI Prototype.html` : tokens CSS (variables `--bg`, `--primary` orange `#e85520`, `--gold`, font Space Grotesk/Mono), glassmorphism, avatar RAE. Porter ces tokens dans `portal/src/styles/tokens.css` + Tailwind config.

## Structure `agent-worker/` (FastAPI + Claude Agent SDK)

Endpoints internes (auth via header secret partagé) :
- `POST /workflows/init` body `{user_id, cv_path, metier, country}` → stream SSE
- `POST /workflows/analyse` body `{user_id, offer_id}` → JSON
- `POST /workflows/cv`, `/lettre`, `/entretien` → JSON + fichier path
- `POST /chat` body `{user_id, message, context_page}` → stream
- `POST /scraper/generate` body `{user_id, remarks}` → produit scraper.py
- `POST /scraper/adapt` body `{user_id, diff_request}` → patch

Chaque handler :
1. Charge `users_datas/<user_id>/config.json` + FACTS/BULLET/preset (avec cache Redis 5min, clef = hash mtime).
2. Choisit modèle via table ci-dessus.
3. Appelle SDK avec `cache_control` sur les blocs longs.
4. Track tokens → `ai_jobs` + `users.quota_used_tokens`.
5. Si quota dépassé + pas de clé user → erreur 402 → portal affiche modal "ajouter clé".

Le **skill `rae-generic`** est monté read-only depuis `/skills/rae-generic/` (volume). Les fichiers `references/` et `scripts/init_rae.py` sont directement utilisés.

## Fichiers contexte Claude Code (économie tokens)

### CLAUDE.md hiérarchiques (auto-chargés)
- `/CLAUDE.md` racine : vue 50 lignes max (stack, conventions, liens vers ADR)
- `portal/CLAUDE.md` : conventions Next (server components par défaut, pas de "use client" sans raison, Prisma queries)
- `agent-worker/CLAUDE.md` : table modèles, pattern handler, règles prompt caching
- `scraper-worker/CLAUDE.md` : template scraper, règles Playwright (timeouts, user-agents)
- `infra/CLAUDE.md` : topologie Docker, secrets, commandes utiles

### Skills Claude Code dédiés
- `skills/arizorae-add-jobboard/SKILL.md` : ajouter un jobboard au scraper d'un user (flow précis)
- `skills/arizorae-debug-scraper/SKILL.md` : triage scraper cassé (logs, retry, patch)
- `skills/arizorae-workflow-add/SKILL.md` : ajouter un nouveau workflow IA (migration, routing modèle, test)

### ADR (Architecture Decision Records)
`docs/adr/`:
- `0001-stack-choice.md` (Next + FastAPI + Celery)
- `0002-model-routing.md` (table opus/sonnet/haiku)
- `0003-prompt-caching-strategy.md`
- `0004-user-data-layout.md` (MD files + Postgres hybride)
- `0005-scraper-per-user.md`
- `0006-caddy-over-traefik.md`
- `0007-auth-nextauth-credentials.md`

### Glossaire
`docs/GLOSSARY.md` : RAE, FACTS, BULLET, preset, scoring, jobboard, ATS, STAR, offer lifecycle states.

## Fichiers critiques à créer/modifier

**À créer** (ordre d'implémentation) :

1. `infra/docker-compose.yml`
2. `infra/caddy/Caddyfile`
3. `infra/postgres/init.sql`
4. `portal/` (scaffold Next.js 14 + Prisma schema)
5. `portal/prisma/schema.prisma`
6. `portal/src/lib/{db,auth,agent-client,celery-client}.ts`
7. `portal/src/app/(public)/login|signup|reset/page.tsx`
8. `portal/src/app/api/auth/[...nextauth]/route.ts`
9. `portal/src/app/(auth)/onboarding/page.tsx` + stepper
10. `portal/src/components/rae-chat/RaeChat.tsx`
11. `agent-worker/app/main.py` + workflows (un fichier par workflow)
12. `agent-worker/app/sdk_client.py` (wrapper + caching + model routing)
13. `scraper-worker/app/celery_app.py` + `tasks.py`
14. `scraper-worker/templates/scraper.template.py` (base du scraper généré, inspiré de `scripts/job_scraper-example.py`)
15. `docs/ROADMAP.md` (itérations, milestones)
16. `docs/GLOSSARY.md`
17. `docs/adr/0001..0007-*.md`
18. `CLAUDE.md` racine + 4 CLAUDE.md module
19. `skills/arizorae-*/SKILL.md` × 3
20. `.env.example` (basé sur `.env` existant + `ANTHROPIC_API_KEY_ADMIN`, `POSTGRES_*`, `REDIS_URL`, `AGENT_WORKER_SECRET`, `GOTIFY_TOKEN`)

**À réutiliser** :
- `skills/rae-generic.skill` (le ZIP) → à dézipper dans `skills/rae-generic/` pour montage volume
- `docs/rae-generic-skill-extract/` contient déjà la version dézippée, utilisable directement
- `scripts/job_scraper-example.py` → base du template scraper
- Prototype HTML `docs/ui-design/.../RAE UI Prototype.html` → source des tokens CSS et composants
- `docs/ui-design/rae-assistant/project/uploads/rae-avatar.png` → avatar chatbot

## Roadmap en milestones (à écrire dans `docs/ROADMAP.md`)

**M1 — Infra & auth (1-2 jours)**
- docker-compose + Caddy + Postgres + Redis + portal scaffold
- NextAuth email/password + magic link + reset + email verification SMTP
- Landing + login/signup/reset fonctionnels

**M2 — Onboarding (2-3 jours)**
- Upload CV, form métier/pays
- agent-worker `/workflows/init` (opus) avec SSE
- Génération FACTS/BULLET/preset dans users_datas

**M3 — Scraper (2-3 jours)**
- Template scraper.py + génération par agent-worker (sonnet)
- scraper-worker Celery + exécution sandboxée
- Démo + feedback user + adaptation

**M4 — Dashboard offres & candidatures (2 jours)**
- Liste offres, filtres, actions (postuler/reject/entretien)
- Workflows `/analyse`, `/cv`, `/lettre`, `/entretien`
- Génération PDF (weasyprint)

**M5 — Chatbot (1-2 jours)**
- `<RaeChat>` UI (port du prototype)
- Endpoint `/chat` avec contexte page courante
- Persistance DB + MD

**M6 — Mails, stats, support, suppression (1-2 jours)**
- Celery Beat mail périodique
- Page stats + rapport candidatures
- Support → Gotify
- Suppression RGPD (users + users_datas)

**M7 — Doc & hardening (1 jour)**
- CLAUDE.md × 5, ADR × 7, skills × 3
- Tests e2e critiques (inscription → onboarding → scraper → candidature)
- Quota Anthropic + UI "ajouter clé"

## Vérification end-to-end

1. `docker compose up -d` dans `infra/`
2. Accès `https://arizorae.duckdns.org` → landing visible, TLS OK
3. Signup `test@…` → mail reçu → verify → redirect onboarding
4. Upload CV PDF + "développeur python" + "BE" → stepper progresse via SSE
5. Vérifier `infra/users_datas/<uid>/FACTS.md` non vide, `BULLET_LIBRARY.md` ≥ 10 bullets
6. Dashboard → Lancer scraper → ≥ 1 offre affichée avec score
7. Cliquer "Postuler" sur une offre → CV + lettre générés et téléchargeables
8. Ouvrir chatbot, demander "ajoute LinkedIn au scraper" → proposition diff → valider → `scraper.py` modifié
9. Settings → activer mail quotidien → forcer beat → mail reçu
10. Support → envoyer message → notif Gotify sur admin
11. Settings → supprimer compte → users row soft-deleted, users_datas/<uid> archivé

## Prochaines étapes (après approbation)

Dès sortie du plan mode, j'exécuterai l'ordre suivant **sans re-demander** :
1. Écrire `docs/ROADMAP.md` (version lisible de la section Roadmap ci-dessus)
2. Écrire `docs/GLOSSARY.md` et ADR 0001-0007
3. Écrire les 5 `CLAUDE.md` (racine + 4 modules)
4. Écrire les 3 `skills/arizorae-*/SKILL.md`
5. Compléter `.env.example`
6. Scaffold `portal/` (Next.js + Prisma schema)
7. Scaffold `agent-worker/` et `scraper-worker/`
8. Rédiger `infra/docker-compose.yml` et `infra/caddy/Caddyfile`
9. Implémenter M1 (infra + auth) de bout en bout
10. Itérer M2 → M7 conformément à la roadmap

Le code sera écrit par modules successifs, chaque module validé avant le suivant. Les CLAUDE.md et ADR seront mis à jour au fil de l'implémentation (pas après coup) pour que les sessions Claude futures restent économes en tokens.
