# ADR 0004 — Layout des données utilisateur (Postgres + fichiers MD)

Statut : accepté
Date : 2026-04-21

## Contexte

Le skill rae-generic est conçu pour lire/écrire des fichiers Markdown (`FACTS.md`, `BULLET_LIBRARY.md`, `preset.md`). Une migration 100% DB casserait la portabilité du skill et l'édition manuelle par le user. À l'inverse, 100% fichiers rendrait les queries stats/rapports pénibles.

## Décision

Hybride :

- **PostgreSQL** (source de vérité pour les requêtes structurées) :
  - Tables `users`, `sessions`, `tokens`, `job_offers`, `applications`, `ai_jobs`, `chat_messages`, `support_tickets`.
  - Stats, filtres, queries multi-users passent par SQL.

- **Fichiers** (source de vérité pour le contenu narratif) :
  - `infra/users_datas/<user_id>/` volume Docker partagé.
  - `cv_original.pdf` (upload portal), `cv_raw.txt` (extrait par init workflow), `onboarding.json` (config init : métier/pays), `FACTS.md`, `BULLET_LIBRARY.md`, `preset.md`, `scraper.py`, `scraper.log`, `chat_log.md`, `outputs/` (CV/lettre/entretien en Markdown).
  - Lus directement par agent-worker (pour contexte IA) et scraper-worker (pour exécution).
  - **Non implémenté** : `scraper_config.json` (filtres éliminatoires user — voir backlog ROADMAP.md). Les outputs sont des fichiers Markdown, pas des PDF (weasyprint non intégré — voir backlog ROADMAP.md).

- **Miroir DB pour chat_messages** : persistance DB pour UI rapide (pagination), fichier `chat_log.md` pour contexte IA efficace (append-only, cacheable).

## Règles

- `user_id` = UUID Postgres (`users.id`), jamais l'email ni le prénom.
- Les fichiers MD sont écrits atomiquement (`write_tmp + rename`).
- Suppression compte : soft-delete DB (`deleted_at`), move `users_datas/<uid>/` vers `users_datas/.trash/<uid>_<timestamp>/`, rétention 30 jours puis purge.
- Backup : dump Postgres quotidien via Celery Beat (`beat_tasks.backup_postgres`). Le tarball de `users_datas/` n'est pas automatisé — seule l'archive soft-delete (`.trash/`) est gérée.

## Alternatives considérées

- **Tout Postgres (MD en colonnes text)** : rejeté, casse l'édition manuelle et le skill.
- **Tout fichiers JSON/MD** : rejeté, queries stats complexes.

## Conséquences

- Deux sources à synchroniser pour chat_messages : discipline requise (insertion DB + append fichier dans la même transaction applicative).
- Backups = dump SQL + tarball `users_datas/`, documentés dans `docs/RUNBOOK.md`.
- Agent-worker et scraper-worker doivent avoir un montage volume `/users_datas` commun avec portal.
