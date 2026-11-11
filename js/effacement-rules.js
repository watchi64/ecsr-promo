// Règles pures de l'effacement des données (testées par tests/effacement-rules.test.mjs).
// Le serveur décide (fonctions de conservation de 20261110_conservation.sql et purger_benevoles) ; ces règles ne servent
// qu'à l'affichage et à la confirmation.

import {
  phraseDeRefus, PHRASE_INDISPONIBLE, PHRASE_CONNEXION, PHRASE_SESSION, PHRASE_SANS_DROIT, PHRASE_ECHEC,
} from "./espaces-rules.js?v=20261111m";
import { dateLongue } from "./dates.js?v=20261111m";
import { pluriel } from "./nombres.js?v=20261111m";

// Confirmation par saisie du prénom (ou du mot EFFACER) : casse et espaces autour ignorés, accents exigés. Les deux côtés
// sont mis sous la même forme Unicode (NFC) : un « é » tapé en deux signes (e + accent) vaut le « é » de la fiche. Rien
// d'attendu (prénom vide) : jamais valide.
const formeComparable = (t) => String(t ?? "").normalize("NFC").trim().toLocaleLowerCase("fr");
export function confirmationValide(saisie, prenom) {
  const b = formeComparable(prenom);
  return b.length > 0 && formeComparable(saisie) === b;
}

// ---------------------------------------------------------------------------------------------------------------------
// Conservation à 3 ans : échéances affichées sur la page Qualiopi (section « Conservation des données »).
// Entrée : la sortie de etat_conservation() ; le jour (« AAAA-MM-JJ », heure de Paris) vient de la base, jamais de
// l'appareil. Les nombres « à effacer » ne comptent jamais les comptes d'équipe.
// ---------------------------------------------------------------------------------------------------------------------
const MS_JOUR = 86400000;
function jourNum(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_JOUR : null;
}
const nombre = (v) => Number(v) || 0;

function noteEquipe(n) {
  const k = nombre(n);
  if (k <= 0) return "";
  return k === 1
    ? " Le compte d'équipe n'est jamais effacé et n'est pas compté."
    : ` Les ${k} comptes d'équipe ne sont jamais effacés et ne sont pas comptés.`;
}

// Accord d'une fiche ou de plusieurs : « 1 fiche perd son compte, sa fiche de suivi et ses textes », « 14 fiches perdent
// leur compte, leur fiche de suivi et leurs textes ». son : devant un nom masculin, sa : devant un nom féminin, ses : pluriel.
const accord = (n) => (n > 1
  ? { perd: "fiches perdent", son: "leur", sa: "leur", ses: "leurs" }
  : { perd: "fiche perd", son: "son", sa: "sa", ses: "ses" });

