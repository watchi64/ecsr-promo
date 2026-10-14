import { test } from "node:test";
import assert from "node:assert/strict";
import { adoucir, sortieDouce, entreeDouce, avancement, interpoler, cles } from "../js/animation-courbes.js";

test("courbes : bornes exactes, croissance, symétrie de adoucir", () => {
  for (const c of [adoucir, sortieDouce, entreeDouce]) {
    assert.equal(c(0), 0); assert.equal(c(1), 1);
    for (let u = 0; u < 1; u += 0.05) assert.ok(c(u + 0.05) >= c(u) - 1e-12);
  }
  for (let u = 0; u <= 1; u += 0.1) assert.ok(Math.abs(adoucir(u) + adoucir(1 - u) - 1) < 1e-12);
  assert.ok(adoucir(0.05) < 0.05);   // départ amorti
});

test("avancement, interpoler et cles", () => {
  assert.equal(avancement(5, 4, 6), 0.5);
  assert.equal(avancement(3, 4, 6), 0);
  assert.equal(avancement(7, 4, 6), 1);
  assert.equal(interpoler(10, 20, 0.25), 12.5);
  const l = [{ t: 0, v: 0 }, { t: 2, v: 90 }, { t: 4, v: 90 }];
  assert.equal(cles(l, -1), 0);
  assert.equal(cles(l, 1), 45);
  assert.equal(cles(l, 3), 90);
  assert.equal(cles(l, 9), 90);
});

test("formes : chaque courbe amortit ce qu'elle dit amortir, et cles applique la courbe donnée", () => {
  // Départ amorti : la courbe est sous la droite au début ; arrivée amortie : elle est tout près de 1 avant la fin.
  assert.ok(adoucir(0.05) < 0.05 && 1 - adoucir(0.95) < 0.05, "adoucir amortit le départ et l'arrivée");
  assert.ok(entreeDouce(0.05) < 0.05 && entreeDouce(0.95) < 0.95, "entreeDouce amortit le départ seulement");
  assert.ok(sortieDouce(0.05) > 0.05 && 1 - sortieDouce(0.95) < 0.05, "sortieDouce amortit l'arrivée seulement");
  // Pente nulle aux deux bouts de adoucir : à un centième des bornes, l'écart à la borne est négligeable.
  assert.ok(adoucir(0.01) < 1e-4 && 1 - adoucir(0.99) < 1e-4);
  // Intervalle réduit à un point : un échelon, jamais une division par zéro.
  assert.equal(avancement(5, 6, 6), 0);
  assert.equal(avancement(6, 6, 6), 1);
  assert.equal(avancement(7, 6, 6), 1);
  assert.equal(avancement(5, 6, 4), 1);
  // La courbe de cles est celle qu'on lui donne (adoucir par défaut), appliquée à chaque tronçon.
  const l = [{ t: 0, v: 0 }, { t: 2, v: 90 }];
  assert.equal(cles(l, 0.5), 90 * adoucir(0.25));
  assert.equal(cles(l, 0.5, sortieDouce), 90 * sortieDouce(0.25));
  assert.equal(cles(l, 0.5, (u) => u), 22.5);
  // Une seule clé : la valeur partout.
  assert.equal(cles([{ t: 1, v: 7 }], 0), 7);
  assert.equal(cles([{ t: 1, v: 7 }], 5), 7);
});
