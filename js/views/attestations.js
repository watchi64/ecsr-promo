// Page Attestations (spec 2026-10-24), sous-page de l'Émargement (#/emargement/attestations),
// réservée aux formateurs, mêmes portes que la page Émargement (renderEmargement les tient) :
// pour une période, les heures de chaque stagiaire d'après les feuilles closes, puis son
// certificat de réalisation et son attestation d'assiduité, ou ceux de toute la promo.

import { listStagiaires, listEmargementPresences, getEnteteEmargement, getPromoCourante } from "../db.js?v=20261110e";
import { el, clear, toast, isoDate } from "../utils.js?v=20261110e";
import { isAdmin } from "../auth-admin.js?v=20261110e";
import { libelleDuree, jourDe } from "../emargement-rules.js?v=20261110e";
import { imprimer, nomComplet } from "../emargement-feuilles.js?v=20261110e";
import {
  bilanStagiaire, stagiairesDeLaPeriode, feuillesOuvertes, demiJourneesSansFeuille, periodeParDefaut,
  moisDeLaPeriode, seancesDeLaPromo, dateFr, datePeriodeValide, estAdresseAttestations,
} from "../attestations-rules.js?v=20261110e";
import { certificatRealisation, attestationAssiduite, liasse } from "../attestations-documents.js?v=20261110e";

// Période choisie, gardée par promo le temps de la visite (retour depuis la semaine).
const periodes = new Map();

// La page affichée est encore celle-ci : `estCourant()` (fourni par la page Émargement) devient
// faux quand elle se redessine, et l'adresse change quand on part ailleurs (le conteneur de vue
// est partagé par toutes les pages : une lecture lente ne doit rien y peindre).
const vivant = (ctx) => ctx.estCourant() && estAdresseAttestations(location.hash);

export async function renderAttestations(container, { estCourant = () => true, ouvrirEntete } = {}) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const promo = getPromoCourante();
  const aujourdhui = isoDate(new Date());
  const formation = periodeParDefaut(promo, aujourdhui);
  const ctx = {
    container, promo, aujourdhui, formation, estCourant, ouvrirEntete,
    periode: periodes.get(promo?.id) || { ...formation },
    charge: null, lecture: 0,
  };
  try {
    const [stagiairesTous, entete] = await Promise.all([listStagiaires({ includeInactive: true }), getEnteteEmargement()]);
    Object.assign(ctx, { stagiairesTous, entete });
    await charger(ctx);
  } catch (e) {
    if (!vivant(ctx)) return;
    clear(container);
    container.appendChild(el("p", { class: "em-alerte" }, "Lecture impossible : " + (e?.message || e)));
    return;
  }
  if (!vivant(ctx)) return;
  dessiner(ctx);
}

// Les feuilles de toute la formation sont lues une fois (sans tracés) ; une période qui en
// sort élargit la lecture, et la plage chargée ne rétrécit jamais (une lecture arrivée tard ne
// peut donc pas retirer les feuilles d'une période déjà affichée). Rend faux si une lecture plus
// récente a été demandée entre-temps : sa réponse fera foi.
async function charger(ctx) {
  const bornes = [ctx.periode, ctx.formation, ctx.charge].filter(Boolean);
  const du = bornes.map((b) => b.du).sort()[0];
  const au = bornes.map((b) => b.au).sort().at(-1);
  if (ctx.charge && ctx.charge.du <= du && ctx.charge.au >= au) return true;
  const numero = ++ctx.lecture;
  const seances = seancesDeLaPromo(await listEmargementPresences(du, au), ctx.promo?.id);
  if (numero !== ctx.lecture) return false;
  ctx.charge = { du, au, seances };
  return true;
}

function seancesDeLaPeriode(ctx) {
  const { du, au } = ctx.periode;
  return ctx.charge.seances.filter((s) => s.jour >= du && s.jour <= au);
}

