// Paramètres › « Modules de la promo » (chantier B) : ouvrir ou fermer, pour la
// promo courante, les parties de l'app que voient les stagiaires.
//
// Réservé aux formateurs, et au seul fondateur tant que le multi-promo n'est pas
// en ligne (REGLAGE_OUVERT_AUX_FORMATEURS, js/modules-data.js). La section se
// redessine elle-même après chaque écriture : pas de rechargement de toute la
// page Paramètres.
import { el, toast } from "../utils.js?v=20261001a";
import { icon } from "../icons.js?v=20261001a";
import { MODULES, GROUPES } from "../modules-data.js?v=20261001a";
import { estOuvert, jourParis, accorder } from "../modules.js?v=20261001a";
import {
  etatModules, peutRegler, basculerModule, appliquerEnsembleDeDepart,
} from "../modules-etat.js?v=20261001a";

const SOCLE = "Toujours ouverts : Accueil, Mon espace personnel (Passages), Paramètres, Nouveautés.";

function nomDe(cle) {
  return MODULES.find((m) => m.cle === cle)?.nom || cle;
}

// « 12/10 » : jour d'ouverture en heure de Paris.
function jourCourt(iso) {
  const j = jourParis(iso);
  return j ? `${j.slice(8, 10)}/${j.slice(5, 7)}` : "";
}

// « Planning, Calendrier et Ressources »
function enumerer(noms) {
  if (noms.length < 2) return noms.join("");
  return noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1];
}

export function renderModulesSection() {
  if (!peutRegler()) return null;
  const etat = etatModules();

  const section = el("section", { class: "param-section modules-reglage" });
  const redessiner = () => {
    const suivante = renderModulesSection();
    if (suivante) section.replaceWith(suivante);
    else section.remove();
  };

  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.eyeOff()),
    el("div", {},
      el("h3", {}, "Modules de la promo"),
      el("p", { class: "muted" },
        "Ouvre les parties de l'app au fil de la formation. Une partie fermée est invisible "
        + "pour les stagiaires ; tu la vois toujours, avec le repère « Masqué aux stagiaires »."),
    ),
  ));

  if (etat.statut !== "reglee") section.appendChild(bandeauDepart(etat, redessiner));
  section.appendChild(el("p", { class: "modules-socle muted" }, SOCLE));

  for (const groupe of GROUPES) {
    const membres = MODULES.filter((m) => m.groupe === groupe);
    if (membres.length === 0) continue;
    section.appendChild(el("div", { class: "param-block modules-groupe" },
      el("h4", {}, groupe),
      ...membres.map((m) => ligneModule(m, etat, redessiner)),
    ));
  }
  return section;
}

function bandeauDepart(etat, redessiner) {
  const noms = enumerer(MODULES.filter((m) => m.depart).map((m) => m.nom));
  const bouton = el("button", { class: "btn primary", type: "button" }, "Partir de l'ensemble de départ");
  bouton.addEventListener("click", async () => {
    if (!confirm(`Seuls ${noms} resteront visibles pour les stagiaires. Continuer ?`)) return;
    bouton.disabled = true;
    try {
      await appliquerEnsembleDeDepart();
      // Message neutre : si la base portait déjà un réglage lisible (lecture de
      // démarrage ratée, autre formateur), appliquerEnsembleDeDepart le conserve.
      toast("Réglage des modules enregistré", "success");
      redessiner();
    } catch (e) {
      console.error(e);
      toast("Erreur : " + (e?.message || e), "error");
      bouton.disabled = false;
    }
  });
  return el("div", { class: "modules-bandeau" },
    el("p", {}, etat.statut === "illisible"
      ? "Réglage illisible : tout est ouvert pour cette promo."
      : "Aucun réglage : tout est ouvert pour cette promo."),
    bouton,
  );
}

function ligneModule(m, etat, redessiner) {
  const reglee = etat.statut === "reglee";
  // La case montre l'état propre du module : un enfant reste coché quand son
  // parent est fermé (fermer un parent ne touche pas ses enfants).
  const coche = !reglee || Object.prototype.hasOwnProperty.call(etat.ouverts, m.cle);
  const parentFerme = !!m.parent && !estOuvert(m.parent, etat, MODULES);
  const id = "module-case-" + m.cle;

  const caseACocher = el("input", { type: "checkbox", id });
  caseACocher.checked = coche;
  caseACocher.disabled = parentFerme;
  caseACocher.addEventListener("change", async () => {
    const ouvrir = caseACocher.checked;
    caseACocher.disabled = true;
    try {
      await basculerModule(m.cle, ouvrir);
      toast(`${m.nom} ${accorder(ouvrir ? "ouvert" : "masqué", m.accord)} aux stagiaires`, "success");
      redessiner();
    } catch (e) {
      console.error(e);
      toast("Erreur : " + (e?.message || e), "error");
      caseACocher.checked = !ouvrir;
      caseACocher.disabled = false;
    }
  });

  const mention = m.parent
    ? el("span", { class: "modules-parent muted" },
        (parentFerme ? "s'ouvre avec " : "dans ") + nomDe(m.parent))
    : null;
  const date = reglee && coche
    ? el("span", { class: "modules-date" },
        `${accorder("ouvert", m.accord)} le ${jourCourt(etat.ouverts[m.cle])}`)
    : null;

  return el("div", { class: "modules-ligne" + (m.parent ? " enfant" : "") },
    caseACocher,
    el("label", { for: id, class: "modules-libelle" },
      el("span", { class: "modules-nom" }, m.nom),
      mention,
      el("span", { class: "modules-explication muted" }, m.explication),
      date,
    ),
  );
}
