// Vue EPCF (chantier D, lot 2).
//  - Notes, sous-onglet EPCF : les moyennes de la classe, pour tout le monde
//    (agrégats k-anonymisés, RPC autorisée à tout connecté).
//  - Fiche d'une personne (Mon espace, page Stagiaires) : ses résultats salle et
//    véhicule ; chez un formateur, la saisie (Évaluer, Modifier, Nouvelle évaluation).
// L'écriture reste réservée par la base aux formateurs et aux admins.

import { listProfs, listEpcf, upsertEpcf, getEpcfMoyennes } from "../db.js?v=20261005c";
import { el, clear, isoDate, formatDate, displayStagiaire, toast } from "../utils.js?v=20261005c";
import { getProfile } from "../auth-admin.js?v=20261005c";
import { getCurrentWho } from "../identity.js?v=20261005c";
import { EPCF_TRAMES, NOTE_LABELS } from "../epcf-trames.js?v=20261005c";
import { renderEpcfTrameSection, renderEpcfClasse } from "../epcf-restitution.js?v=20261005c";
import { poserGardeSortie, leverGardeSortie } from "../navigation.js?v=20261005c";

const TRAME_KEYS = ["salle", "vehicule"];

// opts.embedded : rendu dans le sous-onglet EPCF de Notes (le parent a son en-tête).
export async function renderEpcf(container, opts = {}) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const [mSalle, mVehicule] = await Promise.all([getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule")]);
  if (opts.isActive && !opts.isActive()) return;
  clear(container);
  if (!opts.embedded) {
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" }, el("h2", {}, "EPCF"))));
  }
  const body = el("div", { class: "epcf-body" });
  container.appendChild(body);
  body.appendChild(el("h3", { class: "epcf-resti-title" }, "Moyennes de la classe"));
  renderEpcfClasse(body, { salle: mSalle, vehicule: mVehicule });
}

// Partie EPCF de la fiche d'une personne. opts.outils : boutons de saisie (formateur).
export function renderEpcfPersonne(container, opts) {
  const etat = { evals: opts.evals || [], moyennes: opts.moyennes };

  function dessiner() {
    clear(container);
    if (opts.outils) {
      const actions = el("div", { class: "epcf-fiche-actions" });
      TRAME_KEYS.forEach((k) => {
        // listEpcf trie par date décroissante : la première est la dernière évaluation.
        const derniere = etat.evals.find((e) => e.trame === k) || null;
        actions.appendChild(el("div", { class: "epcf-fiche-ligne" },
          el("span", { class: "epcf-fiche-epreuve" }, EPCF_TRAMES[k].label),
          el("span", { class: "epcf-statut" + (derniere ? " ok" : " muted") },
            derniere ? "évaluée le " + formatDate(derniere.date_eval) : "à évaluer"),
          derniere ? el("button", { class: "btn small ghost", type: "button",
            onClick: () => ouvrir(k, derniere) }, "Modifier") : null,
          el("button", { class: "btn small primary", type: "button", onClick: () => ouvrir(k, null) },
            derniere ? "Nouvelle évaluation" : "Évaluer"),
        ));
      });
      container.appendChild(actions);
    }
    TRAME_KEYS.forEach((k) => {
      container.appendChild(renderEpcfTrameSection(k, etat.evals.filter((e) => e.trame === k), etat.moyennes[k]));
    });
  }

  async function ouvrir(trameKey, existing) {
    let profs = [];
    try { profs = await listProfs(); } catch (e) { console.error(e); }
    if (opts.isActive && !opts.isActive()) return;
    showForm(container, opts.stagiaire, trameKey, existing, {
      profs,
      retour: dessiner,
      apresEnregistrement: async () => {
        try {
          const [ev, mS, mV] = await Promise.all([
            listEpcf({ stagiaire_id: opts.stagiaire.id }), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule"),
          ]);
          etat.evals = ev;
          etat.moyennes = { salle: mS, vehicule: mV };
        } catch (e) { console.error(e); }   // données peut-être périmées : la prochaine ouverture relira
        if (opts.onEnregistre) opts.onEnregistre(etat.evals);
        if (!opts.isActive || opts.isActive()) dessiner();
      },
    });
  }

  dessiner();
}

// --- Formulaire de saisie d'une grille ---
// Une garde de sortie protège la saisie : quitter avec des changements demande confirmation.
function showForm(body, stagiaire, trameKey, existing, { profs, retour, apresEnregistrement }) {
  clear(body);
  const trame = EPCF_TRAMES[trameKey];
  const scores = { ...(existing?.scores || {}) };
  const compSel = new Set(existing?.competences_acquises || []);
  let dirty = false;
  const garde = { estSale: () => dirty, message: "Abandonner la saisie en cours ?" };
  poserGardeSortie(garde);

  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn small ghost", type: "button", onClick: () => {
      if (dirty && !confirm("Abandonner la saisie en cours ?")) return;
      leverGardeSortie(garde);
      retour();
    } }, "← Retour"),
    el("h3", {}, `${trame.label} : ${displayStagiaire(stagiaire)}`),
  ));

  const dateInput = el("input", { type: "date", value: existing?.date_eval || isoDate(new Date()) });
  const metaInputs = {};
  const metaWrap = el("div", { class: "epcf-form-meta" },
    el("div", { class: "field" }, el("label", {}, "Date"), dateInput));
  trame.metaFields.forEach((f) => {
    const inp = el("input", { type: "text", value: existing?.meta?.[f.key] || "" });
    metaInputs[f.key] = inp;
    metaWrap.appendChild(el("div", { class: "field" }, el("label", {}, f.label), inp));
  });
  // Évaluateur facultatif. En édition, on respecte la valeur stockée (y compris null) ;
  // en création, pré-rempli avec le formateur connecté s'il en est un (le fondateur
  // admin n'a pas de prof_id : option vide, pas d'attribution silencieuse).
  const preset = existing ? existing.evaluateur_prof_id : (getProfile()?.prof_id ?? null);
  const evalSel = el("select");
  const optVide = el("option", { value: "" }, "-");
  if (preset == null) optVide.selected = true;
  evalSel.appendChild(optVide);
  profs.forEach((p) => {
    const o = el("option", { value: String(p.id) }, p.nom);
    if (p.id === preset) o.selected = true;
    evalSel.appendChild(o);
  });
  metaWrap.appendChild(el("div", { class: "field" }, el("label", {}, "Évaluateur"), evalSel));
  body.appendChild(metaWrap);

  // Sections + boutons A/R/NA (re-cliquer la note active la dé-sélectionne)
  trame.sections.forEach((sec) => {
    const box = el("div", { class: "epcf-form-section" },
      el("h4", {}, sec.titre,
        sec.competenceTP ? el("span", { class: "muted epcf-detail-tp" }, " (" + sec.competenceTP + ")") : null));
    sec.criteres.forEach((c) => {
      const seg = el("div", { class: "epcf-seg" });
      const btns = {};
      const sync = () => {
        Object.entries(btns).forEach(([note, b]) => b.classList.toggle("active", scores[c.code] === note));
      };
      ["A", "R", "NA"].forEach((note) => {
        const b = el("button", { type: "button", class: "epcf-seg-btn " + note }, NOTE_LABELS[note]);
        b.addEventListener("click", () => {
          if (scores[c.code] === note) delete scores[c.code];
          else scores[c.code] = note;
          dirty = true;
          sync();
        });
        btns[note] = b;
        seg.appendChild(b);
      });
      sync();
      box.appendChild(el("div", { class: "epcf-form-row" }, el("span", { class: "epcf-form-lib" }, c.libelle), seg));
    });
    body.appendChild(box);
  });

  const compWrap = el("div", { class: "epcf-form-comps" }, el("h4", {}, "Compétences acquises"));
  trame.competences.forEach((code) => {
    const cb = el("input", { type: "checkbox" });
    cb.checked = compSel.has(code);
    cb.addEventListener("change", () => { cb.checked ? compSel.add(code) : compSel.delete(code); dirty = true; });
    compWrap.appendChild(el("label", { class: "epcf-comp-cb" }, cb, " " + code));
  });
  body.appendChild(compWrap);

  const commentTa = el("textarea", { rows: "4", class: "epcf-commentaire-ta", placeholder: "Commentaire global…" });
  commentTa.value = existing?.commentaire || "";
  body.appendChild(el("div", { class: "epcf-form-comment" }, el("h4", {}, "Commentaire global"), commentTa));
  [dateInput, ...Object.values(metaInputs), commentTa].forEach((n) => n.addEventListener("input", () => { dirty = true; }));
  evalSel.addEventListener("change", () => { dirty = true; });

  const saveBtn = el("button", { class: "btn primary", type: "button", onClick: async () => {
    if (Object.keys(scores).length === 0) { toast("Renseigne au moins un critère", "error"); return; }
    if (!dateInput.value) { toast("Renseigne la date", "error"); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = "Enregistrement…";
    try {
      const meta = {};
      trame.metaFields.forEach((f) => { const v = metaInputs[f.key].value.trim(); if (v) meta[f.key] = v; });
      await upsertEpcf({
        id: existing?.id,
        stagiaire_id: stagiaire.id,
        trame: trameKey,
        trame_version: trame.version,
        date_eval: dateInput.value,
        evaluateur_prof_id: Number(evalSel.value) || null,
        meta,
        scores,
        competences_acquises: [...compSel].sort(),
        commentaire: commentTa.value.trim() || null,
        updated_by_who: getCurrentWho(),
      });
    } catch (e) {
      console.error(e);
      toast(e?.message || String(e), "error");
      saveBtn.disabled = false;
      saveBtn.textContent = prev;
      return;
    }
    toast("Évaluation enregistrée", "success", 2000);
    dirty = false;
    leverGardeSortie(garde);
    await apresEnregistrement();
  } }, "Enregistrer l'évaluation");
  body.appendChild(el("div", { class: "epcf-actions" }, saveBtn));
}
