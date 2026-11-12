import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stagiaireVitrine, VITRINES, sortEnVitrine, requeteDeDonnees, ficheEmpruntee, MESSAGE_VITRINE } from "../js/vitrine-rules.js";
import { profilEffectif } from "../js/promo-rules.js";
import { texteBandeauApercu } from "../js/espaces-rules.js";

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");
const VITRINE = { promoId: 7, apercu: "stagiaire", fondateur: true };
const REST = "/rest/v1/";

// --- Qui entre dans la vitrine -----------------------------------------------------------------------------------------

test("vitrine : le fondateur en aperçu Stagiaire dans la promo de démonstration voit Camille", () => {
  assert.equal(stagiaireVitrine(VITRINE), 1634);
});

test("vitrine : jamais hors de l'aperçu Stagiaire du fondateur, jamais dans une vraie promo", () => {
  assert.equal(stagiaireVitrine({ ...VITRINE, fondateur: false }), null);
  assert.equal(stagiaireVitrine({ ...VITRINE, apercu: "formateur" }), null);
  assert.equal(stagiaireVitrine({ ...VITRINE, apercu: "direction" }), null);
  assert.equal(stagiaireVitrine({ ...VITRINE, apercu: "siege" }), null);
  assert.equal(stagiaireVitrine({ ...VITRINE, apercu: null }), null);
  assert.equal(stagiaireVitrine({ ...VITRINE, promoId: 1 }), null);
  assert.equal(stagiaireVitrine({ ...VITRINE, promoId: 2 }), null);
  assert.equal(stagiaireVitrine({ ...VITRINE, promoId: null }), null);
  assert.equal(stagiaireVitrine(), null);
  assert.deepEqual(Object.keys(VITRINES), ["7"]);
});

test("vitrine : les trois conditions sont strictes (aucune valeur approchante ne l'ouvre)", () => {
  // Un formateur ou une direction ont aussi l'aperçu Stagiaire : `fondateur` doit être le booléen vrai.
  for (const fondateur of [undefined, null, 0, 1, "true", "oui", {}, []]) {
    assert.equal(stagiaireVitrine({ ...VITRINE, fondateur }), null, "fondateur = " + JSON.stringify(fondateur));
  }
  for (const apercu of ["Stagiaire", "stagiaire ", "prof", "admin", "", undefined, true]) {
    assert.equal(stagiaireVitrine({ ...VITRINE, apercu }), null, "aperçu = " + JSON.stringify(apercu));
  }
  // La promo est l'entier de la table : ni son écriture en texte, ni un nom hérité d'Object.
  for (const promoId of ["7", 7.5, "constructor", "toString", "__proto__", "hasOwnProperty", NaN, -7, 0, 70]) {
    assert.equal(stagiaireVitrine({ ...VITRINE, promoId }), null, "promo = " + String(promoId));
  }
});

// --- Le sort d'une requête dans la vitrine -----------------------------------------------------------------------------

test("vitrine : une lecture part sans l'aperçu, un appel de fonction avec, une écriture ne part pas", () => {
  assert.equal(sortEnVitrine({ methode: "GET", chemin: REST + "qcm_attempts" }), "lecture");
  assert.equal(sortEnVitrine({ methode: "get", chemin: REST + "evaluations" }), "lecture");
  assert.equal(sortEnVitrine({ methode: "HEAD", chemin: REST + "passages" }), "lecture");
  assert.equal(sortEnVitrine({ chemin: REST + "stagiaires" }), "lecture");  // sans méthode : GET, comme fetch
  assert.equal(sortEnVitrine({ methode: "POST", chemin: REST + "rpc/mes_promos" }), "fonction");
  assert.equal(sortEnVitrine({ methode: "POST", chemin: REST + "rpc/emargement_signer" }), "fonction");
  for (const methode of ["POST", "PATCH", "PUT", "DELETE"]) {
    assert.equal(sortEnVitrine({ methode, chemin: REST + "qcm_attempts" }), "ecriture", methode);
  }
  // Tout ce qui n'est pas une lecture ou un appel de fonction reconnu est une écriture.
  assert.equal(sortEnVitrine({ methode: "PATCH", chemin: REST + "rpc/mes_promos" }), "ecriture");
  assert.equal(sortEnVitrine({ methode: "POST", chemin: REST + "rpc/" }), "ecriture");
  assert.equal(sortEnVitrine({ methode: "POST", chemin: REST + "rpc/a/b" }), "ecriture");
  assert.equal(sortEnVitrine({ methode: "POST", chemin: REST + "evaluations" }), "ecriture");
  assert.equal(sortEnVitrine({ methode: "POST", chemin: "" }), "ecriture");
  assert.equal(sortEnVitrine({ methode: "TRACE", chemin: REST + "stagiaires" }), "ecriture");
});

