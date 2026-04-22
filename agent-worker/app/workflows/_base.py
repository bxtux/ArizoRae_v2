from __future__ import annotations
from typing import Any
from uuid import UUID

from fastapi import HTTPException

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
    """Standard pattern: pick key, create ai_job row, call, track, close.
    Routes to OpenAI or Anthropic based on user's ai_provider preference.
    """
    user = await db.get_user(user_id)
    if user is None:
        raise ValueError(f"user {user_id} not found")
    provider = user.get("ai_provider", "claude") or "claude"

    model = sdk_client.model_for(workflow, provider=provider)
    job_id = await db.start_ai_job(user_id, workflow=workflow, model=model, input_payload=input_payload)
    try:
        if provider == "openai":
            api_key, which = await quota.pick_openai_key(user_id)
            system_text = sdk_client.build_system_text(user_id)
            result = await sdk_client.call_openai(
                api_key=api_key,
                model=model,
                system_text=system_text,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        else:
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
        # Propagate OpenAI / Anthropic quota errors as 402 so the portal can display a clear message
        if "insufficient_quota" in str(e) or "429" in str(e) or "rate_limit" in str(type(e).__name__).lower():
            raise HTTPException(status_code=402, detail="quota exceeded") from e
        raise
