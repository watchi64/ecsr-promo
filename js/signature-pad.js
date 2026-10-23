// Émargement (spec 2026-10-23) : la fenêtre de signature au doigt et le rendu d'une
// signature enregistrée. Les points sont gardés directement dans le repère 400 x 160 de
// js/emargement-rules.js : la zone peut changer de taille (rotation du téléphone) sans
// déformer le tracé, et le chemin envoyé est celui que le serveur vérifie.

import { el } from "./utils.js?v=20261023c";
import { REPERE, cheminDepuisTraits, traitsSuffisants } from "./emargement-rules.js?v=20261023c";

const SVG = "http://www.w3.org/2000/svg";
const EPAISSEUR = 3.2;   // en unités du repère : environ 0,3 mm sur une case de feuille

// Signature enregistrée → SVG à l'échelle de son conteneur (écran comme impression).
export function rendreSignature(trace, { classe = "sig-rendu", titre = "Signature" } = {}) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${REPERE.largeur} ${REPERE.hauteur}`);
  svg.setAttribute("class", classe);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", titre);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", trace || "");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", String(EPAISSEUR));
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

// Fenêtre plein écran : tracé, « Effacer », « Annuler », « Valider ». `valider(chemin)` est
// attendue : son erreur s'affiche dans la fenêtre, qui reste ouverte. Rend true si la
// signature a été enregistrée, false si la personne a annulé.
export function ouvrirSignature({ titre, attestation = null, valider, libelleValider = "Valider ma signature" }) {
  return new Promise((resolve) => {
    const traits = [];        // [[{x, y}…]…] en unités du repère
    let enCours = null;       // { id, trait } pendant un tracé
    let envoi = false;

    const canvas = el("canvas", { class: "sig-canvas", "aria-label": "Zone de signature : signe avec le doigt" });
    const invite = el("span", { class: "sig-invite", "aria-hidden": "true" }, "Signe ici");
    const zone = el("div", { class: "sig-zone" }, canvas, el("span", { class: "sig-ligne", "aria-hidden": "true" }), invite);
    const message = el("p", { class: "sig-message", role: "alert" });
    const effacer = el("button", { type: "button", class: "btn ghost" }, "Effacer");
    const annuler = el("button", { type: "button", class: "btn ghost" }, "Annuler");
    const ok = el("button", { type: "button", class: "btn primary" }, libelleValider);
    const fenetre = el("div", { class: "modal sig-modal", role: "dialog", "aria-modal": "true", "aria-label": titre, tabindex: "-1" },
      el("h3", {}, titre),
      attestation ? el("p", { class: "sig-attestation" }, attestation) : null,
      zone,
      message,
      el("div", { class: "modal-actions sig-actions" }, effacer, annuler, ok),
    );
    const fond = el("div", { class: "modal-backdrop sig-backdrop" }, fenetre);

    const ctx = canvas.getContext("2d");
    let echelle = 1;   // pixels du canvas par unité du repère

    function dimensionner() {
      const largeur = zone.clientWidth || 320;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(largeur * ratio);
      canvas.height = Math.round(largeur * REPERE.hauteur / REPERE.largeur * ratio);
      echelle = canvas.width / REPERE.largeur;
      redessiner();
    }

    function preparerTrait() {
      ctx.lineWidth = EPAISSEUR * echelle;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1F2924";
    }

    function redessiner() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      preparerTrait();
      for (const t of traits) {
        if (!t.length) continue;
        ctx.beginPath();
        ctx.moveTo(t[0].x * echelle, t[0].y * echelle);
        if (t.length === 1) ctx.lineTo(t[0].x * echelle + 0.01, t[0].y * echelle);
        for (const p of t.slice(1)) ctx.lineTo(p.x * echelle, p.y * echelle);
        ctx.stroke();
      }
    }

    function point(ev) {
      const r = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) / r.width * REPERE.largeur,
        y: (ev.clientY - r.top) / r.height * REPERE.hauteur,
      };
    }

    canvas.addEventListener("pointerdown", (ev) => {
      if (envoi || enCours) return;
      ev.preventDefault();
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* pointeur simulé */ }
      enCours = { id: ev.pointerId, trait: [point(ev)] };
      traits.push(enCours.trait);
      invite.hidden = true;
      message.textContent = "";
      redessiner();
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!enCours || ev.pointerId !== enCours.id) return;
      ev.preventDefault();
      const evenements = typeof ev.getCoalescedEvents === "function" ? ev.getCoalescedEvents() : [];
      const t = enCours.trait;
      const avant = t[t.length - 1];
      for (const e of (evenements.length ? evenements : [ev])) t.push(point(e));
      preparerTrait();
      ctx.beginPath();
      ctx.moveTo(avant.x * echelle, avant.y * echelle);
      for (const p of t.slice(t.indexOf(avant) + 1)) ctx.lineTo(p.x * echelle, p.y * echelle);
      ctx.stroke();
    });
    const finir = (ev) => {
      if (enCours && ev.pointerId === enCours.id) enCours = null;
    };
    canvas.addEventListener("pointerup", finir);
    canvas.addEventListener("pointercancel", finir);

    effacer.addEventListener("click", () => {
      if (envoi) return;
      traits.length = 0;
      enCours = null;
      invite.hidden = false;
      message.textContent = "";
      redessiner();
    });

    function fermer(resultat) {
      window.removeEventListener("resize", dimensionner);
      document.removeEventListener("keydown", surTouche);
      document.body.classList.remove("sig-ouverte");
      fond.remove();
      resolve(resultat);
    }
    function surTouche(ev) {
      if (ev.key === "Escape" && !envoi) fermer(false);
    }
    annuler.addEventListener("click", () => { if (!envoi) fermer(false); });

    ok.addEventListener("click", async () => {
      if (envoi) return;
      if (!traitsSuffisants(traits, REPERE)) {
        message.textContent = "Signature trop courte : signe dans le cadre, sur toute sa largeur.";
        return;
      }
      envoi = true;
      ok.disabled = true;
      effacer.disabled = true;
      annuler.disabled = true;
      const libelle = ok.textContent;
      ok.textContent = "Enregistrement…";
      try {
        await valider(cheminDepuisTraits(traits, REPERE));
        fermer(true);
      } catch (e) {
        envoi = false;
        ok.disabled = false;
        effacer.disabled = false;
        annuler.disabled = false;
        ok.textContent = libelle;
        message.textContent = e?.message || String(e);
      }
    });

    document.body.appendChild(fond);
    document.body.classList.add("sig-ouverte");
    window.addEventListener("resize", dimensionner);
    document.addEventListener("keydown", surTouche);
    dimensionner();
    fenetre.focus();
  });
}
