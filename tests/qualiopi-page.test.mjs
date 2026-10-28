// Page Qualiopi (spec 2026-10-28, § 6.3) : ce que le code source de la page, de son branchement et de sa feuille de style
// doit garantir et qu'aucun test de règle ne voit : chargement à la demande (rien de la page ni de ses modules de calcul dans
// le démarrage de l'app, boîte d'erreur si le module ne se charge pas), porte du fondateur, aucune entrée de barre, nettoyage de
// l'impression, jeton de version, lecture par identifiant, contrat de la feuille de style (rien ne défile de côté, jamais de
// rouge, cibles de 44 px). Le rendu lui-même se contrôle au banc. Lancer depuis la racine du dépôt : node tests/qualiopi-page.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let n = 0;
const ok = (v, msg) => { assert.ok(v, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const RACINE = fileURLToPath(new URL("../", import.meta.url));
const lire = (chemin) => readFileSync(resolve(RACINE, chemin), "utf8").replace(/\r\n/g, "\n");
const TIRET_CADRATIN = String.fromCharCode(0x2014);

const main = lire("js/main.js");
const index = lire("index.html");
const vue = lire("js/views/qualiopi.js");
const impression = lire("js/qualiopi-impression.js");
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
const importsALaDemande = [...main.matchAll(/\bimport\("(\.\.?\/[^"]+)"\)/g)].map((m) => m[1]);
eq(importsALaDemande.filter((a) => a.includes("qualiopi")), [`./views/qualiopi.js?v=${jeton}`], "main.js : un seul import à la demande de la page, littéral et au jeton de l'app (le script de version le réécrit)");

// --- Chargement à la demande : rien de la page ni de ses modules de calcul dans le démarrage de l'app ---
const importsStatiques = (fichier) => {
  const source = readFileSync(fichier, "utf8");
  const motifs = [/^\s*(?:import|export)\s[^;]*?\sfrom\s*["']([^"']+)["']/gms, /^\s*import\s*["']([^"']+)["']/gm];
  return motifs.flatMap((re) => [...source.matchAll(re)].map((m) => m[1])).filter((spec) => spec.startsWith("."));
};
const atteints = new Set();
for (const pile = [resolve(RACINE, "js/main.js")]; pile.length;) {
  const fichier = pile.pop();
  if (atteints.has(fichier)) continue;
  atteints.add(fichier);
  for (const spec of importsStatiques(fichier)) pile.push(resolve(dirname(fichier), spec.split("?")[0]));
}
const demarrage = [...atteints].map((f) => relative(RACINE, f).replace(/\\/g, "/"));
for (const attendu of ["js/main.js", "js/db.js", "js/views/centre.js", "js/qualiopi-impression.js"]) {
  ok(demarrage.includes(attendu), `le parcours n'est pas aveugle : ${attendu} part avec l'app`);
}
eq(demarrage.filter((f) => /qualiopi/.test(f)), ["js/qualiopi-impression.js"],
  "du démarrage, seul le petit module d'impression de Qualiopi est atteint : ni la page, ni le référentiel, l'inventaire, les modèles, les règles de la page");
ok(!importsStatiques(resolve(RACINE, "js/main.js")).some((spec) => /views\/qualiopi\.js/.test(spec)), "main.js n'importe pas la page statiquement");
ok(!/^\s*(import|export)\b[^;]*["']\.\/views\/qualiopi\.js/m.test(main), "ni par un import, ni par un export (sous aucune forme)");

// --- Branchement : route, onglet allumé, porte du fondateur, nettoyage de l'impression ---
ok(/import \{ teardownQualiopiPrint \} from "\.\/qualiopi-impression\.js\?v=\w+";/.test(main), "main.js importe le nettoyage de l'impression, dans le petit module chargé avec l'app");
ok(/\n  qualiopi:\s+rendreQualiopi,/.test(main), "la route qualiopi mène au chargeur de la page");
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

// --- Chargement à la demande : le comportement de la route, joué sur le code même de main.js avec des doublures ---
// Le bloc de main.js (boîte d'erreur et chargeur) est évalué avec un faux import() qu'on pilote, un faux « Chargement », un faux
// el() et un faux rechargement. `lastRoute`, que le routeur pose avant chaque rendu, y est une variable du bloc, que le test change.
const IMPORT_PAGE = /import\("\.\/views\/qualiopi\.js\?v=\w+"\)/;
const debutBloc = main.indexOf("function boiteErreurQualiopi() {");
const bloc = main.slice(debutBloc, main.indexOf("\nconst routes = {"));
ok(debutBloc > 0 && bloc.includes("async function rendreQualiopi(view) {") && IMPORT_PAGE.test(bloc), "le chargeur de la page et son import à la demande sont lisibles dans main.js");
function jouer({ routeCourante = "qualiopi" } = {}) {
  const journal = [];
  const el = (tag, attrs = {}, ...enfants) => ({ tag, attrs, enfants });
  const vue_ = { enfants: null, replaceChildren(...e) { this.enfants = e; journal.push("vue remplacée"); } };
  const import_ = { suite: null };   // le test règle `suite` : une fonction qui rend la promesse de l'import
  const usine = new Function("import_", "afficherChargement", "el", "rechargerApresEnregistrements",
    `let lastRoute = ${JSON.stringify(routeCourante)};\n${bloc.replace(IMPORT_PAGE, "import_.suite()")}\nreturn { rendreQualiopi, allerA(route) { lastRoute = route; } };`);
  const api = usine(import_, () => journal.push("chargement"), el, () => journal.push("rechargement"));
  return { journal, vue_, import_, api };
}
const sansBruit = async (f) => { const avant = console.error; const vus = []; console.error = (...a) => vus.push(a); try { return { resultat: await f(), erreurs: vus }; } finally { console.error = avant; } };
const textes = (noeud) => (typeof noeud === "string" ? [noeud] : (noeud.enfants || []).flatMap(textes));
{
  // 1. Le module se charge, la page est toujours la courante : « Chargement » d'abord, puis le rendu de la page, sur la vue.
  const t = jouer();
  const rendus = [];
  t.import_.suite = async () => ({ renderQualiopi: async (v) => { rendus.push(v); t.journal.push("rendu"); } });
  await t.api.rendreQualiopi(t.vue_);
  eq(t.journal, ["chargement", "rendu"], "module chargé : « Chargement », puis le rendu de la page, rien d'autre");
  ok(rendus.length === 1 && rendus[0] === t.vue_, "la page est rendue dans la vue du routeur");
}
{
  // 2. Le module ne se charge pas : une boîte d'erreur lisible dans la vue, pas une page blanche ; son bouton recharge la page.
  const t = jouer();
  t.import_.suite = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: http://exemple/js/views/qualiopi.js"));
  const { erreurs } = await sansBruit(() => t.api.rendreQualiopi(t.vue_));
  eq(t.journal, ["chargement", "vue remplacée"], "module absent : « Chargement », puis la boîte d'erreur remplace la vue");
  ok(erreurs.length === 1, "l'erreur est dite en console, pour qui cherche la cause");
  const [boite] = t.vue_.enfants;
  ok(t.vue_.enfants.length === 1 && boite.tag === "div" && /\bqualiopi-erreur\b/.test(boite.attrs.class) && boite.attrs.role === "alert", "une seule boîte, celle des erreurs de la page, annoncée aux lecteurs d'écran");
  const [message, bouton] = boite.enfants;
  ok(message.tag === "p" && /n'a pas pu se charger/.test(textes(message).join("")), "elle dit que la page n'a pas pu se charger");
  ok(/recharge la page/.test(textes(message).join("")) && !/undefined|null|NaN|Failed to fetch/.test(textes(boite).join(" ")), "en tutoyant, sans détail technique ni valeur manquante");
  ok(bouton.tag === "button" && bouton.attrs.type === "button" && textes(bouton).join("") === "Recharger la page", "avec un bouton « Recharger la page », pas « Réessayer » (un import échoué le reste jusqu'au rechargement)");
  bouton.attrs.onClick();
  eq(t.journal, ["chargement", "vue remplacée", "rechargement"], "le bouton recharge la page (rechargement sûr de l'app)");
}
{
  // 3. Une page quittée pendant le chargement du module n'écrit rien par-dessus celle qui est affichée, ni en cas d'échec ni de succès.
  for (const issue of ["échec", "succès"]) {
    const t = jouer();
    let finir;
    t.import_.suite = () => new Promise((resolve, reject) => { finir = issue === "échec" ? () => reject(new Error("réseau")) : () => resolve({ renderQualiopi: async () => t.journal.push("rendu") }); });
    const attente = t.api.rendreQualiopi(t.vue_);
    eq(t.journal, ["chargement"], `${issue} : « Chargement » est posé tout de suite, avant la fin du chargement du module`);
    t.api.allerA("home");
    finir();
    await sansBruit(() => attente);
    eq(t.journal, ["chargement"], `${issue} : page quittée pendant le chargement : rien n'est écrit (ni boîte d'erreur ni page)`);
  }
}
{
  // 4. Une erreur du rendu de la page n'est pas avalée : elle remonte au routeur, dont la boîte d'erreur générale la montre.
  const t = jouer();
  t.import_.suite = async () => ({ renderQualiopi: async () => { throw new Error("rendu cassé"); } });
  await assert.rejects(t.api.rendreQualiopi(t.vue_), /rendu cassé/);
  n++;
  eq(t.journal, ["chargement"], "le chargeur n'ajoute ni boîte d'erreur ni message à une erreur de rendu : le routeur prend la main");
}

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
// L'impression est montée et nettoyée par js/qualiopi-impression.js (chargé avec l'app) ; la page ne fait que mettre les modèles en page.
const codeImpression = impression.replace(/\/\/.*$/gm, "");
ok(!/^\s*import\b/m.test(codeImpression) && !/\bimport\s*\(/.test(codeImpression), "le module d'impression n'importe rien, ni statiquement ni à la demande : il part avec l'app et rien d'autre ne peut l'en empêcher");
ok(/"@page \{ size: A4 portrait; margin: 12mm; \}"/.test(impression), "le format de page est A4 portrait, marges de 12 mm");
ok(impression.includes('const ID_IMPRESSION = "qualiopi-print"') && impression.includes('const CLASSE_IMPRESSION = "qualiopi-printable"'), "conteneur #qualiopi-print et classe qualiopi-printable sur <body>");
ok(/window\.addEventListener\("afterprint", ecouteurFin\)/.test(impression) && /window\.removeEventListener\("afterprint", ecouteurFin\)/.test(impression), "retrait à afterprint, écouteur retiré avec l'impression");
const nettoyage = impression.slice(impression.indexOf("export function teardownQualiopiPrint()"), impression.indexOf("export function imprimerQualiopi("));
ok(/\.remove\(\)/.test(nettoyage) && /classList\.remove\(CLASSE_IMPRESSION\)/.test(nettoyage) && /document\.title = titreAvant/.test(nettoyage),
  "teardownQualiopiPrint retire conteneur et format, la classe, et rend le titre de la page");
const impressionDuModule = impression.slice(impression.indexOf("export function imprimerQualiopi("));
const [prete, nettoie, imprime] = ["conteneur.appendChild(contenu)", "teardownQualiopiPrint();", "window.print()"].map((t) => impressionDuModule.indexOf(t));
ok(prete > 0 && prete < nettoie && nettoie < imprime, "le conteneur est prêt avant que la page ne soit touchée, puis chaque impression nettoie la précédente, puis imprime");
ok(/import \{ imprimerQualiopi \} from "\.\.\/qualiopi-impression\.js\?v=\w+";/.test(vue), "la page imprime par ce module");
ok(!/window\.print|afterprint|@page|titreAvant|teardownQualiopiPrint/.test(vue.replace(/\/\/.*$/gm, "")), "et ne porte plus la mécanique d'impression (seulement la mise en page des modèles)");
const appelsImpression = vue.match(/imprimerQualiopi\(/g) || [];
const appelsBienFormes = vue.match(/imprimerQualiopi\(documentImprimable\(modele\), titreImpression\(/g) || [];
ok(appelsImpression.length === 2 && appelsBienFormes.length === 2, "les deux dossiers (formation, centre) s'impriment en construisant le document avant de le monter : un défaut de mise en page ne laisse rien dans la page");
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
ok(/\.qualiopi-erreur \.btn \{[^}]*min-height: 44px/.test(hors_commentaires), "cible de 44 px aussi pour le bouton de la boîte d'erreur de chargement, qui est hors de .qualiopi");
ok(/#qualiopi-print \{ display: none; \}/.test(hors_commentaires), "le document imprimable est caché à l'écran");
ok(/@media print \{\s*body\.qualiopi-printable > \*:not\(#qualiopi-print\) \{ display: none !important; \}/.test(hors_commentaires)
  && /body\.qualiopi-printable #qualiopi-print \{ display: block !important; \}/.test(hors_commentaires), "à l'impression, seul le document est montré");
ok(!/\.qdoc[^{]*\{[^}]*var\(--(bg|text|line|accent)/.test(hors_commentaires.slice(hors_commentaires.indexOf(".qdoc {"))), "les documents papier ont des couleurs fixes, pas celles du thème de l'écran");

// --- Hygiène des fichiers de la tâche ---
for (const fichier of ["js/views/qualiopi.js", "js/qualiopi-page-rules.js", "js/qualiopi-impression.js", "css/qualiopi.css"]) {
  const texte = lire(fichier);
  ok(!texte.includes(TIRET_CADRATIN), `${fichier} : aucun tiret cadratin`);
  ok(!/\bprof\b/i.test(texte.replace(/\bprofil\w*/gi, "")), `${fichier} : « formateur », jamais « prof »`);
}
for (const fichier of ["tests/qualiopi-page.test.mjs", "tests/qualiopi-page-rules.test.mjs", "tests/qualiopi-impression.test.mjs"]) {
  ok(!lire(fichier).includes(TIRET_CADRATIN), `${fichier} : aucun tiret cadratin`);
}
const diff = ["js/main.js", "js/views/centre.js", "index.html"].map((f) => [f, lire(f)]);
diff.forEach(([f, t]) => ok(!t.includes(TIRET_CADRATIN), `${f} : aucun tiret cadratin`));

console.log(`qualiopi-page : ${n} assertions OK`);
