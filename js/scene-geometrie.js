/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Géométrie des scènes animées des cours de compétences. Module pur (ni DOM ni
 * réseau) : le moteur de rendu et les tests le partagent, et les tests vérifient
 * donc exactement ce qui est dessiné.
 *
 * Unités : mètres, secondes, radians (les constructeurs prennent des degrés).
 * Repère de l'écran : x vers la droite, y vers le BAS. Un cap se mesure depuis
 * +x et croît dans le sens des aiguilles d'une montre à l'écran : tourner à
 * droite fait croître le cap, tourner à gauche le fait décroître.
 */

export const DEG = Math.PI / 180;
export const KMH = 1 / 3.6;

/** Gabarits réels, en mètres. */
export const GABARITS = {
  voiture: { longueur: 4.5, largeur: 1.8 },
  pieton: { longueur: 0.5, largeur: 0.5 },
};

// ===== Segments et trajets =====

/** Point et cap atteints après `s` mètres sur un segment (droite ou arc). */
export function pointSurSegment(seg, s) {
  if (seg.type === "droite") {
    return { x: seg.x0 + Math.cos(seg.cap) * s, y: seg.y0 + Math.sin(seg.cap) * s, cap: seg.cap };
  }
  const sens = Math.sign(seg.angle);            // +1 : virage à droite
  const c = centreArc(seg);
  const cap = seg.cap + (sens * s) / seg.rayon;
  return { x: c.x + sens * seg.rayon * Math.sin(cap), y: c.y - sens * seg.rayon * Math.cos(cap), cap };
}

/** Centre d'un segment en arc : à droite du cap pour un virage à droite, à gauche sinon. */
export function centreArc(seg) {
  const sens = Math.sign(seg.angle);
  return { x: seg.x0 - sens * seg.rayon * Math.sin(seg.cap), y: seg.y0 + sens * seg.rayon * Math.cos(seg.cap) };
}

/**
 * Trajet « à la tortue » : un départ, puis des lignes droites, des arcs et des
 * décalages latéraux, toujours tangents entre eux.
 */
export function trajet(x, y, capDeg) {
  const segments = [];
  let px = x, py = y, cap = capDeg * DEG, longueur = 0;
  function poser(seg) {
    segments.push(seg);
    const fin = pointSurSegment(seg, seg.longueur);
    px = fin.x; py = fin.y; cap = fin.cap;
    longueur += seg.longueur;
  }
  const api = {
    droit(l, options = {}) {
      if (!(l > 0)) throw new Error("trajet.droit : longueur positive attendue");
      poser({ ...options, type: "droite", x0: px, y0: py, cap, longueur: l, debut: longueur });
      return api;
    },
    virage(rayon, angleDeg, options = {}) {
      if (!(rayon > 0) || !angleDeg) throw new Error("trajet.virage : rayon positif et angle non nul attendus");
      const angle = angleDeg * DEG;
      poser({ ...options, type: "arc", x0: px, y0: py, cap, rayon, angle, longueur: rayon * Math.abs(angle), debut: longueur });
      return api;
    },
    // Décalage latéral (positif vers la droite) sur une longueur donnée : deux arcs
    // opposés de même rayon ; theta = 2 atan(d / L), rayon = L / (2 sin theta).
    decaler(decalage, l, options = {}) {
      if (!decalage || !(l > 0)) throw new Error("trajet.decaler : décalage non nul et longueur positive attendus");
      const theta = 2 * Math.atan(Math.abs(decalage) / l);
      const rayon = l / (2 * Math.sin(theta));
      const sens = Math.sign(decalage);
      api.virage(rayon, (sens * theta) / DEG, { ...options, decalage: true, premier: true });
      api.virage(rayon, (-sens * theta) / DEG, { ...options, decalage: true });
      return api;
    },
    get longueur() { return longueur; },
    get position() { return { x: px, y: py, cap }; },
    get nbSegments() { return segments.length; },
    fin() { return { segments: segments.slice(), longueur }; },
  };
  return api;
}

