import { test } from "node:test";
import assert from "node:assert/strict";
import { libellesDeMois, rayonDeCible, UNITES_PAR_CARACTERE, ECART_ENTRE_LIBELLES } from "../js/evolution-rules.js";

// Lot 2A, tâche 5, tour de correction 1 : le graphe de Mon évolution se dessine à la largeur de son conteneur ; à 375 px,
// sept mois de notes ont des bandes de 30 à 38 unités et un libellé de 10 px (« Sept. 26 ») en mesure jusqu'à 37.

const PAD_G = 40, PAD_D = 16;   // les marges du graphe (buildChart)

// Les bandes de mois d'un graphe de largeur W dont les mois ont ces nombres de notes, comme buildChart les calcule
// (les points sont répartis à égale distance, la première bande commence au premier point, la dernière finit au dernier).
function bandes(largeur, effectifs, libelles) {
  const n = effectifs.reduce((a, b) => a + b, 0), interieur = largeur - PAD_G - PAD_D;
  const x = (i) => PAD_G + (n <= 1 ? interieur / 2 : (interieur * i) / (n - 1));
  let debut = 0;
  return effectifs.map((effectif, k) => {
    const fin = debut + effectif - 1;
    const b = { gauche: debut === 0 ? PAD_G : (x(debut) + x(debut - 1)) / 2, droite: fin === n - 1 ? largeur - PAD_D : (x(fin) + x(fin + 1)) / 2, libelle: libelles[k] };
    debut = fin + 1;
    return b;
  });
}
const MOIS = ["Avr. 26", "Mai 26", "Juin 26", "Juil. 26", "Août 26", "Sept. 26", "Oct. 26", "Nov. 26", "Déc. 26", "Janv. 27", "Févr. 27", "Mars 27"];

// Deux libellés écrits ne se touchent pas : de centre à centre, la somme des demi-largeurs et l'écart voulu.
function sansContact(ecrits, liste) {
  for (let i = 1; i < ecrits.length; i++) {
    const a = ecrits[i - 1], b = ecrits[i];
    const demiA = (liste[a.indice].libelle.length * UNITES_PAR_CARACTERE) / 2, demiB = (liste[b.indice].libelle.length * UNITES_PAR_CARACTERE) / 2;
    if (b.x - demiB - (a.x + demiA) < ECART_ENTRE_LIBELLES - 1e-9) return false;
  }
  return true;
}

test("libellesDeMois : sur un graphe large, chaque mois écrit son libellé au centre de sa bande", () => {
  const liste = bandes(760, [3, 3, 3], MOIS);
  const ecrits = libellesDeMois(liste, 760);
  assert.deepEqual(ecrits.map((e) => e.indice), [0, 1, 2]);
  ecrits.forEach((e) => assert.equal(e.x, (liste[e.indice].gauche + liste[e.indice].droite) / 2));
});

test("libellesDeMois : à 375 px, vingt notes sur sept mois n'écrivent que des libellés qui ne se touchent pas (le premier et le dernier compris)", () => {
  const liste = bandes(295, [3, 3, 3, 3, 3, 3, 2], MOIS);
  // Le seuil d'avant (une bande d'au moins 30 unités) aurait écrit les sept libellés : « Sept. 26 » et « Oct. 26 » se touchaient.
  assert.ok(liste.slice(1, -1).every((b) => b.droite - b.gauche >= 30));
  const ecrits = libellesDeMois(liste, 295);
  assert.ok(ecrits.length >= 3 && ecrits.length < 7, `${ecrits.length} libellés`);
  assert.equal(ecrits[0].indice, 0);
  assert.equal(ecrits[ecrits.length - 1].indice, 6);
  assert.ok(sansContact(ecrits, liste));
});

test("libellesDeMois : le dernier mois s'écrit toujours, il prend la place du libellé qui le gênerait", () => {
  const liste = bandes(295, [3, 3, 3, 3, 3, 3, 3, 2], MOIS);   // huit mois : l'avant-dernier gênerait le dernier
  const ecrits = libellesDeMois(liste, 295);
  assert.equal(ecrits[ecrits.length - 1].indice, 7);
  assert.equal(ecrits[0].indice, 0);
  assert.ok(sansContact(ecrits, liste));
});

test("libellesDeMois : un seul mois, ou aucun", () => {
  assert.deepEqual(libellesDeMois(bandes(295, [4], ["Oct. 26"]), 295).map((e) => e.indice), [0]);
  assert.deepEqual(libellesDeMois([], 295), []);
});

test("libellesDeMois : un libellé reste dans le graphe, même quand sa bande est tout au bord", () => {
  const liste = bandes(260, [1, 17, 1], ["Avr. 26", "Mai 26", "Sept. 26"]);   // un seul point dans le dernier mois : sa bande ne fait que 6 unités
  const ecrits = libellesDeMois(liste, 260);
  ecrits.forEach((e) => {
    const demi = (liste[e.indice].libelle.length * UNITES_PAR_CARACTERE) / 2;
    assert.ok(e.x - demi >= 0 && e.x + demi <= 260, `libellé ${e.indice} à ${e.x}`);
  });
  assert.ok(sansContact(ecrits, liste));
});

test("libellesDeMois : jamais deux libellés qui se touchent, ni un premier ou un dernier mois oublié, sur des centaines de graphes tirés au hasard", () => {
  let graine = 12345;
  const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  for (let essai = 0; essai < 400; essai++) {
    const largeur = 260 + Math.floor(alea() * 500);
    const mois = 1 + Math.floor(alea() * 12);
    const effectifs = Array.from({ length: mois }, () => 1 + Math.floor(alea() * 5));
    const liste = bandes(largeur, effectifs, MOIS.slice(0, mois));
    const ecrits = libellesDeMois(liste, largeur);
    assert.ok(sansContact(ecrits, liste), `essai ${essai}, largeur ${largeur}, effectifs ${effectifs}`);
    assert.equal(ecrits[0].indice, 0, `essai ${essai} : le premier mois`);
    assert.equal(ecrits[ecrits.length - 1].indice, mois - 1, `essai ${essai} : le dernier mois`);
    assert.deepEqual(ecrits.map((e) => e.indice), [...ecrits.map((e) => e.indice)].sort((a, b) => a - b));
  }
});

test("rayonDeCible : 12 au plus, et jamais plus que la moitié de l'écart entre deux points", () => {
  assert.equal(rayonDeCible(60), 12);
  assert.equal(rayonDeCible(24), 12);
  assert.equal(rayonDeCible(12.58), 6.29);   // vingt notes à 375 px
  assert.equal(rayonDeCible(0), 0);
  // Deux cibles voisines ne se chevauchent pas : la somme de leurs rayons ne dépasse pas l'écart.
  for (const pas of [2, 5, 10, 11, 12.58, 24, 25, 40]) assert.ok(2 * rayonDeCible(pas) <= pas + 1e-9, `pas ${pas}`);
});
