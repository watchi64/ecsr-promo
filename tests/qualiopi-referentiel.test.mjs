// Référentiel national qualité au 1er novembre 2026 (spec 2026-10-28, § 2 et 6.1). Les attendus
// viennent de l'annexe du décret n° 2026-728 (cases cochées, critères) et des articles 1, 2 et 5 de
// l'arrêté du 6 juin 2019 (indicateurs d'audit) : un écart vient du module, pas du test.
// Lancer depuis la racine du dépôt : node tests/qualiopi-referentiel.test.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { SOURCE, CRITERES, INDICATEURS, indicateursApplicables } from "../js/qualiopi-referentiel.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (v, msg) => { assert.ok(v, msg); n++; };

const plage = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const numeros = (liste) => liste.map((i) => i.numero);
const parmi = (test) => numeros(INDICATEURS.filter(test));
const indicateur = (num) => INDICATEURS.find((i) => i.numero === num);
const cles = (objet) => Object.keys(objet).sort();
// Caractères absents des textes officiels de l'annexe : espace insécable, tirets demi-cadratin et
// cadratin, apostrophe courbe (écrits par leur code pour ne pas les mettre dans ce fichier).
const ABSENTS_DES_TEXTES = [0xa0, 0x2013, 0x2014, 0x2019].map((code) => String.fromCharCode(code));

// --- Source ---
eq(SOURCE, {
  decret: "Décret n° 2026-728 du 1er août 2026 relatif au référentiel national sur la qualité des actions concourant au développement des compétences",
  nor: "TRSD2619632D",
  enVigueur: "2026-11-01",
  annexe: "LEGIARTI000054612711",
  arreteAudit: "Arrêté du 6 juin 2019 relatif aux modalités d'audit associées au référentiel national mentionné à l'article D. 6316-1-1 du code du travail",
}, "source : décret, NOR, entrée en vigueur, annexe et arrêté d'audit");

// --- Les 7 critères : titres de l'article R6316-1, tels quels ---
eq(CRITERES.map((c) => c.numero), plage(1, 7), "sept critères, de 1 à 7");
CRITERES.forEach((c) => eq(cles(c), ["numero", "titre"], `critère ${c.numero} : champs`));
eq(CRITERES.map((c) => c.titre), [
  "Les conditions d'information du public sur les prestations proposées, les délais pour y accéder et les résultats obtenus",
  "L'identification précise des objectifs des prestations proposées et l'adaptation de ces prestations aux publics bénéficiaires, lors de la conception des prestations",
  "L'adaptation aux publics bénéficiaires des prestations et des modalités d'accueil, d'accompagnement, de suivi et d'évaluation mises en œuvre",
  "L'adéquation des moyens pédagogiques, techniques et d'encadrement aux prestations mises en œuvre",
  "La qualification et le développement des connaissances et compétences des personnels chargés de mettre en œuvre les prestations",
  "L'inscription et l'investissement du prestataire dans son environnement professionnel",
  "Le recueil et la prise en compte des appréciations et des réclamations formulées par les parties prenantes aux prestations délivrées",
], "titres des critères");

// --- Les 33 indicateurs : forme ---
eq(INDICATEURS.length, 33, "33 indicateurs");
eq(numeros(INDICATEURS), plage(1, 33), "numéros de 1 à 33, sans trou, dans l'ordre");
const CHAMPS = ["numero", "critere", "court", "texte", "categories", "conditionnel", "majeureSeulement",
  "surveillance", "nouvelEntrant", "changement2026"].sort();
INDICATEURS.forEach((i) => {
  const lib = `indicateur ${i.numero}`;
  eq(cles(i), CHAMPS, `${lib} : champs`);
  eq(cles(i.categories), ["apprentissage", "bilan", "formation", "vae"], `${lib} : catégories`);
  eq(Object.values(i.categories).map((v) => typeof v), ["boolean", "boolean", "boolean", "boolean"], `${lib} : cases booléennes`);
  ok(Number.isInteger(i.critere) && i.critere >= 1 && i.critere <= 7, `${lib} : critère de 1 à 7`);
  ok(typeof i.majeureSeulement === "boolean" && typeof i.surveillance === "boolean" && typeof i.nouvelEntrant === "boolean",
    `${lib} : drapeaux d'audit booléens`);
  ok(i.conditionnel === null || (typeof i.conditionnel === "string" && i.conditionnel.length > 0), `${lib} : condition`);
  ok(i.changement2026 === null || (typeof i.changement2026 === "string" && i.changement2026.length > 0),
    `${lib} : changement de 2026`);
  // Libellé court : une ligne, sans numéro d'article ni point final.
  ok(typeof i.court === "string" && i.court.length > 0 && i.court.length <= 80 && !/\d/.test(i.court) && !i.court.endsWith("."),
    `${lib} : libellé court`);
  // Texte officiel : entier (majuscule au début, point à la fin), sans reste de HTML ni caractère étranger.
  ok(typeof i.texte === "string" && /^\p{Lu}/u.test(i.texte) && i.texte.endsWith("."), `${lib} : texte entier`);
  ok(i.texte === i.texte.trim() && !/\s{2,}/.test(i.texte) && !/[<>&]/.test(i.texte)
    && !ABSENTS_DES_TEXTES.some((c) => i.texte.includes(c)), `${lib} : texte propre`);
});
eq(new Set(INDICATEURS.map((i) => i.court)).size, 33, "libellés courts tous différents");

