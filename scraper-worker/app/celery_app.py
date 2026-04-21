from celery import Celery
from .config import settings

celery_app = Celery(
    "arizorae_scraper",
    broker=settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks", "app.beat_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Brussels",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.run_scraper_for_user": {"queue": "scrapers"},
        "app.tasks.run_scraper_demo": {"queue": "scrapers"},
        "app.tasks.onboard_user": {"queue": "default"},
        "app.tasks.adapt_scraper": {"queue": "default"},
        "app.tasks.archive_user_data": {"queue": "default"},
        "app.tasks.send_offers_mail": {"queue": "default"},
        "app.beat_tasks.check_mail_digests": {"queue": "default"},
        "app.beat_tasks.backup_postgres": {"queue": "default"},
    },
    beat_schedule={
        "check-mail-digests-hourly": {
            "task": "app.beat_tasks.check_mail_digests",
            "schedule": 3600.0,
        },
        "backup-postgres-daily": {
            "task": "app.beat_tasks.backup_postgres",
            "schedule": 86400.0,  # every 24h
        },
    },
)
