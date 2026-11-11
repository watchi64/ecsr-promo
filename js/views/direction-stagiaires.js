// Page Stagiaires de la direction (lot 5, Task 9) : tous les stagiaires du centre, groupés par promo (en formation d'abord, les
// abandons repliés), avec une recherche par nom et un filtre de promo. Un nom ouvre sa fiche : celle d'une promo affichée dans la
// page, celle d'une autre promo par bascule (ouvrirDansUnePromo, D7). Le groupe de la promo affichée porte la gestion (ajout,
// abandon, réactivation, anonymisation, invitation du compte, js/views/stagiaires-gestion.js) ; les autres groupes portent « Gérer
// cette promo ». Les élèves bénévoles n'y sont pas (D12). Les règles (groupes, recherche, fiche du centre) vivent dans
// js/direction-rules.js. Le centre est celui du compte (getCentre) : la fiche d'un autre centre n'est jamais lue ni montrée, une
// phrase le dit (Review Focus 1).

import {
  getMesPromos, getPromoCourante, lireStagiairesPromo, ouvrirDansUnePromo,
} from "../db.js?v=20261111k";
import { el, clear, isoDate, displayStagiaire, toast } from "../utils.js?v=20261111k";
import { icon } from "../icons.js?v=20261111k";
import { getCentre } from "../auth-admin.js?v=20261111k";
import { promosDuCentre } from "../espaces-rules.js?v=20261111k";
import { etatPromo, ouTrouverFiche, listeDuCentre } from "../direction-rules.js?v=20261111k";
import { adresseFiche, lireAdresse } from "../route-rules.js?v=20261111k";
import { surChangementAdresse, remplacerAdresse } from "../navigation.js?v=20261111k";
import { renderGestionStagiaires, renderInvitationStagiaire } from "./stagiaires-gestion.js?v=20261111k";
import { chargerContexteFiche, chargerFiche, renderFiche, dispositionFiche, afficherErreur } from "./mon-suivi.js?v=20261111k";
import { entier, pluriel } from "../nombres.js?v=20261111k";

export const PHRASE_FICHE_HORS_CENTRE = "Cette fiche n'est pas dans votre centre.";
const PHRASE_SANS_CENTRE = "Ce compte ne dirige aucun centre.";
const PHRASE_SANS_PROMO = "Ce centre n'a pas encore de promo";
const PHRASE_LECTURE_ECHEC = "Les stagiaires du centre n'ont pas pu être chargés.";
const PHRASE_PROMO_ILLISIBLE = "Les stagiaires de cette promo n'ont pas pu être lus.";
const PHRASE_GESTION_ECHEC = "La gestion de la promo n'a pas pu être chargée.";
const CLE_ONGLET = "ecsr_stagiaires_centre_subtab";

let rendu = 0;

// Le centre dirigé et ses promos (la plus récente d'abord) ; `affichee` : la promo affichée SI elle est de ce centre.
function contexte() {
  const centre = getCentre();
  if (!centre) return { centre: null, promos: [], affichee: null };
  const promos = promosDuCentre(getMesPromos(), centre.id)
    .slice().sort((a, b) => String(b.date_debut || "").localeCompare(String(a.date_debut || "")) || a.id - b.id);
  const courante = getPromoCourante();
  return { centre, promos, affichee: courante && courante.lieu_id === centre.id ? courante : null };
}

// Les fiches de chaque promo du centre, lues par l'en-tête de lecture. Une promo illisible n'empêche pas les autres : elle est
// listée à part (on ne conclut jamais « fiche absente du centre » sans l'avoir lue).
async function lireListes(promos) {
  const reponses = await Promise.allSettled(promos.map((p) => lireStagiairesPromo(p.id)));
  const listes = [];
  const illisibles = [];
  reponses.forEach((r, i) => {
    const p = promos[i];
    if (r.status === "fulfilled") {
      listes.push({ promoId: p.id, nom: p.nom, stagiaires: r.value.map((s) => ({ ...s, actif: s.actif !== false })) });
    } else {
      console.error("stagiaires de la promo " + p.id, r.reason);
      illisibles.push(p.id);
    }
  });
  return { listes, illisibles };
}

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

