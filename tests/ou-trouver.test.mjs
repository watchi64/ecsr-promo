// « Où le trouver » selon la navigation (refonte, lot 2A, tâche 1) : les liens des Nouveautés et des annonces d'ouverture de
// module sont écrits avec les noms de l'ancienne barre ; avec la nouvelle, le libellé suit la barre, le lien reste le même, sauf
// deux destinations qui ont vraiment changé de place (relecture finale) : Mes préférences (route `preferences`, ruling R55) et les
// élèves bénévoles (route `stagiaires`, sous-onglet `benevoles`, F8).
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
eq(ouSelonNavigation({ label: "Paramètres, Mes préférences", route: "config" }, NOUVELLE).route, "preferences", "config, détail Mes préférences : la route devient preferences (R55)");
eq(dit({ label: "Paramètres", route: "config" }, NOUVELLE), "Mes préférences", "config chez un stagiaire, sans détail : Mes préférences, jamais Réglages");
eq(dit({ label: "Paramètres", route: "config" }, NOUVELLE_EQUIPE), "Réglages", "config chez l'équipe : Réglages");
// R55 : quand le détail désigne Mes préférences, la destination est la page de la personne, pour les deux espaces (Réglages, chez l'équipe,
// ne garde plus que la promo : la Nouveauté du 21/08 sur l'anonymat y menait l'équipe à tort).
eq(dit({ label: "Paramètres, Mes préférences", route: "config" }, NOUVELLE_EQUIPE), "Mes préférences", "config chez l'équipe, détail Mes préférences : Mes préférences, pas Réglages (R55)");
eq(ouSelonNavigation({ label: "Paramètres, Mes préférences", route: "config" }, NOUVELLE_EQUIPE).route, "preferences", "config chez l'équipe, détail Mes préférences : route preferences (R55)");
eq(dit({ label: "Paramètres, Promo", route: "config" }, NOUVELLE_EQUIPE), "Réglages", "config chez l'équipe, un autre détail : Réglages");
eq(ouSelonNavigation({ label: "Paramètres, Promo", route: "config" }, NOUVELLE_EQUIPE).route, "config", "config chez l'équipe, un autre détail : la route reste config");
eq(dit({ label: "Paramètres, Promo", route: "config" }, NOUVELLE), "Mes préférences", "config chez un stagiaire, un autre détail : Mes préférences");
eq(ouSelonNavigation({ label: "Paramètres, Promo", route: "config" }, NOUVELLE).route, "config", "config chez un stagiaire, un autre détail : la route reste config (#/config le mène à ses préférences)");
eq(dit({ label: "Accueil, tuile Tableau de bord", route: "centre" }, NOUVELLE_EQUIPE), "Indicateurs", "centre : Indicateurs");
eq(dit({ label: "Accueil, tuile Stagiaires", route: "stagiaires" }, NOUVELLE_EQUIPE), "Stagiaires", "stagiaires : la tuile de l'Accueil devient l'entrée de la barre");
eq(dit({ label: "Stagiaires, Élèves bénévoles", route: "stagiaires", sousOnglet: "benevoles" }, NOUVELLE_EQUIPE), "Stagiaires, Élèves bénévoles",
  "stagiaires : un libellé déjà à jour reste tel quel");
eq(dit({ label: "Pastille en haut, à côté de ton nom", route: "home" }, NOUVELLE_EQUIPE), "La promo, en tête de la barre", "home : la pastille de la promo, en tête de la barre (de gauche sur ordinateur, du haut sur téléphone)");
// Les pages dont le nom ne change pas gardent leur libellé.
eq(dit({ label: "Planning", route: "planning" }, NOUVELLE), "Planning", "planning inchangé");
eq(dit({ label: "Planning, Semaine", route: "planning" }, NOUVELLE_EQUIPE), "Planning, Semaine", "planning avec un détail inchangé");
// F8 : la banque des élèves bénévoles est un sous-onglet de Stagiaires ; le lien des deux Nouveautés des bénévoles y mène.
const BENEVOLES_D_AVANT = { label: "Planning, bouton Bénévoles", route: "planning" };
const benevoles = ouSelonNavigation(BENEVOLES_D_AVANT, NOUVELLE_EQUIPE);
eq(benevoles, { label: "Stagiaires, Élèves bénévoles", route: "stagiaires", sousOnglet: "benevoles" }, "bénévoles chez l'équipe : Stagiaires, Élèves bénévoles, sous-onglet benevoles");
eq(BENEVOLES_D_AVANT, { label: "Planning, bouton Bénévoles", route: "planning" }, "le lien d'avant n'est pas modifié");
ok(ouSelonNavigation(BENEVOLES_D_AVANT, ANCIENNE) === BENEVOLES_D_AVANT, "ancienne navigation : le bouton du Planning, tel quel");
eq(dit({ label: "Planning, bouton Bénévoles, onglet Auto-écoles", route: "planning" }, NOUVELLE_EQUIPE), "Stagiaires, Élèves bénévoles", "bénévoles avec un détail de plus : même destination");
eq(dit(BENEVOLES_D_AVANT, NOUVELLE), "Stagiaires, Élèves bénévoles", "le libellé ne dépend pas de l'espace (les deux Nouveautés qui en parlent sont pour les formateurs)");
eq(dit({ label: "CCP2", route: "ccp2" }, NOUVELLE), "CCP2", "ccp2 inchangé");
// `espace` absent : un stagiaire (le cas le plus fréquent, et le plus prudent : jamais « Réglages »).
eq(dit({ label: "Paramètres", route: "config" }, { navigationV2: true }), "Mes préférences", "espace absent : stagiaire");

