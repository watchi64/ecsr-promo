// Règles pures des questionnaires Qualiopi : fenêtres d'ouverture, ouverture manuelle, portée formateur,
// seuils d'affichage, taux de satisfaction. Lancer : node tests/questionnaires-rules.test.mjs
import assert from "node:assert/strict";
import {
  fenetreQuestionnaire, estOuvert, porteeFormateur, resultatsAffichables, tauxSatisfaction, texteSousSeuil,
} from "../js/questionnaires-rules.js";

let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const tiret = String.fromCharCode(0x2014);

// Fenêtres : fin de formation et formateurs, de date_fin moins 7 jours à date_fin plus 30 jours.
const promo = { date_fin: "2026-12-11" };
eq(fenetreQuestionnaire("fin_stagiaire", promo), { du: "2026-12-04", au: "2027-01-10" }, "fin stagiaire, changement d'année");
eq(fenetreQuestionnaire("fin_formateur", promo), { du: "2026-12-04", au: "2027-01-10" }, "fin formateur");
eq(fenetreQuestionnaire("fin_stagiaire", { date_fin: "2026-12-31" }), { du: "2026-12-24", au: "2027-01-30" }, "31 décembre");
eq(fenetreQuestionnaire("fin_stagiaire", { date_fin: "2027-01-05" }), { du: "2026-12-29", au: "2027-02-04" }, "début d'année, recul sur l'année précédente");
eq(fenetreQuestionnaire("fin_stagiaire", { date_fin: "2028-03-05" }), { du: "2028-02-27", au: "2028-04-04" }, "année bissextile");
// Six mois : de date_fin plus 6 mois à plus 7 mois, jour reporté au dernier jour du mois d'arrivée.
eq(fenetreQuestionnaire("six_mois_stagiaire", { date_fin: "2026-12-11" }), { du: "2027-06-11", au: "2027-07-11" }, "six mois simple");
eq(fenetreQuestionnaire("six_mois_stagiaire", { date_fin: "2026-08-31" }), { du: "2027-02-28", au: "2027-03-31" }, "31 août : février 2027 (28)");
eq(fenetreQuestionnaire("six_mois_stagiaire", { date_fin: "2027-08-31" }), { du: "2028-02-29", au: "2028-03-31" }, "31 août : février 2028 (29)");
eq(fenetreQuestionnaire("six_mois_stagiaire", { date_fin: "2026-07-31" }), { du: "2027-01-31", au: "2027-02-28" }, "31 juillet : plus 7 mois tombe en février");
eq(fenetreQuestionnaire("six_mois_stagiaire", { date_fin: "2026-06-30" }), { du: "2026-12-30", au: "2027-01-30" }, "30 juin");
// Sans date_fin ou date illisible, ou clé inconnue : pas de fenêtre.
eq(fenetreQuestionnaire("fin_stagiaire", {}), null, "promo sans date_fin");
eq(fenetreQuestionnaire("fin_stagiaire", { date_fin: null }), null, "date_fin nulle");
eq(fenetreQuestionnaire("fin_stagiaire", { date_fin: "pas une date" }), null, "date_fin illisible");
eq(fenetreQuestionnaire("fin_stagiaire", null), null, "promo absente");
eq(fenetreQuestionnaire("inconnu", promo), null, "clé inconnue");

// Ouverture : bornes comprises, la fenêtre sert quand rien n'est forcé.
const ouv = (aujourdhui, ouverture) => estOuvert({ cle: "fin_stagiaire", promo, ouverture, aujourdhui });
eq(ouv("2026-12-03", null), false, "veille de l'ouverture");
eq(ouv("2026-12-04", null), true, "premier jour");
eq(ouv("2026-12-31", null), true, "31 décembre");
eq(ouv("2027-01-01", undefined), true, "changement d'année");
eq(ouv("2027-01-10", null), true, "dernier jour");
eq(ouv("2027-01-11", null), false, "lendemain de la fermeture");
// Ouverture manuelle : prime dans les deux sens.
eq(ouv("2026-11-01", { ouvert: true }), true, "ouvert à la main avant la fenêtre");
eq(ouv("2027-03-01", { ouvert: true }), true, "ouvert à la main après la fenêtre");
eq(ouv("2026-12-20", { ouvert: false }), false, "fermé à la main dans la fenêtre");
eq(estOuvert({ cle: "fin_stagiaire", promo: {}, ouverture: null, aujourdhui: "2026-12-20" }), false, "sans date_fin et sans ouverture : fermé");
eq(estOuvert({ cle: "fin_stagiaire", promo: {}, ouverture: { ouvert: true }, aujourdhui: "2026-12-20" }), true, "sans date_fin mais ouvert à la main");
eq(ouv("pas une date", null), false, "date du jour illisible : fermé");

// Portée formateur : le lieu et l'année civile.
eq(porteeFormateur(7, "2026-12-31"), { lieu_id: 7, annee: 2026 }, "31 décembre");
eq(porteeFormateur(7, "2027-01-01"), { lieu_id: 7, annee: 2027 }, "1er janvier");

