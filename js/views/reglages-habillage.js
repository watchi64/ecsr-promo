// Réglages du centre (direction) et Réglages du réseau (siège), lot 5, Task 14 : l'habillage par défaut. Le centre fixe l'apparence que
// reçoivent ses comptes tant qu'ils n'ont rien choisi, et peut l'imposer (« Laisser chacun choisir le sien » décoché) ; le réseau
// fixe celle des comptes dont le centre n'a rien fixé. L'ordre de résolution lui-même est celui du lot 3 (js/habillage-regles.js) ;
// ici, seulement les deux réglages. La base décide de tout (droit, valeur) : ses refus se disent par leur phrase, le réglage affiché
// revient à ce que la base a gardé. Les pastilles sont celles du lot 3 (js/habillage-choix.js, mode réglage : rien n'est appliqué à
// l'écran de la personne qui règle).

import { habillageParDefaut, lireHabillageCentre, reglerHabillageCentre, reglerHabillageReseau } from "../db.js?v=20261111j";
import { getCentre } from "../auth-admin.js?v=20261111j";
import { el, clear, toast } from "../utils.js?v=20261111j";
import { icon } from "../icons.js?v=20261111j";
import { blocHabillage } from "../habillage-choix.js?v=20261111j";
import { defautsHabillage, phraseDeRefus, phraseStatut, PHRASE_INDISPONIBLE } from "../espaces-rules.js?v=20261111j";
import { sectionDonneesCentre } from "./reglages-donnees.js?v=20261111j";

export const PHRASE_ECHEC_LECTURE = "Le réglage n'a pas pu être chargé.";
export const PHRASE_ECHEC_ECRITURE = "Le réglage n'a pas été enregistré. Réessayez dans un instant.";
export const PHRASE_SANS_CENTRE = "Aucun centre n'est affiché pour ce compte.";
export const LIBELLE_LIBRE = "Laisser chacun choisir le sien";
const DELAI_MS = 15000;

let rendu = 0;

// Un refus qui a sa phrase (droit manquant, fonction ou colonne absente avant la migration, phrase de la base) la dit ; toute autre
// panne, la phrase générique de la page.
export function phraseDEchec(e, generique) {
  const code = e && e.code;
  const message = String((e && e.message) || "");
  if (code === "PGRST202" || code === "42703" || code === "42883") return PHRASE_INDISPONIBLE;
  if (code === "42501" || /^\s*habillage:/i.test(message)) return phraseDeRefus(message, code);
  return generique;
}

// Une écriture ne reste jamais en attente : au-delà de 15 s, la phrase le dit et le réglage affiché revient à l'état gardé.
function avecDelai(promesse) {
  let minuteur;
  const delai = new Promise((_, rejet) => {
    minuteur = setTimeout(() => rejet(Object.assign(new Error("Délai dépassé (15 s). Réseau lent : réessayez dans un instant."), { phrase: true })), DELAI_MS);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

function entete(surtitre, titre, sousTitre) {
  return el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, surtitre),
      el("h2", { tabindex: "-1" }, titre),
      sousTitre ? el("p", { class: "subtitle" }, sousTitre) : null));
}

// La section d'un réglage : les deux pastilles, « Ne rien fixer », et, pour le centre, « Laisser chacun choisir le sien ».
// `valeur` : l'habillage gardé (ou null) ; `libre` : vrai quand chacun garde son choix ; `enregistrer({ habillage, libre })` : l'appel à
// la base. Les enregistrements partent un par un, dans l'ordre des gestes ; un refus ramène l'affichage à ce que la base a gardé.
function sectionReglage({ titre, intro, valeur, libre, avecLibre, libelleRetrait, enregistrer, messageOk, aideLibre, repli }) {
  let garde = { habillage: valeur, libre };
  let courant = { ...garde };
  let file = Promise.resolve();
  const erreur = el("p", { class: "promo-refus", role: "alert" });
  const titreSection = el("h3", {}, titre);
  const statut = el("p", { class: "reglage-statut", role: "status" }, phraseStatut(valeur, { repli }));

  const sauver = (prochain) => {
    courant = prochain;
    majControles();
    const travail = file.then(async () => {
      erreur.textContent = "";
      try {
        await avecDelai(enregistrer(prochain));
        garde = prochain;
        statut.textContent = phraseStatut(prochain.habillage, { enregistre: true, repli });
        toast(messageOk, "success", 3000);
        return true;
      } catch (e) {
        console.warn("Habillage : réglage refusé ou impossible", e);
        erreur.textContent = e && e.phrase === true ? e.message : phraseDEchec(e, PHRASE_ECHEC_ECRITURE);
        courant = { ...garde };
        statut.textContent = phraseStatut(garde.habillage, { repli });
        bloc.poserChoix(garde.habillage);
        majControles();
        return false;
      }
    });
    file = travail;
    return travail;
  };

  const bloc = blocHabillage({
    titre: titreSection,
    reglage: { courant: valeur, surChoix: (nom) => sauver({ habillage: nom, libre: courant.libre }) },
  });

  const retrait = el("button", { class: "btn small", type: "button", onClick: () => {
    bloc.poserChoix(null);
    sauver({ habillage: null, libre: true });
  } }, libelleRetrait);

  let caseLibre = null;
  let aide = null;
  let ligneLibre = null;
  if (avecLibre) {
    caseLibre = el("input", { type: "checkbox", id: "reglage-libre", "aria-describedby": "reglage-libre-aide" });
    caseLibre.addEventListener("change", () => sauver({ habillage: courant.habillage, libre: caseLibre.checked }));
    aide = el("p", { class: "muted", id: "reglage-libre-aide" });
    ligneLibre = el("div", { class: "reglage-libre" },
      el("label", { for: "reglage-libre", class: "invite-admin-toggle" }, caseLibre, " " + LIBELLE_LIBRE), aide);
  }

  function majControles() {
    // `hidden` ne suffit pas (la classe .btn fixe son affichage) : l'affichage se retire lui-même.
    retrait.style.display = courant.habillage == null ? "none" : "";
    if (!caseLibre) return;
    caseLibre.checked = courant.libre;
    caseLibre.disabled = courant.habillage == null;
    aide.textContent = aideLibre(courant);
  }
  majControles();

  return el("section", { class: "param-section reglage-habillage" },
    el("div", { class: "param-section-head" },
      el("div", { class: "param-icon" }, icon.palette()),
      el("div", {}, titreSection, el("p", { class: "muted" }, intro))),
    el("div", { class: "param-block" }, bloc, statut, el("div", { class: "reglage-actions" }, retrait), ligneLibre, erreur));
}

