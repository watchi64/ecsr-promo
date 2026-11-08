// Fiche « résultats » à publier (spec docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md, § 6.6 et 6.8, indicateurs
// 2 et 3) : pour une promo, l'effectif, le taux d'abandon, le taux de présence, l'obtention du titre et la satisfaction, chaque
// chiffre avec sa période, son effectif et sa méthode en une phrase pour le public. PUR : ni DOM ni réseau, testé en node
// (tests/qualiopi-resultats.test.mjs).
//
// Promo par promo, jamais en total : la fiche d'un centre est la suite des fiches de ses promos (fichesResultatsTexte). Une
// promo est terminée quand sa date de fin est passée (promoTerminee, écrite une seule fois dans js/qualiopi-documents.js) ;
// sinon ses résultats sont provisoires : la fiche porte l'avertissement « Ne pas publier » et n'est jamais publiable.
//
// Les chiffres viennent du tableau de bord du centre (indicateursPromo, js/centre-stats.js) et les méthodes de METHODES_PUBLIQUES
// (même fichier), écrites pour le public. Trois mesures ne sont pas encore produites par l'application : la présence
// (l'émargement n'est pas branché), l'obtention du titre (les résultats de jury ne sont pas saisis) et la satisfaction
// (questionnaires du lot Q3). Elles se disent en toutes lettres (« non mesuré », « non saisi », « non mesurée ») ; le jour où
// l'une arrive, l'appelant la passe sous la forme { taux, effectif } (taux de 0 à 1, effectif : le nombre de stagiaires sur
// lequel il porte) et la fiche l'écrit. Une mesure inutilisable vaut une mesure absente.
// La satisfaction arrive depuis le lot Q3 sous la forme du questionnaire de fin de formation : { taux, repondants, inscrits }
// (taux entier de 0 à 100, « sans avis » exclu, comme le rend tauxSatisfaction), avec ou sans `etat: "mesuree"`, ou
// { etat: "sous_seuil" } (moins de 5 réponses : la valeur est la phrase fixe, aucun chiffre) ; { etat: "absente" } ou rien : « non mesurée ».
//
// Jamais de valeur « null », « undefined » ou « NaN » dans la fiche ni dans ses textes : ce qui manque devient un mot. Sans
// indicateurs exploitables, la fiche est celle d'une promo sans inscrit.

import { METHODES_PUBLIQUES, pct } from "./centre-stats.js?v=20261108a";
import { promoTerminee, periodeEnMots, edition } from "./qualiopi-documents.js?v=20261108a";
import { rempli, tableau, nb } from "./qualiopi-preuves.js?v=20261108a";
import { texteSousSeuil } from "./questionnaires-rules.js?v=20261108a";

// L'interface du plan : la règle « terminée » est celle des dossiers et les méthodes publiques celles du tableau de bord
// (js/centre-stats.js, à côté de METHODES) ; ni l'une ni les autres ne sont réécrites ici, seulement réexportées.
export { promoTerminee, METHODES_PUBLIQUES };

export const AVERTISSEMENT_PROVISOIRE = "Résultats provisoires : la formation n'est pas terminée. Ne pas publier.";
export const AUCUNE_FORMATION = "Aucune formation de ce centre dans la période.";

// Ce que dit la fiche d'une mesure que l'application ne produit pas encore.
const VALEURS_ABSENTES = { presence: "non mesuré", titre: "non saisi", satisfaction: "non mesurée" };
const SANS_OBJET = "sans objet";
export const MESURE_NON_DISPONIBLE = "Mesure non disponible pour cette formation.";
const TITRE = "Résultats de la formation";
const LIBELLES = {
  effectif: "Effectif",
  abandon: "Taux d'abandon",
  presence: "Taux de présence",
  titre: "Taux d'obtention du titre",
  satisfaction: "Satisfaction des stagiaires",
};
const ENTETES_TABLEAU = ["Indicateur", "Résultat", "Effectif", "Période", "Méthode de calcul"];

// --- Petits outils ---

const entier = (x) => (Number.isInteger(x) && x >= 0 ? x : null);
const taux = (x) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1 ? x : null);
const stagiaires = (n) => (n === SANS_OBJET ? SANS_OBJET : !Number.isInteger(n) || n < 0 ? "non renseigné" : n === 0 ? "aucun stagiaire" : nb(n, "stagiaire"));

// =====================================================================================================
// La fiche d'une promo
// =====================================================================================================

