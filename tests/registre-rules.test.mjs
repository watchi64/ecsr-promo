import test from "node:test";
import assert from "node:assert/strict";
import {
  TYPES, ORIGINES, ETATS, RAPPEL_VIOLENCES, LIMITE_TEXTE,
  validerEntree, filtrerRegistre, entreeDepuisSignalement, entreesPourPromo, entreesPourCentre,
  decompteRegistre, delaiMedianJours, echeanceEffacement, aEffacer, aClore,
  registreCsv, nomFichierRegistre,
} from "../js/registre-rules.js";

const TIRET = String.fromCharCode(0x2014);
const BOM = String.fromCharCode(0xfeff);
const AUJOURDHUI = "2026-11-09";

test("types, origines et états exacts", () => {
  assert.deepEqual(Object.keys(TYPES), ["reclamation", "difficulte", "alea", "amelioration", "risque"]);
  assert.deepEqual(Object.keys(ORIGINES), ["stagiaire", "formateur", "entreprise", "financeur", "equipe", "autre"]);
  assert.deepEqual(Object.keys(ETATS), ["ouvert", "en_cours", "clos"]);
  assert.equal(TYPES.reclamation, "Réclamation");
  assert.equal(ORIGINES.equipe, "Équipe");
  assert.equal(ETATS.en_cours, "En cours");
  assert.equal(LIMITE_TEXTE, 2000);
});

test("aucun libellé ni rappel avec tiret cadratin ou « prof »", () => {
  const textes = [...Object.values(TYPES), ...Object.values(ORIGINES), ...Object.values(ETATS), RAPPEL_VIOLENCES];
  for (const t of textes) {
    assert.ok(!t.includes(TIRET), t);
    assert.ok(!/prof/i.test(t), t);
  }
  assert.equal(RAPPEL_VIOLENCES, "Violences, harcèlement, discriminations : ne les écris pas ici. Ils passent par le référent du centre et sa procédure, qui protègent la personne. Ne nomme personne : l'origine suffit.");
});

const complete = () => ({
  type: "difficulte", origine: "stagiaire", date_constat: "2026-11-02", description: "Le planning ne s'affiche pas",
  reponse: "", date_reponse: "", mesure_prevention: "", etat: "ouvert",
});

test("validerEntree : entrée complète acceptée", () => {
  assert.deepEqual(validerEntree(complete(), AUJOURDHUI), { ok: true, erreurs: {} });
  const avecReponse = { ...complete(), reponse: "Corrigé", date_reponse: "2026-11-03", etat: "clos" };
  assert.equal(validerEntree(avecReponse, AUJOURDHUI).ok, true);
});

test("validerEntree : type, origine et date requis", () => {
  const r = validerEntree({ ...complete(), type: "", origine: "", date_constat: "" }, AUJOURDHUI);
  assert.equal(r.ok, false);
  assert.ok(r.erreurs.type && r.erreurs.origine && r.erreurs.date_constat);
});

test("validerEntree : date dans le futur refusée", () => {
  const r = validerEntree({ ...complete(), date_constat: "2026-11-10" }, AUJOURDHUI);
  assert.ok(r.erreurs.date_constat);
  assert.equal(validerEntree({ ...complete(), date_constat: AUJOURDHUI }, AUJOURDHUI).ok, true);
});

test("validerEntree : description de 3 à 2 000 caractères", () => {
  assert.ok(validerEntree({ ...complete(), description: "ab" }, AUJOURDHUI).erreurs.description);
  assert.ok(validerEntree({ ...complete(), description: "  a " }, AUJOURDHUI).erreurs.description);
  assert.equal(validerEntree({ ...complete(), description: "abc" }, AUJOURDHUI).ok, true);
  assert.equal(validerEntree({ ...complete(), description: "a".repeat(2000) }, AUJOURDHUI).ok, true);
  assert.ok(validerEntree({ ...complete(), description: "a".repeat(2001) }, AUJOURDHUI).erreurs.description);
});

