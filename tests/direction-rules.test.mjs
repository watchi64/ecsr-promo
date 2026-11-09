// Règles pures des pages de la direction (lot 5, Tasks 8, 9 et 10) : validation d'une promo, état d'une promo, recherche d'une
// fiche et liste du centre, équipe affichée. Lancer : node --test tests/direction-rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { validerPromo, etatPromo, partEcoulee, ouTrouverFiche, listeDuCentre, equipeAffichee } from "../js/direction-rules.js";

test("validerPromo : mêmes phrases que la base, sans préfixe", () => {
  assert.equal(validerPromo({ nom: "Nîmes mars", debut: "2026-03-02", fin: "2026-12-18" }), null);
  assert.equal(validerPromo({ nom: "Nîmes mars", debut: "2026-03-02", fin: null }), null);
  assert.equal(validerPromo({ nom: "Nîmes mars", debut: "2026-03-02", fin: "" }), null, "fin facultative");
  assert.equal(validerPromo({ nom: "Nîmes mars", debut: "2026-03-02", fin: "2026-03-02" }), null, "fin le jour du début");
  assert.equal(validerPromo({ nom: "", debut: "2026-03-02" }), "Le nom est requis.");
  assert.equal(validerPromo({ nom: "   ", debut: "2026-03-02" }), "Le nom est requis.");
  assert.equal(validerPromo({ debut: "2026-03-02" }), "Le nom est requis.");
  assert.equal(validerPromo({ nom: "A", debut: "" }), "La date de début est requise.");
  assert.equal(validerPromo({ nom: "A" }), "La date de début est requise.");
  assert.equal(validerPromo({ nom: "A", debut: "2026-03-02", fin: "2026-03-01" }), "La fin ne peut pas précéder le début.");
  assert.equal(validerPromo({ nom: "", debut: "", fin: "2020-01-01" }), "Le nom est requis.", "le nom d'abord");
});

test("etatPromo : à venir, en cours, terminée (règle de promosEnCours)", () => {
  const j = "2026-11-09";
  assert.equal(etatPromo({ date_debut: "2026-11-10", date_fin: "2027-06-01" }, j), "à venir");
  assert.equal(etatPromo({ date_debut: "2026-11-09", date_fin: "2027-06-01" }, j), "en cours", "début aujourd'hui");
  assert.equal(etatPromo({ date_debut: "2026-03-02", date_fin: "2026-11-09" }, j), "en cours", "fin aujourd'hui");
  assert.equal(etatPromo({ date_debut: "2026-03-02", date_fin: null }, j), "en cours", "sans fin");
  assert.equal(etatPromo({ date_debut: "2025-03-02", date_fin: "2025-12-18" }, j), "terminée");
  assert.equal(etatPromo({ date_debut: "2026-11-10", date_fin: null }, j), "à venir");
});

test("partEcoulee : pourcentage du temps de la promo écoulé, null sans fin", () => {
  const p = { date_debut: "2026-01-01", date_fin: "2026-01-11" };
  assert.equal(partEcoulee(p, "2025-12-31"), 0, "avant le début");
  assert.equal(partEcoulee(p, "2026-01-01"), 0, "le jour du début");
  assert.equal(partEcoulee(p, "2026-01-06"), 50);
  assert.equal(partEcoulee(p, "2026-01-11"), 100, "le jour de la fin");
  assert.equal(partEcoulee(p, "2027-01-01"), 100, "après la fin");
  assert.equal(partEcoulee({ date_debut: "2026-01-01", date_fin: "2026-01-04" }, "2026-01-02"), 33, "arrondi à l'entier");
  assert.equal(partEcoulee({ date_debut: "2026-01-01", date_fin: null }, "2026-06-01"), null, "fin non fixée");
  assert.equal(partEcoulee({ date_debut: null, date_fin: "2026-06-01" }, "2026-06-01"), null, "début absent");
  assert.equal(partEcoulee({ date_debut: "2026-01-01", date_fin: "2026-01-01" }, "2026-01-01"), 100, "promo d'un jour");
  assert.equal(partEcoulee({ date_debut: "2026-01-01", date_fin: "2026-01-01" }, "2025-12-31"), 0);
});

