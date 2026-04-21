"""
Periodic tasks scheduled by Celery Beat.
"""
import structlog
from .celery_app import celery_app
from . import db
from .tasks import send_offers_mail

log = structlog.get_logger()


@celery_app.task(name="app.beat_tasks.check_mail_digests")
def check_mail_digests() -> None:
    users = db.get_users_with_mail_due()
    log.info("beat_mail_check", users_due=len(users))
    for user in users:
        send_offers_mail.delay(str(user["id"]))
