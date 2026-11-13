// Règles de l'écran des questionnaires anonymes (Qualiopi, indicateur 30) : quel questionnaire le bandeau montre,
// « Plus tard » remis au lendemain (mémoire de l'appareil, propre au compte, comme js/avis-rules.js), lequel ouvre
// le lien direct #/questionnaire/<clé>, et la forme des réponses envoyées. PUR : ni DOM, ni réseau, ni horloge
// (`aujourdhui` est passé en « AAAA-MM-JJ »). Testé en node (tests/questionnaire-ecran-rules.test.mjs).
//
// La base a le dernier mot sur l'ouverture : la liste vient de lireQuestionnairesARemplir() (js/db.js), qui ne
// rend que les questionnaires ouverts, auxquels la personne a droit et qu'elle n'a pas encore remplis. Liste vide
// (rien d'ouvert, ou migration pas encore appliquée) : aucun bandeau, aucune erreur.

import { QUESTIONNAIRES } from "./questionnaires-data.js?v=20261113a";
import { lendemain } from "./avis-rules.js?v=20261113a";

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Clé de la mémoire « Plus tard » sur l'appareil, propre au compte ; null sans compte (rien n'est retenu).
export function cleMemoire(compte) {
  return compte ? `ecsr_questionnaire_plus_tard:${compte}` : null;
}

// Identifiant d'un questionnaire à remplir : sa clé et sa portée (une promo, ou un lieu et une année pour les
// formateurs). Un formateur de deux lieux a deux questionnaires « fin_formateur », remis à plus tard séparément.
export function idQuestionnaire(item) {
  const p = item?.portee || {};
  return [item?.cle ?? "", p.promo_id ?? "", p.lieu_id ?? "", p.annee ?? ""].join("|");
}

// Mémoire « Plus tard » relue depuis le stockage : { id: "AAAA-MM-JJ" (jour où le bandeau revient) }. Toute valeur
// illisible vaut « rien de remis ».
export function lireMemoire(brut) {
  if (!brut) return {};
  let m;
  try { m = JSON.parse(brut); } catch (e) { return {}; }
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const propre = {};
  for (const [id, jour] of Object.entries(m)) {
    if (typeof jour === "string" && FORMAT_JOUR.test(jour)) propre[id] = jour;
  }
  return propre;
}

// « Plus tard » : ce questionnaire revient le lendemain. Les remises déjà échues sont oubliées au passage.
export function memoirePlusTard(memoire, item, aujourdhui) {
  const suite = {};
  for (const [id, jour] of Object.entries(memoire || {})) {
    if (jour > aujourdhui) suite[id] = jour;
  }
  suite[idQuestionnaire(item)] = lendemain(aujourdhui);
  return suite;
}

// Questionnaires de la liste que l'app sait afficher : clé connue, même version que le texte de l'app (sinon la
// base refuserait l'envoi : « Le questionnaire a changé »), portée lisible. Ordre du catalogue.
export function questionnairesAffichables(liste, catalogue = QUESTIONNAIRES) {
  if (!Array.isArray(liste)) return [];
  const ordre = Object.keys(catalogue);
  return liste
    .filter((item) => item && Object.prototype.hasOwnProperty.call(catalogue, item.cle)
      && item.version === catalogue[item.cle].version
      && item.portee && typeof item.portee === "object" && !Array.isArray(item.portee))
    .sort((a, b) => ordre.indexOf(a.cle) - ordre.indexOf(b.cle));
}

// Le questionnaire que montre le bandeau, ou null : le premier affichable qui n'est pas remis à plus tard.
export function questionnaireDuBandeau({ liste, memoire, aujourdhui, catalogue = QUESTIONNAIRES }) {
  const m = memoire || {};
  return questionnairesAffichables(liste, catalogue)
    .find((item) => { const jour = m[idQuestionnaire(item)]; return !jour || aujourdhui >= jour; }) || null;
}

// Le questionnaire qu'ouvre le lien #/questionnaire/<clé>, ou null (rien à remplir pour cette personne : pas
// concernée, déjà répondu, période fermée, migration absente). « Plus tard » ne compte pas : le lien est un choix.
export function questionnaireDuLien({ liste, cle, catalogue = QUESTIONNAIRES }) {
  if (!cle) return null;
  return questionnairesAffichables(liste, catalogue).find((item) => item.cle === cle) || null;
}

// Le ton d'un texte propre à un questionnaire : celui de son public (règle du 10/11). Les questionnaires des stagiaires
// tutoient, celui des formateurs vouvoie ; un questionnaire sans public connu tutoie (les stagiaires sont les plus nombreux).
export function selonQuestionnaire(questionnaire, tu, vous) {
  return questionnaire?.public === "formateur" ? vous : tu;
}

