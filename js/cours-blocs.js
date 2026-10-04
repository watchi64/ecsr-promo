/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Rendu des blocs interactifs des cours de compétences : schéma animé
 * (:::scene), quiz (:::quiz ordre | vrai-faux | choix) et cartes
 * d'autoévaluation (:::cartes). L'analyse est dans js/cours-blocs-rules.js
 * (testée sous Node) ; ici le DOM seul, sans innerHTML. Un bloc mal formé
 * s'affiche en texte brut et son erreur rejoint contexte.erreurs, que
 * l'éditeur affiche (le stagiaire ne la voit pas). Rien n'est enregistré.
 */
import { el } from "./utils.js?v=20261003c";
import { analyserScene, analyserQuiz, analyserCartes, melangerSansIdentite, corrigerOrdre, corrigerChoix }
  from "./cours-blocs-rules.js?v=20261003c";
import { SCENES } from "./scenes.js?v=20261003c";
import { monterScene } from "./scene-moteur.js?v=20261003c";

function animationsReduites() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

function brut(type, arg, lignes) {
  return el("pre", { class: "cours-bloc-brut" }, [`:::${type} ${arg}`.trim(), ...lignes, ":::"].join("\n"));
}

/** Rend un bloc ; `inline` est le rendu de texte du lecteur (gras, liens…). */
export function rendreBlocInteractif(type, arg, lignes, contexte, inline) {
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
  const liste = el("ol", { class: "scene-etapes" });
  const items = analyse.etapes.map((texte, i) => {
    const bouton = el("button", { type: "button", class: "scene-etape" },
      el("span", { class: "scene-etape-num" }, String(i + 1)), inline(texte));
    const li = el("li", {}, bouton);
    liste.appendChild(li);
    return { li, bouton };
  });
  // Propriété propre au registre : « constructor » ou « toString » ne sont pas des schémas.
  const entree = Object.prototype.hasOwnProperty.call(SCENES, analyse.code) ? SCENES[analyse.code] : null;
  if (!entree) {
    contexte.erreurs.push(`Schéma « ${analyse.code} » inconnu : les étapes s'affichent en simple liste.`);
    return el("div", { class: "scene-bloc scene-inconnue" }, liste);
  }
  const def = entree.construire();
  const synchro = analyse.etapes.length === def.etapes.length;
  if (!synchro) {
    contexte.erreurs.push(`Le schéma « ${analyse.code} » attend ${def.etapes.length} étapes, le bloc en donne ${analyse.etapes.length}.`);
  }
  const vue = el("div", { class: "scene-vue" });
  const figure = el("figure", { class: "scene-bloc" }, vue, liste);
  const moteur = monterScene(def, { conteneur: vue, etapes: synchro ? items.map((x) => x.li) : [], reduit: animationsReduites() });
  if (synchro) items.forEach((x, i) => x.bouton.addEventListener("click", () => moteur.allerEtape(i)));
  return figure;
}

function message() {
  return el("p", { class: "quiz-message", role: "status" });
}
function annoncer(zone, texte, reussi) {
  zone.className = "quiz-message " + (reussi ? "reussi" : "erreur");
  zone.textContent = texte;
}

function quizOrdre(q, inline) {
  const ordreAffiche = melangerSansIdentite(q.elements);   // indice (ordre juste) de chaque position affichée
  let choix = [];                                           // positions affichées, dans l'ordre des appuis
  const zone = message();
  const liste = el("div", { class: "quiz-liste" });
  const boutons = ordreAffiche.map((idx, pos) => {
    const rang = el("span", { class: "quiz-rang" }, "");
    const b = el("button", { type: "button", class: "quiz-option" }, rang, inline(q.elements[idx]));
    b.addEventListener("click", () => {
      if (b.classList.contains("verrou")) return;
      const k = choix.indexOf(pos);
      choix = k >= 0 ? choix.slice(0, k) : [...choix, pos];   // retirer un rang retire aussi les suivants
      majRangs();
      zone.textContent = "";
    });
    liste.appendChild(b);
    return { b, rang };
  });
  function majRangs() {
    boutons.forEach(({ rang }, pos) => { const k = choix.indexOf(pos); rang.textContent = k >= 0 ? String(k + 1) : ""; });
  }
  const verifier = el("button", { type: "button", class: "btn" }, "Vérifier");
  verifier.addEventListener("click", () => {
    if (choix.length < q.elements.length) { annoncer(zone, "Classe toutes les étapes avant de vérifier.", false); return; }
    const r = corrigerOrdre(choix.map((pos) => q.elements[ordreAffiche[pos]]), q.elements);
    choix.forEach((pos, k) => boutons[pos].b.classList.add(r.parPosition[k] ? "juste" : "faux", "verrou"));
    annoncer(zone, r.justes === r.total
      ? "Juste : tout est dans l'ordre."
      : `${r.justes} sur ${r.total} à la bonne place. Ordre juste : ${q.elements.join(", ")}.`, r.justes === r.total);
  });
  const recommencer = el("button", { type: "button", class: "btn ghost" }, "Recommencer");
  recommencer.addEventListener("click", () => {
    choix = [];
    boutons.forEach(({ b }) => b.classList.remove("juste", "faux", "verrou"));
    majRangs();
    zone.className = "quiz-message";
    zone.textContent = "";
  });
  return el("div", { class: "quiz" },
    el("p", { class: "quiz-consigne" }, inline(q.consigne)),
    el("p", { class: "quiz-aide" }, "Touche les étapes dans l'ordre ; touche de nouveau pour corriger."),
    liste, el("div", { class: "quiz-actions" }, verifier, recommencer), zone);
}