test("validerEntree : date de réponse seulement avec une réponse, ni avant le constat ni dans le futur", () => {
  assert.ok(validerEntree({ ...complete(), date_reponse: "2026-11-03" }, AUJOURDHUI).erreurs.date_reponse);
  const veille = validerEntree({ ...complete(), reponse: "Fait", date_reponse: "2026-11-01" }, AUJOURDHUI);
  assert.ok(veille.erreurs.date_reponse);
  const futur = validerEntree({ ...complete(), reponse: "Fait", date_reponse: "2026-11-10" }, AUJOURDHUI);
  assert.ok(futur.erreurs.date_reponse);
  assert.equal(validerEntree({ ...complete(), reponse: "Fait", date_reponse: "2026-11-02" }, AUJOURDHUI).ok, true);
  assert.equal(validerEntree({ ...complete(), reponse: "Fait" }, AUJOURDHUI).ok, true);
});

test("validerEntree : mesure de prévention seulement pour un risque, requise pour clore un risque", () => {
  assert.ok(validerEntree({ ...complete(), mesure_prevention: "Doubler le contrôle" }, AUJOURDHUI).erreurs.mesure_prevention);
  const risque = { ...complete(), type: "risque" };
  assert.equal(validerEntree({ ...risque, mesure_prevention: "Doubler le contrôle" }, AUJOURDHUI).ok, true);
  assert.equal(validerEntree({ ...risque, etat: "en_cours" }, AUJOURDHUI).ok, true);
  assert.ok(validerEntree({ ...risque, etat: "clos" }, AUJOURDHUI).erreurs.mesure_prevention);
  assert.ok(validerEntree({ ...risque, etat: "clos", mesure_prevention: "   " }, AUJOURDHUI).erreurs.mesure_prevention);
  assert.equal(validerEntree({ ...risque, etat: "clos", mesure_prevention: "Doubler le contrôle" }, AUJOURDHUI).ok, true);
});

test("filtrerRegistre : état et type, du plus récent au plus ancien", () => {
  const e = [
    { id: 1, date_constat: "2026-10-01", etat: "ouvert", type: "alea" },
    { id: 2, date_constat: "2026-11-01", etat: "clos", type: "risque" },
    { id: 3, date_constat: "2026-11-01", etat: "ouvert", type: "risque" },
    { id: 4, date_constat: "2026-09-01", etat: "ouvert", type: "risque" },
  ];
  assert.deepEqual(filtrerRegistre(e, {}).map((x) => x.id), [3, 2, 1, 4]);
  assert.deepEqual(filtrerRegistre(e, { etat: "tous", type: "tous" }).map((x) => x.id), [3, 2, 1, 4]);
  assert.deepEqual(filtrerRegistre(e, { etat: "ouvert" }).map((x) => x.id), [3, 1, 4]);
  assert.deepEqual(filtrerRegistre(e, { etat: "ouvert", type: "risque" }).map((x) => x.id), [3, 4]);
  assert.deepEqual(e.map((x) => x.id), [1, 2, 3, 4], "l'entrée n'est pas modifiée");
});

test("entreeDepuisSignalement : origine, jour de Paris, aucune donnée personnelle", () => {
  const s = {
    id: 7, role: "fondateur", nom: "V. Timy", email: "t@example.invalid", message: "Le planning ne s'affiche pas",
    promo_id: 3, contexte: { page: "#/planning" }, created_at: "2026-11-01T23:30:00Z",
  };
  const r = entreeDepuisSignalement(s);
  assert.deepEqual(r, {
    type: "difficulte", origine: "equipe", promo_id: 3, description: "Le planning ne s'affiche pas",
    date_constat: "2026-11-02", signalement_id: 7,
  });
  const json = JSON.stringify(r);
  assert.ok(!json.includes("Timy") && !json.includes("example.invalid"));
  assert.equal(entreeDepuisSignalement({ ...s, role: "stagiaire" }).origine, "stagiaire");
  assert.equal(entreeDepuisSignalement({ ...s, role: "formateur" }).origine, "formateur");
  assert.equal(entreeDepuisSignalement({ ...s, promo_id: undefined }).promo_id, null);
  assert.equal(entreeDepuisSignalement({ ...s, message: "a".repeat(2500) }).description.length, 2000);
});

const E = (id, o) => ({ id, promo_id: null, lieu_id: null, date_constat: "2026-03-10", ...o });

