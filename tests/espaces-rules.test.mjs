// Règles des espaces (lot 5) : espaces permis, choix, bride des droits, porte sans promo, centre affiché,
// bascule vers une promo du centre, routes par espace, phrases de refus.
// Lancer : node --test tests/espaces-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESPACES, LIBELLES_ESPACE, ACCUEIL_ESPACE, barreLaterale, espacesPermis, espaceChoisi, brider, peutRedigerContenus,
  porteSansPromo, centreAffiche, promoPourLaDirection, promosDuCentre, routeDansLEspace, phraseHorsEspace,
  phraseDeRefus, adresseApresBascule,
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
  assert.equal(phraseDeRefus("permission denied for table affectations", "42501"), "Tu n'as pas le droit de faire cela ici.");
  assert.equal(phraseDeRefus("", undefined), "L'opération n'a pas abouti.");
  assert.equal(phraseDeRefus(null, null), "L'opération n'a pas abouti.");
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
