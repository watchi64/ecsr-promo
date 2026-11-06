// Fenêtre « Signaler un problème » (spec 2026-10-28, § 4.1, 4.2 et 5.3), commune aux deux navigations :
// un champ, une capture facultative, le contexte joint montré en clair, « Envoyer » ; sous le formulaire,
// « Mes signalements » ; en tête, chez le fondateur hors aperçu, le lien vers les problèmes signalés.
// Mécanique des fenêtres de la coquille (js/nav-fenetre.js : une seule ouverte à la fois, Tab gardé dans
// la fenêtre, Échap, voile, focus rendu, fermeture quand l'adresse change) ; styles à elle
// (css/signalement.css), valables avec l'ancienne barre comme avec la nouvelle.

import { el, toast } from "./utils.js?v=20261029b";
import { icon, deco } from "./icons.js?v=20261029b";
import { getViewAs, fondateurHorsApercu } from "./auth-admin.js?v=20261029b";
import { navigationV2Active } from "./nav-etat.js?v=20261029b";
import { signalerProbleme, mesSignalementsApp, marquerSuivisVus } from "./db.js?v=20261029b";
import { ouvrirFenetre, fermerFenetre, fenetreOuverte } from "./nav-fenetre.js?v=20261029b";
import { dernieresErreurs } from "./journal-erreurs.js?v=20261029b";
import { etatSignalements, poserEtatSignalements, chargerEtatSignalements } from "./signalement-etat.js?v=20261029b";
import {
  LIMITE_CAPTURE, COTE_MAX_CAPTURE, MAX_MES_SIGNALEMENTS, assemblerContexte, resumeContexte, detailContexte,
  verifierMessage, libelleStatut, dimensionsReduites,
} from "./signalement-rules.js?v=20261029b";

// Jeton de version des fichiers de l'app (« 20261028a ») : il dit quelle version la personne utilisait.
const VERSION = new URL(import.meta.url).searchParams.get("v") || "";
const IMAGE_ILLISIBLE = "Cette image ne passe pas : choisis une capture d'écran (PNG ou JPEG).";

// Brouillon gardé jusqu'à l'envoi réussi : fermer la fenêtre sans envoyer ne perd ni le texte ni l'image.
let brouillon = { texte: "", capture: null };
let envoiEnCours = false;
// Raison du dernier envoi raté quand la fenêtre a été fermée pendant l'envoi : montrée à la réouverture.
let erreurEnAttente = "";

// Ce qui part avec le message (spec § 6), relevé à l'ouverture : la page est celle derrière la fenêtre.
function releverContexte() {
  const vue = document.getElementById("view");
  const titre = vue?.querySelector("h1")?.textContent || vue?.querySelector("h2")?.textContent || "";
  const nav2 = navigationV2Active();
  return assemblerContexte({
    adresse: location.hash, titre, version: VERSION, navigation: nav2 ? "nouvelle" : "ancienne",
    espace: nav2 ? (document.body.dataset.espace || null) : null, apercu: getViewAs(),
    largeur: window.innerWidth, hauteur: window.innerHeight, densite: window.devicePixelRatio,
    tactile: window.matchMedia("(pointer: coarse)").matches,
    ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints,
    installee: window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
    langue: navigator.language, enLigne: navigator.onLine, heure: new Date().toISOString(),
    fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone || "", erreurs: dernieresErreurs(),
  });
}

// Image décodée (createImageBitmap, repli sur un élément img) et ce qu'il faut libérer ensuite.
async function decoder(fichier) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(fichier);
      return { image: bitmap, liberer: () => bitmap.close() };
    } catch (e) { /* format refusé ici : l'élément img essaie à son tour */ }
  }
  const url = URL.createObjectURL(fichier);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { image: img, liberer: () => URL.revokeObjectURL(url) };
}

// La capture choisie, réduite et encodée en JPEG sous LIMITE_CAPTURE : côté long 1 600 px à 0,72, puis
// 0,6, puis côté long 1 200 px à 0,6 ; au-delà, ou illisible, la phrase IMAGE_ILLISIBLE.
async function lireCapture(fichier) {
  let decodee;
  try { decodee = await decoder(fichier); } catch (e) { throw new Error(IMAGE_ILLISIBLE); }
  const { image, liberer } = decodee;
  try {
    for (const [cote, qualite] of [[COTE_MAX_CAPTURE, 0.72], [COTE_MAX_CAPTURE, 0.6], [1200, 0.6]]) {
      const { largeur, hauteur } = dimensionsReduites(image.width, image.height, cote);
      const toile = el("canvas", { width: String(largeur), height: String(hauteur) });
      const g = toile.getContext("2d");
      // Le JPEG n'a pas de transparence : fond blanc plutôt que noir.
      g.fillStyle = "#FFFFFF";
      g.fillRect(0, 0, largeur, hauteur);
      g.drawImage(image, 0, 0, largeur, hauteur);
      const donnees = toile.toDataURL("image/jpeg", qualite);
      if (donnees.startsWith("data:image/jpeg;base64,") && donnees.length <= LIMITE_CAPTURE) return donnees;
    }
  } finally {
    liberer();
  }
  throw new Error(IMAGE_ILLISIBLE);
}

