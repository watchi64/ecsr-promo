// Edge Function qcm-ia : propose des brouillons de questions QCM a partir du cours verifie
// d'un theme. Reservee aux formateurs. Rien n'entre dans qcm_questions ici : les brouillons
// vont dans qcm_ia_brouillons (lisible des seuls formateurs), et seule l'acceptation par un
// formateur (rpc accepter_brouillon_ia) cree la question.
// Secrets : SCW_SECRET_KEY (Scaleway, celle de l'assistant) ou MISTRAL_API_KEY ; facultatifs :
// QCM_IA_MODEL, SCALEWAY_MODEL, MISTRAL_MODEL.
// Fournisseurs europeens uniquement, dans l'ordre : Scaleway (modeles Mistral heberges a
// Paris, sans conservation), puis Mistral (API coupee sur le plan gratuit depuis la
// mi-octobre 2026). Aucun secours hors Europe.
// Seuls partent chez le fournisseur le texte du cours et les enonces deja presents dans le QCM.
import { createClient } from "npm:@supabase/supabase-js@2";
import { analyserReponse, articlesCites, construireMessages, titresDuCours } from "./brouillons.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-promo-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const QUOTA_DEFAUT = 10;
// Une tentative au plus 65 s, l'ensemble au plus 135 s : sous la limite de 150 s d'une
// Edge Function, avec de quoi enregistrer les brouillons.
const DELAI_MS = 65_000;
const BUDGET_MS = 135_000;

function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function erreur(message: string, statut: number): Response {
  return reponseJson({ error: message }, statut);
}

type Fournisseur = { nom: string; url: string; cle: string; modele: string };

// Meme ordre que l'assistant (chatbot/providers.mjs) : Scaleway, puis Mistral.
function fournisseurs(): Fournisseur[] {
  const env = (k: string) => Deno.env.get(k) || "";
  const liste: Fournisseur[] = [];
  if (env("SCW_SECRET_KEY")) {
    liste.push({ nom: "scaleway", url: "https://api.scaleway.ai/v1/chat/completions", cle: env("SCW_SECRET_KEY"),
      modele: env("QCM_IA_MODEL") || env("SCALEWAY_MODEL") || "mistral-small-3.2-24b-instruct-2506" });
  }
  if (env("MISTRAL_API_KEY")) {
    liste.push({ nom: "mistral", url: "https://api.mistral.ai/v1/chat/completions", cle: env("MISTRAL_API_KEY"),
      modele: env("MISTRAL_MODEL") || "mistral-medium-latest" });
  }
  return liste;
}

