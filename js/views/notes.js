import {
  listStagiaires, listCompetences, listEvaluations, listThemes,
  addEvaluation, updateEvaluation, deleteEvaluation, listAuditForEvaluation,
  listUserProfiles, getNotesStatsGroupe, getPromoCourante,
} from "../db.js?v=20261110a";
import {
  statsLocales, statsServeur, moyenneGenerale, moyenneCompetence, moyenneThemes, statsParTheme,
} from "../notes-stats.js?v=20261110a";
import { el, clear, isoDate, formatDate, toast, displayStagiaire, compareByNom, largeurDeGraphe } from "../utils.js?v=20261110a";
import { icon } from "../icons.js?v=20261110a";
import { getAdminEmail, isAdmin, getProfile, monStagiaireId, getEspace } from "../auth-admin.js?v=20261110a";
import { litToutesLesNotes } from "../espaces-rules.js?v=20261110a";
import { recordUndo } from "../undo.js?v=20261110a";
import { renderSubTabs } from "../subtabs.js?v=20261110a";
import { formateurConnecte, moduleVisible } from "../modules-etat.js?v=20261110a";
import { navigationV2Active } from "../nav-etat.js?v=20261110a";
import { renderEpcf } from "./epcf.js?v=20261110a";
import { noteGradient } from "../echelle-notes.js?v=20261110a";
import { CLES_SOUS_ONGLETS } from "../nav-rules.js?v=20261110a";
import { renderSaisie } from "./notes-saisie.js?v=20261110a";
import {
  parseNoteInput, MATRIX_SPECIAL_COLS, THEME_GROUPS, derniereNote, champsDeCible, raisonEchecNote, etatVideNotes,
  contexteEtatVide, phraseNoteRefusee, confirmationEffacement,
} from "../notes-saisie-rules.js?v=20261110a";
import { confirmer } from "../confirmer.js?v=20261110a";

let userProfiles = [];  // pour résoudre l'anonymat par stagiaire_id

let stagiaires = [];
let competences = [];
let evaluations = [];
let themesOfficiels = [];  // les 57 thèmes du référentiel (chargés en + pour les titres dans la matrice)
// Moyennes du groupe calculées par le serveur, anonymes comprises (stagiaires en formation
// seulement, comme le calcul local : js/notes-stats.js) : un stagiaire ne lit que
// ses notes et celles des profils non masqués (règle de la base), il ne peut donc pas les
// calculer lui-même. Le formateur et la direction, qui lisent tout, calculent en local (saisies reflétées aussitôt).
let statsServeurGroupe = null;

// Le formateur et la direction du centre lisent toutes les notes, profils masqués compris (décision du 09/11).
function litTout() {
  return litToutesLesNotes({ admin: isAdmin(), espace: getEspace() });
}

function chargerStatsGroupe() {
  if (litTout()) return Promise.resolve(null);
  return getNotesStatsGroupe().then(statsServeur).catch((e) => { console.error(e); return null; });
}

function statsGroupe() {
  if (!litTout() && statsServeurGroupe) return statsServeurGroupe;
  return statsLocales(evaluations, new Set(stagiaires.map((s) => s.id)));
}

let filterStagiaire = "";
let filterType = "";
let currentEvalDate = null;  // Date appliquée aux nouvelles notes saisies dans la matrice
// Conteneurs où la vue est imbriquée dans Mon suivi (La classe : renderNotes(zone, { imbrique: true })) : le contexte
// décide de sa présentation, pas le rôle de la personne (un formateur qui a une fiche y ouvre aussi La classe).
const imbriques = new WeakSet();
// Conteneurs où la vue est posée sous la synthèse du centre (direction, lot 5) : même présentation que La classe (le titre est celui
// de la page qui l'héberge), mais la phrase de l'équipe plutôt que celle d'un stagiaire.
const dansLesCentres = new WeakSet();

const NOTES_SORT_OPTIONS = [
  { key: "default",   label: "Ordre par défaut" },
  { key: "alpha",     label: "Alphabétique" },
  { key: "avg-desc",  label: "Moyenne : meilleure d'abord" },
  { key: "avg-asc",   label: "Moyenne : plus faible d'abord" },
  { key: "nb-desc",   label: "Nombre de notes : plus d'abord" },
];

let currentNotesSort = localStorage.getItem("ecsr_notes_sort") || "default";

function stagiaireAvg(stagiaireId) {
  const evs = evaluations.filter((e) => e.stagiaire_id === stagiaireId && e.note != null && e.note_max);
  if (evs.length === 0) return null;
  return evs.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / evs.length;
}

function stagiaireNbNotes(stagiaireId) {
  return evaluations.filter((e) => e.stagiaire_id === stagiaireId && e.note != null).length;
}

function isStagiaireAnonymous(stagiaireId) {
  return userProfiles.some((p) => p.stagiaire_id === stagiaireId && p.anonymous_notes);
}

function displayName(s) {
  // Le formateur et la direction voient toujours le vrai nom (besoin métier : noter, repérer, suivre),
  // et chacun voit le sien. Filet de sécurité : "Anonyme" pour un profil masqué
  // (ces lignes sont normalement déjà retirées de la vue des autres stagiaires).
  if (litTout() || s.id === myStagiaireId()) return displayStagiaire(s);
  return isStagiaireAnonymous(s.id) ? "Anonyme" : displayStagiaire(s);
}

// === Anonymat renforcé : réciprocité ===
// Un stagiaire anonymisé disparaît (prénom ET notes) de la vue des autres
// stagiaires, et ne voit plus lui-même que sa propre ligne plus les moyennes du
// groupe. Les admins voient tout. Ses notes restent comptées dans tous les
// agrégats (Synthèse, moyennes par thème, distribution).
function myStagiaireId() {
  // Aucune fiche en aperçu formateur, direction ou siège (relecture finale, M8).
  return monStagiaireId();
}

function iAmAnonymous() {
  return !litTout() && !!getProfile()?.anonymous_notes;
}

function visibleStagiaires() {
  if (litTout()) return stagiaires;
  if (iAmAnonymous()) return stagiaires.filter((s) => s.id === myStagiaireId());
  return stagiaires.filter((s) => !isStagiaireAnonymous(s.id));
}

function hiddenCount() {
  return stagiaires.length - visibleStagiaires().length;
}

function sortStagiaires(list, mode) {
  // Les anonymes sont toujours en fin, peu importe le tri
  const anonymous = list.filter((s) => isStagiaireAnonymous(s.id));
  const visible = list.filter((s) => !isStagiaireAnonymous(s.id));
  const arr = visible.slice();
  switch (mode) {
    case "alpha":
      arr.sort(compareByNom);
      break;
    case "avg-desc":
      arr.sort((a, b) => (stagiaireAvg(b.id) ?? -1) - (stagiaireAvg(a.id) ?? -1) || compareByNom(a, b));
      break;
    case "avg-asc":
      arr.sort((a, b) => (stagiaireAvg(a.id) ?? 99) - (stagiaireAvg(b.id) ?? 99) || compareByNom(a, b));
      break;
    case "nb-desc":
      arr.sort((a, b) => stagiaireNbNotes(b.id) - stagiaireNbNotes(a.id));
      break;
    case "default":
    default:
      arr.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      break;
  }
  // anonymes à la fin, dans l'ordre par défaut
  anonymous.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  return [...arr, ...anonymous];
}

const TYPES_EVAL = ["Thème", "Compétence", "Contrôle"];

// MATRIX_SPECIAL_COLS et THEME_GROUPS vivent dans js/notes-saisie-rules.js (partagés avec l'écran « Saisir »).
const THEME_GROUP_LEADER = new Map();   // numero -> groupe (si numero ouvre le groupe)
const THEME_GROUP_FOLLOWER = new Set(); // numeros absorbés par la cellule fusionnée
THEME_GROUPS.forEach((g) => {
  THEME_GROUP_LEADER.set(g[0], g);
  g.slice(1).forEach((n) => THEME_GROUP_FOLLOWER.add(n));
});

function noteColor(note, max) {
  if (note == null || max == null) return "muted";
  const ratio = note / max;
  if (ratio < 0.4) return "bad";
  if (ratio < 0.6) return "warn";
  if (ratio < 0.8) return "ok";
  return "great";
}

function describeEval(e) {
  if (e.type === "Thème") {
    const num = e.theme_numero ? `Thème ${String(e.theme_numero).padStart(2, "0")}` : "Thème";
    return e.theme_titre ? `${num} · ${e.theme_titre}` : num;
  }
  if (e.type === "Compétence") {
    return e.competence_code ? `${e.competence_code} · ${e.competence?.libelle?.split(",")[0] || ""}` : "Compétence";
  }
  if (e.type === "Contrôle") {
    return e.controle_libelle || "Contrôle";
  }
  return "-";
}

