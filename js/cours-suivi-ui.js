// Branchement du compteur de page sur le lecteur de cours (spec e-learning du 12/11) : section vue, fin du cours,
// reprise de lecture. Appelé par openCoursSheet seulement pour un vrai compte stagiaire (autonomie allumée) ; hors de
// ce cas, ce module n'est jamais appelé et le lecteur ne change en rien.

import { el } from "./utils.js?v=20261113a";
import { tracerCours, listerMesLectures } from "./db.js?v=20261113a";
import { suivreEcran } from "./autonomie-suivi.js?v=20261113a";
import { sectionDeReprise, sectionEnHaut, repriseDepassee } from "./autonomie-rules.js?v=20261113a";

/** Repère invisible, à poser après le dernier bloc du cours (avant les boutons de fin) : quand il entre dans la zone de
 *  lecture, la fin du cours est atteinte. */
export function creerRepereFin() {
  return el("div", { class: "cours-fin-repere", "aria-hidden": "true", style: "height:1px" });
}

/**
 * Démarre le suivi d'un cours rendu. À appeler après le rendu.
 *  - `cours` : la ligne du cours (id) ; `defilement` : la zone qui défile ; `overlay` : la fiche, où s'insère le bandeau
 *    sous l'en-tête (`apres` : l'élément devant lequel l'insérer, la zone de défilement) ;
 *  - `sections` : les titres de niveau 2 ({ id }) ; `repere` : le repère de fin posé par creerRepereFin() ;
 *  - `estFerme()` : vrai quand la fiche est fermée (la reprise, asynchrone, ne touche alors plus à rien).
 * Renvoie { arreter() } : retire écouteurs, observateur, minuterie et bandeau, et envoie le dernier temps.
 */
export function brancherSuiviCours({ cours, defilement, overlay, sections, repere, estFerme }) {
  if (!cours || cours.id == null) return null;
  const suivi = suivreEcran({
    zone: defilement,
    ecrire: ({ secondes, fin, section }) => tracerCours(cours.id, { secondes, fin, section }),
  });
  let bandeau = null;
  let departReprise = 0;
  let termine = false;

  // Section « en haut » : le dernier titre de niveau 2 passé le haut de la zone. Seul l'id du titre est retenu.
  const majSection = () => {
    const positions = [];
    for (const s of sections) {
      const titre = document.getElementById(s.id);
      if (titre) positions.push({ id: s.id, haut: titre.offsetTop });
    }
    const id = sectionEnHaut(positions, defilement.scrollTop, 80);
    if (id) suivi.section(id);
  };

  const retirerBandeau = () => { if (bandeau) { bandeau.remove(); bandeau = null; } };
  const auDefilement = () => {
    majSection();
    if (bandeau && repriseDepassee(departReprise, defilement.scrollTop, defilement.clientHeight)) retirerBandeau();
  };
  defilement.addEventListener("scroll", auDefilement, { passive: true });

  let observateur = null;
  if (repere && typeof IntersectionObserver === "function") {
    observateur = new IntersectionObserver((entrees) => {
      if (entrees.some((e) => e.isIntersecting)) {
        suivi.finAtteinte();
        observateur.disconnect();
      }
    }, { root: defilement });
    observateur.observe(repere);
  }

  // Reprise : la lecture ne retarde jamais l'affichage du cours, un échec est silencieux.
  listerMesLectures().then((lectures) => {
    if (termine || estFerme()) return;
    if (defilement.scrollTop > 0) return;          // le stagiaire a déjà commencé à défiler : on ne le déplace pas
    const lecture = (lectures || []).find((l) => String(l.cours_id) === String(cours.id));
    const id = sectionDeReprise(lecture, sections.map((s) => s.id));
    const titre = id ? document.getElementById(id) : null;
    if (!titre) return;
    suivi.defilementAutomatique(() => { defilement.scrollTop = Math.max(0, titre.offsetTop - 8); });
    departReprise = defilement.scrollTop;
    const revenir = el("button", { class: "btn", type: "button" }, "Revenir au début");
    revenir.addEventListener("click", () => {
      suivi.geste();                 // le clic est un vrai geste (il est hors de la zone) ; le défilement qui suit, non
      suivi.defilementAutomatique(() => { defilement.scrollTop = 0; });
      retirerBandeau();
    });
    bandeau = el("div", { class: "cours-reprise", role: "status" },
      el("span", { class: "cours-reprise-texte" }, "Tu reprends où tu en étais"), revenir);
    overlay.insertBefore(bandeau, defilement);
  }).catch(() => { /* lecture impossible : le cours s'ouvre au début, sans rien dire */ });

  return {
    arreter() {
      if (termine) return;
      termine = true;
      defilement.removeEventListener("scroll", auDefilement, { passive: true });
      if (observateur) observateur.disconnect();
      retirerBandeau();
      suivi.arreter();
    },
  };
}
