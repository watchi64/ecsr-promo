// Contenu de la rubrique Nouveautés, et rien d'autre.
//
// Écrire une nouveauté = ajouter un objet ici, dans le même commit que le code
// qu'elle annonce. L'ordre du tableau n'a pas d'importance : le tri se fait sur
// le champ `date` (cf. js/nouveautes.js).
//
// Champs : id (unique, date en préfixe), date (AAAA-MM-JJ), pour
// ("tous" | "formateurs"), titre, resume. Facultatifs : ou (le chemin dans
// l'app, rendu cliquable) et guide (étapes numérotées).
//
// Public : la promo, des adultes en reconversion. Pas de vocabulaire technique,
// pas de numéro de version, pas de nom de fichier.

export const NOUVEAUTES = [
  {
    id: "2026-08-19-editeur-enregistrer",
    date: "2026-08-19",
    pour: "formateurs",
    titre: "Le bouton Enregistrer de l'éditeur de cours te répond",
    resume: "Quand tu enregistres un cours, le bouton affiche « Enregistrement... » puis "
          + "« Enregistré » avec une coche quand c'est bien parti. En cas de problème, un "
          + "message clair s'affiche et ton texte reste dans l'éditeur. Pareil pour Publier.",
  },
  {
    id: "2026-08-19-assistant-mobile",
    date: "2026-08-19",
    pour: "tous",
    titre: "L'assistant s'ouvre sans zoomer sur ton téléphone",
    resume: "Ouvrir l'assistant sur téléphone zoomait la page et sortait le clavier direct. "
          + "C'est réglé : la fenêtre s'ouvre tranquillement, tu vois la conversation en "
          + "entier et tu tapes dans le champ quand tu veux.",
  },
  {
    id: "2026-08-19-themes-mobile",
    date: "2026-08-19",
    pour: "tous",
    titre: "La page Thèmes, enfin lisible sur ton téléphone",
    resume: "Les cartes des thèmes s'affichent proprement sur téléphone : numéro en pastille "
          + "à côté du titre, titre sur toute la largeur, boutons Cours et QCM bien alignés "
          + "avec tes notes. Et le champ de recherche ne ferme plus ton clavier à chaque "
          + "lettre : tape ta recherche d'une traite, la liste se filtre en direct.",
    ou: { label: "Thèmes", route: "themes" },
  },
  {
    id: "2026-08-15-assistant",
    date: "2026-08-15",
    pour: "tous",
    titre: "Un assistant répond à tes questions, partout dans l'app",
    resume: "Le bouton rond en bas à droite ouvre un assistant qui connaît les 57 cours, "
          + "vérifie la réglementation directement sur Légifrance et t'explique le "
          + "fonctionnement de l'app. Il cite ses sources, et chacun dispose de 30 "
          + "questions par jour.",
  },
  {
    id: "2026-08-10-barre-entrainement",
    date: "2026-08-10",
    pour: "tous",
    titre: "Ta progression d'entraînement se voit d'un coup d'œil",
    resume: "Dans la liste des thèmes, une barre colorée sous chaque QCM se remplit avec ta "
          + "dernière note d'entraînement. Plus la barre est verte et pleine, plus le thème "
          + "est acquis : tu repères en un survol ceux qui méritent une nouvelle passe.",
    ou: { label: "Thèmes, colonne QCM", route: "themes" },
  },
  {
    id: "2026-08-09-cours-en-relecture",
    date: "2026-08-09",
    pour: "formateurs",
    titre: "Les 57 cours sont dans l'app, à relire et à publier",
    resume: "Chaque thème porte maintenant son cours complet, visible des formateurs "
          + "seulement. Tu le lis, tu le corriges directement dans l'app (l'aperçu montre "
          + "exactement ce que verra l'élève), et tu le publies quand il est prêt : rien "
          + "n'est visible de la promo sans ta décision, cours par cours. Chaque "
          + "enregistrement garde une version : rien ne se perd, tout se restaure.",
    ou: { label: "Thèmes, badge Cours", route: "themes" },
    guide: [
      "Ouvre l'onglet Thèmes : chaque thème a sa colonne Cours. Le bouton reste "
        + "en couleur tant que tu n'as pas encore ouvert ce cours sur ton appareil.",
      "« Modifier » ouvre l'éditeur : corrige à gauche, contrôle l'aperçu à droite.",
      "Le bouton Panneaux ouvre la galerie : cherche un panneau par son nom, un clic l'insère.",
      "Enregistre, puis « Publier » quand le cours est prêt pour la promo.",
      "En fin de cours, un bouton enchaîne sur le QCM du thème.",
    ],
  },
  {
    id: "2026-08-08-signalement-reponse-visee",
    date: "2026-08-08",
    pour: "tous",
    titre: "Dis quelle réponse te pose problème quand tu signales",
    resume: "Le formulaire de signalement te demande maintenant laquelle des réponses est en "
          + "cause. C'est utile : les réponses sont mélangées à chaque passage, donc écrire "
          + "« la réponse D » ne voulait rien dire une fois le signalement reçu. Et ça sert : "
          + "les signalements de la semaine ont abouti à huit questions corrigées.",
    ou: { label: "Thèmes, colonne QCM", route: "themes" },
    guide: [
      "Pendant un entraînement, réponds à la question, puis utilise le lien de signalement.",
      "Choisis le motif, puis la réponse concernée dans la liste, ou laisse « toute la question » "
        + "si c'est l'énoncé ou l'explication qui cloche.",
      "Ajoute un mot d'explication si tu veux, et envoie.",
    ],
  },
  {
    id: "2026-08-08-console-signalements",
    date: "2026-08-08",
    pour: "formateurs",
    titre: "Tous les signalements au même endroit, déjà instruits",
    resume: "Un sous-onglet Signalements rassemble les signalements de tous les QCM, rangés par "
          + "ce qu'ils demandent : ceux où l'élève a raison d'abord, puis ceux à trancher, puis "
          + "ceux qui n'appellent rien. Chacun arrive avec une analyse déjà faite (articles de "
          + "loi revérifiés, chiffres recoupés), mais la décision reste la tienne : l'avis ne "
          + "corrige jamais une question de lui-même.",
    ou: { label: "Thèmes, sous-onglet Signalements", route: "themes" },
    guide: [
      "Ouvre l'onglet Thèmes, puis le sous-onglet Signalements.",
      "Lis l'avis en dépliant « Voir l'analyse », puis tranche avec « Corrigé » ou « Rien à corriger ».",
      "« Ouvrir dans l'éditeur » t'emmène directement sur la question à réécrire.",
    ],
  },
  {
    id: "2026-07-31-qcm-entrainement",
    date: "2026-07-31",
    pour: "tous",
    titre: "Les QCM d'entraînement sont ouverts à toute la promo",
    resume: "Les 57 thèmes ont désormais leur QCM. Tu t'entraînes autant de fois que tu veux, "
          + "ça ne compte jamais dans tes notes. Tes anciennes erreurs repassent en premier, "
          + "pour que tu travailles ce qui te manque plutôt que ce que tu sais déjà.",
    ou: { label: "Thèmes, colonne QCM", route: "themes" },
    guide: [
      "Ouvre l'onglet Thèmes.",
      "Clique sur le bouton QCM à droite du thème qui t'intéresse.",
      "Choisis « S'entraîner », ou « Revoir mes erreurs » pour ne rejouer que les questions ratées.",
    ],
  },
  {
    id: "2026-07-31-qcm-signalement",
    date: "2026-07-31",
    pour: "tous",
    titre: "Signale une erreur dans un QCM en un clic",
    resume: "Si une question te paraît fausse, ambiguë ou mal formulée, tu peux le signaler "
          + "depuis la question elle-même. Le signalement arrive aux formateurs, qui corrigent "
          + "pour toute la promo.",
    ou: { label: "Thèmes, colonne QCM", route: "themes" },
    guide: [
      "Pendant un entraînement, ouvre la question qui te pose problème.",
      "Utilise le lien de signalement sous la question et explique en une phrase ce qui cloche.",
    ],
  },
  {
    id: "2026-07-31-dossier-professionnel",
    date: "2026-07-31",
    pour: "tous",
    titre: "Ton Dossier Professionnel se remplit dans l'app",
    resume: "Le dossier que tu présentes au jury se saisit directement ici et s'imprime au "
          + "format officiel. Tes réponses sont enregistrées au fur et à mesure, tu peux y "
          + "revenir autant de fois que tu veux.",
    ou: { label: "Mon espace personnel, sous-onglet Dossier pro",
          route: "mon-suivi", sousOnglet: "dp" },
    guide: [
      "Ouvre ton espace personnel avec le logo en haut à gauche.",
      "Va sur le sous-onglet « Dossier pro ».",
      "Remplis tes exemples, puis imprime ou enregistre en PDF quand tu es prêt.",
    ],
  },
  {
    id: "2026-07-23-espace-personnel",
    date: "2026-07-23",
    pour: "tous",
    titre: "L'app s'ouvre sur ton espace personnel",
    resume: "En arrivant, tu vois d'abord ce qui te concerne : tes prochains créneaux, tes "
          + "passages déjà effectués et tes résultats. L'ancien tableau de bord s'appelle "
          + "maintenant « Priorités » et sert à voir qui doit passer dans la promo.",
    ou: { label: "Le logo en haut à gauche", route: "mon-suivi" },
    guide: [
      "Clique sur le logo en haut à gauche pour revenir à ton espace à tout moment.",
      "Le sous-onglet « Passages » compte ce que tu as déjà fait, en salle et en voiture.",
      "Le bouton « Aujourd'hui au planning » t'emmène directement à la journée en cours.",
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
      "Ouvre le planning, il est en lecture seule par défaut.",
      "Clique sur « Modifier » pour éditer, « Terminer » pour en sortir.",
      "Coche le verrou dans « Valider la semaine » quand la semaine est figée. Ctrl + Z la déverrouille.",
    ],
  },
  {
    id: "2026-07-19-livret-epcf",
    date: "2026-07-19",
    pour: "tous",
    titre: "Ton livret officiel TP-01303 se remplit dans l'app",
    resume: "Le livret que tu présentes au jury se saisit ici et s'imprime au format officiel. "
          + "Ta date de naissance est reprise automatiquement depuis ton profil, tu n'as pas à "
          + "la ressaisir.",
    ou: { label: "Notes, sous-onglet Livret EPCF", route: "notes", sousOnglet: "livret" },
    guide: [
      "Renseigne ta date de naissance dans ton espace personnel si ce n'est pas déjà fait.",
      "Ouvre l'onglet Notes, sous-onglet « Livret EPCF ».",
      "Remplis le livret, puis imprime ou enregistre en PDF.",
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
      "Ouvre le planning et clique sur « Bénévoles » dans la barre de semaine.",
      "Bascule sur l'onglet « Auto-écoles » du panneau.",
      "Ouvre une fiche pour voir ses bénévoles, en affilier d'autres ou en créer un directement rattaché.",
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
      "Ouvre le planning et clique sur « Bénévoles » dans la barre de semaine.",
      "Ajoute une fiche : seul le prénom est obligatoire, le reste se complète plus tard.",
      "Renseigne la grille de disponibilités pour que le filtre « qui est dispo jeudi matin » fonctionne.",
    ],
  },
];
