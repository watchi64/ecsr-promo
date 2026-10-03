// Adresses à segments (chantier D, lot 2) : lecture, construction, liens « Où le
// trouver » et page « à soi ».
import assert from "node:assert/strict";
import { PARTIES, lireAdresse, adresseFiche, hrefLien, pagePersonnelle } from "../js/route-rules.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Lecture
eq(lireAdresse("#/stagiaires/12/epcf"), { route: "stagiaires", id: 12, partie: "epcf" }, "fiche et partie");
eq(lireAdresse("#/stagiaires/12"), { route: "stagiaires", id: 12, partie: null }, "fiche seule");
eq(lireAdresse("#/stagiaires"), { route: "stagiaires", id: null, partie: null }, "liste");
eq(lireAdresse("#/stagiaires/abc/epcf"), { route: "stagiaires", id: null, partie: null }, "id invalide : la liste");
eq(lireAdresse("#/stagiaires/0"), { route: "stagiaires", id: null, partie: null }, "id nul refusé");
eq(lireAdresse("#/stagiaires/12/xyz"), { route: "stagiaires", id: 12, partie: null }, "partie inconnue ignorée");
eq(lireAdresse("#/stagiaires/12/"), { route: "stagiaires", id: 12, partie: null }, "barre finale tolérée");
eq(lireAdresse("#/mon-suivi/dp"), { route: "mon-suivi", id: null, partie: "dp" }, "Mon espace, partie");
eq(lireAdresse("#/mon-suivi"), { route: "mon-suivi", id: null, partie: null }, "Mon espace");
eq(lireAdresse("#/mon-suivi/12"), { route: "mon-suivi", id: null, partie: null }, "Mon espace n'a pas d'id");
eq(lireAdresse("#/notes"), { route: "notes", id: null, partie: null }, "autre page");
eq(lireAdresse("#/notes/livret"), { route: "notes", id: null, partie: null }, "autre page : la suite est ignorée");
eq(lireAdresse(""), { route: "", id: null, partie: null }, "adresse vide");
eq(lireAdresse(undefined), { route: "", id: null, partie: null }, "adresse absente");

// 2. Construction
eq(adresseFiche("stagiaires", 12, "epcf"), "#/stagiaires/12/epcf", "fiche et partie");
eq(adresseFiche("stagiaires", 12, null), "#/stagiaires/12", "fiche");
eq(adresseFiche("stagiaires", null, "epcf"), "#/stagiaires", "pas de partie sans fiche");
eq(adresseFiche("mon-suivi", null, "livret"), "#/mon-suivi/livret", "Mon espace, partie");
eq(adresseFiche("mon-suivi", null, null), "#/mon-suivi", "Mon espace");
for (const p of PARTIES) eq(lireAdresse(adresseFiche("stagiaires", 7, p)).partie, p, "aller-retour : " + p);

// 3. Liens « Où le trouver »
eq(hrefLien({ route: "mon-suivi", sousOnglet: "dp" }), "#/mon-suivi/dp", "partie de Mon espace par l'adresse");
eq(hrefLien({ route: "mon-suivi", sousOnglet: "inconnu" }), "#/mon-suivi", "partie inconnue : la page");
eq(hrefLien({ route: "mon-suivi" }), "#/mon-suivi", "Mon espace sans partie");
eq(hrefLien({ route: "notes", sousOnglet: "epcf" }), "#/notes", "Notes : la mémoire des sous-onglets s'en charge");
eq(hrefLien({ route: "stagiaires" }), "#/stagiaires", "page Stagiaires");

// 4. Page « à soi »
eq(pagePersonnelle({ formateur: true, stagiaireId: null }), "stagiaires", "formateur sans profil stagiaire");
eq(pagePersonnelle({ formateur: true, stagiaireId: 3 }), "mon-suivi", "stagiaire et admin");
eq(pagePersonnelle({ formateur: false, stagiaireId: 3 }), "mon-suivi", "stagiaire");
eq(pagePersonnelle({ formateur: false, stagiaireId: null }), "mon-suivi", "compte sans profil : Mon espace l'explique");

eq(PARTIES, ["passages", "epcf", "evolution", "livret", "dp"], "parties dans l'ordre de la fiche");

console.log(`route-rules : ${n} assertions OK`);
