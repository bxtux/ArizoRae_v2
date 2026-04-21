# Onboarding — Installation d'ArizoRAE

Ce guide couvre l'installation complète sur Linux. Pour macOS ou Windows, les étapes Claude Code et Cowork sont identiques ; seul le gestionnaire de paquets change.

## Prérequis

- Linux (toute distribution récente), macOS 13+, ou Windows 11 avec WSL2
- Python 3.10 ou supérieur
- Un compte Anthropic avec accès à Claude Code

---

## 1. Installer Claude Code

Claude Code est le CLI officiel d'Anthropic. Il s'installe via npm :

```bash
npm install -g @anthropic-ai/claude-code
```

Vérifier l'installation :

```bash
claude --version
```

Au premier lancement, Claude Code demande votre clé API (disponible sur console.anthropic.com) ou vous propose de vous connecter via OAuth.

```bash
claude
```

### Sur Linux sans Node.js installé

```bash
# Ubuntu / Debian
sudo apt install nodejs npm

# Arch / Manjaro
sudo pacman -S nodejs npm

# Fedora / RHEL
sudo dnf install nodejs npm
```

---

## 2. Installer le plugin Cowork

Cowork est le système de distribution de skills pour Claude Code. Il permet d'installer et de mettre à jour `rae-generic` sans manipuler le bundle manuellement.

```bash
claude mcp add cowork
```

Ou depuis les paramètres Claude Code : **Settings > Plugins > Ajouter un plugin**.

Vérifier que Cowork est actif :

```bash
claude mcp list
```

---

## 3. Installer le skill rae-generic

Une fois Cowork actif, installer le skill depuis ce dépôt ou depuis le registre Cowork :

**Depuis le dépôt local** (développement ou usage offline) :

```bash
# Cloner le dépôt
git clone https://github.com/BxTux/ArizoRAE.git
cd ArizoRAE

# Installer le skill via Cowork
claude skill install ./rae-generic.skill
```

**Depuis le registre Cowork** (usage standard) :

```bash
claude skill install rae-generic
```

Vérifier que le skill est chargé :

```bash
claude skill list
```

---

## 4. Dépendances Python

Le script `init_rae.py` requiert quelques bibliothèques pour extraire le texte des CV :

```bash
pip install pymupdf python-docx striprtf
```

Sur les systèmes qui séparent Python système et Python utilisateur :

```bash
pip install --user pymupdf python-docx striprtf
```

Vérifier :

```bash
python3 -c "import fitz, docx; print('OK')"
```

---

## 5. Premier lancement : initialiser le profil

Ouvrir Claude Code dans n'importe quel répertoire de travail :

```bash
claude
```

Taper la commande d'initialisation :

```
/init
```

Claude Code va :

1. Demander le chemin vers votre CV (PDF, DOCX, ODT ou TXT)
2. Demander où stocker les fichiers de profil
3. Demander le métier visé (texte libre, sans contrainte de format)
4. Demander le ou les pays ciblés
5. Effectuer une recherche web pour construire le preset métier
6. Poser des questions de complétion sur les trous détectés dans le CV
7. Produire `FACTS.md`, `BULLET_LIBRARY.md` et `preset.md`

A l'issue de l'init, ouvrir `FACTS.md` dans votre éditeur habituel et vérifier chaque ligne. C'est la seule étape manuelle obligatoire.

---

## Mise à jour du skill

```bash
claude skill update rae-generic
```

Si vous travaillez depuis le dépôt local :

```bash
git pull
claude skill install ./rae-generic.skill --force
```

---

## En cas de problème

- `claude: command not found` : Node.js n'est pas dans le PATH ou l'installation npm a échoué. Relancer le terminal ou ajouter `~/.npm-global/bin` au PATH.
- `ModuleNotFoundError: fitz` : exécuter `pip install pymupdf` dans le même environnement Python que celui utilisé par Claude Code.
- Le skill n'apparait pas dans `/skill list` : redémarrer Claude Code après l'installation.
- Le web est inaccessible lors de l'init : le skill génère un `preset.md` minimal et le marque `preset_status: incomplete`. Lancer `/refresh-preset` dès que la connexion est rétablie.

Pour tout autre problème, ouvrir une issue sur le dépôt en suivant le modèle décrit dans [faq.md](faq.md).
