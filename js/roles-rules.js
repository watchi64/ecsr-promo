/*
 * Rôles côté app (lot 4) : règles pures, sans réseau ni DOM, testées par
 * `node --test tests/roles-rules.test.mjs`. L'autorité reste la base (affectations, fonctions
 * formateur_courant et consorts, en-tête x-apercu-role) : ces fonctions décident seulement de ce que
 * l'app affiche et de ce qu'elle envoie.
 *
 * Les rôles réels sur la promo affichée viennent de mes_promos() (colonne `roles`). Tant que la base n'est
 * pas migrée (ou si les promos n'ont pas pu être chargées), la colonne manque : l'app se replie alors sur
 * `is_admin` et `role` du profil, comme avant le lot 4.
 */
import { phraseDeRefus, PHRASE_ECHEC } from "./espaces-rules.js?v=20261111f";

// Les aperçus : un fondateur les a tous, un membre de l'équipe a celui du stagiaire. Un aperçu ne fait que
// RETIRER des droits : une valeur hors de la liste permise est ignorée.
export const APERCUS = ["formateur", "direction", "siege", "stagiaire"];
export const LIBELLES_APERCU = { formateur: "Formateur", direction: "Direction", siege: "Siège", stagiaire: "Stagiaire" };
export const ENTETE_APERCU = "x-apercu-role";

// Valeur mémorisée ou saisie vers un aperçu connu. L'ancienne valeur « prof » se lit « formateur » ;
// « admin » (le fondateur sans aperçu) et tout inconnu donnent null.
export function normaliserApercu(v) {
  if (v === "prof") return "formateur";
  return APERCUS.includes(v) ? v : null;
}

function rolesDe(promo) {
  return promo && Array.isArray(promo.roles) ? promo.roles : null;
}

// Droits réels, hors aperçu. `equipe` : administrateur, formateur ou direction sur la promo affichée (ceux qui lisent
// la promo entière et gèrent ses stagiaires, ses modules et son équipe).
function droitsReels(profil, promo) {
  if (!profil) return { admin: false, prof: false, stagiaire: false, equipe: false, direction: false };
  const roles = rolesDe(promo);
  if (roles) {
    const formateur = roles.includes("formateur");
    const direction = roles.includes("direction");
    const siege = roles.includes("siege");
    // Le fondateur est administrateur (is_admin) ; un drapeau de fondateur sans is_admin n'ouvre pas l'espace de l'équipe,
    // comme avant le lot 4 (le banc a un tel compte, l'aperçu du fondateur lui reste ouvert).
    const admin = (!!profil.is_founder && !!profil.is_admin) || formateur;
    return {
      admin,
      prof: formateur || direction || siege,
      stagiaire: roles.includes("stagiaire"),
      equipe: admin || direction,
      direction,
    };
  }
  const prof = profil.role === "prof";
  if (!promo) {
    // Aucune promo en place (mes_promos n'a pas répondu, l'app tourne en état dégradé) : la base ne confirme aucun rôle
    // et l'en-tête de promo manque. Un compte de l'équipe y garde sa lecture mais aucune écriture (ni saisie, ni gestion de la promo) : seul le
    // fondateur reste administrateur. Ainsi un ancien formateur sans affectation (is_admin vrai, aucune promo en base) n'obtient jamais
    // d'espace d'équipe aux boutons actifs. Un stagiaire garde son accès (une seule promo, sa fiche).
    const fondateur = !!profil.is_founder && !!profil.is_admin;
    return {
      admin: fondateur,
      prof: prof || !!profil.is_admin,
      stagiaire: profil.role === "stagiaire",
      equipe: fondateur,
      direction: false,
    };
  }
  // Promo sans colonne `roles` (base pas encore migrée) : l'ancien modèle.
  return {
    admin: !!profil.is_admin,
    prof,
    stagiaire: profil.role === "stagiaire",
    equipe: !!profil.is_admin || prof,
    direction: false,
  };
}

// Les aperçus ouverts à cette personne sur cette promo : le fondateur, les quatre ; l'équipe de la promo
// affichée, « stagiaire » ; les autres, aucun.
export function apercusPermis({ profil, promo } = {}) {
  if (!profil) return [];
  if (profil.is_founder) return [...APERCUS];
  return droitsReels(profil, promo).equipe ? ["stagiaire"] : [];
}

function apercuRetenu({ profil, promo, apercu }) {
  const a = normaliserApercu(apercu);
  return a && apercusPermis({ profil, promo }).includes(a) ? a : null;
}

const DROITS_APERCU = {
  formateur: { admin: true, prof: true, stagiaire: false, equipe: true },
  direction: { admin: false, prof: true, stagiaire: false, equipe: true },
  siege: { admin: false, prof: true, stagiaire: false, equipe: false },
  stagiaire: { admin: false, prof: false, stagiaire: true, equipe: false },
};

