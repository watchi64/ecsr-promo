// Résultats du jury du titre (14/11) : la saisie (js/jury-rules.js) et le taux d'obtention (js/centre-stats.js), pour la page
// Indicateurs du formateur et la Vue d'ensemble de la direction.
// Lancer depuis la racine du dépôt : node tests/jury-rules.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHOIX_JURY, valeurDeLigne, ligneDeValeur, dateSessionValide, changementsJury, dateProposee } from "../js/jury-rules.js";
import {
  bilanJury, indicateurTitre, fusionnerJury, texteTitreDetail, texteTitreCourt, indicateursPromo, ligneComparaison, METHODES,
  METHODES_PUBLIQUES,
} from "../js/centre-stats.js";
import { concatenerDonnees } from "../js/comptes-reseau.js";
import { pct } from "../js/nombres.js";

const AUJ = "2026-12-20";
const L = (stagiaire_id, resultat, extra = {}) => ({ stagiaire_id, promo_id: 1, session_le: "2026-12-15", resultat, ccp1: false, ccp2: false, ...extra });
// 5 lignes : 2 obtenus, 1 partiel (CCP1), 1 non obtenu, 1 absent. Présentés 4, obtenus 2 : 50 %.
const LIGNES = [L(1, "obtenu"), L(2, "obtenu"), L(3, "partiel", { ccp1: true }), L(4, "non_obtenu"), L(5, "absent", { session_le: "2026-12-16" })];
const JURY = { etat: "lue", lignes: LIGNES };

test("taux d'obtention : obtenus / présentés, absents exclus, partiels à côté", () => {
  const t = indicateurTitre(JURY);
  assert.equal(t.valeur, 0.5);
  assert.equal(t.nature, "mesuré");
  assert.equal(t.n, 4);
  assert.deepEqual({ ...bilanJury(JURY) }, { etat: "lue", saisis: 5, presentes: 4, obtenus: 2, partiels: 1, nonObtenus: 1, absents: 1,
    premiere: "2026-12-15", derniere: "2026-12-16" });
  assert.equal(texteTitreDetail(t), "2 obtenus sur 4 présentés · 1 validation partielle · 1 absent");
  assert.equal(texteTitreCourt(t), `${pct(0.5)} (2/4)`);
});

test("rien de saisi, absents seulement, lecture en échec : jamais un taux", () => {
  const vide = indicateurTitre({ etat: "lue", lignes: [] });
  assert.equal(vide.valeur, null);
  assert.equal(vide.nature, "non mesuré");
  assert.equal(texteTitreDetail(vide), "Aucun résultat de jury saisi.");
  assert.equal(texteTitreCourt(vide), "non saisi");
  const absents = indicateurTitre({ etat: "lue", lignes: [L(5, "absent")] });
  assert.equal(absents.valeur, null);
  assert.equal(texteTitreCourt(absents), "aucun présenté");
  for (const j of [{ etat: "non_lue" }, undefined, null]) {
    const t = indicateurTitre(j);
    assert.equal(t.valeur, null);
    assert.equal(texteTitreCourt(t), "non lu");
    assert.equal(texteTitreDetail(t), "Les résultats du jury n'ont pas pu être lus.");
  }
});

test("indicateursPromo et la comparaison portent le titre ; la Vue d'ensemble additionne les promos", () => {
  const d = (jury) => ({ stagiaires: [], passages: [], evaluations: [], tentatives: [], epcf: [], jury });
  const ind = indicateursPromo(d(JURY), { qcm: [], themes: [] }, { aujourdhui: AUJ });
  assert.equal(ind.titre.valeur, 0.5);
  assert.equal(ligneComparaison(ind).titre, `${pct(0.5)} (2/4)`);
  const autre = { etat: "lue", lignes: [L(9, "obtenu", { promo_id: 2 })] };
  const conc = indicateursPromo(concatenerDonnees([d(JURY), d(autre)]), { qcm: [], themes: [] }, { aujourdhui: AUJ });
  assert.equal(conc.titre.valeur, 3 / 5);
  assert.equal(indicateurTitre(fusionnerJury([JURY, autre])).valeur, 3 / 5);
  assert.deepEqual(fusionnerJury([JURY, { etat: "non_lue" }]), { etat: "non_lue" });
});

