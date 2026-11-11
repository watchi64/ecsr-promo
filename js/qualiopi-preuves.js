// Inventaire des preuves d'une promo, indicateur par indicateur (spec docs/superpowers/specs/
// 2026-10-28-dossier-qualiopi-design.md, § 6.2 et annexe A). PUR : ni DOM ni réseau, testé en node
// (tests/qualiopi-preuves.test.mjs).
//
// Pour chaque indicateur applicable à un centre de formation continue : son niveau (prouvé, en partie, hors de
// l'app), ce que l'app en apporte, les pièces de l'app qui le servent (chacune présente, avec ses chiffres et
// ses dates, ou absente avec sa raison) et les pièces que le centre fournit lui-même.
//
// Les phrases ne portent que des nombres et des dates : ni nom, ni sujet de séance, ni titre d'événement n'y est
// recopié. L'inventaire entre donc tel quel dans la version « sans aucun nom » des dossiers (spec § 6.8).
//
// Population : les chiffres qui portent sur des stagiaires sont ceux du tableau de bord du centre, repris tels quels
// (indicateursPromo, js/centre-stats.js) : seuls l'effectif et les abandons comptent tous les inscrits, le reste ne
// compte que les stagiaires en formation (la phrase des évaluations le dit). Les lignes du planning portent leur promo
// et sont filtrées ici ; les autres tables arrivent déjà limitées à la promo (lireDonneesQualiopi).
//
// Raisons d'absence : des textes fixes, sans période ni nombre, pour que les dossiers les regroupent par texte d'une
// promo à l'autre.
//
// Forme de `donnees` (sortie de lireDonneesQualiopi). Une clé absente vaut [] ; seuls les champs cités sont lus.
//   stagiaires    [{ id, actif, anonymise_le }] : `anonymise_le` (étape des 3 ans faite) porte la raison « effacé au terme de la durée de
//                 conservation » des pièces dont les documents sont effacés
//   demandes      Set des identifiants de fiches effacées à la demande (lireEffacementsSurDemande) ; absent, ensemble vide : ces fiches
//                 sont des inscrits, ni en formation ni en abandon, et leurs documents effacés ne sont pas des pièces manquantes
//   passages, tentatives, evaluations, epcf   lus par indicateursPromo ; ici, en plus, les dates de evaluations
//                 [{ stagiaire_id, note, note_max, date_eval }] et le compte de epcf [{ stagiaire_id, contexte, auto_eval }]
//   planning      [{ semaine_lundi, day_index, half_day, activite, sujet, sujet_2, salle_double, prof_ids, prof_autre, autonomie,
//                 benevoles_ids, promo_id }]
//   joursOff      [{ semaine_lundi, day_index }] : les jours désactivés du planning (vacances, pont, formation externe) ;
//                 leurs lignes de planning gardent leurs cartes en base mais ne comptent nulle part ici
//   agenda        [{ type, date_start, date_end }]
//   livrets, dossiers   [{ stagiaire_id, updated_at }]
//   cours         [{ id, published, updated_at }] : `updated_at` est la sauvegarde en vigueur, qu'aucune version ne porte
//   versions      [{ cours_id, saved_at }] : les états archivés des cours ; `saved_at` est la date de l'état archivé, pas
//                 celle de la modification qui l'a remplacé. Les dates de sauvegarde d'un cours publié sont les
//                 horodatages distincts de ses `saved_at` et de son `updated_at` ; le plus ancien est sa création ou son
//                 import, les autres sont ses modifications.
//   signalements  [{ traite_at }]
//   autoEcoles    [{ actif, lieu_id }]
//   registre      { etat: "lue", entrees } | { etat: "absente" } | { etat: "non_lue" } : le registre qualité de tout l'organisme, injecté par la
//                 page (hors des lectures par promo) ; une clé absente vaut « non_lue ». Seuls des comptes et des dates entrent ici, jamais un texte
//                 saisi (description, réponse, action décidée, mesure de prévention).
//   satisfaction  { etat: "mesuree", taux, repondants, inscrits } | { etat: "sous_seuil" } | { etat: "absente" } | { etat: "non_lue" } : le résultat du
//                 questionnaire de fin de formation, tel que le rend `satisfactionDe` (lu par la page, hors de l'inventaire) ;
//                 une clé absente vaut « non_lue ». Jamais un commentaire : seuls des comptes entrent ici.
//   emargement    { etat: "lue", seances } | { etat: "non_lue" } : les feuilles d'émargement de la promo, légères (js/qualiopi-presence.js) ;
//                 une clé absente vaut « non_lue »
// Ne sont pas lus : `profs` et `entete` (les noms).
//
// Exports : les aides du planning (`lignesDuPlanning`, `demiJournees`, `intervenantsDistincts`) et les petits outils de
// phrases (`jourDe`, `rempli`, `tableau`, et `pluriel` de js/nombres.js) sont réutilisés par js/qualiopi-documents.js, pour que la synthèse par
// semaine des dossiers suive toujours la règle de l'inventaire au lieu d'en recopier une version.

