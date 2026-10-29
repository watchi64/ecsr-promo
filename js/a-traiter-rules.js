// Pastilles « à traiter » de l'équipe (refonte, lot 2A) : ce qui attend un formateur dans Cours et QCM, les
// signalements de QCM non traités et les propositions de l'IA à relire. Les règles seulement : combien, comment le
// dire, où le montrer, et une lecture qui ne lève jamais. Module pur, sans DOM ni base : testé en node. La coquille
// (js/nav-shell.js) pose les pastilles, js/a-traiter.js lit les deux comptes en base.

// L'entrée qui porte la pastille chiffrée : Cours et QCM, où vivent les signalements et les propositions de l'IA.
// Chez l'équipe, le téléphone la range dans le tiroir « Plus » (js/nav-rules.js) : « Plus » porte alors un point.
export const ENTREE_A_TRAITER = "themes";

// Un compte valide : un entier de zéro ou plus. Tout le reste (null d'une lecture ratée, NaN, négatif, texte,
// décimal) est illisible.
const valide = (n) => Number.isInteger(n) && n >= 0;

// Ce qui attend l'équipe : `total`, la somme des comptes valides, et `texte`, le détail (« 3 signalements, 2 propositions
// de l'IA »), au singulier quand il n'y en a qu'un ; une partie nulle ou illisible est omise, un total nul n'a pas de texte.
export function resumeATraiter(comptes) {
  const { signalements, propositionsIA } = comptes || {};
  const s = valide(signalements) ? signalements : 0;
  const p = valide(propositionsIA) ? propositionsIA : 0;
  const parties = [];
  if (s > 0) parties.push(`${s} ${s === 1 ? "signalement" : "signalements"}`);
  if (p > 0) parties.push(`${p} ${p === 1 ? "proposition" : "propositions"} de l'IA`);
  return { total: s + p, texte: parties.join(", ") };
}

// Nom d'une entrée ou d'un bouton, ce qui est à traiter compris (« Cours et QCM, 5 à traiter ») ; le nom seul à zéro.
export function nomAvecATraiter(nom, resume) {
  return resume && resume.total > 0 ? `${nom}, ${resume.total} à traiter` : nom;
}

// La phrase en tête du tiroir « Plus » (spec, ruling R20) : « 5 à traiter : 3 signalements, 2 propositions de l'IA » ;
// vide quand il n'y a rien à traiter.
export function phraseATraiter(resume) {
  return resume && resume.total > 0 ? `${resume.total} à traiter : ${resume.texte}` : "";
}

// « Plus » porte un point quand il y a quelque chose à traiter et que l'entrée qui le porte est rangée dans le tiroir
// (`idsDuTiroir` : les entrées que le téléphone y range). Chez l'équipe, « Cours et QCM » y est rangée (le test des règles
// le garde) ; la barre du bas n'a pas de pastille.
export function pointSurPlus(idsDuTiroir, resume) {
  return !!resume && resume.total > 0 && Array.isArray(idsDuTiroir) && idsDuTiroir.includes(ENTREE_A_TRAITER);
}

// Lit un compte : un nombre valide, ou null quand la lecture échoue (ou lève avant d'avoir rendu une promesse) ou rend
// autre chose qu'un compte. Ne rejette jamais.
async function lire(lecteur) {
  try {
    const n = await lecteur();
    return valide(n) ? n : null;
  } catch (e) {
    return null;
  }
}

// Les deux comptes, lus ensemble : `lecteurs` = { signalements, propositionsIA }, deux fonctions qui rendent une promesse
// d'entier. Chaque compte illisible vaut null (un compte en échec ne touche pas l'autre) ; ne rejette jamais, de sorte
// que la barre n'a ni exception ni erreur à montrer quand une lecture échoue.
export async function lireLesComptes(lecteurs) {
  const { signalements, propositionsIA } = lecteurs || {};
  const [s, p] = await Promise.all([lire(signalements), lire(propositionsIA)]);
  return { signalements: s, propositionsIA: p };
}
