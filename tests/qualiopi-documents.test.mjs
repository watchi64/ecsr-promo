// Modèles des dossiers Qualiopi et export CSV de l'inventaire (spec 2026-10-28, § 6.4, 6.5 et 6.8). Jeu fait à la main :
// celui de tests/qualiopi-preuves.test.mjs, enrichi d'un stagiaire « Kevin » (le sujet de séance « Révision avec Kevin »
// y figurait déjà), d'une seconde promo (en cours), d'un jour désactivé, et de noms de bénévoles et d'auto-écoles que la
// base ne livre pas mais que les documents ne doivent jamais recopier. Attendus recalculés à la main dans les
// commentaires : un écart vient du module, pas du test.
// Lancer depuis la racine du dépôt : node tests/qualiopi-documents.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PHRASE_DE_GARDE, LIBELLES_NIVEAU, promoTerminee, modeleDossierFormation, modeleDossierCentre, inventaireCsv, PHRASE_NIVEAU, COLONNE_NIVEAU,
  nomFichierQualiopi,
} from "../js/qualiopi-documents.js";
import { inventairePromo, lignesDuPlanning, demiJournees, intervenantsDistincts } from "../js/qualiopi-preuves.js";
import { INDICATEURS } from "../js/qualiopi-referentiel.js";
import { indicateursPromo, ligneComparaison, METHODES } from "../js/centre-stats.js";
import { slug } from "../js/centre-csv.js";
import { NOUVEAUTES as NOUVEAUTES_REELLES } from "../js/nouveautes-data.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (v, msg) => { assert.ok(v, msg); n++; };

const plage = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const numeros = (liste) => liste.map((x) => x.numero);
const TIRET_CADRATIN = String.fromCharCode(0x2014);
const BOM = String.fromCharCode(0xfeff);
// Le tableau de bord écrit « 25 % » avec une espace insécable avant le pourcentage ; les dossiers font de même.
const pc = (valeur) => `${valeur}${String.fromCharCode(0xa0)}%`;
// Les 27 indicateurs d'un centre de formation continue, plus le 13 de l'alternance.
const LES_28 = [...plage(1, 13), ...plage(16, 19), ...plage(21, 28), 30, 31, 32];
const LES_27 = LES_28.filter((num) => num !== 13);
const HORS = [1, 4, 8, 21, 22, 24, 26, 27];
const court = (num) => INDICATEURS.find((x) => x.numero === num).court;

