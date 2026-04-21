from __future__ import annotations
import json
from uuid import UUID

from ._base import run_simple


async def run(user_id: UUID, offer: dict) -> dict:
    prompt = (
        "Analyse cette offre par rapport au profil du candidat. "
        "Réponds en JSON strict : "
        '{"fit_score": 0-100, "strengths": [..], "gaps": [..], "verdict": "..."}\n\n'
        f"Offre:\n{json.dumps(offer, ensure_ascii=False, indent=2)}"
    )
    result = await run_simple(
        user_id=user_id,
        workflow="analyse",
        messages=[{"role": "user", "content": prompt}],
        input_payload={"offer_id": offer.get("id")},
        max_tokens=2048,
        temperature=0.3,
    )
    try:
        parsed = json.loads(result.text)
    except json.JSONDecodeError:
        parsed = {"raw": result.text}
    return parsed
