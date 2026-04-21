# FAQ — ArizoRAE

## Confidentialité

### Qu'est-ce qui quitte ma machine ?

Le CV et les données de profil ne quittent jamais le dépôt git local. Ils sont exclus par `.gitignore` et ne sont jamais versionnés.

Ce qui transite via l'API Anthropic : le contenu que vous soumettez à Claude Code dans la session (texte de l'offre, questions posées, réponses de complétion). La politique de données d'Anthropic s'applique à ces échanges.

### Ou sont stockés FACTS.md, BULLET_LIBRARY.md et preset.md ?

Sur votre machine, à l'emplacement que vous choisissez lors de l'`/init` :

- `user/` dans le répertoire du skill
- `~/.rae/` (ou équivalent selon l'OS)
- Tout chemin de votre choix

Ces fichiers ne sont pas dans le dépôt. Ils ne sont pas envoyés à un serveur externe par ArizoRAE. Le seul moment ou leur contenu est transmis à Anthropic, c'est quand Claude Code les lit pour produire un document : c'est le fonctionnement normal de l'API.

### Le preset est construit par recherche web. Quelles données sont envoyées ?

Lors du `/init` et du `/refresh-preset`, l'agent effectue des requêtes web avec des termes génériques construits à partir du métier et du pays déclarés. Exemple : "administrateur systèmes Linux Belgique compétences 2026". Aucune donnée personnelle du candidat n'est incluse dans ces requêtes.

### Puis-je utiliser ArizoRAE sans connexion internet ?

Oui, partiellement. Les workflows `/analyse`, `/cv`, `/lettre`, `/entretien` fonctionnent hors ligne dès qu'un `preset.md` existe. Seuls `/init` (étape 5) et `/refresh-preset` nécessitent le web. En cas d'absence de connexion lors de l'init, un `preset.md` minimal est généré et marqué `preset_status: incomplete`.

---

## Secteurs et cas d'usage

### ArizoRAE fonctionne-t-il pour tous les métiers ?

Oui. Le skill est conçu pour être agnostique au métier. Il n'embarque aucune liste de professions, aucune base de données de compétences par domaine. A chaque init, il construit un preset frais via recherche web pour le métier déclaré.

Exemples testés : informatique, santé, BTP, logistique, commerce, communication, enseignement, droit, finance, artisanat, freelance.

### Ca fonctionne pour le freelance et les missions courtes ?

Oui. Le workflow `/init` inclut une déclaration du statut visé (CDI, CDD, freelance, mission, stage, alternance). Les workflows `/lettre` et `/cv` s'y adaptent. Le preset peut inclure une estimation de TJM si le métier et le pays déclarés permettent de la récupérer par recherche web.

### Plusieurs profils sont-ils possibles sur la même machine ?

Oui. Lancer `/init` avec un chemin de stockage différent pour chaque profil. Le fichier `config.json` du skill pointe vers le profil actif. Pour switcher, relancer `/init` ou modifier `config.json` manuellement.

### ArizoRAE gère-t-il plusieurs langues ?

Les workflows `/cv`, `/lettre`, `/entretien` détectent la langue de l'offre et produisent par défaut dans cette langue. La langue peut être forcée en paramètre. `BULLET_LIBRARY.md` contient au minimum une version française et une version anglaise pour chaque bullet central.

---

## Limites

### ArizoRAE peut-il inventer des expériences ?

Non. C'est une contrainte de conception, pas une limitation technique. Tout contenu produit doit être ancré dans `FACTS.md`. Si une exigence de l'offre n'a pas de correspondance dans le profil, le skill le dit explicitement plutôt que de combler le vide.

### Le parsing du CV est-il parfait ?

Non. `init_rae.py` extrait le texte brut et tente de structurer les expériences, mais les CV complexes (tableaux, colonnes, mise en page lourde) peuvent donner des résultats partiels. C'est pourquoi l'étape de complétion existe et pourquoi l'édition manuelle de `FACTS.md` est obligatoire après l'init.

### Le preset est-il toujours fiable ?

Le preset reflète l'état du web au moment de sa génération. Il peut être incomplet si les sources consultées sont insuffisantes, ou si le métier est très niche. Le signaler dans le fichier (`preset_status: incomplete`) permet de relancer `/refresh-preset` plus tard. Les informations du preset éclairent le marché, elles ne certifient pas les compétences du candidat.

---

## Contribution

### Comment signaler un problème ?

Ouvrir une issue sur le dépôt GitHub en incluant :

- La version du skill (`claude skill list` pour la voir)
- La commande utilisée
- Le comportement observé vs. le comportement attendu
- Les éventuels messages d'erreur (en retirant toute donnée personnelle)

### Comment proposer une amélioration ?

Pour les références (jobboards, workflows) : ouvrir une issue ou une pull request directement sur les fichiers dans `rae-generic/references/`.

Pour le skill lui-même (`SKILL.md`) ou le script Python : fork + PR avec une description claire du problème résolu et des tests manuels effectués.

### Le skill peut-il être adapté à un secteur spécifique ?

Oui. Le skill est conçu pour être forké. Il suffit de modifier `SKILL.md` pour préciser les références sectorielles, d'ajouter des fichiers dans `references/`, et de reconstruire le bundle `.skill`. La structure est documentée dans `SKILL.md` sous "Fichiers de référence et emplacements".

### Puis-je distribuer une version modifiée ?

Oui, sous les termes de la licence MIT. Mentionner l'origine est apprécié mais pas obligatoire.
