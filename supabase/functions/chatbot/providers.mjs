// Appel des fournisseurs LLM (format OpenAI) avec streaming et bascule.
// Fournisseurs europeens uniquement : les conditions d'utilisation promettent que
// les messages restent chez un prestataire de l'Union europeenne (le secours Gemini
// a ete retire le 2026-10-04, GEMINI_API_KEY est donc ignoree).
// Scaleway d'abord (2026-10-23) : Mistral ne sert plus son API sur le plan gratuit
// depuis la mi-octobre (refus 429 constates le 20/10). Scaleway heberge les memes
// modeles Mistral a Paris, sans conservation des messages. Mistral reste en second,
// pour le jour ou son compte repasse sur un plan actif. Chaque fournisseur a une relance.
import { extraireLignesSSE, nouvelEtat, accumulerChunk } from "./sse.mjs";

export function fournisseursDisponibles(env) {
  const liste = [];
  if (env("SCW_SECRET_KEY")) {
    liste.push({
      nom: "scaleway",
      url: "https://api.scaleway.ai/v1/chat/completions",
      cle: env("SCW_SECRET_KEY"),
      modele: env("SCALEWAY_MODEL") || "mistral-medium-3.5-128b",
    });
  }
  if (env("MISTRAL_API_KEY")) {
    liste.push({
      nom: "mistral",
      url: "https://api.mistral.ai/v1/chat/completions",
      cle: env("MISTRAL_API_KEY"),
      modele: env("MISTRAL_MODEL") || "mistral-small-latest",
    });
  }
  return liste;
}

export function planTentatives(fournisseurs) {
  const plan = [];
  for (const f of fournisseurs) plan.push(f, f);
  return plan;
}

async function appelStream(f, corps, surTexte) {
  const resp = await fetch(f.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${f.cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...corps, model: f.modele, stream: true }),
  });
  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 300);
    throw new Error(`${f.nom} ${resp.status} : ${detail}`);
  }
  const lecteur = resp.body.getReader();
  const dec = new TextDecoder();
  let tampon = "";
  const etat = nouvelEtat();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    const r = extraireLignesSSE(tampon, dec.decode(value, { stream: true }));
    tampon = r.restant;
    for (const brut of r.datas) {
      let chunk;
      try { chunk = JSON.parse(brut); } catch { continue; }
      const texte = accumulerChunk(etat, chunk);
      if (texte) surTexte(texte);
    }
  }
  return etat;
}

export async function appelLLM({ fournisseurs, corps, surTexte }) {
  let texteEmis = false;
  let derniereErreur = null;
  for (const f of planTentatives(fournisseurs)) {
    try {
      return await appelStream(f, corps, (t) => { texteEmis = true; surTexte(t); });
    } catch (e) {
      console.error("chatbot fournisseur", f.nom, ":", e?.message ?? e);
      derniereErreur = e;
      // Du texte est deja parti au client : rejouer dupliquerait la reponse.
      if (texteEmis) break;
    }
  }
  throw derniereErreur ?? new Error("Aucun fournisseur LLM configure");
}
