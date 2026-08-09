// Dossier Professionnel : un dossier par stagiaire, rempli par le candidat
// lui-même (le DP lui appartient), consulté en lecture seule par les
// formateurs. Le document affiché est le document imprimé.
//
// En édition, les 6 exemples de pratique sont affichés même vides, sinon le
// candidat n'aurait aucun champ où saisir son 2e ou 3e exemple ; les vides
// portent .dp-page-exclue et ne s'impriment pas (voir dp-gabarit.js).

import { listStagiaires, listDpDossiers, getDpDossier, upsertDpDossier } from "../db.js?v=20260809e";
import { el, clear, displayStagiaire, compareByNom, formatDate, toast } from "../utils.js?v=20260809e";
import { isAdmin, isProf, getProfile } from "../auth-admin.js?v=20260809e";
import { getCurrentWho } from "../identity.js?v=20260809e";
import { collectData, fillData, applyEditable, wireDocEditing,
         bindDocPrint, refreshDocPrint, teardownDocPrint } from "../doc-officiel.js?v=20260809e";
import { buildDpHTML } from "./dp-gabarit.js?v=20260809e";
import { blocsImprimes } from "../dp-rules.js?v=20260809e";

let stagiaires = [];
let dossiersIndex = [];
// stagiaire_id de la personne connectée, ou null. Un formateur peut être
// lui-même stagiaire (cas admin + stagiaire) : sa propre ligne de la liste
// s'ouvre alors EN ÉDITION, puisque le DP de quelqu'un n'appartient qu'à lui.
let monStagiaireId = null;

// Charge le dossier d'un stagiaire et l'affiche, sans passer par la liste.
async function ouvrirDossier(container, id, { readOnly, back, isActive }) {
  let row = null;
  let s = null;
  try {
    [row, s] = await Promise.all([
      getDpDossier(id),
      listStagiaires().then((l) => l.find((x) => x.id === id) || null),
    ]);
  } catch (e) {
    console.error(e);
    if (isActive && !isActive()) return;
    clear(container);
    container.appendChild(el("p", { class: "muted" },
      "Chargement du dossier professionnel impossible : " + (e?.message || e)));
    return;
  }
  if (isActive && !isActive()) return;
  clear(container);
  showDoc(container, s, row, { readOnly, stagiaireId: id, back });
}

// opts.stagiaireId : ouvre directement le dossier de CE stagiaire, sans liste.
// Utilisé par l'espace personnel (Mon suivi), où l'on regarde déjà quelqu'un de
// précis. En édition si c'est le sien, en consultation sinon.
export async function renderDp(container, opts = {}) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const formateur = isAdmin() || isProf();
  const monId = getProfile()?.stagiaire_id ?? null;

  if (opts.stagiaireId != null) {
    const id = Number(opts.stagiaireId);
    await ouvrirDossier(container, id, { readOnly: id !== monId, isActive: opts.isActive });
    return;
  }

  // Un stagiaire (ou un fondateur en aperçu « stagiaire ») ouvre directement son
  // dossier. La RLS ne lui renvoie que le sien de toute façon.
  if (!formateur) {
    if (monId == null) {
      clear(container);
      container.appendChild(el("p", { class: "muted" },
        "Ton compte n'est pas encore relié à une fiche stagiaire : le dossier professionnel n'est pas disponible."));
      return;
    }
    await ouvrirDossier(container, monId, { readOnly: false, isActive: opts.isActive });
    return;
  }

  let stagiairesData, dossiersData;
  try {
    [stagiairesData, dossiersData] = await Promise.all([listStagiaires(), listDpDossiers()]);
  } catch (e) {
    console.error(e);
    if (opts.isActive && !opts.isActive()) return;
    clear(container);
    container.appendChild(el("p", { class: "muted" },
      "Chargement des dossiers professionnels impossible : " + (e?.message || e)));
    return;
  }
  if (opts.isActive && !opts.isActive()) return;
  stagiaires = stagiairesData.slice().sort(compareByNom);
  dossiersIndex = dossiersData;
  monStagiaireId = monId;
  clear(container);
  showListe(container);
}

