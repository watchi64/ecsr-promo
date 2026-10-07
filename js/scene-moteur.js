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
import { preparerScene, etatActeur, pointA, GABARITS, DEG } from "./scene-geometrie.js?v=20261005f";
import { regardDessine, etapeBornee } from "./scene-regard.js?v=20261005f";
import { TEINTES, RAYON_REPERE, clignotantAllume, feuxDeRecul, feuxStop, cadreCamera, cadreReduit, reperesEtapes,
  demiLargeurRepere, emprisePanneau, facteurLecture, SEUILS_VISIBILITE, actionVisibilite } from "./scene-rendu.js?v=20261005f";
import { urlSignalVerifie } from "./signaux.js?v=20261005f";

const NS = "http://www.w3.org/2000/svg";
// Opacité du regard : le cône, ou, plus léger, le secteur que parcourt un balayage ou un tour du regard sur une image figée.
const OPACITE_REGARD = { cone: 0.4, secteur: 0.22 };
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
// dans la teinte TEINTES.trajet, lisible sur la chaussée.
function dessinerTrajet(parent, sc) {
  const points = [];
  for (let s = 0; s <= sc.eleve.chemin.longueur; s += 0.5) {
    const p = pointA(sc.eleve.chemin, s);
    points.push(f3(p.x) + "," + f3(p.y));
  }
  parent.appendChild(svg("polyline", { points: points.join(" "), fill: "none", stroke: TEINTES.trajet,
    "stroke-width": 0.22, "stroke-linecap": "round", "stroke-dasharray": "0.01 0.44" }));
}

// Voiture en repère local : x vers l'avant, y vers la droite.
function dessinerVoiture(teinte, bord) {
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
  return { g, clignotants, stops, reculs };
}

function dessinerPieton() {
  const g = svg("g");
  g.appendChild(svg("circle", { r: 0.95, fill: "none", stroke: TEINTES.pieton, "stroke-width": 0.12, opacity: 0.55 }));   // halo de lisibilité
  g.appendChild(svg("circle", { r: 0.25, fill: TEINTES.pieton }));
  return { g, clignotants: null, stops: null, reculs: null };
}

// Repères numérotés des étapes (animations réduites), à droite de la position de l'élève au début de chacune (jamais sous
// sa voiture) : un disque, ou une pastille qui contient tous les numéros quand plusieurs étapes partagent le repère.
function dessinerReperes(sc) {
  const g = svg("g", { class: "scene-reperes" });
  for (const r of reperesEtapes(sc)) {
    const demi = demiLargeurRepere(r.numeros);
    g.appendChild(svg("rect", { x: f3(r.x - demi), y: f3(r.y - RAYON_REPERE), width: f3(2 * demi), height: 2 * RAYON_REPERE,
      rx: RAYON_REPERE, fill: "#FFFFFF", stroke: TEINTES.repere, "stroke-width": 0.15 }));
    const texte = svg("text", { x: f3(r.x), y: f3(r.y + 0.45), "text-anchor": "middle", "font-size": 1.2,
      fill: TEINTES.repere, "font-family": "Geist Mono, ui-monospace, monospace" });
    texte.textContent = r.numeros.join("·");
    g.appendChild(texte);
  }
  return g;
}

// Étape courante : classe « on » sur l'élément de l'étape, aria-current sur son bouton (c'est lui qui reçoit le focus)
// ou, sans bouton, sur l'élément lui-même.
function marquerEtape(element, courante) {
  element.classList.toggle("on", courante);
  const cible = (element.querySelector && element.querySelector("button")) || element;
  if (courante) cible.setAttribute("aria-current", "step");
  else cible.removeAttribute("aria-current");
}

