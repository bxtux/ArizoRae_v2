# Roadmap ArizoRAE V2

Plan d'implémentation par jalons. Chaque milestone se termine par une démo fonctionnelle end-to-end. Date cible : démarrage 2026-04-21.

## Vue d'ensemble

| M | Titre | Durée cible | Livrable démontrable |
|---|---|---|---|
| M1 | Infra et auth | 1-2 j | Landing + signup/login/reset/verify via mail |
| M2 | Onboarding et profil | 2-3 j | Upload CV, FACTS/BULLET/preset générés |
| M3 | Scraper par user | 2-3 j | Scraper généré, démo, offres en DB |
| M4 | Dashboard et candidatures | 2 j | Postuler, CV+lettre, entretien |
| M5 | Chatbot omniprésent | 1-2 j | Chat sur toutes les pages, persistance |
| M6 | Mails, stats, support | 1-2 j | Mails périodiques, page stats, Gotify |
| M7 | Doc et hardening | 1 j | Tests e2e + quotas + docs finalisées |

Durée totale estimée : 10 à 15 jours de développement focalisé.

## M1 — Infra et authentification

**But** : stack Docker minimal opérationnel avec authentification.

**Tâches** :
- `infra/docker-compose.yml` : services caddy, postgres, redis, portal
- `infra/caddy/Caddyfile` : TLS auto via DuckDNS, route `/` → portal
- `infra/postgres/init.sql` : création DB `arizorae`, user applicatif
- `portal/` scaffold Next.js 14 App Router + TypeScript + Tailwind
- `portal/prisma/schema.prisma` : tables `users`, `sessions`, `email_verification_tokens`, `password_reset_tokens`
- NextAuth avec providers Credentials (bcrypt) + Email (magic link via SMTP `.env`)
- Pages `(public)/login`, `(public)/signup`, `(public)/reset`, `(public)/verify`
- Middleware de protection des routes `(auth)/*`
- Mail templates (HTML + texte) : verification, reset, welcome

**Critère de sortie** :
- `docker compose up -d` démarre sans erreur
- Accès `https://arizorae.duckdns.org` → landing
- Signup crée row `users` (unverified), mail reçu, verify → `email_verified_at` set
- Login réussi → session → redirect `/onboarding`

## M2 — Onboarding et profil

**But** : à partir d'un CV uploadé, générer FACTS/BULLET/preset.

**Tâches** :
- `agent-worker/` scaffold FastAPI + Claude Agent SDK Python + pyproject.toml
- `agent-worker/app/sdk_client.py` : wrapper SDK avec model routing (voir `docs/adr/0002-model-routing.md`), `cache_control` ephemeral, tracking `ai_jobs`
- `agent-worker/app/workflows/init.py` : exécute workflow `/init` du skill rae-generic, pose questions de complétion via SSE
- `agent-worker/app/quota.py` : clé admin vs clé user, décrémentation, erreur 402
- Montage volume `skills/rae-generic/` (dézippé depuis `docs/rae-generic-skill-extract/`)
- `portal/src/app/(auth)/onboarding/page.tsx` : stepper (CV upload → métier/pays → questions → résumé)
- `portal/src/app/api/onboarding/start/route.ts` : enqueue Celery `onboard_user(user_id)`
- `portal/src/app/api/ws/onboarding/[user_id]/route.ts` : SSE qui tail `agent-worker`
- `scraper-worker/` scaffold Celery + Redis (le task `onboard_user` appelle agent-worker en HTTP)

**Critère de sortie** :
- Upload CV PDF + formulaire métier/pays → stepper avance
- `infra/users_datas/<user_id>/FACTS.md` non vide
- `BULLET_LIBRARY.md` ≥ 10 bullets
- `preset.md` avec sections standard remplies
- `ai_jobs` row avec tokens tracked

## M3 — Scraper par user

**But** : génération + exécution du scraper Playwright par user.

**Tâches** :
- `scraper-worker/templates/scraper.template.py` : base Playwright (voir `scripts/job_scraper-example.py`)
- `agent-worker/app/workflows/scraper_gen.py` (sonnet) : produit `users_datas/<user_id>/scraper.py` depuis template + preset + remarques user
- `agent-worker/app/workflows/scraper_demo.py` (haiku) : exécute `--demo --limit 5` et formate résultat
- `agent-worker/app/workflows/scraper_adapt.py` (sonnet) : patch le scraper selon feedback
- `scraper-worker/app/runner.py` : exécution sandboxée (subprocess avec timeout, FS restreint au dossier user)
- `scraper-worker/app/tasks.py` : `run_scraper_for_user(user_id)`, `run_scraper_demo(user_id)`
- Table `job_offers` via Prisma (migration M1 étendue)
- `portal/src/app/(auth)/onboarding/scraper-step.tsx` : démo + feedback → adaptation

**Critère de sortie** :
- Après onboarding, `scraper.py` présent et valide syntaxiquement
- Démo retourne ≥ 1 offre mockée ou réelle
- User peut dire "enlève les offres < 2000€/mois" → scraper modifié
- Exécution du scraper en production insère offres dans `job_offers` avec scores

## M4 — Dashboard et candidatures

**But** : interface offres + workflow candidature complet.

