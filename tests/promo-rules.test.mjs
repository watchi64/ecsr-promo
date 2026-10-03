import assert from "node:assert/strict";
import {
  ENTETE_PROMO, doitPorterEntetePromo, choisirPromoInitiale, libelleCourtPromo, resumePromo, profilEffectif,
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
assert.equal(doitPorterEntetePromo("https://exemple.supabase.co.evil.example/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo("/rest/v1/x", SB), false);

// Adresse analysée (URL) et non comparée comme un texte : une barre finale dans la configuration, un hôte en
// capitales ou le port par défaut ne font pas taire l'en-tête sans erreur ; un chemin remonté, un autre port
// ou un autre schéma ne le reçoivent jamais.
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/x", SB + "/"), true);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/rpc/mes_promos", SB + "/"), true);
assert.equal(doitPorterEntetePromo(SB + "/functions/v1/chatbot", SB + "/"), false);
assert.equal(doitPorterEntetePromo(SB + "/auth/v1/token", SB + "/"), false);
assert.equal(doitPorterEntetePromo("https://EXEMPLE.Supabase.CO/rest/v1/x", SB), true);
assert.equal(doitPorterEntetePromo("https://exemple.supabase.co:443/rest/v1/x", SB), true);
assert.equal(doitPorterEntetePromo("https://exemple.supabase.co:8443/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo("http://exemple.supabase.co/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/../functions/v1/chatbot", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/%2e%2e/functions/v1/chatbot", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1", SB), false);

// Hôtes sosies, adresses relatives ou illisibles : jamais d'en-tête, jamais d'exception.
assert.equal(doitPorterEntetePromo("https://exemple-supabase.co/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo("https://exemple.supabase.co@autre.example/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo("https://autre.example/exemple.supabase.co/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo("rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo("//exemple.supabase.co/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/x", "pas une adresse"), false);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/x", ""), false);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/x", undefined), false);

// Passerelle avec un préfixe de chemin : l'API de données est sous ce préfixe, comme avec l'ancienne comparaison.
assert.equal(doitPorterEntetePromo("https://passerelle.example/api/rest/v1/x", "https://passerelle.example/api"), true);
assert.equal(doitPorterEntetePromo("https://passerelle.example/api/rest/v1/x", "https://passerelle.example/api/"), true);
assert.equal(doitPorterEntetePromo("https://passerelle.example/rest/v1/x", "https://passerelle.example/api"), false);

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
// Promo marquée par défaut qui n'est pas la première : cas réel après la fin de mars (11/12).
const MARS_ECHUE = { ...MARS, par_defaut: false };
const SEPT_DEFAUT = { ...SEPT, par_defaut: true };
assert.equal(choisirPromoInitiale([MARS_ECHUE, SEPT_DEFAUT], null), 2);
assert.equal(choisirPromoInitiale([MARS_ECHUE, SEPT_DEFAUT], "7"), 2);
assert.equal(choisirPromoInitiale([MARS_ECHUE, SEPT_DEFAUT], "1"), 1);

// Libellé court : mois et année, précédé du lieu seulement si plusieurs lieux.
assert.equal(libelleCourtPromo(MARS, [MARS, SEPT]), "mars 2026");
assert.equal(libelleCourtPromo(SEPT, [MARS, SEPT]), "sept. 2026");
assert.equal(libelleCourtPromo(MTP, [MARS, SEPT, MTP]), "Montpellier · janv. 2027");
assert.equal(libelleCourtPromo(SEPT, [MARS, SEPT, MTP]), "Nîmes · sept. 2026");
assert.equal(libelleCourtPromo(null, [MARS]), "");
assert.deepEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
  .map((mm) => libelleCourtPromo({ ...SEPT, date_debut: `2027-${mm}-01` }, [SEPT])),
  ["janv. 2027", "févr. 2027", "mars 2027", "avr. 2027", "mai 2027", "juin 2027", "juil. 2027",
   "août 2027", "sept. 2027", "oct. 2027", "nov. 2027", "déc. 2027"]);

// Seconde ligne d'un choix de promo : le compte de stagiaires (seulement si la base le donne) puis les jours
// avant la fin. « Aujourd'hui » est un instant LOCAL, lu à Paris : les jours se comptent d'une date de calendrier
// à l'autre, quelle que soit l'heure, même un jour de changement d'heure. Sans ce fuseau, sur une machine en UTC,
// les jours de 23 h et de 25 h plus bas ne prouveraient rien.
process.env.TZ = "Europe/Paris";
const AUJ = new Date(2026, 9, 3, 14, 30);  // le 3 octobre 2026, 14 h 30
const resume = (champs, auj = AUJ) => resumePromo({ ...MARS, ...champs }, auj);

// Les deux cas réels : mars (fin le 11 décembre) et Montpellier (pas encore de date de fin).
assert.equal(resume({ nb_stagiaires: 9, date_fin: "2026-12-11" }), "9 stagiaires en cours · fin dans 69 jours");
assert.equal(resume({ nb_stagiaires: 0, date_fin: null }), "Aucun stagiaire en cours · date de fin à venir");

// Compte : aucun, un seul, plusieurs.
assert.equal(resume({ nb_stagiaires: 0, date_fin: "2026-12-11" }), "Aucun stagiaire en cours · fin dans 69 jours");
assert.equal(resume({ nb_stagiaires: 1, date_fin: "2026-12-11" }), "1 stagiaire en cours · fin dans 69 jours");
assert.equal(resume({ nb_stagiaires: 2, date_fin: "2026-12-11" }), "2 stagiaires en cours · fin dans 69 jours");

// Sans compte exploitable (colonne absente d'une base plus ancienne, ou valeur qui n'est pas un entier positif
// ou nul) : la seconde partie reste seule, avec sa majuscule.
assert.equal(resume({ date_fin: "2026-12-11" }), "Fin dans 69 jours");
assert.equal(resume({ nb_stagiaires: null, date_fin: "2026-12-11" }), "Fin dans 69 jours");
assert.equal(resume({ nb_stagiaires: "9", date_fin: "2026-12-11" }), "Fin dans 69 jours");
assert.equal(resume({ nb_stagiaires: NaN, date_fin: "2026-12-11" }), "Fin dans 69 jours");
assert.equal(resume({ nb_stagiaires: -1, date_fin: "2026-12-11" }), "Fin dans 69 jours");
assert.equal(resume({ date_fin: null }), "Date de fin à venir");

// Jours avant la fin : lointaine, après-demain, demain, aujourd'hui, passée, pas de date.
assert.equal(resume({ date_fin: "2027-10-03" }), "Fin dans 365 jours");
assert.equal(resume({ date_fin: "2026-10-05" }), "Fin dans 2 jours");
assert.equal(resume({ date_fin: "2026-10-04" }), "Fin demain");
assert.equal(resume({ date_fin: "2026-10-03" }), "Fin aujourd'hui");
assert.equal(resume({ date_fin: "2026-10-02" }), "Formation terminée");
assert.equal(resume({ date_fin: "2025-12-11" }), "Formation terminée");
assert.equal(resume({ nb_stagiaires: 1, date_fin: "2026-10-04" }), "1 stagiaire en cours · fin demain");
assert.equal(resume({ nb_stagiaires: 9, date_fin: "2026-10-03" }), "9 stagiaires en cours · fin aujourd'hui");
assert.equal(resume({ nb_stagiaires: 9, date_fin: "2026-10-02" }), "9 stagiaires en cours · formation terminée");
assert.equal(resume({ nb_stagiaires: 3 }), "3 stagiaires en cours · date de fin à venir");

// Calendrier : jour bissextile et passage d'une année à l'autre.
assert.equal(resume({ date_fin: "2028-03-01" }, new Date(2028, 1, 28, 9, 0)), "Fin dans 2 jours");
assert.equal(resume({ date_fin: "2027-03-01" }, new Date(2027, 1, 28, 9, 0)), "Fin demain");
assert.equal(resume({ date_fin: "2027-01-01" }, new Date(2026, 11, 31, 23, 0)), "Fin demain");

// L'heure n'y change rien : minuit pile, une seconde avant minuit, et 0 h 30 le lendemain (lu en UTC, ce
// 0 h 30 serait encore la veille).
assert.equal(resume({ date_fin: "2026-10-04" }, new Date(2026, 9, 3, 0, 0, 0)), "Fin demain");
assert.equal(resume({ date_fin: "2026-10-04" }, new Date(2026, 9, 3, 23, 59, 59)), "Fin demain");
assert.equal(resume({ date_fin: "2026-10-04" }, new Date(2026, 9, 4, 0, 30)), "Fin aujourd'hui");
assert.equal(resume({ date_fin: "2026-10-03" }, new Date(2026, 9, 4, 0, 30)), "Formation terminée");

// Changements d'heure : le dimanche 29 mars 2026 dure 23 h, le dimanche 25 octobre 25 h ; les jours comptés
// restent entiers (du 24 au 26 octobre : 2 jours, bien que 49 h séparent les deux minuits).
assert.equal(resume({ date_fin: "2026-10-26" }, new Date(2026, 9, 24, 12, 0)), "Fin dans 2 jours");
assert.equal(resume({ date_fin: "2026-10-26" }, new Date(2026, 9, 24, 0, 0)), "Fin dans 2 jours");
assert.equal(resume({ date_fin: "2026-10-26" }, new Date(2026, 9, 24, 23, 59)), "Fin dans 2 jours");
assert.equal(resume({ date_fin: "2026-10-26" }, new Date(2026, 9, 25, 23, 30)), "Fin demain");
assert.equal(resume({ date_fin: "2026-03-30" }, new Date(2026, 2, 28, 0, 0)), "Fin dans 2 jours");
assert.equal(resume({ date_fin: "2026-03-30" }, new Date(2026, 2, 28, 23, 59)), "Fin dans 2 jours");
assert.equal(resume({ date_fin: "2026-03-30" }, new Date(2026, 2, 29, 12, 0)), "Fin demain");

// Sans second argument : la date du jour de la machine.
assert.equal(resumePromo({ ...MARS, date_fin: "2000-01-01" }), "Formation terminée");
assert.match(resumePromo({ ...MARS, date_fin: "2999-12-31" }), /^Fin dans \d+ jours$/);

// Entrées incomplètes : jamais « NaN », jamais d'exception ; la promo reçue n'est pas modifiée (gelée ici).
assert.equal(resume({ date_fin: "" }), "Date de fin à venir");
assert.equal(resume({ date_fin: "pas une date" }), "Date de fin à venir");
assert.equal(resumePromo(null, AUJ), "");
assert.equal(resumePromo(undefined, AUJ), "");
assert.equal(resumePromo(Object.freeze({ ...MARS, nb_stagiaires: 9, date_fin: "2026-12-11" }), AUJ),
  "9 stagiaires en cours · fin dans 69 jours");

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
// Liste verrouillée : un champ oublié partirait dans les anciennes colonnes de themes, que la
// synchronisation de bascule recopie dans mars.
assert.deepEqual([...CHAMPS_PROGRESSION].sort(), ["date_fait", "date_qcm", "notes", "statut", "updated_by_email"]);

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
assert.deepEqual(fusionnerProgression({ ...THEME, progression: [{ statut: "En cours", date_fait: null,
  date_qcm: "2026-10-09", notes: "à revoir", updated_by_email: null }] }),
  { id: 5, numero: 5, titre: "T", type: "theme", statut: "En cours", date_fait: null, date_qcm: "2026-10-09",
    notes: "à revoir", updated_by_email: null });

// Fusion de l'état d'examen : un QCM sans ligne d'examen dans la promo est fermé.
const QCM = { id: 50, theme_id: 5, titre: "Q", published: true, exam_seconds_per_question: 45,
  exam_ferme_a: "2026-09-01T10:00:00Z", qcm_questions: [{ count: 3 }] };
const ferme = fusionnerExamen({ ...QCM, examen: [] });
assert.equal(ferme.published, false);
assert.equal(ferme.exam_seconds_per_question, 30);
assert.equal(ferme.exam_ferme_a, null);
assert.deepEqual(ferme.qcm_questions, [{ count: 3 }]);
assert.equal("examen" in ferme, false);
const { qcm_questions: _questions, ...fermeSansQuestions } = ferme;
assert.deepEqual(fermeSansQuestions, { id: 50, theme_id: 5, titre: "Q", published: false,
  published_by_email: null, published_at: null, exam_nb_questions: null, exam_question_ids: null,
  exam_draw_mode: null, exam_seconds_per_question: 30, exam_ferme_a: null });
const ouvert = fusionnerExamen({ ...QCM, examen: [{ published: true, published_by_email: "h@example.test",
  published_at: "2026-10-02T08:00:00Z", exam_nb_questions: 2, exam_question_ids: [1, 2],
  exam_draw_mode: "manual", exam_seconds_per_question: 20, exam_ferme_a: null }] });
assert.equal(ouvert.published, true);
assert.equal(ouvert.exam_seconds_per_question, 20);
assert.deepEqual(ouvert.exam_question_ids, [1, 2]);
assert.equal(ouvert.exam_draw_mode, "manual");
assert.deepEqual([...CHAMPS_EXAMEN].sort(), ["exam_draw_mode", "exam_ferme_a", "exam_nb_questions",
  "exam_question_ids", "exam_seconds_per_question", "published", "published_at", "published_by_email"]);

console.log("promo-rules : 116 assertions OK");
