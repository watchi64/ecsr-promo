// Émargement (spec 2026-10-23) : bandeau en haut de l'app, quelle que soit la page.
// Stagiaire : une feuille du jour est ouverte et il n'a pas signé → « Signer ».
// Formateur : rappel de la feuille ouverte et du nombre de signatures → « Voir ».
// Relu au démarrage, à chaque changement de page, au retour au premier plan et toutes
// les 60 secondes quand l'app est visible. Aucune erreur affichée : ce n'est qu'un rappel.

import { getEmargementsOuverts, signerEmargement, listStagiaires } from "./db.js?v=20261022e";
import { el, clear, isoDate, toast } from "./utils.js?v=20261022e";
import { isAuth, isAdmin, isProf, monStagiaireId } from "./auth-admin.js?v=20261022e";
import { ouvrirSignature } from "./signature-pad.js?v=20261022e";
import { libelleCreneau, heureLocale, adresseSeance, resumeSeance } from "./emargement-rules.js?v=20261022e";
import { jourLong, DEMI_LONG, nomComplet } from "./emargement-feuilles.js?v=20261022e";

const INTERVALLE_MS = 60000;
let initialise = false;
let lecture = null;          // relecture en cours (une seule à la fois)
let signatureOuverte = false;
let confirmation = null;     // { heure, jusqua } après une signature réussie

export function initBandeauEmargement() {
  if (!initialise) {
    initialise = true;
    window.addEventListener("hashchange", () => rafraichirBandeauEmargement());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) rafraichirBandeauEmargement(); });
    setInterval(() => { if (!document.hidden) rafraichirBandeauEmargement(); }, INTERVALLE_MS);
  }
  return rafraichirBandeauEmargement();
}

function bandeau() {
  let b = document.getElementById("emargement-bandeau");
  if (!b) {
    const vue = document.getElementById("view");
    if (!vue) return null;
    b = el("div", { id: "emargement-bandeau", class: "em-bandeau", role: "status", "aria-live": "polite" });
    b.hidden = true;
    vue.parentNode.insertBefore(b, vue);
  }
  return b;
}

export function rafraichirBandeauEmargement() {
  if (lecture) return lecture;
  lecture = (async () => {
    const b = bandeau();
    if (!b) return;
    if (!isAuth() || signatureOuverte) { if (!signatureOuverte) b.hidden = true; return; }
    try {
      const jour = isoDate(new Date());
      const seances = await getEmargementsOuverts(jour);
      const actifs = (isAdmin() || isProf()) ? await listStagiaires() : [];
      dessiner(b, seances, actifs);
    } catch (e) {
      // Réseau ou table absente : pas de bandeau, rien d'autre ne change.
    }
  })().finally(() => { lecture = null; });
  return lecture;
}

const ordreDemi = (s) => (s.demi_journee === "matin" ? 0 : 1);

function dessiner(b, seances, actifs) {
  clear(b);
  b.className = "em-bandeau";
  if (confirmation && Date.now() < confirmation.jusqua) {
    b.classList.add("em-bandeau-ok");
    b.appendChild(el("p", {}, `Émargement signé à ${confirmation.heure}. Merci !`));
    b.hidden = false;
    setTimeout(() => rafraichirBandeauEmargement(), confirmation.jusqua - Date.now() + 50);
    return;
  }
  confirmation = null;
  const tries = [...seances].sort((a, z) => ordreDemi(a) - ordreDemi(z));
  const moi = monStagiaireId();

  // Stagiaire (le fondateur aussi, s'il a une fiche dans la promo) : signer d'abord.
  if (moi != null) {
    const aSigner = tries.find((s) => {
      const l = s.lignes.find((x) => x.stagiaire_id === moi);
      return !l || (!l.signe_le && !l.absent);
    });
    if (aSigner) {
      b.appendChild(el("p", {}, el("strong", {}, `Émargement du ${DEMI_LONG[aSigner.demi_journee]} ouvert`),
        ` (${libelleCreneau(aSigner)})`));
      b.appendChild(el("button", { class: "btn small primary", type: "button",
        onClick: () => signer(aSigner, moi) }, "Signer"));
      b.hidden = false;
      return;
    }
    const absent = tries.find((s) => s.lignes.some((x) => x.stagiaire_id === moi && x.absent));
    if (absent && !(isAdmin() || isProf())) {
      b.classList.add("em-bandeau-info");
      b.appendChild(el("p", {}, `Tu es noté absent sur la feuille du ${DEMI_LONG[absent.demi_journee]}. `
        + "Si tu es là, vois-le avec ton formateur."));
      b.hidden = false;
      return;
    }
  }

  // Formateur : rappel, sauf sur la page Émargement elle-même.
  if ((isAdmin() || isProf()) && tries.length) {
    const s = tries[0];
    const adresse = adresseSeance(s.jour, s.demi_journee);
    if (location.hash.startsWith("#/emargement")) { b.hidden = true; return; }
    const ids = new Set(actifs.map((x) => x.id));
    s.lignes.forEach((l) => ids.add(l.stagiaire_id));
    const lignes = s.lignes.map((l) => ({ ...l, trace: l.signe_le ? "signé" : null }));
    const r = resumeSeance(lignes, [...ids], false);
    b.classList.add("em-bandeau-info");
    b.appendChild(el("p", {}, el("strong", {}, `Émargement du ${DEMI_LONG[s.demi_journee]} ouvert`),
      ` : ${r.signes} sur ${r.total} ont signé`));
    b.appendChild(el("a", { class: "btn small", href: adresse }, "Voir"));
    b.hidden = false;
    return;
  }
  b.hidden = true;
}

async function signer(seance, moi) {
  if (signatureOuverte) return;
  signatureOuverte = true;
  try {
    const fiche = (await listStagiaires()).find((s) => s.id === moi);
    let heure = null;
    const ok = await ouvrirSignature({
      titre: "Émargement : " + nomComplet(fiche),
      attestation: `J'atteste avoir suivi la formation du ${jourLong(seance.jour).toLowerCase()}, `
        + `${DEMI_LONG[seance.demi_journee]} (${libelleCreneau(seance)}).`,
      valider: async (trace) => { heure = heureLocale(await signerEmargement(seance.id, moi, trace)); },
    });
    if (ok) {
      confirmation = { heure, jusqua: Date.now() + 4000 };
      toast("Signature enregistrée à " + heure + ".", "success");
    }
  } catch (e) {
    toast(e?.message || String(e), "error", 4000);
  } finally {
    signatureOuverte = false;
    rafraichirBandeauEmargement();
  }
}
