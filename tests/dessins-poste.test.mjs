import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-poste.js";
import { SOURCES } from "../sources/dessins-poste.js";
import { trouverRole, trouverTous, texteDe, parcourir } from "../js/dessin-svg.js";
import { CHARTE } from "../js/dessins-kit.js";
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

test("main : la prise se voit, doigts refermés sur la jante (prise 1) ; main ouverte (prise 0), doigts cachés et main écartée de la jante", () => {
  const C = { cx: 160, cy: 100, rayon: 50, heure: 9, cote: "gauche" };
  const e = C.rayon * famille.EPAISSEUR_JANTE;
  assert.equal(trouverRole(famille.main({ ...C, prise: 1 }), "doigts-gauche").attributs.display, "inline");
  const ouverte = famille.main({ ...C, prise: 0 });
  assert.equal(trouverRole(ouverte, "doigts-gauche").attributs.display, "none");
  const pouce = trouverRole(ouverte, "pouce-gauche").attributs;
  assert.ok(Math.hypot(pouce["data-x"] - C.cx, pouce["data-y"] - C.cy) > C.rayon + e / 2, "main ouverte : le pouce a quitté la jante");
});

test("main : un côté, un pouce ou une prise hors de leurs valeurs est une erreur, jamais un choix par défaut", () => {
  const C = { cx: 160, cy: 100, rayon: 50, heure: 9 };
  assert.throws(() => famille.main({ ...C, cote: "Gauche" }), /côté « Gauche » inconnu/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", pouce: "dedans" }), /pouce « dedans » inconnu/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", prise: 1.5 }), /prise/);
  assert.throws(() => famille.main({ ...C, cote: "gauche", heure: Number.NaN }), /heure/);
});

// ===== Relecture de la tâche 6 : charte, peau, anneau, levier, contacteur, flèche =====

const DESSINS_POSTE = () => codes.map((code) => [code, famille.DESSINS[code]()]);

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
