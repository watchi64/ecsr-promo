// Gestion des stagiaires d'une promo (lot 5, Task 9) : la liste modifiable (prénom, nom de famille, abandon, ajout), les abandons
// (réactivation) et l'invitation du compte d'une fiche. L'effacement des données (à la demande de la personne, ou aux dates de
// conservation) est sur la page Qualiopi, fondateur seul (lot Q5). Sortie de js/views/config.js (section Promo des
// Réglages du formateur) pour être montée aussi dans la page Stagiaires de la direction. Tout porte sur la promo affichée : la base
// n'accepte d'écrire une fiche que dans la promo courante (équipe de la promo ou direction de son centre).

import {
  listStagiaires, addStagiaire, updateStagiaire, updateStagiaireNom, setStagiaireActif,
  listUserProfiles, inviteUser,
} from "../db.js?v=20261111m";
import { el, clear, toast, displayStagiaire } from "../utils.js?v=20261111m";
import { icon } from "../icons.js?v=20261111m";
import { isEquipe } from "../auth-admin.js?v=20261111m";
import { messageInvitationReussie } from "../roles-rules.js?v=20261111m";
import { phraseDeRefus } from "../espaces-rules.js?v=20261111m";
import { confirmer } from "../confirmer.js?v=20261111m";

// Liste des personnes invitables de la section déjà à l'écran. Posée par la section d'invitation qui la montre (js/views/config.js ou
// renderInvitationStagiaire), appelée après un ajout de stagiaire, qui n'actualise que le bloc « Stagiaires ».
let majPersonnesInvitables = null;
export function poserMajPersonnesInvitables(fn) { majPersonnesInvitables = fn; }

// Écriture d'un stagiaire refusée : l'unicité (promo, prénom) de la base (code 23505) se dit en
// une phrase claire. Un refus de la base (droit manquant, fonction absente) se dit par sa phrase (phraseDeRefus), jamais par le texte technique.
export function messageErreurStagiaire(e) {
  return e?.code === "23505" ? "Ce prénom existe déjà dans la promo." : phraseDeRefus(e?.message, e?.code);
}

