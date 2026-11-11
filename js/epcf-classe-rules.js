// Règles pures des moyennes EPCF de la classe : combien de stagiaires sont évalués, quelles moyennes on peut montrer
// (k-anonymat), le titre d'une épreuve et la carte de l'état vide (une phrase et une action, comme les notes du lot C).
// Sans DOM ni base : testées par tests/epcf-classe-rules.test.mjs. Rendu : js/epcf-restitution.js (renderEpcfClasse)
// et js/views/epcf.js (renderEpcf).

// k-anonymat : la vue est affichée aussi aux stagiaires, donc la moyenne d'un critère n'est montrée que si AU MOINS
// 3 stagiaires ont ce critère. Avec un seul, la « moyenne » serait sa note ; avec deux, chacun retrouverait la note de
// l'autre à partir de la moyenne et de la sienne (décision de Timy du 10/11/2026). Même seuil dans la base
// (epcf_moyennes, migration 20261110_epcf_moyennes_seuil_3) ; les phrases ci-dessous l'écrivent en lettres.
export const SEUIL_MOYENNE_EPCF = 3;

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

// Le titre d'une épreuve sur la vue de la classe. Le nombre de stagiaires évalués n'est donné que si l'épreuve a une
// moyenne montrable : un stagiaire ne reçoit pas de la base les critères évalués chez moins de trois stagiaires, il lirait
// « aucun » à tort (peut-être en étant lui-même évalué). Le plus grand effectif d'un critère montrable est aussi le plus
// grand de tous : le nombre est le même pour l'équipe et pour les stagiaires.
export function titreEpreuve(label, moyennes) {
  const montrables = moyennesMontrables(moyennes);
  return montrables.length ? `${label} : ${stagiairesEvalues(nbEvalues(montrables))}` : label;
}

// Sous une épreuve qui n'a pas encore de moyenne, quand l'autre en a une.
export const PHRASE_SANS_MOYENNE = "La moyenne apparaîtra à partir de trois stagiaires évalués.";

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
  "mon-epcf": { libelle: "Voir mes évaluations EPCF", href: "#/mon-suivi/epcf" },
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
    phrase: "Les moyennes de la classe apparaîtront dès que trois stagiaires auront passé la même épreuve, en salle ou en véhicule.",
    avancement: connu && contexte !== "classe-stagiaire" ? avancement(moyennesParEpreuve) : null,
    actions: connu ? ACTIONS[contexte].slice() : [],
  };
}

// --- Fiche d'une personne, partie EPCF (Mon suivi, page Stagiaires) ---

// Radar de la fiche : la série « groupe » (moyenne de la classe par phase, sur 0..1) ne compte que les critères
// montrables. Un critère évalué chez moins de trois stagiaires n'entre pas dans une phase : sinon une phase qui n'a que
// lui montrerait sur son axe la note d'un camarade. null (pas de série) dès qu'une phase n'a aucun critère
// montrable : le radar tracerait ce sommet à 0, ce qui se lirait « le groupe est à 0 ».
export function scoresDuGroupe(sections, moyennes) {
  const montrables = moyennesMontrables(moyennes);
  if (!montrables.length) return null;
  const parCode = new Map(montrables.map((x) => [x.critere, Number(x.moyenne)]));
  const scores = (sections || []).map((s) => {
    const vals = s.criteres.map((c) => parCode.get(c.code)).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / (vals.length * 2) : null;
  });
  return scores.length && scores.every((v) => v !== null) ? scores : null;
}

// Où mène le bouton de la carte vide de la fiche : le livret EPCF de la personne (sa partie de Mon suivi).
export const ACTIONS_FICHE_EPCF = {
  livret: { libelle: "Voir mon livret EPCF", href: "#/mon-suivi/livret" },
};

// La partie EPCF d'une fiche quand aucune épreuve n'est évaluée (`nbEvaluations` : { salle, vehicule }), ou null dès
// qu'une l'est. Le formateur qui évalue (`outils`) a déjà ses lignes « à évaluer » et ses boutons : rien de plus
// ({ carte: false }). La personne elle-même (`soi`) lit une carte au tutoiement, avec son livret si le module est
// ouvert ; quelqu'un qui lit sans évaluer (la direction), la même carte à la troisième personne, sans bouton.
export function etatVideEpcfFiche({ nbEvaluations, soi = false, outils = false, livretOuvert = false }) {
  if (LIEUX.some(([cle]) => (Number(nbEvaluations?.[cle]) || 0) > 0)) return null;
  if (outils) return { carte: false };
  return {
    carte: true,
    titre: "Pas encore d'évaluation EPCF",
    phrase: (soi ? "Tes résultats apparaîtront ici après ta première épreuve"
      : "Ses résultats apparaîtront ici après sa première épreuve") + ", en salle ou en véhicule.",
    actions: soi && livretOuvert ? ["livret"] : [],
  };
}

// Sous le titre d'une épreuve pas encore évaluée, quand l'autre l'est.
export function phraseSansEvaluation(cle) {
  const lieu = (LIEUX.find(([c]) => c === cle) || [cle, "en " + cle])[1];
  return `Pas encore d'évaluation ${lieu}.`;
}
