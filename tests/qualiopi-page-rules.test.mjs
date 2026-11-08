// Règles pures de la page Qualiopi (js/qualiopi-page-rules.js ; spec 2026-10-28, § 6.3 et 6.5) : dates en toutes lettres,
// période des 12 derniers mois, choix des promos du dossier du centre, libellés du sélecteur, résumé des critères, titre
// d'impression. Attendus écrits à la main.
// Lancer depuis la racine du dépôt : node tests/qualiopi-page-rules.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dateLongue, REFERENTIEL_APPLIQUE, REFERENTIEL_DU, periodeDouzeMois, promosDuCentre, nomPromo, libelleOptionPromo, resumeNiveaux,
  groupesParCritere, titreImpression,
} from "../js/qualiopi-page-rules.js";
import { inventairePromo } from "../js/qualiopi-preuves.js";
import { CRITERES, INDICATEURS } from "../js/qualiopi-referentiel.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (v, msg) => { assert.ok(v, msg); n++; };
const TIRET_CADRATIN = String.fromCharCode(0x2014);

// Gèle récursivement : si une règle modifiait son entrée, la modification lèverait une erreur.
function geler(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(geler); }
  return v;
}

// =====================================================================================================
// Dates en toutes lettres et référentiel appliqué
// =====================================================================================================
eq(dateLongue("2026-11-01"), "1er novembre 2026", "le premier du mois s'écrit « 1er »");
eq(dateLongue("2026-08-01"), "1er août 2026", "le décret : 1er août 2026");
eq(dateLongue("2026-10-28"), "28 octobre 2026", "un jour ordinaire");
eq(dateLongue("2026-12-02"), "2 décembre 2026", "pas de zéro devant le jour");
eq(dateLongue("2026-02-11T09:30:00+00:00"), "11 février 2026", "un horodatage compte par son jour");
eq(dateLongue("2026-03-31"), "31 mars 2026", "un 31");
eq(dateLongue("demain"), null, "texte illisible");
eq(dateLongue("2026-13-01"), null, "mois impossible");
eq(dateLongue(null), null, "valeur nulle");
eq(dateLongue(undefined), null, "valeur absente");
eq(dateLongue(20261101), null, "un nombre n'est pas une date");
eq(REFERENTIEL_APPLIQUE, "Décret n° 2026-728 du 1er août 2026, en vigueur le 1er novembre 2026", "le référentiel appliqué, sans l'objet du décret");
eq(REFERENTIEL_DU, "référentiel du 1er novembre 2026", "l'en-tête de la page");

// =====================================================================================================
// Période des 12 derniers mois
// =====================================================================================================
eq(periodeDouzeMois("2026-10-28"), { du: "2025-10-29", au: "2026-10-28" }, "le 28/10/2026 : du lendemain du 28/10/2025 au 28/10/2026");
eq(periodeDouzeMois("2026-10-28T09:00:00+00:00"), { du: "2025-10-29", au: "2026-10-28" }, "un horodatage compte par son jour");
eq(periodeDouzeMois("2026-12-31"), { du: "2026-01-01", au: "2026-12-31" }, "fin d'année : l'année civile entière");
eq(periodeDouzeMois("2026-01-01"), { du: "2025-01-02", au: "2026-01-01" }, "début d'année");
eq(periodeDouzeMois("2026-03-31"), { du: "2025-04-01", au: "2026-03-31" }, "un 31 : le lendemain est le 1er du mois suivant");
eq(periodeDouzeMois("2028-02-29"), { du: "2027-03-01", au: "2028-02-29" }, "29 février : l'an dernier n'a pas de 29, on part du 28 février");
eq(periodeDouzeMois("2027-02-28"), { du: "2026-03-01", au: "2027-02-28" }, "28 février d'une année ordinaire");
eq(periodeDouzeMois("2024-03-01"), { du: "2023-03-02", au: "2024-03-01" }, "le 1er mars après un 29 février");
eq(periodeDouzeMois("pas une date"), { du: null, au: null }, "date du jour illisible : période ouverte");
eq(periodeDouzeMois(undefined), { du: null, au: null }, "date du jour absente : période ouverte");
// Propriété : chaque jour de six ans donne une période de 365 jours (366 si elle contient un 29 février), qui finit ce jour-là.
{
  const JOUR_MS = 86400000;
  let jours = 0;
  for (let t = Date.UTC(2024, 0, 1); t <= Date.UTC(2029, 11, 31); t += JOUR_MS) {
    const aujourdhui = new Date(t).toISOString().slice(0, 10);
    const { du, au } = periodeDouzeMois(aujourdhui);
    const duree = (Date.parse(au) - Date.parse(du)) / JOUR_MS + 1;
    const bissextile = [...Array(4)].some((_, k) => { const f = `${Number(du.slice(0, 4)) + k}-02-29`; return f >= du && f <= au && new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f; });
    if (au !== aujourdhui || duree !== (bissextile ? 366 : 365)) assert.fail(`${aujourdhui} : du ${du} au ${au}, ${duree} jours`);
    jours++;
  }
  ok(jours === 2192, "propriété vérifiée sur 2 192 jours (2024 à 2029)");
}