// Saisie au clavier : le champ émet une date à chaque chiffre (« 0002-10-12 »…) ; seules les
// dates plausibles sont prises, et les champs ne sont jamais redessinés pendant la frappe.
async function changerPeriode(ctx, du, au, { depuisChamps = false } = {}) {
  if (!datePeriodeValide(du) || !datePeriodeValide(au)) return;
  ctx.periode = du <= au ? { du, au } : { du: au, au: du };
  periodes.set(ctx.promo?.id, ctx.periode);
  if (!depuisChamps) { ctx.champDu.value = ctx.periode.du; ctx.champAu.value = ctx.periode.au; }
  let aJour;
  try { aJour = await charger(ctx); } catch (e) {
    if (vivant(ctx)) toast("Lecture impossible : " + (e?.message || e), "error");
    return;
  }
  if (aJour && vivant(ctx)) dessinerCorps(ctx);
}

function dessiner(ctx) {
  const { container, promo } = ctx;
  clear(container);
  const page = el("section", { class: "em-page at-page" });
  ctx.page = page;
  container.appendChild(page);

  // La promo seule en surtitre, comme la page Émargement.
  const surtitre = promo?.nom || "";
  page.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      surtitre ? el("p", { class: "eyebrow" }, surtitre) : null,
      el("h2", {}, "Certificats et attestations"),
      el("p", { class: "subtitle" },
        "Heures comptées sur les feuilles d'émargement closes : une demi-journée signée compte pour sa durée "
        + "entière, une demi-journée non signée est une absence. Le certificat suit le modèle du ministère du Travail."),
    ),
  ));

  page.appendChild(el("div", { class: "em-barre" },
    el("div", { class: "em-barre-nav" },
      el("a", { class: "btn small", href: "#/emargement" }, "Feuilles de la semaine")),
    // La base n'accepte l'écriture des réglages que d'un administrateur : le bouton suit.
    isAdmin() ? el("div", { class: "em-barre-actions" },
      el("button", { class: "btn small", type: "button",
        onClick: () => ctx.ouvrirEntete?.({ entete: ctx.entete, promo }, { apres: (e) => { ctx.entete = e; } }) },
      "En-tête et signataire")) : null,
  ));

  page.appendChild(dessinerPeriode(ctx));
  ctx.corps = el("div", { class: "at-corps" });
  page.appendChild(ctx.corps);
  dessinerCorps(ctx);
}

// Tout ce qui dépend de la période : raccourcis, alertes, liste.
function dessinerCorps(ctx) {
  majRaccourcis(ctx);
  const page = ctx.corps;
  clear(page);
  const seances = seancesDeLaPeriode(ctx);
  const ouvertes = feuillesOuvertes(seances);
  // Jusqu'à la veille : la journée en cours n'a peut-être pas encore sa feuille.
  const veille = jourDe(ctx.aujourdhui, -1);
  const sansFeuille = demiJourneesSansFeuille(seances, ctx.periode.du, ctx.periode.au < veille ? ctx.periode.au : veille);
  if (ouvertes) {
    page.appendChild(el("p", { class: "em-alerte" },
      ouvertes > 1 ? `${ouvertes} feuilles encore ouvertes sur la période : non comptées tant qu'elles ne sont pas closes.`
        : "1 feuille encore ouverte sur la période : non comptée tant qu'elle n'est pas close."));
  }
  if (sansFeuille) {
    page.appendChild(el("p", { class: "muted at-sans-feuille" },
      `${sansFeuille} demi-journée${sansFeuille > 1 ? "s" : ""} de semaine sur la période sans feuille d'émargement `
      + "(stage, congés ou feuille oubliée) : non comptée" + (sansFeuille > 1 ? "s." : ".")));
  }

  const stagiaires = stagiairesDeLaPeriode(seances, ctx.stagiairesTous);
  if (stagiaires.length === 0) {
    page.appendChild(el("p", { class: "em-vide" }, "Aucune feuille d'émargement close sur cette période."));
    return;
  }
  const lignes = stagiaires.map((s) => ({ stagiaire: s, bilan: bilanStagiaire(seances, s.id) }));
  const avecHeures = lignes.filter((l) => l.bilan.demiSignees > 0);

  // Lecture (direction) : l'impression des pièces est offerte sur ordinateur.
  const surOrdinateur = isAdmin() ? "" : " solo-ordinateur";
  page.appendChild(el("div", { class: "at-tout" + surOrdinateur },
    el("button", { class: "btn small primary", type: "button", disabled: avecHeures.length === 0,
      onClick: () => imprimerPieces(ctx, avecHeures, certificat) }, `Tous les certificats (${avecHeures.length})`),
    el("button", { class: "btn small", type: "button",
      onClick: () => imprimerPieces(ctx, lignes, attestation) }, `Toutes les attestations (${lignes.length})`)));

  const ul = el("ul", { class: "em-liste at-liste" });
  for (const ligne of lignes) {
    const { stagiaire: s, bilan: b } = ligne;
    const btnCertificat = el("button", { class: "btn small", type: "button", disabled: b.demiSignees === 0,
      title: b.demiSignees === 0 ? "Aucune demi-journée signée sur la période" : "",
      onClick: () => imprimerPieces(ctx, [ligne], certificat) }, "Certificat");
    ul.appendChild(el("li", { class: "em-ligne at-ligne" },
      el("div", { class: "em-ligne-corps" },
        el("span", { class: "em-ligne-nom" }, nomComplet(s), s.actif ? null : el("span", { class: "at-parti" }, "ne suit plus la formation")),
        el("span", { class: "em-ligne-etat" },
          b.demiSignees ? `Du ${dateFr(b.premierSigne)} au ${dateFr(b.dernierSigne)}` : "Aucune demi-journée signée")),
      el("div", { class: "at-chiffres" },
        el("span", { class: "at-heures" }, `${libelleDuree(b.realiseesMin)} sur ${libelleDuree(b.prevuesMin)}`),
        el("span", { class: "at-detail" },
          (b.absencesMin ? `${libelleDuree(b.absencesMin)} d'absence` : "aucune absence") + ` · ${b.taux} %`)),
      el("div", { class: "em-ligne-actions" + surOrdinateur }, btnCertificat,
        el("button", { class: "btn small", type: "button", onClick: () => imprimerPieces(ctx, [ligne], attestation) }, "Attestation")),
    ));
  }
  page.appendChild(ul);
}

