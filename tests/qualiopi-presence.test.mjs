// Tâche 11 du lot Q5 : les heures de présence d'après les feuilles d'émargement closes entrent dans les dossiers Qualiopi
// (pièce d'assiduité, dossier de la formation, fiche des résultats).
// Lancer depuis la racine du dépôt : node tests/qualiopi-presence.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { presenceDePromo, presenceDeLaFiche } from "../js/qualiopi-presence.js";
import { bilanStagiaire } from "../js/attestations-rules.js";
import { inventairePromo } from "../js/qualiopi-preuves.js";
import { indicateursPromo, METHODES_PUBLIQUES, pct } from "../js/centre-stats.js";
import { modeleDossierFormation, modeleDossierCentre } from "../js/qualiopi-documents.js";
import { ficheResultats, ficheResultatsTexte } from "../js/qualiopi-resultats.js";

const TIRET = String.fromCharCode(0x2014);
const REF = { qcm: [], themes: [] };
const AUJ = "2026-12-20";
const PROMO = { id: 1, lieu_id: 1, nom: "Promo de test", date_debut: "2026-10-01", date_fin: "2026-12-11" };
const fiche = (id, extra = {}) => ({ id, prenom: "Prénom" + id, nom: "Nom" + id, actif: true, ...extra });
// 1, 2 en formation ; 3 parti ; 4 effacée à la demande (sans nom) ; 5 en formation.
const STAG = [fiche(1), fiche(2), fiche(3, { actif: false }),
  fiche(4, { prenom: "Anonyme 4", nom: null, efface_le: "2026-11-01T08:00:00Z", anonymise_le: "2026-11-01T08:00:00Z" }), fiche(5)];
const DEMANDES = new Set([4]);

// Ligne signée (signe_le posé, dessin jamais lu : une signature effacée ressemble à une signée) ou absente.
const signe = (stagiaire_id) => ({ stagiaire_id, signe_le: "2026-10-05T09:05:00Z", absent: false, absence_origine: null });
const absent = (stagiaire_id) => ({ stagiaire_id, signe_le: null, absent: true, absence_origine: "non_signe" });
// S1 : 09:00-12:30 (210 min), S2 : 13:30-17:00 (210 min), S3 ouverte (non comptée).
const S1 = { id: 1, promo_id: 1, jour: "2026-10-05", demi_journee: "matin", debut: "09:00", fin: "12:30", statut: "close",
  lignes: [signe(1), signe(2), signe(3), signe(4), absent(5)] };
const S2 = { id: 2, promo_id: 1, jour: "2026-10-05", demi_journee: "aprem", debut: "13:30", fin: "17:00", statut: "close",
  lignes: [signe(1), absent(2), absent(3), signe(4), signe(5)] };
const S3 = { id: 3, promo_id: 1, jour: "2026-10-06", demi_journee: "matin", debut: "09:00", fin: "12:30", statut: "ouverte",
  lignes: [absent(1), absent(2), absent(3), absent(4), absent(5)] };
const LUE = { etat: "lue", seances: [S1, S2, S3] };
const D = (emargement) => ({ stagiaires: STAG, dossiers: [], livrets: [], demandes: DEMANDES, emargement });

const sectionDe = (modele, id) => modele.sections.find((s) => s.id === id);
const formation = (donnees) => {
  const ind = indicateursPromo(donnees, REF, { aujourdhui: AUJ, demandes: DEMANDES });
  const inv = inventairePromo(donnees, REF, { promo: PROMO, aujourdhui: AUJ });
  return { inv, ind, modele: modeleDossierFormation({ inv, donnees, ind, promo: PROMO, lieu: "Centre", intitule: "Titre", aujourdhui: AUJ }) };
};
const pieceAssiduite = (inv) => inv.indicateurs.flatMap((i) => i.pieces).find((p) => p.cle === "assiduite");

test("presenceDePromo : promo avec feuilles, totaux sur toutes les lignes des feuilles closes", () => {
  const p = presenceDePromo(LUE, 1);
  assert.equal(p.etat, "mesuree");
  assert.equal(p.feuilles, 2);
  assert.equal(p.ouvertes, 1);
  assert.equal(p.effectif, 5);
  assert.equal(p.prevuesMin, 5 * 420);
  assert.equal(p.realiseesMin, 840 + 630);
  assert.equal(p.taux, 1470 / 2100);
  assert.equal([...p.bilans.values()].reduce((t, b) => t + b.realiseesMin, 0), p.realiseesMin, "somme des bilanStagiaire");
  assert.deepEqual(p.bilans.get(2), bilanStagiaire([S1, S2], 2));
  assert.equal(p.premier, "2026-10-05");
});

