// La liste « Tes QCM » du stagiaire (sous-onglet QCM de Cours et QCM, lot 2B) : règles pures, testées dans
// tests/qcm-stagiaire-rules.test.mjs. Quels QCM, dans quel ordre, avec quelle phrase d'état. L'affichage
// (js/views/qcm-stagiaire.js) ne fait que les poser.

import { examenDemarrable } from "./qcm-exam-rules.js?v=20261106a";

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
  return String(Math.round(n * 10) / 10).replace(".", ",");
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
      action: "S'entraîner",
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
