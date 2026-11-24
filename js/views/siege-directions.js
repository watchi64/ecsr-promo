// Page Directions de centre du siège (titres et droits à la carte, étape 3, spec § 11 ; lot 5, Task 12 pour la première version).
// Dans l'ordre : (1) pour chaque centre du réseau, ses personnes (titre de niveau centre en pastille, « Retirer ») ; (2) « Titres du
// réseau » : chaque titre vu du réseau, son niveau, ses porteurs, « Donner » (titre de niveau réseau, adresse seule), « Ajuster »,
// « Créer un titre à partir de celui-ci », « Supprimer », et les personnes du siège avec « Retirer » ; (3) « Journal du réseau », replié.
// « Inviter une personne » (adresse, centre, titre de centre qu'on a le droit de donner) passe par donner_titre ; « Ajouter un centre »
// crée le centre (creer_centre) puis propose d'inviter sa direction. La base décide de tout (siège seul, centre requis, nom en double,
// droit de donner ou de retirer) : ses refus se disent par leur phrase (phraseDeRefus), la saisie gardée. Les règles d'ordre (centres par
// nom, démonstration en dernier) vivent dans js/siege-rules.js. Aucune donnée de stagiaire n'est lue ici.
// Lecture des titres impossible (panne, base non migrée) : la page garde la liste d'aujourd'hui (une direction par ligne, « Retirer »,
// invitation d'une direction par inviter_compte), avec un message clair. Les fenêtres sont celles de la page Équipe (ouvrirFormulaire).
// Titres du centre (étape 4, migration 9 : le siège fixe lit titres_visibles(centre)) : sous chaque centre, ses titres en lecture (nom,
// niveau, origine, porteurs, cadenas d'un titre fixe ; cellules de la page Équipe). Lecture refusée ou en panne (base pas encore à jour) :
// le centre reste tel qu'avant, sans message.

import {
  lireLieuxDuReseau, lireDirectionsDuReseau, retirerTitre, creerCentre, inviteUser,
  lirePersonnesEtTitres, lireTitresVisibles, lireTitresAjustables, lireJournalPresent, lireJournalDesDroits, donnerTitre, creerTitre, supprimerTitre,
} from "../db.js?v=20261124a";
import { el, clear, toast, tableauEnListe } from "../utils.js?v=20261124a";
import { icon } from "../icons.js?v=20261124a";
import { phraseDeRefus } from "../espaces-rules.js?v=20261124a";
import { messageInvitationReussie } from "../roles-rules.js?v=20261124a";
import { directionsParCentre } from "../siege-rules.js?v=20261124a";
import { ouvrirFormulaire, sectionJournal, cellulesDeTitre, PHRASE_COMPTE_CREE } from "./direction-equipe.js?v=20261124a";
import { ouvrirEditeurTitre } from "./titres-editeur.js?v=20261124a";
import { gestesSurTitre, siegeFixePourLesGestes, titresDuCentreEnLecture, retraitDuSiegeOffert, LIBELLE_NIVEAU } from "../titres-rules.js?v=20261124a";
import { ecritSelonLaCase, getMesTitres, getAdminEmail, fondateurHorsApercu } from "../auth-admin.js?v=20261124a";
import { confirmer, demander } from "../confirmer.js?v=20261124a";
import { pluriel } from "../nombres.js?v=20261124a";

export const PHRASE_ECHEC_DIRECTIONS = "Les directions des centres n'ont pas pu être chargées.";
export const PHRASE_ADRESSE = "Adresse e-mail invalide.";
export const PHRASE_CENTRE_REQUIS = "Le centre est requis.";
export const PHRASE_NOM_REQUIS = "Le nom est requis.";
export const PHRASE_SANS_DIRECTION = "Aucune direction.";
export const PHRASE_SANS_PERSONNE = "Personne n'a de titre dans ce centre.";
export const PHRASE_SANS_CENTRE = "Le réseau n'a pas encore de centre.";
export const PHRASE_TITRES_ECHEC = "Les titres n'ont pas pu être chargés : la liste s'affiche sans les titres ni les gestes sur les titres.";
export const PHRASE_TITRES_DU_CENTRE_ECHEC = "Les titres de ce centre n'ont pas pu être lus : seule la direction de centre peut être invitée.";
export const PHRASE_TITRES_DU_CENTRE_REPLI = "Les titres propres à ce centre ne sont pas lus : la liste montre les titres du réseau, et la base dit si le don est permis.";
export const LIBELLE_DEMO = "Centre de démonstration";

