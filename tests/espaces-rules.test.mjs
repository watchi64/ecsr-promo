// Règles des espaces (lot 5) : espaces permis, choix, bride des droits, porte sans promo, centre affiché,
// bascule vers une promo du centre, routes par espace, phrases de refus.
// Lancer : node --test tests/espaces-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESPACES, LIBELLES_ESPACE, ACCUEIL_ESPACE, barreLaterale, espacesPermis, espaceChoisi, brider, peutRedigerContenus,
  porteSansPromo, decisionPorteSansPromo, centreAffiche, promoPourLaDirection, promosDuCentre, routeDansLEspace, phraseHorsEspace,
  phraseDeRefus, adresseApresBascule, normaliserAffectations, affectationsDeSecours, espacesDuCompte, promoPourLEspace,
  cleDerniereRoute, espaceDePilotage, promosVisiblesEnApercu, texteBandeauApercu, litToutesLesNotes, defautsHabillage
} from "../js/espaces-rules.js";
import { messageInvitation } from "../js/roles-rules.js";

const formateur = { role: "prof", is_admin: true };
const stagiaire = { role: "stagiaire", is_admin: false };
const fondateur = { role: "stagiaire", is_admin: true, is_founder: true };
const promoDuLieu = (lieu, roles) => ({ id: 10 + lieu, lieu_id: lieu, lieu_nom: "Centre " + lieu, roles });
const dir = (lieu) => ({ role: "direction", promo_id: null, lieu_id: lieu, lieu_nom: "Centre " + lieu });
const siege = { role: "siege", promo_id: null, lieu_id: null, lieu_nom: null };

test("constantes", () => {
  assert.deepEqual(ESPACES, ["stagiaire", "equipe", "direction", "siege"]);
  assert.deepEqual(LIBELLES_ESPACE, { stagiaire: "Stagiaire", equipe: "Formateur", direction: "Direction", siege: "Siège" });
  assert.deepEqual(ACCUEIL_ESPACE, { stagiaire: "home", equipe: "home", direction: "centre", siege: "reseau" });
  assert.deepEqual(ESPACES.map(barreLaterale), [false, true, true, true]);
});

test("espacesPermis : formateur, stagiaire, direction, cumuls", () => {
  const p = (o) => espacesPermis({ affectations: [], apercu: null, ...o });
  assert.deepEqual(p({ profil: formateur, promo: promoDuLieu(1, ["formateur"]) }), ["equipe"]);
  assert.deepEqual(p({ profil: stagiaire, promo: promoDuLieu(1, ["stagiaire"]) }), ["stagiaire"]);
  assert.deepEqual(p({ profil: formateur, promo: promoDuLieu(1, ["direction"]), affectations: [dir(1)] }), ["direction"]);
  assert.deepEqual(p({ profil: formateur, promo: promoDuLieu(1, ["direction", "formateur"]), affectations: [dir(1)] }),
    ["direction", "equipe"]);
  assert.deepEqual(p({ profil: formateur, promo: promoDuLieu(2, ["formateur"]), affectations: [dir(1)] }), ["direction", "equipe"]);
  // cumul du lot 4 : le rôle change avec la promo affichée
  assert.deepEqual(p({ profil: stagiaire, promo: promoDuLieu(1, ["stagiaire"]) }), ["stagiaire"]);
  assert.deepEqual(p({ profil: stagiaire, promo: promoDuLieu(2, ["formateur"]) }), ["equipe"]);
  assert.deepEqual(p({ profil: formateur, promo: null, affectations: [siege] }), ["siege"]);
  assert.deepEqual(p({ profil: formateur, promo: promoDuLieu(1, ["formateur"]), affectations: [siege, dir(1)] }),
    ["siege", "direction", "equipe"]);
  assert.deepEqual(p({ profil: stagiaire, promo: promoDuLieu(1, []) }), []);
  assert.deepEqual(p({ profil: null, promo: null }), []);
});

