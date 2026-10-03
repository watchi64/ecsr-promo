/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Moteur des schémas animés : dessine une scène du registre (js/scenes.js) en
 * SVG, à l'échelle réelle (une unité = un mètre), et l'anime en temps réel.
 * Tout est construit par l'API du DOM : aucun texte de cours ne devient du code.
 * La géométrie est celle de js/scene-geometrie.js, la même que celle des tests ;
 * le regard du conducteur et son cône sont ceux de js/scene-regard.js.
 *
 * Sobriété : la lecture démarre quand le schéma devient visible, une seule fois,
 * puis attend « Rejouer » ; elle s'arrête si le schéma sort de l'écran ou du
 * document. Animations réduites : schéma à l'arrêt, étapes numérotées le long du
 * trajet, un appui sur une étape y place la voiture.
 */
import { preparerScene, etatActeur, pointA, GABARITS, DEG } from "./scene-geometrie.js?v=20261003c";
import { oeil, angleRegard, coneRegard, REGARD_PORTEE } from "./scene-regard.js?v=20261003c";
import { urlSignalVerifie } from "./signaux.js?v=20261003c";

const NS = "http://www.w3.org/2000/svg";
// Teintes de la route réelle (donnée pédagogique), pas la palette de l'app ; la
// voiture de l'élève prend l'accent de l'app pour être repérée d'un coup d'œil.
const TEINTES = {
  chaussee: "#5D635B", trottoir: "#DAD6CA", ilot: "#B9CB9B", peinture: "#FFFFFF",
  eleve: "#6B7F4E", eleveBord: "#3E4A2D", autre: "#8D97A3", autreBord: "#4E5863",
  pieton: "#2E2E2B", clignotant: "#F4A900", stop: "#D2232A", vitre: "#C9D6DF",
  regard: "#FFD45C", trajet: "#FFFFFF", repere: "#1F2924",
};
const TAILLE_PANNEAU = 2.6;    // m : panneaux AGRANDIS pour rester lisibles (consigné dans les fiches)
const FREQ_CLIGNOTANT = 1.5;   // Hz
const DEBORD_SUIVI = 2;        // m : le cône d'un regard qui suit un usager dépasse celui-ci de 2 m

