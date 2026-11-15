// Routage des demandes de l'espace contact : la table de parité commune au JS et à la base. Lancer : node tests/contact-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routerDemande, etapesDemande, rangerDemandes, libelleDestinataire, lignesEncadre, phraseReglesCentre, compterNonLues, phraseContact } from "../js/contact-rules.js";

const table = JSON.parse(readFileSync(new URL("./fixtures/contact-routage.json", import.meta.url), "utf8"));

test("la table de parité porte les cas demandés, chacun avec ses entrées et son attendu", () => {
  const noms = table.cas.map((c) => c.nom);
  for (const nom of ["mode_choix", "absence_cpf", "absence_sans_financement_defaut", "absence_choix_precoche", "retard_regle_formateurs_du_jour",
    "retard_sans_regle_choix", "retard_regle_planning_vide_defaut", "type_sans_regle_defaut", "titulaire_en_conge_relais",
    "relais_en_conge_defaut", "relais_et_defaut_en_conge_choix", "relais_autre_centre", "liste_vide"]) {
    assert.ok(noms.includes(nom), `cas ${nom}`);
  }
  assert.equal(new Set(noms).size, noms.length, "noms uniques");
  for (const c of table.cas) {
    assert.ok(c.entree && c.attendu, c.nom);
    assert.deepEqual(Object.keys(c.attendu).sort(), ["mode", "possibles", "principaux", "source"], c.nom);
  }
});

for (const c of table.cas) {
  test(`parité : ${c.nom}`, () => {
    assert.deepEqual(routerDemande(c.entree), c.attendu);
  });
}

test("le délégué n'est jamais principal : un stagiaire n'est ni une fiche ni un possible", () => {
  // Une règle qui viserait une fiche inconnue (absente des fiches du centre) ne route rien : mode choix.
  const r = routerDemande({ type: "autre", aujourdhui: "2031-03-04", regles: [{ type: "autre", financement_id: null, cible: "fiche", fiche_id: 99 }],
    fiches: [], possibles: [3, 1, 2] });
  assert.equal(r.mode, "choix");
  assert.deepEqual(r.possibles.map((p) => p.fiche_id), [1, 2, 3]);
});

test("identifiants numériques triés par valeur ; doublons de formateurs du jour retirés ; entrées vides", () => {
  const r = routerDemande({ type: "retard", aujourdhui: "2031-03-04", regles: [{ type: "retard", financement_id: null, cible: "formateurs_du_jour", fiche_id: null }],
    fiches: [{ fiche_id: 10, nom: "a" }, { fiche_id: 9, nom: "b" }], formateurs_du_jour: [10, 9, 10] });
  assert.deepEqual(r, { mode: "regle", principaux: [{ fiche_id: 9, relais_de: null }, { fiche_id: 10, relais_de: null }], source: "regle_type", possibles: [] });
  assert.deepEqual(routerDemande({ type: "autre", aujourdhui: "2031-03-04" }), { mode: "choix", principaux: [], source: null, possibles: [] });
});

// === Tâche 11 : étapes, rangement, encadré, règles du centre ===

test("etapesDemande : « Lue » seulement si un principal a ouvert dans l'app", () => {
  const base = { demande: { etat: "envoyee", cree_le: "2031-03-04T08:00:00Z", auteur_nom: "Lina B.", prise_le: null, annulee_le: null } };
  const sansCompte = { ...base, destinataires: [{ nom: "Karim", principal: true, lue_le: null, non_prevenu: false }, { nom: "Nora", principal: false, lue_le: "2031-03-04T09:00:00Z" }] };
  assert.deepEqual(etapesDemande(sansCompte).map((e) => e.cle), ["envoyee"]);
  const lue = { ...base, destinataires: [{ nom: "Claire", principal: true, lue_le: "2031-03-04T10:00:00Z" }, { nom: "Sophie", principal: true, lue_le: "2031-03-04T09:30:00Z" }] };
  const e = etapesDemande(lue);
  assert.deepEqual(e.map((x) => x.cle), ["envoyee", "lue"]);
  assert.equal(e[1].par, "Sophie");
  assert.equal(e[1].quand, "2031-03-04T09:30:00Z");
  const prise = { demande: { ...base.demande, etat: "prise", prise_le: "2031-03-04T11:00:00Z", prise_par: "Sophie" }, destinataires: lue.destinataires };
  assert.deepEqual(etapesDemande(prise).map((x) => x.cle), ["envoyee", "lue", "prise"]);
  assert.equal(etapesDemande(prise)[2].par, "Sophie");
  const annulee = { demande: { ...base.demande, etat: "annulee", annulee_le: "2031-03-04T08:30:00Z", annulee_par: "Lina B." }, destinataires: [] };
  assert.deepEqual(etapesDemande(annulee).map((x) => x.cle), ["envoyee", "annulee"]);
  assert.deepEqual(etapesDemande(null), []);
});

