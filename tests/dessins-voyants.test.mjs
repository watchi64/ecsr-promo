import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-voyants.js";
import { SOURCES } from "../sources/dessins-voyants.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { PAS_IMAGE, imageFigee } from "../js/geste-regles.js";

const codes = Object.keys(CATALOGUE).filter((c) => CATALOGUE[c].module === "voyants");

test("voyants : chaque code du catalogue est dessiné et passe les contrôles communs", () => {
  for (const code of codes) {
    const e = CATALOGUE[code];
    if (e.bloc === "dessin") assert.deepEqual(verifierDessin(famille.DESSINS[code](), e.cadre), [], code);
    else assert.deepEqual(verifierGeste(famille.GESTES[code].construire(), e), [], code);
  }
  const fournis = [...Object.keys(famille.DESSINS), ...Object.keys(famille.GESTES || {})].sort();
  assert.deepEqual(fournis, [...codes].sort());
});

test("voyants : chaque dessin a ses sources, dont ses choix de dessin", () => {
  for (const code of codes) {
    assert.ok(Array.isArray(SOURCES[code]) && SOURCES[code].length >= 2, code);
    assert.ok(SOURCES[code].some((s) => s.startsWith("Choix de dessin")), code);
  }
});

// Le tableau « Les voyants » du cours C1.1 : la couleur de chacun des douze voyants.
const COULEURS_DU_COURS = {
  rouge: ["huile", "temperature", "freinage", "batterie", "airbag"],
  orange: ["abs", "pneus", "prechauffage", "reserve"],
  vert: ["clignotants", "croisement"],
  bleu: ["route"],
};
const GROUPES = { rouge: ["rouge"], orange: ["orange"], "vert-bleu": ["vert", "bleu"] };
const role = (x) => x.attributs["data-r"] || "";
// Teintes peintes par un nœud et ses descendants (remplissage et trait, « none » exclu).
const teintes = (noeud) => {
  const vues = new Set();
  for (const x of trouverTous(noeud, () => true)) {
    for (const k of ["fill", "stroke"]) if (x.attributs[k] !== undefined && x.attributs[k] !== "none") vues.add(x.attributs[k]);
  }
  return [...vues];
};

test("voyants : les douze voyants du cours, chacun dans le groupe de sa couleur, tracé à la couleur normalisée et nommé", () => {
  const d = famille.DESSINS.voyants();
  const noms = Object.values(COULEURS_DU_COURS).flat();
  assert.equal(noms.length, 12);
  assert.deepEqual(Object.keys(famille.COULEUR_DE).sort(), [...noms].sort());
  for (const [couleur, liste] of Object.entries(COULEURS_DU_COURS)) {
    for (const nom of liste) {
      assert.equal(famille.COULEUR_DE[nom], couleur, nom);
      const v = trouverRole(d, `voyant-${nom}`);
      assert.ok(v, `voyant-${nom} absent`);
      assert.equal(v.attributs["data-couleur"], couleur, nom);
      assert.deepEqual(teintes(trouverRole(v, `picto-${nom}`)), [famille.COULEURS_VOYANTS[couleur]], nom);
      assert.ok(trouverTous(v, (x) => x.balise === "text").map(texteDe).join(" ").trim().length > 0, `${nom} sans nom`);
    }
  }
  // Le seul voyant bleu est dit bleu, comme dans le tableau du cours : la couleur ne porte pas seule l'information.
  assert.match(trouverTous(trouverRole(d, "voyant-route"), (x) => x.balise === "text").map(texteDe).join(" "), /\(bleu\)/);
  for (const [cle, couleurs] of Object.entries(GROUPES)) {
    const g = trouverRole(d, `groupe-${cle}`);
    assert.ok(g, `groupe-${cle} absent`);
    const contenus = trouverTous(g, (x) => /^voyant-/.test(role(x))).map((x) => role(x).slice("voyant-".length)).sort();
    assert.deepEqual(contenus, couleurs.flatMap((c) => COULEURS_DU_COURS[c]).sort(), cle);
  }
});

