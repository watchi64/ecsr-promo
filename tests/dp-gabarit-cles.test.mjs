// Le gabarit du DP doit continuer à produire TOUTES les clés de sérialisation
// déjà utilisées en production. Renommer ou oublier une clé ferait disparaître
// du texte déjà écrit par un stagiaire, sans erreur visible : le champ se
// rendrait vide, et le premier enregistrement suivant effacerait la valeur.
//
// Ce fichier ne contient que des NOMS de clés, relevés en base le 2026-09-14.
// Aucun contenu de dossier n'y figure.
import assert from "node:assert/strict";
import { buildDpFlux } from "../js/views/dp-gabarit.js";

const CHAMPS_EXEMPLE = ["titre", "taches", "moyens", "avec_qui",
                        "entreprise", "service", "du", "au", "complement"];

// Schéma complet attendu : identité, modalité d'accès, déclaration sur
// l'honneur, les 9 champs des 6 fiches, les 10 lignes de titres et diplômes.
const ATTENDUES = [
  "nom_naissance", "nom_usage", "prenom", "adresse",
  "modalite_formation", "modalite_vae",
  "dh_nom", "dh_fait_a", "dh_le",
];
for (const at of [1, 2]) {
  for (const n of [1, 2, 3]) {
    for (const c of CHAMPS_EXEMPLE) ATTENDUES.push(`at${at}_ex${n}_${c}`);
  }
}
for (let i = 1; i <= 10; i += 1) {
  ATTENDUES.push(`titre${i}_intitule`, `titre${i}_organisme`, `titre${i}_date`);
}

// Clés effectivement observées dans les 11 dossiers commencés en production au
// 2026-09-14. Sous-ensemble du schéma, listé à part : ce sont celles dont la
// perte se verrait immédiatement, sur du texte réellement écrit.
const OBSERVEES = [
  "adresse", "nom_naissance", "nom_usage", "prenom", "modalite_formation",
  "dh_nom", "dh_fait_a", "dh_le",
  "at1_ex1_titre", "at1_ex1_taches", "at1_ex1_moyens", "at1_ex1_avec_qui",
  "at1_ex1_entreprise", "at1_ex1_service", "at1_ex1_du", "at1_ex1_au", "at1_ex1_complement",
  "at1_ex2_titre", "at1_ex2_taches", "at1_ex2_moyens", "at1_ex2_avec_qui",
  "at1_ex2_entreprise", "at1_ex2_service", "at1_ex2_du", "at1_ex2_au", "at1_ex2_complement",
  "at1_ex3_titre", "at1_ex3_taches", "at1_ex3_moyens", "at1_ex3_avec_qui",
  "at1_ex3_entreprise", "at1_ex3_service", "at1_ex3_du", "at1_ex3_au", "at1_ex3_complement",
  "at2_ex1_titre", "at2_ex1_taches", "at2_ex1_moyens", "at2_ex1_avec_qui",
  "at2_ex1_entreprise", "at2_ex1_service", "at2_ex1_du", "at2_ex1_au", "at2_ex1_complement",
  "titre1_intitule", "titre1_organisme", "titre1_date",
  "titre2_intitule", "titre2_organisme", "titre2_date",
  "titre3_intitule", "titre3_organisme", "titre3_date",
  "titre4_intitule", "titre4_organisme", "titre4_date",
];

const clesDe = (html) => [...html.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]);

// En mode édition, les 6 fiches sont rendues : c'est le flux d'édition qui doit
// tout porter, puisque c'est la seule source lue à l'enregistrement.
const htmlEdition = buildDpFlux({}, { edition: true });
const produites = new Set(clesDe(htmlEdition));

for (const k of OBSERVEES) {
  assert.ok(produites.has(k), `clé déjà écrite en production et absente du gabarit : ${k}`);
}
for (const k of ATTENDUES) {
  assert.ok(produites.has(k), `clé du schéma absente du gabarit : ${k}`);
}

// Aucune clé en double : deux champs partageant une clé se recopieraient l'un
// l'autre à la saisie, et le dernier lu écraserait le premier.
const liste = clesDe(htmlEdition);
assert.equal(liste.length, new Set(liste).size, "une clé data-k est produite deux fois");

// Aucune clé inattendue : une clé nouvelle serait écrite en base sans avoir été
// prévue, et le jour où on la retirerait, sa valeur serait perdue sans trace.
for (const k of produites) {
  assert.ok(ATTENDUES.includes(k), `clé inconnue du schéma produite par le gabarit : ${k}`);
}
assert.equal(produites.size, ATTENDUES.length,
  `le gabarit produit ${produites.size} clés, le schéma en attend ${ATTENDUES.length}`);

// Le document IMPRIMÉ d'un dossier vierge ne porte que les fiches n°1 : les
// clés des fiches 2 et 3 en sont absentes, ce qui est voulu. La contrainte de
// préservation porte sur le flux d'édition, pas sur le document composé.
const htmlImprime = buildDpFlux({}, { edition: false });
const imprimees = new Set(clesDe(htmlImprime));
assert.ok(imprimees.has("at1_ex1_taches") && imprimees.has("at2_ex1_taches"),
  "les fiches n°1 des deux activités-types doivent toujours être imprimées");
assert.ok(!imprimees.has("at1_ex2_taches"),
  "une fiche vide autre que la n°1 ne doit pas être imprimée");

// Dès qu'un champ d'une fiche porte du texte, la fiche entre dans le document
// imprimé avec ses neuf clés.
const avecFiche2 = new Set(clesDe(buildDpFlux({ at1_ex2_moyens: "Fiches" }, { edition: false })));
for (const c of CHAMPS_EXEMPLE) {
  assert.ok(avecFiche2.has(`at1_ex2_${c}`), `fiche remplie : clé manquante at1_ex2_${c}`);
}

console.log(`dp-gabarit-cles : OK, ${produites.size} clés, dont ${OBSERVEES.length} vues en production`);