function showListe(container) {
  clear(container);
  teardownDocPrint();
  container.appendChild(el("p", { class: "lv-hint" },
    "Dossier professionnel (DP) du ministère chargé de l'emploi. ",
    "Le DP appartient au candidat : chaque stagiaire remplit le sien, les formateurs le consultent."));
  const table = el("table", { class: "lv-liste-table" });
  table.appendChild(el("thead", {}, el("tr", {},
    el("th", {}, "Stagiaire"), el("th", {}, "Dossier"))));
  const tbody = el("tbody");
  stagiaires.forEach((s) => {
    const row = dossiersIndex.find((d) => d.stagiaire_id === s.id);
    const cestMoi = monStagiaireId != null && s.id === monStagiaireId;
    const cell = el("td", {});
    cell.appendChild(el("span", { class: "lv-statut" + (row ? " ok" : "") },
      row ? "commencé · màj " + formatDate(new Date(row.updated_at)) : "vierge"));
    // Sa propre ligne s'ouvre en édition, même pour un formateur : le DP
    // appartient au candidat, et un formateur peut être aussi stagiaire.
    // Les dossiers des autres ne s'ouvrent qu'en consultation, et seulement
    // s'ils existent déjà.
    if (cestMoi || row) {
      cell.appendChild(el("button", {
        class: "btn small " + (cestMoi && !row ? "primary" : "ghost"),
        style: "margin-left:10px",
        onClick: async () => {
          let full = null;
          try { full = await getDpDossier(s.id); }
          catch (e) { console.error(e); toast(e?.message || String(e), "error"); return; }
          showDoc(container, s, full, {
            readOnly: !cestMoi, stagiaireId: s.id, back: () => renderReload(container),
          });
        },
      }, cestMoi ? (row ? "Remplir mon dossier" : "Commencer mon dossier") : "Consulter"));
    }
    const nom = el("div", { class: "lv-name-cell" }, el("span", {}, displayStagiaire(s)));
    if (cestMoi) nom.appendChild(el("span", { class: "lv-statut" }, "moi"));
    tbody.appendChild(el("tr", {}, el("td", {}, nom), cell));
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function renderReload(container) {
  try { dossiersIndex = await listDpDossiers(); } catch (e) { console.error(e); }
  showListe(container);
}

// Ouvre le dossier d'un stagiaire. readOnly force la consultation pure
// (formateur) ; le candidat, lui, édite le sien.
function showDoc(container, stagiaire, row, { readOnly, stagiaireId, back } = {}) {
  clear(container);
  let data = { ...(row?.data || {}) };

  // Pré-remplissage à la première ouverture, depuis la fiche stagiaire. Les
  // champs restent modifiables : le DP distingue nom de naissance et nom d'usage.
  if (stagiaire && !readOnly) {
    if (!data.nom_usage) data.nom_usage = (stagiaire.nom || "").toUpperCase();
    if (!data.prenom) data.prenom = stagiaire.prenom || "";
    if (!data.dh_nom) {
      data.dh_nom = [stagiaire.prenom, (stagiaire.nom || "").toUpperCase()].filter(Boolean).join(" ");
    }
    // Modalité d'accès : parcours de formation par défaut, comme le gabarit ECF.
    if (data.modalite_vae !== true && data.modalite_formation === undefined) {
      data.modalite_formation = true;
    }
  }

  const status = el("span", { class: "lv-status" }, readOnly ? "Lecture seule" : "");
  const toolbar = el("div", { class: "lv-toolbar" });
  if (back) {
    toolbar.appendChild(el("button", { class: "btn small ghost",
      onClick: () => { teardownDocPrint(); back(); } }, "← Retour"));
  }
  toolbar.appendChild(el("h3", {},
    "Dossier professionnel" + (readOnly && stagiaire ? " : " + displayStagiaire(stagiaire) : "")));
  toolbar.appendChild(status);
  toolbar.appendChild(el("button", { class: "btn small primary", onClick: async () => {
    if (!readOnly) await saveNow();
    refreshDocPrint();
    window.print();
  } }, "Imprimer / PDF"));
  container.appendChild(toolbar);
  container.appendChild(el("p", { class: "lv-hint" }, readOnly
    ? "Le DP appartient au candidat, il en est le seul rédacteur. Consultation seule."
    : "Clique dans les zones encadrées pour remplir. Enregistrement automatique. Un exemple laissé vide ne sera pas imprimé."));

  const doc = el("div", { class: "dp-doc dp-screen" + (readOnly ? "" : " dp-edit") });
  const scaleInner = el("div", { class: "dp-scale" }, doc);
  const scaleOuter = el("div", { class: "dp-scale-outer" }, scaleInner);
  container.appendChild(scaleOuter);

  // Mise à l'échelle écran : le document (210mm ≈ 794px) est réduit pour tenir
  // dans la colonne, verrou de hauteur pour ne pas laisser de vide dessous.
  const rescale = () => {
    if (!document.contains(scaleOuter)) return;
    const w = scaleOuter.clientWidth;
    if (!w) return;
    const docW = doc.offsetWidth || 794;
    const scale = Math.min(1, w / docW);
    scaleInner.style.transform = `scale(${scale})`;
    scaleOuter.style.height = doc.offsetHeight * scale + "px";
  };

  // Nombre de blocs imprimés au dernier rendu : sert à détecter qu'un exemple
  // vient de passer de vide à rempli (ou l'inverse), ce qui change le sommaire
  // et la pagination et impose de reconstruire le document.
  let nbBlocs = 0;
  // Les écouteurs de wireDocEditing sont posés en délégation sur `doc` : ils
  // survivent au remplacement de innerHTML et ne doivent donc être posés
  // QU'UNE FOIS, sinon chaque reconstruction les empilerait (une frappe
  // déclencherait N enregistrements). Seul contentEditable est ré-appliqué.
  let editionCablee = false;

  function render() {
    doc.innerHTML = buildDpHTML(data, { edition: !readOnly });
    nbBlocs = blocsImprimes(data).length;
    fillData(doc, data);
    if (!readOnly) {
      if (!editionCablee) { wireDocEditing(doc, onEdit); editionCablee = true; }
      else applyEditable(doc);
    }
    marquerDebordements(doc);
    bindDocPrint(doc, { printId: "dp-print", bodyClass: "dp-printable" });
    requestAnimationFrame(rescale);
  }

  function onEdit() {
    // collectData est la source de vérité : il omet les champs vides, donc
    // vider un champ le retire bien de data. Aucune clé ne peut se perdre, les
    // 6 exemples sont rendus en édition.
    data = collectData(doc);
    if (blocsImprimes(data).length !== nbBlocs) {
      // La pagination change : on reconstruit, en gardant le champ actif.
      const actif = document.activeElement?.dataset?.k || null;
      render();
      if (actif) {
        const cible = doc.querySelector(`[data-k="${CSS.escape(actif)}"]`);
        if (cible) placerCurseurEnFin(cible);
      }
    } else {
      marquerDebordements(doc);
    }
    scheduleSave();
  }

  render();
  window.addEventListener("resize", rescale);

  // --- Autosave débouncé, même mécanique que le livret EPCF ---
  let saveTimer = null;
  let cloneTimer = null;
  let saving = false;
  let pendingAgain = false;

  async function saveNow() {
    if (readOnly) return;
    if (saving) { pendingAgain = true; return; }
    saving = true;
    clearTimeout(saveTimer);
    status.textContent = "Enregistrement…";
    status.className = "lv-status saving";
    try {
      await upsertDpDossier({
        stagiaire_id: stagiaireId,
        data: collectData(doc),
        updated_by_who: getCurrentWho(),
      });
      status.textContent = "Enregistré ✓";
      status.className = "lv-status";
    } catch (e) {
      console.error(e);
      status.textContent = "Non enregistré !";
      status.className = "lv-status error";
      toast("Enregistrement du dossier impossible : " + (e?.message || e), "error");
    } finally {
      saving = false;
      if (pendingAgain) { pendingAgain = false; saveNow(); }
    }
  }

  function scheduleSave() {
    status.textContent = "Modifié…";
    status.className = "lv-status saving";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
    // Le clone d'impression suit les éditions sans re-cloner à chaque frappe.
    clearTimeout(cloneTimer);
    cloneTimer = setTimeout(() => { if (document.contains(doc)) refreshDocPrint(); }, 1200);
  }
}

// Signale les zones dont le contenu dépasse la hauteur nominale. On ne coupe
// jamais le texte : le liseré invite seulement à resserrer la rédaction.
//
// La zone n'a qu'un min-height et ne masque pas son débordement : elle GRANDIT
// au lieu de déborder, donc scrollHeight vaut toujours clientHeight ici. Le
// dépassement se mesure en comparant la hauteur réelle à la hauteur nominale
// (la zone est en box-sizing: border-box, les deux sont comparables).
// offsetHeight et non getBoundingClientRect : le document est sous un
// transform: scale, qui fausserait le rectangle mais pas le layout.
function marquerDebordements(doc) {
  doc.querySelectorAll(".dp-zone").forEach((z) => {
    const nominal = parseFloat(getComputedStyle(z).minHeight) || 0;
    z.classList.toggle("dp-deborde", z.offsetHeight > nominal + 2);
  });
}

function placerCurseurEnFin(node) {
  node.focus({ preventScroll: true });
  const r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}
