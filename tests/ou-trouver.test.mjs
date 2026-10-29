// « Où le trouver » selon la navigation (refonte, lot 2A, tâche 1) : les liens des Nouveautés et des annonces d'ouverture de
// module sont écrits avec les noms de l'ancienne barre ; avec la nouvelle, le libellé suit la barre, le lien reste le même.
import assert from "node:assert/strict";
import { ouSelonNavigation } from "../js/ou-trouver.js";
import { NOUVEAUTES } from "../js/nouveautes-data.js";
import { MODULES } from "../js/modules-data.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

const ANCIENNE = { navigationV2: false };
const NOUVELLE = { navigationV2: true, espace: "stagiaire" };
const NOUVELLE_EQUIPE = { navigationV2: true, espace: "equipe" };
const dit = (ou, options) => ouSelonNavigation(ou, options).label;

// 1. Ancienne navigation : `ou` est rendu tel quel, pour toute route et dans les deux espaces (interrupteur éteint = main).
const ANCIENS = [
  { label: "Calendrier", route: "calendrier" },
  { label: "Ressources", route: "ressources" },
  { label: "Planning, bouton Priorités", route: "dashboard" },
  { label: "Cours, colonne QCM", route: "themes" },
  { label: "Mon espace personnel, partie Livret", route: "mon-suivi", sousOnglet: "livret" },
  { label: "Notes, Synthèse classe", route: "notes" },
  { label: "Paramètres, Mes préférences", route: "config" },
  { label: "Accueil, tuile Tableau de bord", route: "centre" },
  { label: "Accueil, tuile Stagiaires", route: "stagiaires" },
  { label: "Pastille en haut, à côté de ton nom", route: "home" },
];
for (const ou of ANCIENS) {
  for (const espace of ["stagiaire", "equipe"]) {
    ok(ouSelonNavigation(ou, { navigationV2: false, espace }) === ou, `ancienne navigation, ${espace} : « ${ou.label} » rendu tel quel`);
  }
  ok(ouSelonNavigation(ou) === ou, `sans option, la navigation est l'ancienne : « ${ou.label} » rendu tel quel`);
  ok(ouSelonNavigation(ou, ANCIENNE) === ou, `navigationV2 faux : « ${ou.label} » rendu tel quel`);
}
eq(ouSelonNavigation(null, NOUVELLE), null, "pas de lien, pas de libellé");
eq(ouSelonNavigation(undefined, ANCIENNE), undefined, "pas de lien, ancienne navigation");

// 2. Nouvelle navigation : le libellé suit la barre, route par route.
eq(dit({ label: "Calendrier", route: "calendrier" }, NOUVELLE), "Planning, Dates clés", "calendrier : Planning, Dates clés");
eq(dit({ label: "Calendrier", route: "calendrier" }, NOUVELLE_EQUIPE), "Planning, Dates clés", "calendrier, équipe");
eq(dit({ label: "Ressources", route: "ressources" }, NOUVELLE), "Cours et QCM, Documents", "ressources : Cours et QCM, Documents");
eq(dit({ label: "Ressources, Examens", route: "ressources" }, NOUVELLE), "Cours et QCM, Documents", "ressources avec un détail : Cours et QCM, Documents");
eq(dit({ label: "Planning, bouton Priorités", route: "dashboard" }, NOUVELLE), "Planning, Priorités", "dashboard : Planning, Priorités");
eq(dit({ label: "Cours", route: "themes" }, NOUVELLE), "Cours et QCM", "themes : Cours et QCM");
eq(dit({ label: "Cours, colonne QCM", route: "themes" }, NOUVELLE), "Cours et QCM, colonne QCM", "themes : le reste de l'ancien libellé suit (colonne QCM)");
eq(dit({ label: "Cours, colonne Cours", route: "themes" }, NOUVELLE), "Cours et QCM, colonne Cours", "themes : colonne Cours");
eq(dit({ label: "Cours, sous-onglet Compétences", route: "themes", sousOnglet: "competences" }, NOUVELLE_EQUIPE),
  "Cours et QCM, sous-onglet Compétences", "themes : sous-onglet Compétences");
