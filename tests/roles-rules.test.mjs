// Règles des rôles côté app (lot 4) : droits affichés, aperçu, invitation, retrait.
// Lancer : node --test tests/roles-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APERCUS, LIBELLES_APERCU, ENTETE_APERCU, normaliserApercu, apercusPermis, droitsAffiches,
  peutInviterFormateur, peutRetirerCompte, messageInvitation, messageSansPromo, MESSAGE_SANS_PROMO,
  messageInvitationReussie, phraseCompteTransforme, etiquetteBadge, pastillesDuProfil, listeAcces,
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

test("messageSansPromo : un seul refus, sans « arrive bientôt » (lot 5 : le siège et la direction entrent sans promo)", () => {
  for (const roles of [["siege"], ["direction"], ["formateur"], [], null, undefined]) {
    assert.equal(messageSansPromo(roles), MESSAGE_SANS_PROMO);
  }
  assert.ok(!/bientôt/.test(MESSAGE_SANS_PROMO));
  assert.ok(!MESSAGE_SANS_PROMO.includes("\u2014"));
  // Refus à la porte : formule neutre, ni tu ni vous (décision du 10/11).
  assert.doesNotMatch(MESSAGE_SANS_PROMO, /\b(tu|ton|ta|tes|toi|vous|votre|vos)\b|\bt'/i);
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

test("messageInvitationReussie : « rien n'a changé » seulement si ni profil créé ni affectation ajoutée (I1)", () => {
  const email = "x@exemple.fr";
  assert.deepEqual(messageInvitationReussie({ resultat: { cree: true, affecte: 1, role: "formateur" }, email }),
    { texte: "Ajouté à la liste des invitations : x@exemple.fr. Partagez-lui l'URL.", ton: "success" });
  // L'option v2, que les vues passent encore, est ignorée (une seule navigation depuis le 10/11) : plus de « whitelist ».
  assert.deepEqual(messageInvitationReussie({ resultat: { cree: true, affecte: 0, role: "stagiaire" }, email, v2: false }),
    { texte: "Ajouté à la liste des invitations : x@exemple.fr. Partagez-lui l'URL.", ton: "success" });
  // Un compte qui existait gagne la promo : ce n'est pas « rien n'a changé ».
  assert.deepEqual(messageInvitationReussie({ resultat: { cree: false, affecte: 1, role: "formateur" }, email }),
    { texte: "Déjà inscrit : ajouté comme formateur de cette promo.", ton: "success" });
  assert.equal(messageInvitationReussie({ resultat: { cree: false, affecte: 1, role: "direction" }, email }).texte,
    "Déjà inscrit : ajouté à la direction du centre.");
  assert.equal(messageInvitationReussie({ resultat: { cree: false, affecte: 1, role: "siege" }, email }).texte,
    "Déjà inscrit : rattaché au siège du réseau.");
  assert.deepEqual(messageInvitationReussie({ resultat: { cree: false, affecte: 0, role: "formateur" }, email }),
    { texte: "Ce compte existe déjà : rien n'a changé.", ton: "info" });
  assert.deepEqual(messageInvitationReussie({ resultat: { cree: false, affecte: 0, role: "stagiaire" }, email }),
    { texte: "Ce compte existe déjà : rien n'a changé.", ton: "info" });
  // Sans `affecte` (réponse d'une autre forme), rien n'est affirmé sur ce qui a changé.
  assert.deepEqual(messageInvitationReussie({ resultat: { cree: false, role: "formateur" }, email }),
    { texte: "Ce compte existe déjà.", ton: "info" });
  // Sans réponse lisible : la base n'a pas refusé, l'ajout est annoncé comme avant.
  assert.equal(messageInvitationReussie({ resultat: null, email }).ton, "success");
  for (const r of [{ cree: true }, { cree: false, affecte: 1 }, { cree: false, affecte: 0 }, { cree: false }]) {
    assert.ok(!messageInvitationReussie({ resultat: r, email }).texte.includes(String.fromCharCode(0x2014)));
  }
});

test("messageInvitationReussie : le compte d'un ancien stagiaire devenu compte du personnel le dit, au vouvoiement (suite du lot 5)", () => {
  const email = "ancien@exemple.invalid";
  for (const [role, quoi] of [["formateur", "un compte de formateur"], ["direction", "un compte de la direction du centre"], ["siege", "un compte du siège du réseau"]]) {
    assert.deepEqual(messageInvitationReussie({ resultat: { cree: false, affecte: 1, role, transforme: true }, email }),
      { texte: `Le compte de cet ancien stagiaire est devenu ${quoi}. La personne se connecte comme avant, avec son mot de passe.`, ton: "success" });
  }
  // `transforme` faux ou absent : les phrases d'avant ne changent pas.
  assert.equal(messageInvitationReussie({ resultat: { cree: false, affecte: 1, role: "direction", transforme: false }, email }).texte,
    "Déjà inscrit : ajouté à la direction du centre.");
  assert.equal(messageInvitationReussie({ resultat: { cree: true, affecte: 1, role: "formateur", transforme: false }, email }).texte,
    "Ajouté à la liste des invitations : ancien@exemple.invalid. Partagez-lui l'URL.");
  assert.equal(phraseCompteTransforme(undefined), phraseCompteTransforme("formateur"), "rôle absent : formateur");
  for (const role of ["formateur", "direction", "siege"]) {
    const t = phraseCompteTransforme(role);
    assert.ok(!t.includes(String.fromCharCode(0x2014)) && !/tu|ta|ton|prof/i.test(t), role);
  }
});

test("etiquetteBadge : le rôle réel sur la promo affichée, pas l'ancien role du profil (M4)", () => {
  // La direction (role prof) n'est pas « formateur ».
  assert.deepEqual(etiquetteBadge(direction), { libelle: "direction", classe: "prof" });
  assert.deepEqual(etiquetteBadge(formateur), { libelle: "formateur", classe: "prof" });
  assert.deepEqual(etiquetteBadge(stagiaire), { libelle: "stagiaire", classe: "stagiaire" });
  // Le compte cumulé (role stagiaire) est formateur sur sa promo de formateur, stagiaire sur celle de sa fiche.
  const cumul = { role: "stagiaire", is_admin: false, is_founder: false };
  assert.deepEqual(etiquetteBadge({ profil: cumul, promo: { roles: ["formateur"] } }), { libelle: "formateur", classe: "prof" });
  assert.deepEqual(etiquetteBadge({ profil: cumul, promo: { roles: ["stagiaire"] } }), { libelle: "stagiaire", classe: "stagiaire" });
  // Le fondateur : stagiaire sur la promo de sa fiche, « admin » sur une promo où il n'a aucun rôle.
  assert.deepEqual(etiquetteBadge(fondateur), { libelle: "stagiaire", classe: "stagiaire" });
  assert.deepEqual(etiquetteBadge({ profil: fondateur.profil, promo: { roles: [] } }), { libelle: "admin", classe: "admin" });
  assert.deepEqual(etiquetteBadge({ profil: { role: "prof", is_admin: true }, promo: { roles: [] } }), { libelle: "", classe: "" });
  // Base pas migrée (pas de colonne roles) : l'ancien role du profil effectif.
  assert.deepEqual(etiquetteBadge({ profil: { role: "prof", is_admin: true }, promo: {} }), { libelle: "formateur", classe: "prof" });
  assert.deepEqual(etiquetteBadge({ profil: { role: "admin", is_admin: true }, promo: null }), { libelle: "admin", classe: "admin" });
  assert.deepEqual(etiquetteBadge({ profil: { role: "stagiaire" }, promo: null }), { libelle: "stagiaire", classe: "stagiaire" });
  assert.deepEqual(etiquetteBadge({ profil: null, promo: null }), { libelle: "", classe: "" });
});

// Lot G : les pastilles de « Personnes avec accès ».
const lib = (p) => p.map((x) => x.libelle).join("+");
const formateurSimple = { email: "f@x.fr", role: "prof", is_admin: true, prof_id: 4 };
const comptePersonnel = { email: "d@x.fr", role: "prof", is_admin: false, prof_id: null };
const roles = [{ email: "d@x.fr", role: "direction" }, { email: "s@x.fr", role: "siege" }, { email: "ds@x.fr", role: "direction" }, { email: "ds@x.fr", role: "siege" }];

test("pastillesDuProfil : un compte direction ou siège n'est plus « formateur »", () => {
  assert.equal(lib(pastillesDuProfil({ profil: comptePersonnel, roles })), "direction");
  assert.equal(lib(pastillesDuProfil({ profil: { ...comptePersonnel, email: "s@x.fr" }, roles })), "siège");
  assert.equal(lib(pastillesDuProfil({ profil: { ...comptePersonnel, email: "ds@x.fr" }, roles })), "direction+siège");
  assert.equal(pastillesDuProfil({ profil: comptePersonnel, roles })[0].classe, "prof");
});

test("pastillesDuProfil : direction et formateur gardent les deux pastilles quand une fiche formateur le dit", () => {
  assert.equal(lib(pastillesDuProfil({ profil: { ...comptePersonnel, prof_id: 9 }, roles })), "direction+formateur");
  assert.equal(lib(pastillesDuProfil({ profil: { ...comptePersonnel, email: "ds@x.fr", prof_id: 9 }, roles })), "direction+siège+formateur");
});

test("pastillesDuProfil : un formateur sans rôle de direction ou de siège reste « formateur », comme avant", () => {
  assert.equal(lib(pastillesDuProfil({ profil: formateurSimple, roles })), "formateur");
  assert.equal(pastillesDuProfil({ profil: formateurSimple, roles })[0].classe, "prof");
  assert.equal(lib(pastillesDuProfil({ profil: { email: "a@x.fr", role: "admin" }, roles: [], v2: true })), "formateur");
  assert.equal(lib(pastillesDuProfil({ profil: { email: "a@x.fr", role: "admin" }, roles: [], v2: false })), "formateur", "option v2 ignorée");
  assert.equal(lib(pastillesDuProfil({ profil: { email: "a@x.fr", role: "admin" }, roles: [] })), "formateur");
  assert.equal(lib(pastillesDuProfil({ profil: { email: "e@x.fr", role: "stagiaire" }, roles })), "stagiaire");
});

test("pastillesDuProfil : lecture des rôles absente ou en échec, l'affichage d'avant", () => {
  for (const r of [null, undefined, [], "x"]) {
    assert.equal(lib(pastillesDuProfil({ profil: comptePersonnel, roles: r })), "formateur");
  }
  assert.deepEqual(pastillesDuProfil({}), []);
});

test("pastillesDuProfil : l'adresse se compare sans tenir compte de la casse, et un stagiaire n'est jamais touché", () => {
  assert.equal(lib(pastillesDuProfil({ profil: { ...comptePersonnel, email: "D@X.fr" }, roles })), "direction");
  assert.equal(lib(pastillesDuProfil({ profil: { email: "d@x.fr", role: "stagiaire", stagiaire_id: 3 }, roles })), "stagiaire");
});

test("listeAcces : triée par premier rôle affiché puis par adresse, sans changer qui figure dans la liste", () => {
  const profils = [
    { email: "z@x.fr", role: "stagiaire" }, { email: "s@x.fr", role: "prof" }, { email: "b@x.fr", role: "prof" },
    { email: "d@x.fr", role: "prof" }, { email: "a@x.fr", role: "stagiaire" }, { email: "c@x.fr", role: "prof", prof_id: 1 },
  ];
  const sortie = listeAcces({ profils, roles });
  assert.deepEqual(sortie.map((l) => l.profil.email), ["d@x.fr", "b@x.fr", "c@x.fr", "s@x.fr", "a@x.fr", "z@x.fr"]);
  assert.deepEqual(sortie.map((l) => lib(l.pastilles)), ["direction", "formateur", "formateur", "siège", "stagiaire", "stagiaire"]);
  assert.equal(listeAcces({ profils, roles }).length, profils.length);
  assert.deepEqual(listeAcces({ profils: null, roles }), []);
  // Lecture en échec : l'ordre d'avant (formateurs, puis stagiaires, par adresse).
  assert.deepEqual(listeAcces({ profils, roles: null }).map((l) => l.profil.email), ["b@x.fr", "c@x.fr", "d@x.fr", "s@x.fr", "a@x.fr", "z@x.fr"]);
});