test("voyants : chaque groupe nomme sa couleur et dit, mot pour mot, la conduite à tenir du cours", () => {
  const d = famille.DESSINS.voyants();
  const attendu = {
    rouge: ["Rouge", "S'arrêter dès que possible en sécurité, couper le moteur"],
    orange: ["Orange", "Poursuivre prudemment, faire contrôler sans attendre"],
    "vert-bleu": ["Vert ou bleu", "Aucune action"],
  };
  for (const [cle, [nom, conduite]] of Object.entries(attendu)) {
    const g = trouverRole(d, `groupe-${cle}`);
    assert.equal(texteDe(trouverRole(g, `couleur-${cle}`)), nom, cle);
    const lignes = trouverTous(trouverRole(g, `conduite-${cle}`), (x) => x.balise === "text").map(texteDe);
    assert.equal(lignes.join(" "), conduite, cle);
  }
});

// Sens des symboles de la norme (ISO 7000, dessins de référence cités dans les sources) : un pictogramme retourné en miroir
// ou aux signes inversés ne serait plus le symbole normalisé.
test("pictogrammes : chaque symbole est orienté comme celui de la norme", () => {
  const picto = (nom) => famille.pictogramme(nom, { x: 50, y: 50, taille: 40, couleur: famille.COULEURS_VOYANTS[famille.COULEUR_DE[nom]] });
  const lire = (noeud, r, k = "data-x") => Number(trouverRole(noeud, r).attributs[k]);
  // Batterie : moins à gauche, plus à droite.
  const batterie = picto("batterie");
  assert.ok(lire(batterie, "moins") < lire(batterie, "plus"));
  // Airbag : l'occupant regarde à gauche, le coussin devant lui.
  const airbag = picto("airbag");
  assert.ok(lire(airbag, "coussin") < lire(airbag, "tete"));
  // Huile : la burette verse à droite, la goutte tombe sous la pointe du bec.
  const huile = picto("huile");
  assert.ok(lire(huile, "bec") > lire(huile, "couvercle"));
  assert.ok(Math.abs(lire(huile, "goutte") - lire(huile, "bec")) < 0.05 * 40);
  assert.ok(lire(huile, "goutte", "data-y") > lire(huile, "bec", "data-y"));
  // Carburant : le tuyau et le pistolet à droite de la pompe.
  const reserve = picto("reserve");
  assert.ok(lire(reserve, "tuyau") > lire(reserve, "colonne"));
  // Feux : faisceaux à gauche de la lampe ; croisement, inclinés vers le bas en s'éloignant ; route, horizontaux.
  for (const [nom, incline] of [["croisement", true], ["route", false]]) {
    const p = picto(nom);
    const faisceaux = trouverTous(p, (x) => role(x) === "faisceau");
    assert.ok(faisceaux.length === 4 || faisceaux.length === 5, nom);
    for (const f of faisceaux) {
      assert.ok(Number(f.attributs["data-x"]) < lire(p, "lampe"), nom);
      if (incline) assert.ok(Number(f.attributs["data-chute"]) > 0, nom);
      else assert.equal(Number(f.attributs["data-chute"]), 0, nom);
    }
  }
  // Clignotants : deux flèches, chacune pointée vers l'extérieur.
  const cligno = picto("clignotants");
  assert.ok(lire(cligno, "cligno-gauche", "data-pointe") < lire(cligno, "cligno-gauche"));
  assert.ok(lire(cligno, "cligno-droite", "data-pointe") > lire(cligno, "cligno-droite"));
});