// Gèle récursivement : si un module modifiait une entrée, la modification lèverait une erreur.
function geler(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(geler); }
  return v;
}
// Toutes les chaînes d'une valeur, dans l'ordre.
function chaines(v, sortie = []) {
  if (typeof v === "string") sortie.push(v);
  else if (Array.isArray(v)) v.forEach((x) => chaines(x, sortie));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => chaines(x, sortie));
  return sortie;
}
// Les endroits où une valeur porte un NaN, un undefined, un null, une date invalide ou une trace de ces valeurs dans
// une phrase (liste vide si tout est propre).
function problemes(v, chemin = "modele") {
  if (v === undefined) return [`${chemin} vaut undefined`];
  if (v === null) return [`${chemin} vaut null`];
  if (typeof v === "number") return Number.isNaN(v) ? [`${chemin} vaut NaN`] : [];
  if (typeof v === "string") return /NaN|undefined|Invalid|\bnull\b|\[object/.test(v) ? [`${chemin} contient « ${v} »`] : [];
  if (Array.isArray(v)) return v.flatMap((x, i) => problemes(x, `${chemin}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => problemes(x, `${chemin}.${k}`));
  return [];
}
const section = (m, id) => m.sections.find((s) => s.id === id);
const lignesDe = (m, id, k = 0) => section(m, id).tableaux[k].lignes;
const entetesDe = (m, id, k = 0) => section(m, id).tableaux[k].entetes;

// Lecture d'un CSV au format de l'app (point-virgule, guillemets doublés, CRLF), sans le BOM.
function lireCsv(texte) {
  const lignes = [];
  let ligne = [];
  let cellule = "";
  let cite = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (cite) {
      if (c !== '"') cellule += c;
      else if (texte[i + 1] === '"') { cellule += '"'; i++; } else cite = false;
    } else if (c === '"') cite = true;
    else if (c === ";") { ligne.push(cellule); cellule = ""; }
    else if (c === "\r" && texte[i + 1] === "\n") { ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = ""; i++; }
    else cellule += c;
  }
  if (cellule !== "" || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
  return lignes;
}

// =====================================================================================================
// promoTerminee (R14) : date de fin renseignée et strictement passée
// =====================================================================================================
const AUJOURDHUI = "2026-10-28";
eq(promoTerminee({ date_fin: null }, AUJOURDHUI), false, "sans date de fin : en cours");
eq(promoTerminee({}, AUJOURDHUI), false, "date de fin absente : en cours");
eq(promoTerminee({ date_fin: "2026-10-27" }, AUJOURDHUI), true, "fin la veille : terminée");
eq(promoTerminee({ date_fin: "2026-10-28" }, AUJOURDHUI), false, "fin aujourd'hui : pas terminée (strictement antérieure)");
eq(promoTerminee({ date_fin: "2026-10-29" }, AUJOURDHUI), false, "fin demain : en cours");
eq(promoTerminee({ date_fin: "2025-06-27" }, AUJOURDHUI), true, "fin l'an dernier : terminée");
eq(promoTerminee({ date_fin: "2026-10-27T10:00:00+00:00" }, AUJOURDHUI), true, "un horodatage compte par son jour");
eq(promoTerminee({ date_fin: "hier" }, AUJOURDHUI), false, "date de fin illisible : en cours");
eq(promoTerminee({ date_fin: "2026-10-27" }, "demain"), false, "aujourd'hui illisible : jamais terminée");
eq(promoTerminee({ date_fin: "2026-10-27" }, undefined), false, "aujourd'hui absent : jamais terminée");
eq(promoTerminee(null, AUJOURDHUI), false, "pas de promo : en cours");

// =====================================================================================================
// Nom de fichier
// =====================================================================================================
eq(nomFichierQualiopi("formation", "Montpellier", "2026-10-28"), "qualiopi-formation-montpellier-2026-10-28.csv", "l'exemple du brief");
eq(nomFichierQualiopi("centre-sans-noms", "Nîmes, mars 2026", "2026-10-28"), "qualiopi-centre-sans-noms-nimes-mars-2026-2026-10-28.csv",
  "sans accents, ponctuation en tirets");
eq(nomFichierQualiopi("formation", "Démonstration (données fictives)", "2026-10-28"),
  "qualiopi-formation-demonstration-donnees-fictives-2026-10-28.csv", "parenthèses et accents");
eq(nomFichierQualiopi("formation", null, "2026-10-28"), "qualiopi-formation-promo-2026-10-28.csv", "promo sans nom");
eq(nomFichierQualiopi("formation", "!!!", "2026-10-28"), "qualiopi-formation-promo-2026-10-28.csv", "nom sans aucun caractère utilisable");
eq(nomFichierQualiopi("formation", "Montpellier", "pas une date"), "qualiopi-formation-montpellier-sans-date.csv", "date illisible");
eq(slug("  Été 2026 / Béziers  "), "ete-2026-beziers", "slug partagé avec nomFichierCsv");

// =====================================================================================================
// Jeu de données : promo 7 (terminée), le jeu de la tâche 2 enrichi
// =====================================================================================================
const PROMO = geler({ id: 7, lieu_id: 2, nom: "Promo de test", date_debut: "2026-09-28", date_fin: "2026-10-23" });
const EN_COURS = geler({ id: 8, lieu_id: 2, nom: "Promo en cours", date_debut: "2026-10-12", date_fin: null });
const LIEU = "Montpellier";
const PERIODE = { du: "2025-10-29", au: "2026-10-28" };

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

// Anaïs (1), Bastien (2) et Kevin (4) sont en formation, Cédric (3) a abandonné : rien de lui ne compte.
const STAG = [
  { id: 1, prenom: "Anaïs", nom: "Marchand", actif: true, ordre: 1, anonymise_le: null },
  { id: 2, prenom: "Bastien", nom: "Delmas", actif: true, ordre: 2, anonymise_le: null },
  { id: 3, prenom: "Cédric", nom: "Vidal", actif: false, ordre: 3, anonymise_le: null },
  { id: 4, prenom: "Kevin", nom: "Lambert", actif: true, ordre: 4, anonymise_le: null },
];

// Passages des stagiaires en formation (salle ou voiture faite, remplacement compris ; absences de dernière minute) :
//   Anaïs 1 salle, 1 voiture, 0 absence ; Bastien 2 salle (une faite, un remplacement), 0 voiture, 2 absences (une en
//   salle, une en voiture) ; Kevin 0 salle, 2 voiture (une faite, un remplacement), 0 absence.
// Totaux : 3 en salle, 3 en voiture, 2 absences. Cédric (abandon) est ignoré.
let idPassage = 0;
const P = (stagiaire_id, type, resultat, date) => ({ id: ++idPassage, stagiaire_id, type, resultat, date });
const PASSAGES = [
  P(1, "Salle", "Effectué", "2026-10-06"), P(1, "Voiture", "Effectué", "2026-10-07"),
  P(2, "Salle", "Effectué", "2026-10-06"), P(2, "Salle", "Bonus", "2026-10-08"),
  P(2, "Salle", "Absence", "2026-10-09"), P(2, "Voiture", "Absence", "2026-10-13"),
  P(3, "Salle", "Effectué", "2026-10-06"),
  P(4, "Voiture", "Effectué", "2026-10-14"), P(4, "Voiture", "Bonus", "2026-10-15"),
];

// Notes comptées : Anaïs 12 et 14, Bastien 8 et 10, Kevin 15 (toutes sur 20) : 5 notes, moyenne 59 / 5 = 11,8.
// Écartées : celle de l'abandon, une sans note, une sans barème.
let idNote = 0;
const E = (stagiaire_id, type, num, note, note_max, date_eval) =>
  ({ id: ++idNote, stagiaire_id, type, theme_numero: type === "Thème" ? num : null,
     competence_code: type === "Compétence" ? num : null, controle_libelle: null, note, note_max, date_eval });
const EVALS = [
  E(1, "Thème", 1, 12, 20, "2026-10-06"), E(2, "Thème", 1, 8, 20, "2026-10-08"),
  E(1, "Thème", 1, 14, 20, "2026-10-09"), E(2, "Thème", 1, 10, 20, "2026-10-13"),
  E(3, "Thème", 1, 18, 20, "2026-09-30"),
  E(1, "Thème", 2, null, 20, "2026-10-20"),
  E(2, "Thème", 2, 5, 0, "2026-10-21"),
  E(4, "Thème", 2, 15, 20, "2026-10-14"),
];

// QCM. Entraînements en formation : Anaïs 2 (20 puis 10 questions, 15 puis 7 bonnes), Bastien 1 (10 questions, 6 bonnes) :
// 40 questions, 28 bonnes, 70 %. Examens en formation : Anaïs 16 sur 20 et Bastien 12 sur 20, au QCM 10 dont le seuil
// est 15 : 1 réussi sur 2. Thèmes classés d'après les QCM : Feux 20 questions (75 %), Vitesse 10 + 10 (65 %).
let idTentative = 0;
const T = (stagiaire_id, qcm_id, mode, score, total, note_20, jour) =>
  ({ id: ++idTentative, qcm_id, stagiaire_id, mode, score, total, note_20, finished_at: jour + "T10:00:00+00:00" });
const TENTATIVES = [
  T(1, 10, "entrainement", 15, 20, 15, "2026-10-20"), T(1, 11, "entrainement", 7, 10, 14, "2026-10-12"),
  T(2, 11, "entrainement", 6, 10, 12, "2026-10-10"), T(3, 12, "entrainement", 9, 10, 18, "2026-10-12"),
  T(1, 10, "examen", 16, 20, 16, "2026-10-14"), T(2, 10, "examen", 12, 20, 12, "2026-10-15"),
  T(3, 10, "examen", 20, 20, 20, "2026-10-14"),
];

// EPCF. Dernière évaluation hors auto-évaluation : Anaïs en salle le 14/10 (A, R), Kevin en véhicule le 16/10 (A, A, NA).
// Écartées : une auto-évaluation de Bastien, une évaluation de Bastien hors contexte EPCF, une évaluation de l'abandon.
// Critères : 3 acquis sur 5 renseignés, 60 %.
const X = (id, stagiaire_id, trame, date_eval, scores, extra = {}) =>
  ({ id, stagiaire_id, trame, contexte: "EPCF", auto_eval: false, date_eval, scores, ...extra });
const EPCF = [
  X(1, 1, "salle", "2026-10-06", { a: "NA", b: "R" }),
  X(2, 1, "salle", "2026-10-09", { a: "R", b: "R" }),
  X(3, 1, "salle", "2026-10-14", { a: "A", b: "R" }),
  X(4, 2, "vehicule", "2026-10-14", { x: "A" }, { auto_eval: true }),
  X(5, 2, "vehicule", "2026-10-08", { x: "A" }, { contexte: "Entraînement" }),
  X(6, 3, "salle", "2026-10-05", { a: "A" }),
  X(7, 4, "vehicule", "2026-10-16", { a: "A", b: "A", c: "NA" }),
];

// Planning de la promo 7 (lundis 05/10, 12/10 et 19/10). Demi-journées : 05/10 matin, 05/10 après-midi, 07/10 matin
// (semaine du 05/10 : 3), 13/10 après-midi (groupe en autonomie), 15/10 matin (semaine du 12/10 : 2) : 5 en tout. Le
// 21/10 est un jour désactivé : sa ligne (formateur 4, bénévole 12) ne compte nulle part. La dernière ligne est d'une
// autre promo.
const L = (id, semaine_lundi, day_index, half_day, extra = {}) => ({
  id, semaine_lundi, day_index, half_day, activite: "", sujet: "", sujet_2: "", prof_ids: [], prof_autre: null,
  autonomie: false, benevoles_ids: [], promo_id: 7, ...extra,
});
const PLANNING = [
  L(1, "2026-10-05", 0, "matin", { activite: "Cours", sujet: "Révision avec Kevin", prof_ids: [1] }),
  L(2, "2026-10-05", 0, "matin", { activite: "Pédagogie salle", prof_ids: [2] }),
  L(3, "2026-10-05", 0, "aprem", { activite: "Voiture (conduite)", prof_ids: [1], benevoles_ids: [10, 11] }),
  L(4, "2026-10-05", 2, "matin", { activite: "Cours", prof_autre: "Mme Durand" }),
  L(5, "2026-10-05", 4, "aprem"),
  L(6, "2026-10-12", 1, "aprem", { autonomie: true }),
  L(7, "2026-10-12", 3, "matin", { activite: "Contrôle", prof_ids: [1, 3] }),
  L(8, "2026-10-12", 4, "matin"),
  L(9, "2026-12-07", 0, "matin", { activite: "Cours", prof_ids: [4], benevoles_ids: [12], prof_autre: "Autre promo", promo_id: 1 }),
  L(10, "2026-10-19", 2, "matin", { activite: "Cours", sujet: "Séance du jour désactivé", prof_ids: [4], benevoles_ids: [12] }),
];
const JOURS_OFF = [{ semaine_lundi: "2026-10-19", day_index: 2 }];
// Les noms d'auto-écoles et de bénévoles ne sont pas dans les données lues en base : ils sont ajoutés ici pour prouver
// que les documents ne les recopient jamais, même si une lecture future les apportait.
const AUTO_ECOLES = [
  { id: 1, actif: true, lieu_id: 2, nom: "Auto-école Soleil" }, { id: 2, actif: true, lieu_id: 2, nom: "Auto-école Étoile" },
  { id: 3, actif: false, lieu_id: 2, nom: "Auto-école Fermée" }, { id: 4, actif: true, lieu_id: 3, nom: "Auto-école Lointaine" },
];
const BENEVOLES = [{ id: 10, nom: "Jeanne Bénévole" }, { id: 11, nom: "Paul Bénévole" }, { id: 12, nom: "Rose Fantôme" }];
const PROFS = [
  { id: 1, nom: "Nadia Roche" }, { id: 2, nom: "Karim Lopez" }, { id: 3, nom: "Hugo Perrin" }, { id: 4, nom: "Zoé Fantôme" },
];
// Calendrier : formation du 28/09 au 18/12, stage du 02/11 au 27/11, examen le 15/12 ; un férié ne compte pas.
const AGENDA = [
  { id: 1, type: "formation", title: "Formation chez Mme Dupont", date_start: "2026-09-28", date_end: "2026-12-18" },
  { id: 2, type: "stage", title: "Stage Dupont", date_start: "2026-11-02", date_end: "2026-11-27" },
  { id: 3, type: "examen", title: "Examen", date_start: "2026-12-15", date_end: null },
  { id: 4, type: "ferie", title: "Toussaint", date_start: "2026-11-01", date_end: null },
];
// Un livret (Anaïs, le 15/10) et un dossier professionnel (Bastien, le 10/10) en formation ; ceux de l'abandon sont écartés.
const LIVRETS = [
  { stagiaire_id: 1, updated_at: "2026-10-15T09:00:00+00:00" }, { stagiaire_id: 3, updated_at: "2026-10-01T09:00:00+00:00" },
];
const DOSSIERS = [
  { stagiaire_id: 2, updated_at: "2026-10-10T08:00:00+00:00" }, { stagiaire_id: 3, updated_at: "2026-10-12T08:00:00+00:00" },
];
// Signalements de QCM : un traité le 12/10 (déposé le 01/10, soit 11 jours), un encore ouvert.
const SIGNALEMENTS = [
  { id: 1, stagiaire_id: 1, statut: "tranché", created_at: "2026-10-01T10:00:00+00:00", traite_at: "2026-10-12T09:00:00+00:00" },
  { id: 2, stagiaire_id: 2, statut: "ouvert", created_at: "2026-10-15T10:00:00+00:00", traite_at: null },
];
// Cours : 2 publiés et 1 brouillon ; 2 cours publiés modifiés du 05/10 au 20/10 (3 modifications), voir le test de la tâche 2.
const COURS = [
  { id: 1, published: true, updated_at: "2026-10-12T15:00:00+00:00" },
  { id: 2, published: true, updated_at: "2026-10-20T09:00:00+00:00" },
  { id: 3, published: false, updated_at: "2026-10-06T10:00:00+00:00" },
];
const VERSIONS = [
  { cours_id: 1, saved_at: "2026-08-26T10:00:00+00:00" }, { cours_id: 1, saved_at: "2026-10-05T10:00:00+00:00" },
  { cours_id: 2, saved_at: "2026-08-26T10:00:00+00:00" },
  { cours_id: 3, saved_at: "2026-08-26T10:00:00+00:00" }, { cours_id: 99, saved_at: "2026-10-07T10:00:00+00:00" },
];
// Annonces datées de la rubrique Nouveautés : seuls le titre et la date entrent dans le dossier du centre (le titre cité entre
// guillemets), jamais le résumé. Le titre de la deuxième est à la deuxième personne, comme beaucoup de ceux de la rubrique réelle.
const TITRE_A_TOI = "Tes notes et ta fiche mieux protégées";
const NOUVEAUTE = (id, date, titre = "Nouveauté publique " + id) =>
  ({ id, ...(date ? { date } : {}), pour: "formateurs", titre, resume: "Résumé secret " + id });
const NOUVEAUTES = geler([
  NOUVEAUTE("a", "2026-09-15"), NOUVEAUTE("b", "2026-10-02", TITRE_A_TOI), NOUVEAUTE("c", "2026-10-20"),
  NOUVEAUTE("d", "2026-11-05"), NOUVEAUTE("e", null),
]);

const D = geler({
  stagiaires: STAG, passages: PASSAGES, evaluations: EVALS, tentatives: TENTATIVES, epcf: EPCF,
  planning: PLANNING, joursOff: JOURS_OFF, agenda: AGENDA, livrets: LIVRETS, dossiers: DOSSIERS, signalements: SIGNALEMENTS,
  cours: COURS, versions: VERSIONS, autoEcoles: AUTO_ECOLES, profs: PROFS, benevoles: BENEVOLES,
  entete: { organisme: "Centre de test", intitule: "Titre de test" },
});

// Promo 8, en cours (sans date de fin), du même lieu : Léa et Yanis en formation. Passages : Léa 1 salle ; Yanis 1 absence
// en salle. Une note de Léa (14 sur 20). Planning : deux demi-journées, le lundi 12/10 au matin (formateur 2) et le mardi
// 13/10 au matin (formateurs 2 et 3). Aucun événement au calendrier, aucun dossier : des pièces absentes pour cette promo seule.
const STAG_8 = [
  { id: 21, prenom: "Léa", nom: "Garnier", actif: true, ordre: 1, anonymise_le: null },
  { id: 22, prenom: "Yanis", nom: "Reynaud", actif: true, ordre: 2, anonymise_le: null },
];
const D8 = geler({
  stagiaires: STAG_8,
  passages: [P(21, "Salle", "Effectué", "2026-10-14"), P(22, "Salle", "Absence", "2026-10-15")],
  evaluations: [E(21, "Thème", 1, 14, 20, "2026-10-16")],
  tentatives: [], epcf: [],
  planning: [
    L(20, "2026-10-12", 0, "matin", { activite: "Cours", sujet: "Révision avec Léa", prof_ids: [2], promo_id: 8 }),
    L(21, "2026-10-12", 1, "matin", { activite: "Cours", prof_ids: [2, 3], promo_id: 8 }),
  ],
  joursOff: [], agenda: [], livrets: [], dossiers: [], signalements: [],
  cours: COURS, versions: VERSIONS, autoEcoles: AUTO_ECOLES, profs: PROFS, benevoles: BENEVOLES,
  entete: { organisme: "Centre de test", intitule: "Titre de test" },
});

const invDe = (donnees, promo, extra = {}) =>
  geler(inventairePromo(donnees, REF, { promo, aujourdhui: AUJOURDHUI, nouveautes: NOUVEAUTES, ...extra }));
const indDe = (donnees, referentiel = REF) => geler(indicateursPromo(donnees, referentiel, { aujourdhui: AUJOURDHUI }));
const inv = invDe(D, PROMO);
const ind = indDe(D);
const inv8 = invDe(D8, EN_COURS);
const ind8 = indDe(D8);

// Les chiffres que le dossier reprend sont ceux du tableau de bord.
eq([ind.notes.detail.n, ind.passages.detail.salle.total, ind.passages.detail.voiture.total, ind.absences.detail.absences],
  [5, 3, 3, 2], "le tableau de bord compte 5 notes, 3 passages en salle, 3 en voiture et 2 absences");

// Les aides du planning que l'inventaire exporte (js/qualiopi-preuves.js) et que les dossiers consomment : les dossiers n'en
// gardent aucune copie, la règle des demi-journées et des intervenants est donc la même des deux côtés.
const lignesPromo = lignesDuPlanning(D, PROMO);
eq(lignesPromo.map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8], "lignes de la promo 7 : ni l'autre promo (ligne 9) ni le jour désactivé (ligne 10)");
eq(lignesDuPlanning({ planning: PLANNING }, PROMO).map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8, 10], "sans jour désactivé lu, la ligne du 21/10 compte");
eq(lignesDuPlanning({}, PROMO), [], "sans planning : aucune ligne");
const demis = demiJournees(lignesPromo);
eq([...demis.keys()], ["2026-10-05|0|matin", "2026-10-05|0|aprem", "2026-10-05|2|matin", "2026-10-12|1|aprem", "2026-10-12|3|matin"],
  "demi-journées : une clé par (semaine, jour, demi-journée), les lignes vides écartées");
eq([...demis.values()].map((lignes) => lignes.map((e) => e.id)), [[1, 2], [3], [4], [6], [7]], "demi-journées : les lignes de chacune");
eq(demiJournees([L(1, "pas une date", 0, "matin", { activite: "Cours" }), L(2, "2026-10-05", null, "matin", { activite: "Cours" })]).size, 0,
  "demi-journées : une ligne au jour illisible n'en fait pas partie");
const distincts = intervenantsDistincts(lignesPromo);
eq([[...distincts.formateurs].sort(), [...distincts.benevoles].sort(), distincts.exterieurs], [[1, 2, 3], [10, 11], 1],
  "intervenants distincts de la promo 7 : formateurs 1, 2 et 3, bénévoles 10 et 11, un seul « Autre »");
eq(intervenantsDistincts([
  L(1, "2026-10-05", 0, "matin", { prof_autre: "Mme Durand", prof_ids: [1, null], benevoles_ids: [10, null] }),
  L(2, "2026-10-05", 1, "matin", { prof_autre: " mme durand ", prof_ids: null, benevoles_ids: null }),
]), { formateurs: new Set([1]), benevoles: new Set([10]), exterieurs: 1 },
"intervenants distincts : un « Autre » écrit autrement compte une fois, les identifiants nuls et les listes nulles sont écartés");

const formation = (extra = {}) => modeleDossierFormation({
  inv, donnees: D, ind, promo: PROMO, lieu: LIEU, intitule: D.entete.intitule, aujourdhui: AUJOURDHUI, ...extra,
});
const LES_PROMOS = [{ promo: PROMO, inv, ind, donnees: D }, { promo: EN_COURS, inv: inv8, ind: ind8, donnees: D8 }];
const centre = (extra = {}) => modeleDossierCentre({
  promos: LES_PROMOS, lieu: LIEU, periode: PERIODE, aujourdhui: AUJOURDHUI, sansNoms: false, nouveautes: NOUVEAUTES, ...extra,
});

// Forme commune des deux modèles : la vue les met en page sans rien calculer.
function formeBien(m, nom) {
  eq(Object.keys(m).sort(), ["aFournir", "garde", "sections", "sommaire", "sousTitre", "titre"], `${nom} : clés`);
  ok(typeof m.titre === "string" && m.titre !== "" && typeof m.sousTitre === "string" && m.sousTitre !== "", `${nom} : titre et sous-titre`);
  ok(Array.isArray(m.garde) && m.garde.length > 0 && m.garde.every((l) => typeof l === "string" && l !== ""), `${nom} : lignes de garde`);
  m.sections.forEach((s) => {
    eq(Object.keys(s).sort(), ["id", "indicateurs", "paragraphes", "tableaux", "titre"], `${nom}/${s.id} : clés`);
    ok(typeof s.titre === "string" && s.titre !== "", `${nom}/${s.id} : titre`);
    ok(s.indicateurs.every((x, k) => Number.isInteger(x) && (k === 0 || x > s.indicateurs[k - 1])), `${nom}/${s.id} : numéros croissants`);
    ok(s.paragraphes.every((p) => typeof p === "string" && p !== "" && p === p.trim()), `${nom}/${s.id} : paragraphes`);
    s.tableaux.forEach((t, k) => {
      eq(Object.keys(t).sort(), ["entetes", "lignes"], `${nom}/${s.id}/${k} : clés du tableau`);
      ok(t.lignes.length > 0, `${nom}/${s.id}/${k} : jamais de tableau vide`);
      t.lignes.forEach((l, r) => {
        eq(l.length, t.entetes.length, `${nom}/${s.id}/${k}/${r} : autant de cellules que d'en-têtes`);
        ok(l.every((c) => typeof c === "string" && c !== ""), `${nom}/${s.id}/${k}/${r} : aucune cellule vide`);
      });
    });
  });
  eq(m.sommaire.map((e) => Object.keys(e).sort()), m.sommaire.map(() => ["court", "numero", "section"]), `${nom} : clés du sommaire`);
  m.aFournir.forEach((a) => {
    eq(Object.keys(a).sort(), ["court", "items", "numero"], `${nom}/${a.numero} : clés des pièces à fournir`);
    ok(a.items.length > 0 && a.items.every((s) => typeof s === "string" && s !== ""), `${nom}/${a.numero} : des pièces à fournir`);
  });
  // Le seul null permis est la section d'un indicateur hors de l'app dans le sommaire.
  const sansSectionNulle = { ...m, sommaire: m.sommaire.map((e) => ({ ...e, section: e.section ?? "hors de l'app" })) };
  eq(problemes(sansSectionNulle, nom), [], `${nom} : ni NaN, ni undefined, ni null, ni Invalid`);
}

