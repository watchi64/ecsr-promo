// Dossier Professionnel : un dossier par stagiaire. Le DP reste le document du
// candidat, mais les formateurs peuvent l'ouvrir en écriture pour accompagner
// sa rédaction (décision du 2026-09-16, qui renverse celle du 2026-07-30 ; la
// RLS de dp_dossiers a suivi). La dernière main est tracée par
// updated_by_who et affichée sous la barre d'outils. Le document affiché est le document imprimé.
//
// En édition, les 6 exemples de pratique sont affichés même vides, sinon le
// candidat n'aurait aucun champ où saisir son 2e ou 3e exemple ; les vides
// portent .dp-bloc-exclu et ne s'impriment pas (voir dp-gabarit.js).

import { listStagiaires, listDpDossiers, getDpDossier, upsertDpDossier } from "../db.js?v=20260916b";
import { el, clear, displayStagiaire, compareByNom, formatDate, toast } from "../utils.js?v=20260916b";
import { isAdmin, isProf, getProfile } from "../auth-admin.js?v=20260916b";
import { getCurrentWho } from "../identity.js?v=20260916b";
import { collectData, fillData, applyEditable, wireDocEditing,
         bindDocPrint, refreshDocPrint, teardownDocPrint } from "../doc-officiel.js?v=20260916b";
