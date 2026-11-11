// États de la fiche et de la page Stagiaires (chantier D, lot 2).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EPREUVES_EPCF, EVT_DOCUMENT, epreuvesEvaluees, jourMois, passagesAVenir, ligneListe, etatsSommaire,
  etatsClairs, noterDocument,
} from "../js/fiche-rules.js";

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

// 1. Épreuves EPCF
eq(EPREUVES_EPCF, ["salle", "vehicule"], "deux épreuves");
eq(epreuvesEvaluees([]), 0, "aucune évaluation");
eq(epreuvesEvaluees(undefined), 0, "liste absente");
eq(epreuvesEvaluees([{ trame: "salle" }, { trame: "salle" }]), 1, "deux évaluations salle : une épreuve");
eq(epreuvesEvaluees([{ trame: "salle" }, { trame: "vehicule" }]), 2, "les deux épreuves");
eq(epreuvesEvaluees([{ trame: "autre" }]), 0, "épreuve inconnue ignorée");

// 2. Dates
eq(jourMois("2026-09-29"), "29/09", "date seule");
eq(jourMois("2026-09-29T10:00:00"), "29/09", "horodatage");
eq(jourMois(null), null, "absente");
eq(jourMois("pas une date"), null, "illisible");

// 3. Passages à venir : aujourd'hui compris, vrais passages seulement
const items = [
  { iso: "2026-10-02", role: "passage" },
  { iso: "2026-10-03", role: "passage" },
  { iso: "2026-10-03", role: "eleve" },
  { iso: "2026-10-06", role: "passage" },
];
eq(passagesAVenir(items, "2026-10-03"), 2, "passé exclu, élève en salle exclu");
eq(passagesAVenir(undefined, "2026-10-03"), 0, "rien de planifié");

// 4. Ligne de la liste (vue formateur)
eq(ligneListe({ evals: [{ trame: "salle" }], livret: { updated_at: "2026-09-20T08:00:00" },
  dossier: { updated_at: "2026-09-29T08:00:00" } }),
  [{ texte: "EPCF 1/2", afaire: true }, { texte: "Livret", afaire: false }, { texte: "Dossier 29/09", afaire: false }],
  "en cours");
eq(ligneListe({ evals: [], livret: null, dossier: null }),
  [{ texte: "EPCF 0/2", afaire: true }, { texte: "Livret vierge", afaire: true }, { texte: "Dossier vierge", afaire: true }],
  "rien de commencé");
eq(ligneListe({ evals: [{ trame: "salle" }, { trame: "vehicule" }], livret: {}, dossier: { updated_at: "bidon" } }),
  [{ texte: "EPCF 2/2", afaire: false }, { texte: "Livret", afaire: false }, { texte: "Dossier", afaire: false }],
  "tout fait, date illisible");

// 5. Sommaire : orange pour le formateur, seulement le dossier pour soi
const vu = { aVenir: 2, evals: [{ trame: "salle" }], livret: null, dossier: null };
const f = etatsSommaire({ ...vu, soi: false });
eq(f.passages, { texte: "2 à venir", afaire: false }, "passages");
eq(f.epcf, { texte: "1/2", afaire: true }, "EPCF en orange chez le formateur");
eq(f.evolution, null, "évolution sans état");
eq(f.livret, { texte: "vierge", afaire: true }, "livret vierge en orange chez le formateur");
eq(f.dp, { texte: "vierge", afaire: true }, "dossier vierge");
const s = etatsSommaire({ ...vu, soi: true });
eq(s.epcf, { texte: "1/2", afaire: false }, "EPCF en gris chez le stagiaire");
eq(s.livret, { texte: "pas encore créé", afaire: false }, "livret pas encore créé, en gris");
eq(s.dp, { texte: "vierge", afaire: true }, "son dossier vierge reste en orange");
const fait = etatsSommaire({ aVenir: 0, evals: [], livret: { updated_at: "x" }, dossier: { updated_at: "2026-10-01" }, soi: true });
eq(fait.passages, { texte: "aucun à venir", afaire: false }, "aucun à venir");
eq(fait.livret, { texte: "commencé", afaire: false }, "livret commencé");
eq(fait.dp, { texte: "01/10", afaire: false }, "dossier daté");

eq(EVT_DOCUMENT, "document-enregistre", "nom de l'événement");

