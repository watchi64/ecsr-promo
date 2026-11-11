// Carte « Aujourd'hui » de l'Accueil du stagiaire (piste C, choisie par Timy le 11/11) : une phrase par activité qui le
// concerne, son rôle dit au verbe, puis une ligne de détail. Les cartes viennent de journeeDuJour, comme dans la page.
import test from "node:test";
import assert from "node:assert/strict";
import { journeeDuJour } from "../js/journee-rules.js";
import { momentsDeLaDemi } from "../js/accueil-rules.js";

const MARDI = "2026-10-27";

const noms = () => ({
  stagiaires: new Map([[1, "Lina R."], [2, "Léo B."], [3, "Ana M."], [4, "Hugo T."]]),
  formateurs: new Map([[1, "Claire"], [2, "Marc"]]),
  benevoles: new Map([[1, "Paul D."], [2, "Emma L."]]),
  titres: [],
});

function carte(extra) {
  return {
    id: 1, day_index: 1, half_day: "matin", slot: 0, lane: 0, activite: "Pédagogie salle",
    prof_id: null, prof_ids: [1], prof_autre: null, autonomie: false, sujet: null, sujet_2: null,
    pedagogue_id: null, pedagogue_id_2: null, eleves_ids: [], eleves_ids_2: [], salle_double: false,
    benevoles_ids: [], notes: null, absences: [], ...extra,
  };
}

// Les moments d'une demi-journée vus par `moi` (null : aperçu sans fiche de stagiaire).
function moments(entries, moi, demi = "matin") {
  const j = journeeDuJour({ entries, metas: [], joursOff: [], jour: MARDI, moi, noms: noms() });
  return momentsDeLaDemi({ cartes: j.demis.find((d) => d.demi === demi).cartes, moi });
}
const lu = (m) => m.map(({ ico, titre, detail, note, moi }) => ({ ico, titre, detail, note, moi }));

// La capture du 11/11 : le matin, une salle (Lina au tableau) et une voiture en même temps (Léo enseigne à Paul D.).
const MATIN = [
  carte({ id: 10, lane: 0, pedagogue_id: 1, eleves_ids: [3, 4], sujet: "Le croisement" }),
  carte({ id: 11, lane: 1, activite: "Voiture (conduite)", prof_ids: [2], eleves_ids: [2], benevoles_ids: [1] }),
];

test("au tableau : la voiture des autres ne s'affiche pas", () => {
  assert.deepEqual(lu(moments(MATIN, 1)), [
    { ico: "presentation", titre: "Tu passes au tableau", detail: "en salle · Le croisement, avec Claire", note: null, moi: "tableau" },
  ]);
});

test("en salle sans passer : qui est au tableau", () => {
  assert.deepEqual(lu(moments(MATIN, 3)), [
    { ico: "presentation", titre: "Tu es en salle", detail: "Lina R. passe au tableau · Le croisement, avec Claire", note: null, moi: "eleve" },
  ]);
});

test("en voiture : la stagiaire enseigne, l'élève bénévole conduit", () => {
  assert.deepEqual(lu(moments(MATIN, 2)), [
    { ico: "car", titre: "Tu enseignes en voiture", detail: "à Paul D., élève bénévole, avec Marc", note: null, moi: "voiture" },
  ]);
});

test("en voiture : deux élèves bénévoles, un sujet, sans formateur", () => {
  const e = [carte({ activite: "Voiture (conduite)", prof_ids: [], eleves_ids: [2], benevoles_ids: [2, 1], sujet: "Rond-point" })];
  assert.equal(moments(e, 2)[0].detail, "à Emma L. et Paul D., élèves bénévoles · Rond-point");
});

test("en voiture sans élève bénévole : le formateur seul", () => {
  const e = [carte({ activite: "Voiture (conduite)", prof_ids: [2], eleves_ids: [2] })];
  assert.equal(moments(e, 2)[0].detail, "avec Marc");
});

