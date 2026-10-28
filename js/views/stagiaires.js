// Page Stagiaires (chantier D, lot 2) : la promo, une fiche par personne, pour les
// formateurs et les admins. Ordinateur : la liste à gauche, la fiche à droite
// (onglets). iPhone : la liste, puis la fiche en sommaire, puis une partie en
// plein écran. Adresses : #/stagiaires, #/stagiaires/<id>, #/stagiaires/<id>/<partie>.
// Nouvelle navigation (lot 2A) : sous l'en-tête, deux sous-onglets, « Stagiaires » (la page d'avant) et
// « Élèves bénévoles » (la banque des volontaires, ouverte dans la page et non plus dans une fenêtre).

import { listEpcfEtats, listLivretsIndex, listDossiersIndex, getPromoCourante } from "../db.js?v=20261028a";
import { el, clear, displayStagiaire, compareByNom } from "../utils.js?v=20261028a";
import { icon } from "../icons.js?v=20261028a";
import { adresseFiche, lireAdresse } from "../route-rules.js?v=20261028a";
import { ligneListe } from "../fiche-rules.js?v=20261028a";
import { surChangementAdresse, oublierMajSurPlace, remplacerAdresse, peutQuitter } from "../navigation.js?v=20261028a";
import { isAdmin } from "../auth-admin.js?v=20261028a";
import { navigationV2Active } from "../nav-etat.js?v=20261028a";
import { CLES_SOUS_ONGLETS } from "../nav-rules.js?v=20261028a";
import { renderSubTabs } from "../subtabs.js?v=20261028a";
import { renderBenevoles } from "./benevoles.js?v=20261028a";
import {
  chargerContexteFiche, chargerFiche, renderFiche, dispositionFiche,
  noterDocument, ecouterDocuments, afficherErreur,
} from "./mon-suivi.js?v=20261028a";

const CLE_DERNIERE = "ecsr_stagiaires_derniere";
const CLE_ONGLET = "ecsr_stagiaires_subtab";

function lireDerniere() {
  try {
    const v = Number(localStorage.getItem(CLE_DERNIERE));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch (e) { return null; }
}
function noterDerniere(id) {
  try { localStorage.setItem(CLE_DERNIERE, String(id)); } catch (e) { /* navigation privée */ }
}

// En-tête de la page : surtitre, titre, sous-titre. Le surtitre est « Formateurs » avec l'ancienne navigation, le
// nom de la promo affichée avec la nouvelle (absent si les promos ne sont pas chargées).
function enTete(surtitre) {
  return el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      surtitre ? el("p", { class: "eyebrow" }, surtitre) : null,
      el("h2", {}, "Stagiaires"),
      el("p", { class: "subtitle" }, "La promo, une fiche par personne."),
    ),
  );
}

