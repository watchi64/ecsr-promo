/*
 * Espaces de l'app (lot 5) : règles pures, sans réseau ni DOM, testées par
 * `node --test tests/espaces-rules.test.mjs`. Quatre espaces : le stagiaire, l'équipe (le formateur, nom
 * technique gardé du lot 1), la direction d'un centre et le siège (le réseau). L'autorité reste la base :
 * ces fonctions décident de ce que l'app affiche.
 *
 * Sources des espaces permis (D2) : siège et direction viennent des affectations du compte ; formateur et
 * stagiaire viennent des rôles du compte dans la promo affichée (`promo.roles`, mes_promos(), lot 4).
 */
import { apercusPermis, normaliserApercu, droitsAffiches, LIBELLES_APERCU } from "./roles-rules.js?v=20261109a";
import { lireAdresse } from "./route-rules.js?v=20261109a";

export const ESPACES = ["stagiaire", "equipe", "direction", "siege"];
export const LIBELLES_ESPACE = { stagiaire: "Stagiaire", equipe: "Formateur", direction: "Direction", siege: "Siège" };
// Page d'accueil de chaque espace (route).
export const ACCUEIL_ESPACE = { stagiaire: "home", equipe: "home", direction: "centre", siege: "reseau" };

// Les trois espaces de l'équipe ont la barre latérale ; le stagiaire a la barre du bas.
export function barreLaterale(espace) {
  return espace === "equipe" || espace === "direction" || espace === "siege";
}

// La direction d'un centre et le siège pilotent la formation sans y former : toujours la nouvelle navigation (D4), ni Mon suivi
// ni Planning ; leur accueil est aussi leur page de repli.
export function espaceDePilotage(espace) {
  return espace === "direction" || espace === "siege";
}

// Mémoire de la dernière page (D16) : une par espace. Le stagiaire et le formateur gardent la clé de main (`derniere-route`) : un
// appareil qui a déjà l'app ne perd pas sa dernière page, et l'interrupteur éteint reste celui de main.
export function cleDerniereRoute(espace) {
  return espaceDePilotage(espace) ? "derniere-route:" + espace : "derniere-route";
}

// Les affectations telles que l'app les garde : `{ role, promo_id, lieu_id, lieu_nom }`, le nom du lieu joint d'après la liste
// des lieux lue (`lieux`, nulle quand elle est illisible : le nom manque, la ligne reste). Un rôle inconnu est écarté.
const ROLES_AFFECTATION = ["formateur", "direction", "siege"];
export function normaliserAffectations(lignes, lieux) {
  const noms = new Map((Array.isArray(lieux) ? lieux : []).filter((l) => l && l.id != null).map((l) => [l.id, l.nom ?? null]));
  return (Array.isArray(lignes) ? lignes : [])
    .filter((l) => l && ROLES_AFFECTATION.includes(l.role))
    .map((l) => {
      const lieu = l.lieu_id ?? null;
      return { role: l.role, promo_id: l.promo_id ?? null, lieu_id: lieu, lieu_nom: lieu != null && noms.has(lieu) ? noms.get(lieu) : null };
    });
}

// Quand la table des affectations ne se lit pas, les rôles des promos (mes_promos) disent encore qui dirige quel centre et qui
// est du siège : une direction n'est pas renvoyée dans l'espace de l'équipe pour une lecture ratée. Sans colonne `roles`, rien.
export function affectationsDeSecours(promos) {
  const vues = new Map();
  let siege = false;
  for (const p of Array.isArray(promos) ? promos : []) {
    const roles = p && Array.isArray(p.roles) ? p.roles : [];
    if (roles.includes("siege")) siege = true;
    if (roles.includes("direction") && p.lieu_id != null && !vues.has(p.lieu_id)) {
      vues.set(p.lieu_id, { role: "direction", promo_id: null, lieu_id: p.lieu_id, lieu_nom: p.lieu_nom ?? null });
    }
  }
  return [...(siege ? [{ role: "siege", promo_id: null, lieu_id: null, lieu_nom: null }] : []), ...vues.values()];
}

const ESPACE_DE_APERCU = { formateur: "equipe", direction: "direction", siege: "siege", stagiaire: "stagiaire" };

function liste(affectations) {
  return Array.isArray(affectations) ? affectations : [];
}

