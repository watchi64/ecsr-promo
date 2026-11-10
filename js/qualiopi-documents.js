// Modèles des deux dossiers Qualiopi (spec docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md, § 6.4, 6.5 et
// 6.8) et export CSV de l'inventaire. PUR : ni DOM ni réseau, testé en node (tests/qualiopi-documents.test.mjs).
//
// Les modèles rendent des données prêtes à mettre en page ; la vue (js/views/qualiopi.js) ne calcule rien :
//   { titre, sousTitre, garde: string[], sommaire: [{ numero, court, section }],
//     sections: [{ id, titre, indicateurs: number[], paragraphes: string[], tableaux: [{ entetes, lignes }] }],
//     aFournir: [{ numero, court, items }] }
// `sommaire[].section` est l'identifiant de la section qui sert l'indicateur, nul pour un indicateur hors de l'app
// (il n'apparaît alors que dans `aFournir`). `sections[].indicateurs` liste ce que la section sert. Un tableau n'est
// jamais vide (il est omis), aucune cellule n'est vide : une valeur manquante devient un mot.
//
// Dossier de la formation : nominatif, il n'existe pas sans les noms. Dossier du centre : promo par promo, jamais en total,
// avec ou sans noms. Sans noms : des agrégats seulement, aucune ligne par personne, aucun texte saisi par une personne
// (sujet de séance, intervenant « Autre », titre du calendrier), aucun nom de formateur. Bénévoles et auto-écoles ne sont
// jamais nommés, en nombres seulement dans toutes les versions. Les documents sont impersonnels (ni « tu » ni « vous »),
// sauf dans les titres des annonces de l'application, cités entre guillemets français tels qu'ils ont été publiés.
//
// Réutilisation : les phrases et les règles du planning (demi-journées, jours désactivés, intervenants distincts) viennent
// de l'inventaire (js/qualiopi-preuves.js), les chiffres et les méthodes du tableau de bord du centre (js/centre-stats.js).
// Les tableaux par stagiaire comptent les mêmes stagiaires que lui : ceux en formation, et le document le dit ; seule la
// liste nominative de l'effectif montre aussi les abandons.

import { SOURCE } from "./qualiopi-referentiel.js?v=20261110a";
import { jourDe, rempli, tableau, nb, demandesDe, RAISON_EFFACEE, promoTerminee, nouveautesCitables, lignesDuPlanning, demiJournees, intervenantsDistincts } from "./qualiopi-preuves.js?v=20261110a";
import { TYPES, ORIGINES, ETATS, entreesPourPromo, entreesPourCentre, decompteRegistre, delaiMedianJours } from "./registre-rules.js?v=20261110a";
import { ligneComparaison, METHODES, METHODES_PUBLIQUES } from "./centre-stats.js?v=20261110a";
import { estNotee, score20 } from "./notes-stats.js?v=20261110a";
import { cellule, nombre, slug } from "./centre-csv.js?v=20261110a";
import { compareByNom } from "./utils.js?v=20261110a";
import { statutFiche } from "./effacement-rules.js?v=20261110a";
import { dureeEnToutesLettres } from "./attestations-rules.js?v=20261110a";
import { presenceDePromo } from "./qualiopi-presence.js?v=20261110a";

export const PHRASE_DE_GARDE = "Pièces issues de l'application ECSR Promo, à joindre au dossier qualité du centre. Le centre reste seul audité et certifié.";

// Niveaux de l'inventaire, en mots (ceux de la page).
export const LIBELLES_NIVEAU = { prouve: "Prouvé", partiel: "En partie", hors: "Hors de l'app" };
// La colonne du niveau et ce qu'elle veut dire : écrites ici une fois, pour la page, les deux dossiers et le CSV. Le niveau
// n'est pas un constat de conformité : seules les pièces disent ce qui existe pour chaque promo.
export const COLONNE_NIVEAU = "Apport de l'application";
export const PHRASE_NIVEAU = "Le niveau dit ce que l'application peut apporter pour cet indicateur, pas un constat de conformité ; seules les pièces disent ce qui existe pour chaque promo.";

const DECRET = SOURCE.decret.replace(/ relatif .*$/, "");   // « Décret n° 2026-728 du 1er août 2026 »
const AUCUNE_PROMO = "Aucune promo dans la période.";
const TYPES_CLES = new Map([["formation", "Formation"], ["stage", "Stage"], ["examen", "Examen"]]);   // types du calendrier qui sont des dates clés
const ASSIDUITE_A_JOINDRE = "Les heures ne sont pas mesurées d'après les feuilles d'émargement pour cette promo : joindre les feuilles d'émargement signées, si elles existent.";
const HEURES_NON_LUES = "non mesurées (erreur de lecture)";
const HEURES_SANS_FEUILLES = "non mesurées (feuilles d'émargement non utilisées pour cette promo)";
const REGLE_DEMI_JOURNEES = "Synthèse par semaine d'après le planning : une demi-journée de formation compte dès qu'une ligne du planning "
  + "porte une activité, un sujet, un formateur, un intervenant extérieur ou l'autonomie du groupe ; les jours désactivés du planning ne comptent pas.";
const BOM = String.fromCharCode(0xfeff);

// --- Petits outils : dates, mots, nombres ---

// Les petits outils de l'inventaire (jourDe, rempli, tableau, nb) et ses aides du planning sont importés de
// js/qualiopi-preuves.js, jamais recopiés : les dossiers suivent ainsi toujours la règle de l'inventaire.
const dateFr = (jour) => (jour ? `${jour.slice(8)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}` : null);
const texte = (valeur, defaut) => (rempli(valeur) ? valeur.trim() : defaut);
const somme = (liste) => liste.reduce((a, b) => a + b, 0);
const enFrancais = (a, b) => a.localeCompare(b, "fr");
const majuscule = (mot) => mot.charAt(0).toUpperCase() + mot.slice(1);
const pourcent = (x) => `${Math.round(x * 100)}${String.fromCharCode(0xa0)}%`;   // espace insécable avant « % », comme centre-stats.js
const fr1 = (x) => x.toFixed(1).replace(".", ",");   // comme le tableau de comparaison : « 11,8/20 »

// Un tableau, ou rien s'il n'a pas de ligne : à étaler dans la liste des tableaux d'une section.
const table = (entetes, lignes) => (lignes.length ? [{ entetes, lignes }] : []);

