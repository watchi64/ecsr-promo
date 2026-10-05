// Sous-onglets réutilisables à l'intérieur d'une vue (Mon suivi, Notes…).
// Une barre segmentée + un panneau qui bascule au clic. Le rendu de chaque
// onglet est paresseux (appelé à l'activation), donc on peut y mettre du lourd.

import { el, clear } from "./utils.js?v=20261005e";
import { moduleVisible, moduleMasque, repereMasque } from "./modules-etat.js?v=20261005e";

// tabs = [{ key, label, render(panel), module? }].
// module : clé du catalogue (js/modules-data.js). Fermé pour la promo, le
// sous-onglet disparaît chez un stagiaire et porte le repère chez un formateur.
// opts.activeKey : onglet initial ; opts.storageKey : mémorise le dernier onglet choisi.
// opts.onChange(key) : appelé quand l'utilisateur choisit un onglet (pas au rendu
// initial). opts.avantChangement() : renvoie false pour garder l'onglet affiché
// (saisie en cours qu'on ne veut pas perdre).
// Retourne l'élément conteneur (barre + panneau). S'il ne reste qu'un onglet, la
// barre n'est pas affichée : le contenu s'affiche directement.
export function renderSubTabs(tousLesOnglets, opts = {}) {
  const tabs = tousLesOnglets.filter((t) => !t.module || moduleVisible(t.module));
  const { activeKey, storageKey, onChange, avantChangement } = opts;
  const wrap = el("div", { class: "subtabs" });
  const bar = el("div", { class: "subtabs-bar", role: "tablist" });
  const panel = el("div", { class: "subtabs-panel" });

  let stored = null;
  if (storageKey) { try { stored = localStorage.getItem(storageKey); } catch (e) { stored = null; } }
  let current = activeKey || stored || (tabs[0] && tabs[0].key);
  if (!tabs.some((t) => t.key === current)) current = tabs[0] && tabs[0].key;

  const buttons = {};
  let gen = 0;   // jeton d'activation : permet à un rendu asynchrone de savoir s'il est
                 // toujours le rendu courant (sinon il doit s'abstenir d'écrire le panneau).
  function activate(key, parUtilisateur = false) {
    if (parUtilisateur && avantChangement && !avantChangement()) return;
    current = key;
    const myGen = ++gen;
    if (storageKey) { try { localStorage.setItem(storageKey, key); } catch (e) { /* ignore */ } }
    Object.entries(buttons).forEach(([k, b]) => {
      const on = k === key;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    clear(panel);
    const tab = tabs.find((t) => t.key === key);
    if (tab) tab.render(panel, { isActive: () => current === key && gen === myGen });
    if (parUtilisateur && onChange) onChange(key);
  }

  tabs.forEach((t) => {
    const b = el("button", { class: "subtab", type: "button", role: "tab",
      onClick: () => activate(t.key, true) }, t.label);
    if (t.module) repereMasque(b, moduleMasque(t.module));
    buttons[t.key] = b;
    bar.appendChild(b);
  });
  if (tabs.length > 1) wrap.appendChild(bar);
  wrap.appendChild(panel);
  if (current) activate(current);
  return wrap;
}
