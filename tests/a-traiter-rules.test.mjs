import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTREE_A_TRAITER, resumeATraiter, nomAvecATraiter, phraseATraiter, pointSurPlus, lireLesComptes,
} from "../js/a-traiter-rules.js";
import { entreesNavigation, barreTelephone } from "../js/nav-rules.js";

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
