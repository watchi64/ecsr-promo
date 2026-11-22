// Règles pures de l'écran « Prévenir d'une absence » (espace contact, tâche 15) : les demi-journées d'une absence (miroir de
// _contact_jours_absence, migration 20261115_contact_3_absences.sql), la façon de la dire, la vérification du formulaire (les phrases
// de prevenir_absence : la base reste juge), le courriel du justificatif. Dates en « AAAA-MM-JJ », heures en « HH:MM ».
// Lancer : node tests/contact-absences-rules.test.mjs

import { estVueStagiaire } from "./espaces-rules.js?v=20261122a";

/**
 * Les motifs d'une absence, dans l'ordre du formulaire, et leurs libellés (suivi dans l'app). « Santé » n'en fait plus partie depuis
 * la migration 5 (décision de Timy du 18/11) : la contrainte absences_annoncees_motif et prevenir_absence n'admettent que ces cinq codes.
 */
export const LIBELLES_MOTIF = Object.freeze({ transport: "Transport", demarche: "Démarche", famille: "Famille", personnel: "Raison personnelle", autre: "Autre" });

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DEBUT_APRES_MIDI = "13:30";
const FORME_HEURE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const JOUR_MS = 86400000;

// « AAAA-MM-JJ » lu en UTC (aucun changement d'heure ne décale un jour) ; null si le jour n'existe pas.
function lireJour(v) {
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}
const versJour = (d) => d.toISOString().slice(0, 10);
const nombreJour = (d) => (d.getUTCDate() === 1 ? "1er" : String(d.getUTCDate()));

/**
 * Les demi-journées d'une absence : [{ jour, demi: "matin"|"aprem", entiere, debut, fin }], jours ouvrés seulement (ni samedi ni
 * dimanche). Journée : matin et après-midi ; matin ou après-midi : celle-là ; heures : la seule demi-journée qui contient l'heure de
 * début (l'après-midi commence à `debutAprem`, 13 h 30 par défaut), `entiere` faux, `debut` et `fin` portés. C'est la forme que
 * apercu_envoi reçoit (jour et demi).
 */
export function demiJourneesDe({ du, au = null, quand, debut = null, fin = null, debutAprem = DEBUT_APRES_MIDI } = {}) {
  const premier = lireJour(du);
  const dernier = quand === "heures" ? premier : (lireJour(au || du) ?? premier);
  if (!premier || !dernier || dernier < premier) return [];
  const sortie = [];
  const nb = Math.min(Math.round((dernier - premier) / JOUR_MS), 400);
  for (let i = 0; i <= nb; i++) {
    const d = new Date(premier.getTime() + i * JOUR_MS);
    const semaine = d.getUTCDay();
    if (semaine === 0 || semaine === 6) continue;
    const jour = versJour(d);
    if (quand === "journee") {
      sortie.push({ jour, demi: "matin", entiere: true, debut: null, fin: null }, { jour, demi: "aprem", entiere: true, debut: null, fin: null });
    } else if (quand === "matin" || quand === "aprem") {
      sortie.push({ jour, demi: quand, entiere: true, debut: null, fin: null });
    } else if (quand === "heures") {
      sortie.push({ jour, demi: String(debut ?? "") >= debutAprem ? "aprem" : "matin", entiere: false, debut: debut ?? null, fin: fin ?? null });
    }
  }
  return sortie;
}

/**
 * La marque d'absence annoncée d'un stagiaire sur une demi-journée du planning, d'après les lignes de absences_annoncees_semaine
 * ([{ stagiaire_id, day_index, half_day, entiere, debut, fin }]). `creneau` : { day_index, half_day } (une entrée du planning).
 * Équipe : « absent, prévenu » ou « absent de 10 h à 11 h » ; stagiaire (`estVueStagiaire(espace)`) : « absent » ; nul sans absence.
 * Jamais le motif : la base ne le rend pas.
 */
export function marqueAbsence(absences, creneau, sid, espace) {
  if (sid == null || !creneau || !Array.isArray(absences)) return null;
  const dujour = absences.filter((x) => x && x.stagiaire_id === sid && x.day_index === creneau.day_index && x.half_day === creneau.half_day);
  // Deux absences sur la même demi-journée : la plus large l'emporte (une absence entière avant une plage).
  const a = dujour.find((x) => x.entiere !== false) ?? dujour[0];
  if (!a) return null;
  if (estVueStagiaire(espace)) return "absent";
  return a.entiere === false && a.debut && a.fin ? `absent de ${heureDite(a.debut)} à ${heureDite(a.fin)}` : "absent, prévenu";
}

/** Ce que l'absence pose sur la feuille d'émargement : « absent » (journée, matin, après-midi) ou une « observation » (des heures). */
export const premarquage = (absence) => (absence?.quand === "heures" ? "observation" : "absent");

/** La phrase sous les cases décochées (`sans` : les envois annexes décochés), nulle quand tout est coché. */
export function phraseCasesDecochees(sans) {
  return Array.isArray(sans) && sans.length > 0 ? "Ils ne seront pas prévenus, mais l'absence apparaîtra au planning." : null;
}

