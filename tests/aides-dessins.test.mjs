import { test } from "node:test";
import assert from "node:assert/strict";
import { n } from "../js/dessin-svg.js";
import { cadre, texte, fleche, CHARTE } from "../js/dessins-kit.js";
import { verifierDessin, verifierGeste } from "./aides-dessins.mjs";
import { gesteEssai, CADRE_ESSAI, ETAPES_ESSAI } from "./geste-essai.mjs";

// Les contrôles communs (tests/aides-dessins.mjs) : ce que verifierDessin laissait passer, et verifierGeste.
const problemes = (...enfants) => verifierDessin(cadre({ largeur: 320, hauteur: 100, titre: "Essai" }, ...enfants), [320, 100]).join(" | ");
const rect = () => n("rect", { x: 0, y: 0, width: 5, height: 5 });

test("contrôles communs : un svg imbriqué est signalé, où qu'il soit, masqué ou non (son viewBox change l'échelle de son texte)", () => {
  // Un svg de 160 sur 60 qui montre une fenêtre de 80 sur 30 : son texte de 12 s'y rend deux fois plus grand que dit.
  const imbrique = n("svg", { x: 10, y: 10, width: 160, height: 60, viewBox: "0 0 80 30" }, texte(5, 20, "Texte d'un autre viewBox"));
  assert.match(problemes(imbrique), /svg imbriqué/);
  assert.match(problemes(n("g", {}, imbrique)), /svg imbriqué/);
  assert.match(problemes(n("g", { display: "none" }, imbrique)), /svg imbriqué/);
  // Sans svg imbriqué, rien à dire : la racine d'un dessin est un svg, et c'est le seul.
  assert.equal(problemes(texte(10, 50, "Jante")), "");
  assert.equal(verifierDessin(cadre({ largeur: 320, hauteur: 100, titre: "Essai" }), [320, 100]).filter((p) => /svg/.test(p)).length, 0);
});

test("contrôles communs : un élément style est signalé, où qu'il soit, masqué ou non (ses règles changent textes et traits hors de vue)", () => {
  const css = () => n("style", {}, "text { font-size: 4px } line { stroke-width: 0.2px }");
  assert.match(problemes(css()), /élément style/);
  assert.match(problemes(n("defs", {}, css())), /élément style/);
  assert.match(problemes(n("g", { display: "none" }, css())), /élément style/);
  assert.equal(problemes(texte(10, 50, "Sans style")), "");
});

test("contrôles communs : un attribut style sur une forme ou un groupe est signalé, masqué ou non (il change traits et couleurs sans qu'aucun attribut ne le dise)", () => {
  // La sonde du relecteur : un trait de 1 unité que son style réduit à 0,1.
  const trait = () => n("line", { x1: 0, y1: 5, x2: 10, y2: 5, stroke: "#000", "stroke-width": 1, style: "stroke-width:0.1" });
  assert.match(problemes(trait()), /line : attribut style/);
  assert.match(problemes(n("g", { style: "opacity:0" }, rect())), /g : attribut style/);
  assert.match(problemes(n("g", { display: "none" }, trait())), /line : attribut style/);
  assert.match(problemes(n("defs", {}, n("rect", { x: 0, y: 0, width: 5, height: 5, style: "fill:red" }))), /rect : attribut style/);
  // Sur un texte, le contrôle du texte le dit déjà : une seule fois, pas deux.
  const surTexte = n("text", { x: 10, y: 50, "font-size": 12, "font-family": CHARTE.police, "font-weight": 400, "text-anchor": "start", style: "font-size:4px" }, "Style");
  assert.equal(problemes(surTexte).split(" | ").filter((p) => /style/.test(p)).length, 1);
  // Une valeur absente est déjà dite par le contrôle des valeurs, pas deux fois.
  const absent = problemes(n("g", { style: undefined }, rect()));
  assert.match(absent, /g style="undefined"/);
  assert.doesNotMatch(absent, /attribut style/);
  // Sans style, rien à dire.
  assert.equal(problemes(n("line", { x1: 0, y1: 5, x2: 10, y2: 5, stroke: "#000", "stroke-width": 1 })), "");
});

