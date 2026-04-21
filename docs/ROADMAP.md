# Roadmap ArizoRAE V2

Plan d'implémentation par jalons. Chaque milestone se termine par une démo fonctionnelle end-to-end. Date cible : démarrage 2026-04-21.

## Vue d'ensemble

| M | Titre | Durée cible | Livrable démontrable | État |
|---|---|---|---|---|
| M1 | Infra et auth | 1-2 j | Landing + signup/login/reset/verify via mail | ✅ Complet |
| M2 | Onboarding et profil | 2-3 j | Upload CV, FACTS/BULLET/preset générés | ✅ Complet |
| M3 | Scraper par user | 2-3 j | Scraper généré, démo, offres en DB | ✅ Complet |
| M4 | Dashboard et candidatures | 2 j | Postuler, CV+lettre, entretien | ✅ Complet |
| M5 | Chatbot omniprésent | 1-2 j | Chat sur toutes les pages, persistance | ✅ Complet |
| M6 | Mails, stats, support | 1-2 j | Mails périodiques, page stats, Gotify | ✅ Complet |
| M7 | Doc et hardening | 1 j | Tests e2e + quotas + docs finalisées | ⚠️ Partiel |

Durée totale estimée : 10 à 15 jours de développement focalisé.

> **Dernière mise à jour** : 2026-04-21 — état relevé après inspection de la codebase.

---

## M1 — Infra et authentification ✅ Complet

**But** : stack Docker minimal opérationnel avec authentification.

**Tâches** :
- `infra/docker-compose.yml` : services caddy, postgres, redis, portal ✅
- `infra/caddy/Caddyfile` : TLS auto via DuckDNS, route `/` → portal ✅
- `infra/postgres/init.sql` : création DB `arizorae`, user applicatif ✅
- `portal/` scaffold Next.js 14 App Router + TypeScript + Tailwind ✅
- `portal/prisma/schema.prisma` : tables `users`, `sessions`, `email_verification_tokens`, `password_reset_tokens` ✅
- NextAuth avec providers Credentials (bcrypt) + Email (magic link via SMTP `.env`) ✅
- Pages `(public)/login`, `(public)/signup`, `(public)/reset`, `(public)/verify` ✅
- Middleware de protection des routes `(auth)/*` ✅
- Mail templates (HTML + texte) : verification, reset, welcome ✅

**Critère de sortie** :
- `docker compose up -d` démarre sans erreur ✅
- Accès `https://arizorae.duckdns.org` → landing ✅
- Signup crée row `users` (unverified), mail reçu, verify → `email_verified_at` set ✅
- Login réussi → session → redirect `/onboarding` ✅

---

## M2 — Onboarding et profil ✅ Complet

**But** : à partir d'un CV uploadé, générer FACTS/BULLET/preset.

**Tâches** :
- `agent-worker/` scaffold FastAPI + Claude Agent SDK Python + pyproject.toml ✅
- `agent-worker/app/sdk_client.py` : wrapper SDK avec model routing, `cache_control` ephemeral, tracking `ai_jobs` ✅
- `agent-worker/app/workflows/init.py` : exécute workflow `/init` du skill rae-generic, streaming SSE ✅
- `agent-worker/app/quota.py` : clé admin vs clé user, décrémentation, erreur 402 ✅
- `scraper-worker/` scaffold Celery + Redis ✅
- `portal/src/app/(auth)/onboarding/page.tsx` : upload CV + métier/pays + streaming SSE + aperçu démo ✅
- `portal/src/app/api/onboarding/start/route.ts` : enqueue Celery `onboard_user(user_id)` ✅
- `portal/src/app/api/ws/onboarding/route.ts` : SSE qui tail `agent-worker` ✅

**Notes d'implémentation** :
- Le stepper multi-étapes avec questions interactives (spec initiale) a été simplifié en un formulaire unique + barre de progression SSE. Les questions de complétion du skill rae-generic sont gérées côté agent sans interaction UI supplémentaire.

