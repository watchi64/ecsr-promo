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
      texte: `Fin de promo le ${dateCourte(etat.date_fin)} : les fiches pourront être anonymisées à partir du ${dateCourte(etat.anonymisable_le)} (12 mois après).`,
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
  if (Number(d.livret) > 0) parts.push("livret");
  if (Number(d.dossier_pro) > 0) parts.push("dossier pro");
  if (Number(d.fiche_suivi) > 0) parts.push("fiche de suivi");
  const n = Number(d.epcf_textes || 0) + Number(d.observations || 0) + Number(d.commentaires_passages || 0);
  if (n > 0) parts.push(n + " commentaire" + (n > 1 ? "s" : ""));
  return parts.length
    ? "Effacé : " + parts.join(", ") + ". Les résultats restent, sans nom."
    : "Fiche anonymisée. Les résultats restent, sans nom.";
}
