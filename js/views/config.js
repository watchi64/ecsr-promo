/*
 * Vue Paramètres (ancienne navigation) et vue Réglages (nouvelle navigation).
 * Ancienne navigation, une seule page, sections : Accès & invitations · Mes préférences · Modules de la
 * promo (js/views/modules-reglage.js) · Émargement (fondateur, js/emargement-etat.js) ·
 * Nouvelle navigation (fondateur, js/nav-etat.js) · Promo · Données personnelles (équipe) · Infos.
 * La conservation des fiches (étapes datées, effacement à la demande) vit sur la page Qualiopi, fondateur seul (lot Q5) :
 * Données personnelles le dit, avec un lien pour le fondateur, et garde la purge des élèves bénévoles.
 * Nouvelle navigation (lot 2A), deux pages : Réglages (#/config, l'équipe) ne garde que la promo, dans
 * l'ordre : Ce que voient les stagiaires (les modules) · Promo · Accès et invitations · Émargement et
 * Nouvelle navigation (fondateur) · Données personnelles ; Mes préférences (#/preferences, tous les
 * rôles, renderPreferences) garde ce qui est à la personne : Apparence (lot 3, pour tous) · Dans les notes de la classe
 * (l'anonymat, pour qui a une fiche de stagiaire) · Informations (dont « À retenir », les règles courtes que l'Accueil ne porte plus).
 * Paramètres de l'ancienne barre : Apparence en tête, seulement pour qui est en Couleurs ECF (décision H6 : le choix se fait dans
 * la nouvelle navigation, mais personne ne reste coincé dans un habillage qu'il ne peut pas quitter).
 */
import {
  listStagiaires, listProfs,
  listBenevolesAPurger, purgerBenevoles,
  getPromoCourante, renommerPromo,
  addProf, updateProf, deleteProf,
  listUserProfiles, deleteUserProfile, lireRolesDuPersonnel,
  setMyAnonymousNotes,
} from "../db.js?v=20261111d";
import { el, clear, toast, displayStagiaire } from "../utils.js?v=20261111d";
import { confirmer } from "../confirmer.js?v=20261111d";
import { icon } from "../icons.js?v=20261111d";
import { isAdmin, isEquipe, getAdminEmail, getProfile, monStagiaireId, getViewAs, fondateurHorsApercu, selonPublic } from "../auth-admin.js?v=20261111d";
import { moduleVisible } from "../modules-etat.js?v=20261111d";
import { renderModulesSection } from "./modules-reglage.js?v=20261111d";
import { renderGestionStagiaires, poserMajPersonnesInvitables, envoyerInvitation } from "./stagiaires-gestion.js?v=20261111d";
import { renderEmargementReglage } from "../emargement-etat.js?v=20261111d";
import { renderNavigationReglage, navigationV2Active } from "../nav-etat.js?v=20261111d";
import { pointsARetenir } from "../accueil-rules.js?v=20261111d";
import { dateCourte, questionPurgerBenevoles, PHRASE_CONSERVATION } from "../effacement-rules.js?v=20261111d";
import { peutInviterFormateur, peutRetirerCompte, listeAcces } from "../roles-rules.js?v=20261111d";
import { blocHabillage } from "../habillage-choix.js?v=20261111d";
import { habillageCourant } from "../habillage.js?v=20261111d";
import { nomBenevole } from "../planning-lecture.js?v=20261111d";

// ====== SECTION Accès & invitations ======