test("requête de données, en vitrine : seule une lecture perd l'en-tête d'aperçu, et aucune écriture de table ne part", () => {
  assert.deepEqual(requeteDeDonnees({ ...VITRINE, methode: "GET", chemin: REST + "qcm_attempts" }), { apercu: null, refus: null });
  assert.deepEqual(requeteDeDonnees({ ...VITRINE, methode: "HEAD", chemin: REST + "passages" }), { apercu: null, refus: null });
  // Un appel de fonction garde l'en-tête : la base y voit un stagiaire sans fiche, comme hors vitrine.
  assert.deepEqual(requeteDeDonnees({ ...VITRINE, methode: "POST", chemin: REST + "rpc/emargement_signer" }),
    { apercu: "stagiaire", refus: null });
  for (const [methode, table] of [["POST", "qcm_attempts"], ["POST", "evaluations"], ["PATCH", "dp_dossiers"],
    ["DELETE", "passages"], ["PUT", "epcf_livrets"], ["POST", "qcm_signalements"]]) {
    const r = requeteDeDonnees({ ...VITRINE, methode, chemin: REST + table });
    assert.equal(r.refus, MESSAGE_VITRINE, methode + " " + table);
    assert.equal(r.apercu, "stagiaire", "même refusée, la requête garderait l'en-tête");
  }
});

test("requête de données, hors vitrine : rien ne change (l'aperçu en cours part tel quel, aucun refus)", () => {
  const requetes = [["GET", "qcm_attempts"], ["POST", "qcm_attempts"], ["PATCH", "dp_dossiers"], ["DELETE", "passages"],
    ["POST", "rpc/mes_promos"]];
  const hors = [
    { promoId: 7, apercu: "stagiaire", fondateur: false },  // un formateur de la promo de démonstration en aperçu Stagiaire
    { promoId: 1, apercu: "stagiaire", fondateur: true },   // le fondateur en aperçu Stagiaire dans une vraie promo
    { promoId: 2, apercu: "stagiaire", fondateur: true },
    { promoId: 7, apercu: "formateur", fondateur: true },   // un autre aperçu dans la promo de démonstration
    { promoId: 7, apercu: "direction", fondateur: true },
    { promoId: 7, apercu: "siege", fondateur: true },
    { promoId: null, apercu: "stagiaire", fondateur: true },
  ];
  for (const contexte of hors) {
    for (const [methode, table] of requetes) {
      assert.deepEqual(requeteDeDonnees({ ...contexte, methode, chemin: REST + table }), { apercu: contexte.apercu, refus: null },
        JSON.stringify(contexte) + " " + methode + " " + table);
    }
  }
  // Sans aperçu (un vrai stagiaire, un formateur, le fondateur hors aperçu) : ni en-tête, ni refus, promo 7 comprise.
  for (const fondateur of [true, false]) {
    for (const [methode, table] of requetes) {
      assert.deepEqual(requeteDeDonnees({ promoId: 7, apercu: null, fondateur, methode, chemin: REST + table }),
        { apercu: null, refus: null });
    }
  }
});

// --- La fiche empruntée ne quitte pas la vitrine (relecture du 12/11) ---------------------------------------------------

