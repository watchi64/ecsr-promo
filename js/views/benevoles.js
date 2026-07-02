// Panneau « Élèves bénévoles » : banque des volontaires qui viennent conduire avec
// les élèves moniteurs (activité Voiture conduite). Réservé formateur/admin : le
// bouton d'ouverture n'est rendu que pour eux et la table est RLS admin-only (le
// téléphone ne transite jamais vers un stagiaire). Ouvert depuis la barre semaine
// du Planning.
import { listBenevoles, addBenevole, updateBenevole, setBenevoleActif } from "../db.js?v=20260702i";
import { el, clear, toast, displayStagiaire, compareByNom } from "../utils.js?v=20260702i";
import { JOURS } from "../config.js?v=20260702i";

const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
const DEMI = [
  { key: "matin", label: "matin", court: "m" },
  { key: "aprem", label: "après-midi", court: "am" },
];
const NIVEAUX = ["C1", "C2", "C3", "C4"];
const BOITES = ["Manuelle", "Automatique"];

function jourLong(j) { return j.charAt(0) + j.slice(1).toLowerCase(); }

// Badges compacts des dispos récurrentes : « Lun m », « Mar m+am »...
function dispoBadges(b) {
  const wrap = el("span", { class: "bnv-badges" });
  JOURS.forEach((j, i) => {
    const halves = (b.dispos?.[j] || [])
      .map((h) => DEMI.find((d) => d.key === h)?.court)
      .filter(Boolean);
    if (halves.length) wrap.appendChild(el("span", { class: "bnv-badge" }, `${JOURS_COURTS[i]} ${halves.join("+")}`));
  });
  if (!wrap.children.length) wrap.appendChild(el("span", { class: "bnv-badge empty" }, "dispos non renseignées"));
  return wrap;
}

function metaLine(b) {
  const parts = [b.niveau, b.boite, (b.heures != null && b.heures !== "") ? `${b.heures}h` : null, b.auto_ecole]
    .filter((v) => v != null && String(v).trim() !== "");
  return parts.join(" · ");
}

function telLink(tel) {
  if (!tel || !String(tel).trim()) return null;
  return el("a", { class: "bnv-tel", href: "tel:" + String(tel).replace(/[^+\d]/g, "") }, tel);
}

