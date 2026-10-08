// Informations légales : lecture des conditions d'utilisation et des mentions légales
// (plein écran, ouvrable même sans être connecté, depuis l'écran de connexion), et fenêtre
// d'acceptation bloquante au démarrage quand la version en vigueur n'a pas été acceptée.
import { el, clear, toast } from "./utils.js?v=20261008a";
import { icon } from "./icons.js?v=20261008a";
import { rendreMarkdown } from "./views/cours-reader.js?v=20261008a";
import { CONDITIONS_MD, MENTIONS_MD, VERSION_CONDITIONS } from "./legal-data.js?v=20261008a";
import { doitAccepter, aDejaAccepte, lignesEssentiel, dateVersion } from "./legal-rules.js?v=20261008a";
import { listMesAcceptations, accepterConditions, signOut } from "./db.js?v=20261008a";

const ONGLETS = [
  { cle: "conditions", libelle: "Conditions d'utilisation", md: CONDITIONS_MD },
  { cle: "mentions", libelle: "Mentions légales", md: MENTIONS_MD },
];

export function ouvrirInformationsLegales({ onglet = "conditions" } = {}) {
  const overlay = el("div", { class: "cours-overlay legal-overlay", role: "dialog", "aria-modal": "true",
    "aria-label": "Informations légales" });
  const fermer = el("button", { class: "cours-close", type: "button", "aria-label": "Fermer" });
  fermer.appendChild(icon.close ? icon.close() : document.createTextNode("×"));

  const tete = el("div", { class: "cours-head" },
    el("div", { class: "cours-head-main" },
      el("div", {},
        el("h2", { class: "cours-head-titre" }, "Informations légales"),
        el("p", { class: "cours-head-meta" }, "Conditions en vigueur depuis le " + dateVersion(VERSION_CONDITIONS)),
      ),
    ),
    fermer,
  );

  const barre = el("nav", { class: "cours-sommaire legal-onglets", role: "tablist" });
  const corps = el("div", { class: "cours-body" });
  const defilement = el("div", { class: "cours-scroll" }, barre, el("article", { class: "cours-article" }, corps));

  function afficher(cle) {
    const o = ONGLETS.find((x) => x.cle === cle) || ONGLETS[0];
    [...barre.children].forEach((b) => {
      const actif = b.dataset.cle === o.cle;
      b.classList.toggle("actif", actif);
      b.setAttribute("aria-selected", actif ? "true" : "false");
    });
    clear(corps);
    corps.appendChild(el("h1", { class: "legal-titre" }, o.libelle));
    rendreMarkdown(o.md).noeuds.forEach((n) => corps.appendChild(n));
    defilement.scrollTop = 0;
  }

  ONGLETS.forEach((o) => barre.appendChild(el("button", {
    class: "cours-somm-item legal-onglet", type: "button", role: "tab", "data-cle": o.cle,
    onClick: () => afficher(o.cle),
  }, o.libelle)));

  overlay.appendChild(tete);
  overlay.appendChild(defilement);
  document.body.appendChild(overlay);
  document.body.classList.add("cours-open");

  function close() {
    overlay.remove();
    if (!document.querySelector(".cours-overlay")) document.body.classList.remove("cours-open");
    document.removeEventListener("keydown", onKey, true);
  }
  // Capture : Échap ferme la lecture sans atteindre une fenêtre restée dessous.
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }
  fermer.addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);
  afficher(onglet);
  fermer.focus();
  return close;
}

// Au démarrage : si la version en vigueur n'a pas été acceptée, une fenêtre bloquante
// s'affiche et la promesse ne se résout qu'à l'acceptation. Si la lecture échoue (réseau),
// on laisse passer : on ne verrouille pas l'app sur une panne, la question reviendra.
export async function exigerAcceptation(email) {
  if (!email) return;
  let acceptations;
  try {
    acceptations = await listMesAcceptations(email);
  } catch (e) {
    console.error("Conditions : lecture des acceptations impossible", e);
    return;
  }
  if (!doitAccepter(acceptations, VERSION_CONDITIONS)) return;
  await fenetreAcceptation(aDejaAccepte(acceptations));
}

function fenetreAcceptation(miseAJour) {
  return new Promise((resolve) => {
    const backdrop = el("div", { class: "modal-backdrop legal-backdrop" });
    const coche = el("input", { type: "checkbox", id: "legal-coche" });
    const erreur = el("p", { class: "error hidden" });
    const continuer = el("button", { class: "btn primary full", type: "button", disabled: true }, "Continuer");
    coche.addEventListener("change", () => { continuer.disabled = !coche.checked; });

    continuer.addEventListener("click", async () => {
      continuer.disabled = true;
      erreur.classList.add("hidden");
      try {
        await accepterConditions(VERSION_CONDITIONS);
        backdrop.remove();
        toast("Merci, c'est enregistré.", "success", 2000);
        resolve();
      } catch (e) {
        console.error(e);
        erreur.textContent = "L'enregistrement n'a pas abouti. Vérifiez votre connexion et réessayez.";
        erreur.classList.remove("hidden");
        continuer.disabled = !coche.checked;
      }
    });

    const essentiel = el("ul", { class: "legal-essentiel" });
    // Espace insécable devant « ; : ? ! » : la ponctuation ne part jamais seule à la ligne.
    lignesEssentiel(CONDITIONS_MD).forEach((l) =>
      essentiel.appendChild(el("li", {}, l.replace(/ ([;:?!])/g, " $1"))));

    const modal = el("div", { class: "modal legal-modal", role: "dialog", "aria-modal": "true",
      "aria-labelledby": "legal-modal-titre" },
      el("h3", { id: "legal-modal-titre" }, miseAJour ? "Les conditions d'utilisation ont changé" : "Avant de commencer"),
      el("p", { class: "muted legal-intro" }, miseAJour
        ? "Une nouvelle version est en vigueur depuis le " + dateVersion(VERSION_CONDITIONS) + ". Voici l'essentiel :"
        : "L'application enregistre des données sur votre formation. Voici l'essentiel :"),
      essentiel,
      el("button", { class: "btn ghost full legal-lire", type: "button",
        onClick: () => ouvrirInformationsLegales() }, "Lire le texte complet"),
      el("label", { class: "legal-accord", for: "legal-coche" }, coche,
        el("span", {}, "J'ai lu et j'accepte les conditions d'utilisation")),
      erreur,
      continuer,
      el("button", { class: "gate-link legal-deconnexion", type: "button", onClick: async () => {
        try { await signOut(); } catch (e) { console.error(e); }
        location.reload();
      } }, "Se déconnecter"),
    );
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  });
}
