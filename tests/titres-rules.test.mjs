// Règles pures des titres (étape 3) : cases, barre, bandeaux, phrases.
// Lancer : node --test tests/titres-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAGES_DU_NIVEAU, NIVEAU_DE_L_ESPACE, ROUTES_A_CASE, casesDeLEspace, caseDe, choixDeLaPage, releverStagiaires,
  PHRASE_STAGIAIRES_RELEVE, bandeaux, BANDEAU_EQUIPE, BANDEAU_COURS, BANDEAU_DIRECTIONS, phrasePorteurs, phraseVersionCentre,
  ceQueJePeuxFaire, libelleTitre, pastillesDePersonne, titresDonnablesGroupes, phraseJournal, formateurFixeSur, titresPourApercu,
  fusionnerListesApercu, listesPourLeCentre, listesApercuIncompletes,
} from "../js/titres-rules.js";

const formateurFixe = { titre_id: 1, nom: "Formateur", niveau: "promo", lieu_id: 1, lieu_nom: "Centre de Nîmes", promo_ids: [1, 2], cases: {} };
const maxPromo = { planning: "modifier", emargement: "modifier", stagiaires: "modifier", notes: "modifier", cours: "modifier", ccp2: "voir", indicateurs: "voir", reglages: "modifier" };
const intervenant = {
  titre_id: 5, nom: "Intervenant", niveau: "promo", lieu_id: 1, promo_ids: [1],
  cases: { planning: "voir", emargement: "modifier", stagiaires: "voir", notes: "non", cours: "voir", ccp2: "non", indicateurs: "non", reglages: "non" },
};

test("les pages et plafonds concordent avec _pages_du_niveau du SQL", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261112_titres_1_tables.sql", import.meta.url), "utf8");
  const debut = sql.indexOf("create or replace function public._pages_du_niveau");
  const bloc = sql.slice(debut, sql.indexOf("$f$;", debut + 80));
  const lignes = [...bloc.matchAll(/\('(promo|centre|reseau)', '([a-z0-9]+)', (\d)\)/g)].map((m) => [m[1], m[2], Number(m[3])]);
  const attendu = [];
  for (const [niveau, pages] of Object.entries(PAGES_DU_NIVEAU)) for (const p of pages) attendu.push([niveau, p.page, p.plafond]);
  assert.ok(lignes.length > 0);
  assert.deepEqual(attendu, lignes);
});

test("espaces, routes à case", () => {
  assert.deepEqual(NIVEAU_DE_L_ESPACE, { equipe: "promo", direction: "centre", siege: "reseau" });
  for (const r of ["planning", "themes", "centre", "config", "promos", "equipe", "directions"]) assert.ok(ROUTES_A_CASE.has(r), r);
  for (const r of ["home", "messages", "contacts"]) assert.ok(!ROUTES_A_CASE.has(r), r);
});

test("un Formateur fixe a le plafond partout", () => {
  const c = casesDeLEspace({ espace: "equipe", titres: [{ ...formateurFixe, cases: maxPromo }], promoId: 1, lieuId: 1 });
  assert.deepEqual(c, { planning: 2, emargement: 2, stagiaires: 2, notes: 2, cours: 2, ccp2: 1, indicateurs: 1, reglages: 2 });
});

test("un Intervenant : ses cases sur sa promo, rien ailleurs", () => {
  const t = [intervenant];
  assert.deepEqual(casesDeLEspace({ espace: "equipe", titres: t, promoId: 1, lieuId: 1 }),
    { planning: 1, emargement: 2, stagiaires: 1, notes: 0, cours: 1, ccp2: 0, indicateurs: 0, reglages: 0 });
  assert.deepEqual(casesDeLEspace({ espace: "equipe", titres: t, promoId: 2, lieuId: 1 }),
    { planning: 0, emargement: 0, stagiaires: 0, notes: 0, cours: 0, ccp2: 0, indicateurs: 0, reglages: 0 });
});