// =====================================================================================================
// Promos du dossier du centre
// =====================================================================================================
const AUJOURDHUI = "2026-10-28";
const PERIODE = periodeDouzeMois(AUJOURDHUI);   // du 29/10/2025 au 28/10/2026
const promo = (id, lieu_id, date_debut, date_fin, plus = {}) => ({ id, lieu_id, nom: `Promo ${id}`, lieu_nom: lieu_id === 1 ? "Nîmes" : "Montpellier", date_debut, date_fin, ...plus });
const PROMOS = geler([
  promo(1, 1, "2026-03-30", "2026-12-11"),    // chevauche : en cours, fin dans l'avenir
  promo(2, 1, "2026-09-30", null),            // chevauche : sans date de fin, court jusqu'à aujourd'hui
  promo(3, 2, "2026-09-28", null),            // un autre centre
  promo(4, 1, "2024-01-08", "2025-10-28"),    // finie la veille du début de la période : exclue
  promo(5, 1, "2024-01-08", "2025-10-29"),    // finit le premier jour de la période : retenue (borne comprise)
  promo(6, 1, "2026-10-28", null),            // commence le dernier jour de la période : retenue (borne comprise)
  promo(7, 1, "2026-10-29", null),            // commence le lendemain : exclue
  promo(8, 1, null, null),                    // aucune date : bornes ouvertes, retenue
  promo(9, 1, null, "2025-06-01"),            // début inconnu mais finie bien avant la période : exclue
  promo(10, 1, "date illisible", "2026-11-01"), // début illisible (ouvert), fin dans la période : retenue
  promo(11, 1, "2025-01-01", null),           // sans fin, commencée avant la période : court jusqu'à aujourd'hui, retenue
  promo(12, null, "2026-03-30", null),        // sans lieu : jamais retenue
  promo(13, 1, "2025-01-01", "date illisible"), // fin illisible : comme sans fin, retenue
  promo(14, 1, "2026-10-28", "2026-10-28"),   // un seul jour, le dernier de la période : retenue
  promo(15, 1, "2025-10-29", "2025-10-29"),   // un seul jour, le premier de la période : retenue
]);
const ids = (liste) => liste.map((p) => p.id);
eq(ids(promosDuCentre(PROMOS, { lieuId: 1, ...PERIODE, aujourdhui: AUJOURDHUI })), [1, 2, 5, 6, 8, 10, 11, 13, 14, 15],
  "même lieu et dates qui chevauchent la période, dans l'ordre de la liste");
