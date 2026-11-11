// Accueil (refonte, lot 2A) : les règles seulement. Où en est un événement par rapport à aujourd'hui
// (à venir, en cours, passé), le texte qui le dit, et la ligne « Promo <nom> · semaine <n> » sous la
// salutation. Module pur, sans DOM ni stockage : testé en node. Le prochain rendez-vous et l'à-faire de l'accueil
// du stagiaire (lot 2B) les lisent.
import { examenDemarrable, tempsRestantMs, formatTempsRestant } from "./qcm-exam-rules.js?v=20261110e";

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

// Numéro d'un jour de calendrier (jours écoulés depuis le 01/01/1970) : « AAAA-MM-JJ », ou une date dont on
// lit le jour LOCAL. Les jours se comptent entre numéros entiers : ni l'heure ni un changement d'heure (jour
// de 23 h ou de 25 h) ne décalent un résultat. NaN quand la valeur n'est pas un jour qui existe.
function numeroDeJour(valeur) {
  if (valeur instanceof Date) {
    return Date.UTC(valeur.getFullYear(), valeur.getMonth(), valeur.getDate()) / MS_PAR_JOUR;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof valeur === "string" ? valeur : "");
  if (!m) return NaN;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(annee, mois - 1, jour);
  const relu = new Date(ms);   // 2026-02-30 ou 2026-13-01 ne sont pas des jours : Date.UTC les reporterait
  return relu.getUTCFullYear() === annee && relu.getUTCMonth() === mois - 1 && relu.getUTCDate() === jour ? ms / MS_PAR_JOUR : NaN;
}

// Où en est un événement un jour donné. `debut` et `fin` : « AAAA-MM-JJ » ; `fin` absente (ou nulle, ou vide)
// vaut `debut`, un événement d'un seul jour. `aujourdhui` : « AAAA-MM-JJ », ou une date (son jour local).
//   « a-venir » : il n'a pas commencé, ou commence aujourd'hui ; `jours` : les jours jusqu'à son début (0 : aujourd'hui) ;
//   « en-cours » : commencé avant aujourd'hui et pas fini ; `jours` : les jours jusqu'à sa fin (0 : il finit aujourd'hui) ;
//   « passe » : fini avant aujourd'hui ; `jours` : négatif (les jours jusqu'à sa fin), jamais montré.
// Le premier jour d'un événement de plusieurs jours se dit donc « Aujourd'hui », le lendemain « En cours ».
// Une date illisible lève une TypeError : mieux vaut un échec visible qu'un décompte inventé.
export function etatEvenement({ debut, fin }, aujourdhui) {
  const premier = numeroDeJour(debut);
  const dernier = fin ? numeroDeJour(fin) : premier;
  const ce = numeroDeJour(aujourdhui);
  if ([premier, dernier, ce].some(Number.isNaN)) {
    throw new TypeError(`etatEvenement : date illisible (début ${debut}, fin ${fin}, jour ${aujourdhui})`);
  }
  if (ce > dernier) return { etat: "passe", jours: dernier - ce };
  if (ce > premier) return { etat: "en-cours", jours: dernier - ce };
  return { etat: "a-venir", jours: premier - ce };
}

// Le texte d'un état d'événement (le résultat d'etatEvenement). Un événement passé n'a pas de texte : l'accueil
// montre le premier événement qui n'est pas passé. Jamais un nombre négatif : `jours` doit être un entier positif
// ou nul, sinon rien n'est dit.
export function libelleDecompte(decompte) {
  const { etat, jours } = decompte || {};
  if (!Number.isInteger(jours) || jours < 0) return "";
  if (etat === "a-venir") {
    if (jours === 0) return "Aujourd'hui";
    if (jours === 1) return "Demain";
    return `Dans ${jours} jours`;
  }
  if (etat === "en-cours") {
    if (jours === 0) return "En cours, fin aujourd'hui";
    if (jours === 1) return "En cours, fin demain";
    return `En cours, fin dans ${jours} jours`;
  }
  return "";
}

// Lundi de la semaine d'un jour (son numéro, voir numeroDeJour) : le 01/01/1970, jour 0, était un jeudi.
const lundiDe = (numero) => numero - (((numero + 3) % 7) + 7) % 7;