// « du 28/09/2026 au 23/10/2026 », « depuis le 28/09/2026 », « jusqu'au 23/10/2026 », ou un mot s'il n'y a aucune date.
// Exportée : la page Qualiopi écrit ses dates de la même façon (js/views/qualiopi.js).
export function periodeEnMots(debut, fin) {
  const [d, f] = [dateFr(jourDe(debut)), dateFr(jourDe(fin))];
  if (d && f) return `du ${d} au ${f}`;
  if (d) return `depuis le ${d}`;
  if (f) return `jusqu'au ${f}`;
  return "dates non renseignées";
}

// La règle « terminée » est écrite une seule fois, dans js/qualiopi-preuves.js (l'inventaire s'en sert aussi) ; réexportée ici.
export { promoTerminee };

const libellePromo = (promo) => texte(promo?.nom, "promo sans nom");
// Sans accents ni majuscules, pour comparer deux noms.
const nu = (mot) => mot.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
// « Nîmes, mars 2026 » : le centre, puis la promo, sauf quand le nom de la promo contient déjà le centre (« Nîmes, Nîmes, mars 2026 »).
const centreEtPromo = (centre, promo) => (nu(libellePromo(promo)).includes(nu(centre)) ? libellePromo(promo) : `${centre}, ${libellePromo(promo)}`);
const nomComplet = (s) => [s?.nom, s?.prenom].filter(rempli).map((x) => x.trim()).join(" ") || "Stagiaire sans nom";
// Les stagiaires en formation : les fiches actives, sans celles effacées à la demande de la personne (comptées à part).
const enFormationDe = (donnees) => {
  const demandes = demandesDe(donnees);
  return tableau(donnees.stagiaires).filter((s) => s.actif && !demandes.has(s.id)).sort(compareByNom);
};
// « Édité le 28/10/2026 » : exportée, la fiche des résultats (js/qualiopi-resultats.js) date son édition de la même façon.
export const edition = (aujourdhui) => `Édité le ${dateFr(jourDe(aujourdhui)) ?? "date non renseignée"}`;
const REFERENTIEL = `Référentiel appliqué : ${DECRET} (référentiel national qualité), en vigueur le ${dateFr(SOURCE.enVigueur)}, catégorie « action de formation »`;

// --- Pièces de l'inventaire : leurs phrases chiffrées, sans nom ni texte saisi ---

function pieceDe(inv, cle) {
  for (const indicateur of tableau(inv?.indicateurs)) {
    const piece = tableau(indicateur.pieces).find((p) => p.cle === cle);
    if (piece) return piece;
  }
  return null;
}
// Ce que dit la pièce : sa phrase chiffrée si elle est présente, la raison de son absence sinon.
const contenuPiece = (piece) => (piece ? texte(piece.presente ? piece.detail : piece.raison, "non renseigné") : "non disponible");
const phrase = (piece) => (piece ? `${piece.libelle} : ${contenuPiece(piece)}.` : null);
const phrases = (inv, ...cles) => cles.map((cle) => phrase(pieceDe(inv, cle))).filter(Boolean);

// --- Planning : l'ordre des lignes et les semaines (les demi-journées et les intervenants suivent la règle de l'inventaire) ---

const rang = (e) => (Number.isInteger(e.day_index) ? e.day_index : 9) * 2 + (e.half_day === "aprem" ? 1 : 0);

