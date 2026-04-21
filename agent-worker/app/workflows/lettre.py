from __future__ import annotations
import json
from uuid import UUID

from .. import fs
from ._base import run_simple


async def run(user_id: UUID, offer: dict) -> str:
    prompt = (
        "Rédige une lettre de motivation personnalisée (300-400 mots, Markdown) "
        "adaptée à cette offre et alignée avec les FACTS et le preset du candidat.\n\n"
        f"Offre:\n{json.dumps(offer, ensure_ascii=False, indent=2)}"
    )
    result = await run_simple(
        user_id=user_id,
        workflow="lettre",
        messages=[{"role": "user", "content": prompt}],
        input_payload={"offer_id": offer.get("id")},
        max_tokens=3072,
    )
    out_path = fs.user_dir(user_id) / "outputs" / f"lettre_{offer.get('id', 'offer')}.md"
    fs.write_text(out_path, result.text)
    return str(out_path)