async function renderAccessSection(rerender) {
  const admin = isAdmin();
  // La direction du centre n'est pas « admin » mais peut inviter (un formateur compris) : le formulaire lui est ouvert.
  const peutInviter = admin || peutInviterFormateur({ profil: getProfile(), promo: getPromoCourante(), apercu: getViewAs() });
  const currentEmail = getAdminEmail();
  // Nouvelle navigation : les mots de la page sont ceux de l'équipe, sans « whitelist », « admin » ni « mdp »
  // (constats du 28/10) ; l'ancienne garde ses textes.
  const v2 = navigationV2Active();
  const libelleAjout = v2 ? "Ajouter à la liste des invitations" : "Ajouter à la whitelist";
  poserMajPersonnesInvitables(null);  // le formulaire d'un rendu précédent ne doit pas survivre à celui-ci
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.shield()),
    el("div", {},
      el("h3", {}, v2 ? "Accès et invitations" : "Accès & invitations"),
      el("p", { class: "muted" }, v2
        ? "Personnes invitées à utiliser l'app : stagiaires et formateurs."
        : "Personnes invitées à utiliser l'app (stagiaires, formateurs, admins)."),
    ),
  ));

  // Le vrai rôle des comptes direction et siège : une simple étiquette, sa lecture ratée laisse l'affichage d'avant, sans message.
  let [profiles, stagiaires, profs, rolesPersonnel] = await Promise.all([
    listUserProfiles(), listStagiaires(), listProfs(),
    lireRolesDuPersonnel().catch((e) => { console.warn("rôles du personnel", e); return null; }),
  ]);

  // === Form d'invitation (admin ou direction) ===
  if (peutInviter) {
    const inviteBlock = el("div", { class: "param-block" });
    inviteBlock.appendChild(el("h4", {}, "Autoriser une personne"));
    const phraseHabituelle = v2
      ? "Choisissez le rôle et la personne, entrez son adresse e-mail. Aucun e-mail n'est envoyé : vous lui partagez l'URL vous-même, puis elle crée son compte avec cette adresse et un mot de passe."
      : "Choisis le rôle et la personne, entre son email. Aucun mail n'est envoyé : tu lui partages l'URL toi-même, puis elle crée son compte avec son email + un mdp.";
    // Le siège n'a pas de personne à choisir : la phrase ne la mentionne plus.
    const phraseSiege = "Entrez l'adresse e-mail de la personne qui rejoint le siège du réseau. Aucun e-mail n'est envoyé : vous lui partagez l'URL vous-même, puis elle crée son compte avec cette adresse et un mot de passe.";
    const aideInvitation = el("p", { class: "muted" }, phraseHabituelle);
    inviteBlock.appendChild(aideInvitation);

    const roleSel = el("select", { class: "invite-role", "aria-label": "Rôle de la personne invitée" });
    // Inviter un formateur : la direction du centre ou le fondateur (la base le vérifie aussi, inviter_compte).
    const peutFormateur = peutInviterFormateur({ profil: getProfile(), promo: getPromoCourante(), apercu: getViewAs() });
    [
      { v: "stagiaire", l: "Stagiaire" },
      ...(peutFormateur ? [{ v: "prof", l: "Formateur" }] : []),
      // Le siège du réseau : le fondateur seul, hors aperçu (la base le vérifie aussi, inviter_compte). Aucune fiche à lier.
      ...(fondateurHorsApercu() ? [{ v: "siege", l: "Siège" }] : []),
    ].forEach((o) => roleSel.appendChild(el("option", { value: o.v }, o.l)));

    const personSel = el("select", { class: "invite-person", "aria-label": "Personne invitée" });
    const libellePersonne = el("label", {}, "Personne");
    function refreshPersonOptions() {
      clear(personSel);
      const role = roleSel.value;
      // Le siège n'est lié à aucune fiche : le choix de la personne disparaît, l'adresse suffit.
      libellePersonne.hidden = personSel.hidden = role === "siege";
      aideInvitation.textContent = role === "siege" ? phraseSiege : phraseHabituelle;
      if (role === "siege") return;
      personSel.appendChild(el("option", { value: "" }, "Choisir…"));
      const list = role === "stagiaire" ? stagiaires : profs;
      const taken = new Set(profiles
        .filter((p) => role === "stagiaire" ? p.stagiaire_id : p.prof_id)
        .map((p) => role === "stagiaire" ? p.stagiaire_id : p.prof_id));
      list.forEach((it) => {
        const isTaken = taken.has(it.id);
        // Stagiaire : « Lucie M. », le format de tous les écrans (décision du 10/11) ; formateur : son nom tel que saisi.
        const baseLabel = it.prenom ? displayStagiaire(it) : it.nom;
        const label = baseLabel + (isTaken ? " (déjà invité)" : "");
        const opt = el("option", { value: String(it.id) }, label);
        if (isTaken) opt.disabled = true;
        personSel.appendChild(opt);
      });
    }
    roleSel.addEventListener("change", refreshPersonOptions);
    refreshPersonOptions();
    // Un ajout de stagiaire n'actualise que son bloc : la liste d'ici suit, sans toucher à la personne
    // déjà choisie ni à l'email en cours de saisie.
    poserMajPersonnesInvitables(async () => {
      stagiaires = await listStagiaires();
      const choisie = personSel.value;
      refreshPersonOptions();
      if (choisie && [...personSel.options].some((o) => o.value === choisie && !o.disabled)) personSel.value = choisie;
    });

    const emailInput = el("input", { type: "email", placeholder: "email@exemple.fr", class: "invite-email", "aria-label": "Adresse e-mail" });

    const sendBtn = el("button", { class: "btn accent" }, icon.plus(), libelleAjout);
    sendBtn.addEventListener("click", () => envoyerInvitation({
      bouton: sendBtn, libelle: libelleAjout, emailInput, personId: personSel.value ? Number(personSel.value) : null,
      role: roleSel.value, v2, apres: rerender,
    }));

    function restoreBtnInitial() {
      sendBtn.disabled = false;
      sendBtn.textContent = "";
      sendBtn.appendChild(icon.plus());
      sendBtn.appendChild(document.createTextNode(libelleAjout));
    }
    // Sécurise l'état initial du label
    setTimeout(restoreBtnInitial, 0);
    emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendBtn.click(); });

    inviteBlock.appendChild(el("div", { class: "invite-form" },
      el("div", { class: "invite-row" },
        el("label", {}, "Rôle"), roleSel,
        libellePersonne, personSel,
      ),
      el("div", { class: "invite-row" },
        el("label", {}, "E-mail"), emailInput,
        sendBtn,
      ),
    ));
    section.appendChild(inviteBlock);
  }

  // === Liste des invités ===
  const listBlock = el("div", { class: "param-block" });
  listBlock.appendChild(el("h4", {}, `Personnes avec accès (${profiles.length})`));
  if (profiles.length === 0) {
    listBlock.appendChild(el("p", { class: "muted" }, "Personne pour l'instant. Invitez quelqu'un ci-dessus."));
  } else {
    const list = el("ul", { class: "admin-list" });
    listeAcces({ profils: profiles, roles: rolesPersonnel, v2 })
      .forEach(({ profil: p, pastilles }) => {
        let who = "";
        if (p.stagiaire_id) {
          const s = stagiaires.find((x) => x.id === p.stagiaire_id);
          if (s) who = displayStagiaire(s);
        } else if (p.prof_id) {
          const pr = profs.find((x) => x.id === p.prof_id);
          if (pr) who = pr.nom;
        }
        // Nouvelle navigation : un compte « admin » est un formateur, et le droit d'inviter et de modifier se dit
        // « gestion » (court : la colonne de la pastille fait 80 px), avec le détail en infobulle.
        const pills = el("div", { class: "role-pills" },
          ...pastilles.map((x) => el("span", { class: "role-pill role-" + x.classe }, x.libelle)),
          (p.is_admin && p.role !== "admin")
            ? el("span", { class: "role-pill role-admin", title: v2 ? "Peut inviter et modifier" : null }, v2 ? "gestion" : "admin")
            : null,
        );
        const item = el("li", { class: "admin-item" },
          pills,
          el("span", { class: "admin-email-text" }, p.email),
          who ? el("span", { class: "admin-you" }, who) : null,
          p.email === currentEmail ? el("span", { class: "admin-you" }, "vous") : null,
          (admin && p.email !== currentEmail && peutRetirerCompte({ cible: p, fondateur: fondateurHorsApercu() })) ? el("button", {
            class: "btn small danger icon-only", "aria-label": "Retirer l'accès",
            onClick: async () => {
              if (!(await confirmer({ titre: `Retirer l'accès de ${p.email} ?`, oui: "Retirer l'accès" }))) return;
              try {
                await deleteUserProfile(p.email);
                toast("Accès retiré", "success");
                rerender();
              } catch (e) { toast(e.message, "error"); }
            }
          }, icon.trash()) : null,
        );
        list.appendChild(item);
      });
    listBlock.appendChild(list);
  }
  section.appendChild(listBlock);

  return section;
}

