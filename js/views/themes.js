import { listThemes, updateTheme, addTheme, deleteTheme, listQcmIndex, getQcmFull, publishQcm, unpublishQcm, updateExamConfig, listExamAttempts, resetExamAttempt, listMyQcmAttempts, getMyProfile, listEvaluations, getOrCreateQcm, saveQcmQuestion, deleteQcmQuestion, reorderQcmQuestions, uploadQcmImage, listQcmSignalements, setQcmSignalementStatut, countQcmSignalementsOuverts } from "../db.js?v=20260809b";
import { el, clear, isoDate, formatDate, toast, debounce } from "../utils.js?v=20260809b";
import { icon } from "../icons.js?v=20260809b";
import { examenDemarrable, tempsRestantMs, formatTempsRestant,
         echeanceDepuisChoix, DUREES_OUVERTURE } from "../qcm-exam-rules.js?v=20260809b";
import { isAdmin, getAdminEmail, isProf, isStagiaire } from "../auth-admin.js?v=20260809b";
import { recordUndo } from "../undo.js?v=20260809b";
import { openQcmEntrainement, openQcmExamen } from "./qcm.js?v=20260809b";
import { carteSignalement, renderConsoleSignalements, chargerAuteurs } from "./signalements.js?v=20260809b";
import { renderSubTabs } from "../subtabs.js?v=20260809b";

let themes = [];
let qcmByTheme = new Map();  // theme_id -> { id, nb_questions, published, ... }
let myExamByQcm = new Map();       // qcm_id -> ma dernière tentative examen (QCM)
let myTrainByQcm = new Map();      // qcm_id -> ma dernière tentative entraînement
let myNoteByThemeNum = new Map();  // theme_numero -> ma note officielle (matrice Notes)
let signalByQcm = {};              // qcm_id -> nb de signalements ouverts (formateur seulement)
let lastContainer = null;          // pour rafraîchir la liste après un QCM
// L'onglet Thèmes partage son nœud d'affichage avec la console des signalements
// (subtabs.js réutilise un seul panneau). Un repeint asynchrone arrivé alors que
// l'utilisateur est passé sur la console effacerait ce qu'il regarde : ce jeton dit
// si l'onglet Thèmes est encore celui qui est affiché. Hors sous-onglets (cas d'un
// élève, qui n'a pas de barre), il vaut toujours vrai.
let themesActif = () => true;

// Après un QCM (entraînement ou examen), recharge la liste pour mettre à jour mes notes.
window.addEventListener("qcm-attempt-saved", async () => {
  if (!lastContainer) return;
  try { await reload(lastContainer); } catch (e) { /* refresh silencieux */ }
});

// Phase dev : le QCM n'est visible que par le fondateur en vue réelle.
// En aperçu « Voir en tant que … », il disparaît (= ce que verra un élève).
// La RLS (lecture QCM = fondateur) double cette restriction côté serveur.
function canSeeQcm() {
  // Ouvert a tout utilisateur connecte depuis la publication des QCM (31/07).
  // Le filtrage est fait par la RLS, pas ici : un stagiaire ne recoit que les QCM
  // publies, un formateur recoit en plus les brouillons. Garder un test de role
  // ici reviendrait a cacher a la promo ce que la base lui autorise deja.
  return true;
}

async function loadQcmIndex() {
  if (!canSeeQcm()) { qcmByTheme = new Map(); myExamByQcm = new Map(); myTrainByQcm = new Map(); myNoteByThemeNum = new Map(); signalByQcm = {}; return; }
  try {
    const profile = await getMyProfile();
    // Les signalements ouverts sont comptés dès la liste : sinon le formateur devrait
    // ouvrir chaque QCM un par un pour découvrir lesquels ont été signalés.
    // Le comptage est réservé au formateur, et la RLS ne suffit PAS à l'assurer : sa
    // politique de lecture laisse un élève relire SES propres signalements, il verrait
    // donc un drapeau sur les QCM qu'il a lui-même signalés. Et en aperçu « Voir en tant
    // que », la RLS n'est pas simulée du tout : le fondateur verrait tous les drapeaux
    // alors qu'il regarde l'écran d'un élève. Le garde-fou est donc ici.
    const [list, attempts, evals, signals] = await Promise.all([
      listQcmIndex(),
      listMyQcmAttempts(),
      profile?.stagiaire_id ? listEvaluations({ stagiaire_id: profile.stagiaire_id }) : Promise.resolve([]),
      canManageExam() ? countQcmSignalementsOuverts().catch(() => ({})) : Promise.resolve({}),
    ]);
    signalByQcm = signals || {};
    qcmByTheme = new Map(list.filter((q) => q.nb_questions > 0).map((q) => [q.theme_id, q]));
    myExamByQcm = new Map();
    myTrainByQcm = new Map();
    for (const a of attempts) {  // tri desc : la 1re rencontre par (qcm, mode) est la plus récente
      const map = a.mode === "examen" ? myExamByQcm : myTrainByQcm;
      if (!map.has(a.qcm_id)) map.set(a.qcm_id, a);
    }
    myNoteByThemeNum = new Map();
    for (const e of evals) {  // listEvaluations triée date desc : 1re = plus récente
      if (e.type === "Thème" && e.theme_numero != null && e.note != null && !myNoteByThemeNum.has(e.theme_numero)) {
        myNoteByThemeNum.set(e.theme_numero, e);
      }
    }
  } catch (e) {
    qcmByTheme = new Map(); myExamByQcm = new Map(); myTrainByQcm = new Map(); myNoteByThemeNum = new Map(); signalByQcm = {};
  }
}

// Ma note "officielle" pour un thème : matrice Notes si numéroté, sinon la tentative examen du QCM.
function myThemeNote(theme, qcm) {
  if (theme.numero != null) {
    const e = myNoteByThemeNum.get(theme.numero);
    return e ? Math.round((Number(e.note) / Number(e.note_max || 20)) * 20 * 10) / 10 : null;
  }
  const ex = myExamByQcm.get(qcm.id);
  return ex ? Number(ex.note_20) : null;
}
function myTrainNote(qcm) {
  const t = myTrainByQcm.get(qcm.id);
  return t ? Number(t.note_20) : null;
}
// Palier de couleur d'une note /20 (pêche -> vert).
function noteClass(n) {
  if (n == null) return "none";
  if (n >= 16) return "great";
  if (n >= 12) return "ok";
  if (n >= 8) return "mid";
  return "low";
}

// Cellule QCM de la liste : un bouton d'ouverture + les notes en texte étiqueté
// (une seule forme = le bouton ; les notes sont nommées, valeur colorée selon le score).
function qcmCellEl(theme, qcm) {
  const btn = el("button", {
    class: "theme-qcm-hint", type: "button", title: "Ouvrir le QCM",
    onClick: (ev) => { ev.preventDefault(); ev.stopPropagation(); openQcmSheet(theme, qcm); },
  }, icon.quiz(), "QCM");
  const note = myThemeNote(theme, qcm);
  const train = myTrainNote(qcm);
  const cell = el("div", { class: "theme-qcm-cell2" }, btn);
  // Examen ouvert : reperable d'un coup d'oeil depuis la liste. C'est le filet
  // contre l'oubli quand un formateur a ouvert sans limite de temps.
  if (examenDemarrable(qcm)) {
    const restant = tempsRestantMs(qcm);
    cell.appendChild(el("span", {
      class: "theme-qcm-exam-on",
      title: restant == null ? "Examen ouvert sans limite" : `Examen ouvert, ferme dans ${formatTempsRestant(restant)}`,
    }, "Examen ouvert"));
  }

  // Signalements ouverts : visible sans ouvrir le QCM, sinon ils passent inapercus.
  const nbSignal = signalByQcm[qcm.id] || 0;
  if (nbSignal) {
    cell.appendChild(el("span", {
      class: "theme-qcm-signal",
      title: nbSignal + " signalement" + (nbSignal > 1 ? "s" : "") + " a traiter dans ce QCM",
    }, "⚑ " + nbSignal));
  }
  if (note != null || train != null) {
    const row = (lab, val, colored) => el("div", { class: "qcm-cell-note-row" },
      el("span", { class: "qcm-cell-note-lab" }, lab),
      el("span", { class: "qcm-cell-note-val " + (colored ? "n-" + noteClass(val) : "is-muted") },
        val != null ? `${val}/20` : "-"),
    );
    cell.appendChild(el("div", { class: "qcm-cell-notes" },
      row("Examen", note, true),
      row("Entraîn.", train, false),
    ));
  }
  return cell;
}

// Cellule QCM d'un thème sans banque : entrée « Créer QCM » (formateur), ouvre l'éditeur vide.
function createQcmCellEl(theme) {
  return el("div", { class: "theme-qcm-cell2" },
    el("button", {
      class: "theme-qcm-hint create", type: "button", title: "Créer le QCM de ce thème",
      onClick: (ev) => { ev.preventDefault(); ev.stopPropagation(); openQcmEditor(theme, null); },
    }, icon.plus(), "Créer QCM"),
  );
}