const P1 = { promoId: 1, nom: "Nîmes mars", stagiaires: [
  { id: 11, nom: "Zola", prenom: "Émile", actif: true },
  { id: 12, nom: "Arnaud", prenom: "Luc", actif: true },
  { id: 13, nom: "Moreau", prenom: "Jeanne", actif: false },
  { id: 14, nom: "", prenom: "Sans-nom", actif: true },
] };
const P2 = { promoId: 2, nom: "Nîmes sept", stagiaires: [{ id: 21, nom: "Bernard", prenom: "Ana", actif: true }] };

test("ouTrouverFiche : la promo de la fiche, null hors du centre", () => {
  assert.deepEqual(ouTrouverFiche(21, [P1, P2]), { promoId: 2 });
  assert.deepEqual(ouTrouverFiche("12", [P1, P2]), { promoId: 1 }, "identifiant de l'adresse (texte)");
  assert.deepEqual(ouTrouverFiche(13, [P1, P2]), { promoId: 1 }, "un abandon a sa fiche");
  assert.equal(ouTrouverFiche(99, [P1, P2]), null);
  assert.equal(ouTrouverFiche(null, [P1, P2]), null);
  assert.equal(ouTrouverFiche(11, []), null);
  assert.equal(ouTrouverFiche(11, undefined), null);
});

test("listeDuCentre : en formation d'abord, abandons repliés, tri par nom", () => {
  const g = listeDuCentre([P1, P2], {});
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].promoId, 1);
  assert.equal(g[0].nom, "Nîmes mars");
  assert.deepEqual(g[0].enFormation.map((s) => s.id), [12, 11, 14], "Arnaud, Zola, puis sans nom de famille");
  assert.deepEqual(g[0].abandons.map((s) => s.id), [13]);
  assert.deepEqual(g[1].enFormation.map((s) => s.id), [21]);
  assert.deepEqual(g[1].abandons, []);
});

test("listeDuCentre : recherche par nom (sans accent ni casse) et filtre de promo", () => {
  assert.deepEqual(listeDuCentre([P1, P2], { texte: "emile" }).map((x) => [x.promoId, x.enFormation.map((s) => s.id)]), [[1, [11]]],
    "les promos sans résultat disparaissent quand on cherche");
  assert.deepEqual(listeDuCentre([P1, P2], { texte: "  ZOLA  " })[0].enFormation.map((s) => s.id), [11]);
  assert.deepEqual(listeDuCentre([P1, P2], { texte: "moreau" })[0].abandons.map((s) => s.id), [13], "un abandon se retrouve");
  assert.deepEqual(listeDuCentre([P1, P2], { texte: "personne" }), []);
  assert.deepEqual(listeDuCentre([P1, P2], { promoId: 2 }).map((x) => x.promoId), [2]);
  assert.deepEqual(listeDuCentre([P1, { promoId: 3, nom: "Vide", stagiaires: [] }], {}).map((x) => x.promoId), [1, 3],
    "sans recherche, une promo vide reste (elle porte sa gestion)");
  assert.deepEqual(listeDuCentre(undefined, undefined), []);
});

test("equipeAffichee : nom ou adresse, rôle, promos du centre, tri", () => {
  const promos = [{ id: 1, nom: "Nîmes mars" }, { id: 2, nom: "Nîmes sept" }];
  const lignes = [
    { email: "zoe@exemple.invalid", nom: "Zoé Martin", direction: false, promos: [2, 1] },
    { email: "chef@exemple.invalid", nom: null, direction: true, promos: [] },
    { email: "ana@exemple.invalid", nom: "Ana Dupont", direction: false, promos: [1, 99] },
    { email: "dir@exemple.invalid", nom: "Marc Dir", direction: true, promos: [2] },
    { email: "sans@exemple.invalid", nom: "", direction: false, promos: [] },
  ];
  assert.deepEqual(equipeAffichee(lignes, promos), [
    { nom: "chef@exemple.invalid", role: "Direction", promos: "" },
    { nom: "Marc Dir", role: "Direction et formateur", promos: "Nîmes sept" },
    { nom: "Ana Dupont", role: "Formateur", promos: "Nîmes mars" },
    { nom: "sans@exemple.invalid", role: "Formateur", promos: "" },
    { nom: "Zoé Martin", role: "Formateur", promos: "Nîmes mars, Nîmes sept" },
  ]);
  assert.deepEqual(equipeAffichee([], promos), []);
  assert.deepEqual(equipeAffichee(undefined, undefined), []);
});
