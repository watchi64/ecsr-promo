// Recoupement des chiffres du réseau (lot 5, Task 16) : les comptes que la base envoie au siège (comptes_reseau(), une ligne par centre)
// sont recalculés avec le code de l'app (celui de la direction : indicateursPromo, comptesDepuisIndicateurs) à partir des données brutes
// des promos en cours de chaque centre, puis comparés.
//
//   node outils/recouper_comptes.mjs <brut.json> <comptes.json>
//
// brut.json : { "aujourdhui": "AAAA-MM-JJ", "referentiel": { "qcm": [...], "themes": [...] },
//               "promos": [ { "promo_id": 1, "lieu_id": 1, "date_debut": "AAAA-MM-JJ", "date_fin": "AAAA-MM-JJ" | null,
//                             "donnees": { "stagiaires": [], "passages": [], "evaluations": [], "tentatives": [], "epcf": [] } } ] }
//   « donnees » a la forme que lireDonneesCentre rend pour une promo ; seules les promos en cours à « aujourdhui » comptent.
// comptes.json : le résultat de comptes_reseau() tel que la base le rend (un tableau de lignes en colonnes de la base : lieu_id, lieu_nom,
//   demonstration, promos_en_cours, masque, inscrits, en_formation, abandons, absences, prevus, qcm_bonnes, qcm_questions, examens_passes,
//   examens_reussis, notes_n, notes_somme, notes_sous10, epcf_acquis, epcf_renseignes).
//
// Date du jour : « aujourdhui » est celle de la BASE (current_date, UTC chez Supabase), pas celle de Paris où l'app compte les promos
// en cours. Entre minuit et 1 h ou 2 h à Paris, une promo qui commence ou finit ce jour-là est comptée d'un côté et pas de l'autre :
// pour un recoupement juste, extraire « aujourdhui » avec `select current_date` sur la base, jamais avec l'horloge de la machine.
//
// Pour chaque centre : comptesDepuisIndicateurs(indicateursPromo(concatenerDonnees(promos en cours du centre))) est comparé à la ligne de même
// lieu_id (champ par champ, notes à 1e-9 près). Un centre masqué n'envoie aucun chiffre : on vérifie seulement que le calcul de l'app donne
// moins de SEUIL_SECRET stagiaires en formation. Sortie : « identiques », ou un écart par ligne ; code 0 sans écart, 1 au moindre écart,
// 2 si les fichiers sont illisibles. Ne lit jamais la base : il ne voit que les deux fichiers qu'on lui donne.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { indicateursPromo } from "../js/centre-stats.js";
import { CHAMPS_COMPTES, SEUIL_SECRET, comptesDepuisIndicateurs, concatenerDonnees, promosEnCours, versComptes } from "../js/comptes-reseau.js";

const TOLERANCE = 1e-9;
const COLONNE = (champ) => champ.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());

// Recoupe le brut et les comptes de la base. Rend { ecarts: [phrases], centres, masques }.
export function recouper(brut, comptes) {
  const ecarts = [];
  const aujourdhui = brut.aujourdhui;
  const referentiel = brut.referentiel || { qcm: [], themes: [] };
  const lignes = (comptes || []).map((l) => versComptes(l));
  const lieuxDuBrut = [...new Set((brut.promos || []).map((p) => p.lieu_id))];
  let masques = 0;

  for (const l of lignes) {
    const nom = l.lieuNom || "centre " + l.lieuId;
    const duCentre = (brut.promos || []).filter((p) => p.lieu_id === l.lieuId);
    // Un centre sans aucune promo dans le brut (centre tout juste créé, ou dont aucune promo n'a été extraite) n'a pas de promo en
    // cours : comptes_reseau() l'envoie avec promos_en_cours à 0, masqué et sans chiffre (versComptes lit un chiffre absent comme 0).
    // C'est le cas « aucune promo en cours » ci-dessous, pas un écart.
    const enCours = promosEnCours(duCentre, aujourdhui);
    if (enCours.length !== l.promosEnCours) {
      ecarts.push(`${nom} : promos en cours : ${enCours.length} d'après le brut, ${l.promosEnCours} d'après la base`);
    }
    if (!enCours.length) {
      // Aucune promo en cours : la base n'envoie aucun chiffre non nul.
      for (const k of CHAMPS_COMPTES) {
        if (l[k] !== 0) ecarts.push(`${nom} : ${COLONNE(k)} : ${l[k]} d'après la base pour un centre sans promo en cours`);
      }
      continue;
    }
    const calcule = comptesDepuisIndicateurs(indicateursPromo(concatenerDonnees(enCours.map((p) => p.donnees)), referentiel, { aujourdhui }));
    if (l.masque) {
      masques += 1;
      if (!(calcule.enFormation < SEUIL_SECRET)) {
        ecarts.push(`${nom} : masqué par la base, mais le calcul de l'app donne ${calcule.enFormation} en formation (seuil : moins de ${SEUIL_SECRET})`);
      }
      continue;
    }
    if (calcule.enFormation < SEUIL_SECRET) {
      ecarts.push(`${nom} : chiffres envoyés par la base, mais le calcul de l'app donne ${calcule.enFormation} en formation (moins de ${SEUIL_SECRET} : le centre devrait être masqué)`);
    }
    for (const k of CHAMPS_COMPTES) {
      const a = Number(calcule[k]);
      const b = Number(l[k]);
      if (!(Math.abs(a - b) < TOLERANCE)) ecarts.push(`${nom} : ${COLONNE(k)} : ${b} d'après la base, ${a} d'après le calcul de l'app`);
    }
  }
  for (const id of lieuxDuBrut) {
    if (!lignes.some((l) => l.lieuId === id)) ecarts.push(`centre ${id} : le brut a des promos, la base n'envoie aucune ligne`);
  }
  return { ecarts, centres: lignes.length, masques };
}

function lire(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, "utf8"));
  } catch (e) {
    console.error(`Fichier illisible : ${chemin} (${e.message})`);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length < 4) {
    console.error("Usage : node outils/recouper_comptes.mjs <brut.json> <comptes.json>");
    process.exit(2);
  }
  const brut = lire(process.argv[2]);
  const comptes = lire(process.argv[3]);
  if (!brut || !Array.isArray(brut.promos) || !brut.aujourdhui || !Array.isArray(comptes)) {
    console.error("Forme inattendue : le brut doit porter « aujourdhui » et « promos », les comptes être un tableau de lignes.");
    process.exit(2);
  }
  const r = recouper(brut, comptes);
  if (!r.ecarts.length) {
    console.log(`identiques (${r.centres} centre${r.centres > 1 ? "s" : ""}, dont ${r.masques} masqué${r.masques > 1 ? "s" : ""})`);
  } else {
    r.ecarts.forEach((e) => console.log("écart : " + e));
    console.log(`${r.ecarts.length} écart${r.ecarts.length > 1 ? "s" : ""}`);
    process.exitCode = 1;
  }
}