// Ce que chaque geste efface et ce qu'il laisse, dit en entier : la confirmation d'un clic irréversible les reprend mot pour
// mot (confirmationEcheance), la carte de l'échéance aussi.
export const CE_QUI_PART = {
  etape1: [
    "le compte de connexion et l'adresse e-mail",
    "la date de naissance",
    "la fiche de suivi",
    "les textes libres : commentaires des notes, des passages et de l'EPCF",
    "les observations et les adresses e-mail des stagiaires sur les feuilles d'émargement",
    "les commentaires écrits dans les questionnaires de satisfaction de la promo, et la liste de ceux qui y ont répondu",
  ],
  etape2: [
    "le nom et le prénom : chaque fiche devient « Anonyme » suivi d'un numéro",
    "le dossier professionnel",
    "le livret EPCF",
    "les dessins des signatures sur les feuilles d'émargement",
    "les noms et les signatures des formateurs sur ces feuilles : ils deviennent « Formateur 1 », « Formateur 2 »…",
    "les adresses e-mail encore inscrites sur les feuilles d'émargement, dont celles des formateurs",
    "les textes libres écrits depuis l'étape des 12 mois (commentaires des notes, des passages, de l'EPCF, observations d'émargement)",
    "les notes de 1 à 4 des questionnaires de la promo, remplacées par les pourcentages de la promo (s'il y a eu au moins 5 réponses)",
    "pour une fiche qui ne l'a pas encore eue, tout ce que retire l'étape des 12 mois",
  ],
  demande: [
    "le compte de connexion et l'adresse e-mail",
    "la date de naissance et la fiche de suivi",
    "les textes libres : commentaires des notes, des passages et de l'EPCF",
    "le dossier professionnel et le livret EPCF",
    "les observations, les adresses e-mail et les dessins des signatures sur les feuilles d'émargement",
    "le nom et le prénom : la fiche devient « Anonyme » suivi d'un numéro",
    "sa ligne dans la liste de ceux qui ont répondu aux questionnaires",
  ],
  cloture_formateurs: [
    "la liste des formateurs qui ont répondu",
  ],
  commentaires_formateurs: [
    "les commentaires libres des formateurs",
    "la liste des formateurs qui ont répondu, si elle est encore là",
  ],
  figeage_formateurs: [
    "les notes de 1 à 4 de chaque réponse",
    "ce qui reste des commentaires libres et de la liste des formateurs qui ont répondu",
  ],
};
export const CE_QUI_RESTE = {
  etape1: [
    "le nom et le prénom",
    "les résultats : notes, QCM, passages, scores EPCF",
    "le dossier professionnel et le livret EPCF",
    "les feuilles d'émargement : présence, heures et signatures",
    "les notes de 1 à 4 des questionnaires, sans nom ; les questionnaires de la promo ne peuvent plus être rouverts",
  ],
  etape2: [
    "les résultats (notes, QCM, passages, scores EPCF), sans nom",
    "les feuilles d'émargement : présence, heures et total d'heures ; chaque dessin effacé est remplacé par « Signature effacée (durée de conservation) »",
    "les pourcentages des questionnaires de la promo",
  ],
  demande: [
    "ses résultats, sans nom, dans les chiffres de la promo",
    "sa présence et ses heures sur les feuilles d'émargement passées, en « Anonyme » et un numéro, signature effacée",
    "sa réponse aux questionnaires, sans nom ; son commentaire part avec l'étape des 12 mois de la promo",
    "elle n'est pas comptée en abandon : le dossier de la formation écrit « fiche effacée à la demande de la personne »",
    "la fiche disparaît du planning à venir, des notes, des dés et des feuilles d'émargement à venir",
  ],
  cloture_formateurs: [
    "les réponses et les commentaires, sans nom",
    "le questionnaire de cette année ne peut plus être rouvert",
  ],
  commentaires_formateurs: [
    "les notes de 1 à 4, sans nom",
  ],
  figeage_formateurs: [
    "les pourcentages du centre, question par question, s'il y a eu au moins 3 réponses ; en dessous, aucun résultat n'est gardé",
  ],
};

