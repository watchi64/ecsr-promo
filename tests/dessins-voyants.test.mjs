import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE } from "../js/catalogue-blocs.js";
import * as famille from "../js/dessins-voyants.js";
import { SOURCES } from "../sources/dessins-voyants.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { trouverRole, trouverTous, texteDe } from "../js/dessin-svg.js";
import { PAS_IMAGE, imageFigee, imageA } from "../js/geste-regles.js";

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
const FIN_AUTOTEST = ["abs", "airbag", "pneus", "temperature"], MOTEUR = ["batterie", "huile"];
function echantillonner(def, visite) {
  for (let k = 0; ; k++) {
    const t = Math.min(def.duree, k * PAS_IMAGE);
    visite(t, def.etat(t));
    if (t >= def.duree) return;
  }
}
// Pour chaque voyant : dernier échantillon éteint avant l'allumage, premier pleinement allumé, dernier pleinement allumé avant
// l'extinction, premier éteint après.
function chronologie(def) {
  const c = Object.fromEntries(SIX.map((nom) => [nom, {}]));
  echantillonner(def, (t, e) => {
    for (const nom of SIX) {
      const b = e.voyants[nom], x = c[nom];
      if (x.plein === undefined && b <= 0) x.noir = t;
      if (x.plein === undefined && b >= 1) x.plein = t;
      if (x.plein !== undefined && x.eteint === undefined && b >= 1) x.dernierPlein = t;
      if (x.plein !== undefined && x.eteint === undefined && b <= 0) x.eteint = t;
    }
  });
  return c;
}

test("autotest : combiné noir au départ, les six voyants au contact, huile et charge jusqu'au moteur, plus aucun à la fin", () => {
  const def = geste();
  const [, debut2, debut3] = def.etapes.map((e) => e.t);
  const allumes = (t) => [...def.etat(t).allumes].sort();
  assert.deepEqual(allumes(0), []);
  for (const nom of SIX) assert.equal(def.etat(0).voyants[nom], 0, nom);
  const plein = Math.max(...Object.values(chronologie(def)).map((x) => x.plein));
  assert.ok(plein < debut2, `les six pleinement allumés dès l'étape 1 (${plein} s)`);
  assert.deepEqual(allumes(plein), SIX);                            // juste après la mise du contact
  assert.deepEqual(allumes(debut3 - 1e-6), ["batterie", "huile"]);  // fin de l'étape 2
  assert.deepEqual(allumes(def.duree), []);
  for (const nom of SIX) assert.equal(def.etat(def.duree).voyants[nom], 0, nom);
});

test("autotest : les six s'allument ensemble en 0,15 à 0,25 s, ne se rallument jamais, et s'éteignent en un dixième de seconde au moins", () => {
  const def = geste();
  const c = chronologie(def);
  const memes = (noms, cle) => assert.equal(new Set(noms.map((nom) => c[nom][cle])).size, 1, `${cle} : ${noms.join(", ")}`);
  memes(SIX, "noir"); memes(SIX, "plein");                          // allumage simultané, comme à la mise du contact
  memes(FIN_AUTOTEST, "dernierPlein"); memes(FIN_AUTOTEST, "eteint");
  memes(MOTEUR, "dernierPlein"); memes(MOTEUR, "eteint");
  for (const nom of SIX) {
    const { noir, plein, dernierPlein, eteint } = c[nom];
    assert.ok(plein - noir >= 0.15 - 1e-9 && plein - noir <= 0.25 + PAS_IMAGE, `${nom} s'allume en ${(plein - noir).toFixed(3)} s`);
    assert.ok(eteint - dernierPlein >= 0.1 - 1e-9, `${nom} s'éteint en ${(eteint - dernierPlein).toFixed(3)} s`);
  }
  // Une seule montée puis une seule descente : un voyant qui baisse ne remonte plus.
  let avant = null;
  const baisse = new Set();
  echantillonner(def, (t, e) => {
    for (const nom of SIX) {
      if (avant && e.voyants[nom] < avant.voyants[nom] - 1e-12) baisse.add(nom);
      if (avant && baisse.has(nom)) assert.ok(e.voyants[nom] <= avant.voyants[nom] + 1e-12, `${nom} se rallume à ${t.toFixed(3)} s`);
    }
    avant = e;
  });
});