// =====================================================================================================
// Dossier de la formation : page de garde, sommaire, sections
// =====================================================================================================
const f = formation();
formeBien(f, "formation");
eq(PHRASE_DE_GARDE, "Pièces issues de l'application ECSR Promo, à joindre au dossier qualité du centre. Le centre reste seul audité et certifié.",
  "la phrase de garde du § 6.4, mot pour mot");
eq(f.titre, "Dossier de la formation", "titre");
eq(f.sousTitre, "Montpellier, Promo de test", "sous-titre : le centre et la promo");
eq(f.garde, [
  "Centre : Montpellier",
  "Promo : Promo de test",
  "Dates : du 28/09/2026 au 23/10/2026",
  "Formation : Titre de test",
  "État de la promo : terminée",
  "Référentiel appliqué : Décret n° 2026-728 du 1er août 2026 (référentiel national qualité), en vigueur le 01/11/2026, catégorie « action de formation »",
  PHRASE_NIVEAU,
  "Édité le 28/10/2026",
  PHRASE_DE_GARDE,
], "page de garde : centre, promo, dates, intitulé, état, référentiel, légende du niveau, édition, phrase (en dernier)");
eq(PHRASE_NIVEAU, "Le niveau dit ce que l'application peut apporter pour cet indicateur, pas un constat de conformité ; seules les pièces disent ce qui existe pour chaque promo.",
  "la légende du niveau, mot pour mot");
eq(COLONNE_NIVEAU, "Apport de l'application", "la colonne du niveau s'intitule « Apport de l'application »");
eq(formation({ promo: EN_COURS }).garde.slice(2, 5), [
  "Dates : depuis le 12/10/2026", "Formation : Titre de test", "État de la promo : en cours, chiffres provisoires",
], "promo en cours : sans date de fin, chiffres provisoires");

eq(f.sections.map((s) => s.id),
  ["effectif", "deroule", "assiduite", "passages", "evaluations", "ressources", "signalements", "examen", "appreciations"],
  "les neuf sections du § 6.4, dans cet ordre");

// --- Sommaire : chaque indicateur applicable, renvoyé à la section qui le sert (nul pour ceux qui sont hors de l'app)
eq(numeros(f.sommaire), LES_27, "le sommaire couvre les 27 indicateurs applicables, dans l'ordre");
f.sommaire.forEach((e) => eq(e.court, court(e.numero), `${e.numero} : libellé court du référentiel`));
eq(Object.fromEntries(f.sommaire.filter((e) => e.section !== null).map((e) => [e.numero, e.section])), {
  2: "effectif", 3: "effectif", 5: "evaluations", 6: "deroule", 7: "examen", 9: "deroule", 10: "passages", 11: "evaluations",
  12: "effectif", 16: "examen", 17: "deroule", 18: "deroule", 19: "ressources", 23: "ressources", 25: "ressources",
  28: "deroule", 30: "appreciations", 31: "signalements", 32: "signalements",
}, "sommaire : la section qui sert chaque indicateur");
eq(f.sommaire.filter((e) => e.section === null).map((e) => e.numero), HORS,
  "seuls les indicateurs hors de l'app n'ont pas de section (ils n'apparaissent que dans les pièces à fournir)");
eq(f.sommaire.filter((e) => e.section === null).map((e) => e.numero),
  inv.indicateurs.filter((i) => i.niveau === "hors").map((i) => i.numero), "ce sont exactement ceux que l'inventaire dit hors de l'app");
f.sommaire.filter((e) => e.section !== null).forEach((e) =>
  ok(section(f, e.section).indicateurs.includes(e.numero), `${e.numero} : la section ${e.section} le sert`));
eq(Object.fromEntries(f.sections.map((s) => [s.id, s.indicateurs])), {
  effectif: [2, 3, 10, 12], deroule: [6, 9, 17, 18, 28], assiduite: [10, 12, 16], passages: [10, 12],
  evaluations: [5, 11, 16], ressources: [19, 23, 25, 31], signalements: [10, 12, 31, 32], examen: [7, 16], appreciations: [30],
}, "indicateurs servis par chaque section");
ok(f.sections.every((s) => s.indicateurs.every((num) => LES_27.includes(num))), "les sections ne citent que des indicateurs applicables");

// --- Pièces à fournir : indicateur par indicateur, en cases à cocher sur le papier
eq(numeros(f.aFournir), LES_27.filter((num) => num !== 10 && num !== 11), "pièces à fournir : tous sauf le 10 et le 11, qui n'en ont aucune");
eq(f.aFournir.find((a) => a.numero === 1), { numero: 1, court: court(1), items: ["Site", "Catalogue", "Fiche formation"] },
  "1 : trois pièces, la première lettre en majuscule");
eq(f.aFournir.find((a) => a.numero === 21).items, ["CV", "Titres", "Autorisations d'enseigner"], "21 : trois pièces");
eq(f.aFournir.find((a) => a.numero === 19).items, ["Référent pédagogique si le seuil l'exige"], "19 : une seule pièce");

