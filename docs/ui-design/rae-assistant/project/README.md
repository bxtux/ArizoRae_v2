# ArizoRAE

Skill Claude Code pour la Recherche Active d'Emploi. Pilote un profil candidat structuré et génère — à partir de faits vérifiés seulement — des CV adaptés, des lettres de motivation, des préparations d'entretien et des analyses d'offre.

## Pourquoi

Les outils de génération de CV inventent. ArizoRAE fait le contraire : il sépare strictement la source de vérité (ce que le candidat a réellement fait, daté, chiffré) des documents dérivés. Résultat : aucune technologie "notion" ne migre vers "maîtrisée", aucune date n'est arrondie, aucune certification n'est inventée.

Le skill est agnostique au métier et au pays. Il n'embarque aucune liste figée de professions. A chaque initialisation, il interroge le web pour construire un preset frais adapté au domaine déclaré (mots-clés ATS, jobboards, questions d'entretien typiques, différenciateurs du marché).

## Comment ca fonctionne

```
/init           construit FACTS.md + BULLET_LIBRARY.md + preset.md à partir du CV
/analyse        score de match offre/profil, tableau Forces/Lacunes/Inconnus
/cv             sélectionne et ordonne les bullets pour une offre précise
/lettre         rédige la lettre de motivation depuis les bullets validés
/entretien      prépare les questions techniques, comportementales et pièges
/recherche      identifie les jobboards et requêtes types pour le métier/pays
/refresh-preset rafraîchit le preset si le marché a évolué
```

L'utilisateur édite `FACTS.md` à la main. C'est la seule source de vérité. Tous les documents produits en dérivent.

## Stack

| Composant | Rôle |
|---|---|
| Claude Code CLI | Agent qui pilote le skill |
| Cowork plugin | Distribue le skill aux utilisateurs |
| `rae-generic.skill` | Bundle zip : SKILL.md + scripts + templates + références |
| `scripts/init_rae.py` | Parsing CV, configuration du profil, extraction texte |
| `FACTS.md` | Profil candidat — non versionné, local à chaque utilisateur |
| `BULLET_LIBRARY.md` | Bullets pré-rédigés par thème et langue — non versionné |
| `preset.md` | Etat du marché pour le métier déclaré — non versionné |

## Structure du dépôt

```
ArizoRAE/
├── README.md
├── LICENSE
├── .gitignore
├── rae-generic.skill          (bundle distribué via Cowork)
└── docs/
    ├── onboarding.md          (installation Linux/Cowork/Claude Code)
    ├── workflow.md            (détail de chaque commande)
    └── faq.md                 (confidentialité, secteurs, contribution)
```

Les fichiers de profil (`FACTS.md`, `BULLET_LIBRARY.md`, `preset.md`) sont créés localement sur la machine de l'utilisateur à l'issue du `/init`. Ils ne sont jamais versionnés ici.

## Démarrage rapide

Voir [docs/onboarding.md](docs/onboarding.md) pour l'installation complète.

1. Installer Claude Code et le plugin Cowork
2. Ajouter le skill `rae-generic` depuis Cowork
3. Lancer `/init` et fournir le CV quand demandé
4. Editer `FACTS.md` pour compléter ou corriger les faits extraits
5. Utiliser `/analyse <offre>`, `/cv`, `/lettre`, `/entretien` selon le besoin

## Contribution

Voir [docs/faq.md](docs/faq.md), section Contribution.