test("entreesPourPromo : la promo, plus l'organisme et son lieu dans sa période", () => {
  const promo = { id: 5, lieu_id: 2, date_debut: "2026-01-12", date_fin: "2026-06-30" };
  const entrees = [
    E(1, { promo_id: 5 }),
    E(2, { promo_id: 6 }),
    E(3, { lieu_id: 2 }),
    E(4, { lieu_id: 9 }),
    E(5, {}),
    E(6, { date_constat: "2025-12-31" }),
    E(7, { date_constat: "2026-07-01" }),
    E(8, { promo_id: 5, date_constat: "2025-01-01" }),
  ];
  assert.deepEqual(entreesPourPromo(entrees, promo, AUJOURDHUI).map((x) => x.id), [1, 3, 5, 8]);
  const enCours = { id: 5, lieu_id: 2, date_debut: "2026-01-12", date_fin: null };
  const apres = [E(10, { date_constat: "2026-11-09" }), E(11, { date_constat: "2026-11-10" })];
  assert.deepEqual(entreesPourPromo(apres, enCours, AUJOURDHUI).map((x) => x.id), [10]);
});

test("entreesPourCentre : chaque entrée une fois", () => {
  const entrees = [
    E(1, { promo_id: 5 }), E(2, { promo_id: 6 }), E(3, { promo_id: 7 }),
    E(4, { lieu_id: 2 }), E(5, {}), E(6, { lieu_id: 9 }), E(7, { date_constat: "2024-01-01" }),
  ];
  const portee = { lieuId: 2, promoIds: [5, 6], du: "2026-01-01", au: "2026-12-31" };
  assert.deepEqual(entreesPourCentre(entrees, portee).map((x) => x.id), [1, 2, 4, 5]);
  assert.deepEqual(entreesPourCentre([...entrees, ...entrees], portee).map((x) => x.id), [1, 2, 4, 5]);
});

test("decompteRegistre : toutes les clés, zéros compris", () => {
  const d = decompteRegistre([{ type: "alea", etat: "clos" }, { type: "alea", etat: "ouvert" }, { type: "risque", etat: "ouvert" }]);
  assert.equal(d.total, 3);
  assert.deepEqual(Object.keys(d.parType), Object.keys(TYPES));
  assert.deepEqual(Object.keys(d.parEtat), Object.keys(ETATS));
  assert.equal(d.parType.alea, 2);
  assert.equal(d.parType.reclamation, 0);
  assert.equal(d.parEtat.ouvert, 2);
  assert.equal(d.parEtat.en_cours, 0);
  assert.deepEqual(decompteRegistre([]), {
    total: 0,
    parType: { reclamation: 0, difficulte: 0, alea: 0, amelioration: 0, risque: 0 },
    parEtat: { ouvert: 0, en_cours: 0, clos: 0 },
  });
});

test("delaiMedianJours : médiane des délais datés", () => {
  const e = (d) => ({ date_constat: "2026-11-01", date_reponse: d });
  assert.equal(delaiMedianJours([e("2026-11-03"), e("2026-11-06"), e("2026-11-10")]), 5);
  assert.equal(delaiMedianJours([e("2026-11-03"), e("2026-11-06")]), 3.5);
  assert.equal(delaiMedianJours([e("2026-11-01")]), 0);
  assert.equal(delaiMedianJours([{ date_constat: "2026-11-01", date_reponse: null }, { date_constat: "2026-11-01" }]), null);
  assert.equal(delaiMedianJours([]), null);
  assert.equal(delaiMedianJours([e("2026-11-10"), { date_constat: "2026-11-01", date_reponse: null }]), 9);
});

test("échéance d'effacement : 3 ans, 29 février compris", () => {
  assert.equal(echeanceEffacement("2028-02-29T10:00:00Z").toISOString(), "2031-02-28T10:00:00.000Z");
  assert.equal(echeanceEffacement("2026-11-09T08:00:00Z").toISOString(), "2029-11-09T08:00:00.000Z");
  assert.equal(echeanceEffacement(null), null);
});

test("aEffacer : closes, non effacées, échéance passée", () => {
  const clos = { id: 1, etat: "clos", clos_le: "2026-01-10T12:00:00Z" };
  const apres = new Date("2029-01-10T13:00:00Z");
  const avant = new Date("2029-01-10T11:00:00Z");
  assert.equal(aEffacer([clos], apres).length, 1);
  assert.equal(aEffacer([clos], avant).length, 0);
  assert.equal(aEffacer([{ ...clos, etat: "ouvert", clos_le: null }], apres).length, 0);
  assert.equal(aEffacer([{ ...clos, efface_le: "2029-01-11T00:00:00Z" }], apres).length, 0);
  assert.equal(aEffacer([{ ...clos, efface: true }], apres).length, 0);
});