// Les lignes regroupées par semaine (le lundi), des plus anciennes aux plus récentes ; une semaine illisible est écartée.
function parSemaine(lignes) {
  const semaines = new Map();
  lignes.forEach((e) => {
    const lundi = jourDe(e.semaine_lundi);
    if (!lundi) return;
    if (!semaines.has(lundi)) semaines.set(lundi, []);
    semaines.get(lundi).push(e);
  });
  return [...semaines].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

// Le nom d'un formateur d'après la liste des formateurs ; son numéro s'il n'y est pas.
const nomFormateur = (noms) => (id) => noms.get(id) ?? `formateur n° ${id}`;
const nomsDesFormateurs = (...listes) => new Map(listes.flatMap((l) => tableau(l)).filter((p) => rempli(p.nom)).map((p) => [p.id, p.nom.trim()]));

// Synthèse du déroulé, une ligne par semaine : demi-journées, activités comptées par demi-journée (« Autonomie » pour un
// groupe en autonomie), formateurs nommés, intervenants « Autre » et bénévoles en nombres, sujets des séances.
function lignesSemaines(planning, nomDe) {
  return parSemaine(planning).map(([lundi, lignes]) => {
    const demis = demiJournees(lignes);
    const activites = new Map();
    demis.forEach((l) => {
      const noms = new Set(l.map((e) => texte(e.activite, null)).filter(Boolean));
      if (l.some((e) => e.autonomie)) noms.add("Autonomie");
      noms.forEach((a) => activites.set(a, (activites.get(a) || 0) + 1));
    });
    const chrono = [...lignes].sort((a, b) => rang(a) - rang(b));
    const { formateurs, benevoles, exterieurs } = intervenantsDistincts(lignes);
    const sujets = [...new Set(chrono.flatMap((e) => [e.sujet, e.sujet_2]).filter(rempli).map((s) => s.trim()))];
    return [
      dateFr(lundi), String(demis.size),
      [...activites].sort(([a], [b]) => enFrancais(a, b)).map(([a, k]) => `${a} : ${k}`).join(" ; ") || "aucune",
      [...new Set([...formateurs].map(nomDe))].sort(enFrancais).join(", ") || "aucun", String(exterieurs), String(benevoles.size),
      sujets.join(" ; ") || "aucun",
    ];
  });
}

// --- Comptes par stagiaire (ceux du tableau de bord, sur un seul stagiaire) ---

function parStagiaire(liste) {
  const parId = new Map();
  tableau(liste).forEach((ligne) => {
    if (!parId.has(ligne.stagiaire_id)) parId.set(ligne.stagiaire_id, []);
    parId.get(ligne.stagiaire_id).push(ligne);
  });
  return parId;
}

// Passages faits ou remplacés (Effectué, Bonus) en salle et en voiture, absences de dernière minute des deux.
function comptePassages(lignes) {
  const c = { salle: 0, voiture: 0, absences: 0 };
  lignes.forEach((p) => {
    const type = p.type === "Salle" ? "salle" : p.type === "Voiture" ? "voiture" : null;
    if (!type) return;
    if (p.resultat === "Effectué" || p.resultat === "Bonus") c[type]++;
    else if (p.resultat === "Absence") c.absences++;
  });
  return c;
}

const moyenne = (valeurs) => (valeurs.length ? somme(valeurs) / valeurs.length : null);

function texteNotes(lignes) {
  const notes = lignes.filter(estNotee).map(score20).filter(Number.isFinite);
  return notes.length ? `${nb(notes.length, "note")}, moyenne ${fr1(moyenne(notes))}/20` : "aucune";
}

function texteExamens(lignes) {
  const examens = lignes.filter((t) => t.mode === "examen");
  if (!examens.length) return "aucun";
  const notes = examens.map((t) => t.note_20).filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  return notes.length ? `${nb(examens.length, "examen")}, moyenne ${fr1(moyenne(notes))}/20` : nb(examens.length, "examen");
}

function entrainements(lignes) {
  const tentatives = lignes.filter((t) => t.mode === "entrainement");
  const questions = somme(tentatives.map((t) => Number(t.total) || 0));
  const bonnes = somme(tentatives.map((t) => Number(t.score) || 0));
  return { n: tentatives.length, questions, taux: questions ? bonnes / questions : null };
}

// La dernière évaluation EPCF d'une grille, hors auto-évaluation (règle du tableau de bord), et ses critères acquis.
function texteEpcf(lignes, trame) {
  let derniere = null;
  lignes.filter((e) => e.trame === trame && e.contexte === "EPCF" && !e.auto_eval).forEach((e) => {
    if (!derniere || e.date_eval > derniere.date_eval || (e.date_eval === derniere.date_eval && e.id > derniere.id)) derniere = e;
  });
  if (!derniere) return "aucune";
  const criteres = Object.values(derniere.scores || {}).filter((v) => v === "A" || v === "R" || v === "NA");
  const date = dateFr(jourDe(derniere.date_eval)) ?? "date non renseignée";
  return criteres.length ? `${date}, ${criteres.filter((v) => v === "A").length} acquis sur ${criteres.length}` : `${date}, aucun critère renseigné`;
}

// Livret ou dossier professionnel d'un stagiaire : « oui », avec la dernière mise à jour si elle est connue.
// Après l'étape des 3 ans (fiche sans nom), un document absent est un document effacé, jamais « aucun ».
function texteDepot(lignes, stagiaire = null) {
  if (!lignes.length) return stagiaire?.anonymise_le ? RAISON_EFFACEE : "aucun";
  const derniere = lignes.map((l) => jourDe(l.updated_at)).filter(Boolean).sort().pop();
  return derniere ? `oui, mis à jour le ${dateFr(derniere)}` : "oui";
}

// Nombre de jours entre deux jours « AAAA-MM-JJ » ; nul si l'un manque ou si l'ordre est inversé.
function joursEntre(debut, fin) {
  if (!debut || !fin) return null;
  const jours = (j) => Date.UTC(Number(j.slice(0, 4)), Number(j.slice(5, 7)) - 1, Number(j.slice(8, 10))) / 86400000;
  const ecart = Math.round(jours(fin) - jours(debut));
  return ecart >= 0 ? ecart : null;
}

// --- Résultats de la promo, avec leur méthode (textes du tableau de bord) ---

const RESULTATS = [
  ["effectif", "Effectif"], ["abandon", "Abandons"], ["absences", "Absences de dernière minute"], ["passages", "Passages"],
  ["reussiteQcm", "Réussite aux QCM d'entraînement"], ["examensQcm", "Examens QCM"], ["notes", "Notes"], ["epcf", "EPCF"],
];
const LIBELLE_TITRE = "Réussite au titre";   // les résultats de jury ne sont pas saisis : jamais de chiffre, mais sa méthode
const LIBELLE_SATISFACTION = "Satisfaction des stagiaires";   // questionnaire de fin de formation : ses chiffres viennent de l'inventaire
const LIGNES_METHODES = [...RESULTATS.map(([cle, libelle]) => [libelle, METHODES[cle]]), [LIBELLE_TITRE, METHODES.titre]];
const lignesResultats = (ind) => {
  const comparaison = ligneComparaison(ind);
  return [...RESULTATS.map(([cle, libelle]) => [libelle, comparaison[cle], METHODES[cle]]), [LIBELLE_TITRE, "non saisi", METHODES.titre]];
};

// --- Mise en forme commune aux deux dossiers ---

// Les sections servent des indicateurs : service(numero) donne les sections qui servent l'indicateur, la première étant
// celle que le sommaire indique.
function assembler({ titre, sousTitre, garde, defs, service, contenus, indicateurs }) {
  const numeros = indicateurs.map((i) => i.numero);
  return {
    titre, sousTitre, garde,
    sommaire: indicateurs.map(({ numero, court }) => ({ numero, court, section: service(numero)[0] ?? null })),
    sections: defs.map(([id, titreSection]) => ({
      id, titre: titreSection,
      indicateurs: numeros.filter((numero) => service(numero).includes(id)),
      paragraphes: contenus[id].paragraphes,
      tableaux: contenus[id].tableaux,
    })),
    aFournir: indicateurs.filter((i) => tableau(i.aFournir).length > 0)
      .map(({ numero, court, aFournir }) => ({ numero, court, items: aFournir.map(majuscule) })),
  };
}

// =====================================================================================================
// Dossier de la formation (§ 6.4)
// =====================================================================================================

const SECTIONS_FORMATION = [
  ["effectif", "Effectif, parcours et résultats"],
  ["deroule", "Déroulé réalisé"],
  ["assiduite", "Assiduité"],
  ["passages", "Passages"],
  ["evaluations", "Évaluations"],
  ["ressources", "Ressources, mises à jour et appropriation"],
  ["signalements", "Difficultés et signalements traités"],
  ["examen", "Présentation à l'examen"],
  ["appreciations", "Appréciations"],
];

// Indicateur -> sections de ce dossier qui le servent ; la première est celle du sommaire. Un indicateur absent d'ici
// est hors de l'app : il n'apparaît que dans les pièces à fournir.
const SERVICE_FORMATION = {
  2: ["effectif"], 3: ["effectif"], 5: ["evaluations"], 6: ["deroule"], 7: ["examen"], 9: ["deroule"],
  10: ["passages", "effectif", "assiduite", "signalements"], 11: ["evaluations"],
  12: ["effectif", "assiduite", "passages", "signalements"], 16: ["examen", "assiduite", "evaluations"],
  17: ["deroule"], 18: ["deroule"], 19: ["ressources"], 23: ["ressources"], 25: ["ressources"], 28: ["deroule"],
  30: ["appreciations"], 31: ["signalements", "ressources"], 32: ["signalements"],
};

// La population des tableaux par stagiaire, dite dans la section (rien s'il n'y a pas de tableau).
const population = (enFormation, stagiaires, demandes = new Set()) => {
  const sur = stagiaires.filter((s) => demandes.has(s.id)).length;
  const dont = sur ? ` (dont ${nb(sur, "fiche effacée", "fiches effacées")} à la demande de la personne)` : "";
  return enFormation.length ? [`Stagiaires en formation uniquement : ${enFormation.length} sur ${nb(stagiaires.length, "inscrit")}${dont}.`] : [];
};

function sectionEffectif({ inv, ind, stagiaires, terminee, demandes }) {
  const intro = stagiaires.length
    ? "Liste nominative des stagiaires, puis résultats de la promo avec leur méthode de calcul."
    : "Résultats de la promo avec leur méthode de calcul.";
  return {
    paragraphes: [...phrases(inv, "effectif"), ...(terminee ? [] : ["Promo en cours : les chiffres sont provisoires."]), intro],
    tableaux: [
      ...table(["Stagiaire", "Statut"], [...stagiaires].sort(compareByNom).map((s) => [nomComplet(s), statutFiche(s, terminee, demandes.has(s.id))])),
      ...table(["Indicateur", "Résultat", "Méthode de calcul"], lignesResultats(ind)),
    ],
  };
}

// Ce dossier est nominatif : les formateurs y sont nommés et les sujets des séances repris. Les autres textes saisis n'y
// entrent pas : le nom d'un intervenant « Autre » et le titre d'un événement du calendrier peuvent nommer une auto-école ou
// un bénévole, qui ne sont donnés qu'en nombres dans toutes les versions ; les dates clés se disent par leur type et leurs dates.
function sectionDeroule({ inv, donnees, promo, aujourdhui }) {
  const planning = lignesDuPlanning(donnees, promo, aujourdhui);
  const nomDe = nomFormateur(nomsDesFormateurs(donnees.profs));
  const evenements = tableau(donnees.agenda).filter((e) => TYPES_CLES.has(e.type) && jourDe(e.date_start))
    .sort((a, b) => (jourDe(a.date_start) < jourDe(b.date_start) ? -1 : jourDe(a.date_start) > jourDe(b.date_start) ? 1 : 0));
  const semaines = lignesSemaines(planning, nomDe);
  return {
    paragraphes: [...phrases(inv, "deroule", "datesCles", "intervenants"), ...(semaines.length ? [REGLE_DEMI_JOURNEES] : [])],
    tableaux: [
      ...table(["Type", "Du", "Au"], evenements.map((e) => [TYPES_CLES.get(e.type), dateFr(jourDe(e.date_start)), dateFr(jourDe(e.date_end)) ?? "non renseignée"])),
      ...table(["Semaine du", "Demi-journées", "Activités (demi-journées)", "Formateurs", "Intervenants extérieurs", "Bénévoles", "Sujets"], semaines),
    ],
  };
}

// Les heures d'après les feuilles d'émargement closes ; sans feuille, la raison puis une phrase utile à l'auditeur.
function sectionAssiduite({ inv }) {
  const piece = pieceDe(inv, "assiduite");
  if (!piece?.presente) return { paragraphes: [...(piece ? [phrase(piece)] : []), ASSIDUITE_A_JOINDRE], tableaux: [] };
  return { paragraphes: [phrase(piece), `Méthode de calcul : ${METHODES_PUBLIQUES.presence}`], tableaux: [] };
}

// Les heures d'une personne d'après les feuilles closes : « 66 heures 30 minutes sur 70 heures prévues » ; sans feuille à son nom,
// ou sans mesure pour la promo, le mot qui le dit. Jamais un zéro qui ne serait qu'une absence de feuille.
function heuresDe(presence, stagiaireId) {
  if (presence.etat === "non_lue") return HEURES_NON_LUES;
  if (presence.etat !== "mesuree") return HEURES_SANS_FEUILLES;
  const b = presence.bilans.get(stagiaireId);
  if (!b || !b.prevuesMin) return "non mesurées (aucune feuille close à son nom)";
  return `${dureeEnToutesLettres(b.realiseesMin)} sur ${dureeEnToutesLettres(b.prevuesMin)} prévues`;
}

// La phrase des heures du tableau de l'examen. Les lignes des fiches hors du tableau (stagiaires partis, fiches sans nom, fiches
// effacées à la demande) restent comptées dans les totaux de la promo, sans nom.
function phraseHeures(presence, enFormation) {
  if (presence.etat === "non_lue") return `Heures de formation : ${HEURES_NON_LUES}.`;
  if (presence.etat !== "mesuree") return `Heures de formation : ${HEURES_SANS_FEUILLES}.`;
  const dans = new Set(enFormation.map((s) => s.id));
  const hors = [...presence.bilans].filter(([id]) => !dans.has(id)).reduce((t, [, b]) => t + b.realiseesMin, 0);
  const horsPhrase = hors
    ? ` Les fiches hors du tableau (stagiaires partis, fiches sans nom, fiches effacées à la demande) ajoutent ${dureeEnToutesLettres(hors)} réalisées, comptées dans le total de la promo sans nom.`
    : "";
  return `Heures de formation : heures signées sur heures prévues, d'après les feuilles d'émargement closes (une demi-journée signée compte pour sa durée entière).${horsPhrase}`;
}

function sectionPassages({ inv, donnees, enFormation, stagiaires, demandes }) {
  const parId = parStagiaire(donnees.passages);
  const lignes = enFormation.map((s) => {
    const c = comptePassages(parId.get(s.id) || []);
    return [nomComplet(s), String(c.salle), String(c.voiture), String(c.absences)];
  });
  return {
    paragraphes: [...phrases(inv, "passages"), ...population(enFormation, stagiaires, demandes)],
    tableaux: table(["Stagiaire", "Passages en salle", "Passages en voiture", "Absences de dernière minute"], lignes),
  };
}

function sectionEvaluations({ inv, donnees, enFormation, stagiaires, demandes }) {
  const notes = parStagiaire(donnees.evaluations);
  const tentatives = parStagiaire(donnees.tentatives);
  const epcf = parStagiaire(donnees.epcf);
  const livrets = parStagiaire(donnees.livrets);
  const lignes = enFormation.map((s) => [
    nomComplet(s), texteNotes(notes.get(s.id) || []), texteExamens(tentatives.get(s.id) || []),
    texteEpcf(epcf.get(s.id) || [], "salle"), texteEpcf(epcf.get(s.id) || [], "vehicule"), texteDepot(livrets.get(s.id) || [], s), "non saisi",
  ]);
  return {
    paragraphes: [...phrases(inv, "evaluations"), ...population(enFormation, stagiaires, demandes)],
    tableaux: table(["Stagiaire", "Notes", "Examens QCM", "EPCF en salle", "EPCF véhicule", "Livret EPCF", "Jury"], lignes),
  };
}

function sectionRessources({ inv, donnees, enFormation, stagiaires, demandes }) {
  const tentatives = parStagiaire(donnees.tentatives);
  const lignes = enFormation.map((s) => {
    const e = entrainements(tentatives.get(s.id) || []);
    return [nomComplet(s), String(e.n), String(e.questions), e.taux === null ? "aucune donnée" : pourcent(e.taux)];
  });
  return {
    paragraphes: [...phrases(inv, "ressources", "misesAJour", "innovations"), ...population(enFormation, stagiaires, demandes)],
    tableaux: table(["Stagiaire", "QCM d'entraînement faits", "Questions répondues", "Réussite"], lignes),
  };
}

// Signalements de QCM déposés par les stagiaires de la promo (lecture : ceux dont l'auteur est de la promo) : reçus,
// traités (date de traitement lisible), en attente, et délai moyen entre dépôt et traitement.
function phrasesSignalements(signalements) {
  const recus = tableau(signalements);
  if (!recus.length) return ["Aucun signalement de QCM déposé par les stagiaires de la promo."];
  const traites = recus.filter((s) => jourDe(s.traite_at));
  const delais = traites.map((s) => joursEntre(jourDe(s.created_at), jourDe(s.traite_at))).filter((d) => d !== null);
  const phrasesDuDelai = [];
  if (!traites.length) phrasesDuDelai.push("Aucun signalement traité pour le moment.");
  else if (delais.length) {
    const delai = moyenne(delais);
    phrasesDuDelai.push(`Délai moyen entre le dépôt et le traitement : ${nombre(delai)} ${delai >= 2 ? "jours" : "jour"}.`);
  }
  return [
    `Signalements de QCM déposés par les stagiaires de la promo : ${nb(recus.length, "reçu")}, ${nb(traites.length, "traité")}, ${recus.length - traites.length} en attente.`,
    ...phrasesDuDelai,
  ];
}

// Le registre qualité (indicateurs 31 et 32), commun aux deux dossiers : décompte par type et par état, délai médian, puis (sauf en
// « nombres seulement ») une ligne par entrée. Jamais un texte saisi (description, réponse, action décidée, mesure de prévention) :
// des dates, le type, l'origine, l'état et le délai. Une entrée effacée compte et figure comme les autres, sans texte (il n'y en a plus).
// registre : { etat: "lue", entrees } | { etat: "absente" } | { etat: "non_lue" } ; entrees : celles de la formation ou du centre.
function sectionRegistre(registre, entrees, { periode, lignes = true }) {
  if (registre?.etat === "absente") return { paragraphes: ["Registre qualité : pas encore en service."], tableaux: [] };
  if (registre?.etat !== "lue") return { paragraphes: ["Registre qualité : non lu (erreur de lecture)."], tableaux: [] };
  if (!entrees.length) return { paragraphes: [`Aucune entrée au registre qualité pendant ${periode}.`], tableaux: [] };
  const { total, parType, parEtat } = decompteRegistre(entrees);
  const liste = (noms, comptes) => Object.entries(noms).filter(([cle]) => comptes[cle] > 0).map(([cle, libelle]) => `${libelle.toLowerCase()} ${comptes[cle]}`).join(", ");
  const mediane = delaiMedianJours(entrees);
  const delai = mediane == null ? "aucune réponse datée" : `${nombre(mediane)} ${mediane >= 2 ? "jours" : "jour"}`;
  const ligne = (e) => {
    const reponse = e.date_reponse ? joursEntre(jourDe(e.date_constat), jourDe(e.date_reponse)) : null;
    return [dateFr(jourDe(e.date_constat)) ?? "date non renseignée", TYPES[e.type] ?? "type non renseigné", ORIGINES[e.origine] ?? "origine non renseignée",
      ETATS[e.etat] ?? "état non renseigné", reponse == null ? "sans réponse datée" : String(reponse)];
  };
  const triees = [...entrees].sort((a, b) => String(a.date_constat).localeCompare(String(b.date_constat)) || (a.id ?? 0) - (b.id ?? 0));
  return {
    paragraphes: [
      `Registre qualité : ${nb(total, "entrée")} pendant ${periode}.`,
      `Par type : ${liste(TYPES, parType)}.`,
      `Par état : ${liste(ETATS, parEtat)}.`,
      `Délai médian de réponse : ${delai}.`,
      ...(lignes ? ["Une ligne par entrée : les textes saisis ne sont pas repris dans ce dossier."] : ["Version en nombres seulement : aucune ligne par entrée."]),
    ],
    tableaux: lignes ? table(["Date", "Type", "Origine", "État", "Délai de réponse (jours)"], triees.map(ligne)) : [],
  };
}

function sectionSignalements({ inv, donnees, promo, aujourdhui }) {
  const registre = donnees.registre ?? { etat: "non_lue" };
  const entrees = registre.etat === "lue" ? entreesPourPromo(registre.entrees, promo, aujourdhui) : [];
  const r = sectionRegistre(registre, entrees, { periode: "la formation" });
  return { paragraphes: [...phrases(inv, "suivi"), ...phrasesSignalements(donnees.signalements), ...r.paragraphes], tableaux: r.tableaux };
}

function sectionExamen({ inv, donnees, promo, enFormation, stagiaires, demandes }) {
  const dossiers = parStagiaire(donnees.dossiers);
  const livrets = parStagiaire(donnees.livrets);
  const presence = presenceDePromo(donnees.emargement, promo?.id);
  const lignes = enFormation.map((s) => [nomComplet(s), texteDepot(dossiers.get(s.id) || [], s), texteDepot(livrets.get(s.id) || [], s), heuresDe(presence, s.id)]);
  return {
    paragraphes: [
      ...phrases(inv, "dossierPro"),
      phraseHeures(presence, enFormation),
      ...population(enFormation, stagiaires, demandes),
    ],
    tableaux: table(["Stagiaire", "Dossier professionnel", "Livret EPCF", "Heures de formation"], lignes),
  };
}

// Les appréciations des stagiaires (indicateurs 30 et 32) : la phrase de la pièce, la méthode du calcul quand il a eu lieu, puis ce
// que le centre apporte lui-même. Jamais un commentaire : la pièce ne porte que des comptes. Sans la pièce (inventaire écrit à
// la main), l'ancienne phrase : l'enquête est hors de l'application.
function sectionAppreciations({ inv }) {
  const piece = pieceDe(inv, "appreciations");
  if (!piece) return { paragraphes: ["Enquête hors de l'application, à joindre."], tableaux: [] };
  return {
    paragraphes: [
      phrase(piece),
      ...(piece.presente ? [`Méthode de calcul : ${METHODES_PUBLIQUES.satisfaction}`] : []),
      "Les réponses sont anonymes et aucun commentaire n'est repris dans ce dossier. Les avis des financeurs et des entreprises sont hors de l'application : à joindre.",
    ],
    tableaux: [],
  };
}

// inv : inventairePromo(...) ; donnees : lireDonneesQualiopi(...) ; ind : indicateursPromo(...) ; promo : { id, nom,
// date_debut, date_fin } ; lieu : nom du centre ; intitule : intitulé de la formation (en-tête des feuilles d'émargement) ;
// aujourdhui : « AAAA-MM-JJ ».
export function modeleDossierFormation({ inv, donnees, ind, promo, lieu, intitule, aujourdhui }) {
  const d = donnees || {};
  const stagiaires = tableau(d.stagiaires);
  const contexte = { inv, ind, donnees: d, promo, stagiaires, demandes: demandesDe(d), enFormation: enFormationDe(d), terminee: promoTerminee(promo, aujourdhui), aujourdhui };
  const centre = texte(lieu, "centre non renseigné");
  return assembler({
    titre: "Dossier de la formation",
    sousTitre: centreEtPromo(centre, promo),
    garde: [
      `Centre : ${centre}`,
      `Promo : ${libellePromo(promo)}`,
      `Dates : ${periodeEnMots(promo?.date_debut, promo?.date_fin)}`,
      `Formation : ${texte(intitule, "non renseigné")}`,
      `État de la promo : ${contexte.terminee ? "terminée" : "en cours, chiffres provisoires"}`,
      REFERENTIEL,
      PHRASE_NIVEAU,
      edition(aujourdhui),
      PHRASE_DE_GARDE,
    ],
    defs: SECTIONS_FORMATION,
    service: (numero) => SERVICE_FORMATION[numero] || [],
    contenus: {
      effectif: sectionEffectif(contexte), deroule: sectionDeroule(contexte), assiduite: sectionAssiduite(contexte),
      passages: sectionPassages(contexte), evaluations: sectionEvaluations(contexte), ressources: sectionRessources(contexte),
      signalements: sectionSignalements(contexte), examen: sectionExamen(contexte),
      appreciations: sectionAppreciations(contexte),
    },
    indicateurs: tableau(inv?.indicateurs),
  });
}

// =====================================================================================================
// Dossier du centre (§ 6.5 et 6.8)
// =====================================================================================================

const SECTIONS_CENTRE = [
  ["resultats", "Résultats et méthodes par promo"],
  ["ressources", "Ressources et mises à jour"],
  ["innovations", "Innovations"],
  ["intervenants", "Intervenants et partenaires"],
  ["amelioration", "Amélioration continue"],
  ["inventaire", "Inventaire indicateur par indicateur"],
];

// Les sections qui portent un indicateur ; tous les indicateurs sont en outre dans l'inventaire.
const SERVICE_CENTRE = {
  2: ["resultats"], 3: ["resultats"], 17: ["intervenants"], 18: ["intervenants"], 19: ["ressources"], 23: ["ressources"],
  25: ["innovations"], 28: ["intervenants"], 31: ["amelioration"], 32: ["amelioration"],
};

function sectionResultatsCentre({ promos, aujourdhui }) {
  if (!promos.length) return { paragraphes: [AUCUNE_PROMO], tableaux: [] };
  const lignes = promos.map(({ promo, ind }) => ({ nom: libellePromo(promo), terminee: promoTerminee(promo, aujourdhui), promo, chiffres: ligneComparaison(ind) }));
  const terminees = lignes.filter((x) => x.terminee).length;
  return {
    paragraphes: [
      `Résultats donnés promo par promo, sans total : ${nb(promos.length, "promo")}, dont ${nb(terminees, "terminée")} et ${promos.length - terminees} en cours.`,
      "Une promo est terminée quand sa date de fin est renseignée et passée ; les chiffres d'une promo en cours sont provisoires.",
      `Satisfaction des stagiaires, méthode de calcul : ${METHODES_PUBLIQUES.satisfaction}`,
    ],
    tableaux: [
      ...table(["Promo", "Période", "État", "Inscrits", "Abandons", "Absences", "Passages"], lignes.map(({ nom, terminee, promo, chiffres: c }) => [
        nom, periodeEnMots(promo?.date_debut, promo?.date_fin), terminee ? "Terminée" : "En cours : chiffres provisoires",
        c.effectif, c.abandon, c.absences, c.passages,
      ])),
      ...table(["Promo", "QCM d'entraînement", "Examens QCM", "Notes", "EPCF"], lignes.map(({ nom, chiffres: c }) => [nom, c.reussiteQcm, c.examensQcm, c.notes, c.epcf])),
      // Le taux de chaque promo, jamais cumulé ; sous le seuil, la raison fixe de la pièce (aucun chiffre).
      ...table(["Promo", LIBELLE_SATISFACTION], promos.map(({ promo, inv }) => [libellePromo(promo), contenuPiece(pieceDe(inv, "appreciations"))])),
      ...table(["Indicateur", "Méthode de calcul"], LIGNES_METHODES),
    ],
  };
}

// Une ligne par promo, avec ce que dit la pièce de l'inventaire.
function ligneParPromo(promos, ...cles) {
  return promos.map(({ promo, inv }) => [libellePromo(promo), ...cles.map((cle) => contenuPiece(pieceDe(inv, cle)))]);
}

function sectionRessourcesCentre({ promos }) {
  if (!promos.length) return { paragraphes: [AUCUNE_PROMO], tableaux: [] };
  return {
    paragraphes: ["Ressources pédagogiques mises à disposition et mises à jour des cours, promo par promo."],
    tableaux: table(["Promo", "Ressources", "Mises à jour"], ligneParPromo(promos, "ressources", "misesAJour")),
  };
}

// Les annonces de l'application (rubrique Nouveautés) de la période : leur nombre et leur étendue, puis chacune citée telle
// qu'elle a été publiée, avec sa date et son titre entre guillemets français. Ce sont des textes de l'app, sans donnée
// personnelle, dans les deux versions ; jamais le résumé. Les titres s'adressent aux utilisateurs, souvent à la deuxième
// personne : la citation entre guillemets échappe à la règle des documents impersonnels (R9), qui vaut pour tout le reste.
function sectionInnovationsCentre({ nouveautes, periode }) {
  const [du, au] = [jourDe(periode?.du), jourDe(periode?.au)];
  const retenues = nouveautesCitables(nouveautes).map((x) => ({ jour: jourDe(x?.date), titre: texte(x?.titre, "sans titre") }))
    .filter((x) => x.jour !== null && (du === null || x.jour >= du) && (au === null || x.jour <= au))
    .sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : enFrancais(a.titre, b.titre)));
  if (!retenues.length) return { paragraphes: ["Aucune annonce de l'application dans la période."], tableaux: [] };
  const [premiere, derniere] = [retenues[0].jour, retenues[retenues.length - 1].jour];
  const etendue = premiere === derniere ? `le ${dateFr(premiere)}` : `du ${dateFr(premiere)} au ${dateFr(derniere)}`;
  return {
    paragraphes: [
      `${nb(retenues.length, "annonce")} de l'application ${etendue}.`,
      "Annonces de l'application, citées telles qu'elles ont été publiées :",
      ...retenues.map((x) => `${dateFr(x.jour)} : « ${x.titre} »`),
    ],
    tableaux: [],
  };
}