test("presenceDePromo : sans feuille, feuilles ouvertes seulement, lecture en échec", () => {
  assert.equal(presenceDePromo({ etat: "lue", seances: [] }, 1).etat, "absente");
  assert.deepEqual(presenceDePromo({ etat: "lue", seances: [S3] }, 1), { etat: "absente", ouvertes: 1 });
  assert.deepEqual(presenceDePromo({ etat: "non_lue" }, 1), { etat: "non_lue" });
  assert.deepEqual(presenceDePromo(undefined, 1), { etat: "non_lue" });
  assert.equal(presenceDePromo({ etat: "lue", seances: [{ ...S1, promo_id: 9 }] }, 1).etat, "absente", "feuille d'une autre promo : écartée");
  assert.equal(presenceDeLaFiche({ etat: "absente", ouvertes: 0 }), null);
  assert.deepEqual(presenceDeLaFiche({ etat: "non_lue" }), { etat: "non_lue" });
});

test("pièce d'assiduité : présente avec les feuilles closes, la feuille ouverte n'est pas comptée", () => {
  const { inv } = formation(D(LUE));
  const piece = pieceAssiduite(inv);
  assert.equal(piece.presente, true);
  assert.equal(piece.detail,
    `2 feuilles closes le 05/10, 24 heures 30 minutes réalisées sur 35 heures prévues (${pct(0.7)}), 1 feuille ouverte non comptée`);
});

test("pièce d'assiduité : raisons fixes sans feuille, avec feuille ouverte seule, lecture en échec", () => {
  assert.equal(pieceAssiduite(formation(D({ etat: "lue", seances: [] })).inv).raison, "feuilles d'émargement non utilisées pour cette promo");
  assert.equal(pieceAssiduite(formation(D({ etat: "lue", seances: [S3] })).inv).raison, "feuilles ouvertes seulement, aucune feuille close");
  assert.equal(pieceAssiduite(formation(D({ etat: "non_lue" })).inv).raison, "feuilles d'émargement non lues (erreur de lecture)");
});

test("dossier de la formation : heures par stagiaire en formation, signature effacée comptée, fiche effacée hors du tableau", () => {
  const { modele } = formation(D(LUE));
  const examen = sectionDe(modele, "examen");
  const lignes = examen.tableaux[0].lignes;
  assert.deepEqual(lignes.map((l) => [l[0], l[3]]), [
    ["Nom1 Prénom1", "7 heures sur 7 heures prévues"],
    ["Nom2 Prénom2", "3 heures 30 minutes sur 7 heures prévues"],
    ["Nom5 Prénom5", "3 heures 30 minutes sur 7 heures prévues"],
  ]);
  const heures = examen.paragraphes.find((p) => p.startsWith("Heures de formation"));
  // Hors du tableau : le parti (3) 3 h 30 et la fiche effacée à la demande (4) 7 h : 10 h 30 comptées dans le total, sans nom.
  assert.match(heures, /ajoutent 10 heures 30 minutes réalisées, comptées dans le total de la promo sans nom/);
  assert.ok(!heures.includes("Anonyme") && !heures.includes("Prénom4"), "aucun nom dans la phrase");
  const assiduite = sectionDe(modele, "assiduite").paragraphes;
  assert.ok(assiduite[0].includes(`24 heures 30 minutes réalisées sur 35 heures prévues (${pct(0.7)})`));
  assert.equal(assiduite[1], `Méthode de calcul : ${METHODES_PUBLIQUES.presence}`);
  assert.ok(!JSON.stringify(modele).includes(TIRET));
});

test("dossier de la formation : promo sans feuilles ou lecture en échec, une phrase honnête, jamais de zéro", () => {
  const sans = sectionDe(formation(D({ etat: "lue", seances: [] })).modele, "examen");
  assert.ok(sans.paragraphes.includes("Heures de formation : non mesurées (feuilles d'émargement non utilisées pour cette promo)."));
  assert.ok(sans.tableaux[0].lignes.every((l) => l[3] === "non mesurées (feuilles d'émargement non utilisées pour cette promo)"));
  const erreur = sectionDe(formation(D({ etat: "non_lue" })).modele, "examen");
  assert.ok(erreur.paragraphes.includes("Heures de formation : non mesurées (erreur de lecture)."));
  assert.ok(erreur.tableaux[0].lignes.every((l) => l[3] === "non mesurées (erreur de lecture)"));
  const partielle = sectionDe(formation(D({ etat: "lue", seances: [{ ...S1, lignes: [signe(1)] }] })).modele, "examen").tableaux[0].lignes;
  assert.equal(partielle.find((l) => l[0] === "Nom2 Prénom2")[3], "non mesurées (aucune feuille close à son nom)");
  assert.ok(!JSON.stringify(sans).includes("NaN") && !JSON.stringify(sans).includes("undefined"));
});

