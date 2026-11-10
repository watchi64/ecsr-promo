// Navigation interne (chantier D, lot 2) : garde de saisie et mise à jour sur place.
import assert from "node:assert/strict";
import {
  poserGardeSortie, leverGardeSortie, gardeActive, peutQuitter,
  surChangementAdresse, majSurPlacePour, oublierMajSurPlace, noterAdresse, adresseCourante,
} from "../js/navigation.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };


// 1. Garde de saisie (lot B des confirmations, 10/11) : la réponse est immédiate (le routeur et les sous-onglets ne
// savent pas attendre) ; une saisie en cours retient le geste et pose la question dans une fenêtre de l'app ; un accord
// lève la garde et rejoue le geste retenu.
const tour = () => new Promise((r) => setTimeout(r, 0));
const sansQuestion = () => { throw new Error("aucune question attendue"); };
ok(peutQuitter(null, { demander: sansQuestion }), "sans garde : on part sans question");
let sale = false;
const g = { estSale: () => sale, message: "Abandonner la saisie en cours ?" };
poserGardeSortie(g);
ok(!gardeActive(), "rien de saisi : garde inactive");
ok(peutQuitter(null, { demander: sansQuestion }), "rien de saisi : pas de question");
sale = true;
ok(gardeActive(), "saisie en cours : garde active");
let question = null, rejoue = 0, reponse = false;
const demander = (q) => { question = q; return Promise.resolve(reponse); };
ok(!peutQuitter(() => rejoue++, { demander }), "saisie en cours : le geste est retenu");
eq(question.titre, "Abandonner la saisie en cours ?", "la question reprend le message de la garde");
await tour();
eq(rejoue, 0, "refus : rien n'est rejoué");
ok(gardeActive(), "refus : la garde reste");
reponse = true;
ok(!peutQuitter(() => rejoue++, { demander }), "de nouveau retenu");
await tour();
eq(rejoue, 1, "accord : le geste est rejoué une fois");
ok(!gardeActive(), "accord : la garde tombe, pas de seconde question");
// Deux gestes pendant que la question est ouverte : une seule question.
poserGardeSortie(g);
let ouvertes = 0, liberer;
const lente = () => { ouvertes++; return new Promise((r) => { liberer = r; }); };
ok(!peutQuitter(() => rejoue++, { demander: lente }), "premier geste retenu");
ok(!peutQuitter(() => rejoue++, { demander: lente }), "second geste retenu aussi");
eq(ouvertes, 1, "une seule question à la fois");
liberer(false);
await tour();
// La question de la garde, quand elle en porte une (la grille EPCF), sert telle quelle.
const q = { titre: "Abandonner ?", phrase: "Rien n'est enregistré.", oui: "Abandonner", non: "Continuer la saisie" };
poserGardeSortie({ estSale: () => true, message: "Abandonner ?", question: q });
let posee = null;
peutQuitter(null, { demander: (x) => { posee = x; return Promise.resolve(false); } });
eq(posee, q, "la question de la garde est posée telle quelle");
await tour();
leverGardeSortie();
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
