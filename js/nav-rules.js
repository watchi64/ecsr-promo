// Navigation par espace (refonte, lot 1) : les règles seulement. Quelles entrées montre
// chaque espace, comment la barre du téléphone les répartit, quelle entrée s'allume pour
// une page, quelle entrée de l'équipe porte le repère « masqué aux stagiaires », où mènent les
// anciennes adresses, les initiales, le prénom et le nom du bouton du compte, la ligne « page à soi »
// du menu du compte. Module pur, sans DOM ni stockage : testé en node.

// Clé de mémoire du sous-onglet ouvert, par page à sous-onglets (le `storageKey` de
// renderSubTabs). Une redirection l'écrit pour ouvrir le bon sous-onglet ; le bouton « Élèves bénévoles »
// du Planning, pour ouvrir celui de Stagiaires (lot 2A).
export const CLES_SOUS_ONGLETS = { planning: "planning.subtab", themes: "themes.subtab", stagiaires: "stagiaires.subtab" };

// `id` vaut la route de la page ouverte ; `court` est le libellé de la barre du téléphone
// (le libellé entier sauf mention) ; `groupe` range l'entrée sous un titre de la barre
// latérale de l'équipe.
function entree(route, libelle, icone, { court = libelle, groupe = null } = {}) {
  return { id: route, route, libelle, court, icone, groupe };
}

// Stagiaire, dans l'ordre de la barre. Planning, Cours et QCM et CCP2 suivent les modules
// ouverts pour la promo ; Accueil et Mon suivi sont toujours là.
const ENTREES_STAGIAIRE = [
  entree("home", "Accueil", "home"),
  entree("planning", "Planning", "calendar"),
  entree("themes", "Cours et QCM", "book"),
  entree("mon-suivi", "Mon suivi", "trend"),
  entree("ccp2", "CCP2", "target"),
];
const TOUJOURS_VISIBLES = ["home", "mon-suivi"];

// Équipe (formateur, admin), dans l'ordre de la barre latérale. Un module fermé n'en retire
// aucune : la coquille la repère au lieu de la masquer. Seul Émargement dépend d'un
// interrupteur de la promo. Accueil devient Aujourd'hui avec la page du même nom (lot 2).
const ENTREES_EQUIPE = [
  entree("home", "Accueil", "home"),
  entree("planning", "Planning", "calendar"),
  entree("emargement", "Émargement", "clipboard"),
  entree("stagiaires", "Stagiaires", "users"),
  entree("notes", "Notes et examens", "edu", { court: "Notes" }),
  entree("themes", "Cours et QCM", "book"),
  entree("ccp2", "CCP2", "target"),
  entree("centre", "Indicateurs", "chart", { groupe: "Promo" }),
  entree("config", "Réglages", "settings", { groupe: "Promo" }),
];

// Ce que la barre du bas du téléphone garde chez l'équipe ; le reste passe dans « Plus ».
const BARRE_TELEPHONE_EQUIPE = ["home", "planning", "stagiaires", "notes"];

// Pages sans entrée à elles : l'entrée allumée est celle de la page qui les remplace ou les
// contient. Chez le stagiaire, `notes` (la classe) vit sous Mon suivi ; chez l'équipe, Notes
// a son entrée, que `entreeActive` trouve avant de consulter cette table.
const ALIAS_ENTREE_ACTIVE = new Map([
  ["calendrier", "planning"],
  ["dashboard", "planning"],
  ["ressources", "themes"],
  ["nouveautes", "home"],
  ["notes", "mon-suivi"],
]);

// Anciennes adresses déplacées : la page visée et le sous-onglet à y ouvrir (les mêmes dans
// les deux espaces). Une Map, comme pour les alias : la route vient de l'adresse tapée, et un
// objet simple répondrait aussi à `constructor` ou `toString`.
const REDIRECTIONS = new Map([
  ["calendrier", { page: "planning", sousOnglet: "dates" }],
  ["dashboard", { page: "planning", sousOnglet: "priorites" }],
  ["ressources", { page: "themes", sousOnglet: "documents" }],
]);

const copie = (e) => ({ ...e });

// "equipe" pour un formateur ou un admin (même avec un profil stagiaire), "stagiaire" sinon.
export function espaceDe({ formateur }) {
  return formateur ? "equipe" : "stagiaire";
}

