// Inventaire des preuves d'une promo (spec 2026-10-28, § 6.2 et annexe A). Jeu fait à la main, attendus
// recalculés à la main dans les commentaires : un écart vient du module, pas du test.
// Lancer depuis la racine du dépôt : node tests/qualiopi-preuves.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { NIVEAUX, PIECES, inventairePromo, lignesDuPlanning, nouveautesCitables } from "../js/qualiopi-preuves.js";
import { INDICATEURS, indicateursApplicables } from "../js/qualiopi-referentiel.js";
import { indicateursPromo } from "../js/centre-stats.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (v, msg) => { assert.ok(v, msg); n++; };

const plage = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const numeros = (liste) => liste.map((x) => x.numero);
const TIRET_CADRATIN = String.fromCharCode(0x2014);
// Les 28 indicateurs de l'annexe A (les 27 de la formation continue, plus le 13 de l'alternance).
const LES_28 = [...plage(1, 13), ...plage(16, 19), ...plage(21, 28), 30, 31, 32];
const LES_27 = LES_28.filter((num) => num !== 13);

// =====================================================================================================
// NIVEAUX : l'annexe A de la spec, colonne par colonne
// =====================================================================================================
eq(Object.keys(NIVEAUX).map(Number), LES_28, "NIVEAUX couvre les 28 indicateurs de l'annexe A");
eq(Object.keys(NIVEAUX).map(Number), numeros(indicateursApplicables({ alternance: true })),
  "ce sont ceux du référentiel de la formation continue avec l'alternance");

const parNiveau = (niveau) => Object.keys(NIVEAUX).map(Number).filter((k) => NIVEAUX[k].niveau === niveau);
eq(parNiveau("prouve"), [10, 11, 16, 19], "prouvé : l'app fournit l'essentiel");
eq(parNiveau("hors"), [1, 4, 8, 13, 21, 22, 24, 26, 27], "hors de l'app");
eq(parNiveau("partiel"), [2, 3, 5, 6, 7, 9, 12, 17, 18, 23, 25, 28, 30, 31, 32], "en partie");
eq(Object.keys(NIVEAUX).map(Number).filter((k) => NIVEAUX[k].apporte === "rien"), parNiveau("hors"),
  "« rien » : exactement les indicateurs hors de l'app");

Object.entries(NIVEAUX).forEach(([num, v]) => {
  eq(Object.keys(v).sort(), ["aFournir", "ajout", "apporte", "niveau"], `${num} : champs`);
  ok(typeof v.apporte === "string" && v.apporte.length > 0 && v.apporte === v.apporte.trim(), `${num} : ce que l'app apporte`);
  ok(v.ajout === null || (typeof v.ajout === "string" && v.ajout.length > 0), `${num} : ajout nul ou texte`);
  ok(Array.isArray(v.aFournir) && v.aFournir.every((s) => typeof s === "string" && s.length > 0 && s === s.trim()),
    `${num} : pièces à fournir`);
});
eq(NIVEAUX[1], { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["site", "catalogue", "fiche formation"] }, "1");
eq(NIVEAUX[10], { niveau: "prouve", apporte: "ordre de passage, « à suivre de près », passages, Mon suivi", ajout: null, aFournir: [] },
  "10 : cellules vides, ajout nul et rien à fournir");
eq(NIVEAUX[11].aFournir, [], "11 : rien à fournir");
eq(NIVEAUX[12], {
  niveau: "partiel", apporte: "assiduité, difficultés, abandons (sans date)",
  ajout: "date et motif d'abandon (plus tard)", aFournir: ["procédure et référent violences"],
}, "12");
eq(NIVEAUX[19].aFournir, ["référent pédagogique si le seuil l'exige"], "19 : une seule pièce, la virgule n'y est pas");
eq(NIVEAUX[21].aFournir, ["CV", "titres", "autorisations d'enseigner"], "21 : trois pièces, découpées sur la virgule");
// Empreinte de l'annexe A de la spec : lignes « n° | niveau | apporte | ajout | à fournir » séparées par des
// tabulations, tirées du tableau de la spec par un script jetable. Toute retouche de NIVEAUX la change. Recalculée le
// 10/11 : la colonne « apporte » des indicateurs 7, 10, 11, 12, 31 et 32 a pris les mots de l'app (livret EPCF, ordre de
// passage, difficultés, contestations de QCM analysées, thèmes les moins réussis), le sens de la spec est inchangé.
const ANNEXE_A = "6a028538d1e5c2e7dbc2bed5ccaf34ba39e91f100176a431ad29536346473899";
const canon = Object.entries(NIVEAUX)
  .map(([num, v]) => [num, v.niveau, v.apporte, v.ajout ?? "", v.aFournir.join(", ")].join("\t")).join("\n");
eq(createHash("sha256").update(canon).digest("hex"), ANNEXE_A, "NIVEAUX reprend l'annexe A de la spec (mots du 10/11)");

// =====================================================================================================
// PIECES : le tableau du § 6.2
// =====================================================================================================
const TABLE_PIECES = [
  ["effectif", "Effectif, abandons", [10, 12]],
  ["deroule", "Déroulé réalisé", [6, 9, 17, 18]],
  ["datesCles", "Dates clés", [9, 28]],
  ["assiduite", "Assiduité", [10, 12, 16]],
  ["passages", "Passages", [10, 12]],
  ["evaluations", "Évaluations", [11, 16]],
  ["dossierPro", "Dossier professionnel", [16]],
  ["ressources", "Ressources", [19]],
  ["misesAJour", "Mises à jour", [19, 23, 31]],
  ["innovations", "Innovations", [25]],
  ["intervenants", "Intervenants et partenaires", [17, 18, 28]],
  ["resultats", "Résultats et méthodes", [2, 3, 32]],
  ["suivi", "Suivi", [10, 12, 32]],
  ["appreciations", "Appréciations", [30, 32]],
  ["registre", "Registre qualité", [31, 32]],
];
const LIBELLE = Object.fromEntries(TABLE_PIECES.map(([cle, libelle]) => [cle, libelle]));
eq(PIECES, TABLE_PIECES.map(([cle, libelle, indicateurs]) => ({ cle, libelle, indicateurs })),
  "15 pièces, dans l'ordre du tableau du § 6.2 et de la tâche Q3b");
ok(PIECES.every((p) => p.indicateurs.every((num) => num in NIVEAUX)), "chaque pièce sert des indicateurs de l'annexe A");

// =====================================================================================================
// Jeu de données fait à la main : une promo de 3 stagiaires dont 1 en abandon
// =====================================================================================================
// Gèle récursivement : si le module modifiait une entrée, la modification lèverait une erreur.
function geler(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(geler); }
  return v;
}
// Les endroits où une valeur porte un NaN ou un undefined, ou une phrase qui en contient la trace (liste vide si
// tout est propre). `textes` reçoit les phrases rencontrées.
function problemes(v, chemin, textes) {
  if (v === undefined) return [`${chemin} vaut undefined`];
  if (typeof v === "number" && Number.isNaN(v)) return [`${chemin} vaut NaN`];
  if (typeof v === "string") {
    textes.push(v);
    return /NaN|undefined|Invalid/.test(v) ? [`${chemin} contient « ${v} »`] : [];
  }
  if (Array.isArray(v)) return v.flatMap((x, i) => problemes(x, `${chemin}[${i}]`, textes));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => problemes(x, `${chemin}.${k}`, textes));
  return [];
}

const PROMO = geler({ id: 7, lieu_id: 2, nom: "Promo de test", date_debut: "2026-09-28", date_fin: "2026-10-23" });
const AUJOURDHUI = "2026-10-28";

const REF = geler({
  qcm: [
    { id: 10, theme_id: 100, titre: "QCM Feux", exam_pass_20: 15 },
    { id: 11, theme_id: 101, titre: "QCM Vitesse", exam_pass_20: null },
    { id: 12, theme_id: 102, titre: "QCM Alcool", exam_pass_20: 12 },
  ],
  themes: [
    { id: 100, numero: 1, titre: "Feux", type: "theme" },
    { id: 101, numero: 2, titre: "Vitesse", type: "theme" },
    { id: 102, numero: 3, titre: "Alcool", type: "theme" },
  ],
});

// Anaïs (1) et Bastien (2) sont en formation, Cédric (3) a abandonné : rien de lui ne compte.
const STAG = [
  { id: 1, prenom: "Anaïs", nom: "Marchand", actif: true, ordre: 1, anonymise_le: null },
  { id: 2, prenom: "Bastien", nom: "Delmas", actif: true, ordre: 2, anonymise_le: null },
  { id: 3, prenom: "Cédric", nom: "Vidal", actif: false, ordre: 3, anonymise_le: null },
];

// Passages. En formation, salle faite ou remplacée : Anaïs 1 + Bastien (1 faite et 1 bonus) = 3 ; voiture :
// Anaïs 1 = 1 ; absences de dernière minute : Bastien 2 (une en salle, une en voiture).
let idPassage = 0;
const P = (stagiaire_id, type, resultat, date) => ({ id: ++idPassage, stagiaire_id, type, resultat, date });
const PASSAGES = [
  P(1, "Salle", "Effectué", "2026-10-06"), P(1, "Voiture", "Effectué", "2026-10-07"),
  P(2, "Salle", "Effectué", "2026-10-06"), P(2, "Salle", "Bonus", "2026-10-08"),
  P(2, "Salle", "Absence", "2026-10-09"), P(2, "Voiture", "Absence", "2026-10-13"),
  P(3, "Salle", "Effectué", "2026-10-06"),                                 // abandon : ignoré
];

// Notes. Comptées : 4 (12, 8, 14, 10 sur 20) du 06/10 au 13/10. Écartées : celle de l'abandon (30/09, qui
// avancerait le début de la plage), une sans note, une sans barème.
let idNote = 0;
const E = (stagiaire_id, type, num, note, note_max, date_eval) =>
  ({ id: ++idNote, stagiaire_id, type, theme_numero: type === "Thème" ? num : null,
     competence_code: type === "Compétence" ? num : null, controle_libelle: null, note, note_max, date_eval });