// Teinte (degrés) et luminance relative (WCAG) d'une couleur #RRGGBB.
function teinte(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function luminance(hex) {
  const lineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lineaire(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("couleurs des voyants : les quatre de la norme, lisibles allumées sur la tuile sombre", () => {
  const bornes = { rouge: [-10, 10], orange: [30, 45], vert: [120, 150], bleu: [205, 230] };
  assert.deepEqual(Object.keys(famille.COULEURS_VOYANTS).sort(), Object.keys(bornes).sort());
  for (const [nom, [min, max]] of Object.entries(bornes)) {
    const c = famille.COULEURS_VOYANTS[nom];
    assert.match(c, /^#[0-9A-F]{6}$/i, nom);
    let h = teinte(c);
    if (h > 180 && min < 0) h -= 360;
    assert.ok(h >= min && h <= max, `${nom} : teinte de ${h.toFixed(0)} degrés`);
    assert.ok(contraste(c, famille.TABLEAU.fond) >= 3, `${nom} : contraste de ${contraste(c, famille.TABLEAU.fond).toFixed(2)}`);
  }
});

// L'autotest, échantillonné image par image comme le moteur le joue.
const geste = () => famille.GESTES.autotest.construire();
const SIX = ["abs", "airbag", "batterie", "huile", "pneus", "temperature"];
function echantillonner(def, visite) {
  for (let k = 0; ; k++) {
    const t = Math.min(def.duree, k * PAS_IMAGE);
    visite(t, def.etat(t));
    if (t >= def.duree) return;
  }
}

test("autotest : les six voyants au contact, huile et charge jusqu'au démarrage du moteur, plus aucun ensuite", () => {
  const def = geste();
  const [, debut2, debut3] = def.etapes.map((e) => e.t);
  const allumes = (t) => [...def.etat(t).allumes].sort();
  assert.deepEqual(allumes(0), SIX);
  assert.deepEqual(allumes(PAS_IMAGE), SIX);                       // juste après le début
  for (const nom of SIX) assert.equal(def.etat(0).voyants[nom], 1, nom);
  assert.deepEqual(allumes(debut2), ["batterie", "huile"]);        // l'étape 2 dit l'état où elle mène
  assert.deepEqual(allumes(debut3 - 1e-6), ["batterie", "huile"]); // fin de l'étape 2
  assert.deepEqual(allumes(debut3), []);
  assert.deepEqual(allumes(def.duree), []);
  for (const nom of SIX) assert.equal(def.etat(def.duree).voyants[nom], 0, nom);
});

test("autotest : un voyant éteint ne se rallume jamais, et chaque extinction dure au moins un dixième de seconde", () => {
  const def = geste();
  const dernierPlein = {}, premierEteint = {}, encoreCommandes = new Set(SIX);
  let avant = null;
  echantillonner(def, (t, e) => {
    for (const nom of SIX) {
      const b = e.voyants[nom];
      if (avant) assert.ok(b <= avant.voyants[nom] + 1e-12, `${nom} se rallume à ${t.toFixed(3)} s`);
      if (b >= 1 - 1e-9) dernierPlein[nom] = t;
      if (b <= 1e-9 && premierEteint[nom] === undefined) premierEteint[nom] = t;
      if (e.allumes.includes(nom)) assert.ok(encoreCommandes.has(nom), `${nom} rallumé à ${t.toFixed(3)} s`);
      else encoreCommandes.delete(nom);
    }
    avant = e;
  });
  for (const nom of SIX) {
    assert.ok(premierEteint[nom] !== undefined, `${nom} ne s'éteint pas`);
    const duree = premierEteint[nom] - dernierPlein[nom];
    assert.ok(duree >= 0.1 - 1e-9, `${nom} s'éteint en ${duree.toFixed(3)} s`);
  }
});

test("autotest : le repère dit Contact puis Moteur, l'aiguille ne quitte le zéro qu'au démarrage et se pose au ralenti", () => {
  const def = geste();
  const debut3 = def.etapes[2].t;
  let regimeAvant = 0;
  echantillonner(def, (t, e) => {
    const moteur = t + 1e-9 >= debut3;
    assert.equal(e.moteur, moteur, `repère à ${t.toFixed(3)} s`);
    if (!moteur) assert.equal(e.regime, 0, `aiguille à ${t.toFixed(3)} s`);
    assert.ok(e.regime >= regimeAvant - 1e-9 && e.regime <= famille.RALENTI + 1e-9, `aiguille à ${t.toFixed(3)} s : ${e.regime}`);
    regimeAvant = e.regime;
  });
  assert.equal(def.etat(def.duree).regime, famille.RALENTI);
  const image = imageFigee(def, 0);
  assert.equal(texteDe(trouverRole(image, "repere-contact")), "Contact");
  assert.equal(texteDe(trouverRole(image, "repere-moteur")), "Moteur");
});

test("autotest : chaque image figée montre l'état que dit son étape, voyants à leur couleur normalisée", () => {
  const def = geste();
  const attendu = [SIX, ["batterie", "huile"], []];
  const repere = ["contact", "contact", "moteur"];
  def.etapes.forEach((_, i) => {
    const image = imageFigee(def, i);
    for (const nom of SIX) {
      const allume = trouverRole(image, `allume-${nom}`);
      assert.equal(Number(allume.attributs.opacity), attendu[i].includes(nom) ? 1 : 0, `étape ${i + 1}, ${nom}`);
      assert.deepEqual(teintes(allume), [famille.COULEURS_VOYANTS[famille.COULEUR_DE[nom]]], nom);
    }
    for (const r of ["contact", "moteur"]) {
      assert.equal(Number(trouverRole(image, `actif-${r}`).attributs.opacity), r === repere[i] ? 1 : 0, `étape ${i + 1}, ${r}`);
    }
  });
});
