/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Règles pures des gestes animés (js/geste-moteur.js) : l'image d'un geste à un instant (imageA, la même pour le moteur et
 * pour les contrôles), image figée d'une étape, problèmes (étapes, durées, images que l'exécution accepterait et de même
 * forme, continuité de l'état, flèche constante dans son étape, image figée qui ne diffère de l'image de lecture que par
 * l'affichage des flèches, continuité des points dessinés). Testées sous Node.
 *
 * Une définition de geste : { titre, description, cadre: [320, H], duree, vitesseLecture?, sautsMax?, etapes: [{ t }],
 * etat(t), dessiner(etat, { fige, etape }) }. `etat(t)` est pur et sans DOM ; `dessiner` rend un nœud (js/dessin-svg.js) de
 * même forme à tout instant, dont la flèche de l'étape (data-r="fleche") n'est visible que si `fige`. `sautsMax` :
 * { "<chemin d'une valeur de l'état>": variation maximale en une image, dans l'unité de cette valeur }, pour une valeur qui
 * doit aller plus vite que la règle générale de continuité (la raison va dans les sources du geste).
 *
 * Toutes les valeurs ci-dessous sont des choix de dessin, sans portée réglementaire.
 */
import { etapeA } from "./lecteur-anime-regles.js?v=20261029a";
import { problemeMiseAJour, trouverTous, ecrireValeur } from "./dessin-svg.js?v=20261029a";

/** Durée minimale d'une étape à l'écran, en secondes (convention des scènes). */
export const ETAPE_MIN = 1.0;
/** Pas d'échantillonnage : une image à 60 images par seconde. */
export const PAS_IMAGE = 1 / 60;
/** Part de la plage d'une valeur de l'état qu'elle peut parcourir en une image avant que ce soit un saut. La plage d'une
 *  valeur est l'écart entre son plus petit et son plus grand échantillon sur tout le geste : la règle n'a donc pas d'unité,
 *  et un angle en degrés, une opacité de 0 à 1 et une position en unités du cadre se jugent pareil. Une course `adoucir`
 *  (js/animation-courbes.js) sur toute la plage, en une étape de 1,0 s (la durée minimale), atteint 5 % de la plage par
 *  image à sa vitesse de pointe ; 15 % laisse parcourir toute la plage en 0,3 s environ (mesuré : 14,9 % à 18 images,
 *  16,6 % à 17). Une valeur qui doit aller plus vite (une prise qui passe de 0 à 1) se déclare dans `sautsMax` ; un
 *  interrupteur instantané que le cours permet se modélise par un booléen, que cette règle ne juge pas. */
export const PART_SAUT_MAX = 0.15;
/** Variation, d'une image à la suivante, en deçà de laquelle une valeur de l'état ne saute jamais : du bruit de calcul. Une
 *  valeur mathématiquement constante, calculée en virgule flottante (100 * (cos² + sin²)), varie de l'ordre de 1e-13 ; sa
 *  plage serait alors du bruit, et chaque variation un « saut » de toute sa plage. */
export const BRUIT_CALCUL = 1e-9;
/** Déplacement maximal, d'une image de lecture à la suivante (1/60 s), d'un point dessiné : le point d'un rôle (data-x et
 *  data-y) ou un bout d'un segment de rôle (data-x1 à data-y2), lus dans le dessin, non dans l'état. 8 unités du cadre, 7,5 px
 *  sur un téléphone (480 unités par seconde) : au-delà, le point saute à l'œil. Les mains les plus rapides des gestes du lot
 *  restent sous 6,2 unités par image (mesuré le 15/10/2026). C'est la borne que les tests des familles « poste » et
 *  « conducteur » vérifiaient chacun de leur côté, réunie ici pour tous les gestes. */
export const SAUT_POINT_MAX = 8;

/** L'image du geste à l'instant `t`, telle que le moteur la dessine : l'état de l'instant, l'étape de l'instant, image
 *  figée (flèche de l'étape visible) ou image de lecture. Le moteur, les contrôles et les tests passent tous par elle : ce
 *  qu'on vérifie est exactement ce qu'on montre. */
export function imageA(def, t, fige) {
  return def.dessiner(def.etat(t), { fige, etape: etapeA(def.etapes, t) });
}

/** Image figée de l'étape i : l'image figée à l'instant où l'étape commence, flèche visible. */
export function imageFigee(def, i) {
  const etape = def.etapes[i];
  if (!etape) throw new Error(`Étape ${i} inconnue : le geste en a ${def.etapes.length}`);
  return imageA(def, etape.t, true);
}

function valeursNumeriques(objet, prefixe = "", sortie = {}) {
  for (const [k, v] of Object.entries(objet || {})) {
    const cle = prefixe ? `${prefixe}.${k}` : k;
    if (typeof v === "number") sortie[cle] = v;
    else if (v && typeof v === "object") valeursNumeriques(v, cle, sortie);
  }
  return sortie;
}
const positif = (v) => Number.isFinite(v) && v > 0;

// Un nœud et tout ce qu'il porte, attributs rangés par nom et écrits comme le DOM les reçoit : deux nœuds de même signature
// s'affichent pareil.
const signature = (noeud) => {
  if (typeof noeud === "string") return JSON.stringify(noeud);
  const attributs = Object.entries(noeud.attributs).map(([k, v]) => [k, ecrireValeur(v)]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `${noeud.balise}{${attributs.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(",")}}(${noeud.enfants.map(signature).join(",")})`;
};
const fleches = (image) => trouverTous(image, (x) => x.attributs["data-r"] === "fleche").map(signature).join("|");

const nombreFini = (v) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v));

