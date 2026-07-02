/*
 * QCM — player plein écran.
 * Lot 1 : mode "entraînement" (libre, correction immédiate, non comptée).
 * L'examen (tirage N, une passe, note) viendra en Lot 2.
 */
import { el, clear, toast, formatDate } from "../utils.js?v=20260702a";
import { icon } from "../icons.js?v=20260702a";
import { getQcmFull, insertQcmAttempt, getMyProfile, getMyExamAttempt } from "../db.js?v=20260702a";

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function letter(i) {
  return String.fromCharCode(65 + i); // A, B, C, D, E
}

// Point d'entrée : ouvre l'entraînement d'un QCM pour un thème donné.
export async function openQcmEntrainement(theme, qcmMeta) {
  let full;
  try {
    full = await getQcmFull(qcmMeta.id);
  } catch (e) {
    toast("Impossible de charger le QCM : " + (e?.message || e), "error");
    return;
  }
  const questions = (full.questions || []).filter((q) => (q.options || []).length > 0);
  if (questions.length === 0) {
    toast("Ce QCM n'a pas encore de questions.", "error");
    return;
  }
  runEntrainement(theme, full, shuffle(questions));
}

function runEntrainement(theme, full, questions) {
  const startedAt = new Date().toISOString();
  const total = questions.length;
  let idx = 0;
  let score = 0;
  const answers = {}; // question_id -> option_id choisi

  const overlay = el("div", { class: "qcm-overlay" });
  const player = el("div", { class: "qcm-player" });
  overlay.appendChild(player);
  document.body.appendChild(overlay);
  document.body.classList.add("qcm-open");

  function close() {
    overlay.remove();
    document.body.classList.remove("qcm-open");
  }
  // Fermeture au clic sur le fond (hors du player)
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  const numPrefix = theme.numero ? String(theme.numero).padStart(2, "0") + " · " : "";
  const headTitle = numPrefix + theme.titre;

  function header(sub) {
    return el("div", { class: "qcm-head" },
      el("div", { class: "qcm-head-text" },
        el("span", { class: "qcm-badge" }, "Entraînement"),
        el("p", { class: "qcm-head-title" }, headTitle),
        sub ? el("p", { class: "qcm-head-sub" }, sub) : null,
      ),
      el("button", { class: "qcm-close", type: "button", "aria-label": "Fermer", onClick: close }, icon.close()),
    );
  }

  function renderQuestion() {
    clear(player);
    const q = questions[idx];
    player.appendChild(header(q.section || null));

    const pct = Math.round((idx / total) * 100);
    player.appendChild(el("div", { class: "qcm-progress-wrap" },
      el("div", { class: "qcm-progress-info" },
        el("span", {}, `Question ${idx + 1} / ${total}`),
        el("span", {}, `Score : ${score}`),
      ),
      el("div", { class: "qcm-progress" }, el("div", { class: "qcm-progress-fill", style: `width:${pct}%` })),
    ));

    const card = el("div", { class: "qcm-card" });
    card.appendChild(el("p", { class: "qcm-question" }, q.enonce));
    if (q.image_url) {
      card.appendChild(el("img", { class: "qcm-question-img", src: q.image_url, alt: "Illustration de la question", loading: "lazy" }));
    }

    const choices = el("div", { class: "qcm-choices" });
    let answered = false;

    const nextBtn = el("button", { class: "btn primary qcm-next", type: "button", style: "display:none" },
      idx + 1 < total ? "Question suivante" : "Voir le résultat");
    nextBtn.addEventListener("click", () => {
      if (idx + 1 < total) { idx++; renderQuestion(); }
      else renderResults();
    });

    q.options.forEach((opt, i) => {
      const choice = el("button", { class: "qcm-choice", type: "button" },
        el("span", { class: "qcm-choice-letter" }, letter(i)),
        el("span", { class: "qcm-choice-text" }, opt.texte),
      );
      choice.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        answers[q.id] = opt.id;
        if (opt.is_correct) score++;
        choices.querySelectorAll(".qcm-choice").forEach((c, ci) => {
          c.classList.add("disabled");
          if (q.options[ci].is_correct) c.classList.add("correct");
        });
        if (!opt.is_correct) choice.classList.add("wrong");
        if (q.explication) {
          card.insertBefore(
            el("div", { class: "qcm-explain " + (opt.is_correct ? "ok" : "ko") }, q.explication),
            nextBtn
          );
        }
        nextBtn.style.display = "";
        nextBtn.focus();
      });
      choices.appendChild(choice);
    });

    card.appendChild(choices);
    card.appendChild(nextBtn);
    player.appendChild(card);
    overlay.scrollTop = 0;
  }

  async function renderResults() {
    clear(player);
    const note20 = Math.round((score / total) * 20 * 10) / 10;
    const pct = Math.round((score / total) * 100);
    player.appendChild(header(null));

    player.appendChild(el("div", { class: "qcm-results" },
      el("div", { class: "qcm-score-circle" },
        el("span", { class: "qcm-score-big" }, `${score}/${total}`),
        el("small", {}, `${note20}/20`),
      ),
      el("p", { class: "qcm-results-sub" },
        pct >= 100 ? "Sans faute, bravo." : pct >= 60 ? "Bien, continue à réviser." : "À retravailler."),
    ));

    const recap = el("div", { class: "qcm-recap" });
    questions.forEach((q, i) => {
      const correctOpt = q.options.find((o) => o.is_correct);
      const ok = correctOpt && answers[q.id] === correctOpt.id;
      recap.appendChild(el("div", { class: "qcm-recap-item " + (ok ? "ok" : "ko") },
        el("span", { class: "qcm-recap-mark" }, ok ? "✓" : "✗"),
        el("div", { class: "qcm-recap-body" },
          el("p", { class: "qcm-recap-q" }, `${i + 1}. ${q.enonce}`),
          q.image_url ? el("img", { class: "qcm-recap-img", src: q.image_url, alt: "", loading: "lazy" }) : null,
          ok ? null : el("p", { class: "qcm-recap-a" }, "Bonne réponse : " + (correctOpt ? correctOpt.texte : "")),
        ),
      ));
    });
    player.appendChild(recap);

    player.appendChild(el("div", { class: "qcm-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: close }, "Fermer"),
      el("button", { class: "btn primary", type: "button", onClick: () => {
        idx = 0; score = 0;
        for (const k in answers) delete answers[k];
        renderQuestion();
      } }, "Recommencer"),
    ));

    // Enregistre la tentative d'entraînement si l'utilisateur est un stagiaire lié.
    // Non bloquant : l'entraînement reste utile même si l'écriture échoue.
    try {
      const profile = await getMyProfile();
      if (profile?.stagiaire_id) {
        await insertQcmAttempt({
          qcm_id: full.id,
          stagiaire_id: profile.stagiaire_id,
          mode: "entrainement",
          score,
          total,
          note_20: note20,
          answers,
          started_at: startedAt,
        });
        window.dispatchEvent(new CustomEvent("qcm-attempt-saved", { detail: { qcm_id: full.id, mode: "entrainement", note_20: note20 } }));
      }
    } catch (e) {
      console.warn("QCM : tentative non enregistrée:", e?.message || e);
    }
  }

  renderQuestion();
}

