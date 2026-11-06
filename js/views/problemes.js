// Page « Problèmes signalés » (spec 2026-10-28, § 4.3) : les signalements envoyés depuis l'app, pour le
// fondateur seulement (hors aperçu « Voir en tant que » ; js/main.js ramène les autres ailleurs, la base ne
// leur rend de toute façon que les leurs). Sous-onglets À traiter, Réglés, Tous ; une carte par
// signalement : qui et quand, message, contexte (ligne et détail), capture à la demande, lien vers la page,
// statut en quatre boutons, réponse, suppression. Une action met la carte à jour sur place : elle ne change
// pas de sous-onglet avant le prochain affichage de la page.

import { el, clear, toast } from "../utils.js?v=20261029b";
import { fondateurHorsApercu } from "../auth-admin.js?v=20261029b";
import {
  listSignalementsApp, captureSignalementApp, traiterSignalementApp, supprimerSignalementApp,
} from "../db.js?v=20261029b";
import { chargerEtatSignalements } from "../signalement-etat.js?v=20261029b";
import { renderSubTabs } from "../subtabs.js?v=20261029b";
import {
  libelleStatut, resumeContexte, detailContexte, adresseSure, normaliserContexte,
} from "../signalement-rules.js?v=20261029b";

const STATUTS = ["nouveau", "en_cours", "regle", "non_retenu"];
const A_TRAITER = new Set(["nouveau", "en_cours"]);
const ROLES = { stagiaire: "Stagiaire", formateur: "Formateur", fondateur: "Fondateur" };

const deuxChiffres = (n) => String(n).padStart(2, "0");

