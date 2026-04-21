from __future__ import annotations

import os
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
