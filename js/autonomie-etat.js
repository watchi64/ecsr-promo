// Travail en autonomie : interrupteur par promo (spec e-learning du 12/11). Éteint par défaut ; allumé, l'app enregistre pour
// chaque stagiaire les cours lus et le temps actif sur les cours et les QCM d'entraînement. Seul le fondateur le règle
// (Paramètres), et la base refuse de toute façon toute trace quand il est éteint (migration 20261114_autonomie_1_traces).
// Éteint, ce module ne fait qu'une lecture au démarrage (le réglage) : rien d'autre ne part, rien ne s'affiche.

import { getSetting, setSetting, getPromoCourante } from "./db.js?v=20261114b";
import { el, toast } from "./utils.js?v=20261114b";
import { icon } from "./icons.js?v=20261114b";
import { fondateurHorsApercu, isFounder, isEquipe, isAdmin, isProf, getViewAs, getProfile, getAffectations, monStagiaireId }
  from "./auth-admin.js?v=20261114b";
import { CLE_ACTIVATION, estActif, peutTracerAvec, estCompteEquipe } from "./autonomie-rules.js?v=20261114b";

let actif = false;
let jetonLecture = 0;

// Lu au démarrage (la promo courante est connue) ; une lecture qui échoue laisse éteint.
// Bornée comme celle de l'émargement : au-delà de 3,5 s, l'app démarre éteinte pour l'autonomie.
// L'état repart d'éteint à chaque lecture : une relecture qui échoue ou traîne ne laisse jamais un « allumé » d'avant (autre
// promo, réglage changé). Seule la dernière lecture demandée compte : une plus ancienne qui répond en retard est ignorée.
export async function chargerAutonomieActive() {
  actif = false;
  const jeton = ++jetonLecture;
  const lecture = getSetting(CLE_ACTIVATION).then(
    (v) => { if (jeton === jetonLecture) actif = estActif(v); },
    () => { if (jeton === jetonLecture) actif = false; });
  await Promise.race([lecture, new Promise((r) => setTimeout(r, 3500))]);
  return actif;
}

export function autonomieActive() { return actif; }

// Vrai pour un VRAI compte stagiaire seulement, interrupteur allumé : ni aperçu, ni compte d'équipe (même avec une fiche
// stagiaire). Les conditions d'utilisation sont exigées par la porte de l'app (js/legal.js, exigerAcceptation) et par la base.
export function peutTracer() {
  const equipe = estCompteEquipe({
    droits: { equipe: isEquipe(), admin: isAdmin(), prof: isProf() }, profil: getProfile(), affectations: getAffectations(),
  });
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
    + "QCM d'entraînement. Le stagiaire voit la même page que ses formateurs et la direction du centre. Éteint, plus rien "
    + "n'est enregistré ni affiché, pour personne ; ce qui l'a été reste en base et réapparaît si on le rallume."));
  const caseActif = el("input", { type: "checkbox", id: "autonomie-actif" });
  caseActif.checked = actif;
  caseActif.addEventListener("change", async () => {
    const voulu = caseActif.checked;
    caseActif.disabled = true;
    try {
      await setSetting(CLE_ACTIVATION, voulu ? "true" : "false");
      jetonLecture++;   // une lecture encore en vol ne défait pas ce réglage
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
