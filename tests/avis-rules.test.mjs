import assert from "node:assert/strict";
import { AVIS, urlAutorisee, lendemain, lireEtat, etatPlusTard, bandeauVisible } from "../js/avis-rules.js";

const avis = { id: "test", promoId: 1, url: "https://forms.gle/abc123", fin: "2026-11-30" };
const base = { avis, promoId: 1, stagiaire: true, aujourdhui: "2026-10-16", etat: null };

// Liens : Google Forms seulement, en https.
assert.equal(urlAutorisee("https://forms.gle/abc123"), true);
assert.equal(urlAutorisee("https://docs.google.com/forms/d/e/xyz/viewform"), true);
assert.equal(urlAutorisee("http://forms.gle/abc123"), false);
assert.equal(urlAutorisee("https://docs.google.com/document/d/xyz"), false);
assert.equal(urlAutorisee("https://forms.gle.evil.example/x"), false);
assert.equal(urlAutorisee(""), false);
assert.equal(urlAutorisee(undefined), false);

// Lendemain, y compris fin de mois et passage à l'heure d'hiver.
assert.equal(lendemain("2026-10-31"), "2026-11-01");
assert.equal(lendemain("2026-10-24"), "2026-10-25");
assert.equal(lendemain("2026-12-31"), "2027-01-01");

// Lecture du choix mémorisé.
assert.equal(lireEtat(null), null);
assert.equal(lireEtat("pas du json"), null);
assert.equal(lireEtat('{"statut":"inconnu"}'), null);
assert.equal(lireEtat('{"statut":"plus-tard"}'), null);
assert.deepEqual(lireEtat('{"statut":"repondu"}'), { statut: "repondu" });
assert.deepEqual(lireEtat(JSON.stringify(etatPlusTard("2026-10-16"))), { statut: "plus-tard", jusqua: "2026-10-17" });

// Visible : stagiaire de la bonne promo, avant la fin, sans choix fait.
assert.equal(bandeauVisible(base), true);
assert.equal(bandeauVisible({ ...base, stagiaire: false }), false);
assert.equal(bandeauVisible({ ...base, promoId: 2 }), false);
assert.equal(bandeauVisible({ ...base, promoId: undefined }), false);
assert.equal(bandeauVisible({ ...base, aujourdhui: "2026-11-30" }), true);
assert.equal(bandeauVisible({ ...base, aujourdhui: "2026-12-01" }), false);
assert.equal(bandeauVisible({ ...base, avis: { ...avis, url: "" } }), false);
assert.equal(bandeauVisible({ ...base, avis: { ...avis, url: "https://exemple.fr" } }), false);

// Choix : répondu et refusé ferment pour de bon ; plus tard revient le lendemain.
assert.equal(bandeauVisible({ ...base, etat: { statut: "repondu" } }), false);
assert.equal(bandeauVisible({ ...base, etat: { statut: "refuse" } }), false);
const tard = etatPlusTard("2026-10-16");
assert.equal(bandeauVisible({ ...base, etat: tard }), false);
assert.equal(bandeauVisible({ ...base, aujourdhui: "2026-10-17", etat: tard }), true);

// Sans lien, l'enquête réelle reste éteinte : rien ne s'affiche tant que le formulaire n'existe pas.
if (!AVIS.url) assert.equal(bandeauVisible({ ...base, avis: AVIS }), false);

console.log("avis-rules : OK");
