import test from "node:test";
import assert from "node:assert/strict";
import { resumeSeance, resumeEnClair, etatSansFeuille } from "../js/emargement-rules.js";
import { feuilleDuJour } from "../js/aujourdhui-rules.js";
import { libelleConnexion } from "../js/roles-rules.js";
import { sansPlaceDansLaDemi } from "../js/accueil-rules.js";
import { alerteDeCarte, journeeDuJour } from "../js/journee-rules.js";
import { colonnesParalleles } from "../js/planning-roles.js";
import { peutMontrer, aReprendre, perimee, ATTENTE_MAX_MS, REPRISE_MS } from "../js/messages-rules.js";

// Lot de corrections 2 (audit du 09/11/2026, docs/qualite/audit-2026-11-09.md, lot A et B1) : ce que l'app affiche
// doit être juste. Un test par défaut, dans l'ordre du document.

// === A1 : la feuille et « Aujourd'hui » comptent de la même façon ===

const MARDI = "2026-10-27";
const stagiaires = [
  { id: 1, prenom: "Timy", nom: "Vigne", actif: true },
  { id: 2, prenom: "Anissa", nom: "Boulet", actif: true },
  { id: 3, prenom: "Lorie", nom: "Martin", actif: true },
  { id: 4, prenom: "Valentin", nom: "Roux", actif: true },
];
const sig = (id) => ({ stagiaire_id: id, absent: false, signe_le: "2026-10-27T07:52:00Z", trace: "M0 0" });
const seance = (statut, lignes) => ({ id: 10, jour: MARDI, demi_journee: "matin", debut: "09:00", fin: "12:30", statut, lignes });
const carteAbsent = (sid) => ({ day_index: 1, half_day: "matin", activite: "Pédagogie salle", absences: [{ sid, rid: null }] });

test("A1 : resumeSeance compte à part les absents prévus au planning, parmi ceux qui n'ont rien dit", () => {
  const r = resumeSeance([sig(2)], [1, 2, 3, 4], false, new Set([4]));
  assert.deepEqual(r, { signes: 1, absents: 0, attente: 3, prevus: 1, total: 4 });
  // Sans planning, aucun prévu ; un prévu qui a signé n'est plus prévu.
  assert.equal(resumeSeance([sig(2)], [1, 2, 3, 4], false).prevus, 0);
  assert.equal(resumeSeance([sig(4)], [1, 2, 3, 4], false, new Set([4])).prevus, 0);
});

test("A1 : le résumé de la feuille dit signés, en attente et absents prévus, qui font le total", () => {
  assert.equal(resumeEnClair({ signes: 2, absents: 0, attente: 4, prevus: 1, total: 6 }, { ouverte: true }),
    " ont signé · 3 en attente · 1 absent prévu au planning");
  assert.equal(resumeEnClair({ signes: 1, absents: 1, attente: 4, prevus: 2, total: 6 }, { ouverte: true }),
    " ont signé · 1 absent · 2 en attente · 2 absents prévus au planning");
  assert.equal(resumeEnClair({ signes: 6, absents: 0, attente: 0, prevus: 0, total: 6 }, { ouverte: true }), " ont signé");
  // Une feuille close n'attend plus personne : seulement les absents.
  assert.equal(resumeEnClair({ signes: 4, absents: 2, attente: 0, prevus: 0, total: 6 }, { ouverte: false }), " ont signé · 2 absents");
});

test("A1 : « Aujourd'hui » nomme les absents (prévus au planning ou notés sur la feuille), qui n'attendent pas", () => {
  const f = feuilleDuJour({
    seances: [seance("ouverte", [sig(2), { stagiaire_id: 3, absent: true, signe_le: null }])],
    stagiaires, entries: [carteAbsent(4)],
  });
  assert.deepEqual(f.enAttente, ["Timy V."]);
  assert.deepEqual(f.absents, ["Lorie M.", "Valentin R."]);
  assert.equal(f.signes + f.enAttente.length + f.absents.length, f.total);
});

