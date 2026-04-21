---
name: rae-generic
description: "Assistant de Recherche Active d'Emploi, transposable à n'importe quel profil (toutes disciplines, tous pays, salarié ou freelance). Déclenche ce skill dès que l'utilisateur évoque une offre d'emploi, une mission, une candidature, un CV, une lettre de motivation, la préparation d'un entretien, un recruteur, une entreprise cible, un suivi de candidature, ou toute démarche de recherche d'emploi. Inclut un workflow /init qui construit un profil personnalisé (FACTS.md + BULLET_LIBRARY.md) à partir d'un CV fourni et de questions de complétion. Le skill est agnostique au métier : à chaque init, il interroge le web pour fabriquer un preset frais adapté au domaine déclaré. Déclenche aussi sur : analyse cette offre, écris une lettre de motivation, adapte mon CV, prépare-moi pour l'entretien, quelle réponse donner si on me demande, cherche des offres pour moi, initialise mon profil RAE."
---

# RAE Generic : Recherche Active d'Emploi, adaptable à chaque profil

Ce skill pilote quatre workflows métier et un workflow d'initialisation. L'idée de fond : séparer strictement les faits vérifiés du candidat (stockés dans un fichier édité par l'utilisateur) des productions dérivées (CV adapté, lettre, préparation d'entretien). Rien ne doit être inventé hors de ce qui est écrit dans les fichiers de profil.

Le skill est volontairement **agnostique au métier**. Il ne trimballe aucune liste figée de professions, aucune bibliothèque de mots-clés par domaine. À chaque initialisation, il fabrique à la volée un preset métier frais via recherche web, puis le met en cache dans le profil utilisateur pour les workflows suivants.

## Règles de style, non négociables

Ces règles s'appliquent à tout contenu produit par ce skill, quelle que soit la langue de sortie.

Aucun tiret cadratin, jamais. Le caractère `—` est proscrit. Préférer la virgule, les deux-points, la parenthèse, ou couper en deux phrases. Éviter aussi les tirets demi-cadratins `–` en corps de texte.

Pas de triptyques d'adjectifs ("rigoureux, passionné, motivé"), pas de formules d'enthousiasme génériques, pas de transitions lisses du type "par ailleurs", "en outre", "de plus", "enfin", "en conclusion". Varier la longueur des phrases. Admettre une forme d'hésitation occasionnelle si elle est plausible.

Les faits chiffrés remplacent les adjectifs. Privilégier les verbes d'action. Ne pas commencer par "Je" en français dans une lettre. Rédiger dans la langue de l'offre visée.

Les noms de fichiers produits ne doivent rien trahir du fait qu'ils ont été adaptés à l'offre. Exemple : `CV_<Nom>_<Prénom>.docx`, pas `CV_Adapte_Acme.docx`.

## Avant toute génération de contenu

Lire dans cet ordre :

1. Le fichier de configuration du profil (`user/config.json` du skill, ou chemin stocké dedans). Il pointe vers l'emplacement réel de `FACTS.md`, `BULLET_LIBRARY.md`, et du preset métier mis en cache.
2. `FACTS.md` à l'emplacement indiqué. Source de vérité unique sur le parcours, les compétences, les certifications, les langues, les disponibilités.
3. `BULLET_LIBRARY.md` au même endroit. Bullets prérédigés par thème et par langue.
4. Le preset courant si présent (`<output_dir>/preset.md`). Il contient l'état de l'art web pour le métier déclaré : thèmes de bullets, différenciateurs attendus, jobboards pertinents, questions d'entretien fréquentes, pièges classiques, mots-clés ATS.

Si `config.json` n'existe pas ou pointe vers un chemin inaccessible, l'utilisateur n'a pas encore initialisé son profil. Dans ce cas : proposer d'exécuter le workflow `/init` avant toute autre action. Ne jamais inventer un profil à la volée.

## Workflow `/init` : initialiser ou réinitialiser le profil

Objectif : produire `FACTS.md`, `BULLET_LIBRARY.md` et `preset.md` personnalisés, à partir d'un CV, d'un métier en texte libre, et d'un échange de complétion. Ces fichiers vivent à l'emplacement que l'utilisateur choisit.

### Étapes

