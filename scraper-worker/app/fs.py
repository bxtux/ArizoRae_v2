from __future__ import annotations

import os
import shutil
from datetime import datetime
from pathlib import Path
from uuid import UUID

from .config import settings


def user_dir(user_id: UUID) -> Path:
    p = Path(settings.USERS_DATAS_DIR) / str(user_id)
    p.mkdir(parents=True, exist_ok=True)
    return p


def scraper_path(user_id: UUID) -> Path:
    return user_dir(user_id) / "scraper.py"


def scraper_log_path(user_id: UUID) -> Path:
    return user_dir(user_id) / "scraper.log"


def scraper_exists(user_id: UUID) -> bool:
    return scraper_path(user_id).exists()


def archive_user_dir(user_id: UUID) -> Path:
    src = Path(settings.USERS_DATAS_DIR) / str(user_id)
    if not src.exists():
        return src
    trash = Path(settings.USERS_DATAS_DIR) / ".trash"
    trash.mkdir(exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    dest = trash / f"{user_id}_{ts}"
    shutil.move(str(src), str(dest))
    return dest
