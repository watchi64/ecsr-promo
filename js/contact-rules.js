// Règles pures des demandes de l'espace contact : le routage d'une demande, miroir exact de _contact_destinataires et de
// _contact_possibles (migration 20261115_contact_2_demandes.sql). Une même table de cas (tests/fixtures/contact-routage.json) est jouée
// ici (tests/contact-rules.test.mjs) et dans la preuve SQL (tests/sql/contact-demandes-preuve.sql, groupe parite) : un écart rougit les deux.
// Entrées et sorties en snake_case, comme la table de cas (l'écran adapte).
// Lancer : node tests/contact-rules.test.mjs

import { enConge } from "./contact-annuaire-rules.js?v=20261127a";
import { phraseDeRefus } from "./espaces-rules.js?v=20261127a";

// Ordre des fiches : identifiants numériques par valeur, sinon par points de code (l'ordre « C » de la base pour la table de cas).
function comparer(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// Une fiche peut-elle recevoir une demande dans ce centre ce jour-là ? Du centre, joignable (un compte ou un e-mail), pas en congé,
// pas partie (date de départ passée). Une fiche inconnue ne le peut pas.
function disponible(fiche, jour) {
  if (!fiche) return false;
  if (fiche.du_centre === false || fiche.joignable === false) return false;
  if (enConge(fiche, jour)) return false;
  if (fiche.depart_le && fiche.depart_le < jour) return false;
  return true;
}

/**
 * Le routage d'une demande. Entrées :
 *   type                le type de la demande (absence, retard, administratif, document, autre)
 *   financement_id      le financement du stagiaire (nul : aucun)
 *   jours               [{ jour, demi }] (absence et retard ; sert au planning, que formateurs_du_jour résume déjà)
 *   aujourdhui          le jour de création (AAAA-MM-JJ, jour de Paris) : il juge le congé et le départ
 *   regles              [{ type, financement_id, cible: "fiche"|"formateurs_du_jour", fiche_id }] du centre ; type « defaut » :
 *                       la personne par défaut
 *   fiches              [{ fiche_id, nom, du_centre, joignable, conge_du, conge_au, depart_le, relais_id }] (du_centre et joignable
 *                       vrais par défaut)
 *   formateurs_du_jour  les fiches du centre rattachées aux formateurs du planning de `jours`
 *   possibles           les fiches de l'équipe de la promo (formateurs à titre fixe, direction réelle du centre)
 * Sortie : { mode: "regle"|"choix", principaux: [{ fiche_id, relais_de }], source, possibles: [{ fiche_id, pre_coche }] }.
 * Règle (type et financement), sinon règle (type), sinon personne par défaut. Une fiche indisponible passe à son relais s'il est
 * disponible (relais_de : le nom de la titulaire), sinon à la personne par défaut si elle est disponible ; la règle « formateurs du
 * jour » sans formateur disponible passe à la personne par défaut. Personne : mode choix (source nulle), et les possibles disponibles
 * (une fiche de `fiches` partie ou en congé est écartée), pré-cochés pour les formateurs du jour. En mode règle, aucun possible : le
 * stagiaire ne choisit pas.
 */
export function routerDemande({ type, financement_id = null, aujourdhui, regles = [], fiches = [], formateurs_du_jour = [],
  possibles = [] } = {}) {
  const parId = new Map((fiches ?? []).map((f) => [f.fiche_id, f]));
  const dispo = (id) => disponible(parId.get(id), aujourdhui);
  const fdj = [...new Set(formateurs_du_jour ?? [])];
  const regle = (t, fin) => (regles ?? []).find((r) => r.type === t && (r.financement_id ?? null) === fin);

  let r = null;
  let source = null;
  if (financement_id != null) {
    r = regle(type, financement_id);
    if (r) source = "regle_type_financement";
  }
  if (!r) {
    r = regle(type, null);
    if (r) source = "regle_type";
  }
  const defaut = regle("defaut", null);
  if (!r && defaut) {
    r = defaut;
    source = "defaut";
  }

  let principaux = [];
  const versDefaut = () => {
    source = "defaut";
    return defaut && dispo(defaut.fiche_id) ? [{ fiche_id: defaut.fiche_id, relais_de: null }] : [];
  };
  if (r && r.cible === "formateurs_du_jour") {
    principaux = fdj.filter(dispo).map((id) => ({ fiche_id: id, relais_de: null }));
    if (principaux.length === 0) principaux = versDefaut();
  } else if (r) {
    const titulaire = parId.get(r.fiche_id);
    if (dispo(r.fiche_id)) {
      principaux = [{ fiche_id: r.fiche_id, relais_de: null }];
    } else if (titulaire && titulaire.relais_id != null && dispo(titulaire.relais_id)) {
      principaux = [{ fiche_id: titulaire.relais_id, relais_de: titulaire.nom ?? null }];
    } else {
      principaux = versDefaut();
    }
  }
  principaux.sort((a, b) => comparer(a.fiche_id, b.fiche_id));

  if (principaux.length > 0) return { mode: "regle", principaux, source, possibles: [] };
  // Une fiche connue (fiches) partie ou en congé n'est ni choisie ni pré-cochée (migration 4, _contact_possibles et
  // _contact_formateurs_du_jour) ; une fiche que la liste ne décrit pas est disponible.
  const choisissable = (id) => !parId.has(id) || dispo(id);
  const choix = [...new Set(possibles ?? [])].filter(choisissable).sort(comparer)
    .map((id) => ({ fiche_id: id, pre_coche: fdj.includes(id) }));
  return { mode: "choix", principaux: [], source: null, possibles: choix };
}

// === Les demandes à l'écran (tâche 11) ===

const JOUR_MS = 86400000;
export const TYPES_DEMANDE = { absence: "Absence", retard: "Retard", administratif: "Administratif", document: "Document", autre: "Autre" };
const PHRASE_CHOIX_STAGIAIRE = "Ton centre n'a pas choisi qui reçoit ce type de demande : coche au moins une personne.";
const PHRASE_PERSONNE = "Personne ne peut recevoir ta demande dans ce centre : préviens ton formateur directement.";

const enMs = (v) => (v == null ? NaN : new Date(v).getTime());

/**
 * Les étapes d'une demande, dans l'ordre : envoyée, lue, prise en compte, annulée. `detail` est la réponse de demande_detail.
 * « Lue » n'existe que si un destinataire principal a ouvert la demande dans l'app (lue_le) : une personne sans compte ne la lit
 * jamais dans l'app. Sortie : [{ cle, quand, par }].
 */
export function etapesDemande(detail) {
  const d = detail?.demande;
  if (!d) return [];
  const etapes = [{ cle: "envoyee", quand: d.cree_le ?? null, par: d.auteur_nom ?? null }];
  const lues = (detail.destinataires ?? []).filter((x) => x.principal && x.lue_le && !Number.isNaN(enMs(x.lue_le)))
    .sort((a, b) => enMs(a.lue_le) - enMs(b.lue_le));
  if (lues.length > 0) etapes.push({ cle: "lue", quand: lues[0].lue_le, par: lues[0].nom ?? null });
  if (d.prise_le) etapes.push({ cle: "prise", quand: d.prise_le, par: d.prise_par ?? null });
  if (d.annulee_le) etapes.push({ cle: "annulee", quand: d.annulee_le, par: d.annulee_par ?? null });
  return etapes;
}

/**
 * Range la liste des demandes (liste_demandes) en trois : à traiter (a_traiter, lu tel quel : la base décide), terminées (annulée,
 * ou prise sans échange depuis 7 jours), ouvertes (le reste). L'ordre reçu est gardé dans chaque groupe.
 */
export function rangerDemandes(lignes, maintenant = new Date()) {
  const rang = { aTraiter: [], ouvertes: [], terminees: [] };
  const now = enMs(maintenant);
  for (const l of lignes ?? []) {
    if (l.a_traiter) { rang.aTraiter.push(l); continue; }
    const dernier = enMs(l.dernier_echange_le ?? l.cree_le);
    const inactive = l.etat === "prise" && !Number.isNaN(dernier) && now - dernier >= 7 * JOUR_MS;
    (l.etat === "annulee" || inactive ? rang.terminees : rang.ouvertes).push(l);
  }
  return rang;
}

/**
 * La phrase d'un échec d'écran : un refus de la base (préfixe « contact: », droit manquant, fonction absente) se dit par sa phrase,
 * tout autre échec par la phrase générique de l'écran (jamais un texte technique).
 */
export function phraseContact(e, generique) {
  const message = String(e?.message ?? "");
  if (/^\s*contact:/i.test(message) || e?.code === "42501" || e?.code === "PGRST202") return phraseDeRefus(message, e?.code);
  return generique;
}

/**
 * Bascule une case de l'encadré : `coches` est l'ensemble COURANT des identifiants cochés (celui que montre l'écran), le résultat est un
 * nouvel ensemble, l'entrée n'est pas modifiée.
 */
export function basculerCoche(coches, ficheId, coche) {
  const suite = new Set(coches ?? []);
  if (coche) suite.add(ficheId); else suite.delete(ficheId);
  return suite;
}

/** Le compteur de l'entrée Messages : combien de demandes de la liste (liste_demandes) n'ont pas été lues par la personne. */
export function compterNonLues(lignes) {
  return (lignes ?? []).filter((l) => l && l.non_lue === true).length;
}

/** « Claire, relais de Sophie », « Karim n'a pas pu être prévenu », sinon le nom. */
export function libelleDestinataire(d) {
  const nom = d?.nom ?? "";
  if (d?.non_prevenu) return `${nom} n'a pas pu être prévenu`;
  if (d?.relais_de) return `${nom}, relais de ${d.relais_de}`;
  return nom;
}

/**
 * Ce que l'encadré « Qui reçoit ta demande » montre, d'après apercu_envoi. `coches` : l'ensemble des identifiants cochés en ce moment
 * (tableau ou Set) ; absent (null), les cases pré-cochées par la base le sont. Un ensemble vide veut dire que le stagiaire a tout décoché.
 * Mode règle : les principaux (leurs noms), aucune case. Mode choix : une case par possible ; l'envoi exige une case cochée au moins ;
 * aucun possible : rien ne peut partir.
 */
export function lignesEncadre(apercu, coches = null) {
  if (apercu?.mode !== "choix") {
    return { mode: "regle", principaux: (apercu?.principaux ?? []).map((p) => p.nom), cases: [], phrase: null, envoyable: true };
  }
  const touchees = coches == null ? null : new Set(coches);
  const cases = (apercu.possibles ?? []).map((p) => ({
    fiche_id: p.fiche_id, nom: p.nom, titre: p.titre ?? null, coche: touchees ? touchees.has(p.fiche_id) : p.pre_coche === true,
  }));
  if (cases.length === 0) return { mode: "choix", principaux: [], cases, phrase: PHRASE_PERSONNE, envoyable: false };
  return { mode: "choix", principaux: [], cases, phrase: PHRASE_CHOIX_STAGIAIRE, envoyable: cases.some((c) => c.coche) };
}

function aujourdhuiLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Les réglages du centre (« Qui reçoit quoi », « Réponses toutes faites ») se modifient-ils ? reglages_contact rend peut_modifier
 * (migration 4 : le droit reglages.modifier des fonctions d'écriture). Faux : l'écran se montre en lecture seule (ni « Enregistrer »,
 * ni « Ajouter », ni « Retirer », champs désactivés). Clé absente (base d'avant la migration 4) : modifiable, comme avant ; la base
 * refuse alors l'écriture par sa phrase.
 */
export function reglagesModifiables(reglages) {
  return reglages?.peut_modifier !== false;
}

/**
 * La ligne de l'aperçu de « Qui reçoit quoi » (réglages du centre) pour un type et un financement : « Absence, CPF : Sophie » quand
 * une règle ou la personne par défaut s'applique, « Absence, CPF : les formateurs du jour » pour cette règle, sinon « ... : le
 * stagiaire choisit parmi les formateurs de sa promo et la direction ». `reglages` : { regles, fiches, financements } de
 * reglages_contact. Le jugement est celui de routerDemande (congé, relais, départ jugés au jour donné, aujourd'hui par défaut).
 */
export function phraseReglesCentre(reglages, type, financementId = null, aujourdhui = aujourdhuiLocal()) {
  const regles = reglages?.regles ?? [];
  const fin = financementId == null ? null : (reglages?.financements ?? []).find((f) => f.id === financementId);
  const tete = [TYPES_DEMANDE[type] ?? type, fin?.libelle].filter(Boolean).join(", ");
  const regle = (t, f) => regles.find((r) => r.type === t && (r.financement_id ?? null) === f);
  const appliquee = (financementId != null && regle(type, financementId)) || regle(type, null) || regle("defaut", null);
  if (appliquee?.cible === "formateurs_du_jour") return `${tete} : les formateurs du jour`;
  const noms = new Map((reglages?.fiches ?? []).map((f) => [f.fiche_id, f.nom]));
  const r = routerDemande({ type, financement_id: financementId, aujourdhui, regles, fiches: reglages?.fiches ?? [] });
  if (r.mode === "regle") {
    return `${tete} : ${r.principaux.map((p) => libelleDestinataire({ nom: noms.get(p.fiche_id) ?? "", relais_de: p.relais_de })).join(", ")}`;
  }
  return `${tete} : le stagiaire choisit parmi les formateurs de sa promo et la direction`;
}
