// Page Équipe de la direction (titres et droits à la carte, étape 3, spec § 11), dans l'ordre : (1) Personnes avec accès (nom, titres en
// pastilles, « Changer de titre », « Modifier les promos », « Retirer » là où la base l'accepterait) ; (2) Inviter une personne
// (adresse, titre parmi ceux qu'on a le droit de donner, promos du centre, fiche formateur pour le seul titre Formateur, ce que le
// titre ouvre et ce qu'il masque) ; (3) Titres du centre (niveau, origine, porteurs, « Fixe », « Ajuster », « Créer un titre à partir de
// celui-ci », « Supprimer ») ; (4) Journal des droits, replié, seulement quand la table du journal existe. La fenêtre « Ajuster un
// titre » est celle de js/views/titres-editeur.js. Tout passe par les fonctions des titres (donner_titre, retirer_titre, creer_titre,
// supprimer_titre, ajuster_titre) : la base décide, et ses refus se disent par leur phrase (phraseDeRefus), la saisie gardée. Le centre
// est celui du compte (getCentre) : l'équipe d'un autre centre n'est jamais lue. Pas d'e-mail envoyé : la personne crée son mot de
// passe avec l'adresse invitée (onglet Créer mon compte). Les règles d'affichage vivent dans js/titres-rules.js (gestesSurPersonne,
// pastillesDePersonne, titresDonnablesGroupes, ceQueJePeuxFaire, phraseJournal).
// Lecture des titres impossible (panne, base non migrée) : la page garde la liste d'aujourd'hui (direction et formateurs), sans geste,
// avec un message clair. `regler_affectations_formateur` n'est plus appelée par l'app (M3) : elle échoue pour un titre non fixe.

import {
  getMesPromos, lireEquipeDuCentre, lireFichesFormateurLibres, lireTitresVisibles, lireTitresAjustables, lirePersonnesEtTitres,
  lireJournalPresent, lireJournalDesDroits, donnerTitre, retirerTitre, creerTitre, supprimerTitre,
} from "../db.js?v=20261128a";
import { el, clear, toast, tableauEnListe } from "../utils.js?v=20261128a";
import { icon } from "../icons.js?v=20261128a";
import { getCentre, getAdminEmail, getMesTitres, casesAffichees, peutModifier, peutVoir, fondateurHorsApercu } from "../auth-admin.js?v=20261128a";
import { promosDuCentre, phraseDeRefus } from "../espaces-rules.js?v=20261128a";
import { equipeAffichee, unionPromos } from "../direction-rules.js?v=20261128a";
import { phraseCompteTransforme } from "../roles-rules.js?v=20261128a";
import { pluriel } from "../nombres.js?v=20261128a";
import { ouvrirModale } from "../nav-fenetre.js?v=20261128a";
import { confirmer, demander } from "../confirmer.js?v=20261128a";
import {
  titresDonnablesGroupes, pastillesDePersonne, ceQueJePeuxFaire, ceQuiEstMasque, gestesSurPersonne, gestesSurTitre, directionFixePourLesGestes, phraseJournal,
  ligneDeTitreEnLecture,
} from "../titres-rules.js?v=20261128a";
import { ouvrirEditeurTitre } from "./titres-editeur.js?v=20261128a";

const PHRASE_SANS_CENTRE = "Ce compte ne dirige aucun centre.";
const PHRASE_LECTURE_ECHEC = "L'équipe du centre n'a pas pu être chargée.";
const PHRASE_TITRES_ECHEC = "Les titres de l'équipe n'ont pas pu être chargés : la liste s'affiche sans les titres ni les gestes.";
const PHRASE_ADRESSE = "Adresse e-mail invalide.";
const PHRASE_SANS_PROMO_CHOISIE = "Choisissez au moins une promo.";
const PHRASE_SANS_TITRE = "Choisissez un titre.";
export const PHRASE_COMPTE_CREE = "Compte créé. La personne crée son mot de passe avec cette adresse, onglet Créer mon compte.";
export const PHRASE_PROMOS_MAJ = "Promos mises à jour.";
const PHRASE_RIEN_A_CHANGER = "Rien à changer : les promos sont les mêmes.";
const PHRASE_TITRE_DONNE = "Titre donné.";
const PHRASE_JOURNAL_VIDE = "Aucune ligne pour le moment";
const PHRASE_JOURNAL_ECHEC = "Le journal n'a pas pu être chargé.";
const DELAI_MS = 15000;

let rendu = 0;

