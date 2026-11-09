// Comptes ADDITIFS d'un centre (lot 5, D9 et D10). PUR : sans DOM ni réseau, testé en node (tests/comptes-reseau.test.mjs).
// La direction les tire de js/centre-stats.js (comptesDepuisIndicateurs), le siège les reçoit de la base (comptes_reseau,
// versComptes) : mêmes définitions des deux côtés, jouées par une fixture commune (tests/fixtures/comptes-promo.json).
// Un compte s'additionne entre promos et entre centres ; un ratio ne se calcule que sur des comptes sommés.

// Chaque champ reflète une colonne de comptes_reseau (enFormation = en_formation, notesSomme = notes_somme...).
export const CHAMPS_COMPTES = ["inscrits", "enFormation", "abandons", "absences", "prevus", "qcmBonnes",
  "qcmQuestions", "examensPasses", "examensReussis", "notesN", "notesSomme", "notesSous10", "epcfAcquis", "epcfRenseignes"];

// Sous ce nombre de stagiaires en formation, un centre n'envoie aucun chiffre au siège.
export const SEUIL_SECRET = 5;

// Mention des centres masqués sous le titre du réseau : rien entre parenthèses quand aucun centre n'est masqué.
export function mentionMasques(masques) {
  if (!masques) return "";
  return ` (${masques} ${masques > 1 ? "centres" : "centre"})`;
}

const zeros = () => Object.fromEntries(CHAMPS_COMPTES.map((k) => [k, 0]));
const nb = (x) => (x == null ? 0 : Number(x));

// ind : le résultat de indicateursPromo (d'une promo, ou des données concaténées de plusieurs).
export function comptesDepuisIndicateurs(ind) {
  const ef = ind.effectif.detail;
  const ab = ind.absences.detail;
  const q = ind.reussiteQcm.detail;
  const ex = ind.examensQcm.detail;
  const no = ind.notes.detail;
  const { salle, vehicule } = ind.epcf.detail;
  return {
    inscrits: ef.inscrits, enFormation: ef.enFormation, abandons: ef.abandons,
    absences: ab.absences, prevus: ab.prevus,
    qcmBonnes: q.bonnes, qcmQuestions: q.questions,
    examensPasses: ex.passes, examensReussis: ex.reussis,
    notesN: no.n, notesSomme: no.somme, notesSous10: no.sous10,
    epcfAcquis: salle.A + vehicule.A,
    epcfRenseignes: salle.A + salle.R + salle.NA + vehicule.A + vehicule.R + vehicule.NA,
  };
}

// Une ligne de comptes_reseau (un centre) -> comptes (zéros pour une ligne masquée, dont les colonnes sont nulles).
export function versComptes(l) {
  return {
    lieuId: l.lieu_id, lieuNom: l.lieu_nom, demonstration: !!l.demonstration,
    promosEnCours: nb(l.promos_en_cours), masque: !!l.masque,
    inscrits: nb(l.inscrits), enFormation: nb(l.en_formation), abandons: nb(l.abandons),
    absences: nb(l.absences), prevus: nb(l.prevus),
    qcmBonnes: nb(l.qcm_bonnes), qcmQuestions: nb(l.qcm_questions),
    examensPasses: nb(l.examens_passes), examensReussis: nb(l.examens_reussis),
    notesN: nb(l.notes_n), notesSomme: nb(l.notes_somme), notesSous10: nb(l.notes_sous10),
    epcfAcquis: nb(l.epcf_acquis), epcfRenseignes: nb(l.epcf_renseignes),
  };
}

// Les lignes masquées n'apportent rien (le drapeau décide, jamais les chiffres qu'elles porteraient).
export function sommeComptes(liste) {
  const t = zeros();
  (liste || []).filter((c) => !c.masque).forEach((c) => CHAMPS_COMPTES.forEach((k) => { t[k] += nb(c[k]); }));
  return t;
}

const ratio = (num, den) => (den ? num / den : null);

// Mêmes ratios que les indicateurs de indicateursPromo (nombre ou null).
export function ratiosDeComptes(c) {
  return {
    abandon: ratio(c.abandons, c.inscrits),
    absences: ratio(c.absences, c.prevus),
    reussiteQcm: ratio(c.qcmBonnes, c.qcmQuestions),
    examensQcm: ratio(c.examensReussis, c.examensPasses),
    notes: ratio(c.notesSomme, c.notesN),
    epcf: ratio(c.epcfAcquis, c.epcfRenseignes),
  };
}

// Promo en cours : début au plus tard aujourd'hui, fin nulle ou à partir d'aujourd'hui (dates « AAAA-MM-JJ »).
export function promosEnCours(promos, aujourdhui) {
  return (promos || []).filter((p) => p.date_debut <= aujourdhui && (p.date_fin == null || p.date_fin >= aujourdhui));
}

// Données brutes de plusieurs promos (forme de lireDonneesCentre) en un seul jeu.
export function concatenerDonnees(liste) {
  const cles = ["stagiaires", "passages", "evaluations", "tentatives", "epcf"];
  return Object.fromEntries(cles.map((k) => [k, (liste || []).flatMap((d) => d[k] || [])]));
}

// lignes : les lignes de comptes_reseau. Centres triés par nom, hors démonstration (à part) ; le total n'additionne que les
// centres non masqués ; `masques` compte les centres qui ont une promo en cours mais trop peu de stagiaires en formation.
export function vueDuReseau(lignes) {
  const tous = (lignes || []).map(versComptes);
  const centres = tous.filter((c) => !c.demonstration).sort((a, b) => a.lieuNom.localeCompare(b.lieuNom, "fr"));
  return {
    centres,
    demonstration: tous.find((c) => c.demonstration) || null,
    total: sommeComptes(centres),
    masques: centres.filter((c) => c.masque && c.promosEnCours > 0).length,
  };
}