export async function renderStagiairesCentre(container) {
  const jeton = ++rendu;
  clear(container);
  const { centre, promos, affichee } = contexte();
  if (!centre) {
    container.appendChild(el("p", { class: "muted" }, PHRASE_SANS_CENTRE));
    return;
  }
  const racine = el("div", { class: "centre stg-centre" });
  container.appendChild(racine);
  const entete = (sousTitre) => el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Centre de " + (centre.nom || "")),
      el("h2", {}, "Stagiaires"),
      el("p", { class: "subtitle" }, sousTitre)));

  if (!promos.length) {
    racine.appendChild(entete("Aucune promo pour le moment"));
    racine.appendChild(el("div", { class: "centre-section centre-vide" },
      el("p", {}, PHRASE_SANS_PROMO + "."),
      el("a", { class: "btn primary", href: "#/promos" }, "Créer une promo")));
    return;
  }

  racine.appendChild(entete("Les stagiaires de toutes les promos du centre"));
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  const { listes, illisibles } = await lireListes(promos);
  if (jeton !== rendu) return;
  const recharger = () => renderStagiairesCentre(container);

  // État de la page : les listes lues, le filtre, la gestion de la promo affichée (construite une fois, elle garde ses saisies).
  const etat = { listes, filtre: { texte: "", promoId: "" }, phrase: null, gestion: false };
  const zoneGestion = el("div", { class: "stg-gestion" });
  let gestionPrete = false;

  // Relecture de la promo affichée après une écriture de la gestion : `seulementListe` redessine les noms sans toucher à la gestion
  // (un ajout, un renommage), sinon la gestion est reconstruite aussi (un abandon change ses deux blocs).
  async function relireAffichee(seulementListe) {
    if (!affichee) return;
    try {
      const lignes = await lireStagiairesPromo(affichee.id);
      if (jeton !== rendu) return;
      const entree = etat.listes.find((l) => l.promoId === affichee.id);
      const stagiaires = lignes.map((s) => ({ ...s, actif: s.actif !== false }));
      if (entree) entree.stagiaires = stagiaires;
      else etat.listes.push({ promoId: affichee.id, nom: affichee.nom, stagiaires });
    } catch (e) {
      console.error("relecture des stagiaires de la promo affichée", e);
    }
    if (jeton !== rendu) return;
    if (!seulementListe) await remplirGestion();
    if (!document.getElementById("stg-groupes")) return;
    // Un ajout ou un renommage garde le focus dans la gestion (clavier du téléphone, saisie en cours) : seule la liste de liens du
    // groupe est remplacée, la zone de gestion n'est ni détachée ni déplacée.
    if (seulementListe && majGroupeAffiche()) return;
    dessinerGroupes();
  }

  // Remplace, dans le groupe de la promo affichée, tout sauf la zone de gestion. Faux si le groupe n'est pas à l'écran (filtre).
  function majGroupeAffiche() {
    const entree = etat.listes.find((l) => affichee && l.promoId === affichee.id);
    const ancien = document.querySelector(`#stg-groupes .stg-groupe[data-promo="${affichee ? affichee.id : ""}"]`);
    const g = entree ? listeDuCentre([entree], etat.filtre)[0] : null;
    if (!ancien || !g || !ancien.contains(zoneGestion)) return false;
    // En gestion, la liste n'est pas à l'écran (la gestion la remplace) : seul le compte de l'en-tête suit.
    if (etat.gestion) {
      const compte = ancien.querySelector(".stg-compte");
      if (compte) compte.textContent = pluriel(g.enFormation.length, "stagiaire") + " en formation";
      return true;
    }
    const neuf = groupe(g, false);
    [...ancien.children].forEach((enfant) => { if (enfant !== zoneGestion) enfant.remove(); });
    [...neuf.children].reverse().forEach((enfant) => ancien.insertBefore(enfant, ancien.firstChild));
    return true;
  }

  async function remplirGestion() {
    clear(zoneGestion);
    try {
      await renderGestionStagiaires(zoneGestion, { rerender: () => relireAffichee(false), surChangement: () => relireAffichee(true) });
      await renderInvitationStagiaire(zoneGestion, { rerender: () => remplirGestion() });
    } catch (e) {
      console.error("gestion des stagiaires de la promo affichée", e);
      clear(zoneGestion);
      zoneGestion.appendChild(boiteErreur(PHRASE_GESTION_ECHEC, () => remplirGestion()));
    }
    gestionPrete = true;
  }

  // Ouvrir une page d'une autre promo du centre : elle devient la promo affichée, l'app se recharge sur l'adresse visée. Une bascule
  // impossible le dit, rien ne change.
  async function aller(promoId, adresse) {
    const phrase = await ouvrirDansUnePromo(promoId, adresse);
    if (phrase) toast(phrase, "error", 4000);
    return phrase;
  }

  // ---------------------------------------------------------------- La liste

  function ligneStagiaire(promoId, s, abandon) {
    const href = adresseFiche("stagiaires", s.id, null);
    const lien = el("a", { class: "stg-ligne" + (abandon ? " stg-ligne-abandon" : ""), href },
      el("span", { class: "stg-ligne-texte" },
        el("span", { class: "stg-nom" }, displayStagiaire(s)),
        abandon ? el("span", { class: "stg-etats" }, "Abandon") : null),
      icon.chevronRight());
    if (!affichee || promoId !== affichee.id) {
      // Une autre promo : elle devient la promo affichée avant que la fiche s'ouvre.
      lien.addEventListener("click", (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        aller(promoId, href);
      });
    }
    return lien;
  }

  function groupe(g, avecGestion = true) {
    const promo = promos.find((p) => p.id === g.promoId);
    const estAffichee = !!affichee && g.promoId === affichee.id;
    const aujourdhui = isoDate(new Date());
    const etatP = promo ? etatPromo(promo, aujourdhui) : null;
    const section = el("section", { class: "centre-section stg-groupe", "data-promo": String(g.promoId) });
    section.appendChild(el("div", { class: "centre-section-tete" },
      el("h3", {}, g.nom),
      etatP ? el("span", { class: "chip promo-etat promo-etat-" + (etatP === "en cours" ? "cours" : etatP === "à venir" ? "venir" : "fin") }, etatP) : null,
      estAffichee ? el("span", { class: "chip centre-promo" }, "Affichée") : null,
      el("span", { class: "muted stg-compte" }, pluriel(g.enFormation.length, "stagiaire") + " en formation"),
      estAffichee ? el("button", { class: "btn small stg-gerer", type: "button", "aria-expanded": String(etat.gestion),
        "aria-label": etat.gestion ? `Fermer la gestion de ${g.nom}` : `Gérer les stagiaires de ${g.nom}`,
        onClick: () => {
          etat.gestion = !etat.gestion;
          dessinerGroupes();
          const bouton = document.querySelector(`#stg-groupes .stg-groupe[data-promo="${g.promoId}"] .stg-gerer`);
          if (bouton) bouton.focus({ preventScroll: true });
        } }, etat.gestion ? "Fermer" : "Gérer") : null));
    // La gestion prend la place de la liste (renommer, abandon, effacer, ajouter, inviter) : une seule liste à l'écran.
    if (estAffichee && etat.gestion) {
      if (avecGestion) section.appendChild(zoneGestion);
      return section;
    }
    if (g.enFormation.length) {
      section.appendChild(el("nav", { class: "stg-liste", "aria-label": "Stagiaires de " + g.nom },
        ...g.enFormation.map((s) => ligneStagiaire(g.promoId, s, false))));
    } else if (!etat.filtre.texte) {
      section.appendChild(el("p", { class: "muted" }, "Aucun stagiaire en formation dans cette promo."));
    }
    if (g.abandons.length) {
      section.appendChild(el("details", { class: "stg-abandons" },
        el("summary", {}, `Abandons (${g.abandons.length})`),
        el("nav", { class: "stg-liste", "aria-label": "Abandons de " + g.nom },
          ...g.abandons.map((s) => ligneStagiaire(g.promoId, s, true)))));
    }
    if (g.anonymises) {
      section.appendChild(el("p", { class: "muted stg-anonymises" },
        pluriel(g.anonymises, "fiche anonymisée", "fiches anonymisées") + " (données effacées, résultats conservés sans nom)."));
    }
    if (!estAffichee) {
      section.appendChild(el("div", { class: "promo-actions" },
        el("button", { class: "btn small", type: "button", onClick: () => aller(g.promoId, "#/stagiaires") }, "Gérer cette promo")));
    }
    return section;
  }

  function dessinerGroupes() {
    const zone = document.getElementById("stg-groupes");
    if (!zone) return;
    // La gestion garde ses nœuds : détachée avant de vider la zone, rattachée par son groupe.
    zoneGestion.remove();
    clear(zone);
    const groupes = listeDuCentre(etat.listes, etat.filtre);
    illisibles.filter((id) => etat.filtre.promoId === "" || String(id) === String(etat.filtre.promoId)).forEach((id) => {
      const p = promos.find((x) => x.id === id);
      zone.appendChild(el("section", { class: "centre-section stg-groupe" },
        el("div", { class: "centre-section-tete" }, el("h3", {}, p ? p.nom : "Promo " + id)),
        boiteErreur(PHRASE_PROMO_ILLISIBLE + (affichee && id === affichee.id ? " La gestion de la promo affichée n'a pas pu être chargée." : ""), recharger)));
    });
    if (!groupes.length && !zone.children.length) {
      const cherche = etat.filtre.texte.trim();
      zone.appendChild(el("div", { class: "centre-section centre-vide" },
        el("p", {}, cherche ? `Aucun stagiaire ne correspond à « ${cherche} ».` : "Aucun stagiaire dans ce choix de promo."),
        el("button", { class: "btn small", type: "button", onClick: () => {
          etat.filtre = { texte: "", promoId: "" };
          const champ = document.getElementById("stg-recherche");
          const choix = document.getElementById("stg-promo");
          if (champ) champ.value = "";
          if (choix) choix.value = "";
          dessinerGroupes();
        } }, "Voir tous les stagiaires")));
      return;
    }
    groupes.forEach((g) => zone.appendChild(groupe(g)));
  }

  function montrerListe() {
    clear(racine);
    const lues = etat.listes.flatMap((l) => l.stagiaires.filter((s) => s.actif && !s.anonymise_le));
    // Une promo illisible rendrait le compte faux sans le dire : il n'est annoncé que si toutes les promos ont été lues.
    racine.appendChild(entete(illisibles.length ? "Les stagiaires de toutes les promos du centre"
      : `${pluriel(lues.length, "stagiaire")} en formation · ${pluriel(promos.length, "promo")}`));
    if (etat.phrase) {
      racine.appendChild(el("p", { class: "stg-phrase", role: "alert" }, etat.phrase));
      etat.phrase = null;
    }
    const champ = el("input", { type: "search", id: "stg-recherche", value: etat.filtre.texte, autocomplete: "off",
      placeholder: "Nom ou prénom" });
    champ.addEventListener("input", () => { etat.filtre.texte = champ.value; dessinerGroupes(); });
    const choix = el("select", { id: "stg-promo" },
      el("option", { value: "" }, "Toutes les promos"),
      ...promos.map((p) => el("option", { value: String(p.id) }, p.nom)));
    choix.value = String(etat.filtre.promoId);
    choix.addEventListener("change", () => { etat.filtre.promoId = choix.value; dessinerGroupes(); });
    racine.appendChild(el("div", { class: "stg-filtre", role: "search" },
      el("div", { class: "field" }, el("label", { for: "stg-recherche" }, "Rechercher un stagiaire"), champ),
      el("div", { class: "field" }, el("label", { for: "stg-promo" }, "Promo"), choix)));
    racine.appendChild(el("div", { id: "stg-groupes" }));
    dessinerGroupes();
    if (!gestionPrete && affichee) remplirGestion();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- La fiche d'une personne de la promo affichée

  let generation = 0;
  async function montrerFiche(adr) {
    const courant = ++generation;
    const disposition = dispositionFiche();
    const entree = etat.listes.flatMap((l) => l.stagiaires).find((s) => String(s.id) === String(adr.id));
    clear(racine);
    const zone = el("div", { class: "stg-fiche" });
    if (disposition === "onglets") {
      racine.appendChild(el("a", { class: "fiche-retour", href: "#/stagiaires" }, icon.chevronLeft(), el("span", {}, "Stagiaires du centre")));
    }
    racine.appendChild(zone);
    zone.appendChild(el("div", { class: "loading" }, "Chargement"));
    window.scrollTo(0, 0);
    let donnees;
    try {
      await chargerContexteFiche();
      donnees = await chargerFiche(Number(adr.id));
    } catch (e) {
      if (courant === generation) afficherErreur(zone, e, () => montrerFiche(adr));
      return;
    }
    if (courant !== generation || jeton !== rendu) return;
    renderFiche(zone, donnees, {
      soi: false, partie: adr.partie, disposition,
      titre: entree ? displayStagiaire(entree) : "Stagiaire",
      retour: disposition === "sommaire" ? { label: "Stagiaires du centre", href: "#/stagiaires" } : null,
      adresse: (p) => adresseFiche("stagiaires", adr.id, p),
      storageKey: CLE_ONGLET,
    });
  }

  // ---------------------------------------------------------------- L'adresse décide de la vue

  // Une fiche du centre : celle de la promo affichée s'ouvre ici, celle d'une autre promo par bascule. Une fiche qui n'est dans
  // aucune promo du centre (ou un identifiant inconnu) ramène à la liste avec la phrase. Si une promo n'a pas pu être lue, on ne
  // conclut rien : la page le dit et propose « Réessayer ».
  async function suivre(adr) {
    if (jeton !== rendu) return;
    if (adr.id == null) { generation++; montrerListe(); return; }
    const trouvee = ouTrouverFiche(adr.id, etat.listes);
    if (trouvee && affichee && trouvee.promoId === affichee.id) { await montrerFiche(adr); return; }
    if (trouvee) {
      generation++;
      clear(racine);
      racine.appendChild(el("div", { class: "loading" }, "Ouverture de la promo"));
      const phrase = await aller(trouvee.promoId, adresseFiche("stagiaires", adr.id, adr.partie));
      if (phrase && jeton === rendu) { remplacerAdresse("#/stagiaires"); montrerListe(); }
      return;
    }
    if (illisibles.length) {
      generation++;
      clear(racine);
      racine.appendChild(entete("Les stagiaires de toutes les promos du centre"));
      racine.appendChild(boiteErreur(PHRASE_LECTURE_ECHEC, recharger));
      return;
    }
    remplacerAdresse("#/stagiaires");
    etat.phrase = PHRASE_FICHE_HORS_CENTRE;
    generation++;
    montrerListe();
  }

  surChangementAdresse("stagiaires", suivre);
  await suivre(lireAdresse(location.hash));
}