eq(ids(promosDuCentre(PROMOS, { lieuId: 2, ...PERIODE, aujourdhui: AUJOURDHUI })), [3], "l'autre centre : sa seule promo");
eq(ids(promosDuCentre(PROMOS, { lieuId: 3, ...PERIODE, aujourdhui: AUJOURDHUI })), [], "un lieu sans promo");
eq(promosDuCentre(PROMOS, { lieuId: null, ...PERIODE, aujourdhui: AUJOURDHUI }), [], "lieu nul : « le même centre » ne se détermine pas");
eq(promosDuCentre(PROMOS, { lieuId: undefined, ...PERIODE, aujourdhui: AUJOURDHUI }), [], "lieu absent");
eq(ids(promosDuCentre(PROMOS, { lieuId: "2", ...PERIODE, aujourdhui: AUJOURDHUI })), [3], "le lieu s'identifie par son numéro, qu'il soit écrit en chiffre ou en texte");
eq(ids(promosDuCentre([promo(20, "1", "2026-03-30", null)], { lieuId: 1, ...PERIODE, aujourdhui: AUJOURDHUI })), [20], "numéro de lieu écrit en texte dans la liste");
eq(ids(promosDuCentre(PROMOS, { lieuId: 1, du: null, au: null, aujourdhui: AUJOURDHUI })), [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15],
  "période ouverte : toutes les promos du lieu, sauf celle sans lieu");
eq(ids(promosDuCentre(PROMOS, { lieuId: 1, du: "2026-10-01", au: "2026-10-31", aujourdhui: AUJOURDHUI })), [1, 2, 6, 7, 8, 10, 11, 13, 14],
  "une autre période : octobre 2026");
eq(ids(promosDuCentre(PROMOS, { lieuId: 1, ...PERIODE, aujourdhui: "pas une date" })), [1, 2, 5, 6, 8, 10, 11, 13, 14, 15],
  "date du jour illisible : une promo sans fin garde sa borne ouverte, le résultat ne change pas ici");
eq(ids(promosDuCentre(PROMOS, { lieuId: 1, du: "2026-11-15", au: "2026-11-20", aujourdhui: AUJOURDHUI })), [1],
  "après aujourd'hui : seule celle qui se prolonge y figure, une promo sans date de fin ne dépasse pas aujourd'hui");
eq(ids(promosDuCentre(PROMOS, { lieuId: 1, du: "2026-10-29", au: "2026-10-31", aujourdhui: AUJOURDHUI })), [1, 7, 10],
  "les trois jours qui suivent aujourd'hui : la promo qui commence demain (sans fin) ne dure qu'un jour, jamais un intervalle à l'envers");
eq(promosDuCentre(null, { lieuId: 1, ...PERIODE, aujourdhui: AUJOURDHUI }), [], "liste absente");
eq(promosDuCentre({ longueur: 2 }, { lieuId: 1, ...PERIODE, aujourdhui: AUJOURDHUI }), [], "liste qui n'en est pas une");
eq(promosDuCentre([null, undefined, 3, promo(30, 1, "2026-03-30", null)].map((x) => x), { lieuId: 1, ...PERIODE, aujourdhui: AUJOURDHUI }).map((p) => p.id), [30],
  "des entrées qui ne sont pas des promos sont ignorées");
{
  const retenues = promosDuCentre(PROMOS, { lieuId: 1, ...PERIODE, aujourdhui: AUJOURDHUI });
  ok(retenues.every((p) => PROMOS.includes(p)), "ce sont les lignes de la liste, pas des copies");
  ok(retenues !== PROMOS, "un tableau neuf");
}