// « 10:00 » donne « 10 h », « 10:30 » « 10 h 30 ».
function heureDite(t) {
  const [h, m] = String(t).split(":").map(Number);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/**
 * L'absence en mots : « jeudi 19 novembre, matin », « du 19 au 23 novembre », « jeudi 19 novembre, de 10 h à 11 h ». Un seul jour : le
 * jour puis le moment (journée, matin, après-midi, heures) ; plusieurs jours : « du ... au ... », suivi de « matins » ou
 * « après-midi » quand l'absence ne porte que sur une moitié des journées.
 */
export function libelleAbsence({ du, au = null, quand, debut = null, fin = null } = {}) {
  const a = lireJour(du);
  if (!a) return "";
  const b = lireJour(au || du) ?? a;
  if (quand === "heures" || b.getTime() === a.getTime()) {
    const jour = `${JOURS[a.getUTCDay()]} ${nombreJour(a)} ${MOIS[a.getUTCMonth()]}`;
    const moment = quand === "matin" ? "matin" : quand === "aprem" ? "après-midi" : quand === "heures" ? `de ${heureDite(debut)} à ${heureDite(fin)}` : "journée";
    return `${jour}, ${moment}`;
  }
  const fin2 = `${nombreJour(b)} ${MOIS[b.getUTCMonth()]}`;
  const debut2 = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear() ? nombreJour(a) : `${nombreJour(a)} ${MOIS[a.getUTCMonth()]}`;
  const suite = quand === "matin" ? ", matins" : quand === "aprem" ? ", après-midi" : "";
  return `du ${debut2} au ${fin2}${suite}`;
}

/**
 * L'absence en mots d'après les `jours` d'une ligne de liste_demandes ([{ jour, demi }]), quand on n'a pas ses dates et ses heures :
 * « jeudi 19 novembre, matin », « du 19 au 23 novembre ». Vide si la liste est vide ou illisible.
 */
export function libelleDesJours(jours) {
  const l = (Array.isArray(jours) ? jours : []).filter((x) => x && lireJour(x.jour) && (x.demi === "matin" || x.demi === "aprem"));
  if (l.length === 0) return "";
  const parJour = new Map();
  for (const x of l) parJour.set(x.jour, new Set([...(parJour.get(x.jour) ?? []), x.demi]));
  const dates = [...parJour.keys()].sort();
  const demis = new Set(l.map((x) => x.demi));
  const quand = parJour.size > 0 && [...parJour.values()].every((d) => d.size === 2) ? "journee" : demis.size === 1 ? [...demis][0] : "journee";
  return libelleAbsence({ du: dates[0], au: dates[dates.length - 1], quand });
}

/** « absence du jeudi 19 novembre, matin » ou « absence du 19 au 23 novembre » : le « du » n'est jamais doublé. */
export function phraseAbsence(absence) {
  const l = libelleAbsence(absence);
  return l.startsWith("du ") ? `absence ${l}` : `absence du ${l}`;
}

/**
 * Le courriel du justificatif : `mailto:` avec l'objet « Justificatif : absence du jeudi 19 novembre, matin » et deux lignes de corps.
 * Nul sans adresse (fiche non vérifiée : l'écran dit alors de remettre le justificatif au centre, C-18).
 */
export function mailtoJustificatif({ email, du, au = null, quand, debut = null, fin = null } = {}) {
  const adresse = typeof email === "string" ? email.trim() : "";
  if (!adresse || /\s/.test(adresse)) return null;
  const phrase = phraseAbsence({ du, au, quand, debut, fin });
  const objet = `Justificatif : ${phrase}`;
  const corps = `Bonjour,\r\nVoici mon justificatif pour mon ${phrase} (en pièce jointe).`;
  return `mailto:${adresse}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
}

/** L'adresse du justificatif : celle du premier destinataire principal de demande_detail qui en a une, sinon nul. */
export function adresseJustificatif(destinataires) {
  const x = (destinataires ?? []).find((d) => d && d.principal && typeof d.email === "string" && d.email.trim() !== "");
  return x ? x.email.trim() : null;
}

/**
 * Ce qui manque ou ne va pas dans le formulaire, avec les phrases de la base et dans son ordre (prevenir_absence), ou nul. Sert à
 * griser « Envoyer » et à dire pourquoi sans attendre ; la base juge de toute façon. `aujourdhui` : le jour de Paris.
 */
export function verifierAbsence({ du, au = null, quand, debut = null, fin = null, motif, mot = "", aujourdhui } = {}) {
  const premier = lireJour(du);
  if (!premier) return "Choisis le jour de ton absence.";
  if (aujourdhui && du < aujourdhui) return "Une absence passée se règle avec l'équipe.";
  const dernier = lireJour(au || du) ?? premier;
  if (dernier < premier) return "Le dernier jour de ton absence précède le premier.";
  if (Math.round((dernier - premier) / JOUR_MS) > 30) return "Une absence annoncée couvre 31 jours au plus : au-delà, vois avec l'équipe.";
  if (!["journee", "matin", "aprem", "heures"].includes(quand)) return "Choisis quand : la journée, le matin, l'après-midi ou de telle heure à telle heure.";
  if (quand === "heures") {
    if (!FORME_HEURE.test(String(debut ?? "")) || !FORME_HEURE.test(String(fin ?? "")) || debut >= fin) {
      return "Indique l'heure de début et l'heure de fin (par exemple 10:00 et 11:00), le début avant la fin.";
    }
  }
  if (!Object.keys(LIBELLES_MOTIF).includes(motif)) return "Choisis un motif : transport, démarche, famille, raison personnelle ou autre.";
  if (String(mot ?? "").trim().length > 200) return "Ton mot compte 200 caractères au plus.";
  if (demiJourneesDe({ du, au, quand, debut, fin }).length === 0) return "Ces jours ne comptent aucune demi-journée de formation (ni le samedi ni le dimanche).";
  return null;
}
