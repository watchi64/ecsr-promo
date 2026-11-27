// Page Contacts (espace contact, tâches 5 et 12 : « Écrire au centre », « Mes demandes », « Écrire » sur une fiche ; #/contacts/<id> ouvre le suivi d'une demande) : l'annuaire du centre de la promo affichée, pour le stagiaire (tutoiement), l'équipe et la
// direction (vouvoiement). Une carte par fiche (nom, titre, « Pour quoi me joindre », « Quand », congé et relais, « Appeler »), puis
// la promo : les prénoms et la mention délégué pour un stagiaire, les coordonnées (téléphone, e-mail, financement) pour l'équipe.
// Qui a le geste d'écrire les fiches (fiches_internes.ecrire, lu par ma_fiche_contact) ajoute, modifie, supprime et range les fiches sans compte ; la base reste juge, ses refus
// se disent par leur phrase (phraseDeRefus). Les règles d'affichage vivent dans js/contact-annuaire-rules.js. Aucun défilement de côté :
// des listes, jamais de tableau.

import {
  lireAnnuaire, lireMaFiche, ordonnerFiches, listStagiaires, lireCoordonnees, addContact, updateContact, deleteContact, lireFormateursPourFiche,
  getPromoCourante, getLieuxLus, listeDemandes,
} from "../db.js?v=20261127b";
import { el, clear, toast, displayStagiaire } from "../utils.js?v=20261127b";
import { icon } from "../icons.js?v=20261127b";
import { vueStagiaire, selonPublic } from "../auth-admin.js?v=20261127b";
import { phraseDeRefus } from "../espaces-rules.js?v=20261127b";
import { confirmer } from "../confirmer.js?v=20261127b";
import { ouvrirModale } from "../nav-fenetre.js?v=20261127b";
import { jourParis } from "../dates.js?v=20261127b";
import { trierFiches, ligneDeFiche, validerMaFiche, aQuitte } from "../contact-annuaire-rules.js?v=20261127b";
import { rangerDemandes } from "../contact-rules.js?v=20261127b";
import { libelleDesJours } from "../contact-absences-rules.js?v=20261127b";
import { lireAdresse } from "../route-rules.js?v=20261127b";
import { ligneDemande, renderDemande } from "./demande.js?v=20261127b";
import { ouvrirEcrire } from "./contact-ecrire.js?v=20261127b";

const PHRASE_LECTURE_ECHEC = "Les contacts n'ont pas pu être chargés.";
const PHRASE_AUCUN_CONTACT = "Aucun contact pour ce centre.";

let rendu = 0;

const boiteErreur = (phrase, reessayer) => el("div", { class: "contact-erreur", role: "alert" },
  el("p", {}, phrase),
  el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));

// ============================================================== Les cartes