**Tâches** :
- `portal/src/app/(auth)/dashboard/page.tsx` : liste offres status=`new`, tri par score, filtres
- `portal/src/components/offer-card/OfferCard.tsx` : 3 actions (Postuler, Pas intéressé, Préparer entretien)
- `agent-worker/app/workflows/analyse.py` (sonnet)
- `agent-worker/app/workflows/cv.py`, `lettre.py` (sonnet) : génèrent MD + PDF via `weasyprint`
- `agent-worker/app/workflows/entretien.py` (opus) : fiche MD + PDF
- `portal/src/app/api/offers/[id]/{apply,reject,interview}/route.ts`
- `portal/src/app/(auth)/applications/page.tsx` : liste `status='applied'` + liens fichiers
- Modal "raison pas intéressé" → enqueue `scraper_adapt` (sonnet) si raison fournie

**Critère de sortie** :
- Cliquer "Postuler" sur une offre génère analyse → modal → CV + lettre téléchargeables dans `users_datas/<uid>/outputs/`
- Offre passe en `status='applied'`, disparaît du dashboard, apparaît dans `/applications`
- "Pas intéressé" + raison → proposition diff scraper → validation user → commit

## M5 — Chatbot omniprésent

**But** : assistant RAE accessible sur toutes les pages.

**Tâches** :
- `portal/src/components/rae-chat/RaeChat.tsx` : floating button + panel (port du prototype `docs/ui-design/...`)
- Context React pour état ouvert/fermé
- Avatar : `portal/public/rae-avatar.png` (copie depuis `docs/ui-design/rae-assistant/project/uploads/rae-avatar.png`)
- `portal/src/app/api/chat/route.ts` : streaming SSE vers agent-worker
- `agent-worker/app/workflows/chat.py` (haiku, escalade sonnet si action complexe détectée) : contexte = FACTS + preset + derniers 10 messages + nom page courante
- Persistance : insert `chat_messages` + append `users_datas/<uid>/chat_log.md`

**Critère de sortie** :
- Chat ouvrable sur `/dashboard`, `/applications`, `/settings`, `/stats`
- Historique conservé entre pages et sessions
- "ajoute LinkedIn au scraper" → chatbot escalade, propose diff, user valide, scraper modifié

## M6 — Mails, stats, support, suppression

**But** : fonctionnalités compte utilisateur.

**Tâches** :
- `scraper-worker/app/beat_tasks.py` : tâche périodique `send_offers_mail()` lue par Celery Beat
- Templates mail HTML + texte pour digest offres
- `portal/src/app/(auth)/settings/page.tsx` : mail frequency (off, 1, 3, 7 j), clé Anthropic user, supprimer compte
- `portal/src/app/(auth)/stats/page.tsx` : agrégats Prisma (offres scrapées, postulées, taux, top sources)
- `portal/src/app/(auth)/settings/support/page.tsx` : form → `POST /api/support` → Gotify
- `portal/src/app/api/support/route.ts` : insert `support_tickets` + POST Gotify
- `portal/src/app/api/account/delete/route.ts` : soft-delete user + archive `users_datas/<uid>` en `.trash/`

**Critère de sortie** :
- Mail reçu selon fréquence choisie
- Page stats affiche chiffres cohérents
- Support envoie notif Gotify (vérifiable côté admin)
- Suppression compte → user ne peut plus se connecter, données archivées

## M7 — Documentation et hardening

**But** : rendre la V2 maintenable en mode économique en tokens + robuste.

**Tâches** :
- Finaliser `CLAUDE.md` × 5 (racine + modules) avec état à jour
- ADR 0001-0007 relus et mis à jour si choix ont bougé
- `skills/arizorae-add-jobboard`, `arizorae-debug-scraper`, `arizorae-workflow-add` skills complétés
- Tests e2e Playwright : inscription → onboarding → scraper → candidature
- UI quota dépassé : modal "ajouter votre clé Anthropic"
- `docs/RUNBOOK.md` : procédures ops (restart, rotation secrets, backup Postgres, archives users_datas)
- Backup automatique Postgres quotidien + rétention 7 j

**Critère de sortie** :
- `npm run test:e2e` vert
- Nouvelle session Claude Code peut comprendre le projet en lisant seulement `CLAUDE.md` racine + module concerné
- Runbook permet à un opérateur tiers de restaurer le service

## Dépendances inter-milestones

- M2 dépend de M1 (auth + DB)
- M3 dépend de M2 (preset généré nécessaire)
- M4 dépend de M3 (offres en DB) et M2 (FACTS/BULLET)
- M5 peut démarrer en parallèle de M4 (dépend seulement de M2)
- M6 dépend de M4 (données à agréger) et M1 (compte user)
- M7 clôture

## Anti-patterns à éviter (rappel)

- Ne pas réécrire le skill rae-generic, seulement l'invoquer via SDK + volume read-only
- Ne jamais écraser FACTS.md / BULLET_LIBRARY.md sans confirmation user (règle rae-generic)
- Ne pas mettre la clé Anthropic admin dans le code, seulement `.env`
- Ne pas oublier `cache_control: ephemeral` sur les blocs longs (économie 90%)
- Pas de `use client` par défaut dans Next.js (server components par défaut)
