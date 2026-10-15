import { test } from "node:test";
import assert from "node:assert/strict";
import * as kit from "../js/dessins-kit.js";
import * as svg from "../js/dessin-svg.js";
import { PIECES_KIT } from "../outils/planche-kit.js";
import { verifierDessin } from "./aides-dessins.mjs";

// La section « Kit » de la planche de revue (outils/planche-dessins.html) est le premier dessin que voit un relecteur : elle
// obéit aux mêmes contrôles qu'un dessin du catalogue, sans quoi la planche montrerait un défaut qu'elle devrait aider à voir.
const TIRET_CADRATIN = String.fromCharCode(0x2014);

test("pièces du kit de la planche : codes uniques, titres, cadre de 320 unités, contrôles communs sans problème", () => {
  assert.ok(PIECES_KIT.length >= 2, "au moins la paire juste et faux et les étiquettes");
  const vus = new Set();
  for (const p of PIECES_KIT) {
    assert.match(p.code, /^kit-[a-z0-9]+(-[a-z0-9]+)*$/, p.code);
    assert.ok(!vus.has(p.code), `${p.code} en double`);
    vus.add(p.code);
    assert.ok(p.titre && !p.titre.includes(TIRET_CADRATIN), p.code);
    assert.equal(p.cadre[0], 320, `${p.code} : 320 unités de large, comme tout dessin`);
    const dessin = p.construire({ kit, svg });
    assert.deepEqual(verifierDessin(dessin, p.cadre), [], p.code);
  }
});

test("la paire du kit montre une vignette juste, une vignette faux, leurs pastilles écrites, une étiquette et une flèche", () => {
  const paire = PIECES_KIT.find((p) => p.code === "kit-paire");
  assert.ok(paire, "kit-paire");
  const dessin = paire.construire({ kit, svg });
  for (const etat of ["juste", "faux"]) {
    assert.ok(svg.trouverRole(dessin, `vignette-${etat}`), `vignette ${etat}`);
    assert.equal(svg.texteDe(svg.trouverRole(dessin, `pastille-${etat}`)), etat === "juste" ? "Juste" : "Faux");
  }
  assert.ok(svg.trouverRole(dessin, "etiquette"), "étiquette");
  assert.ok(svg.trouverRole(dessin, "fleche"), "flèche");
});

test("les étiquettes du kit montrent les trois ancrages et une étiquette sur deux lignes", () => {
  const piece = PIECES_KIT.find((p) => p.code === "kit-etiquettes");
  assert.ok(piece, "kit-etiquettes");
  const dessin = piece.construire({ kit, svg });
  const ancrages = new Set(svg.trouverTous(dessin, (x) => x.balise === "text").map((x) => x.attributs["text-anchor"]));
  assert.deepEqual([...ancrages].sort(), ["end", "middle", "start"]);
  assert.ok(svg.trouverTous(dessin, (x) => x.attributs["data-r"] === "etiquette").some((g) => svg.trouverTous(g, (x) => x.balise === "text").length === 2));
  assert.ok(svg.trouverTous(dessin, (x) => x.attributs["data-r"] === "fleche").length >= 2, "une flèche droite et une flèche courbe");
});

test("la section Kit montre les voitures du kit : vue du dessus et profil, dans leur état sobre et avec toutes leurs pièces", () => {
  const piece = (code) => { const p = PIECES_KIT.find((x) => x.code === code); assert.ok(p, code); return p.construire({ kit, svg }); };
  const montre = (noeud) => noeud && noeud.attributs.display !== "none";
  const dessus = svg.trouverTous(piece("kit-voiture-dessus"), (x) => x.attributs["data-r"] === "voiture");
  assert.equal(dessus.length, 2, "deux voitures vues du dessus");
  for (const v of dessus) assert.ok(svg.trouverRole(v, "retroviseur-gauche") && svg.trouverRole(v, "retroviseur-interieur"), "rétroviseurs");
  assert.equal(svg.trouverRole(dessus[0], "roue-avant-gauche"), null, "la première, sans roues");
  assert.equal(svg.trouverRole(dessus[1], "roue-avant-gauche").attributs["data-angle"], 25, "la seconde, roues braquées");
  assert.ok(!montre(svg.trouverRole(dessus[0], "portiere")) && montre(svg.trouverRole(dessus[1], "portiere")), "portière fermée, puis ouverte");
  const profils = svg.trouverTous(piece("kit-voiture-profil"), (x) => x.attributs["data-r"] === "voiture-profil");
  assert.equal(profils.length, 2, "deux voitures de profil");
  assert.ok(!montre(svg.trouverRole(profils[0], "portiere-ouverte")) && montre(svg.trouverRole(profils[1], "portiere-ouverte")), "portière ouverte sur la seconde");
  assert.ok(montre(svg.trouverRole(profils[1], "trappe-ouverte")), "trappe ouverte sur la seconde");
});
