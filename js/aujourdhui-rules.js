// « Aujourd'hui » du formateur (refonte, lot 2B) : les règles seulement. Le titre d'une carte selon les demi-journées
// qu'elle couvre, qui passe au tableau et qui conduit, où en est la feuille d'émargement du jour, ce qui attend le
// formateur, la ligne sous le titre. Module pur, sans DOM ni stockage : testé en node. Les cartes lues arrivent de
// journeeDuJour (js/journee-rules.js), qui a déjà appliqué les remplacements et retiré les absents sans remplaçant.
import { absentsDuPlanning, dayIndexDe, etatLigne, resumeSeance, deLaDemi } from "./emargement-rules.js?v=20261110d";
import { displayStagiaire, compareByNom } from "./utils.js?v=20261110d";

const ORDRE_DEMI = { matin: 0, aprem: 1 };

// « Au tableau ce matin », « cet après-midi », ou « aujourd'hui » quand les deux demi-journées sont concernées
// (ou aucune : le titre d'une carte vide reste dicible). Même règle pour « En voiture ».
export function titreSelonDemis(base, demis) {
  const vus = new Set(demis || []);
  const quand = vus.size === 1 ? (vus.has("matin") ? "ce matin" : "cet après-midi") : "aujourd'hui";
  return `${base} ${quand}`;
}

// Les cartes de la journée, demi-journée par demi-journée ; rien un jour de repos ou quand la journée n'est pas lue.
function cartesDuJour(journee) {
  if (!journee || journee.repos) return [];
  return (journee.demis || []).flatMap((d) => d.cartes.map((c) => ({ demi: d.demi, carte: c })));
}

// Qui passe au tableau : un pédagogue par groupe de chaque carte, son remplaçant s'il est absent, personne s'il est
// absent sans remplaçant. `sujet` : celui de son groupe sur une salle double (sujetsParGroupe de la carte), à défaut, ou
// quand son groupe n'a pas de sujet écrit, les sujets de la carte joints.
export function auTableauDuJour(journee) {
  const sortie = [];
  for (const { demi, carte } of cartesDuJour(journee)) {
    for (const t of carte.tableau || []) {
      if (sortie.some((x) => x.id === t.id && x.demi === demi)) continue;
      const duGroupe = carte.sujetsParGroupe?.[t.groupe] || [];
      const sujets = duGroupe.length ? duGroupe : (carte.sujets || []);
      sortie.push({ id: t.id, nom: t.nom, demi, sujet: sujets.join(" · ") });
    }
  }
  return sortie;
}

// Qui est en voiture : les conducteurs et les élèves bénévoles des cartes Voiture, chacun une fois ; `demis`, les
// demi-journées où quelqu'un conduit ou accompagne, dans l'ordre de la journée.
export function enVoitureDuJour(journee) {
  const stagiaires = [];
  const benevoles = [];
  const demis = new Set();
  for (const { demi, carte } of cartesDuJour(journee)) {
    if (carte.genre !== "voiture") continue;
    const conducteurs = carte.conducteurs || [];
    const accompagnants = carte.benevoles || [];
    if (!conducteurs.length && !accompagnants.length) continue;
    demis.add(demi);
    for (const c of conducteurs) if (!stagiaires.some((x) => x.id === c.id)) stagiaires.push({ id: c.id, nom: c.nom });
    for (const b of accompagnants) if (!benevoles.includes(b)) benevoles.push(b);
  }
  return { stagiaires, benevoles, demis: [...demis].sort((a, z) => ORDRE_DEMI[a] - ORDRE_DEMI[z]) };
}

