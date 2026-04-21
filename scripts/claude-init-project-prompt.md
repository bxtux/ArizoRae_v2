Gère ceci en utilisant tous les agents recommandés pour ce type de travail (developpement)



L'APP à pour but de permettre à des chercheurs d'emplois de créer un agent personnalisé sur base de l'idée de Cliff Simpkins (voir et analyser tous les fichiers dans dossier docs)


Propose et pose des questions pour améliorer le projet.  Pense à optimise l'économie de token sans jamais perdre en qualité de raisonnement.

Fais un plan détaillé (docs\ROADMAP.MD) et des instructions détaillées pour le développement par Claude Code pour créer la V2 du projet ARIZORAE.

Au moment opportun, créér toute la doc requise, et les fichiers context pour Claude pour une maintenance économique en token du code.

Il y déjà des infos dans .env.

L'infra est un stack docker (avec notamment un reverse proxy, un frontend (le portail), un terminal avec claude cli, gotify, Postgre, ngrok, et ce que tu trouveras utile).  Tous les fichiers Dockers sont stockés dans le dossier "infra"



1 dossier par user dans le dossier "infra/users_datas"
1 scrapper (voir example : job_scraper-example.py) par user





A.Cas typique :

-- Inscription et setup:

1: le user s'inscrit sur le portail (Prénom et email (à valider par le user via mail envoyé dans sa mailbox, système classique, avec reset mot de passe possible))
2: le user fournit : CV et infos relatives à sa recherche emploi (localisation, etc), Claude (claude cli dans container terminal) créé un dossier pour le user, un json contenant les infos fournies par le user et le CV fournit.
3: Avec le CV et les infos L'agent rae-gerneric fais un /INIT (en utilisant opus),  pour créer  BULLET_LIBRARY.md et FACTS.md dans le dossier du user
4: Le skill rae-generic /RECHERCHE (en utilisant opus) fais un , fais un scoring sur chaque offre, propose la liste d'offres au user, lui demande si il a des remarques 
5: Claude Code (en utilisant sonnet) créé un script python pour scrapper les offres en fonction de la liste d'offre et des remarques du user .
6: Claude Code (en utilisant haiku) fait une execution de demo du scrapper et montre le résultat au user, le user peut préciser ses préférences concernant le scrapper (nombres d'offres proposées par scrap, scoring, points éliminatoires etc,)
7: l'agent rae-gerneric (en utilisant sonnet) adapte le scrapper si nécessaire

-- Usage par le user

1: le user se connecte
2: le user clique pour exécuter le scrapper 
3: les offres d'emplois s'affichent, le user peut demander pour chaque offre :
    - Postuler à l'offre : -- 1: l'agent rae-gerneric (sonnet) fais un /ANALYSE sur l'offre et demande au user si il confirme vouloir postuler
                           -- 2: l'agent rae-generic (sonnet) fais un /CV sur l'offre et ensuite demande si il faut une lettre de motivation, si oui, il fait un /LETTRE
                           -- 3: l'agent rae-generic (sonnet) fournit au user le CV et la LETTRE de motivation 
                           -- 4: l'agent rae-generic (haiku) marque l'offre comme "postulation effectuée".  Désormais le scrapper ne la prendra plus en compte et l'offre apparaitra dans la section "postulations effectuées".
                           
   - Marquer l'offre comme "pas intéressé".  Le système demande au user si il veut préciser la raison.  Si oui, l'agent rae-generic (en utilisant sonnet) propose de modifier le scrapper pour ignorer
     les prochaines offres pour les raisons indiquées par le user.  Si le user valide,  l'agent rae-generic (en utilisant sonnet) modifie le scrapper
     
   - Demander la préparation à un entretien d'embauche : l'agent rae-generic fais un /ENTRETIEN (en utilisant opus) .  A la fin, l'agent rae-generic propose une fiche de révision à télécharger pour l'entretien
     
     
    
--- Un chatbot (avatar fourni dans docs/ui-design) présent partout sur le site permet au user de communiquer directement avec le skill rae-generic, il peut lui poser des questions, faire des remarques, demander des adaptations du scrapper ou autres.  cela sera enregistré dans MD dans le dossier du user et traité par le skill rae-generic.

--- Le user peut, via sa page personnelle, activer, désactiver, ou changer la périodicité d'un mail automatique envoyé par l'APP avec les dernières offres d'emploi non postulées
--- Le user peut, via sa page personnelle, demander un rapport sur les offres auquelles il a postulé.
--- Le user peut, via sa page personnelle, voir ses stats (combien d'offres postulées etc)
--- Le user peut, via sa page personnelle, supprimer son compte
--- Le user peut envoyer une demande de support (notification envoyée vers moi par gotify)


