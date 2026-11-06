// Règles de la rubrique Nouveautés : tri, audience, navigation, non-lu.
//
// Aucune dépendance autre que nav-rules.js (module pur, source de la clé du
// sous-onglet de Cours), aucun accès au DOM. Les fonctions de décision reçoivent
// leurs entrées en argument : elles sont donc testables par node, et le test
// ne dépend pas du contenu réel (qui bouge à chaque nouveauté).
//
// Seules les deux dernières fonctions touchent localStorage. Elles sont
// enveloppées dans des try/catch (navigation privée, quota) sur le modèle de
// subtabs.js : en cas d'échec tout paraît neuf à chaque visite, ce qui est une
// dégradation acceptable, mais rien n'explose.

import { CLES_SOUS_ONGLETS } from "./nav-rules.js?v=20261029b";

export const CLE_VUES = "ecsr_nouveautes_vues";

// Date de mise en ligne de la rubrique. Les entrées qui lui sont antérieures ou
// égales sont des REPRISES : la promo utilise ces fonctionnalités depuis des
// semaines. Les afficher comme neuves au premier chargement serait faux, et la
// pastille annoncerait huit nouveautés le jour du lancement.
export const MISE_EN_LIGNE = "2026-08-01";

// Correspondance route -> clé localStorage du sous-onglet, telle que
// renderSubTabs la mémorise. Permet à un lien « Où le trouver » d'ouvrir la vue
// directement sur le bon sous-onglet. Une route absente d'ici ignore simplement
// le champ sousOnglet : le lien navigue, sans atterrissage précis. Les clés de
// Cours et de Stagiaires (Élèves bénévoles) viennent de nav-rules.js
// (CLES_SOUS_ONGLETS), pour qu'elles n'aient qu'une source.
export const STORAGE_SOUS_ONGLET = {
  "mon-suivi": "ecsr_monsuivi_subtab",
  notes: "ecsr_notes_subtab",
  themes: CLES_SOUS_ONGLETS.themes,
  stagiaires: CLES_SOUS_ONGLETS.stagiaires,
};

// Antéchronologique, de la plus récente à la plus ancienne.
export function triees(entrees) {
  return [...entrees].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// Une entrée « formateurs » n'est visible que d'un formateur ou d'un admin. Une entrée qui porte
// `navigation: "nouvelle"` n'est visible que nouvelle navigation allumée (`navigationV2`, js/nav-etat.js), une entrée
// `navigation: "ancienne"` que si elle est éteinte (elle ne décrit que l'ancienne barre) ; sans ce champ, l'entrée se lit
// dans les deux. Le défaut est l'ancienne navigation : un appelant d'avant la refonte ne voit rien changer.
export function visibles(entrees, formateur, navigationV2 = false) {
  return entrees.filter((e) => (e.pour !== "formateurs" || !!formateur)
    && (e.navigation !== "nouvelle" || !!navigationV2)
    && (e.navigation !== "ancienne" || !navigationV2));
}

// Étapes « Comment faire » d'une entrée selon la navigation : `guideNouvelle` (facultatif) remplace `guide` quand la nouvelle
// navigation est allumée, jamais autrement. Une liste vide ou illisible vaut son absence : le guide d'avant se lit.
export function guideSelonNavigation(entree, navigationV2 = false) {
  const nouvelle = entree.guideNouvelle;
  return navigationV2 && Array.isArray(nouvelle) && nouvelle.length > 0 ? nouvelle : entree.guide;
}

// Entrées dont l'id n'a pas encore été vu.
export function nonLues(entrees, vues) {
  const dejaVues = new Set(vues || []);
  return entrees.filter((e) => !dejaVues.has(e.id));
}

// Texte de la pastille. Vide à zéro : l'appelant retire alors l'élément.
export function libellePastille(n) {
  if (!n || n <= 0) return "";
  return n > 9 ? "9+" : String(n);
}

// Retire les ids qui ne correspondent plus à aucune entrée, pour que la liste
// mémorisée ne gonfle pas indéfiniment. Les annonces d'ouverture de module (ids
// « module-… », voir PREFIXE_ANNONCE dans js/modules.js) sont épargnées : un
// démarrage où l'état des modules n'a pas pu être lu les ferait disparaître, et
// une annonce déjà lue reviendrait comme neuve au chargement suivant.
export function purger(vues, entrees) {
  const connus = new Set(entrees.map((e) => e.id));
  return (vues || []).filter((id) => connus.has(id) || String(id).startsWith("module-"));
}

// Fusionne des ids dans la liste des vues, purgée. Renvoie la nouvelle liste.
export function ajouterVues(vues, ids, entrees) {
  return purger([...new Set([...(vues || []), ...ids])], entrees);
}

// Ids des entrées de reprise, à considérer comme déjà lues au tout premier accès.
export function idsDeReprise(entrees, dateMiseEnLigne) {
  return entrees.filter((e) => e.date <= dateMiseEnLigne).map((e) => e.id);
}

// === localStorage ===

// Renvoie null si RIEN n'a jamais été mémorisé. À distinguer d'une liste vide,
// qui signifie « tout a été remis à neuf volontairement » : seul le premier cas
// déclenche l'amorce ci-dessous.
export function lireVues() {
  try {
    const brut = localStorage.getItem(CLE_VUES);
    if (brut === null) return null;
    const liste = JSON.parse(brut);
    return Array.isArray(liste) ? liste : [];
  } catch (e) {
    return [];
  }
}

// Date d'amorce : la mise en ligne de la rubrique, ou le début de la promo s'il est plus
// tardif. Quelqu'un qui arrive avec une promo récente ne doit pas trouver des dizaines
// d'anciennes entrées « neuves » au premier passage (spec multi-promo C.6).
export function amorcePour(dateDebutPromo) {
  return dateDebutPromo && dateDebutPromo > MISE_EN_LIGNE ? dateDebutPromo : MISE_EN_LIGNE;
}

// État de lecture effectif. Au tout premier accès, amorce la mémoire avec les
// entrées de reprise : elles ne doivent pas s'afficher comme neuves.
export function vuesEffectives(entrees, dateAmorce = MISE_EN_LIGNE) {
  const stockees = lireVues();
  if (stockees) return stockees;
  const amorce = idsDeReprise(entrees, dateAmorce);
  marquerVues(amorce, entrees);
  return amorce;
}

export function marquerVues(ids, entrees) {
  try {
    localStorage.setItem(CLE_VUES, JSON.stringify(ajouterVues(lireVues(), ids, entrees)));
  } catch (e) {
    /* ignore : tout paraîtra neuf à la prochaine visite */
  }
}
