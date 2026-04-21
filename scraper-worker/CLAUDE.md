# scraper-worker/ — Celery + Playwright

Exécute les scrapers Python générés par user, les tâches périodiques (mails digest, backup Postgres) et les tâches one-shot (onboarding, archivage compte). Un seul Dockerfile, deux modes : `worker` (consomme les queues) et `beat` (scheduler).

## Structure

```
scraper-worker/
├── pyproject.toml
├── Dockerfile               # python:3.12-slim + postgresql-client + playwright chromium
├── templates/
│   └── scraper.template.py  # base des scrapers user (classe Scraper, méthode run() → list[dict])
└── app/
    ├── celery_app.py        # config Celery — broker, backend, routes de queues, beat_schedule
    ├── config.py            # env vars (pydantic-settings) — chemins, SMTP, backup, Postgres
    ├── db.py                # SQLAlchemy sync — upsert_offers, get_user, get_new_offers_since, etc.
    ├── fs.py                # helpers users_datas/<uid>/ + archive_user_dir() → .trash/
    ├── runner.py            # subprocess sandbox : exécute scraper.py user, timeout 300s
    ├── tasks.py             # tâches Celery : run_scraper_for_user, run_scraper_demo,
    │                        #   onboard_user, adapt_scraper, archive_user_data, send_offers_mail
    └── beat_tasks.py        # tâches périodiques : check_mail_digests (1h), backup_postgres (24h)
```

## Template scraper

`templates/scraper.template.py` : classe `Scraper` instanciable sans argument, méthode `run() → list[dict]`. Chaque dict représente une offre avec les champs : `external_id`, `source`, `title`, `company`, `location`, `url`, `score`, `raw`.

Toute génération par agent-worker doit produire un fichier conforme (importable, syntaxiquement valide).

## Sandbox d'exécution

`runner.py` exécute `users_datas/<uid>/scraper.py` via subprocess :

- Timeout : 300 secondes (`SCRAPER_TIMEOUT_SECONDS`).
- Mémoire max : 512 MB (`SCRAPER_MEMORY_MB`).
- CWD et `SCRAPER_DATA_DIR` pointent vers `users_datas/<uid>/`.
- Stdout/stderr capturés → `users_datas/<uid>/scraper.log`.
- Sortie JSON parsée, insérée en DB via `db.upsert_offers()` avec dédup sur `(user_id, external_id, source)`.

## Tâches Celery

| Tâche | Queue | Description |
|---|---|---|
| `run_scraper_for_user(user_id)` | scrapers | Exécution normale, retry x3 |
| `run_scraper_demo(user_id)` | scrapers | `demo=True, limit=5`, pas de retry |
| `onboard_user(user_id)` | default | Orchestration M2 : init → recherche → scraper_gen via HTTP agent-worker |
| `adapt_scraper(user_id, instruction)` | default | Appelle agent-worker `/scraper/adapt`, retry x3 |
| `archive_user_data(user_id)` | default | Déplace `users_datas/<uid>/` → `users_datas/.trash/<uid>_<ts>/`, retry x3 |
| `send_offers_mail(user_id)` | default | Digest offres nouvelles par SMTP, retry x3 |

## Beat (tâches périodiques)

`beat_tasks.py` — deux tâches schedulées dans `celery_app.py` :

```python
beat_schedule = {
    "check-mail-digests-hourly": {
        "task": "app.beat_tasks.check_mail_digests",
        "schedule": 3600.0,   # toutes les heures
    },
    "backup-postgres-daily": {
        "task": "app.beat_tasks.backup_postgres",
        "schedule": 86400.0,  # toutes les 24h
    },
}
```

`backup_postgres` : appelle `pg_dump` (binaire présent via `postgresql-client` dans le Dockerfile), compresse en gzip, stocke dans `/backups/arizorae_<ts>.sql.gz`. Purge les fichiers > `BACKUP_RETENTION_DAYS` jours (défaut : 7).

## Archivage données utilisateur

`fs.archive_user_dir(user_id)` déplace `users_datas/<uid>/` vers `users_datas/.trash/<uid>_<ts>/` via `shutil.move`. Déclenché par la tâche `archive_user_data`, elle-même enqueuée par `DELETE /api/account/delete` dans le portal.

## Variables d'environnement spécifiques

```
USERS_DATAS_DIR=/users_datas        # bind mount partagé
BACKUP_DIR=/backups                  # volume Docker backups_data
BACKUP_RETENTION_DAYS=7
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=arizorae
POSTGRES_PASSWORD=...
POSTGRES_DB=arizorae
```

## Règles

- Les tâches Celery **ne contiennent pas** de logique IA — elles délèguent à agent-worker via HTTP (`httpx`).
- Chaque task a `@retry` avec `max_retries=3, default_retry_delay=60` sauf `run_scraper_demo` (synchrone).
- Logs structurés en JSON via `structlog`.
- Jamais de `shell=True` dans les subprocess (toujours liste d'args).

## Interdits

- Pas d'import `anthropic` dans ce service — tout passe par agent-worker.
- Pas d'écriture dans `skills/`.
- Pas de `shell=True` dans subprocess.
