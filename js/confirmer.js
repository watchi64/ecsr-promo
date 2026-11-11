// Demander confirmation d'un geste qui efface, dans une fenêtre de l'app plutôt que par la boîte du navigateur
// (confirm()) : le robot des parcours et le vérificateur comptent une boîte native comme un défaut, et elle ne suit ni
// l'habillage ni la taille de l'écran. Même fenêtre que la fermeture d'un examen (confirmerFermeture, js/views/themes.js).
// « Annuler », Échap ou un toucher à côté répondent non. Le clavier s'écoute sur la fenêtre du navigateur (window), en
// capture, donc avant tout le reste : aucune touche ne va plus loin (ni Échap vers l'écran « Saisir », l'assistant ou la
// fiche d'un stagiaire restée dessous, ni Ctrl+Z vers le retour en arrière de la page), sans que rien d'autre soit
// empêché (Entrée et Espace activent toujours le bouton qui a le focus), et Tab passe d'un bouton à l'autre sans sortir.
// Contrairement à la boîte du navigateur, la page continue de vivre pendant la question : un changement d'adresse (le
// Retour du téléphone) la referme, réponse non ; l'appelant qui garde un état doit vérifier qu'il n'a pas changé. Le focus va au bouton du geste, puis
// revient où il était (le champ suivant de l'écran « Saisir ») s'il est encore dans la page.
// La fenêtre s'ouvre au tour suivant : demandée pendant qu'on quitte un champ par Tab ou Entrée, elle laisse le focus
// arriver au champ suivant avant de s'ouvrir ; au toucher, « Retour » va au bout. À la souris, le clic qui a fait quitter
// le champ peut finir sur la fenêtre : on le refait après avoir répondu.
// Options : `danger` (vrai par défaut : bouton rouge ; faux pour un geste qui n'efface rien, bouton vert) ; `signal`
// (AbortSignal) referme la fenêtre de lui-même, réponse non (la fin du temps d'un examen). La fenêtre passe au-dessus
// de tout ce qui couvre l'écran, l'examen QCM compris (classe `confirmer-fond`, css/style.css), sous les messages du bas.
// `demander()` : la même fenêtre avec un champ (à la place de prompt()) ; promesse du texte tapé, ou null. Options en
// plus : `libelle` (nomme le champ), `valeur` (texte de départ, sélectionné), `verifier` (texte -> vrai si accepté) et
// `erreur` (dite dans la fenêtre, qui reste ouverte, quand `verifier` refuse : une confirmation à taper).
// Geste irréversible (page Qualiopi, conservation des données, lot Q5) : la question de `confirmer()` peut porter `part` et
// `reste` (ce qui est effacé, ce qui reste, en listes) et `saisie` ({ consigne, verifier }) : un champ où taper le mot ou le
// prénom demandé. Le bouton du geste reste inactif (et hors du tour de Tab) tant que `verifier(texte)` ne répond pas vrai ;
// sans `verifier`, il ne s'active jamais. Entrée dans le champ vaut le bouton. La réponse reste oui ou non.
// Testé par tests/confirmer.test.mjs.

import { el } from "./utils.js?v=20261111d";

let compteur = 0;

export function confirmer(question) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (question.signal?.aborted) resolve(false);
      else ouvrir(question, resolve, null);
    }, 0);
  });
}

export function demander(question) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (question.signal?.aborted) resolve(null);
      else ouvrir(question, resolve, { libelle: question.libelle, valeur: question.valeur ?? "",
        verifier: question.verifier, erreur: question.erreur });
    }, 0);
  });
}