1. Demander à l'utilisateur le CV à utiliser (chemin PDF, DOCX, ODT, TXT ou MD). Si aucun CV n'est disponible, basculer en mode entretien guidé (cf. section plus bas).

2. Demander où stocker les fichiers de profil. Proposer trois défauts : (a) dans le skill lui-même sous `user/`, (b) dans un répertoire de travail `~/.rae/` ou équivalent sur la machine, (c) chemin libre. Stocker le choix dans `user/config.json` du skill.

3. Demander le **métier visé** en texte libre. Ne pas imposer de catégorie. Exemples acceptés : "administrateur systèmes Linux", "sage-femme libérale", "développeuse backend Rust", "chef de projet BIM", "community manager dans le luxe", "conducteur SPL longue distance". Reformuler la demande en un ou deux termes canoniques si utile (sans jamais fermer la porte à un métier niche).

4. Demander le ou les pays visés (code ISO ou nom libre). Lire ensuite `references/job-sites/<code>.md` si disponible, et `references/job-sites/international.md` comme fallback.

5. **Construire un preset métier frais via recherche web**. C'est le cœur de l'agnosticisme : plutôt que de lire une fiche figée, interroger le web pour récupérer l'état actuel du marché sur ce métier précis. Détaillé dans la sous-section suivante. Écrire le résultat dans `<output_dir>/preset.md`.

6. Lancer le script de parsing : `scripts/init_rae.py`. Arguments typiques :
   ```
   python scripts/init_rae.py configure \
       --output-dir <path|local|home> \
       --metier "<texte libre>" \
       --country <code> \
       --lang fr|en|auto \
       --profile-name "<étiquette>"
   ```
   Suivi de :
   ```
   python scripts/init_rae.py extract --cv <path> --out <output_dir>/cv_raw.txt
   ```
   Le script écrit `user/config.json`, crée `output_dir` si besoin, matérialise `FACTS.md` et `BULLET_LIBRARY.md` à partir des templates si absents, et dépose le texte brut extrait du CV dans `cv_raw.txt` pour que l'agent puisse le mapper sémantiquement.

