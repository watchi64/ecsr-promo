// Navigation par espace (refonte, lot 1) : entrées de chaque espace, barre du téléphone,
// entrée allumée, redirection des anciennes adresses, listes rendues en copies, initiales,
// prénom et nom du bouton du compte, repère de l'équipe, icônes des entrées et ligne « page à
// soi » du menu du compte.
import assert from "node:assert/strict";
import {
  espaceDe, entreesNavigation, barreTelephone, entreeActive, redirectionV2, routeVisibleV2, initialesDe,
  prenomDe, entreeMasquee, libelleRole, nomDuBoutonCompte, pageASoiDuMenu, redirectionAncienne,
} from "../js/nav-rules.js";
import { pagePersonnelle } from "../js/route-rules.js";
import { MODULE_DE_ROUTE, ROUTES_SOCLE } from "../js/modules-data.js";
import { lireAdresse } from "../js/route-rules.js";
import { icon } from "../js/icons.js";

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
// Mes préférences (nouvelle navigation, lot 2A) s'ouvre par le menu du compte, pour tous : aucune entrée de la
// barre ne s'allume, pas même Réglages chez l'équipe (la promo) ni Mon suivi chez le stagiaire (la personne).
eq(entreeActive("preferences", eqp), null, "équipe : Mes préférences n'allume aucune entrée");
eq(entreeActive("preferences", stag), null, "stagiaire : Mes préférences n'allume aucune entrée");
const sansPlanning = entreesNavigation("stagiaire",
  { routeVisible: (r) => !["planning", "calendrier", "dashboard"].includes(r), emargementActif: false });
eq(entreeActive("calendrier", sansPlanning), null, "alias vers une page fermée (ses trois sous-onglets fermés)");
const semaineFermee = entreesNavigation("stagiaire", { routeVisible: (r) => r !== "planning", emargementActif: false });
eq(entreeActive("calendrier", semaineFermee), "planning", "Semaine fermée, Dates clés ouvert : Planning s'allume");

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
// Réglages (la promo) est la page de l'équipe : le stagiaire qui ouvre #/config (lien d'une Nouveauté, favori,
// pied de l'accueil) arrive sur ses préférences, la seule partie qui le concerne.
eq(redirectionV2(adresse("config"), "stagiaire"), { hash: "#/preferences", sousOnglet: null }, "réglages du stagiaire");
eq(redirectionV2(adresse("config"), "equipe"), null, "réglages de l'équipe inchangés");
eq(redirectionV2(adresse("preferences"), "stagiaire"), null, "préférences : pas de boucle, stagiaire");
eq(redirectionV2(adresse("preferences"), "equipe"), null, "préférences : pas de boucle, équipe");
eq(redirectionV2(adresse("planning"), "stagiaire"), null, "pas de boucle");
// navigate() (js/main.js) suit une seule redirection par adresse : pour toute route connue, aucune cible n'est
// elle-même redirigée, et une redirection vers un sous-onglet nomme sa clé de mémoire (sans clé, `undefined`
// s'écrirait sous la clé « undefined »).
const controlees = [];
for (const route of [...Object.keys(MODULE_DE_ROUTE), ...ROUTES_SOCLE]) {
  for (const espace of ["stagiaire", "equipe"]) {
    const cible = redirectionV2(adresse(route), espace);
    if (!cible) continue;
    controlees.push(`${route} (${espace})`);
    eq(redirectionV2(lireAdresse(cible.hash), espace), null, `la cible de ${route} (${espace}) n'est pas redirigée`);
    if (cible.sousOnglet) eq(typeof cible.sousOnglet.cle, "string", `clé de sous-onglet de ${route} (${espace})`);
  }
}
// Témoins positifs, pour que la boucle ne passe pas à vide : sans eux, `continue` pourrait sauter des routes,
// et le contrôle de la cible passerait aussi si lireAdresse ne rendait plus la route d'une adresse écrite en
// hash. Une ancienne adresse par cible distincte (#/planning, #/themes, #/mon-suivi/classe, #/preferences) doit donc être
// contrôlée par la boucle, et reconnue quand on la lit depuis son hash : c'est ce que le contrôle de la cible
// refuserait d'une cible.
for (const ancienne of ["calendrier", "ressources", "notes", "config"]) {
  eq(controlees.includes(`${ancienne} (stagiaire)`), true, `témoin : la boucle contrôle #/${ancienne} (stagiaire)`);
  eq(redirectionV2(lireAdresse("#/" + ancienne), "stagiaire") !== null, true,
    `témoin : lue depuis son hash, #/${ancienne} est reconnue comme ancienne adresse`);
}
// Ancienne navigation : Mes préférences n'existe qu'avec la nouvelle, et #/preferences (un favori pris sous la
// nouvelle, la promo éteinte depuis) mène aux Paramètres. Toute autre adresse reste celle de main : l'interrupteur
// éteint ne change rien, la table ne redirige que cette route.
eq(redirectionAncienne(adresse("preferences")), { hash: "#/config", sousOnglet: null }, "ancienne navigation : préférences vers Paramètres");
eq(redirectionAncienne(lireAdresse("#/config")), null, "la cible des préférences n'est pas redirigée : pas de boucle");
for (const route of [...Object.keys(MODULE_DE_ROUTE), ...ROUTES_SOCLE]) {
  eq(redirectionAncienne(adresse(route)), null, `ancienne navigation : #/${route} reste celle de main`);
}