/** Points dessinés d'une image, par nœud affiché (ni lui ni un ancêtre en display none) : le point d'un rôle (data-x et data-y)
 *  et les deux bouts d'un segment de rôle (data-x1 à data-y2). Map : chemin du point dans l'arbre (indices des enfants, puis le
 *  bout du segment) vers { role, point }. Le chemin, non le rôle, apparie les points d'une image à la suivante : deux nœuds
 *  peuvent porter le même rôle, et un geste garde ses nœuds d'une image à l'autre. */
export function pointsDessines(image) {
  const points = new Map();
  (function visiter(noeud, chemin, cache) {
    if (typeof noeud === "string") return;
    const a = noeud.attributs, masque = cache || a.display === "none";
    if (!masque) {
      const role = a["data-r"] || noeud.balise;
      if (nombreFini(a["data-x"]) && nombreFini(a["data-y"])) points.set(chemin, { role, point: [Number(a["data-x"]), Number(a["data-y"])] });
      for (const bout of ["1", "2"]) {
        const [kx, ky] = [`data-x${bout}`, `data-y${bout}`];
        if (nombreFini(a[kx]) && nombreFini(a[ky])) points.set(`${chemin}:${bout}`, { role: `${role} (bout ${bout})`, point: [Number(a[kx]), Number(a[ky])] });
      }
    }
    noeud.enfants.forEach((e, i) => visiter(e, `${chemin}/${i}`, masque));
  })(image, "", false);
  return points;
}

/** Ce qui distingue une image figée de l'image de lecture au même instant, hors de ce qui doit les distinguer : l'affichage
 *  (display) des groupes des flèches (data-r="fleche", qui rangent aussi les marques et vues propres aux images figées). Liste
 *  de « chemin attribut » ; vide si l'image figée est bien l'image de l'animation à cet instant. Les deux images ont la même
 *  forme (vérifié avant). */
export function ecartsFigeeLecture(figee, lecture) {
  const ecarts = [];
  (function comparer(a, b, chemin) {
    if (typeof a === "string" || typeof b === "string") {
      if (a !== b) ecarts.push(`${chemin} texte`);
      return;
    }
    const ici = `${chemin}/${a.balise}${a.attributs["data-r"] ? `[${a.attributs["data-r"]}]` : ""}`;
    for (const k of new Set([...Object.keys(a.attributs), ...Object.keys(b.attributs)])) {
      if (k === "display" && a.attributs["data-r"] === "fleche") continue;
      const [va, vb] = [a.attributs[k], b.attributs[k]];
      if (va === undefined || vb === undefined || ecrireValeur(va) !== ecrireValeur(vb)) ecarts.push(`${ici} ${k}`);
    }
    a.enfants.forEach((e, i) => comparer(e, b.enfants[i], `${ici}[${i}]`));
  })(figee, lecture, "");
  return ecarts;
}

/** Instants échantillonnés : toutes les 1/60 s, et exactement `duree` à la fin. */
function instantsDe(duree) {
  const nombre = Math.ceil(duree / PAS_IMAGE);
  return Array.from({ length: nombre + 1 }, (_, k) => (k === nombre ? duree : k * PAS_IMAGE));
}

