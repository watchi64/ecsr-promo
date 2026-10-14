import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-poste.js";
import { SOURCES } from "../sources/dessins-poste.js";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { verifierDessin, formeArbre } from "./aides-dessins.mjs";

// Ruling R2 (tâche 6) : les deux contrôles communs ne portent que sur les dessins fixes de la famille. Les trois gestes du
// volant que le catalogue range aussi dans « poste » (tirer-glisser, chevauchement, retour-volant) arrivent avec la tâche 7,
// qui retire ce filtre, importe verifierGeste et contrôle chaque geste par verifierGeste(famille.GESTES[code].construire(), e).
const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "poste" && CATALOGUE[c].bloc === "dessin");

test("poste : chaque code du catalogue est dessiné et passe les contrôles communs", () => {
  for (const code of codes) {
    const e = CATALOGUE[code];
    assert.deepEqual(verifierDessin(famille.DESSINS[code](), e.cadre), [], code);
  }
  const fournis = [...Object.keys(famille.DESSINS), ...Object.keys(famille.GESTES || {})].sort();
  assert.deepEqual(fournis, [...codes].sort());
});

test("poste : chaque dessin a ses sources, dont ses choix de dessin", () => {
  for (const code of codes) {
    assert.ok(Array.isArray(SOURCES[code]) && SOURCES[code].length >= 2, code);
    assert.ok(SOURCES[code].some((s) => s.startsWith("Choix de dessin")), code);
  }
});

// ===== Exactitude : un dessin dit ce que dit le cours =====

test("mains-volant : 9 h et 3 h, pouces sur la jante (juste), pouce dans la jante (faux)", () => {
  const d = famille.DESSINS["mains-volant"]();
  const juste = trouverRole(d, "vignette-juste"), faux = trouverRole(d, "vignette-faux");
  for (const [vignette, attendu] of [[juste, "jante"], [faux, "interieur"]]) {
    const v = trouverRole(vignette, "volant");
    const [cx, cy, r] = ["data-x", "data-y", "data-rayon"].map((k) => v.attributs[k]);
    const e = r * famille.EPAISSEUR_JANTE;
    const distance = (role) => { const p = trouverRole(vignette, role); return Math.hypot(p.attributs["data-x"] - cx, p.attributs["data-y"] - cy); };
    const angle = (role) => { const p = trouverRole(vignette, role); return Math.atan2(cy - p.attributs["data-y"], p.attributs["data-x"] - cx) * 180 / Math.PI; };
    assert.ok(Math.abs(Math.abs(angle("main-gauche")) - 180) < 0.5 && Math.abs(angle("main-droite")) < 0.5);
    assert.ok(Math.abs(distance("pouce-droite") - r) <= e / 2);
    if (attendu === "jante") assert.ok(Math.abs(distance("pouce-gauche") - r) <= e / 2);
    else assert.ok(distance("pouce-gauche") < r - e / 2);
  }
});

const textesDe = (noeud) => trouverTous(noeud, (x) => x.balise === "text").map(texteDe).join(" ").toLocaleLowerCase("fr");

test("mains-volant : « ou 10 h 10 » écrit sous la vignette juste, l'erreur nommée sous la vignette faux", () => {
  const d = famille.DESSINS["mains-volant"]();
  const carte = (etat) => trouverRole(d, `vignette-${etat}`).enfants[0].attributs;
  for (const [etat, mot] of [["juste", "ou 10 h 10"], ["faux", "pouce engagé dans la jante"]]) {
    const legende = trouverRole(d, `legende-${etat}`);
    assert.ok(legende && texteDe(legende).toLocaleLowerCase("fr").includes(mot), `${etat} : « ${mot} »`);
    const c = carte(etat);
    const x = Number(legende.attributs.x), y = Number(legende.attributs.y);
    assert.ok(x > c.x && x < c.x + c.width, `${etat} : légende sous sa vignette, pas sous l'autre`);
    assert.ok(y > c.y + c.height, `${etat} : légende sous la vignette`);
  }
});

