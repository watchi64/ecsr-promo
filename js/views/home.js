/**
 * Page d'accueil : version actualisée après les refontes (auth, calendrier, contacts).
 * Affichage personnalisé : salutation + prochains événements + raccourcis.
 */
import { listAgendaEvents } from "../db.js?v=20261005f";
import { el, clear, parseDate, formatDate, isoDate } from "../utils.js?v=20261005f";
import { icon } from "../icons.js?v=20261005f";
import { isAdmin, isProf, getProfile, getProfileWho } from "../auth-admin.js?v=20261005f";
import {
  nouveautesAffichables, marquerLues, routeVisible, routeMasquee, repereMasque,
} from "../modules-etat.js?v=20261005f";
import { carteNouveaute } from "./nouveautes.js?v=20261005f";

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 6) return "Bonsoir";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function isPast(e) {
  const end = parseDate(e.date_end || e.date_start);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}

const TYPE_EMOJI = {
  examen: "📝", stage: "🏢", formation: "🎓", ferie: "🌴", autre: "📌",
};

// Événements considérés comme "majeurs" (countdown principal)
const MAJOR_TYPES = new Set(["examen", "stage"]);

function eventDateShort(e) {
  if (!e.date_end || e.date_end === e.date_start) return formatDate(e.date_start);
  return `${formatDate(e.date_start)} → ${formatDate(e.date_end)}`;
}