// --- Effectif, parcours et résultats
const effectif = section(f, "effectif");
eq(effectif.titre, "Effectif, parcours et résultats", "effectif : titre");
eq(effectif.paragraphes, [
  "Effectif, abandons : 4 inscrits, dont 3 en formation et 1 abandon.",
  "Liste nominative des stagiaires, puis résultats de la promo avec leur méthode de calcul.",
], "effectif : paragraphes (promo terminée : pas de mention provisoire)");
eq(entetesDe(f, "effectif", 0), ["Stagiaire", "Statut"], "effectif : liste des stagiaires");
eq(lignesDe(f, "effectif", 0), [
  ["Delmas Bastien", "En formation"], ["Lambert Kevin", "En formation"], ["Marchand Anaïs", "En formation"], ["Vidal Cédric", "Abandon"],
], "effectif : tous les stagiaires par ordre alphabétique, avec leur statut, l'abandon compris");
eq(entetesDe(f, "effectif", 1), ["Indicateur", "Résultat", "Méthode de calcul"], "effectif : résultats de la promo");
// Calculs à la main : 4 inscrits dont 1 abandon (25 %) ; 2 absences sur 6 passages prévus (33 %) ; 6 passages pour 3
// stagiaires (2,0) ; 28 bonnes réponses sur 40 (70 %) ; 1 examen réussi sur 2 ; 59 / 5 = 11,8 ; 3 critères acquis sur 5.
eq(lignesDe(f, "effectif", 1), [
  ["Effectif", "4 inscrits", METHODES.effectif],
  ["Abandons", pc(25) + " (1)", METHODES.abandon],
  ["Absences de dernière minute", pc(33), METHODES.absences],
  ["Passages", "2,0 par stagiaire", METHODES.passages],
  ["Réussite aux QCM d'entraînement", pc(70), METHODES.reussiteQcm],
  ["Examens QCM", pc(50) + " (1/2)", METHODES.examensQcm],
  ["Notes", "11,8/20", METHODES.notes],
  ["EPCF", pc(60) + " acquis", METHODES.epcf],
  ["Réussite au titre", "non saisi", METHODES.titre],
], "effectif : les résultats de la promo, avec la méthode de chacun");
const comparaison = ligneComparaison(ind);
eq(lignesDe(f, "effectif", 1).slice(0, 8).map((l) => l[1]),
  [comparaison.effectif, comparaison.abandon, comparaison.absences, comparaison.passages, comparaison.reussiteQcm,
    comparaison.examensQcm, comparaison.notes, comparaison.epcf], "ce sont les textes du tableau de comparaison du tableau de bord");
ok(formation({ promo: EN_COURS }).sections[0].paragraphes.includes("Promo en cours : les chiffres sont provisoires."),
  "promo en cours : la mention provisoire");

// --- Déroulé réalisé
const deroule = section(f, "deroule");
eq(deroule.titre, "Déroulé réalisé", "déroulé : titre");
eq(deroule.paragraphes.slice(0, 3), [
  "Déroulé réalisé : 5 demi-journées de formation du 05/10 au 15/10.",
  "Dates clés : 3 événements au calendrier (1 formation, 1 stage, 1 examen) du 28/09 au 18/12.",
  "Intervenants et partenaires : 3 formateurs, 1 intervenant extérieur, 2 bénévoles, 2 auto-écoles partenaires.",
], "déroulé : les pièces de l'inventaire, sans la ligne du jour désactivé");
eq(deroule.paragraphes.length, 4, "déroulé : plus la règle de comptage des demi-journées");
ok(deroule.paragraphes[3].includes("jours désactivés"), "la règle dit que les jours désactivés ne comptent pas");
eq(entetesDe(f, "deroule", 0), ["Type", "Du", "Au"], "déroulé : dates clés");
eq(lignesDe(f, "deroule", 0), [
  ["Formation", "28/09/2026", "18/12/2026"], ["Stage", "02/11/2026", "27/11/2026"], ["Examen", "15/12/2026", "non renseignée"],
], "déroulé : les dates clés par date de début, le férié écarté, une fin absente dite en mots");
eq(entetesDe(f, "deroule", 1), ["Semaine du", "Demi-journées", "Activités (demi-journées)", "Formateurs", "Intervenants extérieurs", "Bénévoles", "Sujets"],
  "déroulé : synthèse par semaine");
eq(lignesDe(f, "deroule", 1), [
  ["05/10/2026", "3", "Cours : 2 ; Pédagogie salle : 1 ; Voiture (conduite) : 1", "Karim Lopez, Nadia Roche", "1", "2", "Révision avec Kevin"],
  ["12/10/2026", "2", "Autonomie : 1 ; Contrôle : 1", "Hugo Perrin, Nadia Roche", "0", "0", "aucun"],
], "déroulé : deux semaines, formateurs nommés, « Autre » et bénévoles en nombres, sujet de la séance ; ni la semaine du jour désactivé ni l'autre promo");
eq(lignesDe(f, "deroule", 1).reduce((somme, l) => somme + Number(l[1]), 0), 5,
  "déroulé : la somme des semaines est le nombre de demi-journées de l'inventaire (5)");

// Le réalisé seulement (relecture finale, I1) : une ligne avant le début, une après la fin, un jour férié et une séance
// d'après aujourd'hui (28/10) n'entrent ni dans la synthèse par semaine ni dans la liste des formateurs du centre.
const HORS_PERIODE = [L(950, "2026-09-21", 0, "matin", { activite: "Cours", prof_ids: [4] }),
  L(951, "2026-10-26", 0, "matin", { activite: "Cours", prof_ids: [4] }), L(952, "2026-11-09", 2, "matin", { activite: "Cours", prof_ids: [4] })];
const avecHors = formation({ donnees: { ...D, planning: [...D.planning, ...HORS_PERIODE] } });
eq(lignesDe(avecHors, "deroule", 1), lignesDe(f, "deroule", 1), "déroulé : les lignes hors promo, fériées ou futures ne changent pas la synthèse");

// --- Assiduité
eq(section(f, "assiduite").paragraphes,
  ["Le calcul des heures d'après les feuilles d'émargement n'est pas encore repris dans ce dossier : joindre les feuilles d'émargement signées."],
  "assiduité : tant que l'émargement n'est pas branché, une phrase utile à l'auditeur");
eq(section(f, "assiduite").tableaux, [], "assiduité : aucun tableau");
// Quand l'inventaire aura la pièce, le dossier en reprend la phrase.
const invAvecHeures = JSON.parse(JSON.stringify(inv));
invAvecHeures.indicateurs.forEach((i) => i.pieces.forEach((p) => {
  if (p.cle === "assiduite") Object.assign(p, { presente: true, detail: "120 heures prévues, 118 réalisées", raison: null });
}));
eq(section(formation({ inv: invAvecHeures }), "assiduite").paragraphes, ["Assiduité : 120 heures prévues, 118 réalisées."],
  "assiduité présente : la phrase de l'inventaire");

// --- Passages (stagiaires en formation uniquement)
const passages = section(f, "passages");
eq(passages.paragraphes, [
  "Passages : 3 passages en salle et 3 en voiture (remplacements compris), 2 absences de dernière minute.",
  "Stagiaires en formation uniquement : 3 sur 4 inscrits.",
], "passages : la pièce de l'inventaire et la population");
eq(entetesDe(f, "passages"), ["Stagiaire", "Passages en salle", "Passages en voiture", "Absences de dernière minute"], "passages : en-têtes");
eq(lignesDe(f, "passages"), [["Delmas Bastien", "2", "0", "2"], ["Lambert Kevin", "0", "2", "0"], ["Marchand Anaïs", "1", "1", "0"]],
  "passages : par stagiaire en formation, l'abandon n'y est pas");
const colonne = (lignes, k) => lignes.reduce((somme, l) => somme + Number(l[k]), 0);
eq([colonne(lignesDe(f, "passages"), 1), colonne(lignesDe(f, "passages"), 2), colonne(lignesDe(f, "passages"), 3)],
  [ind.passages.detail.salle.total, ind.passages.detail.voiture.total, ind.absences.detail.absences],
  "passages : les sommes du tableau sont les totaux du tableau de bord");

// --- Évaluations
const evaluations = section(f, "evaluations");
eq(evaluations.paragraphes, [
  "Évaluations : 5 notes du 06/10 au 14/10, 2 examens QCM, 4 évaluations EPCF, 1 livret EPCF (stagiaires en formation uniquement) ; aucun résultat de jury saisi.",
  "Stagiaires en formation uniquement : 3 sur 4 inscrits.",
], "évaluations : la pièce de l'inventaire et la population");
eq(entetesDe(f, "evaluations"), ["Stagiaire", "Notes", "Examens QCM", "EPCF en salle", "EPCF véhicule", "Livret EPCF", "Jury"], "évaluations : en-têtes");
eq(lignesDe(f, "evaluations"), [
  ["Delmas Bastien", "2 notes, moyenne 9,0/20", "1 examen, moyenne 12,0/20", "aucune", "aucune", "aucun", "non saisi"],
  ["Lambert Kevin", "1 note, moyenne 15,0/20", "aucun", "aucune", "16/10/2026, 2 acquis sur 3", "aucun", "non saisi"],
  ["Marchand Anaïs", "2 notes, moyenne 13,0/20", "1 examen, moyenne 16,0/20", "14/10/2026, 1 acquis sur 2", "aucune", "oui, mis à jour le 15/10/2026", "non saisi"],
], "évaluations : notes, examens QCM, dernière EPCF de chaque grille, livret, jury non saisi");

// --- Ressources et appropriation
const ressources = section(f, "ressources");
eq(ressources.paragraphes, [
  "Ressources : 2 cours publiés, 3 QCM ; QCM d'entraînement faits par 2 stagiaires sur 3 en formation (3 tentatives).",
  "Mises à jour : 2 cours publiés modifiés du 05/10 au 20/10 (3 modifications) ; 1 signalement de QCM traité le 12/10.",
  "Innovations : 2 nouveautés datées du 02/10 au 20/10.",
  "Stagiaires en formation uniquement : 3 sur 4 inscrits.",
], "ressources : les pièces de l'inventaire");
eq(entetesDe(f, "ressources"), ["Stagiaire", "QCM d'entraînement faits", "Questions répondues", "Réussite"], "ressources : en-têtes");
eq(lignesDe(f, "ressources"), [
  ["Delmas Bastien", "1", "10", pc(60)], ["Lambert Kevin", "0", "0", "aucune donnée"], ["Marchand Anaïs", "2", "30", pc(73)],
], "ressources : l'activité QCM de chaque stagiaire en formation");

// --- Difficultés et signalements traités
eq(section(f, "signalements").paragraphes, [
  "Suivi : stagiaires à suivre de près : 1 ; les 2 thèmes les plus faibles d'après les QCM (au moins 20 réponses par thème) ; "
    + "le thème le plus faible d'après les notes (au moins 3 notes par thème).",
  "Signalements de QCM déposés par les stagiaires de la promo : 2 reçus, 1 traité, 1 en attente.",
  "Délai moyen entre le dépôt et le traitement : 11 jours.",
], "signalements : le suivi en nombres, les signalements reçus, traités, et le délai de traitement");
eq(section(f, "signalements").tableaux, [], "signalements : aucun tableau");
const signalements = (liste) => section(formation({ donnees: { ...D, signalements: liste } }), "signalements").paragraphes.slice(1);
eq(signalements([]), ["Aucun signalement de QCM déposé par les stagiaires de la promo."], "aucun signalement");
eq(signalements([{ id: 1, created_at: "2026-10-01T10:00:00+00:00", traite_at: null }]),
  ["Signalements de QCM déposés par les stagiaires de la promo : 1 reçu, 0 traité, 1 en attente.",
    "Aucun signalement traité pour le moment."], "un seul signalement, encore ouvert");
