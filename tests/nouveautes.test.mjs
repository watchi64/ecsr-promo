import assert from "node:assert/strict";
import {
  triees, visibles, nonLues, libellePastille, purger, ajouterVues, idsDeReprise, amorcePour,
  guideSelonNavigation, STORAGE_SOUS_ONGLET,
} from "../js/nouveautes.js";
import { CLES_SOUS_ONGLETS } from "../js/nav-rules.js";
import { NOUVEAUTES } from "../js/nouveautes-data.js";
import { MODULES } from "../js/modules-data.js";

const E = [
  { id: "a", date: "2026-07-02", pour: "formateurs" },
  { id: "b", date: "2026-07-31", pour: "tous" },
  { id: "c", date: "2026-07-31", pour: "tous" },
  { id: "d", date: "2026-07-19", pour: "tous" },
];

// Tri antéchronologique. À date égale (b et c), l'ordre du fichier de contenu
// est conservé : Array.prototype.sort est stable depuis ES2019.
assert.deepEqual(triees(E).map((e) => e.id), ["b", "c", "d", "a"]);
// Le tri ne modifie pas le tableau reçu.
assert.deepEqual(E.map((e) => e.id), ["a", "b", "c", "d"]);

// Audience : une entrée « formateurs » disparaît pour un stagiaire.
assert.deepEqual(visibles(E, true).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(visibles(E, false).map((e) => e.id), ["b", "c", "d"]);

// Non-lu : une entrée est neuve tant que son id n'a pas été vu.
assert.deepEqual(nonLues(E, ["b", "d"]).map((e) => e.id), ["a", "c"]);
assert.deepEqual(nonLues(E, []).map((e) => e.id), ["a", "b", "c", "d"]);
assert.deepEqual(nonLues(E, null).map((e) => e.id), ["a", "b", "c", "d"]);

// Pastille : rien à zéro, le compte jusqu'à 9, « 9+ » au-delà.
assert.equal(libellePastille(0), "");
assert.equal(libellePastille(3), "3");
assert.equal(libellePastille(9), "9");
assert.equal(libellePastille(10), "9+");

// Purge : un id mémorisé qui ne correspond plus à aucune entrée disparaît.
assert.deepEqual(purger(["a", "obsolete"], E), ["a"]);
// Ajout sans doublon, purgé au passage.
assert.deepEqual(ajouterVues(["a"], ["a", "b", "obsolete"], E), ["a", "b"]);
// Une annonce d'ouverture de module n'est jamais purgée, même absente de la
// liste du moment (état des modules illisible au démarrage).
assert.deepEqual(purger(["module-notes-2026-10-12T13:30:00.000Z", "obsolete"], E),
                 ["module-notes-2026-10-12T13:30:00.000Z"]);

// Amorce : au premier accès, les entrées antérieures ou égales à la mise en
// ligne sont déjà lues. Celles qui lui sont postérieures restent neuves, sinon
// une nouveauté publiée le jour même passerait inaperçue.
assert.deepEqual(idsDeReprise(E, "2026-07-31"), ["a", "b", "c", "d"]);
assert.deepEqual(idsDeReprise(E, "2026-07-19"), ["a", "d"]);
assert.deepEqual(idsDeReprise(E, "2026-07-01"), []);
// Une entrée postérieure à la mise en ligne n'est jamais amorcée.
const AVEC_FUTURE = [...E, { id: "futur", date: "2026-08-15", pour: "tous" }];
assert.ok(!idsDeReprise(AVEC_FUTURE, "2026-08-01").includes("futur"));

// Amorce par promo : une promo récente ne trouve pas des dizaines d'anciennes entrées
// « neuves » au premier passage ; une promo plus ancienne que la rubrique garde la date
// de mise en ligne.
assert.equal(amorcePour(undefined), "2026-08-01");
assert.equal(amorcePour("2026-03-30"), "2026-08-01");
assert.equal(amorcePour("2026-09-30"), "2026-09-30");

// === Refonte de la navigation (lot 2A, tâche 1) ===
// Les 21 assertions d'au-dessus ne comptent pas dans `n` : il part de leur nombre.
let n = 21;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ids = (l) => l.map((e) => e.id);

// Navigation : une entrée « nouvelle » n'est visible que nouvelle navigation allumée, une entrée « ancienne » que si elle est
// éteinte, une entrée sans ce champ dans les deux (comme avant). Le défaut est l'ancienne navigation : les appelants d'avant
// la refonte ne voient rien changer.
const NAV = [
  { id: "nouvelle", date: "2026-10-28", pour: "tous", navigation: "nouvelle" },
  { id: "ancienne", date: "2026-10-03", pour: "tous", navigation: "ancienne" },
  { id: "sans", date: "2026-09-01", pour: "tous" },
  { id: "nouvelle-formateurs", date: "2026-10-28", pour: "formateurs", navigation: "nouvelle" },
  { id: "ancienne-formateurs", date: "2026-10-03", pour: "formateurs", navigation: "ancienne" },
];
eq(ids(visibles(NAV, false, true)), ["nouvelle", "sans"], "allumée, stagiaire : la nouvelle visible, l'ancienne cachée");
eq(ids(visibles(NAV, false, false)), ["ancienne", "sans"], "éteinte, stagiaire : la nouvelle cachée, l'ancienne visible");
eq(ids(visibles(NAV, true, true)), ["nouvelle", "sans", "nouvelle-formateurs"], "allumée, formateur : tout sauf l'ancienne");
eq(ids(visibles(NAV, true, false)), ["ancienne", "sans", "ancienne-formateurs"], "éteinte, formateur : tout sauf la nouvelle");
eq(ids(visibles(NAV, false)), ["ancienne", "sans"], "sans le troisième argument : l'ancienne navigation");
eq(ids(visibles(NAV, true)), ["ancienne", "sans", "ancienne-formateurs"], "formateur sans le troisième argument : l'ancienne navigation");
ok(visibles(NAV, false, true).some((e) => e.id === "sans") && visibles(NAV, false, false).some((e) => e.id === "sans"),
  "une entrée sans champ navigation est visible dans les deux");
eq(ids(visibles(E, true, true)), ["a", "b", "c", "d"], "des entrées sans champ navigation : comme avant, allumée");
eq(ids(visibles(E, false, false)), ["b", "c", "d"], "des entrées sans champ navigation : comme avant, éteinte");

// Consignes « Comment faire » : `guideNouvelle` remplace `guide` quand la nouvelle navigation est allumée, jamais autrement.
const AVEC = { id: "g", guide: ["ancien 1", "ancien 2"], guideNouvelle: ["nouveau 1"] };
eq(guideSelonNavigation(AVEC, true), ["nouveau 1"], "allumée : les étapes de la nouvelle navigation");
eq(guideSelonNavigation(AVEC, false), ["ancien 1", "ancien 2"], "éteinte : les étapes d'avant");
eq(guideSelonNavigation(AVEC), ["ancien 1", "ancien 2"], "sans le second argument : les étapes d'avant");
eq(guideSelonNavigation({ id: "s", guide: ["ancien"] }, true), ["ancien"], "allumée, sans guideNouvelle : le guide d'avant");
eq(guideSelonNavigation({ id: "v", guide: ["ancien"], guideNouvelle: [] }, true), ["ancien"], "guideNouvelle vide : le guide d'avant");
eq(guideSelonNavigation({ id: "x", guide: ["ancien"], guideNouvelle: "pas une liste" }, true), ["ancien"], "guideNouvelle illisible : le guide d'avant");
eq(guideSelonNavigation({ id: "n" }, true), undefined, "ni l'un ni l'autre : rien");
eq(guideSelonNavigation({ id: "n", guideNouvelle: ["seul"] }, false), undefined, "éteinte, guideNouvelle seul : rien");

// Un lien « Où le trouver » vers un sous-onglet de Stagiaires (Élèves bénévoles) l'ouvre par la mémoire de sa barre de sous-onglets.
eq(STORAGE_SOUS_ONGLET.stagiaires, "stagiaires.subtab", "Stagiaires : sous-onglet mémorisé joignable");
eq(STORAGE_SOUS_ONGLET.stagiaires, CLES_SOUS_ONGLETS.stagiaires, "la clé de Stagiaires vient de nav-rules.js");

// === Les Nouveautés réelles ===
const par = (id) => NOUVEAUTES.find((e) => e.id === id);
const CADRATIN = String.fromCharCode(0x2014);
const tout = (e) => [e.titre, e.resume, ...(e.guide || []), ...(e.guideNouvelle || []), e.ou ? e.ou.label : ""].join(" ");
for (const e of NOUVEAUTES) ok(!tout(e).includes(CADRATIN), e.id + " : aucun tiret cadratin");
ok(NOUVEAUTES.every((e) => e.navigation === undefined || e.navigation === "nouvelle" || e.navigation === "ancienne"),
  "le champ navigation vaut « nouvelle » ou « ancienne »");

// Les deux Nouveautés de lancement : propres à la nouvelle navigation.
const lancement = par("2026-10-28-nouvelle-navigation");
const lancementEquipe = par("2026-10-28-nouvelle-navigation-formateurs");
ok(!!lancement && lancement.pour === "tous" && lancement.date === "2026-10-28" && lancement.titre === "Une navigation plus simple",
  "lancement pour tous : « Une navigation plus simple »");
ok(!!lancementEquipe && lancementEquipe.pour === "formateurs" && lancementEquipe.date === "2026-10-28"
  && lancementEquipe.titre === "Côté formateurs, la barre passe à gauche", "lancement des formateurs : « Côté formateurs, la barre passe à gauche »");
eq(NOUVEAUTES.filter((e) => e.navigation === "nouvelle").map((e) => e.id).sort(),
  ["2026-10-28-nouvelle-navigation", "2026-10-28-nouvelle-navigation-formateurs"], "seules les deux entrées de lancement sont propres à la nouvelle navigation");
eq(ids(visibles(NOUVEAUTES, false, true)).filter((id) => id.startsWith("2026-10-28-nouvelle")), ["2026-10-28-nouvelle-navigation"],
  "allumée, un stagiaire voit la première, pas la seconde");
eq(ids(visibles(NOUVEAUTES, true, true)).filter((id) => id.startsWith("2026-10-28-nouvelle")),
  ["2026-10-28-nouvelle-navigation", "2026-10-28-nouvelle-navigation-formateurs"], "allumée, un formateur voit les deux");
eq(ids(visibles(NOUVEAUTES, true, false)).filter((id) => id.startsWith("2026-10-28-nouvelle")), [], "éteinte, personne ne voit aucune des deux");
eq(ids(visibles(NOUVEAUTES, false, false)).filter((id) => id.startsWith("2026-10-28-nouvelle")), [], "éteinte, un stagiaire non plus");
// Ce qu'elles disent, après ce lot : le compte sans chiffre, Mes préférences, où sont les notes de la classe et les contacts du centre ; pour
// l'équipe, le compte et l'assistant en pied de barre sur ordinateur, le bouton Assistant dans l'en-tête sur téléphone.
const dit = (e, motif) => motif.test(tout(e));
ok(dit(lancement, /Mon suivi, La classe/), "pour tous : où sont les notes de la classe");
ok(dit(lancement, /contacts du centre/i), "pour tous : où sont les contacts du centre");
ok(dit(lancement, /menu de ton compte|menu du compte/), "pour tous : les contacts sont dans le menu du compte");
ok(dit(lancement, /Mes préférences/), "pour tous : Mes préférences");
ok(!dit(lancement, /Réglages/), "pour tous : « Réglages » est la page de la promo, réservée à l'équipe : jamais dans l'entrée de tous");
ok(dit(lancement, /[Uu]n point/) && !dit(lancement, /pastille|chiffre/), "pour tous : le compte montre un point, sans chiffre");
ok(dit(lancement, /en bas de la barre de gauche/), "pour tous : les formateurs sur ordinateur trouvent le compte et l'assistant en bas de la barre de gauche");
ok(dit(lancementEquipe, /en bas de (cette|la) barre/), "formateurs : le compte et l'assistant en pied de barre");
ok(dit(lancementEquipe, /Assistant/) && dit(lancementEquipe, /téléphone/), "formateurs : le bouton Assistant sur téléphone");
ok(dit(lancementEquipe, /Plus/) && dit(lancementEquipe, /Réglages/), "formateurs : Plus et Réglages");
ok(dit(lancementEquipe, /bénévoles/), "formateurs : les élèves bénévoles sont sous Stagiaires");
eq(lancementEquipe.ou, { label: "Stagiaires, Élèves bénévoles", route: "stagiaires", sousOnglet: "benevoles" }, "formateurs : le lien ouvre le sous-onglet Élèves bénévoles");
ok(!dit(lancementEquipe, /Tout l'espace formateur/), "formateurs : le tiroir s'appelle « Autres pages »");
for (const e of [lancement, lancementEquipe]) {
  ok(!/Tes initiales, en haut à droite, ouvrent ton compte : Nouveautés, Réglages/.test(tout(e)), e.id + " : plus l'ancien texte du compte");
  ok(!/\bprofs?\b/i.test(tout(e)), e.id + " : « formateur », jamais « prof »");
  ok(Array.isArray(e.guide) && e.guide.length >= 3, e.id + " : un guide");
}

// Les Nouveautés qui ne décrivent que l'ancienne barre : cachées sous la nouvelle.
const ANCIENNES = ["2026-10-03-barre-simple", "2026-07-23-espace-personnel", "2026-10-03-sommaire-iphone"];
eq(NOUVEAUTES.filter((e) => e.navigation === "ancienne").map((e) => e.id).sort(), [...ANCIENNES].sort(),
  "propres à l'ancienne barre : Une barre d'onglets plus simple, L'app s'ouvre sur ton espace personnel, le sommaire sur iPhone");
for (const id of ANCIENNES) {
  ok(!ids(visibles(NOUVEAUTES, true, true)).includes(id) && !ids(visibles(NOUVEAUTES, false, true)).includes(id), id + " : cachée sous la nouvelle navigation");
  ok(ids(visibles(NOUVEAUTES, false, false)).includes(id), id + " : toujours là avec l'ancienne");
}

// Consignes « Comment faire » : les gestes de l'ancienne barre (tuile de l'Accueil, logo, Paramètres, espace personnel...) ne se lisent pas sous
// la nouvelle. Les entrées qui les décrivent portent un guideNouvelle (ou sont cachées sous la nouvelle navigation).
const GESTE_D_AVANT = /Mon espace|espace personnel|Paramètres|tuile|logo|Ressources|Calendrier|bouton Priorités|Tableau de bord|pastille de la promo|onglet Notes|Modules de la promo|Aujourd'hui au planning|Livret EPCF/;
// (Les deux autres entrées dont le guide décrit l'ancienne barre, « Une barre d'onglets plus simple » et « L'app s'ouvre sur ton espace personnel »,
// sont cachées sous la nouvelle navigation : elles n'ont pas besoin d'un second guide.)
const AVEC_GUIDE_NOUVEAU = ["2026-10-23-tableau-de-bord-centre", "2026-10-05-effacement-donnees", "2026-10-03-page-stagiaires", "2026-10-03-deux-promos",
  "2026-07-31-dossier-professionnel", "2026-07-19-livret-epcf"];
eq(NOUVEAUTES.filter((e) => e.guideNouvelle).map((e) => e.id).sort(), [...AVEC_GUIDE_NOUVEAU].sort(), "les consignes réécrites pour la nouvelle navigation");
for (const e of NOUVEAUTES.filter((x) => x.guideNouvelle)) {
  ok(Array.isArray(e.guide) && e.guide.length > 0, e.id + " : le guide d'avant reste pour l'ancienne navigation");
  ok(Array.isArray(e.guideNouvelle) && e.guideNouvelle.length > 0 && e.guideNouvelle.every((s) => typeof s === "string" && s.length > 0), e.id + " : guideNouvelle est une liste de textes");
  eq(guideSelonNavigation(e, true), e.guideNouvelle, e.id + " : la nouvelle navigation lit guideNouvelle");
  eq(guideSelonNavigation(e, false), e.guide, e.id + " : l'ancienne lit le guide d'avant");
}
for (const e of visibles(NOUVEAUTES, true, true)) {
  const lu = (guideSelonNavigation(e, true) || []).join(" ");
  ok(!GESTE_D_AVANT.test(lu), `${e.id} : sous la nouvelle navigation, le guide ne décrit pas l'ancienne barre`);
}
// Les consignes exactes des gestes réécrits (inventaire des textes, § 2.3).
eq(par("2026-10-23-tableau-de-bord-centre").guideNouvelle[0], "Ouvre Indicateurs, dans la barre de gauche (groupe Promo) ; sur téléphone, dans « Plus ».", "tableau de bord : Indicateurs");
eq(par("2026-10-05-effacement-donnees").guideNouvelle[0], "Réglages, partie Promo : « Abandon » sur le stagiaire concerné.", "effacement : Réglages, partie Promo");
eq(par("2026-10-03-page-stagiaires").guideNouvelle[0], "Ouvre Stagiaires, dans la barre de gauche (sur téléphone, en bas de l'écran).", "page Stagiaires : la barre de gauche");
eq(par("2026-07-31-dossier-professionnel").guideNouvelle[0], "Ouvre Mon suivi, dans la barre.", "dossier professionnel : Mon suivi");
eq(par("2026-07-19-livret-epcf").guideNouvelle[0], "Ouvre Mon suivi, partie Livret.", "livret : Mon suivi, partie Livret");
ok(par("2026-07-19-livret-epcf").guideNouvelle.some((s) => /date de naissance/.test(s)), "livret : la date de naissance se renseigne toujours");
ok(par("2026-10-03-deux-promos").guideNouvelle.some((s) => /Touche la promo en tête de la barre de gauche/.test(s)), "deux promos : la promo en tête de la barre de gauche");
ok(par("2026-10-03-deux-promos").guideNouvelle.some((s) => /Réglages, « Ce que voient les stagiaires »/.test(s)), "deux promos : le réglage des modules s'appelle Ce que voient les stagiaires");

// Le récit de la plus récente des Nouveautés d'avant le lancement : « le bouton de l'assistant », pas la bulle de l'ancienne navigation.
ok(/bouton de l'assistant/.test(par("2026-10-28-assistant-plus-facile").resume) && !/bulle/.test(par("2026-10-28-assistant-plus-facile").resume),
  "assistant plus facile : le bouton de l'assistant, juste dans les deux navigations");

// === Annonces d'ouverture de module et explications du catalogue : un texte juste dans les deux navigations ===
// Ni « bouton en haut de l'écran », ni « onglet Notes », ni « bulle en bas de l'écran », ni « Paramètres », ni « Mon espace » : le catalogue génère
// les annonces, anciennes comprises, et il se lit aussi dans Réglages. Les liens « Où le trouver » suivent la navigation (ou-trouver.js).
const VIEUX_TEXTE = /bouton en haut|bulle|Paramètres|Mon espace|espace personnel|onglet Notes|onglet Évolution|dans Notes|en haut du Planning|bouton Priorités/i;
for (const m of MODULES) {
  for (const [quoi, texte] of [["explication", m.explication], ["titre de l'annonce", m.annonce.titre], ["annonce", m.annonce.resume]]) {
    ok(!VIEUX_TEXTE.test(texte), `${m.cle} : ${quoi} sans les mots de l'ancienne barre (« ${texte.slice(0, 40)}… »)`);
  }
}
const mod = (cle) => MODULES.find((m) => m.cle === cle);
eq(mod("planning").annonce.resume.endsWith("Le bouton Aujourd'hui t'amène directement à la journée du jour."), true, "Planning : le bouton Aujourd'hui");
eq(mod("priorites").explication, "Qui doit passer en priorité, en salle et en voiture, dans le Planning.", "Priorités : explication");
ok(mod("priorites").annonce.resume.startsWith("Dans le Planning, Priorités montre qui doit passer en priorité"), "Priorités : annonce");
eq(mod("notes").explication, "Matrice des notes, courbe d'évolution de chaque stagiaire, anonymat.", "Notes : explication");
eq(mod("notes").annonce.resume, "Tes notes de thèmes s'affichent avec la synthèse de la classe, et une courbe trace ta progression. "
  + "Si tu préfères, tu peux masquer ton prénom et tes notes aux autres dans Mes préférences.", "Notes : annonce, Mes préférences (page de la personne, jamais Réglages)");
ok(mod("epcf").explication.includes("les siennes dans son suivi") && mod("epcf").explication.includes("les moyennes de la classe avec les notes"), "EPCF : explication");
eq(mod("epcf").annonce.resume, "Tes évaluations EPCF du CCP1, en salle et en véhicule, s'affichent dans l'app, avec les moyennes de la classe.", "EPCF : annonce");
ok(mod("livret").explication.includes("celui du stagiaire dans son suivi"), "Livret : explication");
ok(mod("livret").annonce.resume.startsWith("Ton livret d'évaluation officiel se consulte dans l'app."), "Livret : annonce");
ok(mod("dp").explication.includes("celui du stagiaire dans son suivi"), "Dossier pro : explication");
eq(mod("assistant").explication, "Assistant qui répond sur les cours et le Code de la route.", "Assistant : explication");
ok(mod("assistant").annonce.resume.startsWith("L'assistant répond à tes questions sur les cours et le Code de la route."), "Assistant : annonce");
// Les libellés « Où le trouver » du catalogue gardent leur forme de main : c'est ouSelonNavigation qui les réécrit.
eq(mod("calendrier").annonce.ou.label, "Calendrier", "Calendrier : libellé d'avant, réécrit par ouSelonNavigation");
eq(mod("notes").annonce.ou.label, "Notes", "Notes : libellé d'avant, réécrit par ouSelonNavigation");

console.log(`nouveautes : ${n} assertions OK`);