// Une page est-elle ouverte sous la nouvelle navigation ? Une page qui regroupe d'anciennes
// pages en sous-onglets (Planning : Dates clés et Priorités ; Cours : Documents) l'est dès que
// l'un d'eux l'est, chaque sous-onglet suivant le module de son ancienne page (celles de
// REDIRECTIONS). Cours s'ouvre donc avec ses seuls Documents tant que les cours sont fermés
// pour la promo. Toute autre page suit `routeVisible(route)`.
export function routeVisibleV2(route, routeVisible) {
  if (routeVisible(route)) return true;
  for (const [ancienne, v] of REDIRECTIONS) {
    if (v.page === route && routeVisible(ancienne)) return true;
  }
  return false;
}

// Une entrée de l'équipe est-elle masquée aux stagiaires ? Oui quand le stagiaire ne la voit pas,
// selon la même règle que sa barre (routeVisibleV2) : sa page et tous les sous-onglets qu'elle
// regroupe sont fermés pour la promo. Cours et QCM n'est donc pas repéré tant que ses Documents
// restent ouverts. `routeMasquee(route)` : le module de cette route est fermé (modules-etat.js).
export function entreeMasquee(route, routeMasquee) {
  return !routeVisibleV2(route, (r) => !routeMasquee(r));
}

// Entrées de l'espace, dans l'ordre d'affichage, en copies que l'appelant peut modifier.
// Stagiaire : une page à module s'affiche dès qu'elle est ouverte au sens de `routeVisibleV2`
// (l'un de ses sous-onglets suffit), Accueil et Mon suivi restent toujours. Équipe : aucun
// module fermé n'en retire une (la coquille la repère), et seul Émargement attend
// `emargementActif`.
export function entreesNavigation(espace, { routeVisible, emargementActif }) {
  if (espace === "equipe") {
    return ENTREES_EQUIPE.filter((e) => e.id !== "emargement" || emargementActif).map(copie);
  }
  return ENTREES_STAGIAIRE
    .filter((e) => TOUJOURS_VISIBLES.includes(e.id) || routeVisibleV2(e.route, routeVisible))
    .map(copie);
}

// Barre du bas du téléphone et tiroir « Plus ». Le stagiaire, 5 entrées au plus, les garde
// toutes dans la barre ; l'équipe en garde 4 et range le reste dans `plus`.
export function barreTelephone(espace, entrees) {
  if (espace !== "equipe") return { barre: [...entrees], plus: [] };
  return {
    barre: entrees.filter((e) => BARRE_TELEPHONE_EQUIPE.includes(e.id)),
    plus: entrees.filter((e) => !BARRE_TELEPHONE_EQUIPE.includes(e.id)),
  };
}

// `id` de l'entrée à allumer pour une route : celle qui porte ce nom, sinon celle de la page
// qui la remplace ; null quand aucune entrée de la liste ne la couvre.
export function entreeActive(route, entrees) {
  const ids = entrees.map((e) => e.id);
  if (ids.includes(route)) return route;
  const cible = ALIAS_ENTREE_ACTIVE.get(route);
  return ids.includes(cible) ? cible : null;
}

// Initiales du bouton du compte, tirées du nom que l'app affiche (getProfileWho) : « V. Timy »
// (initiale du nom puis prénom, voir displayStagiaire) donne « TV », prénom d'abord ; sinon la
// première lettre du premier et du dernier mot ; d'une adresse électronique, sa partie locale.
// Un nom vide n'en donne aucune (chaîne vide).
export function initialesDe(nom) {
  const texte = String(nom ?? "").trim();
  const local = texte.includes("@") ? texte.slice(0, texte.indexOf("@")).replace(/[._+-]+/g, " ") : texte;
  const mots = local.split(/[\s-]+/).filter(Boolean);
  if (mots.length > 1 && /^\p{L}\.$/u.test(mots[0])) mots.push(mots.shift());
  const lettres = mots.map((m) => (m.match(/\p{L}/u) || [""])[0]).filter(Boolean);
  if (!lettres.length) return "";
  const choisies = lettres.length > 1 ? lettres[0] + lettres[lettres.length - 1] : lettres[0];
  return choisies.toLocaleUpperCase("fr");
}