test("contrôles communs : un transform que les contrôles ne savent pas lire est signalé (unités, nombre mal écrit, fonction inconnue, matrix et skew)", () => {
  const illisibles = ["translate(400px 3px)", "translate(400px, 3px)", "translate(10px)", "translate(1-2)", "translate(10 20 30)",
    "translate(10 20", "translateX(10)", "translate (10 20)", "scale(0.5px)", "rotate(45deg)", "translate(10 20) bogus(1)",
    "translate(0x10)", "translate()", "translate(,5)", "matrix(1 0 0 1 5)", "rotate(45 160)", "skewX(10px)", "translate 10 20)", "translate10)", 5,
    // Ni la translation ni le facteur d'échelle ne lisent matrix, skewX et skewY, même bien écrits : un trait sous matrix(0,2 ...)
    // serait lu à son épaisseur d'origine.
    "matrix(1 0 0 1 5 5)", "matrix(0.2 0 0 0.2 0 0)", "skewX(10)", "skewY(-10)", "translate(10 20) matrix(1 0 0 1 0 0)"];
  for (const t of illisibles) {
    assert.match(problemes(n("g", { transform: t }, rect())), /g : transform « .* » que les contrôles ne savent pas lire/, String(t));
  }
  // Le cas qui a fait écrire la règle : un texte décalé hors du cadre par une translation avec unités était lu à 0, donc
  // dans le cadre, donc sans reproche.
  const decale = problemes(n("g", { transform: "translate(400px 3px)" }, texte(10, 50, "Hors du cadre")));
  assert.match(decale, /transform « translate\(400px 3px\) »/);
  assert.doesNotMatch(decale, /hors du cadre/, "les contrôles ne prétendent pas savoir où est le texte");
  // Sur un texte lui-même, et masqué.
  const surTexte = n("text", { x: 10, y: 50, "font-size": 12, "font-family": CHARTE.police, "font-weight": 400, "text-anchor": "start",
    transform: "translate(400px 3px)" }, "Décalé");
  assert.match(problemes(surTexte), /text : transform « translate\(400px 3px\) »/);
  assert.match(problemes(n("g", { display: "none" }, n("g", { transform: "translate(1-2)" }, rect()))), /transform « translate\(1-2\) »/);
});

test("contrôles communs : un trait sous matrix ou skew, que le facteur d'échelle ne lit pas, ne passe plus pour un trait d'une unité", () => {
  // Le trait d'une unité sous matrix(0,2 0 0 0,2 0 0) est rendu à 0,2 : les contrôles le lisaient à 1, donc le laissaient passer.
  const trait = () => n("line", { x1: 0, y1: 5, x2: 10, y2: 5, stroke: "#000", "stroke-width": 1 });
  for (const t of ["matrix(0.2 0 0 0.2 0 0)", "skewX(10)", "skewY(-10)"]) {
    assert.match(problemes(n("g", { transform: t }, trait())), new RegExp(`g : transform « ${t.replace(/[()]/g, "\\$&")} » que les contrôles ne savent pas lire`), t);
  }
  // Le même trait sous scale(0,2), que le facteur d'échelle lit, est dit trop fin : c'est le contrôle qui s'applique.
  assert.match(problemes(n("g", { transform: "scale(0.2)" }, trait())), /line : trait de 0\.2 unité/);
  // Un texte sous matrix reste signalé pour son compte, en plus.
  assert.match(problemes(n("g", { transform: "matrix(0.5 0 0 0.5 0 0)" }, texte(20, 50, "Réduit"))), /« Réduit » sous rotate, matrix ou skew/);
});

test("contrôles communs : les transform lisibles ne sont pas signalés", () => {
  const lisibles = ["translate(10 20)", "translate(10,20)", "translate(10)", "translate( 10 , 20 )", "translate(1e-7 5)", "translate(-3.5 .5)",
    "translate(+3 -4)", "translate(5.)", "scale(0.5)", "scale(2 3)", "rotate(45)", "rotate(45 160 50)",
    "translate(10 20) rotate(30)", "translate(10)translate(5)", "translate(10) , scale(2)", "  translate(1 2)  ", ""];
  for (const t of lisibles) {
    assert.doesNotMatch(problemes(n("g", { transform: t }, rect())), /transform/, `« ${t} »`);
  }
  // Un transform absent ou nul n'est signalé qu'une fois, par le contrôle des valeurs, pas aussi comme illisible.
  const absent = problemes(n("g", { transform: undefined }, rect()));
  assert.match(absent, /g transform="undefined"/);
  assert.doesNotMatch(absent, /ne savent pas lire/);
});

// ----- verifierGeste -----

const entree = { etapesModele: ETAPES_ESSAI, cadre: CADRE_ESSAI };
const def = gesteEssai();
const sans = (noeud, role) => ({ ...noeud, enfants: noeud.enfants.filter((x) => x.attributs["data-r"] !== role) });

test("verifierGeste : un geste en règle n'a aucun problème", () => {
  assert.deepEqual(verifierGeste(def, entree), []);
});

