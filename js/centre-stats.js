// Calculs PURS du tableau de bord du centre (spec docs/superpowers/specs/
// 2026-10-23-tableau-de-bord-centre-design.md). Sans DOM ni réseau : testés en node
// (tests/centre-stats.test.mjs). Chaque indicateur porte sa méthode, écrite pour un
// lecteur de Qualiopi, et sa nature : mesuré (compté dans la base), estimé (hypothèse
// ou signal), non mesuré (l'app ne le sait pas).
//
// Population : les inscrits sont toutes les fiches de la promo, les « en formation » les
// fiches actives. Tout sauf l'effectif et les abandons porte sur les stagiaires en formation.

import { estNotee, score20, mediane } from "./notes-stats.js?v=20261114f";
import { NOTE_VALUES } from "./epcf-trames.js?v=20261114f";
import { compareByNom } from "./utils.js?v=20261114f";
import { fr1, pct } from "./nombres.js?v=20261114f";
import { presenceDesFeuilles, RAISONS_ABSENCE } from "./presence-rules.js?v=20261114f";
import { libelleDuree } from "./emargement-rules.js?v=20261114f";

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
  effectif: "Inscrits : toutes les fiches de la promo. En formation : les fiches actives. Abandons : les fiches passées en abandon par l'équipe. Les fiches effacées à la demande de la personne sont comptées parmi les inscrits, à part : ni en formation, ni en abandon.",
  abandon: "Abandons divisés par les inscrits. Seule la décision de l'équipe compte : un effacement de données, à la demande de la personne ou au terme de la durée de conservation, n'est pas un abandon. La date de l'abandon n'est pas enregistrée dans l'app : le taux porte sur toute la durée de la promo.",
  valeurAbandons: "Nombre d'abandons multiplié par 3 500 à 5 000 €, hypothèse du coût d'un parcours de formation. C'est un ordre de grandeur, pas un montant comptable.",
  absences: "Absences de dernière minute divisées par les passages prévus (passages faits plus absences), stagiaires en formation. Ne couvre que les passages en salle et en voiture ; la présence en formation est le taux de présence, tiré des feuilles d'émargement.",
  passages: "Passages faits plus remplacements (bonus), en salle et en voiture, rapportés aux stagiaires en formation ; plus bas et plus haut nombre d'une personne.",
  activiteQcm: "Stagiaires en formation qui ont fait au moins un QCM d'entraînement, divisés par les stagiaires en formation.",
  reussiteQcm: "Bonnes réponses divisées par les questions répondues, sur tous les QCM d'entraînement des stagiaires en formation.",
  examensQcm: "Examens QCM passés par les stagiaires en formation ; réussi quand la note atteint le seuil du QCM (15/20 par défaut). Moyenne des notes d'examen sur 20.",
  notes: "Toutes les notes des stagiaires en formation ramenées sur 20 (une note sans barème est ignorée) : moyenne, médiane, nombre de notes sous 10. Même règle que la synthèse de la page Notes.",
  epcf: "Par grille (salle, véhicule) : la dernière évaluation EPCF de chaque stagiaire en formation, hors auto-évaluation. Critères acquis divisés par les critères renseignés ; score : acquis 2, à renforcer 1, non acquis 0, ramené à 100 %.",
  titre: "Titres obtenus divisés par les stagiaires présentés au jury (absents exclus), d'après les résultats saisis par l'équipe : une ligne par stagiaire, son dernier passage devant le jury. Les validations partielles (un CCP acquis) sont dites à côté, sans compter comme obtention. Les stagiaires sans résultat saisi ne comptent pas.",
  presence: "Heures réalisées divisées par heures prévues, sur les feuilles d'émargement closes de la promo, toutes lignes comprises : un stagiaire parti figure sur les feuilles jusqu'à son départ.",
  satisfaction: "Réponses favorables (plutôt oui, tout à fait) à la question globale du questionnaire de fin de formation, divisées par les avis notés (« sans avis » exclu) ; réponses enregistrées sans nom ; résultat affiché à partir de 5 avis notés.",
  themes: "D'après les QCM : bonnes réponses divisées par les questions répondues, thèmes d'au moins 20 réponses. D'après les notes : moyenne sur 20, thèmes d'au moins 3 notes. Stagiaires en formation.",
  aSuivre: "Au moins deux difficultés parmi quatre : deux absences de dernière minute ou plus ; moyenne des notes sous 10 (au moins 3 notes) ; aucun QCM d'entraînement depuis 14 jours alors que la promo en a fait ; au moins 2 tours de retard sur la moyenne en salle ou en voiture (compteur de la page Ordre de passage). Un repère pour le formateur, pas une prédiction.",
};

