// Tâche 8 du lot Q5 : indicateurs, dossiers Qualiopi et feuilles d'émargement lisent les marques de conservation
// (efface_le, anonymise_le, signature_effacee_le, fiches effacées à la demande).
// Lancer depuis la racine du dépôt : node tests/qualiopi-conservation.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { indicateursPromo, ligneComparaison, METHODES } from "../js/centre-stats.js";
import { etatLigne, minutesPresence, libelleDuree, resumeSeance, signatureEffacee, ligneSignee, MENTION_SIGNATURE_EFFACEE } from "../js/emargement-rules.js";
import { inventairePromo, satisfactionDe, RAISON_EFFACEE } from "../js/qualiopi-preuves.js";
import { modeleDossierFormation, modeleDossierCentre } from "../js/qualiopi-documents.js";
import { statutFiche } from "../js/effacement-rules.js";

const TIRET = String.fromCharCode(0x2014);
const REF = { qcm: [], themes: [] };
const AUJ = "2027-12-20";
const PROMO = { id: 1, lieu_id: 1, nom: "Promo de test", date_debut: "2026-03-02", date_fin: "2026-12-11" };

// 5 fiches : 1, 2 actives ; 3 en abandon (décision de l'équipe) ; 4 effacée à la demande (anonymise_le) ; 5 active.
const fiche = (id, extra = {}) => ({ id, prenom: "Prénom" + id, nom: "Nom" + id, actif: true, ...extra });
const STAG = [fiche(1), fiche(2), fiche(3, { actif: false }),
  fiche(4, { prenom: "Anonyme 4", nom: null, efface_le: "2027-05-01T08:00:00Z", anonymise_le: "2027-05-01T08:00:00Z" }), fiche(5)];
const D = { stagiaires: STAG, dossiers: [{ stagiaire_id: 1, updated_at: "2026-10-10T08:00:00Z" }] };
const OPT = { promo: PROMO, aujourdhui: AUJ };

test("indicateursPromo : une fiche effacée à la demande est un inscrit, ni en formation ni en abandon", () => {
  const ind = indicateursPromo(D, REF, { aujourdhui: AUJ, demandes: new Set([4]) });
  assert.deepEqual(ind.effectif.detail, { inscrits: 5, enFormation: 3, abandons: 1, surDemande: 1 });
  assert.equal(ind.effectif.valeur, 5);
  assert.equal(ind.abandon.valeur, 1 / 5);
  assert.deepEqual(ind.abandon.detail, { abandons: 1, inscrits: 5 });
  assert.match(ligneComparaison(ind).effectif, /5 inscrits \(dont 1 effacée à la demande\)/);
});

test("indicateursPromo : demandes absent vaut un ensemble vide, un tableau est accepté", () => {
  const sans = indicateursPromo(D, REF, { aujourdhui: AUJ });
  assert.deepEqual(sans.effectif.detail, { inscrits: 5, enFormation: 4, abandons: 1, surDemande: 0 });
  assert.equal(ligneComparaison(sans).effectif, "5 inscrits");
  const tab = indicateursPromo(D, REF, { aujourdhui: AUJ, demandes: [4] });
  assert.equal(tab.effectif.detail.surDemande, 1);
  assert.equal(indicateursPromo(D, REF, { aujourdhui: AUJ, demandes: null }).effectif.detail.surDemande, 0);
});

test("indicateursPromo : une fiche de la demande déjà en abandon n'est pas un abandon", () => {
  const d = { stagiaires: [fiche(1), fiche(2, { actif: false })] };
  const ind = indicateursPromo(d, REF, { aujourdhui: AUJ, demandes: new Set([2]) });
  assert.deepEqual(ind.effectif.detail, { inscrits: 2, enFormation: 1, abandons: 0, surDemande: 1 });
});

test("indicateursPromo : promo effacée à l'étape 1 ou 2, les abandons ne bougent pas", () => {
  const avant = indicateursPromo({ stagiaires: [fiche(1), fiche(2), fiche(3, { actif: false })] }, REF, { aujourdhui: AUJ });
  const e1 = { efface_le: "2027-12-12T08:00:00Z" };
  const etape1 = indicateursPromo({ stagiaires: [fiche(1, e1), fiche(2, e1), fiche(3, { actif: false, ...e1 })] }, REF, { aujourdhui: AUJ });
  const anon = { efface_le: "2030-01-02T08:00:00Z", anonymise_le: "2030-01-02T08:00:00Z" };
  const etape2 = indicateursPromo({ stagiaires: [fiche(1, anon), fiche(2, anon), fiche(3, { actif: false, ...anon })] }, REF, { aujourdhui: AUJ });
  assert.deepEqual(etape1.effectif.detail, avant.effectif.detail);
  assert.deepEqual(etape2.effectif.detail, avant.effectif.detail);
  assert.equal(etape2.abandon.valeur, avant.abandon.valeur);
});