eq(dit({ label: "Cours et QCM", route: "themes" }, NOUVELLE), "Cours et QCM", "themes : un libellé déjà à jour reste tel quel");
eq(dit({ label: "Mon espace personnel, partie Dossier pro", route: "mon-suivi", sousOnglet: "dp" }, NOUVELLE), "Mon suivi, partie Dossier pro",
  "mon-suivi : Mon suivi, partie X à la place de Mon espace personnel, partie X");
eq(dit({ label: "Mon espace personnel, partie Livret", route: "mon-suivi", sousOnglet: "livret" }, NOUVELLE), "Mon suivi, partie Livret", "mon-suivi : partie Livret");
eq(dit({ label: "Mon espace personnel, partie EPCF", route: "mon-suivi", sousOnglet: "epcf" }, NOUVELLE), "Mon suivi, partie EPCF", "mon-suivi : partie EPCF");
eq(dit({ label: "Mon espace, partie Livret", route: "mon-suivi", sousOnglet: "livret" }, NOUVELLE), "Mon suivi, partie Livret", "mon-suivi : « Mon espace » seul aussi");
eq(dit({ label: "Mon espace personnel", route: "mon-suivi" }, NOUVELLE), "Mon suivi", "mon-suivi sans partie : Mon suivi");
eq(dit({ label: "Le logo en haut à gauche", route: "mon-suivi" }, NOUVELLE), "Mon suivi", "mon-suivi : un geste de l'ancienne barre devient le nom de la page");
eq(dit({ label: "Mon suivi, partie Livret", route: "mon-suivi", sousOnglet: "livret" }, NOUVELLE), "Mon suivi, partie Livret", "mon-suivi : libellé déjà à jour");
eq(dit({ label: "Notes", route: "notes" }, NOUVELLE), "Mon suivi, La classe", "notes chez un stagiaire : Mon suivi, La classe");
eq(dit({ label: "Notes, Synthèse classe", route: "notes" }, NOUVELLE), "Mon suivi, La classe", "notes chez un stagiaire, avec un détail");
eq(dit({ label: "Notes", route: "notes" }, NOUVELLE_EQUIPE), "Notes et examens", "notes chez l'équipe : Notes et examens");
eq(dit({ label: "Notes, Synthèse classe", route: "notes" }, NOUVELLE_EQUIPE), "Notes et examens, Synthèse classe", "notes chez l'équipe : le détail suit");
eq(dit({ label: "Paramètres, Mes préférences", route: "config" }, NOUVELLE), "Mes préférences", "config chez un stagiaire : Mes préférences");
eq(dit({ label: "Paramètres", route: "config" }, NOUVELLE), "Mes préférences", "config chez un stagiaire, sans détail : Mes préférences, jamais Réglages");
eq(dit({ label: "Paramètres", route: "config" }, NOUVELLE_EQUIPE), "Réglages", "config chez l'équipe : Réglages");
eq(dit({ label: "Paramètres, Mes préférences", route: "config" }, NOUVELLE_EQUIPE), "Réglages", "config chez l'équipe, avec un détail : Réglages");
eq(dit({ label: "Accueil, tuile Tableau de bord", route: "centre" }, NOUVELLE_EQUIPE), "Indicateurs", "centre : Indicateurs");
eq(dit({ label: "Accueil, tuile Stagiaires", route: "stagiaires" }, NOUVELLE_EQUIPE), "Stagiaires", "stagiaires : la tuile de l'Accueil devient l'entrée de la barre");
eq(dit({ label: "Stagiaires, Élèves bénévoles", route: "stagiaires", sousOnglet: "benevoles" }, NOUVELLE_EQUIPE), "Stagiaires, Élèves bénévoles",
  "stagiaires : un libellé déjà à jour reste tel quel");