function openEditModal(existing, onSaved) {
  const isNew = !existing;
  const backdrop = el("div", { class: "modal-backdrop" });

  const stagiaireSel = el("select");
  stagiaireSel.appendChild(el("option", { value: "" }, "-"));
  stagiaires.forEach((s) => {
    const opt = el("option", { value: s.id }, displayStagiaire(s));
    if (existing && existing.stagiaire_id === s.id) opt.selected = true;
    stagiaireSel.appendChild(opt);
  });

  const typeSel = el("select");
  TYPES_EVAL.forEach((t) => {
    const opt = el("option", { value: t }, t);
    if (existing?.type === t) opt.selected = true;
    typeSel.appendChild(opt);
  });

  // Champs conditionnels (thème / compétence / contrôle)
  const themeNum = el("input", { type: "number", min: 1, max: 57, placeholder: "1-57", value: existing?.theme_numero || "" });
  const themeTitre = el("input", { type: "text", placeholder: "Titre du thème (optionnel)", value: existing?.theme_titre || "" });

  const compSel = el("select");
  compSel.appendChild(el("option", { value: "" }, "-"));
  competences.forEach((c) => {
    const opt = el("option", { value: c.code }, `${c.code} · ${c.libelle.slice(0, 60)}${c.libelle.length > 60 ? "…" : ""}`);
    if (existing?.competence_code === c.code) opt.selected = true;
    compSel.appendChild(opt);
  });

  const controleLib = el("input", { type: "text", placeholder: "Ex. Matrice GDE + REMC", value: existing?.controle_libelle || "" });

  const themeField = el("div", { class: "field" }, el("label", {}, "Numéro de thème"), themeNum, el("label", { style: "margin-top:0.5rem" }, "Titre"), themeTitre);
  const compField = el("div", { class: "field" }, el("label", {}, "Compétence"), compSel);
  const controleField = el("div", { class: "field" }, el("label", {}, "Libellé du contrôle"), controleLib);

  function updateConditional() {
    themeField.style.display = typeSel.value === "Thème" ? "" : "none";
    compField.style.display = typeSel.value === "Compétence" ? "" : "none";
    controleField.style.display = typeSel.value === "Contrôle" ? "" : "none";
  }
  typeSel.addEventListener("change", updateConditional);
  updateConditional();

  const noteInput = el("input", { type: "text", inputmode: "decimal", placeholder: "Ex. 14.5 ou 10/12", value: existing?.note ?? "" });
  const noteMaxInput = el("input", { type: "number", min: 1, step: "0.5", value: existing?.note_max ?? 20 });
  const dateInput = el("input", { type: "date", value: existing?.date_eval || isoDate(new Date()) });
  const obsInput = el("input", { type: "text", placeholder: "Observation (optionnel, rien sur la santé)", value: existing?.observation || "" });

  async function save() {
    if (!stagiaireSel.value) { toast("Choisir un stagiaire", "error"); return; }
    if (!typeSel.value) { toast("Choisir un type", "error"); return; }

    // Parse de la note : accepte "X" ou "X/Y" (auto-converti en /20).
    // Si format X/Y détecté, on force note_max=20 (override du champ Max).
    let noteVal = null, noteMaxVal = Number(noteMaxInput.value);
    if (noteInput.value.trim() !== "") {
      const parsed = parseNoteInput(noteInput.value);
      if (parsed?.error) { toast(phraseNoteRefusee(parsed.error), "error"); return; }
      noteVal = parsed.note;
      if (parsed.converted) {
        noteMaxVal = 20;
        toast(`${parsed.original} → ${parsed.note}/20`, "success", 1800);
      }
    }

    const payload = {
      stagiaire_id: Number(stagiaireSel.value),
      type: typeSel.value,
      theme_numero: typeSel.value === "Thème" && themeNum.value ? Number(themeNum.value) : null,
      theme_titre: typeSel.value === "Thème" ? (themeTitre.value || null) : null,
      competence_code: typeSel.value === "Compétence" ? (compSel.value || null) : null,
      controle_libelle: typeSel.value === "Contrôle" ? (controleLib.value || null) : null,
      note: noteVal,
      note_max: noteMaxVal,
      observation: obsInput.value || null,
      date_eval: dateInput.value,
    };
    const email = getAdminEmail();
    try {
      if (isNew) {
        payload.created_by_email = email;
        payload.updated_by_email = email;
        await addEvaluation(payload);
        toast("Note enregistrée", "success");
      } else {
        payload.updated_by_email = email;
        await updateEvaluation(existing.id, payload);
        toast("Note mise à jour", "success");
      }
      backdrop.remove();
      onSaved();
    } catch (e) {
      console.error(e);
      toast(e.message, "error");
    }
  }

  const cancelBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler");
  const saveBtn = el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer");

  const modal = el("div", { class: "modal" },
    el("h3", {}, isNew ? "Ajouter une note" : "Modifier la note"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Stagiaire"), stagiaireSel),
      el("div", { class: "field" }, el("label", {}, "Type d'évaluation"), typeSel),
      themeField,
      compField,
      controleField,
      el("div", { style: "display:grid;grid-template-columns:1fr 100px;gap:0.6rem" },
        el("div", { class: "field" }, el("label", {}, "Note"), noteInput),
        el("div", { class: "field" }, el("label", {}, "Max"), noteMaxInput),
      ),
      el("div", { class: "field" }, el("label", {}, "Date"), dateInput),
      el("div", { class: "field" }, el("label", {}, "Observation"), obsInput),
    ),
    el("div", { class: "modal-actions" }, cancelBtn, saveBtn)
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

async function openHistoryModal(evaluation_id) {
  const audit = await listAuditForEvaluation(evaluation_id);
  const backdrop = el("div", { class: "modal-backdrop" });

  const list = el("div", { class: "audit-list" });
  if (audit.length === 0) {
    list.appendChild(el("p", { class: "muted" }, "Aucun historique."));
  } else {
    audit.forEach((a) => {
      const time = new Date(a.changed_at).toLocaleString("fr-FR");
      const author = a.changed_by_email || "Anonyme";
      const item = el("div", { class: "audit-item " + a.action },
        el("div", { class: "audit-head" },
          el("span", { class: "audit-action " + a.action }, a.action === "insert" ? "Création" : a.action === "update" ? "Modification" : "Suppression"),
          el("span", { class: "audit-time" }, time),
        ),
        el("div", { class: "audit-meta" }, "par ", el("strong", {}, author)),
      );
      if (a.action === "update" && a.before_data && a.after_data) {
        const diffs = [];
        const interesting = ["note", "note_max", "observation", "type", "theme_numero", "theme_titre", "competence_code", "controle_libelle", "date_eval"];
        interesting.forEach((k) => {
          if (JSON.stringify(a.before_data[k]) !== JSON.stringify(a.after_data[k])) {
            diffs.push(el("div", { class: "audit-diff" },
              el("span", { class: "audit-field" }, k),
              el("span", { class: "audit-before" }, String(a.before_data[k] ?? "-")),
              el("span", { class: "audit-arrow" }, "→"),
              el("span", { class: "audit-after" }, String(a.after_data[k] ?? "-")),
            ));
          }
        });
        if (diffs.length) item.appendChild(el("div", { class: "audit-diffs" }, ...diffs));
      }
      list.appendChild(item);
    });
  }

  const closeBtn = el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer");
  const modal = el("div", { class: "modal", style: "max-width:560px" },
    el("h3", {}, "Historique de la note"),
    list,
    el("div", { class: "modal-actions" }, closeBtn)
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function renderTable(container) {
  let filtered = evaluations;
  if (filterStagiaire) filtered = filtered.filter((e) => e.stagiaire_id === Number(filterStagiaire));
  if (filterType)      filtered = filtered.filter((e) => e.type === filterType);

  if (filtered.length === 0) {
    return el("div", { style: "padding:3rem 1rem;text-align:center;color:var(--text-muted)" },
      el("p", {}, "Aucune note enregistrée."),
      isAdmin() ? el("p", { class: "faint", style: "font-size:0.85rem" }, "Clique sur « Ajouter une note » pour commencer.") : null,
    );
  }

  const wrap = el("div", { class: "passages-table-wrap" });
  const table = el("table", { class: "passages-table" });
  table.appendChild(el("thead", {},
    el("tr", {},
      el("th", {}, "Date"),
      el("th", {}, "Stagiaire"),
      el("th", {}, "Type"),
      el("th", {}, "Évaluation"),
      el("th", {}, "Note"),
      el("th", {}, "Observation"),
      el("th", { style: "width:120px" }, ""),
    )
  ));
  const tbody = el("tbody");
  filtered.forEach((e) => {
    const noteCell = el("td", {},
      e.note == null
        ? el("span", { class: "muted" }, "-")
        : el("span", { class: "note-pill " + noteColor(e.note, e.note_max) },
            el("span", { class: "note-num" }, String(e.note)),
            el("span", { class: "note-max" }, "/" + (e.note_max ?? 20))
          )
    );

    const actions = el("td", { style: "white-space:nowrap" });
    const histBtn = el("button", { class: "btn small ghost icon-only", "aria-label": "Historique", onClick: () => openHistoryModal(e.id) });
    histBtn.appendChild(icon.clock());
    actions.appendChild(histBtn);

    if (isAdmin()) {
      const editBtn = el("button", {
        class: "btn small ghost icon-only", style: "margin-left:0.3rem",
        "aria-label": "Modifier",
        onClick: () => openEditModal(e, () => reload(container))
      });
      editBtn.appendChild(icon.settings());
      actions.appendChild(editBtn);

      const delBtn = el("button", {
        class: "btn small danger icon-only", style: "margin-left:0.3rem",
        "aria-label": "Supprimer",
        onClick: async () => {
          if (!(await confirmer(confirmationEffacement({ qui: e.stagiaire?.prenom || null, note: e, cible: e })))) return;
          await deleteEvaluation(e.id);
          toast("Supprimée", "success");
          await reload(container);
        }
      });
      delBtn.appendChild(icon.trash());
      actions.appendChild(delBtn);
    }

    tbody.appendChild(el("tr", {},
      el("td", { class: "date" }, formatDate(e.date_eval)),
      el("td", {}, e.stagiaire?.prenom || "?"),
      el("td", {}, el("span", { class: "tag eval-type-" + (e.type === "Thème" ? "theme" : e.type === "Compétence" ? "competence" : "controle") }, e.type)),
      el("td", {}, describeEval(e)),
      noteCell,
      el("td", { class: "muted", style: "max-width:300px" }, e.observation || ""),
      actions
    ));
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

async function reload(container) {
  [evaluations, userProfiles, statsServeurGroupe] = await Promise.all([listEvaluations(), listUserProfiles(), chargerStatsGroupe()]);
  rerender(container);
}

// Rafraîchit uniquement les panneaux Synthèse + Graphiques, sans toucher à la matrice
// (préserve les autres inputs ouverts pendant qu'on enchaîne les notes)
function refreshAnalyticsInPlace(container) {
  // État vide (lot C) : la première note remplace la carte par la synthèse et les graphiques ; effacer la dernière
  // rend la carte.
  const vide = statsGroupe().n === 0;
  const carte = container.querySelector(".notes-matrice-panneau > .notes-vide");
  const oldSynth = container.querySelector(".notes-synthese");
  const oldChart = container.querySelector(".notes-chart");
  if (!vide) container.querySelectorAll(".saisie > .notes-vide").forEach((c) => c.remove());
  if (!vide && carte) {
    const panneau = carte.parentNode;
    carte.remove();
    panneau.appendChild(renderSynthese());
    panneau.appendChild(renderChartsSection());
    return;
  }
  if (vide && oldSynth) {
    const panneau = oldSynth.parentNode;
    oldSynth.remove();
    if (oldChart) oldChart.remove();
    const c = carteVide(container, "equipe-matrice");
    if (c && panneau) panneau.prepend(c);
    return;
  }
  if (oldSynth) oldSynth.replaceWith(renderSynthese());
  if (oldChart) oldChart.replaceWith(renderChartsSection());
}

// Les sous-onglets de la page de l'équipe, pour « Saisir des notes » de la carte vide (un conteneur, une rangée).
const ongletsParVue = new WeakMap();

// Va à Cours et QCM, sur le sous-onglet voulu (« themes » : la liste, où s'ouvre un examen ; « qcm » : l'entraînement).
function allerAuxThemes(sousOnglet) {
  try { localStorage.setItem(CLES_SOUS_ONGLETS.themes, sousOnglet); } catch (e) { /* mode privé : Cours et QCM s'ouvre sur son premier sous-onglet */ }
  location.hash = "#/themes";
}

// La carte d'un état vide (lot C) : une phrase et les actions qui en sortent, ou null dès qu'une note existe.
function carteVide(container, contexte) {
  const etat = etatVideNotes({ nbNotes: statsGroupe().n, contexte });
  if (!etat) return null;
  const libelles = { examen: "Ouvrir un examen", saisir: "Saisir des notes", entrainement: "M'entraîner sur un QCM" };
  const agir = {
    examen: () => allerAuxThemes("themes"),
    entrainement: () => allerAuxThemes("qcm"),
    saisir: () => ongletsParVue.get(container)?.activer("saisir"),
  };
  return el("section", { class: "notes-vide" },
    el("h3", { class: "notes-vide-titre" }, etat.titre),
    el("p", { class: "notes-vide-phrase" }, etat.phrase),
    etat.actions.length
      ? el("div", { class: "notes-vide-actions" }, ...etat.actions.map((a, i) =>
          el("button", { type: "button", class: "btn " + (i === 0 ? "primary" : "ghost"), onClick: agir[a] }, libelles[a])))
      : null,
  );
}

// === Tableau matrice : lignes stagiaires × colonnes (synthèse + 57 thèmes) ===

// La note affichée : la plus récente par date d'évaluation (règle partagée, js/notes-saisie-rules.js).
function noteForStagiaireCompetence(stagId, code) {
  return derniereNote(evaluations, stagId, { type: "Compétence", competence_code: code });
}

function noteForStagiaireTheme(stagId, themeNum) {
  return derniereNote(evaluations, stagId, { type: "Thème", theme_numero: themeNum });
}

function noteMatrixCell(evaluation) {
  if (!evaluation) return null;
  const note = Number(evaluation.note);
  const max = Number(evaluation.note_max) || 20;
  return { note, max, ratio: note / max, eval: evaluation };
}

function cellColorClass(ratio) {
  if (ratio == null) return "empty";
  if (ratio < 0.4) return "bad";
  if (ratio < 0.6) return "warn";
  if (ratio < 0.8) return "ok";
  return "great";
}

function applyNoteCellStyle(td, noteSur20) {
  const c = noteGradient(noteSur20);
  td.style.background = c.bg;
  td.style.color = c.fg;
  td.style.fontWeight = "700";
}
function clearNoteCellStyle(td) {
  td.style.background = "";
  td.style.color = "";
  td.style.fontWeight = "";
}

// Enregistre la saisie d'une note pour un stagiaire et une cible (thème ou compétence) : la seule écriture de note de la
// page, partagée par la matrice, la fiche d'un stagiaire et l'écran « Saisir » (lot C). Lit la note en place (la plus
// récente, js/notes-saisie-rules.js), convertit X/Y sur 20, crée, modifie ou efface (après confirmation nommée, dans une
// fenêtre de l'app : js/confirmer.js), tient le
// retour en arrière (Ctrl+Z) et le tableau `evaluations`. Ne touche ni au DOM ni aux statistiques : l'appelant affiche.
// Résultat : { etat: "inchangee" | "enregistree" | "effacee" | "gardee" | "invalide" | "erreur", note?, converti?, message? }.
async function enregistrerNote({ stagiaireId, cible, saisie, nom = null }) {
  const existing = derniereNote(evaluations, stagiaireId, cible);
  const raw = String(saisie ?? "").trim();
  if (raw === "") {
    // Rien à effacer : pas d'évaluation, ou une évaluation sans note (le champ était déjà vide).
    if (!existing || existing.note == null) return { etat: "inchangee" };
    const s = stagiaires.find((x) => x.id === stagiaireId);
    const qui = nom || (s ? displayName(s) : null);
    if (!(await confirmer(confirmationEffacement({ qui, note: existing, cible })))) return { etat: "gardee" };
    try {
      const snapshot = { ...existing };
      await deleteEvaluation(existing.id);
      evaluations = evaluations.filter((x) => x.id !== existing.id);
      recordUndo("note effacée", async () => {
        const { id, created_at, updated_at, ...payload } = snapshot;
        const re = await addEvaluation(payload);
        evaluations.push(re || snapshot);
      });
      return { etat: "effacee" };
    } catch (e) { return { etat: "erreur", message: raisonEchecNote(e), effacement: true }; }
  }

  const parsed = parseNoteInput(raw);
  if (!parsed || parsed.error) return { etat: "invalide", message: parsed?.error || "Note invalide" };
  const note = parsed.note;
  const fait = parsed.converted ? { etat: "enregistree", note, converti: parsed.original } : { etat: "enregistree", note };
  // Pas de changement si la note est identique (et /20)
  if (existing && existing.note != null && Number(existing.note) === note && Number(existing.note_max) === 20) return { etat: "inchangee" };

  const email = getAdminEmail();
  try {
    if (existing) {
      const prevNote = existing.note;
      const prevMax = existing.note_max;
      const prevDate = existing.date_eval;
      await updateEvaluation(existing.id, {
        note,
        note_max: 20,
        date_eval: currentEvalDate,
        updated_by_email: email,
      });
      existing.note = note;
      existing.note_max = 20;
      existing.date_eval = currentEvalDate;
      const id = existing.id;
      recordUndo("note modifiée", async () => {
        await updateEvaluation(id, { note: prevNote, note_max: prevMax, date_eval: prevDate });
        const ev = evaluations.find((x) => x.id === id);
        if (ev) { ev.note = prevNote; ev.note_max = prevMax; ev.date_eval = prevDate; }
      });
    } else {
      const newRow = {
        stagiaire_id: stagiaireId,
        ...champsDeCible(cible),
        note,
        note_max: 20,
        date_eval: currentEvalDate,
        created_by_email: email,
        updated_by_email: email,
      };
      const inserted = await addEvaluation(newRow);
      evaluations.push(inserted || newRow);
      const insertedId = inserted?.id;
      recordUndo("note ajoutée", async () => {
        if (insertedId) {
          await deleteEvaluation(insertedId);
          evaluations = evaluations.filter((x) => x.id !== insertedId);
        }
      });
    }
    return fait;
  } catch (e) {
    return { etat: "erreur", message: raisonEchecNote(e) };
  }
}

// Édition inline d'une cellule : remplace le contenu par un input et sauvegarde au blur/Enter
function inlineCellEdit(td, stagiaireId, fixedFields, container) {
  // fixedFields : { type, theme_numero?, competence_code?, controle_libelle? }
  // Garde-fou : pas de second popover si la cellule est déjà en édition.
  if (td.querySelector(".matrice-popover")) return;

  let existing = null;
  if (fixedFields.type === "Thème" && fixedFields.theme_numero != null) {
    existing = noteForStagiaireTheme(stagiaireId, fixedFields.theme_numero);
  } else if (fixedFields.type === "Compétence" && fixedFields.competence_code) {
    existing = noteForStagiaireCompetence(stagiaireId, fixedFields.competence_code);
  }

  // Sauvegarde l'état visuel : la valeur courante reste affichée derrière le popover.
  const originalText = td.textContent;
  const originalClass = td.className;
  const originalBg = td.style.background;
  const originalColor = td.style.color;
  const originalFontWeight = td.style.fontWeight;
  const originalPosition = td.style.position;
  const originalZIndex = td.style.zIndex;

  // Cellule active : position:relative pour ancrer le popover absolute, z-index
  // pour que le popover passe au-dessus des cellules voisines.
  td.style.position = "relative";
  td.style.zIndex = "10";

  // === Popover d'édition ===
  // Identique desktop & mobile. Input large (90 px) → on voit ce qu'on tape,
  // même à 5+ caractères ("10/12"). Boutons OK et Annuler explicites pour
  // tout device (le clavier décimal iOS n'a pas de touche Done).
  const input = el("input", {
    type: "text",
    inputmode: "decimal",
    enterkeyhint: "done",
    class: "matrice-inline-input matrice-popover-input",
    value: existing?.note != null ? String(existing.note) : "",
    placeholder: "/20 ou X/Y",
  });
  const okBtn = el("button", {
    type: "button",
    "aria-label": "Valider",
    class: "matrice-popover-ok",
  }, "✓ OK");
  const cancelBtn = el("button", {
    type: "button",
    "aria-label": "Annuler",
    class: "matrice-popover-annuler",
  }, "✕");
  okBtn.addEventListener("mousedown", (e) => e.preventDefault());
  okBtn.addEventListener("click", (e) => { e.stopPropagation(); input.blur(); });
  // Cancel : mousedown AVANT le blur de l'input, pour pouvoir annuler proprement.
  cancelBtn.addEventListener("mousedown", (e) => { e.preventDefault(); cancelled = true; });
  cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); restore(); });

  const popover = el("div", {
    class: "matrice-popover",
  });
  popover.addEventListener("click", (e) => e.stopPropagation());
  popover.appendChild(input);
  popover.appendChild(okBtn);
  popover.appendChild(cancelBtn);

  td.appendChild(popover);
  input.focus();
  input.select();

  let cancelled = false;
  async function save() {
    if (cancelled) return;
    cancelled = true;
    const r = await enregistrerNote({ stagiaireId, cible: fixedFields, saisie: input.value });
    if (r.etat === "effacee") {
      // Met à jour la cellule en place (pas de rerender complet)
      td.textContent = "";
      td.className = "m-td-cell empty" + (isAdmin() ? " editable" : "");
      clearNoteCellStyle(td);
      td.style.position = originalPosition;
      td.style.zIndex = originalZIndex;
      toast("Note effacée · Ctrl+Z pour annuler", "success", 2200);
      refreshAnalyticsInPlace(container);
      return;
    }
    if (r.etat === "gardee") {
      td.textContent = originalText;
      td.className = originalClass;
      restore();
      return;
    }
    if (r.etat === "invalide" || r.etat === "erreur") toast(phraseNoteRefusee(r.message, r.effacement), "error");
    if (r.etat !== "enregistree") { restore(); return; }
    if (r.converti) toast(`${r.converti} → ${r.note}/20`, "success", 1800);
    // Met à jour la cellule en place (sans détruire les autres inputs)
    td.textContent = String(r.note);
    td.className = "m-td-cell" + (isAdmin() ? " editable" : "");
    applyNoteCellStyle(td, r.note);
    td.style.position = originalPosition;
    td.style.zIndex = originalZIndex;
    refreshAnalyticsInPlace(container);
  }

  function restore() {
    if (popover.parentNode === td) td.removeChild(popover);
    td.style.position = originalPosition;
    td.style.zIndex = originalZIndex;
    // textContent / className / bg / color / fontWeight non modifiés par l'édition
    // (le popover est un overlay) → rien d'autre à restaurer.
  }

  input.addEventListener("blur", save);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    else if (e.key === "Escape") {
      cancelled = true;
      restore();
    }
  });
}

// === Vue détaillée d'un stagiaire (modale, idéale mobile) ===

function openStagiaireDetail(stagiaire, themeByNum, container) {
  const admin = isAdmin();
  const backdrop = el("div", { class: "modal-backdrop" });

  function buildBody() {
    const body = el("div", { class: "sd-body" });

    // Moyenne
    const allEvals = evaluations.filter((e) => e.stagiaire_id === stagiaire.id && e.note != null && e.note_max);
    if (allEvals.length > 0) {
      const avg = allEvals.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / allEvals.length;
      const rounded = Math.round(avg * 10) / 10;
      const cls = cellColorClass(avg / 20);
      body.appendChild(el("div", { class: "sd-avg " + cls },
        el("span", { class: "sd-avg-num" }, String(rounded)),
        el("span", { class: "sd-avg-max" }, "/20"),
        el("span", { class: "sd-avg-count muted" }, allEvals.length + " note" + (allEvals.length > 1 ? "s" : "")),
      ));
    } else {
      body.appendChild(el("div", { class: "sd-avg empty" }, el("span", { class: "muted" }, "Aucune note pour l'instant")));
    }

    function row(label, sublabel, ev, fixedFields) {
      const r = el("div", { class: "sd-row" });
      r.appendChild(el("div", { class: "sd-label" },
        el("span", { class: "sd-label-main" }, label),
        sublabel ? el("span", { class: "sd-label-sub muted" }, sublabel) : null,
      ));
      const valueWrap = el("div", { class: "sd-value" });
      if (ev && ev.note != null) {
        const ratio = Number(ev.note) / (Number(ev.note_max) || 20);
        const cls = cellColorClass(ratio);
        valueWrap.appendChild(el("span", { class: "sd-note " + cls }, String(ev.note)));
      } else {
        valueWrap.appendChild(el("span", { class: "sd-note empty" }, "-"));
      }
      if (admin) {
        valueWrap.classList.add("editable");
        valueWrap.title = "Cliquer pour modifier";
        valueWrap.addEventListener("click", () => {
          startInlineEditInModal(valueWrap, stagiaire.id, fixedFields, container, backdrop);
        });
      }
      r.appendChild(valueWrap);
      return r;
    }

    // Section : Compétences clés
    body.appendChild(el("h4", { class: "sd-section-title" }, "Compétences"));
    MATRIX_SPECIAL_COLS.forEach((c) => {
      const ev = noteForStagiaireCompetence(stagiaire.id, c.key);
      body.appendChild(row(c.label, c.tooltip, ev, { type: "Compétence", competence_code: c.key }));
    });

    // Section : Thèmes 57
    body.appendChild(el("h4", { class: "sd-section-title" }, "Thèmes du référentiel"));
    for (let n = 1; n <= 57; n++) {
      const ev = noteForStagiaireTheme(stagiaire.id, n);
      const theme = themeByNum.get(n);
      const numStr = String(n).padStart(2, "0");
      const title = theme ? theme.titre : `Thème ${n}`;
      body.appendChild(row(numStr + " · " + title, null, ev, {
        type: "Thème",
        theme_numero: n,
        theme_titre: theme ? theme.titre : null,
      }));
    }

    return body;
  }

  const modal = el("div", { class: "modal sd-modal" },
    el("div", { class: "sd-head" },
      el("h3", {}, displayName(stagiaire)),
      el("p", { class: "muted", style: "margin:0;font-size:0.85rem" },
        admin ? "Clique sur une note pour la modifier." : "Lecture seule."),
    ),
    buildBody(),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn primary", onClick: () => backdrop.remove() }, "Fermer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

// Édition inline dans la modale détail (similaire à la cellule matrice)
function startInlineEditInModal(valueWrap, stagiaireId, fixedFields, container, backdrop) {
  let existing = null;
  if (fixedFields.type === "Thème" && fixedFields.theme_numero != null) {
    existing = noteForStagiaireTheme(stagiaireId, fixedFields.theme_numero);
  } else if (fixedFields.type === "Compétence" && fixedFields.competence_code) {
    existing = noteForStagiaireCompetence(stagiaireId, fixedFields.competence_code);
  }
  const originalHtml = valueWrap.innerHTML;
  const input = el("input", {
    type: "text", inputmode: "decimal", enterkeyhint: "done",
    class: "matrice-inline-input sd-edit-input",
    style: "flex:1;min-width:0;",
    value: existing?.note != null ? String(existing.note) : "",
    placeholder: "/20 ou X/Y",
  });
  const saveBtn = el("button", {
    type: "button",
    class: "matrice-inline-ok",
    "aria-label": "Valider",
  }, "✓");
  saveBtn.addEventListener("mousedown", (e) => e.preventDefault());
  saveBtn.addEventListener("click", (e) => { e.stopPropagation(); input.blur(); });
  const editor = el("div", { class: "matrice-inline-editor",
    style: "display:flex;gap:4px;align-items:stretch;" });
  editor.appendChild(input);
  editor.appendChild(saveBtn);
  valueWrap.innerHTML = "";
  valueWrap.appendChild(editor);
  input.focus(); input.select();

  let done = false;
  async function commit() {
    if (done) return; done = true;
    const r = await enregistrerNote({ stagiaireId, cible: fixedFields, saisie: input.value });
    if (r.etat === "invalide" || r.etat === "erreur" || r.etat === "gardee") {
      if (r.message) toast(phraseNoteRefusee(r.message, r.effacement), "error");
      valueWrap.innerHTML = originalHtml;
      return;
    }
    if (r.etat === "effacee") toast("Note effacée · Ctrl+Z pour annuler", "success", 2200);
    if (r.converti) toast(`${r.converti} → ${r.note}/20`, "success", 1800);
    backdrop.remove();
    await reload(container);
  }
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    else if (e.key === "Escape") { done = true; valueWrap.innerHTML = originalHtml; }
  });
}

function renderMatrice(container) {
  // Construction des colonnes : Prénom, Moy, [4 spéciales], [57 thèmes]
  const wrap = el("div", { class: "matrice-wrap" });
  const table = el("table", { class: "matrice-table" });

  // Liste des thèmes officiels présents en DB (par numero 1..57)
  const themesByNum = new Map();
  themesOfficiels.forEach((t) => {
    if (t.numero != null) themesByNum.set(t.numero, t);
  });
  const themeNumbers = [];
  for (let n = 1; n <= 57; n++) themeNumbers.push(n);

  // Header row
  const thead = el("thead");
  const headRow1 = el("tr");
  headRow1.appendChild(el("th", { class: "m-th-name sticky" }, "Stagiaire"));
  headRow1.appendChild(el("th", { class: "m-th-avg" }, "Moy."));
  MATRIX_SPECIAL_COLS.forEach((c) => {
    headRow1.appendChild(el("th", { class: "m-th-spe", title: c.tooltip }, c.label));
  });
  themeNumbers.forEach((n) => {
    const theme = themesByNum.get(n);
    const title = theme ? theme.titre : `Thème ${n}`;
    const numStr = String(n).padStart(2, "0");
    const th = el("th", { class: "m-th-theme", title: `Thème ${numStr} : ${title}` },
      el("div", { class: "m-th-theme-label" },
        el("span", { class: "m-th-theme-num" }, numStr),
        el("span", { class: "m-th-theme-title" }, title),
      )
    );
    headRow1.appendChild(th);
  });
  thead.appendChild(headRow1);
  table.appendChild(thead);

  // Body rows
  const tbody = el("tbody");
  const admin = isAdmin();

  // Construction d'un Map themes par numero pour la modale détail
  const themeByNumLocal = themesByNum;

  sortStagiaires(visibleStagiaires(), currentNotesSort).forEach((s) => {
    const tr = el("tr");

    // Colonne prénom (sticky) : cliquable pour ouvrir la vue détaillée
    const visibleName = displayName(s);
    const nameBtn = el("button", {
      class: "m-name-btn" + (isStagiaireAnonymous(s.id) ? " anon" : ""), type: "button",
      title: isStagiaireAnonymous(s.id) ? "Profil anonyme" : "Voir toutes les notes de " + displayStagiaire(s),
      onClick: () => openStagiaireDetail(s, themeByNumLocal, container),
    }, visibleName);
    tr.appendChild(el("td", { class: "m-td-name sticky" }, nameBtn));

    // Moyenne globale
    const allEvals = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null && e.note_max);
    if (allEvals.length > 0) {
      const avg = allEvals.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / allEvals.length;
      const rounded = Math.round(avg * 10) / 10;
      const tdAvg = el("td", { class: "m-td-avg", title: allEvals.length + " évaluations" }, String(rounded));
      applyNoteCellStyle(tdAvg, avg);
      tr.appendChild(tdAvg);
    } else {
      tr.appendChild(el("td", { class: "m-td-avg empty" }, ""));
    }

    // Colonnes spéciales (C1, C2, REMC, MGDE)
    MATRIX_SPECIAL_COLS.forEach((c) => {
      const ev = noteForStagiaireCompetence(s.id, c.key);
      const cell = noteMatrixCell(ev);
      const td = el("td", { class: "m-td-cell" + (cell ? "" : " empty") });
      if (cell) {
        applyNoteCellStyle(td, cell.ratio * 20);
        td.textContent = String(cell.note);
        td.title = `${c.label} : ${cell.note}/${cell.max} le ${formatDate(cell.eval.date_eval)}`;
      }
      if (admin) {
        td.classList.add("editable");
        td.addEventListener("click", () => inlineCellEdit(td, s.id, { type: "Compétence", competence_code: c.key }, container));
      }
      tr.appendChild(td);
    });

    // 57 colonnes thèmes (les thèmes groupés partagent UNE cellule fusionnée)
    for (let n = 1; n <= 57; n++) {
      if (THEME_GROUP_FOLLOWER.has(n)) continue;   // absorbé par la cellule du thème qui ouvre le groupe
      const grp = THEME_GROUP_LEADER.get(n);
      const ev = noteForStagiaireTheme(s.id, n);
      const cell = noteMatrixCell(ev);
      const td = el("td", { class: "m-td-cell" + (cell ? "" : " empty") + (grp ? " grouped" : "") });
      if (grp) td.colSpan = grp.length;
      if (cell) {
        applyNoteCellStyle(td, cell.ratio * 20);
        td.textContent = String(cell.note);
        const libelle = grp ? `Thèmes ${grp.join(" + ")} (évalués ensemble)` : `Thème ${n}`;
        td.title = `${libelle} : ${cell.note}/${cell.max} le ${formatDate(cell.eval.date_eval)}`;
      }
      if (admin) {
        td.classList.add("editable");
        td.addEventListener("click", () => {
          const theme = themesByNum.get(n);
          inlineCellEdit(td, s.id, {
            type: "Thème",
            theme_numero: n,
            theme_titre: theme ? theme.titre : null,
          }, container);
        });
      }
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });
  if (iAmAnonymous()) tbody.appendChild(buildGroupAvgRow());
  table.appendChild(tbody);
  wrap.appendChild(table);

  if (!litTout()) {
    if (iAmAnonymous()) {
      wrap.appendChild(el("p", { class: "muted matrice-anon-note" },
        "Tu as masqué tes notes : tu vois ta ligne et la moyenne du groupe. "
        + "Les autres stagiaires ne voient ni ton prénom ni tes notes "
        + "(elles comptent toujours dans les moyennes)."));
    } else if (hiddenCount() > 0) {
      const n = hiddenCount();
      wrap.appendChild(el("p", { class: "muted matrice-anon-note" },
        n + (n > 1 ? " profils masqués, comptés" : " profil masqué, compté") + " dans les moyennes du groupe."));
    }
  }

  return wrap;
}

// Ligne « Moyenne du groupe » affichée au stagiaire anonymisé à la place des
// lignes des autres : moyenne de classe par colonne, non cliquable.
function buildGroupAvgRow() {
  const tr = el("tr", { class: "m-row-group-avg" });
  tr.appendChild(el("td", { class: "m-td-name sticky" },
    el("span", { class: "m-group-avg-label" }, "Moyenne du groupe")));

  function avgCell(avg, cls, title) {
    const td = el("td", { class: cls + (avg == null ? " empty" : "") });
    if (avg != null) {
      td.textContent = String(Math.round(avg * 10) / 10);
      applyNoteCellStyle(td, avg);
      if (title) td.title = title;
    }
    return td;
  }

  const st = statsGroupe();
  tr.appendChild(avgCell(moyenneGenerale(st), "m-td-avg", "Moyenne générale du groupe"));

  MATRIX_SPECIAL_COLS.forEach((c) => {
    const avg = moyenneCompetence(st, c.key);
    tr.appendChild(avgCell(avg, "m-td-cell", c.label + " : moyenne du groupe"));
  });

  for (let n = 1; n <= 57; n++) {
    if (THEME_GROUP_FOLLOWER.has(n)) continue;
    const grp = THEME_GROUP_LEADER.get(n);
    const nums = grp || [n];
    const avg = moyenneThemes(st, nums);
    const libelle = grp ? `Thèmes ${grp.join(" + ")}` : `Thème ${n}`;
    const td = avgCell(avg, "m-td-cell" + (grp ? " grouped" : ""), libelle + " : moyenne du groupe");
    if (grp) td.colSpan = grp.length;
    tr.appendChild(td);
  }

  return tr;
}

// Ce que veulent dire les sigles des colonnes de la matrice (lot C) : une ligne sous le tableau.
function legendeMatrice() {
  const p = el("p", { class: "matrice-legende muted" });
  MATRIX_SPECIAL_COLS.forEach((c, i) => {
    if (i) p.appendChild(document.createTextNode(" · "));
    p.appendChild(el("strong", {}, c.label));
    p.appendChild(document.createTextNode(" : " + c.nom));
  });
  return p;
}

function rerender(container) {
  clear(container);

  const admin = isAdmin();
  const nbLignes = statsGroupe().n_lignes;

  // Initialise la date courante si pas encore définie
  if (!currentEvalDate) currentEvalDate = isoDate(new Date());

  // Nouvelle navigation : la page de l'équipe porte le nom de son entrée, « Notes et examens », avec la promo en
  // surtitre, et le nombre de notes termine alors son sous-titre. Sur un écran tactile, on touche une case : le
  // sous-titre le dit, et la phrase de la barre d'outils sur Entrée et Échap, qui suppose un clavier, disparaît.
  // Imbriquée dans Mon suivi (La classe, pour toute personne qui y ouvre la classe, stagiaire ou formateur), la vue vit
  // déjà sous le titre de Mon suivi : ni titre à elle ni « Lecture seule... » ; la phrase sur la saisie n'y est lue que
  // par qui saisit des notes ; le nombre de notes reste, seul sinon.
  const v2 = navigationV2Active();
  const dansCentre = v2 && dansLesCentres.has(container);
  const laClasse = v2 && (imbriques.has(container) || dansCentre);
  const equipe = v2 && !laClasse && formateurConnecte();
  const surtitre = getPromoCourante()?.nom;
  const tactile = v2 && window.matchMedia("(pointer: coarse)").matches;
  const compte = nbLignes + " note" + (nbLignes > 1 ? "s" : "") + " enregistrée" + (nbLignes > 1 ? "s" : "");
  const phrase = admin && tactile
    ? "Saisis les notes thème par thème, ou touche une case de la matrice."
    : "Tableau matrice : stagiaires × thèmes/compétences. Clique une cellule pour saisir la note.";

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      laClasse ? null : equipe
        ? (surtitre ? el("p", { class: "eyebrow" }, surtitre) : null)
        : el("p", { class: "eyebrow" }, compte),
      laClasse ? null : el("h2", {}, equipe ? "Notes et examens" : "Notes & évaluations"),
      // La classe sans note : la carte de l'état vide dit déjà tout (lot C), pas de « 0 note enregistrée. » au-dessus.
      laClasse && nbLignes === 0 ? null
        : el("p", { class: "subtitle" }, dansCentre ? "Matrice et notes de la promo, en lecture. " + compte + "." : laClasse ? (admin ? phrase + " " : "") + compte + "." : equipe ? phrase + " " + compte + "." : phrase),
    ),
    // Direction (lot 5) : le sous-titre dit déjà « en lecture ».
    admin || laClasse || dansCentre ? null : el("span", { class: "muted", style: "font-size:0.85rem" }, "Lecture seule. Connexion admin requise pour modifier."),
  ));

  // Tri (toujours visible)
  const sortSel = el("select", { class: "notes-sort", "aria-label": "Trier la matrice" });
  NOTES_SORT_OPTIONS.forEach((o) => {
    const opt = el("option", { value: o.key }, o.label);
    if (o.key === currentNotesSort) opt.selected = true;
    sortSel.appendChild(opt);
  });
  sortSel.addEventListener("change", () => {
    currentNotesSort = sortSel.value;
    localStorage.setItem("ecsr_notes_sort", currentNotesSort);
    rerender(container);
  });

  let toolbar;
  if (admin) {
    // Barre date globale : toutes les notes saisies prendront cette date
    const dateInput = el("input", { type: "date", value: currentEvalDate, "aria-label": "Date des notes" });
    dateInput.addEventListener("change", () => {
      currentEvalDate = dateInput.value || isoDate(new Date());
    });
    const todayBtn = el("button", { class: "btn small", onClick: () => {
      currentEvalDate = isoDate(new Date());
      dateInput.value = currentEvalDate;
    }}, "Aujourd'hui");

    toolbar = el("div", { class: "matrice-toolbar" },
      el("span", { class: "matrice-toolbar-label" }, "Trier :"),
      sortSel,
      el("span", { class: "matrice-toolbar-label", style: "margin-left:1rem" }, "Date des notes :"),
      dateInput,
      todayBtn,
      tactile ? null : el("span", { class: "matrice-toolbar-hint muted" },
        "→ clique une cellule, tape une note (0-20), Entrée valide, Esc annule."
      ),
    );
  } else {
    toolbar = el("div", { class: "matrice-toolbar" },
      el("span", { class: "matrice-toolbar-label" }, "Trier :"),
      sortSel,
    );
  }

  // Panneau « Matrice » = barre d'outils + tableau + synthèse + graphiques.
  // On passe le `container` de la vue (pas le panneau) à renderMatrice : les
  // éditions de cellule appellent refreshAnalyticsInPlace(container), qui
  // retrouve .notes-synthese/.notes-chart par querySelector, ils restent des
  // descendants du container, dans le panneau.
  const buildMatricePanel = (panel) => {
    // La date a pu changer dans « Saisir » : la barre d'outils la reprend.
    const champDate = toolbar.querySelector('input[type="date"]');
    if (champDate) champDate.value = currentEvalDate;
    const panneau = el("div", { class: "notes-matrice-panneau" });
    panel.appendChild(panneau);
    // Aucune note (lot C) : une carte à la place de la synthèse et des graphiques. La matrice reste pour qui saisit
    // (c'est son outil sur ordinateur) ; un stagiaire n'y verrait que des cases vides.
    const carte = carteVide(container, contexteEtatVide({ classe: false, admin, personnel: formateurConnecte() }));
    if (carte) panneau.appendChild(carte);
    if (carte && !admin) return;
    panneau.appendChild(toolbar);
    panneau.appendChild(renderMatrice(container));
    panneau.appendChild(legendeMatrice());
    if (carte) return;
    panneau.appendChild(renderSynthese());
    panneau.appendChild(renderChartsSection());
  };

  // Notes, c'est la classe (chantier D) : la Matrice et les moyennes EPCF de la classe,
  // ouvertes à tout le monde : en deux sous-onglets sur la page de l'équipe, en une section
  // sous la Matrice dans La classe de Mon suivi (nouvelle navigation, plus bas). Ce qui est
  // propre à une personne (sa saisie EPCF, son livret, son dossier) vit dans sa fiche :
  // Mon espace, ou la page Stagiaires des formateurs. La matrice reste en lecture seule
  // pour les stagiaires. Chaque sous-onglet suit son module (js/modules-data.js) ; la
  // Matrice suit l'onglet lui-même.
  // « Saisir » (lot C) : la saisie thème par thème, pour qui écrit des notes, sur la page de l'équipe seulement (ni La
  // classe de Mon suivi, ni les stagiaires). Un écran tactile s'y ouvre tant qu'aucun sous-onglet n'est mémorisé.
  const ctxSaisie = {
    stagiaires: () => stagiaires.slice().sort(compareByNom),
    evaluations: () => evaluations,
    themes: themesOfficiels,
    nom: displayName,
    dateEval: () => currentEvalDate,
    changerDate: (iso) => { currentEvalDate = iso; },
    enregistrer: enregistrerNote,
    apresEnregistrement: () => refreshAnalyticsInPlace(container),
    carteVide: (contexte) => carteVide(container, contexte),
  };
  const onglets = [
    admin && !laClasse && !dansCentre ? { key: "saisir", label: "Saisir", render: (p) => renderSaisie(p, ctxSaisie) } : null,
    { key: "matrice", label: "Matrice", render: buildMatricePanel },
    { key: "epcf", label: "EPCF", module: "epcf", render: (p, ctx) => {
        renderEpcf(p, { embedded: true, isActive: ctx && ctx.isActive,
          contexte: contexteEtatVide({ classe: false, admin, personnel: formateurConnecte() || dansCentre }) })
          .catch((e) => {
            console.error(e);
            if (!ctx || ctx.isActive()) {
              clear(p);
              p.appendChild(el("p", { class: "muted" }, "Erreur de chargement de l'espace EPCF. Reviens sur l'onglet pour réessayer."));
            }
          });
      } },
  ].filter(Boolean);
  // La classe imbriquée dans Mon suivi (nouvelle navigation) : la Matrice, sans seconde rangée Matrice / EPCF (deux
  // « EPCF » se liraient à l'écran, celui de la fiche, première rangée de Mon suivi, et celui-ci), puis les moyennes
  // EPCF de la classe en section titrée sous la vue de la classe, tant que le module EPCF est ouvert pour la promo
  // (le sous-onglet EPCF de la page de l'équipe suit le même module). Sans choix d'onglet, aucune mémoire de
  // sous-onglet n'est écrite (celle de la page de l'équipe).
  if (laClasse) {
    // Un seul calcul du contexte pour les deux cartes vides (notes et moyennes EPCF) : elles ne peuvent pas se contredire.
    // Dans la page de la direction (lot 5), c'est celui de la direction : lire, sans action.
    const contexteClasse = contexteEtatVide({ classe: true, admin, personnel: formateurConnecte() || dansCentre });
    const carte = carteVide(container, contexteClasse);
    container.appendChild(carte || renderSubTabs(onglets.slice(0, 1)));
    if (moduleVisible("epcf")) container.appendChild(sectionMoyennesEpcf(contexteClasse));
  } else {
    const rangee = renderSubTabs(onglets, { storageKey: "ecsr_notes_subtab", defautKey: tactile ? "saisir" : "matrice" });
    ongletsParVue.set(container, rangee);
    container.appendChild(rangee);
  }
}

