// Habillage : posé avant la première peinture. Script classique (pas de module, aucun import) placé
// dans <head> après les feuilles de style : un module ne s'exécute qu'après la peinture, et l'écran
// montrerait d'abord l'habillage par défaut avant de basculer. Il reprend ce que l'appareil a
// retenu la dernière fois ; l'accord avec le compte se fait plus tard, au démarrage (js/habillage.js).
// La lecture de l'appareil est celle de `lireAppareil` (js/habillage-regles.js), recopiée ici
// parce qu'un script classique ne peut rien importer : seul le nom compte, ni l'e-mail ni l'état.
// Tout est dans un try : rien ne doit empêcher l'app de s'ouvrir (stockage bloqué, JSON abîmé).
(function () {
  var nom = "ecsr";
  try {
    var brut = JSON.parse(localStorage.getItem("ecsr_habillage"));
    if (brut && typeof brut === "object" && !Array.isArray(brut) && brut.nom === "ecf") nom = "ecf";
  } catch (e) { /* stockage illisible ou bloqué : habillage par défaut */ }
  try {
    var racine = document.documentElement;
    racine.dataset.skin = nom;
    // Couleur de la barre d'état du téléphone : le jeton de l'habillage, lu une fois l'attribut posé.
    var couleur = String(getComputedStyle(racine).getPropertyValue("--barre-etat") || "").trim();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (couleur && meta) meta.setAttribute("content", couleur);
  } catch (e) { /* l'app s'ouvre quand même */ }
})();
