// Lecture des comptes « à traiter » de l'équipe (refonte, lot 2A) : les signalements de QCM non traités de la promo
// affichée (l'en-tête de promo de chaque requête de données), par countQcmSignalementsOuverts (js/db.js), que l'index des
// thèmes lit déjà. Les propositions de l'IA à relire (countBrouillonsIaARelire) ne sont pas lues avant le lot 2B (ruling R56 :
// la table des brouillons est commune à toutes les promos, sans auteur, et l'équipe n'a pas encore de liste où les retrouver) ;
// la fonction de comptage reste là pour lui. Une lecture qui échoue ou qui tarde ne dérange personne : son compte vaut null et
// la barre ne l'attend jamais. Les règles (lecture qui ne lève jamais, lecteurs de la pastille, résumé, texte des pastilles)
// sont dans js/a-traiter-rules.js ; la coquille (js/nav-shell.js) pose les pastilles.

import { countQcmSignalementsOuverts, countBrouillonsIaARelire } from "./db.js?v=20261029b";
import { formateurConnecte } from "./modules-etat.js?v=20261029b";
import { lireLesComptes, lecteursDeLaPastille } from "./a-traiter-rules.js?v=20261029b";

// Nombre total de signalements ouverts : countQcmSignalementsOuverts les rend par QCM (les compteurs de l'index des thèmes).
const somme = (parQcm) => Object.values(parQcm || {}).reduce((total, n) => total + (Number(n) || 0), 0);

// { signalements, propositionsIA } : chacun un nombre, ou null quand sa lecture échoue ; `propositionsIA` vaut null tant que le
// lot 2B n'a pas rouvert leur comptage (COMPTER_LES_PROPOSITIONS_IA). Équipe seulement : pour qui n'en est pas (« Voir en tant
// que » stagiaire compris), rien n'est lu, les deux valent null. Ne rejette jamais.
export async function chargerATraiter() {
  if (!formateurConnecte()) return { signalements: null, propositionsIA: null };
  return lireLesComptes(lecteursDeLaPastille({
    signalements: async () => somme(await countQcmSignalementsOuverts()),
    propositionsIA: countBrouillonsIaARelire,
  }));
}
