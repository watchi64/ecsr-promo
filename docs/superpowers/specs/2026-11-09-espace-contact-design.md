# Espace contact et demandes (conception)

Date : 09/11/2026. Statut : **validée par Timy le 09/11/2026** (« Je valide »). Relue par un agent indépendant dans la peau du bâtisseur (09/11) :
ses six questions sont réglées ici (choix de Claude, § 16, ou décision de Timy, § 7.2). Cadrage mené le 09/11 au soir dans la conversation
« Cadrer l'espace contact et la messagerie », une question à la fois, avec quatre maquettes de téléphone montrées
(widget de la conversation). La construction vient **après la fusion du lot 5** de la refonte (espaces direction et
siège), qui touche les mêmes tables de rôles, et s'appuie sur la spec des titres
(`2026-11-09-titres-droits-design.md`, validée le 09/11).

Les noms de personnes de ce document (Sophie, Claire, Karim, Lina) sont fictifs : le dépôt est public.

Vocabulaire de ce document :

| Mot | Sens |
|---|---|
| Base | la base de données Supabase de l'app ; ses **règles RLS** (Row Level Security, règles de sécurité par ligne) décident de ce que chaque compte peut lire ou écrire |
| Centre | un lieu de formation (`lieux`) ; il porte une ou plusieurs promos |
| Équipe | les personnes du centre qui ne sont pas stagiaires : formateurs, direction, secrétariat..., **avec ou sans compte** dans l'app |
| Fiche de contact | la carte d'une personne de l'équipe dans l'annuaire du centre |
| Demande | un échange qui a un sujet, un type et un état (une absence, un retard, une question...), à la place d'un fil de discussion sans fin |
| Destinataire principal | la personne qui doit traiter la demande ; choisie par l'app, jamais décochable |
| Envoi annexe | une personne seulement prévenue (formateurs du jour, délégué) ; décochable par le stagiaire |
| Délégué | le stagiaire élu par sa promo pour la représenter (un titulaire, un suppléant au plus) |
| Financement | ce qui paie la formation d'un stagiaire (CPF, Région, contrat de professionnalisation...) ; il décide qui, au centre, s'occupe de son dossier |
| Resend | le service qui envoie déjà les e-mails du compte (invitation, mot de passe oublié) depuis `timy-studio.fr` |

## 1. Intention

Demande de Timy (09/11, soir) : un **espace contact propre**, avec nom, prénom, téléphone et surtout e-mail ; le rôle de
chaque personne et **dans quelles conditions la contacter** ; un moyen **solide, « pas cheap »** de se joindre, utile
surtout pour les **absences** : messagerie interne, ou formulaire qui envoie directement un e-mail.

Ce qui coince aujourd'hui (récit de Timy) : un stagiaire absent écrit au délégué sur WhatsApp, puis envoie un e-mail,
tantôt à une personne, tantôt à une autre, parce que l'une ou l'autre est en congé. **On ne sait jamais vraiment à qui
écrire, et on n'a jamais de retour** : personne ne sait si le message a été reçu, ni s'il a été pris en compte.

Ce que Timy veut en plus : prévenir d'une absence **à l'avance** (un rendez-vous dans une semaine, de telle heure à
telle heure) ; **savoir que c'est lu, puis pris en compte** ; des **réponses toutes faites** côté équipe pour ne pas
avoir à écrire ; **une seule trace**, au lieu de messages éparpillés ; une absence qui **s'inscrit d'elle-même** là où
elle compte (planning, émargement) ; une meilleure communication entre stagiaires et équipe, et entre membres de
l'équipe. Toujours : efficace, facile, pratique, sur téléphone d'abord.

## 2. Ce qui existe aujourd'hui (constats du 09/11, main 982658f)

- **Contacts du centre** : une section de la page Documents (`js/views/ressources.js`), ouverte aussi par le menu du
  compte et l'accueil du stagiaire. Trois fiches à Nîmes : prénom, rôle en texte libre (dont un rôle qui sert de note :
  « si X et Y indisponibles »), téléphone. Aucune n'a d'e-mail.
- **Table `contacts`** : ni centre ni promo. Lue par tout compte connecté, **écrite par toute équipe de tout centre**
  (`equipe_courante()`, lot 4). La spec des titres (§ 5.6, § 13) la laisse aux titres fixes Formateur et Direction de
  centre en attendant cette spec.
- **Aucun téléphone** n'est enregistré pour un stagiaire ni pour un formateur. Le compte porte l'adresse e-mail
  (`user_profiles.email`), la fiche stagiaire le prénom et le nom.