export function monterScene(def, { conteneur, etapes = [], reduit = false, onEtape = null } = {}) {
  const sc = preparerScene(def);
  // Chaque étape avec sa fin : un tour du regard se règle sur les bornes de son étape (js/scene-regard.js).
  const etapesBornees = sc.etapes.map((_, k) => etapeBornee(sc, k));
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
      : dessinerVoiture(a.role === "eleve" ? TEINTES.eleve : TEINTES.autre, a.role === "eleve" ? TEINTES.eleveBord : TEINTES.autreBord);
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

  const barre = document.createElement("div");
  barre.className = "scene-commandes";
  const lecture = document.createElement("button");
  lecture.type = "button";
  lecture.className = "btn";
  const rejouerBtn = document.createElement("button");
  rejouerBtn.type = "button";
  rejouerBtn.className = "btn ghost";
  rejouerBtn.textContent = "Rejouer";
  barre.append(lecture, rejouerBtn);
  const facteur = facteurLecture(sc.vitesseLecture || 1);
  if (facteur) {
    // « × 0,5 » à l'écran ; les lecteurs d'écran lisent la phrase en clair.
    const span = document.createElement("span");
    span.className = "scene-facteur";
    const vu = document.createElement("span");
    vu.setAttribute("aria-hidden", "true");
    vu.textContent = facteur.texte;
    const lu = document.createElement("span");
    lu.className = "scene-lecteur-ecran";
    lu.textContent = facteur.libelle;
    span.append(vu, lu);
    barre.append(span);
  }
  conteneur.append(racine, barre);

  let t = 0, enCours = false, raf = 0, dernier = 0, etapeCourante = -1, dejaVu = false, observateur = null;

  function rendre(instant) {
    // Image figée (pas à pas, pause, fin de lecture, animations réduites) : l'état de la scène, pas une phase d'animation.
    const fige = reduit || !enCours;
    const etats = new Map(sc.acteurs.map((a) => [a.id, etatActeur(a, instant)]));
    let k = 0;
    sc.etapes.forEach((et, i) => { if (instant + 1e-9 >= et.t) k = i; });
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
    }
    const e = etats.get(sc.eleve.id);
    // Sur une image figée, en animations réduites comme en pas à pas, le regard de l'étape reste dessiné : le cône d'un
    // angle ou d'un usager suivi, et, plus léger, pour un balayage le secteur qu'il parcourt (75 + 16 degrés de part et
    // d'autre du cap, sur REGARD_PORTEE), pour un tour du regard tout le tour de l'œil (le disque de rayon REGARD_PORTEE),
    // au lieu de la direction que leur mouvement aurait à cet instant.
    const regard = regardDessine(etapesBornees[k], e, instant, etats, fige);
    if (!regard) {
      cone.setAttribute("display", "none");
    } else {
      cone.setAttribute("d", chemin(regard.poly));
      cone.setAttribute("opacity", OPACITE_REGARD[regard.forme]);
      cone.setAttribute("display", "inline");
    }
    // La caméra suit l'élève en lecture ; en animations réduites, le cadre posé au montage ne bouge pas.
    if (sc.camera && !reduit) cadrer(cadreCamera(sc, e));
    if (k !== etapeCourante) {
      etapeCourante = k;
      etapes.forEach((element, i) => marquerEtape(element, i === k));
      if (onEtape) onEtape(k);
    }
  }

  // Le libellé du bouton porte l'état (Lecture, Pause, Revoir) : pas d'aria-pressed, qui le doublerait.
  function majBouton() {
    lecture.textContent = enCours ? "Pause" : (t >= sc.duree ? "Revoir" : "Lecture");
  }
  function arreter() { enCours = false; cancelAnimationFrame(raf); }
  function boucle(maintenant) {
    if (!racine.isConnected) { detruire(); return; }
    const dt = Math.min(0.1, (maintenant - dernier) / 1000) * (sc.vitesseLecture || 1);
    dernier = maintenant;
    t = Math.min(sc.duree, t + dt);
    if (t >= sc.duree) { enCours = false; rendre(t); majBouton(); return; }   // la dernière image est une image figée
    rendre(t);
    raf = requestAnimationFrame(boucle);
  }
  // Une lecture demandée, comme un appui sur une étape, l'emporte sur la lecture automatique à la première visibilité.
  function jouer() {
    dejaVu = true;
    if (enCours) return;
    if (t >= sc.duree) t = 0;
    enCours = true;
    dernier = performance.now();
    raf = requestAnimationFrame(boucle);
    majBouton();
  }
  function pause() { arreter(); rendre(t); majBouton(); }
  function rejouer() { arreter(); t = 0; rendre(0); jouer(); }
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
  function allerEtape(i) { dejaVu = true; arreter(); t = sc.etapes[i].t; rendre(t); majBouton(); montrerVoiture(); }
  function detruire() { arreter(); if (observateur) observateur.disconnect(); majBouton(); }

  lecture.addEventListener("click", () => (enCours ? pause() : jouer()));
  rejouerBtn.addEventListener("click", rejouer);
  rendre(0);
  majBouton();
  if (!reduit && typeof IntersectionObserver === "function") {
    // Seuils 0 et 60 % : le rappel part quand le schéma sort tout à fait de l'écran et quand il atteint 60 %. La décision
    // (démarrer, mettre en pause, ne rien faire) est celle de js/scene-rendu.js, sur la part visible de la dernière entrée.
    observateur = new IntersectionObserver((entrees) => {
      const action = actionVisibilite(entrees[entrees.length - 1].intersectionRatio, dejaVu, enCours);
      if (action === "demarrer") jouer();
      else if (action === "pause") pause();
    }, { threshold: SEUILS_VISIBILITE });
    observateur.observe(racine);
  }
  return { jouer, pause, rejouer, allerEtape, detruire, scene: sc };
}
