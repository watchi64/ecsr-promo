// Calculs PURS du tableau de bord du centre (spec docs/superpowers/specs/
// 2026-10-23-tableau-de-bord-centre-design.md). Sans DOM ni réseau : testés en node
// (tests/centre-stats.test.mjs). Chaque indicateur porte sa méthode, écrite pour un
// lecteur de Qualiopi, et sa nature : mesuré (compté dans la base), estimé (hypothèse
// ou signal), non mesuré (l'app ne le sait pas).
//
// Population : les inscrits sont toutes les fiches de la promo, les « en formation » les
// fiches actives. Tout sauf l'effectif et les abandons porte sur les stagiaires en formation.

import { estNotee, score20, mediane } from "./notes-stats.js?v=20261023b";
import { NOTE_VALUES } from "./epcf-trames.js?v=20261023b";
import { compareByNom } from "./utils.js?v=20261023b";

// Hypothèse du réseau : un parcours de formation représente 3 500 à 5 000 €.
export const COUT_ABANDON_ESTIME = [3500, 5000];

const SEUIL_EXAMEN_DEFAUT = 15;
const MIN_REPONSES_THEME = 20;
const MIN_NOTES_THEME = 3;
const THEMES_PAR_LISTE = 5;
const JOURS_INACTIVITE = 14;
const SIGNAL_ABSENCES = 2;
const SIGNAL_MIN_NOTES = 3;
const SIGNAL_RETARD = 2;
const SIGNAUX_A_SUIVRE = 2;

export const METHODES = {
  effectif: "Inscrits : toutes les fiches de la promo. En formation : les fiches actives. Abandons : les fiches passées en abandon.",
  abandon: "Abandons divisés par les inscrits. La date de l'abandon n'est pas enregistrée dans l'app : le taux porte sur toute la durée de la promo.",
  valeurAbandons: "Nombre d'abandons multiplié par 3 500 à 5 000 €, hypothèse du coût d'un parcours de formation. C'est un ordre de grandeur, pas un montant comptable.",
  absences: "Absences de dernière minute divisées par les passages prévus (passages faits plus absences), stagiaires en formation. Ne couvre que les passages en salle et en voiture, pas la présence en formation : l'émargement la couvrira.",
  passages: "Passages faits plus remplacements (bonus), en salle et en voiture, rapportés aux stagiaires en formation ; plus bas et plus haut nombre d'une personne.",
  activiteQcm: "Stagiaires en formation qui ont fait au moins un QCM d'entraînement, divisés par les stagiaires en formation.",
  reussiteQcm: "Bonnes réponses divisées par les questions répondues, sur tous les QCM d'entraînement des stagiaires en formation.",
  examensQcm: "Examens QCM passés par les stagiaires en formation ; réussi quand la note atteint le seuil du QCM (15/20 par défaut). Moyenne des notes d'examen sur 20.",
  notes: "Toutes les notes des stagiaires en formation ramenées sur 20 (une note sans barème est ignorée) : moyenne, médiane, nombre de notes sous 10. Même règle que la synthèse de la page Notes.",
  epcf: "Par grille (salle, véhicule) : la dernière évaluation EPCF de chaque stagiaire en formation, hors auto-évaluation. Critères acquis divisés par les critères renseignés ; score : acquis 2, à renforcer 1, non acquis 0, ramené à 100 %.",
  titre: "Les résultats de jury du titre professionnel ne sont pas saisis dans l'app.",
  themes: "D'après les QCM : bonnes réponses divisées par les questions répondues, thèmes d'au moins 20 réponses. D'après les notes : moyenne sur 20, thèmes d'au moins 3 notes. Stagiaires en formation.",
  aSuivre: "Au moins deux signaux parmi quatre : deux absences de dernière minute ou plus ; moyenne des notes sous 10 (au moins 3 notes) ; aucun QCM d'entraînement depuis 14 jours alors que la promo en a fait ; au moins 2 tours de retard sur la moyenne en salle ou en voiture (compteur de la page Priorités). Un repère pour le formateur, pas une prédiction.",
};

const somme = (l) => l.reduce((a, b) => a + b, 0);
const ratio = (num, den) => (den ? num / den : null);
const fr1 = (x) => x.toFixed(1).replace(".", ",");
const pct = (x) => Math.round(x * 100) + " %";
const jourDe = (horodatage) => String(horodatage || "").slice(0, 10);

