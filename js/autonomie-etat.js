// Travail en autonomie : interrupteur par promo (spec e-learning du 12/11). Éteint par défaut ; allumé, l'app enregistre pour
// chaque stagiaire les cours lus et le temps actif sur les cours et les QCM d'entraînement. Seul le fondateur le règle
// (Paramètres), et la base refuse de toute façon toute trace quand il est éteint (migration 20261114_autonomie_1_traces).
// Éteint, ce module ne fait qu'une lecture au démarrage (le réglage) : rien d'autre ne part, rien ne s'affiche.

import { getSetting, setSetting, getPromoCourante } from "./db.js?v=20261112e";
import { el, toast } from "./utils.js?v=20261112e";
import { icon } from "./icons.js?v=20261112e";
import { fondateurHorsApercu, isFounder, isEquipe, isAdmin, isProf, getViewAs, getProfile, getAffectations, monStagiaireId }
  from "./auth-admin.js?v=20261112e";
import { CLE_ACTIVATION, estActif, peutTracerAvec } from "./autonomie-rules.js?v=20261112e";

let actif = false;

// Lu au démarrage (la promo courante est connue) ; une lecture qui échoue laisse éteint.
// Bornée comme celle de l'émargement : au-delà de 3,5 s, l'app démarre éteinte pour l'autonomie.
export async function chargerAutonomieActive() {
  const lecture = getSetting(CLE_ACTIVATION).then((v) => { actif = estActif(v); }, () => { actif = false; });
  await Promise.race([lecture, new Promise((r) => setTimeout(r, 3500))]);
  return actif;
}

export function autonomieActive() { return actif; }

// Vrai pour un VRAI compte stagiaire seulement, interrupteur allumé : ni aperçu, ni compte d'équipe (même avec une fiche
// stagiaire). Les conditions d'utilisation sont exigées par la porte de l'app (js/legal.js, exigerAcceptation) et par la base.
export function peutTracer() {
  const equipe = isEquipe() || isAdmin() || isProf() || !!getProfile()?.is_admin || getAffectations().length > 0;
  return peutTracerAvec({
    actif, apercu: getViewAs(), fondateur: isFounder(), equipe, stagiaireId: monStagiaireId(),
  });
}

// Section de Paramètres, visible du seul fondateur (hors aperçu : en aperçu la base refuse l'écriture).
export function renderAutonomieReglage() {
  if (!fondateurHorsApercu()) return null;
  const nomPromo = getPromoCourante()?.nom || "cette promo";
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.book()),
    el("div", {},
      el("h3", {}, "Travail en autonomie"),
      el("p", { class: "muted" }, "Réglage réservé au fondateur, propre à la promo affichée."),
    ),
  ));
  const bloc = el("div", { class: "param-block" });
  bloc.appendChild(el("p", { class: "muted" },
    "Allumé, l'app enregistre pour chaque stagiaire de la promo les cours lus et le temps passé sur les cours et les "
    + "QCM d'entraînement. Le stagiaire voit ce que son formateur voit. Éteint, plus rien n'est enregistré ; "
    + "ce qui l'a été reste en base."));
  const caseActif = el("input", { type: "checkbox", id: "autonomie-actif" });
  caseActif.checked = actif;
  caseActif.addEventListener("change", async () => {
    const voulu = caseActif.checked;
    caseActif.disabled = true;
    try {
      await setSetting(CLE_ACTIVATION, voulu ? "true" : "false");
      actif = voulu;
      toast(voulu ? `Travail en autonomie activé pour ${nomPromo}.` : `Travail en autonomie désactivé pour ${nomPromo}.`, "success");
      window.dispatchEvent(new CustomEvent("autonomie-active"));
    } catch (e) {
      caseActif.checked = !voulu;
      toast("Erreur : " + (e?.message || e), "error");
    } finally {
      caseActif.disabled = false;
    }
  });
  bloc.appendChild(el("label", { for: "autonomie-actif", class: "invite-admin-toggle" },
    caseActif, ` Travail en autonomie activé pour « ${nomPromo} »`));
  section.appendChild(bloc);
  return section;
}
