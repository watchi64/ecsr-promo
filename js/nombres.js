// Les nombres de l'app écrits en français, en un seul endroit (ménage des doubles du 11/11/2026 : le pluriel existait en
// douze copies). Module pur, testé en node par tests/nombres.test.mjs.

// 1234 donne « 1 234 » (espace insécable fine, comme le reste de l'app).
export const entier = (x) => Number(x).toLocaleString("fr-FR");

// 0,734 donne « 73 % » (espace insécable avant le signe).
export const pct = (x) => Math.round(x * 100) + " %";

// 11,84 donne « 11,8 » : une décimale, virgule française.
export const fr1 = (x) => x.toFixed(1).replace(".", ",");

// « 1 stagiaire », « 3 stagiaires », « 2 travaux » (pluriel irrégulier en troisième argument). Zéro reste au singulier.
export const pluriel = (n, mot, motPluriel = mot + "s") => `${entier(n)} ${n > 1 ? motPluriel : mot}`;
