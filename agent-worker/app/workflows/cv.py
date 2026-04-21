from __future__ import annotations
import json
from uuid import UUID

from .. import fs
from ._base import run_simple


async def run(user_id: UUID, offer: dict) -> str:
    prompt = (
        "Génère un CV Markdown adapté à cette offre, en t'appuyant sur le BULLET_LIBRARY "
        "et les FACTS du candidat. Sélectionne les expériences et bullets les plus pertinents. "
        "Structure : en-tête, résumé (3 lignes), expériences, compétences, formation.\n\n"
        f"Offre:\n{json.dumps(offer, ensure_ascii=False, indent=2)}"
    )
    result = await run_simple(
        user_id=user_id,
        workflow="cv",
        messages=[{"role": "user", "content": prompt}],
        input_payload={"offer_id": offer.get("id")},
        max_tokens=4096,
    )
    out_path = fs.user_dir(user_id) / "outputs" / f"cv_{offer.get('id', 'offer')}.md"
    fs.write_text(out_path, result.text)
    return str(out_path)
