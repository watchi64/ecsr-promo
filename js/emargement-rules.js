// Émargement (spec 2026-10-23) : règles pures, sans DOM ni base. Lu par node
// (tests/emargement-rules.test.mjs), par l'app et par le générateur de signatures
// fictives de la démonstration (scripts/emargement-demo.mjs).
import { jourDe, dayIndexDe, lundiDe, jourParis } from "./dates.js?v=20261111i";
import { pluriel } from "./nombres.js?v=20261111i";

// Interrupteur par promo (demande de Timy du 23/10 : éteint partout, allumé pour la seule
// promo de démonstration tant qu'il n'en décide pas autrement). Réglage `settings`
// propre à la promo ; la base refuse d'ouvrir une feuille quand il n'est pas allumé.
export const CLE_ACTIVATION = "emargement_actif";
export function estActif(valeur) {
  return valeur === true || valeur === "true";
}

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

// Passage prévu au planning de la demi-journée (mêmes rôles que les absences de la refonte du
// 19/07 : tableau en salle, élève en voiture) : « au tableau », « en voiture » ou null.
export function roleAuPlanning(entries, dayIndex, demi, sid) {
  for (const e of entries || []) {
    if (e.day_index !== dayIndex || e.half_day !== demi) continue;
    if (e.activite === "Pédagogie salle"
        && (e.pedagogue_id === sid || (e.salle_double && e.pedagogue_id_2 === sid))) return "au tableau";
    if (e.activite === "Voiture (conduite)" && (e.eleves_ids || []).includes(sid)) return "en voiture";
  }
  return null;
}

const LIBELLE_ABSENCE = {
  planning: "Absent (noté au planning)",
  non_signe: "Absent (non signé)",
};

// Une ligne (d'un stagiaire ou d'un formateur) est signée quand son dessin est là, quand l'heure de signature est posée
// (les lectures légères n'ont pas le dessin) ou quand la signature a été effacée à la durée de conservation
// (`signature_effacee_le`) : la base garde alors l'heure, la présence et le total d'heures, seul le dessin part.
export function ligneSignee(ligne) {
  return Boolean(ligne && (ligne.trace || ligne.signe_le || ligne.signature_effacee_le));
}

// Vrai quand la ligne est signée mais que son dessin n'existe plus (étape des 3 ans).
export function signatureEffacee(ligne) {
  return ligneSignee(ligne) && !ligne.trace;
}

// Ce que la feuille écrit à la place du dessin effacé.
export const MENTION_SIGNATURE_EFFACEE = "Signature effacée (durée de conservation)";