eq(signalements([
  { id: 1, created_at: "2026-10-01T10:00:00+00:00", traite_at: "2026-10-02T10:00:00+00:00" },
  { id: 2, created_at: "2026-10-01T10:00:00+00:00", traite_at: "2026-10-02T11:00:00+00:00" },
  { id: 3, created_at: "2026-10-01T10:00:00+00:00", traite_at: "2026-10-04T10:00:00+00:00" },
]), ["Signalements de QCM déposés par les stagiaires de la promo : 3 reçus, 3 traités, 0 en attente.",
  "Délai moyen entre le dépôt et le traitement : 1,7 jour."], "délai moyen : (1 + 1 + 3) / 3 = 1,7 jour, au singulier sous 2");
eq(signalements([{ id: 1, created_at: "2026-10-01T10:00:00+00:00", traite_at: "2026-10-02T10:00:00+00:00" }]).slice(1),
  ["Délai moyen entre le dépôt et le traitement : 1 jour."], "un jour");
eq(signalements([{ id: 1, created_at: null, traite_at: "2026-10-02T10:00:00+00:00" }]),
  ["Signalements de QCM déposés par les stagiaires de la promo : 1 reçu, 1 traité, 0 en attente."],
  "traité mais déposé à une date illisible : pas de délai");

// --- Présentation à l'examen
const examen = section(f, "examen");
eq(examen.paragraphes, [
  "Dossier professionnel : enregistré pour 1 stagiaire sur 3 en formation, dernière mise à jour le 10/10.",
  "Heures de formation : non mesurées, le calcul d'après les feuilles d'émargement n'étant pas encore repris.",
  "Stagiaires en formation uniquement : 3 sur 4 inscrits.",
], "examen : dossier professionnel, heures, population");
eq(entetesDe(f, "examen"), ["Stagiaire", "Dossier professionnel", "Livret EPCF", "Heures de formation"], "examen : en-têtes");
eq(lignesDe(f, "examen"), [
  ["Delmas Bastien", "oui, mis à jour le 10/10/2026", "aucun", "non mesurées"],
  ["Lambert Kevin", "aucun", "aucun", "non mesurées"],
  ["Marchand Anaïs", "aucun", "oui, mis à jour le 15/10/2026", "non mesurées"],
], "examen : par stagiaire en formation");

// --- Appréciations
eq(section(f, "appreciations").paragraphes, ["Enquête hors de l'application, à joindre."], "appréciations : l'enquête est hors de l'application");

// --- Nominatif : les noms y sont ; les bénévoles et les auto-écoles n'y sont qu'en nombres
const jsonFormation = JSON.stringify(f);
["Marchand Anaïs", "Delmas Bastien", "Vidal Cédric", "Lambert Kevin"].forEach((nom) =>
  ok(jsonFormation.includes(nom), `le dossier de la formation nomme ${nom}`));
["Nadia Roche", "Karim Lopez", "Hugo Perrin", "Révision avec Kevin"].forEach((mot) =>
  ok(jsonFormation.includes(mot), `le dossier de la formation contient « ${mot} » (formateurs et sujets admis, le document est nominatif)`));
["Durand", "Dupont", "Soleil", "Étoile", "Fermée", "Lointaine", "Jeanne", "Paul Bénévole", "Rose", "Zoé", "Fantôme",
  "Séance du jour désactivé", "Autre promo", "Résumé secret"].forEach((mot) =>
  ok(!jsonFormation.includes(mot), `le dossier de la formation ne contient jamais « ${mot} »`));

// --- Alternance : le 13 s'ajoute au sommaire (hors de l'app, donc sans section) et aux pièces à fournir
const invAlternance = invDe(D, PROMO, { alternance: true });
const fAlternance = formation({ inv: invAlternance });
eq(numeros(fAlternance.sommaire), LES_28, "avec l'alternance : 28 indicateurs");
eq(fAlternance.sommaire.find((e) => e.numero === 13), { numero: 13, court: court(13), section: null }, "13 : hors de l'app, sans section");
eq(fAlternance.aFournir.find((a) => a.numero === 13).items, ["Coordination avec l'entreprise"], "13 : une pièce à fournir");
formeBien(fAlternance, "formation avec alternance");

// =====================================================================================================
// Dossier du centre : promo par promo, avec ou sans noms
// =====================================================================================================
const c = centre();
const cSans = centre({ sansNoms: true });
formeBien(c, "centre");
formeBien(cSans, "centre sans noms");
eq(c.titre, "Dossier du centre", "titre");
eq(c.sousTitre, "Montpellier, du 29/10/2025 au 28/10/2026", "sous-titre : le centre et la période");
eq(c.garde, [
  "Centre : Montpellier",
  "Période : du 29/10/2025 au 28/10/2026",
  "Promos retenues : 2 promos (Promo de test, Promo en cours)",
  "Version : avec les noms des formateurs (stagiaires, bénévoles et auto-écoles en nombres seulement)",
  "Référentiel appliqué : Décret n° 2026-728 du 1er août 2026 (référentiel national qualité), en vigueur le 01/11/2026, catégorie « action de formation »",
  "Édité le 28/10/2026",
  PHRASE_DE_GARDE,
], "page de garde du dossier du centre");
eq(cSans.garde[3], "Version : sans aucun nom (nombres, taux, dates et inventaire)", "la version sans noms le dit");
eq(cSans.garde.filter((_, k) => k !== 3), c.garde.filter((_, k) => k !== 3), "le reste de la garde est le même");
eq(c.sections.map((s) => s.id), ["resultats", "ressources", "innovations", "intervenants", "amelioration", "inventaire"],
  "sections du centre, puis l'inventaire");
eq(cSans.sections.map((s) => s.id), c.sections.map((s) => s.id), "les mêmes sections sans les noms");
eq(numeros(c.sommaire), LES_27, "le sommaire couvre les 27 indicateurs applicables");
eq(c.sommaire.map((e) => e.section), LES_27.map((num) => ({
  2: "resultats", 3: "resultats", 19: "ressources", 23: "ressources", 25: "innovations", 17: "intervenants", 18: "intervenants",
  28: "intervenants", 32: "amelioration",
}[num] || "inventaire")), "chaque indicateur renvoie à sa section du centre, les autres à l'inventaire");
eq(Object.fromEntries(c.sections.map((s) => [s.id, s.indicateurs])), {
  resultats: [2, 3], ressources: [19, 23], innovations: [25], intervenants: [17, 18, 28], amelioration: [32], inventaire: LES_27,
}, "indicateurs servis par chaque section du centre");
eq(c.aFournir, f.aFournir, "les pièces à fournir sont celles de l'inventaire, fixes");
eq(cSans.aFournir, c.aFournir, "les mêmes sans les noms");

// --- Résultats et méthodes, une ligne par promo, « provisoire » tant que la promo n'est pas terminée
eq(section(c, "resultats").paragraphes, [
  "Résultats donnés promo par promo, sans total : 2 promos, dont 1 terminée et 1 en cours.",
  "Une promo est terminée quand sa date de fin est renseignée et passée ; les chiffres d'une promo en cours sont provisoires.",
], "résultats : promo par promo, jamais en total");
eq(entetesDe(c, "resultats", 0), ["Promo", "Période", "État", "Inscrits", "Abandons", "Absences", "Passages"], "résultats : effectif et parcours");
eq(lignesDe(c, "resultats", 0), [
  ["Promo de test", "du 28/09/2026 au 23/10/2026", "Terminée", "4 inscrits", pc(25) + " (1)", pc(33), "2,0 par stagiaire"],
  ["Promo en cours", "depuis le 12/10/2026", "En cours : chiffres provisoires", "2 inscrits", pc(0) + " (0)", pc(50), "0,5 par stagiaire"],
], "résultats : une ligne par promo, la promo en cours marquée provisoire");
eq(entetesDe(c, "resultats", 1), ["Promo", "QCM d'entraînement", "Examens QCM", "Notes", "EPCF"], "résultats : évaluations");
eq(lignesDe(c, "resultats", 1), [
  ["Promo de test", pc(70), pc(50) + " (1/2)", "11,8/20", pc(60) + " acquis"],
  ["Promo en cours", "aucune donnée", "aucune donnée", "14,0/20", "aucune donnée"],
], "résultats : une ligne par promo, « aucune donnée » quand il n'y en a pas");
eq(entetesDe(c, "resultats", 2), ["Indicateur", "Méthode de calcul"], "résultats : méthodes");
eq(lignesDe(c, "resultats", 2), lignesDe(f, "effectif", 1).map((l) => [l[0], l[2]]),
  "résultats : les mêmes indicateurs et les mêmes méthodes que le dossier de la formation, celles du tableau de bord mot pour mot");
eq(lignesDe(c, "resultats", 2).map((l) => l[1]),
  [METHODES.effectif, METHODES.abandon, METHODES.absences, METHODES.passages, METHODES.reussiteQcm, METHODES.examensQcm,
    METHODES.notes, METHODES.epcf, METHODES.titre], "résultats : neuf méthodes, la réussite au titre comprise");
eq(lignesDe(c, "resultats", 0).map((l) => /provisoire/.test(l.join(" "))), [false, true], "« provisoire » pour la seule promo en cours");
eq(section(centre({ promos: [LES_PROMOS[0]] }), "resultats").paragraphes[0],
  "Résultats donnés promo par promo, sans total : 1 promo, dont 1 terminée et 0 en cours.", "une seule promo terminée");

// --- Ressources et mises à jour, par promo (indicateurs 19 et 23)
eq(entetesDe(c, "ressources"), ["Promo", "Ressources", "Mises à jour"], "ressources : en-têtes");
eq(lignesDe(c, "ressources")[0], [
  "Promo de test",
  "2 cours publiés, 3 QCM ; QCM d'entraînement faits par 2 stagiaires sur 3 en formation (3 tentatives)",
  "2 cours publiés modifiés du 05/10 au 20/10 (3 modifications) ; 1 signalement de QCM traité le 12/10",
], "ressources : les pièces de l'inventaire de la promo");
eq(lignesDe(c, "ressources").length, 2, "ressources : une ligne par promo");

// --- Innovations (indicateur 25) : les annonces de la période, citées telles qu'elles ont été publiées, dans les deux versions
const INTRO_ANNONCES = "Annonces de l'application, citées telles qu'elles ont été publiées :";
const ENTREE_B = "02/10/2026 : « " + TITRE_A_TOI + " »";
const ENTREE_C = "20/10/2026 : « Nouveauté publique c »";
eq(section(c, "innovations").paragraphes, [
  "3 annonces de l'application du 15/09/2026 au 20/10/2026.", INTRO_ANNONCES,
  "15/09/2026 : « Nouveauté publique a »", ENTREE_B, ENTREE_C,
], "innovations : le nombre et l'étendue, la phrase d'introduction, puis chaque annonce par date sous la forme « date : « titre » » ; "
  + "ni celle du 05/11 (hors période) ni celle sans date");
eq(section(c, "innovations").tableaux, [], "innovations : des citations, plus de tableau");
eq(section(cSans, "innovations"), section(c, "innovations"), "innovations : les mêmes dans la version sans noms");
ok(!JSON.stringify(c).includes("Résumé secret"), "jamais le résumé d'une annonce");
ok(section(c, "innovations").paragraphes.slice(2).every((p) => /^\d{2}\/\d{2}\/\d{4} : « .+ »$/.test(p)), "chaque annonce est une citation datée");
eq(section(centre({ nouveautes: [] }), "innovations"),
  { id: "innovations", titre: "Innovations", indicateurs: [25], paragraphes: ["Aucune annonce de l'application dans la période."], tableaux: [] },
  "aucune annonce");
