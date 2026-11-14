import assert from "node:assert/strict";
import { adresseApp, avecAdresse } from "../js/adresse.js";
import { NOUVEAUTES } from "../js/nouveautes-data.js";

const loc = (origin, pathname) => ({ origin, pathname });

// À la racine d'un domaine (Scaleway) comme sous un sous-chemin (ancienne adresse GitHub Pages).
assert.equal(adresseApp(loc("https://app.exemple.fr", "/")), "https://app.exemple.fr/");
assert.equal(adresseApp(loc("https://app.exemple.fr", "/index.html")), "https://app.exemple.fr/");
assert.equal(adresseApp(loc("https://watchi64.github.io", "/ecsr-promo/")), "https://watchi64.github.io/ecsr-promo/");
assert.equal(adresseApp(loc("https://watchi64.github.io", "/ecsr-promo/index.html")), "https://watchi64.github.io/ecsr-promo/");
assert.equal(adresseApp(loc("http://localhost:8000", "/")), "http://localhost:8000/");
assert.equal(adresseApp(loc("http://localhost:8000", "")), "http://localhost:8000/");

// Le repère {adresse} des modèles de message.
assert.equal(avecAdresse("Lien : {adresse}#/informations-legales", loc("https://app.exemple.fr", "/")),
  "Lien : https://app.exemple.fr/#/informations-legales");
assert.equal(avecAdresse("sans repère", loc("https://app.exemple.fr", "/")), "sans repère");
assert.equal(avecAdresse(null, loc("https://app.exemple.fr", "/")), null);

// Plus aucune adresse d'hébergement écrite en dur dans les Nouveautés.
const texte = JSON.stringify(NOUVEAUTES);
assert.ok(!texte.includes("github.io"), "une Nouveauté cite encore l'adresse github.io");
assert.ok(texte.includes("{adresse}#/informations-legales"), "le modèle de SMS des bénévoles a perdu son lien");

console.log("adresse : OK");
