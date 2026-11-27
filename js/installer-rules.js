/*
 * Jalonya : application propriétaire.
 * © 2026 Timy Studio. Tous droits réservés. Voir LICENSE.
 *
 * Règles de la page d'installation (installer.html) : reconnaître l'appareil et le navigateur, puis choisir ce que
 * la page montre. Aucune dépendance au DOM : tests/installer.test.mjs.
 *
 * Ce que chaque cas permet (vérifié le 27/11/2026) :
 *   - Chrome, Edge, Samsung Internet (Android et ordinateur) : l'événement beforeinstallprompt ouvre la fenêtre
 *     d'installation du navigateur en un toucher. Chrome n'exige plus de service worker pour installer (Chrome 108
 *     sur téléphone, 112 sur ordinateur) ; essai sur app.jalonya.fr : aucune erreur d'installabilité, l'événement part.
 *   - iPhone et iPad : Apple n'autorise aucune installation déclenchée par la page ; l'utilisateur passe par
 *     Partager, puis « Sur l'écran d'accueil ».
 *   - Firefox sur ordinateur, Safari sur Mac : pas d'installation par la page ; on conseille Chrome ou Edge.
 */

// Rend { systeme, navigateur } à partir de ce que le navigateur dit de lui-même.
//   systeme    : "ios" | "android" | "ordinateur"
//   navigateur : "safari" | "chrome" | "edge" | "samsung" | "firefox" | "autre"
export function reconnaitre({ ua = "", platform = "", maxTouchPoints = 0 } = {}) {
  const u = String(ua);
  // iPadOS se présente comme un Mac : seul l'écran tactile le trahit.
  const ios = /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && Number(maxTouchPoints) > 1)
    || (platform === "MacIntel" && Number(maxTouchPoints) > 1);
  const android = !ios && /Android/i.test(u);
  const systeme = ios ? "ios" : android ? "android" : "ordinateur";

  let navigateur = "autre";
  if (/SamsungBrowser/.test(u)) navigateur = "samsung";
  else if (/EdgiOS|EdgA|Edg\//.test(u)) navigateur = "edge";
  else if (/FxiOS|Firefox\//.test(u)) navigateur = "firefox";
  else if (/CriOS|Chrome\/|Chromium\//.test(u)) navigateur = "chrome";
  else if (/Safari\//.test(u) && /Version\//.test(u)) navigateur = "safari";
  else if (ios && /AppleWebKit/.test(u)) navigateur = "safari";   // vue web d'iOS sans « Version/ »
  return { systeme, navigateur };
}

// Ce que la page affiche :
//   "installee"   : on est déjà dans l'app installée (rien à faire, on l'ouvre) ;
//   "ios"         : le guide en trois images (Safari) ;
//   "ios-autre"   : iPhone dans un autre navigateur : le guide, précédé du conseil d'ouvrir Safari ;
//   "bouton"      : le bouton qui ouvre la fenêtre d'installation (Chrome, Edge, Samsung Internet) ;
//   "autre"       : navigateur qui n'installe pas (Firefox sur ordinateur, Safari sur Mac...) : conseiller Chrome ou Edge.
export function modeAffichage({ systeme, navigateur }, installee = false) {
  if (installee) return "installee";
  if (systeme === "ios") return navigateur === "safari" ? "ios" : "ios-autre";
  if (navigateur === "chrome" || navigateur === "edge" || navigateur === "samsung") return "bouton";
  // Firefox sur Android installe aussi (menu, « Installer ») mais sans beforeinstallprompt : le bouton y explique le menu.
  if (systeme === "android") return "bouton";
  return "autre";
}

// Le geste à faire soi-même quand la fenêtre d'installation ne s'ouvre pas d'un toucher (navigateur qui ne l'offre pas
// encore, ou pas du tout). Une phrase, dans les mots que l'écran affiche.
export function gesteManuel({ systeme, navigateur }) {
  if (systeme === "android") {
    if (navigateur === "samsung") return "Touchez le menu (les trois traits en bas à droite), puis « Ajouter page à » et « Écran d'accueil ».";
    if (navigateur === "firefox") return "Touchez le menu (les trois points), puis « Installer » ou « Ajouter à l'écran d'accueil ».";
    return "Touchez le menu (les trois points en haut à droite), puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».";
  }
  if (navigateur === "chrome" || navigateur === "edge") {
    return "Cliquez sur l'icône d'installation au bout de la barre d'adresse, ou cherchez « Installer » dans le menu (les trois points en haut à droite).";
  }
  return "Ouvrez cette page dans Chrome ou Edge pour installer l'app.";
}

// Vrai quand la page est ouverte dans l'app installée (écran d'accueil, fenêtre d'app sur ordinateur).
export function estInstallee(matchMedia, navigatorStandalone) {
  if (navigatorStandalone === true) return true;
  if (typeof matchMedia !== "function") return false;
  return ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"]
    .some((m) => { try { return matchMedia(`(display-mode: ${m})`).matches; } catch { return false; } });
}
