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

// Corps de la requete envoyee a l'Edge Function. `navigation` lui dit quelle barre voit la personne : elle choisit le guide de
// l'app qui la decrit. `espace` (lot 5) l'aide a choisir : la direction et le siege ont toujours la nouvelle barre (D4) et leur
// propre guide. Sans espace valide, le champ est omis et le corps est celui d'avant.
export function corpsRequete(histo, hash, navigationV2, espace) {
  const pilotage = espace === "direction" || espace === "siege";
  const corps = {
    messages: fenetreMessages(histo),
    page: pageDepuisHash(hash),
    navigation: navigationV2 || pilotage ? "nouvelle" : "ancienne",
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
