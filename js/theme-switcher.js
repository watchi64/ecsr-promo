/**
 * Thème unique : Mint éditorial (défini dans :root du CSS).
 * Plus de switcher. Fonctions conservées en no-op pour compatibilité d'import.
 */

export const THEMES = [];

export function loadTheme() {
  document.documentElement.removeAttribute("data-theme");
  return "mint";
}

export function setTheme() { /* no-op */ }

export function getTheme() { return "mint"; }
