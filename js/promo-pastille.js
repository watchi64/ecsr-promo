// Pastille de la promo affichée (spec multi-promo C.2) : visible seulement à qui a au
// moins deux promos (formateurs, fondateur). Un appui ouvre le choix ; choisir une autre
// promo attend les enregistrements en cours puis recharge la page (choisirPromo).
// Pastille du centre (lot 5, D6) : dans la barre de la direction, quand le compte dirige plusieurs centres. Choisir un
// centre, c'est choisir l'une de ses promos (la première en cours, sinon la plus récente), avec le même rechargement. Les
// deux choix partagent la même fenêtre (ouvrirListe).
import { el, isoDate } from "./utils.js?v=20261109f";
import { getMesPromos, getPromoCourante, choisirPromo } from "./db.js?v=20261109f";
import { libelleCourtPromo, resumePromo } from "./promo-rules.js?v=20261109f";
import { isFounder, apercusOuverts, setViewAs, getAffectations, getCentre } from "./auth-admin.js?v=20261109f";
import { promoPourLaDirection, promosDuCentre } from "./espaces-rules.js?v=20261109f";

// « Montpellier · sept. 2026 » : le lieu dans son propre span, que le CSS masque sur les
// écrans les plus étroits (la date suffit à distinguer les promos dans la barre).
function texteDePastille(libelle) {
  const i = libelle.indexOf(" · ");
  if (i < 0) return el("span", { class: "promo-pastille-texte" }, libelle);
  return el("span", { class: "promo-pastille-texte" },
    el("span", { class: "promo-pastille-lieu" }, libelle.slice(0, i + 3)),
    libelle.slice(i + 3));
}

