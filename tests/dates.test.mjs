// Les dates de l'app, une seule source (js/dates.js) : ce que les quatre copies d'avant faisaient, réuni ici
// (tests venus de effacement-rules, attestations-rules, modules, qualiopi-page-rules et questionnaires-gestion-rules).
import test from "node:test";
import assert from "node:assert/strict";
import { deuxChiffres, dateFr, dateLongue, dateHeure, jourParis, jourDe, dayIndexDe, lundiDe } from "../js/dates.js";
import { getMonday, isoDate, shuffle } from "../js/utils.js";

test("deux chiffres : heures, minutes, jours et mois", () => {
  assert.equal(deuxChiffres(7), "07");
  assert.equal(deuxChiffres(0), "00");
  assert.equal(deuxChiffres(42), "42");
});

test("date en chiffres : JJ/MM/AAAA, null quand le jour n'existe pas", () => {
  assert.equal(dateFr("2026-10-12"), "12/10/2026");
  assert.equal(dateFr("2027-12-11"), "11/12/2027");
  assert.equal(dateFr("2026-02-11T09:30:00+00:00"), "11/02/2026", "un horodatage compte par son jour");
  assert.equal(dateFr(null), null);
  assert.equal(dateFr(undefined), null);
  assert.equal(dateFr(""), null);
  assert.equal(dateFr("demain"), null);
  assert.equal(dateFr("2026-13-01"), null, "mois impossible");
  assert.equal(dateFr("2026-02-30"), null, "jour impossible");
  assert.equal(dateFr(20261101), null, "un nombre n'est pas une date");
});

test("date en toutes lettres : « 1er » le premier du mois, chaîne vide quand le jour n'existe pas", () => {
  assert.equal(dateLongue("2026-11-01"), "1er novembre 2026");
  assert.equal(dateLongue("2026-08-01"), "1er août 2026");
  assert.equal(dateLongue("2027-03-01"), "1er mars 2027");
  assert.equal(dateLongue("2026-10-28"), "28 octobre 2026");
  assert.equal(dateLongue("2027-12-11"), "11 décembre 2027");
  assert.equal(dateLongue("2026-12-02"), "2 décembre 2026", "pas de zéro devant le jour");
  assert.equal(dateLongue("2026-03-31"), "31 mars 2026");
  assert.equal(dateLongue("2026-02-11T09:30:00+00:00"), "11 février 2026", "un horodatage compte par son jour");
  assert.equal(dateLongue("demain"), "");
  assert.equal(dateLongue("2026-13-01"), "", "mois impossible");
  assert.equal(dateLongue(null), "");
  assert.equal(dateLongue(undefined), "");
  assert.equal(dateLongue(20261101), "", "un nombre n'est pas une date");
});

test("date et heure de l'appareil : « 28/10/2026 à 10 h 42 »", () => {
  assert.equal(dateHeure(new Date(2026, 9, 28, 10, 42)), "28/10/2026 à 10 h 42");
  assert.equal(dateHeure(new Date(2026, 0, 5, 9, 4)), "05/01/2026 à 9 h 04", "l'heure sans zéro, les minutes avec");
  const local = new Date(2026, 9, 28, 10, 42).toISOString();
  assert.equal(dateHeure(local), "28/10/2026 à 10 h 42", "un horodatage se lit en heure de l'appareil");
  assert.equal(dateHeure("pas une date"), "");
});

test("jour de Paris : celui de la base (_questionnaire_jour), pas celui de l'appareil", () => {
  assert.equal(jourParis("2026-10-11T22:30:00.000Z"), "2026-10-12", "00 h 30 à Paris, heure d'été");
  assert.equal(jourParis("2026-12-31T23:30:00.000Z"), "2027-01-01", "00 h 30 à Paris, heure d'hiver");
  assert.equal(jourParis("2026-10-12T13:30:00.000Z"), "2026-10-12", "journée");
  assert.equal(jourParis(new Date("2026-12-03T23:30:00Z")), "2026-12-04", "00 h 30 à Paris : déjà le 4");
  assert.equal(jourParis(new Date("2026-12-03T22:59:59Z")), "2026-12-03", "23 h 59 à Paris : encore le 3");
  assert.equal(jourParis(new Date("2026-07-14T22:30:00Z")), "2026-07-15");
  assert.equal(jourParis(new Date("2026-07-14T21:59:00Z")), "2026-07-14");
  // Changements d'heure : 29/03/2026 (passage à l'été) et 25/10/2026 (retour à l'hiver).
  assert.equal(jourParis(new Date("2026-03-28T22:59:00Z")), "2026-03-28", "veille du passage à l'heure d'été, 23 h 59 à Paris");
  assert.equal(jourParis(new Date("2026-03-28T23:00:00Z")), "2026-03-29", "minuit à Paris (UTC+1)");
  assert.equal(jourParis(new Date("2026-03-29T21:59:00Z")), "2026-03-29", "soir du passage, 23 h 59 à Paris (UTC+2)");
  assert.equal(jourParis(new Date("2026-03-29T22:00:00Z")), "2026-03-30");
  assert.equal(jourParis(new Date("2026-10-24T22:00:00Z")), "2026-10-25", "minuit à Paris (UTC+2) la nuit du retour");
  assert.equal(jourParis(new Date("2026-10-25T22:59:00Z")), "2026-10-25", "23 h 59 à Paris (UTC+1) après le retour");
  assert.equal(jourParis(new Date("2026-10-25T23:00:00Z")), "2026-10-26");
  assert.equal(jourParis(Date.UTC(2026, 11, 3, 23, 30)), "2026-12-04", "un nombre de millisecondes est accepté");
  assert.equal(jourParis("pas une date"), null);
  assert.equal(jourParis(new Date("pas une date")), null);
});

