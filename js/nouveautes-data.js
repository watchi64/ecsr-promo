// Contenu de la rubrique Nouveautés, et rien d'autre.
//
// Écrire une nouveauté = ajouter un objet ici, dans le même commit que le code
// qu'elle annonce. L'ordre du tableau n'a pas d'importance : le tri se fait sur
// le champ `date` (cf. js/nouveautes.js).
//
// Champs : id (unique, date en préfixe), date (AAAA-MM-JJ), pour
// ("tous" | "formateurs" | "stagiaires" | "direction" | "siege"), titre, resume. Facultatifs : ou (le chemin dans
// l'app, rendu cliquable), guide (étapes numérotées) et module (clé de
// js/modules-data.js : la nouveauté est masquée aux stagiaires d'une promo où ce
// module est fermé). Sans `module`, il est déduit du lien `ou` ; le préciser
// dès que le lien ne suffit pas (une nouveauté sur les QCM qui mène à Thèmes).
//
// Une seule navigation depuis le 10/11. Les étapes (`guide`) décrivent la barre d'aujourd'hui. Une entrée d'avant
// la refonte peut garder le nom d'une ancienne page dans `ou.label` : le libellé du lien est réécrit au rendu
// (js/ou-trouver.js) ; le récit daté (titre, resume) n'est pas réécrit.
//
// Public : la promo, des adultes en reconversion. Pas de vocabulaire technique,
// pas de numéro de version, pas de nom de fichier.
//
// Ton (décision du 10/11) : `pour: "stagiaires"` tutoie ; `pour: "formateurs"` vouvoie ;
// `pour: "tous"` reste neutre, ni tu ni vous (étapes à l'infinitif, « Ouvrir le menu du
// compte », descriptions impersonnelles, « Chaque stagiaire peut… »).