const EVALS = [
  E(1, "Thème", 1, 12, 20, "2026-10-06"), E(2, "Thème", 1, 8, 20, "2026-10-08"),
  E(1, "Thème", 1, 14, 20, "2026-10-09"), E(2, "Thème", 1, 10, 20, "2026-10-13"),
  E(3, "Thème", 1, 18, 20, "2026-09-30"),                                  // abandon : ignorée
  E(1, "Thème", 2, null, 20, "2026-10-20"),                                // sans note : ignorée
  E(2, "Thème", 2, 5, 0, "2026-10-21"),                                    // sans barème : ignorée
];

// QCM. Entraînements en formation : Anaïs 2 (20 + 10 questions), Bastien 1 (10) ; examens : Anaïs 1 (16 sur 20).
// Thèmes classés d'après les QCM (au moins 20 réponses) : Feux 20, Vitesse 10 + 10 = 20, soit 2.
const T = (stagiaire_id, qcm_id, mode, score, total, note_20, jour) =>
  ({ id: stagiaire_id * 100 + qcm_id, qcm_id, stagiaire_id, mode, score, total, note_20, finished_at: jour + "T10:00:00+00:00" });
const TENTATIVES = [
  T(1, 10, "entrainement", 15, 20, 15, "2026-10-20"), T(1, 11, "entrainement", 7, 10, 14, "2026-10-12"),
  T(2, 11, "entrainement", 6, 10, 12, "2026-10-10"), T(3, 12, "entrainement", 9, 10, 18, "2026-10-12"),   // abandon : ignoré
  T(1, 10, "examen", 16, 20, 16, "2026-10-14"), T(3, 10, "examen", 20, 20, 20, "2026-10-14"),             // abandon : ignoré
];

// EPCF : trois évaluations en salle de la même personne (Anaïs), qui comptent chacune pour l'inventaire (3) ; le
// tableau de bord n'en garde que la dernière (1 stagiaire évalué en salle). Écartées : une auto-évaluation de Bastien,
// une évaluation de Bastien hors contexte EPCF, une évaluation de l'abandon.
const X = (id, stagiaire_id, trame, date_eval, scores, extra = {}) =>
  ({ id, stagiaire_id, trame, contexte: "EPCF", auto_eval: false, date_eval, scores, ...extra });
const EPCF = [
  X(1, 1, "salle", "2026-10-06", { a: "NA", b: "R" }),
  X(2, 1, "salle", "2026-10-09", { a: "R", b: "R" }),
  X(3, 1, "salle", "2026-10-14", { a: "A", b: "R" }),
  X(4, 2, "vehicule", "2026-10-14", { x: "A" }, { auto_eval: true }),
  X(5, 2, "vehicule", "2026-10-08", { x: "A" }, { contexte: "Entraînement" }),
  X(6, 3, "salle", "2026-10-05", { a: "A" }),
];

// Planning de deux semaines (lundis 05/10 et 12/10). Une demi-journée a plusieurs lignes, la base garde des
// lignes vides, et la dernière ligne est celle d'une autre promo. Demi-journées de la promo 7 : 05/10 matin,
// 05/10 après-midi, 07/10 matin, 13/10 après-midi (groupe en autonomie), 15/10 matin = 5, du 05/10 au 15/10.
const L = (id, semaine_lundi, day_index, half_day, extra = {}) => ({
  id, semaine_lundi, day_index, half_day, activite: "", sujet: "", sujet_2: "", prof_ids: [], prof_autre: null,
  autonomie: false, benevoles_ids: [], promo_id: 7, ...extra,
});
const PLANNING = [
  L(1, "2026-10-05", 0, "matin", { activite: "Cours", sujet: "Révision avec Kevin", prof_ids: [1] }),
  L(2, "2026-10-05", 0, "matin", { activite: "Pédagogie salle", prof_ids: [2] }),                  // même demi-journée
  L(3, "2026-10-05", 0, "aprem", { activite: "Voiture (conduite)", prof_ids: [1], benevoles_ids: [10, 11] }),
  L(4, "2026-10-05", 2, "matin", { activite: "Cours", prof_autre: "Mme Durand" }),
  L(5, "2026-10-05", 4, "aprem"),                                                                   // ligne vide : ignorée
  L(6, "2026-10-12", 1, "aprem", { autonomie: true }),
  L(7, "2026-10-12", 3, "matin", { activite: "Contrôle", prof_ids: [1, 3] }),
  L(8, "2026-10-12", 4, "matin"),                                                                   // ligne vide : ignorée
  L(9, "2026-12-07", 0, "matin", { activite: "Cours", prof_ids: [4], benevoles_ids: [12], prof_autre: "Autre promo", promo_id: 1 }),
];
// Intervenants de la promo 7 : formateurs 1, 2, 3 = 3 ; « Autre » : Mme Durand = 1 ; bénévoles 10, 11 = 2 ;
// auto-écoles actives du lieu 2 : 2 (une inactive et une d'un autre lieu sont écartées).
const AUTO_ECOLES = [
  { id: 1, actif: true, lieu_id: 2 }, { id: 2, actif: true, lieu_id: 2 },
  { id: 3, actif: false, lieu_id: 2 }, { id: 4, actif: true, lieu_id: 3 },
];

// Calendrier : formation du 28/09 au 18/12, stage du 02/11 au 27/11, examen le 15/12 ; un férié ne compte pas.
const AGENDA = [
  { id: 1, type: "formation", title: "Formation chez Mme Dupont", date_start: "2026-09-28", date_end: "2026-12-18" },
  { id: 2, type: "stage", title: "Stage Dupont", date_start: "2026-11-02", date_end: "2026-11-27" },
  { id: 3, type: "examen", title: "Examen", date_start: "2026-12-15", date_end: null },
  { id: 4, type: "ferie", title: "Toussaint", date_start: "2026-11-01", date_end: null },
];

// Un livret et un dossier professionnel de l'abandon sont écartés (le dossier de l'abandon est le plus récent).
const LIVRETS = [
  { stagiaire_id: 1, updated_at: "2026-10-15T09:00:00+00:00" }, { stagiaire_id: 3, updated_at: "2026-10-01T09:00:00+00:00" },
];
const DOSSIERS = [
  { stagiaire_id: 2, updated_at: "2026-10-10T08:00:00+00:00" }, { stagiaire_id: 3, updated_at: "2026-10-12T08:00:00+00:00" },
];
// Un signalement traité le 12/10, un encore ouvert.
const SIGNALEMENTS = [
  { id: 1, stagiaire_id: 1, statut: "tranché", created_at: "2026-10-01T10:00:00+00:00", traite_at: "2026-10-12T09:00:00+00:00" },
  { id: 2, stagiaire_id: 2, statut: "ouvert", created_at: "2026-10-15T10:00:00+00:00", traite_at: null },
];
// Cours : 2 publiés et 1 brouillon. Les dates de sauvegarde d'un cours sont les horodatages distincts de ses versions
// (`saved_at` : la date de l'état archivé, pas celle de la modification qui le remplace) et de son `updated_at` (la
// sauvegarde en vigueur, qu'aucune version ne porte). La plus ancienne est sa création ou son import ; les autres
// sont des modifications.
//   cours 1 : créé le 26/08, modifié le 05/10 puis le 12/10 : 2 modifications dans la période (une version datée de la
//             période, plus son updated_at)
//   cours 2 : créé le 26/08, modifié une seule fois, le 20/10 : 1 modification dans la période, sans aucune version
//             datée de la période (seul son updated_at la porte)
//   cours 3 : un brouillon, modifié le 06/10 : ne compte pas
const COURS = [
  { id: 1, published: true, updated_at: "2026-10-12T15:00:00+00:00" },
  { id: 2, published: true, updated_at: "2026-10-20T09:00:00+00:00" },
  { id: 3, published: false, updated_at: "2026-10-06T10:00:00+00:00" },
];
// Versions archivées : jamais la sauvegarde en vigueur. Une version d'un cours inconnu (99) ne compte pas non plus.
// Au total : 2 cours publiés modifiés, 3 modifications, du 05/10 au 20/10.
const VERSIONS = [
  { cours_id: 1, saved_at: "2026-08-26T10:00:00+00:00" }, { cours_id: 1, saved_at: "2026-10-05T10:00:00+00:00" },
  { cours_id: 2, saved_at: "2026-08-26T10:00:00+00:00" },
  { cours_id: 3, saved_at: "2026-08-26T10:00:00+00:00" }, { cours_id: 99, saved_at: "2026-10-07T10:00:00+00:00" },
];
// Nouveautés datées pendant la promo (28/09 au 23/10) : 02/10 et 20/10 ; celles du 15/09 (avant le début), du 05/11
// (après la fin) et sans date sont écartées.
const NOUVEAUTE = (id, date) => ({ id, ...(date ? { date } : {}), pour: "formateurs", titre: "Nouveauté secrète " + id, resume: "Résumé " + id });
const NOUVEAUTES = geler([
  NOUVEAUTE("a", "2026-09-15"), NOUVEAUTE("b", "2026-10-02"), NOUVEAUTE("c", "2026-10-20"),
  NOUVEAUTE("d", "2026-11-05"), NOUVEAUTE("e", null),
]);

const D = geler({
  stagiaires: STAG, passages: PASSAGES, evaluations: EVALS, tentatives: TENTATIVES, epcf: EPCF,
  planning: PLANNING, agenda: AGENDA, livrets: LIVRETS, dossiers: DOSSIERS, signalements: SIGNALEMENTS,
  cours: COURS, versions: VERSIONS, autoEcoles: AUTO_ECOLES,
  profs: [{ id: 1, nom: "Nadia Roche" }, { id: 2, nom: "Karim Lopez" }, { id: 3, nom: "Hugo Perrin" }],
  entete: { organisme: "Centre de test", intitule: "Titre de test" },
});
const OPTIONS = { promo: PROMO, aujourdhui: AUJOURDHUI, nouveautes: NOUVEAUTES };

