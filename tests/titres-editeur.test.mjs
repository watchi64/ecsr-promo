// Titres, étape 3, tâche 31 : page Équipe de la direction et fenêtre « Ajuster un titre ».
// Lancer : node --test tests/titres-editeur.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ElementFactice, NoeudFactice, NoeudTexte, descendants, installerDocument } from "./aides-dom.mjs";
import {
  gestesSurPersonne, gestesSurTitre, ceQuiEstMasque, casesEnChaines, casesEnNombres,
  BANDEAU_EQUIPE, BANDEAU_COURS, PHRASE_STAGIAIRES_RELEVE, phraseVersionCentre, phrasePorteurs,
} from "../js/titres-rules.js";
import { construireEditeur } from "../js/views/titres-editeur.js";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ----- gestesSurPersonne ---------------------------------------------------------------------------------------------------------

const casesSecretariat = { promos: 0, stagiaires: 2, emargement: 1, notes: 0, equipe: 1, reglages: 0 };   // Équipe : Voir
const casesResponsable = { promos: 2, stagiaires: 2, emargement: 1, notes: 1, equipe: 2, reglages: 0 };    // Équipe : Modifier
const intervenant = { email: "intervenant@exemple.invalid", niveau: "promo", fixe: false, nom: "Intervenant" };
const formatrice = { email: "formatrice@exemple.invalid", niveau: "promo", fixe: true, nom: "Formateur" };
const secretaire = { email: "secretaire@exemple.invalid", niveau: "centre", fixe: false, nom: "Secrétariat" };
const direction = { email: "direction@exemple.invalid", niveau: "centre", fixe: true, nom: "Direction de centre" };
const moi = "moi@exemple.invalid";

test("gestesSurPersonne : un Secrétariat (Équipe sur Voir) n'a aucun geste", () => {
  for (const personne of [intervenant, formatrice, secretaire, direction]) {
    assert.deepEqual(gestesSurPersonne({ cases: casesSecretariat, directionFixe: false, personne, moi }), { changer: false, retirer: false }, personne.nom);
  }
});

test("gestesSurPersonne : Équipe sur Modifier change et retire un Intervenant, jamais une Formatrice", () => {
  assert.deepEqual(gestesSurPersonne({ cases: casesResponsable, directionFixe: false, personne: intervenant, moi }), { changer: true, retirer: true });
  assert.deepEqual(gestesSurPersonne({ cases: casesResponsable, directionFixe: false, personne: secretaire, moi }), { changer: true, retirer: true });
  assert.deepEqual(gestesSurPersonne({ cases: casesResponsable, directionFixe: false, personne: formatrice, moi }), { changer: false, retirer: false });
});

test("gestesSurPersonne : la direction fixe agit sur une Formatrice, jamais sur la Direction de centre", () => {
  const cases = { promos: 2, stagiaires: 2, emargement: 1, notes: 1, equipe: 2, reglages: 2 };
  assert.deepEqual(gestesSurPersonne({ cases, directionFixe: true, personne: formatrice, moi }), { changer: true, retirer: true });
  assert.deepEqual(gestesSurPersonne({ cases, directionFixe: true, personne: direction, moi }), { changer: false, retirer: false });
  assert.deepEqual(gestesSurPersonne({ cases: casesResponsable, directionFixe: false, personne: direction, moi }), { changer: false, retirer: false });
});

test("gestesSurPersonne : jamais sur soi, sauf la direction fixe sur son propre titre Formateur", () => {
  const cases = { equipe: 2 };
  const moiIntervenant = { ...intervenant, email: "MOI@exemple.invalid" };
  assert.deepEqual(gestesSurPersonne({ cases, directionFixe: false, personne: moiIntervenant, moi }), { changer: false, retirer: false });
  assert.deepEqual(gestesSurPersonne({ cases, directionFixe: true, personne: moiIntervenant, moi }), { changer: false, retirer: false });
  const moiFormatrice = { ...formatrice, email: moi };
  assert.equal(gestesSurPersonne({ cases, directionFixe: true, personne: moiFormatrice, moi }).retirer, true);
  assert.equal(gestesSurPersonne({ cases, directionFixe: false, personne: moiFormatrice, moi }).retirer, false);
  assert.deepEqual(gestesSurPersonne({ cases, directionFixe: true, personne: { ...direction, email: moi }, moi }), { changer: false, retirer: false });
});

