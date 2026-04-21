from __future__ import annotations
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
) -> AsyncIterator[dict]:
    """Stream SSE events for the onboarding /init workflow."""
    yield {"type": "progress", "step": "reading_cv", "percent": 5}
    cv_text = await _extract_cv_text(Path(cv_path))
    fs.write_text(fs.user_dir(user_id) / "cv_raw.txt", cv_text)

    model = sdk_client.model_for("init")
    input_payload = {"metier": metier, "country": country, "cv_len": len(cv_text)}
    job_id = await db.start_ai_job(user_id, workflow="init", model=model, input_payload=input_payload)
    yield {"type": "progress", "step": "starting_model", "percent": 10, "model": model}

    try:
        api_key, which = await quota.pick_api_key(user_id)
        system = sdk_client.build_cached_system(user_id)
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
        async for evt in sdk_client.stream(
            api_key=api_key,
            model=model,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=8192,
        ):
            if evt["type"] == "delta":
                collected += evt["text"]
                yield {"type": "delta", "text": evt["text"]}
            elif evt["type"] == "done":
                usage = evt["usage"]

        yield {"type": "progress", "step": "writing_files", "percent": 90}
        _split_and_write(user_id, collected)

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
        yield {"type": "done", "percent": 100}
    except Exception as e:
        await db.finish_ai_job(job_id, status_="error", error=str(e))
        yield {"type": "error", "message": str(e)}
        raise


def _split_and_write(user_id: UUID, text: str) -> None:
    d = fs.user_dir(user_id)
    current_name: str | None = None
    buffer: list[str] = []
    for line in text.splitlines():
        if line.startswith("===FILE:") and line.rstrip().endswith("==="):
            if current_name and buffer:
                fs.write_text(d / current_name, "\n".join(buffer).strip() + "\n")
            current_name = line.split(":", 1)[1].strip().rstrip("=").strip()
            buffer = []
        else:
            buffer.append(line)
    if current_name and buffer:
        fs.write_text(d / current_name, "\n".join(buffer).strip() + "\n")