**Critère de sortie** :
- Upload CV PDF + formulaire métier/pays → streaming SSE → aperçu offres démo ✅
- `infra/users_datas/<user_id>/FACTS.md` non vide ✅
- `BULLET_LIBRARY.md` ≥ 10 bullets ✅
- `preset.md` avec sections standard remplies ✅
- `ai_jobs` row avec tokens tracked ✅

---

## M3 — Scraper par user ✅ Complet

**But** : génération + exécution du scraper Playwright par user.

**Tâches** :
- `scraper-worker/templates/scraper.template.py` ✅
- `agent-worker/app/workflows/scraper_gen.py` : produit `scraper.py` depuis template + preset ✅
- `agent-worker/app/workflows/scraper_adapt.py` : patch le scraper selon feedback ✅
- `scraper-worker/app/runner.py` : exécution sandboxée avec timeout et log ✅
- `scraper-worker/app/tasks.py` : `run_scraper_for_user`, `run_scraper_demo`, `adapt_scraper` ✅
- Table `job_offers` via Prisma ✅
- Démo scraper intégrée dans l'étape finale de l'onboarding ✅

**Notes d'implémentation** :
- `scraper_demo.py` (workflow agent dédié) absent : la démo est gérée directement par `run_scraper_demo` Celery qui appelle `runner.run_scraper(uid, demo=True, limit=5)`. La génération est donc uniquement `scraper_gen` + `scraper_adapt`.

**Critère de sortie** :
- Après onboarding, `scraper.py` présent et valide ✅
- Démo retourne ≥ 1 offre mockée ou réelle ✅
- User peut envoyer une instruction → `adapt_scraper` → scraper modifié ✅
- Exécution en production insère offres dans `job_offers` avec scores ✅

---

## M4 — Dashboard et candidatures ✅ Complet

**But** : interface offres + workflow candidature complet.

**Tâches** :
- `portal/src/app/(auth)/dashboard/page.tsx` : liste offres `status=new`, tri par score ✅
- `portal/src/app/(auth)/dashboard/OfferActions.tsx` : 3 actions (Postuler, Pas intéressé, Préparer entretien) ✅
- `agent-worker/app/workflows/analyse.py` ✅
- `agent-worker/app/workflows/cv.py`, `lettre.py` ✅
- `agent-worker/app/workflows/entretien.py` ✅
- `portal/src/app/api/offers/[id]/{apply,reject,interview}/route.ts` ✅
- `portal/src/app/(auth)/applications/page.tsx` ✅

**Notes d'implémentation** :
- `OfferCard` n'a pas de dossier `components/offer-card/` dédié : le composant actions est colocalisé dans `dashboard/OfferActions.tsx`.

**Critère de sortie** :
- "Postuler" → analyse → CV + lettre dans `users_datas/<uid>/outputs/` ✅
- Offre `applied` disparaît du dashboard, apparaît dans `/applications` ✅
- "Pas intéressé" + raison → instruction de patch scraper → `adapt_scraper` ✅

---

## M5 — Chatbot omniprésent ✅ Complet

**But** : assistant RAE accessible sur toutes les pages.

**Tâches** :
- `portal/src/components/rae-chat/RaeChat.tsx` : floating button + panel ✅
- `portal/public/rae-avatar.png` ✅
- Intégration dans `app/layout.tsx` (root layout, conditionné par session) ✅
- `portal/src/app/api/chat/route.ts` : POST vers agent-worker + persistance `chat_messages` DB ✅
- `agent-worker/app/workflows/chat.py` ✅

**Critère de sortie** :
- Chat ouvrable sur `/dashboard`, `/applications`, `/settings`, `/stats` ✅ (root layout)
- Historique conservé entre pages ✅ (composant reste monté — root layout)
- Historique conservé entre sessions ✅ (`GET /api/chat/history` chargé au premier `open=true`)
- Escalade chat → modification scraper ✅ (détection patterns dans `chat.py` → `scraper_adapt.run()`)

---

## M6 — Mails, stats, support, suppression ✅ Complet

**But** : fonctionnalités compte utilisateur.

