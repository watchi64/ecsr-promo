// Les dates de l'app, écrites et calculées en un seul endroit (ménage des doubles du 11/11/2026 : chaque fonction
// existait jusqu'à quatre fois). Module pur, sans DOM ni stockage : testé en node par tests/dates.test.mjs.
//
// Deux familles :
// - écrire une date pour une personne : dateFr (« 11/11/2026 »), dateLongue (« 1er novembre 2026 »), dateHeure
//   (« 28/10/2026 à 10 h 42 ») ;
// - compter sur des jours « AAAA-MM-JJ » : jourDe, dayIndexDe, lundiDe, lus en UTC pour qu'aucun changement d'heure ne
//   décale un jour ; jourParis donne le jour de Paris d'un instant, celui que la base utilise.

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DEBUT_JOUR = /^(\d{4})-(\d{2})-(\d{2})/;

// 7 donne « 07 » : heures, minutes, jours et mois.
export const deuxChiffres = (n) => String(n).padStart(2, "0");

// Les trois nombres du jour par lequel commence une chaîne « AAAA-MM-JJ » (une date seule ou un horodatage de la base),
// s'il existe au calendrier ; null sinon (texte, nombre, 2026-13-01, 2026-02-30).
function lireJour(valeur) {
  const m = typeof valeur === "string" ? DEBUT_JOUR.exec(valeur) : null;
  if (!m) return null;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  return d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour ? { annee, mois, jour } : null;
}

// « 2026-11-11 » (ou un horodatage qui commence ainsi) donne « 11/11/2026 » ; null si la valeur ne commence pas par un
// jour qui existe (l'appelant choisit quoi écrire à la place : « date non renseignée », des pointillés...).
export function dateFr(valeur) {
  const j = lireJour(valeur);
  return j ? `${deuxChiffres(j.jour)}/${deuxChiffres(j.mois)}/${j.annee}` : null;
}

// « 2027-12-11 » donne « 11 décembre 2027 » : une date dans une phrase s'écrit en toutes lettres (audit du 09/11, lot E).
// Le 1er du mois garde son ordinal. Chaîne vide si la valeur ne commence pas par un jour qui existe.
export function dateLongue(valeur) {
  const j = lireJour(valeur);
  return j ? `${j.jour === 1 ? "1er" : j.jour} ${MOIS[j.mois - 1]} ${j.annee}` : "";
}

// Un instant (horodatage de la base, ou Date) en heure de l'appareil : « 28/10/2026 à 10 h 42 ». Chaîne vide s'il est
// illisible.
export function dateHeure(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "";
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} à ${d.getHours()} h ${deuxChiffres(d.getMinutes())}`;
}

// Le jour « AAAA-MM-JJ » à Paris pour un instant donné (horodatage ou Date). La base décide avec le même jour :
// _questionnaire_jour() vaut (now() at time zone 'Europe/Paris')::date (supabase/migrations/20261108_questionnaires.sql),
// indépendamment du fuseau de l'appareil : une ouverture à 00 h 30 est datée du jour même, pas de la veille en UTC. Nul si
// l'instant est illisible.
const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
export function jourParis(instant) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const parties = Object.fromEntries(FORMAT_PARIS.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parties.year}-${parties.month}-${parties.day}`;
}

const versDate = (jour) => new Date(jour + "T00:00:00Z");
const versIso = (d) => d.toISOString().slice(0, 10);

// Le jour situé `decalage` jours après `jour` (avant s'il est négatif), « AAAA-MM-JJ ».
export function jourDe(jour, decalage) {
  const d = versDate(jour);
  d.setUTCDate(d.getUTCDate() + decalage);
  return versIso(d);
}

// 0 = lundi … 6 = dimanche.
export function dayIndexDe(jour) {
  return (versDate(jour).getUTCDay() + 6) % 7;
}

// Le lundi de la semaine d'un jour, « AAAA-MM-JJ ». Seul calcul de l'app : utils.getMonday (sur une Date) le lit aussi.
export function lundiDe(jour) {
  return jourDe(jour, -dayIndexDe(jour));
}
