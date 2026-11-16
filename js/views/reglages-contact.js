// Réglages du centre, espace contact (tâche 6), pour la direction (vouvoiement) : « Financements » (la liste proposée pour chaque
// stagiaire : ajouter, renommer, retirer, ordre) et « Fiches à supprimer » (les fiches sans compte dont la date de départ est
// passée : la suppression se fait à la main, depuis la page Contacts).
// Financements : chaque geste envoie la liste entière du centre (regler_financements) à partir de la liste ENREGISTRÉE et d'un seul
// changement (js/contact-annuaire-rules.js, listeFinancements) : un seul nom change à la fois, l'échange de deux noms que la base
// refuserait n'est jamais demandé. La base décide de tout (droit, doublons) ; ses refus se disent par leur phrase.

import { lireFinancements, reglerFinancements, lireAnnuaire, reglagesContact, reglerQuiRecoitQuoi, reglerReponses } from "../db.js?v=20261116a";
import { el, clear, toast } from "../utils.js?v=20261116a";
import { icon } from "../icons.js?v=20261116a";
import { phraseDeRefus } from "../espaces-rules.js?v=20261116a";
import { jourParis, dateLongue } from "../dates.js?v=20261116a";
import { listeFinancements, validerLibelleFinancement, fichesASupprimer } from "../contact-annuaire-rules.js?v=20261116a";
import { TYPES_DEMANDE, phraseReglesCentre, phraseContact, reglagesModifiables } from "../contact-rules.js?v=20261116a";

export const PHRASE_SANS_FICHE_A_SUPPRIMER = "Aucune fiche à supprimer.";
export const PHRASE_FICHES_A_SUPPRIMER = "Ces personnes ont quitté le centre : supprimez leur fiche depuis la page Contacts.";

const enTete = (id, titre, sous) => el("div", { class: "param-section-head" },
  el("div", { class: "param-icon" }, icon.users ? icon.users() : icon.user()),
  el("div", {}, el("h3", { id }, titre), el("p", { class: "muted" }, sous)));

const boiteErreur = (phrase, reessayer) => el("div", { class: "centre-erreur", role: "alert" },
  el("p", {}, phrase), el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));

// ============================================================== Financements

