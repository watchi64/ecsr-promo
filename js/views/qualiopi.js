// Page Qualiopi (spec docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md, § 6.3). Réservée au fondateur (porte
// dans main.js), sans entrée de barre : on y arrive par le bouton « Qualiopi » du tableau de bord du centre. Elle montre
// l'inventaire d'une promo indicateur par indicateur, et lance les sorties : dossier de la formation, dossier du centre (avec
// ou sans noms), tableau CSV, fiche des résultats à publier (imprimée ou copiée en texte). Les calculs vivent dans
// js/qualiopi-preuves.js (inventaire), js/qualiopi-documents.js (modèles des dossiers, CSV), js/qualiopi-resultats.js (fiche des
// résultats) et js/qualiopi-page-rules.js (dates, choix des promos) : ici, seulement l'affichage, la lecture des données et
// l'impression.
//
// Chargée à la demande (js/main.js, route qualiopi) : seul js/qualiopi-impression.js, qui monte et nettoie le document imprimable,
// part avec l'app. Cette page, ses modules de calcul et leurs erreurs éventuelles ne touchent donc pas les autres comptes.
//
// Lecture seule. La promo choisie se lit par son identifiant (lireDonneesQualiopi, en-tête interne de lecture) : jamais de
// repli sur la promo courante. Les lectures de la page se gardent en mémoire, par promo, le temps de la page : le dossier
// du centre relit les autres promos du lieu, mais jamais celle qui est déjà affichée.
// La date des documents est celle du rendu de la page, comme les données lues.

import { lireDonneesQualiopi, lireReferentielCentre, getMesPromos, getPromoCourante } from "../db.js?v=20261028a";
import { el, clear, isoDate, toast } from "../utils.js?v=20261028a";
import { indicateursPromo } from "../centre-stats.js?v=20261028a";
import { inventairePromo, nb } from "../qualiopi-preuves.js?v=20261028a";
import {
  modeleDossierFormation, modeleDossierCentre, inventaireCsv, nomFichierQualiopi, periodeEnMots, LIBELLES_NIVEAU, PHRASE_DE_GARDE,
} from "../qualiopi-documents.js?v=20261028a";
import {
  REFERENTIEL_APPLIQUE, REFERENTIEL_DU, periodeDouzeMois, promosDuCentre, nomPromo, libelleOptionPromo, groupesParCritere,
  titreImpression,
} from "../qualiopi-page-rules.js?v=20261028a";
import {
  ficheResultats, fichesResultatsTexte, tableauFiche, copierTexte, noteProvisoire, promoTerminee, AUCUNE_FORMATION,
} from "../qualiopi-resultats.js?v=20261028a";
import { NOUVEAUTES } from "../nouveautes-data.js?v=20261028a";
import { telecharger } from "./centre.js?v=20261028a";
import { imprimerQualiopi } from "../qualiopi-impression.js?v=20261028a";

let rendu = 0;   // un rendu plus récent rend caduc celui qui attend encore ses données

const texteOu = (valeur, defaut) => (typeof valeur === "string" && valeur.trim() !== "" ? valeur.trim() : defaut);
const liste = (valeur) => (Array.isArray(valeur) ? valeur : []);

// =====================================================================================================
// Documents imprimables : la mise en page des modèles de js/qualiopi-documents.js. Le montage dans #qualiopi-print, le format de
// page et le nettoyage sont dans js/qualiopi-impression.js.
// =====================================================================================================

function tableauImprimable({ entetes, lignes }) {
  return el("table", { class: "qdoc-table" },
    el("thead", {}, el("tr", {}, ...liste(entetes).map((entete) => el("th", { scope: "col" }, entete)))),
    el("tbody", {}, ...liste(lignes).map((ligne) => el("tr", {}, ...liste(ligne).map((cellule) => el("td", {}, cellule))))));
}

