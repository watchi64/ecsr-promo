import assert from "node:assert/strict";
import { compteurs, ordreDePassage, placesDeLaSemaine, maSituation } from "../js/ordre-passage-rules.js";

// Comptage : Effectué + Absence, ni Bonus ni Report (même règle que le placement).
const rows = [
  { stagiaire_id: 1, type: "Salle", resultat: "Effectué" },
  { stagiaire_id: 1, type: "Salle", resultat: "Bonus" },
  { stagiaire_id: 1, type: "Voiture", resultat: "Absence" },
  { stagiaire_id: 2, type: "Salle", resultat: "Effectué" },
  { stagiaire_id: 2, type: "Salle", resultat: "Effectué" },
  { stagiaire_id: 2, type: "Salle", resultat: "Report" },
  { stagiaire_id: 2, type: "Voiture", resultat: "Effectué" },
  { stagiaire_id: 3, type: "Salle", resultat: "Effectué" },
  { stagiaire_id: 3, type: "Salle", resultat: "Effectué" },
  { stagiaire_id: 3, type: "Voiture", resultat: "Effectué" },
  { stagiaire_id: 3, type: "Voiture", resultat: "Effectué" },
  { stagiaire_id: 99, type: "Salle", resultat: "Effectué" },   // fiche inactive : ignorée
];
const c = compteurs(rows);
assert.deepEqual(c[1], { Salle: 1, Voiture: 1 });
assert.deepEqual(c[2], { Salle: 2, Voiture: 1 });
assert.deepEqual(c[3], { Salle: 2, Voiture: 2 });

const stagiaires = [
  { id: 1, nom: "B", prenom: "Alex", ordre: 2 },
  { id: 2, nom: "D", prenom: "Sam", ordre: 1 },
  { id: 3, nom: "F", prenom: "Léa", ordre: 3 },
];
const o = ordreDePassage(stagiaires, rows);
// Objectifs : salle (1+2+2)/3 = 1,67 -> 2 ; voiture (1+1+2)/3 = 1,33 -> 1.
assert.equal(o.objectif.Salle, 2);
assert.equal(o.objectif.Voiture, 1);
assert.deepEqual(o.files.Salle.map((x) => [x.id, x.retard]), [[1, 1]]);
assert.deepEqual(o.files.Voiture.map((x) => x.id), []);
assert.deepEqual(o.aJour.map((s) => s.id), [2, 3]);
assert.equal(o.parId[1].retard.Salle, 1);
assert.equal(o.parId[1].retard.Voiture, 0);

// Tri d'une file : plus grand retard, puis ordre, puis nom.
const s2 = [
  { id: 1, nom: "Z", ordre: 5 }, { id: 2, nom: "A", ordre: 5 }, { id: 3, nom: "M", ordre: 1 }, { id: 4, nom: "Q", ordre: 9 },
];
const r2 = [
  ...Array(4).fill({ stagiaire_id: 4, type: "Salle", resultat: "Effectué" }),
  { stagiaire_id: 3, type: "Salle", resultat: "Effectué" },
];
// Objectif salle round(5/4) = 1 : 1, 2 en retard de 1, 3 et 4 à jour.
const o2 = ordreDePassage(s2, r2);
assert.deepEqual(o2.files.Salle.map((x) => x.id), [2, 1]);
// Aucun stagiaire : pas de division par zéro.
assert.deepEqual(ordreDePassage([], []).objectif, { Salle: 0, Voiture: 0 });

// Places de la semaine : rôle « passage » seulement, jours désactivés ignorés.
const entries = [
  { activite: "Pédagogie salle", day_index: 3, half_day: "matin", pedagogue_id: 1, eleves_ids: [2, 3] },
  { activite: "Voiture (conduite)", day_index: 1, half_day: "aprem", eleves_ids: [2] },
  { activite: "Voiture (conduite)", day_index: 4, half_day: "matin", eleves_ids: [3] },
];
const p = placesDeLaSemaine(entries, new Set([4]));
assert.deepEqual(p[1], { Salle: 3 });
assert.deepEqual(p[2], { Voiture: 1 });
assert.equal(p[3], undefined);   // élève assis + jour désactivé : pas placé

// Trois chiffres : la somme fait l'effectif.
const ent3 = [{ activite: "Pédagogie salle", day_index: 0, half_day: "matin", pedagogue_id: 1 }];
const o3 = ordreDePassage(stagiaires, rows, placesDeLaSemaine(ent3, new Set()));
assert.deepEqual(o3.resume, { aPlacer: 0, dejaPlaces: 1, aJour: 2 });
assert.equal(o3.files.Salle[0].placeLe, 0);
const o4 = ordreDePassage(stagiaires, rows, {});
assert.deepEqual(o4.resume, { aPlacer: 1, dejaPlaces: 0, aJour: 2 });

// Ma situation (phrase du stagiaire).
assert.equal(maSituation({ Salle: 0, Voiture: 0 }), "Tu es à jour partout.");
assert.equal(maSituation({ Salle: 0, Voiture: 2 }), "Tu passes en priorité en voiture.");
assert.equal(maSituation({ Salle: 1, Voiture: 0 }), "Tu passes en priorité en salle.");
assert.equal(maSituation({ Salle: 1, Voiture: 1 }), "Tu passes en priorité en salle et en voiture.");

console.log("ordre-passage-rules : OK");