function decalerJour(iso, jours) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function indicateur(cle, valeur, detail, nature = "mesuré", n = null) {
  return { valeur, detail, nature, methode: METHODES[cle], n };
}

// donnees : { stagiaires, passages, evaluations, tentatives, epcf } (lireDonneesCentre)
// referentiel : { qcm, themes } (lireReferentielCentre) ; aujourdhui : « AAAA-MM-JJ ».
export function indicateursPromo(donnees, referentiel, { aujourdhui }) {
  const stagiaires = donnees.stagiaires || [];
  const enFormation = stagiaires.filter((s) => s.actif);
  const ids = new Set(enFormation.map((s) => s.id));
  const nbForm = enFormation.length;
  const abandons = stagiaires.length - nbForm;
  const dedans = (r) => ids.has(r.stagiaire_id);

  const passages = (donnees.passages || []).filter(dedans);
  const evaluations = (donnees.evaluations || []).filter(dedans);
  const tentatives = (donnees.tentatives || []).filter(dedans);
  const entrainements = tentatives.filter((t) => t.mode === "entrainement");
  const examens = tentatives.filter((t) => t.mode === "examen");
  const qcmParId = new Map((referentiel.qcm || []).map((q) => [q.id, q]));
  const themeParId = new Map((referentiel.themes || []).map((t) => [t.id, t]));
  const themeParNum = new Map((referentiel.themes || []).filter((t) => t.numero != null && t.type === "theme")
    .map((t) => [t.numero, t]));

  // --- Passages par stagiaire et par type ---
  const parStag = new Map(enFormation.map((s) => [s.id, {
    Salle: { fait: 0, absence: 0, bonus: 0 }, Voiture: { fait: 0, absence: 0, bonus: 0 } }]));
  passages.forEach((p) => {
    const c = parStag.get(p.stagiaire_id)?.[p.type];
    if (!c) return;
    if (p.resultat === "Effectué") c.fait++;
    else if (p.resultat === "Absence") c.absence++;
    else if (p.resultat === "Bonus") c.bonus++;
  });
  const comptes = [...parStag.values()];
  const nbAbsences = somme(comptes.map((c) => c.Salle.absence + c.Voiture.absence));
  const nbPrevus = somme(comptes.map((c) => c.Salle.fait + c.Salle.absence + c.Voiture.fait + c.Voiture.absence));
  const realises = (type) => comptes.map((c) => c[type].fait + c[type].bonus);
  const resumeType = (type) => {
    const l = realises(type);
    return nbForm ? { total: somme(l), moyenne: somme(l) / nbForm, min: Math.min(...l), max: Math.max(...l) } : null;
  };
  const salle = resumeType("Salle");
  const voiture = resumeType("Voiture");
  const nbRealises = salle ? salle.total + voiture.total : 0;

  // --- QCM ---
  const questions = somme(entrainements.map((t) => Number(t.total) || 0));
  const bonnes = somme(entrainements.map((t) => Number(t.score) || 0));
  const actifsQcm = new Set(entrainements.map((t) => t.stagiaire_id)).size;
  const seuil = (t) => {
    const s = qcmParId.get(t.qcm_id)?.exam_pass_20;
    return s == null ? SEUIL_EXAMEN_DEFAUT : Number(s);
  };
  const reussis = examens.filter((t) => Number(t.note_20) >= seuil(t)).length;

  // --- Notes ---
  const notees = evaluations.filter(estNotee);
  const scores = notees.map(score20);

  // --- EPCF : dernière évaluation EPCF (hors auto-évaluation) de chaque stagiaire ---
  const epcfTrame = (trame) => {
    const dernieres = new Map();
    (donnees.epcf || []).filter((e) => dedans(e) && e.trame === trame && e.contexte === "EPCF" && !e.auto_eval)
      .forEach((e) => {
        const d = dernieres.get(e.stagiaire_id);
        if (!d || e.date_eval > d.date_eval || (e.date_eval === d.date_eval && e.id > d.id)) dernieres.set(e.stagiaire_id, e);
      });
    const c = { A: 0, R: 0, NA: 0 };
    dernieres.forEach((e) => Object.values(e.scores || {}).forEach((v) => { if (v in c) c[v]++; }));
    const nb = c.A + c.R + c.NA;
    const points = c.A * NOTE_VALUES.A + c.R * NOTE_VALUES.R + c.NA * NOTE_VALUES.NA;
    return { evalues: dernieres.size, enFormation: nbForm, ...c, score: nb ? points / (nb * 2) : null };
  };
  const epcfSalle = epcfTrame("salle");
  const epcfVehicule = epcfTrame("vehicule");
  const critA = epcfSalle.A + epcfVehicule.A;
  const critTous = critA + epcfSalle.R + epcfVehicule.R + epcfSalle.NA + epcfVehicule.NA;

  const ind = {
    effectif: indicateur("effectif", stagiaires.length, { inscrits: stagiaires.length, enFormation: nbForm, abandons }),
    abandon: indicateur("abandon", ratio(abandons, stagiaires.length), { abandons, inscrits: stagiaires.length },
      "mesuré", stagiaires.length),
    valeurAbandons: indicateur("valeurAbandons",
      stagiaires.length ? COUT_ABANDON_ESTIME.map((c) => c * abandons) : null, { abandons }, "estimé"),
    absences: indicateur("absences", ratio(nbAbsences, nbPrevus), { absences: nbAbsences, prevus: nbPrevus },
      "mesuré", nbPrevus),
    passages: indicateur("passages", nbRealises ? nbRealises / nbForm : null, { salle, voiture }, "mesuré", nbForm),
    activiteQcm: indicateur("activiteQcm", entrainements.length ? actifsQcm / nbForm : null,
      { actifs: actifsQcm, enFormation: nbForm, tentatives: entrainements.length, questions }, "mesuré", nbForm),
    reussiteQcm: indicateur("reussiteQcm", ratio(bonnes, questions), { bonnes, questions }, "mesuré", questions),
    examensQcm: indicateur("examensQcm", ratio(reussis, examens.length), {
      passes: examens.length, reussis,
      moyenne20: examens.length ? somme(examens.map((t) => Number(t.note_20))) / examens.length : null,
    }, "mesuré", examens.length),
    notes: indicateur("notes", scores.length ? somme(scores) / scores.length : null, {
      n: scores.length, mediane: mediane(scores), sous10: scores.filter((s) => s < 10).length,
    }, "mesuré", scores.length),
    epcf: indicateur("epcf", ratio(critA, critTous), { salle: epcfSalle, vehicule: epcfVehicule }, "mesuré", critTous),
    titre: indicateur("titre", null, null, "non mesuré"),
  };

  ind.themes = themesPromo(entrainements, notees, qcmParId, themeParId, themeParNum);
  ind.aSuivre = stagiairesASuivre({ enFormation, parStag, entrainements, notees, aujourdhui });
  return ind;
}

