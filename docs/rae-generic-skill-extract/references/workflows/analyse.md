# Workflow /analyse : lire et décoder une offre

Lire d'abord `FACTS.md` (source de vérité sur le candidat) puis le
fichier `preset.md` du profil (éclairage marché construit à l'init
par recherche web). L'analyse doit rester ancrée dans FACTS.md. Si
l'offre cite une technologie ou une exigence absente de FACTS.md, la
placer en "Inconnus" ou en "Lacunes" plutôt qu'en "Forces", même si
le terme apparaît dans preset.md.

## Structure attendue

1. Identification : intitulé du poste, employeur, type de contrat,
   localisation, fourchette salariale si indiquée, date limite. Tout
   élément manquant dans l'offre est signalé.

2. Score de match global sur 10, en deux ou trois phrases. Le score
   est subjectif et documenté : quels critères pondèrent, pourquoi.

3. Tableau Forces / Lacunes / Inconnus en trois colonnes.

   Forces : éléments explicitement présents dans FACTS.md qui répondent
   à l'offre. Citer le fait exact (expérience X, certification Y).

   Lacunes : exigences de l'offre absentes ou présentes à un niveau
   insuffisant. Distinguer lacune bloquante et lacune contournable.

   Inconnus : zones d'ambiguïté dans l'offre ou dans le profil qui
   mériteraient une clarification lors d'un échange avec le recruteur.

4. Cinq à huit éléments du profil à mettre en avant, avec pour chacun
   la référence dans FACTS.md (expérience, projet, certification) et,
   si disponible, le bullet correspondant dans BULLET_LIBRARY.md.

5. Points à préparer pour un entretien : ce qu'un recruteur creuserait
   probablement, en particulier sur les lacunes. Pour chaque point,
   proposer une trame de réponse honnête.

6. Recommandation finale, deux ou trois lignes : postuler, postuler
   après adaptation, passer. Justifier.

## Conseils d'usage

Ne pas survendre. Une technologie "notion" dans FACTS.md ne devient pas
"opérationnelle" parce qu'elle est listée dans l'offre.

Si l'offre est courte, trop marketée, ou écrite en mode "guerre des
talents" sans contenu concret, le dire. Une offre vide est un signal.

Si l'offre contient des éléments contradictoires (junior + senior
expérience requise, salaire sous-marché), le relever.

## Variante

Si l'utilisateur veut juste un avis rapide ("go/no-go"), produire la
version courte : score, trois forces, trois lacunes, recommandation.
Sur demande explicite seulement. Le format complet reste la référence.
