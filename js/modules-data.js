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
// réglage, lue par les formateurs), annonce { titre, resume, ou } (nouveauté
// générée à l'ouverture, lue par les stagiaires : tutoiement, sans jargon).
// Aucun import : le fichier est lu tel quel par les tests node.

export const GROUPES = ["Démarrage", "Suivi de la formation", "CCP1", "Dossier professionnel", "CCP2", "Outils"];

// Routes jamais fermées. Elles n'ont pas de module.
// stagiaires : page des formateurs, hors modules (chantier D, lot 2).
export const ROUTES_SOCLE = ["home", "mon-suivi", "config", "nouveautes", "stagiaires"];

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
// sous-onglets (js/views/notes.js, js/views/mon-suivi.js). Garder les deux
// d'accord.
export const MODULE_DE_SOUS_ONGLET = {
  notes: { matrice: "notes", epcf: "epcf" },
  "mon-suivi": { evolution: "notes", epcf: "epcf", livret: "livret", dp: "dp" },
};

// Ouvert aux formateurs depuis le multi-promo (étape 3 de A) : chacun règle les modules de
// la promo affichée par la pastille, et d'elle seule. Avant, il n'existait qu'une promo et le
// réglage était réservé au fondateur.
export const REGLAGE_OUVERT_AUX_FORMATEURS = true;

export const MODULES = [
  {
    cle: "planning", nom: "Planning", accord: "ms", groupe: "Démarrage", depart: true,
    explication: "Planning de la semaine et bouton « Aujourd'hui ».",
    annonce: {
      titre: "Le planning est ouvert",
      resume: "Retrouve chaque semaine qui passe au tableau et en voiture, et avec quel "
            + "formateur. Le bouton en haut de l'écran t'amène directement à la journée du jour.",
      ou: { label: "Planning", route: "planning" },
    },
  },
  {
    cle: "calendrier", nom: "Calendrier", accord: "ms", groupe: "Démarrage", depart: true,
    explication: "Dates clés : périodes en centre, stages, examens.",
    annonce: {
      titre: "Le calendrier est ouvert",
      resume: "Les grandes dates de ta formation : périodes en centre, stages, examens. "
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
    cle: "priorites", nom: "Priorités", accord: "fp", groupe: "Suivi de la formation",
    explication: "Qui doit passer en priorité, en salle et en voiture : bouton en haut du Planning.",
    annonce: {
      titre: "Les priorités de passage sont ouvertes",
      resume: "Un bouton en haut du Planning montre qui doit passer en priorité, au tableau "
            + "comme en voiture, pour que chacun ait autant de passages que les autres.",
      ou: { label: "Planning, bouton Priorités", route: "dashboard" },
    },
  },
  {
    cle: "notes", nom: "Notes", accord: "fp", groupe: "Suivi de la formation",
    explication: "Matrice des notes, Évolution dans Mon espace, anonymat.",
    annonce: {
      titre: "Les notes sont ouvertes",
      resume: "Tes notes de thèmes s'affichent dans l'onglet Notes, avec la synthèse de la "
            + "classe. Dans ton espace personnel, l'onglet Évolution trace ta progression. "
            + "Si tu préfères, tu peux masquer ton prénom et tes notes aux autres dans Paramètres.",
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
            + "les sanctions et les chiffres clés. Dans l'onglet Cours, clique sur le titre "
            + "d'un thème ou sur son bouton Cours.",
      ou: { label: "Cours, colonne Cours", route: "themes" },
    },
  },
  {
    cle: "qcm", nom: "QCM", accord: "mp", groupe: "Suivi de la formation", parent: "themes",
    explication: "QCM d'entraînement et d'examen.",
    annonce: {
      titre: "Les QCM sont ouverts",
      resume: "Entraîne-toi sur chaque thème avec un QCM : les questions ratées reviennent en "
            + "premier jusqu'à ce que tu les maîtrises.",
      ou: { label: "Cours, colonne QCM", route: "themes" },
    },
  },
  {
    cle: "epcf", nom: "EPCF", accord: "ms", groupe: "CCP1",
    explication: "Évaluations EPCF : les siennes dans Mon espace, les moyennes de la classe dans Notes, la saisie des formateurs dans la page Stagiaires.",
    annonce: {
      titre: "L'EPCF est ouvert",
      resume: "Tes évaluations EPCF du CCP1, en salle et en véhicule, s'affichent dans ton "
            + "espace personnel. La vue de la classe est dans Notes.",
      ou: { label: "Mon espace personnel, partie EPCF", route: "mon-suivi", sousOnglet: "epcf" },
    },
  },
  {
    // Plus de parent : le livret vit dans la fiche (Mon espace, page Stagiaires).
    cle: "livret", nom: "Livret EPCF", accord: "ms", groupe: "CCP1",
    explication: "Livret officiel EPCF : celui du stagiaire dans Mon espace, la saisie des formateurs dans la page Stagiaires.",
    annonce: {
      titre: "Le livret EPCF est ouvert",
      resume: "Ton livret d'évaluation officiel se consulte dans ton espace personnel. Pense "
            + "à y indiquer ta date de naissance : elle est reportée automatiquement sur le "
            + "livret.",
      ou: { label: "Mon espace personnel, partie Livret", route: "mon-suivi", sousOnglet: "livret" },
    },
  },
  {
    cle: "dp", nom: "Dossier pro", accord: "ms", groupe: "Dossier professionnel",
    explication: "Dossier professionnel : celui du stagiaire dans Mon espace, la relecture des formateurs dans la page Stagiaires.",
    annonce: {
      titre: "Le dossier professionnel est ouvert",
      resume: "Remplis ton dossier professionnel directement dans l'app, puis imprime-le ou "
            + "enregistre-le en PDF au format officiel. Tes formateurs peuvent le relire et "
            + "t'aider.",
      ou: { label: "Mon espace personnel, partie Dossier pro", route: "mon-suivi", sousOnglet: "dp" },
    },
  },
  {
    cle: "ccp2", nom: "CCP2", accord: "ms", groupe: "CCP2",
    explication: "Parcours guidé en 8 étapes, du commanditaire à l'épreuve.",
    annonce: {
      titre: "L'onglet CCP2 est ouvert",
      resume: "Ton parcours CCP2 en 8 étapes, du choix du commanditaire au jour de l'épreuve : "
            + "pour chacune, ce que le jury regarde, comment t'y prendre et les documents utiles.",
      ou: { label: "CCP2", route: "ccp2" },
    },
  },
  {
    cle: "assistant", nom: "Assistant", accord: "ms", groupe: "Outils",
    explication: "Bulle d'aide sur les cours et le Code de la route.",
    annonce: {
      titre: "L'assistant est ouvert",
      resume: "Une bulle en bas de l'écran répond à tes questions sur les cours et le Code de "
            + "la route. C'est une version d'essai : vérifie les points importants dans les cours.",
    },
  },
];
