// Catalogue des modules (chantier B) : les parties de l'app qu'un formateur
// ouvre ou ferme pour une promo. Contenu seulement : les règles vivent dans
// js/modules.js, la lecture et l'écriture de l'état dans js/modules-etat.js.
//
// Ajouter un module = ajouter une entrée ici, dans l'ordre de la progression
// (c'est l'ordre de la section de réglage), puis déclarer `module: "<clé>"` sur
// le sous-onglet qu'il gouverne, ou sa route dans MODULE_DE_ROUTE.
//
// Champs : cle (stable, jamais renommée : elle est stockée en base), nom,
// accord du participe (ms, fs, mp, fp : « Notes ouvertes »), groupe (un des
// GROUPES), parent (facultatif : module dans lequel celui-ci est rangé ; un
// seul niveau), depart (ouvert dans l'ensemble de départ), explication (ligne du
// réglage, lue par l'équipe), annonce { titre, resume, ou } (nouveauté générée à
// l'ouverture, envoyée à tous, stagiaires et équipe : formule neutre, ni tu ni vous,
// sans jargon ; décision du 10/11).
// Aucun import : le fichier est lu tel quel par les tests node.

// Les sigles CCP1 et CCP2 sont définis dans le titre de leur groupe : c'est leur première
// apparition dans le réglage.
export const GROUPE_CCP1 = "CCP1 (certificat de compétences professionnelles n° 1)";
export const GROUPE_CCP2 = "CCP2 (certificat de compétences professionnelles n° 2)";
export const GROUPES = ["Démarrage", "Suivi de la formation", GROUPE_CCP1, "Dossier professionnel", GROUPE_CCP2, "Outils"];

// Routes jamais fermées. Elles n'ont pas de module.
// stagiaires : page des formateurs, hors modules (chantier D, lot 2).
// emargement : page des formateurs (spec 2026-10-23) ; un stagiaire ne voit rien tant
// qu'aucune feuille n'est ouverte, il n'y a donc rien à masquer par un module.
// preferences : Mes préférences, la page de la personne sous la nouvelle navigation (menu du compte) ;
// avec l'ancienne, son adresse mène à config (js/nav-rules.js).
export const ROUTES_SOCLE = ["home", "mon-suivi", "config", "nouveautes", "stagiaires", "emargement", "preferences"];

// Route d'un onglet vers le module qui la gouverne.
export const MODULE_DE_ROUTE = {
  planning: "planning",
  calendrier: "calendrier",
  ressources: "ressources",
  dashboard: "priorites",
  notes: "notes",
  themes: "themes",
  ccp2: "ccp2",
};

// Sous-onglets rattachés à un module, par route. Sert aux liens « Où le
// trouver » des nouveautés ; les vues, elles, déclarent `module` sur leurs
// sous-onglets (js/views/notes.js, js/views/mon-suivi.js, et sous la nouvelle
// navigation js/views/planning-espace.js et js/views/themes.js). Garder les deux
// d'accord.
export const MODULE_DE_SOUS_ONGLET = {
  notes: { matrice: "notes", epcf: "epcf" },
  "mon-suivi": { evolution: "notes", epcf: "epcf", livret: "livret", dp: "dp", classe: "notes" },
  planning: { semaine: "planning", dates: "calendrier", priorites: "priorites" },
  themes: { themes: "themes", competences: "themes", qcm: "qcm", documents: "ressources" },
};

// Ouvert aux formateurs depuis le multi-promo (étape 3 de A) : chacun règle les modules de
// la promo affichée par la pastille, et d'elle seule. Avant, il n'existait qu'une promo et le
// réglage était réservé au fondateur.
export const REGLAGE_OUVERT_AUX_FORMATEURS = true;

