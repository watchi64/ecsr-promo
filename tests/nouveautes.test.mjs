import assert from "node:assert/strict";
import {
  triees, visibles, nonLues, libellePastille, purger, ajouterVues, idsDeReprise, amorcePour,
  STORAGE_SOUS_ONGLET,
} from "../js/nouveautes.js";
import { CLES_SOUS_ONGLETS } from "../js/nav-rules.js";
import { routeDansLEspace } from "../js/espaces-rules.js";
import { NOUVEAUTES } from "../js/nouveautes-data.js";
import { MODULES } from "../js/modules-data.js";

const E = [
  { id: "a", date: "2026-07-02", pour: "formateurs" },
  { id: "b", date: "2026-07-31", pour: "tous" },
  { id: "c", date: "2026-07-31", pour: "tous" },
  { id: "d", date: "2026-07-19", pour: "tous" },
];

// Tri antéchronologique. À date égale (b et c), l'ordre du fichier de contenu
// est conservé : Array.prototype.sort est stable depuis ES2019.
assert.deepEqual(triees(E).map((e) => e.id), ["b", "c", "d", "a"]);
// Le tri ne modifie pas le tableau reçu.
assert.deepEqual(E.map((e) => e.id), ["a", "b", "c", "d"]);

// Audience : une entrée « formateurs » disparaît pour un stagiaire.
assert.deepEqual(visibles(E, true).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(visibles(E, false).map((e) => e.id), ["b", "c", "d"]);

// Non-lu : une entrée est neuve tant que son id n'a pas été vu.
assert.deepEqual(nonLues(E, ["b", "d"]).map((e) => e.id), ["a", "c"]);
assert.deepEqual(nonLues(E, []).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(nonLues(E, null).map((e) => e.id), ["a", "b", "c", "d"]);

// Pastille : rien à zéro, le compte jusqu'à 9, « 9+ » au-delà.
assert.equal(libellePastille(0), "");
assert.equal(libellePastille(3), "3");
assert.equal(libellePastille(9), "9");
assert.equal(libellePastille(10), "9+");

// Purge : un id mémorisé qui ne correspond plus à aucune entrée disparaît.
assert.deepEqual(purger(["a", "obsolete"], E), ["a"]);
// Ajout sans doublon, purgé au passage.
assert.deepEqual(ajouterVues(["a"], ["a", "b", "obsolete"], E), ["a", "b"]);
// Une annonce d'ouverture de module n'est jamais purgée, même absente de la
// liste du moment (état des modules illisible au démarrage).
assert.deepEqual(purger(["module-notes-2026-10-12T13:30:00.000Z", "obsolete"], E),
                 ["module-notes-2026-10-12T13:30:00.000Z"]);

// Amorce : au premier accès, les entrées antérieures ou égales à la mise en
// ligne sont déjà lues. Celles qui lui sont postérieures restent neuves, sinon
// une nouveauté publiée le jour même passerait inaperçue.
assert.deepEqual(idsDeReprise(E, "2026-07-31"), ["a", "b", "c", "d"]);
assert.deepEqual(idsDeReprise(E, "2026-07-19"), ["a", "d"]);
assert.deepEqual(idsDeReprise(E, "2026-07-01"), []);
// Une entrée postérieure à la mise en ligne n'est jamais amorcée.
const AVEC_FUTURE = [...E, { id: "futur", date: "2026-08-15", pour: "tous" }];
assert.ok(!idsDeReprise(AVEC_FUTURE, "2026-08-01").includes("futur"));

// Amorce par promo : une promo récente ne trouve pas des dizaines d'anciennes entrées
// « neuves » au premier passage ; une promo plus ancienne que la rubrique garde la date
// de mise en ligne.
assert.equal(amorcePour(undefined), "2026-08-01");
assert.equal(amorcePour("2026-03-30"), "2026-08-01");
assert.equal(amorcePour("2026-09-30"), "2026-09-30");

// === Refonte de la navigation (lot 2A, tâche 1) ===
// Les 21 assertions d'au-dessus ne comptent pas dans `n` : il part de leur nombre.
let n = 21;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ids = (l) => l.map((e) => e.id);

// Une seule navigation depuis le 10/11 : `visibles(entrees, formateur)` ne dépend que de l'audience.
eq(ids(visibles(E, true)), ["a", "b", "c", "d"], "formateur : tout");
eq(ids(visibles(E, false)), ["b", "c", "d"], "stagiaire : pas les entrées des formateurs");

// Un lien « Où le trouver » vers un sous-onglet de Stagiaires (Élèves bénévoles) l'ouvre par la mémoire de sa barre de sous-onglets.
eq(STORAGE_SOUS_ONGLET.stagiaires, "stagiaires.subtab", "Stagiaires : sous-onglet mémorisé joignable");
eq(STORAGE_SOUS_ONGLET.stagiaires, CLES_SOUS_ONGLETS.stagiaires, "la clé de Stagiaires vient de nav-rules.js");

// === Les Nouveautés réelles ===
const par = (id) => NOUVEAUTES.find((e) => e.id === id);
const CADRATIN = String.fromCharCode(0x2014);
const tout = (e) => [e.titre, e.resume, ...(e.guide || []), e.ou ? e.ou.label : ""].join(" ");
for (const e of NOUVEAUTES) ok(!tout(e).includes(CADRATIN), e.id + " : aucun tiret cadratin");
ok(NOUVEAUTES.every((e) => !("navigation" in e) && !("guideNouvelle" in e)),
  "une seule navigation (phase 2, 11/11) : ni champ navigation ni guideNouvelle");
for (const id of ["2026-10-03-barre-simple", "2026-07-23-espace-personnel", "2026-10-03-sommaire-iphone"]) {
  ok(!par(id), id + " : retirée (elle ne décrivait que l'ancienne barre)");
}

// Les deux Nouveautés de lancement de la nouvelle navigation.
const lancement = par("2026-10-29-nouvelle-navigation");
const lancementEquipe = par("2026-10-29-nouvelle-navigation-formateurs");
ok(!!lancement && lancement.pour === "tous" && lancement.date === "2026-10-29" && lancement.titre === "Une navigation plus simple",
  "lancement pour tous : « Une navigation plus simple »");
ok(!!lancementEquipe && lancementEquipe.pour === "formateurs" && lancementEquipe.date === "2026-10-29"
  && lancementEquipe.titre === "Côté formateurs, la barre passe à gauche", "lancement des formateurs : « Côté formateurs, la barre passe à gauche »");
eq(ids(visibles(NOUVEAUTES, false)).filter((id) => id.startsWith("2026-10-29-nouvelle")), ["2026-10-29-nouvelle-navigation"],
  "un stagiaire voit la première, pas la seconde");
eq(ids(visibles(NOUVEAUTES, true)).filter((id) => id.startsWith("2026-10-29-nouvelle")),
  ["2026-10-29-nouvelle-navigation", "2026-10-29-nouvelle-navigation-formateurs"], "un formateur voit les deux");
// Ce qu'elles disent, après ce lot : le compte sans chiffre, Mes préférences, où sont les notes de la classe et les contacts du centre ; pour
// l'équipe, le compte et l'assistant en pied de barre sur ordinateur, le bouton Assistant dans l'en-tête sur téléphone.
const dit = (e, motif) => motif.test(tout(e));
ok(dit(lancement, /Mon suivi, La classe/), "pour tous : où sont les notes de la classe");
ok(dit(lancement, /contacts du centre/i), "pour tous : où sont les contacts du centre");
ok(dit(lancement, /menu de ton compte|menu du compte/), "pour tous : les contacts sont dans le menu du compte");
ok(dit(lancement, /Mes préférences/), "pour tous : Mes préférences");
ok(!dit(lancement, /Réglages/), "pour tous : « Réglages » est la page de la promo, réservée à l'équipe : jamais dans l'entrée de tous");
ok(dit(lancement, /[Uu]n point/) && !dit(lancement, /pastille|chiffre/), "pour tous : le compte montre un point, sans chiffre");
// F5 : une promo de départ n'a pas encore Priorités, Thèmes, Compétences, La classe, l'Assistant : le lancement le dit.
ok(lancement.resume.includes("Certaines parties s'ouvrent au fil de la formation."), "pour tous : certaines parties s'ouvrent au fil de la formation");
// F4, puis audit du 09/11 (lot B) : le retour au jour est « Revenir à aujourd'hui », dans Planning, Semaine, depuis une autre semaine (pas « en haut
// du Planning », qui est aussi la barre de jours collée).
ok(/Planning, Semaine/.test(lancement.guide[0]) && /Revenir à aujourd'hui/.test(lancement.guide[0]) && !/En haut du Planning/.test(tout(lancement)),
  "pour tous : « Revenir à aujourd'hui », dans Planning, Semaine");
ok(dit(lancement, /en bas de la barre de gauche/), "pour tous : les formateurs sur ordinateur trouvent le compte et l'assistant en bas de la barre de gauche");
ok(dit(lancementEquipe, /en bas de (cette|la) barre/), "formateurs : le compte et l'assistant en pied de barre");
ok(dit(lancementEquipe, /Assistant/) && dit(lancementEquipe, /téléphone/), "formateurs : le bouton Assistant sur téléphone");
ok(dit(lancementEquipe, /Plus/) && dit(lancementEquipe, /Réglages/), "formateurs : Plus et Réglages");
ok(dit(lancementEquipe, /bénévoles/), "formateurs : les élèves bénévoles sont sous Stagiaires");
eq(lancementEquipe.ou, { label: "Stagiaires, Élèves bénévoles", route: "stagiaires", sousOnglet: "benevoles" }, "formateurs : le lien ouvre le sous-onglet Élèves bénévoles");
ok(!dit(lancementEquipe, /Tout l'espace formateur/), "formateurs : le tiroir s'appelle « Autres pages »");
for (const e of [lancement, lancementEquipe]) {
  ok(!/Tes initiales, en haut à droite, ouvrent ton compte : Nouveautés, Réglages/.test(tout(e)), e.id + " : plus l'ancien texte du compte");
  ok(!/\bprofs?\b/i.test(tout(e)), e.id + " : « formateur », jamais « prof »");
  ok(Array.isArray(e.guide) && e.guide.length >= 3, e.id + " : un guide");
}

// La Nouveauté pour tous des corrections communes (relecture finale, F3) : ni « Indicateurs » ni « tableau de bord », que les
// stagiaires ne voient pas.
const affichage = par("2026-10-29-affichage-telephone");
ok(!!affichage && affichage.pour === "tous" && affichage.date === "2026-10-29" && affichage.titre === "Des pages mieux tenues sur le téléphone",
  "affichage : « Des pages mieux tenues sur le téléphone », du 29/10, pour tous");
ok(affichage.module === undefined && affichage.ou === undefined, "affichage : ni module ni lien (aucun module fermé ne la cache)");
ok(/graphes des notes/.test(affichage.resume) && /historique des passages/.test(affichage.resume) && /largeur de l'écran/.test(affichage.resume),
  "affichage : les graphes des notes et l'historique des passages tiennent dans la largeur de l'écran");
ok(/En cours/.test(affichage.resume) && /négatif/.test(affichage.resume), "affichage : un stage commencé affiche « En cours », plus un nombre de jours négatif");
ok(/moyennes basses/.test(affichage.resume) && /rouge/.test(affichage.resume), "affichage : les moyennes basses des graphes ne sont plus en rouge");
ok(!/Indicateurs|tableau de bord/i.test(tout(affichage)), "affichage : ni « Indicateurs » ni « tableau de bord » dans une entrée pour tous");
ok(!/\bprofs?\b/i.test(tout(affichage)), "affichage : « formateur », jamais « prof »");
for (const formateur of [false, true]) {
  ok(ids(visibles(NOUVEAUTES, formateur)).includes("2026-10-29-affichage-telephone"),
    `affichage : lue ${formateur ? "par un formateur" : "par un stagiaire"}`);
}
// À date égale, l'ordre du fichier est gardé : le jour du lancement, les entrées de lancement passent avant la Nouveauté commune.
const DU_LANCEMENT = (l) => ids(l).filter((id) => id.startsWith("2026-10-29-"));
eq(DU_LANCEMENT(triees(visibles(NOUVEAUTES, false))).slice(0, 2), ["2026-10-29-nouvelle-navigation", "2026-10-29-affichage-telephone"],
  "un stagiaire : le lancement d'abord, puis les corrections communes");
eq(DU_LANCEMENT(triees(visibles(NOUVEAUTES, true))).slice(0, 3),
  ["2026-10-29-nouvelle-navigation", "2026-10-29-nouvelle-navigation-formateurs", "2026-10-29-affichage-telephone"],
  "un formateur : les deux lancements, puis les corrections communes");

// === Lot 2B (date de la fusion) : la journée sur l'Accueil, Aujourd'hui chez l'équipe, les cours sur téléphone ===
// La date de la fusion n'a qu'une source : js/nouveautes-data.js. Le test la lit sur l'entrée de la journée et exige la même
// sur les trois, dans leur id comme dans leur champ `date`.
const journee = NOUVEAUTES.find((e) => e.id.endsWith("-ta-journee-accueil"));
const JOUR = journee.date;
const aujourdhui = par(JOUR + "-aujourdhui-formateurs");
const coursTel = par(JOUR + "-cours-telephone");
ok(/^\d{4}-\d{2}-\d{2}$/.test(JOUR) && journee.id === JOUR + "-ta-journee-accueil", "lot 2B : la journée porte une date et un id préfixé par elle");
ok(!!journee && journee.pour === "stagiaires" && journee.titre === "Ta journée sur l'Accueil", "lot 2B : « Ta journée sur l'Accueil », pour les stagiaires");
ok(!!aujourdhui && aujourdhui.pour === "formateurs" && aujourdhui.titre === "Aujourd'hui remplace l'Accueil",
  "lot 2B : « Aujourd'hui remplace l'Accueil », pour les formateurs");
ok(!!coursTel && coursTel.pour === "tous" && coursTel.module === "cours" && coursTel.titre === "Les cours se lisent mieux sur téléphone",
  "lot 2B : « Les cours se lisent mieux sur téléphone », pour tous, masquée si la lecture des cours est fermée");
for (const e of [journee, aujourdhui, coursTel]) {
  ok(e.date === JOUR && e.id.startsWith(JOUR + "-"), e.id + " : même date que les autres entrées du lot, id préfixé par elle");
  ok(!!e.ou && typeof e.ou.label === "string" && typeof e.ou.route === "string", e.id + " : un « Où le trouver »");
  ok(Array.isArray(e.guide) && e.guide.length >= 3, e.id + " : un « Comment faire » d'au moins trois étapes");
}
// Le ton (décision du 10/11) : la journée (stagiaires) tutoie, Aujourd'hui (formateurs) vouvoie, les cours (pour tous) restent
// neutres ; la règle générale est vérifiée plus bas sur toutes les entrées.
const TUTOIEMENT = /(?<!\p{L})(tu|te|toi|ton|ta|tes|tien|tiens|tienne)(?!\p{L})|(?<!\p{L})t'(?=\p{L})/iu;
const VOUVOIEMENT = /(?<!rendez-)(?<!\p{L})(vous|votre|vos|vôtre)(?!\p{L})/iu;
const horsCitations = (s) => s.replace(/«[^»]*»/g, "");
ok(!VOUVOIEMENT.test(horsCitations(tout(journee))), "journée : tutoiement, jamais de vouvoiement");
ok(VOUVOIEMENT.test(tout(aujourdhui)) && !TUTOIEMENT.test(horsCitations(tout(aujourdhui))), "Aujourd'hui : vouvoiement, jamais de tutoiement");
ok(!TUTOIEMENT.test(horsCitations(tout(coursTel))) && !VOUVOIEMENT.test(horsCitations(tout(coursTel))), "cours : pour tous, ni tu ni vous");
// La journée : la carte de l'Accueil, la signature, À faire, la grille du planning, les QCM et Mon suivi ; le bouton d'une ligne de QCM s'appelle « Voir le QCM ».
for (const motif of [/« Aujourd'hui »/, /Signer pour ce matin/, /« À faire »/, /grille/, /onglet QCM/, /« Voir le QCM »/, /Mon suivi, partie Résultats/, /« Moi »/, /« La classe »/]) {
  ok(motif.test(tout(journee)), `journée : dit ${motif}`);
}
ok(!/formateurs/.test(tout(journee)), "journée : ne parle pas de l'équipe, elle ne la lit pas");
eq(journee.ou, { label: "Accueil", route: "home" }, "journée : Où le trouver, l'Accueil");
// Aujourd'hui : émargement, tableau, voiture, à traiter, à suivre, Propositions IA.
for (const motif of [/« Émargement »/, /« Voir la feuille »/, /« Au tableau »/, /« En voiture »/, /« À traiter »/, /« À suivre de près »/, /Propositions IA/, /« Relire »/, /Indicateurs/]) {
  ok(motif.test(tout(aujourdhui)), `Aujourd'hui : dit ${motif}`);
}
eq(aujourdhui.ou, { label: "Aujourd'hui", route: "home" }, "Aujourd'hui : Où le trouver, Aujourd'hui");
ok(/barre de gauche/.test(aujourdhui.guide[0]) && /téléphone/.test(aujourdhui.guide[0]), "Aujourd'hui : où est l'entrée, sur ordinateur et sur téléphone");
// Les cours : sommaire à la ligne, tableaux en listes sur téléphone ; le lien vers Cours (Cours et QCM sous la nouvelle barre).
ok(/sommaire/.test(coursTel.resume) && /à la ligne/.test(coursTel.resume) && /tableaux/.test(coursTel.resume) && /listes/.test(coursTel.resume), "cours : sommaire à la ligne, tableaux en listes");
eq(coursTel.ou, { label: "Cours", route: "themes" }, "cours : Où le trouver, Cours (réécrit Cours et QCM sous la nouvelle barre)");
// Qui les voit : la journée pour les stagiaires, Aujourd'hui pour l'équipe, les cours pour tous.
const QUESTIONNAIRES_ID = "2026-11-09-questionnaires-anonymes";
const DU_LOT = (l) => ids(l).filter((id) => [journee.id, aujourdhui.id, coursTel.id].includes(id));
// Second lot de corrections : les repères de l'Accueil pour le stagiaire, les comptes de l'émargement pour l'équipe.
ok(ids(visibles(NOUVEAUTES, false)).includes("2026-11-09-accueil-plus-juste")
  && !ids(visibles(NOUVEAUTES, true)).includes("2026-11-09-accueil-plus-juste"), "repères de l'Accueil : stagiaire seulement");
ok(ids(visibles(NOUVEAUTES, true)).includes("2026-11-09-emargement-planning-plus-justes")
  && !ids(visibles(NOUVEAUTES, false)).includes("2026-11-09-emargement-planning-plus-justes"), "comptes de l'émargement : l'équipe");
eq(DU_LOT(triees(visibles(NOUVEAUTES, false))), [journee.id, coursTel.id], "stagiaire : la journée d'abord (carte de l'Accueil), puis les cours");
eq(DU_LOT(triees(visibles(NOUVEAUTES, true))), [aujourdhui.id, coursTel.id],
  "formateur : Aujourd'hui et les cours, pas la journée du stagiaire");
// « La plus récente » du lot se juge sans les questionnaires anonymes, mis en ligne le même jour et placés en tête du
// fichier : ce sont eux que montre désormais la carte « Nouveauté » de l'Accueil.
const JUSQU_AU_LOT = (l) => l.filter((e) => e.date <= JOUR && e.id !== QUESTIONNAIRES_ID);
// Une Nouveauté d'un jour suivant (les confirmations dans l'app, 10/11) passe devant, comme le vérificateur le prévoit :
// parmi celles datées jusqu'au jour du lot, la plus récente reste celle des questionnaires.
const JUSQU_AU_JOUR = (l) => l.filter((e) => e.date <= JOUR);
for (const formateur of [false, true]) {
  eq(ids(triees(JUSQU_AU_JOUR(visibles(NOUVEAUTES, formateur))))[0], QUESTIONNAIRES_ID,
    `jusqu'au jour du lot, la plus récente est celle des questionnaires (${formateur ? "formateur" : "stagiaire"})`);
}
eq(ids(triees(JUSQU_AU_LOT(visibles(NOUVEAUTES, false))))[0], journee.id, "stagiaire : la plus récente est la journée");
ok(!/IA/.test(aujourdhui.resume), "Aujourd'hui : le résumé n'annonce pas Propositions IA à tous (réservé aux administrateurs, dans les étapes)");

// Conservation des données (Qualiopi Q5, tâche 7) : pour les formateurs, datée de la mise en ligne ; en tête de leur liste (carte
// « Nouveauté » de l'Accueil), jamais chez un stagiaire. Une seule navigation depuis la phase 2 : visibles(entrées, formateur, espace).
const CONSERVATION_ID = "2026-11-11-conservation-fondateur";
const conservation = NOUVEAUTES.find((e) => e.id === CONSERVATION_ID);
ok(!!conservation && conservation.pour === "formateurs" && conservation.navigation === undefined && conservation.id.startsWith(conservation.date + "-"),
  "conservation : pour les formateurs, sans champ navigation, id préfixé par sa date");
// La liste des thèmes compacte (même jour, placée en tête du fichier) passe devant : la conservation se juge sans elle.
const THEMES_COMPACTS_ID = "2026-11-11-themes-compacts";
// Jugée parmi les entrées de son jour et d'avant : une Nouveauté d'un jour suivant pour tous (les confirmations sur téléphone,
// 12/11) passe normalement devant.
const SANS_THEMES_COMPACTS = NOUVEAUTES.filter((e) => e.id !== THEMES_COMPACTS_ID && e.date <= conservation.date);
for (const espace of [undefined, "equipe"]) {
  eq(ids(triees(visibles(SANS_THEMES_COMPACTS, true, espace)))[0], CONSERVATION_ID, `conservation : la plus récente chez un formateur (espace ${espace})`);
}
// Thèmes compacts (11/11) : pour tous, en tête chez le formateur comme chez le stagiaire ; dit le geste « … » et « Plus ».
const themesCompacts = NOUVEAUTES.find((e) => e.id === THEMES_COMPACTS_ID);
ok(!!themesCompacts && themesCompacts.pour === "tous" && /« … »/.test(themesCompacts.resume) && /« Plus »/.test(themesCompacts.resume),
  "thèmes compacts : pour tous, nomme « … » et « Plus »");
// Jugé parmi les entrées de son jour et d'avant : une Nouveauté d'un jour suivant passe normalement devant.
const JUSQU_AU_11 = NOUVEAUTES.filter((e) => e.date <= themesCompacts.date);
for (const formateur of [false, true]) {
  eq(ids(triees(visibles(JUSQU_AU_11, formateur, formateur ? "equipe" : "stagiaire")))[0], THEMES_COMPACTS_ID,
    `thèmes compacts : la plus récente (${formateur ? "formateur" : "stagiaire"})`);
}
// L'état de l'examen sur la fiche d'un QCM (bug du 12/11) : pour tous, la plus récente chez le stagiaire comme chez l'équipe.
const ETAT_EXAMEN_ID = "2026-11-12-etat-examen-qcm";
const etatExamen = NOUVEAUTES.find((e) => e.id === ETAT_EXAMEN_ID);
ok(!!etatExamen && etatExamen.pour === "tous" && etatExamen.id.startsWith(etatExamen.date + "-") && etatExamen.ou?.route === "themes",
  "état de l'examen : pour tous, id préfixé par sa date, mène à Cours et QCM");
// Visible des deux côtés ; le même jour, la carte « Aujourd'hui » (placée avant dans le fichier) reste l'annonce de tête
// chez le stagiaire.
for (const [formateur, espace] of [[false, "stagiaire"], [true, "equipe"]]) {
  ok(ids(visibles(NOUVEAUTES, formateur, espace)).includes(ETAT_EXAMEN_ID), `état de l'examen : visible (espace ${espace})`);
}
eq(ids(triees(visibles(NOUVEAUTES, false, "stagiaire")))[0], "2026-11-12-accueil-aujourdhui-roles",
  "état de l'examen : la carte « Aujourd'hui » reste en tête chez le stagiaire");
for (const espace of [undefined, "stagiaire"]) {
  ok(!ids(visibles(NOUVEAUTES, false, espace)).includes(CONSERVATION_ID), `conservation : jamais chez un stagiaire (espace ${espace})`);
  ok(ids(triees(visibles(NOUVEAUTES, false, espace)))[0] !== CONSERVATION_ID, `stagiaire : la plus récente n'est jamais la conservation (espace ${espace})`);
}
for (const espace of ["direction", "siege"]) {
  ok(!ids(visibles(NOUVEAUTES, true, espace)).includes(CONSERVATION_ID), `conservation : jamais dans l'espace ${espace}`);
}
for (const motif of [/Effacer les données/, /Anonymiser la promo/, /quittent Réglages/, /31 décembre de la troisième année/, /12 mois/, /fondateur/,
  /n'a plus à être mis en abandon/, /« Réactiver » reste/, /élèves bénévoles/]) {
  ok(motif.test(conservation.resume), "conservation : dit " + motif);
}
eq(conservation.ou, { label: "Paramètres", route: "config" }, "conservation : Où le trouver, Paramètres (Réglages sous la nouvelle barre)");
ok(VOUVOIEMENT.test(horsCitations(tout(conservation))) && !TUTOIEMENT.test(horsCitations(tout(conservation))) && !/\bprofs?\b/i.test(tout(conservation)) && !tout(conservation).includes(String.fromCharCode(0x2014)),
  "conservation : vouvoiement (texte de l'équipe, lot D), « formateur » jamais « prof », aucun tiret cadratin");
ok(!/RPC|Supabase|migration|base de données|anonymise_le|efface_le/i.test(tout(conservation)), "conservation : aucun mot technique");

// Questionnaires anonymes (plan Qualiopi Q3, tâche 5) : pour tous, dans les deux navigations, datée de la mise en ligne.
const questionnaires = NOUVEAUTES.find((e) => e.id === QUESTIONNAIRES_ID);
ok(!!questionnaires && questionnaires.pour === "tous" && questionnaires.date === "2026-11-09",
  "questionnaires : pour tous, du 09/11");
ok(/sans nom/.test(questionnaires.resume) && /Sans avis/.test(questionnaires.resume) && /Plus tard/.test(questionnaires.resume),
  "questionnaires : anonymat, « Sans avis » et « Plus tard » expliqués");
ok(/dans l'application, personne ne peut voir qui a répondu quoi/.test(questionnaires.resume)
  && /à partir de 5 réponses/.test(questionnaires.resume) && !/personne ne peut savoir/.test(questionnaires.resume),
  "questionnaires : la promesse s'arrête à l'application et au seuil (relecture finale, I1)");
ok(!/\bprofs?\b/i.test(tout(questionnaires)) && !tout(questionnaires).includes(String.fromCharCode(0x2014)),
  "questionnaires : « formateur », jamais « prof », et aucun tiret cadratin");
for (const formateur of [false, true]) {
  ok(ids(visibles(NOUVEAUTES, formateur)).includes(QUESTIONNAIRES_ID),
    `questionnaires : lue ${formateur ? "par un formateur" : "par un stagiaire"}`);
}

// === Lot 3 (date de la fusion) : l'app aux couleurs d'ECF ===
// Pour tous, un lien vers Mes préférences
// (la page de la personne, pour les deux espaces) et un guide qui mène au menu du compte, à Apparence, et dit comment revenir.
const couleurs = NOUVEAUTES.find((e) => e.id.endsWith("-couleurs-ecf"));
ok(!!couleurs && /^\d{4}-\d{2}-\d{2}$/.test(couleurs.date) && couleurs.id === couleurs.date + "-couleurs-ecf", "lot 3 : une date et un id préfixé par elle");
ok(couleurs.pour === "tous" && couleurs.titre === "L'app aux couleurs d'ECF",
  "lot 3 : « L'app aux couleurs d'ECF », pour tous");
eq(couleurs.ou, { label: "Mes préférences", route: "preferences" }, "lot 3 : Où le trouver, Mes préférences");
ok(couleurs.module === undefined, "lot 3 : aucun module ne la cache");
ok(Array.isArray(couleurs.guide) && couleurs.guide.length >= 3, "lot 3 : un « Comment faire » d'au moins trois étapes");
for (const motif of [/menu du compte/, /initiales/, /Apparence/, /« Couleurs ECF »/, /« ECSR Promo »/, /revenir/, /Mes préférences/]) {
  ok(motif.test(tout(couleurs)), `lot 3 : dit ${motif}`);
}
ok(!TUTOIEMENT.test(horsCitations(tout(couleurs))) && !VOUVOIEMENT.test(horsCitations(tout(couleurs))) && !/\bprofs?\b/i.test(tout(couleurs)),
  "lot 3 : pour tous, ni tu ni vous (décision du 10/11), « formateur », jamais « prof »");
ok(!/habillage|data-skin|thème|jeton|appareil|compte Supabase/i.test(tout(couleurs)), "lot 3 : pas de vocabulaire technique");
for (const formateur of [false, true]) {
  ok(ids(visibles(NOUVEAUTES, formateur)).includes(couleurs.id), `lot 3 : lue ${formateur ? "chez un formateur" : "chez un stagiaire"}`);
}

// Consignes « Comment faire » : les gestes de l'ancienne barre (tuile de l'Accueil, logo, Paramètres, espace personnel, onglet Thèmes,
// bouton Bénévoles du planning...) ne se lisent plus ; les guides réécrits pour la nouvelle barre sont devenus les seuls (phase 2, 11/11).
// « Livret EPCF » est redevenu un nom de la nouvelle barre (partie de Mon suivi, décision de Timy du 08/11) : seul le geste d'avant,
// le sous-onglet « Livret EPCF » de l'onglet Notes, est refusé.
const GESTE_D_AVANT = /Mon espace|espace personnel|Paramètres|tuile|logo|Ressources|Calendrier|bouton Priorités|Tableau de bord|pastille de la promo|onglet Notes|Modules de la promo|Aujourd'hui au planning|sous-onglet « Livret EPCF »|onglet Thèmes\.|Ouvre l'onglet Thèmes|Ouvre Cours,|Cours, sous-onglet|« Bénévoles » dans la barre/;
for (const e of NOUVEAUTES) {
  ok(e.guide === undefined || (Array.isArray(e.guide) && e.guide.length > 0 && e.guide.every((s) => typeof s === "string" && s.length > 0)),
    e.id + " : guide absent, ou liste de textes");
  ok(!GESTE_D_AVANT.test((e.guide || []).join(" ")), `${e.id} : le guide ne décrit pas l'ancienne barre`);
}
// Les consignes exactes des gestes réécrits (inventaire des textes, § 2.3).
// Au vous pour les formateurs, à l'infinitif pour tous (décision du 10/11).
eq(par("2026-10-23-tableau-de-bord-centre").guide[0], "Ouvrez Indicateurs, dans la barre de gauche (groupe Promo) ; sur téléphone, dans « Plus ».", "tableau de bord : Indicateurs");
eq(par("2026-10-05-effacement-donnees").guide[0], "L'effacement des données se demande maintenant au fondateur : transmettez-lui la demande de la personne, sans la marquer en abandon.",
  "effacement (05/10) : depuis le lot Q5, la demande se transmet au fondateur");
ok(!par("2026-10-05-effacement-donnees").guide.some((s) => /« Abandon » sur|« Effacer les données »/.test(s)),
  "effacement (05/10) : plus aucune étape vers « Abandon » ni vers le bouton « Effacer les données », qui n'existe plus");
eq(par("2026-10-05-effacement-donnees").titre, "Effacer les données d'un stagiaire, à sa demande", "effacement (05/10) : le titre daté est gardé");
ok(/Marquez-le d'abord en abandon/.test(par("2026-10-05-effacement-donnees").resume), "effacement (05/10) : le récit daté n'est pas réécrit");
eq(par("2026-10-03-page-stagiaires").guide[0], "Ouvrez Stagiaires, dans la barre de gauche (sur téléphone, en bas de l'écran).", "page Stagiaires : la barre de gauche");
eq(par("2026-07-31-dossier-professionnel").guide[0], "Ouvrir Mon suivi, dans la barre.", "dossier professionnel : Mon suivi");
eq(par("2026-07-19-livret-epcf").guide[0], "Ouvrir Mon suivi, partie Livret EPCF.", "livret : Mon suivi, partie Livret EPCF");
ok(par("2026-07-19-livret-epcf").guide.some((s) => /date de naissance/.test(s)), "livret : la date de naissance se renseigne toujours");
// « Signaler un problème » : le stagiaire a la ligne dans le menu de son compte (ses initiales, en haut à droite), l'équipe un bouton en bas
// de la barre de gauche sur ordinateur, dans « Plus » sur téléphone.
const signaler = par("2026-10-28-signaler-un-probleme");
const premiereEtape = signaler.guide[0];
ok(/les initiales/.test(premiereEtape) && /en haut à droite/.test(premiereEtape), "signaler : le stagiaire ouvre son compte par ses initiales, en haut à droite");
ok(/formateurs/.test(premiereEtape) && /en bas de la barre de gauche/.test(premiereEtape) && /ordinateur/.test(premiereEtape), "signaler : l'équipe, en bas de la barre de gauche sur ordinateur");
ok(/« Plus »/.test(premiereEtape) && /téléphone/.test(premiereEtape), "signaler : l'équipe, dans « Plus » sur téléphone");
ok(!/nom en haut/.test(signaler.guide.join(" ")), "signaler : plus « ton nom en haut de l'écran »");
ok(/Écrire ce qui se passe/.test(signaler.guide[signaler.guide.length - 1]), "signaler : la dernière étape est celle d'écrire le message");
ok(par("2026-10-03-deux-promos").guide.some((s) => /Touchez la promo en tête de la barre de gauche/.test(s)), "deux promos : la promo en tête de la barre de gauche");
ok(par("2026-10-03-deux-promos").guide.some((s) => /« Revenir aux modules de départ »/.test(s)), "deux promos : le bouton s'appelle Revenir aux modules de départ");
ok(par("2026-10-03-deux-promos").guide.some((s) => /Réglages, « Ce que voient les stagiaires »/.test(s)), "deux promos : le réglage des modules s'appelle Ce que voient les stagiaires");

// Le récit de la plus récente des Nouveautés d'avant le lancement : « le bouton de l'assistant », pas la bulle de l'ancienne navigation.
ok(/bouton de l'assistant/.test(par("2026-10-28-assistant-plus-facile").resume) && !/bulle/.test(par("2026-10-28-assistant-plus-facile").resume),
  "assistant plus facile : le bouton de l'assistant");

// === Annonces d'ouverture de module et explications du catalogue : un texte juste avec la barre d'aujourd'hui ===
// Ni « bouton en haut de l'écran », ni « onglet Notes », ni « bulle en bas de l'écran », ni « Paramètres », ni « Mon espace » : le catalogue génère
// les annonces, anciennes comprises, et il se lit aussi dans Réglages. Les liens « Où le trouver » suivent la navigation (ou-trouver.js).
const VIEUX_TEXTE = /bouton en haut|bulle|Paramètres|Mon espace|espace personnel|onglet Notes|onglet Évolution|dans Notes|en haut du Planning|bouton Priorités/i;
for (const m of MODULES) {
  for (const [quoi, texte] of [["explication", m.explication], ["titre de l'annonce", m.annonce.titre], ["annonce", m.annonce.resume]]) {
    ok(!VIEUX_TEXTE.test(texte), `${m.cle} : ${quoi} sans les mots de l'ancienne barre (« ${texte.slice(0, 40)}… »)`);
  }
}
const mod = (cle) => MODULES.find((m) => m.cle === cle);
// Audit du 09/11, lot B : plus de bouton « Aujourd'hui » dans le Planning de la nouvelle barre ; la journée du jour y est repérée dans les deux.
eq(mod("planning").annonce.resume.endsWith("La journée du jour y est repérée."), true, "Planning : la journée du jour repérée");
eq(mod("priorites").explication, "Qui doit passer en priorité, en salle et en voiture, dans le Planning.", "Ordre de passage : explication");
ok(mod("priorites").annonce.resume.startsWith("Dans le Planning, Ordre de passage montre qui doit passer en premier"), "Ordre de passage : annonce");
eq(mod("notes").explication, "Matrice des notes, courbe d'évolution de chaque stagiaire, anonymat.", "Notes : explication");
eq(mod("notes").annonce.resume, "Les notes de thèmes s'affichent avec la synthèse de la classe, et une courbe trace la progression de "
  + "chaque stagiaire. Chaque stagiaire peut masquer son prénom et ses notes aux autres dans Mes préférences.",
  "Notes : annonce, Mes préférences (page de la personne, jamais Réglages)");
ok(mod("epcf").explication.includes("Celles du stagiaire dans son suivi") && mod("epcf").explication.includes("les moyennes de la classe avec les notes"), "EPCF : explication");
eq(mod("epcf").annonce.resume, "Les résultats des EPCF (évaluations passées en cours de formation) du CCP1, en salle et en véhicule, "
  + "s'affichent dans l'app, avec les moyennes de la classe.", "EPCF : annonce, le sigle défini");
ok(mod("livret").explication.includes("le stagiaire le consulte dans son suivi") && mod("livret").explication.includes("le formateur évaluateur le remplit"),
  "Livret EPCF : explication (le stagiaire consulte, le formateur évaluateur remplit)");
ok(mod("livret").annonce.resume.startsWith("Le livret EPCF officiel de chaque stagiaire se consulte dans l'app"), "Livret EPCF : annonce");
ok(mod("dp").explication.includes("celui du stagiaire dans son suivi"), "Dossier professionnel : explication");
eq(mod("assistant").explication, "Assistant qui répond sur les cours et le Code de la route.", "Assistant : explication");
ok(mod("assistant").annonce.resume.startsWith("L'assistant répond aux questions sur les cours et le Code de la route."), "Assistant : annonce");
// Dates clés et Documents (11/11) : leurs libellés « Où le trouver » sont ceux de la barre ; les autres gardent leur forme de main,
// que ouSelonNavigation réécrit.
eq(mod("calendrier").nom, "Dates clés", "calendrier : nommé Dates clés");
eq(mod("ressources").nom, "Documents", "ressources : nommé Documents");
eq(mod("calendrier").annonce.ou.label, "Planning, Dates clés", "Dates clés : libellé de la barre");
eq(mod("ressources").annonce.ou.label, "Cours et QCM, Documents", "Documents : libellé de la barre");
for (const m of MODULES) {
  const textes = [m.explication, m.annonce?.titre, m.annonce?.resume, m.annonce?.ou?.label].filter(Boolean).join(" ");
  ok(!/Mon espace personnel|compte à rebours|Onglet Cours|onglet Cours/.test(textes), m.cle + " : ni Mon espace personnel, ni compte à rebours, ni onglet Cours");
}
// Les annonces sont envoyées à tous (pour: "tous") : ni tu ni vous (décision du 10/11). Les explications se lisent dans Réglages,
// par l'équipe : jamais de tutoiement.
for (const m of MODULES) {
  for (const [quoi, texte] of [["titre de l'annonce", m.annonce.titre], ["annonce", m.annonce.resume]]) {
    ok(!TUTOIEMENT.test(horsCitations(texte)) && !VOUVOIEMENT.test(horsCitations(texte)), `${m.cle} : ${quoi} neutre, ni tu ni vous (« ${texte.slice(0, 40)}… »)`);
  }
  ok(!TUTOIEMENT.test(horsCitations(m.explication)), `${m.cle} : explication sans tutoiement`);
}

// === Le ton de toutes les Nouveautés (décision du 10/11) ===
// Stagiaires : tutoiement ; formateurs : vouvoiement ; pour tous : formule neutre, ni tu ni vous. Les liens « Où le trouver »
// (réécrits par ou-trouver.js) gardent leur texte. Les citations entre guillemets français (noms de boutons, SMS à envoyer)
// ne comptent pas.
const luDansLApp = (e) => horsCitations([e.titre, e.resume, ...(e.guide || [])].join(" "));
for (const e of NOUVEAUTES) {
  const texte = luDansLApp(e);
  if (e.pour === "stagiaires") ok(!VOUVOIEMENT.test(texte), `${e.id} : pour les stagiaires, tutoiement, jamais de vouvoiement`);
  if (e.pour === "formateurs") ok(!TUTOIEMENT.test(texte), `${e.id} : pour les formateurs, vouvoiement, jamais de tutoiement`);
  if (e.pour === "tous") ok(!TUTOIEMENT.test(texte) && !VOUVOIEMENT.test(texte), `${e.id} : pour tous, ni tu ni vous`);
}
// Les deux entrées reprises explicitement.
ok(/si vous remettez la note d'avant/.test(par("2026-11-09-notes-finitions").resume)
  && /une fenêtre de l'app vous demande confirmation/.test(par("2026-11-09-notes-finitions").resume), "notes, finitions : au vous");
ok(par("2026-11-10-confirmations-dans-l-app").resume.startsWith("Quand l'app demande de confirmer un geste"), "confirmations : formule neutre");

// === Les mots du lot D (10/11) : un nom par objet, dans tout ce que les Nouveautés montrent ===
// Questions contestées et contestations (plus de « signalement » de QCM), Dossier professionnel, Livret EPCF, onglet (plus de
// sous-onglet), Recharger les données, Revenir aux modules de départ, difficultés (plus de signaux), Ordre de passage.
const MOTS_D_AVANT = /signalement|sous-onglet|Dossier pro\b|dossier pro\b|\bDP\b|« Actualiser »|signaux|Partir de l'ensemble de départ|« Ouvrir l'examen »|« Corrigé »|« Rien à corriger »|« Ouvrir »|les priorités/;
for (const e of NOUVEAUTES) {
  const texte = [e.titre, e.resume, ...(e.guide || [])].join(" ");
  const trouve = texte.match(MOTS_D_AVANT);
  ok(!trouve, `${e.id} : les mots décidés le 10/11${trouve ? " (reste « " + trouve[0] + " »)" : ""}`);
}
const console_ = par("2026-08-08-console-signalements");
ok(/Questions contestées/.test(console_.titre + console_.resume) && /« Question corrigée »/.test(console_.guide.join(" "))
  && /« Pas d'erreur »/.test(console_.guide.join(" ")), "questions contestées : le nom de l'onglet et les deux boutons");
eq(console_.ou.label, "Cours, onglet Questions contestées", "questions contestées : Où le trouver");
// Le livret EPCF : le stagiaire le consulte, le formateur évaluateur le remplit (décision du 10/11).
const livretEpcf = par("2026-07-19-livret-epcf");
ok(/formateur évaluateur/.test(livretEpcf.resume) && /consulte/.test(livretEpcf.resume) && !/se remplit/.test(livretEpcf.titre),
  "livret EPCF : rempli par le formateur évaluateur, consulté par le stagiaire");
ok(livretEpcf.guide.some((s) => /^Consulter le livret EPCF/.test(s)) && !livretEpcf.guide.some((s) => /Rempli/.test(s)),
  "livret EPCF : l'étape est de le consulter, plus de le remplir");
// Les liens vers les parties renommées de Mon suivi.
for (const e of NOUVEAUTES.filter((x) => x.ou && x.ou.route === "mon-suivi")) {
  ok(!/partie (Livret|EPCF|Dossier pro)$/.test(e.ou.label), `${e.id} : lien vers une partie au nom décidé (« ${e.ou.label} »)`);
}
eq(mod("notes").annonce.ou.label, "Notes", "Notes : libellé d'avant, réécrit par ouSelonNavigation");

// === Lot 5 : audiences par espace (direction, siège), Nouveautés des nouveaux espaces ===
// `visibles(entrees, formateur, espace)` : l'espace est facultatif ; sans lui, rien ne change pour le stagiaire et le
// formateur (une app d'avant), et une entrée « direction » ou « siege » ne se lit nulle part.
const ESP = [
  { id: "t", date: "2026-11-09", pour: "tous" },
  { id: "f", date: "2026-11-09", pour: "formateurs" },
  { id: "s", date: "2026-11-09", pour: "stagiaires" },
  { id: "d", date: "2026-11-09", pour: "direction" },
  { id: "g", date: "2026-11-09", pour: "siege" },
];
eq(ids(visibles(ESP, true, "equipe")), ["t", "f"], "espace formateur : tous et formateurs, ni direction ni siège");
eq(ids(visibles(ESP, false, "stagiaire")), ["t", "s"], "espace stagiaire : tous et stagiaires");
eq(ids(visibles(ESP, true, "direction")), ["t", "d"], "espace direction : tous et direction, ni formateurs ni stagiaires ni siège");
eq(ids(visibles(ESP, false, "direction")), ["t", "d"], "espace direction, sans droit de formateur : pas les stagiaires non plus");
eq(ids(visibles(ESP, false, "siege")), ["t", "g"], "espace siège : tous et siège");
eq(ids(visibles(ESP, true, "siege")), ["t", "g"], "espace siège, avec droit de formateur : seulement tous et siège");
eq(ids(visibles(ESP, true)), ["t", "f"], "sans espace (appelant d'avant) : comme avant, aucune entrée de direction ni de siège");
eq(ids(visibles(ESP, false)), ["t", "s"], "sans espace, stagiaire : comme avant");
eq(ids(visibles(ESP, true, "n'importe quoi")), ["t"], "espace inconnu : seulement les entrées pour tous");
ok(ids(visibles(ESP, true, "stagiaire")).join() === "t", "un formateur dans l'espace stagiaire ne lit pas les entrées qui mènent à des pages de formateur");

// Les Nouveautés réelles du lot 5.
const direction = NOUVEAUTES.find((e) => e.id === "2026-11-10-espace-direction");
const siege = NOUVEAUTES.find((e) => e.pour === "siege");
const menuEspace = NOUVEAUTES.find((e) => e.id.endsWith("-menu-espace"));
const changerPromo = NOUVEAUTES.find((e) => e.id.endsWith("-changer-de-promo"));
const DATE5 = direction.date;
eq(NOUVEAUTES.filter((e) => e.pour === "direction").map((e) => e.id).sort(),
  ["2026-11-10-espace-direction", "2026-11-11-conservation-direction", "2026-11-11-donnees-personnelles-centre",
    "2026-11-14-resultats-jury-direction"],
  "quatre Nouveautés pour la direction : l'espace, les données personnelles, la conservation des fiches de son centre, puis le taux d'obtention du titre");
// Conservation des fiches ouverte à la direction (11/11) : pour la direction seule, en tête de sa liste, au vouvoiement.
const consDir = NOUVEAUTES.find((e) => e.id === "2026-11-11-conservation-direction");
ok(!!consDir && consDir.date === "2026-11-11" && consDir.pour === "direction" && consDir.ou?.route === "config"
  && consDir.ou?.label === "Réglages du centre", "conservation de la direction : datée du 11/11, pour la direction, mène aux Réglages du centre");
// Jugée parmi les entrées de son jour et d'avant (une Nouveauté pour tous d'un jour suivant passe devant).
eq(ids(triees(visibles(NOUVEAUTES.filter((e) => e.date <= consDir.date), true, "direction")))[0], consDir.id,
  "conservation de la direction : la plus récente dans l'espace direction");
for (const espace of [undefined, "equipe", "stagiaire", "siege"]) {
  ok(!ids(visibles(NOUVEAUTES, true, espace)).includes(consDir.id) && !ids(visibles(NOUVEAUTES, false, espace)).includes(consDir.id),
    `conservation de la direction : jamais hors de l'espace direction (${espace})`);
}
ok(Array.isArray(consDir.guide) && consDir.guide.length >= 3 && /vous|ouvrez/i.test(tout(consDir)) && !TUTOIEMENT.test(horsCitations(tout(consDir)))
  && !/\bprofs?\b/i.test(tout(consDir)) && !tout(consDir).includes(CADRATIN) && !/#[0-9a-f]{3,6}\b/i.test(tout(consDir)),
  "conservation de la direction : trois étapes au moins, vouvoiement, « formateur », sans tiret cadratin ni couleur");
for (const motif of [/Conservation des fiches/, /12 mois/, /31 décembre de la troisième année/, /votre clic/, /EFFACER/, /fondateur/]) {
  ok(motif.test(tout(consDir)), `conservation de la direction : dit ${motif}`);
}
eq(NOUVEAUTES.filter((e) => e.pour === "siege").length, 1, "une seule Nouveauté pour le siège");
ok(direction.titre === "Votre espace de direction" && siege.titre === "L'espace du siège", "titres : « Votre espace de direction », « L'espace du siège »");
ok(!!menuEspace && menuEspace.pour === "formateurs", "menu Espace : pour les formateurs");
ok(!!changerPromo && changerPromo.pour === "stagiaires" && changerPromo.titre === "Changer de promo",
  "Changer de promo : pour les stagiaires");
for (const e of [direction, siege, menuEspace, changerPromo]) {
  ok(/^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.id.startsWith(e.date + "-"), e.id + " : id préfixé par sa date");
  eq(e.date, DATE5, e.id + " : même date que les autres entrées du lot (posée à la fusion)");
  ok(Array.isArray(e.guide) && e.guide.length >= 3, e.id + " : un « Comment faire » d'au moins trois étapes");
  // Le ton (décision du 10/11) : l'équipe (direction, siège, formateurs) est vouvoyée, le stagiaire tutoyé.
  if (e === changerPromo) ok(!VOUVOIEMENT.test(horsCitations(tout(e))), e.id + " : pour les stagiaires, tutoiement");
  else ok(!TUTOIEMENT.test(horsCitations(tout(e))), e.id + " : pour l'équipe, vouvoiement, jamais de tutoiement");
  ok(!/\bprofs?\b/i.test(tout(e)), e.id + " : « formateur » jamais « prof »");
  ok(!tout(e).includes(CADRATIN), e.id + " : aucun tiret cadratin");
  ok(!/#[0-9a-f]{3,6}\b/i.test(tout(e)), e.id + " : aucune couleur écrite");
}
// Suite du lot 5 : les données personnelles dans les Réglages du centre (texte de l'équipe, au vouvoiement).
const donnees = NOUVEAUTES.find((e) => e.id === "2026-11-11-donnees-personnelles-centre");
ok(!!donnees && donnees.date === "2026-11-11" && donnees.pour === "direction" && donnees.titre === "Données personnelles dans les Réglages du centre",
  "données personnelles : datée du 11/11, pour la direction, titre attendu");
ok(donnees.ou && donnees.ou.route === "config" && donnees.ou.label === "Réglages du centre", "données personnelles : mène aux Réglages du centre");
ok(Array.isArray(donnees.guide) && donnees.guide.length >= 3, "données personnelles : un « Comment faire » d'au moins trois étapes");
ok(/vous|ouvrez/i.test(tout(donnees)) && !TUTOIEMENT.test(horsCitations(tout(donnees))), "données personnelles : vouvoiement (texte de l'équipe)");
ok(!/\bprofs?\b/i.test(tout(donnees)) && !tout(donnees).includes(CADRATIN) && !/#[0-9a-f]{3,6}\b/i.test(tout(donnees)), "données personnelles : « formateur » jamais « prof », aucun tiret cadratin, aucune couleur");
for (const motif of [/Données personnelles/, /Conservation des fiches/, /fondateur/, /page Qualiopi/, /Élèves bénévoles/, /ancien stagiaire/]) {
  ok(motif.test(tout(donnees)), `données personnelles : dit ${motif}`);
}
// Réconciliation avec Q5 (11/11) : plus d'anonymisation par la direction, la Nouveauté ne mène plus vers un bouton disparu.
ok(!/Anonymiser la promo|ANONYMISER|anonymisez/.test(tout(donnees)), "données personnelles : plus aucune étape vers « Anonymiser la promo »");
ok(lesEspacesDonnees("direction") && !lesEspacesDonnees("siege") && !lesEspacesDonnees("equipe") && !lesEspacesDonnees("stagiaire"), "données personnelles : lue dans l'espace direction seulement");
function lesEspacesDonnees(espace) { return ids(visibles(NOUVEAUTES, true, espace)).includes(donnees.id); }
// Qui voit quoi, sur les vraies entrées.
const lesEspaces = (formateur, espace) => ids(visibles(NOUVEAUTES, formateur, espace));
ok(lesEspaces(true, "direction").includes(direction.id) && !lesEspaces(true, "direction").includes(siege.id), "direction : sa Nouveauté, pas celle du siège");
ok(lesEspaces(true, "siege").includes(siege.id) && !lesEspaces(true, "siege").includes(direction.id), "siège : sa Nouveauté, pas celle de la direction");
for (const espace of ["equipe", "stagiaire"]) {
  for (const formateur of [true, false]) {
    ok(!lesEspaces(formateur, espace).includes(direction.id) && !lesEspaces(formateur, espace).includes(siege.id),
      `espace ${espace} (formateur ${formateur}) : ni la direction ni le siège`);
  }
}
for (const espace of ["direction", "siege"]) {
  const vues = lesEspaces(true, espace);
  ok(!vues.includes(menuEspace.id) && !vues.some((id) => NOUVEAUTES.find((e) => e.id === id).pour === "formateurs"),
    `espace ${espace} : aucune entrée pour formateurs (leurs liens mènent à des pages de l'espace formateur)`);
  ok(!vues.some((id) => NOUVEAUTES.find((e) => e.id === id).pour === "stagiaires"), `espace ${espace} : aucune entrée pour stagiaires`);
}
ok(lesEspaces(true, "equipe").includes(menuEspace.id) && !lesEspaces(true, "equipe").includes(changerPromo.id), "formateur : le menu Espace, pas Changer de promo");
ok(lesEspaces(false, "stagiaire").includes(changerPromo.id) && !lesEspaces(false, "stagiaire").includes(menuEspace.id), "stagiaire : Changer de promo, pas le menu Espace");
// Les mots de l'écran (Task 7 à 14) et du menu du compte.
for (const motif of [/Vue d'ensemble/, /Promos/, /Stagiaires/, /Émargement/, /Notes et examens/, /Équipe/, /Créer une promo/, /Inviter un formateur/]) {
  ok(motif.test(tout(direction)), `direction : dit ${motif}`);
}
for (const motif of [/Vue d'ensemble/, /sans aucun nom/, /Directions de centre/, /Ajouter un centre/, /Inviter une direction/, /Cours et QCM/, /moins de 5/]) {
  ok(motif.test(tout(siege)), `siège : dit ${motif}`);
}
ok(/« Espace »/.test(tout(menuEspace)) && /menu de votre compte/.test(tout(menuEspace)), "menu Espace : « Espace » dans le menu du compte");
ok(/« Changer de promo »/.test(tout(changerPromo)) && /menu de ton compte/.test(tout(changerPromo)), "Changer de promo : dans le menu du compte");
ok(!/(direction|siège)/i.test(tout(changerPromo)), "Changer de promo : ne parle pas des espaces de pilotage");
// Aucun lien « Où le trouver » qui serait réécrit à tort : « centre » devient « Indicateurs » sous la nouvelle barre (formateur).
ok(!direction.ou || direction.ou.route !== "centre", "direction : pas de lien vers la route centre (réécrit « Indicateurs » par ou-trouver)");
// Triées avec les autres du même jour : les entrées du lot 2B passent d'abord (l'Accueil du stagiaire montre la première).
eq(ids(triees(JUSQU_AU_LOT(visibles(NOUVEAUTES, false, "stagiaire"))))[0], journee.id, "stagiaire : la plus récente du lot 2B reste la journée");

// Aucune impasse : en direction et au siège, toute entrée montrée (tous les cas d'audience, tous les droits) a un lien permis par l'espace.
for (const espace of ["direction", "siege"]) {
  for (const formateur of [true, false]) {
    const montrees = visibles(NOUVEAUTES, formateur, espace);
    ok(montrees.length > 0, `${espace} : au moins une entrée`);
    for (const e of montrees) {
      ok(!e.ou || !e.ou.route || routeDansLEspace(espace, e.ou.route), `${espace} : ${e.id} ne mène pas hors de l'espace (${e.ou && e.ou.route})`);
    }
  }
  ok(!visibles(NOUVEAUTES, true, espace).some((e) => e.pour === "tous" && e.ou && e.ou.route === "mon-suivi"), `${espace} : un lien vers Mon suivi est masqué`);
}
eq(ids(visibles([{ id: "a", date: "2026-11-09", pour: "tous", ou: { label: "x", route: "planning" } }, { id: "b", date: "2026-11-09", pour: "tous" },
  { id: "c", date: "2026-11-09", pour: "tous", ou: { label: "x", route: "nouveautes" } }], false, "direction")), ["b", "c"], "direction : lien refusé masqué, sans lien et page permise gardés");
eq(ids(visibles([{ id: "a", date: "2026-11-09", pour: "tous", ou: { label: "x", route: "planning" } }], false, "equipe")), ["a"], "formateur : inchangé");

console.log(`nouveautes : ${n} assertions OK`);
