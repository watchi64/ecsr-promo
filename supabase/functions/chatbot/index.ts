// Edge Function chatbot : orchestre le LLM et ses outils, streame la reponse en SSE.
// Secrets requis : MISTRAL_API_KEY (et/ou GEMINI_API_KEY), PISTE_CLIENT_ID, PISTE_CLIENT_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
import { consulterArticle } from "./piste.ts";
import { appelLLM, fournisseursDisponibles } from "./providers.mjs";
import { OUTILS, construirePromptSysteme } from "./outils.mjs";
import { AIDE_APP } from "./aide.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function executerOutil(nom: string, args: Record<string, unknown>, sr: ReturnType<typeof createClient>) {
  if (nom === "chercher_dans_les_cours") {
    const { data, error } = await sr.rpc("chercher_cours", {
      q: String(args.question ?? "").slice(0, 300),
      ntheme: Number.isInteger(args.numero_theme) ? args.numero_theme : null,
      limite: 5,
    });
    if (error) return { erreur: error.message };
    if (!data?.length) return { info: "Aucune section de cours ne correspond a cette recherche." };
    return data.map((c: { numero: number; titre: string; section: string; contenu: string }) => ({
      theme: `Theme ${String(c.numero).padStart(2, "0")} : ${c.titre}`,
      section: c.section,
      extrait: String(c.contenu).slice(0, 1500),
    }));
  }
  if (nom === "consulter_article_legifrance") {
    try {
      const article = await consulterArticle(String(args.numero ?? ""), String(args.code ?? "route"));
      if ("texte" in article) article.texte = String(article.texte).slice(0, 4000);
      return article;
    } catch (e) {
      return { erreur: "API Legifrance indisponible pour le moment : " + (e?.message ?? e) };
    }
  }
  return { erreur: "Outil inconnu : " + nom };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponseJson({ error: "POST attendu" }, 405);

  const sr = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await sr.auth.getUser(jwt);
  const user = userData?.user;
  if (!user) return reponseJson({ error: "Non authentifie" }, 401);

  let corps: { messages?: unknown; page?: unknown };
  try { corps = await req.json(); } catch { return reponseJson({ error: "JSON invalide" }, 400); }
  const messages = Array.isArray(corps.messages) ? corps.messages.slice(-8) : [];
  const page = String(corps.page ?? "").slice(0, 40) || "inconnue";
  if (!messages.length) return reponseJson({ error: "messages vide" }, 400);
  for (const m of messages) {
    if (!m || !["user", "assistant"].includes(m.role)
      || typeof m.content !== "string" || !m.content.trim() || m.content.length > 4000) {
      return reponseJson({ error: "message invalide" }, 400);
    }
  }

  const { data: reglage } = await sr.from("settings").select("value")
    .eq("key", "chatbot_quota_jour").maybeSingle();
  const quota = parseInt(reglage?.value ?? "30", 10) || 30;
  const { data: autorise, error: errQuota } = await sr.rpc("chatbot_consommer",
    { uid: user.id, limite: quota });
  if (errQuota) return reponseJson({ error: "quota indisponible" }, 500);
  if (!autorise) {
    return reponseJson({
      error: "quota",
      message: `Tu as atteint ton quota du jour (${quota} messages). L'assistant revient demain !`,
    }, 429);
  }

  const fournisseurs = fournisseursDisponibles((k: string) => Deno.env.get(k));
  if (!fournisseurs.length) return reponseJson({ error: "Aucune cle LLM configuree" }, 500);

  const systeme = { role: "system", content: construirePromptSysteme({ aide: AIDE_APP, page }) };
  const encodeur = new TextEncoder();

  const flux = new ReadableStream({
    async start(ctrl) {
      const envoyer = (obj: unknown) =>
        ctrl.enqueue(encodeur.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const conversation: unknown[] = [systeme, ...messages];
        for (let tour = 0; tour < 4; tour++) {
          const res = await appelLLM({
            fournisseurs,
            corps: {
              messages: conversation,
              tools: OUTILS,
              tool_choice: "auto",
              temperature: 0.3,
              max_tokens: 1024,
            },
            surTexte: (t: string) => envoyer({ type: "delta", texte: t }),
          });
          const appels = (res.toolCalls ?? []).filter((tc: { function?: { name?: string } }) => tc?.function?.name);
          if (!appels.length) { envoyer({ type: "fin" }); ctrl.close(); return; }
          conversation.push({
            role: "assistant",
            content: res.contenu || "",
            tool_calls: appels.map((tc, i: number) => ({
              id: tc.id || `outil_${tour}_${i}`,
              type: "function",
              function: { name: tc.function.name, arguments: tc.function.arguments || "{}" },
            })),
          });
          for (const [i, tc] of appels.entries()) {
            envoyer({ type: "outil", nom: tc.function.name });
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* args vides */ }
            const resultat = await executerOutil(tc.function.name, args, sr);
            conversation.push({
              role: "tool",
              tool_call_id: tc.id || `outil_${tour}_${i}`,
              name: tc.function.name,
              content: JSON.stringify(resultat),
            });
          }
        }
        envoyer({ type: "erreur", message: "Cette question demande trop d'etapes, essaie de la reformuler plus simplement." });
        ctrl.close();
      } catch (e) {
        console.error("chatbot:", e);
        envoyer({ type: "erreur", message: "Le service de reponse est indisponible, reessaie dans un instant." });
        ctrl.close();
      }
    },
  });

  return new Response(flux, {
    headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