// promo : une ligne de mes_promos ({ nom, lieu_nom, date_debut, date_fin }) ; ind : indicateursPromo de cette promo ;
// aujourdhui : « AAAA-MM-JJ ». presence, obtention, satisfaction : { taux, effectif } ou rien.
// Rend { titre, entete: string[], terminee, publiable, avertissement, lignes: [{ cle, libelle, valeur, effectif, periode, methode }] }.
// `valeur` est le texte de la case (« 10 % », « non mesuré ») ; `effectif`, un nombre ; `avertissement`, vide quand il n'y en a pas.
export function ficheResultats({ promo, ind, aujourdhui, presence = null, obtention = null, satisfaction = null } = {}) {
  const terminee = promoTerminee(promo, aujourdhui);
  const periode = periodeEnMots(promo?.date_debut, promo?.date_fin);
  // Les inscrits : l'effectif du tableau de bord, ou à défaut ce que l'abandon en dit ; sans rien d'exploitable, personne.
  const inscrits = [ind?.effectif?.valeur, ind?.effectif?.detail?.inscrits, ind?.abandon?.n, ind?.abandon?.detail?.inscrits]
    .map(entier).find((x) => x !== null) ?? 0;
  const ligne = (cle, valeur, effectif, methode = METHODES_PUBLIQUES[cle]) => ({ cle, libelle: LIBELLES[cle], valeur, effectif, periode, methode });
  // Une mesure fournie par l'appelant, ou le mot qui dit qu'elle manque. Un effectif illisible est celui des inscrits. Une mesure
  // absente n'a ni effectif ni méthode de calcul : elle ne décrit pas un calcul qui n'a pas eu lieu.
  const mesure = (cle, donnee) => {
    const t = taux(donnee?.taux);
    return t === null ? ligne(cle, VALEURS_ABSENTES[cle], SANS_OBJET, MESURE_NON_DISPONIBLE) : ligne(cle, pct(t), entier(donnee.effectif) ?? inscrits);
  };
  // La satisfaction du questionnaire de fin de formation : le taux est un entier de 0 à 100, l'effectif est celui des répondants,
  // dit avec celui des inscrits (`effectifTexte`). Sous le seuil, la phrase fixe et aucun chiffre ; sinon l'ancienne forme.
  const satisfactionMesure = () => {
    if (satisfaction?.etat === "sous_seuil") return ligne("satisfaction", texteSousSeuil("stagiaire"), SANS_OBJET, MESURE_NON_DISPONIBLE);
    const t = Number.isInteger(satisfaction?.repondants) && Number.isInteger(satisfaction?.taux) && satisfaction.taux >= 0 && satisfaction.taux <= 100
      ? satisfaction.taux / 100 : null;
    if (t === null) return mesure("satisfaction", satisfaction?.repondants === undefined ? satisfaction : null);
    const l = ligne("satisfaction", pct(t), satisfaction.repondants);
    const sur = entier(satisfaction.inscrits) > 0 ? ` sur ${nb(satisfaction.inscrits, "inscrit")}` : "";
    return { ...l, effectifTexte: `${nb(satisfaction.repondants, "répondant")}${sur}` };
  };
  const abandon = taux(ind?.abandon?.valeur);
  return {
    titre: TITRE,
    entete: [
      `Centre : ${rempli(promo?.lieu_nom) ? promo.lieu_nom.trim() : "non renseigné"}`,
      `Promotion : ${rempli(promo?.nom) ? promo.nom.trim() : "nom non renseigné"}`,
      `Période : ${periode}`,
      edition(aujourdhui),
    ],
    terminee,
    publiable: terminee,
    avertissement: terminee ? "" : AVERTISSEMENT_PROVISOIRE,
    lignes: [
      ligne("effectif", inscrits === 0 ? "aucun inscrit" : nb(inscrits, "inscrit"), inscrits),
      ligne("abandon", abandon === null ? "non calculable" : pct(abandon), inscrits),
      mesure("presence", presence),
      mesure("titre", obtention),
      satisfactionMesure(),
    ],
  };
}

// =====================================================================================================
// Sorties : texte à coller sur le site du centre, tableau de l'impression
// =====================================================================================================

// Un chiffre : sa valeur, puis son effectif et sa période, puis sa méthode. La ligne de l'effectif ne répète pas l'effectif ; une
// mesure absente n'en a pas (« sans objet ») et n'écrit aucune phrase d'effectif.
const effectifEnMots = (l) => l.effectifTexte ?? stagiaires(l.effectif);
const bloc = (l) => [
  `${l.libelle} : ${l.valeur}`,
  l.cle === "effectif" || l.effectif === SANS_OBJET ? `Période : ${l.periode}.` : `Effectif : ${effectifEnMots(l)}. Période : ${l.periode}.`,
  `Méthode : ${l.methode}`,
].join("\n");

// Texte brut d'une fiche, à coller sur le site du centre : l'avertissement d'abord quand la promo est en cours, puis l'en-tête,
// puis chaque chiffre. Vide si ce n'est pas une fiche.
export function ficheResultatsTexte(fiche) {
  const lignes = tableau(fiche?.lignes);
  if (!lignes.length) return "";
  return [fiche.avertissement, [fiche.titre, ...tableau(fiche.entete)].join("\n"), ...lignes.map(bloc)].filter(Boolean).join("\n\n");
}