// « 28/10/2026 à 10 h 42 »
function dateLongue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} à ${d.getHours()} h ${deuxChiffres(d.getMinutes())}`;
}

// Le détail du contexte, les erreurs techniques et l'identifiant brut du navigateur.
function detail(c) {
  const lignes = detailContexte(c).flatMap(([cle, valeur]) => [el("dt", {}, cle), el("dd", {}, String(valeur ?? ""))]);
  const erreurs = Array.isArray(c.erreurs) ? c.erreurs : [];
  return el("details", { class: "sg-detail" },
    el("summary", {}, "Voir le détail"),
    el("dl", { class: "sg-detail-liste" }, lignes),
    erreurs.length
      ? el("ul", { class: "sg-erreurs-tech" }, erreurs.map((e) => el("li", {}, `${e.a} ${e.message}${e.source ? ` (${e.source})` : ""}`)))
      : null,
    c.agent ? el("p", { class: "sg-agent" }, c.agent) : null);
}

// La capture, lue à la demande ; un toucher l'agrandit ou la réduit.
function zoneCapture(s, qui) {
  const voir = el("button", { type: "button", class: "btn ghost", "data-sg": "voir-capture" }, "Voir la capture");
  const zone = el("div", { class: "sg-carte-capture-zone" }, voir);
  voir.addEventListener("click", async () => {
    voir.disabled = true;
    try {
      const image = await captureSignalementApp(s.id);
      if (!image) {
        zone.replaceChildren(el("p", { class: "sg-vide" }, "Capture introuvable."));
        return;
      }
      const img = el("img", { src: image, alt: `Capture jointe par ${qui}`, class: "sg-carte-capture" });
      // Un vrai bouton : la capture s'agrandit et se réduit aussi au clavier.
      const agrandir = el("button", {
        type: "button", class: "sg-capture-bouton", "data-sg": "agrandir", "aria-pressed": "false", "aria-label": "Agrandir la capture",
      }, img);
      agrandir.addEventListener("click", () => {
        const grand = img.classList.toggle("grand");
        agrandir.setAttribute("aria-pressed", grand ? "true" : "false");
        agrandir.setAttribute("aria-label", grand ? "Réduire la capture" : "Agrandir la capture");
      });
      zone.replaceChildren(agrandir);
    } catch (e) {
      voir.disabled = false;
      zone.appendChild(el("p", { class: "sg-erreur", role: "alert" }, "La capture n'a pas pu être chargée."));
    }
  });
  return zone;
}

// Une carte qui ne peut pas se dessiner (donnée inattendue) ne fait jamais tomber la liste : à sa place, le
// message et « Supprimer ».
function carteSure(s) {
  try {
    return carte(s);
  } catch (e) {
    console.error("Problèmes signalés : carte simplifiée pour le signalement " + s?.id, e);
    const erreur = el("p", { class: "sg-erreur", role: "alert" });
    const supprimer = el("button", { type: "button", class: "btn ghost", "data-sg": "supprimer" }, "Supprimer");
    const noeud = el("article", { class: "sg-carte", "data-sg-id": String(s?.id ?? "") },
      el("p", { class: "sg-carte-contexte" }, "Ce signalement ne peut pas s'afficher en entier."),
      el("p", { class: "sg-carte-message" }, String(s?.message ?? "")),
      el("div", { class: "sg-carte-actions" }, supprimer), erreur);
    supprimer.addEventListener("click", async () => {
      if (!confirm("Supprimer ce signalement ? Il disparaît aussi chez la personne.")) return;
      try {
        await supprimerSignalementApp(s.id);
        noeud.remove();
        chargerEtatSignalements();
      } catch (err) {
        erreur.textContent = err.message || "La suppression n'a pas abouti.";
      }
    });
    return noeud;
  }
}

function carte(s) {
  const c = normaliserContexte(s.contexte);
  const qui = s.nom || s.email || "Quelqu'un";
  const erreur = el("p", { class: "sg-erreur", role: "alert" });
  let noeud = null;

  // Une action du fondateur : boutons gelés pendant l'appel ; réussie, la carte est redessinée avec le
  // nouvel état et la pastille relue ; ratée, la raison s'affiche sous les boutons.
  async function agir(action, maj, message) {
    noeud.querySelectorAll("button, textarea").forEach((b) => { b.disabled = true; });
    erreur.textContent = "";
    try {
      await action();
      Object.assign(s, maj);
      const neuf = carteSure(s);
      noeud.replaceWith(neuf);
      chargerEtatSignalements();
      toast(message, "success");
    } catch (e) {
      noeud.querySelectorAll("button, textarea").forEach((b) => { b.disabled = false; });
      erreur.textContent = e.message || "L'action n'a pas abouti.";
    }
  }

  const statuts = el("div", { class: "sg-statut-btns", role: "group", "aria-label": "Statut" },
    STATUTS.map((st) => {
      const b = el("button", {
        type: "button", class: "sg-statut-btn", "data-sg-statut": st, "aria-pressed": st === s.statut ? "true" : "false",
      }, libelleStatut(st, "fondateur"));
      // La réponse part avec le statut telle qu'elle est dans le champ : ce qui a été tapé sans
      // « Enregistrer la réponse » n'est pas perdu.
      b.addEventListener("click", () => {
        if (st === s.statut) return;
        agir(() => traiterSignalementApp(s.id, { statut: st, reponse: champ.value }),
          { statut: st, reponse: champ.value.trim() || null }, `Statut : ${libelleStatut(st, "fondateur")}.`);
      });
      return b;
    }));

  const champ = el("textarea", {
    class: "sg-champ sg-carte-reponse", rows: "3", "aria-label": `Réponse à ${qui}`,
    placeholder: "Ta réponse, que la personne lira dans « Signaler un problème » (facultatif)",
  });
  champ.value = s.reponse || "";
  const repondre = el("button", { type: "button", class: "btn primary", "data-sg": "repondre" }, "Enregistrer la réponse");
  repondre.addEventListener("click", () => agir(() => traiterSignalementApp(s.id, { statut: s.statut, reponse: champ.value }),
    { reponse: champ.value.trim() || null }, "Réponse enregistrée."));

  const supprimer = el("button", { type: "button", class: "btn ghost", "data-sg": "supprimer" }, "Supprimer");
  supprimer.addEventListener("click", async () => {
    if (!confirm("Supprimer ce signalement ? Il disparaît aussi chez la personne.")) return;
    erreur.textContent = "";
    try {
      await supprimerSignalementApp(s.id);
      noeud.remove();
      chargerEtatSignalements();
      toast("Signalement supprimé.", "success");
    } catch (e) {
      erreur.textContent = e.message || "La suppression n'a pas abouti.";
    }
  });

  const adresse = adresseSure(c.adresse);
  const ligneContexte = c.appareil
    ? [resumeContexte(c, new Date(s.created_at)), `version ${c.version || "inconnue"}`,
      `navigation ${c.navigation === "nouvelle" ? "nouvelle" : "ancienne"}`].join(" · ")
    : "Aucun contexte joint.";

  noeud = el("article", { class: "sg-carte", "data-sg-id": String(s.id) },
    el("div", { class: "sg-carte-tete" },
      el("span", { class: "sg-carte-qui" }, el("b", {}, qui),
        [ROLES[s.role], s.promo?.nom].filter(Boolean).length ? ` · ${[ROLES[s.role], s.promo?.nom].filter(Boolean).join(" · ")}` : ""),
      el("span", { class: "sg-carte-date" }, dateLongue(s.created_at)),
      el("span", { class: "sg-statut sg-statut-" + s.statut }, libelleStatut(s.statut, "fondateur"))),
    el("p", { class: "sg-carte-message" }, s.message),
    el("p", { class: "sg-carte-contexte" }, ligneContexte),
    detail(c),
    s.avec_capture ? zoneCapture(s, qui) : null,
    adresse ? el("a", { href: adresse, class: "sg-carte-lien" }, "Ouvrir la page") : null,
    statuts,
    el("div", { class: "sg-carte-repondre" }, champ, el("div", { class: "sg-carte-actions" }, repondre, supprimer)),
    erreur);
  return noeud;
}

export async function renderProblemes(container) {
  clear(container);
  if (!fondateurHorsApercu()) {
    container.appendChild(el("p", { class: "muted" }, "Page réservée à l'éditeur."));
    return;
  }
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const liste = await listSignalementsApp();
  clear(container);
  const aTraiter = liste.filter((s) => A_TRAITER.has(s.statut));
  const regles = liste.filter((s) => !A_TRAITER.has(s.statut));
  const panneau = (items, vide) => (p) => {
    p.replaceChildren(items.length ? el("div", { class: "sg-cartes" }, items.map(carteSure)) : el("p", { class: "sg-vide" }, vide));
  };
  container.appendChild(el("section", { class: "sg-page" },
    el("div", { class: "view-header" },
      el("h1", {}, "Problèmes signalés"),
      el("p", { class: "muted" }, "Signalements envoyés depuis l'app par les stagiaires et les formateurs. Toi seul les vois.")),
    renderSubTabs([
      { key: "a-traiter", label: `À traiter (${aTraiter.length})`,
        render: panneau(aTraiter, "Rien à traiter. Les signalements des stagiaires et des formateurs arriveront ici.") },
      { key: "regles", label: `Réglés (${regles.length})`, render: panneau(regles, "Aucun signalement réglé pour l'instant.") },
      { key: "tous", label: `Tous (${liste.length})`, render: panneau(liste, "Aucun signalement pour l'instant.") },
    ], { storageKey: "problemes.subtab" })));
}
