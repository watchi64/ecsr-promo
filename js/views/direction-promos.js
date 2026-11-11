// Page Promos de la direction (lot 5, Task 8) : une carte par promo du centre (nom, dates, état, effectif, formateurs, part de la
// formation écoulée), les gestes « Modifier » (nom, dates) et « Modules », et « Créer une promo ». Les règles (validation, état,
// part écoulée) vivent dans js/direction-rules.js ; ici, l'affichage et les écritures. Le centre affiché est celui du compte
// (getCentre) : les promos d'un autre centre ne sont jamais montrées. Un refus de la base se dit dans la fenêtre, par sa phrase
// (phraseDeRefus), la saisie gardée.

import {
  getMesPromos, getPromoCourante, ouvrirDansUnePromo, creerPromo, modifierDatesPromo, renommerPromo, chargerMesPromos, choisirPromo,
  rechargerApresEnregistrements,
  lireEffectifsPromos, lireFormateursPromos,
} from "../db.js?v=20261111e";
import { el, clear, isoDate, formatLongDate, toast } from "../utils.js?v=20261111e";
import { getCentre, getAffectations, getAdminEmail } from "../auth-admin.js?v=20261111e";
import { promosDuCentre, phraseDeRefus } from "../espaces-rules.js?v=20261111e";
import { validerPromo, etatPromo, partEcoulee } from "../direction-rules.js?v=20261111e";
import { peutRegler } from "../modules-etat.js?v=20261111e";
import { renderModulesSection } from "./modules-reglage.js?v=20261111e";
import { entier, pluriel } from "../nombres.js?v=20261111e";

const PHRASE_SANS_CENTRE = "Ce compte ne dirige aucun centre.";
const PHRASE_SANS_PROMO = "Ce centre n'a pas encore de promo";
const PHRASE_NON_CHARGEES = "Les promos du centre n'ont pas pu être chargées.";
// Le geste « Modules » d'une autre promo : l'app se recharge sur cette promo, la page rouvre alors ses modules.
const CLE_MODULES_A_OUVRIR = "ecsr_promos_modules";

let rendu = 0;
// Après « Modifier » enregistré : la carte dont le bouton reprend le focus, et si le panneau Modules était ouvert.
let restauration = null;
// Le panneau Modules est-il ouvert dans la page affichée (l'état est lu dans la page : la fenêtre ouverte survit aux redessins).
const modulesDeLaPage = () => !!document.querySelector(".promo-modules");

// La clé porte l'id de la promo et l'heure du geste : au-delà d'une minute elle ne vaut plus (un rechargement tardif ou une autre
// visite de la page n'ouvre rien).
const VALIDITE_CLE_MS = 60000;
function lireCle() {
  try {
    const brut = JSON.parse(sessionStorage.getItem(CLE_MODULES_A_OUVRIR) || "null");
    return brut && Number.isFinite(brut.id) && Number.isFinite(brut.t) ? brut : null;
  } catch (e) { return null; }
}
function poserCle(id) {
  try {
    if (id == null) sessionStorage.removeItem(CLE_MODULES_A_OUVRIR);
    else sessionStorage.setItem(CLE_MODULES_A_OUVRIR, JSON.stringify({ id, t: Date.now() }));
  } catch (e) { /* navigation privée */ }
}

// Les promos du centre dirigé, la plus récente d'abord ; `affichee` : la promo affichée si elle est de ce centre.
function contexte() {
  const centre = getCentre();
  if (!centre) return { centre: null, promos: [], affichee: null };
  const promos = promosDuCentre(getMesPromos(), centre.id)
    .slice().sort((a, b) => String(b.date_debut || "").localeCompare(String(a.date_debut || "")) || a.id - b.id);
  const courante = getPromoCourante();
  return { centre, promos, affichee: courante && courante.lieu_id === centre.id ? courante : null };
}

// Les centres où l'on peut créer une promo : ceux que le compte dirige ; le centre affiché d'abord (en aperçu, le seul).
function centresDirigeables(centre) {
  const vus = new Map([[centre.id, centre.nom]]);
  for (const a of getAffectations()) {
    if (a.role === "direction" && a.lieu_id != null && !vus.has(a.lieu_id)) vus.set(a.lieu_id, a.lieu_nom || "Centre " + a.lieu_id);
  }
  return [...vus].map(([id, nom]) => ({ id, nom }));
}

function periode(p) {
  if (!p.date_debut) return "Dates non renseignées";
  return p.date_fin ? `Du ${formatLongDate(p.date_debut, { sansJour: true })} au ${formatLongDate(p.date_fin, { sansJour: true })}` : `Depuis le ${formatLongDate(p.date_debut, { sansJour: true })} (fin non fixée)`;
}