function carteFiche(fiche, { jour, parId, peutRanger, rang, total, surDeplacer, surModifier, surSupprimer, surEcrire }) {
  const l = ligneDeFiche(fiche, { jour, parId });
  const equipe = !vueStagiaire();
  const detail = [];
  if (l.pourQuoi) detail.push(el("div", { class: "contact-ligne" }, el("dt", {}, "Pour quoi me joindre"), el("dd", {}, l.pourQuoi)));
  if (l.quand) detail.push(el("div", { class: "contact-ligne" }, el("dt", {}, "Quand"), el("dd", {}, l.quand)));
  const actions = [];
  if (l.appeler) {
    actions.push(el("a", { class: "btn small accent contact-appeler", href: l.appeler }, icon.phone(), "Appeler"));
  }
  if (fiche.email) {
    actions.push(el("a", { class: "btn small ghost contact-mail", href: "mailto:" + fiche.email }, icon.mail(), fiche.email));
  }
  // Écrire dans l'app : à toute fiche joignable sauf la sienne ; la base juge le reste.
  if (fiche.joignable && !fiche.moi) {
    actions.push(el("button", { class: "btn small contact-ecrire", type: "button",
      "aria-label": "Écrire à " + (fiche.nom_affiche || "cette personne"), onClick: (e) => surEcrire(fiche, e.currentTarget) }, icon.mail(), "Écrire"));
  }
  const sousNom = [l.titre, fiche.libelle].filter(Boolean).join(" · ");
  const gestes = [];
  if (fiche.ecrivable) {
    gestes.push(el("button", { class: "btn small", type: "button", onClick: () => surModifier(fiche) }, icon.pencil(), "Modifier"));
    gestes.push(el("button", { class: "btn small danger", type: "button", onClick: () => surSupprimer(fiche) }, icon.trash(), "Supprimer"));
  }
  if (peutRanger) {
    gestes.push(el("button", { class: "btn small ghost contact-monter", type: "button", disabled: rang === 0,
      "aria-label": "Monter " + (fiche.nom_affiche || "cette fiche"), onClick: () => surDeplacer(fiche, -1) }, "Monter"));
    gestes.push(el("button", { class: "btn small ghost contact-descendre", type: "button", disabled: rang === total - 1,
      "aria-label": "Descendre " + (fiche.nom_affiche || "cette fiche"), onClick: () => surDeplacer(fiche, 1) }, "Descendre"));
  }
  return el("li", { class: "contact-carte" + (fiche.moi ? " contact-moi" : ""), dataset: { fiche: String(fiche.id) } },
    el("div", { class: "contact-tete" },
      el("h4", { class: "contact-nom" }, l.nom || "Sans nom"),
      fiche.moi ? el("span", { class: "contact-pastille" }, selonPublic("Ta fiche", "Votre fiche")) : null,
      aQuitte(fiche, jour) ? el("span", { class: "contact-pastille" }, "A quitté le centre") : null),
    sousNom ? el("p", { class: "contact-titre" }, sousNom) : null,
    l.conge ? el("p", { class: "contact-conge" }, l.conge) : null,
    detail.length ? el("dl", { class: "contact-detail" }, ...detail) : null,
    equipe && fiche.avec_compte && !fiche.verifiee
      ? el("p", { class: "contact-attente" }, "Cette personne n'a pas encore vérifié sa fiche : seul son nom est visible.") : null,
    actions.length ? el("div", { class: "contact-actions" }, ...actions) : null,
    gestes.length ? el("div", { class: "contact-gestes" }, ...gestes) : null);
}

const mentionDelegue = (s) => (s.delegue === "titulaire" ? "délégué" : s.delegue === "suppleant" ? "suppléant" : null);

function sectionPromoStagiaire(stagiaires) {
  const lignes = stagiaires.map((s) => {
    const m = mentionDelegue(s);
    return el("li", { class: "contact-promo-ligne" }, el("span", { class: "contact-promo-nom" }, displayStagiaire(s)),
      m ? el("span", { class: "contact-pastille" }, m) : null);
  });
  return el("section", { class: "contact-section", "aria-labelledby": "contact-promo-titre" },
    el("h3", { id: "contact-promo-titre", class: "contact-section-titre" }, "Ta promo"),
    lignes.length ? el("ul", { class: "contact-promo" }, ...lignes) : el("p", { class: "muted" }, "Personne dans la promo pour le moment."));
}

function sectionPromoEquipe(stagiaires, coordonnees) {
  const parId = new Map(coordonnees.map((c) => [c.stagiaire_id, c]));
  const lignes = stagiaires.map((s) => {
    const c = parId.get(s.id) || {};
    const m = mentionDelegue(s);
    const coord = [];
    if (c.telephone) coord.push(el("a", { class: "contact-coord", href: "tel:" + String(c.telephone).replace(/[^0-9+]/g, "") }, icon.phone(), c.telephone));
    if (c.email) coord.push(el("a", { class: "contact-coord", href: "mailto:" + c.email }, icon.mail(), c.email));
    return el("li", { class: "contact-promo-ligne contact-promo-ligne-equipe" },
      el("div", { class: "contact-tete" }, el("span", { class: "contact-promo-nom" }, displayStagiaire(s)),
        m ? el("span", { class: "contact-pastille" }, m) : null),
      c.financement ? el("p", { class: "contact-titre" }, c.financement) : null,
      coord.length ? el("div", { class: "contact-actions" }, ...coord) : null);
  });
  return el("section", { class: "contact-section", "aria-labelledby": "contact-promo-titre" },
    el("h3", { id: "contact-promo-titre", class: "contact-section-titre" }, "Stagiaires de la promo"),
    lignes.length ? el("ul", { class: "contact-promo" }, ...lignes) : el("p", { class: "muted" }, "Personne dans la promo pour le moment."));
}

