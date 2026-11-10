// Registre qualité (indicateurs 31 et 32) : réclamations, difficultés, aléas, améliorations et risques, datés.
// PUR : ni DOM ni réseau. Testé en node (tests/registre-rules.test.mjs).
//
// Une entrée : { id, type, origine, promo_id, lieu_id, description, date_constat, reponse, date_reponse, action_decidee,
// mesure_prevention, etat, clos_le, efface_le, signalement_id, issu_signalement }. Les dates de jour sont « AAAA-MM-JJ ».
// Aucun nom de personne n'est jamais recopié : l'origine seulement (stagiaire, formateur, équipe...).

import { cellule } from "./centre-csv.js?v=20261110e";
import { jourParis } from "./questionnaires-gestion-rules.js?v=20261110e";

export const TYPES = { reclamation: "Réclamation", difficulte: "Difficulté", alea: "Aléa", amelioration: "Amélioration", risque: "Risque" };
export const ORIGINES = {
  stagiaire: "Stagiaire", formateur: "Formateur", entreprise: "Entreprise", financeur: "Financeur", equipe: "Équipe", autre: "Autre",
};
export const ETATS = { ouvert: "Ouvert", en_cours: "En cours", clos: "Clos" };

export const RAPPEL_VIOLENCES = "Violences, harcèlement, discriminations : ne les écris pas ici. Ils passent par le référent du centre et sa procédure, qui protègent la personne. Ne nomme personne : l'origine suffit.";

export const LIMITE_TEXTE = 2000;
const TEXTE_MIN = 3;
const TEXTE_EFFACE = "texte effacé (3 ans après la clôture)";
const BOM = String.fromCharCode(0xfeff);

// Clé propre d'un objet (Object.hasOwn n'existe pas avant Safari 15.4).
const possede = (objet, cle) => Object.prototype.hasOwnProperty.call(objet, cle);
const texte = (v) => (v == null ? "" : String(v));
const jour = (v) => (v ? String(v).slice(0, 10) : "");
const estJour = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const estEfface = (e) => e?.efface_le != null || e?.efface === true;

// Nombre de jours entre deux jours « AAAA-MM-JJ » (fin moins début), ou nul si l'un est illisible.
function joursEntre(debut, fin) {
  const [d, f] = [jour(debut), jour(fin)];
  if (!estJour(d) || !estJour(f)) return null;
  return Math.round((Date.parse(f + "T00:00:00Z") - Date.parse(d + "T00:00:00Z")) / 86400000);
}

// Ajoute 3 ans à un instant (UTC) : le 29 février tombe le 28, comme interval '3 years' de Postgres.
function plusTroisAns(date) {
  const annee = date.getUTCFullYear() + 3;
  const mois = date.getUTCMonth();
  const dernier = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  const r = new Date(date.getTime());
  r.setUTCFullYear(annee, mois, Math.min(date.getUTCDate(), dernier));
  return r;
}

// Contrôle de la saisie, à l'écran. La base tient aussi les règles de clôture d'un risque. Retour { ok, erreurs }.
export function validerEntree(champs, aujourdhui) {
  const c = champs || {};
  const erreurs = {};
  if (!possede(TYPES, c.type)) erreurs.type = "Choisis le type de l'entrée.";
  if (!possede(ORIGINES, c.origine)) erreurs.origine = "Choisis l'origine.";
  const date = jour(c.date_constat);
  if (!estJour(date)) erreurs.date_constat = "Indique la date du constat.";
  else if (aujourdhui && date > aujourdhui) erreurs.date_constat = "La date du constat ne peut pas être dans le futur.";

  const description = texte(c.description).trim();
  if (description.length < TEXTE_MIN) erreurs.description = `Décris l'entrée en ${TEXTE_MIN} caractères au moins.`;
  else if (description.length > LIMITE_TEXTE) erreurs.description = `La description est limitée à ${LIMITE_TEXTE} caractères.`;

  const reponse = texte(c.reponse).trim();
  if (reponse.length > LIMITE_TEXTE) erreurs.reponse = `La réponse est limitée à ${LIMITE_TEXTE} caractères.`;
  const dateReponse = jour(c.date_reponse);
  if (dateReponse) {
    if (!reponse) erreurs.date_reponse = "Une date de réponse suppose une réponse.";
    else if (!estJour(dateReponse)) erreurs.date_reponse = "La date de réponse est illisible.";
    else if (estJour(date) && dateReponse < date) erreurs.date_reponse = "La réponse ne peut pas précéder le constat.";
    else if (aujourdhui && dateReponse > aujourdhui) erreurs.date_reponse = "La date de réponse ne peut pas être dans le futur.";
  }

  if (texte(c.action_decidee).trim().length > LIMITE_TEXTE) erreurs.action_decidee = `L'action décidée est limitée à ${LIMITE_TEXTE} caractères.`;

  const mesure = texte(c.mesure_prevention).trim();
  if (mesure.length > LIMITE_TEXTE) erreurs.mesure_prevention = `La mesure de prévention est limitée à ${LIMITE_TEXTE} caractères.`;
  else if (c.type !== "risque" && mesure) erreurs.mesure_prevention = "Une mesure de prévention ne concerne qu'un risque.";
  else if (c.type === "risque" && c.etat === "clos" && !mesure) erreurs.mesure_prevention = "Un risque ne se clôt pas sans mesure de prévention.";

  return { ok: Object.keys(erreurs).length === 0, erreurs };
}