// `saisie` : null pour une question oui/non (réponse true/false), sinon le champ (réponse : le texte, ou null).
// `aTaper` : la confirmation par saisie d'un geste irréversible (option `saisie` de confirmer()), réponse true/false.
function ouvrir({ titre, phrase = null, part = null, reste = null, saisie: aTaper = null, oui, non = "Annuler", danger = true,
  signal = null }, resolve, saisie) {
  if (saisie) aTaper = null;
  const avant = document.activeElement;
  const id = `confirmer-titre-${++compteur}`;
  const bd = el("div", { class: "modal-backdrop confirmer-fond" });
  let fini = false;
  const finir = (reponse, rendreLeFocus = true) => {
    if (fini) return;
    fini = true;
    window.removeEventListener("keydown", auClavier, true);
    window.removeEventListener("hashchange", surAbandon);
    signal?.removeEventListener("abort", surAbandon);
    bd.remove();
    if (rendreLeFocus && avant && avant !== document.body && avant.isConnected && typeof avant.focus === "function") avant.focus();
    resolve(reponse);
  };
  const refus = saisie ? null : false;
  const surAbandon = () => finir(refus, false);
  const champ = saisie || aTaper ? el("input", { type: "text", id: id + "-champ", autocomplete: "off",
    ...(aTaper ? { autocapitalize: "off", spellcheck: "false" } : {}) }) : null;
  if (champ) champ.value = saisie ? saisie.valeur : "";
  const alerte = saisie ? el("p", { class: "confirmer-erreur", role: "alert" }) : null;
  const saisieJuste = () => !aTaper || (typeof aTaper.verifier === "function" && aTaper.verifier(champ.value) === true);
  const valider = () => {
    if (aTaper) { if (saisieJuste()) finir(true); return; }
    if (!saisie) { finir(true); return; }
    if (saisie.verifier && !saisie.verifier(champ.value)) {
      alerte.textContent = saisie.erreur || "Saisie différente.";
      champ.focus();
      return;
    }
    finir(champ.value);
  };
  const boutonNon = el("button", { class: "btn ghost", type: "button", onClick: () => finir(refus) }, non);
  const boutonOui = el("button", { class: danger ? "btn danger" : "btn primary", type: "button", onClick: valider }, oui);
  // Le geste d'une confirmation par saisie attend la bonne saisie : inactif, et hors du tour de Tab, jusque-là.
  const majBouton = () => {
    const juste = saisieJuste();
    boutonOui.disabled = !juste;
    boutonOui.setAttribute("aria-disabled", juste ? "false" : "true");
  };
  if (aTaper) { champ.addEventListener("input", majBouton); majBouton(); }
  const ordre = () => [champ, boutonNon, boutonOui.disabled ? null : boutonOui].filter(Boolean);
  function auClavier(e) {
    e.stopPropagation();
    if (e.key === "Escape") { finir(refus); return; }
    if (e.key === "Enter" && champ && document.activeElement === champ) { e.preventDefault(); valider(); return; }
    if (e.key !== "Tab") return;
    e.preventDefault();
    // Tab et Maj+Tab font le tour de la fenêtre sans en sortir ; un focus sorti de la fenêtre y revient.
    const tour = ordre();
    const i = tour.indexOf(document.activeElement);
    const pas = e.shiftKey ? -1 : 1;
    const suivant = i < 0 ? (e.shiftKey ? tour.length - 1 : 0) : (i + pas + tour.length) % tour.length;
    tour[suivant].focus();
  }
  const listeTitree = (titreListe, items) => (items && items.length
    ? [el("p", { class: "confirmer-liste-titre" }, titreListe), el("ul", { class: "confirmer-liste" }, ...items.map((x) => el("li", {}, x)))]
    : []);
  const detaillee = !!(part?.length || reste?.length || aTaper);
  bd.appendChild(el("div", { class: "modal" + (detaillee ? " confirmer-detaille" : ""), role: "dialog", "aria-modal": "true", "aria-labelledby": id },
    el("h3", { id }, titre),
    phrase ? el("p", { class: "muted", style: "margin:0 0 0.8rem" }, phrase) : null,
    ...listeTitree("Ce qui est effacé", part),
    ...listeTitree("Ce qui reste", reste),
    champ ? el("label", { class: "confirmer-champ", for: champ.getAttribute("id") }, (saisie ? saisie.libelle : aTaper.consigne) || "", champ) : null,
    alerte,
    el("div", { class: "modal-actions" }, boutonNon, boutonOui),
  ));
  bd.addEventListener("click", (e) => { if (e.target === bd) finir(refus); });
  window.addEventListener("keydown", auClavier, true);
  window.addEventListener("hashchange", surAbandon);
  signal?.addEventListener("abort", surAbandon);
  document.body.appendChild(bd);
  if (champ) { champ.focus(); if (saisie) champ.select(); } else boutonOui.focus();
}