test("A1 : un absent prévu qui a signé est signé ; un absent prévu aussi noté sur la feuille compte une fois ; un abandon avec une ligne est nommé", () => {
  const avecAbandon = [...stagiaires, { id: 9, prenom: "Zoé", nom: "Abandon", actif: false }];
  const f = feuilleDuJour({
    seances: [seance("ouverte", [sig(4), { stagiaire_id: 3, absent: true, signe_le: null }, { stagiaire_id: 9, absent: true, signe_le: null }])],
    stagiaires: avecAbandon, entries: [carteAbsent(4), carteAbsent(3)],
  });
  assert.equal(f.signes, 1, "l'absent prévu qui a signé compte comme signé");
  assert.deepEqual(f.absents, ["Zoé A.", "Lorie M."]);
  assert.deepEqual(f.enAttente, ["Anissa B.", "Timy V."]);
  assert.equal(f.signes + f.enAttente.length + f.absents.length, f.total);
});

test("A1 : une feuille close ne nomme ni attente ni absents sur la carte", () => {
  const f = feuilleDuJour({ seances: [seance("close", [sig(1), sig(2)])], stagiaires, entries: [] });
  assert.deepEqual(f.absents, []);
});

// === A2 : une annonce ne remplace jamais une confirmation ===

const message = { genre: "message", texte: "Signalement classé comme corrigé." };
const annonce = { genre: "annonce", texte: "Ton signalement a avancé." };

test("A2 : un message (confirmation, erreur) passe toujours ; une annonce attend la place libre et les fenêtres fermées", () => {
  assert.equal(peutMontrer(message, { courant: { ...annonce, depuis: 0 }, fenetreOuverte: true }), true);
  assert.equal(peutMontrer(annonce, { courant: null, fenetreOuverte: false }), true);
  assert.equal(peutMontrer(annonce, { courant: { ...message, depuis: 0 }, fenetreOuverte: false }), false);
  assert.equal(peutMontrer(annonce, { courant: null, fenetreOuverte: true }), false, "le tiroir « Plus » ouvert : elle attend");
  assert.equal(peutMontrer(annonce, { courant: { ...annonce, depuis: 0 }, fenetreOuverte: false }), true);
});

test("A2 : une annonce coupée tout juste affichée revient après le message ; lue assez longtemps, elle ne revient pas", () => {
  assert.equal(aReprendre({ ...annonce, depuis: 1000 }, message, 1000 + REPRISE_MS - 1), true);
  assert.equal(aReprendre({ ...annonce, depuis: 1000 }, message, 1000 + REPRISE_MS), false);
  assert.equal(aReprendre({ ...message, depuis: 1000 }, message, 1001), false, "un message remplacé ne revient pas");
  assert.equal(aReprendre(null, message, 0), false);
});

test("A2 : une annonce qui attend trop longtemps est oubliée (ce n'est plus l'ouverture)", () => {
  assert.equal(perimee({ ...annonce, depose: 0 }, ATTENTE_MAX_MS - 1), false);
  assert.equal(perimee({ ...annonce, depose: 0 }, ATTENTE_MAX_MS), true);
  assert.equal(perimee({ ...message, depose: 0 }, ATTENTE_MAX_MS * 10), false);
});

// === A3 : l'Accueil dit quand le stagiaire n'est sur aucune activité ===

test("A3 : une demi-journée où aucune carte ne nomme le stagiaire le dit ; sinon rien", () => {
  const sans = [{ genre: "salle", moi: null }, { genre: "voiture", moi: null }];
  assert.equal(sansPlaceDansLaDemi({ demi: "matin", cartes: sans, moi: 1 }), "Ce matin, ton nom ne figure sur aucune activité du planning.");
  assert.equal(sansPlaceDansLaDemi({ demi: "aprem", cartes: sans, moi: 1 }), "Cet après-midi, ton nom ne figure sur aucune activité du planning.");
  assert.equal(sansPlaceDansLaDemi({ demi: "matin", cartes: [{ genre: "salle", moi: null }, { genre: "voiture", moi: { role: "voiture" } }], moi: 1 }), null);
  assert.equal(sansPlaceDansLaDemi({ demi: "matin", cartes: [], moi: 1 }), null, "rien au planning : la page le dit déjà");
  assert.equal(sansPlaceDansLaDemi({ demi: "matin", cartes: sans, moi: null }), null, "sans fiche (aperçu) : rien à dire");
});