test("fiche des résultats : taux de présence d'après les feuilles, 'non mesuré' sans feuille, 'non lue' si la lecture échoue", () => {
  const ind = indicateursPromo(D(LUE), REF, { aujourdhui: AUJ, demandes: DEMANDES });
  const ligne = (presence) => ficheResultats({ promo: PROMO, ind, aujourdhui: AUJ, presence }).lignes.find((l) => l.cle === "presence");
  const mesuree = ligne(presenceDeLaFiche(presenceDePromo(LUE, 1)));
  assert.equal(mesuree.valeur, pct(0.7));
  assert.equal(mesuree.effectif, 5);
  assert.equal(mesuree.methode, METHODES_PUBLIQUES.presence);
  assert.equal(ligne(presenceDeLaFiche(presenceDePromo({ etat: "lue", seances: [] }, 1))).valeur, "non mesuré");
  assert.equal(ligne(presenceDeLaFiche(presenceDePromo({ etat: "non_lue" }, 1))).valeur, "non lue (erreur de lecture)");
  const texte = ficheResultatsTexte(ficheResultats({ promo: PROMO, ind, aujourdhui: AUJ, presence: presenceDeLaFiche(presenceDePromo(LUE, 1)) }));
  assert.ok(texte.includes(`Taux de présence : ${pct(0.7)}
Effectif : 5 stagiaires.`));
  assert.ok(!texte.includes("undefined") && !texte.includes("NaN") && !texte.includes(TIRET));
});

test("dossier du centre, avec et sans noms : l'assiduité vient des feuilles, aucun nom de stagiaire", () => {
  const donnees = D(LUE);
  const ind = indicateursPromo(donnees, REF, { aujourdhui: AUJ, demandes: DEMANDES });
  const inv = inventairePromo(donnees, REF, { promo: PROMO, aujourdhui: AUJ });
  for (const sansNoms of [true, false]) {
    const modele = modeleDossierCentre({ promos: [{ promo: PROMO, inv, ind, donnees }], lieu: "Centre", lieuId: 1,
      periode: { debut: "2026-01-01", fin: "2026-12-31" }, aujourdhui: AUJ, sansNoms, nouveautes: [] });
    const brut = JSON.stringify(modele);
    for (const mot of ["Prénom1", "Nom2", "Anonyme 4", "Prénom5"]) assert.ok(!brut.includes(mot), `${mot} absent (sansNoms ${sansNoms})`);
    const ligneAssiduite = JSON.stringify(modele).match(/\["10","Assiduité","([^"]*)"\]/);
    assert.ok(ligneAssiduite && /^présente/.test(ligneAssiduite[1]), `l'inventaire du centre dit l'assiduité présente (sansNoms ${sansNoms})`);
    assert.ok(!brut.includes(TIRET));
  }
});

test("lecture : une seule lecture des feuilles par promo, légère, qui ne fait pas échouer le dossier", () => {
  const db = readFileSync(new URL("../js/db.js", import.meta.url), "utf8");
  const debut = db.indexOf("async function lireEmargementDeLaPromo");
  const fn = db.slice(debut, debut + 900);
  assert.match(fn, /try \{[\s\S]*lireTable\("emargement_seances"[\s\S]*promoId\);[\s\S]*\} catch \{\s*return \{ etat: "non_lue" \};/);
  assert.ok(!/trace/.test(fn.split("lireTable(")[1].split("\n")[1]), "aucun tracé lu");
  assert.equal((db.match(/^\s+lireEmargementDeLaPromo\(promoId\),/gm) || []).length, 1, "appelée une fois par lecture de promo");
  const vue = readFileSync(new URL("../js/views/qualiopi.js", import.meta.url), "utf8");
  assert.ok(!/listEmargement/.test(vue), "la page ne relit pas les feuilles : elle prend celles de la lecture de la promo");
});
