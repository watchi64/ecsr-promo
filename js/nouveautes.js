// Règles de la rubrique Nouveautés : tri, audience, non-lu.
//
// Aucune dépendance, aucun accès au DOM. Les fonctions de décision reçoivent
// leurs entrées en argument : elles sont donc testables par node, et le test
// ne dépend pas du contenu réel (qui bouge à chaque nouveauté).
//
// Seules les deux dernières fonctions touchent localStorage. Elles sont
// enveloppées dans des try/catch (navigation privée, quota) sur le modèle de
// subtabs.js : en cas d'échec tout paraît neuf à chaque visite, ce qui est une
// dégradation acceptable, mais rien n'explose.

export const CLE_VUES = "ecsr_nouveautes_vues";

// Date de mise en ligne de la rubrique. Les entrées qui lui sont antérieures ou
// égales sont des REPRISES : la promo utilise ces fonctionnalités depuis des
// semaines. Les afficher comme neuves au premier chargement serait faux, et la
// pastille annoncerait huit nouveautés le jour du lancement.
export const MISE_EN_LIGNE = "2026-08-01";

// Correspondance route -> clé localStorage du sous-onglet, telle que
// renderSubTabs la mémorise. Permet à un lien « Où le trouver » d'ouvrir la vue
// directement sur le bon sous-onglet. Une route absente d'ici ignore simplement
// le champ sousOnglet : le lien navigue, sans atterrissage précis.
export const STORAGE_SOUS_ONGLET = {
  "mon-suivi": "ecsr_monsuivi_subtab",
  notes: "ecsr_notes_subtab",
};

// Antéchronologique, de la plus récente à la plus ancienne.
export function triees(entrees) {
  return [...entrees].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// Une entrée « formateurs » n'est visible que d'un formateur ou d'un admin.
export function visibles(entrees, formateur) {
  return entrees.filter((e) => e.pour !== "formateurs" || !!formateur);
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
// mémorisée ne gonfle pas indéfiniment.
export function purger(vues, entrees) {
  const connus = new Set(entrees.map((e) => e.id));
  return (vues || []).filter((id) => connus.has(id));
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

// État de lecture effectif. Au tout premier accès, amorce la mémoire avec les
// entrées de reprise : elles ne doivent pas s'afficher comme neuves.
export function vuesEffectives(entrees) {
  const stockees = lireVues();
  if (stockees) return stockees;
  const amorce = idsDeReprise(entrees, MISE_EN_LIGNE);
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
