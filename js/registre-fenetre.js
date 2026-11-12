// Fenêtre de saisie d'une entrée du registre qualité (Qualiopi Q4, indicateurs 31 et 32), commune à la page Qualiopi
// (sous-onglet « Registre qualité », js/views/registre-qualite.js) et à la page « Problèmes signalés » (un problème signalé
// versé au registre). Une fenêtre courte : le rappel des violences en tête, le type en cinq boutons, la date (aujourd'hui par
// défaut), l'origine, la promo ou, sans promo, le centre, la description avec « Ne nommez personne » juste dessous, puis,
// repliés, la réponse et la suite. Les règles (js/registre-rules.js) disent les erreurs, sous chaque champ ; la base garde
// les siennes (js/registre-erreurs.js).
//
// Mécanique des fenêtres de la coquille (js/nav-fenetre.js : Tab gardé dans la fenêtre, Échap, voile, focus rendu). Une
// saisie modifiée ne se perd pas d'un geste : « Fermer », le voile ou Échap demandent d'abord « Fermer sans enregistrer ? »
// dans une fenêtre de l'app (js/confirmer.js, jamais la boîte du navigateur), et la fenêtre se ferme elle-même sur « oui ».
// Avant l'envoi, un champ vide part en null, dates comprises : jamais une chaîne vide vers la base.
// Fenêtre de l'équipe : ses textes vouvoient (règle du 10/11).

import { el, toast } from "./utils.js?v=20261112b";
import { ouvrirFenetre, fermerFenetre, fenetreOuverte, demanderFermeture } from "./nav-fenetre.js?v=20261112b";
import { confirmer } from "./confirmer.js?v=20261112b";
import { ajouterEntreeRegistre, modifierEntreeRegistre } from "./db.js?v=20261112b";
import { TYPES, ORIGINES, ETATS, RAPPEL_VIOLENCES, LIMITE_TEXTE, validerEntree } from "./registre-rules.js?v=20261112b";
import { jourParis } from "./dates.js?v=20261112b";
import { libelleOptionPromo } from "./qualiopi-page-rules.js?v=20261112b";

const NOM = "registre";
export const NE_NOMME_PERSONNE = "Ne nommez personne : l'origine suffit.";

// Les champs de la saisie, dans l'ordre de la fenêtre (le premier en erreur prend le focus).
const ORDRE = ["type", "date_constat", "origine", "description", "reponse", "date_reponse", "action_decidee", "mesure_prevention"];
const REPLIES = new Set(["reponse", "date_reponse", "action_decidee", "mesure_prevention"]);

const texte = (v) => (v == null ? "" : String(v));
const jour = (v) => (v ? String(v).slice(0, 10) : "");
const vide = (v) => (typeof v === "string" && v.trim() === "" ? null : v);

