// Questionnaires anonymes (Qualiopi, indicateur 30) côté stagiaires et formateurs (spec 2026-11-08, § 4.4) : le
// bandeau « Ton avis sur la formation » (Accueil, dans les deux navigations, et Mon espace), la fenêtre qui pose
// les questions une par une, et l'ouverture par le lien direct #/questionnaire/<clé> (js/main.js).
//
// Règles pures dans js/questionnaire-ecran-rules.js. La base a le dernier mot : le bandeau suit la liste de
// lireQuestionnairesARemplir() (rien d'ouvert, déjà répondu, migration absente : liste vide, aucun bandeau). La
// fenêtre reprend la mécanique de js/nav-fenetre.js (une seule ouverte, focus, Tab gardé, Échap, voile, fermeture
// quand l'adresse change), comme « Signaler un problème » ; styles dans css/questionnaire.css.
//
// Rien de la réponse n'est gardé sur l'appareil au-delà de la session : le brouillon vit en mémoire le temps de
// répondre (fermer par erreur ne perd rien), puis disparaît à l'envoi. Seul « Plus tard » est écrit sur l'appareil.

import { el, isoDate, toast } from "./utils.js?v=20261110c";
import { getAdminEmail, onAdminChange } from "./auth-admin.js?v=20261110c";
import { lireQuestionnairesARemplir, envoyerQuestionnaire } from "./db.js?v=20261110c";
import { QUESTIONNAIRES, ECHELLE } from "./questionnaires-data.js?v=20261110c";
import { ouvrirFenetre, fermerFenetre, fenetreOuverte } from "./nav-fenetre.js?v=20261110c";
import {
  cleMemoire, lireMemoire, memoirePlusTard, idQuestionnaire, questionnaireDuBandeau, questionnaireDuLien,
  sousTitreBandeau, progression, aUneReponse, peutAvancer, premiereManquante, reponsesAEnvoyer,
  annonceEcran, ouvrirApresLecture, memoireDeSession,
} from "./questionnaire-ecran-rules.js?v=20261110c";

const MERCI = "Merci, ta réponse est enregistrée sans ton nom.";
const RIEN_A_REMPLIR = "Pas de questionnaire à remplir pour toi en ce moment : tu as peut-être déjà répondu, "
  + "ou la période pour y répondre n'est pas ouverte.";
const LONGUEUR_MAX = 2000;

// Brouillons de la session, par questionnaire (idQuestionnaire) : { reponses, etape }. Étape 0 : l'accueil de la
// fenêtre ; 1 à N : les questions. Questionnaires envoyés pendant la session : leur bandeau ne revient pas, même si
// une lecture arrive en retard. Les deux sont propres au compte : vidés quand le compte change sans rechargement
// (session expirée puis autre connexion dans le même onglet), et la fenêtre ouverte se ferme alors.
const session = memoireDeSession();
const { brouillons, envoyes } = session;
const suivreCompte = () => session.suivreCompte(getAdminEmail());
onAdminChange((user) => {
  const compteChange = session.suivreCompte(user?.email ?? null);
  if (compteChange && fenetreOuverte() === "questionnaire") fermerFenetre();
});
let envoiEnCours = false;

// --- Mémoire « Plus tard » (appareil, propre au compte) ---

function lirePlusTard() {
  const k = cleMemoire(getAdminEmail());
  if (!k) return {};
  try { return lireMemoire(localStorage.getItem(k)); } catch (e) { return {}; }
}

function ecrirePlusTard(memoire) {
  const k = cleMemoire(getAdminEmail());
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(memoire)); } catch (e) { /* navigation privée : le bandeau reviendra */ }
}

async function lireListe() {
  const liste = await lireQuestionnairesARemplir();
  suivreCompte();
  return liste.filter((item) => !envoyes.has(idQuestionnaire(item)));
}

// --- Bandeau ---

// Renvoie l'emplacement du bandeau, à insérer tout de suite dans la page : il se remplit à l'arrivée de la liste
// (vide, il ne prend aucune place : css/questionnaire.css, :empty).
export function bandeauQuestionnaire() {
  const place = el("div", { class: "questionnaire-place" });
  remplirPlace(place);
  return place;
}