test("fiche empruntée : une fiche de vitrine qui n'est pas celle du compte n'est jamais écrite, vitrine active ou non", () => {
  assert.equal(ficheEmpruntee(1634, null), true, "le fondateur n'a pas de fiche dans la promo de démonstration");
  assert.equal(ficheEmpruntee(1634), true);
  assert.equal(ficheEmpruntee(1634, 15), true, "ni avec sa vraie fiche d'une autre promo");
  assert.equal(ficheEmpruntee(1634, 1634), false, "un compte réellement lié à cette fiche écrit pour lui");
  assert.equal(ficheEmpruntee(15, 15), false, "une vraie fiche");
  assert.equal(ficheEmpruntee(15, null), false);
  assert.equal(ficheEmpruntee(1635, null), false, "une autre fiche de la promo de démonstration n'est pas une vitrine");
  for (const fiche of [null, undefined, "1634", NaN, 1634.5]) assert.equal(ficheEmpruntee(fiche, null), false, String(fiche));
});

test("profil du compte : la promo courante ne porte jamais la fiche empruntée, le profil non plus", () => {
  const db = lire("../js/db.js");
  const promoCourante = db.slice(db.indexOf("export function getPromoCourante()"), db.indexOf("export function stagiaireVitrineCourante()"));
  assert.doesNotMatch(promoCourante.replace(/\/\/.*$/gm, ""), /vitrine/i, "getPromoCourante rend la promo telle que la base la donne");
  assert.match(db, /return profilEffectif\(data, getPromoCourante\(\)\);/, "le profil se calcule sur cette promo");
  // Le fondateur dans la promo de démonstration : aucune fiche dans son profil, en vitrine ou non.
  const fondateur = { email: "f@exemple.invalid", role: "stagiaire", is_founder: true, is_admin: true, stagiaire_id: 15 };
  assert.equal(profilEffectif(fondateur, { id: 7, stagiaire_id: null }).stagiaire_id, null);
});

