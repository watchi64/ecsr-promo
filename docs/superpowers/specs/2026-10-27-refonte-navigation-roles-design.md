# Refonte de la navigation et séparation des droits (conception)

Date : 27/10/2026. Statut : **proposition, en attente de validation de Timy**. Maquette cliquable :
`docs/maquettes/refonte-navigation.src.html` (assemblée par `assembler_maquette.py`, testée par
`tests_maquette.js` et `captures_maquette.py`), publiée en artefact « Nouvelle navigation ECSR ».

## 1. Intention

Demande de Timy (27/10) : réformer l'app avec une meilleure navigation et une vraie séparation des
droits (stagiaire, formateur, centre ou direction, siège), une UX « sans friction, intuitive dès la
première utilisation », en s'inspirant de ce qui se fait de mieux. Idée de départ : le stagiaire garde
une barre en haut, l'équipe a une barre verticale à gauche qu'on peut cacher. Ajout en cours de route :
changer l'habillage de l'app d'un geste, par exemple aux couleurs d'ECF. Les autres chantiers cités
(dossier Qualiopi pour le siège, veille réglementaire, signalement de bugs) viennent **après** cette
refonte ; elle leur réserve leur place.

Pourquoi maintenant : l'app sort d'une seule promo (multi-promo en ligne le 03/10, tableau de bord du
centre le 23/10) et vise d'autres centres puis le réseau ECF. Une barre unique de 8 onglets, pensée pour
une promo et trois formateurs, ne tient plus : les outils de l'équipe sont cachés en tuiles d'accueil, et
il n'existe ni rôle « direction » ni rôle « siège ».

## 2. Constat (état au 27/10, `main` = 016ed7d)

- Une seule barre pour tous : Accueil, Planning, Calendrier, Cours, Notes, CCP2, Ressources, Paramètres.
  Sur iPhone (moins de 760 px) : 8 icônes sans libellé, plus une deuxième rangée (pastille, Aujourd'hui,
  Actualiser).
- Outils de l'équipe hors barre : Stagiaires, Tableau de bord, Émargement (tuiles d'Accueil), Priorités et
  Bénévoles (dans le Planning), Signalements (dans Cours), Modules et invitations (dans Paramètres).
- Deux « accueils » : l'app s'ouvre sur Mon espace (sans onglet), mais Accueil est le premier onglet.
- Rôles techniques : `user_profiles.role` (stagiaire, prof, admin) + `is_admin` + `is_founder`. Tout
  formateur est admin ; les 3 formateurs voient toutes les promos (`peut_acceder_promo`).
- Texte secondaire `--text-muted` #6E7A6F sur `--bg` : 4,06:1, sous le seuil AA de 4,5:1 (petit texte).

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Chacun ouvre l'app sur ce qui le concerne aujourd'hui, et trouve toute destination en 1 clic (2 au plus
  sur téléphone, en passant par « Plus »).