const inv = inventairePromo(D, REF, OPTIONS);
const indic = (i, num) => i.indicateurs.find((x) => x.numero === num);
const toutes = (i) => i.indicateurs.flatMap((x) => x.pieces);
const piece = (i, cle) => toutes(i).find((p) => p.cle === cle);
const attendue = (cle, detail) => ({ cle, libelle: LIBELLE[cle], presente: true, detail, raison: null });
const manquante = (cle, raison) => ({ cle, libelle: LIBELLE[cle], presente: false, detail: null, raison });

// Les notes, les examens, les passages, la liste « à suivre » et les thèmes de l'inventaire sont ceux du tableau de bord.
// L'EPCF fait exception : le tableau de bord compte 1 stagiaire évalué en salle (sa dernière évaluation), l'inventaire
// compte les 3 évaluations.
const tdb = indicateursPromo(D, REF, { aujourdhui: AUJOURDHUI });
eq([tdb.notes.detail.n, tdb.examensQcm.detail.passes, tdb.epcf.detail.salle.evalues, tdb.epcf.detail.vehicule.evalues],
  [4, 1, 1, 0], "le tableau de bord compte 4 notes, 1 examen, 1 stagiaire évalué en EPCF en salle et aucun en véhicule");
eq(tdb.aSuivre.map((x) => x.stagiaire.id), [2], "Bastien cumule deux signaux (absences, aucun entraînement depuis 14 jours)");
eq([tdb.themes.qcm.length, tdb.themes.notes.length], [2, 1],
  "les thèmes les plus faibles : 2 d'après les QCM, 1 d'après les notes");

// =====================================================================================================
// L'inventaire : indicateurs, niveaux, pièces
// =====================================================================================================
eq(inv.promo, PROMO, "la promo est rendue telle quelle");
eq(Object.keys(inv).sort(), ["indicateurs", "nonApplicables", "promo"], "trois clés");
eq(numeros(inv.indicateurs), LES_27, "27 indicateurs sans alternance, dans l'ordre des numéros");

const PIECES_PAR_INDICATEUR = {
  2: ["resultats"], 3: ["resultats"], 6: ["deroule"], 9: ["deroule", "datesCles"],
  10: ["effectif", "assiduite", "passages", "suivi"], 11: ["evaluations"],
  12: ["effectif", "assiduite", "passages", "suivi"], 16: ["assiduite", "evaluations", "dossierPro"],
  17: ["deroule", "intervenants"], 18: ["deroule", "intervenants"], 19: ["ressources", "misesAJour"],
  23: ["misesAJour"], 25: ["innovations"], 28: ["datesCles", "intervenants"], 31: ["misesAJour", "registre"],
  30: ["appreciations"], 32: ["resultats", "suivi", "appreciations", "registre"],
};
inv.indicateurs.forEach((i) => {
  const ref = INDICATEURS.find((x) => x.numero === i.numero);
  eq(Object.keys(i).sort(), ["aFournir", "apporte", "court", "critere", "niveau", "numero", "pieces"], `${i.numero} : champs`);
  eq([i.critere, i.court], [ref.critere, ref.court], `${i.numero} : critère et libellé court du référentiel`);
  eq([i.niveau, i.apporte, i.aFournir], [NIVEAUX[i.numero].niveau, NIVEAUX[i.numero].apporte, NIVEAUX[i.numero].aFournir],
    `${i.numero} : niveau, apport et pièces à fournir de l'annexe A`);
  eq(i.pieces.map((p) => p.cle), PIECES_PAR_INDICATEUR[i.numero] || [], `${i.numero} : pièces de l'app, dans l'ordre du tableau`);
  i.pieces.forEach((p) => {
    eq(Object.keys(p).sort(), ["cle", "detail", "libelle", "presente", "raison"], `${i.numero}/${p.cle} : champs`);
    eq(p.libelle, LIBELLE[p.cle], `${i.numero}/${p.cle} : libellé`);
    ok(p.presente ? typeof p.detail === "string" && p.raison === null : p.detail === null && typeof p.raison === "string",
      `${i.numero}/${p.cle} : une phrase de détail si présente, une raison sinon, l'autre champ nul`);
  });
});

// Une pièce a le même état chez tous les indicateurs qu'elle sert.
PIECES.forEach((p) => {
  const vues = toutes(inv).filter((x) => x.cle === p.cle);
  eq(vues.length, p.indicateurs.filter((num) => indic(inv, num)).length, `${p.cle} : une fois par indicateur servi`);
  vues.forEach((v) => eq(v, vues[0], `${p.cle} : même état partout`));
  vues.slice(1).forEach((v) => ok(v !== vues[0], `${p.cle} : chaque indicateur a son propre objet`));
});

// Deux cas types : le 11 est prouvé et ses évaluations présentes ; le 1 est hors de l'app.
eq(indic(inv, 11).niveau, "prouve", "11 : prouvé");
ok(indic(inv, 11).pieces[0].cle === "evaluations" && indic(inv, 11).pieces[0].presente, "11 : évaluations présentes");
ok(indic(inv, 11).pieces[0].detail.includes("4 notes"), "11 : le détail compte « 4 notes »");
eq(indic(inv, 1).niveau, "hors", "1 : hors de l'app");
ok(indic(inv, 1).aFournir.length > 0, "1 : des pièces à fournir");
eq(indic(inv, 1).pieces, [], "1 : aucune pièce de l'app");

// =====================================================================================================
// Les pièces : phrases chiffrées
// =====================================================================================================
eq(piece(inv, "effectif"), attendue("effectif", "3 inscrits, dont 2 ont suivi la formation jusqu'au bout et 1 abandon"), "effectif");
eq(piece(inv, "deroule"), attendue("deroule", "5 demi-journées de formation du 05/10 au 15/10"), "déroulé : 5 demi-journées");
eq(piece(inv, "datesCles"),
  attendue("datesCles", "3 événements au calendrier (1 formation, 1 stage, 1 examen) du 28/09 au 18/12"), "dates clés");
eq(piece(inv, "assiduite"), manquante("assiduite", "calcul des heures pas encore branché"), "assiduité : calcul des heures pas branché");
eq(piece(inv, "passages"),
  attendue("passages", "3 passages en salle et 1 en voiture (remplacements compris), 2 absences de dernière minute"), "passages");
eq(piece(inv, "evaluations"), attendue("evaluations",
  "4 notes du 06/10 au 13/10, 1 examen QCM, 3 évaluations EPCF, 1 livret EPCF (stagiaires en formation uniquement) ; aucun résultat de jury saisi"),
  "évaluations : les 3 évaluations EPCF d'une même personne comptent, la population est dite une fois");
eq(piece(inv, "dossierPro"),
  attendue("dossierPro", "enregistré pour 1 stagiaire sur 2 en formation, dernière mise à jour le 10/10"), "dossier professionnel");
eq(piece(inv, "ressources"), attendue("ressources",
  "2 cours publiés, 3 QCM ; QCM d'entraînement faits par 2 stagiaires sur 2 en formation (3 tentatives)"), "ressources");
eq(piece(inv, "misesAJour"), attendue("misesAJour",
  "2 cours publiés modifiés du 05/10 au 20/10 (3 modifications) ; 1 contestation de QCM traitée le 12/10"), "mises à jour");
eq(piece(inv, "innovations"), attendue("innovations", "2 nouveautés datées du 02/10 au 20/10"), "innovations");
eq(piece(inv, "intervenants"),
  attendue("intervenants", "3 formateurs, 1 intervenant extérieur, 2 bénévoles, 2 auto-écoles partenaires"), "intervenants");
eq(piece(inv, "resultats"), attendue("resultats",
  "9 indicateurs mesurés, chacun avec sa méthode de calcul ; réussite au titre non mesurée"), "résultats et méthodes");
eq(piece(inv, "suivi"), attendue("suivi",
  "stagiaires à suivre de près : 1 ; les 2 thèmes les plus faibles d'après les QCM (au moins 20 réponses par thème) ; "
  + "le thème le plus faible d'après les notes (au moins 3 notes par thème)"), "suivi");

// =====================================================================================================
// Pièces absentes, avec leur raison : une promo qui n'a que ses fiches de stagiaires
// =====================================================================================================
const fiches = inventairePromo({ stagiaires: STAG }, REF, { promo: PROMO, aujourdhui: AUJOURDHUI });
eq(piece(fiches, "effectif"), attendue("effectif", "3 inscrits, dont 2 ont suivi la formation jusqu'au bout et 1 abandon"), "fiches : effectif");
eq(piece(fiches, "resultats"), attendue("resultats",
  "2 indicateurs mesurés, chacun avec sa méthode de calcul ; réussite au titre non mesurée"), "fiches : effectif et abandons seulement");
eq(piece(fiches, "deroule"), manquante("deroule", "aucune demi-journée renseignée au planning de cette promo"), "fiches : déroulé");
eq(piece(fiches, "datesCles"),
  manquante("datesCles", "aucune date de formation, de stage ou d'examen au calendrier"), "fiches : dates clés");
eq(piece(fiches, "assiduite"), manquante("assiduite", "calcul des heures pas encore branché"), "fiches : assiduité");
eq(piece(fiches, "passages"), manquante("passages", "aucun passage en salle ou en voiture enregistré"), "fiches : passages");
eq(piece(fiches, "evaluations"),
  manquante("evaluations", "aucune évaluation enregistrée ; aucun résultat de jury saisi"), "fiches : évaluations et jury");
eq(piece(fiches, "dossierPro"),
  manquante("dossierPro", "aucun dossier professionnel enregistré par les stagiaires en formation"), "fiches : dossier professionnel");
eq(piece(fiches, "ressources"), manquante("ressources", "aucun cours publié"), "fiches : ressources");
eq(piece(fiches, "misesAJour"), manquante("misesAJour",
  "aucun cours publié modifié ni contestation de QCM traitée pendant la formation"), "fiches : mises à jour");