// 6. États clairs de Mon suivi (nouvelle navigation, lot 2B, tâche 7) : chaque ligne du sommaire se lit seule,
// « Dossier pro : 2 exemples sur 6 » et non « Dossier pro 02/10 » (qui se lisait comme une date, ruling R65).
const c = etatsClairs({ aVenir: 2, evals: [], livret: null, exemplesDossier: null });
eq(Object.keys(c), ["resultats", "passages", "epcf", "livret", "dp"], "cinq parties, dans l'ordre de Mon suivi");
eq(c.resultats, { texte: "Résultats : moi et la classe", afaire: false }, "résultats");
eq(c.passages, { texte: "Passages : 2 à venir", afaire: false }, "passages au pluriel");
eq(c.epcf, { texte: "EPCF : 0 épreuve sur 2", afaire: false }, "EPCF : aucune épreuve, au singulier, en gris (elle ne dépend pas du stagiaire)");
eq(c.livret, { texte: "Livret EPCF : pas encore commencé", afaire: false }, "livret EPCF pas commencé, en gris");
eq(c.dp, { texte: "Dossier pro : pas encore commencé", afaire: true }, "pas de dossier : pas encore commencé, en orange");
const un = etatsClairs({ aVenir: 1, evals: [{ trame: "salle" }], livret: { updated_at: "x" }, exemplesDossier: 1 });
eq(un.passages.texte, "Passages : 1 à venir", "passages au singulier");
eq(un.epcf.texte, "EPCF : 1 épreuve sur 2", "une épreuve évaluée, au singulier");
eq(un.livret, { texte: "Livret EPCF : commencé", afaire: false }, "livret EPCF commencé");
eq(un.dp, { texte: "Dossier pro : 1 exemple sur 6", afaire: true }, "un exemple, au singulier");
const zero = etatsClairs({ aVenir: 0, evals: [{ trame: "salle" }, { trame: "vehicule" }], livret: null, exemplesDossier: 0 });
eq(zero.passages.texte, "Passages : aucun à venir", "aucun passage à venir");
eq(zero.epcf.texte, "EPCF : 2 épreuves sur 2", "les deux épreuves, au pluriel");
eq(zero.dp, { texte: "Dossier pro : 0 exemple sur 6", afaire: true }, "dossier ouvert sans exemple rempli : le compte, comme sur l'Accueil");
eq(etatsClairs({ aVenir: 0, evals: [], livret: null, exemplesDossier: 2 }).dp.texte, "Dossier pro : 2 exemples sur 6", "deux exemples");
eq(etatsClairs({ aVenir: 0, evals: [], livret: null, exemplesDossier: 6 }).dp, { texte: "Dossier pro : 6 exemples sur 6", afaire: false }, "dossier complet : plus rien à faire");
eq(etatsClairs({}).passages.texte, "Passages : aucun à venir", "rien de lu : aucun à venir");
// Contrat du sommaire (rendreSommaire retire le libellé de la partie du texte pour en faire le nom en gras) :
// chaque texte d'états clairs commence par le libellé de sa partie, lu dans la table de la vue.
// Dans Mon suivi, la seule page où ces états s'affichent, le livret s'appelle « Livret EPCF » (libellePartie de la vue).
const sourceVue = readFileSync(new URL("../js/views/mon-suivi.js", import.meta.url), "utf8");
const tableVue = sourceVue.match(/const LIBELLE_PARTIE = \{([^}]*)\}/)[1];
eq(/p === "livret" && opts\?\.soi \? "Livret EPCF"/.test(sourceVue), true, "Mon suivi nomme le livret « Livret EPCF »");
for (const [p, e] of Object.entries(c)) {
  const libelle = p === "livret" ? "Livret EPCF" : (tableVue.match(new RegExp(p + ': "([^"]+)"')) || [])[1];
  eq(typeof libelle, "string", `${p} : libellé trouvé dans la vue`);
  eq(e.texte.startsWith(libelle), true, `${p} : le texte commence par son libellé « ${libelle} »`);
}
for (const [p, e] of Object.entries(c)) eq(/\d{2}\/\d{2}/.test(e.texte), false, `${p} : aucune date « 02/10 » dans le texte`);

// 7. Un enregistrement met l'état de la fiche à jour (EVT_DOCUMENT) ; le dossier porte son compte d'exemples.
const fiche = { id: 1, livret: null, dossier: null, exemplesDossier: null };
eq(noterDocument(fiche, { genre: "dossier", stagiaireId: 1, updatedAt: "2026-11-08T10:00:00Z", exemples: 3 }), true, "dossier enregistré");
eq(fiche.dossier, { stagiaire_id: 1, updated_at: "2026-11-08T10:00:00Z" }, "ligne du dossier");
eq(fiche.exemplesDossier, 3, "le compte d'exemples suit l'enregistrement");
eq(etatsClairs({ aVenir: 0, evals: [], livret: null, exemplesDossier: fiche.exemplesDossier }).dp.texte, "Dossier pro : 3 exemples sur 6", "le sommaire lit le nouveau compte");
noterDocument(fiche, { genre: "dossier", stagiaireId: 1, updatedAt: "2026-11-08T10:01:00Z" });
eq(fiche.exemplesDossier, 3, "un événement sans compte garde le dernier compte connu");
eq(noterDocument(fiche, { genre: "livret", stagiaireId: 1, updatedAt: "2026-11-08T10:02:00Z" }), true, "livret enregistré");
eq(fiche.livret, { stagiaire_id: 1, updated_at: "2026-11-08T10:02:00Z" }, "ligne du livret");
eq(noterDocument(fiche, { genre: "dossier", stagiaireId: 2, exemples: 5 }), false, "la fiche d'un autre n'est pas touchée");
eq(fiche.exemplesDossier, 3, "compte inchangé pour un autre");
eq(noterDocument(fiche, { genre: "autre", stagiaireId: 1 }), false, "genre inconnu");
eq(noterDocument(null, { genre: "dossier", stagiaireId: 1 }), false, "pas de fiche chargée");

console.log(`fiche-rules : ${n} assertions OK`);
