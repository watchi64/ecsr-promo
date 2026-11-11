// Effacement des données : confirmation, textes d'état. Lancer depuis la racine du dépôt :
// node tests/effacement-rules.test.mjs
import assert from "node:assert/strict";
import {
  confirmationValide, dateCourte, dateLongue, etatFinDePromo, resumeEffacement,
  questionAnonymiserPromo, questionPurgerBenevoles, phraseAnonymises, phrasePurges, lignesDonneesCentre,
  phraseDePanne, phraseDEffacement, PHRASE_ETAT_INDISPONIBLE, PHRASE_DONNEES_ECHEC, MOT_ANONYMISER,
} from "../js/effacement-rules.js";

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
eq(dateLongue("2027-12-11"), "11 décembre 2027", "date dans une phrase");
eq(dateLongue("2027-03-01"), "1er mars 2027", "le 1er du mois");
eq(dateLongue(null), "", "date longue absente");

// Fin de promo
eq(etatFinDePromo(null).bouton, false, "pas de promo");
ok(/non renseignée/.test(etatFinDePromo({ date_fin: null }).texte), "date de fin absente");
const avant = etatFinDePromo({ date_fin: "2026-12-11", anonymisable_le: "2027-12-11", anonymisable: false, restants: 15, comptes_admin: 1 });
eq(avant.bouton, false, "trop tôt : pas de bouton");
ok(avant.texte.includes("le 11 décembre 2026") && avant.texte.includes("du 11 décembre 2027"), "trop tôt : les deux dates, en toutes lettres");
const pret = etatFinDePromo({ date_fin: "2025-01-01", anonymisable_le: "2026-01-01", anonymisable: true, restants: 15, comptes_admin: 1 });
eq(pret.bouton, true, "délai écoulé : bouton");
ok(pret.texte.includes("14 fiches") && /administrateur/.test(pret.texte), "fiches à traiter hors compte admin");
const fini = etatFinDePromo({ date_fin: "2025-01-01", anonymisable: true, restants: 1, comptes_admin: 1 });
eq(fini.bouton, false, "seul le compte admin reste : pas de bouton");
ok(/anonymisées/.test(fini.texte), "promo traitée");

// Compte rendu
eq(resumeEffacement({ deja: true }), "Ces données étaient déjà effacées.", "déjà fait");
const r = resumeEffacement({ comptes: 1, date_naissance: 1, livret: 1, dossier_pro: 0, fiche_suivi: 1, epcf_textes: 2, observations: 1, commentaires_passages: 0 });
ok(r.startsWith("Effacé : compte de connexion, date de naissance, livret EPCF, fiche de suivi, 3 commentaires."), "compte rendu détaillé");
ok(resumeEffacement({ dossier_pro: 1 }).startsWith("Effacé : dossier professionnel."), "le dossier professionnel, en toutes lettres");
ok(/sans nom/.test(resumeEffacement({})), "compte rendu minimal");

// Données personnelles du centre (suite du lot 5)
{
  const q = questionAnonymiserPromo("Nîmes, mars 2026");
  ok(q.titre.includes("« Nîmes, mars 2026 »") && /Irréversible/.test(q.phrase) && q.libelle === "Pour confirmer, tapez ANONYMISER" && q.oui === "Anonymiser",
    "question d'anonymisation : titre, phrase, libellé et bouton, comme chez le formateur");
  ok(q.verifier("ANONYMISER") && q.verifier("  ANONYMISER ") && !q.verifier("anonymiser") && !q.verifier("") && !q.verifier(null), "seul le mot exact (espaces ignorés) confirme");
  ok(MOT_ANONYMISER === "ANONYMISER" && questionAnonymiserPromo("").titre.includes("cette promo"), "promo sans nom : « cette promo »");
  eq(questionPurgerBenevoles(1).titre, "Supprimer 1 élève bénévole et leurs coordonnées ?", "purge d'un élève");
  eq(questionPurgerBenevoles(3).titre, "Supprimer 3 élèves bénévoles et leurs coordonnées ?", "purge de plusieurs élèves");
  eq(phraseAnonymises(1), "1 fiche anonymisée.", "une fiche anonymisée");
  eq(phraseAnonymises(5), "5 fiches anonymisées.", "plusieurs fiches anonymisées");
  eq(phrasePurges(1), "1 élève bénévole supprimé.", "un élève supprimé");
  eq(phrasePurges(2), "2 élèves bénévoles supprimés.", "plusieurs élèves supprimés");
  const promos = [
    { id: 1, nom: "Nîmes, mars 2025", date_debut: "2025-03-01" },
    { id: 2, nom: "Nîmes, septembre 2026", date_debut: "2026-09-30" },
    { id: 3, nom: "Nîmes, mars 2024", date_debut: "2024-03-01" },
    { id: 4, nom: "Nîmes, 2023", date_debut: "2023-03-01" },
  ];
  const etats = {
    1: { date_fin: "2025-06-30", anonymisable_le: "2026-06-30", anonymisable: true, restants: 6, comptes_admin: 1, anonymises: 0 },
    2: { date_fin: null, anonymisable: false, restants: 4, comptes_admin: 0, anonymises: 0 },
    3: { date_fin: "2024-06-30", anonymisable_le: "2025-06-30", anonymisable: true, restants: 1, comptes_admin: 1, anonymises: 5 },
  };
  const lignes = lignesDonneesCentre(promos, etats);
  eq(lignes.map((l) => l.promoId), [1, 2, 3, 4], "à anonymiser d'abord, puis la plus récente d'abord");
  eq(lignes.map((l) => l.bouton), [true, false, false, false], "le bouton seulement pour la promo qui a des fiches à anonymiser");
  ok(/5 fiches à anonymiser/.test(lignes[0].texte), "la phrase d'état est celle du formateur");
  ok(/non renseignée/.test(lignes[1].texte) && /anonymisées/.test(lignes[2].texte), "date de fin absente ; promo déjà traitée");
  eq([lignes[3].texte, lignes[3].bouton, lignes[3].indisponible], [PHRASE_ETAT_INDISPONIBLE, false, true], "lecture ratée : la phrase, sans bouton, sans bloquer les autres");
  eq(lignesDonneesCentre([], {}), [], "centre sans promo");
  eq(lignesDonneesCentre(null, null), [], "entrées absentes");
  // Les pannes se disent par leur phrase, jamais par un texte technique.
  eq(phraseDePanne({ code: "PGRST202", message: "Could not find the function public.benevoles_a_purger" }), "Cette action n'est pas encore disponible.", "fonction absente");
  eq(phraseDePanne({ message: "TypeError: Failed to fetch" }), "La connexion a échoué. Vérifier le réseau, puis réessayer.", "réseau coupé (phrase neutre, lot D)");
  eq(phraseDePanne({ code: "42501", message: "Réservé à la direction du centre" }), "Vous n'avez pas le droit de faire cela ici.", "droit manquant (équipe vouvoyée, lot D)");
  eq(phraseDePanne({ code: "XX000", message: "internal error at line 12" }), PHRASE_DONNEES_ECHEC, "toute autre panne : la phrase de la section");
  eq(phraseDePanne(null), PHRASE_DONNEES_ECHEC, "panne sans détail");
  eq(phraseDEffacement({ code: "P0001", message: "Anonymisation possible à partir du 12/10/2027" }), "Anonymisation possible à partir du 12/10/2027", "phrase de la base gardée");
  eq(phraseDEffacement({ message: "" }), PHRASE_DONNEES_ECHEC, "refus sans phrase");
}

console.log(`effacement-rules : ${n} vérifications OK`);