// Le centre dirigé et ses promos (la plus récente d'abord).
function contexte() {
  const centre = getCentre();
  if (!centre) return { centre: null, promos: [] };
  const promos = promosDuCentre(getMesPromos(), centre.id)
    .slice().sort((a, b) => String(b.date_debut || "").localeCompare(String(a.date_debut || "")) || a.id - b.id);
  return { centre, promos };
}

// Une écriture ne reste jamais en attente : au-delà de 15 s, la phrase le dit et la saisie reste.
function avecDelai(promesse) {
  let minuteur;
  const delai = new Promise((_, rejet) => {
    minuteur = setTimeout(() => rejet(Object.assign(new Error("Délai dépassé (15 s). Réseau lent : réessayez dans un instant."), { phrase: true })), DELAI_MS);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}
const phraseDe = (err) => (err && err.phrase === true ? err.message : phraseDeRefus(err && err.message, err && err.code));

// ============================================================== Fenêtres

// Fenêtre générique : `corps` (nœuds du formulaire), `valeurs()` rend les saisies ou une phrase de refus (texte), `enregistrer(valeurs)`
// rend une promesse (si elle lève, la phrase s'affiche dans la fenêtre et la saisie reste ; sinon la fenêtre se ferme).
export function ouvrirFormulaire({ titre, intro, corps, ancre, libelleBouton, valider, confirmerAvant, enregistrer, premierChamp, apresFermeture }) {
  const message = el("p", { class: "promo-refus", role: "alert" });
  const annuler = el("button", { class: "btn ghost", type: "button" }, "Annuler");
  const ok = el("button", { class: "btn primary", type: "submit" }, libelleBouton);
  let modale = null;   // la fenêtre, une fois ouverte (ouvrirModale, js/nav-fenetre.js)
  const fermer = () => modale.fermer();
  annuler.addEventListener("click", () => modale.demanderFermeture());
  const formulaire = el("form", { class: "modal-form", novalidate: "" },
    intro ? el("p", { class: "muted equipe-intro" }, intro) : null,
    ...corps, message,
    el("div", { class: "modal-actions" }, annuler, ok));
  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (ok.disabled) return;
    const v = valider ? valider() : {};
    if (typeof v === "string") { message.textContent = v; return; }
    message.textContent = "";
    ok.disabled = true;
    annuler.disabled = true;
    try {
      // La confirmation (lue à son rythme) se pose avant le délai de 15 s, qui ne couvre que l'écriture.
      if (confirmerAvant && !(await confirmerAvant(v))) {
        ok.disabled = false;
        annuler.disabled = false;
        return;
      }
      await avecDelai(enregistrer(v));
      fermer();
      // Facultatif : ce qui s'ouvre une fois la fenêtre fermée (une autre fenêtre, qui prend alors le focus).
      if (apresFermeture) apresFermeture();
    } catch (err) {
      // Un refus de la base est attendu : avertissement, pas erreur.
      console.warn("écriture refusée", err && err.message);
      message.textContent = phraseDe(err);
      ok.disabled = false;
      annuler.disabled = false;
    }
  });
  // Pendant l'envoi, ni Annuler ni Échap ne ferment ; le focus revient au bouton qui a ouvert la fenêtre.
  modale = ouvrirModale(el("div", { class: "modal promo-fenetre equipe-fenetre", role: "dialog", "aria-modal": "true", "aria-labelledby": "equipe-fenetre-titre" },
    el("h3", { id: "equipe-fenetre-titre" }, titre), formulaire), {
    fermerAuVoile: false, retour: ancre, avantFermeture: () => !ok.disabled,
    focus: () => (premierChamp ? premierChamp() : ok),
  });
}

// Les cases « promos du centre » : une case par promo, cible de 44 px. `cochees` : identifiants déjà cochés.
function casesPromos(promos, cochees) {
  const cases = promos.map((p) => {
    const c = el("input", { type: "checkbox", value: String(p.id), id: "equipe-promo-" + p.id });
    c.checked = cochees.includes(p.id);
    return { promo: p, c };
  });
  const groupe = el("fieldset", { class: "equipe-cases" },
    el("legend", {}, "Promos du centre"),
    ...cases.map(({ promo, c }) => el("label", { class: "equipe-case", for: "equipe-promo-" + promo.id }, c, el("span", {}, promo.nom))));
  return { groupe, choisies: () => cases.filter(({ c }) => c.checked).map(({ promo }) => promo.id) };
}

// ============================================================== Gestes sur une personne