eq(piece(fiches, "innovations"), manquante("innovations", "aucune nouveauté datée pendant la formation"), "fiches : innovations");
eq(piece(fiches, "intervenants"), manquante("intervenants",
  "aucun formateur, intervenant extérieur ni bénévole au planning, aucune auto-école partenaire active"), "fiches : intervenants");
eq(piece(fiches, "suivi"), manquante("suivi",
  "aucun stagiaire n'est à suivre de près et aucun thème n'a encore assez de réponses ou de notes"), "fiches : suivi");

// Des cours publiés sans aucun QCM d'entraînement fait : la pièce est présente et le dit.
const sansActivite = inventairePromo({ ...D, tentatives: [] }, REF, OPTIONS);
eq(piece(sansActivite, "ressources").detail, "2 cours publiés, 3 QCM ; aucun QCM d'entraînement fait", "ressources sans activité QCM");

// =====================================================================================================
// Suivi : les thèmes les plus faibles sont un classement coupé à 5, pas un nombre de thèmes
// =====================================================================================================
// Huit thèmes à 95 % avec 20 réponses chacun, six thèmes avec 3 notes chacun : le tableau de bord n'en garde que 5 par
// liste, et la phrase dit « les 5 thèmes les plus faibles », jamais un nombre de thèmes à retravailler.
const REF_8 = geler({
  qcm: plage(0, 7).map((k) => ({ id: 20 + k, theme_id: 200 + k, titre: "QCM " + k, exam_pass_20: 15 })),
  themes: plage(0, 7).map((k) => ({ id: 200 + k, numero: 10 + k, titre: "Thème " + k, type: "theme" })),
});
const huit = inventairePromo({
  stagiaires: STAG,
  tentatives: plage(0, 7).map((k) => T(1, 20 + k, "entrainement", 19, 20, 19, "2026-10-20")),
  evaluations: plage(0, 5).flatMap((k) => [0, 1, 2].map(() => E(1, "Thème", 10 + k, 12, 20, "2026-10-06"))),
}, REF_8, OPTIONS);
eq(piece(huit, "suivi"), attendue("suivi",
  "stagiaires à suivre de près : 0 ; les 5 thèmes les plus faibles d'après les QCM (au moins 20 réponses par thème) ; "
  + "les 5 thèmes les plus faibles d'après les notes (au moins 3 notes par thème)"), "huit thèmes bien réussis : les 5 plus faibles, pas « 5 à retravailler »");
ok(!piece(huit, "suivi").detail.includes("retravailler"), "le mot « retravailler » n'y est plus");
// Les seuils de la phrase sont ceux du tableau de bord : un thème est classé à 20 réponses (pas à 19), à 3 notes (pas à 2).
const seuils = (reponses, notes) => piece(inventairePromo({
  stagiaires: STAG,
  tentatives: [T(1, 10, "entrainement", 10, reponses, 10, "2026-10-20")],
  evaluations: plage(1, notes).map(() => E(1, "Thème", 1, 12, 20, "2026-10-06")),
}, REF, OPTIONS), "suivi");
eq(seuils(19, 2), manquante("suivi", "aucun stagiaire n'est à suivre de près et aucun thème n'a encore assez de réponses ou de notes"),
  "19 réponses et 2 notes : aucun thème classé, personne à suivre : la pièce est absente");
eq(seuils(20, 2).detail, "stagiaires à suivre de près : 0 ; le thème le plus faible d'après les QCM (au moins 20 réponses par thème) ; "
  + "aucun thème n'a au moins 3 notes", "20 réponses : un thème classé d'après les QCM, au singulier");
eq(seuils(19, 3).detail, "stagiaires à suivre de près : 0 ; aucun thème n'a au moins 20 réponses aux QCM ; "
  + "le thème le plus faible d'après les notes (au moins 3 notes par thème)", "3 notes : un thème classé d'après les notes, au singulier");

// =====================================================================================================
// Variantes de phrases : accords, éléments absents d'une liste, une seule source par pièce
// =====================================================================================================
const avec = (extra) => inventairePromo({ ...D, ...extra }, REF, OPTIONS);
// Évaluations : chaque source seule ; la population (stagiaires en formation) et la mention du jury sont toujours là, une fois.
const POP = "(stagiaires en formation uniquement)";
const seule = (cle) => inventairePromo({ stagiaires: STAG, [cle]: D[cle] }, REF, OPTIONS);
eq(piece(seule("evaluations"), "evaluations").detail, `4 notes du 06/10 au 13/10 ${POP} ; aucun résultat de jury saisi`, "notes seules");
eq(piece(seule("tentatives"), "evaluations").detail, `1 examen QCM ${POP} ; aucun résultat de jury saisi`,
  "examens seuls (les entraînements ne comptent pas)");
eq(piece(seule("epcf"), "evaluations").detail, `3 évaluations EPCF ${POP} ; aucun résultat de jury saisi`,
  "EPCF seule (ni auto-évaluation, ni autre contexte, ni abandon)");
eq(piece(seule("livrets"), "evaluations").detail, `1 livret EPCF ${POP} ; aucun résultat de jury saisi`, "livret seul (pas celui de l'abandon)");
eq(piece(avec({ evaluations: [E(1, "Thème", 1, 12, 20, "2026-10-06")] }), "evaluations").detail,
  `1 note le 06/10, 1 examen QCM, 3 évaluations EPCF, 1 livret EPCF ${POP} ; aucun résultat de jury saisi`, "une note : singulier et un seul jour");
// Chaque évaluation EPCF compte, quelle que soit la grille ; une seule se dit au singulier.
const avecEpcf = (lignes) => piece(avec({ epcf: lignes }), "evaluations").detail;
eq(avecEpcf([X(1, 1, "salle", "2026-10-06", { a: "A" })]),
  `4 notes du 06/10 au 13/10, 1 examen QCM, 1 évaluation EPCF, 1 livret EPCF ${POP} ; aucun résultat de jury saisi`, "une évaluation EPCF");
eq(avecEpcf([X(1, 1, "salle", "2026-10-06", { a: "A" }), X(2, 1, "vehicule", "2026-10-07", { a: "A" }),
  X(3, 2, "salle", "2026-10-08", { a: "A" }), X(4, 2, "salle", "2026-10-09", { a: "R" })]),
  `4 notes du 06/10 au 13/10, 1 examen QCM, 4 évaluations EPCF, 1 livret EPCF ${POP} ; aucun résultat de jury saisi`,
  "deux grilles, deux stagiaires, une évaluation répétée : 4");
// Passages : sans absence, la phrase s'arrête aux passages ; une seule source suffit.
eq(piece(avec({ passages: [P(1, "Salle", "Effectué", "2026-10-06"), P(1, "Voiture", "Effectué", "2026-10-07")] }), "passages").detail,
  "1 passage en salle et 1 en voiture (remplacements compris)", "passages sans absence");
// Dossiers professionnels : deux stagiaires, la mise à jour la plus récente.
eq(piece(avec({ dossiers: [{ stagiaire_id: 1, updated_at: "2026-10-15T09:00:00+00:00" }, { stagiaire_id: 2, updated_at: "2026-10-10T08:00:00+00:00" }] }),
  "dossierPro").detail, "enregistré pour 2 stagiaires sur 2 en formation, dernière mise à jour le 15/10", "dossiers de deux stagiaires");
// Calendrier : les types s'accordent, un type absent n'est pas cité, un jour seul s'écrit « le ».
eq(piece(avec({ agenda: [
  { id: 1, type: "stage", title: "S1", date_start: "2026-11-02", date_end: "2026-11-06" },
  { id: 2, type: "stage", title: "S2", date_start: "2026-11-16", date_end: "2026-11-20" },
  { id: 3, type: "formation", title: "F", date_start: "2026-11-09", date_end: "2026-11-09" },
] }), "datesCles").detail, "3 événements au calendrier (1 formation, 2 stages) du 02/11 au 20/11", "calendrier : formation et stages");
eq(piece(avec({ agenda: [{ id: 1, type: "examen", title: "E", date_start: "2026-12-15", date_end: null }, AGENDA[3]] }), "datesCles").detail,
  "1 événement au calendrier (1 examen) le 15/12", "calendrier : un examen, le férié ne compte pas");
// Mises à jour (R22 corrigée). Les dates de sauvegarde d'un cours publié sont les horodatages distincts de ses versions
// (la date de l'état archivé) et de son `updated_at` (la sauvegarde en vigueur) ; la plus ancienne est sa création ou
// son import, les autres sont ses modifications ; la pièce compte celles qui tombent dans la période, les cours une
// fois chacun et les modifications à part.
const horodatage = (jour, heure = "10:00:00") => `${jour}T${heure}+00:00`;
// Un seul cours : ses états archivés (versions) et sa sauvegarde en vigueur (updated_at).
const unCours = (id, archives, courante, published = true) => ({
  cours: [{ id, published, updated_at: horodatage(courante) }],
  versions: archives.map((jour) => ({ cours_id: id, saved_at: horodatage(jour) })),
});
const misesAJourDe = (extra) => piece(avec({ signalements: [], ...extra }), "misesAJour");
const AUCUNE_MODIFICATION = manquante("misesAJour", "aucun cours publié modifié ni contestation de QCM traitée pendant la formation");
eq(misesAJourDe({}).detail, "2 cours publiés modifiés du 05/10 au 20/10 (3 modifications)",
  "le jeu principal sans signalement : 2 cours, 3 modifications");
eq(piece(avec({ versions: [] }), "misesAJour").detail, "1 contestation de QCM traitée le 12/10",
  "sans version, un cours n'a que sa sauvegarde en vigueur, c'est-à-dire sa création : aucune modification, il reste le signalement");
