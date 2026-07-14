// Vue EPCF, rendue en sous-onglet de Notes. S'adapte au rôle :
//  - formateur/admin : liste des stagiaires × trames, saisie de grille, consultation
//    par élève, vue classe ;
//  - stagiaire : vue classe (moyennes agrégées, k-anonymisées) uniquement.
// La saisie reste protégée par la RLS (INSERT/UPDATE réservés aux profs/admin).

import { listStagiaires, listProfs, listEpcf, upsertEpcf, getEpcfMoyennes } from "../db.js?v=20260714n";
import { el, clear, isoDate, formatDate, displayStagiaire, compareByNom, toast } from "../utils.js?v=20260714n";
import { isAdmin, isProf, getProfile } from "../auth-admin.js?v=20260714n";
import { getCurrentWho } from "../identity.js?v=20260714n";
import { EPCF_TRAMES, NOTE_LABELS } from "../epcf-trames.js?v=20260714n";
import { renderEpcfTrameSection, renderEpcfClasse } from "../epcf-restitution.js?v=20260714n";

let stagiaires = [];
let profs = [];
let evals = [];   // toutes les évals (les profs/admin lisent tout via RLS)
let moyByTrame = { salle: [], vehicule: [] };   // agrégats RPC (vue classe + série groupe)

const TRAME_KEYS = ["salle", "vehicule"];

function evalsFor(sid, trameKey) {
  return evals.filter((e) => e.stagiaire_id === sid && e.trame === trameKey);
}

// opts.embedded : true quand la vue est rendue DANS une autre vue (sous-onglet EPCF
// de Notes) → on n'affiche pas le view-header (le parent a déjà le sien).
export async function renderEpcf(container, opts = {}) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const formateur = isAdmin() || isProf();

  // Stagiaire : pas de saisie ni de liste — seulement la vue classe (moyennes
  // agrégées, k-anonymisées). La RPC getEpcfMoyennes est autorisée à tout connecté.
  if (!formateur) {
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
    return;
  }

  const [stagiairesData, profsData, evalsData, mSalle, mVehicule] = await Promise.all([
    listStagiaires(), listProfs(), listEpcf(), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule"),
  ]);
  stagiaires = stagiairesData; profs = profsData; evals = evalsData;
  moyByTrame = { salle: mSalle, vehicule: mVehicule };
  // Rendu embarqué (sous-onglet) : si l'utilisateur a changé d'onglet pendant le
  // chargement, on ne touche pas au panneau (il affiche déjà autre chose).
  if (opts.isActive && !opts.isActive()) return;
  stagiaires = stagiaires.slice().sort(compareByNom);
  clear(container);

  if (!opts.embedded) {
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        el("p", { class: "eyebrow" }, "Formateurs"),
        el("h2", {}, "EPCF"),
        el("p", { class: "subtitle" }, "Évaluations en cours de formation — grilles CCP1 salle et véhicule."),
      ),
    ));
  }

  const body = el("div", { class: "epcf-body" });
  container.appendChild(body);
  showListe(body);
}

