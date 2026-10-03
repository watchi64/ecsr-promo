// Pastille de la promo affichée (spec multi-promo C.2) : visible seulement à qui a au
// moins deux promos (formateurs, fondateur). Un appui ouvre le choix ; choisir une autre
// promo attend les enregistrements en cours puis recharge la page (choisirPromo).
import { el } from "./utils.js?v=20261003b";
import { getMesPromos, getPromoCourante, choisirPromo } from "./db.js?v=20261003b";
import { libelleCourtPromo } from "./promo-rules.js?v=20261003b";

// « Montpellier · sept. 2026 » : le lieu dans son propre span, que le CSS masque sur les
// écrans les plus étroits (la date suffit à distinguer les promos dans la barre).
function texteDePastille(libelle) {
  const i = libelle.indexOf(" · ");
  if (i < 0) return el("span", { class: "promo-pastille-texte" }, libelle);
  return el("span", { class: "promo-pastille-texte" },
    el("span", { class: "promo-pastille-lieu" }, libelle.slice(0, i + 3)),
    libelle.slice(i + 3));
}

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
    texteDePastille(libelleCourtPromo(courante, promos)),
    el("span", { class: "promo-pastille-fleche", "aria-hidden": "true" }, "▾"),
  );
}

function ouvrirChoix() {
  const promos = getMesPromos();
  const courante = getPromoCourante();
  if (bascule || promos.length < 2 || !courante) return;
  if (document.querySelector(".promo-choix-modal")) return;  // déjà ouvert (clavier)

  const backdrop = el("div", { class: "modal-backdrop" });
  const aide = el("p", { class: "muted", role: "status" }, "Ton choix est mémorisé sur cet appareil.");
  const liste = el("div", { class: "promo-choix-liste", role: "radiogroup", "aria-label": "Promo affichée" });

  // Fermer rend le focus à la pastille, cherchée à ce moment-là : updateBadge() a pu la
  // redessiner depuis l'ouverture. Sans effet pendant la bascule (rien ne ferme avant le
  // rechargement).
  const fermer = () => {
    if (bascule) return;
    document.removeEventListener("keydown", auClavier, true);
    backdrop.remove();
    document.querySelector(".promo-pastille")?.focus();
  };

  // Choisir une promo n'a qu'une issue : le rechargement. D'ici là (attente des
  // enregistrements en cours), tout le contrôle est verrouillé, pastille de la barre comprise.
  // Le focus reste dans la fenêtre (sur elle-même) : les boutons désactivés ne le gardent pas.
  const verrouiller = () => {
    bascule = true;
    liste.classList.add("en-cours");
    aide.textContent = "Changement de promo en cours…";
    backdrop.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    document.querySelectorAll(".promo-pastille").forEach((b) => { b.disabled = true; });
    modal.focus();
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

  const modal = el("div", {
    class: "modal promo-choix-modal", role: "dialog", "aria-modal": "true",
    "aria-labelledby": "promo-choix-titre", tabindex: "-1",
  },
    el("h3", { id: "promo-choix-titre" }, "Promo affichée"),
    aide,
    liste,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: fermer }, "Fermer"),
    ),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) fermer(); });
  document.body.appendChild(backdrop);
  document.addEventListener("keydown", auClavier, true);
  liste.querySelector(".promo-choix.active")?.focus();  // le clavier part de la promo cochée

  // Clavier, écouté sur le document (en capture) tant que la fenêtre est ouverte :
  //  - Échap ferme, sauf pendant la bascule. L'événement s'arrête là : sinon le planning
  //    quitterait le mode Modifier derrière la fenêtre (son garde sur .modal-backdrop arrive
  //    trop tard, fermer() a déjà retiré le fond), et l'assistant fermerait son panneau ;
  //  - Tab reste dans la fenêtre (aria-modal) ;
  //  - les flèches circulent dans le groupe sans choisir : choisir recharge la page.
  function auClavier(e) {
    if (!backdrop.isConnected) { document.removeEventListener("keydown", auClavier, true); return; }
    const ici = document.activeElement;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fermer();
      return;
    }
    if (e.key === "Tab") {
      const cibles = [...backdrop.querySelectorAll("button:not(:disabled)")];
      if (cibles.length === 0) { e.preventDefault(); return; }  // bascule en cours : rien à atteindre
      const premiere = cibles[0];
      const derniere = cibles[cibles.length - 1];
      if (!backdrop.contains(ici)) { e.preventDefault(); (e.shiftKey ? derniere : premiere).focus(); }
      else if (e.shiftKey && (ici === premiere || ici === modal)) { e.preventDefault(); derniere.focus(); }
      else if (!e.shiftKey && ici === derniere) { e.preventDefault(); premiere.focus(); }
      return;
    }
    const choix = [...liste.querySelectorAll(".promo-choix")];
    const i = choix.indexOf(ici);
    if (i < 0 || bascule) return;
    // Alt, Ctrl ou Cmd + flèche : raccourci du navigateur (page précédente), on le laisse passer.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let vers;
    switch (e.key) {
      case "ArrowDown": case "ArrowRight": vers = i + 1; break;
      case "ArrowUp": case "ArrowLeft": vers = i - 1; break;
      case "Home": vers = 0; break;
      case "End": vers = choix.length - 1; break;
      default: return;
    }
    e.preventDefault();
    choix[(vers + choix.length) % choix.length].focus();
  }
}
