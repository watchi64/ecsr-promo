// Règles pures des demandes de l'espace contact : le routage d'une demande, miroir exact de _contact_destinataires et de
// _contact_possibles (migration 20261115_contact_2_demandes.sql). Une même table de cas (tests/fixtures/contact-routage.json) est jouée
// ici (tests/contact-rules.test.mjs) et dans la preuve SQL (tests/sql/contact-demandes-preuve.sql, groupe parite) : un écart rougit les deux.
// Entrées et sorties en snake_case, comme la table de cas (l'écran adapte).
// Lancer : node tests/contact-rules.test.mjs

import { enConge } from "./contact-annuaire-rules.js";

// Ordre des fiches : identifiants numériques par valeur, sinon par points de code (l'ordre « C » de la base pour la table de cas).
function comparer(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// Une fiche peut-elle recevoir une demande dans ce centre ce jour-là ? Du centre, joignable (un compte ou un e-mail), pas en congé,
// pas partie (date de départ passée). Une fiche inconnue ne le peut pas.
function disponible(fiche, jour) {
  if (!fiche) return false;
  if (fiche.du_centre === false || fiche.joignable === false) return false;
  if (enConge(fiche, jour)) return false;
  if (fiche.depart_le && fiche.depart_le < jour) return false;
  return true;
}

/**
 * Le routage d'une demande. Entrées :
 *   type                le type de la demande (absence, retard, administratif, document, autre)
 *   financement_id      le financement du stagiaire (nul : aucun)
 *   jours               [{ jour, demi }] (absence et retard ; sert au planning, que formateurs_du_jour résume déjà)
 *   aujourdhui          le jour de création (AAAA-MM-JJ, jour de Paris) : il juge le congé et le départ
 *   regles              [{ type, financement_id, cible: "fiche"|"formateurs_du_jour", fiche_id }] du centre ; type « defaut » :
 *                       la personne par défaut
 *   fiches              [{ fiche_id, nom, du_centre, joignable, conge_du, conge_au, depart_le, relais_id }] (du_centre et joignable
 *                       vrais par défaut)
 *   formateurs_du_jour  les fiches du centre rattachées aux formateurs du planning de `jours`
 *   possibles           les fiches de l'équipe de la promo (formateurs à titre fixe, direction réelle du centre)
 * Sortie : { mode: "regle"|"choix", principaux: [{ fiche_id, relais_de }], source, possibles: [{ fiche_id, pre_coche }] }.
 * Règle (type et financement), sinon règle (type), sinon personne par défaut. Une fiche indisponible passe à son relais s'il est
 * disponible (relais_de : le nom de la titulaire), sinon à la personne par défaut si elle est disponible ; la règle « formateurs du
 * jour » sans formateur disponible passe à la personne par défaut. Personne : mode choix (source nulle), et les possibles, pré-cochés
 * pour les formateurs du jour. En mode règle, aucun possible : le stagiaire ne choisit pas.
 */
export function routerDemande({ type, financement_id = null, aujourdhui, regles = [], fiches = [], formateurs_du_jour = [],
  possibles = [] } = {}) {
  const parId = new Map((fiches ?? []).map((f) => [f.fiche_id, f]));
  const dispo = (id) => disponible(parId.get(id), aujourdhui);
  const fdj = [...new Set(formateurs_du_jour ?? [])];
  const regle = (t, fin) => (regles ?? []).find((r) => r.type === t && (r.financement_id ?? null) === fin);

  let r = null;
  let source = null;
  if (financement_id != null) {
    r = regle(type, financement_id);
    if (r) source = "regle_type_financement";
  }
  if (!r) {
    r = regle(type, null);
    if (r) source = "regle_type";
  }
  const defaut = regle("defaut", null);
  if (!r && defaut) {
    r = defaut;
    source = "defaut";
  }

  let principaux = [];
  const versDefaut = () => {
    source = "defaut";
    return defaut && dispo(defaut.fiche_id) ? [{ fiche_id: defaut.fiche_id, relais_de: null }] : [];
  };
  if (r && r.cible === "formateurs_du_jour") {
    principaux = fdj.filter(dispo).map((id) => ({ fiche_id: id, relais_de: null }));
    if (principaux.length === 0) principaux = versDefaut();
  } else if (r) {
    const titulaire = parId.get(r.fiche_id);
    if (dispo(r.fiche_id)) {
      principaux = [{ fiche_id: r.fiche_id, relais_de: null }];
    } else if (titulaire && titulaire.relais_id != null && dispo(titulaire.relais_id)) {
      principaux = [{ fiche_id: titulaire.relais_id, relais_de: titulaire.nom ?? null }];
    } else {
      principaux = versDefaut();
    }
  }
  principaux.sort((a, b) => comparer(a.fiche_id, b.fiche_id));

  if (principaux.length > 0) return { mode: "regle", principaux, source, possibles: [] };
  const choix = [...new Set(possibles ?? [])].sort(comparer).map((id) => ({ fiche_id: id, pre_coche: fdj.includes(id) }));
  return { mode: "choix", principaux: [], source: null, possibles: choix };
}
