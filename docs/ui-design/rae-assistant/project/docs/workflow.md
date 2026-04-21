# Workflow — Référence des commandes ArizoRAE

Toutes les commandes s'exécutent depuis Claude Code (`claude`). Le skill `rae-generic` doit être installé et le profil initialisé (`/init`) avant d'utiliser les autres workflows.

---

## `/init` — Initialiser ou réinitialiser le profil

Construit les trois fichiers de profil à partir d'un CV et d'un échange de complétion.

**Déclencheurs** : première utilisation, changement de métier cible, changement de pays, CV mis à jour.

### Déroulement

1. Fourniture du CV — chemin vers un fichier PDF, DOCX, ODT ou TXT. Si aucun CV n'est disponible, le skill bascule en mode entretien guidé (questions posées une par une dans l'ordre : identité, formation, expériences antichronologiques, certifications, langues, recherche en cours).

2. Choix du répertoire de stockage — trois options proposées :
   - `user/` dans le répertoire du skill (portable, reste avec l'installation)
   - `~/.rae/` ou équivalent (partagé entre plusieurs projets)
   - Chemin libre

3. Déclaration du métier visé en texte libre. Exemples valides : "ingénieure data Spark", "sage-femme libérale", "conducteur SPL longue distance", "community manager dans le luxe".

4. Déclaration du ou des pays ciblés.

5. Construction du preset métier par recherche web (mots-clés ATS, jobboards, questions d'entretien typiques, différenciateurs du marché pour le métier/pays déclarés). Résultat écrit dans `preset.md`.

6. Extraction et parsing du CV via `scripts/init_rae.py`.

7. Questions de complétion sur les trous détectés (dates manquantes, chiffres, certifications ambiguës, niveaux de langue, périodes d'inactivité).

8. Génération de `FACTS.md` et `BULLET_LIBRARY.md`.

9. Récapitulatif affiché : chemins des fichiers, nombre de bullets par thème, faits marqués "à confirmer", résumé du preset.

**Fichiers produits**

| Fichier | Rôle |
|---|---|
| `FACTS.md` | Source de vérité — à éditer manuellement |
| `BULLET_LIBRARY.md` | Bullets pré-rédigés par thème et par langue |
| `preset.md` | Etat du marché pour le métier/pays déclarés |
| `cv_raw.txt` | Texte brut extrait du CV (intermédiaire) |
| `user/config.json` | Pointeurs vers les trois fichiers ci-dessus |

**Important** : après l'init, ouvrir `FACTS.md` et vérifier chaque ligne. Aucun document ne sera produit si un fait est absent ou incorrect.

---

## `/analyse` — Analyser une offre d'emploi

Evalue l'adéquation entre le profil (`FACTS.md`) et une offre fournie.

**Usage**

```
/analyse <offre>
```

Fournir l'offre en la collant directement dans le chat, ou en donnant un chemin vers un fichier texte.

**Sortie**

- Score de match sur 10, justifié en 2-3 phrases
- Tableau Forces / Lacunes / Inconnus
  - Forces : compétences demandées et présentes dans `FACTS.md`
  - Lacunes : demandées et absentes ou légères dans le profil
  - Inconnus : demandées et ambiguës (à clarifier avec le recruteur)
- Liste des 5 à 8 éléments du profil à mettre en avant pour cette offre
- Points à anticiper : ce qu'un recruteur creuserait probablement
- Recommandation finale : postuler, adapter le discours, ou passer

**Règles**

- Les compétences marquées "notion" dans `FACTS.md` ne sont jamais présentées comme maîtrisées
- Les mots-clés ATS du `preset.md` courant sont croisés avec l'offre pour signaler les manques
- Les certifications différenciantes de `FACTS.md` sont toujours mises en avant si pertinentes

---

## `/cv` — Adapter le CV à une offre

Sélectionne et ordonne les bullets de `BULLET_LIBRARY.md` en fonction des exigences d'une offre.

**Usage**

```
/cv <offre>
```

Le skill ne réécrit pas le CV. Il identifie les 5 à 8 compétences prioritaires de l'offre, mappe chacune aux bullets disponibles, et signale explicitement les absences de correspondance.

**Sortie**

- Sélection de bullets ordonnés par priorité pour cette offre
- Résumé professionnel adapté (si demandé), composé depuis `BULLET_LIBRARY.md` ou sur mesure
- Liste des mots-clés ATS du preset présents ou absents dans la sélection
- Liste des exigences sans correspondance dans le profil (à traiter honnêtement)

**Nom du fichier produit**

Le nom ne révèle jamais qu'il a été adapté : `CV_Nom_Prenom.docx`, pas `CV_Adapte_Acme.docx`.

**Règle absolue** : aucune expérience, technologie ou date n'est inventée. Si une exigence n'a pas de preuve dans le profil, c'est dit explicitement.

---

## `/lettre` — Lettre de motivation

Rédige une lettre de motivation depuis les bullets validés de `BULLET_LIBRARY.md`.

**Usage**

```
/lettre <offre>
```

Avant de générer, le skill confirme :

- Langue (détectée depuis l'offre, confirmée ou modifiée)
- Ton (formel ou semi-formel)
- Destinataire nommé si connu
- Taille et secteur de l'entreprise
- Statut visé (CDI, CDD, freelance, stage, alternance)

**Structure de la lettre**

1. Accroche ciblée montrant que l'offre a été lue
2. Deux ou trois preuves puisées dans `BULLET_LIBRARY.md` et adaptées au contexte
3. Motivation et fit culturel ancrés sur les valeurs affichées par l'employeur
4. Clôture et disponibilité

**Longueur cible** : 250-350 mots en français, 220-300 mots en anglais.

---

## `/entretien` — Préparer un entretien

Prépare les questions et les réponses pour un entretien lié à une offre.

**Usage**

```
/entretien <offre>
```

Paramètres confirmés avant génération : langue, format (présentiel ou visio), interlocuteur (RH, technique, opérationnel, dirigeant), informations connues sur l'entreprise.

**Volets de la préparation**

1. **Questions techniques probables** avec éléments de réponse issus de `FACTS.md`. Basées sur la section "Questions d'entretien fréquentes" du `preset.md` courant.

2. **Questions comportementales** en méthode STAR (Situation, Tâche, Action, Résultat) appliquée à des situations réelles du profil.

3. **Questions pièges** (trous dans le parcours, niveaux de langue, savoir-faire maîtrisés en surface) avec stratégies de réponse honnêtes.

4. **Questions à poser au recruteur** : liste de 3 à 5 questions pertinentes.

---

## `/recherche` — Chercher des offres

Identifie les jobboards et les requêtes types pour le métier et le pays déclarés lors de l'init.

**Usage**

```
/recherche
```

Ou avec des paramètres pour affiner :

```
/recherche --metier "ingénieure cloud" --pays CH
```

**Sortie**

- Liste hiérarchisée de plateformes (généralistes puis spécialisées pour le métier)
- Requêtes types prêtes à coller dans les moteurs de recherche d'emploi
- Mots-clés issus du `preset.md` courant avec filtres géographiques et type de contrat

---

## `/refresh-preset` — Rafraîchir le preset métier

Reconstruit `preset.md` par une nouvelle recherche web, sans toucher à `FACTS.md` ni à `BULLET_LIBRARY.md`.

**Usage**

```
/refresh-preset
```

A lancer quand : le marché a bougé depuis le dernier init (nouveau cycle d'embauche, nouvelle technologie dominante dans le métier), le pays cible a changé, plusieurs mois se sont écoulés.

**Sortie**

- Nouveau `preset.md` généré
- Rapport des écarts avec la version précédente (nouveautés, disparitions)

---

## Flux typique d'une candidature

```
/init                         (une seule fois, ou à chaque changement majeur)
    éditer FACTS.md manuellement

/analyse <offre>              (décider si ca vaut le coup de postuler)

/cv <offre>                   (sélectionner les bullets pour cette offre)
/lettre <offre>               (rédiger la lettre)

/entretien <offre>            (préparer si convoqué)
```