test("aClore : ouvertes ou en cours depuis plus de 3 ans", () => {
  const e = [
    { id: 1, etat: "ouvert", date_constat: "2023-11-08" },
    { id: 2, etat: "en_cours", date_constat: "2023-11-09" },
    { id: 3, etat: "en_cours", date_constat: "2023-01-01" },
    { id: 4, etat: "clos", date_constat: "2020-01-01", clos_le: "2020-02-01T00:00:00Z" },
    { id: 5, etat: "ouvert", date_constat: "2026-01-01" },
  ];
  assert.deepEqual(aClore(e, AUJOURDHUI).map((x) => x.id), [1, 3]);
});

const ENTETE = "N°;Date;Type;Origine;Promo;Centre;Description;Réponse;Date de réponse;Délai (jours);Action décidée;Mesure de prévention;État;Clos le;Issu d'un signalement";

test("registreCsv : BOM, en-tête, CRLF", () => {
  const csv = registreCsv([], {}, {});
  assert.equal(csv, BOM + ENTETE + "\r\n");
});

test("registreCsv : une ligne complète, promo et centre nommés", () => {
  const e = {
    id: 12, date_constat: "2026-11-02", type: "risque", origine: "equipe", promo_id: 5, lieu_id: 2,
    description: "Panne du vidéoprojecteur", reponse: "Remplacé", date_reponse: "2026-11-05", action_decidee: "Achat",
    mesure_prevention: "Appareil de secours", etat: "clos", clos_le: "2026-11-06T09:00:00Z", signalement_id: 7, issu_signalement: true,
  };
  const csv = registreCsv([e], { 5: "Montpellier 2026" }, new Map([[2, "Montpellier"]]));
  const lignes = csv.slice(1).split("\r\n");
  assert.equal(lignes[1], "12;2026-11-02;Risque;Équipe;Montpellier 2026;Montpellier;Panne du vidéoprojecteur;Remplacé;2026-11-05;3;Achat;Appareil de secours;Clos;2026-11-06;Oui");
  assert.equal(lignes[2], "");
});

test("registreCsv : formules neutralisées, séparateurs cités", () => {
  const base = { id: 1, date_constat: "2026-11-02", type: "alea", origine: "autre", etat: "ouvert" };
  const csv = registreCsv([
    { ...base, description: '=HYPERLINK("http://x")', reponse: "+33 6", action_decidee: "-2", mesure_prevention: "@SUM(A1)" },
    { ...base, id: 2, description: "a;b", reponse: "ligne 1\nligne 2" },
  ], {}, {});
  const l = csv.slice(1);
  assert.ok(l.includes(';"\'=HYPERLINK(""http://x"")";'), l);
  assert.ok(l.split(";").some((c) => c.startsWith('"\'=HYPERLINK(')));
  assert.ok(l.includes(";'+33 6;"));
  assert.ok(l.includes(";'-2;"));
  assert.ok(l.includes(";'@SUM(A1);"));
  assert.ok(l.includes('"a;b"'));
  assert.ok(l.includes('"ligne 1\nligne 2"'));
});

test("registreCsv : sans promo ni lieu, tout l'organisme ; entrée effacée", () => {
  const e = {
    id: 3, date_constat: "2022-05-01", type: "reclamation", origine: "financeur", description: null, reponse: null,
    etat: "clos", clos_le: "2022-06-01T00:00:00Z", efface_le: "2025-06-02T00:00:00Z",
  };
  const csv = registreCsv([e], {}, {});
  const ligne = csv.slice(1).split("\r\n")[1].split(";");
  assert.equal(ligne[4], "");
  assert.equal(ligne[5], "Tout l'organisme");
  const txt = "texte effacé (3 ans après la clôture)";
  assert.equal(ligne[6], txt);
  assert.equal(ligne[7], txt);
  assert.equal(ligne[10], txt);
  assert.equal(ligne[11], txt);
  assert.equal(ligne[14], "Non");
});

test("nomFichierRegistre", () => {
  assert.equal(nomFichierRegistre("2026-11-09"), "registre-qualite-2026-11-09.csv");
  assert.equal(nomFichierRegistre("2026-11-09T10:00:00Z"), "registre-qualite-2026-11-09.csv");
});