function daysUntil(dateStr) {
  const d = parseDate(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function countdownLabel(days) {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days < 0) return null;
  return `J − ${days}`;
}

// Nombre de nouveautés montrées dans Accueil. Au-delà, « Tout voir » renvoie
// vers #/nouveautes : sans ce plafond, la page finirait par pousser les
// raccourcis sous la ligne de flottaison.
const ACCUEIL_MAX = 3;

function sectionNouveautes() {
  // Nouveautés de la promo (annonces d'ouverture de module comprises) et celles qui
  // sont encore neuves. Le calcul du neuf se fait AVANT le marquage plus bas, sinon
  // plus rien n'aurait sa puce.
  const { entrees: mesEntrees, neuves } = nouveautesAffichables();
  if (mesEntrees.length === 0) return null;

  const affichees = mesEntrees.slice(0, ACCUEIL_MAX);

  const section = el("section", { class: "home-nouveautes" },
    el("div", { class: "home-section-head" },
      el("h2", {}, "✨ Nouveautés"),
      el("a", { class: "home-link", href: "#/nouveautes" }, "Tout voir →"),
    ),
    el("div", { class: "nv-liste" },
      ...affichees.map((e) => carteNouveaute(e, { neuve: neuves.has(e.id) })),
    ),
  );

  // Accueil ne marque que ce qu'il montre. La pastille tombe donc de 3, ce qui
  // invite à ouvrir la liste complète quand il reste des entrées plus anciennes.
  marquerLues(affichees.map((e) => e.id));
  window.dispatchEvent(new CustomEvent("nouveautes-vues"));
  return section;
}

export async function renderHome(container) {
  clear(container);

  const profile = getProfile();
  const who = getProfileWho();
  const admin = isAdmin();
  const roleLabel = admin ? "Admin"
    : profile?.role === "prof" ? "Formateur"
    : profile?.role === "stagiaire" ? "Stagiaire" : null;

  const today = new Date();
  const todayDayNum = today.getDate();
  const todayMonth = today.toLocaleDateString("fr-FR", { month: "long" });
  const todayWeekday = today.toLocaleDateString("fr-FR", { weekday: "long" });
  const todayYear = today.getFullYear();

  // === Hero / salutation + date du jour ===
  container.appendChild(el("section", { class: "home-hero-v2" },
    el("div", { class: "home-today-strip" },
      el("div", { class: "home-today-pill" },
        el("span", { class: "home-today-weekday" }, todayWeekday),
        el("span", { class: "home-today-num" }, String(todayDayNum)),
        el("span", { class: "home-today-month" }, todayMonth + " " + todayYear),
      ),
      el("img", { class: "home-hero-logo", src: "assets/logo/tpecsr-logo.svg", alt: "TP ECSR" }),
    ),
    el("h1", { class: "home-title-v2" },
      greetingByHour() + ", ",
      el("em", {}, who || "stagiaire"),
    ),
    el("p", { class: "home-lead-v2" },
      "Tout le suivi de la promo TP ECSR : planning, passages, notes, calendrier, contacts. ",
      "Tout au même endroit, à jour en temps réel."
    ),
  ));

  // Placée avant les tuiles : quelqu'un qui arrive en cliquant sur la pastille
  // doit tomber dessus sans défiler.
  const nouveautes = sectionNouveautes();
  if (nouveautes) container.appendChild(nouveautes);

  // === Raccourcis principaux (tuiles) ===
  const tiles = [
    // La page Stagiaires (chantier D, lot 2) en tête, chez un formateur ou un admin.
    // Les autres tuiles suivent la barre d'onglets (Priorités se rejoint depuis le Planning).
    ...((isAdmin() || isProf())
      ? [{ route: "stagiaires", icon: "users", title: "Stagiaires", desc: "La promo, une fiche par personne" }]
      : []),
    { route: "planning",   icon: "calendar",     title: "Planning",         desc: "Cette semaine, créneaux & tirages" },
    { route: "calendrier", icon: "clock",        title: "Calendrier",       desc: "Examens, stages, dates clés" },
    { route: "themes",     icon: "book",         title: "Cours",            desc: "Thèmes, compétences & QCM" },
    { route: "notes",      icon: "edu",          title: "Notes",            desc: "Matrice & synthèse classe" },
    { route: "ccp2",       icon: "ccp2",         title: "CCP2",             desc: "Ton parcours en 8 étapes" },
    { route: "ressources", icon: "signpost",     title: "Ressources",       desc: "Contacts & liens utiles" },
  ];

  container.appendChild(el("div", { class: "home-tiles" },
    ...tiles.filter((t) => routeVisible(t.route)).map((t) => {
      const titre = el("span", { class: "home-tile-title" }, t.title);
      const tuile = el("a", { class: "home-tile", href: "#/" + t.route },
        el("div", { class: "home-tile-icon" }, icon[t.icon]()),
        el("div", { class: "home-tile-body" },
          titre,
          el("span", { class: "home-tile-desc" }, t.desc),
        ),
      );
      // Module fermé pour la promo : tuile gardée chez un formateur, repérée.
      return repereMasque(tuile, routeMasquee(t.route), titre);
    }),
  ));

  // === Prochains événements (agenda) ===
  // Section, lecture de l'agenda et compte à rebours mènent tous au Calendrier :
  // module fermé pour la promo, rien de tout cela n'est construit (un formateur
  // le garde toujours).
  if (routeVisible("calendrier")) {
    const agendaSection = el("section", { class: "home-agenda" },
      el("div", { class: "home-section-head" },
        el("h2", {}, "📅 Prochains événements"),
        el("a", { class: "home-link", href: "#/calendrier" }, "Tout voir →"),
      ),
    );
    agendaSection.appendChild(el("div", { class: "home-agenda-list", id: "home-agenda-list" },
      el("p", { class: "muted" }, "Chargement…"),
    ));
    container.appendChild(agendaSection);

    // Charge l'agenda en arrière-plan
    try {
      const events = await listAgendaEvents();
      const upcoming = events.filter((e) => !isPast(e));

      // Compteur principal : prochain événement majeur (examen ou stage)
      const nextMajor = upcoming.find((e) => MAJOR_TYPES.has(e.type));
      if (nextMajor) {
        const days = daysUntil(nextMajor.date_start);
        const countdownEl = el("section", { class: "home-countdown" },
          el("div", { class: "home-countdown-icon" }, TYPE_EMOJI[nextMajor.type] || "📌"),
          el("div", { class: "home-countdown-body" },
            el("span", { class: "home-countdown-label muted" }, "Prochain événement majeur"),
            el("span", { class: "home-countdown-title" }, nextMajor.title),
            el("span", { class: "home-countdown-date muted" }, eventDateShort(nextMajor)),
          ),
          el("div", { class: "home-countdown-pill " + (days === 0 ? "today" : days <= 7 ? "soon" : "later") },
            el("span", { class: "home-countdown-num" },
              days === 0 ? "0" : days === 1 ? "1" : String(days),
            ),
            el("span", { class: "home-countdown-unit" },
              days === 0 ? "Aujourd'hui !" : days === 1 ? "jour" : "jours",
            ),
          ),
        );
        // Insère le compteur au-dessus des Nouveautés si elles sont là, sinon
        // juste avant les tuiles. L'ordre voulu est : hero, compteur, nouveautés,
        // raccourcis.
        const ancre = container.querySelector(".home-nouveautes")
                   || container.querySelector(".home-tiles");
        if (ancre) container.insertBefore(countdownEl, ancre);
      }

      // Liste des 3 prochains événements (peu importe le type)
      const next3 = upcoming.slice(0, 3);
      const listEl = container.querySelector("#home-agenda-list");
      if (listEl) {
        clear(listEl);
        if (next3.length === 0) {
          listEl.appendChild(el("p", { class: "muted home-empty-line" },
            "Aucun événement à venir. " + (admin ? "Ajoute-en depuis l'onglet Calendrier." : "Reste à l'affût."),
          ));
        } else {
          next3.forEach((e) => {
            const start = parseDate(e.date_start);
            const days = daysUntil(e.date_start);
            const isTodayE = e.date_start <= isoDate(today) && (e.date_end || e.date_start) >= isoDate(today);
            const label = countdownLabel(days);
            listEl.appendChild(el("a", {
              class: "home-event" + (isTodayE ? " today" : ""),
              href: "#/calendrier",
            },
              el("div", { class: "home-event-date" },
                el("span", { class: "home-event-day" }, String(start.getDate())),
                el("span", { class: "home-event-month" },
                  start.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").toUpperCase()),
              ),
              el("div", { class: "home-event-body" },
                el("span", { class: "home-event-emoji" }, TYPE_EMOJI[e.type] || "📌"),
                el("span", { class: "home-event-title" }, e.title),
                el("span", { class: "home-event-meta muted" },
                  eventDateShort(e),
                  e.location ? " · 📍 " + e.location : "",
                ),
              ),
              label ? el("span", { class: "home-event-countdown" + (days === 0 ? " today" : days <= 7 ? " soon" : "") }, label) : null,
            ));
          });
        }
      }
    } catch (e) {
      const listEl = container.querySelector("#home-agenda-list");
      if (listEl) {
        clear(listEl);
        listEl.appendChild(el("p", { class: "muted" }, "Impossible de charger les événements."));
      }
    }
  }

  // === Aide / règles courtes ===
  container.appendChild(el("section", { class: "home-info" },
    el("h2", {}, "📌 À retenir"),
    el("ul", { class: "home-info-list" },
      el("li", {},
        el("strong", {}, "Ton identité est liée à ton email."),
        " Tes ajouts de passages et tes notes sont signés automatiquement.",
      ),
      el("li", {},
        el("strong", {}, "Tu ajoutes et corriges tes passages toi-même."),
        " Pour en supprimer un, demande à un formateur.",
      ),
      el("li", {},
        el("strong", {}, "Tout est tracé."),
        " Chaque modification (passage, note, planning) est historisée avec son auteur.",
      ),
      el("li", {},
        el("strong", {}, "Ctrl + Z annule la dernière action."),
        " Sur Notes, Passages, Thèmes et Calendrier.",
      ),
    ),
  ));

  // === Footer ===
  container.appendChild(el("footer", { class: "home-footer-v2" },
    el("p", {},
      "TP ECSR App · Promo 2026 · ",
      roleLabel ? el("span", { class: "footer-role" }, "connecté comme " + roleLabel.toLowerCase()) : "",
    ),
    el("p", { class: "muted", style: "margin-top:0.3rem;font-size:0.78rem" },
      el("a", { href: "https://github.com/watchi64/ecsr-promo", target: "_blank" }, "code source"),
      " · ",
      el("a", { href: "#/config" }, "paramètres"),
    ),
  ));
}