const aideLibreCentre = (c) => {
  if (c.habillage == null) return "Sans habillage fixé par le centre, chacun garde déjà le sien. Choisissez un habillage plus haut pour pouvoir l'imposer.";
  return c.libre
    ? "Chaque personne du centre peut choisir son apparence. Le choix du centre s'applique à celles qui n'ont rien choisi."
    : "Le choix du centre s'impose à tous les comptes du centre. Il change à leur prochaine ouverture de l'app.";
};

async function rendre(container, { surtitre, titre, lire, construire }) {
  const jeton = ++rendu;
  clear(container);
  const racine = el("div", { class: "centre reglages-habillage-page" });
  container.appendChild(racine);
  const relire = () => rendre(container, { surtitre, titre, lire, construire });
  racine.appendChild(entete(surtitre.chargement, titre, "Chargement"));
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  let donnees;
  try {
    donnees = await lire();
  } catch (e) {
    console.warn("Habillage : réglage illisible", e);
    if (jeton !== rendu) return;
    clear(racine);
    racine.appendChild(entete(surtitre.chargement, titre, null));
    racine.appendChild(boiteErreur(phraseDEchec(e, PHRASE_ECHEC_LECTURE), relire));
    // La section des données personnelles se charge seule : un habillage illisible ne la cache pas.
    if (construire.suite) racine.appendChild(construire.suite(null));
    return;
  }
  if (jeton !== rendu) return;
  clear(racine);
  racine.appendChild(entete(surtitre.pret(donnees), titre, construire.sousTitre));
  racine.appendChild(construire.section(donnees));
  // Suite du lot 5 : une section de plus sous l'habillage (les données personnelles du centre), qui se charge pour son compte.
  if (construire.suite) racine.appendChild(construire.suite(donnees));
}

// Réglages du centre (espace direction) : l'habillage du centre affiché.
export async function renderReglagesCentre(container) {
  const centre = getCentre();
  if (!centre) {
    clear(container);
    const racine = el("div", { class: "centre reglages-habillage-page" });
    racine.appendChild(entete("Centre", "Réglages du centre", null));
    racine.appendChild(el("div", { class: "centre-section centre-vide" },
      el("p", {}, PHRASE_SANS_CENTRE),
      el("p", { class: "muted" }, "Choisissez une promo d'un centre que vous dirigez.")));
    container.appendChild(racine);
    return;
  }
  const nomCentre = centre.nom || "Centre";
  await rendre(container, {
    surtitre: { chargement: "Centre · " + nomCentre, pret: () => "Centre · " + nomCentre },
    titre: "Réglages du centre",
    lire: () => lireHabillageCentre(centre.id),
    construire: {
      sousTitre: "L'apparence de l'app pour les comptes du centre, et les données personnelles",
      suite: () => sectionDonneesCentre(centre),
      section: (ligne) => sectionReglage({
        titre: "Habillage par défaut du centre",
        intro: "L'apparence que reçoivent les comptes du centre tant qu'ils n'ont rien choisi. Sans réglage, c'est celle du réseau.",
        valeur: defautsHabillage({ centre: ligne.habillage }).centre,
        libre: ligne.habillage_libre !== false,
        avecLibre: true,
        libelleRetrait: "Ne rien fixer pour le centre",
        enregistrer: ({ habillage, libre }) => reglerHabillageCentre({ lieuId: centre.id, habillage, libre }),
        messageOk: "Réglage du centre enregistré",
        aideLibre: aideLibreCentre,
        repli: "Les comptes reçoivent celui du réseau.",
      }),
    },
  });
}

// Réglages du réseau (espace siège) : l'habillage par défaut du réseau.
export async function renderReglagesReseau(container) {
  await rendre(container, {
    surtitre: { chargement: "Réseau", pret: () => "Réseau" },
    titre: "Réglages du réseau",
    lire: () => habillageParDefaut(),
    construire: {
      sousTitre: "L'apparence de l'app pour tout le réseau",
      section: (ligne) => sectionReglage({
        titre: "Habillage par défaut du réseau",
        intro: "L'apparence que reçoivent les comptes qui n'ont rien choisi et dont le centre n'a rien fixé. Sans réglage, c'est ECSR Promo.",
        valeur: defautsHabillage(ligne).reseau,
        libre: true,
        avecLibre: false,
        libelleRetrait: "Ne rien fixer pour le réseau",
        enregistrer: ({ habillage }) => reglerHabillageReseau(habillage),
        messageOk: "Réglage du réseau enregistré",
        aideLibre: () => "",
        repli: "Les comptes reçoivent ECSR Promo.",
      }),
    },
  });
}