function quizVraiFaux(q, inline) {
  const reponses = new Map();
  const zone = message();
  const lignes = q.items.map((it, i) => {
    const vrai = el("button", { type: "button", class: "quiz-vf", "aria-pressed": "false" }, "Vrai");
    const faux = el("button", { type: "button", class: "quiz-vf", "aria-pressed": "false" }, "Faux");
    const explication = el("p", { class: "quiz-explication", hidden: true }, inline(it.explication || ""));
    const choisir = (val) => {
      reponses.set(i, val);
      vrai.setAttribute("aria-pressed", String(val === true));
      faux.setAttribute("aria-pressed", String(val === false));
      zone.textContent = "";
    };
    vrai.addEventListener("click", () => choisir(true));
    faux.addEventListener("click", () => choisir(false));
    const ligne = el("div", { class: "quiz-vf-ligne" },
      el("p", { class: "quiz-affirmation" }, inline(it.affirmation)),
      el("div", { class: "quiz-vf-boutons" }, vrai, faux), explication);
    return { it, ligne, explication };
  });
  const verifier = el("button", { type: "button", class: "btn" }, "Vérifier");
  verifier.addEventListener("click", () => {
    if (reponses.size < q.items.length) { annoncer(zone, "Réponds à chaque affirmation avant de vérifier.", false); return; }
    let justes = 0;
    lignes.forEach(({ it, ligne, explication }, i) => {
      const ok = reponses.get(i) === it.vrai;
      if (ok) justes++;
      ligne.classList.remove("juste", "faux");
      ligne.classList.add(ok ? "juste" : "faux");
      if (it.explication) explication.hidden = false;
    });
    annoncer(zone, `${justes} sur ${q.items.length} justes.`, justes === q.items.length);
  });
  return el("div", { class: "quiz" }, ...lignes.map((x) => x.ligne), el("div", { class: "quiz-actions" }, verifier), zone);
}

function quizChoix(q, inline) {
  const zone = message();
  const blocs = q.questions.map((question) => {
    const cochees = new Set();
    const plusieurs = question.options.filter((o) => o.juste).length > 1;
    const options = question.options.map((o, i) => {
      const b = el("button", { type: "button", class: "quiz-option", "aria-pressed": "false" }, inline(o.texte));
      b.addEventListener("click", () => {
        if (b.classList.contains("verrou")) return;
        if (!plusieurs) cochees.forEach((k) => { if (k !== i) { cochees.delete(k); options[k].setAttribute("aria-pressed", "false"); } });
        if (cochees.has(i)) cochees.delete(i); else cochees.add(i);
        b.setAttribute("aria-pressed", String(cochees.has(i)));
        zone.textContent = "";
      });
      return b;
    });
    const explication = el("p", { class: "quiz-explication", hidden: true }, inline(question.explication || ""));
    const bloc = el("div", { class: "quiz-question-bloc" },
      el("p", { class: "quiz-question" }, inline(question.question)),
      plusieurs ? el("p", { class: "quiz-aide" }, "Plusieurs réponses possibles.") : null,
      ...options, explication);
    return { question, cochees, options, explication, bloc };
  });
  const verifier = el("button", { type: "button", class: "btn" }, "Vérifier");
  verifier.addEventListener("click", () => {
    if (blocs.some((x) => x.cochees.size === 0)) { annoncer(zone, "Choisis au moins une réponse par question.", false); return; }
    let justes = 0;
    for (const x of blocs) {
      if (corrigerChoix(x.question, x.cochees)) justes++;
      x.options.forEach((b, i) => {
        b.classList.add("verrou");
        if (x.question.options[i].juste) b.classList.add("juste");
        else if (x.cochees.has(i)) b.classList.add("faux");
      });
      if (x.question.explication) x.explication.hidden = false;
    }
    annoncer(zone, `${justes} sur ${blocs.length} justes.`, justes === blocs.length);
  });
  return el("div", { class: "quiz" }, ...blocs.map((x) => x.bloc), el("div", { class: "quiz-actions" }, verifier), zone);
}

function cartes(c, inline) {
  const grille = el("div", { class: "cartes-grille" });
  for (const { q, r } of c.cartes) {
    const recto = el("span", { class: "carte-face" }, inline(q));
    const verso = el("span", { class: "carte-face", hidden: true }, inline(r));
    const b = el("button", { type: "button", class: "carte", "aria-pressed": "false" }, recto, verso);
    b.addEventListener("click", () => {
      const retournee = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(retournee));
      recto.hidden = retournee;
      verso.hidden = !retournee;
    });
    grille.appendChild(b);
  }
  return el("div", { class: "cartes-bloc" },
    el("p", { class: "cartes-aide" }, "Touche une carte pour voir la réponse."), grille);
}
