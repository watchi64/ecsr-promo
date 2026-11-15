import test from "node:test";
import assert from "node:assert/strict";
import {
  adresseFictive, construireCourriel, formaterJours, envoyerParResend, traiterEnvois,
} from "../supabase/functions/contact-envois/courriels.mjs";

test("aucune adresse fictive n'est tentée", () => {
  for (const a of ["a@demo.test", "b@exemple.invalid", "c@x.example", "d@example.com", "e@example.org", "f@example.net", "g@localhost"])
    assert.equal(adresseFictive(a), true, a);
  assert.equal(adresseFictive("secretariat@ecf-centre.fr"), false);
});

test("une adresse illisible compte comme fictive (jamais tentée)", () => {
  for (const a of ["", null, undefined, "sans-arobase", "x@", "A@SOUS.EXAMPLE.COM", "z@ecole.TEST"]) assert.equal(adresseFictive(a), true, String(a));
});

const demande = { id: 7, type: "absence", auteur_nom: "Lina B.", jours: [{ jour: "2026-11-19", demi: "matin" }], motif: "sante", texte: "rdv" };

test("ni motif ni texte libre dans l'e-mail ; les URL sont bâties ici", () => {
  const c = construireCourriel({ evenement: "nouvelle", appUrl: "https://app.test/", demande,
    destinataire: { email: "x@ecf.fr", nom: "Sophie", avec_compte: false },
    jetons: { voir: "J1", prise: "J2", reponses: [{ libelle: "Absence enregistrée", jeton: "J3" }] } });
  assert.match(c.subject, /Absence/); assert.match(c.text, /Lina B\./); assert.match(c.text, /jeudi 19 novembre, matin/);
  assert.doesNotMatch(c.html + c.text, /sante|Santé|rdv/);
  assert.match(c.html, /https:\/\/app\.test\/demande\.html#j=J2/);
  assert.match(c.html, /Absence enregistrée/); assert.match(c.html, /demande\.html#j=J3/);
});

test("un stagiaire n'a que « Ouvrir dans l'app »", () => {
  const c = construireCourriel({ evenement: "prise", appUrl: "https://app.test/", demande,
    destinataire: { email: "s@ecf.fr", nom: "Lina", stagiaire: true }, jetons: {} });
  assert.doesNotMatch(c.html + c.text, /demande\.html#j=/);
  assert.match(c.html, /https:\/\/app\.test\/#\/contacts\/7/);
});

test("le sujet de la demande ne part jamais, même s'il est donné", () => {
  const c = construireCourriel({ evenement: "reponse", appUrl: "https://app.test/",
    demande: { id: 9, type: "autre", auteur_nom: "Noé K.", sujet: "Sujet confidentiel", texte: "Texte confidentiel" },
    destinataire: { email: "sophie@exemple.invalid", nom: "Sophie" }, jetons: { voir: "V" } });
  assert.doesNotMatch(c.subject + c.html + c.text, /confidentiel/);
  assert.equal(c.to, "sophie@exemple.invalid");
});

test("l'équipe est vouvoyée et ouvre la demande dans Messages ; le stagiaire est tutoyé", () => {
  const equipe = construireCourriel({ evenement: "nouvelle", appUrl: "https://app.test/", demande,
    destinataire: { email: "sophie@exemple.invalid", nom: "Sophie" }, jetons: { voir: "V" } });
  assert.match(equipe.html, /https:\/\/app\.test\/#\/messages\/7/);
  assert.match(equipe.text, /vous/i);
  assert.match(equipe.text, /Les réponses passent par ces boutons ou par l'app, pour garder la trace\./);
  const stagiaire = construireCourriel({ evenement: "reponse", appUrl: "https://app.test/", demande,
    destinataire: { email: "lina@exemple.invalid", nom: "Lina", stagiaire: true }, jetons: {} });
  assert.match(stagiaire.text, /\bta demande\b/i);
  assert.doesNotMatch(stagiaire.text, /\bvous\b|\bvotre\b/i);
});

test("les noms et libellés sont échappés dans le HTML", () => {
  const c = construireCourriel({ evenement: "nouvelle", appUrl: "https://app.test/",
    demande: { id: 3, type: "retard", auteur_nom: "<b>Max</b>" },
    destinataire: { email: "sophie@exemple.invalid", nom: "A & B" }, jetons: { voir: "V", reponses: [{ libelle: "\"Vu\" <ok>", jeton: "R" }] } });
  assert.doesNotMatch(c.html, /<b>Max<\/b>|"Vu" <ok>/);
  assert.match(c.html, /&lt;b&gt;Max&lt;\/b&gt;/); assert.match(c.html, /A &amp; B/);
});

test("formaterJours : jour de la semaine, date, demi-journée", () => {
  assert.equal(formaterJours([{ jour: "2026-11-19", demi: "matin" }, { jour: "2026-11-20", demi: "aprem" }]),
    "jeudi 19 novembre, matin ; vendredi 20 novembre, après-midi");
  assert.equal(formaterJours(null), "");
  assert.equal(formaterJours([{ jour: "n'importe quoi", demi: "matin" }]), "");
});

test("envoyerParResend : un POST JSON à Resend, la clé dans l'en-tête seulement ; une erreur ne rend jamais la clé", async () => {
  const appels = [];
  const fetchFaux = async (url, init) => { appels.push({ url, init }); return new Response(JSON.stringify({ id: "x" }), { status: 200 }); };
  const ok = await envoyerParResend(fetchFaux, "re_cle_secrete", "Promo ECSR <no-reply@timy-studio.fr>",
    { to: "sophie@exemple.invalid", subject: "S", html: "<p>H</p>", text: "T" });
  assert.deepEqual(ok, { ok: true });
  assert.equal(appels[0].url, "https://api.resend.com/emails");
  assert.equal(appels[0].init.method, "POST");
  assert.equal(appels[0].init.headers.Authorization, "Bearer re_cle_secrete");
  const corps = JSON.parse(appels[0].init.body);
  assert.deepEqual(corps, { from: "Promo ECSR <no-reply@timy-studio.fr>", to: ["sophie@exemple.invalid"], subject: "S", html: "<p>H</p>", text: "T" });
  assert.doesNotMatch(appels[0].init.body, /re_cle_secrete/);
  const ko = await envoyerParResend(async () => new Response("clé re_cle_secrete refusée", { status: 401 }), "re_cle_secrete", "E", { to: "sophie@exemple.invalid" });
  assert.equal(ko.ok, false);
  assert.match(ko.raison, /^Resend 401/);
  assert.doesNotMatch(ko.raison, /re_cle_secrete/);
  const panne = await envoyerParResend(async () => { throw new Error("réseau coupé re_cle_secrete"); }, "re_cle_secrete", "E", { to: "sophie@exemple.invalid" });
  assert.equal(panne.ok, false);
  assert.doesNotMatch(panne.raison, /re_cle_secrete/);
  assert.ok(ko.raison.length <= 200 && panne.raison.length <= 200);
});

function fausseBase(items) {
  const appels = [];
  return {
    appels,
    async rpc(nom, args) {
      appels.push([nom, args]);
      if (nom === "_contact_srv_prendre") return { data: items, error: null };
      return { data: null, error: null };
    },
  };
}

test("traiterEnvois : adresse fictive ignorée sans jeton ni envoi ; jetons hachés puis e-mail ; échec rapporté", async () => {
  const items = [
    { envoi_id: 1, evenement: "nouvelle", demande: { id: 7, type: "retard", auteur_nom: "Lina B.", jours: null },
      destinataire: { email: "a@demo.test", nom: "Démo", stagiaire: false }, reponses: [] },
    { envoi_id: 2, evenement: "nouvelle", demande: { id: 7, type: "retard", auteur_nom: "Lina B.", jours: null },
      destinataire: { email: "sophie@ecf-centre.fr", nom: "Sophie", stagiaire: false, peut_prendre: true },
      reponses: [{ id: 11, libelle: "Bien reçu" }] },
    { envoi_id: 3, evenement: "prise", demande: { id: 7, type: "retard", auteur_nom: "Lina B.", jours: null },
      destinataire: { email: "lina@ecf-centre.fr", nom: "Lina", stagiaire: true }, reponses: [] },
  ];
  const base = fausseBase(items);
  const envoyes = [];
  let n = 0;
  const bilan = await traiterEnvois({
    rpc: base.rpc, appUrl: "https://app.test/", subtle: globalThis.crypto.subtle,
    aleatoire: (k) => new Uint8Array(k).fill(++n),
    envoyer: async (c) => { envoyes.push(c); return c.to.startsWith("lina") ? { ok: false, raison: "Resend 500" } : { ok: true }; },
  });
  assert.deepEqual(bilan, { traites: 3, envoyes: 1, echecs: 1, ignores: 1 });
  assert.deepEqual(envoyes.map((c) => c.to), ["sophie@ecf-centre.fr", "lina@ecf-centre.fr"]);
  const noms = base.appels.map(([nom, a]) => `${nom}:${a.p_envoi_id ?? ""}:${a.p_issue ?? ""}`);
  assert.deepEqual(noms, [
    "_contact_srv_prendre::",
    "_contact_srv_resultat:1:ignore",
    "_contact_srv_jetons:2:",
    "_contact_srv_resultat:2:envoye",
    "_contact_srv_resultat:3:echec",
  ]);
  const jetons = base.appels.find(([nom]) => nom === "_contact_srv_jetons")[1].p_jetons;
  assert.deepEqual(jetons.map((j) => j.action), ["voir", "prise", "reponse"]);
  assert.equal(jetons[2].reponse_id, 11);
  for (const j of jetons) assert.match(j.hash, /^[0-9a-f]{64}$/);
  assert.equal(base.appels[1][1].p_raison, "adresse fictive");
  // Les jetons nus sont dans l'e-mail ; seuls leurs hachés vont en base.
  const html = envoyes[0].html;
  for (const j of jetons) assert.doesNotMatch(html, new RegExp(j.hash));
  assert.equal((html.match(/demande\.html#j=[A-Za-z0-9_-]{43}/g) || []).length >= 3, true);
});

test("traiterEnvois : une base qui refuse la file rend une erreur, sans rien envoyer", async () => {
  let envoye = false;
  await assert.rejects(traiterEnvois({
    rpc: async () => ({ data: null, error: { message: "refus" } }), appUrl: "https://app.test/", subtle: globalThis.crypto.subtle,
    aleatoire: (k) => new Uint8Array(k), envoyer: async () => { envoye = true; return { ok: true }; },
  }), /file des envois illisible/);
  assert.equal(envoye, false);
});

const unItem = (id, email) => ({ envoi_id: id, evenement: "prise", demande: { id: 7, type: "retard", auteur_nom: "Lina B.", jours: null },
  destinataire: { email, nom: "X", stagiaire: true }, reponses: [] });

test("traiterEnvois : l'attente est appelée entre deux envois (cadence), pas avant le premier", async () => {
  const base = fausseBase([unItem(1, "a@ecf-centre.fr"), unItem(2, "b@ecf-centre.fr")]);
  const journal = [];
  await traiterEnvois({
    rpc: base.rpc, appUrl: "https://app.test/", subtle: globalThis.crypto.subtle, aleatoire: (k) => new Uint8Array(k),
    attente: async (ms) => { journal.push(`attente ${ms}`); },
    envoyer: async (c) => { journal.push(`envoi ${c.to}`); return { ok: true }; },
  });
  assert.deepEqual(journal, ["envoi a@ecf-centre.fr", "attente 600", "envoi b@ecf-centre.fr"]);
});

test("traiterEnvois : un 429 est ressayé sur place et ne consomme pas la tentative (aucun résultat echec)", async () => {
  const base = fausseBase([unItem(1, "a@ecf-centre.fr")]);
  let n = 0;
  const bilan = await traiterEnvois({
    rpc: base.rpc, appUrl: "https://app.test/", subtle: globalThis.crypto.subtle, aleatoire: (k) => new Uint8Array(k),
    attente: async () => {},
    envoyer: async () => (++n < 3 ? { ok: false, limite: true, raison: "Resend 429" } : { ok: true }),
  });
  assert.equal(n, 3);
  assert.deepEqual(bilan, { traites: 1, envoyes: 1, echecs: 0, ignores: 0 });
  const issues = base.appels.filter(([nom]) => nom === "_contact_srv_resultat").map(([, a]) => a.p_issue);
  assert.deepEqual(issues, ["envoye"]);
});

test("envoyerParResend : un 429 est signalé comme limite", async () => {
  const r = await envoyerParResend(async () => ({ ok: false, status: 429, text: async () => "rate" }), "cle", "a@x.test", { to: "b@x.test", subject: "s", html: "h", text: "t" });
  assert.equal(r.ok, false); assert.equal(r.limite, true);
});