// ====== SECTION Mes préférences ======

function renderMyPreferencesSection(rerender) {
  const profile = getProfile();
  if (!profile) return null;  // pas affichée si pas de profil
  // Seul réglage de la section : l'anonymat dans les notes de la classe. Module Notes
  // fermé pour la promo : la section n'a plus d'objet pour un stagiaire.
  if (!moduleVisible("notes")) return null;
  // Nouvelle navigation : l'anonymat ne concerne que qui a une fiche de stagiaire (un formateur n'a pas de notes dans la classe, et voit
  // tout) ; sans fiche (monStagiaireId() nul, « Voir en tant que » Formateur compris), le réglage est masqué. L'ancienne navigation
  // le garde pour tous, comme avant.
  const v2 = navigationV2Active();
  if (v2 && monStagiaireId() == null) return null;

  const section = el("section", { class: "param-section" });
  // Nouvelle navigation : la page s'appelle déjà « Mes préférences » et « Réglages » est la page de l'équipe : la section dit ce qu'elle
  // règle, une seule fois le titre de la page. L'ancienne garde ses mots.
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.user ? icon.user() : icon.users()),
    el("div", {},
      el("h3", {}, v2 ? "Dans les notes de la classe" : "Mes préférences"),
      el("p", { class: "muted" }, v2 ? "Ce que les autres stagiaires voient de toi." : "Réglages personnels visibles uniquement par toi."),
    ),
  ));

  const block = el("div", { class: "param-block" });
  block.appendChild(el("h4", {}, "Anonymat dans le tableau de notes"));
  block.appendChild(el("p", { class: "muted" },
    "Si activé, les autres stagiaires ne voient plus ni ton prénom ni tes notes dans les notes de la classe "
    + "(elles restent comptées dans les moyennes du groupe). En échange, tu ne vois plus leurs notes : "
    + "seulement ta ligne, la moyenne du groupe, la moyenne haute et la moyenne basse. "
    + "Les formateurs et la direction du centre continuent de tout voir (besoin d'évaluation)."));
  // Les profils admin / fondateur n'ont pas de verrou (besoin de tester et de
  // démontrer) : la RPC les laisse passer, l'UI n'affiche donc pas la règle.
  const noLock = !!(profile.is_admin || profile.is_founder);
  block.appendChild(el("p", { class: "muted" },
    noLock
      ? (navigationV2Active() ? "Réglage modifiable librement, sans verrou." : "Ton profil admin change librement, sans verrou.")
      : "Après un changement, tu as 2 minutes pour annuler ; ensuite le réglage est verrouillé pendant 24 h."));

  const checkbox = el("input", { type: "checkbox", id: "pref-anon" });
  if (profile.anonymous_notes) checkbox.checked = true;

  const label = el("label", { for: "pref-anon", class: "invite-admin-toggle" },
    checkbox,
    " Masquer mon prénom et mes notes",
  );

  // Verrou anti-yoyo : l'état (grâce de 2 min / verrou de 24 h) vient du profil
  // et est appliqué pour de bon côté serveur par la RPC. Ici on ne fait que
  // l'afficher et griser la case.
  const GRACE_MS = 2 * 60 * 1000;
  const lockInfo = el("p", { class: "muted", style: "margin:0.4rem 0 0;font-weight:600" });

  function refreshLockState() {
    if (noLock) {
      checkbox.disabled = false;
      lockInfo.style.display = "none";
      return;
    }
    const now = Date.now();
    const changedAt = profile.anon_changed_at ? new Date(profile.anon_changed_at).getTime() : null;
    const lockUntil = profile.anon_lock_until ? new Date(profile.anon_lock_until).getTime() : null;
    const inGrace = changedAt != null && now < changedAt + GRACE_MS;
    const locked = !inGrace && lockUntil != null && now < lockUntil;
    checkbox.disabled = locked;
    if (locked) {
      const d = new Date(lockUntil);
      const quand = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
        + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      lockInfo.textContent = "Réglage verrouillé : prochain changement possible le " + quand + ".";
      lockInfo.style.display = "";
    } else if (inGrace) {
      lockInfo.textContent = "Tu peux encore annuler ce changement pendant 2 minutes.";
      lockInfo.style.display = "";
    } else {
      lockInfo.style.display = "none";
    }
  }

  checkbox.addEventListener("change", async () => {
    const wanted = checkbox.checked;
    checkbox.disabled = true;
    try {
      const state = await setMyAnonymousNotes(wanted);
      profile.anonymous_notes = state?.value ?? wanted;
      profile.anon_changed_at = state?.changed_at ?? null;
      profile.anon_lock_until = state?.locked_until ?? null;
      checkbox.checked = !!profile.anonymous_notes;
      toast(profile.anonymous_notes
        ? "Ton prénom et tes notes sont maintenant masqués."
        : "Ton prénom et tes notes sont à nouveau visibles.", "success");
    } catch (e) {
      toast("Erreur : " + e.message, "error");
      checkbox.checked = !wanted;
    } finally {
      checkbox.disabled = false;
      refreshLockState();
    }
  });

  block.appendChild(label);
  block.appendChild(lockInfo);
  refreshLockState();
  section.appendChild(block);
  return section;
}