// Échéances à afficher, passées d'abord (la plus en retard en tête), puis par date. Une échéance sans rien à faire n'est
// pas listée. restant : jours avant la date (0 le jour même, négatif en retard) ; bouton : libellé, ou null tant que la
// date n'est pas venue ou qu'il n'y a pas de date ; part, reste : les listes de CE_QUI_PART et CE_QUI_RESTE (vides pour le
// registre, qui a son propre bouton, et pour une promo sans date de fin).
export function echeancesConservation(etat) {
  const jour = jourNum(etat?.jour);
  const liste = [];
  const ajoute = (type, cible, du, texte, libelleBouton) => {
    const d = jourNum(du);
    const due = d !== null && jour !== null && jour >= d;
    liste.push({
      type, cible, du: du || null, due,
      restant: d !== null && jour !== null ? d - jour : null,
      texte, bouton: due ? libelleBouton : null,
      part: [...(CE_QUI_PART[type] || [])], reste: [...(CE_QUI_RESTE[type] || [])],
    });
  };

  for (const p of etat?.promos || []) {
    const cible = { kind: "promo", id: p.id, nom: p.nom, lieu_nom: p.lieu_nom };
    const nom = p.nom || "Cette promo";
    if (!p.date_fin) {
      liste.push({
        type: "date_fin_manquante", cible, du: null, due: false, restant: null, bouton: null, part: [], reste: [],
        texte: `${nom} : la date de fin n'est pas renseignée, donc aucune échéance de conservation ne peut être calculée. `
          + "Renseignez la date de fin de la promo.",
      });
      continue;
    }
    // Direction (Réglages du centre) : des activités de la promo sont datées après sa date de fin (fin_contredite_le, donnée par
    // etat_conservation_centre pour la direction seulement). La base refuse alors les deux étapes à la direction : aucun bouton, la
    // raison et la marche à suivre à la place. Rien à effacer : rien à dire.
    if (p.fin_contredite_le) {
      if (nombre(p.a_effacer_etape1) + nombre(p.a_effacer_etape2) + nombre(p.emargement_etape2) > 0) {
        liste.push({
          type: "fin_contredite", cible, du: null, due: false, restant: null, bouton: null, part: [], reste: [],
          texte: `${nom} : des activités de la promo sont datées après sa date de fin (le ${dateLongue(p.date_fin)}), jusqu'au `
            + `${dateLongue(p.fin_contredite_le)}. Les étapes ne se lancent pas ici. Si cette date de fin est fausse, corrigez-la ; `
            + "si elle est juste, demandez l'effacement au fondateur.",
        });
      }
      continue;
    }
    // La date de fin est dite : une date mal saisie (année fausse) avancerait les deux étapes.
    const fin = `formation finie le ${dateLongue(p.date_fin)}`;
    const n1 = nombre(p.a_effacer_etape1);
    if (n1 > 0) {
      const a = accord(n1);
      ajoute("etape1", cible, p.etape1_du,
        `${nom} (${fin}) : à partir du ${dateLongue(p.etape1_du)}, 12 mois après la fin de la formation, ${n1} ${a.perd} ${a.son} compte, `
        + `${a.ses} adresses e-mail, ${a.sa} fiche de suivi et ${a.ses} textes libres. Le nom, les résultats, le dossier professionnel, `
        + "le livret et les signatures restent." + noteEquipe(p.comptes_equipe),
        "Effacer les comptes et les textes");
    }
    const n2 = nombre(p.a_effacer_etape2);
    const e2 = nombre(p.emargement_etape2);
    if (n2 > 0) {
      const a = accord(n2);
      ajoute("etape2", cible, p.etape2_du,
        `${nom} (${fin}) : à partir du ${dateLongue(p.etape2_du)}, fin de la 3e année après la formation, ${n2} ${a.perd} ${a.son} nom, `
        + `${a.son} dossier professionnel, ${a.son} livret et ${a.ses} signatures ; sur les feuilles d'émargement, les formateurs deviennent `
        + "« Formateur 1 », « Formateur 2 »… Les résultats et les heures restent, sans nom." + noteEquipe(p.comptes_equipe),
        "Effacer les noms et les preuves");
    } else if (e2 > 0) {
      // Toutes les fiches sont déjà sans nom (effacées à la demande), mais les feuilles portent encore des signatures.
      ajoute("etape2", cible, p.etape2_du,
        `${nom} (${fin}) : à partir du ${dateLongue(p.etape2_du)}, fin de la 3e année après la formation, les signatures qui restent sur les `
        + "feuilles d'émargement sont effacées ; les formateurs y deviennent « Formateur 1 », « Formateur 2 »… Les heures restent.",
        "Effacer les noms et les preuves");
    }
  }

  // Rien sous le seuil (lot Q3) : la base ne donne les nombres d'une portée qu'à partir du seuil de répondants ; en
  // dessous, seuls les drapeaux a_participations, a_commentaires, a_reponses disent qu'il reste quelque chose, et le
  // texte ne cite aucun nombre.
  for (const f of etat?.portees_formateurs || []) {
    const lieu = f.lieu_nom || "Ce centre";
    const cible = { kind: "formateurs", lieu_id: f.lieu_id, lieu_nom: f.lieu_nom, annee: f.annee };
    const qui = `Questionnaire des formateurs ${f.annee}, ${lieu}`;
    const reste = (drapeau, n) => (typeof drapeau === "boolean" ? drapeau : nombre(n) > 0);
    const compte = (n, un, plu) => (typeof n === "number" && n > 0 ? ` (${pluriel(n, un, plu)})` : "");
    if (reste(f.a_participations, f.participations)) {
      ajoute("cloture_formateurs", cible, f.cloture_du,
        `${qui} : à partir du ${dateLongue(f.cloture_du)}, la liste de ceux qui ont répondu est effacée${compte(f.participations, "ligne", "lignes")}.`,
        "Effacer la liste des répondants");
    }
    if (reste(f.a_commentaires, f.commentaires)) {
      ajoute("commentaires_formateurs", cible, f.commentaires_du,
        `${qui} : à partir du ${dateLongue(f.commentaires_du)}, les commentaires libres sont effacés${compte(f.commentaires, "commentaire", "commentaires")}.`,
        "Effacer les commentaires");
    }
    if (!f.fige && reste(f.a_reponses, f.reponses)) {
      ajoute("figeage_formateurs", cible, f.figeage_du,
        `${qui} : à partir du ${dateLongue(f.figeage_du)}, les notes individuelles sont remplacées par les pourcentages du centre `
        + "(s'il y a eu au moins 3 réponses).",
        "Garder les pourcentages seulement");
    }
  }

  const r = etat?.registre;
  // Forme de la base : { a_effacer, a_clore, efface, prochaine_echeance }. Des entrées dues : échéance due aujourd'hui
  // (le jour de l'état). Sinon la prochaine échéance datée, sans bouton. a_clore n'a pas de ligne ici (rappel du registre).
  if (r && nombre(r.a_effacer) > 0) {
    ajoute("registre", { kind: "registre" }, etat.jour,
      `Registre qualité : ${pluriel(nombre(r.a_effacer), "entrée close depuis plus de 3 ans peut avoir ses textes vidés", "entrées closes depuis plus de 3 ans peuvent avoir leurs textes vidés")}.`,
      "Vider le registre");
  } else if (r && r.prochaine_echeance) {
    ajoute("registre", { kind: "registre" }, r.prochaine_echeance,
      `Registre qualité : à partir du ${dateLongue(r.prochaine_echeance)}, une entrée close depuis 3 ans peut avoir ses textes vidés.`,
      "Vider le registre");
  }

  // Passées d'abord (les plus en retard en tête), puis les futures par date ; à date égale, l'ordre d'arrivée.
  return liste
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.due !== b.e.due) return a.e.due ? -1 : 1;
      const da = jourNum(a.e.du), db = jourNum(b.e.du);
      if (da !== db) return (da ?? Infinity) - (db ?? Infinity);
      return a.i - b.i;
    })
    .map((x) => x.e);
}