// Tire n éléments au hasard (ordre aléatoire). n falsy ou >= longueur => tout.
function sampleN(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return (n && n < a.length) ? a.slice(0, n) : a;
}

function canManageExam() { return isAdmin() || isProf(); }

// Fiche QCM dédiée, ouverte depuis la colonne QCM de la liste.
// Regroupe : mes notes, l'entraînement, l'examen (stagiaire) et la gestion (formateur).
function openQcmSheet(theme, qcm) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const body = el("div", { class: "qcm-sheet-body" });

  // Corps re-rendable : re-appelé après Publier/Dépublier pour que le bloc
  // stagiaire (Passer l'examen / « pas encore en ligne ») suive qcm.published.
  function renderBody() {
    clear(body);
    const note = myThemeNote(theme, qcm);
    const train = myTrainNote(qcm);

    // Zone notes (stagiaire) : deux grandes cartes colorées, lacunes visibles d'un coup d'œil.
    if (isStagiaire()) {
      body.appendChild(el("div", { class: "qcm-note-cards" },
        el("div", { class: "qcm-note-card n-" + noteClass(note) },
          el("span", { class: "qcm-note-card-val" }, note != null ? `${note}/20` : "-"),
          el("span", { class: "qcm-note-card-lab" }, "Ma note d'examen"),
        ),
        el("div", { class: "qcm-note-card n-" + noteClass(train) },
          el("span", { class: "qcm-note-card-val" }, train != null ? `${train}/20` : "-"),
          el("span", { class: "qcm-note-card-lab" }, "Dernier entraînement"),
        ),
      ));
    }

    // S'entraîner (tout le monde). Ordre adaptatif : mes erreurs passées d'abord.
    body.appendChild(el("button", { class: "btn primary full", type: "button",
      onClick: () => { backdrop.remove(); openQcmEntrainement(theme, qcm); } }, icon.play(), "S'entraîner"));
    body.appendChild(el("p", { class: "muted", style: "font-size:0.78rem;text-align:center;margin:0.35rem 0 0" },
      "Libre, illimité, ne compte pas dans les notes. Tes anciennes erreurs passent en premier."));

    // Revoir mes erreurs : rejoue uniquement les questions échouées (les 2 modes comptent).
    if (isStagiaire()) {
      body.appendChild(el("button", { class: "btn ghost full", type: "button", style: "margin-top:0.45rem",
        onClick: () => { backdrop.remove(); openQcmEntrainement(theme, qcm, { errorsOnly: true }); } },
        icon.history(), "Revoir mes erreurs"));
    }

    // Passer l'examen (stagiaire).
    if (isStagiaire()) {
      if (examenDemarrable(qcm)) {
        const restant = tempsRestantMs(qcm);
        body.appendChild(el("button", { class: "btn accent full", type: "button", style: "margin-top:0.9rem",
          onClick: () => { backdrop.remove(); openQcmExamen(theme, qcm); } }, "Passer l'examen"));
        body.appendChild(el("p", { class: "muted", style: "font-size:0.78rem;text-align:center;margin:0.35rem 0 0" },
          "Une seule passe, chronométrée, notée sur 20."
          + (restant == null ? "" : ` L'examen ferme dans ${formatTempsRestant(restant)}.`)));
      } else {
        // Pas de bouton grisé : il inviterait à cliquer pour rien.
        body.appendChild(el("p", { class: "muted", style: "text-align:center;margin:0.9rem 0 0;font-size:0.82rem" },
          "L'examen s'ouvre quand un formateur le décide. L'entraînement, lui, est illimité."));
      }
    }

    // Signalements ouverts : remontés SUR la fiche, avec un accès direct à l'éditeur.
    // Sans ça il fallait passer par « Modifier » puis « Éditer les questions » pour les
    // découvrir, donc savoir à l'avance qu'il y en avait.
    const nbSignal = signalByQcm[qcm.id] || 0;
    if (canManageExam() && nbSignal) {
      const voir = el("button", { class: "btn full", type: "button", style: "margin-top:0.9rem" },
        `⚑ ${nbSignal} signalement${nbSignal > 1 ? "s" : ""} à traiter`);
      voir.addEventListener("click", () => { backdrop.remove(); openQcmEditor(theme, qcm.id); });
      body.appendChild(voir);
      body.appendChild(el("p", { class: "muted", style: "font-size:0.78rem;text-align:center;margin:0.35rem 0 0" },
        "Signalé par un élève. Ouvre l'éditeur pour lire et classer."));
    }

    // Gestion formateur (éditer la banque, publier / tirage / tentatives).
    // « Éditer les questions » est dans la modale « Modifier » ; l'éditeur s'ouvre par-dessus
    // cette fiche (qui reste dessous pour le retour).
    if (canManageExam()) body.appendChild(themeExamPanel(theme, qcm, renderBody));
  }
  renderBody();

  const modal = el("div", { class: "modal theme-modal" },
    el("div", { class: "theme-modal-head" },
      theme.numero ? el("span", { class: "theme-modal-num" }, String(theme.numero).padStart(2, "0")) : null,
      el("h3", { class: "theme-modal-titre" }, "QCM · " + theme.titre),
    ),
    body,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer"),
    ),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