// ============================================================== La fenêtre d'une fiche

// Un champ : étiquette, saisie et la place de sa phrase d'erreur.
function champ(libelle, saisie, aide = null) {
  const id = saisie.id || (saisie.id = "contact-champ-" + Math.random().toString(36).slice(2, 8));
  const erreur = el("p", { class: "contact-champ-erreur", role: "alert" });
  const noeud = el("div", { class: "field" }, el("label", { for: id }, libelle), saisie,
    aide ? el("p", { class: "contact-aide" }, aide) : null, erreur);
  return { noeud, erreur, saisie };
}

const texte = (v) => { const t = String(v ?? "").trim(); return t === "" ? null : t; };

// `fiche` nulle : nouvelle fiche. `annuaire` : les fiches du centre (relais, suggestions de libellé). `apres()` : relecture de la page.
async function ouvrirFiche({ fiche, annuaire, ancre, apres }) {
  const neuve = !fiche;
  const lieu = getPromoCourante()?.lieu_id ?? null;
  let formateurs = [];
  try { formateurs = await lireFormateursPourFiche(); } catch (e) { console.error("formateurs du planning", e); }
  if (fiche && fiche.prof_id != null && !formateurs.some((f) => f.id === fiche.prof_id)) {
    formateurs = [...formateurs, { id: fiche.prof_id, nom: fiche.nom_affiche || "Formateur du planning" }];
  }
  let modale = null;

  const liste = el("datalist", { id: "contact-titres-liste" });
  const suggestions = new Set();
  for (const f of annuaire) {
    for (const t of f.titres || []) if (t && t.nom) suggestions.add(t.nom);
    if (f.libelle) suggestions.add(f.libelle);
  }
  [...suggestions].sort((a, b) => a.localeCompare(b, "fr")).forEach((nom) => liste.appendChild(el("option", { value: nom })));

  const saisie = (type, valeur, extra = {}) => el("input", { type, value: valeur ?? "", autocomplete: "off", ...extra });
  const prenom = champ("Prénom", saisie("text", fiche?.prenom, { maxlength: "80" }));
  const nom = champ("Nom", saisie("text", fiche?.nom, { maxlength: "80" }));
  const libelle = champ("Libellé (fonction)", saisie("text", fiche?.libelle, { maxlength: "80", list: "contact-titres-liste" }),
    "Par exemple Secrétariat, Direction. Les titres du centre sont proposés.");
  const email = champ("E-mail professionnel", saisie("email", fiche?.email, { maxlength: "80", inputmode: "email" }));
  const telephone = champ("Téléphone professionnel", saisie("tel", fiche?.telephone, { maxlength: "20", inputmode: "tel" }));
  const pourQuoi = champ("Pour quoi me joindre", saisie("text", fiche?.pour_quoi, { maxlength: "80" }));
  const quand = champ("Quand", saisie("text", fiche?.quand, { maxlength: "80" }));
  const congeDu = champ("Congé : du", saisie("date", fiche?.conge_du));
  const congeAu = champ("Congé : au", saisie("date", fiche?.conge_au));
  const depart = champ("Date de départ", saisie("date", fiche?.depart_le),
    "À renseigner quand la personne quitte le centre : sa fiche n'est alors plus montrée qu'à l'équipe qui écrit les fiches, qui la supprime ensuite.");

  const relais = el("select", {}, el("option", { value: "" }, "Aucun relais"));
  for (const f of trierFiches(annuaire)) {
    if (fiche && f.id === fiche.id) continue;
    relais.appendChild(el("option", { value: String(f.id), selected: fiche?.relais_id === f.id }, f.nom_affiche || "Sans nom"));
  }
  const champRelais = champ("Relais pendant le congé", relais);

  const prof = el("select", {}, el("option", { value: "" }, "Aucun"));
  for (const f of formateurs) prof.appendChild(el("option", { value: String(f.id), selected: fiche?.prof_id === f.id }, f.nom));
  const champProf = champ("Formateur du planning", prof,
    "Relie la fiche à un formateur du planning : son nom vient alors du planning et la fiche suit ses jours de présence.");

  const centres = getLieuxLus().filter((c) => c.id !== lieu);
  const deja = new Set(fiche?.lieux_partages || []);
  const cases = centres.map((c) => {
    const id = "contact-partage-" + c.id;
    const caseACocher = el("input", { type: "checkbox", id, value: String(c.id), checked: deja.has(c.id) });
    return el("label", { class: "contact-case", for: id }, caseACocher, el("span", {}, c.nom || "Centre " + c.id));
  });

  const general = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });
  const champs = { prenom, nom, email, telephone, pour_quoi: pourQuoi, quand, conge_du: congeDu, conge_au: congeAu };

  async function enregistrer(bouton) {
    general.textContent = "";
    for (const c of [...Object.values(champs), champRelais, champProf]) c.erreur.textContent = "";
    const envoi = {
      prenom: texte(prenom.saisie.value), nom: texte(nom.saisie.value), email: texte(email.saisie.value)?.toLowerCase() ?? null,
      telephone: texte(telephone.saisie.value), pour_quoi: texte(pourQuoi.saisie.value), quand: texte(quand.saisie.value),
      conge_du: texte(congeDu.saisie.value), conge_au: texte(congeAu.saisie.value),
    };
    const departLe = texte(depart.saisie.value);
    const roleTexte = texte(libelle.saisie.value);
    const verdict = validerMaFiche(envoi);
    if (roleTexte && roleTexte.length > 80) { libelle.erreur.textContent = "80 caractères au plus."; verdict.ok = false; }
    const profId = prof.value === "" ? null : Number(prof.value);
    if (!envoi.prenom && !envoi.nom && profId == null) {
      prenom.erreur.textContent = "Un prénom ou un nom est nécessaire.";
      verdict.ok = false;
    }
    for (const [cle, phrase] of Object.entries(verdict.erreurs)) if (champs[cle]) champs[cle].erreur.textContent = phrase;
    if (!verdict.ok) {
      const premier = modale.fenetre.querySelector(".contact-champ-erreur:not(:empty)");
      premier?.closest(".field")?.querySelector("input, select")?.focus();
      return;
    }
    const partages = cases.map((c) => c.querySelector("input")).filter((i) => i.checked).map((i) => Number(i.value));
    const donnees = {
      prenom: envoi.prenom, nom: envoi.nom, role: roleTexte, phone: envoi.telephone, email: envoi.email,
      pour_quoi: envoi.pour_quoi, quand: envoi.quand, conge_du: envoi.conge_du, conge_au: envoi.conge_au,
      relais_id: relais.value === "" ? null : Number(relais.value), prof_id: profId, lieux_partages: partages, depart_le: departLe,
    };
    bouton.disabled = true;
    try {
      if (neuve) {
        const rangs = annuaire.map((f) => f.ordre).filter((o) => o != null);
        await addContact({ ...donnees, category: "admin", sort_order: (rangs.length ? Math.max(...rangs) : 0) + 10 });
      } else {
        await updateContact(fiche.id, donnees);
      }
      modale.fermer({ focus: false });
      toast(neuve ? "Fiche ajoutée." : "Fiche enregistrée.", "success", 1800);
      await apres(neuve ? null : fiche.id);
    } catch (e) {
      console.error("fiche de contact", e);
      general.textContent = phraseDeRefus(e.message, e.code);
      bouton.disabled = false;
    }
  }

  const bouton = el("button", { class: "btn primary", type: "button", onClick: () => enregistrer(bouton) }, icon.check(), "Enregistrer");
  const fenetre = el("div", { class: "modal contact-modal" },
    el("h3", {}, neuve ? "Ajouter une fiche" : "Modifier la fiche"),
    el("div", { class: "modal-form" },
      el("div", { class: "field-pair" }, prenom.noeud, nom.noeud),
      libelle.noeud, liste,
      email.noeud, telephone.noeud, pourQuoi.noeud, quand.noeud,
      el("div", { class: "field-pair" }, congeDu.noeud, congeAu.noeud),
      champRelais.noeud, champProf.noeud, depart.noeud,
      cases.length ? el("fieldset", { class: "contact-partage" },
        el("legend", {}, "Partager avec d'autres centres"), ...cases) : null,
      general),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: () => modale.demanderFermeture() }, "Annuler"),
      bouton));
  modale = ouvrirModale(fenetre, { retour: ancre, focus: () => prenom.saisie });
}