// Un appel, une relance par fournisseur : la meme regle que l'assistant (planTentatives).
// Le tout tient dans BUDGET_MS, sous la limite de 150 s d'une Edge Function.
async function appelLLM(liste: Fournisseur[], messages: unknown[]): Promise<{ contenu: string; modele: string }> {
  let derniere: unknown = null;
  const debut = Date.now();
  for (const f of liste.flatMap((x) => [x, x])) {
    const reste = BUDGET_MS - (Date.now() - debut);
    if (reste < 15_000) break;
    try {
      const resp = await fetch(f.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${f.cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: f.modele,
          messages,
          temperature: 0.4,
          max_tokens: 4000,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(Math.min(DELAI_MS, reste)),
      });
      if (!resp.ok) throw new Error(`${f.nom} ${resp.status} : ${(await resp.text()).slice(0, 300)}`);
      const data = await resp.json();
      const contenu = data?.choices?.[0]?.message?.content;
      if (typeof contenu !== "string" || !contenu.trim()) throw new Error(`${f.nom} : reponse vide`);
      return { contenu, modele: `${f.nom}:${f.modele}` };
    } catch (e) {
      console.error("qcm-ia fournisseur", f.nom, ":", (e as Error)?.message ?? e);
      derniere = e;
    }
  }
  throw derniere ?? new Error("aucun fournisseur disponible");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erreur("POST attendu", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const sr = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await sr.auth.getUser(jwt);
  const user = userData?.user;
  if (!user) return erreur("Non authentifie", 401);

  // Le droit formateur est celui de la base (is_admin), lu avec le jeton de l'appelant.
  const commeAppelant = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: formateur, error: errDroit } = await commeAppelant.rpc("is_admin");
  if (errDroit) return erreur("Droits illisibles", 500);
  if (formateur !== true) return erreur("Réservé aux formateurs", 403);

  let corps: { qcm_id?: unknown; nombre?: unknown; partie?: unknown };
  try { corps = await req.json(); } catch { return erreur("JSON invalide", 400); }
  const qcmId = Number(corps.qcm_id);
  const nombre = Number(corps.nombre);
  const partie = typeof corps.partie === "string" ? corps.partie.trim().slice(0, 200) : "";
  if (!Number.isInteger(qcmId) || qcmId <= 0) return erreur("qcm_id invalide", 400);
  if (!Number.isInteger(nombre) || nombre < 1 || nombre > 5) return erreur("nombre entre 1 et 5", 400);

  const liste = fournisseurs();
  if (!liste.length) return erreur("Aucune clé d'IA configurée", 500);

  // QCM -> theme -> cours verifie du theme (les cours de competences ont un code).
  const { data: qcm } = await sr.from("qcm").select("id, theme_id").eq("id", qcmId).maybeSingle();
  if (!qcm) return erreur("QCM introuvable", 404);
  const { data: theme } = await sr.from("themes").select("numero, titre").eq("id", qcm.theme_id).maybeSingle();
  if (!theme?.numero) return erreur("Ce thème n'a pas de cours vérifié.", 404);
  const { data: cours, error: errCours } = await sr.from("cours")
    .select("id, numero, titre, corps_md").eq("numero", theme.numero).is("code", null).maybeSingle();
  if (errCours) return erreur("Cours illisible", 500);
  if (!cours?.corps_md) return erreur("Ce thème n'a pas de cours vérifié.", 404);

  const titres = titresDuCours(cours.corps_md).map((t: { titre: string }) => t.titre);
  if (partie && !titres.includes(partie)) return erreur("Partie du cours inconnue", 400);

  // Enonces deja presents (questions et brouillons en attente) : pour eviter les doublons.
  const [{ data: questions }, { data: enAttente }] = await Promise.all([
    sr.from("qcm_questions").select("enonce, section").eq("qcm_id", qcmId),
    sr.from("qcm_ia_brouillons").select("enonce").eq("qcm_id", qcmId).eq("statut", "a_relire"),
  ]);
  const existants = [...(questions ?? []), ...(enAttente ?? [])].map((q: { enonce: string }) => q.enonce);
  const sections = [...new Set((questions ?? []).map((q: { section: string | null }) => q.section).filter(Boolean))] as string[];

  // Quota consomme une fois la demande validee, avant l'appel couteux.
  const { data: reglage } = await sr.from("settings").select("value").eq("key", "qcm_ia_quota_jour").limit(1);
  const quota = parseInt(reglage?.[0]?.value ?? String(QUOTA_DEFAUT), 10) || QUOTA_DEFAUT;
  const { data: autorise, error: errQuota } = await sr.rpc("qcm_ia_consommer", { uid: user.id, limite: quota });
  if (errQuota) return erreur("Quota indisponible", 500);
  if (!autorise) {
    return reponseJson({ error: "quota", message: `Quota du jour atteint (${quota} demandes). Il revient demain.` }, 429);
  }

  const messages = construireMessages({
    titreTheme: `${String(theme.numero).padStart(2, "0")} · ${theme.titre}`,
    coursMd: cours.corps_md, partie, nombre, existants, sections,
  });

  let resultat;
  let modele = "";
  try {
    const reponse = await appelLLM(liste, messages);
    modele = reponse.modele;
    resultat = analyserReponse(reponse.contenu, {
      articlesCours: articlesCites(cours.corps_md), titres, existants, nombre,
    });
  } catch (e) {
    console.error("qcm-ia:", (e as Error)?.message ?? e);
    return erreur("L'IA n'a pas pu proposer de questions, réessaie dans un instant.", 502);
  }

  const commun = { qcm_id: qcmId, cours_id: cours.id, demande_par_email: user.email, partie_visee: partie || null, modele };
  const lignes = [
    ...resultat.brouillons.map((b) => ({ ...commun, ...b, statut: "a_relire" })),
    ...resultat.ecartes.map((b) => ({ ...commun, ...b, statut: "ecartee" })),
  ];
  let enregistres: Record<string, unknown>[] = [];
  if (lignes.length) {
    const { data, error } = await sr.from("qcm_ia_brouillons").insert(lignes).select("*");
    if (error) { console.error("qcm-ia insert:", error.message); return erreur("Brouillons non enregistrés", 500); }
    enregistres = data ?? [];
  }
  console.log("qcm-ia:", JSON.stringify({ qcm: qcmId, nombre, partie: partie || null, modele,
    gardes: resultat.brouillons.length, ecartes: resultat.ecartes.length }));

  return reponseJson({
    brouillons: enregistres.filter((b) => b.statut === "a_relire"),
    ecartes: enregistres.filter((b) => b.statut === "ecartee"),
    articles_cours: articlesCites(cours.corps_md),
  });
});
