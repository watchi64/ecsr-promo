import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTREE_A_TRAITER, resumeATraiter, nomAvecATraiter, phraseATraiter, pointSurPlus, lireLesComptes,
  lecteursDeLaPastille, nomDePlus,
} from "../js/a-traiter-rules.js";
import { entreesNavigation, barreTelephone } from "../js/nav-rules.js";
import { pastilleSignalement } from "../js/signalement-rules.js";

// Lot 2A, tâche 6 : ce qui attend l'équipe dans Cours et QCM (signalements de QCM non traités, propositions de l'IA à
// relire). Les règles seulement : combien, comment le dire, où le montrer, et une lecture qui ne lève jamais. La coquille
// (js/nav-shell.js) les pose ; le banc d'essai (outils/verifier_navigation.py) mesure l'affichage.

test("le résumé : les deux parties, au pluriel", () => {
  assert.deepEqual(resumeATraiter({ signalements: 3, propositionsIA: 2 }),
    { total: 5, texte: "3 signalements, 2 propositions de l'IA" });
});

test("le résumé : un seul signalement, au singulier, sans la partie nulle", () => {
  assert.deepEqual(resumeATraiter({ signalements: 1, propositionsIA: 0 }), { total: 1, texte: "1 signalement" });
});

test("le résumé : une seule proposition de l'IA, au singulier", () => {
  assert.deepEqual(resumeATraiter({ signalements: 0, propositionsIA: 1 }), { total: 1, texte: "1 proposition de l'IA" });
  assert.deepEqual(resumeATraiter({ signalements: 1, propositionsIA: 1 }),
    { total: 2, texte: "1 signalement, 1 proposition de l'IA" });
});

test("le résumé : rien à traiter, total nul et texte vide", () => {
  assert.deepEqual(resumeATraiter({ signalements: 0, propositionsIA: 0 }), { total: 0, texte: "" });
});

test("le résumé : un compte illisible (null) ne compte pas, l'autre compte", () => {
  assert.deepEqual(resumeATraiter({ signalements: null, propositionsIA: 2 }), { total: 2, texte: "2 propositions de l'IA" });
  assert.deepEqual(resumeATraiter({ signalements: 4, propositionsIA: null }), { total: 4, texte: "4 signalements" });
  assert.deepEqual(resumeATraiter({ signalements: null, propositionsIA: null }), { total: 0, texte: "" });
});

test("le résumé : seuls les entiers positifs ou nuls sont des comptes valides", () => {
  const rien = { total: 0, texte: "" };
  assert.deepEqual(resumeATraiter({ signalements: NaN, propositionsIA: -3 }), rien);
  assert.deepEqual(resumeATraiter({ signalements: "4", propositionsIA: 2.5 }), rien);
  assert.deepEqual(resumeATraiter({ signalements: Infinity, propositionsIA: undefined }), rien);
  assert.deepEqual(resumeATraiter({}), rien);
  assert.deepEqual(resumeATraiter(), rien);
  assert.deepEqual(resumeATraiter({ signalements: -1, propositionsIA: 3 }), { total: 3, texte: "3 propositions de l'IA" });
});

test("le nom d'une entrée dit ce qui est à traiter, sans rien changer à zéro", () => {
  const cinq = resumeATraiter({ signalements: 3, propositionsIA: 2 });
  assert.equal(nomAvecATraiter("Cours et QCM", cinq), "Cours et QCM, 5 à traiter");
  assert.equal(nomAvecATraiter("Cours et QCM (masqué aux stagiaires)", resumeATraiter({ signalements: 1 })),
    "Cours et QCM (masqué aux stagiaires), 1 à traiter");
  assert.equal(nomAvecATraiter("Cours et QCM", resumeATraiter({})), "Cours et QCM");
  assert.equal(nomAvecATraiter("Plus", resumeATraiter({ signalements: null, propositionsIA: null })), "Plus");
});

test("la phrase du tiroir : le total, puis le détail (spec : « 5 à traiter : 3 signalements, 2 propositions de l'IA »)", () => {
  assert.equal(phraseATraiter(resumeATraiter({ signalements: 3, propositionsIA: 2 })),
    "5 à traiter : 3 signalements, 2 propositions de l'IA");
  assert.equal(phraseATraiter(resumeATraiter({ signalements: 1, propositionsIA: 0 })), "1 à traiter : 1 signalement");
  assert.equal(phraseATraiter(resumeATraiter({ signalements: 0, propositionsIA: 0 })), "");
  assert.equal(phraseATraiter(resumeATraiter({ signalements: null, propositionsIA: null })), "");
});