import { INDICATEURS, indicateursApplicables } from "./qualiopi-referentiel.js?v=20261111k";
import { indicateursPromo } from "./centre-stats.js?v=20261111k";
import { pct, pluriel } from "./nombres.js?v=20261111k";
import { estNotee } from "./notes-stats.js?v=20261111k";
import { ACTIVITY_SHAPES } from "./config.js?v=20261111k";
import { jourFerie } from "./emargement-rules.js?v=20261111k";
import { dureeEnToutesLettres } from "./attestations-rules.js?v=20261111k";
import { presenceDePromo, raisonAbsence } from "./qualiopi-presence.js?v=20261111k";
import { parseDate, addDays, isoDate } from "./utils.js?v=20261111k";
import { QUESTIONNAIRES } from "./questionnaires-data.js?v=20261111k";
import { tauxSatisfaction, texteSousSeuilAvis } from "./questionnaires-rules.js?v=20261111k";
import { TYPES, entreesPourPromo, decompteRegistre, delaiMedianJours } from "./registre-rules.js?v=20261111k";

// Annexe A de la spec, cellule par cellule, pour les 28 indicateurs d'un centre de formation continue (les 27 plus
// le 13 de l'alternance). niveau : « prouve » (l'app fournit l'essentiel), « partiel » (en partie) ou « hors »
// (hors de l'app). apporte : ce que l'app apporte. ajout : le lot qui l'enrichira (§ 6.7), nul s'il n'y en a pas.
// aFournir : les pièces que le centre fournit lui-même (cellule découpée sur « , »), vide s'il n'y en a pas.
// Les mots de la colonne « apporte » ont suivi ceux de l'app le 10/11 (indicateurs 7, 10, 11, 12, 31 et 32 : livret EPCF,
// ordre de passage, difficultés, contestations de QCM, thèmes les moins réussis) ; le sens de l'annexe A est inchangé.
export const NIVEAUX = {
  1: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["site", "catalogue", "fiche formation"] },
  2: { niveau: "partiel", apporte: "indicateurs du tableau de bord, chacun avec sa méthode", ajout: "fiche résultats (Q2)", aFournir: ["publication sur le site"] },
  3: { niveau: "partiel", apporte: "résultats de jury (saisie en cours)", ajout: "fiche résultats (Q2)", aFournir: ["passerelles", "débouchés"] },
  4: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["entretien", "dossier d'entrée"] },
  5: { niveau: "partiel", apporte: "thèmes, compétences C1 à C4, CCP, tous évalués", ajout: null, aFournir: ["programme de formation"] },
  6: { niveau: "partiel", apporte: "cours, déroulé réalisé du planning", ajout: null, aFournir: ["programme", "progression"] },
  7: { niveau: "partiel", apporte: "grilles EPCF et livret EPCF au modèle officiel", ajout: null, aFournir: ["agrément du centre"] },
  8: { niveau: "hors", apporte: "rien", ajout: "positionnement (plus tard)", aFournir: ["tests ou entretiens d'entrée"] },
  9: { niveau: "partiel", apporte: "planning, dates clés, contacts", ajout: "livret d'accueil lu (plus tard)", aFournir: ["livret d'accueil", "règlement intérieur"] },
  10: { niveau: "prouve", apporte: "ordre de passage, « à suivre de près », passages, Mon suivi", ajout: null, aFournir: [] },
  11: { niveau: "prouve", apporte: "notes, examens QCM, EPCF, livret EPCF", ajout: null, aFournir: [] },
  12: { niveau: "partiel", apporte: "assiduité, difficultés, abandons (sans date)", ajout: "date et motif d'abandon (plus tard)", aFournir: ["procédure et référent violences"] },
  13: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["coordination avec l'entreprise"] },
  16: { niveau: "prouve", apporte: "dossier professionnel et livret EPCF au modèle officiel, heures", ajout: null, aFournir: ["inscription à la session"] },
  17: { niveau: "partiel", apporte: "formateurs par séance, ressources en ligne", ajout: null, aFournir: ["locaux", "véhicules", "matériel"] },
  18: { niveau: "partiel", apporte: "planning multi-formateurs, bénévoles, auto-écoles", ajout: null, aFournir: ["organigramme", "réunions"] },
  19: { niveau: "prouve", apporte: "cours publiés, QCM, activité par stagiaire", ajout: null, aFournir: ["référent pédagogique si le seuil l'exige"] },
  21: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["CV", "titres", "autorisations d'enseigner"] },
  22: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["plan de développement des compétences"] },
  23: { niveau: "partiel", apporte: "cours mis à jour et datés après les réformes", ajout: "journal de veille (conversation 04)", aFournir: ["sources de veille"] },
  24: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["sources de veille"] },
  25: { niveau: "partiel", apporte: "Nouveautés datées", ajout: null, aFournir: ["sources de veille"] },
  26: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["référent handicap", "réseau"] },
  27: { niveau: "hors", apporte: "rien", ajout: null, aFournir: ["contrats"] },
  28: { niveau: "partiel", apporte: "auto-écoles partenaires, dates de stage", ajout: "lieu de stage (plus tard)", aFournir: ["conventions de stage"] },
  30: { niveau: "partiel", apporte: "enquête hors de l'app", ajout: "questionnaires (Q3)", aFournir: ["avis des financeurs et entreprises"] },
  31: { niveau: "partiel", apporte: "contestations de QCM analysées puis tranchées, registre qualité", ajout: null, aFournir: ["procédure de réclamation"] },
  32: { niveau: "partiel", apporte: "comparaison des promos, thèmes les moins réussis, registre qualité", ajout: null, aFournir: ["plan d'amélioration"] },
};