// Les espaces ouverts à ce compte, dans l'ordre siège, direction, formateur, stagiaire. Le fondateur, hors
// aperçu, reste dans l'espace de l'équipe ; en aperçu, il n'a que celui-ci. Un aperçu que le compte n'a pas
// le droit de prendre est ignoré.
export function espacesPermis({ profil, promo, affectations, apercu } = {}) {
  if (!profil) return [];
  const a = normaliserApercu(apercu);
  if (a && apercusPermis({ profil, promo }).includes(a)) return [ESPACE_DE_APERCU[a]];
  // Le fondateur (administrateur) reste dans l'espace de l'équipe ; un drapeau de fondateur sans is_admin (le compte stagiaire du
  // banc) garde l'espace de ses droits, comme au lot 4 (roles-rules.js, droitsReels).
  if (profil.is_founder) return [droitsAffiches({ profil, promo }).espace];
  const affs = liste(affectations);
  const permis = [];
  const siege = affs.some((x) => x && x.role === "siege");
  const direction = affs.some((x) => x && x.role === "direction");
  if (siege) permis.push("siege");
  if (direction) permis.push("direction");
  if (promo && Array.isArray(promo.roles)) {
    if (promo.roles.includes("formateur")) permis.push("equipe");
    if (promo.roles.includes("stagiaire")) permis.push("stagiaire");
  } else if (promo || (!siege && !direction)) {
    // Base pas encore migrée (pas de colonne `roles`) ou promos non chargées : les droits du lot 4 font foi.
    const d = droitsAffiches({ profil, promo });
    if (d.admin || d.prof) permis.push("equipe");
    else if (d.stagiaire) permis.push("stagiaire");
  }
  return permis;
}

// Les espaces que propose le menu « Espace » (une ligne chacun) : ceux de la promo affichée, et, pour un compte de direction ou du
// siège, ceux qu'il a dans ses autres promos. Sans cela, une direction qui forme dans un autre centre, une fois entrée dans sa
// direction (D6 l'y fait changer de promo), ne retrouverait plus son espace de formatrice. Un autre compte (le cumul du lot 4,
// stagiaire ici et formateur là) garde la règle du lot 4 : l'espace suit la promo, la pastille suffit. Le fondateur : son espace,
// ou celui de son aperçu.
const ORDRE_DES_ESPACES = ["siege", "direction", "equipe", "stagiaire"];
export function espacesDuCompte({ profil, promo, promos, affectations, apercu } = {}) {
  const permis = espacesPermis({ profil, promo, affectations, apercu });
  if (!profil || profil.is_founder || !permis.some(espaceDePilotage)) return permis;
  const tous = new Set(permis);
  for (const p of Array.isArray(promos) ? promos : []) {
    const roles = p && Array.isArray(p.roles) ? p.roles : [];
    if (roles.includes("formateur")) tous.add("equipe");
    if (roles.includes("stagiaire")) tous.add("stagiaire");
  }
  return ORDRE_DES_ESPACES.filter((e) => tous.has(e));
}

// La promo où ouvrir l'espace formateur ou stagiaire choisi dans le menu, quand la promo affichée ne le donne pas : la première
// promo en cours où le compte a ce rôle, sinon la plus récente ; null quand la promo affichée suffit, qu'aucune ne convient, ou
// pour la direction et le siège (la porte s'en charge, D6).
const ROLE_DE_L_ESPACE = { equipe: "formateur", stagiaire: "stagiaire" };
export function promoPourLEspace({ espace, promo, promos, aujourdhui } = {}) {
  const role = ROLE_DE_L_ESPACE[espace];
  if (!role) return null;
  const a = (p) => !!p && Array.isArray(p.roles) && p.roles.includes(role);
  if (a(promo)) return null;
  return premiereEnCoursSinonRecente((Array.isArray(promos) ? promos : []).filter(a), aujourdhui);
}

// L'espace à ouvrir : le choix mémorisé s'il est encore permis, sinon le premier permis ; null sans espace.
export function espaceChoisi(permis, memorise) {
  const liste = Array.isArray(permis) ? permis : [];
  if (memorise && liste.includes(memorise)) return memorise;
  return liste.length ? liste[0] : null;
}