test("autotest : huile et charge restent pleinement allumées tant que l'aiguille est sous 95 % du ralenti, et s'éteignent au ralenti", () => {
  const def = geste();
  const plein = Math.max(...Object.values(chronologie(def)).map((x) => x.plein));
  let auRalenti = null;
  echantillonner(def, (t, e) => {
    if (t >= plein && e.regime < 0.95 * famille.RALENTI) {
      for (const nom of MOTEUR) assert.equal(e.voyants[nom], 1, `${nom} à ${t.toFixed(3)} s, ${e.regime.toFixed(0)} tr/min`);
    }
    if (auRalenti === null && e.regime >= famille.RALENTI) auRalenti = e;
  });
  assert.ok(auRalenti, "l'aiguille atteint le ralenti");
  for (const nom of MOTEUR) assert.equal(auRalenti.voyants[nom], 0, `${nom} éteint quand l'aiguille atteint le ralenti`);
});

test("autotest : repère éteint avant le contact, « Contact » au contact et jusqu'au bout, « Moteur » au démarrage avec l'aiguille", () => {
  const def = geste();
  const c = chronologie(def);
  let avant = null, contactPlein = null, premierRegime = null, premierMoteur = null;
  echantillonner(def, (t, e) => {
    if (avant) {
      assert.ok(e.repere.contact >= avant.repere.contact - 1e-12 && e.repere.moteur >= avant.repere.moteur - 1e-12, `repère qui recule à ${t.toFixed(3)} s`);
      assert.ok(e.regime >= avant.regime - 1e-9, `aiguille qui redescend à ${t.toFixed(3)} s`);
    }
    assert.ok(e.regime <= famille.RALENTI + 1e-9, `aiguille au-delà du ralenti à ${t.toFixed(3)} s`);
    if (contactPlein === null && e.repere.contact >= 1) contactPlein = t;
    if (premierRegime === null && e.regime > 0) premierRegime = t;
    if (premierMoteur === null && e.repere.moteur > 0) premierMoteur = t;
    avant = e;
  });
  assert.deepEqual([def.etat(0).repere.contact, def.etat(0).repere.moteur, def.etat(0).regime], [0, 0, 0]);
  assert.equal(contactPlein, c.huile.plein, "« Contact » s'allume avec les voyants");
  assert.equal(premierMoteur, premierRegime, "« Moteur » s'allume quand l'aiguille commence à monter");
  const fin = def.etat(def.duree);
  assert.deepEqual([fin.repere.contact, fin.repere.moteur, fin.regime], [1, 1, famille.RALENTI]);
  const image = imageFigee(def, 0);
  assert.equal(texteDe(trouverRole(image, "repere-contact")), "Contact");
  assert.equal(texteDe(trouverRole(image, "repere-moteur")), "Moteur");
  for (const nom of SIX) assert.deepEqual(teintes(trouverRole(image, `allume-${nom}`)), [famille.COULEURS_VOYANTS[famille.COULEUR_DE[nom]]], nom);
});

// Une image figée est l'image de l'animation au même instant, au seul affichage du groupe de la flèche près : le contrôle commun
// des gestes le vérifie à chaque image (ecartsFigeeLecture de js/geste-regles.js, par verifierGeste).

test("autotest : les marques de chaque étape montrent ce qu'elle change", () => {
  const def = geste();
  const montre = (image, r) => trouverRole(image, r).attributs.display !== "none";
  def.etapes.forEach(({ t }, i) => {
    const fin = i + 1 < def.etapes.length ? def.etapes[i + 1].t : def.duree;
    const [avant, apres] = [def.etat(t), def.etat(fin - 1e-6)];
    const image = imageFigee(def, i);
    // Un anneau autour de chaque voyant qui s'éteint pendant l'étape, et d'eux seuls.
    const vaSEteindre = SIX.filter((nom) => apres.voyants[nom] < avant.voyants[nom]);
    assert.deepEqual(SIX.filter((nom) => montre(image, `anneau-${nom}`)), vaSEteindre, `étape ${i + 1}`);
    // La flèche du contact quand l'étape allume le combiné, celle de l'aiguille quand l'étape la fait monter.
    const allume = SIX.every((nom) => avant.voyants[nom] === 0 && apres.voyants[nom] === 1);
    assert.equal(montre(image, "fleche-contact"), allume, `étape ${i + 1} : flèche du contact`);
    assert.equal(montre(image, "fleche-aiguille"), apres.regime > avant.regime, `étape ${i + 1} : flèche de l'aiguille`);
    // La flèche de la pastille « Moteur » vers le combiné quand l'étape démarre le moteur (la pastille s'allume), comme celle de
    // « Contact » à la mise du contact : sur l'image figée, « Moteur démarré » ne se lit pas sous une pastille éteinte et sans marque.
    assert.equal(montre(image, "fleche-moteur"), apres.repere.moteur > avant.repere.moteur, `étape ${i + 1} : flèche du moteur`);
    assert.ok(allume || vaSEteindre.length > 0, `étape ${i + 1} : une marque au moins`);
  });
});

