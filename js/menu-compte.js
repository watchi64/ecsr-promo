// Menu du compte (refonte, lot 1 ; seul menu du compte depuis le 10/11), ouvert par le bouton du compte
// de chaque espace (et, sur téléphone, depuis le tiroir « Plus » de l'équipe) : la page à soi (Mon suivi,
// ou Stagiaires pour un formateur sans profil stagiaire) quand la barre n'y mène pas déjà (ruling R30), le
// « Voir en tant que » du fondateur, les informations légales et la déconnexion, les Nouveautés (avec le
// nombre des non-lues, que le bouton du compte ne montre que par un point), les Contacts du centre (Cours
// et QCM, Documents), Mes préférences (celles de la personne, pour tous les rôles : les Réglages de la
// promo sont une entrée de la barre de l'équipe) et « Recharger les données » (seul moyen de relire les données dans
// l'app installée sur iPhone).
// Juste sous la tête du menu (lot 3) : Apparence, le choix de l'habillage (js/habillage-choix.js) ; une pastille
// touchée change les couleurs sans fermer le menu.
// Popover sur ordinateur et tablette, tiroir en bas de l'écran sur téléphone (css/navigation.css),
// mécanique de fenêtre de js/nav-fenetre.js.
// Lot 5 : une section « Espace » (une ligne par espace ouvert au compte, l'actuel coché) quand il y en a deux ou plus ; dans la
// direction et au siège, ni les contacts du centre ni une page à soi hors de l'espace.

import { el } from "./utils.js?v=20261112b";
import { icon, deco } from "./icons.js?v=20261112b";
import {
  getProfile, getProfileWho, monStagiaireId, buildViewAsBlock, seDeconnecter, espacesOuverts, setEspace, getCentre, getProfileNom,
} from "./auth-admin.js?v=20261112b";
import { LIBELLES_ESPACE, routeDansLEspace, espaceDePilotage } from "./espaces-rules.js?v=20261112b";
import { getPromoCourante, getMesPromos } from "./db.js?v=20261112b";
import { ouvrirChoixPromo } from "./promo-pastille.js?v=20261112b";
import { pagePersonnelle } from "./route-rules.js?v=20261112b";
import { nouveautesAffichables, formateurConnecte, routeVisible } from "./modules-etat.js?v=20261112b";
import { libellePastille } from "./nouveautes.js?v=20261112b";
import { initialesDe, libelleRole, pageASoiDuMenu } from "./nav-rules.js?v=20261112b";
import { ouvrirFenetre, fermerFenetre } from "./nav-fenetre.js?v=20261112b";
import { fondateurHorsApercu } from "./auth-admin.js?v=20261112b";
import { ouvrirSignalement } from "./signalement.js?v=20261112b";
import { etatSignalements } from "./signalement-etat.js?v=20261112b";
import { pastilleSignalement } from "./signalement-rules.js?v=20261112b";
import { blocHabillage } from "./habillage-choix.js?v=20261112b";

// Une ligne du menu : un lien (page) ou un bouton (geste), icône et libellé, `fin` à droite.
const ligne = (tag, attrs, icone, texte, fin = null) => el(tag, { class: "nav-fenetre-lien", ...attrs },
  deco(icone), el("span", { class: "nav-fenetre-texte" }, texte), fin);
const filet = () => el("div", { class: "nav-fenetre-filet", "aria-hidden": "true" });

// La ligne de la page à soi, sous le nom que porte la page (« Mon suivi » sous la nouvelle navigation,
// comme son entrée chez le stagiaire) ; null quand la barre affichée y mène déjà.
function lignePageASoi(page) {
  if (page === "stagiaires") return ligne("a", { href: "#/stagiaires" }, icon.users(), "Stagiaires");
  if (page === "mon-suivi") return ligne("a", { href: "#/mon-suivi" }, icon.user(), "Mon suivi");
  return null;
}

// « Signaler un problème », dans l'espace stagiaire (l'équipe l'a en pied de barre) : la fenêtre
// « Signaler un problème » remplace le menu, et le focus reviendra au bouton du compte. Pastille et nom comme dans la
// coquille (pastilleSignalement).
function ligneSignaler(ancre) {
  const { texte, nom } = pastilleSignalement({ fondateur: fondateurHorsApercu(), ...etatSignalements() });
  return ligne("button", {
    type: "button", "data-nav-action": "signaler", "aria-haspopup": "dialog", "aria-label": nom,
    onClick: () => ouvrirSignalement({ ancre }),
  }, icon.signaler(), "Signaler un problème", texte ? el("span", { class: "nav-pastille", "aria-hidden": "true" }, texte) : null);
}

