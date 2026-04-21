"""
Celery tasks — no AI logic here, delegate to agent-worker via HTTP.
"""
from __future__ import annotations

import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import UUID

import httpx
import structlog
from celery import shared_task
from celery.utils.log import get_task_logger

from .celery_app import celery_app
from .config import settings
from . import db, fs, runner

log = structlog.get_logger()
task_log = get_task_logger(__name__)


def _agent_headers() -> dict:
    return {"X-Agent-Secret": settings.AGENT_WORKER_SECRET}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.run_scraper_for_user")
def run_scraper_for_user(self, user_id: str) -> dict:
    uid = UUID(user_id)
    try:
        offers = runner.run_scraper(uid)
        inserted = db.upsert_offers(uid, offers)
        log.info("scraper_done", user_id=user_id, total=len(offers), inserted=inserted)
        return {"total": len(offers), "inserted": inserted}
    except runner.ScraperError as exc:
        log.error("scraper_error", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=0, name="app.tasks.run_scraper_demo")
def run_scraper_demo(self, user_id: str) -> list[dict]:
    uid = UUID(user_id)
    offers = runner.run_scraper(uid, demo=True, limit=5)
    return offers


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120, name="app.tasks.onboard_user")
def onboard_user(self, user_id: str) -> dict:
    """
    Orchestration M2: calls agent-worker sequentially.
    Steps: init → recherche → scraper_gen → demo.
    The portal monitors progress via ai_jobs table or SSE.
    """
    uid = user_id
    base = settings.AGENT_WORKER_URL
    headers = _agent_headers()

    import json as _json
    import os as _os

    onboarding_cfg_path = _os.path.join(settings.USERS_DATAS_DIR, uid, "onboarding.json")
    try:
        with open(onboarding_cfg_path) as f:
            cfg = _json.load(f)
    except FileNotFoundError:
        cfg = {"user_id": uid, "cv_path": _os.path.join(settings.USERS_DATAS_DIR, uid, "cv_original.pdf"), "metier": "", "country": ""}

    try:
        with httpx.Client(timeout=600) as client:
            # init (opus) — SSE endpoint; Celery task consumes it as a streaming response
            with client.stream("POST", f"{base}/workflows/init", headers=headers, json=cfg) as r:
                r.raise_for_status()
                for _ in r.iter_lines():
                    pass  # consume stream until done

            # recherche (opus)
            r = client.post(f"{base}/workflows/recherche", headers=headers, json={"user_id": uid})
            r.raise_for_status()

            # scraper generation (sonnet)
            r = client.post(f"{base}/scraper/generate", headers=headers, json={"user_id": uid, "remarks": ""})
            r.raise_for_status()

        log.info("onboard_done", user_id=uid)
        return {"status": "done"}
    except httpx.HTTPError as exc:
        log.error("onboard_error", user_id=uid, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.adapt_scraper")
def adapt_scraper(self, user_id: str, instruction: str) -> dict:
    uid = user_id
    headers = _agent_headers()
    try:
        with httpx.Client(timeout=120) as client:
            r = client.post(
                f"{settings.AGENT_WORKER_URL}/scraper/adapt",
                headers=headers,
                json={"user_id": uid, "diff_request": instruction},
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.send_offers_mail")
def send_offers_mail(self, user_id: str) -> dict:
    uid = UUID(user_id)
    user = db.get_user(uid)
    if not user:
        return {"skipped": "user_not_found"}

    last_mail = user.get("last_mail_at")
    offers = db.get_new_offers_since(uid, last_mail)
    if not offers:
        log.info("mail_no_offers", user_id=user_id)
        return {"sent": False, "reason": "no_new_offers"}

    html_body = _build_mail_html(offers, user.get("first_name", ""))
    _send_smtp(to=user["email"], subject=f"ArizoRAE — {len(offers)} nouvelles offres", html=html_body)
    db.update_last_mail_at(uid)
    log.info("mail_sent", user_id=user_id, nb_offers=len(offers))
    return {"sent": True, "nb_offers": len(offers)}


def _build_mail_html(offers: list[dict], first_name: str) -> str:
    rows = ""
    for o in offers:
        rows += (
            f'<tr>'
            f'<td style="padding:8px;text-align:center"><strong>{o["score"]}</strong></td>'
            f'<td style="padding:8px"><a href="{o["url"]}" style="color:#e85520;font-weight:bold">{o["title"]}</a></td>'
            f'<td style="padding:8px">{o["company"]}</td>'
            f'<td style="padding:8px">{o["location"]}</td>'
            f'<td style="padding:8px;font-size:11px;color:#666">{o["source"]}</td>'
            f'</tr>'
        )
    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<style>
  body{{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}}
  h1{{color:#e85520;border-bottom:3px solid #e85520;padding-bottom:8px}}
  table{{width:100%;border-collapse:collapse;margin-top:16px}}
  th{{background:#e85520;color:white;padding:10px;text-align:left}}
  td{{border-bottom:1px solid #eee}}
  .footer{{margin-top:24px;font-size:12px;color:#666;border-top:1px solid #eee;padding-top:12px}}
</style>
</head><body>
<h1>ArizoRAE — Nouvelles offres</h1>
<p>Bonjour {first_name}, voici vos <strong>{len(offers)}</strong> nouvelles offres :</p>
<table>
  <thead><tr><th>Score</th><th>Poste</th><th>Entreprise</th><th>Lieu</th><th>Source</th></tr></thead>
  <tbody>{rows}</tbody>
</table>
<div class="footer"><p>ArizoRAE — votre assistant recherche d'emploi</p></div>
</body></html>"""


def _send_smtp(to: str, subject: str, html: str) -> None:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        log.warning("smtp_not_configured")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM or settings.SMTP_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as s:
        s.ehlo()
        s.starttls()
        s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        s.sendmail(msg["From"], [to], msg.as_string())
