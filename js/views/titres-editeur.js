// Fenêtre « Ajuster un titre » (titres et droits à la carte, étape 3, spec § 11), partagée par la page Équipe de la direction et la
// page Directions de centre du siège. Un nom ; le niveau du titre en rappel ; une ligne par page du niveau avec ses choix
// (Non, Voir, Modifier : un bouton radio de 44 px chacun, les pages à plafond « Voir » n'offrent pas Modifier, Réglages n'offre
// que Non et Modifier) ; Stagiaires se relève de lui-même quand une page qui montre des noms de stagiaires est ouverte (spec § 5.4) ;
// des bandeaux d'avertissement (Équipe, Cours et QCM, Directions de centre sur Modifier) ; « Sa barre » en direct pour un titre de
// centre ou du réseau ; le nombre de personnes qui le portent. Un titre du réseau ajusté depuis un centre crée la version de ce centre :
// la phrase est confirmée avant l'envoi. La base décide de tout : son refus se dit par sa phrase dans la fenêtre, la saisie gardée.
//
// `construireEditeur` ne touche ni au réseau ni à la base (testé par tests/titres-editeur.test.mjs, sur le DOM factice) ;
// `ouvrirEditeurTitre` l'ouvre dans la fenêtre commune de la page Équipe (ouvrirFormulaire) et appelle ajuster_titre. Ces deux
// modules ne se chargent l'un l'autre qu'à l'ouverture (import dynamique) : la page Équipe importe celui-ci, sans cycle au démarrage.

import { el, toast } from "../utils.js?v=20261123a";
import {
  choixDeLaPage, releverStagiaires, PHRASE_STAGIAIRES_RELEVE, bandeaux, phrasePorteurs, phraseVersionCentre,
  casesEnChaines, casesEnNombres, LIBELLE_NIVEAU, PAGES_DU_NIVEAU,
} from "../titres-rules.js?v=20261123a";
import { entreesNavigation } from "../nav-rules.js?v=20261123a";
import { confirmer } from "../confirmer.js?v=20261123a";

export const PHRASE_NOM_REQUIS = "Donnez un nom au titre.";
const LIBELLE_CHOIX = { non: "Non", voir: "Voir", modifier: "Modifier" };
const ESPACE_DU_NIVEAU = { centre: "direction", reseau: "siege" };
const NIVEAU_EN_TOUTES_LETTRES = { promo: "Titre de promo", centre: "Titre de centre", reseau: "Titre du réseau" };

let numero = 0;

