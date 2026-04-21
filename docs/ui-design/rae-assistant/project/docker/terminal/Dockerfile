# ============================================================
#  Terminal ArizoRAE — Claude Code + ttyd
#  Image hardened : non-root, lecture seule, tmpfs pour HOME
# ============================================================

# ── Stage 1 : télécharger ttyd ───────────────────────────
FROM debian:bookworm-slim AS ttyd-fetch

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ttyd 1.7.7 — terminal web léger (vérifier la dernière release sur GitHub)
RUN ARCH=$(dpkg --print-architecture) && \
    case "$ARCH" in \
      amd64) TTYD_ARCH=x86_64 ;; \
      arm64) TTYD_ARCH=aarch64 ;; \
      *) echo "Architecture $ARCH non supportée" && exit 1 ;; \
    esac && \
    curl -fsSL \
      "https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.${TTYD_ARCH}" \
      -o /usr/local/bin/ttyd && \
    chmod 755 /usr/local/bin/ttyd

# ── Stage 2 : image finale ───────────────────────────────
FROM debian:bookworm-slim

# Variables de build
ARG NODE_VERSION=20

# Installer les dépendances système en une seule couche
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Node.js (pour Claude Code)
    ca-certificates curl gnupg \
    # Python (pour le script init_rae.py du skill)
    python3 python3-pip \
    # Outils essentiels pour la session
    bash less wget vim-tiny \
    && \
    # Ajouter le dépôt NodeSource
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    # Nettoyer
    apt-get purge -y --auto-remove gnupg && \
    rm -rf /var/lib/apt/lists/* /tmp/*

# Copier ttyd depuis le stage précédent
COPY --from=ttyd-fetch /usr/local/bin/ttyd /usr/local/bin/ttyd

# Installer Claude Code CLI globalement
RUN npm install -g @anthropic-ai/claude-code --prefix /opt/npm && \
    ln -sf /opt/npm/bin/claude /usr/local/bin/claude

# Installer les dépendances Python pour le skill
RUN pip3 install --no-cache-dir --break-system-packages \
    pymupdf python-docx striprtf

# Créer un utilisateur non-root pour les sessions
# (ttyd lance la session en tant que cet utilisateur)
RUN groupadd -r rae && useradd -r -g rae -d /home/rae -s /bin/bash rae && \
    mkdir -p /home/rae && chown rae:rae /home/rae

# Copier les scripts
COPY session.sh    /usr/local/bin/rae-session
COPY entrypoint.sh /usr/local/bin/rae-entrypoint
RUN chmod 755 /usr/local/bin/rae-session /usr/local/bin/rae-entrypoint

# Le skill est monté en lecture seule via docker-compose
# (volume: ../rae-generic.skill:/opt/arizorae/rae-generic.skill:ro)
RUN mkdir -p /opt/arizorae && chmod 755 /opt/arizorae

# Dossier partagé pour les téléchargements (volume monté par docker-compose)
RUN mkdir -p /data/downloads && chmod 1777 /data/downloads

# Hardening supplémentaire : supprimer les binaires non nécessaires
RUN rm -f /usr/bin/gcc /usr/bin/g++ /usr/bin/make 2>/dev/null || true

EXPOSE 7681

# entrypoint.sh passe --credential si TERMINAL_PASSWORD est défini
ENTRYPOINT ["/usr/local/bin/rae-entrypoint"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:7681/ || exit 1