function sectionImprimable(section) {
  const servis = liste(section.indicateurs);
  return el("section", { class: "qdoc-section" },
    el("h2", {}, section.titre),
    servis.length ? el("p", { class: "qdoc-servis" }, `${servis.length > 1 ? "Indicateurs servis" : "Indicateur servi"} : ${servis.join(", ")}`) : null,
    ...liste(section.paragraphes).map((paragraphe) => el("p", {}, paragraphe)),
    ...liste(section.tableaux).map(tableauImprimable));
}

// Met en page un modèle de dossier (js/qualiopi-documents.js) : page de garde, sommaire, sections, pièces à fournir.
function documentImprimable(modele) {
  const sections = liste(modele.sections);
  const titres = new Map(sections.map((s) => [s.id, s.titre]));
  const aFournir = liste(modele.aFournir);
  const aFournirNumeros = new Set(aFournir.map((a) => a.numero));
  const sommaire = liste(modele.sommaire).map((e) => [
    String(e.numero),
    texteOu(e.court, "Indicateur " + e.numero),
    e.section ? (titres.get(e.section) ?? String(e.section)) : (aFournirNumeros.has(e.numero) ? "Pièces à fournir par le centre" : "Hors de l'application"),
  ]);
  return el("article", { class: "qdoc" },
    el("section", { class: "qdoc-garde" },
      el("h1", { class: "qdoc-titre" }, modele.titre),
      el("p", { class: "qdoc-sous-titre" }, modele.sousTitre),
      ...liste(modele.garde).map((ligne) => el("p", { class: "qdoc-garde-ligne" + (ligne === PHRASE_DE_GARDE ? " qdoc-phrase" : "") }, ligne))),
    el("section", { class: "qdoc-sommaire" },
      el("h2", {}, "Sommaire"),
      sommaire.length
        ? tableauImprimable({ entetes: ["N°", "Indicateur", "Section du dossier"], lignes: sommaire })
        : el("p", {}, "Aucun indicateur à lister.")),
    ...sections.map(sectionImprimable),
    aFournir.length
      ? el("section", { class: "qdoc-afournir" },
        el("h2", {}, "Pièces à fournir par le centre"),
        el("p", {}, "Pièces que l'application ne produit pas, indicateur par indicateur : à cocher quand elles sont jointes au dossier."),
        ...aFournir.map((a) => el("div", { class: "qdoc-bloc" },
          el("h3", {}, `${a.numero}. ${texteOu(a.court, "Indicateur " + a.numero)}`),
          el("ul", {}, ...liste(a.items).map((item) => el("li", {}, el("span", { class: "qdoc-case", "aria-hidden": "true" }), item))))))
      : null);
}

// Met en page les fiches des résultats (js/qualiopi-resultats.js) : une page A4 par formation, l'avertissement avant le titre quand
// la promo est en cours, le tableau des dossiers (mêmes mots que le texte à copier). Jamais de total entre les promos.
function ficheImprimable(fiche) {
  return el("section", { class: "qres-fiche" },
    fiche.avertissement ? el("p", { class: "qres-avertissement" }, fiche.avertissement) : null,
    el("h1", { class: "qres-titre" }, fiche.titre),
    ...liste(fiche.entete).map((ligne) => el("p", { class: "qres-entete" }, ligne)),
    tableauImprimable(tableauFiche(fiche)));
}

function fichesImprimables(fiches) {
  return el("article", { class: "qdoc" }, ...liste(fiches).map(ficheImprimable));
}

// =====================================================================================================
// Page : indicateurs par critère
// =====================================================================================================

function pastilleNiveau(niveau) {
  return el("span", { class: "qualiopi-niveau " + niveau }, LIBELLES_NIVEAU[niveau] ?? "Niveau inconnu");
}

function lignePiece(piece) {
  return el("li", { class: "qualiopi-piece" },
    el("span", { class: "qualiopi-piece-etat " + (piece.presente ? "presente" : "absente") }, piece.presente ? "Présente" : "Absente"),
    el("span", { class: "qualiopi-piece-texte" },
      el("strong", {}, texteOu(piece.libelle, "Pièce")), " : ", texteOu(piece.presente ? piece.detail : piece.raison, "non renseigné")));
}

