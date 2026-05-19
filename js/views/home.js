/**
 * Page d'accueil — version actualisée après les refontes (auth, calendrier, contacts).
 * Affichage personnalisé : salutation + prochains événements + raccourcis.
 */
import { listAgendaEvents } from "../db.js";
import { el, clear, parseDate, formatDate, isoDate } from "../utils.js";
import { icon } from "../icons.js";
import { isAdmin, getProfile, getProfileWho } from "../auth-admin.js";

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

function eventDateShort(e) {
  if (!e.date_end || e.date_end === e.date_start) return formatDate(e.date_start);
  return `${formatDate(e.date_start)} → ${formatDate(e.date_end)}`;
}

export async function renderHome(container) {
  clear(container);

  const profile = getProfile();
  const who = getProfileWho();
  const admin = isAdmin();
  const roleLabel = admin ? "Admin"
    : profile?.role === "prof" ? "Prof"
    : profile?.role === "stagiaire" ? "Stagiaire" : null;

  const today = new Date();
  const todayLong = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // === Hero / salutation ===
  container.appendChild(el("section", { class: "home-hero-v2" },
    el("img", { class: "home-hero-logo", src: "assets/logo/tpecsr-logo.svg", alt: "TP ECSR" }),
    el("p", { class: "eyebrow home-eyebrow" }, "Promo 2026 · " + todayLong),
    el("h1", { class: "home-title-v2" },
      greetingByHour() + ", ",
      el("em", {}, who || "stagiaire"),
    ),
    el("p", { class: "home-lead-v2" },
      "Tout le suivi de la promo TP ECSR : planning, passages, notes, calendrier, contacts. ",
      "Tout au même endroit, à jour en temps réel."
    ),
  ));

  // === Raccourcis principaux (tuiles) ===
  const tiles = [
    { route: "dashboard",  icon: "dashboard",    title: "Tableau de bord",  desc: "Qui doit passer en priorité" },
    { route: "planning",   icon: "calendar",     title: "Planning",         desc: "Cette semaine, créneaux & tirages" },
    { route: "calendrier", icon: "clock",        title: "Calendrier",       desc: "Examens, stages, dates clés" },
    { route: "themes",     icon: "list",         title: "Thèmes",           desc: "57 thèmes & progression" },
    { route: "passages",   icon: "history",      title: "Passages",         desc: "Historique salle / voiture" },
    { route: "notes",      icon: "edu",          title: "Notes",            desc: "Matrice & synthèse classe" },
    { route: "ressources", icon: "signpost",     title: "Ressources",       desc: "Contacts & liens utiles" },
  ];

  container.appendChild(el("div", { class: "home-tiles" },
    ...tiles.map((t) => el("a", {
      class: "home-tile",
      href: "#/" + t.route,
    },
      el("div", { class: "home-tile-icon" }, icon[t.icon]()),
      el("div", { class: "home-tile-body" },
        el("span", { class: "home-tile-title" }, t.title),
        el("span", { class: "home-tile-desc" }, t.desc),
      ),
    )),
  ));

  // === Prochains événements (agenda) ===
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
    const upcoming = events.filter((e) => !isPast(e)).slice(0, 3);
    const listEl = container.querySelector("#home-agenda-list");
    if (listEl) {
      clear(listEl);
      if (upcoming.length === 0) {
        listEl.appendChild(el("p", { class: "muted home-empty-line" },
          "Aucun événement à venir. " + (admin ? "Ajoute-en depuis l'onglet Calendrier." : "Reste à l'affût."),
        ));
      } else {
        upcoming.forEach((e) => {
          const start = parseDate(e.date_start);
          const isToday = e.date_start <= isoDate(today) && (e.date_end || e.date_start) >= isoDate(today);
          listEl.appendChild(el("a", {
            class: "home-event" + (isToday ? " today" : ""),
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
            isToday ? el("span", { class: "agenda-today-pill" }, "Aujourd'hui") : null,
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

  // === Aide / règles courtes ===
  container.appendChild(el("section", { class: "home-info" },
    el("h2", {}, "📌 À retenir"),
    el("ul", { class: "home-info-list" },
      el("li", {},
        el("strong", {}, "Ton identité est liée à ton email."),
        " Tes ajouts de passages et tes notes sont signés automatiquement.",
      ),
      el("li", {},
        el("strong", {}, "Ajout de passage limité à 2 jours en arrière."),
        " Au-delà, demande à un admin (prof) de le faire pour toi.",
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