test("A3 : un cours, un contrôle, une autonomie ou une autre activité concerne toute la promo : pas de phrase", () => {
  const noms = { stagiaires: new Map([[1, "Timy"], [2, "Anissa"]]), formateurs: new Map([[1, "Hocine"]]), benevoles: new Map(), titres: [] };
  const demiDe = (entries) => journeeDuJour({ entries, metas: [], joursOff: [], jour: "2026-10-28", moi: 1, noms }).demis.find((d) => d.demi === "matin");
  for (const carte of [{ activite: "Cours", sujet: "Vitesse" }, { activite: "Contrôle" }, { activite: "Autre" }, { activite: "Pédagogie salle", autonomie: true }]) {
    const d = demiDe([{ day_index: 2, half_day: "matin", prof_ids: [1], ...carte }]);
    assert.ok(d && d.cartes.length === 1, "la carte du matin existe : " + carte.activite);
    assert.equal(sansPlaceDansLaDemi({ demi: "matin", cartes: d.cartes, moi: 1 }), null, carte.activite + (carte.autonomie ? " en autonomie" : ""));
  }
  // Salle sans lui et voiture sans lui, vraies cartes : la phrase.
  const d = demiDe([
    { day_index: 2, half_day: "matin", activite: "Pédagogie salle", pedagogue_id: 2, eleves_ids: [2], prof_ids: [1] },
    { day_index: 2, half_day: "matin", activite: "Voiture (conduite)", eleves_ids: [2], prof_ids: [1], slot: 1 },
  ]);
  assert.equal(sansPlaceDansLaDemi({ demi: "matin", cartes: d.cartes, moi: 1 }), "Ce matin, ton nom ne figure sur aucune activité du planning.");
});

// === A7 : une demi-journée de cours sans feuille ne passe pas pour un jour sans cours ===

const coursMardiMatin = [{ day_index: 1, half_day: "matin", activite: "Pédagogie salle" }];

test("A7 : passée avec une activité au planning, la case dit « Feuille non faite »", () => {
  assert.deepEqual(etatSansFeuille({ jour: MARDI, aujourdhui: "2026-10-28", demi: "matin", entries: coursMardiMatin }),
    { etat: "Feuille non faite", classe: "manquante" });
  assert.deepEqual(etatSansFeuille({ jour: MARDI, aujourdhui: "2026-10-28", demi: "aprem", entries: coursMardiMatin }),
    { etat: "Rien de prévu", classe: "vide" });
  assert.deepEqual(etatSansFeuille({ jour: "2026-10-29", aujourdhui: "2026-10-28", demi: "matin", entries: coursMardiMatin }),
    { etat: "À venir", classe: "vide" });
  // Planning illisible : on ne sait pas, on garde l'ancien mot.
  assert.deepEqual(etatSansFeuille({ jour: MARDI, aujourdhui: "2026-10-28", demi: "matin", entries: null }),
    { etat: "Pas de feuille", classe: "vide" });
  // Une carte vide, ou qui ne porte qu'une note ou un formateur, n'est pas un cours ; un planning vide non plus.
  for (const carte of [{}, { notes: "Pont, pas de cours" }, { prof_ids: [1] }]) {
    assert.deepEqual(etatSansFeuille({ jour: MARDI, aujourdhui: "2026-10-28", demi: "matin", entries: [{ day_index: 1, half_day: "matin", ...carte }] }),
      { etat: "Rien de prévu", classe: "vide" });
  }
  assert.deepEqual(etatSansFeuille({ jour: MARDI, aujourdhui: "2026-10-28", demi: "matin", entries: [] }), { etat: "Rien de prévu", classe: "vide" });
  // Une semaine sans aucune feuille : l'émargement n'y servait pas encore, rien ne « manque ».
  assert.deepEqual(etatSansFeuille({ jour: MARDI, aujourdhui: "2026-10-28", demi: "matin", entries: coursMardiMatin, feuillesDeLaSemaine: 0 }),
    { etat: "Pas de feuille", classe: "vide" });
});

// === A8 : « connecté en tant que » dit le vrai rôle ===