function themesPromo(entrainements, notees, qcmParId, themeParId, themeParNum) {
  const lignes = new Map();   // clé : numéro du thème, sinon « id:<theme_id> »
  const ligne = (cle, num, titre) => {
    if (!lignes.has(cle)) lignes.set(cle, { num, titre, bonnes: 0, questions: 0, notes: [] });
    return lignes.get(cle);
  };
  entrainements.forEach((t) => {
    const th = themeParId.get(qcmParId.get(t.qcm_id)?.theme_id);
    if (!th) return;
    const l = ligne(th.numero != null ? th.numero : "id:" + th.id, th.numero ?? null, th.titre);
    l.bonnes += Number(t.score) || 0;
    l.questions += Number(t.total) || 0;
  });
  notees.forEach((e) => {
    if (e.type !== "Thème" || e.theme_numero == null) return;
    ligne(e.theme_numero, e.theme_numero, themeParNum.get(e.theme_numero)?.titre || "Thème " + e.theme_numero)
      .notes.push(score20(e));
  });
  const complet = [...lignes.values()].map((l) => ({
    num: l.num, titre: l.titre,
    qcmTaux: ratio(l.bonnes, l.questions), qcmN: l.questions,
    notesMoy: l.notes.length ? somme(l.notes) / l.notes.length : null, notesN: l.notes.length,
  })).sort((a, b) => (a.num ?? 999) - (b.num ?? 999) || a.titre.localeCompare(b.titre, "fr"));
  const qcm = complet.filter((t) => t.qcmN >= MIN_REPONSES_THEME)
    .sort((a, b) => a.qcmTaux - b.qcmTaux || b.qcmN - a.qcmN)
    .slice(0, THEMES_PAR_LISTE).map((t) => ({ num: t.num, titre: t.titre, taux: t.qcmTaux, n: t.qcmN }));
  const notes = complet.filter((t) => t.notesN >= MIN_NOTES_THEME)
    .sort((a, b) => a.notesMoy - b.notesMoy || b.notesN - a.notesN)
    .slice(0, THEMES_PAR_LISTE).map((t) => ({ num: t.num, titre: t.titre, moyenne: t.notesMoy, n: t.notesN }));
  return { qcm, notes, complet };
}

