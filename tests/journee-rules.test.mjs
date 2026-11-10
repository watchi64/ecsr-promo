import test from "node:test";
import assert from "node:assert/strict";
import {
  journeeDuJour, semaineEnGrille, jourParDefaut, lundiEnCours, etiquetteSemaine, vuePlanningInitiale, DEFAULT_HALF_META,
} from "../js/journee-rules.js";
import { sujetsDe, entryHasContent, effPedagogueId } from "../js/planning-roles.js";

const LUNDI = "2026-10-26";
const MARDI = "2026-10-27";

const noms = () => ({
  stagiaires: new Map([[1, "Timy"], [2, "Anissa"], [3, "Lorie"], [4, "Valentin"], [5, "Cassandre"], [6, "Céline"]]),
  formateurs: new Map([[1, "Romain"], [2, "Hocine"]]),
  benevoles: new Map([[1, "Camille C."], [2, "Yanis Y."]]),
  autres: [],
});

function carte(extra) {
  return {
    id: 1, day_index: 1, half_day: "matin", slot: 0, lane: 0, activite: "Pédagogie salle",
    prof_id: null, prof_ids: [1], prof_autre: null, autonomie: false, sujet: null, sujet_2: null,
    pedagogue_id: null, pedagogue_id_2: null, eleves_ids: [], eleves_ids_2: [], salle_double: false,
    benevoles_ids: [], notes: null, absences: [], ...extra,
  };
}

function jour(entries, extra = {}) {
  return journeeDuJour({ entries, metas: [], joursOff: [], jour: MARDI, moi: null, noms: noms(), ...extra });
}

const matin = (j) => j.demis[0];
const aprem = (j) => j.demis[1];

test("un mardi : salle double le matin, voiture l'après-midi", () => {
  const entries = [
    carte({ id: 10, activite: "Pédagogie salle", salle_double: true, pedagogue_id: 2, pedagogue_id_2: 3,
            eleves_ids: [4], eleves_ids_2: [5, 6], sujet: "Feux", sujet_2: "Pneus" }),
    carte({ id: 11, half_day: "aprem", activite: "Voiture (conduite)", eleves_ids: [1, 2],
            benevoles_ids: [2, 1], sujet: "Rond-point" }),
  ];
  const j = jour(entries);
  assert.equal(j.repos, null);
  assert.equal(j.demis.length, 2);
  assert.deepEqual(j.demis.map((d) => [d.demi, d.titre]), [["matin", "Matin"], ["aprem", "Après-midi"]]);

  const s = matin(j).cartes[0];
  assert.equal(s.genre, "salle");
  assert.deepEqual(s.tableau, [{ id: 2, nom: "Anissa", groupe: 1 }, { id: 3, nom: "Lorie", groupe: 2 }]);
  assert.deepEqual(s.eleves, [{ id: 4, nom: "Valentin" }, { id: 5, nom: "Cassandre" }, { id: 6, nom: "Céline" }]);
  assert.deepEqual(s.sujets, ["Feux", "Pneus"]);
  assert.deepEqual(s.sujetsParGroupe, { 1: ["Feux"], 2: ["Pneus"] }, "salle double : le sujet de chaque groupe");
  assert.deepEqual(s.formateurs, ["Romain"]);
  assert.deepEqual(s.conducteurs, []);

  const v = aprem(j).cartes[0];
  assert.equal(v.genre, "voiture");
  assert.deepEqual(v.conducteurs, [{ id: 1, nom: "Timy" }, { id: 2, nom: "Anissa" }]);
  assert.deepEqual(v.benevoles, ["Yanis Y.", "Camille C."]);
  assert.deepEqual(v.tableau, []);
  assert.deepEqual(v.eleves, []);
});

test("horaires : défauts de DEFAULT_HALF_META, puis lus dans metas", () => {
  assert.equal(DEFAULT_HALF_META.matin.start_time, "09:00");
  const j = jour([]);
  assert.equal(matin(j).horaire, "9 h à 12 h 30");
  assert.equal(aprem(j).horaire, "13 h 30 à 17 h");
  assert.deepEqual(matin(j).cartes, []);
  const metas = [{ day_index: 1, half_day: "aprem", start_time: "14:00:00", end_time: "18:15:00" }];
  const j2 = jour([], { metas });
  assert.equal(aprem(j2).horaire, "14 h à 18 h 15");
  assert.equal(matin(j2).horaire, "9 h à 12 h 30");
});

test("une meta sans heures retombe sur les défauts", () => {
  const metas = [{ day_index: 1, half_day: "matin", start_time: null, end_time: null }];
  assert.equal(matin(jour([], { metas })).horaire, "9 h à 12 h 30");
});

