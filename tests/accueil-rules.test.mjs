// Accueil (refonte, lot 2A) : où en est un événement par rapport à aujourd'hui, comment le dire, et la ligne
// « Promo <nom> · semaine <n> ». Règles pures seulement (js/accueil-rules.js) : la carte « Prochain événement
// majeur » de l'accueil, puis le prochain rendez-vous du lot 2B, les lisent.
import assert from "node:assert/strict";
import { etatEvenement, libelleDecompte, lignePromo, pastilleDeLaCarte, prochainRendezVous, aFaireStagiaire, pointsARetenir } from "../js/accueil-rules.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// Ce que l'accueil affiche d'un événement, vu d'un jour donné : le texte seul.
const dit = (evenement, aujourdhui) => libelleDecompte(etatEvenement(evenement, aujourdhui));

// 1. Les cas du plan, vus du 28/10/2026
const AUJOURDHUI = "2026-10-28";
eq(etatEvenement({ debut: "2026-10-28" }, AUJOURDHUI), { etat: "a-venir", jours: 0 }, "un jour, aujourd'hui : à venir, dans 0 jour");
eq(dit({ debut: "2026-10-28" }, AUJOURDHUI), "Aujourd'hui", "événement d'un jour aujourd'hui");
eq(etatEvenement({ debut: "2026-10-29" }, AUJOURDHUI), { etat: "a-venir", jours: 1 }, "demain : à venir, dans 1 jour");
eq(dit({ debut: "2026-10-29" }, AUJOURDHUI), "Demain", "événement demain");
eq(etatEvenement({ debut: "2026-11-06" }, AUJOURDHUI), { etat: "a-venir", jours: 9 }, "dans 9 jours");
eq(dit({ debut: "2026-11-06" }, AUJOURDHUI), "Dans 9 jours", "événement dans 9 jours");
eq(etatEvenement({ debut: "2026-10-26", fin: "2026-11-06" }, AUJOURDHUI), { etat: "en-cours", jours: 9 },
  "stage du 26/10 au 06/11 : en cours, 9 jours jusqu'à sa fin (le « -2 jours » de l'ancienne carte)");
eq(dit({ debut: "2026-10-26", fin: "2026-11-06" }, AUJOURDHUI), "En cours, fin dans 9 jours", "stage commencé avant-hier");
eq(etatEvenement({ debut: "2026-10-26", fin: "2026-10-28" }, AUJOURDHUI), { etat: "en-cours", jours: 0 }, "fin le jour même");
eq(dit({ debut: "2026-10-26", fin: "2026-10-28" }, AUJOURDHUI), "En cours, fin aujourd'hui", "dernier jour d'un événement commencé plus tôt");
eq(etatEvenement({ debut: "2026-10-20", fin: "2026-10-27" }, AUJOURDHUI).etat, "passe", "terminé hier : passé");
eq(etatEvenement({ debut: "2026-10-27" }, AUJOURDHUI).etat, "passe", "un jour, hier : passé");

// 2. Les bords : début, fin, jour unique
eq(etatEvenement({ debut: "2026-10-28", fin: "2026-10-28" }, AUJOURDHUI), { etat: "a-venir", jours: 0 }, "fin égale au début : un seul jour, comme sans fin");
eq(etatEvenement({ debut: "2026-10-28", fin: null }, AUJOURDHUI), { etat: "a-venir", jours: 0 }, "fin nulle (colonne vide en base) : le jour du début");
eq(etatEvenement({ debut: "2026-10-28", fin: "" }, AUJOURDHUI), { etat: "a-venir", jours: 0 }, "fin vide : le jour du début");
eq(etatEvenement({ debut: "2026-10-28", fin: "2026-11-01" }, AUJOURDHUI), { etat: "a-venir", jours: 0 },
  "un événement de plusieurs jours qui commence aujourd'hui : « Aujourd'hui », c'est le jour où il commence");
