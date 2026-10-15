// Bandeau « Ton avis sur l'app » : qui le voit, et jusqu'à quand.
//
// Le questionnaire lui-même vit dans Google Forms, sans collecte d'adresse : l'app ne
// stocke aucune réponse, seulement le choix fait sur le bandeau (sur l'appareil). C'est ce
// qui garde l'anonymat crédible pour la promo.
//
// Une enquête = un objet AVIS. Sans `url`, le bandeau ne s'affiche nulle part : c'est
// l'interrupteur tant que le formulaire n'existe pas.

export const AVIS = {
  id: "2026-10-avis-nimes",
  promoId: 1,              // Nîmes, mars 2026
  url: "https://forms.gle/Vstq9xDEz8VQW7r26", // Google Form des stagiaires (anonyme)
  fin: "2026-11-30",       // dernier jour d'affichage, avant les épreuves de décembre
};

const STATUTS = new Set(["repondu", "refuse", "plus-tard"]);

// Seuls les liens de Google Forms sont acceptés : le bandeau n'ouvre jamais autre chose.
export function urlAutorisee(url) {
  let u;
  try { u = new URL(url); } catch (e) { return false; }
  if (u.protocol !== "https:") return false;
  if (u.hostname === "forms.gle") return true;
  return u.hostname === "docs.google.com" && u.pathname.startsWith("/forms/");
}

// Lendemain d'une date AAAA-MM-JJ, en AAAA-MM-JJ (calcul en UTC : pas de piège d'heure d'été).
export function lendemain(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Choix mémorisé, relu depuis le stockage. Toute valeur illisible vaut « rien de choisi ».
export function lireEtat(brut) {
  if (!brut) return null;
  let e;
  try { e = JSON.parse(brut); } catch (err) { return null; }
  if (!e || !STATUTS.has(e.statut)) return null;
  if (e.statut === "plus-tard" && !/^\d{4}-\d{2}-\d{2}$/.test(e.jusqua || "")) return null;
  return e;
}

// « Plus tard » : le bandeau revient le lendemain.
export function etatPlusTard(aujourdhui) {
  return { statut: "plus-tard", jusqua: lendemain(aujourdhui) };
}

export function bandeauVisible({ avis = AVIS, promoId, stagiaire, aujourdhui, etat }) {
  if (!avis || !urlAutorisee(avis.url) || !stagiaire) return false;
  if (promoId !== avis.promoId) return false;
  if (aujourdhui > avis.fin) return false;
  if (!etat) return true;
  if (etat.statut === "plus-tard") return aujourdhui >= etat.jusqua;
  return false; // répondu ou refusé : plus jamais
}