// --- Liste : stagiaires × trames, statut + boutons ---
function showListe(body) {
  clear(body);
  const table = el("table", { class: "epcf-table" });
  table.appendChild(el("thead", {}, el("tr", {},
    el("th", {}, "Stagiaire"),
    ...TRAME_KEYS.map((k) => el("th", {}, EPCF_TRAMES[k].label)),
  )));
  const tbody = el("tbody");
  stagiaires.forEach((s) => {
    const hasAny = evals.some((e) => e.stagiaire_id === s.id);
    // display:flex directement sur un <td> casse le border-collapse (traits
    // désalignés dans la colonne) → on met le flex sur un <div> interne.
    const nameCell = el("td", {}, el("div", { class: "epcf-name-cell" },
      el("span", { class: "epcf-name" }, displayStagiaire(s)),
      hasAny ? el("button", { class: "btn small ghost", onClick: () => showConsult(body, s) }, "Voir") : null,
    ));
    const tr = el("tr", {}, nameCell);
    TRAME_KEYS.forEach((k) => {
      const list = evalsFor(s.id, k);
      const cell = el("td", { class: "epcf-cell" });
      if (list.length) {
        cell.appendChild(el("span", { class: "epcf-statut ok" }, "évalué le " + formatDate(list[0].date_eval)));
        cell.appendChild(el("button", { class: "btn small ghost", onClick: () => showForm(body, s, k, list[0]) }, "Modifier"));
      } else {
        cell.appendChild(el("span", { class: "epcf-statut muted" }, "à évaluer"));
      }
      cell.appendChild(el("button", { class: "btn small primary", onClick: () => showForm(body, s, k, null) },
        list.length ? "Nouvelle éval" : "Évaluer"));
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(el("div", { class: "epcf-table-wrap" }, table));
  body.appendChild(el("div", { class: "epcf-actions" },
    el("button", { class: "btn ghost", onClick: () => showClasse(body) }, "Vue classe (moyennes)")));
}

// --- Formulaire de saisie d'une grille ---
function showForm(body, stagiaire, trameKey, existing) {
  clear(body);
  const trame = EPCF_TRAMES[trameKey];
  const scores = { ...(existing?.scores || {}) };
  const compSel = new Set(existing?.competences_acquises || []);
  let dirty = false;

  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn small ghost", onClick: () => {
      if (dirty && !confirm("Abandonner la saisie en cours ?")) return;
      showListe(body);
    } }, "← Retour"),
    el("h3", {}, `${trame.label} — ${displayStagiaire(stagiaire)}`),
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
  // en création, pré-rempli avec le prof connecté s'il en est un (le fondateur admin
  // n'a pas de prof_id → option vide, pas d'attribution silencieuse au premier prof).
  const preset = existing ? existing.evaluateur_prof_id : (getProfile()?.prof_id ?? null);
  const evalSel = el("select");
  const optVide = el("option", { value: "" }, "—");
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
        sec.competenceTP ? el("span", { class: "muted epcf-detail-tp" }, " — " + sec.competenceTP) : null));
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

  const saveBtn = el("button", { class: "btn primary", onClick: async () => {
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
    // L'éval est écrite : plus de retour en arrière possible sur ce bouton.
    toast("Évaluation enregistrée", "success", 2000);
    dirty = false;
    // Rafraîchit la liste ET les moyennes (sinon la « Vue classe » ignorerait la
    // nouvelle éval jusqu'au prochain rechargement de la vue).
    try {
      const [ev, mS, mV] = await Promise.all([listEpcf(), getEpcfMoyennes("salle"), getEpcfMoyennes("vehicule")]);
      evals = ev; moyByTrame = { salle: mS, vehicule: mV };
    } catch (e) { console.error(e); }   // données potentiellement périmées, la nav les rechargera
    showListe(body);
  } }, "Enregistrer l'évaluation");
  body.appendChild(el("div", { class: "epcf-actions" }, saveBtn));
}

// --- Consultation (lecture seule) des derniers résultats d'un élève : les 2 radars
// (salle + véhicule) + détail, sans passer par le formulaire d'édition. ---
function showConsult(body, stagiaire) {
  clear(body);
  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn small ghost", onClick: () => showListe(body) }, "← Retour"),
    el("h3", {}, "Résultats — " + displayStagiaire(stagiaire)),
  ));
  TRAME_KEYS.forEach((trameKey) => {
    body.appendChild(renderEpcfTrameSection(trameKey,
      evals.filter((e) => e.stagiaire_id === stagiaire.id && e.trame === trameKey),
      moyByTrame[trameKey]));
  });
}

// --- Vue classe : moyennes par phase et critère (agrégats RPC, réutilisable). ---
function showClasse(body) {
  clear(body);
  body.appendChild(el("div", { class: "epcf-form-head" },
    el("button", { class: "btn small ghost", onClick: () => showListe(body) }, "← Retour"),
    el("h3", {}, "Vue classe — moyennes"),
  ));
  renderEpcfClasse(body, moyByTrame);
}