// Les mêmes méthodes, écrites pour le public : la fiche « résultats » que le centre publie (js/qualiopi-resultats.js, spec
// 2026-10-28, § 6.6 et 6.8). Mêmes clés que METHODES (un seul endroit à tenir à jour : toute clé d'ici existe là-bas), mais
// impersonnelles et sans mot d'équipe : ni « fiche », ni « app », ni « promo », ni jargon.
export const METHODES_PUBLIQUES = {
  effectif: "Nombre de stagiaires inscrits à la formation, y compris ceux qui l'ont quittée avant la fin.",
  abandon: "Nombre de stagiaires qui ont quitté la formation avant la fin, divisé par le nombre de stagiaires inscrits. Le taux porte sur toute la durée de la formation : la date du départ n'est pas retenue.",
  presence: "Heures réalisées divisées par les heures prévues, d'après les feuilles d'émargement clôturées de la formation. Un stagiaire qui a quitté la formation compte jusqu'à son départ.",
  titre: "Nombre de stagiaires déclarés admis par le jury du titre professionnel, divisé par le nombre de stagiaires présentés à l'examen.",
  satisfaction: "Avis des stagiaires recueillis par le questionnaire de fin de formation, anonyme : part des réponses favorables, calculée sur les stagiaires qui ont donné un avis. Aucun résultat n'est publié sous 5 avis notés.",
};

const somme = (l) => l.reduce((a, b) => a + b, 0);
const ratio = (num, den) => (den ? num / den : null);
const jourDe = (horodatage) => String(horodatage || "").slice(0, 10);

function decalerJour(iso, jours) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

// L'effectif d'une promo d'après ses fiches : { inscrits, enFormation, abandons }. Une SEULE définition, pour que la même promo
// affiche le même nombre partout (Vue d'ensemble, page Promos de la direction, comparaison du siège, comptes_reseau) : en formation
// = fiche active ; abandons = toutes les autres fiches, y compris une fiche anonymisée (elle a été en abandon avant de l'être).
export function effectifDesFiches(fiches) {
  const lignes = fiches || [];
  const enFormation = lignes.filter((s) => s.actif).length;
  return { inscrits: lignes.length, enFormation, abandons: lignes.length - enFormation };
}

function indicateur(cle, valeur, detail, nature = "mesuré", n = null) {
  return { valeur, detail, nature, methode: METHODES[cle], n };
}

