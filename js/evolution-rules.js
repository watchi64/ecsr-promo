// Libellés de mois et cibles de tap du graphe de Mon évolution (js/views/mon-suivi.js, buildChart). Module pur : testé en node.
//
// Le graphe se dessine à la largeur de son conteneur (viewBox) : à 375 px, sept mois de notes y ont des bandes de 30 à
// 38 unités, et un libellé de 10 px (« Sept. 26 ») en mesure jusqu'à 37. Un libellé par bande ne tient plus : on n'écrit
// que ceux qui ne se touchent pas.

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