// ============================================================== Fenêtre : créer, modifier

// Fenêtre de saisie d'une promo. `promo` nul : création (avec le choix du centre s'il y en a plusieurs). `enregistrer(valeurs)` rend une
// promesse : si elle lève, la phrase de refus s'affiche dans la fenêtre et la saisie reste ; sinon la fenêtre se ferme.
function ouvrirFenetre({ titre, promo, centres, ancre, libelleBouton, enregistrer }) {
  const champNom = el("input", { type: "text", id: "promo-nom", value: promo ? promo.nom : "", autocomplete: "off", maxlength: "120" });
  const champDebut = el("input", { type: "date", id: "promo-debut", value: promo?.date_debut || "" });
  const champFin = el("input", { type: "date", id: "promo-fin", value: promo?.date_fin || "" });
  const choixCentre = !promo && centres.length > 1
    ? el("select", { id: "promo-centre" }, ...centres.map((c) => el("option", { value: String(c.id) }, c.nom))) : null;
  const message = el("p", { class: "promo-refus", role: "alert" });
  const annuler = el("button", { class: "btn ghost", type: "button" }, "Annuler");
  const valider = el("button", { class: "btn primary", type: "submit" }, libelleBouton);
  const fond = el("div", { class: "modal-backdrop" });

  const fermer = () => {
    document.removeEventListener("keydown", auClavier, true);
    fond.remove();
    if (ancre && ancre.isConnected) ancre.focus({ preventScroll: true });
  };
  function auClavier(e) {
    if (e.key === "Escape") { e.stopPropagation(); if (!valider.disabled) fermer(); }
  }
  annuler.addEventListener("click", () => { if (!valider.disabled) fermer(); });

  const formulaire = el("form", { class: "modal-form", novalidate: "" },
    el("div", { class: "field" }, el("label", { for: "promo-nom" }, "Nom de la promo"), champNom),
    el("div", { class: "field-pair" },
      el("div", { class: "field" }, el("label", { for: "promo-debut" }, "Début"), champDebut),
      el("div", { class: "field" }, el("label", { for: "promo-fin" }, "Fin (facultative)"), champFin)),
    choixCentre ? el("div", { class: "field" }, el("label", { for: "promo-centre" }, "Centre"), choixCentre) : null,
    message,
    el("div", { class: "modal-actions" }, annuler, valider));
  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (valider.disabled) return;
    const valeurs = {
      nom: champNom.value.trim(), debut: champDebut.value, fin: champFin.value,
      lieuId: choixCentre ? Number(choixCentre.value) : (centres[0] ? centres[0].id : null),
    };
    const refus = validerPromo(valeurs);
    if (refus) { message.textContent = refus; return; }
    message.textContent = "";
    valider.disabled = true;
    annuler.disabled = true;
    try {
      await enregistrer(valeurs);
      fermer();
    } catch (err) {
      console.error(err);
      message.textContent = (err && err.phrase) || phraseDeRefus(err && err.message, err && err.code);
      valider.disabled = false;
      annuler.disabled = false;
    }
  });
  fond.appendChild(el("div", { class: "modal promo-fenetre", role: "dialog", "aria-modal": "true", "aria-labelledby": "promo-fenetre-titre" },
    el("h3", { id: "promo-fenetre-titre" }, titre), formulaire));
  document.addEventListener("keydown", auClavier, true);
  document.body.appendChild(fond);
  champNom.focus();
}

// ============================================================== Page