// Les formateurs nommés (version nominative) avec leur nombre de demi-journées de formation, toutes promos comprises.
function lignesFormateurs(promos, aujourdhui) {
  const nomDe = nomFormateur(nomsDesFormateurs(...promos.map(({ donnees }) => donnees?.profs)));
  const demis = new Map();
  promos.forEach(({ promo, donnees }) => {
    demiJournees(lignesDuPlanning(donnees || {}, promo, aujourdhui)).forEach((lignes, cle) => {
      intervenantsDistincts(lignes).formateurs.forEach((id) => {
        if (!demis.has(id)) demis.set(id, new Set());
        demis.get(id).add(`${promo?.id}|${cle}`);
      });
    });
  });
  return [...demis].map(([id, ensemble]) => [nomDe(id), String(ensemble.size)]).sort(([a], [b]) => enFrancais(a, b));
}

function sectionIntervenantsCentre({ promos, sansNoms, aujourdhui }) {
  if (!promos.length) return { paragraphes: [AUCUNE_PROMO], tableaux: [] };
  const formateurs = sansNoms ? [] : lignesFormateurs(promos, aujourdhui);
  const nommes = sansNoms ? "Cette version ne nomme personne."
    : formateurs.length ? "Les formateurs sont nommés, avec leur nombre de demi-journées de formation sur toute la durée des promos retenues."
      : "Aucun formateur n'est inscrit au planning de ces promos.";
  return {
    paragraphes: [
      "Formateurs, intervenants extérieurs, bénévoles et auto-écoles partenaires, promo par promo. Les bénévoles et les auto-écoles sont donnés en nombres seulement.",
      nommes,
    ],
    tableaux: [
      ...table(["Promo", "Intervenants et partenaires"], ligneParPromo(promos, "intervenants")),
      ...table(["Formateur", "Demi-journées de formation"], formateurs),
    ],
  };
}

