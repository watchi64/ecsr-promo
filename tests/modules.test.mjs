// Règles des modules (chantier B) et intégrité du catalogue.
// Les sections 1 à 10 utilisent un catalogue de test : elles ne dépendent pas du
// contenu réel. Les sections 11 et 12 contrôlent, elles, le vrai catalogue et le
// rattachement des nouveautés déjà écrites.
import assert from "node:assert/strict";
import {
  VERSION, PREFIXE_ANNONCE, ETAT_LIBRE, lireEtat, ecrireEtat, estReglee, estOuvert,
  ensembleDeDepart, basculer, jourParis, annonces, avecAnnonces, moduleDeNouveaute,
  nouveautesPour, accorder,
} from "../js/modules.js";
import { purger, STORAGE_SOUS_ONGLET } from "../js/nouveautes.js";
import {
  MODULES, GROUPES, ROUTES_SOCLE, MODULE_DE_ROUTE, MODULE_DE_SOUS_ONGLET,
  REGLAGE_OUVERT_AUX_FORMATEURS,
} from "../js/modules-data.js";
import { NOUVEAUTES } from "../js/nouveautes-data.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

const T0 = "2026-10-05T08:00:00.000Z";
const T1 = "2026-10-12T13:30:00.000Z";
const T2 = "2026-10-20T09:00:00.000Z";
const CAT = [
  { cle: "planning", nom: "Planning", accord: "ms", groupe: "G1", depart: true,
    annonce: { titre: "Planning ouvert", resume: "R planning", ou: { label: "Planning", route: "planning" } } },
  { cle: "notes", nom: "Notes", accord: "fp", groupe: "G2",
    annonce: { titre: "Notes ouvertes", resume: "R notes", ou: { label: "Notes", route: "notes" } } },
  { cle: "themes", nom: "Thèmes", accord: "mp", groupe: "G2",
    annonce: { titre: "Thèmes ouverts", resume: "R themes", ou: { label: "Thèmes", route: "themes" } } },
  { cle: "qcm", nom: "QCM", accord: "mp", groupe: "G2", parent: "themes",
    annonce: { titre: "QCM ouverts", resume: "R qcm", ou: { label: "Thèmes, colonne QCM", route: "themes" } } },
  { cle: "assistant", nom: "Assistant", accord: "ms", groupe: "G3",
    annonce: { titre: "Assistant ouvert", resume: "R assistant" } },
];
const REF = {
  modules: CAT,
  moduleDeRoute: { planning: "planning", notes: "notes", themes: "themes" },
  moduleDeSousOnglet: { notes: { livret: "livret" }, "mon-suivi": { dp: "dp", evolution: "notes" } },
};
const regle = (ouverts, depuis = T0) => ({ statut: "reglee", depuis, ouverts });
const texte = (o) => JSON.stringify(o);

// 1. Lecture du réglage
eq(lireEtat(null), { statut: "libre" }, "clé absente : libre");
eq(lireEtat(""), { statut: "libre" }, "valeur vide : libre");
eq(lireEtat("{pas du json"), { statut: "illisible" }, "JSON cassé");
eq(lireEtat(texte({ v: 2, depuis: T0, ouverts: {} })), { statut: "illisible" }, "version inconnue");
eq(lireEtat(texte({ v: 1, depuis: T0 })), { statut: "illisible" }, "ouverts absent");
eq(lireEtat(texte({ v: 1, ouverts: {} })), { statut: "illisible" }, "depuis absent");
eq(lireEtat("[1,2]"), { statut: "illisible" }, "tableau");
eq(lireEtat(texte({ v: 1, depuis: T0, ouverts: ["planning"] })), { statut: "illisible" }, "ouverts en tableau");
eq(lireEtat(texte({ v: 1, depuis: T0, ouverts: { planning: T0, notes: 5 } })),
   regle({ planning: T0 }), "valeur non textuelle ignorée");