eq(dit({ label: "Pastille en haut, à côté de ton nom", route: "home" }, NOUVELLE_EQUIPE), "La promo, en tête de la barre de gauche", "home : la pastille de la promo");
// Les pages dont le nom ne change pas gardent leur libellé.
eq(dit({ label: "Planning", route: "planning" }, NOUVELLE), "Planning", "planning inchangé");
eq(dit({ label: "Planning, bouton Bénévoles", route: "planning" }, NOUVELLE_EQUIPE), "Planning, bouton Bénévoles", "planning avec un détail inchangé");
eq(dit({ label: "CCP2", route: "ccp2" }, NOUVELLE), "CCP2", "ccp2 inchangé");
// `espace` absent : un stagiaire (le cas le plus fréquent, et le plus prudent : jamais « Réglages »).
eq(dit({ label: "Paramètres", route: "config" }, { navigationV2: true }), "Mes préférences", "espace absent : stagiaire");

// 3. La route, le sous-onglet et tout le reste du lien ne bougent pas (les redirections du lot 1 font le reste), et `ou` n'est jamais modifié.
const AVANT = { label: "Mon espace personnel, partie Dossier pro", route: "mon-suivi", sousOnglet: "dp" };
const copie = { ...AVANT };
const apres = ouSelonNavigation(AVANT, NOUVELLE);
eq(AVANT, copie, "le lien reçu n'est pas modifié");
eq({ ...apres, label: AVANT.label }, AVANT, "seul le libellé change : route et sous-onglet identiques");
for (const [ou, options] of [
  [{ label: "Calendrier", route: "calendrier" }, NOUVELLE],
  [{ label: "Notes", route: "notes" }, NOUVELLE],
  [{ label: "Paramètres", route: "config" }, NOUVELLE_EQUIPE],
  [{ label: "Cours, sous-onglet Signalements", route: "themes", sousOnglet: "signalements" }, NOUVELLE_EQUIPE],
]) {
  const r = ouSelonNavigation(ou, options);
  eq(r.route, ou.route, `la route de « ${ou.label} » ne change pas`);
  eq(r.sousOnglet, ou.sousOnglet, `le sous-onglet de « ${ou.label} » ne change pas`);
  eq(Object.keys(r).sort(), Object.keys(ou).sort(), `aucun champ ajouté ni retiré à « ${ou.label} »`);
}

// 4. Les vrais liens (Nouveautés et annonces de modules), dans les deux espaces : sous la nouvelle navigation, aucun libellé ne nomme
// une destination de l'ancienne barre ; avec l'ancienne, tous restent ceux de main.
const LIENS = [
  ...NOUVEAUTES.filter((e) => e.ou).map((e) => ({ de: e.id, ou: e.ou })),
  ...MODULES.filter((m) => m.annonce && m.annonce.ou).map((m) => ({ de: "module " + m.cle, ou: m.annonce.ou })),
];
ok(LIENS.length > 30, "les liens réels sont bien lus");
const DESTINATION_D_AVANT = /Mon espace|espace personnel|Paramètres|tuile|logo|Ressources|Calendrier|bouton Priorités|Tableau de bord|Pastille/;
for (const { de, ou } of LIENS) {
  ok(ouSelonNavigation(ou, ANCIENNE) === ou, `${de} : l'ancienne navigation garde le libellé de main`);
  for (const [nom, options] of [["stagiaire", NOUVELLE], ["équipe", NOUVELLE_EQUIPE]]) {
    const r = ouSelonNavigation(ou, options);
    ok(!DESTINATION_D_AVANT.test(r.label), `${de} (${nom}) : « ${r.label} » nomme une destination de l'ancienne barre`);
    eq([r.route, r.sousOnglet], [ou.route, ou.sousOnglet], `${de} (${nom}) : route et sous-onglet inchangés`);
  }
}
// Un stagiaire n'est jamais envoyé vers « Réglages » (la page de la promo, réservée à l'équipe), l'équipe jamais vers « Mes préférences ».
for (const { de, ou } of LIENS.filter((l) => l.ou.route === "config")) {
  eq(ouSelonNavigation(ou, NOUVELLE).label, "Mes préférences", `${de} : le stagiaire va à Mes préférences`);
  eq(ouSelonNavigation(ou, NOUVELLE_EQUIPE).label, "Réglages", `${de} : l'équipe va à Réglages`);
}
console.log(`ou-trouver : ${n} assertions OK`);
