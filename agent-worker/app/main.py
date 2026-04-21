from __future__ import annotations
import json
from typing import Any
from uuid import UUID

import structlog
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from .auth import require_agent_secret
from .workflows import analyse, chat, cv, entretien, init as init_wf, lettre, scraper_adapt, scraper_gen

log = structlog.get_logger()
app = FastAPI(title="ArizoRAE agent-worker", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


class InitBody(BaseModel):
    user_id: UUID
    cv_path: str
    metier: str
    country: str


@app.post("/workflows/init", dependencies=[Depends(require_agent_secret)])
async def post_init(body: InitBody):
    async def gen():
        async for evt in init_wf.run_stream(body.user_id, body.cv_path, body.metier, body.country):
            yield {"event": evt.get("type", "message"), "data": json.dumps(evt)}
    return EventSourceResponse(gen())


class OfferBody(BaseModel):
    user_id: UUID
    offer: dict[str, Any]


@app.post("/workflows/analyse", dependencies=[Depends(require_agent_secret)])
async def post_analyse(body: OfferBody):
    return await analyse.run(body.user_id, body.offer)


@app.post("/workflows/cv", dependencies=[Depends(require_agent_secret)])
async def post_cv(body: OfferBody):
    return {"path": await cv.run(body.user_id, body.offer)}


@app.post("/workflows/lettre", dependencies=[Depends(require_agent_secret)])
async def post_lettre(body: OfferBody):
    return {"path": await lettre.run(body.user_id, body.offer)}


@app.post("/workflows/entretien", dependencies=[Depends(require_agent_secret)])
async def post_entretien(body: OfferBody):
    return {"path": await entretien.run(body.user_id, body.offer)}


class ScraperGenBody(BaseModel):
    user_id: UUID
    remarks: str = ""


@app.post("/scraper/generate", dependencies=[Depends(require_agent_secret)])
async def post_scraper_generate(body: ScraperGenBody):
    return {"path": await scraper_gen.run(body.user_id, body.remarks)}


class ScraperAdaptBody(BaseModel):
    user_id: UUID
    diff_request: str


@app.post("/scraper/adapt", dependencies=[Depends(require_agent_secret)])
async def post_scraper_adapt(body: ScraperAdaptBody):
    return {"path": await scraper_adapt.run(body.user_id, body.diff_request)}


class ChatBody(BaseModel):
    user_id: UUID
    message: str
    context_page: str | None = None
    escalate: bool = False


@app.post("/chat", dependencies=[Depends(require_agent_secret)])
async def post_chat(body: ChatBody):
    try:
        reply = await chat.run(body.user_id, body.message, body.context_page, body.escalate)
    except HTTPException:
        raise
    return {"reply": reply}
