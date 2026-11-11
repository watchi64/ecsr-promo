// Regles pures du chatbot (testables sans DOM) : fenetre de contexte envoyee a
// l'Edge Function et decodage de son flux SSE.

export function fenetreMessages(histo, max = 8) {
  return (histo ?? []).slice(-max).map((m) => ({ role: m.role, content: m.content }));
}

// Le premier segment seulement (#/stagiaires/12/epcf → stagiaires) : la fonction
// serveur n'accepte qu'un mot simple comme nom de page.
export function pageDepuisHash(hash) {
  const route = String(hash ?? "").replace(/^#\//, "").split("/")[0];
  return route || "mon-suivi";
}

// Espaces que la fonction serveur connait (js/espaces-rules.js, ESPACES) : tout autre mot n'est pas envoye.
const ESPACES_CONNUS = ["stagiaire", "equipe", "direction", "siege"];

// Corps de la requete envoyee a l'Edge Function. Une seule navigation depuis le 10/11 : le champ `navigation` n'est plus envoye.
// `espace` (lot 5) choisit le guide de l'app (la direction et le siege ont le leur). Sans espace valide, le champ est omis.
export function corpsRequete(histo, hash, espace) {
  const corps = {
    messages: fenetreMessages(histo),
    page: pageDepuisHash(hash),
  };
  if (ESPACES_CONNUS.includes(espace)) corps.espace = espace;
  return corps;
}

export function extraireEvenements(tampon, morceau) {
  const lignes = (String(tampon) + String(morceau)).split("\n");
  const restant = lignes.pop() ?? "";
  const evenements = [];
  for (const l of lignes) {
    // \r? : tolere des fins de ligne CRLF (meme garde que cote fonction)
    const m = l.match(/^data:\s*(.+?)\r?$/);
    if (!m) continue;
    try { evenements.push(JSON.parse(m[1])); } catch { /* ligne incomplete ignoree */ }
  }
  return { restant, evenements };
}
