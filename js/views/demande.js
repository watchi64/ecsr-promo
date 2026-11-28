// Suivi d'une demande de l'espace contact : #/contacts/<id> (stagiaire) et #/messages/<id> (équipe, direction). Les étapes avec leur nom et
// leur heure, les destinataires, les échanges, puis les gestes que la base autorise (`peut`, lu en base : répondre, pris en compte,
// annuler ; les réponses toutes faites et les envois en échec pour l'équipe). Ouvrir la demande la marque lue. La base reste juge : ses
// refus se disent par leur phrase. Équipe vouvoyée, stagiaire tutoyé. Aucun défilement de côté.

import { detailDemande, marquerLue, repondre, prendreEnCompte, annulerDemande, relancerEnvoi, reglerJustificatif } from "../db.js?v=20261128c";
import { el, clear, toast } from "../utils.js?v=20261128c";
import { icon } from "../icons.js?v=20261128c";
import { vueStagiaire, selonPublic } from "../auth-admin.js?v=20261128c";
import { confirmer } from "../confirmer.js?v=20261128c";
import { dateHeure } from "../dates.js?v=20261128c";
import { TYPES_DEMANDE, etapesDemande, libelleDestinataire, phraseContact } from "../contact-rules.js?v=20261128c";
import { libelleAbsence, libelleDesJours, mailtoJustificatif, adresseJustificatif, LIBELLES_MOTIF } from "../contact-absences-rules.js?v=20261128c";

const PHRASE_ECHEC_LECTURE = "Cette demande n'a pas pu être chargée.";
const LIBELLES_ETAPE = { envoyee: "Envoyée", lue: "Lue", prise: "Prise en compte", annulee: "Annulée" };
const LIBELLES_ANNEXE = { formateur_du_jour: "formateur du jour", delegue: "délégué" };
const LIBELLES_JUSTIFICATIF = { a_remettre: "Justificatif à remettre", recu: "Justificatif reçu" };
const PHRASE_SANS_ADRESSE = "Remets ton justificatif au centre.";

let rendu = 0;

// Dit à la barre que le compteur de Messages a pu changer (js/nav-shell.js l'écoute).
const direALaBarre = () => window.dispatchEvent(new CustomEvent("messages-change"));

// Une ligne de liste de demandes (Messages, Mes demandes) : le suivi s'ouvre par un lien.
export function ligneDemande(l, route) {
  const marques = [];
  if (l.non_lue) marques.push(el("span", { class: "contact-pastille demande-pastille-neuve" }, "Nouvelle"));
  if (l.envoi_en_echec) marques.push(el("span", { class: "contact-pastille demande-pastille-echec" }, "E-mail non parti"));
  if (l.etat === "annulee") marques.push(el("span", { class: "contact-pastille" }, "Annulée"));
  else if (l.etat === "prise") marques.push(el("span", { class: "contact-pastille" }, "Prise en compte"));
  const quand = dateHeure(l.dernier_echange_le ?? l.cree_le);
  // Une absence n'a pas de sujet : ses jours en tiennent lieu.
  const sujet = l.sujet || (l.type === "absence" && libelleDesJours(l.jours)) || "Sans sujet";
  return el("li", { class: "demande-ligne" + (l.non_lue ? " demande-neuve" : ""), dataset: { demande: String(l.id) } },
    el("a", { class: "demande-lien", href: `#/${route}/${l.id}` },
      el("span", { class: "demande-haut" },
        el("span", { class: "demande-type" }, TYPES_DEMANDE[l.type] ?? l.type),
        ...marques),
      el("span", { class: "demande-sujet" }, sujet),
      el("span", { class: "demande-sous" }, [l.auteur_nom, quand].filter(Boolean).join(" · "))));
}

const boiteErreur = (phrase, reessayer) => el("div", { class: "contact-erreur", role: "alert" },
  el("p", {}, phrase), el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));