// Statut affiché d'une fiche de stagiaire. La demande d'effacement prime sur tout le reste.
export function statutFiche(fiche, terminee, surDemande) {
  if (surDemande) return "Fiche effacée à la demande de la personne";
  if (fiche && fiche.actif === false) return "Abandon";
  return terminee ? "Formation suivie" : "En formation";
}

// Phrase de compte rendu après un effacement à la demande (détails renvoyés par effacer_sur_demande).
export function resumeEffacement(details) {
  const d = details || {};
  if (d.deja) return "Ces données étaient déjà effacées.";
  const parts = [];
  if (Number(d.comptes) > 0) parts.push("compte de connexion");
  if (Number(d.date_naissance) > 0) parts.push("date de naissance");
  if (Number(d.livret) > 0) parts.push("livret EPCF");
  if (Number(d.dossier_pro) > 0) parts.push("dossier professionnel");
  if (Number(d.fiche_suivi) > 0) parts.push("fiche de suivi");
  const n = Number(d.epcf_textes || 0) + Number(d.observations || 0) + Number(d.commentaires_passages || 0);
  if (n > 0) parts.push(n + " commentaire" + (n > 1 ? "s" : ""));
  // Nombre des commentaires de questionnaire donné par la base seulement à partir du seuil ; sinon le seul drapeau.
  const q = Number(d.commentaires_questionnaires || 0);
  if (q > 0) parts.push(q + " commentaire" + (q > 1 ? "s" : "") + " de questionnaire");
  else if (d.questionnaires_commentaires_effaces === true) parts.push("commentaires de questionnaire");
  const o = Number(d.emargement_observations || 0);
  if (o > 0) parts.push(o + " observation" + (o > 1 ? "s" : "") + " d'émargement");
  const g = Number(d.signatures || 0);
  if (g > 0) parts.push(g + " signature" + (g > 1 ? "s" : ""));
  return parts.length
    ? "Effacé : " + parts.join(", ") + ". Les résultats restent, sans nom."
    : "Fiche effacée. Les résultats restent, sans nom.";
}

