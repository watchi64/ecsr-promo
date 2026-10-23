// Émargement (spec 2026-10-23) : règles pures, sans DOM ni base. Lu par node
// (tests/emargement-rules.test.mjs), par l'app et par le générateur de signatures
// fictives de la démonstration (scripts/emargement-demo.mjs).

// Repère fixe du tracé, quel que soit l'écran : la signature imprimée garde ses
// proportions, et le serveur vérifie les mêmes bornes (migration 20261023_emargement).
export const REPERE = { largeur: 400, hauteur: 160 };
export const TRACE_MAX = 20000;
export const MOTIF_TRACE = /^(M\d{1,3} \d{1,3}(L\d{1,3} \d{1,3})*)+$/;

// Écart minimal entre deux points gardés, en unités du repère.
const ECART_MIN = 2;

const borne = (v, max) => Math.min(max, Math.max(0, v));

// Traits saisis à l'écran ([[{x, y}…]…], en pixels d'une zone largeur x hauteur) →
// chemin SVG en entiers dans le repère. Un trait d'un seul point reste visible
// (« M x y L x y »), la fin d'un trait est toujours gardée.
export function cheminDepuisTraits(traits, { largeur, hauteur }) {
  const kx = REPERE.largeur / largeur;
  const ky = REPERE.hauteur / hauteur;
  const morceaux = [];
  for (const trait of traits || []) {
    if (!trait || trait.length === 0) continue;
    const points = trait.map((p) => ({ x: borne(p.x * kx, REPERE.largeur), y: borne(p.y * ky, REPERE.hauteur) }));
    const gardes = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const dernier = gardes[gardes.length - 1];
      if (Math.hypot(p.x - dernier.x, p.y - dernier.y) >= ECART_MIN) gardes.push(p);
      else if (i === points.length - 1) {
        const r = arrondi(p), rd = arrondi(dernier);
        if (r.x !== rd.x || r.y !== rd.y) gardes.push(p);
      }
    }
    if (gardes.length === 1) gardes.push(gardes[0]);
    morceaux.push(gardes.map((p, i) => {
      const r = arrondi(p);
      return (i === 0 ? "M" : "L") + r.x + " " + r.y;
    }).join(""));
  }
  return morceaux.join("");
}

function arrondi(p) { return { x: Math.round(p.x), y: Math.round(p.y) }; }

export function cheminValide(d) {
  return typeof d === "string" && d.length > 0 && d.length <= TRACE_MAX && MOTIF_TRACE.test(d);
}

// Assez de matière pour valoir signature : 8 points au moins, 60 unités de large.
export function traitsSuffisants(traits, { largeur }) {
  const kx = REPERE.largeur / largeur;
  const xs = (traits || []).flat().map((p) => p.x * kx);
  if (xs.length < 8) return false;
  return Math.max(...xs) - Math.min(...xs) >= 60;
}

// Stagiaires notés absents sur les cartes du planning de la demi-journée (champ
// `absences` [{sid, rid}], refonte du 19/07).
export function absentsDuPlanning(entries, dayIndex, demi) {
  const ids = new Set();
  for (const e of entries || []) {
    if (e.day_index !== dayIndex || e.half_day !== demi) continue;
    for (const a of Array.isArray(e.absences) ? e.absences : []) {
      if (a && a.sid != null) ids.add(a.sid);
    }
  }
  return ids;
}

const LIBELLE_ABSENCE = {
  planning: "Absent (noté au planning)",
  non_signe: "Absent (non signé)",
};

// État d'un stagiaire sur une séance. `ligne` : sa ligne d'émargement (ou null).
export function etatLigne({ ligne, absentPlanning = false, close = false }) {
  if (ligne && ligne.trace) {
    return {
      code: "signe",
      libelle: "Signé à " + heureLocale(ligne.signe_le),
      origine: ligne.sur_appareil_formateur ? "appareil_formateur" : "soi",
    };
  }
  if (ligne && ligne.absent) {
    const origine = ligne.absence_origine || "formateur";
    return { code: "absent", libelle: LIBELLE_ABSENCE[origine] || "Absent", origine };
  }
  if (close) return { code: "absent", libelle: LIBELLE_ABSENCE.non_signe, origine: "non_signe" };
  if (absentPlanning) return { code: "attente", libelle: "Absent au planning", origine: "planning" };
  return { code: "attente", libelle: "En attente", origine: null };
}

// Comptes d'une séance sur la liste de stagiaires donnée (les lignes hors liste sont
// ignorées). Une séance close compte absent tout stagiaire sans signature.
export function resumeSeance(lignes, stagiaireIds, close) {
  const parId = new Map((lignes || []).map((l) => [l.stagiaire_id, l]));
  const r = { signes: 0, absents: 0, attente: 0, total: stagiaireIds.length };
  for (const id of stagiaireIds) {
    const code = etatLigne({ ligne: parId.get(id) || null, close }).code;
    if (code === "signe") r.signes++;
    else if (code === "absent") r.absents++;
    else r.attente++;
  }
  return r;
}

