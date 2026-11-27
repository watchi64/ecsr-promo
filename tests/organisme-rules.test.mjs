// Règles pures du cloisonnement par organisme côté app (étape 3) : l'organisme lu par mon_organisme(), le bandeau et le motif de
// l'accès support du fondateur, la liste des organismes proposés, et le fondateur qui garde les éditeurs des contenus communs.
// Lancer : node --test tests/organisme-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  texteBandeauSupport, motifSupportValide, MOTIF_SUPPORT_MIN, normaliserMonOrganisme, supportEnCours, etatBandeauSupport,
  organismesProposes, organismeParDefaut,
} from "../js/organisme-rules.js";
import { phraseDeRefus } from "../js/espaces-rules.js";
import { casesDeLEspace, selonLaCase } from "../js/titres-rules.js";

test("texteBandeauSupport : le nom et l'heure de Paris de l'échéance", () => {
  assert.equal(texteBandeauSupport("Organisme B", new Date("2026-11-28T15:05:00+01:00")), "Accès support : Organisme B, jusqu'à 15 h 05");
  // Heure d'été : l'heure est celle de Paris, pas celle de la machine ni l'heure UTC.
  assert.equal(texteBandeauSupport("Organisme B", new Date("2026-07-01T07:00:00Z")), "Accès support : Organisme B, jusqu'à 9 h 00");
  // Les minutes ont toujours deux chiffres, l'heure n'a pas de zéro devant.
  assert.equal(texteBandeauSupport("Organisme B", new Date("2026-11-28T08:04:00Z")), "Accès support : Organisme B, jusqu'à 9 h 04");
  // Minuit s'écrit 0 h, jamais 24 h.
  assert.equal(texteBandeauSupport("Organisme B", new Date("2026-11-28T23:30:00Z")), "Accès support : Organisme B, jusqu'à 0 h 30");
  // Les blancs autour du nom partent ; un nom absent ne laisse pas de virgule orpheline.
  assert.equal(texteBandeauSupport("  Organisme B ", new Date("2026-11-28T15:05:00+01:00")), "Accès support : Organisme B, jusqu'à 15 h 05");
  assert.equal(texteBandeauSupport("", new Date("2026-11-28T15:05:00+01:00")), "Accès support, jusqu'à 15 h 05");
  assert.equal(texteBandeauSupport(null, new Date("2026-11-28T15:05:00+01:00")), "Accès support, jusqu'à 15 h 05");
  // Une échéance illisible : le bandeau dit l'accès sans heure plutôt qu'une heure fausse.
  assert.equal(texteBandeauSupport("Organisme B", null), "Accès support : Organisme B");
  assert.equal(texteBandeauSupport("Organisme B", new Date("pas une date")), "Accès support : Organisme B");
});

test("motifSupportValide : 10 caractères au moins après le retrait des blancs, comme la base", () => {
  assert.equal(MOTIF_SUPPORT_MIN, 10);
  assert.equal(motifSupportValide("  court "), false);
  assert.equal(motifSupportValide("Aide au réglage des titres"), true);
  assert.equal(motifSupportValide("0123456789"), true);
  assert.equal(motifSupportValide("012345678"), false);
  assert.equal(motifSupportValide("   012345678   "), false);
  // Tabulations et retours à la ligne comptent comme des blancs (la base les retire aussi).
  assert.equal(motifSupportValide("\t\n012345678\n"), false);
  // La base compte des caractères, pas des unités UTF-16 : neuf lettres accentuées et un emoji font dix caractères.
  assert.equal(motifSupportValide("ééééééééé\u{1F600}"), true);
  for (const v of [null, undefined, 12345678901, {}, []]) assert.equal(motifSupportValide(v), false, JSON.stringify(v));
});

test("normaliserMonOrganisme : la ligne de mon_organisme() telle que l'app l'emploie", () => {
  assert.deepEqual(
    normaliserMonOrganisme({ id: 1, nom: "ECF BOUSCAREN", redacteur: true, habillage: "ecf", support_jusqua: null }),
    { id: 1, nom: "ECF BOUSCAREN", redacteur: true, habillage: "ecf", supportJusqua: null },
  );
  const avecSupport = normaliserMonOrganisme({ id: 2, nom: " Organisme B ", redacteur: false, habillage: null, support_jusqua: "2026-11-28T14:05:00+00:00" });
  assert.equal(avecSupport.nom, "Organisme B");
  assert.equal(avecSupport.redacteur, false);
  // Habillage nul : aucun réglage (règle du contrôleur) ; une valeur inconnue se lit comme aucun.
  assert.equal(avecSupport.habillage, null);
  assert.equal(normaliserMonOrganisme({ id: 2, nom: "B", habillage: "rose" }).habillage, null);
  assert.equal(normaliserMonOrganisme({ id: 2, nom: "B", habillage: "ecsr" }).habillage, "ecsr");
  assert.ok(avecSupport.supportJusqua instanceof Date);
  assert.equal(avecSupport.supportJusqua.toISOString(), "2026-11-28T14:05:00.000Z");
  // La fonction rend une table : un tableau d'une ligne se lit comme la ligne.
  assert.equal(normaliserMonOrganisme([{ id: 3, nom: "C", redacteur: false }]).id, 3);
  // Rien de lisible : nom vide, jamais un nom deviné.
  const vide = { id: null, nom: "", redacteur: false, habillage: null, supportJusqua: null };
  for (const v of [null, undefined, [], "x", 3, { nom: 12 }]) {
    assert.deepEqual(normaliserMonOrganisme(v), vide, JSON.stringify(v));
  }
  assert.equal(normaliserMonOrganisme({ id: 1, nom: "A", support_jusqua: "pas une date" }).supportJusqua, null);
  // redacteur n'est vrai que si la base dit vrai.
  assert.equal(normaliserMonOrganisme({ id: 1, nom: "A", redacteur: "true" }).redacteur, false);
});