// ---------------------------------------------------------------------------------------------------------------------
// Confirmations et comptes rendus de la section « Conservation des données ». Chaque geste est irréversible : la fenêtre
// dit exactement ce qui part et ce qui reste, et ne s'ouvre au geste qu'après une saisie (le mot EFFACER, ou le prénom de
// la personne pour une demande).
// ---------------------------------------------------------------------------------------------------------------------
export const MOT_DE_CONFIRMATION = "EFFACER";

function quiEcheance(e) {
  const c = e?.cible || {};
  if (c.kind === "formateurs") return `le questionnaire des formateurs ${c.annee}, ${c.lieu_nom || "ce centre"}`;
  return `« ${c.nom || "cette promo"} »`;
}

// La saisie d'une confirmation (js/confirmer.js, option `saisie`) : la consigne, le texte attendu, et la vérification
// (confirmationValide), que la fenêtre applique avant d'activer le bouton du geste.
function saisieAttendue(consigne, attendu) {
  return { consigne, attendu, verifier: (texte) => confirmationValide(texte, attendu) };
}

// La fenêtre d'une échéance due : { titre, phrase, part, reste, oui, saisie: { consigne, attendu, verifier } }, ou null pour
// une échéance qui ne se confirme pas ici (registre, sans date, pas encore due).
export function confirmationEcheance(e) {
  if (!e || !e.due || !e.bouton || !CE_QUI_PART[e.type]) return null;
  const titres = {
    etape1: `Effacer les comptes et les textes de ${quiEcheance(e)} ?`,
    etape2: `Effacer les noms et les preuves de ${quiEcheance(e)} ?`,
    cloture_formateurs: `Effacer la liste des répondants pour ${quiEcheance(e)} ?`,
    commentaires_formateurs: `Effacer les commentaires pour ${quiEcheance(e)} ?`,
    figeage_formateurs: `Ne garder que les pourcentages pour ${quiEcheance(e)} ?`,
  };
  return {
    titre: titres[e.type],
    phrase: e.texte + " Irréversible.",
    part: [...CE_QUI_PART[e.type]],
    reste: [...CE_QUI_RESTE[e.type]],
    oui: e.bouton,
    saisie: saisieAttendue(`Pour confirmer, tapez ${MOT_DE_CONFIRMATION}`, MOT_DE_CONFIRMATION),
  };
}

