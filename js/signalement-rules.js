// Signaler un problème (spec 2026-10-28) : les règles seulement. Lecture de l'identifiant du navigateur,
// classe d'appareil, contexte joint d'office et ses deux présentations (la ligne résumée de la fenêtre, le
// détail en mots simples), contrôle du message, libellés des statuts, pastilles, message du démarrage,
// journal des erreurs, réduction de la capture, phrase d'un refus du serveur, adresse sûre pour un lien.
// Module pur, sans DOM ni stockage : testé en node.

import { libellePastille } from "./nouveautes.js?v=20261028a";

// Bornes de la spec (§ 7) : la base les vérifie aussi, dans signaler_probleme.
export const MIN_MESSAGE = 3;
export const LIMITE_MESSAGE = 2000;
export const LIMITE_CAPTURE = 700000;
export const COTE_MAX_CAPTURE = 1600;
export const MAX_ERREURS = 5;
export const LIMITE_ERREUR = 300;
export const MAX_MES_SIGNALEMENTS = 10;

// Seuils de la navigation (css/navigation.css) : téléphone sous 700 px, ordinateur à partir de 1 080 px.
export function classeAppareil(largeur) {
  if (largeur < 700) return "téléphone";
  if (largeur < 1080) return "tablette";
  return "ordinateur";
}

const version = (ua, motif, mineure) => {
  const m = ua.match(motif);
  if (!m) return null;
  return mineure ? m[1] : m[1].split(".")[0];
};

// Navigateur et système lus dans l'identifiant du navigateur. L'ordre compte : Samsung Internet et Edge
// se disent aussi Chrome, Chrome sur iPhone se dit aussi Safari. Un iPad récent se présente comme un
// Mac : c'est l'écran tactile (maxTouchPoints) qui le trahit.
export function lireNavigateur(ua, { maxTouchPoints = 0 } = {}) {
  const texte = String(ua ?? "");
  let navigateur = "inconnu";
  const samsung = version(texte, /SamsungBrowser\/(\d+(?:\.\d+)?)/, true);
  const edge = version(texte, /(?:Edg|EdgA|EdgiOS)\/(\d+)/);
  const firefox = version(texte, /(?:Firefox|FxiOS)\/(\d+)/);
  const chrome = version(texte, /(?:CriOS|Chrome)\/(\d+)/);
  const safari = /Safari\//.test(texte) ? version(texte, /Version\/(\d+(?:\.\d+)?)/, true) : null;
  if (samsung) navigateur = `Samsung Internet ${samsung}`;
  else if (edge) navigateur = `Edge ${edge}`;
  else if (firefox) navigateur = `Firefox ${firefox}`;
  else if (chrome) navigateur = `Chrome ${chrome}`;
  else if (safari) navigateur = `Safari ${safari}`;

  let systeme = "inconnu";
  const ios = texte.match(/(iPhone|iPad|iPod)?[^)]*?OS (\d+)_(\d+)/);
  const android = texte.match(/Android (\d+(?:\.\d+)?)/);
  if (/iPad/.test(texte) && ios) systeme = `iPadOS ${ios[2]}.${ios[3]}`;
  else if (/iPhone|iPod/.test(texte) && ios) systeme = `iOS ${ios[2]}.${ios[3]}`;
  else if (android) systeme = `Android ${android[1]}`;
  else if (/Windows/.test(texte)) systeme = "Windows";
  else if (/CrOS/.test(texte)) systeme = "ChromeOS";
  else if (/Macintosh|Mac OS X/.test(texte)) systeme = maxTouchPoints > 1 ? "iPadOS" : "macOS";
  else if (/Linux/.test(texte)) systeme = "Linux";
  return { navigateur, systeme };
}