test("gestesSurPersonne : cases non lues (plafond), un titre non fixe garde ses gestes, un titre fixe attend la direction fixe", () => {
  assert.equal(gestesSurPersonne({ cases: null, directionFixe: false, personne: intervenant, moi }).retirer, true);
  assert.equal(gestesSurPersonne({ cases: null, directionFixe: false, personne: formatrice, moi }).retirer, false);
  assert.deepEqual(gestesSurPersonne({}), { changer: false, retirer: false });
});

// ----- gestesSurTitre : « Supprimer » ----------------------------------------------------------------------------------------------

test("gestesSurTitre : « Supprimer » absent d'un titre du catalogue vu depuis un centre", () => {
  const duReseau = { id: 5, nom: "Intervenant", niveau: "promo", lieu_id: null, fixe: false, porteurs: 0 };
  assert.deepEqual(gestesSurTitre({ titre: duReseau, lieuId: 1, ajustable: true, peutGerer: true }), { ajuster: true, creer: true, supprimer: false });
  const duCentre = { id: 9, nom: "Remplaçant", niveau: "promo", lieu_id: 1, fixe: false, porteurs: 0 };
  assert.equal(gestesSurTitre({ titre: duCentre, lieuId: 1, ajustable: true, peutGerer: true }).supprimer, true);
  assert.equal(gestesSurTitre({ titre: { ...duCentre, porteurs: 2 }, lieuId: 1, ajustable: true, peutGerer: true }).supprimer, false, "porté");
  assert.equal(gestesSurTitre({ titre: duCentre, lieuId: 1, ajustable: false, peutGerer: true }).supprimer, false, "non ajustable");
  assert.equal(gestesSurTitre({ titre: { ...duCentre, lieu_id: 2 }, lieuId: 1, ajustable: true, peutGerer: true }).supprimer, false, "autre centre");
  const fixe = { id: 1, nom: "Formateur", niveau: "promo", lieu_id: null, fixe: true, porteurs: 0 };
  assert.deepEqual(gestesSurTitre({ titre: fixe, lieuId: 1, ajustable: true, peutGerer: true }), { ajuster: false, creer: true, supprimer: false });
  assert.deepEqual(gestesSurTitre({ titre: duCentre, lieuId: 1, ajustable: true, peutGerer: false }), { ajuster: true, creer: false, supprimer: true });
});

test("la page n'offre « Supprimer » que par gestesSurTitre", () => {
  const page = lire("js/views/direction-equipe.js");
  assert.ok(/droits\.supprimer/.test(page));
  assert.ok(!/regler_affectations_formateur|reglerAffectationsFormateur/.test(page.replace(/\/\/[^\n]*/g, "")), "plus d'appel à regler_affectations_formateur");
});

