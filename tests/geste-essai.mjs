// Geste d'essai des tests du moteur des gestes (et de la page de revue visuelle) : un disque qui glisse de gauche à droite
// en 3 s, deux étapes, un libellé qui nomme l'étape et la flèche de l'étape. Défini ici, dans les tests : l'app n'en a
// pas besoin. Il suit la règle du kit : mêmes nœuds à toute image, la flèche garde ses points dans son étape et seul
// display change selon `fige`, le libellé garde son nœud et seul son texte change. La flèche d'une étape va de la place
// du disque au début de l'étape à sa place à la fin de l'étape : une flèche par étape, donc deux flèches différentes.
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
const DESCRIPTION = "Un disque glisse de gauche à droite, le long de la flèche de l'étape.";

/** La place du disque à l'instant t. */
export const positionEssai = (t) => cles([{ t: 0, v: COURSE_ESSAI.debut }, { t: DUREE_ESSAI, v: COURSE_ESSAI.fin }], t);
/** Les deux points de la flèche de l'étape i : la place du disque à son début et à sa fin. Un indice au-delà de la dernière
 *  étape (une variante de test à trois étapes) reprend la flèche de la dernière. */
export const pointsFlecheEssai = (i) => {
  const k = Math.min(i, DEBUTS_ESSAI.length - 1);
  const fin = k + 1 < DEBUTS_ESSAI.length ? DEBUTS_ESSAI[k + 1] : DUREE_ESSAI;
  return [[positionEssai(DEBUTS_ESSAI[k]), Y_FLECHE], [positionEssai(fin), Y_FLECHE]];
};

/** La définition d'essai ; `surcharge` remplace des champs (une variante fautive pour un test). */
export function gesteEssai(surcharge = {}) {
  const [largeur, hauteur] = CADRE_ESSAI;
  const def = {
    titre: TITRE,
    description: DESCRIPTION,
    cadre: CADRE_ESSAI,
    duree: DUREE_ESSAI,
    etapes: DEBUTS_ESSAI.map((t) => ({ t })),
    etat: (t) => ({ x: positionEssai(t) }),
    dessiner: (etat, { fige, etape }) => cadre({ largeur, hauteur, titre: TITRE, description: DESCRIPTION },
      n("circle", { cx: etat.x, cy: Y_DISQUE, r: RAYON_DISQUE, fill: CHARTE.accent, "data-r": "disque" }),
      texte(largeur / 2, Y_LIBELLE, `Étape ${etape + 1}`, { ancrage: "middle", role: "libelle" }),
      fleche(pointsFlecheEssai(etape), { visible: fige })),
  };
  return { ...def, ...surcharge };
}

/** Copie de `noeud` où chaque nœud de rôle `role` est remplacé par `remplacer(copie du nœud)` : de quoi fabriquer, à partir
 *  d'un dessin en règle, la variante fautive qu'un test veut voir signalée. */
export function modifier(noeud, role, remplacer) {
  if (typeof noeud === "string") return noeud;
  const copie = { ...noeud, attributs: { ...noeud.attributs }, enfants: noeud.enfants.map((e) => modifier(e, role, remplacer)) };
  return noeud.attributs["data-r"] === role ? remplacer(copie) : copie;
}
/** Idem, en changeant seulement des attributs du nœud de rôle `role`. */
export const avecAttributs = (noeud, role, attributs) => modifier(noeud, role, (x) => ({ ...x, attributs: { ...x.attributs, ...attributs } }));