eq(dit({ debut: "2026-10-28", fin: "2026-11-01" }, AUJOURDHUI), "Aujourd'hui", "premier jour d'un stage");
eq(etatEvenement({ debut: "2026-10-27", fin: "2026-11-01" }, AUJOURDHUI), { etat: "en-cours", jours: 4 }, "le lendemain du premier jour : en cours");
eq(etatEvenement({ debut: "2026-10-20", fin: "2026-10-28" }, AUJOURDHUI).etat, "en-cours", "le dernier jour compte : pas encore passé");
eq(dit({ debut: "2026-10-27", fin: "2026-10-29" }, AUJOURDHUI), "En cours, fin demain", "fin demain : « demain », pas « dans 1 jours »");
eq(dit({ debut: "2026-10-30" }, AUJOURDHUI), "Dans 2 jours", "après-demain");
eq(dit({ debut: "2026-12-08" }, AUJOURDHUI), "Dans 41 jours", "loin");

// 3. Un événement passé n'est jamais dit : pas de nombre négatif, pas de texte
eq(etatEvenement({ debut: "2026-10-20", fin: "2026-10-27" }, AUJOURDHUI), { etat: "passe", jours: -1 }, "passé : le nombre de jours est négatif, il n'est jamais montré");
eq(libelleDecompte({ etat: "passe", jours: -1 }), "", "un événement passé n'a pas de texte");
eq(libelleDecompte({ etat: "passe", jours: -40 }), "", "même très ancien");

// 4. Jamais un nombre négatif à l'écran, quel que soit le jour où l'on regarde (stage du 26/10 au 06/11, et un jour du 02/11)
for (let decalage = -20; decalage <= 30; decalage++) {
  const jour = new Date(Date.UTC(2026, 9, 28 + decalage)).toISOString().slice(0, 10);
  for (const evenement of [{ debut: "2026-10-26", fin: "2026-11-06" }, { debut: "2026-11-02" }]) {
    const texte = libelleDecompte(etatEvenement(evenement, jour));
    assert.ok(!/[-−]\s*\d/.test(texte), `${jour} ${JSON.stringify(evenement)} : « ${texte} » montre un nombre négatif`);
    n++;
    if (etatEvenement(evenement, jour).etat !== "passe") {
      assert.ok(texte.length > 0, `${jour} ${JSON.stringify(evenement)} : un événement qui n'est pas passé a un texte`);
      n++;
    }
  }
}

// 5. Les jours se comptent en jours de calendrier : ni changement d'heure, ni fin d'année, ni 29 février n'y changent rien
eq(etatEvenement({ debut: "2026-10-26" }, "2026-10-24"), { etat: "a-venir", jours: 2 }, "à cheval sur le passage à l'heure d'hiver (25/10/2026) : 2 jours, pas 1,96");
eq(etatEvenement({ debut: "2026-03-30" }, "2026-03-27"), { etat: "a-venir", jours: 3 }, "à cheval sur le passage à l'heure d'été (29/03/2026)");
eq(etatEvenement({ debut: "2027-01-02" }, "2026-12-30"), { etat: "a-venir", jours: 3 }, "d'une année à l'autre");
eq(etatEvenement({ debut: "2028-03-01" }, "2028-02-28"), { etat: "a-venir", jours: 2 }, "29 février d'une année bissextile");
eq(etatEvenement({ debut: "2026-03-01" }, "2026-02-28"), { etat: "a-venir", jours: 1 }, "28 février d'une année ordinaire");

// 6. « Aujourd'hui » peut être une date (l'app lit `new Date()`) : le jour LOCAL compte, pas l'heure
eq(etatEvenement({ debut: "2026-10-28" }, new Date(2026, 9, 28, 0, 5)), { etat: "a-venir", jours: 0 }, "00 h 05 : toujours le 28");
eq(etatEvenement({ debut: "2026-10-28" }, new Date(2026, 9, 28, 23, 55)), { etat: "a-venir", jours: 0 }, "23 h 55 : encore le 28");
eq(etatEvenement({ debut: "2026-10-26", fin: "2026-10-28" }, new Date(2026, 9, 29, 0, 5)).etat, "passe", "00 h 05 le 29 : le stage de la veille est passé");

