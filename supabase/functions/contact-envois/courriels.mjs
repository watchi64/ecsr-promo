// E-mails de l'espace contact : adresses fictives, construction de l'e-mail, envoi par Resend, traitement de la file.
// Module sans dépendance : la base (rpc), l'envoi (fetch), l'aléa et la cryptographie sont injectés, pour être joué tel quel par
// la fonction serveur contact-envois et par les tests (sans réseau).
// Règles : ni motif, ni sujet, ni texte libre dans un e-mail (seuls le type, l'auteur et les jours en sortent) ; l'équipe est
// vouvoyée, le stagiaire tutoyé ; un stagiaire n'a que « Ouvrir dans l'app » (C-12) ; les liens d'action portent le jeton nu dans
// le fragment (#j=...), jamais dans le chemin ni la requête (C-11).
import { preparerJetons } from "./jetons.mjs";

// Domaines réservés aux essais (RFC 2606, RFC 6761) : jamais d'envoi, l'envoi est « ignoré ».
const DOMAINES_FICTIFS = ["example.com", "example.org", "example.net", "localhost"];
const SUFFIXES_FICTIFS = [".test", ".invalid", ".example", ".localhost"];

export function adresseFictive(email) {
  const adresse = String(email ?? "").trim().toLowerCase();
  const arobase = adresse.lastIndexOf("@");
  if (arobase <= 0 || arobase === adresse.length - 1) return true;
  const domaine = adresse.slice(arobase + 1);
  return DOMAINES_FICTIFS.some((d) => domaine === d || domaine.endsWith("." + d))
    || SUFFIXES_FICTIFS.some((s) => domaine.endsWith(s));
}

const TYPES = {
  absence: "Absence",
  retard: "Retard",
  administratif: "Question administrative",
  document: "Demande de document",
  autre: "Message",
};
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function echapper(texte) {
  return String(texte ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Les jours d'une demande (C-22) : « jeudi 19 novembre, matin ; vendredi 20 novembre, après-midi ». Un jour illisible est omis.
export function formaterJours(jours) {
  if (!Array.isArray(jours)) return "";
  return jours.map((j) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(j?.jour ?? ""));
    if (!m) return "";
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (date.getUTCDate() !== Number(m[3])) return "";
    const demi = j.demi === "aprem" ? "après-midi" : j.demi === "matin" ? "matin" : "";
    return `${JOURS[date.getUTCDay()]} ${date.getUTCDate()} ${MOIS[date.getUTCMonth()]}${demi ? ", " + demi : ""}`;
  }).filter(Boolean).join(" ; ");
}

// Ce que dit l'e-mail, selon l'événement et le public (équipe : vous ; stagiaire : tu). Aucune phrase ne reprend le sujet ou le texte.
function phrases(evenement, type, auteur, stagiaire) {
  const genre = (TYPES[type] ?? "Message").toLowerCase();
  if (stagiaire) {
    switch (evenement) {
      case "prise": return { objet: "ta demande est prise en compte", corps: `Ta demande (${genre}) a été prise en compte par le centre.` };
      case "reponse": return { objet: "nouvelle réponse", corps: `Tu as une nouvelle réponse à ta demande (${genre}).` };
      case "annulation": return { objet: "demande annulée", corps: `Une demande (${genre}) qui te concerne a été annulée.` };
      case "justificatif_recu": return { objet: "justificatif reçu", corps: "Ton justificatif a bien été reçu par le centre." };
      default: return { objet: "nouveau message", corps: `Tu as un nouveau message du centre (${genre}).` };
    }
  }
  switch (evenement) {
    case "nouvelle": return { objet: `nouvelle demande de ${auteur}`, corps: `${auteur} vous a envoyé une demande (${genre}).` };
    case "reponse": return { objet: `nouvelle réponse de la demande de ${auteur}`, corps: `Une nouvelle réponse est arrivée sur la demande de ${auteur} (${genre}).` };
    case "prise": return { objet: "demande prise en compte", corps: `Votre demande (${genre}) a été prise en compte.` };
    case "annulation": return { objet: `demande annulée par ${auteur}`, corps: `${auteur} a annulé sa demande (${genre}).` };
    case "avis_absence": return { objet: `absence annoncée par ${auteur}`, corps: `Pour information, ${auteur} vous prévient d'une absence.` };
    case "annulation_absence": return { objet: `absence annulée par ${auteur}`, corps: `${auteur} a annulé son absence annoncée.` };
    case "justificatif_recu": return { objet: `justificatif de ${auteur}`, corps: `Le justificatif de ${auteur} a été reçu.` };
    default: return { objet: `message de ${auteur}`, corps: `Vous avez un nouveau message de ${auteur}.` };
  }
}

