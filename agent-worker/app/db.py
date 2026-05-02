from __future__ import annotations
import json
from datetime import datetime
from uuid import UUID, uuid4
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from .config import settings


def _pg_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


_engine: AsyncEngine = create_async_engine(_pg_url(settings.DATABASE_URL), pool_pre_ping=True)


async def get_user(user_id: UUID) -> dict[str, Any] | None:
    async with _engine.begin() as conn:
        res = await conn.execute(
            text(
                "SELECT id, email, first_name, anthropic_key_encrypted, openai_key_encrypted, "
                "economic_openai_session_encrypted, economic_openai_expires_at, "
                "ai_provider, quota_used_tokens, quota_limit_tokens "
                "FROM users WHERE id = :uid"
            ),
            {"uid": str(user_id)},
        )
        row = res.mappings().first()
        return dict(row) if row else None


async def start_ai_job(user_id: UUID, workflow: str, model: str, input_payload: dict | None = None) -> UUID:
    job_id = uuid4()
    async with _engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO ai_jobs (id, user_id, workflow, model, status, input, started_at) "
                "VALUES (:id, :uid, :wf, :m, 'running', CAST(:inp AS JSONB), NOW())"
            ),
            {"id": str(job_id), "uid": str(user_id), "wf": workflow, "m": model, "inp": json.dumps(input_payload or {})},
        )
    return job_id


async def finish_ai_job(
    job_id: UUID,
    status_: Literal["done", "error"],
    tokens_in: int = 0,
    tokens_out: int = 0,
    tokens_in_cached: int = 0,
    tokens_in_uncached: int = 0,
    output_payload: dict | None = None,
    error: str | None = None,
) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE ai_jobs SET status = :s, tokens_in = :ti, tokens_out = :to, "
                "tokens_in_cached = :tic, tokens_in_uncached = :tiu, "
                "output = CAST(:out AS JSONB), error = :err, finished_at = NOW() WHERE id = :id"
            ),
            {
                "s": status_,
                "ti": tokens_in,
                "to": tokens_out,
                "tic": tokens_in_cached,
                "tiu": tokens_in_uncached,
                "out": json.dumps(output_payload) if output_payload else None,
                "err": error,
                "id": str(job_id),
            },
        )


async def increment_quota(user_id: UUID, tokens: int) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET quota_used_tokens = quota_used_tokens + :t WHERE id = :uid"),
            {"t": tokens, "uid": str(user_id)},
        )
