// Lecture des comptes « à traiter » de l'équipe (refonte, lot 2A) : les signalements de QCM non traités et les
// propositions de l'IA à relire, de la promo affichée (l'en-tête de promo de chaque requête de données), par les
// lectures de js/db.js qui les comptent déjà. Une lecture qui échoue ou qui tarde ne dérange personne : son compte vaut
// null et la barre ne l'attend jamais. Les règles (lecture qui ne lève jamais, résumé, texte des pastilles) sont dans
// js/a-traiter-rules.js ; la coquille (js/nav-shell.js) pose les pastilles.

import { countQcmSignalementsOuverts, countBrouillonsIaARelire } from "./db.js?v=20261029a";
import { formateurConnecte } from "./modules-etat.js?v=20261029a";
import { lireLesComptes } from "./a-traiter-rules.js?v=20261029a";

// Nombre total de signalements ouverts : countQcmSignalementsOuverts les rend par QCM (les compteurs de l'index des thèmes).
const somme = (parQcm) => Object.values(parQcm || {}).reduce((total, n) => total + (Number(n) || 0), 0);

// { signalements, propositionsIA } : chacun un nombre, ou null quand sa lecture échoue. Équipe seulement : pour qui n'en
// est pas (« Voir en tant que » stagiaire compris), rien n'est lu, les deux valent null. Ne rejette jamais.
export async function chargerATraiter() {
  if (!formateurConnecte()) return { signalements: null, propositionsIA: null };
  return lireLesComptes({
    signalements: async () => somme(await countQcmSignalementsOuverts()),
    propositionsIA: countBrouillonsIaARelire,
  });
}
