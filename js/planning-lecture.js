// Lecture de la semaine du planning pour les pages qui la montrent sans l'éditer (Accueil,
// Aujourd'hui, grille de la semaine) : charge, normalise, nomme. Les règles de lecture vivent
// dans js/journee-rules.js (pur) ; ce module n'est que le branchement sur la base.
import {
  getPlanning, getHalfMetaForWeek, getJoursOff, listStagiaires, listProfs, listThemes, listBenevolesNoms,
} from "./db.js?v=20261109d";
import { displayStagiaire } from "./utils.js?v=20261109d";

export { lundiEnCours } from "./journee-rules.js?v=20261109d";

// Prénom seul, sauf s'il est porté par au moins deux stagiaires : « Initiale. Prénom », comme
// l'impression du planning.
export function nomsStagiaires(liste) {
  const compte = {};
  liste.forEach((s) => {
    const p = (s.prenom || "").trim().toLowerCase();
    if (p) compte[p] = (compte[p] || 0) + 1;
  });
  return new Map(liste.map((s) => {
    const p = (s.prenom || "").trim().toLowerCase();
    return [s.id, (p && compte[p] >= 2) ? displayStagiaire(s) : (s.prenom || displayStagiaire(s))];
  }));
}

// `{ entries, metas, joursOff, noms }` de la semaine du lundi donné. `noms` est la forme
// attendue par journeeDuJour, plus `titres` (titres de thèmes, pour recoller les sujets dont le
// titre contient une virgule). Un nom de bénévole ou un thème illisible n'empêche rien.
export async function chargerSemaine(lundiIso) {
  const [data, metas, offs, stagiaires, profs, benevoles, themes] = await Promise.all([
    getPlanning(lundiIso),
    getHalfMetaForWeek(lundiIso),
    getJoursOff(lundiIso),
    listStagiaires({ includeInactive: true }),
    listProfs(),
    listBenevolesNoms().catch(() => []),
    listThemes().catch(() => []),
  ]);
  const entries = (data || []).map((row) => {
    // Compat ascendante, comme loadPlanning : prof_ids vide mais prof_id présent.
    let prof_ids = row.prof_ids;
    if ((!prof_ids || prof_ids.length === 0) && row.prof_id) prof_ids = [row.prof_id];
    return { ...row, prof_ids: prof_ids || [] };
  });
  const autres = [...new Set(entries.map((e) => e.prof_autre).filter(Boolean))];
  return {
    entries,
    metas: metas || [],
    joursOff: offs || [],
    noms: {
      stagiaires: nomsStagiaires(stagiaires || []),
      formateurs: new Map((profs || []).map((p) => [p.id, p.nom])),
      benevoles: new Map((benevoles || []).map((b) => [b.id, b.display])),
      autres,
      titres: (themes || []).map((t) => t.titre),
    },
  };
}
