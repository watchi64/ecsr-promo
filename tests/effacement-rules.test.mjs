// Effacement des données : confirmation, textes d'état. Lancer depuis la racine du dépôt :
// node tests/effacement-rules.test.mjs
import assert from "node:assert/strict";
import {
  confirmationValide, echeancesConservation, resumeEffacement, statutFiche, CE_QUI_PART, CE_QUI_RESTE,
  confirmationEcheance, confirmationDemande, compteRenduConservation, rappelConservation, MOT_DE_CONFIRMATION,
  questionPurgerBenevoles, phrasePurges, phraseDePanne, phraseDEffacement, PHRASE_DONNEES_ECHEC, PHRASE_CONSERVATION,
} from "../js/effacement-rules.js";
import * as regles from "../js/effacement-rules.js";

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// Confirmation
ok(confirmationValide("Timy", "Timy"), "saisie exacte");
ok(confirmationValide("  timy ", "Timy"), "casse et espaces ignorés");
ok(!confirmationValide("Timi", "Timy"), "faute de frappe refusée");
ok(!confirmationValide("Helene", "Hélène"), "accents exigés");
ok(confirmationValide("hélène", "Hélène"), "accents en minuscules acceptés");
ok(!confirmationValide("", ""), "prénom vide jamais valide");
ok(!confirmationValide("", "   "), "prénom fait d'espaces : jamais valide");
ok(confirmationValide("Hélène".normalize("NFD"), "Hélène"), "NFC des deux côtés : accents tapés en deux signes acceptés");
ok(confirmationValide("hélène", "Hélène".normalize("NFD")), "NFC des deux côtés : prénom de la fiche en deux signes");
ok(!confirmationValide("Helene".normalize("NFD"), "Hélène"), "NFC : sans accent, toujours refusé");

// L'ancien bloc « Fin de promo » des Paramètres est retiré (lot Q5, tâche 7) : la page Qualiopi le remplace.
ok(!("etatFinDePromo" in regles), "etatFinDePromo n'existe plus");

// Compte rendu
eq(resumeEffacement({ deja: true }), "Ces données étaient déjà effacées.", "déjà fait");
const r = resumeEffacement({ comptes: 1, date_naissance: 1, livret: 1, dossier_pro: 0, fiche_suivi: 1, epcf_textes: 2, observations: 1, commentaires_passages: 0 });
ok(r.startsWith("Effacé : compte de connexion, date de naissance, livret EPCF, fiche de suivi, 3 commentaires."), "compte rendu détaillé");
ok(resumeEffacement({ dossier_pro: 1 }).startsWith("Effacé : dossier professionnel."), "le dossier professionnel, en toutes lettres");
ok(/sans nom/.test(resumeEffacement({})), "compte rendu minimal");

// Échéances de conservation (état renvoyé par etat_conservation())
const promo = (o = {}) => ({ id: "p1", nom: "Nîmes mars 2026", lieu_nom: "Nîmes", date_fin: "2026-12-11", etape1_du: "2027-12-11", etape2_du: "2030-01-01",
  a_effacer_etape1: 14, a_effacer_etape2: 0, comptes_equipe: 1, ...o });
const etat = (jour, promos, extra = {}) => ({ jour, promos, portees_formateurs: [], registre: null, ...extra });
const types = (l) => l.map((e) => e.type);

const e1 = echeancesConservation(etat("2027-12-10", [promo()]));
eq(types(e1), ["etape1"], "étape 1 listée");
eq([e1[0].du, e1[0].due, e1[0].restant, e1[0].bouton], ["2027-12-11", false, 1, null], "veille : pas due, un jour restant, pas de bouton");
const e2 = echeancesConservation(etat("2027-12-11", [promo()]));
eq([e2[0].due, e2[0].restant], [true, 0], "le jour dit : due");
ok(typeof e2[0].bouton === "string" && e2[0].bouton.length > 0, "due : le bouton a un libellé");
ok(e2[0].texte.includes("14 fiches"), "le texte donne le nombre de fiches");
ok(e2[0].texte.includes("compte d'équipe") || e2[0].texte.includes("comptes d'équipe"), "les comptes d'équipe sont mentionnés");
eq(echeancesConservation(etat("2027-12-11", [promo({ a_effacer_etape1: 0, comptes_equipe: 1 })])), [], "rien à faire, comptes d'équipe seuls : aucune échéance");

const e3 = echeancesConservation(etat("2030-01-01", [promo({ a_effacer_etape1: 0, a_effacer_etape2: 15 })]));
eq(types(e3), ["etape2"], "étape 2 listée");
eq([e3[0].du, e3[0].due], ["2030-01-01", true], "étape 2 : 01/01/2030");
eq(echeancesConservation(etat("2029-12-31", [promo({ a_effacer_etape1: 0, a_effacer_etape2: 15 })]))[0].due, false, "31/12/2029 : pas encore");