// Les blocs « Stagiaires » et « Abandons » de la promo affichée, ajoutés à `container`. `rerender()` redessine la page qui les porte
// (après un abandon, une réactivation, un effacement). `surChangement()` (facultatif) est appelé après un ajout ou un renommage, qui
// ne redessinent que leur bloc : la page qui montre ces noms ailleurs les relit.
export async function renderGestionStagiaires(container, { rerender, surChangement } = {}) {
  // Gérer la liste de la promo : formateur et direction (la base le permet à l'équipe de la promo).
  const admin = isEquipe();
  const allStagiaires = await listStagiaires({ includeInactive: true });
  // Une fiche sans nom (anonymise_le : étape des 3 ans, ou effacée à la demande, qui reste « actif ») n'est plus dans les listes.
  const stagiairesActifs = allStagiaires.filter((s) => s.actif !== false && !s.anonymise_le);
  // Abandons : ni fiche sans nom, ni fiche dont les données sont effacées (efface_le) ; celles-là sont seulement comptées.
  const stagiairesAbandon = allStagiaires.filter((s) => s.actif === false && !s.anonymise_le && !s.efface_le);
  const nbEffacees = allStagiaires.filter((s) => s.anonymise_le || (s.actif === false && s.efface_le)).length;

  // Après un ajout de stagiaire : relit la liste et n'actualise que l'en-tête (compteur) et les lignes du
  // bloc « Stagiaires ». Le formulaire d'ajout reste en place, avec son focus (et le clavier de l'iPhone),
  // comme le défilement et le reste de la vue ; la liste des personnes invitables suit.
  async function actualiserStagiaires(bloc) {
    const tous = await listStagiaires({ includeInactive: true });
    const frais = renderList(tous.filter((s) => s.actif !== false && !s.anonymise_le), false);
    bloc.querySelector(".block-head").replaceWith(frais.querySelector(".block-head"));
    bloc.querySelector(".config-list").replaceWith(frais.querySelector(".config-list"));
    if (majPersonnesInvitables) majPersonnesInvitables().catch(() => {});
  }

  // avecAjout : faux pour actualiser un bloc existant (en-tête et lignes seuls, sans formulaire d'ajout).
  function renderList(items, avecAjout = true) {
    const wrap = el("div", { class: "param-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, "Stagiaires"),
      el("span", { class: "count" }, items.length + " entrée" + (items.length > 1 ? "s" : "")),
    ));

    const list = el("ul", { class: "config-list" });
    items.forEach((it) => {
      // Champ « Nom de famille » (plus bas) : déclaré ici, le gestionnaire du prénom en a besoin.
      let nomInput = null;
      const input = el("input", { type: "text", value: it.prenom || it.nom, readonly: admin ? undefined : true, "aria-label": "Prénom" });
      if (admin) {
        input.addEventListener("blur", async () => {
          const v = input.value.trim();
          if (v === (it.prenom || it.nom)) return;
          if (!v) { input.value = it.prenom || it.nom; return; }
          try {
            await updateStagiaire(it.id, v);
            // Copie locale à jour : un nouveau blur ne retente pas la même écriture, et l'étiquette
            // du champ voisin comme les confirmations d'abandon et de suppression portent le bon nom.
            it.prenom = v;
            if (nomInput) nomInput.setAttribute("aria-label", "Nom de famille de " + v);
            toast("Mis à jour", "success");
            if (surChangement) surChangement();
          } catch (e) {
            input.value = it.prenom || it.nom;
            toast(messageErreurStagiaire(e), "error");
          }
        });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      }

      // « Abandon » (désactivation douce, données conservées).
      let actionBtn = null;
      if (admin) {
        actionBtn = el("button", {
          class: "btn small ghost abandon-btn",
          title: "Marquer en abandon : masqué partout (planning, dés, notes), données conservées",
          onClick: async () => {
            // Fenêtre de l'app plutôt que confirm() (le robot des parcours ne sait pas répondre à la boîte du navigateur).
            const ok = await confirmer({ titre: `Marquer ${displayStagiaire(it)} en abandon ?`,
              phrase: "Ce stagiaire disparaît du planning, des dés et des notes. Ses données restent conservées et réactivables.",
              oui: "Marquer en abandon" });
            if (!ok) return;
            try {
              await setStagiaireActif(it.id, false);
              toast(`${displayStagiaire(it)} marqué(e) en abandon`, "success");
              rerender();
            } catch (e) { toast(messageErreurStagiaire(e), "error"); }
          }
        }, "Abandon");
      }

      // Pour un admin seulement : nom de famille à côté du prénom (affichage « V. Timy »,
      // tri par nom). Les autres stagiaires n'en voient que l'initiale : le champ n'existe pas pour eux.
      if (admin) {
        nomInput = el("input", { type: "text", class: "config-nom", value: it.nom || "",
          placeholder: "Nom", "aria-label": "Nom de famille de " + it.prenom });
        nomInput.addEventListener("blur", async () => {
          const v = nomInput.value.trim();
          if (v === (it.nom || "")) return;
          try {
            await updateStagiaireNom(it.id, v);
            it.nom = v || null;
            toast("Mis à jour", "success");
            if (surChangement) surChangement();
          } catch (e) {
            nomInput.value = it.nom || "";
            toast(messageErreurStagiaire(e), "error");
          }
        });
        nomInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nomInput.blur(); });
      }
      list.appendChild(el("li", {}, input, nomInput, actionBtn));
    });
    wrap.appendChild(list);

    if (admin && avecAjout) {
      const addInput = el("input", { type: "text", placeholder: "Prénom", "aria-label": "Prénom du stagiaire à ajouter" });
      const addNom = el("input", { type: "text", placeholder: "Nom", "aria-label": "Nom de famille" });
      const addBtn = el("button", { class: "btn accent", onClick: async () => {
        const v = addInput.value.trim();
        if (!v) {
          // Seul le nom de famille est rempli : on le dit et on renvoie sur le prénom, plutôt que de ne rien faire.
          if (addNom && addNom.value.trim()) {
            toast("Renseignez d'abord le prénom.", "error");
            addInput.focus();
          }
          return;
        }
        try {
          await addStagiaire(v, addNom.value.trim());
        } catch (e) {
          // Refus : les champs sont conservés, rien d'autre ne bouge.
          toast(messageErreurStagiaire(e), "error");
          return;
        }
        addInput.value = "";
        if (addNom) addNom.value = "";
        toast("Ajouté", "success");
        // Seul le bloc est actualisé, puis « Prénom » reprend le focus pour enchaîner les
        // saisies sans remonter la page. Relecture impossible : rendu complet (il gère ses erreurs).
        try {
          await actualiserStagiaires(wrap);
          addInput.focus();
          if (surChangement) surChangement();
        } catch (e) { rerender(); }
      }}, icon.plus(), "Ajouter");
      // Entrée dans « Prénom » passe à « Nom de famille », Entrée dans « Nom de famille » valide.
      addInput.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        if (addNom) addNom.focus();
        else addBtn.click();
      });
      if (addNom) addNom.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
      wrap.appendChild(el("div", { class: "config-add" }, addInput, addNom, addBtn));
    }
    return wrap;
  }

  // Bloc des abandons : « Réactiver » seulement. L'effacement des données (à la demande de la personne, ou aux dates de
  // conservation) est sur la page Qualiopi, fondateur seul (lot Q5) : la fiche n'a plus à passer en abandon pour cela.
  function renderAbandons(items) {
    const wrap = el("div", { class: "param-block abandons-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, "Abandons"),
      el("span", { class: "count" }, items.length + " stagiaire" + (items.length > 1 ? "s" : "")),
    ));
    wrap.appendChild(el("p", { class: "muted abandons-hint" },
      "Masqués du planning, des dés et des notes. « Réactiver » remet la personne dans la promo."));
    const list = el("ul", { class: "config-list" });
    items.forEach((it) => {
      const reactiverBtn = el("button", {
        class: "btn small accent",
        onClick: async () => {
          try {
            await setStagiaireActif(it.id, true);
            toast(`${displayStagiaire(it)} réactivé(e)`, "success");
            rerender();
          } catch (e) { toast(messageErreurStagiaire(e), "error"); }
        }
      }, "Réactiver");
      list.appendChild(el("li", { class: "abandon-row" },
        el("span", { class: "abandon-name" }, displayStagiaire(it)),
        reactiverBtn,
      ));
    });
    wrap.appendChild(list);
    if (nbEffacees) {
      wrap.appendChild(el("p", { class: "muted abandons-hint" },
        nbEffacees + (nbEffacees > 1 ? " fiches effacées" : " fiche effacée")
        + " au titre de la conservation des données : elles ne figurent plus dans ces listes."));
    }
    return wrap;
  }

  container.appendChild(renderList(stagiairesActifs));
  if (admin && (stagiairesAbandon.length || nbEffacees)) container.appendChild(renderAbandons(stagiairesAbandon));
}

