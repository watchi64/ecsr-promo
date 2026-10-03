// Onglet CCP2 (chantier D) : dates du parcours, espaces insécables et intégrité du
// texte du parcours. Lancer depuis la racine du dépôt :
// node tests/ccp-rules.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TYPES_DATES_CCP2, datesCcp2, insecables } from "../js/ccp-rules.js";
import { EPREUVE, ETAPES } from "../js/ccp2-parcours-data.js";
import { MODULES, MODULE_DE_ROUTE, ROUTES_SOCLE } from "../js/modules-data.js";
import { STORAGE_SOUS_ONGLET } from "../js/nouveautes.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Dates du parcours CCP2
eq(TYPES_DATES_CCP2, ["formation", "stage", "examen"], "types repris du Calendrier");
const EV = [
  { id: 1, type: "formation", title: "Formation CCP1", date_start: "2026-03-30", date_end: "2026-09-21" },
  { id: 6, type: "stage", title: "Stage entreprise CCP2 01", date_start: "2026-10-12", date_end: "2026-10-16" },
  { id: 9, type: "examen", title: "Examens CCP2", date_start: "2026-12-08", date_end: "2026-12-11" },
  { id: 5, type: "formation", title: "Formation ccp 2", date_start: "2026-09-28", date_end: "2026-12-07" },
  { id: 11, type: "autre", title: "Réunion CCP2", date_start: "2026-10-01" },
  { id: 12, type: "stage", title: "Stage CCP20", date_start: "2026-10-01" },
  { id: 13, type: "examen", title: "Examen", date_start: "2026-12-01" },
  { id: 14, type: "stage", title: "Stage CCP2 sans date" },
];
const d = datesCcp2(EV, "2026-10-14");
eq(d.map((e) => e.id), [5, 6, 9], "CCP2 seulement, types retenus, triés par date de début");
eq(d.map((e) => e.passe), [false, false, false], "rien n'est passé le 14/10");
eq(datesCcp2(EV, "2026-10-17").find((e) => e.id === 6).passe, true, "stage fini la veille : passé");
eq(datesCcp2(EV, "2026-10-16").find((e) => e.id === 6).passe, false, "dernier jour du stage : pas encore passé");
eq(datesCcp2([{ id: 2, type: "examen", title: "Examens CCP2", date_start: "2026-12-08" }], "2026-12-09")[0].passe,
   true, "sans date de fin, la date de début fait foi");
eq(datesCcp2(null, "2026-10-14"), [], "liste absente");
ok(!("passe" in EV[1]), "les événements d'origine ne sont pas modifiés");

// 2. Espaces insécables
const NB = String.fromCharCode(0xa0);
eq(insecables("de 40 000 à 45 000 caractères"), `de 40${NB}000${NB}à 45${NB}000${NB}caractères`,
   "milliers, et nombre lié au mot qui le suit");
eq(insecables("1 h 30 devant le jury"), `1${NB}h${NB}30${NB}devant le jury`, "durée en heures");
eq(insecables("(30 minutes, sans interruption)"), `(30${NB}minutes, sans interruption)`, "nombre et unité");
eq(insecables("Étape 8 : le jour"), "Étape 8 : le jour", "chiffre suivi d'un signe : rien à changer");
eq(insecables("2026 12 10"), `2026 12 10`, "groupes qui ne sont pas des milliers : rien à changer");
eq(insecables("les 57 thèmes"), `les 57${NB}thèmes`, "nombre suivi d'un mot");
eq(insecables("sans nombre"), "sans nombre", "texte sans nombre inchangé");

// 3. Texte du parcours
eq(ETAPES.length, 8, "8 étapes");
eq(ETAPES.map((e) => e.num), [1, 2, 3, 4, 5, 6, 7, 8], "numérotées de 1 à 8, dans l'ordre");
eq(ETAPES.map((e) => e.cle),
   ["commanditaire", "demande", "construire", "animer", "analyser", "dossier", "oral", "epreuve"],
   "clés stables");
const CADRATIN = String.fromCharCode(0x2014);
const textes = [];
function verifierLien(l, ou) {
  ok(typeof l.label === "string" && l.label.length > 0, ou + " : libellé");
  textes.push(l.label);
  if (l.href) {
    ok(/^(https:\/\/|assets\/)/.test(l.href), ou + " : site sécurisé ou fichier de l'app");
    if (l.href.startsWith("assets/")) {
      ok(existsSync(fileURLToPath(new URL("../" + l.href, import.meta.url))), ou + " : fichier présent");
    }
    return;
  }
  ok(l.route in MODULE_DE_ROUTE || ROUTES_SOCLE.includes(l.route), ou + " : route connue");
  if (l.sousOnglet) ok(l.route in STORAGE_SOUS_ONGLET, ou + " : sous-onglet joignable");
  if (l.module) ok(MODULES.some((m) => m.cle === l.module), ou + " : module connu");
}
const liste = (v, min) => Array.isArray(v) && v.length >= min && v.every((t) => typeof t === "string" && t.length > 0);
for (const e of ETAPES) {
  ok(typeof e.titre === "string" && e.titre.length > 0, e.cle + " : titre");
  ok(typeof e.enBref === "string" && e.enBref.length > 0, e.cle + " : en bref");
  ok(e.titreAttendus === undefined || (typeof e.titreAttendus === "string" && e.titreAttendus.length > 0),
     e.cle + " : titre des attendus");
  ok(liste(e.attendus, 3), e.cle + " : au moins 3 attendus");
  ok(liste(e.conseils, 3), e.cle + " : au moins 3 conseils");
  ok(e.aGarder === undefined || liste(e.aGarder, 1), e.cle + " : à garder");
  ok(typeof e.source === "string" && e.source.length > 0, e.cle + " : source");
  (e.liens || []).forEach((l, i) => verifierLien(l, e.cle + ", lien " + (i + 1)));
  textes.push(e.titre, e.enBref, e.source, e.titreAttendus || "", ...e.attendus, ...e.conseils, ...(e.aGarder || []));
}
ok(typeof EPREUVE.titre === "string" && EPREUVE.titre.length > 0, "épreuve : titre");
ok(liste(EPREUVE.points, 3), "épreuve : au moins 3 points");
EPREUVE.liens.forEach((l, i) => verifierLien(l, "épreuve, lien " + (i + 1)));
textes.push(EPREUVE.titre, ...EPREUVE.points);
for (const t of textes) {
  ok(!t.includes(CADRATIN), "sans tiret cadratin : " + t.slice(0, 50));
  ok(!/\bprofs?\b/i.test(t), "« formateur », jamais « prof » : " + t.slice(0, 50));
}

console.log(`ccp-rules : ${n} assertions OK`);
