// Règles de composition du Dossier Professionnel : quels blocs composent le
// document imprimé, dans quel ordre, avec quel numéro de page, et ce que
// contient le sommaire. Logique pure (aucun DOM, aucun réseau) pour rester
// testable en node, comme creneaux-rules.js et passage-rules.js.

// Les 5 rubriques officielles d'un exemple de pratique professionnelle, à plat.
export const CHAMPS_EXEMPLE = [
  "titre", "taches", "moyens", "avec_qui",
  "entreprise", "service", "du", "au", "complement",
];

export function cleExemple(at, n, champ) {
  return `at${at}_ex${n}_${champ}`;
}

function txt(data, cle) {
  return String((data && data[cle]) || "").trim();
}

// Un exemple est « rempli » dès qu'une seule de ses rubriques porte du texte.
export function exempleRempli(data, at, n) {
  return CHAMPS_EXEMPLE.some((c) => txt(data, cleExemple(at, n, c)) !== "");
}

// L'exemple n°1 de chaque activité-type s'imprime toujours, même vide : un DP
// vierge doit rester imprimable pour être rempli à la main. Le DP officiel
// demande « un à trois exemples » par activité-type.
export function exempleImprime(data, at, n) {
  return n === 1 || exempleRempli(data, at, n);
}

// Rubriques du document officiel, dans l'ordre. Le modèle ne contient ni page
// « Documents illustrant la pratique professionnelle » ni page « Annexes » : son
// sommaire les annonce, mais le document s'arrête à la déclaration sur l'honneur.
const RUBRIQUES_AVANT = ["couverture", "presentation", "sommaire", "intercalaire"];
const RUBRIQUES_APRES = ["titres", "declaration"];

// Rubriques réellement imprimées. Aucun numéro de page ici : il vient de la
// pagination réelle (js/dp-pagination.js), seule à savoir combien de feuilles
// occupe une fiche d'exemple une fois remplie.
export function rubriquesImprimees(data) {
  const out = RUBRIQUES_AVANT.map((type) => ({ type }));
  for (const at of [1, 2]) {
    for (const n of [1, 2, 3]) {
      if (exempleImprime(data, at, n)) out.push({ type: "exemple", at, n });
    }
  }
  RUBRIQUES_APRES.forEach((type) => out.push({ type }));
  return out;
}

// Rubriques affichées en ÉDITION : les 6 fiches d'exemple, même vides. Sans cela
// le candidat n'aurait aucun champ où saisir sa 2e ou sa 3e fiche. Celles qui
// resteront hors du document imprimé portent imprime:false.
export function rubriquesEdition(data) {
  const imprimees = new Set(
    rubriquesImprimees(data).map((r) => (r.type === "exemple" ? `exemple:${r.at}:${r.n}` : r.type)),
  );
  const out = RUBRIQUES_AVANT.map((type) => ({ type, imprime: true }));
  for (const at of [1, 2]) {
    for (const n of [1, 2, 3]) {
      out.push({ type: "exemple", at, n, imprime: imprimees.has(`exemple:${at}:${n}`) });
    }
  }
  RUBRIQUES_APRES.forEach((type) => out.push({ type, imprime: true }));
  return out;
}

// Entrées du sommaire : une fiche d'exemple imprimée par ligne, avec le titre
// saisi par le candidat. Le numéro de page est ajouté par la vue, à partir de la
// pagination.
export function sommaire(data) {
  return rubriquesImprimees(data)
    .filter((r) => r.type === "exemple")
    .map((r) => ({ at: r.at, n: r.n, titre: txt(data, cleExemple(r.at, r.n, "titre")) }));
}
