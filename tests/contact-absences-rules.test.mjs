// Règles pures de l'écran « Prévenir d'une absence » (tâche 15). Lancer : node tests/contact-absences-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demiJourneesDe, premarquage, phraseCasesDecochees, mailtoJustificatif, libelleAbsence, phraseAbsence, adresseJustificatif, verifierAbsence, libelleDesJours, marqueAbsence,
} from "../js/contact-absences-rules.js";

test("demiJourneesDe : une journée du jeudi 19 au lundi 23 novembre 2026 compte 6 demi-journées (week-end exclu)", () => {
  const l = demiJourneesDe({ du: "2026-11-19", au: "2026-11-23", quand: "journee" });
  assert.deepEqual(l.map((x) => `${x.jour} ${x.demi}`), [
    "2026-11-19 matin", "2026-11-19 aprem", "2026-11-20 matin", "2026-11-20 aprem", "2026-11-23 matin", "2026-11-23 aprem"]);
  assert.ok(l.every((x) => x.entiere === true && x.debut === null && x.fin === null));
});

test("demiJourneesDe : matin, après-midi, un seul jour, week-end seul", () => {
  assert.deepEqual(demiJourneesDe({ du: "2026-11-19", quand: "matin" }).map((x) => x.demi), ["matin"]);
  assert.deepEqual(demiJourneesDe({ du: "2026-11-19", au: "2026-11-19", quand: "aprem" }).map((x) => x.demi), ["aprem"]);
  assert.deepEqual(demiJourneesDe({ du: "2026-11-21", au: "2026-11-22", quand: "journee" }), []);
  assert.deepEqual(demiJourneesDe({ du: null, quand: "journee" }), []);
});

test("demiJourneesDe : des heures tiennent dans la demi-journée de l'heure de début", () => {
  const matin = demiJourneesDe({ du: "2026-11-19", au: "2026-11-23", quand: "heures", debut: "10:00", fin: "11:00" });
  assert.deepEqual(matin, [{ jour: "2026-11-19", demi: "matin", entiere: false, debut: "10:00", fin: "11:00" }]);
  assert.equal(demiJourneesDe({ du: "2026-11-19", quand: "heures", debut: "13:30", fin: "15:00" })[0].demi, "aprem");
  assert.equal(demiJourneesDe({ du: "2026-11-19", quand: "heures", debut: "13:29", fin: "15:00" })[0].demi, "matin");
  assert.equal(demiJourneesDe({ du: "2026-11-19", quand: "heures", debut: "14:00", fin: "15:00", debutAprem: "14:30" })[0].demi, "matin");
});

test("premarquage : absent pour la journée et les demi-journées, observation pour des heures", () => {
  for (const quand of ["journee", "matin", "aprem"]) assert.equal(premarquage({ quand }), "absent", quand);
  assert.equal(premarquage({ quand: "heures" }), "observation");
});

test("libelleAbsence : les trois formes et leurs variantes", () => {
  assert.equal(libelleAbsence({ du: "2026-11-19", au: "2026-11-19", quand: "matin" }), "jeudi 19 novembre, matin");
  assert.equal(libelleAbsence({ du: "2026-11-19", quand: "aprem" }), "jeudi 19 novembre, après-midi");
  assert.equal(libelleAbsence({ du: "2026-11-19", quand: "journee" }), "jeudi 19 novembre, journée");
  assert.equal(libelleAbsence({ du: "2026-11-19", au: "2026-11-23", quand: "journee" }), "du 19 au 23 novembre");
  assert.equal(libelleAbsence({ du: "2026-11-19", quand: "heures", debut: "10:00", fin: "11:00" }), "jeudi 19 novembre, de 10 h à 11 h");
  assert.equal(libelleAbsence({ du: "2026-11-19", quand: "heures", debut: "10:30", fin: "11:45" }), "jeudi 19 novembre, de 10 h 30 à 11 h 45");
  assert.equal(libelleAbsence({ du: "2026-11-28", au: "2026-12-02", quand: "journee" }), "du 28 novembre au 2 décembre");
  assert.equal(libelleAbsence({ du: "2026-12-01", quand: "matin" }), "mardi 1er décembre, matin");
  assert.equal(libelleAbsence({ du: "2026-11-19", au: "2026-11-23", quand: "matin" }), "du 19 au 23 novembre, matins");
});

