// Échelle continue des notes de la matrice : une teinte par dixième de point, calculée à l'affichage (interpolation
// entre neuf repères). Elle dit une note, jamais un habillage : les deux habillages la gardent, et comme la couleur
// est calculée elle n'a pas de jeton (elle figure donc dans EXEMPTS_JS de tests/habillage-jetons.test.mjs).

// === Dégradé continu pour les cellules de la matrice ===
// Interpolation linéaire RGB entre 9 stops sur l'échelle 0..20.
// Chaque dixième de point a une teinte unique (~1 couleur / 0.1).
// Pêche/terracotta pour les notes basses, vert mint pour le haut. Pas de rouge vif.
// Chaque texte tient 4,6:1 au moins sur son fond, à chaque dixième de point (lot 3, tâche 10) : les repères de 8 à 16 ont
// été assombris (même teinte), le milieu de l'échelle n'en tenait que 4,0 à 4,4.
const NOTE_STOPS = [
  { n: 0,  bg: [232, 195, 168], fg: [105, 60, 30] },
  { n: 5,  bg: [241, 219, 200], fg: [122, 79, 48] },
  { n: 8,  bg: [246, 232, 200], fg: [128, 96, 35] },
  { n: 10, bg: [248, 240, 205], fg: [128, 105, 35] },
  { n: 12, bg: [234, 234, 200], fg: [110, 100, 45] },
  { n: 14, bg: [221, 235, 198], fg: [91, 107, 51] },
  { n: 16, bg: [206, 230, 184], fg: [72, 104, 37] },
  { n: 18, bg: [188, 224, 168], fg: [55, 95, 25] },
  { n: 20, bg: [165, 215, 142], fg: [40, 80, 18] },
];
export function noteGradient(noteSur20) {
  const v = Math.max(0, Math.min(20, Number(noteSur20) || 0));
  let i = 0;
  while (i < NOTE_STOPS.length - 1 && NOTE_STOPS[i + 1].n < v) i++;
  if (i >= NOTE_STOPS.length - 1) {
    const s = NOTE_STOPS[NOTE_STOPS.length - 1];
    return { bg: `rgb(${s.bg.join(",")})`, fg: `rgb(${s.fg.join(",")})` };
  }
  const a = NOTE_STOPS[i], b = NOTE_STOPS[i + 1];
  const t = (v - a.n) / (b.n - a.n);
  const lerp = (x, y) => Math.round(x + (y - x) * t);
  return {
    bg: `rgb(${lerp(a.bg[0], b.bg[0])},${lerp(a.bg[1], b.bg[1])},${lerp(a.bg[2], b.bg[2])})`,
    fg: `rgb(${lerp(a.fg[0], b.fg[0])},${lerp(a.fg[1], b.fg[1])},${lerp(a.fg[2], b.fg[2])})`,
  };
}
