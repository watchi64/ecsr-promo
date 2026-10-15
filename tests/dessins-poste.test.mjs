import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-poste.js";
import { SOURCES } from "../sources/dessins-poste.js";
import { trouverRole, trouverTous, texteDe, parcourir } from "../js/dessin-svg.js";
import { CHARTE, COULEURS_VOYANTS, LARGEUR_TELEPHONE, TAILLE_TEXTE_MIN_PX } from "../js/dessins-kit.js";
import * as voyants from "../js/dessins-voyants.js";
import { PAS_IMAGE, SAUT_POINT_MAX, imageA, imageFigee, pointsDessines } from "../js/geste-regles.js";
import { verifierDessin, verifierGeste, formeArbre, boitesTextes } from "./aides-dessins.mjs";

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

const textesDe = (noeud) => trouverTous(noeud, (x) => x.balise === "text").map(texteDe).join(" ").toLocaleLowerCase("fr");

// Style schématique (décision du formateur du 15/10/2026) : chaque main est un repère, un disque marqué « G » ou « D ». Lecture
// d'un repère dans un dessin, autour du volant de centre (cx, cy) : son centre, son heure (12 en haut, de 0 à 12), sa distance au
// centre ; plein (disque du ton sombre de la peau, lettre claire) ou creux (disque du fond clair, lettre du ton de la peau) ; sa
// lettre, sa teinte et son opacité (celle de ses ancêtres dans le repère) ; la part de son remplissage, de 0 (creux) à 1 (plein),
// lue dans la teinte du disque.
function lireRepere(noeud, cote, [cx, cy]) {
  const m = trouverRole(noeud, `main-${cote}`);
  const [x, y] = [Number(m.attributs["data-x"]), Number(m.attributs["data-y"])];
  const disque = trouverRole(m, `disque-${cote}`), lettre = trouverRole(m, `lettre-${cote}`);
  const heure = ((((Math.atan2(x - cx, cy - y) * 6) / Math.PI) % 12) + 12) % 12;
  const opacite = opaciteDans(m, lettre);
  return { x, y, heure, distance: Math.hypot(x - cx, y - cy), noeud: m, lettre: texteDe(lettre), rayon: Number(disque.attributs.r),
    teinteDisque: disque.attributs.fill, teinteLettre: lettre.attributs.fill, opaciteLettre: opacite,
    plein: disque.attributs.fill === CHARTE.peauOmbre && lettre.attributs.fill === CHARTE.carte && opacite === 1,
    creux: disque.attributs.fill === CHARTE.carte && lettre.attributs.fill === CHARTE.peauOmbre && opacite === 1,
    remplissage: partEntre(disque.attributs.fill, CHARTE.carte, CHARTE.peauOmbre) };
}
// Opacité d'un nœud dans une racine : le produit des opacités du chemin qui y mène, lui compris.
function opaciteDans(racine, cible) {
  const chemin = (x) => {
    if (x === cible) return [x];
    for (const e of x.enfants || []) {
      if (typeof e === "string") continue;
      const suite = chemin(e);
      if (suite) return [x, ...suite];
    }
    return null;
  };
  return (chemin(racine) || []).reduce((o, x) => o * (x.attributs.opacity === undefined ? 1 : Number(x.attributs.opacity)), 1);
}
// Part du chemin de la couleur a à la couleur b où se trouve la couleur c (#RRGGBB), lue sur leurs trois composantes.
function partEntre(c, a, b) {
  const comp = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [cc, ca, cb] = [comp(c), comp(a), comp(b)];
  const parts = [0, 1, 2].filter((i) => ca[i] !== cb[i]).map((i) => (cc[i] - ca[i]) / (cb[i] - ca[i]));
  return parts.reduce((s, p) => s + p, 0) / parts.length;
}
const ecartHeure = (a, b) => Math.abs(((((a - b) % 12) + 18) % 12) - 6);
const centreVolant = (noeud) => {
  const v = trouverRole(noeud, "volant").attributs;
  return [Number(v["data-x"]), Number(v["data-y"]), Number(v["data-rayon"])];
};

