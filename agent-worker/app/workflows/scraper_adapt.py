from __future__ import annotations
from uuid import UUID

from .. import fs
from ._base import run_simple
from .scraper_gen import _extract_code


async def run(user_id: UUID, diff_request: str) -> str:
    scraper_path = fs.user_dir(user_id) / "scraper.py"
    current = fs.read_text(scraper_path)
    prompt = (
        "Adapte le scraper.py ci-dessous selon la demande utilisateur. "
        "Retourne le fichier complet modifié dans un unique bloc ```python.\n\n"
        f"Demande : {diff_request}\n\n"
        f"scraper.py actuel :\n```python\n{current}\n```"
    )
    result = await run_simple(
        user_id=user_id,
        workflow="scraper_adapt",
        messages=[{"role": "user", "content": prompt}],
        input_payload={"diff_request": diff_request},
        max_tokens=8192,
        temperature=0.2,
    )
    new_code = _extract_code(result.text)
    fs.write_text(scraper_path, new_code)
    return str(scraper_path)
