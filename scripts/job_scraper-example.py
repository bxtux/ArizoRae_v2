#!/usr/bin/env python3
"""
RAE Job Scraper — Frédéric DESSY
Scrape ICTJob.be et LinkedIn pour les offres admin systèmes Linux
Envoie un digest quotidien par email Gmail SMTP
"""

import urllib.request
import urllib.parse
import re
import html
import json
import smtplib
import os
import sys
from http.cookiejar import CookieJar
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, date

# ─── Configuration ────────────────────────────────────────────────────────────
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "email_config.json")

ICTJOB_URL = (
    "https://www.ictjob.be/fr/chercher-emplois-it"
    "?keywords=administrateur+systemes+linux"
    "&location=Bruxelles"
    "&radius=30"
)

LINKEDIN_URL = (
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
    "?keywords=linux+system+administrator"
    "&location=Belgium"
    "&geoId=100565514"
    "&start=0"
    "&count=25"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "fr-BE,fr;q=0.9,en;q=0.8",
}

# ─── Scoring keywords ─────────────────────────────────────────────────────────
HIGH_MATCH = [
    "linux", "ansible", "proxmox", "vmware", "vsphere", "hyper-v", "hyper v",
    "active directory", "azure", "haproxy", "wazuh", "sécurité", "security",
    "infrastructure", "devops", "système", "system", "sysadmin",
    "administrateur", "administrator", "réseau", "network", "virtualisation",
    "virtualization", "haute disponibilité", "high availability",
]
LOW_MATCH = [
    "windows server", "powershell", "bash", "docker", "veeam", "backup",
    "monitoring", "grafana", "prometheus", "firewall", "sophos", "watchguard",
    "exchange", "office 365", "microsoft 365", "itsm", "itil", "glpi",
]
EXCLUDE = [
    "junior", "stage", "intern", "stagiaire", "développeur", "developer",
    "data scientist", "machine learning", "embedded software", "qa engineer",
    "test engineer", "testing", "front-end", "frontend", "backend",
    "mobile", "ios", "android", "sales", "commercial", "chef de projet",
]
# Critères pénalisants (anglais courant obligatoire ou diplôme requis)
# Chaque occurrence retire 3 points — l'offre reste visible mais descend dans le classement
PENALIZE = [
    "fluent english", "fluent in english", "english fluent",
    "anglais courant", "anglais obligatoire", "bilingue anglais",
    "bilingual english", "native english",
    "master degree", "master's degree", "bachelor degree", "bachelor's degree",
    "bac+5", "bac+4", "bac+3", "bac +5", "bac +4", "bac +3",
    "degree required", "diploma required", "diplôme requis",
    "graduate degree", "university degree",
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def clean(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def score_offer(title: str, company: str = "", location: str = "", description: str = "") -> int:
    text = f"{title} {company} {location} {description}".lower()
    if any(k in text for k in EXCLUDE):
        return -1
    score = 0
    for k in HIGH_MATCH:
        if k in text:
            score += 2
    for k in LOW_MATCH:
        if k in text:
            score += 1
    # Malus : critères éliminatoires (anglais fluent exigé, diplôme requis)
    for k in PENALIZE:
        if k in text:
            score -= 3
    return score


def fetch_url(url: str, opener=None) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    opener = opener or urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(CookieJar())
    )
    try:
        with opener.open(req, timeout=15) as r:
            return r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"[WARN] fetch_url({url[:60]}): {e}", file=sys.stderr)
        return ""


# ─── Scrapers ─────────────────────────────────────────────────────────────────

def scrape_ictjob() -> list[dict]:
    cj = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    page = fetch_url(ICTJOB_URL, opener)
    if not page:
        return []

    titles_links = re.findall(
        r'<a[^>]*class="[^"]*job-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
        page, re.DOTALL
    )
    companies = re.findall(
        r'<(?:span|div|a)[^>]*class="[^"]*job-company[^"]*"[^>]*>(.*?)</(?:span|div|a)>',
        page, re.DOTALL
    )
    dates = re.findall(
        r'<(?:span|div)[^>]*class="[^"]*job-date[^"]*"[^>]*>(.*?)</(?:span|div)>',
        page, re.DOTALL
    )
    locations = re.findall(
        r'<(?:span|div)[^>]*class="[^"]*job-location[^"]*"[^>]*>(.*?)</(?:span|div)>',
        page, re.DOTALL
    )

    results = []
    for i, (href, title) in enumerate(titles_links):
        t = clean(title)
        c = clean(companies[i]) if i < len(companies) else ""
        d = clean(dates[i]) if i < len(dates) else ""
        loc = clean(locations[i]) if i < len(locations) else ""
        s = score_offer(t, c, loc)
        results.append({
            "title": t, "company": c, "location": loc,
            "date": d, "url": href, "score": s, "source": "ICTJob.be"
        })
    return results


def scrape_linkedin() -> list[dict]:
    page = fetch_url(LINKEDIN_URL)
    if not page:
        return []

    titles = re.findall(
        r'<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>(.*?)</h3>',
        page, re.DOTALL
    )
    companies = re.findall(
        r'<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>(.*?)</h4>',
        page, re.DOTALL
    )
    locations = re.findall(
        r'<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>(.*?)</span>',
        page, re.DOTALL
    )
    links = re.findall(
        r'href="(https://[^"]*linkedin\.com/jobs/view/[^"?&]+)[^"]*"', page
    )
    dates = re.findall(r'<time[^>]*datetime="([^"]+)"', page)

    results = []
    for i in range(len(titles)):
        t = clean(titles[i])
        c = clean(companies[i]) if i < len(companies) else ""
        loc = clean(locations[i]) if i < len(locations) else ""
        d = dates[i] if i < len(dates) else ""
        href = links[i] if i < len(links) else ""
        s = score_offer(t, c, loc)
        results.append({
            "title": t, "company": c, "location": loc,
            "date": d, "url": href, "score": s, "source": "LinkedIn"
        })
    return results


