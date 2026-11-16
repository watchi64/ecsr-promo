// Edge Function contact-envois : envoie les e-mails de l'espace contact (Resend) et sert les liens de ces e-mails.
// POST JSON, une opération par appel :
//   { op: "traiter" }        compte connecté : la file (_contact_srv_prendre), puis pour chaque envoi : adresse fictive -> ignoré ;
//                            sinon jetons hachés en base, e-mail, Resend, résultat. Rend { traites, envoyes, echecs, ignores, limites }.
//   { op: "lien", jeton }    sans compte (clé publique) : ce que montre le lien (_contact_srv_lien), tel quel ; n'écrit rien.
//   { op: "agir", jeton }    sans compte (clé publique) : le geste du lien (_contact_srv_agir), tel quel ; puis les envois qu'il a
//                            fait naître sont traités.
//   { op: "etat" }           fondateur hors aperçu (est_fondateur, jugé par la base avec le jeton et les en-têtes de l'appelant) :
//                            { cle_presente, expediteur, app_url } ; jamais la valeur de la clé.
// Déploiement SANS vérification JWT à la passerelle (supabase functions deploy contact-envois --no-verify-jwt, ou verify_jwt: false) :
// la page des liens (demande.html) appelle avec la clé publique sb_publishable_, qui n'est pas un JWT, et la passerelle la refuserait.
// Chaque opération juge donc elle-même son appelant : lien et agir par le jeton haché (la base le juge), traiter par auth.getUser
// (401 sans jeton de session valide), etat par auth.getUser puis est_fondateur avec le jeton et les en-têtes de l'appelant (403).
// Secrets et variables : RESEND_API_KEY (secret) ; CONTACT_APP_URL et CONTACT_EXPEDITEUR (facultatives).
// Toute la logique testable vit dans courriels.mjs et jetons.mjs (tests node sans réseau) ; ce fichier lit les variables, ouvre les
// clients Supabase et branche fetch. Un jeton nu ne quitte jamais cette fonction vers la base : seul son haché sha256 y va.
import { createClient } from "npm:@supabase/supabase-js@2";
import { envoyerParResend, traiterEnvois } from "./courriels.mjs";
import { hacherJeton } from "./jetons.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-promo-id, x-apercu-role",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const APP_URL_DEFAUT = "https://watchi64.github.io/ecsr-promo/";
const EXPEDITEUR_DEFAUT = "Promo ECSR <no-reply@timy-studio.fr>";
const FORME_JETON = /^[A-Za-z0-9_-]{43}$/;

function reponseJson(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function erreur(message: string, statut: number): Response {
  return reponseJson({ error: message }, statut);
}

function appUrl(): string {
  const u = (Deno.env.get("CONTACT_APP_URL") || "").trim() || APP_URL_DEFAUT;
  return u.endsWith("/") ? u : u + "/";
}

function expediteur(): string {
  return (Deno.env.get("CONTACT_EXPEDITEUR") || "").trim() || EXPEDITEUR_DEFAUT;
}

// Un appel de fonction de la base en service_role (client Supabase non typé : les arguments passent tels quels).
type Rpc = (nom: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

// La file, traitée avec la clé Resend (jamais appelée sans clé : la file resterait intacte).
function traiter(rpc: Rpc, cle: string) {
  const exp = expediteur();
  return traiterEnvois({
    rpc,
    envoyer: (courriel: { to: string; subject: string; html: string; text: string }) => envoyerParResend(fetch, cle, exp, courriel),
    appUrl: appUrl(),
    aleatoire: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
    subtle: crypto.subtle,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erreur("POST attendu", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const sr = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc: Rpc = (nom, args) => sr.rpc(nom, args as never);
  const cle = Deno.env.get("RESEND_API_KEY") || "";

  let corps: { op?: unknown; jeton?: unknown };
  try { corps = await req.json(); } catch { return erreur("JSON invalide", 400); }
  const op = typeof corps?.op === "string" ? corps.op : "";

  // Les liens d'e-mail : sans compte. Un jeton mal formé ne va pas jusqu'à la base.
  if (op === "lien" || op === "agir") {
    const jeton = typeof corps.jeton === "string" ? corps.jeton : "";
    if (!FORME_JETON.test(jeton)) return reponseJson({ invalide: true });
    const hash = await hacherJeton(crypto.subtle, jeton);
    const { data, error } = await rpc(op === "lien" ? "_contact_srv_lien" : "_contact_srv_agir", { p_hash: hash });
    if (error) {
      console.error("contact-envois", op, ":", error.message);
      return erreur("Lien illisible", 500);
    }
    if (op === "agir" && (data as { fait?: boolean } | null)?.fait === true && cle) {
      try { await traiter(rpc, cle); } catch (e) { console.error("contact-envois traiter après agir :", (e as Error)?.message ?? e); }
    }
    return reponseJson(data);
  }

  // Les autres opérations : un compte connecté, jugé ici (la passerelle ne vérifie aucun JWT, voir l'en-tête). Sans jeton, ou avec la
  // clé publique, getUser ne rend aucun utilisateur : 401 avant toute lecture de la file.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return erreur("Non authentifié", 401);
  const { data: userData } = await sr.auth.getUser(jwt);
  if (!userData?.user) return erreur("Non authentifié", 401);

  if (op === "traiter") {
    if (!cle) return erreur("Envoi des e-mails non configuré", 503);
    try {
      return reponseJson(await traiter(rpc, cle));
    } catch (e) {
      console.error("contact-envois traiter :", (e as Error)?.message ?? e);
      return erreur("File des envois indisponible", 500);
    }
  }

  if (op === "etat") {
    // Le droit est celui de la base, lu avec le jeton et les en-têtes de l'appelant : en aperçu, est_fondateur est faux.
    const entetes: Record<string, string> = { Authorization: `Bearer ${jwt}` };
    const promo = (req.headers.get("x-promo-id") ?? "").trim();
    if (/^[0-9]{1,9}$/.test(promo)) entetes["x-promo-id"] = promo;
    const apercu = (req.headers.get("x-apercu-role") ?? "").trim();
    if (apercu) entetes["x-apercu-role"] = apercu.slice(0, 40);
    const commeAppelant = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: entetes },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: fondateur, error } = await commeAppelant.rpc("est_fondateur");
    if (error) return erreur("Droits illisibles", 500);
    if (fondateur !== true) return erreur("Réservé au fondateur", 403);
    return reponseJson({ cle_presente: cle.length > 0, expediteur: expediteur(), app_url: appUrl() });
  }

  return erreur("Opération inconnue", 400);
});
