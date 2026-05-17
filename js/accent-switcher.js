/**
 * Accent fixe (vert mint dans :root). No-op pour compat d'import.
 */
export function loadAccent() {
  document.documentElement.removeAttribute("data-accent");
  return "mint";
}
export function setAccent() { /* no-op */ }
export function getAccent() { return "mint"; }
export function renderAccentSwitcher() {
  const span = document.createElement("span");
  return span;
}
