// Les nombres de l'app écrits en français, en un seul endroit (ménage des doubles du 11/11/2026 : le pluriel existait en
// douze copies). Module pur, testé en node par tests/nombres.test.mjs.

// 1234 donne « 1 234 » (espace insécable fine, comme le reste de l'app).
export const entier = (x) => Number(x).toLocaleString("fr-FR");

// 0,734 donne « 73 % » (espace insécable avant le signe).
export const pct = (x) => Math.round(x * 100) + " %";

// 11,84 donne « 11,8 » : une décimale, virgule française.
export const fr1 = (x) => x.toFixed(1).replace(".", ",");

// Une note ou une moyenne arrondie au dixième : 13,46 donne « 13,5 », 14 donne « 14 » (pas de « ,0 »). La virgule partout,
// côté stagiaire comme côté formateur (chasse aux défauts du film, 11/11 : le point restait sur la matrice de la classe).
export const dixieme = (x) => String(Math.round(Number(x) * 10) / 10).replace(".", ",");

// 1,256 donne « 1,26 » : deux décimales, virgule française (scores des grilles EPCF).
export const fr2 = (x) => Number(x).toFixed(2).replace(".", ",");

// « 1 stagiaire », « 3 stagiaires », « 2 travaux » (pluriel irrégulier en troisième argument). Zéro reste au singulier.
export const pluriel = (n, mot, motPluriel = mot + "s") => `${entier(n)} ${n > 1 ? motPluriel : mot}`;