// (a) Créé avant la période, sauvegardé une seule fois pendant : aucune version n'est datée de la période, seul `updated_at` la
// porte. C'était le cas perdu en lisant les seules versions.
eq(misesAJourDe(unCours(7, ["2026-08-26"], "2026-10-05")).detail, "1 cours publié modifié le 05/10 (1 modification)",
  "(a) créé avant, sauvegardé une seule fois pendant : compté, 1 modification");
// (b) Créé (importé) pendant la période et jamais modifié : sa seule date est sa création.
eq(misesAJourDe(unCours(4, [], "2026-10-08")), AUCUNE_MODIFICATION, "(b) créé pendant et jamais modifié : non compté");
eq(misesAJourDe({ cours: [...COURS, { id: 4, published: true, updated_at: horodatage("2026-10-08") }] }).detail,
  "2 cours publiés modifiés du 05/10 au 20/10 (3 modifications)", "(b) un cours créé pendant la période ne s'ajoute pas aux autres");
// (c) Une version en double (même saved_at deux fois, ce que laisse une sauvegarde concurrente) ou égale à l'updated_at est
// comptée une fois.
eq(misesAJourDe(unCours(5, ["2026-09-01", "2026-10-06", "2026-10-06"], "2026-10-14")).detail,
  "1 cours publié modifié du 06/10 au 14/10 (2 modifications)", "(c) une version en double compte une fois");
eq(misesAJourDe(unCours(8, ["2026-09-01", "2026-10-14"], "2026-10-14")).detail,
  "1 cours publié modifié le 14/10 (1 modification)", "(c) une version qui porte la même date que l'updated_at compte une fois");
// (d) Créé avant, sauvegardé deux fois pendant : une version datée de la période et l'updated_at.
eq(misesAJourDe(unCours(6, ["2026-08-26", "2026-10-05"], "2026-10-12")).detail,
  "1 cours publié modifié du 05/10 au 12/10 (2 modifications)", "(d) créé avant, sauvegardé deux fois pendant : 2 modifications");
// Les horodatages sont distincts, pas les jours : deux sauvegardes le même jour sont deux modifications.
eq(misesAJourDe({ cours: [{ id: 12, published: true, updated_at: horodatage("2026-10-12", "15:00:00") }],
  versions: [{ cours_id: 12, saved_at: horodatage("2026-08-26") }, { cours_id: 12, saved_at: horodatage("2026-10-12", "09:00:00") }] }).detail,
  "1 cours publié modifié le 12/10 (2 modifications)", "deux sauvegardes le même jour : 2 modifications");
// Seules les modifications dans la période comptent, et la création n'en est jamais une, même dans la période.
eq(misesAJourDe(unCours(9, ["2026-10-08"], "2026-11-10")), AUCUNE_MODIFICATION,
  "créé pendant la période, modifié après : la création ne compte pas et la modification est hors période");
eq(misesAJourDe(unCours(10, ["2026-08-26"], "2026-09-10")), AUCUNE_MODIFICATION, "modifié avant la période seulement : non compté");
eq(misesAJourDe(unCours(13, ["2026-08-26", "2026-09-10"], "2026-10-12")).detail, "1 cours publié modifié le 12/10 (1 modification)",
  "une modification avant la période et une pendant : seule celle de la période compte");
// Un brouillon et un cours inconnu ne comptent pas.
eq(misesAJourDe(unCours(11, ["2026-08-26"], "2026-10-12", false)), AUCUNE_MODIFICATION, "un brouillon modifié pendant la période : non compté");
eq(misesAJourDe({ cours: [], versions: [{ cours_id: 99, saved_at: horodatage("2026-08-26") }, { cours_id: 99, saved_at: horodatage("2026-10-07") }] }),
  AUCUNE_MODIFICATION, "les versions d'un cours inconnu : non comptées");
// Plusieurs cours : chacun une fois, toutes les modifications (1 + 2 + 3).
eq(misesAJourDe({ cours: [1, 2, 3].map((id) => ({ id, published: true, updated_at: horodatage("2026-10-20") })),
  versions: [{ cours_id: 1, saved_at: horodatage("2026-08-26") },
    { cours_id: 2, saved_at: horodatage("2026-08-26") }, { cours_id: 2, saved_at: horodatage("2026-10-02") },
    { cours_id: 3, saved_at: horodatage("2026-08-26") }, { cours_id: 3, saved_at: horodatage("2026-10-02") }, { cours_id: 3, saved_at: horodatage("2026-10-09") }] }).detail,
  "3 cours publiés modifiés du 02/10 au 20/10 (6 modifications)", "trois cours, 1 + 2 + 3 modifications");
// Les nouveautés d'un seul jour.
// Les annonces de la nouvelle barre ne sont ni comptées ni citées tant qu'elle est éteinte (relecture finale, M4).
const avecNouvelleBarre = [...NOUVEAUTES, { ...NOUVEAUTE("n", "2026-10-10"), navigation: "nouvelle" }, { ...NOUVEAUTE("o", "2026-10-11"), navigation: "ancienne" }];
eq(piece(inventairePromo(D, REF, { ...OPTIONS, nouveautes: avecNouvelleBarre }), "innovations").detail, "3 nouveautés datées du 02/10 au 20/10", "une annonce « nouvelle » n'est pas comptée, une « ancienne » l'est");
eq(nouveautesCitables(avecNouvelleBarre).map((x) => x.id), ["a", "b", "c", "d", "e", "o"], "le filtre partagé écarte les seules annonces de la nouvelle barre");
eq(nouveautesCitables(null), [], "pas de liste, pas d'annonce");
eq(piece(inventairePromo(D, REF, { ...OPTIONS, nouveautes: [NOUVEAUTE("a", "2026-10-02")] }), "innovations").detail,
  "1 nouveauté datée le 02/10", "une nouveauté");
// Intervenants : seules les auto-écoles du lieu, ou seulement le planning.
eq(piece(avec({ planning: [] }), "intervenants").detail, "2 auto-écoles partenaires", "auto-écoles seules");
eq(piece(avec({ autoEcoles: [] }), "intervenants").detail, "3 formateurs, 1 intervenant extérieur, 2 bénévoles", "planning seul");
// Un formateur nommé deux fois (ou un « Autre » écrit autrement) ne compte qu'une fois.
eq(piece(avec({ autoEcoles: [], planning: [
  L(1, "2026-10-05", 0, "matin", { activite: "Voiture (conduite)", prof_ids: [1, 1], prof_autre: "Mme Durand", benevoles_ids: [10, 10] }),
  L(2, "2026-10-05", 1, "matin", { activite: "Voiture (conduite)", prof_ids: [1], prof_autre: " mme durand ", benevoles_ids: [10] }),
] }), "intervenants").detail, "1 formateur, 1 intervenant extérieur, 1 bénévole", "intervenants distincts");
// Une promo sans lieu n'a aucune auto-école, même parmi celles qui n'en ont pas non plus.
eq(piece(inventairePromo({ ...D, planning: [], autoEcoles: [...AUTO_ECOLES, { id: 5, actif: true, lieu_id: null }] }, REF,
  { ...OPTIONS, promo: { ...PROMO, lieu_id: null } }), "intervenants").presente, false, "promo sans lieu : aucune auto-école");

// =====================================================================================================
// Une autre promo, des lignes vides
// =====================================================================================================
// Les lignes de l'autre promo (09 : formateur 4, bénévole 12, intervenant « Autre ») ne comptent ni dans le déroulé,
// qui s'arrêterait au 07/12, ni parmi les intervenants.
ok(!piece(inv, "deroule").detail.includes("07/12"), "le déroulé s'arrête au 15/10 : la ligne du 07/12 est d'une autre promo");
const autrePromo = [L(1, "2026-10-05", 0, "matin", { activite: "Cours", prof_ids: [1], benevoles_ids: [10], promo_id: 1 })];
const horsPromo = inventairePromo({ ...D, planning: autrePromo, autoEcoles: [] }, REF, OPTIONS);
eq(piece(horsPromo, "deroule"), manquante("deroule", "aucune demi-journée renseignée au planning de cette promo"),
  "une entrée d'une autre promo n'est pas comptée");
eq(piece(horsPromo, "intervenants").presente, false, "ses formateurs et bénévoles non plus");
// Que des lignes vides : aucune demi-journée.
const videsSeules = inventairePromo({ ...D, planning: [L(1, "2026-10-05", 0, "matin"), L(2, "2026-10-05", 1, "aprem", { sujet: "  " })] },
  REF, OPTIONS);
eq(piece(videsSeules, "deroule").presente, false, "des lignes vides (ou d'espaces) ne font pas une demi-journée");
// Chaque champ qui « porte quelque chose » suffit.
[{ activite: "Cours" }, { sujet: "Feux" }, { prof_ids: [1] }, { prof_autre: "Mme Durand" }, { autonomie: true }]
  .forEach((extra) => eq(piece(inventairePromo({ ...D, planning: [L(1, "2026-10-05", 0, "matin", extra)] }, REF, OPTIONS), "deroule").detail,
    "1 demi-journée de formation le 05/10", `une ligne avec ${Object.keys(extra)[0]} compte`));

// La règle « effective » du planning (relecture finale, M3) : la base garde le sujet et les bénévoles d'une carte dont l'activité a
// changé, le planning les ignore ; le dossier fait de même.
const unSeul = (extra) => inventairePromo({ ...D, planning: [L(1, "2026-10-05", 0, "matin", extra)] }, REF, OPTIONS);
eq(piece(unSeul({ activite: "Autre", sujet: "Feux" }), "deroule").detail, "1 demi-journée de formation le 05/10", "un sujet sur « Autre » : la carte compte par son activité");
eq(piece(unSeul({ activite: "", sujet: "", sujet_2: "Vitesse" }), "deroule").presente, false, "un second sujet hors salle double ne fait pas une demi-journée");
eq(piece(unSeul({ activite: "Cours", sujet_2: "Vitesse", salle_double: true }), "deroule").detail, "1 demi-journée de formation le 05/10", "la carte compte par son activité");
eq(piece(unSeul({ activite: "Cours", benevoles_ids: [10] }), "intervenants").detail, "2 auto-écoles partenaires", "des bénévoles sur un Cours : le planning les ignore, l'inventaire aussi");
eq(piece(unSeul({ activite: "Voiture (conduite)", benevoles_ids: [10] }), "intervenants").detail, "1 bénévole, 2 auto-écoles partenaires", "des bénévoles sur une conduite comptent");
eq(piece(unSeul({ activite: "Cours", benevoles_ids: [10], prof_ids: [1] }), "intervenants").detail, "1 formateur, 2 auto-écoles partenaires", "le formateur d'une carte compte, ses bénévoles non");

