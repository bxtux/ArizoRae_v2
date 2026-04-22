from __future__ import annotations
import shutil
from pathlib import Path
from typing import AsyncIterator
from uuid import UUID

from pypdf import PdfReader

from .. import db, fs, quota, sdk_client


async def _extract_cv_text(cv_path: Path) -> str:
    if cv_path.suffix.lower() == ".pdf":
        reader = PdfReader(str(cv_path))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    return cv_path.read_text(encoding="utf-8", errors="ignore")


async def run_stream(
    user_id: UUID,
    cv_path: str,
    metier: str,
    country: str,
    *,
    output_dir: str | None = None,
    provider_override: str | None = None,
    validate_required: bool = False,
    promote_on_success: bool = False,
    allow_replace: bool = False,
) -> AsyncIterator[dict]:
    """Stream SSE events for the onboarding /init workflow."""
    target_dir = Path(output_dir) if output_dir else fs.user_dir(user_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    yield {"type": "progress", "step": "auth_check", "percent": 2}
    yield {"type": "progress", "step": "workspace_prepare", "percent": 5}
    yield {"type": "progress", "step": "cv_extract", "percent": 10}
    cv_text = await _extract_cv_text(Path(cv_path))
    fs.write_text(target_dir / "cv_raw.txt", cv_text)

    user = await db.get_user(user_id)
    provider = provider_override or ((user.get("ai_provider") or "claude") if user else "claude")
    model = sdk_client.model_for("init", provider=provider)
    input_payload = {"metier": metier, "country": country, "cv_len": len(cv_text), "output_dir": str(target_dir)}
    job_id = await db.start_ai_job(user_id, workflow="init", model=model, input_payload=input_payload)
    yield {"type": "progress", "step": "facts_generate", "percent": 20, "model": model}

    try:
        prompt = (
            f"Tu démarres l'onboarding d'un candidat. Métier visé : {metier}. Pays : {country}.\n\n"
            "À partir du CV brut ci-dessous, produis trois artefacts Markdown séparés "
            "par des lignes `===FILE: <nom>===` :\n"
            "1. FACTS.md (faits vérifiables, datés, sourcés du CV)\n"
            "2. BULLET_LIBRARY.md (≥ 15 bullets STAR réutilisables)\n"
            "3. preset.md (préférences, exclusions, ton, style)\n\n"
            f"CV brut :\n---\n{cv_text}\n---"
        )
        usage = None
        collected = ""
        if provider == "openai":
            api_key, which = await quota.pick_openai_key(user_id)
            system_text = sdk_client.build_system_text(user_id)
            stream_gen = sdk_client.stream_openai(
                api_key=api_key, model=model, system_text=system_text,
                messages=[{"role": "user", "content": prompt}], max_tokens=8192,
            )
        else:
            api_key, which = await quota.pick_api_key(user_id)
            system = sdk_client.build_cached_system(user_id)
            stream_gen = sdk_client.stream(
                api_key=api_key, model=model, system=system,
                messages=[{"role": "user", "content": prompt}], max_tokens=8192,
            )
        async for evt in stream_gen:
            if evt["type"] == "delta":
                collected += evt["text"]
            elif evt["type"] == "done":
                usage = evt["usage"]

        yield {"type": "progress", "step": "bullets_generate", "percent": 55}
        yield {"type": "progress", "step": "preset_generate", "percent": 75}
        yield {"type": "progress", "step": "artifacts_validate", "percent": 90}
        _split_and_write(target_dir, collected)
        if validate_required:
            _validate_required_artifacts(target_dir)
        if promote_on_success:
            _promote_artifacts(user_id, target_dir, allow_replace=allow_replace)

        await db.finish_ai_job(
            job_id,
            status_="done",
            tokens_in=usage.input_tokens if usage else 0,
            tokens_out=usage.output_tokens if usage else 0,
            tokens_in_cached=usage.cache_read_input_tokens if usage else 0,
            tokens_in_uncached=usage.uncached_input if usage else 0,
            output_payload={"len": len(collected)},
        )
        if which == "admin" and usage:
            await db.increment_quota(user_id, usage.uncached_input + usage.output_tokens)
        yield {"type": "done", "step": "done", "percent": 100}
    except Exception as e:
        await db.finish_ai_job(job_id, status_="error", error=str(e))
        yield {"type": "error", "message": str(e)}
        raise


def _split_and_write(target_dir: Path, text: str) -> None:
    current_name: str | None = None
    buffer: list[str] = []
    for line in text.splitlines():
        if line.startswith("===FILE:") and line.rstrip().endswith("==="):
            if current_name and buffer:
                fs.write_text(target_dir / current_name, "\n".join(buffer).strip() + "\n")
            current_name = line.split(":", 1)[1].strip().rstrip("=").strip()
            buffer = []
        else:
            buffer.append(line)
    if current_name and buffer:
        fs.write_text(target_dir / current_name, "\n".join(buffer).strip() + "\n")


def _validate_required_artifacts(target_dir: Path) -> None:
    missing: list[str] = []
    for name in ("FACTS.md", "BULLET_LIBRARY.md"):
        if not fs.read_text(target_dir / name).strip():
            missing.append(name)
    if missing:
        raise ValueError(f"missing required artifacts: {', '.join(missing)}")


def _promote_artifacts(user_id: UUID, target_dir: Path, *, allow_replace: bool = False) -> None:
    dest_dir = fs.user_dir(user_id)
    existing = [name for name in ("FACTS.md", "BULLET_LIBRARY.md", "preset.md") if (dest_dir / name).exists()]
    if existing and not allow_replace:
        raise ValueError(f"profile already exists, confirmation required before replacing: {', '.join(existing)}")

    for name in ("FACTS.md", "BULLET_LIBRARY.md", "preset.md", "cv_raw.txt"):
        src = target_dir / name
        if src.exists():
            shutil.copy2(src, dest_dir / name)