// ============================================================== La page

// « Mes demandes » (stagiaire) : les ouvertes, puis les terminées repliées.
// Le délégué lit les absences annoncées à sa promo (le nom et les jours, rien d'autre) : aucune demande à ouvrir, donc pas de lien.
function sectionAbsencesPromo(lignes) {
  const absences = lignes.filter((l) => l.mon_role === "delegue");
  if (!absences.length) return null;
  return el("section", { class: "contact-section", "aria-labelledby": "contact-absences-promo-titre" },
    el("h3", { id: "contact-absences-promo-titre", class: "contact-section-titre" }, "Absences annoncées dans ta promo"),
    el("ul", { class: "contact-promo" }, ...absences.map((l) => el("li", { class: "contact-promo-ligne" },
      el("span", { class: "contact-promo-nom" }, l.auteur_nom || "Un stagiaire"),
      el("span", { class: "muted" }, " : " + (libelleDesJours(l.jours) || "absence"))))));
}

function sectionMesDemandes(toutes) {
  const lignes = toutes.filter((l) => l.mon_role !== "delegue");
  const rang = rangerDemandes(lignes);
  const ouvertes = [...rang.aTraiter, ...rang.ouvertes];
  const liste = (l) => el("ul", { class: "demande-liste" }, ...l.map((x) => ligneDemande(x, "contacts")));
  return el("section", { class: "contact-section", "aria-labelledby": "contact-demandes-titre" },
    el("h3", { id: "contact-demandes-titre", class: "contact-section-titre" }, "Mes demandes"),
    ouvertes.length ? liste(ouvertes) : el("p", { class: "muted" }, lignes.length ? "Aucune demande ouverte." : "Tu n'as encore rien envoyé au centre."),
    rang.terminees.length
      ? el("details", { class: "demande-repliee" }, el("summary", {}, `Terminées (${rang.terminees.length})`), liste(rang.terminees)) : null);
}

