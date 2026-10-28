// Accueil (refonte, lot 2A) : où en est un événement par rapport à aujourd'hui, comment le dire, et la ligne
// « Promo <nom> · semaine <n> ». Règles pures seulement (js/accueil-rules.js) : la carte « Prochain événement
// majeur » de l'accueil, puis le prochain rendez-vous du lot 2B, les lisent.
import assert from "node:assert/strict";
import { etatEvenement, libelleDecompte, lignePromo } from "../js/accueil-rules.js";

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
eq(lignePromo(NIMES, "2026-10-28"), "Promo Nîmes, mars 2026 · semaine 31", "mercredi 28/10 : la 31e semaine (lundi 26/10 : 30 semaines après le 30/03)");
eq(lignePromo(NIMES, "2026-10-27"), "Promo Nîmes, mars 2026 · semaine 31", "mardi 27/10, la maquette : semaine 31");
eq(lignePromo(NIMES, "2026-10-25"), "Promo Nîmes, mars 2026 · semaine 30", "dimanche 25/10 : encore la semaine d'avant");
eq(lignePromo(NIMES, "2026-10-26"), "Promo Nîmes, mars 2026 · semaine 31", "lundi 26/10 : la semaine change le lundi");
eq(lignePromo(NIMES, "2026-03-30"), "Promo Nîmes, mars 2026 · semaine 1", "le premier jour : semaine 1");
eq(lignePromo(NIMES, "2026-04-05"), "Promo Nîmes, mars 2026 · semaine 1", "le dimanche qui suit : toujours semaine 1");
eq(lignePromo(NIMES, "2026-04-06"), "Promo Nîmes, mars 2026 · semaine 2", "le lundi suivant : semaine 2");
eq(lignePromo(NIMES, "2026-12-11"), "Promo Nîmes, mars 2026 · semaine 37", "le dernier jour de la promo : encore numéroté");
eq(lignePromo({ nom: "Alès, avril 2026", date_debut: "2026-04-01" }, "2026-04-05"), "Promo Alès, avril 2026 · semaine 1",
  "une promo qui commence un mercredi : sa semaine 1 est celle de ce mercredi");
eq(lignePromo({ nom: "Alès, avril 2026", date_debut: "2026-04-01" }, "2026-04-06"), "Promo Alès, avril 2026 · semaine 2", "et la 2 commence le lundi suivant");
eq(lignePromo({ nom: "Alès, avril 2026", date_debut: "2026-04-01" }, "2026-03-31"), "Promo Alès, avril 2026",
  "la veille du premier jour, dans la même semaine du calendrier : la promo n'a pas commencé, pas de semaine 1");
eq(lignePromo(NIMES, new Date(2026, 9, 28, 23, 50)), "Promo Nîmes, mars 2026 · semaine 31", "une date locale : le jour, pas l'heure");
// Pas de numéro quand il ne dirait rien de vrai : promo pas commencée, promo finie
eq(lignePromo(NIMES, "2026-03-27"), "Promo Nîmes, mars 2026", "avant la promo : pas de semaine 0 ni négative");
eq(lignePromo(NIMES, "2026-12-14"), "Promo Nîmes, mars 2026", "après la fin de la promo : pas de semaine qui continue de compter");
eq(lignePromo({ nom: "Nîmes, septembre 2026", date_debut: "2026-09-30", date_fin: null }, "2026-10-28"), "Promo Nîmes, septembre 2026 · semaine 5",
  "sans date de fin : la numérotation continue");
eq(lignePromo({ nom: "Sans dates" }, "2026-10-28"), "Promo Sans dates", "sans date de début : le nom seul");
eq(lignePromo({ nom: "Nîmes, mars 2026", date_debut: "pas une date" }, "2026-10-28"), "Promo Nîmes, mars 2026", "date de début illisible : le nom seul");
eq(lignePromo({ nom: "Nîmes, mars 2026", date_debut: "2026-03-30" }, "pas une date"), "Promo Nîmes, mars 2026", "jour de référence illisible : le nom seul");
eq(lignePromo(null, "2026-10-28"), "", "promo pas encore chargée : aucune ligne");
eq(lignePromo({ date_debut: "2026-03-30" }, "2026-10-28"), "", "promo sans nom : aucune ligne");
eq(lignePromo({ nom: "   " }, "2026-10-28"), "", "nom vide : aucune ligne");

console.log(`accueil-rules : ${n} assertions OK`);
