/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Analyse des blocs interactifs des cours de compétences, sans DOM (testée
 * sous Node). Le markdown écrit :
 *   :::scene <code>          puis une étape par ligne, puis :::
 *   :::quiz ordre            « ? consigne » facultative, puis les éléments dans l'ordre juste
 *   :::quiz vrai-faux        « affirmation | vrai ou faux | explication facultative »
 *   :::quiz choix            « ? question », options « - … », bonnes « - [x] … », « > explication »
 *   :::cartes                « Q : … » puis « R : … »
 * Un bloc mal formé renvoie { ok: false, erreur } : le lecteur l'affiche en
 * texte brut, l'éditeur affiche l'erreur.
 */

const NUMERO = /^\d+[.)]\s*/;

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
  const propres = lignes.map((l) => l.trim()).filter(Boolean);
  let consigne = "Remets les étapes dans l'ordre";
  if (propres[0] && propres[0].startsWith("? ")) consigne = propres.shift().slice(2).trim();
  const elements = propres.map((l) => l.replace(NUMERO, "").trim());
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
    if (!q) return { ok: false, erreur: "Quiz choix : chaque question commence par « ? »." };
    const opt = l.match(/^-\s+(\[x\]\s+)?(.+)$/i);
    if (opt) { q.options.push({ texte: opt[2].trim(), juste: !!opt[1] }); continue; }
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