test("lireJournalPresent rend faux sur une erreur ou une fonction absente, et le journal reste appelé sans paramètre", () => {
  const db = lire("js/db.js");
  const m = /export async function lireJournalPresent\(\) \{([\s\S]*?)\n\}/.exec(db);
  assert.ok(m, "fonction trouvée");
  assert.ok(/supabase\.rpc\("journal_present"\)/.test(m[1]));
  assert.ok(/if \(error\) return false;/.test(m[1]) && /catch \(e\) \{\s*return false;/.test(m[1]));
  assert.ok(!/throw/.test(m[1]));
});

// ----- Les règles qui nourrissent l'éditeur ------------------------------------------------------------------------------------------

test("ceQuiEstMasque, casesEnChaines et casesEnNombres", () => {
  const titre = { niveau: "centre", cases: { promos: "non", stagiaires: "modifier", emargement: "voir", notes: "non", equipe: "voir", reglages: "non" } };
  assert.deepEqual(ceQuiEstMasque(titre), ["Promos", "Notes et examens", "Réglages du centre"]);
  assert.deepEqual(casesEnChaines("centre", { notes: "modifier", emargement: "modifier" }).notes, "voir", "plafond de la page");
  assert.deepEqual(casesEnNombres("centre", titre.cases), { promos: 0, stagiaires: 2, emargement: 1, notes: 0, equipe: 1, reglages: 0 });
});

// ----- La fenêtre « Ajuster un titre » -----------------------------------------------------------------------------------------------

function avecDom(corps) {
  const dom = installerDocument();
  const avant = Object.getOwnPropertyDescriptor(globalThis, "Node");
  Object.defineProperty(globalThis, "Node", { value: NoeudFactice, configurable: true, writable: true });
  try { return corps(dom); } finally {
    if (avant) Object.defineProperty(globalThis, "Node", avant); else delete globalThis.Node;
    dom.restaurer();
  }
}
const elements = (racine) => descendants(racine).filter((x) => x instanceof ElementFactice);
const texteDe = (racine) => elements(racine).map((x) => x.childNodes.filter((n) => n instanceof NoeudTexte).map((n) => n.nodeValue).join("")).join(" ");
function radio(editeur, page, valeur) {
  const r = elements(tout(editeur)).find((x) => x.nodeName === "input" && x.getAttribute("type") === "radio"
    && x.getAttribute("name").endsWith("-" + page) && x.getAttribute("value") === valeur);
  assert.ok(r, `radio ${page}/${valeur}`);
  return r;
}
const choisir = (editeur, page, valeur) => { const r = radio(editeur, page, valeur); r.checked = true; r.declencher("change"); };
const tout = (editeur) => ({ childNodes: editeur.corps.filter(Boolean), parentNode: null });
const textes = (editeur) => descendants(tout(editeur)).filter((x) => x instanceof NoeudTexte).map((x) => x.nodeValue);

const titreCentre = {
  id: 7, nom: "Secrétariat", niveau: "centre", lieu_id: 1, fixe: false,
  cases: { promos: "non", stagiaires: "modifier", emargement: "voir", notes: "non", equipe: "non", reglages: "non" },
};
const titrePromo = {
  id: 5, nom: "Intervenant", niveau: "promo", lieu_id: null, fixe: false,
  cases: { planning: "voir", emargement: "modifier", stagiaires: "non", notes: "non", cours: "voir", ccp2: "non", indicateurs: "non", reglages: "non" },
};

test("éditeur : une ligne par page du niveau, avec ses choix (Réglages : Non et Modifier ; CCP2 : pas de Modifier)", () => avecDom(() => {
  const e = construireEditeur({ titre: titrePromo, niveau: "promo", lieuId: 1, porteurs: 0 });
  const groupes = elements(tout(e)).filter((x) => x.nodeName === "fieldset");
  assert.equal(groupes.length, 8);
  const valeursDe = (page) => elements(tout(e)).filter((x) => x.nodeName === "input" && x.getAttribute("type") === "radio" && x.getAttribute("name").endsWith("-" + page)).map((x) => x.getAttribute("value"));
  assert.deepEqual(valeursDe("reglages"), ["non", "modifier"]);
  assert.deepEqual(valeursDe("ccp2"), ["non", "voir"]);
  assert.deepEqual(valeursDe("planning"), ["non", "voir", "modifier"]);
  assert.equal(radio(e, "emargement", "modifier").checked, true);
  assert.equal(radio(e, "emargement", "non").checked, false);
}));

test("éditeur : relever Notes à Voir coche Stagiaires Voir et montre la phrase", () => avecDom(() => {
  const e = construireEditeur({ titre: titrePromo, niveau: "promo", lieuId: 1, porteurs: 0 });
  assert.equal(radio(e, "stagiaires", "non").checked, true);
  assert.ok(!textes(e).includes(PHRASE_STAGIAIRES_RELEVE));
  choisir(e, "notes", "voir");
  assert.equal(radio(e, "stagiaires", "voir").checked, true);
  assert.equal(radio(e, "stagiaires", "non").checked, false);
  assert.ok(textes(e).includes(PHRASE_STAGIAIRES_RELEVE));
  assert.equal(e.valeurs().cases.stagiaires, "voir");
  assert.equal(e.valeurs().cases.notes, "voir");
}));

test("éditeur : Stagiaires ne redescend pas à Non tant qu'une page montre des noms", () => avecDom(() => {
  const e = construireEditeur({ titre: titrePromo, niveau: "promo", lieuId: 1, porteurs: 0 });
  choisir(e, "stagiaires", "non");
  assert.equal(radio(e, "stagiaires", "voir").checked, true, "planning ou émargement montrent des noms");
  assert.ok(textes(e).includes(PHRASE_STAGIAIRES_RELEVE));
}));

test("éditeur : Équipe sur Modifier montre le bandeau, sur Voir il disparaît", () => avecDom(() => {
  const e = construireEditeur({ titre: titreCentre, niveau: "centre", lieuId: 1, porteurs: 0 });
  assert.ok(!textes(e).includes(BANDEAU_EQUIPE));
  choisir(e, "equipe", "modifier");
  assert.ok(textes(e).includes(BANDEAU_EQUIPE));
  choisir(e, "equipe", "voir");
  assert.ok(!textes(e).includes(BANDEAU_EQUIPE));
}));

test("éditeur : Cours et QCM sur Modifier montre le bandeau des contenus communs (titre du réseau)", () => avecDom(() => {
  const titreReseau = { id: 3, nom: "Rédaction", niveau: "reseau", lieu_id: null, fixe: false, cases: { cours: "non", directions: "non", reglages: "non" } };
  const e = construireEditeur({ titre: titreReseau, niveau: "reseau", lieuId: null, porteurs: 2 });
  choisir(e, "cours", "modifier");
  assert.ok(textes(e).includes(BANDEAU_COURS));
  assert.equal(e.confirmation(), null, "pas une version de centre");
  assert.ok(textes(e).includes(phrasePorteurs(2)));
}));

test("éditeur : « Sa barre » suit les cases en direct", () => avecDom(() => {
  const e = construireEditeur({ titre: titreCentre, niveau: "centre", lieuId: 1, porteurs: 0 });
  const barre = () => elements(tout(e)).filter((x) => x.classes.has("equipe-barre-liste"))[0].childNodes.map((li) => li.textContent);
  assert.ok(barre().includes("Stagiaires") && !barre().includes("Notes et examens") && !barre().includes("Équipe"));
  choisir(e, "equipe", "voir");
  assert.ok(barre().includes("Équipe"));
  choisir(e, "notes", "voir");
  assert.ok(barre().includes("Notes et examens"));
}));

test("éditeur : un titre du réseau ajusté depuis un centre demande la confirmation de la version", () => avecDom(() => {
  const e = construireEditeur({ titre: titrePromo, niveau: "promo", lieuId: 1, porteurs: 1 });
  assert.equal(e.versionDuReseau, true);
  assert.equal(e.confirmation(), phraseVersionCentre(1));
  assert.ok(textes(e).includes(phraseVersionCentre(1)));
  const zero = construireEditeur({ titre: titrePromo, niveau: "promo", lieuId: 1, porteurs: 0 });
  assert.equal(zero.confirmation(), phraseVersionCentre(0), "personne : la première phrase seule");
  const duCentre = construireEditeur({ titre: { ...titrePromo, lieu_id: 1 }, niveau: "promo", lieuId: 1, porteurs: 2 });
  assert.equal(duCentre.confirmation(), null);
  assert.ok(textes(duCentre).includes(phrasePorteurs(2)));
}));

test("éditeur : « Enregistrer » envoie exactement les cases affichées, le nom exigé", () => avecDom(() => {
  const e = construireEditeur({ titre: titrePromo, niveau: "promo", lieuId: 1, porteurs: 0 });
  choisir(e, "notes", "modifier");
  choisir(e, "cours", "non");
  const v = e.valeurs();
  assert.equal(v.nom, "Intervenant");
  const affichees = {};
  for (const r of elements(tout(e)).filter((x) => x.nodeName === "input" && x.getAttribute("type") === "radio" && x.checked)) {
    affichees[r.getAttribute("name").replace(/^titre-case-\d+-/, "")] = r.getAttribute("value");
  }
  assert.deepEqual(v.cases, affichees);
  assert.deepEqual(Object.keys(v.cases), ["planning", "emargement", "stagiaires", "notes", "cours", "ccp2", "indicateurs", "reglages"]);
  assert.equal(v.cases.stagiaires, "voir");
  const champ = e.premierChamp();
  champ.value = "   ";
  assert.equal(typeof e.valeurs(), "string");
}));

test("l'éditeur n'ouvre aucune boîte du navigateur et aucun tiret cadratin n'est écrit", () => {
  for (const chemin of ["js/views/titres-editeur.js", "js/views/direction-equipe.js", "js/titres-rules.js"]) {
    const texte = lire(chemin);
    assert.ok(!texte.includes(String.fromCharCode(0x2014)), chemin + " : tiret cadratin");
    assert.ok(!/(?<![.\w])(confirm|prompt|alert)\(/.test(texte.replace(/\/\/[^\n]*/g, "")), chemin + " : boîte native");
  }
});