// « Promo Nîmes, mars 2026 · semaine 31 » : la semaine 1 est celle du premier jour de la promo (du lundi au
// dimanche), la suivante commence le lundi. Pas de numéro quand il ne dirait rien de vrai : promo pas encore
// commencée, promo finie (après sa date de fin), dates absentes ou illisibles ; le nom seul alors, et rien sans
// nom (promo pas encore chargée). `promo` : la ligne de la promo (nom, date_debut, date_fin). `aujourdhui` :
// « AAAA-MM-JJ » ou une date.
export function lignePromo(promo, aujourdhui) {
  const nom = typeof promo?.nom === "string" ? promo.nom.trim() : "";
  if (!nom) return "";
  const debut = numeroDeJour(promo.date_debut);
  const fin = promo.date_fin ? numeroDeJour(promo.date_fin) : Infinity;
  const ce = numeroDeJour(aujourdhui);
  if (!(ce >= debut && ce <= fin)) return `Promo ${nom}`;
  return `Promo ${nom} · semaine ${1 + (lundiDe(ce) - lundiDe(debut)) / 7}`;
}

// === Accueil du stagiaire (lot 2B) ===

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
  "septembre", "octobre", "novembre", "décembre"];

// « jeudi 5 novembre » : le jour d'un « AAAA-MM-JJ » existant. Le jour se lit en UTC, comme numeroDeJour : aucun
// fuseau ne le décale.
function jourEnToutesLettres(iso) {
  const d = new Date(numeroDeJour(iso) * MS_PAR_JOUR);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

// Le prochain rendez-vous de l'accueil : le premier examen ou stage qui n'est pas passé (un stage commencé compte :
// il est « en cours »), à défaut le premier événement qui n'est pas passé ; un jour férié n'est jamais un rendez-vous.
// `evenements` : les lignes de l'agenda (title, type, date_start, date_end), dans n'importe quel ordre. Un événement
// à la date illisible est laissé de côté plutôt que de masquer les autres. `date` : le jour de DÉBUT, en toutes lettres ;
// `libelle` : le décompte (libelleDecompte). Rien à venir : null.
export function prochainRendezVous(evenements, aujourdhui) {
  const restants = [];
  for (const e of Array.isArray(evenements) ? evenements : []) {
    if (!e || e.type === "ferie") continue;
    let decompte;
    try { decompte = etatEvenement({ debut: e.date_start, fin: e.date_end }, aujourdhui); }
    catch (err) { continue; }
    if (decompte.etat !== "passe") restants.push({ e, decompte, debut: numeroDeJour(e.date_start) });
  }
  // Tri stable par début : l'ordre de l'agenda départage les événements d'un même jour.
  restants.sort((a, b) => a.debut - b.debut);
  const choisi = restants.find((r) => r.e.type === "examen" || r.e.type === "stage") || restants[0];
  if (!choisi) return null;
  return { titre: choisi.e.title, date: jourEnToutesLettres(choisi.e.date_start), libelle: libelleDecompte(choisi.decompte) };
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// Ce qu'il reste à faire au stagiaire, au plus 4 lignes, dans cet ordre :
//   1. un examen ouvert qu'il n'a pas passé (une tentative en mode « examen » le clôt ; un entraînement non) ;
//   2. le QCM d'un thème vu cette semaine au planning, jamais tenté (tout mode) ; le thème se retrouve par son titre
//      exact (`sujetsDeLaSemaine` : les titres déjà découpés, l'ordre du planning) ; un QCM qui a déjà sa ligne
//      d'examen n'en reçoit pas une seconde ;
//   3. le dossier professionnel tant que les 6 exemples ne sont pas remplis.
// `modules` : { qcm, dp } ; un module fermé (false) retire ses lignes. Une donnée qui n'a pas pu être lue
// (`exemplesDossier` nul) ne produit aucune ligne : mieux vaut se taire qu'inventer un travail.
// Chaque ligne : { cle, titre, detail, route, sousOnglet } ; la page en fait un lien.
export function aFaireStagiaire({ qcm, themes, tentatives, sujetsDeLaSemaine, exemplesDossier, modules, now } = {}) {
  const ouvert = (cle) => !modules || modules[cle] !== false;
  const lignes = [];
  const maintenant = now ?? Date.now();
  const liste = (v) => (Array.isArray(v) ? v : []);
  const passes = liste(tentatives);

  if (ouvert("qcm")) {
    const avecQuestions = liste(qcm).filter((q) => q && q.nb_questions > 0);
    const titreDuTheme = (q) => liste(themes).find((t) => t.id === q.theme_id)?.titre ?? q.titre;
    const dejaPasse = (q) => passes.some((t) => t.qcm_id === q.id && t.mode === "examen");
    const examens = avecQuestions.filter((q) => examenDemarrable(q, maintenant) && !dejaPasse(q));
    for (const q of examens) {
      const reste = tempsRestantMs(q, maintenant);
      lignes.push({
        cle: `examen-${q.id}`, titre: `Examen ouvert : ${titreDuTheme(q)}`,
        detail: reste == null ? "Sans limite de temps" : `Ferme dans ${formatTempsRestant(reste)}`,
        route: "themes", sousOnglet: "qcm",
      });
    }
    const vus = new Set(examens.map((q) => q.id));
    for (const sujet of liste(sujetsDeLaSemaine)) {
      const theme = liste(themes).find((t) => t.titre === sujet);
      const q = theme && avecQuestions.find((x) => x.theme_id === theme.id);
      if (!q || vus.has(q.id) || passes.some((t) => t.qcm_id === q.id)) continue;
      vus.add(q.id);
      lignes.push({
        cle: `qcm-${q.id}`, titre: `QCM du thème : ${theme.titre}`,
        detail: `Pas encore fait · ${pluriel(q.nb_questions, "question")}`,
        route: "themes", sousOnglet: "qcm",
      });
    }
  }
  if (ouvert("dp") && Number.isInteger(exemplesDossier) && exemplesDossier < 6) {
    lignes.push({
      cle: "dossier", titre: "Dossier professionnel", detail: `${pluriel(exemplesDossier, "exemple")} sur 6`,
      route: "mon-suivi", sousOnglet: "dp",
    });
  }
  // Le livret EPCF n'a pas de ligne : ce sont les formateurs qui le remplissent, le stagiaire le consulte en lecture seule
  // (audit du 09/11, A4). S'il devait un jour en remplir une part (question posée à Timy), la ligne reviendrait avec cette action.
  return lignes.slice(0, 4);
}

// La phrase d'une demi-journée de l'Accueil où le stagiaire n'est sur aucune carte du planning (ni au tableau, ni en voiture,
// ni en salle) : sans elle, la rangée liste les activités des autres sans lui dire où il est (audit du 09/11, A3). Seules les
// cartes de salle et de voiture nomment les stagiaires ; un cours, un contrôle, une autonomie ou une autre activité concerne
// toute la promo : leur présence suffit à taire la phrase. Rien non plus quand une carte le nomme, quand la demi-journée est
// vide (la page le dit déjà) ou sans fiche de stagiaire (`moi` nul, aperçu).
const CARTES_NOMINATIVES = ["salle", "voiture"];
export function sansPlaceDansLaDemi({ demi, cartes, moi } = {}) {
  const liste = (Array.isArray(cartes) ? cartes : []).filter(Boolean);
  if (moi == null || !liste.length || liste.some((c) => c.moi)) return null;
  if (!liste.every((c) => CARTES_NOMINATIVES.includes(c.genre))) return null;
  return (demi === "aprem" ? "Cet après-midi" : "Ce matin") + ", ton nom ne figure sur aucune activité du planning.";
}

// « À retenir » : les quatre règles courtes de l'app, lues par Mes préférences (section Informations). La dernière dit
// les pages par leur nom, celui de la barre (Notes n'est pas un onglet du stagiaire, les dates sont les Dates clés).
// `[{ gras, suite }]` : le début en gras, puis la suite de la phrase.
export function pointsARetenir() {
  return [
    { gras: "Ton identité est liée à ton email.", suite: " Tes ajouts de passages et tes notes sont signés automatiquement." },
    { gras: "Tu ajoutes et corriges tes passages toi-même.", suite: " Pour en supprimer un, demande à un formateur." },
    { gras: "Tout est tracé.", suite: " Chaque modification (passage, note, planning) est historisée avec son auteur." },
    { gras: "Ctrl + Z annule la dernière action.", suite: " Sur les notes, les passages, les thèmes et les dates clés." },
  ];
}

// « Bonjour » le matin, « Bon après-midi », « Bonsoir » de 18 h à 6 h : la salutation de l'Accueil, pour une heure locale (0 à 23).
export function salutationDe(heure) {
  if (heure < 6) return "Bonsoir";
  if (heure < 12) return "Bonjour";
  if (heure < 18) return "Bon après-midi";
  return "Bonsoir";
}