function bouton(url, libelle, principal) {
  const fond = principal ? "#1f5f4a" : "#ffffff";
  const couleur = principal ? "#ffffff" : "#1f5f4a";
  return `<a href="${echapper(url)}" style="display:inline-block;margin:4px 8px 4px 0;padding:12px 18px;border-radius:8px;`
    + `border:1px solid #1f5f4a;background:${fond};color:${couleur};text-decoration:none;font-weight:600">${echapper(libelle)}</a>`;
}

// L'e-mail d'un envoi. jetons : jetons nus { voir, prise, justificatif, reponses: [{ libelle, jeton }] } (absents pour un stagiaire).
// pageLien : la page des liens d'action (demande.html ; la recette pointe vers le banc).
export function construireCourriel({ evenement, demande, destinataire, jetons, appUrl, pageLien = "demande.html" }) {
  const stagiaire = Boolean(destinataire?.stagiaire);
  const auteur = String(demande?.auteur_nom ?? "").trim() || "Sans nom";
  const type = demande?.type ?? null;
  const intitule = TYPES[type] ?? "Message";
  const jours = formaterJours(demande?.jours);
  const { objet, corps } = phrases(evenement, type, auteur, stagiaire);
  const base = String(appUrl ?? "");
  const lien = (jeton) => `${base}${pageLien}#j=${encodeURIComponent(jeton)}`;
  const ouvrir = `${base}#/${stagiaire ? "contacts" : "messages"}/${encodeURIComponent(String(demande?.id ?? ""))}`;

  const actions = [];
  if (!stagiaire) {
    const j = jetons ?? {};
    if (j.prise) actions.push({ url: lien(j.prise), libelle: "Prise en compte" });
    for (const r of Array.isArray(j.reponses) ? j.reponses : []) if (r?.jeton) actions.push({ url: lien(r.jeton), libelle: r.libelle });
    if (j.justificatif) actions.push({ url: lien(j.justificatif), libelle: "Justificatif reçu" });
    if (j.voir) actions.push({ url: lien(j.voir), libelle: "Voir la demande" });
  }
  actions.push({ url: ouvrir, libelle: "Ouvrir dans l'app" });

  const salut = `Bonjour ${String(destinataire?.nom ?? "").trim() || ""}`.trim() + ",";
  const discretion = stagiaire ? "Ouvre l'app pour lire la suite." : "Le motif et le message ne sont jamais dans un e-mail : ouvrez la demande pour les lire.";
  const pied = stagiaire ? "Les réponses passent par l'app, pour garder la trace."
    : "Les réponses passent par ces boutons ou par l'app, pour garder la trace.";

  const lignesTexte = [salut, "", corps];
  if (jours) lignesTexte.push(`Jours : ${jours}`);
  lignesTexte.push("", discretion, "");
  for (const a of actions) lignesTexte.push(`${a.libelle} : ${a.url}`);
  lignesTexte.push("", pied);

  const html = [
    "<!doctype html><html lang=\"fr\"><body style=\"margin:0;padding:16px;font-family:Outfit,Arial,sans-serif;color:#1d2521;background:#ffffff\">",
    `<p style="margin:0 0 12px">${echapper(salut)}</p>`,
    `<p style="margin:0 0 12px">${echapper(corps)}</p>`,
    jours ? `<p style="margin:0 0 12px"><strong>Jours :</strong> ${echapper(jours)}</p>` : "",
    `<p style="margin:0 0 16px;color:#4a564f">${echapper(discretion)}</p>`,
    `<p style="margin:0 0 16px">${actions.map((a, i) => bouton(a.url, a.libelle, i === 0)).join("")}</p>`,
    `<p style="margin:16px 0 0;font-size:14px;color:#4a564f">${echapper(pied)}</p>`,
    "</body></html>",
  ].join("");

  return {
    to: String(destinataire?.email ?? ""),
    subject: `${intitule} : ${objet}`,
    html,
    text: lignesTexte.join("\n"),
  };
}