- Quatre espaces métier, avec des droits appliqués par la base (RLS), l'interface ne faisant que refléter.
- Sur téléphone : au plus 5 entrées, toujours nommées, en bas de l'écran.
- Deux habillages au choix (ECSR Promo, ECF), en un geste depuis le menu du compte.
- Zéro régression pour la promo de Nîmes (CCP2 jusqu'au 11/12) ; les anciennes adresses restent valides.

**Non-objectifs (cette refonte)**
- Le contenu des chantiers suivants (dossier Qualiopi, veille réglementaire, signalement) : seulement leur
  place dans la navigation.
- Un mode sombre, une palette de commande (Cmd+K), de la gamification : non demandés.
- La refonte visuelle des pages internes (Planning, Notes, éditeurs) au-delà de leur en-tête et de leurs
  sous-onglets.

**Anti-objectifs (échec même si « ça marche »)**
- Un menu caché derrière un bouton sur ordinateur (le « hamburger ») : la barre se replie en colonne
  d'icônes, elle ne disparaît jamais.
- Des droits qui n'existent que dans l'interface (l'aperçu « Voir en tant que » actuel est purement
  visuel ; les nouveaux rôles doivent être vrais en base).
- Une note affichée en rouge (règle de Timy) : le rouge d'ECF ne sert qu'aux repères.
- Un contenu qui défile de côté, à quelque taille d'écran que ce soit (règle de Timy du 27/10) :
  sous-onglets qui passent à la ligne, tableaux en listes hors ordinateur, matrices en pastilles sur
  téléphone.
- Le logo d'ECF dans l'app sans accord écrit d'ECF.

## 4. La proposition

### 4.1 Deux formes de navigation

| Espace | Ordinateur | Tablette (700 à 1079 px) | Téléphone (moins de 700 px) |
|---|---|---|---|
| Stagiaire | barre d'onglets en capsule, en haut, centrée | idem, plus serrée | barre d'onglets en bas, 5 cases nommées |
| Équipe (formateur, direction, siège) | barre latérale sombre, repliable en colonne d'icônes | colonne d'icônes | en-tête de contexte + barre du bas (4 entrées + « Plus ») |

Raisons : sur téléphone, Apple et Google recommandent 3 à 5 destinations nommées dans une barre en bas ;
au-delà, une barre latérale (ou un rail) sur grand écran. iPadOS 18 a placé la barre d'onglets compacte en
haut sur tablette, ce qui rejoint l'idée de Timy pour l'ordinateur. Une étude Nielsen Norman Group
(179 participants) mesure qu'un menu caché est près de deux fois moins découvert et allonge les tâches de
39 % sur ordinateur : d'où une barre repliable mais toujours visible.

Choix de Claude, à confirmer : **sur iPhone, la barre du stagiaire passe en bas** (Timy avait parlé d'une
barre en haut, ce qui reste vrai sur ordinateur et tablette).

### 4.2 Les destinations

**Stagiaire** (4 onglets, plus CCP2 quand un formateur l'ouvre)
- Accueil : la journée (séance, passage au tableau, bouton « Signer pour ce matin », voiture), À faire
  (QCM, dossier, livret), prochain rendez-vous, nouveautés, contacts du centre.
- Planning : Semaine (en grille, jours en colonnes et demi-journées en lignes, ou en liste ; sur iPhone,
  bande de cinq jours puis le jour choisi), Dates clés (ex-Calendrier), Priorités. Vue en grille demandée
  par Timy le 27/10, la même pour le formateur (avec qui est au tableau, combien en voiture).
- Cours et QCM : Thèmes, Compétences, QCM, Documents (ex-Ressources), avec recherche.
- Mon suivi : Résultats (moi / la classe, ex-Notes), Passages, EPCF, Livret, Dossier pro.
- CCP2 : le parcours en 8 étapes.
- Barre du haut : bouton « Assistant » nommé (son panneau propose aussi Signaler un problème et Contacts
  du centre) et avatar avec flèche, qui ouvre le menu du compte : Apparence, Nouveautés, Contacts du
  centre, Signaler un problème, Préférences et données, Se déconnecter.

**Formateur** (barre latérale ; contexte = la promo, avec le bouton pour replier la barre à côté)
- Aujourd'hui, Planning (Semaine, Dates clés, Priorités), Émargement (repère « Ouverte »), Stagiaires
  (Stagiaires, Élèves bénévoles ; fiche : Passages, Notes, EPCF, Livret, Dossier pro), Notes et examens
  (Matrice, EPCF, Synthèse), Cours et QCM (Thèmes, Compétences, QCM et examens, Signalements,
  Propositions IA, Documents), CCP2.
- Groupe « Promo » : Indicateurs (limités à ses promos), Réglages de la promo (ce que voient les
  stagiaires, accès).
- Pied de barre : Assistant, Signaler un problème (icône propre, distincte du drapeau des signalements de
  QCM), compte (Apparence, Voir comme un stagiaire, etc.). « Voir cette promo comme un stagiaire » est
  aussi dans le sélecteur de promo.
- Téléphone : Aujourd'hui, Planning, Stagiaires, Notes, Plus (un point signale qu'il y a à traiter ; le
  tiroir le détaille : « 5 à traiter : 3 signalements, 2 propositions de l'IA » ; il porte aussi
  l'Assistant). L'émargement du jour reste en tête d'Aujourd'hui.

**Direction** (contexte = le centre)
- Accueil (titre « Vue d'ensemble » : le tableau de bord du centre), Promos (créer, dates, modules),
  Stagiaires (tout le centre), Émargement (feuilles signées, présence, export), Notes et examens, Équipe
  (inviter, affecter aux promos).
- Qualité : Qualiopi. Centre : Réglages du centre (habillage par défaut, modules de départ, partenaires,
  émargement).
- Téléphone : Accueil, Promos, Stagiaires, Équipe, Plus. L'export reste sur ordinateur.

**Siège** (contexte = le réseau)
- Accueil (titre « Vue d'ensemble » : chiffres agrégés par centre ; chaque ligne ouvre la fiche du centre
  en lecture, et un bouton télécharge son dossier Qualiopi), Qualiopi, Cours et QCM (contenus communs,
  mises à jour), Veille réglementaire. Gestion : Directions de centre (et leurs accès), Réglages du réseau.
- Téléphone : Accueil, Qualiopi, Cours et QCM, Veille, Plus.

Principe transversal : **une page, plusieurs portées**. Les indicateurs montrent une promo au formateur,
la vue d'ensemble un centre à la direction et le réseau au siège ; la liste des stagiaires, une promo ou
un centre. Moins de pages à apprendre et à maintenir. Une même liste porte un seul nom partout
(« À suivre de près »).

### 4.3 Qui peut faire quoi

Les rôles se cumulent, chacun sur une portée : une directrice qui forme aussi a les deux espaces et passe
de l'un à l'autre depuis son menu.

| Domaine | Stagiaire | Formateur | Direction | Siège |
|---|---|---|---|---|
| Planning | voit | modifie | voit | non |
| Émargement | signe | ouvre, clôt | exporte | via Qualiopi |
| Notes, EPCF | les siennes + classe anonyme | saisit | voit | chiffres agrégés |
| Livret, dossier pro | rédige le sien | évalue | voit | non |
| Cours et QCM | lit, s'entraîne | modifie, publie | voit | contenus communs |
| Stagiaires (inviter, abandon) | non | ses promos | tout le centre | non |
| Formateurs (inviter, affecter) | non | non | oui | les directions |
| Promos (créer, dates, modules) | non | modules de ses promos | oui | non |
| Indicateurs, vue d'ensemble | non | ses promos | le centre | le réseau |
| Dossier Qualiopi | non | non | prépare | télécharge |
| Habillage par défaut | le sien | le sien | le centre | le réseau |

L'éditeur (Timy, `is_founder`) garde un accès technique complet et l'aperçu « Voir en tant que », étendu
aux quatre rôles.

### 4.4 Habillage ECF

- Menu du compte, section Apparence : deux pastilles, « ECSR Promo » et « Couleurs ECF ». Un toucher
  suffit, sans bouton Enregistrer. Le choix est gardé sur l'appareil puis sur le compte.
- La direction fixe l'habillage par défaut du centre (et peut laisser chacun choisir le sien) ; le siège,
  celui du réseau. Ordre de priorité : choix personnel, puis centre, puis réseau, puis ECSR Promo.
- Couleurs relevées dans la feuille de style d'ecf.asso.fr (classes `blue-ecf`, `blue-ecfPro`,
  `red-ecf`) : bleu #124483, bleu nuit #0D2546, rouge #DB1418, gris #F8F8F8. Polices d'ECF (Affogato,
  Inter) non reprises : l'habillage ECF garde Outfit, en graisse 600 pour les titres (Canela, serif, jure
  avec l'identité d'ECF).