// Section « Espace » : une ligne par espace ouvert au compte (js/auth-admin.js, espacesOuverts), l'actuel coché ; choisir un autre
// espace ferme le menu et recharge l'app sur son accueil (setEspace). Rien quand le compte n'a qu'un espace.
const ICONE_ESPACE = { siege: () => icon.globe(), direction: () => icon.building(), equipe: () => icon.users(), stagiaire: () => icon.user() };
function sectionEspace(actuel) {
  const ouverts = espacesOuverts();
  if (ouverts.length < 2) return null;
  return el("div", { class: "nav-groupe", role: "group", "aria-labelledby": "nav-espace-titre" },
    el("p", { class: "nav-fenetre-section", id: "nav-espace-titre" }, "Espace"),
    ouverts.map((e) => ligne("button", {
      type: "button", "data-espace-choix": e, "aria-current": e === actuel ? "true" : null,
      onClick: () => {
        fermerFenetre();
        if (e !== actuel) setEspace(e);
      },
    }, ICONE_ESPACE[e](), LIBELLES_ESPACE[e], e === actuel ? el("span", { class: "nav-espace-coche" }, deco(icon.check())) : null)));
}

// La ligne sous le nom : le rôle de l'espace, et où (la promo affichée ; le centre de la direction ; rien au siège).
function ouDansLEspace(espace) {
  if (espace === "siege") return null;
  if (espace === "direction") return getCentre()?.nom || null;
  return getPromoCourante()?.nom || null;
}

// `actualiser` : le geste « Recharger les données » de l'app (main.js) ; sans lui, pas de ligne. `entrees` : les
// entrées de la barre affichée, qui décident de la ligne de la page à soi. `espace` : celui de la coquille
// (« stagiaire », « equipe », « direction » ou « siege »), qui décide de la ligne « Signaler un problème ».
export function ouvrirMenuCompte(ancre, { actualiser, entrees = [], espace = null } = {}) {
  const nom = getProfileNom() || "";
  const quiEtOu = [libelleRole(getProfile(), espace), ouDansLEspace(espace)].filter(Boolean).join(" · ");
  // La page à soi, si elle est dans l'espace (le siège n'a pas de page Stagiaires, la direction pas de Mon suivi).
  const page = pagePersonnelle({ formateur: formateurConnecte(), stagiaireId: monStagiaireId() });
  const pageASoi = routeDansLEspace(espace, page) ? pageASoiDuMenu(page, entrees) : null;
  const nonLues = libellePastille(nouveautesAffichables().neuves.size);
  const pilotage = espaceDePilotage(espace);

  const tete = el("div", { class: "nav-fenetre-tete" },
    el("span", { class: "nav-avatar", "aria-hidden": "true" }, initialesDe(nom) || deco(icon.user())),
    el("span", { class: "nav-fenetre-qui" }, el("b", {}, nom || "Mon compte"), quiEtOu ? el("small", {}, quiEtOu) : null));

  ouvrirFenetre({
    nom: "compte", ancre, etiquette: "Mon compte", classe: "nav-menu-compte",
    contenu: [
      tete,
      blocHabillage(),
      filet(),
      lignePageASoi(pageASoi),
      ligne("a", { href: "#/nouveautes" }, icon.bell(), "Nouveautés", nonLues
        ? el("span", { class: "nav-pastille" }, nonLues, el("span", { class: "nav-invisible" }, " non lues"))
        : null),
      // Les contacts du centre (les numéros pour prévenir d'une absence) ne sont plus un onglet : ils sont dans Cours et QCM,
      // sous-onglet Documents, où #/ressources mène (redirection du lot 1). Pas de ligne quand le module Ressources est fermé
      // pour la promo : un stagiaire n'y trouverait rien (un formateur voit toujours tout). La direction et le siège n'ont pas
      // Cours et QCM pour Documents (lot 5) : pas de ligne.
      !pilotage && routeVisible("ressources") ? ligne("a", { href: "#/ressources" }, icon.phone(), "Contacts du centre") : null,
      // Pour tous les rôles : les réglages de la promo ont leur entrée chez l'équipe (Réglages, #/config), ce
      // menu ouvre ceux de la personne.
      ligne("a", { href: "#/preferences" }, icon.settings(), "Mes préférences"),
      actualiser
        ? ligne("button", { type: "button", onClick: () => { fermerFenetre(); actualiser(); } }, icon.refresh(), "Recharger les données")
        : null,
      // Un compte qui a plusieurs promos (stagiaire dans l'une, formateur dans l'autre) doit pouvoir passer de l'une à l'autre : la
      // barre du stagiaire n'a pas de pastille de promo, la ligne est ici. L'équipe a la sienne dans sa colonne.
      espace === "stagiaire" && getMesPromos().length >= 2
        ? ligne("button", { type: "button", "aria-haspopup": "dialog", onClick: () => { fermerFenetre({ focus: false }); ouvrirChoixPromo(); } },
          icon.users(), "Changer de promo")
        : null,
      espace === "stagiaire" ? ligneSignaler(ancre) : null,
      sectionEspace(espace),
      // Fondateur : cinq rôles ; formateur et direction : « Voir comme un stagiaire » ; null sinon. Choisir ferme le menu,
      // la coquille change d'espace.
      buildViewAsBlock(() => fermerFenetre()),
      filet(),
      ligne("button", { type: "button", onClick: () => {
        fermerFenetre({ focus: false });
        import("./legal.js?v=20261112b").then((m) => m.ouvrirInformationsLegales());
      } }, icon.shield(), "Informations légales"),
      ligne("button", { type: "button", onClick: () => seDeconnecter(() => fermerFenetre({ focus: false })) },
        icon.logout(), "Se déconnecter"),
    ],
  });
}
