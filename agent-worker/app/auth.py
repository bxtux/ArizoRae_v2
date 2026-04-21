from fastapi import Header, HTTPException, status
from .config import settings


async def require_agent_secret(x_agent_secret: str = Header(default="")):
    if x_agent_secret != settings.AGENT_WORKER_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="bad secret")
    return True
