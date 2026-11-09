/**
 * Cours et QCM, sous-onglet « QCM » du stagiaire (nouvelle navigation, lot 2B) : tous ses QCM sur une seule liste, avec
 * la dernière note d'entraînement de chacun et un bouton « Ouvrir » qui ouvre la fenêtre du QCM (celle de la colonne
 * QCM de la liste des thèmes : entraînement, erreurs à revoir, examen quand le formateur l'a ouvert). Les règles (quels QCM,
 * quel ordre, quelle phrase d'état) sont dans js/qcm-rules.js. Modèle de js/views/signalements.js : garde `isActive`,
 * compteur de génération, boîte d'erreur avec « Réessayer ».
 */
import { el, clear } from "../utils.js?v=20261109f";
import { listQcmIndex, listMyQcmAttempts } from "../db.js?v=20261109f";
import { lignesQcmStagiaire } from "../qcm-rules.js?v=20261109f";
import { carte, ligneAction, erreurAvecReessai } from "./pages-cartes.js?v=20261109f";

// `onOuvrir(theme, qcm)` : ouvre la fenêtre du QCM (fournie par js/views/themes.js, qui la possède : l'importer ici ferait
// un cycle). Un QCM dont le thème est introuvable s'ouvre avec un thème de remplacement qui ne porte que son titre.
export async function renderQcmStagiaire(panel, { themes = [], onOuvrir = null, isActive = () => true } = {}) {
  clear(panel);
  const compte = el("span", { class: "acc-compte" });
  const c = carte({ titre: "Tes QCM", ico: "quiz", plus: compte, zone: "qcm" });
  panel.appendChild(c.noeud);

  let gen = 0;   // chargements concurrents : seule la dernière demande a le droit d'écrire
  // La carte est-elle encore dans son panneau ? Le panneau, partagé entre les sous-onglets, est vidé quand on le quitte ; au premier
  // chargement il n'est pas encore dans la page (renderSubTabs l'y pose après coup) : « dans le document » serait faux à tort.
  const vivante = () => c.noeud.parentNode === panel;

  // `silencieux` : une relecture après une tentative garde la liste affichée jusqu'à l'arrivée des données (pas de flash)
  // et, si elle échoue, ne remplace pas une liste juste par une erreur.
  async function charger(silencieux = false) {
    // Le panneau est partagé entre les sous-onglets : un chargement tardif ne doit pas écrire dans l'onglet qu'on regarde.
    if (!isActive() || !vivante()) return;
    const maGen = ++gen;
    if (!silencieux) { clear(c.corps); c.corps.appendChild(el("p", { class: "muted" }, "Chargement…")); }
    let index, tentatives;
    try {
      [index, tentatives] = await Promise.all([listQcmIndex(), listMyQcmAttempts()]);
    } catch (e) {
      // Journalisé : un échec muet rend un défaut invisible.
      console.error("QCM illisibles :", e);
      if (silencieux || !isActive() || maGen !== gen || !vivante()) return;
      compte.textContent = "";
      erreurAvecReessai(c.corps, "Tes QCM n'ont pas pu être chargés.", () => charger());
      return;
    }
    if (!isActive() || maGen !== gen || !vivante()) return;
    dessiner(lignesQcmStagiaire({ qcm: index, themes, tentatives }));
  }

  function dessiner(lignes) {
    clear(c.corps);
    // QCM est invariable : « 2 QCM », jamais « 2 QCMs ».
    compte.textContent = lignes.length ? `${lignes.length} QCM` : "";
    if (!lignes.length) {
      c.corps.appendChild(el("p", { class: "muted" }, "Aucun QCM n'est disponible pour l'instant."));
      return;
    }
    c.corps.appendChild(el("p", { class: "acc-intro" },
      "La note affichée est celle de ton dernier entraînement. Quand le formateur ouvre un examen, tu le passes depuis la fiche du QCM."));
    c.corps.appendChild(el("div", { class: "acc-lignes" }, ...lignes.map((l) => {
      const theme = l.theme || { id: null, numero: null, titre: l.qcm.titre, type: "theme" };
      return ligneAction({
        ico: "quiz", titre: l.titre, detail: l.etat,
        puces: [l.examenOuvert ? { texte: "Examen ouvert", ok: true } : null, l.etiquette],
        bouton: {
          texte: l.action, primaire: l.examenOuvert || l.note == null,
          nom: `${l.action} : ${l.titre}`,
          onClick: () => { if (onOuvrir) onOuvrir(theme, l.qcm); },
        },
      });
    })));
  }

  // Après un entraînement ou un examen (événement de js/views/qcm.js), la liste dit la nouvelle note. L'écouteur s'éteint
  // tout seul quand la liste a quitté la page.
  const surTentative = () => {
    if (!vivante()) { window.removeEventListener("qcm-attempt-saved", surTentative); return; }
    charger(true);
  };
  window.addEventListener("qcm-attempt-saved", surTentative);

  await charger();
}
