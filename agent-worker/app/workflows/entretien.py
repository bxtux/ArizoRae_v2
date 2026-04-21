from __future__ import annotations
import json
from uuid import UUID

from .. import fs
from ._base import run_simple


async def run(user_id: UUID, offer: dict) -> str:
    prompt = (
        "Prépare une fiche d'entretien détaillée (Markdown) pour cette offre : "
        "points forts à mettre en avant, gaps à anticiper, 8-10 questions probables "
        "avec réponses STAR proposées, questions à poser au recruteur, recherches "
        "à faire sur l'entreprise.\n\n"
        f"Offre:\n{json.dumps(offer, ensure_ascii=False, indent=2)}"
    )
    result = await run_simple(
        user_id=user_id,
        workflow="entretien",
        messages=[{"role": "user", "content": prompt}],
        input_payload={"offer_id": offer.get("id")},
        max_tokens=6144,
    )
    out_path = fs.user_dir(user_id) / "outputs" / f"entretien_{offer.get('id', 'offer')}.md"
    fs.write_text(out_path, result.text)
    return str(out_path)