// Continuité de l'état, sur les échantillons `etats` (valeurs numériques, une table par instant). Une valeur non finie est
// dite ; une valeur de plage non nulle ne change pas, d'une image à la suivante, de plus de PART_SAUT_MAX de sa plage (ou,
// si `sautsMax` la déclare, de plus que sa borne), au bruit de calcul près (BRUIT_CALCUL) ; une valeur constante n'a pas de
// plage, donc pas de saut. Chaque valeur n'est signalée qu'une fois (un mouvement trop rapide l'est à chaque image). Une
// déclaration `sautsMax` qui ne désigne rien, ou dont la borne n'est pas un nombre fini positif, est signalée : sinon une
// faute de frappe la laisserait sans effet.
function controlerEtat(def, instants, etats, pb) {
  const declaree = def.sautsMax;
  let bornes = {};
  if (declaree !== undefined) {
    if (declaree === null || typeof declaree !== "object" || Array.isArray(declaree)) {
      pb.push("sautsMax : un objet { chemin: variation maximale par image } est attendu");
    } else {
      bornes = declaree;
      const connues = new Set(etats.flatMap((e) => Object.keys(e)));
      for (const [cle, borne] of Object.entries(bornes)) {
        if (!connues.has(cle)) pb.push(`sautsMax : « ${cle} » n'est pas une valeur numérique de l'état`);
        else if (!positif(borne)) pb.push(`sautsMax : « ${cle} » ${String(borne)} : un nombre fini strictement positif est attendu`);
      }
    }
  }
  const plages = new Map();
  const dites = new Set();
  etats.forEach((etat, i) => {
    for (const [cle, v] of Object.entries(etat)) {
      if (!Number.isFinite(v)) {
        if (!dites.has(cle)) { dites.add(cle); pb.push(`valeur non finie de ${cle} à ${instants[i].toFixed(3)} s`); }
      } else {
        const p = plages.get(cle);
        if (!p) plages.set(cle, [v, v]);
        else { p[0] = Math.min(p[0], v); p[1] = Math.max(p[1], v); }
      }
    }
  });
  for (let i = 1; i < etats.length; i++) {
    for (const [cle, v] of Object.entries(etats[i])) {
      const avant = etats[i - 1][cle];
      if (dites.has(cle) || avant === undefined || !Number.isFinite(v) || !Number.isFinite(avant)) continue;
      const plage = plages.get(cle)[1] - plages.get(cle)[0];
      const declare = Object.prototype.hasOwnProperty.call(bornes, cle) && positif(bornes[cle]) ? bornes[cle] : null;
      let limite, raison;
      if (declare !== null) {
        limite = declare;
        raison = `plus que les ${declare} déclarés par sautsMax`;
      } else if (plage > 0) {
        limite = PART_SAUT_MAX * plage;
        raison = `plus de ${Math.round(PART_SAUT_MAX * 100)} % de la plage de ${plage.toFixed(2)}`;
      } else continue;
      if (Math.abs(v - avant) > limite + BRUIT_CALCUL) {
        dites.add(cle);
        pb.push(`saut de ${cle} à ${instants[i].toFixed(3)} s : ${avant.toFixed(2)} puis ${v.toFixed(2)} (${raison} en une image)`);
      }
    }
  }
}

// À chaque instant échantillonné, les deux images que le moteur peut dessiner (figée et de lecture, par imageA) sont
// comparées à la première, celle du montage (figée à 0 s), par la vérification même de mettreAJour (problemeMiseAJour) :
// même forme, valeurs que l'écriture accepte. Ce qu'elle refuserait à l'exécution, et qui figerait la lecture, est dit ici
// avec son instant, une fois par message. Sur les images figées, la flèche de l'étape garde tous ses attributs d'une image
// à l'autre dans l'étape (une flèche qui bougerait en pause d'un instant à l'autre). Une image figée est l'image de lecture du
// même instant, au seul affichage du groupe des flèches près (ecartsFigeeLecture) : sinon le passage du pas à pas à la lecture
// ferait sauter le dessin. Aucun point dessiné (pointsDessines) ne bouge de plus de SAUT_POINT_MAX d'une image de lecture à la
// suivante. Chaque écart n'est dit qu'une fois, à son premier instant. `aInstant(t)` note l'instant pour le message d'une
// erreur levée par le geste lui-même.
function controlerImages(def, instants, pb, aInstant) {
  const reference = imageA(def, 0, true);
  const dits = new Set();
  const flechesDeLEtape = new Map();
  const etapesDites = new Set();
  let precedents = null, tPrecedent = 0;
  for (const t of instants) {
    aInstant(t);
    const etape = etapeA(def.etapes, t);
    const images = {};
    for (const fige of [false, true]) {
      const image = imageA(def, t, fige);
      const probleme = problemeMiseAJour(reference, image);
      if (probleme) {
        if (!dits.has(probleme)) { dits.add(probleme); pb.push(`${t.toFixed(3)} s, image ${fige ? "figée" : "de lecture"} : ${probleme}`); }
        continue;
      }
      images[fige ? "figee" : "lecture"] = image;
      if (!fige) continue;
      const flechesDeLImage = fleches(image);
      if (!flechesDeLEtape.has(etape)) flechesDeLEtape.set(etape, flechesDeLImage);
      else if (flechesDeLEtape.get(etape) !== flechesDeLImage && !etapesDites.has(etape)) {
        etapesDites.add(etape);
        pb.push(`la flèche de l'étape ${etape + 1} change à l'intérieur de l'étape (à ${t.toFixed(3)} s) : elle garde ses points et ses attributs d'une image figée à l'autre`);
      }
    }
    if (images.figee && images.lecture) {
      for (const ecart of ecartsFigeeLecture(images.figee, images.lecture)) {
        const cle = `figée ${ecart}`;
        if (!dits.has(cle)) {
          dits.add(cle);
          pb.push(`${t.toFixed(3)} s : l'image figée diffère de l'image de lecture ailleurs que par l'affichage du groupe des flèches (${ecart})`);
        }
      }
    }
    if (!images.lecture) { precedents = null; continue; }
    const points = pointsDessines(images.lecture);
    if (precedents) {
      for (const [chemin, { role, point }] of points) {
        const avant = precedents.get(chemin);
        if (!avant) continue;
        const saut = Math.hypot(point[0] - avant.point[0], point[1] - avant.point[1]);
        const cle = `point ${chemin}`;
        if (saut > SAUT_POINT_MAX + BRUIT_CALCUL && !dits.has(cle)) {
          dits.add(cle);
          pb.push(`saut du point « ${role} » de ${tPrecedent.toFixed(3)} à ${t.toFixed(3)} s : ${saut.toFixed(2)} unités en une image (${SAUT_POINT_MAX} au plus)`);
        }
      }
    }
    precedents = points;
    tPrecedent = t;
  }
}