// La feuille d'émargement dont parle la carte : la séance ouverte (le matin avant l'après-midi si les deux le sont), à
// défaut la dernière séance close du jour ; null sans feuille. `seances` : les séances du jour avec leurs lignes ;
// `stagiaires` : les stagiaires en formation ; `entries` : les cartes du planning de la semaine (un absent noté au
// planning n'attend pas). Les comptes sont ceux du bandeau : les stagiaires en formation, plus quiconque a une ligne
// sur la feuille (un abandon qui a signé reste compté) ; une feuille close est figée sur ses lignes.
export function feuilleDuJour({ seances, stagiaires, entries }) {
  const duJour = Array.isArray(seances) ? seances : [];
  const parDemi = (a, z) => ORDRE_DEMI[a.demi_journee] - ORDRE_DEMI[z.demi_journee];
  const ouvertes = duJour.filter((s) => s.statut === "ouverte").sort(parDemi);
  const closes = duJour.filter((s) => s.statut === "close").sort(parDemi);
  const seance = ouvertes[0] || closes[closes.length - 1] || null;
  if (!seance) return null;

  const ouverte = seance.statut === "ouverte";
  const liste = (Array.isArray(stagiaires) ? stagiaires : []).slice().sort(compareByNom);
  // Même lecture que le bandeau : une ligne légère (sans tracé) est signée dès qu'elle a une heure de signature.
  const lignes = seance.lignes.map((l) => ({ ...l, trace: l.signe_le ? "signé" : null }));
  const ids = new Set(lignes.map((l) => l.stagiaire_id));
  if (ouverte) liste.filter((s) => s.actif).forEach((s) => ids.add(s.id));
  const r = resumeSeance(lignes, [...ids], !ouverte);

  const absentsPlanning = absentsDuPlanning(entries, dayIndexDe(seance.jour), seance.demi_journee);
  const parId = new Map(lignes.map((l) => [l.stagiaire_id, l]));
  // « En attente » : ceux qui n'ont rien dit. Un absent noté (sur la feuille ou au planning) n'attend personne.
  const enAttente = ouverte
    ? liste.filter((s) => ids.has(s.id) && !absentsPlanning.has(s.id)
        && etatLigne({ ligne: parId.get(s.id) || null }).code === "attente").map(displayStagiaire)
    : [];
  // Les absents nommés (prévus au planning sans avoir signé, ou notés sur la feuille) : avec les signés et ceux qui
  // attendent, ils font le total, comme le résumé de la feuille (audit du 09/11, A1).
  const absents = ouverte
    ? liste.filter((s) => {
      if (!ids.has(s.id)) return false;
      const code = etatLigne({ ligne: parId.get(s.id) || null }).code;
      return code === "absent" || (code === "attente" && absentsPlanning.has(s.id));
    }).map(displayStagiaire)
    : [];
  return {
    seance, statut: seance.statut, signes: r.signes, total: r.total, enAttente, absents,
    titre: `Émargement ${deLaDemi(seance.demi_journee)}`,
  };
}

const compteValide = (n) => Number.isInteger(n) && n > 0;

// Ce qui attend le formateur dans Cours et QCM : une ligne par compte, avec le sous-onglet où le traiter. Un compte
// nul (lecture ratée), à zéro ou illisible n'a pas de ligne.
export function lignesATraiter({ signalements, propositionsIA } = {}) {
  const lignes = [];
  if (compteValide(signalements)) {
    lignes.push({
      cle: "signalements", nombre: signalements, sousOnglet: "signalements",
      titre: signalements === 1 ? "1 question contestée" : `${signalements} questions contestées`,
    });
  }
  if (compteValide(propositionsIA)) {
    lignes.push({
      cle: "ia", nombre: propositionsIA, sousOnglet: "ia",
      titre: propositionsIA === 1 ? "1 question proposée par l'IA" : `${propositionsIA} questions proposées par l'IA`,
    });
  }
  return lignes;
}

// La ligne sous le titre : la promo (lignePromo), puis « 14 stagiaires en formation ». Un compte qui n'a pas pu être
// lu (null) laisse la ligne sans lui.
export function ligneDeLEnTete(promo, enFormation) {
  const compte = Number.isInteger(enFormation) && enFormation >= 0
    ? `${enFormation} stagiaire${enFormation > 1 ? "s" : ""} en formation` : "";
  return [promo, compte].filter(Boolean).join(" · ");
}