const PHRASE_TITRE_DONNE = "Titre donné.";
const PHRASE_SANS_TITRE = "Choisissez un titre.";
const DELAI_MS = 15000;

let rendu = 0;

// La case Directions de centre est-elle sur « Modifier » ? Les titres non lus (panne, fondateur) : comme avant, oui, la base arbitre.
const peutGererLaPage = () => ecritSelonLaCase("directions", true, ["siege"]);
const monAdresse = () => String(getAdminEmail() || "").toLowerCase();

// Un refus qui a sa phrase (droit manquant, fonction absente avant la migration) la dit ; toute autre panne, la phrase commune.
function phraseDEchec(e) {
  const code = e && e.code;
  return code === "42501" || code === "PGRST202" ? phraseDeRefus(e.message, code) : PHRASE_ECHEC_DIRECTIONS;
}

// Une écriture ne reste jamais en attente : au-delà de 15 s, la phrase le dit et la saisie reste.
function avecDelai(promesse) {
  let minuteur;
  const delai = new Promise((_, rejet) => {
    minuteur = setTimeout(() => rejet(Object.assign(new Error("Délai dépassé (15 s). Réseau lent : réessayez dans un instant."), { phrase: true })), DELAI_MS);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}
const phraseDe = (err) => (err && err.phrase === true ? err.message : phraseDeRefus(err && err.message, err && err.code));

function boiteErreur(phrase, reessayer) {
  return el("div", { class: "centre-erreur", role: "alert" },
    el("p", {}, phrase),
    el("button", { class: "btn small", type: "button", onClick: reessayer }, "Réessayer"));
}

const boutonPetit = (texte, icone, libelleAria, onClick) =>
  el("button", { class: "btn small", type: "button", "aria-label": libelleAria, onClick }, icone ? icone() : null, texte);

// ============================================================== Fenêtres

// Les centres du choix : par nom, la démonstration en dernier et nommée comme telle.
function optionsCentres(lieux, choisi) {
  return directionsParCentre(lieux, []).map(({ centre }) => {
    const o = el("option", { value: String(centre.id) }, centre.nom + (centre.demonstration ? " (démonstration)" : ""));
    if (choisi != null && centre.id === choisi) o.selected = true;
    return o;
  });
}

// « Inviter une personne » : adresse, centre et titre de centre. `lieuId` : centre déjà choisi (depuis un centre, ou juste après sa
// création) ; `intro` remplace la phrase d'explication ; `personnes` : les lignes de personnes_et_titres (pour dire qu'un titre en
// remplace un autre), nul quand les titres ne se lisent pas. Les titres du centre choisi se lisent à son choix (titres_visibles) : ceux
// que le siège a le droit de donner, au niveau centre. Lecture impossible (un compte du siège qui n'est pas fondateur ne lit pas les titres
// d'un centre) : les titres de niveau centre du réseau (`titresReseau`, la base juge le don), et à défaut la direction de centre seule, par
// inviter_compte.
export function ouvrirInvitationDirection({ lieux, lieuId = null, intro = null, ancre, apres, personnes = null, titresReseau = null }) {
  const champEmail = el("input", { type: "email", id: "direction-email", autocomplete: "off", maxlength: "200", placeholder: "prenom.nom@exemple.fr" });
  const choixCentre = el("select", { id: "direction-centre" }, el("option", { value: "" }, "Choisir un centre"), ...optionsCentres(lieux, lieuId));
  const choixTitre = el("select", { id: "direction-titre" }, el("option", { value: "" }, "Choisissez d'abord un centre"));
  choixTitre.disabled = true;
  const noteTitres = el("p", { class: "muted equipe-note", role: "status" });
  let titresDuCentre = [];   // les titres de niveau centre qu'on peut donner dans le centre choisi
  let secours = false;       // titres non lus : la direction de centre par inviter_compte
  let lecture = 0;

  async function chargerTitres() {
    const jeton = ++lecture;
    const centre = Number(choixCentre.value);
    noteTitres.textContent = "";
    secours = false;
    titresDuCentre = [];
    choixTitre.replaceChildren();
    if (!centre) {
      choixTitre.appendChild(el("option", { value: "" }, "Choisissez d'abord un centre"));
      choixTitre.disabled = true;
      return;
    }
    choixTitre.disabled = true;
    choixTitre.appendChild(el("option", { value: "" }, "Chargement"));
    let titres = null;
    try { titres = await lireTitresVisibles(centre); } catch (e) { console.warn("titres du centre", e && e.message); }
    if (jeton !== lecture) return;
    choixTitre.replaceChildren();
    const rangs = (x, y) => Number(y.fixe === true) - Number(x.fixe === true) || x.nom.localeCompare(y.nom, "fr");
    if (!Array.isArray(titres) && Array.isArray(titresReseau) && titresReseau.some((t) => t.niveau === "centre")) {
      titresDuCentre = titresReseau.filter((t) => t.niveau === "centre").sort(rangs);
      noteTitres.textContent = PHRASE_TITRES_DU_CENTRE_REPLI;
      for (const t of titresDuCentre) choixTitre.appendChild(el("option", { value: String(t.id) }, t.nom));
      choixTitre.disabled = false;
      return;
    }
    if (!Array.isArray(titres)) {
      secours = true;
      noteTitres.textContent = PHRASE_TITRES_DU_CENTRE_ECHEC;
      choixTitre.appendChild(el("option", { value: "direction" }, "Direction de centre"));
      choixTitre.disabled = false;
      return;
    }
    titresDuCentre = titres.filter((t) => t.niveau === "centre" && t.donnable).sort(rangs);
    if (!titresDuCentre.length) {
      choixTitre.appendChild(el("option", { value: "" }, "Aucun titre à donner"));
      return;
    }
    for (const t of titresDuCentre) choixTitre.appendChild(el("option", { value: String(t.id) }, t.nom));
    choixTitre.disabled = false;
  }
  choixCentre.addEventListener("change", chargerTitres);

  const titreChoisi = () => titresDuCentre.find((t) => String(t.id) === choixTitre.value) || null;
  ouvrirFormulaire({
    titre: "Inviter une personne",
    intro: intro || "Aucun e-mail n'est envoyé : la personne crée son mot de passe avec cette adresse, onglet Créer mon compte.",
    corps: [
      el("div", { class: "field" }, el("label", { for: "direction-email" }, "Adresse e-mail de la personne"), champEmail),
      el("div", { class: "field" }, el("label", { for: "direction-centre" }, "Centre"), choixCentre),
      el("div", { class: "field" }, el("label", { for: "direction-titre" }, "Titre"), choixTitre, noteTitres),
    ],
    ancre, libelleBouton: "Inviter", premierChamp: () => champEmail,
    valider: () => {
      const email = champEmail.value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return PHRASE_ADRESSE;
      if (!choixCentre.value) return PHRASE_CENTRE_REQUIS;
      if (!secours && !titreChoisi()) return PHRASE_SANS_TITRE;
      return { email, lieuId: Number(choixCentre.value), titre: titreChoisi() };
    },
    // Un titre de centre remplace l'ancien titre de centre de la personne : la phrase le dit avant l'envoi.
    confirmerAvant: async (v) => {
      if (secours || !Array.isArray(personnes)) return true;
      const autres = personnes.filter((l) => String(l.email).toLowerCase() === v.email && l.niveau === "centre" && l.lieu_id === v.lieuId && l.titre_id !== v.titre.id);
      if (!autres.length) return true;
      const noms = [...new Set(autres.map((l) => l.titre_nom))];
      return confirmer({ titre: "Remplacer son titre ?", phrase: `Cette personne a déjà le titre ${noms.join(", ")} dans ce centre : il sera remplacé.`, oui: "Remplacer", danger: false });
    },
    enregistrer: async (v) => {
      if (secours) {
        const resultat = await inviteUser({ email: v.email, role: "direction", lieu_id: v.lieuId });
        const { texte, ton } = messageInvitationReussie({ resultat, email: v.email });
        toast(texte, ton, 6000);
      } else {
        const r = await donnerTitre({ email: v.email, titreId: v.titre.id, lieuId: v.lieuId });
        toast(r && r.cree ? PHRASE_COMPTE_CREE : PHRASE_TITRE_DONNE, "success", 6000);
      }
      await apres();
    },
  });
  if (lieuId != null) chargerTitres();
}

// « Ajouter un centre » : le nom, puis la proposition d'inviter sa direction. Le nom en double est refusé par la base (sa phrase
// s'affiche dans la fenêtre, le nom reste). `apres()` relit la page qui a ouvert la fenêtre.
export function ouvrirAjoutCentre({ ancre, apres, titresReseau = null }) {
  let ouvrirSuite = null;
  const champNom = el("input", { type: "text", id: "centre-nom", autocomplete: "off", maxlength: "120", placeholder: "Nom du centre" });
  ouvrirFormulaire({
    titre: "Ajouter un centre",
    intro: "Le centre est créé sans promo. Vous pourrez ensuite inviter sa direction.",
    corps: [el("div", { class: "field" }, el("label", { for: "centre-nom" }, "Nom du centre"), champNom)],
    ancre, libelleBouton: "Ajouter", premierChamp: () => champNom,
    apresFermeture: () => { if (ouvrirSuite) ouvrirSuite(); },
    valider: () => {
      const nom = champNom.value.trim().replace(/\s+/g, " ");
      return nom ? { nom } : PHRASE_NOM_REQUIS;
    },
    enregistrer: async (v) => {
      const id = await creerCentre(v.nom);
      toast(`Centre créé : ${v.nom}.`, "success", 5000);
      // Les lieux sont relus pour que le choix de l'invitation porte le centre qui vient d'exister.
      let lieux;
      try { lieux = await lireLieuxDuReseau(); } catch (e) { console.error("lieux du réseau", e); lieux = []; }
      if (!lieux.some((l) => l.id === id)) lieux = [...lieux, { id, nom: v.nom, demonstration: false }];
      // La page se relit d'abord (elle rend le focus à son titre) ; la fenêtre d'invitation s'ouvre ensuite, une fois celle-ci fermée,
      // pour que son champ garde le focus et qu'un seul fond de fenêtre existe à la fois.
      await apres();
      ouvrirSuite = () => ouvrirInvitationDirection({
        lieux, lieuId: id, ancre, titresReseau,
        intro: `${v.nom} est créé. Invitez sa direction, ou fermez cette fenêtre pour le faire plus tard.`,
        apres,
      });
    },
  });
}

// « Retirer » un titre : une personne d'un centre, ou du siège (centre nul).
function ouvrirRetrait({ centre, ligne, ancre, apres }) {
  const qui = ligne.libelle === ligne.email ? ligne.email : `${ligne.libelle} (${ligne.email})`;
  const titre = ligne.titre_nom || "Direction de centre";
  ouvrirFormulaire({
    titre: "Retirer un titre",
    intro: centre
      ? `${qui} n'aura plus le titre ${titre} dans ${centre.nom}. Son compte et ses autres titres ne changent pas.`
      : `${qui} n'aura plus le titre ${titre}. Son compte et ses autres titres ne changent pas.`,
    corps: [],
    ancre, libelleBouton: "Retirer",
    enregistrer: async () => {
      const r = await retirerTitre({ email: ligne.email, titreId: ligne.titre_id, lieuId: centre ? centre.id : null });
      toast(r && r.retirees === 0 ? "Cette personne n'avait pas ce titre : rien n'a changé." : "Titre retiré.", "success", 5000);
      await apres();
    },
  });
}

// « Donner » un titre du réseau : l'adresse seule (aucun centre).
function ouvrirDon({ titre, ancre, apres }) {
  const champEmail = el("input", { type: "email", id: "titre-reseau-email", autocomplete: "off", maxlength: "200", placeholder: "prenom.nom@exemple.fr" });
  ouvrirFormulaire({
    titre: `Donner le titre ${titre.nom}`,
    intro: "Aucun e-mail n'est envoyé : la personne crée son mot de passe avec cette adresse, onglet Créer mon compte.",
    corps: [el("div", { class: "field" }, el("label", { for: "titre-reseau-email" }, "Adresse e-mail de la personne"), champEmail)],
    ancre, libelleBouton: "Donner", premierChamp: () => champEmail,
    valider: () => {
      const email = champEmail.value.trim().toLowerCase();
      return /^\S+@\S+\.\S+$/.test(email) ? { email } : PHRASE_ADRESSE;
    },
    enregistrer: async (v) => {
      const r = await donnerTitre({ email: v.email, titreId: titre.id, lieuId: null });
      toast(r && r.cree ? PHRASE_COMPTE_CREE : PHRASE_TITRE_DONNE, "success", 6000);
      await apres();
    },
  });
}

// ============================================================== Sections

function sectionCentre({ centre, directions }, lieux, apres, avecTitres) {
  const peutGerer = peutGererLaPage();
  const moi = monAdresse();
  const tete = el("div", { class: "centre-section-tete" },
    el("h3", {}, centre.demonstration ? LIBELLE_DEMO : centre.nom),
    el("span", { class: "muted" }, pluriel(new Set(directions.map((d) => d.email)).size, avecTitres ? "personne" : "direction")));
  if (!directions.length) {
    return el("section", { class: "centre-section", "data-centre": String(centre.id) }, tete,
      el("p", { class: "muted" }, avecTitres ? PHRASE_SANS_PERSONNE : PHRASE_SANS_DIRECTION));
  }
  const lignes = directions.map((d) => el("tr", { "data-email": d.email },
    el("td", { class: "liste-titre" }, el("div", { class: "equipe-nom" }, el("strong", {}, d.libelle),
      d.libelle !== d.email ? el("span", { class: "muted equipe-adresse" }, d.email) : null)),
    avecTitres ? el("td", {}, el("div", { class: "equipe-pastilles" }, el("span", { class: "chip equipe-role equipe-role-direction" }, d.titre_nom))) : null,
    el("td", { class: "liste-actions" }, el("div", { class: "equipe-actions" },
      retraitDuSiegeOffert({ peutGerer, fondateur: fondateurHorsApercu(), personne: { email: d.email, niveau: "centre" }, moi })
        ? boutonPetit("Retirer", icon.trash, `Retirer ${d.libelle} du centre ${centre.nom}`,
          (e) => ouvrirRetrait({ centre, ligne: d, ancre: e.currentTarget, apres }))
        : null))));
  const colonnes = avecTitres ? ["Personne", "Titre", ""] : ["Direction", ""];
  const table = tableauEnListe(el("table", { class: "centre-table equipe-table" },
    el("thead", {}, el("tr", {}, ...colonnes.map((t) => el("th", { scope: "col", "aria-label": t || "Actions" }, t)))),
    el("tbody", {}, ...lignes)));
  return el("section", { class: "centre-section", "data-centre": String(centre.id) }, tete, el("div", { class: "centre-defile" }, table));
}

// Les titres d'un centre, en lecture (aucun geste) : `titres`, les lignes de titres_visibles(centre). Nul quand la lecture n'a rien donné.
export function blocTitresDuCentre(centre, titres) {
  const lignes = titresDuCentreEnLecture(titres);
  if (lignes == null) return null;
  const parId = new Map(titres.map((t) => [Number(t && t.id), t]));
  const nomDuCentre = centre.demonstration ? LIBELLE_DEMO : centre.nom;
  const contenu = lignes.length
    ? el("div", { class: "centre-defile" }, tableauEnListe(el("table", { class: "centre-table equipe-table" },
      el("thead", {}, el("tr", {}, ...["Titre", "Niveau", "Origine", "Porteurs"].map((t) => el("th", { scope: "col" }, t)))),
      el("tbody", {}, ...lignes.map((l) => el("tr", { "data-titre": String(l.id) }, ...cellulesDeTitre(parId.get(l.id))))))))
    : el("p", { class: "muted" }, "Aucun titre.");
  return el("div", { class: "centre-titres", role: "group", "aria-label": `Titres du centre ${nomDuCentre}` },
    el("h4", { class: "equipe-sous-titre" }, "Titres du centre"), contenu);
}

// Sous chaque centre affiché, ses titres : lus en parallèle après l'affichage de la page ; un refus ou une panne laisse le centre tel qu'avant.
async function ajouterTitresDesCentres(racine, centres, jeton) {
  const lectures = await Promise.allSettled(centres.map(({ centre }) => lireTitresVisibles(centre.id)));
  if (jeton !== rendu) return;
  centres.forEach(({ centre }, i) => {
    const r = lectures[i];
    if (r.status !== "fulfilled") {
      console.warn("titres du centre", centre.id, r.reason && r.reason.message);
      return;
    }
    const bloc = blocTitresDuCentre(centre, r.value);
    const section = racine.querySelector(`.centre-section[data-centre="${centre.id}"]`);
    if (bloc && section) section.appendChild(bloc);
  });
}

// Les titres du réseau : chaque titre vu du réseau, et les personnes du siège. `d` : { titres, ajustables, siege (lignes de niveau
// réseau, avec libelle), noms }.
function sectionTitresReseau(d, apres) {
  const peutGerer = peutGererLaPage();
  const moi = monAdresse();
  // Créer à partir d'un titre de niveau promo ou centre (catalogue) : le siège fixe seul ; à partir d'un titre du réseau : la case Directions.
  const siegeFixe = siegeFixePourLesGestes({ titres: getMesTitres(), fondateur: fondateurHorsApercu() });
  const fixeDe = (l) => {
    const t = d.titres.find((x) => Number(x.id) === Number(l.titre_id));
    return t ? t.fixe === true : l.titre_nom === "Siège";
  };
  const lignes = d.titres.map((t) => {
    const actions = [];
    const droits = gestesSurTitre({ titre: t, lieuId: null, ajustable: d.ajustables.has(Number(t.id)), peutGerer });
    if (peutGerer && t.niveau === "reseau" && t.donnable) {
      actions.push(boutonPetit("Donner", icon.plus, `Donner le titre ${t.nom}`, (e) => ouvrirDon({ titre: t, ancre: e.currentTarget, apres })));
    }
    if (peutGerer && droits.ajuster) {
      actions.push(boutonPetit("Ajuster", icon.pencil, `Ajuster le titre ${t.nom}`,
        (e) => ouvrirEditeurTitre({ titre: t, niveau: t.niveau, lieuId: null, porteurs: t.porteurs || 0, apres, ancre: e.currentTarget })));
    }
    if (droits.creer && (t.niveau === "reseau" || siegeFixe)) {
      actions.push(boutonPetit("Créer un titre à partir de celui-ci", icon.plus, `Créer un titre à partir de ${t.nom}`, async () => {
        const nom = await demander({
          titre: "Créer un titre", phrase: `Le nouveau titre reprend les cases de « ${t.nom} ». Donnez-lui un nom.`, libelle: "Nom du titre",
          oui: "Créer", verifier: (v) => v.trim().length > 0, erreur: "Donnez un nom au titre.",
        });
        if (nom == null) return;
        try {
          await avecDelai(creerTitre({ depuis: t.id, nom: nom.trim(), lieuId: null }));
          toast("Titre créé : vous pouvez maintenant l'ajuster.", "success", 5000);
          await apres();
        } catch (e) {
          console.warn("geste refusé", e && e.message);
          toast(phraseDe(e), "error", 7000);
        }
      }));
    }
    if (peutGerer && droits.supprimer) {
      actions.push(boutonPetit("Supprimer", icon.trash, `Supprimer le titre ${t.nom}`, async () => {
        const oui = await confirmer({ titre: "Supprimer ce titre ?", phrase: `Le titre ${t.nom} disparaît du réseau. Personne ne le porte.`, oui: "Supprimer" });
        if (!oui) return;
        try {
          await avecDelai(supprimerTitre(t.id));
          toast("Titre supprimé.", "success", 5000);
          await apres();
        } catch (e) {
          console.warn("geste refusé", e && e.message);
          toast(phraseDe(e), "error", 7000);
        }
      }));
    }
    return el("tr", { "data-titre": String(t.id) },
      el("td", { class: "liste-titre" }, el("div", { class: "equipe-nom" },
        t.fixe ? el("span", { class: "equipe-cadenas", title: "Titre fixe" }, icon.lock()) : null,
        el("strong", {}, t.nom),
        t.fixe ? el("span", { class: "chip equipe-role" }, "Fixe") : null)),
      el("td", {}, LIBELLE_NIVEAU[t.niveau] || t.niveau),
      el("td", {}, pluriel(t.porteurs || 0, "personne")),
      el("td", { class: "liste-actions" }, el("div", { class: "equipe-actions" }, ...actions)));
  });
  const table = tableauEnListe(el("table", { class: "centre-table equipe-table" },
    el("thead", {}, el("tr", {}, ...["Titre", "Niveau", "Porteurs", ""].map((t) => el("th", { scope: "col", "aria-label": t || "Actions" }, t)))),
    el("tbody", {}, ...lignes)));
  const contenu = [el("div", { class: "centre-section-tete" }, el("h3", {}, "Titres du réseau")), el("div", { class: "centre-defile" }, table)];
  if (d.siege.length) {
    const gens = d.siege.map((l) => el("tr", { "data-email": l.email },
      el("td", { class: "liste-titre" }, el("div", { class: "equipe-nom" }, el("strong", {}, l.libelle),
        l.libelle !== l.email ? el("span", { class: "muted equipe-adresse" }, l.email) : null)),
      el("td", {}, el("div", { class: "equipe-pastilles" }, el("span", { class: "chip equipe-role" }, l.titre_nom))),
      el("td", { class: "liste-actions" }, el("div", { class: "equipe-actions" },
        retraitDuSiegeOffert({ peutGerer, fondateur: fondateurHorsApercu(), personne: { email: l.email, niveau: "reseau", fixe: fixeDe(l) }, moi })
          ? boutonPetit("Retirer", icon.trash, `Retirer ${l.libelle} du titre ${l.titre_nom}`,
            (e) => ouvrirRetrait({ centre: null, ligne: l, ancre: e.currentTarget, apres }))
          : null))));
    contenu.push(el("h4", { class: "equipe-sous-titre" }, "Personnes avec un titre du réseau"),
      el("div", { class: "centre-defile" }, tableauEnListe(el("table", { class: "centre-table equipe-table" },
        el("thead", {}, el("tr", {}, ...["Personne", "Titre", ""].map((t) => el("th", { scope: "col", "aria-label": t || "Actions" }, t)))),
        el("tbody", {}, ...gens)))));
  }
  return el("section", { class: "centre-section", "aria-label": "Titres du réseau" }, ...contenu);
}

// ============================================================== Page

export async function renderDirections(container) {
  const jeton = ++rendu;
  clear(container);
  const racine = el("div", { class: "centre equipe-centre directions-siege" });
  container.appendChild(racine);
  const apres = async () => {
    await renderDirections(container);
    const titre = document.querySelector(".directions-siege h2");
    if (titre) titre.focus({ preventScroll: true });
  };
  const entete = (surtitre, sousTitre, actions) => el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, surtitre),
      el("h2", { tabindex: "-1" }, "Directions de centre"),
      sousTitre ? el("p", { class: "subtitle" }, sousTitre) : null),
    actions);

  racine.appendChild(entete("Réseau", "Chargement", null));
  racine.appendChild(el("div", { class: "loading" }, "Chargement"));
  // Les centres et leurs directions sont le cœur de la page (comme avant les titres) ; les titres, les titres ajustables et le journal
  // sont des plus : leur panne laisse la liste d'aujourd'hui, avec un message.
  let lieux, directions;
  const [rLieux, rDirections, rPersonnes, rTitres, rAjustables, rJournalPresent] = await Promise.allSettled([
    lireLieuxDuReseau(), lireDirectionsDuReseau(), lirePersonnesEtTitres(), lireTitresVisibles(null), lireTitresAjustables(null), lireJournalPresent(),
  ]);
  if (jeton !== rendu) return;
  if (rLieux.status !== "fulfilled" || rDirections.status !== "fulfilled") {
    const e = rLieux.status !== "fulfilled" ? rLieux.reason : rDirections.reason;
    console.error("directions du réseau", e);
    clear(racine);
    racine.appendChild(entete("Réseau", null, null));
    racine.appendChild(boiteErreur(phraseDEchec(e), () => renderDirections(container)));
    return;
  }
  lieux = rLieux.value;
  directions = rDirections.value;
  const titresLus = rPersonnes.status === "fulfilled" && rTitres.status === "fulfilled";
  let raisonTitres = null;
  if (!titresLus) {
    raisonTitres = rPersonnes.status !== "fulfilled" ? rPersonnes.reason : rTitres.reason;
    console.error("titres du réseau", raisonTitres);
  }
  if (rAjustables.status !== "fulfilled") console.error("titres ajustables", rAjustables.reason);

  clear(racine);
  const noms = new Map(directions.filter((d) => d.nom).map((d) => [d.email, d.nom]));
  // Avec les titres lus : chaque personne d'un centre porte son titre de niveau centre ; sans, la direction d'aujourd'hui.
  const personnes = titresLus ? rPersonnes.value : null;
  const dessus = titresLus
    ? personnes.filter((l) => l.niveau === "centre" && l.lieu_id != null)
      .map((l) => ({ ...l, email: String(l.email).toLowerCase(), nom: noms.get(String(l.email).toLowerCase()) || null }))
    : directions;
  const centres = directionsParCentre(lieux, dessus);
  const peutGerer = peutGererLaPage();
  const actions = el("div", { class: "centre-actions" },
    centres.length && peutGerer
      ? el("button", { class: "btn primary", type: "button", onClick: (e) => ouvrirInvitationDirection({ lieux, ancre: e.currentTarget, apres, personnes, titresReseau: titresLus ? rTitres.value : null }) },
        icon.plus(), titresLus ? "Inviter une personne" : "Inviter une direction")
      : null,
    peutGerer
      ? el("button", { class: centres.length ? "btn" : "btn primary", type: "button", onClick: (e) => ouvrirAjoutCentre({ ancre: e.currentTarget, apres, titresReseau: titresLus ? rTitres.value : null }) },
        icon.plus(), "Ajouter un centre")
      : null);
  racine.appendChild(entete("Réseau · " + pluriel(centres.length, "centre"), "Les directions de chaque centre", actions));
  if (!titresLus) {
    racine.appendChild(boiteErreur(`${PHRASE_TITRES_ECHEC} ${phraseDeRefus(raisonTitres && raisonTitres.message, raisonTitres && raisonTitres.code)}`,
      () => renderDirections(container)));
  }

  if (!centres.length) {
    racine.appendChild(el("div", { class: "centre-section centre-vide" },
      el("p", {}, PHRASE_SANS_CENTRE),
      el("p", { class: "muted" }, "Ajoutez un centre, puis invitez sa direction.")));
  }
  for (const c of centres) racine.appendChild(sectionCentre(c, lieux, apres, titresLus));
  if (!titresLus) return;
  const titresDesCentres = ajouterTitresDesCentres(racine, centres, jeton);

  const siege = personnes.filter((l) => l.niveau === "reseau")
    .map((l) => {
      const email = String(l.email).toLowerCase();
      return { ...l, email, libelle: noms.get(email) || email };
    });
  racine.appendChild(sectionTitresReseau({
    titres: rTitres.value, ajustables: rAjustables.status === "fulfilled" ? rAjustables.value : new Set(), siege,
  }, apres));
  if (rJournalPresent.status === "fulfilled" && rJournalPresent.value === true) {
    let journal = null;
    try {
      journal = await lireJournalDesDroits(null);
    } catch (e) {
      console.error("journal du réseau", e);
    }
    if (jeton !== rendu) return;
    racine.appendChild(sectionJournal({ journal, noms }, "Journal du réseau"));
  }
  await titresDesCentres;
}