function carteIndicateur(indicateur) {
  const pieces = liste(indicateur.pieces);
  const aFournir = liste(indicateur.aFournir);
  return el("article", { class: "qualiopi-indicateur" },
    el("div", { class: "qualiopi-ind-tete" },
      el("span", { class: "qualiopi-num" }, String(indicateur.numero)),
      el("h4", { class: "qualiopi-ind-titre" }, texteOu(indicateur.court, "Indicateur " + indicateur.numero)),
      pastilleNiveau(indicateur.niveau)),
    el("p", { class: "qualiopi-apporte" }, "Ce que l'app apporte : ", texteOu(indicateur.apporte, "rien")),
    pieces.length ? el("ul", { class: "qualiopi-pieces" }, ...pieces.map(lignePiece)) : null,
    el("div", { class: "qualiopi-afournir" },
      el("p", { class: "qualiopi-afournir-titre" }, aFournir.length ? "À fournir par le centre" : "À fournir par le centre : rien"),
      aFournir.length ? el("ul", { class: "qualiopi-puces" }, ...aFournir.map((piece) => el("li", {}, piece))) : null));
}

// Un <details> dont l'état ouvert ou fermé survit au redessin de la liste (case « alternance », autre promo).
function repliable(details, cle, ouverts) {
  details.open = ouverts.has(cle);
  details.addEventListener("toggle", () => { if (details.open) ouverts.add(cle); else ouverts.delete(cle); });
  return details;
}

function blocCritere(groupe, ouverts) {
  return repliable(el("details", { class: "qualiopi-critere" },
    el("summary", {},
      el("span", { class: "qualiopi-critere-texte" },
        el("span", { class: "qualiopi-critere-num" }, "Critère " + groupe.numero),
        el("span", { class: "qualiopi-critere-titre" }, groupe.titre),
        el("span", { class: "qualiopi-critere-resume" }, groupe.resume))),
    el("div", { class: "qualiopi-critere-corps" }, ...groupe.indicateurs.map(carteIndicateur))), "critere-" + groupe.numero, ouverts);
}

function blocNonApplicables(indicateurs, ouverts) {
  if (!indicateurs.length) return null;
  return repliable(el("details", { class: "qualiopi-critere qualiopi-non-applicables" },
    el("summary", {},
      el("span", { class: "qualiopi-critere-texte" },
        el("span", { class: "qualiopi-critere-titre" }, "Indicateurs qui ne s'appliquent pas"),
        el("span", { class: "qualiopi-critere-resume" }, nb(indicateurs.length, "indicateur")))),
    el("ul", { class: "qualiopi-na" }, ...indicateurs.map((i) => el("li", {},
      el("span", { class: "qualiopi-num" }, String(i.numero)),
      el("span", { class: "qualiopi-na-texte" }, texteOu(i.court, "Indicateur " + i.numero), " : ", texteOu(i.raison, "non applicable")))))),
  "non-applicables", ouverts);
}

