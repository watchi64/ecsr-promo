/*
 * Bulle assistant : disponible partout une fois connecte.
 * Aucune cle ici : tout passe par l'Edge Function `chatbot` (JWT verifie).
 * Historique ephemere (sessionStorage), fenetre des 8 derniers messages envoyee.
 */
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=20260826a";
import { supabase } from "./db.js?v=20260826a";
import { icon } from "./icons.js?v=20260826a";
import { fenetreMessages, pageDepuisHash, extraireEvenements } from "./chatbot-rules.js?v=20260826a";

const CLE_HISTO = "chatbot_histo";
let histo = [];
let enCours = false;

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
    const { rendreMarkdown } = await import("./views/cours-reader.js?v=20260826a");
    const { noeuds } = rendreMarkdown(texte);
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
      body: JSON.stringify({
        messages: fenetreMessages(histo),
        page: pageDepuisHash(location.hash),
      }),
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
  if (document.getElementById("chatbot-fab")) return;
  chargerHisto();
  const app = document.getElementById("app");

  const fab = document.createElement("button");
  fab.id = "chatbot-fab";
  fab.className = "chatbot-fab";
  fab.type = "button";
  fab.title = "Assistant";
  fab.setAttribute("aria-label", "Ouvrir l'assistant");
  fab.appendChild(icon.chat());
  app.appendChild(fab);

  const panneau = document.createElement("div");
  panneau.id = "chatbot-panel";
  panneau.className = "chatbot-panel hidden";
  panneau.innerHTML = `
    <div class="chatbot-head">
      <p class="chatbot-titre">Assistant <span class="chatbot-beta">bêta</span></p>
      <button type="button" class="ghost-btn chatbot-close" aria-label="Fermer l'assistant">&times;</button>
    </div>
    <p class="chatbot-disclaimer">Version bêta : l'assistant peut se tromper, vérifie les points importants dans les cours. La qualité des réponses va s'améliorer.</p>
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

  // Auto-focus seulement au pointeur precis (souris/trackpad) : sur ecran
  // tactile, focus() ouvrirait le clavier immediatement (et declenchait le
  // zoom iOS) alors que l'utilisateur veut d'abord voir le panneau.
  // Evalue au clic, pas a l'init : suit un changement de peripherique.
  fab.addEventListener("click", () => {
    panneau.classList.toggle("hidden");
    if (!panneau.classList.contains("hidden") && window.matchMedia("(pointer: fine)").matches) {
      input.focus();
    }
  });
  panneau.querySelector(".chatbot-close").addEventListener("click", () => panneau.classList.add("hidden"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panneau.classList.contains("hidden")) panneau.classList.add("hidden");
  });

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
