from __future__ import annotations
import json
from uuid import UUID

from .. import fs, skill_loader
from ._base import run_simple


async def run(user_id: UUID, jobboards_override: list[str] | None = None) -> dict:
    """
    Sélectionne les jobboards pertinents et produit le preset de recherche initial.
    Retourne {"jobboards": [...], "keywords": [...], "min_score": int}
    """
    country_refs: list[str] = []
    for ref_path in skill_loader.list_references():
        if ref_path.startswith("job-sites/"):
            country_refs.append(skill_loader.reference(ref_path))

    refs_text = "\n\n".join(country_refs) if country_refs else "(aucune référence jobboard disponible)"

    preset = fs.read_text(fs.user_dir(user_id) / "preset.md")
    facts_excerpt = fs.read_text(fs.user_dir(user_id) / "FACTS.md")[:2000]

    prompt = (
        "À partir du profil candidat (FACTS + preset), sélectionne les jobboards les plus pertinents "
        "parmi ceux listés dans les références ci-dessous.\n"
        "Réponds en JSON strict :\n"
        '{"jobboards": [{"name":"...", "url":"...", "type":"..."}], '
        '"keywords_high": [...], "keywords_low": [...], "exclude": [...], "min_score": 1}\n\n'
        f"Références jobboards disponibles :\n{refs_text}\n\n"
        f"Extrait FACTS :\n{facts_excerpt}\n\n"
        f"preset.md :\n{preset}"
    )

    if jobboards_override:
        prompt += f"\n\nL'utilisateur a demandé explicitement ces jobboards : {json.dumps(jobboards_override)}"

    result = await run_simple(
        user_id=user_id,
        workflow="recherche",
        messages=[{"role": "user", "content": prompt}],
        input_payload={"jobboards_override": jobboards_override},
        max_tokens=4096,
        temperature=0.3,
    )

    try:
        data = json.loads(result.text)
    except json.JSONDecodeError:
        # Fallback: essaie d'extraire le JSON du texte
        import re
        m = re.search(r"\{.*\}", result.text, re.DOTALL)
        data = json.loads(m.group()) if m else {"jobboards": [], "keywords_high": [], "keywords_low": [], "exclude": [], "min_score": 1}

    # Persiste le résultat dans preset pour que scraper_gen puisse s'en servir
    recherche_path = fs.user_dir(user_id) / "recherche.json"
    fs.write_json(recherche_path, data)
    return data
