import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { largeurDeGraphe } from "../js/utils.js";

// Lot 2A, tâche 5 : rien ne défile de côté (règle de Timy du 27/10) et jamais une note en rouge. Le banc d'essai
// (outils/verifier_navigation.py) mesure l'affichage ; ici, ce qui se joue sous Node : la largeur d'un graphe et les
// couleurs écrites en dur dans le code des graphes.

function avecFenetre(largeur, f) {
  const avant = globalThis.document;
  globalThis.document = { documentElement: { clientWidth: largeur } };
  try { return f(); } finally { globalThis.document = avant; }
}

test("largeurDeGraphe : la largeur de la fenêtre moins 80 px de marges, entre 260 et 720", () => {
  assert.equal(avecFenetre(375, () => largeurDeGraphe()), 295);     // un iPhone
  assert.equal(avecFenetre(768, () => largeurDeGraphe()), 688);     // une tablette
  assert.equal(avecFenetre(320, () => largeurDeGraphe()), 260);     // plancher : le plus petit téléphone
  assert.equal(avecFenetre(1280, () => largeurDeGraphe()), 720);    // plafond : un ordinateur
});

test("largeurDeGraphe : le plafond se choisit, une fenêtre sans largeur mesurable prend le plafond", () => {
  assert.equal(avecFenetre(1280, () => largeurDeGraphe(760)), 760);
  assert.equal(avecFenetre(500, () => largeurDeGraphe(760)), 420);
  assert.equal(avecFenetre(0, () => largeurDeGraphe()), 720);
});

// Teinte (0 à 360°) et saturation (HSL) d'une couleur #RRGGBB ou #RGB.
function teinteEtSaturation(couleur) {
  let h = couleur.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const haut = Math.max(r, g, b), bas = Math.min(r, g, b), ecart = haut - bas, clair = (haut + bas) / 2;
  if (ecart === 0) return { teinte: 0, saturation: 0 };
  const saturation = ecart / (1 - Math.abs(2 * clair - 1));
  const sixieme = haut === r ? ((g - b) / ecart + 6) % 6 : haut === g ? (b - r) / ecart + 2 : (r - g) / ecart + 4;
  return { teinte: sixieme * 60, saturation };
}
const estRouge = (couleur) => { const { teinte, saturation } = teinteEtSaturation(couleur); return saturation > 0.5 && (teinte >= 345 || teinte <= 15); };

test("teinte rouge : les rouges d'avant (#DC2626, #991B1B) en sont, la terre cuite de l'échelle douce et ses voisines n'en sont pas", () => {
  for (const rouge of ["#DC2626", "#991B1B", "#EF4444", "#B91C1C", "#F00"]) assert.ok(estRouge(rouge), rouge);
  // --c-stop (#964F33), pêche et abricot de la matrice, verts de l'échelle, vert et gris du texte : aucun n'est rouge.
  for (const doux of ["#964F33", "#F1DBC8", "#FBE5C1", "#C98A2B", "#7BA23C", "#47730E", "#7A4F30", "#92400E", "#1F2924", "#8A7458"]) {
    assert.ok(!estRouge(doux), doux);
  }
});

test("le code des graphes de notes n'écrit aucun rouge en dur : l'échelle douce vient des classes de la feuille de style", () => {
  for (const fichier of ["js/views/notes.js", "js/views/mon-suivi.js"]) {
    const texte = readFileSync(new URL("../" + fichier, import.meta.url), "utf8");
    const rouges = [...new Set(texte.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g) || [])].filter(estRouge);
    assert.deepEqual(rouges, [], `${fichier} écrit des rouges en dur`);
  }
});
