/**
 * Pièces communes aux pages à cartes de la nouvelle navigation (Accueil du stagiaire, Aujourd'hui du formateur) :
 * la carte qui se charge seule, le lien vers une page, la ligne-lien d'une liste, la pastille de date, la lecture
 * de la semaine partagée entre cartes, et la relecture tant que la carte est à l'écran. Les classes sont celles de
 * css/pages.css.
 */
import { el, clear, isoDate } from "../utils.js?v=20261106a";
import { icon } from "../icons.js?v=20261106a";
import { STORAGE_SOUS_ONGLET } from "../nouveautes.js?v=20261106a";
import { hrefLien } from "../route-rules.js?v=20261106a";
import { chargerSemaine } from "../planning-lecture.js?v=20261106a";

// Une carte : { noeud, corps, titre }. `corps` est le nœud que la lecture remplit plus tard ; `titre` (le h2) change
// quand le titre dépend de ce qui a été lu.
export function carte({ titre, ico, plus = null, classe = "", zone }) {
  const corps = el("div", { class: "acc-corps" }, el("p", { class: "muted" }, "Chargement…"));
  const h2 = el("h2", {}, titre);
  const noeud = el("section", { class: "acc-carte " + classe, "data-zone": zone },
    el("div", { class: "acc-carte-tete" },
      el("span", { class: "acc-carte-ico", "aria-hidden": "true" }, icon[ico]()),
      h2,
      plus,
    ),
    corps,
  );
  return { noeud, corps, titre: h2 };
}

// Lien vers une page. Une partie de Mon suivi se vise par l'adresse ; un sous-onglet de Cours et QCM ou de Stagiaires
// passe par la mémoire de renderSubTabs (comme le lien « Où le trouver » d'une Nouveauté).
export function lienVers(route, sousOnglet, classe, ...contenu) {
  return lienAdresse({ route, sousOnglet }, classe, ...contenu);
}

// `adresse` : une adresse toute faite (la fiche d'un stagiaire), qui remplace celle de la route.
function lienAdresse({ route, sousOnglet, adresse = null }, classe, ...contenu) {
  const href = adresse || hrefLien({ route, sousOnglet });
  return el("a", {
    class: classe, href,
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[route];
      if (!cle || !sousOnglet || href !== "#/" + route) return;
      try { localStorage.setItem(cle, sousOnglet); } catch (e) { /* mémoire indisponible : la page s'ouvre sur son premier onglet */ }
    },
  }, ...contenu);
}

export const plusLien = (route, texte) => lienVers(route, null, "acc-plus", texte, icon.chevronRight());

// Une ligne d'une liste de carte, entièrement cliquable : pastille d'icône, titre, détail, chevron. `fin` : un repère
// posé à droite à la place du chevron.
export function ligneLien({ route, sousOnglet = null, adresse = null, ico, titre, detail = "", fin = null }) {
  return lienAdresse({ route, sousOnglet, adresse }, "acc-ligne",
    el("span", { class: "acc-ligne-ico", "aria-hidden": "true" }, icon[ico]()),
    el("span", { class: "acc-ligne-texte" }, el("b", {}, titre), detail ? el("span", {}, detail) : null),
    fin || el("span", { class: "acc-ligne-fin", "aria-hidden": "true" }, icon.chevronRight()),
  );
}

// Le message d'une lecture qui a échoué, avec « Réessayer » : dans le corps de la carte, annoncé aux lecteurs d'écran.
export function erreurAvecReessai(corps, texte, relire) {
  clear(corps);
  corps.appendChild(el("p", { class: "acc-erreur", role: "alert" }, texte + " ",
    el("button", { type: "button", class: "acc-reessayer", onClick: relire }, "Réessayer")));
}

// Une ligne d'une liste de carte dont l'action est un bouton, pas la ligne entière (une liste où chaque ligne porte son
// verbe : « S'entraîner », « Relire »). Même pastille d'icône, même titre et même détail que ligneLien. `puces` : des
// repères courts posés avant le bouton (« Examen ouvert »). `bouton` : { texte, primaire, nom, onClick } ; `nom` est le nom
// complet du bouton pour un lecteur d'écran (« S'entraîner : Thème 22 · Feux du véhicule »), parce que dix boutons
// « S'entraîner » à la suite ne disent pas lequel est lequel.
export function ligneAction({ ico, titre, detail = "", puces = [], bouton }) {
  return el("div", { class: "acc-ligne acc-ligne-action" },
    el("span", { class: "acc-ligne-ico", "aria-hidden": "true" }, icon[ico]()),
    el("span", { class: "acc-ligne-texte" }, el("b", {}, titre), detail ? el("span", {}, detail) : null),
    el("span", { class: "acc-ligne-actions" },
      ...puces.filter(Boolean).map((p) => el("span", { class: "acc-ligne-puce" }, p)),
      el("button", { type: "button", class: "btn" + (bouton.primaire ? " primary" : ""), "aria-label": bouton.nom || null, onClick: bouton.onClick }, bouton.texte),
    ),
  );
}

// La pastille de date de l'en-tête, signature de l'app : le jour de la semaine, le grand chiffre, le mois.
export function pastilleDuJour(maintenant, { annee = false } = {}) {
  return el("div", { class: "home-today-strip" },
    el("div", { class: "home-today-pill" },
      el("span", { class: "home-today-weekday" }, maintenant.toLocaleDateString("fr-FR", { weekday: "long" })),
      el("span", { class: "home-today-num" }, String(maintenant.getDate())),
      el("span", { class: "home-today-month" }, maintenant.toLocaleDateString("fr-FR", { month: "long" })
        + (annee ? " " + maintenant.getFullYear() : "")),
    ),
  );
}

// Le jour de la visite : { jour, indexJour, lundi }. `jour` : « AAAA-MM-JJ » ; `indexJour` : 0 = lundi ... 6 = dimanche ;
// `lundi` : le lundi de la semaine de la date du jour. lundiEnCours (journee-rules) donne celui de la semaine SUIVANTE le
// week-end, qui n'est pas celle dont on veut la journée ni les thèmes déjà vus.
export function reperesDuJour(maintenant) {
  const indexJour = (maintenant.getDay() + 6) % 7;
  const lundi = isoDate(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - indexJour));
  return { jour: isoDate(maintenant), indexJour, lundi };
}

// La semaine du planning, lue une fois par visite pour les cartes qui s'en servent. `neuve` : relire (« Réessayer »
// après un échec).
export function semaineDeLaVisite(lundi) {
  let lecture = null;
  return (neuve = false) => {
    if (!lecture || neuve) lecture = chargerSemaine(lundi);
    return lecture;
  };
}

// Relit tant que la carte est à l'écran : au rythme de `intervalleMs` quand la page est visible, au retour au premier
// plan, et à l'événement « emargement-signe ». La relecture s'arrête d'elle-même quand la carte a quitté la page.
export function surveiller(corps, relire, intervalleMs) {
  const relance = () => { if (corps.isConnected) relire(); else arreter(); };
  const surVisible = () => { if (!document.hidden) relance(); };
  const minuteur = setInterval(surVisible, intervalleMs);
  function arreter() {
    clearInterval(minuteur);
    window.removeEventListener("emargement-signe", relance);
    document.removeEventListener("visibilitychange", surVisible);
  }
  window.addEventListener("emargement-signe", relance);
  document.addEventListener("visibilitychange", surVisible);
}
