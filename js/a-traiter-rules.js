// Pastilles « à traiter » de l'équipe (refonte, lot 2A) : ce qui attend un formateur dans Cours et QCM, les signalements
// de QCM non traités et, une fois le lot 2B posé, les propositions de l'IA à relire (voir COMPTER_LES_PROPOSITIONS_IA). Les
// règles seulement : combien, comment le dire, où le montrer, et une lecture qui ne lève jamais. Module pur, sans DOM ni
// base : testé en node. La coquille (js/nav-shell.js) pose les pastilles, js/a-traiter.js lit les comptes en base.

// L'entrée qui porte la pastille chiffrée : Cours et QCM, où vivent les signalements de QCM (et, au lot 2B, les propositions de l'IA).
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

// « Plus » porte un point quand il y a quelque chose à voir dans le tiroir : un compte « à traiter » sur l'entrée qui le porte
// (`idsDuTiroir` : les entrées que le téléphone y range ; chez l'équipe, « Cours et QCM » y est rangée, le test des règles le garde),
// ou une pastille sur « Signaler un problème », que le tiroir contient toujours. `pastilleDeSignaler` : le texte de cette pastille
// (js/signalement-rules.js, pastilleSignalement), vide quand elle n'est pas affichée. Sans tiroir (aucune entrée rangée), pas de point :
// la barre du bas n'a pas de pastille.
export function pointSurPlus(idsDuTiroir, resume, pastilleDeSignaler = "") {
  if (!Array.isArray(idsDuTiroir) || idsDuTiroir.length === 0) return false;
  const aTraiter = !!resume && resume.total > 0 && idsDuTiroir.includes(ENTREE_A_TRAITER);
  return aTraiter || !!pastilleDeSignaler;
}

// Le nom de « Plus » : « Plus » seul, ou suivi de ce que son point signale (« Plus, 5 à traiter », « Plus, 2 nouveaux signalements »,
// les deux dans cet ordre). Il garde le libellé visible en tête (WCAG 2.5.3). `nomDeSignaler` : le nom accessible de « Signaler un
// problème » (pastilleSignalement) ; ce qu'il dit après sa virgule (« 2 nouveaux signalements ») passe ici, rien quand il n'a pas de détail.
const NOM_DE_SIGNALER = "Signaler un problème, ";
export function nomDePlus(resume, nomDeSignaler = "") {
  const parties = ["Plus"];
  if (resume && resume.total > 0) parties.push(`${resume.total} à traiter`);
  if (typeof nomDeSignaler === "string" && nomDeSignaler.startsWith(NOM_DE_SIGNALER)) parties.push(nomDeSignaler.slice(NOM_DE_SIGNALER.length));
  return parties.join(", ");
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

// Ruling R56 (relecture finale du 29/10) : tant que l'équipe n'a pas de liste où retrouver les propositions de l'IA (le sous-onglet
// « Propositions IA » de Cours et QCM, lot 2B), la pastille ne compte que les signalements de QCM. Les brouillons de l'IA sont communs à
// toutes les promos et sans auteur : un compte sans liste derrière lui promettrait du travail qu'on ne retrouve pas. Le lot 2B passe
// cette constante à true ; le comptage (countBrouillonsIaARelire, js/db.js) et le texte du résumé n'ont pas bougé.
export const COMPTER_LES_PROPOSITIONS_IA = false;

// Les lecteurs que lireLesComptes lit : `lecteurs` = { signalements, propositionsIA } ; sans `avecPropositionsIA`, le lecteur des
// propositions de l'IA est remplacé par un lecteur qui rend null : la table des brouillons n'est pas lue, et le résumé (qui omet un compte
// nul) ne les dit pas.
export function lecteursDeLaPastille(lecteurs, avecPropositionsIA = COMPTER_LES_PROPOSITIONS_IA) {
  const { signalements, propositionsIA } = lecteurs || {};
  return { signalements, propositionsIA: avecPropositionsIA ? propositionsIA : async () => null };
}