test("autotest : les flèches « Contact » et « Moteur » partent chacune du haut de sa pastille et montent jusqu'au bord du combiné", () => {
  const image = imageFigee(geste(), 0);
  const combine = trouverRole(image, "combine").attributs, bas = Number(combine.y) + Number(combine.height);
  for (const cle of ["contact", "moteur"]) {
    const pastille = trouverRole(image, `pastille-${cle}`).enfants[0].attributs;
    const f = trouverRole(image, `fleche-${cle}`);
    const queue = String(trouverRole(f, "fleche-trait").attributs.d).match(/-?\d+(?:\.\d+)?/g).slice(0, 2).map(Number);
    const pointe = String(trouverRole(f, "fleche-tete").attributs.d).match(/-?\d+(?:\.\d+)?/g).slice(0, 2).map(Number);
    const [x0, x1] = [Number(pastille.x), Number(pastille.x) + Number(pastille.width)];
    assert.ok(queue[0] > x0 && queue[0] < x1 && Math.abs(queue[0] - pointe[0]) < 1e-6, `${cle} : flèche verticale au-dessus de sa pastille`);
    assert.ok(queue[1] <= Number(pastille.y) && queue[1] >= Number(pastille.y) - 2, `${cle} : la flèche part du haut de sa pastille`);
    assert.ok(pointe[1] > bas && pointe[1] <= bas + 3, `${cle} : la pointe au bord du combiné (${pointe[1].toFixed(1)} pour ${bas})`);
  }
});

// La légende modèle proposée par l'éditeur dit, couleur par couleur, des mots de la conduite à tenir que la planche écrit (« Vert
// ou bleu : aucune action », comme le cours, et non « information ») : relecture finale du lot D1, m3.
test("voyants : la légende modèle reprend, couleur par couleur, la conduite à tenir écrite dans la planche", () => {
  const d = famille.DESSINS.voyants();
  const legende = CATALOGUE.voyants.legendeModele;
  const minuscules = (s) => s.toLocaleLowerCase("fr");
  for (const cle of ["rouge", "orange", "vert-bleu"]) {
    const nom = texteDe(trouverRole(d, `couleur-${cle}`));
    const conduite = minuscules(trouverTous(trouverRole(d, `conduite-${cle}`), (x) => x.balise === "text").map(texteDe).join(" "));
    const morceau = legende.match(new RegExp(`${nom} : ([^.]+)\\.`));
    assert.ok(morceau, `${cle} : « ${nom} : » dans la légende modèle`);
    assert.ok(conduite.includes(minuscules(morceau[1])), `${cle} : « ${morceau[1]} » n'est pas dans « ${conduite} »`);
  }
});

// L'intitulé modèle de la mise du contact ne dit pas « tous les voyants » : le combiné n'en allume que six, la planche en montre
// douze, et le cours dit « les voyants s'allument » (relecture finale du lot D1, m3).
test("autotest : l'intitulé modèle de la mise du contact ne dit pas « tous » les voyants, le combiné n'en allume qu'une partie", () => {
  const def = geste();
  const allumes = def.etat(def.etapes[1].t - PAS_IMAGE).allumes.length;
  const planche = trouverTous(famille.DESSINS.voyants(), (x) => /^voyant-/.test(x.attributs["data-r"] ?? "")).length;
  assert.ok(allumes > 0 && allumes < planche, `${allumes} voyants allumés à la fin de l'étape 1, ${planche} sur la planche`);
  assert.doesNotMatch(CATALOGUE.autotest.etapesModele[0], /\btous\b/i);
});

// ----- Style schématique (décision du formateur du 15/10/2026 : « pictogramme plutôt qu'illustration ») -----
// Les pictogrammes normalisés gardent leur forme exacte (tests ci-dessus) ; tout le reste est en aplats, sans bord ni relief.

// Teintes peintes par les formes d'un nœud (textes exclus), « none » exclu.
const teintesFormes = (noeud) => {
  const vues = new Set();
  for (const x of trouverTous(noeud, (y) => y.balise !== "text" && y.balise !== "g")) {
    for (const k of ["fill", "stroke"]) if (x.attributs[k] !== undefined && x.attributs[k] !== "none") vues.add(x.attributs[k]);
  }
  return [...vues].sort();
};

