# scraper-worker/ — Celery + Playwright

Exécute les scrapers Python générés par user, plus les tâches périodiques (mails digest). Un seul service qui tourne en deux modes : `worker` (consume queue) et `beat` (scheduler) — images identiques, commandes différentes.

## Structure

```
scraper-worker/
├── pyproject.toml
├── Dockerfile
├── templates/
│   └── scraper.template.py      # BASE des scrapers users
└── app/
    ├── celery_app.py            # config Celery (broker Redis)
    ├── config.py                # env vars
    ├── db.py                    # SQLAlchemy async
    ├── fs.py                    # helpers users_datas/
    ├── runner.py                # subprocess sandbox pour scraper.py user
    ├── tasks.py                 # tâches Celery (run_scraper, onboard_user, send_mail)
    └── beat_tasks.py            # periodic tasks (mails digest)
```

## Template scraper

`templates/scraper.template.py` : classe `Scraper` avec méthodes `fetch`, `parse`, `score`, `filter`, `run`. Source d'inspiration : `scripts/job_scraper-example.py` à la racine.

Toute génération via agent-worker doit produire un fichier conforme à ce template (importable, classe `Scraper` instanciable sans argument, méthode `run() → list[dict]`).

## Sandbox d'exécution

`runner.py` exécute `users_datas/<uid>/scraper.py` :

- Subprocess Python isolé (pas d'import dans le worker principal).
- Timeout : 300 secondes.
- Mémoire max : 512 MB (`resource.setrlimit` ou cgroups).
- FS : accès uniquement à `users_datas/<uid>/` (cwd + env `SCRAPER_DATA_DIR`).
- Network : allowlist via env (domaines jobboards connus + proxy si nécessaire).
- Stdout/stderr capturés, log dans `users_datas/<uid>/scraper.log`.

Après exécution, parse JSON output (liste d'offres) et insère dans `job_offers` avec dédup sur `(user_id, external_id, source)`.

## Tâches Celery clés

- `onboard_user(user_id)` : orchestration M2, appelle agent-worker en séquence (init → recherche → scraper_gen → demo).
- `run_scraper_for_user(user_id)` : exécution normale.
- `run_scraper_demo(user_id)` : `--demo --limit 5`, retourne résultat synchrone (via Celery result backend).
- `adapt_scraper(user_id, instruction)` : appelle agent-worker pour patcher `scraper.py`.
- `send_offers_mail(user_id)` : digest mail.

## Beat (scheduler)

`beat_tasks.py` : une seule tâche périodique en V2 :

```python
@celery_app.on_after_configure.connect
def setup_periodic(sender, **_):
    sender.add_periodic_task(3600.0, check_mail_digests.s(), name="check_mail_digests")

@celery_app.task
def check_mail_digests():
    # Pour chaque user avec mail_frequency_days défini et due:
    #   enqueue send_offers_mail(user_id)
```

## Règles

- Les tâches Celery **ne contiennent pas** de logique IA : elles délèguent à agent-worker via HTTP.
- Chaque task a un `@retry` Celery avec backoff exponentiel (max 3 tentatives) sauf `run_scraper_demo` (synchrone).
- Logs structurés en JSON (`structlog`) pour aggregation future.

## Sécurité du sandbox scraper

Minimum V2 :
- Subprocess dans user=`nobody` ou uid dédié sans accès `/var/run/docker.sock`.
- `--network=host` interdit : utiliser network bridge dédié avec egress restreint.
- Lint AST du `scraper.py` avant exécution : rejeter si le code utilise des primitives d'évasion shell ou socket brut en dehors du stack Playwright autorisé.

Voir `skills/arizorae-debug-scraper/SKILL.md` pour procédure de triage quand un scraper user échoue.

## Interdits

- Pas d'import `anthropic` dans ce service (passer par agent-worker).
- Pas d'écriture dans `skills/`.
- Pas de `shell=True` dans les appels subprocess (toujours liste d'args).
