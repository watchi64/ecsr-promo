// Onglet CCP2 (chantier D) : parcours guidé du certificat « Sensibiliser
// l'ensemble des usagers de la route ». Texte dans js/ccp2-parcours-data.js,
// dates tirées du Calendrier de la promo. Lecture seule : aucun contrôle d'édition.
// C'est le guide du candidat : il tutoie, y compris quand l'équipe l'ouvre (décision du 10/11) ; une phrase en tête
// le dit à l'équipe, et à elle seule.
import { el, clear, formatDate, isoDate } from "../utils.js?v=20261111f";
import { listAgendaEvents } from "../db.js?v=20261111f";
import { routeVisible, moduleVisible } from "../modules-etat.js?v=20261111f";
import { STORAGE_SOUS_ONGLET } from "../nouveautes.js?v=20261111f";
import { hrefLien } from "../route-rules.js?v=20261111f";
import { datesCcp2, insecables } from "../ccp-rules.js?v=20261111f";
import { EPREUVE, ETAPES } from "../ccp2-parcours-data.js?v=20261111f";
import { icon } from "../icons.js?v=20261111f";
import { selonPublic } from "../auth-admin.js?v=20261111f";

// Dernière étape ouverte, rouverte au retour sur l'onglet.
const CLE_ETAPE = "ecsr_ccp2_etape";

function lireEtape() {
  try { return localStorage.getItem(CLE_ETAPE); } catch (e) { return null; }
}
function ecrireEtape(cle) {
  try {
    if (cle) localStorage.setItem(CLE_ETAPE, cle);
    else localStorage.removeItem(CLE_ETAPE);
  } catch (e) { /* navigation privée : pas de mémoire, toutes les étapes restent repliées */ }
}

// Lien d'une rubrique : fichier ou site (nouvel onglet), ou page de l'app. Une page
// dont le module est fermé pour la promo n'est pas proposée.
function lien(l) {
  if (l.href) return el("a", { href: l.href, target: "_blank", rel: "noopener" }, l.label);
  if (l.module && !moduleVisible(l.module)) return null;
  if (!routeVisible(l.route)) return null;
  const href = hrefLien(l);
  return el("a", {
    href,
    // Comme les liens « Où le trouver » des nouveautés : une partie de Mon espace
    // par l'adresse, un sous-onglet de Notes ou de Cours par la mémoire de renderSubTabs.
    onClick: () => {
      const cle = STORAGE_SOUS_ONGLET[l.route];
      if (!cle || !l.sousOnglet || href !== "#/" + l.route) return;
      try { localStorage.setItem(cle, l.sousOnglet); } catch (e) { /* ignore */ }
    },
  }, l.label);
}

function listeLiens(liens) {
  const items = (liens || []).map(lien).filter(Boolean);
  return items.length ? el("ul", { class: "ccp2-liens" }, ...items.map((a) => el("li", {}, a))) : null;
}

function rubrique(titre, points) {
  if (!points || points.length === 0) return null;
  return el("section", { class: "ccp2-rubrique" },
    el("h4", {}, titre),
    el("ul", {}, ...points.map((p) => el("li", {}, insecables(p)))),
  );
}

// Lot 2B : la page ouvre sur le parcours, et l'épreuve, utile une fois
// mais pas à chaque visite, se replie en bas de page. Même dessin qu'une carte d'étape (pastille,
// titre, une ligne de résumé, chevron) pour qu'on la lise comme une carte qui s'ouvre. Toujours
// repliée à l'arrivée : seule l'étape ouverte la dernière fois est mémorisée.
function epreuveRepliee() {
  return el("details", { class: "ccp2-etape ccp2-epreuve-repliee" },
    el("summary", {},
      el("span", { class: "ccp2-etape-num ccp2-epreuve-ico", "aria-hidden": "true" }, icon.info()),
      el("span", { class: "ccp2-etape-titre" }, EPREUVE.titre),
      el("span", { class: "ccp2-etape-bref" }, "Durée, déroulé devant le jury, productions à préparer et référentiels."),
      chevron(),
    ),
    el("div", { class: "ccp2-etape-corps" },
      el("ul", { class: "ccp2-epreuve-points" }, ...EPREUVE.points.map((p) => el("li", {}, insecables(p)))),
      listeLiens(EPREUVE.liens),
    ),
  );
}