test("le point de « Plus » : quand une entrée du tiroir porte un compte, et seulement alors", () => {
  const cinq = resumeATraiter({ signalements: 5 });
  const rien = resumeATraiter({ signalements: 0, propositionsIA: 0 });
  assert.equal(pointSurPlus(["emargement", "themes", "ccp2"], cinq), true);
  assert.equal(pointSurPlus(["emargement", "ccp2", "centre", "config"], cinq), false, "l'entrée qui porte le compte est dans la barre");
  assert.equal(pointSurPlus(["emargement", "themes"], rien), false, "rien à traiter");
  assert.equal(pointSurPlus(["themes"], resumeATraiter({ signalements: null, propositionsIA: null })), false, "comptes illisibles");
  assert.equal(pointSurPlus([], cinq), false, "pas de tiroir");
});

test("le point de « Plus » : la pastille de « Signaler un problème », rangée dans le même tiroir, l'allume aussi (relecture finale, F10)", () => {
  const tiroir = ["emargement", "themes", "ccp2"];
  const rien = resumeATraiter({ signalements: 0, propositionsIA: 0 });
  const cinq = resumeATraiter({ signalements: 5 });
  assert.equal(pointSurPlus(tiroir, rien, "3"), true, "rien à traiter, mais des signalements de problème : le point s'allume");
  assert.equal(pointSurPlus(["emargement", "ccp2", "centre", "config"], rien, "2"), true, "même quand « Cours et QCM » est dans la barre : « Signaler un problème » est toujours dans le tiroir");
  assert.equal(pointSurPlus(tiroir, cinq, "3"), true, "les deux ensemble : un seul point");
  assert.equal(pointSurPlus(tiroir, rien, ""), false, "ni l'un ni l'autre");
  assert.equal(pointSurPlus(tiroir, rien), false, "sans pastille de signalement donnée : comme avant");
  assert.equal(pointSurPlus(tiroir, resumeATraiter({ signalements: null, propositionsIA: null }), "9+"), true, "comptes illisibles : la pastille de « Signaler un problème » compte seule");
  assert.equal(pointSurPlus([], rien, "3"), false, "pas de tiroir, pas de « Signaler un problème » à y chercher, donc pas de point");
  assert.equal(pointSurPlus(tiroir, cinq, "3") === pointSurPlus(tiroir, cinq), true, "déjà allumé par « Cours et QCM » : rien ne change");
});

test("le nom du bouton « Plus » dit ce que son point signale, sans parler des signalements de QCM comme des problèmes de l'app", () => {
  const cinq = resumeATraiter({ signalements: 5 });
  const rien = resumeATraiter({});
  const nouveaux = pastilleSignalement({ fondateur: true, nouveaux: 2, suivis: 0 });
  const avances = pastilleSignalement({ fondateur: false, nouveaux: 0, suivis: 1 });
  const aucune = pastilleSignalement({ fondateur: false, nouveaux: 3, suivis: 0 });
  assert.equal(nomDePlus(cinq, aucune.nom), "Plus, 5 à traiter", "comme avant : le nombre à traiter");
  assert.equal(nomDePlus(rien, aucune.nom), "Plus", "rien à dire : le nom seul");
  assert.equal(nomDePlus(rien, nouveaux.nom), "Plus, 2 nouveaux signalements", "les signalements de problème, quand c'est tout");
  assert.equal(nomDePlus(rien, avances.nom), "Plus, 1 signalement a avancé");
  assert.equal(nomDePlus(cinq, nouveaux.nom), "Plus, 5 à traiter, 2 nouveaux signalements", "les deux, dans cet ordre");
  assert.equal(nomDePlus(cinq), "Plus, 5 à traiter", "sans nom de « Signaler un problème » : comme avant");
  assert.equal(nomDePlus(undefined, undefined), "Plus", "rien du tout");
  assert.ok(nomDePlus(rien, nouveaux.nom).startsWith("Plus"), "le nom contient le libellé visible (WCAG 2.5.3)");
});

test("l'entrée qui porte le compte est « Cours et QCM » de l'équipe, rangée dans « Plus » sur téléphone", () => {
  assert.equal(ENTREE_A_TRAITER, "themes");
  const entrees = entreesNavigation("equipe", { routeVisible: () => true, emargementActif: true });
  assert.equal(entrees.find((e) => e.id === ENTREE_A_TRAITER).libelle, "Cours et QCM");
  const { barre, plus } = barreTelephone("equipe", entrees);
  assert.ok(!barre.some((e) => e.id === ENTREE_A_TRAITER));
  assert.equal(pointSurPlus(plus.map((e) => e.id), resumeATraiter({ signalements: 1 })), true);
});

const rend = (n) => async () => n;
const echoue = async () => { throw new Error("réseau"); };

