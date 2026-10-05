// Page Stagiaires (chantier D, lot 2) : la promo, une fiche par personne, pour les
// formateurs et les admins. Ordinateur : la liste à gauche, la fiche à droite
// (onglets). iPhone : la liste, puis la fiche en sommaire, puis une partie en
// plein écran. Adresses : #/stagiaires, #/stagiaires/<id>, #/stagiaires/<id>/<partie>.

import { listEpcfEtats, listLivretsIndex, listDossiersIndex } from "../db.js?v=20261005b";
import { el, clear, displayStagiaire, compareByNom } from "../utils.js?v=20261005b";
import { icon } from "../icons.js?v=20261005b";
import { adresseFiche, lireAdresse } from "../route-rules.js?v=20261005b";
import { ligneListe } from "../fiche-rules.js?v=20261005b";
import { surChangementAdresse, remplacerAdresse } from "../navigation.js?v=20261005b";
import {
  chargerContexteFiche, chargerFiche, renderFiche, dispositionFiche,
  noterDocument, ecouterDocuments, afficherErreur,
} from "./mon-suivi.js?v=20261005b";

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

export async function renderStagiaires(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const [stagiairesData, epcf, livrets, dossiers] = await Promise.all([
    chargerContexteFiche(), listEpcfEtats(), listLivretsIndex(), listDossiersIndex(),
  ]);
  const stagiaires = stagiairesData.slice().sort(compareByNom);
  const etats = { epcf: epcf || [], livrets: livrets || [], dossiers: dossiers || [] };
  const fiches = new Map();   // id → données : une lecture par personne et par visite
  let generation = 0;         // une fiche lente ne s'affiche pas à la place d'une autre
  let choisi = null;          // fiche affichée (ligne surlignée)
  let defilementListe = 0;    // position de la liste sur iPhone, rendue au retour

  const entete = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Formateurs"),
      el("h2", {}, "Stagiaires"),
      el("p", { class: "subtitle" }, "La promo, une fiche par personne."),
    ),
  );
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
    if (disposition === "onglets") {
      // Ordinateur : toujours une fiche à côté de la liste, la dernière consultée.
      const derniere = lireDerniere();
      const id = connu ? adr.id
        : (stagiaires.some((s) => s.id === derniere) ? derniere : (stagiaires[0]?.id ?? null));
      choisi = id;
      clear(container);
      container.appendChild(entete);
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
      container.appendChild(entete);
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
