// Nouvelle navigation (refonte, lot 1) : quelle navigation s'affiche, selon le réglage de la
// promo et l'aperçu du fondateur sur son appareil. Partie pure seulement (la lecture en base
// et la section de Paramètres touchent au DOM).
import assert from "node:assert/strict";
import {
  CLE_REGLAGE, CLE_APERCU, decideNavigationV2, reglageAllume, reglageRetenu, cleMemoire, navigationAttendue, etatDeLaCase,
} from "../js/nav-etat-regles.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Les six cas de la spec
eq(decideNavigationV2({ reglagePromo: true, apercu: null, fondateur: false }), true, "réglage allumé");
eq(decideNavigationV2({ reglagePromo: false, apercu: null, fondateur: false }), false, "réglage éteint");
eq(decideNavigationV2({ reglagePromo: null, apercu: null, fondateur: false }), false, "réglage absent ou illisible : éteint");
eq(decideNavigationV2({ reglagePromo: false, apercu: "1", fondateur: true }), true, "aperçu allumé du fondateur");
eq(decideNavigationV2({ reglagePromo: true, apercu: "0", fondateur: true }), false, "aperçu éteint du fondateur : prime sur le réglage");
eq(decideNavigationV2({ reglagePromo: false, apercu: "1", fondateur: false }), false, "aperçu d'un non-fondateur ignoré");

// 2. Autour de l'aperçu
eq(decideNavigationV2({ reglagePromo: null, apercu: "1", fondateur: true }), true, "aperçu sans réglage lu (avant la lecture, ou lecture ratée)");
eq(decideNavigationV2({ reglagePromo: null, apercu: "0", fondateur: true }), false, "aperçu éteint sans réglage lu");
eq(decideNavigationV2({ reglagePromo: true, apercu: null, fondateur: true }), true, "fondateur sans aperçu : le réglage, allumé");
eq(decideNavigationV2({ reglagePromo: false, apercu: null, fondateur: true }), false, "fondateur sans aperçu : le réglage, éteint");
eq(decideNavigationV2({ reglagePromo: true, apercu: "0", fondateur: false }), true, "aperçu éteint d'un non-fondateur ignoré aussi");
eq(decideNavigationV2({ reglagePromo: true, apercu: "oui", fondateur: true }), true, "valeur d'aperçu inconnue : le réglage, allumé");
eq(decideNavigationV2({ reglagePromo: false, apercu: "true", fondateur: true }), false, "valeur d'aperçu inconnue : le réglage, éteint");
eq(decideNavigationV2({ reglagePromo: false, apercu: "1" }), false, "fondateur absent : pas fondateur");
eq(decideNavigationV2({ reglagePromo: false, apercu: "1", fondateur: 1 }), false, "fondateur doit être vrai, pas seulement vrai-ish");

// 3. Lecture du réglage de la promo (la table settings garde du texte)
eq(reglageAllume("true"), true, "texte « true »");
eq(reglageAllume(true), true, "booléen true");
eq(reglageAllume("false"), false, "texte « false »");
eq(reglageAllume(null), false, "aucun réglage");
eq(reglageAllume(undefined), false, "réglage non lu");
eq(reglageAllume("1"), false, "une autre valeur n'allume jamais");

// 4. Clés : la première est écrite en base, les autres sur l'appareil ; des scripts les citent
eq(CLE_REGLAGE, "navigation_v2", "clé du réglage de la promo");
eq(CLE_APERCU, "ecsr_nav_v2", "clé de l'aperçu sur l'appareil");
eq(cleMemoire(1), "ecsr_nav_v2_promo:1", "mémoire du dernier réglage lu, propre à la promo");
eq(cleMemoire(7), "ecsr_nav_v2_promo:7", "une autre promo, une autre clé");
eq(cleMemoire(null), null, "sans promo, pas de mémoire");
eq(cleMemoire(undefined), null, "promo inconnue, pas de mémoire");

// 5. Navigation attendue à l'ouverture, avant la lecture du réglage (R17) : la mémoire de l'appareil pour la
//    promo affichée tient lieu de réglage, l'aperçu du fondateur prime toujours. La mémoire est lue par une
//    fonction (localStorage dans l'app) : ici, un appareil où seule la promo 1 a été vue allumée.
const appareil = (valeurs) => (cle) => (cle in valeurs ? valeurs[cle] : null);
const promo1Allumee = appareil({ [cleMemoire(1)]: "1" });
const attendue = (promoId, apercu = null, fondateur = false, lireMemoire = promo1Allumee) =>
  navigationAttendue({ promoId, lireMemoire, apercu, fondateur });
eq(attendue(1), true, "promo allumée la dernière fois sur l'appareil");
eq(attendue(2), false, "la mémoire de la promo 1 ne vaut pas pour la promo 2");
eq(attendue(null), false, "sans promo connue, pas de mémoire");
eq(attendue(1, null, false, appareil({})), false, "rien en mémoire : l'ancienne barre, comme avant");
eq(attendue(1, null, false, appareil({ [cleMemoire(1)]: "0" })), false, "autre valeur en mémoire : éteint");
eq(attendue(1, null, false, appareil({ [cleMemoire(1)]: "true" })), false, "seul « 1 » vaut allumé");
eq(attendue(2, "1", true), true, "aperçu du fondateur, sans mémoire pour cette promo");
eq(attendue(1, "0", true), false, "aperçu éteint du fondateur : prime sur la mémoire");
eq(attendue(2, "1", false), false, "aperçu d'un non-fondateur ignoré");
eq(attendue(1, "0", false), true, "aperçu d'un non-fondateur ignoré, la mémoire compte");
eq(navigationAttendue({}), false, "sans rien : éteint");
// Seule la clé de la promo affichée est lue : celle d'une autre promo ne l'est jamais.
const lues = [];
navigationAttendue({ promoId: 2, lireMemoire: (cle) => { lues.push(cle); return "1"; } });
eq(lues, [cleMemoire(2)], "une seule lecture, la clé de la promo affichée");
const aucune = [];
navigationAttendue({ promoId: null, lireMemoire: (cle) => { aucune.push(cle); return "1"; } });
eq(aucune, [], "sans promo, aucune lecture");

