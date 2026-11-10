// Règles de la section « Questionnaires » de la page Qualiopi (gestion, fondateur) : portée lue pour une promo, années du
// questionnaire des formateurs, état de l'ouverture (selon les dates, ouvert ou fermé à la main) et boutons qui en découlent,
// résumé des réponses, lignes de résultats question par question, commentaires montrables. PUR : ni DOM, ni réseau, ni horloge
// (`aujourdhui` est passé en « AAAA-MM-JJ », `jourParis` reçoit l'instant). Testé en node (tests/questionnaires-gestion-rules.test.mjs).
//
// L'affichage part du catalogue (QUESTIONNAIRES[cle].questions), jamais des comptes rendus par la base : une question sans
// aucune réponse s'affiche donc « moins de N réponses », comme une question sous le seuil.

import { QUESTIONNAIRES, ECHELLE, seuilDe } from "./questionnaires-data.js?v=20261110e";
import { fenetreQuestionnaire, resultatsAffichables, tauxSatisfaction, texteSousSeuil } from "./questionnaires-rules.js?v=20261110e";
import { phraseDeLaBase, PHRASE_RESEAU } from "./questionnaires-erreurs.js?v=20261110e";

const ESPACE_INSECABLE = String.fromCharCode(0xa0);
const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})/;
const anneeDe = (jour) => {
  const m = typeof jour === "string" ? FORMAT_JOUR.exec(jour) : null;
  return m ? Number(m[1]) : null;
};
const dateFr = (jour) => `${jour.slice(8, 10)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}`;
const periode = (fenetre) => `du ${dateFr(fenetre.du)} au ${dateFr(fenetre.au)}`;
const entier = (v) => Number.isInteger(v) && v > 0;
const pluriel = (n, singulier, pluriel_ = singulier + "s") => `${n} ${n > 1 ? pluriel_ : singulier}`;

// Le jour « AAAA-MM-JJ » à Paris pour un instant donné. La base décide de l'ouverture avec le même jour :
// _questionnaire_jour() vaut (now() at time zone 'Europe/Paris')::date (supabase/migrations/20261108_questionnaires.sql),
// indépendamment du fuseau de la session. La page calcule donc l'état « selon les dates » avec ce jour-là, jamais avec le
// fuseau de l'appareil, et le recalcule à chaque lecture. Nul si l'instant est illisible.
const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
export function jourParis(instant) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const parties = Object.fromEntries(FORMAT_PARIS.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parties.year}-${parties.month}-${parties.day}`;
}

// Les trois questionnaires, dans l'ordre de la page, avec leur nom côté gestion (le titre du catalogue s'adresse à la
// personne qui répond : « Ton avis sur la formation », « Votre avis de formateur »). La gestion est réservée à l'équipe :
// ses messages vouvoient.
export const QUESTIONNAIRES_GESTION = [
  { cle: "fin_stagiaire", titre: "Fin de formation", qui: "Stagiaires de la promo, de la semaine avant la fin à 30 jours après." },
  { cle: "six_mois_stagiaire", titre: "Six mois après", qui: "Stagiaires de la promo, de 6 à 7 mois après la fin." },
  { cle: "fin_formateur", titre: "Formateurs", qui: null },
];

// La portée lue pour la promo choisie : { promo_id } pour les stagiaires, { lieu_id, annee } pour les formateurs ; nulle si la
// promo n'a pas d'identifiant, pas de centre (formateurs) ou si l'année est illisible.
export function porteeGestion(cle, promo, annee) {
  if (QUESTIONNAIRES[cle]?.public === "formateur") {
    return entier(promo?.lieu_id) && Number.isInteger(annee) ? { lieu_id: promo.lieu_id, annee } : null;
  }
  return QUESTIONNAIRES[cle] && entier(promo?.id) ? { promo_id: promo.id } : null;
}

// Années à proposer pour le questionnaire des formateurs : l'année du jour et celles que touchent les fenêtres des promos du
// centre, jamais dans le futur ; de la plus récente à la plus ancienne. Une réponse compte dans l'année du jour où elle est
// donnée : la fenêtre de Nîmes (04/12/2026 au 10/01/2027) en remplit deux.
export function anneesFormateur(promosDuLieu, aujourdhui) {
  const courante = anneeDe(aujourdhui);
  if (courante === null) return [];
  const annees = new Set([courante]);
  for (const promo of Array.isArray(promosDuLieu) ? promosDuLieu : []) {
    const fenetre = fenetreQuestionnaire("fin_formateur", promo);
    if (!fenetre) continue;
    for (let a = anneeDe(fenetre.du); a <= anneeDe(fenetre.au); a++) if (a <= courante) annees.add(a);
  }
  return [...annees].sort((a, b) => b - a);
}

// « Formateurs du centre de Nîmes, année 2026 ».
export function libellePorteeFormateur(lieuNom, annee) {
  const lieu = typeof lieuNom === "string" && lieuNom.trim() ? ` de ${lieuNom.trim()}` : "";
  return `Formateurs du centre${lieu}, année ${annee}. Réponses regroupées pour toutes les promos du centre.`;
}

// L'ouverture posée à la main pour une portée, lue dans les lignes de questionnaire_ouvertures : true, false, ou null (selon
// les dates). Une portée nulle ou des lignes illisibles valent null.
export function ouvertureDe(lignes, cle, portee) {
  if (!portee || !Array.isArray(lignes)) return null;
  const ligne = lignes.find((o) => o && o.cle === cle
    && (o.promo_id ?? null) === (portee.promo_id ?? null)
    && (o.lieu_id ?? null) === (portee.lieu_id ?? null)
    && (o.annee ?? null) === (portee.annee ?? null));
  return typeof ligne?.ouvert === "boolean" ? ligne.ouvert : null;
}

// État de l'ouverture d'un questionnaire pour la page : { ouvert, mode, etiquette, detail }.
//   mode « dates » : la fenêtre décide (stagiaires : celle de la promo ; formateurs : celle d'une promo du centre au moins,
//   et seulement pour l'année du jour) ; mode « main » : l'ouverture posée par la gestion, qui prime dans les deux sens.
export function etatOuverture({ cle, promo, promosDuLieu, annee, ouverture, aujourdhui }) {
  if (typeof ouverture === "boolean") {
    return {
      ouvert: ouverture,
      mode: "main",
      etiquette: ouverture ? "Ouvert" : "Fermé",
      detail: ouverture ? "Ouvert à la main : les dates ne comptent plus." : "Fermé à la main : les dates ne comptent plus.",
    };
  }
  const dates = (ouvert, detail) => ({ ouvert, mode: "dates", etiquette: ouvert ? "Ouvert" : "Fermé", detail });
  const jour = typeof aujourdhui === "string" && FORMAT_JOUR.test(aujourdhui) ? aujourdhui.slice(0, 10) : null;
  const dedans = (f) => jour !== null && jour >= f.du && jour <= f.au;
  if (QUESTIONNAIRES[cle]?.public === "formateur") {
    if (anneeDe(jour) !== annee) return dates(false, `Selon les dates : l'année ${annee} n'est plus celle du jour, il ne s'ouvre plus.`);
    const fenetres = (Array.isArray(promosDuLieu) ? promosDuLieu : [])
      .map((p) => fenetreQuestionnaire(cle, p))
      .filter((f) => f && anneeDe(f.du) <= annee && anneeDe(f.au) >= annee)
      .sort((a, b) => (a.du < b.du ? -1 : a.du > b.du ? 1 : 0));
    if (!fenetres.length) return dates(false, "Selon les dates : aucune promo du centre ne finit autour de cette année.");
    return dates(fenetres.some(dedans), `Selon les dates : ${fenetres.map(periode).join(", ")} (fin des promos du centre).`);
  }
  const fenetre = fenetreQuestionnaire(cle, promo);
  if (!fenetre) return dates(false, "Selon les dates : la promo n'a pas de date de fin, il ne s'ouvre pas tout seul.");
  return dates(dedans(fenetre), `Selon les dates : ${periode(fenetre)}.`);
}