// Du plus récent au plus ancien (date du constat, puis numéro). Filtres « tous » ou absents : aucun filtre.
export function filtrerRegistre(entrees, { etat = "tous", type = "tous" } = {}) {
  return (entrees || [])
    .filter((e) => (etat === "tous" || e.etat === etat) && (type === "tous" || e.type === type))
    .sort((a, b) => {
      const [da, db] = [jour(a.date_constat), jour(b.date_constat)];
      if (da !== db) return da < db ? 1 : -1;
      return (b.id ?? 0) - (a.id ?? 0);
    });
}

const ORIGINE_DU_ROLE = { stagiaire: "stagiaire", formateur: "formateur", fondateur: "equipe" };

// Une entrée du registre prête à enregistrer, tirée d'un signalement « Signaler un problème » : sans nom, sans e-mail, sans
// contexte. La date est le jour du signalement à Paris.
export function entreeDepuisSignalement(s) {
  return {
    type: "difficulte",
    origine: ORIGINE_DU_ROLE[s?.role] ?? "autre",
    promo_id: s?.promo_id ?? null,
    description: texte(s?.message).slice(0, LIMITE_TEXTE),
    date_constat: jourParis(s?.created_at),
    signalement_id: s?.id ?? null,
  };
}

// Les entrées d'une promo : les siennes, plus celles sans promo qui sont de son centre ou de tout l'organisme, datées dans sa
// période (début à fin, ou à aujourd'hui tant qu'elle n'est pas finie). Une promo sans début n'a pas de borne basse.
export function entreesPourPromo(entrees, promo, aujourdhui) {
  const debut = jour(promo?.date_debut);
  const fin = jour(promo?.date_fin) || aujourdhui;
  return (entrees || []).filter((e) => {
    if (e.promo_id != null) return promo?.id != null && Number(e.promo_id) === Number(promo.id);
    if (e.lieu_id != null && (promo?.lieu_id == null || Number(e.lieu_id) !== Number(promo.lieu_id))) return false;
    const d = jour(e.date_constat);
    return (!debut || d >= debut) && (!fin || d <= fin);
  });
}

// Les entrées d'un centre : celles de ses promos (promoIds), plus celles sans promo de son lieu ou de tout l'organisme, datées
// entre du et au. Chaque entrée une fois (par numéro).
export function entreesPourCentre(entrees, { lieuId, promoIds, du, au } = {}) {
  const promos = new Set((promoIds || []).map(Number));
  const vues = new Set();
  return (entrees || []).filter((e) => {
    let garde;
    if (e.promo_id != null) garde = promos.has(Number(e.promo_id));
    else if (e.lieu_id != null && (lieuId == null || Number(e.lieu_id) !== Number(lieuId))) garde = false;
    else {
      const d = jour(e.date_constat);
      garde = (!du || d >= jour(du)) && (!au || d <= jour(au));
    }
    if (!garde) return false;
    if (e.id != null) {
      if (vues.has(e.id)) return false;
      vues.add(e.id);
    }
    return true;
  });
}

