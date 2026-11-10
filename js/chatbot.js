/*
 * Panneau de l'assistant : disponible partout une fois connecte.
 * Aucune cle ici : tout passe par l'Edge Function `chatbot` (JWT verifie).
 * Historique ephemere (sessionStorage), fenetre des 8 derniers messages envoyee.
 * Le panneau s'ouvre par les boutons « Assistant » de la coquille (js/nav-shell.js), qui appellent
 * basculerAssistant().
 */
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=20261110e";
import { supabase } from "./db.js?v=20261110e";
import { corpsRequete, extraireEvenements } from "./chatbot-rules.js?v=20261110e";
import { moduleVisible } from "./modules-etat.js?v=20261110e";
import { getEspace } from "./auth-admin.js?v=20261110e";

const CLE_HISTO = "chatbot_histo";
let histo = [];
let enCours = false;
// Panneau ouvert depuis la coquille : la fonction qu'elle a donnée pour rendre le focus à la fermeture.
let retourDuFocus = null;
// Abonnés à l'ouverture et à la fermeture du panneau (la coquille, pour l'aria-expanded de ses boutons).
const abonnes = new Set();

const panneauAssistant = () => document.getElementById("chatbot-panel");

// cb(ouvert) à l'ouverture par basculerAssistant et à chaque fermeture ; renvoie de quoi se désabonner.
export function onAssistantChange(cb) {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}

// Le panneau est-il ouvert ? Lu par la coquille pour dessiner ses boutons (remontage panneau ouvert).
export function assistantOuvert() {
  const panneau = panneauAssistant();
  return !!panneau && !panneau.classList.contains("hidden");
}

// Ferme le panneau (croix, Échap, bouton de la coquille, module fermé). Ouvert depuis la coquille, le
// focus lui est rendu s'il était dans le panneau ou nulle part (un toucher ne le pose pas) ; posé
// ailleurs dans la page, il y reste.
function fermerPanneau() {
  const panneau = panneauAssistant();
  if (!panneau || panneau.classList.contains("hidden")) return;
  const actif = document.activeElement;
  const focusARendre = !actif || actif === document.body || panneau.contains(actif);
  panneau.classList.add("hidden");
  const rendre = retourDuFocus;
  retourDuFocus = null;
  abonnes.forEach((cb) => cb(false));
  if (rendre && focusARendre) rendre();
}

// Boutons « Assistant » de la coquille : ouvre le panneau, ou le ferme s'il est ouvert. `rendreFocus` :
// ce que la coquille fera du focus à la fermeture. Auto-focus seulement au pointeur précis (souris,
// pavé tactile) : sur écran tactile, focus() ouvrirait le clavier tout de suite (et déclenchait le zoom
// iOS) alors que la personne veut d'abord voir le panneau. Évalué au clic : suit un changement d'appareil.
export function basculerAssistant(rendreFocus = null) {
  const panneau = panneauAssistant();
  if (!panneau) return;
  if (!panneau.classList.contains("hidden")) {
    fermerPanneau();
    return;
  }
  retourDuFocus = rendreFocus;
  panneau.classList.remove("hidden");
  abonnes.forEach((cb) => cb(true));
  if (window.matchMedia("(pointer: fine)").matches) panneau.querySelector("textarea")?.focus();
}

function chargerHisto() {
  try { histo = JSON.parse(sessionStorage.getItem(CLE_HISTO)) ?? []; }
  catch { histo = []; }
}

function sauverHisto() {
  try { sessionStorage.setItem(CLE_HISTO, JSON.stringify(histo.slice(-30))); }
  catch { /* stockage indisponible : historique memoire seulement */ }
}

async function rendreEnMarkdown(noeud, texte) {
  try {
    const { rendreMarkdown } = await import("./views/cours-reader.js?v=20261110e");
    // blocs: false : une réponse qui recopie un bloc de cours (schéma, quiz, cartes) le laisse en texte brut,
    // elle ne monte ni schéma animé ni quiz dans la bulle.
    const { noeuds } = rendreMarkdown(texte, { blocs: false });
    noeud.replaceChildren(...noeuds);
    noeud.querySelectorAll("a[href^='http']").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener";
    });
  } catch {
    noeud.textContent = texte;
  }
}

