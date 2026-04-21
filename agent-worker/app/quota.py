from __future__ import annotations
import base64
from typing import Literal
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from . import db
from .config import settings


class QuotaExceeded(HTTPException):
    def __init__(self) -> None:
        super().__init__(status_code=402, detail="quota exceeded, add your Anthropic key")


def _fernet() -> Fernet:
    raw = settings.AUTH_SECRET_KEY.encode("utf-8")
    key = base64.urlsafe_b64encode(raw.ljust(32, b"0")[:32])
    return Fernet(key)


def encrypt_user_key(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_user_key(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise HTTPException(status_code=500, detail="cannot decrypt user key") from e


async def pick_api_key(user_id: UUID) -> tuple[str, Literal["admin", "user"]]:
    user = await db.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    enc = user.get("anthropic_key_encrypted")
    if enc:
        return decrypt_user_key(enc), "user"
    used = user.get("quota_used_tokens") or 0
    limit = user.get("quota_limit_tokens") or 0
    if used < limit:
        return settings.ANTHROPIC_API_KEY_ADMIN, "admin"
    raise QuotaExceeded()