test("A8 : le rôle de la personne sur la promo, ou celui de l'aperçu", () => {
  const promo = (roles) => ({ id: 1, roles });
  assert.equal(libelleConnexion({ profil: { role: "prof" }, promo: promo(["direction"]) }), "direction");
  assert.equal(libelleConnexion({ profil: { role: "prof" }, promo: promo(["formateur"]) }), "formateur");
  assert.equal(libelleConnexion({ profil: { role: "prof" }, promo: promo(["siege"]) }), "siège");
  assert.equal(libelleConnexion({ profil: { is_founder: true, is_admin: true }, promo: promo([]) }), "fondateur");
  assert.equal(libelleConnexion({ profil: { is_founder: true, is_admin: true }, promo: promo([]), apercu: "direction" }), "direction (aperçu)");
  // Base pas encore migrée (pas de colonne roles) : l'ancien profil.
  assert.equal(libelleConnexion({ profil: { role: "prof" }, promo: { id: 1 } }), "formateur");
  assert.equal(libelleConnexion({ profil: { role: "admin", is_founder: true }, promo: { id: 1 } }), "fondateur");
  assert.equal(libelleConnexion({ profil: null }), "");
  // Le fondateur reste fondateur, même formateur ou stagiaire de la promo (hors aperçu, il est dans l'espace de l'équipe).
  assert.equal(libelleConnexion({ profil: { is_founder: true, is_admin: true }, promo: promo(["stagiaire"]) }), "fondateur");
  assert.equal(libelleConnexion({ profil: { is_founder: true, is_admin: true }, promo: promo(["formateur"]) }), "fondateur");
  // Un formateur en aperçu stagiaire ; un aperçu qui ne lui est pas permis est ignoré ; promo absente (état dégradé).
  assert.equal(libelleConnexion({ profil: { role: "prof" }, promo: promo(["formateur"]), apercu: "stagiaire" }), "stagiaire (aperçu)");
  assert.equal(libelleConnexion({ profil: { role: "prof" }, promo: promo(["formateur"]), apercu: "direction" }), "formateur");
  assert.equal(libelleConnexion({ profil: { role: "prof" }, promo: null }), "formateur");
});

// === A9 : une voiture sans stagiaire se voit ===

test("A9 : une carte de voiture sans conducteur porte une alerte ; les autres non", () => {
  assert.equal(alerteDeCarte({ genre: "voiture", conducteurs: [] }), "Aucun stagiaire en voiture");
  assert.equal(alerteDeCarte({ genre: "voiture", conducteurs: [{ id: 1, nom: "Timy" }] }), null);
  assert.equal(alerteDeCarte({ genre: "salle", conducteurs: [] }), null);
  assert.equal(alerteDeCarte({ genre: "voiture", conducteurs: [], benevoles: ["Camille C."] }), "Aucun stagiaire en voiture",
    "des élèves bénévoles sans stagiaire au volant : l'alerte reste");
});

// === B1 : en mode Modifier, une carte seule sur son créneau prend toute la largeur ===

test("B1 : les colonnes parallèles se comptent par créneau, sans les trous de numérotation", () => {
  const e = (lane) => ({ lane });
  // Mercredi matin du banc : la voiture en voie 3 au créneau 1, la salle en voie 0 au créneau 2.
  assert.deepEqual(colonnesParalleles([{ lanes: [e(3)] }, { lanes: [e(0)] }]), { colonnes: 1, rangs: [[0], [0]] });
  // Deux activités en parallèle, dans le désordre : rangées par voie.
  assert.deepEqual(colonnesParalleles([{ lanes: [e(2), e(0)] }, { lanes: [e(5)] }]), { colonnes: 2, rangs: [[1, 0], [0]] });
  assert.deepEqual(colonnesParalleles([]), { colonnes: 1, rangs: [] });
  assert.deepEqual(colonnesParalleles([{ lanes: [{}] }]), { colonnes: 1, rangs: [[0]] }, "voie absente : la première");
  // Choix assumé (le même que la vue verrouillée) : chaque créneau se range seul, une voiture en voie 1 du créneau 2 passe à gauche.
  assert.deepEqual(colonnesParalleles([{ lanes: [e(0), e(1)] }, { lanes: [e(1)] }]), { colonnes: 2, rangs: [[0, 1], [0]] });
  assert.deepEqual(colonnesParalleles([{ lanes: [{ lane: null }, e(1), {}] }]), { colonnes: 3, rangs: [[0, 2, 1]] }, "voies nulles ou absentes : 0, à égalité dans l'ordre");
});