export function sectionFinancements(centre) {
  const section = el("section", { class: "param-section reglage-financements", "aria-labelledby": "financements-titre" });
  section.appendChild(enTete("financements-titre", "Financements",
    "La liste que vous proposez pour chaque stagiaire (CPF, Région, France Travail...)."));
  const corps = el("div", { class: "param-block" });
  section.appendChild(corps);
  // Le compte rendu du dernier geste, lu par les lecteurs d'écran.
  const annonce = el("p", { class: "cons-statut", role: "status", "aria-live": "polite" });
  let lignes = [];
  let occupe = false;

  async function charger(focus = null) {
    clear(corps);
    corps.appendChild(el("div", { class: "loading", role: "status" }, "Chargement"));
    try {
      lignes = await lireFinancements();
    } catch (e) {
      console.error("financements du centre", e);
      if (!corps.isConnected) return;
      clear(corps);
      corps.appendChild(boiteErreur("Les financements n'ont pas pu être chargés.", () => charger()));
      return;
    }
    if (!corps.isConnected) return;
    dessiner(focus);
  }

  // Un geste : la liste entière change d'une seule chose, la page se relit, le focus revient sur la ligne touchée.
  async function envoyer(action, { ok, erreur, focus }) {
    if (occupe) return;
    occupe = true;
    try {
      await reglerFinancements(centre.id, listeFinancements(lignes, action));
      toast(ok, "success", 1800);
      annonce.textContent = ok;
      occupe = false;
      await charger(focus);
    } catch (e) {
      console.error("financements du centre", e);
      occupe = false;
      erreur(phraseDeRefus(e.message, e.code));
    }
  }

  function ligneDe(l, i) {
    const dire = el("p", { class: "contact-champ-erreur", role: "alert" });
    const saisie = el("input", { type: "text", id: "financement-" + l.id, value: l.libelle, maxlength: "40", autocomplete: "off",
      "aria-label": "Nom du financement " + l.libelle });
    const renommer = el("button", { class: "btn small", type: "button", disabled: true, onClick: () => {
      dire.textContent = "";
      const phrase = validerLibelleFinancement(saisie.value, lignes, l.id);
      if (phrase) { dire.textContent = phrase; saisie.focus(); return; }
      envoyer({ geste: "renommer", id: l.id, libelle: saisie.value },
        { ok: "Financement renommé.", erreur: (p) => { dire.textContent = p; }, focus: "#financement-" + l.id });
    } }, "Renommer");
    saisie.addEventListener("input", () => {
      renommer.disabled = String(saisie.value).replace(/\s+/g, " ").trim() === l.libelle;
    });
    const gestes = [
      renommer,
      el("button", { class: "btn small ghost", type: "button", disabled: i === 0, "aria-label": "Monter " + l.libelle,
        onClick: () => envoyer({ geste: "deplacer", id: l.id, sens: -1 },
          { ok: "Ordre enregistré.", erreur: (p) => { dire.textContent = p; }, focus: "#financement-" + l.id }) }, "Monter"),
      el("button", { class: "btn small ghost", type: "button", disabled: i === lignes.length - 1, "aria-label": "Descendre " + l.libelle,
        onClick: () => envoyer({ geste: "deplacer", id: l.id, sens: 1 },
          { ok: "Ordre enregistré.", erreur: (p) => { dire.textContent = p; }, focus: "#financement-" + l.id }) }, "Descendre"),
      el("button", { class: "btn small " + (l.retire ? "" : "danger"), type: "button", "aria-label": (l.retire ? "Remettre " : "Retirer ") + l.libelle,
        onClick: () => envoyer({ geste: "retirer", id: l.id, retire: !l.retire },
          { ok: l.retire ? "Financement remis dans la liste." : "Financement retiré de la liste.", erreur: (p) => { dire.textContent = p; },
            focus: "#financement-" + l.id }) }, l.retire ? "Remettre" : "Retirer"),
    ];
    return el("li", { class: "financement-ligne" + (l.retire ? " financement-retire" : "") },
      el("div", { class: "field" },
        el("label", { for: "financement-" + l.id }, l.retire ? "Financement (retiré)" : "Financement"), saisie, dire),
      el("div", { class: "contact-gestes" }, ...gestes));
  }

  function dessiner(focus) {
    clear(corps);
    corps.appendChild(el("p", { class: "muted" },
      "Un financement retiré n'est plus proposé pour un nouveau stagiaire ; il reste affiché pour ceux qui l'ont déjà."));
    corps.appendChild(lignes.length
      ? el("ul", { class: "financement-liste" }, ...lignes.map(ligneDe))
      : el("p", { class: "muted" }, "Aucun financement pour ce centre."));
    // Ajouter : un nom, un bouton.
    const dire = el("p", { class: "contact-champ-erreur", role: "alert" });
    const saisie = el("input", { type: "text", id: "financement-nouveau", maxlength: "40", autocomplete: "off" });
    const ajouter = () => {
      dire.textContent = "";
      const phrase = validerLibelleFinancement(saisie.value, lignes);
      if (phrase) { dire.textContent = phrase; saisie.focus(); return; }
      envoyer({ geste: "ajouter", libelle: saisie.value },
        { ok: "Financement ajouté.", erreur: (p) => { dire.textContent = p; }, focus: "#financement-nouveau" });
    };
    saisie.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } });
    corps.appendChild(el("div", { class: "financement-ajout" },
      el("div", { class: "field" }, el("label", { for: "financement-nouveau" }, "Nouveau financement"), saisie, dire),
      el("button", { class: "btn small accent", type: "button", onClick: ajouter }, icon.plus(), "Ajouter")));
    corps.appendChild(annonce);
    if (focus) corps.querySelector(focus)?.focus({ preventScroll: true });
  }

  charger();
  return section;
}

// ============================================================== Fiches à supprimer

