// Comptes additifs du centre et du réseau (lot 5, D10). La fixture tests/fixtures/comptes-promo.json est jouée ici et par
// la preuve SQL (comptes_reseau) : mêmes données, mêmes comptes attendus, calculés à la main (voir le commit).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { indicateursPromo } from "../js/centre-stats.js";
import {
  CHAMPS_COMPTES, SEUIL_SECRET, comptesDepuisIndicateurs, versComptes, sommeComptes, ratiosDeComptes,
  promosEnCours, concatenerDonnees, vueDuReseau,
} from "../js/comptes-reseau.js";

const F = JSON.parse(readFileSync(new URL("./fixtures/comptes-promo.json", import.meta.url), "utf8"));
const OPT = { aujourdhui: F.aujourdhui };
const proche = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg} : ${a} au lieu de ${b}`);

test("constantes", () => {
  assert.deepEqual(CHAMPS_COMPTES, ["inscrits", "enFormation", "abandons", "absences", "prevus", "qcmBonnes",
    "qcmQuestions", "examensPasses", "examensReussis", "notesN", "notesSomme", "notesSous10", "epcfAcquis", "epcfRenseignes"]);
  assert.equal(SEUIL_SECRET, 5);
  assert.equal(F.aujourdhui, "2026-11-08");
});

test("la fixture donne les comptes attendus (calculés à la main)", () => {
  const c = comptesDepuisIndicateurs(indicateursPromo(F.donnees, F.referentiel, OPT));
  assert.deepEqual(Object.keys(c), CHAMPS_COMPTES);
  CHAMPS_COMPTES.forEach((k) => proche(c[k], F.attendu[k], k));
});

test("chaque ratio égale la valeur de l'indicateur", () => {
  const ind = indicateursPromo(F.donnees, F.referentiel, OPT);
  const r = ratiosDeComptes(comptesDepuisIndicateurs(ind));
  for (const k of ["abandon", "absences", "reussiteQcm", "examensQcm", "epcf"]) proche(r[k], ind[k].valeur, k);
  proche(r.notes, ind.notes.valeur, "notes");
  assert.ok(ind.notes.valeur != null && ind.epcf.valeur != null);
});

test("ratios sans dénominateur : null", () => {
  const r = ratiosDeComptes(sommeComptes([]));
  for (const v of Object.values(r)) assert.equal(v, null);
});

// Deux promos a et b : la fixture et une promo décalée (ids +1000, autres stagiaires), sommées ou concaténées.
function decaler(d, delta) {
  const m = (l) => l.map((x) => ({ ...x, id: x.id + delta, ...(x.stagiaire_id != null ? { stagiaire_id: x.stagiaire_id + delta } : {}) }));
  return { stagiaires: m(d.stagiaires), passages: m(d.passages), evaluations: m(d.evaluations),
    tentatives: m(d.tentatives), epcf: m(d.epcf) };
}
test("concaténer les données donne les ratios de la somme des comptes", () => {
  const a = F.donnees;
  const b = decaler({ ...F.donnees, tentatives: F.donnees.tentatives.slice(0, 5), epcf: F.donnees.epcf.slice(0, 7) }, 1000);
  const ca = comptesDepuisIndicateurs(indicateursPromo(a, F.referentiel, OPT));
  const cb = comptesDepuisIndicateurs(indicateursPromo(b, F.referentiel, OPT));
  const somme = sommeComptes([ca, cb]);
  const conc = indicateursPromo(concatenerDonnees([a, b]), F.referentiel, OPT);
  const cc = comptesDepuisIndicateurs(conc);
  CHAMPS_COMPTES.forEach((k) => proche(cc[k], somme[k], k));
  const r = ratiosDeComptes(somme);
  for (const k of ["abandon", "absences", "reussiteQcm", "examensQcm", "epcf", "notes"]) proche(r[k], conc[k].valeur, k);
  assert.equal(concatenerDonnees([]).stagiaires.length, 0);
});

const LIGNE = (o) => ({ lieu_id: 1, lieu_nom: "Centre", demonstration: false, promos_en_cours: 1, masque: false,
  inscrits: 8, en_formation: 6, abandons: 2, absences: 1, prevus: 10, qcm_bonnes: 30, qcm_questions: 40,
  examens_passes: 4, examens_reussis: 3, notes_n: 5, notes_somme: "60.5", notes_sous10: 1, epcf_acquis: 4, epcf_renseignes: 8, ...o });
const MASQUEE = (o) => LIGNE({ masque: true, inscrits: null, en_formation: null, abandons: null, absences: null,
  prevus: null, qcm_bonnes: null, qcm_questions: null, examens_passes: null, examens_reussis: null, notes_n: null,
  notes_somme: null, notes_sous10: null, epcf_acquis: null, epcf_renseignes: null, ...o });

test("versComptes", () => {
  const c = versComptes(LIGNE({ lieu_id: 3, lieu_nom: "Nîmes" }));
  assert.equal(c.lieuId, 3); assert.equal(c.lieuNom, "Nîmes"); assert.equal(c.demonstration, false);
  assert.equal(c.promosEnCours, 1); assert.equal(c.masque, false);
  assert.equal(c.enFormation, 6); assert.equal(c.notesSomme, 60.5); assert.equal(c.epcfRenseignes, 8);
  const m = versComptes(MASQUEE());
  assert.equal(m.masque, true);
  assert.equal(m.inscrits, 0);
});

test("une ligne masquée n'ajoute rien à la somme", () => {
  const a = versComptes(LIGNE());
  const seul = sommeComptes([a]);
  const avec = sommeComptes([a, versComptes(MASQUEE({ lieu_id: 2 }))]);
  assert.deepEqual(avec, seul);
  assert.deepEqual(Object.keys(avec), CHAMPS_COMPTES);
  // même une ligne qui porterait des chiffres : le drapeau seul décide
  const piege = { ...versComptes(LIGNE()), masque: true };
  assert.deepEqual(sommeComptes([a, piege]), seul);
});

test("promosEnCours", () => {
  const p = [
    { id: 1, date_debut: "2026-12-01", date_fin: null },   // à venir
    { id: 2, date_debut: "2026-09-01", date_fin: "2027-03-01" },   // en cours
    { id: 3, date_debut: "2026-01-01", date_fin: "2026-11-07" },   // finie hier
    { id: 4, date_debut: "2026-01-01", date_fin: null },   // sans fin
    { id: 5, date_debut: "2026-11-08", date_fin: "2026-11-08" },   // commence et finit aujourd'hui
  ];
  assert.deepEqual(promosEnCours(p, "2026-11-08").map((x) => x.id), [2, 4, 5]);
  assert.deepEqual(promosEnCours([], "2026-11-08"), []);
});

test("vueDuReseau", () => {
  const lignes = [
    LIGNE({ lieu_id: 2, lieu_nom: "Montpellier" }),
    LIGNE({ lieu_id: 3, lieu_nom: "Béziers", inscrits: 4, en_formation: 3, notes_somme: "10" }),
    MASQUEE({ lieu_id: 4, lieu_nom: "Petit" }),
    LIGNE({ lieu_id: 5, lieu_nom: "Sans promo", promos_en_cours: 0, masque: true, inscrits: null }),
    LIGNE({ lieu_id: 6, lieu_nom: "Démonstration", demonstration: true }),
  ];
  const v = vueDuReseau(lignes);
  assert.deepEqual(v.centres.map((c) => c.lieuNom), ["Béziers", "Montpellier", "Petit", "Sans promo"]);
  assert.equal(v.demonstration.lieuNom, "Démonstration");
  assert.equal(v.masques, 1, "masqué = au moins une promo en cours mais moins de 5 en formation");
  assert.equal(v.total.inscrits, 12);
  assert.equal(v.total.enFormation, 9);
  proche(v.total.notesSomme, 70.5, "somme des notes");
  assert.equal(vueDuReseau([]).demonstration, null);
  assert.equal(vueDuReseau([]).masques, 0);
});