test("espacesPermis : fondateur et aperçu", () => {
  const promo = promoDuLieu(4, ["stagiaire"]);
  const f = (apercu) => espacesPermis({ profil: fondateur, promo, affectations: [], apercu });
  assert.deepEqual(f(null), ["equipe"]);
  assert.deepEqual(f("direction"), ["direction"]);
  assert.deepEqual(f("siege"), ["siege"]);
  assert.deepEqual(f("formateur"), ["equipe"]);
  assert.deepEqual(f("stagiaire"), ["stagiaire"]);
  assert.deepEqual(f("prof"), ["equipe"]);
  assert.deepEqual(f("inconnu"), ["equipe"]);
  // Drapeau de fondateur sans is_admin (le compte stagiaire du banc) : l'espace de ses droits, comme au lot 4 (Task 2).
  const fondateurStagiaire = { role: "stagiaire", is_admin: false, is_founder: true };
  assert.deepEqual(espacesPermis({ profil: fondateurStagiaire, promo, affectations: [] }), ["stagiaire"]);
  assert.deepEqual(espacesPermis({ profil: fondateurStagiaire, promo, affectations: [], apercu: "direction" }), ["direction"]);
  // aperçu non permis : ignoré
  assert.deepEqual(espacesPermis({ profil: formateur, promo: promoDuLieu(1, ["formateur"]), affectations: [], apercu: "siege" }),
    ["equipe"]);
  assert.deepEqual(espacesPermis({ profil: formateur, promo: promoDuLieu(1, ["formateur"]), affectations: [], apercu: "direction" }),
    ["equipe"]);
});

test("espaceChoisi", () => {
  assert.equal(espaceChoisi(["direction", "equipe"], "equipe"), "equipe");
  assert.equal(espaceChoisi(["direction"], "equipe"), "direction");
  assert.equal(espaceChoisi([], "equipe"), null);
  assert.equal(espaceChoisi(["siege", "equipe"], null), "siege");
});

test("brider", () => {
  const d = { admin: true, prof: true, stagiaire: true, equipe: true };
  assert.deepEqual(brider(d, "direction"), { admin: false, prof: true, stagiaire: true, equipe: true });
  assert.deepEqual(brider(d, "siege"), { admin: false, prof: true, stagiaire: false, equipe: false });
  assert.deepEqual(brider(d, "equipe"), d);
  assert.deepEqual(brider(d, "stagiaire"), d);
  assert.deepEqual(d, { admin: true, prof: true, stagiaire: true, equipe: true }, "entrée non modifiée");
});

test("peutRedigerContenus", () => {
  assert.equal(peutRedigerContenus({ droits: { admin: true }, espace: "equipe" }), true);
  assert.equal(peutRedigerContenus({ droits: { admin: false }, espace: "equipe" }), false);
  assert.equal(peutRedigerContenus({ droits: { admin: false }, espace: "siege" }), true);
  assert.equal(peutRedigerContenus({ droits: { admin: true }, espace: "direction" }), false);
});

test("porteSansPromo", () => {
  assert.equal(porteSansPromo([{ role: "siege" }, { role: "direction", lieu_id: 1 }]), "siege");
  assert.equal(porteSansPromo([{ role: "direction", lieu_id: 1 }]), "direction");
  assert.equal(porteSansPromo([{ role: "formateur", promo_id: 3 }]), null);
  assert.equal(porteSansPromo([]), null);
  assert.equal(porteSansPromo(null), null);
});

test("centreAffiche", () => {
  const aff = [dir(1), dir(3)];
  assert.deepEqual(centreAffiche({ promo: promoDuLieu(3, []), affectations: aff }), { id: 3, nom: "Centre 3" });
  assert.deepEqual(centreAffiche({ promo: promoDuLieu(2, []), affectations: aff }), { id: 1, nom: "Centre 1" });
  assert.deepEqual(centreAffiche({ promo: promoDuLieu(4, []), affectations: [], apercu: "direction" }), { id: 4, nom: "Centre 4" });
  assert.deepEqual(centreAffiche({ promo: null, affectations: aff }), { id: 1, nom: "Centre 1" });
  assert.equal(centreAffiche({ promo: promoDuLieu(1, []), affectations: [siege] }), null);
  assert.equal(centreAffiche({ promo: null, affectations: null }), null);
});

