// Geste d'essai des tests du moteur des gestes (et de la page de revue visuelle) : un disque qui glisse de gauche à droite
// en 3 s, deux étapes, un libellé qui nomme l'étape et la flèche de l'étape. Défini ici, dans les tests : l'app n'en a
// pas besoin. Il suit la règle du kit : mêmes nœuds à toute image, la flèche garde ses points et seul display change
// selon `fige`, le libellé garde son nœud et seul son texte change.
import { cadre, fleche, texte, CHARTE } from "../js/dessins-kit.js";
import { n } from "../js/dessin-svg.js";
import { cles } from "../js/animation-courbes.js";

export const CADRE_ESSAI = [320, 200];
export const ETAPES_ESSAI = ["Un", "Deux"];
export const DUREE_ESSAI = 3;
export const COURSE_ESSAI = { debut: 40, fin: 280 };     // du disque, en unités du cadre
export const DEBUTS_ESSAI = [0, 1.5];                    // instants des deux étapes, en secondes
const Y_DISQUE = 100, RAYON_DISQUE = 14, Y_LIBELLE = 40, Y_FLECHE = 150;
const TITRE = "Disque glissant";
const DESCRIPTION = "Un disque glisse de gauche à droite, le long de la flèche.";

/** La définition d'essai ; `surcharge` remplace des champs (une variante fautive pour un test). */
export function gesteEssai(surcharge = {}) {
  const [largeur, hauteur] = CADRE_ESSAI;
  const def = {
    titre: TITRE,
    description: DESCRIPTION,
    cadre: CADRE_ESSAI,
    duree: DUREE_ESSAI,
    etapes: DEBUTS_ESSAI.map((t) => ({ t })),
    etat: (t) => ({ x: cles([{ t: 0, v: COURSE_ESSAI.debut }, { t: DUREE_ESSAI, v: COURSE_ESSAI.fin }], t) }),
    dessiner: (etat, { fige, etape }) => cadre({ largeur, hauteur, titre: TITRE, description: DESCRIPTION },
      n("circle", { cx: etat.x, cy: Y_DISQUE, r: RAYON_DISQUE, fill: CHARTE.accent, "data-r": "disque" }),
      texte(largeur / 2, Y_LIBELLE, `Étape ${etape + 1}`, { ancrage: "middle", role: "libelle" }),
      fleche([[COURSE_ESSAI.debut, Y_FLECHE], [COURSE_ESSAI.fin, Y_FLECHE]], { visible: fige })),
  };
  return { ...def, ...surcharge };
}