// ====== SECTION Promo (stagiaires + profs) ======

async function renderPromoSection(rerender) {
  // Gérer la liste de la promo : formateur et direction (la base le permet à l'équipe de la promo).
  const admin = isEquipe();
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.users()),
    el("div", {},
      el("h3", {}, "Promo"),
      el("p", { class: "muted" }, admin
        ? "Gérer la liste des stagiaires et formateurs."
        : (navigationV2Active()
          ? "Liste des stagiaires et formateurs. Vous ne pouvez pas la modifier."
          : "Liste des stagiaires et formateurs. Édition admin only.")),
    ),
  ));

  const profs = await listProfs();

  // Promo affichée : nom modifiable par les admins, lieu en lecture (spec multi-promo C.5).
  function renderPromoCourante() {
    const promo = getPromoCourante();
    if (!promo) return null;
    const wrap = el("div", { class: "param-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, "Promo affichée"),
      el("span", { class: "count" }, "Lieu : " + (promo.lieu_nom || "non renseigné")),
    ));
    const nomPromo = el("input", { type: "text", value: promo.nom, "aria-label": "Nom de la promo",
      readonly: admin ? undefined : true });
    if (admin) {
      nomPromo.addEventListener("blur", async () => {
        const v = nomPromo.value.trim();
        if (!v || v === promo.nom) { nomPromo.value = promo.nom; return; }
        try {
          await renommerPromo(promo.id, v);
          toast("Nom de la promo mis à jour", "success");
          // Seul ce bloc est redessiné (il relit la promo courante, déjà renommée en mémoire) :
          // le reste de la vue, le défilement et une saisie en cours ailleurs ne bougent pas.
          const neuf = renderPromoCourante();
          if (neuf) wrap.replaceWith(neuf);
        } catch (e) {
          nomPromo.value = promo.nom;
          toast(e.message, "error");
        }
      });
      nomPromo.addEventListener("keydown", (e) => { if (e.key === "Enter") nomPromo.blur(); });
    }
    wrap.appendChild(el("ul", { class: "config-list" }, el("li", {}, nomPromo)));
    return wrap;
  }

  // Formateurs : suppression directe (pas de notion d'abandon).
  function renderList(items) {
    const wrap = el("div", { class: "param-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, "Formateurs (communs à toutes les promos)"),
      el("span", { class: "count" }, items.length + " entrée" + (items.length > 1 ? "s" : "")),
    ));

    const list = el("ul", { class: "config-list" });
    items.forEach((it) => {
      const input = el("input", { type: "text", value: it.prenom || it.nom, readonly: admin ? undefined : true, "aria-label": "Nom" });
      if (admin) {
        input.addEventListener("blur", async () => {
          const v = input.value.trim();
          if (v === (it.prenom || it.nom)) return;
          if (!v) { input.value = it.prenom || it.nom; return; }
          try {
            await updateProf(it.id, v);
            // Copie locale à jour : un nouveau blur ne retente pas la même écriture, et la confirmation de
            // suppression porte le bon nom.
            it.nom = v;
            toast("Mis à jour", "success");
          } catch (e) {
            input.value = it.prenom || it.nom;
            toast(e.message, "error");
          }
        });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      }

      let actionBtn = null;
      if (admin) {
        actionBtn = el("button", {
          class: "btn small danger icon-only", "aria-label": "Supprimer",
          onClick: async () => {
            if (!(await confirmer({ titre: `Supprimer ${it.nom} ?`, oui: "Supprimer" }))) return;
            try {
              await deleteProf(it.id);
              toast("Supprimé", "success");
              rerender();
            } catch (e) { toast(e.message, "error"); }
          }
        }, icon.trash());
      }
      list.appendChild(el("li", {}, input, null, actionBtn));
    });
    wrap.appendChild(list);

    if (admin) {
      const addInput = el("input", { type: "text", placeholder: "Nom", "aria-label": "Nom à ajouter" });
      const addBtn = el("button", { class: "btn accent", onClick: async () => {
        const v = addInput.value.trim();
        if (!v) return;
        try {
          await addProf(v);
        } catch (e) {
          // Refus : les champs sont conservés, rien d'autre ne bouge.
          toast(e.message, "error");
          return;
        }
        addInput.value = "";
        toast("Ajouté", "success");
        rerender();
      }}, icon.plus(), "Ajouter");
      // Formateur (un seul champ) : Entrée valide.
      addInput.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        addBtn.click();
      });
      wrap.appendChild(el("div", { class: "config-add" }, addInput, null, addBtn));
    }
    return wrap;
  }

  const blocPromo = renderPromoCourante();
  if (blocPromo) section.appendChild(blocPromo);
  await renderGestionStagiaires(section, { rerender });
  section.appendChild(renderList(profs));
  return section;
}

