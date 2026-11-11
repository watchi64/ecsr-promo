// La liste « Tes QCM » du stagiaire (sous-onglet QCM de Cours et QCM, lot 2B) : règles pures, testées dans
// tests/qcm-stagiaire-rules.test.mjs. Quels QCM, dans quel ordre, avec quelle phrase d'état. L'affichage
// (js/views/qcm-stagiaire.js) ne fait que les poser.

import { examenDemarrable } from "./qcm-exam-rules.js?v=20261111h";
import { dixieme } from "./nombres.js?v=20261111h";

/** Un QCM transversal (sanctions, psychologie, pédagogie...) : une notion de la formation, sans numéro de thème. */
export function estTransversal(theme) {
  return theme?.type === "notion" && theme?.categorie === "QCM transversal";
}

/**
 * Le titre sous lequel un QCM se présente : « Thème 22 · Feux du véhicule » pour un thème numéroté, le titre de la notion
 * pour un transversal. Le titre du QCM lui-même ne sert que si le thème est introuvable : il répète presque toujours celui
 * du thème, et le thème dit en plus de quoi il s'agit.
 */
export function titreDuQcm(theme, qcm) {
  if (theme && theme.numero != null) return `Thème ${theme.numero} · ${theme.titre}`;
  if (theme?.titre) return theme.titre;
  return qcm?.titre || (qcm?.id != null ? `QCM n° ${qcm.id}` : "QCM");
}

// 13.5 -> « 13,5 », 14 -> « 14 » : l'écriture de la page (une note ne prend qu'une décimale).
function noteEnFrancais(n) {
  return dixieme(n);
}

// Dernière tentative d'ENTRAÎNEMENT de chaque QCM, par date de fin : c'est elle que la ligne dit, pas la meilleure
// (l'élève veut savoir où il en est, pas se rassurer). Une tentative d'examen compte à part dans la fiche du QCM.
function dernieresTentatives(tentatives) {
  const parQcm = new Map();
  for (const t of Array.isArray(tentatives) ? tentatives : []) {
    if (t?.mode !== "entrainement" || t.note_20 == null || Number.isNaN(Number(t.note_20))) continue;
    const quand = Date.parse(t.finished_at);
    const vue = parQcm.get(t.qcm_id);
    if (!vue || (Number.isFinite(quand) ? quand : -Infinity) > vue.quand) parQcm.set(t.qcm_id, { note: Number(t.note_20), quand: Number.isFinite(quand) ? quand : -Infinity });
  }
  return parQcm;
}

/**
 * Les lignes de la liste « Tes QCM » : { theme, qcm, titre, etiquette, etat, note, examenOuvert, action }.
 * - `action` : « Voir le QCM » (le bouton ouvre la fiche du QCM, pas l'examen ; nom accessible « Voir le QCM : titre ») ;
 * - ne gardent que les QCM qui ont au moins une question ;
 * - `etat` : « Pas encore fait » ou « Dernière note 14/20 » (dernier entraînement) ;
 * - `examenOuvert` : la règle de la fenêtre d'examen (examenDemarrable), à l'heure `now` ;
 * - `etiquette` : « Transversal » pour les QCM qui ne sont pas un thème numéroté, sinon null ;
 * - ordre : examens ouverts, puis jamais faits, puis faits ; dans chaque groupe par numéro de thème, les transversaux
 *   ensuite, par titre.
 */
export function lignesQcmStagiaire({ qcm = [], themes = [], tentatives = [], now = Date.now() } = {}) {
  const themeDe = new Map((themes || []).map((t) => [t.id, t]));
  const dernieres = dernieresTentatives(tentatives);
  const lignes = (qcm || []).filter((q) => Number(q?.nb_questions) > 0).map((q) => {
    const theme = themeDe.get(q.theme_id) || null;
    const derniere = dernieres.get(q.id);
    return {
      theme, qcm: q,
      titre: titreDuQcm(theme, q),
      etiquette: estTransversal(theme) ? "Transversal" : null,
      etat: derniere ? `Dernière note ${noteEnFrancais(derniere.note)}/20` : "Pas encore fait",
      note: derniere ? derniere.note : null,
      examenOuvert: examenDemarrable(q, now),
      action: "Voir le QCM",
    };
  });
  const rang = (l) => (l.examenOuvert ? 0 : l.note == null ? 1 : 2);
  const numero = (l) => (l.theme?.numero != null ? Number(l.theme.numero) : Infinity);
  return lignes.sort((a, b) =>
    rang(a) - rang(b)
    || (numero(a) === numero(b) ? 0 : numero(a) < numero(b) ? -1 : 1)
    || a.titre.localeCompare(b.titre, "fr")
    || a.qcm.id - b.qcm.id);
}

/**
 * Les lignes de la liste des QCM du siège (il rédige les contenus communs, sans promo) : { theme, qcm, titre, etiquette,
 * detail, action }. Aucune note, aucun examen, aucun état d'entraînement : ce sont des données de promo. Un QCM sans
 * question reste proposé (c'est là qu'on écrit la première). Ordre : par numéro de thème, les transversaux ensuite, par titre.
 */
export function lignesQcmRedaction({ qcm = [], themes = [] } = {}) {
  const themeDe = new Map((themes || []).map((t) => [t.id, t]));
  const lignes = (Array.isArray(qcm) ? qcm : []).filter(Boolean).map((q) => {
    const theme = themeDe.get(q.theme_id) || null;
    const n = Number(q.nb_questions) || 0;
    return {
      theme, qcm: q,
      titre: titreDuQcm(theme, q),
      etiquette: estTransversal(theme) ? "Transversal" : null,
      detail: n === 0 ? "Aucune question" : n === 1 ? "1 question" : `${n} questions`,
      action: "Modifier les questions",
    };
  });
  const numero = (l) => (l.theme?.numero != null ? Number(l.theme.numero) : Infinity);
  return lignes.sort((a, b) =>
    (numero(a) === numero(b) ? 0 : numero(a) < numero(b) ? -1 : 1)
    || a.titre.localeCompare(b.titre, "fr")
    || a.qcm.id - b.qcm.id);
}

/** Phrase affichée quand la lecture des cours ou des QCM a échoué (jamais confondue avec « aucun QCM »).
 *  Page partagée : `vous` vrai pour l'équipe (l'appelant le tire de selonPublic), faux pour un stagiaire. */
export function messageLectureEnEchec({ cours = false, qcm = false, vous = false } = {}) {
  const conseil = vous ? "Vérifiez votre connexion." : "Vérifie ta connexion.";
  if (cours && qcm) return `Cours et QCM non chargés. ${conseil}`;
  if (qcm) return `QCM non chargés. ${conseil}`;
  if (cours) return `Cours non chargés. ${conseil}`;
  return null;
}

/** Attend TOUTES les lectures d'un objet {nom: promesse}, même si l'une échoue vite : renvoie les valeurs lues
 *  et les noms des lectures en échec. Les indicateurs d'échec sont ainsi tous connus avant le premier affichage. */
export async function lireToutes(lectures) {
  const noms = Object.keys(lectures);
  const res = await Promise.allSettled(noms.map((n) => lectures[n]));
  const valeurs = {};
  const echecs = [];
  res.forEach((r, i) => { if (r.status === "fulfilled") valeurs[noms[i]] = r.value; else echecs.push(noms[i]); });
  return { valeurs, echecs };
}