eq(section(centre({ periode: { du: "2026-10-01", au: "2026-10-20" } }), "innovations").paragraphes,
  ["2 annonces de l'application du 02/10/2026 au 20/10/2026.", INTRO_ANNONCES, ENTREE_B, ENTREE_C], "bornes de la période comprises");
eq(section(centre({ periode: { du: "2026-10-20", au: "2026-10-28" } }), "innovations").paragraphes,
  ["1 annonce de l'application le 20/10/2026.", INTRO_ANNONCES, ENTREE_C], "une seule annonce : au singulier, avec son jour");
eq(section(centre({ nouveautes: [NOUVEAUTE("g", "2026-10-20", "  "), NOUVEAUTE("f", "2026-10-20", "Zéro")] }), "innovations").paragraphes,
  ["2 annonces de l'application le 20/10/2026.", INTRO_ANNONCES, "20/10/2026 : « sans titre »", "20/10/2026 : « Zéro »"],
  "deux annonces le même jour : un seul jour dans la phrase, un titre vide dit « sans titre »");

// --- Intervenants et partenaires (indicateurs 17, 18 et 28)
eq(entetesDe(c, "intervenants", 0), ["Promo", "Intervenants et partenaires"], "intervenants : par promo, en nombres");
eq(lignesDe(c, "intervenants", 0), [
  ["Promo de test", "3 formateurs, 1 intervenant extérieur, 2 bénévoles, 2 auto-écoles partenaires"],
  ["Promo en cours", "2 formateurs, 2 auto-écoles partenaires"],
], "intervenants : bénévoles et auto-écoles en nombres seulement, dans toutes les versions");
eq(entetesDe(c, "intervenants", 1), ["Formateur", "Demi-journées de formation"], "intervenants : formateurs nommés dans la version nominative");
// Hugo : jeudi 15/10 (promo 7) et mardi 13/10 (promo 8) = 2 ; Karim : lundi 05/10 (promo 7), lundi 12/10 et mardi 13/10
// (promo 8) = 3 ; Nadia : lundi 05/10 matin et après-midi, jeudi 15/10 (promo 7) = 3 ; Zoé n'intervient qu'un jour désactivé.
eq(lignesDe(c, "intervenants", 1), [["Hugo Perrin", "2"], ["Karim Lopez", "3"], ["Nadia Roche", "3"]], "intervenants : par formateur, par ordre alphabétique");
eq(section(c, "intervenants").paragraphes[1], "Les formateurs sont nommés, avec leur nombre de demi-journées de formation sur toute la durée des promos retenues.",
  "intervenants : la phrase des noms");
// (promo 7 seulement : la promo 8 est en cours, la séance du 26/10 y est déjà passée)
const centreHors = centre({ promos: LES_PROMOS.map((p) => (p.promo.id === 7 ? { ...p, donnees: { ...p.donnees, planning: [...p.donnees.planning, ...HORS_PERIODE] } } : p)) });
eq(lignesDe(centreHors, "intervenants", 1), lignesDe(c, "intervenants", 1), "intervenants du centre : mêmes formateurs, mêmes comptes");
eq(section(cSans, "intervenants").paragraphes[1], "Cette version ne nomme personne.", "intervenants : la phrase de la version sans noms");
const sansPlanning = centre({ promos: [{ ...LES_PROMOS[1], donnees: { ...D8, planning: [] } }] });
eq(section(sansPlanning, "intervenants").paragraphes[1], "Aucun formateur n'est inscrit au planning de ces promos.",
  "intervenants : aucun formateur au planning, la phrase ne promet pas de noms");
eq(section(sansPlanning, "intervenants").tableaux.length, 1, "intervenants : et pas de tableau de formateurs");
eq(section(cSans, "intervenants").tableaux.length, 1, "intervenants : aucun tableau par personne sans les noms");
eq(section(cSans, "intervenants").tableaux[0], section(c, "intervenants").tableaux[0], "intervenants : les nombres sont les mêmes");

// --- Amélioration (indicateur 32) : comparaison des promos, thèmes à retravailler
eq(entetesDe(c, "amelioration", 0), ["Promo", "Suivi"], "amélioration : suivi");
eq(lignesDe(c, "amelioration", 0), [
  ["Promo de test", "stagiaires à suivre de près : 1 ; les 2 thèmes les plus faibles d'après les QCM (au moins 20 réponses par thème) ; "
    + "le thème le plus faible d'après les notes (au moins 3 notes par thème)"],
  ["Promo en cours", "personne ne cumule deux signaux et aucun thème n'a encore assez de réponses ou de notes"],
], "amélioration : le suivi de chaque promo en nombres, jamais une liste de personnes");
eq(entetesDe(c, "amelioration", 1), ["Promo", "Source", "Thème", "Résultat"], "amélioration : thèmes les plus faibles");
eq(lignesDe(c, "amelioration", 1), [
  ["Promo de test", "QCM", "Thème 2 : Vitesse", pc(65) + " sur 20 réponses"],
  ["Promo de test", "QCM", "Thème 1 : Feux", pc(75) + " sur 20 réponses"],
  ["Promo de test", "Notes", "Thème 1 : Feux", "11,0/20 sur 4 notes"],
], "amélioration : du plus faible au plus fort, d'après les QCM puis d'après les notes");
ok(section(c, "amelioration").paragraphes.length > 0, "amélioration : des paragraphes");

// --- Inventaire fusionné (R8)
const inventaire = section(c, "inventaire");
eq(entetesDe(c, "inventaire", 0), ["Indicateur", "Apport de l'application", "Pièces à fournir par le centre"], "inventaire : indicateurs");
eq(section(c, "inventaire").paragraphes[0], PHRASE_NIVEAU, "inventaire : la légende du niveau avant le tableau");
eq(section(cSans, "inventaire").paragraphes[0], PHRASE_NIVEAU, "inventaire sans noms : la même légende");
eq(lignesDe(c, "inventaire", 0).length, 27, "inventaire : une ligne par indicateur applicable");
eq(lignesDe(c, "inventaire", 0).slice(0, 2), [
  ["1. " + court(1), "Hors de l'app", "Site, Catalogue, Fiche formation"],
  ["2. " + court(2), "En partie", "Publication sur le site"],
], "inventaire : numéro et libellé, niveau, pièces à fournir (fixes)");
eq(lignesDe(c, "inventaire", 0).find((l) => l[0].startsWith("10. ")), ["10. " + court(10), "Prouvé", "aucune"], "inventaire : rien à fournir se dit en un mot");
eq(entetesDe(c, "inventaire", 1), ["Indicateur", "Pièce de l'application", "Présence dans les promos"], "inventaire : pièces");
const presence = (num, libelle) => lignesDe(c, "inventaire", 1).find((l) => l[0] === String(num) && l[1] === libelle)[2];
eq(presence(10, "Effectif, abandons"), "présente pour 2 promos sur 2", "présente pour toutes les promos");
eq(presence(9, "Dates clés"),
  "présente pour 1 promo sur 2 ; absente pour 1 promo sur 2 : aucune date de formation, de stage ou d'examen au calendrier",
  "présente pour une promo seulement : la raison de l'absence de l'autre");
eq(presence(16, "Dossier professionnel"),
  "présente pour 1 promo sur 2 ; absente pour 1 promo sur 2 : aucun dossier professionnel enregistré par les stagiaires en formation",
  "même règle pour le dossier professionnel");
eq(presence(10, "Assiduité"), "absente pour 2 promos sur 2 : calcul des heures pas encore branché", "absente pour toutes les promos");
eq(lignesDe(c, "inventaire", 1).filter((l) => l[0] === "10").map((l) => l[1]), ["Effectif, abandons", "Assiduité", "Passages", "Suivi"],
  "inventaire : les pièces d'un indicateur dans l'ordre du tableau du § 6.2");
ok(!lignesDe(c, "inventaire", 1).some((l) => l[0] === "1"), "un indicateur hors de l'app n'a aucune pièce de l'application");
eq(lignesDe(c, "inventaire", 1).length, inv.indicateurs.reduce((somme, i) => somme + i.pieces.length, 0),
  "inventaire : autant de lignes que de pièces de l'inventaire d'une promo");

// Des raisons différentes pour une même pièce sont regroupées par texte, avec le nombre de promos concernées.
const clone = (v) => JSON.parse(JSON.stringify(v));
const invRaison = (raison) => {
  const copie = clone(inv8);
  copie.indicateurs.forEach((i) => i.pieces.forEach((p) => { if (p.cle === "assiduite") p.raison = raison; }));
  return copie;
};
const troisPromos = centre({ promos: [
  LES_PROMOS[0], { ...LES_PROMOS[1], inv: invRaison("raison A") },
  { promo: { ...EN_COURS, id: 9, nom: "Promo 9" }, inv: invRaison("raison B"), ind: ind8, donnees: D8 },
  { promo: { ...EN_COURS, id: 10, nom: "Promo 10" }, inv: invRaison("raison A"), ind: ind8, donnees: D8 },
] });
eq(lignesDe(troisPromos, "inventaire", 1).find((l) => l[0] === "10" && l[1] === "Assiduité")[2],
  "absente pour 4 promos sur 4 : calcul des heures pas encore branché (1 promo) ; raison A (2 promos) ; raison B (1 promo)",
  "raisons regroupées par texte, chacune avec son nombre de promos");

// =====================================================================================================
// Version sans aucun nom (§ 6.8) : le test « Kevin »
// =====================================================================================================
const INTERDITS = [
  // stagiaires : prénoms, noms, puis noms complets dans les deux ordres
  ...[...STAG, ...STAG_8].flatMap((s) => [s.prenom, s.nom, `${s.prenom} ${s.nom}`, `${s.nom} ${s.prenom}`]),
  "Kevin",
  // formateurs
  ...PROFS.flatMap((p) => [p.nom, ...p.nom.split(" ")]),
  // bénévoles et auto-écoles (leurs noms sont dans le jeu, jamais dans un document)
  ...BENEVOLES.map((b) => b.nom), "Jeanne", "Paul", "Rose",
  ...AUTO_ECOLES.map((a) => a.nom), "Soleil", "Étoile", "Fermée", "Lointaine",
  // textes saisis par une personne : sujets de séance, intervenant « Autre », titres du calendrier
  "Révision avec Kevin", "Révision avec Léa", "Séance du jour désactivé", "Mme Durand", "Durand", "Autre promo",
  "Formation chez Mme Dupont", "Stage Dupont", "Dupont",
];
const jsonSans = JSON.stringify(cSans);
INTERDITS.forEach((mot) => ok(!jsonSans.includes(mot), `la version sans noms ne contient pas « ${mot} »`));
// Les mêmes mots, sauf les noms de formateurs, restent absents de la version nominative du dossier du centre.
const jsonNominatif = JSON.stringify(c);
const NOMS_DE_FORMATEURS = PROFS.flatMap((p) => [p.nom, ...p.nom.split(" ")]);
INTERDITS.filter((mot) => !NOMS_DE_FORMATEURS.includes(mot)).forEach((mot) =>
  ok(!jsonNominatif.includes(mot), `le dossier du centre nominatif ne contient pas non plus « ${mot} »`));
["Nadia Roche", "Karim Lopez", "Hugo Perrin"].forEach((nom) => ok(jsonNominatif.includes(nom), `le dossier du centre nominatif nomme ${nom}`));
ok(!jsonNominatif.includes("Zoé") && !jsonNominatif.includes("Fantôme"), "mais pas le formateur d'un jour désactivé");