async function remplirPlace(place) {
  const liste = await lireListe();
  const item = questionnaireDuBandeau({ liste, memoire: lirePlusTard(), aujourdhui: isoDate(new Date()) });
  if (item) place.replaceChildren(dessinerBandeau(item));
  else place.replaceChildren();
}

// Après un envoi ou un « Plus tard » : chaque bandeau de la page relit la liste (un autre questionnaire peut
// prendre la place, sinon le bandeau disparaît).
function rafraichirBandeaux() {
  document.querySelectorAll(".questionnaire-place").forEach((place) => remplirPlace(place));
}

function dessinerBandeau(item) {
  const q = QUESTIONNAIRES[item.cle];
  const repondre = el("button", { class: "btn primary questionnaire-bandeau-btn", type: "button" }, "Répondre");
  repondre.addEventListener("click", () => ouvrirQuestionnaire(item, { ancre: repondre }));
  const plusTard = el("button", { class: "btn ghost questionnaire-bandeau-btn", type: "button" }, "Plus tard");
  plusTard.addEventListener("click", () => {
    ecrirePlusTard(memoirePlusTard(lirePlusTard(), item, isoDate(new Date())));
    toast("D'accord, le questionnaire reviendra demain.", "info", 3000);
    rafraichirBandeaux();
  });
  return el("section", { class: "questionnaire-bandeau", "aria-label": q.titre },
    el("div", { class: "questionnaire-bandeau-texte" },
      el("p", { class: "questionnaire-bandeau-titre" }, q.titre),
      el("p", { class: "questionnaire-bandeau-sous-titre" }, sousTitreBandeau(q)),
    ),
    el("div", { class: "questionnaire-bandeau-actions" }, repondre, plusTard),
  );
}

// --- Lien direct #/questionnaire/<clé> ---

// Ouvre la fenêtre si la personne a ce questionnaire à remplir, sinon un mot doux sur l'Accueil. La liste arrive
// après le rendu de l'Accueil : si la personne a changé de page (ou ouvert une autre fenêtre) entre-temps, rien ne
// s'ouvre par-dessus (ouvrirApresLecture).
export async function ouvrirQuestionnaireDuLien(cle) {
  const adresseAvant = location.hash;
  const liste = await lireListe();
  if (!ouvrirApresLecture({ adresseAvant, adresseMaintenant: location.hash, fenetre: fenetreOuverte() })) return;
  const item = questionnaireDuLien({ liste, cle });
  if (item) ouvrirQuestionnaire(item);
  else toast(RIEN_A_REMPLIR, "info", 6000);
}

// Où rendre le focus à la fermeture quand le bouton « Répondre » qui a ouvert la fenêtre manque (lien direct) ou a
// disparu (bandeau redessiné après l'envoi) : le bouton « Répondre » d'un bandeau encore affiché, sinon le titre de
// la page. Avec l'ancienne barre, il n'y a pas de bouton du compte où retomber (js/nav-fenetre.js, rendreFocus).
function pointDeRetour() {
  const affiche = (e) => !!e && e.isConnected && e.getClientRects().length > 0;
  const bouton = [...document.querySelectorAll(".questionnaire-place .questionnaire-bandeau-btn")].find(affiche);
  if (bouton) return bouton;
  const titre = [...document.querySelectorAll("#view h1, #view h2")].find(affiche);
  if (titre && !titre.hasAttribute("tabindex")) titre.setAttribute("tabindex", "-1");
  return titre || null;
}

// --- La fenêtre ---