// La liste des stagiaires et leur fiche. `sousOnglet` : null avec l'ancienne navigation, où la page est cette liste
// avec son en-tête ; sinon ce que lui donne le sous-onglet « Stagiaires » de la nouvelle : { actif() : ce sous-onglet
// est encore celui qui est affiché, ficheSeule(oui) : sur iPhone, la fiche prend tout l'écran }. L'en-tête est alors
// celui de la page, au-dessus des sous-onglets.
async function listeDesStagiaires(container, sousOnglet = null) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const [stagiairesData, epcf, livrets, dossiers] = await Promise.all([
    chargerContexteFiche(), listEpcfEtats(), listLivretsIndex(), listDossiersIndex(),
  ]);
  // Sous-onglet quitté pendant la lecture : plus rien à écrire (ni adresse, ni écoute de l'adresse).
  if (sousOnglet && !sousOnglet.actif()) return;
  const stagiaires = stagiairesData.slice().sort(compareByNom);
  const etats = { epcf: epcf || [], livrets: livrets || [], dossiers: dossiers || [] };
  const fiches = new Map();   // id → données : une lecture par personne et par visite
  let generation = 0;         // une fiche lente ne s'affiche pas à la place d'une autre
  let choisi = null;          // fiche affichée (ligne surlignée)
  let defilementListe = 0;    // position de la liste sur iPhone, rendue au retour

  const entete = sousOnglet ? null : enTete("Formateurs");
  const liste = el("nav", { class: "stg-liste", "aria-label": "Stagiaires de la promo" });
  const zoneFiche = el("div", { class: "stg-fiche" });

  function etatsDe(id) {
    return ligneListe({
      evals: etats.epcf.filter((r) => r.stagiaire_id === id),
      livret: etats.livrets.find((r) => r.stagiaire_id === id) || null,
      dossier: etats.dossiers.find((r) => r.stagiaire_id === id) || null,
    });
  }

  function dessinerListe() {
    clear(liste);
    if (!stagiaires.length) {
      liste.appendChild(el("p", { class: "muted" }, "Aucun stagiaire actif dans la promo."));
      return;
    }
    stagiaires.forEach((s) => {
      const ligneEtats = el("span", { class: "stg-etats" });
      etatsDe(s.id).forEach((e, i) => {
        if (i) ligneEtats.appendChild(document.createTextNode(" · "));
        ligneEtats.appendChild(el("span", { class: "stg-etat" + (e.afaire ? " afaire" : "") }, e.texte));
      });
      liste.appendChild(el("a", {
        class: "stg-ligne" + (s.id === choisi ? " active" : ""),
        href: adresseFiche("stagiaires", s.id, null),
        "aria-current": s.id === choisi ? "true" : null,
      },
        el("span", { class: "stg-ligne-texte" }, el("span", { class: "stg-nom" }, displayStagiaire(s)), ligneEtats),
        icon.chevronRight()));
    });
  }

  async function afficherFiche(id, partie, disposition) {
    const jeton = ++generation;
    const s = stagiaires.find((x) => x.id === id);
    noterDerniere(id);
    let d = fiches.get(id);
    if (!d) {
      clear(zoneFiche);
      zoneFiche.appendChild(el("div", { class: "loading" }, "Chargement"));
      try { d = await chargerFiche(id); }
      catch (e) {
        if (jeton === generation) afficherErreur(zoneFiche, e, () => afficherFiche(id, partie, disposition));
        return;
      }
      if (jeton !== generation) return;
      fiches.set(id, d);
    }
    renderFiche(zoneFiche, d, {
      soi: false, partie, disposition,
      titre: displayStagiaire(s),
      retour: disposition === "sommaire" ? { label: "Stagiaires", href: "#/stagiaires" } : null,
      adresse: (p) => adresseFiche("stagiaires", id, p),
      storageKey: CLE_ONGLET,
      // Évaluation EPCF enregistrée : la ligne de la liste suit, sans relecture.
      onEpcfEnregistre: (evals) => {
        etats.epcf = etats.epcf.filter((r) => r.stagiaire_id !== id)
          .concat(evals.map((e) => ({ stagiaire_id: id, trame: e.trame, date_eval: e.date_eval })));
        dessinerListe();
      },
    });
  }

  async function afficher(adr) {
    const disposition = dispositionFiche();
    const connu = adr.id != null && stagiaires.some((s) => s.id === adr.id);
    // iPhone, nouvelle navigation : la fiche prend tout l'écran, l'en-tête et les sous-onglets de la page s'effacent.
    const ficheSeule = !!sousOnglet && disposition !== "onglets" && connu;
    if (sousOnglet) sousOnglet.ficheSeule(ficheSeule);
    if (disposition === "onglets") {
      // Ordinateur : toujours une fiche à côté de la liste, la dernière consultée.
      const derniere = lireDerniere();
      const id = connu ? adr.id
        : (stagiaires.some((s) => s.id === derniere) ? derniere : (stagiaires[0]?.id ?? null));
      choisi = id;
      clear(container);
      if (entete) container.appendChild(entete);
      container.appendChild(el("div", { class: "stg-colonnes" }, liste, zoneFiche));
      dessinerListe();
      if (id == null) { clear(zoneFiche); return; }
      // Fiche choisie par défaut : inscrite dans l'adresse (sans étape d'historique),
      // pour que le bouton Précédent revienne plus tard à CETTE fiche.
      if (!connu) remplacerAdresse(adresseFiche("stagiaires", id, null));
      await afficherFiche(id, connu ? adr.partie : null, disposition);
      return;
    }
    // iPhone : un seul écran à la fois.
    if (!connu) {
      choisi = null;
      clear(container);
      if (entete) container.appendChild(entete);
      container.appendChild(liste);
      dessinerListe();
      window.scrollTo(0, defilementListe);
      return;
    }
    if (liste.isConnected) defilementListe = window.scrollY;
    choisi = adr.id;
    clear(container);
    container.appendChild(zoneFiche);
    window.scrollTo(0, 0);
    await afficherFiche(adr.id, adr.partie, disposition);
  }

  // Livret ou dossier enregistré : la fiche en mémoire et la ligne suivent.
  ecouterDocuments((detail) => {
    for (const d of fiches.values()) noterDocument(d, detail);
    const cle = detail.genre === "livret" ? "livrets" : detail.genre === "dossier" ? "dossiers" : null;
    if (!cle) return;
    etats[cle] = etats[cle].filter((r) => r.stagiaire_id !== detail.stagiaireId)
      .concat([{ stagiaire_id: detail.stagiaireId, updated_at: detail.updatedAt }]);
    if (liste.isConnected) dessinerListe();
  });
  surChangementAdresse("stagiaires", afficher);
  await afficher(lireAdresse(location.hash));
}