test("promoPourLaDirection", () => {
  const aff = [dir(1)];
  const aujourdhui = "2026-11-09";
  const p = (id, lieu, debut, fin) => ({ id, lieu_id: lieu, date_debut: debut, date_fin: fin });
  const promos = [p(20, 1, "2025-01-10", "2025-06-30"), p(21, 1, "2026-09-01", "2027-03-01"), p(30, 2, "2026-09-01", null)];
  assert.equal(promoPourLaDirection({ promo: promos[0], promos, affectations: aff, aujourdhui }), null);
  assert.equal(promoPourLaDirection({ promo: promos[2], promos, affectations: aff, aujourdhui }), 21);
  const terminees = [p(20, 1, "2024-01-10", "2024-06-30"), p(22, 1, "2025-01-10", "2025-06-30"), p(30, 2, "2026-09-01", null)];
  assert.equal(promoPourLaDirection({ promo: terminees[2], promos: terminees, affectations: aff, aujourdhui }), 22);
  assert.equal(promoPourLaDirection({ promo: promos[2], promos: [promos[2]], affectations: aff, aujourdhui }), null);
  assert.equal(promoPourLaDirection({ promo: promos[2], promos, affectations: [], aujourdhui }), null);
});

test("promosDuCentre", () => {
  const promos = [{ id: 1, lieu_id: 1 }, { id: 2, lieu_id: 2 }, { id: 3, lieu_id: 1 }];
  assert.deepEqual(promosDuCentre(promos, 1).map((x) => x.id), [1, 3]);
  assert.deepEqual(promosDuCentre(null, 1), []);
});

test("routeDansLEspace : tableau des routes par espace", () => {
  const direction = ["centre", "promos", "stagiaires", "emargement", "notes", "equipe", "config", "home", "nouveautes", "preferences", "problemes"];
  const siege = ["reseau", "directions", "themes", "config", "home", "nouveautes", "preferences", "problemes"];
  const toutes = ["centre", "promos", "stagiaires", "emargement", "notes", "equipe", "reseau", "directions", "themes", "planning",
    "config", "home", "nouveautes", "preferences", "problemes", "mon-suivi", "calendrier", "dashboard", "ccp2", "qualiopi", "ressources"];
  for (const r of toutes) {
    assert.equal(routeDansLEspace("direction", r), direction.includes(r), "direction " + r);
    assert.equal(routeDansLEspace("siege", r), siege.includes(r), "siège " + r);
    const neuves = ["promos", "equipe", "reseau", "directions"].includes(r);
    assert.equal(routeDansLEspace("equipe", r), !neuves, "formateur " + r);
    assert.equal(routeDansLEspace("stagiaire", r), !neuves, "stagiaire " + r);
  }
  assert.equal(phraseHorsEspace("direction"), "Cette page n'est pas dans l'espace Direction.");
  assert.equal(phraseHorsEspace("siege"), "Cette page n'est pas dans l'espace Siège.");
});

test("phraseDeRefus", () => {
  for (const [pre, texte] of [["equipe", "Réservé à la direction du centre."], ["promo", "Cette promo n'est pas dans ton centre."],
    ["centre", "Le nom est requis."], ["reseau", "Réservé au siège."], ["invitation", "Ce compte est déjà lié."], ["habillage", "Choix inconnu."]]) {
    assert.equal(phraseDeRefus(`${pre}: ${texte}`, "42501"), texte);
  }
  const indispo = "Cette action n'est pas encore disponible.";
  assert.equal(phraseDeRefus("anything", "PGRST202"), indispo);
  assert.equal(phraseDeRefus("Could not find the function public.creer_centre(p_nom) in the schema cache"), indispo);
  assert.equal(phraseDeRefus("permission denied for table affectations", "42501"), "Vous n'avez pas le droit de faire cela ici.");
  assert.equal(phraseDeRefus("", undefined), "L'opération n'a pas abouti.");
  assert.equal(phraseDeRefus(null, null), "L'opération n'a pas abouti.");
  // Réseau coupé (Chrome, Safari, Firefox) et session expirée : une phrase en français, jamais le texte technique.
  const connexion = "La connexion a échoué. Vérifier le réseau, puis réessayer.";
  assert.equal(phraseDeRefus("TypeError: Failed to fetch"), connexion);
  assert.equal(phraseDeRefus("Load failed"), connexion);
  assert.equal(phraseDeRefus("NetworkError when attempting to fetch resource."), connexion);
  assert.equal(phraseDeRefus("JWT expired", "PGRST301"), "Votre session a expiré. Reconnectez-vous, puis réessayez.");
  assert.equal(phraseDeRefus("Délai dépassé (15 s). Réseau lent : réessayez dans un instant."), "Délai dépassé (15 s). Réseau lent : réessayez dans un instant.", "une phrase de l'app passe telle quelle");
});