test("les valeurs sont bornées par le plafond", () => {
  const t = [{ ...intervenant, cases: { ccp2: "modifier", planning: "modifier" } }];
  const c = casesDeLEspace({ espace: "equipe", titres: t, promoId: 1, lieuId: 1 });
  assert.equal(c.ccp2, 1);
  assert.equal(c.planning, 2);
});

test("cas nuls : titres nuls, fondateur, stagiaire", () => {
  assert.equal(casesDeLEspace({ espace: "equipe", titres: null, promoId: 1, lieuId: 1 }), null);
  assert.equal(casesDeLEspace({ espace: "equipe", titres: [], promoId: 1, lieuId: 1, fondateur: true }), null);
  assert.equal(casesDeLEspace({ espace: "stagiaire", titres: [intervenant], promoId: 1, lieuId: 1 }), null);
  assert.deepEqual(casesDeLEspace({ espace: "direction", titres: [], promoId: 1, lieuId: 1 }),
    { promos: 0, stagiaires: 0, emargement: 0, notes: 0, equipe: 0, reglages: 0 });
});

test("centre et réseau : le titre du bon lieu, du bon niveau", () => {
  const secretariat = { titre_id: 7, nom: "Secrétariat", niveau: "centre", lieu_id: 3, cases: { promos: "voir", emargement: "modifier", stagiaires: "voir" } };
  assert.deepEqual(casesDeLEspace({ espace: "direction", titres: [secretariat], promoId: null, lieuId: 3 }),
    { promos: 1, stagiaires: 1, emargement: 1, notes: 0, equipe: 0, reglages: 0 });
  assert.equal(casesDeLEspace({ espace: "direction", titres: [secretariat], lieuId: 4 }).promos, 0);
  const siege = { titre_id: 9, nom: "Siège", niveau: "reseau", lieu_id: null, cases: { cours: "modifier", directions: "voir", reglages: "modifier" } };
  assert.deepEqual(casesDeLEspace({ espace: "siege", titres: [siege] }), { cours: 2, directions: 1, reglages: 2 });
});

test("caseDe", () => {
  assert.equal(caseDe(null, "ccp2", "promo"), 1);
  assert.equal(caseDe(null, "notes", "promo"), 2);
  assert.equal(caseDe({ notes: 1 }, "notes", "promo"), 1);
  assert.equal(caseDe({ notes: 1 }, "planning", "promo"), 0);
});

test("choixDeLaPage", () => {
  assert.deepEqual(choixDeLaPage("promo", "planning"), ["non", "voir", "modifier"]);
  assert.deepEqual(choixDeLaPage("centre", "emargement"), ["non", "voir"]);
  assert.deepEqual(choixDeLaPage("promo", "reglages"), ["non", "modifier"]);
  assert.deepEqual(choixDeLaPage("reseau", "reglages"), ["non", "modifier"]);
});

test("releverStagiaires", () => {
  const r = releverStagiaires("promo", { notes: "voir" });
  assert.equal(r.releve, true);
  assert.equal(r.cases.stagiaires, "voir");
  assert.equal(r.cases.notes, "voir");
  assert.equal(releverStagiaires("promo", { notes: "voir", stagiaires: "modifier" }).releve, false);
  assert.equal(releverStagiaires("promo", { notes: "voir", stagiaires: "modifier" }).cases.stagiaires, "modifier");
  assert.equal(releverStagiaires("promo", { cours: "voir" }).releve, false);
  assert.equal(releverStagiaires("centre", { emargement: "voir" }).releve, true);
  assert.equal(releverStagiaires("reseau", { cours: "voir" }).releve, false);
  assert.equal(PHRASE_STAGIAIRES_RELEVE, "Stagiaires passe à « Voir » : cette page montre des noms de stagiaires.");
});