test("verifierGeste : reprend les problèmes du moteur et compare le cadre au catalogue ; des étapes absentes ne la font pas lever", () => {
  assert.deepEqual(verifierGeste(def, { ...entree, etapesModele: ["Un", "Deux", "Trois"] }), ["2 étapes au lieu de 3"]);
  const pb = verifierGeste(def, { ...entree, cadre: [320, 300] }).join(" | ");
  assert.match(pb, /cadre 320,200 au lieu de 320,300/);
  assert.match(pb, /étape 1 : viewBox « 0 0 320 200 » au lieu de « 0 0 320 300 »/);
  for (const etapes of [undefined, [], null]) {
    assert.deepEqual(verifierGeste(gesteEssai({ etapes }), entree), ["étapes absentes ou vides : le lecteur en exige au moins une"]);
  }
  // Une durée ou un instant qui n'est pas un nombre : le seul problème dit est celui-là, sans images à des instants NaN.
  for (const duree of [NaN, 0, -2, "3", undefined]) {
    assert.deepEqual(verifierGeste(gesteEssai({ duree }), entree), [`durée ${String(duree)} : un nombre fini strictement positif est attendu`], `durée ${String(duree)}`);
  }
  assert.deepEqual(verifierGeste(gesteEssai({ etapes: [{ t: 0 }, { t: NaN }] }), entree), ["étape 2 : instant non fini"]);
});

test("verifierGeste : la flèche doit être visible sur chaque image figée, étape par étape, et masquée en lecture", () => {
  // Pas de flèche du tout : dite pour chaque étape.
  const absente = gesteEssai({ dessiner: (etat, o) => sans(def.dessiner(etat, o), "fleche") });
  assert.deepEqual(verifierGeste(absente, entree).filter((p) => /^étape/.test(p)), ["étape 1 : flèche absente ou masquée", "étape 2 : flèche absente ou masquée"]);
  // Flèche masquée même figée (display none jamais levé) : même constat.
  const masquee = gesteEssai({ dessiner: (etat, { etape }) => def.dessiner(etat, { fige: false, etape }) });
  assert.deepEqual(verifierGeste(masquee, entree).filter((p) => /^étape/.test(p)), ["étape 1 : flèche absente ou masquée", "étape 2 : flèche absente ou masquée"]);
  // Flèche visible aussi en lecture : dite, avec l'instant.
  const toujoursVisible = gesteEssai({ dessiner: (etat, { etape }) => def.dessiner(etat, { fige: true, etape }) });
  const visible = verifierGeste(toujoursVisible, entree);
  assert.ok(visible.includes("0.00 s : flèche visible en lecture"));
  assert.ok(visible.includes("3.00 s : flèche visible en lecture"));
  assert.equal(visible.filter((p) => /flèche absente/.test(p)).length, 0);
});

test("verifierGeste : chaque image de lecture passe les contrôles communs, avec son instant dit", () => {
  // Le libellé rétrécit à 8 unités passé x = 100 : trop petit sur un téléphone, à partir de l'étape 2 et de 1,25 s.
  const petit = gesteEssai({
    dessiner: (etat, o) => {
      const d = def.dessiner(etat, o);
      return { ...d, enfants: d.enfants.map((x) => (x.attributs["data-r"] === "libelle" ? { ...x, attributs: { ...x.attributs, "font-size": etat.x > 100 ? 8 : 12 } } : x)) };
    },
  });
  const pb = verifierGeste(petit, entree);
  assert.ok(pb.some((p) => /^étape 2 : texte « Étape 2 » : 8\.6 px sur téléphone$/.test(p)), pb.join(" | "));
  assert.ok(pb.some((p) => /^1\.25 s : texte « Étape 1 » : 8\.6 px sur téléphone$/.test(p)), pb.join(" | "));
  // Les images de lecture portent l'étape de leur instant, comme celles du moteur : à 1,50 s le libellé est celui de l'étape 2.
  assert.ok(pb.some((p) => /^1\.50 s : texte « Étape 2 » : 8\.6 px sur téléphone$/.test(p)), pb.join(" | "));
  assert.equal(pb.some((p) => /^étape 1 /.test(p)), false, "l'étape 1 est en règle");
  assert.equal(pb.some((p) => /^(0\.00|0\.25|1\.00) s/.test(p)), false, "avant 1,25 s tout va");
});