// La section « Absence » du suivi : le jour et le moment, le motif (s'il n'a pas été effacé), l'état du justificatif. Le stagiaire qui doit le remettre a
// « Envoyer mon justificatif » (un courriel au premier destinataire joignable, sinon la phrase de remise au centre) ; l'équipe règle
// son état (« Justificatif à remettre », « Justificatif reçu »). Les gestes viennent de `peut.justificatif` (la base).
function sectionAbsence(absence, detail, peut, d, id, relire, echouer) {
  const lignes = [["Quand", libelleAbsence({ ...absence })], absence.motif ? ["Motif", LIBELLES_MOTIF[absence.motif] ?? absence.motif] : null,
    absence.justificatif ? ["Justificatif", LIBELLES_JUSTIFICATIF[absence.justificatif] ?? absence.justificatif] : null].filter(Boolean);
  const gestes = [];
  let phrase = null;
  if (peut.justificatif && d.mon_role === "auteur") {
    const lien = mailtoJustificatif({ email: adresseJustificatif(detail.destinataires), ...absence });
    if (lien) gestes.push(el("a", { class: "btn", href: lien }, icon.mail(), "Envoyer mon justificatif"));
    else phrase = PHRASE_SANS_ADRESSE;
  } else if (peut.justificatif) {
    for (const [etat, libelle] of [["a_remettre", "Justificatif à remettre"], ["recu", "Justificatif reçu"]]) {
      if (absence.justificatif === etat) continue;
      gestes.push(el("button", { class: "btn", type: "button", onClick: async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true;
        try { await reglerJustificatif(id, etat); toast(libelle + ".", "success", 1800); await relire(); } catch (e) { echouer(e); b.disabled = false; }
      } }, libelle));
    }
  }
  return el("section", { class: "contact-section demande-absence", "aria-labelledby": "demande-absence-titre" },
    el("h3", { id: "demande-absence-titre", class: "contact-section-titre" }, "Absence"),
    el("dl", { class: "contact-detail" }, ...lignes.map(([t, v]) => el("div", { class: "contact-ligne" }, el("dt", {}, t), el("dd", {}, v)))),
    phrase ? el("p", { class: "contact-aide demande-sans-adresse" }, phrase) : null,
    gestes.length ? el("div", { class: "contact-gestes-fiche" }, ...gestes) : null);
}