// 6. Pages regroupées : ouvertes dès qu'un de leurs sous-onglets l'est
const seules = (...routes) => (r) => routes.includes(r);
eq(routeVisibleV2("themes", seules("themes")), true, "Cours : les cours ouverts");
eq(routeVisibleV2("themes", seules("ressources")), true, "Cours : les seuls Documents ouverts");
eq(routeVisibleV2("themes", seules()), false, "Cours : cours et documents fermés");
eq(routeVisibleV2("themes", seules("calendrier", "dashboard", "planning")), false, "Cours : les modules du Planning ne l'ouvrent pas");
eq(routeVisibleV2("planning", seules("planning")), true, "Planning : la semaine ouverte");
eq(routeVisibleV2("planning", seules("calendrier")), true, "Planning : les seules Dates clés ouvertes");
eq(routeVisibleV2("planning", seules("dashboard")), true, "Planning : les seules Priorités ouvertes (route dashboard)");
eq(routeVisibleV2("planning", seules("ressources", "themes")), false, "Planning : les modules de Cours ne l'ouvrent pas");
eq(routeVisibleV2("planning", seules()), false, "Planning : tout fermé");
eq(routeVisibleV2("ccp2", seules("planning", "themes", "ressources")), false, "page sans sous-onglets : sa route seule");
eq(routeVisibleV2("ccp2", seules("ccp2")), true, "page sans sous-onglets ouverte");
eq(routeVisibleV2("calendrier", seules("planning")), false, "ancienne page : sa route seule");
eq(routeVisibleV2("ressources", seules("ressources")), true, "ancienne page ouverte");
eq(routeVisibleV2("constructor", seules()), false, "route inconnue de la table : fermée si routeVisible le dit");
// Ensemble de départ d'une promo (banc ?modules=depart) : Planning, Calendrier et Ressources
// ouverts, Cours fermé. Même calcul que routeVisible côté app, pour un stagiaire.
const OUVERTS_DEPART = ["planning", "calendrier", "ressources"];
const depart = (r) => !MODULE_DE_ROUTE[r] || OUVERTS_DEPART.includes(MODULE_DE_ROUTE[r]);
eq(depart("themes"), false, "départ : les cours fermés");
eq(depart("ressources"), true, "départ : les ressources ouvertes");
eq(routeVisibleV2("themes", depart), true, "départ : Cours ouvert sur ses Documents");
eq(routeVisibleV2("planning", depart), true, "départ : Planning ouvert");
eq(routeVisibleV2("ccp2", depart), false, "départ : CCP2 fermé");
eq(ids(entreesNavigation("stagiaire", { routeVisible: depart, emargementActif: false })),
  ["home", "planning", "themes", "mon-suivi"], "départ : Cours et QCM dans la barre du stagiaire");
eq(ids(entreesNavigation("stagiaire", { routeVisible: seules("dashboard"), emargementActif: false })),
  ["home", "planning", "mon-suivi"], "les seules Priorités ouvertes : Planning dans la barre");