// =====================================================================================================
// Jours désactivés du planning (R21) : vacances, pont, formation externe ; leurs cartes restent en base
// =====================================================================================================
// Une ligne pleine le vendredi 16/10 (semaine du 12/10) : formateur 5, intervenant « Autre » Mme Leroy, bénévole 13,
// groupe en autonomie. Sur un jour actif elle ajoute une 6e demi-journée (dates jusqu'au 16/10), un formateur, un
// intervenant « Autre » et un bénévole.
const LIGNE_PLEINE = L(10, "2026-10-12", 4, "aprem", {
  activite: "Voiture (conduite)", sujet: "Sortie", prof_ids: [5], prof_autre: "Mme Leroy", autonomie: true, benevoles_ids: [13],
});
const compte = (i) => [piece(i, "deroule").detail, piece(i, "intervenants").detail];
const planningDe = (joursOff) => compte(inventairePromo(
  { ...D, planning: [...PLANNING, LIGNE_PLEINE], ...(joursOff ? { joursOff } : {}) }, REF, OPTIONS));
const AVEC_LIGNE = ["6 demi-journées de formation du 05/10 au 16/10",
  "4 formateurs, 2 intervenants extérieurs, 3 bénévoles, 2 auto-écoles partenaires"];
const SANS_LIGNE = compte(inv);
eq(SANS_LIGNE, ["5 demi-journées de formation du 05/10 au 15/10", "3 formateurs, 1 intervenant extérieur, 2 bénévoles, 2 auto-écoles partenaires"],
  "le jeu principal, sans la ligne du 16/10");
eq(planningDe(undefined), AVEC_LIGNE, "joursOff absent : la ligne du 16/10 compte partout");
eq(planningDe([]), AVEC_LIGNE, "joursOff vide : la ligne du 16/10 compte partout");
eq(planningDe([{ semaine_lundi: "2026-10-12", day_index: 4 }]), SANS_LIGNE,
  "le 16/10 désactivé : la ligne pleine n'est comptée nulle part (demi-journées, dates, formateurs, « Autre », bénévoles)");
eq(planningDe([{ semaine_lundi: "2026-10-12", day_index: 4, label: "Pont", created_by_who: "admin", promo_id: 7 }]), SANS_LIGNE,
  "les autres champs d'une ligne de planning_jours_off n'y changent rien");
eq(planningDe([{ semaine_lundi: "2026-10-05", day_index: 4 }, { semaine_lundi: "2026-10-19", day_index: 4 }, { semaine_lundi: "2026-10-12", day_index: 0 }]),
  AVEC_LIGNE, "un autre jour (autre semaine, ou autre indice dans la même semaine) n'écarte pas la ligne du 16/10 : il faut les deux");
// Un jour désactivé écarte toute la journée, matin et après-midi : le lundi 05/10 porte trois lignes du jeu principal.
const lundiOff = inventairePromo({ ...D, joursOff: [{ semaine_lundi: "2026-10-05", day_index: 0 }] }, REF, OPTIONS);
eq(compte(lundiOff), ["3 demi-journées de formation du 07/10 au 15/10", "2 formateurs, 1 intervenant extérieur, 2 auto-écoles partenaires"],
  "lundi 05/10 désactivé : les 3 lignes du matin et de l'après-midi disparaissent, avec leurs formateurs 1 et 2 et leurs bénévoles");
// Un jeudi désactivé : la ligne du formateur 3 (seul son planning le cite) disparaît.
const jeudiOff = inventairePromo({ ...D, joursOff: [{ semaine_lundi: "2026-10-12", day_index: 3 }] }, REF, OPTIONS);
eq(compte(jeudiOff), ["4 demi-journées de formation du 05/10 au 13/10", "2 formateurs, 1 intervenant extérieur, 2 bénévoles, 2 auto-écoles partenaires"],
  "jeudi 15/10 désactivé : une demi-journée de moins, le formateur 3 aussi, et la date de fin recule au 13/10");
// Un jour désactivé incomplet (semaine ou indice illisible) n'écarte aucune ligne, pas même une ligne mal formée de même forme.
eq(piece(inventairePromo({ ...D, planning: [L(1, "pas une date", 1, "matin", { activite: "Cours", prof_ids: [7] })],
  joursOff: [{ semaine_lundi: "pas une date", day_index: 1 }, { semaine_lundi: null, day_index: 1 }] }, REF, OPTIONS), "intervenants").detail,
  "1 formateur, 2 auto-écoles partenaires", "un jour désactivé incomplet n'écarte aucune ligne");
// Tout le planning sur des jours désactivés : la pièce est absente avec sa raison.
const toutOff = inventairePromo({ ...D, joursOff: [
  { semaine_lundi: "2026-10-05", day_index: 0 }, { semaine_lundi: "2026-10-05", day_index: 2 },
  { semaine_lundi: "2026-10-12", day_index: 1 }, { semaine_lundi: "2026-10-12", day_index: 3 },
] }, REF, OPTIONS);
eq(piece(toutOff, "deroule"), manquante("deroule", "aucune demi-journée renseignée au planning de cette promo"), "tous les jours désactivés : plus de déroulé");
eq(piece(toutOff, "intervenants").detail, "2 auto-écoles partenaires", "tous les jours désactivés : il ne reste que les auto-écoles");

// =====================================================================================================
// La période : de la date de début à la date de fin (ou à aujourd'hui)
// =====================================================================================================
// Bornes comprises : une modification du jour du début ou du jour de la fin compte, celle de la veille ou du lendemain
// non. Cours 1 : créé le 26/08, modifié la veille du début puis le jour du début (son updated_at). Cours 2 : créé le
// 26/08, modifié le jour de la fin puis le lendemain de la fin (son updated_at).
const bornes = inventairePromo({ ...D, signalements: [],
  cours: [{ id: 1, published: true, updated_at: horodatage("2026-09-28", "08:00:00") },
    { id: 2, published: true, updated_at: horodatage("2026-10-24", "08:00:00") }],
  versions: [{ cours_id: 1, saved_at: horodatage("2026-08-26") }, { cours_id: 1, saved_at: horodatage("2026-09-27", "20:00:00") },
    { cours_id: 2, saved_at: horodatage("2026-08-26") }, { cours_id: 2, saved_at: horodatage("2026-10-23", "20:00:00") }],
}, REF, OPTIONS);
eq(piece(bornes, "misesAJour").detail, "2 cours publiés modifiés du 28/09 au 23/10 (2 modifications)", "bornes de la période comprises");
const bornesNouveautes = inventairePromo(D, REF, { ...OPTIONS, nouveautes: [
  { id: "x", date: "2026-09-27" }, { id: "y", date: "2026-09-28" }, { id: "z", date: "2026-10-23" }, { id: "w", date: "2026-10-24" },
] });
eq(piece(bornesNouveautes, "innovations").detail, "2 nouveautés datées du 28/09 au 23/10", "bornes comprises, nouveautés");

// Sans date de fin, la période court jusqu'à aujourd'hui (28/10) : le cours modifié le 27/10 compte, celui du 29/10 non.
const enCours = inventairePromo({ ...D, signalements: [],
  cours: [{ id: 1, published: true, updated_at: horodatage("2026-10-27") }, { id: 2, published: true, updated_at: horodatage("2026-10-29") }],
  versions: [{ cours_id: 1, saved_at: horodatage("2026-08-26") }, { cours_id: 2, saved_at: horodatage("2026-08-26") }],
}, REF, { ...OPTIONS, promo: { ...PROMO, date_fin: null } });
eq(piece(enCours, "misesAJour").detail, "1 cours publié modifié le 27/10 (1 modification)", "promo en cours : jusqu'à aujourd'hui");
eq(piece(enCours, "innovations").detail, "2 nouveautés datées du 02/10 au 20/10",
  "promo en cours : la nouveauté du 05/11, d'après aujourd'hui, est écartée");
const enCours2 = inventairePromo(D, REF, { ...OPTIONS, promo: { ...PROMO, date_fin: null }, aujourdhui: "2026-11-30" });
eq(piece(enCours2, "innovations").detail, "3 nouveautés datées du 02/10 au 05/11", "plus tard, la nouveauté du 05/11 compte aussi");

// Une promo qui n'a pas commencé : rien dans la période, et la même raison que pour toute autre promo (R24).
const future = { id: 9, lieu_id: 2, nom: "Promo future", date_debut: "2026-11-02", date_fin: null };
const avant = inventairePromo(D, REF, { ...OPTIONS, promo: future });
eq(piece(avant, "misesAJour").raison, "aucun cours publié modifié ni contestation de QCM traitée pendant la formation", "promo future : mises à jour");
eq(piece(avant, "innovations").raison, "aucune nouveauté datée pendant la formation", "promo future : innovations");

// =====================================================================================================
// Alternance et indicateurs non applicables
// =====================================================================================================
const court = (num) => INDICATEURS.find((x) => x.numero === num).court;
eq(inv.nonApplicables, [13, 14, 15, 20, 29, 33].map((num) => ({
  numero: num, court: court(num), raison: num === 13 ? "pas d'alternance déclarée" : "apprentissage seulement",
})), "non applicables : 14, 15, 20, 29, 33 (apprentissage seulement) et 13 sans alternance, triés");
ok(inv.nonApplicables.every((x) => !numeros(inv.indicateurs).includes(x.numero)), "un indicateur est applicable ou non, jamais les deux");

