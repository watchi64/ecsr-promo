// Branchements Qualiopi de la satisfaction (plan Q3, tâche 7) : la pièce « appreciations » de l'inventaire, la ligne de la fiche
// résultats, la section « Appréciations » du dossier de la formation et le taux par promo du dossier du centre. Le taux vient
// du questionnaire de fin de formation (« sans avis » exclu), rien n'est écrit sous le seuil de 5, les commentaires n'entrent dans
// aucun dossier. Lancer : node --test tests/qualiopi-satisfaction.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { satisfactionDe, inventairePromo, PIECES } from "../js/qualiopi-preuves.js";
import { modeleDossierFormation, modeleDossierCentre } from "../js/qualiopi-documents.js";
import { ficheResultats, ficheResultatsTexte, tableauFiche } from "../js/qualiopi-resultats.js";
import { indicateursPromo, METHODES_PUBLIQUES } from "../js/centre-stats.js";

const TIRET_CADRATIN = String.fromCharCode(0x2014);
const REF = { qcm: [], themes: [] };
const AUJOURDHUI = "2026-12-20";
const PROMO = { id: 7, lieu_id: 2, lieu_nom: "Nîmes", nom: "Nîmes, décembre 2026", date_debut: "2026-09-28", date_fin: "2026-12-11" };
const stagiaires = (n) => Array.from({ length: n }, (_, k) => ({ id: k + 1, prenom: "Prénom" + k, nom: "Nom" + k, actif: true, ordre: k + 1 }));

// Ce que rend la base (js/db.js, lireResultatsQuestionnaire) : comptes par question, rien sous le seuil.
const resultats = (comptes, reponses = Object.values(comptes).reduce((a, b) => a + b, 0)) =>
  ({ cle: "fin_stagiaire", public: "stagiaire", seuil: 5, reponses, questions: reponses >= 5 ? { globalement: comptes } : {} });
const SOUS_SEUIL = { cle: "fin_stagiaire", public: "stagiaire", seuil: 5, reponses: null, questions: {} };
const ABSENT = { cle: "fin_stagiaire", public: null, seuil: null, reponses: null, questions: {} };

const donneesAvec = (satisfaction, n = 10) => ({ stagiaires: stagiaires(n), satisfaction });
const inv = (satisfaction, n = 10) => inventairePromo(donneesAvec(satisfaction, n), REF, { promo: PROMO, aujourdhui: AUJOURDHUI });
const pieceDe = (i, numero) => i.indicateurs.find((x) => x.numero === numero).pieces.find((p) => p.cle === "appreciations");

test("satisfactionDe : au seuil, sous le seuil, sans avis exclu, migration absente", () => {
  // 7 notés : 3 + 2 favorables (4 et 3) sur 7 = 5/7 = 71 % ; le « sans avis » ne compte pas
  assert.deepEqual(satisfactionDe(resultats({ 4: 3, 3: 2, 2: 1, 1: 1, sans_avis: 1 }), 10), { etat: "mesuree", taux: 71, repondants: 7, inscrits: 10 });
  // au seuil : 5 réponses notées
  assert.deepEqual(satisfactionDe(resultats({ 4: 2, 3: 2, 2: 1 }), 8), { etat: "mesuree", taux: 80, repondants: 5, inscrits: 8 });
  // 4 réponses : la base ne rend rien
  assert.deepEqual(satisfactionDe(SOUS_SEUIL, 8), { etat: "sous_seuil" });
  // 5 réponses dont 2 sans avis : 3 notés, sous le seuil
  assert.deepEqual(satisfactionDe(resultats({ 4: 2, 3: 1, sans_avis: 2 }), 8), { etat: "sous_seuil" });
  // migration pas appliquée, lecture refusée ou absente
  assert.deepEqual(satisfactionDe(ABSENT, 8), { etat: "absente" });
  // seule la fonction manquante est « absente » ; une lecture en échec (réseau, droit) est « non lue », jamais « absente »
  assert.deepEqual(satisfactionDe({ echec: true }, 8), { etat: "non_lue" });
  assert.deepEqual(satisfactionDe(null, 8), { etat: "non_lue" });
  assert.deepEqual(satisfactionDe(undefined, 8), { etat: "non_lue" });
});

