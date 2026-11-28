// Page des liens d'e-mail (demande.html) : la personne de l'équipe ouvre le lien reçu, lit la demande entière et touche un seul
// bouton « Confirmer : <geste> ». Ouvrir la page ne fait rien (un filtre de messagerie peut la charger) ; le geste n'est fait qu'au
// toucher. Aucun champ de texte, aucune connexion : le jeton du fragment de l'adresse fait foi, la fonction contact-envois le juge.
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=20261128a";
import { jetonDeLAdresse, etatDeLaPage, libelleAction, titreDeLaDemande, lignesAbsence, estAbsence, PHRASE_DETAIL_ABSENCE, LECTURE_EN_ECHEC } from "./lien-demande-rules.js?v=20261128a";
import { TYPES_DEMANDE } from "./contact-rules.js?v=20261128a";

const racine = document.getElementById("lien-demande");
const PHRASE_INVALIDE = "Ce lien n'est plus valable. Ouvrez la demande dans l'app ou demandez un nouvel envoi.";
const PHRASE_RESEAU = "La connexion a échoué. Vérifiez le réseau, puis touchez le bouton pour réessayer.";

function el(nom, classe, texte) {
  const e = document.createElement(nom);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

async function appeler(op, jeton) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/contact-envois`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ op, jeton }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function quand(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function montrerDemande(d) {
  const carte = el("section", "contact-carte lien-demande-carte");
  const type = TYPES_DEMANDE[d.type] ?? "Message";
  carte.append(el("p", "lien-demande-type muted", `${type}, de ${d.auteur_nom ?? "?"}, ${quand(d.cree_le)}`));
  carte.append(el("h1", "lien-demande-sujet", titreDeLaDemande(d, TYPES_DEMANDE)));
  // Une absence : le jour et le moment seulement ; ni motif, ni mot, ni messages sans connexion (décision de Timy du 18/11), une phrase
  // renvoie à l'app. Une autre demande : son texte et ses messages, comme avant.
  const lignes = lignesAbsence(d);
  if (lignes.length) {
    const liste = el("dl", "contact-detail lien-demande-absence");
    for (const [t, v] of lignes) {
      const ligne = el("div", "contact-ligne");
      ligne.append(el("dt", null, t), el("dd", null, v));
      liste.append(ligne);
    }
    carte.append(liste);
  }
  if (estAbsence(d)) {
    carte.append(el("p", "lien-demande-texte lien-demande-renvoi", PHRASE_DETAIL_ABSENCE));
    return carte;
  }
  if (d.texte) carte.append(el("p", "lien-demande-texte", d.texte));
  for (const m of d.messages ?? []) {
    const bloc = el("div", "lien-demande-message");
    bloc.append(el("p", "muted", `${m.auteur_nom ?? "?"}, ${quand(m.cree_le)}`));
    bloc.append(el("p", "lien-demande-texte", m.texte || m.reponse || ""));
    carte.append(bloc);
  }
  return carte;
}

function vue(...enfants) {
  racine.replaceChildren(...enfants);
}

function dire(titre, phrase) {
  vue(el("h1", "lien-demande-sujet", titre), ...(phrase ? [el("p", "lien-demande-texte", phrase)] : []));
}

// La première lecture a échoué : la phrase et un vrai bouton « Réessayer », qui relance la lecture (ouvrir ne fait toujours rien).
function direEchecDeLecture() {
  const bouton = el("button", "btn primary lien-demande-bouton", LECTURE_EN_ECHEC.bouton);
  bouton.type = "button";
  bouton.addEventListener("click", () => {
    bouton.disabled = true;
    demarrer();
  });
  vue(el("h1", "lien-demande-sujet", LECTURE_EN_ECHEC.titre), el("p", "lien-demande-texte", LECTURE_EN_ECHEC.phrase), bouton);
}

async function demarrer() {
  const jeton = jetonDeLAdresse(location.hash);
  if (!jeton) return dire("Lien invalide", PHRASE_INVALIDE);
  let reponse;
  try {
    reponse = await appeler("lien", jeton);
  } catch {
    return direEchecDeLecture();
  }
  const etat = etatDeLaPage(reponse);
  if (etat === "invalide") return dire("Lien invalide", PHRASE_INVALIDE);
  if (etat === "deja") return afficherFait(reponse, true);
  const carte = montrerDemande(reponse.demande);
  if (etat === "voir") return vue(carte);
  const bouton = el("button", "btn primary lien-demande-bouton", `Confirmer : ${libelleAction(reponse.action, reponse.libelle_reponse)}`);
  bouton.type = "button";
  const message = el("p", "error hidden");
  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    message.classList.add("hidden");
    try {
      const suite = await appeler("agir", jeton);
      const etatSuite = etatDeLaPage(suite);
      if (etatSuite === "invalide") return dire("Lien invalide", PHRASE_INVALIDE);
      vue(...faitOuDeja(etatSuite === "deja"));
    } catch {
      message.textContent = PHRASE_RESEAU;
      message.classList.remove("hidden");
      bouton.disabled = false;
    }
  });
  vue(carte, bouton, message);
}

function faitOuDeja(deja) {
  return [el("h1", "lien-demande-sujet", deja ? "Déjà fait" : "C'est fait"),
    el("p", "lien-demande-texte", "Vous pouvez fermer cette page. La demande reste lisible dans l'app.")];
}

function afficherFait(reponse, deja) {
  vue(...faitOuDeja(deja), ...(reponse?.demande ? [montrerDemande(reponse.demande)] : []));
}

demarrer();