// Panneau formateur : statut + deux actions (ouvrir/retirer l'examen, Modifier).
// ATTENTION au sens de `published` : il ne gouverne QUE la mise en ligne de
// l'examen. La lecture des QCM et l'entraînement sont ouverts à tout utilisateur
// connecté, independamment de ce drapeau (politiques RLS du 2026-08-01). Un QCM
// « examen non ouvert » est donc bien visible et utilisable en entraînement.
// « Modifier » ouvre une modale regroupant l'édition de la banque, les questions
// (au hasard / à la main), le temps et les tentatives.
// onPublishChange : re-rend la fiche entière après Publier/Dépublier (le panneau
// courant est alors remplacé, ne plus toucher à ses nœuds après l'appel).
function themeExamPanel(theme, qcm, onPublishChange) {
  const panel = el("div", { class: "theme-exam-panel" });
  const status = el("p", { class: "theme-exam-status" });
  const actions = el("div", { class: "theme-exam-actions" });

  function refreshStatus() {
    clear(status);
    const ouvert = examenDemarrable(qcm);
    const frozenN = Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids.length : null;
    const restant = tempsRestantMs(qcm);
    // Une échéance dépassée laisse published à true en base : on l'affiche comme
    // fermé, sans mentir sur l'état, pour que le formateur sache qu'il peut rouvrir.
    const echu = !!qcm.published && !ouvert;
    status.appendChild(el("span", { class: "exam-badge " + (ouvert ? "on" : "off") },
      ouvert ? "Examen ouvert" : (echu ? "Examen échu" : "Examen non ouvert")));
    if (ouvert) {
      status.appendChild(el("span", { class: "exam-echeance" },
        restant == null ? "sans limite" : `ferme dans ${formatTempsRestant(restant)}`));
    }
    status.appendChild(el("span", { class: "muted", style: "font-size:0.8rem" },
      ` ${frozenN ?? qcm.nb_questions} questions · ${qcm.exam_seconds_per_question || 30}s/question`
      + (qcm.exam_draw_mode === "manual" ? " · sélection manuelle" : " · tirage aléatoire")));

    clear(actions);
    actions.appendChild(ouvert
      ? el("button", { class: "btn danger", type: "button", onClick: doUnpublish }, "Fermer maintenant")
      : el("button", { class: "btn primary", type: "button", onClick: demanderDuree }, "Ouvrir l'examen"));
    actions.appendChild(el("button", { class: "btn ghost", type: "button", onClick: openConfig }, "Modifier"));
  }

  // Ouvrir : on demande d'abord POUR COMBIEN DE TEMPS. Une ouverture sans échéance
  // reste possible, mais le formateur devra refermer lui-même : la pastille de la
  // liste des thèmes est là pour qu'il ne l'oublie pas.
  function demanderDuree() {
    const bd = el("div", { class: "modal-backdrop" });
    const choix = el("div", { class: "exam-duree-choix" });
    DUREES_OUVERTURE.forEach((d) => {
      const b = el("button", { class: "btn ghost full", type: "button" }, d.label);
      b.addEventListener("click", () => { bd.remove(); doPublishNow(echeanceDepuisChoix(d)); });
      choix.appendChild(b);
    });
    const modal = el("div", { class: "modal" },
      el("h3", {}, "Ouvrir l'examen pour combien de temps ?"),
      el("p", { class: "muted", style: "font-size:0.85rem;margin:0 0 0.8rem" },
        "Les stagiaires pourront démarrer pendant cette durée. Celui qui a démarré à temps peut terminer sa passe."),
      choix,
      el("div", { class: "modal-actions" },
        el("button", { class: "btn ghost", type: "button", onClick: () => bd.remove() }, "Annuler")),
    );
    bd.appendChild(modal);
    bd.addEventListener("click", (e) => { if (e.target === bd) bd.remove(); });
    document.body.appendChild(bd);
  }

  // Publier : met en ligne avec la config actuelle (gèle toutes les questions si aucun tirage défini).
  async function doPublishNow(fermeA = null) {
    try {
      let ids = Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids : null;
      if (!ids || !ids.length) {
        const full = await getQcmFull(qcm.id);
        ids = (full.questions || []).filter((q) => (q.options || []).length > 0).map((q) => q.id);
      }
      await publishQcm(qcm.id, {
        examQuestionIds: ids, drawMode: qcm.exam_draw_mode || "random",
        nbQuestions: qcm.exam_nb_questions ?? null, secondsPerQuestion: qcm.exam_seconds_per_question ?? 30,
        email: getAdminEmail(), fermeA,
      });
      Object.assign(qcm, { published: true, exam_question_ids: ids, exam_ferme_a: fermeA });
      toast(fermeA
        ? `Examen ouvert : ${ids.length} questions, ferme dans ${formatTempsRestant(tempsRestantMs(qcm))}.`
        : `Examen ouvert sans limite : ${ids.length} questions. Pense à le refermer.`, "success");
      if (onPublishChange) onPublishChange(); else refreshStatus();
    } catch (e) { toast("Ouverture impossible : " + (e?.message || e), "error"); }
  }

  async function doUnpublish() {
    try {
      await unpublishQcm(qcm.id);
      Object.assign(qcm, { published: false, exam_ferme_a: null });
      toast("Examen fermé.", "success");
      if (onPublishChange) onPublishChange(); else refreshStatus();
    } catch (e) { toast("Fermeture impossible : " + (e?.message || e), "error"); }
  }

  // Avertit si des tentatives existent avant de changer le tirage (risque d'incohérence).
  async function confirmDrawChange() {
    let attempts = [];
    try { attempts = await listExamAttempts(qcm.id); } catch (e) { /* ignore */ }
    if (attempts.length > 0) {
      return window.confirm(`${attempts.length} stagiaire(s) ont déjà passé l'examen. Changer les questions rendra leur passage incohérent. Continuer ?`);
    }
    return true;
  }

  // Modale « Modifier » : temps, questions (au hasard / à la main), tentatives.
  function openConfig() {
    const bd = el("div", { class: "modal-backdrop" });
    const summary = el("p", { class: "muted", style: "font-size:0.82rem;margin:0 0 0.6rem" });
    function refreshSummary() {
      const frozenN = Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids.length : qcm.nb_questions;
      summary.textContent = `Actuel : ${frozenN} questions · ${qcm.exam_seconds_per_question || 30}s/question · `
        + (qcm.exam_draw_mode === "manual" ? "sélection manuelle" : "tirage aléatoire");
    }
    refreshSummary();

    const secInput = el("input", { type: "number", min: 5, max: 300, step: 5, value: qcm.exam_seconds_per_question ?? 30 });
    secInput.addEventListener("change", async () => {
      const secs = Number(secInput.value) || 30;
      try {
        await updateExamConfig(qcm.id, { exam_seconds_per_question: secs });
        qcm.exam_seconds_per_question = secs;
        toast("Temps mis à jour.", "success"); refreshStatus(); refreshSummary();
      } catch (e) { toast("Impossible : " + (e?.message || e), "error"); }
    });

    const nbInput = el("input", { type: "number", min: 1, max: qcm.nb_questions, placeholder: "toutes", value: qcm.exam_nb_questions ?? "" });
    async function drawRandom() {
      if (!(await confirmDrawChange())) return;
      try {
        const full = await getQcmFull(qcm.id);
        const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
        const nb = nbInput.value ? Number(nbInput.value) : null;
        const ids = sampleN(qs, nb).map((q) => q.id);
        if (!ids.length) { toast("Aucune question exploitable.", "error"); return; }
        await updateExamConfig(qcm.id, { exam_question_ids: ids, exam_draw_mode: "random", exam_nb_questions: nb });
        Object.assign(qcm, { exam_question_ids: ids, exam_draw_mode: "random", exam_nb_questions: nb });
        toast(`Tirage aléatoire de ${ids.length} questions.`, "success"); refreshStatus(); refreshSummary();
      } catch (e) { toast("Impossible : " + (e?.message || e), "error"); }
    }

    async function chooseManual() {
      if (!(await confirmDrawChange())) return;
      let full;
      try { full = await getQcmFull(qcm.id); }
      catch (e) { toast("Chargement impossible : " + (e?.message || e), "error"); return; }
      const qs = (full.questions || []).filter((q) => (q.options || []).length > 0);
      const preset = new Set(Array.isArray(qcm.exam_question_ids) ? qcm.exam_question_ids : []);
      const backdrop = el("div", { class: "modal-backdrop" });
      const list = el("div", { class: "exam-pick-list" });
      const countEl = el("span", { class: "muted", style: "font-size:0.82rem;margin-left:auto" });
      function updateCount() { countEl.textContent = `${list.querySelectorAll("input[type=checkbox]:checked").length} / ${qs.length} sélectionnées`; }
      qs.forEach((q, i) => {
        const cb = el("input", { type: "checkbox" });
        cb.checked = preset.has(q.id); cb.dataset.qid = String(q.id);
        cb.addEventListener("change", updateCount);
        list.appendChild(el("label", { class: "exam-pick-item" }, cb, el("span", {}, `${i + 1}. ${q.enonce}`)));
      });
      function setAll(v) { list.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = v; }); updateCount(); }
      const modal2 = el("div", { class: "modal" },
        el("h3", {}, "Choisir les questions"),
        el("p", { class: "muted", style: "font-size:0.85rem" }, "Coche les questions. L'ordre suit l'ordre des questions."),
        el("div", { style: "display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin:0.2rem 0 0.5rem" },
          el("button", { class: "btn ghost", type: "button", style: "padding:0.35rem 0.7rem;font-size:0.82rem;flex:0 0 auto", onClick: () => setAll(true) }, "Tout cocher"),
          el("button", { class: "btn ghost", type: "button", style: "padding:0.35rem 0.7rem;font-size:0.82rem;flex:0 0 auto", onClick: () => setAll(false) }, "Tout décocher"),
          countEl,
        ),
        list,
        el("div", { class: "modal-actions" },
          el("button", { class: "btn ghost", type: "button", onClick: () => backdrop.remove() }, "Annuler"),
          el("button", { class: "btn primary", type: "button", onClick: async () => {
            const ids = qs.filter((q) => list.querySelector(`input[data-qid="${q.id}"]`).checked).map((q) => q.id);
            if (!ids.length) { toast("Sélectionne au moins une question.", "error"); return; }
            try {
              await updateExamConfig(qcm.id, { exam_question_ids: ids, exam_draw_mode: "manual", exam_nb_questions: ids.length });
              Object.assign(qcm, { exam_question_ids: ids, exam_draw_mode: "manual", exam_nb_questions: ids.length });
              backdrop.remove();
              toast(`Sélection de ${ids.length} questions.`, "success"); refreshStatus(); refreshSummary();
            } catch (e) { toast("Impossible : " + (e?.message || e), "error"); }
          } }, "Valider la sélection"),
        ),
      );
      updateCount();
      backdrop.appendChild(modal2);
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
      document.body.appendChild(backdrop);
    }

    async function manageAttempts() {
      let attempts;
      try { attempts = await listExamAttempts(qcm.id); }
      catch (e) { toast("Chargement impossible : " + (e?.message || e), "error"); return; }
      const backdrop = el("div", { class: "modal-backdrop" });
      const bodyA = el("div", { class: "exam-attempts-list" });
      function fill() {
        clear(bodyA);
        if (!attempts.length) { bodyA.appendChild(el("p", { class: "muted" }, "Aucune tentative pour l'instant.")); return; }
        attempts.forEach((a) => {
          bodyA.appendChild(el("div", { class: "exam-attempt-row" },
            el("span", {}, (a.stagiaire?.prenom || `Stagiaire ${a.stagiaire_id}`) + ` : ${a.note_20}/20`),
            el("button", { class: "btn danger", type: "button", onClick: async () => {
              if (!window.confirm("Réinitialiser cette tentative ? La note sera supprimée.")) return;
              try { await resetExamAttempt(qcm.id, a.stagiaire_id); attempts = attempts.filter((x) => x.id !== a.id); toast("Tentative réinitialisée.", "success"); fill(); }
              catch (e) { toast("Réinitialisation impossible : " + (e?.message || e), "error"); }
            } }, "Réinitialiser"),
          ));
        });
      }
      fill();
      const modal3 = el("div", { class: "modal" },
        el("h3", {}, "Tentatives d'examen"), bodyA,
        el("div", { class: "modal-actions" }, el("button", { class: "btn ghost", type: "button", onClick: () => backdrop.remove() }, "Fermer")),
      );
      backdrop.appendChild(modal3);
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
      document.body.appendChild(backdrop);
    }

    // Ouvre l'éditeur de la banque : ferme la modale « Modifier » mais LAISSE la fiche QCM
    // dessous (z-index:200). L'éditeur (z-index:1000) s'ouvre au premier plan ; à sa fermeture
    // le formateur retombe sur la fiche QCM (son point de départ), pas sur la liste nue.
    function editQuestions() {
      bd.remove();
      openQcmEditor(theme, qcm.id);
    }

    // Sections groupées par sujet : d'abord le contenu (banque + tirage qui en dépend),
    // puis les paramètres de passation (temps), puis la gestion (tentatives).
    const modal = el("div", { class: "modal" },
      el("h3", {}, "Modifier l'examen"),
      summary,
      el("div", { class: "config-section" },
        el("p", { class: "config-label" }, "Banque de questions"),
        el("button", { class: "btn ghost full", type: "button", onClick: editQuestions }, icon.quiz(), "Éditer les questions"),
      ),
      el("div", { class: "config-section" },
        el("p", { class: "config-label" }, "Questions de l'examen"),
        el("div", { class: "theme-exam-draw-line" }, el("span", {}, "Tirer"), nbInput, el("span", {}, `au hasard (sur ${qcm.nb_questions})`)),
        el("button", { class: "btn ghost full", type: "button", style: "margin-top:0.4rem", onClick: drawRandom }, "Tirer au hasard"),
        el("button", { class: "btn ghost full", type: "button", style: "margin-top:0.4rem", onClick: chooseManual }, "Choisir à la main"),
      ),
      el("div", { class: "config-section" },
        el("label", { class: "config-field" }, el("span", {}, "Temps par question (s)"), secInput),
      ),
      el("div", { class: "config-section" },
        el("p", { class: "config-label" }, "Tentatives des stagiaires"),
        el("button", { class: "btn ghost full", type: "button", onClick: manageAttempts }, "Gérer les tentatives"),
      ),
      el("div", { class: "modal-actions" },
        el("button", { class: "btn primary", type: "button", onClick: () => bd.remove() }, "Fermer"),
      ),
    );
    bd.appendChild(modal);
    bd.addEventListener("click", (e) => { if (e.target === bd) bd.remove(); });
    document.body.appendChild(bd);
  }

  panel.appendChild(el("p", { class: "theme-exam-panel-title" }, "Examen (formateur)"));
  panel.appendChild(status);
  panel.appendChild(actions);
  refreshStatus();
  return panel;
}

