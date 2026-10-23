// Signatures fictives de la promo de démonstration (et du banc d'essai).
// Déterministe : une même personne garde la même allure d'une séance à l'autre, avec une
// légère variation par séance, comme une vraie signature. Aucune donnée réelle.
//
// Usage en module : import { signatureFictive } from "./scripts/emargement-demo.mjs".
// Usage en ligne de commande : voir la fin du fichier (écrit la migration de démonstration).

import { cheminDepuisTraits, REPERE } from "../js/emargement-rules.js";

function hacher(texte) {
  let h = 2166136261;
  for (const c of String(texte)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Générateur pseudo-aléatoire reproductible (mulberry32).
function alea(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Courbe lisse passant par les points de contrôle (Catmull-Rom).
function lisser(points, pas = 8) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < pas; k++) {
      const t = k / pas, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function signatureFictive(graine, variation = 0) {
  const r = alea(hacher(graine));                      // allure propre à la personne
  const j = alea(hacher(graine + "#" + variation));    // variation de la séance
  const ligne = 105;
  const pente = 0.18 + r() * 0.22;                     // inclinaison de l'écriture

  // Majuscule : une boucle haute.
  const x0 = 40 + r() * 25;
  const hMaj = 70 + r() * 25, lMaj = 35 + r() * 25;
  const corps = [
    { x: x0, y: ligne - 5 },
    { x: x0 + lMaj * 0.35, y: ligne - hMaj },
    { x: x0 + lMaj, y: ligne - hMaj * 0.75 },
    { x: x0 + lMaj * 0.55, y: ligne - hMaj * 0.35 },
    { x: x0 + lMaj * 0.2, y: ligne - hMaj * 0.45 },
    { x: x0 + lMaj * 0.6, y: ligne },
  ];
  // Minuscules : des bosses, parfois une boucle haute (l, b, h).
  let x = x0 + lMaj * 0.75;
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const w = 16 + r() * 12;
    const haute = r() < 0.25;
    const h = haute ? 45 + r() * 20 : 14 + r() * 14;
    corps.push({ x: x + w * 0.35, y: ligne - h });
    if (haute) corps.push({ x: x + w * 0.15, y: ligne - h * 0.7 });
    corps.push({ x: x + w * 0.7, y: ligne - 2 });
    x += w;
  }
  const fin = { x: x + 20 + r() * 20, y: ligne - 20 - r() * 15 };
  corps.push(fin);
  // Paraphe : retour vers la gauche, sous la signature.
  const paraphe = [
    fin,
    { x: fin.x + 10, y: ligne + 8 },
    { x: (x0 + fin.x) / 2, y: ligne + 18 + r() * 8 },
    { x: x0 - 5 + r() * 20, y: ligne + 12 + r() * 6 },
  ];

  // Variation de la séance : taille, position, tremblé.
  const echelle = 0.92 + j() * 0.16;
  const dx = (j() - 0.5) * 16, dy = (j() - 0.5) * 10;
  const transforme = (p) => ({
    x: (p.x + pente * (ligne - p.y)) * echelle + dx + (j() - 0.5) * 1.2,
    y: (p.y - ligne) * echelle + ligne + dy + (j() - 0.5) * 1.2,
  });
  let traits = [lisser(corps).map(transforme), lisser(paraphe).map(transforme)];

  // Recadrage dans le repère, avec une marge : jamais de point écrasé contre un bord.
  const tous = traits.flat();
  const minX = Math.min(...tous.map((p) => p.x)), maxX = Math.max(...tous.map((p) => p.x));
  const minY = Math.min(...tous.map((p) => p.y)), maxY = Math.max(...tous.map((p) => p.y));
  const k = Math.min(1, (REPERE.largeur - 30) / (maxX - minX), (REPERE.hauteur - 20) / (maxY - minY));
  const ox = (REPERE.largeur - (maxX - minX) * k) / 2, oy = (REPERE.hauteur - (maxY - minY) * k) / 2;
  traits = traits.map((t) => t.map((p) => ({ x: (p.x - minX) * k + ox, y: (p.y - minY) * k + oy })));
  return cheminDepuisTraits(traits, REPERE);
}
