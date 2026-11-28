// « Ma fiche de contact » (Mes préférences, espace contact, tâche 6). Équipe et direction : leur fiche de l'annuaire (e-mail
// professionnel pré-rempli avec l'adresse du compte, téléphone, pour quoi les joindre, quand, congé, relais) ; tant qu'elle n'est pas
// enregistrée, les stagiaires ne voient que leur nom. Stagiaire : « Mon téléphone », visible de l'équipe seulement. Sans fiche
// (compte sans affectation, aperçu, vitrine), la section ne s'affiche pas. Les contrôles reprennent ceux de la base
// (js/contact-annuaire-rules.js) ; ses refus se disent par leur phrase. Équipe au vouvoiement, stagiaire au tutoiement.

import { lireMaFiche, reglerMaFiche, lireCoordonnees, reglerCoordonnees, lireMesAlertes, reglerMesAlertes } from "../db.js?v=20261128a";
import { el, clear, toast } from "../utils.js?v=20261128a";
import { icon } from "../icons.js?v=20261128a";
import { vueStagiaire, monStagiaireId, enVitrine } from "../auth-admin.js?v=20261128a";
import { phraseDeRefus } from "../espaces-rules.js?v=20261128a";
import { validerMaFiche, PHRASE_VERIFIER_FICHE } from "../contact-annuaire-rules.js?v=20261128a";
import { phraseContact } from "../contact-rules.js?v=20261128a";

const PHRASE_ECHEC_LECTURE = "Votre fiche n'a pas pu être chargée.";
const PHRASE_ECHEC_LECTURE_TEL = "Ton téléphone n'a pas pu être chargé.";

const texte = (v) => { const t = String(v ?? "").trim(); return t === "" ? null : t; };

// Un champ : étiquette, saisie, aide et la place de sa phrase d'erreur.
function champ(libelle, saisie, aide = null) {
  const id = saisie.id || (saisie.id = "mafiche-" + Math.random().toString(36).slice(2, 8));
  const erreur = el("p", { class: "contact-champ-erreur", role: "alert" });
  const noeud = el("div", { class: "field" }, el("label", { for: id }, libelle), saisie,
    aide ? el("p", { class: "contact-aide" }, aide) : null, erreur);
  return { noeud, erreur, saisie };
}

const boiteErreur = (phrase, reessayer) => el("div", { class: "contact-erreur", role: "alert" },
  el("p", {}, phrase), el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));

// La section de Mes préférences : ma fiche (équipe) ou mon téléphone (stagiaire), ou rien. Se charge seule ; sans fiche, elle se retire.
export function sectionMaFiche() {
  if (enVitrine()) return null;
  const stagiaire = vueStagiaire();
  if (stagiaire && monStagiaireId() == null) return null;
  const section = el("section", { class: "param-section ma-fiche", "aria-labelledby": "ma-fiche-titre" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.user()),
    el("div", {},
      el("h3", { id: "ma-fiche-titre" }, stagiaire ? "Mon téléphone" : "Ma fiche de contact"),
      el("p", { class: "muted" }, stagiaire ? "Facultatif. Seule l'équipe de ton centre le voit." : "Ce que l'annuaire du centre dit de vous."))));
  const corps = el("div", { class: "param-block" }, el("div", { class: "loading" }, "Chargement"));
  section.appendChild(corps);
  const rendre = stagiaire ? formulaireTelephone : formulaireFiche;
  const charger = async () => {
    try {
      await rendre(section, corps, charger);
    } catch (e) {
      console.error("ma fiche de contact", e);
      clear(corps);
      corps.appendChild(boiteErreur(stagiaire ? PHRASE_ECHEC_LECTURE_TEL : PHRASE_ECHEC_LECTURE, charger));
    }
  };
  charger();
  return section;
}

// ---- Alertes par e-mail (tout compte)

