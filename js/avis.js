// Bandeau « Ton avis sur l'app », en tête de « Mon espace » (règles : avis-rules.js).
//
// Le choix (répondu, plus tard, ne plus afficher) est gardé sur l'appareil, propre au
// compte et à l'enquête. Aucune réponse au questionnaire ne passe par l'app.
import { el, isoDate } from "./utils.js?v=20261027a";
import { getPromoCourante } from "./db.js?v=20261027a";
import { isStagiaire, getAdminEmail } from "./auth-admin.js?v=20261027a";
import { AVIS, lireEtat, etatPlusTard, bandeauVisible } from "./avis-rules.js?v=20261027a";

function cle() {
  const compte = getAdminEmail();
  return compte ? `ecsr_avis:${AVIS.id}:${compte}` : null;
}

function lire() {
  const k = cle();
  if (!k) return null;
  try { return lireEtat(localStorage.getItem(k)); } catch (e) { return null; }
}

function ecrire(etat) {
  const k = cle();
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(etat)); } catch (e) { /* navigation privée : le bandeau reviendra */ }
}

// Renvoie le bandeau à insérer, ou null quand il n'a pas à s'afficher.
export function bandeauAvis() {
  const aujourdhui = isoDate(new Date());
  if (!bandeauVisible({
    promoId: getPromoCourante()?.id, stagiaire: isStagiaire(), aujourdhui, etat: lire(),
  })) return null;

  const bandeau = el("section", { class: "avis-bandeau", "aria-label": "Ton avis sur l'app" });
  const fermer = (etat) => { ecrire(etat); bandeau.remove(); };

  bandeau.append(
    el("div", { class: "avis-texte" },
      el("p", { class: "avis-titre" }, "Ton avis sur l'app, en 5 minutes"),
      el("p", { class: "avis-sous-titre" },
        "Huit questions pour améliorer l'outil. C'est anonyme : ni ton nom ni ton adresse ne sont demandés."),
    ),
    el("div", { class: "avis-actions" },
      el("a", { class: "btn primary small", href: AVIS.url, target: "_blank", rel: "noopener noreferrer" },
        "Donner mon avis"),
      el("button", { class: "btn ghost small", type: "button",
        onClick: () => fermer({ statut: "repondu" }) }, "J'ai répondu"),
      el("button", { class: "btn ghost small", type: "button",
        onClick: () => fermer(etatPlusTard(aujourdhui)) }, "Plus tard"),
      el("button", { class: "avis-refus", type: "button",
        onClick: () => fermer({ statut: "refuse" }) }, "Ne plus afficher"),
    ),
  );
  return bandeau;
}