// 7. Une date illisible n'est pas devinée
assert.throws(() => etatEvenement({ debut: "demain" }, AUJOURDHUI), TypeError, "début illisible");
assert.throws(() => etatEvenement({ debut: "2026-10-28", fin: "bientôt" }, AUJOURDHUI), TypeError, "fin illisible");
assert.throws(() => etatEvenement({ debut: "2026-10-28" }, "aujourd'hui"), TypeError, "jour de référence illisible");
assert.throws(() => etatEvenement({}, AUJOURDHUI), TypeError, "début absent");
assert.throws(() => etatEvenement({ debut: "2026-02-30" }, AUJOURDHUI), TypeError, "le 30 février n'existe pas");
assert.throws(() => etatEvenement({ debut: "2026-13-01" }, AUJOURDHUI), TypeError, "le mois 13 n'existe pas");
assert.throws(() => etatEvenement({ debut: "2026-10-28T10:00:00Z" }, AUJOURDHUI), TypeError, "un horodatage n'est pas un jour : « AAAA-MM-JJ » seulement");
n += 7;

// 8. Les mots de l'accueil : apostrophe droite, comme le reste de l'app
eq(libelleDecompte({ etat: "a-venir", jours: 0 }), "Aujourd'hui", "à venir, 0 jour");
eq(libelleDecompte({ etat: "a-venir", jours: 1 }), "Demain", "à venir, 1 jour");
eq(libelleDecompte({ etat: "a-venir", jours: 2 }), "Dans 2 jours", "à venir, 2 jours");
eq(libelleDecompte({ etat: "en-cours", jours: 0 }), "En cours, fin aujourd'hui", "en cours, 0 jour");
eq(libelleDecompte({ etat: "en-cours", jours: 1 }), "En cours, fin demain", "en cours, 1 jour");
eq(libelleDecompte({ etat: "en-cours", jours: 9 }), "En cours, fin dans 9 jours", "en cours, 9 jours");
eq(libelleDecompte({ etat: "inconnu", jours: 3 }), "", "un état inconnu n'a pas de texte");
eq(libelleDecompte(null), "", "rien à dire sans état");
eq(libelleDecompte({ etat: "a-venir", jours: -2 }), "", "jamais « Dans -2 jours » : un nombre négatif ne se dit pas");
eq(libelleDecompte({ etat: "en-cours", jours: -1 }), "", "ni « En cours, fin dans -1 jours »");
eq(libelleDecompte({ etat: "a-venir", jours: Number.NaN }), "", "ni NaN");
eq(libelleDecompte({ etat: "a-venir", jours: 1.5 }), "", "ni un nombre de jours qui n'est pas entier");

// 9. « Promo <nom> · semaine <n> » : la semaine 1 est celle du premier jour de la promo (du lundi au dimanche)
const NIMES = { nom: "Nîmes, mars 2026", date_debut: "2026-03-30", date_fin: "2026-12-11" };   // le 30/03/2026 est un lundi
eq(lignePromo(NIMES, "2026-10-28"), "Promo Nîmes, mars 2026 · semaine 31 de formation", "mercredi 28/10 : la 31e semaine (lundi 26/10 : 30 semaines après le 30/03)");
eq(lignePromo(NIMES, "2026-10-27"), "Promo Nîmes, mars 2026 · semaine 31 de formation", "mardi 27/10, la maquette : semaine 31");
eq(lignePromo(NIMES, "2026-10-25"), "Promo Nîmes, mars 2026 · semaine 30 de formation", "dimanche 25/10 : encore la semaine d'avant");
eq(lignePromo(NIMES, "2026-10-26"), "Promo Nîmes, mars 2026 · semaine 31 de formation", "lundi 26/10 : la semaine change le lundi");
eq(lignePromo(NIMES, "2026-03-30"), "Promo Nîmes, mars 2026 · semaine 1 de formation", "le premier jour : semaine 1");
eq(lignePromo(NIMES, "2026-04-05"), "Promo Nîmes, mars 2026 · semaine 1 de formation", "le dimanche qui suit : toujours semaine 1");
eq(lignePromo(NIMES, "2026-04-06"), "Promo Nîmes, mars 2026 · semaine 2 de formation", "le lundi suivant : semaine 2");
eq(lignePromo(NIMES, "2026-12-11"), "Promo Nîmes, mars 2026 · semaine 37 de formation", "le dernier jour de la promo : encore numéroté");
eq(lignePromo({ nom: "Alès, avril 2026", date_debut: "2026-04-01" }, "2026-04-05"), "Promo Alès, avril 2026 · semaine 1 de formation",
  "une promo qui commence un mercredi : sa semaine 1 est celle de ce mercredi");
