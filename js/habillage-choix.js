// Habillage (refonte, lot 3) : le choix, deux pastilles « ECSR Promo » et « Couleurs ECF ». Posé dans le menu du compte
// (js/menu-compte.js) et dans Mes préférences (js/views/config.js) ; dans les Paramètres de l'ancienne barre, seulement pour
// qui est en Couleurs ECF, pour pouvoir revenir (décision H6). Le choix lui-même (appliquer, garder sur l'appareil,
// enregistrer sur le compte) est celui de js/habillage.js.

import { el, toast } from "./utils.js?v=20261112b";
import { choisirHabillage, habillageCourant } from "./habillage.js?v=20261112b";

// Dans l'ordre des pastilles. `legende` : la seconde ligne, plus discrète, qui dit d'où vient l'habillage (le libellé reste le nom). `message` : ce que le bas de l'écran confirme, que l'enregistrement sur le compte aboutisse
// ou non (le choix est appliqué et gardé sur l'appareil ; il repartira au prochain démarrage).
const PASTILLES = [
  { nom: "ecsr", libelle: "ECSR Promo", legende: "d'origine", message: "Habillage ECSR Promo appliqué" },
  { nom: "ecf", libelle: "Couleurs ECF", legende: "du réseau ECF", message: "Couleurs ECF appliquées" },
];

// Toutes les pastilles affichées (menu du compte, page) suivent l'habillage appliqué : une seule écoute pour la fenêtre,
// posée au premier bloc construit (une fenêtre nouvelle, celle d'un test, a la sienne).
let fenetreSuivie = null;
function suivreHabillage() {
  if (fenetreSuivie === globalThis.window) return;
  fenetreSuivie = globalThis.window;
  fenetreSuivie.addEventListener("ecsr:habillage", (e) => {
    const nom = e.detail?.nom;
    document.querySelectorAll(".habillage-pastille[data-habillage]:not([data-reglage])").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-habillage") === nom));
    });
  });
}

let numero = 0;

// `titre` : l'élément qui porte déjà le titre « Apparence » (le h3 d'une section de page), qui nomme alors le groupe ; sans
// lui, le bloc porte le sien (le menu du compte, où il prend l'allure des titres de section de la fenêtre). `deps` : les
// dépendances de js/habillage.js (stockage, enregistrement...) et `toast`, pour les tests ; l'app n'en passe aucune.
// `reglage` (lot 5, Réglages du centre et du réseau) : le bloc ne règle plus l'apparence de la personne mais une valeur par
// défaut tenue ailleurs. `reglage.courant` : le nom en vigueur (ou null) ; `reglage.surChoix(nom)` : enregistre le choix et rend
// une promesse de vrai (gardé) ou de faux (refusé, la page l'a déjà dit) ; une pastille refusée revient à l'état d'avant. Rien
// n'est appliqué à l'écran, ni gardé sur l'appareil, ni envoyé au compte. L'élément rendu porte `poserChoix(nom)`, qui change la
// pastille pressée sans rien enregistrer (nul : aucune).
export function blocHabillage({ titre = null, deps = {}, reglage = null } = {}) {
  suivreHabillage();
  const annoncer = deps.toast ?? toast;
  const tete = titre ?? el("p", { class: "habillage-titre" }, "Apparence");
  if (!tete.id) tete.id = "habillage-titre-" + ++numero;
  let etat = reglage ? (reglage.courant ?? null) : null;
  const courant = reglage ? etat : habillageCourant(deps);
  const pastilles = PASTILLES.map(({ nom, libelle, legende, message }) => {
    const bouton = el("button", {
      type: "button", class: "habillage-pastille", "data-habillage": nom, "aria-pressed": String(courant === nom),
      "aria-label": `${libelle}, ${legende}`,
      ...(reglage ? { "data-reglage": "" } : {}),
      onClick: reglage ? async () => {
        if (etat === nom) return;
        bouton.focus({ preventScroll: true });
        const avant = etat;
        poserChoix(nom);
        let gardee = false;
        try { gardee = (await reglage.surChoix(nom)) === true; } catch (e) { console.warn("Habillage : réglage impossible", e); }
        if (!gardee && etat === nom) poserChoix(avant);
      } : () => {
        // La pastille déjà pressée ne fait rien : ni envoi, ni message, et surtout pas de choix personnel. Un habillage
        // appliqué sans avoir été choisi (le défaut, celui du centre, l'appareil d'une autre personne) ne le devient pas
        // par ce toucher (js/habillage-regles.js : le défaut ne devient jamais un choix). Le focus reste où il est.
        if (habillageCourant(deps) === nom) return;
        // Le focus reste sur la pastille (Safari ne le donne pas au bouton touché) ; le menu reste ouvert : rien ici ne le ferme.
        bouton.focus({ preventScroll: true });
        // L'habillage est appliqué tout de suite (l'événement met les pastilles à jour) ; l'enregistrement suit sans être attendu.
        choisirHabillage(nom, deps).catch((e) => console.warn("Habillage : choix impossible", e));
        annoncer(message);
      },
    }, el("span", { class: "habillage-apercu", "aria-hidden": "true" }), el("span", { class: "habillage-textes" },
      el("span", { class: "habillage-libelle" }, libelle),
      el("span", { class: "habillage-legende" }, legende)));
    return bouton;
  });
  function poserChoix(nom) {
    etat = nom ?? null;
    pastilles.forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-habillage") === etat)));
  }
  const bloc = el("div", { class: "habillage-choix", role: "group", "aria-labelledby": tete.id },
    titre ? null : tete,
    el("div", { class: "habillage-pastilles" }, ...pastilles));
  bloc.poserChoix = poserChoix;
  return bloc;
}