// Le texte d'un centre : les fiches de ses promos, l'une après l'autre dans l'ordre reçu, séparées de deux lignes vides. Jamais
// de total, de moyenne ni de cumul : chaque promo garde ses propres chiffres.
export function fichesResultatsTexte(fiches) {
  const textes = tableau(fiches).map(ficheResultatsTexte).filter(Boolean);
  return textes.length ? textes.join("\n\n\n") : AUCUNE_FORMATION;
}

// Le tableau de l'impression : les mêmes mots que le texte, une ligne par chiffre.
export function tableauFiche(fiche) {
  return {
    entetes: [...ENTETES_TABLEAU],
    lignes: tableau(fiche?.lignes).map((l) => [l.libelle, l.valeur, effectifEnMots(l), l.periode, l.methode]),
  };
}

// Ce que la page dit après une sortie quand des promos sont en cours : vide si toutes sont terminées.
export function noteProvisoire(fiches) {
  const enCours = tableau(fiches).filter((f) => f && !f.publiable).length;
  return enCours ? `${nb(enCours, "formation")} en cours : résultats provisoires, à ne pas publier.` : "";
}

// =====================================================================================================
// Copier le texte
// =====================================================================================================

const MESSAGE_COPIE_FAITE = "Texte copié.";
const MESSAGE_COPIE_ABSENTE = "La copie n'est pas disponible dans ce navigateur. Imprime la fiche en PDF, ou ouvre la page dans un autre navigateur.";
const MESSAGE_COPIE_REFUSEE = "Le navigateur a refusé la copie. Clique à nouveau sur « Copier le texte », ou imprime la fiche en PDF.";

// Un texte vide, ou qui n'en est pas un, n'est jamais copié : il viderait le presse-papiers.
const enBlob = (texte) => {
  if (typeof texte !== "string" || texte === "") throw new Error("aucun texte à copier");
  return new Blob([texte], { type: "text/plain" });
};

// Copie le texte dans le presse-papiers et rend { copie, message } : le message est celui que la page affiche (réussite brève, ou ce
// qui s'est passé et quoi faire). `texte` est le texte ou la promesse du texte : celui d'un centre n'existe qu'après la lecture de ses
// promos, et la copie doit être demandée dans le geste du clic, avant toute attente (Safari, iOS compris, n'accepte rien après ;
// Firefox exige une activation de moins de 5 secondes). Trois temps :
//   1. tout de suite, avant le moindre `await` : navigator.clipboard.write avec un ClipboardItem « text/plain » qui reçoit la promesse
//      du texte, sous forme de Blob ; c'est le presse-papiers qui attend que le texte arrive ;
//   2. si ClipboardItem ou write manque, ou si write échoue : writeText, une fois le texte arrivé (hors du geste : Chrome l'accepte,
//      d'autres peuvent le refuser) ; un texte déjà là part dans la pile du clic, sans attente ;
//   3. si tout échoue : le message de refus ; si le navigateur n'offre ni l'un ni l'autre : le message d'absence.
// `navigator` et `ClipboardItem` sont ceux du navigateur, remplaçables dans un test. Rien ne lève : un refus, une absence ou un texte
// qui ne vient pas (promesse rejetée, texte vide) sont des réponses, et rien n'est copié ; dans ce dernier cas, la page, qui sait
// pourquoi son texte manque, n'affiche pas le message de refus.
export async function copierTexte(texte, navigator = globalThis.navigator, ClipboardItem = globalThis.ClipboardItem) {
  const promesse = Promise.resolve(texte);
  promesse.catch(() => {});   // un texte qui ne vient pas se dit par le résultat : son rejet ne doit pas rester sans gestionnaire
  const direct = typeof ClipboardItem === "function" && typeof navigator?.clipboard?.write === "function";
  const repli = typeof navigator?.clipboard?.writeText === "function";
  if (!direct && !repli) return { copie: false, message: MESSAGE_COPIE_ABSENTE };
  let ecriture = null;
  if (direct) {
    try {
      const blob = promesse.then(enBlob);
      blob.catch(() => {});
      ecriture = navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
    } catch {
      ecriture = null;
    }
  }
  try {
    if (ecriture !== null) {
      try {
        await ecriture;
        return { copie: true, message: MESSAGE_COPIE_FAITE };
      } catch {
        // l'écriture avec la promesse a échoué : repli ci-dessous
      }
    }
    if (repli) {
      const aCopier = typeof texte === "string" ? texte : await promesse;
      if (typeof aCopier === "string" && aCopier !== "") {
        await navigator.clipboard.writeText(aCopier);
        return { copie: true, message: MESSAGE_COPIE_FAITE };
      }
    }
  } catch {
    // le repli a échoué lui aussi, ou le texte ne vient pas
  }
  return { copie: false, message: MESSAGE_COPIE_REFUSEE };
}