// donnees : { stagiaires, passages, evaluations, tentatives, epcf } (lireDonneesCentre)
// referentiel : { qcm, themes } (lireReferentielCentre) ; aujourdhui : « AAAA-MM-JJ ».
// demandes : Set des identifiants de fiches effacées à la demande (lireEffacementsSurDemande) ; absent, ensemble vide.
// Une telle fiche est un inscrit, ni en formation ni abandon : comptée à part (effectif.detail.surDemande). Un abandon est une
// décision de l'équipe (`actif` à faux) ; les étapes d'effacement ne touchent jamais `actif` et ne font pas bouger le taux d'abandon.
export function indicateursPromo(donnees, referentiel, { aujourdhui, demandes } = {}) {
  const surDemandeIds = demandes instanceof Set ? demandes : new Set(demandes || []);
  const stagiaires = donnees.stagiaires || [];
  const surDemande = stagiaires.filter((s) => surDemandeIds.has(s.id)).length;
  const enFormation = stagiaires.filter((s) => s.actif && !surDemandeIds.has(s.id));
  const ids = new Set(enFormation.map((s) => s.id));
  const nbForm = enFormation.length;
  // Abandons au sens de la Vue d'ensemble (effectifDesFiches), hors fiches effacées à la demande.
  const { abandons } = effectifDesFiches(stagiaires.filter((s) => !surDemandeIds.has(s.id)));
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
  const parStag = passagesParStagiaire(enFormation, passages);
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
    // Une évaluation sans date n'est pas retenue (sinon l'ordre de lecture déciderait) ; ordre : date_eval desc, id desc.
    (donnees.epcf || []).filter((e) => dedans(e) && e.trame === trame && e.contexte === "EPCF" && !e.auto_eval
      && e.date_eval != null)
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

  // --- Présence d'après les feuilles d'émargement (même calcul que la fiche résultats Qualiopi et les attestations) ---
  const pres = presenceDesFeuilles(donnees.emargement);
  const presMesuree = pres.etat === "mesuree";

  const ind = {
    effectif: indicateur("effectif", stagiaires.length, { inscrits: stagiaires.length, enFormation: nbForm, abandons, surDemande }),
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
      n: scores.length, somme: somme(scores), mediane: mediane(scores), sous10: scores.filter((s) => s < 10).length,
    }, "mesuré", scores.length),
    epcf: indicateur("epcf", ratio(critA, critTous), { salle: epcfSalle, vehicule: epcfVehicule }, "mesuré", critTous),
    titre: indicateurTitre(donnees.jury),
    // Toutes les lignes des feuilles closes (stagiaires partis compris) : la population n'est pas celle « en formation ».
    presence: indicateur("presence", presMesuree ? pres.taux : null, {
      etat: pres.etat, motif: pres.motif ?? null, ouvertes: pres.ouvertes ?? 0, feuilles: pres.feuilles ?? 0,
      effectif: pres.effectif ?? 0, prevuesMin: pres.prevuesMin ?? 0, realiseesMin: pres.realiseesMin ?? 0,
    }, presMesuree ? "mesuré" : "non mesuré", presMesuree ? pres.effectif : null),
  };

  ind.themes = themesPromo(entrainements, notees, qcmParId, themeParId, themeParNum);
  ind.aSuivre = aSuivrePromo(donnees, referentiel, { aujourdhui });
  return ind;
}

// Passages de chaque stagiaire en formation, par type (fait, absence, bonus).
function passagesParStagiaire(enFormation, passages) {
  const parStag = new Map(enFormation.map((s) => [s.id, {
    Salle: { fait: 0, absence: 0, bonus: 0 }, Voiture: { fait: 0, absence: 0, bonus: 0 } }]));
  passages.forEach((p) => {
    const c = parStag.get(p.stagiaire_id)?.[p.type];
    if (!c) return;
    if (p.resultat === "Effectué") c.fait++;
    else if (p.resultat === "Absence") c.absence++;
    else if (p.resultat === "Bonus") c.bonus++;
  });
  return parStag;
}

// « À suivre de près » d'UNE promo (lot 5, D8) : l'objectif de passages et l'activité aux QCM sont ceux de cette promo, jamais
// ceux d'un mélange de promos à des stades différents. Même filtre que indicateursPromo (stagiaires en formation de la promo).
// donnees : { stagiaires, passages, evaluations, tentatives } (lireDonneesCentre) ; le référentiel n'y sert pas, il est pris
// pour que les deux fonctions aient la même forme d'appel.
export function aSuivrePromo(donnees, referentiel, { aujourdhui }) {
  const enFormation = (donnees.stagiaires || []).filter((s) => s.actif);
  const ids = new Set(enFormation.map((s) => s.id));
  const dedans = (r) => ids.has(r.stagiaire_id);
  const entrainements = (donnees.tentatives || []).filter((t) => dedans(t) && t.mode === "entrainement");
  const notees = (donnees.evaluations || []).filter(dedans).filter(estNotee);
  const parStag = passagesParStagiaire(enFormation, (donnees.passages || []).filter(dedans));
  return stagiairesASuivre({ enFormation, parStag, entrainements, notees, aujourdhui });
}

