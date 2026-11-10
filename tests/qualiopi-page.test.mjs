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
const conservationVue = lire("js/views/conservation.js");
const config = lire("js/views/config.js");

// --- Jeton de version : celui du reste de l'app, dans l'index et dans chaque import de la page ---
const jeton = index.match(/js\/main\.js\?v=(\w+)/)[1];
eq(index.match(/css\/qualiopi\.css\?v=(\w+)/)?.[1], jeton, "la feuille de style est liée dans index.html avec le jeton des autres");
eq(index.match(/css\/emargement\.css\?v=(\w+)/)[1], jeton, "(témoin) la feuille voisine porte ce jeton");
for (const [nom, source] of [["js/views/qualiopi.js", vue], ["js/qualiopi-page-rules.js", lire("js/qualiopi-page-rules.js")], ["js/qualiopi-resultats.js", lire("js/qualiopi-resultats.js")], ["js/views/centre.js", centre], ["js/main.js", main],
  ["js/views/conservation.js", conservationVue], ["js/views/config.js", config], ["js/confirmer.js", lire("js/confirmer.js")]]) {
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
ok(!demarrage.includes("js/views/conservation.js"), "la section Conservation des données part avec la page, pas avec l'app");
ok(!/^\s*(import|export)\b[^;]*["']\.\/views\/qualiopi\.js/m.test(main), "ni par un import, ni par un export (sous aucune forme)");

// --- Branchement : route, onglet allumé, porte du fondateur, nettoyage de l'impression ---
ok(/import \{ teardownQualiopiPrint \} from "\.\/qualiopi-impression\.js\?v=\w+";/.test(main), "main.js importe le nettoyage de l'impression, dans le petit module chargé avec l'app");
ok(/\n  qualiopi:\s+rendreQualiopi,/.test(main), "la route qualiopi mène au chargeur de la page");
ok(/const ONGLET_POUR_ROUTE = \{[^}]*\bqualiopi: "home"[^}]*\};/.test(main), "l'ancienne barre allume Accueil sur #/qualiopi");
const debutGarde = main.indexOf('else if (route === "qualiopi" && !fondateurHorsApercu()) {');
ok(debutGarde > 0, "une garde propre à la route qualiopi, hors aperçu comme « problemes »");
const garde = main.slice(debutGarde, main.indexOf("memoriserRoute(route);", debutGarde));   // la branche, jusqu'à la suite de navigate()
ok(/replaceState\(null, "", "#\/home"\)/.test(garde) && /route = "home";/.test(garde), "qui renvoie à #/home");
ok(!/toast\(/.test(garde), "sans un mot : aucun message");
ok(/fondateurHorsApercu \} from "\.\/auth-admin\.js/.test(main), "fondateurHorsApercu vient de auth-admin.js");
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
  // Seul l'alias de nav-rules (route « qualiopi » -> entrée « centre ») est permis : il n'ajoute aucune entrée à la barre.
  const texteFichier = lire(fichier).split(String.fromCharCode(10)).filter((l) => !/Qualiopi \(fondateur|\["qualiopi", "centre"\],/.test(l)).join(String.fromCharCode(10));
  ok(!/qualiopi/i.test(texteFichier), `${fichier} ne parle pas de Qualiopi : aucune entrée de barre, aucun module`);
}

// --- Bouton du tableau de bord du centre : le fondateur seul ---
ok(/fondateurHorsApercu\(\) \? el\("a", \{ class: "btn small centre-lien-qualiopi", href: "#\/qualiopi" \}, "Qualiopi"\) : null/.test(centre), "le bouton Qualiopi n'est monté que pour le fondateur");
ok(/export function telecharger\(/.test(centre), "le téléchargement du tableau de bord est partagé avec la page, pas recopié");
ok(/el\("p", \{ class: "qualiopi-intro qualiopi-legende-niveau" \}, PHRASE_NIVEAU\)/.test(vue), "la page affiche la légende du niveau (PHRASE_NIVEAU, écrite une fois dans les documents)");
// La case « Sans aucun nom » (relecture finale, I4) : sa valeur vit dans `etat`, comme l'alternance, et survit au changement de promo.
ok(/const etat = \{[^}]*sansNoms: false/.test(vue), "etat porte la valeur de la case, décochée au départ");
ok(/caseSansNom\.checked = etat\.sansNoms;/.test(vue), "la case refaite à chaque chargement reprend la valeur de etat");
ok(/caseSansNom\.addEventListener\("change", \(\) => \{ etat\.sansNoms = caseSansNom\.checked; \}\);/.test(vue), "et la range dans etat quand elle change");
ok(/dossierCentre\(etat\.sansNoms\)/.test(vue) && !/dossierCentre\(caseSansNom\.checked\)/.test(vue), "le dossier du centre lit etat, jamais la case");
ok(!/Object\.assign\(etat, \{[^}]*sansNoms/.test(vue), "charger() ne réinitialise pas la valeur");
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
const appelsDossiers = vue.match(/imprimerQualiopi\(documentImprimable\(modele\), titreImpression\(/g) || [];
const appelsFiche = vue.match(/imprimerQualiopi\(fichesImprimables\(fiches\), titreImpression\(/g) || [];
ok(appelsImpression.length === 3 && appelsDossiers.length === 2 && appelsFiche.length === 1,
  "les deux dossiers (formation, centre) et la fiche des résultats s'impriment en construisant le document avant de le monter : un défaut de mise en page ne laisse rien dans la page, et le montage est le même pour tous");
ok(/const aujourdhui = isoDate\(new Date\(\)\);/.test(vue), "la date du jour est calculée une fois par rendu");
ok(/chargementVivant|actionVivante/.test(vue) && /racine\.isConnected/.test(vue), "une réponse tardive n'écrit pas dans une page quittée (jeton de rendu et page toujours affichée)");
ok(/"Dossier de la formation"/.test(vue) && /"Tableau \(CSV\)"/.test(vue) && /"Dossier du centre"/.test(vue) && /"Sans aucun nom"/.test(vue) && /"Cette formation"/.test(vue) && /"Le centre"/.test(vue),
  "les deux groupes d'actions (R7) et leurs libellés");

// --- Fiche « résultats » à publier (spec § 6.6, R7) : « Fiche résultats » et « Copier le texte » dans chacun des deux groupes ---
const codeVue = vue.replace(/\/\/.*$/gm, "");
const actions = codeVue.slice(codeVue.indexOf("function construireActions()"), codeVue.indexOf("async function charger("));
const debutFormation = actions.indexOf('"data-groupe": "formation"');
const debutCentre = actions.indexOf('"data-groupe": "centre"');
ok(debutFormation > 0 && debutCentre > debutFormation, "les deux groupes sont lisibles dans construireActions");
ok((actions.match(/"Fiche résultats"/g) || []).length === 2 && (actions.match(/"Copier le texte"/g) || []).length === 2, "deux boutons « Fiche résultats » et deux « Copier le texte » : un de chaque dans chaque groupe");
for (const [nom, groupe, portee, suffixe] of [["Cette formation", actions.slice(debutFormation, debutCentre), "formation", "Formation"], ["Le centre", actions.slice(debutCentre), "centre", "Centre"]]) {
  ok(actions.includes(`const boutonFiche${suffixe} = bouton("Fiche résultats", () => sortirFiches("${portee}", "imprimer"));`)
    && actions.includes(`const boutonCopie${suffixe} = bouton("Copier le texte", () => sortirFiches("${portee}", "copier"));`),
  `${nom} : « Fiche résultats » imprime et « Copier le texte » copie la fiche ${portee === "formation" ? "de la promo choisie" : "des promos du centre"}`);
  ok(new RegExp(`boutonFiche${suffixe}, boutonCopie${suffixe}\\)`).test(groupe), `${nom} : les deux boutons sont dans ce groupe, sous le titre « Résultats à publier »`);
  ok(groupe.includes('"Résultats à publier"') && /role: "group"/.test(groupe) && /"aria-labelledby"/.test(groupe), `${nom} : le groupe est annoncé par son titre (deux boutons de même nom dans deux groupes)`);
}
ok(/boutons = \[boutonFormation, boutonTableau, boutonCentre, boutonFicheFormation, boutonCopieFormation, boutonFicheCentre, boutonCopieCentre\];/.test(actions),
  "les quatre nouveaux boutons attendent comme les autres pendant une lecture ou une action");
ok(/import \{[^}]*\bficheResultats\b[^}]*\}/.test(vue) && /import \{[^}]*\bfichesResultatsTexte\b[^}]*\}/.test(vue) && /import \{[^}]*\bcopierTexte\b[^}]*\}/.test(vue)
  && /import \{[^}]*\btableauFiche\b[^}]*\}/.test(vue) && /from "\.\.\/qualiopi-resultats\.js\?v=\w+";/.test(vue), "la page prend la fiche, son texte, son tableau et la copie du module pur");