import { buildDpFlux, blocSommaire, feuille } from "./dp-gabarit.js?v=20260916b";
import { exempleImprime } from "../dp-rules.js?v=20260916b";
import { composer, marquerCoupures } from "../dp-pagination.js?v=20260916b";

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
    // Son propre dossier, ou celui d'un stagiaire quand on est formateur : dans
    // les deux cas en écriture. Un stagiaire qui regarde le dossier d'un autre
    // ne passe jamais ici, la RLS ne le lui renverrait pas.
    await ouvrirDossier(container, id, { readOnly: !(formateur || id === monId), isActive: opts.isActive });
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
    "Le DP est le document du candidat. Les formateurs peuvent l'ouvrir pour l'accompagner ; ",
    "chaque enregistrement retient qui a écrit en dernier."));
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
    // Un formateur ouvre en écriture le dossier de n'importe quel stagiaire,
    // commencé ou non : il accompagne la rédaction. Sa propre ligne s'ouvre de
    // la même façon, un formateur pouvant être aussi stagiaire.
    cell.appendChild(el("button", {
      class: "btn small " + (cestMoi && !row ? "primary" : "ghost"),
      style: "margin-left:10px",
      onClick: async () => {
        let full = null;
        try { full = await getDpDossier(s.id); }
        catch (e) { console.error(e); toast(e?.message || String(e), "error"); return; }
        showDoc(container, s, full, {
          readOnly: false, stagiaireId: s.id, back: () => renderReload(container),
        });
      },
    }, cestMoi ? (row ? "Remplir mon dossier" : "Commencer mon dossier")
               : (row ? "Ouvrir" : "Commencer")));
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
  const cestLeMien = stagiaire == null || (getProfile()?.stagiaire_id ?? null) === stagiaireId;
  toolbar.appendChild(el("h3", {},
    "Dossier professionnel" + (!cestLeMien && stagiaire ? " : " + displayStagiaire(stagiaire) : "")));
  toolbar.appendChild(status);
  toolbar.appendChild(el("button", { class: "btn small primary", onClick: async () => {
    if (!readOnly) await saveNow();
    refreshDocPrint();
    window.print();
  } }, "Imprimer / PDF"));
  container.appendChild(toolbar);
  // Qui a écrit en dernier. Le DP est le document du candidat : quand un
  // formateur y touche, cela doit se voir, du candidat comme des autres.
  const derniereMain = row && row.updated_by_who
    ? "Dernière modification par " + row.updated_by_who
      + (row.updated_at ? " le " + formatDate(new Date(row.updated_at)) : "") + ". "
    : "";
  container.appendChild(el("p", { class: "lv-hint" }, readOnly
    ? derniereMain + "Consultation seule."
    : derniereMain + (cestLeMien
        ? "Clique dans les zones encadrées pour remplir. Enregistrement automatique. Un exemple laissé vide ne sera pas imprimé."
        : "Tu accompagnes ce candidat : tes modifications sont enregistrées à ton nom.")));

  // À l'écran : en édition le candidat écrit dans un flux continu, en
  // consultation le document est déjà composé en feuilles. Dans les deux cas,
  // c'est le document composé qui s'imprime.
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
    // scrollWidth couvre le cas ou le document deborderait de son conteneur ;
    // offsetWidth suffit des lors que .dp-doc porte sa largeur de feuille. On
    // prend le plus grand des deux, et 794 px, soit 210 mm, en dernier recours.
    const docW = Math.max(doc.scrollWidth, doc.offsetWidth, 794);
    const scale = Math.min(1, w / docW);
    scaleInner.style.transform = `scale(${scale})`;
    scaleOuter.style.height = doc.offsetHeight * scale + "px";
  };

  // Conteneur hors écran : document de mesure et document composé. Il est retiré
  // par teardownDocPrint au changement de route.
  document.getElementById("dp-hors-ecran")?.remove();
  const mesure = el("div", { class: "dp-doc" });
  const pourImpression = el("div", { class: "dp-doc" });
  const horsEcran = el("div", { id: "dp-hors-ecran", "aria-hidden": "true" }, mesure, pourImpression);
  document.body.appendChild(horsEcran);

  const fabriquerFeuille = (numero, estCouverture) => {
    const d = document.createElement("div");
    d.innerHTML = feuille("", numero, estCouverture);
    return d.firstElementChild;
  };
  const blocsDe = (flux) => [...flux.children].filter((n) => n.classList.contains("dp-bloc"));

  // Un flux détaché du document : la composition clone ses blocs dans les
  // feuilles et ne mesure que les clones, le flux source n'a pas à être rendu.
  function fluxDetache(html) {
    const f = document.createElement("div");
    f.className = "dp-flux";
    f.innerHTML = html;
    fillData(f, data);
    return f;
  }

  // Deux cartes de pages sont identiques quand elles portent les mêmes clés avec
  // les mêmes numéros. Sert à détecter la convergence de composerImprimable.
  function memeCarte(a, b) {
    if (a.size !== b.size) return false;
    for (const [cle, numero] of a) {
      if (b.get(cle) !== numero) return false;
    }
    return true;
  }

  // Compose le document imprimable dans `pourImpression`, et renvoie le numéro
  // de feuille de chaque rubrique. Le sommaire affiche des numéros de page, qui
  // ne changent en principe pas la hauteur de la ligne qui les porte : une seule
  // passe supplémentaire (numéros vides, puis numéros inscrits) suffit alors à
  // converger. Mais un intitulé de fiche vient du candidat et peut être long :
  // s'il replie une ligne du sommaire entre deux passes, le document entier
  // décale d'un cran et une seule passe de plus ne suffit plus forcément. On
  // boucle donc jusqu'à ce que la carte se stabilise, avec un maximum de 3
  // passes : au-delà, on garde la dernière carte obtenue sans échouer, un
  // sommaire légèrement décalé valant mieux qu'un document qui refuse de
  // s'afficher. Chaque passe compose directement dans `pourImpression` (que
  // `composer` vide avant d'écrire) : la dernière itération y laisse donc déjà
  // le document final, sans passe finale séparée.
  function composerImprimable() {
    let pages = null;
    let numeroParCle = null;
    for (let i = 0; i < 3; i += 1) {
      const flux = fluxDetache(buildDpFlux(data, { edition: false, pages }));
      const res = composer(blocsDe(flux), { hote: pourImpression, fabriquerFeuille });
      numeroParCle = res.numeroParCle;
      if (pages && memeCarte(pages, numeroParCle)) break;
      pages = numeroParCle;
    }
    imprimableAJour = true;
    return numeroParCle;
  }

  let fluxEdition = null;
  // Les écouteurs de wireDocEditing sont posés en DÉLÉGATION sur `doc` : ils
  // survivent au remplacement de son contenu et ne doivent donc être posés
  // qu'une fois, sinon une frappe déclencherait N enregistrements.
  let editionCablee = false;
  // Vrai dès que `pourImpression` reflète la donnée courante. rendre() le pose
  // juste après avoir composé ; onEdit() l'invalide dès qu'un caractère change.
  // rafraichirImprimable() s'en sert pour ne pas recomposer un document déjà à
  // jour : sans ce drapeau, rendre() composait une fois, puis bindDocPrint
  // appelait aussitôt refreshDocPrint -> avantClone -> une seconde composition
  // identique, à chaque ouverture du dossier.
  let imprimableAJour = false;

  function rendre() {
    const pages = composerImprimable();
    if (readOnly) {
      clear(doc);
      [...pourImpression.children].forEach((f) => doc.appendChild(f.cloneNode(true)));
    } else {
      fluxEdition = el("div", { class: "dp-flux" });
      fluxEdition.innerHTML = buildDpFlux(data, { edition: true, pages });
      clear(doc);
      doc.appendChild(fluxEdition);
      fillData(doc, data);
      if (!editionCablee) { wireDocEditing(doc, onEdit); editionCablee = true; }
      else applyEditable(doc);
      majCoupures();
    }
    // `doc` est le témoin de vie (toujours à l'écran tant que le dossier est
    // ouvert) ; `pourImpression`, lui, vit hors écran et n'est jamais détaché,
    // il ne peut donc pas servir de témoin (voir js/doc-officiel.js). En
    // édition, c'est quand même lui qui est cloné pour l'impression : c'est le
    // document paginé, pas le flux continu affiché au candidat.
    bindDocPrint(doc, { printId: "dp-print", bodyClass: "dp-printable",
      avantClone: readOnly ? null : rafraichirImprimable,
      source: readOnly ? null : pourImpression });
    requestAnimationFrame(rescale);
  }

  // Recompose le document imprimable sans toucher à ce que voit le candidat.
  // Rien à refaire si `pourImpression` est déjà à jour (voir imprimableAJour).
  function rafraichirImprimable() {
    if (imprimableAJour) return;
    const pages = composerImprimable();
    if (fluxEdition) {
      const ancien = fluxEdition.querySelector('[data-cle="sommaire"]');
      if (ancien) {
        const tmp = document.createElement("div");
        tmp.innerHTML = blocSommaire(data, pages);
        ancien.replaceWith(tmp.firstElementChild);
      }
    }
  }

  // Marque dans le ruban d'édition les endroits où le document changera de
  // feuille. On ne coupe rien : un champ réparti sur deux feuilles ne serait
  // plus éditable.
  function majCoupures() {
    if (!fluxEdition) return;
    const r = composer(blocsDe(fluxEdition), { hote: mesure, fabriquerFeuille });
    mesure.textContent = "";
    marquerCoupures(fluxEdition, r.numeroParBloc);
  }

  // Une fiche qui passe de vide à remplie, ou l'inverse, change seulement son
  // apparence et sa mention : le flux, lui, ne bouge pas. C'est ce qui garantit
  // que le curseur ne saute jamais pendant la frappe.
  function majExclusions() {
    if (!fluxEdition) return;
    for (const at of [1, 2]) {
      for (const n of [1, 2, 3]) {
        const exclu = !exempleImprime(data, at, n);
        fluxEdition.querySelectorAll(`[data-cle="exemple:${at}:${n}"]`)
          .forEach((b) => b.classList.toggle("dp-bloc-exclu", exclu));
        const m = fluxEdition.querySelector(`[data-cle="exemple:${at}:${n}"] .dp-mention-exclu`);
        if (m) m.hidden = !exclu;
      }
    }
  }

  let repaginationTimer = null;
  function onEdit() {
    // Le document imprimable ne reflète plus la saisie en cours.
    imprimableAJour = false;
    // collectData est la source de vérité : il omet les champs vides, donc vider
    // un champ le retire bien de data.
    data = collectData(fluxEdition);
    majExclusions();
    scheduleSave();
    // La repagination attend une pause de frappe : elle mesure tout le document,
    // et rien ne justifie de la refaire à chaque caractère.
    clearTimeout(repaginationTimer);
    repaginationTimer = setTimeout(() => {
      if (!document.contains(doc)) return;
      rafraichirImprimable();
      majCoupures();
    }, 700);
  }

  rendre();
  window.addEventListener("resize", rescale);

  // --- Autosave débouncé, même mécanique que le livret EPCF ---
  let saveTimer = null;
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
        data: collectData(fluxEdition),
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
  }
}