eq(VERSION, 1, "version du format");
const e1 = regle({ planning: T0, notes: T1 });
eq(lireEtat(ecrireEtat(e1)), e1, "aller-retour écrire puis lire");
assert.throws(() => ecrireEtat(ETAT_LIBRE), /seul un état réglé/); n++;
eq(ETAT_LIBRE.statut, "libre", "état libre");
ok(estReglee(e1) && !estReglee(ETAT_LIBRE) && !estReglee({ statut: "illisible" }) && !estReglee(null),
   "estReglee");

// 2. Ouvert ou fermé
ok(estOuvert(null, regle({}), CAT), "socle (clé nulle) toujours ouvert");
ok(estOuvert(undefined, regle({}), CAT), "socle (clé absente) toujours ouvert");
ok(estOuvert("notes", ETAT_LIBRE, CAT), "libre : tout ouvert");
ok(estOuvert("notes", { statut: "illisible" }, CAT), "illisible : tout ouvert");
ok(estOuvert("planning", regle({ planning: T0 }), CAT), "réglé : coché = ouvert");
ok(!estOuvert("notes", regle({ planning: T0 }), CAT), "réglé : non coché = fermé");
ok(!estOuvert("ccp2", regle({ planning: T0 }), CAT), "module non mentionné : fermé");
ok(!estOuvert("qcm", regle({ qcm: T1 }), CAT), "enfant coché sous un parent fermé : fermé");
ok(estOuvert("qcm", regle({ qcm: T1, themes: T1 }), CAT), "enfant et parent cochés : ouvert");

// 3. Ensemble de départ
eq(ensembleDeDepart(CAT, T0), regle({ planning: T0 }, T0), "ensemble de départ");

// 4. Bascule
const dep = ensembleDeDepart(CAT, T0);
const b1 = basculer(dep, "notes", true, CAT, T1);
eq(b1, regle({ planning: T0, notes: T1 }, T0), "ouvrir un module fermé : heure courante");
eq(dep, regle({ planning: T0 }, T0), "l'état reçu n'est pas modifié");
eq(basculer(b1, "notes", true, CAT, T2).ouverts.notes, T1, "rouvrir un module ouvert garde son heure");
const b2 = basculer(b1, "notes", false, CAT, T2);
ok(!("notes" in b2.ouverts), "fermer retire le module");
eq(basculer(b2, "notes", true, CAT, T2).ouverts.notes, T2, "rouvrir après fermeture : nouvelle heure");
const b3 = basculer(ETAT_LIBRE, "assistant", false, CAT, T1);
eq(b3, regle({ planning: T1, notes: T1, themes: T1, qcm: T1 }, T1),
   "depuis l'état libre : tout est matérialisé à l'heure courante, puis la bascule");
eq(basculer({ statut: "illisible" }, "assistant", false, CAT, T1), b3, "illisible se bascule comme libre");

// 5. Jour en heure de Paris
eq(jourParis("2026-10-11T22:30:00.000Z"), "2026-10-12", "00 h 30 à Paris, heure d'été");
eq(jourParis("2026-12-31T23:30:00.000Z"), "2027-01-01", "00 h 30 à Paris, heure d'hiver");
eq(jourParis("2026-10-12T13:30:00.000Z"), "2026-10-12", "journée");
eq(jourParis("pas une date"), null, "date invalide");

// 6. Annonces
eq(annonces(ETAT_LIBRE, CAT), [], "libre : aucune annonce");
eq(annonces(dep, CAT), [], "ensemble de départ : rien à annoncer");
eq(annonces(b3, CAT), [], "matérialisation : rien à annoncer");
eq(annonces(b1, CAT), [{
  id: "module-notes-" + T1, date: "2026-10-12", pour: "tous", module: "notes",
  titre: "Notes ouvertes", resume: "R notes", ou: { label: "Notes", route: "notes" },
}], "ouverture après la mise en place : une annonce");
eq(annonces(regle({ planning: T0, qcm: T1 }), CAT), [], "enfant sous un parent fermé : pas d'annonce");
eq(annonces(regle({ planning: T0, qcm: T1, themes: T2 }), CAT).map((a) => a.id),
   ["module-themes-" + T2, "module-qcm-" + T1], "parent ouvert ensuite : les deux sont annoncés");
