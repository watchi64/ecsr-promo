// Regles pures du chatbot (testables sans DOM) : fenetre de contexte envoyee a
// l'Edge Function et decodage de son flux SSE.

export function fenetreMessages(histo, max = 8) {
  return (histo ?? []).slice(-max).map((m) => ({ role: m.role, content: m.content }));
}

export function pageDepuisHash(hash) {
  const route = String(hash ?? "").replace(/^#\//, "");
  return route || "mon-suivi";
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