const nomDeTitre = (l) => l.titre_nom;
const rangDeLigne = (l) => (l.niveau === "promo" ? 1 : 0);

// « Changer de titre » (un autre titre du même niveau, parmi ceux qu'on a le droit de donner) ou « Modifier les promos » (le même titre,
// d'autres promos) : dans les deux cas donner_titre, qui remplace l'ancien titre au même niveau et rend ce qu'il a ajouté ou retiré.
function ouvrirChangement({ centre, promos, ligne, nom, alternatives, promosSeulement, ancre, apres }) {
  const promoNiveau = ligne.niveau === "promo";
  const cochees = promoNiveau ? (ligne.promo_ids || []) : [];
  const { groupe, choisies } = casesPromos(promos, cochees);
  const choixTitre = el("select", { id: "equipe-changer-titre" },
    ...alternatives.map((t) => el("option", { value: String(t.id) }, t.nom)));
  const corps = [];
  if (!promosSeulement) corps.push(el("div", { class: "field" }, el("label", { for: "equipe-changer-titre" }, "Nouveau titre"), choixTitre));
  if (promoNiveau) corps.push(groupe);
  ouvrirFormulaire({
    titre: promosSeulement ? "Modifier les promos" : "Changer de titre",
    intro: promosSeulement ? `${nom} : ${nomDeTitre(ligne)}.` : `${nom} : le titre ${nomDeTitre(ligne)} sera remplacé.`,
    corps, ancre, libelleBouton: "Enregistrer",
    premierChamp: () => (promosSeulement ? groupe.querySelector("input") : choixTitre),
    valider: () => {
      const ids = promoNiveau ? choisies() : null;
      if (promoNiveau && !ids.length) return PHRASE_SANS_PROMO_CHOISIE + " Pour retirer le titre, utilisez « Retirer ».";
      return { titreId: promosSeulement ? ligne.titre_id : Number(choixTitre.value), promoIds: ids };
    },
    enregistrer: async (v) => {
      const r = await donnerTitre({ email: ligne.email, titreId: v.titreId, lieuId: centre.id, promoIds: v.promoIds, profId: null });
      const rien = promosSeulement && !(r.ajoutees || []).length && !(r.retirees || []).length;
      toast(rien ? PHRASE_RIEN_A_CHANGER : promosSeulement ? PHRASE_PROMOS_MAJ : "Titre changé.", "success", 5000);
      await apres(ligne.email);
    },
  });
}

// « Retirer » : la base décide (droit, « jamais sur soi », dernier titre...) ; son refus s'affiche tel quel.
async function retirer({ centre, ligne, nom, apres }) {
  const phrase = ligne.niveau === "promo"
    ? `${nom} ne sera plus ${nomDeTitre(ligne)} d'aucune promo de ${centre.nom || "ce centre"}. Son compte et ses titres dans d'autres centres ne changent pas.`
    : `${nom} n'aura plus le titre ${nomDeTitre(ligne)} dans ${centre.nom || "ce centre"}. Son compte ne change pas.`;
  const oui = await confirmer({ titre: "Retirer ce titre ?", phrase, oui: "Retirer" });
  if (!oui) return;
  try {
    const r = await avecDelai(retirerTitre({ email: ligne.email, titreId: ligne.titre_id, lieuId: centre.id }));
    toast(r && r.retirees === 0 ? "Cette personne n'avait pas ce titre : rien n'a changé." : "Titre retiré.", "success", 5000);
    await apres(null);
  } catch (e) {
    console.warn("geste refusé", e && e.message);
    toast(phraseDe(e), "error", 7000);
  }
}

// ============================================================== Sections

const boutonPetit = (texte, icone, libelleAria, onClick) =>
  el("button", { class: "btn small", type: "button", "aria-label": libelleAria, onClick }, icone ? icone() : null, texte);