test("phraseAbsence : « absence du ... » sans doubler le « du »", () => {
  assert.equal(phraseAbsence({ du: "2026-11-19", quand: "matin" }), "absence du jeudi 19 novembre, matin");
  assert.equal(phraseAbsence({ du: "2026-11-19", au: "2026-11-23", quand: "journee" }), "absence du 19 au 23 novembre");
});

test("mailtoJustificatif : objet encodé, deux lignes de corps, nul sans adresse", () => {
  const m = mailtoJustificatif({ email: "secretariat@exemple.invalid", du: "2026-12-03", quand: "matin" });
  assert.match(m, /^mailto:secretariat@exemple\.invalid\?subject=/);
  assert.ok(m.includes("subject=Justificatif%20%3A%20absence%20du%20jeudi%203%20d%C3%A9cembre%2C%20matin"), m);
  const corps = decodeURIComponent(m.split("&body=")[1]);
  assert.equal(corps.split("\r\n").length, 2);
  assert.ok(corps.includes("absence du jeudi 3 décembre, matin"));
  assert.equal(mailtoJustificatif({ email: null, du: "2026-11-19", quand: "matin" }), null);
  assert.equal(mailtoJustificatif({ email: "  ", du: "2026-11-19", quand: "matin" }), null);
  assert.equal(mailtoJustificatif({ email: "a b@exemple.invalid", du: "2026-11-19", quand: "matin" }), null);
  const objet = mailtoJustificatif({ email: "x@exemple.invalid", du: "2026-11-19", quand: "matin" }).split("&body=")[0].split("subject=")[1];
  assert.equal(decodeURIComponent(objet), "Justificatif : absence du jeudi 19 novembre, matin");
});

test("adresseJustificatif : le premier destinataire principal qui a une adresse", () => {
  const d = [
    { nom: "A", principal: false, email: "copie@exemple.invalid" },
    { nom: "B", principal: true, email: null },
    { nom: "C", principal: true, email: "c@exemple.invalid" },
    { nom: "D", principal: true, email: "d@exemple.invalid" },
  ];
  assert.equal(adresseJustificatif(d), "c@exemple.invalid");
  assert.equal(adresseJustificatif([{ principal: true, email: null }]), null);
  assert.equal(adresseJustificatif(null), null);
});

test("phraseCasesDecochees", () => {
  assert.equal(phraseCasesDecochees([]), null);
  assert.equal(phraseCasesDecochees(null), null);
  assert.equal(phraseCasesDecochees(["delegue"]), "Ils ne seront pas prévenus, mais l'absence apparaîtra au planning.");
});

test("verifierAbsence : les mêmes phrases que la base, dans le même ordre", () => {
  const ok = { du: "2026-11-19", au: "2026-11-19", quand: "matin", motif: "sante", mot: "", aujourdhui: "2026-11-18" };
  const HEURES = "Indique l'heure de début et l'heure de fin (par exemple 10:00 et 11:00), le début avant la fin.";
  assert.equal(verifierAbsence(ok), null);
  assert.equal(verifierAbsence({ ...ok, du: null }), "Choisis le jour de ton absence.");
  assert.equal(verifierAbsence({ ...ok, du: "2026-11-17", au: "2026-11-17" }), "Une absence passée se règle avec l'équipe.");
  assert.equal(verifierAbsence({ ...ok, au: "2026-11-18" }), "Le dernier jour de ton absence précède le premier.");
  assert.equal(verifierAbsence({ ...ok, au: "2026-12-20" }), "Une absence annoncée couvre 31 jours au plus : au-delà, vois avec l'équipe.");
  assert.equal(verifierAbsence({ ...ok, au: "2026-12-19" }), null, "31 jours pile");
  assert.equal(verifierAbsence({ ...ok, quand: null }), "Choisis quand : la journée, le matin, l'après-midi ou de telle heure à telle heure.");
  assert.equal(verifierAbsence({ ...ok, quand: "heures", debut: "11:00", fin: "10:00" }), HEURES);
  assert.equal(verifierAbsence({ ...ok, quand: "heures", debut: "", fin: "10:00" }), HEURES);
  assert.equal(verifierAbsence({ ...ok, quand: "heures", debut: "10:00", fin: "11:00" }), null);
  assert.equal(verifierAbsence({ ...ok, motif: null }), "Choisis un motif : santé, transport, démarche, famille ou autre.");
  assert.equal(verifierAbsence({ ...ok, mot: "x".repeat(201) }), "Ton mot compte 200 caractères au plus.");
  assert.equal(verifierAbsence({ ...ok, mot: "x".repeat(200) }), null);
  assert.equal(verifierAbsence({ ...ok, du: "2026-11-21", au: "2026-11-22", aujourdhui: "2026-11-18" }),
    "Ces jours ne comptent aucune demi-journée de formation (ni le samedi ni le dimanche).");
});

