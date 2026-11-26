/*
 * Jalonya : application propriétaire.
 * © 2026 Timy Studio. Tous droits réservés. Voir LICENSE.
 *
 * L'adresse de l'application, calculée depuis la page ouverte : aucune adresse écrite en dur.
 * L'app marche aussi bien à la racine d'un domaine (https://app.exemple.fr/) que sous un
 * sous-chemin (https://compte.github.io/ecsr-promo/) : changer d'hébergeur ne touche plus le code.
 * Tests : tests/adresse.test.mjs.
 */

// Origine + dossier de la page, toujours terminé par « / » : le nom de fichier (index.html),
// la recherche (?…) et la route (#/…) sont retirés.
export function adresseApp(loc = globalThis.location) {
  const dossier = String(loc.pathname || "/").replace(/[^/]*$/, "");
  return loc.origin + (dossier.startsWith("/") ? dossier : "/" + dossier);
}

// Remplace le repère {adresse} d'un texte (modèles de message des Nouveautés) par l'adresse de l'app.
export function avecAdresse(texte, loc = globalThis.location) {
  if (typeof texte !== "string" || !texte.includes("{adresse}")) return texte;
  return texte.split("{adresse}").join(adresseApp(loc));
}
