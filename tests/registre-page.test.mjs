// Registre qualité (plan Q4, tâche 4) : ce que le code de la page Qualiopi, du panneau « Registre qualité », de la fenêtre de
// saisie, de js/db.js et de la feuille de style doit garantir et qu'aucun test de règle ne voit. Les règles sont dans
// tests/registre-rules.test.mjs ; la mécanique de avantFermeture dans tests/nav-fenetre.test.mjs ; le rendu se contrôle au
// banc. Lancer : node --test tests/registre-page.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lire = (chemin) => readFileSync(new URL("../" + chemin, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const page = sansCommentaires(lire("js/views/qualiopi.js"));
const panneau = sansCommentaires(lire("js/views/registre-qualite.js"));
const fenetre = sansCommentaires(lire("js/registre-fenetre.js"));
const nav = sansCommentaires(lire("js/nav-fenetre.js"));
const db = lire("js/db.js");
const css = sansCommentaires(lire("css/qualiopi.css"));
const jeton = lire("index.html").match(/js\/main\.js\?v=(\w+)/)[1];

test("imports au jeton de l'app", () => {
  for (const [nom, code] of [["page", page], ["panneau", panneau], ["fenêtre", fenetre]]) {
    const imports = [...code.matchAll(/from "(\.\.?\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(imports.length > 0 && imports.every((a) => a.endsWith(`.js?v=${jeton}`)), nom);
  }
  assert.match(page, /import \{ renderRegistreQualite \} from "\.\/registre-qualite\.js\?v=\w+";/);
  assert.match(panneau, /import \{ ouvrirFenetreRegistre, lieuxDesPromos \} from "\.\.\/registre-fenetre\.js\?v=\w+";/);
});

test("page : deux sous-onglets, l'inventaire remet le même nœud corps sans relancer charger()", () => {
  assert.match(page, /renderSubTabs\(\[\s*\{ key: "inventaire", label: "Inventaire et documents", render: \(panneau\) => panneau\.appendChild\(corps\) \},\s*\{ key: "registre", label: "Registre qualité", render:/);
  assert.match(page, /\], \{ storageKey: "qualiopi\.subtab" \}\);/);
  assert.equal((page.match(/const corps = el\(/g) || []).length, 1, "corps est créé une fois");
  assert.ok(!/racine\.appendChild\(corps\)/.test(page), "corps ne se monte que dans le sous-onglet");
  const onglets = page.slice(page.indexOf("renderSubTabs(["), page.indexOf("storageKey: \"qualiopi.subtab\""));
  assert.ok(!/charger\(/.test(onglets), "aucun sous-onglet ne relance charger()");
  assert.equal((page.match(/\bcharger\(courante\)/g) || []).length, 1, "un seul chargement au rendu");
});

test("page : le registre est lu une fois par rendu, relu après un changement, et l'inventaire recalculé", () => {
  assert.match(page, /registre: \{ etat: "non_lue" \}/, "même forme que la satisfaction");
  const lecture = page.slice(page.indexOf("function lireRegistre()"), page.indexOf("function majRappelRegistre()"));
  assert.match(lecture, /lireRegistreQualite\(\)/);
  assert.match(lecture, /entrees === null \? \{ etat: "absente" \} : \{ etat: "lue", entrees \}/);
  assert.match(lecture, /\{ etat: "non_lue" \}/);
  assert.match(lecture, /if \(moi === numeroRegistre && pageVivante\(\)\)/, "une lecture caduque n'écrit rien");
  assert.match(lecture, /recalculerInventaire\(\);/);
  assert.equal((page.match(/^\s*lireRegistre\(\);/gm) || []).length, 1, "lu une fois au rendu");
  assert.match(page, /renderRegistreQualite\(panneau, \{ lire: \(\) => lectureRegistre, surChangement: lireRegistre \}\)/);
});

test("page : en tête, quel que soit l'onglet, les entrées à effacer et à clore", () => {
  const rappel = page.slice(page.indexOf("function majRappelRegistre()"), page.indexOf("const sousOnglets"));
  assert.match(rappel, /aEffacer\(entrees, new Date\(\)\)/);
  assert.match(rappel, /aClore\(entrees, jourParis\(new Date\(\)\)\)/);
  assert.match(rappel, /du registre à effacer/);
  assert.match(rappel, /à clore/);
  const ordre = ["racine.appendChild(rappelRegistre)", "racine.appendChild(sousOnglets)"].map((t) => page.indexOf(t));
  assert.ok(ordre[0] > 0 && ordre[0] < ordre[1], "le rappel est au-dessus des sous-onglets, donc visible sous les deux");
});

test("fenêtre : rappel des violences en tête, « Ne nomme personne » sous la description, erreurs sous chaque champ", () => {
  assert.match(fenetre, /el\("p", \{ class: "rg-rappel" \}, RAPPEL_VIOLENCES\)/);
  assert.equal(lire("js/registre-fenetre.js").match(/NE_NOMME_PERSONNE = "([^"]+)"/)[1], "Ne nomme personne : l'origine suffit.");
  const description = fenetre.slice(fenetre.indexOf('"Description")'), fenetre.indexOf("suite,", fenetre.indexOf('"Description")')));
  assert.ok(description.indexOf("champDescription") < description.indexOf("NE_NOMME_PERSONNE"), "le rappel est juste sous le champ");
  assert.match(fenetre, /validerEntree\(champs, aujourdhui\)/);
  for (const cle of ["type", "date_constat", "origine", "description", "reponse", "date_reponse", "action_decidee", "mesure_prevention"]) {
    assert.match(fenetre, new RegExp(`zoneErreur\\("${cle}"\\)`), cle);
  }
  assert.match(fenetre, /Object\.entries\(TYPES\)\.map\(\(\[cle, libelle\]\) => el\("button", \{/, "le type en boutons");
  assert.match(fenetre, /el\("option", \{ value: "" \}, "Aucune"\)/);
  assert.match(fenetre, /el\("option", \{ value: "" \}, "Tout l'organisme"\)/);
  assert.match(fenetre, /champDate\.value = jour\(depart\.date_constat\) \|\| aujourdhui;/, "aujourd'hui par défaut");
  assert.match(fenetre, /if \(champReponse\.value\.trim\(\) && !champDateReponse\.value\) champDateReponse\.value = aujourdhui;/,
    "une réponse tapée sans date reçoit la date du jour");
});

test("fenêtre : saisie modifiée, la fermeture passe par confirmer(), jamais par la boîte du navigateur", () => {
  assert.match(fenetre, /ouvrirFenetre\(\{\s*nom: NOM, ancre, etiquette: titre, classe: "registre-fenetre", avantFermeture,/);
  const garde = fenetre.slice(fenetre.indexOf("function avantFermeture()"), fenetre.indexOf("const titre ="));
  assert.match(garde, /if \(enregistre \|\| !modifiee\(\)\) return true;/);
  assert.match(garde, /confirmer\(\{ titre: "Fermer sans enregistrer \?"/);
  assert.match(garde, /if \(oui && fenetreOuverte\(\) === NOM && fenetre\.isConnected\) fermerFenetre\(\);/, "elle se ferme elle-même sur oui");
  assert.match(garde, /\}\);\s*return false;\s*\}\s*$/, "elle garde la fenêtre pendant la question");
  assert.match(fenetre, /class: "rg-fermer", onClick: \(\) => demanderFermeture\(\)/, "son propre « Fermer » passe par la garde");
  for (const [nom, code] of [["fenêtre", fenetre], ["panneau", panneau], ["page", page]]) {
    assert.ok(!/(^|[^.\w])confirm\(|window\.confirm\(|\balert\(/.test(code), `${nom} : aucune boîte native`);
  }
});

test("nav-fenetre : avantFermeture branché sur Échap, le voile et « Fermer », pas sur l'adresse", () => {
  assert.match(nav, /avantFermeture = null \}\)/);
  assert.match(nav, /if \(e\.target === calque\) demanderFermeture\(\);/, "voile");
  assert.match(nav, /e\.stopPropagation\(\);\s*demanderFermeture\(\);\s*return;/, "Échap");
  assert.match(nav, /class: "nav-fenetre-fermer", onClick: \(\) => demanderFermeture\(\)/, "« Fermer » du haut");
  const adresse = nav.slice(nav.indexOf("function surChangementAdresse()"), nav.indexOf("function oublierFenetre()"));
  assert.ok(!/demanderFermeture|avantFermeture/.test(adresse), "l'adresse qui change ne demande pas");
});

test("fenêtre : un champ vide part en null, dates comprises, et les colonnes posées par la base ne partent jamais", () => {
  const envoi = fenetre.slice(fenetre.indexOf("function envoi(champs)"), fenetre.indexOf("const erreurGenerale"));
  for (const cle of ["date_constat", "origine", "description", "reponse", "date_reponse", "action_decidee"]) {
    assert.match(envoi, new RegExp(`${cle}: vide\\(champs\\.${cle}\\)`), cle);
  }
  assert.match(envoi, /mesure_prevention: champs\.type === "risque" \? vide\(champs\.mesure_prevention\) : null/);
  assert.match(envoi, /champs\.promo_id === "" \? null : Number\(champs\.promo_id\)/);
  assert.match(envoi, /champs\.lieu_id === "" \? null : Number\(champs\.lieu_id\)/);
  assert.ok(!/cree_le|modifie_le|clos_le|issu_signalement|efface_le|action:/.test(envoi), "aucune colonne posée par la base");
  const champs = db.slice(db.indexOf("function champsRegistre(champs)"), db.indexOf("function erreurRegistre("));
  assert.match(champs, /envoi\[cle\] = typeof v === "string" \? \(v\.trim\(\) \|\| null\) : v;/, "db.js : toute chaîne vide en null");
  const liste = db.match(/const CHAMPS_REGISTRE = \[([^\]]+)\]/)[1];
  assert.ok(!/cree_le|modifie_le|clos_le|issu_signalement|efface_le/.test(liste));
});

test("panneau : export de la liste filtrée par registreCsv, carte effacée sans ouverture, table absente dite", () => {
  const exporter = panneau.slice(panneau.indexOf('boutonExporter.addEventListener("click"'), panneau.indexOf("zone.append("));
  assert.match(exporter, /telecharger\(nomFichierRegistre\(jourParis\(new Date\(\)\)\), registreCsv\(filtrees, nomsP, nomsL\)\)/);
  assert.match(panneau, /filtrees = filtrerRegistre\(entrees, filtres\);/);
  assert.match(panneau, /ne le transmets qu'à l'auditeur/);
  const carte = panneau.slice(panneau.indexOf("function carte(e)"), panneau.indexOf("function majListe()"));
  const efface = carte.slice(carte.indexOf("if (estEfface(e))"), carte.indexOf("const bouton ="));
  assert.match(efface, /el\("article", \{ class: "rg-carte rg-carte-lecture"/, "une carte effacée est un article, pas un bouton");
  assert.ok(!/addEventListener|onClick|ouvrir\(/.test(efface), "elle n'ouvre rien");
  assert.match(panneau, /`Textes effacés le \$\{/);
  assert.match(panneau, /REGISTRE_ABSENT = "Le registre sera disponible après la mise à jour de la base\."/);
  assert.match(panneau, /"Le choix de promo de la page ne filtre pas ce registre\."/);
  for (const libelle of ["Tous", "Ouverts", "En cours", "Clos"]) assert.match(panneau, new RegExp(`"${libelle}"\\]`), libelle);
  const effacer = panneau.slice(panneau.indexOf("const dus = aEffacer("), panneau.indexOf("// --- Filtres ---"));
  assert.match(effacer, /if \(dus\.length\)/, "« Effacer les textes » seulement quand il y en a");
  assert.match(effacer, /await confirmer\(\{/);
  assert.match(effacer, /if \(!oui \|\| !vivant\(\)\) return;/);
  assert.match(effacer, /await effacerRegistreQualite\(\);/);
  assert.match(effacer, /await apresChangement\(/, "relu après l'effacement");
});

test("feuille de style : cibles de 44 px, boutons de type qui passent à la ligne, pas de tableau ni de défilement de côté", () => {
  assert.match(css, /\.rg-filtre, \.rg-type-choix \{[^}]*min-height: 44px/);
  assert.match(css, /\.rg-types \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.rg-carte \{[^}]*min-height: 44px/);
  assert.match(css, /\.rg-fermer \{[^}]*min-height: 44px/);
  assert.match(css, /\.rg-suite > summary \{[^}]*min-height: 44px/);
  assert.match(css, /\.registre-fenetre \.btn \{ min-height: 44px; \}/);
  assert.match(css, /\.qualiopi \.subtab \{ min-height: 44px; \}/);
  assert.match(css, /\.modal-backdrop\[data-nav-coquille="registre"\] ~ \.modal-backdrop:not\(\.nav-calque\) \{ z-index: 1700; \}/,
    "la confirmation passe devant la fenêtre");
  assert.ok(!/<table|el\("table"/.test(panneau + fenetre), "jamais un tableau");
  assert.ok(!/overflow(-x)?\s*:\s*(auto|scroll)/.test(css));
});

test("aucun tiret cadratin, « formateur » jamais « prof » à l'écran", () => {
  for (const fichier of ["js/views/registre-qualite.js", "js/registre-fenetre.js", "js/views/qualiopi.js", "js/nav-fenetre.js",
    "css/qualiopi.css", "js/db.js", "tests/registre-page.test.mjs", "tests/nav-fenetre.test.mjs"]) {
    assert.ok(!lire(fichier).includes(String.fromCharCode(0x2014)), fichier);
  }
  for (const fichier of ["js/views/registre-qualite.js", "js/registre-fenetre.js"]) {
    assert.ok(!/\bprof\b/i.test(lire(fichier)), fichier);
  }
});