function stagiairesASuivre({ enFormation, parStag, entrainements, notees, aujourdhui }) {
  if (!enFormation.length) return [];
  const debutFenetre = decalerJour(aujourdhui, -JOURS_INACTIVITE);
  const dansFenetre = (t) => { const j = jourDe(t.finished_at); return j > debutFenetre && j <= aujourdhui; };
  const promoActive = entrainements.some(dansFenetre);
  // Compteur de la page Priorités : faits + bonus + absences ; objectif = moyenne arrondie.
  const prio = (c) => c.fait + c.bonus + c.absence;
  const objectif = (type) => Math.round(somme(enFormation.map((s) => prio(parStag.get(s.id)[type]))) / enFormation.length);
  const objSalle = objectif("Salle");
  const objVoiture = objectif("Voiture");

  const out = [];
  enFormation.forEach((s) => {
    const c = parStag.get(s.id);
    const signaux = [];
    const abs = c.Salle.absence + c.Voiture.absence;
    if (abs >= SIGNAL_ABSENCES) {
      signaux.push({ code: "absences", texte: `${abs} absences de dernière minute aux passages` });
    }
    const mesNotes = notees.filter((e) => e.stagiaire_id === s.id).map(score20);
    if (mesNotes.length >= SIGNAL_MIN_NOTES) {
      const moy = somme(mesNotes) / mesNotes.length;
      if (moy < 10) signaux.push({ code: "notes", texte: `Moyenne des notes : ${fr1(moy)}/20 (${mesNotes.length} notes)` });
    }
    if (promoActive) {
      const miens = entrainements.filter((t) => t.stagiaire_id === s.id);
      if (!miens.some(dansFenetre)) {
        signaux.push({ code: "inactivite", texte: miens.length
          ? `Aucun entraînement QCM depuis ${JOURS_INACTIVITE} jours` : "Aucun entraînement QCM" });
      }
    }
    const retards = [];
    const rs = objSalle - prio(c.Salle);
    const rv = objVoiture - prio(c.Voiture);
    if (rs >= SIGNAL_RETARD) retards.push(`${rs} tours en salle`);
    if (rv >= SIGNAL_RETARD) retards.push(`${rv} tours en voiture`);
    if (retards.length) signaux.push({ code: "retard", texte: "Retard de passages : " + retards.join(", ") });
    if (signaux.length >= SIGNAUX_A_SUIVRE) out.push({ stagiaire: s, signaux });
  });
  return out.sort((a, b) => b.signaux.length - a.signaux.length || compareByNom(a.stagiaire, b.stagiaire));
}

// Textes courts du tableau de comparaison des promos.
export function ligneComparaison(ind) {
  const rien = "aucune donnée";
  const e = ind.effectif.valeur;
  const ex = ind.examensQcm.detail;
  return {
    effectif: `${e} inscrit${e > 1 ? "s" : ""}`,
    abandon: ind.abandon.valeur == null ? rien : `${pct(ind.abandon.valeur)} (${ind.abandon.detail.abandons})`,
    absences: ind.absences.valeur == null ? rien : pct(ind.absences.valeur),
    passages: ind.passages.valeur == null ? rien : `${fr1(ind.passages.valeur)} par stagiaire`,
    reussiteQcm: ind.reussiteQcm.valeur == null ? rien : pct(ind.reussiteQcm.valeur),
    examensQcm: ind.examensQcm.valeur == null ? rien : `${pct(ind.examensQcm.valeur)} (${ex.reussis}/${ex.passes})`,
    notes: ind.notes.valeur == null ? rien : `${fr1(ind.notes.valeur)}/20`,
    epcf: ind.epcf.valeur == null ? rien : `${pct(ind.epcf.valeur)} acquis`,
  };
}
