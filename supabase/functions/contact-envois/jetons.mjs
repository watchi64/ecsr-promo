// Jetons des liens d'e-mail de l'espace contact (C-11, C-12). Module pur : l'aléa et la cryptographie sont injectés
// (crypto.getRandomValues et crypto.subtle dans la fonction serveur, les mêmes dans les tests).
// Un jeton nu (32 octets, base64url sans « = » : 43 caractères) ne vit que dans l'e-mail ; la base n'en reçoit que le haché
// sha256 en hexadécimal (64 caractères), qu'elle décode et compare.

function base64url(octets) {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// aleatoire(n) rend n octets aléatoires (Uint8Array).
export function nouveauJeton(aleatoire) {
  return base64url(aleatoire(32));
}

export async function hacherJeton(subtle, jeton) {
  const empreinte = new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(jeton)));
  return Array.from(empreinte, (o) => o.toString(16).padStart(2, "0")).join("");
}

// Les actions d'un e-mail, selon l'événement, le destinataire et le type de la demande. Un stagiaire n'en a aucune (C-12 : seulement
// « Ouvrir dans l'app »). « reponse » vaut une action par réponse toute faite proposée (preparerJetons). La prise n'est pas proposée
// quand la base dit qu'elle n'a pas de sens (destinataire.peut_prendre faux) ; le justificatif accompagne la nouvelle d'une absence
// (avant la migration 3, la base rend « invalide » pour ce jeton).
export function actionsDe(evenement, destinataire, type) {
  if (destinataire?.stagiaire) return [];
  if (evenement === "nouvelle" || evenement === "reponse") {
    const actions = ["voir"];
    if (destinataire?.peut_prendre !== false) actions.push("prise");
    actions.push("reponse");
    if (evenement === "nouvelle" && type === "absence") actions.push("justificatif");
    return actions;
  }
  return ["voir"];
}

// Les jetons d'un élément de la file (_contact_srv_prendre) : les nus pour l'e-mail ({ voir, prise, justificatif, reponses:
// [{ libelle, jeton }] }) et les hachés pour la base ([{ hash, action, reponse_id }]), dans le même ordre.
export async function preparerJetons(item, aleatoire, subtle) {
  const nus = {};
  const haches = [];
  const poser = async (action, reponseId) => {
    const jeton = nouveauJeton(aleatoire);
    haches.push(reponseId == null ? { hash: await hacherJeton(subtle, jeton), action }
      : { hash: await hacherJeton(subtle, jeton), action, reponse_id: reponseId });
    return jeton;
  };
  for (const action of actionsDe(item?.evenement, item?.destinataire, item?.demande?.type)) {
    if (action === "reponse") {
      for (const r of Array.isArray(item?.reponses) ? item.reponses : []) {
        (nus.reponses ??= []).push({ libelle: String(r.libelle ?? ""), jeton: await poser("reponse", r.id) });
      }
    } else {
      nus[action] = await poser(action);
    }
  }
  return { nus, haches };
}