// État d'un stagiaire sur une séance. `ligne` : sa ligne d'émargement (ou null).
export function etatLigne({ ligne, absentPlanning = false, close = false }) {
  if (ligneSignee(ligne)) {
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
// ignorées). Une séance close compte absent tout stagiaire sans signature. `prevus` : parmi ceux
// qui n'ont rien dit (`attente`), les absents prévus au planning (`absentsPlanning`, un Set d'ids,
// absentsDuPlanning) : la feuille et « Aujourd'hui » les comptent à part (audit du 09/11, A1).
export function resumeSeance(lignes, stagiaireIds, close, absentsPlanning = null) {
  const parId = new Map((lignes || []).map((l) => [l.stagiaire_id, l]));
  const r = { signes: 0, absents: 0, attente: 0, prevus: 0, total: stagiaireIds.length };
  for (const id of stagiaireIds) {
    const code = etatLigne({ ligne: parId.get(id) || null, close }).code;
    if (code === "signe") r.signes++;
    else if (code === "absent") r.absents++;
    else {
      r.attente++;
      if (absentsPlanning && absentsPlanning.has(id)) r.prevus++;
    }
  }
  return r;
}

// La suite du résumé d'une feuille, après « 2 sur 6 » : les signés, les absents notés, ceux qui
// n'ont rien dit et, à part, les absents prévus au planning. Les quatre font le total.
export function resumeEnClair(r, { ouverte }) {
  const attente = ouverte ? r.attente - (r.prevus || 0) : 0;
  const prevus = ouverte ? r.prevus || 0 : 0;
  return " ont signé"
    + (r.absents ? " · " + pluriel(r.absents, "absent") : "")
    + (attente ? ` · ${attente} en attente` : "")
    + (prevus ? " · " + pluriel(prevus, "absent prévu", "absents prévus") + " au planning" : "");
}

// La case d'une demi-journée sans feuille, dans la semaine de l'émargement (hors jour désactivé et
// hors aujourd'hui). Passée, elle dit si une feuille manque : une activité au planning sans feuille
// est « Feuille non faite » (risque à un contrôle), sans activité « Rien de prévu ». Une carte qui ne
// porte qu'une note ou qu'un formateur n'est pas une activité. `feuillesDeLaSemaine` : le nombre de
// feuilles de la semaine ; à zéro, l'émargement n'y servait pas encore (semaine d'avant son allumage),
// rien ne manque : « Pas de feuille ». `entries` null (planning illisible) : « Pas de feuille » aussi.
export function etatSansFeuille({ jour, aujourdhui, demi, entries, feuillesDeLaSemaine = 1 }) {
  if (jour >= aujourdhui) return { etat: "À venir", classe: "vide" };
  if (!Array.isArray(entries) || !feuillesDeLaSemaine) return { etat: "Pas de feuille", classe: "vide" };
  const di = dayIndexDe(jour);
  const activite = (e) => !!e.autonomie || String(e.activite ?? "").trim() !== "";
  const cours = entries.some((e) => e.day_index === di && e.half_day === demi && activite(e));
  return cours ? { etat: "Feuille non faite", classe: "manquante" } : { etat: "Rien de prévu", classe: "vide" };
}

// === Heures et jours ===

// Une heure écrite comme dans tout le reste de l'app (audit du 09/11, lot E) : « 9 h », « 12 h 30 », « 9 h 04 », avec des
// espaces insécables, pour qu'une case étroite (feuille d'émargement imprimée) ne coupe jamais « 12 h / 30 ».
const INSECABLE = "\u00a0";
export function heureEcrite(h, m) {
  const mm = String(m).padStart(2, "0");
  return mm === "00" ? `${Number(h)}${INSECABLE}h` : `${Number(h)}${INSECABLE}h${INSECABLE}${mm}`;
}

export function libelleHeure(hhmm) {
  const [h, m] = String(hhmm || "").split(":");
  if (h === undefined || m === undefined) return "";
  return heureEcrite(h, m);
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

// Heure de Paris d'un horodatage du serveur : « 9 h 04 » (une signature tombée pile : « 9 h »).
export function heureLocale(iso) {
  if (!iso) return "";
  const parts = FORMAT_HEURE.formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value ?? "";
  const m = parts.find((p) => p.type === "minute")?.value ?? "";
  return heureEcrite(h, m);
}

// Jour de Paris (AAAA-MM-JJ) d'un horodatage du serveur ; chaîne vide sans horodatage.
export function jourLocal(iso) {
  return iso ? jourParis(iso) ?? "" : "";
}

function jourValide(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
  return !Number.isNaN(Date.parse(s + "T00:00:00Z")) && jourDe(s, 0) === s;
}

// Jours fériés nationaux (métropole) : libellé du jour, ou null. Seul calcul de l'app : le planning et Mon suivi le lisent
// aussi (tests/jours-feries.test.mjs).
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

// Demi-journée suivante (sens 1) ou précédente (sens -1), en sautant samedi et dimanche.
export function demiVoisine(jour, demi, sens) {
  if (sens > 0 && demi === "matin") return { jour, demi: "aprem" };
  if (sens < 0 && demi === "aprem") return { jour, demi: "matin" };
  let j = jourDe(jour, sens > 0 ? 1 : -1);
  while (dayIndexDe(j) > 4) j = jourDe(j, sens > 0 ? 1 : -1);
  return { jour: j, demi: sens > 0 ? "matin" : "aprem" };
}

// Notes proposées en un clic : situations courantes (retard et départ à l'heure donnée),
// puis les notes déjà écrites sur les feuilles affichées, sans doublon, dix au plus.
export function notesProposees(dejaEcrites, heure) {
  const courantes = ["Absence injustifiée", "Absence justifiée", `Arrivé à ${heure}`, `Parti à ${heure}`,
    "Rendez-vous médical", "Téléphone déchargé : signé sur l'appareil du formateur"];
  const vues = new Set(courantes);
  const autres = [];
  for (const n of dejaEcrites || []) {
    const t = String(n || "").trim();
    if (!t || vues.has(t) || /^(Arrivé|Parti) à \d{1,2}h\d{2}$/.test(t)) continue;
    vues.add(t);
    autres.push(t);
  }
  return [...courantes, ...autres].slice(0, 10);
}

// « Émargement du matin », « de l'après-midi ».
export function deLaDemi(demi) {
  return demi === "aprem" ? "de l'après-midi" : "du matin";
}

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
    .filter((l) => l.stagiaire_id === stagiaireId && ligneSignee(l))
    .map((l) => l.seance_id));
  return (seances || [])
    .filter((s) => signees.has(s.id))
    .reduce((t, s) => t + dureeMinutes(s.debut, s.fin), 0);
}

// === Résumé d'une promo pour la direction (lot 5, Task 7) ===

// seances : feuilles de la promo ; lignes : leurs lignes (`seance_id`, `signe_le`, `absent`, `absence_origine`).
// Rend : le nombre de feuilles closes, la feuille ouverte (la plus récente) ou null, la dernière feuille (jour puis
// demi-journée) ou null, les absences notées (origine formateur ou planning, feuilles ouvertes ou closes) et les lignes non
// signées d'une feuille close (absence « non signé » posée à la clôture, ou ligne sans signature ni absence).
export function resumeEmargement({ seances, lignes } = {}) {
  const feuilles = Array.isArray(seances) ? seances : [];
  const ordre = (a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : (a.demi_journee === b.demi_journee ? 0 : a.demi_journee === "matin" ? -1 : 1));
  const recentes = feuilles.slice().sort((a, b) => ordre(b, a));
  const closes = new Set(feuilles.filter((s) => s.statut === "close").map((s) => s.id));
  let absences = 0;
  let nonSignees = 0;
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const close = closes.has(l.seance_id);
    if (l.absent && l.absence_origine !== "non_signe") absences++;
    else if (close && !l.signe_le) nonSignees++;
  }
  return {
    feuillesCloses: closes.size,
    feuilleOuverte: recentes.find((s) => s.statut === "ouverte") || null,
    derniere: recentes[0] || null,
    absences,
    nonSignees,
  };
}