test("bandeaux, mot pour mot", () => {
  assert.equal(BANDEAU_EQUIPE, "Équipe sur « Modifier » : la personne pourra inviter et donner des titres de promo, donc confier à d'autres ce qu'elle ne fait pas elle-même. Chaque nomination reste dans le journal.");
  assert.equal(BANDEAU_COURS, "Cours et QCM sur « Modifier » : les cours et les questions sont communs à tout le réseau ; une modification vaut pour tous les centres.");
  assert.equal(BANDEAU_DIRECTIONS, "Directions de centre sur « Modifier » : la personne pourra donner des titres de centre dans tous les centres, qui voient des noms de stagiaires qu'elle ne voit pas. Chaque nomination reste dans le journal.");
  assert.deepEqual(bandeaux("centre", { equipe: "modifier" }), [BANDEAU_EQUIPE]);
  assert.deepEqual(bandeaux("centre", { equipe: "voir" }), []);
  assert.deepEqual(bandeaux("reseau", { cours: "modifier", directions: "modifier" }), [BANDEAU_COURS, BANDEAU_DIRECTIONS]);
  assert.deepEqual(bandeaux("promo", { equipe: "modifier" }), []);
});

test("phrasePorteurs et phraseVersionCentre", () => {
  assert.equal(phrasePorteurs(0), null);
  assert.equal(phrasePorteurs(1), "1 personne a ce titre : ses droits changeront dès l'enregistrement.");
  assert.equal(phrasePorteurs(3), "3 personnes ont ce titre : leurs droits changeront dès l'enregistrement.");
  assert.equal(phraseVersionCentre(1), "Ce titre vient du réseau : l'ajuster crée la version de votre centre. 1 personne passera à la version du centre.");
  assert.equal(phraseVersionCentre(2), "Ce titre vient du réseau : l'ajuster crée la version de votre centre. 2 personnes passeront à la version du centre.");
  // Personne dans le centre : la première phrase seule (jamais « 0 personnes passeront »).
  assert.equal(phraseVersionCentre(0), "Ce titre vient du réseau : l'ajuster crée la version de votre centre.");
  assert.equal(phraseVersionCentre(null), "Ce titre vient du réseau : l'ajuster crée la version de votre centre.");
});

test("ceQueJePeuxFaire", () => {
  assert.deepEqual(ceQueJePeuxFaire(intervenant), [
    { libelle: "Planning", valeur: "Voir" }, { libelle: "Émargement", valeur: "Modifier" },
    { libelle: "Stagiaires", valeur: "Voir" }, { libelle: "Cours et QCM", valeur: "Voir" },
  ]);
  assert.deepEqual(ceQueJePeuxFaire({ niveau: "promo", cases: {} }), []);
});

test("libelleTitre", () => {
  assert.equal(libelleTitre({ nom: "Secrétariat", niveau: "centre", lieu_id: 1 }, { lieuNom: "Centre de Nîmes" }), "Secrétariat · Centre de Nîmes");
  assert.equal(libelleTitre({ nom: "Formateur", niveau: "promo", promo_ids: [1, 2] }, { lieuNom: "Centre de Nîmes" }), "Formateur · 2 promos");
  assert.equal(libelleTitre({ nom: "Formateur", niveau: "promo", promo_ids: [4] }, { promoNoms: { 4: "Promo mars 2026" } }), "Formateur · Promo mars 2026");
  assert.equal(libelleTitre({ nom: "Siège", niveau: "reseau" }, {}), "Siège");
});

test("pastillesDePersonne : centre d'abord", () => {
  const lignes = [
    { email: "alex@exemple.invalid", titre_nom: "Formateur", niveau: "promo", promo_ids: [1, 2] },
    { email: "alex@exemple.invalid", titre_nom: "Secrétariat", niveau: "centre", promo_ids: null },
    { email: "camille@exemple.invalid", titre_nom: "Siège", niveau: "reseau" },
  ];
  assert.deepEqual(pastillesDePersonne(lignes, "Alex@exemple.invalid"), ["Secrétariat", "Formateur · 2 promos"]);
  assert.deepEqual(pastillesDePersonne(lignes, "inconnu@exemple.invalid"), []);
});