test("pièce « appreciations » : servie aux indicateurs 30 et 32, présente à partir du seuil", () => {
  assert.deepEqual(PIECES.find((p) => p.cle === "appreciations"), { cle: "appreciations", libelle: "Appréciations", indicateurs: [30, 32] });
  const i = inv({ etat: "mesuree", taux: 80, repondants: 5, inscrits: 10 });
  for (const numero of [30, 32]) {
    const p = pieceDe(i, numero);
    assert.equal(p.presente, true);
    assert.equal(p.raison, null);
    assert.match(p.detail, /^questionnaire de fin de formation, 80\s% de réponses favorables \(5 répondants sur 10 inscrits\)$/);
  }
});

test("pièce « appreciations » : sous le seuil, une raison fixe sans chiffre", () => {
  const p = pieceDe(inv({ etat: "sous_seuil" }), 30);
  assert.equal(p.presente, false);
  assert.equal(p.detail, null);
  assert.equal(p.raison, "moins de 5 réponses au questionnaire de fin de formation");
});

test("pièce « appreciations » : migration absente ou rien lu, absente avec une raison calme", () => {
  const p = pieceDe(inv({ etat: "absente" }), 30);
  assert.equal(p.presente, false);
  assert.equal(p.raison, "questionnaire de fin de formation pas encore en service");
});

const RAISON_NON_LUE = "questionnaire de fin de formation non lu (erreur de lecture)";

test("pièce « appreciations » : une lecture en échec est « non lue », pas « absente », y compris sans lecture faite", () => {
  for (const s of [{ etat: "non_lue" }, undefined, null]) {
    for (const numero of [30, 32]) {
      const p = pieceDe(inv(s), numero);
      assert.equal(p.presente, false);
      assert.equal(p.raison, RAISON_NON_LUE);
    }
  }
});

test("le niveau de l'indicateur 30 reste celui de l'annexe A", () => {
  const x = inv({ etat: "mesuree", taux: 90, repondants: 9, inscrits: 10 }).indicateurs.find((e) => e.numero === 30);
  assert.equal(x.niveau, "partiel");
  assert.equal(x.apporte, "enquête hors de l'app");
  assert.deepEqual(x.aFournir, ["avis des financeurs et entreprises"]);
});

test("sans inscrit connu, la phrase ne dit pas « sur 0 inscrit »", () => {
  const p = pieceDe(inv({ etat: "mesuree", taux: 100, repondants: 5, inscrits: 0 }, 0), 30);
  assert.match(p.detail, /\(5 répondants\)$/);
});

// --- Fiche résultats ---

const IND = indicateursPromo({ stagiaires: stagiaires(10) }, REF, { aujourdhui: AUJOURDHUI });
const fiche = (satisfaction) => ficheResultats({ promo: PROMO, ind: IND, aujourdhui: AUJOURDHUI, satisfaction });
const ligneSat = (satisfaction) => fiche(satisfaction).lignes.find((l) => l.cle === "satisfaction");

test("fiche résultats : la satisfaction mesurée porte son taux, ses répondants, ses inscrits et sa méthode publique", () => {
  const l = ligneSat({ taux: 80, repondants: 8, inscrits: 10 });
  assert.match(l.valeur, /^80\s%$/);
  assert.equal(l.effectif, 8);
  assert.equal(l.effectifTexte, "8 répondants sur 10 inscrits");
  assert.equal(l.methode, METHODES_PUBLIQUES.satisfaction);
  assert.deepEqual(ligneSat({ etat: "mesuree", taux: 80, repondants: 8, inscrits: 10 }), l);
  const f = fiche({ taux: 80, repondants: 8, inscrits: 10 });
  assert.match(ficheResultatsTexte(f), /Satisfaction des stagiaires : 80\s%\nEffectif : 8 répondants sur 10 inscrits\. Période : /);
  assert.ok(tableauFiche(f).lignes.some((r) => r[0] === "Satisfaction des stagiaires" && r[2] === "8 répondants sur 10 inscrits"));
});

test("fiche résultats : sous le seuil, « moins de 5 réponses » et aucun chiffre ; migration absente, « non mesurée »", () => {
  const sous = ligneSat({ etat: "sous_seuil" });
  assert.equal(sous.valeur, "moins de 5 réponses");
  assert.equal(sous.effectif, "sans objet");
  assert.equal(ligneSat({ etat: "absente" }).valeur, "non mesurée");
  assert.equal(ligneSat(null).valeur, "non mesurée");
  const nonLue = ligneSat({ etat: "non_lue" });
  assert.equal(nonLue.valeur, "non lue (erreur de lecture)");
  assert.equal(nonLue.effectif, "sans objet");
  assert.ok(!/non mesurée/.test(ficheResultatsTexte(fiche({ etat: "non_lue" }))), "jamais « non mesurée » pour une lecture en échec");
  const texte = ficheResultatsTexte(fiche({ etat: "sous_seuil" }));
  assert.match(texte, /Satisfaction des stagiaires : moins de 5 réponses/);
  assert.ok(!/Satisfaction des stagiaires : \d/.test(texte));
});

