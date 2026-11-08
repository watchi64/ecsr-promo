// Règles des rôles côté app (lot 4) : droits affichés, aperçu, invitation, retrait.
// Lancer : node --test tests/roles-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APERCUS, LIBELLES_APERCU, ENTETE_APERCU, normaliserApercu, apercusPermis, droitsAffiches,
  peutInviterFormateur, peutRetirerCompte, messageInvitation, messageSansPromo, MESSAGE_SANS_PROMO,
} from "../js/roles-rules.js";

const formateur = { profil: { role: "prof", is_admin: true }, promo: { roles: ["formateur"] } };
const fondateur = { profil: { role: "stagiaire", is_admin: true, is_founder: true }, promo: { roles: ["stagiaire"] } };
const stagiaire = { profil: { role: "stagiaire", is_admin: false }, promo: { roles: ["stagiaire"] } };
const direction = { profil: { role: "prof", is_admin: false }, promo: { roles: ["direction"] } };

test("constantes", () => {
  assert.deepEqual(APERCUS, ["formateur", "direction", "siege", "stagiaire"]);
  assert.deepEqual(LIBELLES_APERCU, { formateur: "Formateur", direction: "Direction", siege: "Siège", stagiaire: "Stagiaire" });
  assert.equal(ENTETE_APERCU, "x-apercu-role");
});