// --- Critères : quels indicateurs ---
const PAR_CRITERE = {
  1: plage(1, 3), 2: plage(4, 8), 3: plage(9, 16), 4: plage(17, 20), 5: [21, 22], 6: plage(23, 29), 7: plage(30, 33),
};
Object.entries(PAR_CRITERE).forEach(([critere, attendus]) =>
  eq(parmi((i) => i.critere === Number(critere)), attendus, `critère ${critere}`));

// --- Catégories visées : cases cochées de l'annexe (formation, bilan de compétences, VAE, apprentissage) ---
const CASES = {
  "XXXX": [1, 2, 4, 5, 6, 9, 10, 11, 12, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 30, 31, 32],
  "X.XX": [3, 16],
  "X..X": [7, 8, 13, 28],
  "...X": [14, 15, 20, 29, 33],
};
eq(Object.values(CASES).flat().sort((a, b) => a - b), plage(1, 33), "chaque indicateur est dans un seul groupe de cases");
const cases = (i) => ["formation", "bilan", "vae", "apprentissage"].map((k) => (i.categories[k] ? "X" : ".")).join("");
Object.entries(CASES).forEach(([motif, nums]) =>
  nums.forEach((num) => eq(cases(indicateur(num)), motif, `indicateur ${num} : cases cochées`)));
// Totaux par colonne : 28 en formation, 22 en bilan de compétences, 24 en VAE, 33 en apprentissage.
eq(["formation", "bilan", "vae", "apprentissage"].map((k) => INDICATEURS.filter((i) => i.categories[k]).length),
  [28, 22, 24, 33], "indicateurs par catégorie d'actions");

// --- Indicateurs qui s'appliquent à un centre de formation continue ---
const sans = indicateursApplicables();
const avec = indicateursApplicables({ alternance: true });
eq(sans.length, 27, "27 indicateurs sans alternance");
eq(avec.length, 28, "28 indicateurs avec l'alternance");
eq(numeros(sans), [...plage(1, 12), ...plage(16, 19), ...plage(21, 28), 30, 31, 32], "les 27, dans l'ordre des numéros");
eq(numeros(avec), [...plage(1, 13), ...plage(16, 19), ...plage(21, 28), 30, 31, 32], "les 28 : le 13 s'ajoute, à sa place");
[14, 15, 20, 29, 33].forEach((num) => {
  ok(!numeros(sans).includes(num), `${num} : apprentissage seulement, absent sans alternance`);
  ok(!numeros(avec).includes(num), `${num} : apprentissage seulement, absent avec l'alternance`);
});
ok(!numeros(sans).includes(13), "sans alternance : pas d'indicateur 13");
ok(numeros(avec).includes(13), "avec l'alternance : l'indicateur 13");
eq(numeros(indicateursApplicables({})), numeros(sans), "un objet vide vaut l'absence d'argument");
eq(numeros(indicateursApplicables({ alternance: false })), numeros(sans), "alternance à faux");
// Un tableau neuf à chaque appel : le retourner ou lui retirer un élément ne touche ni le référentiel ni l'appel suivant.
sans.reverse();
sans.pop();
eq(numeros(indicateursApplicables()), [...plage(1, 12), ...plage(16, 19), ...plage(21, 28), 30, 31, 32], "tableau neuf à chaque appel");
eq(numeros(INDICATEURS), plage(1, 33), "le référentiel garde son ordre");

// --- Règles d'audit (arrêté du 6 juin 2019, articles 5, 2 et 1) ---
eq(parmi((i) => i.majeureSeulement), [4, 5, 6, 7, 10, 11, 14, 15, 16, 20, 21, 22, 26, 27, 29, 31, 32],
  "non-conformité majeure seulement");