const alternance = inventairePromo(D, REF, { ...OPTIONS, alternance: true });
eq(numeros(alternance.indicateurs), LES_28, "28 indicateurs avec l'alternance");
eq(numeros(alternance.nonApplicables), [14, 15, 20, 29, 33], "plus de 13 parmi les non applicables avec l'alternance");
eq(alternance.nonApplicables.map((x) => x.raison), Array(5).fill("apprentissage seulement"), "raison des cinq autres");
eq(indic(alternance, 13), {
  numero: 13, critere: 3, court: court(13), niveau: "hors", apporte: "rien", pieces: [],
  aFournir: ["coordination avec l'entreprise"],
}, "13 : hors de l'app, à fournir par le centre");
eq(inventairePromo(D, REF, { ...OPTIONS, alternance: false }), inv, "alternance à faux = absence d'option");

// =====================================================================================================
// Promo vide, promo sans date de début, données mal formées : des raisons, jamais NaN ni undefined
// =====================================================================================================
const VIDE = { id: 9, lieu_id: 3, nom: "Promo vide", date_debut: "2026-09-01", date_fin: null };
const REF_VIDE = { qcm: [], themes: [] };
const TOUT_VIDE = { stagiaires: [], passages: [], evaluations: [], tentatives: [], epcf: [], planning: [], agenda: [], livrets: [],
  dossiers: [], signalements: [], cours: [], versions: [], joursOff: [], autoEcoles: [], profs: [], entete: {} };
[["aucune donnée", {}, REF_VIDE], ["tableaux vides", TOUT_VIDE, REF_VIDE], ["tableaux vides, QCM au référentiel", TOUT_VIDE, REF]]
  .forEach(([nom, donnees, referentiel]) => {
    const vide = inventairePromo(donnees, referentiel, { promo: VIDE, aujourdhui: AUJOURDHUI });
    eq(vide.indicateurs.length, 27, `promo vide (${nom}) : 27 indicateurs`);
    eq(toutes(vide).filter((p) => p.presente), [], `promo vide (${nom}) : aucune pièce présente`);
    ok(toutes(vide).every((p) => p.detail === null && typeof p.raison === "string" && p.raison.length > 0),
      `promo vide (${nom}) : chaque pièce absente a sa raison`);
    eq(problemes({ indicateurs: vide.indicateurs, nonApplicables: vide.nonApplicables }, "inventaire", []), [],
      `promo vide (${nom}) : ni NaN, ni undefined, ni Invalid`);
    eq(numeros(vide.nonApplicables), [13, 14, 15, 20, 29, 33], `promo vide (${nom}) : non applicables`);
  });

const sansDebut = inventairePromo(D, REF, { ...OPTIONS, promo: { ...PROMO, date_debut: null } });
eq(sansDebut.indicateurs.length, 27, "promo sans date de début : 27 indicateurs");
eq(problemes(sansDebut.indicateurs, "indicateurs", []), [], "promo sans date de début : ni NaN, ni undefined, ni Invalid");
const sansDates = inventairePromo(D, REF, { ...OPTIONS, promo: { ...PROMO, date_debut: null, date_fin: null } });
eq(problemes(sansDates.indicateurs, "indicateurs", []), [], "promo sans aucune date : ni NaN, ni undefined, ni Invalid");

// Lignes mal formées : écartées sans bruit, et ce qui reste se lit.
const CASSEES = {
  stagiaires: STAG,
  planning: [
    L(1, null, 0, "matin", { activite: "Cours" }), L(2, "2026-10-05", null, "matin", { activite: "Cours" }),
    L(3, "pas une date", 1, "matin", { activite: "Cours" }),
    L(4, "2026-10-05", 1, "matin", { activite: "Cours", prof_ids: null, benevoles_ids: null }),
  ],
  agenda: [
    { id: 1, type: "stage", title: "Sans début", date_start: null, date_end: "2026-11-01" },
    { id: 2, type: "stage", title: "Sans fin", date_start: "2026-11-02" },
  ],
  cours: [{ id: 1, published: true, updated_at: null }, { id: 2, published: true }],
  versions: [{ cours_id: 1, saved_at: null }, { cours_id: 2 }, { saved_at: "2026-10-10T10:00:00+00:00" }, { cours_id: 1, saved_at: "hier" }],
  joursOff: [{ semaine_lundi: null, day_index: 1 }, { semaine_lundi: "2026-10-05" }, { day_index: 1 }, {}],
  signalements: [{ id: 1, traite_at: "hier" }, { id: 2, traite_at: null }],
  dossiers: [{ stagiaire_id: 1, updated_at: null }],
  livrets: [{ stagiaire_id: 1 }],
};
const cassee = inventairePromo(CASSEES, REF, OPTIONS);
eq(piece(cassee, "deroule").detail, "1 demi-journée de formation le 06/10",
  "mal formé : la seule ligne datée du planning (des jours désactivés incomplets n'écartent rien)");
eq(piece(cassee, "datesCles").detail, "1 événement au calendrier (1 stage) le 02/11", "mal formé : l'événement daté");
eq(piece(cassee, "dossierPro").detail, "enregistré pour 1 stagiaire sur 2 en formation", "mal formé : dossier sans date");
eq(piece(cassee, "evaluations").detail, `1 livret EPCF ${POP} ; aucun résultat de jury saisi`, "mal formé : livret sans date");
eq(piece(cassee, "ressources").detail, "2 cours publiés, 3 QCM ; aucun QCM d'entraînement fait", "mal formé : cours sans date, comptés publiés");
eq(piece(cassee, "misesAJour").presente, false, "mal formé : ni version ni signalement datés");
eq(piece(cassee, "intervenants").presente, false, "mal formé : formateurs et bénévoles nuls");
eq(problemes({ indicateurs: cassee.indicateurs, nonApplicables: cassee.nonApplicables }, "inventaire", []), [],
  "mal formé : ni NaN, ni undefined, ni Invalid");

// =====================================================================================================
// Registre qualité (Q4) : indicateurs 31 et 32, des nombres et des dates, jamais un texte saisi
// =====================================================================================================
{
  eq(NIVEAUX[31], { niveau: "partiel", apporte: "contestations de QCM analysées puis tranchées, registre qualité", ajout: null, aFournir: ["procédure de réclamation"] },
    "31 : le registre qualité s'ajoute à l'apport, sans ajout à venir");
  eq(NIVEAUX[32], { niveau: "partiel", apporte: "comparaison des promos, thèmes les moins réussis, registre qualité", ajout: null, aFournir: ["plan d'amélioration"] },
    "32 : de même");
  const E = (id, extra) => ({ id, type: "reclamation", origine: "stagiaire", promo_id: null, lieu_id: null, description: "Texte libre secret " + id,
    date_constat: "2026-10-05", reponse: "Réponse secrète", date_reponse: null, action_decidee: "Action secrète", mesure_prevention: "Mesure secrète",
    etat: "ouvert", clos_le: null, efface_le: null, ...extra });
  const ENTREES = geler([
    E(1, { promo_id: 7, date_reponse: "2026-10-09", etat: "clos", clos_le: "2026-10-09T10:00:00Z" }),                    // délai 4
    E(2, { promo_id: 7, type: "alea", origine: "equipe", date_constat: "2026-12-01" }),                                    // rattachée à la promo : compte, quelle que soit sa date
    E(3, { type: "difficulte", origine: "formateur", date_constat: "2026-10-10", date_reponse: "2026-10-20", etat: "clos" }), // sans promo, dans la période : délai 10
    E(4, { type: "risque", date_constat: "2026-10-12", date_reponse: "2026-10-14", etat: "clos", efface_le: "2026-10-30T10:00:00Z",
      description: null, reponse: null, action_decidee: null, mesure_prevention: null }),                                   // effacée : compte, sans texte ; délai 2
    E(5, { lieu_id: 9, date_constat: "2026-10-06" }),                                                                       // autre lieu : écartée
    E(6, { date_constat: "2026-08-01" }),                                                                                   // sans promo, hors de la période
    E(7, { promo_id: 8 }),                                                                                                  // une autre promo
  ]);
  const registreDe = (registre) => piece(inventairePromo({ ...D, registre }, REF, OPTIONS), "registre");
  eq(registreDe({ etat: "lue", entrees: ENTREES }), {
    cle: "registre", libelle: "Registre qualité", presente: true, raison: null,
    detail: "4 entrées (1 réclamation, 1 difficulté, 1 aléa, 1 risque), dont 3 closes ; délai médian de réponse : 4 jours",
  }, "registre : le décompte par type, les closes (l'effacée comprise) et le délai médian (2, 4 et 10 jours)");
  eq(registreDe({ etat: "lue", entrees: [] }), manquante("registre", "aucune entrée au registre qualité pendant la formation"), "registre vide");
  eq(registreDe({ etat: "lue", entrees: [ENTREES[4], ENTREES[6]] }).presente, false, "registre : une entrée d'un autre lieu ou d'une autre promo ne compte pas");
  eq(registreDe({ etat: "absente" }), manquante("registre", "registre qualité pas encore en service"), "registre : la table n'existe pas encore");
  eq(registreDe({ etat: "non_lue" }), manquante("registre", "registre qualité non lu (erreur de lecture)"), "registre : lecture échouée");
  eq(piece(inventairePromo(D, REF, OPTIONS), "registre"), manquante("registre", "registre qualité non lu (erreur de lecture)"), "registre : aucune lecture faite, honnêtement non lu");
  eq(registreDe({ etat: "lue", entrees: [E(1, { promo_id: 7 })] }).detail, "1 entrée (1 réclamation), dont 0 close ; délai médian de réponse : aucune réponse datée",
    "registre : une entrée seule, sans réponse datée");
  eq(registreDe({ etat: "lue", entrees: [E(1, { promo_id: 7, date_reponse: "2026-10-06" }), E(2, { promo_id: 7, date_reponse: "2026-10-07" })] }).detail,
    "2 entrées (2 réclamations), dont 0 close ; délai médian de réponse : 1,5 jour", "registre : médiane décimale, au singulier sous 2");
  const jsonRegistre = JSON.stringify(inventairePromo({ ...D, registre: { etat: "lue", entrees: ENTREES } }, REF, OPTIONS));
  ["Texte libre secret", "Réponse secrète", "Action secrète", "Mesure secrète"].forEach((mot) =>
    ok(!jsonRegistre.includes(mot), `l'inventaire ne reprend aucun texte libre du registre (« ${mot} »)`));
}

