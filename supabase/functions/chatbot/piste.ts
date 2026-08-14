// Acces reseau PISTE : OAuth2 client_credentials avec token en cache module.
import {
  CODE_NAMES, corpsRechercheArticle, extraireIdArticle, formaterArticle,
} from "./legifrance-parse.mjs";

const OAUTH_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";

let jeton: string | null = null;
let jetonExpire = 0;

async function obtenirJeton(): Promise<string> {
  if (jeton && Date.now() < jetonExpire - 30_000) return jeton;
  const resp = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: Deno.env.get("PISTE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("PISTE_CLIENT_SECRET") ?? "",
      scope: "openid",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error("PISTE OAuth " + resp.status);
  const data = await resp.json();
  jeton = data.access_token;
  jetonExpire = Date.now() + (data.expires_in ?? 3600) * 1000;
  return jeton as string;
}

export async function consulterArticle(numero: string, code = "route") {
  const meta = CODE_NAMES[code as keyof typeof CODE_NAMES] ?? CODE_NAMES.route;
  const t = await obtenirJeton();
  const headers = {
    Authorization: `Bearer ${t}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const rs = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers,
    body: JSON.stringify(corpsRechercheArticle(numero, meta.nom, Date.now())),
    signal: AbortSignal.timeout(20_000),
  });
  if (!rs.ok) throw new Error("PISTE /search " + rs.status);
  const id = extraireIdArticle(await rs.json(), numero);
  if (!id) return { erreur: `Article ${numero} introuvable dans le ${meta.nom}.` };
  const ra = await fetch(`${API_BASE}/consult/getArticle`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!ra.ok) throw new Error("PISTE getArticle " + ra.status);
  return formaterArticle(await ra.json(), numero);
}