test("sortie de la vitrine : les requêtes sont coupées et l'app se recharge avant tout changement d'aperçu", () => {
  const auth = lire("../js/auth-admin.js");
  const changer = auth.slice(auth.indexOf("export function setViewAs(role)"), auth.indexOf("export function getProfileWho()"));
  const sortie = changer.slice(changer.indexOf("if (enVitrine() && nouveau !== viewAs) {"));
  assert.ok(sortie.length > 0 && changer.indexOf("if (enVitrine() && nouveau !== viewAs) {") > 0, "la branche de sortie existe");
  const fin = sortie.indexOf("return;");
  const corps = sortie.slice(0, fin);
  assert.match(corps, /bloquerRequetesJusquAuRechargement\(\);/);
  assert.match(corps, /location\.reload\(\);/);
  assert.ok(corps.indexOf("bloquerRequetesJusquAuRechargement()") < corps.indexOf("location.reload()"), "couper d'abord, recharger ensuite");
  assert.doesNotMatch(corps, /appliquerApercu\(/, "l'aperçu en mémoire reste celui de la vitrine jusqu'au rechargement");
  assert.ok(changer.indexOf("if (enVitrine() && nouveau !== viewAs) {") < changer.indexOf("appliquerApercu(nouveau);"),
    "la sortie est décidée avant de changer d'aperçu");
});

test("écrans de la vitrine : la démonstration est retenue au départ de la passe ; réglage d'anonymat et livret d'un autre écartés", () => {
  const qcm = lire("../js/views/qcm.js");
  assert.equal((qcm.match(/const demonstration = enVitrine\(\);/g) || []).length, 2, "entraînement et examen");
  const examen = qcm.slice(qcm.indexOf("function runExam(theme, full, questions, profile)"));
  assert.ok(examen.indexOf("const demonstration = enVitrine();") < examen.indexOf("setInterval("), "retenue avant le minuteur");
  assert.match(lire("../js/views/config.js"), /if \(monStagiaireId\(\) == null \|\| enVitrine\(\)\) return null;/);
  assert.match(lire("../js/views/notes.js"), /return !litTout\(\) && !enVitrine\(\) && !!getProfile\(\)\?\.anonymous_notes;/);
  assert.match(lire("../js/views/epcf-livret.js"), /\|\| \(enVitrine\(\) \? undefined : rows\[0\]\);/);
});

// --- Ce que dit l'écran, et le câblage ---------------------------------------------------------------------------------

test("bandeau d'aperçu : en vitrine, il nomme la fiche fictive et dit que rien n'est enregistré à son nom", () => {
  assert.deepEqual(texteBandeauApercu("stagiaire", null, "Camille M."),
    { libelle: "Stagiaire", suite: "Vous voyez l'app comme Camille M. (fiche fictive). Rien n'est enregistré à son nom." });
  assert.deepEqual(texteBandeauApercu("stagiaire", null), { libelle: "Stagiaire", suite: "" });
  assert.deepEqual(texteBandeauApercu("stagiaire", null, null), { libelle: "Stagiaire", suite: "" });
  // Le nom de vitrine ne change rien aux autres aperçus.
  assert.equal(texteBandeauApercu("formateur", null, "Camille M.").suite, "");
  assert.equal(texteBandeauApercu("siege", null, "Camille M.").suite, "Ce que vous modifiez ici est vraiment enregistré.");
});

test("câblage : toute requête de données passe par la règle, et les tentatives de QCM ne partent pas de la vitrine", () => {
  const db = lire("../js/db.js");
  // Le point de passage unique des requêtes applique la décision : refus avant le réseau, en-tête selon la règle.
  const passage = db.slice(db.indexOf("function fetchWithTimeout"), db.indexOf("export const supabase"));
  // La vitrine ne joue que pour la promo affichée (une lecture d'une autre promo garde l'aperçu).
  assert.match(passage, /requeteDeDonnees\(\{\s*promoId: promo === promoCouranteId \? promo : null, apercu: apercuEnvoye, fondateur: apercuDuFondateur,\s*methode, chemin: cheminDe\(url\),?\s*\}\)/);
  assert.match(passage, /if \(refus\) return Promise\.resolve\(reponseDeRefus\(refus\)\);/);
  assert.ok(passage.indexOf("if (refus) return") < passage.indexOf("return fetch("), "le refus précède l'appel au réseau");
  assert.equal((passage.match(/entetes\.set\(ENTETE_APERCU/g) || []).length, 1, "un seul endroit pose l'en-tête d'aperçu");
  assert.match(passage, /if \(apercuPose\) entetes\.set\(ENTETE_APERCU, apercuPose\); else entetes\.delete\(ENTETE_APERCU\);/);
  // Le drapeau « fondateur » ne vient que de poserApercu, appelé par auth-admin.js avec le profil réel.
  assert.equal((db.match(/apercuDuFondateur = /g) || []).length, 2, "une déclaration et une seule affectation");
  assert.match(db, /apercuDuFondateur = fondateur === true;/);
  assert.match(lire("../js/auth-admin.js"), /poserApercu\(role, \{ fondateur: isFounder\(\) \}\);/);
  // Tentatives de QCM : refus dans la fonction d'écriture, lectures « mes lignes » limitées à la fiche montrée.
  const insertion = db.slice(db.indexOf("export async function insertQcmAttempt"), db.indexOf("async function ecrireExamen"));
  assert.match(insertion, /if \(stagiaireVitrineCourante\(\) != null \|\| ficheEmpruntee\(payload\?\.stagiaire_id, getPromoCourante\(\)\?\.stagiaire_id \?\? null\)\) \{\s*throw new Error\(MESSAGE_VITRINE\);/);
  assert.ok(insertion.indexOf("throw new Error(MESSAGE_VITRINE)") < insertion.indexOf("supabase"), "le refus précède la requête");
  assert.equal((db.match(/await mesLignes\(supabase\s*\.from\("qcm_attempts"\)/g) || []).length, 2,
    "listMyQcmAttempts et getMyExamAttempt");
  // Écrans : ni l'entraînement ni l'examen n'appellent l'écriture en vitrine.
  const qcm = lire("../js/views/qcm.js");
  assert.match(qcm, /if \(maFiche && !demonstration && !enVitrine\(\)\) \{\s*await insertQcmAttempt\(/);
  assert.match(qcm, /if \(demonstration \|\| enVitrine\(\)\) \{ renderResults\(score, note20, timedOut, null, true\); return; \}/);
  assert.equal((qcm.match(/insertQcmAttempt\(\{/g) || []).length, 2, "deux écritures de tentative, toutes deux gardées");
  const fin = qcm.slice(qcm.indexOf("async function finish(timedOut)"));
  assert.ok(fin.indexOf("if (demonstration || enVitrine())") < fin.indexOf("insertQcmAttempt({"), "l'examen sort avant l'écriture");
});