// Les moyennes EPCF de la classe, en section de La classe : le rendu de l'onglet EPCF de la page de l'équipe
// (renderEpcf, donc le même k-anonymat : une moyenne n'est montrée qu'à partir de 2 stagiaires évalués), sous
// un titre qui nomme l'épreuve et la classe. Sans moyenne montrable, la carte de l'état vide, dont le bouton suit `contexte`.
function sectionMoyennesEpcf(contexte) {
  const section = el("section", { class: "notes-epcf-classe" });
  renderEpcf(section, { embedded: true, titre: "Moyennes EPCF de la classe", contexte })
    .catch((e) => {
      console.error(e);
      clear(section);
      section.appendChild(el("p", { class: "muted" }, "Erreur de chargement des moyennes EPCF de la classe. Recharge la page pour réessayer."));
    });
  return section;
}

// === Helpers stats ===

function evalScore20(e) {
  return (Number(e.note) / Number(e.note_max)) * 20;
}

function cellColorClassFromAvg(avg) {
  if (avg == null) return "empty";
  return cellColorClass(avg / 20);
}

/** Moyenne classe par thème : { num, titre, avg, med, count } */
function themeStats() {
  return statsParTheme(statsGroupe(), themesOfficiels);
}

// === Section Synthèse ===

function renderSynthese() {
  const st = statsGroupe();
  const classAvg = moyenneGenerale(st);
  const classMed = st.mediane;
  const below10 = st.sous_10;

  const wrap = el("section", { class: "notes-synthese" },
    el("h3", { class: "notes-chart-title" }, "Synthèse classe"),
    // Règle du 23/10/2026, la même que le tableau de bord du centre (js/notes-stats.js).
    el("p", { class: "muted notes-chart-sub" },
      "Calculée sur les stagiaires en formation : les notes des stagiaires en abandon ne sont pas comptées."),
  );

  // KPIs
  const kpis = el("div", { class: "notes-kpis" });
  function kpi(label, value, cls) {
    return el("div", { class: "notes-kpi " + (cls || "") },
      el("span", { class: "notes-kpi-value" }, value),
      el("span", { class: "notes-kpi-label" }, label),
    );
  }
  kpis.appendChild(kpi("Moyenne classe", classAvg != null ? (Math.round(classAvg * 10) / 10) + " /20" : "-", cellColorClassFromAvg(classAvg)));
  kpis.appendChild(kpi("Médiane", classMed != null ? (Math.round(classMed * 10) / 10) + " /20" : "-", cellColorClassFromAvg(classMed)));
  kpis.appendChild(kpi("Notes saisies", String(st.n)));
  kpis.appendChild(kpi("Notes sous 10/20", String(below10), below10 > 0 ? "bad" : ""));
  wrap.appendChild(kpis);

  // Top 3 thèmes faibles + solides
  const stats = themeStats();
  if (stats.length === 0) {
    wrap.appendChild(el("p", { class: "muted", style: "margin-top:1rem" }, "Le classement des thèmes apparaîtra avec les premières notes de thème."));
    return wrap;
  }

  const weak = stats.slice().sort((a, b) => a.avg - b.avg).slice(0, 3);
  const strong = stats.slice().sort((a, b) => b.avg - a.avg).slice(0, 3);

  function themeCard(t) {
    const avgR = Math.round(t.avg * 10) / 10;
    return el("div", { class: "theme-stat-card " + cellColorClassFromAvg(t.avg) },
      el("span", { class: "theme-stat-num" }, String(t.num).padStart(2, "0")),
      el("div", { class: "theme-stat-body" },
        el("span", { class: "theme-stat-title" }, t.titre || `Thème ${t.num}`),
        el("span", { class: "theme-stat-meta" },
          el("strong", {}, avgR + "/20"),
          " · médiane ", String(Math.round(t.med * 10) / 10),
          " · ", t.count, " note" + (t.count > 1 ? "s" : ""),
        ),
      )
    );
  }

  wrap.appendChild(el("div", { class: "notes-rankings" },
    el("div", { class: "ranking-block" },
      el("h4", { class: "ranking-title weak" }, "3 thèmes les plus faibles"),
      el("p", { class: "muted ranking-sub" }, "À retravailler en priorité"),
      ...weak.map(themeCard),
    ),
    el("div", { class: "ranking-block" },
      el("h4", { class: "ranking-title strong" }, "3 thèmes les plus solides"),
      el("p", { class: "muted ranking-sub" }, "Acquis confirmés"),
      ...strong.map(themeCard),
    ),
  ));

  return wrap;
}