test("titresDonnablesGroupes", () => {
  const t = (id, niveau, donnable = true) => ({ id, nom: "T" + id, niveau, donnable });
  assert.deepEqual(titresDonnablesGroupes([t(1, "promo"), t(2, "centre"), t(3, "promo", false)]).map((g) => [g.groupe, g.titres.map((x) => x.id)]),
    [["Pour tout le centre", [2]], ["Pour certaines promos", [1]]]);
  assert.deepEqual(titresDonnablesGroupes([t(1, "reseau"), t(2, "centre"), t(3, "promo")]).map((g) => g.groupe),
    ["Pour tout le réseau", "Pour tout le centre", "Pour certaines promos"]);
  assert.deepEqual(titresDonnablesGroupes([t(1, "promo", false)]), []);
  assert.deepEqual(titresDonnablesGroupes(null), []);
});

test("phraseJournal : chaque action et le système", () => {
  const nomDe = (e) => ({ "camille@exemple.invalid": "Camille R." })[e] ?? e;
  const q = "2026-11-09T10:00:00Z";
  const base = { quand: q, par: "camille@exemple.invalid", pour: "alex@exemple.invalid", titre_nom: "Secrétariat" };
  assert.equal(phraseJournal({ ...base, action: "donne" }, nomDe), "09/11, Camille R. a donné le titre Secrétariat à alex@exemple.invalid");
  assert.equal(phraseJournal({ ...base, action: "retire" }, nomDe), "09/11, Camille R. a retiré le titre Secrétariat à alex@exemple.invalid");
  assert.equal(phraseJournal({ ...base, action: "change" }, nomDe), "09/11, Camille R. a changé le titre de alex@exemple.invalid en Secrétariat");
  assert.equal(phraseJournal({ ...base, action: "cree", pour: null }, nomDe), "09/11, Camille R. a créé le titre Secrétariat");
  assert.equal(phraseJournal({ ...base, action: "ajuste", pour: null }, nomDe), "09/11, Camille R. a ajusté le titre Secrétariat");
  assert.equal(phraseJournal({ ...base, action: "supprime", pour: null }, nomDe), "09/11, Camille R. a supprimé le titre Secrétariat");
  assert.equal(phraseJournal({ ...base, action: "donne", par: "système" }, nomDe), "09/11, L'application a donné le titre Secrétariat à alex@exemple.invalid");
  // Une action que l'app ne connaît pas encore : la phrase de repli.
  assert.equal(phraseJournal({ ...base, action: "inconnue" }, nomDe), "09/11, Camille R. a modifié un titre");
});

test("formateurFixeSur", () => {
  assert.equal(formateurFixeSur(null, 1), null);
  assert.equal(formateurFixeSur([formateurFixe], 1), true);
  assert.equal(formateurFixeSur([intervenant], 1), false);
  assert.equal(formateurFixeSur([formateurFixe], 9), false);
  assert.equal(formateurFixeSur([{ ...intervenant, fixe: false, nom: "Formateur" }], 1), false);
  // Le booléen `fixe` l'emporte sur le nom : un titre fixe qui ne s'appelle pas « Formateur » compte.
  assert.equal(formateurFixeSur([{ ...intervenant, fixe: true }], 1), true);
  // Un titre de CENTRE nommé « Formateur » ne compte pas : seul un titre de promo couvre la promo.
  assert.equal(formateurFixeSur([{ titre_id: 7, nom: "Formateur", niveau: "centre", lieu_id: 1, promo_ids: null, cases: {} }], 1), false);
  assert.equal(formateurFixeSur([{ titre_id: 7, nom: "Formateur", niveau: "centre", lieu_id: 1, promo_ids: [1], cases: {} }], 1), false);
});