// « Alertes par e-mail » : une case, allumée par défaut. L'e-mail dit seulement qu'un message attend dans l'app (jamais son texte ni son
// motif). Les personnes sans compte (fiche seule) reçoivent toujours le leur. Absente en vitrine. La base garde le choix.
export function sectionAlertes() {
  if (enVitrine()) return null;
  const stagiaire = vueStagiaire();
  const section = el("section", { class: "param-section ma-fiche alertes-email", "aria-labelledby": "alertes-titre" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.mail()),
    el("div", {},
      el("h3", { id: "alertes-titre" }, "Alertes par e-mail"),
      el("p", { class: "muted" }, stagiaire
        ? "Un e-mail te prévient quand le centre te répond ou t'écrit. Il ne contient pas le message : tu le lis dans l'app."
        : "Un e-mail vous prévient quand une demande ou un message vous attend. Il ne contient pas le message : vous le lisez dans l'app."))));
  const corps = el("div", { class: "param-block" }, el("div", { class: "loading" }, "Chargement"));
  section.appendChild(corps);
  const charger = async () => {
    clear(corps);
    corps.appendChild(el("div", { class: "loading" }, "Chargement"));
    let actives;
    try {
      actives = await lireMesAlertes();
    } catch (e) {
      console.error("alertes par e-mail", e);
      clear(corps);
      corps.appendChild(boiteErreur(phraseContact(e, stagiaire ? "Ton réglage n'a pas pu être chargé." : "Votre réglage n'a pas pu être chargé."), charger));
      return;
    }
    clear(corps);
    const erreur = el("p", { class: "contact-champ-erreur", role: "alert" });
    const saisie = el("input", { type: "checkbox", id: "alertes-email-case", checked: actives });
    saisie.addEventListener("change", async () => {
      erreur.textContent = "";
      const voulu = saisie.checked;
      saisie.disabled = true;
      try {
        const gardee = await reglerMesAlertes(voulu);
        saisie.checked = gardee === true;
        toast(saisie.checked ? "Alertes par e-mail allumées." : "Alertes par e-mail coupées.", "success", 1800);
      } catch (e) {
        console.error("alertes par e-mail", e);
        saisie.checked = !voulu;
        erreur.textContent = phraseContact(e, "Le réglage n'a pas été enregistré.");
      }
      saisie.disabled = false;
    });
    corps.appendChild(el("label", { class: "contact-case", for: "alertes-email-case" }, saisie, el("span", {}, "Recevoir les alertes par e-mail")));
    corps.appendChild(erreur);
  };
  charger();
  return section;
}

// ---- Équipe et direction