- **Lecture des profils** (`user_profiles_lecture`, lot 4) : un stagiaire peut lire, par la base, le profil des autres
  stagiaires de sa promo, **adresse e-mail comprise**, et celui du personnel. L'app ne les affiche pas, mais la base les
  donne.
- **Absences** : un stagiaire ne peut rien déclarer dans l'app. L'équipe note les absences de dernière minute au planning
  (colonne `absences` des cartes, refonte du 19/07 : une absence de dernière minute consomme un passage, une absence
  prévenue tôt est un simple échange, au jugement du formateur) et sur les feuilles d'émargement (`absence_origine` :
  `formateur`, `planning`, `non_signe`), qui reprennent les absences du planning.
- **E-mails** : seuls les e-mails du compte partent, par le SMTP de Supabase branché sur Resend
  (`no-reply@timy-studio.fr`, nom « Promo ECSR »). Aucune fonction serveur n'envoie d'e-mail applicatif. La clé Resend
  actuelle est réservée au SMTP.
- **Notifications** : l'app s'installe sur le téléphone (PWA), mais sans service worker : elle ne sait pas envoyer de
  notification.
- **Conditions d'utilisation** (version 2026-11-08) : le profil collecté est nom, prénom, e-mail, rôle, promo, date de
  naissance ; ni téléphone, ni financement, ni message. Les absences sont déjà visibles des autres stagiaires de la
  promo (par le planning). Resend y figure pour « les e-mails du compte » seulement.

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
1. Un stagiaire prévient d'une absence en moins d'une minute sur son téléphone, sans se demander à qui écrire.
2. Il sait à qui c'est parti, puis que c'est lu, puis que c'est pris en compte, par qui et quand.
3. La bonne personne est prévenue même si elle n'a pas de compte, et même si la titulaire est en congé.
4. L'équipe répond en un geste (réponses toutes faites), depuis l'app ou depuis l'e-mail.
5. L'absence annoncée apparaît d'elle-même au planning et sur la feuille d'émargement.
6. Un annuaire clair du centre : qui est qui, pour quoi le joindre, quand, comment.
7. Une seule trace des échanges entre stagiaires et équipe, et entre membres de l'équipe.

**Non-objectifs (pour plus tard)** : annonces de l'équipe à toute la promo ; photos et pièces jointes dans les messages ;
notifications sur le téléphone ; réponse par simple « Répondre » dans sa messagerie (e-mail entrant).

