#!/bin/sh
# ============================================================
#  Entrypoint ttyd — passe --credential si TERMINAL_PASSWORD
#  est défini, sinon démarre sans auth (non recommandé)
# ============================================================

set -e

TTYD_ARGS="--port 7681 --writable --max-clients 5 --ping-interval 30"
TTYD_ARGS="$TTYD_ARGS --client-option fontSize=14"

if [ -n "${TERMINAL_PASSWORD:-}" ]; then
  echo "[ttyd] Authentification activée (user: rae)"
  exec /usr/local/bin/ttyd \
    $TTYD_ARGS \
    --credential "rae:${TERMINAL_PASSWORD}" \
    /usr/local/bin/rae-session
else
  echo "[ttyd] ATTENTION : pas de mot de passe — accès ouvert"
  exec /usr/local/bin/ttyd \
    $TTYD_ARGS \
    /usr/local/bin/rae-session
fi