export function ouvrirQuestionnaire(item, { ancre = null } = {}) {
  const q = QUESTIONNAIRES[item.cle];
  const id = idQuestionnaire(item);
  suivreCompte();
  if (!brouillons.has(id)) brouillons.set(id, { reponses: {}, etape: 0 });
  const etat = brouillons.get(id);
  const total = q.questions.length;

  const corps = el("div", { class: "qn-corps" });
  const fermer = el("button", { type: "button", class: "qn-fermer" }, "Fermer");
  fermer.addEventListener("click", () => fermerFenetre());

  // Zone annoncée aux lecteurs d'écran : la progression (« Question 3 sur 10 ») à chaque changement d'écran. Hors du
  // corps, qui est remplacé à chaque écran : une zone neuve ne serait pas annoncée.
  const annonce = el("p", { class: "qn-annonce", "aria-live": "polite" });

  ouvrirFenetre({
    nom: "questionnaire", ancre, etiquette: q.titre, classe: "questionnaire-fenetre", retour: pointDeRetour,
    contenu: [el("div", { class: "qn-tete" }, el("h2", { class: "qn-titre" }, q.titre), fermer), annonce, corps],
  });

  // Le focus va au titre de l'écran (lu par les lecteurs d'écran) et la fenêtre remonte en haut.
  const montrer = (titre) => {
    corps.closest(".questionnaire-fenetre")?.scrollTo?.(0, 0);
    titre.focus({ preventScroll: true });
  };

  const ecranAccueil = () => {
    const titre = el("h3", { class: "qn-question", tabindex: "-1" }, "Avant de commencer");
    const commencer = el("button", { type: "button", class: "btn primary qn-suivant" }, "Commencer");
    commencer.addEventListener("click", () => { etat.etape = 1; dessiner(true); });
    corps.replaceChildren(
      titre,
      el("p", { class: "qn-intro" }, q.intro),
      el("p", { class: "qn-intro qn-intro-detail" },
        `${total} questions, une par écran. Tu peux revenir en arrière avant d'envoyer.`),
      el("div", { class: "qn-actions" }, commencer),
    );
    return titre;
  };

  const ecranQuestion = () => {
    const rang = etat.etape;
    const question = q.questions[rang - 1];
    const derniere = rang === total;
    const { texte, pourcent } = progression(rang, total);
    const idTitre = `qn-q-${question.id}`;
    const titre = el("h3", { class: "qn-question", id: idTitre, tabindex: "-1" }, question.texte);
    const aide = el("p", { class: "qn-aide", role: "status" });

    let champ;
    if (question.type === "commentaire") {
      const zone = el("textarea", {
        id: "qn-commentaire", class: "qn-commentaire", rows: "5", maxlength: String(LONGUEUR_MAX),
        "aria-labelledby": idTitre, "aria-describedby": "qn-compteur",
      });
      zone.value = etat.reponses[question.id] || "";
      const compteur = el("p", { class: "qn-compteur", id: "qn-compteur" });
      const compter = () => {
        compteur.textContent = `${zone.value.length.toLocaleString("fr-FR")} sur ${LONGUEUR_MAX.toLocaleString("fr-FR")} caractères`;
      };
      zone.addEventListener("input", () => {
        etat.reponses[question.id] = zone.value;
        compter();
        majSuivant();
      });
      compter();
      champ = el("div", { class: "qn-champ-texte" }, zone, compteur);
    } else {
      const options = question.type === "echelle"
        ? ECHELLE.map((o) => ({ valeur: o.valeur, libelle: o.libelle, chiffre: o.valeur }))
        : question.options.map((o) => ({ valeur: o, libelle: o, chiffre: null }));
      champ = el("div", { class: "qn-options" + (question.type === "echelle" ? " qn-echelle" : ""), role: "radiogroup", "aria-labelledby": idTitre },
        options.map((o, i) => {
          const entree = el("input", { type: "radio", name: `qn-${question.id}`, id: `qn-${question.id}-${i}`, class: "qn-radio" });
          entree.checked = aUneReponse(question, etat.reponses) && etat.reponses[question.id] === o.valeur;
          entree.addEventListener("change", () => {
            etat.reponses[question.id] = o.valeur;
            aide.textContent = "";
            majSuivant();
          });
          return el("label", { class: "qn-option" + (o.chiffre === null && question.type === "echelle" ? " qn-sans-avis" : ""), for: entree.id },
            entree,
            o.chiffre !== null ? el("span", { class: "qn-chiffre", "aria-hidden": "true" }, String(o.chiffre)) : null,
            el("span", { class: "qn-libelle" }, o.libelle));
        }));
    }

    const retour = el("button", { type: "button", class: "btn ghost qn-retour" }, "Retour");
    retour.addEventListener("click", () => { etat.etape = rang - 1; dessiner(true); });
    const suivant = el("button", { type: "button", class: "btn primary qn-suivant" });
    const majSuivant = () => {
      if (derniere) suivant.textContent = envoiEnCours ? "Envoi…" : "Envoyer";
      else suivant.textContent = question.facultative && !aUneReponse(question, etat.reponses) ? "Passer" : "Suivant";
    };
    majSuivant();
    suivant.addEventListener("click", async () => {
      if (envoiEnCours) return;
      if (!peutAvancer(question, etat.reponses)) {
        aide.textContent = question.type === "echelle"
          ? "Choisis une réponse pour continuer. Si tu ne sais pas, « Sans avis » compte comme une réponse."
          : "Choisis la réponse qui te correspond le mieux pour continuer.";
        champ.querySelector("input")?.focus();
        return;
      }
      if (!derniere) { etat.etape = rang + 1; dessiner(true); return; }
      // Dernier écran : une question obligatoire restée sans réponse ramène à elle (ne devrait pas arriver).
      const manque = premiereManquante(q, etat.reponses);
      if (manque >= 0) { etat.etape = manque + 1; dessiner(true); return; }
      envoiEnCours = true;
      suivant.setAttribute("aria-busy", "true");
      majSuivant();
      try {
        const { reponses, commentaire } = reponsesAEnvoyer(q, etat.reponses);
        await envoyerQuestionnaire({ cle: item.cle, portee: item.portee, version: item.version, reponses, commentaire });
        envoyes.add(id);
        brouillons.delete(id);
        if (fenetreOuverte() === "questionnaire" && corps.isConnected) { annonce.textContent = ""; montrer(ecranMerci()); }
        else toast(MERCI, "success", 4500);
      } catch (e) {
        // Le message vient de js/questionnaires-erreurs.js : déjà répondu, fermé, connexion... Montré dans la fenêtre.
        if (aide.isConnected) aide.textContent = e.message;
        else toast(e.message, "info", 6000);
      } finally {
        envoiEnCours = false;
        suivant.removeAttribute("aria-busy");
        majSuivant();
        rafraichirBandeaux();
      }
    });

    // replaceChildren écrirait « null » en toutes lettres : la mention « Facultative » absente est retirée avant.
    corps.replaceChildren(...[
      el("div", { class: "qn-progression" },
        el("p", { class: "qn-progression-texte" }, texte),
        el("div", {
          class: "qn-barre", role: "progressbar", "aria-label": "Progression",
          "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(rang), "aria-valuetext": texte,
        }, el("div", { class: "qn-barre-remplie", style: `width: ${pourcent}%` })),
      ),
      titre,
      question.facultative ? el("p", { class: "qn-facultative" }, "Facultative : tu peux passer.") : null,
      champ,
      aide,
      el("div", { class: "qn-actions" }, retour, suivant),
    ].filter(Boolean));
    return titre;
  };

  const ecranMerci = () => {
    const titre = el("h3", { class: "qn-question qn-merci", tabindex: "-1" }, MERCI);
    const fin = el("button", { type: "button", class: "btn primary qn-suivant" }, "Fermer");
    fin.addEventListener("click", () => fermerFenetre());
    corps.replaceChildren(
      el("div", { class: "qn-merci-bloc" },
        titre,
        el("p", { class: "qn-intro" }, "Elle compte avec celles des autres pour améliorer la formation."),
      ),
      el("div", { class: "qn-actions" }, fin),
    );
    return titre;
  };

  // `focus` : l'écran change sous les yeux de la personne, le focus suit (pas à l'ouverture, où nav-fenetre le pose
  // sur la fenêtre).
  function dessiner(focus) {
    const titre = etat.etape === 0 ? ecranAccueil() : ecranQuestion();
    annonce.textContent = annonceEcran(etat.etape, total);
    if (focus) montrer(titre);
  }
  dessiner(false);
}