// Rôle affiché sous le nom de la personne (barre de l'équipe, menu du compte) : son vrai rôle, et
// non l'aperçu « Voir en tant que ». Tout compte qui n'est ni stagiaire ni fondateur est formateur
// (le rôle technique « prof » ne s'affiche jamais).
export function libelleRole(profil) {
  if (!profil) return "";
  if (profil.is_founder) return "Fondateur";
  return profil.role === "stagiaire" ? "Stagiaire" : "Formateur";
}

// Prénom affiché à côté des initiales, tiré du même nom : « V. Timy » (initiale du nom puis
// prénom, voir displayStagiaire) donne « Timy », tout ce qui suit l'initiale ; sinon le premier
// mot (« Camille Martin » donne « Camille »). Une adresse électronique n'a pas de prénom : chaîne
// vide, comme un nom vide (les initiales suffisent alors).
export function prenomDe(nom) {
  const texte = String(nom ?? "").trim();
  if (!texte || texte.includes("@")) return "";
  const mots = texte.split(/\s+/);
  if (mots.length > 1 && /^\p{L}\.$/u.test(mots[0])) return mots.slice(1).join(" ");
  return mots[0];
}

// Nom du bouton du compte (aria-label et infobulle) : « Mon compte », puis le nom et le rôle que le
// bouton montre (le rôle n'est affiché que dans la barre de l'équipe : le nom accessible contient le
// texte visible, WCAG 2.5.3), puis les nouveautés non lues que compte sa pastille (`nonLues` : le
// texte de la pastille, libellePastille de js/nouveautes.js, vide à zéro).
export function nomDuBoutonCompte({ nom = "", role = "", nonLues = "" } = {}) {
  const qui = [nom, role].filter(Boolean).join(", ");
  const base = qui ? `Mon compte (${qui})` : "Mon compte";
  if (!nonLues) return base;
  return `${base}, ${nonLues} ${nonLues === "1" ? "nouveauté non lue" : "nouveautés non lues"}`;
}

// Ligne « page à soi » du menu du compte (ruling R30, une chose à un endroit) : la page à soi de la
// personne (pagePersonnelle de js/route-rules.js : « mon-suivi » ou « stagiaires »), sauf quand la
// barre affichée a déjà une entrée qui y mène ; null alors, et le menu n'a pas cette ligne.
export function pageASoiDuMenu(page, entrees) {
  return entrees.some((e) => e.route === page) ? null : page;
}

// Où mène une ancienne adresse sous la nouvelle navigation : null (rien à rediriger) ou la
// nouvelle adresse avec le sous-onglet à ouvrir (`cle` : sa clé de mémoire, `valeur` : son
// identifiant). Seule la route décide : `id` et `partie` n'existent que pour Stagiaires et
// Mon espace, jamais redirigés. `notes` ne bouge que chez le stagiaire (la classe, sous Mon
// suivi) ; l'équipe garde sa page Notes. De même `config` : Réglages (la promo) est la page de
// l'équipe, le stagiaire arrive sur Mes préférences (lot 2A). Aucune cible n'est elle-même
// redirigée : pas de boucle.
export function redirectionV2({ route }, espace) {
  const v = REDIRECTIONS.get(route);
  if (v) {
    const sousOnglet = { cle: CLES_SOUS_ONGLETS[v.page], valeur: v.sousOnglet };
    return { hash: "#/" + v.page, sousOnglet };
  }
  if (route === "notes" && espace !== "equipe") {
    return { hash: "#/mon-suivi/classe", sousOnglet: null };
  }
  if (route === "config" && espace !== "equipe") {
    return { hash: "#/preferences", sousOnglet: null };
  }
  return null;
}

// Le même geste avec l'ancienne navigation (interrupteur éteint) : Mes préférences n'existe qu'avec la
// nouvelle, et #/preferences (un favori pris sous la nouvelle, la promo éteinte depuis) mène à Paramètres,
// où vivent ces réglages. Toute autre adresse reste celle de main. Même forme que redirectionV2 ; la cible
// n'est pas elle-même redirigée.
export function redirectionAncienne({ route }) {
  return route === "preferences" ? { hash: "#/config", sousOnglet: null } : null;
}
