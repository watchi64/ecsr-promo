/*
 * Titres et droits à la carte (étape 3) : règles pures, sans réseau ni DOM, testées par
 * `node --test tests/titres-rules.test.mjs`. La base décide (fonctions `case_*`, `geste_*`) ; ces fonctions décident de ce que
 * l'app affiche : barre latérale, bandeaux de l'éditeur de titres, phrases.
 *
 * Les valeurs de cases venant de la base sont les chaînes « non », « voir », « modifier » (jsonb de `mes_titres`,
 * `titres_visibles`) ; `casesDeLEspace` les convertit en 0 (Non), 1 (Voir), 2 (Modifier).
 */

// Les pages de chaque niveau, dans l'ordre de la fonction SQL `_pages_du_niveau` (migration 20261112_titres_1_tables.sql).
// `plafond` : 2 (Voir et Modifier) ou 1 (Voir seul). `route` : la route de l'app qui porte la case.
export const PAGES_DU_NIVEAU = {
  promo: [
    { page: "planning", libelle: "Planning", route: "planning", plafond: 2 },
    { page: "emargement", libelle: "Émargement", route: "emargement", plafond: 2 },
    { page: "stagiaires", libelle: "Stagiaires", route: "stagiaires", plafond: 2 },
    { page: "notes", libelle: "Notes et examens", route: "notes", plafond: 2 },
    { page: "cours", libelle: "Cours et QCM", route: "themes", plafond: 2 },
    { page: "ccp2", libelle: "CCP2", route: "ccp2", plafond: 1 },
    { page: "indicateurs", libelle: "Indicateurs", route: "centre", plafond: 1 },
    { page: "reglages", libelle: "Réglages de la promo", route: "config", plafond: 2 },
  ],
  centre: [
    { page: "promos", libelle: "Promos", route: "promos", plafond: 2 },
    { page: "stagiaires", libelle: "Stagiaires", route: "stagiaires", plafond: 2 },
    { page: "emargement", libelle: "Émargement", route: "emargement", plafond: 1 },
    { page: "notes", libelle: "Notes et examens", route: "notes", plafond: 1 },
    { page: "equipe", libelle: "Équipe", route: "equipe", plafond: 2 },
    { page: "reglages", libelle: "Réglages du centre", route: "config", plafond: 2 },
  ],
  reseau: [
    { page: "cours", libelle: "Cours et QCM", route: "themes", plafond: 2 },
    { page: "directions", libelle: "Directions de centre", route: "directions", plafond: 2 },
    { page: "reglages", libelle: "Réglages du réseau", route: "config", plafond: 2 },
  ],
};

// Niveau de titre que porte chaque espace de l'équipe.
export const NIVEAU_DE_L_ESPACE = { equipe: "promo", direction: "centre", siege: "reseau" };

// Les routes qui ont une case : toute autre route (accueil, messages, contacts...) n'est jamais filtrée.
export const ROUTES_A_CASE = new Set(Object.values(PAGES_DU_NIVEAU).flatMap((pages) => pages.map((p) => p.route)));

const VALEUR_DE_LA_CHAINE = { non: 0, voir: 1, modifier: 2 };

function pagesDe(niveau) {
  return PAGES_DU_NIVEAU[niveau] || [];
}

function plafondDe(niveau, page) {
  const p = pagesDe(niveau).find((x) => x.page === page);
  return p ? p.plafond : 0;
}

// Convertit une case de la base (« non », « voir », « modifier ») en 0, 1 ou 2, bornée par le plafond de la page.
function valeurBornee(niveau, page, brute) {
  const v = typeof brute === "number" ? brute : VALEUR_DE_LA_CHAINE[brute];
  if (!(v >= 0)) return 0;
  return Math.min(Math.min(v, 2), plafondDe(niveau, page));
}

function titreCouvre(titre, niveau, promoId, lieuId) {
  if (!titre || titre.niveau !== niveau) return false;
  if (niveau === "promo") return Array.isArray(titre.promo_ids) && promoId != null && titre.promo_ids.includes(promoId);
  if (niveau === "centre") return lieuId != null && titre.lieu_id === lieuId;
  return true;
}

