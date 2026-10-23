/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Moteur des schémas animés : dessine une scène du registre (js/scenes.js) en
 * SVG, à l'échelle réelle (une unité = un mètre), et l'anime en temps réel.
 * Tout est construit par l'API du DOM : aucun texte de cours ne devient du code.
 * La géométrie est celle de js/scene-geometrie.js, la même que celle des tests ;
 * le regard du conducteur et son cône sont ceux de js/scene-regard.js, et les
 * règles de l'image (teintes, clignotant, cadres, repères, panneaux) celles de
 * js/scene-rendu.js, testées elles aussi.
 *
 * Le lecteur (boutons Lecture, Pause, Revoir et Rejouer, boucle d'animation, étapes marquées,
 * départ et pause selon la visibilité, destruction) est commun aux animations des cours : il
 * vit dans js/lecteur-anime.js, et ses règles pures dans js/lecteur-anime-regles.js. Ce moteur
 * lui donne l'image à dessiner à chaque instant (`rendre(instant, fige)`).
 *
 * Sobriété : la lecture démarre quand 60 % du schéma sont visibles, une seule fois,
 * puis attend « Rejouer » ; elle se met en pause quand le schéma sort tout à fait de
 * l'écran, pas avant (sur un téléphone, le schéma et la liste de ses étapes ne tiennent
 * pas ensemble à l'écran : lire les dernières étapes ne l'interrompt pas), et s'arrête
 * quand il sort du document. Animations réduites : schéma à l'arrêt, cadré une fois pour
 * toutes sur l'ensemble des étapes, étapes numérotées le long du trajet, un appui sur une
 * étape y place la voiture. Après un appui sur une étape, la voiture est ramenée à
 * l'écran si elle en était sortie (sans animation, la page ne bouge pas si elle est visible).
 *
 * Image figée (pas à pas, pause, fin de lecture, animations réduites) : elle montre
 * l'état de la scène à cet instant, pas une phase d'animation : le clignotant en
 * marche y est allumé, le regard de l'étape y est dessiné. Les feux de recul, eux,
 * suivent la marche, en lecture comme sur une image figée.
 *
 * Rien n'apparaît hors du cadre : le dessin est découpé au cadre courant, et la
 * boîte du SVG prend les proportions de ce cadre (css/cours-blocs.css).
 */
import { preparerScene, etatActeur, pointA, GABARITS, DEG, PORTIERE, anglePortiere } from "./scene-geometrie.js?v=20261024a";
import { regardDessine } from "./scene-regard.js?v=20261024a";
import { TEINTES, RAYON_REPERE, clignotantAllume, feuxDeRecul, cadreCamera, cadreReduit, reperesEtapes,
  demiLargeurRepere, libelleRepere, emprisePanneau, feuxStop }
  from "./scene-rendu.js?v=20261024a";
import { urlSignalVerifie } from "./signaux.js?v=20261024a";
import { monterLecteur } from "./lecteur-anime.js?v=20261024a";
import { etapeA } from "./lecteur-anime-regles.js?v=20261024a";
import { versDom } from "./dessin-svg.js?v=20261024a";
import { cycliste } from "./piece-cycliste.js?v=20261024a";

const NS = "http://www.w3.org/2000/svg";
// Opacité du regard : un cône, en lecture comme sur une image figée (les quatre cônes d'un tour du regard figé compris),
// ou, plus léger, le secteur que parcourt un balayage sur une image figée. Celle du cône est exportée pour les tests : les
// dessins qui montrent le regard (REGARD_SCENES de js/dessins-kit.js) la recopient, sans charger ce module.
export const OPACITE_CONE = 0.4;
const OPACITE_REGARD = { cone: OPACITE_CONE, cones: OPACITE_CONE, secteur: 0.22 };
// Numéro des schémas montés : chacun a sa propre découpe, plusieurs schémas pouvant partager une page.
let numeroScene = 0;