const deuxChiffres = (n) => String(n).padStart(2, "0");

// « 28/10 à 10 h 42 »
function dateCourte(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)} à ${d.getHours()} h ${deuxChiffres(d.getMinutes())}`;
}

// Un signalement de la personne : date, statut, repère « Nouveau » s'il vient d'avancer, message (déplié
// à la demande quand il est long), réponse de l'éditeur.
function itemMien(s, nouveau) {
  const long = [...String(s.message || "")].length > 90;
  const message = long
    ? el("details", { class: "sg-mien-message" },
      el("summary", {}, [...s.message].slice(0, 90).join("").trimEnd() + "…"), el("p", {}, s.message))
    : el("p", { class: "sg-mien-message" }, s.message);
  return el("li", { class: "sg-mien" + (nouveau ? " sg-mien-nouveau" : "") },
    el("div", { class: "sg-mien-tete" },
      el("span", { class: "sg-mien-date" }, dateCourte(s.created_at)),
      el("span", { class: "sg-statut sg-statut-" + s.statut }, libelleStatut(s.statut, "personne")),
      nouveau ? el("span", { class: "sg-nouveau" }, "Nouveau") : null),
    message,
    s.reponse ? el("p", { class: "sg-reponse" }, el("b", {}, "Réponse : "), s.reponse) : null);
}

// « Mes signalements » : lu à l'ouverture ; ce qui avait avancé sans être vu porte « Nouveau » pendant
// cette ouverture, et la base le note comme vu (la pastille s'éteint).
async function chargerMesSignalements(zone) {
  let liste;
  try {
    liste = await mesSignalementsApp();
  } catch (e) {
    if (zone.isConnected) zone.replaceChildren(el("p", { class: "sg-mes-vide" }, "Tes signalements n'ont pas pu être chargés."));
    return;
  }
  if (!zone.isConnected) return;
  if (!liste.length) {
    zone.replaceChildren();
    return;
  }
  const nonVus = new Set(liste.filter((s) => s.suivi_le && !s.suivi_lu_le).map((s) => s.id));
  zone.replaceChildren(
    el("h3", { class: "sg-mes-titre" }, "Mes signalements"),
    el("ul", { class: "sg-mes-liste" }, liste.slice(0, MAX_MES_SIGNALEMENTS).map((s) => itemMien(s, nonVus.has(s.id)))));
  if (!nonVus.size) return;
  try {
    await marquerSuivisVus();
    poserEtatSignalements({ ...etatSignalements(), suivis: 0 });
  } catch (e) { /* le repère reviendra à la prochaine ouverture */ }
}

// Chez le fondateur hors aperçu : où en sont les signalements reçus, et le lien vers leur page.
function blocFondateur() {
  const n = etatSignalements().nouveaux;
  return el("div", { class: "sg-fondateur" },
    el("span", {}, "Problèmes signalés : ", el("b", {}, n === 0 ? "aucun nouveau" : n === 1 ? "1 nouveau" : `${n} nouveaux`)),
    el("a", { href: "#/problemes", class: "sg-fondateur-lien" }, "Ouvrir"));
}

// Ouvre la fenêtre. `ancre` : le bouton qui l'ouvre, à qui le focus revient à la fermeture (ou, s'il a
// disparu, un bouton « Signaler un problème » affiché, sinon le bouton du compte : js/nav-fenetre.js).
export function ouvrirSignalement({ ancre = null } = {}) {
  const contexte = releverContexte();
  const erreur = el("p", { class: "sg-erreur", role: "alert" });
  if (erreurEnAttente) {
    erreur.textContent = erreurEnAttente;
    erreurEnAttente = "";
  }

  const champ = el("textarea", {
    id: "sg-message", class: "sg-champ", rows: "4",
    placeholder: "Par exemple : sur la page Notes, le bouton Enregistrer ne réagit pas.",
  });
  champ.value = brouillon.texte;
  champ.addEventListener("input", () => {
    brouillon.texte = champ.value;
    erreur.textContent = "";
  });

  const entree = el("input", { type: "file", accept: "image/*", class: "sg-fichier", tabindex: "-1", "aria-hidden": "true" });
  const texteCapture = el("span", {}, "Joindre une capture");
  const boutonCapture = el("button", { type: "button", class: "btn ghost sg-joindre", "data-sg": "capture" },
    deco(icon.trombone()), texteCapture);
  boutonCapture.addEventListener("click", () => entree.click());
  const zoneCapture = el("div", { class: "sg-capture-zone" });
  const dessinerCapture = () => {
    if (!brouillon.capture) {
      zoneCapture.replaceChildren(boutonCapture);
      return;
    }
    const retirer = el("button", { type: "button", class: "btn ghost sg-retirer", "data-sg": "retirer" }, "Retirer");
    retirer.addEventListener("click", () => {
      brouillon.capture = null;
      dessinerCapture();
      boutonCapture.focus();
    });
    zoneCapture.replaceChildren(el("div", { class: "sg-miniature" },
      el("img", { src: brouillon.capture, alt: "Capture jointe" }), retirer));
  };
  entree.addEventListener("change", async () => {
    const fichier = entree.files && entree.files[0];
    entree.value = "";
    if (!fichier) return;
    erreur.textContent = "";
    boutonCapture.disabled = true;
    texteCapture.textContent = "Préparation…";
    try {
      brouillon.capture = await lireCapture(fichier);
    } catch (e) {
      erreur.textContent = e.message;
    } finally {
      boutonCapture.disabled = false;
      texteCapture.textContent = "Joindre une capture";
      dessinerCapture();
    }
  });
  dessinerCapture();

  const lignesDetail = detailContexte(contexte).flatMap(([cle, valeur]) => [el("dt", {}, cle), el("dd", {}, valeur)]);
  const joint = el("div", { class: "sg-joint" },
    el("p", { class: "sg-joint-ligne" }, el("span", { class: "sg-joint-titre" }, "Joint d'office : "),
      resumeContexte(contexte, new Date())),
    el("details", { class: "sg-detail" },
      el("summary", {}, "Voir le détail"),
      el("dl", { class: "sg-detail-liste" }, lignesDetail),
      contexte.erreurs.length
        ? el("ul", { class: "sg-erreurs-tech" }, contexte.erreurs.map((e) =>
          el("li", {}, `${e.a} ${e.message}${e.source ? ` (${e.source})` : ""}`)))
        : null));

  const envoyer = el("button", { type: "button", class: "btn primary sg-envoyer", "data-sg": "envoyer" }, "Envoyer");
  envoyer.addEventListener("click", async () => {
    if (envoiEnCours) return;
    const verif = verifierMessage(champ.value);
    if (!verif.ok) {
      erreur.textContent = verif.erreur;
      champ.focus();
      return;
    }
    envoiEnCours = true;
    envoyer.textContent = "Envoi…";
    envoyer.setAttribute("aria-busy", "true");
    erreur.textContent = "";
    try {
      await signalerProbleme({ message: verif.message, contexte, capture: brouillon.capture });
      brouillon = { texte: "", capture: null };
      erreurEnAttente = "";
      // Fermée pendant l'envoi, la fenêtre n'est plus là : ne pas fermer celle qui a pu s'ouvrir depuis.
      if (fenetreOuverte() === "signaler") fermerFenetre();
      toast("Merci, c'est transmis. La réponse s'affichera dans « Signaler un problème ».", "success", 4500);
      chargerEtatSignalements();
    } catch (e) {
      const phrase = `${e.message} Ton texte est gardé.`;
      if (erreur.isConnected) erreur.textContent = phrase;
      else erreurEnAttente = phrase;
    } finally {
      envoiEnCours = false;
      envoyer.textContent = "Envoyer";
      envoyer.removeAttribute("aria-busy");
    }
  });

  const mes = el("section", { class: "sg-mes", "aria-label": "Mes signalements" });
  const fermer = el("button", { type: "button", class: "sg-fermer", "data-sg": "fermer" }, "Fermer");
  fermer.addEventListener("click", () => fermerFenetre());

  ouvrirFenetre({
    nom: "signaler", ancre, etiquette: "Signaler un problème", classe: "signalement-fenetre",
    contenu: [
      el("div", { class: "sg-tete" }, el("h2", { class: "sg-titre" }, "Signaler un problème"), fermer),
      fondateurHorsApercu() ? blocFondateur() : null,
      el("label", { for: "sg-message", class: "sg-etiquette" }, "Que s'est-il passé ?"),
      champ,
      zoneCapture,
      entree,
      joint,
      erreur,
      envoyer,
      mes,
    ],
  });
  chargerMesSignalements(mes);
  // Au pointeur précis seulement : sur écran tactile, le clavier ne s'ouvre qu'au toucher du champ.
  if (window.matchMedia("(pointer: fine)").matches) champ.focus({ preventScroll: true });
}