test("messageInvitation délègue à phraseDeRefus", () => {
  assert.equal(messageInvitation("invitation: refus", "P0001"), "refus");
});

test("adresseApresBascule", () => {
  assert.equal(adresseApresBascule("#/stagiaires/12/notes"), "#/stagiaires/12/notes");
  assert.equal(adresseApresBascule("#/stagiaires/12"), "#/stagiaires/12");
  assert.equal(adresseApresBascule("#/emargement"), "#/emargement");
  assert.equal(adresseApresBascule("javascript:alert(1)"), null);
  assert.equal(adresseApresBascule("#/inconnue"), null);
  assert.equal(adresseApresBascule("https://exemple.invalid/#/centre"), null);
  assert.equal(adresseApresBascule(null), null);
  assert.equal(adresseApresBascule(""), null);
});

// ----- Task 2 : porte, espace courant -----

test("normaliserAffectations : rôle connu, nom du lieu joint", () => {
  const lieux = [{ id: 1, nom: "Nîmes" }, { id: 3, nom: "Alès" }];
  assert.deepEqual(normaliserAffectations([
    { role: "direction", promo_id: null, lieu_id: 1, email: "direction@exemple.invalid" },
    { role: "formateur", promo_id: 7, lieu_id: null },
    { role: "siege", promo_id: null, lieu_id: null },
  ], lieux), [
    { role: "direction", promo_id: null, lieu_id: 1, lieu_nom: "Nîmes" },
    { role: "formateur", promo_id: 7, lieu_id: null, lieu_nom: null },
    { role: "siege", promo_id: null, lieu_id: null, lieu_nom: null },
  ]);
  // Lieu absent de la liste lue, ou liste illisible : nom nul, ligne gardée.
  assert.deepEqual(normaliserAffectations([{ role: "direction", lieu_id: 2 }], lieux),
    [{ role: "direction", promo_id: null, lieu_id: 2, lieu_nom: null }]);
  assert.deepEqual(normaliserAffectations([{ role: "direction", lieu_id: 1 }], null),
    [{ role: "direction", promo_id: null, lieu_id: 1, lieu_nom: null }]);
  // Lignes nulles ou vides.
  assert.deepEqual(normaliserAffectations(null, lieux), []);
  assert.deepEqual(normaliserAffectations(undefined, lieux), []);
  assert.deepEqual(normaliserAffectations([], lieux), []);
  // Rôle inconnu (ou ligne illisible) : écartée.
  assert.deepEqual(normaliserAffectations([{ role: "admin", lieu_id: 1 }, null, { role: "direction", lieu_id: 1 }], lieux)
    .map((a) => a.role), ["direction"]);
});

test("affectationsDeSecours : direction et siège lus dans les rôles des promos quand la table est illisible", () => {
  const promos = [
    { id: 1, lieu_id: 1, lieu_nom: "Nîmes", roles: ["direction", "formateur"] },
    { id: 2, lieu_id: 1, lieu_nom: "Nîmes", roles: ["direction"] },
    { id: 3, lieu_id: 2, lieu_nom: "Montpellier", roles: ["formateur"] },
  ];
  assert.deepEqual(affectationsDeSecours(promos), [{ role: "direction", promo_id: null, lieu_id: 1, lieu_nom: "Nîmes" }]);
  assert.deepEqual(affectationsDeSecours([{ id: 4, lieu_id: 2, lieu_nom: "Montpellier", roles: ["siege"] }]),
    [{ role: "siege", promo_id: null, lieu_id: null, lieu_nom: null }]);
  assert.deepEqual(affectationsDeSecours([{ id: 1, lieu_id: 1 }]), [], "base pas migrée : aucune colonne roles");
  assert.deepEqual(affectationsDeSecours(null), []);
});