test("salle double : chaque pédagogue lit son propre sujet", () => {
  const e = [carte({ salle_double: true, pedagogue_id: 1, pedagogue_id_2: 2, eleves_ids: [3, 4], eleves_ids_2: [3, 4],
    sujet: "Feux", sujet_2: "Pneus", prof_ids: [1, 2] })];
  assert.equal(moments(e, 2)[0].detail, "en salle · Pneus, avec Claire et Marc");
  assert.equal(moments(e, 1)[0].detail, "en salle · Feux, avec Claire et Marc");
  assert.equal(moments(e, 3)[0].detail, "Lina R. et Léo B. passent au tableau · Feux · Pneus, avec Claire et Marc");
});

test("un cours concerne toute la promo : « Tu suis le cours »", () => {
  const e = [carte({ half_day: "aprem", activite: "Cours", sujet: "Les passages à niveaux" })];
  assert.deepEqual(lu(moments(e, 1, "aprem")), [
    { ico: "book", titre: "Tu suis le cours", detail: "Les passages à niveaux, avec Claire", note: null, moi: null },
  ]);
});

test("contrôle, autonomie et autre activité : leur nom, la note de l'autre activité en titre", () => {
  const e = [
    carte({ id: 1, activite: "Contrôle", sujet: "Signalisation" }),
    carte({ id: 2, lane: 1, activite: "Autre", autonomie: true, prof_ids: [] , notes: "Révisions libres" }),
    carte({ id: 3, lane: 2, activite: "Autre", prof_ids: [2], notes: "Visite du centre d'examen" }),
  ];
  assert.deepEqual(lu(moments(e, 1)), [
    { ico: "clipboard", titre: "Contrôle", detail: "Signalisation, avec Claire", note: null, moi: null },
    { ico: "users", titre: "Autonomie", detail: null, note: "Révisions libres", moi: null },
    { ico: "calendar", titre: "Visite du centre d'examen", detail: "avec Marc", note: null, moi: null },
  ]);
});

test("une note du planning reste sous la phrase", () => {
  const e = [carte({ pedagogue_id: 1, eleves_ids: [3], notes: "Salle 2" })];
  assert.equal(moments(e, 1)[0].note, "Salle 2");
});

test("sur aucune carte : aucun moment (la phrase « ton nom ne figure… » prend le relais)", () => {
  assert.deepEqual(moments(MATIN, 4 + 100), []);
});

test("absent remplacé : le remplaçant passe au tableau, l'absent n'a plus rien", () => {
  const e = [carte({ pedagogue_id: 1, eleves_ids: [3], absences: [{ sid: 1, rid: 4 }] })];
  assert.equal(moments(e, 4)[0].titre, "Tu passes au tableau");
  assert.deepEqual(moments(e, 1), []);
});

test("aperçu sans fiche de stagiaire : toutes les activités, au neutre", () => {
  assert.deepEqual(lu(moments(MATIN, null)), [
    { ico: "presentation", titre: "Salle", detail: "Lina R. passe au tableau · Le croisement, avec Claire", note: null, moi: null },
    { ico: "car", titre: "Voiture", detail: "Léo B. enseigne à Paul D., élève bénévole, avec Marc", note: null, moi: null },
  ]);
});

test("aperçu : deux stagiaires dans la même voiture, puis une voiture sans stagiaire", () => {
  const e = [
    carte({ id: 1, activite: "Voiture (conduite)", prof_ids: [2], eleves_ids: [2, 3], benevoles_ids: [1, 2] }),
    carte({ id: 2, lane: 1, activite: "Voiture (conduite)", prof_ids: [2], eleves_ids: [] , benevoles_ids: [1] }),
  ];
  const [a, b] = moments(e, null);
  assert.equal(a.detail, "Léo B. et Ana M. enseignent à Paul D. et Emma L., élèves bénévoles, avec Marc");
  assert.equal(b.detail, "Aucun stagiaire en voiture · Paul D., élève bénévole, avec Marc");
});