**Anti-objectifs (ce qui ferait échouer le projet même s'il marche)**
- **Un WhatsApp interne** : conversations sans fin, sans sujet ni état, que personne ne traite.
- **Des stagiaires qui s'écrivent entre eux** dans l'app (décision de Timy : éviter le harcèlement et les comportements
  malveillants).
- **Des données de santé dans l'app** : certificat médical, arrêt de travail, description d'une maladie.
- **Un doublon** : déclarer dans l'app puis devoir refaire la démarche ailleurs.
- **Des messages perdus** : un e-mail qui ne part pas sans que personne ne le sache.

## 4. Le principe

**L'app garde la trace, l'e-mail prévient** (décision de Timy, 09/11 : « par l'app et par mail, les deux »).
- Tout vit dans l'app : la demande, ses destinataires, ses réponses, ses états.
- Chaque nouvel événement part aussi par e-mail, avec des boutons d'action et un lien vers la demande. L'e-mail est le
  seul canal d'alerte fiable tant que l'app n'envoie pas de notification.

**On écrit au centre, pas à une personne.** Le stagiaire n'a pas à choisir : l'app choisit le destinataire principal
selon le type de demande et son financement (règles du centre, § 6), lui montre à qui c'est parti, et passe au relais si
la personne est en congé.

## 5. L'annuaire (page Contacts)

### 5.1 Ce que voit chacun

| Qui regarde | Ce qu'il voit |
|---|---|
| Un stagiaire | **L'équipe de son centre** : nom, prénom, titre, « pour quoi me joindre », « quand me joindre », téléphone professionnel, e-mail. **Les stagiaires de sa promo** : prénom, nom, mention « délégué » ou « suppléant ». Jamais leur téléphone ni leur e-mail. |
| L'équipe (avec compte) | L'équipe de son centre, comme ci-dessus. Les stagiaires **avec téléphone, e-mail et financement** : seulement sur la portée où son titre a la page Stagiaires au moins sur « Voir » (ses promos pour un titre de promo, tout le centre pour un titre de centre), comme le dit déjà la spec des titres (§ 5.2 : « fiches (identité, coordonnées, passages) »). Sans cette case, elle voit les stagiaires comme un stagiaire les voit (noms, délégués). |
| Le siège | Rien de nominatif (règle du lot 4). |
| Le fondateur | Comme une direction, sur le centre affiché. |

Décisions de Timy (09/11) : le téléphone d'un stagiaire n'est visible **que de l'équipe** ; les numéros de l'équipe sont
**professionnels, donc visibles** des stagiaires du centre. Choix de Claude : l'e-mail d'un stagiaire suit la même règle
que son téléphone.

### 5.2 Les fiches de l'équipe

Une fiche par personne et par centre, **avec ou sans compte** :

| Champ | Avec compte | Sans compte |
|---|---|---|
| Nom, prénom | du compte et de sa fiche | saisis |
| Titre | **les titres de la personne** (spec des titres : « Secrétariat », « Formateur · 2 promos »...) ; repli sur le rôle du lot 4 si les titres ne sont pas encore construits | **libellé libre**, les titres du centre proposés en suggestion (spec des titres, § 13) |
| E-mail affiché | « E-mail professionnel », proposé à partir de celui du compte, montré seulement une fois la fiche vérifiée par la personne (voir dessous) ; les alertes partent toujours à l'adresse du compte | saisi (indispensable pour recevoir des demandes) |
| Téléphone professionnel | facultatif | facultatif |
| Pour quoi me joindre | court texte (ex. « CPF et Région ») | idem |
| Quand me joindre | court texte (ex. « du lundi au jeudi, 9 h à 17 h ») | idem |
| Relais en cas d'absence | une personne de l'équipe du centre (§ 6.3) | idem |

Le champ s'appelle « Téléphone professionnel », pour qu'on n'y mette pas un numéro personnel par erreur. Les textes
courts sont limités (environ 80 caractères) : ce sont des repères, pas des notes.

**Fiche d'office pour chaque compte de l'équipe** (choix de Claude) : tout compte qui a une affectation dans le centre
(formateur, direction, titre de centre ou de promo) y a sa fiche, créée d'office. Tant que la personne ne l'a pas
vérifiée (« Vérifie ta fiche de contact », à sa prochaine ouverture), la fiche ne montre aux stagiaires que le nom, le
titre et le bouton « Écrire » : l'adresse du compte, parfois personnelle, n'est jamais exposée sans son accord.

**Lien avec les formateurs du planning** (choix de Claude) : le planning désigne ses formateurs par la table `profs`
(un nom, commun au réseau). Une fiche de l'équipe peut se rattacher à une ligne de `profs` ; c'est par ce rattachement
que l'app trouve « les formateurs du jour » et leur adresse. Un compte relié à `profs` (`user_profiles.prof_id`) est
rattaché d'office ; une fiche sans compte se rattache à la main. Le plan ne remplace pas `profs` (planning,
émargement et évaluations s'y appuient). Un formateur du jour sans fiche rattachée, ou saisi en texte libre au planning
(formateur externe), n'est pas prévenu : la demande le dit (« Karim n'a pas pu être prévenu »). Le nom et le prénom
d'un compte sans ligne `profs` (une direction, par exemple) viennent de sa fiche.

**Qui écrit les fiches** (choix de Claude) : chacun la sienne (téléphone, pour quoi, quand, relais) ; les fiches sans
compte et l'ordre d'affichage, les titres fixes Formateur et Direction de centre du centre (comme aujourd'hui, mais
limités à leur centre) et le fondateur. Les trois fiches actuelles de `contacts` deviennent des fiches sans compte du
centre de Nîmes, sans rien perdre (la note « si X et Y indisponibles » devient un relais, § 6.3, quand l'équipe l'aura
réglé ; d'ici là elle reste lisible dans « Pour quoi me joindre »).

### 5.3 Ce que l'équipe saisit sur la fiche d'un stagiaire

- **Téléphone** : saisi par le stagiaire lui-même (Mes préférences), facultatif ; modifiable aussi par l'équipe.
- **Financement** : choisi par l'équipe dans la liste du centre (§ 6.1). Il sert au routage ; le stagiaire le voit sur
  sa fiche, les autres stagiaires jamais.
- **Délégué** : l'équipe coche « délégué » ou « suppléant » (au plus un de chaque par promo).

Ces trois gestes relèvent de la page Stagiaires sur « Modifier » (spec des titres, § 5.1 et 5.2).

## 6. Qui reçoit quoi

### 6.1 Les règles du centre

Dans les **Réglages du centre** (spec des titres, § 5.2 : case « Réglages du centre » sur « Modifier »), une liste
« Qui reçoit quoi » :

| Type de demande | Selon | Destinataire principal |
|---|---|---|
| Absence | financement du stagiaire | une fiche de l'équipe par financement (ex. CPF et Région : Sophie ; contrat de professionnalisation : une autre) |
| Retard | (aucun) | les formateurs du jour (choix de Claude ; réglable) ; s'il n'y en a aucun de joignable (planning pas fait, formateur sans fiche rattachée), la personne par défaut |
| Question administrative | financement du stagiaire | comme l'absence |
| Document | financement du stagiaire | comme l'absence |
| Autre | (aucun) | une personne par défaut |

- **Liste des financements** : livrée d'office (CPF, Région, France Travail, contrat de professionnalisation, entreprise,
  personnel, autre), ajustable par le centre.
- **Personne par défaut** : reçoit tout ce qu'aucune règle ne couvre (financement non renseigné, type sans règle).
- **Tant que rien n'est réglé** (cas de Nîmes au départ, sans compte de direction) : les demandes vont aux formateurs de
  la promo, et l'écran des règles le dit (choix de Claude).

### 6.2 Les envois annexes d'une absence

- **Les formateurs du jour** : ceux que le planning de la promo met sur la ou les demi-journées concernées (décision de
  Timy). Ils voient le motif (choix de Claude, accepté dans le récapitulatif du 09/11).
- **Le délégué** (et le suppléant) : prévenu de l'absence, **sans le motif ni le mot** (décision de Timy). Il ne reçoit
  rien pour les autres types de demandes.
- **Le stagiaire peut décocher les envois annexes** (décision de Timy, 09/11). Le destinataire principal ne se décoche
  pas. Décocher retire l'alerte, pas l'information : l'absence apparaît quand même au planning et sur la feuille
  d'émargement, et l'encadré le dit (« Ils ne seront pas prévenus, mais l'absence apparaîtra au planning »).
- Si le planning du jour n'est pas encore fait, il n'y a pas de formateur à prévenir : l'absence attend et apparaît au
  formateur qui construit la semaine (§ 8.3).

### 6.3 Le relais en cas de congé

Une personne de l'équipe indique « absente du ... au ... » (sur sa fiche, en un geste). Pendant ce temps, ses nouvelles
demandes partent à son **relais** (une fiche de l'équipe du centre), et le stagiaire voit le nom de la personne qui reçoit
vraiment (« Envoyé à Claire, relais de Sophie jusqu'au 15 »). Une fiche sans compte a son congé et son relais réglés par
ceux qui écrivent les fiches sans compte. Sans relais réglé, la demande va à la personne par défaut. Les demandes déjà
ouvertes ne changent pas de main (choix de Claude).

## 7. Les demandes

### 7.1 Qui écrit à qui

| De | Vers | Permis |
|---|---|---|
| Stagiaire | le centre (routage du § 6) | oui |
| Stagiaire | un membre précis de l'équipe (bouton « Écrire » de sa fiche) | oui |
| Stagiaire | un autre stagiaire | **non** (décision de Timy) |
| Membre de l'équipe | un stagiaire du centre | oui (ex. « pense à remettre ton justificatif ») |
| Membre de l'équipe | un collègue du centre | oui |
| Siège, fondateur | | comme un membre de l'équipe du centre affiché, s'ils y ont une fiche |

Types d'une demande d'un stagiaire : **Absence, Retard, Question administrative, Document, Autre**. Une demande de
l'équipe n'a pas de type (sujet libre).

### 7.2 Les états

| État | Quand |
|---|---|
| Envoyée | à la création |
| Lue | un destinataire principal l'a ouverte **dans l'app** (avec son nom et l'heure) |
| Prise en compte | un destinataire principal a touché « Pris en compte » ou une réponse toute faite qui la vaut |
| Annulée | l'auteur l'a annulée (§ 8.5) |

Le stagiaire voit chaque étape avec le nom et l'heure (maquette 3). **« Lue » n'existe que pour une lecture dans l'app** :
aucun pixel espion dans les e-mails (les conditions d'utilisation excluent tout traceur, et ces pixels sont peu
fiables). Pour une personne sans compte, la demande passe donc d'« Envoyée » à « Prise en compte ».

Chaque réponse (texte ou réponse toute faite) s'ajoute à la demande ; l'auteur et les destinataires peuvent répondre.
**Une personne sans compte n'agit que par les boutons** de l'e-mail (réponses toutes faites, « Pris en compte »,
« Justificatif reçu ») ; pour écrire une réponse libre, elle a un compte (décision de Timy, 09/11 : « Boutons et
compte »), typiquement avec le titre Secrétariat de la spec des titres. Ainsi toute réponse écrite vient d'une personne
connectée, sous son nom, et un e-mail transféré ne permet jamais d'écrire au nom de quelqu'un.
Une demande prise en compte reste ouverte aux réponses ; elle se range dans « Terminées » après sept jours sans
échange (choix de Claude).

### 7.3 Les réponses toutes faites

Réglées par centre (Réglages du centre), livrées d'office : « Bien reçu », « Absence enregistrée », « Absence enregistrée,
pense à remettre ton justificatif », « Merci de passer au secrétariat ». Chacune dit si elle vaut « Pris en compte »
(toutes, sauf indication contraire). Elles apparaissent en boutons dans l'app et dans l'e-mail.

### 7.4 Qui lit une demande

L'auteur, ses destinataires (principal et annexes), et **la direction du centre** (pour la continuité si quelqu'un s'en
va). Ni le siège, ni le fondateur, sauf s'ils sont destinataires (choix de Claude, accepté dans le récapitulatif du
09/11). « La direction » s'entend ici du **seul titre fixe Direction de centre** (choix de Claude) : un titre de centre
du catalogue (Secrétariat, Ressources humaines, Responsable pédagogique...) ne lit que les demandes dont il est
destinataire, jamais les motifs des autres. Le délégué ne lit que sa version de l'avis : nom du stagiaire, jour et demi-journée, rien d'autre. **La base
l'applique elle-même** : un délégué ne peut techniquement pas lire le motif.

## 8. L'absence, de bout en bout

### 8.1 Le formulaire (maquette 2)

Ouvert par le bouton **« Prévenir d'une absence »** de l'accueil du stagiaire et de la page Contacts :
- **Quel jour** : Aujourd'hui, Demain, ou un jour choisi (aujourd'hui et à venir seulement ; une absence passée se
  règle avec l'équipe, choix de Claude). Plusieurs jours de suite possibles (du ... au ...).
- **Quand** : Journée, Matin, Après-midi, ou de telle heure à telle heure.
- **Motif** : Santé, Transport, Démarche, Famille, Autre. Aucune précision médicale demandée ; aucun champ pour décrire
  une maladie.
- **Un mot** facultatif (court).
- **Encadré « Sera envoyé à »** : le destinataire principal (sans case), les formateurs du jour et le délégué (avec
  case, cochés d'office), la phrase du § 6.2 quand une case est décochée.
- **Envoyer**, puis l'écran de suivi.

### 8.2 Le justificatif (décision de Timy, 09/11)

**Aucun document ne passe par l'app.** Sur la demande, un bouton **« Envoyer mon justificatif »** ouvre la messagerie du
téléphone avec un e-mail déjà rempli (lien `mailto:`) : le destinataire principal, l'objet « Justificatif : absence du
jeudi 14 novembre, matin », deux lignes de texte. Le stagiaire joint la photo de son arrêt et envoie : le document va de
sa boîte à celle du centre, comme aujourd'hui, sans passer par l'app.

L'état du justificatif : **« à remettre »** (posé par le destinataire, ou par la réponse toute faite qui le demande) puis
**« reçu »** (touché par l'équipe, dans l'app ou depuis l'e-mail). Tant qu'il est « à remettre », l'accueil du stagiaire
le rappelle (dans l'app, pas par e-mail répété).

Pourquoi ce détour plutôt qu'une pièce jointe (raison à garder) : un arrêt maladie est une donnée de santé, la catégorie
la plus protégée du RGPD ; la stocker demanderait un stockage fermé, un effacement automatique, une nouvelle version des
conditions et probablement une analyse d'impact, pour le gain d'un seul geste. Le circuit légal (Assurance maladie,
financeur) reste celui du centre.

### 8.3 Le planning

- Une absence envoyée apparaît au planning de sa demi-journée, pour l'équipe : le stagiaire est marqué « absent,
  prévenu » au moment de le placer, et sur sa carte s'il y est déjà placé. Les autres stagiaires voient « absent », sans
  motif (les absences leur sont déjà visibles aujourd'hui).
- **Le formateur décide comme aujourd'hui** : remplacer ou non, compter ou non le passage (règle du 19/07 : une absence
  prévenue tôt est un simple échange). L'app ne change aucun passage d'elle-même.
- Une absence annulée disparaît du planning.

### 8.4 L'émargement

À l'ouverture ou à la clôture de la feuille d'une demi-journée, un stagiaire qui a une absence annoncée pour elle est
pré-marqué absent, avec une nouvelle origine (« annoncée ») et l'observation « Absence prévenue » ; « Absence justifiée »
quand le justificatif est reçu. Le formateur peut toujours corriger (le stagiaire vient finalement, par exemple), comme
pour les absences reprises du planning.

**Absence de quelques heures** (« de telle heure à telle heure », choix de Claude) : le planning et l'émargement ne
connaissent que des demi-journées, et un stagiaire marqué absent ne peut plus signer. Une absence qui ne couvre pas toute
la demi-journée n'est donc **pas pré-marquée** : la feuille porte seulement l'observation « Absent de 10 h à 11 h,
prévenu », et le stagiaire signe à son arrivée, comme aujourd'hui pour un retard. Le planning l'affiche de même
(« absent de 10 h à 11 h ») sans retirer le stagiaire de sa place. Aucune présence partielle n'est ajoutée à
l'émargement ni aux attestations. Seules Journée, Matin et Après-midi pré-marquent l'absence ; une absence de
plusieurs jours pré-marque chacune de ses demi-journées.

### 8.5 Annuler ou changer

Le stagiaire peut annuler son absence tant que la demi-journée n'a pas commencé ; ses destinataires sont prévenus
(« Absence annulée »). Pour la changer, il l'annule et en déclare une autre. Après le début de la demi-journée, seule
l'équipe la corrige (choix de Claude).

## 9. Les e-mails

- **Expéditeur** : « Promo ECSR » `<no-reply@timy-studio.fr>`, comme les e-mails du compte. Pas d'adresse de réponse
  utile : le bas de chaque e-mail dit « Les réponses passent par ces boutons ou par l'app, pour garder la trace. »
- **Qui reçoit quoi** :
  - destinataire principal : chaque nouvelle demande, chaque réponse du stagiaire, chaque annulation ;
  - envoi annexe : l'avis d'absence et son annulation ;
  - stagiaire : la prise en compte, chaque réponse, le justificatif reçu.
  Chaque personne qui a un compte peut couper ses alertes par e-mail dans Mes préférences (choix de Claude) ; une
  personne sans compte les reçoit toujours.
- **Contenu minimal** (choix de Claude, écart avec la maquette 4 qui montrait le motif) : l'e-mail porte le type, le nom
  du stagiaire, le jour et la demi-journée, mais **ni le motif ni le texte libre**. Resend est un prestataire situé aux
  États-Unis : moins il voit, mieux c'est. Le motif et le mot se lisent dans l'app, ou sur la page ouverte par le lien.
- **Boutons d'action** : « Pris en compte », les réponses toutes faites, « Justificatif reçu », « Ouvrir la demande ».
  Chacun est un lien signé, propre à ce destinataire, cette demande et cette action, valable 14 jours. **Le lien ouvre
  une page qui demande un toucher de confirmation** : les filtres de messagerie d'entreprise ouvrent tout seuls les
  liens pour les analyser, et une action déclenchée à l'ouverture se ferait dans le dos de la personne. Cette page
  montre la demande entière (motif et mot compris) à la personne sans compte, sans connexion, avec les seuls boutons
  d'action : aucune zone de texte libre (§ 7.2).
- **Envoi par une fonction serveur** (nouvelle) qui appelle Resend, avec une **clé Resend à part**, en accès « envoi
  seul » restreint à `timy-studio.fr` : Timy la crée et la colle lui-même (la clé du SMTP n'est pas réutilisée).
- **Un envoi raté se voit** : chaque envoi est journalisé ; en cas d'échec, une nouvelle tentative, puis la demande
  affiche « e-mail non parti » à l'équipe, et la demande reste lisible dans l'app.
- **Volume et coût** : l'offre gratuite de Resend permet 3 000 e-mails par mois et 100 par jour. Une absence fait
  partir 2 à 5 e-mails. C'est large pour une promo ; à partir de plusieurs centres, l'offre payante (environ 20 $ par
  mois) devient nécessaire, et le plan le signale.
- **Garde-fou** : un stagiaire ne crée pas plus de 10 demandes par jour (choix de Claude).

## 10. Les écrans (maquettes du 09/11)

Téléphone d'abord : cibles de 44 px, aucun défilement de côté, contraste AA, police Outfit, couleurs de l'habillage
actif, « Formateur » et jamais « prof », tutoiement des stagiaires.

1. **Contacts** (vue stagiaire, maquette 1) : en tête, « Prévenir d'une absence » (bouton principal) et « Écrire au
   centre » ; **Mes demandes** (les ouvertes, puis « Terminées ») ; **L'équipe du centre** (fiches avec « Appeler » et
   « Écrire ») ; **Ta promo** (noms, délégués).
2. **Prévenir d'une absence** (maquette 2), § 8.1.
3. **Suivi d'une demande** (maquette 3) : les étapes avec nom et heure, les réponses, l'état du justificatif et son
   bouton, « Répondre », « Annuler ».
4. **E-mail reçu par l'équipe** (maquette 4), sans le motif (§ 9).
5. **Messages de l'équipe** : la liste des demandes reçues, « À traiter » d'abord, avec le nombre de non lues sur
   l'entrée ; une demande ouverte montre les réponses toutes faites en boutons.
6. **Réglages du centre** : « Qui reçoit quoi », financements, réponses toutes faites.
7. **Fiche de l'équipe** : la sienne (Mes préférences) ; celles sans compte (page Contacts, pour ceux qui les écrivent).

**Navigation** (Timy : « un onglet ne déménage jamais, il peut apparaître » ; « une chose, un endroit ») :
- stagiaire : le bouton « Prévenir d'une absence » sur l'Accueil ; « Contacts » dans le menu du compte, à la place de
  « Contacts du centre » ;
- équipe : une entrée « Messages » avec son compteur, dans la barre de son espace ;
- la section des contacts quitte la page Documents (qui garde les liens).
La place exacte de « Messages » dans les barres du lot 5 se tranche au plan, sur maquette montrée à Timy.

**Annuaire et messages ne sont pas des cases de titre** (lien avec la spec des titres, § 6.1, qui met sur « Non » une
page ajoutée plus tard) : chaque compte a ses demandes, comme le menu de son compte, et voit l'annuaire de son centre.
Seuls « Qui reçoit quoi » et les réponses toutes faites suivent une case (Réglages du centre), et le financement et le
délégué suivent la page Stagiaires.

## 11. Sécurité : la base reste seule juge

Tout ce qui suit est appliqué par les règles RLS ou par des fonctions serveur, jamais par l'affichage seul, et prouvé
par une preuve SQL (comme celles des lots précédents) :
- un stagiaire ne lit ni le téléphone, ni l'e-mail, ni le financement d'un autre stagiaire ;
- un stagiaire ne lit plus l'adresse e-mail des autres stagiaires dans `user_profiles` (le plan relève les usages de
  cette lecture avant de la fermer) ; l'annuaire de l'équipe passe par une lecture qui ne donne que les champs de la
  fiche, pas tout le profil ;
- un stagiaire ne crée pas de demande vers un autre stagiaire ;
- une demande n'est lue que par son auteur, ses destinataires et la direction de son centre ; un délégué ne lit que
  nom, jour et demi-journée ;
- un centre ne voit ni les fiches, ni les règles, ni les demandes d'un autre centre ; le siège ne voit rien de nominatif ;
- une absence ne se crée que pour soi (un stagiaire) et ne s'annule par lui qu'avant son début ;
- un lien signé ne fait que son action, pour ce destinataire et cette demande, avant son expiration ;
- les fiches sans compte, les règles et les réponses toutes faites ne s'écrivent que dans son centre, par ceux du § 5.2
  et § 6.1 ;
- la table `contacts` n'est plus écrite par l'équipe d'un autre centre.

## 12. Conditions d'utilisation

Nouvelle version (`VERSION_CONDITIONS`), que chaque compte accepte de nouveau : téléphone et financement au profil (§ 3),
nouvelle ligne « Demandes et messages » (§ 3), qui voit quoi (§ 4 : téléphone et e-mail d'un stagiaire, équipe
seulement ; demandes, auteur, destinataires et direction ; délégué, l'absence sans motif), base légale (§ 5 : intérêt
légitime à organiser la formation et à joindre les personnes), Resend pour « les alertes des demandes » en plus des
e-mails du compte (§ 8), conservation (§ 10), fiches de l'équipe sans compte (§ 7, à côté des bénévoles).

**Version regroupée** (choix de Claude, sur le modèle de la décision de Timy pour les titres) : si les calendriers le
permettent, ces ajouts sortent dans la même version que les titres et Qualiopi Q4 et Q5, pour que chacun n'accepte
qu'une fois ; sinon, le plan le signale à Timy avant.

## 13. Conservation

- Les **demandes et leurs messages** sont des textes libres : effacés douze mois après la fin de la formation, avec les
  autres textes libres (effacement existant). Les demandes entre membres de l'équipe : douze mois après la dernière
  réponse (choix de Claude).
- **L'absence elle-même** (jour, demi-journée, motif, état du justificatif) est une preuve de présence, comme
  l'émargement : trois ans, puis rendue anonyme.
- **Liens signés et journal des envois** : effacés à leur expiration, puis après trois mois.
- **Fiches de l'équipe sans compte** : supprimées douze mois après le départ de la personne, ou sur demande.
- **Téléphone et financement d'un stagiaire** : suivent son compte.

## 14. Ordre et dépendances

- **Après la fusion du lot 5** (espaces direction et siège, tables de rôles), et dans le même ordre que les titres. Si
  les titres ne sont pas encore construits, l'annuaire affiche le rôle du lot 4 et se branche sur les titres ensuite.
- **Mise en service par promo** (choix de Claude, sur le modèle de l'émargement) : les demandes et les absences sont un
  **module de la promo**, éteint par défaut. Dès qu'il est allumé, de vrais e-mails partent vers de vraies personnes :
  il s'allume d'abord sur la promo de démonstration pour la recette (vrais e-mails reçus sur des adresses de test), puis
  sur une vraie promo **quand Timy le décide**. Module éteint : « Prévenir d'une absence », « Écrire » et « Messages »
  n'apparaissent pas ; l'annuaire, lui, est visible de tous dès sa mise en ligne (il remplace les contacts actuels).
- **Découpage proposé** (le plan tranche) :
  1. **Annuaire** : fiches de l'équipe par centre (avec et sans compte), téléphone, financement, délégué, fermeture des
     lectures en trop, conditions d'utilisation ;
  2. **Demandes et e-mails** : demandes, états, réponses toutes faites, règles « Qui reçoit quoi », relais, fonction
     d'envoi, liens signés ;
  3. **Absences** : formulaire, envois annexes, planning, émargement, justificatif.
- **À faire par Timy** : créer la clé Resend « envoi seul » ; régler « Qui reçoit quoi » de Nîmes (ou le laisser à une
  direction) ; valider la nouvelle version des conditions ; inviter, s'il le souhaite, les personnes du secrétariat
  avec un compte (titre Secrétariat, une fois les titres construits), pour qu'elles puissent écrire des réponses libres.

## 15. Tests attendus

- Tests purs des règles : routage (financement, type, relais, personne par défaut, rien de réglé), envois annexes
  (formateurs du jour selon le planning, délégué, cases décochées), états, annulation avant et après le début.
- Preuve SQL de chaque point du § 11, en répétition puis sur la base réelle, comme aux lots 4 et 5.
- Parcours au banc et au robot des parcours, téléphone et ordinateur, Chromium et WebKit : stagiaire (absence complète
  jusqu'au justificatif reçu), destinataire avec compte, destinataire sans compte (page du lien signé), formateur du jour,
  délégué, direction, autre centre.
- Un vrai e-mail reçu et ses liens inspectés avant la mise en ligne (leçon du mot de passe oublié : un réglage de
  tableau de bord ne se vérifie que par un vrai e-mail).

## 16. Choix de Claude, à vérifier en lisant

1. L'e-mail d'un stagiaire suit la règle de son téléphone (équipe seulement).
2. Retard : les formateurs du jour en destinataire principal ; tant que rien n'est réglé, tout va aux formateurs de la promo.
3. « Lue » seulement pour une lecture dans l'app ; aucun pixel espion.
4. **Les e-mails ne portent ni le motif ni le texte libre** (écart avec la maquette 4).
5. Les liens d'action demandent un toucher de confirmation et durent 14 jours.
6. Une absence se déclare pour aujourd'hui et la suite, pas après coup ; elle s'annule par le stagiaire jusqu'au début de la demi-journée.
7. Chacun peut couper ses alertes par e-mail, sauf une personne sans compte.
8. Les demandes ouvertes ne changent pas de main quand le congé commence.
9. Annuaire et messages sans case de titre ; règles et réponses toutes faites dans Réglages du centre.
10. Conservation : demandes douze mois après la formation, absences trois ans (preuve de présence).
11. Version des conditions regroupée avec les titres et Qualiopi Q4 et Q5 si possible.
12. Au plus 10 demandes par jour pour un stagiaire.
13. Une fiche d'office pour chaque compte de l'équipe ; son e-mail n'est montré aux stagiaires qu'après vérification par la personne.
14. Les fiches se rattachent à la table `profs` (sans la remplacer) pour trouver les formateurs du jour ; un formateur externe ou sans fiche n'est pas prévenu, et la demande le dit.
15. « La direction » qui lit toutes les demandes du centre = le seul titre fixe Direction de centre ; les coordonnées des stagiaires suivent la case Stagiaires (au moins « Voir »).
16. Une absence de quelques heures n'est pas pré-marquée à l'émargement : simple observation, le stagiaire signe en arrivant.
17. Demandes et absences = module de la promo, éteint par défaut, d'abord sur la promo de démonstration.
