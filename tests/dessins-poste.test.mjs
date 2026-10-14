import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-poste.js";
import { SOURCES } from "../sources/dessins-poste.js";
import { trouverRole, trouverTous, texteDe, parcourir } from "../js/dessin-svg.js";
import { CHARTE } from "../js/dessins-kit.js";
import { PAS_IMAGE, imageA, imageFigee } from "../js/geste-regles.js";
import { verifierDessin, verifierGeste, formeArbre } from "./aides-dessins.mjs";

// Tous les codes « poste » du catalogue : les trois dessins fixes et les trois gestes du volant (le filtre des dessins fixes du
// Ruling R2, tâche 6, est retiré avec l'arrivée des gestes).
const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "poste");

test("poste : chaque code du catalogue est dessiné et passe les contrôles communs", () => {
  for (const code of codes) {
    const e = CATALOGUE[code];
    if (e.bloc === "dessin") assert.deepEqual(verifierDessin(famille.DESSINS[code](), e.cadre), [], code);
    else assert.deepEqual(verifierGeste(famille.GESTES[code].construire(), e), [], code);
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

test("main : posée sur la jante à son heure ; pouce sur la jante ou à l'intérieur ; même forme, ouverte ou fermée, avec ou sans avant-bras", () => {
  const C = { cx: 160, cy: 100, rayon: 50 };
  const e = C.rayon * famille.EPAISSEUR_JANTE;
  const dist = (n) => Math.hypot(n.attributs["data-x"] - C.cx, n.attributs["data-y"] - C.cy);
  const avantBras = { coude: [C.cx - 70, C.cy + 90], limite: [0, 0, 320, 200] };
  const forme = formeArbre(famille.main({ ...C, heure: 9, cote: "gauche" }));
  const formeBras = formeArbre(famille.main({ ...C, heure: 9, cote: "gauche", avantBras }));
  assert.notEqual(formeBras, forme, "l'avant-bras ajoute ses nœuds");
  for (const [cote, heure] of [["gauche", 9], ["droite", 3], ["droite", 12], ["gauche", 10.5], ["droite", 1.25]]) {
    for (const prise of [0, 0.5, 1]) {
      const jante = famille.main({ ...C, heure, cote, prise });
      const interieur = famille.main({ ...C, heure, cote, prise, pouce: "interieur" });
      const m = trouverRole(jante, `main-${cote}`);
      const [x, y] = famille.pointHeure(C.cx, C.cy, C.rayon, heure);
      assert.ok(proche(m.attributs["data-x"], x, 1e-6) && proche(m.attributs["data-y"], y, 1e-6), `${cote} à ${heure} h`);
      // Tant que la main tient ou glisse (prise d'au moins 0,5), le pouce est sur la jante, ou dedans s'il y est engagé.
      if (prise >= 0.5) {
        assert.ok(Math.abs(dist(trouverRole(jante, `pouce-${cote}`)) - C.rayon) <= e / 2, `${cote} ${heure} h prise ${prise} : pouce sur la jante`);
        assert.ok(dist(trouverRole(interieur, `pouce-${cote}`)) < C.rayon - e / 2, `${cote} ${heure} h prise ${prise} : pouce dans la jante`);
      }
      // Une animation garde ses nœuds : ni l'heure, ni la prise, ni le pouce, ni le côté ne changent la forme de l'arbre,
      // avec ou sans avant-bras.
      assert.equal(formeArbre(jante), forme);
      assert.equal(formeArbre(interieur), forme);
      assert.equal(formeArbre(famille.main({ ...C, heure, cote, prise, avantBras })), formeBras, `${cote} ${heure} h prise ${prise}, avant-bras`);
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

// Points d'un tracé (couples de nombres, dans l'ordre) : exacts pour un polygone, points de contrôle compris pour une courbe.
const pointsDe = (d) => {
  const nombres = String(d).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g).map(Number);
  return Array.from({ length: nombres.length / 2 }, (_, i) => [nombres[2 * i], nombres[2 * i + 1]]);
};
const doigtsDe = (main, cote) => trouverTous(trouverRole(main, `doigts-${cote}`), (x) => x.balise === "path" && x.attributs.fill === CHARTE.peau)
  .map((x) => pointsDe(x.attributs.d));

test("main : la prise se voit ; refermée (prise 1), entrouverte (0,5 : la jante glisse dedans), lâchée (0 : main ouverte, écartée de la jante, doigts tendus devant elle)", () => {
  const C = { cx: 160, cy: 100, rayon: 50, heure: 9, cote: "gauche" };
  const e = C.rayon * famille.EPAISSEUR_JANTE;
  const dist = ([x, y]) => Math.hypot(x - C.cx, y - C.cy);
  const etendue = (pts) => [Math.min(...pts.map(dist)), Math.max(...pts.map(dist))];
  // Refermée : chaque doigt déborde du bord intérieur de la jante et revient sur sa face avant, au-delà de sa ligne médiane.
  for (const pts of doigtsDe(famille.main({ ...C, prise: 1 }), "gauche")) {
    const [min, max] = etendue(pts);
    assert.ok(min < C.rayon - e / 2 && max > C.rayon, `refermée : de ${min.toFixed(1)} à ${max.toFixed(1)}`);
  }
  // Entrouverte : les doigts ont quitté la face avant de la jante, ils sortent de derrière elle par son bord intérieur.
  for (const pts of doigtsDe(famille.main({ ...C, prise: 0.5 }), "gauche")) {
    const [min, max] = etendue(pts);
    // (les tracés s'écrivent à deux décimales : 0,02 unité de jeu)
    assert.ok(max <= C.rayon - e / 2 + 0.02 && min < C.rayon - e, `entrouverte : de ${min.toFixed(2)} à ${max.toFixed(2)}`);
  }
  // Lâchée : la main ouverte, devant la jante : les doigts tendus la traversent, de son dedans jusqu'au dos de la main.
  const ouverte = famille.main({ ...C, prise: 0 });
  for (const pts of doigtsDe(ouverte, "gauche")) {
    const [min, max] = etendue(pts);
    assert.ok(min < C.rayon - e / 2 && max > C.rayon + e / 2, `lâchée : de ${min.toFixed(1)} à ${max.toFixed(1)}`);
  }
  const pouce = trouverRole(ouverte, "pouce-gauche").attributs;
  assert.ok(dist([pouce["data-x"], pouce["data-y"]]) > C.rayon + e / 2, "main ouverte : le pouce a quitté la jante");
});

test("main : doigts entrouverts lisibles sur un téléphone, à l'échelle des gestes : des doigts allongés, pas des perles sur la jante", () => {
  const C = { cx: 160, cy: 130, rayon: 59.2, heure: 9, cote: "gauche", prise: 0.5 };   // échelle des gestes : 3,2 unités par cm
  const pxParUnite = 343 / 320;
  for (const pts of doigtsDe(famille.main(C), "gauche")) {
    // Repère local : le long de la jante (tangente) et en travers (vers le centre), au milieu du doigt.
    const [mx, my] = [0, 1].map((i) => pts.reduce((somme, q) => somme + q[i], 0) / pts.length);
    const radial = [mx - C.cx, my - C.cy].map((v) => v / Math.hypot(mx - C.cx, my - C.cy)), tangent = [-radial[1], radial[0]];
    const proj = (u) => pts.map(([x, y]) => (x - mx) * u[0] + (y - my) * u[1]);
    const longueur = Math.max(...proj(radial)) - Math.min(...proj(radial)), largeur = Math.max(...proj(tangent)) - Math.min(...proj(tangent));
    assert.ok(longueur >= 1.8 * largeur, `doigt de ${longueur.toFixed(1)} sur ${largeur.toFixed(1)} unités : trop court pour un doigt`);
    assert.ok(longueur * pxParUnite >= 12, `doigt de ${(longueur * pxParUnite).toFixed(1)} px sur un téléphone`);
  }
});

// Main du côté `cote`, à `heure` et à `prise`, dans le repère des gestes du volant (volant, coude et cadre des gestes).
const mainGeste = (cote, heure, prise = 1) => {
  const R = famille.repereGeste(cote);
  return famille.main({ cx: R.cx, cy: R.cy, rayon: R.rayon, heure, cote, prise, avantBras: { coude: R.coude, limite: [0, 0, ...CATALOGUE["tirer-glisser"].cadre] } });
};

test("main : le poignet quitte la main du côté du coude, à toute heure ; à midi, l'avant-bras part donc sous la main et descend devant le volant", () => {
  const angle = (u, v) => (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI;
  for (const [cote, heure] of [["gauche", 9], ["droite", 3], ["gauche", 12], ["droite", 0], ["droite", 5], ["gauche", 13.5], ["droite", 10.5]]) {
    const m = mainGeste(cote, heure), coude = famille.repereGeste(cote).coude;
    const dos = pointsDe(trouverRole(m, `dos-${cote}`).attributs.d);
    const centre = [0, 1].map((i) => dos.reduce((somme, q) => somme + q[i], 0) / dos.length);
    const a = trouverRole(m, `avant-bras-${cote}`).attributs, poignet = [a["data-x"], a["data-y"]];
    const ecart = angle([poignet[0] - centre[0], poignet[1] - centre[1]], [coude[0] - centre[0], coude[1] - centre[1]]);
    assert.ok(ecart < 15, `${cote} à ${heure} h : le poignet part à ${ecart.toFixed(0)} degrés de la direction du coude`);
  }
});

// Points d'un tracé de segments M, L, C et Z : ses sommets, et des points pris le long de chaque courbe de Bézier cubique (ses
// points de contrôle exclus), pour juger de la place d'une surface lisse.
function echantillons(d, pas = 8) {
  const jetons = String(d).match(/[MLCZ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g), points = [];
  let commande = "M", courant = null;
  for (let i = 0; i < jetons.length;) {
    if (/[MLCZ]/.test(jetons[i])) { commande = jetons[i++]; continue; }
    const lire = (k) => [Number(jetons[i + 2 * k]), Number(jetons[i + 2 * k + 1])];
    if (commande === "C") {
      const [c1, c2, fin] = [lire(0), lire(1), lire(2)];
      for (let j = 1; j <= pas; j++) {
        const t = j / pas, u = 1 - t;
        points.push([0, 1].map((k) => u * u * u * courant[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * fin[k]));
      }
      courant = fin;
      i += 6;
    } else {
      courant = lire(0);
      points.push(courant);
      i += 2;
    }
  }
  return points;
}
// Distance d'un point à un polygone : 0 dedans, sinon au plus proche de ses côtés.
function distancePolygone(p, poly) {
  if (dedansAvecMarge(p, poly, 0)) return 0;
  return Math.min(...poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length], ab = [b[0] - a[0], b[1] - a[1]];
    const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2 || 1)));
    return Math.hypot(p[0] - (a[0] + u * ab[0]), p[1] - (a[1] + u * ab[1]));
  }));
}

test("main : l'avant-bras passe sous le dos de la main et devant les doigts, à toute heure et à toute prise ; un pli là où sa peau passe sur la leur", () => {
  let couverts = 0;
  for (const cote of ["gauche", "droite"]) {
    for (let heure = 0; heure < 12; heure += 0.5) {
      for (const prise of [0, 0.25, 0.5, 0.75, 1]) {
        const quand = `${cote}, ${heure} h, prise ${prise}`;
        const m = trouverRole(mainGeste(cote, heure, prise), `main-${cote}`);
        // De dessous à dessus : la peau du poignet, le dos de la main, les doigts, le reste de l'avant-bras, le pouce.
        const rangs = ["poignet", "dos", "doigts", "avant-bras", "pouce"].map((r) => m.enfants.findIndex((x) => x && typeof x !== "string" && x.attributs["data-r"] === `${r}-${cote}`));
        assert.ok(rangs.every((r, i) => r >= 0 && (i === 0 || r > rangs[i - 1])), `${quand} : rangs ${rangs}`);
        // L'avant-bras posé sur les doigts commence au-delà du dos de la main et de son pli (un trait fin centré sur son bord).
        const bras = trouverRole(m, `avant-bras-${cote}`);
        const pleins = (garder) => trouverTous(bras, (x) => x.balise === "path" && garder(x.attributs.fill)).map((x) => pointsDe(x.attributs.d)).filter((p) => p.length >= 3);
        const ecart = Math.min(...echantillons(trouverRole(m, `dos-${cote}`).attributs.d).flatMap((q) => pleins((f) => f && f !== "none").map((p) => distancePolygone(q, p))));
        assert.ok(ecart >= CHARTE.traits.fin / 2, `${quand} : l'avant-bras passe à ${ecart.toFixed(2)} unité du bord du dos de la main`);
        // Là où sa peau passe sur les doigts, un pli la borde.
        if (recouvre(pleins((f) => f === CHARTE.peau), doigtsDe(m, cote))) {
          couverts++;
          assert.ok(!traceVide(trouverRole(m, `pli-avant-bras-${cote}`).attributs.d), `${quand} : peau de l'avant-bras sur les doigts sans pli`);
        }
      }
    }
  }
  assert.ok(couverts > 0, "l'avant-bras ne passe jamais sur les doigts : le contrôle ne contrôle rien");
});

test("main : un côté, un pouce ou une prise hors de leurs valeurs est une erreur, jamais un choix par défaut", () => {
  const C = { cx: 160, cy: 100, rayon: 50, heure: 9 };
  assert.throws(() => famille.main({ ...C, cote: "Gauche" }), /côté « Gauche » inconnu/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", pouce: "dedans" }), /pouce « dedans » inconnu/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", prise: 1.5 }), /prise/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", heure: Number.NaN }), /heure/);
});

// ===== Relecture de la tâche 6 : charte, peau, anneau, levier, contacteur, flèche =====

// Les dessins fixes, et les images figées de chaque étape des gestes (la peau et les traits s'y contrôlent aussi).
const DESSINS_POSTE = () => [...Object.entries(famille.DESSINS).map(([code, f]) => [code, f()]),
  ...Object.entries(famille.GESTES).flatMap(([code, g]) => { const def = g.construire(); return def.etapes.map((_, i) => [`${code} étape ${i + 1}`, imageFigee(def, i)]); })];

test("poste : traits pris dans le jeu de quatre de la charte, liserés clairs à part, volant à tout angle et mains à toute prise", () => {
  const jeu = Object.values(CHARTE.traits);
  const liseres = new Set([2 * CHARTE.liseres, ...jeu.map((t) => t + 2 * CHARTE.liseres)]);
  const pieces = [famille.volant({ cx: 160, cy: 100, rayon: 50, angle: 37 }), famille.volant({ cx: 160, cy: 100, rayon: 30, avertisseur: true }),
    ...[0, 0.5, 1].map((prise) => famille.main({ cx: 160, cy: 100, rayon: 50, heure: 11, cote: "droite", prise,
      avantBras: { coude: [230, 190], limite: [0, 0, 320, 200] } }))];
  let vus = 0;
  for (const [quoi, d] of [...DESSINS_POSTE(), ...pieces.map((x, i) => [`pièce ${i}`, x])]) {
    for (const x of trouverTous(d, (y) => "stroke-width" in y.attributs)) {
      const l = x.attributs["stroke-width"], lisere = x.attributs.stroke === CHARTE.carte;
      assert.ok(lisere ? liseres.has(l) : jeu.includes(l), `${quoi} : ${x.balise} ${x.attributs["data-r"] || ""} épaisseur ${l}`);
      vus++;
    }
  }
  assert.ok(vus > 30);
});

test("poste : la peau n'a que les deux tons de la charte, et seulement dans les mains", () => {
  const peau = new Set([CHARTE.peau, CHARTE.peauOmbre]);
  for (const [code, d] of DESSINS_POSTE()) {
    // Dans une main (hors de sa manche), rien que de la peau ; hors des mains, aucune peau.
    const dansMain = new Set();
    for (const m of trouverTous(d, (x) => /^main-/.test(x.attributs["data-r"] || ""))) {
      parcourir(m, (x) => dansMain.add(x));
      for (const manche of trouverTous(m, (x) => /^manche-/.test(x.attributs["data-r"] || ""))) parcourir(manche, (x) => dansMain.delete(x));
    }
    parcourir(d, (x) => {
      for (const k of ["fill", "stroke"]) {
        const c = x.attributs[k];
        if (!c || c === "none") continue;
        if (dansMain.has(x)) assert.ok(peau.has(c), `${code} : ${k} ${c} dans une main`);
        else assert.ok(!peau.has(c), `${code} : peau ${c} hors d'une main (${x.balise} ${x.attributs["data-r"] || ""})`);
      }
    });
  }
});

test("mains-volant : l'anneau de la vignette faux entoure le bout du pouce engagé ; pas d'anneau dans la vignette juste", () => {
  const d = famille.DESSINS["mains-volant"]();
  const faux = trouverRole(d, "vignette-faux");
  const a = trouverRole(faux, "anneau-pouce").attributs, p = trouverRole(faux, "pouce-gauche").attributs;
  assert.ok(Math.hypot(p["data-x"] - a["data-x"], p["data-y"] - a["data-y"]) < a["data-rayon"], "le bout du pouce est dans l'anneau");
  assert.equal(trouverRole(trouverRole(d, "vignette-juste"), "anneau-pouce"), null);
});

test("poste-commandes : levier du frein de stationnement, bouton et poignée à l'avant, soufflet du pivot à l'arrière", () => {
  const f = trouverRole(famille.DESSINS["poste-commandes"](), "frein-stationnement");
  const bouton = trouverRole(f, "bouton-deverrouillage").attributs, soufflet = trouverRole(f, "soufflet").attributs;
  const poignee = trouverRole(f, "poignee").attributs;
  const ySoufflet = soufflet.y + soufflet.height / 2;
  assert.ok(bouton.cy < ySoufflet, "le bouton est vers la planche (en haut), le soufflet vers le siège");
  assert.ok(poignee.y + poignee.height / 2 < ySoufflet && bouton.cy >= poignee.y && bouton.cy <= poignee.y + poignee.height, "bouton au bout de la poignée, à l'avant");
});

test("poste-commandes : le point de l'étiquette du contacteur laisse voir la fente de la clé", () => {
  const d = famille.DESSINS["poste-commandes"]();
  const fente = trouverRole(trouverRole(d, "contacteur"), "fente").attributs;
  const etiquette = trouverRole(d, "etiquette-contacteur");
  const filet = trouverRole(etiquette, "filet").attributs;
  const rayonPoint = Math.max(...trouverTous(etiquette, (x) => x.balise === "circle").map((c) => Number(c.attributs.r)));
  const [a, b, c] = [[fente["data-x1"], fente["data-y1"]], [fente["data-x2"], fente["data-y2"]], [Number(filet.x1), Number(filet.y1)]];
  const ab = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
  const ecart = Math.hypot(c[0] - (a[0] + t * ab[0]), c[1] - (a[1] + t * ab[1]));
  assert.ok(ecart > rayonPoint + fente["data-epaisseur"] / 2, `point à ${ecart.toFixed(2)} de l'axe de la fente`);
});

test("pedales : la flèche du pied droit ne touche ni les bras ni le patin de l'accélérateur, liseré compris", () => {
  const d = famille.DESSINS.pedales();
  const pivot = trouverRole(d, "pivot");
  const demi = Math.max(...trouverTous(pivot, (x) => x.balise === "path" && "stroke-width" in x.attributs).map((x) => x.attributs["stroke-width"])) / 2;
  const rect = (role, partie) => trouverRole(trouverRole(d, role), partie).attributs;
  const distanceRect = ([x, y], r) => Math.hypot(Math.max(r.x - x, 0, x - (r.x + r.width)), Math.max(r.y - y, 0, y - (r.y + r.height)));
  const [depart, arrivee] = [["data-x1", "data-y1"], ["data-x2", "data-y2"]].map((ks) => ks.map((k) => Number(pivot.attributs[k])));
  assert.ok(distanceRect(depart, rect("frein", "bras")) > demi, "départ à côté du bras du frein");
  for (const partie of ["bras", "patin"]) assert.ok(distanceRect(arrivee, rect("accelerateur", partie)) > demi, `arrivée hors de ${partie} de l'accélérateur`);
});

// ===== Gestes du volant (tâche 7) : tirer-glisser, chevauchement, retour du volant =====

const geste = (code) => famille.GESTES[code].construire();
const CODES_GESTES = ["tirer-glisser", "chevauchement", "retour-volant"];
const COTES_MAINS = ["gauche", "droite"];
// Instants d'une image (1/60 s), fin comprise.
const instantsDe = (def) => {
  const nombre = Math.ceil(def.duree / PAS_IMAGE);
  return Array.from({ length: nombre + 1 }, (_, k) => (k === nombre ? def.duree : k * PAS_IMAGE));
};
// Place d'une main sur la jante (heures) : constante tant qu'elle la tient.
const surJante = (etat, cote) => etat.mains[cote].heure - etat.volant / 30;

// --- Tests du brief, recopiés ---

test("tirer-glisser : la main gauche reste à 9 h, les mains ne se croisent jamais", () => {
  const def = famille.GESTES["tirer-glisser"].construire();
  for (let t = 0; t <= def.duree; t += 1 / 60) {
    const e = def.etat(t);
    assert.ok(Math.abs(e.mains.gauche.heure - 9) < 0.05, `gauche à ${e.mains.gauche.heure} h à ${t}`);
    const xGauche = Math.sin(e.mains.gauche.heure * Math.PI / 6), xDroite = Math.sin(e.mains.droite.heure * Math.PI / 6);
    assert.ok(xDroite > xGauche + 0.25, `mains croisées à ${t}`);
  }
  const e1 = def.etat(def.etapes[1].t - 1e-6), fin = def.etat(def.duree);
  const ecartMidi = (h) => Math.min(((h % 12) + 12) % 12, 12 - (((h % 12) + 12) % 12));
  assert.ok(Math.abs(e1.volant) < 1e-6 && ecartMidi(e1.mains.droite.heure) < 0.05);   // fin de l'étape 1 : midi, volant droit
  assert.ok(fin.volant >= 90);
});

test("tirer-glisser : pendant l'étape 2, la droite garde sa place sur la jante (elle tire le volant) et la gauche le laisse glisser", () => {
  const def = geste("tirer-glisser");
  const T2 = def.etapes[1].t, reference = surJante(def.etat(T2), "droite");
  let tourne = false;
  for (const t of instantsDe(def).filter((t) => t >= T2)) {
    const e = def.etat(t);
    assert.ok(Math.abs(surJante(e, "droite") - reference) <= 0.02, `droite à ${surJante(e, "droite")} sur la jante à ${t.toFixed(3)} s`);
    assert.ok(e.mains.gauche.prise < 1, `gauche refermée à ${t.toFixed(3)} s`);
    tourne ||= e.volant > 0;
  }
  assert.ok(tourne, "le volant tourne à l'étape 2");
});

test("chevauchement : la gauche suit sans lâcher prise jusqu'à midi, puis tire pendant que la droite a lâché ; à l'étape 4, la droite tire pendant que la gauche, lâchée, remonte ; chaque traction fait au plus un quart de tour ; jamais de volant qui tourne sans une main qui le tient", () => {
  const def = geste("chevauchement");
  const [T2, T3, T4] = [1, 2, 3].map((i) => def.etapes[i].t);
  assert.ok(Math.abs(def.etat(T3 - 1e-6).mains.gauche.heure - 12) <= 0.1, "fin de l'étape 2 : la gauche à midi");
  const ts = instantsDe(def);
  const reference = surJante(def.etat(T2), "gauche");
  for (const t of ts.filter((t) => t >= T2 && t < T3)) {
    assert.ok(Math.abs(surJante(def.etat(t), "gauche") - reference) < 1e-9, `étape 2 : la gauche glisse sur la jante à ${t.toFixed(3)} s`);
  }
  let [tourneEtape3, tourneEtape4] = [false, false];
  for (let i = 1; i < ts.length; i++) {
    const [a, b] = [def.etat(ts[i - 1]), def.etat(ts[i])];
    const tourne = Math.abs(b.volant - a.volant) > 1e-9, quand = `${ts[i].toFixed(3)} s`;
    if (!tourne) continue;
    assert.ok(COTES_MAINS.some((c) => a.mains[c].prise === 1 && b.mains[c].prise === 1), `volant qui tourne sans être tenu, à ${quand}`);
    // Étape 3 : quand le volant tourne, la gauche le tient et tourne avec lui, la droite a lâché la jante.
    if (ts[i - 1] >= T3 && ts[i] < T4) {
      tourneEtape3 = true;
      assert.ok(a.mains.gauche.prise === 1 && b.mains.gauche.prise === 1, `étape 3 : la gauche tient, à ${quand}`);
      assert.ok(Math.abs(surJante(b, "gauche") - surJante(a, "gauche")) < 1e-9, `étape 3 : le volant tourne avec la gauche, à ${quand}`);
      assert.ok(a.mains.droite.prise === 0 && b.mains.droite.prise === 0, `étape 3 : la droite a lâché, à ${quand}`);
    }
    // Étape 4 : l'alternance ; la droite tire, la gauche a lâché la jante et remonte vers midi (sens inverse des aiguilles).
    if (ts[i - 1] >= T4) {
      tourneEtape4 = true;
      assert.ok(a.mains.droite.prise === 1 && b.mains.droite.prise === 1, `étape 4 : la droite tient, à ${quand}`);
      assert.ok(a.mains.gauche.prise === 0 && b.mains.gauche.prise === 0, `étape 4 : la gauche a lâché, à ${quand}`);
      assert.ok(b.mains.gauche.heure <= a.mains.gauche.heure + 1e-9, `étape 4 : la gauche s'éloigne de midi, à ${quand}`);
    }
  }
  assert.ok(tourneEtape3, "la gauche tire le volant à l'étape 3");
  assert.ok(tourneEtape4, "la droite tire le volant à l'étape 4");
  // Chaque traction des étapes 3 et 4 tourne le volant d'au plus un quart de tour ; la gauche finit à midi.
  const [v3, v4, fin] = [T3, T4, def.duree].map((t) => def.etat(t).volant);
  for (const [etape, angle] of [[3, v4 - v3], [4, fin - v4]]) assert.ok(angle > 0 && angle <= 90 + 1e-9, `étape ${etape} : traction de ${angle} degrés`);
  assert.ok(Math.abs(def.etat(def.duree).mains.gauche.heure - 12) <= 0.05, "fin : la gauche remontée à midi");
});

test("retour-volant : doigts qui s'entrouvrent, volant qui revient droit seul en roulant ; à basse allure, tourné par les mains, il ne revient pas seul, puis elles le ramènent", () => {
  const def = geste("retour-volant");
  const [T2, T3, T4] = [1, 2, 3].map((i) => def.etapes[i].t);
  // Étape 1 : en sortie de virage, volant encore tourné, les doigts s'entrouvrent.
  const depart = def.etat(0), finEtape1 = def.etat(T2 - 1e-6);
  assert.ok(depart.volant > 0 && finEtape1.volant === depart.volant, "volant tourné, immobile à l'étape 1");
  for (const c of COTES_MAINS) assert.ok(depart.mains[c].prise === 1 && finEtape1.mains[c].prise < 1, `${c} : doigts qui s'entrouvrent`);
  const ts = instantsDe(def);
  // Étape 2 : le volant décroît jusqu'à 0, les mains ne bougent pas, en roulant.
  const mains2 = def.etat(T2).mains;
  let precedent = def.etat(T2).volant;
  for (const t of ts.filter((t) => t >= T2 && t < T3)) {
    const e = def.etat(t);
    assert.ok(e.volant <= precedent + 1e-12, `étape 2 : le volant remonte à ${t.toFixed(3)} s`);
    precedent = e.volant;
    for (const c of COTES_MAINS) assert.equal(e.mains[c].heure, mains2[c].heure, `étape 2 : la main ${c} bouge à ${t.toFixed(3)} s`);
    assert.equal(e.allure, "roulant");
  }
  assert.ok(Math.abs(def.etat(T3 - 1e-6).volant) < 1e-9, "fin de l'étape 2 : volant droit");
  // Étapes 3 et 4 : basse allure ; le volant ne change que tenu, et la main qui le tient garde sa place sur la jante.
  let change = false;
  for (let i = 1; i < ts.length; i++) {
    if (ts[i - 1] < T3) continue;
    const [a, b] = [def.etat(ts[i - 1]), def.etat(ts[i])];
    assert.equal(b.allure, "basse");
    if (Math.abs(b.volant - a.volant) > 1e-12) {
      change = true;
      const tenantes = COTES_MAINS.filter((c) => a.mains[c].prise === 1 && b.mains[c].prise === 1);
      assert.ok(tenantes.length > 0, `basse allure : le volant tourne sans main qui le tient, à ${ts[i].toFixed(3)} s`);
      for (const c of tenantes) assert.ok(Math.abs(surJante(b, c) - surJante(a, c)) < 1e-9, `basse allure : la ${c} glisse, à ${ts[i].toFixed(3)} s`);
    }
  }
  assert.ok(change, "basse allure : les mains tournent puis ramènent le volant");
  // Étape 3 : les mains ont tourné le volant, puis entrouvert les doigts ; il reste tourné, immobile, au moins 1,0 s.
  const tenu = (e) => COTES_MAINS.some((c) => e.mains[c].prise === 1);
  const laisse = ts.filter((t) => t >= T3 && t < T4 && !tenu(def.etat(t)) && Math.abs(def.etat(t).volant) > 1e-9);
  assert.ok(laisse.length && laisse.every((t) => def.etat(t).volant === def.etat(laisse[0]).volant), "étape 3 : volant laissé tourné, immobile");
  assert.ok(laisse[laisse.length - 1] - laisse[0] >= 1.0 - PAS_IMAGE, `étape 3 : volant laissé tourné ${(laisse[laisse.length - 1] - laisse[0]).toFixed(2)} s`);
  // Étape 4 : son image figée montre le fait de l'étape 3 (volant tourné, doigts entrouverts) ; à la fin, volant ramené droit.
  const debut4 = def.etat(T4);
  assert.ok(Math.abs(debut4.volant) > 1e-9 && COTES_MAINS.every((c) => debut4.mains[c].prise > 0 && debut4.mains[c].prise < 1),
    "début de l'étape 4 : volant tourné, doigts entrouverts");
  assert.ok(Math.abs(def.etat(def.duree).volant) < 1e-9, "fin : volant ramené droit");
});

// --- Règle de prise, commune aux trois gestes ---

test("gestes du volant : une main qui tient la jante tourne avec le volant ; une main qui glisse ne bouge pas pendant qu'il tourne ; posée, elle est sur la jante ; le volant ne tourne sans être tenu qu'en revenant droit, en roulant", () => {
  for (const code of CODES_GESTES) {
    const def = geste(code), ts = instantsDe(def);
    for (let i = 1; i < ts.length; i++) {
      const [a, b] = [def.etat(ts[i - 1]), def.etat(ts[i])];
      const tourne = Math.abs(b.volant - a.volant) > 1e-9, quand = `${code}, ${ts[i].toFixed(3)} s`;
      const revientSeul = a.allure === "roulant" && b.allure === "roulant" && Math.abs(b.volant) < Math.abs(a.volant);
      if (tourne && !revientSeul) assert.ok(COTES_MAINS.some((c) => a.mains[c].prise === 1 && b.mains[c].prise === 1), `${quand} : volant qui tourne sans être tenu`);
      for (const c of COTES_MAINS) {
        const [m, n] = [a.mains[c], b.mains[c]];
        for (const x of [m, n]) if (x.prise > 0) assert.equal(x.decalage, 0, `${quand} : main ${c} posée hors de la jante`);
        if (m.prise === 1 && n.prise === 1) assert.ok(Math.abs(surJante(b, c) - surJante(a, c)) < 1e-9, `${quand} : main ${c} qui tient et glisse`);
        else if (tourne && (m.prise > 0 || n.prise > 0)) {
          assert.ok(Math.abs(n.heure - m.heure) < 1e-9 && Math.abs(n.prise - m.prise) < 1e-9, `${quand} : main ${c} entrouverte qui bouge pendant que le volant tourne`);
        }
      }
    }
  }
});

// Une main qui tient la jante tourne avec elle ; l'avant-bras ne tourne sur lui-même que d'environ un demi-tour (pronation et
// supination réunies) : au-delà, la main doit lâcher la jante (raison et source dans les choix de dessin des gestes).
const TENUE_MAX = 180;

test("gestes du volant : aucune main ne tient la jante plus d'un demi-tour d'un seul tenant", () => {
  let vue = 0;
  for (const code of CODES_GESTES) {
    const def = geste(code), ts = instantsDe(def);
    for (const c of COTES_MAINS) {
      // Rotation du volant cumulée depuis que la main a refermé ses doigts sur la jante, remise à zéro dès qu'elle les ouvre.
      let tenue = 0, pire = { tenue: 0, t: 0 };
      for (let i = 1; i < ts.length; i++) {
        const [a, b] = [def.etat(ts[i - 1]), def.etat(ts[i])];
        tenue = a.mains[c].prise === 1 && b.mains[c].prise === 1 ? tenue + Math.abs(b.volant - a.volant) : 0;
        if (tenue > pire.tenue) pire = { tenue, t: ts[i] };
      }
      assert.ok(pire.tenue <= TENUE_MAX + 1e-6, `${code}, main ${c} : ${pire.tenue.toFixed(0)} degrés sans lâcher la jante, à ${pire.t.toFixed(2)} s`);
      vue = Math.max(vue, pire.tenue);
    }
  }
  assert.ok(vue > 0, "aucune main ne tourne le volant : le contrôle ne contrôle rien");
});

// Le libellé de situation dit l'allure de l'état (retour du volant).
const LIBELLES_ALLURE = { roulant: "En roulant", basse: "Basse allure" };
// Un nœud est visible si aucun de ses ancêtres (lui compris) n'est masqué ni transparent.
function visible(racine, cible) {
  const chemin = (noeud) => {
    if (noeud === cible) return [noeud];
    for (const e of noeud.enfants || []) {
      if (typeof e === "string") continue;
      const suite = chemin(e);
      if (suite) return [noeud, ...suite];
    }
    return null;
  };
  return (chemin(racine) || []).every((x) => x.attributs.display !== "none" && (x.attributs.opacity === undefined || Number(x.attributs.opacity) === 1));
}

test("retour-volant : le libellé dit l'allure de l'état à chaque instant ; il change net quand l'étape 3 commence, et chaque image figée le montre une fois", () => {
  const def = geste("retour-volant"), T3 = def.etapes[2].t;
  for (const t of instantsDe(def)) {
    const e = def.etat(t);
    assert.equal(e.allure, t < T3 ? "roulant" : "basse", `allure à ${t.toFixed(3)} s`);
    const image = imageA(def, t, false), libelle = trouverRole(image, "indication-texte");
    assert.equal(texteDe(libelle), LIBELLES_ALLURE[e.allure], `libellé à ${t.toFixed(3)} s`);
    assert.ok(visible(image, libelle), `libellé masqué à ${t.toFixed(3)} s`);
  }
  def.etapes.forEach((etape, i) => {
    const image = imageFigee(def, i), attendu = LIBELLES_ALLURE[def.etat(etape.t).allure];
    const libelles = trouverTous(image, (x) => x.balise === "text" && Object.values(LIBELLES_ALLURE).includes(texteDe(x)));
    assert.deepEqual(libelles.map(texteDe), [attendu], `étape ${i + 1}`);
    assert.ok(visible(image, libelles[0]), `étape ${i + 1} : libellé masqué`);
  });
  for (const code of ["tirer-glisser", "chevauchement"]) {
    const d = geste(code), lus = new Set(instantsDe(d).map((t) => texteDe(trouverRole(imageA(d, t, false), "indication-texte"))));
    assert.deepEqual([...lus], [code === "chevauchement" ? "En manœuvre" : "En circulation"], code);
  }
});

// --- Ce que montre l'image ---

const ROLE_POINT = /^(main|doigts|pouce|avant-bras)-(gauche|droite)$|^branche-\d+$/;
const pointsDessines = (image) => new Map(trouverTous(image, (x) => ROLE_POINT.test(x.attributs["data-r"] || "") && "data-x" in x.attributs)
  .map((x) => [x.attributs["data-r"], [Number(x.attributs["data-x"]), Number(x.attributs["data-y"])]]));

test("gestes du volant : aucun point dessiné (mains, doigts, pouces, poignets, branches du volant) ne bouge de plus de 8 unités en une image", () => {
  const SAUT_IMAGE = 8;   // unités par image de 1/60 s (7,5 px sur un téléphone), comme la tâche 9
  for (const code of CODES_GESTES) {
    const def = geste(code);
    let avant = null, pire = { saut: 0 };
    for (const t of instantsDe(def)) {
      const points = pointsDessines(imageA(def, t, false));
      assert.equal(points.size, 4 * 2 + 3, `${code} : points dessinés absents à ${t.toFixed(3)} s`);
      if (avant) {
        for (const [role, [x, y]] of points) {
          const [x0, y0] = avant.get(role), saut = Math.hypot(x - x0, y - y0);
          if (saut > pire.saut) pire = { saut, role, t };
        }
      }
      avant = points;
    }
    assert.ok(pire.saut <= SAUT_IMAGE, `${code} : ${pire.role} : ${pire.saut.toFixed(1)} unités en une image à ${pire.t.toFixed(3)} s`);
  }
});

// Différences d'attributs (et de textes) entre deux images de même forme.
function differences(a, b, chemin = "", sortie = []) {
  if (typeof a === "string") {
    if (a !== b) sortie.push({ chemin, attribut: "#texte", role: "" });
    return sortie;
  }
  for (const k of new Set([...Object.keys(a.attributs), ...Object.keys(b.attributs)])) {
    if (String(a.attributs[k]) !== String(b.attributs[k])) sortie.push({ chemin: `${chemin}/${a.balise}`, attribut: k, role: a.attributs["data-r"] || "" });
  }
  a.enfants.forEach((e, i) => differences(e, b.enfants[i], `${chemin}/${a.balise}[${i}]`, sortie));
  return sortie;
}

test("gestes du volant : une image figée est l'image de l'animation à cet instant, seul le groupe des flèches s'y montre", () => {
  for (const code of CODES_GESTES) {
    const def = geste(code);
    const ts = [...def.etapes.map((e) => e.t), ...instantsDe(def).filter((_, k) => k % 4 === 0)];
    for (const t of ts) {
      const diff = differences(imageA(def, t, true), imageA(def, t, false));
      assert.equal(diff.length, 1, `${code}, ${t.toFixed(3)} s : ${diff.length} différences`);
      assert.deepEqual([diff[0].attribut, diff[0].role], ["display", "fleche"], `${code}, ${t.toFixed(3)} s`);
    }
  }
});

// Flèches visibles de l'image figée d'une étape : l'heure (autour du centre du volant) de leur queue et de leur pointe, et
// leur sens de rotation à la pointe (1 horaire, -1 antihoraire).
function flechesEtape(def, i) {
  const image = imageFigee(def, i);
  const v = trouverRole(image, "volant").attributs, [cx, cy] = [v["data-x"], v["data-y"]];
  const heureDe = ([x, y]) => ((((Math.atan2(x - cx, cy - y) * 6) / Math.PI) % 12) + 12) % 12;
  return trouverTous(trouverRole(image, "fleche"), (x) => /^fleche-\d+$/.test(x.attributs["data-r"] || "") && x.attributs.display !== "none")
    .map((f) => {
      // La tête : sa pointe, ses deux ailes et son encoche ; elle file de l'encoche vers la pointe.
      const queue = pointsDe(trouverRole(f, "fleche-trait").attributs.d)[0];
      const [pointe, , encoche] = pointsDe(trouverRole(f, "fleche-tete").attributs.d);
      const [r, dir] = [[pointe[0] - cx, pointe[1] - cy], [pointe[0] - encoche[0], pointe[1] - encoche[1]]];
      return { queue: heureDe(queue), pointe: heureDe(pointe), sens: Math.sign(r[0] * dir[1] - r[1] * dir[0]) };
    });
}
const procheHeure = (h, cible, tolerance = 0.6) => Math.abs(((((h - cible) % 12) + 18) % 12) - 6) <= tolerance;
const trouve = (fleches, { de, a, sens }) => fleches.some((f) => procheHeure(f.queue, de) && procheHeure(f.pointe, a) && f.sens === sens);

test("gestes du volant : les flèches de chaque étape montrent le mouvement qu'elle décrit", () => {
  const tg = geste("tirer-glisser");
  assert.ok(trouve(flechesEtape(tg, 0), { de: 3, a: 0, sens: -1 }), "tirer-glisser, étape 1 : la droite monte de 3 h à midi");
  assert.ok(trouve(flechesEtape(tg, 1), { de: 0, a: 5, sens: 1 }), "tirer-glisser, étape 2 : la droite tire de midi à 5 h");
  assert.ok(trouve(flechesEtape(tg, 1), { de: 8.75, a: 9.25, sens: 1 }), "tirer-glisser, étape 2 : la jante glisse vers le haut dans la gauche");
  const ch = geste("chevauchement");
  assert.ok(trouve(flechesEtape(ch, 0), { de: 3, a: 0, sens: -1 }), "chevauchement, étape 1 : la droite monte à midi");
  assert.ok(trouve(flechesEtape(ch, 1), { de: 0, a: 3, sens: 1 }) && trouve(flechesEtape(ch, 1), { de: 9, a: 0, sens: 1 }),
    "chevauchement, étape 2 : la droite tire jusqu'à 3 h, la gauche suit de 9 h à midi");
  // La flèche de la main qui remonte part au-delà du bout des doigts de la main qui tient encore la jante à 3 h (vers 2 h 30) et
  // s'arrête sous la main qui est à midi au début de l'étape (vers midi et demi) : elle va de 3 h vers midi, en dedans de la jante.
  assert.ok(trouve(flechesEtape(ch, 2), { de: 0, a: 3, sens: 1 }) && trouve(flechesEtape(ch, 2), { de: 2.5, a: 0.5, sens: -1 }),
    "chevauchement, étape 3 : la gauche tire de midi à 3 h, la droite remonte de 3 h vers midi");
  assert.ok(trouve(flechesEtape(ch, 3), { de: 0, a: 3, sens: 1 }) && trouve(flechesEtape(ch, 3), { de: 2.5, a: 0.5, sens: -1 }),
    "chevauchement, étape 4 : la droite tire de midi à 3 h, la gauche remonte de 3 h vers midi");
  const rv = geste("retour-volant");
  const e1 = flechesEtape(rv, 0);
  assert.ok(e1.length === 2 && e1.every((f) => f.sens === -1), "retour-volant, étape 1 : la jante glisse dans les deux mains, dans le sens du retour");
  assert.ok(e1.some((f) => procheHeure(f.queue, 8.35, 0.4)) && e1.some((f) => procheHeure(f.pointe, 3.65, 0.4)), "retour-volant, étape 1 : au bord des mains");
  const e2 = flechesEtape(rv, 1);
  assert.ok(e2.length === 1 && e2[0].sens === -1 && procheHeure(e2[0].queue, 2.5) && procheHeure(e2[0].pointe, 9.5), "retour-volant, étape 2 : le volant revient d'un demi-tour");
  // Étapes 3 et 4 : les flèches partent des mains ; chacune tourne le volant d'un quart de tour, puis le ramène.
  const [e3, e4] = [flechesEtape(rv, 2), flechesEtape(rv, 3)];
  assert.ok(e3.length === 2 && trouve(e3, { de: 9, a: 0, sens: 1 }) && trouve(e3, { de: 3, a: 6, sens: 1 }),
    "retour-volant, étape 3 : les mains tournent le volant d'un quart de tour, de 9 h à midi et de 3 h à 6 h");
  assert.ok(e4.length === 2 && trouve(e4, { de: 0, a: 9, sens: -1 }) && trouve(e4, { de: 6, a: 3, sens: -1 }),
    "retour-volant, étape 4 : les mains le ramènent, de midi à 9 h et de 6 h à 3 h");
  const debut4 = rv.etat(rv.etapes[3].t).mains;
  assert.ok(procheHeure(debut4.gauche.heure, 0, 0.05) && procheHeure(debut4.droite.heure, 6, 0.05), "retour-volant, étape 4 : les flèches partent des mains");
});

test("gestes du volant : la voiture braque ses roues avant dans le sens du volant, au rapport de direction, et le compteur dit l'angle du volant", () => {
  for (const code of CODES_GESTES) {
    const def = geste(code);
    for (const t of instantsDe(def).filter((_, k) => k % 6 === 0)) {
      const e = def.etat(t), image = imageA(def, t, false);
      for (const roue of ["roue-avant-gauche", "roue-avant-droite"]) {
        const angle = Number(trouverRole(image, roue).attributs["data-angle"]);
        assert.ok(Math.abs(angle - e.volant / 15) < 1e-6, `${code}, ${t.toFixed(2)} s : ${roue} à ${angle} degrés pour un volant à ${e.volant}`);
      }
      assert.equal(texteDe(trouverRole(image, "compteur")), `${Math.round(e.volant)}°`, `${code}, ${t.toFixed(2)} s`);
    }
  }
});

// Un point dans un polygone (parité des croisements), à `marge` unités au moins de ses côtés.
function dedansAvecMarge([x, y], poly, marge) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  if (!dedans) return false;
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length], ab = [b[0] - a[0], b[1] - a[1]];
    const u = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2 || 1)));
    return Math.hypot(x - (a[0] + u * ab[0]), y - (a[1] + u * ab[1])) >= marge;
  });
}
// Surfaces d'une main dans l'image, en polygones (points de contrôle compris) : sa peau (dos, doigts, pouce, poignet) et sa
// manche (tissu et revers).
function surfacesMain(image, cote) {
  const m = trouverRole(image, `main-${cote}`), manche = trouverRole(m, `manche-${cote}`);
  const pleins = (noeud, garder) => trouverTous(noeud, (x) => x.balise === "path" && garder(x.attributs.fill)).map((x) => pointsDe(x.attributs.d)).filter((p) => p.length >= 3);
  return { peau: pleins(m, (f) => f === CHARTE.peau), manche: pleins(manche, (f) => f && f !== "none") };
}
const recouvre = (dessus, dessous, marge = 1) => dessus.some((a) => dessous.some((b) => a.some((p) => dedansAvecMarge(p, b, marge)) || b.some((p) => dedansAvecMarge(p, a, marge))));
const traceVide = (d) => !/[CL]/.test(String(d));