function carte(p, { aujourdhui, affichee, effectif, formateurs, formateursLus, modulesOuverts, surModules, surModifier }) {
  const etat = etatPromo(p, aujourdhui);
  const part = partEcoulee(p, aujourdhui);
  const memeP = affichee && affichee.id === p.id;
  const lignes = [];

  lignes.push(el("div", { class: "promo-carte-tete" },
    el("h4", {}, p.nom),
    el("span", { class: "chip promo-etat promo-etat-" + (etat === "en cours" ? "cours" : etat === "à venir" ? "venir" : "fin") }, etat),
    memeP ? el("span", { class: "chip centre-promo" }, "Affichée") : null));
  lignes.push(el("p", { class: "centre-detail" }, periode(p)));

  const effectifTexte = effectif === undefined || effectif === null ? "Effectif illisible"
    : `${pluriel(effectif.enFormation, "stagiaire")} en formation${effectif.abandons ? ` · ${pluriel(effectif.abandons, "abandon")}` : ""}`;
  lignes.push(el("p", { class: "promo-ligne" }, el("span", { class: "promo-etiquette" }, "Effectif"), effectifTexte));
  const noms = formateurs || [];
  const formateursTexte = !formateursLus ? "Formateurs illisibles" : noms.length ? noms.join(", ") : "Aucun formateur";
  lignes.push(el("p", { class: "promo-ligne" }, el("span", { class: "promo-etiquette" }, "Formateurs"), formateursTexte));

  if (part === null) {
    lignes.push(el("p", { class: "promo-ligne" }, el("span", { class: "promo-etiquette" }, "Formation"),
      p.date_fin ? "Dates incomplètes" : "Fin non fixée : part écoulée non calculée"));
  } else {
    lignes.push(el("div", { class: "promo-ligne promo-avancement" },
      el("span", { class: "promo-etiquette" }, "Formation"),
      el("span", { class: "promo-barre", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(part),
        "aria-label": `${part} % de la formation écoulée` }, el("span", { class: "promo-barre-remplie", style: `width:${part}%` })),
      el("span", { class: "promo-pct" }, `${part} % écoulée`)));
  }

  const actions = el("div", { class: "promo-actions" },
    el("button", { class: "btn small", type: "button", onClick: (e) => surModifier(p, e.currentTarget) }, "Modifier"),
    peutRegler() ? el("button", { class: "btn small", type: "button", "aria-expanded": memeP ? String(modulesOuverts) : "false",
      onClick: (e) => surModules(p, e.currentTarget) }, "Modules") : null);
  lignes.push(actions);
  return el("article", { class: "centre-carte promo-carte", "data-promo": String(p.id) }, ...lignes);
}

