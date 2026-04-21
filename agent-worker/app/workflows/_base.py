from __future__ import annotations
from typing import Any
from uuid import UUID

from .. import db, quota, sdk_client


async def run_simple(
    *,
    user_id: UUID,
    workflow: sdk_client.WorkflowName,
    messages: list[dict[str, Any]],
    input_payload: dict | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> sdk_client.LLMResult:
    """Standard pattern: pick key, create ai_job row, call, track, close."""
    model = sdk_client.model_for(workflow)
    job_id = await db.start_ai_job(user_id, workflow=workflow, model=model, input_payload=input_payload)
    try:
        api_key, which = await quota.pick_api_key(user_id)
        system = sdk_client.build_cached_system(user_id)
        result = await sdk_client.call(
            api_key=api_key,
            model=model,
            system=system,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        await db.finish_ai_job(
            job_id,
            status_="done",
            tokens_in=result.usage.input_tokens,
            tokens_out=result.usage.output_tokens,
            tokens_in_cached=result.usage.cache_read_input_tokens,
            tokens_in_uncached=result.usage.uncached_input,
            output_payload={"text": result.text},
        )
        if which == "admin":
            await db.increment_quota(
                user_id,
                result.usage.uncached_input + result.usage.output_tokens,
            )
        return result
    except Exception as e:
        await db.finish_ai_job(job_id, status_="error", error=str(e))
        raise