// Centre du dos d'une main (moyenne des points de son tracé) et surfaces pleines de son avant-bras (peau du poignet, peau et
// manche du reste de l'avant-bras).
function centreDos(image, cote) {
  const dos = pointsDe(trouverRole(image, `dos-${cote}`).attributs.d);
  return [0, 1].map((i) => dos.reduce((somme, q) => somme + q[i], 0) / dos.length);
}
const surfacesAvantBras = (image, cote) => [`poignet-${cote}`, `avant-bras-${cote}`].flatMap((role) => trouverTous(trouverRole(image, role),
  (x) => x.balise === "path" && x.attributs.fill && x.attributs.fill !== "none").map((x) => pointsDe(x.attributs.d)).filter((p) => p.length >= 3));

test("chevauchement : la main qui croise passe devant l'avant-bras qu'elle croise, la droite par-dessus le bras gauche (étape 3) ; la gauche remonte sous le bras droit (étape 4), jamais devant lui", () => {
  const def = geste("chevauchement");
  const [T3, T4] = [def.etapes[2].t, def.etapes[3].t];
  let [dessus, dessous] = [false, false];
  for (const t of instantsDe(def)) {
    const image = imageA(def, t, false);
    // Empilement constant : la gauche (main et avant-bras) dessinée d'abord, la droite par-dessus, dans le même parent.
    const droite = trouverRole(image, "main-droite"), gauche = trouverRole(image, "main-gauche");
    const freres = trouverTous(image, (x) => x.enfants.includes(droite))[0].enfants;
    assert.ok(freres.includes(gauche) && freres.indexOf(gauche) < freres.indexOf(droite), `${t.toFixed(3)} s : la gauche devant la droite`);
    // La main qui croise passe sur l'avant-bras de l'autre : le centre de son dos tombe sur la peau ou la manche de cet avant-bras.
    const sur = (cote, bras) => surfacesAvantBras(image, bras).some((p) => dedansAvecMarge(centreDos(image, cote), p, 0));
    if (t >= T3 && t < T4 && sur("droite", "gauche")) dessus = true;
    if (t >= T4 && sur("gauche", "droite")) dessous = true;
  }
  assert.ok(dessus, "étape 3 : la main droite ne passe jamais sur l'avant-bras gauche");
  assert.ok(dessous, "étape 4 : la main gauche ne passe jamais sous l'avant-bras droit");
});

test("gestes du volant : là où une main passe sur l'autre, un contour sépare les deux peaux, et les deux manches", () => {
  let vus = 0;
  for (const code of CODES_GESTES) {
    const def = geste(code);
    for (const t of instantsDe(def).filter((_, k) => k % 2 === 0)) {
      const image = imageA(def, t, false);
      const [g, d] = [surfacesMain(image, "gauche"), surfacesMain(image, "droite")];
      const contours = (matiere) => trouverTous(trouverRole(image, "main-droite"), (x) => x.attributs["data-r"] === `contour-${matiere}-droite`);
      if (recouvre(d.peau, g.peau)) {
        vus++;
        assert.ok(contours("peau").some((x) => !traceVide(x.attributs.d)), `${code}, ${t.toFixed(3)} s : peau sur peau sans contour`);
      }
      if (recouvre(d.manche, g.manche)) {
        vus++;
        assert.ok(contours("manche").some((x) => !traceVide(x.attributs.d)), `${code}, ${t.toFixed(3)} s : manche sur manche sans contour`);
      }
    }
  }
  assert.ok(vus > 0, "aucun recouvrement vu : le contrôle ne contrôle rien");
});
