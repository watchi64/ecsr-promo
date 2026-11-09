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
// Options : `danger` (vrai par défaut : bouton rouge ; faux pour un geste qui n'efface rien, bouton vert) ; `signal`
// (AbortSignal) referme la fenêtre de lui-même, réponse non (la fin du temps d'un examen). La fenêtre passe au-dessus
// de tout ce qui couvre l'écran, l'examen QCM compris (classe `confirmer-fond`, css/style.css), sous les messages du bas.
// Testé par tests/confirmer.test.mjs.

import { el } from "./utils.js?v=20261109k";

let compteur = 0;

export function confirmer(question) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (question.signal?.aborted) resolve(false);
      else ouvrir(question, resolve);
    }, 0);
  });
}

function ouvrir({ titre, phrase = null, oui, non = "Annuler", danger = true, signal = null }, resolve) {
  const avant = document.activeElement;
  const id = `confirmer-titre-${++compteur}`;
  const bd = el("div", { class: "modal-backdrop confirmer-fond" });
  let fini = false;
  const finir = (reponse, rendreLeFocus = true) => {
    if (fini) return;
    fini = true;
    window.removeEventListener("keydown", auClavier, true);
    signal?.removeEventListener("abort", surAbandon);
    bd.remove();
    if (rendreLeFocus && avant && avant !== document.body && avant.isConnected && typeof avant.focus === "function") avant.focus();
    resolve(reponse);
  };
  const surAbandon = () => finir(false, false);
  const boutonNon = el("button", { class: "btn ghost", type: "button", onClick: () => finir(false) }, non);
  const boutonOui = el("button", { class: danger ? "btn danger" : "btn primary", type: "button", onClick: () => finir(true) }, oui);
  function auClavier(e) {
    if (e.key === "Escape") { e.stopPropagation(); finir(false); return; }
    if (e.key !== "Tab") return;
    e.preventDefault();
    e.stopPropagation();
    // Deux boutons : Tab comme Maj+Tab passent à l'autre ; un focus sorti de la fenêtre y revient.
    const ici = document.activeElement;
    if (ici === boutonOui) boutonNon.focus();
    else if (ici === boutonNon) boutonOui.focus();
    else (e.shiftKey ? boutonOui : boutonNon).focus();
  }
  bd.appendChild(el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": id },
    el("h3", { id }, titre),
    phrase ? el("p", { class: "muted", style: "margin:0 0 0.8rem" }, phrase) : null,
    el("div", { class: "modal-actions" }, boutonNon, boutonOui),
  ));
  bd.addEventListener("click", (e) => { if (e.target === bd) finir(false); });
  window.addEventListener("keydown", auClavier, true);
  signal?.addEventListener("abort", surAbandon);
  document.body.appendChild(bd);
  boutonOui.focus();
}
