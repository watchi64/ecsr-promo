// Progression du stagiaire sur la liste des thèmes (spec du 12/11/2026, docs/superpowers/specs/2026-11-12-progression-themes-design.md).
// Règle pure, testée sous node (tests/progression-rules.test.mjs) : l'état d'un thème se décide sur ses notes de QCM, et
// quand l'examen et l'entraînement se contredisent, le résultat le plus récent décide (décision de Timy du 12/11).

export const SEUIL_ENTRAINEMENT = 12;
export const SEUIL_EXAMEN_DEFAUT = 15;

export const ETATS_PROGRESSION = [
  { cle: "acquis", libelle: "Acquis" },
  { cle: "revoir", libelle: "À revoir" },
  { cle: "encours", libelle: "En cours" },
  { cle: "commencer", libelle: "À commencer" },
];

const jour = (ms) => new Date(ms).toDateString();

// Date de l'examen, en millisecondes. La tentative d'examen porte une heure ; la note de la matrice (saisie à la main ou
// copiée par la base depuis la tentative) n'a qu'un jour. On garde la tentative si son jour n'est pas antérieur à celui
// de la note ; sinon la note, prise en fin de journée (un entraînement du même jour est réputé antérieur).
export function dateExamen(tentative, evaluation) {
  const t = tentative?.finished_at ? Date.parse(tentative.finished_at) : null;
  const e = evaluation?.date_eval ? Date.parse(evaluation.date_eval + "T23:59:59") : null;
  if (t != null && (e == null || jour(t) === jour(e) || t > e)) return t;
  return e;
}

// examen et entrainement : { note, date } ou null. Une date absente rend l'examen le plus ancien des deux.
export function etatProgression({ seuil, examen, entrainement }) {
  const seuilExamen = seuil ?? SEUIL_EXAMEN_DEFAUT;
  const reussi = examen != null && examen.note >= seuilExamen;
  if (!examen && !entrainement) return "commencer";
  const dernierEstExamen = examen && (!entrainement || (examen.date ?? -Infinity) >= entrainement.date);
  if (dernierEstExamen) return reussi ? "acquis" : "revoir";
  if (entrainement.note < SEUIL_ENTRAINEMENT) return "revoir";
  return reussi ? "acquis" : "encours";
}

// Compte des états (les thèmes sans QCM, état null, ne comptent pas).
export function bilanProgression(etats) {
  const avec = etats.filter((e) => e != null);
  return {
    acquis: avec.filter((e) => e === "acquis").length,
    revoir: avec.filter((e) => e === "revoir").length,
    total: avec.length,
  };
}

// Phrase de l'en-tête de Cours, au tutoiement (vue stagiaire).
export function phraseBilan(acquis, total) {
  if (!acquis) return "Aucun thème acquis pour l'instant.";
  return `Tu as acquis ${acquis} thème${acquis > 1 ? "s officiels" : " officiel"} sur ${total}.`;
}
