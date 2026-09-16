/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
// La carte d'authentification et ses modes. Sortie de main.js, qui redevient le
// fichier du démarrage et des routes.
import { signInWithPassword, signUpWithPassword } from "./db.js?v=20260916b";
import { validerEmail, validerMotDePasse, messageErreurAuth, configMode } from "./gate-rules.js?v=20260916b";

export function showGate(mode = "signin") {
  const gate = document.getElementById("gate");
  const tabs = document.querySelector(".gate-tabs");
  const tabSignin = document.getElementById("gate-tab-signin");
  const tabSignup = document.getElementById("gate-tab-signup");
  const subtitle = document.getElementById("gate-subtitle");
  const emailInput = document.getElementById("gate-email");
  const passwordInput = document.getElementById("gate-password");
  const submit = document.getElementById("gate-submit");
  const error = document.getElementById("gate-error");
  const hint = document.getElementById("gate-hint");

  gate.classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");

  let courant = mode;

  function setMode(next) {
    courant = next;
    const c = configMode(next);
    tabs.classList.toggle("hidden", !c.onglets);
    tabSignin.classList.toggle("active", next === "signin");
    tabSignup.classList.toggle("active", next === "signup");
    subtitle.textContent = c.sousTitre;
    submit.textContent = c.bouton;
    emailInput.classList.toggle("hidden", !c.champs.email);
    passwordInput.classList.toggle("hidden", !c.champs.password);
    if (c.autocomplete) passwordInput.autocomplete = c.autocomplete;
    hint.textContent = c.hint;
    error.classList.add("hidden");
    submit.disabled = false;
  }

  tabSignin.onclick = () => setMode("signin");
  tabSignup.onclick = () => setMode("signup");
  setMode(courant);
  emailInput.focus();

  const echec = (msg) => {
    error.textContent = msg;
    error.classList.remove("hidden");
  };

  const handler = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const erreurEmail = validerEmail(email);
    if (erreurEmail) return echec(erreurEmail);
    // À la connexion, seule la présence compte : le vrai mot de passe est
    // validé par le serveur, et un ancien compte peut être plus court.
    const erreurMdp = courant === "signup"
      ? validerMotDePasse(password)
      : (password ? null : "Mot de passe requis");
    if (erreurMdp) return echec(erreurMdp);

    error.classList.add("hidden");
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = configMode(courant).boutonEnCours;
    try {
      if (courant === "signup") await signUpWithPassword(email, password);
      else await signInWithPassword(email, password);
      // initAuth() est déjà câblé via onAuthChange ; le polling watch bootera l'app.
    } catch (e) {
      console.error("Gate auth error:", e);
      echec(messageErreurAuth(e?.message || String(e)));
      submit.disabled = false;
      submit.textContent = original;
    }
  };

  submit.onclick = handler;
  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); handler(); } };
  emailInput.onkeydown = onEnter;
  passwordInput.onkeydown = onEnter;
}

export function hideGate() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}
