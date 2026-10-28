// Page Qualiopi (spec 2026-10-28, § 6.3) : ce que le code source de la page, de son branchement et de sa feuille de style
// doit garantir et qu'aucun test de règle ne voit : porte du fondateur, aucune entrée de barre, nettoyage de l'impression,
// jeton de version, lecture par identifiant, contrat de la feuille de style (rien ne défile de côté, jamais de rouge,
// cibles de 44 px). Le rendu lui-même se contrôle au banc. Lancer depuis la racine du dépôt : node tests/qualiopi-page.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (v, msg) => { assert.ok(v, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const TIRET_CADRATIN = String.fromCharCode(0x2014);

const main = lire("js/main.js");
const index = lire("index.html");
const vue = lire("js/views/qualiopi.js");
const centre = lire("js/views/centre.js");
const css = lire("css/qualiopi.css");

// --- Jeton de version : celui du reste de l'app, dans l'index et dans chaque import de la page ---
const jeton = index.match(/js\/main\.js\?v=(\w+)/)[1];
eq(index.match(/css\/qualiopi\.css\?v=(\w+)/)?.[1], jeton, "la feuille de style est liée dans index.html avec le jeton des autres");
eq(index.match(/css\/emargement\.css\?v=(\w+)/)[1], jeton, "(témoin) la feuille voisine porte ce jeton");
for (const [nom, source] of [["js/views/qualiopi.js", vue], ["js/qualiopi-page-rules.js", lire("js/qualiopi-page-rules.js")], ["js/views/centre.js", centre], ["js/main.js", main]]) {
  const imports = [...source.matchAll(/from "(\.\.?\/[^"]+)"/g)].map((m) => m[1]);
  ok(imports.length > 0, `${nom} : des imports relatifs`);
  ok(imports.every((a) => a.endsWith(`.js?v=${jeton}`)), `${nom} : chaque import porte le jeton ${jeton} (un module chargé sous deux adresses le serait deux fois)`);
}

