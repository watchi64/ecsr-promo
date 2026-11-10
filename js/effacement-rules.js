// Règles pures de l'effacement des données (testées par tests/effacement-rules.test.mjs).
// Le serveur décide (fonctions anonymiser_* et purger_benevoles) ; ces règles ne servent
// qu'à l'affichage et à la confirmation.

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
// COMPATIBILITÉ : à retirer en tâche 6/7 (la vue js/views/config.js l'importe encore ; la page Qualiopi la remplace).
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
const pluriel = (n, un, plu) => `${n} ${n > 1 ? plu : un}`;
const nombre = (v) => Number(v) || 0;

function noteEquipe(n) {
  const k = nombre(n);
  if (k <= 0) return "";
  return k === 1
    ? " Le compte d'équipe n'est jamais effacé et n'est pas compté."
    : ` Les ${k} comptes d'équipe ne sont jamais effacés et ne sont pas comptés.`;
}

// Échéances à afficher, passées d'abord (la plus en retard en tête), puis par date. Une échéance sans rien à faire n'est
// pas listée. restant : jours avant la date (0 le jour même, négatif en retard) ; bouton : libellé, ou null tant que la
// date n'est pas venue ou qu'il n'y a pas de date.
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
    });
  };

  for (const p of etat?.promos || []) {
    const cible = { kind: "promo", id: p.id, nom: p.nom, lieu_nom: p.lieu_nom };
    const nom = p.nom || "Cette promo";
    if (!p.date_fin) {
      liste.push({
        type: "date_fin_manquante", cible, du: null, due: false, restant: null, bouton: null,
        texte: `${nom} : la date de fin n'est pas renseignée, donc aucune échéance de conservation ne peut être calculée. `
          + "Renseigne la date de fin de la promo.",
      });
      continue;
    }
    const n1 = nombre(p.a_effacer_etape1);
    if (n1 > 0) {
      ajoute("etape1", cible, p.etape1_du,
        `${nom} : à partir du ${dateLongue(p.etape1_du)}, 12 mois après la fin de la formation, ${pluriel(n1, "fiche perd", "fiches perdent")} `
        + "son compte, son e-mail, sa date de naissance, sa fiche de suivi et ses commentaires. Le nom, les résultats, le dossier "
        + "professionnel et le livret restent." + noteEquipe(p.comptes_equipe),
        "Effacer les comptes et les textes");
    }
    const n2 = nombre(p.a_effacer_etape2);
    if (n2 > 0) {
      ajoute("etape2", cible, p.etape2_du,
        `${nom} : à partir du ${dateLongue(p.etape2_du)}, fin de la 3e année après la formation, ${pluriel(n2, "fiche perd", "fiches perdent")} `
        + "son nom, son dossier professionnel, son livret et ses signatures. Les résultats restent, sans nom." + noteEquipe(p.comptes_equipe),
        "Effacer les noms et les preuves");
    }
  }

  for (const f of etat?.portees_formateurs || []) {
    const lieu = f.lieu_nom || "Ce lieu";
    const cible = { kind: "formateurs", lieu_id: f.lieu_id, lieu_nom: f.lieu_nom, annee: f.annee };
    const qui = `Questionnaire des formateurs ${f.annee}, ${lieu}`;
    const np = nombre(f.participations);
    if (np > 0) {
      ajoute("cloture_formateurs", cible, f.cloture_du,
        `${qui} : à partir du ${dateLongue(f.cloture_du)}, la liste de ceux qui ont répondu est effacée (${pluriel(np, "ligne", "lignes")}).`,
        "Effacer la liste des répondants");
    }
    const nc = nombre(f.commentaires);
    if (nc > 0) {
      ajoute("commentaires_formateurs", cible, f.commentaires_du,
        `${qui} : à partir du ${dateLongue(f.commentaires_du)}, les commentaires libres sont effacés (${pluriel(nc, "commentaire", "commentaires")}).`,
        "Effacer les commentaires");
    }
    if (!f.fige && nombre(f.reponses) > 0) {
      ajoute("figeage_formateurs", cible, f.figeage_du,
        `${qui} : à partir du ${dateLongue(f.figeage_du)}, les notes individuelles sont remplacées par les pourcentages du lieu `
        + "(s'il y a eu au moins 3 réponses).",
        "Garder les pourcentages seulement");
    }
  }

  const r = etat?.registre;
  if (r && nombre(r.a_effacer) > 0) {
    ajoute("registre", { kind: "registre" }, r.du,
      `Registre qualité : à partir du ${dateLongue(r.du)}, ${pluriel(nombre(r.a_effacer), "entrée close depuis plus de 3 ans a ses textes vidés", "entrées closes depuis plus de 3 ans ont leurs textes vidés")}.`,
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

// Phrase de compte rendu après un effacement (détails renvoyés par anonymiser_stagiaire).
export function resumeEffacement(details) {
  const d = details || {};
  if (d.deja) return "Ces données étaient déjà effacées.";
  const parts = [];
  if (Number(d.comptes) > 0) parts.push("compte de connexion");
  if (Number(d.date_naissance) > 0) parts.push("date de naissance");
  if (Number(d.livret) > 0) parts.push("livret");
  if (Number(d.dossier_pro) > 0) parts.push("dossier pro");
  if (Number(d.fiche_suivi) > 0) parts.push("fiche de suivi");
  const n = Number(d.epcf_textes || 0) + Number(d.observations || 0) + Number(d.commentaires_passages || 0);
  if (n > 0) parts.push(n + " commentaire" + (n > 1 ? "s" : ""));
  const q = Number(d.commentaires_questionnaires || 0);
  if (q > 0) parts.push(q + " commentaire" + (q > 1 ? "s" : "") + " de questionnaire");
  const o = Number(d.emargement_observations || 0);
  if (o > 0) parts.push(o + " observation" + (o > 1 ? "s" : "") + " d'émargement");
  const g = Number(d.signatures || 0);
  if (g > 0) parts.push(g + " signature" + (g > 1 ? "s" : ""));
  return parts.length
    ? "Effacé : " + parts.join(", ") + ". Les résultats restent, sans nom."
    : "Fiche anonymisée. Les résultats restent, sans nom.";
}
