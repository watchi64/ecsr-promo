// Essai réel de la génération de questions, SANS rien écrire en base.
// Lit (GET seulement) le cours d'un thème et les énoncés de son QCM, appelle Mistral avec
// exactement les messages de l'Edge Function qcm-ia, passe la réponse dans le même contrôle
// (analyserReponse), puis écrit le résultat dans un fichier JSON local.
//
// Usage : node scripts/qcm-ia-essai.mjs <numero_theme> <nombre> <sortie.json> [partie]
// Variables lues dans le .env indiqué par ECSR_ENV (défaut ../ECSR/.env) ou dans l'environnement :
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (lecture), MISTRAL_API_KEY, MISTRAL_MODEL (facultatif).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { analyserReponse, articlesCites, construireMessages, titresDuCours } from "../supabase/functions/qcm-ia/brouillons.mjs";

const [numeroBrut, nombreBrut, sortie, partie = ""] = process.argv.slice(2);
if (!numeroBrut || !nombreBrut || !sortie) {
  console.error("Usage : node scripts/qcm-ia-essai.mjs <numero_theme> <nombre> <sortie.json> [partie]");
  process.exit(2);
}

const fichierEnv = process.env.ECSR_ENV || "../ECSR/.env";
const env = { ...process.env };
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(ligne.trim());
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
for (const cle of ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "MISTRAL_API_KEY"]) {
  if (!env[cle]) { console.error(`Variable manquante : ${cle}`); process.exit(2); }
}

async function lire(chemin) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!resp.ok) throw new Error(`lecture ${chemin} : ${resp.status} ${await resp.text()}`);
  return resp.json();
}

const numero = Number(numeroBrut);
const [cours] = await lire(`cours?select=id,numero,titre,corps_md&numero=eq.${numero}&code=is.null`);
if (!cours) throw new Error(`Aucun cours pour le thème ${numero}`);
const themes = await lire(`themes?select=id,numero,titre&numero=eq.${numero}`);
const qcms = themes.length ? await lire(`qcm?select=id,theme_id&theme_id=in.(${themes.map((t) => t.id).join(",")})`) : [];
const questions = qcms.length ? await lire(`qcm_questions?select=enonce,section&qcm_id=in.(${qcms.map((q) => q.id).join(",")})`) : [];
const existants = questions.map((q) => q.enonce);
const sections = [...new Set(questions.map((q) => q.section).filter(Boolean))];

const titres = titresDuCours(cours.corps_md).map((t) => t.titre);
if (partie && !titres.includes(partie)) throw new Error(`Partie inconnue : ${partie}`);
const nombre = Number(nombreBrut);
const messages = construireMessages({
  titreTheme: `${String(numero).padStart(2, "0")} · ${themes[0]?.titre ?? cours.titre}`,
  coursMd: cours.corps_md, partie, nombre, existants, sections,
});
const modele = env.QCM_IA_MODEL || env.MISTRAL_MODEL || "mistral-medium-latest";

const debut = Date.now();
const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.MISTRAL_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: modele, messages, temperature: 0.4, max_tokens: 4000, response_format: { type: "json_object" } }),
});
if (!resp.ok) throw new Error(`mistral ${resp.status} : ${await resp.text()}`);
const data = await resp.json();
const contenu = data.choices[0].message.content;
const resultat = analyserReponse(contenu, { articlesCours: articlesCites(cours.corps_md), titres, existants, nombre });

writeFileSync(sortie, JSON.stringify({
  theme: numero, partie: partie || null, modele, duree_s: Math.round((Date.now() - debut) / 1000),
  usage: data.usage, existants: existants.length, articles_cours: articlesCites(cours.corps_md),
  reponse_brute: contenu, ...resultat,
}, null, 2));
console.log(`${resultat.brouillons.length} brouillon(s) gardé(s), ${resultat.ecartes.length} écarté(s), `
  + `${Math.round((Date.now() - debut) / 1000)} s, modèle ${modele} -> ${sortie}`);