const aAssistant = annonces(regle({ assistant: T1 }), CAT);
ok(aAssistant.length === 1 && !("ou" in aAssistant[0]), "annonce sans lien si le catalogue n'en donne pas");
const avecInconnue = regle({ planning: T0, fantome: T1 });
eq(annonces(avecInconnue, CAT), [], "clé inconnue du catalogue : ignorée sans erreur");
ok(estOuvert("planning", avecInconnue, CAT), "clé inconnue sans effet sur les autres modules");
eq(basculer(avecInconnue, "notes", true, CAT, T2).ouverts.fantome, T1, "clé inconnue conservée par la bascule");
const premiere = annonces(b1, CAT)[0];
ok(premiere.ou !== CAT[1].annonce.ou, "le lien de l'annonce est une copie, pas l'objet du catalogue");

// 7. Module d'une nouveauté
eq(moduleDeNouveaute({ id: "a", module: "qcm", ou: { route: "themes" } }, REF), "qcm", "champ module prioritaire");
eq(moduleDeNouveaute({ id: "b", ou: { route: "notes" } }, REF), "notes", "par la route");
eq(moduleDeNouveaute({ id: "c", ou: { route: "notes", sousOnglet: "livret" } }, REF), "livret", "par le sous-onglet");
eq(moduleDeNouveaute({ id: "d", ou: { route: "notes", sousOnglet: "inconnu" } }, REF), "notes",
   "sous-onglet inconnu : la route");
eq(moduleDeNouveaute({ id: "e", ou: { route: "config" } }, REF), null, "route du socle");
eq(moduleDeNouveaute({ id: "f" }, REF), null, "sans lien");

// 8. Nouveautés de la promo
const ECRITES = [
  { id: "s-notes", date: "2026-10-02", pour: "tous", ou: { route: "notes" } },
  { id: "s-themes", date: "2026-10-02", pour: "tous", ou: { route: "themes" } },
  { id: "s-libre", date: "2026-10-02", pour: "tous" },
  { id: "s-assistant", date: "2026-10-02", pour: "tous", module: "assistant" },
];
eq(avecAnnonces(ECRITES, b1, CAT).map((e) => e.id),
   ["s-notes", "s-themes", "s-libre", "s-assistant", "module-notes-" + T1], "annonces ajoutées");
eq(nouveautesPour(ECRITES, b1, REF, false).map((e) => e.id),
   ["s-notes", "s-libre", "module-notes-" + T1], "stagiaire : nouveautés des modules fermés masquées");
eq(nouveautesPour(ECRITES, b1, REF, true).map((e) => e.id),
   ["s-notes", "s-themes", "s-libre", "s-assistant", "module-notes-" + T1], "formateur : tout");
eq(nouveautesPour(ECRITES, ETAT_LIBRE, REF, false).map((e) => e.id),
   ["s-notes", "s-themes", "s-libre", "s-assistant"], "promo libre : tout, sans annonce");

// 9. Accord des participes
eq(accorder("ouvert", "ms"), "ouvert", "masculin singulier");
eq(accorder("ouvert", "fs"), "ouverte", "féminin singulier");
eq(accorder("ouvert", "mp"), "ouverts", "masculin pluriel");
eq(accorder("masqué", "fp"), "masquées", "féminin pluriel");
eq(accorder("ouvert", undefined), "ouvert", "accord absent");

// 10. Lien avec la mémoire des nouveautés lues (js/nouveautes.js)
eq(PREFIXE_ANNONCE, "module-", "préfixe connu de purger()");
const idAnnonce = annonces(b1, CAT)[0].id;
eq(purger([idAnnonce, "obsolete"], []), [idAnnonce], "une annonce lue n'est jamais purgée");

