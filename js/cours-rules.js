/*
 * Regles pures de l'editeur de cours : aucune dependance DOM ni reseau,
 * tout se teste par node.
 */

/** Titre du cours (premiere ligne `# `), sans le prefixe « THEME XX - ». */
export function titreDepuisMarkdown(texte) {
  const m = String(texte).match(/^#\s+(.+)$/m);
  if (!m) return null;
  return m[1].replace(/^TH[ÈE]ME\s+\d+\s*[-:]\s*/i, "").trim();
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

/** Chemin d'une image dans le bucket cours-images. */
export function cheminImage(numero, nomFichier, horodatage) {
  const propre = String(nomFichier || "image").toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";
  return `theme_${String(numero).padStart(2, "0")}/${horodatage}_${propre}.jpg`;
}
