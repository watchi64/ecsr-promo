// Finitions du 09/11 (audit par testeurs, lot E) : ce qui ne doit pas revenir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { heureEcrite, libelleHeure, libelleCreneau, heureLocale } from "../js/emargement-rules.js";

const lire = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

// Les espaces d'une heure sont insécables : une case étroite d'une feuille imprimée ne coupe jamais « 12 h / 30 ».
// nb("12 h 30") rend la même heure avec ses espaces insécables.
const nb = (t) => t.replace(/ h/g, " h").replace(/h (\d\d)/g, "h $1");

test("heures : une seule écriture française, « 9 h », « 12 h 30 », « 9 h 04 », espaces insécables", () => {
  assert.equal(heureEcrite("09", "00"), nb("9 h"));
  assert.equal(heureEcrite("12", "30"), nb("12 h 30"));
  assert.equal(heureEcrite("9", "4"), nb("9 h 04"));
  assert.equal(nb("12 h 30"), "12 h 30");
  assert.equal(libelleCreneau({ debut: "13:30", fin: "17:00" }), nb("13 h 30") + " à " + nb("17 h"));
  assert.equal(libelleHeure(""), "");
  assert.equal(heureLocale("2026-10-26T08:00:00Z"), nb("9 h"));
});

test("heures : les horaires par défaut d'une demi-journée s'écrivent pareil (Mon suivi)", async () => {
  const { HALF_DAYS } = await import("../js/config.js");
  assert.deepEqual(HALF_DAYS.map((h) => h.label), [nb("9 h") + " à " + nb("12 h 30"), nb("13 h 30") + " à " + nb("17 h")]);
  assert.match(lire("js/views/mon-suivi.js"), /return libelleCreneau\(\{ debut: fmtTime\(m\.start_time\)/);
});

test("heures : plus de « 9h00 » fabriqué à la main dans le planning ni d'espacement en double dans les pages", () => {
  const planning = lire("js/views/planning.js");
  assert.ok(!/replace\(":", "h"\)/.test(planning), "le planning écrit ses heures avec libelleHeure");
  for (const f of ["js/views/accueil-stagiaire.js", "js/views/aujourdhui.js"]) {
    assert.ok(!lire(f).includes("heureEspacee"), f + " : heureLocale rend déjà « 9 h 04 »");
  }
});

// Émojis en couleur au milieu des icônes au trait : les pages relevées par les testeurs et le lot 3.
// Pictogrammes en couleur, écrits en codes pour rester lisibles : U+2139 information, U+270F crayon, U+26A0 attention,
// U+274C croix, U+2B50 étoile, et tout le bloc des émojis (U+1F300 à U+1FAFF).
const EMOJIS = /[\u{1F300}-\u{1FAFF}ℹ✏⚠❌⭐]/u;
for (const f of ["js/views/planning.js", "js/views/ressources.js", "js/views/notes.js"]) {
  test(`émojis : ${f} n'en affiche plus (hors commentaires)`, () => {
    const lignes = lire(f).split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l) && EMOJIS.test(l));
    assert.deepEqual(lignes.map((l) => l.trim().slice(0, 90)), []);
  });
}

test("icônes : « À traiter » et « À faire » ne portent plus de coche, « Grille / Jour » plus la grille de « Plus »", () => {
  assert.match(lire("js/views/aujourdhui.js"), /titre: "À traiter", ico: "inbox"/);
  assert.match(lire("js/views/accueil-stagiaire.js"), /titre: "À faire", ico: "inbox"/);
  assert.match(lire("js/views/planning-grille.js"), /bouton\("grille", "columns"/);
  const icones = lire("js/icons.js");
  for (const n of ["pencil", "dices", "eraser", "inbox", "columns"]) assert.match(icones, new RegExp("^  " + n + ":", "m"));
});

test("états ouverts : verts partout (émargement, Examen ouvert), jour fermé sans gris pâle", () => {
  const em = lire("css/emargement.css");
  assert.match(em, /\.em-statut-ouverte \{ color: var\(--c-go\); \}/);
  assert.match(lire("css/pages.css"), /\.acc-ligne-puce-ok \{ background: var\(--c-go-soft\); color: var\(--c-go\); \}/);
  assert.match(lire("js/views/qcm-stagiaire.js"), /\{ texte: "Examen ouvert", ok: true \}/);
  const style = lire("css/style.css");
  assert.ok(!/\.p-daynav-btn\.off \{ color: var\(--text-faint\)/.test(style), "libellé d'un jour fermé à 2,3:1");
  assert.ok(!/\.p-day-card\.off \{ opacity/.test(style), "carte d'un jour fermé voilée");
});

test("doublons : « Cette semaine » absent quand « Aujourd'hui » est là ; un seul titre « Livret EPCF »", () => {
  // Lot B (audit du 09/11) : sous la nouvelle navigation, le retour au jour remplace « Cette semaine », hors de la semaine du jour.
  assert.match(lire("js/views/planning.js"), /eleve \|\| avecAujourdhui \? retourBtn : todayBtn/);
  const livret = lire("js/views/epcf-livret.js");
  assert.match(livret, /if \(!embedded\) toolbar\.appendChild\(el\("h3"/);
  assert.equal((livret.match(/embedded: opts\.embedded/g) || []).length, 2);
});

test("champs nommés : les filtres et dates relevés par le robot portent un nom", () => {
  const attendus = [
    ["js/views/themes.js", /"aria-label": "Rechercher un thème"/], ["js/views/themes.js", /"aria-label": "Filtrer par statut"/],
    ["js/views/notes.js", /"aria-label": "Trier la matrice"/], ["js/views/notes.js", /"aria-label": "Date des notes"/],
    ["js/views/signalements.js", /"aria-label": "Signalements à afficher"/],
    ["js/views/mon-suivi.js", /"aria-label": "Date de naissance"/],
    ["js/views/planning.js", /"aria-label": "Aller à la semaine d'une date"/],
  ];
  for (const [f, rx] of attendus) assert.match(lire(f), rx, f);
});
