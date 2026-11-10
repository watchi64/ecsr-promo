// Conditions d'utilisation : règle d'acceptation, extraction de l'essentiel, intégrité des
// textes. Lancer depuis la racine du dépôt : node tests/legal-rules.test.mjs
import assert from "node:assert/strict";
import { doitAccepter, aDejaAccepte, lignesEssentiel, dateVersion, reperesNonRemplis } from "../js/legal-rules.js";
import { VERSION_CONDITIONS, CONDITIONS_MD, MENTIONS_MD } from "../js/legal-data.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Acceptation par version
ok(doitAccepter([], "2026-10-04"), "aucune acceptation : on demande");
ok(doitAccepter(null, "2026-10-04"), "réponse vide : on demande");
ok(doitAccepter([{ version: "2026-09-02" }], "2026-10-04"), "ancienne version seulement : on redemande");
ok(!doitAccepter([{ version: "2026-09-02" }, { version: "2026-10-04" }], "2026-10-04"), "version en vigueur acceptée");
ok(!aDejaAccepte([]) && aDejaAccepte([{ version: "2026-09-02" }]), "première fois ou mise à jour");

// 2. Version : même format que le contrôle de accepter_conditions() en base
ok(/^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$/.test(VERSION_CONDITIONS), "format de version accepté par la base");
eq(dateVersion("2026-10-04"), "4 octobre 2026", "date lisible");
eq(dateVersion("2026-01-15b"), "15 janvier 2026", "suffixe de version ignoré");

// 3. L'essentiel : 8 lignes, reprises telles quelles dans la fenêtre d'acceptation
const essentiel = lignesEssentiel(CONDITIONS_MD);
eq(essentiel.length, 8, "l'essentiel en 8 lignes");
ok(essentiel.every((l) => !l.startsWith(">") && !l.includes("**L'essentiel")), "lignes nettoyées");
eq(lignesEssentiel("# Sans encadré"), [], "texte sans encadré");

// 4. Intégrité des textes
for (const [nom, md] of [["conditions", CONDITIONS_MD], ["mentions", MENTIONS_MD]]) {
  ok(!md.includes(String.fromCharCode(0x2014)), `${nom} : aucun tiret cadratin`);
  ok(md.startsWith("# "), `${nom} : commence par son titre`);
}
for (let s = 1; s <= 16; s++) ok(CONDITIONS_MD.includes(`\n## ${s}. `), `section ${s} présente`);
ok(/contact@timy-studio\.fr/.test(CONDITIONS_MD) && /contact@timy-studio\.fr/.test(MENTIONS_MD), "contact présent");
ok(/CNIL/.test(CONDITIONS_MD), "droit de réclamation auprès de la CNIL");
ok(!/Gemini|Google|esm\.sh/.test(CONDITIONS_MD), "aucun prestataire retiré n'est cité");

// 5. Garde-fou de publication : aucun repère à compléter ne doit rester.
eq(reperesNonRemplis(CONDITIONS_MD), [], "conditions : repères à compléter");
eq(reperesNonRemplis(MENTIONS_MD), [], "mentions légales : SIRET et adresse à renseigner");

// 6. Direction du centre et siège (lot K) : le tableau « Qui voit quoi » redit ce que la base fait. Règles : equipe_courante()
// (formateur de la promo ou direction de son lieu) ouvre stagiaires_prive, fiches_suivi, evaluations (notes masquées
// comprises), epcf, dp, livret, émargement ; passages et planning sont lus par toute la promo accessible ; le siège ne lit que
// comptes_reseau() (chiffres par centre, sans nom). Questionnaires : seul le fondateur (peut_gerer_qualite) lit les résultats regroupés, ni la direction ni le siège.
eq(VERSION_CONDITIONS, "2026-11-10", "version du lot K");
const tableau = CONDITIONS_MD.split("## 4. Qui voit quoi")[1].split("\n\n")[1].trim().split("\n")
  .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
eq(tableau[0], ["Donnée", "Vous", "Autres stagiaires", "Formateurs", "Direction de votre centre", "Siège d'ECF"], "colonnes du tableau");
const ligne = (nom) => { const l = tableau.find((r) => r[0] === nom); ok(l, `ligne « ${nom} »`); eq(l.length, 6, `${nom} : six cellules`); return l; };
const DIRECTION = {
  "Notes et évaluations": "Oui, y compris les notes masquées",
  "Moyennes du groupe": "Oui",
  "Planning, passages, absences": "Oui",
  "Date de naissance": "Oui",
  "Souhaits de séances": "Oui",
  "Livret, dossier professionnel, EPCF": "Oui",
  "Feuilles d'émargement": "Oui",
  "Réponses aux questionnaires": "Non ; les résultats regroupés, à partir du seuil, vont aux personnes chargées de la qualité",
  "Signalements de problème": "Non",
};
for (const [nom, v] of Object.entries(DIRECTION)) eq(ligne(nom)[4], v, `direction : ${nom}`);
// Le siège ne lit aucune donnée nominative : seulement des totaux par centre.
for (const nom of ["Date de naissance", "Souhaits de séances", "Feuilles d'émargement", "Signalements de problème"]) eq(ligne(nom)[5], "Non", `siège : ${nom}`);
for (const nom of ["Notes et évaluations", "Planning, passages, absences", "Livret, dossier professionnel, EPCF"])
  ok(/^Non, seulement/.test(ligne(nom)[5]), `siège : ${nom}, des totaux par centre seulement`);
ok(/sans aucun nom de stagiaire/.test(CONDITIONS_MD) && /moins de cinq stagiaires/.test(CONDITIONS_MD), "siège : chiffres par centre, masqués sous cinq");
ok(/Vos formateurs et la direction de votre centre continuent de les voir/.test(CONDITIONS_MD), "notes masquées : la direction les voit");
ok(/aucun champ pour le motif d'une absence/.test(CONDITIONS_MD), "motif d'une absence : aucun champ");

console.log(`legal-rules : ${n} vérifications OK`);
