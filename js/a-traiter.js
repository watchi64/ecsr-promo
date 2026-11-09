// Lecture des comptes « à traiter » de l'équipe (refonte, lot 2A) : les signalements de QCM non traités de la promo
// affichée (l'en-tête de promo de chaque requête de données), par countQcmSignalementsOuverts (js/db.js), que l'index des
// thèmes lit déjà. Les propositions de l'IA à relire (countBrouillonsIaARelire) sont lues aussi,
// depuis le lot 2B : leur liste est le sous-onglet « Propositions IA » de Cours et QCM, réservé aux formateurs de la promo
// (isAdmin, formateur_courant en base : la table des brouillons est commune à toutes les promos, sans auteur, et seuls eux la lisent). Une lecture qui échoue ou qui tarde ne dérange personne : son compte vaut null et
// la barre ne l'attend jamais. Les règles (lecture qui ne lève jamais, lecteurs de la pastille, résumé, texte des pastilles)
// sont dans js/a-traiter-rules.js ; la coquille (js/nav-shell.js) pose les pastilles.

import { countQcmSignalementsOuverts, countBrouillonsIaARelire } from "./db.js?v=20261109f";
import { isAdmin } from "./auth-admin.js?v=20261109f";
import { lireLesComptes, lecteursDeLaPastille } from "./a-traiter-rules.js?v=20261109f";

// Nombre total de signalements ouverts : countQcmSignalementsOuverts les rend par QCM (les compteurs de l'index des thèmes).
const somme = (parQcm) => Object.values(parQcm || {}).reduce((total, n) => total + (Number(n) || 0), 0);

// { signalements, propositionsIA } : chacun un nombre, ou null quand sa lecture échoue ; `propositionsIA` suit COMPTER_LES_PROPOSITIONS_IA.
// Formateurs de la promo seulement (isAdmin, « écrit comme un formateur ») : ils sont les seuls à pouvoir traiter un
// signalement ou relire une proposition. Pour les autres (direction, siège, stagiaire, « Voir en tant que » compris), rien
// n'est lu, les deux valent null. Ne rejette jamais.
export async function chargerATraiter() {
  if (!isAdmin()) return { signalements: null, propositionsIA: null };
  return lireLesComptes(lecteursDeLaPastille({
    signalements: async () => somme(await countQcmSignalementsOuverts()),
    propositionsIA: countBrouillonsIaARelire,
  }));
}
