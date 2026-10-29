/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Rendu des blocs interactifs des cours de compétences : schéma animé
 * (:::scene), dessin fixe du catalogue (:::dessin), quiz (:::quiz ordre | vrai-faux | choix)
 * et cartes d'autoévaluation (:::cartes). L'analyse est dans js/cours-blocs-rules.js
 * (testée sous Node) ; ici le DOM seul, sans innerHTML. Un bloc mal formé,
 * non refermé ou de directive inconnue s'affiche en texte brut et son erreur
 * rejoint contexte.erreurs, que l'éditeur affiche (le stagiaire ne la voit
 * pas). Rien n'est enregistré.
 *
 * Chargement à la demande : ce fichier n'importe aucun moteur de schémas ni aucun
 * dessin. Le catalogue des blocs (js/catalogue-blocs.js) dit quel module dessine
 * chaque code ; au premier bloc qui en a besoin, ce module se charge, une fois pour
 * la session (chargerModule). La figure, la légende et la liste des étapes
 * s'affichent tout de suite ; la vue du bloc montre « Chargement du schéma… » (« du dessin… » pour
 * un dessin), puis le bloc, ou un message et « Réessayer » si le réseau a manqué. Un module
 * chargé qui ne connaît pas le code, ou dont le montage lève, montre un message
 * sobre sans « Réessayer » (qui n'y changerait rien). Chaque échec est aussi dit à
 * l'éditeur (contexte.signaler). Un bloc détruit pendant le chargement ne monte rien
 * et ne signale rien. Le cycle de vie d'un bloc est dans js/cours-blocs-rules.js
 * (piloterBloc, testé sous Node) ; ici, l'affichage.
 *
 * Le contexte est celui de rendreMarkdown (js/views/cours-reader.js) :
 *   erreurs : les messages des blocs signalés ;
 *   signaler : fonction (message) qu'un bloc appelle quand il n'a pu ni se charger ni se monter, après que le
 *             rendu a rendu la main (l'éditeur l'ajoute à ses avertissements ; sans effet ailleurs) ;
 *   scenes  : les schémas montés. Un schéma arrêté garde son observateur de visibilité, donc son
 *             SVG en vie : quiconque jette le résultat d'un rendu (fermeture de la fiche, nouveau
 *             rendu de l'aperçu) appelle d'abord detruireScenes(contexte) ;
 *   blocs   : false pour l'assistant, où un bloc copié dans une réponse reste du texte brut.
 * `inline(texte, sansLien)` est le rendu de texte du lecteur (gras, code, liens) : un lien n'entre
 * jamais dans un bouton (option, étape, carte), le texte y passe donc toujours sansLien.
 *
 * Accessibilité : la correction ne repose pas sur la couleur (une marque écrite par option ou par
 * affirmation) ; la zone d'état (role="status") dit le score, la bonne réponse et l'explication de
 * ce qui est faux ; une option verrouillée est aria-disabled ; chaque question est un groupe nommé.
 */
import { el } from "./utils.js?v=20261029a";
import { analyserScene, analyserDessin, analyserQuiz, analyserCartes, melangerSansIdentite, corrigerOrdre, corrigerChoix,
  corrigerOption, MARQUES_CHOIX, BLOCS_INTERACTIFS, erreurDirective, erreurNonRefermee, messageOrdre, messageVraiFaux,
  messageChoix, creerChargeur, adresseDeReprise, piloterBloc, trouverDansRegistre, messageCodeInconnu }
  from "./cours-blocs-rules.js?v=20261029a";
import { entreeBloc } from "./catalogue-blocs.js?v=20261029a";

// Modules chargés à la demande, un import littéral par module (le jeton de cache s'y lit et s'y réécrit, scripts/cache-bust.js).
// `essai` : le nombre d'échecs déjà essuyés pour ce module (0 au premier chargement). Un import() qui a échoué reste en échec
// pour la même adresse tant que la page n'est pas rechargée, même si le réseau est revenu : « Réessayer » redemande donc le
// module sous une adresse nouvelle (adresseDeReprise), avec le jeton de ce fichier, que le même script réécrit avec les autres.
//
// RÈGLE des modules racines de cette table (scenes.js, scene-moteur.js, geste-moteur.js, dessins-*.js) : une reprise en évalue
// une seconde copie (« ?v=…&essai=N »), pendant que la première, si elle s'était chargée, reste en mémoire sans servir. C'est
// sans danger à deux conditions. 1. Le module n'a aucun effet de bord à l'évaluation (rien d'écrit dans le document, rien
// enregistré ailleurs) : un état propre à sa copie (le compteur de scene-moteur.js) est permis, car une seule copie sert, celle
// que rend chargerModule. 2. Aucun autre module ne l'importe statiquement : cette copie-là servirait en même temps que celle de
// la reprise, et tout état serait en double. tests/chargement.test.mjs garde la seconde condition et la forme de cette table.
// L'import() calculé de `importer` est l'exception voulue à la règle « import dynamique littéral » : le jeton vient de
// l'adresse de ce fichier, donc ne peut pas se périmer, et le même test vérifie que chaque reprise vise le fichier de son import
// littéral. Un nouveau module racine suit cette règle ; un module partagé entre familles (dessins-kit.js) n'est pas une racine.
const JETON = new URL(import.meta.url).search;
/** L'import d'un module racine de la table : au premier essai (`essai` 0), son import littéral (`premier`) ; à l'essai N, le même
 *  fichier (`chemin`) sous une adresse nouvelle, avec le jeton `jeton` et « essai=N » (adresseDeReprise), demandée par
 *  `importDynamique`. Exporté pour les tests, qui y passent un import factice. */
export function creerImporteur(jeton, importDynamique) {
  return (essai, chemin, premier) => (essai === 0 ? premier() : importDynamique(adresseDeReprise(chemin, jeton, essai)));
}
const importer = creerImporteur(JETON, (adresse) => import(adresse));
/** Un chargeur par module de blocs : `(essai) => promesse du module`. Exportée pour les tests, qui vérifient qu'une reprise
 *  redemande vraiment le module (tests/chargement.test.mjs). */
export const CHARGEURS = {
  route: (essai) => Promise.all([
    importer(essai, "./scenes.js", () => import("./scenes.js?v=20261029a")),
    importer(essai, "./scene-moteur.js", () => import("./scene-moteur.js?v=20261029a")),
  ]).then(([registre, moteur]) => ({ SCENES: registre.SCENES, monterScene: moteur.monterScene })),
  geste: (essai) => importer(essai, "./geste-moteur.js", () => import("./geste-moteur.js?v=20261029a")),
  poste: (essai) => importer(essai, "./dessins-poste.js", () => import("./dessins-poste.js?v=20261029a")),
  voyants: (essai) => importer(essai, "./dessins-voyants.js", () => import("./dessins-voyants.js?v=20261029a")),
  conducteur: (essai) => importer(essai, "./dessins-conducteur.js", () => import("./dessins-conducteur.js?v=20261029a")),
  entretien: (essai) => importer(essai, "./dessins-entretien.js", () => import("./dessins-entretien.js?v=20261029a")),
  visibilite: (essai) => importer(essai, "./dessins-visibilite.js", () => import("./dessins-visibilite.js?v=20261029a")),
  dessus: (essai) => importer(essai, "./dessins-dessus.js", () => import("./dessins-dessus.js?v=20261029a")),
};
export const chargerModule = creerChargeur(CHARGEURS);

// Marques écrites de la correction (en plus de la couleur), une par état ; celles du quiz choix, qui compte
// aussi la bonne réponse non choisie, sont dans js/cours-blocs-rules.js (MARQUES_CHOIX).
const MARQUE_ORDRE = { juste: "Bien placé", faux: "Mal placé" };
const MARQUE_REPONSE = { juste: "Réponse juste", faux: "Réponse fausse" };

// Identifiants des textes qui nomment un groupe (aria-labelledby) : uniques dans la page.
let numeroId = 0;
const nouvelId = (prefixe) => `${prefixe}-${++numeroId}`;

function animationsReduites() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

// `ferme` : false quand le texte s'arrête avant la ligne « ::: » (on n'invente pas la fermeture).
function brut(type, arg, lignes, ferme = true) {
  return el("pre", { class: "cours-bloc-brut" }, [`:::${type} ${arg}`.trim(), ...lignes, ...(ferme ? [":::"] : [])].join("\n"));
}

/** Arrête les schémas montés par un rendu et vide la liste : à appeler avant de jeter ses nœuds. */
export function detruireScenes(contexte) {
  const scenes = contexte && Array.isArray(contexte.scenes) ? contexte.scenes.splice(0) : [];
  for (const moteur of scenes) {
    try { moteur.detruire(); } catch (e) { /* déjà arrêté : les autres le sont quand même */ }
  }
}

/** Rend un bloc ; `inline` est le rendu de texte du lecteur (gras, liens…), `ferme` vaut false quand le
 *  texte s'arrête avant la fermeture du bloc. */
export function rendreBlocInteractif(type, arg, lignes, contexte, inline, ferme = true) {
  // Assistant : un bloc copié dans une réponse reste du texte, rien n'est monté dans la bulle.
  if (contexte.blocs === false) return brut(type, arg, lignes, ferme);
  if (!ferme) { contexte.erreurs.push(erreurNonRefermee(type)); return brut(type, arg, lignes, false); }
  if (!BLOCS_INTERACTIFS.includes(type)) { contexte.erreurs.push(erreurDirective(type)); return brut(type, arg, lignes); }
  if (type === "scene") return rendreScene(arg, lignes, contexte, inline);
  if (type === "dessin") return rendreDessin(arg, lignes, contexte, inline);
  if (type === "quiz") {
    const q = analyserQuiz(arg, lignes);
    if (!q.ok) { contexte.erreurs.push(q.erreur); return brut(type, arg, lignes); }
    if (q.forme === "ordre") return quizOrdre(q, inline);
    if (q.forme === "vrai-faux") return quizVraiFaux(q, inline);
    return quizChoix(q, inline);
  }
  const c = analyserCartes(lignes);
  if (!c.ok) { contexte.erreurs.push(c.erreur); return brut(type, arg, lignes); }
  return cartes(c, inline);
}

// Attente puis échec d'un chargement, dans la vue du bloc. `ratio` : [largeur, hauteur] réservés (pas de saut de page). `nom` :
// le mot du bloc (« schéma » pour une scène, « dessin » pour un dessin), deux noms masculins : « du », « Le » et « Ce » valent pour les deux.
function attente(vue, ratio, nom = "schéma") {
  vue.replaceChildren(el("div", { class: "bloc-attente", role: "status",
    style: ratio ? `aspect-ratio: ${ratio[0]} / ${ratio[1]}` : "" }, `Chargement du ${nom}…`));
}
// Dès le deuxième échec de la même vue, le message ajoute de recharger la page : quand un module d'un moteur a échoué, le
// navigateur le garde en échec jusqu'au rechargement (voir CHARGEURS), et « Réessayer » ne peut plus aboutir.
function echecChargement(vue, reessayer, nom = "schéma") {
  const echecs = (Number(vue.dataset.echecs) || 0) + 1;
  vue.dataset.echecs = String(echecs);
  const bouton = el("button", { class: "btn", type: "button" }, "Réessayer");
  bouton.addEventListener("click", reessayer);
  vue.replaceChildren(el("div", { class: "bloc-echec", role: "status" },
    el("p", {}, `Le ${nom} n'a pas pu se charger. Vérifier la connexion.`),
    echecs > 1 ? el("p", {}, "Si cela persiste, recharger la page une fois la connexion rétablie.") : null, bouton));
}
// Un bloc dont le module est chargé mais qui ne peut pas s'afficher (le module ne connaît pas le code, ou le montage a levé) :
// un message sobre, sans « Réessayer », qui n'y changerait rien. L'éditeur, lui, reçoit la cause précise (signalerAuContexte).
function blocIndisponible(vue, texte) {
  vue.replaceChildren(el("div", { class: "bloc-indisponible", role: "status" }, el("p", {}, texte)));
}
// Un échec qui arrive après le rendu : l'éditeur l'ajoute à ses avertissements (contexte.signaler), le lecteur l'ignore.
function signalerAuContexte(contexte, message) {
  if (!contexte || typeof contexte.signaler !== "function") return;
  try { contexte.signaler(message); } catch (erreur) { console.error(erreur); }
}

// Le cycle de vie commun d'un bloc illustré, schéma animé ou dessin (piloterBloc : attente, échec de réseau et reprise, code absent,
// erreur de montage, destruction), et tout ce qu'il montre, avec le mot du bloc dans chaque phrase : `genre` « Schéma » ou « Dessin »
// (l'éditeur le lit aussi dans ses messages). `vue` : où le bloc se montre ; `cadre` : la place qu'on lui réserve pendant le chargement ;
// `charger()` et `monter(modules)` : d'où viennent les modules et comment on monte le bloc. Le bloc est inscrit dans `contexte.scenes`
// (détruit avec le cours ou l'aperçu) et démarré : l'appelant n'a plus qu'à brancher ses étapes.
function lancerBlocIllustre({ genre, code, module, cadre, vue, contexte, charger, monter }) {
  const nom = genre.toLowerCase();
  const bloc = piloterBloc({
    genre, code, module, charger, monter,
    afficher: {
      attente: () => attente(vue, cadre, nom),
      echecReseau: (reessayer) => echecChargement(vue, reessayer, nom),
      indisponible: (nature) => blocIndisponible(vue, nature === "absent" ? `Ce ${nom} n'est pas encore disponible.` : `Ce ${nom} n'a pas pu s'afficher.`),
    },
    signaler: (message) => signalerAuContexte(contexte, message),
    journaliser: (message, erreur) => console.error(message, erreur),
  });
  contexte.scenes.push({ detruire: () => bloc.detruire() });
  bloc.demarrer();
  return bloc;
}

function rendreScene(arg, lignes, contexte, inline) {
  const analyse = analyserScene(arg, lignes);
  // Entrée propre au catalogue : « constructor » ou « toString » ne sont pas des schémas, ni un dessin fixe.
  const entree = entreeBloc(analyse.code);
  const scene = entree && entree.bloc === "scene" ? entree : null;
  const synchro = scene !== null && analyse.etapes.length === scene.etapesModele.length;
  if (!scene) {
    contexte.erreurs.push(messageCodeInconnu("scene", analyse.code, entree));
  } else if (!synchro) {
    contexte.erreurs.push(`Le schéma « ${analyse.code} » attend ${scene.etapesModele.length} étapes, le bloc en donne ${analyse.etapes.length}.`);
  }
  // Une étape est un bouton quand elle commande le schéma, un simple texte sinon (pas de bouton mort).
  const liste = el("ol", { class: "scene-etapes" });
  const items = analyse.etapes.map((texte, i) => {
    const contenu = [el("span", { class: "scene-etape-num" }, String(i + 1)), el("span", { class: "scene-etape-texte" }, inline(texte, true))];
    const etape = synchro ? el("button", { type: "button", class: "scene-etape" }, ...contenu) : el("span", { class: "scene-etape" }, ...contenu);
    const li = el("li", {}, etape);
    liste.appendChild(li);
    return { li, etape };
  });
  if (!scene) return el("div", { class: "scene-bloc scene-inconnue" }, liste);
  // La figure, la liste des étapes et la place du dessin sont posées tout de suite ; le moteur se monte quand son module est
  // chargé. Le cycle de vie du bloc (attente, échec de réseau et reprise, code absent, erreur de montage, appui sur une étape
  // avant le montage, destruction) est celui de piloterBloc, par lancerBlocIllustre (commun avec le dessin, qui y met son mot) ; ici,
  // seulement ce qu'on montre et d'où viennent les modules.
  // Un geste (dessin d'une famille) porte le cadre que lui donne le catalogue en variables CSS : css/cours-blocs.css en borne la
  // hauteur à 72 % de l'écran, et la largeur d'autant. Une scène de route n'a pas de cadre au catalogue : .scene-svg a les siennes.
  const cadre = Array.isArray(scene.cadre) ? scene.cadre : null;
  const vue = el("div", { class: "scene-vue", style: cadre ? `--cadre-l: ${cadre[0]}; --cadre-h: ${cadre[1]}` : null });
  const figure = el("figure", { class: "scene-bloc" }, vue, liste);
  const options = () => ({ conteneur: vue, etapes: synchro ? items.map((x) => x.li) : [], reduit: animationsReduites() });
  // Le registre du module dit comment construire la scène : un code qu'il ne connaît pas lève « absent » avant que la vue
  // soit touchée ; l'attente reste affichée jusqu'au moment de monter.
  const monter = scene.module === "route"
    ? ({ SCENES, monterScene }) => {
      const def = trouverDansRegistre(SCENES, analyse.code, "route").construire();
      vue.replaceChildren();
      return monterScene(def, options());
    }
    : ([famille, moteur]) => {
      const def = trouverDansRegistre(famille.GESTES, analyse.code, scene.module).construire();
      vue.replaceChildren();
      return moteur.monterGeste(def, options());
    };
  const bloc = lancerBlocIllustre({
    genre: "Schéma", code: analyse.code, module: scene.module, cadre: scene.cadre, vue, contexte, monter,
    charger: () => (scene.module === "route" ? chargerModule("route") : Promise.all([chargerModule(scene.module), chargerModule("geste")])),
  });
  if (synchro) items.forEach((x, i) => x.etape.addEventListener("click", () => bloc.allerEtape(i)));
  return figure;
}

// Un dessin fixe du catalogue (:::dessin code, légende facultative). Même cycle de vie qu'un schéma (piloterBloc : attente,
// échec de réseau et reprise, code absent du module, erreur de montage, destruction), sans moteur ni étapes : le module de la
// famille rend le dessin (`DESSINS[code]()` puis `versDom`, réexporté par le module). Un code que le catalogue ne donne pas
// comme dessin (faute de frappe, schéma animé, propriété héritée) n'en dessine aucun : la légende seule s'affiche, jamais un
// dessin deviné, et l'éditeur reçoit l'erreur.
function rendreDessin(arg, lignes, contexte, inline) {
  const analyse = analyserDessin(arg, lignes);
  if (!analyse.ok) { contexte.erreurs.push(analyse.erreur); return brut("dessin", arg, lignes); }
  const entree = entreeBloc(analyse.code);
  const dessin = entree && entree.bloc === "dessin" ? entree : null;
  const legende = analyse.legende ? el("figcaption", { class: "signaux-legende" }, inline(analyse.legende)) : null;
  if (!dessin) {
    contexte.erreurs.push(messageCodeInconnu("dessin", analyse.code, entree));
    return el("figure", { class: "dessin-bloc dessin-inconnu" }, legende);
  }
  const vue = el("div", { class: "dessin-vue" });
  const figure = el("figure", { class: "dessin-bloc" }, vue, legende);
  lancerBlocIllustre({
    genre: "Dessin", code: analyse.code, module: dessin.module, cadre: dessin.cadre, vue, contexte,
    charger: () => chargerModule(dessin.module),
    monter: (module) => {
      const dessiner = trouverDansRegistre(module.DESSINS, analyse.code, dessin.module);
      vue.replaceChildren(module.versDom(dessiner()));
      return null;
    },
  });
  return figure;
}

function message() {
  return el("p", { class: "quiz-message", role: "status" });
}
function annoncer(zone, texte, reussi) {
  zone.className = "quiz-message " + (reussi ? "reussi" : "erreur");
  zone.textContent = texte;
}
function effacer(zone) {
  zone.className = "quiz-message";
  zone.textContent = "";
}

// Marque écrite de la correction d'une option ou d'une affirmation : cachée tant que rien n'est corrigé.
function nouvelleMarque() {
  return el("span", { class: "quiz-marque", hidden: true });
}
// `etat` : « juste », « faux » ou, pour une bonne réponse non choisie, « manquee » ; `textes` donne la marque de chacun.
function poserMarque(marque, etat, textes) {
  marque.className = "quiz-marque quiz-marque-" + etat;
  marque.textContent = textes[etat];
  marque.hidden = false;
}
function effacerMarque(marque) {
  marque.className = "quiz-marque";
  marque.textContent = "";
  marque.hidden = true;
}

// Option corrigée : plus d'appui possible, ce que dit aria-disabled aux lecteurs d'écran.
function verrouiller(option) {
  option.classList.add("verrou");
  option.setAttribute("aria-disabled", "true");
}
function deverrouiller(option) {
  option.classList.remove("verrou");
  option.removeAttribute("aria-disabled");
}

function quizOrdre(q, inline) {
  const plat = (texte) => inline(texte, true).textContent;
  const ordreAffiche = melangerSansIdentite(q.elements);   // indice (ordre juste) de chaque position affichée
  let choix = [];                                           // positions affichées, dans l'ordre des appuis
  const zone = message();
  const idConsigne = nouvelId("quiz-consigne");
  const liste = el("div", { class: "quiz-liste", role: "group", "aria-labelledby": idConsigne });
  const boutons = ordreAffiche.map((idx, pos) => {
    const rang = el("span", { class: "quiz-rang" }, "");
    const marque = nouvelleMarque();
    const b = el("button", { type: "button", class: "quiz-option" },
      rang, el("span", { class: "quiz-option-texte" }, inline(q.elements[idx], true)), marque);
    b.addEventListener("click", () => {
      if (b.classList.contains("verrou")) return;
      const k = choix.indexOf(pos);
      choix = k >= 0 ? choix.slice(0, k) : [...choix, pos];   // retirer un rang retire aussi les suivants
      majRangs();
      effacer(zone);
    });
    liste.appendChild(b);
    return { b, rang, marque };
  });
  function majRangs() {
    boutons.forEach(({ rang }, pos) => { const k = choix.indexOf(pos); rang.textContent = k >= 0 ? String(k + 1) : ""; });
  }
  const verifier = el("button", { type: "button", class: "btn" }, "Vérifier");
  verifier.addEventListener("click", () => {
    if (choix.length < q.elements.length) { annoncer(zone, "Classer toutes les étapes avant de vérifier.", false); return; }
    const r = corrigerOrdre(choix.map((pos) => q.elements[ordreAffiche[pos]]), q.elements);
    choix.forEach((pos, k) => {
      const { b, marque } = boutons[pos];
      const ok = r.parPosition[k];
      b.classList.add(ok ? "juste" : "faux");
      verrouiller(b);
      poserMarque(marque, ok ? "juste" : "faux", MARQUE_ORDRE);
    });
    annoncer(zone, messageOrdre(r.justes, r.total, q.elements.map(plat)), r.justes === r.total);
  });
  const recommencer = el("button", { type: "button", class: "btn ghost" }, "Recommencer");
  recommencer.addEventListener("click", () => {
    choix = [];
    boutons.forEach(({ b, marque }) => { b.classList.remove("juste", "faux"); deverrouiller(b); effacerMarque(marque); });
    majRangs();
    effacer(zone);
  });
  return el("div", { class: "quiz" },
    el("p", { class: "quiz-consigne", id: idConsigne }, inline(q.consigne)),
    el("p", { class: "quiz-aide" }, "Appuyer sur les étapes dans l'ordre ; appuyer de nouveau pour corriger."),
    liste, el("div", { class: "quiz-actions" }, verifier, recommencer), zone);
}

function quizVraiFaux(q, inline) {
  const plat = (texte) => inline(texte, true).textContent;
  const reponses = new Map();
  const zone = message();
  const lignes = q.items.map((it, i) => {
    const idAffirmation = nouvelId("quiz-affirmation");
    const vrai = el("button", { type: "button", class: "quiz-vf", "aria-pressed": "false" }, "Vrai");
    const faux = el("button", { type: "button", class: "quiz-vf", "aria-pressed": "false" }, "Faux");
    const marque = nouvelleMarque();
    const explication = el("p", { class: "quiz-explication", hidden: true }, inline(it.explication || ""));
    const ligne = el("div", { class: "quiz-vf-ligne", role: "group", "aria-labelledby": idAffirmation },
      el("p", { class: "quiz-affirmation", id: idAffirmation }, inline(it.affirmation)),
      el("div", { class: "quiz-vf-boutons" }, vrai, faux, marque), explication);
    // Changer une réponse efface la correction de cette ligne ; « Recommencer » efface celle de toutes.
    const effacerCorrection = () => {
      ligne.classList.remove("juste", "faux");
      effacerMarque(marque);
      explication.hidden = true;
    };
    const appuyer = (val) => {
      vrai.setAttribute("aria-pressed", String(val === true));
      faux.setAttribute("aria-pressed", String(val === false));
    };
    const choisir = (val) => {
      reponses.set(i, val);
      appuyer(val);
      effacerCorrection();
      effacer(zone);
    };
    vrai.addEventListener("click", () => choisir(true));
    faux.addEventListener("click", () => choisir(false));
    const remettre = () => { appuyer(null); effacerCorrection(); };
    return { it, ligne, explication, marque, remettre };
  });
  const verifier = el("button", { type: "button", class: "btn" }, "Vérifier");
  verifier.addEventListener("click", () => {
    if (reponses.size < q.items.length) { annoncer(zone, "Répondre à chaque affirmation avant de vérifier.", false); return; }
    let justes = 0;
    lignes.forEach(({ it, ligne, explication, marque }, i) => {
      const ok = reponses.get(i) === it.vrai;
      if (ok) justes++;
      ligne.classList.remove("juste", "faux");
      ligne.classList.add(ok ? "juste" : "faux");
      poserMarque(marque, ok ? "juste" : "faux", MARQUE_REPONSE);
      if (it.explication) explication.hidden = false;
    });
    annoncer(zone, messageVraiFaux(q.items, reponses, plat), justes === q.items.length);
  });
  const recommencer = el("button", { type: "button", class: "btn ghost" }, "Recommencer");
  recommencer.addEventListener("click", () => {
    reponses.clear();
    lignes.forEach((x) => x.remettre());
    effacer(zone);
  });
  return el("div", { class: "quiz" }, ...lignes.map((x) => x.ligne), el("div", { class: "quiz-actions" }, verifier, recommencer), zone);
}

function quizChoix(q, inline) {
  const plat = (texte) => inline(texte, true).textContent;
  const zone = message();
  const blocs = q.questions.map((question) => {
    const cochees = new Set();
    const plusieurs = question.options.filter((o) => o.juste).length > 1;
    const idQuestion = nouvelId("quiz-question");
    const options = question.options.map((o, i) => {
      const marque = nouvelleMarque();
      const b = el("button", { type: "button", class: "quiz-option", "aria-pressed": "false" },
        el("span", { class: "quiz-option-texte" }, inline(o.texte, true)), marque);
      b.addEventListener("click", () => {
        if (b.classList.contains("verrou")) return;
        if (!plusieurs) cochees.forEach((k) => { if (k !== i) { cochees.delete(k); options[k].b.setAttribute("aria-pressed", "false"); } });
        if (cochees.has(i)) cochees.delete(i); else cochees.add(i);
        b.setAttribute("aria-pressed", String(cochees.has(i)));
        effacer(zone);
      });
      return { b, marque };
    });
    const explication = el("p", { class: "quiz-explication", hidden: true }, inline(question.explication || ""));
    const bloc = el("div", { class: "quiz-question-bloc", role: "group", "aria-labelledby": idQuestion },
      el("p", { class: "quiz-question", id: idQuestion }, inline(question.question)),
      plusieurs ? el("p", { class: "quiz-aide" }, "Plusieurs réponses possibles.") : null,
      ...options.map((x) => x.b), explication);
    return { question, cochees, options, explication, bloc };
  });
  const verifier = el("button", { type: "button", class: "btn" }, "Vérifier");
  verifier.addEventListener("click", () => {
    if (blocs.some((x) => x.cochees.size === 0)) { annoncer(zone, "Choisir au moins une réponse par question.", false); return; }
    let justes = 0;
    for (const x of blocs) {
      if (corrigerChoix(x.question, x.cochees)) justes++;
      x.options.forEach(({ b, marque }, i) => {
        verrouiller(b);
        b.classList.remove("juste", "faux", "manquee");
        // Bonne réponse choisie, mauvaise réponse choisie, ou bonne réponse non choisie : trois états, trois marques.
        const etat = corrigerOption(x.question.options[i], x.cochees.has(i));
        if (etat) {
          b.classList.add(etat);
          poserMarque(marque, etat, MARQUES_CHOIX);
        } else {
          effacerMarque(marque);
        }
      });
      if (x.question.explication) x.explication.hidden = false;
    }
    annoncer(zone, messageChoix(q.questions, blocs.map((x) => x.cochees), plat), justes === blocs.length);
  });
  const recommencer = el("button", { type: "button", class: "btn ghost" }, "Recommencer");
  recommencer.addEventListener("click", () => {
    for (const x of blocs) {
      x.cochees.clear();
      x.options.forEach(({ b, marque }) => {
        b.setAttribute("aria-pressed", "false");
        b.classList.remove("juste", "faux", "manquee");
        deverrouiller(b);
        effacerMarque(marque);
      });
      x.explication.hidden = true;
    }
    effacer(zone);
  });
  return el("div", { class: "quiz" }, ...blocs.map((x) => x.bloc), el("div", { class: "quiz-actions" }, verifier, recommencer), zone);
}

function cartes(c, inline) {
  const plat = (texte) => inline(texte, true).textContent;
  const grille = el("div", { class: "cartes-grille" });
  // Zone d'annonce (invisible) : la réponse qui prend la place de la question dans le bouton n'est pas lue d'elle-même.
  const annonce = el("p", { class: "cartes-annonce", role: "status" });
  for (const { q, r } of c.cartes) {
    const recto = el("span", { class: "carte-face" }, inline(q, true));
    const verso = el("span", { class: "carte-face", hidden: true }, inline(r, true));
    const b = el("button", { type: "button", class: "carte", "aria-pressed": "false" }, recto, verso);
    b.addEventListener("click", () => {
      const retournee = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(retournee));
      recto.hidden = retournee;
      verso.hidden = !retournee;
      annonce.textContent = retournee ? `Réponse : ${plat(r)}` : "";
    });
    grille.appendChild(b);
  }
  return el("div", { class: "cartes-bloc" },
    el("p", { class: "cartes-aide" }, "Appuyer sur une carte pour voir la réponse."), grille, annonce);
}
