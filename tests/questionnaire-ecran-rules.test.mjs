// Règles de l'écran des questionnaires : bandeau, « Plus tard », lien direct, réponses envoyées.
import test from "node:test";
import assert from "node:assert/strict";
import {
  cleMemoire, idQuestionnaire, lireMemoire, memoirePlusTard, questionnairesAffichables, questionnaireDuBandeau,
  questionnaireDuLien, sousTitreBandeau, progression, aUneReponse, peutAvancer, premiereManquante, reponsesAEnvoyer,
  annonceEcran, ouvrirApresLecture, memoireDeSession,
} from "../js/questionnaire-ecran-rules.js";
import { QUESTIONNAIRES } from "../js/questionnaires-data.js";

const FIN = { cle: "fin_stagiaire", version: QUESTIONNAIRES.fin_stagiaire.version, portee: { promo_id: 1 } };
const SIX = { cle: "six_mois_stagiaire", version: QUESTIONNAIRES.six_mois_stagiaire.version, portee: { promo_id: 1 } };
const FORM1 = { cle: "fin_formateur", version: QUESTIONNAIRES.fin_formateur.version, portee: { lieu_id: 1, annee: 2026 } };
const FORM2 = { cle: "fin_formateur", version: QUESTIONNAIRES.fin_formateur.version, portee: { lieu_id: 2, annee: 2026 } };

test("liste vide ou illisible : aucun bandeau, aucun lien (migration absente)", () => {
  for (const liste of [[], null, undefined, "x", {}]) {
    assert.equal(questionnaireDuBandeau({ liste, memoire: {}, aujourdhui: "2026-12-05" }), null);
    assert.equal(questionnaireDuLien({ liste, cle: "fin_stagiaire" }), null);
  }
});

test("bandeau : le premier questionnaire affichable, dans l'ordre du catalogue", () => {
  assert.equal(questionnaireDuBandeau({ liste: [FORM1, SIX, FIN], memoire: {}, aujourdhui: "2026-12-05" }), FIN);
  assert.equal(questionnaireDuBandeau({ liste: [FORM1], memoire: null, aujourdhui: "2026-12-05" }), FORM1);
});

test("affichables : clé inconnue, autre version ou portée illisible écartées", () => {
  const liste = [
    { cle: "inconnu", version: 1, portee: { promo_id: 1 } },
    { ...FIN, version: FIN.version + 1 },
    { ...SIX, portee: null },
    { ...SIX, portee: [1] },
    null,
    FORM1,
  ];
  assert.deepEqual(questionnairesAffichables(liste), [FORM1]);
});

test("plus tard : remis au lendemain, par compte et par portée", () => {
  assert.equal(cleMemoire("a@b.fr"), "ecsr_questionnaire_plus_tard:a@b.fr");
  assert.equal(cleMemoire(""), null);
  assert.equal(cleMemoire(null), null);

  const m = memoirePlusTard({}, FIN, "2026-12-05");
  assert.deepEqual(m, { [idQuestionnaire(FIN)]: "2026-12-06" });
  // Le jour même : caché ; le lendemain : de retour.
  assert.equal(questionnaireDuBandeau({ liste: [FIN], memoire: m, aujourdhui: "2026-12-05" }), null);
  assert.equal(questionnaireDuBandeau({ liste: [FIN], memoire: m, aujourdhui: "2026-12-06" }), FIN);
  // Un autre questionnaire ouvert prend la place du questionnaire remis.
  assert.equal(questionnaireDuBandeau({ liste: [FIN, SIX], memoire: m, aujourdhui: "2026-12-05" }), SIX);
  // Deux lieux de formateur : remis séparément.
  const mf = memoirePlusTard({}, FORM1, "2026-12-05");
  assert.equal(questionnaireDuBandeau({ liste: [FORM1, FORM2], memoire: mf, aujourdhui: "2026-12-05" }), FORM2);
  assert.notEqual(idQuestionnaire(FORM1), idQuestionnaire(FORM2));
  // Fin de mois et d'année : calcul en UTC.
  assert.deepEqual(Object.values(memoirePlusTard({}, FIN, "2026-12-31")), ["2027-01-01"]);
});