// (1) Personnes avec accès. `donnees` : { personnes (lignes de personnes_et_titres), titres, noms, promos, centre, cases, directionFixe, moi }.
function sectionPersonnes(d, apres) {
  const { centre, promos, moi } = d;
  const nomDe = (email) => d.noms.get(email) || email;
  const titreDe = (id) => d.titres.find((t) => t.id === id) || null;
  const parEmail = new Map();
  for (const l of d.personnes) {
    const email = String(l.email).toLowerCase();
    if (!parEmail.has(email)) parEmail.set(email, []);
    parEmail.get(email).push({ ...l, email });
  }
  const gens = [...parEmail.entries()].map(([email, lignes]) => ({
    email, nom: nomDe(email),
    lignes: lignes.map((l, i) => ({ l, i })).sort((a, b) => rangDeLigne(a.l) - rangDeLigne(b.l) || a.i - b.i).map(({ l }) => l),
  })).sort((a, b) => (Number(b.lignes.some((l) => l.niveau === "centre")) - Number(a.lignes.some((l) => l.niveau === "centre")))
    || a.nom.localeCompare(b.nom, "fr"));
  const nomPromo = (id) => (promos.find((p) => p.id === id) || {}).nom || "promo " + id;

  const lignesTable = gens.map((g) => {
    const pastilles = pastillesDePersonne(g.lignes, g.email);
    const actions = [];
    const gestes = g.lignes.map((l) => {
      const t = titreDe(l.titre_id);
      const fixe = t ? t.fixe === true : (l.titre_nom === "Formateur" || l.titre_nom === "Direction de centre");
      const droits = gestesSurPersonne({ cases: d.cases, directionFixe: d.directionFixe, personne: { email: g.email, niveau: l.niveau, fixe, nom: l.titre_nom }, moi });
      const alternatives = d.titres.filter((x) => x.donnable && x.niveau === l.niveau && x.id !== l.titre_id);
      return { l, droits, alternatives };
    }).filter((x) => x.droits.changer || x.droits.retirer);
    for (const { l, droits, alternatives } of gestes) {
      // Plusieurs lignes à gestes : chaque bouton dit de quel titre il parle.
      const suffixe = gestes.length > 1 ? ` (${nomDeTitre(l)})` : "";
      const ancre = (e) => e.currentTarget;
      if (droits.changer && l.niveau === "promo" && promos.length) {
        actions.push(boutonPetit("Modifier les promos", icon.pencil, `Modifier les promos de ${g.nom}${suffixe}`,
          (e) => ouvrirChangement({ centre, promos, ligne: l, nom: g.nom, alternatives, promosSeulement: true, ancre: ancre(e), apres })));
      }
      if (droits.changer && alternatives.length) {
        actions.push(boutonPetit("Changer de titre", null, `Changer le titre de ${g.nom}${suffixe}`,
          (e) => ouvrirChangement({ centre, promos, ligne: l, nom: g.nom, alternatives, promosSeulement: false, ancre: ancre(e), apres })));
      }
      if (droits.retirer) {
        actions.push(boutonPetit("Retirer", icon.trash, `Retirer ${g.nom}${suffixe}`, () => retirer({ centre, ligne: l, nom: g.nom, apres })));
      }
    }
    const detailsPromos = g.lignes.filter((l) => l.niveau === "promo" && (l.promo_ids || []).length)
      .map((l) => (l.promo_ids || []).map(nomPromo).join(" / "));
    return el("tr", { "data-email": g.email },
      el("td", { class: "liste-titre" }, el("div", { class: "equipe-nom" }, el("strong", {}, g.nom),
        g.nom !== g.email ? el("span", { class: "muted equipe-adresse" }, g.email) : null,
        g.email === moi ? el("span", { class: "chip centre-promo" }, "Vous") : null)),
      el("td", {}, el("div", { class: "equipe-pastilles" },
        ...pastilles.map((p, i) => el("span", { class: "chip equipe-role" + (g.lignes[i].niveau === "centre" ? " equipe-role-direction" : "") }, p))),
        detailsPromos.length ? el("div", { class: "muted equipe-adresse" }, "Promos : " + detailsPromos.join(" ; ")) : null),
      el("td", { class: "liste-actions" }, el("div", { class: "equipe-actions" }, ...actions)));
  });
  const tete = el("div", { class: "centre-section-tete" }, el("h3", {}, "Personnes avec accès"),
    el("span", { class: "muted" }, pluriel(gens.length, "personne")));
  if (!gens.length) {
    return el("section", { class: "centre-section", "aria-label": "Personnes avec accès" }, tete,
      el("p", { class: "muted" }, "Personne n'a encore de titre dans ce centre."));
  }
  const table = tableauEnListe(el("table", { class: "centre-table equipe-table" },
    el("thead", {}, el("tr", {}, ...["Nom", "Titres", ""].map((t) => el("th", { scope: "col", "aria-label": t || "Actions" }, t)))),
    el("tbody", {}, ...lignesTable)));
  return el("section", { class: "centre-section", "aria-label": "Personnes avec accès" }, tete, el("div", { class: "centre-defile" }, table));
}