// Un e-mail envoyé par Resend. La clé ne va que dans l'en-tête ; une raison d'échec n'en garde jamais la trace (200 caractères au plus).
export async function envoyerParResend(fetchFn, cle, expediteur, courriel) {
  const masquer = (texte) => (cle ? String(texte).split(cle).join("***") : String(texte)).replace(/\s+/g, " ").trim().slice(0, 200);
  try {
    const reponse = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: expediteur, to: [courriel.to], subject: courriel.subject, html: courriel.html, text: courriel.text }),
      signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(15_000) : undefined,
    });
    if (reponse.ok) return { ok: true };
    const detail = await reponse.text().catch(() => "");
    return { ok: false, raison: masquer(`Resend ${reponse.status} ${detail.slice(0, 150)}`) };
  } catch (e) {
    return { ok: false, raison: masquer(`Resend injoignable : ${e?.message ?? e}`) };
  }
}

// La file : _contact_srv_prendre, puis pour chaque envoi : adresse fictive -> « ignore » (rien d'autre) ; sinon les jetons (leurs
// hachés en base), l'e-mail, l'envoi, le résultat. rpc(nom, args) -> { data, error } (client Supabase en service_role).
// envoyer(courriel) -> { ok, raison }. Rend { traites, envoyes, echecs, ignores }.
export async function traiterEnvois({ rpc, envoyer, appUrl, aleatoire, subtle, limite = 20 }) {
  const { data, error } = await rpc("_contact_srv_prendre", { p_limite: limite });
  if (error || !Array.isArray(data)) throw new Error("file des envois illisible");
  const bilan = { traites: 0, envoyes: 0, echecs: 0, ignores: 0 };
  const resultat = async (id, issue, raison) => {
    const { error: e } = await rpc("_contact_srv_resultat", { p_envoi_id: id, p_issue: issue, p_raison: raison });
    if (e) throw new Error("résultat d'envoi non enregistré");
  };
  for (const item of data) {
    bilan.traites += 1;
    if (adresseFictive(item?.destinataire?.email)) {
      await resultat(item.envoi_id, "ignore", "adresse fictive");
      bilan.ignores += 1;
      continue;
    }
    let courriel;
    try {
      const { nus, haches } = await preparerJetons(item, aleatoire, subtle);
      if (haches.length) {
        const { error: e } = await rpc("_contact_srv_jetons", { p_envoi_id: item.envoi_id, p_jetons: haches });
        if (e) throw new Error("jetons refusés par la base");
      }
      courriel = construireCourriel({ evenement: item.evenement, demande: item.demande, destinataire: item.destinataire, jetons: nus, appUrl });
    } catch (e) {
      await resultat(item.envoi_id, "echec", String(e?.message ?? e).slice(0, 200));
      bilan.echecs += 1;
      continue;
    }
    const envoi = await envoyer(courriel);
    if (envoi?.ok) {
      await resultat(item.envoi_id, "envoye", null);
      bilan.envoyes += 1;
    } else {
      await resultat(item.envoi_id, "echec", envoi?.raison ?? "échec");
      bilan.echecs += 1;
    }
  }
  return bilan;
}
