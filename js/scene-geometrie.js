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
 *
 * Caisse et marche : un trajet décrit le sens de déplacement, et son cap est le
 * cap de marche. La caisse (l'avant de la voiture) regarde dans ce sens en marche
 * avant, à l'opposé en marche arrière. pointA et etatActeur rendent les deux :
 * `cap`, celui de la caisse (dessin, emprise, avant, regard), et `capMarche`,
 * celui du déplacement. Un rebroussement inverse la marche sans faire pivoter la
 * caisse.
 */

export const DEG = Math.PI / 180;
export const KMH = 1 / 3.6;

/** Gabarits réels, en mètres. */
export const GABARITS = {
  voiture: { longueur: 4.5, largeur: 1.8 },
  pieton: { longueur: 0.5, largeur: 0.5 },
};

// ===== Segments et trajets =====

// Angle ramené dans ]-π, π].
function normaliserAngle(a) {
  const r = a % (2 * Math.PI);
  if (r > Math.PI) return r - 2 * Math.PI;
  if (r <= -Math.PI) return r + 2 * Math.PI;
  return r;
}

// Un segment est parcouru en marche arrière s'il le dit ; un segment qui ne porte pas `arriere` est en marche avant.
const enMarcheArriere = (seg) => seg.arriere === true;

/** Point et cap atteints après `s` mètres sur un segment (droite ou arc). Le cap est celui de la marche (sens de
 *  déplacement), quelle que soit la marche du segment : le cap de la caisse, c'est pointA qui le rend. */
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
 * décalages latéraux, toujours tangents entre eux. La tortue avance dans le sens
 * de déplacement : son cap est le cap de marche, et la droite et la gauche de ses
 * virages et de ses décalages sont celles de ce sens.
 *
 * Marche arrière. L'option `arriere` fait partir le trajet en marche arrière :
 * `capDeg` est alors le sens de déplacement, et la caisse regarde à l'opposé.
 * `inverser()` marque un rebroussement sur place : la tortue fait demi-tour (cap
 * de marche + 180 degrés, ramené dans ]-180, 180]) et la marche s'inverse ; la
 * caisse, elle, ne pivote pas. Chaque segment porte `arriere`, la marche dans
 * laquelle il est parcouru, et `fin()` rend aussi les abscisses des rebroussements.
 * En marche arrière, la gauche de la tortue est la droite de la caisse : un virage
 * de la tortue à gauche se fait volant tourné à droite (l'arrière de la voiture
 * part vers la droite de la caisse), un virage à droite volant tourné à gauche,
 * et un décalage positif écarte la voiture vers la gauche de la caisse.
 *
 * Refusés : un rebroussement en tête de trajet (partir en marche arrière se dit
 * par l'option), deux rebroussements de suite et un trajet qui finit sur un
 * rebroussement. Chacun serait un rebroussement vide, qu'aucun segment ne parcourt.
 */
export function trajet(x, y, capDeg, { arriere = false } = {}) {
  if (typeof arriere !== "boolean") {
    throw new Error(`trajet : l'option arriere attend un booléen (reçu : ${String(arriere)})`);
  }
  const segments = [], abscissesRebroussement = [];
  let px = x, py = y, cap = capDeg * DEG, longueur = 0, marcheArriere = arriere;
  // Nombre de segments posés au dernier rebroussement : tant qu'il n'a pas changé, aucun segment ne parcourt ce
  // rebroussement.
  let segmentsAuRebroussement = -1;
  function poser(seg) {
    seg.arriere = marcheArriere;
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
    // Décalage latéral d (positif vers la droite du sens de marche) pour une avance L = `l` mesurée selon le
    // cap initial : la longueur du chemin parcouru est un peu plus grande que `l`. Deux arcs
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
    // Rebroussement sur place, à l'abscisse atteinte : la tortue fait demi-tour et la marche s'inverse.
    inverser() {
      if (!segments.length) {
        throw new Error("trajet.inverser : rebroussement en tête de trajet, sans segment avant lui"
          + " (pour partir en marche arrière : trajet(x, y, cap, { arriere: true }))");
      }
      if (segmentsAuRebroussement === segments.length) {
        throw new Error(`trajet.inverser : rebroussement vide en s = ${longueur.toFixed(2)} m,`
          + " juste après un autre, sans segment entre eux");
      }
      cap = normaliserAngle(cap + Math.PI);
      marcheArriere = !marcheArriere;
      abscissesRebroussement.push(longueur);
      segmentsAuRebroussement = segments.length;
      return api;
    },
    get longueur() { return longueur; },
    // Position et cap de la tortue : le cap de marche.
    get position() { return { x: px, y: py, cap }; },
    get nbSegments() { return segments.length; },
    fin() {
      if (segmentsAuRebroussement === segments.length) {
        throw new Error(`trajet.fin : le trajet finit sur un rebroussement (s = ${longueur.toFixed(2)} m),`
          + " qu'aucun segment ne parcourt");
      }
      return { segments: segments.slice(), longueur, rebroussements: abscissesRebroussement.slice() };
    },
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

/**
 * Point à l'abscisse curviligne s (bornée au trajet) : { x, y, cap, capMarche, arriere }. `capMarche` est le sens de
 * déplacement (le cap de la tortue) ; `cap` est celui de la caisse, l'avant de la voiture : le cap de marche tel quel
 * en marche avant (sans normalisation), son opposé en marche arrière (capMarche + π, ramené dans ]-π, π]). À l'abscisse
 * d'un rebroussement, le point est déjà dans la marche qui suit.
 */
export function pointA(chemin, s) {
  const { seg, d } = segmentA(chemin, s);
  const p = pointSurSegment(seg, d);
  const arriere = enMarcheArriere(seg);
  return { x: p.x, y: p.y, cap: arriere ? normaliserAngle(p.cap + Math.PI) : p.cap, capMarche: p.cap, arriere };
}

/** Courbure signée à l'abscisse s, dans le repère de marche : > 0 quand la tortue tourne à droite, < 0 à gauche, 0 en
 *  ligne droite. En marche arrière, une courbure > 0 se fait volant tourné à gauche (voir trajet). */
export function courbureA(chemin, s) {
  const { seg } = segmentA(chemin, s);
  return seg.type === "arc" ? Math.sign(seg.angle) / seg.rayon : 0;
}

/** Abscisses des rebroussements, dans l'ordre : là où la marche change d'un segment au suivant. Elles se lisent sur
 *  les segments, comme la marche de pointA : un trajet transformé qui garde ses segments (tourné, raccourci) garde ses
 *  rebroussements, à leurs nouvelles abscisses. */
export function rebroussements(chemin) {
  const segs = chemin.segments, abscisses = [];
  for (let i = 1; i < segs.length; i++) {
    if (enMarcheArriere(segs[i]) !== enMarcheArriere(segs[i - 1])) abscisses.push(segs[i].debut);
  }
  return abscisses;
}

/** Rotation d'un point autour de (cx, cy) ; angle en degrés, positif dans le sens horaire à l'écran. */
export function tournerPoint([x, y], cx, cy, angleDeg) {
  const a = angleDeg * DEG, c = Math.cos(a), s = Math.sin(a);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** Le même trajet, tourné autour de (cx, cy) : il garde la marche de chaque segment et ses rebroussements. */
export function tournerChemin(chemin, cx, cy, angleDeg) {
  if (!angleDeg) return chemin;
  return {
    ...chemin,
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

/** Milieu du pare-chocs avant d'un gabarit centré au point p, selon p.cap : le cap de la caisse (pointA, etatActeur),
 *  en marche arrière comme en marche avant. */
export function avant(gabarit, p) {
  const l = GABARITS[gabarit].longueur / 2;
  return { x: p.x + Math.cos(p.cap) * l, y: p.y + Math.sin(p.cap) * l };
}

// ===== Chronologie (profil de vitesse) =====

/**
 * Chronologie d'un acteur sur son trajet. `profil` : points { s, kmh } aux
 * abscisses strictement croissantes, de s = 0 à s = longueur du trajet ; entre
 * deux points, accélération constante. Un point peut porter `pause` (secondes,
 * strictement positive) : l'acteur y reste immobile, ce qui exige kmh = 0. `depart`
 * retarde le départ.
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
    if (p.pause !== undefined) {
      if (!(Number.isFinite(p.pause) && p.pause > 0)) {
        throw new Error(`chronologie : une pause doit être strictement positive (s = ${p.s}, pause = ${p.pause})`);
      }
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

/** Emprise (rectangle orienté selon p.cap, le cap de la caisse ; quatre coins, ceux de l'avant d'abord) d'un gabarit
 *  centré au point p. */
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
 *  comprises. La flèche d'une corde de 5 degrés reste sous 9 mm pour un rayon de 9 m. */
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

/**
 * Secteur d'anneau entre les rayons r0 et r1, de l'angle a0 à l'angle a1 (degrés). L'arc
 * extérieur et l'arc intérieur sont tracés dans le même sens, le second parcouru à
 * rebours. `pointsArc` suit le plus court chemin : l'ouverture |a1 - a0| doit donc être
 * strictement comprise entre 0 et 180 degrés. À 180 le chemin est ambigu, au-delà il
 * passerait de l'autre côté du secteur demandé.
 */
export function secteurAnneau(cx, cy, r0, r1, a0Deg, a1Deg, pasDeg = 5) {
  const ouverture = Math.abs(a1Deg - a0Deg);
  if (!(ouverture > 0 && ouverture < 180)) {
    throw new Error(`secteurAnneau : l'ouverture (${a1Deg - a0Deg} degrés) doit être strictement comprise entre 0 et 180 en valeur absolue`
      + " : écrire les angles sans saut de 360 degrés, par exemple -10 et 10 plutôt que 350 et 10");
  }
  return [...pointsArc(cx, cy, r1, a0Deg, a1Deg, pasDeg), ...pointsArc(cx, cy, r0, a0Deg, a1Deg, pasDeg).reverse()];
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

/**
 * Calcule les chronologies des acteurs et l'instant de chaque étape. Refuse une
 * `apparition` autre que « debut » ou « depart » (ou absente).
 */
export function preparerScene(def) {
  const acteurs = def.acteurs.map((a, i) => {
    if (a.apparition !== undefined && a.apparition !== "debut" && a.apparition !== "depart") {
      const nom = a.id === undefined ? `n° ${i + 1}` : `« ${a.id} »`;
      throw new Error(`scène ${def.code} : acteur ${nom} : apparition « ${a.apparition} » inconnue (« debut » ou « depart » attendu)`);
    }
    return a.pose
      ? { ...a }
      : { ...a, chrono: chronologie(a.chemin, a.profil, { depart: a.depart || 0 }) };
  });
  const eleve = acteurs.find((a) => a.role === "eleve");
  if (!eleve || !eleve.chrono) throw new Error(`scène ${def.code} : un acteur mobile de rôle « eleve » est requis`);
  const etapes = def.etapes.map((e) => ({ ...e, t: tempsAtteint(eleve.chrono, e.s) + (e.delai || 0) }));
  const fin = Math.max(...acteurs.filter((a) => a.chrono).map((a) => a.chrono.duree));
  return { ...def, acteurs, eleve, etapes, duree: fin + (def.finPause ?? 1) };
}

/**
 * Apparition d'un acteur : « debut » (visible dès le début de la scène) ou « depart »
 * (visible à partir de son départ). La valeur explicite `acteur.apparition` l'emporte ; à
 * défaut, un piéton est visible dès le début (il attend au bord du trottoir) et tout autre
 * acteur n'apparaît qu'à son départ.
 */
export function apparitionDe(acteur) {
  return acteur.apparition || (acteur.gabarit === "pieton" ? "debut" : "depart");
}

/**
 * Un véhicule autre que celui de l'élève dont le trajet finit en mouvement quitte le cadre à
 * la fin de sa chronologie (symétrique de l'apparition au départ). La scène doit donc faire
 * finir ce trajet hors du monde (hors de la zone dessinée) : `scene-controles.js` le vérifie.
 * Faux pour un acteur sans chronologie (fixe, `pose`, ou pas encore préparé), pour l'élève (sa
 * fin est celle de la scène), pour un piéton (il s'arrête au bout de son trajet et ne quitte
 * jamais l'image) et pour un véhicule dont le trajet finit à l'arrêt.
 */
export function sortDuCadre(acteur) {
  if (!acteur.chrono || acteur.role === "eleve" || acteur.gabarit === "pieton") return false;
  const echantillons = acteur.chrono.echantillons;
  return echantillons[echantillons.length - 1].v > 0;
}

/**
 * État d'un acteur à l'instant t. Un acteur fixe (`pose`) est toujours visible et à l'arrêt.
 * Pour un acteur mobile :
 * - Visibilité : dès le début si `apparitionDe` vaut « debut », à partir du départ si elle
 *   vaut « depart » (par défaut, un piéton est visible dès le début et un véhicule n'apparaît
 *   qu'à son départ). Après la fin de sa chronologie (t > duree), un acteur qui `sortDuCadre`
 *   est invisible ; tous les autres restent visibles à leur arrivée, un piéton compris : il
 *   s'arrête au bout de son trajet.
 * - Avant son départ : vitesse et accélération nulles, pour tous les acteurs.
 * - Après la fin de la chronologie : accélération nulle, position d'arrivée. La vitesse est
 *   nulle pour tous sauf l'élève : un piéton s'est arrêté, un véhicule qui finit à l'arrêt
 *   l'est déjà, un véhicule qui a quitté le cadre est invisible. L'élève garde sa vitesse
 *   finale (celle du dernier échantillon), car la fin de la scène tient l'image pendant
 *   `finPause` : le moteur allume les feux stop sous 0,05 m/s, ce qui ne doit pas arriver sur
 *   cette image tenue, et une tenue n'est pas un arrêt (contrôle de la ligne d'arrêt).
 *   `scene-controles.js` vérifie que l'élève finit en dernier lorsqu'il termine en mouvement,
 *   de sorte que toute l'image est tenue avec lui.
 * - Clignotant : `clignotant` vaut le côté ("droite", "gauche") de l'intervalle de
 *   `acteur.clignotant` qui contient l'abscisse atteinte, bornes comprises, ou null.
 *   `clignotantDepuis` est l'instant (s, horloge de la scène, départ compris) où l'acteur a
 *   atteint le début de cet intervalle, c'est-à-dire où ce clignotant s'est allumé ; null
 *   quand le clignotant est éteint. Chaque intervalle est un allumage : deux intervalles
 *   successifs ont chacun le leur, et un arrêt pendant le clignotant ne le change pas. Le
 *   rendu compte la phase du clignotement depuis cet instant (`clignotantAllume`, dans
 *   `scene-rendu.js`).
 * - Caisse et marche (pointA) : `cap` est le cap de la caisse, `capMarche` celui du
 *   déplacement, et `marche` vaut "arriere" sur un segment parcouru en marche arrière,
 *   "avant" sinon. Arrêté à un rebroussement, l'acteur est déjà dans la marche qui suit (la
 *   vitesse est passée avant de repartir). Un acteur fixe est en marche avant.
 */
export function etatActeur(acteur, t) {
  if (acteur.pose) {
    const cap = acteur.pose.cap * DEG;
    return { x: acteur.pose.x, y: acteur.pose.y, cap, capMarche: cap, marche: "avant", v: 0, a: 0, s: 0,
      courbure: 0, visible: true, clignotant: null, clignotantDepuis: null };
  }
  const { duree } = acteur.chrono;
  const parti = t >= (acteur.depart || 0) - 1e-9;
  const termine = t > duree + 1e-9;
  const { s, v, a } = etatA(acteur.chrono, t);
  const p = pointA(acteur.chemin, s);
  const visible = !(termine && sortDuCadre(acteur)) && (apparitionDe(acteur) === "debut" || parti);
  // Après la fin, etatA renvoie la dernière vitesse du profil : seul l'élève la garde.
  const vitesse = !parti || (termine && acteur.role !== "eleve") ? 0 : v;
  const acceleration = parti && !termine ? a : 0;
  const c = (acteur.clignotant || []).find((x) => s >= x.de - 1e-9 && s <= x.a + 1e-9);
  return { x: p.x, y: p.y, cap: p.cap, capMarche: p.capMarche, marche: p.arriere ? "arriere" : "avant",
    v: vitesse, a: acceleration, s, courbure: courbureA(acteur.chemin, s), visible, clignotant: c ? c.cote : null,
    clignotantDepuis: c ? tempsAtteint(acteur.chrono, c.de) : null };
}