// Phrase sous le titre du bandeau.
export function sousTitreBandeau(questionnaire) {
  const n = (questionnaire?.questions || []).length;
  return `${n} questions courtes. ${selonQuestionnaire(questionnaire,
    "Ta réponse est enregistrée sans ton nom.", "Votre réponse est enregistrée sans votre nom.")}`;
}

// Merci affiché après l'envoi (écran de fin, ou message si la fenêtre a été fermée entre-temps).
export function merciQuestionnaire(questionnaire) {
  return selonQuestionnaire(questionnaire,
    "Merci, ta réponse est enregistrée sans ton nom.", "Merci, votre réponse est enregistrée sans votre nom.");
}

// Barre de progression : « Question 3 sur 10 » et la part faite, en pour cent (0 sur l'écran d'accueil).
export function progression(index, total) {
  const pourcent = total > 0 ? Math.round((Math.min(Math.max(index, 0), total) / total) * 100) : 0;
  return { texte: `Question ${index} sur ${total}`, pourcent };
}

// La question a-t-elle une réponse ? Dans le brouillon, une clé absente = pas encore répondu ; null = « Sans avis »
// (échelle seulement) ; un nombre de 1 à 4 ; un texte pour un choix ou le commentaire.
export function aUneReponse(question, brouillon) {
  if (!brouillon || !Object.prototype.hasOwnProperty.call(brouillon, question.id)) return false;
  const v = brouillon[question.id];
  if (question.type === "echelle") return v === null || [1, 2, 3, 4].includes(v);
  if (question.type === "choix") return typeof v === "string" && (question.options || []).includes(v);
  return typeof v === "string" && v.trim() !== "";
}

// Peut-on passer à la question suivante ? Une question facultative se passe sans réponse.
export function peutAvancer(question, brouillon) {
  return question.facultative === true || aUneReponse(question, brouillon);
}

// Rang (0 = première) de la première question obligatoire sans réponse, ou -1.
export function premiereManquante(questionnaire, brouillon) {
  return questionnaire.questions.findIndex((q) => !q.facultative && !aUneReponse(q, brouillon));
}

// Ce qui part à la base (repondre_questionnaire) : { reponses: { id: valeur }, commentaire }. Les questions
// facultatives sans réponse sont omises ; « Sans avis » part en null ; le commentaire, nettoyé, ou null.
export function reponsesAEnvoyer(questionnaire, brouillon) {
  const reponses = {};
  let commentaire = null;
  for (const q of questionnaire.questions) {
    if (!aUneReponse(q, brouillon)) continue;
    if (q.type === "commentaire") commentaire = brouillon[q.id].trim();
    else reponses[q.id] = brouillon[q.id];
  }
  return { reponses, commentaire };
}

// Ce que la zone annoncée aux lecteurs d'écran (aria-live) dit à chaque changement d'écran de la fenêtre : la
// progression sur un écran de question, rien sur l'écran d'accueil (son titre suffit) ni hors des bornes.
export function annonceEcran(etape, total) {
  if (!Number.isInteger(etape) || !Number.isInteger(total) || etape < 1 || etape > total) return "";
  return progression(etape, total).texte;
}

// Lien direct : la liste des questionnaires arrive après le rendu de l'Accueil. La fenêtre ne s'ouvre que si la
// personne est restée sur la même adresse et qu'aucune autre fenêtre ne s'est ouverte entre-temps ; sinon le lien
// est abandonné sans un mot (le bandeau de l'Accueil reste là pour y revenir).
export function ouvrirApresLecture({ adresseAvant, adresseMaintenant, fenetre }) {
  return typeof adresseAvant === "string" && adresseAvant === adresseMaintenant && !fenetre;
}

// Mémoire de la session (relecture finale, M5) : les brouillons ({ reponses, etape } par idQuestionnaire) et les
// questionnaires envoyés pendant la session, propres au compte connecté. `suivreCompte(adresse)` est appelé avant chaque
// usage et à chaque changement d'authentification : une autre adresse (ou plus d'adresse) vide les deux, pour qu'une
// session expirée suivie d'une autre connexion dans le même onglet (appareil partagé) ne montre ni les réponses non
// envoyées du compte précédent ni son bandeau éteint. Rend true quand la mémoire vient d'être vidée.
export function memoireDeSession() {
  const brouillons = new Map();
  const envoyes = new Set();
  let compte;
  return {
    brouillons,
    envoyes,
    suivreCompte(adresse) {
      const c = typeof adresse === "string" && adresse ? adresse : null;
      if (c === compte) return false;
      compte = c;
      const avait = brouillons.size > 0 || envoyes.size > 0;
      brouillons.clear();
      envoyes.clear();
      return avait;
    },
  };
}