eq(lignePromo({ nom: "Alès, avril 2026", date_debut: "2026-04-01" }, "2026-04-06"), "Promo Alès, avril 2026 · semaine 2 de formation", "et la 2 commence le lundi suivant");
eq(lignePromo({ nom: "Alès, avril 2026", date_debut: "2026-04-01" }, "2026-03-31"), "Promo Alès, avril 2026",
  "la veille du premier jour, dans la même semaine du calendrier : la promo n'a pas commencé, pas de semaine 1");
eq(lignePromo(NIMES, new Date(2026, 9, 28, 23, 50)), "Promo Nîmes, mars 2026 · semaine 31 de formation", "une date locale : le jour, pas l'heure");
// Pas de numéro quand il ne dirait rien de vrai : promo pas commencée, promo finie
eq(lignePromo(NIMES, "2026-03-27"), "Promo Nîmes, mars 2026", "avant la promo : pas de semaine 0 ni négative");
eq(lignePromo(NIMES, "2026-12-14"), "Promo Nîmes, mars 2026", "après la fin de la promo : pas de semaine qui continue de compter");
eq(lignePromo({ nom: "Nîmes, septembre 2026", date_debut: "2026-09-30", date_fin: null }, "2026-10-28"), "Promo Nîmes, septembre 2026 · semaine 5 de formation",
  "sans date de fin : la numérotation continue");
eq(lignePromo({ nom: "Sans dates" }, "2026-10-28"), "Promo Sans dates", "sans date de début : le nom seul");
eq(lignePromo({ nom: "Nîmes, mars 2026", date_debut: "pas une date" }, "2026-10-28"), "Promo Nîmes, mars 2026", "date de début illisible : le nom seul");
eq(lignePromo({ nom: "Nîmes, mars 2026", date_debut: "2026-03-30" }, "pas une date"), "Promo Nîmes, mars 2026", "jour de référence illisible : le nom seul");
eq(lignePromo(null, "2026-10-28"), "", "promo pas encore chargée : aucune ligne");
eq(lignePromo({ date_debut: "2026-03-30" }, "2026-10-28"), "", "promo sans nom : aucune ligne");
eq(lignePromo({ nom: "   " }, "2026-10-28"), "", "nom vide : aucune ligne");

// 10. « À retenir » selon le public (décision du 10/11) : tutoiement par défaut (Accueil d'avant, stagiaire), vouvoiement quand
// l'appelant passe l'aiguilleur de l'équipe (Mes préférences : selonPublic).
const auStagiaire = pointsARetenir(true);
eq(auStagiaire[0].gras, "Ton identité est liée à ton e-mail.", "stagiaire : tutoiement, « e-mail »");
eq(auStagiaire[1].gras, "Tu ajoutes et corriges tes passages toi-même.", "stagiaire : ses passages");
const aLEquipe = pointsARetenir(true, (tu, vous) => vous);
eq(aLEquipe[0].gras, "Votre identité est liée à votre e-mail.", "équipe : vouvoiement");
eq(aLEquipe[1], { gras: "Les stagiaires ajoutent et corrigent leurs passages eux-mêmes.", suite: " Pour en supprimer un, ils s'adressent à un formateur." },
  "équipe : la règle des passages dite des stagiaires");
