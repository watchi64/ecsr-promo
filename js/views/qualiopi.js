// Page Qualiopi (spec docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md, § 6.3). Réservée au fondateur (porte
// dans main.js), sans entrée de barre : on y arrive par le bouton « Qualiopi » du tableau de bord du centre. Elle montre
// l'inventaire d'une promo indicateur par indicateur, et lance les sorties : dossier Qualiopi de la formation, dossier Qualiopi
// du centre (avec ou sans noms), tableau pour Excel (CSV), fiche des résultats à publier (imprimée ou copiée en texte). Page de
// l'équipe : ses textes vouvoient (règle du 10/11) ; les documents imprimés restent impersonnels. Les calculs vivent dans
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
//
// Section « Questionnaires de satisfaction » (Qualiopi Q3, indicateur 30) : pour la promo choisie, l'état de chaque
// questionnaire (ouvert ou fermé, selon les dates ou à la main), le nombre de réponses ou « moins de N réponses », les
// résultats question par question au-dessus du seuil, et les commentaires (fondateur seul, jamais avec la case « Sans aucun
// nom », jamais à l'impression). Les règles sont dans js/questionnaires-gestion-rules.js ; la base garde le seuil (rien ne
// sort en dessous). Migration pas encore appliquée : la section le dit, sans erreur (R2).
//
// Registre qualité (Qualiopi Q4, indicateurs 31 et 32) : deux sous-onglets sous l'en-tête et le choix de promo, « Inventaire et
// documents » (le nœud `corps`, créé une fois et rempli par charger(), remis tel quel à chaque retour sur l'onglet) et « Registre
// qualité » (js/views/registre-qualite.js, tout l'organisme). Le registre est lu une fois par rendu de page (etat.registre, même
// forme que la satisfaction : { etat: "lue", entrees } | { etat: "absente" } | { etat: "non_lue" }), relu après chaque
// enregistrement et chaque effacement, puis l'inventaire est recalculé. En tête de page, quel que soit l'onglet, les entrées à
// effacer et les entrées à clore.
//
// Conservation des données (Qualiopi Q5) : troisième sous-onglet (js/views/conservation.js) : les échéances de toutes les promos
// et de tous les centres, chacune avec son bouton quand sa date est passée, et l'effacement à la demande sur chaque fiche de la
// promo choisie. En tête de page, sous le rappel du registre, une ligne quand une échéance attend un clic. Après un effacement
// qui touche une promo, sa lecture est oubliée et la promo affichée est relue.

import {
  lireDonneesQualiopi, lireReferentielCentre, getMesPromos, getPromoCourante,
  lireResultatsQuestionnaire, lireCommentairesQuestionnaire, lireOuverturesQuestionnaires, ouvrirQuestionnaire, lireRegistreQualite,
} from "../db.js?v=20261111j";
import { el, clear, isoDate, toast } from "../utils.js?v=20261111j";
import { indicateursPromo } from "../centre-stats.js?v=20261111j";
import { presenceDePromo, presenceDeLaFiche } from "../qualiopi-presence.js?v=20261111j";
import { inventairePromo, tableau, satisfactionDe } from "../qualiopi-preuves.js?v=20261111j";
import {
  modeleDossierFormation, modeleDossierCentre, inventaireCsv, nomFichierQualiopi, periodeEnMots, LIBELLES_NIVEAU, PHRASE_NIVEAU, PHRASE_DE_GARDE,
} from "../qualiopi-documents.js?v=20261111j";
import {
  REFERENTIEL_APPLIQUE, referentielDu, periodeDouzeMois, promosDuCentre, nomPromo, libelleOptionPromo, groupesParCritere,
  titreImpression,
} from "../qualiopi-page-rules.js?v=20261111j";
import {
  ficheResultats, fichesResultatsTexte, tableauFiche, copierTexte, noteProvisoire, promoTerminee, AUCUNE_FORMATION,
} from "../qualiopi-resultats.js?v=20261111j";
import { NOUVEAUTES } from "../nouveautes-data.js?v=20261111j";
import { telecharger } from "./centre.js?v=20261111j";
import { imprimerQualiopi } from "../qualiopi-impression.js?v=20261111j";
import {
  QUESTIONNAIRES_GESTION, porteeGestion, anneesFormateur, libellePorteeFormateur, ouvertureDe, etatOuverture, actionsOuverture,
  messageOuverture, questionnairesAbsents, resumeReponses, satisfactionGlobale, lignesResultats, commentairesMontrables,
  messageLectureGestion, messageEchecOuverture,
} from "../questionnaires-gestion-rules.js?v=20261111j";
import { jourParis } from "../dates.js?v=20261111j";
import { renderSubTabs } from "../subtabs.js?v=20261111j";
import { aEffacer, aClore } from "../registre-rules.js?v=20261111j";
import { renderRegistreQualite } from "./registre-qualite.js?v=20261111j";
import { creerConservation } from "./conservation.js?v=20261111j";
import { pluriel } from "../nombres.js?v=20261111j";

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

