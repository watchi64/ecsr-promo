// Console des signalements, et carte d'un signalement, partagée avec le panneau de
// l'éditeur de QCM. Une seule fonction produit la carte : les deux écrans ne peuvent
// donc pas diverger dans leur présentation.
//
// Ce module ne connaît PAS l'éditeur : il reçoit `onOuvrirEditeur` de la part de
// themes.js. Importer themes.js ici créerait un import circulaire entre deux vues.

import { el, clear, formatDate, toast } from "../utils.js?v=20260809f";
import { etatInstruction, corpsAnalyse, morceaux, grouperParVerdict } from "../qcm-signalement-rules.js?v=20260809f";
import { listTousSignalements, setQcmSignalementStatut, listStagiaires } from "../db.js?v=20260809f";
import { getAdminEmail } from "../auth-admin.js?v=20260809f";

export const MOTIF_LABELS = {
  reponse_fausse: "Réponse fausse",
  enonce_ambigu: "Énoncé ambigu ou incomplet",
  explication: "Explication fausse ou peu claire",
  doublon: "Question en double",
  autre: "Autre",
};

// Le nom de l'auteur d'un signalement. L'adresse ne suffit pas : dix des onze signalements
// de la base viennent de « arthur-gaelle@hotmail.fr », qui est celle de Gaëlle ANKPRA.
// Les abandons sont inclus : un signalement déposé avant un abandon garde son auteur.
let auteurs = null;

export async function chargerAuteurs() {
  if (auteurs) return;
  try {
    const liste = await listStagiaires({ includeInactive: true });
    auteurs = new Map(liste.map((st) => [st.id, [st.prenom, st.nom].filter(Boolean).join(" ")]));
  } catch (e) {
    // Sans la liste, on retombe sur l'adresse seule : dégradé, pas cassé.
    console.error("Noms des auteurs illisibles :", e);
    auteurs = new Map();
  }
}

function nomDe(s) {
  return (auteurs && s.stagiaire_id) ? (auteurs.get(s.stagiaire_id) || null) : null;
}

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
      el("span", { class: "qcm-signal-instr-titre" }, "Instruction automatique : avis, pas décision"),
      el("span", { class: "qcm-signal-instr-conclusion" }, etat.libelle + " : " + etat.conclusion),
      el("span", { class: "qcm-signal-instr-plus" }, "Voir l'analyse ▾"),
      el("span", { class: "qcm-signal-instr-date" },
        etat.instruitAt ? "instruit le " + formatDate(etat.instruitAt) : ""),
    ),
    analyse,
  );
}

// La carte d'un signalement, ordonnée par ce qu'on cherche en la lisant :
// ce qui est visé (surtitre + titre), puis le grief, puis QUI l'a écrit, puis la décision.
// L'identité descend en signature : elle situe le grief, elle ne s'annonce pas avant lui.
//
// `titre` est le repère du signalement dans son écran : l'énoncé de la question en console,
// « Question 7 » dans l'éditeur, où le rang suffit puisque la liste est sous les yeux.
export function carteSignalement(s, { titre = null, surtitre = null, onClasser, onOuvrirEditeur = null } = {}) {
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
  const nom = nomDe(s);
  return el("div", { class: "qcm-signal-item" },
    surtitre ? el("span", { class: "qcm-signal-item-surtitre" }, surtitre) : null,
    titre ? el("p", { class: "qcm-signal-item-titre" }, titre) : null,
    el("span", { class: "qcm-signal-item-motif" }, MOTIF_LABELS[s.motif] || s.motif),
    // Le texte de l'option TEL QUE L'ÉLÈVE L'A VU : les options étant mélangées à
    // l'affichage, sa lettre ne veut rien dire ici, mais son texte, si.
    s.option_texte
      ? el("span", { class: "qcm-signal-item-option" }, "Réponse visée : " + s.option_texte)
      : null,
    s.commentaire ? el("p", { class: "qcm-signal-item-comment" }, "« " + s.commentaire + " »") : null,
    // La signature : le nom d'abord, l'adresse ensuite. Une adresse partagée ou peu
    // parlante ne doit pas être le seul moyen de savoir qui a signalé.
    el("span", { class: "qcm-signal-item-meta" },
      (nom ? nom + " · " : "") + (s.email || "anonyme") + " · " + formatDate(s.created_at)),
    actions,
    encartInstruction(s),
  );
}

const STATUTS_CONSOLE = [
  { value: "ouvert", label: "Ouverts" },
  { value: "traite", label: "Corrigés" },
  { value: "rejete", label: "Écartés" },
  { value: "",       label: "Tout" },
];