// Ce que l'app montre : les drapeaux isAdmin (écrire comme un formateur) / isProf / isStagiaire / isEquipe (gérer la
// promo : formateur ou direction) et l'espace de la coquille.
export function droitsAffiches({ profil, promo, apercu } = {}) {
  const a = apercuRetenu({ profil, promo, apercu });
  const d = a ? DROITS_APERCU[a] : droitsReels(profil, promo);
  return {
    admin: !!d.admin,
    prof: !!d.prof,
    stagiaire: !!d.stagiaire,
    equipe: !!d.equipe,
    espace: d.admin || d.prof ? "equipe" : "stagiaire",
  };
}

// Inviter un formateur : la direction du centre de la promo, le fondateur (hors aperçu, ou en aperçu direction).
export function peutInviterFormateur({ profil, promo, apercu } = {}) {
  if (!profil) return false;
  const a = apercuRetenu({ profil, promo, apercu });
  if (a) return a === "direction";
  return !!profil.is_founder || droitsReels(profil, promo).direction;
}

// Retirer l'accès d'un compte de la liste : jamais le fondateur ; un compte du personnel (formateur, direction,
// administrateur) seulement par le fondateur ; un stagiaire, oui (la base décide en dernier).
export function peutRetirerCompte({ cible, fondateur } = {}) {
  if (!cible || cible.is_founder) return false;
  const personnel = cible.role !== "stagiaire" || !!cible.is_admin;
  return personnel ? !!fondateur : true;
}

// Lot G. Les pastilles de rôle d'un compte dans « Personnes avec accès ». Le profil ne porte que l'ancienne colonne `role` : un
// compte invité comme direction ou comme siège y est « prof », donc « formateur ». Le vrai rôle vient de roles_du_personnel()
// (`roles` : [{ email, role }] pour les affectations direction et siège, `null` quand la lecture a échoué ou que la fonction
// manque : l'affichage d'avant, sans message). Un compte du personnel (« formateur » d'après la colonne) qui est direction ou siège
// perd la pastille « formateur », qu'il ne garde que s'il a une fiche formateur (prof_id) : l'app ne voit pas ses promos de
// formateur, cette fiche est le seul indice qu'il l'est aussi. Un stagiaire n'est jamais touché. Rend [{ libelle, classe }], la
// classe étant le suffixe de `role-pill role-…` ; le premier libellé sert au tri. Un « admin » se lit « formateur ».
export function pastillesDuProfil({ profil, roles } = {}) {
  if (!profil) return [];
  const brut = String(profil.role ?? "");
  const base = brut === "prof" || brut === "admin" ? "formateur" : brut;
  const lignes = Array.isArray(roles) ? roles : [];
  const adresse = String(profil.email ?? "").toLowerCase();
  const a = (role) => lignes.some((l) => l && String(l.email ?? "").toLowerCase() === adresse && l.role === role);
  const direction = base === "formateur" && a("direction");
  const siege = base === "formateur" && a("siege");
  if (!direction && !siege) return [{ libelle: base, classe: brut }];
  return [
    ...(direction ? [{ libelle: "direction", classe: "prof" }] : []),
    ...(siege ? [{ libelle: "siège", classe: "prof" }] : []),
    ...(profil.prof_id != null ? [{ libelle: "formateur", classe: "prof" }] : []),
  ];
}

// La liste « Personnes avec accès », triée par premier rôle affiché puis par adresse : [{ profil, pastilles }]. Ne change pas qui y
// figure.
export function listeAcces({ profils, roles } = {}) {
  return (Array.isArray(profils) ? profils : [])
    .map((profil) => ({ profil, pastilles: pastillesDuProfil({ profil, roles }) }))
    .sort((x, y) => (x.pastilles[0]?.libelle ?? "").localeCompare(y.pastilles[0]?.libelle ?? "")
      || String(x.profil.email ?? "").localeCompare(String(y.profil.email ?? "")));
}

// Phrase d'un refus d'invitation : la base préfixe ses messages par « invitation: », que l'on retire. Tant que la
// fonction inviter_compte n'existe pas dans la base (code PGRST202, ou message « Could not find the function »),
// l'invitation est dite indisponible plutôt que de montrer l'erreur technique.
export const MESSAGE_INVITATION_INDISPONIBLE = "L'invitation n'est pas disponible pour le moment.";
export function messageInvitation(message, code) {
  const brut = String(message ?? "");
  if (code === "PGRST202" || /could not find the function/i.test(brut)) return MESSAGE_INVITATION_INDISPONIBLE;
  const phrase = phraseDeRefus(brut, code);
  return phrase === PHRASE_ECHEC ? "Erreur d'invitation" : phrase;
}

