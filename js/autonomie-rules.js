/*
 * Regles pures de l'autonomie (lecture et temps actif) : aucune dependance DOM ni reseau,
 * l'horloge est passee en argument (millisecondes), tout se teste par node.
 */
import { tempsLecture } from "./cours-rules.js";
import { lundiDe, jourDe, jourParis, dateLongue, dayIndexDe } from "./dates.js";

/** Cle de reglage (promo) qui allume la fonction. */
export const CLE_ACTIVATION = "autonomie_active";
/** Sans action depuis ce delai, le temps cesse de compter. */
export const SEUIL_INACTIVITE_MS = 60000;
/** Periode entre deux ecritures du temps en base. */
export const PERIODE_ECRITURE_MS = 30000;
/** Part du temps de lecture estime en dessous de laquelle un cours n'est pas compte lu. */
export const PART_PLANCHER = 0.3;

/** Vrai pour `true` et `"true"` (les reglages sont stockes en texte). */
export function estActif(valeur) {
  return valeur === true || valeur === "true";
}

/** Compteur de temps actif. Un intervalle compte de la derniere borne jusqu'au plus petit de
 *  « maintenant » et « derniere action + seuil », seulement page visible. Masquer la page clot
 *  la fenetre d'activite : au retour, rien ne compte avant une nouvelle action. */
export function creerCompteur() {
  let derniereAction = null;
  let estVisible = false;
  let borne = 0;
  let cumulMs = 0;

  const avancer = (t) => {
    if (estVisible && derniereAction !== null) {
      const fin = Math.min(t, derniereAction + SEUIL_INACTIVITE_MS);
      if (fin > borne) cumulMs += fin - borne;
    }
    if (t > borne) borne = t;
  };

  return {
    action(t) {
      avancer(t);
      if (estVisible) derniereAction = t;
    },
    visible(t, visible) {
      avancer(t);
      if (visible === estVisible) return;
      estVisible = visible;
      derniereAction = null;
    },
    prelever(t) {
      avancer(t);
      const secondes = Math.floor(cumulMs / 1000);
      cumulMs -= secondes * 1000;
      return secondes;
    },
  };
}

/** Secondes de lecture en dessous desquelles un cours n'est pas compte lu. */
export function plancherLecture(texte) {
  return Math.round(tempsLecture(texte) * 60 * PART_PLANCHER);
}

/** « 0 min », « 12 min », « 1 h 05 » : arrondi a la minute superieure. */
export function formatDuree(secondes) {
  const minutes = Math.ceil(Math.max(0, secondes) / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Fiche d'un stagiaire : cours lus parmi les publies, temps de la semaine (lundi a dimanche de
 *  `aujourdhui`) et total, entrainements, derniere trace. */
export function resumeAutonomie({ lectures, temps, entrainements, coursPublies, aujourdhui }) {
  const publies = new Set(coursPublies.map(String));
  const lus = new Set(lectures.filter((l) => l.lu_le && publies.has(String(l.cours_id))).map((l) => String(l.cours_id)));
  const lundi = lundiDe(aujourdhui);
  const dimanche = jourDe(lundi, 6);
  let secondesSemaine = 0;
  let secondesTotal = 0;
  for (const t of temps) {
    secondesTotal += t.secondes;
    if (t.jour >= lundi && t.jour <= dimanche) secondesSemaine += t.secondes;
  }
  let derniere = null;
  const voir = (iso) => {
    if (iso && (derniere === null || Date.parse(iso) > Date.parse(derniere))) derniere = iso;
  };
  for (const l of lectures) { voir(l.vu_le); voir(l.lu_le); }
  for (const e of entrainements) voir(e.finished_at);
  return {
    coursLus: lus.size,
    coursTotal: publies.size,
    secondesSemaine,
    secondesTotal,
    entrainements: entrainements.length,
    derniereActivite: derniere,
  };
}

/** La trace est permise pour un VRAI compte stagiaire seulement, interrupteur allume : pas d'apercu
 *  (« Voir en tant que »), pas de fondateur ni de compte d'equipe (meme avec une fiche stagiaire : la base
 *  les refuse aussi), et une fiche dans la promo affichee. Les conditions d'utilisation sont verifiees par la base. */
export function peutTracerAvec({ actif, apercu, fondateur, equipe, stagiaireId } = {}) {
  return actif === true && !apercu && !fondateur && !equipe && stagiaireId != null;
}

/** Compte d'equipe (formateur, administrateur, direction, siege, fondateur), AVEC OU SANS fiche stagiaire : la base refuse ses
 *  traces. `droits` : les drapeaux affiches ({admin, prof, equipe}) ; `profil` : le profil du compte ; `affectations` : ses
 *  affectations (formateur, direction ou siege, dans N'IMPORTE QUELLE promo : une seule suffit). */
export function estCompteEquipe({ droits, profil, affectations } = {}) {
  return !!(droits?.equipe || droits?.admin || droits?.prof || profil?.is_admin || profil?.is_founder
    || (Array.isArray(affectations) && affectations.length > 0));
}

/** La base refuse tout appel de plus de 60 secondes (« Durée invalide ») : un envoi ne dépasse jamais cette part. */
export const MAX_SECONDES_ECRITURE = 60;

/** Part du cumul à envoyer en un appel : un entier de 0 à 60, jamais plus que le cumul. */
export function trancheAEnvoyer(cumul) {
  const n = Math.floor(Number(cumul));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_SECONDES_ECRITURE);
}