// Les boutons de l'ouverture : { libelle, valeur } avec valeur true (ouvrir), false (fermer) ou null (revenir aux dates).
// Selon les dates, un seul bouton : l'inverse de l'état du jour. À la main : l'inverse, puis « Revenir aux dates ».
export function actionsOuverture(etat) {
  const inverse = etat?.ouvert ? { libelle: "Fermer le questionnaire", valeur: false } : { libelle: "Ouvrir le questionnaire", valeur: true };
  return etat?.mode === "main" ? [inverse, { libelle: "Revenir aux dates", valeur: null }] : [inverse];
}

// Ce que dit la ligne d'état après un clic.
export function messageOuverture(valeur) {
  if (valeur === true) return "Questionnaire ouvert à la main.";
  if (valeur === false) return "Questionnaire fermé à la main.";
  return "Questionnaire revenu aux dates.";
}

// La migration n'est pas appliquée : la lecture des résultats rend un seuil nul (js/db.js), celle des ouvertures null.
export function questionnairesAbsents({ ouvertures, resultats }) {
  return ouvertures === null || (Array.isArray(resultats) && resultats.some((r) => !r || r.seuil === null || r.seuil === undefined));
}

// Résumé des réponses d'une portée : { assez, n, texte }. Sous le seuil, aucun nombre : « moins de 5 réponses ».
export function resumeReponses(cle, resultats) {
  const publicCible = QUESTIONNAIRES[cle]?.public ?? "stagiaire";
  const n = resultats?.reponses;
  if (Number.isInteger(n) && n >= seuilDe(publicCible)) return { assez: true, n, texte: pluriel(n, "réponse") };
  return { assez: false, n: null, texte: texteSousSeuil(publicCible) };
}

// « 80 % d'accord (plutôt oui ou tout à fait), sur 5 notes ».
export function texteAccord(accord) {
  if (!accord) return null;
  return `${accord.taux}${ESPACE_INSECABLE}% d'accord (plutôt oui ou tout à fait), sur ${pluriel(accord.repondants, "note")}`;
}