// Les cases de l'espace affiché : `{ page: 0|1|2 }`. Nul : les titres ne gouvernent pas (le fondateur hors aperçu, la lecture
// ratée, le stagiaire) ; l'app lit alors le plafond via `caseDe`, comme la base pour le fondateur.
export function casesDeLEspace({ espace, titres, promoId = null, lieuId = null, fondateur = false } = {}) {
  const niveau = NIVEAU_DE_L_ESPACE[espace];
  if (!niveau || fondateur || !Array.isArray(titres)) return null;
  const cases = {};
  for (const { page } of pagesDe(niveau)) cases[page] = 0;
  for (const titre of titres) {
    if (!titreCouvre(titre, niveau, promoId, lieuId)) continue;
    const brutes = titre.cases || {};
    for (const { page } of pagesDe(niveau)) cases[page] = Math.max(cases[page], valeurBornee(niveau, page, brutes[page]));
  }
  return cases;
}

// La case d'une page ; `cases` nul : le plafond de la page.
export function caseDe(cases, page, niveau) {
  if (cases == null) return plafondDe(niveau, page);
  const v = cases[page];
  return v === 0 || v === 1 || v === 2 ? v : 0;
}

// Un droit d'écran selon la case : quand les cases sont lues (`cases` non nul), la case décide (`droit`, vrai pour Modifier ou
// Voir selon l'appelant) ; sinon (fondateur hors aperçu, titre fixe sans lecture, panne, espace stagiaire, ancien modèle) l'ancien
// prédicat (`ancien`, isAdmin() ou isEquipe()) reste seul juge. `peutVoir` et `peutModifier` valent vrai quand les cases sont
// nulles (plafond) : sans ce garde, un compte qui n'était pas admin gagnerait l'accès.
export function selonLaCase({ cases, droit, ancien } = {}) {
  return cases ? !!droit : !!ancien;
}

// Les choix offerts par l'éditeur pour une page.
export function choixDeLaPage(niveau, page) {
  if (page === "reglages") return ["non", "modifier"];
  return plafondDe(niveau, page) >= 2 ? ["non", "voir", "modifier"] : ["non", "voir"];
}

// Une page qui montre des noms de stagiaires exige Stagiaires au moins sur « Voir » (spec § 5.4, `_cases_valides`).
const PAGES_A_NOMS = { promo: ["planning", "emargement", "notes", "indicateurs"], centre: ["emargement", "notes"] };
export const PHRASE_STAGIAIRES_RELEVE = "Stagiaires passe à « Voir » : cette page montre des noms de stagiaires.";

// `cases` : valeurs de l'éditeur (chaînes « non », « voir », « modifier »).
export function releverStagiaires(niveau, cases) {
  const entree = { ...(cases || {}) };
  const montreDesNoms = (PAGES_A_NOMS[niveau] || []).some((p) => (entree[p] || "non") !== "non");
  if (montreDesNoms && (entree.stagiaires || "non") === "non") {
    entree.stagiaires = "voir";
    return { cases: entree, releve: true };
  }
  return { cases: entree, releve: false };
}

export const BANDEAU_EQUIPE =
  "Équipe sur « Modifier » : la personne pourra inviter et donner des titres de promo, donc confier à d'autres ce qu'elle ne fait pas elle-même. Chaque nomination reste dans le journal.";
export const BANDEAU_COURS =
  "Cours et QCM sur « Modifier » : les cours et les questions sont communs à tout le réseau ; une modification vaut pour tous les centres.";
export const BANDEAU_DIRECTIONS =
  "Directions de centre sur « Modifier » : la personne pourra donner des titres de centre dans tous les centres, qui voient des noms de stagiaires qu'elle ne voit pas. Chaque nomination reste dans le journal.";

export function bandeaux(niveau, cases) {
  const c = cases || {};
  const liste = [];
  if (niveau === "centre" && c.equipe === "modifier") liste.push(BANDEAU_EQUIPE);
  if (niveau === "reseau" && c.cours === "modifier") liste.push(BANDEAU_COURS);
  if (niveau === "reseau" && c.directions === "modifier") liste.push(BANDEAU_DIRECTIONS);
  return liste;
}

export function phrasePorteurs(n) {
  if (!n || n < 1) return null;
  return n === 1
    ? "1 personne a ce titre : ses droits changeront dès l'enregistrement."
    : `${n} personnes ont ce titre : leurs droits changeront dès l'enregistrement.`;
}

// Personne ne porte le titre dans le centre (n nul ou absent) : la première phrase seule.
export function phraseVersionCentre(n) {
  const debut = "Ce titre vient du réseau : l'ajuster crée la version de votre centre.";
  if (!(n >= 1)) return debut;
  const suite = n === 1 ? "1 personne passera" : `${n} personnes passeront`;
  return `${debut} ${suite} à la version du centre.`;
}