const libelleTheme = (t) => (t.num != null ? `Thème ${t.num} : ${texte(t.titre, "sans titre")}` : texte(t.titre, "thème sans titre"));

// Suivi de chaque promo en nombres, puis ses thèmes les plus faibles (classements du tableau de bord).
function sectionAmeliorationCentre({ promos, registre, lieuId, periode, sansNoms }) {
  const entrees = registre.etat === "lue"
    ? entreesPourCentre(registre.entrees, { lieuId, promoIds: promos.map(({ promo }) => promo?.id), du: periode?.du, au: periode?.au })
    : [];
  const r = sectionRegistre(registre, entrees, { periode: "la période", lignes: !sansNoms });
  // Sans promo dans la période, le registre reste : les entrées du lieu et de l'organisme, datées dans la période, comptent encore.
  if (!promos.length) return { paragraphes: [AUCUNE_PROMO, ...r.paragraphes], tableaux: r.tableaux };
  const themes = promos.flatMap(({ promo, ind }) => [
    ...tableau(ind?.themes?.qcm).map((t) => [libellePromo(promo), "QCM", libelleTheme(t), `${pourcent(t.taux)} sur ${nb(t.n, "réponse")}`]),
    ...tableau(ind?.themes?.notes).map((t) => [libellePromo(promo), "Notes", libelleTheme(t), `${fr1(t.moyenne)}/20 sur ${nb(t.n, "note")}`]),
  ]);
  return {
    paragraphes: [
      "La comparaison des promos figure à la section « Résultats et méthodes par promo ».",
      themes.length
        ? "Thèmes les plus faibles de chaque promo, du plus faible au plus fort, d'après les QCM puis d'après les notes."
        : "Aucun thème n'a encore assez de réponses ou de notes pour être classé.",
      ...r.paragraphes,
    ],
    tableaux: [...table(["Promo", "Suivi"], ligneParPromo(promos, "suivi")), ...table(["Promo", "Source", "Thème", "Résultat"], themes), ...r.tableaux],
  };
}

