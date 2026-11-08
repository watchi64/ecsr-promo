// Questions proposées par l'IA : règles pures côté navigateur (tests/qcm-ia-rules.test.mjs).
// Le contrôle qui fait foi est celui du serveur (supabase/functions/qcm-ia/brouillons.mjs) ;
// celui-ci prévient le formateur s'il ajoute lui-même, en relisant, un article absent du cours.

import { titreDuQcm } from "./qcm-rules.js?v=20261108b";

// Copie conforme du motif du serveur : un test vérifie que les deux donnent le même résultat.
const MOTIF_ARTICLE = /\b(?:[RLD]\.?\s?)?\d{2,4}(?:-\d{1,3})+(?!\d)/gi;

function normaliserNumero(num) {
  return String(num ?? "").toUpperCase().replace(/[.\s]/g, "");
}

/** Numéros d'article cités dans un texte, normalisés (R. 413-4 -> R413-4), sans doublon. */
export function articlesCites(texte) {
  const vus = new Set();
  for (const m of String(texte ?? "").matchAll(MOTIF_ARTICLE)) vus.add(normaliserNumero(m[0]));
  return [...vus];
}

/** Articles cités dans ces textes qui n'apparaissent pas dans le cours. */
export function articlesHorsCours(textes, articlesCours) {
  const autorises = new Set((articlesCours || []).map(normaliserNumero));
  return articlesCites((textes || []).join("\n")).filter((a) => !autorises.has(a));
}

/** Titres de niveau 2 et 3 du cours, dans l'ordre (le titre 1 est celui du thème). */
export function titresDuCours(md) {
  const titres = [];
  for (const ligne of String(md ?? "").split("\n")) {
    const m = /^(#{2,3}) (.+)$/.exec(ligne.trimEnd());
    if (m) titres.push({ niveau: m[1].length, titre: m[2].trim() });
  }
  return titres;
}

const JOUR_MOIS = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" });

/** Mention portée par une question acceptée depuis un brouillon de l'IA, sinon null. */
export function libelleTraceIa(q) {
  if (!q?.ia_validee_le) return null;
  const date = new Date(q.ia_validee_le);
  const quand = Number.isNaN(date.getTime()) ? "" : " le " + JOUR_MOIS.format(date);
  return "IA · validée par " + (q.ia_validee_par || "un formateur") + quand;
}

/** Un brouillon tel que le formulaire de question l'attend. */
export function brouillonVersQuestion(b) {
  return {
    section: b?.section || "",
    enonce: b?.enonce || "",
    explication: b?.explication || "",
    options: (Array.isArray(b?.options) ? b.options : []).map((o) => ({
      texte: String(o?.texte ?? ""), is_correct: o?.is_correct === true,
    })),
  };
}

/** Phrase de résultat après une demande : « 3 brouillons à relire, 1 écarté ». */
export function resumeProposition(nbGardes, nbEcartes) {
  const g = nbGardes === 0 ? "Aucun brouillon à relire"
    : `${nbGardes} brouillon${nbGardes > 1 ? "s" : ""} à relire`;
  if (!nbEcartes) return g + ".";
  return `${g}, ${nbEcartes} écarté${nbEcartes > 1 ? "s" : ""} par le contrôle.`;
}

/**
 * Les brouillons à relire, rangés par QCM pour la liste « Propositions IA » : { theme, qcmId, titre, nombre, plusAncien }.
 * Le QCM qui attend depuis le plus longtemps vient en premier. Un brouillon dont le thème n'est pas retrouvé reste
 * listé, sous le titre de son QCM : l'oublier ferait disparaître du travail à relire. `plusAncien` : la date de création
 * du plus ancien brouillon du QCM (null si aucun n'en porte une).
 */
export function groupesDeBrouillons(brouillons, themes) {
  const themeDe = new Map((themes || []).map((t) => [t.id, t]));
  const groupes = new Map();
  for (const b of Array.isArray(brouillons) ? brouillons : []) {
    const qcmId = b?.qcm_id ?? b?.qcm?.id;
    let g = groupes.get(qcmId);
    if (!g) {
      const theme = themeDe.get(b?.qcm?.theme_id) || null;
      g = { theme, qcmId, titre: titreDuQcm(theme, b?.qcm || { id: qcmId }), nombre: 0, plusAncien: null };
      groupes.set(qcmId, g);
    }
    g.nombre += 1;
    const t = Date.parse(b?.created_at);
    if (Number.isFinite(t) && (g.plusAncien === null || t < Date.parse(g.plusAncien))) g.plusAncien = b.created_at;
  }
  const quand = (g) => (g.plusAncien === null ? Infinity : Date.parse(g.plusAncien));
  return [...groupes.values()].sort((a, z) => (quand(a) === quand(z) ? 0 : quand(a) < quand(z) ? -1 : 1) || a.qcmId - z.qcmId);
}
