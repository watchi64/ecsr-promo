// Fiche « résultats » à publier (js/qualiopi-resultats.js et METHODES_PUBLIQUES de js/centre-stats.js ; spec 2026-10-28,
// § 6.6 et 6.8, indicateurs 2 et 3) : phrases publiques des méthodes, promo terminée ou en cours, taux d'abandon avec son
// effectif, valeurs absentes en toutes lettres, texte à coller sur le site du centre, fiches d'un centre l'une après l'autre
// sans total, copie dans le presse-papiers. Jeu fait à la main, attendus écrits à la main : un écart vient du module, pas du
// test. Lancer depuis la racine du dépôt : node tests/qualiopi-resultats.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  promoTerminee, ficheResultats, ficheResultatsTexte, fichesResultatsTexte, tableauFiche, copierTexte, noteProvisoire,
  AVERTISSEMENT_PROVISOIRE, AUCUNE_FORMATION,
} from "../js/qualiopi-resultats.js";
import { indicateursPromo, METHODES, METHODES_PUBLIQUES } from "../js/centre-stats.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (v, msg) => { assert.ok(v, msg); n++; };
const TIRET_CADRATIN = String.fromCharCode(0x2014);
// Le tableau de bord écrit « 25 % » avec une espace insécable avant le pourcentage ; la fiche fait de même.
const pc = (valeur) => `${valeur}${String.fromCharCode(0xa0)}%`;
const RACINE = fileURLToPath(new URL("../", import.meta.url));
const lire = (chemin) => readFileSync(RACINE + chemin, "utf8").replace(/\r\n/g, "\n");