function segmentA(chemin, s) {
  const segs = chemin.segments;
  if (!segs.length) throw new Error("trajet vide");
  const sc = Math.max(0, Math.min(chemin.longueur, s));
  for (const seg of segs) if (sc < seg.debut + seg.longueur) return { seg, d: sc - seg.debut };
  const der = segs[segs.length - 1];
  return { seg: der, d: der.longueur };
}

/** Point et cap à l'abscisse curviligne s (bornée au trajet). */
export function pointA(chemin, s) {
  const { seg, d } = segmentA(chemin, s);
  return pointSurSegment(seg, d);
}

/** Courbure signée à l'abscisse s : > 0 à droite, < 0 à gauche, 0 en ligne droite. */
export function courbureA(chemin, s) {
  const { seg } = segmentA(chemin, s);
  return seg.type === "arc" ? Math.sign(seg.angle) / seg.rayon : 0;
}

/** Rotation d'un point autour de (cx, cy) ; angle en degrés, positif dans le sens horaire à l'écran. */
export function tournerPoint([x, y], cx, cy, angleDeg) {
  const a = angleDeg * DEG, c = Math.cos(a), s = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** Le même trajet, tourné autour de (cx, cy). */
export function tournerChemin(chemin, cx, cy, angleDeg) {
  if (!angleDeg) return chemin;
  return {
    longueur: chemin.longueur,
    segments: chemin.segments.map((seg) => {
      const [x0, y0] = tournerPoint([seg.x0, seg.y0], cx, cy, angleDeg);
      return { ...seg, x0, y0, cap: seg.cap + angleDeg * DEG };
    }),
  };
}

/** Première abscisse (pas de 1 cm) où le critère devient vrai, sinon null. */
export function premiereAbscisse(chemin, critere, pas = 0.01) {
  const n = Math.ceil(chemin.longueur / pas);
  for (let k = 0; k <= n; k++) {
    const s = Math.min(chemin.longueur, k * pas);
    if (critere(pointA(chemin, s), s)) return s;
  }
  return null;
}

/** Milieu du pare-chocs avant d'un gabarit centré au point p. */
export function avant(gabarit, p) {
  const l = GABARITS[gabarit].longueur / 2;
  return { x: p.x + Math.cos(p.cap) * l, y: p.y + Math.sin(p.cap) * l };
}

// ===== Chronologie (profil de vitesse) =====

/**
 * Chronologie d'un acteur sur son trajet. `profil` : points { s, kmh } aux
 * abscisses strictement croissantes, de s = 0 à s = longueur du trajet ; entre
 * deux points, accélération constante. Un point peut porter `pause` (secondes) :
 * l'acteur y reste immobile, ce qui exige kmh = 0. `depart` retarde le départ.
 * Renvoie { echantillons: [{ t, s, v }], duree }, v en m/s, triés par t.
 */
export function chronologie(chemin, profil, { depart = 0, pas = 0.05 } = {}) {
  if (!Array.isArray(profil) || profil.length < 2) throw new Error("chronologie : au moins deux points de profil");
  if (Math.abs(profil[0].s) > 1e-9) throw new Error("chronologie : le profil commence à s = 0");
  const fin = profil[profil.length - 1].s;
  if (Math.abs(fin - chemin.longueur) > 1e-6) {
    throw new Error(`chronologie : le profil finit à s = ${fin}, le trajet mesure ${chemin.longueur.toFixed(3)} m`);
  }
  const ech = [];
  let t = 0;
  if (depart > 0) { ech.push({ t: 0, s: 0, v: 0 }); t = depart; }
  for (let i = 0; i < profil.length; i++) {
    const p = profil[i];
    if (!(p.kmh >= 0)) throw new Error(`chronologie : vitesse invalide en s = ${p.s}`);
    if (p.pause) {
      if (p.kmh !== 0) throw new Error(`chronologie : une pause exige kmh = 0 (s = ${p.s})`);
      ech.push({ t, s: p.s, v: 0 });
      t += p.pause;
    }
    if (i === profil.length - 1) { ech.push({ t, s: p.s, v: p.kmh * KMH }); break; }
    const q = profil[i + 1];
    if (!(q.s > p.s)) throw new Error(`chronologie : abscisses non croissantes en s = ${q.s}`);
    const v0 = p.kmh * KMH, v1 = q.kmh * KMH, ds = q.s - p.s;
    if (v0 === 0 && v1 === 0) throw new Error(`chronologie : vitesse nulle entre s = ${p.s} et s = ${q.s}`);
    const a = (v1 * v1 - v0 * v0) / (2 * ds);
    const vitesse = (d) => Math.sqrt(Math.max(0, v0 * v0 + 2 * a * d));
    const temps = (d) => (Math.abs(a) < 1e-9 ? d / v0 : (vitesse(d) - v0) / a);
    const n = Math.max(1, Math.ceil(ds / pas));
    for (let k = 0; k < n; k++) {
      const d = (ds * k) / n;
      ech.push({ t: t + temps(d), s: p.s + d, v: vitesse(d) });
    }
    t += temps(ds);
  }
  const propre = [];
  for (const e of ech) {
    const der = propre[propre.length - 1];
    if (der && Math.abs(der.t - e.t) < 1e-9 && Math.abs(der.s - e.s) < 1e-9) propre[propre.length - 1] = e;
    else propre.push(e);
  }
  return { echantillons: propre, duree: t };
}

/** État { s, v, a } à l'instant t (interpolation linéaire entre échantillons). */
export function etatA(chrono, t) {
  const e = chrono.echantillons;
  if (t <= e[0].t) return { s: e[0].s, v: e[0].v, a: 0 };
  const der = e[e.length - 1];
  if (t >= der.t) return { s: der.s, v: der.v, a: 0 };
  let lo = 0, hi = e.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (e[mid].t <= t) lo = mid; else hi = mid;
  }
  const A = e[lo], B = e[hi], dt = B.t - A.t;
  const f = dt > 0 ? (t - A.t) / dt : 0;
  return { s: A.s + (B.s - A.s) * f, v: A.v + (B.v - A.v) * f, a: dt > 0 ? (B.v - A.v) / dt : 0 };
}

