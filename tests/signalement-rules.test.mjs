import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_MESSAGE, LIMITE_MESSAGE, LIMITE_CAPTURE, COTE_MAX_CAPTURE, MAX_ERREURS, LIMITE_ERREUR, MAX_MES_SIGNALEMENTS,
  lireNavigateur, classeAppareil, assemblerContexte, resumeContexte, detailContexte, verifierMessage,
  libelleStatut, pastilleSignalement, messageDemarrage, entreeErreur, ajouterErreur, dimensionsReduites,
  phraseErreur, adresseSure, normaliserContexte, messageErreurEnvoi,
} from "../js/signalement-rules.js";

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

const RELEVE_IPHONE = {
  adresse: "#/planning", titre: "Planning", version: "20261028a", navigation: "ancienne",
  espace: null, apercu: null, largeur: 390, hauteur: 844, densite: 3, tactile: true, ua: UA_IPHONE,
  maxTouchPoints: 5, installee: true, langue: "fr-FR", enLigne: true, heure: "2026-10-28T10:42:05.000Z",
  fuseau: "Europe/Paris",
  erreurs: [
    { a: "10:41:58", type: "erreur", message: "boum", source: "planning.js:12" },
    { a: "10:42:01", type: "console", message: "chatbot: x", source: "" },
  ],
};

test("les bornes de la spec", () => {
  assert.equal(MIN_MESSAGE, 3);
  assert.equal(LIMITE_MESSAGE, 2000);
  assert.equal(LIMITE_CAPTURE, 700000);
  assert.equal(COTE_MAX_CAPTURE, 1600);
  assert.equal(MAX_ERREURS, 5);
  assert.equal(LIMITE_ERREUR, 300);
  assert.equal(MAX_MES_SIGNALEMENTS, 10);
});

test("iPhone, Safari", () => assert.deepEqual(lireNavigateur(UA_IPHONE), { navigateur: "Safari 18.1", systeme: "iOS 18.1" }));

test("iPad qui se dit Mac (écran tactile)", () => assert.deepEqual(
  lireNavigateur("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", { maxTouchPoints: 5 }),
  { navigateur: "Safari 18.0", systeme: "iPadOS" }));

test("iPad en agent mobile", () => assert.equal(
  lireNavigateur("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1").systeme,
  "iPadOS 17.5"));

test("Chrome sur iPhone", () => assert.equal(
  lireNavigateur("... iPhone OS 17_5 ... CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1").navigateur, "Chrome 129"));

test("Android, Chrome", () => assert.deepEqual(
  lireNavigateur("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"),
  { navigateur: "Chrome 130", systeme: "Android 14" }));

test("Samsung Internet", () => assert.equal(
  lireNavigateur("... Android 13; SM-S911B ... SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36").navigateur,
  "Samsung Internet 25.0"));

test("Windows, Edge puis Firefox", () => {
  assert.deepEqual(
    lireNavigateur("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.56"),
    { navigateur: "Edge 130", systeme: "Windows" });
  assert.equal(lireNavigateur("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0").navigateur, "Firefox 132");
});

