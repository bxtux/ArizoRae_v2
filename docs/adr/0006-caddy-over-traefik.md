# ADR 0006 — Caddy comme reverse proxy (vs Traefik)

Statut : accepté
Date : 2026-04-21

## Contexte

Le prototype UI livré (`docs/ui-design/rae-assistant/project/docker/`) utilisait Traefik. Le `.env` contient déjà `DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN`, `DOMAIN`, `ACME_EMAIL` pour TLS automatique.

## Décision

Utiliser **Caddy 2** comme reverse proxy.

## Pourquoi

- Syntaxe `Caddyfile` plus lisible que les labels Docker Traefik pour une topologie fixe.
- TLS auto ACME out-of-the-box avec plugin `caddy-dns/duckdns` (DNS-01 challenge sans port 80 ouvert au public).
- Moins de configuration redondante : un fichier Caddyfile unique plutôt qu'une labelisation répétée par service.
- Performance équivalente, empreinte mémoire similaire.

## Trade-offs

- Écosystème Docker-labels moins riche que Traefik.
- Plugin DuckDNS nécessite build custom (ou image `caddy-dns/duckdns` communautaire). Retenu : build local via Dockerfile avec `xcaddy`.

## Règles

- `infra/caddy/Caddyfile` source unique de config.
- Routes :
  - `https://${DOMAIN}/` → portal:3000
  - `https://${DOMAIN}/terminal/*` → terminal:7681 (avec basic auth via `TERMINAL_PASSWORD`)
  - `https://${DOMAIN}/gotify/*` → gotify:80 (auth interne Gotify)
- L'agent-worker et scraper-worker ne sont **jamais** exposés : communication interne Docker network uniquement.
- Certificats dans volume `caddy_data:/data`.

## Conséquences

- `infra/caddy/Dockerfile` : build avec `caddy:builder` + plugin duckdns + copy Caddyfile.
- Ouverture port 443 uniquement (80 facultatif pour redirection HTTP→HTTPS).
- ADR à rééxaminer si on migre vers Kubernetes : Caddy reste valide mais Traefik s'intègre mieux avec Ingress.