test("prof_ids se normalise : prof_id sinon, plus le nom libre", () => {
  const j = jour([carte({ prof_ids: [], prof_id: 2, prof_autre: "M. Durand", activite: "Cours" })]);
  assert.deepEqual(matin(j).cartes[0].formateurs, ["Hocine", "M. Durand"]);
});

test("moi : au tableau, élève en salle, au volant", () => {
  const salle = carte({ pedagogue_id: 2, eleves_ids: [3, 4] });
  const voiture = carte({ id: 2, half_day: "aprem", activite: "Voiture (conduite)", eleves_ids: [1, 2] });
  const au = (moi) => jour([salle, voiture], { moi });
  assert.deepEqual(matin(au(2)).cartes[0].moi, { role: "tableau", texte: "Tu passes au tableau" });
  assert.deepEqual(matin(au(3)).cartes[0].moi, { role: "eleve", texte: "En salle" });
  assert.deepEqual(aprem(au(1)).cartes[0].moi, { role: "voiture", texte: "Tu conduis" });
  assert.equal(matin(au(5)).cartes[0].moi, null);
  assert.equal(matin(jour([salle, voiture], { moi: null })).cartes[0].moi, null);
});

test("moi : le tableau du groupe 1 qui est aussi élève du groupe 2 garde l'étiquette du tableau", () => {
  const c = carte({ salle_double: true, pedagogue_id: 2, pedagogue_id_2: 3, eleves_ids: [4], eleves_ids_2: [2] });
  assert.equal(matin(jour([c], { moi: 2 })).cartes[0].moi.role, "tableau");
});

test("absent remplacé : le remplaçant prend la place et l'étiquette ; l'absent n'en a pas", () => {
  const c = carte({ pedagogue_id: 2, eleves_ids: [3], absences: [{ sid: 2, rid: 5 }] });
  const j = jour([c], { moi: 5 });
  const k = matin(j).cartes[0];
  assert.deepEqual(k.tableau, [{ id: 5, nom: "Cassandre", groupe: 1 }]);
  assert.equal(k.moi.role, "tableau");
  assert.equal(matin(jour([c], { moi: 2 })).cartes[0].moi, null);
});

test("absent sans remplaçant : il disparaît des listes et n'a pas d'étiquette", () => {
  const c = carte({ activite: "Voiture (conduite)", eleves_ids: [1, 2], absences: [{ sid: 1, rid: null }] });
  const k = matin(jour([c], { moi: 1 })).cartes[0];
  assert.deepEqual(k.conducteurs, [{ id: 2, nom: "Anissa" }]);
  assert.equal(k.moi, null);
});

test("un remplaçant déjà présent sur la carte n'apparaît pas deux fois", () => {
  const c = carte({ activite: "Voiture (conduite)", eleves_ids: [1, 2], absences: [{ sid: 1, rid: 2 }] });
  assert.deepEqual(matin(jour([c])).cartes[0].conducteurs, [{ id: 2, nom: "Anissa" }]);
});

test("salle_double faux : pedagogue_id_2 et eleves_ids_2 restés en base sont ignorés", () => {
  const c = carte({ salle_double: false, pedagogue_id: 2, pedagogue_id_2: 3, eleves_ids: [4], eleves_ids_2: [5],
                    sujet: "Feux", sujet_2: "Pneus" });
  const k = matin(jour([c], { moi: 3 })).cartes[0];
  assert.deepEqual(k.tableau, [{ id: 2, nom: "Anissa", groupe: 1 }]);
  assert.deepEqual(k.eleves, [{ id: 4, nom: "Valentin" }]);
  assert.deepEqual(k.sujets, ["Feux"]);
  assert.equal(k.moi, null);
});

test("activité changée : les rôles restés en base sont ignorés", () => {
  const c = carte({ activite: "Cours", pedagogue_id: 2, eleves_ids: [3], benevoles_ids: [1], sujet: "Feux" });
  const k = matin(jour([c], { moi: 2 })).cartes[0];
  assert.equal(k.genre, "cours");
  assert.deepEqual(k.tableau, []);
  assert.deepEqual(k.eleves, []);
  assert.deepEqual(k.conducteurs, []);
  assert.deepEqual(k.benevoles, []);
  assert.equal(k.moi, null);
});

test("autonomie: true donne le genre autonomie", () => {
  const c = carte({ activite: "Cours", autonomie: true, prof_ids: [] });
  assert.equal(matin(jour([c])).cartes[0].genre, "autonomie");
});

test("genres : contrôle, autre, activité vide", () => {
  const c1 = carte({ id: 1, activite: "Contrôle", slot: 0 });
  const c2 = carte({ id: 2, activite: "Autre", notes: "Visite", slot: 1 });
  const c3 = carte({ id: 3, activite: "", notes: "x", slot: 2 });
  const genres = matin(jour([c1, c2, c3])).cartes.map((c) => c.genre);
  assert.deepEqual(genres, ["controle", "autre", "autre"]);
});