export function sectionFichesASupprimer() {
  const section = el("section", { class: "param-section reglage-fiches-a-supprimer", "aria-labelledby": "fiches-a-supprimer-titre" });
  section.appendChild(enTete("fiches-a-supprimer-titre", "Fiches à supprimer",
    "Les personnes de l'équipe sans compte dont la date de départ est passée."));
  const corps = el("div", { class: "param-block" });
  section.appendChild(corps);

  async function charger() {
    clear(corps);
    corps.appendChild(el("div", { class: "loading", role: "status" }, "Chargement"));
    let liste;
    try {
      liste = fichesASupprimer(await lireAnnuaire(), jourParis(new Date()));
    } catch (e) {
      console.error("fiches à supprimer", e);
      if (!corps.isConnected) return;
      clear(corps);
      corps.appendChild(boiteErreur("Les fiches n'ont pas pu être chargées.", charger));
      return;
    }
    if (!corps.isConnected) return;
    clear(corps);
    if (!liste.length) { corps.appendChild(el("p", { class: "muted" }, PHRASE_SANS_FICHE_A_SUPPRIMER)); return; }
    corps.appendChild(el("p", {}, PHRASE_FICHES_A_SUPPRIMER));
    corps.appendChild(el("ul", { class: "financement-liste" }, ...liste.map((f) =>
      el("li", { class: "financement-ligne" },
        el("span", { class: "contact-promo-nom" }, f.nom_affiche || "Sans nom"),
        el("span", { class: "muted" }, "Parti le " + dateLongue(f.depart_le)),
        el("a", { class: "btn small", href: "#/contacts" }, "Ouvrir les contacts")))));
  }

  charger();
  return section;
}

// ============================================================== Qui reçoit quoi, réponses toutes faites

export const PHRASE_RIEN_REGLE = "Rien n'est réglé : pour chaque demande, le stagiaire choisit qui prévenir parmi les formateurs de sa promo et la direction du centre.";
const TYPES_REGLES = ["absence", "retard", "administratif", "document", "autre"];
const VALEUR_JOUR = "jour";

// Un champ à liste : étiquette et choix, dans le style des champs de la page.
function champListe(id, libelle, select) {
  select.id = id;
  return el("div", { class: "field" }, el("label", { for: id }, libelle), select);
}