eq(aLEquipe.slice(2), auStagiaire.slice(2), "les deux dernières règles, sans pronom, sont les mêmes");
eq(aLEquipe.some((p) => /\b(tu|ton|ta|tes|toi)\b/i.test(p.gras + p.suite)), false, "aucun tutoiement chez l'équipe");

console.log(`accueil-rules : ${n} assertions OK`);

// 10. La pastille de la carte « Prochain événement majeur » (relecture finale, F9) : à venir, les jours qui restent avant le début,
// habillés selon l'urgence ; commencé, « En cours », sans nombre ni habillage de compte à rebours (la ligne « En cours, fin dans N
// jours » dit déjà ce qui reste), jamais « Aujourd'hui ! » pour un stage qui finit aujourd'hui.
const pastille = (evenement, aujourdhui) => pastilleDeLaCarte(etatEvenement(evenement, aujourdhui));
eq(pastille({ debut: "2026-11-06" }, AUJOURDHUI), { ton: "later", nombre: "9", unite: "jours" }, "à venir dans 9 jours : habillage tranquille");
eq(pastille({ debut: "2026-11-05" }, AUJOURDHUI), { ton: "later", nombre: "8", unite: "jours" }, "dans 8 jours : encore tranquille");
eq(pastille({ debut: "2026-11-04" }, AUJOURDHUI), { ton: "soon", nombre: "7", unite: "jours" }, "dans 7 jours : « bientôt »");
eq(pastille({ debut: "2026-10-30" }, AUJOURDHUI), { ton: "soon", nombre: "2", unite: "jours" }, "après-demain");
eq(pastille({ debut: "2026-10-29" }, AUJOURDHUI), { ton: "soon", nombre: "1", unite: "jour" }, "demain : « 1 jour », au singulier");
eq(pastille({ debut: "2026-10-28" }, AUJOURDHUI), { ton: "today", nombre: "0", unite: "Aujourd'hui !" }, "un événement qui commence aujourd'hui");
eq(pastille({ debut: "2026-10-28", fin: "2026-11-01" }, AUJOURDHUI), { ton: "today", nombre: "0", unite: "Aujourd'hui !" }, "premier jour d'un stage : il commence aujourd'hui");
eq(pastille({ debut: "2026-10-26", fin: "2026-11-06" }, AUJOURDHUI), { ton: "en-cours", nombre: "", unite: "En cours" }, "un stage commencé : « En cours », sans nombre de jours");
eq(pastille({ debut: "2026-10-26", fin: "2026-10-29" }, AUJOURDHUI), { ton: "en-cours", nombre: "", unite: "En cours" }, "fin demain : pas « 1 jour »");
eq(pastille({ debut: "2026-10-26", fin: "2026-10-28" }, AUJOURDHUI), { ton: "en-cours", nombre: "", unite: "En cours" },
  "un stage qui finit aujourd'hui : « En cours », pas « Aujourd'hui ! » (le jour où il finit n'est pas le jour où il commence)");