export async function renderPromosCentre(container, reprise = null) {
  const jeton = ++rendu;
  if (reprise) restauration = { promoId: reprise.promoId, modules: reprise.gardeModules };
  clear(container);
  const { centre, promos } = contexte();
  if (!centre) {
    container.appendChild(el("p", { class: "muted" }, PHRASE_SANS_CENTRE));
    return;
  }
  const racine = el("div", { class: "centre" });
  container.appendChild(racine);
  const aujourdhui = isoDate(new Date());
  const centres = centresDirigeables(centre);

  const surCreer = (e) => ouvrirFenetre({
    titre: "Créer une promo", promo: null, centres, ancre: e.currentTarget, libelleBouton: "Créer la promo",
    enregistrer: (v) => creation(v, container),
  });
  const boutonCreer = el("button", { class: "btn primary", type: "button", onClick: surCreer }, "Créer une promo");
  const entete = (liste) => el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Centre de " + (centre.nom || "")),
      el("h2", {}, "Promos"),
      el("p", { class: "subtitle" }, liste.length
        ? `${pluriel(liste.length, "promo")} · ${liste.filter((p) => etatPromo(p, aujourdhui) === "en cours").length} en cours`
        : "Aucune promo pour le moment")),
    el("div", { class: "centre-actions" }, boutonCreer));
  racine.appendChild(entete(promos));

  if (!promos.length) {
    racine.appendChild(el("div", { class: "centre-section centre-vide" },
      el("p", {}, PHRASE_SANS_PROMO + "."),
      el("p", { class: "muted" }, "Créez la première promo du centre : elle s'affichera ensuite dans toute l'app.")));
    return;
  }

  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  const ids = promos.map((p) => p.id);
  const [effectifs, formateurs] = await Promise.all([lireEffectifsPromos(ids), lireFormateursPromos(ids)]);
  if (jeton !== rendu) return;
  // Rafraîchissement après une écriture : la fenêtre ouverte reste sur ses nœuds, la page repart de l'état de l'app.
  const { promos: promosFraiches, affichee } = contexte();
  const liste = promosFraiches.length ? promosFraiches : promos;
  clear(racine);
  racine.appendChild(entete(liste));

  const grille = el("div", { class: "promo-grille" });
  racine.appendChild(grille);
  let zoneModules = null;
  let modulesOuverts = false;

  const fermerModules = () => {
    if (zoneModules) zoneModules.remove();
    zoneModules = null;
    modulesOuverts = false;
    grille.querySelectorAll("[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  };
  const ouvrirModules = (p, bouton) => {
    const section = renderModulesSection();
    fermerModules();
    if (!section) {
      toast("Vous ne pouvez pas régler les modules de cette promo.", "error", 4000);
      return;
    }
    zoneModules = el("div", { class: "promo-modules" }, section);
    grille.querySelector(`[data-promo="${p.id}"]`).after(zoneModules);
    modulesOuverts = true;
    if (bouton) bouton.setAttribute("aria-expanded", "true");
  };
  const surModules = async (p, bouton) => {
    if (affichee && p.id === affichee.id) {
      if (modulesOuverts) fermerModules(); else ouvrirModules(p, bouton);
      return;
    }
    // Une autre promo : elle devient la promo affichée, l'app se recharge sur cette page et rouvre ses modules.
    poserCle(p.id);
    const phrase = await ouvrirDansUnePromo(p.id, "#/promos");
    if (phrase) { poserCle(null); toast(phrase, "error", 4000); }
  };
  const surModifier = (p, ancre) => ouvrirFenetre({
    titre: "Modifier la promo", promo: p, centres, ancre, libelleBouton: "Enregistrer",
    enregistrer: async (v) => {
      restauration = { promoId: p.id, modules: modulesDeLaPage() };
      try {
        await modification(p, v);
      } catch (e) {
        restauration = null;
        // Dates enregistrées, nom refusé : les cartes montrent déjà les nouvelles dates, la fenêtre reste avec le nom saisi.
        if (e && e.phrase) await renderPromosCentre(container, { gardeModules: modulesDeLaPage(), promoId: p.id });
        throw e;
      }
      await renderPromosCentre(container);
    },
  });

  for (const p of liste) {
    grille.appendChild(carte(p, {
      aujourdhui, affichee, effectif: effectifs.get(p.id), formateurs: formateurs ? formateurs.get(p.id) : null,
      formateursLus: !!formateurs, modulesOuverts, surModules, surModifier,
    }));
  }
  // Arrivée après le geste « Modules » d'une autre promo : ses modules s'ouvrent d'eux-mêmes, une seule fois.
  const cle = lireCle();
  if (cle) {
    poserCle(null);
    if (Date.now() - cle.t <= VALIDITE_CLE_MS && affichee && affichee.id === cle.id && peutRegler()) {
      ouvrirModules(affichee, grille.querySelector(`[data-promo="${affichee.id}"] button[aria-expanded]`));
    }
  }
  // Après « Modifier » : panneau Modules rouvert s'il l'était, focus rendu au bouton « Modifier » de la même carte.
  if (restauration) {
    const { promoId, modules } = restauration;
    restauration = null;
    if (modules && affichee && peutRegler() && !zoneModules) {
      ouvrirModules(affichee, grille.querySelector(`[data-promo="${affichee.id}"] button[aria-expanded]`));
    }
    const modifier = grille.querySelector(`[data-promo="${promoId}"] .promo-actions button`);
    if (modifier) modifier.focus({ preventScroll: true });
  }
}

// La base décide : le nom par la règle de modification de la promo, les dates par modifier_dates_promo. Dates d'abord (la base
// refuse une fin avant le début) ; si le nom échoue ensuite, la phrase le dit et les dates sont déjà enregistrées.
async function modification(p, v) {
  const datesChangees = (v.debut || null) !== (p.date_debut || null) || (v.fin || null) !== (p.date_fin || null);
  if (datesChangees) await modifierDatesPromo({ promoId: p.id, debut: v.debut, fin: v.fin });
  if (v.nom !== p.nom) {
    try {
      await renommerPromo(p.id, v.nom);
    } catch (e) {
      if (!datesChangees) throw e;
      const erreur = new Error(e && e.message);
      erreur.phrase = "Les dates sont enregistrées, pas le nom. " + phraseDeRefus(e && e.message, e && e.code);
      throw erreur;
    }
  }
  toast("Promo mise à jour", "success");
}

// Création : la première promo d'un centre (ou d'un compte sans aucune promo) devient la promo affichée ; la bascule recharge l'app
// et relit modules, émargement et pastille. Sinon la page se redessine.
async function creation(v, container) {
  const avant = getMesPromos();
  const premiereDuCentre = promosDuCentre(avant, v.lieuId).length === 0;
  const id = await creerPromo({ lieuId: v.lieuId, nom: v.nom, debut: v.debut, fin: v.fin });
  let rechargees = null;
  try { rechargees = await chargerMesPromos(getAdminEmail()); } catch (e) { console.error("promos : rechargement après création", e); }
  if (rechargees === null) {
    toast("Promo créée. " + PHRASE_NON_CHARGEES + " Rechargez la page.", "error", 6000);
    return;
  }
  toast("Promo créée", "success");
  if (premiereDuCentre || avant.length === 0) {
    // chargerMesPromos a déjà posé la promo créée comme promo affichée quand elle est la seule du compte : choisirPromo ne
    // rechargerait alors rien (même promo), et l'app garderait ses modules, son émargement et sa pastille d'avant la promo.
    if (getPromoCourante()?.id === id) await rechargerApresEnregistrements();
    else await choisirPromo(id);
    return;
  }
  const { centre } = contexte();
  if (centre && centre.id !== v.lieuId) {
    const autre = centresDirigeables(centre).find((c) => c.id === v.lieuId);
    toast(`Promo créée dans le centre ${autre ? autre.nom : "choisi"}. Choisissez-la dans le menu des promos pour la voir.`, "success", 6000);
    return;
  }
  await renderPromosCentre(container);
}
