/*
 * QCM — player plein écran.
 * Lot 1 : mode "entraînement" (libre, correction immédiate, non comptée).
 * L'examen (tirage N, une passe, note) viendra en Lot 2.
 */
import { el, clear, toast } from "../utils.js?v=20260713e";
import { icon } from "../icons.js?v=20260713e";
import { getQcmFull, insertQcmAttempt, getMyProfile } from "../db.js?v=20260713e";

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
      }
    } catch (e) {
      console.warn("QCM : tentative non enregistrée:", e?.message || e);
    }
  }

  renderQuestion();
}