- Le rouge sert aux repères (entrée active de la barre latérale, pastilles de compte) ; les notes gardent
  leur échelle douce (pêche, abricot, verts) dans les deux habillages.
- Mise en œuvre : les couleurs de l'app sont déjà des variables (`:root` de `css/style.css`) ; l'habillage
  ECF redéfinit ces variables sous un attribut `data-skin="ecf"`. Prérequis : chasser les couleurs écrites
  en dur dans les vues (ex. distribution des notes dans `js/views/notes.js`).

### 4.5 Ce qui est conservé

- Toutes les pages actuelles et leurs données ; les adresses actuelles redirigent vers le nouvel emplacement
  (`#/calendrier` vers `#/planning` sous-onglet Dates clés, `#/ressources` vers Cours > Documents, `#/notes`
  d'un stagiaire vers Mon suivi > Résultats, `#/home` vers l'accueil de l'espace).
- Les modules débloqués par les formateurs (chantier B) : un module fermé masque l'entrée ou le
  sous-onglet chez le stagiaire et le repère chez le formateur, comme aujourd'hui.
- Le contexte de promo (en-tête `x-promo-id`) : le sélecteur de contexte reprend la pastille de promo.
- La mémoire de la dernière page et du dernier sous-onglet ; le planning en lecture seule par défaut.

Exception assumée au principe « un onglet ne déménage jamais » (posé par Timy le 03/10) : la refonte
déplace Calendrier, Ressources et Notes (côté stagiaire). Elle est annoncée par une entrée Nouveautés et
les anciennes adresses mènent au bon endroit.

## 5. Tests et itérations de la maquette

- Contrôles automatiques (`tests_maquette.js`, joués par `captures_maquette.py` dans Chromium et WebKit) :
  341 vues (4 rôles, chaque page, sous-page, fiche et variante d'affichage ; ordinateur, ordinateur
  étroit de 1 100 px, tablette, iPhone), 0 échec. Règle ajoutée après le retour de Timy : aucun élément ne
  défile de côté (sous-onglets qui passent à la ligne, tableaux en listes hors ordinateur, matrice des
  notes en pastilles sur téléphone). Toute destination à
  1 clic (2 sur iPhone via « Plus ») ; cibles de 44 px sur iPhone ; contraste du texte 4,99:1 au plus bas
  dans les deux habillages ; menus dans l'écran et fermés par Échap ; libellés de la barre du bas sur une
  ligne.
- Tests du premier clic par des agents frais ne voyant que les captures, 27 tâches, deux tours :
  stagiaire 9/9 (assurance 2,4 puis 3,2 sur 5) ; équipe 17/18 puis 18/18 (assurance 3,9 puis 3,8, la
  baisse venant des écrans « Bientôt », étiquette retirée depuis).
- Changements dus aux tests : « Cours et QCM », assistant nommé (plus de bulle flottante), « À faire » et
  « Signer pour ce matin » sur iPhone, bénévoles sous Stagiaires, libellés unifiés (« Émargement »,
  « À suivre de près », « Notes et examens », « Directions de centre »), fusion Vue réseau / Centres,
  tableaux en listes sur iPhone, barre latérale qui débordait, cibles trop petites, chiffres réconciliés.
- Points faibles restants : le menu du compte n'annonce pas les réglages (Nouveauté de lancement et pied
  de page « Apparence et réglages ») ; « Mon suivi » pour les notes (3/5) ; « M. Kevin » se lit
  « Monsieur » ; à confirmer avec de vrais stagiaires et un formateur de Nîmes.