// === Éditeur de QCM (formateur) ===

// Éditeur plein écran de la banque de questions d'un thème.
// qcmId null => on crée (ou récupère) la ligne qcm du thème à l'ouverture.
async function openQcmEditor(theme, qcmId, questionIdCible = null, onFerme = null) {
  if (qcmId == null) {
    try {
      qcmId = await getOrCreateQcm(theme.id, theme.titre, getAdminEmail());
    } catch (e) {
      toast("Création du QCM impossible : " + (e?.message || e), "error");
      return;
    }
  }

  const overlay = el("div", { class: "qcm-overlay" });
  const panel = el("div", { class: "qcm-player qcm-editor" });
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.classList.add("qcm-open");

  let dirty = false;  // une modif a-t-elle eu lieu ? (pour rafraîchir la vue Thèmes en sortie)

  // Le saut ne vaut que pour le PREMIER rendu : l'éditeur se repeint à chaque
  // enregistrement, et refaire défiler à chaque fois serait pénible.
  let cibleAFaire = questionIdCible;

  function close() {
    document.removeEventListener("keydown", onEditorKey);
    overlay.remove();
    document.body.classList.remove("qcm-open");
    // La banque a changé (nb_questions, existence) : rafraîchir la liste des thèmes.
    // Ouvert depuis la console : c'est elle qu'il faut rafraîchir, pas la liste des
    // thèmes, qui n'est même pas affichée.
    if (dirty && onFerme) { onFerme().catch(() => { /* refresh silencieux */ }); }
    else if (dirty && lastContainer) { reload(lastContainer).catch(() => { /* refresh silencieux */ }); }
  }
  // Pas de fermeture au clic à côté : un clic involontaire sortait de l'écran d'édition.
  // On sort par la croix ou par Échap, et Échap ne s'applique pas si un formulaire
  // de question est ouvert par-dessus (c'est lui qui gère alors la touche).
  function onEditorKey(e) {
    if (e.key !== "Escape") return;
    if (document.querySelector(".qcm-form-backdrop")) return;
    e.preventDefault();
    close();
  }
  document.addEventListener("keydown", onEditorKey);

  const numPrefix = theme.numero ? String(theme.numero).padStart(2, "0") + " · " : "";
  const onSaved = () => { dirty = true; reloadEditor(); };

  // En-tête minimal avec bouton fermer, réutilisé par l'écran d'erreur (toujours une sortie).
  function editorHead(sub) {
    return el("div", { class: "qcm-head" },
      el("div", { class: "qcm-head-text" },
        el("span", { class: "qcm-badge" }, "Éditer"),
        el("p", { class: "qcm-head-title" }, numPrefix + theme.titre),
        sub ? el("p", { class: "qcm-head-sub" }, sub) : null,
      ),
      el("button", { class: "qcm-close", type: "button", "aria-label": "Fermer", onClick: close }, icon.close()),
    );
  }

  // Signalements ouverts du QCM, rechargés avec l'éditeur. Un échec ici ne doit
  // jamais empêcher l'édition : on retombe sur « aucun signalement ».
  let signalements = { liste: [], parQuestion: {} };

  async function reloadEditor() {
    let full;
    try {
      // Les auteurs d'abord : sans eux la carte n'affiche que l'adresse, qui ne dit pas
      // toujours qui a signalé (adresses partagées).
      await chargerAuteurs();
      signalements = await listQcmSignalements(qcmId, { statut: "ouvert" });
    } catch (e) {
      console.error("Signalements illisibles :", e);
      signalements = { liste: [], parQuestion: {} };
    }
    try {
      full = await getQcmFull(qcmId);
    } catch (e) {
      clear(panel);
      panel.appendChild(editorHead(null));
      panel.appendChild(el("p", { class: "muted", style: "padding:2rem 0;text-align:center" },
        "Chargement impossible : " + (e?.message || e)));
      panel.appendChild(el("div", { class: "qcm-actions" },
        el("button", { class: "btn primary", type: "button", onClick: close }, "Fermer"),
      ));
      return;
    }
    renderEditor(full);
  }

  function renderEditor(full) {
    clear(panel);
    const questions = full.questions || [];

    panel.appendChild(editorHead(questions.length + " question" + (questions.length > 1 ? "s" : "")));

    if (signalements.liste.length) panel.appendChild(signalPanel(questions));

    const list = el("div", { class: "qcm-editor-list" });
    if (!questions.length) {
      list.appendChild(el("p", { class: "muted", style: "text-align:center;padding:1.5rem 0" },
        "Aucune question pour l'instant. Ajoute la première ci-dessous."));
    }
    questions.forEach((q, i) => list.appendChild(questionCard(q, i, questions)));
    panel.appendChild(list);

    if (cibleAFaire) {
      const cible = list.querySelector('.qcm-editor-card[data-question-id="' + cibleAFaire + '"]');
      cibleAFaire = null;
      if (cible) {
        cible.scrollIntoView({ block: "center" });
        cible.classList.add("qcm-editor-card-cible");
        setTimeout(() => cible.classList.remove("qcm-editor-card-cible"), 2000);
      }
    }

    panel.appendChild(el("div", { class: "qcm-actions" },
      el("button", { class: "btn primary full", type: "button",
        onClick: () => openQuestionForm(qcmId, null, questions.length, onSaved, questions) },
        icon.plus(), "Ajouter une question"),
    ));
  }

  // Les signalements en tête de l'éditeur : c'est là que le formateur corrige,
  // donc c'est là qu'ils doivent apparaître, avec le numéro de la question visée.
  function signalPanel(questions) {
    const numeroDe = new Map(questions.map((q, i) => [q.id, i + 1]));
    const box = el("div", { class: "qcm-signal-panel" });
    const n = signalements.liste.length;
    box.appendChild(el("h4", {}, `⚑ ${n} signalement${n > 1 ? "s" : ""} à traiter`));

    signalements.liste.forEach((s) => {
      async function classer(statut, bouton) {
        bouton.disabled = true;
        try {
          await setQcmSignalementStatut(s.id, statut, getAdminEmail());
          toast(statut === "traite" ? "Signalement classé comme corrigé." : "Signalement écarté.", "success");
          dirty = true;  // sinon le badge de la liste des thèmes reste sur l'ancien compte
          await reloadEditor();
        } catch (e) {
          bouton.disabled = false;
          toast("Échec : " + (e?.message || e), "error");
        }
      }
      // Dans l'éditeur, le rang suffit comme repère : la liste des questions est juste
      // en dessous, l'énoncé serait redondant.
      const num = numeroDe.get(s.question_id);
      box.appendChild(carteSignalement(s, { titre: num ? "Question " + num : null, onClasser: classer }));
    });
    return box;
  }

  function questionCard(q, i, questions) {
    const correctCount = (q.options || []).filter((o) => o.is_correct).length;
    const card = el("div", { class: "qcm-editor-card", dataset: { questionId: String(q.id) } });

    // Toutes les actions sont DANS l'en-tête, à côté du numéro : placées en bas de carte,
    // elles se lisaient comme appartenant à la question suivante (on éditait la précédente).
    card.appendChild(el("div", { class: "qcm-editor-card-head" },
      el("span", { class: "qcm-editor-card-num" }, String(i + 1)),
      q.section ? el("span", { class: "qcm-editor-section" }, q.section) : null,
      correctCount > 1 ? el("span", { class: "qcm-editor-multi" }, "Plusieurs réponses") : null,
      (signalements.parQuestion[q.id] || []).length
        ? el("span", { class: "qcm-editor-signal", title: "Signalements ouverts sur cette question" },
            "⚑ " + signalements.parQuestion[q.id].length)
        : null,
      el("div", { class: "qcm-editor-card-order" },
        el("button", { class: "btn small ghost", type: "button", title: "Monter",
          disabled: i === 0 || undefined, onClick: () => moveQuestion(questions, i, -1) }, "↑"),
        el("button", { class: "btn small ghost", type: "button", title: "Descendre",
          disabled: i === questions.length - 1 || undefined, onClick: () => moveQuestion(questions, i, 1) }, "↓"),
        el("button", { class: "btn ghost small", type: "button", title: `Modifier la question ${i + 1}`,
          onClick: () => openQuestionForm(qcmId, q, q.ordre, onSaved, questions) }, "Éditer"),
        el("button", { class: "btn danger small", type: "button", title: `Supprimer la question ${i + 1}`,
          onClick: () => removeQuestion(q) }, "Supprimer"),
      ),
    ));

    card.appendChild(el("p", { class: "qcm-editor-enonce" }, q.enonce));
    if (q.image_url) {
      card.appendChild(el("img", { class: "qcm-editor-thumb", src: q.image_url, alt: "", loading: "lazy" }));
    }

    const opts = el("ul", { class: "qcm-editor-opts" });
    (q.options || []).forEach((o) => {
      opts.appendChild(el("li", { class: "qcm-editor-opt" + (o.is_correct ? " correct" : "") },
        el("span", { class: "qcm-editor-opt-mark" }, o.is_correct ? "✓" : ""),
        el("span", { class: "qcm-editor-opt-text" }, o.texte),
      ));
    });
    card.appendChild(opts);
    return card;
  }

  // ↑/↓ : réordonne en renormalisant ordre = position (robuste même si les ordres sont égaux/à trous).
  async function moveQuestion(questions, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const arr = questions.slice();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    try {
      await reorderQcmQuestions(arr.map((q, k) => ({ id: q.id, ordre: k })));
      dirty = true;
      await reloadEditor();
    } catch (e) {
      toast("Réordonnancement impossible : " + (e?.message || e), "error");
    }
  }

  async function removeQuestion(q) {
    if (!window.confirm("Supprimer cette question ?")) return;
    try {
      await deleteQcmQuestion(q.id);
      dirty = true;
      toast("Question supprimée.", "success");
      await reloadEditor();
    } catch (e) {
      toast("Suppression impossible : " + (e?.message || e), "error");
    }
  }

  panel.appendChild(el("div", { class: "loading" }, "Chargement"));
  reloadEditor();
}