test("la phrase de méthode de l'abandon dit que seule la décision de l'équipe compte", () => {
  assert.match(METHODES.abandon, /Seule la décision de l'équipe compte/);
  assert.match(METHODES.effectif, /effacées à la demande de la personne sont comptées parmi les inscrits/);
});

test("chaque appel de indicateursPromo passe demandes (lecture du texte)", () => {
  const fichiers = [];
  const parcourir = (dossier) => readdirSync(dossier).forEach((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) parcourir(chemin);
    else if (chemin.endsWith(".js")) fichiers.push(chemin);
  });
  parcourir("js");
  const appels = [];
  for (const f of fichiers) {
    const code = readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
    for (const m of code.matchAll(/indicateursPromo\(/g)) {
      const avant = code.slice(Math.max(0, m.index - 16), m.index);
      if (/function\s+$/.test(avant)) continue;
      const reste = code.slice(m.index, m.index + 400);
      const fin = reste.indexOf("})");
      appels.push({ f, texte: reste.slice(0, fin + 2) });
    }
  }
  assert.ok(appels.length >= 7, "au moins sept appels trouvés : " + appels.length);
  for (const a of appels) assert.match(a.texte, /demandes/, `${a.f} : l'appel passe demandes`);
});

// --- Émargement ---

const SIGNE = "2026-10-27T08:30:00Z";
const SEANCES = [{ id: 1, debut: "09:00", fin: "12:30" }, { id: 2, debut: "13:30", fin: "17:00" }];
const AVANT = [{ seance_id: 1, stagiaire_id: 7, trace: "M1 1L9 9", signe_le: SIGNE }, { seance_id: 2, stagiaire_id: 7, trace: "M1 1L9 9", signe_le: SIGNE }];
const APRES = AVANT.map((l) => ({ ...l, trace: null, signature_effacee_le: "2030-01-02T08:00:00Z" }));

test("signature effacée : la ligne reste signée, les heures sont intactes", () => {
  assert.equal(etatLigne({ ligne: APRES[0] }).code, "signe");
  assert.equal(etatLigne({ ligne: APRES[0] }).libelle, etatLigne({ ligne: AVANT[0] }).libelle);
  assert.equal(minutesPresence(SEANCES, APRES, 7), minutesPresence(SEANCES, AVANT, 7));
  assert.equal(libelleDuree(minutesPresence(SEANCES, APRES, 7)), libelleDuree(minutesPresence(SEANCES, AVANT, 7)));
  assert.ok(minutesPresence(SEANCES, APRES, 7) > 0);
  assert.deepEqual(resumeSeance(APRES, [7], true), resumeSeance(AVANT, [7], true));
  assert.equal(signatureEffacee(APRES[0]), true);
  assert.equal(signatureEffacee(AVANT[0]), false);
  assert.equal(ligneSignee({ absent: true }), false);
  assert.equal(ligneSignee(null), false);
  assert.equal(etatLigne({ ligne: { stagiaire_id: 7, signe_le: null, trace: null, absent: true } }).code, "absent");
});

test("la feuille imprimée écrit la mention à la place du dessin et garde le total d'heures", async () => {
  const { installerDocument, serialiserDom, NoeudFactice } = await import("./aides-dom.mjs");
  const { feuilleSeance, feuilleSemaine } = await import("../js/emargement-feuilles.js");
  const dom = installerDocument();
  const avant = Object.getOwnPropertyDescriptor(globalThis, "Node");
  Object.defineProperty(globalThis, "Node", { value: NoeudFactice, configurable: true, writable: true });
  // Le DOM factice n'a pas de style : feuilleSeance règle la hauteur des lignes avec style.setProperty.
  Object.defineProperty(NoeudFactice.prototype, "style", { get() { return { setProperty() {} }; }, configurable: true });
  try {
    const stagiaires = [{ id: 7, prenom: "Anonyme 7", nom: null, actif: true, anonymise_le: "2030-01-02T08:00:00Z" }];
    const seance = (lignes, formateurs) => ({ id: 1, statut: "close", jour: "2026-10-27", demi_journee: "matin", debut: "09:00", fin: "12:30",
      ouverte_le: SIGNE, close_le: SIGNE, lignes, formateurs });
    const formateur = (extra) => [{ nom: "Formateur 1", signe_le: SIGNE, ...extra }];
    const rendreSeance = (lignes, formateurs) => serialiserDom(feuilleSeance({
      entete: {}, promo: { nom: "Promo" }, seance: seance(lignes, formateurs), stagiairesTous: stagiaires }));
    const apres = rendreSeance([APRES[0]], formateur({ trace: null, signature_effacee_le: "2030-01-02T08:00:00Z" }));
    assert.ok(apres.includes(MENTION_SIGNATURE_EFFACEE), "mention sur la feuille de séance");
    assert.equal(apres.split(MENTION_SIGNATURE_EFFACEE).length - 1, 2, "stagiaire et formateur");
    assert.ok(apres.includes("Présents : 1"), "présence gardée");
    assert.ok(apres.includes("Anonyme 7"));
    const avantRendu = rendreSeance([AVANT[0]], formateur({ trace: "M1 1L9 9" }));
    assert.ok(!avantRendu.includes(MENTION_SIGNATURE_EFFACEE));
    assert.ok(avantRendu.includes("Présents : 1"));

    const semaine = (lignes) => serialiserDom(feuilleSemaine({
      entete: {}, promo: { nom: "Promo" }, lundi: "2026-10-26",
      seances: [{ ...seance(lignes, []), id: 1 }, { ...seance(lignes.map((l) => ({ ...l, seance_id: 2 })), []), id: 2, demi_journee: "aprem", debut: "13:30", fin: "17:00" }],
      stagiairesTous: stagiaires }));
    const sApres = semaine(APRES);
    assert.ok(sApres.includes(MENTION_SIGNATURE_EFFACEE));
    const heures = (html) => (html.match(/emf-heures[^>]*>[^<]*</g) || []).join("|");
    assert.equal(heures(sApres), heures(semaine(AVANT)), "total d'heures de la semaine inchangé");
  } finally {
    delete NoeudFactice.prototype.style;
    if (avant) Object.defineProperty(globalThis, "Node", avant); else delete globalThis.Node;
    dom.restaurer();
  }
});

// --- Pièces et dossiers ---

const piece = (inv, cle) => inv.indicateurs.flatMap((i) => i.pieces).find((p) => p.cle === cle);

test("demande : même effectif au tableau de bord et au dossier, pièce non manquante", () => {
  const demandes = new Set([4]);
  const d = { ...D, demandes };
  const inv = inventairePromo(d, REF, OPT);
  const ind = indicateursPromo(d, REF, { aujourdhui: AUJ, demandes });
  assert.equal(piece(inv, "effectif").detail, "5 inscrits, dont 3 ont suivi la formation jusqu'au bout, 1 abandon et 1 fiche effacée à la demande");
  assert.ok(piece(inv, "effectif").detail.startsWith(`${ind.effectif.valeur} inscrits, dont ${ind.effectif.detail.enFormation} ont suivi`));
  // Le dossier est compté sur les stagiaires en formation, sans la fiche effacée.
  assert.equal(piece(inv, "dossierPro").detail, "enregistré pour 1 stagiaire sur 3 en formation, dernière mise à jour le 10/10");
  // Sans la lecture des demandes, la fiche effacée est comptée en formation : le contrôle s'applique bien.
  assert.ok(piece(inventairePromo(D, REF, OPT), "dossierPro").detail.includes("sur 4 en formation"));
});

test("demande : si toutes les fiches sont effacées à la demande, le dossier n'est pas manquant", () => {
  const d = { stagiaires: [fiche(4, { anonymise_le: "2027-05-01T08:00:00Z" })], demandes: new Set([4]) };
  const p = piece(inventairePromo(d, REF, OPT), "dossierPro");
  assert.equal(p.presente, false);
  assert.equal(p.raison, "effacé à la demande des personnes");
});

test("étape 2 : raison fixe, jamais « aucun dossier enregistré »", () => {
  const anon = { efface_le: "2030-01-02T08:00:00Z", anonymise_le: "2030-01-02T08:00:00Z" };
  const d = { stagiaires: [fiche(1, anon), fiche(2, anon), fiche(3, { actif: false, ...anon })], dossiers: [], livrets: [] };
  const inv = inventairePromo(d, REF, { promo: PROMO, aujourdhui: "2030-02-01" });
  assert.equal(RAISON_EFFACEE, "effacé au terme de la durée de conservation");
  assert.equal(piece(inv, "dossierPro").raison, RAISON_EFFACEE);
  assert.equal(piece(inv, "evaluations").raison, RAISON_EFFACEE);
  assert.equal(piece(inv, "effectif").detail, "3 inscrits, dont 2 ont suivi la formation jusqu'au bout et 1 abandon");
  // Avant l'étape 2 (étape 1 seulement), la raison d'origine reste.
  const etape1 = { ...d, stagiaires: d.stagiaires.map((s) => ({ ...s, anonymise_le: null })) };
  assert.equal(piece(inventairePromo(etape1, REF, OPT), "dossierPro").raison, "aucun dossier professionnel enregistré par les stagiaires en formation");
});

test("satisfaction figée : lue comme la vivante", () => {
  const questions = { q_globale: { reponses: { 1: 0, 2: 1, 3: 1, 4: 3, 5: 2 } } };
  const vivante = { seuil: 5, questions };
  assert.deepEqual(satisfactionDe({ ...vivante, fige: true, fige_le: "2030-01-02T08:00:00Z" }, 5), satisfactionDe(vivante, 5));
});

test("dossier de la formation : statut des fiches, phrase exacte, pièces effacées", () => {
  const demandes = new Set([4]);
  const anon = { efface_le: "2030-01-02T08:00:00Z", anonymise_le: "2030-01-02T08:00:00Z" };
  const stagiaires = [fiche(1, anon), fiche(2, anon), fiche(3, { actif: false, ...anon }),
    fiche(4, { prenom: "Anonyme 4", nom: null, ...anon }), fiche(5, anon)];
  const d = { stagiaires, dossiers: [], livrets: [], demandes };
  const ind = indicateursPromo(d, REF, { aujourdhui: "2030-02-01", demandes });
  const inv = inventairePromo(d, REF, { promo: PROMO, aujourdhui: "2030-02-01" });
  const m = modeleDossierFormation({ inv, donnees: d, ind, promo: PROMO, lieu: "Centre", intitule: "Titre", aujourdhui: "2030-02-01" });
  const tout = JSON.stringify(m);
  assert.ok(tout.includes("Fiche effacée à la demande de la personne"));
  assert.ok(tout.includes("Abandon"));
  assert.ok(tout.includes("Formation suivie"));
  assert.ok(tout.includes(RAISON_EFFACEE));
  assert.ok(!tout.includes("aucun dossier professionnel"));
  assert.ok(tout.includes("dont 1 fiche effacée à la demande de la personne"));
  assert.ok(!tout.includes(TIRET));
});

test("aucune fuite de nom dans les versions sans noms du dossier du centre", () => {
  const demandes = new Set([4]);
  const d = { stagiaires: STAG.map((s) => ({ ...s, prenom: s.nom ? "Secretprenom" + s.id : s.prenom, nom: s.nom ? "Secretnom" + s.id : s.nom })),
    dossiers: [], livrets: [], demandes };
  const ind = indicateursPromo(d, REF, { aujourdhui: AUJ, demandes });
  const inv = inventairePromo(d, REF, OPT);
  const m = modeleDossierCentre({ promos: [{ promo: PROMO, donnees: d, inv, ind }], lieu: "Centre", lieuId: 1,
    periode: { du: "2026-01-01", au: "2027-12-31" }, aujourdhui: AUJ, sansNoms: true, nouveautes: [] });
  const tout = JSON.stringify(m);
  assert.ok(!/Secret(prenom|nom)/.test(tout), "aucun nom");
  assert.ok(!tout.includes("Anonyme 4"), "aucune ligne par fiche");
  assert.ok(tout.includes("5 inscrits (dont 1 effacée à la demande)"));
  assert.ok(!tout.includes(TIRET));
});

test("statutFiche : la demande prime", () => {
  assert.equal(statutFiche(fiche(1, { actif: false }), true, true), "Fiche effacée à la demande de la personne");
  assert.equal(statutFiche(fiche(1, { actif: false }), true, false), "Abandon");
});