test("la lecture : chaque compte lu est rendu tel quel", async () => {
  assert.deepEqual(await lireLesComptes({ signalements: rend(3), propositionsIA: rend(2) }), { signalements: 3, propositionsIA: 2 });
  assert.deepEqual(await lireLesComptes({ signalements: rend(0), propositionsIA: rend(0) }), { signalements: 0, propositionsIA: 0 });
});

test("la lecture : une lecture en échec vaut null et ne touche pas l'autre", async () => {
  assert.deepEqual(await lireLesComptes({ signalements: echoue, propositionsIA: rend(2) }), { signalements: null, propositionsIA: 2 });
  assert.deepEqual(await lireLesComptes({ signalements: rend(3), propositionsIA: echoue }), { signalements: 3, propositionsIA: null });
});

test("la lecture : jamais d'exception, même quand tout échoue, y compris sans attendre (lecteur qui lève tout de suite)", async () => {
  assert.deepEqual(await lireLesComptes({ signalements: echoue, propositionsIA: echoue }), { signalements: null, propositionsIA: null });
  const tot = () => { throw new Error("levée avant toute promesse"); };
  assert.deepEqual(await lireLesComptes({ signalements: tot, propositionsIA: rend(1) }), { signalements: null, propositionsIA: 1 });
  assert.deepEqual(await lireLesComptes({}), { signalements: null, propositionsIA: null }, "lecteurs absents");
  assert.deepEqual(await lireLesComptes(), { signalements: null, propositionsIA: null }, "sans argument");
});

test("la lecture : un résultat qui n'est pas un compte valide vaut null", async () => {
  for (const invalide of [null, undefined, NaN, -2, 1.5, "3", {}, Infinity]) {
    assert.deepEqual(await lireLesComptes({ signalements: rend(invalide), propositionsIA: rend(1) }), { signalements: null, propositionsIA: 1 }, String(invalide));
  }
});

test("la lecture : les deux lectures partent ensemble, la lente ne retarde pas le départ de l'autre", async () => {
  const appels = [];
  let finir;
  const lente = () => { appels.push("signalements"); return new Promise((r) => { finir = r; }); };
  const vive = async () => { appels.push("propositionsIA"); return 1; };
  const lecture = lireLesComptes({ signalements: lente, propositionsIA: vive });
  assert.deepEqual(appels, ["signalements", "propositionsIA"]);
  finir(4);
  assert.deepEqual(await lecture, { signalements: 4, propositionsIA: 1 });
});

test("la pastille ne compte que les signalements de QCM : le comptage des propositions de l'IA n'est même pas lancé (ruling R56)", async () => {
  let appelsIA = 0;
  const comptes = await lireLesComptes(lecteursDeLaPastille({
    signalements: rend(5),
    propositionsIA: async () => { appelsIA++; return 3; },
  }));
  assert.deepEqual(comptes, { signalements: 5, propositionsIA: null });
  assert.equal(appelsIA, 0, "la table des brouillons n'est pas lue : elle est commune à toutes les promos, sans auteur, et sans liste où les retrouver avant le lot 2B");
  const resume = resumeATraiter(comptes);
  assert.deepEqual(resume, { total: 5, texte: "5 signalements" });
  assert.equal(phraseATraiter(resume), "5 à traiter : 5 signalements", "la phrase du tiroir ne parle que des signalements");
  assert.equal(nomAvecATraiter("Cours et QCM", resume), "Cours et QCM, 5 à traiter");
});

test("le lot 2B rouvre le comptage des propositions de l'IA par un seul paramètre, sans toucher aux règles du résumé", async () => {
  const lecteurs = { signalements: rend(5), propositionsIA: rend(3) };
  assert.deepEqual(await lireLesComptes(lecteursDeLaPastille(lecteurs, true)), { signalements: 5, propositionsIA: 3 });
  assert.deepEqual(resumeATraiter({ signalements: 5, propositionsIA: 3 }), { total: 8, texte: "5 signalements, 3 propositions de l'IA" });
  assert.deepEqual(await lireLesComptes(lecteursDeLaPastille(lecteurs, false)), { signalements: 5, propositionsIA: null });
});

test("les lecteurs de la pastille : un compte de signalements illisible reste null, la lecture des propositions n'y change rien", async () => {
  const echoue = async () => { throw new Error("réseau"); };
  assert.deepEqual(await lireLesComptes(lecteursDeLaPastille({ signalements: echoue, propositionsIA: rend(3) })), { signalements: null, propositionsIA: null });
  assert.deepEqual(await lireLesComptes(lecteursDeLaPastille({})), { signalements: null, propositionsIA: null }, "lecteurs absents");
  assert.deepEqual(await lireLesComptes(lecteursDeLaPastille()), { signalements: null, propositionsIA: null }, "sans argument");
});