// ====== SECTION Données personnelles (équipe) ======
// Engagements des conditions d'utilisation (sections 7 et 10). La conservation des fiches (étapes à 12 mois et à 3 ans,
// effacement à la demande) est gérée par le fondateur sur la page Qualiopi (lot Q5) : la section le dit, avec un lien pour
// le fondateur seulement. Les élèves bénévoles sans venue depuis 12 mois restent ici, pour qui y a droit. Le serveur
// vérifie tout (droits, délais) ; ici on montre l'état et on déclenche.

async function renderDonneesSection(rerender) {
  if (!isEquipe()) return null;
  // La suppression des élèves bénévoles : le formateur seul (isAdmin).
  const avecBenevoles = isAdmin();
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.trash()),
    el("div", {},
      el("h3", {}, "Données personnelles"),
      el("p", { class: "muted" }, "Durées de conservation promises dans les conditions d'utilisation."),
    ),
  ));

  const benevoles = avecBenevoles
    ? await listBenevolesAPurger().catch((e) => { console.error(e); return undefined; })
    : undefined;

  // Conservation des fiches : la phrase pour toute l'équipe, le lien vers la page Qualiopi pour le fondateur seul (la page
  // est fermée aux autres comptes et à l'aperçu « Voir en tant que »).
  const blocConservation = el("div", { class: "param-block", "data-conservation": "" });
  blocConservation.appendChild(el("div", { class: "block-head" }, el("h4", {}, "Conservation des fiches")));
  blocConservation.appendChild(el("p", { class: "muted donnees-texte" }, PHRASE_CONSERVATION));
  if (fondateurHorsApercu()) {
    blocConservation.appendChild(el("a", { class: "btn cons-lien", href: "#/qualiopi", "data-lien-conservation": "" }, "Ouvrir la page Qualiopi"));
  }
  section.appendChild(blocConservation);

  // Élèves bénévoles inactifs
  const blocBnv = el("div", { class: "param-block" });
  blocBnv.appendChild(el("div", { class: "block-head" },
    el("h4", {}, "Élèves bénévoles sans venue depuis 12 mois"),
    benevoles ? el("span", { class: "count" }, String(benevoles.length)) : null,
  ));
  if (benevoles === undefined) {
    blocBnv.appendChild(el("p", { class: "muted" }, "Liste indisponible pour le moment."));
  } else if (!benevoles.length) {
    blocBnv.appendChild(el("p", { class: "muted donnees-texte" }, "Aucun : tous les élèves enregistrés sont venus dans les 12 derniers mois."));
  } else {
    const liste = el("ul", { class: "config-list donnees-liste" });
    benevoles.forEach((b) => liste.appendChild(el("li", {},
      el("span", {}, nomBenevole(b.display)),
      el("span", { class: "muted" }, b.derniere_venue ? "dernière venue le " + dateCourte(b.derniere_venue) : "jamais venu"),
    )));
    blocBnv.appendChild(liste);
    blocBnv.appendChild(el("button", { class: "btn danger", onClick: async (e) => {
      const bouton = e.currentTarget;
      const n = benevoles.length;
      if (!(await confirmer(questionPurgerBenevoles(n)))) return;
      bouton.disabled = true;
      try {
        const nb = await purgerBenevoles(benevoles.map((b) => b.id));
        toast(`${nb} élève${nb > 1 ? "s" : ""} supprimé${nb > 1 ? "s" : ""}.`, "success");
        rerender();
      } catch (err) { toast(err.message, "error"); rerender(); }
    } }, benevoles.length > 1 ? `Supprimer ces ${benevoles.length} élèves` : "Supprimer cet élève"));
  }
  if (avecBenevoles) section.appendChild(blocBnv);
  return section;
}