test("voyants : chaque tuile est un seul aplat sombre, sans bord", () => {
  const d = famille.DESSINS.voyants();
  for (const nom of Object.keys(famille.COULEUR_DE)) {
    const tuile = trouverRole(trouverRole(d, `voyant-${nom}`), "tuile");
    assert.ok(tuile, `${nom} : tuile absente`);
    assert.equal(tuile.attributs.fill, famille.TABLEAU.fond, nom);
    assert.ok(tuile.attributs.stroke === undefined || tuile.attributs.stroke === "none", `${nom} : tuile bordée`);
  }
});

// Lecture du cadran dans le dessin : centre (le moyeu), et angle (degrés depuis midi, sens horaire) d'un point vu du centre.
function cadranDessine(image) {
  const ct = trouverRole(image, "compte-tours"), moyeu = trouverRole(ct, "moyeu");
  const centre = [Number(moyeu.attributs.cx), Number(moyeu.attributs.cy)];
  const angle = ([x, y]) => (Math.atan2(x - centre[0], centre[1] - y) * 180) / Math.PI;
  const graduations = trouverTous(ct, (x) => x.attributs["data-r"] === "graduation")
    .map((g) => [Number(g.attributs.x2), Number(g.attributs.y2)]);
  return { ct, centre, angle, graduations };
}

test("autotest : combiné en pictogramme : un aplat sans bord ; cadran réduit à son arc, un trait par 1 000 tr/min et l'aiguille, en deux tons", () => {
  const image = imageFigee(geste(), 0);
  const combine = trouverRole(image, "combine");
  assert.equal(combine.attributs.fill, famille.TABLEAU.fond);
  assert.ok(combine.attributs.stroke === undefined || combine.attributs.stroke === "none", "combiné bordé");
  const { ct, centre, angle, graduations } = cadranDessine(image);
  // Huit traits, de 0 à 7 000 tr/min, à pas égal sur 240 degrés, de 8 h à 4 h : ni sous-graduation, ni disque de cadran.
  assert.equal(graduations.length, 8, `${graduations.length} graduations`);
  const angles = graduations.map(angle);
  angles.forEach((a, i) => assert.ok(Math.abs(a - (-120 + (240 * i) / 7)) < 0.01, `graduation ${i} à ${a.toFixed(2)} degrés`));
  assert.deepEqual(trouverTous(ct, (x) => x.balise === "circle").map((c) => c.attributs["data-r"]), ["moyeu"], "un seul disque : le moyeu");
  // L'arc va de la première graduation à la dernière, par le haut.
  const arc = trouverRole(ct, "arc-cadran");
  const nombres = String(arc.attributs.d).match(/-?\d+(?:\.\d+)?/g).map(Number);
  const [debut, fin] = [nombres.slice(0, 2), nombres.slice(-2)];
  const pres = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01;
  assert.ok(pres(debut, graduations[0]) && pres(fin, graduations[7]), "l'arc ne joint pas 0 à 7 000 tr/min");
  assert.match(String(arc.attributs.d), / 0 1 1 /, "l'arc passe par le haut (grand arc, sens horaire)");
  assert.deepEqual(teintesFormes(ct), [famille.TABLEAU.aiguille, famille.TABLEAU.graduation].sort(), "deux tons");
  assert.ok(Math.hypot(centre[0] - Number(trouverRole(ct, "aiguille").attributs.x1), centre[1] - Number(trouverRole(ct, "aiguille").attributs.y1)) < 0.01,
    "l'aiguille part du moyeu, sans queue");
});

test("autotest : à chaque image, l'aiguille lue dans le dessin part du moyeu et montre le régime de l'état sur l'échelle des graduations", () => {
  const def = geste();
  echantillonner(def, (t, e) => {
    const image = imageA(def, t, false);
    const { ct, centre, angle, graduations } = cadranDessine(image);
    const [a0, a7] = [angle(graduations[0]), angle(graduations[7])];
    const aiguille = trouverRole(ct, "aiguille").attributs;
    assert.ok(Math.hypot(Number(aiguille.x1) - centre[0], Number(aiguille.y1) - centre[1]) < 0.01, `${t.toFixed(3)} s : aiguille hors du moyeu`);
    const lu = angle([Number(aiguille.x2), Number(aiguille.y2)]), attendu = a0 + ((a7 - a0) * e.regime) / 7000;
    assert.ok(Math.abs(lu - attendu) < 0.01, `${t.toFixed(3)} s : aiguille à ${lu.toFixed(2)} degrés pour ${attendu.toFixed(2)} (${e.regime.toFixed(0)} tr/min)`);
    assert.deepEqual([Number(aiguille["data-x"]), Number(aiguille["data-y"])], [Number(aiguille.x2), Number(aiguille.y2)], "point suivi : la pointe");
  });
});