// 7. Copies : modifier ce que le module rend ne change pas le résultat suivant
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

// 8. Initiales du bouton du compte, tirées du nom affiché par l'app
eq(initialesDe("V. Timy"), "TV", "stagiaire « V. Timy » (initiale du nom, prénom) : prénom d'abord");
eq(initialesDe("Camille Martin"), "CM", "prénom et nom");
eq(initialesDe("Jean-Marc Dupont"), "JD", "prénom composé : premier et dernier mot");
eq(initialesDe("  V.   Timy "), "TV", "espaces en trop");
eq(initialesDe("Timy"), "T", "un seul mot : une lettre");
eq(initialesDe("élodie"), "É", "accent gardé, en capitale");
eq(initialesDe("jean.dupont@example.fr"), "JD", "adresse électronique : sa partie locale");
eq(initialesDe("banc@example.test"), "B", "adresse électronique d'un seul mot");
eq(initialesDe(""), "", "nom vide : aucune initiale");
eq(initialesDe(null), "", "nom absent : aucune initiale");

// 9. Prénom affiché à côté des initiales (bouton du compte du stagiaire)
eq(prenomDe("V. Timy"), "Timy", "stagiaire « V. Timy » : le prénom, après l'initiale du nom");
eq(prenomDe("Camille Martin"), "Camille", "prénom et nom : le premier mot");
eq(prenomDe("Romain"), "Romain", "un seul mot : lui-même");
eq(prenomDe("V. Jean-Marc"), "Jean-Marc", "prénom composé gardé entier");
eq(prenomDe("K. Anne Marie"), "Anne Marie", "prénom en deux mots après l'initiale du nom");
eq(prenomDe("  V.   Timy "), "Timy", "espaces en trop");
eq(prenomDe("jean.dupont@example.fr"), "", "adresse électronique : pas de prénom");
eq(prenomDe(""), "", "nom vide : pas de prénom");
eq(prenomDe(null), "", "nom absent : pas de prénom");

// 10. Repère de l'équipe : une entrée est « masquée aux stagiaires » quand le stagiaire ne la voit pas,
// c'est-à-dire quand sa page et tous ses sous-onglets regroupés sont fermés (même règle que routeVisibleV2).
const fermees = (...routes) => (r) => routes.includes(r);   // routeMasquee de l'app
eq(entreeMasquee("ccp2", fermees("ccp2")), true, "CCP2 fermé : repéré");
eq(entreeMasquee("ccp2", fermees()), false, "CCP2 ouvert : pas de repère");
eq(entreeMasquee("notes", fermees("notes")), true, "Notes fermées : repérées");
eq(entreeMasquee("themes", fermees("themes")), false, "Cours fermé, Documents ouverts : le stagiaire voit Cours et QCM");
eq(entreeMasquee("themes", fermees("themes", "ressources")), true, "Cours et Documents fermés : repéré");
eq(entreeMasquee("planning", fermees("planning")), false, "Semaine fermée, Dates clés et Priorités ouvertes : pas de repère");
eq(entreeMasquee("planning", fermees("planning", "calendrier", "dashboard")), true, "Planning tout fermé : repéré");
const masqueeAuDepart = (r) => !depart(r);
eq(eqp.filter((e) => entreeMasquee(e.route, masqueeAuDepart)).map((e) => e.id), ["notes", "ccp2"],
  "départ : seules Notes et CCP2 sont repérées chez l'équipe");

// 11. Rôle affiché sous le nom (barre de l'équipe, menu du compte) : le vrai rôle, « Formateur » et jamais « Prof »
eq(libelleRole({ role: "prof", is_founder: false }), "Formateur", "formateur (rôle technique prof)");
eq(libelleRole({ role: "admin", is_founder: false }), "Formateur", "admin : formateur");
eq(libelleRole({ role: "stagiaire", is_founder: false }), "Stagiaire", "stagiaire");
eq(libelleRole({ role: "stagiaire", is_founder: true }), "Fondateur", "fondateur, quel que soit son rôle technique");
eq(libelleRole(null), "", "profil absent : rien");