// Modale de création / édition d'une question (multi-réponses).
// nextOrdre = ordre à donner à une nouvelle question (ignoré en édition).
function openQuestionForm(qcmId, question, nextOrdre, onSaved, siblings = []) {
  const isEdit = !!question;
  let pendingImageUrl = question?.image_url ?? null;

  // Position : déplacer une question n'importe où sans cliquer ↑ ou ↓ vingt fois.
  const posFrom = isEdit ? siblings.findIndex((s) => s.id === question.id) : -1;
  const posInput = el("input", {
    type: "number", min: "1", max: String(Math.max(siblings.length, 1)),
    value: String(posFrom >= 0 ? posFrom + 1 : siblings.length + 1),
  });

  // `qcm-form-backdrop` place ce formulaire AU-DESSUS de l'overlay de l'éditeur
  // (.qcm-overlay, z-index 1000). Sans cette classe le formulaire s'ouvrait derrière :
  // il paraissait « ouvrir la question du dessous » et tout clic atterrissait sur
  // l'overlay, qui fermait l'éditeur entier.
  const backdrop = el("div", { class: "modal-backdrop qcm-form-backdrop" });
  // Réassignée plus bas (retire aussi l'écouteur clavier) ; ce défaut sert si save()
  // aboutit avant l'installation du gestionnaire de fermeture.
  let closeForm = () => backdrop.remove();

  const sectionInput = el("input", { type: "text", placeholder: "Section (optionnel)", value: question?.section || "" });
  const enonceInput = el("textarea", { rows: 3, placeholder: "Énoncé de la question" }, question?.enonce || "");
  const explicInput = el("textarea", { rows: 2, placeholder: "Explication affichée après réponse (optionnel)" }, question?.explication || "");

  // Image : aperçu + bouton retirer, ou rien.
  const imgPreview = el("div", { class: "qcm-form-img" });
  function renderImg() {
    clear(imgPreview);
    if (!pendingImageUrl) return;
    imgPreview.appendChild(el("img", { class: "qcm-editor-thumb", src: pendingImageUrl, alt: "" }));
    imgPreview.appendChild(el("button", { class: "btn ghost small", type: "button",
      onClick: () => { pendingImageUrl = null; renderImg(); } }, "Retirer l'image"));
  }
  renderImg();

  const fileInput = el("input", { type: "file", accept: "image/*" });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      pendingImageUrl = await uploadQcmImage(file, qcmId, question?.id);
      renderImg();
      toast("Image ajoutée.", "success");
    } catch (e) {
      toast("Upload impossible : " + (e?.message || e), "error");
    } finally {
      fileInput.value = "";
    }
  });

  // Options : lignes dynamiques (texte + case « bonne réponse » + retirer).
  const optsWrap = el("div", { class: "qcm-form-opts" });
  function addOptionRow(opt) {
    const cb = el("input", { type: "checkbox" });
    if (opt?.is_correct) cb.checked = true;
    const txt = el("input", { type: "text", class: "qcm-form-opt-text", placeholder: "Texte de la réponse", value: opt?.texte || "" });
    const del = el("button", { class: "btn ghost small icon-only", type: "button", "aria-label": "Retirer la réponse" });
    del.appendChild(icon.trash());
    // Monter / descendre : l'ordre enregistré est celui du DOM (voir save()),
    // il suffit donc de déplacer la ligne. Sans effet pour l'élève, qui voit
    // les réponses mélangées, mais indispensable pour relire une question.
    const up = el("button", { class: "btn ghost small icon-only", type: "button", title: "Monter cette réponse", "aria-label": "Monter cette réponse" }, "↑");
    const down = el("button", { class: "btn ghost small icon-only", type: "button", title: "Descendre cette réponse", "aria-label": "Descendre cette réponse" }, "↓");
    const row = el("div", { class: "qcm-form-opt" },
      el("label", { class: "qcm-form-opt-check", title: "Bonne réponse" }, cb),
      txt, up, down, del,
    );
    up.addEventListener("click", () => {
      const prev = row.previousElementSibling;
      if (prev) optsWrap.insertBefore(row, prev);
    });
    down.addEventListener("click", () => {
      const next = row.nextElementSibling;
      if (next) optsWrap.insertBefore(next, row);
    });
    del.addEventListener("click", () => row.remove());
    optsWrap.appendChild(row);
  }
  const initialOpts = (question?.options && question.options.length) ? question.options : [null, null];
  initialOpts.forEach((o) => addOptionRow(o));

  async function save() {
    const enonce = enonceInput.value.trim();
    if (!enonce) { toast("L'énoncé est requis.", "error"); return; }
    const options = [...optsWrap.querySelectorAll(".qcm-form-opt")].map((row) => ({
      texte: row.querySelector("input[type=text]").value.trim(),
      is_correct: row.querySelector("input[type=checkbox]").checked,
    })).filter((o) => o.texte !== "");
    if (options.length < 2) { toast("Ajoute au moins deux réponses.", "error"); return; }
    if (!options.some((o) => o.is_correct)) { toast("Coche au moins une bonne réponse.", "error"); return; }

    const q = {
      id: question?.id,
      section: sectionInput.value.trim() || null,
      enonce,
      explication: explicInput.value.trim() || null,
      image_url: pendingImageUrl,
      ordre: question?.ordre ?? nextOrdre,
      options,
    };
    try {
      await saveQcmQuestion(qcmId, q);
      const moved = await applyPosition();
      closeForm();
      toast(moved ? "Question enregistrée et déplacée." : "Question enregistrée.", "success");
      onSaved();
    } catch (e) {
      toast("Enregistrement impossible : " + (e?.message || e), "error");
    }
  }

  // Applique la position saisie : on retire la question de la liste et on la réinsère
  // au rang demandé, puis on renormalise tous les ordres (comme les boutons ↑/↓).
  // Renvoie true si un déplacement a eu lieu.
  async function applyPosition() {
    if (!isEdit || posFrom < 0) return false;
    const wanted = parseInt(posInput.value, 10);
    if (!Number.isFinite(wanted)) return false;
    const to = Math.min(Math.max(wanted - 1, 0), siblings.length - 1);
    if (to === posFrom) return false;
    const arr = siblings.slice();
    const [row] = arr.splice(posFrom, 1);
    arr.splice(to, 0, row);
    await reorderQcmQuestions(arr.map((s, k) => ({ id: s.id, ordre: k })));
    return true;
  }

  const modal = el("div", { class: "modal qcm-form-modal" },
    el("h3", {}, isEdit ? "Modifier la question" : "Nouvelle question"),
    el("div", { class: "qcm-form-body" },
      isEdit && siblings.length > 1
        ? el("div", { class: "field qcm-form-pos" },
            el("label", {}, "Position"),
            posInput,
            el("p", { class: "muted" },
              `1 = première question, ${siblings.length} = dernière. Change le numéro pour déplacer la question.`),
          )
        : null,
      el("div", { class: "field" }, el("label", {}, "Section"), sectionInput),
      el("div", { class: "field" }, el("label", {}, "Énoncé"), enonceInput),
      el("div", { class: "field" }, el("label", {}, "Explication"), explicInput),
      el("div", { class: "field" },
        el("label", {}, "Image"),
        imgPreview,
        fileInput,
      ),
      el("div", { class: "field" },
        el("label", {}, "Réponses"),
        el("p", { class: "muted", style: "font-size:0.78rem;margin:0 0 0.4rem" },
          "Coche chaque bonne réponse. Une ou plusieurs bonnes réponses possibles."),
        optsWrap,
        el("button", { class: "btn ghost small", type: "button", onClick: () => addOptionRow() }, icon.plus(), "Ajouter une réponse"),
      ),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: () => requestCancel() }, "Annuler"),
      el("button", { class: "btn primary", type: "button", onClick: save }, icon.check(), "Enregistrer"),
    ),
  );
  backdrop.appendChild(modal);

  // Saisie en cours : on ne perd JAMAIS le travail sur un clic à côté.
  // Le clic sur le fond est ignoré ; Annuler et Échap demandent confirmation si le
  // formulaire a été modifié (sinon ferment directement).
  let touched = false;
  modal.addEventListener("input", () => { touched = true; });
  modal.addEventListener("change", () => { touched = true; });

  function close() {
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
  }
  function requestCancel() {
    if (touched && !window.confirm("Abandonner les modifications de cette question ?")) return;
    close();
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); requestCancel(); }
  }
  document.addEventListener("keydown", onKey);
  closeForm = close;  // utilisé par save() pour fermer proprement

  document.body.appendChild(backdrop);
  setTimeout(() => enonceInput.focus(), 80);
}
let filterStatut = "";
let filterType = "";
let filterCategorie = "";
let search = "";

