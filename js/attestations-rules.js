// Certificat de réalisation et attestation d'assiduité (spec 2026-10-24) : calcul pur, sans DOM
// ni base, lu par node (tests/attestations-rules.test.mjs) et par l'app. Tout part des feuilles
// d'émargement closes : une feuille close est figée et porte une ligne par stagiaire de sa
// liste ; une demi-journée signée compte pour sa durée entière (décision de Timy du 24/10).

import { dureeMinutes, lundiDe, jourDe, dayIndexDe, jourFerie } from "./emargement-rules.js?v=20261109d";
import { compareByNom } from "./utils.js?v=20261109d";

export const LIBELLE_ORIGINE = {
  non_signe: "non signé",
  planning: "noté au planning",
  formateur: "marqué par le formateur",
};

const ORDRE_DEMI = { matin: 0, aprem: 1 };
const close = (s) => s.statut === "close";
const parDate = (a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : ORDRE_DEMI[a.demi_journee] - ORDRE_DEMI[b.demi_journee]);

// Garde-fou multi-promo : la lecture est déjà cloisonnée par la base, on ne garde en plus que
// les feuilles de la promo affichée.
export function seancesDeLaPromo(seances, promoId) {
  return (seances || []).filter((s) => s.promo_id == null || s.promo_id === promoId);
}

export function feuillesOuvertes(seances) {
  return (seances || []).filter((s) => !close(s)).length;
}

export function bilanStagiaire(seances, stagiaireId) {
  const b = {
    prevuesMin: 0, realiseesMin: 0, absencesMin: 0, taux: null, demiPrevues: 0, demiSignees: 0,
    premierPrevu: null, dernierPrevu: null, premierSigne: null, dernierSigne: null, semaines: [], evenements: [],
  };
  const semaines = new Map();
  for (const s of (seances || []).filter(close).sort(parDate)) {
    const ligne = (s.lignes || []).find((l) => l.stagiaire_id === stagiaireId);
    if (!ligne) continue;
    const minutes = dureeMinutes(s.debut, s.fin);
    const signee = Boolean(ligne.signe_le);
    b.prevuesMin += minutes;
    b.demiPrevues += 1;
    b.premierPrevu ??= s.jour;
    b.dernierPrevu = s.jour;
    if (signee) {
      b.realiseesMin += minutes;
      b.demiSignees += 1;
      b.premierSigne ??= s.jour;
      b.dernierSigne = s.jour;
    }
    const lundi = lundiDe(s.jour);
    if (!semaines.has(lundi)) semaines.set(lundi, { lundi, demiPrevues: 0, demiSignees: 0, prevuesMin: 0, realiseesMin: 0 });
    const sem = semaines.get(lundi);
    sem.demiPrevues += 1;
    sem.prevuesMin += minutes;
    if (signee) { sem.demiSignees += 1; sem.realiseesMin += minutes; }
    if (!signee || ligne.observation) {
      b.evenements.push({
        jour: s.jour, demi: s.demi_journee, debut: s.debut, fin: s.fin, minutes, absent: !signee,
        origine: signee ? null : (ligne.absence_origine || "non_signe"), observation: ligne.observation || null,
      });
    }
  }
  b.absencesMin = b.prevuesMin - b.realiseesMin;
  b.taux = b.prevuesMin ? Math.round((100 * b.realiseesMin) / b.prevuesMin) : null;
  b.semaines = [...semaines.values()];
  return b;
}

// Stagiaires qui figurent sur au moins une feuille close, actifs ou non : un stagiaire parti a
// droit à ses pièces pour ce qu'il a suivi.
export function stagiairesDeLaPeriode(seances, stagiairesTous) {
  const ids = new Set((seances || []).filter(close).flatMap((s) => (s.lignes || []).map((l) => l.stagiaire_id)));
  return (stagiairesTous || []).filter((s) => ids.has(s.id)).sort(compareByNom);
}

// Demi-journées du lundi au vendredi, hors jours fériés, sans aucune feuille (ouverte ou close).
export function demiJourneesSansFeuille(seances, du, au) {
  const avecFeuille = new Set((seances || []).map((s) => s.jour + "/" + s.demi_journee));
  let n = 0;
  for (let j = du; j <= au; j = jourDe(j, 1)) {
    if (dayIndexDe(j) > 4 || jourFerie(j)) continue;
    for (const demi of ["matin", "aprem"]) if (!avecFeuille.has(j + "/" + demi)) n++;
  }
  return n;
}

// Toute la formation : du début de la promo à aujourd'hui, ou à sa fin si elle est passée.
export function periodeParDefaut(promo, aujourdhui) {
  const du = promo?.date_debut || lundiDe(aujourdhui);
  const au = promo?.date_fin && promo.date_fin < aujourdhui ? promo.date_fin : aujourdhui;
  return { du, au };
}

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août",
  "Septembre", "Octobre", "Novembre", "Décembre"];

// Mois civils ayant une feuille close (certificat mensuel des projets de transition professionnelle).
export function moisDeLaPeriode(seances) {
  const cles = [...new Set((seances || []).filter(close).map((s) => s.jour.slice(0, 7)))].sort();
  return cles.map((cle) => {
    const [a, m] = cle.split("-").map(Number);
    const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { cle, du: cle + "-01", au: `${cle}-${String(dernier).padStart(2, "0")}`, libelle: `${NOMS_MOIS[m - 1]} ${a}` };
  });
}

// « 66 heures 30 minutes » : la durée écrite sur le certificat.
export function dureeEnToutesLettres(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const heures = `${h} heure${h > 1 ? "s" : ""}`;
  return m ? `${heures} ${m} minute${m > 1 ? "s" : ""}` : heures;
}

export function dateFr(iso) {
  if (!iso) return "";
  const [a, m, j] = String(iso).split("-");
  return `${j}/${m}/${a}`;
}

// Date de période utilisable : bien formée et entre 2000 et 2099. Une saisie au clavier passe
// par « 0002-10-12 », « 0020-10-12 »… : sans cette borne, l'app relirait des siècles de feuilles.
export function datePeriodeValide(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m || Number(m[1]) < 2000 || Number(m[1]) > 2099) return false;
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function estAdresseAttestations(hash) {
  return /^#?\/?emargement\/attestations\/?$/.test(String(hash ?? ""));
}
