from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID
from typing import Any

from sqlalchemy import create_engine, text
from .config import settings


def _pg_url(url: str) -> str:
    # Celery tasks are sync; use psycopg2
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


_engine = create_engine(_pg_url(settings.DATABASE_URL), pool_pre_ping=True)


def get_user(user_id: UUID) -> dict[str, Any] | None:
    with _engine.begin() as conn:
        res = conn.execute(
            text(
                "SELECT id, email, first_name, mail_frequency_days, last_mail_at "
                "FROM users WHERE id = :uid AND deleted_at IS NULL"
            ),
            {"uid": str(user_id)},
        )
        row = res.mappings().first()
        return dict(row) if row else None


def get_users_with_mail_due() -> list[dict[str, Any]]:
    with _engine.begin() as conn:
        res = conn.execute(
            text(
                "SELECT id, email, first_name, mail_frequency_days, last_mail_at "
                "FROM users "
                "WHERE deleted_at IS NULL "
                "AND mail_frequency_days IS NOT NULL "
                "AND (last_mail_at IS NULL OR last_mail_at + (mail_frequency_days || ' days')::interval <= NOW())"
            )
        )
        return [dict(r) for r in res.mappings()]


def get_new_offers_since(user_id: UUID, since: datetime | None) -> list[dict[str, Any]]:
    with _engine.begin() as conn:
        if since:
            res = conn.execute(
                text(
                    "SELECT id, title, company, location, url, score, source, scraped_at "
                    "FROM job_offers WHERE user_id = :uid AND status = 'new' AND scraped_at > :since "
                    "ORDER BY score DESC LIMIT 50"
                ),
                {"uid": str(user_id), "since": since},
            )
        else:
            res = conn.execute(
                text(
                    "SELECT id, title, company, location, url, score, source, scraped_at "
                    "FROM job_offers WHERE user_id = :uid AND status = 'new' "
                    "ORDER BY score DESC LIMIT 50"
                ),
                {"uid": str(user_id)},
            )
        return [dict(r) for r in res.mappings()]


def upsert_offers(user_id: UUID, offers: list[dict]) -> int:
    inserted = 0
    with _engine.begin() as conn:
        for o in offers:
            res = conn.execute(
                text(
                    "INSERT INTO job_offers "
                    "(user_id, external_id, source, title, company, location, url, score, score_reasons, raw, status, scraped_at) "
                    "VALUES (:uid, :eid, :src, :title, :company, :loc, :url, :score, CAST(:reasons AS JSONB), CAST(:raw AS JSONB), 'new', NOW()) "
                    "ON CONFLICT (user_id, external_id, source) DO NOTHING"
                ),
                {
                    "uid": str(user_id),
                    "eid": o.get("external_id") or o.get("url", ""),
                    "src": o.get("source", "unknown"),
                    "title": o.get("title", ""),
                    "company": o.get("company", ""),
                    "loc": o.get("location", ""),
                    "url": o.get("url", ""),
                    "score": o.get("score", 0),
                    "reasons": json.dumps(o.get("score_reasons", [])),
                    "raw": json.dumps(o),
                },
            )
            inserted += res.rowcount
    return inserted


def update_last_mail_at(user_id: UUID) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET last_mail_at = NOW() WHERE id = :uid"),
            {"uid": str(user_id)},
        )