// L'invitation du compte d'un stagiaire de la promo affichée, pour la direction (page Stagiaires du centre) : choisir la fiche,
// entrer l'adresse e-mail. La base décide (inviter_compte : direction du centre de la promo de la fiche) ; ses refus se disent
// par leur phrase. `rerender()` est appelé après une invitation acceptée.
export async function renderInvitationStagiaire(container, { rerender } = {}) {
  let [profiles, stagiaires] = await Promise.all([
    listUserProfiles().catch(() => []), listStagiaires(),
  ]);
  const bloc = el("div", { class: "param-block" });
  bloc.appendChild(el("h4", {}, "Inviter un stagiaire"));
  bloc.appendChild(el("p", { class: "muted" },
    "Choisissez la personne et entrez son adresse e-mail. Aucun e-mail n'est envoyé : vous lui partagez le lien de l'app vous-même, puis elle crée son compte avec cette adresse et un mot de passe."));

  const personSel = el("select", { class: "invite-person", "aria-label": "Stagiaire à inviter" });
  function actualiserOptions() {
    clear(personSel);
    personSel.appendChild(el("option", { value: "" }, "Choisir…"));
    const pris = new Set(profiles.filter((p) => p.stagiaire_id).map((p) => p.stagiaire_id));
    stagiaires.forEach((it) => {
      const dejaInvite = pris.has(it.id);
      const opt = el("option", { value: String(it.id) }, displayStagiaire(it) + (dejaInvite ? " (déjà invité)" : ""));
      if (dejaInvite) opt.disabled = true;
      personSel.appendChild(opt);
    });
  }
  actualiserOptions();
  // Un ajout de stagiaire n'actualise que son bloc : la liste d'ici suit, sans toucher à la personne déjà choisie ni à l'adresse en cours de saisie.
  poserMajPersonnesInvitables(async () => {
    stagiaires = await listStagiaires();
    const choisie = personSel.value;
    actualiserOptions();
    if (choisie && [...personSel.options].some((o) => o.value === choisie && !o.disabled)) personSel.value = choisie;
  });

  const emailInput = el("input", { type: "email", placeholder: "email@exemple.fr", class: "invite-email", "aria-label": "Adresse e-mail du stagiaire" });
  const libelle = "Ajouter à la liste des invitations";
  const sendBtn = el("button", { class: "btn accent", type: "button" }, icon.plus(), libelle);
  sendBtn.addEventListener("click", () => envoyerInvitation({
    bouton: sendBtn, libelle, emailInput, personId: personSel.value ? Number(personSel.value) : null, role: "stagiaire", apres: rerender,
  }));
  emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendBtn.click(); });
  bloc.appendChild(el("div", { class: "invite-form" },
    el("div", { class: "invite-row" }, el("label", {}, "Personne"), personSel),
    el("div", { class: "invite-row" }, el("label", {}, "E-mail"), emailInput, sendBtn)));
  container.appendChild(bloc);
}

