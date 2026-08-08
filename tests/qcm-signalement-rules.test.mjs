import assert from "node:assert/strict";
import {
  VERDICTS, libelleVerdict, conclusionDe, corpsAnalyse, etatInstruction, morceaux, GROUPES, grouperParVerdict,
} from "../js/qcm-signalement-rules.js";

// --- Libellés : le verdict s'écrit en toutes lettres, jamais en code brut ---
assert.equal(libelleVerdict("fonde"), "Signalement fondé");
assert.equal(libelleVerdict("confirme"), "Question confirmée");
assert.equal(libelleVerdict("ambigu"), "Ambigu");
assert.equal(libelleVerdict("non_concluant"), "Non concluant");
assert.equal(libelleVerdict("n_importe_quoi"), "Verdict inconnu",
  "un verdict inconnu se voit, il ne s'affiche pas en code brut");
assert.equal(libelleVerdict(null), "Verdict inconnu");
assert.equal(Object.keys(VERDICTS).length, 4, "quatre verdicts, pas un de plus");

// --- Conclusion : la première ligne utile, sans son étiquette ---
assert.equal(conclusionDe("Conclusion : R414-2 ne couvre pas ce cas.\nLe grief : fondé."),
  "R414-2 ne couvre pas ce cas.");
assert.equal(conclusionDe("\n\n  Conclusion :   Question juste.  \nSuite"), "Question juste.");
assert.equal(conclusionDe("Pas d'étiquette ici."), "Pas d'étiquette ici.");
assert.equal(conclusionDe(""), "");
assert.equal(conclusionDe(null), "");

// --- État : non instruit ---
assert.deepEqual(etatInstruction(null), { instruit: false });
assert.deepEqual(etatInstruction({ id: 1 }), { instruit: false });
assert.deepEqual(etatInstruction({ id: 1, instruction: null }), { instruit: false });
assert.deepEqual(etatInstruction({ id: 1, instruction: {} }), { instruit: false },
  "une ligne d'instruction sans verdict ne compte pas comme instruite");

// --- État : instruit ---
const instruit = etatInstruction({
  id: 1,
  instruction: {
    verdict_auto: "fonde",
    analyse_auto: "Conclusion : R414-2 vise la route étroite.\nLe grief : fondé.",
    instruit_at: "2026-07-31T09:00:00Z",
  },
});
assert.equal(instruit.instruit, true);
assert.equal(instruit.verdict, "fonde");
assert.equal(instruit.libelle, "Signalement fondé");
assert.equal(instruit.conclusion, "R414-2 vise la route étroite.");
assert.equal(instruit.instruitAt, "2026-07-31T09:00:00Z");
assert.match(instruit.analyse, /Le grief/, "l'analyse complète est conservée telle quelle");

// PostgREST peut rendre une jointure un-à-un sous forme de tableau selon la version :
// l'affichage ne doit pas dépendre de ce détail.
const enTableau = etatInstruction({
  id: 2,
  instruction: [{ verdict_auto: "ambigu", analyse_auto: "Conclusion : à trancher.", instruit_at: null }],
});
assert.equal(enTableau.instruit, true);
assert.equal(enTableau.libelle, "Ambigu");
assert.deepEqual(etatInstruction({ id: 3, instruction: [] }), { instruit: false });

// --- Corps de l'analyse : la conclusion ne se lit pas deux fois ---
assert.deepEqual(
  corpsAnalyse("Conclusion : c'est fondé.\nLe grief : fondé.\nVérifications : R414-1 colle."),
  ["Le grief : fondé.", "Vérifications : R414-1 colle."],
);
assert.deepEqual(corpsAnalyse("\n\nConclusion : c'est fondé.\n\nLe grief : fondé."),
  ["Le grief : fondé."], "les lignes vides de tête et d'entre-deux ne laissent pas de trou");
assert.deepEqual(corpsAnalyse("Conclusion: sans espace.\nSuite."), ["Suite."],
  "l'étiquette est reconnue sans espace avant les deux-points");
assert.deepEqual(corpsAnalyse("Pas d'étiquette.\nSuite."), ["Pas d'étiquette.", "Suite."],
  "sans étiquette, rien n'est retiré");
assert.deepEqual(corpsAnalyse("Conclusion : seule."), [],
  "une analyse réduite à sa conclusion ne laisse pas de corps");
assert.deepEqual(corpsAnalyse(""), []);
assert.deepEqual(corpsAnalyse(null), []);

// --- Morceaux : liens cliquables SANS innerHTML ---
assert.deepEqual(morceaux("aucun lien"), [{ valeur: "aucun lien", lien: false }]);
assert.deepEqual(morceaux(""), []);
assert.deepEqual(morceaux(null), []);
assert.deepEqual(
  morceaux("voir https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI001 pour le texte"),
  [
    { valeur: "voir ", lien: false },
    { valeur: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI001", lien: true },
    { valeur: " pour le texte", lien: false },
  ],
);
assert.deepEqual(morceaux("https://a.test/x"), [{ valeur: "https://a.test/x", lien: true }]);
assert.equal(morceaux("https://a.test/x et https://b.test/y").filter((m) => m.lien).length, 2);
// La parenthèse fermante ne fait pas partie de l'URL, sinon le lien Légifrance est mort.
assert.deepEqual(morceaux("(https://a.test/x)"), [
  { valeur: "(", lien: false },
  { valeur: "https://a.test/x", lien: true },
  { valeur: ")", lien: false },
]);

// --- Groupement par verdict : la file de traitement ---
const sig = (id, verdict) => ({
  id,
  instruction: verdict ? { verdict_auto: verdict, analyse_auto: "Conclusion : x.", instruit_at: null } : null,
});

assert.deepEqual(GROUPES.map((g) => g.cle),
  ["fonde", "ambigu", "non_concluant", "confirme", "non_instruit"],
  "ordre fixe : non_concluant AVANT confirme, c'est un aveu d'aveuglement pas un feu vert");

const groupes = grouperParVerdict([
  sig(1, "confirme"), sig(2, "fonde"), sig(3, null), sig(4, "non_concluant"),
  sig(5, "ambigu"), sig(6, "fonde"),
]);
assert.deepEqual(groupes.map((g) => g.cle),
  ["fonde", "ambigu", "non_concluant", "confirme", "non_instruit"]);
assert.deepEqual(groupes[0].items.map((s) => s.id), [2, 6], "l'ordre d'entrée est conservé dans un groupe");
assert.deepEqual(groupes[4].items.map((s) => s.id), [3], "sans instruction → Pas encore instruit");
assert.ok(groupes.every((g) => typeof g.titre === "string" && g.titre.length));

// Groupes vides omis : une console qui affiche cinq titres pour deux signalements ment
// sur la charge de travail.
const partiel = grouperParVerdict([sig(1, "fonde")]);
assert.deepEqual(partiel.map((g) => g.cle), ["fonde"]);

assert.deepEqual(grouperParVerdict([]), []);
assert.deepEqual(grouperParVerdict(null), []);

// Verdict hors des quatre connus : impossible avec la contrainte CHECK de la table, mais
// on ne parie pas dessus — il demande une lecture humaine, donc il va avec les non concluants.
const inconnu = grouperParVerdict([sig(1, "n_importe_quoi")]);
assert.deepEqual(inconnu.map((g) => g.cle), ["non_concluant"]);

console.log("qcm-signalement-rules : OK");