// Les 15 pièces de l'app et les indicateurs qu'elles servent (tableau du § 6.2). L'ordre de la liste est celui
// où un indicateur rend ses pièces.
export const PIECES = [
  { cle: "effectif", libelle: "Effectif, abandons", indicateurs: [10, 12] },              // fiches des stagiaires
  { cle: "deroule", libelle: "Déroulé réalisé", indicateurs: [6, 9, 17, 18] },            // planning
  { cle: "datesCles", libelle: "Dates clés", indicateurs: [9, 28] },                      // calendrier
  { cle: "assiduite", libelle: "Assiduité", indicateurs: [10, 12, 16] },                  // feuilles d'émargement, heures
  { cle: "passages", libelle: "Passages", indicateurs: [10, 12] },                        // passages en salle et en voiture
  { cle: "evaluations", libelle: "Évaluations", indicateurs: [11, 16] },                  // notes, QCM, EPCF, livrets, jury
  { cle: "dossierPro", libelle: "Dossier professionnel", indicateurs: [16] },             // un dossier par stagiaire
  { cle: "ressources", libelle: "Ressources", indicateurs: [19] },                        // cours publiés, QCM, activité
  { cle: "misesAJour", libelle: "Mises à jour", indicateurs: [19, 23, 31] },              // modifications des cours, contestations de QCM traitées
  { cle: "innovations", libelle: "Innovations", indicateurs: [25] },                      // Nouveautés datées
  { cle: "intervenants", libelle: "Intervenants et partenaires", indicateurs: [17, 18, 28] },
  { cle: "resultats", libelle: "Résultats et méthodes", indicateurs: [2, 3, 32] },        // tableau de bord du centre
  { cle: "suivi", libelle: "Suivi", indicateurs: [10, 12, 32] },                          // à suivre de près, thèmes
  { cle: "appreciations", libelle: "Appréciations", indicateurs: [30, 32] },              // questionnaire de fin de formation (Q3)
  { cle: "registre", libelle: "Registre qualité", indicateurs: [31, 32] },                // réclamations, difficultés, aléas, améliorations, risques (Q4)
];

// Raison fixe d'une pièce dont les documents ont été effacés par l'étape des 3 ans : jamais « aucun dossier enregistré ».
export const RAISON_EFFACEE = "effacé au terme de la durée de conservation";
const RAISON_SUR_DEMANDE = "effacé à la demande des personnes";
const SANS_JURY = "aucun résultat de jury saisi";
const POPULATION = "(stagiaires en formation uniquement)";   // dit une fois dans la phrase des évaluations
const TYPES_CLES = ["formation", "stage", "examen"];   // types d'événement du calendrier qui sont des dates clés
// Seuils de données du classement des thèmes, ceux de js/centre-stats.js (MIN_REPONSES_THEME et MIN_NOTES_THEME, qui n'y
// sont pas exportés) : le test vérifie qu'ils restent d'accord avec le tableau de bord.
const MIN_REPONSES_THEME = 20;
const MIN_NOTES_THEME = 3;

// --- Petits outils : dates et phrases ---

const ISO_JOUR = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/;
// « AAAA-MM-JJ » d'une date ou d'un horodatage (« 2026-10-12T09:00:00+00:00 »), nul si la valeur n'en est pas une.
export const jourDe = (valeur) => (typeof valeur === "string" && ISO_JOUR.test(valeur) ? valeur.slice(0, 10) : null);
const jourMois = (jour) => `${jour.slice(8)}/${jour.slice(5, 7)}`;
export const rempli = (texte) => typeof texte === "string" && texte.trim() !== "";
export const tableau = (valeur) => (Array.isArray(valeur) ? valeur : []);
// Les fiches effacées à la demande de la personne, en ensemble d'identifiants (une clé absente vaut l'ensemble vide).
export const demandesDe = (donnees) => (donnees?.demandes instanceof Set ? donnees.demandes : new Set(tableau(donnees?.demandes)));

// « du 05/10 au 15/10 », ou « le 05/10 » quand tout tient en un jour ; chaîne vide s'il n'y a aucune date.
function plage(jours) {
  const l = jours.filter(Boolean).sort();
  if (!l.length) return "";
  const [debut, fin] = [l[0], l[l.length - 1]];
  return debut === fin ? `le ${jourMois(debut)}` : `du ${jourMois(debut)} au ${jourMois(fin)}`;
}
const avecPlage = (texte, jours) => [texte, plage(jours)].filter(Boolean).join(" ");

// Une promo est terminée quand sa date de fin est renseignée et strictement antérieure à aujourd'hui (« AAAA-MM-JJ ») ;
// sinon elle est en cours et ses chiffres sont provisoires (spec § 6.8). Écrite ici une seule fois.
export function promoTerminee(promo, aujourdhui) {
  const fin = jourDe(promo?.date_fin);
  const jour = jourDe(aujourdhui);
  return fin !== null && jour !== null && fin < jour;
}

// --- Planning : les lignes de la promo, les demi-journées de formation, les intervenants ---

const porteQuelqueChose = (e) => rempli(e.activite) || rempli(e.sujet) || rempli(e.sujet_2)
  || tableau(e.prof_ids).length > 0 || rempli(e.prof_autre) || Boolean(e.autonomie);

// Clé d'un jour du planning, « lundi|indice » : celle d'une ligne de planning ou d'un jour désactivé ; nulle si l'un des
// deux manque ou est faux (un jour désactivé incomplet n'écarte donc rien).
function cleJour(semaineLundi, indice) {
  const lundi = jourDe(semaineLundi);
  return lundi && Number.isInteger(indice) ? `${lundi}|${indice}` : null;
}