const STATUTS = [
  { value: "À faire", color: "todo" },
  { value: "Fait",    color: "done" },
];

function normalizeStatut(s) {
  // Migration douce : "En cours" historique → traité comme "À faire"
  if (s === "Fait") return "Fait";
  return "À faire";
}

function toggleStatut(current) {
  return normalizeStatut(current) === "Fait" ? "À faire" : "Fait";
}

async function cycleStatut(theme, container, chipEl) {
  const newStatut = toggleStatut(theme.statut);
  const prevStatut = theme.statut;
  const prevDate = theme.date_fait;
  const patch = {
    statut: newStatut,
    updated_by_email: getAdminEmail(),
    date_fait: newStatut === "Fait" ? isoDate(new Date()) : null,
  };
  try {
    await updateTheme(theme.id, patch);
    Object.assign(theme, patch);
    // Update in-place sans rerender complet (évite le scroll jump)
    updateThemeRowInPlace(theme, chipEl);
    refreshStatsInPlace(container);
    recordUndo("statut thème", async () => {
      await updateTheme(theme.id, { statut: prevStatut, date_fait: prevDate });
      theme.statut = prevStatut;
      theme.date_fait = prevDate;
    });
  } catch (e) {
    toast(e.message, "error");
  }
}

function updateThemeRowInPlace(theme, chipEl) {
  const row = chipEl?.closest(".theme-row");
  if (!row) return;
  const newColor = normalizeStatut(theme.statut) === "Fait" ? "done" : "todo";
  row.classList.remove("todo", "done", "doing");
  row.classList.add(newColor);
  chipEl.classList.remove("todo", "done", "doing");
  chipEl.classList.add(newColor);
  // Update text inside chip
  const dot = chipEl.querySelector(".theme-statut-dot");
  clear(chipEl);
  if (dot) chipEl.appendChild(dot);
  else chipEl.appendChild(el("span", { class: "theme-statut-dot" }));
  chipEl.appendChild(document.createTextNode(theme.statut));
  // Update date column (4th child : .theme-date)
  const dateEl = row.querySelector(".theme-date");
  if (dateEl) {
    clear(dateEl);
    if (theme.date_fait) {
      dateEl.classList.remove("muted");
      dateEl.appendChild(document.createTextNode(formatDate(theme.date_fait)));
    } else {
      dateEl.classList.add("muted");
      dateEl.appendChild(document.createTextNode("-"));
    }
  }
}

