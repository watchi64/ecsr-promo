// Sous-onglets réutilisables à l'intérieur d'une vue (Mon suivi, Notes…).
// Une barre segmentée + un panneau qui bascule au clic. Le rendu de chaque
// onglet est paresseux (appelé à l'activation), donc on peut y mettre du lourd.

import { el, clear } from "./utils.js?v=20260714g";

// tabs = [{ key, label, render(panel) }].
// opts.activeKey : onglet initial ; opts.storageKey : mémorise le dernier onglet choisi.
// Retourne l'élément conteneur (barre + panneau).
export function renderSubTabs(tabs, opts = {}) {
  const { activeKey, storageKey } = opts;
  const wrap = el("div", { class: "subtabs" });
  const bar = el("div", { class: "subtabs-bar", role: "tablist" });
  const panel = el("div", { class: "subtabs-panel" });

  let stored = null;
  if (storageKey) { try { stored = localStorage.getItem(storageKey); } catch (e) { stored = null; } }
  let current = activeKey || stored || (tabs[0] && tabs[0].key);
  if (!tabs.some((t) => t.key === current)) current = tabs[0] && tabs[0].key;

  const buttons = {};
  function activate(key) {
    current = key;
    if (storageKey) { try { localStorage.setItem(storageKey, key); } catch (e) { /* ignore */ } }
    Object.entries(buttons).forEach(([k, b]) => {
      const on = k === key;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    clear(panel);
    const tab = tabs.find((t) => t.key === key);
    if (tab) tab.render(panel);
  }

  tabs.forEach((t) => {
    const b = el("button", { class: "subtab", type: "button", role: "tab",
      onClick: () => activate(t.key) }, t.label);
    buttons[t.key] = b;
    bar.appendChild(b);
  });
  wrap.appendChild(bar);
  wrap.appendChild(panel);
  if (current) activate(current);
  return wrap;
}
