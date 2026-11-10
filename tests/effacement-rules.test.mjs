// Effacement des données : confirmation, textes d'état. Lancer depuis la racine du dépôt :
// node tests/effacement-rules.test.mjs
import assert from "node:assert/strict";
import { confirmationValide, dateCourte, dateLongue, echeancesConservation, etatFinDePromo, resumeEffacement, statutFiche } from "../js/effacement-rules.js";

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// Confirmation
ok(confirmationValide("Timy", "Timy"), "saisie exacte");
ok(confirmationValide("  timy ", "Timy"), "casse et espaces ignorés");
ok(!confirmationValide("Timi", "Timy"), "faute de frappe refusée");
ok(!confirmationValide("Helene", "Hélène"), "accents exigés");
ok(confirmationValide("hélène", "Hélène"), "accents en minuscules acceptés");
ok(!confirmationValide("", ""), "prénom vide jamais valide");

eq(dateCourte("2027-12-11"), "11/12/2027", "date courte");
eq(dateCourte(null), "", "date absente");
eq(dateLongue("2027-12-11"), "11 décembre 2027", "date dans une phrase");
eq(dateLongue("2027-03-01"), "1er mars 2027", "le 1er du mois");
eq(dateLongue(null), "", "date longue absente");

// Fin de promo
eq(etatFinDePromo(null).bouton, false, "pas de promo");
ok(/non renseignée/.test(etatFinDePromo({ date_fin: null }).texte), "date de fin absente");
const avant = etatFinDePromo({ date_fin: "2026-12-11", anonymisable_le: "2027-12-11", anonymisable: false, restants: 15, comptes_admin: 1 });
eq(avant.bouton, false, "trop tôt : pas de bouton");
ok(avant.texte.includes("le 11 décembre 2026") && avant.texte.includes("du 11 décembre 2027"), "trop tôt : les deux dates, en toutes lettres");
const pret = etatFinDePromo({ date_fin: "2025-01-01", anonymisable_le: "2026-01-01", anonymisable: true, restants: 15, comptes_admin: 1 });
eq(pret.bouton, true, "délai écoulé : bouton");
ok(pret.texte.includes("14 fiches") && /administrateur/.test(pret.texte), "fiches à traiter hors compte admin");
const fini = etatFinDePromo({ date_fin: "2025-01-01", anonymisable: true, restants: 1, comptes_admin: 1 });
eq(fini.bouton, false, "seul le compte admin reste : pas de bouton");
ok(/anonymisées/.test(fini.texte), "promo traitée");

// Compte rendu
eq(resumeEffacement({ deja: true }), "Ces données étaient déjà effacées.", "déjà fait");
const r = resumeEffacement({ comptes: 1, date_naissance: 1, livret: 1, dossier_pro: 0, fiche_suivi: 1, epcf_textes: 2, observations: 1, commentaires_passages: 0 });
ok(r.startsWith("Effacé : compte de connexion, date de naissance, livret, fiche de suivi, 3 commentaires."), "compte rendu détaillé");
ok(/sans nom/.test(resumeEffacement({})), "compte rendu minimal");

// Échéances de conservation (état renvoyé par etat_conservation())
const promo = (o = {}) => ({ id: "p1", nom: "Nîmes mars 2026", lieu_nom: "Nîmes", date_fin: "2026-12-11", etape1_du: "2027-12-11", etape2_du: "2030-01-01",
  a_effacer_etape1: 14, a_effacer_etape2: 0, comptes_equipe: 1, ...o });
const etat = (jour, promos, extra = {}) => ({ jour, promos, portees_formateurs: [], registre: null, ...extra });
const types = (l) => l.map((e) => e.type);

const e1 = echeancesConservation(etat("2027-12-10", [promo()]));
eq(types(e1), ["etape1"], "étape 1 listée");
eq([e1[0].du, e1[0].due, e1[0].restant, e1[0].bouton], ["2027-12-11", false, 1, null], "veille : pas due, un jour restant, pas de bouton");
const e2 = echeancesConservation(etat("2027-12-11", [promo()]));
eq([e2[0].due, e2[0].restant], [true, 0], "le jour dit : due");
ok(typeof e2[0].bouton === "string" && e2[0].bouton.length > 0, "due : le bouton a un libellé");
ok(e2[0].texte.includes("14 fiches"), "le texte donne le nombre de fiches");
ok(e2[0].texte.includes("compte d'équipe") || e2[0].texte.includes("comptes d'équipe"), "les comptes d'équipe sont mentionnés");
eq(echeancesConservation(etat("2027-12-11", [promo({ a_effacer_etape1: 0, comptes_equipe: 1 })])), [], "rien à faire, comptes d'équipe seuls : aucune échéance");