// Ce que le titre permet : les pages non à « Non », dans l'ordre du niveau.
export function ceQueJePeuxFaire(titre) {
  const niveau = titre && titre.niveau;
  const brutes = (titre && titre.cases) || {};
  const liste = [];
  for (const { page, libelle } of pagesDe(niveau)) {
    const v = valeurBornee(niveau, page, brutes[page]);
    if (v >= 1) liste.push({ libelle, valeur: v === 2 ? "Modifier" : "Voir" });
  }
  return liste;
}

// Le nom des promos : une table `{ id: nom }` ou une Map.
function nomDePromo(promoNoms, id) {
  if (!promoNoms) return null;
  return (promoNoms instanceof Map ? promoNoms.get(id) : promoNoms[id]) ?? null;
}

function nombrePromos(n) {
  return n === 1 ? "1 promo" : `${n} promos`;
}

// « Secrétariat · Centre de Nîmes », « Formateur · 2 promos », « Formateur · Promo mars 2026 », « Siège » (réseau).
export function libelleTitre(titre, { lieuNom = null, promoNoms = null } = {}) {
  if (!titre) return "";
  if (titre.niveau === "reseau") return titre.nom;
  if (titre.niveau === "centre") {
    const lieu = lieuNom ?? titre.lieu_nom ?? null;
    return lieu ? `${titre.nom} · ${lieu}` : titre.nom;
  }
  const ids = Array.isArray(titre.promo_ids) ? titre.promo_ids : [];
  if (ids.length === 0) return titre.nom;
  if (ids.length === 1) return `${titre.nom} · ${nomDePromo(promoNoms, ids[0]) ?? "1 promo"}`;
  return `${titre.nom} · ${nombrePromos(ids.length)}`;
}

// Un libellé par titre de la personne (lignes de `personnes_et_titres`), titres de centre et de réseau d'abord.
export function pastillesDePersonne(lignes, email) {
  const moi = String(email || "").toLowerCase();
  const siennes = (Array.isArray(lignes) ? lignes : []).filter((l) => String(l.email || "").toLowerCase() === moi);
  const rang = (l) => (l.niveau === "promo" ? 1 : 0);
  return siennes
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rang(a.l) - rang(b.l) || a.i - b.i)
    .map(({ l }) => {
      const n = Array.isArray(l.promo_ids) ? l.promo_ids.length : 0;
      return l.niveau === "promo" && n > 1 ? `${l.titre_nom} · ${nombrePromos(n)}` : l.titre_nom;
    });
}

// Les titres qu'on peut donner (`titres_visibles`, `donnable` vrai), par groupe, dans l'ordre réseau, centre, promos.
export function titresDonnablesGroupes(titres) {
  const donnables = (Array.isArray(titres) ? titres : []).filter((t) => t && t.donnable);
  const groupes = [
    { groupe: "Pour tout le réseau", niveau: "reseau" },
    { groupe: "Pour tout le centre", niveau: "centre" },
    { groupe: "Pour certaines promos", niveau: "promo" },
  ];
  return groupes
    .map(({ groupe, niveau }) => ({ groupe, titres: donnables.filter((t) => t.niveau === niveau) }))
    .filter((g) => g.titres.length > 0);
}

// « 09/11 » : jour et mois à l'heure de Paris.
function jourMois(quand) {
  const d = new Date(quand);
  if (Number.isNaN(d.getTime())) return "";
  const parties = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" }).formatToParts(d);
  const jour = parties.find((p) => p.type === "day").value;
  const mois = parties.find((p) => p.type === "month").value;
  return `${jour}/${mois}`;
}

// Une ligne du journal (`journal_des_droits`) en une phrase ; `nomDe(email)` rend le nom connu ou l'adresse.
export function phraseJournal(ligne, nomDe = (e) => e) {
  const l = ligne || {};
  const auteur = l.par === "système" ? "L'application" : nomDe(l.par);
  const pour = l.pour ? nomDe(l.pour) : "";
  const titre = l.titre_nom;
  const actions = {
    donne: `a donné le titre ${titre} à ${pour}`,
    retire: `a retiré le titre ${titre} à ${pour}`,
    change: `a changé le titre de ${pour} en ${titre}`,
    cree: `a créé le titre ${titre}`,
    ajuste: `a ajusté le titre ${titre}`,
    supprime: `a supprimé le titre ${titre}`,
  };
  return `${jourMois(l.quand)}, ${auteur} ${actions[l.action] || "a modifié un titre"}`;
}

