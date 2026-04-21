# Workflow /cv : adapter le CV à une offre

Ne pas réécrire le CV depuis zéro. Choisir et ordonner les bullets de
BULLET_LIBRARY.md en fonction des priorités de l'offre.

## Étapes

1. Lire FACTS.md, BULLET_LIBRARY.md, et le `preset.md` courant du
   profil. Si `preset.md` est marqué `pending` dans la config, le
   signaler à l'utilisateur et proposer un `/refresh-preset` avant
   d'attaquer l'adaptation.
2. Lire l'offre. Identifier cinq à huit exigences prioritaires :
   compétences techniques, outils, certifications, soft skills,
   expériences sectorielles.
3. Mapper chaque exigence aux bullets disponibles.
4. Produire une liste ordonnée :
    - Résumé professionnel en tête (choix d'une variante existante ou
      composition sur mesure à partir de FACTS.md).
    - Compétences clés priorisées selon l'offre.
    - Expériences : pour chaque poste conservé, sélectionner les trois
      à cinq bullets les plus pertinents.
    - Formations et certifications.
    - Langues.
    - Rubrique facultative (projets personnels, publications,
      associations) si elle sert l'offre.

5. Signaler explicitement les exigences de l'offre qui ne trouvent pas
   de bullet correspondant. Deux options à proposer :
    - Composer un bullet ad hoc en s'appuyant sur un fait réel de
      FACTS.md, avec la mention que c'est une création temporaire à
      valider avec l'utilisateur.
    - Laisser la lacune et la préparer pour l'entretien.

## Contraintes éditoriales

Verbes d'action au passé. Chiffres en chiffres. Pas de tiret cadratin,
y compris en anglais. Pas de triptyque d'adjectifs. Cohérence stricte
avec FACTS.md.

Ne jamais fabriquer une date, un titre de poste, une certification. Si
FACTS.md marque une technologie comme "notion", ne pas l'afficher comme
maîtrisée dans le CV.

Langue : alignée sur l'offre sauf instruction contraire.

## Nom du fichier produit

Neutre. Exemple : `CV_<Nom>_<Prenom>.docx`. Éviter toute mention de
l'entreprise ou du fait que le CV est adapté.

## Variantes à proposer

Version longue (pour dépôt direct et annonces classiques), version
courte (une page pour réseau et candidatures spontanées), version
anglaise si pertinent.

## Sortie

Produire un .docx via le skill docx, en conservant une structure simple
et lisible. Si l'utilisateur veut un format particulier (Europass,
modèle consultant, modèle académique), s'adapter mais respecter les
règles ci-dessus.

Pour le visuel : rester sobre. Pas d'icônes gadgets, pas de barres de
progression "compétence à 85%", pas de photo sauf convention locale
(certains pays attendent encore une photo). L'utilisateur tranche.
