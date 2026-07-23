// Rôles PURS d'un stagiaire sur une carte de planning — spec
// docs/specs/2026-07-23-mon-suivi-creneaux-eleve-salle.md.
// Module sans dépendance : importé par mon-suivi.js, testable en node
// (tests/creneaux-rules.test.mjs).

const ACT_SALLE = "Pédagogie salle";
const ACT_VOITURE = "Voiture (conduite)";

// Ordre d'affichage à date/demi-journée/slot égaux : le passage du stagiaire
// se lit avant les demi-journées où il n'est qu'assis dans la salle.
export const ROLE_ORDER = { passage: 0, eleve: 1 };

// Élèves effectifs d'un groupe. Le groupe 2 n'existe que sur une carte double :
// sans cette garde, un `eleves_ids_2` laissé en base par une bascule 2 -> 1 groupe
// ressusciterait un rôle qui n'est plus dans le planning (même logique que
// effElevesIds() dans js/views/planning.js).
function elevesDuGroupe(e, group) {
  if (group === 2) return e.salle_double ? (e.eleves_ids_2 || []) : [];
  return e.eleves_ids || [];
}

// Rôles du stagiaire `id` sur la carte `e`. Une carte peut en produire deux :
// les règles de conflit autorisent le tableau du G1 à être élève du G2 (deux
// vagues successives dans la même demi-journée).
//   { role: "passage", type: "Salle" | "Voiture", sujet }
//   { role: "eleve",   type: "Élève salle",       waves: [{ tableau_id, sujet }] }
export function rolesPourEntry(e, id) {
  const out = [];
  if (!e || id == null) return out;

  if (e.activite === ACT_SALLE) {
    // Tableaux : G1 et G2 sont forcément deux personnes différentes (règle de
    // conflit), au plus une des deux branches peut donc s'appliquer.
    if (e.pedagogue_id === id) {
      out.push({ role: "passage", type: "Salle", sujet: e.sujet || null });
    } else if (e.salle_double && e.pedagogue_id_2 === id) {
      out.push({ role: "passage", type: "Salle", sujet: e.sujet_2 || null });
    }
    // Élève : une seule ligne par carte, une vague par groupe concerné.
    const waves = [];
    if (elevesDuGroupe(e, 1).includes(id)) {
      waves.push({ tableau_id: e.pedagogue_id ?? null, sujet: e.sujet || null });
    }
    if (elevesDuGroupe(e, 2).includes(id)) {
      waves.push({ tableau_id: e.pedagogue_id_2 ?? null, sujet: e.sujet_2 || null });
    }
    if (waves.length) out.push({ role: "eleve", type: "Élève salle", waves });
  } else if (e.activite === ACT_VOITURE) {
    // En voiture, `eleves_ids` = les stagiaires qui conduisent : c'est leur passage.
    if ((e.eleves_ids || []).includes(id)) {
      out.push({ role: "passage", type: "Voiture", sujet: e.sujet || null });
    }
  }
  return out;
}