// Le jour d'une ligne : le lundi de sa semaine plus l'indice du jour ; nul si l'un des deux manque ou est faux.
function jourDeLigne(e) {
  const lundi = jourDe(e.semaine_lundi);
  if (!lundi || !Number.isInteger(e.day_index)) return null;
  const jour = addDays(parseDate(lundi), e.day_index);
  return Number.isNaN(jour.getTime()) ? null : isoDate(jour);
}

// La ligne telle que le planning l'affiche (js/views/planning.js, effSujets et effBenevolesIds) : la base garde le sujet, le
// second sujet et les bénévoles d'une carte dont l'activité a changé, mais le planning les ignore dès que la forme de l'activité
// ne les porte plus (le sujet d'une activité « Autre », les bénévoles hors d'une conduite) ; le second sujet n'existe que dans
// une salle double. Une copie : la ligne reçue n'est pas modifiée.
function ligneEffective(e) {
  const forme = ACTIVITY_SHAPES[e.activite || ""] || ACTIVITY_SHAPES[""];
  const sujet = forme.includes("sujet");
  return {
    ...e,
    sujet: sujet ? e.sujet : "",
    sujet_2: sujet && e.activite === "Pédagogie salle" && e.salle_double ? e.sujet_2 : "",
    benevoles_ids: forme.includes("benevoles") ? e.benevoles_ids : [],
  };
}

// Les lignes du planning d'une promo : celles de la promo, comprises entre son début et la plus proche de sa fin et
// d'aujourd'hui (bornes comprises : le réalisé n'est pas l'avenir), moins celles d'un jour férié ou d'un jour désactivé
// (vacances, pont, formation externe : leurs cartes restent en base mais ne comptent nulle part). Une borne absente ne
// filtre pas de son côté ; une ligne dont le jour est illisible n'est pas située et reste. Tout ce qui vient
// du planning passe par là. aujourdhui : « AAAA-MM-JJ ».
export function lignesDuPlanning(donnees, promo, aujourdhui) {
  const joursOff = new Set(tableau(donnees.joursOff).map((j) => cleJour(j.semaine_lundi, j.day_index)).filter(Boolean));
  const debut = jourDe(promo?.date_debut);
  const bornes = [jourDe(promo?.date_fin), jourDe(aujourdhui)].filter(Boolean).sort();
  const fin = bornes.length ? bornes[0] : null;
  return tableau(donnees.planning).map(ligneEffective).filter((e) => {
    if (e.promo_id !== promo?.id || joursOff.has(cleJour(e.semaine_lundi, e.day_index))) return false;
    const jour = jourDeLigne(e);
    if (jour === null) return true;   // jour illisible : aucune borne ne peut le situer, `demiJournees` l'écarte déjà des demi-journées
    return !jourFerie(jour) && (debut === null || jour >= debut) && (fin === null || jour <= fin);
  });
}

// Une demi-journée de formation est un triplet distinct (semaine, jour, demi-journée) dont une ligne au moins porte
// quelque chose : une demi-journée a plusieurs lignes (créneaux) et la base garde des lignes vides, qui ne comptent
// pas. Rend, pour chaque demi-journée (clé « semaine|jour|demi-journée »), ses lignes qui portent quelque chose ; une
// ligne dont le jour est illisible n'en fait pas partie.
export function demiJournees(lignes) {
  const parCle = new Map();
  lignes.filter(porteQuelqueChose).forEach((e) => {
    if (!jourDeLigne(e)) return;
    const cle = `${e.semaine_lundi}|${e.day_index}|${e.half_day}`;
    if (!parCle.has(cle)) parCle.set(cle, []);
    parCle.get(cle).push(e);
  });
  return parCle;
}

// Les intervenants distincts d'un ensemble de lignes du planning : les identifiants des formateurs et des bénévoles (les
// nuls écartés) et le nombre d'intervenants « Autre », dont le nom est compté (en minuscules, sans espaces autour) et
// jamais recopié.
export function intervenantsDistincts(lignes) {
  return {
    formateurs: new Set(lignes.flatMap((e) => tableau(e.prof_ids)).filter((id) => id != null)),
    benevoles: new Set(lignes.flatMap((e) => tableau(e.benevoles_ids)).filter((id) => id != null)),
    exterieurs: new Set(lignes.map((e) => e.prof_autre).filter(rempli).map((nom) => nom.trim().toLowerCase())).size,
  };
}

// --- Annonces : celles qu'on peut citer ---

// Les annonces de la rubrique Nouveautés qu'un dossier peut compter et citer. Depuis le 10/11, toutes les promos ont la
// nouvelle barre : ses annonces se lisent dans l'app. Celles qui ne décrivent que l'ancienne barre (`navigation: "ancienne"`)
// n'y sont plus visibles, un auditeur ne les y trouverait pas. Le filtre est écrit ici une seule fois, pour l'inventaire et le
// dossier du centre.
export const nouveautesCitables = (nouveautes) => tableau(nouveautes).filter((x) => x?.navigation !== "ancienne");

// --- Satisfaction : le questionnaire de fin de formation ---

const GLOBALE_FIN_STAGIAIRE = QUESTIONNAIRES.fin_stagiaire.questions.find((q) => q.globale).id;