// Repère d'ouverture des cartes repliables : un chevron qui pivote à l'ouverture.
function chevron() {
  return el("span", { class: "ccp2-chevron", "aria-hidden": "true" }, icon.chevronDown());
}

function periode(e) {
  if (!e.date_end || e.date_end === e.date_start) return formatDate(e.date_start);
  return `${formatDate(e.date_start)} → ${formatDate(e.date_end)}`;
}

// Dates CCP2 de la promo, lues dans le Calendrier. Un bonus : en cas d'échec ou sans
// événement CCP2, la section reste masquée.
async function remplirDates(section) {
  let evenements;
  try { evenements = await listAgendaEvents(); }
  catch (e) { console.error("Parcours CCP2 : dates indisponibles.", e); return; }
  const dates = datesCcp2(evenements, isoDate(new Date()));
  if (dates.length === 0) return;
  section.appendChild(el("h3", {}, "Tes dates"));
  section.appendChild(el("ul", { class: "ccp2-dates-liste" },
    ...dates.map((d) => el("li", { class: "ccp2-date" + (d.passe ? " passe" : "") },
      el("span", { class: "ccp2-date-titre" }, d.title),
      el("span", { class: "ccp2-date-periode" }, periode(d) + (d.passe ? " · passé" : "")),
    )),
  ));
  section.hidden = false;
}

function carteEtape(etape, ouverte) {
  const liens = listeLiens(etape.liens);
  const details = el("details", { class: "ccp2-etape", open: ouverte ? "" : null },
    el("summary", {},
      el("span", { class: "ccp2-etape-num" }, String(etape.num)),
      el("span", { class: "ccp2-etape-titre" }, etape.titre),
      el("span", { class: "ccp2-etape-bref" }, insecables(etape.enBref)),
      chevron(),
    ),
    el("div", { class: "ccp2-etape-corps" },
      rubrique(etape.titreAttendus || "Ce que le jury regarde", etape.attendus),
      rubrique("Comment t'y prendre", etape.conseils),
      rubrique("À garder pour ton dossier écrit", etape.aGarder),
      liens ? el("section", { class: "ccp2-rubrique" }, el("h4", {}, "Utile"), liens) : null,
      el("p", { class: "ccp2-source" }, "Source : " + etape.source),
    ),
  );
  details.addEventListener("toggle", () => {
    if (details.open) ecrireEtape(etape.cle);
    else if (lireEtape() === etape.cle) ecrireEtape(null);
  });
  return details;
}

export async function renderCcp2(container) {
  clear(container);
  const pourEquipe = selonPublic(null, "Le guide tel que le lisent les stagiaires.");
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Titre professionnel ECSR"),
      el("h2", {}, "CCP2"),
      el("p", { class: "subtitle" }, insecables(
        "CCP2 (certificat de compétences professionnelles n° 2) : sensibiliser les usagers de la route. "
        + `Ton parcours en ${ETAPES.length} étapes, du commanditaire au jour de l'épreuve.`)),
      // L'équipe lit le guide tel quel (au tutoiement) : une phrase le lui dit, une fois ; rien pour un stagiaire.
      pourEquipe ? el("p", { class: "muted ccp2-pour-equipe" }, pourEquipe) : null,
    ),
  ));
  // Tes dates, les étapes, puis l'épreuve repliée en bas. Aucun avancement calculé : la base ne sait pas où
  // en est chacun (R66).
  // Masquée tant qu'elle est vide (pas de date CCP2, Calendrier fermé, lecture en échec) : la page
  // commence alors par les étapes, sans trou (css : marge du titre des étapes).
  const dates = el("section", { class: "ccp2-dates", hidden: "" });
  container.appendChild(dates);
  const ouverte = lireEtape();
  container.appendChild(el("h3", { class: "ccp2-etapes-titre" }, `Les ${ETAPES.length} étapes`));
  container.appendChild(el("div", { class: "ccp2-etapes" },
    ...ETAPES.map((e) => carteEtape(e, e.cle === ouverte))));
  container.appendChild(epreuveRepliee());
  // Les dates suivent le module Calendrier, comme l'agenda d'Accueil. Pas d'attente :
  // le parcours s'affiche tout de suite, les dates arrivent quand elles sont lues.
  if (routeVisible("calendrier")) remplirDates(dates);
}