// Les listes « À suivre » de plusieurs promos en une seule, chaque personne gardant sa promo. Tri : plus de signaux d'abord,
// puis par nom. parPromo : [{ promoId, promoNom, liste }] (liste = sortie de aSuivrePromo).
export function fusionnerASuivre(parPromo) {
  return (parPromo || [])
    .flatMap((p) => (p.liste || []).map((x) => ({ ...x, promoId: p.promoId, promoNom: p.promoNom })))
    .sort((a, b) => b.signaux.length - a.signaux.length || compareByNom(a.stagiaire, b.stagiaire));
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
  // Compteur de la page Ordre de passage (js/ordre-passage-rules.js, règle du placement depuis le 11/11) : faits + absences,
  // le bonus ne compte pas ; objectif = moyenne arrondie.
  const prio = (c) => c.fait + c.absence;
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
// --- Résultats du jury du titre professionnel (migration 20261114_jury_resultats) ---
// Libellés des quatre résultats, dans l'ordre de la saisie.
export const RESULTATS_JURY = [
  ["obtenu", "Titre obtenu"],
  ["partiel", "Validation partielle"],
  ["non_obtenu", "Non obtenu"],
  ["absent", "Absent au jury"],
];

// Les comptes du jury d'après ses lignes ({ etat: "lue", lignes } ou { etat: "non_lue" }, posé par lireDonneesCentre).
// Présentés : toute ligne sauf « absent ». Une lecture en échec (ou absente) rend { etat: "non_lue" }, jamais des zéros.
export function bilanJury(jury) {
  if (!jury || jury.etat !== "lue" || !Array.isArray(jury.lignes)) return { etat: "non_lue" };
  const l = jury.lignes;
  const compte = (r) => l.filter((x) => x.resultat === r).length;
  const sessions = l.map((x) => x.session_le).filter(Boolean).sort();
  const obtenus = compte("obtenu");
  const partiels = compte("partiel");
  const nonObtenus = compte("non_obtenu");
  const absents = compte("absent");
  return {
    etat: "lue", saisis: l.length, presentes: obtenus + partiels + nonObtenus, obtenus, partiels, nonObtenus, absents,
    premiere: sessions[0] ?? null, derniere: sessions[sessions.length - 1] ?? null,
  };
}

// Indicateur « Réussite au titre » : obtenus / présentés ; « non mesuré » sans présenté (rien de saisi, ou des absents seulement)
// ou quand la lecture a échoué (detail.etat le dit).
export function indicateurTitre(jury) {
  const b = bilanJury(jury);
  const mesure = b.etat === "lue" && b.presentes > 0;
  return indicateur("titre", mesure ? b.obtenus / b.presentes : null, b, mesure ? "mesuré" : "non mesuré", mesure ? b.presentes : null);
}

// Les lignes du jury de plusieurs promos en une seule entrée (Vue d'ensemble de la direction) : une lecture en échec rend le tout
// « non lu ».
export function fusionnerJury(liste) {
  const l = liste || [];
  if (l.some((j) => !j || j.etat !== "lue" || !Array.isArray(j.lignes))) return { etat: "non_lue" };
  return { etat: "lue", lignes: l.flatMap((j) => j.lignes) };
}

// La ligne d'explication de la carte « Réussite au titre ».
export function texteTitreDetail(titre) {
  const d = titre?.detail;
  if (!d || d.etat !== "lue") return "Les résultats du jury n'ont pas pu être lus.";
  if (!d.saisis) return "Aucun résultat de jury saisi.";
  const morceaux = [`${d.obtenus} obtenu${d.obtenus > 1 ? "s" : ""} sur ${d.presentes} présenté${d.presentes > 1 ? "s" : ""}`];
  if (d.partiels) morceaux.push(`${d.partiels} validation${d.partiels > 1 ? "s" : ""} partielle${d.partiels > 1 ? "s" : ""}`);
  if (d.absents) morceaux.push(`${d.absents} absent${d.absents > 1 ? "s" : ""}`);
  return morceaux.join(" · ");
}

// Le titre en quelques mots, pour une case de tableau.
export function texteTitreCourt(titre) {
  const d = titre?.detail;
  if (titre?.valeur != null) return `${pct(titre.valeur)} (${d.obtenus}/${d.presentes})`;
  if (!d || d.etat !== "lue") return "non lu";
  return d.saisis ? "aucun présenté" : "non saisi";
}

// La présence en quelques mots, pour une case de tableau : le taux, ou pourquoi il manque. Une présence absente des
// indicateurs (appelant qui n'a pas lu les feuilles) se dit « non lue », jamais « aucune feuille ».
export function textePresenceCourt(presence) {
  const d = presence?.detail;
  if (presence?.valeur != null) return pct(presence.valeur);
  if (!d || d.etat === "non_lue") return "non lue";
  if (d.motif === "ouvertes") return "feuilles encore ouvertes";
  if (d.motif === "sans_ligne") return "aucune ligne signée";
  return "émargement non utilisé";
}

// La ligne d'explication de la carte « Taux de présence » : les heures et l'effectif, ou la raison de l'absence de mesure
// (mêmes phrases que le dossier Qualiopi, RAISONS_ABSENCE).
export function textePresenceDetail(presence) {
  const d = presence?.detail;
  if (presence?.valeur != null && d) {
    return `${libelleDuree(d.realiseesMin)} réalisées sur ${libelleDuree(d.prevuesMin)} prévues · `
      + `${d.feuilles} feuille${d.feuilles > 1 ? "s" : ""} close${d.feuilles > 1 ? "s" : ""} · `
      + `${d.effectif} stagiaire${d.effectif > 1 ? "s" : ""}`
      + (d.ouvertes ? ` · ${d.ouvertes} encore ouverte${d.ouvertes > 1 ? "s" : ""}, non comptée${d.ouvertes > 1 ? "s" : ""}` : "");
  }
  if (!d || d.etat === "non_lue") return "Les feuilles d'émargement n'ont pas pu être lues.";
  const raison = RAISONS_ABSENCE[d.motif] ?? RAISONS_ABSENCE.aucune;
  return raison.charAt(0).toUpperCase() + raison.slice(1) + ".";
}

export function ligneComparaison(ind) {
  const rien = "aucune donnée";
  const e = ind.effectif.valeur;
  const ex = ind.examensQcm.detail;
  const sd = ind.effectif.detail?.surDemande || 0;
  return {
    effectif: `${e} inscrit${e > 1 ? "s" : ""}` + (sd ? ` (dont ${sd} effacée${sd > 1 ? "s" : ""} à la demande)` : ""),
    abandon: ind.abandon.valeur == null ? rien : `${pct(ind.abandon.valeur)} (${ind.abandon.detail.abandons})`,
    absences: ind.absences.valeur == null ? rien : pct(ind.absences.valeur),
    passages: ind.passages.valeur == null ? rien : `${fr1(ind.passages.valeur)} par stagiaire`,
    reussiteQcm: ind.reussiteQcm.valeur == null ? rien : pct(ind.reussiteQcm.valeur),
    examensQcm: ind.examensQcm.valeur == null ? rien : `${pct(ind.examensQcm.valeur)} (${ex.reussis}/${ex.passes})`,
    notes: ind.notes.valeur == null ? rien : `${fr1(ind.notes.valeur)}/20`,
    epcf: ind.epcf.valeur == null ? rien : `${pct(ind.epcf.valeur)} acquis`,
    presence: textePresenceCourt(ind.presence),
    titre: texteTitreCourt(ind.titre),
  };
}