test("calcul sur les jours : décalage, rang dans la semaine, lundi", () => {
  assert.equal(jourDe("2026-11-09", 3), "2026-11-12");
  assert.equal(jourDe("2026-03-01", -1), "2026-02-28");
  assert.equal(jourDe("2026-10-24", 1), "2026-10-25", "le changement d'heure ne décale rien");
  assert.equal(dayIndexDe("2026-11-09"), 0, "lundi");
  assert.equal(dayIndexDe("2026-11-15"), 6, "dimanche");
  assert.equal(lundiDe("2026-11-11"), "2026-11-09");
  assert.equal(lundiDe("2026-11-09"), "2026-11-09", "un lundi est son propre lundi");
  assert.equal(lundiDe("2026-11-15"), "2026-11-09", "le dimanche appartient à la semaine qui finit");
  assert.equal(lundiDe("2027-01-01"), "2026-12-28", "la semaine traverse l'année");
});

test("getMonday (une Date) suit lundiDe : minuit local, jour par jour sur deux ans", () => {
  const depart = new Date(2026, 0, 1, 15, 30);
  for (let i = 0; i < 730; i++) {
    const d = new Date(depart.getFullYear(), depart.getMonth(), depart.getDate() + i, 15, 30);
    const lundi = getMonday(d);
    assert.equal(isoDate(lundi), lundiDe(isoDate(d)));
    assert.equal(lundi.getDay(), 1);
    assert.equal(lundi.getHours(), 0);
    assert.equal(lundi.getMinutes(), 0);
  }
  assert.equal(isoDate(getMonday("2026-11-11T12:00:00")), "2026-11-09", "une chaîne est lue comme avant (new Date)");
  assert.ok(Number.isNaN(getMonday("pas une date").getTime()), "une date illisible reste illisible");
});

test("shuffle : une copie mélangée, la liste de départ intacte", () => {
  const liste = [1, 2, 3, 4, 5, 6, 7, 8];
  const melange = shuffle(liste);
  assert.deepEqual(liste, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notEqual(melange, liste);
  assert.deepEqual([...melange].sort((a, b) => a - b), liste);
  assert.deepEqual(shuffle([]), []);
});

test("une seule source : aucune autre définition de ces fonctions dans js/", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const fichiers = [];
  const parcourir = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (nom.endsWith(".js")) fichiers.push(chemin);
    }
  };
  parcourir(new URL("../js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const noms = ["deuxChiffres", "dateFr", "dateLongue", "dateHeure", "dateCourte", "jourParis", "lundiDe", "dayIndexDe",
    "shuffle", "pluriel", "entier", "pct", "fr1"];
  const definitions = new Map(noms.map((n) => [n, []]));
  for (const f of fichiers) {
    const texte = readFileSync(f, "utf8");
    for (const n of noms) {
      const re = new RegExp(`(?:function\\s+${n}\\s*\\(|(?:const|let|var)\\s+${n}\\s*=\\s*(?:\\(|function|[a-z_]+\\s*=>))`);
      if (re.test(texte)) definitions.get(n).push(f.replace(/\\/g, "/").replace(/^.*\/js\//, "js/"));
    }
  }
  const attendu = {
    deuxChiffres: ["js/dates.js"], dateFr: ["js/dates.js"], dateLongue: ["js/dates.js"], dateHeure: ["js/dates.js"],
    dateCourte: ["js/signalement.js"], jourParis: ["js/dates.js"], lundiDe: ["js/dates.js"], dayIndexDe: ["js/dates.js"],
    shuffle: ["js/utils.js"], pluriel: ["js/nombres.js"], entier: ["js/nombres.js"],
    pct: ["js/nombres.js"], fr1: ["js/nombres.js"],
  };
  for (const n of noms) assert.deepEqual(definitions.get(n).sort(), attendu[n].sort(), n);
});
