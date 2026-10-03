// Navigation interne (chantier D, lot 2) : garde de saisie et mise à jour sur place.
import assert from "node:assert/strict";
import {
  poserGardeSortie, leverGardeSortie, gardeActive, peutQuitter,
  surChangementAdresse, majSurPlacePour, oublierMajSurPlace, noterAdresse, adresseCourante,
} from "../js/navigation.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const sansQuestion = () => { throw new Error("aucune question attendue"); };

// 1. Garde de saisie
ok(peutQuitter(sansQuestion), "sans garde : on part sans question");
let sale = false;
const g = { estSale: () => sale, message: "Abandonner la saisie en cours ?" };
poserGardeSortie(g);
ok(!gardeActive(), "rien de saisi : garde inactive");
ok(peutQuitter(sansQuestion), "rien de saisi : pas de question");
sale = true;
ok(gardeActive(), "saisie en cours : garde active");
let question = null;
ok(!peutQuitter((m) => { question = m; return false; }), "refus : on reste");
eq(question, "Abandonner la saisie en cours ?", "le message de la garde est posé");
ok(gardeActive(), "refus : la garde reste");
ok(peutQuitter(() => true), "accord : on part");
ok(!gardeActive(), "accord : la garde tombe, pas de seconde question");
poserGardeSortie(g);
leverGardeSortie({ estSale: () => true, message: "autre" });
ok(gardeActive(), "lever la garde d'un autre ne lève pas celle-ci");
leverGardeSortie(g);
ok(!gardeActive(), "lever sa propre garde");
poserGardeSortie(g);
leverGardeSortie();
ok(!gardeActive(), "lever sans argument : plus de garde");

// 2. Mise à jour sur place
const f = () => {};
surChangementAdresse("stagiaires", f);
eq(majSurPlacePour("stagiaires"), f, "même page : la mise à jour est rendue");
eq(majSurPlacePour("notes"), null, "autre page : rien");
oublierMajSurPlace();
eq(majSurPlacePour("stagiaires"), null, "oubliée");

// 3. Adresse courante
noterAdresse("#/stagiaires/3");
eq(adresseCourante(), "#/stagiaires/3", "adresse notée");

console.log(`navigation : ${n} assertions OK`);
