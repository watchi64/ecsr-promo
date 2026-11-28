// Accès support du fondateur (cloisonnement par organisme, spec 2026-11-27 § 5.4). Le fondateur est rattaché à son organisme au
// quotidien : ses promos, ses centres et ses réglages sont ceux-là. Pour aider un autre organisme, il ouvre un accès support : la
// base (ouvrir_acces_support) le borne à 2 heures, exige un motif et l'inscrit au journal ; l'app se recharge alors sur cet
// organisme, et un bandeau permanent le dit (js/nav-shell.js) avec « Fermer ». À l'échéance, la base rend l'organisme de rattachement
// au prochain chargement.
// Ce module porte la section « Accès support » des Réglages (js/views/config.js), visible du seul fondateur hors aperçu, et le geste
// de fermeture, partagé avec le bandeau. Règles pures (motif, texte du bandeau, liste) : js/organisme-rules.js.

import {
  lireMonOrganisme, lireOrganismesSupport, ouvrirAccesSupport, fermerAccesSupport, compterMesPromos, rechargerApresEnregistrements,
} from "../db.js?v=20261128c";
import { el, toast } from "../utils.js?v=20261128c";
import { icon } from "../icons.js?v=20261128c";
import { confirmer } from "../confirmer.js?v=20261128c";
import { fondateurHorsApercu } from "../auth-admin.js?v=20261128c";
import { phraseDeRefus } from "../espaces-rules.js?v=20261128c";
import { fonctionAbsente } from "../questionnaires-erreurs.js?v=20261128c";
import {
  motifSupportValide, MOTIF_SUPPORT_MIN, organismesProposes, supportEnCours, texteBandeauSupport, separerHeureBandeau,
} from "../organisme-rules.js?v=20261128c";

export const PHRASE_MOTIF_COURT = `Le motif doit compter au moins ${MOTIF_SUPPORT_MIN} caractères.`;
const PHRASE_SANS_PROMO = "Cet organisme n'a encore aucune promo : l'app ne peut pas s'y ouvrir. L'accès support a été refermé.";

// Le texte du bandeau en gras, l'heure finale dans un élément qui ne passe pas à la ligne (classe `support-heure`, css/navigation.css) :
// sur téléphone, « 12 » et « h 00 » ne se séparent plus. Partagé avec le bandeau de js/nav-shell.js.
export function texteSupportEnGras(texte) {
  const [debut, heure] = separerHeureBandeau(texte);
  return el("strong", {}, debut, heure ? el("span", { class: "support-heure" }, heure) : null);
}

// Ferme l'accès support après confirmation, puis recharge l'app sur l'organisme de rattachement (après les enregistrements en
// cours). `bouton` est désactivé pendant l'appel et rendu en cas de refus. Rend vrai quand le rechargement est lancé.
export async function fermerAccesSupportPuisRecharger(bouton) {
  if (bouton && bouton.disabled) return false;
  const oui = await confirmer({
    titre: "Fermer l'accès support ?",
    phrase: "L'app se recharge sur votre organisme.",
    oui: "Fermer l'accès", danger: false,
  });
  if (!oui) return false;
  if (bouton) bouton.disabled = true;
  try {
    await fermerAccesSupport();
  } catch (e) {
    console.warn("fermeture de l'accès support refusée", e && e.message);
    toast(phraseDeRefus(e?.message, e?.code), "error", 7000);
    if (bouton) bouton.disabled = false;
    return false;
  }
  toast("Accès support fermé.", "success");
  await rechargerApresEnregistrements();
  return true;
}

