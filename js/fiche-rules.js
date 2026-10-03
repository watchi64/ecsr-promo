// États affichés par la fiche d'une personne (sommaire sur iPhone) et par la
// liste de la page Stagiaires (chantier D, lot 2). Module pur : testé en node.

export const EPREUVES_EPCF = ["salle", "vehicule"];

// Émis par le livret et le dossier pro après un enregistrement, avec
// { genre: "livret" | "dossier", stagiaireId, updatedAt } : les états suivent
// sans relire la base.
export const EVT_DOCUMENT = "document-enregistre";

// Épreuves ayant au moins une évaluation (plusieurs évaluations d'une même
// épreuve comptent une fois).
export function epreuvesEvaluees(evals) {
  return new Set((evals || []).map((e) => e.trame).filter((t) => EPREUVES_EPCF.includes(t))).size;
}

// « 29/09 » : jour et mois d'une date (AAAA-MM-JJ, lue telle quelle) ou d'un
// horodatage (heure de l'appareil). null si illisible.
export function jourMois(valeur) {
  if (!valeur) return null;
  const s = String(valeur);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return m[3] + "/" + m[2];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}

// Passages à venir, aujourd'hui compris : les vrais passages, pas les
// demi-journées où la personne est seulement élève dans la salle.
export function passagesAVenir(items, aujourdhuiIso) {
  return (items || []).filter((it) => it.role === "passage" && it.iso >= aujourdhuiIso).length;
}

function texteDossier(dossier, prefixe) {
  if (!dossier) return prefixe ? prefixe + " vierge" : "vierge";
  const date = jourMois(dossier.updated_at);
  if (prefixe) return date ? prefixe + " " + date : prefixe;
  return date || "commencé";
}

// Ligne d'état de la page Stagiaires (vue formateur) : `afaire` pour ce qui
// reste à faire, affiché en orange.
export function ligneListe({ evals, livret, dossier }) {
  const n = epreuvesEvaluees(evals);
  return [
    { texte: `EPCF ${n}/2`, afaire: n < 2 },
    { texte: livret ? "Livret" : "Livret vierge", afaire: !livret },
    { texte: texteDossier(dossier, "Dossier"), afaire: !dossier },
  ];
}

// États du sommaire, par partie. `soi` : la personne regarde sa propre fiche ;
// elle ne voit en orange que ce qui dépend d'elle, son dossier.
export function etatsSommaire({ aVenir, evals, livret, dossier, soi }) {
  const n = epreuvesEvaluees(evals);
  return {
    passages: { texte: aVenir > 0 ? `${aVenir} à venir` : "aucun à venir", afaire: false },
    epcf: { texte: `${n}/2`, afaire: !soi && n < 2 },
    evolution: null,
    livret: livret ? { texte: "commencé", afaire: false }
      : soi ? { texte: "pas encore créé", afaire: false }
      : { texte: "vierge", afaire: true },
    dp: { texte: texteDossier(dossier, null), afaire: !dossier },
  };
}