test("fiche résultats : l'ancienne forme { taux de 0 à 1, effectif } reste lue", () => {
  const l = ligneSat({ taux: 0.9, effectif: 8 });
  assert.match(l.valeur, /^90\s%$/);
  assert.equal(l.effectif, 8);
  assert.equal(l.effectifTexte, undefined);
});

// --- Dossier de la formation ---

const modeleFormation = (satisfaction, n = 10) => {
  const donnees = donneesAvec(satisfaction, n);
  return modeleDossierFormation({
    inv: inventairePromo(donnees, REF, { promo: PROMO, aujourdhui: AUJOURDHUI }), donnees,
    ind: indicateursPromo(donnees, REF, { aujourdhui: AUJOURDHUI }), promo: PROMO, lieu: "Nîmes", intitule: "TP ECSR", aujourdhui: AUJOURDHUI,
  });
};
const sectionApp = (m) => m.sections.find((s) => s.id === "appreciations");

test("dossier de la formation : section « Appréciations » remplie au-dessus du seuil, avec la méthode", () => {
  const s = sectionApp(modeleFormation({ etat: "mesuree", taux: 80, repondants: 8, inscrits: 10 }));
  const texte = s.paragraphes.join("\n");
  assert.match(texte, /Appréciations : questionnaire de fin de formation, 80\s% de réponses favorables \(8 répondants sur 10 inscrits\)\./);
  assert.ok(texte.includes(METHODES_PUBLIQUES.satisfaction));
  assert.match(texte, /avis des financeurs et des entreprises/i);
  assert.deepEqual(s.indicateurs, [30]);
});

test("dossier de la formation : sous le seuil, la phrase fixe sans chiffre ; migration absente, une phrase calme", () => {
  const sous = sectionApp(modeleFormation({ etat: "sous_seuil" })).paragraphes.join("\n");
  assert.match(sous, /moins de 5 réponses au questionnaire de fin de formation/);
  assert.ok(!sous.includes(METHODES_PUBLIQUES.satisfaction), "pas de méthode d'un calcul qui n'a pas eu lieu");
  const absente = sectionApp(modeleFormation({ etat: "absente" })).paragraphes.join("\n");
  assert.match(absente, /questionnaire de fin de formation pas encore en service/);
  assert.ok(!/undefined|null|NaN/.test(absente));
  const nonLue = sectionApp(modeleFormation({ etat: "non_lue" })).paragraphes.join(" ");
  assert.ok(nonLue.includes(`Appréciations : ${RAISON_NON_LUE}.`));
  assert.ok(!/pas encore en service/.test(nonLue) && !nonLue.includes(METHODES_PUBLIQUES.satisfaction));
});

// --- Dossier du centre ---

const promoCentre = (id, nom, satisfaction, n = 10) => {
  const promo = { ...PROMO, id, nom };
  const donnees = donneesAvec(satisfaction, n);
  return { promo, donnees, inv: inventairePromo(donnees, REF, { promo, aujourdhui: AUJOURDHUI }), ind: indicateursPromo(donnees, REF, { aujourdhui: AUJOURDHUI }) };
};
const modeleCentre = (sansNoms) => modeleDossierCentre({
  promos: [
    promoCentre(7, "Promo A", { etat: "mesuree", taux: 80, repondants: 8, inscrits: 10 }),
    promoCentre(8, "Promo B", { etat: "sous_seuil" }),
    promoCentre(9, "Promo C", { etat: "absente" }),
    promoCentre(10, "Promo D", { etat: "non_lue" }),
  ],
  lieu: "Nîmes", periode: { du: "2026-01-01", au: "2026-12-31" }, aujourdhui: AUJOURDHUI, sansNoms,
});
const tableSat = (m) => m.sections.find((s) => s.id === "resultats").tableaux.find((t) => t.entetes[1] === "Satisfaction des stagiaires");

