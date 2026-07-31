// Stub de base pour le banc d'essai du Dossier Professionnel.
// Injecté à la place de js/db.js par l'import map de _preview_dp_vue.html :
// aucune requête réseau, aucune écriture dans la base de production.
//
// Les dossiers vivent en mémoire pour la durée de la page ; window.__db expose
// leur contenu pour permettre une vérification automatisée de l'autosave.

const stagiaires = [
  { id: 15, prenom: "Timy", nom: "Valdivia", actif: true },
  { id: 3, prenom: "Sophie", nom: "Bernard", actif: true },
  { id: 7, prenom: "Karim", nom: "Alaoui", actif: true },
];

// Dossier déjà commencé pour Sophie (id 3) : sert la liste formateur.
const dossiers = new Map([
  [3, {
    id: 1, stagiaire_id: 3, updated_at: "2026-07-29T10:00:00Z", updated_by_who: "Sophie Bernard",
    data: {
      nom_usage: "BERNARD", prenom: "Sophie", modalite_formation: true,
      at1_ex1_titre: "Séance collective sur la signalisation",
      at1_ex1_taches: "Animation d'une séance collective auprès de 8 apprenants.",
      dh_nom: "Sophie BERNARD",
    },
  }],
]);

export async function listStagiaires() { return stagiaires.map((s) => ({ ...s })); }

export async function listDpDossiers() {
  return [...dossiers.values()].map(({ id, stagiaire_id, data, updated_at }) =>
    ({ id, stagiaire_id, data, updated_at }));
}

export async function getDpDossier(stagiaireId) {
  const row = dossiers.get(Number(stagiaireId));
  return row ? JSON.parse(JSON.stringify(row)) : null;
}

export async function upsertDpDossier({ stagiaire_id, data, updated_by_who }) {
  const row = {
    id: dossiers.get(stagiaire_id)?.id || dossiers.size + 1,
    stagiaire_id, data, updated_by_who,
    updated_at: new Date().toISOString(),
  };
  dossiers.set(Number(stagiaire_id), row);
  window.__db = { dossiers: [...dossiers.values()], dernierUpsert: row, upserts: (window.__db?.upserts || 0) + 1 };
  return row;
}

window.__db = { dossiers: [...dossiers.values()], dernierUpsert: null, upserts: 0 };