test("une carte sans contenu est retirée ; les autres sont triées par slot puis lane", () => {
  const vide = carte({ id: 1, activite: "", prof_ids: [], prof_id: null });
  const a = carte({ id: 2, slot: 1, lane: 1, activite: "Cours" });
  const b = carte({ id: 3, slot: 0, lane: 1, activite: "Cours" });
  const c = carte({ id: 4, slot: 1, lane: 0, activite: "Cours" });
  const ids = matin(jour([vide, a, b, c])).cartes.map((k) => k.id);
  assert.deepEqual(ids, [3, 4, 2]);
});

test("les cartes d'un autre jour ou d'une autre demi-journée n'entrent pas", () => {
  const autreJour = carte({ id: 1, day_index: 2, activite: "Cours" });
  const autreDemi = carte({ id: 2, half_day: "aprem", activite: "Cours" });
  const j = jour([autreJour, autreDemi]);
  assert.equal(matin(j).cartes.length, 0);
  assert.equal(aprem(j).cartes.length, 1);
});

test("le sujet « Stationnement, arrêt, immobilisation » reste un seul sujet quand le titre est connu", () => {
  const titre = "Stationnement, arrêt, immobilisation";
  const c = carte({ activite: "Cours", sujet: titre + ", Feux" });
  const connu = jour([c], { noms: { ...noms(), titres: [titre, "Feux"] } });
  assert.deepEqual(matin(connu).cartes[0].sujets, [titre, "Feux"]);
  const inconnu = jour([c]);
  assert.deepEqual(matin(inconnu).cartes[0].sujets, ["Stationnement", "arrêt", "immobilisation", "Feux"]);
});

test("sujetsDe : titres connus recollés, le plus long d'abord", () => {
  assert.deepEqual(sujetsDe("A, B, C", ["A, B"]), ["A, B", "C"]);
  assert.deepEqual(sujetsDe("A, B, C", ["A, B", "A, B, C"]), ["A, B, C"]);
  assert.deepEqual(sujetsDe("", []), []);
  assert.deepEqual(sujetsDe(null, []), []);
  assert.deepEqual(sujetsDe("A, B", new Set(["A, B"])), ["A, B"]);
});

test("repos : samedi, dimanche, férié, jour off", () => {
  const r = (iso, joursOff = []) => journeeDuJour({ entries: [], metas: [], joursOff, jour: iso, moi: null, noms: noms() });
  assert.deepEqual(r("2026-10-31"), { repos: "Samedi", demis: [] });
  assert.deepEqual(r("2026-11-01"), { repos: "Dimanche", demis: [] });
  assert.deepEqual(r("2026-11-11"), { repos: "Armistice", demis: [] });
  assert.deepEqual(r("2026-10-28", [{ day_index: 2, label: "Sortie" }]), { repos: "Sortie", demis: [] });
  assert.deepEqual(r("2026-10-28", [{ day_index: 2, label: "" }]), { repos: "Désactivé", demis: [] });
  assert.equal(r("2026-10-27", [{ day_index: 2, label: "Sortie" }]).repos, null);
});

test("un jour off manuel passe avant un férié", () => {
  const j = journeeDuJour({ entries: [], metas: [], joursOff: [{ day_index: 2, label: "Pont" }],
                            jour: "2026-11-11", moi: null, noms: noms() });
  assert.equal(j.repos, "Pont");
});

test("semaine vide : deux demi-journées sans carte", () => {
  const j = jour([]);
  assert.equal(j.repos, null);
  assert.deepEqual(j.demis.map((d) => d.cartes.length), [0, 0]);
});

