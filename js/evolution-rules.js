// Largeur du dessin, libellés de mois et cibles de tap du graphe de Mon évolution (js/views/mon-suivi.js, buildChart). Module
// pur : testé en node.
//
// Le graphe se dessine à la largeur mesurée de son conteneur (viewBox) : ses textes gardent leur taille, une unité du dessin
// vaut un pixel à l'écran. À 375 px, sept mois de notes y ont des bandes de 30 à 38 unités, et un libellé de 10 px
// (« Sept. 26 ») en mesure jusqu'à 37. Un libellé par bande ne tient plus : on n'écrit que ceux qui ne se touchent pas.

// Bornes du dessin, en unités du viewBox : 760, la largeur au-delà de laquelle le graphe ne s'étire plus (max-width de
// .ms-chart), et 260, celle du plus petit téléphone, en deçà de laquelle un dessin plus étroit n'aurait plus la place de ses
// marges et de ses libellés (le graphe est alors réduit, de peu : un conteneur de 208 px garde ses 10 unités à 8 px).
export const LARGEUR_MIN_DU_GRAPHE = 260;
export const LARGEUR_MAX_DU_GRAPHE = 760;

/** Largeur, en unités du viewBox, à laquelle dessiner le graphe quand son conteneur mesure `mesuree` pixels : la partie entière
 *  de cette mesure (le dessin n'est jamais plus large que son conteneur, donc jamais réduit), bornée. null tant que le conteneur n'a
 *  pas de largeur (caché, pas encore posé, mesure illisible) : il n'y a alors rien à dessiner.
 *  Dans la fiche d'un stagiaire, le conteneur est bien plus étroit que la fenêtre (liste de 270 px, barre latérale) : mesurer la
 *  fenêtre dessinait un graphe réduit de moitié, au texte de 5 px. */
export function largeurDuDessin(mesuree, { min = LARGEUR_MIN_DU_GRAPHE, max = LARGEUR_MAX_DU_GRAPHE } = {}) {
  if (typeof mesuree !== "number" || !Number.isFinite(mesuree) || mesuree <= 0) return null;
  return Math.max(min, Math.min(max, Math.floor(mesuree)));
}

// Un libellé de 10 px mesure au plus 5 unités du viewBox par caractère (« Janv. 26 » : 36,9 dans la police de l'app, un peu
// plus avec une police de secours), et deux libellés gardent 4 unités libres entre eux.
export const UNITES_PAR_CARACTERE = 5;
export const ECART_ENTRE_LIBELLES = 4;

/** bandes : [{ gauche, droite, libelle }], une par mois, dans l'ordre ; largeur : celle du viewBox.
 *  Renvoie [{ indice, x }] : les libellés à écrire, chacun au centre de sa bande (ramené dans le graphe). Le premier mois
 *  s'écrit, puis chaque mois dont le libellé laisse ECART_ENTRE_LIBELLES unités libres avec le dernier écrit ; le dernier
 *  mois s'écrit toujours et prend la place de ceux qui le gêneraient. Jamais deux libellés qui se touchent. */
export function libellesDeMois(bandes, largeur) {
  const demi = bandes.map((b) => (String(b.libelle).length * UNITES_PAR_CARACTERE) / 2);
  const centre = bandes.map((b, i) => Math.max(demi[i] + 2, Math.min(largeur - demi[i] - 2, (b.gauche + b.droite) / 2)));
  const libres = (a, b) => centre[b] - demi[b] - (centre[a] + demi[a]) >= ECART_ENTRE_LIBELLES;
  const ecrits = [];
  bandes.forEach((_, i) => { if (!ecrits.length || libres(ecrits[ecrits.length - 1], i)) ecrits.push(i); });
  const dernier = bandes.length - 1;
  if (dernier >= 0 && ecrits[ecrits.length - 1] !== dernier) {
    while (ecrits.length && !libres(ecrits[ecrits.length - 1], dernier)) ecrits.pop();
    ecrits.push(dernier);
  }
  return ecrits.map((indice) => ({ indice, x: centre[indice] }));
}

/** Rayon de la cible de survol ou de tap d'un point : 12 au plus, et jamais plus que la moitié de l'écart entre deux points
 *  (sur téléphone, le graphe est serré : deux cibles voisines ne se chevauchent pas). */
export function rayonDeCible(pas) {
  return Math.min(12, pas / 2);
}
