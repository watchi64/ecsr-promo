// Navigation par espace (refonte, lot 1) : entrées de chaque espace, barre du téléphone,
// entrée allumée et redirection des anciennes adresses.
import assert from "node:assert/strict";
import { espaceDe, entreesNavigation, barreTelephone, entreeActive, redirectionV2 } from "../js/nav-rules.js";
let n = 0; const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const tout = () => true;
const ids = (l) => l.map((e) => e.id);
eq(espaceDe({ formateur: false }), "stagiaire", "stagiaire");
eq(espaceDe({ formateur: true }), "equipe", "formateur ou admin");
eq(ids(entreesNavigation("stagiaire", { routeVisible: tout, emargementActif: false })), ["home", "planning", "themes", "mon-suivi", "ccp2"], "5 onglets stagiaire");
eq(ids(entreesNavigation("stagiaire", { routeVisible: (r) => r !== "ccp2", emargementActif: false })), ["home", "planning", "themes", "mon-suivi"], "CCP2 fermé : pas de case vide");
const eqp = entreesNavigation("equipe", { routeVisible: () => false, emargementActif: true });
eq(ids(eqp), ["home", "planning", "emargement", "stagiaires", "notes", "themes", "ccp2", "centre", "config"], "équipe : rien retiré par les modules");
eq(eqp.find((e) => e.id === "centre").groupe, "Promo", "groupe Promo");
eq(ids(entreesNavigation("equipe", { routeVisible: tout, emargementActif: false })).includes("emargement"), false, "émargement éteint");
eq(ids(barreTelephone("equipe", eqp).barre), ["home", "planning", "stagiaires", "notes"], "barre équipe");
eq(ids(barreTelephone("equipe", eqp).plus), ["emargement", "themes", "ccp2", "centre", "config"], "Plus");
eq(barreTelephone("stagiaire", entreesNavigation("stagiaire", { routeVisible: tout, emargementActif: false })).plus, [], "stagiaire sans Plus");
eq(entreeActive("calendrier", eqp), "planning", "alias calendrier");
eq(entreeActive("ressources", eqp), "themes", "alias ressources");
eq(entreeActive("mon-suivi", eqp), null, "équipe : Mon espace sans entrée");
eq(redirectionV2({ route: "calendrier", id: null, partie: null }, "stagiaire"), { hash: "#/planning", sousOnglet: { cle: "planning.subtab", valeur: "dates" } }, "calendrier");
eq(redirectionV2({ route: "notes", id: null, partie: null }, "stagiaire"), { hash: "#/mon-suivi/classe", sousOnglet: null }, "notes du stagiaire");
eq(redirectionV2({ route: "notes", id: null, partie: null }, "equipe"), null, "notes de l'équipe inchangées");
eq(redirectionV2({ route: "planning", id: null, partie: null }, "stagiaire"), null, "pas de boucle");
console.log(`nav-rules : ${n} assertions OK`);
