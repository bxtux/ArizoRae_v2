from __future__ import annotations
from uuid import UUID

from .. import fs
from ..sdk_client import WorkflowName
from ._base import run_simple


async def run(user_id: UUID, message: str, context_page: str | None = None, escalate: bool = False) -> str:
    wf: WorkflowName = "chat_escalated" if escalate else "chat"
    preamble = f"Page courante : {context_page}\n\n" if context_page else ""
    messages = [{"role": "user", "content": preamble + message}]
    result = await run_simple(
        user_id=user_id,
        workflow=wf,
        messages=messages,
        input_payload={"message": message, "context_page": context_page},
        max_tokens=1024,
    )
    fs.append_chat_log(user_id, "user", message)
    fs.append_chat_log(user_id, "rae", result.text)
    return result.text