// Échantillonne le geste à 60 images par seconde, fin comprise. Un calcul d'état ou un dessin qui lève est un problème de la
// définition, dit avec son instant, et arrête là l'échantillonnage. Les instants des images réelles ne sont pas exactement
// ceux-là : un défaut qui ne dure pas une image entière peut tomber entre deux échantillons.
function controlerGeste(def, pb) {
  const instants = instantsDe(def.duree);
  let instant = 0;
  try {
    const etats = instants.map((t) => { instant = t; return valeursNumeriques(def.etat(t)); });
    controlerEtat(def, instants, etats, pb);
    controlerImages(def, instants, pb, (t) => { instant = t; });
  } catch (erreur) {
    pb.push(`image impossible à produire à ${instant.toFixed(3)} s : ${(erreur && erreur.message) || erreur}`);
  }
}

/** Problèmes d'une définition de geste, face au modèle d'étapes du catalogue (tableau vide si tout va). Elle ne lève
 *  jamais : étapes absentes, instants ou durée qui ne sont pas des nombres, vitesse de lecture fautive sont des problèmes
 *  dits, le contrat du lecteur (js/lecteur-anime.js) étant celui-là : au moins une étape, des instants croissants dès 0,
 *  une durée qui dépasse la dernière étape, une vitesse de lecture positive. */
export function problemesGeste(def, etapesModele) {
  const { etapes, duree, vitesseLecture } = def;
  if (!Array.isArray(etapes) || etapes.length === 0) return ["étapes absentes ou vides : le lecteur en exige au moins une"];
  const pb = [];
  if (vitesseLecture !== undefined && !positif(vitesseLecture)) {
    pb.push(`vitesseLecture ${String(vitesseLecture)} : un nombre fini strictement positif est attendu`);
  }
  if (!Array.isArray(etapesModele)) pb.push("modèle d'étapes du catalogue absent : le nombre d'étapes ne se compare pas");
  else if (etapes.length !== etapesModele.length) pb.push(`${etapes.length} étapes au lieu de ${etapesModele.length}`);
  const sansInstant = etapes.flatMap((e, i) => (Number.isFinite(e && e.t) ? [] : [`étape ${i + 1} : instant non fini`]));
  if (sansInstant.length) return [...pb, ...sansInstant];
  if (!positif(duree)) return [...pb, `durée ${String(duree)} : un nombre fini strictement positif est attendu`];
  etapes.forEach((e, i) => {
    if (i > 0 && !(e.t > etapes[i - 1].t)) pb.push(`étape ${i + 1} : commence à ${e.t} s, pas après l'étape ${i} (${etapes[i - 1].t} s)`);
  });
  if (etapes[0].t !== 0) pb.push("la première étape ne commence pas à 0");
  const derniere = etapes[etapes.length - 1].t;
  if (!(duree > derniere)) pb.push(`la durée (${duree} s) ne dépasse pas le début de la dernière étape (${derniere} s)`);
  etapes.forEach((e, i) => {
    const fin = i + 1 < etapes.length ? etapes[i + 1].t : duree;
    // Une étape qui ne finit pas après son début est déjà dite ci-dessus : pas de durée négative en plus.
    if (fin > e.t && !(fin - e.t >= ETAPE_MIN - 1e-9)) pb.push(`étape ${i + 1} : ${(fin - e.t).toFixed(2)} s, moins de ${ETAPE_MIN} s`);
  });
  controlerGeste(def, pb);
  return [...new Set(pb)];
}