function dessinerPeriode(ctx) {
  const borne = { min: "2000-01-01", max: "2099-12-31" };
  const du = el("input", { type: "date", value: ctx.periode.du, ...borne, "aria-label": "Début de la période" });
  const au = el("input", { type: "date", value: ctx.periode.au, ...borne, "aria-label": "Fin de la période" });
  const appliquer = () => changerPeriode(ctx, du.value, au.value, { depuisChamps: true });
  du.addEventListener("change", appliquer);
  au.addEventListener("change", appliquer);
  Object.assign(ctx, { champDu: du, champAu: au, raccourcis: el("div", { class: "at-periode-raccourcis" }) });
  return el("div", { class: "at-periode" },
    el("div", { class: "at-periode-dates" },
      el("label", {}, "Du", du), el("label", {}, "Au", au)),
    ctx.raccourcis,
  );
}

function majRaccourcis(ctx) {
  const estPeriode = (p) => p.du === ctx.periode.du && p.au === ctx.periode.au;
  const raccourci = (libelle, p) => el("button", {
    class: "em-puce" + (estPeriode(p) ? " at-puce-active" : ""), type: "button", "aria-pressed": String(estPeriode(p)),
    onClick: () => changerPeriode(ctx, p.du, p.au),
  }, libelle);
  clear(ctx.raccourcis);
  ctx.raccourcis.append(raccourci("Toute la formation", ctx.formation),
    ...moisDeLaPeriode(ctx.charge.seances).map((m) => raccourci(m.libelle, m)));
}

const certificat = (ctx, { stagiaire, bilan }) => certificatRealisation({
  entete: ctx.entete, lieuDefaut: ctx.promo?.lieu_nom, stagiaire, bilan, faitLe: ctx.aujourdhui });
const attestation = (ctx, { stagiaire, bilan }) => attestationAssiduite({
  entete: ctx.entete, lieuDefaut: ctx.promo?.lieu_nom, promo: ctx.promo, stagiaire, bilan, faitLe: ctx.aujourdhui });

function imprimerPieces(ctx, lignes, fabrique) {
  if (lignes.length === 0) return;
  imprimer(liasse(lignes.map((l) => fabrique(ctx, l))), { ancre: ctx.page, page: "A4 portrait" });
}