// === Section Graphiques (tabs) ===

let chartView = "stagiaires";  // "stagiaires" | "themes" | "distribution"

function renderChartsSection() {
  const wrap = el("section", { class: "notes-chart" });
  wrap.appendChild(el("h3", { class: "notes-chart-title" }, "Graphiques"));

  const tabs = el("div", { class: "chart-tabs" });
  [
    { key: "stagiaires",   label: "Par stagiaire" },
    { key: "themes",       label: "Par thème" },
    { key: "distribution", label: "Distribution" },
  ].forEach((t) => {
    const btn = el("button", {
      class: "chart-tab" + (chartView === t.key ? " active" : ""),
      type: "button",
      onClick: () => { chartView = t.key; wrap.replaceWith(renderChartsSection()); }
    }, t.label);
    tabs.appendChild(btn);
  });
  wrap.appendChild(tabs);

  const body = el("div", { class: "notes-chart-svg-wrap" });
  if (chartView === "stagiaires")        body.appendChild(buildAveragesChartSvg());
  else if (chartView === "themes")       body.appendChild(buildThemesChartSvg());
  else if (chartView === "distribution") body.appendChild(buildDistributionChartSvg());
  wrap.appendChild(body);

  return wrap;
}

// Le bar chart par stagiaire (extrait pour réutiliser dans les onglets)
// Par stagiaire : une barre par stagiaire qui a une note ; ceux qui n'en ont pas sont comptés sous le graphe (lot C),
// sans nom (aucune question d'anonymat).
function buildAveragesChartSvg() {
  const { svg, sansNote, soi } = renderAveragesChartInner();
  const wrap = el("div", { class: "notes-chart-par-stagiaire" }, svg);
  if (soi) wrap.appendChild(el("p", { class: "muted notes-sans-note" }, "Tu n'as pas encore de note."));
  else if (sansNote) wrap.appendChild(el("p", { class: "muted notes-sans-note" },
    `${sansNote} stagiaire${sansNote > 1 ? "s" : ""} sans note pour l'instant.`));
  return wrap;
}