// Inventaire fusionné des promos (R8) : par indicateur applicable, le niveau, les pièces à fournir (fixes) et, pour chaque
// pièce de l'app, le nombre de promos où elle est présente ou absente, les raisons d'absence regroupées par texte.
function fusionInventaires(promos) {
  const parNumero = new Map();
  promos.forEach(({ inv }) => tableau(inv?.indicateurs).forEach((i) => {
    if (!parNumero.has(i.numero)) parNumero.set(i.numero, { indicateur: i, pieces: new Map() });
    const { pieces } = parNumero.get(i.numero);
    tableau(i.pieces).forEach((p) => {
      if (!pieces.has(p.cle)) pieces.set(p.cle, { libelle: p.libelle, vues: 0, presentes: 0, raisons: new Map() });
      const etat = pieces.get(p.cle);
      etat.vues++;
      if (p.presente) etat.presentes++;
      else {
        const raison = texte(p.raison, "raison non précisée");
        etat.raisons.set(raison, (etat.raisons.get(raison) || 0) + 1);
      }
    });
  }));
  return [...parNumero.values()].sort((a, b) => a.indicateur.numero - b.indicateur.numero);
}

function presenceEnMots({ vues, presentes, raisons }) {
  const parties = [];
  if (presentes) parties.push(`présente pour ${nb(presentes, "promo")} sur ${vues}`);
  if (vues > presentes) {
    const motifs = [...raisons].map(([raison, k]) => (raisons.size > 1 ? `${raison} (${nb(k, "promo")})` : raison)).join(" ; ");
    parties.push(`absente pour ${nb(vues - presentes, "promo")} sur ${vues} : ${motifs}`);
  }
  return parties.join(" ; ");
}

