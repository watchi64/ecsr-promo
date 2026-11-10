// Demander confirmation d'un geste qui efface, dans une fenêtre de l'app plutôt que par la boîte du navigateur
// (confirm()) : le robot des parcours et le vérificateur comptent une boîte native comme un défaut, et elle ne suit ni
// l'habillage ni la taille de l'écran. Même fenêtre que la fermeture d'un examen (confirmerFermeture, js/views/themes.js).
// « Annuler », Échap ou un toucher à côté répondent non. Le clavier s'écoute sur la fenêtre du navigateur (window), en
// capture, donc avant tout le reste : Échap ne va pas plus loin (ni l'écran « Saisir », ni l'assistant, ni la fiche d'un
// stagiaire restée dessous), et Tab passe d'un bouton à l'autre sans sortir. Le focus va au bouton du geste, puis
// revient où il était (le champ suivant de l'écran « Saisir ») s'il est encore dans la page.
// La fenêtre s'ouvre au tour suivant : demandée pendant qu'on quitte un champ par Tab ou Entrée, elle laisse le focus
// arriver au champ suivant avant de s'ouvrir ; au toucher, « Retour » va au bout. À la souris, le clic qui a fait quitter
// le champ peut finir sur la fenêtre : on le refait après avoir répondu.
// Geste irréversible (page Qualiopi, conservation des données) : la question peut porter `part` et `reste` (ce qui est
// effacé, ce qui reste, en listes) et `saisie` ({ consigne, attendu }) : un champ où taper le mot ou le prénom demandé ; le
// bouton du geste n'agit qu'une fois la saisie juste (confirmationValide : casse et espaces autour ignorés, accents exigés),
// Entrée dans le champ vaut le bouton. Le focus va alors au champ, et Tab passe du champ aux deux boutons.
// Testé par tests/confirmer.test.mjs.

import { el } from "./utils.js?v=20261110a";
import { confirmationValide } from "./effacement-rules.js?v=20261110a";

let compteur = 0;

export function confirmer(question) {
  return new Promise((resolve) => { setTimeout(() => ouvrir(question, resolve), 0); });
}

function ouvrir({ titre, phrase = null, part = null, reste = null, saisie = null, oui, non = "Annuler" }, resolve) {
  const avant = document.activeElement;
  const id = `confirmer-titre-${++compteur}`;
  const bd = el("div", { class: "modal-backdrop" });
  const finir = (reponse) => {
    window.removeEventListener("keydown", auClavier, true);
    bd.remove();
    if (avant && avant !== document.body && avant.isConnected && typeof avant.focus === "function") avant.focus();
    resolve(reponse);
  };
  const champ = saisie ? el("input", { type: "text", id: `${id}-saisie`, class: "confirmer-champ", autocomplete: "off",
    autocapitalize: "off", spellcheck: "false" }) : null;
  const saisieJuste = () => !champ || confirmationValide(champ.value, saisie.attendu);
  const boutonNon = el("button", { class: "btn ghost", type: "button", onClick: () => finir(false) }, non);
  const boutonOui = el("button", { class: "btn danger", type: "button", onClick: () => { if (saisieJuste()) finir(true); } }, oui);
  const majBouton = () => {
    const juste = saisieJuste();
    boutonOui.disabled = !juste;
    boutonOui.setAttribute("aria-disabled", juste ? "false" : "true");
  };
  if (champ) {
    champ.addEventListener("input", majBouton);
    champ.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (saisieJuste()) finir(true);
    });
    majBouton();
  }
  function auClavier(e) {
    if (e.key === "Escape") { e.stopPropagation(); finir(false); return; }
    if (e.key !== "Tab") return;
    e.preventDefault();
    e.stopPropagation();
    // Le tour des éléments de la fenêtre (le champ s'il y en a un, « Annuler », le geste s'il est permis) : Tab avance, Maj+Tab
    // recule, et un focus sorti de la fenêtre y revient.
    const tour = [champ, boutonNon, boutonOui.disabled ? null : boutonOui].filter(Boolean);
    const rang = tour.indexOf(document.activeElement);
    if (rang < 0) { (e.shiftKey ? tour[tour.length - 1] : tour[0]).focus(); return; }
    tour[(rang + (e.shiftKey ? tour.length - 1 : 1)) % tour.length].focus();
  }
  const listeTitree = (titreListe, items) => (items && items.length
    ? [el("p", { class: "confirmer-liste-titre" }, titreListe), el("ul", { class: "confirmer-liste" }, ...items.map((x) => el("li", {}, x)))]
    : []);
  bd.appendChild(el("div", { class: "modal" + (part || reste || saisie ? " confirmer-detaille" : ""), role: "dialog", "aria-modal": "true", "aria-labelledby": id },
    el("h3", { id }, titre),
    phrase ? el("p", { class: "muted", style: "margin:0 0 0.8rem" }, phrase) : null,
    ...listeTitree("Ce qui est effacé", part),
    ...listeTitree("Ce qui reste", reste),
    champ ? el("label", { class: "confirmer-consigne", for: `${id}-saisie` }, saisie.consigne) : null,
    champ,
    el("div", { class: "modal-actions" }, boutonNon, boutonOui),
  ));
  bd.addEventListener("click", (e) => { if (e.target === bd) finir(false); });
  window.addEventListener("keydown", auClavier, true);
  document.body.appendChild(bd);
  (champ || boutonOui).focus();
}
