from __future__ import annotations
import base64
import hashlib
from datetime import datetime
from typing import Literal
from uuid import UUID

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException

from . import db
from .config import settings


class QuotaExceeded(HTTPException):
    def __init__(self) -> None:
        super().__init__(status_code=402, detail="quota exceeded, add your Anthropic key")


def _derived_key() -> bytes:
    """SHA-256 of AUTH_SECRET_KEY + ':anthropic-key' — matches portal/src/lib/crypto.ts derivedKey()."""
    return hashlib.sha256((settings.AUTH_SECRET_KEY + ":anthropic-key").encode("utf-8")).digest()


def decrypt_aes_gcm(token: str) -> str:
    """Decrypt AES-256-GCM value produced by portal crypto.ts.
    Format (base64): IV[12 bytes] + TAG[16 bytes] + CIPHERTEXT.
    """
    try:
        raw = base64.b64decode(token)
        iv = raw[:12]
        # Node.js crypto format: IV(12) + TAG(16) + CT — Python AESGCM expects CT + TAG
        tag = raw[12:28]
        ciphertext = raw[28:]
        key = _derived_key()
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
        return plaintext.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail="cannot decrypt user key") from e


async def pick_api_key(user_id: UUID) -> tuple[str, Literal["admin", "user"]]:
    user = await db.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    enc = user.get("anthropic_key_encrypted")
    if enc:
        return decrypt_aes_gcm(enc), "user"
    used = user.get("quota_used_tokens") or 0
    limit = user.get("quota_limit_tokens") or 0
    if used < limit:
        return settings.ANTHROPIC_API_KEY_ADMIN, "admin"
    raise QuotaExceeded()


async def pick_openai_key(user_id: UUID) -> tuple[str, Literal["admin", "user"]]:
    user = await db.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    enc = user.get("openai_key_encrypted")
    if enc:
        return decrypt_aes_gcm(enc), "user"
    econ_enc = user.get("economic_openai_session_encrypted")
    econ_exp = user.get("economic_openai_expires_at")
    if econ_enc and (econ_exp is None or econ_exp > datetime.utcnow()):
        return decrypt_aes_gcm(econ_enc), "user"
    if settings.OPENAI_API_KEY_ADMIN:
        return settings.OPENAI_API_KEY_ADMIN, "admin"
    raise HTTPException(status_code=400, detail="no OpenAI key configured")
