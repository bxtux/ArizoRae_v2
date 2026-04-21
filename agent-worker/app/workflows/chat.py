from __future__ import annotations
from uuid import UUID

from .. import fs
from ..sdk_client import WorkflowName
from ._base import run_simple
from . import scraper_adapt as scraper_adapt_wf

_SCRAPER_ADAPT_TRIGGERS = [
    "modifie le scraper",
    "modifier le scraper",
    "ajoute au scraper",
    "ajouter au scraper",
    "change le scraper",
    "enlève du scraper",
    "enlever du scraper",
    "supprime du scraper",
    "adapte le scraper",
    "adapter le scraper",
    "mets à jour le scraper",
    "met à jour le scraper",
    "update le scraper",
    "update scraper",
    "scraper linkedin",
    "scraper indeed",
    "ajoute linkedin",
    "ajoute indeed",
    "ajoute monster",
]


def _is_scraper_adapt_request(msg: str) -> bool:
    lower = msg.lower()
    return any(pat in lower for pat in _SCRAPER_ADAPT_TRIGGERS)


async def run(user_id: UUID, message: str, context_page: str | None = None, escalate: bool = False) -> str:
    if _is_scraper_adapt_request(message):
        try:
            await scraper_adapt_wf.run(user_id, diff_request=message)
            fs.append_chat_log(user_id, "user", message)
            reply = (
                "J'ai modifié votre scraper selon votre demande. "
                "Lancez le scraper depuis le dashboard pour vérifier le résultat."
            )
            fs.append_chat_log(user_id, "rae", reply)
            return reply
        except Exception:
            return (
                "Je n'ai pas pu modifier le scraper (fichier introuvable ou erreur de génération). "
                "Vérifiez que l'onboarding est bien terminé."
            )

    wf: WorkflowName = "chat_escalated" if escalate else "chat"
    preamble = f"Page courante : {context_page}\n\n" if context_page else ""
    messages = [{"role": "user", "content": preamble + message}]
    result = await run_simple(
        user_id=user_id,
        workflow=wf,
        messages=messages,
        input_payload={"message": message, "context_page": context_page},
        max_tokens=1024,
    )
    fs.append_chat_log(user_id, "user", message)
    fs.append_chat_log(user_id, "rae", result.text)
    return result.text
