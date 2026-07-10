// Vue « Mon suivi » : souhaits de compétences (permis B, C1-C4) + besoins du moment,
// saisis par le stagiaire lui-même (fiche fiches_suivi) ; historique voiture en
// lecture seule (dérivé des passages). Les admins voient la liste de toutes les
// fiches et peuvent éditer celle de n'importe quel stagiaire.
import { listStagiaires, listFiches, upsertFiche, getVoitureAggregats, listProfs } from "../db.js?v=20260710g";
import { el, clear, toast, displayStagiaire } from "../utils.js?v=20260710g";
import { isAdmin, getProfile } from "../auth-admin.js?v=20260710g";
import { getCurrentWho } from "../identity.js?v=20260710g";
import { COMPETENCES_REMC } from "./benevoles.js?v=20260710g";

let stagiaires = [];
let fiches = [];       // rows fiches_suivi
let aggregats = {};    // getVoitureAggregats()
let profs = [];

const ficheOf = (sid) => fiches.find((f) => f.stagiaire_id === sid) || { stagiaire_id: sid, souhaits: [], besoins: "" };

// --- Historique lecture seule (calculé depuis passages) ---
function renderHistorique(sid) {
  const a = aggregats[sid] || { total: 0, avecEleve: 0, byProf: {} };
  const profLine = Object.entries(a.byProf)
    .map(([pid, n]) => `${profs.find((p) => p.id === Number(pid))?.nom || "?"} ×${n}`)
    .join(" · ") || "—";
  return el("div", { class: "suivi-histo" },
    el("h4", {}, "Historique voiture"),
    el("p", {}, `${a.total} passage(s) · dont ${a.avecEleve} avec élève`),
    el("p", { class: "muted" }, "Formateurs : " + profLine),
  );
}

// --- Éditeur d'une fiche (souhaits + besoins) ---
function renderFicheEditor(sid, onSaved) {
  const fiche = ficheOf(sid);
  const selected = new Set(fiche.souhaits || []);

  const comps = el("div", { class: "suivi-comps" });
  COMPETENCES_REMC.forEach((c) => {
    const det = el("details", { class: "suivi-comp" });
    const mainCb = el("input", { type: "checkbox" });
    mainCb.checked = selected.has(c.code);
    mainCb.addEventListener("change", () => { mainCb.checked ? selected.add(c.code) : selected.delete(c.code); });
    mainCb.addEventListener("click", (ev) => ev.stopPropagation());  // ne pas replier l'accordéon
    const summary = el("summary", {}, el("label", { class: "suivi-comp-main" }, mainCb, ` ${c.code} · ${c.titre}`));
    det.appendChild(summary);
    c.sous.forEach(([code, libelle]) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = selected.has(code);
      cb.addEventListener("change", () => { cb.checked ? selected.add(code) : selected.delete(code); });
      det.appendChild(el("label", { class: "suivi-souscomp" }, cb, ` ${code} · ${libelle}`));
    });
    comps.appendChild(det);
  });

  const besoinsTa = el("textarea", { rows: "4", placeholder: "Mes besoins du moment (texte libre)…" });
  besoinsTa.value = fiche.besoins || "";

  const saveBtn = el("button", { class: "btn primary", onClick: async () => {
    try {
      await upsertFiche({
        stagiaire_id: sid,
        souhaits: [...selected].sort(),
        besoins: besoinsTa.value.trim() || null,
        updated_by_who: getCurrentWho(),
      });
      toast("Fiche enregistrée", "success", 2000);
      fiches = await listFiches();
      if (onSaved) onSaved();
    } catch (e) { console.error(e); toast(e.message, "error"); }
  } }, "Enregistrer ma fiche");

  return el("div", { class: "suivi-editor" },
    el("h4", {}, "Compétences du permis B (C1–C4) que je veux travailler"),
    comps,
    el("h4", {}, "Mes besoins"),
    besoinsTa,
    el("div", { style: "margin-top:0.75rem" }, saveBtn),
  );
}

// --- Vue admin : liste des fiches ---
function renderAdminList(container) {
  const wrap = el("div", { class: "suivi-admin-list" });
  stagiaires.forEach((s) => {
    const fiche = ficheOf(s.id);
    const a = aggregats[s.id] || { total: 0, avecEleve: 0, byProf: {} };
    const tags = (fiche.souhaits || []).map((code) => el("span", { class: "tag" }, code));
    const card = el("div", { class: "suivi-card" },
      el("div", { class: "suivi-card-head" },
        el("strong", {}, displayStagiaire(s)),
        el("span", { class: "muted" }, `${a.total} passages · ${a.avecEleve} avec élève`),
      ),
      el("div", { class: "suivi-card-tags" }, ...(tags.length ? tags : [el("span", { class: "faint" }, "aucun souhait coché")])),
      el("p", { class: "suivi-card-besoins" }, fiche.besoins || "—"),
    );
    card.addEventListener("click", () => openAdminEdit(container, s));
    wrap.appendChild(card);
  });
  return wrap;
}

function openAdminEdit(container, s) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const modal = el("div", { class: "modal", style: "max-width:640px" },
    el("h3", {}, "Fiche de " + displayStagiaire(s)),
    renderHistorique(s.id),
    renderFicheEditor(s.id, () => { backdrop.remove(); rerender(container); }),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: () => backdrop.remove() }, "Fermer")),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function rerender(container) {
  clear(container);
  const admin = isAdmin();
  const myStagiaireId = getProfile()?.stagiaire_id ?? null;

  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Pédagogie voiture"),
      el("h2", {}, admin && myStagiaireId == null ? "Fiches de suivi" : "Mon suivi"),
      el("p", { class: "subtitle" }, "Souhaits de compétences (permis B) et besoins — utilisés pour l'attribution des places voiture."),
    ),
  ));

  if (myStagiaireId != null) {
    container.appendChild(renderHistorique(myStagiaireId));
    container.appendChild(renderFicheEditor(myStagiaireId, () => rerender(container)));
    return;
  }
  if (admin) { container.appendChild(renderAdminList(container)); return; }
  container.appendChild(el("p", { class: "muted" },
    "Ton compte n'est pas relié à une fiche stagiaire. Demande à un admin de faire le lien."));
}

export async function renderSuivi(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  [stagiaires, fiches, aggregats, profs] = await Promise.all([
    listStagiaires(), listFiches(), getVoitureAggregats(), listProfs(),
  ]);
  rerender(container);
}
