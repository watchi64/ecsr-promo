/**
 * Cours et QCM, sous-onglet « Propositions IA » (formateurs de la promo seulement, isAdmin et formateur_courant en base :
 * la table des brouillons n'est lisible que par eux) : les questions que l'IA a proposées et que personne n'a encore relues, rangées par QCM, le plus ancien
 * d'abord. « Relire » ouvre l'éditeur du QCM ; l'acceptation et l'écart restent dans l'éditeur. Modèle de
 * js/views/signalements.js : garde `isActive`, compteur de génération, boîte d'erreur avec « Réessayer ».
 */
import { el, clear, formatDate } from "../utils.js?v=20261112c";
import { listBrouillonsIaARelire } from "../db.js?v=20261112c";
import { groupesDeBrouillons } from "../qcm-ia-rules.js?v=20261112c";
import { carte, ligneAction, erreurAvecReessai } from "./pages-cartes.js?v=20261112c";
import { pluriel } from "../nombres.js?v=20261112c";

// `onOuvrirEditeur(groupe, recharger)` : ouvre l'éditeur du QCM du groupe (js/views/themes.js, qui possède l'éditeur) et
// appelle `recharger` à sa fermeture, pour que la liste dise ce qui reste à relire.
export async function renderPropositionsIa(panel, { themes = [], onOuvrirEditeur = null, isActive = () => true } = {}) {
  clear(panel);
  const compte = el("span", { class: "acc-compte" });
  const c = carte({ titre: "Questions proposées par l'IA", ico: "quiz", plus: compte, zone: "ia" });
  panel.appendChild(c.noeud);

  let gen = 0;   // chargements concurrents : seule la dernière demande a le droit d'écrire
  // La carte est-elle encore dans son panneau ? Le panneau, partagé entre les sous-onglets, est vidé quand on le quitte ; au premier
  // chargement il n'est pas encore dans la page (renderSubTabs l'y pose après coup) : « dans le document » serait faux à tort.
  const vivante = () => c.noeud.parentNode === panel;

  async function charger(silencieux = false) {
    if (!isActive() || !vivante()) return;
    const maGen = ++gen;
    if (!silencieux) { clear(c.corps); c.corps.appendChild(el("p", { class: "muted" }, "Chargement…")); }
    let brouillons;
    try {
      brouillons = await listBrouillonsIaARelire();
    } catch (e) {
      console.error("Propositions de l'IA illisibles :", e);
      if (silencieux || !isActive() || maGen !== gen || !vivante()) return;
      compte.textContent = "";
      erreurAvecReessai(c.corps, "Les propositions de l'IA n'ont pas pu être chargées.", () => charger());
      return;
    }
    if (!isActive() || maGen !== gen || !vivante()) return;
    dessiner(brouillons);
  }

  function dessiner(brouillons) {
    clear(c.corps);
    const groupes = groupesDeBrouillons(brouillons, themes);
    compte.textContent = brouillons.length ? `${pluriel(brouillons.length, "question")} à relire` : "";
    if (!groupes.length) {
      c.corps.appendChild(el("p", { class: "muted" }, "Aucune question à relire."));
      return;
    }
    c.corps.appendChild(el("p", { class: "acc-intro" },
      "L'IA propose des questions à partir des cours. Aucune n'est publiée avant votre relecture : vous les acceptez ou les écartez dans l'éditeur du QCM."));
    c.corps.appendChild(el("div", { class: "acc-lignes" }, ...groupes.map((g) => ligneAction({
      ico: "quiz", titre: g.titre,
      detail: g.plusAncien
        ? (g.nombre > 1 ? `${pluriel(g.nombre, "question")} à relire, la plus ancienne proposée le ${formatDate(g.plusAncien)}`
          : `1 question à relire, proposée le ${formatDate(g.plusAncien)}`)
        : `${pluriel(g.nombre, "question")} à relire`,
      bouton: {
        texte: "Relire", primaire: true, nom: `Relire : ${g.titre}`,
        onClick: () => { if (onOuvrirEditeur) onOuvrirEditeur(g, () => charger(true)); },
      },
    }))));
  }

  await charger();
}
