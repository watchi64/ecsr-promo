// Console des signalements, et carte d'un signalement — partagée avec le panneau de
// l'éditeur de QCM. Une seule fonction produit la carte : les deux écrans ne peuvent
// donc pas diverger dans leur présentation.
//
// Ce module ne connaît PAS l'éditeur : il reçoit `onOuvrirEditeur` de la part de
// themes.js. Importer themes.js ici créerait un import circulaire entre deux vues.

import { el, formatDate } from "../utils.js?v=20260801e";
import { etatInstruction, corpsAnalyse, morceaux } from "../qcm-signalement-rules.js?v=20260801e";

export const MOTIF_LABELS = {
  reponse_fausse: "Réponse fausse",
  enonce_ambigu: "Énoncé ambigu ou incomplet",
  explication: "Explication fausse ou peu claire",
  doublon: "Question en double",
  autre: "Autre",
};

// Les URL de l'analyse deviennent cliquables SANS innerHTML : le texte vient de l'agent.
function enLiens(texte) {
  return morceaux(texte).map((m) => (m.lien
    ? el("a", { href: m.valeur, target: "_blank", rel: "noopener" }, m.valeur)
    : m.valeur));
}

// L'avis de l'agent d'instruction, SOUS les boutons de décision et volontairement gris :
// le vert et le rouge restent la signature des deux boutons, donc de la décision du
// formateur. Un avis ne doit jamais se lire comme un classement déjà fait.
function encartInstruction(s) {
  const etat = etatInstruction(s);
  if (!etat.instruit) {
    return el("p", { class: "qcm-signal-instr-vide" }, "Pas encore instruit.");
  }
  const analyse = el("div", { class: "qcm-signal-instr-analyse" });
  corpsAnalyse(etat.analyse).forEach((ligne) => {
    analyse.appendChild(el("p", { class: "qcm-signal-instr-ligne" }, ...enLiens(ligne)));
  });
  return el("details", { class: "qcm-signal-instr" },
    el("summary", { class: "qcm-signal-instr-tete" },
      el("span", { class: "qcm-signal-instr-titre" }, "Instruction automatique — avis, pas décision"),
      el("span", { class: "qcm-signal-instr-conclusion" }, etat.libelle + " — " + etat.conclusion),
      el("span", { class: "qcm-signal-instr-plus" }, "Voir l'analyse ▾"),
      el("span", { class: "qcm-signal-instr-date" },
        etat.instruitAt ? "instruit le " + formatDate(etat.instruitAt) : ""),
    ),
    analyse,
  );
}

// La carte d'un signalement. Ordre imposé : contexte, meta, motif, réponse visée,
// commentaire, boutons de décision, puis l'avis. C'est l'ordre déjà en production.
export function carteSignalement(s, { numero = null, contexte = null, onClasser, onOuvrirEditeur = null } = {}) {
  const traite = el("button", { class: "btn small primary", type: "button" }, "Corrigé");
  const rejete = el("button", { class: "btn small ghost", type: "button" }, "Rien à corriger");
  traite.addEventListener("click", () => onClasser("traite", traite));
  rejete.addEventListener("click", () => onClasser("rejete", rejete));
  const actions = el("div", { class: "qcm-signal-item-actions" }, traite, rejete);
  if (onOuvrirEditeur) {
    const ouvrir = el("button", { class: "btn small ghost", type: "button" }, "Ouvrir dans l'éditeur");
    ouvrir.addEventListener("click", () => onOuvrirEditeur(s));
    actions.appendChild(ouvrir);
  }
  return el("div", { class: "qcm-signal-item" },
    contexte ? el("span", { class: "qcm-signal-item-contexte" }, contexte) : null,
    el("span", { class: "qcm-signal-item-meta" },
      (numero ? `Question ${numero} · ` : "") + (s.email || "anonyme") + " · " + formatDate(s.created_at)),
    el("span", { class: "qcm-signal-item-motif" }, MOTIF_LABELS[s.motif] || s.motif),
    // Le texte de l'option TEL QUE L'ÉLÈVE L'A VU : les options étant mélangées à
    // l'affichage, sa lettre ne veut rien dire ici, mais son texte, si.
    s.option_texte
      ? el("span", { class: "qcm-signal-item-option" }, "Réponse visée : " + s.option_texte)
      : null,
    s.commentaire ? el("span", { class: "qcm-signal-item-comment" }, "« " + s.commentaire + " »") : null,
    actions,
    encartInstruction(s),
  );
}
