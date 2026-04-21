"""
Periodic tasks scheduled by Celery Beat.
"""
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import structlog

from .celery_app import celery_app
from .config import settings
from . import db
from .tasks import send_offers_mail

log = structlog.get_logger()


@celery_app.task(name="app.beat_tasks.check_mail_digests")
def check_mail_digests() -> None:
    users = db.get_users_with_mail_due()
    log.info("beat_mail_check", users_due=len(users))
    for user in users:
        send_offers_mail.delay(str(user["id"]))


@celery_app.task(name="app.beat_tasks.backup_postgres")
def backup_postgres() -> dict:
    backup_dir = Path(settings.BACKUP_DIR)
    backup_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    dest = backup_dir / f"arizorae_{ts}.sql.gz"

    env = os.environ.copy()
    env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

    cmd = [
        "pg_dump",
        "-h", settings.POSTGRES_HOST,
        "-p", str(settings.POSTGRES_PORT),
        "-U", settings.POSTGRES_USER,
        settings.POSTGRES_DB,
    ]

    with dest.open("wb") as f:
        pg = subprocess.run(cmd, capture_output=False, stdout=subprocess.PIPE, env=env, check=True)
        import gzip
        f.write(gzip.compress(pg.stdout))

    log.info("backup_done", path=str(dest), size_kb=dest.stat().st_size // 1024)

    cutoff = datetime.utcnow() - timedelta(days=settings.BACKUP_RETENTION_DAYS)
    removed = 0
    for old in backup_dir.glob("arizorae_*.sql.gz"):
        try:
            mtime = datetime.utcfromtimestamp(old.stat().st_mtime)
            if mtime < cutoff:
                old.unlink()
                removed += 1
        except OSError:
            pass

    if removed:
        log.info("backup_pruned", removed=removed)

    return {"file": str(dest), "pruned": removed}