// ====== SECTION Apparence (lot 3) ======

// Le choix de l'habillage, toujours rendu dans Mes préférences (rien ne le cache : ni l'absence de fiche de stagiaire, ni
// le module Notes fermé). Le titre de la section nomme le groupe des deux pastilles.
function renderApparenceSection() {
  const titre = el("h3", {}, "Apparence");
  return el("section", { class: "param-section" },
    el("div", { class: "param-section-head" },
      el("div", { class: "param-icon" }, icon.palette()),
      el("div", {},
        titre,
        el("p", { class: "muted" }, "Les couleurs de l'app, au choix."),
      ),
    ),
    el("div", { class: "param-block" }, blocHabillage({ titre })),
  );
}

// Réglages de la promo (nouvelle navigation) : au test du premier clic, les formatrices ont cherché les couleurs ici. La
// section les renvoie à Mes préférences, où le choix se fait pour chaque personne (décision du 10/11, lot 3).
function renderApparenceRenvoi() {
  return el("section", { class: "param-section param-renvoi-apparence" },
    el("div", { class: "param-section-head" },
      el("div", { class: "param-icon" }, icon.palette()),
      el("div", {},
        el("h3", {}, "Apparence"),
        el("p", { class: "muted" }, "Les couleurs de l'app se choisissent pour chaque personne, dans Mes préférences."),
      ),
    ),
    el("div", { class: "param-block" },
      el("a", { class: "btn small", href: "#/preferences" }, "Ouvrir Mes préférences")),
  );
}

