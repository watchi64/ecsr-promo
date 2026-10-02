// Onglet CCP1 (chantier D) : réunit ce qui sert au premier certificat du titre,
// « Former des apprenants conducteurs ». Chaque sous-onglet rend une vue
// existante, embarquée : sans son grand titre, l'onglet a le sien.
// Les sous-onglets et leurs modules sont déclarés dans js/modules-data.js
// (SOUS_ONGLETS_CCP1) ; ce fichier n'y ajoute que la façon de rendre chacun.
import { el, clear } from "../utils.js?v=20261002b";
import { renderSubTabs } from "../subtabs.js?v=20261002b";
import { SOUS_ONGLETS_CCP1 } from "../modules-data.js?v=20261002b";
import { STORAGE_SOUS_ONGLET } from "../nouveautes.js?v=20261002b";
import { renderThemes } from "./themes.js?v=20261002b";
import { renderNotes } from "./notes.js?v=20261002b";
import { renderEpcf } from "./epcf.js?v=20261002b";
import { renderEpcfLivret } from "./epcf-livret.js?v=20261002b";
import { renderDp } from "./dp.js?v=20261002b";

const RENDUS = {
  themes: { rendu: renderThemes, erreur: "Erreur de chargement des thèmes." },
  notes: { rendu: renderNotes, erreur: "Erreur de chargement des notes." },
  epcf: { rendu: renderEpcf, erreur: "Erreur de chargement de l'espace EPCF." },
  livret: { rendu: renderEpcfLivret, erreur: "Erreur de chargement du livret EPCF." },
  dp: { rendu: renderDp, erreur: "Erreur de chargement du dossier professionnel." },
};

// Rend une vue dans le panneau d'un sous-onglet. En cas d'échec, un message remplace
// le chargement, seulement si le panneau est encore celui de ce sous-onglet.
function embarquer({ rendu, erreur }) {
  return (panneau, ctx) => {
    const isActive = ctx && ctx.isActive;
    Promise.resolve()
      .then(() => rendu(panneau, { embedded: true, isActive }))
      .catch((e) => {
        console.error(e);
        if (isActive && !isActive()) return;
        clear(panneau);
        panneau.appendChild(el("p", { class: "muted" }, erreur + " Reviens sur l'onglet pour réessayer."));
      });
  };
}

export async function renderCcp1(container) {
  clear(container);
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Titre professionnel ECSR"),
      el("h2", {}, "CCP1"),
      el("p", { class: "subtitle" },
        "Former des apprenants conducteurs : thèmes et cours, notes, examens blancs, "
        + "livret et dossier professionnel."),
    ),
  ));
  const onglets = renderSubTabs(
    SOUS_ONGLETS_CCP1.map((s) => ({ ...s, render: embarquer(RENDUS[s.key]) })),
    { storageKey: STORAGE_SOUS_ONGLET.ccp1 },
  );
  onglets.classList.add("ccp1-onglets");
  container.appendChild(onglets);
}