// 3. La route, le sous-onglet et tout le reste du lien ne bougent pas (les redirections du lot 1 font le reste), sauf les deux destinations qui
// ont changé de place (section 2 : Mes préférences, les bénévoles) ; et `ou` n'est jamais modifié.
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
// Les seuls liens dont la destination (route, sous-onglet) change sous la nouvelle navigation, par Nouveauté : l'anonymat des notes (Mes
// préférences, R55) et les deux Nouveautés des bénévoles (F8). Tous les autres gardent route et sous-onglet.
const CHANGEES = {
  "2026-08-21-anonymat-notes": { route: "preferences", sousOnglet: undefined },
  "2026-07-05-auto-ecoles": { route: "stagiaires", sousOnglet: "benevoles" },
  "2026-07-02-benevoles": { route: "stagiaires", sousOnglet: "benevoles" },
};
const LIENS = [
  ...NOUVEAUTES.filter((e) => e.ou).map((e) => ({ de: e.id, ou: e.ou })),
  ...MODULES.filter((m) => m.annonce && m.annonce.ou).map((m) => ({ de: "module " + m.cle, ou: m.annonce.ou })),
];
ok(LIENS.length > 30, "les liens réels sont bien lus");
const DESTINATION_D_AVANT = /Mon espace|espace personnel|Paramètres|tuile|logo|Ressources|Calendrier|bouton Priorités|bouton Bénévoles|Tableau de bord|Pastille/;
for (const { de, ou } of LIENS) {
  ok(ouSelonNavigation(ou, ANCIENNE) === ou, `${de} : l'ancienne navigation garde le libellé de main`);
  for (const [nom, options] of [["stagiaire", NOUVELLE], ["équipe", NOUVELLE_EQUIPE]]) {
    const r = ouSelonNavigation(ou, options);
    ok(!DESTINATION_D_AVANT.test(r.label), `${de} (${nom}) : « ${r.label} » nomme une destination de l'ancienne barre`);
    const voulue = CHANGEES[de] || { route: ou.route, sousOnglet: ou.sousOnglet };
    eq([r.route, r.sousOnglet], [voulue.route, voulue.sousOnglet],
      `${de} (${nom}) : ${CHANGEES[de] ? "la destination a changé de place, le lien la suit" : "route et sous-onglet inchangés"}`);
  }
}
// Un stagiaire n'est jamais envoyé vers « Réglages » (la page de la promo, réservée à l'équipe). L'équipe l'est vers « Réglages », sauf quand le
// détail du lien désigne Mes préférences : elle va alors à Mes préférences, comme le stagiaire (R55, route preferences pour les deux).
for (const { de, ou } of LIENS.filter((l) => l.ou.route === "config")) {
  const prefs = /, Mes préférences$/.test(ou.label);
  eq(ouSelonNavigation(ou, NOUVELLE).label, "Mes préférences", `${de} : le stagiaire va à Mes préférences`);
  eq(ouSelonNavigation(ou, NOUVELLE_EQUIPE).label, prefs ? "Mes préférences" : "Réglages",
    `${de} : l'équipe va ${prefs ? "à Mes préférences (le détail les désigne)" : "à Réglages"}`);
  eq(ouSelonNavigation(ou, NOUVELLE_EQUIPE).route, prefs ? "preferences" : "config", `${de} : la route de l'équipe`);
  eq(ouSelonNavigation(ou, NOUVELLE).route, prefs ? "preferences" : "config", `${de} : la route du stagiaire`);
}
ok(LIENS.some((l) => l.ou.route === "config" && /, Mes préférences$/.test(l.ou.label)), "le lien de l'anonymat (détail Mes préférences) est bien dans les liens réels");
ok(LIENS.some((l) => l.ou.route === "config" && !/, Mes préférences$/.test(l.ou.label)), "un lien de Réglages sans ce détail est bien dans les liens réels");
// Aucun lien réel ne nomme « Planning, bouton Bénévoles » sous la nouvelle navigation (F8) : il serait faux d'un cran.
for (const { de, ou } of LIENS.filter((l) => l.ou.route === "planning" && /bouton Bénévoles/.test(l.ou.label))) {
  eq(ouSelonNavigation(ou, NOUVELLE_EQUIPE).route, "stagiaires", `${de} : les bénévoles sont sous Stagiaires`);
}
ok(LIENS.filter((l) => /bouton Bénévoles/.test(l.ou.label)).length === 2, "les deux Nouveautés des bénévoles sont bien dans les liens réels");
console.log(`ou-trouver : ${n} assertions OK`);
