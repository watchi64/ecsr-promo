// Titres, relecture finale (16/11) : corrections I1, I2, I3 et mineurs.
// Lancer : node --test tests/titres-relecture-finale.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { retraitDuSiegeOffert, boutonVerrouOffert, PHRASE_JOURNAL_ABSENT, selonLaCase, caseDe, casesDeLEspace } from "../js/titres-rules.js";

const lire = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

// ---- I1 : « Ouvrir les titres à la carte » seulement avec le journal ----
test("I1 : Ouvrir exige le journal ; Fermer reste toujours offert", () => {
  assert.equal(boutonVerrouOffert({ ouvert: false, journalPresent: false }), false);
  assert.equal(boutonVerrouOffert({ ouvert: false, journalPresent: true }), true);
  assert.equal(boutonVerrouOffert({ ouvert: true, journalPresent: false }), true, "Fermer reste offert");
  assert.equal(boutonVerrouOffert({ ouvert: true, journalPresent: true }), true);
  assert.equal(boutonVerrouOffert({}), false);
  assert.match(PHRASE_JOURNAL_ABSENT, /journal des droits n'est pas encore en place/);
});
test("I1 : la section des Réglages lit journal_present et dit pourquoi", () => {
  const src = lire("js/views/config.js");
  const corps = src.slice(src.indexOf("async function renderTitresCarteSection"), src.indexOf("async function renderAccessSection"));
  assert.ok(/lireJournalPresent\(\)/.test(corps));
  assert.ok(/boutonVerrouOffert\(\{ ouvert, journalPresent \}\)/.test(corps));
  assert.ok(corps.indexOf("PHRASE_JOURNAL_ABSENT") < corps.indexOf('"Ouvrir les titres à la carte"'), "la phrase passe avant le bouton");
});

// ---- I2 : la page Directions de centre du siège suit ce que la base accepterait ----
const siegeFixe = { email: "s@exemple.invalid", niveau: "reseau", fixe: true };
test("I2 : Retirer sur un titre fixe Siège : au fondateur seul, jamais sur soi", () => {
  assert.equal(retraitDuSiegeOffert({ peutGerer: true, fondateur: false, personne: siegeFixe, moi: "autre@exemple.invalid" }), false);
  assert.equal(retraitDuSiegeOffert({ peutGerer: true, fondateur: true, personne: siegeFixe, moi: "f@exemple.invalid" }), true);
  assert.equal(retraitDuSiegeOffert({ peutGerer: true, fondateur: false, personne: { ...siegeFixe, fixe: false }, moi: "S@exemple.invalid" }), false, "sur soi, sans tenir compte de la casse");
  assert.equal(retraitDuSiegeOffert({ peutGerer: true, fondateur: true, personne: siegeFixe, moi: "S@exemple.invalid" }), true, "R2 : le fondateur hors aperçu se retire lui-même (la base l'en exempte)");
});
test("I2 : Retirer exige la case Directions sur Modifier ; un titre du réseau non fixe se retire", () => {
  const centre = { email: "d@exemple.invalid", niveau: "centre", fixe: true };
  const reseau = { email: "r@exemple.invalid", niveau: "reseau", fixe: false };
  assert.equal(retraitDuSiegeOffert({ peutGerer: false, personne: centre, moi: "" }), false);
  assert.equal(retraitDuSiegeOffert({ peutGerer: true, personne: centre, moi: "x@exemple.invalid" }), true);
  assert.equal(retraitDuSiegeOffert({ peutGerer: true, personne: reseau, moi: "x@exemple.invalid" }), true);
  assert.equal(retraitDuSiegeOffert({ peutGerer: true, personne: null }), false);
});
test("I2 : « Directions : Voir » ferme les gestes (cases lues), titres non lus : comme avant", () => {
  const titreVoir = { titre_id: 9, nom: "Observateur", niveau: "reseau", lieu_id: null, promo_ids: [], cases: { cours: 1, directions: 1, reglages: 0 } };
  const titreModifier = { ...titreVoir, cases: { cours: 1, directions: 2, reglages: 0 } };
  const gere = (titre) => {
    const cases = casesDeLEspace({ espace: "siege", titres: [titre] });
    return selonLaCase({ cases, droit: caseDe(cases, "directions", "reseau") === 2, ancien: true });
  };
  assert.equal(gere(titreVoir), false);
  assert.equal(gere(titreModifier), true);
  assert.equal(selonLaCase({ cases: null, droit: false, ancien: true }), true, "titres non lus : comportement d'aujourd'hui");
});
test("I2 : chaque geste d'écriture de la page est derrière peutGerer", () => {
  const src = sansCommentaires(lire("js/views/siege-directions.js"));
  assert.ok(/const peutGererLaPage = \(\) => ecritSelonLaCase\("directions", true, \["siege"\]\)/.test(src));
  assert.ok(!/peutModifier\(/.test(src), "plus d'appel direct qui ignore les titres non lus");
  for (const motif of [
    /peutGerer && t\.niveau === "reseau" && t\.donnable/,
    /peutGerer && droits\.ajuster/, /peutGerer && droits\.supprimer/,
    /centres\.length && peutGerer/,
    /peutGerer\s*\?\s*el\("button", \{ class: centres\.length \? "btn" : "btn primary"/,
  ]) assert.ok(motif.test(src), String(motif));
  assert.equal((src.match(/retraitDuSiegeOffert\(\{/g) || []).length, 2, "les deux Retirer");
  assert.ok(/droits\.creer && \(t\.niveau === "reseau" \|\| siegeFixe\)/.test(src) && /creer: peutGerer === true/.test(lire("js/titres-rules.js")),
    "Créer : la case Directions est déjà exigée par gestesSurTitre");
});
test("I2 : le guide dit la même chose que l'écran", () => {
  const aide = lire("supabase/functions/chatbot/aide.mjs");
  assert.ok(aide.includes("sur un titre fixe Siège n'est offert qu'au fondateur, jamais sur soi"));
  assert.ok(aide.includes("ne s'affichent que si la case Directions de centre est sur « Modifier »"));
});

// ---- I3 : la rédaction des cours suit la case « Cours et QCM » ----
test("I3 : isRedacteur suit la case Cours et QCM (équipe et siège), l'ancien prédicat sinon", () => {
  const src = sansCommentaires(lire("js/auth-admin.js"));
  // Cloisonnement (étape 3) : la case décide toujours, et l'organisme affiché doit de plus rédiger les contenus (ecritLesContenus).
  assert.ok(/export function isRedacteur\(\) \{\s*const ancien = peutRedigerContenus\([^;]*;\s*return ecritSelonLaCase\("cours", ancien, \["equipe", "siege"\]\) && ecritLesContenus\(\);/.test(src));
  const ecrit = (espace, niveau, titre, ancien) => {
    const cases = casesDeLEspace({ espace, titres: [titre], promoId: 1 });
    return selonLaCase({ cases, droit: caseDe(cases, "cours", niveau) === 2, ancien });
  };
  const reseauVoir = { niveau: "reseau", cases: { cours: 1, directions: 1, reglages: 0 } };
  const promoModifier = { niveau: "promo", promo_ids: [1], cases: { cours: 2 } };
  const promoVoir = { niveau: "promo", promo_ids: [1], cases: { cours: 1 } };
  assert.equal(ecrit("siege", "reseau", reseauVoir, true), false, "(a) réseau non fixe sur Voir : plus de bouton");
  assert.equal(ecrit("equipe", "promo", promoModifier, false), true, "(b) Intervenant ajusté sur Modifier : rédige");
  assert.equal(ecrit("equipe", "promo", promoVoir, false), false);
  assert.equal(selonLaCase({ cases: null, droit: true, ancien: false }), false, "cases non lues : jamais un gain");
});

// ---- Mineurs ----
test("M3 : aucune adresse en @x.fr dans le test des rôles", () => {
  assert.ok(!lire("tests/roles-rules.test.mjs").includes("@x.fr"));
});
test("M4 : le guide ne dit plus qu'une personne ne se retire pas elle-même", () => {
  const aide = lire("supabase/functions/chatbot/aide.mjs");
  assert.ok(!aide.includes("ne se retire pas elle-même"));
  assert.ok(aide.includes("seule la direction de centre peut retirer son propre titre Formateur"));
});
test("M5 : les liens vers une page que le titre peut fermer sont gardés", () => {
  assert.ok(/peutModifier\("promos"\) \? el\("a", \{ class: "btn primary", href: "#\/promos" \}/.test(lire("js/views/direction-equipe.js")));
  assert.ok(/litSelonLaCase\("indicateurs", true\) \? plusLien\("centre", "Tout voir"\) : null/.test(lire("js/views/aujourdhui.js")));
});
test("M6 : plus de garde sans effet dans autonomie-etat.js", () => {
  const src = lire("js/autonomie-etat.js");
  assert.ok(!src.includes("litSelonLaCase"));
  assert.ok(src.includes("equipe: isEquipe()"));
});
test("M2 : reglerAffectationsFormateur n'est plus exportée (aucun appelant)", () => {
  for (const f of ["js/db.js", "js/views/direction-equipe.js"]) assert.ok(!sansCommentaires(lire(f)).includes("reglerAffectationsFormateur"), f);
});
test("aucun tiret cadratin dans les fichiers touchés", () => {
  for (const f of ["js/titres-rules.js", "js/auth-admin.js", "js/views/config.js", "js/views/siege-directions.js", "js/views/direction-equipe.js",
    "js/views/aujourdhui.js", "js/autonomie-etat.js", "js/db.js", "supabase/functions/chatbot/aide.mjs", "tests/titres-relecture-finale.test.mjs"]) {
    assert.ok(!lire(f).includes(String.fromCharCode(0x2014)), f);
  }
});

// ---- Derniers restes (re-relecture) ----
test("R1 : le sous-onglet QCM du siège ne mène à l'éditeur que si isRedacteur()", () => {
  const src = lire("js/views/themes.js");
  assert.ok(/renderQcmStagiaire\(p, sans && isRedacteur\(\)\s*\?\s*\{ themes, onOuvrir: \(theme, qcm, relire\) => openQcmEditor/.test(src));
});
test("R3 : titres fixes (Formateur fixe, Siège fixe) aux cases du plafond : isRedacteur et gestes valent l'ancien appel", () => {
  const formateurFixe = { niveau: "promo", promo_ids: [1], fixe: true, cases: { planning: 2, emargement: 2, stagiaires: 2, notes: 2, cours: 2, ccp2: 1, indicateurs: 1, reglages: 2 } };
  const siegeFixeTitre = { niveau: "reseau", fixe: true, cases: { cours: 2, directions: 2, reglages: 2 } };
  const ecrit = (espace, niveau, titre, page, ancien) => {
    const cases = casesDeLEspace({ espace, titres: [titre], promoId: 1 });
    return selonLaCase({ cases, droit: caseDe(cases, page, niveau) === 2, ancien });
  };
  // Formateur fixe : l'ancien isRedacteur (admin) vrai donne vrai ; la case ne retire rien.
  assert.equal(ecrit("equipe", "promo", formateurFixe, "cours", true), true);
  // Siège fixe : l'ancien appel (toujours vrai) et la case (Modifier au plafond) s'accordent, pour la rédaction et les gestes.
  assert.equal(ecrit("siege", "reseau", siegeFixeTitre, "cours", true), true);
  assert.equal(ecrit("siege", "reseau", siegeFixeTitre, "directions", true), true);
  const cases = casesDeLEspace({ espace: "siege", titres: [siegeFixeTitre] });
  for (const page of ["cours", "directions", "reglages"]) assert.equal(caseDe(cases, page, "reseau"), 2, page);
});