test("supportEnCours et etatBandeauSupport : un accès ouvert, puis échu", () => {
  const jusqua = new Date("2026-11-28T15:05:00+01:00");
  const org = { id: 2, nom: "Organisme B", supportJusqua: jusqua };
  const avant = jusqua.getTime() - 60000;
  const apres = jusqua.getTime() + 1;
  assert.equal(supportEnCours(org, avant), true);
  assert.equal(supportEnCours(org, apres), false);
  assert.equal(supportEnCours({ ...org, supportJusqua: null }, avant), false);
  assert.equal(supportEnCours(null, avant), false);
  assert.deepEqual(etatBandeauSupport(org, avant), { visible: true, echu: false, texte: "Accès support : Organisme B, jusqu'à 15 h 05" });
  assert.deepEqual(etatBandeauSupport(org, apres),
    { visible: true, echu: true, texte: "Accès support à Organisme B terminé. Rechargez l'app pour revenir à votre organisme." });
  assert.deepEqual(etatBandeauSupport({ ...org, supportJusqua: null }, avant), { visible: false, echu: false, texte: "" });
  assert.deepEqual(etatBandeauSupport(null, avant), { visible: false, echu: false, texte: "" });
});

test("organismesProposes : la liste du fondateur, sans l'organisme affiché, triée par nom", () => {
  const liste = [{ id: 1, nom: "ECF BOUSCAREN" }, { id: 3, nom: "centre zéro" }, { id: 2, nom: "Organisme B" }, { id: "x", nom: "?" }, null, { id: 4 }];
  assert.deepEqual(organismesProposes(liste, 1), [{ id: 3, nom: "centre zéro" }, { id: 2, nom: "Organisme B" }]);
  assert.deepEqual(organismesProposes(liste, null).map((o) => o.id), [3, 1, 2]);
  assert.deepEqual(organismesProposes(null, 1), []);
});

test("organismeParDefaut : le nom saisi dans l'en-tête l'emporte, sinon celui de l'organisme, sinon rien", () => {
  assert.equal(organismeParDefaut("ECF BOUSCAREN", "Organisme B"), "ECF BOUSCAREN");
  assert.equal(organismeParDefaut("  ", "Organisme B"), "Organisme B");
  assert.equal(organismeParDefaut(null, " Organisme B "), "Organisme B");
  assert.equal(organismeParDefaut(undefined, ""), "");
  assert.equal(organismeParDefaut(12, null), "");
});

test("les refus de la base pour l'accès support se disent par leur phrase, sans préfixe", () => {
  assert.equal(phraseDeRefus("support: Le motif doit compter au moins 10 caractères.", "22023"), "Le motif doit compter au moins 10 caractères.");
  assert.equal(phraseDeRefus("support: Réservé au fondateur.", "42501"), "Réservé au fondateur.");
  assert.equal(phraseDeRefus("support: Vous êtes déjà rattaché à cet organisme.", "22023"), "Vous êtes déjà rattaché à cet organisme.");
  assert.equal(phraseDeRefus("organisme: Connexion requise.", "42501"), "Connexion requise.");
});

// Règle du contrôleur n° 2 : en accès support sur un organisme non rédacteur, case_reseau('cours') vaut 0 pour le fondateur alors
// que ses gestes d'écriture des contenus communs restent ouverts. L'app ne lit pas de case pour le fondateur hors aperçu : l'ancien
// prédicat (administrateur) décide, et les éditeurs des cours et des QCM restent affichés.
test("le fondateur hors aperçu garde les éditeurs des contenus communs, même sur un organisme non rédacteur", () => {
  const titreSansCours = { titre_id: 1, nom: "Formateur", niveau: "promo", lieu_id: 9, promo_ids: [90], cases: { cours: "non" } };
  for (const espace of ["equipe", "siege"]) {
    const cases = casesDeLEspace({ espace, titres: [titreSansCours], promoId: 90, lieuId: 9, fondateur: true });
    assert.equal(cases, null, espace);
    assert.equal(selonLaCase({ cases, droit: false, ancien: true }), true, espace);
  }
  // Contre-épreuve : un compte qui n'est pas le fondateur lit sa case, et la case à « Non » ferme l'éditeur.
  const cases = casesDeLEspace({ espace: "equipe", titres: [titreSansCours], promoId: 90, lieuId: 9, fondateur: false });
  assert.equal(cases.cours, 0);
  assert.equal(selonLaCase({ cases, droit: cases.cours === 2, ancien: true }), false);
});
