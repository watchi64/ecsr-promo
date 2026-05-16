/**
 * Page d'accueil — présentation du site, règles d'utilisation, intérêts.
 */
import { el, clear } from "../utils.js";
import { icon } from "../icons.js";
import { isAdmin } from "../auth-admin.js";

export async function renderHome(container) {
  clear(container);
  const admin = isAdmin();

  // === Hero ===
  const hero = el("section", { class: "home-hero" },
    el("div", { class: "home-hero-content" },
      el("img", { class: "home-hero-logo", src: "assets/logo/tpecsr-logo.svg", alt: "TP ECSR" }),
      el("p", { class: "eyebrow home-eyebrow" }, "Suivi de promotion · Promo 2026"),
      el("h1", { class: "home-title" }, "Une formation TP ECSR ", el("em", {}, "tenue à jour")),
      el("p", { class: "home-lead" },
        "Centraliser le planning, suivre les passages en salle et en voiture, "
        + "noter les évaluations et garder un historique propre. Tout au même endroit, accessible à toute la promo."
      ),
      el("div", { class: "home-cta" },
        el("a", { href: "#/dashboard", class: "btn primary" }, icon.dashboard(), "Aller au tableau de bord"),
        el("a", { href: "#/planning", class: "btn ghost" }, icon.calendar(), "Voir le planning"),
      ),
    ),
    el("div", { class: "home-hero-visual" },
      el("img", {
        class: "home-hero-image",
        src: "assets/images/panneaux-fr-banner.png",
        alt: "Panneaux de signalisation routière française stylisés",
        loading: "lazy",
      }),
    ),
  );
  container.appendChild(hero);

  // === Section 1 : À quoi sert ce site ? ===
  container.appendChild(el("section", { class: "home-section" },
    el("p", { class: "home-section-tag" }, "01"),
    el("h2", { class: "home-section-title" }, "À quoi sert ce site ?"),
    el("div", { class: "home-cols" },
      el("div", { class: "home-feature" },
        el("div", { class: "home-feature-icon" }, icon.dashboard()),
        el("h3", {}, "Tableau de bord temps réel"),
        el("p", {}, "À tout moment, savoir qui doit passer en priorité, qui a déjà passé, qui a manqué une opportunité. Le système calcule automatiquement les écarts."),
      ),
      el("div", { class: "home-feature" },
        el("div", { class: "home-feature-icon" }, icon.calendar()),
        el("h3", {}, "Planning hebdomadaire"),
        el("p", {}, "Construire la semaine avec activités, formateurs et stagiaires. Imprimer en PDF pour affichage en salle."),
      ),
      el("div", { class: "home-feature" },
        el("div", { class: "home-feature-icon" }, icon.history()),
        el("h3", {}, "Historique tracé"),
        el("p", {}, "Chaque passage, chaque modification est attribué à une personne. Plus de doute : on sait qui a fait quoi et quand."),
      ),
      el("div", { class: "home-feature" },
        el("div", { class: "home-feature-icon" }, icon.list()),
        el("h3", {}, "57 thèmes du référentiel"),
        el("p", {}, "Cocher au fur et à mesure. Combiner avec les compétences TP ECSR (formateur) et REMC (conduite)."),
      ),
      el("div", { class: "home-feature" },
        el("div", { class: "home-feature-icon" }, icon.edu()),
        el("h3", {}, "Notes et évaluations"),
        el("p", {}, "Suivre la progression de chaque stagiaire sur les thèmes, compétences et contrôles. Moyennes calculées automatiquement."),
      ),
      el("div", { class: "home-feature" },
        el("div", { class: "home-feature-icon" }, icon.signpost()),
        el("h3", {}, "Bibliothèque de ressources"),
        el("p", {}, "Légifrance, REMC, SRRR, ONISR. Tous les liens curés au même endroit, classés par catégorie."),
      ),
    ),
  ));

  // === Section 2 : Règles d'utilisation ===
  container.appendChild(el("section", { class: "home-section" },
    el("p", { class: "home-section-tag" }, "02"),
    el("h2", { class: "home-section-title" }, "Les règles d'utilisation"),

    el("div", { class: "home-rules" },
      // Règle 1 : accès libre avec mot de passe
      el("article", { class: "home-rule" },
        el("div", { class: "home-rule-badge" }, "🔓"),
        el("div", { class: "home-rule-content" },
          el("h3", {}, "Accès libre avec mot de passe partagé"),
          el("p", {}, "Tout le monde peut consulter le site avec le mot de passe de la promo. Pas besoin de créer un compte."),
          el("ul", {},
            el("li", {}, "Lecture libre de toutes les pages"),
            el("li", {}, "Ajout/suppression de passages possible (signature obligatoire)"),
            el("li", {}, "Modification du planning, des notes et des thèmes : ", el("strong", {}, "admin uniquement")),
          ),
        ),
      ),
      // Règle 2 : identité au premier accès
      el("article", { class: "home-rule" },
        el("div", { class: "home-rule-badge" }, "🪪"),
        el("div", { class: "home-rule-content" },
          el("h3", {}, "Identité au premier accès"),
          el("p", {}, "À ta première visite, choisis ton prénom dans la liste. Tes ajouts de passages seront signés de ce prénom. Ça permet de tracer toute action sans ambiguïté."),
        ),
      ),
      // Règle 3 : système de priorité
      el("article", { class: "home-rule" },
        el("div", { class: "home-rule-badge" }, "📅"),
        el("div", { class: "home-rule-content" },
          el("h3", {}, "Le système de priorité"),
          el("p", {}, "Pour préparer le planning de la semaine suivante, on s'appuie sur 3 niveaux automatiques :"),
          el("div", { class: "home-priority-grid" },
            el("div", { class: "home-priority-card a-prioriser" },
              el("span", { class: "home-priority-tag" }, "À prioriser"),
              el("p", {}, "Le stagiaire est en retard sur le groupe et n'a pas eu d'occasion ratée. Il passe en priorité."),
            ),
            el("div", { class: "home-priority-card peut-attendre" },
              el("span", { class: "home-priority-tag" }, "Opportunité ratée"),
              el("p", {}, "Le stagiaire a déjà eu une occasion (absence ou refus). Il passe seulement s'il reste de la place."),
            ),
            el("div", { class: "home-priority-card a-jour" },
              el("span", { class: "home-priority-tag" }, "À jour"),
              el("p", {}, "Le stagiaire est au niveau du groupe. Pas besoin de prioriser cette semaine."),
            ),
          ),
        ),
      ),
    ),
  ));

  // === Section 3 : Intérêts ===
  container.appendChild(el("section", { class: "home-section" },
    el("p", { class: "home-section-tag" }, "03"),
    el("h2", { class: "home-section-title" }, "Pourquoi c'est utile"),
    el("div", { class: "home-benefits" },
      el("div", { class: "home-benefit" },
        el("h4", {}, "Plus d'équité"),
        el("p", {}, "Le système identifie automatiquement qui n'a pas eu suffisamment de passages. Fini les oublis ou les favoritismes involontaires. La rotation est lisible et juste."),
      ),
      el("div", { class: "home-benefit" },
        el("h4", {}, "Plus de mémoire collective"),
        el("p", {}, "L'historique complet est conservé. Trois mois plus tard, on retrouve qui a animé telle pédagogie, quand a eu lieu tel contrôle, quels thèmes ont été traités."),
      ),
      el("div", { class: "home-benefit" },
        el("h4", {}, "Moins de paperasse"),
        el("p", {}, "Un seul tableau accessible depuis le téléphone, plus de feuilles volantes. Imprimable en PDF pour affichage si besoin."),
      ),
      el("div", { class: "home-benefit" },
        el("h4", {}, "Transparence totale"),
        el("p", {}, "Chaque action (ajout, modification, suppression) est tracée avec l'auteur, la date et l'heure. Pas de modification anonyme possible."),
      ),
      el("div", { class: "home-benefit" },
        el("h4", {}, "Vraies données chiffrées"),
        el("p", {}, "Moyennes, progressions, pourcentages. Le site calcule tout. Pour chaque stagiaire et pour le groupe."),
      ),
      el("div", { class: "home-benefit" },
        el("h4", {}, "Tous les outils au même endroit"),
        el("p", {}, "Plus besoin de jongler entre Sheets, WhatsApp et Drive. Planning, passages, notes, ressources : un seul site, accessible de partout."),
      ),
    ),
  ));

  // === Section 4 : Mode d'emploi rapide ===
  container.appendChild(el("section", { class: "home-section home-section-quickstart" },
    el("p", { class: "home-section-tag" }, "04"),
    el("h2", { class: "home-section-title" }, "Démarrage rapide"),
    el("ol", { class: "home-steps" },
      el("li", {},
        el("strong", {}, "Choisis ton identité"),
        " à la première visite. Sélectionne ton prénom dans la liste."
      ),
      el("li", {},
        el("strong", {}, "Va sur le ", el("a", { href: "#/dashboard" }, "Tableau de bord")),
        ". Tu vois qui doit passer en priorité cette semaine."
      ),
      el("li", {},
        el("strong", {}, "Consulte le ", el("a", { href: "#/planning" }, "Planning")),
        ". Les activités, profs et stagiaires de la semaine."
      ),
      el("li", {},
        el("strong", {}, "Après ton passage, va sur ", el("a", { href: "#/passages" }, "Passages")),
        ". Clique « Ajouter » et remplis le formulaire. C'est ta seule action d'écriture."
      ),
      el("li", {},
        el("strong", {}, "Pour les questions de fond, ", el("a", { href: "#/ressources" }, "Ressources")),
        ". Légifrance, REMC, SRRR, etc. classés par catégorie."
      ),
    ),
    !admin ? el("p", { class: "muted home-admin-cta" },
      "💼 Tu es prof ou animateur ? ",
      el("a", { href: "#/parametres" }, "Connecte-toi en mode admin"),
      " pour modifier le planning, ajouter des notes, et plus."
    ) : null,
  ));

  // === Footer ===
  container.appendChild(el("footer", { class: "home-footer" },
    el("p", {}, "TP ECSR · Promo 2026 · © ", el("a", { href: "https://github.com/watchi64/ecsr-promo", target: "_blank" }, "code source")),
  ));
}