const sans = echeancesConservation(etat("2027-01-01", [promo({ date_fin: null, etape1_du: null, etape2_du: null })]));
eq(types(sans), ["date_fin_manquante"], "date de fin absente : une seule échéance");
eq([sans[0].bouton, sans[0].du, sans[0].due], [null, null, false], "sans date : ni bouton ni date");
ok(/date de fin/i.test(sans[0].texte), "le texte demande la date de fin");

const portee = { lieu_id: "l1", lieu_nom: "Nîmes", annee: 2026, participations: 3, cloture_du: "2027-01-01", commentaires: 4,
  commentaires_du: "2027-12-31", reponses: 5, fige: false, figeage_du: "2030-01-01" };
const ef = echeancesConservation(etat("2026-06-01", [], { portees_formateurs: [portee] }));
eq(types(ef), ["cloture_formateurs", "commentaires_formateurs", "figeage_formateurs"], "trois échéances formateurs");
eq(ef.map((e) => e.du), ["2027-01-01", "2027-12-31", "2030-01-01"], "dates formateurs 2026");
eq(types(echeancesConservation(etat("2026-06-01", [], { portees_formateurs: [{ ...portee, participations: 0, commentaires: 0, fige: true }] }))), [], "rien à faire côté formateurs");
ok(ef[0].texte.includes("(3 lignes)") && ef[1].texte.includes("(4 commentaires)"), "au seuil : les nombres sont cités");

// Sous le seuil (lot Q3) : la base ne donne que des drapeaux ; échéances listées, aucun nombre dans les textes.
const sousSeuil = { lieu_id: "l3", lieu_nom: "Alès", annee: 2026, a_participations: true, participations: null, cloture_du: "2027-01-01",
  close: false, a_commentaires: true, commentaires: null, commentaires_du: "2027-12-31", a_reponses: true, reponses: null,
  sous_seuil: true, fige: false, figeage_du: "2030-01-01" };