test("semaineEnGrille : cinq jours, un seul aujourd'hui", () => {
  const g = semaineEnGrille({ entries: [], metas: [], joursOff: [], lundi: LUNDI, moi: null, noms: noms(), aujourdhui: "2026-10-28" });
  assert.equal(g.length, 5);
  assert.deepEqual(g.map((x) => x.index), [0, 1, 2, 3, 4]);
  assert.deepEqual(g.map((x) => x.court), ["Lun", "Mar", "Mer", "Jeu", "Ven"]);
  assert.deepEqual(g.map((x) => x.iso), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  assert.deepEqual(g.map((x) => x.aujourdhui), [false, false, true, false, false]);
  assert.equal(g[0].long, "Lundi 26 octobre");
  assert.equal(g[0].numero, 26);
  assert.equal(g.filter((x) => x.aujourdhui).length, 1);
});

test("semaineEnGrille : aujourd'hui hors de la semaine, aucun jour marqué", () => {
  const g = semaineEnGrille({ entries: [], metas: [], joursOff: [], lundi: LUNDI, moi: null, noms: noms(), aujourdhui: "2026-11-03" });
  assert.equal(g.filter((x) => x.aujourdhui).length, 0);
});

test("semaineEnGrille : jeudi 5 novembre 2026 et passage à décembre", () => {
  const g = semaineEnGrille({ entries: [], metas: [], joursOff: [], lundi: "2026-11-02", moi: null, noms: noms(), aujourdhui: "2026-11-05" });
  assert.equal(g[3].long, "Jeudi 5 novembre");
  assert.equal(g[3].aujourdhui, true);
  const d = semaineEnGrille({ entries: [], metas: [], joursOff: [], lundi: "2026-11-30", moi: null, noms: noms(), aujourdhui: "2026-12-01" });
  assert.deepEqual(d.map((x) => x.long), ["Lundi 30 novembre", "Mardi 1er décembre", "Mercredi 2 décembre", "Jeudi 3 décembre", "Vendredi 4 décembre"]);
  assert.deepEqual(d.map((x) => x.numero), [30, 1, 2, 3, 4]);
});

test("semaineEnGrille : le 11 novembre est un repos, les cartes suivent leur jour", () => {
  const entries = [carte({ day_index: 1, activite: "Cours" })];
  const g = semaineEnGrille({ entries, metas: [], joursOff: [{ day_index: 3, label: "Sortie" }],
                              lundi: "2026-11-09", moi: null, noms: noms(), aujourdhui: "2026-11-09" });
  assert.equal(g[2].repos, "Armistice");
  assert.deepEqual(g[2].demis, []);
  assert.equal(g[3].repos, "Sortie");
  assert.equal(g[0].repos, null);
  assert.equal(g[1].demis[0].cartes.length, 1);
  assert.equal(g[1].demis[1].cartes.length, 0);
});

test("etiquetteSemaine", () => {
  assert.equal(etiquetteSemaine({ role: "tableau", texte: "Tu passes au tableau" }), "Toi au tableau");
  assert.equal(etiquetteSemaine({ role: "voiture", texte: "Tu conduis" }), "Toi en voiture");
  assert.equal(etiquetteSemaine({ role: "eleve", texte: "En salle" }), "Toi en salle");
  assert.equal(etiquetteSemaine(null), null);
});

test("jourParDefaut : aujourd'hui s'il est dans la semaine, sinon lundi", () => {
  const g = semaineEnGrille({ entries: [], metas: [], joursOff: [], lundi: LUNDI, moi: null, noms: noms(), aujourdhui: "2026-10-29" });
  assert.equal(jourParDefaut(g, "2026-10-29"), 3);
  assert.equal(jourParDefaut(g, "2026-11-04"), 0);
  assert.equal(jourParDefaut(g, "2026-10-31"), 0);
});

test("lundiEnCours : en semaine, le lundi de la semaine", () => {
  assert.equal(lundiEnCours("2026-10-27"), "2026-10-26");
  assert.equal(lundiEnCours("2026-10-26"), "2026-10-26");
  assert.equal(lundiEnCours("2026-10-30"), "2026-10-26");
});

test("lundiEnCours : le week-end, le lundi suivant", () => {
  assert.equal(lundiEnCours("2026-10-31"), "2026-11-02");
  assert.equal(lundiEnCours("2026-11-01"), "2026-11-02");
});

test("lundiEnCours : changement d'heure (25 octobre 2026, 29 mars 2026)", () => {
  assert.equal(lundiEnCours("2026-10-25"), "2026-10-26");
  assert.equal(lundiEnCours("2026-10-24"), "2026-10-26");
  assert.equal(lundiEnCours("2026-03-29"), "2026-03-30");
  assert.equal(lundiEnCours(new Date(2026, 9, 25, 23, 30)), "2026-10-26");
  assert.equal(lundiEnCours(new Date(2026, 2, 28, 1, 30)), "2026-03-30");
  assert.equal(lundiEnCours(new Date(2026, 9, 28, 0, 15)), "2026-10-26");
});

test("planning-roles : les fonctions déplacées gardent leur comportement", () => {
  assert.equal(effPedagogueId({ activite: "Cours", pedagogue_id: 2 }), null);
  assert.equal(entryHasContent({ activite: "", prof_ids: [], notes: " " }), false);
  assert.equal(!!entryHasContent({ activite: "Cours" }), true);
});

test("vuePlanningInitiale : la grille, sauf une liste mémorisée sur l'appareil", () => {
  assert.equal(vuePlanningInitiale(null), "grille");
  assert.equal(vuePlanningInitiale(undefined), "grille");
  assert.equal(vuePlanningInitiale(""), "grille");
  assert.equal(vuePlanningInitiale("liste"), "liste");
  assert.equal(vuePlanningInitiale("grille"), "grille");
  assert.equal(vuePlanningInitiale("Liste"), "grille");
  assert.equal(vuePlanningInitiale("tableau"), "grille");
});
