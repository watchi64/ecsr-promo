// Verrou transport de la regle d'or : en flux, masque tout motif de numero
// d'article qui n'a pas ete verifie via PISTE dans la requete en cours.
// Module pur (testable en node) : l'Edge Function ne fait que l'appeler.
// Le (?!\d) final evite le faux positif sur les plages d'annees (l 2024-2025).

export const MOTIF_ARTICLE = /\b[RLD]\.?\s?\d{2,4}(?:-\d{1,3})+(?!\d)/gi;
const MASQUE = "[verification en cours]";
// Queue retenue en tampon : plus long motif plausible (L. 1234-123-12 = 14) + marge.
const RETENUE = 16;

export function creerVerrou() {
  return { tampon: "", autorises: new Set() };
}

export function normaliserNumero(num) {
  return String(num ?? "").toUpperCase().replace(/[.\s]/g, "");
}

export function autoriserNumero(verrou, num) {
  const n = normaliserNumero(num);
  if (n) verrou.autorises.add(n);
}

function masquer(verrou, texte) {
  return texte.replace(MOTIF_ARTICLE, (m) =>
    verrou.autorises.has(normaliserNumero(m)) ? m : MASQUE);
}

// Ajoute un delta au tampon et renvoie la partie devenue sure a emettre :
// tout sauf les RETENUE derniers caracteres, frontiere reculee au debut d'un
// motif qui la chevaucherait (il pourrait encore s'etendre au prochain delta).
export function pousserDelta(verrou, delta) {
  verrou.tampon += String(delta ?? "");
  let limite = Math.max(0, verrou.tampon.length - RETENUE);
  if (limite === 0) return "";
  MOTIF_ARTICLE.lastIndex = 0;
  let m;
  while ((m = MOTIF_ARTICLE.exec(verrou.tampon)) !== null) {
    if (m.index >= limite) break;
    if (m.index + m[0].length >= limite) { limite = m.index; break; }
  }
  if (limite === 0) return "";
  const sortie = masquer(verrou, verrou.tampon.slice(0, limite));
  verrou.tampon = verrou.tampon.slice(limite);
  return sortie;
}

// Vide le tampon (fin de tour ou fin de flux) : plus rien ne peut s'etendre.
export function viderVerrou(verrou) {
  const reste = masquer(verrou, verrou.tampon);
  verrou.tampon = "";
  return reste;
}
