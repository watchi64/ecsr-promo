/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Rendu des blocs interactifs des cours de compétences : schéma animé
 * (:::scene), quiz (:::quiz ordre | vrai-faux | choix) et cartes
 * d'autoévaluation (:::cartes). L'analyse est dans js/cours-blocs-rules.js
 * (testée sous Node) ; ici le DOM seul, sans innerHTML. Un bloc mal formé,
 * non refermé ou de directive inconnue s'affiche en texte brut et son erreur
 * rejoint contexte.erreurs, que l'éditeur affiche (le stagiaire ne la voit
 * pas). Rien n'est enregistré.
 *
 * Le contexte est celui de rendreMarkdown (js/views/cours-reader.js) :
 *   erreurs : les messages des blocs signalés ;
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
import { el } from "./utils.js?v=20261005f";
import { analyserScene, analyserQuiz, analyserCartes, melangerSansIdentite, corrigerOrdre, corrigerChoix,
  corrigerOption, MARQUES_CHOIX, BLOCS_INTERACTIFS, erreurDirective, erreurNonRefermee, messageOrdre, messageVraiFaux,
  messageChoix }
  from "./cours-blocs-rules.js?v=20261005f";
import { SCENES } from "./scenes.js?v=20261005f";
import { monterScene } from "./scene-moteur.js?v=20261005f";

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

function rendreScene(arg, lignes, contexte, inline) {
  const analyse = analyserScene(arg, lignes);
  // Propriété propre au registre : « constructor » ou « toString » ne sont pas des schémas.
  const entree = Object.prototype.hasOwnProperty.call(SCENES, analyse.code) ? SCENES[analyse.code] : null;
  const def = entree ? entree.construire() : null;
  const synchro = def !== null && analyse.etapes.length === def.etapes.length;
  if (!entree) {
    contexte.erreurs.push(`Schéma « ${analyse.code} » inconnu : les étapes s'affichent en simple liste.`);
  } else if (!synchro) {
    contexte.erreurs.push(`Le schéma « ${analyse.code} » attend ${def.etapes.length} étapes, le bloc en donne ${analyse.etapes.length}.`);
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
  if (!entree) return el("div", { class: "scene-bloc scene-inconnue" }, liste);
  const vue = el("div", { class: "scene-vue" });
  const figure = el("figure", { class: "scene-bloc" }, vue, liste);
  const moteur = monterScene(def, { conteneur: vue, etapes: synchro ? items.map((x) => x.li) : [], reduit: animationsReduites() });
  contexte.scenes.push(moteur);
  if (synchro) items.forEach((x, i) => x.etape.addEventListener("click", () => moteur.allerEtape(i)));
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