// (2) Inviter une personne : le formulaire est dans la page. `donnees.titres` filtrés sur `donnable` par titresDonnablesGroupes.
function sectionInviter(d, apres) {
  const { centre, promos } = d;
  const groupes = titresDonnablesGroupes(d.titres)
    .map((g) => ({ ...g, titres: promos.length ? g.titres : g.titres.filter((t) => t.niveau !== "promo") }))
    .filter((g) => g.titres.length);
  if (!groupes.length) return null;
  const tous = groupes.flatMap((g) => g.titres);
  const champEmail = el("input", { type: "email", id: "equipe-email", autocomplete: "off", maxlength: "200", placeholder: "prenom.nom@exemple.fr" });
  const choixTitre = el("select", { id: "equipe-titre" },
    ...groupes.map((g) => el("optgroup", { label: g.groupe }, ...g.titres.map((t) => el("option", { value: String(t.id) }, t.nom)))));
  const { groupe: cadrePromos, choisies } = casesPromos(promos, []);
  const choixFiche = el("select", { id: "equipe-fiche", disabled: "" }, el("option", { value: "" }, "Aucune fiche"));
  const noteFiche = el("p", { class: "muted equipe-note" }, "Chargement des fiches libres.");
  const blocFiche = el("div", { class: "field" }, el("label", { for: "equipe-fiche" }, "Fiche formateur (facultative)"), choixFiche, noteFiche);
  const listeFait = el("ul", { class: "equipe-droits" });
  const listeMasque = el("p", { class: "muted equipe-note" });
  const message = el("p", { class: "promo-refus", role: "alert" });
  const bouton = el("button", { class: "btn primary", type: "submit" }, icon.plus(), "Inviter");
  const dejaDansLEquipe = (email) => d.personnes.some((l) => String(l.email).toLowerCase() === email);
  const titreChoisi = () => tous.find((t) => String(t.id) === choixTitre.value) || null;
  let fichesLues = false;

  function chargerFiches() {
    if (fichesLues) return;
    fichesLues = true;
    lireFichesFormateurLibres().then((fiches) => {
      for (const f of fiches) choixFiche.appendChild(el("option", { value: String(f.id) }, f.nom));
      choixFiche.disabled = false;
      noteFiche.textContent = fiches.length
        ? "Reliez la personne à une fiche formateur existante, si elle en a une. Sinon, laissez « Aucune fiche »."
        : "Aucune fiche formateur libre : la personne sera invitée sans fiche.";
    }).catch((e) => {
      console.error("fiches formateur libres", e);
      noteFiche.textContent = "Les fiches formateur n'ont pas pu être lues : vous pouvez inviter sans fiche.";
    });
  }
  // Ce que le titre choisi ouvre et masque ; les promos et la fiche ne s'offrent que quand elles servent.
  function actualiser() {
    const t = titreChoisi();
    const email = champEmail.value.trim().toLowerCase();
    cadrePromos.hidden = !(t && t.niveau === "promo");
    const fiche = !!(t && t.niveau === "promo" && t.fixe === true && !dejaDansLEquipe(email));
    blocFiche.hidden = !fiche;
    if (fiche) chargerFiches();
    const fait = t ? ceQueJePeuxFaire(t) : [];
    listeFait.replaceChildren(...fait.map((x) => el("li", {}, `${x.libelle} : ${x.valeur}`)));
    const masque = t ? ceQuiEstMasque(t) : [];
    listeMasque.textContent = masque.length ? "Masqué dans sa barre : " + masque.join(", ") + "." : "Rien n'est masqué dans sa barre.";
  }
  choixTitre.addEventListener("change", actualiser);
  champEmail.addEventListener("input", actualiser);

  const formulaire = el("form", { class: "equipe-inviter", novalidate: "" },
    el("div", { class: "field" }, el("label", { for: "equipe-email" }, "Adresse e-mail"), champEmail),
    el("div", { class: "field" }, el("label", { for: "equipe-titre" }, "Titre"), choixTitre),
    cadrePromos, blocFiche,
    el("div", { class: "equipe-apercu" },
      el("h4", {}, "Ce qu'elle pourra faire"), listeFait, listeMasque),
    message,
    el("div", { class: "equipe-formulaire-actions" }, bouton));
  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (bouton.disabled) return;
    message.textContent = "";
    const email = champEmail.value.trim().toLowerCase();
    const t = titreChoisi();
    if (!/^\S+@\S+\.\S+$/.test(email)) { message.textContent = PHRASE_ADRESSE; return; }
    if (!t) { message.textContent = PHRASE_SANS_TITRE; return; }
    const siennes = d.personnes.filter((l) => String(l.email).toLowerCase() === email);
    let promoIds = null;
    if (t.niveau === "promo") {
      const ids = choisies();
      if (!ids.length) { message.textContent = PHRASE_SANS_PROMO_CHOISIE; return; }
      // Le même titre : « Inviter » AJOUTE des promos, il ne remplace rien.
      const deja = siennes.filter((l) => l.niveau === "promo" && l.titre_id === t.id).flatMap((l) => l.promo_ids || []);
      promoIds = unionPromos(deja, ids);
    }
    const autres = siennes.filter((l) => l.niveau === t.niveau && l.titre_id !== t.id);
    if (autres.length) {
      const noms = [...new Set(autres.map(nomDeTitre))];
      const oui = await confirmer({ titre: "Remplacer son titre ?", phrase: `Cette personne a déjà le titre ${noms.join(", ")} : il sera remplacé.`, oui: "Remplacer", danger: false });
      if (!oui) return;
    }
    const profId = !blocFiche.hidden && choixFiche.value ? Number(choixFiche.value) : null;
    bouton.disabled = true;
    try {
      const r = await avecDelai(donnerTitre({ email, titreId: t.id, lieuId: centre.id, promoIds, profId }));
      let phrase = r.transforme === true ? phraseCompteTransforme(t.niveau === "promo" ? "formateur" : "direction")
        : r.cree ? PHRASE_COMPTE_CREE : PHRASE_TITRE_DONNE;
      const retirees = (r.retirees || []).map((id) => (promos.find((p) => p.id === id) || {}).nom || "promo " + id);
      if (retirees.length) phrase += ` Retirée${retirees.length > 1 ? "s" : ""} : ${retirees.join(", ")}.`;
      // Un compte qui existe déjà garde sa fiche : celle qui a été choisie n'est pas reliée.
      if (!r.cree && r.transforme !== true && profId != null) phrase += " Ce compte existait déjà : la fiche formateur choisie n'a pas été reliée.";
      toast(phrase, "success", 7000);
      await apres(email);
    } catch (err) {
      console.warn("invitation refusée", err && err.message);
      message.textContent = phraseDe(err);
      bouton.disabled = false;
    }
  });
  actualiser();
  return el("section", { class: "centre-section", "aria-label": "Inviter une personne" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Inviter une personne")),
    el("p", { class: "muted equipe-intro" }, "Aucun e-mail n'est envoyé : la personne crée son mot de passe avec cette adresse, onglet Créer mon compte."),
    formulaire);
}

