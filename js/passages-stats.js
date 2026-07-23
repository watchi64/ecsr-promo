// Compteurs PURS des passages effectués d'un stagiaire, affichés dans l'espace perso.
// Même règle d'équité que partout ailleurs (compteDansEquite) : Effectué + Absence
// comptent, Bonus/Report non. Module sans DOM ni réseau, testé en node
// (tests/passages-stats.test.mjs), sur le modèle de creneaux-rules.js.
import { compteDansEquite } from "./passage-rules.js?v=20260723g";

// rows : lignes de la table passages ({type, resultat, avec_eleve, prof_id}).
// Retourne { salle, voiture, avecEleve, byProf } ; byProf ne concerne que la voiture.
export function statsPassages(rows) {
  const out = { salle: 0, voiture: 0, avecEleve: 0, byProf: {} };
  (rows || []).forEach((p) => {
    if (!compteDansEquite(p.resultat)) return;
    if (p.type === "Salle") { out.salle++; return; }
    if (p.type !== "Voiture") return;
    out.voiture++;
    if (p.avec_eleve === true) out.avecEleve++;
    if (p.prof_id != null) out.byProf[p.prof_id] = (out.byProf[p.prof_id] || 0) + 1;
  });
  return out;
}
