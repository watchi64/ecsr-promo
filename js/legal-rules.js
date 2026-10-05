// Règles pures des conditions d'utilisation (testées par tests/legal-rules.test.mjs).

// Le compte doit-il accepter cette version ? acceptations : lignes { version, accepted_at }.
export function doitAccepter(acceptations, version) {
  return !(acceptations || []).some((a) => a && a.version === version);
}

// Le compte a-t-il déjà accepté une version antérieure ? (le message dit alors « ont changé »)
export function aDejaAccepte(acceptations) {
  return (acceptations || []).length > 0;
}

// Les lignes de l'encadré « L'essentiel » du texte, sans le titre en gras.
export function lignesEssentiel(md) {
  const lignes = String(md).split("\n");
  const debut = lignes.findIndex((l) => /^>\s*\*\*L'essentiel/.test(l.trim()));
  if (debut < 0) return [];
  const out = [];
  for (let i = debut + 1; i < lignes.length; i++) {
    const l = lignes[i].trim();
    if (!l.startsWith(">")) break;
    const texte = l.replace(/^>\s*/, "").trim();
    if (texte) out.push(texte);
  }
  return out;
}

// « 2026-10-04 » → « 4 octobre 2026 » (date de la version, affichée sous le titre).
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
  "septembre", "octobre", "novembre", "décembre"];
export function dateVersion(version) {
  const m = String(version).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(version);
  return `${Number(m[3])} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

// Repères laissés dans un texte avant publication ([SIRET], [ADRESSE]…).
export function reperesNonRemplis(md) {
  return String(md).match(/\[[A-ZÉÈ]{3,}\]/g) || [];
}