function renderAveragesChartInner() {
  // Code repris de renderAveragesChart mais retourne seulement le SVG
  if (iAmAnonymous()) return buildAnonAveragesChartSvg();
  const sorted = sortStagiaires(visibleStagiaires(), "avg-desc");
  const data = sorted.map((s) => {
    const evs = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null && e.note_max);
    const avg = evs.length === 0 ? null : evs.reduce((sum, e) => sum + evalScore20(e), 0) / evs.length;
    return { name: displayName(s), avg, count: evs.length, anon: isStagiaireAnonymous(s.id) };
  });
  return { svg: horizontalBarChart(data, 22), sansNote: data.filter((d) => d.avg == null).length, soi: false };
}

// Vue du stagiaire anonymisé : plus de barres nominatives, seulement sa moyenne
// située par rapport à la meilleure, la moyenne du groupe et la moins bonne
// (moyennes générales individuelles, sans prénom, anonymes compris).
function buildAnonAveragesChartSvg() {
  const st = statsGroupe();
  const mine = stagiaireAvg(myStagiaireId());
  const myCount = evaluations.filter((e) => e.stagiaire_id === myStagiaireId() && e.note != null && e.note_max).length;
  const data = [
    { name: "Toi", avg: mine, count: mine != null ? myCount : null },
    { name: "Moyenne haute", avg: st.moy_stagiaire_max },
    { name: "Moyenne du groupe", avg: moyenneGenerale(st) },
    { name: "Moyenne basse", avg: st.moy_stagiaire_min },
  ];
  return { svg: horizontalBarChart(data, 22, 140), sansNote: 0, soi: mine == null };
}