# ─── Email ────────────────────────────────────────────────────────────────────

def build_html_email(offers: list[dict], total_scraped: int) -> str:
    today = date.today().strftime("%d/%m/%Y")
    rows = ""
    for i, o in enumerate(offers):
        score_bar = "⭐" * min(o["score"], 5)
        bg = "#f0f8f0" if i % 2 == 0 else "#ffffff"
        rows += f"""
        <tr style="background:{bg}">
          <td style="padding:8px;text-align:center">{score_bar}<br><small>{o['score']}</small></td>
          <td style="padding:8px"><a href="{o['url']}" style="color:#1a73e8;font-weight:bold">{o['title']}</a></td>
          <td style="padding:8px">{o['company']}</td>
          <td style="padding:8px">{o['location']}</td>
          <td style="padding:8px;text-align:center">{o['date']}</td>
          <td style="padding:8px;text-align:center;font-size:11px;color:#666">{o['source']}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8">
<style>
  body {{font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #333;}}
  h1 {{color: #1a73e8; border-bottom: 3px solid #1a73e8; padding-bottom: 8px;}}
  table {{width: 100%; border-collapse: collapse; margin-top: 16px;}}
  th {{background: #1a73e8; color: white; padding: 10px; text-align: left;}}
  td {{border-bottom: 1px solid #eee;}}
  .footer {{margin-top: 24px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 12px;}}
</style>
</head>
<body>
<h1>🔍 Veille Emploi RAE — {today}</h1>
<p><strong>{len(offers)}</strong> offres sélectionnées sur <strong>{total_scraped}</strong> analysées
(ICTJob.be + LinkedIn Belgique)</p>
<table>
  <thead>
    <tr>
      <th>Score</th>
      <th>Poste</th>
      <th>Entreprise</th>
      <th>Lieu</th>
      <th>Date</th>
      <th>Source</th>
    </tr>
  </thead>
  <tbody>{rows}</tbody>
</table>
<div class="footer">
  <p>Généré automatiquement par le script RAE · Frédéric DESSY · {today}</p>
  <p>Mots-clés ICTJob : <em>administrateur systemes linux, Bruxelles, rayon 30km</em></p>
  <p>Mots-clés LinkedIn : <em>linux system administrator, Belgium</em></p>
</div>
</body>
</html>"""


def send_email(html_body: str, config: dict, nb_offers: int) -> bool:
    today = date.today().strftime("%d/%m/%Y")
    subject = config.get("subject", "🔍 Veille Emploi RAE").replace("{date}", today)
    subject = f"{subject} | {nb_offers} offres"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config["from"]
    msg["To"] = config["to"]
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(config["smtp_server"], config["smtp_port"]) as server:
            server.ehlo()
            server.starttls()
            server.login(config["from"], config["app_password"])
            server.sendmail(config["from"], [config["to"]], msg.as_string())
        print(f"[OK] Email envoyé à {config['to']}")
        return True
    except Exception as e:
        print(f"[ERROR] Envoi email : {e}", file=sys.stderr)
        return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Démarrage veille emploi...")

    # Chargement config
    if not os.path.exists(CONFIG_FILE):
        print(f"[ERROR] Config introuvable : {CONFIG_FILE}", file=sys.stderr)
        print("Crée email_config.json dans le dossier scripts/", file=sys.stderr)
        sys.exit(1)

    with open(CONFIG_FILE) as f:
        config = json.load(f)

    if config.get("app_password") in ("", "VOTRE_APP_PASSWORD_ICI", None):
        print("[ERROR] app_password non configuré dans email_config.json", file=sys.stderr)
        sys.exit(1)

    # Scraping
    print("[1/3] Scraping ICTJob.be...")
    ict_offers = scrape_ictjob()
    print(f"      → {len(ict_offers)} offres trouvées")

    print("[2/3] Scraping LinkedIn...")
    li_offers = scrape_linkedin()
    print(f"      → {len(li_offers)} offres trouvées")

    all_offers = ict_offers + li_offers
    total = len(all_offers)

    # Filtrage et tri
    filtered = [o for o in all_offers if o["score"] > 0]
    filtered.sort(key=lambda x: x["score"], reverse=True)
    top10 = filtered[:10]

    print(f"[2/3] {total} offres analysées → {len(filtered)} pertinentes → {len(top10)} sélectionnées")

    if not top10:
        print("[WARN] Aucune offre pertinente trouvée aujourd'hui.")
        return

    # Affichage console
    print("\n📋 TOP OFFRES DU JOUR :")
    print("-" * 80)
    for i, o in enumerate(top10, 1):
        print(f"{i:2}. [{o['score']:2}⭐] {o['title'][:45]:<45} | {o['company'][:25]:<25} | {o['location'][:20]}")
    print("-" * 80)

    # Email
    print("[3/3] Envoi email...")
    html_body = build_html_email(top10, total)
    send_email(html_body, config, len(top10))

    # Sauvegarde log JSON
    log_file = os.path.join(
        os.path.dirname(__file__),
        f"veille_{date.today().strftime('%Y%m%d')}.json"
    )
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump({"date": str(date.today()), "total": total, "selected": top10}, f, ensure_ascii=False, indent=2)
    print(f"[OK] Log sauvegardé : {log_file}")


if __name__ == "__main__":
    main()
