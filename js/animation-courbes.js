/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Courbes d'accélération des gestes animés : un mouvement part et arrive en douceur, jamais à vitesse constante
 * d'un bout à l'autre ni par saut. Fonctions pures, testées sous Node.
 */
/** Départ et arrivée amortis (cubique). */
export const adoucir = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
/** Arrivée amortie seulement (un geste lancé qui se pose). */
export const sortieDouce = (u) => 1 - Math.pow(1 - u, 3);
/** Départ amorti seulement. */
export const entreeDouce = (u) => u * u * u;
/** Avancement de 0 à 1 de `t` entre `debut` et `fin`, borné. */
export function avancement(t, debut, fin) {
  if (fin <= debut) return t >= fin ? 1 : 0;
  return Math.min(1, Math.max(0, (t - debut) / (fin - debut)));
}
export const interpoler = (a, b, u) => a + (b - a) * u;
/** Valeur d'une suite de clés { t, v } aux instants croissants, courbe appliquée entre deux clés, constante hors plage. */
export function cles(liste, t, courbe = adoucir) {
  if (t <= liste[0].t) return liste[0].v;
  for (let i = 1; i < liste.length; i++) {
    if (t <= liste[i].t) return interpoler(liste[i - 1].v, liste[i].v, courbe(avancement(t, liste[i - 1].t, liste[i].t)));
  }
  return liste[liste.length - 1].v;
}
