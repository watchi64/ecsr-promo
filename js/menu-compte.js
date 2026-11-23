// Menu du compte (refonte, lot 1 ; seul menu du compte depuis le 10/11), ouvert par le bouton du compte
// de chaque espace (et, sur téléphone, depuis le tiroir « Plus » de l'équipe) : la page à soi (Mon suivi,
// ou Stagiaires pour un formateur sans profil stagiaire) quand la barre n'y mène pas déjà (ruling R30), le
// « Voir en tant que » du fondateur, les informations légales et la déconnexion, les Nouveautés (avec le
// nombre des non-lues, que le bouton du compte ne montre que par un point), les Contacts (la page de l'annuaire
// du centre), Mes préférences (celles de la personne, pour tous les rôles : les Réglages de la
// promo sont une entrée de la barre de l'équipe) et « Recharger les données » (seul moyen de relire les données dans
// l'app installée sur iPhone).
// Juste sous la tête du menu (lot 3) : Apparence, le choix de l'habillage (js/habillage-choix.js) ; une pastille
// touchée change les couleurs sans fermer le menu.
// Popover sur ordinateur et tablette, tiroir en bas de l'écran sur téléphone (css/navigation.css),
// mécanique de fenêtre de js/nav-fenetre.js.
// Lot 5 : une section « Espace » (une ligne par espace ouvert au compte, l'actuel coché) quand il y en a deux ou plus ; dans la
// direction et au siège, pas de page à soi hors de l'espace ; les Contacts sont dans la direction, pas au siège.

import { el } from "./utils.js?v=20261123a";
import { icon, deco } from "./icons.js?v=20261123a";
import {
  getProfile, getProfileWho, monStagiaireId, buildViewAsBlock, seDeconnecter, espacesOuverts, setEspace, getCentre, getProfileNom,
  getMesTitres, chargerTitresDApercu,
} from "./auth-admin.js?v=20261123a";
import { LIBELLES_ESPACE, routeDansLEspace } from "./espaces-rules.js?v=20261123a";
import { getPromoCourante, getMesPromos } from "./db.js?v=20261123a";
import { ouvrirChoixPromo } from "./promo-pastille.js?v=20261123a";
import { pagePersonnelle } from "./route-rules.js?v=20261123a";
import { nouveautesAffichables, formateurConnecte } from "./modules-etat.js?v=20261123a";
import { libellePastille } from "./nouveautes.js?v=20261123a";
import { initialesDe, libelleRole, pageASoiDuMenu } from "./nav-rules.js?v=20261123a";
import { ouvrirFenetre, fermerFenetre } from "./nav-fenetre.js?v=20261123a";
import { fondateurHorsApercu } from "./auth-admin.js?v=20261123a";
import { ouvrirSignalement } from "./signalement.js?v=20261123a";
import { etatSignalements } from "./signalement-etat.js?v=20261123a";
import { pastilleSignalement } from "./signalement-rules.js?v=20261123a";
import { blocHabillage } from "./habillage-choix.js?v=20261123a";
import { libelleTitre, ceQueJePeuxFaire, NIVEAU_DE_L_ESPACE } from "./titres-rules.js?v=20261123a";

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

// Titres (étape 3) : « Mon titre » (une ligne par titre de la personne) et « Ce que je peux faire » (liste repliée : les pages du
// titre de l'espace affiché, avec Voir ou Modifier). Rien dans l'espace stagiaire ni quand mes_titres n'a rien rendu (lecture ratée,
// aucun titre) : l'app reste celle d'avant les titres.
function blocMonTitre(espace) {
  const titres = NIVEAU_DE_L_ESPACE[espace] ? getMesTitres() : null;
  if (!titres || !titres.length) return null;
  const promoNoms = new Map(getMesPromos().map((p) => [p.id, p.nom]));
  const lieuNom = getCentre()?.nom ?? null;
  const libelle = (t) => libelleTitre(t, { promoNoms, lieuNom: t.lieu_nom ?? (t.lieu_id != null && t.lieu_id === getCentre()?.id ? lieuNom : null) });
  const pagesDe = (t) => ceQueJePeuxFaire(t);
  return el("div", { class: "nav-groupe nav-mon-titre", role: "group", "aria-labelledby": "nav-titre-titre" },
    el("p", { class: "nav-fenetre-section", id: "nav-titre-titre" }, titres.length > 1 ? "Mes titres" : "Mon titre"),
    titres.map((t) => el("p", { class: "nav-mon-titre-nom" }, libelle(t))),
    el("details", { class: "nav-mon-titre-droits" },
      el("summary", { class: "nav-fenetre-lien" }, deco(icon.eye()), el("span", { class: "nav-fenetre-texte" }, "Ce que je peux faire")),
      titres.map((t) => el("div", { class: "nav-mon-titre-liste" },
        titres.length > 1 ? el("p", { class: "nav-mon-titre-sous" }, libelle(t)) : null,
        pagesDe(t).length
          ? el("ul", {}, pagesDe(t).map((x) => el("li", {}, el("span", {}, x.libelle), el("b", {}, x.valeur))))
          : el("p", { class: "nav-mon-titre-vide" }, "Ce titre n'ouvre aucune page.")))));
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
  // Le fondateur hors aperçu : la liste du choix « Titre » de l'aperçu se lit maintenant (en aperçu, titres_visibles refuserait).
  if (fondateurHorsApercu()) chargerTitresDApercu();

  const tete = el("div", { class: "nav-fenetre-tete" },
    el("span", { class: "nav-avatar", "aria-hidden": "true" }, initialesDe(nom) || deco(icon.user())),
    el("span", { class: "nav-fenetre-qui" }, el("b", {}, nom || "Mon compte"), quiEtOu ? el("small", {}, quiEtOu) : null));

  ouvrirFenetre({
    nom: "compte", ancre, etiquette: "Mon compte", classe: "nav-menu-compte",
    contenu: [
      tete,
      blocHabillage(),
      blocMonTitre(espace),
      filet(),
      lignePageASoi(pageASoi),
      ligne("a", { href: "#/nouveautes" }, icon.bell(), "Nouveautés", nonLues
        ? el("span", { class: "nav-pastille" }, nonLues, el("span", { class: "nav-invisible" }, " non lues"))
        : null),
      // Les contacts du centre ont leur page (#/contacts, espace contact) : stagiaire, équipe et direction, sans dépendre du module
      // Documents. Le siège n'a pas d'annuaire de centre : pas de ligne.
      espace !== "siege" ? ligne("a", { href: "#/contacts" }, icon.phone(), "Contacts") : null,
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
        import("./legal.js?v=20261123a").then((m) => m.ouvrirInformationsLegales());
      } }, icon.shield(), "Informations légales"),
      ligne("button", { type: "button", onClick: () => seDeconnecter(() => fermerFenetre({ focus: false })) },
        icon.logout(), "Se déconnecter"),
    ],
  });
}
