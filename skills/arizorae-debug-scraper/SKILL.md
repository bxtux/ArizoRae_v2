---
name: arizorae-debug-scraper
description: "Diagnostiquer et réparer le scraper d'un user ArizoRAE. Utilise ce skill quand l'exécution du scraper d'un user échoue (erreur Playwright, 0 offres retournées, timeout, site changé), quand le user signale des résultats anormaux, ou quand le scraper est bloqué par anti-bot."
---

# Debug scraper user ArizoRAE

## Entrée
- `user_id`
- Symptôme : timeout, 0 résultats, exception, résultats incorrects, blocage anti-bot.

## Procédure

### 1. Récupérer les logs
Lire `infra/users_datas/<user_id>/scraper.log` (dernière exécution).
Extraire :
- Exceptions Python (traceback).
- Warnings Playwright (timeout, selector not found).
- Codes HTTP anormaux (403, 429, 503).

Lire aussi la table `ai_jobs` pour les derniers appels de `scraper_gen` et `scraper_adapt` sur ce user (contexte changements récents).

### 2. Classifier

| Symptôme | Cause probable | Action |
|---|---|---|
| `TimeoutError` Playwright | Site lent, sélecteur changé | Augmenter timeout, vérifier sélecteur |
| `ElementHandleError: no element found` | Site a changé son DOM | Ré-inspecter, mettre à jour sélecteur |
| HTTP 403/429 | Rate-limit ou block anti-bot | Augmenter délais, rotating UA, skip ce site temporairement |
| HTTP 503 Cloudflare | Challenge JS | Playwright avec `waitForLoadState('networkidle')` + `stealth` |
| 0 offres retournées | Filtre éliminatoire trop strict, ou site vide | Vérifier `scraper_config.json`, baisser scoring minimum |
| Offres en double | Dédup cassé | Vérifier `external_id` unique dans `_fetch_*` |
| Offres hors critères | Score/filter bugé | Vérifier `score()` et `filter()` sur exemples |

### 3. Reproduire

Exécuter en mode démo :
```bash
docker compose exec scraper python -m app.runner --user-id <uid> --demo --limit 3
```

Lire stdout/stderr en direct.

### 4. Correction

- Si correction triviale (sélecteur, timeout, délai) : patch direct `scraper.py`.
- Si correction structurelle (nouveau site à ajouter, logique de scoring à revoir) : utiliser `skills/arizorae-add-jobboard/SKILL.md` ou relancer `scraper_adapt` via agent-worker.
- Si site définitivement mort : retirer du `scraper.py`, noter dans `references/job-sites/<pays>.md`.

### 5. Re-test

Relancer démo. Une fois vert, relancer production via `run_scraper_for_user(user_id)`.

### 6. Documenter

Si le bug vient d'un changement côté jobboard, noter dans un commentaire en tête du `_fetch_<jobboard>()` : `# <YYYY-MM-DD> : sélecteur X changé suite refonte site`.

Si le bug est système (affecte potentiellement tous les users), ouvrir une issue et considérer patch du `scraper.template.py`.

## Garde-fous

- Ne pas désactiver un site "par sécurité" sans comprendre la cause : le user se plaindra des offres manquantes.
- Ne pas modifier `scraper.template.py` pour fixer un scraper user précis : corriger le fichier user.
- Toujours exécuter la démo avant de commiter la correction.

## Modèle

Invoqué par agent-worker avec `claude-sonnet-4-6` (édition code, triage). Voir ADR 0002.
