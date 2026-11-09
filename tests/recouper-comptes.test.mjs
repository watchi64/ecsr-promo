// Outil de recoupement des chiffres du réseau (lot 5, Task 16) : outils/recouper_comptes.mjs.
// Joué sur la fixture commune (tests/fixtures/comptes-promo.json : le brut est `donnees`, les comptes de la base sont `attendu` en
// colonnes de comptes_reseau()), puis sur des copies sabotées : l'outil doit dire « identiques » ou nommer chaque écart, et sortir en code 1.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { recouper } from "../outils/recouper_comptes.mjs";

const F = JSON.parse(readFileSync(new URL("./fixtures/comptes-promo.json", import.meta.url), "utf8"));
const OUTIL = new URL("../outils/recouper_comptes.mjs", import.meta.url);
const colonne = (champ) => champ.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());

// Le brut : un centre (lieu 1) dont la promo de la fixture est en cours le 8/11/2026.
const promo = (extra = {}) => ({ promo_id: F.promo_id, lieu_id: 1, date_debut: "2026-03-30", date_fin: null, donnees: F.donnees, ...extra });
const brut = (promos = [promo()]) => ({ aujourdhui: F.aujourdhui, referentiel: F.referentiel, promos });
// La ligne de comptes_reseau() d'un centre : `attendu` en colonnes de la base.
const ligne = (extra = {}) => ({
  lieu_id: 1, lieu_nom: "Centre fictif", demonstration: false, promos_en_cours: 1, masque: false,
  ...Object.fromEntries(Object.entries(F.attendu).map(([k, v]) => [colonne(k), v])), ...extra,
});
const masquee = (extra = {}) => ligne({
  masque: true, inscrits: null, en_formation: null, abandons: null, absences: null, prevus: null, qcm_bonnes: null, qcm_questions: null,
  examens_passes: null, examens_reussis: null, notes_n: null, notes_somme: null, notes_sous10: null, epcf_acquis: null, epcf_renseignes: null, ...extra,
});
// Le brut de la fixture réduit à `n` stagiaires en formation (les autres : retirés avec leurs lignes).
function reduit(n) {
  const gardes = new Set(F.donnees.stagiaires.filter((s) => s.actif).slice(0, n).map((s) => s.id));
  const d = F.donnees;
  const sur = (l) => l.filter((x) => x.stagiaire_id == null || gardes.has(x.stagiaire_id));
  return { stagiaires: d.stagiaires.filter((s) => gardes.has(s.id)), passages: sur(d.passages), evaluations: sur(d.evaluations),
    tentatives: sur(d.tentatives), epcf: sur(d.epcf) };
}

// Joue l'outil en ligne de commande sur deux fichiers temporaires.
function jouer(b, comptes) {
  const dossier = mkdtempSync(join(tmpdir(), "recoupement-"));
  writeFileSync(join(dossier, "brut.json"), JSON.stringify(b));
  writeFileSync(join(dossier, "comptes.json"), JSON.stringify(comptes));
  const r = spawnSync(process.execPath, [OUTIL.pathname.replace(/^\/([A-Za-z]:)/, "$1"), join(dossier, "brut.json"), join(dossier, "comptes.json")],
    { encoding: "utf8" });
  return { code: r.status, sortie: r.stdout + r.stderr };
}

test("la fixture : le brut et les comptes de la base sont identiques (code 0)", () => {
  const r = jouer(brut(), [ligne()]);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.sortie, /identiques/);
  assert.deepEqual(recouper(brut(), [ligne()]).ecarts, []);
});

test("une copie sabotée : un compte faux est nommé, code 1", () => {
  const r = jouer(brut(), [ligne({ qcm_bonnes: F.attendu.qcmBonnes + 1 })]);
  assert.equal(r.code, 1, r.sortie);
  assert.match(r.sortie, /Centre fictif : qcm_bonnes : 26 d'après la base, 25 d'après le calcul de l'app/);
  assert.doesNotMatch(r.sortie, /identiques/);
  assert.match(r.sortie, /1 écart/);
});

test("deux comptes faux : deux écarts", () => {
  const e = recouper(brut(), [ligne({ inscrits: 9, abandons: 0 })]).ecarts;
  assert.equal(e.length, 2);
  assert.ok(e.some((x) => x.includes("inscrits")) && e.some((x) => x.includes("abandons")));
});

test("les notes se comparent à 1e-9 près", () => {
  assert.deepEqual(recouper(brut(), [ligne({ notes_somme: F.attendu.notesSomme + 1e-12 })]).ecarts, []);
  const e = recouper(brut(), [ligne({ notes_somme: F.attendu.notesSomme + 1e-6 })]).ecarts;
  assert.equal(e.length, 1);
  assert.match(e[0], /notes_somme/);
});

test("un centre de moins de 5 stagiaires en formation : masqué par la base, seul le calcul de l'app est vérifié", () => {
  const b = brut([promo({ donnees: reduit(3) })]);
  const r = jouer(b, [masquee()]);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.sortie, /identiques \(1 centre, dont 1 masqué\)/);
  // Les colonnes d'une ligne masquée sont ignorées : même pleines, elles ne comptent pas.
  assert.deepEqual(recouper(b, [masquee({ inscrits: 999 })]).ecarts, []);
});

