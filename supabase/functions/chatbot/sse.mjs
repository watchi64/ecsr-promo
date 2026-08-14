// Decodage du flux SSE renvoye par Mistral/Gemini (format OpenAI stream).

export function extraireLignesSSE(tampon, morceau) {
  const lignes = (tampon + morceau).split("\n");
  const restant = lignes.pop() ?? "";
  const datas = [];
  for (const l of lignes) {
    // \r? : la spec SSE autorise des fins de ligne CRLF ; sans lui, un
    // fournisseur en CRLF verrait TOUTES ses lignes silencieusement perdues.
    // \r? : la spec SSE autorise des fins de ligne CRLF ; sans lui, un
    // fournisseur en CRLF verrait TOUTES ses lignes silencieusement perdues.
    const m = l.match(/^data:\s*(.*)\r?$/);
    if (m && m[1] && m[1] !== "[DONE]") datas.push(m[1]);
  }
  return { restant, datas };
}

export function nouvelEtat() {
  return { contenu: "", toolCalls: [], finRaison: null };
}

export function accumulerChunk(etat, chunk) {
  const choix = chunk?.choices?.[0];
  if (!choix) return "";
  const delta = choix.delta ?? {};
  let texte = "";
  if (typeof delta.content === "string" && delta.content) {
    etat.contenu += delta.content;
    texte = delta.content;
  }
  for (const tc of delta.tool_calls ?? []) {
    const i = tc.index ?? 0;
    if (!etat.toolCalls[i]) etat.toolCalls[i] = { id: "", function: { name: "", arguments: "" } };
    if (tc.id) etat.toolCalls[i].id = tc.id;
    if (tc.function?.name) etat.toolCalls[i].function.name += tc.function.name;
    if (tc.function?.arguments) etat.toolCalls[i].function.arguments += tc.function.arguments;
  }
  if (choix.finish_reason) etat.finRaison = choix.finish_reason;
  return texte;
}