// Le résultat du questionnaire « fin de formation » d'une promo, prêt pour les dossiers. `resultats` est ce que rend la base
// (lireResultatsQuestionnaire : comptes par question, rien sous le seuil), `inscrits` le nombre de fiches de la promo.
//   { etat: "mesuree", taux, repondants, inscrits } : taux entier en pourcent, « sans avis » exclu, au moins 5 avis notés
//   (`repondants` compte les avis notés, pas les réponses) ;
//   { etat: "sous_seuil" } : moins de 5 avis notés, aucun chiffre ;
//   { etat: "absente" } : la fonction de la base n'existe pas (migration pas appliquée), seuil nul ; la pièce le dit calmement ;
//   { etat: "non_lue" } : la lecture a échoué (réseau, droit) ou n'a pas eu lieu (`{ echec: true }`, rien) : le questionnaire peut
//   être en service avec des réponses, la pièce dit seulement qu'il n'a pas été lu. Jamais confondue avec « absente ».
export function satisfactionDe(resultats, inscrits) {
  if (!resultats || resultats.echec === true) return { etat: "non_lue" };
  if (resultats.seuil === null || resultats.seuil === undefined) return { etat: "absente" };
  const mesure = tauxSatisfaction(resultats.questions?.[GLOBALE_FIN_STAGIAIRE], inscrits, "stagiaire");
  return mesure ? { etat: "mesuree", ...mesure } : { etat: "sous_seuil" };
}

// « moins de 5 avis notés au questionnaire de fin de formation » : la raison fixe d'une pièce sous le seuil.
const RAISON_SOUS_SEUIL = `${texteSousSeuilAvis("stagiaire")} au questionnaire de fin de formation`;
const RAISON_SANS_QUESTIONNAIRE = "questionnaire de fin de formation pas encore en service";
export const RAISON_NON_LUE = "questionnaire de fin de formation non lu (erreur de lecture)";
const RAISON_REGISTRE_VIDE = "aucune entrée au registre qualité pendant la formation";
const RAISON_REGISTRE_ABSENT = "registre qualité pas encore en service";
export const RAISON_REGISTRE_NON_LU = "registre qualité non lu (erreur de lecture)";

// --- Cours : leurs modifications ---

// Les dates de sauvegarde d'un cours sont les horodatages distincts de ses versions et de son `updated_at`. Une version
// archive l'état que la sauvegarde suivante remplace : son `saved_at` est la date de cet état, pas celle de la
// modification qui l'a remplacé, et la sauvegarde en vigueur (`updated_at`) n'est dans aucune version. Le plus ancien
// de ces horodatages est la création ou l'import du cours, les autres sont ses modifications. Rend, pour chaque cours
// publié, ses horodatages de modification (de même forme, donc rangés par ordre de chaîne comme par ordre d'instant).
function modificationsDesCours(cours, versions) {
  const sauvegardes = new Map(cours.filter((c) => c.published).map((c) => [c.id, new Set()]));
  const noter = (id, horodatage) => { if (jourDe(horodatage)) sauvegardes.get(id)?.add(horodatage); };
  cours.forEach((c) => noter(c.id, c.updated_at));
  versions.forEach((v) => noter(v.cours_id, v.saved_at));
  return [...sauvegardes.values()].map((horodatages) => [...horodatages].sort().slice(1));
}

// --- Les pièces : chacune rend { presente, detail, raison } ---

const presente = (detail) => ({ presente: true, detail, raison: null });
const absente = (raison) => ({ presente: false, detail: null, raison });

