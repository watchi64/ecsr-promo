// Menu du compte de la nouvelle navigation (refonte, lot 1), ouvert par le bouton du compte des
// deux espaces (et, sur téléphone, depuis le tiroir « Plus » de l'équipe). Il reprend le menu
// « Mon compte » de l'ancienne barre (auth-admin.js) : la page à soi (Mon suivi, ou Stagiaires
// pour un formateur sans profil stagiaire) quand la barre n'y mène pas déjà (ruling R30), le « Voir
// en tant que » du fondateur, les informations légales et la déconnexion ; il y ajoute ce que
// l'ancienne barre portait à côté : les Nouveautés (avec la pastille des non-lues), les Réglages et
// « Actualiser », le même geste que le bouton de l'ancienne barre (seul moyen de relire les données
// dans l'app installée sur iPhone). Popover sur ordinateur et tablette, tiroir en bas de l'écran sur
// téléphone (css/navigation.css), mécanique de fenêtre de js/nav-fenetre.js.

import { el } from "./utils.js?v=20261028a";
import { icon, deco } from "./icons.js?v=20261028a";
import {
  getProfile, getProfileWho, monStagiaireId, buildViewAsBlock, seDeconnecter,
} from "./auth-admin.js?v=20261028a";
import { getPromoCourante } from "./db.js?v=20261028a";
import { pagePersonnelle } from "./route-rules.js?v=20261028a";
import { nouveautesAffichables, formateurConnecte } from "./modules-etat.js?v=20261028a";
import { libellePastille } from "./nouveautes.js?v=20261028a";
import { initialesDe, libelleRole, pageASoiDuMenu } from "./nav-rules.js?v=20261028a";
import { ouvrirFenetre, fermerFenetre } from "./nav-fenetre.js?v=20261028a";
import { fondateurHorsApercu } from "./auth-admin.js?v=20261028a";
import { ouvrirSignalement } from "./signalement.js?v=20261028a";
import { etatSignalements } from "./signalement-etat.js?v=20261028a";
import { pastilleSignalement } from "./signalement-rules.js?v=20261028a";

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

// « Signaler un problème », dans l'espace stagiaire (l'équipe l'a en pied de barre) : la fenêtre de
// signalement remplace le menu, et le focus reviendra au bouton du compte. Pastille et nom comme dans la
// coquille (pastilleSignalement).
function ligneSignaler(ancre) {
  const { texte, nom } = pastilleSignalement({ fondateur: fondateurHorsApercu(), ...etatSignalements() });
  return ligne("button", {
    type: "button", "data-nav-action": "signaler", "aria-haspopup": "dialog", "aria-label": nom,
    onClick: () => ouvrirSignalement({ ancre }),
  }, icon.signaler(), "Signaler un problème", texte ? el("span", { class: "nav-pastille", "aria-hidden": "true" }, texte) : null);
}

// `actualiser` : le geste « Actualiser » de l'app (main.js) ; sans lui, pas de ligne. `entrees` : les
// entrées de la barre affichée, qui décident de la ligne de la page à soi. `espace` : celui de la coquille
// (« stagiaire » ou « equipe »), qui décide de la ligne « Signaler un problème ».
export function ouvrirMenuCompte(ancre, { actualiser, entrees = [], espace = null } = {}) {
  const nom = getProfileWho() || "";
  const quiEtOu = [libelleRole(getProfile()), getPromoCourante()?.nom].filter(Boolean).join(" · ");
  const pageASoi = pageASoiDuMenu(pagePersonnelle({ formateur: formateurConnecte(), stagiaireId: monStagiaireId() }), entrees);
  const nonLues = libellePastille(nouveautesAffichables().neuves.size);

  const tete = el("div", { class: "nav-fenetre-tete" },
    el("span", { class: "nav-avatar", "aria-hidden": "true" }, initialesDe(nom) || deco(icon.user())),
    el("span", { class: "nav-fenetre-qui" }, el("b", {}, nom || "Mon compte"), quiEtOu ? el("small", {}, quiEtOu) : null));

  ouvrirFenetre({
    nom: "compte", ancre, etiquette: "Mon compte", classe: "nav-menu-compte",
    contenu: [
      tete,
      lignePageASoi(pageASoi),
      ligne("a", { href: "#/nouveautes" }, icon.bell(), "Nouveautés", nonLues
        ? el("span", { class: "nav-pastille" }, nonLues, el("span", { class: "nav-invisible" }, " non lues"))
        : null),
      ligne("a", { href: "#/config" }, icon.settings(), "Réglages"),
      actualiser
        ? ligne("button", { type: "button", onClick: () => { fermerFenetre(); actualiser(); } }, icon.refresh(), "Actualiser")
        : null,
      espace === "stagiaire" ? ligneSignaler(ancre) : null,
      // Fondateur seulement (null sinon) : choisir un rôle ferme le menu, la coquille change d'espace.
      buildViewAsBlock(() => fermerFenetre()),
      filet(),
      ligne("button", { type: "button", onClick: () => {
        fermerFenetre({ focus: false });
        import("./legal.js?v=20261028a").then((m) => m.ouvrirInformationsLegales());
      } }, icon.shield(), "Informations légales"),
      ligne("button", { type: "button", onClick: () => seDeconnecter(() => fermerFenetre({ focus: false })) },
        icon.logout(), "Se déconnecter"),
    ],
  });
}