// Envoi d'une invitation depuis un formulaire (Réglages du formateur, page Stagiaires de la direction) : adresse valide, personne
// choisie, appel de la base avec un délai de 15 s, message de réussite ou phrase d'erreur, bouton remis en état. `personId` est
// l'identifiant de la fiche (stagiaire) ou du formateur (rôle « prof »). `apres()` est appelé après une invitation acceptée.
export async function envoyerInvitation({ bouton, libelle, emailInput, personId, role, apres }) {
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) { toast("E-mail invalide", "error"); return; }
  // Le siège n'est lié à aucune fiche : l'adresse suffit.
  if (!personId && role !== "siege") { toast("Choisissez la personne à lier", "error"); return; }
  const remettre = () => {
    bouton.disabled = false;
    bouton.textContent = "";
    bouton.appendChild(icon.plus());
    bouton.appendChild(document.createTextNode(libelle));
  };
  bouton.disabled = true;
  bouton.textContent = "Envoi…";
  try {
    const resultat = await Promise.race([
      inviteUser({
        email, role,
        stagiaire_id: role === "stagiaire" ? personId : null,
        prof_id: role === "prof" ? personId : null,
      }),
      // Délai de 15 s pour éviter l'attente infinie.
      new Promise((_, reject) => setTimeout(() => reject(new Error("Délai dépassé (15 s). Réseau lent : réessayez dans un instant.")), 15000)),
    ]);
    // Profil créé, compte existant qui gagne la promo, ou rien de changé (roles-rules.js, messageInvitationReussie).
    const { texte, ton } = messageInvitationReussie({ resultat, email });
    toast(texte, ton, 4500);
    emailInput.value = "";
    if (apres) apres();
  } catch (e) {
    toast(phraseDeRefus(e?.message, e?.code), "error", 6000);
  } finally {
    remettre();
  }
}
