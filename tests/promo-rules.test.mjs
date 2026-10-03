import assert from "node:assert/strict";
import {
  ENTETE_PROMO, doitPorterEntetePromo, choisirPromoInitiale, libelleCourtPromo, profilEffectif,
  CHAMPS_PROGRESSION, CHAMPS_EXAMEN, separerChamps, fusionnerProgression, fusionnerExamen,
} from "../js/promo-rules.js";

const SB = "https://exemple.supabase.co";

// En-tête : l'API de données oui, les fonctions Edge, l'auth et le stockage non.
assert.equal(ENTETE_PROMO, "x-promo-id");
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/planning_entries?select=*", SB), true);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/rpc/mes_promos", SB), true);
assert.equal(doitPorterEntetePromo(SB + "/functions/v1/chatbot", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/auth/v1/token?grant_type=password", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/storage/v1/object/qcm-images/a.png", SB), false);
assert.equal(doitPorterEntetePromo("https://autre.example/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo(undefined, SB), false);

const MARS = { id: 1, nom: "Nîmes, mars 2026", lieu_id: 1, lieu_nom: "Nîmes",
  date_debut: "2026-03-30", par_defaut: true, stagiaire_id: 15 };
const SEPT = { id: 2, nom: "Nîmes, septembre 2026", lieu_id: 1, lieu_nom: "Nîmes",
  date_debut: "2026-09-30", par_defaut: false, stagiaire_id: null };
const MTP = { id: 3, nom: "Montpellier, janvier 2027", lieu_id: 2, lieu_nom: "Montpellier",
  date_debut: "2027-01-11", par_defaut: false, stagiaire_id: null };

// Promo de départ : la mémorisée si elle est encore accessible, sinon celle par défaut.
assert.equal(choisirPromoInitiale([MARS, SEPT], "2"), 2);
assert.equal(choisirPromoInitiale([MARS, SEPT], 2), 2);
assert.equal(choisirPromoInitiale([MARS, SEPT], "7"), 1);
assert.equal(choisirPromoInitiale([MARS, SEPT], null), 1);
assert.equal(choisirPromoInitiale([MARS, SEPT], ""), 1);
assert.equal(choisirPromoInitiale([MARS, SEPT], "abc"), 1);
assert.equal(choisirPromoInitiale([SEPT], null), 2);
assert.equal(choisirPromoInitiale([], "1"), null);
assert.equal(choisirPromoInitiale(null, "1"), null);

// Libellé court : mois et année, précédé du lieu seulement si plusieurs lieux.
assert.equal(libelleCourtPromo(MARS, [MARS, SEPT]), "mars 2026");
assert.equal(libelleCourtPromo(SEPT, [MARS, SEPT]), "sept. 2026");
assert.equal(libelleCourtPromo(MTP, [MARS, SEPT, MTP]), "Montpellier · janv. 2027");
assert.equal(libelleCourtPromo(SEPT, [MARS, SEPT, MTP]), "Nîmes · sept. 2026");
assert.equal(libelleCourtPromo(null, [MARS]), "");

// Profil effectif dans la promo courante.
const FONDATEUR = { email: "f@example.test", role: "stagiaire", stagiaire_id: 15, is_admin: true, is_founder: true };
assert.deepEqual(profilEffectif(FONDATEUR, MARS), { ...FONDATEUR, stagiaire_id: 15, role: "stagiaire" });
assert.deepEqual(profilEffectif(FONDATEUR, SEPT), { ...FONDATEUR, stagiaire_id: null, role: "admin" });
const FORMATEUR = { email: "h@example.test", role: "prof", stagiaire_id: null, prof_id: 1, is_admin: true };
assert.deepEqual(profilEffectif(FORMATEUR, SEPT), { ...FORMATEUR, stagiaire_id: null, role: "prof" });
assert.deepEqual(profilEffectif(FONDATEUR, null), FONDATEUR);
assert.equal(profilEffectif(null, MARS), null);

// Séparation d'un patch.
assert.deepEqual(separerChamps({ statut: "Fait", date_fait: "2026-10-02", titre: "X" }, CHAMPS_PROGRESSION),
  { dans: { statut: "Fait", date_fait: "2026-10-02" }, hors: { titre: "X" } });
assert.deepEqual(separerChamps(undefined, CHAMPS_PROGRESSION), { dans: {}, hors: {} });
assert.deepEqual(separerChamps({ exam_seconds_per_question: 45, titre: "Q" }, CHAMPS_EXAMEN),
  { dans: { exam_seconds_per_question: 45 }, hors: { titre: "Q" } });

// Fusion de la progression : les anciennes colonnes du thème sont toujours écrasées.
const THEME = { id: 5, numero: 5, titre: "T", type: "theme", statut: "Fait", date_fait: "2026-05-01",
  date_qcm: "2026-05-02", notes: "vieux", updated_by_email: "vieux@example.test" };
assert.deepEqual(fusionnerProgression({ ...THEME, progression: [] }),
  { id: 5, numero: 5, titre: "T", type: "theme", statut: "À faire", date_fait: null, date_qcm: null,
    notes: null, updated_by_email: null });
assert.deepEqual(fusionnerProgression({ ...THEME, progression: [{ statut: "Fait", date_fait: "2026-10-05",
  date_qcm: null, notes: null, updated_by_email: "h@example.test" }] }),
  { id: 5, numero: 5, titre: "T", type: "theme", statut: "Fait", date_fait: "2026-10-05", date_qcm: null,
    notes: null, updated_by_email: "h@example.test" });
assert.equal(fusionnerProgression({ ...THEME }).statut, "À faire");

// Fusion de l'état d'examen : un QCM sans ligne d'examen dans la promo est fermé.
const QCM = { id: 50, theme_id: 5, titre: "Q", published: true, exam_seconds_per_question: 45,
  exam_ferme_a: "2026-09-01T10:00:00Z", qcm_questions: [{ count: 3 }] };
const ferme = fusionnerExamen({ ...QCM, examen: [] });
assert.equal(ferme.published, false);
assert.equal(ferme.exam_seconds_per_question, 30);
assert.equal(ferme.exam_ferme_a, null);
assert.deepEqual(ferme.qcm_questions, [{ count: 3 }]);
assert.equal("examen" in ferme, false);
const ouvert = fusionnerExamen({ ...QCM, examen: [{ published: true, published_by_email: "h@example.test",
  published_at: "2026-10-02T08:00:00Z", exam_nb_questions: 2, exam_question_ids: [1, 2],
  exam_draw_mode: "manual", exam_seconds_per_question: 20, exam_ferme_a: null }] });
assert.equal(ouvert.published, true);
assert.equal(ouvert.exam_seconds_per_question, 20);
assert.deepEqual(ouvert.exam_question_ids, [1, 2]);
assert.equal(ouvert.exam_draw_mode, "manual");
assert.deepEqual([...CHAMPS_EXAMEN].sort(), ["exam_draw_mode", "exam_ferme_a", "exam_nb_questions",
  "exam_question_ids", "exam_seconds_per_question", "published", "published_at", "published_by_email"]);

console.log("promo-rules : 43 assertions OK");