// La console : tous les signalements au même endroit, rangés par ce qu'ils demandent
// comme travail. `themes` sert uniquement à retrouver le libellé d'un thème depuis son
// id, la console ne fait aucune requête sur les thèmes.
export async function renderConsoleSignalements(panel, { themes = [], onOuvrirEditeur = null, isActive = () => true } = {}) {
  let statut = "ouvert";
  const titreThemeDe = new Map(themes.map((t) => [t.id, (t.numero != null ? String(t.numero).padStart(2, "0") + " · " : "") + t.titre]));

  let gen = 0;   // chargements concurrents : seule la dernière demande a le droit d'écrire

  async function charger() {
    // Le panneau est partagé entre les sous-onglets. `charger()` peut être rappelé
    // APRÈS un await de l'appelant (classer() enchaîne sur lui) : si l'utilisateur a
    // changé d'onglet entre-temps, écrire ici effacerait ce qu'il regarde.
    if (!isActive()) return;
    const maGen = ++gen;
    clear(panel);
    panel.appendChild(el("div", { class: "loading" }, "Chargement"));
    let liste;
    try {
      await chargerAuteurs();
      liste = await listTousSignalements({ statut: statut || null });
    } catch (e) {
      // Journalisé : un échec muet est ce qui a rendu un défaut invisible le 2026-08-02.
      console.error("Signalements illisibles :", e);
      // Le panneau est partagé entre les sous-onglets : ne rien y écrire si l'utilisateur
      // est déjà reparti, sinon on efface l'onglet qu'il regarde.
      if (!isActive() || maGen !== gen) return;
      clear(panel);
      const reessayer = el("button", { class: "btn small", type: "button" }, "Réessayer");
      reessayer.addEventListener("click", () => { charger(); });
      panel.appendChild(el("div", { class: "signal-console-erreur" },
        el("p", {}, "Impossible de charger les signalements."), reessayer));
      return;
    }
    if (!isActive() || maGen !== gen) return;
    clear(panel);
    panel.appendChild(barre(liste.length));
    if (!liste.length) {
      panel.appendChild(el("p", { class: "signal-console-vide" },
        statut === "ouvert" ? "Aucun signalement ouvert." : "Aucun signalement pour ce filtre."));
      return;
    }
    grouperParVerdict(liste).forEach((groupe) => {
      panel.appendChild(el("h4", { class: "signal-console-groupe" },
        groupe.titre, el("span", { class: "signal-console-compte" }, groupe.items.length)));
      groupe.items.forEach((s) => panel.appendChild(carteConsole(s)));
    });
  }

  function barre(n) {
    const sel = el("select", { class: "signal-console-statut" },
      ...STATUTS_CONSOLE.map((s) => {
        const o = el("option", { value: s.value }, s.label);
        if (s.value === statut) o.selected = true;
        return o;
      }));
    sel.addEventListener("change", () => { statut = sel.value; charger(); });
    return el("div", { class: "signal-console-barre" },
      el("h3", {}, "⚑ " + n + " signalement" + (n > 1 ? "s" : "")), sel);
  }

  function carteConsole(s) {
    const qcm = s.question?.qcm || null;
    // Le titre du QCM n'est pas repris : il répète presque toujours celui du thème
    // (« Les ronds-points et sens giratoires » / « Les ronds-points et carrefours à sens
    // giratoire »), et cette redondance poussait la question en fin de ligne.
    // Thème absent de la liste : on retombe sur le titre du QCM plutôt que sur rien.
    const surtitre = titreThemeDe.get(qcm?.theme_id) || qcm?.titre || null;
    async function classer(st, bouton) {
      bouton.disabled = true;
      try {
        await setQcmSignalementStatut(s.id, st, getAdminEmail());
        toast(st === "traite" ? "Signalement classé comme corrigé." : "Signalement écarté.", "success");
        await charger();
      } catch (e) {
        bouton.disabled = false;
        toast("Échec : " + (e?.message || e), "error");
      }
    }
    // Pas de numéro de question : celui de l'éditeur est un rang dans la liste chargée,
    // pas la colonne `ordre`. Un numéro faux serait pire que pas de numéro. C'est l'énoncé
    // qui sert de titre, et il identifie sans ambiguïté.
    const carte = carteSignalement(s, { surtitre, titre: s.question?.enonce || null, onClasser: classer,
      onOuvrirEditeur: onOuvrirEditeur ? (sig) => onOuvrirEditeur(sig, charger) : null });
    // Détachées les unes des autres ici, et ici SEULEMENT : dans le panneau de l'éditeur
    // les signalements sont peu nombreux et un filet suffit, alors qu'en console ils
    // s'enchaînent et l'encart d'avis noie la limite entre deux cartes.
    carte.classList.add("signal-console-carte");
    return carte;
  }

  await charger();
}