test("mains-volant : deux volants, la position de référence (main gauche à 9 h, main droite à 3 h) puis la variante 10 h 10 (10 h et 2 h) ; les mains en repères G et D pleins, posés sur la jante, chaque position écrite sous son volant", () => {
  const d = famille.DESSINS["mains-volant"]();
  const attendu = [{ gauche: 9, droite: 3, legende: "9 h et 3 h" }, { gauche: 10, droite: 2, legende: "ou 10 h 10" }];
  attendu.forEach((a, i) => {
    const position = trouverRole(d, `position-${i + 1}`);
    assert.ok(position, `position ${i + 1}`);
    const [cx, cy, r] = centreVolant(position);
    for (const cote of ["gauche", "droite"]) {
      const rep = lireRepere(position, cote, [cx, cy]);
      assert.ok(ecartHeure(rep.heure, a[cote]) < 1e-6, `position ${i + 1}, main ${cote} à ${rep.heure.toFixed(3)} h au lieu de ${a[cote]} h`);
      assert.ok(Math.abs(rep.distance - r) < 1e-6, `position ${i + 1}, main ${cote} hors de la ligne médiane de la jante`);
      assert.ok(rep.plein, `position ${i + 1}, main ${cote} : elle tient la jante, repère plein`);
      assert.equal(rep.lettre, cote === "gauche" ? "G" : "D");
    }
    const legende = trouverRole(position, "legende");
    assert.equal(texteDe(legende), a.legende);
    assert.ok(Number(legende.attributs.y) > cy + r && Math.abs(Number(legende.attributs.x) - cx) < 1e-6, `légende ${i + 1} sous son volant`);
  });
  // Le volant de gauche est la référence, celui de droite la variante.
  assert.ok(centreVolant(trouverRole(d, "position-1"))[0] < centreVolant(trouverRole(d, "position-2"))[0]);
  // Plus aucun pouce dessiné, ni d'anneau qui le désigne : la règle des pouces reste dans le texte du cours.
  assert.equal(trouverTous(d, (x) => /pouce/.test(x.attributs["data-r"] || "")).length, 0);
  assert.ok(!textesDe(d).includes("pouce"));
});

