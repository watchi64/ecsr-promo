// Réglages du centre, espace contact (tâche 6), pour la direction (vouvoiement) : « Financements » (la liste proposée pour chaque
// stagiaire : ajouter, renommer, retirer, ordre) et « Fiches à supprimer » (les fiches sans compte dont la date de départ est
// passée : la suppression se fait à la main, depuis la page Contacts).
// Financements : chaque geste envoie la liste entière du centre (regler_financements) à partir de la liste ENREGISTRÉE et d'un seul
// changement (js/contact-annuaire-rules.js, listeFinancements) : un seul nom change à la fois, l'échange de deux noms que la base
// refuserait n'est jamais demandé. La base décide de tout (droit, doublons) ; ses refus se disent par leur phrase.

import { lireFinancements, reglerFinancements, lireAnnuaire } from "../db.js?v=20261114f";
import { el, clear, toast } from "../utils.js?v=20261114f";
import { icon } from "../icons.js?v=20261114f";
import { phraseDeRefus } from "../espaces-rules.js?v=20261114f";
import { jourParis, dateLongue } from "../dates.js?v=20261114f";
import { listeFinancements, validerLibelleFinancement, fichesASupprimer } from "../contact-annuaire-rules.js?v=20261114f";

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