// 6. Réglage retenu pour la session (relecture finale, mineur 2) : la lecture l'emporte quand elle aboutit ;
//    ratée ou trop lente (lu = null), la mémoire de l'appareil prend sa place, et sans mémoire c'est éteint,
//    comme avant.
eq(reglageRetenu({ lu: true, memoire: null }), true, "lecture aboutie : allumé");
eq(reglageRetenu({ lu: false, memoire: "1" }), false, "lecture aboutie : éteint, même si la mémoire disait allumé");
eq(reglageRetenu({ lu: true, memoire: "1" }), true, "lecture et mémoire d'accord");
eq(reglageRetenu({ lu: null, memoire: "1" }), true, "lecture ratée ou trop lente, promo allumée la dernière fois : allumé");
eq(reglageRetenu({ lu: null, memoire: null }), null, "lecture ratée sans mémoire : rien (éteint)");
eq(reglageRetenu({ lu: null, memoire: "0" }), null, "seul « 1 » vaut allumé en mémoire");
eq(reglageRetenu({ lu: null, memoire: "true" }), null, "autre valeur en mémoire : rien");
eq(reglageRetenu({}), null, "sans rien : rien");
eq(reglageRetenu(), null, "sans argument : rien");
eq(reglageRetenu({ lu: "true", memoire: null }), null, "lu doit être un booléen (reglageAllume) : un texte n'allume pas");
// La décision de la session, telle que js/nav-etat.js la prend après la lecture.
const session = (lu, memoire, apercu = null, fondateur = false) =>
  decideNavigationV2({ reglagePromo: reglageRetenu({ lu, memoire }), apercu, fondateur });
eq(session(null, "1"), true, "lecture ratée, mémoire allumée : la nouvelle navigation, stable d'une ouverture à l'autre");
eq(session(null, null), false, "lecture ratée, sans mémoire : l'ancienne, comme avant");
eq(session(false, "1"), false, "promo éteinte depuis : la lecture aboutie l'emporte sur la mémoire");
eq(session(null, "1", "0", true), false, "aperçu éteint du fondateur : prime sur la mémoire");
eq(session(null, null, "1", true), true, "aperçu allumé du fondateur, lecture ratée (ruling R7)");
eq(session(null, "1", "0", false), true, "aperçu d'un non-fondateur ignoré : la mémoire compte");
// Avant la lecture, l'attente de l'ouverture suit la même mémoire : rien ne change pour l'ancienne barre (R17).
eq(attendue(1), session(null, "1"), "l'attente de l'ouverture et la décision sur lecture ratée disent la même chose");
eq(attendue(2), session(null, null), "idem sans mémoire pour la promo affichée");

// 7. Case « Promo affichée » de Paramètres (lot 2A, tâche 6) : le réglage quand sa lecture a abouti ; après une lecture
//    ratée ou trop lente (réglage null pour toute la session), l'état réellement appliqué (navigationV2Active()), au lieu
//    de paraître décochée alors que la barre est la nouvelle.
eq(etatDeLaCase({ reglage: true, appliquee: false }), true, "lecture aboutie, allumée : cochée, quoi que la session applique");
eq(etatDeLaCase({ reglage: false, appliquee: true }), false, "lecture aboutie, éteinte : décochée, même si la session applique la nouvelle navigation (aperçu)");
eq(etatDeLaCase({ reglage: true, appliquee: true }), true, "lecture aboutie et session d'accord : cochée");
eq(etatDeLaCase({ reglage: false, appliquee: false }), false, "lecture aboutie et session d'accord : décochée");
eq(etatDeLaCase({ reglage: null, appliquee: true }), true, "lecture ratée, nouvelle navigation appliquée : cochée, comme la barre");
eq(etatDeLaCase({ reglage: null, appliquee: false }), false, "lecture ratée, ancienne navigation appliquée : décochée");
eq(etatDeLaCase({ reglage: null }), false, "lecture ratée, rien d'appliqué dit : décochée");
eq(etatDeLaCase({}), false, "sans rien : décochée");
eq(etatDeLaCase(), false, "sans argument : décochée");
eq(etatDeLaCase({ reglage: "true", appliquee: false }), false, "un réglage qui n'est pas un booléen compte pour illisible : l'état appliqué décide");
eq(etatDeLaCase({ reglage: undefined, appliquee: "oui" }), false, "l'état appliqué doit être vrai, pas seulement vrai-ish");
// Après une lecture ratée, la case dit ce que la session a décidé (R17 : la mémoire de l'appareil), jamais « décochée » par défaut.
eq(etatDeLaCase({ reglage: null, appliquee: session(null, "1") }), true, "promo vue allumée sur l'appareil, lecture ratée : cochée");
eq(etatDeLaCase({ reglage: null, appliquee: session(null, null) }), false, "aucune mémoire, lecture ratée : décochée");
eq(etatDeLaCase({ reglage: null, appliquee: session(null, "1", "0", true) }), false, "aperçu éteint du fondateur, lecture ratée : la session applique l'ancienne, décochée");

console.log(`nav-etat : ${n} assertions OK`);
