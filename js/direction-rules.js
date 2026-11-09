// Règles pures des pages de la direction (lot 5, Tasks 8, 9 et 10). Sans DOM ni réseau, testées en node
// (tests/direction-rules.test.mjs). L'autorité reste la base : ces fonctions décident de ce que l'app affiche et refusent tôt,
// avec les mêmes phrases que creer_promo et modifier_dates_promo (supabase/migrations/20261028_roles_2_fonctions.sql).

import { promosEnCours } from "./comptes-reseau.js?v=20261109d";
import { compareByNom } from "./utils.js?v=20261109d";

// === Promos ===

// Phrase de refus d'une promo (nom, début, fin), ou null. Dans l'ordre de la base : nom, début, fin.
export function validerPromo({ nom, debut, fin } = {}) {
  if (!String(nom ?? "").trim()) return "Le nom est requis.";
  if (!debut) return "La date de début est requise.";
  if (fin && fin < debut) return "La fin ne peut pas précéder le début.";
  return null;
}

// « en cours » : la règle de promosEnCours (début au plus tard aujourd'hui, fin nulle ou à partir d'aujourd'hui).
export function etatPromo(promo, aujourdhui) {
  if (promosEnCours([promo], aujourdhui).length) return "en cours";
  return promo.date_debut > aujourdhui ? "à venir" : "terminée";
}

// === Stagiaires du centre ===
// listesParPromo : [{ promoId, nom, stagiaires: [{ id, nom, prenom, actif }] }], une entrée par promo du centre.

export function ouTrouverFiche(id, listesParPromo) {
  if (id == null || id === "") return null;
  for (const l of Array.isArray(listesParPromo) ? listesParPromo : []) {
    if ((l.stagiaires || []).some((s) => String(s.id) === String(id))) return { promoId: l.promoId };
  }
  return null;
}

const MARQUES = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");
const simple = (t) => String(t ?? "").normalize("NFD").replace(MARQUES, "").toLowerCase().trim();

// Groupes par promo, dans l'ordre reçu : { promoId, nom, enFormation, abandons }, chacun trié comme la page Stagiaires
// (compareByNom). filtre : { texte, promoId }. Une recherche par nom (sans accent ni casse, sur « nom prénom ») écarte les
// promos sans résultat ; sans recherche, une promo vide reste (elle porte sa gestion).
export function listeDuCentre(listesParPromo, filtre) {
  const { texte, promoId } = filtre || {};
  const cherche = simple(texte);
  const groupes = [];
  for (const l of Array.isArray(listesParPromo) ? listesParPromo : []) {
    if (promoId != null && l.promoId !== promoId) continue;
    const retenus = (l.stagiaires || [])
      .filter((s) => !cherche || simple([s.nom, s.prenom].filter(Boolean).join(" ")).includes(cherche))
      .sort(compareByNom);
    if (cherche && !retenus.length) continue;
    groupes.push({
      promoId: l.promoId, nom: l.nom,
      enFormation: retenus.filter((s) => s.actif),
      abandons: retenus.filter((s) => !s.actif),
    });
  }
  return groupes;
}

// === Équipe ===
// lignes : [{ email, nom, direction, promos: integer[] }] (lireEquipeDuCentre) ; promosDuCentre : [{ id, nom }].
// Les promos d'une personne qui ne sont pas de ce centre ne s'affichent pas.
export function equipeAffichee(lignes, promosDuCentre) {
  const centre = Array.isArray(promosDuCentre) ? promosDuCentre : [];
  const lignesOk = Array.isArray(lignes) ? lignes : [];
  const vue = lignesOk.map((l) => {
    const siennes = centre.filter((p) => (l.promos || []).includes(p.id));
    const role = l.direction ? (siennes.length ? "Direction et formateur" : "Direction") : "Formateur";
    return { nom: l.nom && String(l.nom).trim() ? l.nom : l.email, role, promos: siennes.map((p) => p.nom).join(", "), direction: !!l.direction };
  });
  vue.sort((a, b) => (b.direction - a.direction) || a.nom.localeCompare(b.nom, "fr"));
  return vue.map(({ nom, role, promos }) => ({ nom, role, promos }));
}