// La fenêtre d'un effacement à la demande de la personne (sa fiche : prénom, nom). Fiche sans prénom : on tape EFFACER.
export function confirmationDemande(fiche) {
  const prenom = String(fiche?.prenom ?? "").normalize("NFC").trim();
  const nomComplet = [prenom, String(fiche?.nom ?? "").trim()].filter(Boolean).join(" ") || "cette personne";
  return {
    titre: `Effacer les données de ${nomComplet} ?`,
    phrase: "À la demande de la personne : tout part tout de suite, sans attendre les dates de conservation, et sans la "
      + "déclarer en abandon. Irréversible.",
    part: [...CE_QUI_PART.demande],
    reste: [...CE_QUI_RESTE.demande],
    oui: "Effacer ses données",
    saisie: prenom
      ? saisieAttendue(`Pour confirmer, tapez son prénom : ${prenom}`, prenom)
      : saisieAttendue(`Pour confirmer, tapez ${MOT_DE_CONFIRMATION}`, MOT_DE_CONFIRMATION),
  };
}

// Phrase de compte rendu après une action de la section, à partir du retour de la base. Rien sous le seuil : les retours
// des formateurs ne donnent un nombre qu'à partir de 3 répondants, et cette phrase n'en cite aucun.
export function compteRenduConservation(type, r) {
  const d = r || {};
  if (type === "demande") return resumeEffacement(d);
  if (type === "etape1" || type === "etape2") {
    // Tout ce que la base dit parti est dit ; « Rien à effacer » seulement quand rien n'est parti. Commentaires des
    // questionnaires : leur nombre n'est donné par la base qu'à partir du seuil de réponses ; sinon le seul drapeau.
    const morceaux = [];
    const f = nombre(d.fiches);
    if (f > 0) morceaux.push(pluriel(f, "fiche traitée", "fiches traitées"));
    const textes = nombre(d.epcf_textes) + nombre(d.observations) + nombre(d.commentaires_passages)
      + nombre(d.emargement_observations);
    if (textes > 0) morceaux.push(pluriel(textes, "texte libre effacé", "textes libres effacés"));
    const q = nombre(d.commentaires_questionnaires);
    if (q > 0) morceaux.push(pluriel(q, "commentaire de questionnaire effacé", "commentaires de questionnaire effacés"));
    else if (d.questionnaires_commentaires_effaces === true) morceaux.push("commentaires des questionnaires effacés");
    const sig = nombre(d.signatures);
    if (sig > 0) morceaux.push(pluriel(sig, "signature effacée", "signatures effacées"));
    const sf = nombre(d.signatures_formateurs);
    if (sf > 0) morceaux.push(pluriel(sf, "signature de formateur effacée", "signatures de formateurs effacées"));
    if (nombre(d.emargement_emails) > 0) morceaux.push("adresses e-mail retirées des feuilles d'émargement");
    const fg = nombre(d.questionnaires_figes);
    if (fg > 0) morceaux.push(fg > 1 ? `${fg} questionnaires réduits à leurs pourcentages` : "1 questionnaire réduit à ses pourcentages");
    if (!morceaux.length) return "Rien à effacer : c'était déjà fait.";
    const suite = type === "etape1"
      ? "Le nom, les résultats, le dossier professionnel, le livret et les signatures restent."
      : "Les résultats et les heures restent, sans nom.";
    const phrase = morceaux.join(", ");
    return phrase.charAt(0).toUpperCase() + phrase.slice(1) + ". " + suite;
  }
  if (type === "cloture_formateurs" || type === "commentaires_formateurs") {
    return d.efface ? "C'est effacé." : "Rien à effacer : c'était déjà fait.";
  }
  if (type === "figeage_formateurs") {
    if (d.deja) return "C'était déjà fait : seuls les pourcentages restent.";
    if (d.vide) return "Aucune réponse à remplacer.";
    return d.sous_seuil
      ? "Réponses effacées. Moins de 3 réponses : aucun pourcentage n'est gardé."
      : "Réponses effacées : seuls les pourcentages du centre restent.";
  }
  return "C'est fait.";
}