function buildThemesChartSvg() {
  const stats = themeStats().sort((a, b) => a.avg - b.avg);  // pire en haut
  const data = stats.map((t) => ({
    name: String(t.num).padStart(2, "0") + " · " + (t.titre || ""),
    avg: t.avg, count: t.count,
  }));
  if (data.length === 0) {
    const empty = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    empty.setAttribute("viewBox", "0 0 200 40");
    return empty;
  }
  return horizontalBarChart(data, 18, 200);
}

function buildDistributionChartSvg() {
  // Chaque tranche prend la teinte de l'échelle douce des notes (classes de cellColorClass : sous 8, sous 12, sous 16,
  // au-dessus) : jamais un rouge, les barres se lisent comme les cases de la matrice.
  const buckets = [
    { min: 0,  max: 4,  label: "0–4",   count: 0, tier: "bad" },
    { min: 4,  max: 8,  label: "4–8",   count: 0, tier: "bad" },
    { min: 8,  max: 12, label: "8–12",  count: 0, tier: "warn" },
    { min: 12, max: 16, label: "12–16", count: 0, tier: "ok" },
    { min: 16, max: 20.01, label: "16–20", count: 0, tier: "great" },
  ];
  // Effectifs par tranche (bornes : TRANCHES de notes-stats.js, mêmes valeurs qu'ici).
  const repartition = statsGroupe().repartition;
  buckets.forEach((b, i) => { b.count = repartition[i] || 0; });
  const max = Math.max(1, ...buckets.map((b) => b.count));

  const svgNS = "http://www.w3.org/2000/svg";
  const W = largeurDeGraphe(), H = 280, padL = 30, padR = 30, padT = 30, padB = 50;   // à la largeur de son conteneur : jamais de défilement de côté
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW = chartW / buckets.length - 16;

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "notes-chart-svg");

  // Axe Y graduations
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((max / yTicks) * i);
    const y = padT + chartH - (val / max) * chartH;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", padL); line.setAttribute("x2", W - padR);
    line.setAttribute("y1", y); line.setAttribute("y2", y);
    line.setAttribute("class", i === 0 ? "notes-axe" : "notes-grille");
    if (i !== 0) line.setAttribute("stroke-dasharray", "2,3");
    svg.appendChild(line);
    const tx = document.createElementNS(svgNS, "text");
    tx.setAttribute("x", padL - 6); tx.setAttribute("y", y + 3);
    tx.setAttribute("text-anchor", "end"); tx.setAttribute("font-size", "10");
    tx.setAttribute("class", "notes-graduation");
    tx.textContent = String(val);
    svg.appendChild(tx);
  }

  // Bars
  buckets.forEach((b, i) => {
    const cx = padL + (chartW / buckets.length) * i + (chartW / buckets.length) / 2;
    const h = (b.count / max) * chartH;
    const x = cx - barW / 2;
    const y = padT + chartH - h;

    const rect = document.createElementNS(svgNS, "rect");
    rect.setAttribute("x", x); rect.setAttribute("y", y);
    rect.setAttribute("width", barW); rect.setAttribute("height", h);
    rect.setAttribute("rx", 4); rect.setAttribute("class", "notes-bar " + b.tier);
    svg.appendChild(rect);

    const txVal = document.createElementNS(svgNS, "text");
    txVal.setAttribute("x", cx); txVal.setAttribute("y", y - 6);
    txVal.setAttribute("text-anchor", "middle"); txVal.setAttribute("font-size", "12");
    txVal.setAttribute("font-weight", "700"); txVal.setAttribute("class", "notes-valeur");
    txVal.textContent = String(b.count);
    svg.appendChild(txVal);

    const txLab = document.createElementNS(svgNS, "text");
    txLab.setAttribute("x", cx); txLab.setAttribute("y", padT + chartH + 18);
    txLab.setAttribute("text-anchor", "middle"); txLab.setAttribute("font-size", "11");
    txLab.setAttribute("class", "notes-libelle");
    txLab.textContent = b.label;
    svg.appendChild(txLab);
  });

  // Axe X label
  const xLabel = document.createElementNS(svgNS, "text");
  xLabel.setAttribute("x", W / 2); xLabel.setAttribute("y", H - 8);
  xLabel.setAttribute("text-anchor", "middle"); xLabel.setAttribute("font-size", "11");
  xLabel.setAttribute("class", "notes-graduation");
  xLabel.textContent = "Tranches de note / 20";
  svg.appendChild(xLabel);

  return svg;
}

