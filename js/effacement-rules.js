// Règles pures de l'effacement des données (testées par tests/effacement-rules.test.mjs).
// Le serveur décide (fonctions anonymiser_* et purger_benevoles) ; ces règles ne servent
// qu'à l'affichage et à la confirmation.

import {
  phraseDeRefus, PHRASE_INDISPONIBLE, PHRASE_CONNEXION, PHRASE_SESSION, PHRASE_SANS_DROIT, PHRASE_ECHEC,
} from "./espaces-rules.js?v=20261111a";

// Confirmation par saisie du prénom : casse et espaces autour ignorés, accents exigés.
export function confirmationValide(saisie, prenom) {
  const a = String(saisie ?? "").trim().toLocaleLowerCase("fr");
  const b = String(prenom ?? "").trim().toLocaleLowerCase("fr");
  return b.length > 0 && a === b;
}

// « 2027-12-11 » → « 11/12/2027 ».
export function dateCourte(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// « 2027-12-11 » → « 11 décembre 2027 » : une date dans une phrase s'écrit en toutes lettres, comme ailleurs dans l'app
// (audit du 09/11, lot E). Le 1er du mois garde son ordinal.
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateLongue(iso) {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const j = Number(m[3]);
  return `${j === 1 ? "1er" : j} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

// Texte du bloc « Fin de promo » à partir de etat_anonymisation_promo().
// Rend { texte, bouton } : bouton vrai seulement quand l'anonymisation est possible ET utile.
export function etatFinDePromo(etat) {
  if (!etat) return { texte: "Aucune promo affichée.", bouton: false };
  const admins = Number(etat.comptes_admin || 0);
  const restants = Number(etat.restants || 0);
  const noteAdmins = admins > 0
    ? ` ${admins === 1 ? "Un compte administrateur reste" : admins + " comptes administrateurs restent"} nominatif${admins > 1 ? "s" : ""} : à traiter à part.`
    : "";
  if (!etat.date_fin) {
    return { texte: "Date de fin de promo non renseignée : l'anonymisation sera proposée 12 mois après la date de fin.", bouton: false };
  }
  if (!etat.anonymisable) {
    return {
      texte: `Fin de promo le ${dateLongue(etat.date_fin)} : les fiches pourront être anonymisées à partir du ${dateLongue(etat.anonymisable_le)} (12 mois après).`,
      bouton: false,
    };
  }
  if (restants - admins <= 0) {
    return { texte: "Les fiches de cette promo sont anonymisées." + noteAdmins, bouton: false };
  }
  const n = restants - admins;
  return {
    texte: `Les 12 mois après la fin de promo sont écoulés : ${n} fiche${n > 1 ? "s" : ""} à anonymiser.` + noteAdmins,
    bouton: true,
  };
}

// Phrase de compte rendu après un effacement (détails renvoyés par anonymiser_stagiaire).
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
  return parts.length
    ? "Effacé : " + parts.join(", ") + ". Les résultats restent, sans nom."
    : "Fiche anonymisée. Les résultats restent, sans nom.";
}

// --- Données personnelles du centre (suite du lot 5) : la direction anonymise les promos de son centre et purge ses élèves bénévoles
// sans passer par la promo affichée. Mêmes confirmations que chez le formateur (une seule définition de la question).

export const MOT_ANONYMISER = "ANONYMISER";
export const PHRASE_ETAT_INDISPONIBLE = "État indisponible pour le moment.";
export const PHRASE_DONNEES_ECHEC = "Les données personnelles du centre n'ont pas pu être chargées.";
export const PHRASE_SANS_PROMO_CENTRE = "Ce centre n'a encore aucune promo.";
export const PHRASE_SANS_BENEVOLE = "Aucun : tous les élèves enregistrés sont venus dans les 12 derniers mois.";

// La question posée avant d'anonymiser une promo (paramètres de demander() de js/confirmer.js) : la saisie du mot ANONYMISER.
export function questionAnonymiserPromo(nom) {
  return {
    titre: `Anonymiser toutes les fiches de « ${nom || "cette promo"} » ?`,
    phrase: "Comptes, e-mails, dates de naissance, livrets EPCF, dossiers professionnels et commentaires sont effacés ; "
      + "les résultats restent sans nom. Irréversible.",
    libelle: `Pour confirmer, tapez ${MOT_ANONYMISER}`,
    oui: "Anonymiser",
    verifier: (v) => String(v ?? "").trim() === MOT_ANONYMISER,
    erreur: "Saisie différente : rien n'est effacé.",
  };
}

// La question posée avant de supprimer n élèves bénévoles (paramètres de confirmer()).
export function questionPurgerBenevoles(n) {
  const k = Number(n) || 0;
  return {
    titre: `Supprimer ${k} élève${k > 1 ? "s" : ""} bénévole${k > 1 ? "s" : ""} et leurs coordonnées ?`,
    phrase: "Ils disparaissent aussi des anciens créneaux du planning. Irréversible.",
    oui: "Supprimer",
  };
}

// Phrases de compte rendu après l'effacement.
export function phraseAnonymises(n) {
  const k = Number(n) || 0;
  return `${k} fiche${k > 1 ? "s" : ""} anonymisée${k > 1 ? "s" : ""}.`;
}
export function phrasePurges(n) {
  const k = Number(n) || 0;
  return `${k} élève${k > 1 ? "s" : ""} bénévole${k > 1 ? "s" : ""} supprimé${k > 1 ? "s" : ""}.`;
}

// Les lignes de la section « Données personnelles » de la direction : une par promo du centre. `promos` : [{ id, nom, date_debut }] ;
// `etats` : { [id]: etat_anonymisation_promo(id) } pour les promos lues, et rien pour celles dont la lecture a échoué (la ligne le
// dit sans bloquer les autres). Les promos qui ont une anonymisation à faire passent d'abord, puis la plus récente d'abord.
export function lignesDonneesCentre(promos, etats) {
  const lus = etats && typeof etats === "object" ? etats : {};
  const lignes = (Array.isArray(promos) ? promos : []).map((p) => {
    const etat = lus[p.id];
    if (etat === undefined) return { promoId: p.id, nom: p.nom, debut: p.date_debut || "", texte: PHRASE_ETAT_INDISPONIBLE, bouton: false, indisponible: true };
    const fin = etatFinDePromo(etat);
    return { promoId: p.id, nom: p.nom, debut: p.date_debut || "", texte: fin.texte, bouton: fin.bouton, indisponible: false };
  });
  return lignes.sort((a, b) => Number(b.bouton) - Number(a.bouton) || String(b.debut).localeCompare(String(a.debut)) || a.promoId - b.promoId);
}

// La phrase d'une lecture qui échoue : celles qui ont leur phrase (droit, fonction absente avant la migration, réseau, session),
// sinon la phrase générique de la section. Jamais un texte technique.
export function phraseDePanne(e, generique = PHRASE_DONNEES_ECHEC) {
  const phrase = phraseDeRefus(e && e.message, e && e.code);
  return [PHRASE_INDISPONIBLE, PHRASE_CONNEXION, PHRASE_SESSION, PHRASE_SANS_DROIT].includes(phrase) ? phrase : generique;
}

// La phrase d'un effacement refusé : celle de la base quand elle en a une (« Anonymisation possible à partir du … »), sinon la phrase
// générique de la section.
export function phraseDEffacement(e) {
  const phrase = phraseDeRefus(e && e.message, e && e.code);
  return phrase === PHRASE_ECHEC ? PHRASE_DONNEES_ECHEC : phrase;
}
