// Navigation par espace (refonte, lot 1) : entrées de chaque espace, barre du téléphone,
// entrée allumée, redirection des anciennes adresses et listes rendues en copies.
import assert from "node:assert/strict";
import { espaceDe, entreesNavigation, barreTelephone, entreeActive, redirectionV2 } from "../js/nav-rules.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const tout = () => true;
const ids = (l) => l.map((e) => e.id);
const adresse = (route) => ({ route, id: null, partie: null });

// 1. Espace de la personne
eq(espaceDe({ formateur: false }), "stagiaire", "stagiaire");
eq(espaceDe({ formateur: true }), "equipe", "formateur ou admin");

// 2. Entrées de chaque espace
const stag = entreesNavigation("stagiaire", { routeVisible: tout, emargementActif: false });
const eqp = entreesNavigation("equipe", { routeVisible: () => false, emargementActif: true });
eq(ids(stag), ["home", "planning", "themes", "mon-suivi", "ccp2"], "5 onglets stagiaire");
eq(ids(entreesNavigation("stagiaire", { routeVisible: (r) => r !== "ccp2", emargementActif: false })),
  ["home", "planning", "themes", "mon-suivi"], "CCP2 fermé : pas de case vide");
eq(ids(entreesNavigation("stagiaire", { routeVisible: () => false, emargementActif: false })),
  ["home", "mon-suivi"], "Accueil et Mon suivi restent toujours");
eq(stag.map((e) => [e.libelle, e.icone]),
  [["Accueil", "home"], ["Planning", "calendar"], ["Cours et QCM", "book"], ["Mon suivi", "trend"], ["CCP2", "target"]],
  "libellés et icônes du stagiaire");
eq(ids(eqp), ["home", "planning", "emargement", "stagiaires", "notes", "themes", "ccp2", "centre", "config"],
  "équipe : rien retiré par les modules");
eq(eqp.map((e) => [e.libelle, e.icone]),
  [["Accueil", "home"], ["Planning", "calendar"], ["Émargement", "clipboard"], ["Stagiaires", "users"],
    ["Notes et examens", "edu"], ["Cours et QCM", "book"], ["CCP2", "target"], ["Indicateurs", "chart"],
    ["Réglages", "settings"]],
  "libellés et icônes de l'équipe");
eq(eqp.find((e) => e.id === "centre").groupe, "Promo", "groupe Promo");
eq(eqp.filter((e) => e.groupe).map((e) => e.id), ["centre", "config"], "groupe Promo : Indicateurs et Réglages");
eq(ids(entreesNavigation("equipe", { routeVisible: tout, emargementActif: false })).includes("emargement"), false,
  "émargement éteint");
eq(eqp.find((e) => e.id === "notes").court, "Notes", "libellé court de Notes");

// 3. Barre du téléphone
eq(ids(barreTelephone("equipe", eqp).barre), ["home", "planning", "stagiaires", "notes"], "barre équipe");
eq(ids(barreTelephone("equipe", eqp).plus), ["emargement", "themes", "ccp2", "centre", "config"], "Plus");
eq(barreTelephone("stagiaire", stag).plus, [], "stagiaire sans Plus");
eq(barreTelephone("stagiaire", stag).barre.map((e) => e.court),
  ["Accueil", "Planning", "Cours et QCM", "Mon suivi", "CCP2"], "barre stagiaire : cinq cases nommées");

// 4. Entrée allumée
eq(entreeActive("planning", eqp), "planning", "entrée propre, équipe");
eq(entreeActive("themes", stag), "themes", "entrée propre, stagiaire");
eq(entreeActive("calendrier", eqp), "planning", "alias calendrier");
eq(entreeActive("dashboard", eqp), "planning", "alias dashboard");
eq(entreeActive("ressources", eqp), "themes", "alias ressources");
eq(entreeActive("nouveautes", eqp), "home", "alias nouveautes");
eq(entreeActive("notes", stag), "mon-suivi", "stagiaire : la classe vit sous Mon suivi");
eq(entreeActive("notes", eqp), "notes", "équipe : Notes a son entrée");
eq(entreeActive("mon-suivi", eqp), null, "équipe : Mon espace sans entrée");
const sansPlanning = entreesNavigation("stagiaire", { routeVisible: (r) => r !== "planning", emargementActif: false });
eq(entreeActive("calendrier", sansPlanning), null, "alias vers un module fermé");

// 5. Redirection des anciennes adresses
eq(redirectionV2(adresse("calendrier"), "stagiaire"),
  { hash: "#/planning", sousOnglet: { cle: "planning.subtab", valeur: "dates" } }, "calendrier");
eq(redirectionV2(adresse("dashboard"), "equipe"),
  { hash: "#/planning", sousOnglet: { cle: "planning.subtab", valeur: "priorites" } }, "dashboard");
eq(redirectionV2(adresse("ressources"), "stagiaire"),
  { hash: "#/themes", sousOnglet: { cle: "themes.subtab", valeur: "documents" } }, "ressources");
eq(redirectionV2(adresse("notes"), "stagiaire"),
  { hash: "#/mon-suivi/classe", sousOnglet: null }, "notes du stagiaire");
eq(redirectionV2(adresse("notes"), "equipe"), null, "notes de l'équipe inchangées");
eq(redirectionV2(adresse("planning"), "stagiaire"), null, "pas de boucle");

// 6. Copies : modifier ce que le module rend ne change pas le résultat suivant
const options = { routeVisible: tout, emargementActif: true };
for (const espace of ["stagiaire", "equipe"]) {
  const liste = entreesNavigation(espace, options);
  const intacte = liste.map((e) => ({ ...e }));
  liste[0].decore = true;
  liste.pop();
  eq(entreesNavigation(espace, options), intacte, "liste et entrées rendues : copies, " + espace);
}
const entrees = entreesNavigation("stagiaire", options);
const ordre = ids(entrees);
barreTelephone("stagiaire", entrees).barre.pop();
eq(ids(entrees), ordre, "barre du stagiaire : copie de la liste");

console.log(`nav-rules : ${n} assertions OK`);
