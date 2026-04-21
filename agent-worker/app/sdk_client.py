from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from anthropic import AsyncAnthropic

from . import fs, skill_loader

WORKFLOW_MODELS: dict[str, str] = {
    "init":           "claude-opus-4-7",
    "recherche":      "claude-opus-4-7",
    "scraper_gen":    "claude-sonnet-4-6",
    "scraper_demo":   "claude-haiku-4-5",
    "scraper_adapt":  "claude-sonnet-4-6",
    "analyse":        "claude-sonnet-4-6",
    "cv":             "claude-sonnet-4-6",
    "lettre":         "claude-sonnet-4-6",
    "entretien":      "claude-opus-4-7",
    "mark_applied":   "claude-haiku-4-5",
    "chat":           "claude-haiku-4-5",
    "chat_escalated": "claude-sonnet-4-6",
}

WorkflowName = Literal[
    "init", "recherche", "scraper_gen", "scraper_demo", "scraper_adapt",
    "analyse", "cv", "lettre", "entretien", "mark_applied", "chat", "chat_escalated",
]


def model_for(workflow: WorkflowName) -> str:
    return WORKFLOW_MODELS[workflow]


def build_cached_system(user_id: UUID) -> list[dict[str, Any]]:
    """Two ephemeral-cached system blocks: skill SKILL.md + user profile."""
    blocks: list[dict[str, Any]] = []
    skill_text = skill_loader.skill_md()
    if skill_text:
        blocks.append({
            "type": "text",
            "text": skill_text,
            "cache_control": {"type": "ephemeral"},
        })
    profile = fs.user_profile_blob(user_id)
    if profile:
        blocks.append({
            "type": "text",
            "text": profile,
            "cache_control": {"type": "ephemeral"},
        })
    return blocks


@dataclass
class Usage:
    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: int
    cache_creation_input_tokens: int

    @property
    def uncached_input(self) -> int:
        return max(self.input_tokens - self.cache_read_input_tokens, 0)


@dataclass
class LLMResult:
    text: str
    usage: Usage
    raw: Any


async def call(
    *,
    api_key: str,
    model: str,
    system: list[dict[str, Any]],
    messages: list[dict[str, Any]],
    max_tokens: int = 4096,
    temperature: float = 0.7,
    tools: list[dict[str, Any]] | None = None,
) -> LLMResult:
    client = AsyncAnthropic(api_key=api_key)
    kwargs: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools
    resp = await client.messages.create(**kwargs)
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    u = resp.usage
    usage = Usage(
        input_tokens=getattr(u, "input_tokens", 0) or 0,
        output_tokens=getattr(u, "output_tokens", 0) or 0,
        cache_read_input_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
        cache_creation_input_tokens=getattr(u, "cache_creation_input_tokens", 0) or 0,
    )
    return LLMResult(text=text, usage=usage, raw=resp)


async def stream(
    *,
    api_key: str,
    model: str,
    system: list[dict[str, Any]],
    messages: list[dict[str, Any]],
    max_tokens: int = 4096,
    temperature: float = 0.7,
):
    """Async generator yielding text deltas; returns final Usage via .usage attribute on last sentinel."""
    client = AsyncAnthropic(api_key=api_key)
    async with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=messages,
    ) as s:
        async for delta in s.text_stream:
            yield {"type": "delta", "text": delta}
        final = await s.get_final_message()
        u = final.usage
        yield {
            "type": "done",
            "usage": Usage(
                input_tokens=getattr(u, "input_tokens", 0) or 0,
                output_tokens=getattr(u, "output_tokens", 0) or 0,
                cache_read_input_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
                cache_creation_input_tokens=getattr(u, "cache_creation_input_tokens", 0) or 0,
            ),
            "text": "".join(b.text for b in final.content if getattr(b, "type", None) == "text"),
        }
