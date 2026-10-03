// Pastille de la promo affichée (spec multi-promo C.2) : visible seulement à qui a au
// moins deux promos (formateurs, fondateur). Un appui ouvre le choix ; choisir une autre
// promo attend les enregistrements en cours puis recharge la page (choisirPromo).
import { el } from "./utils.js?v=20261002b";
import { getMesPromos, getPromoCourante, choisirPromo } from "./db.js?v=20261002b";
import { libelleCourtPromo } from "./promo-rules.js?v=20261002b";

// Vrai dès qu'une bascule est lancée, jusqu'au rechargement de la page. Tant qu'il l'est,
// ni la pastille ni le choix ne répondent : pendant que les enregistrements du planning se
// terminent, rien ne doit repartir (second choix, nouvelle saisie dans l'ancienne promo).
// L'état vit ici et non dans le DOM : updateBadge() redessine la pastille à chaque
// événement d'authentification, et la nouvelle doit naître inerte.
let bascule = false;

export function construirePastille() {
  const promos = getMesPromos();
  const courante = getPromoCourante();
  if (promos.length < 2 || !courante) return null;
  return el("button", {
    class: "promo-pastille", type: "button", "aria-haspopup": "dialog",
    title: "Promo affichée : " + courante.nom,
    disabled: bascule,
    onClick: ouvrirChoix,
  },
    el("span", { class: "promo-pastille-texte" }, libelleCourtPromo(courante, promos)),
    el("span", { class: "promo-pastille-fleche", "aria-hidden": "true" }, "▾"),
  );
}

function ouvrirChoix() {
  const promos = getMesPromos();
  const courante = getPromoCourante();
  if (bascule || promos.length < 2 || !courante) return;
  if (document.querySelector(".promo-choix-modal")) return;  // déjà ouvert (clavier)

  const backdrop = el("div", { class: "modal-backdrop" });
  const fermer = () => { if (!bascule) backdrop.remove(); };
  const aide = el("p", { class: "muted" }, "Ton choix est mémorisé sur cet appareil.");
  const liste = el("div", { class: "promo-choix-liste", role: "radiogroup", "aria-label": "Promo affichée" });

  // Choisir une promo n'a qu'une issue : le rechargement. D'ici là (attente des
  // enregistrements en cours), tout le contrôle est verrouillé, pastille de la barre comprise.
  const verrouiller = () => {
    bascule = true;
    liste.classList.add("en-cours");
    aide.textContent = "Changement de promo en cours…";
    backdrop.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    document.querySelectorAll(".promo-pastille").forEach((b) => { b.disabled = true; });
  };

  promos.forEach((p) => {
    const active = p.id === courante.id;
    liste.appendChild(el("button", {
      class: "promo-choix" + (active ? " active" : ""), type: "button", role: "radio",
      "aria-checked": active ? "true" : "false",
      onClick: async () => {
        if (bascule) return;
        // Promo déjà affichée, ou retirée de la liste depuis l'ouverture : rien à basculer.
        if (active || !getMesPromos().some((x) => x.id === p.id)) { fermer(); return; }
        verrouiller();
        await choisirPromo(p.id);
      },
    },
      el("span", { class: "promo-choix-puce", "aria-hidden": "true" }, active ? "●" : "○"),
      el("span", {}, p.nom),
    ));
  });

  const modal = el("div", { class: "modal promo-choix-modal" },
    el("h3", {}, "Promo affichée"),
    aide,
    liste,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: fermer }, "Fermer"),
    ),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) fermer(); });
  document.body.appendChild(backdrop);
}
