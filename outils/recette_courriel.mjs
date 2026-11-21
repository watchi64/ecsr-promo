// Recette de l'e-mail de l'espace contact par un vrai e-mail, sans base ni fonction déployée.
//   node outils/recette_courriel.mjs --a <adresse> [--a-blanc]
// Construit, avec construireCourriel et des jetons de banc, l'e-mail d'une demande fictive (« Lina B. », absence, jeudi 19 novembre,
// matin ; motif « personnel » et texte donnés en entrée, pour vérifier qu'ils n'en sortent pas) dont les liens pointent vers le banc
// (http://localhost:8000/_harness_demande.html#j=...). Trois liens d'action : voir, prise, une réponse toute faite.
//   --a-blanc : l'e-mail s'écrit sur la sortie, rien ne part.
//   sinon : envoi par Resend, avec la clé lue dans la variable d'environnement RESEND_API_KEY (posée dans le terminal au moment de
//   la recette, jamais écrite dans un fichier) ; une adresse fictive (.test, .invalid, example.com...) est refusée.
// Aucune adresse dans ce fichier : --a est obligatoire. Codes de sortie : 0 fait ; 1 envoi refusé par Resend ; 2 arguments (ou adresse
// fictive) ; 3 clé absente.
import { adresseFictive, construireCourriel, envoyerParResend } from "../supabase/functions/contact-envois/courriels.mjs";
import { nouveauJeton } from "../supabase/functions/contact-envois/jetons.mjs";

const EXPEDITEUR_DEFAUT = "Promo ECSR <no-reply@timy-studio.fr>";
const BANC = "http://localhost:8000/";

function lireArguments(argv) {
  const args = { aBlanc: false, a: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--a-blanc") args.aBlanc = true;
    else if (argv[i] === "--a") { args.a = argv[i + 1] ?? null; i += 1; }
    else return null;
  }
  return args;
}

const args = lireArguments(process.argv.slice(2));
if (!args || !args.a || !args.a.includes("@")) {
  console.error("usage : node outils/recette_courriel.mjs --a <adresse> [--a-blanc]");
  process.exit(2);
}

const aleatoire = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const demande = {
  id: 0, type: "absence", auteur_nom: "Lina B.", jours: [{ jour: "2026-11-19", demi: "matin" }],
  motif: "personnel", texte: "rdv médical", sujet: "Absence jeudi",
};
const courriel = construireCourriel({
  evenement: "nouvelle", demande, appUrl: BANC, pageLien: "_harness_demande.html",
  destinataire: { email: args.a, nom: "Sophie", avec_compte: false, stagiaire: false },
  jetons: { voir: nouveauJeton(aleatoire), prise: nouveauJeton(aleatoire),
    reponses: [{ libelle: "Absence enregistrée", jeton: nouveauJeton(aleatoire) }] },
});

if (args.aBlanc) {
  process.stdout.write([`À : ${courriel.to}`, `Objet : ${courriel.subject}`, "", "--- texte ---", courriel.text, "", "--- html ---",
    courriel.html, ""].join("\n"));
  process.exit(0);
}
if (adresseFictive(args.a)) {
  console.error("adresse fictive : rien n'est envoyé (utiliser --a-blanc pour voir l'e-mail)");
  process.exit(2);
}
const cle = process.env.RESEND_API_KEY ?? "";
if (!cle) {
  console.error("RESEND_API_KEY absente de l'environnement : rien n'est envoyé");
  process.exit(3);
}
const resultat = await envoyerParResend(fetch, cle, process.env.CONTACT_EXPEDITEUR || EXPEDITEUR_DEFAUT, courriel);
if (resultat.ok) {
  console.log("envoyé : vérifier la boîte de réception (objet : " + courriel.subject + ")");
  process.exit(0);
}
console.error("refusé : " + resultat.raison);
process.exit(1);
