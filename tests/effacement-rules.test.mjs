// Effacement des données : confirmation, textes d'état. Lancer depuis la racine du dépôt :
// node tests/effacement-rules.test.mjs
import assert from "node:assert/strict";
import { confirmationValide, dateCourte, etatFinDePromo, resumeEffacement } from "../js/effacement-rules.js";

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

eq(dateCourte("2027-12-11"), "11/12/2027", "date courte");
eq(dateCourte(null), "", "date absente");

// Fin de promo
eq(etatFinDePromo(null).bouton, false, "pas de promo");
ok(/non renseignée/.test(etatFinDePromo({ date_fin: null }).texte), "date de fin absente");
const avant = etatFinDePromo({ date_fin: "2026-12-11", anonymisable_le: "2027-12-11", anonymisable: false, restants: 15, comptes_admin: 1 });
eq(avant.bouton, false, "trop tôt : pas de bouton");
ok(avant.texte.includes("11/12/2026") && avant.texte.includes("11/12/2027"), "trop tôt : les deux dates");
const pret = etatFinDePromo({ date_fin: "2025-01-01", anonymisable_le: "2026-01-01", anonymisable: true, restants: 15, comptes_admin: 1 });
eq(pret.bouton, true, "délai écoulé : bouton");
ok(pret.texte.includes("14 fiches") && /administrateur/.test(pret.texte), "fiches à traiter hors compte admin");
const fini = etatFinDePromo({ date_fin: "2025-01-01", anonymisable: true, restants: 1, comptes_admin: 1 });
eq(fini.bouton, false, "seul le compte admin reste : pas de bouton");
ok(/anonymisées/.test(fini.texte), "promo traitée");

// Compte rendu
eq(resumeEffacement({ deja: true }), "Ces données étaient déjà effacées.", "déjà fait");
const r = resumeEffacement({ comptes: 1, date_naissance: 1, livret: 1, dossier_pro: 0, fiche_suivi: 1, epcf_textes: 2, observations: 1, commentaires_passages: 0 });
ok(r.startsWith("Effacé : compte de connexion, date de naissance, livret, fiche de suivi, 3 commentaires."), "compte rendu détaillé");
ok(/sans nom/.test(resumeEffacement({})), "compte rendu minimal");

console.log(`effacement-rules : ${n} vérifications OK`);