async function formulaireFiche(section, corps, recharger) {
  const donnees = await lireMaFiche();
  const fiche = donnees?.fiche;
  if (!fiche) { section.remove(); return; }
  clear(corps);
  if (!fiche.verifiee) corps.appendChild(el("p", { class: "contact-encadre", role: "note" }, PHRASE_VERIFIER_FICHE));

  const saisie = (type, valeur, extra = {}) => el("input", { type, value: valeur ?? "", autocomplete: "off", ...extra });
  const nomVientDuPlanning = fiche.prof_id != null;
  const prenom = champ("Prénom", saisie("text", fiche.prenom, { maxlength: "80" }));
  const nom = champ("Nom", saisie("text", fiche.nom, { maxlength: "80" }));
  const email = champ("E-mail professionnel", saisie("email", fiche.email || donnees.email_compte || "", { maxlength: "80", inputmode: "email" }),
    fiche.email ? null : "Proposé : l'adresse de votre compte. Modifiez-la si les stagiaires doivent écrire ailleurs.");
  const telephone = champ("Téléphone professionnel", saisie("tel", fiche.telephone, { maxlength: "20", inputmode: "tel" }));
  const pourQuoi = champ("Pour quoi me joindre", saisie("text", fiche.pour_quoi, { maxlength: "80" }), "Par exemple : absences, justificatifs, dossier de financement.");
  const quand = champ("Quand me joindre", saisie("text", fiche.quand, { maxlength: "80" }), "Par exemple : du lundi au vendredi, de 9 h à 12 h.");
  const congeDu = champ("En congé du", saisie("date", fiche.conge_du));
  const congeAu = champ("Au", saisie("date", fiche.conge_au));
  const relais = el("select", {}, el("option", { value: "" }, "Aucun relais"));
  for (const r of donnees.relais_possibles || []) {
    relais.appendChild(el("option", { value: String(r.id), selected: fiche.relais_id === r.id }, r.nom || "Sans nom"));
  }
  const champRelais = champ("Relais pendant le congé", relais, "La personne que les stagiaires joignent à votre place.");
  const general = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });
  const champs = { prenom, nom, email, telephone, pour_quoi: pourQuoi, quand, conge_du: congeDu, conge_au: congeAu };

  async function enregistrer(bouton) {
    general.textContent = "";
    for (const c of [...Object.values(champs), champRelais]) c.erreur.textContent = "";
    const envoi = {
      email: texte(email.saisie.value)?.toLowerCase() ?? null, telephone: texte(telephone.saisie.value),
      pour_quoi: texte(pourQuoi.saisie.value), quand: texte(quand.saisie.value),
      conge_du: texte(congeDu.saisie.value), conge_au: texte(congeAu.saisie.value),
      relais_id: relais.value === "" ? null : Number(relais.value),
    };
    // Le nom vient du planning quand une ligne de formateur est rattachée : la base ne le prend alors pas.
    if (!nomVientDuPlanning) { envoi.prenom = texte(prenom.saisie.value); envoi.nom = texte(nom.saisie.value); }
    const verdict = validerMaFiche(envoi);
    for (const [cle, phrase] of Object.entries(verdict.erreurs)) if (champs[cle]) champs[cle].erreur.textContent = phrase;
    if (!verdict.ok) {
      corps.querySelector(".contact-champ-erreur:not(:empty)")?.closest(".field")?.querySelector("input, select")?.focus();
      return;
    }
    bouton.disabled = true;
    try {
      await reglerMaFiche(envoi);
      toast("Fiche enregistrée.", "success", 1800);
      await recharger();
    } catch (e) {
      console.error("ma fiche de contact", e);
      general.textContent = phraseDeRefus(e.message, e.code);
      bouton.disabled = false;
    }
  }
  const bouton = el("button", { class: "btn primary", type: "button", onClick: () => enregistrer(bouton) }, icon.check(), "Enregistrer");
  corps.appendChild(el("div", { class: "modal-form ma-fiche-form" },
    nomVientDuPlanning
      ? el("p", { class: "muted" }, "Votre nom vient du planning : " + (fiche.nom_planning || "formateur") + ".")
      : el("div", { class: "field-pair" }, prenom.noeud, nom.noeud),
    email.noeud, telephone.noeud, pourQuoi.noeud, quand.noeud,
    el("div", { class: "field-pair" }, congeDu.noeud, congeAu.noeud),
    champRelais.noeud, general, el("div", { class: "contact-gestes-fiche" }, bouton)));
}

// ---- Stagiaire

async function formulaireTelephone(section, corps, recharger) {
  const moi = monStagiaireId();
  const lignes = await lireCoordonnees();
  const sienne = lignes.find((c) => c.stagiaire_id === moi) || {};
  clear(corps);
  const telephone = champ("Mon numéro de téléphone",
    el("input", { type: "tel", value: sienne.telephone ?? "", autocomplete: "tel", maxlength: "20", inputmode: "tel" }),
    "L'équipe ne s'en sert que pour te joindre. Les autres stagiaires ne le voient pas.");
  const general = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });
  async function enregistrer(bouton) {
    general.textContent = "";
    telephone.erreur.textContent = "";
    const valeur = texte(telephone.saisie.value);
    const verdict = validerMaFiche({ telephone: valeur });
    if (!verdict.ok) { telephone.erreur.textContent = verdict.erreurs.telephone; telephone.saisie.focus(); return; }
    bouton.disabled = true;
    try {
      await reglerCoordonnees(moi, { telephone: valeur });
      toast("Téléphone enregistré.", "success", 1800);
      await recharger();
    } catch (e) {
      console.error("mon téléphone", e);
      general.textContent = phraseDeRefus(e.message, e.code);
      bouton.disabled = false;
    }
  }
  const bouton = el("button", { class: "btn primary", type: "button", onClick: () => enregistrer(bouton) }, icon.check(), "Enregistrer");
  corps.appendChild(el("div", { class: "modal-form ma-fiche-form" }, telephone.noeud, general, el("div", { class: "contact-gestes-fiche" }, bouton)));
}