// Aucune ligne par personne, même sous un numéro : le nombre de lignes ne dépend pas du nombre de stagiaires.
const beaucoup = (k) => {
  const plus = plage(100, 100 + k - 1).map((id) => ({ id, prenom: "Prénom" + id, nom: "Nom" + id, actif: true, ordre: id, anonymise_le: null }));
  const donnees = {
    ...D, stagiaires: [...STAG, ...plus],
    passages: [...PASSAGES, ...plus.map((s) => P(s.id, "Salle", "Effectué", "2026-10-06"))],
    evaluations: [...EVALS, ...plus.map((s) => E(s.id, "Thème", 1, 11, 20, "2026-10-07"))],
    tentatives: [...TENTATIVES, ...plus.map((s) => T(s.id, 10, "entrainement", 9, 10, 18, "2026-10-12"))],
  };
  return modeleDossierCentre({
    promos: [{ promo: PROMO, inv: invDe(donnees, PROMO), ind: indDe(donnees), donnees }, LES_PROMOS[1]],
    lieu: LIEU, periode: PERIODE, aujourdhui: AUJOURDHUI, sansNoms: true, nouveautes: NOUVEAUTES,
  });
};
const forme = (m) => m.sections.map((s) => [s.id, s.paragraphes.length, s.tableaux.map((t) => [t.entetes.length, t.lignes.length])]);
const grand = beaucoup(60);
eq(forme(grand), forme(cSans), "sans les noms : la même forme avec 4 ou 64 stagiaires (aucune ligne par personne)");
ok(JSON.stringify(grand).includes("64 inscrits"), "mais les nombres suivent les stagiaires (64 inscrits)");
ok(!/Nom1\d\d|Prénom1\d\d/.test(JSON.stringify(grand)), "aucun nom de la grande promo non plus");
// Aucun en-tête de colonne ne désigne une personne.
cSans.sections.forEach((s) => s.tableaux.forEach((t) =>
  ok(!t.entetes.some((e) => /^(stagiaire|formateur|bénévole|auto-école|nom|prénom)s?$/i.test(e)), `${s.id} : aucun en-tête de personne`)));

// =====================================================================================================
// Promo vide, promo sans dates, données mal formées : des mots, jamais NaN ni undefined ni Invalid Date
// =====================================================================================================
const VIDE = geler({ id: 9, lieu_id: 3, nom: "Promo vide", date_debut: "2026-09-01", date_fin: null });
const REF_VIDE = geler({ qcm: [], themes: [] });
const TOUT_VIDE = geler({ stagiaires: [], passages: [], evaluations: [], tentatives: [], epcf: [], planning: [], agenda: [], livrets: [],
  dossiers: [], signalements: [], cours: [], versions: [], joursOff: [], autoEcoles: [], profs: [], entete: {} });
const sorties = (donnees, referentiel, promo, lieu = LIEU, intitule = "Titre de test") => {
  const invX = geler(inventairePromo(donnees, referentiel, { promo, aujourdhui: AUJOURDHUI }));
  const indX = geler(indicateursPromo(donnees, referentiel, { aujourdhui: AUJOURDHUI }));
  const formationX = modeleDossierFormation({ inv: invX, donnees, ind: indX, promo, lieu, intitule, aujourdhui: AUJOURDHUI });
  const centreX = (sansNoms) => modeleDossierCentre({
    promos: [{ promo, inv: invX, ind: indX, donnees }], lieu, periode: PERIODE, aujourdhui: AUJOURDHUI, sansNoms, nouveautes: [],
  });
  return { invX, formationX, nominatif: centreX(false), sans: centreX(true) };
};
[["promo vide", TOUT_VIDE, REF_VIDE, VIDE], ["aucune donnée", {}, REF_VIDE, VIDE], ["tableaux vides, QCM au référentiel", TOUT_VIDE, REF, VIDE],
  ["sans aucune date", TOUT_VIDE, REF_VIDE, { id: 9, lieu_id: 3, nom: "Sans dates", date_debut: null, date_fin: null }],
  ["sans nom", TOUT_VIDE, REF_VIDE, { id: 9, lieu_id: null, nom: null, date_debut: null, date_fin: null }],
].forEach(([nom, donnees, referentiel, promo]) => {
  const { invX, formationX, nominatif, sans } = sorties(donnees, referentiel, promo);
  formeBien(formationX, `formation (${nom})`);
  formeBien(nominatif, `centre (${nom})`);
  formeBien(sans, `centre sans noms (${nom})`);
  eq(numeros(formationX.sommaire), LES_27, `${nom} : le sommaire couvre les 27 indicateurs`);
  eq(numeros(sans.sommaire), LES_27, `${nom} : le sommaire du centre aussi`);
  eq(formationX.sections.map((s) => s.id).length, 9, `${nom} : les neuf sections y sont`);
  ok(formationX.sections.every((s) => s.paragraphes.length > 0), `${nom} : chaque section dit quelque chose`);
  ok(invX.indicateurs.every((i) => i.pieces.every((p) => !p.presente)), `${nom} : aucune pièce présente`);
});
const vide = sorties(TOUT_VIDE, REF_VIDE, VIDE);
eq(section(vide.formationX, "effectif").paragraphes[0], "Effectif, abandons : aucun stagiaire inscrit dans cette promo.", "promo vide : la raison, en mots");
eq(section(vide.formationX, "effectif").tableaux.length, 1, "promo vide : pas de liste de stagiaires, seulement les résultats");
eq(section(vide.formationX, "passages").tableaux, [], "promo vide : aucun tableau par stagiaire");
ok(chaines(vide.formationX).every((s) => !/\bundefined\b|NaN|Invalid Date/.test(s)), "promo vide : aucune trace de valeur manquante");
const sansLieu = sorties(TOUT_VIDE, REF_VIDE, VIDE, null, "");
eq(sansLieu.formationX.garde.slice(0, 4), ["Centre : centre non renseigné", "Promo : Promo vide", "Dates : depuis le 01/09/2026", "Formation : non renseigné"],
  "lieu et intitulé absents : des mots");
eq(sorties(TOUT_VIDE, REF_VIDE, { id: 9, lieu_id: null, nom: null, date_debut: null, date_fin: null }).formationX.garde.slice(1, 3),
  ["Promo : promo sans nom", "Dates : dates non renseignées"], "promo sans nom ni dates : des mots");

// Dossier du centre sans aucune promo, ou avec une promo qui n'a pas commencé
const aucunePromo = modeleDossierCentre({ promos: [], lieu: LIEU, periode: PERIODE, aujourdhui: AUJOURDHUI, sansNoms: true, nouveautes: NOUVEAUTES });
formeBien(aucunePromo, "centre sans promo");
eq(aucunePromo.garde[2], "Promos retenues : aucune", "aucune promo : le dit");
eq(section(aucunePromo, "resultats").paragraphes[0], "Aucune promo dans la période.", "aucune promo : résultats");
eq(aucunePromo.sections.map((s) => s.id), ["resultats", "ressources", "innovations", "intervenants", "amelioration", "inventaire"], "aucune promo : les mêmes sections");
eq(aucunePromo.sommaire, [], "aucune promo : pas d'inventaire, donc pas de sommaire");
eq(aucunePromo.aFournir, [], "aucune promo : pas de pièces à fournir");
eq(section(aucunePromo, "innovations").paragraphes.length, 2 + 3, "aucune promo : les annonces restent, elles ne dépendent d'aucune promo");
formeBien(modeleDossierCentre({ promos: [LES_PROMOS[0]], lieu: null, periode: {}, aujourdhui: AUJOURDHUI, sansNoms: false }), "centre sans lieu ni période");
eq(modeleDossierCentre({ promos: [LES_PROMOS[0]], lieu: null, periode: {}, aujourdhui: AUJOURDHUI, sansNoms: false }).garde.slice(0, 2),
  ["Centre : centre non renseigné", "Période : dates non renseignées"], "lieu et période absents : des mots");

// Lignes mal formées : écartées sans bruit
const CASSEES = geler({
  stagiaires: [{ id: 1, prenom: null, nom: null, actif: true }, { id: 2, prenom: "Sans", nom: null, actif: true }],
  passages: [{ stagiaire_id: 1, type: "Autre", resultat: "Effectué" }, { stagiaire_id: 2, type: "Salle", resultat: null }],
  evaluations: [{ id: 1, stagiaire_id: 1, type: "Thème", theme_numero: 1, note: null, note_max: 20, date_eval: null }],
  tentatives: [{ id: 1, stagiaire_id: 1, mode: "examen", score: null, total: null, note_20: null, finished_at: null },
    { id: 2, stagiaire_id: 1, mode: "entrainement", score: undefined, total: undefined, note_20: undefined, finished_at: undefined }],
  epcf: [{ id: 1, stagiaire_id: 1, trame: "salle", contexte: "EPCF", auto_eval: false, date_eval: null, scores: null }],
  planning: [L(1, null, 0, "matin", { activite: "Cours" }), L(2, "2026-10-05", null, "matin", { activite: "Cours" }),
    L(3, "pas une date", 1, "matin", { activite: "Cours" }), L(4, "2026-10-05", 1, "matin", { activite: "Cours", prof_ids: null, benevoles_ids: null }),
    L(5, "2026-10-05", 2, "matin", { activite: "Cours", prof_ids: [77] })],
  agenda: [{ id: 1, type: "stage", title: "Sans début", date_start: null, date_end: "2026-11-01" }, { id: 2, type: "stage", date_start: "2026-11-02" },
    { id: 3, type: "toString", date_start: "2026-11-03" }],
  livrets: [{ stagiaire_id: 1 }], dossiers: [{ stagiaire_id: 1, updated_at: null }],
  signalements: [{ id: 1, traite_at: "hier" }, { id: 2, created_at: "2026-10-05T10:00:00+00:00", traite_at: "2026-10-01T10:00:00+00:00" }],
  cours: [{ id: 1, published: true, updated_at: null }], versions: [{ cours_id: 1, saved_at: null }],
  joursOff: [{ semaine_lundi: null, day_index: 1 }, {}], autoEcoles: [], profs: [{ id: 5 }],
});
const cassee = sorties(CASSEES, REF, PROMO);
formeBien(cassee.formationX, "formation (données mal formées)");
formeBien(cassee.nominatif, "centre (données mal formées)");
formeBien(cassee.sans, "centre sans noms (données mal formées)");
eq(lignesDe(cassee.formationX, "effectif", 0).map((l) => l[0]), ["Stagiaire sans nom", "Sans"], "stagiaire sans nom ni prénom : un mot, trié sans erreur");
ok(lignesDe(cassee.formationX, "deroule", 1).some((l) => l[3] === "formateur n° 77"), "formateur inconnu : son numéro, jamais undefined");
eq(lignesDe(cassee.formationX, "deroule", 0), [["Stage", "02/11/2026", "non renseignée"]],
  "calendrier mal formé : seul l'événement daté d'un type connu est repris (ni sans début, ni de type « toString »)");