// 11. Catalogue réel
const cles = MODULES.map((m) => m.cle);
eq(new Set(cles).size, cles.length, "clés uniques");
const CADRATIN = "\u2014";
eq(CADRATIN.charCodeAt(0), 0x2014, "la constante est bien le tiret cadratin");
for (const m of MODULES) {
  ok(typeof m.nom === "string" && m.nom.length > 0, m.cle + " : nom");
  ok(GROUPES.includes(m.groupe), m.cle + " : groupe connu");
  ok(["ms", "fs", "mp", "fp"].includes(m.accord), m.cle + " : accord");
  ok(typeof m.explication === "string" && m.explication.length > 0, m.cle + " : explication");
  ok(!!(m.annonce && m.annonce.titre && m.annonce.resume), m.cle + " : annonce");
  if (m.parent) {
    const p = MODULES.find((x) => x.cle === m.parent);
    ok(!!p && !p.parent, m.cle + " : parent connu, sur un seul niveau");
    ok(cles.indexOf(m.parent) < cles.indexOf(m.cle), m.cle + " : parent placé avant l'enfant");
  }
  if (m.annonce.ou) {
    const r = m.annonce.ou.route;
    ok(r in MODULE_DE_ROUTE || ROUTES_SOCLE.includes(r), m.cle + " : lien vers une route connue");
    if (m.annonce.ou.sousOnglet) ok(r in STORAGE_SOUS_ONGLET, m.cle + " : sous-onglet joignable");
  }
  const tout = [m.nom, m.explication, m.annonce.titre, m.annonce.resume, m.annonce.ou?.label || ""].join(" ");
  ok(!tout.includes(CADRATIN), m.cle + " : aucun tiret cadratin");
}
eq(MODULES.filter((m) => m.depart).map((m) => m.cle), ["planning", "calendrier", "ressources"],
   "ensemble de départ du cadrage");
for (const v of Object.values(MODULE_DE_ROUTE)) ok(cles.includes(v), "route vers un module connu : " + v);
for (const parRoute of Object.values(MODULE_DE_SOUS_ONGLET)) {
  for (const v of Object.values(parRoute)) ok(cles.includes(v), "sous-onglet vers un module connu : " + v);
}
for (const r of ROUTES_SOCLE) ok(!(r in MODULE_DE_ROUTE), "route du socle sans module : " + r);
eq(typeof REGLAGE_OUVERT_AUX_FORMATEURS, "boolean", "drapeau booléen");

// 12. Nouveautés déjà écrites rattachées au bon module. Ces entrées historiques
// mènent à « Mon suivi », « Thèmes » ou « Paramètres » alors qu'elles parlent du
// Dossier pro, des QCM, des cours ou de l'anonymat : sans champ `module`, une
// promo qui n'a pas ce module les verrait.
for (const e of NOUVEAUTES) if (e.module) ok(cles.includes(e.module), e.id + " : module connu");
const REF_REEL = { modules: MODULES, moduleDeRoute: MODULE_DE_ROUTE, moduleDeSousOnglet: MODULE_DE_SOUS_ONGLET };
const attendu = {
  "2026-09-16-dp-formateurs": "dp", "2026-09-15-dp-mise-en-page": "dp",
  "2026-08-26-cours-pour-tous": "cours", "2026-08-21-anonymat-notes": "notes",
  "2026-08-19-assistant-mobile": "assistant", "2026-08-15-assistant": "assistant",
  "2026-08-10-barre-entrainement": "qcm", "2026-08-08-signalement-reponse-visee": "qcm",
  "2026-07-31-qcm-entrainement": "qcm", "2026-07-31-qcm-signalement": "qcm",
  "2026-07-31-dossier-professionnel": "dp", "2026-07-19-livret-epcf": "livret",
};
for (const [id, cle] of Object.entries(attendu)) {
  const e = NOUVEAUTES.find((x) => x.id === id);
  ok(!!e, id + " existe");
  eq(moduleDeNouveaute(e, REF_REEL), cle, id + " : rattachée à " + cle);
}

console.log(`modules : ${n} assertions OK`);
