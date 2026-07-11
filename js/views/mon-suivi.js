import { el, clear } from "../utils.js?v=20260712a";

export async function renderMonSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Espace personnel"),
      el("h2", {}, "Mon suivi"),
      el("p", { class: "subtitle" }, "Mes passages à venir et l'évolution de mes résultats."),
    ),
  ));
  container.appendChild(el("p", { class: "muted" }, "En construction."));
}