// Les deux sections partagent une même lecture (reglages_contact) et se redessinent ensemble après un enregistrement. La base juge les
// droits (lecture : case Réglages du centre ; écriture : geste reglages.modifier) : ses refus se disent par leur phrase. Quand elle dit
// qu'on ne peut pas modifier (peut_modifier faux, reglagesModifiables), les deux sections se montrent en lecture seule : champs
// désactivés, ni « Enregistrer », ni « Ajouter une réponse », ni « Retirer ».
export function sectionsContactDuCentre(centre) {
  const sectionRegles = el("section", { class: "param-section reglage-regles", "aria-labelledby": "regles-titre" });
  sectionRegles.appendChild(enTete("regles-titre", "Qui reçoit quoi",
    "Pour chaque type de demande, la personne que le stagiaire prévient, éventuellement selon son financement."));
  const corpsRegles = el("div", { class: "param-block" });
  sectionRegles.appendChild(corpsRegles);
  const sectionReponses = el("section", { class: "param-section reglage-reponses", "aria-labelledby": "reponses-titre" });
  sectionReponses.appendChild(enTete("reponses-titre", "Réponses toutes faites",
    "Des réponses en un geste, proposées dans le suivi d'une demande (20 au plus)."));
  const corpsReponses = el("div", { class: "param-block" });
  sectionReponses.appendChild(corpsReponses);

  let reglages = null;
  let brouillon = {};     // « type|financement » -> "" (aucune), "jour" ou l'identifiant d'une fiche
  let reponses = [];      // [{ id, libelle, vaut_prise, demande_justificatif }]
  let modifiable = true;  // reglagesModifiables(reglages), relu à chaque chargement

  const cle = (type, fin) => `${type}|${fin ?? ""}`;
  const aLaCarte = () => !!corpsRegles.isConnected;

  async function charger() {
    for (const c of [corpsRegles, corpsReponses]) { clear(c); c.appendChild(el("div", { class: "loading", role: "status" }, "Chargement")); }
    try {
      reglages = await reglagesContact(centre.id);
    } catch (e) {
      console.error("réglages du contact", e);
      if (!aLaCarte()) return;
      for (const c of [corpsRegles, corpsReponses]) {
        clear(c);
        c.appendChild(boiteErreur(phraseContact(e, "Les réglages n'ont pas pu être chargés."), charger));
      }
      return;
    }
    if (!aLaCarte()) return;
    modifiable = reglagesModifiables(reglages);
    brouillon = {};
    for (const r of reglages.regles ?? []) brouillon[cle(r.type, r.financement_id)] = r.cible === "formateurs_du_jour" ? VALEUR_JOUR : String(r.fiche_id);
    reponses = (reglages.reponses ?? []).filter((x) => !x.retire).map((x) => ({
      id: x.id, libelle: x.libelle, vaut_prise: x.vaut_prise !== false, demande_justificatif: x.demande_justificatif === true,
    }));
    dessinerRegles();
    dessinerReponses();
  }

  // Le brouillon en liste de règles pour la base.
  function reglesDuBrouillon() {
    const liste = [];
    for (const [k, v] of Object.entries(brouillon)) {
      if (v === "") continue;
      const [type, fin] = k.split("|");
      liste.push({ type, financement_id: fin === "" ? null : Number(fin), cible: v === VALEUR_JOUR ? "formateurs_du_jour" : "fiche",
        fiche_id: v === VALEUR_JOUR ? null : Number(v) });
    }
    return liste;
  }

  const fiches = () => reglages?.fiches ?? [];
  function listeChoix(type, { aucune }) {
    const select = el("select", {});
    select.disabled = !modifiable;
    select.appendChild(el("option", { value: "" }, aucune));
    if (type === "absence" || type === "retard") select.appendChild(el("option", { value: VALEUR_JOUR }, "Les formateurs du jour"));
    for (const f of fiches()) {
      select.appendChild(el("option", { value: String(f.fiche_id) }, (f.nom || "Sans nom") + (f.joignable ? "" : " (sans adresse e-mail)")));
    }
    return select;
  }

  function dessinerRegles() {
    clear(corpsRegles);
    const financements = (reglages.financements ?? []).filter((f) => !f.retire || Object.keys(brouillon).some((k) => k.endsWith("|" + f.id) && brouillon[k] !== ""));
    if ((reglages.regles ?? []).length === 0) corpsRegles.appendChild(el("p", { class: "contact-encadre", role: "note" }, PHRASE_RIEN_REGLE));
    const apercu = el("ul", { class: "regle-apercu", "aria-live": "polite" });
    const erreur = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });

    const majApercu = () => {
      clear(apercu);
      const draft = { ...reglages, regles: reglesDuBrouillon() };
      for (const type of TYPES_REGLES) {
        apercu.appendChild(el("li", {}, phraseReglesCentre(draft, type, null)));
        for (const f of financements) {
          if ((brouillon[cle(type, f.id)] ?? "") !== "") apercu.appendChild(el("li", {}, phraseReglesCentre(draft, type, f.id)));
        }
      }
    };
    const lier = (select, k) => {
      select.value = brouillon[k] ?? "";
      select.addEventListener("change", () => { brouillon[k] = select.value; majApercu(); });
    };

    // La personne par défaut.
    const defaut = listeChoix("defaut", { aucune: "Personne" });
    lier(defaut, cle("defaut", null));
    corpsRegles.appendChild(el("div", { class: "regle-type" },
      champListe("regle-defaut", "Personne par défaut", defaut),
      el("p", { class: "contact-aide" }, "Elle reçoit les demandes qu'aucune règle ne couvre.")));

    const liste = el("ul", { class: "regle-liste" });
    for (const type of TYPES_REGLES) {
      const general = listeChoix(type, { aucune: "Aucune règle" });
      lier(general, cle(type, null));
      const bloc = el("li", { class: "regle-type" },
        el("h4", { class: "contact-nom" }, TYPES_DEMANDE[type]),
        champListe("regle-" + type, "Pour tous les financements", general));
      if (financements.length) {
        const details = el("details", { class: "regle-financements" }, el("summary", {}, "Selon le financement"));
        for (const f of financements) {
          const s = listeChoix(type, { aucune: "Comme pour tous les financements" });
          lier(s, cle(type, f.id));
          details.appendChild(champListe(`regle-${type}-${f.id}`, f.libelle + (f.retire ? " (retiré)" : ""), s));
        }
        if (financements.some((f) => (brouillon[cle(type, f.id)] ?? "") !== "")) details.open = true;
        bloc.appendChild(details);
      }
      liste.appendChild(bloc);
    }
    corpsRegles.appendChild(liste);

    corpsRegles.appendChild(el("h4", { class: "contact-section-titre" }, "Ce que verra le stagiaire"));
    corpsRegles.appendChild(apercu);
    majApercu();

    const bouton = el("button", { class: "btn primary", type: "button", onClick: async () => {
      erreur.textContent = "";
      bouton.disabled = true;
      try {
        await reglerQuiRecoitQuoi(centre.id, reglesDuBrouillon());
        toast("Règles enregistrées.", "success", 1800);
        await charger();
      } catch (e) {
        console.error("qui reçoit quoi", e);
        erreur.textContent = phraseContact(e, "Les règles n'ont pas été enregistrées. Réessayez dans un instant.");
        bouton.disabled = false;
      }
    } }, icon.check(), "Enregistrer");
    if (!modifiable) {
      corpsRegles.appendChild(el("p", { class: "muted", role: "note" }, "Vous consultez ces règles : les modifier demande le droit de modifier les réglages du centre."));
      return;
    }
    corpsRegles.appendChild(erreur);
    corpsRegles.appendChild(el("div", { class: "contact-gestes-fiche" }, bouton));
  }

  function dessinerReponses() {
    clear(corpsReponses);
    const erreur = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });
    const zone = el("ul", { class: "reponse-liste" });
    const ajout = el("button", { class: "btn small", type: "button", onClick: () => {
      reponses.push({ id: null, libelle: "", vaut_prise: true, demande_justificatif: false });
      lignes(reponses.length - 1);
    } }, icon.plus(), "Ajouter une réponse");

    function lignes(focusIndex = null) {
      clear(zone);
      if (!reponses.length) zone.appendChild(el("li", { class: "muted" }, "Aucune réponse toute faite."));
      reponses.forEach((x, i) => {
        const saisie = el("input", { type: "text", id: "reponse-" + i, value: x.libelle, maxlength: "80", autocomplete: "off" });
        saisie.disabled = !modifiable;
        saisie.addEventListener("input", () => { x.libelle = saisie.value; });
        const prise = el("input", { type: "checkbox", id: "reponse-prise-" + i, checked: x.vaut_prise });
        prise.disabled = !modifiable;
        prise.addEventListener("change", () => { x.vaut_prise = prise.checked; });
        const justif = el("input", { type: "checkbox", id: "reponse-justif-" + i, checked: x.demande_justificatif });
        justif.disabled = !modifiable;
        justif.addEventListener("change", () => { x.demande_justificatif = justif.checked; });
        zone.appendChild(el("li", { class: "financement-ligne reponse-ligne" },
          el("div", { class: "field" }, el("label", { for: "reponse-" + i }, "Réponse"), saisie),
          el("label", { class: "contact-case", for: "reponse-prise-" + i }, prise, el("span", {}, "Vaut prise en compte")),
          el("label", { class: "contact-case", for: "reponse-justif-" + i }, justif, el("span", {}, "Demande le justificatif")),
          modifiable ? el("div", { class: "contact-gestes" },
            el("button", { class: "btn small danger", type: "button", "aria-label": "Retirer la réponse " + (x.libelle || i + 1), onClick: () => {
              reponses.splice(i, 1);
              lignes(Math.min(i, reponses.length - 1));
            } }, "Retirer")) : null));
      });
      ajout.disabled = reponses.length >= 20;
      if (focusIndex != null && focusIndex >= 0) zone.querySelector("#reponse-" + focusIndex)?.focus({ preventScroll: true });
    }
    lignes();

    const bouton = el("button", { class: "btn primary", type: "button", onClick: async () => {
      erreur.textContent = "";
      const liste = reponses.map((x) => ({ ...x, libelle: String(x.libelle ?? "").replace(/\s+/g, " ").trim() }));
      const vide = liste.findIndex((x) => x.libelle === "");
      if (vide >= 0) { erreur.textContent = "Chaque réponse a besoin d'un texte, ou retirez-la."; zone.querySelector("#reponse-" + vide)?.focus(); return; }
      bouton.disabled = true;
      try {
        await reglerReponses(centre.id, liste.map((x) => ({ id: x.id, libelle: x.libelle, vaut_prise: x.vaut_prise, demande_justificatif: x.demande_justificatif })));
        toast("Réponses enregistrées.", "success", 1800);
        await charger();
      } catch (e) {
        console.error("réponses toutes faites", e);
        erreur.textContent = phraseContact(e, "Les réponses n'ont pas été enregistrées. Réessayez dans un instant.");
        bouton.disabled = false;
      }
    } }, icon.check(), "Enregistrer");
    corpsReponses.appendChild(zone);
    if (!modifiable) {
      corpsReponses.appendChild(el("p", { class: "muted", role: "note" }, "Vous consultez ces réponses : les modifier demande le droit de modifier les réglages du centre."));
      return;
    }
    corpsReponses.appendChild(el("div", { class: "contact-gestes-fiche" }, ajout));
    corpsReponses.appendChild(erreur);
    corpsReponses.appendChild(el("div", { class: "contact-gestes-fiche" }, bouton));
  }

  charger();
  return [sectionRegles, sectionReponses];
}
