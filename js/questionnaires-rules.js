// Règles pures des questionnaires Qualiopi (indicateur 30) : fenêtres d'ouverture, ouverture manuelle, portée des
// questionnaires formateurs, seuils d'affichage et taux de satisfaction. PUR : ni DOM, ni réseau, ni horloge
// (`aujourdhui` est passé en « AAAA-MM-JJ »). Testé en node (tests/questionnaires-rules.test.mjs).
//
// Les dates sont des chaînes « AAAA-MM-JJ » calculées en UTC : pas de décalage d'heure d'été.

import { QUESTIONNAIRES, seuilDe } from "./questionnaires-data.js?v=20261113a";

const FORMAT_JOUR = /^(\d{4})-(\d{2})-(\d{2})/;

// Les trois champs d'une date « AAAA-MM-JJ » (ou d'un horodatage ISO qui commence ainsi), nul si illisible.
function lire(valeur) {
  const m = typeof valeur === "string" ? FORMAT_JOUR.exec(valeur) : null;
  if (!m) return null;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(0);
  date.setUTCFullYear(annee, mois - 1, jour);
  // Refuse un 31 février ou un mois 13 : la date reportée ne retombe pas sur les mêmes champs.
  if (date.getUTCFullYear() !== annee || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return null;
  return { annee, mois, jour };
}

function ecrire(date) {
  return date.toISOString().slice(0, 10);
}

// Décale de `jours` jours (UTC).
function plusJours(champs, jours) {
  const date = new Date(0);
  date.setUTCFullYear(champs.annee, champs.mois - 1, champs.jour + jours);
  return ecrire(date);
}

// Décale de `mois` mois ; si le jour n'existe pas dans le mois d'arrivée (31 août + 6 mois), on prend son dernier jour.
function plusMois(champs, mois) {
  const date = new Date(0);
  date.setUTCFullYear(champs.annee, champs.mois - 1 + mois, 1);
  const dernier = new Date(0);
  dernier.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(champs.jour, dernier.getUTCDate()));
  return ecrire(date);
}

// Fenêtre d'ouverture d'un questionnaire pour une promo : { du, au } (bornes comprises), ou nul si la promo n'a pas de
// date de fin lisible ou si la clé est inconnue.
//   fin_stagiaire, fin_formateur : de date_fin moins 7 jours à date_fin plus 30 jours ;
//   six_mois_stagiaire : de date_fin plus 6 mois à date_fin plus 7 mois.
export function fenetreQuestionnaire(cle, promo) {
  if (!Object.prototype.hasOwnProperty.call(QUESTIONNAIRES, cle)) return null;
  const fin = lire(promo?.date_fin);
  if (fin === null) return null;
  if (cle === "six_mois_stagiaire") return { du: plusMois(fin, 6), au: plusMois(fin, 7) };
  return { du: plusJours(fin, -7), au: plusJours(fin, 30) };
}

// Le questionnaire est-il ouvert aujourd'hui ? `ouverture` = { ouvert: boolean } posée à la main par la gestion, ou nulle :
// elle prime dans les deux sens (ouvrir avant la fenêtre, fermer dans la fenêtre). Sans elle, c'est la fenêtre qui décide.
export function estOuvert({ cle, promo, ouverture, aujourdhui }) {
  if (ouverture && typeof ouverture.ouvert === "boolean") return ouverture.ouvert;
  const jour = lire(aujourdhui);
  const fenetre = fenetreQuestionnaire(cle, promo);
  if (jour === null || fenetre === null) return false;
  const aujourd = plusJours(jour, 0);
  return aujourd >= fenetre.du && aujourd <= fenetre.au;
}

// Portée des réponses des formateurs : le lieu (centre) et l'année civile du jour.
export function porteeFormateur(lieuId, aujourdhui) {
  const jour = lire(aujourdhui);
  return { lieu_id: lieuId, annee: jour === null ? null : jour.annee };
}

// « moins de 5 réponses » / « moins de 3 réponses » : ce qui remplace un résultat masqué.
export function texteSousSeuil(publicCible) {
  return `moins de ${seuilDe(publicCible)} réponses`;
}

// « moins de 5 avis notés » : ce qui remplace un taux de satisfaction masqué. Le taux se calcule sur les avis notés
// (« sans avis » exclu) : cinq réponses dont une « sans avis » restent sous le seuil du taux.
export function texteSousSeuilAvis(publicCible) {
  return `moins de ${seuilDe(publicCible)} avis notés`;
}

// Un compte lisible : entier positif ou nul, sinon 0 (jamais de NaN).
function compte(valeur) {
  const v = Number(valeur);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

// La clé d'une réponse « sans avis » (null en base) devient « sans_avis » ; les autres clés (1 à 4, options d'un choix) restent.
function cleReponse(cle) {
  return cle === "null" || cle === "" || cle === "sans_avis" ? "sans_avis" : cle;
}

// Répartition normalisée d'une question : { clé: nombre }, « sans avis » regroupé sous « sans_avis ».
function normaliser(comptesQuestion) {
  const repartition = {};
  for (const [cle, valeur] of Object.entries(comptesQuestion ?? {})) {
    const k = cleReponse(cle);
    repartition[k] = (repartition[k] ?? 0) + compte(valeur);
  }
  return repartition;
}

// Résultats affichables d'un questionnaire. `comptes` = { idQuestion: { réponse: nombre } } (réponse = 1 à 4, « sans_avis » ou
// null, ou une option d'un choix). Par question : { id, n, repartition } (n = toutes les réponses, « sans avis » compris), ou
// { id, sousSeuil: true } quand n est sous le seuil du public (5 stagiaires, 3 formateurs) : aucune répartition n'est alors rendue.
export function resultatsAffichables(comptes, publicCible) {
  const seuil = seuilDe(publicCible);
  return Object.entries(comptes ?? {}).map(([id, comptesQuestion]) => {
    const repartition = normaliser(comptesQuestion);
    const total = Object.values(repartition).reduce((somme, v) => somme + v, 0);
    return total >= seuil ? { id, n: total, repartition } : { id, sousSeuil: true };
  });
}

// Taux de satisfaction de la question globale : part des réponses 3 et 4 sur les répondants qui ont donné une note
// (« sans avis » exclu). Nul sous le seuil du public (`publicCible`, stagiaire par défaut), en nombre de répondants notés.
// `taux` est un pourcentage entier arrondi ; `inscrits` est repris tel quel (0 s'il est illisible).
export function tauxSatisfaction(comptesQuestionGlobale, inscrits, publicCible = "stagiaire") {
  const repartition = normaliser(comptesQuestionGlobale);
  const notes = [1, 2, 3, 4].map((v) => repartition[v] ?? 0);
  const repondants = notes.reduce((somme, v) => somme + v, 0);
  if (repondants < seuilDe(publicCible)) return null;
  return {
    taux: Math.round(((notes[2] + notes[3]) / repondants) * 100),
    repondants,
    inscrits: compte(inscrits),
  };
}
