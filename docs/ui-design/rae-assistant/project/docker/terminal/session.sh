#!/bin/bash
# ============================================================
#  ArizoRAE — Script de session ttyd
#  Chaque connexion = HOME isolé dans /tmp/arizorae-XXXX
#  Les fichiers à télécharger sont publiés dans /data/downloads
# ============================================================

set -euo pipefail

# ── Génération d'un ID de session unique ─────────────────
SESSION_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || \
             head -c 32 /dev/urandom | md5sum | cut -d' ' -f1)

# ── Environnement HOME isolé dans tmpfs ──────────────────
SESSION_DIR=$(mktemp -d /tmp/arizorae-XXXXXXXXXX)
export HOME="$SESSION_DIR"
export XDG_CONFIG_HOME="$SESSION_DIR/.config"
export XDG_DATA_HOME="$SESSION_DIR/.local/share"
export XDG_CACHE_HOME="$SESSION_DIR/.cache"
export WORKSPACE="$SESSION_DIR/workspace"

mkdir -p "$WORKSPACE" \
         "$SESSION_DIR/.config" \
         "$SESSION_DIR/.local/share" \
         "$SESSION_DIR/.cache"

# ── Dossier de téléchargement sur le volume partagé ─────
DOWNLOAD_DIR="/data/downloads/$SESSION_ID"
mkdir -p "$DOWNLOAD_DIR"
chmod 755 "$DOWNLOAD_DIR"

# ── URL de téléchargement ────────────────────────────────
# RAE_DOMAIN est injecté par docker-compose depuis la variable DOMAIN
DOMAIN="${RAE_DOMAIN:-localhost}"
DOWNLOAD_URL="https://${DOMAIN}/files/${SESSION_ID}"

# ── Nettoyage à la déconnexion ───────────────────────────
cleanup() {
  # Le HOME session (tmpfs) est nettoyé automatiquement au reboot
  # Le DOWNLOAD_DIR est nettoyé par le service cleanup (après 2h)
  rm -rf "$SESSION_DIR" 2>/dev/null || true
}
trap cleanup EXIT

# ── Bannière de bienvenue ────────────────────────────────
clear
printf '\033[1;33m'
cat << 'BANNER'
  ╔═══════════════════════════════════════════════════════════╗
  ║        ArizoRAE — Recherche Active d'Emploi              ║
  ║                Terminal Web                               ║
  ╚═══════════════════════════════════════════════════════════╝
BANNER
printf '\033[0m'

printf "\033[0;36m  Session ID : \033[1m%s\033[0m\n\n" "$SESSION_ID"

cat << 'STEPS'
  ÉTAPES :

  ① Authentifier Claude Code (une seule fois par session)

      Option A — Compte claude.ai (gratuit ou payant) :
        $ claude
        → Ouvrez le lien affiché dans un nouvel onglet

      Option B — Clé API Anthropic :
        $ export ANTHROPIC_API_KEY=sk-ant-...
        puis $ claude

  ② Installer le skill dans votre session :
        $ install-rae

  ③ Dans Claude Code, lancer l'initialisation :
        /init
        (fournir votre CV ou répondre aux questions guidées)

  ④ Partager vos fichiers pour les télécharger :
        $ share-rae

STEPS

printf "\033[0;90m  Votre espace de travail : %s\033[0m\n" "$WORKSPACE"
printf "\033[0;90m  Vos téléchargements  : %s\033[0m\n\n" "$DOWNLOAD_URL"
printf "\033[0;90m%s\033[0m\n\n" "  ─────────────────────────────────────────────────────────"

# ── Helpers disponibles dans la session ─────────────────

install_rae() {
  if [ ! -f /opt/arizorae/rae-generic.skill ]; then
    printf '\033[0;31mErreur : skill introuvable dans /opt/arizorae/\033[0m\n'
    return 1
  fi
  printf '→ Installation du skill rae-generic...\n'
  cp /opt/arizorae/rae-generic.skill "$WORKSPACE/"
  cd "$WORKSPACE"
  claude skill install ./rae-generic.skill && \
    printf '\033[0;32m✓ Skill installé.\033[0m\n' && \
    printf '  Ouvrez Claude Code ($ claude) et tapez \033[1m/init\033[0m\n'
}
export -f install_rae

share_rae() {
  local files_found=0
  cd "$WORKSPACE"

  printf '→ Préparation du téléchargement...\n'

  # Collecter les fichiers du profil
  local to_pack=()
  for f in FACTS.md BULLET_LIBRARY.md preset.md rae-generic.skill; do
    [ -f "$f" ] && to_pack+=("$f") && files_found=$((files_found + 1))
  done

  # Inclure aussi les documents générés (CV, lettres)
  for f in *.docx *.pdf *.txt; do
    [ -f "$f" ] && to_pack+=("$f") 2>/dev/null || true
  done

  if [ "$files_found" -eq 0 ]; then
    printf '\033[0;33mAucun fichier de profil trouvé.\033[0m\n'
    printf 'Lancez \033[1m/init\033[0m dans Claude Code d'\''abord.\n'
    return 1
  fi

  # Créer l'archive
  local archive="$DOWNLOAD_DIR/arizorae-profil.tar.gz"
  tar -czf "$archive" "${to_pack[@]}" 2>/dev/null
  chmod 644 "$archive"

  printf '\n\033[0;32m✓ %d fichier(s) archivé(s)\033[0m\n\n' "$files_found"
  printf '  Téléchargez ici (lien valable 2h) :\n'
  printf '\033[1;36m  %s/arizorae-profil.tar.gz\033[0m\n\n' "$DOWNLOAD_URL"
  printf '  Contenu de l'\''archive :\n'
  for f in "${to_pack[@]}"; do
    printf '    · %s\n' "$f"
  done
  printf '\n'
}
export -f share_rae

# ── Aliases raccourcis ───────────────────────────────────
alias install-rae='install_rae'
alias share-rae='share_rae'
alias ll='ls -lah'

# ── PS1 coloré ──────────────────────────────────────────
export PS1='\[\e[0;33m\]arizorae\[\e[0m\]:\[\e[0;36m\]\W\[\e[0m\]\$ '

# ── Aller dans le workspace ──────────────────────────────
cd "$WORKSPACE"

# ── Lancer bash interactif (sans .bashrc système) ────────
exec bash --norc --noprofile