// Le taux de la question globale, ou nul sous le seuil (sur les seules notes, « sans avis » exclu). `valeur` et `detail`
// coupent `texte` en deux pour la page : le chiffre en gros, la méthode dessous.
export function satisfactionGlobale(cle, resultats) {
  const questionnaire = QUESTIONNAIRES[cle];
  const globale = questionnaire?.questions.find((q) => q.globale);
  if (!globale || !resumeReponses(cle, resultats).assez) return null;
  const accord = tauxSatisfaction(resultats?.questions?.[globale.id], 0, questionnaire.public);
  if (!accord) return null;
  return {
    taux: accord.taux,
    repondants: accord.repondants,
    texte: texteAccord(accord),
    valeur: `${accord.taux}${ESPACE_INSECABLE}% d'accord`,
    detail: `plutôt oui ou tout à fait, sur ${pluriel(accord.repondants, "note")}`,
  };
}

// Les lignes de résultats, une par question du catalogue (le commentaire à part), dans l'ordre du questionnaire :
//   { id, type, texte, globale, facultative, sousSeuil: true, texteSousSeuil } sous le seuil (ou sans réponse) ;
//   { id, type, texte, globale, facultative, n, parts: [{ cle, libelle, nombre }], accord } au-dessus. `parts` suit l'échelle
//   (de « Pas du tout » à « Sans avis ») ou les options d'un choix ; `accord` (échelle seulement) vient de tauxSatisfaction.
export function lignesResultats(cle, resultats) {
  const questionnaire = QUESTIONNAIRES[cle];
  if (!questionnaire) return [];
  const publicCible = questionnaire.public;
  const assez = resumeReponses(cle, resultats).assez;
  return questionnaire.questions.filter((q) => q.type !== "commentaire").map((q) => {
    const base = { id: q.id, type: q.type, texte: q.texte, globale: q.globale === true, facultative: q.facultative === true };
    const comptes = assez ? resultats?.questions?.[q.id] : null;
    const [affichable] = resultatsAffichables({ [q.id]: comptes ?? {} }, publicCible);
    if (!affichable || affichable.sousSeuil) return { ...base, sousSeuil: true, texteSousSeuil: texteSousSeuil(publicCible) };
    const { n, repartition } = affichable;
    if (q.type === "choix") {
      const parts = q.options.map((option) => ({ cle: option, libelle: option, nombre: repartition[option] ?? 0 }));
      return { ...base, n, parts, accord: null };
    }
    const parts = ECHELLE.map((e) => {
      const k = e.valeur === null ? "sans_avis" : String(e.valeur);
      return { cle: k, libelle: e.libelle, nombre: repartition[k] ?? 0 };
    });
    const accord = tauxSatisfaction(comptes, 0, publicCible);
    return { ...base, n, parts, accord: accord ? { taux: accord.taux, repondants: accord.repondants, texte: texteAccord(accord) } : null };
  });
}

// Les commentaires montrables : jamais avec « Sans aucun nom », jamais sous le seuil ; textes non vides, dans l'ordre rendu par
// la base (tiré au hasard par elle).
export function commentairesMontrables(commentaires, { sansNoms, assez }) {
  if (sansNoms || !assez || !Array.isArray(commentaires)) return [];
  return commentaires.filter((t) => typeof t === "string" && t.trim() !== "").map((t) => t.trim());
}

// Message d'une action de gestion qui échoue. Les fonctions de js/db.js lèvent déjà une Error au message lisible (la phrase de
// la base, sans son préfixe) ; une erreur brute de la base est lue par phraseDeLaBase. Trois cas sont réécrits, et eux seuls :
// un refus de droit (42501, ou une phrase « Réservé à... » qui reste telle quelle), la phrase de panne de js/db.js (elle parle d'un
// envoi) et une panne brute du réseau (« Failed to fetch » et ses équivalents, seuls dans le message). Toute autre phrase de la
// base passe telle quelle, même si elle contient « réseau » ou « délai ».
const PHRASE_DROIT = "Réservé à la gestion de la qualité : ce compte n'a pas ce droit.";
const PANNE_BRUTE = /^(TypeError:\s*)?(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|The network connection was lost\.?|Network request failed)$/i;
function messageGestion(erreur, defaut) {
  if (String(erreur?.code ?? "") === "42501") return PHRASE_DROIT;
  const brute = phraseDeLaBase(erreur);
  if (brute) return brute;
  const texte = String(erreur?.message ?? "").trim();
  if (!texte || texte === PHRASE_RESEAU || PANNE_BRUTE.test(texte)) return defaut;
  if (/permission denied/i.test(texte)) return PHRASE_DROIT;
  return texte;
}

// Une lecture de gestion (résultats, commentaires, ouvertures) qui échoue.
export function messageLectureGestion(erreur) {
  return messageGestion(erreur, "Les questionnaires n'ont pas pu être lus : vérifiez votre connexion, puis réessayez.");
}

// Une ouverture, une fermeture ou un retour aux dates qui échoue.
export function messageEchecOuverture(erreur) {
  return messageGestion(erreur, "Le changement n'a pas abouti : vérifiez votre connexion, puis réessayez.");
}