function openDateEditor(theme, anchorEl, container) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const dateInput = el("input", {
    type: "date",
    value: theme.date_fait || isoDate(new Date()),
    style: "width:100%",
  });

  async function save(newDate) {
    const prevDate = theme.date_fait;
    const prevStatut = theme.statut;
    try {
      await updateTheme(theme.id, {
        date_fait: newDate || null,
        statut: newDate ? "Fait" : theme.statut,
        updated_by_email: getAdminEmail(),
      });
      theme.date_fait = newDate || null;
      if (newDate) theme.statut = "Fait";
      recordUndo("date thème", async () => {
        await updateTheme(theme.id, { date_fait: prevDate, statut: prevStatut });
        theme.date_fait = prevDate;
        theme.statut = prevStatut;
      });
      // Mise à jour locale : le label affiche la nouvelle date sans tout rerender
      anchorEl.textContent = newDate ? formatDate(newDate) : "+ date";
      anchorEl.classList.toggle("muted", !newDate);
      // Si on a posé une date, statut devient Fait → couleur ligne / chip
      if (newDate) {
        const row = anchorEl.closest(".theme-row");
        if (row) {
          row.classList.remove("todo", "doing");
          row.classList.add("done");
          const chip = row.querySelector(".theme-statut");
          if (chip) {
            chip.classList.remove("todo", "doing");
            chip.classList.add("done");
            const dot = chip.querySelector(".theme-statut-dot");
            chip.textContent = "";
            if (dot) chip.appendChild(dot);
            else chip.appendChild(el("span", { class: "theme-statut-dot" }));
            chip.appendChild(document.createTextNode("Fait"));
          }
        }
      }
      refreshStatsInPlace(container);
      backdrop.remove();
      toast("Date mise à jour", "success", 1500);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  const modal = el("div", { class: "modal", style: "max-width:360px" },
    el("h3", {}, "Date du thème"),
    el("p", { class: "muted", style: "margin:0 0 0.8rem;font-size:0.85rem" },
      "Quand le thème a-t-il été traité ? Définir une date force le statut à « Fait »."),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Date"), dateInput),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler"),
      theme.date_fait ? el("button", { class: "btn danger", onClick: () => save(null) }, "Effacer") : null,
      el("button", { class: "btn primary", onClick: () => save(dateInput.value) }, icon.check(), "Enregistrer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  setTimeout(() => dateInput.focus(), 80);
}

function openThemeModal(theme) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const num = theme.numero ? String(theme.numero).padStart(2, "0") : null;
  const modal = el("div", { class: "modal theme-modal" },
    el("div", { class: "theme-modal-head" },
      num ? el("span", { class: "theme-modal-num" }, num) : null,
      el("h3", { class: "theme-modal-titre" }, theme.titre),
    ),
    theme.categorie ? el("p", { class: "muted theme-modal-cat" }, theme.categorie) : null,
    el("div", { class: "theme-modal-placeholder" },
      el("p", {}, "Contenu pédagogique à venir : cours, exercices, supports."),
      el("p", { class: "muted", style: "font-size:0.82rem" },
        "Le QCM (entraînement et examen) est accessible depuis la colonne QCM de la liste."),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn primary", onClick: () => backdrop.remove() }, "Fermer"),
    ),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function debouncedNoteSave(theme) {
  const key = "theme-note-" + theme.id;
  if (!window.__debSavers) window.__debSavers = {};
  if (!window.__debSavers[key]) {
    window.__debSavers[key] = debounce(async (val) => {
      try {
        await updateTheme(theme.id, { notes: val, updated_by_email: getAdminEmail() });
        theme.notes = val;
      } catch (e) { toast(e.message, "error"); }
    }, 600);
  }
  return window.__debSavers[key];
}

function renderThemeRow(theme, container) {
  const admin = isAdmin();
  const num = theme.numero ? String(theme.numero).padStart(2, "0") : "-";
  const statutNorm = normalizeStatut(theme.statut);
  const color = statutNorm === "Fait" ? "done" : "todo";

  // Statut chip cliquable (admin only), toggle binaire
  const statutChip = el(admin ? "button" : "span", {
    class: "theme-statut " + color + (admin ? " clickable" : ""),
    type: admin ? "button" : undefined,
    title: admin ? "Cliquer pour basculer fait / à faire" : ""
  },
    el("span", { class: "theme-statut-dot" }),
    statutNorm
  );
  if (admin) statutChip.addEventListener("click", (ev) => {
    ev.preventDefault();
    cycleStatut(theme, container, statutChip);
  });

  // Notes (toujours visible, mais readonly si pas admin)
  const notesInput = el("input", {
    type: "text",
    class: "theme-notes",
    placeholder: admin ? "Notes pédagogiques…" : "",
    value: theme.notes || "",
    readonly: !admin || undefined,
  });
  if (admin) {
    notesInput.addEventListener("input", () => debouncedNoteSave(theme)(notesInput.value));
  }

  // Date, éditable si admin
  let dateLabel;
  if (admin) {
    dateLabel = el("button", {
      class: "theme-date editable" + (theme.date_fait ? "" : " muted"),
      type: "button",
      title: "Modifier la date",
      onClick: (ev) => {
        ev.preventDefault();
        openDateEditor(theme, dateLabel, container);
      },
    }, theme.date_fait ? formatDate(theme.date_fait) : "+ date");
  } else {
    dateLabel = theme.date_fait
      ? el("span", { class: "theme-date" }, formatDate(theme.date_fait))
      : el("span", { class: "theme-date muted" }, "-");
  }

  // Delete (admin notion seulement, jamais sur thèmes officiels)
  let delBtn = null;
  if (admin && theme.type === "notion") {
    delBtn = el("button", {
      class: "btn small danger icon-only", "aria-label": "Supprimer la notion",
      onClick: async () => {
        if (!confirm(`Supprimer la notion « ${theme.titre} » ?`)) return;
        await deleteTheme(theme.id);
        themes = themes.filter((t) => t.id !== theme.id);
        rerender(container);
      }
    });
    delBtn.appendChild(icon.trash());
  }

  const titreBtn = el("button", {
    class: "theme-titre-link", type: "button",
    title: "Voir le contenu du thème",
    onClick: () => openThemeModal(theme),
  }, theme.titre);

  // Colonne QCM : cellule dédiée à droite, jamais sous le titre. Un stagiaire n'y
  // voit un bouton que si le thème a un QCM publié ; « Créer QCM » reste au formateur.
  const qcm = qcmByTheme.get(theme.id);
  const qcmCell = canSeeQcm()
    ? el("div", { class: "theme-qcm-cell" },
        qcm ? qcmCellEl(theme, qcm) : (canManageExam() ? createQcmCellEl(theme) : null))
    : null;

  return el("div", { class: "theme-row " + color, dataset: { id: theme.id } },
    el("span", { class: "theme-num" }, num),
    el("div", { class: "theme-titre-block" },
      titreBtn,
      theme.categorie ? el("span", { class: "theme-cat" }, theme.categorie) : null,
    ),
    statutChip,
    dateLabel,
    notesInput,
    qcmCell,
    delBtn || el("span"),
  );
}

function uniqueCategories(list) {
  return [...new Set(list.map((t) => t.categorie).filter(Boolean))];
}

function matchesFilters(t) {
  if (filterStatut    && normalizeStatut(t.statut) !== filterStatut) return false;
  if (filterType      && t.type      !== filterType)      return false;
  if (filterCategorie && t.categorie !== filterCategorie) return false;
  if (search) {
    const q = search.toLowerCase();
    const inTitle = t.titre.toLowerCase().includes(q);
    const inNum = t.numero != null && String(t.numero).includes(q);
    const inCat = (t.categorie || "").toLowerCase().includes(q);
    if (!inTitle && !inNum && !inCat) return false;
  }
  return true;
}

function openAddNotionModal(onSaved) {
  const backdrop = el("div", { class: "modal-backdrop" });

  const titreInput = el("input", { type: "text", placeholder: "Ex. Matrice GDE" });
  const catInput = el("input", { type: "text", placeholder: "Catégorie (optionnel)", value: "Notion pédagogique" });

  async function save() {
    if (!titreInput.value.trim()) { toast("Le titre est requis", "error"); return; }
    try {
      await addTheme({
        titre: titreInput.value.trim(),
        categorie: catInput.value.trim() || null,
        type: "notion",
        ordre: 999,
        updated_by_email: getAdminEmail(),
      });
      toast("Notion ajoutée", "success");
      backdrop.remove();
      onSaved();
    } catch (e) { toast(e.message, "error"); }
  }

  const modal = el("div", { class: "modal" },
    el("h3", {}, "Ajouter une notion pédagogique"),
    el("div", { class: "modal-form" },
      el("div", { class: "field" }, el("label", {}, "Titre"), titreInput),
      el("div", { class: "field" }, el("label", {}, "Catégorie"), catInput),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Annuler"),
      el("button", { class: "btn primary", onClick: save }, icon.check(), "Enregistrer"),
    )
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

// Méta de présentation par "famille" (groupe top-level dans la nav)
// L'ordre ici détermine l'ordre d'affichage.
const FAMILLES_BASE = [
  {
    key: "themes-officiels",
    label: "Thèmes officiels",
    short: "Thèmes",
    match: (t) => t.type === "theme",
  },
  {
    key: "qcm-transversaux",
    label: "QCM transversaux",
    short: "Transversaux",
    match: (t) => t.type === "notion" && t.categorie === "QCM transversal",
  },
  {
    key: "competences-formateur",
    label: "Compétences formateur (TP ECSR)",
    short: "TP ECSR",
    match: (t) => t.type === "notion" && t.categorie === "Compétence formateur (TP ECSR)",
  },
  {
    key: "competences-conduite",
    label: "Compétences conduite (REMC)",
    short: "REMC",
    match: (t) => t.type === "notion" && t.categorie === "Compétence conduite (REMC)",
  },
  {
    key: "notions-pedagogiques",
    label: "Notions pédagogiques",
    short: "Notions",
    match: (t) => t.type === "notion" && t.categorie === "Notion pédagogique",
  },
];

// Famille filet de sécurité : le rendu ne parcourt que FAMILLES, donc une entrée
// qui ne correspond à aucune famille n'était affichée NULLE PART, seulement
// comptée dans « Tout ». C'est ce qui a rendu les 3 QCM transversaux invisibles.
// Cette famille attrape toute catégorie future non prévue ici.
const FAMILLES = [
  ...FAMILLES_BASE,
  {
    key: "autres",
    label: "Autres",
    short: "Autres",
    match: (t) => !FAMILLES_BASE.some((f) => f.match(t)),
  },
];

let activeFamille = "all";  // "all" ou clé de famille

function familleStats(items) {
  const total = items.length;
  const fait = items.filter((t) => normalizeStatut(t.statut) === "Fait").length;
  return { total, fait, aFaire: total - fait, pct: total ? Math.round(fait / total * 100) : 0 };
}

// Items visibles d'une famille selon les filtres courants (même logique que rerender).
function visibleFamilleItems(f) {
  return themes.filter(f.match).filter((t) => {
    if (filterStatut && normalizeStatut(t.statut) !== filterStatut) return false;
    if (search) {
      const q = search.toLowerCase();
      const inTitle = t.titre.toLowerCase().includes(q);
      const inNum = t.numero != null && String(t.numero).includes(q);
      const inCat = (t.categorie || "").toLowerCase().includes(q);
      if (!inTitle && !inNum && !inCat) return false;
    }
    return true;
  });
}

// Recalcule en place les stats des sections (Faits / À faire / barre + %) et
// l'eyebrow global, sans rerender complet (préserve scroll + inputs ouverts).
// Corrige le décalage : la ligne se mettait à jour mais pas l'en-tête de section.
function refreshStatsInPlace(container) {
  FAMILLES.forEach((f) => {
    const section = container.querySelector(".theme-section-" + f.key);
    if (!section) return;
    const stats = familleStats(visibleFamilleItems(f));
    const vals = section.querySelectorAll(".theme-section-stat-value");
    if (vals[0]) vals[0].textContent = String(stats.fait);
    if (vals[1]) vals[1].textContent = String(stats.aFaire);
    const fill = section.querySelector(".theme-progress-fill");
    if (fill) fill.style.width = stats.pct + "%";
    const label = section.querySelector(".theme-progress-label");
    if (label) label.textContent = stats.pct + "%";
  });
  const tp = familleStats(themes.filter((t) => t.type === "theme"));
  const eyebrow = container.querySelector(".view-header .eyebrow");
  if (eyebrow) eyebrow.textContent = tp.fait + " / " + tp.total + " thèmes officiels terminés";
}

function rerender(container) {
  // Repeint tardif alors que l'utilisateur est passé sur la console : ne rien écrire,
  // le panneau ne nous appartient plus. Revenir sur l'onglet Thèmes le re-rend de toute façon.
  if (!themesActif()) return;
  clear(container);

  const admin = isAdmin();

  // Toutes les familles avec leur contenu (avant search)
  const famillesData = FAMILLES.map((f) => {
    const items = themes.filter(f.match);
    return { ...f, items, stats: familleStats(items) };
  }).filter((f) => f.items.length > 0);

  // Stats globales (uniquement thèmes officiels)
  const themesOfficiels = themes.filter((t) => t.type === "theme");
  const totalProgress = familleStats(themesOfficiels);

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, totalProgress.fait + " / " + totalProgress.total + " thèmes officiels terminés"),
      el("h2", {}, "Thèmes & progression"),
      el("p", { class: "subtitle" }, "Référentiel officiel ECF (57 thèmes) + compétences TP ECSR (formateur) + compétences REMC (conduite) + notions pédagogiques."),
    ),
    admin ? el("button", { class: "btn primary", onClick: () => openAddNotionModal(() => reload(container)) },
      icon.plus(), "Ajouter une notion"
    ) : null,
  ));

  // Navigation par pills (par famille)
  const pillsWrap = el("div", { class: "theme-pills" });
  const pillAll = el("button", {
    class: "theme-pill" + (activeFamille === "all" ? " active" : ""),
    onClick: () => { activeFamille = "all"; rerender(container); }
  }, "Tout", el("span", { class: "theme-pill-count" }, themes.length));
  pillsWrap.appendChild(pillAll);

  famillesData.forEach((f) => {
    const pill = el("button", {
      class: "theme-pill theme-pill-" + f.key + (activeFamille === f.key ? " active" : ""),
      onClick: () => { activeFamille = f.key; rerender(container); }
    },
      f.short,
      el("span", { class: "theme-pill-count" }, f.items.length),
    );
    pillsWrap.appendChild(pill);
  });
  container.appendChild(pillsWrap);

  // Filtres supplémentaires (recherche + statut + catégorie fine)
  const searchInput = el("input", { type: "search", placeholder: "Rechercher…", value: search });
  searchInput.addEventListener("input", debounce(() => { search = searchInput.value; rerender(container); }, 200));

  const statutSel = el("select");
  statutSel.appendChild(el("option", { value: "" }, "Tous les statuts"));
  STATUTS.forEach((s) => {
    const opt = el("option", { value: s.value }, s.value);
    if (filterStatut === s.value) opt.selected = true;
    statutSel.appendChild(opt);
  });
  statutSel.addEventListener("change", () => { filterStatut = statutSel.value; rerender(container); });

  container.appendChild(el("div", { class: "passages-toolbar" },
    el("div", { class: "passages-filters" }, searchInput, statutSel),
  ));

  // Détermine les familles à afficher (active ou toutes)
  const famillesToShow = activeFamille === "all"
    ? famillesData
    : famillesData.filter((f) => f.key === activeFamille);

  // Rendu de chaque famille comme section autonome
  famillesToShow.forEach((f) => {
    // Filtre interne par search + statut
    const items = f.items.filter((t) => {
      if (filterStatut && normalizeStatut(t.statut) !== filterStatut) return false;
      if (search) {
        const q = search.toLowerCase();
        const inTitle = t.titre.toLowerCase().includes(q);
        const inNum = t.numero != null && String(t.numero).includes(q);
        const inCat = (t.categorie || "").toLowerCase().includes(q);
        if (!inTitle && !inNum && !inCat) return false;
      }
      return true;
    });

    if (items.length === 0) return;

    const stats = familleStats(items);

    const section = el("section", { class: "theme-section theme-section-" + f.key });

    // Header de section
    section.appendChild(el("div", { class: "theme-section-head" },
      el("div", { class: "theme-section-title-wrap" },
        el("h3", { class: "theme-section-title" }, f.label),
        el("p", { class: "muted theme-section-subtitle" }, items.length + " entrée" + (items.length > 1 ? "s" : "")),
      ),
      el("div", { class: "theme-section-stats" },
        el("div", { class: "theme-section-stat" },
          el("span", { class: "theme-section-stat-value" }, String(stats.fait)),
          el("span", { class: "theme-section-stat-label" }, "Faits"),
        ),
        el("div", { class: "theme-section-stat" },
          el("span", { class: "theme-section-stat-value" }, String(stats.aFaire)),
          el("span", { class: "theme-section-stat-label" }, "À faire"),
        ),
      ),
    ));

    // Barre de progression
    if (stats.total > 0) {
      const bar = el("div", { class: "theme-progress" },
        el("div", { class: "theme-progress-fill", style: `width: ${stats.pct}%` }),
      );
      section.appendChild(el("div", { class: "theme-progress-wrap" },
        bar,
        el("span", { class: "theme-progress-label" }, stats.pct + "%"),
      ));
    }

    // Liste des thèmes/notions, sous-groupée par catégorie si c'est une famille avec sous-cats (thèmes officiels)
    const list = el("div", { class: "themes-list" + (canSeeQcm() ? " qcm-on" : "") });
    list.appendChild(el("div", { class: "theme-row theme-header" },
      el("span", { class: "theme-num" }, "N°"),
      el("span", {}, "Thème"),
      el("span", {}, "Statut"),
      el("span", {}, "Fait le"),
      el("span", {}, "Notes"),
      canSeeQcm() ? el("span", {}, "QCM") : null,
      el("span", {}),
    ));

    // Sous-groupage par catégorie uniquement pour les thèmes officiels (qui ont 11 sous-catégories)
    const needsSubGroup = f.key === "themes-officiels";
    if (needsSubGroup) {
      const grouped = {};
      items.forEach((t) => {
        const key = t.categorie || "Sans catégorie";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(t);
      });
      Object.entries(grouped).forEach(([cat, gItems]) => {
        list.appendChild(el("div", { class: "theme-group-head" }, cat, el("span", { class: "muted" }, " · " + gItems.length)));
        gItems.forEach((t) => list.appendChild(renderThemeRow(t, container)));
      });
    } else {
      items.forEach((t) => list.appendChild(renderThemeRow(t, container)));
    }
    section.appendChild(list);

    container.appendChild(section);
  });

  // Aucun résultat
  const anyShown = famillesToShow.some((f) => f.items.length > 0);
  if (!anyShown) {
    container.appendChild(el("p", { class: "muted", style: "padding:2rem 0;text-align:center" }, "Aucun thème ne correspond aux filtres."));
  }
}

async function reload(container) {
  themes = await listThemes();
  await loadQcmIndex();
  rerender(container);
}

export async function renderThemes(container) {
  clear(container);
  // Un montage précédent a pu laisser ces deux références derrière lui : le panneau
  // qu'elles désignent est mort, et le jeton d'activation qu'elles portent est figé sur
  // l'onglet d'alors. Les repartir de zéro à chaque montage évite qu'un rendu tardif
  // n'écrive dans un écran disparu, ou refuse d'écrire dans celui qui vient de naître.
  lastContainer = null;
  themesActif = () => true;
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  themes = await listThemes();
  await loadQcmIndex();
  clear(container);

  // Un élève ne voit ni la barre de sous-onglets, ni la console : la RLS ne suffit pas,
  // sa politique de lecture lui rend SES propres signalements.
  if (!canManageExam()) { lastContainer = container; rerender(container); return; }

  container.appendChild(renderSubTabs([
    { key: "themes", label: "Thèmes",
      // lastContainer devient le PANNEAU : c'est lui que reload() doit repeindre.
      render: (p, ctx) => { lastContainer = p; themesActif = ctx?.isActive || (() => true); rerender(p); } },
    { key: "signalements", label: "⚑ Signalements",
      render: (p, ctx) => { renderConsoleSignalements(p, { themes, onOuvrirEditeur: ouvrirDepuisConsole, isActive: ctx?.isActive }); } },
  ], { storageKey: "themes.subtab" }));
}

// La console ne connaît pas l'éditeur : elle rend la main ici avec le signalement,
// et c'est Thèmes qui retrouve le thème et ouvre l'éditeur sur la bonne question.
function ouvrirDepuisConsole(s, rechargerConsole) {
  const qcm = s.question?.qcm;
  const theme = themes.find((t) => t.id === qcm?.theme_id);
  if (!theme || !qcm) { toast("Thème introuvable pour ce QCM.", "error"); return; }
  // Au retour de l'éditeur, la console doit refléter ce qui vient d'être fait, et les
  // badges ⚑ de la liste des thèmes avec elle, sinon ils annoncent un compte périmé.
  openQcmEditor(theme, qcm.id, s.question_id, async () => {
    await loadQcmIndex();
    if (rechargerConsole) await rechargerConsole();
  });
}
