// Compteur de page du travail en autonomie (spec e-learning du 12/11) : mesure sobre du temps actif sur un écran
// (cours, entraînement QCM) et envoi par petites touches. Ce module ne sait rien du réseau : `ecrire` est fourni.
//
// Respect de la vie privée : les écouteurs notent seulement « une action a eu lieu maintenant » (jamais quelle touche,
// ni où, ni la position de défilement). La seule position envoyée est l'id de la dernière section vue, écrasé à chaque
// fois (aucun historique). Écouteurs passifs, rien n'est retardé ni filtré qui changerait le compte.

import { creerCompteur, PERIODE_ECRITURE_MS, trancheAEnvoyer } from "./autonomie-rules.js?v=20261112e";

/**
 * Suit un écran. Renvoie { finAtteinte(), section(id), arreter() }.
 *  - `zone` : l'élément qui défile ou reçoit les gestes (défilement, clic, touche, toucher).
 *  - `ecrire({ secondes, fin, section })` : envoi asynchrone ; s'il échoue (rejet ou exception), les secondes
 *    reviennent dans le cumul et repartent à l'appel suivant, sans rien afficher. Jamais deux envois à la fois,
 *    jamais plus de 60 secondes par envoi (la base refuse au-delà) : un retard part en envois successifs.
 *  - Options pour les tests : `horloge()` en millisecondes (monotone), `document`, `setIntervalFn`, `clearIntervalFn`.
 * Un envoi part toutes les 30 s s'il y a des secondes ou un changement (fin atteinte, nouvelle section), au passage
 * de la page en arrière-plan, à `pagehide` et à `arreter()`. Hors de la page (fermeture d'onglet), l'envoi est « au
 * mieux » : la requête peut ne pas aboutir, ce qui n'a pas été envoyé est perdu.
 */
export function suivreEcran({
  zone, ecrire,
  horloge = () => performance.now(),
  document: doc = globalThis.document,
  setIntervalFn = (fn, ms) => globalThis.setInterval(fn, ms),
  clearIntervalFn = (id) => globalThis.clearInterval(id),
}) {
  const compteur = creerCompteur();
  const fenetre = doc.defaultView || null;
  let cumul = 0;                 // secondes prélevées, pas encore envoyées
  let fin = false;
  let section = null;
  let finEnvoyee = false;
  let sectionEnvoyee = null;
  let enCours = false;
  let redemande = false;         // un envoi urgent (arrière-plan, fermeture) est arrivé pendant une écriture
  let arrete = false;

  const estVisible = () => doc.visibilityState !== "hidden";

  // Envoie tout ce qui attend à l'instant de l'appel, en tranches de 60 s au plus, une écriture à la fois. Ne lève
  // jamais. Pendant une écriture en vol, un appel ordinaire est ignoré (la minuterie repassera) ; un appel `urgent`
  // (arrière-plan, fermeture) fait refaire un tour complet à la fin de l'écriture, pour ne pas perdre le dernier temps.
  async function vider(urgent = false) {
    if (enCours) { if (urgent) redemande = true; return; }
    enCours = true;
    try {
      do {
        redemande = false;
        await envoyer();
      } while (redemande);
    } finally {
      enCours = false;
    }
  }

  // Un tour : prélève le temps écoulé, puis envoie le cumul (60 s au plus par appel) tant qu'il reste quelque chose.
  async function envoyer() {
    cumul += compteur.prelever(horloge());
    for (;;) {
      const n = trancheAEnvoyer(cumul);
      const change = fin !== finEnvoyee || section !== sectionEnvoyee;
      if (n === 0 && !change) break;
      cumul -= n;
      const f = fin;
      const s = section;
      try {
        await ecrire({ secondes: n, fin: f, section: s });
      } catch (e) {
        cumul += n;              // échec : les secondes repartent à l'appel suivant
        break;
      }
      finEnvoyee = f;
      sectionEnvoyee = s;
    }
  }

  const action = () => compteur.action(horloge());
  const visibilite = () => {
    compteur.visible(horloge(), estVisible());
    if (!estVisible()) vider(true);
  };
  const pagehide = () => {
    compteur.visible(horloge(), false);
    vider(true);
  };

  const gestes = ["scroll", "click", "touchstart", "keydown"];
  for (const type of gestes) zone.addEventListener(type, action, { passive: true });
  doc.addEventListener("keydown", action, { passive: true });
  doc.addEventListener("visibilitychange", visibilite);
  if (fenetre) fenetre.addEventListener("pagehide", pagehide);

  compteur.visible(horloge(), estVisible());
  action();                      // l'ouverture de l'écran est un geste
  const minuterie = setIntervalFn(() => { vider(); }, PERIODE_ECRITURE_MS);

  return {
    finAtteinte() { if (!arrete) fin = true; },
    section(id) { if (!arrete && id != null) section = String(id); },
    arreter() {
      if (arrete) return;
      for (const type of gestes) zone.removeEventListener(type, action, { passive: true });
      doc.removeEventListener("keydown", action, { passive: true });
      doc.removeEventListener("visibilitychange", visibilite);
      if (fenetre) fenetre.removeEventListener("pagehide", pagehide);
      clearIntervalFn(minuterie);
      vider(true);               // dernier envoi, avant de se déclarer arrêté
      arrete = true;
    },
  };
}
