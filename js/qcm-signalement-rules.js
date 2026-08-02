// Règles d'affichage de l'instruction automatique d'un signalement.
// Module PUR : aucun DOM, aucun réseau, aucune écriture. L'application ne produit jamais
// un verdict, elle ne fait que le lire — c'est le second verrou de la règle non négociable.

export const VERDICTS = {
  fonde:         "Signalement fondé",
  confirme:      "Question confirmée",
  ambigu:        "Ambigu",
  non_concluant: "Non concluant",
};

export function libelleVerdict(verdict) {
  return VERDICTS[verdict] || "Verdict inconnu";
}

// Première ligne utile de l'analyse : c'est elle qui s'affiche replié. Le gabarit de
// l'agent commence par « Conclusion : … » ; l'étiquette est retirée pour ne pas la lire
// deux fois à l'écran.
export function conclusionDe(analyse) {
  const ligne = String(analyse || "").split("\n").map((l) => l.trim()).find(Boolean) || "";
  return ligne.replace(/^conclusion\s*:\s*/i, "").trim();
}

// État d'affichage d'un signalement, instruit ou non.
// PostgREST rend la jointure un-à-un tantôt en objet, tantôt en tableau d'un élément :
// on accepte les deux plutôt que de faire dépendre l'affichage de ce détail.
export function etatInstruction(signalement) {
  const brut = signalement?.instruction;
  const instr = Array.isArray(brut) ? (brut[0] || null) : (brut || null);
  if (!instr || !instr.verdict_auto) return { instruit: false };
  return {
    instruit: true,
    verdict: instr.verdict_auto,
    libelle: libelleVerdict(instr.verdict_auto),
    conclusion: conclusionDe(instr.analyse_auto),
    analyse: String(instr.analyse_auto || ""),
    instruitAt: instr.instruit_at || null,
  };
}

// Découpe un texte en morceaux pour construire des liens cliquables avec el() : le
// contenu vient de l'agent, il ne doit JAMAIS passer par innerHTML.
// La classe exclut « ) », « > » et les guillemets : sinon la parenthèse fermante d'un
// « (https://…) » entre dans l'URL et le lien Légifrance est mort.
const URL_RE = /https?:\/\/[^\s<>()"]+/g;

export function morceaux(texte) {
  const t = String(texte || "");
  const out = [];
  let i = 0;
  for (const m of t.matchAll(URL_RE)) {
    if (m.index > i) out.push({ valeur: t.slice(i, m.index), lien: false });
    out.push({ valeur: m[0], lien: true });
    i = m.index + m[0].length;
  }
  if (i < t.length) out.push({ valeur: t.slice(i), lien: false });
  return out;
}