// Page Stagiaires. Ancienne navigation : la liste et la fiche, sous leur en-tête. Nouvelle : l'en-tête de la page (le
// nom de la promo au-dessus de « Stagiaires »), puis deux sous-onglets dont la mémoire est propre à la page
// (CLES_SOUS_ONGLETS.stagiaires) : « Stagiaires », la page d'avant, et « Élèves bénévoles », que le bouton du même nom
// du Planning ouvre. La banque est lue par les administrateurs seuls (règles de la base) : un formateur qui ne l'est pas
// n'a pas le sous-onglet, comme il n'avait pas le bouton du Planning, et la page se montre alors sans barre.
export async function renderStagiaires(container) {
  if (!navigationV2Active()) {
    await listeDesStagiaires(container);
    return;
  }
  clear(container);
  const page = el("div", { class: "stg-page" });
  page.appendChild(enTete(getPromoCourante()?.nom));

  // Chaque sous-onglet se rend dans une zone neuve du panneau que renderSubTabs partage : un rendu qui finit après un
  // changement de sous-onglet écrit dans une zone détachée, jamais dans celui qui est affiché (comme le Planning,
  // js/views/planning-espace.js). Une erreur de lecture se dit dans le sous-onglet, avec « Réessayer ».
  const dansUneZone = (rendre) => (panneau, ctx) => {
    const zone = el("div");
    panneau.appendChild(zone);
    const lancer = async () => {
      try { await rendre(zone, ctx); }
      catch (e) {
        if (zone.isConnected) afficherErreur(zone, e, lancer);
        else console.error(e);
      }
    };
    lancer();
  };

  const onglets = [{
    key: "stagiaires", label: "Stagiaires",
    render: dansUneZone((zone, ctx) => listeDesStagiaires(zone, {
      actif: ctx.isActive,
      ficheSeule: (oui) => page.classList.toggle("stg-fiche-seule", oui),
    })),
  }];
  if (isAdmin()) {
    onglets.push({
      key: "benevoles", label: "Élèves bénévoles",
      render: dansUneZone((zone) => {
        // La liste n'est plus à l'écran : l'adresse d'une fiche ne la met plus à jour sur place, la page se rend de nouveau.
        oublierMajSurPlace();
        page.classList.remove("stg-fiche-seule");
        return renderBenevoles(zone);
      }),
    });
  }
  page.appendChild(renderSubTabs(onglets, {
    storageKey: CLES_SOUS_ONGLETS.stagiaires,
    // L'adresse d'une fiche (#/stagiaires/12) ouvre la liste, quel que soit le sous-onglet gardé en mémoire.
    activeKey: lireAdresse(location.hash).id != null ? "stagiaires" : undefined,
    // Les bénévoles n'ont pas d'adresse de fiche : celle qu'on quitte ne doit pas rester dans la barre d'adresse.
    onChange: (cle) => { if (cle === "benevoles") remplacerAdresse("#/stagiaires"); },
    // Une grille EPCF commencée n'est pas abandonnée sans accord, comme en changeant de partie de la fiche.
    avantChangement: () => peutQuitter(),
  }));
  container.appendChild(page);
}