test("verifierGeste : l'image figée de n'importe quel instant, la fin de lecture comprise, montre la flèche et passe les contrôles", () => {
  // La flèche disparaît quand le disque a fini sa course : les images figées des étapes (début d'étape) n'y voient rien,
  // mais une pause ou la fin de lecture, si.
  const finSansFleche = gesteEssai({
    dessiner: (etat, { fige, etape }) => {
      const d = def.dessiner(etat, { fige: fige && etat.x < 280, etape });
      return d;
    },
  });
  const pb = verifierGeste(finSansFleche, entree);
  assert.ok(pb.includes("3.00 s, image figée : flèche absente ou masquée"), pb.join(" | "));
  assert.equal(pb.some((p) => /^étape/.test(p)), false, "les images figées des étapes, elles, sont en règle");
  // Un libellé qui sort du cadre en fin de course : dit pour l'image figée de la fin.
  const sortDuCadre = gesteEssai({
    dessiner: (etat, o) => {
      const d = def.dessiner(etat, o);
      return { ...d, enfants: d.enfants.map((x) => (x.attributs["data-r"] === "libelle" && o.fige && etat.x >= 280 ? { ...x, attributs: { ...x.attributs, x: 330 } } : x)) };
    },
  });
  assert.ok(verifierGeste(sortDuCadre, entree).some((p) => /^3\.00 s, image figée : texte « Étape 2 » hors du cadre$/.test(p)));
});

test("verifierGeste : un dessin qui lève est dit dans la liste, jamais une exception qui cache le reste", () => {
  const leve = gesteEssai({ dessiner: (etat, o) => { if (etat.x > 200) throw new Error("point hors tracé"); return def.dessiner(etat, o); } });
  let pb;
  assert.doesNotThrow(() => { pb = verifierGeste(leve, entree); });
  assert.ok(pb.some((p) => /^image impossible à produire à \d\.\d{3} s : point hors tracé$/.test(p)), pb.join(" | "));
  assert.ok(pb.some((p) => /^contrôle des images interrompu : point hors tracé$/.test(p)), pb.join(" | "));
});

test("verifierGeste : la flèche du kit passe telle quelle, même masquée : liseré clair, tête et trait aux épaisseurs et aux teintes de la charte", () => {
  const jeu = Object.values(CHARTE.traits);
  const points = [[40, 150], [280, 150]];
  for (const visible of [true, false]) {
    const f = fleche(points, { visible });
    assert.equal(f.attributs["data-r"], "fleche");
    assert.equal(f.attributs.display, visible ? "inline" : "none");
    // Quatre pièces, dans l'ordre : le liseré du trait, celui de la tête, le trait, la tête.
    assert.equal(f.enfants.length, 4);
    const [lisereTrait, lisereTete, trait, tete] = f.enfants;
    assert.equal(trait.attributs["data-r"], "fleche-trait");
    assert.equal(tete.attributs["data-r"], "fleche-tete");
    // Le trait : une épaisseur du jeu de quatre de la charte, la teinte de la flèche ; la tête : la même teinte, pleine.
    assert.ok(jeu.includes(trait.attributs["stroke-width"]), `épaisseur ${trait.attributs["stroke-width"]} dans le jeu de la charte`);
    assert.equal(trait.attributs.stroke, CHARTE.accentFort);
    assert.equal(tete.attributs.fill, CHARTE.accentFort);
    // Le liseré clair : teinte de la carte, un liseré de chaque côté du trait (sa largeur plus deux liserés) et de la tête.
    assert.equal(lisereTrait.attributs.stroke, CHARTE.carte);
    assert.equal(lisereTrait.attributs["stroke-width"], trait.attributs["stroke-width"] + 2 * CHARTE.liseres);
    assert.equal(lisereTete.attributs.fill, CHARTE.carte);
    assert.equal(lisereTete.attributs.stroke, CHARTE.carte);
    assert.equal(lisereTete.attributs["stroke-width"], 2 * CHARTE.liseres);
    // Le trait et son liseré, la tête et son liseré tracent les mêmes formes (le liseré les déborde d'autant).
    assert.equal(lisereTrait.attributs.d, trait.attributs.d);
    assert.equal(lisereTete.attributs.d, tete.attributs.d);
  }
  // Aux quatre épaisseurs de la charte, visible ou non, la flèche passe les contrôles communs (traits d'une unité au moins).
  for (const epaisseur of jeu) {
    for (const visible of [true, false]) {
      const d = cadre({ largeur: 320, hauteur: 200, titre: "Essai", description: "Une flèche." }, fleche(points, { epaisseur, visible }));
      assert.deepEqual(verifierDessin(d, [320, 200]), [], `épaisseur ${epaisseur}, visible ${visible}`);
    }
  }
  // Et le geste d'essai, dont c'est la flèche, passe verifierGeste.
  assert.deepEqual(verifierGeste(def, entree), []);
});
