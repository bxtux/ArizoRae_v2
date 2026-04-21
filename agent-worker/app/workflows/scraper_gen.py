from __future__ import annotations
from pathlib import Path
from uuid import UUID

from .. import fs
from ._base import run_simple

TEMPLATE_PATH = Path("/templates/scraper.template.py")


async def run(user_id: UUID, remarks: str = "") -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8") if TEMPLATE_PATH.exists() else ""
    prompt = (
        "Génère un `scraper.py` Python Playwright personnalisé pour ce candidat.\n"
        "Base-toi sur le template fourni ; ajuste jobboards, filtres, scoring selon "
        "FACTS/preset. Respecte l'interface CLI (--demo, --limit, --out). "
        "Sortie : un unique bloc de code Python complet, sans commentaire hors-code.\n\n"
        f"Remarques utilisateur : {remarks or '(aucune)'}\n\n"
        f"Template :\n```python\n{template}\n```"
    )
    result = await run_simple(
        user_id=user_id,
        workflow="scraper_gen",
        messages=[{"role": "user", "content": prompt}],
        input_payload={"remarks": remarks},
        max_tokens=8192,
        temperature=0.2,
    )
    code = _extract_code(result.text)
    out = fs.user_dir(user_id) / "scraper.py"
    fs.write_text(out, code)
    return str(out)


def _extract_code(text: str) -> str:
    if "```python" in text:
        start = text.index("```python") + len("```python")
        end = text.index("```", start)
        return text[start:end].strip() + "\n"
    if "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        return text[start:end].strip() + "\n"
    return text