ok(!/Résultats provisoires : la formation|"non mesuré"|"non saisi"|"non mesurée"/.test(codeVue), "la page n'écrit pas les textes publics (avertissement, valeurs absentes) : ils viennent du module");
ok(!/navigator\.clipboard|ClipboardItem/.test(codeVue), "la page ne parle jamais au presse-papiers : copierTexte le fait");
const sortir = codeVue.slice(codeVue.indexOf("async function sortirFiches("), codeVue.indexOf("function construireActions()"));
ok(sortir.length > 200, "sortirFiches est lisible");
ok(/ficheResultats\(\{ promo, ind: etat\.ind, aujourdhui, satisfaction: etat\.donnees\.satisfaction \}\)/.test(sortir), "Cette formation : la fiche de la promo choisie, avec ses indicateurs déjà calculés");
ok(/if \(!fiches\.length\) \{[^}]*ecrireStatut\(AUCUNE_FORMATION\);\s*return;/.test(sortir), "Le centre sans promo dans la période : un message, ni page blanche à imprimer ni phrase vide à copier");
ok(/promosEtPeriodeDuCentre\(\)/.test(sortir) && /lirePromosDuCentre\(/.test(sortir), "Le centre : les promos retenues pour le dossier du centre (même lieu, même période), lues une à une");
ok(!/reduce\(|\+=|Math\.(sum|max|min)/.test(sortir), "aucun total, aucune somme : une fiche par promo");
ok(/if \(occupe \|\| !etat\.donnees\) return;/.test(sortir) && /bloquerBoutons\(true\)/.test(sortir) && /finally \{\s*if \(actionVivante\(moi\)\) bloquerBoutons\(false\);/.test(sortir),
  "une action à la fois, boutons libérés à la fin si la page est encore celle de l'action");
// La copie du centre est demandée dans le geste du clic : avant le moindre await, avec la promesse du texte qui se résout après les lectures.
ok(/copierTexte\(lesFiches\.then\(texteDesFiches\)\)/.test(sortir), "la copie reçoit la promesse du texte des fiches, qui se résout après les lectures");
const avantLaCopie = sortir.slice(0, sortir.indexOf("copierTexte("));
ok(avantLaCopie.length > 300 && !/\bawait\b/.test(avantLaCopie), "la copie est demandée avant le moindre await de sortirFiches : dans le geste du clic, pour « Cette formation » comme pour « Le centre »");
ok((codeVue.match(/copierTexte\(/g) || []).length === 1, "un seul appel de copierTexte : le même chemin pour les deux groupes");
ok(/const texteDesFiches = \(fiches\) => \(fiches\?\.length \? fichesResultatsTexte\(fiches\) : ""\);/.test(codeVue), "le texte copié est celui des fiches, ou rien : jamais la phrase du centre vide, ni un texte vide");
ok(/const resultat = await copie;\s*if \(!actionVivante\(moi\)\) return;/.test(sortir), "une copie qui répond après un changement de promo n'écrit rien dans la page");
ok(/const fiches = await lesFiches;\s*if \(!fiches\) return;/.test(sortir), "une lecture en échec ou caduque arrête la sortie sans écraser son message (ni refus de copie, ni document)");
ok(/noteProvisoire\(fiches\)/.test(sortir) && /scrollIntoView/.test(sortir), "la copie dit les formations provisoires, et un message d'échec est ramené à l'écran");
ok(/ecrireStatut\(resultat\.message, true\);\s*statut\?\.scrollIntoView/.test(sortir), "un refus ou une absence de presse-papiers est écrit comme une erreur (ligne d'état d'alerte), puis ramené à l'écran");
ok(/lirePromosDuCentre\(moi, retenues, "le dossier du centre n'est pas préparé"/.test(codeVue) && /lirePromosDuCentre\(moi, promosEtPeriodeDuCentre\(\)\.retenues, "les résultats du centre ne sont pas préparés"/.test(codeVue),
  "le dossier du centre et la fiche lisent les promos par la même fonction");
ok((codeVue.match(/lire\(p\.id\)/g) || []).length === 1, "une seule boucle de lecture des promos du centre (celle de lirePromosDuCentre), par identifiant");
ok(/function ficheImprimable\(fiche\)/.test(codeVue) && /tableauImprimable\(tableauFiche\(fiche\)\)/.test(codeVue), "la fiche se met en page avec le tableau des dossiers");
const miseEnPage = codeVue.slice(codeVue.indexOf("function ficheImprimable(fiche)"), codeVue.indexOf("function fichesImprimables("));
ok(miseEnPage.indexOf("qres-avertissement") > 0 && miseEnPage.indexOf("qres-avertissement") < miseEnPage.indexOf('el("h1"'), "l'avertissement d'une promo en cours est lu avant le titre de la fiche");
ok(/\["resultats-formation", promo\.nom\] : \["resultats-centre", promo\.lieu_nom\]/.test(sortir), "le PDF de la formation porte le nom de la promo, celui du centre le nom du lieu");
ok(/if \(!promosLues\) return;/.test(codeVue) && /if \(!fiches\) return;/.test(sortir),
  "une promo du centre qui ne se lit pas arrête le dossier comme la fiche : aucun document auquel manquerait une promo sans le dire");
ok(/ecrireStatut\(""\);\s*imprimerQualiopi\(fichesImprimables\(fiches\)/.test(sortir), "le message d'état est effacé avant d'imprimer la fiche, comme pour les dossiers");
ok(/toast\("Texte copié", "success"\)/.test(sortir), "la copie réussie le dit aussi par un message bref (toast), comme le tableau CSV");
ok(/"Formation en alternance /.test(vue) && /"Qualité"/.test(vue) && /h2", \{\}, "Qualiopi"/.test(vue), "en-tête et case « Formation en alternance »");
ok(!/localStorage|sessionStorage/.test(vue), "la case « alternance » n'est pas mémorisée");

// --- Feuille de style : rien ne défile de côté, jamais de rouge, cibles de 44 px, impression ---
const hors_commentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/overflow(-x)?\s*:\s*(auto|scroll)/.test(hors_commentaires), "aucun défilement de côté dans la feuille");
ok(!/--c-stop/.test(hors_commentaires), "jamais de rouge : la variable des statuts négatifs n'y est pas");
ok(/\.qualiopi \.btn \{[^}]*min-height: 44px/.test(hors_commentaires) && /\.qualiopi-critere > summary \{[^}]*min-height: 44px/.test(hors_commentaires)
  && /\.qualiopi-select \{[^}]*min-height: 44px/.test(hors_commentaires) && /\.qualiopi-case \{[^}]*min-height: 44px/.test(hors_commentaires), "cibles de 44 px : boutons, critères, sélecteur, cases");
ok(/html:has\(body\.qualiopi-printable\) \{[^}]*background: #fff/.test(hors_commentaires), "impression : le fond de la page de l'app est blanc (le bas d'une fiche courte ne se teinte pas quand les arrière-plans sont imprimés)");
ok(/\.qdoc-table th, \.qdoc-table td \{[^}]*overflow-wrap: break-word/.test(hors_commentaires) && !/\.qdoc-table th, \.qdoc-table td \{[^}]*overflow-wrap: anywhere/.test(hors_commentaires), "tableaux imprimés : un mot ne se coupe qu'en dernier recours (une date de semaine reste entière)");
ok(/\.qualiopi-erreur \.btn \{[^}]*min-height: 44px/.test(hors_commentaires), "cible de 44 px aussi pour le bouton de la boîte d'erreur de chargement, qui est hors de .qualiopi");
ok(/#qualiopi-print \{ display: none; \}/.test(hors_commentaires), "le document imprimable est caché à l'écran");
ok(/@media print \{\s*body\.qualiopi-printable > \*:not\(#qualiopi-print\) \{ display: none !important; \}/.test(hors_commentaires)
  && /body\.qualiopi-printable #qualiopi-print \{ display: block !important; \}/.test(hors_commentaires), "à l'impression, seul le document est montré");
ok(!/\.qdoc[^{]*\{[^}]*var\(--(bg|text|line|accent)/.test(hors_commentaires.slice(hors_commentaires.indexOf(".qdoc {"))), "les documents papier ont des couleurs fixes, pas celles du thème de l'écran");
ok(/\.qres-fiche \{[^}]*break-after: page/.test(hors_commentaires) && /\.qres-fiche:last-child \{[^}]*break-after: auto/.test(hors_commentaires),
  "chaque fiche de résultats commence sa page, et la dernière ne laisse pas de page vide");
ok(/\.qres-avertissement \{[^}]*font-weight: 600/.test(hors_commentaires) && !/\.qres-[^{]*\{[^}]*(red|#[dD][0-9a-fA-F]{5}|#[cC][0-9a-fA-F]{5})/.test(hors_commentaires), "l'avertissement est en gras, sans rouge");
ok(/\.qualiopi-rangee-titre \{/.test(hors_commentaires), "le titre de la rangée « Résultats à publier » est stylé");

// --- Conservation des données (lot Q5, tâche 7) : sous-onglet de la page, fondateur seul ---
ok(/import \{ creerConservation \} from "\.\/conservation\.js\?v=\w+";/.test(vue), "la page importe la section Conservation des données");
ok(/\{ key: "conservation", label: "Conservation des données", render: \(panneau\) => panneau\.appendChild\(conservation\.noeud\) \}/.test(vue),
  "troisième sous-onglet « Conservation des données », après l'inventaire et le registre");
const ordreOnglets = ["key: \"inventaire\"", "key: \"registre\"", "key: \"conservation\""].map((k) => vue.indexOf(k));
ok(ordreOnglets.every((i, n) => i > 0 && (n === 0 || i > ordreOnglets[n - 1])), "dans cet ordre");
ok(/racine\.appendChild\(rappelRegistre\);[\s\S]*racine\.appendChild\(conservation\.rappel\);[\s\S]*racine\.appendChild\(sousOnglets\);/.test(vue),
  "le rappel de la conservation est en tête de page, sous celui du registre, au-dessus des sous-onglets");
ok(/conservation\.lireEtat\(\);/.test(vue), "les échéances sont lues à chaque rendu de la page, quel que soit l'onglet (le rappel en dépend)");
ok(/ouvrirRegistre: \(\) => sousOnglets\.activer\("registre"\)/.test(vue) && /ouvrirConservation: \(\) => sousOnglets\.activer\("conservation"\)/.test(vue),
  "la carte du registre renvoie au sous-onglet « Registre qualité », le rappel à « Conservation des données »");
ok(/conservation\.majPromo\(promo, lire\(promo\.id\)\.then\(\(d\) => d\.stagiaires\)\)/.test(vue), "les fiches de la promo choisie viennent de la lecture du dossier, par identifiant");
ok(/lectures\.delete\(promoId\)/.test(vue) && /charger\(etat\.promo\)/.test(vue.slice(vue.indexOf("apresEffacement"))), "après un effacement, la promo touchée est relue");

const codeCons = conservationVue.replace(/\/\/.*$/gm, "");
for (const [type, fonction, args] of [["etape1", "effacerPromoEtape1", "c\\.id"], ["etape2", "effacerPromoEtape2", "c\\.id"],
  ["cloture_formateurs", "cloreAnneeFormateurs", "c\\.lieu_id, c\\.annee"], ["commentaires_formateurs", "effacerCommentairesFormateurs", "c\\.lieu_id, c\\.annee"],
  ["figeage_formateurs", "figerQuestionnaireFormateurs", "c\\.lieu_id, c\\.annee"]]) {
  ok(new RegExp(`${type}: \\(c\\) => ${fonction}\\(${args}\\)`).test(codeCons), `le bouton « ${type} » appelle ${fonction}`);
}
ok(/await effacerSurDemande\(f\.id\)/.test(codeCons) && /confirmer\(confirmationDemande\(f\)\)/.test(codeCons), "« Effacer à la demande » confirme (prénom), puis efface la fiche");
ok(/const question = confirmationEcheance\(e\);/.test(codeCons) && /if \(!\(await confirmer\(question\)\)\) return;/.test(codeCons), "chaque échéance confirme avant d'agir, avec la liste exacte");
ok(!/(^|[^\w.])(confirm|prompt|alert)\s*\(|window\.(confirm|prompt|alert)\s*\(/.test(codeCons) && !/(^|[^\w.])(confirm|prompt|alert)\s*\(/.test(vue.replace(/\/\/.*$/gm, "")),
  "aucune boîte du navigateur : la fenêtre de l'app (js/confirmer.js)");
ok(!/effacerRegistreQualite/.test(codeCons) && /"Voir le registre qualité"/.test(codeCons) && /onClick: \(\) => ouvrirRegistre\(\)/.test(codeCons),
  "le registre garde son seul bouton : la section renvoie à son sous-onglet");
ok(conservationVue.includes('export const CONSERVATION_ABSENTE = "La conservation sera disponible après la mise à jour de la base.";')
  && /etat === null \? \{ absent: true \}/.test(codeCons), "migration pas appliquée : la phrase convenue, sans erreur");
ok(/"Effacer à la demande"/.test(codeCons) && /sansNom \? null : el\("button"/.test(codeCons), "« Effacer à la demande » sur chaque fiche qui a encore un nom");
ok(!/<table|el\("table"/.test(codeCons), "une liste de cartes, jamais un tableau");
ok(/lireEffacementsSurDemande\(\[promo\.id\]\)/.test(codeCons) && /statutFiche\(/.test(codeCons), "la fiche effacée à la demande le dit (journal, jamais une colonne de la fiche)");

// --- Paramètres (Réglages) : la conservation n'y est plus qu'une phrase, et un lien pour le fondateur seul ---
const donnees = config.slice(config.indexOf("async function renderDonneesSection("), config.indexOf("// ====== SECTION Apparence"));
ok(config.includes('export const PHRASE_CONSERVATION = "La conservation des fiches est gérée par le fondateur, sur la page Qualiopi.";')
  && /el\("p", \{ class: "muted donnees-texte" \}, PHRASE_CONSERVATION\)/.test(donnees), "la phrase convenue, pour toute l'équipe");
ok(/if \(fondateurHorsApercu\(\)\) \{\s*blocConservation\.appendChild\(el\("a", \{ class: "btn cons-lien", href: "#\/qualiopi"/.test(donnees),
  "le lien vers la page Qualiopi : fondateur hors aperçu seulement (ni formateur, ni direction, ni aperçu)");
ok((config.match(/#\/qualiopi/g) || []).length === 1, "un seul lien vers la page dans Réglages");
ok(/el\("h3", \{\}, "Données personnelles"\)/.test(donnees) && /if \(!isEquipe\(\)\) return null;/.test(donnees), "la section « Données personnelles » reste, pour l'équipe (outils/verifier_navigation.py)");
ok(/const avecBenevoles = isAdmin\(\);/.test(donnees) && /if \(avecBenevoles\) section\.appendChild\(blocBnv\);/.test(donnees), "la purge des élèves bénévoles reste, pour qui y a droit");
ok(!/(^|[^\w.])(confirm|prompt)\s*\(/.test(donnees.replace(/\/\/.*$/gm, "")) && /await confirmer\(\{/.test(donnees), "la purge confirme dans la fenêtre de l'app");
ok(!/anonymiser|etatAnonymisationPromo|etatFinDePromo|Anonymiser la promo|"Effacer les données"|prompt\(/i.test(config.replace(/\/\/.*$/gm, "")), "plus d'anonymisation ni d'effacement dans Réglages");
ok(/s\.actif === false && !s\.anonymise_le && !s\.efface_le/.test(config) && /"Réactiver"/.test(config), "Abandons : « Réactiver » seul, sans les fiches effacées");
const db = lire("js/db.js");
ok(!/export async function (anonymiserStagiaire|anonymiserPromo|etatAnonymisationPromo)\b/.test(db), "les exportations de compatibilité de js/db.js sont retirées");

// --- Feuille de style de la conservation : cibles de 44 px, jetons de titre ---
for (const [selecteur, nom] of [[".cons-details > summary", "« Ce qui part, ce qui reste »"], [".cons-fiche", "carte d'une fiche"], [".confirmer-champ", "champ de saisie"],
  [".modal.confirmer-detaille .btn", "boutons de la fenêtre"], [".cons-lien", "lien de Réglages"]]) {
  ok(new RegExp(selecteur.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&") + " \\{[^}]*min-height: 44px").test(hors_commentaires), `cible de 44 px : ${nom}`);
}
ok(/\.cons-sous-titre \{[^}]*font-weight: var\(--poids-titre-moyen\)/.test(hors_commentaires) && /\.cons-carte-titre \{[^}]*font-weight: var\(--poids-titre-moyen\)/.test(hors_commentaires),
  "titres de la section : épaisseur par jeton");
ok(/\.modal\.confirmer-detaille \{[^}]*overflow-x: hidden;[^}]*overflow-y: auto/.test(hors_commentaires), "la fenêtre détaillée défile de haut en bas, jamais de côté");

// --- Hygiène des fichiers de la tâche ---
for (const fichier of ["js/views/qualiopi.js", "js/qualiopi-page-rules.js", "js/qualiopi-impression.js", "js/qualiopi-resultats.js", "css/qualiopi.css",
  "js/views/conservation.js", "js/effacement-rules.js", "js/confirmer.js"]) {
  const texte = lire(fichier);
  ok(!texte.includes(TIRET_CADRATIN), `${fichier} : aucun tiret cadratin`);
  ok(!/\bprof\b/i.test(texte.replace(/\bprofil\w*/gi, "")), `${fichier} : « formateur », jamais « prof »`);
}
for (const fichier of ["tests/qualiopi-page.test.mjs", "tests/qualiopi-page-rules.test.mjs", "tests/qualiopi-impression.test.mjs", "tests/qualiopi-resultats.test.mjs"]) {
  ok(!lire(fichier).includes(TIRET_CADRATIN), `${fichier} : aucun tiret cadratin`);
}
const diff = ["js/main.js", "js/views/centre.js", "index.html", "js/views/config.js", "js/nouveautes-data.js", "js/db.js", "tests/effacement-rules.test.mjs", "tests/confirmer.test.mjs"].map((f) => [f, lire(f)]);
diff.forEach(([f, t]) => ok(!t.includes(TIRET_CADRATIN), `${f} : aucun tiret cadratin`));

console.log(`qualiopi-page : ${n} assertions OK`);