// Les quatre cellules d'un titre en lecture : nom (cadenas et « Fixe » pour un titre fixe), niveau, origine, porteurs. Servent ici et à la
// page Directions de centre du siège (titres de chaque centre).
export function cellulesDeTitre(t) {
  const l = ligneDeTitreEnLecture(t);
  return [
    el("td", { class: "liste-titre" }, el("div", { class: "equipe-nom" },
      l.fixe ? el("span", { class: "equipe-cadenas", title: "Titre fixe" }, icon.lock()) : null,
      el("strong", {}, l.nom),
      l.fixe ? el("span", { class: "chip equipe-role" }, "Fixe") : null)),
    el("td", {}, l.niveau),
    el("td", {}, l.origine, l.version ? el("span", { class: "muted equipe-adresse" }, " (version d'un titre du réseau)") : null),
    el("td", {}, pluriel(l.porteurs, "personne")),
  ];
}

// (3) Titres du centre : le titre, son niveau, son origine, ceux qui le portent ; les gestes selon ce que la base ouvre.
function sectionTitres(d, apres) {
  const { centre } = d;
  const peutGerer = peutModifier("equipe");
  const lignes = d.titres.map((t) => {
    const actions = [];
    const droits = gestesSurTitre({ titre: t, lieuId: centre.id, ajustable: d.ajustables.has(Number(t.id)), peutGerer });
    if (droits.ajuster) {
      actions.push(boutonPetit("Ajuster", icon.pencil, `Ajuster le titre ${t.nom}`,
        (e) => ouvrirEditeurTitre({ titre: t, niveau: t.niveau, lieuId: centre.id, porteurs: t.porteurs || 0, apres: () => apres(null), ancre: e.currentTarget })));
    }
    if (droits.creer) {
      actions.push(boutonPetit("Créer un titre à partir de celui-ci", icon.plus, `Créer un titre à partir de ${t.nom}`, async () => {
        const nom = await demander({
          titre: "Créer un titre", phrase: `Le nouveau titre reprend les cases de « ${t.nom} ». Donnez-lui un nom.`, libelle: "Nom du titre",
          oui: "Créer", verifier: (v) => v.trim().length > 0, erreur: "Donnez un nom au titre.",
        });
        if (nom == null) return;
        try {
          await avecDelai(creerTitre({ depuis: t.id, nom: nom.trim(), lieuId: centre.id }));
          toast("Titre créé : vous pouvez maintenant l'ajuster.", "success", 5000);
          await apres(null);
        } catch (e) {
          console.warn("geste refusé", e && e.message);
          toast(phraseDe(e), "error", 7000);
        }
      }));
    }
    // Un titre du réseau ne se supprime pas depuis un centre (supprimer_titre le juge sans centre) : seulement un titre de ce centre.
    if (droits.supprimer) {
      actions.push(boutonPetit("Supprimer", icon.trash, `Supprimer le titre ${t.nom}`, async () => {
        const oui = await confirmer({ titre: "Supprimer ce titre ?", phrase: `Le titre ${t.nom} disparaît de ${centre.nom || "ce centre"}. Personne ne le porte.`, oui: "Supprimer" });
        if (!oui) return;
        try {
          await avecDelai(supprimerTitre(t.id));
          toast("Titre supprimé.", "success", 5000);
          await apres(null);
        } catch (e) {
          console.warn("geste refusé", e && e.message);
          toast(phraseDe(e), "error", 7000);
        }
      }));
    }
    return el("tr", { "data-titre": String(t.id) }, ...cellulesDeTitre(t),
      el("td", { class: "liste-actions" }, el("div", { class: "equipe-actions" }, ...actions)));
  });
  const table = tableauEnListe(el("table", { class: "centre-table equipe-table" },
    el("thead", {}, el("tr", {}, ...["Titre", "Niveau", "Origine", "Porteurs", ""].map((t) => el("th", { scope: "col", "aria-label": t || "Actions" }, t)))),
    el("tbody", {}, ...lignes)));
  return el("section", { class: "centre-section", "aria-label": "Titres du centre" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Titres du centre")),
    el("div", { class: "centre-defile" }, table));
}

// (4) Journal des droits, replié. `journal` : lignes de journal_des_droits, ou nul quand la lecture a échoué.
export function sectionJournal(d, titre = "Journal des droits") {
  const nomDe = (email) => d.noms.get(String(email).toLowerCase()) || email;
  let contenu;
  if (d.journal == null) contenu = el("p", { class: "muted", role: "alert" }, PHRASE_JOURNAL_ECHEC);
  else if (!d.journal.length) contenu = el("p", { class: "muted" }, PHRASE_JOURNAL_VIDE);
  else contenu = el("ul", { class: "equipe-journal-liste" }, ...d.journal.map((l) => el("li", {}, phraseJournal(l, nomDe))));
  return el("section", { class: "centre-section", "aria-label": titre },
    el("details", { class: "equipe-journal" }, el("summary", {}, titre), contenu));
}

// ============================================================== Page

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

// La liste d'aujourd'hui, sans geste : ce que la page montre quand les titres ne se lisent pas.
function listeDeSecours(lignes, promos) {
  const equipe = equipeAffichee(lignes, promos);
  if (!equipe.length) return el("p", { class: "muted" }, "Personne dans l'équipe pour le moment.");
  const table = tableauEnListe(el("table", { class: "centre-table equipe-table" },
    el("thead", {}, el("tr", {}, ...["Nom", "Rôle", "Promos"].map((t) => el("th", { scope: "col" }, t)))),
    el("tbody", {}, ...equipe.map((l) => el("tr", { "data-email": l.email },
      el("td", { class: "liste-titre" }, el("strong", {}, l.nom)),
      el("td", {}, l.role),
      el("td", {}, l.promos || el("span", { class: "muted" }, l.role === "Formateur" ? "Aucune promo" : "Tout le centre")))))));
  return el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Direction et formateurs")),
    el("div", { class: "centre-defile" }, table));
}

