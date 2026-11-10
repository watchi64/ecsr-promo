// Anonymat des notes : les fiches de la promo affichée dont le compte a masqué ses notes. C'est tout ce que la vue Notes
// demande aux comptes des camarades (pour retirer leur prénom). Depuis le 10/11/2026, un stagiaire ne lit plus le profil
// des autres stagiaires (adresse e-mail comprise) : l'information vient de la fonction fiches_notes_masquees de la base
// (migration 20261110_profils_email_stagiaires), et des profils seulement tant que la base n'est pas migrée.
// PUR : ni DOM ni réseau. Lecture : listFichesNotesMasquees (js/db.js). Testé par tests/notes-masquees.test.mjs.

// Un numéro de fiche lisible, ou null.
function numero(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const n = Number(valeur);
  return Number.isInteger(n) ? n : null;
}

// Ce que rend fiches_notes_masquees : une liste de nombres (ou, selon le client, d'objets à une colonne).
export function fichesDeLaFonction(lignes) {
  const fiches = new Set();
  (lignes || []).forEach((ligne) => {
    const n = numero(ligne !== null && typeof ligne === "object" ? Object.values(ligne)[0] : ligne);
    if (n !== null) fiches.add(n);
  });
  return fiches;
}

// Repli, base pas encore migrée : les fiches des profils lisibles qui ont masqué leurs notes.
export function fichesDesProfils(profils) {
  const fiches = new Set();
  (profils || []).forEach((p) => {
    const n = numero(p?.stagiaire_id);
    if (p?.anonymous_notes && n !== null) fiches.add(n);
  });
  return fiches;
}