// Le contexte enregistré avec le signalement (spec § 6), à partir de ce que la fenêtre relève à son
// ouverture. Nom, adresse, rôle et promo n'y sont pas : la base les pose elle-même.
export function assemblerContexte(releve) {
  const r = releve || {};
  const adresse = String(r.adresse ?? "");
  const largeur = Math.round(Number(r.largeur) || 0);
  const hauteur = Math.round(Number(r.hauteur) || 0);
  const { navigateur, systeme } = lireNavigateur(r.ua, { maxTouchPoints: r.maxTouchPoints });
  return {
    adresse,
    page: (adresse.match(/^#\/([^/?#]*)/) || [])[1] || "",
    titre: String(r.titre ?? "").trim().slice(0, 120),
    version: String(r.version ?? ""),
    navigation: r.navigation === "nouvelle" ? "nouvelle" : "ancienne",
    espace: r.espace || null,
    apercu: r.apercu || null,
    appareil: classeAppareil(largeur),
    tactile: !!r.tactile,
    ecran: `${largeur} × ${hauteur}`,
    densite: Number(r.densite) || 1,
    orientation: hauteur >= largeur ? "portrait" : "paysage",
    navigateur,
    systeme,
    agent: String(r.ua ?? "").slice(0, 500),
    installee: !!r.installee,
    langue: String(r.langue ?? ""),
    en_ligne: r.enLigne !== false,
    heure_appareil: String(r.heure ?? ""),
    fuseau: String(r.fuseau ?? ""),
    erreurs: Array.isArray(r.erreurs) ? r.erreurs.slice(-MAX_ERREURS) : [],
  };
}

const enTexte = (v) => (v === null || v === undefined ? "" : typeof v === "string" ? v : String(v));

// Le contexte tel qu'il est lu en base, ramené à sa forme : la base ne vérifie que « un objet de 16 Ko au
// plus », et un envoi fait hors de l'app peut y mettre n'importe quoi. Chaque champ connu devient une chaîne
// (ou un nombre, un booléen), les erreurs ne gardent que des objets : l'affichage ne peut plus lever.
export function normaliserContexte(c) {
  const o = c && typeof c === "object" && !Array.isArray(c) ? c : {};
  const erreurs = (Array.isArray(o.erreurs) ? o.erreurs : [])
    .filter((e) => e && typeof e === "object" && !Array.isArray(e))
    .slice(-MAX_ERREURS)
    .map((e) => ({ a: enTexte(e.a), type: enTexte(e.type), message: enTexte(e.message).slice(0, LIMITE_ERREUR), source: enTexte(e.source) }));
  return {
    adresse: enTexte(o.adresse), page: enTexte(o.page), titre: enTexte(o.titre), version: enTexte(o.version),
    navigation: o.navigation === "nouvelle" ? "nouvelle" : "ancienne",
    espace: o.espace ? enTexte(o.espace) : null, apercu: o.apercu ? enTexte(o.apercu) : null,
    appareil: enTexte(o.appareil), tactile: o.tactile === true, ecran: enTexte(o.ecran), densite: Number(o.densite) || 1,
    orientation: enTexte(o.orientation), navigateur: enTexte(o.navigateur), systeme: enTexte(o.systeme),
    agent: enTexte(o.agent), installee: o.installee === true, langue: enTexte(o.langue), en_ligne: o.en_ligne !== false,
    heure_appareil: enTexte(o.heure_appareil), fuseau: enTexte(o.fuseau), erreurs,
  };
}

// L'appareil tel qu'on le nomme : « iPhone », « iPad », « Mac », sinon la classe d'appareil suivie du
// premier mot du système (« ordinateur Windows », « téléphone Android »).
function appareilLisible(c) {
  const systeme = String(c.systeme || "");
  if (systeme.startsWith("iPadOS") || (systeme.startsWith("iOS") && c.appareil !== "téléphone")) return "iPad";
  if (systeme.startsWith("iOS")) return "iPhone";
  if (systeme === "macOS") return "Mac";
  if (!systeme || systeme === "inconnu") return c.appareil;
  return `${c.appareil} ${systeme.split(" ")[0]}`;
}

const deuxChiffres = (n) => String(n).padStart(2, "0");

// La ligne « Joint d'office : ... » de la fenêtre : page, appareil, navigateur (sans sa version mineure),
// heure (celle de `maintenant`, l'envoi étant immédiat).
export function resumeContexte(contexte, maintenant) {
  const c = normaliserContexte(contexte);
  const morceaux = [`page ${c.titre || c.adresse || "inconnue"}`, appareilLisible(c)];
  if (c.navigateur && c.navigateur !== "inconnu") morceaux.push(c.navigateur.replace(/(\d+)\.\d+$/, "$1"));
  morceaux.push(`à ${maintenant.getHours()} h ${deuxChiffres(maintenant.getMinutes())}`);
  return morceaux.filter(Boolean).join(", ");
}

// Le détail du contexte, ligne à ligne et en mots simples (« Voir le détail » de la fenêtre et carte du
// fondateur). L'aperçu n'a de ligne que lorsqu'il est actif ; les erreurs, comptées ici, sont listées à part.
export function detailContexte(contexte) {
  const c = normaliserContexte(contexte);
  const lignes = [
    ["Page", c.titre ? `${c.titre} (${c.adresse})` : (c.adresse || "inconnue")],
    ["Version de l'app", c.version || "inconnue"],
    ["Navigation", c.navigation === "nouvelle" ? `nouvelle, espace ${c.espace === "equipe" ? "équipe" : "stagiaire"}` : "ancienne"],
  ];
  if (c.apercu) lignes.push(["Aperçu", c.apercu === "prof" ? "Formateur" : c.apercu === "stagiaire" ? "Stagiaire" : String(c.apercu)]);
  const nbErreurs = c.erreurs.length;
  lignes.push(
    ["Appareil", c.tactile ? `${c.appareil}, tactile` : c.appareil],
    ["Écran", `${c.ecran}, densité ${String(c.densite).replace(".", ",")}, ${c.orientation}`],
    ["Navigateur", c.navigateur],
    ["Système", c.systeme],
    ["App installée", c.installee ? "oui" : "non"],
    ["Langue", c.langue || "inconnue"],
    ["Connexion", c.en_ligne ? "en ligne" : "hors ligne"],
    ["Erreurs récentes", nbErreurs ? String(nbErreurs) : "aucune"],
  );
  return lignes;
}

// Nombre écrit à la française, espaces insécables ramenées à des espaces simples.
const enFrancais = (n) => n.toLocaleString("fr-FR").replace(/\s/g, " ");

// Message prêt à partir, ou la phrase à afficher sous le champ. Compté en points de code, comme
// char_length côté base (un émoji compte pour un caractère des deux côtés).
export function verifierMessage(texte) {
  const message = String(texte ?? "").trim();
  const n = [...message].length;
  if (n < MIN_MESSAGE) return { ok: false, erreur: "Écris quelques mots sur ce qui se passe." };
  if (n > LIMITE_MESSAGE) return { ok: false, erreur: `${enFrancais(LIMITE_MESSAGE)} caractères au plus (tu en as ${enFrancais(n)}).` };
  return { ok: true, message };
}

const STATUTS = {
  nouveau: { personne: "Reçu", fondateur: "Nouveau" },
  en_cours: { personne: "En cours", fondateur: "En cours" },
  regle: { personne: "Réglé", fondateur: "Réglé" },
  non_retenu: { personne: "Pas retenu", fondateur: "Pas retenu" },
};

// Libellé d'un statut, pour la personne qui a signalé ou pour le fondateur.
export function libelleStatut(statut, pour) {
  const s = STATUTS[statut];
  return s ? s[pour === "fondateur" ? "fondateur" : "personne"] : String(statut ?? "");
}

// Pastille des entrées « Signaler un problème » et nom accessible du bouton : chez le fondateur hors
// aperçu, les signalements nouveaux ; chez les autres, leurs signalements qui ont avancé sans être vus.
export function pastilleSignalement({ fondateur, nouveaux = 0, suivis = 0 }) {
  const n = fondateur ? nouveaux : suivis;
  const texte = libellePastille(n);
  if (!texte) return { texte, nom: "Signaler un problème" };
  const quoi = fondateur
    ? (n === 1 ? "nouveau signalement" : "nouveaux signalements")
    : (n === 1 ? "signalement a avancé" : "signalements ont avancé");
  return { texte, nom: `Signaler un problème, ${n} ${quoi}` };
}

// Message affiché une fois à l'ouverture de l'app, ou null.
export function messageDemarrage({ fondateur, nouveaux = 0, suivis = 0 }) {
  if (fondateur) {
    if (nouveaux <= 0) return null;
    return nouveaux === 1 ? "1 nouveau problème signalé." : `${nouveaux} nouveaux problèmes signalés.`;
  }
  if (suivis <= 0) return null;
  const sujet = suivis === 1 ? "Ton signalement a avancé" : "Tes signalements ont avancé";
  return `${sujet} : ouvre « Signaler un problème » pour voir la suite.`;
}

// Une erreur du journal (js/journal-erreurs.js) : heure de l'appareil, type (« erreur », « promesse »,
// « console »), message tronqué, fichier et ligne.
export function entreeErreur({ type, message, source, quand }) {
  const d = quand instanceof Date ? quand : new Date();
  return {
    a: `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}:${deuxChiffres(d.getSeconds())}`,
    type: String(type ?? "erreur"),
    message: String(message ?? "").slice(0, LIMITE_ERREUR),
    source: String(source ?? "").slice(0, 120),
  };
}

// Le journal avec une erreur de plus : les MAX_ERREURS dernières seulement.
export function ajouterErreur(journal, entree) {
  return [...(journal || []), entree].slice(-MAX_ERREURS);
}

// Taille de la capture réduite : le côté long ramené à `coteMax`, proportions gardées, jamais agrandie.
export function dimensionsReduites(largeur, hauteur, coteMax = COTE_MAX_CAPTURE) {
  const cote = Math.max(largeur, hauteur);
  if (cote <= coteMax) return { largeur, hauteur };
  const f = coteMax / cote;
  return { largeur: Math.round(largeur * f), hauteur: Math.round(hauteur * f) };
}

// Phrase d'un refus de la base (« signalement: <phrase> »), ou null pour une autre erreur.
export function phraseErreur(message) {
  const texte = String(message ?? "");
  const i = texte.indexOf("signalement:");
  if (i < 0) return null;
  return texte.slice(i + "signalement:".length).trim() || null;
}

// Adresse de l'app utilisable dans un lien (« Ouvrir la page ») : « #/ » suivi de segments simples ; tout
// le reste (autre protocole, guillemet, espace) est refusé.
export function adresseSure(adresse) {
  const texte = String(adresse ?? "");
  return /^#\/[A-Za-z0-9_./-]*$/.test(texte) ? texte : null;
}