eq(pastille({ debut: "2026-10-20", fin: "2026-10-27" }, AUJOURDHUI), null, "terminé hier : la carte ne le montre pas, donc aucune pastille");
// Aucun habillage de compte à rebours (today, soon, later) ni aucun nombre pour un événement commencé, quel que soit le jour où l'on regarde
for (let decalage = -20; decalage <= 30; decalage++) {
  const jour = new Date(Date.UTC(2026, 9, 28 + decalage)).toISOString().slice(0, 10);
  const evenement = { debut: "2026-10-26", fin: "2026-11-06" };
  const decompte = etatEvenement(evenement, jour);
  const p = pastilleDeLaCarte(decompte);
  if (decompte.etat === "en-cours") {
    assert.deepEqual(p, { ton: "en-cours", nombre: "", unite: "En cours" }, `${jour} : en cours`);
  } else if (decompte.etat === "passe") {
    assert.equal(p, null, `${jour} : passé`);
  } else {
    assert.ok(["today", "soon", "later"].includes(p.ton) && /^\d+$/.test(p.nombre), `${jour} : à venir`);
  }
  assert.ok(!/[-−]\s*\d/.test(`${p ? p.nombre : ""} ${p ? p.unite : ""}`), `${jour} : jamais un nombre négatif`);
  n += 2;
}
eq(pastilleDeLaCarte(null), null, "rien à dire sans état");
eq(pastilleDeLaCarte({ etat: "inconnu", jours: 3 }), null, "un état inconnu n'a pas de pastille");
eq(pastilleDeLaCarte({ etat: "a-venir", jours: -2 }), null, "jamais un nombre négatif à venir");
eq(pastilleDeLaCarte({ etat: "a-venir", jours: 1.5 }), null, "ni un nombre de jours qui n'est pas entier");
eq(pastilleDeLaCarte({ etat: "en-cours", jours: -1 }), null, "ni un événement en cours à la fin déjà passée");

// === Lot 2B, tâche 3 : le prochain rendez-vous de l'accueil du stagiaire ===
const ev = (title, type, date_start, date_end = null) => ({ title, type, date_start, date_end });
const AUJ = "2026-10-28";

eq(prochainRendezVous([ev("Stage 1", "stage", "2026-10-26", "2026-11-06"), ev("EPCF 2", "examen", "2026-11-05")], AUJ),
  { titre: "Stage 1", date: "lundi 26 octobre", libelle: "En cours, fin dans 9 jours" },
  "un stage en cours passe avant un examen futur (le premier examen ou stage qui n'est pas passé)");
eq(prochainRendezVous([ev("EPCF 2", "examen", "2026-11-05")], AUJ),
  { titre: "EPCF 2", date: "jeudi 5 novembre", libelle: "Dans 8 jours" }, "un examen à venir : titre, jour en toutes lettres, décompte");
eq(prochainRendezVous([ev("Réunion", "autre", "2026-10-30"), ev("EPCF 2", "examen", "2026-11-05")], AUJ).titre, "EPCF 2",
  "un examen futur passe avant un événement « autre » plus proche");
eq(prochainRendezVous([ev("Ancien stage", "stage", "2026-09-01", "2026-09-30"), ev("Vieil examen", "examen", "2026-10-27")], AUJ), null,
  "tout est passé : rien");
eq(prochainRendezVous([], AUJ), null, "aucun événement : rien");
eq(prochainRendezVous(null, AUJ), null, "liste absente : rien");
eq(prochainRendezVous([ev("Toussaint", "ferie", "2026-11-01"), ev("Examen blanc", "examen", "2026-11-12")], AUJ).titre, "Examen blanc",
  "un jour férié est ignoré");
eq(prochainRendezVous([ev("Toussaint", "ferie", "2026-11-01")], AUJ), null, "seul un férié à venir : rien");
eq(prochainRendezVous([ev("Pot de promo", "autre", "2026-11-03"), ev("Sortie", "formation", "2026-11-02")], AUJ),
  { titre: "Sortie", date: "lundi 2 novembre", libelle: "Dans 5 jours" },
  "sans examen ni stage à venir : le premier événement qui n'est pas passé, quel que soit l'ordre de la liste");
eq(prochainRendezVous([ev("Pot", "autre", "2026-10-28")], AUJ),
  { titre: "Pot", date: "mercredi 28 octobre", libelle: "Aujourd'hui" }, "un événement du jour est à venir (« Aujourd'hui »)");
eq(prochainRendezVous([ev("Cassé", "examen", "pas-une-date"), ev("Bon", "examen", "2026-11-05")], AUJ).titre, "Bon",
  "une date illisible n'empêche pas de montrer un autre rendez-vous");
