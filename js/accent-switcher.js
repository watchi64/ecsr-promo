/**
 * Palette switcher — change l'accent racing en 1 clic.
 * Persisté en localStorage. Applique data-accent="..." sur <html>.
 */

import { el, clear, toast } from "./utils.js";

const STORAGE_KEY = "ecsr_accent";

const PRESETS = [
  { key: "brique",     label: "Brique",     hex: "#B91C1C", note: "racing vintage" },
  { key: "ferrari",    label: "Ferrari",    hex: "#DC2626", note: "vif" },
  { key: "oxblood",    label: "Oxblood",    hex: "#7F1D1D", note: "luxe, cuir" },
  { key: "terracotta", label: "Terracotta", hex: "#C2410C", note: "argile chaude" },
];

export function loadAccent() {
  const saved = localStorage.getItem(STORAGE_KEY) || "brique";
  document.documentElement.setAttribute("data-accent", saved);
  return saved;
}

export function setAccent(key) {
  document.documentElement.setAttribute("data-accent", key);
  localStorage.setItem(STORAGE_KEY, key);
}

export function getAccent() {
  return document.documentElement.getAttribute("data-accent") || "brique";
}

export function renderAccentSwitcher() {
  const current = getAccent();
  const wrap = el("div", { class: "accent-switcher" });

  const trigger = el("button", { class: "accent-trigger", "aria-label": "Changer l'accent" },
    el("span", { class: "accent-swatch", style: `background: var(--accent)` })
  );

  const popover = el("div", { class: "accent-popover hidden" });
  popover.appendChild(el("p", { class: "accent-popover-title" }, "Accent"));
  PRESETS.forEach((p) => {
    const item = el("button", {
      class: "accent-option" + (p.key === current ? " selected" : ""),
      onClick: () => {
        setAccent(p.key);
        // re-render swatch + selected state
        trigger.firstChild.style.background = p.hex;
        popover.querySelectorAll(".accent-option").forEach((n) => n.classList.toggle("selected", n.dataset.key === p.key));
        toast("Accent : " + p.label, "success", 1200);
      },
      dataset: { key: p.key },
    },
      el("span", { class: "accent-swatch", style: `background: ${p.hex}` }),
      el("span", { class: "accent-info" },
        el("span", { class: "accent-label" }, p.label),
        el("span", { class: "accent-note muted" }, p.note),
      ),
    );
    popover.appendChild(item);
  });

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    popover.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) popover.classList.add("hidden");
  });

  wrap.appendChild(trigger);
  wrap.appendChild(popover);
  return wrap;
}
