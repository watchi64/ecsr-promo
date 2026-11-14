// Règles pures de l'annuaire de l'espace contact : libellés des titres, congé, ligne d'une fiche, tri, contrôle de « ma fiche »
// (mêmes limites que regler_ma_fiche en base), phrase du délégué, écritures qui comptent leurs lignes.
// Lancer : node tests/contact-annuaire-rules.test.mjs

// [{nom, niveau, promos}] -> « Formateur · 2 promos » ; plusieurs titres joints par « , » ; vide : "".
export function libelleTitres(titres) {
  if (!Array.isArray(titres)) return "";
  return titres
    .filter((t) => t && t.nom)
    .map((t) => (t.niveau === "promo" && Number(t.promos) > 1 ? `${t.nom} · ${Number(t.promos)} promos` : t.nom))
    .join(", ");
}

// Congé en cours à `jour` (AAAA-MM-JJ), bornes incluses. Sans dates : faux.
export function enConge(fiche, jour) {
  const du = fiche?.conge_du;
  const au = fiche?.conge_au;
  if (!du || !au || !jour) return false;
  return du <= jour && jour <= au;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « 15 », ou « 3 décembre » quand le mois de la date n'est pas celui du jour affiché.
function dateDeFin(iso, jour) {
  const numero = Number(String(iso).slice(8, 10));
  const jourDuMois = numero === 1 ? "1er" : String(numero);
  const mois = Number(String(iso).slice(5, 7));
  return mois === Number(String(jour).slice(5, 7)) ? jourDuMois : `${jourDuMois} ${MOIS[mois - 1]}`;
}

// Ce que l'écran affiche pour une fiche de l'annuaire. `parId` : Map(id de fiche -> nom) pour nommer le relais.
export function ligneDeFiche(fiche, { jour, parId } = {}) {
  const f = fiche || {};
  const chiffres = String(f.telephone ?? "").replace(/[^0-9+]/g, "");
  let conge = null;
  if (enConge(f, jour)) {
    const relais = f.relais_id != null && parId ? parId.get(f.relais_id) : null;
    conge = `En congé jusqu'au ${dateDeFin(f.conge_au, jour)}` + (relais ? `, relais : ${relais}` : "");
  }
  return {
    nom: f.nom_affiche ?? "",
    titre: libelleTitres(f.titres),
    pourQuoi: f.pour_quoi || f.note || null,
    quand: f.quand || null,
    appeler: chiffres ? `tel:${chiffres}` : null,
    ecrire: !!f.joignable,
    conge,
  };
}

// La base rend l'état 23505 brut quand un rang de délégué est déjà pris : l'app dit la phrase.
export function phraseDelegue(code) {
  return String(code ?? "") === "23505" ? "Il y a déjà un délégué de ce rang dans cette promo." : null;
}

// Une écriture qui ne touche aucune ligne (droit refusé sans erreur, fiche inconnue) se lève au lieu de passer pour un succès.
export function exigerLignes(data, phrase) {
  if (!Array.isArray(data) || data.length === 0) throw new Error(phrase);
  return data;
}

// Par ordre, puis par nom (sans ordre : en dernier). Ne modifie pas la liste reçue.
export function trierFiches(fiches) {
  const rang = (f) => (f?.ordre == null ? Infinity : Number(f.ordre));
  return [...(fiches || [])].sort((a, b) => {
    const ra = rang(a);
    const rb = rang(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    return String(a?.nom_affiche ?? "").localeCompare(String(b?.nom_affiche ?? ""), "fr");
  });
}

const TEXTES = ["prenom", "nom", "email", "telephone", "pour_quoi", "quand"];
const FORMAT_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FORMAT_TELEPHONE = /^[0-9 +().-]{6,20}$/;
const PHRASE_CONGE = "Les dates du congé ne se suivent pas.";

function dateValide(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Contrôle de « ma fiche » avant l'envoi : mêmes limites que regler_ma_fiche. Une clé absente n'est pas jugée ; un texte vide
// vaut « effacé ». Les phrases reprennent celles de la base sans le préfixe « contact: ».
export function validerMaFiche(champs) {
  const c = champs || {};
  const erreurs = {};
  for (const k of TEXTES) {
    if (c[k] == null) continue;
    const v = String(c[k]).trim();
    if (!v) continue;
    if (v.length > 80) erreurs[k] = "80 caractères au plus.";
    else if (k === "email" && !FORMAT_EMAIL.test(v)) erreurs[k] = "Adresse e-mail invalide.";
    else if (k === "telephone" && !FORMAT_TELEPHONE.test(v)) erreurs[k] = "Numéro de téléphone invalide.";
  }
  const du = c.conge_du === "" ? null : (c.conge_du ?? null);
  const au = c.conge_au === "" ? null : (c.conge_au ?? null);
  if (du != null && !dateValide(du)) erreurs.conge_du = PHRASE_CONGE;
  if (au != null && !dateValide(au)) erreurs.conge_au = PHRASE_CONGE;
  // Une date absente des champs envoyés garde sa valeur en base : seule la paire envoyée ensemble est jugée entière.
  if (!erreurs.conge_du && !erreurs.conge_au && "conge_du" in c && "conge_au" in c) {
    if ((du == null) !== (au == null) || (du != null && du > au)) erreurs.conge_au = PHRASE_CONGE;
  }
  return { ok: Object.keys(erreurs).length === 0, erreurs };
}

// ---- Tâche 6 : départs et financements du centre

// Une fiche sans compte dont la date de départ est passée (strictement, comme la base : le jour du départ, elle est encore là).
export function aQuitte(fiche, jour) {
  return !!fiche && !fiche.avec_compte && !!fiche.depart_le && !!jour && fiche.depart_le < jour;
}

// Les fiches à supprimer à la main : celles de ceux qui ont quitté le centre, les plus anciens départs d'abord.
export function fichesASupprimer(fiches, jour) {
  return (fiches || []).filter((f) => aQuitte(f, jour))
    .sort((a, b) => (a.depart_le < b.depart_le ? -1 : a.depart_le > b.depart_le ? 1 : String(a.nom_affiche ?? "").localeCompare(String(b.nom_affiche ?? ""), "fr")));
}

const normaliserLibelle = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const PHRASE_LIBELLE_LONGUEUR = "Le nom d'un financement compte de 1 à 40 caractères.";
const PHRASE_LIBELLE_DOUBLON = "Deux financements portent le même nom.";

// Le nom d'un financement : 1 à 40 caractères, différent (sans tenir compte des majuscules) de celui des autres. `sauf` : l'id de
// la ligne qu'on renomme. Rend la phrase de refus, ou null. Mêmes limites que regler_financements.
export function validerLibelleFinancement(libelle, lignes, sauf = null) {
  const v = normaliserLibelle(libelle);
  if (v.length < 1 || v.length > 40) return PHRASE_LIBELLE_LONGUEUR;
  const bas = v.toLowerCase();
  if ((lignes || []).some((l) => l.id !== sauf && normaliserLibelle(l.libelle).toLowerCase() === bas)) return PHRASE_LIBELLE_DOUBLON;
  return null;
}

// La liste entière à envoyer à regler_financements après UN geste sur la liste enregistrée : renommer, ajouter, retirer (retire
// vrai ou faux), déplacer (sens -1 ou 1). Un seul nom change à la fois : l'échange de deux noms n'est jamais nécessaire.
export function listeFinancements(lignes, action) {
  let liste = (lignes || []).map((l) => ({ id: l.id, libelle: l.libelle, ordre: l.ordre, retire: !!l.retire }));
  const a = action || {};
  const rang = liste.findIndex((l) => l.id === a.id);
  if (a.geste === "renommer" && rang >= 0) liste[rang].libelle = normaliserLibelle(a.libelle);
  else if (a.geste === "ajouter") liste.push({ id: null, libelle: normaliserLibelle(a.libelle), ordre: 0, retire: false });
  else if (a.geste === "retirer" && rang >= 0) liste[rang].retire = !!a.retire;
  else if (a.geste === "deplacer" && rang >= 0) {
    const vers = rang + (a.sens < 0 ? -1 : 1);
    if (vers >= 0 && vers < liste.length) [liste[rang], liste[vers]] = [liste[vers], liste[rang]];
  }
  return liste.map((l, i) => ({ ...l, ordre: 10 * (i + 1) }));
}