const es = echeancesConservation(etat("2030-01-01", [], { portees_formateurs: [sousSeuil] }));
eq(types(es), ["cloture_formateurs", "commentaires_formateurs", "figeage_formateurs"], "sous le seuil : les trois échéances restent listées");
for (const e of es) {
  ok(!/\(\d|\d+ (ligne|commentaire)/.test(e.texte.replace(/\d{4}|\d{1,2}(er)? [a-zéû]+ \d{4}/g, "")), "sous le seuil : aucun nombre cité : " + e.type);
  ok(typeof e.bouton === "string", "sous le seuil, échéance due : bouton " + e.type);
}
eq(types(echeancesConservation(etat("2030-01-01", [], { portees_formateurs: [{ ...sousSeuil, a_participations: false, a_commentaires: false, a_reponses: false, sous_seuil: false, fige: true }] }))), [], "drapeaux faux : rien à faire");

const er = echeancesConservation(etat("2026-06-01", [], { registre: { a_effacer: 2, a_clore: 1, efface: 0, prochaine_echeance: "2027-01-01" } }));
eq([types(er), er[0].due, er[0].du, er[0].bouton], [["registre"], true, "2026-06-01", "Vider le registre"], "registre dû : date du jour, bouton");
ok(/2 entrées closes/.test(er[0].texte), "registre dû : texte avec le nombre");
ok(!/à partir du ,|undefined/.test(er[0].texte), "registre dû : aucune date vide dans le texte : " + er[0].texte);
const erf = echeancesConservation(etat("2026-06-01", [], { registre: { a_effacer: 0, a_clore: 3, efface: 1, prochaine_echeance: "2027-01-01" } }));
eq([types(erf), erf[0].due, erf[0].du, erf[0].bouton], [["registre"], false, "2027-01-01", null], "registre futur : date de la prochaine échéance, sans bouton");
ok(/1er janvier 2027/.test(erf[0].texte), "registre futur : texte daté : " + erf[0].texte);
eq(echeancesConservation(etat("2026-06-01", [], { registre: { a_effacer: 0, a_clore: 2, efface: 0, prochaine_echeance: null } })), [], "registre sans échéance (a_clore seul) : rien");

// Tri : passées d'abord, puis par date
const tri = echeancesConservation(etat("2027-12-11", [
  promo({ id: "tard", nom: "B", etape1_du: "2028-02-01" }),
  promo({ id: "pile", nom: "A", etape1_du: "2027-12-11" }),
  promo({ id: "retard", nom: "C", etape1_du: "2027-06-01" }),
]));
eq(tri.map((e) => e.cible.id), ["retard", "pile", "tard"], "passées d'abord, puis par date");
ok(tri[0].restant < 0, "en retard : restant négatif");

// Statut d'une fiche
eq(statutFiche({ actif: true }, false, false), "En formation", "en cours");
eq(statutFiche({ actif: true }, true, false), "Formation suivie", "promo terminée");
eq(statutFiche({ actif: false }, false, false), "Abandon", "abandon");
eq(statutFiche({ actif: false }, true, true), "Fiche effacée à la demande de la personne", "la demande prime");
eq(statutFiche({ actif: true }, false, true), "Fiche effacée à la demande de la personne", "la demande prime aussi sur une fiche active");

// Compte rendu étendu
ok(resumeEffacement({ emargement_observations: 2, signatures: 3, commentaires_questionnaires: 1 }).includes("3 signatures"), "signatures citées");
ok(/observations? d'émargement/.test(resumeEffacement({ emargement_observations: 2 })), "observations d'émargement citées");
ok(/commentaire/.test(resumeEffacement({ commentaires_questionnaires: 1 })), "commentaires de questionnaire cités");
const rs = resumeEffacement({ fiches: 3, questionnaires_commentaires_effaces: true });
ok(rs.includes("commentaires de questionnaire") && !/\d+ commentaires? de questionnaire/.test(rs), "sous le seuil : commentaires de questionnaire cités sans nombre");

// Accords et textes exacts (relecture de la tâche 1, reprise en tâche 7)
ok(e2[0].texte.includes("14 fiches perdent leur compte") && e2[0].texte.includes("leurs adresses e-mail"), "pluriel : « 14 fiches perdent leur compte » : " + e2[0].texte);
const un = echeancesConservation(etat("2027-12-11", [promo({ a_effacer_etape1: 1, comptes_equipe: 0 })]))[0];
ok(un.texte.includes("1 fiche perd son compte") && un.texte.includes("ses adresses e-mail") && !/compte d'équipe/.test(un.texte), "singulier : « 1 fiche perd son compte », sans note d'équipe : " + un.texte);
// La date de fin est dite sur la carte et dans la fenêtre de chaque étape (relecture finale) : une année fausse se voit.
for (const e of [un, ...echeancesConservation(etat("2030-01-01", [promo({ date_fin: "2026-12-01", a_effacer_etape1: 1, a_effacer_etape2: 2 })])),
  ...echeancesConservation(etat("2030-01-01", [promo({ date_fin: "2026-12-01", a_effacer_etape1: 0, a_effacer_etape2: 0, emargement_etape2: 3 })]))]) {
  ok(/\(formation finie le 1(1|er) décembre 2026\)/.test(e.texte) && /\(formation finie le /.test(confirmationEcheance(e)?.phrase ?? e.texte),
    e.type + " : la date de fin dans la carte et dans la fenêtre : " + e.texte);
}
ok(/le livret et les signatures restent/.test(un.texte), "étape 1 : ce qui reste est dit");
ok(e3[0].texte.includes("15 fiches perdent leur nom") && /« Formateur 1 », « Formateur 2 »/.test(e3[0].texte), "étape 2 : pluriel et formateurs renommés : " + e3[0].texte);
for (const motif of [/compte de connexion et l'adresse e-mail/, /date de naissance/, /fiche de suivi/, /textes libres/, /observations et les adresses e-mail des stagiaires sur les feuilles d'émargement/, /commentaires écrits dans les questionnaires/]) {
  ok(e2[0].part.some((x) => motif.test(x)), "étape 1, ce qui part : " + motif);
}
for (const motif of [/nom et le prénom/, /résultats/, /dossier professionnel et le livret/, /présence, heures et signatures/]) {
  ok(e2[0].reste.some((x) => motif.test(x)), "étape 1, ce qui reste : " + motif);
}
ok(!e2[0].part.some((x) => /adresses e-mail des feuilles/.test(x)), "étape 1 : seules les adresses des stagiaires partent (celles des formateurs à l'étape 2)");
for (const motif of [/« Anonyme »/, /dossier professionnel/, /livret EPCF/, /dessins des signatures/, /« Formateur 1 », « Formateur 2 »/, /pourcentages de la promo/, /étape des 12 mois/,
  /adresses e-mail encore inscrites sur les feuilles d'émargement, dont celles des formateurs/, /textes libres écrits depuis l'étape des 12 mois/]) {
  ok(e3[0].part.some((x) => motif.test(x)), "étape 2, ce qui part : " + motif);
}
ok(e3[0].reste.some((x) => /Signature effacée \(durée de conservation\)/.test(x)), "étape 2 : la feuille dit « Signature effacée (durée de conservation) »");
eq(e2[0].part, CE_QUI_PART.etape1, "la carte reprend la liste de ce qui part");
eq(e2[0].reste, CE_QUI_RESTE.etape1, "et celle de ce qui reste");
ok(ef[2].texte.includes("pourcentages du centre") && !/du lieu/.test(ef.map((e) => e.texte).join(" ")), "formateurs : « pourcentages du centre », jamais « du lieu »");
eq(echeancesConservation(null), [], "état nul : aucune échéance");
eq(echeancesConservation({}), [], "état vide : aucune échéance");
const fut = echeancesConservation(etat("2026-06-01", [promo({ a_effacer_etape2: 3 })], { portees_formateurs: [portee] }));
ok(fut.length === 5 && fut.every((e) => e.bouton === null && !e.due), "rien de dû : aucun bouton, sur toutes les sortes");
const deux = echeancesConservation(etat("2030-01-01", [promo({ a_effacer_etape1: 2, a_effacer_etape2: 6 })]));
eq(types(deux), ["etape1", "etape2"], "les deux étapes d'une même promo, dues, l'étape 1 d'abord");
ok(deux.every((e) => typeof e.bouton === "string"), "les deux ont leur bouton");
// Étape 2 sans fiche à anonymiser, mais des signatures de formateurs à effacer sur les feuilles (minor de la tâche 2).
const signatures = echeancesConservation(etat("2030-01-01", [promo({ a_effacer_etape1: 0, a_effacer_etape2: 0, emargement_etape2: 4 })]));
eq(types(signatures), ["etape2"], "feuilles seules : l'étape 2 reste listée");
ok(/« Formateur 1 »/.test(signatures[0].texte) && !/\d+ fiches?/.test(signatures[0].texte), "feuilles seules : le texte parle des signatures, pas de fiches");

// Confirmations : exactement ce qui part et ce qui reste, et une saisie.
eq(MOT_DE_CONFIRMATION, "EFFACER", "le mot à taper");
const c1 = confirmationEcheance(e2[0]);
ok(c1 && /« Nîmes mars 2026 »/.test(c1.titre) && /Irréversible\.$/.test(c1.phrase), "étape 1 : titre avec la promo, phrase qui finit par « Irréversible. »");
eq([c1.part, c1.reste, c1.oui], [CE_QUI_PART.etape1, CE_QUI_RESTE.etape1, e2[0].bouton], "étape 1 : listes et bouton de l'échéance");
eq([c1.saisie.consigne, c1.saisie.attendu], ["Pour confirmer, tapez EFFACER", "EFFACER"], "étape 1 : saisie du mot EFFACER");
ok(confirmationValide("effacer", c1.saisie.attendu) && !confirmationValide("EFFACE", c1.saisie.attendu), "la saisie se vérifie par confirmationValide");
ok(typeof c1.saisie.verifier === "function" && c1.saisie.verifier(" effacer ") && !c1.saisie.verifier("EFFACE") && !c1.saisie.verifier(""),
  "la fenêtre reçoit la vérification (confirmationValide) : js/confirmer.js n'active le bouton qu'avec elle");
eq(confirmationEcheance(e1[0]), null, "échéance pas encore due : pas de confirmation");
eq(confirmationEcheance(er[0]), null, "registre : pas de confirmation ici (son propre bouton)");
eq(confirmationEcheance(sans[0]), null, "promo sans date : pas de confirmation");
ok(/questionnaire des formateurs 2026, Alès/.test(confirmationEcheance(es[2]).titre), "formateurs : le titre nomme l'année et le centre");
eq(confirmationEcheance(es[2]).part, CE_QUI_PART.figeage_formateurs, "figeage : sa liste");
const cd = confirmationDemande({ id: 4, prenom: "Hélène", nom: "Durand" });
ok(cd.titre === "Effacer les données de Hélène Durand ?" && /sans la déclarer en abandon/.test(cd.phrase), "demande : titre et phrase");
eq(cd.saisie.attendu, "Hélène", "demande : on tape le prénom");
ok(cd.saisie.verifier("hélène") && !cd.saisie.verifier("Helene") && cd.saisie.verifier("Hélène".normalize("NFD")), "demande : la vérification du prénom (casse, accents, NFC)");
// Fiche sans prénom (relecture finale) : la saisie attendue n'est jamais vide, on tape EFFACER.
for (const prenom of ["", "   ", null, undefined]) {
  const vide = confirmationDemande({ id: 9, prenom, nom: "Martin" });
  ok(vide.saisie.attendu === "EFFACER" && vide.saisie.consigne === "Pour confirmer, tapez EFFACER" && vide.saisie.verifier("effacer")
    && !vide.saisie.verifier(""), "demande, prénom " + JSON.stringify(prenom) + " : on tape EFFACER");
}
ok(cd.part.some((x) => /dossier professionnel et le livret/.test(x)) && cd.part.some((x) => /dessins des signatures/.test(x)), "demande : dossier, livret et signatures partent");
ok(cd.reste.some((x) => /fiche effacée à la demande de la personne/.test(x)) && cd.reste.some((x) => /pas comptée en abandon/.test(x)), "demande : ni abandon, ligne à part");

// Phrases entières des fenêtres de confirmation (correction 1 de la relecture de la tâche 7) : chacun des six gestes, au singulier
// et au pluriel, mot pour mot. Une faute d'accord (« son fiche de suivi ») ne passe plus par un test de fragments.
const jourDu = (jour, promos, extra) => echeancesConservation(etat(jour, promos, extra));
const phrase = (e) => confirmationEcheance(e).phrase;
const p1 = (o) => promo({ comptes_equipe: 0, ...o });
eq(phrase(jourDu("2027-12-11", [p1({ a_effacer_etape1: 1 })])[0]),
  "Nîmes mars 2026 (formation finie le 11 décembre 2026) : à partir du 11 décembre 2027, 12 mois après la fin de la formation, 1 fiche perd son compte, ses adresses e-mail, "
  + "sa fiche de suivi et ses textes libres. Le nom, les résultats, le dossier professionnel, le livret et les signatures restent. Irréversible.",
  "étape 1, une fiche : la phrase entière");
eq(phrase(jourDu("2027-12-11", [p1({ a_effacer_etape1: 14, comptes_equipe: 1 })])[0]),
  "Nîmes mars 2026 (formation finie le 11 décembre 2026) : à partir du 11 décembre 2027, 12 mois après la fin de la formation, 14 fiches perdent leur compte, leurs adresses e-mail, "
  + "leur fiche de suivi et leurs textes libres. Le nom, les résultats, le dossier professionnel, le livret et les signatures restent. "
  + "Le compte d'équipe n'est jamais effacé et n'est pas compté. Irréversible.",
  "étape 1, plusieurs fiches (et un compte d'équipe) : la phrase entière");
eq(phrase(jourDu("2030-01-01", [p1({ a_effacer_etape1: 0, a_effacer_etape2: 1 })])[0]),
  "Nîmes mars 2026 (formation finie le 11 décembre 2026) : à partir du 1er janvier 2030, fin de la 3e année après la formation, 1 fiche perd son nom, son dossier professionnel, "
  + "son livret et ses signatures ; sur les feuilles d'émargement, les formateurs deviennent « Formateur 1 », « Formateur 2 »… "
  + "Les résultats et les heures restent, sans nom. Irréversible.",
  "étape 2, une fiche : la phrase entière");
eq(phrase(jourDu("2030-01-01", [p1({ a_effacer_etape1: 0, a_effacer_etape2: 6, comptes_equipe: 2 })])[0]),
  "Nîmes mars 2026 (formation finie le 11 décembre 2026) : à partir du 1er janvier 2030, fin de la 3e année après la formation, 6 fiches perdent leur nom, leur dossier professionnel, "
  + "leur livret et leurs signatures ; sur les feuilles d'émargement, les formateurs deviennent « Formateur 1 », « Formateur 2 »… "
  + "Les résultats et les heures restent, sans nom. Les 2 comptes d'équipe ne sont jamais effacés et ne sont pas comptés. Irréversible.",
  "étape 2, plusieurs fiches (et deux comptes d'équipe) : la phrase entière");
eq(phrase(jourDu("2030-01-01", [p1({ a_effacer_etape1: 0, a_effacer_etape2: 0, emargement_etape2: 4 })])[0]),
  "Nîmes mars 2026 (formation finie le 11 décembre 2026) : à partir du 1er janvier 2030, fin de la 3e année après la formation, les signatures qui restent sur les feuilles "
  + "d'émargement sont effacées ; les formateurs y deviennent « Formateur 1 », « Formateur 2 »… Les heures restent. Irréversible.",
  "étape 2, feuilles seules : la phrase entière");
// Demande de la personne : une seule fiche par geste ; titre et phrase entiers, avec et sans nom de famille.
const dm = confirmationDemande({ id: 4, prenom: "Hélène", nom: "Durand" });
eq([dm.titre, dm.phrase], ["Effacer les données de Hélène Durand ?",
  "À la demande de la personne : tout part tout de suite, sans attendre les dates de conservation, et sans la déclarer en abandon. Irréversible."],
  "demande : titre et phrase entiers");
eq(confirmationDemande({ id: 5, prenom: "Yanis", nom: null }).titre, "Effacer les données de Yanis ?", "demande, prénom seul : le titre entier");
// Formateurs : au seuil, le nombre est cité au singulier comme au pluriel ; sous le seuil, aucun nombre.
const pf = (o) => ({ lieu_id: 1, lieu_nom: "Nîmes", annee: 2026, cloture_du: "2027-01-01", commentaires_du: "2027-12-31", figeage_du: "2030-01-01",
  fige: false, a_participations: true, a_commentaires: true, a_reponses: true, sous_seuil: false, ...o });
const fx = (o) => jourDu("2030-01-01", [], { portees_formateurs: [pf(o)] });
const [cl1, co1, fi1] = fx({ participations: 1, commentaires: 1, reponses: 1 });
const [cl5, co5, fi5] = fx({ participations: 5, commentaires: 4, reponses: 5 });
const [clS, coS, fiS] = fx({ participations: null, commentaires: null, reponses: null, sous_seuil: true });
eq(phrase(cl1), "Questionnaire des formateurs 2026, Nîmes : à partir du 1er janvier 2027, la liste de ceux qui ont répondu est effacée (1 ligne). Irréversible.", "clôture, une ligne");
eq(phrase(cl5), "Questionnaire des formateurs 2026, Nîmes : à partir du 1er janvier 2027, la liste de ceux qui ont répondu est effacée (5 lignes). Irréversible.", "clôture, plusieurs lignes");
eq(phrase(clS), "Questionnaire des formateurs 2026, Nîmes : à partir du 1er janvier 2027, la liste de ceux qui ont répondu est effacée. Irréversible.", "clôture, sous le seuil");
eq(phrase(co1), "Questionnaire des formateurs 2026, Nîmes : à partir du 31 décembre 2027, les commentaires libres sont effacés (1 commentaire). Irréversible.", "commentaires, un");
eq(phrase(co5), "Questionnaire des formateurs 2026, Nîmes : à partir du 31 décembre 2027, les commentaires libres sont effacés (4 commentaires). Irréversible.", "commentaires, plusieurs");
eq(phrase(coS), "Questionnaire des formateurs 2026, Nîmes : à partir du 31 décembre 2027, les commentaires libres sont effacés. Irréversible.", "commentaires, sous le seuil");
const figeage = "Questionnaire des formateurs 2026, Nîmes : à partir du 1er janvier 2030, les notes individuelles sont remplacées par les pourcentages "
  + "du centre (s'il y a eu au moins 3 réponses). Irréversible.";
eq([phrase(fi1), phrase(fi5), phrase(fiS)], [figeage, figeage, figeage], "figeage : la même phrase entière, sans nombre, pour une, plusieurs ou sous le seuil");
eq([confirmationEcheance(cl1).titre, confirmationEcheance(co5).titre, confirmationEcheance(fiS).titre],
  ["Effacer la liste des répondants pour le questionnaire des formateurs 2026, Nîmes ?", "Effacer les commentaires pour le questionnaire des formateurs 2026, Nîmes ?",
    "Ne garder que les pourcentages pour le questionnaire des formateurs 2026, Nîmes ?"], "formateurs : les trois titres entiers");
eq([confirmationEcheance(jourDu("2027-12-11", [p1({ a_effacer_etape1: 1 })])[0]).titre, confirmationEcheance(jourDu("2030-01-01", [p1({ a_effacer_etape1: 0, a_effacer_etape2: 6 })])[0]).titre],
  ["Effacer les comptes et les textes de « Nîmes mars 2026 » ?", "Effacer les noms et les preuves de « Nîmes mars 2026 » ?"], "étapes : les deux titres entiers");
// Garde-fou d'accord sur toutes les phrases produites : jamais un possessif masculin devant « fiche de suivi », jamais « leurs » devant un singulier.
const toutesPhrases = [...[1, 2, 14].flatMap((n) => [jourDu("2027-12-11", [p1({ a_effacer_etape1: n })])[0], jourDu("2030-01-01", [p1({ a_effacer_etape1: 0, a_effacer_etape2: n })])[0]])].map(phrase);
ok(toutesPhrases.every((x) => !/\bson fiche|\bleurs (compte|nom|fiche|dossier|livret)\b|\bses (compte|nom|fiche|dossier|livret)\b/.test(x)), "aucune faute d'accord sur 1, 2 et 14 fiches");

// Comptes rendus
eq(compteRenduConservation("etape1", { fiches: 0, comptes_equipe: 1 }), "Rien à effacer : c'était déjà fait.", "étape rejouée");
eq(compteRenduConservation("etape2", { fiches: 0, signatures: 0, signatures_formateurs: 0, emargement_emails: 0, questionnaires_figes: 0 }),
  "Rien à effacer : c'était déjà fait.", "étape 2 rejouée : tout à zéro");
// Relecture finale : jamais « Rien à effacer » quand quelque chose est parti ; tout ce que la base dit parti est dit.
eq(compteRenduConservation("etape1", { fiches: 0, questionnaires_commentaires_effaces: true }),
  "Commentaires des questionnaires effacés. Le nom, les résultats, le dossier professionnel, le livret et les signatures restent.",
  "étape 1, seuls des commentaires de questionnaire (sous le seuil) : dit, sans nombre");
eq(compteRenduConservation("etape1", { fiches: 3, epcf_textes: 2, observations: 1, commentaires_passages: 0, emargement_observations: 1,
  questionnaires_commentaires_effaces: true, commentaires_questionnaires: 6 }),
  "3 fiches traitées, 4 textes libres effacés, 6 commentaires de questionnaire effacés. Le nom, les résultats, le dossier professionnel, le livret et les signatures restent.",
  "étape 1 : fiches, textes libres, commentaires de questionnaire (au seuil, avec leur nombre)");
eq(compteRenduConservation("etape2", { fiches: 0, signatures: 3, signatures_formateurs: 0, emargement_emails: 0 }),
  "3 signatures effacées. Les résultats et les heures restent, sans nom.", "étape 2, seules des signatures de fiches déjà sans nom");
eq(compteRenduConservation("etape2", { fiches: 0, signatures: 0, signatures_formateurs: 0, emargement_emails: 5 }),
  "Adresses e-mail retirées des feuilles d'émargement. Les résultats et les heures restent, sans nom.", "étape 2, seules des adresses e-mail");
eq(compteRenduConservation("etape2", { fiches: 0, signatures: 0, signatures_formateurs: 0, emargement_emails: 0, questionnaires_figes: 2 }),
  "2 questionnaires réduits à leurs pourcentages. Les résultats et les heures restent, sans nom.", "étape 2, seul le figeage");
eq(compteRenduConservation("etape2", { fiches: 1, signatures: 1, signatures_formateurs: 2, emargement_emails: 4, questionnaires_figes: 1,
  epcf_textes: 1 }),
  "1 fiche traitée, 1 texte libre effacé, 1 signature effacée, 2 signatures de formateurs effacées, adresses e-mail retirées des feuilles "
  + "d'émargement, 1 questionnaire réduit à ses pourcentages. Les résultats et les heures restent, sans nom.", "étape 2 : tout est dit");
ok(/^5 fiches traitées\. Le nom/.test(compteRenduConservation("etape1", { fiches: 5 })), "étape 1 : nombre de fiches et ce qui reste");
ok(/^1 fiche traitée, 2 signatures de formateurs effacées\. Les résultats et les heures restent/.test(compteRenduConservation("etape2", { fiches: 1, signatures_formateurs: 2 })), "étape 2 : fiches et signatures");
eq(compteRenduConservation("demande", { deja: true }), "Ces données étaient déjà effacées.", "demande rejouée");
ok(/^Effacé : compte de connexion/.test(compteRenduConservation("demande", { comptes: 1, signatures: 2 })), "demande : le détail");
eq(compteRenduConservation("cloture_formateurs", { efface: true }), "C'est effacé.", "clôture faite");
eq(compteRenduConservation("commentaires_formateurs", { efface: false }), "Rien à effacer : c'était déjà fait.", "commentaires rejoués");
ok(/aucun pourcentage/.test(compteRenduConservation("figeage_formateurs", { fige: true, sous_seuil: true, reponses: null })), "figeage sous le seuil");
ok(!/\d/.test(compteRenduConservation("figeage_formateurs", { fige: true, sous_seuil: false, reponses: 6 })), "figeage : aucun nombre de réponses cité");

// Rappel en tête de page
eq(rappelConservation([]), null, "rien de dû : pas de rappel");
eq(rappelConservation(er), null, "le registre seul ne fait pas ce rappel (il a le sien)");
eq(rappelConservation(sans), null, "une promo sans date ne fait pas ce rappel");
ok(/^Une échéance de conservation des données est passée \(la plus ancienne depuis le 11 décembre 2027\)/.test(rappelConservation(e2)), "une échéance : singulier, la date");
ok(/^3 échéances/.test(rappelConservation(es)) && /rien ne part sans votre clic/.test(rappelConservation(es)), "plusieurs : pluriel, rien ne part tout seul");

// Textes : ni tiret cadratin ni « prof »
const tous = [e1, e2, e3, sans, ef, es, er, tri, deux, signatures].flat();
const textesRegles = [...Object.values(CE_QUI_PART), ...Object.values(CE_QUI_RESTE)].flat().concat(c1.titre, c1.phrase, cd.titre, cd.phrase, rappelConservation(es));
for (const x of textesRegles) {
  ok(!x.includes(String.fromCharCode(0x2014)) && !/\bprof\b/i.test(x), "listes et confirmations : ni tiret cadratin ni « prof » : " + x.slice(0, 40));
}
for (const e of tous) {
  ok(!e.texte.includes(String.fromCharCode(0x2014)), "pas de tiret cadratin : " + e.type);
  ok(!/\bprof\b/i.test(e.texte + (e.bouton || "")), "pas de « prof » : " + e.type);
}

// Données personnelles du centre (suite du lot 5), réconciliées avec Q5 : la conservation des fiches est au fondateur (une phrase,
// aucune anonymisation pour la direction) ; la purge des élèves bénévoles reste.
{
  eq(PHRASE_CONSERVATION, "La conservation des fiches est gérée par le fondateur, sur la page Qualiopi.", "la phrase de Réglages (formateurs)");
  // Réglages du centre (20261111_conservation_direction) : la direction lance les deux étapes de ses promos ; la phrase le dit, au
  // vouvoiement, et renvoie l'effacement à la demande au fondateur.
  ok(/votre clic/.test(regles.PHRASE_CONSERVATION_CENTRE) && /fondateur/.test(regles.PHRASE_CONSERVATION_CENTRE)
    && !/\b(tu|ton|ta|tes)\b/i.test(regles.PHRASE_CONSERVATION_CENTRE) && !regles.PHRASE_CONSERVATION_CENTRE.includes(String.fromCharCode(0x2014)),
    "la phrase des Réglages du centre : vouvoiement, fondateur pour la demande, sans tiret cadratin");
  // L'état d'un centre (etat_conservation_centre) : portées des formateurs vides, registre nul ; seules les étapes des promos.
  const etatCentre = { jour: "2027-12-11", portees_formateurs: [], registre: null, promos: [
    { id: 5, nom: "Nîmes", lieu_nom: "Nîmes", date_fin: "2026-12-11", etape1_du: "2027-12-11", etape2_du: "2030-01-01",
      a_effacer_etape1: 2, a_effacer_etape2: 2, comptes_equipe: 0, emargement_etape2: 0 }] };
  const ech = echeancesConservation(etatCentre);
  eq(ech.map((e) => `${e.type}:${e.due}:${e.bouton}`).join(","),
    "etape1:true:Effacer les comptes et les textes,etape2:false:null", "état d'un centre : l'étape 1 due avec son bouton, l'étape 2 à venir sans bouton");
  ok(confirmationEcheance(ech[0])?.saisie?.attendu === MOT_DE_CONFIRMATION && confirmationEcheance(ech[1]) === null,
    "état d'un centre : même confirmation par saisie que la page Qualiopi, rien à confirmer avant la date");
  // Relecture du 11/11 : des activités datées après la fin (fin_contredite_le, direction seulement) : aucun bouton, la raison et la
  // marche à suivre ; rien à confirmer.
  const contredit = echeancesConservation({ ...etatCentre, jour: "2031-01-01",
    promos: [{ ...etatCentre.promos[0], fin_contredite_le: "2027-01-15" }] });
  eq(contredit.map((e) => `${e.type}:${e.due}:${e.bouton}`).join(","), "fin_contredite:false:null",
    "fin contredite : une seule carte, sans bouton, même quand les deux dates sont passées");
  ok(/datées après sa date de fin/.test(contredit[0].texte) && /15 janvier 2027/.test(contredit[0].texte) && /vérifiez la date de fin/.test(contredit[0].texte)
    && /fondateur/.test(contredit[0].texte) && confirmationEcheance(contredit[0]) === null,
    "fin contredite : la raison, la date de la dernière activité, quoi faire ; aucune confirmation possible");
  eq(echeancesConservation({ ...etatCentre, promos: [{ ...etatCentre.promos[0], fin_contredite_le: "2027-01-15", a_effacer_etape1: 0,
    a_effacer_etape2: 0, emargement_etape2: 0 }] }).length, 0, "fin contredite sans rien à effacer : aucune carte");
  ok(/jusqu'au 31 décembre de la troisième année après la fin/.test(regles.PHRASE_CONSERVATION_CENTRE),
    "la phrase des Réglages du centre : les noms et les preuves gardés jusqu'au 31 décembre de la troisième année après la fin");
  for (const nom of ["questionAnonymiserPromo", "phraseAnonymises", "lignesDonneesCentre", "MOT_ANONYMISER", "PHRASE_ETAT_INDISPONIBLE", "etatFinDePromo"]) {
    ok(!(nom in regles), "plus d'anonymisation de promo dans les règles : " + nom);
  }
  eq(questionPurgerBenevoles(1).titre, "Supprimer 1 élève bénévole et leurs coordonnées ?", "purge d'un élève");
  eq(questionPurgerBenevoles(3).titre, "Supprimer 3 élèves bénévoles et leurs coordonnées ?", "purge de plusieurs élèves");
  eq(phrasePurges(1), "1 élève bénévole supprimé.", "un élève supprimé");
  eq(phrasePurges(2), "2 élèves bénévoles supprimés.", "plusieurs élèves supprimés");
  // Les pannes se disent par leur phrase, jamais par un texte technique.
  eq(phraseDePanne({ code: "PGRST202", message: "Could not find the function public.benevoles_a_purger" }), "Cette action n'est pas encore disponible.", "fonction absente");
  eq(phraseDePanne({ message: "TypeError: Failed to fetch" }), "La connexion a échoué. Vérifier le réseau, puis réessayer.", "réseau coupé (phrase neutre, lot D)");
  eq(phraseDePanne({ code: "42501", message: "Réservé à la direction du centre" }), "Vous n'avez pas le droit de faire cela ici.", "droit manquant (équipe vouvoyée, lot D)");
  eq(phraseDePanne({ code: "XX000", message: "internal error at line 12" }), PHRASE_DONNEES_ECHEC, "toute autre panne : la phrase de la section");
  eq(phraseDePanne(null), PHRASE_DONNEES_ECHEC, "panne sans détail");
  eq(phraseDEffacement({ code: "P0001", message: "Réservé à la direction du centre" }), "Réservé à la direction du centre", "phrase de la base gardée");
  eq(phraseDEffacement({ message: "" }), PHRASE_DONNEES_ECHEC, "refus sans phrase");
}

console.log(`effacement-rules : ${n} vérifications OK`);
