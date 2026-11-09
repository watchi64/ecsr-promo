// Demander confirmation d'un geste qui efface, dans une fenêtre de l'app plutôt que par la boîte du navigateur
// (confirm()) : le robot des parcours et le vérificateur comptent une boîte native comme un défaut, et elle ne suit ni
// l'habillage ni la taille de l'écran. Même fenêtre que la fermeture d'un examen (confirmerFermeture, js/views/themes.js).
// « Annuler », Échap ou un toucher à côté répondent non ; la page en dessous ne reçoit pas l'Échap. Le focus va au
// bouton du geste, puis revient où il était (le champ suivant de l'écran « Saisir ») s'il est encore dans la page.
// La fenêtre s'ouvre au tour suivant : demandée pendant qu'on quitte un champ (Tab, Entrée, « Retour »), elle laisse le
// geste finir (le focus arriver au champ suivant, « Retour » ramener à la liste), puis s'ouvre par-dessus.
// Testé par tests/confirmer.test.mjs.

import { el } from "./utils.js?v=20261109j";

let compteur = 0;

export function confirmer(question) {
  return new Promise((resolve) => { setTimeout(() => ouvrir(question, resolve), 0); });
}

function ouvrir({ titre, phrase = null, oui, non = "Annuler" }, resolve) {
  const avant = document.activeElement;
  const id = `confirmer-titre-${++compteur}`;
  const bd = el("div", { class: "modal-backdrop" });
  const finir = (reponse) => {
    document.removeEventListener("keydown", echap, true);
    bd.remove();
    if (avant && avant !== document.body && avant.isConnected && typeof avant.focus === "function") avant.focus();
    resolve(reponse);
  };
  const echap = (e) => { if (e.key === "Escape") { e.stopPropagation(); finir(false); } };
  const boutonOui = el("button", { class: "btn danger", type: "button", onClick: () => finir(true) }, oui);
  bd.appendChild(el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": id },
    el("h3", { id }, titre),
    phrase ? el("p", { class: "muted", style: "margin:0 0 0.8rem" }, phrase) : null,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: () => finir(false) }, non),
      boutonOui),
  ));
  bd.addEventListener("click", (e) => { if (e.target === bd) finir(false); });
  document.addEventListener("keydown", echap, true);
  document.body.appendChild(bd);
  boutonOui.focus();
}