test("dossier du centre : un taux par promo, jamais de total, la raison sous le seuil", () => {
  for (const sansNoms of [false, true]) {
    const t = tableSat(modeleCentre(sansNoms));
    assert.ok(t, "tableau de la satisfaction");
    assert.equal(t.lignes.length, 4);
    assert.match(t.lignes[0][1], /^questionnaire de fin de formation, 80\s% de réponses favorables \(8 répondants sur 10 inscrits\)$/);
    assert.equal(t.lignes[1][1], "moins de 5 réponses au questionnaire de fin de formation");
    assert.equal(t.lignes[2][1], "questionnaire de fin de formation pas encore en service");
    assert.equal(t.lignes[3][1], RAISON_NON_LUE);
    assert.deepEqual(t.lignes.map((l) => l[0]), ["Promo A", "Promo B", "Promo C", "Promo D"]);
  }
});

test("dossier du centre : la méthode publique de la satisfaction est dite dans la section des résultats", () => {
  const m = modeleCentre(false).sections.find((s) => s.id === "resultats");
  assert.ok(m.paragraphes.some((p) => p.includes(METHODES_PUBLIQUES.satisfaction)));
});

test("version « Sans aucun nom » : la satisfaction n'y met que des nombres, aucun nom, aucun commentaire", () => {
  const sans = modeleCentre(true);
  assert.ok(!/Prénom|Nom\d/.test(JSON.stringify(sans)), "aucun nom de stagiaire");
  assert.ok(!/commentaire/i.test(JSON.stringify(tableSat(sans))));
});

test("aucun modèle ne lit les commentaires, aucun tiret cadratin, texte impersonnel", () => {
  const sources = ["js/qualiopi-preuves.js", "js/qualiopi-documents.js", "js/qualiopi-resultats.js"]
    .map((c) => readFileSync(new URL("../" + c, import.meta.url), "utf8").replace(/\/\/.*$/gm, ""));
  for (const code of sources) {
    assert.ok(!/lireCommentairesQuestionnaire|commentaires_questionnaire/.test(code), "les commentaires ne sont jamais lus par les modèles");
  }
  const vue = readFileSync(new URL("../js/views/qualiopi.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const debut = vue.indexOf("async function lireSatisfaction");
  assert.ok(debut > 0, "la page lit la satisfaction à part");
  const lecture = vue.slice(debut, debut + 900);
  assert.ok(lecture.includes("lireResultatsQuestionnaire(\"fin_stagiaire\""), "résultats du questionnaire de fin de formation");
  assert.ok(!/lireCommentairesQuestionnaire/.test(lecture), "sans les commentaires");
  const formation = JSON.stringify(sectionApp(modeleFormation({ etat: "mesuree", taux: 80, repondants: 8, inscrits: 10 })));
  const tout = formation + JSON.stringify([modeleCentre(false), modeleCentre(true)]) + ficheResultatsTexte(fiche({ taux: 80, repondants: 8, inscrits: 10 }));
  assert.ok(!tout.includes(TIRET_CADRATIN));
  assert.ok(!/\b(tu|ton|ta|tes|vous|votre)\b/i.test(formation), "document impersonnel");
});

// --- Page : une lecture en échec n'est jamais gardée, et « réessayer » relit ---

const vueCode = () => readFileSync(new URL("../js/views/qualiopi.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("page : l'échec de lecture donne un résultat « échec », la lecture mémorisée l'oublie, un bouton relit", () => {
  const code = vueCode();
  const lecture = code.slice(code.indexOf("async function lireSatisfaction"), code.indexOf("const lire = "));
  assert.match(lecture, /catch \{\s*return LECTURE_ECHOUEE;/, "toute erreur de lecture est un échec, pas une absence");
  const lire = code.slice(code.indexOf("const lire = "), code.indexOf("const lire = ") + 900);
  assert.match(lire, /Promise\.all\(\[lireDonneesQualiopi\(id\), lireSatisfaction\(id\)\]\)/, "les deux lectures partent ensemble");
  assert.match(lire, /etat === "non_lue"\) lectures\.delete\(id\)/, "une satisfaction non lue n'est pas gardée en mémoire");
  assert.match(code, /function noteSatisfaction\(\)/);
  assert.match(code, /Relire la satisfaction/, "bouton visible à l'écran");
  assert.match(code, /lectures\.delete\(etat\.promo\.id\);\s*charger\(etat\.promo\)/, "le bouton relit la promo");
});