const e3 = echeancesConservation(etat("2030-01-01", [promo({ a_effacer_etape1: 0, a_effacer_etape2: 15 })]));
eq(types(e3), ["etape2"], "étape 2 listée");
eq([e3[0].du, e3[0].due], ["2030-01-01", true], "étape 2 : 01/01/2030");
eq(echeancesConservation(etat("2029-12-31", [promo({ a_effacer_etape1: 0, a_effacer_etape2: 15 })]))[0].due, false, "31/12/2029 : pas encore");

const sans = echeancesConservation(etat("2027-01-01", [promo({ date_fin: null, etape1_du: null, etape2_du: null })]));
eq(types(sans), ["date_fin_manquante"], "date de fin absente : une seule échéance");
eq([sans[0].bouton, sans[0].du, sans[0].due], [null, null, false], "sans date : ni bouton ni date");
ok(/date de fin/i.test(sans[0].texte), "le texte demande la date de fin");

const portee = { lieu_id: "l1", lieu_nom: "Nîmes", annee: 2026, participations: 3, cloture_du: "2027-01-01", commentaires: 4,
  commentaires_du: "2027-12-31", reponses: 5, fige: false, figeage_du: "2030-01-01" };
const ef = echeancesConservation(etat("2026-06-01", [], { portees_formateurs: [portee] }));
eq(types(ef), ["cloture_formateurs", "commentaires_formateurs", "figeage_formateurs"], "trois échéances formateurs");
eq(ef.map((e) => e.du), ["2027-01-01", "2027-12-31", "2030-01-01"], "dates formateurs 2026");
eq(types(echeancesConservation(etat("2026-06-01", [], { portees_formateurs: [{ ...portee, participations: 0, commentaires: 0, fige: true }] }))), [], "rien à faire côté formateurs");

const er = echeancesConservation(etat("2026-06-01", [], { registre: { a_effacer: 2, du: "2026-05-01" } }));
eq([types(er), er[0].due], [["registre"], true], "registre dû");
eq(echeancesConservation(etat("2026-06-01", [], { registre: { a_effacer: 0, du: null } })), [], "registre vide : rien");

// Tri : passées d'abord, puis par date
const tri = echeancesConservation(etat("2027-12-11", [
  promo({ id: "tard", nom: "B", etape1_du: "2028-02-01" }),
  promo({ id: "pile", nom: "A", etape1_du: "2027-12-11" }),
  promo({ id: "retard", nom: "C", etape1_du: "2027-06-01" }),
]));
eq(tri.map((e) => e.cible.id), ["retard", "pile", "tard"], "passées d'abord, puis par date");
ok(tri[0].restant < 0, "en retard : restant négatif");

// Statut d'une fiche
eq(statutFiche({ actif: true }, false, false), "En formation", "en cours");
eq(statutFiche({ actif: true }, true, false), "Formation suivie", "promo terminée");
eq(statutFiche({ actif: false }, false, false), "Abandon", "abandon");
eq(statutFiche({ actif: false }, true, true), "Fiche effacée à la demande de la personne", "la demande prime");
eq(statutFiche({ actif: true }, false, true), "Fiche effacée à la demande de la personne", "la demande prime aussi sur une fiche active");

// Compte rendu étendu
ok(resumeEffacement({ emargement_observations: 2, signatures: 3, commentaires_questionnaires: 1 }).includes("3 signatures"), "signatures citées");
ok(/observations? d'émargement/.test(resumeEffacement({ emargement_observations: 2 })), "observations d'émargement citées");
ok(/commentaire/.test(resumeEffacement({ commentaires_questionnaires: 1 })), "commentaires de questionnaire cités");

// Textes : ni tiret cadratin ni « prof »
const tous = [e1, e2, e3, sans, ef, er, tri].flat();
for (const e of tous) {
  ok(!e.texte.includes(String.fromCharCode(0x2014)), "pas de tiret cadratin : " + e.type);
  ok(!/\bprof\b/i.test(e.texte + (e.bouton || "")), "pas de « prof » : " + e.type);
}

console.log(`effacement-rules : ${n} vérifications OK`);