test("Mac, Chrome", () => assert.deepEqual(
  lireNavigateur("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
  { navigateur: "Chrome 130", systeme: "macOS" }));

test("agent inconnu ou vide", () => assert.deepEqual(lireNavigateur(""), { navigateur: "inconnu", systeme: "inconnu" }));

test("classe d'appareil aux seuils de la navigation", () => {
  assert.equal(classeAppareil(375), "téléphone");
  assert.equal(classeAppareil(699), "téléphone");
  assert.equal(classeAppareil(700), "tablette");
  assert.equal(classeAppareil(1079), "tablette");
  assert.equal(classeAppareil(1080), "ordinateur");
});

test("message : bornes comptées en points de code", () => {
  assert.deepEqual(verifierMessage("  a "), { ok: false, erreur: "Écris quelques mots sur ce qui se passe." });
  assert.deepEqual(verifierMessage("  Le bouton ne marche pas \n"), { ok: true, message: "Le bouton ne marche pas" });
  assert.equal(verifierMessage("😀".repeat(2000)).ok, true);
  assert.deepEqual(verifierMessage("😀".repeat(2001)), { ok: false, erreur: "2 000 caractères au plus (tu en as 2 001)." });
  assert.equal(verifierMessage(undefined).ok, false);
});

test("résumé du contexte", () => {
  const c = assemblerContexte(RELEVE_IPHONE);
  assert.equal(resumeContexte(c, new Date(2026, 9, 28, 10, 42)), "page Planning, iPhone, Safari 18, à 10 h 42");
  assert.equal(resumeContexte({ ...c, titre: "", systeme: "Windows", appareil: "ordinateur", navigateur: "Edge 130" },
    new Date(2026, 9, 28, 9, 5)), "page #/planning, ordinateur Windows, Edge 130, à 9 h 05");
  assert.equal(resumeContexte({ ...c, systeme: "Android 14", appareil: "téléphone", navigateur: "inconnu" },
    new Date(2026, 9, 28, 9, 5)), "page Planning, téléphone Android, à 9 h 05");
});

test("contexte assemblé", () => {
  const c = assemblerContexte(RELEVE_IPHONE);
  assert.equal(c.appareil, "téléphone");
  assert.equal(c.ecran, "390 × 844");
  assert.equal(c.orientation, "portrait");
  assert.equal(c.page, "planning");
  assert.equal(c.navigation, "ancienne");
  assert.equal(c.installee, true);
  assert.equal(c.en_ligne, true);
  assert.equal(c.version, "20261028a");
  assert.equal(c.erreurs.length, 2);
  assert.equal(c.agent, RELEVE_IPHONE.ua);
  assert.equal(c.navigateur, "Safari 18.1");
  assert.ok(JSON.stringify(c).length < 16384);
});

test("contexte : page tirée d'une adresse à segments, titre borné, agent borné", () => {
  const c = assemblerContexte({ ...RELEVE_IPHONE, adresse: "#/stagiaires/12/epcf", titre: "T".repeat(300), ua: "U".repeat(900) });
  assert.equal(c.page, "stagiaires");
  assert.equal(c.titre.length, 120);
  assert.equal(c.agent.length, 500);
  assert.equal(assemblerContexte({ ...RELEVE_IPHONE, largeur: 1280, hauteur: 800 }).orientation, "paysage");
});

test("détail en mots simples", () => {
  const lignes = new Map(detailContexte(assemblerContexte(RELEVE_IPHONE)));
  assert.equal(lignes.get("Page"), "Planning (#/planning)");
  assert.equal(lignes.get("App installée"), "oui");
  assert.equal(lignes.get("Écran"), "390 × 844, densité 3, portrait");
  assert.equal(lignes.get("Navigation"), "ancienne");
  assert.equal(lignes.get("Appareil"), "téléphone, tactile");
  assert.equal(lignes.get("Erreurs récentes"), "2");
  assert.equal(lignes.has("Aperçu"), false);
  const v2 = new Map(detailContexte(assemblerContexte({ ...RELEVE_IPHONE, navigation: "nouvelle", espace: "equipe", apercu: "stagiaire", erreurs: [] })));
  assert.equal(v2.get("Navigation"), "nouvelle, espace équipe");
  assert.equal(v2.get("Aperçu"), "Stagiaire");
  assert.equal(v2.get("Erreurs récentes"), "aucune");
});

test("statuts", () => {
  assert.equal(libelleStatut("nouveau", "personne"), "Reçu");
  assert.equal(libelleStatut("nouveau", "fondateur"), "Nouveau");
  assert.equal(libelleStatut("en_cours", "personne"), "En cours");
  assert.equal(libelleStatut("non_retenu", "personne"), "Pas retenu");
  assert.equal(libelleStatut("regle", "fondateur"), "Réglé");
});

test("pastille et message de démarrage", () => {
  assert.deepEqual(pastilleSignalement({ fondateur: true, nouveaux: 2, suivis: 1 }),
    { texte: "2", nom: "Signaler un problème, 2 nouveaux signalements" });
  assert.deepEqual(pastilleSignalement({ fondateur: false, nouveaux: 0, suivis: 1 }),
    { texte: "1", nom: "Signaler un problème, 1 signalement a avancé" });
  assert.deepEqual(pastilleSignalement({ fondateur: false, nouveaux: 3, suivis: 0 }),
    { texte: "", nom: "Signaler un problème" });
  assert.equal(messageDemarrage({ fondateur: true, nouveaux: 1, suivis: 0 }), "1 nouveau problème signalé.");
  assert.equal(messageDemarrage({ fondateur: true, nouveaux: 2, suivis: 0 }), "2 nouveaux problèmes signalés.");
  assert.equal(messageDemarrage({ fondateur: false, nouveaux: 0, suivis: 1 }),
    "Ton signalement a avancé : ouvre « Signaler un problème » pour voir la suite.");
  assert.equal(messageDemarrage({ fondateur: false, nouveaux: 0, suivis: 2 }),
    "Tes signalements ont avancé : ouvre « Signaler un problème » pour voir la suite.");
  assert.equal(messageDemarrage({ fondateur: false, nouveaux: 5, suivis: 0 }), null);
});

test("journal : troncature et cinq au plus", () => {
  let j = [];
  for (let i = 0; i < 7; i++) {
    j = ajouterErreur(j, entreeErreur({ type: "erreur", message: "x".repeat(400) + i, source: "a.js:1", quand: new Date(2026, 9, 28, 10, 41, i) }));
  }
  assert.equal(j.length, 5);
  assert.equal(j[0].a, "10:41:02");
  assert.equal(j[4].message.length, 300);
  assert.equal(j[4].type, "erreur");
  assert.equal(j[4].source, "a.js:1");
});

test("image réduite, jamais agrandie", () => {
  assert.deepEqual(dimensionsReduites(1179, 2556), { largeur: 738, hauteur: 1600 });
  assert.deepEqual(dimensionsReduites(4000, 3000), { largeur: 1600, hauteur: 1200 });
  assert.deepEqual(dimensionsReduites(800, 600), { largeur: 800, hauteur: 600 });
  assert.deepEqual(dimensionsReduites(4000, 3000, 1200), { largeur: 1200, hauteur: 900 });
});

test("refus du serveur et adresse sûre", () => {
  assert.equal(phraseErreur("signalement: Tu as déjà envoyé 10 signalements aujourd'hui."), "Tu as déjà envoyé 10 signalements aujourd'hui.");
  assert.equal(phraseErreur("Failed to fetch"), null);
  assert.equal(adresseSure("#/stagiaires/12/epcf"), "#/stagiaires/12/epcf");
  assert.equal(adresseSure("javascript:alert(1)"), null);
  assert.equal(adresseSure("#/x\"onclick"), null);
  assert.equal(adresseSure(""), null);
});

test("contexte forgé : jamais d'exception, que des chaînes", () => {
  const forge = { appareil: "x", navigateur: 5, systeme: null, titre: 7, ecran: ["a"], densite: "3",
    erreurs: [null, "x", { a: 1, message: { b: 2 } }] };
  const c = normaliserContexte(forge);
  assert.equal(c.navigateur, "5");
  assert.equal(c.titre, "7");
  assert.equal(c.erreurs.length, 1);
  assert.equal(typeof c.erreurs[0].message, "string");
  assert.equal(typeof resumeContexte(forge, new Date(2026, 9, 28, 9, 5)), "string");
  assert.ok(detailContexte(forge).every(([k, v]) => typeof k === "string" && typeof v === "string"));
  assert.doesNotThrow(() => detailContexte(null));
  assert.doesNotThrow(() => resumeContexte("texte", new Date()));
  assert.equal(resumeContexte({}, new Date(2026, 9, 28, 9, 5)), "page inconnue, à 9 h 05");
});

test("erreur d'envoi : refus de la base, session expirée, réseau", () => {
  assert.equal(messageErreurEnvoi({ message: "signalement: Tu as déjà envoyé 10 signalements aujourd'hui." }),
    "Tu as déjà envoyé 10 signalements aujourd'hui.");
  assert.equal(messageErreurEnvoi({ message: "JWT expired", code: "PGRST301" }), "Reconnecte-toi pour signaler un problème.");
  assert.equal(messageErreurEnvoi({ message: "permission denied for function signaler_probleme", code: "42501" }),
    "Reconnecte-toi pour signaler un problème.");
  assert.equal(messageErreurEnvoi({ message: "TypeError: Failed to fetch" }), "L'envoi n'a pas abouti. Vérifie ta connexion et réessaie.");
  assert.equal(messageErreurEnvoi(null), "L'envoi n'a pas abouti. Vérifie ta connexion et réessaie.");
});