// Relecture neuve du 11/11 : quatre cas que la première version disait mal.

test("salle en autonomie : le rôle reste dit, « en autonomie » à la place du formateur", () => {
  const e = [carte({ autonomie: true, prof_ids: [], pedagogue_id: 1, eleves_ids: [3], sujet: "Feux" })];
  assert.deepEqual(lu(moments(e, 1)), [
    { ico: "presentation", titre: "Tu passes au tableau", detail: "en salle · Feux, en autonomie", note: null, moi: "tableau" },
  ]);
  assert.equal(moments(e, 3)[0].detail, "Lina R. passe au tableau · Feux, en autonomie");
  assert.deepEqual(moments(e, 2), [], "une salle en autonomie qui ne la nomme pas reste au Planning");
});

test("voiture en autonomie : « Tu enseignes en voiture » et ses élèves bénévoles", () => {
  const e = [carte({ activite: "Voiture (conduite)", autonomie: true, prof_ids: [], eleves_ids: [2], benevoles_ids: [1] })];
  assert.deepEqual(lu(moments(e, 2)), [
    { ico: "car", titre: "Tu enseignes en voiture", detail: "à Paul D., élève bénévole, en autonomie", note: null, moi: "voiture" },
  ]);
});

test("autonomie qui ne nomme personne : toute la promo, sans phrase « ton nom ne figure… »", () => {
  const e = [carte({ autonomie: true, prof_ids: [], notes: "Révisions" })];
  assert.deepEqual(lu(moments(e, 1)), [{ ico: "users", titre: "Autonomie", detail: null, note: "Révisions", moi: null }]);
});

test("salle double : l'élève d'un seul groupe ne lit que sa vague", () => {
  const e = [carte({ salle_double: true, pedagogue_id: 1, pedagogue_id_2: 2, eleves_ids: [3], eleves_ids_2: [4],
    sujet: "Feux", sujet_2: "Pneus" })];
  assert.equal(moments(e, 4)[0].detail, "Léo B. passe au tableau · Pneus, avec Claire");
  assert.equal(moments(e, 3)[0].detail, "Lina R. passe au tableau · Feux, avec Claire");
});

test("salle double : pédagogue du groupe 1 et élève du groupe 2, les deux rôles sont dits", () => {
  const e = [carte({ salle_double: true, pedagogue_id: 1, pedagogue_id_2: 2, eleves_ids: [3], eleves_ids_2: [1, 4],
    sujet: "Feux", sujet_2: "Pneus" })];
  const [m] = moments(e, 1);
  assert.equal(m.titre, "Tu passes au tableau");
  assert.equal(m.detail, "en salle · Feux, avec Claire");
  assert.equal(m.aussi, "Tu es aussi en salle quand Léo B. passe au tableau · Pneus.");
});

test("voiture à deux stagiaires : l'autre est nommé à part, le formateur reste seul après « avec »", () => {
  const e = [carte({ activite: "Voiture (conduite)", prof_ids: [2], eleves_ids: [1, 2], benevoles_ids: [1, 2] })];
  const [m] = moments(e, 1);
  assert.equal(m.detail, "à Paul D. et Emma L., élèves bénévoles, avec Marc");
  assert.equal(m.aussi, "Léo B. enseigne aussi dans cette voiture.");
  assert.equal(moments([carte({ activite: "Voiture (conduite)", prof_ids: [2], eleves_ids: [2], benevoles_ids: [1] })], 2)[0].aussi, null);
});

test("aucune phrase ne porte de tiret cadratin", () => {
  const tout = JSON.stringify([moments(MATIN, 1), moments(MATIN, 2), moments(MATIN, 3), moments(MATIN, null)]);
  assert.ok(!tout.includes("\u2014"));
});
