# Glossaire ArizoRAE

Termes métier, techniques et conventions utilisés dans le projet. À consulter avant d'écrire du code ou d'ouvrir une issue.

## Métier

**RAE** — Recherche Active d'Emploi. Désigne à la fois la démarche et le skill Claude `rae-generic`.

**Skill rae-generic** — Skill Claude (défini dans `skills/rae-generic/SKILL.md`) qui pilote les workflows `/init`, `/recherche`, `/analyse`, `/cv`, `/lettre`, `/entretien`, `/refresh-preset`. Agnostique au métier.

**FACTS.md** — Source de vérité unique sur le parcours du candidat : expériences, certifications, langues, dates. Jamais modifié sans confirmation user. Templates dans `skills/rae-generic/templates/FACTS.template.md`.

**BULLET_LIBRARY.md** — Bibliothèque de bullets prérédigés (FR + EN) par thème, ancrés dans FACTS.md. Utilisée par `/cv` et `/lettre` pour sélectionner plutôt que générer.

**preset.md** — Éclairage marché pour un métier + pays donnés, construit via recherche web à l'init. Contient thèmes de bullets, différenciateurs, jobboards, questions d'entretien, pièges, mots-clés ATS.

**ATS** — Applicant Tracking System. Filtres automatiques utilisés par les recruteurs, d'où l'importance des mots-clés dans le CV adapté.

**STAR** — Situation, Tâche, Action, Résultat. Méthode de réponse aux questions comportementales en entretien.

**Jobboard** — Plateforme de publication d'offres (LinkedIn, Indeed, Welcome to the Jungle, etc.). Listes par pays dans `skills/rae-generic/references/job-sites/`.

**Scoring** — Note sur 10 attribuée à une offre par le workflow `/analyse` (ou par le scraper en version simplifiée), basée sur le match avec FACTS/BULLET/preset.

**Points éliminatoires** — Critères user-définis qui excluent automatiquement une offre (ex : salaire < X, télétravail non, ville spécifique). Stockés dans `scraper_config.json`.

## États d'une offre (job_offer.status)

- `new` — scrapée, jamais vue par le user
- `applied` — user a postulé, CV + lettre générés, disparaît du dashboard principal
- `rejected` — user a marqué "pas intéressé", scraper adapté si raison fournie
- `not_interested` — alias historique, ne pas créer de nouvelle row avec ce status

## Technique

**Portal** — Service Next.js 14 App Router, frontend + BFF. Code dans `portal/`.

**Agent-worker** — Service FastAPI Python qui invoque le Claude Agent SDK. Tous les appels IA passent par lui. Code dans `agent-worker/`.

**Scraper-worker** — Service Celery worker qui exécute les scrapers Playwright par user. Code dans `scraper-worker/`.

**Beat** — Service Celery Beat pour tâches périodiques (mails digest). Même image que scraper-worker avec commande différente.

**users_datas** — Volume Docker partagé entre portal, agent-worker, scraper-worker, terminal. Un sous-dossier par user_id. **Jamais** versionné git (`.gitignore`).

**Skill volume** — `skills/rae-generic/` monté read-only dans agent-worker. Dézippé depuis `skills/rae-generic.skill` ou copié depuis `docs/rae-generic-skill-extract/`.

**Model routing** — Choix Opus/Sonnet/Haiku par workflow, défini dans `agent-worker/app/sdk_client.py`. Règle métier, pas de devinette. Voir `docs/adr/0002-model-routing.md`.

**Prompt caching (ephemeral)** — Attribut `cache_control: {type: "ephemeral"}` sur les blocs de contexte longs (skill SKILL.md, FACTS, BULLET). Cache 5 min côté Anthropic, ~90% d'économie sur tokens input répétés.

**Quota admin** — Tokens inclus gratuitement, payés par l'admin du service, trackés dans `users.quota_used_tokens` / `quota_limit_tokens`.

**Clé user** — Clé Anthropic ou OpenAI fournie par un user pour continuer au-delà du quota gratuit ou utiliser son propre compte. Stockée chiffrée (`anthropic_key_encrypted` / `openai_key_encrypted`) avec `AUTH_SECRET_KEY` comme clé de chiffrement (AES-256-GCM).

**Provider IA** — Fournisseur de modèle IA choisi par l'utilisateur : `"claude"` (défaut, Anthropic) ou `"openai"`. Stocké dans `users.ai_provider`. Configurable dans `/settings`. Voir `docs/adr/0008-multi-provider-openai.md`.

**ai_provider** — Champ `users.ai_provider` indiquant quel provider utiliser pour les workflows IA de ce user. Valeur `"claude"` ou `"openai"`. L'agent-worker lit ce champ dans `_base.run_simple()` pour router vers Anthropic ou OpenAI.

**Magic link** — Lien signé envoyé par mail qui authentifie sans mot de passe. Utilisé pour email verification et reset password.

**SSE (Server-Sent Events)** — Protocole unidirectionnel server → client utilisé pour streaming des workflows longs (`/init`, `/entretien`). Préféré à WebSocket pour simplicité.

**ai_jobs** — Table de tracking : un row par appel IA (workflow + model + tokens in/out + durée + erreur). Source unique pour debug coûts et bugs.

## Conventions de code

**Dossier par user** — `infra/users_datas/<user_id>/` où `user_id` est l'UUID Postgres de `users.id` (pas l'email).

**Noms de fichiers produits** — Neutres. Pour un CV adapté : `CV_<Nom>_<Prénom>.pdf`, pas `CV_adapte_Acme.pdf` (règle rae-generic, anti-dérive).

**Langue** — Tout contenu user-facing en français. Code, logs, commits en anglais. Prompts IA en français (le skill répond en français sauf si offre en anglais).

**Unités tokens** — Toujours stocker `tokens_in` et `tokens_out` séparément. Le prix diffère selon le modèle et selon cache hit/miss.

**Secrets** — `.env` à la racine du repo (non versionné), `.env.example` versionné. Toutes les variables documentées dans `.env.example`.

## Modèles utilisés

### Claude (provider = "claude", défaut)

- `claude-opus-4-7` — workflows complexes one-shot (`/init`, `/recherche`, `/entretien`)
- `claude-sonnet-4-6` — génération de code et documents (`/cv`, `/lettre`, `/analyse`, scraper gen/adapt)
- `claude-haiku-4-5` — tâches courtes (chat défaut, démo scraper, marquage postulé)

Voir `docs/adr/0002-model-routing.md` pour le détail et la justification.

### OpenAI (provider = "openai")

- `gpt-4o` — workflows complexes et génération de documents
- `gpt-4o-mini` — tâches courtes (chat défaut, démo scraper, marquage postulé)

Voir `docs/adr/0008-multi-provider-openai.md` pour le mapping complet et les trade-offs (pas de prompt caching).

## Hors scope V2 (glossaire à éviter)

- **Admin panel** : pas implémenté en V2
- **Multi-langue UI** : portal uniquement en français en V2
- **App mobile** : non prévue
- **Recruteur-side** : ArizoRAE est côté candidat exclusivement
