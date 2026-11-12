// États affichés par la fiche d'une personne (sommaire sur iPhone) et par la
// liste de la page Stagiaires (chantier D, lot 2). Module pur : testé en node.
import { pluriel } from "./nombres.js?v=20261112b";

export const EPREUVES_EPCF = ["salle", "vehicule"];

// Émis par le livret EPCF et le dossier professionnel après un enregistrement, avec
// { genre: "livret" | "dossier", stagiaireId, updatedAt } et, pour le dossier,
// `exemples` (exemples remplis, de 0 à 6) : les états suivent sans relire la base.
export const EVT_DOCUMENT = "document-enregistre";

// Note un enregistrement (EVT_DOCUMENT) dans les données `d` d'une fiche chargée
// (chargerFiche de js/views/mon-suivi.js). Faux si l'événement ne la concerne pas.
// Un dossier sans compte (ancien émetteur) garde le dernier compte connu.
export function noterDocument(d, detail) {
  if (!d || !detail || detail.stagiaireId !== d.id) return false;
  const ligne = { stagiaire_id: d.id, updated_at: detail.updatedAt };
  if (detail.genre === "livret") d.livret = ligne;
  else if (detail.genre === "dossier") {
    d.dossier = ligne;
    if (Number.isInteger(detail.exemples)) d.exemplesDossier = detail.exemples;
  } else return false;
  return true;
}

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

// État du dossier professionnel : « pas commencé », « modifié le 29/09 » (jamais la date seule, qui se lisait
// comme une fraction ou une échéance), « commencé » si la date est illisible. Avec un préfixe, « Préfixe : état ».
function texteDossier(dossier, prefixe) {
  const date = dossier ? jourMois(dossier.updated_at) : null;
  const etat = !dossier ? "pas commencé" : date ? "modifié le " + date : "commencé";
  return prefixe ? prefixe + " : " + etat : etat;
}

// Ligne d'état de la page Stagiaires (vue formateur) : `afaire` pour ce qui
// reste à faire, affiché en orange.
export function ligneListe({ evals, livret, dossier }) {
  const n = epreuvesEvaluees(evals);
  return [
    { texte: `EPCF : ${pluriel(n, "épreuve")} sur 2`, afaire: n < 2 },
    { texte: "Livret EPCF : " + (livret ? "commencé" : "pas commencé"), afaire: !livret },
    { texte: texteDossier(dossier, "Dossier professionnel"), afaire: !dossier },
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
      : soi ? { texte: "pas encore commencé", afaire: false }
      : { texte: "pas commencé", afaire: true },
    dp: { texte: texteDossier(dossier, null), afaire: !dossier },
  };
}

// États de Mon suivi (lot 2B, tâche 7) : la ligne entière, nom de la
// partie compris, pour qu'elle se lise seule (« Évaluations EPCF : 0 épreuve sur 2 », jamais « 0/2 » ; « Dossier
// professionnel : 2 exemples sur 6 », jamais « 02/10 », qui se lisait comme une date, ruling R65).
// `exemplesDossier` : exemples remplis (exemplesRemplis de js/dp-rules.js), null sans dossier.
// Le texte de Résultats ne dépend d'aucune donnée : il dit ce que la partie contient. Comme
// pour etatsSommaire de soi, seul le dossier, qui dépend du stagiaire, passe en orange ; il le
// reste tant que les 6 exemples ne sont pas remplis, comme la ligne de l'Accueil.
export function etatsClairs({ aVenir = 0, evals, livret, exemplesDossier = null } = {}) {
  const n = epreuvesEvaluees(evals);
  const exemples = Number.isInteger(exemplesDossier) ? exemplesDossier : null;
  return {
    resultats: { texte: "Résultats : moi et la classe", afaire: false },
    passages: { texte: "Passages : " + (aVenir > 0 ? `${aVenir} à venir` : "aucun à venir"), afaire: false },
    epcf: { texte: `Évaluations EPCF : ${pluriel(n, "épreuve")} sur 2`, afaire: false },
    livret: { texte: "Livret EPCF : " + (livret ? "commencé" : "pas encore commencé"), afaire: false },
    dp: exemples === null
      ? { texte: "Dossier professionnel : pas encore commencé", afaire: true }
      : { texte: `Dossier professionnel : ${pluriel(exemples, "exemple")} sur 6`, afaire: exemples < 6 },
  };
}