test("espacesDuCompte : le menu Espace d'une direction garde la promo où elle forme", () => {
  const lieu1 = promoDuLieu(1, ["direction"]);
  const lieu2 = promoDuLieu(2, ["formateur"]);
  const promos = [lieu1, lieu2];
  // Direction du lieu 1 et formatrice au lieu 2 : les deux espaces, quelle que soit la promo affichée.
  assert.deepEqual(espacesDuCompte({ profil: formateur, promo: lieu1, promos, affectations: [dir(1)] }), ["direction", "equipe"]);
  assert.deepEqual(espacesDuCompte({ profil: formateur, promo: lieu2, promos, affectations: [dir(1)] }), ["direction", "equipe"]);
  // Direction seule : un seul espace.
  assert.deepEqual(espacesDuCompte({ profil: formateur, promo: lieu1, promos: [lieu1], affectations: [dir(1)] }), ["direction"]);
  // Cumul du lot 4, sans direction ni siège : l'espace suit la promo affichée, comme avant.
  const cumul = [promoDuLieu(1, ["stagiaire"]), promoDuLieu(2, ["formateur"])];
  assert.deepEqual(espacesDuCompte({ profil: stagiaire, promo: cumul[0], promos: cumul, affectations: [] }), ["stagiaire"]);
  assert.deepEqual(espacesDuCompte({ profil: stagiaire, promo: cumul[1], promos: cumul, affectations: [] }), ["equipe"]);
  // Fondateur en aperçu : l'aperçu seul.
  assert.deepEqual(espacesDuCompte({ profil: fondateur, promo: lieu2, promos, affectations: [], apercu: "direction" }), ["direction"]);
  assert.deepEqual(espacesDuCompte({ profil: fondateur, promo: lieu2, promos, affectations: [] }), ["equipe"]);
  // Siège sans promo ; siège qui forme aussi.
  assert.deepEqual(espacesDuCompte({ profil: formateur, promo: null, promos: [], affectations: [siege] }), ["siege"]);
  assert.deepEqual(espacesDuCompte({ profil: formateur, promo: null, promos: [lieu2], affectations: [siege] }), ["siege", "equipe"]);
  assert.deepEqual(espacesDuCompte({ profil: null }), []);
});

test("promoPourLEspace : la promo où l'espace choisi existe", () => {
  const aujourdhui = "2026-11-09";
  const p = (id, roles, debut, fin) => ({ id, lieu_id: id, roles, date_debut: debut, date_fin: fin });
  const promos = [p(1, ["direction"], "2026-03-30", "2026-12-11"), p(2, ["formateur"], "2025-01-01", "2025-06-30"),
    p(3, ["formateur"], "2026-09-30", null), p(4, ["stagiaire"], "2024-01-01", "2024-06-30")];
  assert.equal(promoPourLEspace({ espace: "equipe", promo: promos[0], promos, aujourdhui }), 3, "la promo en cours d'abord");
  assert.equal(promoPourLEspace({ espace: "equipe", promo: promos[1], promos, aujourdhui }), null, "déjà formateur de la promo affichée");
  assert.equal(promoPourLEspace({ espace: "stagiaire", promo: promos[0], promos, aujourdhui }), 4, "aucune en cours : la plus récente");
  assert.equal(promoPourLEspace({ espace: "equipe", promo: promos[0], promos: [promos[0]], aujourdhui }), null, "aucune promo");
  assert.equal(promoPourLEspace({ espace: "direction", promo: promos[2], promos, aujourdhui }), null, "direction : la porte s'en charge (D6)");
  assert.equal(promoPourLEspace({ espace: "siege", promo: promos[2], promos, aujourdhui }), null);
  assert.equal(promoPourLEspace({ espace: "equipe", promo: null, promos, aujourdhui }), 3, "sans promo affichée");
});

test("cleDerniereRoute : une mémoire par espace ; celle de main pour le stagiaire et le formateur", () => {
  assert.equal(cleDerniereRoute("stagiaire"), "derniere-route");
  assert.equal(cleDerniereRoute("equipe"), "derniere-route");
  assert.equal(cleDerniereRoute("direction"), "derniere-route:direction");
  assert.equal(cleDerniereRoute("siege"), "derniere-route:siege");
  assert.equal(cleDerniereRoute(null), "derniere-route");
});