// === Heures et jours ===

export function libelleHeure(hhmm) {
  const [h, m] = String(hhmm || "").split(":");
  if (h === undefined || m === undefined) return "";
  return Number(h) + "h" + m.padStart(2, "0");
}

export function libelleCreneau({ debut, fin }) {
  return libelleHeure(debut) + " à " + libelleHeure(fin);
}

export function dureeMinutes(debut, fin) {
  const min = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  return Math.max(0, min(fin) - min(debut));
}

export function libelleDuree(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

const FORMAT_HEURE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", hour: "numeric", minute: "2-digit", hourCycle: "h23",
});

// Heure de Paris d'un horodatage du serveur : « 9h04 ».
export function heureLocale(iso) {
  if (!iso) return "";
  const parts = FORMAT_HEURE.formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value ?? "";
  const m = parts.find((p) => p.type === "minute")?.value ?? "";
  return Number(h) + "h" + m;
}

const FORMAT_JOUR_PARIS = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
});

// Jour de Paris (AAAA-MM-JJ) d'un horodatage du serveur.
export function jourLocal(iso) {
  return iso ? FORMAT_JOUR_PARIS.format(new Date(iso)) : "";
}

// Calculs de dates sur des chaînes AAAA-MM-JJ, en UTC : aucun fuseau ne s'en mêle.
const versDate = (iso) => new Date(iso + "T00:00:00Z");
const versIso = (d) => d.toISOString().slice(0, 10);

export function jourDe(lundiIso, dayIndex) {
  const d = versDate(lundiIso);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return versIso(d);
}

// 0 = lundi … 6 = dimanche.
export function dayIndexDe(jourIso) {
  return (versDate(jourIso).getUTCDay() + 6) % 7;
}

export function lundiDe(jourIso) {
  return jourDe(jourIso, -dayIndexDe(jourIso));
}

function jourValide(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  const d = versDate(s);
  return !Number.isNaN(d.getTime()) && versIso(d) === s;
}

// Jours fériés nationaux (métropole), mêmes règles que js/views/planning.js
// (frenchHolidays, non exporté) : libellé du jour, ou null.
function paques(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

export function jourFerie(jourIso) {
  const annee = Number(String(jourIso).slice(0, 4));
  const fixes = {
    "01-01": "Jour de l'an", "05-01": "Fête du Travail", "05-08": "Victoire 1945",
    "07-14": "Fête nationale", "08-15": "Assomption", "11-01": "Toussaint",
    "11-11": "Armistice", "12-25": "Noël",
  };
  if (fixes[String(jourIso).slice(5)]) return fixes[String(jourIso).slice(5)];
  const p = paques(annee);
  const mobiles = { [jourDe(p, 1)]: "Lundi de Pâques", [jourDe(p, 39)]: "Ascension", [jourDe(p, 50)]: "Lundi de Pentecôte" };
  return mobiles[jourIso] || null;
}

export const DEMI_JOURNEES = ["matin", "aprem"];

// "#/emargement/2026-10-26/matin" → { jour, demi } ; tout segment illisible vaut null.
export function lireAdresseEmargement(hash) {
  const segments = String(hash ?? "").replace(/^#\/?/, "").split("/").filter(Boolean);
  if (segments[0] !== "emargement" || !jourValide(segments[1])) return { jour: null, demi: null };
  return { jour: segments[1], demi: DEMI_JOURNEES.includes(segments[2]) ? segments[2] : null };
}

export function adresseSeance(jour, demi) {
  return "#/emargement/" + jour + (demi ? "/" + demi : "");
}

// Noms proposés à la signature du formateur : le sien d'abord (formateur de l'app),
// puis les formateurs des cartes de la demi-journée (fiches et noms libres).
export function nomsFormateursProposes({ entries, profs, monNom }) {
  const nomDe = new Map((profs || []).map((p) => [p.id, p.nom]));
  const autres = new Set();
  for (const e of entries || []) {
    for (const id of e.prof_ids || []) if (nomDe.has(id)) autres.add(nomDe.get(id));
    if (e.prof_autre) autres.add(e.prof_autre);
  }
  if (monNom) autres.delete(monNom);
  const tries = [...autres].sort((a, b) => a.localeCompare(b, "fr"));
  return monNom ? [monNom, ...tries] : tries;
}

// Minutes de présence (séances signées) d'un stagiaire sur un ensemble de séances.
export function minutesPresence(seances, lignes, stagiaireId) {
  const signees = new Set((lignes || [])
    .filter((l) => l.stagiaire_id === stagiaireId && l.trace)
    .map((l) => l.seance_id));
  return (seances || [])
    .filter((s) => signees.has(s.id))
    .reduce((t, s) => t + dureeMinutes(s.debut, s.fin), 0);
}
