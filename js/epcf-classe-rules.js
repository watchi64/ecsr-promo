// Règles pures des moyennes EPCF de la classe : combien de stagiaires sont évalués, quelles moyennes on peut montrer
// (k-anonymat), le titre d'une épreuve et la carte de l'état vide (une phrase et une action, comme les notes du lot C).
// Sans DOM ni base : testées par tests/epcf-classe-rules.test.mjs. Rendu : js/epcf-restitution.js (renderEpcfClasse)
// et js/views/epcf.js (renderEpcf).

// k-anonymat : la vue est affichée aussi aux stagiaires, donc la moyenne d'un critère n'est montrée que si AU MOINS
// 2 stagiaires ont ce critère. Sinon la « moyenne » serait la note exacte d'une personne.
export const SEUIL_MOYENNE_EPCF = 2;

// Les épreuves, dans l'ordre de l'écran, et la façon de les nommer dans une phrase.
const LIEUX = [["salle", "en salle"], ["vehicule", "en véhicule"]];

// Nombre de stagiaires évalués à une épreuve : le plus grand effectif d'un critère (la RPC epcf_moyennes rend
// [{ critere, moyenne, effectif }], l'effectif parfois en chaîne).
export function nbEvalues(moyennes) {
  return Math.max(0, ...(moyennes || []).map((x) => Number(x.effectif) || 0));
}

export function moyennesMontrables(moyennes) {
  return (moyennes || []).filter((x) => Number(x.effectif) >= SEUIL_MOYENNE_EPCF);
}

export function stagiairesEvalues(n) {
  if (!n) return "aucun stagiaire évalué";
  return n === 1 ? "1 stagiaire évalué" : `${n} stagiaires évalués`;
}

export function titreEpreuve(label, moyennes) {
  return `${label} : ${stagiairesEvalues(nbEvalues(moyennes))}`;
}

// Sous une épreuve qui n'a pas encore de moyenne, quand l'autre en a une.
export const PHRASE_SANS_MOYENNE = "La moyenne apparaîtra à partir de deux stagiaires évalués.";

// Ce que chaque contexte peut faire depuis la carte (contexteEtatVide de js/notes-saisie-rules.js) : le stagiaire va à
// ses propres résultats EPCF, le formateur évalue un stagiaire, la direction lit sans écrire.
const ACTIONS = {
  "classe-stagiaire": ["mon-epcf"],
  "classe-formateur": ["evaluer"],
  "equipe-matrice": ["evaluer"],
  "direction": [],
};

// Où mène chaque bouton. La page Stagiaires rouvre son dernier sous-onglet, parfois les élèves bénévoles (le bouton
// « Bénévoles » du Planning le mémorise) : `sousOnglet` est posé dans sa mémoire avant de partir, pour arriver sur la
// liste des stagiaires.
export const ACTIONS_CARTE_EPCF = {
  "mon-epcf": { libelle: "Voir mon EPCF", href: "#/mon-suivi/epcf" },
  evaluer: { libelle: "Évaluer un stagiaire", href: "#/stagiaires", sousOnglet: "stagiaires" },
};

// « Pour l'instant : 1 stagiaire évalué en salle, aucun en véhicule. » Les épreuves déjà commencées d'abord, pour que
// la phrase commence par un nombre ; null quand personne n'est évalué (la phrase de la carte suffit).
function avancement(moyennesParEpreuve) {
  const n = LIEUX.map(([cle, lieu]) => ({ lieu, n: nbEvalues(moyennesParEpreuve?.[cle]) }));
  const ordre = [...n.filter((e) => e.n > 0), ...n.filter((e) => e.n === 0)];
  if (!ordre[0].n) return null;
  const morceaux = ordre.map((e, i) => (i === 0 ? `${stagiairesEvalues(e.n)} ${e.lieu}` : `${e.n || "aucun"} ${e.lieu}`));
  return `Pour l'instant : ${morceaux.join(", ")}.`;
}

// La carte de l'état vide des moyennes EPCF : null dès qu'une épreuve a une moyenne montrable. L'avancement est pour
// l'équipe (formateur, direction), pas pour le stagiaire ; un contexte inconnu n'a ni bouton ni avancement.
export function etatVideEpcf({ moyennesParEpreuve, contexte }) {
  if (LIEUX.some(([cle]) => moyennesMontrables(moyennesParEpreuve?.[cle]).length)) return null;
  const connu = Object.prototype.hasOwnProperty.call(ACTIONS, contexte);
  return {
    titre: "Pas encore de moyennes EPCF",
    phrase: "Les moyennes de la classe apparaîtront dès que deux stagiaires auront passé la même épreuve, en salle ou en véhicule.",
    avancement: connu && contexte !== "classe-stagiaire" ? avancement(moyennesParEpreuve) : null,
    actions: connu ? ACTIONS[contexte].slice() : [],
  };
}