test("espaceDePilotage : la direction et le siège", () => {
  assert.deepEqual(ESPACES.map(espaceDePilotage), [false, false, true, true]);
  assert.equal(espaceDePilotage(null), false);
});

test("promosVisiblesEnApercu : la liste des promos que charge l'app, selon l'aperçu (D3)", () => {
  const promos = [
    { id: 1, lieu_id: 1, lieu_nom: "Nîmes" }, { id: 2, lieu_id: 1, lieu_nom: "Nîmes" },
    { id: 3, lieu_id: 2, lieu_nom: "Montpellier" }, { id: 7, lieu_id: 4, lieu_nom: "Démonstration" },
  ];
  const ids = (apercu, promo) => promosVisiblesEnApercu({ promos, promo, apercu }).map((p) => p.id);
  // Direction : seules les promos du centre de la promo affichée.
  assert.deepEqual(ids("direction", promos[0]), [1, 2]);
  assert.deepEqual(ids("direction", promos[3]), [7]);
  assert.deepEqual(ids("direction", promos[2]), [3]);
  // Siège : aucune promo.
  assert.deepEqual(ids("siege", promos[0]), []);
  assert.deepEqual(ids("siege", null), []);
  // Hors aperçu, formateur, stagiaire, valeur inconnue : toutes, dans leur ordre.
  for (const a of [null, undefined, "", "formateur", "stagiaire", "admin", "n'importe quoi"]) {
    assert.deepEqual(ids(a, promos[0]), [1, 2, 3, 7], String(a));
  }
  // Direction sans promo affichée : rien ; promo affichée sans centre : elle seule (jamais une autre promo sans centre).
  assert.deepEqual(ids("direction", null), []);
  const sansCentre = { id: 9, lieu_id: null };
  assert.deepEqual(promosVisiblesEnApercu({ promos: [...promos, sansCentre, { id: 10, lieu_id: null }], promo: sansCentre, apercu: "direction" }).map((p) => p.id), [9]);
  // Liste illisible : jamais d'exception, liste vide. Pas de mutation de la liste d'origine.
  assert.deepEqual(promosVisiblesEnApercu({ promos: null, promo: null, apercu: null }), []);
  assert.deepEqual(promosVisiblesEnApercu(), []);
  const avant = JSON.stringify(promos);
  ids("direction", promos[0]);
  assert.equal(JSON.stringify(promos), avant);
});

test("texteBandeauApercu : ce que dit le bandeau d'aperçu (les modifications d'un aperçu sont réelles)", () => {
  const reel = "Ce que vous modifiez ici est vraiment enregistré.";
  assert.deepEqual(texteBandeauApercu("direction", { id: 1, nom: "Nîmes" }), { libelle: "Direction du centre Nîmes", suite: reel });
  assert.deepEqual(texteBandeauApercu("direction", null), { libelle: "Direction", suite: reel });
  assert.deepEqual(texteBandeauApercu("direction", { id: 1, nom: null }), { libelle: "Direction", suite: reel });
  assert.deepEqual(texteBandeauApercu("siege", { id: 1, nom: "Nîmes" }), { libelle: "Siège du réseau", suite: reel });
  // Formateur et stagiaire : le libellé du lot 4, sans phrase de plus.
  assert.deepEqual(texteBandeauApercu("formateur", null), { libelle: "Formateur", suite: "" });
  assert.deepEqual(texteBandeauApercu("stagiaire", null), { libelle: "Stagiaire", suite: "" });
  // Valeur inconnue : rendue telle quelle, comme l'ancien bandeau.
  assert.deepEqual(texteBandeauApercu("autre", null), { libelle: "autre", suite: "" });
});

// === Sous-onglets de Cours et QCM (lot 5, Task 13) ===
import { sousOngletsCours } from "../js/espaces-rules.js";

test("sousOngletsCours : siège, stagiaire, formateur (liste d'aujourd'hui), direction", () => {
  assert.deepEqual(sousOngletsCours("siege"), ["themes", "competences", "qcm", "documents"]);
  assert.deepEqual(sousOngletsCours("stagiaire"), ["themes", "competences", "qcm", "documents"]);
  assert.deepEqual(sousOngletsCours("equipe"), ["themes", "competences", "signalements", "ia", "documents"]);
  assert.deepEqual(sousOngletsCours("direction"), [], "la direction n'a pas la page (D15)");
  assert.deepEqual(sousOngletsCours(undefined), []);
});