export async function renderContacts(container) {
  const adresse = lireAdresse(location.hash);
  if (adresse.id) return renderDemande(container, adresse.id);
  const jeton = ++rendu;
  clear(container);
  const stagiaire = vueStagiaire();
  const centre = getPromoCourante()?.lieu_nom || "";
  const entete = (sousTitre) => el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      centre ? el("p", { class: "eyebrow" }, centre) : null,
      el("h2", { tabindex: "-1" }, "Contacts"),
      sousTitre ? el("p", { class: "subtitle" }, sousTitre) : null));
  const racine = el("div", { class: "contacts-page" });
  container.appendChild(racine);
  racine.appendChild(entete(null));
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));

  let annuaire;
  let stagiaires = [];
  let coordonnees = [];
  let peutEcrire = false;
  let demandes = [];
  try {
    // Les stagiaires et leurs coordonnées complètent la page : leur échec ne la vide pas.
    const [fiches, promo, coord, moi, mesDemandes] = await Promise.all([
      lireAnnuaire(),
      listStagiaires().catch((e) => { console.error("promo", e); return []; }),
      stagiaire ? Promise.resolve([]) : lireCoordonnees().catch((e) => { console.error("coordonnées", e); return []; }),
      // Le geste qui commande l'ajout et l'ordre des fiches (la base le juge aussi) ; illisible : pas de bouton.
      stagiaire ? Promise.resolve(null) : lireMaFiche().catch((e) => { console.error("mon droit d'écrire", e); return null; }),
      // Mes demandes complètent la page : leur échec ne la vide pas.
      stagiaire ? listeDemandes().catch((e) => { console.error("mes demandes", e); return []; }) : Promise.resolve([]),
    ]);
    demandes = mesDemandes;
    peutEcrire = moi?.peut_ecrire === true;
    annuaire = fiches;
    stagiaires = promo;
    coordonnees = coord;
  } catch (e) {
    console.error("contacts", e);
    if (jeton !== rendu) return;
    clear(racine);
    racine.appendChild(entete(null));
    racine.appendChild(boiteErreur(PHRASE_LECTURE_ECHEC, () => renderContacts(container)));
    return;
  }
  if (jeton !== rendu) return;
  clear(racine);

  const jour = jourParis(new Date());
  const triees = trierFiches(annuaire);
  const parId = new Map(annuaire.map((f) => [f.id, f.nom_affiche]));

  // Après une écriture : la page se relit ; le focus revient sur la carte touchée, sinon sur le titre.
  async function apres(ficheId, geste = null) {
    await renderContacts(container);
    if (jeton + 1 !== rendu) return;
    const carte = ficheId != null ? document.querySelector(`.contacts-page [data-fiche="${ficheId}"]`) : null;
    const cible = (carte && (geste && carte.querySelector(geste) && !carte.querySelector(geste).disabled
      ? carte.querySelector(geste) : carte.querySelector("button, a"))) || document.querySelector(".contacts-page h2");
    cible?.focus({ preventScroll: true });
  }

  async function deplacer(fiche, sens) {
    const ids = triees.map((f) => f.id);
    const de = ids.indexOf(fiche.id);
    const vers = de + sens;
    if (de < 0 || vers < 0 || vers >= ids.length) return;
    [ids[de], ids[vers]] = [ids[vers], ids[de]];
    try {
      await ordonnerFiches(ids);
      await apres(fiche.id, sens < 0 ? ".contact-monter" : ".contact-descendre");
    } catch (e) {
      console.error("ordre des fiches", e);
      toast(phraseDeRefus(e.message, e.code), "error");
    }
  }

  async function supprimer(fiche) {
    const nom = fiche.nom_affiche || "cette personne";
    if (!(await confirmer({ titre: `Supprimer la fiche de ${nom} ?`, phrase: "La fiche disparaît de l'annuaire du centre.", oui: "Supprimer" }))) return;
    try {
      await deleteContact(fiche.id);
      toast("Fiche supprimée.", "success", 1800);
      await apres(null);
    } catch (e) {
      console.error("suppression de fiche", e);
      toast(phraseDeRefus(e.message, e.code), "error");
    }
  }

  const surEcrire = (fiche, ancre) => ouvrirEcrire({ cible: "fiche", ficheId: fiche.id, nomDestinataire: fiche.nom_affiche, ancre });
  const surModifier = (fiche) => ouvrirFiche({ fiche, annuaire, ancre: document.querySelector(`[data-fiche="${fiche.id}"] button`), apres });

  racine.appendChild(entete(stagiaire
    ? "Qui joindre au centre, pour quoi et quand. Tape sur Appeler pour téléphoner."
    : "Qui joindre au centre, pour quoi et quand."));

  if (stagiaire) {
    racine.appendChild(el("div", { class: "contact-gestes-fiche contacts-ecrire" },
      el("a", { class: "btn primary contacts-absence", href: "#/absence" }, icon.calendar(), "Prévenir d'une absence"),
      el("button", { class: "btn accent", type: "button", onClick: (e) => ouvrirEcrire({ cible: "centre", ancre: e.currentTarget }) },
        icon.mail(), "Écrire au centre")));
    racine.appendChild(sectionMesDemandes(demandes));
    const absencesPromo = sectionAbsencesPromo(demandes);
    if (absencesPromo) racine.appendChild(absencesPromo);
  }

  const titreEquipe = el("h3", { id: "contact-equipe-titre", class: "contact-section-titre" }, "L'équipe du centre");
  const boutonAjout = peutEcrire
    ? el("button", { class: "btn small accent", type: "button",
      onClick: (e) => ouvrirFiche({ fiche: null, annuaire, ancre: e.currentTarget, apres }) }, icon.plus(), "Ajouter une fiche")
    : null;
  racine.appendChild(el("section", { class: "contact-section", "aria-labelledby": "contact-equipe-titre" },
    el("div", { class: "contact-section-tete" }, titreEquipe, boutonAjout),
    triees.length
      ? el("ul", { class: "contact-liste" }, ...triees.map((f, i) => carteFiche(f, {
        jour, parId, peutRanger: peutEcrire && triees.length > 1, rang: i, total: triees.length,
        surDeplacer: deplacer, surModifier, surSupprimer: supprimer, surEcrire,
      })))
      : el("p", { class: "muted" }, PHRASE_AUCUN_CONTACT)));

  racine.appendChild(stagiaire ? sectionPromoStagiaire(stagiaires) : sectionPromoEquipe(stagiaires, coordonnees));
}