/** Premier instant où l'acteur atteint l'abscisse s. */
export function tempsAtteint(chrono, s) {
  const e = chrono.echantillons;
  if (s <= e[0].s) return e[0].t;
  for (let i = 1; i < e.length; i++) {
    if (e[i].s >= s - 1e-9) {
      const A = e[i - 1], B = e[i];
      if (B.s === A.s) return B.t;
      return A.t + ((B.t - A.t) * (s - A.s)) / (B.s - A.s);
    }
  }
  return e[e.length - 1].t;
}

// ===== Emprises et polygones =====

/** Emprise (rectangle orienté, quatre coins) d'un gabarit centré au point p. */
export function emprise(gabarit, p) {
  const { longueur: L, largeur: W } = GABARITS[gabarit];
  const c = Math.cos(p.cap), s = Math.sin(p.cap);
  return [[L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2], [-L / 2, -W / 2]]
    .map(([a, b]) => [p.x + a * c - b * s, p.y + a * s + b * c]);
}

export function rectangle(x0, y0, x1, y1) {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** Points d'un arc de cercle de a0 à a1 (degrés), par le chemin le plus court, extrémités
 *  comprises. La flèche d'une corde de 5 degrés reste sous 7 mm pour un rayon de 9 m. */
export function pointsArc(cx, cy, r, a0Deg, a1Deg, pasDeg = 5) {
  let d = a1Deg - a0Deg;
  while (d <= -180) d += 360;
  while (d > 180) d -= 360;
  const n = Math.max(1, Math.ceil(Math.abs(d) / pasDeg));
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const a = (a0Deg + (d * k) / n) * DEG;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Polygone circonscrit à un disque : l'approximation ne rogne jamais le disque. */
export function disque(cx, cy, r, pasDeg = 5) {
  const n = Math.ceil(360 / pasDeg);
  const R = r / Math.cos(Math.PI / n);
  return Array.from({ length: n }, (_, k) => [cx + R * Math.cos((2 * Math.PI * k) / n), cy + R * Math.sin((2 * Math.PI * k) / n)]);
}

/** Secteur d'anneau entre les rayons r0 et r1 et les angles a0 et a1 (degrés). */
export function secteurAnneau(cx, cy, r0, r1, a0Deg, a1Deg, pasDeg = 5) {
  return [...pointsArc(cx, cy, r1, a0Deg, a1Deg, pasDeg), ...pointsArc(cx, cy, r0, a1Deg, a0Deg, pasDeg)];
}

export function pointDansPolygone([x, y], poly) {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

function orientation(a, b, c) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return Math.abs(v) < 1e-12 ? 0 : Math.sign(v);
}

function surSegment(a, b, p) {
  return Math.min(a[0], b[0]) - 1e-12 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-12
    && Math.min(a[1], b[1]) - 1e-12 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}

export function segmentsSeCoupent(a, b, c, d) {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && surSegment(a, b, c)) || (o2 === 0 && surSegment(a, b, d))
    || (o3 === 0 && surSegment(c, d, a)) || (o4 === 0 && surSegment(c, d, b));
}

/** Deux polygones, convexes ou non, se touchent-ils ? Un contact compte. */
export function polygonesSeChevauchent(A, B) {
  for (let i = 0; i < A.length; i++) {
    const a1 = A[i], a2 = A[(i + 1) % A.length];
    for (let j = 0; j < B.length; j++) {
      if (segmentsSeCoupent(a1, a2, B[j], B[(j + 1) % B.length])) return true;
    }
  }
  return pointDansPolygone(A[0], B) || pointDansPolygone(B[0], A);
}

// ===== Scène préparée =====

/** Calcule les chronologies des acteurs et l'instant de chaque étape. */
export function preparerScene(def) {
  const acteurs = def.acteurs.map((a) => (a.pose
    ? { ...a }
    : { ...a, chrono: chronologie(a.chemin, a.profil, { depart: a.depart || 0 }) }));
  const eleve = acteurs.find((a) => a.role === "eleve");
  if (!eleve || !eleve.chrono) throw new Error(`scène ${def.code} : un acteur mobile de rôle « eleve » est requis`);
  const etapes = def.etapes.map((e) => ({ ...e, t: tempsAtteint(eleve.chrono, e.s) + (e.delai || 0) }));
  const fin = Math.max(...acteurs.filter((a) => a.chrono).map((a) => a.chrono.duree));
  return { ...def, acteurs, eleve, etapes, duree: fin + (def.finPause ?? 1) };
}

/** État d'un acteur à l'instant t. Un véhicule n'apparaît qu'à son départ ; un piéton
 *  est visible dès le début (il attend au bord du trottoir). */
export function etatActeur(acteur, t) {
  if (acteur.pose) {
    return { x: acteur.pose.x, y: acteur.pose.y, cap: acteur.pose.cap * DEG, v: 0, a: 0, s: 0,
      courbure: 0, visible: true, clignotant: null };
  }
  const { s, v, a } = etatA(acteur.chrono, t);
  const p = pointA(acteur.chemin, s);
  const apparition = acteur.apparition || (acteur.gabarit === "pieton" ? "debut" : "depart");
  const visible = apparition === "debut" || t >= (acteur.depart || 0) - 1e-9;
  const c = (acteur.clignotant || []).find((x) => s >= x.de - 1e-9 && s <= x.a + 1e-9);
  return { x: p.x, y: p.y, cap: p.cap, v, a, s, courbure: courbureA(acteur.chemin, s), visible,
    clignotant: c ? c.cote : null };
}