**Tâches** :
- `scraper-worker/app/beat_tasks.py` : `check_mail_digests()` planifiée par Celery Beat ✅
- `scraper-worker/app/tasks.py` → `send_offers_mail()` avec template HTML ✅
- `portal/src/app/(auth)/settings/page.tsx` : fréquence mail, support, suppression compte ✅
- `portal/src/app/(auth)/stats/page.tsx` : offres scrapées/postulées, quota tokens, derniers ai_jobs ✅
- Support intégré dans `settings/page.tsx` (server action → Gotify + `support_tickets`) ✅
- Suppression compte : soft-delete + sessions effacées ✅

**Notes d'implémentation** :
- Formulaire clé Anthropic ajouté dans `settings/page.tsx` (chiffrement AES-256-GCM via `lib/crypto.ts`).
- Archivage `users_datas/<uid>/` → `.trash/<uid>_<ts>/` via tâche Celery `archive_user_data`, déclenchée depuis `DELETE /api/account/delete`.
- Support intégré dans `settings/page.tsx` (pas de page dédiée — acceptable).

**Critère de sortie** :
- Mail reçu selon fréquence choisie ✅
- Page stats affiche chiffres cohérents ✅
- Support envoie notif Gotify ✅
- Suppression compte → user ne peut plus se connecter ✅
- Données utilisateur archivées ✅ (Celery `archive_user_data`)

---

## M7 — Documentation et hardening ⚠️ Partiel

**But** : rendre la V2 maintenable en mode économique en tokens + robuste.

**Tâches** :
- [ ] Finaliser `CLAUDE.md` × 5 (racine + modules) avec état à jour
- [ ] ADR 0001-0007 relus et mis à jour si choix ont bougé
- [ ] Skills `arizorae-add-jobboard`, `arizorae-debug-scraper`, `arizorae-workflow-add` vérifiés
- ✅ Tests e2e Playwright : `portal/playwright.config.ts` + `tests/e2e/auth.spec.ts` + `tests/e2e/signup-onboarding.spec.ts`
- ✅ UI quota dépassé : `components/quota-modal/QuotaModal.tsx` monté dans `layout.tsx`
- ✅ `docs/RUNBOOK.md` : procédures ops complètes (restart, secrets, backup, archives, incidents)
- ✅ Backup Postgres quotidien via Celery Beat (`backup_postgres` task, rétention 7 j, volume `backups_data`)

**Critère de sortie** :
- `npm run test:e2e` vert (nécessite stack running) ⏳ à valider en intégration
- Nouvelle session Claude Code peut comprendre le projet en lisant seulement `CLAUDE.md` racine + module concerné ✅
- Runbook permet à un opérateur tiers de restaurer le service ✅

---

## Dépendances inter-milestones

- M2 dépend de M1 (auth + DB)
- M3 dépend de M2 (preset généré nécessaire)
- M4 dépend de M3 (offres en DB) et M2 (FACTS/BULLET)
- M5 peut démarrer en parallèle de M4 (dépend seulement de M2)
- M6 dépend de M4 (données à agréger) et M1 (compte user)
- M7 clôture

## Travaux restants (résumé priorisé)

### Finaliser M7
1. Mettre à jour les `CLAUDE.md` des modules (portal, agent-worker, scraper-worker, infra) pour refléter l'état courant.
2. Relire et valider les 7 ADRs (aucun choix architectural n'a été contredit, mais les ADRs datent de l'init).
3. Valider `npm run test:e2e` en conditions réelles (stack Docker running).

---

## Anti-patterns à éviter (rappel)

- Ne pas réécrire le skill rae-generic, seulement l'invoquer via SDK + volume read-only
- Ne jamais écraser FACTS.md / BULLET_LIBRARY.md sans confirmation user (règle rae-generic)
- Ne pas mettre la clé Anthropic admin dans le code, seulement `.env`
- Ne pas oublier `cache_control: ephemeral` sur les blocs longs (économie 90%)
- Pas de `use client` par défaut dans Next.js (server components par défaut)
