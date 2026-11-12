# E-learning : l'app devient la plateforme du titre ECSR (conception)

Date : 12/11/2026. Statut : **direction validée par Timy le 12/11/2026** (« Oui, c'est déjà une bonne idée. Vas-y, go. ») ;
document complet en attente de sa relecture. Cadrage mené le 12/11 dans la conversation « Brainstormer l'e-learning »,
après la présentation de l'app du matin. Relue le 12/11 par un agent indépendant dans la peau du bâtisseur : ses six
questions sont réglées ici (choix de Claude, § 14) ou posées à Timy ci-dessous. Le dépôt est public : aucune personne
extérieure n'est nommée ici.

## À trancher par Timy (trois questions, avec la recommandation suivie en attendant)

Rien n'est construit tant que ces trois points ne sont pas confirmés ; la spec et le plan du lot 1 sont écrits sur les
recommandations.

1. **Lecture des cours tracée en base : oui ou non ?** Le 12/11, pour la liste des thèmes (spec
   `2026-11-12-progression-themes-design.md`), Timy a écarté le suivi de lecture en base : l'état d'un thème repose sur
   les notes de QCM. Le lot 1 d'ici crée justement ce suivi, pour une autre raison (prouver au centre et aux financeurs
   le travail en autonomie). **Recommandation** : les deux tiennent ensemble. Les états de la ligne (Acquis, À revoir,
   En cours, À commencer) restent décidés par les seuls QCM, et `js/progression-rules.js` n'est pas rouvert. La lecture
   tracée ajoute seulement une marque « Lu » sur le bouton Cours de la ligne (à la place de l'atténuation « ouvert sur
   cet appareil ») et nourrit la fiche « Travail en autonomie » et le relevé.