test("libelleDesJours : l'absence dite d'après les jours d'une ligne de liste", () => {
  assert.equal(libelleDesJours([{ jour: "2026-11-19", demi: "matin" }]), "jeudi 19 novembre, matin");
  assert.equal(libelleDesJours([{ jour: "2026-11-19", demi: "aprem" }]), "jeudi 19 novembre, après-midi");
  assert.equal(libelleDesJours([{ jour: "2026-11-19", demi: "matin" }, { jour: "2026-11-19", demi: "aprem" }]), "jeudi 19 novembre, journée");
  assert.equal(libelleDesJours(demiJourneesDe({ du: "2026-11-19", au: "2026-11-23", quand: "journee" })), "du 19 au 23 novembre");
  assert.equal(libelleDesJours(demiJourneesDe({ du: "2026-11-19", au: "2026-11-23", quand: "matin" })), "du 19 au 23 novembre, matins");
  assert.equal(libelleDesJours(null), "");
  assert.equal(libelleDesJours([]), "");
});

test("marqueAbsence : l'équipe lit « absent, prévenu » ou la plage, le stagiaire « absent », jamais le motif", () => {
  const abs = [
    { stagiaire_id: 7, day_index: 3, half_day: "matin", entiere: true, debut: null, fin: null },
    { stagiaire_id: 8, day_index: 3, half_day: "matin", entiere: false, debut: "10:00", fin: "11:00" },
    { stagiaire_id: 9, day_index: 3, half_day: "matin", entiere: false, debut: "10:30", fin: "11:00" },
  ];
  const jeudi = { day_index: 3, half_day: "matin" };
  assert.equal(marqueAbsence(abs, jeudi, 7, "formateur"), "absent, prévenu");
  assert.equal(marqueAbsence(abs, jeudi, 8, "formateur"), "absent de 10 h à 11 h");
  assert.equal(marqueAbsence(abs, jeudi, 9, "direction"), "absent de 10 h 30 à 11 h");
  assert.equal(marqueAbsence(abs, jeudi, 7, "stagiaire"), "absent");
  assert.equal(marqueAbsence(abs, jeudi, 8, "stagiaire"), "absent");
  assert.equal(marqueAbsence(abs, { day_index: 3, half_day: "aprem" }, 7, "formateur"), null);
  assert.equal(marqueAbsence(abs, { day_index: 2, half_day: "matin" }, 7, "formateur"), null);
  const deux = [{ stagiaire_id: 5, day_index: 3, half_day: "matin", entiere: false, debut: "10:00", fin: "11:00" },
    { stagiaire_id: 5, day_index: 3, half_day: "matin", entiere: true, debut: null, fin: null }];
  assert.equal(marqueAbsence(deux, jeudi, 5, "formateur"), "absent, prévenu");
  assert.equal(marqueAbsence(abs, jeudi, 99, "formateur"), null);
  assert.equal(marqueAbsence(abs, jeudi, null, "formateur"), null);
  assert.equal(marqueAbsence(null, jeudi, 7, "formateur"), null);
  assert.equal(marqueAbsence([], jeudi, 7, "formateur"), null);
});
