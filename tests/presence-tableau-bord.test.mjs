// Taux de présence du tableau de bord du centre (14/11) : le même chiffre que la fiche résultats Qualiopi, tiré des feuilles
// d'émargement closes ; additionné entre promos pour la Vue d'ensemble de la direction.
// Lancer depuis la racine du dépôt : node tests/presence-tableau-bord.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { presenceDePromo, presenceDesFeuilles, fusionnerEmargements } from "../js/presence-rules.js";
import { indicateursPromo, ligneComparaison, textePresenceDetail, textePresenceCourt } from "../js/centre-stats.js";
import { pct } from "../js/nombres.js";
import { concatenerDonnees, comptesDepuisIndicateurs, CHAMPS_COMPTES } from "../js/comptes-reseau.js";

const REF = { qcm: [], themes: [] };
const OPT = { aujourdhui: "2026-10-20" };
const fiche = (id, promo, actif = true) => ({ id, prenom: "P" + id, nom: "N" + id, actif, promo });
const signe = (stagiaire_id) => ({ stagiaire_id, signe_le: "2026-10-05T09:05:00Z", absent: false, absence_origine: null });
const absent = (stagiaire_id) => ({ stagiaire_id, signe_le: null, absent: true, absence_origine: "non_signe" });
// Promo 1 : deux feuilles closes de 210 min (S1 : 1 et 2 signés ; S2 : 1 signé, 2 absent) et une ouverte.
// prévues 4 × 210 = 840, réalisées 3 × 210 = 630 : 75 %.
const feuille = (id, promo_id, jour, demi, statut, lignes) => ({ id, promo_id, jour, demi_journee: demi,
  debut: demi === "matin" ? "09:00" : "13:30", fin: demi === "matin" ? "12:30" : "17:00", statut, lignes });
const P1 = { etat: "lue", seances: [
  feuille(1, 1, "2026-10-05", "matin", "close", [signe(1), signe(2)]),
  feuille(2, 1, "2026-10-05", "aprem", "close", [signe(1), absent(2)]),
  feuille(3, 1, "2026-10-06", "matin", "ouverte", [absent(1), absent(2)]),
] };
// Promo 2 : une feuille close, 3 signé : 210 / 210.
const P2 = { etat: "lue", seances: [feuille(4, 2, "2026-10-05", "matin", "close", [signe(3)])] };
const D1 = { stagiaires: [fiche(1, 1), fiche(2, 1)], passages: [], evaluations: [], tentatives: [], epcf: [], emargement: P1 };
const D2 = { stagiaires: [fiche(3, 2)], passages: [], evaluations: [], tentatives: [], epcf: [], emargement: P2 };

test("tableau de bord : même taux que la fiche résultats Qualiopi (presenceDePromo)", () => {
  const ind = indicateursPromo(D1, REF, OPT);
  assert.equal(ind.presence.valeur, presenceDePromo(P1, 1).taux);
  assert.equal(ind.presence.valeur, 0.75);
  assert.equal(ind.presence.nature, "mesuré");
  assert.equal(ind.presence.n, 2);
  assert.equal(ind.presence.detail.ouvertes, 1);
  assert.equal(ligneComparaison(ind).presence, pct(0.75));
  assert.equal(textePresenceDetail(ind.presence), "10 h 30 réalisées sur 14 h prévues · 2 feuilles closes · 2 stagiaires · 1 encore ouverte, non comptée");
});

test("Vue d'ensemble : les promos s'additionnent en minutes, pas en moyenne de taux", () => {
  const ind = indicateursPromo(concatenerDonnees([D1, D2]), REF, OPT);
  // (630 + 210) / (840 + 210) = 0,8 ; la moyenne des taux (0,875) serait fausse.
  assert.equal(ind.presence.valeur, 0.8);
  assert.equal(ind.presence.detail.effectif, 3);
  assert.equal(ind.presence.detail.feuilles, 3);
});

test("une lecture en échec rend le tout « non lu », jamais un chiffre partiel", () => {
  const ind = indicateursPromo(concatenerDonnees([D1, { ...D2, emargement: { etat: "non_lue" } }]), REF, OPT);
  assert.equal(ind.presence.valeur, null);
  assert.equal(ind.presence.nature, "non mesuré");
  assert.equal(textePresenceCourt(ind.presence), "non lue");
  assert.equal(textePresenceDetail(ind.presence), "Les feuilles d'émargement n'ont pas pu être lues.");
  assert.deepEqual(fusionnerEmargements([P1, undefined]), { etat: "non_lue" });
  assert.equal(fusionnerEmargements([P1, P2]).seances.length, 4);
});

test("sans feuille : non mesuré, avec la raison du dossier Qualiopi", () => {
  const vide = indicateursPromo({ ...D1, emargement: { etat: "lue", seances: [] } }, REF, OPT);
  assert.equal(vide.presence.valeur, null);
  assert.equal(textePresenceCourt(vide.presence), "émargement non utilisé");
  assert.equal(textePresenceDetail(vide.presence), "Feuilles d'émargement non utilisées pour cette promo.");
  const ouvertes = indicateursPromo({ ...D1, emargement: { etat: "lue", seances: [P1.seances[2]] } }, REF, OPT);
  assert.equal(textePresenceCourt(ouvertes.presence), "feuilles encore ouvertes");
});

test("presenceDesFeuilles ne trie pas par promo ; presenceDePromo, si", () => {
  const tout = { etat: "lue", seances: [...P1.seances, ...P2.seances] };
  assert.equal(presenceDesFeuilles(tout).prevuesMin, 1050);
  assert.equal(presenceDePromo(tout, 2).prevuesMin, 210);
});

test("le siège ne reçoit pas la présence : les comptes additifs restent ceux de comptes_reseau", () => {
  const c = comptesDepuisIndicateurs(indicateursPromo(D1, REF, OPT));
  assert.deepEqual(Object.keys(c), CHAMPS_COMPTES);
});

test("la carte et la comparaison sont affichées par la page du formateur et par la Vue d'ensemble", () => {
  const centre = readFileSync(new URL("../js/views/centre.js", import.meta.url), "utf8");
  assert.match(centre, /cle: "presence", titre: "Taux de présence"/);
  assert.match(centre, /\["presence", "Taux de présence"\],\r?\n  \["titre", "Réussite au titre"\],\r?\n\];/);
  const direction = readFileSync(new URL("../js/views/direction-centre.js", import.meta.url), "utf8");
  assert.match(direction, /cartesCles\(ind\)/);
  assert.match(direction, /concatenerDonnees\(/);
});