// Textes sous le seuil.
eq(texteSousSeuil("stagiaire"), "moins de 5 réponses", "texte stagiaire");
eq(texteSousSeuil("formateur"), "moins de 3 réponses", "texte formateur");

// Résultats affichables : seuil exact 4/5 (stagiaires) et 2/3 (formateurs), sur le nombre de réponses à la question.
const q = (r) => ({ note: r });
const r4 = resultatsAffichables({ note: { 1: 1, 2: 1, 3: 1, 4: 1 } }, "stagiaire");
eq(r4, [{ id: "note", sousSeuil: true }], "4 réponses stagiaires : masqué");
const r5 = resultatsAffichables({ note: { 1: 1, 2: 1, 3: 1, 4: 1, sans_avis: 1 } }, "stagiaire");
eq(r5, [{ id: "note", n: 5, repartition: { 1: 1, 2: 1, 3: 1, 4: 1, sans_avis: 1 } }], "5 réponses stagiaires : affiché, sans avis à part");
eq(resultatsAffichables({ note: { 3: 2 } }, "formateur"), [{ id: "note", sousSeuil: true }], "2 réponses formateurs : masqué");
eq(resultatsAffichables({ note: { 3: 2, 4: 1 } }, "formateur"), [{ id: "note", n: 3, repartition: { 3: 2, 4: 1 } }], "3 réponses formateurs : affiché");
eq(resultatsAffichables({ note: { null: 5 } }, "stagiaire")[0].repartition, { sans_avis: 5 }, "la clé null devient sans_avis");
eq(resultatsAffichables({ a: { 4: 5 }, b: { 1: 1 } }, "stagiaire").map((x) => x.id), ["a", "b"], "une entrée par question, ordre conservé");
eq(resultatsAffichables({ situation: { "J'enseigne": 3, "Autre": 2 } }, "stagiaire")[0].repartition, { "J'enseigne": 3, "Autre": 2 }, "question à choix : options conservées");
eq(resultatsAffichables(null, "stagiaire"), [], "pas de comptes");
eq(resultatsAffichables({}, "stagiaire"), [], "aucune question");
const vide = resultatsAffichables({ note: {} }, "stagiaire");
eq(vide, [{ id: "note", sousSeuil: true }], "question sans réponse : sous le seuil");
void q;

// Taux de satisfaction : part des 3 et 4 sur les répondants ayant donné une note, sans avis exclu.
eq(tauxSatisfaction({ 3: 2, 4: 2, 1: 1 }, 12), { taux: 80, repondants: 5, inscrits: 12 }, "4 sur 5");
eq(tauxSatisfaction({ 3: 1, 4: 1, 1: 1, 2: 2, sans_avis: 40 }, 50), { taux: 40, repondants: 5, inscrits: 50 }, "sans avis exclu du dénominateur");
eq(tauxSatisfaction({ 1: 1, 2: 1, 3: 1, 4: 1, sans_avis: 9 }, 10), null, "4 notés (le sans avis ne compte pas) : sous le seuil");
eq(tauxSatisfaction({ 4: 5 }, 5), { taux: 100, repondants: 5, inscrits: 5 }, "100 %");
eq(tauxSatisfaction({ 1: 5 }, 5), { taux: 0, repondants: 5, inscrits: 5 }, "0 %");
eq(tauxSatisfaction({ 3: 1, 4: 1, 1: 1 }, 3, "formateur"), { taux: 67, repondants: 3, inscrits: 3 }, "formateurs : seuil 3, arrondi");
eq(tauxSatisfaction({ 3: 1, 4: 1 }, 3, "formateur"), null, "formateurs : 2 notés, masqué");
eq(tauxSatisfaction({ 3: 1, 4: 1, 1: 1 }, 3), null, "par défaut stagiaire : 3 notés, masqué");
// Jamais de NaN.
for (const [c, i] of [[null, 0], [undefined, undefined], [{}, 0], [{ 3: "x" }, "y"], [{ sans_avis: 9 }, 9]]) {
  const t = tauxSatisfaction(c, i);
  assert.ok(t === null, "null attendu"); n++;
}
const t = tauxSatisfaction({ 4: 5 }, undefined);
assert.ok(!Number.isNaN(t.inscrits) && t.inscrits === 0, "inscrits absent : 0, jamais NaN"); n++;
for (const x of resultatsAffichables({ a: { 3: "x", 4: undefined, 1: -2 } }, "stagiaire")) {
  assert.ok(x.sousSeuil === true || !Number.isNaN(x.n), "pas de NaN"); n++;
}

// Aucun tiret cadratin dans le module.
import { readFileSync } from "node:fs";
assert.ok(!readFileSync(new URL("../js/questionnaires-rules.js", import.meta.url), "utf8").includes(tiret), "pas de tiret cadratin"); n++;

console.log(`questionnaires-rules : ${n} vérifications OK`);