function horizontalBarChart(toutes, barHeight = 22, labelWidth = 100) {
  // Sans note, pas de barre (lot C) : l'appelant dit combien manquent, une phrase plutôt qu'une rangée de « Aucune note ».
  const data = toutes.filter((d) => d.avg != null);
  // Le graphe se dessine à la largeur de son conteneur (viewBox, width: 100 %), jamais en défilant de côté. Sur un écran
  // étroit, le nom passe au-dessus de sa barre au lieu de la précéder : la barre garde presque toute la largeur.
  const width = largeurDeGraphe();
  const empile = width < 520;
  const barGap = 8, ligneDuNom = 14;
  const padTop = 30, padBottom = 30;
  const pas = barHeight + barGap + (empile ? ligneDuNom : 0);
  const chartHeight = padTop + data.length * pas + padBottom;
  const gauche = empile ? 8 : labelWidth;
  const chartWidth = width - gauche - (empile ? 64 : 70);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${chartHeight}`);
  svg.setAttribute("class", "notes-chart-svg");

  [0, 5, 10, 15, 20].forEach((val) => {
    const x = gauche + (val / 20) * chartWidth;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x); line.setAttribute("x2", x);
    line.setAttribute("y1", padTop - 8); line.setAttribute("y2", chartHeight - padBottom + 4);
    line.setAttribute("class", val === 10 ? "notes-axe" : "notes-grille");
    if (val !== 10) line.setAttribute("stroke-dasharray", "2,3");
    svg.appendChild(line);

    const tx = document.createElementNS(svgNS, "text");
    tx.setAttribute("x", x); tx.setAttribute("y", padTop - 12);
    tx.setAttribute("text-anchor", "middle"); tx.setAttribute("font-size", "10");
    tx.setAttribute("class", "notes-graduation");
    tx.textContent = String(val);
    svg.appendChild(tx);
  });

  data.forEach((d, i) => {
    const yLigne = padTop + i * pas;
    const y = yLigne + (empile ? ligneDuNom : 0);   // le haut de la barre

    const label = document.createElementNS(svgNS, "text");
    if (empile) {
      label.setAttribute("x", gauche); label.setAttribute("y", yLigne + 10);
      label.setAttribute("text-anchor", "start");
    } else {
      label.setAttribute("x", labelWidth - 8); label.setAttribute("y", y + barHeight / 2 + 4);
      label.setAttribute("text-anchor", "end");
    }
    label.setAttribute("font-size", "10");
    label.setAttribute("font-weight", d.anon ? "400" : "600");
    label.setAttribute("class", d.anon ? "notes-nom-anonyme" : "notes-nom");
    // Trunc label si trop long (plus de place quand il est au-dessus de la barre)
    const longueurMax = empile ? 40 : 24;
    const lbl = (d.name || "").length > longueurMax ? (d.name.substring(0, longueurMax - 2) + "…") : d.name;
    label.textContent = lbl;
    svg.appendChild(label);

    const track = document.createElementNS(svgNS, "rect");
    track.setAttribute("x", gauche); track.setAttribute("y", y);
    track.setAttribute("width", chartWidth); track.setAttribute("height", barHeight);
    track.setAttribute("rx", 4); track.setAttribute("class", "notes-piste");
    svg.appendChild(track);

    if (d.avg != null) {
      const w = Math.max(2, (d.avg / 20) * chartWidth);
      const bar = document.createElementNS(svgNS, "rect");
      bar.setAttribute("x", gauche); bar.setAttribute("y", y);
      bar.setAttribute("width", w); bar.setAttribute("height", barHeight);
      bar.setAttribute("rx", 4); bar.setAttribute("class", "notes-bar " + cellColorClassFromAvg(d.avg));
      svg.appendChild(bar);

      const val = document.createElementNS(svgNS, "text");
      val.setAttribute("x", gauche + w + 6); val.setAttribute("y", y + barHeight / 2 + 4);
      val.setAttribute("font-size", "10"); val.setAttribute("font-weight", "700");
      val.setAttribute("class", "notes-valeur");
      val.textContent = (Math.round(d.avg * 10) / 10).toString() + (d.count != null ? ` · ${d.count}n` : "");
      svg.appendChild(val);
    }
  });

  return svg;
}

// `imbrique` : la vue est le contenu de La classe, dans Mon suivi (js/views/mon-suivi.js), sous le titre de cette page.
export async function renderNotes(container, { imbrique = false, dansLeCentre = false } = {}) {
  if (imbrique) imbriques.add(container); else imbriques.delete(container);
  if (dansLeCentre) dansLesCentres.add(container); else dansLesCentres.delete(container);
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  let allThemes;
  [stagiaires, competences, evaluations, allThemes, userProfiles, statsServeurGroupe] = await Promise.all([
    listStagiaires(), listCompetences(), listEvaluations(), listThemes(), listUserProfiles(), chargerStatsGroupe(),
  ]);
  themesOfficiels = allThemes.filter((t) => t.type === "theme" && t.numero != null);
  rerender(container);
}

// === Graphique de synthèse : moyennes par stagiaire (SVG bar chart) ===

function renderAveragesChart() {
  const sorted = sortStagiaires(stagiaires, "avg-desc");
  const data = sorted.map((s) => {
    const evs = evaluations.filter((e) => e.stagiaire_id === s.id && e.note != null && e.note_max);
    const avg = evs.length === 0 ? null
      : evs.reduce((sum, e) => sum + (Number(e.note) / Number(e.note_max)) * 20, 0) / evs.length;
    return { name: displayName(s), avg, count: evs.length, anon: isStagiaireAnonymous(s.id) };
  });

  const width = 720;
  const labelWidth = 90;
  const barHeight = 22;
  const barGap = 8;
  const padTop = 30;
  const padBottom = 30;
  const chartHeight = padTop + data.length * (barHeight + barGap) + padBottom;
  const chartWidth = width - labelWidth - 50;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${chartHeight}`);
  svg.setAttribute("class", "notes-chart-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Moyennes par stagiaire");

  // Axe vertical : graduations 0, 5, 10, 15, 20
  [0, 5, 10, 15, 20].forEach((val) => {
    const x = labelWidth + (val / 20) * chartWidth;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x); line.setAttribute("x2", x);
    line.setAttribute("y1", padTop - 8); line.setAttribute("y2", chartHeight - padBottom + 4);
    line.setAttribute("class", val === 10 ? "notes-axe" : "notes-grille");
    line.setAttribute("stroke-dasharray", val === 10 ? "" : "2,3");
    svg.appendChild(line);

    const tx = document.createElementNS(svgNS, "text");
    tx.setAttribute("x", x); tx.setAttribute("y", padTop - 12);
    tx.setAttribute("text-anchor", "middle");
    tx.setAttribute("font-size", "10");
    tx.setAttribute("class", "notes-graduation");
    tx.textContent = String(val);
    svg.appendChild(tx);
  });

  data.forEach((d, i) => {
    const y = padTop + i * (barHeight + barGap);

    // Label
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", labelWidth - 8); label.setAttribute("y", y + barHeight / 2 + 4);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "11");
    label.setAttribute("font-weight", d.anon ? "400" : "600");
    label.setAttribute("class", d.anon ? "notes-nom-anonyme" : "notes-nom");
    label.textContent = d.name;
    svg.appendChild(label);

    // Track (gris)
    const track = document.createElementNS(svgNS, "rect");
    track.setAttribute("x", labelWidth); track.setAttribute("y", y);
    track.setAttribute("width", chartWidth); track.setAttribute("height", barHeight);
    track.setAttribute("rx", 4); track.setAttribute("class", "notes-piste");
    svg.appendChild(track);

    if (d.avg != null) {
      // Bar
      const w = Math.max(2, (d.avg / 20) * chartWidth);
      const bar = document.createElementNS(svgNS, "rect");
      bar.setAttribute("x", labelWidth); bar.setAttribute("y", y);
      bar.setAttribute("width", w); bar.setAttribute("height", barHeight);
      bar.setAttribute("rx", 4); bar.setAttribute("class", "notes-bar " + cellColorClassFromAvg(d.avg));
      svg.appendChild(bar);

      // Value
      const val = document.createElementNS(svgNS, "text");
      const valX = labelWidth + w + 6;
      val.setAttribute("x", valX); val.setAttribute("y", y + barHeight / 2 + 4);
      val.setAttribute("font-size", "11");
      val.setAttribute("font-family", "var(--font)");   // une seule écriture à l'écran (unification du 09/11)
      val.style.fontVariantNumeric = "tabular-nums";
      val.setAttribute("font-weight", "700");
      val.setAttribute("class", "notes-valeur");
      val.textContent = (Math.round(d.avg * 10) / 10).toString() + " / 20";
      svg.appendChild(val);
    } else {
      const val = document.createElementNS(svgNS, "text");
      val.setAttribute("x", labelWidth + 10); val.setAttribute("y", y + barHeight / 2 + 4);
      val.setAttribute("font-size", "10");
      val.setAttribute("class", "notes-valeur-faible");
      val.textContent = "Aucune note";
      svg.appendChild(val);
    }
  });

  const wrap = el("section", { class: "notes-chart" },
    el("h3", { class: "notes-chart-title" }, "Moyennes par stagiaire"),
    el("p", { class: "muted notes-chart-sub" }, "Trié par moyenne décroissante. Les profils anonymes apparaissent en fin de liste."),
    el("div", { class: "notes-chart-svg-wrap" }, svg),
  );
  return wrap;
}
