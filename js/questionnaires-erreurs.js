// Erreurs des questionnaires Qualiopi : ce que la base répond, dit en français lisible à l'écran. Les mêmes messages
// servent aux stagiaires (tutoyés) et aux formateurs (vouvoyés) : formule neutre, ni « tu » ni « vous » (règle du 10/11).
// PUR : ni DOM ni réseau. Testé en node (tests/questionnaires-erreurs.test.mjs).
//
// La migration lève ses refus sous la forme « questionnaire: <phrase> » : la phrase est déjà du français à l'écran,
// on la reprend telle quelle, sauf quelques-unes qu'on précise (fermé, déjà répondu) et celles qui tutoient, redites en
// formule neutre (REFUS_NEUTRES). Une fonction absente de la base (migration pas encore appliquée) et une panne de réseau
// ont chacune leur phrase.

export const PHRASE_INDISPONIBLE = "Ce questionnaire n'est pas encore disponible. Merci de réessayer un peu plus tard.";
export const PHRASE_RESEAU = "L'envoi n'a pas abouti : merci de vérifier la connexion et de réessayer.";
export const PHRASE_FERME = "Ce questionnaire est fermé : la période pour y répondre est terminée ou n'a pas encore commencé.";
export const PHRASE_DEJA_REPONDU = "Une réponse à ce questionnaire est déjà enregistrée pour ce compte : une seule réponse est possible.";

// Refus de la base écrits au tutoiement (supabase/migrations/20261108_questionnaires.sql), redits en formule neutre.
const REFUS_NEUTRES = [
  [/^Reconnecte-toi/, "La session a expiré : une nouvelle connexion est nécessaire pour répondre."],
  [/^Le questionnaire a changé/, "Le questionnaire a changé : merci de recharger la page."],
  [/^Ce questionnaire ne te concerne pas/, "Ce questionnaire ne concerne pas ce compte."],
  [/^Ton commentaire dépasse/, "Le commentaire dépasse 2 000 caractères."],
];

const PREFIXE = "questionnaire:";

// La fonction n'existe pas dans la base (PostgREST : PGRST202 ; Postgres : 42883).
export function fonctionAbsente(erreur) {
  const code = String(erreur?.code ?? "");
  const texte = String(erreur?.message ?? erreur ?? "");
  return code === "PGRST202" || code === "42883" || /could not find the function|function .* does not exist/i.test(texte);
}

// La phrase de la base, sans son préfixe, ou nul si l'erreur n'est pas un refus de la migration.
export function phraseDeLaBase(erreur) {
  const texte = String(erreur?.message ?? erreur ?? "").trim();
  const i = texte.indexOf(PREFIXE);
  if (i < 0) return null;
  const phrase = texte.slice(i + PREFIXE.length).trim();
  return phrase || null;
}

// Message à afficher pour une erreur d'envoi ou de gestion.
export function messageErreurQuestionnaire(erreur) {
  if (fonctionAbsente(erreur)) return PHRASE_INDISPONIBLE;
  const phrase = phraseDeLaBase(erreur);
  if (phrase) {
    if (/^Ce questionnaire est fermé/.test(phrase)) return PHRASE_FERME;
    if (/^Tu as déjà répondu/.test(phrase)) return PHRASE_DEJA_REPONDU;
    const neutre = REFUS_NEUTRES.find(([motif]) => motif.test(phrase));
    return neutre ? neutre[1] : phrase;
  }
  return PHRASE_RESEAU;
}