test("saisie : valeurs de la liste et lignes de la base, dans les deux sens", () => {
  assert.deepEqual(CHOIX_JURY.map(([v]) => v), ["", "obtenu", "partiel1", "partiel2", "non_obtenu", "absent"]);
  assert.equal(valeurDeLigne(null), "");
  assert.equal(valeurDeLigne(L(3, "partiel", { ccp1: true })), "partiel1");
  assert.equal(valeurDeLigne(L(3, "partiel", { ccp2: true })), "partiel2");
  assert.equal(valeurDeLigne(L(4, "non_obtenu")), "non_obtenu");
  assert.deepEqual(ligneDeValeur(7, "partiel2", "2026-12-15"),
    { stagiaire_id: 7, session_le: "2026-12-15", resultat: "partiel", ccp1: false, ccp2: true });
  assert.deepEqual(ligneDeValeur(7, "obtenu", "2026-12-15"),
    { stagiaire_id: 7, session_le: "2026-12-15", resultat: "obtenu", ccp1: false, ccp2: false });
  for (const v of ["obtenu", "partiel1", "partiel2", "non_obtenu", "absent"]) {
    assert.equal(valeurDeLigne(ligneDeValeur(1, v, "2026-12-15")), v, "aller-retour " + v);
  }
});

test("saisie : seules les lignes changées partent, « Non saisi » retire, la date est exigée", () => {
  const anciennes = new Map(LIGNES.map((l) => [l.stagiaire_id, l]));
  const choix = new Map([[1, "obtenu"], [2, "non_obtenu"], [3, ""], [4, "non_obtenu"], [5, "absent"], [6, "partiel2"], [7, ""], [8, "nimporte"]]);
  const r = changementsJury(anciennes, choix, "2027-03-10", "2027-03-12");
  assert.equal(r.erreur, null);
  assert.deepEqual(r.ecrire.map((l) => [l.stagiaire_id, l.resultat, l.session_le, l.ccp2]),
    [[2, "non_obtenu", "2027-03-10", false], [6, "partiel", "2027-03-10", true]]);
  assert.deepEqual(r.retirer, [3]);
  const sansDate = changementsJury(anciennes, new Map([[6, "obtenu"]]), "", AUJ);
  assert.match(sansDate.erreur, /date de la session/);
  assert.deepEqual(sansDate.ecrire, []);
  // Un retrait seul n'exige pas de date.
  assert.deepEqual(changementsJury(anciennes, new Map([[1, ""]]), "", AUJ), { ecrire: [], retirer: [1], erreur: null });
  assert.equal(dateSessionValide("2026-12-21", AUJ), false, "pas de date future");
  assert.equal(dateSessionValide("2019-12-31", AUJ), false, "pas avant 2020, comme la base");
  assert.equal(dateSessionValide("2026-12-20", AUJ), true);
  assert.equal(dateProposee(LIGNES, AUJ), "2026-12-16");
  assert.equal(dateProposee([], AUJ), AUJ);
});

test("textes : méthodes sans tiret cadratin, carte et saisie branchées", () => {
  const T = String.fromCharCode(0x2014);
  assert.ok(!METHODES.titre.includes(T) && /absents exclus/.test(METHODES.titre));
  assert.ok(/présentés/.test(METHODES_PUBLIQUES.titre));
  const centre = readFileSync(new URL("../js/views/centre.js", import.meta.url), "utf8");
  assert.match(centre, /saisirJury: isAdmin\(\) && promo/, "le bouton de saisie suit le droit d'écrire les notes");
  assert.ok(!/confirm\(/.test(centre), "aucune boîte du navigateur");
  const direction = readFileSync(new URL("../js/views/direction-centre.js", import.meta.url), "utf8");
  assert.match(direction, /indicateurTitre\(fusionnerJury\(juryParPromo\)\)/, "la direction voit le cumul de toutes ses promos");
  assert.ok(!/saisirJury/.test(direction), "la direction lit sans saisir");
});

test("fiche résultats Qualiopi : l'obtention du titre vient de l'indicateur du tableau de bord", async () => {
  const { obtentionDeLaFiche, ficheResultats } = await import("../js/qualiopi-resultats.js");
  assert.deepEqual(obtentionDeLaFiche(indicateurTitre(JURY)), { taux: 0.5, effectif: 4 });
  assert.equal(obtentionDeLaFiche(indicateurTitre({ etat: "lue", lignes: [] })), null);
  assert.deepEqual(obtentionDeLaFiche(indicateurTitre({ etat: "non_lue" })), { etat: "non_lue" });
  const d = { stagiaires: [{ id: 1, actif: true }], passages: [], evaluations: [], tentatives: [], epcf: [], jury: JURY };
  const ind = indicateursPromo(d, { qcm: [], themes: [] }, { aujourdhui: AUJ });
  const fiche = ficheResultats({ promo: { nom: "P", date_debut: "2026-03-01", date_fin: "2026-12-11" }, ind, aujourdhui: AUJ,
    obtention: obtentionDeLaFiche(ind.titre) });
  const ligne = fiche.lignes.find((l) => l.cle === "titre");
  assert.equal(ligne.valeur, pct(0.5));
  assert.equal(ligne.effectif, 4);
  const views = readFileSync(new URL("../js/views/qualiopi.js", import.meta.url), "utf8");
  assert.equal((views.match(/obtention: obtentionDeLaFiche\(/g) || []).length, 2, "les deux fiches (promo, centre) reçoivent l'obtention");
});