// Ce que chaque pièce calcule à partir du contexte (voir `contexte`). Une phrase chiffrée si elle est présente,
// sinon la raison de son absence.
const CONSTRUCTEURS = {
  effectif: ({ ind, terminee }) => {
    const e = ind.effectif.detail;
    if (!e.inscrits) return absente("aucun stagiaire inscrit dans cette promo");
    // Sur une promo terminée, personne n'est « en formation » : les stagiaires actifs l'ont suivie jusqu'au bout.
    const actifs = terminee ? `${e.enFormation} ${e.enFormation > 1 ? "ont" : "a"} suivi la formation jusqu'au bout` : `${e.enFormation} en formation`;
    const parties = [actifs, pluriel(e.abandons, "abandon")];
    if (e.surDemande) parties.push(pluriel(e.surDemande, "fiche effacée à la demande", "fiches effacées à la demande"));
    const fin = parties.pop();
    return presente(`${pluriel(e.inscrits, "inscrit")}, dont ${parties.join(", ")} et ${fin}`);
  },

  deroule: ({ planning }) => {
    const demis = demiJournees(planning);
    if (!demis.size) return absente("aucune demi-journée renseignée au planning de cette promo");
    const jours = [...demis.values()].map((lignes) => jourDeLigne(lignes[0]));
    return presente(avecPlage(`${pluriel(demis.size, "demi-journée")} de formation`, jours));
  },

  datesCles: ({ liste }) => {
    const evenements = liste("agenda").filter((e) => TYPES_CLES.includes(e.type) && jourDe(e.date_start));
    if (!evenements.length) return absente("aucune date de formation, de stage ou d'examen au calendrier");
    const parType = TYPES_CLES.map((type) => [type, evenements.filter((e) => e.type === type).length])
      .filter(([, nombre]) => nombre > 0).map(([type, nombre]) => pluriel(nombre, type));
    const jours = evenements.flatMap((e) => [jourDe(e.date_start), jourDe(e.date_end)]);
    return presente(avecPlage(`${pluriel(evenements.length, "événement")} au calendrier (${parType.join(", ")})`, jours));
  },

  // Les heures d'après les feuilles d'émargement closes (js/qualiopi-presence.js) : toutes les lignes, fiches sans nom et fiches
  // effacées à la demande comprises. Une feuille ouverte n'est pas comptée. Sans feuille close, ou lecture en échec, la raison le dit.
  assiduite: ({ presence: p }) => {
    if (p.etat === "non_lue") return absente("feuilles d'émargement non lues (erreur de lecture)");
    if (p.etat === "absente") return absente(raisonAbsence(p));
    const ouvertes = p.ouvertes ? `, ${pluriel(p.ouvertes, "feuille ouverte non comptée", "feuilles ouvertes non comptées")}` : "";
    return presente(`${avecPlage(pluriel(p.feuilles, "feuille close", "feuilles closes"), [p.premier, p.dernier])}, ${dureeEnToutesLettres(p.realiseesMin)} réalisées sur ${dureeEnToutesLettres(p.prevuesMin)} prévues (${pct(p.taux)})${ouvertes}`);
  },

  passages: ({ ind }) => {
    const { salle, voiture } = ind.passages.detail;   // nuls quand personne n'est en formation
    const enSalle = salle ? salle.total : 0;
    const enVoiture = voiture ? voiture.total : 0;
    const absences = ind.absences.detail.absences;
    if (enSalle + enVoiture + absences === 0) return absente("aucun passage en salle ou en voiture enregistré");
    const parties = [`${pluriel(enSalle, "passage")} en salle et ${enVoiture} en voiture (remplacements compris)`];
    if (absences) parties.push(pluriel(absences, "absence de dernière minute", "absences de dernière minute"));
    return presente(parties.join(", "));
  },

  evaluations: ({ ind, liste, dedans, etape2 }) => {
    // Les notes et les examens sont comptés comme au tableau de bord ; seules les dates des notes sont relues ici, avec
    // la même règle. Les évaluations EPCF sont toutes comptées, hors auto-évaluation : le tableau de bord n'en garde
    // que la dernière de chaque stagiaire par grille, pour en tirer un score.
    const nbNotes = ind.notes.detail.n;
    const joursNotes = liste("evaluations").filter((e) => dedans(e) && estNotee(e)).map((e) => jourDe(e.date_eval));
    const examens = ind.examensQcm.detail.passes;
    const epcf = liste("epcf").filter((e) => dedans(e) && e.contexte === "EPCF" && !e.auto_eval).length;
    const livrets = new Set(liste("livrets").filter(dedans).map((l) => l.stagiaire_id)).size;
    const parties = [];
    if (nbNotes) parties.push(avecPlage(pluriel(nbNotes, "note"), joursNotes));
    if (examens) parties.push(pluriel(examens, "examen QCM", "examens QCM"));
    if (epcf) parties.push(pluriel(epcf, "évaluation EPCF", "évaluations EPCF"));
    if (livrets) parties.push(pluriel(livrets, "livret EPCF", "livrets EPCF"));
    if (!parties.length) return absente(etape2 ? RAISON_EFFACEE : `aucune évaluation enregistrée ; ${SANS_JURY}`);
    return presente(`${parties.join(", ")} ${POPULATION} ; ${SANS_JURY}`);
  },

  dossierPro: ({ ind, liste, dedans, etape2 }) => {
    const dossiers = liste("dossiers").filter(dedans);
    const stagiaires = new Set(dossiers.map((d) => d.stagiaire_id)).size;
    if (!stagiaires) {
      if (etape2) return absente(RAISON_EFFACEE);
      // Toutes les fiches ont été effacées à la demande : ce n'est pas un dossier que les stagiaires n'ont pas fait.
      if (!ind.effectif.detail.enFormation && ind.effectif.detail.surDemande) return absente(RAISON_SUR_DEMANDE);
      return absente("aucun dossier professionnel enregistré par les stagiaires en formation");
    }
    const derniers = dossiers.map((d) => jourDe(d.updated_at)).filter(Boolean).sort();
    const miseAJour = derniers.length ? `, dernière mise à jour le ${jourMois(derniers[derniers.length - 1])}` : "";
    return presente(`enregistré pour ${pluriel(stagiaires, "stagiaire")} sur ${ind.effectif.detail.enFormation} en formation${miseAJour}`);
  },

  ressources: ({ ind, liste, referentiel }) => {
    const cours = liste("cours").filter((c) => c.published).length;
    if (!cours) return absente("aucun cours publié");
    const { actifs, enFormation, tentatives } = ind.activiteQcm.detail;
    const appropriation = tentatives
      ? `QCM d'entraînement faits par ${pluriel(actifs, "stagiaire")} sur ${enFormation} en formation (${pluriel(tentatives, "tentative")})`
      : "aucun QCM d'entraînement fait";
    return presente(`${pluriel(cours, "cours publié", "cours publiés")}, ${pluriel(tableau(referentiel.qcm).length, "QCM", "QCM")} ; ${appropriation}`);
  },

  // Les cours modifiés sont les cours publiés qui ont au moins une modification dans la période (voir
  // `modificationsDesCours`) : chaque cours est compté une fois, ses modifications à part. Les brouillons et les versions
  // d'un cours inconnu ne comptent pas.
  misesAJour: ({ liste, dansPeriode }) => {
    const modifies = modificationsDesCours(liste("cours"), liste("versions"))
      .map((horodatages) => horodatages.filter((h) => dansPeriode(jourDe(h))))
      .filter((horodatages) => horodatages.length > 0);
    const joursModifications = modifies.flat().map(jourDe);
    const joursSignalements = liste("signalements").map((s) => jourDe(s.traite_at)).filter(dansPeriode);
    if (!modifies.length && !joursSignalements.length) {
      return absente("aucun cours publié modifié ni contestation de QCM traitée pendant la formation");
    }
    const parties = [];
    if (modifies.length) {
      const nbCours = pluriel(modifies.length, "cours publié modifié", "cours publiés modifiés");
      parties.push(`${avecPlage(nbCours, joursModifications)} (${pluriel(joursModifications.length, "modification")})`);
    }
    if (joursSignalements.length) {
      parties.push(avecPlage(pluriel(joursSignalements.length, "contestation de QCM traitée", "contestations de QCM traitées"), joursSignalements));
    }
    return presente(parties.join(" ; "));
  },

  innovations: ({ nouveautes, dansPeriode }) => {
    const jours = nouveautes.map((nouveaute) => jourDe(nouveaute.date)).filter(dansPeriode);
    if (!jours.length) return absente("aucune nouveauté datée pendant la formation");
    return presente(avecPlage(pluriel(jours.length, "nouveauté datée", "nouveautés datées"), jours));
  },

  // Des nombres seulement : les formateurs distincts, les intervenants « Autre » distincts (leur nom est compté,
  // jamais recopié), les bénévoles distincts et les auto-écoles actives du lieu.
  intervenants: ({ promo, liste, planning }) => {
    const { formateurs, benevoles, exterieurs } = intervenantsDistincts(planning);
    const autoEcoles = promo.lieu_id == null ? 0
      : liste("autoEcoles").filter((a) => a.actif && a.lieu_id === promo.lieu_id).length;
    const parties = [];
    if (formateurs.size) parties.push(pluriel(formateurs.size, "formateur"));
    if (exterieurs) parties.push(pluriel(exterieurs, "intervenant extérieur", "intervenants extérieurs"));
    if (benevoles.size) parties.push(pluriel(benevoles.size, "bénévole"));
    if (autoEcoles) parties.push(pluriel(autoEcoles, "auto-école partenaire", "auto-écoles partenaires"));
    if (!parties.length) {
      return absente("aucun formateur, intervenant extérieur ni bénévole au planning, aucune auto-école partenaire active");
    }
    return presente(parties.join(", "));
  },

  resultats: ({ ind }) => {
    if (!ind.effectif.detail.inscrits) return absente("aucun stagiaire inscrit : aucun indicateur à calculer");
    const mesures = Object.values(ind).filter((i) => i.nature === "mesuré" && i.valeur != null).length;
    return presente(`${pluriel(mesures, "indicateur mesuré", "indicateurs mesurés")}, chacun avec sa méthode de calcul ; réussite au titre non mesurée`);
  },

  // Des comptes seulement, jamais un commentaire. Au-dessus du seuil : le taux des réponses favorables, les avis notés et les inscrits ;
  // sous le seuil ou sans questionnaire : une raison fixe, sans chiffre.
  appreciations: ({ satisfaction }) => {
    if (satisfaction?.etat === "mesuree") {
      const sur = satisfaction.inscrits > 0 ? ` sur ${pluriel(satisfaction.inscrits, "inscrit")}` : "";
      return presente(`questionnaire de fin de formation, ${pct(satisfaction.taux / 100)} de réponses favorables (${pluriel(satisfaction.repondants, "avis noté", "avis notés")}${sur})`);
    }
    if (satisfaction?.etat === "sous_seuil") return absente(RAISON_SOUS_SEUIL);
    return absente(satisfaction?.etat === "absente" ? RAISON_SANS_QUESTIONNAIRE : RAISON_NON_LUE);
  },

  // Des comptes et des dates seulement : jamais un texte saisi au registre. Une entrée effacée compte comme les autres.
  registre: ({ registre, promo, aujourdhui }) => {
    if (registre?.etat === "absente") return absente(RAISON_REGISTRE_ABSENT);
    if (registre?.etat !== "lue") return absente(RAISON_REGISTRE_NON_LU);
    const entrees = entreesPourPromo(registre.entrees, promo, jourDe(aujourdhui));
    if (!entrees.length) return absente(RAISON_REGISTRE_VIDE);
    const { total, parType, parEtat } = decompteRegistre(entrees);
    const types = Object.entries(TYPES).filter(([cle]) => parType[cle] > 0).map(([cle, libelle]) => pluriel(parType[cle], libelle.toLowerCase())).join(", ");
    const mediane = delaiMedianJours(entrees);
    const delai = mediane == null ? "aucune réponse datée" : `${String(mediane).replace(".", ",")} ${mediane >= 2 ? "jours" : "jour"}`;
    return presente(`${pluriel(total, "entrée")} (${types}), dont ${pluriel(parEtat.clos, "close")} ; délai médian de réponse : ${delai}`);
  },

  // Des nombres seulement : la liste des stagiaires à suivre de près porte des noms, elle n'est que comptée. Les listes
  // de thèmes du tableau de bord sont des classements : les thèmes qui ont assez de données, du plus faible au plus
  // fort, coupés à 5. Leur longueur n'est donc pas un nombre de thèmes faibles : la phrase dit « les N thèmes les plus
  // faibles » et le seuil de données.
  suivi: ({ ind }) => {
    const aSuivre = ind.aSuivre.length;
    const parQcm = ind.themes.qcm.length;
    const parNotes = ind.themes.notes.length;
    if (!aSuivre && !parQcm && !parNotes) {
      return absente("aucun stagiaire n'est à suivre de près et aucun thème n'a encore assez de réponses ou de notes");
    }
    const plusFaibles = (nombre) => (nombre > 1 ? `les ${nombre} thèmes les plus faibles` : "le thème le plus faible");
    const qcm = parQcm
      ? `${plusFaibles(parQcm)} d'après les QCM (au moins ${MIN_REPONSES_THEME} réponses par thème)`
      : `aucun thème n'a au moins ${MIN_REPONSES_THEME} réponses aux QCM`;
    const notes = parNotes
      ? `${plusFaibles(parNotes)} d'après les notes (au moins ${MIN_NOTES_THEME} notes par thème)`
      : `aucun thème n'a au moins ${MIN_NOTES_THEME} notes`;
    return presente(`stagiaires à suivre de près : ${aSuivre} ; ${qcm} ; ${notes}`);
  },
};