test("rangerDemandes : à traiter lu tel quel, prise sans échange depuis 7 jours terminée", () => {
  const maintenant = new Date("2031-03-20T12:00:00Z");
  const il = (j) => new Date(maintenant.getTime() - j * 86400000).toISOString();
  const lignes = [
    { id: 1, etat: "envoyee", a_traiter: true, cree_le: il(30), dernier_echange_le: il(30) },
    { id: 2, etat: "envoyee", a_traiter: false, cree_le: il(30), dernier_echange_le: il(30) },
    { id: 3, etat: "prise", a_traiter: false, cree_le: il(20), dernier_echange_le: il(8) },
    { id: 4, etat: "prise", a_traiter: false, cree_le: il(20), dernier_echange_le: il(6) },
    { id: 5, etat: "annulee", a_traiter: false, cree_le: il(1), dernier_echange_le: il(1) },
    { id: 6, etat: "prise", a_traiter: false, cree_le: il(9), dernier_echange_le: null },
  ];
  const r = rangerDemandes(lignes, maintenant);
  assert.deepEqual(r.aTraiter.map((l) => l.id), [1]);
  assert.deepEqual(r.ouvertes.map((l) => l.id), [2, 4]);
  assert.deepEqual(r.terminees.map((l) => l.id), [3, 5, 6]);
  assert.deepEqual(rangerDemandes(null, maintenant), { aTraiter: [], ouvertes: [], terminees: [] });
});

test("libelleDestinataire : relais, non prévenu, nom seul", () => {
  assert.equal(libelleDestinataire({ nom: "Claire", relais_de: "Sophie" }), "Claire, relais de Sophie");
  assert.equal(libelleDestinataire({ nom: "Karim", non_prevenu: true }), "Karim n'a pas pu être prévenu");
  assert.equal(libelleDestinataire({ nom: "Nora" }), "Nora");
});

const PHRASE_CHOIX = "Ton centre n'a pas choisi qui reçoit ce type de demande : coche au moins une personne.";
const PHRASE_VIDE = "Personne ne peut recevoir ta demande dans ce centre : préviens ton formateur directement.";

test("lignesEncadre (Review Focus 1) : mode choix, case pré-cochée, décochée, liste vide, mode règle", () => {
  const choix = { mode: "choix", principaux: [], possibles: [
    { fiche_id: 1, nom: "Sophie", titre: "Formateur", pre_coche: true }, { fiche_id: 2, nom: "Marc", titre: "Direction", pre_coche: false }] };
  const d = lignesEncadre(choix);
  assert.equal(d.mode, "choix");
  assert.deepEqual(d.cases.map((c) => [c.fiche_id, c.coche]), [[1, true], [2, false]]);
  assert.equal(d.phrase, PHRASE_CHOIX);
  assert.equal(d.envoyable, true);
  assert.equal(lignesEncadre(choix, new Set()).envoyable, false);
  assert.deepEqual(lignesEncadre(choix, new Set()).cases.map((c) => c.coche), [false, false]);
  const deux = lignesEncadre(choix, [2]);
  assert.deepEqual(deux.cases.map((c) => c.coche), [false, true]);
  assert.equal(deux.envoyable, true);
  const vide = lignesEncadre({ mode: "choix", principaux: [], possibles: [] });
  assert.equal(vide.envoyable, false);
  assert.equal(vide.phrase, PHRASE_VIDE);
  assert.deepEqual(vide.cases, []);
  const regle = lignesEncadre({ mode: "regle", principaux: [{ fiche_id: 3, nom: "Claire", relais_de: "Sophie" }], possibles: [] }, new Set([9]));
  assert.deepEqual(regle.cases, []);
  assert.deepEqual(regle.principaux, ["Claire"]);
  assert.equal(regle.envoyable, true);
});

test("phraseReglesCentre : mode règle nomme la personne, sans règle le stagiaire choisit", () => {
  const reglages = {
    regles: [{ type: "absence", financement_id: 7, cible: "fiche", fiche_id: 1 }, { type: "retard", financement_id: null, cible: "formateurs_du_jour", fiche_id: null }],
    financements: [{ id: 7, libelle: "CPF" }, { id: 8, libelle: "Pôle emploi" }],
    fiches: [{ fiche_id: 1, nom: "Sophie", du_centre: true, joignable: true }],
  };
  assert.equal(phraseReglesCentre(reglages, "absence", 7, "2031-03-04"), "Absence, CPF : Sophie");
  assert.equal(phraseReglesCentre(reglages, "absence", 8, "2031-03-04"),
    "Absence, Pôle emploi : le stagiaire choisit parmi les formateurs de sa promo et la direction");
  assert.equal(phraseReglesCentre(reglages, "retard", null, "2031-03-04"), "Retard : les formateurs du jour");
  assert.equal(phraseReglesCentre(reglages, "document", null, "2031-03-04"),
    "Document : le stagiaire choisit parmi les formateurs de sa promo et la direction");
});

test("compterNonLues : seules les demandes non lues comptent, une liste absente vaut zéro", () => {
  assert.equal(compterNonLues([{ non_lue: true }, { non_lue: false }, { non_lue: null }, {}, { non_lue: true }]), 2);
  assert.equal(compterNonLues([]), 0);
  assert.equal(compterNonLues(null), 0);
});

test("phraseContact : un refus de la base se dit tel quel, tout autre échec par la phrase de l'écran", () => {
  assert.equal(phraseContact(new Error("contact: Demande introuvable."), "Échec."), "Demande introuvable.");
  assert.equal(phraseContact(Object.assign(new Error("permission denied"), { code: "42501" }), "Échec."), "Vous n'avez pas le droit de faire cela ici.");
  assert.equal(phraseContact(new Error("TypeError: x is undefined"), "Échec."), "Échec.");
});
