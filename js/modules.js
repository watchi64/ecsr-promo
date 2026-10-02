// Règles des modules (chantier B) : ce qu'un formateur ouvre ou ferme pour une
// promo. Aucune dépendance, aucun accès à la base ni au DOM : le catalogue et
// l'état sont passés en argument, ce qui rend tout testable par node
// (tests/modules.test.mjs) sans dépendre du contenu réel du catalogue.
//
// Un état vaut :
//   { statut: "libre" }       aucun réglage : tout est ouvert ;
//   { statut: "illisible" }   réglage invalide : traité comme libre ;
//   { statut: "reglee", depuis, ouverts }  seuls les modules de `ouverts` sont
//     ouverts ; `ouverts` associe une clé de module à son heure d'ouverture
//     (ISO 8601, UTC) ; `depuis` est l'heure de la mise en place.

export const VERSION = 1;

// Préfixe des ids d'annonce. js/nouveautes.js l'épargne dans purger() : les
// deux valeurs doivent rester identiques (vérifié par tests/modules.test.mjs).
export const PREFIXE_ANNONCE = "module-";

export const ETAT_LIBRE = Object.freeze({ statut: "libre" });

const contient = (objet, cle) => Object.prototype.hasOwnProperty.call(objet, cle);

// Texte stocké (ou null si la clé est absente) vers état.
export function lireEtat(texte) {
  if (texte === null || texte === undefined || texte === "") return ETAT_LIBRE;
  let brut;
  try { brut = JSON.parse(texte); } catch (e) { return { statut: "illisible" }; }
  if (!brut || typeof brut !== "object" || Array.isArray(brut) || brut.v !== VERSION
      || typeof brut.depuis !== "string"
      || !brut.ouverts || typeof brut.ouverts !== "object" || Array.isArray(brut.ouverts)) {
    return { statut: "illisible" };
  }
  const ouverts = {};
  for (const [cle, quand] of Object.entries(brut.ouverts)) {
    if (typeof quand === "string") ouverts[cle] = quand;
  }
  return { statut: "reglee", depuis: brut.depuis, ouverts };
}

// État réglé vers texte stocké. Un état libre ou illisible n'a rien à écrire :
// le refuser évite de stocker un texte que lireEtat relirait comme illisible.
export function ecrireEtat(etat) {
  if (!estReglee(etat)) throw new Error("ecrireEtat : seul un état réglé s'écrit");
  return JSON.stringify({ v: VERSION, depuis: etat.depuis, ouverts: etat.ouverts });
}

export function estReglee(etat) {
  return !!etat && etat.statut === "reglee";
}

// Une clé vide désigne le socle, toujours ouvert. Dans une promo réglée, un
// module est ouvert s'il est coché et que son parent, s'il en a un, l'est aussi.
// Un module que le réglage ne mentionne pas (ajouté au catalogue depuis) est fermé.
export function estOuvert(cle, etat, modules) {
  if (!cle) return true;
  if (!estReglee(etat)) return true;
  if (!contient(etat.ouverts, cle)) return false;
  const m = modules.find((x) => x.cle === cle);
  return !m || !m.parent || estOuvert(m.parent, etat, modules);
}

export function ensembleDeDepart(modules, maintenant) {
  const ouverts = {};
  for (const m of modules) if (m.depart) ouverts[m.cle] = maintenant;
  return { statut: "reglee", depuis: maintenant, ouverts };
}

// Depuis l'état libre (ou illisible), le réglage est d'abord matérialisé : tout
// le catalogue ouvert à l'heure courante, qui devient l'heure de mise en place,
// donc rien n'est annoncé. Rouvrir un module déjà ouvert garde son heure.
export function basculer(etat, cle, ouvrir, modules, maintenant) {
  const suivant = estReglee(etat)
    ? { statut: "reglee", depuis: etat.depuis, ouverts: { ...etat.ouverts } }
    : { statut: "reglee", depuis: maintenant,
        ouverts: Object.fromEntries(modules.map((m) => [m.cle, maintenant])) };
  if (ouvrir) {
    if (!contient(suivant.ouverts, cle)) suivant.ouverts[cle] = maintenant;
  } else {
    delete suivant.ouverts[cle];
  }
  return suivant;
}

// Jour (AAAA-MM-JJ) d'une heure ISO, en heure de Paris : une ouverture à 00 h 30
// est datée du jour même, pas de la veille en UTC.
export function jourParis(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const v = (type) => parts.find((p) => p.type === type).value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}

// Une annonce par module ouvert (parent compris) après la mise en place.
export function annonces(etat, modules) {
  if (!estReglee(etat)) return [];
  const depuis = Date.parse(etat.depuis);
  const liste = [];
  for (const m of modules) {
    if (!m.annonce || !contient(etat.ouverts, m.cle)) continue;
    const quand = etat.ouverts[m.cle];
    if (!(Date.parse(quand) > depuis)) continue;
    if (!estOuvert(m.cle, etat, modules)) continue;
    const date = jourParis(quand);
    if (!date) continue;
    const entree = {
      id: PREFIXE_ANNONCE + m.cle + "-" + quand, date, pour: "tous", module: m.cle,
      titre: m.annonce.titre, resume: m.annonce.resume,
    };
    if (m.annonce.ou) entree.ou = { ...m.annonce.ou };
    liste.push(entree);
  }
  return liste;
}

// Nouveautés écrites + annonces, sans filtre : c'est la liste à donner à la
// mémoire des nouveautés lues (amorce et purge).
export function avecAnnonces(entrees, etat, modules) {
  return [...entrees, ...annonces(etat, modules)];
}

// Module dont parle une nouveauté : son champ `module`, sinon son lien « Où le
// trouver » (sous-onglet d'abord, puis route), sinon aucun.
export function moduleDeNouveaute(entree, ref) {
  if (entree.module) return entree.module;
  const ou = entree.ou;
  if (!ou || !ou.route) return null;
  const parSousOnglet = ou.sousOnglet && ref.moduleDeSousOnglet[ou.route]
    ? ref.moduleDeSousOnglet[ou.route][ou.sousOnglet] : null;
  return parSousOnglet || ref.moduleDeRoute[ou.route] || null;
}

// Nouveautés à montrer : un formateur voit tout, un stagiaire ne voit pas ce qui
// concerne un module fermé pour sa promo.
export function nouveautesPour(entrees, etat, ref, formateur) {
  const toutes = avecAnnonces(entrees, etat, ref.modules);
  if (formateur) return toutes;
  return toutes.filter((e) => estOuvert(moduleDeNouveaute(e, ref), etat, ref.modules));
}

// « ouvert » + accord du catalogue : « Notes ouvertes », « Planning ouvert ».
const SUFFIXES_ACCORD = { ms: "", fs: "e", mp: "s", fp: "es" };
export function accorder(base, accord) {
  return base + (SUFFIXES_ACCORD[accord] ?? "");
}
