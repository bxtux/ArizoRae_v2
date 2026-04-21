---
name: arizorae-add-jobboard
description: "Ajouter un jobboard au scraper d'un user ArizoRAE. Utilise ce skill quand un user demande d'intégrer un nouveau site d'offres (ex: remotive.io, WeLoveDevs) ou de scraper un jobboard spécifique non encore couvert par son scraper.py. Le skill gère : référence statique (references/job-sites/<pays>.md), modification du scraper.py du user, test démo, validation user."
---

# Ajouter un jobboard au scraper d'un user

## Pré-requis
- `user_id` connu
- URL + nom du jobboard à ajouter
- Pays cible

## Étapes

### 1. Vérifier la référence statique
Regarder dans `skills/rae-generic/references/job-sites/<pays>.md` si le jobboard y est listé.
- Oui → noter le pattern d'URL et les particularités listées.
- Non → ajouter une entrée dans le fichier pays (format : `- [Nom](URL) — spécialité, notes de scraping`) et commiter.

### 2. Analyser le jobboard
Ouvrir l'URL dans un navigateur (ou via `fetch` en ligne de commande) pour :
- Identifier le pattern de pagination.
- Identifier les sélecteurs CSS pour titre, société, lieu, lien détail, salaire.
- Vérifier si le site utilise JS-rendering (→ Playwright obligatoire) ou HTML statique.
- Noter la Content-Security-Policy et anti-bot (Cloudflare, reCAPTCHA → plan B).

### 3. Modifier le scraper user
Lire `infra/users_datas/<user_id>/scraper.py` et `scraper_config.json`. Ajouter :
- Une méthode `_fetch_<jobboard>()` sur la classe `Scraper` qui retourne `list[dict]` conforme au format standard (`{external_id, title, company, location, url, raw}`).
- L'appel à cette méthode dans `fetch()` agrégé.
- Mettre à jour `scraper_config.json` avec les filtres spécifiques si nécessaire.

Respecter le template `scraper-worker/templates/scraper.template.py` (ne pas casser la forme classe `Scraper`).

### 4. Démo
Exécuter via Celery : `run_scraper_demo(user_id)` avec limite 3.
Vérifier :
- Pas d'exception.
- Au moins 1 offre retournée par le nouveau jobboard.
- Format cohérent avec les autres sources.

### 5. Présenter au user
Afficher un diff du `scraper.py` et les 3 offres de démo. Attendre validation user avant de commiter.

### 6. Commit
Une fois validé, sauvegarder le `scraper.py` modifié dans `users_datas/<user_id>/scraper.py`.
Insérer un message dans `chat_log.md` : "Ajout du jobboard <Nom> validé."

## Garde-fous

- Ne jamais scraper un jobboard derrière un paywall ou en violation des ToS.
- Ne pas ajouter `requests.get` nu : toujours passer par le helper HTTP du scraper qui gère User-Agent, délais, retries.
- Si le site nécessite une authentification user : prévenir le user, ne pas hardcoder de credentials.

## Modèle à utiliser

Ce skill est invoqué par agent-worker avec model `claude-sonnet-4-6` (édition code). Voir `docs/adr/0002-model-routing.md`.