// ====== SECTION Infos ======

function renderInfoSection() {
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.info()),
    el("div", {},
      el("h3", {}, "Informations"),
      el("p", { class: "muted" }, "À propos de TP ECSR App."),
    ),
  ));

  section.appendChild(el("div", { class: "param-block" },
    el("dl", { class: "info-list" },
      el("dt", {}, "Application"),
      el("dd", {}, "TP ECSR App"),
      el("dt", {}, "Auteur"),
      el("dd", {}, "watchi64 · misterwatchi@gmail.com"),
      el("dt", {}, "Licence"),
      el("dd", {}, "Propriétaire."),   // plus de lien vers le dépôt : décision de Timy du 09/11
    )
  ));
  // Nouvelle navigation : l'Accueil ne porte plus « À retenir » (ce n'est pas ce qu'on vient y chercher chaque jour) ;
  // les règles vivent ici, pour tous les rôles. Avec l'ancienne, elles restent sur l'Accueil.
  if (navigationV2Active()) {
    section.appendChild(el("div", { class: "param-block", "data-a-retenir": "" },
      el("h4", {}, "À retenir"),
      el("ul", { class: "home-info-list" },
        ...pointsARetenir(true, selonPublic).map((p) => el("li", {}, el("strong", {}, p.gras), p.suite)),
      ),
    ));
  }
  return section;
}

