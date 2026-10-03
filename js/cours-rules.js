/*
 * Regles pures de l'editeur de cours : aucune dependance DOM ni reseau,
 * tout se teste par node.
 */

/** Titre du cours (première ligne `# `), sans le préfixe « THÈME XX - » ni le code d'une compétence « C2.4 - ». */
export function titreDepuisMarkdown(texte) {
  const m = String(texte).match(/^#\s+(.+)$/m);
  if (!m) return null;
  return m[1].replace(/^(TH[ÈE]ME\s+\d+|C[1-4](?:\.[1-9])?)\s*[-:]\s*/i, "").trim();
}

/** Minutes de lecture estimees (200 mots par minute, plancher 1). */
export function tempsLecture(texte) {
  const mots = String(texte).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / 200));
}

/** Enrobe la selection [debut, fin) de `avant`/`apres`, ou insere `defaut`.
 *  Renvoie le nouveau texte et la selection a reposer dans le champ. */
export function insererSyntaxe(texte, debut, fin, avant, apres, defaut) {
  const sel = texte.slice(debut, fin) || defaut;
  const nouveau = texte.slice(0, debut) + avant + sel + apres + texte.slice(fin);
  return { texte: nouveau, debutSel: debut + avant.length, finSel: debut + avant.length + sel.length };
}

/** Chemin d'une image dans le bucket cours-images. Les images d'une compétence
 *  vont sous `competence_c2-4/` (pour « C2.4 »). */
export function cheminImage(cle, nomFichier, horodatage) {
  const propre = String(nomFichier || "image").toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
  const dossier = estCodeCompetence(cle)
    ? "competence_" + cle.toLowerCase().replace(".", "-")
    : "theme_" + String(cle).padStart(2, "0");
  return `${dossier}/${horodatage}_${propre}.jpg`;
}

/** Interpolation linéaire par morceaux entre deux suites d'ancres croissantes
 *  (défilement synchronisé de l'éditeur : positions des titres de part et
 *  d'autre). Ancres inutilisables : y est rendu tel quel. */
export function interpolerAncres(src, dst, y) {
  if (src.length < 2 || src.length !== dst.length) return y;
  if (y <= src[0]) return dst[0];
  for (let i = 1; i < src.length; i++) {
    if (y <= src[i]) {
      const t = (y - src[i - 1]) / (src[i] - src[i - 1] || 1);
      return dst[i - 1] + t * (dst[i] - dst[i - 1]);
    }
  }
  return dst[dst.length - 1];
}

// ===== Clé d'un cours : numéro (les 57 thèmes) ou code (compétences de conduite) =====

const MOTIF_CODE = /^C[1-4](\.[1-9])?$/;

/** Clé d'un cours, ou d'une entrée du référentiel qui peut en porter un : le
 *  numéro d'un thème (1 à 57) ou le code d'une compétence (« C2.4 »). Une notion
 *  sans numéro ni code n'a pas de clé (null). */
export function cleCours(x) {
  if (!x) return null;
  if (typeof x.code === "string" && x.code) return x.code;
  if (x.numero !== null && x.numero !== undefined && x.numero !== "") return Number(x.numero);
  return null;
}

/** La clé désigne-t-elle une compétence (« C2 ») ou une sous-compétence (« C2.4 ») ? */
export function estCodeCompetence(cle) {
  return typeof cle === "string" && MOTIF_CODE.test(cle);
}

/** Ouverture d'une compétence (« C2 »), et non sous-compétence. */
export function estOuverture(cle) {
  return estCodeCompetence(cle) && !cle.includes(".");
}

/** Libellé de la pastille et de l'en-tête du lecteur : « 07 » ou « C2.4 ». */
export function libelleCle(cle) {
  return estCodeCompetence(cle) ? cle : String(cle).padStart(2, "0");
}

/** Ordre de lecture du livret : C1, C1.1 … C1.9, C2, C2.1 … */
export function comparerCodes(a, b) {
  const [ca, sa = 0] = a.slice(1).split(".").map(Number);
  const [cb, sb = 0] = b.slice(1).split(".").map(Number);
  return ca - cb || sa - sb;
}

/** Cours de compétence qui suit `cle` parmi les clés visibles, ou null. */
export function coursSuivant(cle, clesVisibles) {
  if (!estCodeCompetence(cle)) return null;
  const codes = [...new Set(clesVisibles.filter(estCodeCompetence))].sort(comparerCodes);
  return codes.find((c) => comparerCodes(c, cle) > 0) || null;
}

/** Lien interne `cours:31` ou `cours:C2.5` : la clé visée, sinon null. */
export function cibleLienCours(href) {
  const m = String(href).match(/^cours:(?:(\d{1,2})|(C[1-4](?:\.[1-9])?))$/);
  if (!m) return null;
  if (m[1]) {
    const n = Number(m[1]);
    return n >= 1 && n <= 57 ? n : null;
  }
  return m[2];
}