// Gèle récursivement : si une règle modifiait son entrée, la modification lèverait une erreur.
function geler(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(geler); }
  return v;
}
// Les endroits où une valeur porte un NaN, un undefined, un null, une date invalide ou une trace de ces valeurs dans une
// phrase (liste vide si tout est propre).
function problemes(v, chemin = "fiche") {
  if (v === undefined) return [`${chemin} vaut undefined`];
  if (v === null) return [`${chemin} vaut null`];
  if (typeof v === "number") return Number.isFinite(v) ? [] : [`${chemin} vaut ${v}`];
  if (typeof v === "string") return /NaN|undefined|Invalid|\bnull\b|\[object/.test(v) ? [`${chemin} contient « ${v} »`] : [];
  if (Array.isArray(v)) return v.flatMap((x, i) => problemes(x, `${chemin}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => problemes(x, `${chemin}.${k}`));
  return [];
}

// =====================================================================================================
// Jeu de données : des promos réelles de forme (lignes de mes_promos) et leurs indicateurs, calculés par le vrai
// indicateursPromo à partir de stagiaires fabriqués (les `nbAbandons` premiers sont inactifs)
// =====================================================================================================
const AUJOURDHUI = "2026-12-12";
const REF = { qcm: [], themes: [] };
const donnees = (inscrits, abandons) => ({
  stagiaires: Array.from({ length: inscrits }, (_, i) => ({ id: i + 1, prenom: `P${i + 1}`, nom: `N${i + 1}`, actif: i >= abandons, ordre: i + 1 })),
  passages: [], evaluations: [], tentatives: [], epcf: [],
});
const indDe = (inscrits, abandons) => geler(indicateursPromo(donnees(inscrits, abandons), REF, { aujourdhui: AUJOURDHUI }));
const promo = (plus = {}) => geler({
  id: 1, lieu_id: 1, nom: "Nîmes, mars 2026", lieu_nom: "Nîmes", date_debut: "2026-03-30", date_fin: "2026-12-11", ...plus,
});
const CLES = ["effectif", "abandon", "presence", "titre", "satisfaction"];
const ligneDe = (fiche, cle) => fiche.lignes.find((l) => l.cle === cle);

// =====================================================================================================
// Méthodes publiques : mêmes clés que le tableau de bord, écrites pour le public
// =====================================================================================================
eq(Object.keys(METHODES_PUBLIQUES), CLES, "METHODES_PUBLIQUES : effectif, abandon, presence, titre (et non obtention), satisfaction");
for (const cle of CLES) {
  const phrase = METHODES_PUBLIQUES[cle];
  ok(cle in METHODES, `${cle} : la clé existe aussi dans METHODES (un seul endroit à tenir à jour)`);
  ok(typeof METHODES[cle] === "string" && METHODES[cle].length > 20, `${cle} : METHODES porte la phrase de l'équipe`);
  ok(typeof phrase === "string" && phrase.length > 30 && phrase.endsWith("."), `${cle} : une vraie phrase, qui finit par un point`);
  ok(!/\bfiches?\b/i.test(phrase), `${cle} : le public ne lit pas « fiche »`);
  ok(!/\bapp\b|application/i.test(phrase), `${cle} : le public ne lit pas « app »`);
  ok(!/\b(tu|toi|ton|ta|tes|te|vous|votre|vos)\b/i.test(phrase), `${cle} : impersonnel, ni tutoiement ni vouvoiement`);
  ok(!/tableau de bord|\bbase de données\b|\blot\b|\bPISTE\b|Supabase|\bjson\b|\bpromo\b/i.test(phrase), `${cle} : pas de jargon d'équipe`);
  ok(!phrase.includes(TIRET_CADRATIN) && !/\bprof\b/i.test(phrase), `${cle} : ni tiret cadratin ni « prof »`);
  ok(problemes(phrase).length === 0, `${cle} : aucune trace de valeur manquante`);
}
// Le sens de chaque méthode : ce qui est compté, puis ce par quoi on divise (un numérateur et un dénominateur échangés se verraient).
ok(/^Nombre de stagiaires inscrits à la formation, y compris ceux qui l'ont quittée avant la fin\.$/.test(METHODES_PUBLIQUES.effectif), "effectif : les inscrits, ceux qui sont partis compris");
ok(/^Nombre de stagiaires qui ont quitté la formation avant la fin, divisé par le nombre de stagiaires inscrits\./.test(METHODES_PUBLIQUES.abandon),
  "abandon : les départs divisés par les inscrits");
ok(/Le taux porte sur toute la durée de la formation : la date du départ n'est pas retenue\.$/.test(METHODES_PUBLIQUES.abandon), "abandon : le taux porte sur toute la durée (l'abandon n'est pas daté)");
ok(/^Heures réalisées divisées par les heures prévues, d'après les feuilles d'émargement clôturées de la formation/.test(METHODES_PUBLIQUES.presence)
  && /Un stagiaire qui a quitté la formation compte jusqu'à son départ\.$/.test(METHODES_PUBLIQUES.presence),
"présence : heures réalisées sur heures prévues, feuilles d'émargement clôturées, un stagiaire parti compte jusqu'à son départ");
ok(/^Heures réalisées divisées par heures prévues, sur les feuilles d'émargement closes de la promo, toutes lignes comprises/.test(METHODES.presence)
  && /un stagiaire parti figure sur les feuilles jusqu'à son départ\.$/.test(METHODES.presence),
"METHODES.presence : la phrase de l'équipe (R6), feuilles closes, toutes lignes comprises");
ok(/^Nombre de stagiaires déclarés admis par le jury du titre professionnel, divisé par le nombre de stagiaires présentés à l'examen\.$/.test(METHODES_PUBLIQUES.titre),
  "titre : les admis du jury divisés par les présentés à l'examen");
ok(/anonyme : part des réponses favorables, calculée sur le nombre de réponses reçues\.$/.test(METHODES_PUBLIQUES.satisfaction), "satisfaction : questionnaire anonyme, part des réponses favorables sur les réponses reçues");
ok(/5 réponses/.test(METHODES.satisfaction) && !METHODES.satisfaction.includes(TIRET_CADRATIN), "METHODES.satisfaction : la phrase de l'équipe, affichée à partir de 5 réponses");
// Les ajouts à METHODES sont sans effet sur le tableau de bord : il n'affiche que les clés qu'il liste (js/views/centre.js).
{
  const centre = lire("js/views/centre.js");
  const liste = centre.slice(centre.indexOf("const LIBELLES_METHODES = ["), centre.indexOf("];", centre.indexOf("const LIBELLES_METHODES = [")));
  ok(!/"presence"|"satisfaction"/.test(liste), "le tableau de bord ne liste ni presence ni satisfaction : son affichage ne bouge pas");
  ok(!/Object\.(keys|values|entries)\(METHODES\)/.test(centre), "et il n'énumère pas METHODES");
}

// =====================================================================================================
// Promo terminée ou en cours
// =====================================================================================================
{
  // Le module importe les dossiers avec le jeton de version de l'app ; sous cette même adresse, c'est la même fonction (sans jeton,
  // node chargerait une seconde copie du module, et l'identité ne se verrait pas).
  const jeton = lire("js/qualiopi-resultats.js").match(/qualiopi-documents\.js\?v=(\w+)/)[1];
  const dossiers = await import(`../js/qualiopi-documents.js?v=${jeton}`);
  ok(promoTerminee === dossiers.promoTerminee, "promoTerminee est celle des dossiers (js/qualiopi-documents.js), réexportée et non réécrite");
  const centre = await import(`../js/centre-stats.js?v=${lire("js/qualiopi-resultats.js").match(/centre-stats\.js\?v=(\w+)/)[1]}`);
  ok(centre.METHODES_PUBLIQUES === (await import("../js/qualiopi-resultats.js")).METHODES_PUBLIQUES, "METHODES_PUBLIQUES du module est celle du tableau de bord (js/centre-stats.js), réexportée");
}
eq(promoTerminee(promo({ date_fin: "2026-12-11" }), AUJOURDHUI), true, "finie la veille : terminée");
eq(promoTerminee(promo({ date_fin: "2026-12-12" }), AUJOURDHUI), false, "finit aujourd'hui : pas encore terminée");
eq(promoTerminee(promo({ date_fin: "2026-12-13" }), AUJOURDHUI), false, "finit demain : en cours");
for (const fin of [null, undefined, "", "bientôt", 20261211]) eq(promoTerminee(promo({ date_fin: fin }), AUJOURDHUI), false, `date de fin ${JSON.stringify(fin)} : en cours`);
eq(promoTerminee(promo(), undefined), false, "date du jour absente : jamais terminée");
eq(promoTerminee(null, AUJOURDHUI), false, "promo absente : jamais terminée");

// =====================================================================================================
// La fiche d'une promo terminée : taux d'abandon de 10 inscrits dont 1 abandon
// =====================================================================================================
const finie = ficheResultats({ promo: promo(), ind: indDe(10, 1), aujourdhui: AUJOURDHUI });
eq(finie.terminee, true, "promo finie la veille : terminée");
eq(finie.publiable, true, "promo finie la veille : publiable");
eq(finie.avertissement, "", "terminée : aucun avertissement");
eq(finie.lignes.map((l) => l.cle), CLES, "cinq lignes, sous les clés de METHODES (titre pour l'obtention du titre)");
{
  const abandon = ligneDe(finie, "abandon");
  eq(abandon.valeur, pc(10), "10 inscrits dont 1 abandon : « 10 % »");
  eq(abandon.effectif, 10, "avec l'effectif 10");
  eq(abandon.periode, "du 30/03/2026 au 11/12/2026", "sur la période de la promo (dates JJ/MM/AAAA)");
  eq(abandon.libelle, "Taux d'abandon", "libellé");
  const effectif = ligneDe(finie, "effectif");
  eq([effectif.libelle, effectif.valeur, effectif.effectif], ["Effectif", "10 inscrits", 10], "effectif : 10 inscrits");
}
eq(ligneDe(finie, "presence").valeur, "non mesuré", "présence : « non mesuré » (l'émargement n'est pas branché)");
eq(ligneDe(finie, "titre").valeur, "non saisi", "obtention du titre : « non saisi »");
eq(ligneDe(finie, "satisfaction").valeur, "non mesurée", "satisfaction : « non mesurée »");
eq(finie.lignes.map((l) => l.libelle), ["Effectif", "Taux d'abandon", "Taux de présence", "Taux d'obtention du titre", "Satisfaction des stagiaires"], "libellés lisibles par le public");
for (const l of finie.lignes) {
  eq(l.methode, METHODES_PUBLIQUES[l.cle], `${l.cle} : sa méthode est celle de METHODES_PUBLIQUES`);
  eq(l.periode, "du 30/03/2026 au 11/12/2026", `${l.cle} : sa période`);
  ok(Number.isInteger(l.effectif) && l.effectif >= 0, `${l.cle} : son effectif est un nombre`);
}
eq(problemes(finie), [], "la fiche d'une promo terminée : ni NaN, ni undefined, ni null, ni Invalid");
eq(finie.titre, "Résultats de la formation", "titre de la fiche");
eq(finie.entete, ["Centre : Nîmes", "Promotion : Nîmes, mars 2026", "Période : du 30/03/2026 au 11/12/2026", "Édité le 12/12/2026"], "en-tête : centre, promotion, période, date d'édition");

// Le taux est celui du tableau de bord : arrondi à l'entier, espace insécable.
eq(ligneDe(ficheResultats({ promo: promo(), ind: indDe(3, 1), aujourdhui: AUJOURDHUI }), "abandon").valeur, pc(33), "1 sur 3 : 33 %");
eq(ligneDe(ficheResultats({ promo: promo(), ind: indDe(3, 2), aujourdhui: AUJOURDHUI }), "abandon").valeur, pc(67), "2 sur 3 : 67 %");
{
  const sans = ficheResultats({ promo: promo(), ind: indDe(12, 0), aujourdhui: AUJOURDHUI });
  eq(ligneDe(sans, "abandon").valeur, pc(0), "aucun abandon : « 0 % », un vrai chiffre");
  eq(ligneDe(sans, "abandon").effectif, 12, "avec son effectif");
}
eq(ligneDe(ficheResultats({ promo: promo(), ind: indDe(1, 0), aujourdhui: AUJOURDHUI }), "effectif").valeur, "1 inscrit", "un seul inscrit : singulier");

// =====================================================================================================
// Promo en cours : jamais publiable
// =====================================================================================================
const AVERTISSEMENT = "Résultats provisoires : la formation n'est pas terminée. Ne pas publier.";
eq(AVERTISSEMENT_PROVISOIRE, AVERTISSEMENT, "le texte de l'avertissement, exact");
for (const [cas, fin] of [["sans date de fin", null], ["date de fin absente", undefined], ["date de fin vide", ""], ["date de fin illisible", "bientôt"],
  ["finit aujourd'hui", "2026-12-12"], ["finit demain", "2026-12-13"], ["finit dans un an", "2027-12-11"]]) {
  const f = ficheResultats({ promo: promo({ date_fin: fin }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI });
  eq([f.terminee, f.publiable, f.avertissement], [false, false, AVERTISSEMENT], `${cas} : en cours, pas publiable, avertissement`);
  eq(problemes(f), [], `${cas} : fiche propre`);
}
eq(ligneDe(ficheResultats({ promo: promo({ date_fin: null }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI }), "abandon").periode, "depuis le 30/03/2026",
  "sans date de fin : la période commence à la date de début");
{
  // Même avec toutes les valeurs saisies, une promo en cours n'est pas publiable.
  const f = ficheResultats({
    promo: promo({ date_fin: null }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI,
    presence: { taux: 0.95, effectif: 9 }, obtention: { taux: 1, effectif: 9 }, satisfaction: { taux: 0.9, effectif: 8 },
  });
  eq([f.terminee, f.publiable, f.avertissement], [false, false, AVERTISSEMENT], "toutes les valeurs saisies : toujours en cours, toujours pas publiable");
  eq(f.lignes.map((l) => l.valeur), ["10 inscrits", pc(10), pc(95), pc(100), pc(90)], "les valeurs saisies sont écrites");
}

// =====================================================================================================
// Valeurs fournies par l'appelant : { taux de 0 à 1, effectif } ; inutilisables, elles valent « absentes »
// =====================================================================================================
{
  const f = ficheResultats({
    promo: promo(), ind: indDe(10, 1), aujourdhui: AUJOURDHUI,
    presence: { taux: 0.916, effectif: 9 }, obtention: { taux: 0, effectif: 4 }, satisfaction: { taux: 1 },
  });
  eq([ligneDe(f, "presence").valeur, ligneDe(f, "presence").effectif], [pc(92), 9], "présence fournie : arrondie, avec son effectif");
  eq([ligneDe(f, "titre").valeur, ligneDe(f, "titre").effectif], [pc(0), 4], "obtention fournie à 0 % : un vrai chiffre, pas une valeur absente");
  eq([ligneDe(f, "satisfaction").valeur, ligneDe(f, "satisfaction").effectif], [pc(100), 10], "effectif non fourni : celui des inscrits");
  eq(problemes(f), [], "valeurs fournies : fiche propre");
}
for (const inutilisable of [null, undefined, {}, "0.9", 42, [], { taux: NaN }, { taux: Infinity }, { taux: null }, { taux: "0.9" }, { taux: 1.2 }, { taux: -0.1 }]) {
  const f = ficheResultats({ promo: promo(), ind: indDe(10, 1), aujourdhui: AUJOURDHUI, presence: inutilisable, obtention: inutilisable, satisfaction: inutilisable });
  eq(f.lignes.slice(2).map((l) => l.valeur), ["non mesuré", "non saisi", "non mesurée"], `valeur inutilisable ${JSON.stringify(inutilisable)} : les trois libellés d'absence`);
  eq(problemes(f), [], "et rien d'autre");
}
{
  const f = ficheResultats({ promo: promo(), ind: indDe(10, 1), aujourdhui: AUJOURDHUI, presence: { taux: 0.5, effectif: -3 }, satisfaction: { taux: 0.5, effectif: 2.5 } });
  eq([ligneDe(f, "presence").effectif, ligneDe(f, "satisfaction").effectif], [10, 10], "effectif fourni illisible : celui des inscrits");
}

// =====================================================================================================
// Promos vides ou mal formées : des mots, jamais NaN, undefined, null ni Invalid
// =====================================================================================================
const ENTREES_BANCALES = [
  ["promo sans inscrit", { promo: promo(), ind: indDe(0, 0), aujourdhui: AUJOURDHUI }],
  ["promo sans dates", { promo: promo({ date_debut: null, date_fin: null }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI }],
  ["promo sans nom ni centre", { promo: promo({ nom: "  ", lieu_nom: null }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI }],
  ["dates illisibles", { promo: promo({ date_debut: "demain", date_fin: "hier" }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI }],
  ["date du jour illisible", { promo: promo(), ind: indDe(10, 1), aujourdhui: "n'importe quoi" }],
  ["sans indicateurs", { promo: promo(), aujourdhui: AUJOURDHUI }],
  ["indicateurs vides", { promo: promo(), ind: {}, aujourdhui: AUJOURDHUI }],
  ["indicateurs en lambeaux", { promo: promo(), ind: { effectif: { valeur: NaN }, abandon: { valeur: undefined } }, aujourdhui: AUJOURDHUI }],
  ["indicateurs réduits à l'abandon", { promo: promo(), ind: { abandon: { valeur: 0.1, n: 10, detail: { abandons: 1, inscrits: 10 } } }, aujourdhui: AUJOURDHUI }],
  ["indicateurs réduits au détail de l'effectif", { promo: promo(), ind: { effectif: { detail: { inscrits: 7, enFormation: 7, abandons: 0 } } }, aujourdhui: AUJOURDHUI }],
  ["tout absent", {}],
  ["promo nulle", { promo: null, ind: null, aujourdhui: null }],
];
for (const [cas, entree] of ENTREES_BANCALES) {
  const f = ficheResultats(entree);
  eq(problemes(f), [], `${cas} : fiche sans NaN, undefined, null ni Invalid`);
  eq(f.lignes.map((l) => l.cle), CLES, `${cas} : toujours les cinq lignes`);
  ok(f.lignes.every((l) => typeof l.periode === "string" && l.periode !== "" && Number.isInteger(l.effectif) && l.methode === METHODES_PUBLIQUES[l.cle] && l.valeur !== ""),
    `${cas} : chaque ligne a sa période, son effectif, sa méthode et une valeur`);
  const texte = ficheResultatsTexte(f);
  eq(problemes(texte, "texte"), [], `${cas} : texte propre`);
  ok(!texte.includes(TIRET_CADRATIN), `${cas} : texte sans tiret cadratin`);
  eq(problemes(tableauFiche(f), "tableau"), [], `${cas} : tableau propre`);
}
{
  const vide = ficheResultats(ENTREES_BANCALES[0][1]);
  eq([ligneDe(vide, "effectif").valeur, ligneDe(vide, "effectif").effectif], ["aucun inscrit", 0], "promo sans inscrit : « aucun inscrit »");
  eq([ligneDe(vide, "abandon").valeur, ligneDe(vide, "abandon").effectif], ["non calculable", 0], "taux d'abandon d'une promo sans inscrit : « non calculable »");
  const sansDates = ficheResultats(ENTREES_BANCALES[1][1]);
  eq(ligneDe(sansDates, "abandon").periode, "dates non renseignées", "promo sans dates : « dates non renseignées »");
  eq(sansDates.avertissement, AVERTISSEMENT, "promo sans dates : en cours");
  const reduit = ficheResultats(ENTREES_BANCALES[8][1]);
  eq([ligneDe(reduit, "effectif").valeur, ligneDe(reduit, "abandon").valeur, ligneDe(reduit, "abandon").effectif], ["10 inscrits", pc(10), 10], "indicateurs réduits à l'abandon : les inscrits viennent de l'abandon");
  const detail = ficheResultats(ENTREES_BANCALES[9][1]);
  eq([ligneDe(detail, "effectif").valeur, ligneDe(detail, "abandon").valeur], ["7 inscrits", "non calculable"], "indicateurs réduits au détail de l'effectif : 7 inscrits, pas de taux");
  const anonyme = ficheResultats(ENTREES_BANCALES[2][1]);
  eq(anonyme.entete.slice(0, 2), ["Centre : non renseigné", "Promotion : nom non renseigné"], "promo sans nom ni centre : des mots");
  eq(ficheResultats(ENTREES_BANCALES[4][1]).entete[3], "Édité le date non renseignée", "date du jour illisible : « date non renseignée »");
  eq(ficheResultats(ENTREES_BANCALES[4][1]).publiable, false, "date du jour illisible : jamais publiable");
}

// =====================================================================================================
// Le texte à coller sur le site du centre
// =====================================================================================================
const BLOC_ENTETE = "Résultats de la formation\nCentre : Nîmes\nPromotion : Nîmes, mars 2026\nPériode : du 30/03/2026 au 11/12/2026\nÉdité le 12/12/2026";
const SOUS = "Effectif : 10 stagiaires. Période : du 30/03/2026 au 11/12/2026.";
const TEXTE_FINIE = [
  BLOC_ENTETE,
  `Effectif : 10 inscrits\nPériode : du 30/03/2026 au 11/12/2026.\nMéthode : ${METHODES_PUBLIQUES.effectif}`,
  `Taux d'abandon : ${pc(10)}\n${SOUS}\nMéthode : ${METHODES_PUBLIQUES.abandon}`,
  `Taux de présence : non mesuré\n${SOUS}\nMéthode : ${METHODES_PUBLIQUES.presence}`,
  `Taux d'obtention du titre : non saisi\n${SOUS}\nMéthode : ${METHODES_PUBLIQUES.titre}`,
  `Satisfaction des stagiaires : non mesurée\n${SOUS}\nMéthode : ${METHODES_PUBLIQUES.satisfaction}`,
].join("\n\n");
eq(ficheResultatsTexte(finie), TEXTE_FINIE, "texte d'une promo terminée : en-tête, puis chaque chiffre avec son effectif, sa période et sa méthode");
{
  const enCours = ficheResultats({ promo: promo({ date_fin: null }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI });
  const texte = ficheResultatsTexte(enCours);
  eq(texte.split("\n")[0], AVERTISSEMENT, "promo en cours : l'avertissement est la première ligne du texte, avant tout chiffre");
  ok(texte.indexOf(AVERTISSEMENT) < texte.indexOf("Taux d'abandon"), "avant le premier chiffre");
  ok(texte.includes(`Taux d'abandon : ${pc(10)}\nEffectif : 10 stagiaires. Période : depuis le 30/03/2026.`), "avec la période « depuis le … »");
  ok(!ficheResultatsTexte(finie).includes("Ne pas publier"), "promo terminée : aucun avertissement dans le texte");
}
ok(!ficheResultatsTexte(finie).includes(TIRET_CADRATIN), "aucun tiret cadratin");
eq(ficheResultatsTexte(null), "", "pas de fiche, pas de texte");
eq(ficheResultatsTexte(undefined), "", "fiche absente : texte vide");
eq(ficheResultatsTexte({}), "", "fiche sans lignes : texte vide");
// Le public ne lit ni « fiche », ni « app », ni jargon, et n'est pas tutoyé, quel que soit le cas.
for (const [cas, entree] of [["terminée", { promo: promo(), ind: indDe(10, 1), aujourdhui: AUJOURDHUI }], ["en cours", { promo: promo({ date_fin: null }), ind: indDe(10, 1), aujourdhui: AUJOURDHUI }],
  ...ENTREES_BANCALES]) {
  const texte = ficheResultatsTexte(ficheResultats(entree));
  ok(!/\bfiches?\b/i.test(texte), `${cas} : le texte public ne dit pas « fiche »`);
  ok(!/\bapp\b|application/i.test(texte), `${cas} : ni « app »`);
  ok(!/\b(tu|toi|ton|ta|tes|te|vous|votre|vos)\b/i.test(texte), `${cas} : ni tutoiement ni vouvoiement`);
  ok(!/tableau de bord|\bbase de données\b|\blot\b|\bPISTE\b|Supabase|\bjson\b/i.test(texte), `${cas} : pas de jargon`);
  ok(!/\bprof\b/i.test(texte), `${cas} : « formateur », jamais « prof »`);
}

// Le tableau de l'impression : les mêmes mots que le texte.
eq(tableauFiche(finie).entetes, ["Indicateur", "Résultat", "Effectif", "Période", "Méthode de calcul"], "tableau : en-têtes");
eq(tableauFiche(finie).lignes[1], ["Taux d'abandon", pc(10), "10 stagiaires", "du 30/03/2026 au 11/12/2026", METHODES_PUBLIQUES.abandon], "tableau : la ligne de l'abandon");
eq(tableauFiche(finie).lignes.map((l) => l[1]), ["10 inscrits", pc(10), "non mesuré", "non saisi", "non mesurée"], "tableau : les cinq résultats");
eq(tableauFiche(ficheResultats(ENTREES_BANCALES[0][1])).lignes[0].slice(1, 3), ["aucun inscrit", "aucun stagiaire"], "tableau : promo sans inscrit");
eq(tableauFiche(null), { entetes: ["Indicateur", "Résultat", "Effectif", "Période", "Méthode de calcul"], lignes: [] }, "tableau d'une fiche absente : vide, sans erreur");

// =====================================================================================================
// Fiche d'un centre : les fiches de ses promos l'une après l'autre, jamais de total
// =====================================================================================================
{
  const a = ficheResultats({ promo: promo(), ind: indDe(10, 1), aujourdhui: AUJOURDHUI });
  const b = ficheResultats({ promo: promo({ id: 2, nom: "Nîmes, septembre 2026", date_debut: "2026-09-28", date_fin: null }), ind: indDe(20, 4), aujourdhui: AUJOURDHUI });
  const texte = fichesResultatsTexte([a, b]);
  eq(texte, `${ficheResultatsTexte(a)}\n\n\n${ficheResultatsTexte(b)}`, "les fiches se suivent dans l'ordre reçu, séparées de deux lignes vides");
  ok(texte.indexOf("Promotion : Nîmes, mars 2026") < texte.indexOf("Promotion : Nîmes, septembre 2026"), "la première promo d'abord");
  ok(texte.includes("Effectif : 10 inscrits") && texte.includes("Effectif : 20 inscrits"), "chaque promo avec son effectif");
  ok(texte.includes(`Taux d'abandon : ${pc(10)}`) && texte.includes(`Taux d'abandon : ${pc(20)}`), "chaque promo avec son taux");
  ok(!/30 (inscrits|stagiaires)/.test(texte) && !texte.includes(pc(17)), "jamais de total : ni 30 inscrits, ni 5 abandons sur 30 (17 %)");
  ok(!/total|ensemble|cumul|moyenne|globa/i.test(texte), "ni le mot total, ni cumul, ni moyenne");
  eq(texte.split(AVERTISSEMENT).length - 1, 1, "l'avertissement n'est écrit que pour la promo en cours");
  eq(texte.split("\n")[0], "Résultats de la formation", "la promo terminée ouvre le texte, sans avertissement");
  eq(problemes(texte, "texte"), [], "texte du centre propre");
  eq(fichesResultatsTexte([b, a]).indexOf(AVERTISSEMENT), 0, "dans l'ordre inverse, la promo en cours (et son avertissement) ouvre le texte");
  eq(noteProvisoire([a, b]), "1 formation en cours : résultats provisoires, à ne pas publier.", "note pour la page : une formation en cours");
  eq(noteProvisoire([b, b]), "2 formations en cours : résultats provisoires, à ne pas publier.", "au pluriel");
  eq(noteProvisoire([a]), "", "aucune note quand tout est terminé");
  eq(noteProvisoire([]), "", "aucune note sans promo");
  eq(noteProvisoire(undefined), "", "ni sans liste");
  eq(fichesResultatsTexte([a]), ficheResultatsTexte(a), "une seule promo : sa fiche telle quelle");
}
eq(fichesResultatsTexte([]), AUCUNE_FORMATION, "centre sans promo dans la période : une phrase, pas un texte vide");
eq(AUCUNE_FORMATION, "Aucune formation de ce centre dans la période.", "texte exact");
eq(fichesResultatsTexte(undefined), AUCUNE_FORMATION, "liste absente : la même phrase");
eq(fichesResultatsTexte([null, undefined, {}]), AUCUNE_FORMATION, "fiches vides écartées");

// =====================================================================================================
// Copier le texte : navigator.clipboard.writeText, avec un message clair s'il est refusé ou absent
// =====================================================================================================
{
  const copies = [];
  const navigatorOk = { clipboard: { writeText: async (t) => { copies.push(t); } } };
  eq(await copierTexte("Résultats", navigatorOk), { copie: true, message: "Texte copié." }, "copie réussie : message bref");
  eq(copies, ["Résultats"], "le texte exact est passé à writeText");

  const refus = await copierTexte("x", { clipboard: { writeText: () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })) } });
  eq(refus.copie, false, "presse-papiers refusé : pas de copie");
  ok(/refusé/.test(refus.message) && /Copier le texte/.test(refus.message) && /PDF/.test(refus.message), "message clair : refusé, comment réessayer, et l'impression en PDF");
  const leve = await copierTexte("x", { clipboard: { writeText: () => { throw new Error("sécurité"); } } });
  eq(leve.copie, false, "writeText qui lève sans rendre de promesse : pas de copie, pas d'exception");
  eq(leve.message, refus.message, "même message que pour un refus");
  const absents = [undefined, null, {}, { clipboard: undefined }, { clipboard: {} }, { clipboard: { writeText: "non" } }];
  for (const nav of absents) {
    const absent = await copierTexte("x", nav);
    eq(absent.copie, false, `presse-papiers absent (${JSON.stringify(nav) ?? "undefined"}) : pas de copie`);
    ok(/pas disponible/.test(absent.message) && /PDF/.test(absent.message), "message clair : la copie n'est pas disponible, l'impression en PDF reste possible");
    ok(!absent.message.includes(TIRET_CADRATIN) && problemes(absent.message, "message").length === 0, "message propre");
  }
  eq((await copierTexte("x")).copie, false, "sans navigateur fourni (node) : absent, sans exception");
  const lecteurLent = { clipboard: { writeText: () => new Promise((resolve) => setTimeout(resolve, 5)) } };
  eq((await copierTexte("x", lecteurLent)).copie, true, "copie asynchrone : on attend la fin");
  // writeText est appelé tout de suite (avant le premier await) : le geste de l'utilisateur est encore valide.
  const ordre = [];
  const promesse = copierTexte("x", { clipboard: { writeText: async () => { ordre.push("writeText"); } } });
  ordre.push("après l'appel");
  await promesse;
  eq(ordre, ["writeText", "après l'appel"], "writeText part dans la pile du clic, pas après un détour");
}

// =====================================================================================================
// Le module est pur et ses fichiers sont propres
// =====================================================================================================
{
  const source = lire("js/qualiopi-resultats.js");
  const code = source.replace(/\/\/.*$/gm, "");
  ok(!/\bdocument\b|\bwindow\b|\bfetch\s*\(|localStorage|sessionStorage|\bimport\s*\(/.test(code), "module pur : ni DOM, ni réseau, ni stockage");
  eq([...source.matchAll(/from "(\.\/[^"]+)"/g)].map((m) => m[1].split("?")[0]).sort(), ["./centre-stats.js", "./qualiopi-documents.js", "./qualiopi-preuves.js"],
    "n'importe que le tableau de bord, les dossiers et l'inventaire");
  ok(/navigator\.clipboard\.writeText\(texte\)/.test(code), "la copie passe par navigator.clipboard.writeText");
  ok(!/function promoTerminee|promoTerminee =/.test(code), "promoTerminee n'est pas réécrite ici");
  for (const [fichier, texte] of [["js/qualiopi-resultats.js", source], ["js/centre-stats.js", lire("js/centre-stats.js")]]) {
    ok(!texte.includes(TIRET_CADRATIN), `${fichier} : aucun tiret cadratin`);
    ok(!/\bprof\b/i.test(texte.replace(/\bprofil\w*/gi, "")), `${fichier} : « formateur », jamais « prof »`);
  }
  ok(!lire("tests/qualiopi-resultats.test.mjs").includes(TIRET_CADRATIN), "tests/qualiopi-resultats.test.mjs : aucun tiret cadratin");
}

console.log(`qualiopi-resultats : ${n} assertions OK`);