// Les droits affichés, bridés par l'espace : la direction n'écrit pas comme un formateur ; le siège ne gère ni
// promo ni stagiaire. Une copie, l'entrée n'est pas modifiée.
export function brider(droits, espace) {
  const d = { ...droits };
  if (espace === "direction") d.admin = false;
  if (espace === "siege") {
    d.admin = false;
    d.equipe = false;
    d.stagiaire = false;
  }
  return d;
}

// Rédiger les contenus communs (cours de thème, questions de QCM) : le siège (D13), un formateur administrateur ;
// jamais la direction.
export function peutRedigerContenus({ droits, espace } = {}) {
  if (espace === "siege") return true;
  if (espace === "direction") return false;
  return !!(droits && droits.admin);
}

// Un compte sans promo n'est pas refusé s'il a une affectation siège ou direction (D5) : l'espace qu'il ouvre.
export function porteSansPromo(affectations) {
  const affs = liste(affectations);
  if (affs.some((x) => x && x.role === "siege")) return "siege";
  if (affs.some((x) => x && x.role === "direction")) return "direction";
  return null;
}

function lieuxDiriges(affectations) {
  return liste(affectations).filter((x) => x && x.role === "direction" && x.lieu_id != null);
}

// Le centre affiché (D6) : le lieu de la promo affichée s'il est dirigé par le compte ou en aperçu direction,
// sinon le premier lieu dirigé ; null quand le compte ne dirige aucun centre.
export function centreAffiche({ promo, affectations, apercu } = {}) {
  const dirigés = lieuxDiriges(affectations);
  const enApercu = normaliserApercu(apercu) === "direction";
  if (promo && promo.lieu_id != null && (enApercu || dirigés.some((x) => x.lieu_id === promo.lieu_id))) {
    return { id: promo.lieu_id, nom: promo.lieu_nom };
  }
  if (dirigés.length) return { id: dirigés[0].lieu_id, nom: dirigés[0].lieu_nom };
  return null;
}

function jour(valeur) {
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  return valeur ? String(valeur).slice(0, 10) : "";
}

function enCours(promo, aujourdhui) {
  const debut = jour(promo.date_debut);
  const fin = jour(promo.date_fin);
  return (!debut || debut <= aujourdhui) && (!fin || fin >= aujourdhui);
}

// La promo vers laquelle basculer en entrant dans l'espace direction (D6) : null quand la promo affichée est
// déjà d'un centre dirigé, ou quand le centre dirigé n'a aucune promo ; sinon la première promo en cours de
// ce centre, à défaut la plus récente.
export function promoPourLaDirection({ promo, promos, affectations, aujourdhui } = {}) {
  const dirigés = lieuxDiriges(affectations);
  if (!dirigés.length) return null;
  if (promo && dirigés.some((x) => x.lieu_id === promo.lieu_id)) return null;
  return premiereEnCoursSinonRecente(promosDuCentre(promos, dirigés[0].lieu_id), aujourdhui);
}

// Parmi des promos : l'id de la première en cours (dans l'ordre de la liste), sinon de la plus récente (début le plus tardif) ;
// null sans promo.
function premiereEnCoursSinonRecente(candidates, aujourdhui) {
  if (!candidates.length) return null;
  const today = jour(aujourdhui);
  const courante = candidates.find((p) => enCours(p, today));
  if (courante) return courante.id;
  const recente = [...candidates].sort((a, b) => (jour(b.date_debut) < jour(a.date_debut) ? -1 : jour(b.date_debut) > jour(a.date_debut) ? 1 : 0))[0];
  return recente.id;
}

// Les promos d'un centre : l'unique point où la liste des promos se restreint à un centre.
export function promosDuCentre(promos, lieuId) {
  return (Array.isArray(promos) ? promos : []).filter((p) => p && p.lieu_id === lieuId);
}

// Les promos que l'app charge selon l'aperçu « Voir en tant que » (D3). Le fondateur peut tout lire : en aperçu direction, la limite
// au centre de la promo affichée est d'affichage, posée ici et nulle part ailleurs (js/db.js l'applique là où la liste est chargée,
// si bien que la pastille, les pages et les en-têtes de lecture permis n'ont rien à filtrer) ; en aperçu siège, aucune promo.
// Hors aperçu direction et siège, la liste entière. Une promo affichée sans centre ne laisse voir qu'elle-même.
export function promosVisiblesEnApercu({ promos, promo, apercu } = {}) {
  const liste = Array.isArray(promos) ? promos : [];
  const a = normaliserApercu(apercu);
  if (a === "siege") return [];
  if (a !== "direction") return [...liste];
  if (!promo) return [];
  if (promo.lieu_id == null) return liste.filter((p) => p && p.id === promo.id);
  return promosDuCentre(liste, promo.lieu_id);
}