// { total, parType, parEtat } : toutes les clés présentes, zéros compris.
export function decompteRegistre(entrees) {
  const liste = entrees || [];
  const parType = Object.fromEntries(Object.keys(TYPES).map((k) => [k, 0]));
  const parEtat = Object.fromEntries(Object.keys(ETATS).map((k) => [k, 0]));
  for (const e of liste) {
    if (possede(parType, e.type)) parType[e.type] += 1;
    if (possede(parEtat, e.etat)) parEtat[e.etat] += 1;
  }
  return { total: liste.length, parType, parEtat };
}

// Médiane des délais de réponse en jours (date de réponse moins date du constat), sur les entrées qui ont une date de réponse.
export function delaiMedianJours(entrees) {
  const delais = (entrees || []).map((e) => (e.date_reponse ? joursEntre(e.date_constat, e.date_reponse) : null))
    .filter((d) => d != null).sort((a, b) => a - b);
  if (!delais.length) return null;
  const m = delais.length >> 1;
  return delais.length % 2 ? delais[m] : (delais[m - 1] + delais[m]) / 2;
}

// Instant où une entrée close devient effaçable : clôture plus 3 ans. Nul si la date est illisible.
export function echeanceEffacement(closLe) {
  if (!closLe) return null;
  const date = new Date(closLe);
  return Number.isNaN(date.getTime()) ? null : plusTroisAns(date);
}

// Les entrées closes, pas encore effacées, dont l'échéance est passée.
export function aEffacer(entrees, maintenant) {
  const t = (maintenant instanceof Date ? maintenant : new Date(maintenant)).getTime();
  return (entrees || []).filter((e) => {
    if (e.etat !== "clos" || estEfface(e)) return false;
    const echeance = echeanceEffacement(e.clos_le);
    return echeance != null && echeance.getTime() < t;
  });
}

// Les entrées ouvertes ou en cours dont le constat date de plus de 3 ans : à clore (elles ne s'effacent qu'une fois closes).
export function aClore(entrees, aujourdhui) {
  return (entrees || []).filter((e) => {
    if (e.etat !== "ouvert" && e.etat !== "en_cours") return false;
    const d = jour(e.date_constat);
    if (!estJour(d)) return false;
    return jour(plusTroisAns(new Date(d + "T00:00:00Z")).toISOString()) < aujourdhui;
  });
}

const ENTETE_CSV = [
  "N°", "Date", "Type", "Origine", "Promo", "Centre", "Description", "Réponse", "Date de réponse", "Délai (jours)",
  "Action décidée", "Mesure de prévention", "État", "Clos le", "Issu d'un signalement",
];

// Nom lu dans un objet { id: nom } ou une Map.
function nomDans(noms, id) {
  if (id == null || !noms) return "";
  return (noms instanceof Map ? noms.get(id) : noms[id]) ?? "";
}

// Le registre en CSV pour Excel en français : BOM, point-virgule, CRLF, formules neutralisées (cellule). Il contient des
// textes libres : il n'est montré qu'au fondateur. Une entrée effacée n'a plus ses textes.
export function registreCsv(entrees, nomsPromos, nomsLieux) {
  const lignes = (entrees || []).map((e) => {
    const efface = estEfface(e);
    const libre = (v) => (efface ? TEXTE_EFFACE : texte(v));
    const delai = e.date_reponse ? joursEntre(e.date_constat, e.date_reponse) : null;
    return [
      e.id, jour(e.date_constat), TYPES[e.type] ?? texte(e.type), ORIGINES[e.origine] ?? texte(e.origine),
      nomDans(nomsPromos, e.promo_id), e.lieu_id == null ? "Tout l'organisme" : nomDans(nomsLieux, e.lieu_id),
      libre(e.description), libre(e.reponse), jour(e.date_reponse), delai ?? "",
      libre(e.action_decidee), libre(e.mesure_prevention), ETATS[e.etat] ?? texte(e.etat), jour(e.clos_le),
      e.issu_signalement || e.signalement_id != null ? "Oui" : "Non",
    ];
  });
  return BOM + [ENTETE_CSV, ...lignes].map((ligne) => ligne.map(cellule).join(";")).join("\r\n") + "\r\n";
}

// « registre-qualite-AAAA-MM-JJ.csv »
export function nomFichierRegistre(dateIso) {
  return `registre-qualite-${jour(dateIso) || "sans-date"}.csv`;
}