function svg(nom, attrs = {}) {
  const n = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
const f3 = (x) => x.toFixed(3);
const n3 = (x) => String(Number(x.toFixed(3)));     // 46 s'écrit « 46 », 63.50926 « 63.509 »
const chemin = (poly) => "M" + poly.map(([x, y]) => f3(x) + " " + f3(y)).join(" L") + " Z";

// Le pointillé d'un tracé SVG commence à son premier point. Pour une ligne de cédez-le-passage, c'est le bout le plus
// éloigné du centre du carrefour, côté bordure dans les deux décors : la ligne commence par un carré plein contre le
// trottoir. Les autres tracés gardent le sens (de, a) de leur donnée.
function sensDuTrace(m, centre) {
  const cedez = typeof m.role === "string" && m.role.startsWith("cedez-");
  if (!m.trait || !cedez || !centre) return [m.de, m.a];
  const loin = (p) => Math.hypot(p[0] - centre.x, p[1] - centre.y);
  return loin(m.a) > loin(m.de) ? [m.a, m.de] : [m.de, m.a];
}

function dessinerMarquage(parent, m, centre) {
  if (m.type === "surface") {
    parent.appendChild(svg("path", { d: chemin(m.poly), fill: TEINTES.peinture }));
    return;
  }
  const [de, a] = sensDuTrace(m, centre);
  const attrs = { x1: f3(de[0]), y1: f3(de[1]), x2: f3(a[0]), y2: f3(a[1]),
    stroke: TEINTES.peinture, "stroke-width": m.largeur, "stroke-linecap": "butt" };
  if (m.trait) attrs["stroke-dasharray"] = `${m.trait} ${m.vide}`;
  parent.appendChild(svg("line", attrs));
}

// Panneau : le dessin officiel, centré sur la position réelle du panneau (js/scene-rendu.js, emprisePanneau).
function dessinerPanneau(parent, p) {
  const url = urlSignalVerifie(p.code);
  if (!url) return;                                  // jamais deviné
  const r = emprisePanneau(p);
  const g = svg("g", { class: "scene-panneau" });
  g.appendChild(svg("image", { x: f3(r.x), y: f3(r.y), width: r.largeur, height: r.hauteur, href: url }));
  parent.appendChild(g);
}

// Trajet prévu de l'élève, échantillonné tous les 0,5 m : points ronds opaques (traits quasi nuls aux bouts arrondis),
// dans la teinte TEINTES.trajet, lisible sur la chaussée. Une voiture de l'élève posée (garée) n'a pas de trajet.
function dessinerTrajet(parent, sc) {
  if (!sc.eleve.chemin) return;
  const points = [];
  for (let s = 0; s <= sc.eleve.chemin.longueur; s += 0.5) {
    const p = pointA(sc.eleve.chemin, s);
    points.push(f3(p.x) + "," + f3(p.y));
  }
  parent.appendChild(svg("polyline", { points: points.join(" "), fill: "none", stroke: TEINTES.trajet,
    "stroke-width": 0.22, "stroke-linecap": "round", "stroke-dasharray": "0.01 0.44" }));
}

// Portière avant gauche dessinée (PORTIERE, js/scene-geometrie.js), pour une voiture qui en porte l'état seulement, en repère
// local de la voiture. Choix de dessin : battant de 12 cm d'épaisseur (la portière et le cadre de sa vitre, vus d'en haut) ;
// ouverture laissée dans le flanc, de la même épaisseur (le seuil et le siège, sous le toit) ; flèche de l'ouverture, sur
// l'image figée de l'étape où la portière bouge : un arc autour de la charnière, à 0,5 m au-delà du bord arrière de la
// portière (le chemin de ce bord, agrandi pour que l'arc se lise au-delà de sa pointe), terminé par une pointe, dans la
// teinte du trajet prévu de l'élève, liserée de la teinte de la bordure de sa voiture pour se lire sur la chaussée comme
// dans le cône du regard ; assez épaisse pour un téléphone (3 px à 343 px de large). Aucun trait sous 0,05 m : 1 px au
// moins à 343 px de large, dans le cadre de 15 m de sortie-portiere.
const PORTIERE_DESSIN = { epaisseur: 0.12, trait: 0.05, ecartFleche: 0.5, traitFleche: 0.13, lisere: 0.05, pasFleche: 2.5,
  pointe: { longueur: 0.4, largeur: 0.4 } };

// Arc de la flèche d'une portière qui va de l'angle a0 à l'angle a1 (degrés), et sa pointe : deux tracés en repère local
// de la voiture. La pointe finit sur l'arc, à l'angle a1 ; l'arc s'arrête à sa base.
function flechePortiere(a0, a1) {
  const hx = PORTIERE.charniere, hy = -GABARITS.voiture.largeur / 2;
  const R = PORTIERE.longueur + PORTIERE_DESSIN.ecartFleche, { longueur: lp, largeur: wp } = PORTIERE_DESSIN.pointe;
  const point = (a) => [hx - R * Math.cos(a * DEG), hy - R * Math.sin(a * DEG)];
  const aBase = a1 - (Math.sign(a1 - a0) * lp) / R / DEG;
  const n = Math.max(1, Math.ceil(Math.abs(aBase - a0) / PORTIERE_DESSIN.pasFleche));
  const arc = "M" + Array.from({ length: n + 1 }, (_, k) => point(a0 + ((aBase - a0) * k) / n)).map(([x, y]) => f3(x) + " " + f3(y)).join(" L");
  const [bx, by] = point(aBase), [sx, sy] = point(a1), l = Math.hypot(sx - bx, sy - by);
  const nx = (-(sy - by) / l) * (wp / 2), ny = ((sx - bx) / l) * (wp / 2);
  const pointe = `M${f3(sx)} ${f3(sy)} L${f3(bx + nx)} ${f3(by + ny)} L${f3(bx - nx)} ${f3(by - ny)} Z`;
  return { arc, pointe };
}

// Voiture en repère local : x vers l'avant, y vers la droite. `avecPortiere` : la voiture porte l'état de sa portière ; on
// lui ajoute alors, après ses feux, l'ouverture du flanc, le battant et la flèche, masqués tant que la portière est fermée.
// Les autres voitures n'ont aucun de ces éléments : leur dessin ne change pas.
function dessinerVoiture(teinte, bord, avecPortiere = false) {
  const { longueur: L, largeur: W } = GABARITS.voiture;
  const g = svg("g");
  g.appendChild(svg("rect", { x: -L / 2, y: -W / 2, width: L, height: W, rx: 0.4, fill: teinte, stroke: bord, "stroke-width": 0.08 }));
  g.appendChild(svg("rect", { x: L / 2 - 1.55, y: -W / 2 + 0.18, width: 0.55, height: W - 0.36, rx: 0.12, fill: TEINTES.vitre }));
  const feu = (x, y, w, h, teinteFeu) => {
    const r = svg("rect", { x, y, width: w, height: h, rx: 0.05, fill: teinteFeu, opacity: 0 });
    g.appendChild(r);
    return r;
  };
  const clignotants = {
    droite: [feu(L / 2 - 0.42, W / 2 - 0.22, 0.34, 0.2, TEINTES.clignotant), feu(-L / 2 + 0.08, W / 2 - 0.22, 0.34, 0.2, TEINTES.clignotant)],
    gauche: [feu(L / 2 - 0.42, -W / 2 + 0.02, 0.34, 0.2, TEINTES.clignotant), feu(-L / 2 + 0.08, -W / 2 + 0.02, 0.34, 0.2, TEINTES.clignotant)],
  };
  const stops = [feu(-L / 2 - 0.02, -W / 2 + 0.3, 0.12, 0.38, TEINTES.stop), feu(-L / 2 - 0.02, W / 2 - 0.68, 0.12, 0.38, TEINTES.stop)];
  // Feux de recul : deux feux blancs, chacun juste devant un feu stop, de mêmes dimensions.
  const reculs = [feu(-L / 2 + 0.1, -W / 2 + 0.3, 0.12, 0.38, TEINTES.recul), feu(-L / 2 + 0.1, W / 2 - 0.68, 0.12, 0.38, TEINTES.recul)];
  if (!avecPortiere) return { g, clignotants, stops, reculs, portiere: null };
  const { charniere: hx, longueur: lp } = PORTIERE, hy = -W / 2, ep = PORTIERE_DESSIN.epaisseur;
  const ouverture = svg("rect", { x: hx - lp, y: hy, width: lp, height: ep, fill: TEINTES.habitacle, display: "none" });
  const battant = svg("g", { class: "scene-portiere", display: "none" });
  battant.appendChild(svg("rect", { x: -lp, y: 0, width: lp, height: ep, rx: ep / 3, fill: teinte, stroke: bord,
    "stroke-width": PORTIERE_DESSIN.trait }));
  const fleche = svg("g", { class: "scene-fleche-portiere", display: "none" });
  const { traitFleche, lisere } = PORTIERE_DESSIN;
  const arcLisere = svg("path", { fill: "none", stroke: bord, "stroke-width": traitFleche + 2 * lisere, "stroke-linecap": "round" });
  const arc = svg("path", { fill: "none", stroke: TEINTES.trajet, "stroke-width": traitFleche, "stroke-linecap": "round" });
  const pointe = svg("path", { fill: TEINTES.trajet, stroke: bord, "stroke-width": lisere, "stroke-linejoin": "round" });
  fleche.append(arcLisere, arc, pointe);
  g.append(ouverture, battant, fleche);
  return { g, clignotants, stops, reculs, portiere: { ouverture, battant, fleche, arcs: [arcLisere, arc], pointe } };
}

// Cycliste vu du dessus : la pièce partagée avec le dessin des angles morts (js/piece-cycliste.js : gabarit, teintes, choix de
// dessin), en repère local (x vers l'avant, y vers la droite, en mètres), que chaque image pose par le transform du groupe.
function dessinerVelo() {
  return { g: versDom(cycliste({ class: "scene-velo" })), clignotants: null, stops: null, reculs: null, portiere: null };
}

function dessinerPieton() {
  const g = svg("g");
  g.appendChild(svg("circle", { r: 0.95, fill: "none", stroke: TEINTES.pieton, "stroke-width": 0.12, opacity: 0.55 }));   // halo de lisibilité
  g.appendChild(svg("circle", { r: 0.25, fill: TEINTES.pieton }));
  return { g, clignotants: null, stops: null, reculs: null, portiere: null };
}

// Repères numérotés des étapes (animations réduites), au plus près de la position de l'élève au début de chacune, à la
// place que donne la règle (reperesEtapes ; jamais sous sa voiture) : un disque, ou une pastille qui porte le libellé de
// toutes les étapes qui partagent le repère (libelleRepere : « 5·6·7 », « 10-15 »).
function dessinerReperes(sc) {
  const g = svg("g", { class: "scene-reperes" });
  for (const r of reperesEtapes(sc)) {
    const demi = demiLargeurRepere(r.numeros);
    g.appendChild(svg("rect", { x: f3(r.x - demi), y: f3(r.y - RAYON_REPERE), width: f3(2 * demi), height: 2 * RAYON_REPERE,
      rx: RAYON_REPERE, fill: "#FFFFFF", stroke: TEINTES.repere, "stroke-width": 0.15 }));
    const texte = svg("text", { x: f3(r.x), y: f3(r.y + 0.45), "text-anchor": "middle", "font-size": 1.2,
      fill: TEINTES.repere, "font-family": "Geist Mono, ui-monospace, monospace" });
    texte.textContent = libelleRepere(r.numeros);
    g.appendChild(texte);
  }
  return g;
}

// Portière d'une voiture dans l'état e (son angle, e.portiere, en degrés) : le battant tourne autour de la charnière ;
// l'ouverture du flanc et le battant se montrent dès que la portière quitte 0 degré. Sur une image figée (pas à pas, pause,
// fin de lecture, animations réduites), la flèche montre le mouvement de la portière pendant l'étape en cours, de son angle
// au début de l'étape à son angle à la fin ; une étape où elle ne bouge pas n'a pas de flèche, la lecture non plus.
function rendrePortiere(p, acteur, e, etape, fige) {
  const ouverte = e.portiere > 0;
  p.ouverture.setAttribute("display", ouverte ? "inline" : "none");
  p.battant.setAttribute("display", ouverte ? "inline" : "none");
  p.battant.setAttribute("transform", `translate(${n3(PORTIERE.charniere)} ${n3(-GABARITS.voiture.largeur / 2)}) rotate(${e.portiere.toFixed(2)})`);
  const a0 = anglePortiere(acteur.portiere, etape.t), a1 = anglePortiere(acteur.portiere, etape.fin);
  if (fige && Math.abs(a1 - a0) > 1e-9) {
    const f = flechePortiere(a0, a1);
    p.arcs.forEach((arc) => arc.setAttribute("d", f.arc));
    p.pointe.setAttribute("d", f.pointe);
    p.fleche.setAttribute("display", "inline");
  } else {
    p.fleche.setAttribute("display", "none");
  }
}

export function monterScene(def, { conteneur, etapes = [], reduit = false, onEtape = null } = {}) {
  const sc = preparerScene(def);
  const racine = svg("svg", { class: reduit ? "scene-svg scene-reduite" : "scene-svg", role: "img", "aria-label": sc.titre });
  // Tout le dessin est découpé au cadre courant : rien de ce qui est hors du cadre (le monde au-delà de ses bords, un
  // véhicule qui doit entrer par un bord) n'apparaît, même si la boîte du SVG laissait des bandes autour du cadre.
  const idDecoupe = `scene-cadre-${++numeroScene}`;
  const rectCadre = svg("rect");
  const decoupe = svg("clipPath", { id: idDecoupe });
  decoupe.appendChild(rectCadre);
  const defs = svg("defs");
  defs.appendChild(decoupe);
  const dessin = svg("g", { "clip-path": `url(#${idDecoupe})` });
  racine.appendChild(defs);
  racine.appendChild(dessin);

  dessin.appendChild(svg("rect", { x: -200, y: -200, width: sc.monde.largeur + 400, height: sc.monde.hauteur + 400, fill: TEINTES.chaussee }));
  for (const o of sc.decor.obstacles) {
    dessin.appendChild(svg("path", { d: chemin(o.poly), fill: o.nature === "ilot" ? TEINTES.ilot : TEINTES.trottoir }));
  }
  const marquage = svg("g");
  sc.decor.marquages.forEach((m) => dessinerMarquage(marquage, m, sc.decor.centre));
  dessin.appendChild(marquage);
  dessinerTrajet(dessin, sc);
  sc.decor.panneaux.forEach((p) => dessinerPanneau(dessin, p));
  const cone = svg("path", { fill: TEINTES.regard, opacity: OPACITE_REGARD.cone, display: "none" });
  dessin.appendChild(cone);
  // Les repères passent sous les usagers : ils ne cachent jamais la voiture.
  if (reduit) dessin.appendChild(dessinerReperes(sc));
  const vues = new Map();
  for (const a of sc.acteurs) {
    const v = a.gabarit === "pieton" ? dessinerPieton()
      : a.gabarit === "velo" ? dessinerVelo()
        : dessinerVoiture(a.role === "eleve" ? TEINTES.eleve : TEINTES.autre, a.role === "eleve" ? TEINTES.eleveBord : TEINTES.autreBord,
          Boolean(a.portiere));
    dessin.appendChild(v.g);
    vues.set(a.id, v);
  }

  // Cadre : viewBox et découpe ensemble.
  function cadrer(c) {
    racine.setAttribute("viewBox", `${f3(c.x)} ${f3(c.y)} ${n3(c.largeur)} ${n3(c.hauteur)}`);
    rectCadre.setAttribute("x", f3(c.x));
    rectCadre.setAttribute("y", f3(c.y));
    rectCadre.setAttribute("width", n3(c.largeur));
    rectCadre.setAttribute("height", n3(c.hauteur));
  }
  // En lecture, le cadre suit l'élève (caméra) et garde sa taille ; en animations réduites, il est posé une fois pour
  // toutes sur l'ensemble des étapes. Ses proportions sont celles de la boîte du SVG (css/cours-blocs.css).
  const premierCadre = reduit ? cadreReduit(sc) : cadreCamera(sc, etatActeur(sc.eleve, 0));
  racine.style.setProperty("--scene-l", n3(premierCadre.largeur));
  racine.style.setProperty("--scene-h", n3(premierCadre.hauteur));
  if (reduit) {
    // Animations réduites : la largeur reste celle de la lecture (même échelle) et la hauteur suit le cadre, sans borne.
    const lecture = sc.camera || sc.monde;
    racine.style.setProperty("--scene-lecture-l", n3(lecture.largeur));
    racine.style.setProperty("--scene-lecture-h", n3(lecture.hauteur));
  }
  cadrer(premierCadre);

  // Image de la scène à `instant` ; `fige` : pas à pas, pause, fin de lecture ou animations réduites. Elle montre l'état de la
  // scène, pas une phase d'animation.
  function rendre(instant, fige) {
    const etats = new Map(sc.acteurs.map((a) => [a.id, etatActeur(a, instant)]));
    const k = etapeA(sc.etapes, instant);
    for (const a of sc.acteurs) {
      const e = etats.get(a.id), v = vues.get(a.id);
      v.g.setAttribute("display", e.visible ? "inline" : "none");
      v.g.setAttribute("transform", `translate(${f3(e.x)} ${f3(e.y)}) rotate(${(e.cap / DEG).toFixed(2)})`);
      if (v.clignotants) {
        const allume = clignotantAllume(e, instant, fige);
        for (const cote of ["droite", "gauche"]) {
          v.clignotants[cote].forEach((n) => n.setAttribute("opacity", allume === cote ? 1 : 0));
        }
        v.stops.forEach((n) => n.setAttribute("opacity", feuxStop(a, e) ? 1 : 0));
        const recul = feuxDeRecul(e);
        v.reculs.forEach((n) => n.setAttribute("opacity", recul ? 1 : 0));
      }
      if (v.portiere) rendrePortiere(v.portiere, a, e, sc.etapes[k], fige);
    }
    const e = etats.get(sc.eleve.id);
    // Sur une image figée, en animations réduites comme en pas à pas, le regard de l'étape reste dessiné : le cône d'un
    // angle ou d'un usager suivi ; pour un balayage, plus léger, le secteur qu'il parcourt (75 + 16 degrés de part et
    // d'autre du cap, sur REGARD_PORTEE) ; pour un tour du regard, quatre cônes (devant, à gauche, derrière, à droite) ; au
    // lieu de la direction que leur mouvement aurait à cet instant. Les quatre cônes forment un seul tracé.
    const regard = regardDessine(sc.etapes[k], e, instant, etats, fige);
    if (!regard) {
      cone.setAttribute("display", "none");
    } else {
      cone.setAttribute("d", (regard.polys || [regard.poly]).map(chemin).join(" "));
      cone.setAttribute("opacity", OPACITE_REGARD[regard.forme]);
      cone.setAttribute("display", "inline");
    }
    // La caméra suit l'élève en lecture ; en animations réduites, le cadre posé au montage ne bouge pas.
    if (sc.camera && !reduit) cadrer(cadreCamera(sc, e));
  }

  // Un appui sur une étape éloignée peut laisser la voiture de l'élève hors de l'écran (en animations réduites, le schéma
  // peut être plus haut que l'écran d'un téléphone) : on la ramène, sans animation, si elle n'est pas déjà visible. Visible,
  // c'est ce que l'œil verrait : l'élément le plus haut au centre de la voiture fait encore partie du schéma, donc elle n'est
  // ni hors de l'écran, ni rognée par la zone qui défile, ni cachée sous une barre collante. Centrée plutôt que collée au
  // bord, pour ne pas finir sous cette barre.
  function montrerVoiture() {
    const voiture = vues.get(sc.eleve.id).g;
    const r = voiture.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;      // voiture masquée, ou schéma sorti du document : rien à montrer
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (dessus && racine.contains(dessus)) return;
    voiture.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  }

  const lecteur = monterLecteur({ racine, conteneur, duree: sc.duree, etapes: sc.etapes, vitesseLecture: sc.vitesseLecture || 1,
    reduit, elementsEtapes: etapes, rendre, onEtape, apresEtape: montrerVoiture });
  return { ...lecteur, scene: sc };
}