// Le bandeau d'aperçu : « Aperçu : <libelle>. <suite> ». En direction et en siège, ce que le fondateur modifie est vraiment enregistré
// (la base répond comme pour ce rôle, sans copie) : le bandeau le dit. Formateur et stagiaire : le libellé du lot 4, sans suite.
const SUITE_APERCU_REEL = "Ce que tu modifies ici est vraiment enregistré.";
export function texteBandeauApercu(apercu, centre) {
  if (apercu === "direction") {
    return { libelle: centre && centre.nom ? "Direction du centre " + centre.nom : LIBELLES_ESPACE.direction, suite: SUITE_APERCU_REEL };
  }
  if (apercu === "siege") return { libelle: "Siège du réseau", suite: SUITE_APERCU_REEL };
  return { libelle: LIBELLES_APERCU[apercu] || String(apercu), suite: "" };
}

// Routes de la direction et du siège (section 1 du lot 5). Les pages du menu du compte (nouveautes, preferences,
// problemes) sont permises partout ; `home` mène à l'accueil de l'espace.
const ROUTES_COMMUNES = ["home", "config", "nouveautes", "preferences", "problemes"];
const ROUTES_DIRECTION = ["centre", "promos", "stagiaires", "emargement", "notes", "equipe"];
const ROUTES_SIEGE = ["reseau", "directions", "themes"];
// Pages nouvelles de la direction et du siège : hors de l'espace du formateur et du stagiaire.
const ROUTES_NEUVES = ["promos", "equipe", "reseau", "directions"];

export function routeDansLEspace(espace, route) {
  if (espace === "direction") return ROUTES_COMMUNES.includes(route) || ROUTES_DIRECTION.includes(route);
  if (espace === "siege") return ROUTES_COMMUNES.includes(route) || ROUTES_SIEGE.includes(route);
  return !ROUTES_NEUVES.includes(route);
}

export function phraseHorsEspace(espace) {
  return `Cette page n'est pas dans l'espace ${LIBELLES_ESPACE[espace] || ""}.`.replace(" .", ".");
}

// Phrase d'un refus de la base : les messages de nos fonctions sont préfixés (« equipe: … ») et se lisent sans
// leur préfixe. Fonction absente (avant la migration) et droit manquant sans phrase à nous ont leur phrase.
export const PHRASE_INDISPONIBLE = "Cette action n'est pas encore disponible.";
export const PHRASE_SANS_DROIT = "Tu n'as pas le droit de faire cela ici.";
export const PHRASE_ECHEC = "L'opération n'a pas abouti.";
const PREFIXES_DE_REFUS = /^\s*(?:equipe|promo|centre|reseau|invitation|habillage):\s*/i;
export function phraseDeRefus(message, code) {
  const brut = String(message ?? "");
  if (code === "PGRST202" || /could not find the function/i.test(brut)) return PHRASE_INDISPONIBLE;
  const texte = brut.replace(PREFIXES_DE_REFUS, "").trim();
  if (!texte) return PHRASE_ECHEC;
  if (texte === brut.trim() && (/permission denied/i.test(texte) || code === "42501")) return PHRASE_SANS_DROIT;
  return texte;
}

// Pages que l'app sait ouvrir : une adresse visée après une bascule de promo doit en nommer une.
const ROUTES_CONNUES = [
  "home", "dashboard", "mon-suivi", "planning", "calendrier", "themes", "notes", "ccp2", "stagiaires", "centre", "qualiopi",
  "emargement", "ressources", "config", "preferences", "nouveautes", "problemes", "promos", "equipe", "reseau", "directions",
];

// Adresse visée par `ouvrirDansUnePromo` : un hash de l'app (« #/… », caractères d'adresse seulement) vers une
// page connue ; null sinon, rien n'est posé dans l'historique.
export function adresseApresBascule(valeur) {
  if (typeof valeur !== "string" || !/^#\/[A-Za-z0-9\-_/]+$/.test(valeur)) return null;
  return ROUTES_CONNUES.includes(lireAdresse(valeur).route) ? valeur : null;
}
