// Habillage (refonte, lot 3) : le choix, deux pastilles « ECSR Promo » et « Couleurs ECF ». Posé dans le menu du compte
// (js/menu-compte.js) et dans Mes préférences (js/views/config.js) ; dans les Paramètres de l'ancienne barre, seulement pour
// qui est en Couleurs ECF, pour pouvoir revenir (décision H6). Le choix lui-même (appliquer, garder sur l'appareil,
// enregistrer sur le compte) est celui de js/habillage.js.

import { el, toast } from "./utils.js?v=20261109d";
import { choisirHabillage, habillageCourant } from "./habillage.js?v=20261109d";

// Dans l'ordre des pastilles. `message` : ce que le bas de l'écran confirme, que l'enregistrement sur le compte aboutisse
// ou non (le choix est appliqué et gardé sur l'appareil ; il repartira au prochain démarrage).
const PASTILLES = [
  { nom: "ecsr", libelle: "ECSR Promo", message: "Habillage ECSR Promo appliqué" },
  { nom: "ecf", libelle: "Couleurs ECF", message: "Couleurs ECF appliquées" },
];

// Toutes les pastilles affichées (menu du compte, page) suivent l'habillage appliqué : une seule écoute pour le document,
// posée au premier bloc construit.
let ecoute = false;
function suivreHabillage() {
  if (ecoute) return;
  ecoute = true;
  window.addEventListener("ecsr:habillage", (e) => {
    const nom = e.detail?.nom;
    document.querySelectorAll(".habillage-pastille[data-habillage]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.habillage === nom));
    });
  });
}

let numero = 0;

// `titre` : l'élément qui porte déjà le titre « Apparence » (le h3 d'une section de page), qui nomme alors le groupe ; sans
// lui, le bloc porte le sien (le menu du compte, où il prend l'allure des titres de section de la fenêtre).
export function blocHabillage({ titre = null } = {}) {
  suivreHabillage();
  const tete = titre ?? el("p", { class: "habillage-titre" }, "Apparence");
  if (!tete.id) tete.id = "habillage-titre-" + ++numero;
  const courant = habillageCourant();
  const pastilles = PASTILLES.map(({ nom, libelle, message }) => {
    const bouton = el("button", {
      type: "button", class: "habillage-pastille", "data-habillage": nom, "aria-pressed": String(courant === nom),
      onClick: () => {
        // Le focus reste sur la pastille (Safari ne le donne pas au bouton touché) ; le menu reste ouvert : rien ici ne le ferme.
        bouton.focus({ preventScroll: true });
        // L'habillage est appliqué tout de suite (l'événement met les pastilles à jour) ; l'enregistrement suit sans être attendu.
        choisirHabillage(nom).catch((e) => console.warn("Habillage : choix impossible", e));
        toast(message);
      },
    }, el("span", { class: "habillage-apercu", "aria-hidden": "true" }), el("span", { class: "habillage-libelle" }, libelle));
    return bouton;
  });
  return el("div", { class: "habillage-choix", role: "group", "aria-labelledby": tete.id },
    titre ? null : tete,
    el("div", { class: "habillage-pastilles" }, ...pastilles));
}