// =====================================================================================================
// Raisons d'absence (R24) : des textes fixes, sans période ni nombre, les mêmes d'une promo à l'autre
// =====================================================================================================
// Les dossiers regroupent les raisons par texte entre plusieurs promos : une date ou un chiffre dans une raison les séparerait.
const raisonsDe = (i) => PIECES.map((p) => piece(i, p.cle)).filter((p) => !p.presente).map((p) => [p.cle, p.raison]);
const memesFiches = (promo) => raisonsDe(inventairePromo({ stagiaires: STAG }, REF, { promo, aujourdhui: AUJOURDHUI }));
const raisonsFixes = raisonsDe(fiches);
eq(raisonsFixes.map(([cle]) => cle), ["deroule", "datesCles", "assiduite", "passages", "evaluations", "dossierPro", "ressources",
  "misesAJour", "innovations", "intervenants", "suivi", "appreciations", "registre"], "treize pièces absentes sur une promo qui n'a que ses fiches");
[{ ...PROMO, date_debut: "2025-01-06", date_fin: "2025-06-27" }, { ...PROMO, date_fin: null }, { ...PROMO, date_debut: null },
  future, { ...PROMO, id: 12, lieu_id: 5 }].forEach((promo, k) =>
  eq(memesFiches(promo), raisonsFixes, `autre promo ou autre période (${k}) : les mêmes raisons, mot pour mot`));
[fiches, avant, horsPromo, videsSeules, cassee, sansDebut, sansDates].forEach((i, k) =>
  ok(raisonsDe(i).every(([, raison]) => !/\d/.test(raison)), `inventaire ${k} : aucune raison d'absence ne porte de chiffre`));

// =====================================================================================================
// Confidentialité, pureté, typographie
// =====================================================================================================
// L'inventaire ne porte que des nombres et des dates : il entre tel quel dans la version « sans aucun nom ».
const textes = [];
eq(problemes({ indicateurs: inv.indicateurs, nonApplicables: inv.nonApplicables }, "inventaire", textes), [],
  "inventaire de la promo de test : ni NaN, ni undefined, ni Invalid");
const lu = textes.join("\n");
["Anaïs", "Marchand", "Bastien", "Delmas", "Cédric", "Vidal", "Kevin", "Durand", "Dupont", "Roche", "Lopez", "Perrin",
  "Autre promo", "Nouveauté secrète", "Résumé", "Centre de test", "Titre de test"]
  .forEach((mot) => ok(!lu.includes(mot), `aucun « ${mot} » dans les phrases`));
ok(!/\bprofs?\b/i.test(lu), "« formateur », jamais « prof »");
ok(!lu.includes(TIRET_CADRATIN), "aucun tiret cadratin dans les phrases");

// L'inventaire est une valeur neuve à chaque appel : le modifier ne touche ni l'entrée ni NIVEAUX.
const neuf = inventairePromo(D, REF, OPTIONS);
eq(neuf, inv, "même entrée, même inventaire");
neuf.indicateurs[0].aFournir.push("intrus");
neuf.indicateurs[0].pieces.push("intrus");
eq(NIVEAUX[1].aFournir, ["site", "catalogue", "fiche formation"], "NIVEAUX n'est pas touché par un consommateur");
eq(inventairePromo(D, REF, OPTIONS), inv, "ni l'appel suivant");

// =====================================================================================================
// Le réalisé : ni l'avenir, ni les jours fériés, ni les lignes hors de la promo (relecture finale, I1)
// =====================================================================================================
// Chaque ligne ajoutée porte un formateur (77), un « Autre » et un bénévole (99) que le jeu principal ne cite pas :
// si elle compte quelque part, les demi-journées, les dates ou les intervenants changent.
const LIGNE_HORS = (id, semaine, jour) => L(id, semaine, jour, "matin", { activite: "Voiture (conduite)", prof_ids: [77], prof_autre: "Hors Promo", benevoles_ids: [99] });
const comptePlanning = (extra, promo, aujourdhui) => compte(inventairePromo({ ...D, planning: [...PLANNING, ...extra] }, REF,
  { promo, aujourdhui, nouveautes: NOUVEAUTES }));
const BASE_PLANNING = comptePlanning([], PROMO, "2026-10-28");
eq(BASE_PLANNING, SANS_LIGNE, "point de départ : le jeu principal");
const lignesHorsPromo = [
  [LIGNE_HORS(901, "2026-09-21", 0), "une ligne avant le début de la promo (lundi 21/09)"],
  [LIGNE_HORS(902, "2026-10-26", 0), "une ligne après la fin de la promo (lundi 26/10)"],
  [LIGNE_HORS(903, "2025-09-22", 1), "une ligne de l'année d'avant"],
];
lignesHorsPromo.forEach(([ligne, nom]) => eq(comptePlanning([ligne], PROMO, "2026-10-28"), BASE_PLANNING, `${nom} ne compte nulle part`));
// Bornes comprises : le premier et le dernier jour de la promo comptent.
const deuxBornes = comptePlanning([LIGNE_HORS(904, "2026-09-28", 0), LIGNE_HORS(905, "2026-10-19", 4)], PROMO, "2026-10-28");
eq(deuxBornes[0], "7 demi-journées de formation du 28/09 au 23/10", "les jours de début (28/09) et de fin (23/10) comptent");
eq(deuxBornes[1], "4 formateurs, 2 intervenants extérieurs, 3 bénévoles, 2 auto-écoles partenaires", "leurs intervenants aussi");
// Séance future : promo sans fin, aujourd'hui le 14/10 ; la séance du jeudi 15/10 est de demain.
const promoOuverte = { ...PROMO, date_fin: null };
const le14 = comptePlanning([], promoOuverte, "2026-10-14");
eq(le14[0], "4 demi-journées de formation du 05/10 au 13/10", "promo sans fin : rien après aujourd'hui (la séance du 15/10 est écartée)");
eq(comptePlanning([LIGNE_HORS(906, "2026-10-12", 2)], promoOuverte, "2026-10-14")[0], "5 demi-journées de formation du 05/10 au 14/10", "aujourd'hui compte");
eq(comptePlanning([LIGNE_HORS(907, "2026-10-12", 3)], promoOuverte, "2026-10-14"), le14, "demain ne compte pas, ni ses intervenants");
// Promo qui finit avant aujourd'hui : c'est la fin qui borne ; qui finit après : c'est aujourd'hui.
eq(comptePlanning([], { ...PROMO, date_fin: "2026-10-09" }, "2026-10-28")[0], "3 demi-journées de formation du 05/10 au 07/10", "fin avant aujourd'hui : la fin borne");
eq(comptePlanning([], { ...PROMO, date_fin: "2026-12-18" }, "2026-10-09")[0], "3 demi-journées de formation du 05/10 au 07/10", "fin après aujourd'hui : aujourd'hui borne");
// Promo sans début : pas de borne basse, jamais de NaN.
const sansDebutLigne = comptePlanning([LIGNE_HORS(908, "2026-09-21", 0)], { ...PROMO, date_debut: null }, "2026-10-28");
eq(sansDebutLigne[0], "6 demi-journées de formation du 21/09 au 15/10", "sans date de début, la ligne d'avant compte");
ok(![...sansDebutLigne, ...BASE_PLANNING, ...le14].some((t) => /NaN|undefined|null/.test(t)), "aucun NaN ni undefined");
// Aucune borne du tout (ni début, ni fin, ni date du jour) : rien n'est filtré par les dates.
const sansBorne = lignesDuPlanning({ planning: [...PLANNING, ...lignesHorsPromo.map(([l]) => l)] }, { ...PROMO, date_debut: null, date_fin: null }, null);
eq(sansBorne.length, PLANNING.length - 1 + lignesHorsPromo.length, "sans aucune borne : toutes les lignes de la promo (celle d'une autre promo reste écartée)");
// Jour férié : le mercredi 11/11 (Armistice) n'est jamais un jour de formation, même dans la période.
const ferie = comptePlanning([LIGNE_HORS(909, "2026-11-09", 2)], { ...PROMO, date_fin: "2026-12-18" }, "2026-12-15");
eq(ferie[0], "5 demi-journées de formation du 05/10 au 15/10", "le 11/11 (jour férié) ne compte pas");
eq(ferie[1], SANS_LIGNE[1], "ni ses intervenants");
eq(comptePlanning([LIGNE_HORS(910, "2026-10-26", 0)], { ...PROMO, date_fin: "2026-12-18" }, "2026-12-15")[0],
  "6 demi-journées de formation du 05/10 au 26/10", "un jour ordinaire de la même période compte");
// Le test des sommes reste vrai : les formateurs distincts sont ceux de la plage retenue.
eq(piece(inventairePromo({ ...D, planning: [...PLANNING, ...lignesHorsPromo.map(([l]) => l)] }, REF, OPTIONS), "intervenants").detail,
  SANS_LIGNE[1], "les intervenants des lignes écartées ne s'ajoutent pas");

const source = readFileSync(new URL("../js/qualiopi-preuves.js", import.meta.url), "utf8");
ok(!source.includes(TIRET_CADRATIN), "aucun tiret cadratin dans le module");
const ceTest = readFileSync(new URL(import.meta.url), "utf8");
ok(!ceTest.includes(TIRET_CADRATIN), "aucun tiret cadratin dans ce test");

console.log(`qualiopi-preuves : ${n} assertions OK`);
