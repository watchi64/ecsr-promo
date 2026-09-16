/*
 * Promo ECSR : application propriétaire.
 * © 2026 watchi64. Tous droits réservés. Voir LICENSE.
 */
// La carte d'authentification et ses modes. Sortie de main.js, qui redevient le
// fichier du démarrage et des routes.
import { signInWithPassword, signUpWithPassword, requestPasswordReset, updatePassword } from "./db.js?v=20260916b";
import { validerEmail, validerMotDePasse, messageErreurAuth, configMode, MDP_MIN } from "./gate-rules.js?v=20260916b";
import { toast } from "./utils.js?v=20260916b";

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
  const confirmation = document.getElementById("gate-confirmation");
  const oubli = document.getElementById("gate-oubli");
  const retour = document.getElementById("gate-retour");
  const info = document.getElementById("gate-info");

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
    confirmation.classList.toggle("hidden", !c.champs.confirmation);
    oubli.classList.toggle("hidden", !c.lienOubli);
    retour.classList.toggle("hidden", !c.retour);
    info.classList.add("hidden");
    // « Nouveau » n'a de sens que sur l'ecran de reinitialisation : en creation
    // de compte, il n'y a pas d'ancien mot de passe a remplacer.
    passwordInput.placeholder = next === "signin"
      ? "Mot de passe"
      : next === "reset-set"
        ? "Nouveau mot de passe (min. " + MDP_MIN + " caractères)"
        : "Mot de passe (min. " + MDP_MIN + " caractères)";
    error.classList.add("hidden");
    submit.disabled = false;
    // Le focus va au premier champ reellement visible du mode (email, sinon mot
    // de passe), jamais a un champ cache. Recalcule a chaque changement de mode :
    // sinon, passer du lien mort a la demande laisse le champ email sans curseur.
    const premierChampVisible = c.champs.email
      ? emailInput
      : c.champs.password
        ? passwordInput
        : null;
    if (premierChampVisible) premierChampVisible.focus();
  }

  tabSignin.onclick = () => setMode("signin");
  tabSignup.onclick = () => setMode("signup");
  oubli.onclick = () => setMode("reset-request");
  retour.onclick = () => setMode("signin");
  setMode(courant);

  const echec = (msg) => {
    info.classList.add("hidden");
    error.textContent = msg;
    error.classList.remove("hidden");
  };

  // Verrou d'envoi : au-delà du plafond horaire appliqué par Supabase, on
  // empêche le matraquage du bouton, qui n'apporte rien à l'utilisateur.
  let verrouJusqua = 0;

  async function envoyerLien() {
    const email = emailInput.value.trim();
    const erreurEmail = validerEmail(email);
    if (erreurEmail) return echec(erreurEmail);
    const reste = Math.ceil((verrouJusqua - Date.now()) / 1000);
    if (reste > 0) return echec("Patiente " + reste + " secondes avant un nouvel envoi.");

    // Mode retenu au moment de l'appel : si la carte a change de mode pendant
    // que la requete est en vol (ex. clic sur "Retour a la connexion"),
    // on abandonne l'affichage du resultat sans jamais annuler la demande.
    const modeAppel = courant;
    error.classList.add("hidden");
    submit.disabled = true;
    submit.textContent = configMode("reset-request").boutonEnCours;
    // Le verrou se pose avant l'envoi : il couvre aussi la fenetre ou la
    // requete est en vol, pas seulement l'apres-coup.
    verrouJusqua = Date.now() + 60000;
    try {
      await requestPasswordReset(email);
    } catch (e) {
      // On journalise, mais on n'en dit rien à l'écran : révéler l'échec
      // reviendrait à dire si l'adresse a un compte.
      console.error("Reset request error:", e);
    }
    if (courant !== modeAppel) return;
    // Message identique quoi qu'il arrive : aucune énumération de comptes.
    info.textContent = "Si un compte existe pour cette adresse, un lien vient de partir. "
                     + "Pense à regarder les indésirables.";
    info.classList.remove("hidden");
    submit.textContent = configMode("reset-request").bouton;
    submit.disabled = false;
  }

  async function enregistrerMotDePasse() {
    const mdp = passwordInput.value;
    const erreur = validerMotDePasse(mdp, confirmation.value);
    if (erreur) return echec(erreur);

    // Meme garde que dans envoyerLien : si la carte a change de mode pendant
    // que l'appel est en vol, on abandonne l'ecriture dans la carte (utile
    // surtout au chemin d'erreur ; le succes recharge la page, la question
    // devient sans objet).
    const modeAppel = courant;
    error.classList.add("hidden");
    submit.disabled = true;
    submit.textContent = configMode("reset-set").boutonEnCours;
    let echoue = null;
    try {
      await updatePassword(mdp);
    } catch (e) {
      console.error("Update password error:", e);
      echoue = e;
    }
    if (courant !== modeAppel) return;
    if (echoue) {
      echec(messageErreurAuth(echoue?.message || String(echoue)));
      submit.disabled = false;
      submit.textContent = configMode("reset-set").bouton;
      return;
    }
    toast("Mot de passe modifi\u00e9.", "success", 3000);
    // Rechargement sur l'URL propre : la session de recuperation est deja
    // valide, le demarrage normal ouvre l'app. Plus sur que de rejouer le boot
    // a la main depuis un etat intermediaire.
    location.replace(location.pathname);
  }

  const handler = async () => {
    if (courant === "reset-request") return envoyerLien();
    if (courant === "reset-error") return setMode("reset-request");
    if (courant === "reset-set") return enregistrerMotDePasse();
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
  const onEnter = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (submit.disabled) return;
    handler();
  };
  emailInput.onkeydown = onEnter;
  passwordInput.onkeydown = onEnter;
  confirmation.onkeydown = onEnter;
}

export function hideGate() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}