test("droits réels selon les rôles de la promo", () => {
  assert.deepEqual(droitsAffiches(formateur), { admin: true, prof: true, stagiaire: false, equipe: true, espace: "equipe" });
  assert.deepEqual(droitsAffiches(fondateur), { admin: true, prof: false, stagiaire: true, equipe: true, espace: "equipe" });
  assert.deepEqual(droitsAffiches(stagiaire), { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
  assert.deepEqual(droitsAffiches(direction), { admin: false, prof: true, stagiaire: false, equipe: true, espace: "equipe" });
});

test("promo sans colonne roles (base pas migrée) : repli sur is_admin et role", () => {
  for (const promo of [{}, { roles: null }]) {
    assert.deepEqual(droitsAffiches({ profil: formateur.profil, promo }), { admin: true, prof: true, stagiaire: false, equipe: true, espace: "equipe" });
    assert.deepEqual(droitsAffiches({ profil: fondateur.profil, promo }), { admin: true, prof: false, stagiaire: true, equipe: true, espace: "equipe" });
    assert.deepEqual(droitsAffiches({ profil: stagiaire.profil, promo }), { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
  }
});

test("état dégradé (aucune promo en place) : jamais d'écriture pour l'équipe, sauf le fondateur", () => {
  // Un ancien formateur sans affectation (role prof, is_admin vrai) : lecture seule tant que la base ne confirme rien.
  const ancien = { role: "prof", is_admin: true, is_founder: false };
  assert.deepEqual(droitsAffiches({ profil: ancien, promo: null }), { admin: false, prof: true, stagiaire: false, equipe: false, espace: "equipe" });
  assert.deepEqual(droitsAffiches({ profil: formateur.profil, promo: null }), { admin: false, prof: true, stagiaire: false, equipe: false, espace: "equipe" });
  assert.deepEqual(droitsAffiches({ profil: fondateur.profil, promo: null }), { admin: true, prof: true, stagiaire: true, equipe: true, espace: "equipe" });
  assert.deepEqual(droitsAffiches({ profil: stagiaire.profil, promo: null }), { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
  // Un compte sans fiche ni droit : rien.
  assert.deepEqual(droitsAffiches({ profil: { role: "stagiaire", is_admin: false, stagiaire_id: null }, promo: null }),
    { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
});

test("un siège réel (roles siege, sans fiche) n'est ni administrateur ni équipe", () => {
  const siege = { profil: { role: "prof", is_admin: false }, promo: { roles: ["siege"] } };
  assert.deepEqual(droitsAffiches(siege), { admin: false, prof: true, stagiaire: false, equipe: false, espace: "equipe" });
});

test("cumul : stagiaire dans une promo, formateur dans l'autre", () => {
  const profil = { role: "stagiaire", is_admin: false, is_founder: false };
  assert.deepEqual(droitsAffiches({ profil, promo: { roles: ["stagiaire"] } }), { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
  assert.deepEqual(droitsAffiches({ profil, promo: { roles: ["formateur"] } }), { admin: true, prof: true, stagiaire: false, equipe: true, espace: "equipe" });
});

test("messageSansPromo : le siège et la direction ne sont pas renvoyés vers un formateur", () => {
  assert.match(messageSansPromo(["siege"]), /siège/);
  assert.match(messageSansPromo(["direction"]), /direction/);
  assert.equal(messageSansPromo([]), MESSAGE_SANS_PROMO);
  assert.equal(messageSansPromo(null), MESSAGE_SANS_PROMO);
  assert.equal(messageSansPromo(undefined), MESSAGE_SANS_PROMO);
  for (const m of [MESSAGE_SANS_PROMO, messageSansPromo(["siege"]), messageSansPromo(["direction"])]) assert.ok(!m.includes("—"));
});

test("pas de profil : aucun droit", () => {
  assert.deepEqual(droitsAffiches({ profil: null, promo: null }), { admin: false, prof: false, stagiaire: false, equipe: false, espace: "stagiaire" });
});

test("aperçus du fondateur", () => {
  assert.deepEqual(droitsAffiches({ ...fondateur, apercu: "formateur" }), { admin: true, prof: true, stagiaire: false, equipe: true, espace: "equipe" });
  assert.deepEqual(droitsAffiches({ ...fondateur, apercu: "direction" }), { admin: false, prof: true, stagiaire: false, equipe: true, espace: "equipe" });
  assert.deepEqual(droitsAffiches({ ...fondateur, apercu: "siege" }), { admin: false, prof: true, stagiaire: false, equipe: false, espace: "equipe" });
  assert.deepEqual(droitsAffiches({ ...fondateur, apercu: "stagiaire" }), { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
});

test("normaliserApercu", () => {
  assert.equal(normaliserApercu("prof"), "formateur");
  assert.equal(normaliserApercu("admin"), null);
  assert.equal(normaliserApercu("siege"), "siege");
  assert.equal(normaliserApercu(null), null);
  assert.equal(normaliserApercu("n'importe quoi"), null);
});

test("apercusPermis", () => {
  assert.deepEqual(apercusPermis(fondateur), ["formateur", "direction", "siege", "stagiaire"]);
  assert.deepEqual(apercusPermis(formateur), ["stagiaire"]);
  assert.deepEqual(apercusPermis(direction), ["stagiaire"]);
  assert.deepEqual(apercusPermis(stagiaire), []);
  assert.deepEqual(apercusPermis({ profil: formateur.profil, promo: null }), []);  // état dégradé : aucun rôle confirmé par la base
  assert.deepEqual(apercusPermis({ profil: null, promo: null }), []);
});

test("un aperçu hors de la liste permise est ignoré", () => {
  assert.deepEqual(droitsAffiches({ ...formateur, apercu: "formateur" }), droitsAffiches(formateur));
  assert.deepEqual(droitsAffiches({ ...formateur, apercu: "siege" }), droitsAffiches(formateur));
  assert.deepEqual(droitsAffiches({ ...stagiaire, apercu: "formateur" }), droitsAffiches(stagiaire));
  assert.deepEqual(droitsAffiches({ ...formateur, apercu: "stagiaire" }), { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
});

test("peutInviterFormateur", () => {
  assert.equal(peutInviterFormateur(fondateur), true);
  assert.equal(peutInviterFormateur(formateur), false);
  assert.equal(peutInviterFormateur(direction), true);
  assert.equal(peutInviterFormateur(stagiaire), false);
  assert.equal(peutInviterFormateur({ ...fondateur, apercu: "formateur" }), false);
  assert.equal(peutInviterFormateur({ ...fondateur, apercu: "stagiaire" }), false);
  assert.equal(peutInviterFormateur({ ...fondateur, apercu: "direction" }), true);
  assert.equal(peutInviterFormateur({ ...direction, apercu: "stagiaire" }), false);
});

test("peutRetirerCompte", () => {
  const stag = { role: "stagiaire", is_admin: false };
  const prof = { role: "prof", is_admin: true };
  assert.equal(peutRetirerCompte({ cible: { role: "stagiaire", is_founder: true }, fondateur: true }), false);
  assert.equal(peutRetirerCompte({ cible: prof, fondateur: true }), true);
  assert.equal(peutRetirerCompte({ cible: prof, fondateur: false }), false);
  assert.equal(peutRetirerCompte({ cible: stag, fondateur: false }), true);
  assert.equal(peutRetirerCompte({ cible: stag, fondateur: true }), true);
  assert.equal(peutRetirerCompte({ cible: null, fondateur: true }), false);
});

test("un drapeau de fondateur sans is_admin n'ouvre pas l'espace de l'équipe, mais garde les aperçus", () => {
  const sansAdmin = { profil: { role: "stagiaire", is_admin: false, is_founder: true }, promo: { roles: ["stagiaire"] } };
  assert.deepEqual(droitsAffiches(sansAdmin), { admin: false, prof: false, stagiaire: true, equipe: false, espace: "stagiaire" });
  assert.deepEqual(apercusPermis(sansAdmin), ["formateur", "direction", "siege", "stagiaire"]);
});

test("messageInvitation retire le préfixe de la base", () => {
  assert.equal(messageInvitation("invitation: ce compte est déjà lié à une autre fiche."), "ce compte est déjà lié à une autre fiche.");
  assert.equal(messageInvitation("Délai dépassé"), "Délai dépassé");
  assert.equal(messageInvitation(""), "Erreur d'invitation");
});

test("messageInvitation : fonction absente de la base, phrase sans terme technique", () => {
  const phrase = "L'invitation n'est pas disponible pour le moment.";
  assert.equal(messageInvitation("Could not find the function public.inviter_compte(p_email) in the schema cache", "PGRST202"), phrase);
  assert.equal(messageInvitation("Could not find the function public.inviter_compte"), phrase);
  assert.equal(messageInvitation("anything", "PGRST202"), phrase);
  assert.equal(messageInvitation("invitation: refus", "P0001"), "refus");
});