// === Examen (Lot 2) ===

function fmtTime(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

// Overlay plein écran dédié à l'examen. dismissible=false pendant la passe.
function examOverlay(dismissible = true) {
  const overlay = el("div", { class: "qcm-overlay" });
  const player = el("div", { class: "qcm-player qcm-exam" });
  overlay.appendChild(player);
  document.body.appendChild(overlay);
  document.body.classList.add("qcm-open");
  const close = () => { overlay.remove(); document.body.classList.remove("qcm-open"); };
  if (dismissible) overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  return { overlay, player, close };
}

function examHeader(theme, close, timerEl) {
  const numPrefix = theme.numero ? String(theme.numero).padStart(2, "0") + " · " : "";
  return el("div", { class: "qcm-head" },
    el("div", { class: "qcm-head-text" },
      el("span", { class: "qcm-badge exam" }, "Examen"),
      el("p", { class: "qcm-head-title" }, numPrefix + theme.titre),
    ),
    timerEl || null,
    el("button", { class: "qcm-close", type: "button", "aria-label": "Fermer", onClick: close }, icon.close()),
  );
}

// Point d'entrée : ouvre l'examen d'un thème (garde + pré-écran).
export async function openQcmExamen(theme, qcmMeta) {
  let full;
  try {
    full = await getQcmFull(qcmMeta.id);
  } catch (e) {
    toast("Impossible de charger l'examen : " + (e?.message || e), "error");
    return;
  }
  if (!full.published) {
    toast("L'examen de ce thème n'est pas encore publié.", "error");
    return;
  }

  // Résout le set gelé ; à défaut, toutes les questions avec options.
  const byId = new Map((full.questions || []).map((q) => [q.id, q]));
  const frozen = Array.isArray(full.exam_question_ids) ? full.exam_question_ids : [];
  let questions = frozen.length
    ? frozen.map((id) => byId.get(id)).filter(Boolean)
    : (full.questions || []);
  questions = questions.filter((q) => (q.options || []).length > 0);
  if (questions.length === 0) {
    toast("Cet examen n'a pas de questions exploitables.", "error");
    return;
  }

  let profile = null;
  try { profile = await getMyProfile(); } catch (e) { /* ignore */ }
  if (!profile?.stagiaire_id) {
    toast("Seul un stagiaire peut passer l'examen (compte non lié).", "error");
    return;
  }

  let existing = null;
  try { existing = await getMyExamAttempt(full.id); } catch (e) { /* ignore */ }
  if (existing) { showExamBlocked(theme, full, existing); return; }

  runExamPrescreen(theme, full, questions, profile);
}

// Écran « déjà passé » (blocage sauf réinitialisation formateur).
function showExamBlocked(theme, full, attempt) {
  const { player, close } = examOverlay();
  player.appendChild(examHeader(theme, close));
  player.appendChild(el("div", { class: "qcm-results" },
    el("div", { class: "qcm-score-circle" },
      el("span", { class: "qcm-score-big" }, `${attempt.note_20}/20`),
      el("small", {}, "sur 20"),
    ),
    el("p", { class: "qcm-results-sub" }, "Tu as déjà passé cet examen."),
    el("p", { class: "qcm-head-sub", style: "text-align:center" },
      "Passé le " + formatDate((attempt.finished_at || "").slice(0, 10))),
    el("p", { class: "qcm-results-sub", style: "font-size:0.82rem" },
      "Un formateur peut réinitialiser ta tentative si besoin."),
  ));
  player.appendChild(el("div", { class: "qcm-actions" },
    el("button", { class: "btn primary", type: "button", onClick: close }, "Fermer"),
  ));
}

// Pré-écran : rappel des règles avant de lancer le chrono.
function runExamPrescreen(theme, full, questions, profile) {
  const { player, close } = examOverlay();
  const total = questions.length;
  const secondsPer = full.exam_seconds_per_question || 30;
  const budget = secondsPer * total;
  player.appendChild(examHeader(theme, close));
  player.appendChild(el("div", { class: "qcm-prescreen" },
    el("p", { class: "qcm-prescreen-title" }, "Prêt pour l'examen ?"),
    el("ul", { class: "qcm-prescreen-list" },
      el("li", {}, `${total} questions`),
      el("li", {}, `Durée : ${fmtTime(budget)} (${secondsPer} s par question)`),
      el("li", {}, "Une seule passe. Aucune correction avant la fin."),
    ),
    el("p", { class: "qcm-results-sub", style: "font-size:0.82rem" },
      "Le minuteur démarre dès que tu cliques sur Commencer."),
  ));
  player.appendChild(el("div", { class: "qcm-actions" },
    el("button", { class: "btn ghost", type: "button", onClick: close }, "Annuler"),
    el("button", { class: "btn primary", type: "button", onClick: () => {
      close();
      runExam(theme, full, questions, profile);
    } }, "Commencer l'examen"),
  ));
}

// Moteur d'examen : navigation libre, chrono global, aucune correction, submit à la fin.
function runExam(theme, full, questions, profile) {
  const startedAt = new Date().toISOString();
  const total = questions.length;
  const secondsPer = full.exam_seconds_per_question || 30;
  let remaining = secondsPer * total;
  let submitted = false;
  const answers = {}; // question_id -> option_id choisi
  // Ordre des options mélangé une fois par question, stable pendant la passe.
  const optOrder = new Map(questions.map((q) => [q.id, shuffle(q.options || [])]));

  const { overlay, player, close: rawClose } = examOverlay(false);
  let idx = 0;
  let timerId = null;
  function cleanup() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function close() { cleanup(); rawClose(); }
  function requestClose() {
    if (!submitted && !window.confirm("Quitter l'examen ? Ta progression sera perdue et rien ne sera enregistré.")) return;
    close();
  }

  const timerEl = el("span", { class: "qcm-timer" }, fmtTime(remaining));
  timerId = setInterval(() => {
    remaining -= 1;
    timerEl.textContent = fmtTime(remaining);
    if (remaining <= secondsPer) timerEl.classList.add("low");
    if (remaining <= 0) finish(true);
  }, 1000);

  function renderQuestion() {
    clear(player);
    player.appendChild(examHeader(theme, requestClose, timerEl));

    const answeredCount = Object.keys(answers).length;
    player.appendChild(el("div", { class: "qcm-progress-wrap" },
      el("div", { class: "qcm-progress-info" },
        el("span", {}, `Question ${idx + 1} / ${total}`),
        el("span", {}, `${answeredCount} / ${total} répondues`),
      ),
      el("div", { class: "qcm-progress" },
        el("div", { class: "qcm-progress-fill", style: `width:${Math.round((answeredCount / total) * 100)}%` })),
    ));

    const q = questions[idx];
    const card = el("div", { class: "qcm-card" });
    if (q.section) card.appendChild(el("p", { class: "qcm-head-sub" }, q.section));
    card.appendChild(el("p", { class: "qcm-question" }, q.enonce));
    if (q.image_url) {
      card.appendChild(el("img", { class: "qcm-question-img", src: q.image_url, alt: "Illustration de la question", loading: "lazy" }));
    }

    const choices = el("div", { class: "qcm-choices" });
    (optOrder.get(q.id) || []).forEach((opt, i) => {
      const selected = answers[q.id] === opt.id;
      const choice = el("button", { class: "qcm-choice" + (selected ? " selected" : ""), type: "button" },
        el("span", { class: "qcm-choice-letter" }, letter(i)),
        el("span", { class: "qcm-choice-text" }, opt.texte),
      );
      choice.addEventListener("click", () => {
        answers[q.id] = opt.id; // pas de correction : on mémorise et on rafraîchit
        renderQuestion();
      });
      choices.appendChild(choice);
    });
    card.appendChild(choices);
    player.appendChild(card);

    const prev = el("button", { class: "btn ghost", type: "button",
      onClick: () => { if (idx > 0) { idx -= 1; renderQuestion(); } } }, "Précédent");
    prev.disabled = idx === 0;
    const next = el("button", { class: "btn ghost", type: "button",
      onClick: () => { if (idx + 1 < total) { idx += 1; renderQuestion(); } } }, "Suivant");
    next.disabled = idx + 1 >= total;
    player.appendChild(el("div", { class: "qcm-exam-nav" }, prev, next));

    const grid = el("div", { class: "qcm-exam-grid" });
    questions.forEach((qq, i) => {
      const dot = el("button", {
        class: "qcm-grid-dot" + (i === idx ? " current" : "") + (answers[qq.id] != null ? " done" : ""),
        type: "button", onClick: () => { idx = i; renderQuestion(); },
      }, String(i + 1));
      grid.appendChild(dot);
    });
    player.appendChild(grid);

    player.appendChild(el("div", { class: "qcm-actions" },
      el("button", { class: "btn primary", type: "button", onClick: confirmFinish }, "Terminer l'examen"),
    ));
    overlay.scrollTop = 0;
  }

  function confirmFinish() {
    const answeredCount = Object.keys(answers).length;
    const msg = answeredCount < total
      ? `Il te reste ${total - answeredCount} question(s) sans réponse. Terminer quand même ?`
      : "Terminer et enregistrer ta note ?";
    if (window.confirm(msg)) finish(false);
  }

  async function finish(timedOut) {
    if (submitted) return;
    submitted = true;
    cleanup();

    let score = 0;
    questions.forEach((q) => {
      const chosen = answers[q.id];
      const correct = (q.options || []).find((o) => o.is_correct);
      if (correct && chosen === correct.id) score += 1;
    });
    const note20 = Math.round((score / total) * 20 * 10) / 10;

    // Insert de la tentative examen ; le trigger écrit le miroir evaluations.
    let saveError = null;
    try {
      await insertQcmAttempt({
        qcm_id: full.id,
        stagiaire_id: profile.stagiaire_id,
        mode: "examen",
        score,
        total,
        note_20: note20,
        answers,
        started_at: startedAt,
      });
    } catch (e) {
      saveError = e?.message || String(e);
    }
    if (!saveError) window.dispatchEvent(new CustomEvent("qcm-attempt-saved", { detail: { qcm_id: full.id, mode: "examen", note_20: note20 } }));
    renderResults(score, note20, timedOut, saveError);
  }

  function renderResults(score, note20, timedOut, saveError) {
    clear(player);
    player.appendChild(examHeader(theme, close));
    player.appendChild(el("div", { class: "qcm-results" },
      el("div", { class: "qcm-score-circle" },
        el("span", { class: "qcm-score-big" }, `${score}/${total}`),
        el("small", {}, `${note20}/20`),
      ),
      el("p", { class: "qcm-results-sub" }, "Examen terminé."),
      timedOut ? el("p", { class: "qcm-head-sub", style: "text-align:center" },
        "Temps écoulé : l'examen a été remis automatiquement.") : null,
      saveError ? el("p", { class: "qcm-explain ko" }, "Note non enregistrée : " + saveError) : null,
    ));

    const recap = el("div", { class: "qcm-recap" });
    questions.forEach((q, i) => {
      const correctOpt = (q.options || []).find((o) => o.is_correct);
      const ok = correctOpt && answers[q.id] === correctOpt.id;
      recap.appendChild(el("div", { class: "qcm-recap-item " + (ok ? "ok" : "ko") },
        el("span", { class: "qcm-recap-mark" }, ok ? "✓" : "✗"),
        el("div", { class: "qcm-recap-body" },
          el("p", { class: "qcm-recap-q" }, `${i + 1}. ${q.enonce}`),
          q.image_url ? el("img", { class: "qcm-recap-img", src: q.image_url, alt: "", loading: "lazy" }) : null,
          ok ? null : el("p", { class: "qcm-recap-a" }, "Bonne réponse : " + (correctOpt ? correctOpt.texte : "")),
        ),
      ));
    });
    player.appendChild(recap);
    player.appendChild(el("div", { class: "qcm-actions" },
      el("button", { class: "btn primary", type: "button", onClick: close }, "Fermer"),
    ));
    overlay.scrollTop = 0;
  }

  renderQuestion();
}