// Phrase d'une invitation qui a transformé le compte d'un ancien stagiaire (sans fiche) en compte du personnel : au vouvoiement
// (texte destiné à l'équipe). Le compte existait déjà : la personne se connecte comme avant, avec son mot de passe.
export function phraseCompteTransforme(role) {
  const quoi = role === "direction" ? "un compte de la direction du centre"
    : role === "siege" ? "un compte du siège du réseau"
    : "un compte de formateur";
  return `Le compte de cet ancien stagiaire est devenu ${quoi}. La personne se connecte comme avant, avec son mot de passe.`;
}

// Phrase d'une invitation acceptée par la base, d'après ce que rend inviter_compte : `cree` (le profil vient d'être créé) et
// `affecte` (nombre d'affectations ajoutées). « Rien n'a changé » seulement quand ni l'un ni l'autre : un compte qui existait
// et vient de gagner une promo a bien changé (relecture finale, I1). `ton` : le type du toast.
export function messageInvitationReussie({ resultat, email } = {}) {
  const r = resultat || {};
  // Suite du lot 5 : l'adresse d'un ancien stagiaire sans fiche a vu son compte transformé en compte du personnel.
  if (r.transforme === true) return { texte: phraseCompteTransforme(r.role), ton: "success" };
  if (r.cree !== false) {
    return { texte: "Ajouté à la liste des invitations : " + email + ". Partagez-lui l'URL.", ton: "success" };
  }
  if (Number(r.affecte) > 0) {
    const quoi = r.role === "direction" ? "ajouté à la direction du centre"
      : r.role === "siege" ? "rattaché au siège du réseau"
      : "ajouté comme formateur de cette promo";
    return { texte: `Déjà inscrit : ${quoi}.`, ton: "success" };
  }
  // Une base qui ne dit pas `affecte` ne permet pas d'affirmer que rien n'a changé.
  if (r.affecte == null) return { texte: "Ce compte existe déjà.", ton: "info" };
  return { texte: "Ce compte existe déjà : rien n'a changé.", ton: "info" };
}

// Étiquette du rôle (lue par libelleConnexion, ci-dessous) : le rôle réel sur la promo affichée (colonne `roles` de mes_promos), et sa
// couleur (classe du point : admin, prof ou stagiaire). Tant que la base ne donne pas les rôles, l'ancien `role` du
// profil (profil effectif de la promo). Le fondateur sans rôle sur la promo garde « admin » (relecture finale, M4).
export function etiquetteBadge({ profil, promo } = {}) {
  if (!profil) return { libelle: "", classe: "" };
  const roles = rolesDe(promo);
  if (roles) {
    if (roles.includes("formateur")) return { libelle: "formateur", classe: "prof" };
    if (roles.includes("direction")) return { libelle: "direction", classe: "prof" };
    if (roles.includes("siege")) return { libelle: "siège", classe: "prof" };
    if (roles.includes("stagiaire")) return { libelle: "stagiaire", classe: "stagiaire" };
    if (profil.is_founder) return { libelle: "admin", classe: "admin" };
    return { libelle: "", classe: "" };
  }
  if (profil.role === "admin") return { libelle: "admin", classe: "admin" };
  if (profil.role === "prof") return { libelle: "formateur", classe: "prof" };
  if (profil.role === "stagiaire") return { libelle: "stagiaire", classe: "stagiaire" };
  return { libelle: "", classe: "" };
}

// Le rôle que dit le pied de page (« connecté en tant que … ») : celui de l'aperçu « Voir en tant que » s'il y en a un ; sinon
// « fondateur » pour le fondateur (qui peut aussi être stagiaire d'une promo : hors aperçu, il est dans l'espace de l'équipe) ;
// sinon le rôle réel sur la promo affichée, dans l'ordre du badge (formateur, direction, siège, stagiaire). Avant l'audit du
// 09/11 (A8), Aujourd'hui écrivait « formateur » pour tout le monde.
export function libelleConnexion({ profil, promo, apercu } = {}) {
  if (!profil) return "";
  const a = apercuRetenu({ profil, promo, apercu });
  if (a) return LIBELLES_APERCU[a].toLowerCase() + " (aperçu)";
  if (profil.is_founder) return "fondateur";
  const { libelle } = etiquetteBadge({ profil, promo });
  if (libelle === "admin") return profil.is_founder ? "fondateur" : "formateur";
  if (!libelle && profil.is_founder) return "fondateur";
  return libelle;
}

// Phrase du refus à la porte, quand le compte n'a aucune promo. Depuis le lot 5, le siège et la direction entrent sans promo
// (porteSansPromo, js/espaces-rules.js) : le refus ne concerne plus que les autres comptes, et une seule phrase leur suffit.
// Les rôles que les appelants du lot 4 lui passent n'y changent plus rien. Formule neutre, ni tu ni vous (décision du 10/11).
export const MESSAGE_SANS_PROMO = "Aucune promo n'est associée à ce compte : la direction du centre ou un formateur peut l'ajouter à une promo.";
export function messageSansPromo() {
  return MESSAGE_SANS_PROMO;
}