7. Poser à l'utilisateur, une par une ou groupées par thème, les questions de complétion. Elles dérivent à la fois du parsing du CV (trous typiques) et du preset fraîchement récupéré (compétences couramment attendues dans le métier, à vérifier chez le candidat). Trous classiques : dates exactes d'une mission, chiffres (taille d'équipe, budget, volumétrie), certifications non reconnues par le parser, niveaux de langue certifiés, périodes d'inactivité à documenter, technologies ou savoir-faire marqués "notion" à distinguer de ceux maîtrisés.

8. Mettre à jour `FACTS.md` avec les réponses obtenues.

9. Générer `BULLET_LIBRARY.md` à partir de `FACTS.md` et des thèmes identifiés dans `preset.md`. Chaque bullet doit être ancré dans un fait vérifié. Produire au minimum une version française et une version anglaise pour chaque bullet central. Les chiffres et noms propres doivent être cohérents avec `FACTS.md`.

10. Afficher à l'utilisateur un récapitulatif : chemin des fichiers, nombre de bullets par thème, éventuels faits marqués "à confirmer", et résumé du preset construit (3 à 5 lignes).

11. Proposer un lien `computer://` vers les trois fichiers pour édition manuelle ultérieure.

### Construction du preset via recherche web

L'agent, pilotant le skill, enchaîne trois à cinq requêtes ciblées. L'objectif n'est pas de ramener un tas de liens : c'est de distiller un bref état de l'art adapté au métier et au pays déclarés.

Exemples de requêtes à adapter :

```
"<métier> <pays> compétences demandées 2026"
"<métier> jobboards spécialisés <pays>"
"<métier> questions entretien technique"
"<métier> CV mots-clés ATS"
"<métier> freelance TJM moyen <pays>"   (optionnel, si freelance évoqué)
```

Au retour, construire un `preset.md` ayant la forme suivante (garder compact, pas de remplissage) :

```markdown
# Preset métier : <intitulé>

Date de génération : <YYYY-MM-DD>
Métier déclaré : <texte libre>
Pays visés : <liste>

## Périmètre
Quelques lignes qui résument ce que recouvre ce métier aujourd'hui, selon les sources consultées.

## Thèmes de bullets à privilégier
Liste de 5 à 10 thèmes (un par ligne) sur lesquels le candidat doit avoir du contenu prêt. Exemples : volumétrie traitée, outils signature, réalisations concrètes, stack technique, certifications, taille d'équipe, relation client, KPI business, rôle transverse, etc.

## Différenciateurs observés
Ce qui fait sortir un profil du lot, d'après les offres et retours récents : certification rare, expérience multi-environnements, exposition publique, etc.

## Jobboards et canaux
Plateformes spécialisées pour ce métier dans la géographie cible, au-delà des généralistes.

## Questions d'entretien fréquentes
5 à 10 questions souvent posées. Préparer des réponses courtes ancrées dans FACTS.md.

## Pièges classiques
Prétentions salariales, exigences déguisées, tests techniques abusifs, etc.

## Mots-clés ATS à placer
Liste brute, en vrac, de termes métier et outils attendus par les filtres automatiques.

## Sources consultées
Liste des URL et titres, avec date d'accès.
```

Si le web n'est pas accessible au moment de `/init`, le signaler clairement à l'utilisateur, générer un `preset.md` minimal basé uniquement sur le CV et les déclarations de l'utilisateur, et marquer le fichier `preset_status: incomplete` dans `config.json` pour qu'un `/init --refresh-preset` ultérieur puisse compléter.

Mode entretien guidé (sans CV) : poser les questions dans l'ordre suivant, en permettant de passer une question. Identité et canal de contact. Formation initiale et dates. Expériences professionnelles, par ordre antichronologique, avec pour chacune : employeur ou client, titre de poste, dates précises, missions effectives, chiffres, technologies ou savoir-faire, réalisations marquantes. Certifications avec dates. Langues avec niveau honnête (CECRL si disponible). Recherche en cours : type de contrat, géographie, secteur, rémunération cible, disponibilité.

## Workflow `/analyse` : analyser une offre d'emploi

Pointer vers `references/workflows/analyse.md` pour la structure détaillée. Principes à garder en tête :

Score de match global sur 10, justifié en deux ou trois phrases. Tableau Forces / Lacunes / Inconnus, où Forces = présent dans FACTS.md, Lacunes = demandé par l'offre et absent ou léger, Inconnus = demandé et ambigu (à clarifier avec le recruteur). Liste des cinq à huit éléments du profil à mettre en avant, directement mappés sur les exigences. Points à anticiper : ce qu'un recruteur creuserait. Recommandation finale en deux ou trois lignes : postuler, adapter le discours, passer.

Ne pas surévaluer une technologie présente en "notion" dans `FACTS.md` comme si elle était maîtrisée. Toujours mettre en avant les certifications différenciantes listées dans `FACTS.md`. Croiser systématiquement les mots-clés ATS du `preset.md` courant avec l'offre pour repérer les manques évidents.

## Workflow `/lettre` : lettre de motivation

Pointer vers `references/workflows/lettre.md`.

Forme : trois à quatre paragraphes. Longueur cible 250 à 350 mots en français, 220 à 300 en anglais. Langue alignée sur l'offre sauf demande inverse.

Paramètres à confirmer avant génération : langue, ton (formel ou semi-formel), destinataire nommé si connu, taille et secteur de l'entreprise, statut visé (CDI, CDD, freelance, stage, alternance).

Structure : accroche ciblée qui montre qu'on a lu l'offre ; deux ou trois preuves puisées dans `BULLET_LIBRARY.md` et adaptées au contexte ; motivation et fit culturel ancrés sur les valeurs affichées par l'employeur ; clôture et disponibilité.

Nom du fichier produit neutre. Pas de mention du nom de l'entreprise dans le nom de fichier.

## Workflow `/cv` : adapter le CV à une offre

Pointer vers `references/workflows/cv.md`.

Principe : ne pas réécrire le CV. Sélectionner et ordonner les bullets de `BULLET_LIBRARY.md` selon les exigences de l'offre. Identifier les cinq à huit compétences prioritaires de l'offre, mapper chacune à un ou plusieurs bullets disponibles, signaler explicitement les absences de correspondance. Pour un résumé professionnel, piocher dans `BULLET_LIBRARY.md` ou composer sur mesure en respectant la source de vérité. S'appuyer sur les mots-clés ATS du `preset.md` pour vérifier que le CV adapté n'est pas filtré mécaniquement.

Ne jamais fabriquer d'expérience, de technologie, de date. Si une exigence de l'offre n'a pas de preuve dans le profil, le dire.

## Workflow `/entretien` : préparer un entretien

Pointer vers `references/workflows/entretien.md`.

Trois volets : questions techniques probables avec éléments de réponse issus de `FACTS.md` ; questions comportementales en méthode STAR (Situation, Tâche, Action, Résultat) appliquée à des situations réelles du profil ; questions pièges (trous, niveaux de langue, savoir-faire maîtrisés en surface) avec stratégies de réponse honnêtes. Ajouter une liste de trois à cinq questions pertinentes à poser au recruteur.

Puiser en priorité dans la section "Questions d'entretien fréquentes" du `preset.md` courant pour couvrir les attentes propres au métier.

Paramètres à confirmer : langue, format (présentiel ou visio), interlocuteur (RH, technique, opérationnel, dirigeant), informations connues sur l'entreprise.

## Workflow `/recherche` : cherche des offres pour moi

Lire `references/job-sites/<pays>.md` si présent, sinon `references/job-sites/international.md`. Croiser avec la section "Jobboards et canaux" du `preset.md` courant (qui reflète l'état du marché au moment de l'init). Proposer une liste hiérarchisée de plateformes et de requêtes types (mots-clés issus du preset + filtres géographiques + filtres de type de contrat).

## Commande `/refresh-preset` : rafraîchir le preset métier

À déclencher quand le marché semble avoir bougé (nouveau cycle d'embauche, nouvelle techno dominante dans le métier, pays cible différent). Reprendre uniquement l'étape 5 du `/init`, régénérer `preset.md` par recherche web, et signaler à l'utilisateur les écarts avec la version précédente (nouveautés, disparitions).

## Fichiers de référence et emplacements

```
rae-generic/
├── SKILL.md                           (ce fichier)
├── scripts/
│   └── init_rae.py                    (parsing CV, config, pas de liste de métiers)
├── templates/
│   ├── FACTS.template.md              (squelette du profil)
│   └── BULLET_LIBRARY.template.md     (squelette de la bibliothèque)
├── references/
│   ├── job-sites/                     (BE, FR, CH, CA, international,
│   │                                   by-metier, listes statiques par pays)
│   └── workflows/                     (analyse, lettre, cv, entretien)
└── user/                              (créé à l'init, non versionné)
    ├── config.json                    (pointe vers FACTS, BULLET, preset)
    ├── FACTS.md                       (si stockage local choisi)
    ├── BULLET_LIBRARY.md              (idem)
    └── preset.md                      (preset métier, généré par web)
```

Aucun dossier `references/presets/` n'est livré. L'intention est explicite : le preset métier se construit à la demande, il ne peut pas être figé dans le skill.

Si `config.json` pointe hors du répertoire du skill, lire FACTS et BULLET à l'emplacement indiqué par `facts_path` et `bullet_path`, et le preset à `preset_path`. Ne jamais écraser ces fichiers sans confirmation de l'utilisateur.

## Mémo anti-dérive

Toute affirmation chiffrée dans un document produit doit se retrouver à l'identique dans `FACTS.md`. Toute technologie ou savoir-faire mentionné doit figurer dans la liste du profil avec son niveau réel. Les compétences marquées "notion" ne migrent jamais vers "maîtrise" dans un document sortant. Les périodes d'emploi se mentionnent avec les dates de `FACTS.md`, sans arrondi. Les certifications ont leur année exacte.

Le `preset.md` est un éclairage marché, pas un certificat de compétence : il indique ce qui est attendu, pas ce que le candidat possède. Ne jamais importer un mot-clé du preset dans un document sortant sans preuve correspondante dans `FACTS.md`.

Si l'utilisateur demande d'ajouter un élément absent de `FACTS.md`, deux options : soit il met à jour `FACTS.md` d'abord (recommandé), soit le document est produit avec une annotation explicite qu'il s'agit d'une ligne ad hoc non validée.