// Seconde ligne d'un choix : « 9 stagiaires en cours · fin dans 69 jours ». Chaque partie forme un bloc
// en ligne et le séparateur reste en fin de la première : quand la ligne est trop longue (écran étroit,
// texte agrandi), la coupe tombe entre les deux parties, jamais avec un « · » en tête de ligne. Le texte,
// lui, reste celui de resumePromo (la description lue par les lecteurs d'écran).
function segmentsDeDetail(resume) {
  const parties = resume.split(" · ");
  return parties.flatMap((texte, i) => (i === parties.length - 1
    ? [el("span", { class: "promo-choix-segment" }, texte)]
    : [el("span", { class: "promo-choix-segment" }, texte + " ·"), " "]));
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

// Ouvre la fenêtre du choix de promo (la pastille s'en sert ; la coquille du stagiaire, qui n'a pas de pastille, la
// propose depuis le menu du compte).
export function ouvrirChoixPromo() { ouvrirChoix(); }

function ouvrirChoix() {
  const promos = getMesPromos();
  const courante = getPromoCourante();
  if (bascule || promos.length < 2 || !courante) return;
  // Formateur et direction : voir la promo affichée comme un stagiaire (le fondateur a son sélecteur dans le menu du
  // compte). L'aperçu se pose sur la promo affichée ; la fenêtre se ferme, l'app change d'espace.
  const apercuStagiaire = !isFounder() && apercusOuverts().includes("stagiaire");
  ouvrirListe({
    sorte: "promo", titre: "Promo affichée", enCours: "Changement de promo en cours…",
    choix: promos.map((p) => ({
      id: p.id, nom: p.nom, detail: resumePromo(p), active: p.id === courante.id,
      // Retirée de la liste depuis l'ouverture : rien à basculer.
      possible: () => getMesPromos().some((x) => x.id === p.id),
      choisir: () => choisirPromo(p.id),
    })),
    apres: apercuStagiaire ? (fermer) => el("button", { class: "btn full promo-choix-apercu", type: "button", onClick: () => {
      if (bascule) return;
      fermer();
      setViewAs("stagiaire");
    } }, "Voir cette promo comme un stagiaire") : null,
  });
}

// ----- Centre (direction, lot 5) -----

// Les centres que le compte dirige (affectations direction, un par lieu), dans l'ordre des affectations.
function centresDiriges() {
  const vus = new Map();
  for (const a of getAffectations()) {
    if (a.role === "direction" && a.lieu_id != null && !vus.has(a.lieu_id)) vus.set(a.lieu_id, { id: a.lieu_id, nom: a.lieu_nom });
  }
  return [...vus.values()];
}

// La promo à afficher pour entrer dans ce centre (D6) : la première en cours, sinon la plus récente ; null sans promo.
function promoDuCentre(lieuId) {
  return promoPourLaDirection({
    promo: null, promos: getMesPromos(), affectations: [{ role: "direction", lieu_id: lieuId }], aujourdhui: isoDate(new Date()),
  });
}

export function construirePastilleCentre() {
  const centres = centresDiriges();
  const centre = getCentre();
  if (centres.length < 2 || !centre) return null;
  const nom = centre.nom || "Mon centre";
  return el("button", {
    class: "promo-pastille", type: "button", "aria-haspopup": "dialog",
    title: "Centre affiché : " + nom,
    disabled: bascule,
    onClick: ouvrirChoixCentre,
  },
    el("span", { class: "promo-pastille-texte" }, nom),
    el("span", { class: "promo-pastille-fleche", "aria-hidden": "true" }, "▾"),
  );
}

function ouvrirChoixCentre() {
  const centres = centresDiriges();
  const centre = getCentre();
  if (bascule || centres.length < 2 || !centre) return;
  ouvrirListe({
    sorte: "centre", titre: "Centre affiché", enCours: "Changement de centre en cours…",
    choix: centres.map((c) => {
      const n = promosDuCentre(getMesPromos(), c.id).length;
      const cible = promoDuCentre(c.id);
      return {
        id: c.id, nom: c.nom || "Centre " + c.id, active: c.id === centre.id,
        // Un centre sans promo n'a rien à afficher (D6) : il est dit, pas choisi.
        detail: n ? n + (n > 1 ? " promos" : " promo") : "Aucune promo pour l'instant",
        desactive: cible == null && c.id !== centre.id,
        possible: () => promoDuCentre(c.id) != null,
        choisir: () => choisirPromo(promoDuCentre(c.id)),
      };
    }),
  });
}

// La fenêtre d'un choix (promo ou centre) : une liste de boutons radio, le clavier qui y circule sans choisir, un choix qui
// verrouille tout jusqu'au rechargement. `choix` : { id, nom, detail, active, desactive, possible(), choisir() } ; `apres` :
// une fabrique de bouton posé sous la liste (reçoit `fermer`).
function ouvrirListe({ sorte, titre, enCours, choix, apres = null }) {
  if (document.querySelector(".promo-choix-modal")) return;  // déjà ouvert (clavier)

  const backdrop = el("div", { class: "modal-backdrop" });
  const aide = el("p", { class: "muted", role: "status" }, "Ton choix est mémorisé sur cet appareil.");
  const liste = el("div", { class: "promo-choix-liste", role: "radiogroup", "aria-label": titre });

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
    aide.textContent = enCours;
    backdrop.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    document.querySelectorAll(".promo-pastille").forEach((b) => { b.disabled = true; });
    modal.focus();
  };

  choix.forEach((c) => {
    // Nom accessible : le nom seul, comme avant la seconde ligne. Le résumé (stagiaires en cours, jours avant la fin ; nombre de
    // promos du centre) en est la description. Un seul dialogue à la fois : identifiants uniques.
    const idNom = sorte + "-choix-nom-" + c.id;
    const idDetail = sorte + "-choix-detail-" + c.id;
    liste.appendChild(el("button", {
      class: "promo-choix" + (c.active ? " active" : ""), type: "button", role: "radio",
      "aria-checked": c.active ? "true" : "false",
      "aria-labelledby": idNom, "aria-describedby": idDetail,
      disabled: !!c.desactive,
      onClick: async () => {
        if (bascule) return;
        // Choix déjà affiché, ou devenu impossible depuis l'ouverture : rien à basculer.
        if (c.active || !c.possible()) { fermer(); return; }
        verrouiller();
        await c.choisir();
      },
    },
      el("span", { class: "promo-choix-puce", "aria-hidden": "true" }, c.active ? "●" : "○"),
      el("span", { class: "promo-choix-texte" },
        el("span", { id: idNom }, c.nom),
        el("span", { class: "promo-choix-detail", id: idDetail }, segmentsDeDetail(c.detail)),
      ),
    ));
  });

  const idTitre = sorte + "-choix-titre";
  const modal = el("div", {
    class: "modal promo-choix-modal", role: "dialog", "aria-modal": "true",
    "aria-labelledby": idTitre, tabindex: "-1",
  },
    el("h3", { id: idTitre }, titre),
    aide,
    liste,
    apres ? apres(fermer) : null,
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
    const boutons = [...liste.querySelectorAll(".promo-choix:not(:disabled)")];
    const i = boutons.indexOf(ici);
    if (i < 0 || bascule) return;
    // Alt, Ctrl ou Cmd + flèche : raccourci du navigateur (page précédente), on le laisse passer.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let vers;
    switch (e.key) {
      case "ArrowDown": case "ArrowRight": vers = i + 1; break;
      case "ArrowUp": case "ArrowLeft": vers = i - 1; break;
      case "Home": vers = 0; break;
      case "End": vers = boutons.length - 1; break;
      default: return;
    }
    e.preventDefault();
    boutons[(vers + boutons.length) % boutons.length].focus();
  }
}