// =====================================================================================================
// Libellés du sélecteur
// =====================================================================================================
const DEUX_LIEUX = geler([promo(1, 1, "2026-03-30", null), promo(3, 2, "2026-09-28", null)]);
const UN_LIEU = geler([promo(1, 1, "2026-03-30", null), promo(2, 1, "2026-09-30", null)]);
eq(libelleOptionPromo(DEUX_LIEUX[0], DEUX_LIEUX), "Promo 1 · Nîmes", "plusieurs centres : le lieu suit le nom");
eq(libelleOptionPromo(DEUX_LIEUX[1], DEUX_LIEUX), "Promo 3 · Montpellier", "plusieurs centres, l'autre promo");
eq(libelleOptionPromo(UN_LIEU[0], UN_LIEU), "Promo 1", "un seul centre : le nom suffit");
eq(libelleOptionPromo(UN_LIEU[0]), "Promo 1", "sans liste : le nom");
eq(libelleOptionPromo({ id: 4, lieu_id: 2 }, DEUX_LIEUX), "Promo sans nom", "nom absent");
eq(libelleOptionPromo({ id: 4, lieu_id: 2, nom: "   " }, DEUX_LIEUX), "Promo sans nom", "nom blanc");
eq(libelleOptionPromo({ id: 4, lieu_id: 2, nom: "Été", lieu_nom: null }, DEUX_LIEUX), "Été", "plusieurs centres mais lieu sans nom : le nom seul");
eq(libelleOptionPromo({ id: 4, lieu_id: 2, nom: "  Été  ", lieu_nom: "  Béziers " }, DEUX_LIEUX), "Été · Béziers", "espaces retirés");
eq(libelleOptionPromo({ id: 5, lieu_id: 1, nom: "Nîmes, mars 2026", lieu_nom: "Nîmes" }, DEUX_LIEUX), "Nîmes, mars 2026", "le nom dit déjà le lieu : pas de répétition");
eq(libelleOptionPromo({ id: 5, lieu_id: 1, nom: "PROMO NÎMES 2026", lieu_nom: "Nîmes" }, DEUX_LIEUX), "PROMO NÎMES 2026", "le nom dit déjà le lieu, quelle que soit la casse");
eq(libelleOptionPromo({ id: 6, lieu_id: 3, nom: "Démonstration", lieu_nom: "Démonstration" }, DEUX_LIEUX), "Démonstration", "nom et lieu identiques");
eq(nomPromo({ nom: " Promo A " }), "Promo A", "nom nettoyé");
eq(nomPromo(null), "Promo sans nom", "pas de promo");

// =====================================================================================================
// Résumé d'un critère
// =====================================================================================================
const niveaux = (...liste) => liste.map((niveau) => ({ niveau }));
eq(resumeNiveaux(niveaux("prouve", "prouve", "partiel")), "3 indicateurs : 2 prouvés, 1 en partie", "pluriel de « prouvé »");
eq(resumeNiveaux(niveaux("prouve")), "1 indicateur : 1 prouvé", "singulier");
eq(resumeNiveaux(niveaux("hors")), "1 indicateur : 1 hors de l'app", "hors de l'app seul");
eq(resumeNiveaux(niveaux("partiel", "hors", "hors", "prouve")), "4 indicateurs : 1 prouvé, 1 en partie, 2 hors de l'app", "les trois niveaux, dans l'ordre prouvé, en partie, hors");
eq(resumeNiveaux(niveaux("partiel", "partiel", "partiel")), "3 indicateurs : 3 en partie", "un niveau à zéro n'est pas écrit");
eq(resumeNiveaux([]), "aucun indicateur applicable", "critère vide");
eq(resumeNiveaux(null), "aucun indicateur applicable", "liste absente");

// =====================================================================================================
// Les 7 critères d'un inventaire
// =====================================================================================================
const PROMO_TEST = { id: 7, lieu_id: 2, nom: "Promo de test", date_debut: "2026-09-28", date_fin: null };
const REFERENTIEL = { qcm: [], themes: [] };
const sans = inventairePromo({}, REFERENTIEL, { promo: PROMO_TEST, aujourdhui: AUJOURDHUI, alternance: false });
const avec = inventairePromo({}, REFERENTIEL, { promo: PROMO_TEST, aujourdhui: AUJOURDHUI, alternance: true });
const groupes = groupesParCritere(sans);
eq(groupes.map((g) => g.numero), [1, 2, 3, 4, 5, 6, 7], "les sept critères, dans l'ordre");
eq(groupes.map((g) => g.titre), CRITERES.map((c) => c.titre), "titres recopiés du décret, tels quels");
eq(groupes.map((g) => g.indicateurs.map((i) => i.numero)),
  [[1, 2, 3], [4, 5, 6, 7, 8], [9, 10, 11, 12, 16], [17, 18, 19], [21, 22], [23, 24, 25, 26, 27, 28], [30, 31, 32]],
  "27 indicateurs applicables rangés par critère");
