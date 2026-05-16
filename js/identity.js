/**
 * Identité du visiteur (tier 1 - mot de passe partagé).
 * Persisté en localStorage. Sert à attribuer chaque action.
 *
 * Si admin : on prend l'email Supabase Auth → géré par auth-admin.js
 * Sinon (mdp partagé) : on stocke un prénom choisi parmi stagiaires
 *                      OU une saisie libre.
 */
import { listStagiaires } from "./db.js";
import { el, clear } from "./utils.js";

const STORAGE_KEY = "ecsr_who";

export function getStoredWho() {
  return localStorage.getItem(STORAGE_KEY) || null;
}

export function setStoredWho(who) {
  if (who) localStorage.setItem(STORAGE_KEY, who);
  else localStorage.removeItem(STORAGE_KEY);
}

export async function ensureIdentity() {
  if (getStoredWho()) return getStoredWho();
  return await openIdentityPicker();
}

export function openIdentityPicker(forceChange = false) {
  return new Promise(async (resolve) => {
    const stagiaires = await listStagiaires();
    const backdrop = el("div", { class: "modal-backdrop" });

    let selected = forceChange ? "" : (getStoredWho() || "");
    const customInput = el("input", { type: "text", placeholder: "Autre — ton prénom" });

    const buildList = () => {
      const grid = el("div", { class: "identity-grid" });
      stagiaires.forEach((s) => {
        const btn = el("button", {
          class: "identity-card" + (selected === s.prenom ? " selected" : ""),
          dataset: { prenom: s.prenom },
          onClick: () => {
            selected = s.prenom;
            customInput.value = "";
            grid.querySelectorAll(".identity-card").forEach((n) =>
              n.classList.toggle("selected", n.dataset.prenom === s.prenom)
            );
          },
        }, s.prenom);
        grid.appendChild(btn);
      });
      return grid;
    };

    customInput.addEventListener("input", () => {
      selected = customInput.value.trim();
      backdrop.querySelectorAll(".identity-card").forEach((n) => n.classList.remove("selected"));
    });

    const submit = el("button", { class: "btn primary full", onClick: () => {
      const v = (selected || customInput.value || "").trim();
      if (!v) return;
      setStoredWho(v);
      backdrop.remove();
      resolve(v);
    }}, "C'est moi");

    const modal = el("div", { class: "modal identity-modal" },
      el("p", { class: "eyebrow" }, "Bienvenue"),
      el("h3", {}, forceChange ? "Changer d'identité" : "Qui es-tu ?"),
      el("p", { class: "muted", style: "margin: 0 0 1rem;font-size:0.9rem" },
        "On t'identifie pour tracer les passages ajoutés. Tu peux changer plus tard dans Paramètres."
      ),
      buildList(),
      el("p", { class: "muted", style: "text-align:center;font-size:0.78rem;margin:1rem 0 0.4rem" }, "ou"),
      el("div", { class: "field" }, customInput),
      el("div", { class: "modal-actions", style: "margin-top:1rem" }, submit),
    );

    backdrop.appendChild(modal);
    if (!forceChange) {
      // Empêche la fermeture par click extérieur la première fois
    } else {
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(getStoredWho()); } });
    }
    document.body.appendChild(backdrop);
  });
}

/**
 * Renvoie l'identité courante : email admin si connecté, sinon le prénom stocké.
 */
export function getCurrentWho(adminEmail) {
  if (adminEmail) return adminEmail;
  return getStoredWho() || "Anonyme";
}
