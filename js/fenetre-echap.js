// Échap ferme une fenêtre plein écran de l'app (celle du QCM) : même geste que les autres fenêtres, qui
// écoutent la touche sur le document. `agir` est l'action du bouton de fermeture (avec sa confirmation
// éventuelle). L'écouteur s'efface de lui-même quand la fenêtre a quitté la page.
export function fermerParEchap(fenetre, agir, doc = document) {
  function surTouche(e) {
    if (!fenetre.isConnected) { doc.removeEventListener("keydown", surTouche); return; }
    if (e.key !== "Escape" || e.defaultPrevented) return;
    e.preventDefault();
    agir();
  }
  doc.addEventListener("keydown", surTouche);
  return () => doc.removeEventListener("keydown", surTouche);
}