2. **Sur quelles promos les traces s'allument-elles ?** C'est une nouvelle collecte de données personnelles (lecture,
   temps actif). **Recommandation** : un interrupteur « Travail en autonomie », éteint par défaut, allumé promo par promo
   par le seul fondateur (comme l'émargement) ; d'abord la promo de démonstration, puis Nîmes sur décision de Timy. Aucune trace n'est écrite
   tant que l'interrupteur est éteint ou que le stagiaire n'a pas accepté la nouvelle version des conditions d'utilisation
   (brouillons : `2026-11-12-e-learning-textes-donnees.md`).
3. **« À suivre » et « À relancer » : une liste ou deux ?** La liste « À suivre » existante demande deux difficultés
   sur quatre, et son chiffre sert de preuve au dossier Qualiopi. **Recommandation** : ne pas y toucher. Le décrochage
   (lot 3) forme un groupe distinct « À relancer » sur la même page, où un seul signal suffit ; la relance part de ce
   groupe.

Vocabulaire de ce document :

| Mot | Sens |
|---|---|
| Base | la base de données Supabase de l'app ; ses **règles RLS** (Row Level Security, règles de sécurité par ligne) décident de ce que chaque compte peut lire ou écrire |
| Trace | un fait enregistré en base sur le travail d'un stagiaire : cours ouvert, cours lu, exercice fait, temps actif |
| Temps actif | le temps pendant lequel un écran de travail en autonomie (lecteur de cours, QCM en entraînement, plus tard activité du formateur) est visible **et** le stagiaire a agi (défilement, clic, touche) dans la dernière minute |
| Travail de la semaine | la liste de ce que le formateur demande à sa promo pour une semaine (cours, QCM, scènes, activités), avec une échéance |
| Relance | un message envoyé à un stagiaire qui décroche, depuis l'app, dont l'envoi est gardé en base |
| Relevé de formation | un document PDF par stagiaire qui réunit présence, travail en autonomie, évaluations et relances sur une période |
| FOAD | formation ouverte et à distance : des heures de formation faites hors de la salle, que le centre doit pouvoir prouver |
| CPF, CDC | compte personnel de formation, géré par la Caisse des Dépôts ; ses conditions générales pour les organismes (version de mai 2026) fixent ce que le centre doit prouver pour être payé |

## 1. Intention

Pendant la présentation du 12/11, l'interlocuteur de Timy a vu un fort potentiel e-learning dans l'app. Timy veut
développer cet aspect à fond. Ce qui l'a frappé n'a pas été précisé ; **hypothèse retenue** : l'app contient déjà ce que
les centres ECSR achètent aujourd'hui séparément. Un centre de Nanterre, par exemple, assemble la plateforme e-learning
d'un éditeur, un livret, des classeurs de réglementation et un logiciel de gestion ; l'app réunit tout cela, sur un
contenu vérifié article par article.

La direction choisie : **l'app devient la plateforme e-learning du titre ECSR, comprise dans le prix par stagiaire payé par
le centre.** Ce n'est pas un produit à part, ni une offre vendue au stagiaire (le stagiaire ne paie jamais, et en CPF le
centre n'a pas le droit de lui demander un règlement supplémentaire).

Pourquoi commencer par les traces, et pas par plus de contenu :

- **Le contenu existe**, le suivi individuel non (voir § 2).
- **L'argument commercial n°1 est l'assiduité**, qui protège la recette du centre : en CPF, un stagiaire qui interrompt
  au-dessus de 80 % d'assiduité est payé en entier ; entre 25 % et 80 %, au prorata. Les conditions CDC de mai 2026
  demandent en outre au centre de **tracer de manière probante les jalons pédagogiques et les évaluations formatives**
  et d'**attester d'un système de relance des stagiaires** en cas d'assiduité partielle, faute de quoi il perd l'avance
  de 25 % (source : conditions générales CDC V15, art. 5.1.1, 5.1.2 et 6.3.2, relevées par la session « Repenser le
  modèle économique », rapport « Prix et valeur ECSR Promo » du 11/11).
- **Qualiopi 2026, indicateur 19** : « lorsque des modules pédagogiques sont réalisés à distance, le prestataire
  vérifie l'effectivité de leur suivi par les apprenants » (texte repris dans `js/qualiopi-referentiel.js`).

Un e-learning qui laisse des traces sert donc à la fois le stagiaire (savoir où il en est), le formateur (voir qui
décroche) et le centre (les preuves que les financeurs et l'auditeur Qualiopi demandent).

## 2. Existant (inventaire du 12/11 sur main 545475d5)

| Brique | Ce qui existe | Ce qui manque |
|---|---|---|
| Cours | 57 cours de thème publiés, 36 cours de compétences C1 à C4 en base (aucun publié, Timy publie seul) ; lecteur plein écran avec sommaire, temps de lecture estimé, enchaînement vers le QCM (`js/views/cours-reader.js`) | « Cours ouvert » n'existe que dans le navigateur (`localStorage`, clé `cours-ouverts`) ; la jauge de lecture n'est pas enregistrée ; aucun « cours lu », aucun temps passé en base |
| Exercices des cours | blocs `:::quiz` (ordre, vrai-faux, choix) et `:::cartes` (`js/cours-blocs-rules.js`) ; 15 scènes animées et 17 dessins (`js/catalogue-blocs.js`) | les résultats ne sont pas enregistrés |
| QCM | 65 QCM, entraînement adaptatif (ratées d'abord), « Revoir mes erreurs », examen ouvert par le formateur, seuil 15/20 ; tentatives horodatées dans `qcm_attempts` | c'est la seule trace individuelle existante |
| Progression | `themes_progression` : progression **de la classe** (le formateur coche « thème traité ») | aucune progression individuelle hors note QCM ; une session en cours (« Ajouter la progression sur les cartes des thèmes ») en ajoute une sur les cartes |
| Accueil du stagiaire | cartes Aujourd'hui, À faire (QCM de la semaine, examen ouvert), Prochain rendez-vous | le À faire ne connaît ni cours ni activité |
| Médias | images (bucket `cours-images`), animations | aucune vidéo dans l'app |
| Documents de réalisation | certificat de réalisation et attestation d'assiduité (`js/views/attestations.js`), calculés sur l'émargement **présentiel** | rien sur le travail à distance |
| Qualiopi | indicateur 19 marqué « prouvé » (`js/qualiopi-preuves.js:90`) | **à tort** : aucune lecture de cours n'est tracée (défaut traité à part par la session de coordination) |
| Comptes | un compte stagiaire est rattaché à une fiche, elle-même à une promo, elle-même à un centre (`lieux`) | aucun apprenant possible hors promo |

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

1. Chaque stagiaire voit où il en est de son travail en autonomie, sans rien cocher lui-même.
2. Le formateur dit en un geste ce qu'il attend pour la semaine, et voit qui l'a fait.
3. Un stagiaire qui décroche est repéré tôt, relancé en un geste, et la relance est gardée.
4. Le centre tire en un clic un relevé par stagiaire qui réunit les preuves demandées par les financeurs et Qualiopi.
5. Le formateur peut ajouter ses propres activités (consigne, document, lien vidéo, devoir, classe virtuelle).
6. Si le cadre réglementaire le permet, des heures faites à distance comptent dans l'assiduité et les attestations.

**Non-objectifs (pas dans ce chantier)**

- Ouvrir l'app à d'autres publics : candidats avant l'entrée, enseignants en poste, autres titres (CCS deux-roues,
  groupe lourd), élèves d'auto-école. L'app ne connaît que des stagiaires rattachés à une promo ; à reprendre une fois
  les lots 1 à 4 éprouvés sur une vraie promo.
- Héberger de la vidéo dans l'app (poids, coût de stockage et de trafic) : liens vers un hébergeur seulement.
- Construire un outil de visioconférence : la classe virtuelle est un lien vers l'outil du centre.
- Badges, points, classements.
- Mode hors ligne.

**Anti-objectifs (ce qui ferait échouer le chantier même s'il marche)**

- **Un outil de surveillance.** Le stagiaire voit exactement ce que le formateur voit de lui ; aucun classement entre
  stagiaires n'est affiché ; aucune sanction automatique. La trace est une preuve et une aide, jamais un mouchard.
- **Un verrou.** Rien ne se bloque : pas de cours fermé tant qu'un autre n'est pas lu. Ce sont des adultes en formation.
- **Une case à cocher.** Le stagiaire ne coche jamais « fait » à la main : seul ce que l'app a constaté compte, sinon le
  relevé ne prouve rien.
- **Une chose à deux endroits.** Chaque information vit à un seul endroit (§ 5) ; aucun onglet ne déménage.
- **Promettre la conformité.** On ne dit jamais que l'app rend conforme : c'est le centre qui est certifié et payé.

## 4. Découpage en lots

```
Lot 1 (lecture et temps actif) ──> Lot 2 (travail de la semaine) ──> Lot 3 (décrochage et relances) ──> Lot 4 (relevé)
        │                                   └──> Lot 5 (activités du formateur)
        └──> Lot 1b (exercices et scènes) : quand le premier cours de compétences est publié
Lot 6 (heures à distance) : vérification réglementaire faite le 12/11 (note à part) ; construction après les lots 1 à 4
```

| Lot | En une phrase | Dépend de |
|---|---|---|
| 1. Lecture et temps actif | la base sait quels cours chaque stagiaire a ouverts et lus, et son temps actif | la branche `progression-themes` fusionnée (la marque « Lu » se pose sur sa ligne de thème) ; nouvelle version des conditions d'utilisation |
| 1b. Exercices et scènes | la base sait quels exercices et scènes des cours de compétences sont faits | lot 1 ; publication d'un premier cours de compétences par Timy |
| 2. Travail de la semaine | le formateur fixe le travail de la semaine, le stagiaire le voit dans À faire, coché par les traces | lot 1 |
| 3. Décrochage et relances | signaux d'inactivité et de retard, relance en un geste, relance gardée | lots 1 et 2 ; l'e-mail de relance attend la brique d'envoi de l'espace contact (spec du 09/11) |
| 4. Relevé de formation | PDF par stagiaire et par promo : présence, autonomie, évaluations, relances ; chiffres agrégés du siège | lots 1 à 3 ; machinerie des attestations |
| 5. Activités du formateur | consigne, document, lien vidéo, devoir à rendre et corrigé, classe virtuelle | lot 2 |
| 6. Heures à distance | les heures FOAD comptent, si le cadre le permet | note `2026-11-12-e-learning-heures-a-distance.md` ; lots 1 à 4 |

Chaque lot est mis en ligne seul, avec son entrée Nouveautés, ses parcours du robot (`outils/robot_parcours.py`) et la
mise à jour du guide de l'assistant.

## 5. Où vit chaque chose (une chose, un endroit)

| Information | Seul endroit | Qui la voit |
|---|---|---|
| Cours lu ou non, reprise là où on s'était arrêté | le bouton Cours de la ligne du thème (Cours et QCM > Thèmes) ; l'état coloré de la ligne reste décidé par les QCM | le stagiaire (le sien) |
| Combien de la promo ont lu un cours | la ligne du thème, vue de l'équipe | formateur de la promo |
| Travail de la semaine du stagiaire | carte À faire de l'Accueil | le stagiaire |
| Écrire le travail de la semaine | Cours, vue de l'équipe, bouton « Travail de la semaine » (*choix de Claude* : là où vivent les cours et QCM qu'on y met) | formateur |
| Travail en autonomie d'un stagiaire (temps, cours lus, exercices, QCM, relances) | fiche du stagiaire, section « Travail en autonomie » | formateur de la promo, direction du centre ; le stagiaire voit la même section dans Mon suivi |
| Stagiaires à relancer | groupe « À relancer », sur la page qui porte déjà « À suivre » (tableau de bord du formateur et de la direction) ; « À suivre » garde sa règle | formateur, direction |
| Relevé de formation | à côté des attestations (Émargement > Attestations, renommé « Documents de formation » si l'intitulé ne tient plus) | direction, formateur |
| Chiffres agrégés du réseau (construits au lot 4) | espace siège, sans aucun nom, seuil de 3 stagiaires (même règle que les moyennes EPCF) | siège |

## 6. Lot 1 : lecture et temps actif

**Interrupteur** : réglage « Travail en autonomie » propre à chaque promo, éteint par défaut, allumé par le seul
fondateur dans Paramètres (même patron que l'émargement, `js/emargement-etat.js`).
Aucune trace n'est écrite, et rien de ce lot ne s'affiche, tant que l'interrupteur est éteint pour la promo du stagiaire ou
que le stagiaire n'a pas accepté la version des conditions d'utilisation qui décrit cette collecte (le mécanisme
versionné existe : `accepter_conditions`). La base refuse elle-même l'écriture dans ces deux cas, pas seulement l'écran.

**Ce qui est tracé** (comptes stagiaires seulement : un formateur, la direction, le fondateur ou « Voir en tant que »
n'écrivent jamais de trace) :

- **Cours ouvert** : premier et dernier accès.
- **Cours lu** : la fin du cours a été atteinte (dernière section affichée) **et** le temps actif sur ce cours dépasse
  un plancher. *Choix de Claude* : plancher à 30 % du temps de lecture estimé déjà affiché par le lecteur, pour qu'un
  défilement éclair ne vaille pas lecture. Un cours lu reste lu même si le cours est modifié ensuite.
- **Position de lecture** : la dernière section vue, pour reprendre au bon endroit. La clé `cours-ouverts` du navigateur
  reste en service quand l'interrupteur est éteint.
- **Temps actif** : mesuré sur les écrans de travail en autonomie, c'est-à-dire le lecteur de cours et le QCM en
  entraînement (plus tard les activités du lot 5) ; jamais sur le planning, les notes ou le reste de l'app. Cumulé par
  stagiaire, par jour et par ressource (tel cours, tel QCM). *Choix de Claude* : on n'enregistre pas d'événement à la
  seconde ; l'app cumule en mémoire et écrit au plus toutes les 30 secondes et à la fermeture, en ajoutant au total du
  jour (une ligne par stagiaire, ressource et jour). Le temps d'un examen n'est pas compté ici (il a son chrono).
- **Activité** : est une « activité en autonomie » toute trace de ce lot **ou** une tentative de QCM en entraînement
  (déjà horodatée dans `qcm_attempts`). C'est cette définition que le lot 3 utilise pour l'inactivité.

**Ce que voit le stagiaire** (il est tutoyé, comme partout dans son espace) : sur la ligne du thème, le bouton Cours
porte une marque « Lu » ; à l'ouverture d'un cours commencé, « Reprends où tu en étais ». L'état coloré de la ligne
(branche `progression-themes`) ne change pas : il reste décidé par les QCM. Dans Mon suivi, la section « Travail en
autonomie » montre exactement ce que le formateur voit de lui.

**Ce que voit le formateur** : sur la ligne de chaque thème, « 9 sur 12 l'ont lu » ; sur la fiche d'un stagiaire, la
section « Travail en autonomie » : cours lus sur le total publié, temps actif de la semaine et depuis le début,
entraînements QCM, dernière activité.

**Qualiopi** : quand le lot 1 est allumé pour une promo, l'indicateur 19 peut citer la preuve « lecture des cours et
temps actif par stagiaire ». (Le défaut actuel, indicateur marqué « prouvé » sans trace de lecture, est traité à part par
la session de coordination.)

**Données personnelles** : nouveau traitement à inscrire au registre (`docs/legal/registre_traitements.md`) et à dire
dans les conditions d'utilisation (finalité : suivi pédagogique et preuve de réalisation ; destinataires : formateurs
de la promo, direction du centre ; durée : celle déjà fixée pour les données de formation). Brouillons des deux textes :
`2026-11-12-e-learning-textes-donnees.md`. Le relevé PDF (lot 4) est la pièce que le centre archive lui-même pour ses
contrôles (5 ans en CPF).

**Règles de sécurité** : un stagiaire écrit et lit ses seules traces ; un formateur lit celles de sa promo ; la
direction celles de son centre ; le siège n'a que des agrégats sans nom (lot 4).

### Lot 1b : exercices et scènes (plus tard)

Les blocs `:::quiz`, `:::cartes` et les scènes animées n'existent que dans les 36 cours de compétences, dont aucun n'est
publié : les tracer aujourd'hui ne montrerait rien à personne. Le lot 1b se construit quand Timy a publié un premier
cours de compétences. Il demande de donner à chaque bloc un **identifiant stable** (aujourd'hui un bloc n'est repéré que
par sa place dans le texte, `js/cours-blocs-rules.js`), posé par l'éditeur à la création du bloc et conservé quand le
bloc est déplacé ou retouché ; un exercice fait reste fait tant que son identifiant existe. Traces : exercice fait,
réussi ou non au premier essai ; scène jouée jusqu'au bout.

## 7. Lot 2 : travail de la semaine

- Le formateur ouvre « Travail de la semaine » pour sa promo et une semaine donnée, puis ajoute des éléments : un cours,
  un QCM (en entraînement), une activité du formateur (lot 5), et après le lot 1b une scène ou un exercice de cours. Il fixe une
  échéance (par défaut le vendredi de la semaine, *choix de Claude*).
- **Proposition automatique** (*choix de Claude*) : si le planning de la semaine porte des thèmes (sujets de passage au
  tableau, cours en salle), l'app propose les cours et QCM de ces thèmes ; le formateur valide en un geste ou retouche.
  Si le planning ne relie pas ses sujets à un numéro de thème, la proposition est sautée et le formateur choisit à la main.
- Le stagiaire voit ce travail dans la carte **À faire** de l'Accueil, avec l'échéance. Un élément se coche **tout seul**
  quand la trace existe (cours lu, QCM tenté en entraînement). Aucune case à cocher manuelle.
- Le formateur voit, pour chaque élément, combien l'ont fait, et qui ne l'a pas fait.
- Rien ne se verrouille, rien n'est noté : le travail de la semaine n'entre pas dans les notes.

## 8. Lot 3 : décrochage et relances

**Signaux de décrochage** (réglables par le centre, valeurs par défaut *choix de Claude*) ; **un seul suffit** :

- aucune activité en autonomie (définition du § 6) depuis 7 jours ;
- travail de la semaine non fait à l'échéance.

Ils forment un groupe **« À relancer »**, sur la page qui porte déjà « À suivre ». La liste « À suivre » existante
(`js/centre-stats.js` : au moins deux difficultés parmi quatre, dont « aucun entraînement QCM depuis 14 jours ») **ne
change pas** : son chiffre est affiché ailleurs et cité comme preuve par le dossier Qualiopi. Un stagiaire peut figurer
dans les deux groupes. Aucune nouvelle page.

**Relance** : depuis la ligne d'un stagiaire à relancer, le formateur ou la direction envoie une relance en un geste,
avec un message type modifiable. La base garde qui a relancé, quand, pour quel motif, et quand le stagiaire l'a lue.

- **Dans l'app d'abord** : la relance s'affiche sur l'Accueil du stagiaire (carte À faire) jusqu'à ce qu'il l'ait lue.
  Ce lot ne construit **aucun envoi d'e-mail** : aujourd'hui aucune fonction de l'app n'envoie d'e-mail libre (Resend ne
  sert qu'aux e-mails de compte de Supabase), et l'espace contact (spec `2026-11-09-espace-contact-design.md`) prévoit
  justement cette brique.
- **Par e-mail ensuite** : quand l'espace contact est construit, la relance devient un type de demande de cet espace
  (un seul fil par stagiaire) et part aussi par e-mail. Si l'espace contact est en ligne avant ce lot, on part
  directement de lui.
- *Choix de Claude* : relance **envoyée par une personne** ; pas d'envoi automatique dans ce lot.

## 9. Lot 4 : relevé de formation

- Un PDF par stagiaire, ou pour toute la promo, sur une période au choix (toute la formation ou un mois), tiré avec la
  même machinerie que les attestations.
- Contenu : présence (émargement), travail en autonomie (temps actif, cours lus, exercices), évaluations formatives
  (QCM en entraînement), évaluations sommatives (examens QCM, examens blancs, notes), travail de la semaine fait et non
  fait, relances envoyées.
- Intitulé : « Relevé de formation ». Ce n'est ni un certificat ni une attestation officielle ; il ne reprend aucun
  modèle d'administration.
- Le dossier Qualiopi le cite comme preuve de l'indicateur 19 et du suivi des stagiaires.

- **Siège** : ce lot construit aussi les chiffres agrégés du réseau (part des stagiaires actifs dans la semaine, part
  du travail de la semaine fait, relances), sans aucun nom, avec le seuil de 3 stagiaires.

## 10. Lot 5 : activités du formateur

Types d'activité, créées par un formateur pour sa promo :

| Type | Ce que fait le stagiaire | Trace |
|---|---|---|
| Consigne | lit un texte | ouverte |
| Document | ouvre un PDF déposé par le formateur | ouvert |
| Lien vidéo ou site | ouvre le lien (YouTube, Vimeo, site d'un éditeur) | ouvert |
| Devoir à rendre | rend un texte ou un fichier ; le formateur corrige et commente | rendu, corrigé |
| Classe virtuelle | rejoint un lien de visio à une date et une heure | lien ouvert ; la présence réelle se note à l'émargement si ces heures comptent (lot 6) |

- Une activité peut entrer dans le travail de la semaine (lot 2).
- Fichiers : nouveau dossier de stockage, taille limitée (*choix de Claude* : 20 Mo par fichier), types PDF et images
  pour les documents, PDF, images et texte pour les devoirs. Les devoirs rendus sont des données personnelles : registre
  et durée de conservation comme les autres données de formation.
- Partage entre les promos d'un même centre : plus tard (bibliothèque du centre), pas dans ce lot.

## 11. Lot 6 : heures à distance

**Vérification réglementaire faite le 12/11** : note `2026-11-12-e-learning-heures-a-distance.md` (sources officielles
citées, articles validés par l'API Légifrance PISTE). Ce qu'elle établit :

- **Permis sous conditions, pas interdit.** Le Code du travail autorise toute formation en tout ou partie à distance ;
  aucun texte propre au titre ECSR ne l'interdit ni ne le plafonne. Mais rien ne l'autorise expressément : l'agrément
  préfectoral du centre repose sur un local, un programme et un calendrier déclarés, et le programme actuel du réseau
  dit « formation en présentiel ».
- **Le temps de connexion seul ne prouve rien.** À distance, trois obligations : une assistance technique et
  pédagogique, une durée moyenne annoncée d'avance pour chaque activité, des évaluations qui jalonnent le parcours.
- **Les financeurs raisonnent par jalons** (travaux rendus, évaluations) et veulent la répartition entre présentiel et
  distance ; ils demandent aussi la trace des relances.

**Ce que cela change dès les lots 2 à 5** (sans attendre le lot 6) : chaque élément du travail de la semaine porte une
**durée estimée**, fixée par le formateur et affichée au stagiaire (pour un cours : le temps de lecture estimé, proposé
par défaut) ; le relevé de formation (lot 4) présente les **jalons** (QCM, devoirs) avant le temps actif ; les relances
(lot 3) sont une preuve d'accompagnement. Ces lots produisent ainsi les pièces qu'un centre devrait fournir s'il
passait un jour une partie des heures à distance.

**Le lot 6 lui-même ne se construit que si un centre le demande**, après trois confirmations que seuls le centre et
l'administration peuvent donner : la préfecture (une part des 910 heures peut-elle se faire hors du local agréé ?), la
DREETS, direction régionale chargée du travail (comment convertir le travail en autonomie en heures ?), et la direction
du réseau (qui modifie le programme et les conventions ?). Il apporterait alors : des créneaux « à distance » au
planning, le taux de distance repris dans les documents, une attestation d'assiduité et un certificat de réalisation
qui distinguent présentiel et distance, un relevé de connexion exportable gardé 5 ans, un compte observateur pour
l'auditeur. Sans cette demande, les lots 1 à 5 gardent toute leur valeur (travail personnel en plus des heures en centre).

## 12. Mesures de réussite

Mesurées sur la première vraie promo qui l'utilise, et reprises dans le bilan du pilote commercial :

- part des stagiaires avec au moins une trace par semaine ;
- part du travail de la semaine fait à l'échéance ;
- nombre de relances envoyées, et part des stagiaires relancés qui reprennent une activité dans les 7 jours ;
- temps du formateur pour fixer le travail de la semaine (cible : moins de 2 minutes avec la proposition automatique) ;
- indicateur 19 du dossier Qualiopi « prouvé » avec une preuve réelle.

## 13. Ce qui est laissé au bâtisseur

- Les noms des tables et des colonnes, la forme exacte des écritures groupées du temps actif.
- Le dessin des cartes et des sections, dans la DA de l'app (référence `docs/direction-artistique.md`) et le
  référentiel qualité (`docs/qualite/referentiel.md`) ; maquettes à montrer à Timy avant la construction de chaque lot
  qui change un écran.
- L'ordre de construction à l'intérieur d'un lot, les plans (un plan par lot, `docs/superpowers/plans/`).

## 14. Décisions

| Décision | Par | Quand |
|---|---|---|
| Direction : l'app devient la plateforme e-learning du titre ECSR, comprise dans le prix par stagiaire, en commençant par les traces | Timy | 12/11 |
| Découpage en six lots, dans l'ordre du § 4 | Timy (validé avec la direction) | 12/11 |
| Plancher de lecture à 30 % du temps estimé ; écriture du temps actif toutes les 30 s ; échéance par défaut le vendredi ; proposition automatique depuis le planning ; signaux à 7 jours ; 20 Mo par fichier ; emplacements du § 5 | Claude, à relire par Timy | 12/11 |
| Après la relecture du bâtisseur : temps actif mesuré sur le lecteur de cours et le QCM en entraînement, par ressource ; exercices et scènes reportés au lot 1b avec un identifiant stable par bloc ; relance dans l'app d'abord, e-mail par la brique de l'espace contact ; relance toujours envoyée par une personne ; chiffres du siège au lot 4 | Claude, à relire par Timy | 12/11 |
| Lecture tracée sans toucher aux états de la ligne de thème ; interrupteur éteint par défaut, promo de démonstration d'abord ; « À relancer » distinct de « À suivre » | recommandations de Claude, **à trancher par Timy** (tête de document) | 12/11 |
