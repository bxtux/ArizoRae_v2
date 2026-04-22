# Mode économique caché avec génération obligatoire de `FACTS.md` et `BULLET_LIBRARY.md`

## Summary
Ajouter un mode `economique` entièrement **sans terminal visible**. Le portail orchestre un runtime caché qui exécute `rae-generic` en arrière-plan avec une session OpenAI/ChatGPT gratuite fournie par l’utilisateur via une **connexion dédiée dans le portail**, jamais via une UI terminal.

Ce mode s’active soit explicitement, soit en fallback automatique quand le backend IA payant n’a plus de crédits. Dans tous les cas, le flux doit **toujours produire et conserver** `FACTS.md` et `BULLET_LIBRARY.md`, avec `preset.md` en complément, avant d’exposer le reste des fonctionnalités RAE.

## Implementation Changes
### Produit et UX
- Ajouter un `Mode économique` côté onboarding et comme fallback global sur erreurs quota `402`.
- Ne jamais exposer le mot `terminal` dans l’UX end-user.
- Introduire un écran `Connexion OpenAI` dans le portail:
  - connexion unique
  - statut visible `connecté / expiré / à reconnecter`
  - texte produit: “mode économique activé”, pas de mention technique terminal/container
- Ajouter un flux onboarding économique simplifié:
  - upload CV obligatoire
  - collecte métier/pays obligatoire
  - démarrage du traitement caché
  - progression métier orientée résultat: extraction CV, création des faits, création des bullets, génération du preset, vérification finale
- Après succès, montrer et rendre accessibles:
  - `FACTS.md`
  - `BULLET_LIBRARY.md`
  - `preset.md`
- Si `FACTS.md` ou `BULLET_LIBRARY.md` ne peuvent pas être produits, le flux est en échec, même si d’autres artefacts existent.

### Orchestration backend cachée
- Ajouter un orchestrateur dédié, par exemple `economic-worker`, ou étendre le service `terminal` avec une entrée non interactive pilotée par API interne.
- Le portail déclenche ce runtime caché via une route interne dédiée, sans ttyd, sans session shell exposée.
- Le runtime caché doit:
  - préparer un workspace isolé par user et par run
  - injecter le CV et les métadonnées métier/pays
  - rendre `rae-generic` disponible dans cet environnement
  - exécuter le workflow `/init`
  - récupérer les sorties finales
  - copier les artefacts validés dans `users_datas/<uid>/`
- Le runtime doit être traité comme exécution jetable, sans HOME persistant partagé entre users.

### Auth OpenAI gratuite
- Ajouter une intégration de connexion OpenAI/ChatGPT **dans le portail**, dédiée au mode économique.
- Le résultat de cette connexion doit être stocké comme session chiffrée réutilisable par le runtime caché, avec expiration détectable.
- Si la session gratuite est absente ou expirée:
  - bloquer le lancement du mode économique
  - afficher une demande de reconnexion portail
  - ne jamais basculer vers une UI terminal
- Le plan v1 suppose que cette session portail est suffisante pour authentifier le runtime caché; l’implémentation exacte du transport de session doit être isolée derrière un module d’auth dédié.

### Contrat de données
- Conserver le stockage existant sous `users_datas/<uid>/`.
- Ajouter un sous-répertoire runs, par exemple `users_datas/<uid>/economic_runs/<run_id>/`, pour:
  - `inputs/`
  - `logs/`
  - `outputs/`
  - `run.json`
- Copier vers le profil user final uniquement les fichiers validés:
  - `FACTS.md`
  - `BULLET_LIBRARY.md`
  - `preset.md`
  - `cv_raw.txt` si disponible
- Ne jamais écraser un profil existant sans confirmation explicite. En cas de ré-init, écrire d’abord dans un run isolé puis promouvoir les fichiers en fin de traitement.

### API et interfaces
- Ajouter `POST /api/economic/connect/openai` pour initier ou rafraîchir la connexion portail.
- Ajouter `GET /api/economic/session` pour exposer l’état de connexion.
- Ajouter `POST /api/economic/onboarding/start` pour créer un run caché.
- Ajouter `GET /api/economic/onboarding/events` en SSE pour suivre la progression.
- Standardiser les erreurs quota des routes existantes pour proposer `fallback_mode: "economic"`.
- Étendre les statuts d’onboarding avec des étapes explicites:
  - `auth_check`
  - `workspace_prepare`
  - `cv_extract`
  - `facts_generate`
  - `bullets_generate`
  - `preset_generate`
  - `artifacts_validate`
  - `done`

## Public Interfaces / Type Changes
- Nouveau statut de session économique côté user: `economic_openai_connected`, `economic_openai_expires_at`
- Nouvelles routes portail:
  - `POST /api/economic/connect/openai`
  - `GET /api/economic/session`
  - `POST /api/economic/onboarding/start`
  - `GET /api/economic/onboarding/events`
- Nouveau contrat SSE de progression avec statut d’échec explicite si `FACTS.md` ou `BULLET_LIBRARY.md` manquent
- Nouveau schéma de run interne `economic_runs/<run_id>/run.json`

## Test Plan
- Connexion:
  - session OpenAI économique créée, lue, expirée, reconnectée
  - accès refusé si session absente
- Onboarding économique:
  - CV + métier + pays produisent `FACTS.md`, `BULLET_LIBRARY.md`, `preset.md`
  - échec si `FACTS.md` absent
  - échec si `BULLET_LIBRARY.md` absent
  - promotion finale vers `users_datas/<uid>/` uniquement après validation complète
- UX:
  - quota dépassé dans le parcours standard propose bien le fallback économique
  - aucune page end-user ne mentionne terminal, shell, ttyd ou commandes
- Isolation:
  - deux runs parallèles de users différents n’échangent aucun fichier ni session
  - un re-run n’écrase pas silencieusement le profil précédent
- Régression:
  - onboarding standard backend reste inchangé
  - chat et workflows existants continuent à lire `FACTS.md` et `BULLET_LIBRARY.md` comme aujourd’hui

## Assumptions
- Le mode économique reste un **fallback** et un chemin alternatif d’onboarding, pas le remplacement complet du backend IA existant.
- `FACTS.md` et `BULLET_LIBRARY.md` sont des livrables obligatoires, pas des artefacts optionnels.
- Le runtime caché peut techniquement exécuter `rae-generic` sans UI terminal end-user, à condition qu’une session OpenAI/ChatGPT gratuite soit obtenue via le portail.
- La mise en place précise du mécanisme de connexion OpenAI portail est un sous-système dédié, mais le reste du flux ne dépend pas de son implémentation interne tant qu’il expose un statut de session réutilisable.