eq(indicateursApplicables().filter((i) => i.majeureSeulement).length, 13, "parmi les 27 applicables, 13 à non-conformité majeure seulement");
eq(parmi((i) => i.surveillance), [1, 3, 17, 19], "revus à chaque audit de surveillance");
eq(parmi((i) => i.nouvelEntrant), [2, 3, 11, 13, 14, 19, 22, 24, 25, 26, 32], "formalisation vérifiée pour un nouvel entrant");

// --- Condition portée par le texte ---
eq(parmi((i) => i.conditionnel !== null), [3, 7, 13, 16, 27, 28], "indicateurs dont le texte s'ouvre par une condition d'application");
INDICATEURS.filter((i) => i.conditionnel !== null).forEach((i) => {
  ok(i.texte.startsWith(i.conditionnel), `${i.numero} : la condition ouvre le texte, telle quelle`);
  ok(/^(Lorsque |Pour les formations en alternance$)/.test(i.conditionnel), `${i.numero} : « Lorsque » ou « Pour les formations en alternance »`);
});
eq(indicateur(13).conditionnel, "Pour les formations en alternance", "condition du 13");
eq(indicateur(27).conditionnel, "Lorsque le prestataire fait appel à la sous-traitance ou au portage salarial", "condition du 27");

// --- Ce que change 2026 ---
eq(parmi((i) => i.changement2026 !== null), [1, 2, 3, 7, 12, 14, 15, 19, 20, 27, 30, 31, 32, 33], "indicateurs modifiés ou nouveaux");

// --- Textes officiels, tels quels ---
ok(indicateur(33).texte.startsWith("Le prestataire met en place un dispositif d'évaluation des contenus et des enseignements par les apprenants"),
  "début du texte du 33");
ok(indicateur(32).texte.endsWith("analyse des risques sur la qualité des formations délivrées."), "fin du texte du 32");
eq(indicateur(5).texte, "Le prestataire définit les objectifs opérationnels et évaluables de la prestation.", "texte du 5");
ok(indicateur(17).texte.endsWith("plateaux techniques …)."), "points de suspension du texte officiel conservés");

// --- Fidélité des textes : épinglés par empreinte (les 33 textes joints par un saut de ligne) et par la liste des libellés courts ---
eq(createHash("sha256").update(INDICATEURS.map((i) => i.texte).join(String.fromCharCode(10)), "utf8").digest("hex"),
  "0afd5e970d168734aa581c48b808e4cdfc75c72acb7706af1664d884e962cdef", "les 33 textes des indicateurs n'ont pas bougé d'un caractère");
eq(INDICATEURS.map((i) => i.court), [
  "Information publique détaillée, sans mention trompeuse",
  "Résultats publiés avec leur mode de calcul",
  "Taux d'obtention, blocs, passerelles, poursuites, débouchés",
  "Analyse du besoin avec l'entreprise ou le financeur",
  "Objectifs opérationnels et évaluables",
  "Contenus et modalités adaptés",
  "Contenus conformes au titre, capacité à le délivrer",
  "Positionnement à l'entrée",
  "Informer sur le déroulement",
  "Adapter l'accompagnement et le suivi",
  "Évaluer l'atteinte des objectifs",
  "Engagement, ruptures, violences et discriminations",
  "Alternance (si le centre en fait)",
  "Accompagnement socio-professionnel et traitement des ruptures",
  "Droits des apprentis, sécurité, prévention et signalement",
  "Présentation à l'examen conforme",
  "Moyens humains et techniques",
  "Coordonner les intervenants",
  "Ressources pédagogiques et leur appropriation",
  "Mobilité, référent handicap, conseil de perfectionnement, gouvernance",
  "Compétences des intervenants",
  "Développement des compétences des salariés",
  "Veille légale et réglementaire, exploitée",
  "Veille métiers, compétences, emplois",
  "Veille innovations pédagogiques et technologiques",
  "Handicap",
  "Sous-traitance (s'il y en a)",
  "Stages : réseau de partenaires",
  "Insertion professionnelle et poursuite d'études",
  "Recueillir les appréciations",
  "Traiter difficultés, réclamations, aléas",
  "Amélioration continue et analyse des risques",
  "Évaluation des contenus et des enseignements par les apprenants",
], "les 33 libellés courts, dans l'ordre");

// --- Typographie : aucun tiret cadratin dans le module ---
const source = readFileSync(new URL("../js/qualiopi-referentiel.js", import.meta.url), "utf8");
ok(!source.includes(String.fromCharCode(0x2014)), "aucun tiret cadratin dans le module");

console.log(`qualiopi-referentiel : ${n} assertions OK`);