function svg(nom, attrs = {}) {
  const n = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
const f3 = (x) => x.toFixed(3);
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

function dessinerPanneau(parent, p) {
  const url = urlSignalVerifie(p.code);
  if (!url) return;                                  // jamais deviné
  const g = svg("g", { class: "scene-panneau" });
  g.appendChild(svg("circle", { cx: f3(p.x), cy: f3(p.y), r: 0.25, fill: TEINTES.repere }));   // position réelle
  g.appendChild(svg("image", { x: f3(p.x - TAILLE_PANNEAU / 2), y: f3(p.y - TAILLE_PANNEAU - 0.3),
    width: TAILLE_PANNEAU, height: TAILLE_PANNEAU, href: url }));
  parent.appendChild(g);
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
  return { g, clignotants, stops };
}

function dessinerPieton() {
  const g = svg("g");
  g.appendChild(svg("circle", { r: 0.95, fill: "none", stroke: TEINTES.pieton, "stroke-width": 0.12, opacity: 0.55 }));   // halo de lisibilité
  g.appendChild(svg("circle", { r: 0.25, fill: TEINTES.pieton }));
  return { g, clignotants: null, stops: null };
}

// Longueur (m) du cône du regard : la portée de js/scene-regard.js. Un regard qui suit un usager s'arrête 2 m au-delà
// de lui : le cône désigne la personne regardée au lieu de déborder du cadre. Même ordre de priorité qu'angleRegard
// (balayage, angle, puis suivre) ; appelée seulement quand angleRegard a rendu une direction, donc quand la cible
// d'un regard qui suit est connue et visible.
function longueurCone(regard, o, etats) {
  if (regard.balayage || typeof regard.angle === "number" || !regard.suivre) return REGARD_PORTEE;
  const cible = etats.get(regard.suivre);
  return Math.min(REGARD_PORTEE, Math.hypot(cible.x - o.x, cible.y - o.y) + DEBORD_SUIVI);
}

// Triangle du cône : celui de coneRegard (js/scene-regard.js, que les tests des scènes contrôlent), ramené autour de
// l'œil à `longueur` m quand le regard suit un usager.
function triangleCone(angle, o, longueur) {
  const triangle = coneRegard(angle, o);
  if (longueur >= REGARD_PORTEE) return triangle;
  const k = longueur / REGARD_PORTEE;
  return triangle.map(([x, y]) => [o.x + (x - o.x) * k, o.y + (y - o.y) * k]);
}

function reperesEtapes(sc) {
  const g = svg("g", { class: "scene-reperes" });
  const groupes = [];
  sc.etapes.forEach((et, i) => {
    const e = etatActeur(sc.eleve, et.t);
    const proche = groupes.find((x) => Math.hypot(x.x - e.x, x.y - e.y) < 1.5);
    if (proche) proche.num.push(i + 1); else groupes.push({ x: e.x, y: e.y, num: [i + 1] });
  });
  for (const x of groupes) {
    g.appendChild(svg("circle", { cx: f3(x.x), cy: f3(x.y), r: 1.2, fill: "#FFFFFF", stroke: TEINTES.repere, "stroke-width": 0.15 }));
    const texte = svg("text", { x: f3(x.x), y: f3(x.y + 0.45), "text-anchor": "middle", "font-size": 1.2,
      fill: TEINTES.repere, "font-family": "Geist Mono, ui-monospace, monospace" });
    texte.textContent = x.num.join("·");
    g.appendChild(texte);
  }
  return g;
}

export function monterScene(def, { conteneur, etapes = [], reduit = false, onEtape = null } = {}) {
  const sc = preparerScene(def);
  const racine = svg("svg", { class: "scene-svg", role: "img", "aria-label": sc.titre,
    viewBox: sc.camera ? `0 0 ${sc.camera.largeur} ${sc.camera.hauteur}` : `0 0 ${sc.monde.largeur} ${sc.monde.hauteur}` });
  racine.appendChild(svg("rect", { x: -200, y: -200, width: sc.monde.largeur + 400, height: sc.monde.hauteur + 400, fill: TEINTES.chaussee }));
  for (const o of sc.decor.obstacles) {
    racine.appendChild(svg("path", { d: chemin(o.poly), fill: o.nature === "ilot" ? TEINTES.ilot : TEINTES.trottoir }));
  }
  const marquage = svg("g");
  sc.decor.marquages.forEach((m) => dessinerMarquage(marquage, m, sc.decor.centre));
  racine.appendChild(marquage);
  const points = [];
  for (let s = 0; s <= sc.eleve.chemin.longueur; s += 0.5) {
    const p = pointA(sc.eleve.chemin, s);
    points.push(f3(p.x) + "," + f3(p.y));
  }
  racine.appendChild(svg("polyline", { points: points.join(" "), fill: "none", stroke: TEINTES.trajet,
    "stroke-width": 0.12, "stroke-dasharray": "0.6 0.6", opacity: 0.6 }));
  sc.decor.panneaux.forEach((p) => dessinerPanneau(racine, p));
  const cone = svg("path", { fill: TEINTES.regard, opacity: 0.4, display: "none" });
  racine.appendChild(cone);
  const vues = new Map();
  for (const a of sc.acteurs) {
    const v = a.gabarit === "pieton" ? dessinerPieton()
      : dessinerVoiture(a.role === "eleve" ? TEINTES.eleve : TEINTES.autre, a.role === "eleve" ? TEINTES.eleveBord : TEINTES.autreBord);
    racine.appendChild(v.g);
    vues.set(a.id, v);
  }
  if (reduit) racine.appendChild(reperesEtapes(sc));

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
  if ((sc.vitesseLecture || 1) !== 1) {
    const facteur = document.createElement("span");
    facteur.className = "scene-facteur";
    facteur.textContent = "× " + sc.vitesseLecture;
    barre.append(facteur);
  }
  conteneur.append(racine, barre);

  let t = 0, enCours = false, raf = 0, dernier = 0, etapeCourante = -1, dejaVu = false, observateur = null;

  function rendre(instant) {
    const etats = new Map(sc.acteurs.map((a) => [a.id, etatActeur(a, instant)]));
    let k = 0;
    sc.etapes.forEach((et, i) => { if (instant + 1e-9 >= et.t) k = i; });
    for (const a of sc.acteurs) {
      const e = etats.get(a.id), v = vues.get(a.id);
      v.g.setAttribute("display", e.visible ? "inline" : "none");
      v.g.setAttribute("transform", `translate(${f3(e.x)} ${f3(e.y)}) rotate(${(e.cap / DEG).toFixed(2)})`);
      if (v.clignotants) {
        const allume = e.clignotant && Math.floor(instant * FREQ_CLIGNOTANT * 2) % 2 === 0;
        for (const cote of ["droite", "gauche"]) {
          v.clignotants[cote].forEach((n) => n.setAttribute("opacity", allume && e.clignotant === cote ? 1 : 0));
        }
        v.stops.forEach((n) => n.setAttribute("opacity", e.a < -0.3 || e.v < 0.05 ? 1 : 0));
      }
    }
    const e = etats.get(sc.eleve.id);
    const etape = sc.etapes[k];
    const ang = reduit ? null : angleRegard(etape, e, instant, etats);
    if (ang === null) {
      cone.setAttribute("display", "none");
    } else {
      const o = oeil(e);
      cone.setAttribute("d", chemin(triangleCone(ang, o, longueurCone(etape.regard, o, etats))));
      cone.setAttribute("display", "inline");
    }
    if (sc.camera) {
      const w = sc.camera.largeur, h = sc.camera.hauteur;
      const x0 = Math.min(Math.max(e.x - w / 2, 0), sc.monde.largeur - w);
      const y0 = Math.min(Math.max(e.y - h / 2, 0), sc.monde.hauteur - h);
      racine.setAttribute("viewBox", `${f3(x0)} ${f3(y0)} ${w} ${h}`);
    }
    if (k !== etapeCourante) {
      etapeCourante = k;
      etapes.forEach((li, i) => li.classList.toggle("on", i === k));
      if (onEtape) onEtape(k);
    }
  }

  function majBouton() {
    lecture.textContent = enCours ? "Pause" : (t >= sc.duree ? "Revoir" : "Lecture");
    lecture.setAttribute("aria-pressed", enCours ? "true" : "false");
  }
  function boucle(maintenant) {
    if (!racine.isConnected) { detruire(); return; }
    const dt = Math.min(0.1, (maintenant - dernier) / 1000) * (sc.vitesseLecture || 1);
    dernier = maintenant;
    t = Math.min(sc.duree, t + dt);
    rendre(t);
    if (t >= sc.duree) { enCours = false; majBouton(); return; }
    raf = requestAnimationFrame(boucle);
  }
  function jouer() {
    if (enCours) return;
    if (t >= sc.duree) t = 0;
    enCours = true;
    dernier = performance.now();
    raf = requestAnimationFrame(boucle);
    majBouton();
  }
  function pause() { enCours = false; cancelAnimationFrame(raf); majBouton(); }
  function rejouer() { pause(); t = 0; rendre(0); jouer(); }
  function allerEtape(i) { pause(); t = sc.etapes[i].t; rendre(t); majBouton(); }
  function detruire() { cancelAnimationFrame(raf); enCours = false; if (observateur) observateur.disconnect(); }

  lecture.addEventListener("click", () => (enCours ? pause() : jouer()));
  rejouerBtn.addEventListener("click", rejouer);
  rendre(0);
  majBouton();
  if (!reduit && typeof IntersectionObserver === "function") {
    observateur = new IntersectionObserver((entrees) => {
      const visible = entrees.some((x) => x.isIntersecting);
      if (visible && !dejaVu) { dejaVu = true; jouer(); }
      else if (!visible && enCours) pause();
    }, { threshold: 0.6 });
    observateur.observe(racine);
  }
  return { jouer, pause, rejouer, allerEtape, detruire, scene: sc };
}