function ajouterBulle(msgs, role, texte) {
  const div = document.createElement("div");
  div.className = "chatbot-msg " + role;
  div.textContent = texte;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function envoyerQuestion(question, msgs) {
  enCours = true;
  histo.push({ role: "user", content: question });
  sauverHisto();
  ajouterBulle(msgs, "user", question);
  const bulleBot = ajouterBulle(msgs, "assistant", "…");

  let texte = "";
  // Vrai quand un message final (quota, erreur) est deja pose : la retombee
  // du finally ne doit alors pas l'ecraser par "Pas de reponse".
  let messageFige = false;
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) { bulleBot.textContent = "Reconnecte-toi pour utiliser l'assistant."; messageFige = true; return; }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(corpsRequete(histo, location.hash, getEspace())),
    });

    if (resp.status === 429) {
      const j = await resp.json().catch(() => ({}));
      bulleBot.textContent = j.message || "Quota du jour atteint, reviens demain.";
      messageFige = true;
      return;
    }
    if (!resp.ok) {
      bulleBot.textContent = "L'assistant est indisponible pour le moment, réessaie un peu plus tard.";
      messageFige = true;
      return;
    }

    const lecteur = resp.body.getReader();
    const dec = new TextDecoder();
    let tampon = "";
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      const r = extraireEvenements(tampon, dec.decode(value, { stream: true }));
      tampon = r.restant;
      for (const ev of r.evenements) {
        if (ev.type === "delta") {
          texte += ev.texte;
          bulleBot.textContent = texte;
        } else if (ev.type === "outil") {
          bulleBot.textContent = ev.nom === "consulter_article_legifrance"
            ? "Vérification sur Légifrance…"
            : "Recherche dans les cours…";
        } else if (ev.type === "erreur") {
          texte = texte || ev.message;
          bulleBot.textContent = texte;
        }
        msgs.scrollTop = msgs.scrollHeight;
      }
    }
  } catch (e) {
    console.error("chatbot:", e);
    if (!texte) { bulleBot.textContent = "Connexion interrompue, réessaie."; messageFige = true; }
  } finally {
    enCours = false;
    if (texte) {
      histo.push({ role: "assistant", content: texte });
      sauverHisto();
      await rendreEnMarkdown(bulleBot, texte);
    } else if (!messageFige) {
      // Couvre aussi un flux coupe apres un statut outil ("Recherche...")
      bulleBot.textContent = "Pas de réponse, réessaie.";
    }
    msgs.scrollTop = msgs.scrollHeight;
  }
}

export function initChatbot() {
  if (panneauAssistant()) return;
  chargerHisto();
  const app = document.getElementById("app");

  const panneau = document.createElement("div");
  panneau.id = "chatbot-panel";
  panneau.className = "chatbot-panel hidden";
  panneau.innerHTML = `
    <div class="chatbot-head">
      <p class="chatbot-titre">Assistant <span class="chatbot-beta">bêta</span></p>
      <button type="button" class="ghost-btn chatbot-close" aria-label="Fermer l'assistant">&times;</button>
    </div>
    <p class="chatbot-disclaimer">Version bêta : l'assistant peut se tromper, vérifie les points importants dans les cours. La qualité des réponses va s'améliorer.</p>
    <p class="chatbot-signaler">Un souci avec l'app ? <button type="button" class="chatbot-signaler-btn" data-sg-entree="assistant" aria-haspopup="dialog">Signaler un problème</button></p>
    <div class="chatbot-msgs"></div>
    <form class="chatbot-form">
      <textarea rows="1" placeholder="Pose ta question…" maxlength="2000"
        aria-label="Ta question à l'assistant"></textarea>
      <button type="submit" class="btn primary" aria-label="Envoyer">Envoyer</button>
    </form>`;
  app.appendChild(panneau);

  const msgs = panneau.querySelector(".chatbot-msgs");
  const form = panneau.querySelector(".chatbot-form");
  const input = panneau.querySelector("textarea");

  if (histo.length) {
    for (const m of histo) {
      const b = ajouterBulle(msgs, m.role, m.content);
      if (m.role === "assistant") rendreEnMarkdown(b, m.content);
    }
  } else {
    ajouterBulle(msgs, "assistant",
      "Salut ! Je peux t'expliquer l'app, t'aider à réviser les 57 thèmes et vérifier la réglementation sur Légifrance. Qu'est-ce qu'il te faut ?");
  }

  panneau.querySelector(".chatbot-close").addEventListener("click", fermerPanneau);
  // Signaler un problème (spec 2026-10-28) : la fenêtre s'ouvre par-dessus le panneau, qui reste ouvert.
  const signaler = panneau.querySelector(".chatbot-signaler-btn");
  signaler.addEventListener("click", () => {
    import("./signalement.js?v=20261110e").then((m) => m.ouvrirSignalement({ ancre: signaler }));
  });
  // Capture : Échap ferme le panneau sans atteindre une fenêtre restée dessous (un QCM, par exemple). Panneau fermé,
  // la touche passe aux autres fenêtres.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panneau.classList.contains("hidden")) return;
    e.preventDefault();
    e.stopPropagation();
    fermerPanneau();
  }, true);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || enCours) return;
    input.value = "";
    envoyerQuestion(q, msgs);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

// Le module « assistant » (js/modules-data.js) fermé pour la promo : un stagiaire n'a plus de bouton
// « Assistant » dans la coquille (js/nav-shell.js), et un panneau resté ouvert se ferme. Appelée par
// main.js au démarrage et à chaque changement de rôle ou d'état des modules.
export function appliquerModuleAssistant() {
  if (!moduleVisible("assistant")) fermerPanneau();
}
