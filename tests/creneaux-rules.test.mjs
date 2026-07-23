import assert from "node:assert/strict";
import { rolesPourEntry, ROLE_ORDER } from "../js/creneaux-rules.js";

const ME = 7, AUTRE = 8, TIERS = 9;

// --- Passages existants (comportement conservé) ---

// Tableau G1 : passage Salle avec le sujet du G1.
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", pedagogue_id: ME, sujet: "Croisement" }, ME),
  [{ role: "passage", type: "Salle", sujet: "Croisement" }]);

// Tableau G2 d'une carte double : passage Salle avec sujet_2.
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", salle_double: true,
                   pedagogue_id: AUTRE, pedagogue_id_2: ME, sujet: "A", sujet_2: "B" }, ME),
  [{ role: "passage", type: "Salle", sujet: "B" }]);

// Voiture : eleves_ids = ceux qui conduisent.
assert.deepEqual(
  rolesPourEntry({ activite: "Voiture (conduite)", eleves_ids: [ME, AUTRE] }, ME),
  [{ role: "passage", type: "Voiture", sujet: null }]);

// --- Nouveau : élève en salle ---

// Carte simple : une ligne élève, une vague, avec le tableau et le sujet.
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", pedagogue_id: AUTRE,
                   sujet: "Croisement", eleves_ids: [ME, TIERS] }, ME),
  [{ role: "eleve", type: "Élève salle",
     waves: [{ tableau_id: AUTRE, sujet: "Croisement" }] }]);

// Carte 2 groupes, élève des deux vagues : UNE ligne, deux vagues.
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", salle_double: true,
                   pedagogue_id: AUTRE, pedagogue_id_2: TIERS, sujet: "A", sujet_2: "B",
                   eleves_ids: [ME], eleves_ids_2: [ME] }, ME),
  [{ role: "eleve", type: "Élève salle",
     waves: [{ tableau_id: AUTRE, sujet: "A" }, { tableau_id: TIERS, sujet: "B" }] }]);

// Tableau G1 ET élève G2 : deux lignes distinctes (deux vagues successives).
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", salle_double: true,
                   pedagogue_id: ME, pedagogue_id_2: AUTRE, sujet: "A", sujet_2: "B",
                   eleves_ids: [TIERS], eleves_ids_2: [ME] }, ME),
  [{ role: "passage", type: "Salle", sujet: "A" },
   { role: "eleve", type: "Élève salle", waves: [{ tableau_id: AUTRE, sujet: "B" }] }]);

// Tableau non encore placé : la vague existe, tableau_id null.
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", sujet: null, eleves_ids: [ME] }, ME),
  [{ role: "eleve", type: "Élève salle", waves: [{ tableau_id: null, sujet: null }] }]);

// --- Rôles résiduels en base : jamais ressuscités ---

// eleves_ids_2 sans salle_double (bascule 2 -> 1 groupe) : groupe 2 ignoré.
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", pedagogue_id: AUTRE,
                   eleves_ids: [TIERS], eleves_ids_2: [ME] }, ME),
  []);

// pedagogue_id_2 sans salle_double : pas de passage G2.
assert.deepEqual(
  rolesPourEntry({ activite: "Pédagogie salle", pedagogue_id: AUTRE, pedagogue_id_2: ME }, ME),
  []);

// Activité changée : les rôles restés en base ne produisent rien.
assert.deepEqual(rolesPourEntry({ activite: "Cours", eleves_ids: [ME], pedagogue_id: ME }, ME), []);
assert.deepEqual(rolesPourEntry({ activite: "Contrôle", eleves_ids: [ME] }, ME), []);

// --- Garde-fous ---

assert.deepEqual(rolesPourEntry(null, ME), []);
assert.deepEqual(rolesPourEntry({ activite: "Pédagogie salle", eleves_ids: [ME] }, null), []);
assert.deepEqual(rolesPourEntry({ activite: "Pédagogie salle", pedagogue_id: AUTRE }, ME), []);

// Tri : passage avant élève.
assert.ok(ROLE_ORDER.passage < ROLE_ORDER.eleve);

console.log("creneaux-rules : 15 assertions OK");