test("poste-commandes : chaque commande du cours est dessinée et désignée par une étiquette aux mots du cours", () => {
  const d = famille.DESSINS["poste-commandes"]();
  const mots = {
    "commodo-gauche": ["feux", "clignotants"],
    "commodo-droit": ["essuie-glaces", "lave-glace"],
    avertisseur: ["avertisseur"],
    "feux-detresse": ["détresse"],
    contacteur: ["contacteur"],
    "frein-stationnement": ["frein de stationnement"],
    ventilation: ["ventilation"],
    desembuage: ["désembuage"],
    climatisation: ["climatisation"],
  };
  // Les boîtes d'un élément : la sienne, et celles de ses parties qui en portent une (les deux boutons du désembuage).
  const boites = (noeud) => trouverTous(noeud, (x) => "data-largeur" in x.attributs).map((x) => {
    const [cx, cy, l, h] = ["data-x", "data-y", "data-largeur", "data-hauteur"].map((k) => Number(x.attributs[k]));
    return [cx - l / 2, cy - h / 2, cx + l / 2, cy + h / 2];
  });
  const dans = ([x, y], [x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2;
  for (const [role, attendus] of Object.entries(mots)) {
    const element = trouverRole(d, role);
    assert.ok(element, `${role} : dessiné`);
    const etiquette = trouverRole(d, `etiquette-${role}`);
    assert.ok(etiquette, `${role} : étiquette`);
    for (const mot of attendus) assert.ok(textesDe(etiquette).includes(mot), `${role} : « ${mot} » dans « ${textesDe(etiquette)} »`);
    // L'étiquette désigne l'élément : le bout de chacun de ses filets est posé sur l'élément, et chaque partie de l'élément
    // qui a sa boîte (un bouton) reçoit un filet.
    const cibles = trouverTous(etiquette, (x) => x.attributs["data-r"] === "filet").map((f) => [Number(f.attributs.x1), Number(f.attributs.y1)]);
    const parties = boites(element);
    assert.ok(cibles.length >= 1 && parties.length >= 1, role);
    for (const c of cibles) assert.ok(parties.some((b) => dans(c, b)), `${role} : filet posé hors de l'élément (${c})`);
    for (const b of parties) assert.ok(cibles.some((c) => dans(c, b)), `${role} : une partie sans filet`);
  }
  const x = (role) => Number(trouverRole(d, role).attributs["data-x"]), y = (role) => Number(trouverRole(d, role).attributs["data-y"]);
  assert.ok(x("commodo-gauche") < x("volant") && x("commodo-droit") > x("volant"), "un commodo de chaque côté du volant");
  assert.ok(Math.hypot(x("avertisseur") - x("volant"), y("avertisseur") - y("volant")) < 1e-6, "avertisseur au centre du volant");
  assert.ok(textesDe(d).includes("disposition la plus courante"));
});

test("pedales : embrayage, frein, accélérateur de gauche à droite ; pied gauche sur l'embrayage, pied droit sur le frein", () => {
  const d = famille.DESSINS.pedales();
  const pedales = Object.fromEntries(["embrayage", "frein", "accelerateur"].map((r) => [r, trouverRole(d, r)]));
  const x = (n) => Number(n.attributs["data-x"]);
  assert.ok(x(pedales.embrayage) < x(pedales.frein) && x(pedales.frein) < x(pedales.accelerateur));
  // Les pédales sous un pied : écart horizontal inférieur à la demi-largeur de la pédale. Une seule par pied, et jamais la même.
  const sous = (pied) => Object.keys(pedales).filter((r) => Math.abs(x(pied) - x(pedales[r])) < Number(pedales[r].attributs["data-largeur"]) / 2);
  const gauche = trouverRole(d, "pied-gauche"), droit = trouverRole(d, "pied-droit");
  assert.deepEqual(sous(gauche), ["embrayage"]);
  assert.deepEqual(sous(droit), ["frein"]);
  // Chaque pédale est nommée par son étiquette, chaque pied aussi ; la règle du cours est écrite.
  for (const [role, nom] of [["embrayage", "embrayage"], ["frein", "frein"], ["accelerateur", "accélérateur"],
    ["pied-gauche", "pied gauche"], ["pied-droit", "pied droit"]]) {
    assert.equal(textesDe(trouverRole(d, `etiquette-${role}`)), nom, role);
  }
  assert.ok(textesDe(d).includes("jamais deux pieds sur la même pédale"));
});

test("pedales : la flèche du pied droit part du frein et va vers l'accélérateur", () => {
  const d = famille.DESSINS.pedales();
  const pivot = trouverRole(d, "pivot");
  const [depart, arrivee] = [["data-x1", "data-y1"], ["data-x2", "data-y2"]].map((ks) => ks.map((k) => Number(pivot.attributs[k])));
  const centre = (r) => Number(trouverRole(d, r).attributs["data-x"]);
  const demi = (r) => Number(trouverRole(d, r).attributs["data-largeur"]) / 2;
  assert.ok(Math.abs(depart[0] - centre("frein")) < demi("frein"), "départ au-dessus du frein");
  assert.ok(Math.abs(arrivee[0] - centre("accelerateur")) < demi("accelerateur"), "arrivée au-dessus de l'accélérateur");
  assert.ok(trouverRole(pivot, "fleche"), "la flèche elle-même");
});

// ===== Pièces partagées avec les gestes du volant (tâche 7) =====

const proche = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

test("pointHeure : midi en haut, 3 h à droite, 6 h en bas, 9 h à gauche", () => {
  const cas = [[12, [100, 50]], [0, [100, 50]], [3, [150, 100]], [6, [100, 150]], [9, [50, 100]]];
  for (const [heure, [x, y]] of cas) {
    const [px, py] = famille.pointHeure(100, 100, 50, heure);
    assert.ok(proche(px, x) && proche(py, y), `${heure} h : ${px}, ${py}`);
  }
});

test("volant : centre, rayon et angle sur le groupe ; trois branches à 3 h, 6 h et 9 h, tournées de l'angle dans le sens horaire", () => {
  for (const angle of [0, 30, -45]) {
    const v = famille.volant({ cx: 120, cy: 90, rayon: 50, angle });
    assert.equal(v.attributs["data-r"], "volant");
    assert.deepEqual(["data-x", "data-y", "data-rayon", "data-angle"].map((k) => v.attributs[k]), [120, 90, 50, angle]);
    const branches = Object.fromEntries([3, 6, 9].map((h) => [h, trouverRole(v, `branche-${h}`)]));
    for (const h of [3, 6, 9]) {
      assert.ok(branches[h], `branche de ${h} h`);
      assert.ok(proche(Number(branches[h].attributs["data-angle"]), (((h * 30 + angle) % 360) + 360) % 360), `branche de ${h} h`);
    }
    // Les branches et le moyeu tournent autour du centre du volant, du même angle que celui qu'annonce le groupe.
    const tourne = trouverRole(v, "volant-tournant");
    assert.equal(tourne.attributs.transform, `rotate(${angle} 120 90)`);
    for (const h of [3, 6, 9]) assert.ok(trouverTous(tourne, (x) => x === branches[h]).length === 1);
  }
  assert.deepEqual(famille.volant({ cx: 0, cy: 0, rayon: 50 }).attributs["data-angle"], 0);
  assert.ok(famille.EPAISSEUR_JANTE > 0.1 && famille.EPAISSEUR_JANTE < 0.3, "épaisseur de jante en fraction du rayon");
});

test("main : posée sur la jante à son heure ; pouce sur la jante ou à l'intérieur ; même forme, ouverte ou fermée", () => {
  const C = { cx: 160, cy: 100, rayon: 50 };
  const e = C.rayon * famille.EPAISSEUR_JANTE;
  const dist = (n) => Math.hypot(n.attributs["data-x"] - C.cx, n.attributs["data-y"] - C.cy);
  const forme = formeArbre(famille.main({ ...C, heure: 9, cote: "gauche" }));
  for (const [cote, heure] of [["gauche", 9], ["droite", 3], ["droite", 12], ["gauche", 10.5], ["droite", 1.25]]) {
    for (const prise of [0, 0.5, 1]) {
      const jante = famille.main({ ...C, heure, cote, prise });
      const interieur = famille.main({ ...C, heure, cote, prise, pouce: "interieur" });
      const m = trouverRole(jante, `main-${cote}`);
      const [x, y] = famille.pointHeure(C.cx, C.cy, C.rayon, heure);
      assert.ok(proche(m.attributs["data-x"], x, 1e-6) && proche(m.attributs["data-y"], y, 1e-6), `${cote} à ${heure} h`);
      assert.ok(Math.abs(dist(trouverRole(jante, `pouce-${cote}`)) - C.rayon) <= e / 2, `${cote} ${heure} h prise ${prise} : pouce sur la jante`);
      assert.ok(dist(trouverRole(interieur, `pouce-${cote}`)) < C.rayon - e / 2, `${cote} ${heure} h prise ${prise} : pouce dans la jante`);
      // Une animation garde ses nœuds : ni l'heure, ni la prise, ni le pouce, ni le côté ne changent la forme de l'arbre.
      assert.equal(formeArbre(jante), forme);
      assert.equal(formeArbre(interieur), forme);
    }
  }
});

test("main : le pouce posé sur la jante file vers le haut à 9 h et à 3 h, les deux mains en miroir", () => {
  const C = { cx: 160, cy: 100, rayon: 50 };
  for (const [cote, heure] of [["gauche", 9], ["droite", 3]]) {
    const m = famille.main({ ...C, heure, cote });
    const main = trouverRole(m, `main-${cote}`), pouce = trouverRole(m, `pouce-${cote}`);
    assert.ok(pouce.attributs["data-y"] < main.attributs["data-y"] - 0.1 * C.rayon, `${cote} : pouce au-dessus de la main`);
  }
  const g = trouverRole(famille.main({ ...C, heure: 9, cote: "gauche" }), "pouce-gauche");
  const d = trouverRole(famille.main({ ...C, heure: 3, cote: "droite" }), "pouce-droite");
  assert.ok(proche(g.attributs["data-x"] - C.cx, -(d.attributs["data-x"] - C.cx), 1e-6) && proche(g.attributs["data-y"], d.attributs["data-y"], 1e-6));
});

test("main : la prise se voit, doigts refermés sur la jante (prise 1), cachés main ouverte (prise 0)", () => {
  const C = { cx: 160, cy: 100, rayon: 50, heure: 9, cote: "gauche" };
  assert.equal(trouverRole(famille.main({ ...C, prise: 1 }), "doigts-gauche").attributs.display, "inline");
  assert.equal(trouverRole(famille.main({ ...C, prise: 0 }), "doigts-gauche").attributs.display, "none");
});

test("main : un côté, un pouce ou une prise hors de leurs valeurs est une erreur, jamais un choix par défaut", () => {
  const C = { cx: 160, cy: 100, rayon: 50, heure: 9 };
  assert.throws(() => famille.main({ ...C, cote: "Gauche" }), /côté « Gauche » inconnu/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", pouce: "dedans" }), /pouce « dedans » inconnu/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", prise: 1.5 }), /prise/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", heure: Number.NaN }), /heure/);
});