test("plus tard : les remises échues sont oubliées, les autres gardées", () => {
  const m = memoirePlusTard({ vieux: "2026-12-01", futur: "2026-12-20" }, FIN, "2026-12-05");
  assert.deepEqual(Object.keys(m).sort(), [idQuestionnaire(FIN), "futur"].sort());
});

test("mémoire relue : toute valeur illisible vaut rien", () => {
  assert.deepEqual(lireMemoire(null), {});
  assert.deepEqual(lireMemoire("pas du json"), {});
  assert.deepEqual(lireMemoire("[1,2]"), {});
  assert.deepEqual(lireMemoire('{"a":"2026-12-06","b":"demain","c":3}'), { a: "2026-12-06" });
});

test("lien direct : ouvre le questionnaire de la liste, même remis à plus tard", () => {
  assert.equal(questionnaireDuLien({ liste: [FIN, SIX], cle: "six_mois_stagiaire" }), SIX);
  assert.equal(questionnaireDuLien({ liste: [FIN], cle: "fin_formateur" }), null);
  assert.equal(questionnaireDuLien({ liste: [FIN], cle: null }), null);
  assert.equal(questionnaireDuLien({ liste: [{ ...FIN, version: 99 }], cle: "fin_stagiaire" }), null);
});

test("textes : sous-titre et progression", () => {
  assert.equal(sousTitreBandeau(QUESTIONNAIRES.fin_stagiaire),
    `${QUESTIONNAIRES.fin_stagiaire.questions.length} questions courtes. Ta réponse est enregistrée sans ton nom.`);
  assert.deepEqual(progression(3, 10), { texte: "Question 3 sur 10", pourcent: 30 });
  assert.deepEqual(progression(10, 10), { texte: "Question 10 sur 10", pourcent: 100 });
  assert.equal(progression(0, 0).pourcent, 0);
});

test("réponses : échelle, sans avis, choix, commentaire", () => {
  const echelle = { id: "q", type: "echelle", facultative: false };
  assert.equal(aUneReponse(echelle, {}), false);
  assert.equal(aUneReponse(echelle, { q: null }), true, "sans avis est une réponse");
  assert.equal(aUneReponse(echelle, { q: 4 }), true);
  assert.equal(aUneReponse(echelle, { q: 5 }), false);
  assert.equal(aUneReponse(echelle, { q: undefined }), false);
  const choix = { id: "c", type: "choix", options: ["A", "B"] };
  assert.equal(aUneReponse(choix, { c: "A" }), true);
  assert.equal(aUneReponse(choix, { c: "Z" }), false);
  assert.equal(aUneReponse(choix, { c: null }), false, "pas de sans avis sur un choix");
  const com = { id: "commentaire", type: "commentaire", facultative: true };
  assert.equal(aUneReponse(com, { commentaire: "   " }), false);
  assert.equal(peutAvancer(com, {}), true, "facultative : on passe");
  assert.equal(peutAvancer(echelle, {}), false);
  assert.equal(peutAvancer(echelle, { q: null }), true);
});

test("envoi : facultatives omises, sans avis en null, commentaire nettoyé", () => {
  const q = QUESTIONNAIRES.fin_stagiaire;
  const brouillon = {};
  for (const x of q.questions) if (x.type === "echelle" && !x.facultative) brouillon[x.id] = 3;
  brouillon.objectifs = null;
  assert.equal(premiereManquante(q, {}), 0);
  assert.equal(premiereManquante(q, brouillon), -1);
  const { reponses, commentaire } = reponsesAEnvoyer(q, { ...brouillon, commentaire: "  Merci  " });
  assert.equal(reponses.objectifs, null);
  assert.equal(reponses.globalement, 3);
  assert.equal("app" in reponses, false, "facultative sans réponse : absente");
  assert.equal("commentaire" in reponses, false, "le commentaire part à part");
  assert.equal(commentaire, "Merci");
  assert.equal(reponsesAEnvoyer(q, brouillon).commentaire, null);
  const six = QUESTIONNAIRES.six_mois_stagiaire;
  const b6 = { situation: six.questions[0].options[1], utile: 2, preparation: 4, globalement: null };
  assert.equal(premiereManquante(six, b6), -1);
  assert.deepEqual(reponsesAEnvoyer(six, b6).reponses, b6);
});