/** Reprise de lecture : l'id de la section où reprendre, ou null. Il faut une lecture existante, non terminée (`lu_le` vide),
 *  dont la section est encore l'un des titres de niveau 2 du cours (le cours a pu être réécrit depuis). */
export function sectionDeReprise(lecture, idsSections) {
  if (!lecture || lecture.lu_le) return null;
  const id = lecture.section;
  if (!id || !Array.isArray(idsSections) || !idsSections.includes(id)) return null;
  return id;
}

/** Section « en haut » de la zone de défilement : le dernier titre dont le haut est passé la position, à `marge` près.
 *  `positions` : [{ id, haut }] dans l'ordre du cours. Aucun titre atteint : null. */
export function sectionEnHaut(positions, defilement, marge = 0) {
  let trouvee = null;
  for (const p of positions) {
    if (p.haut <= defilement + marge) trouvee = p.id;
  }
  return trouvee;
}

/** Le bandeau de reprise disparaît quand le défilement manuel s'éloigne de plus d'un écran du point de départ. */
export function repriseDepassee(depart, actuel, hauteurEcran) {
  return Math.abs(actuel - depart) > hauteurEcran;
}

/** Les cours que le stagiaire a lus jusqu'au bout : l'ensemble de leurs identifiants (en texte). `lectures` : lignes de
 *  cours_lectures ({ cours_id, lu_le, ... }) ; une lecture ouverte sans être terminée (`lu_le` vide) n'y est pas. */
export function coursLus(lectures) {
  const lus = new Set();
  for (const l of Array.isArray(lectures) ? lectures : []) {
    if (l && l.lu_le && l.cours_id != null) lus.add(String(l.cours_id));
  }
  return lus;
}

/** La ligne de l'équipe sous le titre d'un thème : combien de stagiaires de la promo ont lu le cours.
 *  `parCours` : Map(cours_id -> lus) rendue par la base ; `coursId` : le cours du thème ; `total` : T, les stagiaires en
 *  formation de la promo ; `publie` : le cours est publié.
 *  Une Map vide ne dit rien (le compte n'a pas le droit, ou personne n'a encore rien lu) : aucune phrase nulle part. Dès qu'elle
 *  porte un cours, le compte a le droit, et « Personne ne l'a encore lu » est vrai des autres cours publiés. N est borné à T.
 *  Rien (null) aussi quand T est nul ou inconnu, ou que le cours n'est pas publié. */
export function phraseLecteurs({ parCours, coursId, total, publie } = {}) {
  if (!publie || !(parCours instanceof Map) || parCours.size === 0) return null;
  const t = Number(total);
  if (!Number.isFinite(t) || t <= 0) return null;
  const brut = Number(parCours.get(coursId));
  const n = Number.isFinite(brut) && brut > 0 ? Math.min(brut, t) : 0;
  if (n === 0) return "Personne ne l'a encore lu";
  return n === 1 ? `1 sur ${t} l'a lu` : `${n} sur ${t} l'ont lu`;
}

/** Signale « cours lu » une seule fois par cours : `notifier(coursId)` n'est appelé qu'à la première écriture qui rend vrai. */
export function creerSignalLu(notifier) {
  const dits = new Set();
  return (coursId, lu) => {
    if (lu !== true || coursId == null) return;
    const cle = String(coursId);
    if (dits.has(cle)) return;
    dits.add(cle);
    notifier(coursId);
  };
}

