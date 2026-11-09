// Habillage (refonte, lot 3) : les règles seulement. Quel habillage montrer ("ecsr", le défaut,
// ou "ecf") d'après ce que l'appareil retient, ce que dit le compte et, plus tard (lot 5), les
// réglages du centre et du réseau. Module pur, sans DOM ni stockage : testé en node.

export const HABILLAGES = Object.freeze(["ecsr", "ecf"]);
export const HABILLAGE_PAR_DEFAUT = "ecsr";
// Clé du localStorage où l'appareil garde son dernier habillage appliqué.
export const CLE_APPAREIL = "ecsr_habillage";

export function habillageValide(nom) {
  return typeof nom === "string" && HABILLAGES.includes(nom);
}

// L'appareil garde toujours le dernier habillage appliqué (le script d'avant-peinture l'affiche
// sans éclair), mais `choisi` dit si c'est un choix de la personne. Sans cela, un habillage venu
// du défaut, du centre ou du réseau deviendrait un choix personnel au second démarrage, partirait
// sur le compte et le défaut du centre ne s'appliquerait plus à personne. `choisi` absent vaut
// vrai : seuls le levier des robots et une saisie à la main écrivent sans lui.
export function lireAppareil(texte) {
  if (typeof texte !== "string" || !texte) return null;
  let brut;
  try { brut = JSON.parse(texte); } catch { return null; }
  if (!brut || typeof brut !== "object" || Array.isArray(brut) || !habillageValide(brut.nom)) return null;
  const choisi = brut.choisi !== false;
  return {
    nom: brut.nom,
    email: typeof brut.email === "string" && brut.email ? brut.email : null,
    // Un habillage reçu d'ailleurs n'est jamais à envoyer au compte.
    aEnvoyer: choisi && brut.aEnvoyer === true,
    choisi,
  };
}

export function ecrireAppareil({ nom, email, aEnvoyer, choisi }) {
  return JSON.stringify({ nom, email: email ?? null, aEnvoyer: !!aEnvoyer, choisi: !!choisi });
}

// Ordre de la spec (§ 4.4). `envoi` est le nom à enregistrer sur le compte, ou null.
export function habillageRetenu({ appareil, compte, email, centre = null, reseau = null, libre = true }) {
  // L'appareil d'une autre personne ou un habillage non choisi ne sert qu'à l'avant-peinture.
  const autrePersonne = appareil && appareil.email && appareil.email !== email;
  const perso = appareil && habillageValide(appareil.nom) && appareil.choisi !== false && !autrePersonne
    ? appareil : null;
  const enAttente = perso && perso.aEnvoyer ? perso.nom : null;

  // Centre qui impose : il l'emporte, mais un choix personnel encore en attente est gardé sur
  // le compte pour le jour où le centre libère le choix.
  if (!libre && habillageValide(centre)) return { nom: centre, source: "centre", envoi: enAttente };
  if (enAttente) return { nom: enAttente, source: "appareil", envoi: enAttente };
  if (habillageValide(compte)) return { nom: compte, source: "compte", envoi: null };
  // Choix personnel que le compte ne connaît pas encore (même personne, ou pas encore attribué).
  if (perso) return { nom: perso.nom, source: "appareil", envoi: perso.nom };
  if (habillageValide(centre)) return { nom: centre, source: "centre", envoi: null };
  if (habillageValide(reseau)) return { nom: reseau, source: "reseau", envoi: null };
  return { nom: HABILLAGE_PAR_DEFAUT, source: "defaut", envoi: null };
}
