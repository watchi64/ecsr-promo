// Edge Function chatbot : orchestre le LLM et ses outils, streame la reponse en SSE.
// Secrets requis : MISTRAL_API_KEY (et/ou GEMINI_API_KEY), PISTE_CLIENT_ID, PISTE_CLIENT_SECRET.
// Durcissements issus de la revue du 2026-08-15 : verrou transport de la regle d'or
// (aucun motif d'article dans les deltas avant une verification PISTE reussie) et
// resilience a la deconnexion du client en pleine generation.
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

// Motif de numero d'article (R416-15, L234-1, R413-14-1...) pour le verrou.
const MOTIF_ARTICLE = /\b[RLD]\.?\s?\d{2,4}(?:-\d{1,3})+/gi;

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
    if (error) {
      console.error("chercher_cours:", error.message);
      return { erreur: "Recherche dans les cours indisponible pour le moment." };
    }
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
      console.error("PISTE:", e);
      return { erreur: "API Legifrance indisponible pour le moment." };
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
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await sr.auth.getUser(jwt);
  const user = userData?.user;
  if (!user) return reponseJson({ error: "Non authentifie" }, 401);

  let corps: { messages?: unknown; page?: unknown };
  try { corps = await req.json(); } catch { return reponseJson({ error: "JSON invalide" }, 400); }
  const messagesBruts = Array.isArray(corps.messages) ? corps.messages.slice(-8) : [];
  const pageBrute = String(corps.page ?? "");
  const page = /^[a-z0-9-]{1,40}$/.test(pageBrute) ? pageBrute : "inconnue";
  if (!messagesBruts.length) return reponseJson({ error: "messages vide" }, 400);
  for (const m of messagesBruts) {
    if (!m || !["user", "assistant"].includes(m.role)
      || typeof m.content !== "string" || !m.content.trim() || m.content.length > 4000) {
      return reponseJson({ error: "message invalide" }, 400);
    }
  }
  // Seuls role et content partent chez le fournisseur : pas de champ inattendu.
  const messages = messagesBruts.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

  // Aucune cle LLM : erreur de config, a signaler AVANT de consommer le quota.
  const fournisseurs = fournisseursDisponibles((k: string) => Deno.env.get(k));
  if (!fournisseurs.length) return reponseJson({ error: "Aucune cle LLM configuree" }, 500);

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

  const systeme = { role: "system", content: construirePromptSysteme({ aide: AIDE_APP, page }) };
  const encodeur = new TextEncoder();
  // Le client peut fermer le panneau en pleine generation : plus aucune ecriture
  // ensuite, et la boucle s'arrete au prochain point de controle.
  let clientParti = false;

  const flux = new ReadableStream({
    async start(ctrl) {
      const envoyer = (obj: unknown) => {
        if (clientParti) return;
        try { ctrl.enqueue(encodeur.encode(`data: ${JSON.stringify(obj)}\n\n`)); }
        catch { clientParti = true; }
      };
      const fermer = () => { try { ctrl.close(); } catch { /* deja ferme ou annule */ } };

      // Verrou transport de la regle d'or : tant qu'aucun article n'a ete verifie
      // via PISTE dans CETTE requete, tout motif d'article sortant est masque.
      // Le carry de 12 caracteres couvre un motif coupe entre deux deltas.
      let verrouArticles = true;
      let carry = "";
      const filtrer = (t: string) => {
        if (!verrouArticles) return t;
        const s = carry + t;
        carry = s.slice(-12);
        return s.slice(0, -12).replace(MOTIF_ARTICLE, "[verification en cours]");
      };
      const viderCarry = () => {
        const reste = verrouArticles ? carry.replace(MOTIF_ARTICLE, "[verification en cours]") : carry;
        carry = "";
        return reste;
      };

      try {
        const conversation: unknown[] = [systeme, ...messages];
        for (let tour = 0; tour < 4; tour++) {
          if (clientParti) { fermer(); return; }
          const res = await appelLLM({
            fournisseurs,
            corps: {
              messages: conversation,
              tools: OUTILS,
              tool_choice: "auto",
              temperature: 0.3,
              max_tokens: 1024,
            },
            surTexte: (t: string) => {
              const filtre = filtrer(t);
              if (filtre) envoyer({ type: "delta", texte: filtre });
            },
          });
          const reste = viderCarry();
          if (reste) envoyer({ type: "delta", texte: reste });
          const appels = (res.toolCalls ?? []).filter((tc: { function?: { name?: string } }) => tc?.function?.name);
          if (!appels.length) { envoyer({ type: "fin" }); fermer(); return; }
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
            if (clientParti) { fermer(); return; }
            envoyer({ type: "outil", nom: tc.function.name });
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* args vides */ }
            const resultat = await executerOutil(tc.function.name, args, sr);
            if (tc.function.name === "consulter_article_legifrance"
              && resultat && typeof resultat === "object" && !("erreur" in resultat)) {
              verrouArticles = false;
            }
            conversation.push({
              role: "tool",
              tool_call_id: tc.id || `outil_${tour}_${i}`,
              name: tc.function.name,
              content: JSON.stringify(resultat),
            });
          }
        }
        envoyer({ type: "erreur", message: "Cette question demande trop d'etapes, essaie de la reformuler plus simplement." });
        fermer();
      } catch (e) {
        console.error("chatbot:", e);
        envoyer({ type: "erreur", message: "Le service de reponse est indisponible, reessaie dans un instant." });
        fermer();
      }
    },
    cancel() { clientParti = true; },
  });

  return new Response(flux, {
    headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
