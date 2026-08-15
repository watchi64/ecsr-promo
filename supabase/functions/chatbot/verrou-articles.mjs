// Verrou transport de la regle d'or : en flux, masque tout motif de numero
// d'article qui n'a pas ete verifie via PISTE dans la requete en cours.
// Module pur (testable en node) : l'Edge Function ne fait que l'appeler.
// SYNCHRONE PAR CONTRAT : la regex globale est partagee au niveau module ;
// ajouter un await dans ces fonctions casserait l'isolation entre requetes.
// Le (?!\d) final evite le faux positif sur les plages d'annees (l 2024-2025).

export const MOTIF_ARTICLE = /\b[RLD]\.?\s?\d{2,4}(?:-\d{1,3})+(?!\d)/gi;
const MASQUE = "[vérification en cours]";
// Queue retenue en tampon. Doit rester superieure au plus long motif plausible :
// L. 1234-123-12 = 14 caracteres (la regex n'etant pas bornee, une correspondance
// plus longue reste couverte par le recul de frontiere, jamais par cette constante).
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

// Assemble la sortie a partir des correspondances DEJA calculees sur le tampon
// entier : ne jamais rejouer la regex sur une tranche coupee, le (?!\d) y
// mentirait et masquerait du texte ordinaire (plage d'annees coupee au mauvais
// endroit, constat de revue du 2026-08-15).
function assembler(verrou, motifs, limite) {
  let sortie = "";
  let pos = 0;
  for (const m of motifs) {
    if (m.index + m[0].length > limite) break;
    sortie += verrou.tampon.slice(pos, m.index)
      + (verrou.autorises.has(normaliserNumero(m[0])) ? m[0] : MASQUE);
    pos = m.index + m[0].length;
  }
  return sortie + verrou.tampon.slice(pos, limite);
}

// Ajoute un delta au tampon et renvoie la partie devenue sure a emettre :
// tout sauf les RETENUE derniers caracteres, frontiere reculee au debut d'un
// motif qui la chevaucherait (il pourrait encore s'etendre au prochain delta).
export function pousserDelta(verrou, delta) {
  verrou.tampon += String(delta ?? "");
  let limite = Math.max(0, verrou.tampon.length - RETENUE);
  if (limite === 0) return "";
  MOTIF_ARTICLE.lastIndex = 0;
  const motifs = [...verrou.tampon.matchAll(MOTIF_ARTICLE)];
  for (const m of motifs) {
    if (m.index >= limite) break;
    if (m.index + m[0].length >= limite) { limite = m.index; break; }
  }
  if (limite === 0) return "";
  const sortie = assembler(verrou, motifs, limite);
  verrou.tampon = verrou.tampon.slice(limite);
  return sortie;
}

// Vide le tampon (fin de tour ou fin de flux) : plus rien ne peut s'etendre.
export function viderVerrou(verrou) {
  MOTIF_ARTICLE.lastIndex = 0;
  const motifs = [...verrou.tampon.matchAll(MOTIF_ARTICLE)];
  const reste = assembler(verrou, motifs, verrou.tampon.length);
  verrou.tampon = "";
  return reste;
}
