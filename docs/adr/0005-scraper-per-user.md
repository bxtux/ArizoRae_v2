# ADR 0005 — Un scraper Python par user (vs multi-tenant unique)

Statut : accepté
Date : 2026-04-21

## Contexte

Chaque user a un métier, des pays cibles, des jobboards pertinents et des critères éliminatoires différents. Le skill rae-generic produit un preset qui guide la sélection des jobboards. Deux approches possibles : un scraper unique paramétré ou un scraper généré par user.

## Décision

**Un fichier `scraper.py` généré par user**, stocké dans `users_datas/<user_id>/scraper.py`.

- Généré initialement par `agent-worker` workflow `scraper_gen` (sonnet) à partir du template `scraper-worker/templates/scraper.template.py` et du `preset.md` user.
- Adapté au fil du temps par `scraper_adapt` (sonnet) selon feedback user (raisons "pas intéressé", remarques chatbot).
- Exécuté par `scraper-worker` via subprocess sandboxé (timeout, FS limité, pas de network sauf allowlist domaines jobboards).

## Pourquoi pas un scraper multi-tenant

- Expressivité : un user BE/IT senior et un user FR/marketing junior n'interrogent pas les mêmes sites avec les mêmes filtres ni scoring.
- Adaptation : le skill a une capacité naturelle à éditer du code Python ; lui donner un fichier dédié est direct.
- Isolation des régressions : modifier un scraper user ne casse pas les autres.

## Pourquoi pas un container par user

- Coût RAM/CPU avec plusieurs centaines d'users.
- Démarrage lent.
- Gestion opérationnelle lourde (orchestration, monitoring par container).

## Règles

- Template source de vérité : `scraper-worker/templates/scraper.template.py`. Contient la structure (classe `Scraper`, méthodes `fetch`, `parse`, `score`, `filter`, `run`).
- Le fichier généré doit implémenter la classe `Scraper` avec ces méthodes.
- Tous les outputs passent par `score(offer) → float` pour uniformité.
- Critères éliminatoires dans `scraper_config.json` (lu par le scraper, pas hardcodé).

## Conséquences

- Tests : un test d'intégration valide qu'un `scraper.py` fraîchement généré s'exécute sans erreur sur un fake server mock Playwright.
- Sécurité : sandbox subprocess (`nsjail` ou `firejail` si possible, sinon user/cgroup restrictions) + timeout 5 min + mémoire max 512 Mo.
- Maintenance : le skill `skills/arizorae-debug-scraper/SKILL.md` encapsule la procédure de debug scraper user.