export const MODULES = [
  {
    cle: "planning", nom: "Planning", accord: "ms", groupe: "Démarrage", depart: true,
    explication: "Planning de la semaine, la journée du jour repérée.",
    annonce: {
      titre: "Le planning est ouvert",
      resume: "Le planning montre chaque semaine qui passe au tableau et en voiture, et avec quel "
            + "formateur. La journée du jour y est repérée.",
      ou: { label: "Planning", route: "planning" },
    },
  },
  {
    cle: "calendrier", nom: "Calendrier", accord: "ms", groupe: "Démarrage", depart: true,
    explication: "Dates clés : périodes en centre, stages, examens.",
    annonce: {
      titre: "Le calendrier est ouvert",
      resume: "Les grandes dates de la formation : périodes en centre, stages, examens. "
            + "L'Accueil affiche aussi le compte à rebours jusqu'au prochain rendez-vous important.",
      ou: { label: "Calendrier", route: "calendrier" },
    },
  },
  {
    cle: "ressources", nom: "Ressources", accord: "fp", groupe: "Démarrage", depart: true,
    explication: "Contacts du centre et liens utiles.",
    annonce: {
      titre: "Les ressources sont ouvertes",
      resume: "Les contacts utiles du centre et une sélection de liens et de documents pour réviser.",
      ou: { label: "Ressources", route: "ressources" },
    },
  },
  {
    // Clé historique « priorites » (stockée en base, jamais renommée) : la partie s'affiche
    // « Ordre de passage » depuis le 10/11.
    cle: "priorites", nom: "Ordre de passage", accord: "ms", groupe: "Suivi de la formation",
    explication: "Qui doit passer en priorité, en salle et en voiture, dans le Planning.",
    annonce: {
      titre: "L'ordre de passage est ouvert",
      resume: "Dans le Planning, Ordre de passage montre qui doit passer en premier, au tableau "
            + "comme en voiture, pour que chacun ait autant de passages que les autres.",
      ou: { label: "Planning, bouton Priorités", route: "dashboard" },
    },
  },
  {
    cle: "notes", nom: "Notes", accord: "fp", groupe: "Suivi de la formation",
    explication: "Matrice des notes, courbe d'évolution de chaque stagiaire, anonymat.",
    annonce: {
      titre: "Les notes sont ouvertes",
      resume: "Les notes de thèmes s'affichent avec la synthèse de la classe, et une courbe "
            + "trace la progression de chaque stagiaire. Chaque stagiaire peut masquer son prénom "
            + "et ses notes aux autres dans Mes préférences.",
      ou: { label: "Notes", route: "notes" },
    },
  },
  {
    // Clé historique « themes » (stockée en base, jamais renommée) : l'onglet s'affiche
    // désormais « Cours », avec ses sous-onglets Thèmes et Compétences.
    cle: "themes", nom: "Cours", accord: "mp", groupe: "Suivi de la formation",
    explication: "Onglet Cours : thèmes, compétences et progression de la classe.",
    annonce: {
      titre: "L'onglet Cours est ouvert",
      resume: "Les thèmes et les compétences de la formation, avec ceux déjà traités en classe "
            + "et leur date.",
      ou: { label: "Cours", route: "themes" },
    },
  },
  {
    cle: "cours", nom: "Lecture des cours", accord: "fs", groupe: "Suivi de la formation", parent: "themes",
    explication: "Lecture du cours de chaque thème.",
    annonce: {
      titre: "Les cours sont ouverts",
      resume: "Chaque thème a son cours à lire : l'essentiel en quelques lignes, les règles, "
            + "les sanctions et les chiffres clés. Pour le lire, dans l'onglet Cours, toucher le titre "
            + "d'un thème ou son bouton Cours.",
      ou: { label: "Cours, colonne Cours", route: "themes" },
    },
  },
  {
    cle: "qcm", nom: "QCM", accord: "mp", groupe: "Suivi de la formation", parent: "themes",
    explication: "QCM d'entraînement et d'examen.",
    annonce: {
      titre: "Les QCM sont ouverts",
      resume: "Chaque thème a son QCM d'entraînement : les questions ratées reviennent en "
            + "premier jusqu'à ce qu'elles soient maîtrisées.",
      ou: { label: "Cours, colonne QCM", route: "themes" },
    },
  },
  {
    // Premier module du groupe CCP1 : son explication définit le sigle EPCF (première
    // apparition dans le réglage), et son annonce aussi.
    cle: "epcf", nom: "Évaluations EPCF", accord: "fp", groupe: GROUPE_CCP1,
    explication: "EPCF : évaluations passées en cours de formation. Celles du stagiaire dans son suivi, "
               + "les moyennes de la classe avec les notes, la saisie des formateurs dans la page Stagiaires.",
    annonce: {
      titre: "Les évaluations EPCF sont ouvertes",
      resume: "Les résultats des EPCF (évaluations passées en cours de formation) du CCP1, en salle "
            + "et en véhicule, s'affichent dans l'app, avec les moyennes de la classe.",
      ou: { label: "Mon espace personnel, partie Évaluations EPCF", route: "mon-suivi", sousOnglet: "epcf" },
    },
  },
  {
    // Plus de parent : le livret vit dans la fiche (Mon espace, page Stagiaires).
    cle: "livret", nom: "Livret EPCF", accord: "ms", groupe: GROUPE_CCP1,
    explication: "Livret EPCF officiel : le stagiaire le consulte dans son suivi, le formateur évaluateur le remplit dans la page Stagiaires.",
    annonce: {
      titre: "Le livret EPCF est ouvert",
      resume: "Le livret EPCF officiel de chaque stagiaire se consulte dans l'app : c'est le formateur "
            + "évaluateur qui le remplit. La date de naissance, à indiquer dans l'app, y est reportée "
            + "automatiquement.",
      ou: { label: "Mon espace personnel, partie Livret EPCF", route: "mon-suivi", sousOnglet: "livret" },
    },
  },
  {
    cle: "dp", nom: "Dossier professionnel", accord: "ms", groupe: "Dossier professionnel",
    explication: "Dossier professionnel : celui du stagiaire dans son suivi, la relecture des formateurs dans la page Stagiaires.",
    annonce: {
      titre: "Le dossier professionnel est ouvert",
      resume: "Chaque stagiaire remplit son dossier professionnel directement dans l'app, puis l'imprime "
            + "ou l'enregistre en PDF au format officiel. Les formateurs peuvent le relire et "
            + "aider le stagiaire.",
      ou: { label: "Mon espace personnel, partie Dossier professionnel", route: "mon-suivi", sousOnglet: "dp" },
    },
  },
  {
    cle: "ccp2", nom: "CCP2", accord: "ms", groupe: GROUPE_CCP2,
    explication: "Parcours guidé en 8 étapes, du commanditaire à l'épreuve.",
    annonce: {
      titre: "La page CCP2 est ouverte",
      resume: "Le parcours du CCP2 (certificat de compétences professionnelles n° 2) en 8 étapes, du "
            + "choix du commanditaire au jour de l'épreuve : pour chacune, ce que le jury regarde, "
            + "comment s'y prendre et les documents utiles.",
      ou: { label: "CCP2", route: "ccp2" },
    },
  },
  {
    cle: "assistant", nom: "Assistant", accord: "ms", groupe: "Outils",
    explication: "Assistant qui répond sur les cours et le Code de la route.",
    annonce: {
      titre: "L'assistant est ouvert",
      resume: "L'assistant répond aux questions sur les cours et le Code de la route. "
            + "C'est une version d'essai : les points importants se vérifient dans les cours.",
    },
  },
];
