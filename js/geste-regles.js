/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Règles pures des gestes animés (js/geste-moteur.js) : forme d'une définition, image figée d'une étape, problèmes
 * (étapes, durées, forme constante des images, continuité). Testées sous Node.
 *
 * Une définition de geste : { titre, description, cadre: [320, H], duree, vitesseLecture?, etapes: [{ t }], etat(t),
 * dessiner(etat, { fige, etape }) }. `etat(t)` est pur et sans DOM ; `dessiner` rend un nœud (js/dessin-svg.js) de même
 * forme à tout instant, dont la flèche de l'étape (data-r="fleche") n'est visible que si `fige`.
 *
 * Toutes les valeurs ci-dessous sont des choix de dessin, sans portée réglementaire.
 */
import { etapeA } from "./lecteur-anime-regles.js?v=20261013a";

/** Durée minimale d'une étape à l'écran, en secondes (convention des scènes). */
export const ETAPE_MIN = 1.0;
/** Pas d'échantillonnage de la continuité : une image à 60 images par seconde. */
export const PAS_IMAGE = 1 / 60;
/** Variation maximale d'une valeur numérique de l'état entre deux images : au-delà, c'est un saut. */
export const SAUT_MAX = 6;

/** Image figée de l'étape i : l'état au début de l'étape, flèche visible. */
export function imageFigee(def, i) {
  const etape = def.etapes[i];
  if (!etape) throw new Error(`Étape ${i} inconnue : le geste en a ${def.etapes.length}`);
  return def.dessiner(def.etat(etape.t), { fige: true, etape: i });
}

function valeursNumeriques(objet, prefixe = "", sortie = {}) {
  for (const [k, v] of Object.entries(objet || {})) {
    const cle = prefixe ? `${prefixe}.${k}` : k;
    if (typeof v === "number") sortie[cle] = v;
    else if (v && typeof v === "object") valeursNumeriques(v, cle, sortie);
  }
  return sortie;
}
const forme = (noeud) => (typeof noeud === "string" ? "#" : `${noeud.balise}(${noeud.enfants.map(forme).join(",")})`);
const positif = (v) => Number.isFinite(v) && v > 0;

// Échantillonne le geste à 60 images par seconde : l'état ne saute pas, ne contient aucune valeur non finie, et l'image
// garde la même forme (balises et nombres d'enfants) en lecture comme figée. Chaque valeur de l'état n'est signalée qu'une
// fois (un mouvement trop rapide l'est à chaque image), la forme aussi, puis l'échantillonnage s'arrête. Un calcul ou un
// dessin qui lève est un problème de la définition, dit avec son instant.
function controlerImages(def, pb) {
  let instant = 0;
  try {
    const reference = forme(def.dessiner(def.etat(0), { fige: false, etape: 0 }));
    const dits = new Set();
    const controler = (apres, avant) => {
      for (const [cle, v] of Object.entries(apres)) {
        if (dits.has(cle)) continue;
        if (!Number.isFinite(v)) pb.push(`valeur non finie de ${cle} à ${instant.toFixed(3)} s`);
        else if (avant && cle in avant && Math.abs(v - avant[cle]) > SAUT_MAX) {
          pb.push(`saut de ${cle} à ${instant.toFixed(3)} s : ${avant[cle].toFixed(2)} puis ${v.toFixed(2)}`);
        } else continue;
        dits.add(cle);
      }
    };
    let avant = valeursNumeriques(def.etat(0));
    controler(avant, null);
    const nombre = Math.ceil(def.duree / PAS_IMAGE);
    for (let k = 1; k <= nombre; k++) {
      instant = k === nombre ? def.duree : k * PAS_IMAGE;   // la dernière image est celle de la fin, exactement
      const etat = def.etat(instant);
      const apres = valeursNumeriques(etat);
      controler(apres, avant);
      avant = apres;
      if (k % 6 === 0 || k === nombre) {
        const i = etapeA(def.etapes, instant);
        for (const fige of [false, true]) {
          if (forme(def.dessiner(etat, { fige, etape: i })) !== reference) {
            pb.push(`forme de l'image changée à ${instant.toFixed(3)} s`);
            return;
          }
        }
      }
    }
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
  controlerImages(def, pb);
  return [...new Set(pb)];
}