// ====== Render principal ======

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout : ${label} (${ms / 1000}s)`)), ms)),
  ]);
}

async function rerender(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  // Nouvelle navigation : la page se nomme Réglages et ne garde que la promo ; ce qui est à la personne a
  // sa page (renderPreferences). Avec l'ancienne, la page Paramètres d'avant, d'un seul tenant.
  const v2 = navigationV2Active();
  const titre = v2 ? "Réglages" : "Paramètres";

  try {
    const [acces, preferences, promo, donnees, infos] = await withTimeout(Promise.all([
      renderAccessSection(() => rerender(container)),
      v2 ? null : renderMyPreferencesSection(() => rerender(container)),
      renderPromoSection(() => rerender(container)),
      renderDonneesSection(() => rerender(container)),
      v2 ? null : renderInfoSection(),
    ]), 12000, titre);
    // La section « Modules de la promo » est construite ICI, après l'attente, et non dans le
    // tableau ci-dessus : elle montre l'état des modules tel qu'il est au moment de son
    // insertion. Construite avant l'attente, elle serait périmée si une écriture se terminait
    // pendant « Chargement » : redessiner() (js/views/modules-reglage.js) ne trouve alors
    // aucune section à l'écran, et l'ancienne, rendue d'avant l'écriture, serait insérée ensuite.
    const modules = renderModulesSection();
    // Interrupteur de l'émargement, propre à la promo (fondateur seulement, sinon null).
    const emargement = renderEmargementReglage();
    // Interrupteur de la nouvelle navigation et aperçu de l'appareil (fondateur seulement, sinon null).
    const navigation = renderNavigationReglage();

    clear(container);
    // Surtitre de la nouvelle navigation : la promo affichée, celle que règle la page (absente si les
    // promos ne sont pas chargées).
    const surtitre = v2 ? getPromoCourante()?.nom : "Système";
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        surtitre ? el("p", { class: "eyebrow" }, surtitre) : null,
        el("h2", {}, titre),
        el("p", { class: "subtitle" }, v2
          ? "Ce que voient les stagiaires, la promo et les accès."
          : (isEquipe() ? "Accès, gestion de la promo, infos."
            : "Accès, gestion de la promo, infos. Connecte-toi en admin pour inviter ou modifier.")),
      ),
    ));

    const grid = el("div", { class: "param-grid" });
    // Nouvelle navigation : ce que voient les stagiaires d'abord (le réglage qui sert le plus), puis la promo
    // et les accès, les interrupteurs du fondateur, les données personnelles. Ancienne : l'ordre d'avant, et
    // Apparence en tête pour qui est en Couleurs ECF seulement (décision H6), le moyen de revenir à ECSR Promo.
    const apparence = !v2 && habillageCourant() === "ecf" ? renderApparenceSection() : null;
    const sections = v2
      ? [modules, promo, acces, emargement, navigation, donnees, renderApparenceRenvoi()]
      : [apparence, acces, preferences, modules, emargement, navigation, promo, donnees, infos];
    sections.filter(Boolean).forEach((s) => grid.appendChild(s));
    container.appendChild(grid);
  } catch (e) {
    console.error(titre + " : erreur de chargement", e);
    clear(container);
    container.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        el("h2", {}, titre),
      ),
    ));
    // Ancienne barre en Couleurs ECF : Apparence ne demande aucune lecture, elle se pose quand même, pour que la
    // personne ne reste pas piégée en ECF tant que la page ne se charge pas (décision H6).
    if (!v2 && habillageCourant() === "ecf") container.appendChild(renderApparenceSection());
    container.appendChild(el("div", { class: "param-error" },
      el("p", {}, "Le chargement a échoué. " + (e.message || "")),
      el("button", {
        class: "btn primary",
        onClick: () => rerender(container),
      }, "Réessayer"),
    ));
  }
}

export async function renderConfig(container) {
  await rerender(container);
}

// Nouvelle navigation : « Mes préférences » (#/preferences), que le menu du compte ouvre pour tous les rôles :
// ce qui ne concerne que la personne (l'apparence, l'anonymat dans les notes) et les informations sur l'app. Rien
// de la promo, qui vit dans Réglages (#/config), la page de l'équipe. Les sections ne demandent aucune lecture :
// la page se pose d'un coup.
export function renderPreferences(container) {
  clear(container);
  const preferences = renderMyPreferencesSection(() => renderPreferences(container));
  container.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Mon compte"),
      el("h2", {}, "Mes préférences"),
      // Apparence est toujours là : la page a toujours un réglage à soi, quel que soit le rôle. « Réglages » est le nom de
      // la page de l'équipe : il n'est pas repris ici.
      el("p", { class: "subtitle" }, "Les réglages personnels et les informations sur l'application."),
    ),
  ));
  const grid = el("div", { class: "param-grid" });
  [renderApparenceSection(), preferences, renderInfoSection()].filter(Boolean).forEach((s) => grid.appendChild(s));
  container.appendChild(grid);
}