// Les centres connus, d'après les promos du compte (getMesPromos) : un par lieu, dans l'ordre des noms.
export function lieuxDesPromos(promos) {
  const lieux = new Map();
  for (const p of promos || []) {
    if (p?.lieu_id == null || lieux.has(Number(p.lieu_id))) continue;
    const nom = typeof p.lieu_nom === "string" && p.lieu_nom.trim() ? p.lieu_nom.trim() : `Centre n° ${p.lieu_id}`;
    lieux.set(Number(p.lieu_id), nom);
  }
  return [...lieux.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

// Ouvre la fenêtre. `entree` : une entrée à modifier (jamais une entrée effacée) ; sinon une entrée nouvelle, `prerempli`
// donnant ses premiers champs (entreeDepuisSignalement : type, origine, promo, description, date, lien du problème signalé).
// `promos` : celles du compte ; `ancre` : le bouton qui l'ouvre ; `surEnregistre(entree)` : l'entrée telle que la base l'a
// enregistrée, après la fermeture de la fenêtre.
export function ouvrirFenetreRegistre({ entree = null, prerempli = null, promos = [], ancre = null, surEnregistre = null } = {}) {
  const aujourdhui = jourParis(new Date());
  const depart = entree || prerempli || {};
  const modification = entree != null;
  let type = Object.prototype.hasOwnProperty.call(TYPES, depart.type) ? depart.type : null;
  let envoiEnCours = false;
  let enregistre = false;
  let confirmationEnCours = false;

  const erreurs = {};
  const zoneErreur = (cle) => {
    erreurs[cle] = el("p", { class: "rg-erreur", id: "rg-erreur-" + cle });
    return erreurs[cle];
  };
  const champ = (cle, noeud) => {
    // La consigne « Ne nommez personne » est lue avant l'erreur à l'entrée dans la description.
    noeud.setAttribute("aria-describedby", (cle === "description" ? "rg-personne " : "") + "rg-erreur-" + cle);
    return noeud;
  };

  // --- Type : cinq boutons, qui passent à la ligne sur téléphone ---
  const boutonsType = Object.entries(TYPES).map(([cle, libelle]) => el("button", {
    type: "button", class: "rg-type-choix", "data-type": cle, "aria-pressed": cle === type ? "true" : "false",
    onClick: () => choisirType(cle),
  }, libelle));
  const groupeType = el("div", { class: "rg-types", role: "group", "aria-labelledby": "rg-type-titre", "aria-describedby": "rg-erreur-type" },
    ...boutonsType);

  // --- Date, origine, promo, centre ---
  const champDate = champ("date_constat", el("input", { type: "date", id: "rg-date", class: "rg-champ", max: aujourdhui }));
  champDate.value = jour(depart.date_constat) || aujourdhui;

  const champOrigine = champ("origine", el("select", { id: "rg-origine", class: "rg-champ" },
    el("option", { value: "" }, "Choisir l'origine"),
    ...Object.entries(ORIGINES).map(([cle, libelle]) => el("option", { value: cle }, libelle))));
  champOrigine.value = Object.prototype.hasOwnProperty.call(ORIGINES, depart.origine) ? depart.origine : "";

  const promoDepart = depart.promo_id == null ? "" : String(depart.promo_id);
  const optionsPromo = (promos || []).map((p) => el("option", { value: String(p.id) }, libelleOptionPromo(p, promos)));
  if (promoDepart && !(promos || []).some((p) => String(p.id) === promoDepart)) {
    optionsPromo.push(el("option", { value: promoDepart }, `Promo n° ${promoDepart}`));
  }
  const champPromo = el("select", { id: "rg-promo", class: "rg-champ" }, el("option", { value: "" }, "Aucune"), ...optionsPromo);
  champPromo.value = promoDepart;

  const lieux = lieuxDesPromos(promos);
  // Le centre d'avant : celui de l'entrée, sinon celui de son ancienne promo (retirer la promo ne déplace pas l'entrée).
  const promoAvant = depart.promo_id == null ? null : (promos || []).find((p) => String(p.id) === String(depart.promo_id));
  const lieuAvant = depart.lieu_id ?? promoAvant?.lieu_id ?? null;
  const lieuDepart = lieuAvant != null ? String(lieuAvant) : "";
  if (lieuDepart && !lieux.some((l) => String(l.id) === lieuDepart)) lieux.push({ id: Number(lieuDepart), nom: `Centre n° ${lieuDepart}` });
  const champLieu = el("select", { id: "rg-lieu", class: "rg-champ" },
    el("option", { value: "" }, "Tout l'organisme"), ...lieux.map((l) => el("option", { value: String(l.id) }, l.nom)));
  champLieu.value = lieuDepart;
  const blocLieu = el("div", { class: "rg-bloc" },
    el("label", { for: "rg-lieu", class: "rg-etiquette" }, "Centre"),
    champLieu,
    el("p", { class: "rg-aide" }, "Sans promo, l'entrée vaut pour un centre ou pour tout l'organisme."));
  const majLieu = () => { blocLieu.hidden = champPromo.value !== ""; };
  champPromo.addEventListener("change", majLieu);
  majLieu();

  // --- Description, puis la réponse et la suite ---
  const zoneTexte = (id, cle, lignes) => {
    const t = champ(cle, el("textarea", { id, class: "rg-champ rg-texte", rows: String(lignes), maxlength: String(LIMITE_TEXTE) }));
    t.value = texte(depart[cle]);
    return t;
  };
  const champDescription = zoneTexte("rg-description", "description", 4);
  const champReponse = zoneTexte("rg-reponse", "reponse", 3);
  const champDateReponse = champ("date_reponse", el("input", { type: "date", id: "rg-date-reponse", class: "rg-champ", max: aujourdhui }));
  champDateReponse.value = jour(depart.date_reponse);
  const champAction = zoneTexte("rg-action", "action_decidee", 2);
  const champMesure = zoneTexte("rg-mesure", "mesure_prevention", 2);
  const champEtat = el("select", { id: "rg-etat", class: "rg-champ" },
    ...Object.entries(ETATS).map(([cle, libelle]) => el("option", { value: cle }, libelle)));
  champEtat.value = Object.prototype.hasOwnProperty.call(ETATS, depart.etat) ? depart.etat : "ouvert";

  // Une réponse tapée sans date : la date du jour est proposée (modifiable).
  champReponse.addEventListener("input", () => {
    if (champReponse.value.trim() && !champDateReponse.value) champDateReponse.value = aujourdhui;
  });

  const blocMesure = el("div", { class: "rg-bloc" },
    el("label", { for: "rg-mesure", class: "rg-etiquette" }, "Mesure de prévention"),
    champMesure,
    zoneErreur("mesure_prevention"));
  const suite = el("details", { class: "rg-suite" },
    el("summary", {}, "Réponse et suite"),
    el("div", { class: "rg-suite-corps" },
      el("div", { class: "rg-bloc" }, el("label", { for: "rg-reponse", class: "rg-etiquette" }, "Réponse"), champReponse, zoneErreur("reponse")),
      el("div", { class: "rg-bloc" }, el("label", { for: "rg-date-reponse", class: "rg-etiquette" }, "Date de réponse"), champDateReponse,
        zoneErreur("date_reponse")),
      el("div", { class: "rg-bloc" }, el("label", { for: "rg-action", class: "rg-etiquette" }, "Action décidée"), champAction,
        zoneErreur("action_decidee")),
      blocMesure,
      el("div", { class: "rg-bloc" }, el("label", { for: "rg-etat", class: "rg-etiquette" }, "État"), champEtat)));
  suite.open = ["reponse", "date_reponse", "action_decidee", "mesure_prevention"].some((cle) => texte(depart[cle]).trim() !== "")
    || (depart.etat != null && depart.etat !== "ouvert");

  function choisirType(cle) {
    type = cle;
    boutonsType.forEach((b) => b.setAttribute("aria-pressed", b.dataset.type === cle ? "true" : "false"));
    erreurs.type.textContent = "";
    majMesure();
  }
  // La mesure de prévention ne concerne qu'un risque : cachée pour les autres types, et jamais envoyée.
  function majMesure() { blocMesure.hidden = type !== "risque"; }
  majMesure();

  // La saisie telle qu'elle est à l'écran.
  const lireChamps = () => ({
    type, date_constat: champDate.value, origine: champOrigine.value, promo_id: champPromo.value, lieu_id: champLieu.value,
    description: champDescription.value, reponse: champReponse.value, date_reponse: champDateReponse.value,
    action_decidee: champAction.value, mesure_prevention: type === "risque" ? champMesure.value : "", etat: champEtat.value,
  });
  const saisieDeDepart = JSON.stringify(lireChamps());
  const modifiee = () => JSON.stringify(lireChamps()) !== saisieDeDepart;

  // Ce qui part vers la base : les seuls champs de la saisie, un champ vide en null. Avec une promo, la base pose le centre
  // d'après elle ; une promo inchangée garde le centre de l'entrée (la promo a pu changer de centre depuis).
  function envoi(champs) {
    const promoId = champs.promo_id === "" ? null : Number(champs.promo_id);
    let lieuId = null;
    if (promoId == null) lieuId = champs.lieu_id === "" ? null : Number(champs.lieu_id);
    else if (modification && entree.promo_id != null && Number(entree.promo_id) === promoId) lieuId = entree.lieu_id ?? null;
    const donnees = {
      type: champs.type, date_constat: vide(champs.date_constat), origine: vide(champs.origine), promo_id: promoId, lieu_id: lieuId,
      description: vide(champs.description), reponse: vide(champs.reponse), date_reponse: vide(champs.date_reponse),
      action_decidee: vide(champs.action_decidee), mesure_prevention: champs.type === "risque" ? vide(champs.mesure_prevention) : null,
      etat: champs.etat,
    };
    if (!modification && prerempli?.signalement_id != null) donnees.signalement_id = prerempli.signalement_id;
    return donnees;
  }

  const erreurGenerale = el("p", { class: "rg-erreur rg-erreur-generale", role: "alert" });
  const boutonEnregistrer = el("button", { type: "button", class: "btn primary rg-enregistrer" }, "Enregistrer");
  const champDe = {
    type: boutonsType[0], date_constat: champDate, origine: champOrigine, description: champDescription, reponse: champReponse,
    date_reponse: champDateReponse, action_decidee: champAction, mesure_prevention: champMesure,
  };

  function montrerErreurs(liste) {
    for (const cle of ORDRE) {
      const message = liste[cle] || "";
      erreurs[cle].textContent = message;
      if (cle !== "type") champDe[cle].setAttribute("aria-invalid", message ? "true" : "false");
    }
    const premier = ORDRE.find((cle) => liste[cle]);
    if (!premier) return;
    if (REPLIES.has(premier)) suite.open = true;
    const cible = premier === "type" ? (boutonsType.find((b) => b.getAttribute("aria-pressed") === "true") || boutonsType[0]) : champDe[premier];
    cible.focus();
  }

  async function enregistrer() {
    if (envoiEnCours) return;
    erreurGenerale.textContent = "";
    const champs = lireChamps();
    const verdict = validerEntree(champs, aujourdhui);
    montrerErreurs(verdict.erreurs);
    if (!verdict.ok) return;
    envoiEnCours = true;
    boutonEnregistrer.textContent = "Enregistrement…";
    boutonEnregistrer.setAttribute("aria-busy", "true");
    try {
      const donnees = envoi(champs);
      const enregistree = modification ? await modifierEntreeRegistre(entree.id, donnees) : await ajouterEntreeRegistre(donnees);
      enregistre = true;
      // Fermée pendant l'envoi (adresse changée), la fenêtre n'est plus là : ne pas fermer celle qui a pu s'ouvrir depuis.
      if (fenetreOuverte() === NOM && fenetre.isConnected) fermerFenetre();
      toast(modification ? "Entrée du registre enregistrée" : "Entrée ajoutée au registre", "success");
      if (typeof surEnregistre === "function") surEnregistre(enregistree);
    } catch (e) {
      console.error(e);
      erreurGenerale.textContent = `${e.message || "L'entrée n'a pas pu être enregistrée."} Votre saisie est gardée.`;
    } finally {
      envoiEnCours = false;
      boutonEnregistrer.textContent = "Enregistrer";
      boutonEnregistrer.removeAttribute("aria-busy");
    }
  }
  boutonEnregistrer.addEventListener("click", enregistrer);

  // « Fermer », le voile ou Échap sur une saisie modifiée : la fenêtre reste, et demande d'abord.
  function avantFermeture() {
    if (enregistre || !modifiee()) return true;
    if (confirmationEnCours) return false;
    confirmationEnCours = true;
    confirmer({ titre: "Fermer sans enregistrer ?", phrase: "Ce que vous avez saisi sera perdu.", oui: "Fermer", non: "Continuer" })
      .then((oui) => {
        confirmationEnCours = false;
        if (oui && fenetreOuverte() === NOM && fenetre.isConnected) fermerFenetre();
      });
    return false;
  }

  const titre = modification ? `Entrée n° ${entree.id}` : "Nouvelle entrée au registre";
  const fermer = el("button", { type: "button", class: "rg-fermer", onClick: () => demanderFermeture() }, "Fermer");
  const fenetre = ouvrirFenetre({
    nom: NOM, retour: ancre, etiquette: titre, classe: "registre-fenetre", avantFermeture,
    contenu: [
      el("div", { class: "rg-tete" }, el("h2", { class: "rg-titre" }, titre), fermer),
      el("p", { class: "rg-rappel" }, RAPPEL_VIOLENCES),
      (modification && entree.issu_signalement) || (!modification && prerempli?.signalement_id != null)
        ? el("p", { class: "rg-aide" }, "Entrée issue d'un problème signalé dans l'app.") : null,
      el("div", { class: "rg-bloc" },
        el("p", { class: "rg-etiquette", id: "rg-type-titre" }, "Type"),
        groupeType,
        zoneErreur("type")),
      el("div", { class: "rg-deux" },
        el("div", { class: "rg-bloc" }, el("label", { for: "rg-date", class: "rg-etiquette" }, "Date du constat"), champDate,
          zoneErreur("date_constat")),
        el("div", { class: "rg-bloc" }, el("label", { for: "rg-origine", class: "rg-etiquette" }, "Origine"), champOrigine,
          zoneErreur("origine"))),
      el("div", { class: "rg-bloc" }, el("label", { for: "rg-promo", class: "rg-etiquette" }, "Promo"), champPromo),
      blocLieu,
      el("div", { class: "rg-bloc" },
        el("label", { for: "rg-description", class: "rg-etiquette" }, "Description"),
        champDescription,
        el("p", { class: "rg-aide rg-personne", id: "rg-personne" }, NE_NOMME_PERSONNE),
        zoneErreur("description")),
      suite,
      erreurGenerale,
      el("div", { class: "rg-actions" }, boutonEnregistrer),
    ],
  });
  return fenetre;
}
