// Smoke test de l'Edge Function chatbot deployee.
// Usage : ECSR_TEST_EMAIL=... ECSR_TEST_PASSWORD=... node scripts/chatbot-smoke.mjs "ta question"
const URL_BASE = "https://crpduennbqaemhfaywrz.supabase.co";
const CLE_ANON = "sb_publishable_Zcs0L_GW3PR7aOciVZa1PA_RABMaQ0W";

const email = process.env.ECSR_TEST_EMAIL;
const mdp = process.env.ECSR_TEST_PASSWORD;
if (!email || !mdp) {
  console.error("Definir ECSR_TEST_EMAIL et ECSR_TEST_PASSWORD (compte de l'app).");
  process.exit(1);
}
const question = process.argv[2] ?? "Quels sont les feux obligatoires la nuit hors agglomeration ?";

const conn = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: CLE_ANON },
  body: JSON.stringify({ email, password: mdp }),
});
if (!conn.ok) { console.error("Connexion refusee :", await conn.text()); process.exit(1); }
const { access_token } = await conn.json();

const debut = Date.now();
const resp = await fetch(`${URL_BASE}/functions/v1/chatbot`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: CLE_ANON,
    Authorization: `Bearer ${access_token}`,
  },
  body: JSON.stringify({ messages: [{ role: "user", content: question }], page: "themes" }),
});
console.log("HTTP", resp.status);
if (!resp.ok) { console.error(await resp.text()); process.exit(1); }

const lecteur = resp.body.getReader();
const dec = new TextDecoder();
let brut = "";
for (;;) {
  const { done, value } = await lecteur.read();
  if (done) break;
  brut += dec.decode(value, { stream: true });
}
console.log(brut);
console.log(`\n(${Date.now() - debut} ms)`);