export async function renderEquipeCentre(container) {
  const jeton = ++rendu;
  clear(container);
  const { centre, promos } = contexte();
  if (!centre) {
    container.appendChild(el("p", { class: "muted" }, PHRASE_SANS_CENTRE));
    return;
  }
  const racine = el("div", { class: "centre equipe-centre" });
  container.appendChild(racine);
  const entete = (sousTitre) => el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Centre de " + (centre.nom || "")),
      el("h2", { tabindex: "-1" }, "Équipe"),
      el("p", { class: "subtitle" }, sousTitre)));

  // Après une écriture : la page se relit ; le focus revient sur la ligne de la personne (ou sur le titre de la page).
  async function apres(email) {
    await renderEquipeCentre(container);
    if (jeton + 1 !== rendu) return;
    const cible = email
      ? [...document.querySelectorAll(".equipe-centre [data-email]")].find((n) => n.getAttribute("data-email") === email)
      : null;
    const bouton = (cible && cible.querySelector("button")) || document.querySelector(".equipe-centre h2");
    if (bouton) bouton.focus({ preventScroll: true });
  }

  racine.appendChild(entete("Chargement"));
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  // Les titres et les personnes sont le cœur de la page ; les noms, les titres ajustables et le journal sont des plus.
  const [rTitres, rPersonnes, rEquipe, rAjustables, rJournalPresent] = await Promise.allSettled([
    lireTitresVisibles(centre.id), lirePersonnesEtTitres({ lieuId: centre.id }), lireEquipeDuCentre(centre.id),
    lireTitresAjustables(centre.id), lireJournalPresent(),
  ]);
  if (jeton !== rendu) return;
  clear(racine);
  const noms = new Map();
  if (rEquipe.status === "fulfilled") for (const l of rEquipe.value) if (l.nom) noms.set(l.email, l.nom);

  if (rTitres.status !== "fulfilled" || rPersonnes.status !== "fulfilled") {
    const raison = rTitres.status !== "fulfilled" ? rTitres.reason : rPersonnes.reason;
    console.error("titres de l'équipe", raison);
    racine.appendChild(entete("L'équipe du centre"));
    if (rEquipe.status !== "fulfilled") {
      console.error("équipe du centre", rEquipe.reason);
      racine.appendChild(boiteErreur(PHRASE_LECTURE_ECHEC, () => renderEquipeCentre(container)));
      return;
    }
    racine.appendChild(boiteErreur(`${PHRASE_TITRES_ECHEC} ${phraseDeRefus(raison && raison.message, raison && raison.code)}`, () => renderEquipeCentre(container)));
    racine.appendChild(listeDeSecours(rEquipe.value, promos));
    return;
  }
  if (rAjustables.status !== "fulfilled") console.error("titres ajustables", rAjustables.reason);
  const titres = rTitres.value;
  const personnes = rPersonnes.value;
  let journal = null;
  const journalPresent = rJournalPresent.status === "fulfilled" && rJournalPresent.value === true;
  if (journalPresent) {
    try {
      journal = await lireJournalDesDroits(centre.id);
    } catch (e) {
      console.error("journal des droits", e);
    }
    if (jeton !== rendu) return;
  }
  const mesTitres = getMesTitres();
  const donnees = {
    centre, promos, titres, personnes, noms, journal,
    ajustables: rAjustables.status === "fulfilled" ? rAjustables.value : new Set(),
    cases: null,
    // La direction fixe du centre : titres lus et direction fixe, ou fondateur hors aperçu (la base le laisse faire).
    directionFixe: directionFixePourLesGestes({ titres: mesTitres, lieuId: centre.id, fondateur: fondateurHorsApercu() }),
    moi: String(getAdminEmail() || "").toLowerCase(),
  };
  // Les cases du centre : celles de la session (casesAffichees, nul = plafond).
  donnees.cases = casesAffichees();

  const nbPersonnes = new Set(personnes.map((l) => String(l.email).toLowerCase())).size;
  racine.appendChild(entete(nbPersonnes ? pluriel(nbPersonnes, "personne") + " avec accès" : "Personne n'a encore de titre"));
  if (!promos.length) {
    racine.appendChild(el("div", { class: "centre-section centre-vide" },
      el("p", {}, "Ce centre n'a pas encore de promo."),
      el("p", { class: "muted" }, "Une promo est nécessaire pour donner un titre de promo."),
      // La page Promos peut être fermée par le titre (case « Non ») : le lien ne s'offre qu'avec la case sur « Modifier ».
      peutModifier("promos") ? el("a", { class: "btn primary", href: "#/promos" }, "Créer une promo") : null));
  }
  if (peutVoir("equipe")) racine.appendChild(sectionPersonnes(donnees, apres));
  const inviter = sectionInviter(donnees, apres);
  if (inviter) racine.appendChild(inviter);
  if (peutVoir("equipe")) racine.appendChild(sectionTitres(donnees, apres));
  if (journalPresent && peutVoir("equipe")) racine.appendChild(sectionJournal(donnees));
}
