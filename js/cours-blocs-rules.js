/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Analyse des blocs interactifs des cours de compétences, sans DOM (testée
 * sous Node). Le markdown écrit :
 *   :::scene <code>          puis une étape par ligne, puis :::
 *   :::quiz ordre            « ? consigne » facultative, puis les éléments dans l'ordre juste
 *   :::quiz vrai-faux        « affirmation | vrai ou faux | explication facultative »
 *   :::quiz choix            « ? question », options « - … » (fausse explicite : « - [ ] … »),
 *                            bonnes « - [x] … », « > explication » ; une ligne vide ferme la question
 *   :::cartes                « Q : … » puis « R : … »
 * Les étapes et les éléments peuvent être numérotés (« 1. » ou « 1) ») : le numéro
 * est retiré, mais pas un décimal (« 1.5 m du bord »).
 * Un bloc mal formé renvoie { ok: false, erreur } : le lecteur l'affiche en
 * texte brut, l'éditeur affiche l'erreur.
 */

// Numéro en tête de ligne (« 1. », « 1.Tourner », « 3) »), retiré. Le séparateur ne doit pas
// être suivi d'un chiffre : « 1.5 m du bord » est une mesure, pas l'étape 1.
const NUMERO = /^\d+[.)](?!\d)\s*/;

export function analyserScene(arg, lignes) {
  const code = String(arg || "").trim().split(/\s+/)[0] || "";
  const etapes = lignes.map((l) => l.trim().replace(NUMERO, "").trim()).filter(Boolean);
  return { code, etapes };
}

export function analyserQuiz(forme, lignes) {
  const f = String(forme || "").trim();
  if (f === "ordre") return quizOrdre(lignes);
  if (f === "vrai-faux") return quizVraiFaux(lignes);
  if (f === "choix") return quizChoix(lignes);
  return { ok: false, erreur: `Quiz : forme « ${f} » inconnue (ordre, vrai-faux ou choix).` };
}

function quizOrdre(lignes) {
  // Numéro retiré avant d'écarter les lignes vides, comme pour la scène : « 3. » seul n'est pas un élément.
  const elements = lignes.map((l) => l.trim().replace(NUMERO, "").trim()).filter(Boolean);
  let consigne = "Remets les étapes dans l'ordre";
  if (elements[0] && elements[0].startsWith("? ")) consigne = elements.shift().slice(2).trim();
  if (elements.length < 2) return { ok: false, erreur: "Quiz ordre : au moins deux éléments." };
  if (elements.length > 8) return { ok: false, erreur: "Quiz ordre : huit éléments au plus." };
  if (new Set(elements).size !== elements.length) return { ok: false, erreur: "Quiz ordre : deux éléments identiques." };
  return { ok: true, forme: "ordre", consigne, elements };
}

function quizVraiFaux(lignes) {
  const items = [];
  for (const brut of lignes.map((l) => l.trim()).filter(Boolean)) {
    const parts = brut.split("|").map((p) => p.trim());
    if (parts.length < 2 || !/^(vrai|faux)$/i.test(parts[1])) {
      return { ok: false, erreur: `Quiz vrai-faux : « ${brut} » doit suivre « affirmation | vrai ou faux | explication ».` };
    }
    items.push({ affirmation: parts[0], vrai: /^vrai$/i.test(parts[1]), explication: parts.slice(2).join(" | ") });
  }
  if (!items.length) return { ok: false, erreur: "Quiz vrai-faux : aucune affirmation." };
  return { ok: true, forme: "vrai-faux", items };
}

function quizChoix(lignes) {
  const questions = [];
  let q = null;
  const fermer = () => { if (q) questions.push(q); q = null; };
  for (const brut of lignes) {
    const l = brut.trim();
    if (!l) { fermer(); continue; }
    if (l.startsWith("? ")) { fermer(); q = { question: l.slice(2).trim(), options: [], explication: "" }; continue; }
    if (!q) return { ok: false, erreur: `Quiz choix : la ligne « ${l} » n'est rattachée à aucune question (une ligne vide termine la question en cours).` };
    // « - texte » et « - [ ] texte » : fausse ; « - [x] texte » et « - [X] texte » : juste.
    const opt = l.match(/^-\s+(?:\[([ xX])\]\s+)?(.+)$/);
    if (opt) { q.options.push({ texte: opt[2].trim(), juste: opt[1] === "x" || opt[1] === "X" }); continue; }
    if (l.startsWith("> ")) { q.explication = (q.explication ? q.explication + " " : "") + l.slice(2).trim(); continue; }
    return { ok: false, erreur: `Quiz choix : ligne non reconnue « ${l} ».` };
  }
  fermer();
  if (!questions.length) return { ok: false, erreur: "Quiz choix : aucune question." };
  for (const x of questions) {
    if (x.options.length < 2) return { ok: false, erreur: `Quiz choix : « ${x.question} » a moins de deux options.` };
    if (!x.options.some((o) => o.juste)) return { ok: false, erreur: `Quiz choix : « ${x.question} » n'a pas de bonne réponse ([x]).` };
  }
  return { ok: true, forme: "choix", questions };
}

export function analyserCartes(lignes) {
  const cartes = [];
  let c = null;
  for (const brut of lignes) {
    const l = brut.trim();
    if (!l) continue;
    const m = l.match(/^([QR])\s*:\s*(.+)$/);
    if (!m) return { ok: false, erreur: `Cartes : ligne non reconnue « ${l} » (Q : … puis R : …).` };
    if (m[1] === "Q") {
      if (c) return { ok: false, erreur: `Cartes : la question « ${c.q} » n'a pas de réponse.` };
      c = { q: m[2].trim() };
    } else {
      if (!c) return { ok: false, erreur: "Cartes : une réponse sans question." };
      c.r = m[2].trim();
      cartes.push(c);
      c = null;
    }
  }
  if (c) return { ok: false, erreur: `Cartes : la question « ${c.q} » n'a pas de réponse.` };
  if (!cartes.length) return { ok: false, erreur: "Cartes : aucune carte." };
  return { ok: true, cartes };
}

// Générateur pseudo-aléatoire à graine (mulberry32) : le même quiz se mélange
// toujours de la même façon, sur tous les appareils.
function aleatoire(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordre d'affichage d'un quiz « ordre » : jamais l'ordre juste, sinon le quiz
 *  se résoudrait sans réfléchir. Renvoie, pour chaque position affichée,
 *  l'indice de l'élément dans l'ordre juste. */
export function melangerSansIdentite(elements) {
  const n = elements.length;
  const idx = elements.map((_, i) => i);
  if (n < 2) return idx;
  let graine = 7;
  for (const ch of elements.join("|")) graine = (Math.imul(graine, 31) + ch.codePointAt(0)) >>> 0;
  const alea = aleatoire(graine);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  if (idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}

export function corrigerOrdre(propose, attendu) {
  const parPosition = attendu.map((e, i) => propose[i] === e);
  return { justes: parPosition.filter(Boolean).length, total: attendu.length, parPosition };
}

export function corrigerChoix(question, cochees) {
  return question.options.every((o, i) => o.juste === cochees.has(i));
}
