// Règles de composition du Dossier Professionnel : quels blocs composent le
// document imprimé, dans quel ordre, avec quel numéro de page, et ce que
// contient le sommaire. Logique pure (aucun DOM, aucun réseau) pour rester
// testable en node, comme creneaux-rules.js et passage-rules.js.

// Les 5 rubriques officielles d'un exemple de pratique professionnelle, à plat.
export const CHAMPS_EXEMPLE = [
  "titre", "taches", "moyens", "avec_qui",
  "entreprise", "service", "du", "au", "complement",
];

// Blocs fixes encadrant les exemples, dans l'ordre du document officiel.
const BLOCS_AVANT = ["couverture", "presentation", "sommaire", "intercalaire"];
const BLOCS_APRES = ["titres", "declaration", "documents", "annexes"];

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

// Blocs réellement imprimés, numérotés de 1 à N. Le numéro de page suit les
// rubriques du dossier, ce qui garde le sommaire cohérent avec le document.
export function blocsImprimes(data) {
  const blocs = BLOCS_AVANT.map((type) => ({ type }));
  for (const at of [1, 2]) {
    for (const n of [1, 2, 3]) {
      if (exempleImprime(data, at, n)) blocs.push({ type: "exemple", at, n });
    }
  }
  BLOCS_APRES.forEach((type) => blocs.push({ type }));
  return blocs.map((b, i) => ({ ...b, page: i + 1 }));
}

// Blocs affichés en mode ÉDITION : les 6 exemples, même vides. Sans cela le
// candidat n'aurait aucun champ où saisir son 2e ou 3e exemple, puisque les
// exemples vides sont absents du document imprimé. Les blocs non imprimés
// portent imprime:false et page:null ; ils sont masqués à l'impression.
export function blocsEdition(data) {
  const pages = new Map();
  const cle = (b) => (b.type === "exemple" ? `exemple:${b.at}:${b.n}` : b.type);
  blocsImprimes(data).forEach((b) => pages.set(cle(b), b.page));

  const blocs = BLOCS_AVANT.map((type) => ({ type }));
  for (const at of [1, 2]) {
    for (const n of [1, 2, 3]) blocs.push({ type: "exemple", at, n });
  }
  BLOCS_APRES.forEach((type) => blocs.push({ type }));

  return blocs.map((b) => {
    const page = pages.get(cle(b));
    return { ...b, imprime: page !== undefined, page: page === undefined ? null : page };
  });
}

// Entrées du sommaire : un exemple imprimé par ligne, avec le titre saisi par
// le candidat et le numéro de page calculé.
export function sommaire(data) {
  return blocsImprimes(data)
    .filter((b) => b.type === "exemple")
    .map((b) => ({ at: b.at, n: b.n, page: b.page,
                   titre: txt(data, cleExemple(b.at, b.n, "titre")) }));
}