// --- Branchement : route, onglet allumé, porte du fondateur, nettoyage de l'impression ---
ok(/import \{ renderQualiopi, teardownQualiopiPrint \} from "\.\/views\/qualiopi\.js\?v=\w+";/.test(main), "main.js importe la page et son nettoyage");
ok(/\n  qualiopi:\s+renderQualiopi,\n/.test(main), "la route qualiopi mène à renderQualiopi");
ok(/const ONGLET_POUR_ROUTE = \{[^}]*\bqualiopi: "home"[^}]*\};/.test(main), "l'ancienne barre allume Accueil sur #/qualiopi");
const debutGarde = main.indexOf('else if (route === "qualiopi" && !isFounder()) {');
ok(debutGarde > 0, "une garde propre à la route qualiopi, sur isFounder()");
const garde = main.slice(debutGarde, main.indexOf("memoriserRoute(route);", debutGarde));   // la branche, jusqu'à la suite de navigate()
ok(/replaceState\(null, "", "#\/home"\)/.test(garde) && /route = "home";/.test(garde), "qui renvoie à #/home");
ok(!/toast\(/.test(garde), "sans un mot : aucun message");
ok(/isFounder, monStagiaireId/.test(main), "isFounder vient de auth-admin.js");
const navigate = main.slice(main.indexOf("async function navigate("), main.indexOf('window.addEventListener("hashchange"'));
ok(navigate.indexOf("teardownCentrePrint();") > 0 && navigate.indexOf("teardownQualiopiPrint();") > navigate.indexOf("teardownCentrePrint();"),
  "navigate nettoie l'impression Qualiopi à côté de celle du tableau de bord, avant de rendre la page");
ok(navigate.indexOf("teardownQualiopiPrint();") < navigate.indexOf("await routes[route](view)"), "et avant le rendu de la nouvelle page");

// --- Aucune entrée de barre, ni l'ancienne ni la nouvelle ; aucun module ---
const tabs = main.slice(main.indexOf("const TABS = ["), main.indexOf("];", main.indexOf("const TABS = [")));
ok(!/qualiopi/i.test(tabs), "l'ancienne barre (TABS) n'a pas d'entrée Qualiopi");
for (const fichier of ["js/nav-rules.js", "js/nav-shell.js", "js/menu-compte.js", "js/modules-data.js", "js/modules-etat.js"]) {
  ok(!/qualiopi/i.test(lire(fichier)), `${fichier} ne parle pas de Qualiopi : aucune entrée de barre, aucun module`);
}

// --- Bouton du tableau de bord du centre : le fondateur seul ---
ok(/isFounder\(\) \? el\("a", \{ class: "btn small centre-lien-qualiopi", href: "#\/qualiopi" \}, "Qualiopi"\) : null/.test(centre), "le bouton Qualiopi n'est monté que pour le fondateur");
ok(/export function telecharger\(/.test(centre), "le téléchargement du tableau de bord est partagé avec la page, pas recopié");
ok(!/function telecharger\(/.test(vue) && /import \{ telecharger \} from "\.\/centre\.js\?v=\w+";/.test(vue), "la page l'importe");

// --- Page : lecture par identifiant, impression nettoyée, textes ---
const lectures = [...vue.matchAll(/lireDonneesQualiopi\(([^)]*)\)/g)].map((m) => m[1]);
ok(lectures.length > 0 && lectures.every((a) => a === "id"), "la page lit une promo par son identifiant, jamais sans (lireDonneesQualiopi(id) seulement)");
ok(!/lireDonneesCentre|getPromoCourante\(\)\.id|promoCouranteId/.test(vue), "aucun repli sur la promo courante");
ok(/"@page \{ size: A4 portrait; margin: 12mm; \}"/.test(vue), "le format de page est A4 portrait, marges de 12 mm");
ok(vue.includes('const ID_IMPRESSION = "qualiopi-print"') && vue.includes('const CLASSE_IMPRESSION = "qualiopi-printable"'), "conteneur #qualiopi-print et classe qualiopi-printable sur <body>");
ok(/window\.addEventListener\("afterprint", ecouteurFin\)/.test(vue) && /window\.removeEventListener\("afterprint", ecouteurFin\)/.test(vue), "retrait à afterprint, écouteur retiré avec l'impression");
const nettoyage = vue.slice(vue.indexOf("export function teardownQualiopiPrint()"), vue.indexOf("function imprimer("));
ok(/\.remove\(\)/.test(nettoyage) && /classList\.remove\(CLASSE_IMPRESSION\)/.test(nettoyage) && /document\.title = titreAvant/.test(nettoyage),
  "teardownQualiopiPrint retire conteneur et format, la classe, et rend le titre de la page");
ok(vue.indexOf("teardownQualiopiPrint();") > vue.indexOf("function imprimer(") && vue.indexOf("teardownQualiopiPrint();") < vue.indexOf("window.print()"),
  "chaque impression commence par nettoyer la précédente");
ok(/const aujourdhui = isoDate\(new Date\(\)\);/.test(vue), "la date du jour est calculée une fois par rendu");
ok(/chargementVivant|actionVivante/.test(vue) && /racine\.isConnected/.test(vue), "une réponse tardive n'écrit pas dans une page quittée (jeton de rendu et page toujours affichée)");
ok(/"Dossier de la formation"/.test(vue) && /"Tableau \(CSV\)"/.test(vue) && /"Dossier du centre"/.test(vue) && /"Sans aucun nom"/.test(vue) && /"Cette formation"/.test(vue) && /"Le centre"/.test(vue),
  "les deux groupes d'actions (R7) et leurs libellés");
ok(!/Fiche résultats|Copier le texte/.test(vue.replace(/\/\/.*$/gm, "")), "pas de bouton factice : les actions de la tâche 6 n'y sont pas encore (seul un commentaire les annonce)");
ok(/"Formation en alternance /.test(vue) && /"Qualité"/.test(vue) && /h2", \{\}, "Qualiopi"/.test(vue), "en-tête et case « Formation en alternance »");
ok(!/localStorage|sessionStorage/.test(vue), "la case « alternance » n'est pas mémorisée");

// --- Feuille de style : rien ne défile de côté, jamais de rouge, cibles de 44 px, impression ---
const hors_commentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/overflow(-x)?\s*:\s*(auto|scroll)/.test(hors_commentaires), "aucun défilement de côté dans la feuille");
ok(!/--c-stop/.test(hors_commentaires), "jamais de rouge : la variable des statuts négatifs n'y est pas");
ok(/\.qualiopi \.btn \{[^}]*min-height: 44px/.test(hors_commentaires) && /\.qualiopi-critere > summary \{[^}]*min-height: 44px/.test(hors_commentaires)
  && /\.qualiopi-select \{[^}]*min-height: 44px/.test(hors_commentaires) && /\.qualiopi-case \{[^}]*min-height: 44px/.test(hors_commentaires), "cibles de 44 px : boutons, critères, sélecteur, cases");
ok(/#qualiopi-print \{ display: none; \}/.test(hors_commentaires), "le document imprimable est caché à l'écran");
ok(/@media print \{\s*body\.qualiopi-printable > \*:not\(#qualiopi-print\) \{ display: none !important; \}/.test(hors_commentaires)
  && /body\.qualiopi-printable #qualiopi-print \{ display: block !important; \}/.test(hors_commentaires), "à l'impression, seul le document est montré");
ok(!/\.qdoc[^{]*\{[^}]*var\(--(bg|text|line|accent)/.test(hors_commentaires.slice(hors_commentaires.indexOf(".qdoc {"))), "les documents papier ont des couleurs fixes, pas celles du thème de l'écran");

// --- Hygiène des fichiers de la tâche ---
for (const fichier of ["js/views/qualiopi.js", "js/qualiopi-page-rules.js", "css/qualiopi.css"]) {
  const texte = lire(fichier);
  ok(!texte.includes(TIRET_CADRATIN), `${fichier} : aucun tiret cadratin`);
  ok(!/\bprof\b/i.test(texte.replace(/\bprofil\w*/gi, "")), `${fichier} : « formateur », jamais « prof »`);
}
for (const fichier of ["tests/qualiopi-page.test.mjs", "tests/qualiopi-page-rules.test.mjs"]) {
  ok(!lire(fichier).includes(TIRET_CADRATIN), `${fichier} : aucun tiret cadratin`);
}
const diff = ["js/main.js", "js/views/centre.js", "index.html"].map((f) => [f, lire(f)]);
diff.forEach(([f, t]) => ok(!t.includes(TIRET_CADRATIN), `${f} : aucun tiret cadratin`));

console.log(`qualiopi-page : ${n} assertions OK`);