// Le formateur de la promo a-t-il le titre fixe (les gestes définitifs lui restent réservés, M5) ? Nul : lecture ratée.
// `mes_titres` ne dit pas « fixe » : le titre fixe de promo s'appelle « Formateur » ; `fixe` l'emporte quand la ligne le porte.
export function formateurFixeSur(titres, promoId) {
  if (!Array.isArray(titres)) return null;
  return titres.some((t) => titreCouvre(t, "promo", promoId, null) && (typeof t.fixe === "boolean" ? t.fixe : t.nom === "Formateur"));
}

// La direction du centre a-t-elle le titre fixe sur ce centre ? Nul : lecture ratée. Même convention que formateurFixeSur : `fixe`
// l'emporte quand la ligne le porte, sinon le titre fixe de centre s'appelle « Direction de centre ».
export function directionFixeSur(titres, lieuId) {
  if (!Array.isArray(titres)) return null;
  return titres.some((t) => titreCouvre(t, "centre", null, lieuId) && (typeof t.fixe === "boolean" ? t.fixe : t.nom === "Direction de centre"));
}

// La section « Données personnelles » des Réglages du centre (purge des bénévoles, conservation) : au fondateur hors aperçu et à la
// direction fixe du centre ; jamais à un titre de centre non fixe (la base le refuserait). Titres non lus (panne, ancien modèle) :
// comme avant, la section reste offerte.
export function donneesDuCentreVisibles({ titres, lieuId, fondateur = false } = {}) {
  if (fondateur) return true;
  const fixe = directionFixeSur(titres, lieuId);
  return fixe === null ? true : fixe;
}

// Aperçu par titre (fondateur) : les titres que le choix « Titre » propose pour un aperçu (formateur, direction, siège), lus par
// titres_visibles hors aperçu : `listes` = { centre: lignes de titres_visibles(<centre affiché>) ou null, reseau: lignes de
// titres_visibles(null) ou null }. Titres du niveau de l'aperçu seulement, le titre fixe d'abord, puis l'ordre de la base. Un titre
// absent des lectures n'est jamais deviné : liste vide quand la lecture manque.
const NIVEAU_DE_L_APERCU = { formateur: "promo", direction: "centre", siege: "reseau" };
export function titresPourApercu(listes, apercu) {
  const niveau = NIVEAU_DE_L_APERCU[apercu];
  if (!niveau || !listes) return [];
  const source = niveau === "reseau" ? listes.reseau : listes.centre;
  if (!Array.isArray(source)) return [];
  const duNiveau = source.filter((t) => t && t.niveau === niveau && t.id != null);
  return [...duNiveau.filter((t) => t.fixe), ...duNiveau.filter((t) => !t.fixe)]
    .map((t) => ({ id: String(t.id), nom: t.nom, fixe: !!t.fixe }));
}

// Mémoire de la liste du choix « Titre » : `{ reseau, centres: { [lieuId]: lignes } }`, une liste par centre (la liste d'un autre
// centre ne sert jamais). `fusionnerListesApercu` rend la nouvelle mémoire, ou l'ancienne quand les deux lectures ont raté (une
// lecture ratée n'est pas mémorisée : la prochaine ouverture du menu relit) ; une lecture qui a réussi est gardée.
export function fusionnerListesApercu(memoire, lieuId, centre, reseau) {
  const base = memoire && typeof memoire === "object" ? memoire : { reseau: null, centres: {} };
  const centres = { ...(base.centres || {}) };
  const centreLu = lieuId != null && Array.isArray(centre);
  const reseauLu = Array.isArray(reseau);
  if (!centreLu && !reseauLu) return memoire || null;
  if (centreLu) centres[String(lieuId)] = centre;
  return { reseau: reseauLu ? reseau : base.reseau, centres };
}
// Ce que la mémoire sait pour le centre affiché : `{ centre, reseau }` (champs nuls quand non lus), à passer à titresPourApercu.
export function listesPourLeCentre(memoire, lieuId) {
  const m = memoire && typeof memoire === "object" ? memoire : {};
  const centre = lieuId != null && m.centres ? m.centres[String(lieuId)] : null;
  return { centre: Array.isArray(centre) ? centre : null, reseau: Array.isArray(m.reseau) ? m.reseau : null };
}
// Faut-il (re)lire ? Oui quand une des listes utiles au centre affiché manque.
export function listesApercuIncompletes(memoire, lieuId) {
  const l = listesPourLeCentre(memoire, lieuId);
  return !l.reseau || (lieuId != null && !l.centre);
}