// Ouvre l'accès support (motif vérifié, puis confirmation), vérifie que l'organisme a au moins une promo (sans promo, l'app
// refuserait l'ouverture de la session : l'accès est refermé aussitôt et la phrase le dit), puis recharge l'app.
async function ouvrir({ bouton, choix, motif, organismes }) {
  if (bouton.disabled) return;
  const id = Number(choix.value);
  const cible = organismes.find((o) => o.id === id);
  if (!cible) { toast("Choisissez un organisme.", "error"); return; }
  if (!motifSupportValide(motif.value)) { toast(PHRASE_MOTIF_COURT, "error", 5000); motif.focus(); return; }
  const oui = await confirmer({
    titre: `Ouvrir un accès support à ${cible.nom} ?`,
    phrase: "L'app se recharge sur cet organisme pour 2 heures au plus. Le motif est inscrit au journal des accès. "
      + "Vous revenez à votre organisme avec « Fermer » dans le bandeau, ou à l'échéance.",
    oui: "Ouvrir l'accès", danger: false,
  });
  if (!oui) return;
  bouton.disabled = true;
  try {
    await ouvrirAccesSupport(id, motif.value.trim());
  } catch (e) {
    console.warn("ouverture de l'accès support refusée", e && e.message);
    toast(phraseDeRefus(e?.message, e?.code), "error", 7000);
    bouton.disabled = false;
    return;
  }
  let promos = null;
  try { promos = await compterMesPromos(); } catch (e) { promos = null; }
  if (promos === 0) {
    try { await fermerAccesSupport(); } catch (e) { console.warn("fermeture de l'accès support", e && e.message); }
    toast(PHRASE_SANS_PROMO, "error", 9000);
    bouton.disabled = false;
    return;
  }
  toast("Accès support ouvert.", "success");
  await rechargerApresEnregistrements();
}

// La section des Réglages : fondateur hors aperçu seulement (null sinon). Ses lectures ne retiennent pas la page : un échec se dit
// dans la section, avec « Réessayer ». Base d'avant le cloisonnement (fonction absente) : pas de section.
export async function renderAccesSupportSection(rerender) {
  if (!fondateurHorsApercu()) return null;
  const [organisme, liste] = await Promise.all([
    lireMonOrganisme(),
    lireOrganismesSupport().catch((e) => ({ erreur: e })),
  ]);
  if (liste && liste.erreur && fonctionAbsente(liste.erreur)) return null;
  const section = el("section", { class: "param-section", id: "param-acces-support" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.building()),
    el("div", {},
      el("h3", {}, "Accès support"),
      el("p", { class: "muted" }, "Réservé au fondateur : ouvrir l'app sur un autre organisme pour l'aider, 2 heures au plus."))));
  const bloc = el("div", { class: "param-block" });
  section.appendChild(bloc);

  if (liste && liste.erreur) {
    bloc.appendChild(el("p", { class: "muted", role: "alert" },
      "La liste des organismes n'a pas pu être lue. " + phraseDeRefus(liste.erreur?.message, liste.erreur?.code)));
    bloc.appendChild(el("button", { class: "btn small", type: "button", onClick: () => rerender() }, "Réessayer"));
    return section;
  }

  if (supportEnCours(organisme)) {
    const fermer = el("button", { class: "btn", type: "button" }, "Fermer l'accès support");
    fermer.addEventListener("click", () => fermerAccesSupportPuisRecharger(fermer));
    bloc.appendChild(el("p", { id: "acces-support-etat" }, texteSupportEnGras(texteBandeauSupport(organisme.nom, organisme.supportJusqua))));
    bloc.appendChild(fermer);
  } else {
    bloc.appendChild(el("p", { class: "muted", id: "acces-support-etat" },
      organisme.nom ? `Vous travaillez dans votre organisme, ${organisme.nom}.` : "Vous travaillez dans votre organisme."));
  }

  const organismes = organismesProposes(liste, organisme.id);
  if (!organismes.length) {
    bloc.appendChild(el("p", { class: "muted" }, "Aucun autre organisme n'utilise l'app pour l'instant."));
    return section;
  }
  const choix = el("select", { id: "acces-support-organisme" },
    el("option", { value: "" }, "Choisir…"),
    ...organismes.map((o) => el("option", { value: String(o.id) }, o.nom)));
  const motif = el("textarea", { id: "acces-support-motif", rows: "2", maxlength: "500",
    placeholder: "Ex. Aide au réglage des titres du centre" });
  const bouton = el("button", { class: "btn accent", type: "button" }, "Ouvrir un accès support");
  bouton.addEventListener("click", () => ouvrir({ bouton, choix, motif, organismes }));
  bloc.appendChild(el("div", { class: "support-form" },
    el("label", { for: "acces-support-organisme" }, "Organisme"), choix,
    el("label", { for: "acces-support-motif" }, "Motif"), motif,
    el("p", { class: "muted" }, `Obligatoire, ${MOTIF_SUPPORT_MIN} caractères au moins. Il est inscrit au journal des accès.`),
    bouton));
  return section;
}