test("mains-volant : « Midi » en haut de chaque volant, écrit dans sa couronne, entre le moyeu et le bord intérieur de la jante", () => {
  const d = famille.DESSINS["mains-volant"]();
  for (const i of [1, 2]) {
    const position = trouverRole(d, `position-${i}`), [cx, cy, r] = centreVolant(position);
    const e = r * famille.EPAISSEUR_JANTE, rMoyeu = Number(trouverRole(position, "moyeu").enfants[0].attributs.r);
    const midi = trouverRole(position, "midi");
    assert.equal(texteDe(midi), "Midi");
    const [b] = boitesTextes(midi);
    assert.ok(Math.abs((b.x1 + b.x2) / 2 - cx) < 1e-6, `volant ${i} : « Midi » centré au-dessus du centre`);
    assert.ok(b.y1 > cy - (r - e / 2) && b.y2 < cy - rMoyeu, `volant ${i} : « Midi » hors de la couronne (de ${b.y1.toFixed(1)} à ${b.y2.toFixed(1)})`);
    // Il ne touche ni un repère ni une branche : les branches sont à 3 h, 6 h et 9 h, le haut de la couronne est libre.
    for (const cote of ["gauche", "droite"]) {
      const rep = lireRepere(position, cote, [cx, cy]), lim = rep.rayon + CHARTE.liseres;
      assert.ok(rep.x + lim < b.x1 || rep.x - lim > b.x2 || rep.y + lim < b.y1 || rep.y - lim > b.y2, `volant ${i} : « Midi » sur le repère ${cote}`);
    }
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

test("volant schématique : la même jante, le même moyeu et les mêmes trois branches, à plat, sans reflet, d'une seule teinte", () => {
  for (const angle of [0, 75, -120]) {
    const plat = famille.volant({ cx: 120, cy: 90, rayon: 50, angle, schema: true }), detaille = famille.volant({ cx: 120, cy: 90, rayon: 50, angle });
    for (const role of ["reflet-jante", "reflet-moyeu"]) {
      assert.ok(trouverRole(detaille, role), `${role} du volant détaillé`);
      assert.equal(trouverRole(plat, role), null, `${role} dans le volant schématique`);
    }
    for (const role of ["volant", "volant-tournant", "jante", "moyeu", "branche-3", "branche-6", "branche-9"]) {
      assert.deepEqual(trouverRole(plat, role).attributs, trouverRole(detaille, role).attributs, `${role}, angle ${angle}`);
    }
    const teintes = new Set();
    parcourir(plat, (x) => { for (const k of ["fill", "stroke"]) if (x.attributs[k] && x.attributs[k] !== "none") teintes.add(x.attributs[k]); });
    assert.equal(teintes.size, 1, `teintes : ${[...teintes].join(", ")}`);
  }
});

// Pièces des repères des mains (style schématique), sur un volant d'essai à l'échelle des gestes.
const VOLANT_ESSAI = { cx: 160, cy: 100, rayon: 59.2 };
const LETTRE = { gauche: "G", droite: "D" };

test("repereMain : un disque G ou D posé sur la ligne médiane de la jante à son heure, ou déplacé vers le centre ; plein quand la main tient la jante, creux dès qu'elle la laisse glisser ou l'a lâchée ; mêmes nœuds dans tous les états", () => {
  const { cx, cy, rayon } = VOLANT_ESSAI;
  const forme = formeArbre(famille.repereMain({ ...VOLANT_ESSAI, heure: 9, cote: "gauche" }));
  let [pleins, creux, entre] = [0, 0, 0];
  for (const cote of ["gauche", "droite"]) {
    for (const heure of [0, 1.5, 2, 3, 9, 10, 13.25]) {
      for (const prise of [0, 0.25, 0.5, 0.75, 0.9, 1]) {
        for (const decalage of [0, 12]) {
          const quand = `${cote}, ${heure} h, prise ${prise}, décalage ${decalage}`;
          const noeud = famille.repereMain({ ...VOLANT_ESSAI, heure, cote, prise, decalage });
          const rep = lireRepere(noeud, cote, [cx, cy]);
          const [x, y] = famille.pointHeure(cx, cy, rayon - decalage, heure);
          assert.ok(Math.hypot(rep.x - x, rep.y - y) < 1e-9, `${quand} : repère hors de sa place`);
          // Disque, anneau et lettre centrés sur le repère ; la lettre est celle de la main.
          for (const role of ["liseret", "disque", "anneau"]) {
            const c = trouverRole(noeud, `${role}-${cote}`).attributs;
            assert.ok(Math.hypot(c.cx - x, c.cy - y) < 1e-9, `${quand} : ${role} décentré`);
          }
          const lettre = trouverRole(noeud, `lettre-${cote}`).attributs;
          assert.ok(Math.abs(lettre.x - x) < 1e-9 && lettre["text-anchor"] === "middle", `${quand} : lettre décentrée`);
          assert.equal(rep.lettre, LETTRE[cote]);
          assert.equal(trouverRole(noeud, `anneau-${cote}`).attributs.stroke, CHARTE.peauOmbre, `${quand} : anneau`);
          if (prise === 1) { pleins++; assert.ok(rep.plein, `${quand} : la main tient la jante, repère plein`); }
          else if (prise <= 0.5) { creux++; assert.ok(rep.creux, `${quand} : la main laisse glisser ou a lâché la jante, repère creux`); }
          else { entre++; assert.ok(!rep.plein && !rep.creux && rep.remplissage > 0 && rep.remplissage < 1, `${quand} : ni plein ni creux pendant le fondu`); }
          assert.equal(formeArbre(noeud), forme, `${quand} : d'autres nœuds`);
        }
      }
    }
  }
  assert.ok(pleins > 0 && creux > 0 && entre > 0);
});

test("repereMain : lisible sur un téléphone ; lettre de 11 px au moins, disque de 20 px au moins ; lettre claire sur le disque plein et lettre du ton de la peau sur le disque creux à 4,5:1 au moins (un texte), anneau à 3:1 sur le fond ; un liseré clair le borde, dessous", () => {
  const px = LARGEUR_TELEPHONE / 320;   // les cadres de C1.3 font 320 unités de large
  for (const prise of [1, 0.5, 0]) {
    const noeud = famille.repereMain({ ...VOLANT_ESSAI, heure: 3, cote: "droite", prise });
    const disque = trouverRole(noeud, "disque-droite").attributs, lettre = trouverRole(noeud, "lettre-droite").attributs;
    assert.ok(Number(lettre["font-size"]) * px >= TAILLE_TEXTE_MIN_PX, `lettre de ${(lettre["font-size"] * px).toFixed(1)} px`);
    assert.ok(2 * disque.r * px >= 20, `disque de ${(2 * disque.r * px).toFixed(1)} px`);
    assert.ok(contraste(lettre.fill, disque.fill) >= 4.5, `prise ${prise} : lettre à ${contraste(lettre.fill, disque.fill).toFixed(2)}:1 sur son disque`);
    const [liseret] = noeud.enfants;
    assert.ok(liseret.attributs["data-r"] === "liseret-droite" && liseret.attributs.fill === CHARTE.carte && liseret.attributs.r > disque.r,
      "le liseré clair, plus large que le disque, dessiné le premier");
  }
  assert.ok(contraste(CHARTE.peauOmbre, CHARTE.fond) >= 3, "anneau et disque plein sur le fond");
  assert.ok(contraste(CHARTE.peauOmbre, CHARTE.carte) >= 3, "anneau et disque plein sur la carte");
});

test("repereMain : un côté inconnu, une prise hors de 0 à 1, une heure non finie ou un décalage hors de la jante est une erreur, jamais un repère deviné", () => {
  const C = { ...VOLANT_ESSAI, heure: 9 };
  assert.throws(() => famille.repereMain({ ...C, cote: "Gauche" }), /côté « Gauche » inconnu/);
  assert.throws(() => famille.repereMain({ ...C, cote: "gauche", prise: 1.5 }), /prise/);
  assert.throws(() => famille.repereMain({ ...C, cote: "gauche", prise: -0.1 }), /prise/);
  assert.throws(() => famille.repereMain({ ...C, cote: "gauche", heure: Number.NaN }), /heure/);
  assert.throws(() => famille.repereMain({ ...C, cote: "gauche", decalage: -1 }), /décalage/);
  assert.throws(() => famille.repereMain({ ...C, cote: "gauche", decalage: VOLANT_ESSAI.rayon + 1 }), /décalage/);
});

// Points d'un tracé (couples de nombres, dans l'ordre) : exacts pour un polygone, points de contrôle compris pour une courbe.
const pointsDe = (d) => {
  const nombres = String(d).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g).map(Number);
  return Array.from({ length: nombres.length / 2 }, (_, i) => [nombres[2 * i], nombres[2 * i + 1]]);
};

// ===== Relecture de la tâche 6 : charte, peau, anneau, levier, contacteur, flèche =====

// Les dessins fixes, et les images figées de chaque étape des gestes (la peau et les traits s'y contrôlent aussi).
const DESSINS_POSTE = () => [...Object.entries(famille.DESSINS).map(([code, f]) => [code, f()]),
  ...Object.entries(famille.GESTES).flatMap(([code, g]) => { const def = g.construire(); return def.etapes.map((_, i) => [`${code} étape ${i + 1}`, imageFigee(def, i)]); })];

test("poste : traits pris dans le jeu de quatre de la charte, liserés clairs à part, volant à tout angle, détaillé ou schématique, et repères à toute prise", () => {
  const jeu = Object.values(CHARTE.traits);
  const liseres = new Set([2 * CHARTE.liseres, ...jeu.map((t) => t + 2 * CHARTE.liseres)]);
  const pieces = [famille.volant({ cx: 160, cy: 100, rayon: 50, angle: 37 }), famille.volant({ cx: 160, cy: 100, rayon: 30, avertisseur: true }),
    famille.volant({ cx: 160, cy: 100, rayon: 50, angle: 37, schema: true }),
    ...[0, 0.5, 0.75, 1].map((prise) => famille.repereMain({ ...VOLANT_ESSAI, heure: 11, cote: "droite", prise, decalage: 6 }))];
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

test("poste : la peau n'a qu'un ton, le sombre de la charte, et seulement dans les repères des mains, avec le fond clair ; ni sur les dessins fixes ni sur les images figées, aucune autre teinte n'y entre", () => {
  const peau = new Set([CHARTE.peau, CHARTE.peauOmbre]), dansRepere = new Set([CHARTE.peauOmbre, CHARTE.carte]);
  let reperes = 0;
  for (const [code, d] of DESSINS_POSTE()) {
    const dansMain = new Set();
    for (const m of trouverTous(d, (x) => /^main-/.test(x.attributs["data-r"] || ""))) { reperes++; parcourir(m, (x) => dansMain.add(x)); }
    parcourir(d, (x) => {
      for (const k of ["fill", "stroke"]) {
        const c = x.attributs[k];
        if (!c || c === "none") continue;
        if (dansMain.has(x)) assert.ok(dansRepere.has(c), `${code} : ${k} ${c} dans un repère`);
        else assert.ok(!peau.has(c), `${code} : peau ${c} hors d'un repère (${x.balise} ${x.attributs["data-r"] || ""})`);
      }
    });
  }
  assert.ok(reperes >= 4 + 2 * 10, `${reperes} repères vus`);
});

// Luminance relative (WCAG) d'une couleur #RRGGBB, et contraste de deux couleurs.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("poste-commandes : le symbole des feux de détresse est du rouge normalisé des voyants, lisible sur sa commande sombre", () => {
  const bouton = trouverRole(famille.DESSINS["poste-commandes"](), "feux-detresse");
  const fond = bouton.enfants[0].attributs.fill;
  const traits = trouverTous(bouton, (x) => x.balise === "path" && x.attributs.fill === "none").map((x) => x.attributs.stroke);
  assert.deepEqual(traits, [COULEURS_VOYANTS.rouge, COULEURS_VOYANTS.rouge], "les deux triangles, du rouge des voyants");
  // Le même rouge que celui des voyants rouges du dessin « voyants » (huile, freinage...).
  assert.equal(voyants.COULEURS_VOYANTS.rouge, COULEURS_VOYANTS.rouge);
  assert.ok(contraste(COULEURS_VOYANTS.rouge, fond) >= 3, `contraste de ${contraste(COULEURS_VOYANTS.rouge, fond).toFixed(2)} sur la commande`);
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
  // Traction d'un quart de tour au plus (remarque du formateur du 15/10/2026 : « pas plus de 90 degrés, de petits gestes pour
  // être précis »), et assez grande pour se lire : au moins 60 degrés, deux heures de cadran parcourues par le repère D.
  const angles = instantsDe(def).map((t) => def.etat(t).volant);
  assert.ok(Math.max(...angles) <= 90 + 1e-9, `volant tourné jusqu'à ${Math.max(...angles).toFixed(1)} degrés, plus d'un quart de tour`);
  assert.ok(fin.volant >= 60, `traction de ${fin.volant.toFixed(1)} degrés : moins de 60, elle se lit mal`);
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

// Une main qui tient la jante tourne avec elle ; l'avant-bras ne tourne sur lui-même que d'environ 160 degrés, l'épaule et le
// poignet accompagnant sa rotation : un demi-tour environ, au-delà duquel la main doit lâcher la jante (raison et source dans
// les choix de dessin des gestes).
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

// Repères des mains (main-gauche, main-droite) et branches du volant : des points dessinés (data-x, data-y), affichés à chaque
// image. Le contrôle commun des gestes (js/geste-regles.js, par verifierGeste) les suit d'une image de lecture à la suivante
// (SAUT_POINT_MAX, 8 unités par image) et vérifie qu'une image figée est l'image de l'animation au même instant, au seul
// affichage du groupe des flèches près ; ce test garde qu'ils sont bien là pour être suivis.
const ROLE_POINT = /^main-(gauche|droite)$|^branche-\d+$/;
test("gestes du volant : repères des mains et branches du volant sont des points dessinés, suivis par le contrôle commun de continuité", () => {
  for (const code of CODES_GESTES) {
    const def = geste(code);
    for (const t of instantsDe(def)) {
      const roles = [...pointsDessines(imageA(def, t, false)).values()].map((p) => p.role).filter((r) => ROLE_POINT.test(r));
      assert.equal(new Set(roles).size, 2 + 3, `${code} : points dessinés absents à ${t.toFixed(3)} s`);
    }
  }
});

test("gestes du volant : à chaque image, chaque repère est dessiné là où l'état met la main, sur la jante à son heure ou en l'air, déplacé vers le centre ; plein quand elle tient la jante, creux dès qu'elle la laisse glisser ou l'a lâchée", () => {
  const { cx, cy, rayon, echelle } = famille.repereGeste();
  let [pleins, creux, enLAir] = [0, 0, 0];
  for (const code of CODES_GESTES) {
    const def = geste(code);
    for (const t of instantsDe(def)) {
      const e = def.etat(t), image = imageA(def, t, false), quand = `${code}, ${t.toFixed(3)} s`;
      for (const cote of COTES_MAINS) {
        const m = e.mains[cote], rep = lireRepere(image, cote, [cx, cy]);
        const [x, y] = famille.pointHeure(cx, cy, rayon - m.decalage * echelle, m.heure);
        assert.ok(Math.hypot(rep.x - x, rep.y - y) < 1e-6, `${quand} : repère ${cote} à ${Math.hypot(rep.x - x, rep.y - y).toFixed(2)} unités de la main`);
        if (m.decalage > 0) enLAir++;
        if (m.prise === 1) { pleins++; assert.ok(rep.plein, `${quand} : la main ${cote} tient la jante, repère creux`); }
        if (m.prise <= 0.5) { creux++; assert.ok(rep.creux, `${quand} : la main ${cote} laisse glisser ou a lâché la jante, repère plein`); }
      }
    }
  }
  assert.ok(pleins > 0 && creux > 0 && enLAir > 0, `${pleins} pleins, ${creux} creux, ${enLAir} en l'air`);
});

test("gestes du volant, lus dans le dessin seul : un repère plein tourne avec la jante, du même angle que les branches du volant, sans la quitter ; un repère posé sur la jante qui n'est pas plein ne bouge pas pendant que le volant tourne (la jante glisse dessous)", () => {
  const { cx, cy, rayon } = famille.repereGeste();
  const angle = ([x, y]) => (Math.atan2(x - cx, cy - y) * 180) / Math.PI;   // degrés, sens horaire depuis midi
  const ecart = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;
  const branche = (image) => { const b = trouverRole(image, "branche-3").attributs; return angle([b["data-x"], b["data-y"]]); };
  let [tournent, restent] = [0, 0];
  for (const code of CODES_GESTES) {
    const def = geste(code), ts = instantsDe(def);
    let avant = imageA(def, 0, false);
    for (let i = 1; i < ts.length; i++) {
      const apres = imageA(def, ts[i], false), quand = `${code}, ${ts[i].toFixed(3)} s`;
      const tour = ecart(branche(avant), branche(apres));
      for (const cote of COTES_MAINS) {
        const [a, b] = [lireRepere(avant, cote, [cx, cy]), lireRepere(apres, cote, [cx, cy])];
        if (a.plein && b.plein) {
          assert.ok(Math.abs(ecart(angle([a.x, a.y]), angle([b.x, b.y])) - tour) < 1e-6, `${quand} : repère ${cote} plein qui glisse sur la jante`);
          assert.ok(Math.abs(b.distance - rayon) < 1e-6, `${quand} : repère ${cote} plein hors de la jante`);
          if (Math.abs(tour) > 1e-9) tournent++;
        } else if (!a.plein && !b.plein && Math.abs(tour) > 1e-9 && Math.abs(a.distance - rayon) < 1e-6) {
          // (une main en l'air, qui a quitté la jante, se déplace pendant que l'autre tourne le volant : elle n'est pas posée)
          assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 1e-9, `${quand} : repère ${cote} posé, pas plein, qui bouge pendant que le volant tourne`);
          restent++;
        }
      }
      avant = apres;
    }
  }
  assert.ok(tournent > 0 && restent > 0, `${tournent} images d'un repère qui tourne avec la jante, ${restent} d'un repère qui reste`);
});

// Image figée de chaque étape, à l'instant où elle commence (pas à pas, pause, animations réduites) : angle du volant, puis, pour
// chaque main, son heure et son repère, plein ou creux.
const FIGEES = {
  "tirer-glisser": [
    { volant: 0, gauche: [9, "plein"], droite: [3, "plein"] },
    { volant: 0, gauche: [9, "creux"], droite: [0, "plein"] },
  ],
  chevauchement: [
    { volant: 0, gauche: [9, "plein"], droite: [3, "plein"] },
    { volant: 0, gauche: [9, "plein"], droite: [0, "plein"] },
    { volant: 90, gauche: [0, "plein"], droite: [3, "plein"] },
    { volant: 180, gauche: [3, "plein"], droite: [0, "creux"] },
  ],
  "retour-volant": [
    { volant: 180, gauche: [9, "plein"], droite: [3, "plein"] },
    { volant: 180, gauche: [9, "creux"], droite: [3, "creux"] },
    { volant: 0, gauche: [9, "creux"], droite: [3, "creux"] },
    { volant: 90, gauche: [0, "creux"], droite: [6, "creux"] },
  ],
};
test("gestes du volant : l'image figée de chaque étape (pas à pas, pause, animations réduites) montre le volant à son angle, chaque repère sur la jante à son heure, plein ou creux, et la flèche de l'étape", () => {
  const { cx, cy, rayon } = famille.repereGeste();
  for (const code of CODES_GESTES) {
    const def = geste(code);
    assert.equal(def.etapes.length, FIGEES[code].length, code);
    FIGEES[code].forEach((attendu, i) => {
      const image = imageFigee(def, i), quand = `${code}, étape ${i + 1}`;
      assert.equal(Number(trouverRole(image, "volant").attributs["data-angle"]), attendu.volant, `${quand} : volant`);
      assert.equal(texteDe(trouverRole(image, "compteur")), `${attendu.volant}°`, `${quand} : compteur`);
      for (const cote of COTES_MAINS) {
        const [heure, etat] = attendu[cote], rep = lireRepere(image, cote, [cx, cy]);
        assert.ok(ecartHeure(rep.heure, heure) < 0.01 && Math.abs(rep.distance - rayon) < 1e-6, `${quand} : main ${cote} à ${rep.heure.toFixed(2)} h`);
        assert.ok(rep[etat], `${quand} : main ${cote} ${etat === "plein" ? "creuse" : "pleine"}`);
      }
      assert.equal(trouverRole(image, "fleche").attributs.display, "inline", `${quand} : flèche masquée`);
    });
  }
});

// Le chevauchement : la main du côté du virage, la droite, passe par-dessus la gauche (étape 3) ; la gauche remonte sous la droite
// (étape 4). Les deux repères se recouvrent alors, la droite dessinée au-dessus, d'au moins 4 unités (4 px sur un téléphone) ;
// leurs lettres, jamais (CROISEMENT, et le test qui suit).
const CROISEMENT = { recouvrementMin: 4 };
test("chevauchement : la droite passe par-dessus la gauche (étape 3), la gauche remonte sous la droite (étape 4) : leurs disques se recouvrent, D toujours dessiné au-dessus de G, la main qui remonte creuse et celle qui tire pleine", () => {
  const def = geste("chevauchement"), [T3, T4] = [def.etapes[2].t, def.etapes[3].t], { cx, cy } = famille.repereGeste();
  let [dessus, dessous] = [0, 0];
  for (const t of instantsDe(def)) {
    const image = imageA(def, t, false), quand = `${t.toFixed(3)} s`;
    const [g, d] = [trouverRole(image, "main-gauche"), trouverRole(image, "main-droite")];
    const freres = trouverTous(image, (x) => x.enfants.includes(d))[0].enfants;
    assert.ok(freres.includes(g) && freres.indexOf(g) < freres.indexOf(d), `${quand} : G dessiné au-dessus de D`);
    const [rg, rd] = [lireRepere(image, "gauche", [cx, cy]), lireRepere(image, "droite", [cx, cy])];
    const recouvrement = rg.rayon + rd.rayon - Math.hypot(rg.x - rd.x, rg.y - rd.y);
    if (recouvrement <= 0) continue;
    if (t >= T3 && t < T4) {
      assert.ok(rd.creux && rg.plein, `${quand} : à l'étape 3, la droite remonte creuse par-dessus la gauche qui tire`);
      dessus = Math.max(dessus, recouvrement);
    } else if (t >= T4) {
      assert.ok(rg.creux && rd.plein, `${quand} : à l'étape 4, la gauche remonte creuse sous la droite qui tire`);
      dessous = Math.max(dessous, recouvrement);
    } else assert.fail(`${quand} : repères qui se recouvrent hors du croisement`);
  }
  assert.ok(dessus >= CROISEMENT.recouvrementMin, `étape 3 : la droite ne passe sur la gauche que de ${dessus.toFixed(1)} unités`);
  assert.ok(dessous >= CROISEMENT.recouvrementMin, `étape 4 : la gauche ne passe sous la droite que de ${dessous.toFixed(1)} unités`);
});

test("gestes du volant : les lettres G et D ne se recouvrent jamais, à aucune image (la lettre d'un repère se lit, même quand l'autre passe dessus)", () => {
  let plusPres = Infinity;
  for (const code of CODES_GESTES) {
    const def = geste(code);
    for (const t of instantsDe(def)) {
      const image = imageA(def, t, false);
      const [a] = boitesTextes(trouverRole(image, "lettre-gauche")), [b] = boitesTextes(trouverRole(image, "lettre-droite"));
      // La règle des contrôles communs (tests/aides-dessins.mjs) : deux boîtes se chevauchent au-delà d'une demi-unité dans les deux sens.
      const [dx, dy] = [Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)];
      assert.ok(!(dx > 0.5 && dy > 0.5), `${code}, ${t.toFixed(3)} s : lettres G et D qui se recouvrent`);
      plusPres = Math.min(plusPres, Math.max(-dx, -dy));
    }
  }
  assert.ok(Number.isFinite(plusPres));
});

test("gestes du volant : un repère passe de plein à creux, ou l'inverse, en fondu (sur 4 images au moins, jamais d'une image à l'autre), et il ne saute pas : 8 unités par image au plus", () => {
  const { cx, cy } = famille.repereGeste();
  const PART_MAX = 0.3;   // part du remplissage qui change en une image : au moins quatre images par fondu
  let fondus = 0;
  for (const code of CODES_GESTES) {
    const def = geste(code), ts = instantsDe(def);
    let avant = imageA(def, 0, false);
    for (let i = 1; i < ts.length; i++) {
      const apres = imageA(def, ts[i], false), quand = `${code}, ${ts[i].toFixed(3)} s`;
      for (const cote of COTES_MAINS) {
        const [a, b] = [lireRepere(avant, cote, [cx, cy]), lireRepere(apres, cote, [cx, cy])];
        const change = Math.abs(b.remplissage - a.remplissage);
        assert.ok(change <= PART_MAX + 1e-9, `${quand} : repère ${cote} rempli de ${a.remplissage.toFixed(2)} puis ${b.remplissage.toFixed(2)}`);
        assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= SAUT_POINT_MAX, `${quand} : repère ${cote} qui saute`);
        if (change > 0.01) fondus++;
      }
      avant = apres;
    }
  }
  assert.ok(fondus > 0, "aucun fondu vu : le contrôle ne contrôle rien");
});

// Pendant un fondu, le disque passe par des teintes mêlées : la lettre ne doit jamais s'y perdre. À demi visible ou plus, elle a
// sur son disque un contraste de 3:1 au moins (celui d'un élément graphique) ; plein ou creux, 4,5:1 (test de repereMain).
test("repères : la lettre se lit à chaque image, même pendant le fondu ; à demi visible ou plus, elle a 3:1 au moins sur son disque", () => {
  const verifier = (rep, quand) => {
    if (rep.opaciteLettre < 0.5) return;
    const c = contraste(rep.teinteLettre, rep.teinteDisque);
    assert.ok(c >= 3, `${quand} : lettre ${rep.lettre} à ${c.toFixed(2)}:1 sur son disque, opacité ${rep.opaciteLettre.toFixed(2)}`);
  };
  for (let p = 0; p <= 100; p++) {
    const noeud = famille.repereMain({ ...VOLANT_ESSAI, heure: 3, cote: "droite", prise: p / 100 });
    verifier(lireRepere(noeud, "droite", [VOLANT_ESSAI.cx, VOLANT_ESSAI.cy]), `prise ${p / 100}`);
  }
  const { cx, cy } = famille.repereGeste();
  let fondus = 0;
  for (const code of CODES_GESTES) {
    const def = geste(code);
    for (const t of instantsDe(def)) {
      const image = imageA(def, t, false);
      for (const cote of COTES_MAINS) {
        const rep = lireRepere(image, cote, [cx, cy]);
        verifier(rep, `${code}, ${t.toFixed(3)} s, main ${cote}`);
        if (rep.remplissage > 0.01 && rep.remplissage < 0.99) fondus++;
      }
    }
  }
  assert.ok(fondus > 0, "aucun fondu vu : le contrôle ne contrôle rien");
});

test("gestes du volant : les flèches de l'image figée passent sous les repères, et la pointe de chacune se voit, hors de leurs disques et de leurs liserés", () => {
  const { cx, cy } = famille.repereGeste();
  let pointes = 0;
  for (const code of CODES_GESTES) {
    const def = geste(code);
    def.etapes.forEach((_, i) => {
      const image = imageFigee(def, i), quand = `${code}, étape ${i + 1}`;
      const rang = (role) => image.enfants.findIndex((x) => typeof x !== "string" && x.attributs["data-r"] === role);
      assert.ok(rang("fleche") >= 0 && rang("fleche") < rang("main-gauche") && rang("main-gauche") < rang("main-droite"), `${quand} : rangs`);
      const reperes = COTES_MAINS.map((cote) => lireRepere(image, cote, [cx, cy]));
      for (const f of trouverTous(trouverRole(image, "fleche"), (x) => /^fleche-\d+$/.test(x.attributs["data-r"] || "") && x.attributs.display !== "none")) {
        for (const p of pointsDe(trouverRole(f, "fleche-tete").attributs.d)) {
          for (const r of reperes) {
            assert.ok(Math.hypot(p[0] - r.x, p[1] - r.y) > r.rayon + CHARTE.liseres, `${quand} : pointe de ${f.attributs["data-r"]} cachée sous un repère`);
          }
          pointes++;
        }
      }
    });
  }
  assert.ok(pointes > 0);
});

// Remarque du formateur du 15/10/2026 sur le tirer-glisser : « la petite flèche sur la main gauche n'est pas utile et peut porter à
// confusion ». La jante qui glisse dans une main se lit à son repère creux : aucune flèche ne court sur la ligne médiane de la jante
// (là où passait celle de la jante qui glisse, dans le tirer-glisser et à l'étape 1 du retour du volant) ; les flèches des mains et
// du volant qui revient passent au-delà des repères, celle d'une main qui remonte en dedans de la jante.
test("gestes du volant : aucune flèche sur la jante, au droit des mains : le repère creux dit seul que la jante glisse", () => {
  const { cx, cy, rayon } = famille.repereGeste();
  for (const code of CODES_GESTES) {
    const def = geste(code);
    def.etapes.forEach((_, i) => {
      const fleches = trouverTous(trouverRole(imageFigee(def, i), "fleche"), (x) => /^fleche-\d+$/.test(x.attributs["data-r"] || "")
        && x.attributs.display !== "none");
      for (const f of fleches) {
        const trait = pointsDe(trouverRole(f, "fleche-trait").attributs.d), [pointe] = pointsDe(trouverRole(f, "fleche-tete").attributs.d);
        const surJante = [trait[0], pointe].filter((p) => Math.abs(Math.hypot(p[0] - cx, p[1] - cy) - rayon) < 0.05);
        assert.equal(surJante.length, 0, `${code}, étape ${i + 1} : ${f.attributs["data-r"]} court sur la ligne médiane de la jante`);
      }
    });
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
const trouve = (fleches, { de, a, sens, tolerance }) => fleches.some((f) => procheHeure(f.queue, de, tolerance) && procheHeure(f.pointe, a, tolerance)
  && f.sens === sens);

test("gestes du volant : les flèches de chaque étape montrent le mouvement qu'elle décrit", () => {
  const tg = geste("tirer-glisser");
  assert.ok(trouve(flechesEtape(tg, 0), { de: 3, a: 0, sens: -1 }), "tirer-glisser, étape 1 : la droite monte de 3 h à midi");
  assert.ok(trouve(flechesEtape(tg, 1), { de: 0, a: 3, sens: 1 }), "tirer-glisser, étape 2 : la droite tire de midi à 3 h");
  assert.equal(flechesEtape(tg, 1).length, 1, "tirer-glisser, étape 2 : la seule traction ; la jante qui glisse dans la gauche se lit à son repère creux");
  const ch = geste("chevauchement");
  assert.ok(trouve(flechesEtape(ch, 0), { de: 3, a: 0, sens: -1 }), "chevauchement, étape 1 : la droite monte à midi");
  assert.ok(trouve(flechesEtape(ch, 1), { de: 0, a: 3, sens: 1 }) && trouve(flechesEtape(ch, 1), { de: 9, a: 0, sens: 1 }),
    "chevauchement, étape 2 : la droite tire jusqu'à 3 h, la gauche suit de 9 h à midi");
  // La flèche de la main qui remonte part du bord de son repère, à 3 h (vers 2 h 37), et s'arrête avant le repère qui est à midi au
  // début de l'étape (vers 0 h 23) : elle va de 3 h vers midi, en dedans de la jante.
  const remonte = { de: 2.61, a: 0.39, sens: -1, tolerance: 0.05 };
  assert.ok(trouve(flechesEtape(ch, 2), { de: 0, a: 3, sens: 1 }) && trouve(flechesEtape(ch, 2), remonte),
    "chevauchement, étape 3 : la gauche tire de midi à 3 h, la droite remonte de 3 h vers midi");
  assert.ok(trouve(flechesEtape(ch, 3), { de: 0, a: 3, sens: 1 }) && trouve(flechesEtape(ch, 3), remonte),
    "chevauchement, étape 4 : la droite tire de midi à 3 h, la gauche remonte de 3 h vers midi");
  const rv = geste("retour-volant");
  assert.equal(flechesEtape(rv, 0).length, 0, "retour-volant, étape 1 : aucune flèche, les repères creux disent que la jante glisse");
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

// Chaque étape où les mains tournent le volant (prise pleine des deux mains pendant qu'il tourne) les nomme dans son intitulé
// modèle : l'image figée de l'étape 3 montre des mains qui braquent, que « À basse allure, il ne revient pas seul » ne disait pas
// (relecture finale du lot D1, m3 ; contrôle du lot, I3).
test("retour-volant : l'intitulé modèle de chaque étape où les mains tournent le volant les nomme", () => {
  const def = famille.GESTES["retour-volant"].construire();
  const bornes = [...def.etapes.map((e) => e.t), def.duree];
  const intitules = CATALOGUE["retour-volant"].etapesModele;
  let etapesTournees = 0;
  intitules.forEach((intitule, i) => {
    let tournent = false;
    for (let t = bornes[i]; t + PAS_IMAGE <= bornes[i + 1]; t += PAS_IMAGE) {
      const a = def.etat(t), b = def.etat(t + PAS_IMAGE);
      if (Math.abs(b.volant - a.volant) > 1e-9 && a.mains.gauche.prise === 1 && a.mains.droite.prise === 1) tournent = true;
    }
    if (!tournent) return;
    etapesTournees++;
    assert.match(intitule, /\bmains\b/i, `étape ${i + 1} : « ${intitule} »`);
  });
  assert.equal(etapesTournees, 2, "les mains tournent le volant aux étapes 3 et 4");
});