// =====================================================================================================
// Export CSV de l'inventaire
// =====================================================================================================
const csv = inventaireCsv(inv);
ok(csv.startsWith(BOM), "BOM pour Excel");
const brut = csv.slice(1);
ok(brut.endsWith("\r\n"), "fin de fichier par CRLF");
ok(!brut.replace(/\r\n/g, "").includes("\n") && !brut.replace(/\r\n/g, "").includes("\r"), "aucune fin de ligne ailleurs qu'en CRLF");
const brutes = brut.split("\r\n");
eq(brutes.length, 1 + 27 + 1, "1 ligne d'en-tête, 27 indicateurs, et la ligne vide qui suit le dernier CRLF");
eq(brutes[0].split(";"), ["Numéro", "Critère", "Libellé court", "Apport de l'application", "Pièces présentes", "Pièces absentes (raison)", "Pièces à fournir"],
  "en-têtes, séparés par des points-virgules");
const tableCsv = lireCsv(brut);
eq(tableCsv.length, 28, "28 lignes une fois lues");
ok(tableCsv.every((l) => l.length === 7), "7 colonnes partout (les cellules à point-virgule sont citées)");
eq(tableCsv.slice(1).map((l) => Number(l[0])), LES_27, "un indicateur par ligne, dans l'ordre des numéros");
eq(tableCsv.slice(1).map((l) => Number(l[1])), inv.indicateurs.map((i) => i.critere), "le critère de chacun");
eq(tableCsv.slice(1).map((l) => l[2]), inv.indicateurs.map((i) => i.court), "le libellé court de chacun");
eq(tableCsv.slice(1).map((l) => l[3]), inv.indicateurs.map((i) => LIBELLES_NIVEAU[i.niveau]), "le niveau, en mots");
eq(LIBELLES_NIVEAU, { prouve: "Prouvé", partiel: "En partie", hors: "Hors de l'app" }, "les trois niveaux de la page");
eq(tableCsv.find((l) => l[0] === "11"), [
  "11", "3", "Évaluer l'atteinte des objectifs", "Prouvé",
  "Évaluations : " + inv.indicateurs.find((i) => i.numero === 11).pieces[0].detail,
  "aucune", "aucune",
], "11 : une pièce présente (sa phrase contient un point-virgule, donc citée), rien d'absent, rien à fournir");
eq(tableCsv.find((l) => l[0] === "10"), [
  "10", "3", "Adapter l'accompagnement et le suivi", "Prouvé",
  "Effectif, abandons : 4 inscrits, dont 3 en formation et 1 abandon | Passages : 3 passages en salle et 3 en voiture (remplacements compris), 2 absences de dernière minute | "
    + "Suivi : " + inv.indicateurs.find((i) => i.numero === 10).pieces.find((p) => p.cle === "suivi").detail,
  "Assiduité : calcul des heures pas encore branché",
  "aucune",
], "10 : plusieurs pièces présentes, une absente avec sa raison");
eq(tableCsv.find((l) => l[0] === "1"), ["1", "1", court(1), "Hors de l'app", "aucune", "aucune", "Site, Catalogue, Fiche formation"],
  "1 : hors de l'app, trois pièces à fournir");
ok(csv.includes('"Évaluations : '), "une cellule qui porte un point-virgule est citée");
ok(!csv.includes(TIRET_CADRATIN) && problemes(tableCsv).length === 0, "le CSV ne porte ni tiret cadratin, ni NaN, ni undefined");
// L'inventaire d'une promo vide : 27 lignes, aucune cellule vide.
const csvVide = lireCsv(inventaireCsv(vide.invX).slice(1));
eq(csvVide.length, 28, "promo vide : 1 + 27 lignes");
ok(csvVide.every((l) => l.length === 7 && l.every((x) => x !== "")), "promo vide : aucune cellule vide");
eq(csvVide.find((l) => l[0] === "10")[4], "aucune", "promo vide : aucune pièce présente");
// Avec l'alternance : 28 indicateurs.
eq(inventaireCsv(invAlternance).slice(1).split("\r\n").length, 1 + 28 + 1, "avec l'alternance : 1 + 28 lignes");
eq(inventaireCsv({ indicateurs: [] }), BOM + brutes[0] + "\r\n", "sans indicateur : l'en-tête seul");
eq(inventaireCsv(null), BOM + brutes[0] + "\r\n", "sans inventaire : l'en-tête seul");
// Une formule ne peut pas s'y glisser.
const invPiegee = clone(inv);
invPiegee.indicateurs[0].court = "=1+1";
eq(lireCsv(inventaireCsv(invPiegee).slice(1))[1][2], "'=1+1", "une formule est neutralisée comme dans la matrice des notes");

// =====================================================================================================
// Pureté, répétabilité, typographie
// =====================================================================================================
eq(formation(), f, "même entrée, même dossier de la formation");
eq(centre(), c, "même entrée, même dossier du centre");
const textesFormation = chaines(f).join("\n");
const textesCentre = chaines(c).join("\n");
const textesSans = chaines(cSans).join("\n");
// R9 : les documents sont impersonnels (ni « tu » ni « vous »). Une seule exception, la citation entre guillemets français : les
// titres des annonces de l'application s'adressent à leurs lecteurs à la deuxième personne et sont cités tels qu'ils ont été publiés.
const PRONOMS = /\b(tu|toi|ton|ta|tes|vous|votre|vos)\b/i;
const sansCitations = (texte) => texte.replace(/«[^»]*»/g, "");
[["formation", textesFormation], ["centre", textesCentre], ["centre sans noms", textesSans], ["csv", csv]].forEach(([nom, texte]) => {
  ok(!texte.includes(TIRET_CADRATIN), `${nom} : aucun tiret cadratin`);
  ok(!/\bprofs?\b/i.test(texte), `${nom} : « formateur », jamais « prof »`);
  ok(!PRONOMS.test(sansCitations(texte)), `${nom} : document impersonnel, ni « tu » ni « vous » hors citation`);
});
ok(PRONOMS.test(textesCentre) && PRONOMS.test(textesSans),
  "le titre à la deuxième personne est bien dans les deux versions du centre : sans le retrait des citations, le test échouerait");
ok(!PRONOMS.test(textesFormation) && !PRONOMS.test(csv), "le dossier de la formation et le CSV ne citent rien : aucun pronom, même sans retrait");
eq(chaines(c).filter((s) => PRONOMS.test(s)), [ENTREE_B], "version nominative : la seule chaîne à la deuxième personne est la citation du titre");
eq(chaines(cSans).filter((s) => PRONOMS.test(s)), [ENTREE_B], "version sans noms : la seule chaîne à la deuxième personne est la citation du titre");
eq(textesCentre.split(TITRE_A_TOI).length - 1, 1, "le titre à la deuxième personne n'apparaît qu'une fois");
eq(textesCentre.split("« " + TITRE_A_TOI + " »").length - 1, 1, "et c'est entre guillemets français");

// Un dossier du centre construit avec les vraies annonces de la rubrique Nouveautés (js/nouveautes-data.js), dont beaucoup de
// titres sont à la deuxième personne.
ok(NOUVEAUTES_REELLES.length > 0 && NOUVEAUTES_REELLES.every((x) => !/[«»]/.test(x.titre)),
  "les vrais titres ne portent pas de guillemets français : le retrait des citations les traite à plat");
const periodeLarge = { du: "2000-01-01", au: "2099-12-31" };
const reelNominatif = centre({ periode: periodeLarge, nouveautes: NOUVEAUTES_REELLES });
const reelSans = centre({ periode: periodeLarge, nouveautes: NOUVEAUTES_REELLES, sansNoms: true });
formeBien(reelNominatif, "centre (vraies annonces)");
formeBien(reelSans, "centre sans noms (vraies annonces)");
const datees = NOUVEAUTES_REELLES.filter((x) => x.date);
const jourFr = (jour) => `${jour.slice(8)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}`;
const joursReels = datees.map((x) => x.date).sort();
const annoncesReelles = section(reelSans, "innovations").paragraphes;
eq(annoncesReelles.slice(0, 2), [
  `${datees.length} annonces de l'application du ${jourFr(joursReels[0])} au ${jourFr(joursReels[joursReels.length - 1])}.`, INTRO_ANNONCES,
], "vraies annonces : le nombre et l'étendue");
eq([...annoncesReelles.slice(2)].sort(), datees.map((x) => `${jourFr(x.date)} : « ${x.titre.trim()} »`).sort(),
  "vraies annonces : toutes les annonces datées, ni plus ni moins");
const ordre = annoncesReelles.slice(2).map((p) => p.slice(6, 10) + p.slice(3, 5) + p.slice(0, 2));
ok(ordre.every((jour, k) => k === 0 || jour >= ordre[k - 1]), "vraies annonces : par date");
eq(section(reelNominatif, "innovations"), section(reelSans, "innovations"), "vraies annonces : les mêmes dans les deux versions");
[["nominatif", reelNominatif], ["sans noms", reelSans]].forEach(([nom, modele]) => {
  const textes = chaines(modele);
  const horsCitations = sansCitations(textes.join("\n"));
  ok(!PRONOMS.test(horsCitations), `vraies annonces (${nom}) : document impersonnel hors citations, ni « tu » ni « vous »`);
  ok(!/\bprofs?\b/i.test(horsCitations), `vraies annonces (${nom}) : « formateur », jamais « prof » hors citations`);
  ok(!textes.join("\n").includes(TIRET_CADRATIN), `vraies annonces (${nom}) : aucun tiret cadratin`);
  ok(textes.filter((s) => PRONOMS.test(s)).every((s) => /^\d{2}\/\d{2}\/\d{4} : « [^»]+ »$/.test(s)),
    `vraies annonces (${nom}) : une chaîne à la deuxième personne est toujours une annonce citée`);
});
const source = readFileSync(new URL("../js/qualiopi-documents.js", import.meta.url), "utf8");
ok(!source.includes(TIRET_CADRATIN), "aucun tiret cadratin dans le module");
const code = source.replace(/\/\/.*$/gm, "");
ok(!/\bdocument\.|\bwindow\.|\bfetch\(|\bsupabase\b|\blocalStorage\b/.test(code), "le module est pur : ni DOM, ni réseau, ni base");
eq(code.match(/^import .* from "(.*)";$/gm).map((l) => l.match(/from "(.*)"/)[1].replace(/\?v=\w+$/, "")),
  ["./qualiopi-referentiel.js", "./qualiopi-preuves.js", "./centre-stats.js", "./notes-stats.js", "./centre-csv.js", "./utils.js"],
  "il n'importe que des modules purs de l'app, avec le jeton de version des autres imports");
// Les aides de l'inventaire sont importées, jamais recopiées : la synthèse par semaine suit la règle de l'inventaire.
const AIDES = ["jourDe", "rempli", "tableau", "nb", "lignesDuPlanning", "demiJournees", "intervenantsDistincts"];
const importPreuves = code.match(/import \{([^}]*)\} from "\.\/qualiopi-preuves\.js\?v=\w+";/);
eq(importPreuves && importPreuves[1].split(",").map((s) => s.trim()), AIDES, "il importe de l'inventaire les petits outils et les aides du planning");
["ISO_JOUR", "porteQuelqueChose", "cleJour", "jourDeLigne", ...AIDES].forEach((nom) =>
  ok(!new RegExp(`\\b(const|let|var|function)\\s+${nom}\\b`).test(code), `le module ne redéfinit pas ${nom}`));
ok(!/prof_ids|prof_autre|benevoles_ids/.test(code), "le module ne lit pas lui-même les champs des intervenants : la règle est celle de l'inventaire");
const ceTest = readFileSync(new URL(import.meta.url), "utf8");
ok(!ceTest.includes(TIRET_CADRATIN), "aucun tiret cadratin dans ce test");

console.log(`qualiopi-documents : ${n} assertions OK`);