// Tout ce que les pièces lisent, calculé une fois. La période de la promo court de sa date de début à sa date de fin,
// ou à aujourd'hui quand elle n'en a pas ; une borne inconnue est ouverte. Le planning est formé des lignes de la promo,
// moins celles d'un jour désactivé : tout ce qui en vient (demi-journées, dates, formateurs, intervenants « Autre »,
// bénévoles) passe par là (`lignesDuPlanning`).
function contexte(donnees, referentiel, { promo, aujourdhui, nouveautes }) {
  const liste = (cle) => tableau(donnees[cle]);
  const demandes = demandesDe(donnees);
  const enFormation = new Set(liste("stagiaires").filter((s) => s.actif && !demandes.has(s.id)).map((s) => s.id));
  // Étape des 3 ans faite : toutes les fiches de la promo (hors celles effacées à la demande) ont perdu leur nom.
  const fiches = liste("stagiaires").filter((s) => !demandes.has(s.id));
  const etape2 = fiches.length > 0 && fiches.every((s) => s.anonymise_le);
  const debut = jourDe(promo.date_debut);
  const fin = jourDe(promo.date_fin) ?? jourDe(aujourdhui);
  return {
    promo, referentiel, liste,
    satisfaction: donnees.satisfaction ?? { etat: "non_lue" },   // aucune lecture faite : honnêtement « non lue »
    registre: donnees.registre ?? { etat: "non_lue" },
    aujourdhui,
    terminee: promoTerminee(promo, aujourdhui),
    nouveautes: nouveautesCitables(nouveautes),
    etape2,
    presence: presenceDePromo(donnees.emargement, promo.id),
    ind: indicateursPromo(donnees, referentiel, { aujourdhui, demandes }),
    dedans: (ligne) => enFormation.has(ligne.stagiaire_id),
    planning: lignesDuPlanning(donnees, promo, aujourdhui),
    dansPeriode: (jour) => jour !== null && (debut === null || jour >= debut) && (fin === null || jour <= fin),
  };
}