test("litToutesLesNotes : le formateur et la direction lisent les profils masqués, ni le stagiaire ni le siège", () => {
  assert.equal(litToutesLesNotes({ admin: true, espace: "equipe" }), true, "formateur de la promo");
  assert.equal(litToutesLesNotes({ admin: false, espace: "direction" }), true, "direction du centre (décision du 09/11)");
  assert.equal(litToutesLesNotes({ admin: false, espace: "stagiaire" }), false, "stagiaire");
  assert.equal(litToutesLesNotes({ admin: false, espace: "siege" }), false, "siège : aucune note de promo");
  assert.equal(litToutesLesNotes({ admin: false, espace: "equipe" }), false, "sans droit sur la promo");
  assert.equal(litToutesLesNotes(), false, "rien de connu");
});

test("defautsHabillage : ligne absente ou illisible, valeurs inconnues, libre absent", () => {
  const nul = { centre: null, reseau: null, libre: true };
  for (const ligne of [null, undefined, "ecf", 3, [], {}]) assert.deepEqual(defautsHabillage(ligne), nul);
  assert.deepEqual(defautsHabillage({ centre: "ecf", reseau: "ecsr", libre: false }), { centre: "ecf", reseau: "ecsr", libre: false });
  // Une valeur hors ecsr et ecf devient nulle, la casse n'est pas devinée.
  assert.deepEqual(defautsHabillage({ centre: "rose", reseau: "ECF", libre: true }), nul);
  assert.deepEqual(defautsHabillage({ centre: 1, reseau: false }), nul);
  // libre n'est faux que si la base le dit explicitement : nul, absent, 0 ou "false" laissent le choix.
  for (const libre of [undefined, null, 0, "false", ""]) assert.equal(defautsHabillage({ centre: "ecf", libre }).libre, true, String(libre));
  assert.equal(defautsHabillage({ libre: false }).libre, false);
  // Une ligne qui a d'autres champs ne les recopie pas.
  assert.deepEqual(Object.keys(defautsHabillage({ centre: "ecf", autre: 1 })).sort(), ["centre", "libre", "reseau"]);
});

test("decisionPorteSansPromo : lu et vide, raté à l'ouverture, raté en cours de session", () => {
  const siege = [{ role: "siege" }];
  const direction = [{ role: "direction", lieu_id: 1 }];
  // Lu : les affectations décident (le refus d'un compte sans porte est conservé).
  assert.equal(decisionPorteSansPromo({ lecture: "lue", affectations: siege, sessionOuverte: false }), "entrer");
  assert.equal(decisionPorteSansPromo({ lecture: "lue", affectations: direction, sessionOuverte: false }), "entrer");
  assert.equal(decisionPorteSansPromo({ lecture: "lue", affectations: [], sessionOuverte: false }), "refuser", "lu et vide : refus");
  assert.equal(decisionPorteSansPromo({ lecture: "lue", affectations: [{ role: "formateur", promo_id: 3 }], sessionOuverte: false }), "refuser");
  // Lu et vide en cours de session : le refus reste (les affectations ont vraiment été retirées).
  assert.equal(decisionPorteSansPromo({ lecture: "lue", affectations: [], sessionOuverte: true }), "refuser");
  // Raté à l'ouverture : jamais le refus de la porte, on propose de réessayer, quelles que soient les affectations de repli.
  assert.equal(decisionPorteSansPromo({ lecture: "ratee", affectations: [], sessionOuverte: false }), "reessayer");
  assert.equal(decisionPorteSansPromo({ lecture: "ratee", affectations: siege, sessionOuverte: false }), "reessayer");
  // Raté en cours de session : on garde l'espace en place, sans refus ni message.
  assert.equal(decisionPorteSansPromo({ lecture: "ratee", affectations: siege, sessionOuverte: true }), "entrer");
  assert.equal(decisionPorteSansPromo({ lecture: "ratee", affectations: [], sessionOuverte: true }), "entrer");
  // Sans argument : rien d'affirmé, donc refus d'un compte sans porte (pas d'exception).
  assert.equal(decisionPorteSansPromo(), "refuser");
});