function sectionInventaireCentre({ fusion }) {
  if (!fusion.length) return { paragraphes: ["Aucune promo dans la période : inventaire non établi."], tableaux: [] };
  return {
    paragraphes: [PHRASE_NIVEAU, "Pour chaque indicateur applicable : son apport de l'application et les pièces à fournir par le centre, puis les pièces de l'application avec le nombre de promos pour lesquelles chacune est présente."],
    tableaux: [
      ...table(["Indicateur", COLONNE_NIVEAU, "Pièces à fournir par le centre"], fusion.map(({ indicateur: i }) => [
        `${i.numero}. ${i.court}`, LIBELLES_NIVEAU[i.niveau] ?? texte(i.niveau, "non renseigné"), tableau(i.aFournir).map(majuscule).join(", ") || "aucune",
      ])),
      ...table(["Indicateur", "Pièce de l'application", "Présence dans les promos"],
        fusion.flatMap(({ indicateur: i, pieces }) => [...pieces.values()].map((etat) => [String(i.numero), etat.libelle, presenceEnMots(etat)]))),
    ],
  };
}

// promos : [{ promo, inv, ind, donnees }] ; periode : { du, au } (« AAAA-MM-JJ ») ; nouveautes : entrées de NOUVEAUTES ;
// sansNoms : aucun nom de formateur (stagiaires, bénévoles et auto-écoles ne sont jamais nommés).
// lieuId : identifiant du centre (`lieu` en est le nom affiché), pour les entrées du registre du lieu ou de tout l'organisme ;
// registre : { etat: "lue", entrees } | { etat: "absente" } | { etat: "non_lue" } (celui de la page, jamais celui des promos).
export function modeleDossierCentre({ promos, lieu, lieuId, periode, aujourdhui, sansNoms, nouveautes = [], registre = { etat: "non_lue" } }) {
  const liste = tableau(promos);
  const fusion = fusionInventaires(liste);
  const contexte = { promos: liste, fusion, aujourdhui, nouveautes, periode, sansNoms: Boolean(sansNoms), registre, lieuId };
  const centre = texte(lieu, "centre non renseigné");
  const enMots = periodeEnMots(periode?.du, periode?.au);
  return assembler({
    titre: "Dossier du centre",
    sousTitre: `${centre}, ${enMots}`,
    garde: [
      `Centre : ${centre}`,
      `Période : ${enMots}`,
      `Promos retenues : ${liste.length ? `${nb(liste.length, "promo")} (${liste.map(({ promo }) => libellePromo(promo)).join(", ")})` : "aucune"}`,
      `Version : ${contexte.sansNoms ? "sans aucun nom (nombres, taux, dates et inventaire)" : "avec les noms des formateurs (stagiaires, bénévoles et auto-écoles en nombres seulement)"}`,
      REFERENTIEL,
      edition(aujourdhui),
      PHRASE_DE_GARDE,
    ],
    defs: SECTIONS_CENTRE,
    service: (numero) => [...(SERVICE_CENTRE[numero] || []), "inventaire"],
    contenus: {
      resultats: sectionResultatsCentre(contexte), ressources: sectionRessourcesCentre(contexte),
      innovations: sectionInnovationsCentre(contexte), intervenants: sectionIntervenantsCentre(contexte),
      amelioration: sectionAmeliorationCentre(contexte), inventaire: sectionInventaireCentre(contexte),
    },
    indicateurs: fusion.map(({ indicateur }) => indicateur),
  });
}