test("masqué à tort (le calcul de l'app donne 5 en formation ou plus) : écart", () => {
  const r = jouer(brut(), [masquee()]);
  assert.equal(r.code, 1, r.sortie);
  assert.match(r.sortie, /masqué par la base, mais le calcul de l'app donne 6 en formation/);
});

test("non masqué à tort (moins de 5 en formation) : écart", () => {
  const e = recouper(brut([promo({ donnees: reduit(3) })]), [ligne()]).ecarts;
  assert.ok(e.some((x) => /devrait être masqué/.test(x)), e.join(" | "));
});

test("seules les promos en cours comptent : une promo terminée n'entre pas, et le nombre de promos en cours est comparé", () => {
  const terminee = promo({ promo_id: 2, date_debut: "2025-01-06", date_fin: "2025-06-30" });
  assert.deepEqual(recouper(brut([promo(), terminee]), [ligne()]).ecarts, []);
  const e = recouper(brut([promo(), terminee]), [ligne({ promos_en_cours: 2 })]).ecarts;
  assert.equal(e.length, 1);
  assert.match(e[0], /promos en cours : 1 d'après le brut, 2 d'après la base/);
});

// Une seconde promo : la fixture décalée (autres identifiants, mêmes lignes), donc des comptes doublés une fois sommés.
function decalee(delta) {
  const d = F.donnees;
  const m = (l) => l.map((x) => ({ ...x, id: x.id + delta, ...(x.stagiaire_id != null ? { stagiaire_id: x.stagiaire_id + delta } : {}) }));
  return { stagiaires: m(d.stagiaires), passages: m(d.passages), evaluations: m(d.evaluations), tentatives: m(d.tentatives), epcf: m(d.epcf) };
}
test("deux promos en cours du même centre : les données sont concaténées avant le calcul, les comptes s'additionnent", () => {
  const b = brut([promo(), promo({ promo_id: 3, donnees: decalee(1000) })]);
  const doubles = Object.fromEntries(Object.entries(F.attendu).map(([k, v]) => [colonne(k), v * 2]));
  assert.deepEqual(recouper(b, [ligne({ promos_en_cours: 2, ...doubles })]).ecarts, []);
  // Les comptes d'une seule promo ne sont pas ceux des deux.
  const e = recouper(b, [ligne({ promos_en_cours: 2 })]).ecarts;
  assert.ok(e.length > 0 && e.every((x) => x.includes("Centre fictif")));
});

test("un centre sans promo en cours : aucun chiffre non nul attendu de la base", () => {
  const b = brut([promo({ date_fin: "2026-01-01" })]);
  assert.deepEqual(recouper(b, [ligne({ promos_en_cours: 0, ...Object.fromEntries(Object.keys(F.attendu).map((k) => [colonne(k), 0])) })]).ecarts, []);
  const e = recouper(b, [ligne({ promos_en_cours: 0 })]).ecarts;
  assert.ok(e.length > 0 && e.every((x) => x.includes("sans promo en cours")));
});

test("un centre présent d'un seul côté : écart", () => {
  const e1 = recouper(brut(), [ligne(), ligne({ lieu_id: 2, lieu_nom: "Autre centre" })]).ecarts;
  assert.ok(e1.some((x) => x.includes("Autre centre") && x.includes("le brut n'a aucune promo")));
  const e2 = recouper(brut([promo(), promo({ promo_id: 5, lieu_id: 2 })]), [ligne()]).ecarts;
  assert.ok(e2.some((x) => x.includes("centre 2") && x.includes("n'envoie aucune ligne")));
});

test("des fichiers illisibles : code 2, rien n'est affirmé", () => {
  const r = spawnSync(process.execPath, [OUTIL.pathname.replace(/^\/([A-Za-z]:)/, "$1"), "inexistant.json", "inexistant2.json"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.doesNotMatch(r.stdout, /identiques/);
});