eq(groupes.flatMap((g) => g.indicateurs.map((i) => i.numero)), sans.indicateurs.map((i) => i.numero), "chaque indicateur une fois, dans l'ordre de l'inventaire");
ok(groupes.every((g) => g.indicateurs.every((i) => i.critere === g.numero)), "chaque indicateur sous son critère");
eq(groupes[0].resume, "3 indicateurs : 2 en partie, 1 hors de l'app", "critère 1 : indicateurs 1 (hors), 2 et 3 (en partie)");
eq(groupes[2].resume, "5 indicateurs : 3 prouvés, 2 en partie", "critère 3 : 10, 11 et 16 prouvés, 9 et 12 en partie (annexe A)");
groupes.forEach((g) => {
  const comptes = ["prouve", "partiel", "hors"].map((niveau) => g.indicateurs.filter((i) => i.niveau === niveau).length);
  eq(comptes.reduce((a, b) => a + b, 0), g.indicateurs.length, `critère ${g.numero} : tous les niveaux sont comptés`);
});
eq(groupesParCritere(avec)[2].indicateurs.map((i) => i.numero), [9, 10, 11, 12, 13, 16], "l'alternance ajoute l'indicateur 13 au critère 3");
eq(groupesParCritere(avec).flatMap((g) => g.indicateurs).length, 28, "28 indicateurs avec l'alternance");
eq(groupesParCritere(null).map((g) => g.indicateurs), [[], [], [], [], [], [], []], "sans inventaire : sept critères vides");
eq(groupesParCritere(null)[0].resume, "aucun indicateur applicable", "résumé d'un critère vide");
eq(groupesParCritere({ indicateurs: "x" }).length, 7, "inventaire mal formé : les sept critères quand même");
ok(INDICATEURS.length === 33, "le référentiel garde ses 33 indicateurs (garde-fou du test)");

// =====================================================================================================
// Titre d'impression
// =====================================================================================================
eq(titreImpression("dossier-formation", "Montpellier, 2026", "2026-10-28"), "qualiopi-dossier-formation-montpellier-2026-2026-10-28", "nom du fichier sans « .csv »");
eq(titreImpression("dossier-centre-sans-noms", "Nîmes", "2026-10-28"), "qualiopi-dossier-centre-sans-noms-nimes-2026-10-28", "dossier du centre sans noms");
eq(titreImpression("dossier-formation", null, "pas une date"), "qualiopi-dossier-formation-promo-sans-date", "promo sans nom, date illisible");

// =====================================================================================================
// Hygiène du module
// =====================================================================================================
const source = readFileSync(new URL("../js/qualiopi-page-rules.js", import.meta.url), "utf8");
ok(!source.includes(TIRET_CADRATIN), "aucun tiret cadratin dans le module");
const code = source.replace(/\/\/.*$/gm, "");
ok(!/\bdocument\.|\bwindow\.|\bfetch\(|\bsupabase\b|\blocalStorage\b|\bnew Date\(\)/.test(code), "le module est pur : ni DOM, ni réseau, ni base, ni horloge");
eq(code.match(/^import .* from "(.*)";$/gm).map((l) => l.match(/from "(.*)"/)[1].replace(/\?v=\w+$/, "")),
  ["./qualiopi-referentiel.js", "./qualiopi-preuves.js", "./qualiopi-documents.js"], "il n'importe que des modules purs de l'app, avec le jeton de version");
ok(!/prof\b/i.test(source.replace(/profil/gi, "")), "aucun « prof » dans le module");
const ceTest = readFileSync(new URL(import.meta.url), "utf8");
ok(!ceTest.includes(TIRET_CADRATIN), "aucun tiret cadratin dans ce test");

console.log(`qualiopi-page-rules : ${n} assertions OK`);
