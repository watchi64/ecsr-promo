/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Lecteur commun des animations des cours (scènes de route, gestes) : boutons Lecture, Pause, Revoir et Rejouer,
 * facteur de lecture, boucle d'animation, étapes marquées et cliquables, départ quand 60 % du schéma sont visibles
 * (une seule fois), pause quand il sort tout à fait de l'écran, arrêt quand il sort du document, destruction. Le
 * dessin lui-même appartient au moteur qui l'appelle (`rendre(instant, fige)`) : js/scene-moteur.js pour la route,
 * js/geste-moteur.js pour les gestes. Règles pures : js/lecteur-anime-regles.js.
 *
 * Image figée (`fige` vrai) : pas à pas, pause, fin de lecture, animations réduites.
 *
 * Contrat de ce que reçoit monterLecteur (le lecteur ne le vérifie pas ; pour les gestes, js/geste-regles.js le contrôle) :
 * `etapes` compte au moins une étape, [{ t }] aux instants strictement croissants, la première à 0 ; `duree` dépasse
 * l'instant de la dernière étape ; `vitesseLecture` est un nombre fini strictement positif. Hors de ce contrat, une
 * lecture peut ne jamais finir ou une étape ne pas s'afficher.
 */
import { facteurLecture, SEUILS_VISIBILITE, actionVisibilite, etapeA } from "./lecteur-anime-regles.js?v=20261027a";

// Étape courante : classe « on » sur l'élément de l'étape, aria-current sur son bouton (c'est lui qui reçoit le focus)
// ou, sans bouton, sur l'élément lui-même.
function marquerEtape(element, courante) {
  element.classList.toggle("on", courante);
  const cible = (element.querySelector && element.querySelector("button")) || element;
  if (courante) cible.setAttribute("aria-current", "step");
  else cible.removeAttribute("aria-current");
}

export function monterLecteur({ racine, conteneur, duree, etapes, vitesseLecture = 1, reduit = false,
  elementsEtapes = [], rendre, onEtape = null, apresEtape = null }) {
  const barre = document.createElement("div");
  barre.className = "scene-commandes";
  const lecture = document.createElement("button");
  lecture.type = "button";
  lecture.className = "btn";
  const rejouerBtn = document.createElement("button");
  rejouerBtn.type = "button";
  rejouerBtn.className = "btn ghost";
  rejouerBtn.textContent = "Rejouer";
  barre.append(lecture, rejouerBtn);
  const facteur = facteurLecture(vitesseLecture);
  if (facteur) {
    // « × 0,5 » à l'écran ; les lecteurs d'écran lisent la phrase en clair.
    const span = document.createElement("span");
    span.className = "scene-facteur";
    const vu = document.createElement("span");
    vu.setAttribute("aria-hidden", "true");
    vu.textContent = facteur.texte;
    const lu = document.createElement("span");
    lu.className = "scene-lecteur-ecran";
    lu.textContent = facteur.libelle;
    span.append(vu, lu);
    barre.append(span);
  }
  conteneur.append(racine, barre);

  let t = 0, enCours = false, raf = 0, dernier = 0, etapeCourante = -1, dejaVu = false, observateur = null;

  function dessiner(instant) {
    rendre(instant, reduit || !enCours);
    const k = etapeA(etapes, instant);
    if (k !== etapeCourante) {
      etapeCourante = k;
      elementsEtapes.forEach((element, i) => marquerEtape(element, i === k));
      if (onEtape) onEtape(k);
    }
  }
  // Le libellé du bouton porte l'état (Lecture, Pause, Revoir) : pas d'aria-pressed, qui le doublerait.
  function majBouton() {
    lecture.textContent = enCours ? "Pause" : (t >= duree ? "Revoir" : "Lecture");
  }
  function arreter() { enCours = false; cancelAnimationFrame(raf); }
  function boucle(maintenant) {
    if (!racine.isConnected) { detruire(); return; }
    // Avance plafonnée à 0,1 s (onglet en arrière-plan) et jamais négative : l'horodatage de la première image peut précéder
    // l'instant noté au clic (Chrome), et la lecture reculerait d'une image.
    const dt = Math.max(0, Math.min(0.1, (maintenant - dernier) / 1000)) * vitesseLecture;
    dernier = maintenant;
    t = Math.min(duree, t + dt);
    // Une image qui lève (une valeur non finie à un instant que les contrôles n'échantillonnent pas) arrête la lecture au lieu
    // de la figer sur « Pause » : le bouton redit Lecture, la console garde la trace, et la lecture peut reprendre.
    try {
      if (t >= duree) { enCours = false; dessiner(t); majBouton(); return; }   // la dernière image est une image figée
      dessiner(t);
    } catch (erreur) {
      arreter();
      majBouton();
      console.error("Animation arrêtée : une image n'a pas pu se dessiner.", erreur);
      return;
    }
    raf = requestAnimationFrame(boucle);
  }
  // Une lecture demandée, comme un appui sur une étape, l'emporte sur la lecture automatique à la première visibilité.
  function jouer() {
    dejaVu = true;
    if (enCours) return;
    if (t >= duree) t = 0;
    enCours = true;
    dernier = performance.now();
    raf = requestAnimationFrame(boucle);
    majBouton();
  }
  function pause() { arreter(); dessiner(t); majBouton(); }
  function rejouer() { arreter(); t = 0; dessiner(0); jouer(); }
  function allerEtape(i) { dejaVu = true; arreter(); t = etapes[i].t; dessiner(t); majBouton(); if (apresEtape) apresEtape(i); }
  // Image figée à un instant quelconque (planche de revue, captures), ramené dans [0, duree]. Un instant qui n'est pas un
  // nombre fini (NaN, undefined, Infinity, une chaîne) est ignoré : l'appel ne change rien, la lecture en cours continue.
  // Il ne le ramène pas à 0, ce qui arrêterait une lecture et rembobinerait le schéma pour une faute d'appel, et surtout
  // il ne pose jamais t = NaN, que plus aucune lecture ne ferait atteindre la durée.
  function allerA(instant) {
    if (!Number.isFinite(instant)) return;
    dejaVu = true; arreter(); t = Math.max(0, Math.min(duree, instant)); dessiner(t); majBouton();
  }
  function detruire() { arreter(); if (observateur) observateur.disconnect(); majBouton(); }

  lecture.addEventListener("click", () => (enCours ? pause() : jouer()));
  rejouerBtn.addEventListener("click", rejouer);
  dessiner(0);
  majBouton();
  if (!reduit && typeof IntersectionObserver === "function") {
    // Seuils 0 et 60 % : le rappel part quand le schéma sort tout à fait de l'écran et quand il atteint 60 %. La décision
    // (démarrer, mettre en pause, ne rien faire) est celle de js/lecteur-anime-regles.js.
    observateur = new IntersectionObserver((entrees) => {
      const action = actionVisibilite(entrees[entrees.length - 1].intersectionRatio, dejaVu, enCours);
      if (action === "demarrer") jouer();
      else if (action === "pause") pause();
    }, { threshold: SEUILS_VISIBILITE });
    observateur.observe(racine);
  }
  return { jouer, pause, rejouer, allerEtape, allerA, detruire };
}