// Le texte à copier : celui des fiches, ou rien (une chaîne vide, que copierTexte ne copie jamais) quand il n'y en a pas : promo du
// centre qui ne se lit pas, action devenue caduque, centre sans promo dans la période.
const texteDesFiches = (fiches) => (fiches?.length ? fichesResultatsTexte(fiches) : "");

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
        el("span", { class: "qualiopi-critere-resume" }, pluriel(indicateurs.length, "indicateur")))),
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

// =====================================================================================================
// Questionnaires : une ligne de résultats (question, accord, barre, répartition en mots)
// =====================================================================================================

// La barre est une image de la répartition (cachée aux lecteurs d'écran) ; les nombres sont toujours écrits dessous. Couleurs de
// l'échelle de « Pas du tout » à « Tout à fait », jamais de rouge ; « Sans avis » est gris.
function barreRepartition(parts) {
  const barre = el("div", { class: "qq-barre", "aria-hidden": "true" });
  parts.forEach((part, rang) => {
    if (!part.nombre) return;
    const segment = el("span", { class: "qq-segment qq-c" + rang });
    segment.style.flexGrow = String(part.nombre);
    barre.appendChild(segment);
  });
  return barre;
}

function ligneResultat(ligne) {
  const echelle = ligne.type === "echelle";
  const marques = [ligne.globale ? "question globale" : null, ligne.facultative ? "facultative" : null].filter(Boolean);
  const question = el("p", { class: "qq-question" }, ligne.texte,
    ...marques.flatMap((m) => [" ", el("span", { class: "qq-marque" }, m)]));
  if (ligne.sousSeuil) {
    return el("li", { class: "qq-ligne qq-sous-seuil" }, question, el("p", { class: "qq-chiffre" }, ligne.texteSousSeuil));
  }
  return el("li", { class: "qq-ligne" }, question,
    el("p", { class: "qq-chiffre" }, ligne.accord ? ligne.accord.texte : pluriel(ligne.n, "réponse")),
    echelle ? barreRepartition(ligne.parts) : null,
    el("ul", { class: "qq-repartition" + (echelle ? " qq-echelle" : "") }, ...ligne.parts.map((part, rang) => el("li", {},
      echelle ? el("span", { class: "qq-puce qq-c" + rang, "aria-hidden": "true" }) : null,
      el("span", {}, part.libelle, " : ", el("strong", {}, String(part.nombre)))))));
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
  const sousTitre = el("p", { class: "subtitle" }, referentielDu(jourParis(new Date())));
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
  const etat = { promo: courante, referentiel: null, donnees: null, ind: null, inv: null, alternance: false, sansNoms: false,   // alternance et sansNoms survivent au changement de promo
    registre: { etat: "non_lue" } };   // tout l'organisme : ne change pas avec la promo
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

  // Les résultats du questionnaire de fin de formation d'une promo (jamais les commentaires). Toute erreur de lecture (réseau, droit
  // refusé) rend LECTURE_ECHOUEE : satisfactionDe en fait « non lue », jamais « absente » (seule la fonction manquante l'est).
  const LECTURE_ECHOUEE = { echec: true };
  async function lireSatisfaction(promoId) {
    try {
      return await lireResultatsQuestionnaire("fin_stagiaire", { promo_id: promoId });
    } catch {
      return LECTURE_ECHOUEE;
    }
  }

  // Les deux lectures partent ensemble. Une satisfaction non lue n'est jamais gardée en mémoire : la lecture suivante (rendu, dossier,
  // bouton « Relire ») la refait.
  const lire = (id) => {
    if (!lectures.has(id)) {
      lectures.set(id, Promise.all([lireDonneesQualiopi(id), lireSatisfaction(id)])
        .then(([donnees, resultats]) => {
          const satisfaction = satisfactionDe(resultats, tableau(donnees.stagiaires).length);
          if (satisfaction.etat === "non_lue") lectures.delete(id);
          return { ...donnees, satisfaction };
        })
        .catch((e) => { lectures.delete(id); throw e; }));
    }
    return lectures.get(id);
  };

  // À l'écran seulement : quand la satisfaction de la promo affichée n'a pas pu être lue, une phrase et un bouton qui relisent la promo.
  function noteSatisfaction() {
    const note = el("div", { class: "qualiopi-note-satisfaction" });
    if (etat.donnees?.satisfaction?.etat !== "non_lue") return note;
    note.append(el("p", { class: "qualiopi-aide" }, "La satisfaction des stagiaires n'a pas pu être lue. Les documents l'indiquent « non lue »."),
      el("button", { class: "btn", type: "button", onClick: () => { lectures.delete(etat.promo.id); charger(etat.promo); } }, "Relire la satisfaction"));
    return note;
  }

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
    sousTitre.textContent = [centre ?? "centre non renseigné", nomPromo(promo), referentielDu(jourParis(new Date()))].join(" · ");
    texteCentre.textContent = centre ?? "non renseigné";
    texteDates.textContent = periodeEnMots(promo.date_debut, promo.date_fin);
  }

  // --- Corps : actions, puis critères ---
  const corps = el("div", { class: "qualiopi-corps" });
  const zoneCriteres = el("section", { class: "qualiopi-criteres" });

  // --- Registre qualité (Q4) : lu une fois par rendu de page, relu après chaque changement ---
  const rappelRegistre = el("div", { class: "qualiopi-rappel-registre" });
  racine.appendChild(rappelRegistre);
  let lectureRegistre = null;        // la dernière lecture du registre (promesse de etat.registre)
  let numeroRegistre = 0;            // une lecture plus récente rend caduque celle qui attend encore
  function lireRegistre() {
    const moi = ++numeroRegistre;
    lectureRegistre = lireRegistreQualite()
      .then((entrees) => (entrees === null ? { etat: "absente" } : { etat: "lue", entrees }))
      .catch((e) => { console.error(e); return { etat: "non_lue" }; })
      .then((registre) => {
        if (moi === numeroRegistre && pageVivante()) {
          etat.registre = registre;
          majRappelRegistre();
          if (etat.donnees) {
            recalculerInventaire();
            afficherCriteres();
          }
        }
        return registre;
      });
    return lectureRegistre;
  }

  // En tête de page, quel que soit l'onglet : les entrées closes depuis plus de 3 ans (textes à effacer) et les entrées
  // ouvertes ou en cours dont le constat a plus de 3 ans (à clore : elles ne s'effacent qu'une fois closes).
  function majRappelRegistre() {
    clear(rappelRegistre);
    if (etat.registre.etat !== "lue") return;
    const entrees = etat.registre.entrees;
    const lignes = [];
    const aEffacerN = aEffacer(entrees, new Date()).length;
    const aCloreN = aClore(entrees, jourParis(new Date())).length;
    if (aEffacerN) lignes.push(`${pluriel(aEffacerN, "entrée")} du registre à effacer (closes depuis plus de 3 ans).`);
    if (aCloreN) lignes.push(`${pluriel(aCloreN, "entrée")} à clore (constat de plus de 3 ans, encore ${aCloreN > 1 ? "ouvertes" : "ouverte"} ou en cours).`);
    if (!lignes.length) return;
    rappelRegistre.append(
      el("div", { class: "qualiopi-rappel-textes" }, ...lignes.map((ligne) => el("p", {}, ligne))),
      el("button", { class: "btn", type: "button", onClick: () => sousOnglets.activer("registre") }, "Voir le registre"));
  }

  // --- Conservation des données (Q5) : échéances lues une fois par rendu, relues après chaque effacement ---
  const conservation = creerConservation({
    ouvrirRegistre: () => sousOnglets.activer("registre"),
    ouvrirConservation: () => sousOnglets.activer("conservation"),
    apresEffacement: (promoId) => {
      if (!pageVivante()) return;
      if (promoId !== null) lectures.delete(promoId);
      if (promoId === null || promoId === etat.promo.id) {
        lectures.delete(etat.promo.id);
        charger(etat.promo);
      }
    },
  });
  racine.appendChild(conservation.rappel);

  lireRegistre();
  conservation.lireEtat();
  const sousOnglets = renderSubTabs([
    { key: "inventaire", label: "Inventaire et documents", render: (panneau) => panneau.appendChild(corps) },
    { key: "registre", label: "Registre qualité", render: (panneau) => renderRegistreQualite(panneau, { lire: () => lectureRegistre, surChangement: lireRegistre }) },
    { key: "conservation", label: "Conservation des données", render: (panneau) => panneau.appendChild(conservation.noeud) },
  ], { storageKey: "qualiopi.subtab" });
  racine.appendChild(sousOnglets);

  // --- Questionnaires de satisfaction (Q3) : lus à part, sans retenir le reste de la page ---
  // Le jour des questionnaires est celui de Paris, comme celui de la base (jourParis) ; il est recalculé à chaque lecture, pour
  // qu'une page restée ouverte depuis la veille, ou un appareil réglé sur un autre fuseau, montre l'état que la base applique.
  const zoneQuestionnaires = el("section", { class: "qualiopi-questionnaires", "aria-labelledby": "qualiopi-titre-questionnaires" });
  // Une seule zone annoncée (role="status"), posée une fois et jamais recréée : les cartes sont redessinées, pas elle.
  const annonceQq = el("p", { class: "qq-annonce", role: "status", "aria-live": "polite" });
  // lu : null pendant la première lecture, { erreur }, { absent: true } (migration pas encore appliquée), ou { ouvertures, cartes }.
  // Une carte est { portee, resultats, commentaires }, { portee, erreur } si sa lecture échoue, ou { chargement: true }.
  const qq = { lu: null, jour: jourParis(new Date()), anneeFormateur: null, occupe: false };
  qq.anneeFormateur = Number(qq.jour.slice(0, 4));
  const statutsQq = new Map();       // clé du questionnaire : { texte, erreur }, le message de la dernière action, gardé au redessin
  let lectureQq = 0;                 // numéro de la dernière lecture des questionnaires
  const promosDuLieu = (promo) => promos.filter((p) => p.lieu_id != null && p.lieu_id === promo.lieu_id);

  // Une carte : sa portée, ses résultats, et ses commentaires lus seulement à partir du seuil (la base n'en rend aucun dessous).
  // Une lecture qui échoue reste dans sa carte : les deux autres s'affichent.
  async function lireCarte(cle, promo) {
    const portee = porteeGestion(cle, promo, qq.anneeFormateur);
    if (!portee) return { portee: null, resultats: null, commentaires: [] };
    try {
      const resultats = await lireResultatsQuestionnaire(cle, portee);
      const commentaires = resumeReponses(cle, resultats).assez ? await lireCommentairesQuestionnaire(cle, portee) : [];
      return { portee, resultats, commentaires };
    } catch (e) {
      console.error(e);
      return { portee, erreur: messageLectureGestion(e) };
    }
  }

  function annoncer(texte) {
    annonceQq.textContent = "";
    if (texte) setTimeout(() => { annonceQq.textContent = texte; }, 50);   // vidée puis remplie : le même message est relu
  }

  // Lit les trois questionnaires de la promo. `focus` (après une action ou un changement d'année) : la section reste affichée
  // pendant la relecture, puis le focus revient à l'élément qui l'avait (clavier).
  async function chargerQuestionnaires(promo, focus = null) {
    const moi = ++lectureQq;
    qq.jour = jourParis(new Date());
    const annees = anneesFormateur(promosDuLieu(promo), qq.jour);
    if (!annees.includes(qq.anneeFormateur)) qq.anneeFormateur = annees[0] ?? Number(qq.jour.slice(0, 4));
    if (!focus) {
      qq.lu = null;
      afficherQuestionnaires();
    }
    let lu;
    try {
      const [ouvertures, ...cartes] = await Promise.all([
        lireOuverturesQuestionnaires(), ...QUESTIONNAIRES_GESTION.map((q) => lireCarte(q.cle, promo))]);
      const resultats = cartes.filter((c) => c.portee && !c.erreur).map((c) => c.resultats);
      lu = questionnairesAbsents({ ouvertures, resultats })
        ? { absent: true }
        : { ouvertures, cartes: Object.fromEntries(QUESTIONNAIRES_GESTION.map((q, i) => [q.cle, cartes[i]])) };
    } catch (e) {
      console.error(e);
      lu = { erreur: messageLectureGestion(e) };   // les ouvertures ne se lisent pas : aucun état n'est sûr, aucune carte
    }
    if (moi !== lectureQq || !pageVivante() || etat.promo !== promo) return;
    qq.lu = lu;
    afficherQuestionnaires();
    if (focus) zoneQuestionnaires.querySelector(focus)?.focus();
  }

  async function basculerQuestionnaire(cle, portee, valeur) {
    if (qq.occupe) return;
    const promo = etat.promo;
    // Le jour a changé depuis l'affichage (page restée ouverte) : l'état montré n'est peut-être plus celui de la base. On relit
    // sans rien changer, et on le dit.
    if (jourParis(new Date()) !== qq.jour) {
      statutsQq.clear();
      statutsQq.set(cle, { texte: "Le jour a changé depuis l'affichage : l'état vient d'être relu, vérifiez-le avant d'agir.", erreur: true });
      annoncer(statutsQq.get(cle).texte);
      await chargerQuestionnaires(promo, `button[data-cle="${cle}"]`);
      return;
    }
    qq.occupe = true;
    zoneQuestionnaires.querySelectorAll("button[data-cle], select").forEach((b) => { b.disabled = true; });
    statutsQq.clear();
    try {
      await ouvrirQuestionnaire(cle, portee, valeur);
      statutsQq.set(cle, { texte: messageOuverture(valeur), erreur: false });
    } catch (e) {
      console.error(e);
      statutsQq.set(cle, { texte: messageEchecOuverture(e), erreur: true });
    } finally {
      qq.occupe = false;
    }
    if (!pageVivante() || etat.promo !== promo) return;
    await chargerQuestionnaires(promo, `button[data-cle="${cle}"]`);
    annoncer(statutsQq.get(cle)?.texte);
  }

  // Changement d'année des formateurs : la carte de l'ancienne année est vidée et les boutons attendent la nouvelle lecture,
  // pour qu'aucun clic n'agisse sur l'année d'avant.
  function changerAnnee(annee) {
    const promo = etat.promo;
    qq.anneeFormateur = annee;
    statutsQq.clear();
    if (qq.lu?.cartes) {
      qq.lu = { ...qq.lu, cartes: { ...qq.lu.cartes, fin_formateur: { chargement: true } } };
      afficherQuestionnaires();
      zoneQuestionnaires.querySelectorAll("button[data-cle]").forEach((b) => { b.disabled = true; });
    }
    chargerQuestionnaires(promo, "#qq-annee");
  }

  // Ligne « qui répond » ; pour les formateurs, le centre et l'année (au choix quand la fin des promos touche deux années).
  function ligneQui(cle, qui, promo, enAttente) {
    if (cle !== "fin_formateur") return el("p", { class: "qq-qui" }, qui);
    const annees = anneesFormateur(promosDuLieu(promo), qq.jour);
    const ligne = el("div", { class: "qq-qui" }, el("p", {}, libellePorteeFormateur(promo.lieu_nom, qq.anneeFormateur)));
    if (annees.length > 1) {
      const choixAnnee = el("select", { id: "qq-annee", class: "qualiopi-select qq-annee" },
        ...annees.map((a) => el("option", { value: String(a) }, String(a))));
      choixAnnee.value = String(qq.anneeFormateur);
      choixAnnee.disabled = enAttente;
      choixAnnee.addEventListener("change", () => changerAnnee(Number(choixAnnee.value)));
      ligne.appendChild(el("p", { class: "qq-annee-ligne" }, el("label", { for: "qq-annee" }, "Année"), choixAnnee));
    }
    return ligne;
  }

  function carteQuestionnaire({ cle, titre, qui }) {
    const promo = etat.promo;
    const carte = qq.lu.cartes[cle];
    const idTitre = "qq-titre-" + cle;
    const tete = el("div", { class: "qq-tete" }, el("h4", { id: idTitre, class: "qq-titre" }, titre));
    const article = (...enfants) => el("article", { class: "qq-carte", "aria-labelledby": idTitre }, tete, ...enfants);
    if (carte.chargement) return article(ligneQui(cle, qui, promo, true), el("div", { class: "loading" }, "Chargement"));
    if (!carte.portee) {
      return article(el("p", { class: "qq-qui" }, "Cette promo n'a pas de centre : le questionnaire des formateurs se lit par centre."));
    }
    if (carte.erreur) {
      return article(ligneQui(cle, qui, promo, false),
        el("div", { class: "qq-erreur" }, el("p", {}, carte.erreur),
          el("button", { class: "btn", type: "button", "data-cle": cle, onClick: () => chargerQuestionnaires(etat.promo, `button[data-cle="${cle}"]`) }, "Réessayer")));
    }
    const etatO = etatOuverture({
      cle, promo, promosDuLieu: promosDuLieu(promo), annee: qq.anneeFormateur, aujourdhui: qq.jour,
      ouverture: ouvertureDe(qq.lu.ouvertures, cle, carte.portee),
    });
    tete.appendChild(el("span", { class: "qq-etat " + (etatO.ouvert ? "ouvert" : "ferme") }, etatO.etiquette));
    const resume = resumeReponses(cle, carte.resultats);
    const seuil = carte.resultats?.seuil;

    const chiffres = el("dl", { class: "qq-chiffres" },
      el("div", {}, el("dt", {}, "Ouverture"), el("dd", {}, etatO.detail)),
      el("div", {}, el("dt", {}, "Réponses"), el("dd", { class: "qq-nombre" }, resume.texte)));
    if (resume.assez) {
      const globale = satisfactionGlobale(cle, carte.resultats);
      chiffres.appendChild(el("div", {}, el("dt", {}, "Satisfaction globale"),
        globale
          ? el("dd", { class: "qq-nombre" }, globale.valeur, el("span", { class: "qq-detail" }, globale.detail))
          : el("dd", {}, `moins de ${seuil} notes à la question globale : pas de taux`)));
    }

    // Les boutons suivent l'état effectif, calculé avec le jour de Paris de cette lecture (actionsOuverture).
    const statut = statutsQq.get(cle);
    const actions = el("div", { class: "qq-actions" },
      el("div", { class: "qualiopi-boutons" }, ...actionsOuverture(etatO).map((a) => el("button", {
        class: "btn", type: "button", "data-cle": cle, onClick: () => basculerQuestionnaire(cle, carte.portee, a.valeur),
      }, a.libelle))),
      el("p", { class: "qq-statut" + (statut?.erreur ? " erreur" : "") }, statut?.texte ?? ""));

    const corpsCarte = [ligneQui(cle, qui, promo, false), chiffres, actions];
    if (!resume.assez) {
      corpsCarte.push(el("p", { class: "qq-aide" }, `Les résultats et les commentaires s'affichent à partir de ${seuil} réponses.`));
    } else {
      corpsCarte.push(repliable(el("details", { class: "qq-details" },
        el("summary", {}, "Résultats question par question"),
        el("ol", { class: "qq-lignes" }, ...lignesResultats(cle, carte.resultats).map(ligneResultat))), "qq-resultats-" + cle, ouverts));
      // Commentaires : fondateur seul, jamais avec « Sans aucun nom » ; la feuille de style les cache aussi à l'impression.
      if (etat.sansNoms) {
        corpsCarte.push(el("p", { class: "qq-aide" }, "Commentaires masqués : la case « Sans aucun nom » est cochée."));
      } else {
        const textes = commentairesMontrables(carte.commentaires, { sansNoms: etat.sansNoms, assez: resume.assez });
        corpsCarte.push(textes.length
          ? repliable(el("details", { class: "qq-details qualiopi-commentaires" },
            el("summary", {}, `Commentaires (${textes.length})`),
            el("p", { class: "qq-aide" }, "Dans un ordre tiré au hasard. Visibles par vous seul, jamais dans les documents."),
            el("ul", { class: "qq-commentaires" }, ...textes.map((t) => el("li", {}, t)))), "qq-commentaires-" + cle, ouverts)
          : el("p", { class: "qq-aide qualiopi-commentaires" }, "Aucun commentaire écrit."));
      }
    }
    return article(...corpsCarte);
  }

  // L'en-tête de la section et la zone annoncée sont posés une fois ; seul le contenu est redessiné.
  const contenuQq = el("div", { class: "qq-contenu" });
  zoneQuestionnaires.append(
    el("h3", { class: "qualiopi-titre", id: "qualiopi-titre-questionnaires" }, "Questionnaires de satisfaction"),
    el("p", { class: "qualiopi-intro" },
      "Réponses anonymes. Rien ne s'affiche sous le seuil : 5 réponses de stagiaires, 3 de formateurs."),
    annonceQq,
    contenuQq);

  function afficherQuestionnaires() {
    clear(contenuQq);
    const lu = qq.lu;
    if (lu === null) contenuQq.appendChild(el("div", { class: "loading" }, "Chargement"));
    else if (lu.erreur) contenuQq.appendChild(boiteErreur(lu.erreur, () => chargerQuestionnaires(etat.promo)));
    else if (lu.absent) contenuQq.appendChild(el("p", { class: "qualiopi-vide" }, "Les questionnaires ne sont pas encore en service."));
    else contenuQq.appendChild(el("div", { class: "qq-cartes" }, ...QUESTIONNAIRES_GESTION.map(carteQuestionnaire)));
  }

  function recalculerInventaire() {
    etat.inv = inventairePromo({ ...etat.donnees, registre: etat.registre }, etat.referentiel, {
      promo: etat.promo, aujourdhui, alternance: etat.alternance, nouveautes: NOUVEAUTES,
    });
  }

  function afficherCriteres() {
    clear(zoneCriteres);
    zoneCriteres.append(...[
      el("h3", { class: "qualiopi-titre" }, "Les critères du référentiel"),
      el("p", { class: "qualiopi-intro" },
        "Ouvrez un critère pour voir ses indicateurs : le niveau de preuve que l'app apporte, les pièces qu'elle a (présentes ou "
        + "absentes pour cette promo) et celles que le centre fournit lui-même."),
      el("p", { class: "qualiopi-intro qualiopi-legende-niveau" }, PHRASE_NIVEAU),
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
      const modele = modeleDossierFormation({ inv, donnees: { ...donnees, registre: etat.registre }, ind, promo, lieu: promo.lieu_nom, intitule: donnees.entete?.intitule, aujourdhui });
      ecrireStatut("");
      imprimerQualiopi(documentImprimable(modele), titreImpression("dossier-formation", promo.nom, aujourdhui));
    } catch (e) {
      console.error(e);
      ecrireStatut("Le dossier Qualiopi de la formation n'a pas pu être préparé. Rechargez la page, puis réessayez.", true);
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
      ecrireStatut("Le tableau n'a pas pu être téléchargé. Rechargez la page, puis réessayez.", true);
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
        if (actionVivante(moi)) ecrireStatut(`La promo « ${nomPromo(p)} » n'a pas pu être lue : ${quoi}. Réessayez dans un instant.`, true);
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
    const { promo, referentiel, alternance, registre } = etat;
    const { periode, retenues } = promosEtPeriodeDuCentre();
    bloquerBoutons(true);
    try {
      const promosLues = await lirePromosDuCentre(moi, retenues, "le dossier Qualiopi du centre n'est pas préparé", (p, donnees) => ({
        promo: p,
        donnees,
        inv: inventairePromo({ ...donnees, registre }, referentiel, { promo: p, aujourdhui, alternance, nouveautes: NOUVEAUTES }),
        ind: indicateursPromo(donnees, referentiel, { aujourdhui, demandes: donnees.demandes }),
      }));
      if (!promosLues) return;
      const modele = modeleDossierCentre({ promos: promosLues, lieu: promo.lieu_nom, lieuId: promo.lieu_id, registre, periode, aujourdhui, sansNoms, nouveautes: NOUVEAUTES });
      ecrireStatut("");
      imprimerQualiopi(documentImprimable(modele), titreImpression(sansNoms ? "dossier-centre-sans-noms" : "dossier-centre", promo.lieu_nom, aujourdhui));
    } catch (e) {
      console.error(e);
      if (actionVivante(moi)) ecrireStatut("Le dossier Qualiopi du centre n'a pas pu être préparé. Rechargez la page, puis réessayez.", true);
    } finally {
      if (actionVivante(moi)) bloquerBoutons(false);
    }
  }

  // La fiche des résultats à publier (js/qualiopi-resultats.js, spec § 6.6) : celle de la promo choisie (`portee` « formation ») ou
  // celles des promos du centre, les mêmes que pour le dossier du centre, l'une après l'autre (« centre ») ; imprimée (`sortie`
  // « imprimer ») ou copiée en texte pour le site du centre (« copier »). Les promos en cours portent leur avertissement dans la
  // fiche comme dans le texte ; rien n'est additionné entre les promos.
  // Copier : la copie est DEMANDÉE tout de suite, dans le geste du clic, avant le moindre `await`, avec la promesse du texte (celui du
  // centre n'existe qu'après la lecture de ses promos) : Safari, iOS compris, n'accepte pas une demande faite après une attente, ni
  // Firefox après 5 secondes. C'est le même chemin pour « Cette formation » et pour « Le centre ».
  async function sortirFiches(portee, sortie) {
    if (occupe || !etat.donnees) return;
    const moi = ++action;
    const { promo, referentiel } = etat;
    bloquerBoutons(true);
    try {
      // Les fiches : celle de la promo choisie sur-le-champ, celles du centre après la lecture de ses promos (rien si une promo ne se
      // lit pas ou si l'action devient caduque : le message est alors déjà écrit).
      const lesFiches = portee === "formation"
        ? Promise.resolve([ficheResultats({ promo, ind: etat.ind, aujourdhui, presence: presenceDeLaFiche(presenceDePromo(etat.donnees.emargement, promo.id)), satisfaction: etat.donnees.satisfaction })])
        : lirePromosDuCentre(moi, promosEtPeriodeDuCentre().retenues, "les résultats du centre ne sont pas préparés",
          (p, donnees) => ficheResultats({ promo: p, ind: indicateursPromo(donnees, referentiel, { aujourdhui, demandes: donnees.demandes }), aujourdhui, presence: presenceDeLaFiche(presenceDePromo(donnees.emargement, p.id)), satisfaction: donnees.satisfaction }));
      const copie = sortie === "copier" ? copierTexte(lesFiches.then(texteDesFiches)) : null;   // sans await : dans le geste du clic
      const fiches = await lesFiches;
      if (!fiches) return;
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
      const resultat = await copie;
      if (!actionVivante(moi)) return;
      if (resultat.copie) {
        ecrireStatut([resultat.message, noteProvisoire(fiches)].filter(Boolean).join(" "));
        toast("Texte copié", "success");
      } else {
        ecrireStatut(resultat.message, true);
        statut?.scrollIntoView?.({ block: "nearest" });
      }
    } catch (e) {
      console.error(e);
      if (actionVivante(moi)) ecrireStatut("La fiche des résultats n'a pas pu être préparée. Rechargez la page, puis réessayez.", true);
    } finally {
      if (actionVivante(moi)) bloquerBoutons(false);
    }
  }

  // Deux groupes d'actions (R7), chacun annoncé par son titre : les dossiers, puis la fiche des résultats à publier (« Fiche
  // résultats » et « Copier le texte »). La case « Sans aucun nom » ne concerne que le dossier du centre : la fiche n'a aucun nom.
  function construireActions() {
    // La case est refaite à chaque chargement de promo : sa valeur vit dans `etat`, pas dans la case, pour qu'un changement de promo
    // ne la décoche pas en silence (le dossier du centre sortirait alors avec les noms des formateurs).
    const caseSansNom = el("input", { type: "checkbox", id: "qualiopi-sans-nom" });
    caseSansNom.checked = etat.sansNoms;
    caseSansNom.addEventListener("change", () => { etat.sansNoms = caseSansNom.checked; });
    // Les commentaires des questionnaires suivent la case : masqués dès qu'elle est cochée.
    caseSansNom.addEventListener("change", () => { if (qq.lu?.cartes) afficherQuestionnaires(); });
    const bouton = (texte, onClick, classe = "btn") => el("button", { class: classe, type: "button", onClick }, texte);
    const boutonFormation = bouton("Dossier Qualiopi de la formation", dossierFormation, "btn primary");
    const boutonTableau = bouton("Tableau pour Excel (CSV)", tableauCsv);
    const boutonCentre = bouton("Dossier Qualiopi du centre", () => dossierCentre(etat.sansNoms), "btn primary");
    const boutonFicheFormation = bouton("Fiche résultats", () => sortirFiches("formation", "imprimer"));
    const boutonCopieFormation = bouton("Copier le texte", () => sortirFiches("formation", "copier"));
    const boutonFicheCentre = bouton("Fiche résultats", () => sortirFiches("centre", "imprimer"));
    const boutonCopieCentre = bouton("Copier le texte", () => sortirFiches("centre", "copier"));
    boutons = [boutonFormation, boutonTableau, boutonCentre, boutonFicheFormation, boutonCopieFormation, boutonFicheCentre, boutonCopieCentre];
    statut = el("p", { class: "qualiopi-statut", role: "status" });
    const { periode, retenues } = promosEtPeriodeDuCentre();
    const aideCentre = `Période : ${periodeEnMots(periode.du, periode.au)} (les 12 derniers mois). `
      + (retenues.length ? `${pluriel(retenues.length, "promo")} de ce centre : ${retenues.map(nomPromo).join(", ")}.` : "Aucune promo de ce centre.");
    const terminees = retenues.filter((p) => promoTerminee(p, aujourdhui)).length;
    const aideResultatsFormation = promoTerminee(etat.promo, aujourdhui)
      ? "Formation terminée : la fiche s'imprime, et son texte se copie pour le site du centre."
      : "Formation en cours : les résultats sont provisoires et ne se publient pas.";
    const aideResultatsCentre = retenues.length
      ? `Une fiche par formation, jamais de total. ${pluriel(terminees, "formation")} ${terminees > 1 ? "terminées" : "terminée"} sur ${retenues.length}`
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
    statutsQq.clear();
    conservation.majPromo(promo, lire(promo.id).then((d) => d.stagiaires));   // les fiches de la lecture du dossier, sans attendre
    chargerQuestionnaires(promo);   // sans attendre : la section se remplit à son rythme
    try {
      const [referentiel, donnees] = await Promise.all([lireReferentielCentre(), lire(promo.id)]);
      if (!chargementVivant(moi)) return;
      Object.assign(etat, { referentiel, donnees, ind: indicateursPromo(donnees, referentiel, { aujourdhui, demandes: donnees.demandes }) });
      recalculerInventaire();
    } catch (e) {
      console.error(e);
      if (!chargementVivant(moi)) return;
      clear(corps);
      corps.appendChild(boiteErreur("Les données de la promo n'ont pas pu être chargées.", () => charger(promo)));
      return;
    }
    clear(corps);
    corps.append(construireActions(), noteSatisfaction(), zoneQuestionnaires, zoneCriteres);
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
