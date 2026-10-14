/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Moteur des gestes animés (volant et mains, autotest des voyants, installation au poste) : il dessine la définition
 * d'un geste (registres GESTES des modules js/dessins-*.js) et l'anime avec le lecteur commun (js/lecteur-anime.js).
 * Le premier rendu crée le SVG ; chaque image suivante met à jour ses attributs (js/dessin-svg.js), sans recréer de
 * nœud. Image figée (pas à pas, pause, fin, animations réduites) : la flèche du mouvement de l'étape est visible.
 */
import { monterLecteur } from "./lecteur-anime.js?v=20261013a";
import { etapeA } from "./lecteur-anime-regles.js?v=20261013a";
import { versDom, mettreAJour } from "./dessin-svg.js?v=20261013a";

export function monterGeste(def, { conteneur, etapes = [], reduit = false, onEtape = null } = {}) {
  const image = (instant, fige) => def.dessiner(def.etat(instant), { fige, etape: etapeA(def.etapes, instant) });
  let courant = image(0, true);
  const racine = versDom(courant);
  function rendre(instant, fige) {
    const suivant = image(instant, fige);
    mettreAJour(racine, courant, suivant);
    courant = suivant;
  }
  const lecteur = monterLecteur({ racine, conteneur, duree: def.duree, etapes: def.etapes, vitesseLecture: def.vitesseLecture || 1,
    reduit, elementsEtapes: etapes, rendre, onEtape });
  return { ...lecteur, geste: def };
}