// === Partie « Travail en autonomie » de la fiche (lot 1 e-learning, tâche 7a) ===

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** « 10 novembre » (l'année s'ajoute seulement si ce n'est pas celle de `aujourdhui`) : le jour est celui de Paris, comme
 *  dans la base. Chaîne vide si l'instant manque ou est illisible. */
export function jourSansAnnee(instant, aujourdhui) {
  if (!instant) return "";
  const jour = jourParis(instant);
  if (!jour) return "";
  const longue = dateLongue(jour);
  return jour.slice(0, 4) === String(aujourdhui || "").slice(0, 4) ? longue.replace(/ \d{4}$/, "") : longue;
}

/** « mardi 10 novembre » : la date courte précédée du jour de la semaine. */
export function jourAvecSemaine(instant, aujourdhui) {
  const courte = jourSansAnnee(instant, aujourdhui);
  return courte ? `${JOURS[dayIndexDe(jourParis(instant))]} ${courte}` : "";
}

/** La partie est montrée : interrupteur de la promo allumé, et soit le VRAI compte stagiaire (`peutTracer`, qui exclut
 *  l'aperçu), soit un compte d'équipe qui lit toutes les notes (`litNotes`, la condition de la partie des résultats ;
 *  la base applique le même droit). Jamais le siège. */
export function autonomieVisible({ actif, soi, peutTracer, litNotes, espace } = {}) {
  if (actif !== true) return false;
  if (soi) return peutTracer === true;
  return litNotes === true && espace !== "siege";
}

/** Ce que la partie affiche, le même pour le stagiaire et l'équipe (seuls la note et le texte vide changent de voix).
 *  `cours` : l'index des cours ({ id, titre, published }) ; `entrainements` : tentatives de QCM ({ mode, finished_at }),
 *  seul le mode « entrainement » compte. Rien d'autre que cinq repères et la liste : pas de détail par jour ni par QCM. */
export function ficheAutonomie({ lectures = [], temps = [], entrainements = [], cours = [], aujourdhui, soi = false } = {}) {
  const publies = cours.filter((c) => c && c.published);
  const titres = new Map(publies.map((c) => [String(c.id), c.titre]));
  const faites = entrainements.filter((e) => e && e.mode === "entrainement" && e.finished_at);
  const r = resumeAutonomie({ lectures, temps, entrainements: faites, coursPublies: publies.map((c) => c.id), aujourdhui });

  const parCours = new Map();
  for (const l of lectures) {
    const cle = String(l.cours_id);
    if (!titres.has(cle)) continue;
    const vu = parCours.get(cle);
    const meilleur = !vu || (l.lu_le && !vu.lu_le) || (!!l.lu_le === !!vu.lu_le && Date.parse(l.ouvert_le) > Date.parse(vu.ouvert_le));
    if (meilleur) parCours.set(cle, l);
  }
  const lignes = [...parCours.entries()].map(([cle, l]) => {
    const depart = l.ouvert_le || l.vu_le;
    const quand = l.lu_le ? l.lu_le : depart;
    const date = jourSansAnnee(quand, aujourdhui);
    const mot = l.lu_le ? "Lu" : "Commencé";
    const instant = Date.parse(quand);
    return { cours_id: l.cours_id, titre: titres.get(cle) || "Cours", texte: date ? `${mot} le ${date}` : mot, instant: Number.isNaN(instant) ? -Infinity : instant };
  }).sort((a, b) => (b.instant - a.instant) || a.titre.localeCompare(b.titre, "fr"))
    .map(({ instant, ...ligne }) => ligne);

  const derniere = r.derniereActivite ? jourAvecSemaine(r.derniereActivite, aujourdhui) : "";
  return {
    reperes: [
      `Cours lus : ${r.coursLus} sur ${r.coursTotal}`,
      `Temps cette semaine : ${formatDuree(r.secondesSemaine)}`,
      `Temps depuis le début : ${formatDuree(r.secondesTotal)}`,
      `Entraînements QCM : ${r.entrainements}`,
      `Dernière activité : ${derniere || "aucune"}`,
    ],
    lignes,
    vide: lignes.length === 0 && r.secondesTotal === 0 && r.entrainements === 0 && r.derniereActivite === null,
    note: soi ? "Ton formateur voit exactement cette page." : null,
    texteVide: soi
      ? "Rien pour l'instant. Les cours que tu lis et tes entraînements apparaîtront ici."
      : "Rien pour l'instant. Les cours lus et les entraînements de ce stagiaire apparaîtront ici.",
  };
}
