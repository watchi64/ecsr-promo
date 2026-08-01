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

// === localStorage ===

export function lireVues() {
  try {
    const brut = localStorage.getItem(CLE_VUES);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) {
    return [];
  }
}

export function marquerVues(ids, entrees) {
  try {
    localStorage.setItem(CLE_VUES, JSON.stringify(ajouterVues(lireVues(), ids, entrees)));
  } catch (e) {
    /* ignore : tout paraîtra neuf à la prochaine visite */
  }
}