test("aucun tiret cadratin dans les textes produits", () => {
  const cadratin = String.fromCharCode(0x2014);
  for (const q of Object.values(QUESTIONNAIRES)) assert.equal(sousTitreBandeau(q).includes(cadratin), false);
  assert.equal(progression(1, 2).texte.includes(cadratin), false);
});

test("annonce aux lecteurs d'écran : la progression sur une question, rien ailleurs", () => {
  assert.equal(annonceEcran(1, 10), "Question 1 sur 10");
  assert.equal(annonceEcran(10, 10), "Question 10 sur 10");
  assert.equal(annonceEcran(0, 10), "");
  assert.equal(annonceEcran(11, 10), "");
  assert.equal(annonceEcran(-1, 10), "");
  assert.equal(annonceEcran(2.5, 10), "");
  assert.equal(annonceEcran("3", 10), "");
  assert.equal(annonceEcran(1, 0), "");
});

test("lien direct : la fenêtre s'ouvre seulement si la personne est restée sur l'Accueil, sans autre fenêtre", () => {
  assert.equal(ouvrirApresLecture({ adresseAvant: "#/home", adresseMaintenant: "#/home", fenetre: null }), true);
  assert.equal(ouvrirApresLecture({ adresseAvant: "#/home", adresseMaintenant: "#/planning", fenetre: null }), false);
  assert.equal(ouvrirApresLecture({ adresseAvant: "#/home", adresseMaintenant: "#/home", fenetre: "compte" }), false);
  assert.equal(ouvrirApresLecture({ adresseAvant: "#/home", adresseMaintenant: "#/home", fenetre: "signaler" }), false);
  assert.equal(ouvrirApresLecture({ adresseAvant: undefined, adresseMaintenant: undefined, fenetre: null }), false);
});

test("mémoire de la session : vidée quand le compte change sans rechargement (appareil partagé)", () => {
  const m = memoireDeSession();
  assert.equal(m.suivreCompte("a@x.fr"), false, "première connexion : rien à vider");
  m.brouillons.set(idQuestionnaire(FIN), { reponses: { objectifs: 4 }, etape: 2 });
  m.envoyes.add(idQuestionnaire(SIX));
  // Même compte (jeton renouvelé, aperçu « Voir en tant que ») : rien ne bouge.
  assert.equal(m.suivreCompte("a@x.fr"), false);
  assert.equal(m.brouillons.size, 1);
  assert.equal(m.envoyes.size, 1);
  // Session expirée : plus de compte, tout part.
  assert.equal(m.suivreCompte(null), true);
  assert.equal(m.brouillons.size, 0);
  assert.equal(m.envoyes.size, 0);
  // B se connecte dans le même onglet : rien de A.
  assert.equal(m.suivreCompte("b@x.fr"), false);
  assert.equal(m.brouillons.has(idQuestionnaire(FIN)), false);
  assert.equal(m.envoyes.has(idQuestionnaire(SIX)), false);
  // Passage direct de B à C (événement de déconnexion manqué) : vidé aussi.
  m.brouillons.set(idQuestionnaire(FIN), { reponses: {}, etape: 0 });
  assert.equal(m.suivreCompte("c@x.fr"), true);
  assert.equal(m.brouillons.size, 0);
  // Une adresse vide ou illisible vaut « pas de compte ».
  m.envoyes.add(idQuestionnaire(FIN));
  assert.equal(m.suivreCompte(""), true);
  assert.equal(m.suivreCompte(undefined), false);
});

test("mémoire de la session : l'écran suit le compte avant chaque usage et à chaque changement d'authentification", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../js/questionnaire.js", import.meta.url), "utf8");
  assert.match(src, /const session = memoireDeSession\(\);/);
  assert.doesNotMatch(src, /new Map\(\)|new Set\(\)/, "aucune autre mémoire de module hors de memoireDeSession");
  assert.match(src, /onAdminChange\(\(user\) => \{\s*const compteChange = session\.suivreCompte\(user\?\.email \?\? null\);/);
  assert.match(src, /if \(compteChange && fenetreOuverte\(\) === "questionnaire"\) fermerFenetre\(\);/);
  // lireListe (bandeau, lien direct) et ouvrirQuestionnaire (brouillon) se recalent sur le compte connecté.
  assert.match(src, /lireQuestionnairesARemplir\(\);\s*suivreCompte\(\);/);
  assert.match(src, /const id = idQuestionnaire\(item\);\s*suivreCompte\(\);/);
});
