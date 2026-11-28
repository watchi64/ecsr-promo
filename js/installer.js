/*
 * Jalonya : application propriétaire.
 * © 2026 Timy Studio. Tous droits réservés. Voir LICENSE.
 *
 * Page d'installation (installer.html), ouverte sans connexion. Montre le bloc qui convient à l'appareil :
 * le bouton qui ouvre la fenêtre d'installation du navigateur (événement beforeinstallprompt), le guide iPhone,
 * ou le conseil d'ouvrir Chrome ou Edge. Sur ordinateur, ajoute le code QR pour passer au téléphone.
 * Règles (sans DOM) : js/installer-rules.js.
 */
import { reconnaitre, modeAffichage, gesteManuel, estInstallee } from "./installer-rules.js?v=20261128b";
import { adresseApp } from "./adresse.js?v=20261128b";

// L'événement arrive tôt, parfois avant la fin du chargement de ce module : on l'écoute tout de suite.
let invitation = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();             // pas de bandeau du navigateur : c'est notre bouton qui ouvre la fenêtre
  invitation = e;
});

const $ = (id) => document.getElementById(id);
const montrer = (id) => { const n = $(id); if (n) n.hidden = false; };

// Typographie française : pas de « ? », « : » ni de guillemet seul en début de ligne.
const insecables = (t) => t.replace(/ ([?:!;])/g, " $1").replace(/« /g, "« ").replace(/ »/g, " »");

function etat(texte) {
  const n = $("ins-etat");
  if (n) n.textContent = insecables(texte);
}

function installee() {
  return estInstallee(window.matchMedia?.bind(window), navigator.standalone);
}

function preparer() {
  // L'adresse de cette page, affichée telle qu'on la tape (sans « https:// »).
  const adresse = adresseApp().replace(/^https?:\/\//, "") + "installer";
  for (const n of document.querySelectorAll("[data-adresse]")) n.textContent = adresse;

  const appareil = reconnaitre({ ua: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
  const mode = modeAffichage(appareil, installee());
  document.documentElement.dataset.mode = mode;

  if (mode === "installee") {
    // Ouverte depuis l'icône (iOS garde parfois l'adresse de la page où l'on a touché « Ajouter ») : droit à l'app.
    montrer("bloc-installee");
    location.replace("./");
    return;
  }
  if (mode === "ios" || mode === "ios-autre") {
    montrer("bloc-ios");
    if (mode === "ios-autre") montrer("ios-autre");
    return;
  }
  if (mode === "autre") montrer("bloc-autre");
  else montrer("bloc-bouton");
  if (appareil.systeme === "ordinateur") montrer("bloc-telephone");

  const bouton = $("btn-installer");
  if (!bouton) return;
  bouton.addEventListener("click", async () => {
    if (!invitation) {
      // Pas (encore) de fenêtre à ouvrir : navigateur qui ne la propose pas, ou app déjà installée.
      etat(gesteManuel(appareil) + " Si l'app est déjà installée, cherchez l'icône Jalonya sur l'écran d'accueil.");
      return;
    }
    const courante = invitation;
    invitation = null;               // une invitation ne sert qu'une fois
    bouton.disabled = true;
    try {
      await courante.prompt();
      const { outcome } = await courante.userChoice;
      if (outcome === "accepted") etat("Installation en cours...");
      else etat("Installation annulée. Vous pouvez recommencer quand vous voulez.");
    } catch {
      etat(gesteManuel(appareil));
    } finally {
      bouton.disabled = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    bouton.hidden = true;
    etat("C'est fait : l'icône Jalonya est sur votre écran d'accueil. Ouvrez-la et connectez-vous une fois.");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", preparer);
else preparer();