export function openBenevolesPanel({ onClose } = {}) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const modal = el("div", { class: "modal bnv-modal" });
  backdrop.appendChild(modal);

  let list = [];
  let filtre = { jour: "", demi: "" };
  let dirty = false;  // au moins une écriture => le planning recharge sa banque à la fermeture

  const close = () => { backdrop.remove(); if (dirty && onClose) onClose(); };
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });

  function matchesFiltre(b) {
    const d = b.dispos || {};
    if (filtre.jour && filtre.demi) return (d[filtre.jour] || []).includes(filtre.demi);
    if (filtre.jour) return (d[filtre.jour] || []).length > 0;
    if (filtre.demi) return JOURS.some((j) => (d[j] || []).includes(filtre.demi));
    return true;
  }

  function renderList() {
    clear(modal);
    modal.appendChild(el("h3", {}, "Élèves bénévoles"));
    modal.appendChild(el("p", { class: "muted bnv-intro" },
      "Volontaires qui viennent conduire avec les élèves moniteurs. Visible uniquement par les formateurs/admins."));

    // Filtre dispo + ajout
    const jourSel = el("select");
    jourSel.appendChild(el("option", { value: "" }, "Tous les jours"));
    JOURS.forEach((j) => jourSel.appendChild(el("option", { value: j }, jourLong(j))));
    jourSel.value = filtre.jour;
    jourSel.addEventListener("change", () => { filtre.jour = jourSel.value; renderList(); });

    const demiSel = el("select");
    demiSel.appendChild(el("option", { value: "" }, "Matin + après-midi"));
    DEMI.forEach((d) => demiSel.appendChild(el("option", { value: d.key }, d.label)));
    demiSel.value = filtre.demi;
    demiSel.addEventListener("change", () => { filtre.demi = demiSel.value; renderList(); });

    const addBtn = el("button", { class: "btn small primary", onClick: () => renderForm(null) }, "+ Ajouter");
    modal.appendChild(el("div", { class: "bnv-toolbar" },
      el("span", { class: "bnv-filter-label" }, "Dispo :"), jourSel, demiSel,
      el("span", { style: "flex:1" }), addBtn));

    const actifs = list.filter((b) => b.actif !== false).filter(matchesFiltre).sort(compareByNom);
    const retires = list.filter((b) => b.actif === false).sort(compareByNom);

    if (!actifs.length) {
      modal.appendChild(el("p", { class: "muted bnv-empty" },
        list.length ? "Personne ne correspond à ce filtre." : "Banque vide. Ajoute un premier bénévole."));
    }
    actifs.forEach((b) => {
      const row = el("div", { class: "bnv-row" });
      const info = el("div", { class: "bnv-info" });
      info.appendChild(el("div", { class: "bnv-name" }, displayStagiaire(b)));
      const meta = metaLine(b);
      if (meta) info.appendChild(el("div", { class: "bnv-meta" }, meta));
      info.appendChild(dispoBadges(b));
      if (b.dispo_note) info.appendChild(el("div", { class: "bnv-note" }, b.dispo_note));
      row.appendChild(info);
      const side = el("div", { class: "bnv-side" });
      const tel = telLink(b.telephone);
      if (tel) side.appendChild(tel);
      side.appendChild(el("button", { class: "btn small ghost", onClick: () => renderForm(b) }, "Modifier"));
      row.appendChild(side);
      modal.appendChild(row);
    });

    if (retires.length) {
      const det = el("details", { class: "bnv-retires" });
      det.appendChild(el("summary", {}, `Retirés de la banque (${retires.length})`));
      retires.forEach((b) => {
        det.appendChild(el("div", { class: "bnv-row inactive" },
          el("div", { class: "bnv-info" }, el("div", { class: "bnv-name" }, displayStagiaire(b))),
          el("div", { class: "bnv-side" },
            el("button", { class: "btn small ghost", onClick: async () => {
              try {
                await setBenevoleActif(b.id, true); dirty = true; await reload(); renderList();
              } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
            }}, "Réactiver"))));
      });
      modal.appendChild(det);
    }

    modal.appendChild(el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  }

  function renderForm(b) {
    clear(modal);
    modal.appendChild(el("h3", {}, b ? "Modifier " + displayStagiaire(b) : "Nouveau bénévole"));

    const prenomIn = el("input", { type: "text", value: b?.prenom || "", autocomplete: "off" });
    const nomIn = el("input", { type: "text", value: b?.nom || "", autocomplete: "off" });
    const telIn = el("input", { type: "tel", value: b?.telephone || "", autocomplete: "off", placeholder: "06 12 34 56 78" });
    const heuresIn = el("input", { type: "number", min: "0", step: "0.5", value: b?.heures ?? "" });
    const autoEcoleIn = el("input", { type: "text", value: b?.auto_ecole || "", autocomplete: "off", placeholder: "ECF Nîmes…" });
    const dispoNoteIn = el("input", { type: "text", value: b?.dispo_note || "", autocomplete: "off", placeholder: "à partir de 17h, pas pendant ses exams…" });
    const notesIn = el("input", { type: "text", value: b?.notes || "", autocomplete: "off" });

    const niveauSel = el("select");
    niveauSel.appendChild(el("option", { value: "" }, "Niveau…"));
    NIVEAUX.forEach((n) => niveauSel.appendChild(el("option", { value: n }, n)));
    niveauSel.value = b?.niveau || "";

    const boiteSel = el("select");
    boiteSel.appendChild(el("option", { value: "" }, "Boîte…"));
    BOITES.forEach((x) => boiteSel.appendChild(el("option", { value: x }, x)));
    boiteSel.value = b?.boite || "";

    // Grille de dispos récurrentes : 5 jours x 2 demi-journées
    const dispoState = {};
    JOURS.forEach((j) => { dispoState[j] = new Set(b?.dispos?.[j] || []); });
    const grid = el("div", { class: "bnv-dispo-grid" });
    grid.appendChild(el("span", {}, ""));
    DEMI.forEach((d) => grid.appendChild(el("span", { class: "bnv-dispo-head" }, d.label)));
    JOURS.forEach((j, i) => {
      grid.appendChild(el("span", { class: "bnv-dispo-jour" }, JOURS_COURTS[i]));
      DEMI.forEach((d) => {
        const cb = el("input", { type: "checkbox" });
        cb.checked = dispoState[j].has(d.key);
        cb.addEventListener("change", () => {
          if (cb.checked) dispoState[j].add(d.key);
          else dispoState[j].delete(d.key);
        });
        grid.appendChild(el("label", { class: "bnv-dispo-cell" }, cb));
      });
    });

    async function save() {
      const prenom = prenomIn.value.trim();
      const nom = nomIn.value.trim();
      if (!prenom || !nom) { toast("Prénom et nom obligatoires", "error"); return; }
      const dispos = {};
      JOURS.forEach((j) => { if (dispoState[j].size) dispos[j] = [...dispoState[j]]; });
      const payload = {
        prenom, nom,
        telephone: telIn.value.trim() || null,
        niveau: niveauSel.value || null,
        boite: boiteSel.value || null,
        heures: heuresIn.value === "" ? null : Number(heuresIn.value),
        auto_ecole: autoEcoleIn.value.trim() || null,
        dispos,
        dispo_note: dispoNoteIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      try {
        if (b) await updateBenevole(b.id, payload);
        else await addBenevole(payload);
        dirty = true;
        await reload();
        renderList();
      } catch (e) {
        console.error(e);
        toast("Erreur d'enregistrement", "error");
      }
    }

    const form = el("div", { class: "modal-form" },
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Prénom *"), prenomIn),
        el("div", { class: "field" }, el("label", {}, "Nom *"), nomIn)),
      el("div", { class: "bnv-form-2col" },
        el("div", { class: "field" }, el("label", {}, "Téléphone (visible formateurs)"), telIn),
        el("div", { class: "field" }, el("label", {}, "Auto-école d'origine"), autoEcoleIn)),
      el("div", { class: "bnv-form-3col" },
        el("div", { class: "field" }, el("label", {}, "Niveau"), niveauSel),
        el("div", { class: "field" }, el("label", {}, "Boîte"), boiteSel),
        el("div", { class: "field" }, el("label", {}, "Heures faites"), heuresIn)),
      el("div", { class: "field" }, el("label", {}, "Disponibilités récurrentes"), grid),
      el("div", { class: "field" }, el("label", {}, "Précision dispos"), dispoNoteIn),
      el("div", { class: "field" }, el("label", {}, "Notes"), notesIn),
    );
    modal.appendChild(form);

    const actions = el("div", { class: "modal-actions" });
    if (b && b.actif !== false) {
      actions.appendChild(el("button", { class: "btn ghost bnv-remove", onClick: async () => {
        if (!confirm(`Retirer ${displayStagiaire(b)} de la banque ? (réactivable ensuite)`)) return;
        try {
          await setBenevoleActif(b.id, false); dirty = true; await reload(); renderList();
        } catch (e) { console.error(e); toast("Erreur d'enregistrement", "error"); }
      }}, "Retirer de la banque"));
    }
    actions.appendChild(el("span", { style: "flex:1" }));
    actions.appendChild(el("button", { class: "btn ghost", onClick: renderList }, "Annuler"));
    actions.appendChild(el("button", { class: "btn primary", onClick: save }, "Enregistrer"));
    modal.appendChild(actions);
  }

  async function reload() { list = await listBenevoles(); }

  modal.appendChild(el("div", { class: "loading" }, "Chargement"));
  document.body.appendChild(backdrop);
  reload().then(renderList).catch((e) => {
    console.error(e);
    clear(modal);
    modal.appendChild(el("p", { class: "muted" }, "Erreur de chargement de la banque."));
    modal.appendChild(el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", onClick: close }, "Fermer")));
  });
}