// 12. Chaque entrée nomme une icône qui existe (une faute de frappe dessinerait une icône de repli)
for (const espace of ["stagiaire", "equipe"]) {
  for (const e of entreesNavigation(espace, { routeVisible: tout, emargementActif: true })) {
    eq(Object.hasOwn(icon, e.icone), true, `icône « ${e.icone} » de l'entrée ${e.id} (${espace}) propre à js/icons.js`);
  }
}

// 13. Nom du bouton du compte : le texte qu'il montre (nom, et rôle dans la barre de l'équipe : WCAG 2.5.3),
// puis les nouveautés non lues (le texte de libellePastille : "", "1" à "9", "9+"). Le bouton ne montre plus
// qu'un point sans chiffre (lot 2A) : c'est son nom, et lui seul, qui dit combien il y en a.
eq(nomDuBoutonCompte({ nonLues: "9" }), "Mon compte, 9 nouveautés non lues", "le nombre est dans le nom, pas sur le bouton");
eq(nomDuBoutonCompte({ nom: "V. Timy" }), "Mon compte (V. Timy)", "en-tête du stagiaire : le nom, sans rôle affiché");
eq(nomDuBoutonCompte({ nom: "V. Timy", role: "Fondateur" }), "Mon compte (V. Timy, Fondateur)",
  "barre de l'équipe : le nom et le rôle qu'elle affiche");
eq(nomDuBoutonCompte({ nom: "Romain", role: "Formateur", nonLues: "2" }),
  "Mon compte (Romain, Formateur), 2 nouveautés non lues", "nouveautés non lues : le nombre de la pastille");
eq(nomDuBoutonCompte({ nom: "V. Timy", nonLues: "1" }), "Mon compte (V. Timy), 1 nouveauté non lue", "une seule : au singulier");
eq(nomDuBoutonCompte({ nom: "V. Timy", nonLues: "9+" }), "Mon compte (V. Timy), 9+ nouveautés non lues", "au-delà de 9 : « 9+ »");
eq(nomDuBoutonCompte({ nom: "V. Timy", role: "Fondateur", nonLues: "" }), "Mon compte (V. Timy, Fondateur)",
  "aucune non lue : rien n'est ajouté");
eq(nomDuBoutonCompte({ role: "Formateur" }), "Mon compte (Formateur)", "sans nom : le rôle affiché sous « Mon compte »");
eq(nomDuBoutonCompte({}), "Mon compte", "ni nom ni rôle");
eq(nomDuBoutonCompte(), "Mon compte", "sans argument");
// Le nom contient chaque texte visible du bouton de l'équipe (le nom en gras, le rôle dessous, la pastille).
const nomEquipe = nomDuBoutonCompte({ nom: "V. Timy", role: libelleRole({ role: "stagiaire", is_founder: true }), nonLues: "3" });
eq(["V. Timy", "Fondateur", "3"].every((t) => nomEquipe.includes(t)), true, "le nom contient le texte visible");

// 14. Ligne « page à soi » du menu du compte (ruling R30) : seulement quand la barre affichée n'y mène pas déjà
const formateurSansProfil = pagePersonnelle({ formateur: true, stagiaireId: null });
const formateurStagiaire = pagePersonnelle({ formateur: true, stagiaireId: 1 });
const stagiaire = pagePersonnelle({ formateur: false, stagiaireId: 1 });
eq([formateurSansProfil, formateurStagiaire, stagiaire], ["stagiaires", "mon-suivi", "mon-suivi"], "pages à soi des trois cas");
eq(pageASoiDuMenu(stagiaire, stag), null, "stagiaire : Mon suivi est une entrée de sa barre, pas de ligne");
eq(pageASoiDuMenu(stagiaire, entreesNavigation("stagiaire", { routeVisible: () => false, emargementActif: false })), null,
  "stagiaire, tous les modules fermés : Mon suivi reste une entrée");
eq(pageASoiDuMenu(formateurSansProfil, eqp), null, "formateur sans profil stagiaire : Stagiaires est une entrée, pas de ligne");
eq(pageASoiDuMenu(formateurStagiaire, eqp), "mon-suivi", "formateur qui a un profil stagiaire : sa page n'a pas d'entrée, la ligne reste");
eq(pageASoiDuMenu("stagiaires", []), "stagiaires", "aucune entrée : la ligne reste");

console.log(`nav-rules : ${n} assertions OK`);