// Ligne de rappel en tête de la page Qualiopi : les échéances passées qui attendent un clic, hors registre (il a son
// propre rappel) et hors promo sans date de fin. null quand il n'y en a pas.
export function rappelConservation(echeances) {
  const dues = (echeances || []).filter((e) => e.due && e.bouton && e.type !== "registre");
  if (!dues.length) return null;
  const plusAncienne = dues.reduce((a, e) => (a === null || (e.du && e.du < a) ? e.du : a), null);
  const depuis = plusAncienne ? ` (la plus ancienne depuis le ${dateLongue(plusAncienne)})` : "";
  return dues.length > 1
    ? `${dues.length} échéances de conservation des données sont passées${depuis} : rien ne part sans votre clic.`
    : `Une échéance de conservation des données est passée${depuis} : rien ne part sans votre clic.`;
}

// --- Données personnelles du centre (suite du lot 5) : la direction purge les élèves bénévoles de son centre sans passer par la
// promo affichée (même confirmation que chez le formateur), et lance les deux étapes de conservation des promos de son centre
// (20261111_conservation_direction : mêmes cartes et même confirmation que la page Qualiopi). L'effacement à la demande, le
// questionnaire des formateurs et le registre restent au fondateur, page Qualiopi. Réglages (formateurs) le dit par
// PHRASE_CONSERVATION ; les Réglages du centre présentent les échéances par PHRASE_CONSERVATION_CENTRE.

export const PHRASE_CONSERVATION = "La conservation des fiches est gérée par le fondateur, sur la page Qualiopi.";
export const PHRASE_CONSERVATION_CENTRE = "Les fiches des promos du centre : 12 mois après la fin d'une formation, les comptes et les "
  + "textes libres partent ; les noms et les preuves sont gardés jusqu'au 31 décembre de la troisième année après la fin. Rien ne "
  + "part tout seul : à chaque date, un bouton s'allume ici et attend votre clic. L'effacement à la demande d'une personne se fait "
  + "auprès du fondateur.";
export const PHRASE_SANS_ECHEANCE = "Aucune échéance : rien n'est à effacer pour le moment.";
export const PHRASE_DONNEES_ECHEC = "Les données personnelles du centre n'ont pas pu être chargées.";
export const PHRASE_SANS_BENEVOLE = "Aucun : tous les élèves enregistrés sont venus dans les 12 derniers mois.";

// La question posée avant de supprimer n élèves bénévoles (paramètres de confirmer()).
export function questionPurgerBenevoles(n) {
  const k = Number(n) || 0;
  return {
    titre: `Supprimer ${k} élève${k > 1 ? "s" : ""} bénévole${k > 1 ? "s" : ""} et leurs coordonnées ?`,
    phrase: "Ils disparaissent aussi des anciens créneaux du planning. Irréversible.",
    oui: "Supprimer",
  };
}

// Phrase de compte rendu après la purge.
export function phrasePurges(n) {
  const k = Number(n) || 0;
  return `${k} élève${k > 1 ? "s" : ""} bénévole${k > 1 ? "s" : ""} supprimé${k > 1 ? "s" : ""}.`;
}

// La phrase d'une lecture qui échoue : celles qui ont leur phrase (droit, fonction absente avant la migration, réseau, session),
// sinon la phrase générique de la section. Jamais un texte technique.
export function phraseDePanne(e, generique = PHRASE_DONNEES_ECHEC) {
  const phrase = phraseDeRefus(e && e.message, e && e.code);
  return [PHRASE_INDISPONIBLE, PHRASE_CONNEXION, PHRASE_SESSION, PHRASE_SANS_DROIT].includes(phrase) ? phrase : generique;
}

// La phrase d'un effacement refusé (la purge des bénévoles) : celle de la base quand elle en a une, sinon la phrase générique de la
// section.
export function phraseDEffacement(e) {
  const phrase = phraseDeRefus(e && e.message, e && e.code);
  return phrase === PHRASE_ECHEC ? PHRASE_DONNEES_ECHEC : phrase;
}