export const NOUVEAUTES = [
  // Conservation des données (Qualiopi Q5), datée du jour de la mise en ligne. Pour l'équipe seulement : les boutons
  // d'effacement quittent Réglages (ex-Paramètres) pour la page Qualiopi, que seul le fondateur ouvre.
  {
    id: "2026-11-11-conservation-fondateur",
    date: "2026-11-11",
    pour: "formateurs",
    titre: "L'effacement des fiches passe par le fondateur",
    resume: "Les boutons « Effacer les données » (dans Abandons) et « Anonymiser la promo » quittent Réglages. Les fiches "
          + "des stagiaires sont maintenant gardées plus longtemps, comme preuves de la formation : le nom, le dossier "
          + "professionnel, le livret et les feuilles d'émargement jusqu'au 31 décembre de la troisième année après la fin ; "
          + "le compte, l'adresse e-mail et les commentaires partent 12 mois après la fin. C'est le fondateur de l'application "
          + "qui fait chaque effacement, à la date prévue. Un stagiaire qui vous demande l'effacement de ses données n'a "
          + "plus à être mis en abandon : transmettez sa demande au fondateur, qui efface tout, tout de suite. « Réactiver » reste dans "
          + "Abandons, et la suppression des élèves bénévoles ne change pas.",
    ou: { label: "Paramètres", route: "config" },
  },
  // Retouches relevées pendant le tournage du film de présentation (11/11/2026). Pour tous : formule neutre.
  {
    id: "2026-11-11-retouches-du-film",
    date: "2026-11-11",
    pour: "tous",
    titre: "Des chiffres et des étiquettes plus cohérents",
    resume: "Les notes et les moyennes s'écrivent partout avec une virgule (14,5). Le compteur de notes se met à jour dès "
          + "qu'une note est saisie. Le planning dit « Toi au tableau », « Toi en voiture » ou « Toi en salle », sur "
          + "l'Accueil comme dans la semaine. Les pastilles « Estimé » des Indicateurs reprennent les couleurs de l'app.",
    ou: { label: "Accueil", route: "home" },
  },
  // Contacts du centre propres à chaque centre (11/11) : avant, toutes les promos voyaient les contacts de Nîmes. Placée après
  // la conservation, qui reste la carte du jour de l'équipe. Pour l'équipe seulement : un stagiaire voit simplement les
  // contacts de son centre, sans rien à apprendre.
  {
    id: "2026-11-11-contacts-par-centre",
    date: "2026-11-11",
    pour: "formateurs",
    titre: "Chaque centre a ses propres contacts",
    resume: "La carte « Contacts du centre » ne montre plus que les contacts du centre de la promo affichée. Nîmes et "
          + "Montpellier gardent les mêmes contacts, mais chaque centre a maintenant sa propre liste : un numéro qui change "
          + "se corrige dans chacun des deux. Un contact que vous ajoutez appartient au centre de la promo affichée ; pour en "
          + "ajouter un à un autre centre, affichez d'abord une de ses promos.",
    ou: { label: "Cours et QCM, Documents", route: "ressources" },
  },
  {
    // Navigation unique (11/11/2026) : l'ancienne barre est retirée, toutes les promos ont la nouvelle. Premier du fichier : la
    // plus récente, celle que montre la carte « Nouveauté » de l'Accueil.
    id: "2026-11-11-une-seule-navigation",
    date: "2026-11-11",
    pour: "tous",
    titre: "Une seule barre de navigation pour toutes les promos",
    resume: "Toutes les promos ont maintenant la même barre. Côté stagiaires : Accueil, Planning, Cours et QCM, Mon suivi "
          + "et CCP2, en bas de l'écran sur téléphone, en haut sur ordinateur. Côté équipe : une barre à gauche qui commence "
          + "par Aujourd'hui (sur téléphone, les autres pages sont dans « Plus »). Rien n'est perdu : chaque page a "
          + "trouvé sa place, et les anciennes adresses mènent au bon endroit.",
    ou: { label: "Accueil", route: "home" },
    guide: [
      "Les dates importantes de la formation sont dans Planning, Dates clés ; les documents et liens utiles dans Cours et "
        + "QCM, Documents.",
      "La fiche personnelle (notes, passages, livret EPCF, dossier professionnel) s'appelle Mon suivi ; les préférences sont "
        + "dans « Mes préférences », dans le menu du compte (les initiales : en haut à droite, ou en bas de la barre de gauche "
        + "pour l'équipe sur ordinateur).",
      "Le menu du compte réunit aussi Nouveautés, Contacts du centre, Recharger les données et Se déconnecter.",
      "Pour une question sur l'app ou sur un cours : le bouton « Assistant », en haut de l'écran (pour l'équipe sur "
        + "ordinateur, en bas de la barre de gauche).",
    ],
  },
  // Lot D (les mots) et décisions du 10/11.
  {
    id: "2026-11-10-des-mots-plus-clairs-equipe",
    date: "2026-11-10",
    pour: "formateurs",
    titre: "L'app vous vouvoie, et ses mots sont plus clairs",
    resume: "L'app vouvoie désormais l'équipe (formateurs, direction) et tutoie toujours les stagiaires. Les erreurs de "
          + "QCM remontées par les stagiaires s'appellent « Questions contestées », avec un drapeau ; « Signaler un "
          + "problème » reste réservé aux problèmes de l'app. Chaque dossier a un seul nom (« Dossier professionnel », "
          + "« Livret EPCF », « Évaluations EPCF »), « Priorités » devient « Ordre de passage », la « Note » de la "
          + "feuille d'émargement devient « Remarque », et les stagiaires s'écrivent partout « Lucie M. ». Dans "
          + "Réglages, « Apparence » mène au choix des couleurs.",
    guide: [
      "Ouvrez Cours et QCM, onglet Questions contestées, pour traiter les contestations : « Question corrigée » ou « Pas d'erreur ».",
    ],
  },
  {
    id: "2026-11-10-des-mots-plus-clairs-stagiaires",
    date: "2026-11-10",
    pour: "stagiaires",
    titre: "Contester une question, et des noms plus clairs",
    resume: "Une erreur dans un QCM ? Touche « Contester cette question » : ta contestation part aux formateurs. "
          + "« Signaler un problème » sert aux problèmes de l'app. Ta page d'accueil s'appelle « Accueil », et ton "
          + "livret EPCF, que ton formateur évaluateur remplit, se consulte dans Mon suivi.",
    ou: { label: "Accueil", route: "home" },
  },
  {
    // Suite du lot 5 (mise en ligne du 11/11/2026). Texte destiné à l'équipe : au vouvoiement. Récit et étapes réécrits le jour
    // même par le lot Q5 : l'anonymisation des promos, qui ne tenait pas les 3 ans promis, passe au fondateur (page Qualiopi).
    id: "2026-11-11-donnees-personnelles-centre",
    date: "2026-11-11",
    pour: "direction",
    titre: "Données personnelles dans les Réglages du centre",
    resume: "Les Réglages du centre ont une section « Données personnelles ». Vous y supprimez les élèves bénévoles du "
          + "centre sans venue depuis 12 mois, sans changer la promo affichée. La conservation des fiches des stagiaires "
          + "(12 mois, puis jusqu'au 31 décembre de la troisième année après la fin) est gérée par le fondateur, sur la page "
          + "Qualiopi ; la section le rappelle. "
          + "Autre changement : inviter comme formateur, direction ou siège l'adresse d'un ancien stagiaire dont la fiche n'existe "
          + "plus transforme son compte en compte du personnel, qui se connecte comme avant.",
    ou: { label: "Réglages du centre", route: "config" },
    guide: [
      "Ouvrez Réglages du centre, puis la section « Données personnelles », sous l'habillage.",
      "La partie « Conservation des fiches » rappelle que le fondateur fait chaque effacement des fiches, à la date prévue ; "
        + "transmettez-lui une demande d'effacement d'un stagiaire.",
      "Plus bas, « Élèves bénévoles sans venue depuis 12 mois » liste ceux du centre ; « Supprimer » les retire, y compris "
        + "des anciens créneaux du planning, après confirmation.",
    ],
  },
  {
    // Mise en ligne du 09/11/2026 (migration appliquée le même jour). Premier du fichier : à date égale avec le lot 2B,
    // c'est elle que montre la carte « Nouveauté » de l'Accueil, la plus récente.
    id: "2026-11-09-questionnaires-anonymes",
    date: "2026-11-09",
    pour: "tous",
    titre: "Un avis sur la formation, sans nom",
    resume: "À la fin de la formation, un court questionnaire s'affiche en haut de l'Accueil : "
          + "quelques questions sur la formation elle-même, à noter de 1 à 4, avec « Sans avis » en cas "
          + "de doute. La réponse est enregistrée sans nom, sans compte et sans date ; dans l'application, personne "
          + "ne peut voir qui a répondu quoi, et les résultats n'apparaissent qu'à partir de 5 réponses. "
          + "« Plus tard » le fait revenir le lendemain. Les formateurs ont leur propre questionnaire, et quelques "
          + "questions reviendront six mois après la fin de la formation.",
    ou: { label: "Accueil", route: "home" },
  },
  // Lot 2B de la refonte (date de la fusion). À date égale, l'ordre du fichier est gardé : la journée du stagiaire
  // d'abord, c'est elle que montre la carte « Nouveauté » de son Accueil.
  {
    id: "2026-11-09-ta-journee-accueil",
    date: "2026-11-09",
    pour: "stagiaires",
    titre: "Ta journée sur l'Accueil",
    resume: "L'Accueil s'ouvre maintenant sur ta journée : ce que tu fais le matin et l'après-midi, avec qui, et le "
          + "bouton pour signer l'émargement. Juste dessous, « À faire » rassemble ce qui t'attend, puis vient ton "
          + "prochain rendez-vous. Le Planning montre la semaine en grille, tes QCM ont leur onglet dans Cours "
          + "et QCM, et Mon suivi réunit tes notes et celles de la classe dans une seule partie, Résultats.",
    ou: { label: "Accueil", route: "home" },
    guide: [
      "Sur l'Accueil, la carte « Aujourd'hui » montre ton matin et ton après-midi. Quand la feuille d'émargement est "
        + "ouverte, touche « Signer pour ce matin » (ou « Signer pour cet après-midi ») : la carte affiche ensuite l'heure "
        + "de ta signature.",
      "« À faire » liste au plus quatre choses : un examen ouvert, le QCM d'un thème vu cette semaine et pas "
        + "encore fait, ton dossier professionnel. Touche une ligne pour y aller.",
      "Dans Planning, Semaine, la grille montre les cinq jours, aujourd'hui repéré. Sur téléphone, touche un jour dans "
        + "la bande du haut. « Liste » remet l'affichage d'avant, et l'app retient ton choix.",
      "Dans Cours et QCM, onglet QCM : chaque QCM avec la note de ton dernier entraînement. « Voir le QCM » affiche sa "
        + "fiche : S'entraîner, Revoir mes erreurs et, quand un formateur l'a ouvert, Passer l'examen.",
      "Dans Mon suivi, partie Résultats : « Moi » montre l'évolution de tes notes, « La classe » le tableau de la classe. "
        + "Sur téléphone, le sommaire dit où tu en es dans chaque partie.",
    ],
  },
  {
    id: "2026-11-09-aujourdhui-formateurs",
    date: "2026-11-09",
    pour: "formateurs",
    titre: "Aujourd'hui remplace l'Accueil",
    resume: "Votre première page s'appelle maintenant Aujourd'hui et montre la journée de la promo : la feuille "
          + "d'émargement du jour, qui passe au tableau, qui est en voiture, ce qui est à traiter dans Cours et QCM, "
          + "et les stagiaires à suivre de près.",
    ou: { label: "Aujourd'hui", route: "home" },
    guide: [
      "Ouvrez Aujourd'hui, en haut de la barre de gauche sur ordinateur, en bas de l'écran sur téléphone.",
      "« Émargement » : combien de stagiaires ont signé, qui est en attente, et « Voir la feuille ». La carte n'apparaît "
        + "que si l'émargement est activé pour la promo.",
      "« Au tableau » et « En voiture » : qui passe au tableau et sur quel sujet, qui conduit (stagiaires et élèves "
        + "bénévoles), le matin et l'après-midi. Au tableau, touchez un nom pour ouvrir la fiche du stagiaire.",
      "« À traiter » : les questions contestées et les questions proposées par l'IA. Chaque ligne ouvre le bon "
        + "onglet de Cours et QCM.",
      "Cours et QCM a aussi un onglet Propositions IA (formateurs de la promo) : « Relire » ouvre l'éditeur du "
        + "QCM, où vous acceptez ou rejetez chaque question.",
      "« À suivre de près » : les stagiaires qui ont au moins deux difficultés parmi quatre. « Tout voir » ouvre Indicateurs.",
    ],
  },
  {
    id: "2026-11-09-cours-telephone",
    date: "2026-11-09",
    pour: "tous",
    module: "cours",
    titre: "Les cours se lisent mieux sur téléphone",
    resume: "Dans un cours, le sommaire passe à la ligne au lieu de défiler de côté, et ses boutons sont plus "
          + "grands sur téléphone. Les grands tableaux y deviennent des listes : une fiche par ligne, chaque valeur "
          + "sous le nom de sa colonne. Plus rien ne dépasse de l'écran. Les informations légales de l'app suivent "
          + "la même présentation.",
    ou: { label: "Cours", route: "themes" },
    guide: [
      "Ouvrir un cours : toucher le titre d'un thème, ou son bouton « Cours ».",
      "Le sommaire, en haut du cours, passe à la ligne : toucher une partie pour y aller.",
      "Sur téléphone, chaque ligne d'un grand tableau devient une fiche : le nom de la colonne est écrit au-dessus de "
        + "chaque valeur.",
    ],
  },
  // Lot 5 de la refonte (date de la fusion : à reposer, avec l'id, quand le lot est fusionné). À date égale, l'ordre du fichier est
  // gardé : les entrées du lot 2B restent devant.
  {
    id: "2026-11-10-espace-direction",
    date: "2026-11-10",
    pour: "direction",
    titre: "Votre espace de direction",
    resume: "Vous avez maintenant votre espace pour piloter votre centre. L'Accueil est une vue d'ensemble : les chiffres du centre, "
          + "toutes ses promos côte à côte et les stagiaires à suivre de près. Dans la barre, Promos, Stagiaires, "
          + "Émargement, Notes et examens et Équipe vous donnent la main sur chaque promo du centre : vous créez les promos, "
          + "vous voyez tous les stagiaires, vous lisez les feuilles d'émargement et les notes, et vous invitez vos formateurs en "
          + "choisissant leurs promos.",
    ou: { label: "Promos", route: "promos" },
    guide: [
      "Accueil ouvre la « Vue d'ensemble » du centre : les chiffres, la comparaison des promos, « À suivre de près » et "
        + "« Thèmes les moins réussis ». « Exporter le tableau (CSV) » enregistre le tableau des promos sur ordinateur.",
      "Dans Promos, « Créer une promo » demande un nom, un début et, si vous voulez, une fin. « Modifier » règle le nom et les "
        + "dates, « Modules » ce que voient les stagiaires de la promo.",
      "Dans Stagiaires, tous les stagiaires du centre sont groupés par promo. Un nom ouvre sa fiche ; « Gérer cette promo » "
        + "ouvre une autre promo du centre. Pour la promo affichée, vous ajoutez, mettez en abandon, réactivez ou "
        + "effacez un stagiaire, et vous invitez son compte.",
      "Dans Émargement, « Voir les feuilles » ouvre les feuilles d'une promo en lecture. Dans Notes et examens, « Voir la "
        + "matrice » ouvre les notes de la promo.",
      "Dans Équipe, « Inviter un formateur » demande son adresse et les promos du centre à cocher ; « Modifier » change ses "
        + "promos, « Retirer du centre » les lui enlève toutes.",
      "Dans Réglages du centre, « Habillage par défaut du centre » choisit l'apparence que reçoivent les comptes du centre qui "
        + "n'ont rien choisi ; décochez « Laisser chacun choisir le sien » pour l'imposer à tous.",
      "Sur téléphone, Accueil, Promos, Stagiaires et Équipe sont en bas de l'écran ; « Plus » ouvre les autres pages.",
    ],
  },
  {
    id: "2026-11-10-espace-siege",
    date: "2026-11-10",
    pour: "siege",
    titre: "L'espace du siège",
    resume: "Le siège a son espace, pour regarder le réseau sans jamais voir un nom. L'Accueil donne les chiffres de chaque "
          + "centre ; un centre de moins de 5 stagiaires en formation n'affiche aucun chiffre et reste hors des totaux. "
          + "Vous gérez les directions de centre, vous ajoutez un centre, et vous rédigez les cours et les QCM communs à tous.",
    ou: { label: "Accueil", route: "reseau" },
    guide: [
      "Accueil ouvre la « Vue d'ensemble » du réseau : les chiffres des centres, sans aucun nom de stagiaire. Une ligne ouvre "
        + "la fiche du centre ; « Exporter le tableau (CSV) » enregistre le tableau sur ordinateur.",
      "Un centre de moins de 5 stagiaires en formation dit « Moins de 5 stagiaires en formation : chiffres non affichés. » "
        + "Le centre de démonstration (données fictives) est à part, hors totaux.",
      "Dans Directions de centre, « Inviter une direction » demande une adresse et un centre ; « Retirer » enlève une direction. "
        + "« Ajouter un centre » crée un centre, puis propose d'inviter sa direction.",
      "Dans Cours et QCM, vous rédigez les cours des thèmes et les questions de QCM, communs à tous les centres.",
      "Dans Réglages du réseau, vous choisissez l'habillage par défaut du réseau : celui des comptes qui n'ont rien choisi et dont le "
        + "centre n'a rien fixé.",
      "Sur téléphone, Accueil, Cours et QCM et Directions sont en bas de l'écran ; « Plus » ouvre les Réglages du réseau.",
    ],
  },
  {
    id: "2026-11-10-menu-espace",
    date: "2026-11-10",
    pour: "formateurs",
    titre: "Choisissez votre espace",
    resume: "Si vous dirigez un centre ou si vous travaillez pour le siège, en plus de former, le menu de votre compte a maintenant "
          + "une section « Espace » : une ligne par espace (Formateur, Direction, Siège), l'espace actuel est coché. Choisir "
          + "un autre espace recharge l'app sur son accueil. Vous ne la voyez que si vous avez plusieurs espaces.",
    guide: [
      "Ouvrez le menu de votre compte : vos initiales, en bas de la barre de gauche sur ordinateur.",
      "Dans la section « Espace », touchez l'espace voulu : l'app s'ouvre sur son accueil.",
      "Pour revenir à votre promo, rouvrez le menu et choisissez « Formateur ».",
    ],
  },
  {
    id: "2026-11-10-changer-de-promo",
    date: "2026-11-10",
    pour: "stagiaires",
    titre: "Changer de promo",
    resume: "Si tu fais partie de plusieurs promos, le menu de ton compte a une ligne « Changer de promo » : elle ouvre le choix "
          + "de la promo, et l'app se recharge sur celle que tu choisis.",
    guide: [
      "Touche tes initiales, en haut à droite, pour ouvrir le menu de ton compte.",
      "Touche « Changer de promo » : la ligne n'est là que si tu as au moins deux promos.",
      "Choisis la promo : l'app se recharge dessus.",
    ],
  },
  {
    id: "2026-11-09-qcm-echap-et-pannes",
    date: "2026-11-09",
    pour: "tous",
    titre: "QCM : Échap ferme la fenêtre, et un message quand la connexion lâche",
    resume: "Sur ordinateur, la touche Échap ferme maintenant la fenêtre d'un QCM, comme la croix (pendant un examen, "
          + "la même confirmation est demandée). Dans Cours et QCM, si les cours ou les QCM ne se chargent pas, "
          + "la page le dit et propose « Réessayer » au lieu de laisser des colonnes vides. Un cours sans texte "
          + "affiche un message clair.",
    ou: { label: "Cours et QCM", route: "themes" },
  },
  // Lot C de l'audit du 09/11 : les notes et les examens.
  {
    id: "2026-11-09-notes-saisir-examens",
    date: "2026-11-09",
    pour: "formateurs",
    titre: "Notes : saisir thème par thème, ouvrir un examen depuis la liste",
    resume: "Dans Notes et examens, l'onglet « Saisir » note toute la classe sur un thème ou une compétence : vous "
          + "choisissez le thème, puis chaque stagiaire a sa ligne avec un grand champ, pratique sur téléphone (la page "
          + "s'y ouvre). La note s'enregistre dès que vous passez au champ suivant, et « 7/10 » est converti sur 20. "
          + "Dans Cours et QCM, chaque thème qui a un QCM affiche l'état de son examen (« Ouvert jusqu'à 16 h 30 ») "
          + "et le bouton pour l'ouvrir ou le fermer, sans passer par la fiche du QCM. Les pages de notes encore vides "
          + "disent d'où viendront les notes.",
    ou: { label: "Notes et examens", route: "notes" },
    guide: [
      "Notes et examens, onglet « Saisir » : choisissez un thème ou une compétence, puis tapez les notes ligne par ligne.",
      "Une note venue d'un examen QCM l'indique sous le nom du stagiaire.",
      "Cours et QCM : sur la ligne d'un thème, « Ouvrir l'examen aux stagiaires » demande pour combien de temps ; « Fermer l'examen » "
        + "demande une confirmation.",
    ],
  },
  // Finitions du lot C (relecture du 09/11) : la saisie et l'effacement d'une note.
  {
    id: "2026-11-09-notes-finitions",
    date: "2026-11-09",
    pour: "formateurs",
    titre: "Notes : des messages plus clairs, un bouton pour réessayer, une vraie fenêtre pour effacer",
    resume: "Dans Notes et examens, une note mal tapée se signale en une phrase qui dit quoi taper (« la note va de 0 "
          + "à 20 »). Si la connexion lâche pendant la saisie, la ligne du stagiaire propose « Réessayer » ; si vous remettez "
          + "la note d'avant, le message d'erreur s'en va. Pour effacer une note, une fenêtre de l'app vous demande "
          + "confirmation, avec le nom du stagiaire et la note. Dans Cours et QCM, l'échéance d'un examen écrit "
          + "l'année quand elle tombe l'année suivante.",
    ou: { label: "Notes et examens", route: "notes" },
  },
  // Suite du lot C (09/11) : les moyennes EPCF de la classe tant qu'aucune ne peut s'afficher.
  {
    id: "2026-11-09-moyennes-epcf-vides",
    date: "2026-11-09",
    pour: "tous",
    titre: "Moyennes EPCF : la page dit quand elles arriveront",
    resume: "Les moyennes EPCF de la classe n'apparaissent qu'à partir de deux stagiaires évalués à la même épreuve, "
          + "en salle ou en véhicule : avec un seul, la moyenne serait sa note. En attendant, la page le dit en une phrase "
          + "et propose la suite : un bouton mène chaque stagiaire à ses propres résultats, « Évaluer un stagiaire » sert "
          + "aux formateurs, qui voient aussi combien de stagiaires sont déjà évalués.",
    ou: { label: "Notes, onglet Évaluations EPCF", route: "notes", sousOnglet: "epcf" },
    module: "epcf",
  },
  // Suite des moyennes EPCF vides (09/11) : la partie EPCF de sa fiche, et l'anonymat des moyennes jusque dans la base.
  {
    id: "2026-11-09-mon-epcf-vide",
    date: "2026-11-09",
    pour: "stagiaires",
    titre: "Tes évaluations EPCF : la page dit quand tes résultats arriveront",
    resume: "Tant qu'aucune de tes épreuves EPCF n'est évaluée, la partie Évaluations EPCF de Mon suivi le dit en une phrase et te "
          + "mène à ton livret EPCF. Sur ton radar, la moyenne du groupe n'apparaît que quand chaque phase compte au moins "
          + "deux stagiaires évalués : une moyenne de la classe ne montre jamais la note d'un seul camarade.",
    ou: { label: "Mon espace personnel, partie Évaluations EPCF", route: "mon-suivi", sousOnglet: "epcf" },
    module: "epcf",
  },
  // Les confirmations dans une fenêtre de l'app, lot B (réglages, Cours et QCM, émargement, EPCF, planning).
  {
    id: "2026-11-10-confirmations-lot-b",
    date: "2026-11-10",
    pour: "formateurs",
    titre: "Toutes les confirmations dans une fenêtre de l'app",
    resume: "Les dernières boîtes grises du navigateur disparaissent : retirer un accès, supprimer une question ou une "
          + "notion, réinitialiser une tentative d'examen, clore la feuille d'émargement, abandonner une grille EPCF en "
          + "cours se confirment maintenant dans une fenêtre de l'app. Pour effacer les données d'un stagiaire ou "
          + "anonymiser une promo, vous tapez toujours le prénom ou ANONYMISER, dans la fenêtre, qui vous dit si la "
          + "saisie ne correspond pas. Le libellé d'un jour désactivé du planning se saisit de la même façon.",
  },
  // Les confirmations dans une fenêtre de l'app (lot A : examen, planning, bénévoles, modules, ressources...).
  {
    id: "2026-11-10-confirmations-dans-l-app",
    date: "2026-11-10",
    pour: "tous",
    titre: "Des confirmations plus lisibles",
    resume: "Quand l'app demande de confirmer un geste (quitter ou terminer un examen, supprimer, vider les "
          + "placements du planning...), la question s'affiche maintenant dans une fenêtre de l'app, lisible sur "
          + "téléphone, au lieu de la petite boîte grise du navigateur. Le bouton dit ce qu'il fait (« Supprimer », "
          + "« Terminer ») ; « Annuler » (ou « Continuer l'examen ») et Échap referment sans rien changer. Pendant un "
          + "examen, si le temps s'écoule alors que la question est ouverte, elle se ferme d'elle-même.",
  },
  // Confidentialité (10/11) : le seuil des moyennes EPCF passe à trois stagiaires (décision de Timy).
  {
    id: "2026-11-10-moyennes-epcf-trois",
    date: "2026-11-10",
    pour: "tous",
    titre: "Moyennes EPCF : à partir de trois stagiaires",
    resume: "Les moyennes EPCF de la classe n'apparaissent plus qu'à partir de trois stagiaires évalués à la même "
          + "épreuve, au lieu de deux : à deux, chacun aurait pu retrouver la note de l'autre en la comparant à la "
          + "sienne. La même règle vaut pour la moyenne du groupe sur le radar EPCF de chaque stagiaire. Les formateurs voient toujours "
          + "chaque évaluation.",
    ou: { label: "Notes, onglet Évaluations EPCF", route: "notes", sousOnglet: "epcf" },
    module: "epcf",
  },
  // Confidentialité (10/11) : l'adresse e-mail d'un stagiaire n'est plus lisible des autres stagiaires.
  {
    id: "2026-11-10-adresse-email-privee",
    date: "2026-11-10",
    pour: "stagiaires",
    titre: "Ton adresse e-mail reste entre toi et l'équipe",
    resume: "Ton adresse e-mail n'est plus visible des autres stagiaires de la promo : seuls toi et l'équipe "
          + "(formateurs, direction) la voyez. Le masquage de tes notes, lui, ne change pas.",
  },
  // Lot de corrections 2 (audit du 09/11) : ce que l'app affiche est juste.
  {
    id: "2026-11-09-accueil-plus-juste",
    date: "2026-11-09",
    pour: "stagiaires",
    titre: "Accueil et Mon suivi : des repères plus justes",
    resume: "Quand ton nom ne figure sur aucune activité du matin ou de l'après-midi, l'Accueil te le dit. Dans "
          + "« À faire », un examen ouvert ou le QCM d'un thème t'emmène directement à tes QCM. Ton livret EPCF n'y "
          + "apparaît plus, et il affiche maintenant ton nom et ta date de naissance. "
          + "Dans Mon suivi, Résultats te rappelle où sont les notes de tes entraînements aux QCM.",
    ou: { label: "Accueil", route: "home" },
  },
  {
    id: "2026-11-09-emargement-planning-plus-justes",
    date: "2026-11-09",
    pour: "formateurs",
    titre: "Planning et émargement : des affichages plus justes",
    resume: "En mode Modifier du planning, une activité n'est plus réduite à une colonne étroite quand une activité "
          + "parallèle a été supprimée sur la demi-journée. Là où l'émargement est activé, la feuille compte à part "
          + "les absents prévus au planning (« 2 sur 6 ont signé · 3 en attente · 1 absent prévu au planning »), et "
          + "la semaine de l'émargement signale une demi-journée de cours passée sans feuille : « Feuille non faite ».",
    ou: { label: "Planning", route: "planning" },
    guide: [
      "Sur la feuille d'émargement, le résumé du haut sépare ceux qui attendent des absents prévus au planning.",
      "Dans la semaine de l'émargement, « Feuille non faite » signale une demi-journée de cours restée sans feuille.",
      "Sur Aujourd'hui, la carte « Émargement » nomme ceux qui attendent et, à part, les absents : avec les signés, "
        + "ils font le total.",
      "Dans le Planning en grille, une voiture sans stagiaire au volant affiche « Aucun stagiaire en voiture ».",
      "Les messages de l'app ne se marchent plus dessus : la confirmation d'un geste reste à l'écran, et l'annonce "
        + "de l'ouverture attend que le menu « Plus » soit refermé.",
    ],
  },
  // Lot 3 de la refonte (date de la fusion) : le choix de l'habillage. À date
  // égale, il vient après le lot 2B : la carte « Nouveauté » de l'Accueil garde la journée du stagiaire et Aujourd'hui.
  {
    id: "2026-11-09-couleurs-ecf",
    date: "2026-11-09",
    pour: "tous",
    titre: "L'app aux couleurs d'ECF",
    resume: "Chacun peut habiller l'app aux couleurs d'ECF : son bleu, son bleu nuit et une touche de rouge. Les "
          + "couleurs et la police des titres changent : chaque page reste à sa place, et les notes gardent leurs couleurs. L'app retient ce "
          + "choix, et le retour à ECSR Promo, la couleur d'origine, reste possible à tout moment.",
    ou: { label: "Mes préférences", route: "preferences" },
    guide: [
      "Ouvrir le menu du compte : le rond aux initiales, en haut à droite de l'écran (chez les formateurs, sur "
        + "ordinateur, en bas de la barre de gauche).",
      "Sous Apparence, toucher « Couleurs ECF » : l'app change de couleurs tout de suite.",
      "Pour revenir, toucher « ECSR Promo » au même endroit. Le même choix est aussi dans Mes préférences.",
    ],
  },
  // Finitions de l'audit du 09/11 (lot E). À date égale, après le lot 3 : la carte « Nouveauté » de l'Accueil n'en change pas.
  {
    id: "2026-11-09-finitions",
    date: "2026-11-09",
    pour: "tous",
    titre: "Des écrans plus nets",
    resume: "Les heures s'écrivent partout de la même façon : « 9 h à 12 h 30 ». Un examen ouvert s'affiche en vert, "
          + "comme une feuille d'émargement ouverte. Les jours fériés se lisent mieux dans le planning. Sur "
          + "téléphone, les boutons et les cases à remplir sont plus grands sous le doigt.",
    ou: { label: "Planning", route: "planning" },
  },
  {
    id: "2026-11-09-une-seule-ecriture",
    date: "2026-11-09",
    pour: "tous",
    titre: "Une seule écriture dans toute l'app",
    resume: "Les titres, le texte et les chiffres s'écrivent maintenant dans une seule police. Les grands titres "
          + "comme « Aujourd'hui » ou « Bonjour » ont la même allure que les autres titres "
          + "de page, et les dates, les heures et les notes gardent leurs chiffres bien alignés. Les documents imprimés "
          + "(livret EPCF, feuilles d'émargement, attestations) ne changent pas.",
    ou: { label: "Accueil", route: "home" },
  },
  {
    id: "2026-11-09-planning-plus-clair",
    date: "2026-11-09",
    pour: "formateurs",
    titre: "Planning : plus clair sur téléphone et en mode Modifier",
    resume: "Le planning va plus vite à l'essentiel. En mode Modifier, chaque activité garde son nom en entier, même à "
          + "trois sur le même horaire, et une activité seule sur son créneau prend toute la largeur. « Terminer » devient "
          + "« Quitter l'édition », pour ne plus ressembler à « Valider la semaine ».",
    ou: { label: "Planning", route: "planning" },
    guide: [
      "En mode Modifier, « Quitter l'édition » revient à la lecture : tout est déjà enregistré. « Valider la semaine » "
        + "enregistre les passages des jours écoulés. « Vider les placements » est en bout de barre, à l'écart de « Placer "
        + "la semaine ».",
      "Sur une carte, les dés disent « Tirer » ou « Tirer au sort », et le bouton d'absence dit « Absent ». Sur téléphone, "
        + "chaque commande de l'éditeur est assez grande pour le doigt.",
      "La grille de la semaine donne les prénoms : qui passe au tableau, qui conduit, quels élèves bénévoles.",
      "Dans la barre de la semaine, « Grille / Liste » (« Jour / Liste » sur téléphone) est à côté de « Modifier » et "
        + "d'« Imprimer ». « Revenir à aujourd'hui » apparaît quand vous regardez une autre semaine. L'émargement s'ouvre par "
        + "sa page ou par le bandeau, et la banque des élèves bénévoles par Stagiaires (ou depuis le mode Modifier).",
    ],
  },
  {
    id: "2026-11-09-finitions-planning",
    date: "2026-11-09",
    pour: "formateurs",
    titre: "Planning : des icônes à la place des émojis",
    resume: "Dans le planning, les petits dessins en couleur laissent la place aux icônes du reste de l'app : un "
          + "crayon pour « Modifier », des dés pour le placement automatique, une gomme pour « Vider les placements ». "
          + "Le bouton « Cette semaine » disparaît, sur ordinateur comme sur téléphone.",
    ou: { label: "Planning", route: "planning" },
  },
  {
    id: "2026-11-08-roles-par-promo",
    date: "2026-11-08",
    pour: "formateurs",
    titre: "Chacun ne voit que les promos où il intervient",
    resume: "Chacun ne voit désormais que les promos où il intervient, et c'est vérifié à chaque "
          + "action, pas seulement à l'affichage. Pour vous, une seule différence : les questions contestées et les "
          + "acceptations des conditions s'affichent promo par promo, comme les notes. Un nouveau formateur s'ajoute désormais par la direction du "
          + "centre (en attendant, par Timy) ; vous invitez toujours les stagiaires de vos promos. Nouveau : "
          + "« Voir comme un stagiaire », dans le menu de votre compte et dans le choix de la promo, montre l'app "
          + "telle que la voit un stagiaire, sans que vous puissiez rien y modifier.",
    guide: [
      "Ouvrez le menu de votre compte, ou le choix de la promo, puis touchez « Voir comme un stagiaire ».",
      "Un bandeau « Aperçu : Stagiaire » reste affiché en bas de l'écran.",
      "Touchez « Quitter l'aperçu » pour retrouver votre espace.",
    ],
  },
  {
    id: "2026-10-29-nouvelle-navigation",
    date: "2026-10-29",
    pour: "tous",
    titre: "Une navigation plus simple",
    resume: "La barre de l'app change pour aller plus vite à l'essentiel. Sur le téléphone, les pages "
          + "principales sont en bas de l'écran, à portée de pouce, chacune avec son nom. Le Planning regroupe "
          + "la semaine, les dates clés et l'ordre de passage ; Cours et QCM regroupe les thèmes, les compétences "
          + "et les documents. Les notes de la classe sont maintenant dans Mon suivi, La classe (chez les "
          + "formateurs, dans Notes et examens), et les contacts du centre dans le menu du compte. "
          + "Certaines parties s'ouvrent au fil de la formation.",
    guide: [
      "Dans Planning, Semaine, la journée du jour est repérée ; depuis une autre semaine, « Revenir à aujourd'hui » y ramène.",
      "Le compte s'ouvre avec les initiales, en haut à droite (sur ordinateur, les formateurs le trouvent "
        + "en bas de la barre de gauche). Un point y signale des Nouveautés pas encore lues ; leur nombre est dans le menu.",
      "Dans le menu du compte : les Nouveautés, les contacts du centre (pour prévenir d'une absence), "
        + "Mes préférences, « Recharger les données », les informations légales et la déconnexion.",
      "L'assistant s'ouvre avec le bouton « Assistant », en haut de l'écran (en bas de la barre de gauche "
        + "pour les formateurs sur ordinateur).",
    ],
  },
  {
    id: "2026-10-29-nouvelle-navigation-formateurs",
    date: "2026-10-29",
    pour: "formateurs",
    titre: "Côté formateurs, la barre passe à gauche",
    resume: "Sur ordinateur, la barre de l'équipe est maintenant à gauche, avec la promo en tête ; elle se "
          + "replie en colonne d'icônes et l'app s'en souvient. Le compte et l'assistant sont en bas de cette "
          + "barre. Sur téléphone, Aujourd'hui, Planning, Stagiaires et Notes sont en bas de l'écran, « Plus » "
          + "ouvre le reste (Émargement, Cours et QCM, CCP2, Indicateurs, Réglages), et le bouton Assistant "
          + "est en haut, à côté de votre compte. Les élèves bénévoles se trouvent maintenant dans Stagiaires.",
    ou: { label: "Stagiaires, Élèves bénévoles", route: "stagiaires", sousOnglet: "benevoles" },
    guide: [
      "Aujourd'hui remplace l'Accueil : la feuille d'émargement du jour, ce qui est à traiter dans Cours et QCM, "
        + "qui passe au tableau et qui est en voiture, et les stagiaires à suivre de près.",
      "Repliez la barre de gauche avec le bouton en haut de la barre : l'app retient votre choix.",
      "En bas de la barre : l'assistant, « Signaler un problème » et votre compte (Nouveautés, contacts du "
        + "centre, Mes préférences).",
      "Sur téléphone, « Plus » ouvre les autres pages, et le bouton « Assistant » est dans l'en-tête, à "
        + "côté de votre compte.",
      "Les élèves bénévoles sont dans Stagiaires, onglet « Élèves bénévoles » ; le bouton du Planning y mène aussi.",
      "Réglages ne garde que la promo (ce que voient les stagiaires, les accès, les données personnelles) : "
        + "vos propres préférences sont dans le menu de votre compte.",
    ],
  },
  {
    id: "2026-10-29-affichage-telephone",
    date: "2026-10-29",
    pour: "tous",
    titre: "Des pages mieux tenues sur le téléphone",
    resume: "Les graphes des notes et l'historique des passages tiennent maintenant dans la largeur de l'écran : "
          + "plus besoin de faire défiler la page de côté. Un stage déjà commencé affiche « En cours » au lieu "
          + "d'un nombre de jours négatif. Et les moyennes basses des graphes ne sont plus en rouge.",
  },
  {
    id: "2026-10-28-signaler-un-probleme",
    date: "2026-10-28",
    pour: "tous",
    titre: "Signaler un problème en deux gestes",
    resume: "Un bug, un bouton qui ne réagit pas, quelque chose de pas clair ? Il suffit de l'écrire dans « Signaler un "
          + "problème » : la page, l'appareil et l'heure partent avec le message, et une capture d'écran peut "
          + "s'y ajouter. La réponse s'affiche au même endroit.",
    guide: [
      "Ouvrir le compte avec les initiales, en haut à droite, puis choisir « Signaler un problème ». Chez les formateurs, "
        + "le bouton est en bas de la barre de gauche sur ordinateur, et dans « Plus » sur téléphone.",
      "Dans l'Assistant, la ligne « Un souci avec l'app ? » mène au même endroit.",
      "Écrire ce qui se passe, ajouter une capture si besoin, puis « Envoyer ».",
    ],
  },
  {
    id: "2026-10-28-assistant-plus-facile",
    date: "2026-10-28",
    pour: "tous",
    module: "assistant",
    titre: "L'assistant, plus facile à manier sur le téléphone",
    resume: "La croix pour fermer l'assistant se voit enfin, et sur le téléphone ses boutons sont plus "
          + "grands, donc plus faciles à toucher. Quand un bandeau s'affiche en bas de l'écran, le bouton "
          + "de l'assistant et la zone de saisie passent au-dessus de lui au lieu d'être cachés.",
  },
  {
    id: "2026-10-27-textes-plus-lisibles",
    date: "2026-10-27",
    pour: "tous",
    titre: "Textes plus lisibles",
    resume: "Les textes gris et verts de l'app ont été légèrement foncés pour mieux se lire, "
          + "notamment au soleil sur le téléphone. Les couleurs restent les mêmes, juste un peu plus soutenues.",
  },
  {
    id: "2026-10-24-app-installable",
    date: "2026-10-24",
    pour: "tous",
    titre: "L'app, encore plus pratique sur le téléphone",
    resume: "L'app s'utilisait déjà sur le téléphone, dans le navigateur. Ajoutée à l'écran d'accueil, "
          + "elle s'ouvre maintenant en plein écran, comme une application, sans la barre du navigateur. "
          + "Rien à télécharger dans une boutique : elle se met à jour toute seule. Une connexion internet "
          + "reste nécessaire.",
    guide: [
      "Sur iPhone, dans Safari : bouton Partager (le carré avec une flèche), puis « Sur l'écran d'accueil ».",
      "Sur Android, dans Chrome : menu en haut à droite, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
      "Ouvrir l'app depuis sa nouvelle icône. Sur iPhone, se connecter une fois à l'intérieur : elle ne partage pas la connexion de Safari.",
      "L'icône était déjà en place ? La supprimer puis l'ajouter à nouveau pour avoir le plein écran.",
    ],
  },
  {
    id: "2026-10-23-assistant-scaleway",
    date: "2026-10-23",
    pour: "tous",
    titre: "L'assistant répond de nouveau",
    resume: "L'assistant ne répondait plus depuis le 20 octobre : son fournisseur d'IA a fermé son offre gratuite. "
          + "Il passe maintenant par Scaleway, hébergeur français : mêmes modèles d'IA, hébergés à Paris, "
          + "et les messages ne sont ni conservés ni utilisés pour entraîner l'IA. Ce changement de prestataire "
          + "met à jour les conditions d'utilisation : elles seront présentées à la prochaine connexion.",
  },
  {
    id: "2026-10-23-questions-ia",
    date: "2026-10-23",
    pour: "formateurs",
    titre: "Des questions de QCM proposées par l'IA, validées par vous",
    resume: "Dans l'éditeur du QCM d'un thème, « Proposer avec l'IA » rédige des brouillons de questions "
          + "à partir du seul cours vérifié du thème. Les brouillons restent invisibles des stagiaires : "
          + "chacun se relit, se corrige, puis s'accepte ou se rejette. Une question acceptée entre dans le QCM "
          + "avec la mention « IA · validée par » et le nom du formateur. Un brouillon qui cite un article de loi "
          + "absent du cours est écarté d'office. Seul le texte du cours est envoyé à l'IA (hébergée à Paris "
          + "par Scaleway), jamais une donnée de stagiaire ; dix demandes par jour et par formateur.",
    ou: { label: "Cours", route: "themes" },
    module: "qcm",
    guide: [
      "Cours et QCM, onglet Thèmes : ouvrez le QCM d'un thème, puis « Modifier » et « Éditer les questions ».",
      "En bas de l'éditeur, « Proposer avec l'IA » : choisissez le nombre de questions et la partie du cours.",
      "Chaque brouillon : « Relire et accepter » (corrigez si besoin, puis « Accepter dans le QCM ») ou « Rejeter ».",
    ],
  },
  {
    id: "2026-10-23-notes-en-formation",
    date: "2026-10-23",
    pour: "tous",
    titre: "Les moyennes de la classe ne comptent que les stagiaires en formation",
    resume: "Dans Notes, la synthèse de la classe (moyenne, médiane, notes sous 10, moyennes par thème "
          + "et par compétence) ne compte plus les notes des stagiaires qui ont arrêté la formation. "
          + "La règle est écrite sous « Synthèse classe ». Le tableau de bord des formateurs donne "
          + "désormais exactement les mêmes chiffres.",
    ou: { label: "Notes, Synthèse classe", route: "notes" },
  },
  {
    id: "2026-10-23-tableau-de-bord-centre",
    date: "2026-10-23",
    pour: "formateurs",
    titre: "Un tableau de bord du centre, promo par promo",
    resume: "Une nouvelle page réunit les chiffres d'une promo : effectif, taux d'abandon, absences aux "
          + "passages, passages réalisés, QCM, examens, notes et EPCF, les thèmes où la promo échoue le "
          + "plus et les stagiaires à suivre de près. Chaque chiffre dit comment il est calculé et s'il est "
          + "mesuré ou estimé. Les promos se comparent côte à côte, la page s'imprime en PDF et la matrice "
          + "des notes se télécharge pour Excel, avec ou sans les noms.",
    ou: { label: "Accueil, tuile Tableau de bord", route: "centre" },
    guide: [
      "Ouvrez Indicateurs, dans la barre de gauche (groupe Promo) ; sur téléphone, dans « Plus ».",
      "Touchez « Méthode » sous un chiffre pour voir son calcul.",
      "« Exporter en PDF » pour l'imprimer ; « Matrice des notes (CSV) » pour l'ouvrir dans Excel.",
    ],
  },
  {
    id: "2026-10-23-marquage-t4",
    date: "2026-10-23",
    pour: "tous",
    titre: "Marquage au sol : la ligne de la bande d'arrêt d'urgence est une T4",
    resume: "Dans le cours sur la signalisation horizontale, la ligne qui borde la bande d'arrêt d'urgence "
          + "sur autoroute (traits de 39 m, intervalles de 13 m) portait le code T'3. Son vrai nom est T4. "
          + "Le code T'3 désigne une autre ligne, de 20 m et 6 m, qu'on trouve sur les bretelles. "
          + "Les longueurs à retenir ne changent pas.",
    ou: { label: "Cours", route: "themes" },
  },
  {
    id: "2026-10-15-avis-stagiaires",
    date: "2026-10-15",
    pour: "formateurs",
    titre: "Un bandeau pour recueillir l'avis des stagiaires de Nîmes",
    resume: "Jusqu'au 30 novembre, les stagiaires de la promo de Nîmes voient en haut de « Mon suivi » "
          + "une invitation à donner leur avis sur l'app, en cinq minutes. Le questionnaire est anonyme : "
          + "il se remplit sur Google Forms, sans nom ni adresse, et l'app n'enregistre aucune réponse. "
          + "Chacun peut répondre, repousser au lendemain ou ne plus afficher le bandeau.",
  },
  {
    id: "2026-10-13-formateurs-sans-conditions",
    date: "2026-10-13",
    pour: "formateurs",
    titre: "Plus de fenêtre de conditions pour les formateurs",
    resume: "La fenêtre « Avant de commencer », qui demandait d'accepter les conditions d'utilisation, "
          + "ne s'affiche plus pour les formateurs : son texte était écrit pour les stagiaires. "
          + "Les stagiaires, eux, la voient toujours une fois.",
  },
  {
    id: "2026-10-05-effacement-donnees",
    date: "2026-10-05",
    pour: "formateurs",
    titre: "Effacer les données d'un stagiaire, à sa demande",
    resume: "Un stagiaire peut demander la suppression de ses données. Marquez-le d'abord en abandon, "
          + "puis « Effacer les données » dans Paramètres : son compte, sa date de naissance, son livret EPCF, "
          + "son dossier professionnel et les commentaires disparaissent ; ses notes restent, sans nom, dans les "
          + "moyennes. Une nouvelle partie « Données personnelles » montre aussi quand une promo pourra "
          + "être anonymisée (12 mois après sa fin) et les élèves bénévoles à supprimer.",
    ou: { label: "Paramètres", route: "config" },
    // Étapes réécrites au lot Q5 (conservation des données) : le bouton « Effacer les données » a quitté les Abandons, et une
    // demande ne passe plus par l'abandon (elle fausserait le taux). Le titre et le récit, datés, restent ceux du 05/10.
    guide: [
      "L'effacement des données se demande maintenant au fondateur : transmettez-lui la demande de la personne, sans la marquer en abandon.",
      "Le fondateur efface tout, tout de suite, sur sa page Qualiopi ; la personne n'est pas comptée en abandon.",
      "Réglages, partie « Données personnelles » : les élèves bénévoles inactifs.",
    ],
  },
  {
    id: "2026-10-04-competences-conduite-liste",
    date: "2026-10-04",
    pour: "tous",
    titre: "Compétences de conduite : la liste du livret officiel",
    resume: "Dans Cours, onglet Compétences, les compétences de conduite C1 à C4 suivent maintenant "
          + "exactement le livret d'apprentissage : 32 sous-compétences, chacune avec son code (C2.4, C3.7…). "
          + "La compétence 2 a retrouvé ses sept intitulés officiels, et la compétence 3 gagne deux "
          + "sous-compétences : la circulation inter-files des motards, et les tunnels et les ponts.",
    ou: { label: "Cours, onglet Compétences", route: "themes", sousOnglet: "competences" },
  },
  {
    id: "2026-10-04-cours-competences-blocs",
    date: "2026-10-04",
    pour: "formateurs",
    titre: "Cours de compétences : schémas animés, quiz et cartes",
    resume: "Les cours peuvent maintenant contenir des schémas animés (la voiture fait la manœuvre et les "
          + "étapes s'allument), des quiz corrigés tout de suite et des cartes d'autoévaluation. Les cours "
          + "de compétences arriveront au fil de leur vérification.",
    ou: { label: "Cours, onglet Compétences", route: "themes", sousOnglet: "competences" },
    guide: [
      "Ouvrez Cours et QCM, puis l'onglet Compétences.",
      "Dans un cours, le schéma se lance quand il apparaît à l'écran ; touchez une étape pour y revenir.",
      "Bouton Modifier, puis Blocs, pour ajouter un schéma, un quiz ou des cartes dans un cours.",
    ],
  },
  {
    id: "2026-10-05-conditions-utilisation",
    date: "2026-10-05",
    pour: "tous",
    titre: "Conditions d'utilisation et données personnelles",
    resume: "À la prochaine connexion, l'application présente ses conditions d'utilisation : "
          + "l'essentiel en huit lignes, le texte complet en un toucher. On y voit qui accède à quoi, "
          + "combien de temps les données sont gardées et comment les faire supprimer. Elles "
          + "restent consultables à tout moment dans Mon compte, sous « Informations légales ».",
  },
  {
    id: "2026-10-05-benevoles-information",
    date: "2026-10-05",
    pour: "formateurs",
    titre: "Élèves bénévoles : les prévenir que leurs coordonnées sont enregistrées",
    resume: "La loi demande d'informer les élèves bénévoles de ce que l'on garde sur eux. À leur "
          + "première venue, envoyez-leur le lien des informations légales de l'application "
          + "(section 7 : ce qui est enregistré, qui le voit, combien de temps).",
    guide: [
      "Envoyez par SMS : « Bonjour, pour organiser les séances, nous enregistrons vos nom, téléphone, niveau et disponibilités. Détails et droits : https://watchi64.github.io/ecsr-promo/#/informations-legales (section 7). »",
      "Pour un élève mineur, enregistrez de préférence le numéro d'un parent, avec son accord.",
      "Dans les champs de commentaire (bénévoles, passages, notes), rien sur la santé ni la vie privée : une absence se note « absent ».",
    ],
  },
  {
    id: "2026-10-04-confidentialite-notes",
    date: "2026-10-04",
    pour: "tous",
    titre: "Notes et fiche de suivi mieux protégées",
    resume: "Quand un stagiaire masque ses notes, plus personne dans la promo ne peut les consulter, même en "
          + "dehors des écrans de l'application : les moyennes du groupe sont désormais calculées "
          + "à part, sans exposer les notes de chacun. La date de naissance et la fiche de suivi d'un stagiaire "
          + "ne sont visibles que de lui et des formateurs. Rien ne change dans ce qui s'affiche.",
    ou: { label: "Notes", route: "notes" },
  },
  {
    id: "2026-10-03-numero-benevole",
    date: "2026-10-03",
    pour: "formateurs",
    titre: "Planning : le numéro d'un élève bénévole en un toucher",
    resume: "Dans le planning, touchez le nom d'un élève bénévole pour afficher son numéro et "
          + "l'appeler.",
    ou: { label: "Planning", route: "planning" },
  },
  {
    id: "2026-10-03-barre-jours-telephone",
    date: "2026-10-03",
    pour: "tous",
    titre: "Planning : la barre des jours reste en haut",
    resume: "Sur téléphone, la barre des jours du planning reste visible pendant le défilement "
          + "de la semaine.",
    ou: { label: "Planning", route: "planning" },
  },
  {
    id: "2026-10-03-page-stagiaires",
    date: "2026-10-03",
    pour: "formateurs",
    titre: "Une page Stagiaires : toute la promo, une fiche par personne",
    resume: "La tuile Stagiaires de l'Accueil (ou le bouton de votre compte) ouvre la liste de la "
          + "promo, avec où en est chacun : épreuves EPCF évaluées, livret EPCF, dossier professionnel. La fiche "
          + "d'un stagiaire réunit vos outils : la saisie de l'EPCF, son livret EPCF et son dossier professionnel. "
          + "Notes garde la vue de la classe.",
    ou: { label: "Accueil, tuile Stagiaires", route: "stagiaires" },
    guide: [
      "Ouvrez Stagiaires, dans la barre de gauche (sur téléphone, en bas de l'écran).",
      "Choisissez un stagiaire : sa fiche s'ouvre à côté de la liste, ou en plein écran sur téléphone.",
      "Partie Évaluations EPCF : Évaluer ou Modifier chaque épreuve. Parties Livret EPCF et Dossier professionnel : "
        + "remplissez-les ou relisez-les.",
    ],
  },
  {
    id: "2026-10-03-deux-promos",
    date: "2026-10-03",
    pour: "formateurs",
    titre: "Deux promos dans l'app, et des modules réglés promo par promo",
    resume: "La promo de septembre a sa place dans l'app, à côté de celle de mars. En haut de "
          + "l'écran, une pastille indique la promo affichée : touchez-la pour changer. Chaque "
          + "appareil retient votre choix. Planning, calendrier, notes, passages, progression des "
          + "thèmes et examens QCM sont propres à chaque promo ; cours, banque de questions, "
          + "ressources, ainsi que la liste des thèmes et des notions pédagogiques, restent communs. Les "
          + "élèves bénévoles et les auto-écoles sont rangés par lieu. Et la section « Modules "
          + "de la promo » des Paramètres vous est ouverte : elle règle les outils de la promo "
          + "affichée, et d'elle seule.",
    ou: { label: "Pastille en haut, à côté de ton nom", route: "home" },
    guide: [
      "Touchez la promo en tête de la barre de gauche (sur téléphone, en haut de l'écran).",
      "Choisissez « Montpellier, septembre 2026 » : la page se recharge sur cette promo.",
      "Dans Réglages, ajoutez les stagiaires de la promo (prénom et nom de famille), puis "
        + "préparez les dates clés et le planning.",
      "Avant d'inviter les stagiaires de septembre : Réglages, « Ce que voient les stagiaires », "
        + "« Revenir aux modules de départ ».",
    ],
  },
  {
    id: "2026-10-03-parcours-ccp2",
    date: "2026-10-03",
    pour: "tous",
    module: "ccp2",
    titre: "Nouvel onglet CCP2 : le parcours en 8 étapes",
    resume: "Du choix du commanditaire au jour de l'épreuve du CCP2 (certificat de compétences professionnelles "
          + "n° 2), chaque étape dit ce que le jury regarde, comment s'y prendre et ce qu'il faut garder pour le "
          + "dossier écrit. Les dates de stage et d'examen sont rappelées en haut de la page.",
    ou: { label: "CCP2", route: "ccp2" },
  },
  {
    id: "2026-10-01-guide-ccp2-videos",
    date: "2026-10-01",
    pour: "tous",
    titre: "Des vidéos conseillées dans la boîte à outils CCP2",
    resume: "Pour chaque outil du guide (raccourcis, Drive, Docs, Forms, Canva, dictée, IA), "
          + "une ou deux vidéos YouTube en français, récentes et claires pour débuter, choisies "
          + "pour éviter de chercher longtemps. Le guide se télécharge aussi en PDF à imprimer : "
          + "chaque vidéo y a son QR code, à viser avec l'appareil photo du téléphone.",
    ou: { label: "Ressources, Examens", route: "ressources" },
  },
  {
    id: "2026-10-02-passages-toute-date",
    date: "2026-10-02",
    pour: "tous",
    titre: "Un passage oublié ? Chacun peut l'ajouter, même ancien",
    resume: "Chaque stagiaire peut enregistrer un passage (au tableau ou en voiture) à n'importe quelle "
          + "date passée et corriger les siens en cas d'erreur. Seule la suppression d'un passage passe par un "
          + "formateur. La limite de 2 jours indiquée sur l'accueil n'existe plus.",
    ou: { label: "Planning, bouton Priorités", route: "dashboard" },
  },
  {
    id: "2026-09-30-boite-a-outils-ccp2",
    date: "2026-09-30",
    pour: "tous",
    titre: "Une boîte à outils numérique pour le CCP2",
    resume: "Un guide pour se simplifier la vie pendant le CCP2 : les raccourcis clavier "
          + "les plus utiles, les gestes de base de la souris, puis Google Drive, Docs, Forms, "
          + "Canva, la dictée vocale et l'IA. Pour chaque outil : un écran annoté qui montre "
          + "où cliquer, les manipulations de base pas à pas, les liens pour l'ouvrir, et des "
          + "réflexes pour se débrouiller même quand l'écran ne ressemble pas à l'image.",
    ou: { label: "Ressources", route: "ressources" },
  },
  {
    id: "2026-09-18-mot-de-passe-oublie",
    date: "2026-09-18",
    pour: "tous",
    titre: "Un mot de passe oublié se réinitialise sans aide",
    resume: "En cas d'oubli du mot de passe, cliquer sur « Mot de passe oublié ? » sur l'écran "
          + "de connexion. Un lien arrive par e-mail, valable une heure, pour en choisir un "
          + "nouveau. Plus besoin de demander à un formateur de débloquer le compte.",
  },
  {
    id: "2026-09-16-derniere-page",
    date: "2026-09-16",
    pour: "tous",
    titre: "L'app rouvre sur la dernière page consultée",
    resume: "Jusqu'ici, ouvrir l'app ramenait toujours sur Mon suivi. Désormais elle "
          + "retrouve la page ouverte la dernière fois, et même l'onglet. Qui consulte "
          + "souvent le planning ou les thèmes y revient donc directement.",
  },
  {
    id: "2026-09-16-dp-formateurs",
    date: "2026-09-16",
    pour: "tous",
    module: "dp",
    titre: "Les formateurs peuvent aider directement dans le dossier professionnel",
    resume: "Le dossier professionnel reste le document du stagiaire : c'est lui qui le rédige et qui "
          + "le signe. Mais les formateurs peuvent maintenant écrire dedans pour "
          + "l'accompagner, au lieu de seulement le lire. Chaque enregistrement retient qui "
          + "a écrit en dernier, et cette information s'affiche en haut du dossier : le stagiaire voit "
          + "donc toujours si quelqu'un y est passé après lui.",
    ou: { label: "Mon espace personnel, partie Dossier professionnel", route: "mon-suivi", sousOnglet: "dp" },
  },
  {
    id: "2026-09-15-dp-mise-en-page",
    date: "2026-09-15",
    pour: "tous",
    module: "dp",
    titre: "Le dossier professionnel a repris la mise en page officielle",
    resume: "Le dossier professionnel de l'app ressemble maintenant trait pour trait au document du "
          + "ministère : bandeaux magenta, en-tête et pied de page officiels, cartouches "
          + "d'activité-type. Surtout, quand un texte dépasse la page, le document "
          + "continue proprement sur la feuille suivante au lieu de tout décaler, et le "
          + "sommaire annonce les bons numéros de page. Pendant la saisie, un trait "
          + "pointillé montre où le document changera de feuille. Rien de ce qui "
          + "était déjà saisi n'a bougé.",
    ou: { label: "Mon espace personnel, partie Dossier professionnel", route: "mon-suivi", sousOnglet: "dp" },
  },
  {
    id: "2026-08-26-cours-pour-tous",
    date: "2026-08-26",
    pour: "tous",
    module: "cours",
    titre: "Les cours des 57 thèmes sont ouverts à toute la promo",
    resume: "Jusqu'ici réservés aux formateurs, les cours complets des 57 thèmes sont "
          + "maintenant lisibles par tout le monde. Dans la page Thèmes, le bouton "
          + "« Lire le cours » ouvre le cours en plein écran : l'essentiel en tête, les "
          + "sanctions en fiches, les planches de panneaux, et un sommaire pour naviguer. "
          + "En fin de lecture, un bouton enchaîne directement sur le QCM du thème.",
    ou: { label: "Cours", route: "themes" },
  },
  {
    id: "2026-08-21-anonymat-notes",
    date: "2026-08-21",
    pour: "tous",
    module: "notes",
    titre: "Anonyme pour de vrai dans le tableau de notes",
    resume: "Jusqu'ici, passer en anonyme cachait seulement le prénom. Désormais, les notes "
          + "disparaissent aussi pour les autres stagiaires (elles comptent toujours dans les "
          + "moyennes du groupe). En échange, un stagiaire anonyme ne voit plus leurs notes : il garde sa ligne, "
          + "la moyenne du groupe, la moyenne haute et la moyenne basse. Après un changement, "
          + "il reste 2 minutes pour annuler, puis le réglage est bloqué pendant 24 h. Les "
          + "formateurs, eux, voient toujours tout.",
    ou: { label: "Paramètres, Mes préférences", route: "config" },
  },
  {
    id: "2026-08-19-editeur-enregistrer",
    date: "2026-08-19",
    pour: "formateurs",
    titre: "Le bouton Enregistrer de l'éditeur de cours vous répond",
    resume: "Quand vous enregistrez un cours, le bouton affiche « Enregistrement... » puis "
          + "« Enregistré » avec une coche quand c'est bien parti. En cas de problème, un "
          + "message clair s'affiche et votre texte reste dans l'éditeur. Pareil pour Publier.",
  },
  {
    id: "2026-08-19-assistant-mobile",
    date: "2026-08-19",
    pour: "tous",
    module: "assistant",
    titre: "L'assistant s'ouvre sans zoomer sur le téléphone",
    resume: "Ouvrir l'assistant sur téléphone zoomait la page et sortait le clavier direct. "
          + "C'est réglé : la fenêtre s'ouvre tranquillement, la conversation se lit en "
          + "entier et le clavier ne sort qu'en touchant le champ.",
  },
  {
    id: "2026-08-19-themes-mobile",
    date: "2026-08-19",
    pour: "tous",
    titre: "La page Thèmes, enfin lisible sur le téléphone",
    resume: "Les cartes des thèmes s'affichent proprement sur téléphone : numéro en pastille "
          + "à côté du titre, titre sur toute la largeur, boutons Cours et QCM bien alignés "
          + "avec les notes. Et le champ de recherche ne ferme plus le clavier à chaque "
          + "lettre : la recherche se tape d'une traite, la liste se filtre en direct.",
    ou: { label: "Cours", route: "themes" },
  },
  {
    id: "2026-08-15-assistant",
    date: "2026-08-15",
    pour: "tous",
    module: "assistant",
    titre: "Un assistant répond aux questions, partout dans l'app",
    resume: "Le bouton rond en bas à droite ouvre un assistant qui connaît les 57 cours, "
          + "vérifie la réglementation directement sur Légifrance et explique le "
          + "fonctionnement de l'app. Il cite ses sources, et chacun dispose de 30 "
          + "questions par jour.",
  },
  {
    id: "2026-08-10-barre-entrainement",
    date: "2026-08-10",
    pour: "tous",
    module: "qcm",
    titre: "La progression d'entraînement se voit d'un coup d'œil",
    resume: "Dans la liste des thèmes, une barre colorée sous chaque QCM se remplit avec la "
          + "dernière note d'entraînement. Plus la barre est verte et pleine, plus le thème "
          + "est acquis : un survol suffit pour repérer ceux qui méritent une nouvelle passe.",
    ou: { label: "Cours, colonne QCM", route: "themes" },
  },
  {
    id: "2026-08-09-cours-en-relecture",
    date: "2026-08-09",
    pour: "formateurs",
    titre: "Les 57 cours sont dans l'app, à relire et à publier",
    resume: "Chaque thème porte maintenant son cours complet, visible des formateurs "
          + "seulement. Vous le lisez, vous le corrigez directement dans l'app (l'aperçu montre "
          + "exactement ce que verra l'élève), et vous le publiez quand il est prêt : rien "
          + "n'est visible de la promo sans votre décision, cours par cours. Chaque "
          + "enregistrement garde une version : rien ne se perd, tout se restaure.",
    ou: { label: "Cours, colonne Cours", route: "themes" },
    guide: [
      "Ouvrez Cours et QCM, onglet Thèmes : chaque thème a sa colonne Cours. Le bouton reste "
        + "en couleur tant que vous n'avez pas encore ouvert ce cours sur votre appareil.",
      "« Modifier » ouvre l'éditeur : corrigez à gauche, contrôlez l'aperçu à droite.",
      "Le bouton Panneaux ouvre la galerie : cherchez un panneau par son nom, un clic l'insère.",
      "Enregistrez, puis « Publier » quand le cours est prêt pour la promo.",
      "En fin de cours, un bouton enchaîne sur le QCM du thème.",
    ],
  },
  {
    id: "2026-08-08-signalement-reponse-visee",
    date: "2026-08-08",
    pour: "tous",
    module: "qcm",
    titre: "Une contestation dit maintenant quelle réponse pose problème",
    resume: "Le formulaire de contestation demande maintenant laquelle des réponses est en "
          + "cause. C'est utile : les réponses sont mélangées à chaque passage, donc écrire "
          + "« la réponse D » ne voulait rien dire une fois la contestation reçue. Et ça sert : "
          + "les contestations de la semaine ont abouti à huit questions corrigées.",
    ou: { label: "Cours, colonne QCM", route: "themes" },
    guide: [
      "Pendant un entraînement, répondre à la question, puis toucher « Contester cette question ».",
      "Choisir le motif, puis la réponse concernée dans la liste, ou laisser « toute la question » "
        + "si c'est l'énoncé ou l'explication qui cloche.",
      "Ajouter un mot d'explication si besoin, et envoyer.",
    ],
  },
  {
    id: "2026-08-08-console-signalements",
    date: "2026-08-08",
    pour: "formateurs",
    titre: "Toutes les questions contestées au même endroit, déjà analysées",
    resume: "Un onglet Questions contestées rassemble les contestations de tous les QCM, rangées par "
          + "ce qu'elles demandent : celles où le stagiaire a raison d'abord, puis celles à trancher, puis "
          + "celles qui n'appellent rien. Chacune arrive avec une analyse déjà faite (articles de "
          + "loi revérifiés, chiffres recoupés), mais la décision reste la vôtre : l'avis ne "
          + "corrige jamais une question de lui-même.",
    ou: { label: "Cours, onglet Questions contestées", route: "themes", sousOnglet: "signalements" },
    guide: [
      "Ouvrez Cours et QCM, puis l'onglet Questions contestées.",
      "Lisez l'avis en dépliant « Voir l'analyse », puis tranchez avec « Question corrigée » ou « Pas d'erreur ».",
      "« Ouvrir dans l'éditeur » vous emmène directement sur la question à réécrire.",
    ],
  },
  {
    id: "2026-07-31-qcm-entrainement",
    date: "2026-07-31",
    pour: "tous",
    module: "qcm",
    titre: "Les QCM d'entraînement sont ouverts à toute la promo",
    resume: "Les 57 thèmes ont désormais leur QCM. Chacun s'entraîne autant de fois qu'il le souhaite : "
          + "cela ne compte jamais dans les notes. Les anciennes erreurs repassent en premier, "
          + "pour travailler ce qui manque plutôt que ce qui est déjà su.",
    ou: { label: "Cours, colonne QCM", route: "themes" },
    guide: [
      "Ouvrir Cours et QCM, onglet QCM (pour l'équipe : onglet Thèmes, colonne QCM).",
      "Ouvrir le QCM du thème voulu.",
      "Choisir « S'entraîner », ou « Revoir mes erreurs » pour ne rejouer que les questions ratées.",
    ],
  },
  {
    id: "2026-07-31-qcm-signalement",
    date: "2026-07-31",
    pour: "tous",
    module: "qcm",
    titre: "Contester une question de QCM en un clic",
    resume: "Une question qui paraît fausse, ambiguë ou mal formulée se conteste depuis la "
          + "question elle-même. La contestation arrive aux formateurs, qui corrigent "
          + "pour toute la promo.",
    ou: { label: "Cours, colonne QCM", route: "themes" },
    guide: [
      "Pendant un entraînement, ouvrir la question qui pose problème.",
      "Toucher « Contester cette question », sous la question, et expliquer en une phrase ce qui cloche.",
    ],
  },
  {
    id: "2026-07-31-dossier-professionnel",
    date: "2026-07-31",
    pour: "tous",
    titre: "Le dossier professionnel se remplit dans l'app",
    resume: "Le dossier professionnel présenté au jury se saisit directement ici et s'imprime au "
          + "format officiel. Les réponses sont enregistrées au fur et à mesure, pour y "
          + "revenir autant de fois que nécessaire.",
    ou: { label: "Mon espace personnel, partie Dossier professionnel",
          route: "mon-suivi", sousOnglet: "dp" },
    guide: [
      "Ouvrir Mon suivi, dans la barre.",
      "Aller dans la partie « Dossier professionnel ».",
      "Remplir les exemples, puis imprimer ou enregistrer en PDF une fois le dossier prêt.",
    ],
  },
  {
    id: "2026-07-21-planning-verrou",
    date: "2026-07-21",
    pour: "formateurs",
    titre: "Verrou de semaine et mode Modifier sur le planning",
    resume: "Le planning s'ouvre en lecture seule : il faut passer en mode Modifier pour changer "
          + "quoi que ce soit, ce qui évite les modifications involontaires. Une fois la semaine "
          + "validée, elle se verrouille et s'affiche en vue compacte, plus lisible.",
    ou: { label: "Planning", route: "planning" },
    guide: [
      "Ouvrez le planning, il est en lecture seule par défaut.",
      "Cliquez sur « Modifier » pour éditer, « Quitter l'édition » pour en sortir.",
      "Cochez le verrou dans « Valider la semaine » quand la semaine est figée. Ctrl + Z la déverrouille.",
    ],
  },
  {
    id: "2026-07-19-livret-epcf",
    date: "2026-07-19",
    pour: "tous",
    titre: "Le livret EPCF officiel (TP-01303) dans l'app",
    resume: "Le livret EPCF présenté au jury est rempli ici par le formateur évaluateur ; le stagiaire le "
          + "consulte et l'imprime au format officiel. La date de naissance est reprise automatiquement "
          + "depuis le profil, sans ressaisie.",
    ou: { label: "Mon espace personnel, partie Livret EPCF", route: "mon-suivi", sousOnglet: "livret" },
    guide: [
      "Ouvrir Mon suivi, partie Livret EPCF.",
      "Renseigner la date de naissance si ce n'est pas déjà fait.",
      "Consulter le livret EPCF, puis l'imprimer ou l'enregistrer en PDF.",
    ],
  },
  {
    id: "2026-07-05-auto-ecoles",
    date: "2026-07-05",
    pour: "formateurs",
    titre: "Auto-écoles partenaires et suivi des venues",
    resume: "Les élèves bénévoles peuvent être rattachés à une auto-école partenaire. Chaque "
          + "fiche récapitule ses bénévoles, et le suivi compte les venues déduites du planning "
          + "avec un commentaire par venue.",
    ou: { label: "Planning, bouton Bénévoles", route: "planning" },
    guide: [
      "Ouvrez Stagiaires, onglet « Élèves bénévoles ».",
      "Basculez sur l'onglet « Auto-écoles » du panneau.",
      "Ouvrez une fiche pour voir ses bénévoles, en affilier d'autres ou en créer un directement rattaché.",
    ],
  },
  {
    id: "2026-07-02-benevoles",
    date: "2026-07-02",
    pour: "formateurs",
    titre: "Banque d'élèves bénévoles avec leurs disponibilités",
    resume: "Les élèves bénévoles pour la conduite sont regroupés dans une banque, avec leurs "
          + "disponibilités par demi-journée. Sur une carte Voiture, ceux qui sont disponibles ce "
          + "jour-là remontent en tête de liste.",
    ou: { label: "Planning, bouton Bénévoles", route: "planning" },
    guide: [
      "Ouvrez Stagiaires, onglet « Élèves bénévoles ».",
      "Ajoutez une fiche : seul le prénom est obligatoire, le reste se complète plus tard.",
      "Renseignez la grille de disponibilités pour que le filtre « qui est dispo jeudi matin » fonctionne.",
    ],
  },
];