eq(prochainRendezVous([ev("Pot", "autre", "2026-10-29")], new Date(2026, 9, 28)).libelle, "Demain", "aujourd'hui peut être une date");

// === L'à-faire du stagiaire ===
const THEMES = [
  { id: 1, titre: "Intersections et priorités" },
  { id: 2, titre: "Stationnement, arrêt, immobilisation" },
  { id: 3, titre: "Vitesse" },
];
const QCM = [
  { id: 11, theme_id: 1, titre: "QCM intersections", nb_questions: 20, published: false, exam_ferme_a: null },
  { id: 12, theme_id: 2, titre: "QCM stationnement", nb_questions: 1, published: false, exam_ferme_a: null },
  { id: 13, theme_id: 3, titre: "QCM vitesse", nb_questions: 15, published: false, exam_ferme_a: null },
];
const NOW = Date.parse("2026-10-28T10:00:00Z");
const OUVERT = (id, extra = {}) => QCM.map((q) => (q.id === id ? { ...q, published: true, ...extra } : q));
const base = (extra = {}) => ({
  qcm: QCM, themes: THEMES, tentatives: [], sujetsDeLaSemaine: [], exemplesDossier: 6, livretCommence: true,
  modules: { qcm: true, dp: true, livret: true }, now: NOW, ...extra,
});
const cles = (liste) => liste.map((l) => l.cle);

eq(aFaireStagiaire(base()), [], "rien à faire : liste vide");
eq(aFaireStagiaire({}), [], "aucune donnée : liste vide, sans erreur");

// L'ordre, les textes et les destinations
const tout = aFaireStagiaire(base({
  qcm: OUVERT(13), sujetsDeLaSemaine: ["Intersections et priorités"], exemplesDossier: 2, livretCommence: false,
}));
eq(tout, [
  { cle: "examen-13", titre: "Examen ouvert : Vitesse", detail: "Sans limite de temps", route: "themes", sousOnglet: "qcm" },
  { cle: "qcm-11", titre: "QCM du thème : Intersections et priorités", detail: "Pas encore fait · 20 questions", route: "themes", sousOnglet: "qcm" },
  { cle: "dossier", titre: "Dossier professionnel", detail: "2 exemples sur 6", route: "mon-suivi", sousOnglet: "dp" },
], "examen, QCM du thème, dossier, dans cet ordre ; QCM et examen mènent au sous-onglet QCM (audit du 09/11, A6)");

// Examen
eq(aFaireStagiaire(base({ qcm: OUVERT(13, { exam_ferme_a: new Date(NOW + 90 * 60000).toISOString() }) }))[0].detail, "Ferme dans 1 h 30",
  "un examen à échéance dit le temps qui reste");
eq(cles(aFaireStagiaire(base({ qcm: OUVERT(13, { exam_ferme_a: new Date(NOW - 60000).toISOString() }) }))), [],
  "un examen dont l'échéance est passée n'est plus à faire");
eq(cles(aFaireStagiaire(base({ qcm: OUVERT(13), tentatives: [{ qcm_id: 13, mode: "examen" }] }))), [],
  "un examen déjà passé (tentative en mode examen) n'est plus à faire");
eq(cles(aFaireStagiaire(base({ qcm: OUVERT(13), tentatives: [{ qcm_id: 13, mode: "entrainement" }] }))), ["examen-13"],
  "un entraînement ne vaut pas passage de l'examen");
eq(cles(aFaireStagiaire(base({ qcm: OUVERT(13), tentatives: [{ qcm_id: 11, mode: "examen" }] }))), ["examen-13"],
  "l'examen d'un autre QCM ne compte pas");
eq(cles(aFaireStagiaire(base({ qcm: QCM.map((q) => ({ ...q, published: true, nb_questions: q.id === 13 ? 0 : q.nb_questions })), tentatives: [
  { qcm_id: 11, mode: "examen" }, { qcm_id: 12, mode: "examen" }] }))), [],
  "un QCM sans question ne se propose pas");