test("titresPourApercu : titres du niveau de l'aperçu, le titre fixe d'abord, rien de deviné", () => {
  const centre = [
    { id: 7014, nom: "Intervenant", niveau: "promo", fixe: false }, { id: 7001, nom: "Formateur", niveau: "promo", fixe: true },
    { id: 7002, nom: "Direction de centre", niveau: "centre", fixe: true }, { id: 7012, nom: "Secrétariat", niveau: "centre", fixe: false },
  ];
  const reseau = [{ id: 7003, nom: "Siège", niveau: "reseau", fixe: true }, { id: 7016, nom: "Qualité", niveau: "reseau", fixe: false }];
  const listes = { centre, reseau };
  assert.deepEqual(titresPourApercu(listes, "formateur").map((t) => t.nom), ["Formateur", "Intervenant"]);
  assert.deepEqual(titresPourApercu(listes, "direction").map((t) => t.nom), ["Direction de centre", "Secrétariat"]);
  assert.deepEqual(titresPourApercu(listes, "siege").map((t) => t.nom), ["Siège", "Qualité"]);
  assert.deepEqual(titresPourApercu(listes, "siege")[0], { id: "7003", nom: "Siège", fixe: true });
  assert.deepEqual(titresPourApercu(listes, "stagiaire"), []);
  assert.deepEqual(titresPourApercu({ centre: null, reseau }, "formateur"), []);
  assert.deepEqual(titresPourApercu({ centre: null, reseau }, "siege").length, 2);
  assert.deepEqual(titresPourApercu(null, "siege"), []);
});

test("liste du choix Titre : une liste par centre, une lecture ratée n'est pas mémorisée", () => {
  const reseau = [{ id: 3, nom: "Siège", niveau: "reseau", fixe: true }];
  const lieuA = [{ id: 1, nom: "Formateur", niveau: "promo", fixe: true }, { id: 10, nom: "Intervenant A", niveau: "promo", fixe: false }];
  const lieuB = [{ id: 1, nom: "Formateur", niveau: "promo", fixe: true }, { id: 20, nom: "Intervenant B", niveau: "promo", fixe: false }];
  let m = fusionnerListesApercu(null, 1, lieuA, reseau);
  assert.deepEqual(titresPourApercu(listesPourLeCentre(m, 1), "formateur").map((t) => t.nom), ["Formateur", "Intervenant A"]);
  assert.equal(listesApercuIncompletes(m, 1), false);
  assert.equal(listesApercuIncompletes(m, 2), true, "autre centre : à lire");
  assert.deepEqual(titresPourApercu(listesPourLeCentre(m, 2), "formateur"), [], "la liste du centre A ne sert pas au centre B");
  m = fusionnerListesApercu(m, 2, lieuB, reseau);
  assert.deepEqual(titresPourApercu(listesPourLeCentre(m, 2), "formateur").map((t) => t.nom), ["Formateur", "Intervenant B"]);
  assert.deepEqual(titresPourApercu(listesPourLeCentre(m, 1), "formateur").map((t) => t.nom), ["Formateur", "Intervenant A"]);
  assert.equal(fusionnerListesApercu(null, 1, null, null), null, "deux lectures ratées : rien de mémorisé");
  assert.equal(listesApercuIncompletes(fusionnerListesApercu(null, 1, null, null), 1), true);
  const partiel = fusionnerListesApercu(null, 1, null, reseau);
  assert.equal(listesApercuIncompletes(partiel, 1), true, "centre raté : relu à la prochaine ouverture");
  assert.equal(fusionnerListesApercu(m, 1, null, null), m, "une relecture ratée garde ce qui était lu");
});

test("aucun texte ne contient « prof » ni le tiret cadratin", () => {
  const source = readFileSync(new URL("../js/titres-rules.js", import.meta.url), "utf8");
  const textes = [BANDEAU_EQUIPE, BANDEAU_COURS, BANDEAU_DIRECTIONS, PHRASE_STAGIAIRES_RELEVE, phrasePorteurs(2), phraseVersionCentre(2), source];
  for (const t of textes) {
    assert.ok(!/prof/i.test(t), "prof");
    assert.ok(!t.includes(String.fromCharCode(0x2014)), "tiret cadratin");
  }
});