// `titre` : { id, nom, niveau, lieu_id, cases } (une ligne de titres_visibles) ; `niveau` : celui du titre ; `lieuId` : le centre
// d'où l'on ajuste (nul depuis le siège) ; `porteurs` : les personnes qui le portent (dans ce centre, ou au réseau).
// Rend { corps, valeurs, confirmation, cases, versionDuReseau } : `corps` (nœuds de la fenêtre), `valeurs()` (la phrase de refus, ou
// { nom, cases } où `cases` est exactement ce qu'affichent les boutons), `confirmation()` (la phrase à confirmer avant l'envoi, ou nul).
export function construireEditeur({ titre, niveau, lieuId = null, porteurs = 0 }) {
  const id = ++numero;
  const pages = PAGES_DU_NIVEAU[niveau] || [];
  const versionDuReseau = lieuId != null && titre.lieu_id == null;
  const cases = casesEnChaines(niveau, titre.cases);
  for (const { page } of pages) if (!choixDeLaPage(niveau, page).includes(cases[page])) cases[page] = "non";

  const champNom = el("input", { type: "text", id: `titre-nom-${id}`, maxlength: "60", autocomplete: "off" });
  champNom.value = titre.nom || "";
  const phraseReleve = el("p", { class: "equipe-releve", role: "status" });
  const zoneBandeaux = el("div", { class: "equipe-bandeaux" });
  const zoneBarre = ESPACE_DU_NIVEAU[niveau] ? el("ul", { class: "equipe-barre-liste" }) : null;
  const radios = new Map();   // page -> { valeur -> input }

  const lignes = pages.map(({ page, libelle }) => {
    const groupe = {};
    radios.set(page, groupe);
    const choix = choixDeLaPage(niveau, page).map((valeur) => {
      const radio = el("input", { type: "radio", name: `titre-case-${id}-${page}`, id: `titre-case-${id}-${page}-${valeur}`, value: valeur });
      radio.checked = cases[page] === valeur;
      radio.addEventListener("change", () => choisir(page, valeur));
      groupe[valeur] = radio;
      return el("label", { class: "equipe-choix", for: radio.getAttribute("id") }, radio, el("span", {}, LIBELLE_CHOIX[valeur]));
    });
    return el("fieldset", { class: "equipe-page", "data-page": page },
      el("legend", {}, libelle),
      el("div", { class: "equipe-choix-groupe" }, ...choix));
  });

  function montrer() {
    for (const [page, groupe] of radios) for (const [valeur, radio] of Object.entries(groupe)) radio.checked = cases[page] === valeur;
    zoneBandeaux.replaceChildren(...bandeaux(niveau, cases).map((t) => el("p", { class: "equipe-bandeau", role: "note" }, t)));
    if (zoneBarre) {
      const entrees = entreesNavigation(ESPACE_DU_NIVEAU[niveau], {
        cases: casesEnNombres(niveau, cases), emargementDansLeCentre: true, reglagesEspace: true,
      });
      zoneBarre.replaceChildren(...entrees.map((e) => el("li", {}, e.libelle)));
    }
  }

  function choisir(page, valeur) {
    cases[page] = valeur;
    const { cases: relevees, releve } = releverStagiaires(niveau, cases);
    if (releve) {
      cases.stagiaires = relevees.stagiaires;
      phraseReleve.textContent = PHRASE_STAGIAIRES_RELEVE;
    } else if (page === "stagiaires") {
      phraseReleve.textContent = "";
    }
    montrer();
  }

  const phrasePorteursOuVersion = versionDuReseau ? phraseVersionCentre(porteurs) : phrasePorteurs(porteurs);
  const corps = [
    el("div", { class: "field" }, el("label", { for: `titre-nom-${id}` }, "Nom du titre"), champNom),
    el("p", { class: "muted equipe-note" }, `${NIVEAU_EN_TOUTES_LETTRES[niveau] || LIBELLE_NIVEAU[niveau] || ""}.`),
    el("div", { class: "equipe-pages" }, ...lignes),
    phraseReleve,
    zoneBandeaux,
    zoneBarre ? el("div", { class: "equipe-barre" }, el("h4", {}, "Sa barre"), zoneBarre) : null,
    phrasePorteursOuVersion ? el("p", { class: "equipe-porteurs", role: "note" }, phrasePorteursOuVersion) : null,
  ];
  montrer();

  return {
    corps,
    cases,
    versionDuReseau,
    valeurs() {
      const nom = champNom.value.trim();
      if (!nom) return PHRASE_NOM_REQUIS;
      return { nom, cases: { ...cases } };
    },
    confirmation: () => (versionDuReseau ? phraseVersionCentre(porteurs) : null),
    premierChamp: () => champNom,
  };
}

// La confirmation d'une version de centre, avant tout envoi : vrai quand il n'y a rien à confirmer ou que la personne accepte.
export async function confirmerVersion(editeur, demander) {
  const phrase = editeur.confirmation();
  if (!phrase) return true;
  return (await demander({ titre: "Créer la version de votre centre ?", phrase, oui: "Ajuster", danger: false })) === true;
}

// Ouvre la fenêtre. `apres(resultat)` : ce que la page fait une fois le titre enregistré (se relire). Un refus de la base reste dans la
// fenêtre, par sa phrase ; la confirmation d'une version du centre refusée laisse la fenêtre ouverte, sans message.
export async function ouvrirEditeurTitre({ titre, niveau, lieuId = null, porteurs = 0, apres = null, ancre = null }) {
  const [{ ouvrirFormulaire }, { ajusterTitre }] = await Promise.all([
    import("./direction-equipe.js?v=20261123a"),
    import("../db.js?v=20261123a"),
  ]);
  const editeur = construireEditeur({ titre, niveau, lieuId, porteurs });
  ouvrirFormulaire({
    titre: "Ajuster un titre",
    corps: editeur.corps,
    ancre, libelleBouton: "Enregistrer", premierChamp: editeur.premierChamp,
    valider: () => editeur.valeurs(),
    confirmerAvant: () => confirmerVersion(editeur, confirmer),
    enregistrer: async (v) => {
      const r = await ajusterTitre({ titreId: titre.id, lieuId, nom: v.nom === titre.nom ? null : v.nom, cases: v.cases });
      toast(r && r.version_creee ? "Version de votre centre créée : le titre est enregistré." : "Titre enregistré.", "success", 5000);
      if (apres) await apres(r);
    },
  });
}
