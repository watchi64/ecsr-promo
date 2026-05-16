/**
 * Switcher de thèmes complets — change bg, surface, text, accent en bloc.
 * Persisté en localStorage. Applique data-theme="..." sur <html>.
 *
 * Chaque thème modifie les variables CSS via [data-theme="key"] dans style.css.
 */

const STORAGE_KEY = "ecsr_theme";

export const THEMES = [
  {
    key: "creme",
    label: "Crème racing",
    note: "Le défaut — chaud, vintage",
    preview: { bg: "#F5E8D0", surface: "#FAF1DC", text: "#1A1612", accent: "#B91C1C" },
  },
  {
    key: "charcoal",
    label: "Charcoal",
    note: "Sombre, moderne, premium",
    preview: { bg: "#1A1612", surface: "#2A211C", text: "#F5E8D0", accent: "#E1B454" },
  },
  {
    key: "mint",
    label: "Mint éditorial",
    note: "Frais, contemporain",
    preview: { bg: "#F1F4F0", surface: "#FBFCFA", text: "#1F2924", accent: "#6B7F4E" },
  },
  {
    key: "sahara",
    label: "Sahara",
    note: "Désert doré, terre",
    preview: { bg: "#F0E4CF", surface: "#F8EFDC", text: "#3A2A14", accent: "#A0522D" },
  },
  {
    key: "nordic",
    label: "Nordique",
    note: "Bleu froid, scandinave",
    preview: { bg: "#F2F4F7", surface: "#FFFFFF", text: "#1B2638", accent: "#3D5A80" },
  },
  {
    key: "rose",
    label: "Rose poudré",
    note: "Doux, éditorial chic",
    preview: { bg: "#F7EBE6", surface: "#FDF6F2", text: "#2A1A1F", accent: "#A8324A" },
  },
];

export function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || "creme";
  document.documentElement.setAttribute("data-theme", saved);
  return saved;
}

export function setTheme(key) {
  document.documentElement.setAttribute("data-theme", key);
  localStorage.setItem(STORAGE_KEY, key);
}

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "creme";
}
