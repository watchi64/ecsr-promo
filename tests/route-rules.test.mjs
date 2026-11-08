// Adresses à segments (chantier D, lot 2) : lecture, construction, liens « Où le
// trouver » et page « à soi ».
import assert from "node:assert/strict";
import {
  PARTIES, lireAdresse, adresseFiche, hrefLien, pagePersonnelle, partiesDeLaFiche, ouvertureDeMonSuivi, vueDeResultats,
  VUES_RESULTATS, CLE_VUE_RESULTATS,
} from "../js/route-rules.js";

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
eq(lireAdresse("#/mon-suivi/classe"), { route: "mon-suivi", id: null, partie: "classe" }, "Mon espace, la classe (nouvelle navigation)");
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
eq(adresseFiche("mon-suivi", null, "classe"), "#/mon-suivi/classe", "Mon espace, la classe : une adresse d'avant, toujours lisible");
eq(lireAdresse("#/mon-suivi/resultats"), { route: "mon-suivi", id: null, partie: "resultats" }, "Mon suivi, Résultats (nouvelle navigation)");
eq(adresseFiche("mon-suivi", null, "resultats"), "#/mon-suivi/resultats", "Mon suivi, Résultats : l'adresse des redirections de #/notes");
eq(lireAdresse("#/mon-suivi/evolution"), { route: "mon-suivi", id: null, partie: "evolution" }, "Mon espace, Évolution : une adresse d'avant, toujours lisible");
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

eq(PARTIES, ["resultats", "passages", "epcf", "evolution", "livret", "dp", "classe"], "toutes les parties connues d'une adresse");

// 5. Parties d'une fiche, dans l'ordre d'affichage (lot 2B, tâche 7). Mon suivi sous la nouvelle navigation : Résultats
// d'abord, qui réunit Évolution (« Moi ») et La classe. Ailleurs (fiche d'un stagiaire chez l'équipe, ancienne
// navigation), la fiche de main.
eq(partiesDeLaFiche({ soi: true, navigationV2: true }), ["resultats", "passages", "epcf", "livret", "dp"], "Mon suivi, nouvelle navigation");
eq(partiesDeLaFiche({ soi: true, navigationV2: false }), ["passages", "epcf", "evolution", "livret", "dp"], "Mon espace, ancienne navigation : inchangé");
eq(partiesDeLaFiche({ soi: false, navigationV2: true }), ["passages", "epcf", "evolution", "livret", "dp"], "fiche d'un stagiaire chez l'équipe, nouvelle navigation : inchangée");
eq(partiesDeLaFiche({ soi: false, navigationV2: false }), ["passages", "epcf", "evolution", "livret", "dp"], "fiche d'un stagiaire chez l'équipe, ancienne navigation");
eq(partiesDeLaFiche(), ["passages", "epcf", "evolution", "livret", "dp"], "sans option : la fiche de main");
eq(partiesDeLaFiche({ soi: true, navigationV2: true }) === partiesDeLaFiche({ soi: true, navigationV2: true }), false, "une copie à chaque appel");
for (const opts of [{ soi: true, navigationV2: true }, { soi: false, navigationV2: false }]) {
  for (const p of partiesDeLaFiche(opts)) eq(PARTIES.includes(p), true, "partie connue des adresses : " + p);
}

// 6. Ouverture de Mon suivi sous la nouvelle navigation : les adresses d'Évolution et de La classe ouvrent Résultats sur la bonne vue.
eq(VUES_RESULTATS, ["moi", "classe"], "deux vues : Moi, La classe");
eq(CLE_VUE_RESULTATS, "ecsr_resultats_vue", "clé de mémoire de la vue");
eq(ouvertureDeMonSuivi("evolution"), { partie: "resultats", vue: "moi" }, "#/mon-suivi/evolution : Résultats, Moi");
eq(ouvertureDeMonSuivi("classe"), { partie: "resultats", vue: "classe" }, "#/mon-suivi/classe : Résultats, La classe");
eq(ouvertureDeMonSuivi("resultats"), { partie: "resultats", vue: null }, "#/mon-suivi/resultats : la vue mémorisée");
eq(ouvertureDeMonSuivi("dp"), { partie: "dp", vue: null }, "une autre partie ne bouge pas");
eq(ouvertureDeMonSuivi(null), { partie: null, vue: null }, "pas de partie : le sommaire ou le premier onglet");
eq(vueDeResultats("classe"), "classe", "vue mémorisée : La classe");
eq(vueDeResultats("moi"), "moi", "vue mémorisée : Moi");
eq(vueDeResultats(null), "moi", "rien de mémorisé : Moi");
eq(vueDeResultats("constructor"), "moi", "mémoire illisible : Moi");

console.log(`route-rules : ${n} assertions OK`);