// =====================================================================================================
// Export CSV de l'inventaire d'une promo
// =====================================================================================================

const ENTETE_CSV = ["Numéro", "Critère", "Libellé court", COLONNE_NIVEAU, "Pièces présentes", "Pièces absentes (raison)", "Pièces à fournir"];

// Une ligne par indicateur applicable. Format pour Excel en français, comme la matrice des notes : point-virgule, UTF-8
// avec BOM, fins de ligne CRLF. Plusieurs pièces dans une cellule sont séparées par « | » (leurs phrases portent des
// points-virgules), les pièces à fournir par une virgule ; une cellule sans rien dit « aucune ».
const piecesEnMots = (pieces) => pieces.map((p) => `${p.libelle} : ${contenuPiece(p)}`).join(" | ") || "aucune";

export function inventaireCsv(inv) {
  const lignes = tableau(inv?.indicateurs).map((i) => {
    const pieces = tableau(i.pieces);
    return [
      i.numero, i.critere, i.court, LIBELLES_NIVEAU[i.niveau] ?? i.niveau,
      piecesEnMots(pieces.filter((p) => p.presente)),
      piecesEnMots(pieces.filter((p) => !p.presente)),
      tableau(i.aFournir).map(majuscule).join(", ") || "aucune",
    ];
  });
  return BOM + [ENTETE_CSV, ...lignes].map((ligne) => ligne.map(cellule).join(";")).join("\r\n") + "\r\n";
}

// Nom de fichier, par exemple « qualiopi-formation-montpellier-2026-10-28.csv » : nature du document, promo (ou centre) et
// date d'édition.
export function nomFichierQualiopi(nature, nomPromo, dateIso) {
  return `qualiopi-${slug(nature) || "dossier"}-${slug(nomPromo) || "promo"}-${jourDe(dateIso) ?? "sans-date"}.csv`;
}
