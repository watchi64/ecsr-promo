// Cloisonnement par organisme, côté app (spec 2026-11-27, § 5.4) : règles pures, testées par tests/organisme-rules.test.mjs.
// - L'organisme de la personne connectée, lu par mon_organisme() (js/db.js, lireMonOrganisme) : son nom remplace les valeurs
//   d'ECF en dur sur les documents (en-tête d'émargement, attestations, livret EPCF). Rien de lisible : nom vide, jamais un nom
//   deviné (imprimer le nom d'un autre organisme serait pire qu'un champ à remplir).
// - L'accès support du fondateur (js/views/acces-support.js, bandeau de js/nav-shell.js) : le motif, que la base exige d'au moins
//   10 caractères une fois les blancs retirés, et le texte du bandeau, à l'heure de Paris.

import { habillageValide } from "./habillage-regles.js?v=20261127b";

// Longueur minimale du motif, comme ouvrir_acces_support() (char_length après retrait des blancs autour).
export const MOTIF_SUPPORT_MIN = 10;

// Le motif tel que la base le compte : blancs retirés aux deux bouts (espaces, tabulations, retours à la ligne), puis des
// caractères (et non des unités UTF-16 : un emoji compte pour un, comme char_length).
export function motifSupportValide(motif) {
  if (typeof motif !== "string") return false;
  return [...motif.trim()].length >= MOTIF_SUPPORT_MIN;
}

const FORMAT_HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", hour: "numeric", minute: "2-digit", hourCycle: "h23",
});

// « 15 h 05 », « 9 h 00 », « 0 h 30 » : l'heure de Paris, sans zéro devant l'heure, les minutes toujours sur deux chiffres. Rend
// "" pour une date illisible.
function heureDeParis(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const parties = FORMAT_HEURE_PARIS.formatToParts(date);
  const h = parties.find((p) => p.type === "hour")?.value ?? "";
  const m = parties.find((p) => p.type === "minute")?.value ?? "";
  if (h === "" || m === "") return "";
  return `${Number(h) % 24} h ${String(m).padStart(2, "0")}`;
}

const nomNet = (nom) => (typeof nom === "string" ? nom.trim() : "");

// Le texte du bandeau permanent : « Accès support : <organisme>, jusqu'à HH h MM » (spec § 5.4).
export function texteBandeauSupport(nom, jusqua) {
  const n = nomNet(nom);
  const heure = heureDeParis(jusqua);
  const debut = n ? `Accès support : ${n}` : "Accès support";
  return heure ? `${debut}, jusqu'à ${heure}` : debut;
}

// La ligne rendue par mon_organisme() (une table d'une ligne au plus), telle que l'app l'emploie :
// { id, nom, redacteur, habillage, supportJusqua }. `habillage` nul veut dire « aucun réglage » ; `supportJusqua` est l'échéance de
// l'accès support du fondateur quand c'est l'organisme affiché, nulle sinon.
export function normaliserMonOrganisme(ligne) {
  const l = Array.isArray(ligne) ? ligne[0] : ligne;
  const vide = { id: null, nom: "", redacteur: false, habillage: null, supportJusqua: null };
  if (!l || typeof l !== "object" || Array.isArray(l)) return vide;
  const id = Number.isInteger(l.id) ? l.id : null;
  const nom = nomNet(l.nom);
  if (id == null && !nom) return vide;
  let supportJusqua = null;
  if (l.support_jusqua) {
    const d = new Date(l.support_jusqua);
    if (!Number.isNaN(d.getTime())) supportJusqua = d;
  }
  return {
    id,
    nom,
    redacteur: l.redacteur === true,
    habillage: habillageValide(l.habillage) ? l.habillage : null,
    supportJusqua,
  };
}

// Un accès support est en cours : une échéance, pas encore passée.
export function supportEnCours(organisme, maintenant = Date.now()) {
  const fin = organisme && organisme.supportJusqua;
  return fin instanceof Date && !Number.isNaN(fin.getTime()) && fin.getTime() > maintenant;
}

// Ce que montre le bandeau : rien sans accès support ; pendant l'accès, le texte et « Fermer » ; une fois l'échéance passée (l'app
// est restée ouverte), une phrase qui invite à recharger : la base ne donne déjà plus l'organisme du support.
export function etatBandeauSupport(organisme, maintenant = Date.now()) {
  const fin = organisme && organisme.supportJusqua;
  if (!(fin instanceof Date) || Number.isNaN(fin.getTime())) return { visible: false, echu: false, texte: "" };
  if (fin.getTime() > maintenant) return { visible: true, echu: false, texte: texteBandeauSupport(organisme.nom, fin) };
  const n = nomNet(organisme.nom);
  return {
    visible: true,
    echu: true,
    texte: `Accès support${n ? " à " + n : ""} terminé. Rechargez l'app pour revenir à votre organisme.`,
  };
}

// Les organismes que l'écran du fondateur propose (lignes de organismes_pour_support()), sans celui qui est affiché, triés par nom.
export function organismesProposes(liste, courantId) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((o) => o && Number.isInteger(o.id) && nomNet(o.nom) && o.id !== courantId)
    .map((o) => ({ id: o.id, nom: nomNet(o.nom) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}

// L'organisme imprimé sur un document : celui que l'équipe a saisi (en-tête des feuilles, livret), sinon le nom de l'organisme lu
// par mon_organisme(), sinon rien (le champ reste à remplir).
export function organismeParDefaut(saisi, nomOrganisme) {
  return nomNet(saisi) || nomNet(nomOrganisme);
}