function boiteErreur(message, reessayer) {
  return el("div", { class: "centre-erreur qualiopi-erreur", role: "alert" },
    el("p", {}, message),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

const ligneFiche = (libelle, contenu) => el("div", { class: "qualiopi-fiche-ligne" }, el("dt", {}, libelle), el("dd", {}, contenu));

// =====================================================================================================
// Page
// =====================================================================================================

export async function renderQualiopi(container) {
  const jeton = ++rendu;
  clear(container);
  const promos = getMesPromos();
  const courante = getPromoCourante() || promos.find((p) => p.par_defaut) || promos[0] || null;
  const aujourdhui = isoDate(new Date());

  const racine = el("div", { class: "qualiopi" });
  container.appendChild(racine);
  const sousTitre = el("p", { class: "subtitle" }, REFERENTIEL_DU);
  racine.appendChild(el("div", { class: "view-header qualiopi-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Qualité"),
      el("h2", {}, "Qualiopi"),
      sousTitre),
    el("div", { class: "qualiopi-retour" },
      el("a", { class: "btn small", href: "#/centre" }, "Tableau de bord du centre"))));
  if (!courante) {
    racine.appendChild(el("p", { class: "qualiopi-vide" }, "Aucune promo n'est accessible avec ce compte : il n'y a rien à inventorier."));
    return;
  }

  // --- État de la page ---
  const etat = { promo: courante, referentiel: null, donnees: null, ind: null, inv: null, alternance: false };
  const ouverts = new Set();         // critères dépliés, gardés d'un redessin à l'autre
  const lectures = new Map();        // promo → lecture en cours ou faite ; une lecture qui échoue est oubliée, pour être refaite
  let chargement = 0;                // numéro du dernier chargement de la promo affichée
  let action = 0;                    // numéro de la dernière action (dossier, tableau) ; un changement de promo la rend caduque
  let occupe = false;                // une action est en cours : les boutons attendent
  let boutons = [];                  // les boutons d'action de la promo affichée
  let statut = null;                 // la ligne d'état des actions
  const pageVivante = () => jeton === rendu && racine.isConnected;
  const chargementVivant = (numero) => numero === chargement && pageVivante();
  const actionVivante = (numero) => numero === action && pageVivante();

  const lire = (id) => {
    if (!lectures.has(id)) lectures.set(id, lireDonneesQualiopi(id).catch((e) => { lectures.delete(id); throw e; }));
    return lectures.get(id);
  };

  // --- Fiche : centre, promo, référentiel, catégorie, alternance ---
  const texteCentre = el("span");
  const texteDates = el("span");
  const choix = el("select", { id: "qualiopi-promo", class: "qualiopi-select" },
    ...promos.map((p) => el("option", { value: String(p.id) }, libelleOptionPromo(p, promos))));
  choix.value = String(courante.id);
  const caseAlternance = el("input", { type: "checkbox", id: "qualiopi-alternance" });
  racine.appendChild(el("section", { class: "qualiopi-fiche", "aria-label": "Promo et référentiel" },
    el("dl", { class: "qualiopi-fiche-liste" },
      ligneFiche("Centre", texteCentre),
      ligneFiche(el("label", { for: "qualiopi-promo" }, "Promo"), choix),
      ligneFiche("Dates", texteDates),
      ligneFiche("Référentiel", REFERENTIEL_APPLIQUE),
      ligneFiche("Catégorie", "Action de formation")),
    el("label", { class: "qualiopi-case", for: "qualiopi-alternance" }, caseAlternance,
      el("span", {}, "Formation en alternance ", el("span", { class: "qualiopi-aide-en-ligne" }, "(ajoute l'indicateur 13)")))));

  function majEntete(promo) {
    const centre = texteOu(promo.lieu_nom, null);
    sousTitre.textContent = [centre ?? "centre non renseigné", nomPromo(promo), REFERENTIEL_DU].join(" · ");
    texteCentre.textContent = centre ?? "non renseigné";
    texteDates.textContent = periodeEnMots(promo.date_debut, promo.date_fin);
  }

  // --- Corps : actions, puis critères ---
  const corps = el("div", { class: "qualiopi-corps" });
  const zoneCriteres = el("section", { class: "qualiopi-criteres" });
  racine.appendChild(corps);

  function recalculerInventaire() {
    etat.inv = inventairePromo(etat.donnees, etat.referentiel, {
      promo: etat.promo, aujourdhui, alternance: etat.alternance, nouveautes: NOUVEAUTES,
    });
  }

  function afficherCriteres() {
    clear(zoneCriteres);
    zoneCriteres.append(...[
      el("h3", { class: "qualiopi-titre" }, "Les critères du référentiel"),
      el("p", { class: "qualiopi-intro" },
        "Ouvre un critère pour voir ses indicateurs : le niveau de preuve que l'app apporte, les pièces qu'elle a (présentes ou "
        + "absentes pour cette promo) et celles que le centre fournit lui-même."),
      ...groupesParCritere(etat.inv).map((groupe) => blocCritere(groupe, ouverts)),
      blocNonApplicables(liste(etat.inv.nonApplicables), ouverts),
    ].filter(Boolean));
  }

  function ecrireStatut(texte, erreur = false) {
    if (!statut) return;
    statut.textContent = texte;
    statut.classList.toggle("erreur", erreur);
  }

  function bloquerBoutons(valeur) {
    occupe = valeur;
    boutons.forEach((bouton) => { bouton.disabled = valeur; });
  }

  // La période et les promos du dossier du centre, telles qu'il les retiendra (écrites sous le bouton).
  function promosEtPeriodeDuCentre() {
    const periode = periodeDouzeMois(aujourdhui);
    return { periode, retenues: promosDuCentre(promos, { lieuId: etat.promo.lieu_id, ...periode, aujourdhui }) };
  }

  function dossierFormation() {
    if (occupe || !etat.donnees) return;
    try {
      const { promo, donnees, ind, inv } = etat;
      const modele = modeleDossierFormation({ inv, donnees, ind, promo, lieu: promo.lieu_nom, intitule: donnees.entete?.intitule, aujourdhui });
      ecrireStatut("");
      imprimerQualiopi(documentImprimable(modele), titreImpression("dossier-formation", promo.nom, aujourdhui));
    } catch (e) {
      console.error(e);
      ecrireStatut("Le dossier de la formation n'a pas pu être préparé. Recharge la page, puis réessaie.", true);
    }
  }

  function tableauCsv() {
    if (occupe || !etat.inv) return;
    try {
      telecharger(nomFichierQualiopi("inventaire", etat.promo.nom, aujourdhui), inventaireCsv(etat.inv));
      ecrireStatut("");
      toast("Tableau téléchargé", "success");
    } catch (e) {
      console.error(e);
      ecrireStatut("Le tableau n'a pas pu être téléchargé. Recharge la page, puis réessaie.", true);
    }
  }

  // Les promos du centre se lisent l'une après l'autre (celle qui est affichée est déjà en mémoire) ; `construire(promo, donnees)`
  // fait l'entrée de chacune. Si l'une échoue, rien ne sort et la fonction ne rend rien : un document du centre auquel manquerait
  // une promo, sans le dire, tromperait l'auditeur (`quoi` complète le message : ce qui n'est pas préparé). Elle ne rend rien non
  // plus quand l'action est devenue caduque (autre promo choisie, page quittée).
  async function lirePromosDuCentre(moi, retenues, quoi, construire) {
    const lues = [];
    for (const [rang, p] of retenues.entries()) {
      ecrireStatut(`Lecture des promos du centre : ${rang + 1} sur ${retenues.length}...`);
      let donnees;
      try {
        donnees = await lire(p.id);
      } catch (e) {
        console.error(e);
        if (actionVivante(moi)) ecrireStatut(`La promo « ${nomPromo(p)} » n'a pas pu être lue : ${quoi}. Réessaie dans un instant.`, true);
        return null;
      }
      if (!actionVivante(moi)) return null;
      lues.push(construire(p, donnees));
    }
    return lues;
  }

  async function dossierCentre(sansNoms) {
    if (occupe || !etat.donnees) return;
    const moi = ++action;
    const { promo, referentiel, alternance } = etat;
    const { periode, retenues } = promosEtPeriodeDuCentre();
    bloquerBoutons(true);
    try {
      const promosLues = await lirePromosDuCentre(moi, retenues, "le dossier du centre n'est pas préparé", (p, donnees) => ({
        promo: p,
        donnees,
        inv: inventairePromo(donnees, referentiel, { promo: p, aujourdhui, alternance, nouveautes: NOUVEAUTES }),
        ind: indicateursPromo(donnees, referentiel, { aujourdhui }),
      }));
      if (!promosLues) return;
      const modele = modeleDossierCentre({ promos: promosLues, lieu: promo.lieu_nom, periode, aujourdhui, sansNoms, nouveautes: NOUVEAUTES });
      ecrireStatut("");
      imprimerQualiopi(documentImprimable(modele), titreImpression(sansNoms ? "dossier-centre-sans-noms" : "dossier-centre", promo.lieu_nom, aujourdhui));
    } catch (e) {
      console.error(e);
      if (actionVivante(moi)) ecrireStatut("Le dossier du centre n'a pas pu être préparé. Recharge la page, puis réessaie.", true);
    } finally {
      if (actionVivante(moi)) bloquerBoutons(false);
    }
  }

  // La fiche des résultats à publier (js/qualiopi-resultats.js, spec § 6.6) : celle de la promo choisie (`portee` « formation ») ou
  // celles des promos du centre, les mêmes que pour le dossier du centre, l'une après l'autre (« centre ») ; imprimée (`sortie`
  // « imprimer ») ou copiée en texte pour le site du centre (« copier »). Les promos en cours portent leur avertissement dans la
  // fiche comme dans le texte ; rien n'est additionné entre les promos.
  async function sortirFiches(portee, sortie) {
    if (occupe || !etat.donnees) return;
    const moi = ++action;
    const { promo, referentiel } = etat;
    bloquerBoutons(true);
    try {
      let fiches;
      if (portee === "formation") {
        fiches = [ficheResultats({ promo, ind: etat.ind, aujourdhui })];
      } else {
        const { retenues } = promosEtPeriodeDuCentre();
        fiches = await lirePromosDuCentre(moi, retenues, "les résultats du centre ne sont pas préparés",
          (p, donnees) => ficheResultats({ promo: p, ind: indicateursPromo(donnees, referentiel, { aujourdhui }), aujourdhui }));
        if (!fiches) return;
      }
      if (!fiches.length) {   // aucune promo du centre dans la période : ni page blanche à imprimer, ni phrase vide à copier
        ecrireStatut(AUCUNE_FORMATION);
        return;
      }
      if (sortie === "imprimer") {
        const [nature, nom] = portee === "formation" ? ["resultats-formation", promo.nom] : ["resultats-centre", promo.lieu_nom];
        ecrireStatut("");
        imprimerQualiopi(fichesImprimables(fiches), titreImpression(nature, nom, aujourdhui));
        return;
      }
      const copie = await copierTexte(fichesResultatsTexte(fiches));
      if (!actionVivante(moi)) return;
      if (copie.copie) {
        ecrireStatut([copie.message, noteProvisoire(fiches)].filter(Boolean).join(" "));
        toast("Texte copié", "success");
      } else {
        ecrireStatut(copie.message, true);
        statut?.scrollIntoView?.({ block: "nearest" });
      }
    } catch (e) {
      console.error(e);
      if (actionVivante(moi)) ecrireStatut("La fiche des résultats n'a pas pu être préparée. Recharge la page, puis réessaie.", true);
    } finally {
      if (actionVivante(moi)) bloquerBoutons(false);
    }
  }

  // Deux groupes d'actions (R7), chacun annoncé par son titre : les dossiers, puis la fiche des résultats à publier (« Fiche
  // résultats » et « Copier le texte »). La case « Sans aucun nom » ne concerne que le dossier du centre : la fiche n'a aucun nom.
  function construireActions() {
    const caseSansNom = el("input", { type: "checkbox", id: "qualiopi-sans-nom" });
    const bouton = (texte, onClick, classe = "btn") => el("button", { class: classe, type: "button", onClick }, texte);
    const boutonFormation = bouton("Dossier de la formation", dossierFormation, "btn primary");
    const boutonTableau = bouton("Tableau (CSV)", tableauCsv);
    const boutonCentre = bouton("Dossier du centre", () => dossierCentre(caseSansNom.checked), "btn primary");
    const boutonFicheFormation = bouton("Fiche résultats", () => sortirFiches("formation", "imprimer"));
    const boutonCopieFormation = bouton("Copier le texte", () => sortirFiches("formation", "copier"));
    const boutonFicheCentre = bouton("Fiche résultats", () => sortirFiches("centre", "imprimer"));
    const boutonCopieCentre = bouton("Copier le texte", () => sortirFiches("centre", "copier"));
    boutons = [boutonFormation, boutonTableau, boutonCentre, boutonFicheFormation, boutonCopieFormation, boutonFicheCentre, boutonCopieCentre];
    statut = el("p", { class: "qualiopi-statut", role: "status" });
    const { periode, retenues } = promosEtPeriodeDuCentre();
    const aideCentre = `Période : ${periodeEnMots(periode.du, periode.au)} (les 12 derniers mois). `
      + (retenues.length ? `${nb(retenues.length, "promo")} de ce centre : ${retenues.map(nomPromo).join(", ")}.` : "Aucune promo de ce centre.");
    const terminees = retenues.filter((p) => promoTerminee(p, aujourdhui)).length;
    const aideResultatsFormation = promoTerminee(etat.promo, aujourdhui)
      ? "Formation terminée : la fiche s'imprime, et son texte se copie pour le site du centre."
      : "Formation en cours : les résultats sont provisoires et ne se publient pas.";
    const aideResultatsCentre = retenues.length
      ? `Une fiche par formation, jamais de total. ${nb(terminees, "formation")} ${terminees > 1 ? "terminées" : "terminée"} sur ${retenues.length}`
        + (terminees < retenues.length ? " : les formations en cours portent la mention « Ne pas publier »." : ".")
      : "Aucune formation de ce centre à présenter.";
    return el("section", { class: "qualiopi-actions", "aria-label": "Documents à produire" },
      el("div", { class: "qualiopi-groupe", "data-groupe": "formation", role: "group", "aria-labelledby": "qualiopi-titre-formation" },
        el("h3", { id: "qualiopi-titre-formation" }, "Cette formation"),
        el("div", { class: "qualiopi-boutons" }, boutonFormation, boutonTableau),
        el("p", { class: "qualiopi-aide" }, "Dossier nominatif (stagiaires et formateurs nommés), et inventaire en tableau pour Excel."),
        el("p", { class: "qualiopi-rangee-titre" }, "Résultats à publier"),
        el("div", { class: "qualiopi-boutons" }, boutonFicheFormation, boutonCopieFormation),
        el("p", { class: "qualiopi-aide" }, aideResultatsFormation)),
      el("div", { class: "qualiopi-groupe", "data-groupe": "centre", role: "group", "aria-labelledby": "qualiopi-titre-centre" },
        el("h3", { id: "qualiopi-titre-centre" }, "Le centre"),
        el("div", { class: "qualiopi-boutons" },
          boutonCentre,
          el("label", { class: "qualiopi-case", for: "qualiopi-sans-nom" }, caseSansNom, el("span", {}, "Sans aucun nom"))),
        el("p", { class: "qualiopi-aide" }, aideCentre),
        el("p", { class: "qualiopi-rangee-titre" }, "Résultats à publier"),
        el("div", { class: "qualiopi-boutons" }, boutonFicheCentre, boutonCopieCentre),
        el("p", { class: "qualiopi-aide" }, aideResultatsCentre)),
      statut);
  }

  async function charger(promo) {
    const moi = ++chargement;
    action++;
    occupe = false;
    boutons = [];
    statut = null;
    Object.assign(etat, { promo, referentiel: null, donnees: null, ind: null, inv: null });
    majEntete(promo);
    clear(corps);
    corps.appendChild(el("div", { class: "loading" }, "Chargement"));
    try {
      const [referentiel, donnees] = await Promise.all([lireReferentielCentre(), lire(promo.id)]);
      if (!chargementVivant(moi)) return;
      Object.assign(etat, { referentiel, donnees, ind: indicateursPromo(donnees, referentiel, { aujourdhui }) });
      recalculerInventaire();
    } catch (e) {
      console.error(e);
      if (!chargementVivant(moi)) return;
      clear(corps);
      corps.appendChild(boiteErreur("Les données de la promo n'ont pas pu être chargées.", () => charger(promo)));
      return;
    }
    clear(corps);
    corps.append(construireActions(), zoneCriteres);
    afficherCriteres();
  }

  choix.addEventListener("change", () => {
    const promo = promos.find((p) => p.id === Number(choix.value));
    if (promo) charger(promo);
  });
  caseAlternance.addEventListener("change", () => {
    etat.alternance = caseAlternance.checked;
    if (!etat.donnees) return;   // pas encore chargée : le chargement tiendra compte de la case
    recalculerInventaire();
    afficherCriteres();
  });

  await charger(courante);
}