// donnees : sortie de lireDonneesQualiopi (forme en tête de fichier) ; referentiel : lireReferentielCentre() ;
// promo : { id, lieu_id, nom, date_debut, date_fin } (date_fin peut être nulle) ; aujourdhui : « AAAA-MM-JJ » ;
// nouveautes : entrées de NOUVEAUTES (js/nouveautes-data.js).
// Rend { promo, indicateurs, nonApplicables } : pour chaque indicateur applicable (27, ou 28 avec l'alternance),
// { numero, critere, court, niveau, apporte, pieces: [{ cle, libelle, presente, detail, raison }], aFournir } ;
// pour les autres, { numero, court, raison }. `detail` est la phrase chiffrée d'une pièce présente, `raison` celle
// d'une pièce absente ; l'autre champ est nul.
export function inventairePromo(donnees, referentiel, { promo, aujourdhui, alternance = false, nouveautes = [] }) {
  const c = contexte(donnees, referentiel, { promo, aujourdhui, nouveautes });
  const etat = new Map(PIECES.map((p) => [p.cle, CONSTRUCTEURS[p.cle](c)]));
  const applicables = indicateursApplicables({ alternance });
  const retenus = new Set(applicables.map((i) => i.numero));
  return {
    promo,
    indicateurs: applicables.map((i) => ({
      numero: i.numero,
      critere: i.critere,
      court: i.court,
      niveau: NIVEAUX[i.numero].niveau,
      apporte: NIVEAUX[i.numero].apporte,
      pieces: PIECES.filter((p) => p.indicateurs.includes(i.numero)).map((p) => ({ cle: p.cle, libelle: p.libelle, ...etat.get(p.cle) })),
      aFournir: [...NIVEAUX[i.numero].aFournir],
    })),
    // Les autres : apprentissage seulement, ou l'alternance quand le centre n'en déclare pas.
    nonApplicables: INDICATEURS.filter((i) => !retenus.has(i.numero)).map((i) => ({
      numero: i.numero,
      court: i.court,
      raison: i.categories.formation ? "pas d'alternance déclarée" : "apprentissage seulement",
    })),
  };
}