## 6. Décisions à prendre par Timy

1. iPhone stagiaire : barre en bas (recommandé) ou en haut ?
2. Les formateurs gardent-ils les indicateurs du tableau de bord, limités à leurs promos ? (proposé : oui)
3. Le siège voit-il des données nominatives ? (proposé : non, chiffres agrégés et dossiers Qualiopi)
4. Qui publie les cours : le formateur (aujourd'hui), ou le siège pour les contenus communs ?

## 7. Laissé au plan de mise en œuvre

- Modèle de données des rôles : table d'affectations (personne, rôle, portée promo, centre ou réseau),
  migration des rôles actuels (stagiaire vers stagiaire de sa promo, formateur admin vers formateur de ses
  promos, fondateur inchangé), fonctions RLS par rôle et portée, compatibilité avec `is_admin` le temps de
  la bascule.
- Découpage en lots : rôles et droits en base ; coquille de navigation et redirections ; pages d'accueil
  (Accueil stagiaire, Aujourd'hui formateur) ; espaces direction et siège ; habillages. Chaque lot porte
  son entrée Nouveautés, passe au banc d'essai (stagiaire, formateur, direction, siège, iPhone) et n'est
  poussé que par Timy.
- Les chantiers suivants, dans l'ordre proposé : signalement de problèmes, dossier Qualiopi, veille
  réglementaire (voir `ROADMAP.md` du dépôt ECSR).