export async function renderDemande(container, id) {
  const jeton = ++rendu;
  // Où se lit le suivi : Contacts dans l'espace du stagiaire, Messages dans celui de l'équipe (un compte cumulé y suit l'espace).
  const route = vueStagiaire() ? "contacts" : "messages";
  const retourLibelle = vueStagiaire() ? "Contacts" : "Messages";
  clear(container);
  const racine = el("div", { class: "contacts-page demande-page" });
  container.appendChild(racine);
  const retour = el("a", { class: "btn small ghost demande-retour", href: "#/" + route }, "← " + retourLibelle);
  const entete = (type, sujet, sous) => el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      type ? el("p", { class: "eyebrow" }, type) : null,
      el("h2", { tabindex: "-1" }, sujet || "Demande"),
      sous ? el("p", { class: "subtitle" }, sous) : null));
  racine.appendChild(retour);
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));

  let detail;
  try {
    detail = await detailDemande(id);
  } catch (e) {
    console.error("demande", e);
    if (jeton !== rendu) return;
    clear(racine);
    racine.appendChild(retour);
    racine.appendChild(entete(null, "Demande", null));
    racine.appendChild(boiteErreur(phraseContact(e, PHRASE_ECHEC_LECTURE), () => renderDemande(container, id)));
    return;
  }
  if (jeton !== rendu) return;
  const d = detail.demande;
  const peut = detail.peut ?? {};
  clear(racine);
  racine.appendChild(retour);
  const absence = d.type === "absence" ? detail.absence : null;
  racine.appendChild(entete(TYPES_DEMANDE[d.type] ?? d.type, d.sujet || (absence ? libelleAbsence({ ...absence }) : null), d.auteur_nom ? "De " + d.auteur_nom : null));

  // Ouvrir la demande la marque lue, sans attendre ni bloquer la page.
  marquerLue(id).then(direALaBarre).catch((e) => console.warn("marquer lue :", e?.message || e));

  const relire = async (focus = null) => {
    await renderDemande(container, id);
    if (jeton + 1 !== rendu) return;
    (focus ? document.querySelector(focus) : null)?.focus({ preventScroll: true });
    direALaBarre();
  };
  const echouer = (e) => { console.error("demande", e); toast(phraseContact(e, "L'opération n'a pas abouti."), "error"); };

  // L'absence : quand, motif, état du justificatif, et ce que chacun peut en faire (la base le dit par `peut.justificatif`).
  if (absence) racine.appendChild(sectionAbsence(absence, detail, peut, d, id, relire, echouer));

  // Les étapes.
  const etapes = etapesDemande(detail);
  racine.appendChild(el("section", { class: "contact-section", "aria-labelledby": "demande-suivi" },
    el("h3", { id: "demande-suivi", class: "contact-section-titre" }, "Suivi"),
    el("ol", { class: "demande-etapes" }, ...etapes.map((x) => el("li", { class: "demande-etape" },
      el("span", { class: "demande-etape-nom" }, LIBELLES_ETAPE[x.cle] ?? x.cle),
      el("span", { class: "demande-etape-quand" }, [x.par, dateHeure(x.quand)].filter(Boolean).join(" · ")))))));

  // Les destinataires.
  const dest = detail.destinataires ?? [];
  if (dest.length) {
    racine.appendChild(el("section", { class: "contact-section", "aria-labelledby": "demande-dest" },
      el("h3", { id: "demande-dest", class: "contact-section-titre" }, "Destinataires"),
      el("ul", { class: "demande-destinataires" }, ...dest.map((x) => {
        const annexe = !x.principal && x.annexe ? ` (en copie : ${LIBELLES_ANNEXE[x.annexe] ?? x.annexe})` : (!x.principal ? " (en copie)" : "");
        return el("li", {}, libelleDestinataire(x) + annexe);
      }))));
  }

  // Les échanges : le texte de départ, puis chaque message ou réponse toute faite.
  const messages = [];
  if (d.texte) messages.push({ auteur_nom: d.auteur_nom, texte: d.texte, cree_le: d.cree_le, moi: false, depart: true });
  for (const m of detail.messages ?? []) messages.push(m);
  racine.appendChild(el("section", { class: "contact-section", "aria-labelledby": "demande-echanges" },
    el("h3", { id: "demande-echanges", class: "contact-section-titre" }, "Échanges"),
    messages.length
      ? el("ul", { class: "demande-messages" }, ...messages.map((m) => el("li", { class: "demande-message" + (m.moi ? " demande-moi" : "") },
        el("p", { class: "demande-message-tete" },
          el("b", {}, m.auteur_nom || "Sans nom"), " ", el("span", { class: "muted" }, dateHeure(m.cree_le) + (m.par_lien ? " · depuis l'e-mail" : ""))),
        el("p", { class: "demande-message-texte" }, m.reponse || m.texte || ""))))
      : el("p", { class: "muted" }, "Aucun échange pour le moment.")));

  // Les gestes que la base autorise.
  const gestes = el("section", { class: "contact-section demande-gestes", "aria-labelledby": "demande-gestes-titre" },
    el("h3", { id: "demande-gestes-titre", class: "contact-section-titre" }, "Répondre"));
  let aDesGestes = false;

  const toutesFaites = detail.reponses_toutes_faites ?? [];
  if (peut.repondre && toutesFaites.length) {
    aDesGestes = true;
    gestes.appendChild(el("div", { class: "demande-toutes-faites", role: "group", "aria-label": "Réponses toutes faites" },
      ...toutesFaites.map((r) => el("button", { class: "btn small", type: "button", onClick: async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true;
        try { await repondre(id, "", r.id); toast("Réponse envoyée.", "success", 1800); await relire(); } catch (e) { echouer(e); b.disabled = false; }
      } }, r.libelle))));
  }
  if (peut.repondre) {
    aDesGestes = true;
    const zone = el("textarea", { rows: "4", maxlength: "1000", "aria-label": selonPublic("Ta réponse", "Votre réponse") });
    const erreur = el("p", { class: "contact-champ-erreur", role: "alert" });
    const bouton = el("button", { class: "btn primary", type: "button", onClick: async () => {
      erreur.textContent = "";
      const t = zone.value.trim();
      if (!t) { erreur.textContent = selonPublic("Écris un message avant d'envoyer.", "Écrivez un message avant d'envoyer."); zone.focus(); return; }
      bouton.disabled = true;
      try { await repondre(id, t, null); toast("Réponse envoyée.", "success", 1800); await relire(); } catch (e) { erreur.textContent = phraseContact(e, "Le message n'a pas été envoyé."); bouton.disabled = false; }
    } }, icon.check(), "Répondre");
    gestes.appendChild(el("div", { class: "field" }, zone, erreur));
    gestes.appendChild(el("div", { class: "contact-gestes-fiche" }, bouton));
  }
  const autres = [];
  if (peut.prendre) {
    autres.push(el("button", { class: "btn", type: "button", onClick: async (ev) => {
      const b = ev.currentTarget;
      b.disabled = true;
      try { await prendreEnCompte(id); toast("Demande prise en compte.", "success", 1800); await relire(); } catch (e) { echouer(e); b.disabled = false; }
    } }, "Pris en compte"));
  }
  if (peut.annuler) {
    autres.push(el("button", { class: "btn danger", type: "button", onClick: async () => {
      const ok = await confirmer(absence ? {
        titre: "Annuler cette absence ?",
        phrase: selonPublic("Le centre et les personnes prévenues seront prévenus que tu annules ton absence.", "Le stagiaire et les personnes prévenues seront prévenus de l'annulation."),
        oui: "Annuler l'absence", non: "Garder l'absence",
      } : {
        titre: "Annuler cette demande ?",
        phrase: selonPublic("Le centre sera prévenu que tu l'annules.", "Le stagiaire et l'équipe seront prévenus de l'annulation."),
        oui: "Annuler la demande", non: "Garder la demande",
      });
      if (!ok) return;
      try { await annulerDemande(id); toast(absence ? "Absence annulée." : "Demande annulée.", "success", 1800); await relire(); } catch (e) { echouer(e); }
    } }, "Annuler"));
  }
  if (autres.length) { aDesGestes = true; gestes.appendChild(el("div", { class: "contact-gestes-fiche" }, ...autres)); }
  if (aDesGestes) racine.appendChild(gestes);

  // Les e-mails qui ne sont pas partis : l'équipe seule les voit (la base ne rend les envois qu'à elle).
  const echecs = (detail.envois ?? []).filter((x) => x.etat === "echec");
  if (echecs.length) {
    racine.appendChild(el("section", { class: "contact-section", "aria-labelledby": "demande-envois" },
      el("h3", { id: "demande-envois", class: "contact-section-titre" }, "E-mails non partis"),
      el("ul", { class: "demande-envois" }, ...echecs.map((x) => el("li", { class: "demande-envoi" },
        el("p", {}, `E-mail non parti : ${x.vers}`),
        el("button", { class: "btn small", type: "button", onClick: async (ev) => {
          const b = ev.currentTarget;
          b.disabled = true;
          try { await relancerEnvoi(x.id); toast("Envoi relancé.", "success", 1800); await relire(); } catch (e) { echouer(e); b.disabled = false; }
        } }, "Relancer l'envoi"))))));
  }
}
