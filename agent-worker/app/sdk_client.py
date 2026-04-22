from __future__ import annotations
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Literal
from uuid import UUID

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from . import fs, skill_loader

OPENAI_WORKFLOW_MODELS: dict[str, str] = {
    "init":           "gpt-4o",
    "recherche":      "gpt-4o",
    "scraper_gen":    "gpt-4o",
    "scraper_demo":   "gpt-4o-mini",
    "scraper_adapt":  "gpt-4o",
    "analyse":        "gpt-4o",
    "cv":             "gpt-4o",
    "lettre":         "gpt-4o",
    "entretien":      "gpt-4o",
    "mark_applied":   "gpt-4o-mini",
    "chat":           "gpt-4o-mini",
    "chat_escalated": "gpt-4o",
}

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


def model_for(workflow: WorkflowName, provider: str = "claude") -> str:
    if provider == "openai":
        return OPENAI_WORKFLOW_MODELS[workflow]
    return WORKFLOW_MODELS[workflow]


def build_system_text(user_id: UUID) -> str:
    """Plain-text system prompt for OpenAI (no cache_control blocks)."""
    parts = [skill_loader.skill_md() or "", fs.user_profile_blob(user_id) or ""]
    return "\n\n".join(p for p in parts if p)


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


async def call_openai(
    *,
    api_key: str,
    model: str,
    system_text: str,
    messages: list[dict[str, Any]],
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> LLMResult:
    """Call OpenAI — system injected as first role=system message."""
    client = AsyncOpenAI(api_key=api_key)
    oai_messages = [{"role": "system", "content": system_text}] + messages
    resp = await client.chat.completions.create(
        model=model,
        messages=oai_messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    text = resp.choices[0].message.content or ""
    u = resp.usage
    usage = Usage(
        input_tokens=u.prompt_tokens if u else 0,
        output_tokens=u.completion_tokens if u else 0,
        cache_read_input_tokens=0,
        cache_creation_input_tokens=0,
    )
    return LLMResult(text=text, usage=usage, raw=resp)


async def stream_openai(
    *,
    api_key: str,
    model: str,
    system_text: str,
    messages: list[dict[str, Any]],
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> AsyncGenerator[dict[str, Any], None]:
    """Async generator streaming OpenAI — same interface as stream()."""
    client = AsyncOpenAI(api_key=api_key)
    oai_messages = [{"role": "system", "content": system_text}] + messages
    full_text = ""
    resp = await client.chat.completions.create(
        model=model,
        messages=oai_messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=True,
    )
    async for chunk in resp:
        choices = chunk.choices
        if choices and choices[0].delta and choices[0].delta.content:
            content = choices[0].delta.content
            full_text += content
            yield {"type": "delta", "text": content}
    yield {
        "type": "done",
        "usage": Usage(input_tokens=0, output_tokens=0,
                       cache_read_input_tokens=0, cache_creation_input_tokens=0),
        "text": full_text,
    }
