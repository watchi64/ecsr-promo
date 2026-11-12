// Lecture de la semaine du planning pour les pages qui la montrent sans l'éditer (Accueil,
// Aujourd'hui, grille de la semaine) : charge, normalise, nomme. Les règles de lecture vivent
// dans js/journee-rules.js (pur) ; ce module n'est que le branchement sur la base.
import {
  getPlanning, getHalfMetaForWeek, getJoursOff, listStagiaires, listProfs, listThemes, listBenevolesNoms,
} from "./db.js?v=20261112c";
import { displayStagiaire, nomLisible } from "./utils.js?v=20261112c";

// Nom de chaque stagiaire, id → « Lucie M. » : toujours le format complet de tous les écrans (décision du 10/11),
// comme l'impression du planning. Plus de prénom seul : le format ne change plus quand un homonyme arrive.
export function nomsStagiaires(liste) {
  return new Map(liste.map((s) => [s.id, displayStagiaire(s)]));
}

// Nom d'un élève bénévole lu par la fonction benevoles_noms de la base, qui l'écrit encore « M. Pierre » (initiale du
// nom, point, prénom) : remis au format des écrans, « Pierre M. ». Un nom sans initiale en tête reste tel quel.
export function nomBenevole(display) {
  return nomLisible(display);
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
      benevoles: new Map((benevoles || []).map((b) => [b.id, nomBenevole(b.display)])),
      autres,
      titres: (themes || []).map((t) => t.titre),
    },
  };
}