// QCM du thème vu cette semaine
eq(aFaireStagiaire(base({ sujetsDeLaSemaine: ["Stationnement, arrêt, immobilisation"] })),
  [{ cle: "qcm-12", titre: "QCM du thème : Stationnement, arrêt, immobilisation", detail: "Pas encore fait · 1 question", route: "themes", sousOnglet: "qcm" }],
  "un titre à virgule se rapproche par son titre exact ; une seule question s'écrit au singulier");
eq(cles(aFaireStagiaire(base({ sujetsDeLaSemaine: ["Intersections et priorités"], tentatives: [{ qcm_id: 11, mode: "entrainement" }] }))), [],
  "un QCM déjà tenté n'est plus à faire");
eq(cles(aFaireStagiaire(base({ sujetsDeLaSemaine: ["Sujet libre écrit à la main"] }))), [],
  "un sujet sans thème correspondant est ignoré");
eq(cles(aFaireStagiaire(base({ sujetsDeLaSemaine: ["intersections et priorités"] }))), [],
  "la correspondance est exacte : la casse compte");
eq(cles(aFaireStagiaire(base({ sujetsDeLaSemaine: ["Intersections et priorités", "Intersections et priorités", "Vitesse"] }))), ["qcm-11", "qcm-13"],
  "un thème vu deux fois ne donne qu'une ligne, dans l'ordre du planning");
eq(cles(aFaireStagiaire(base({ qcm: OUVERT(11), sujetsDeLaSemaine: ["Intersections et priorités"] }))), ["examen-11"],
  "un examen ouvert sur le même QCM remplace la ligne du QCM du thème (pas deux lignes pour le même QCM)");
eq(cles(aFaireStagiaire(base({ themes: [{ id: 9, titre: "Intersections et priorités" }], sujetsDeLaSemaine: ["Intersections et priorités"] }))), [],
  "un thème sans QCM : rien");

// Dossier et livret
eq(aFaireStagiaire(base({ exemplesDossier: 0 }))[0].detail, "0 exemple sur 6", "aucun exemple : 0 exemple sur 6");
eq(aFaireStagiaire(base({ exemplesDossier: 1 }))[0].detail, "1 exemple sur 6", "un exemple, au singulier");
eq(cles(aFaireStagiaire(base({ exemplesDossier: 6 }))), [], "6 sur 6 : absent");
eq(cles(aFaireStagiaire(base({ exemplesDossier: null }))), [], "dossier illisible : pas de ligne inventée");
eq(cles(aFaireStagiaire(base({ livretCommence: null }))), [], "livret illisible : pas de ligne inventée");
// Le livret EPCF est rempli par les formateurs : pas commencé, ce n'est pas un travail du stagiaire (audit du 09/11, A4).
eq(cles(aFaireStagiaire(base({ livretCommence: false }))), [], "livret pas commencé : aucune ligne, le stagiaire n'y peut rien");

// Modules fermés
const fermer = (m) => ({ qcm: true, dp: true, livret: true, [m]: false });
const complet = { qcm: OUVERT(13), sujetsDeLaSemaine: ["Intersections et priorités"], exemplesDossier: 2, livretCommence: false };
eq(cles(aFaireStagiaire(base({ ...complet, modules: fermer("qcm") }))), ["dossier"], "QCM fermé : ni examen ni QCM du thème");
eq(cles(aFaireStagiaire(base({ ...complet, modules: fermer("dp") }))), ["examen-13", "qcm-11"], "Dossier fermé : sa ligne part");
eq(cles(aFaireStagiaire(base({ ...complet, modules: fermer("livret") }))), ["examen-13", "qcm-11", "dossier"], "Livret fermé : sa ligne part");

// Plafond de 4
eq(cles(aFaireStagiaire(base({ qcm: QCM.map((q) => ({ ...q, published: true })), exemplesDossier: 0, livretCommence: false }))),
  ["examen-11", "examen-12", "examen-13", "dossier"], "au plus 4 lignes : les premières de l'ordre");
