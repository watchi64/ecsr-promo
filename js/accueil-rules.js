// Accueil (refonte, lot 2A) : les règles seulement. Où en est un événement par rapport à aujourd'hui
// (à venir, en cours, passé), le texte qui le dit, et la ligne « Promo <nom> · semaine <n> » sous la
// salutation. Module pur, sans DOM ni stockage : testé en node. Le prochain rendez-vous et l'à-faire de l'accueil
// du stagiaire (lot 2B) les lisent.
import { examenDemarrable, tempsRestantMs, formatTempsRestant } from "./qcm-exam-rules.js?v=20261112e";
import { pluriel } from "./nombres.js?v=20261112e";
import { lundiDe } from "./dates.js?v=20261112e";

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

// Numéro d'un jour de calendrier (jours écoulés depuis le 01/01/1970) : « AAAA-MM-JJ », ou une date dont on
// lit le jour LOCAL. Les jours se comptent entre numéros entiers : ni l'heure ni un changement d'heure (jour
// de 23 h ou de 25 h) ne décalent un résultat. NaN quand la valeur n'est pas un jour qui existe.
function numeroDeJour(valeur) {
  if (valeur instanceof Date) {
    return Date.UTC(valeur.getFullYear(), valeur.getMonth(), valeur.getDate()) / MS_PAR_JOUR;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof valeur === "string" ? valeur : "");
  if (!m) return NaN;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(annee, mois - 1, jour);
  const relu = new Date(ms);   // 2026-02-30 ou 2026-13-01 ne sont pas des jours : Date.UTC les reporterait
  return relu.getUTCFullYear() === annee && relu.getUTCMonth() === mois - 1 && relu.getUTCDate() === jour ? ms / MS_PAR_JOUR : NaN;
}

// Où en est un événement un jour donné. `debut` et `fin` : « AAAA-MM-JJ » ; `fin` absente (ou nulle, ou vide)
// vaut `debut`, un événement d'un seul jour. `aujourdhui` : « AAAA-MM-JJ », ou une date (son jour local).
//   « a-venir » : il n'a pas commencé, ou commence aujourd'hui ; `jours` : les jours jusqu'à son début (0 : aujourd'hui) ;
//   « en-cours » : commencé avant aujourd'hui et pas fini ; `jours` : les jours jusqu'à sa fin (0 : il finit aujourd'hui) ;
//   « passe » : fini avant aujourd'hui ; `jours` : négatif (les jours jusqu'à sa fin), jamais montré.
// Le premier jour d'un événement de plusieurs jours se dit donc « Aujourd'hui », le lendemain « En cours ».
// Une date illisible lève une TypeError : mieux vaut un échec visible qu'un décompte inventé.
export function etatEvenement({ debut, fin }, aujourdhui) {
  const premier = numeroDeJour(debut);
  const dernier = fin ? numeroDeJour(fin) : premier;
  const ce = numeroDeJour(aujourdhui);
  if ([premier, dernier, ce].some(Number.isNaN)) {
    throw new TypeError(`etatEvenement : date illisible (début ${debut}, fin ${fin}, jour ${aujourdhui})`);
  }
  if (ce > dernier) return { etat: "passe", jours: dernier - ce };
  if (ce > premier) return { etat: "en-cours", jours: dernier - ce };
  return { etat: "a-venir", jours: premier - ce };
}

// Le texte d'un état d'événement (le résultat d'etatEvenement). Un événement passé n'a pas de texte : l'accueil
// montre le premier événement qui n'est pas passé. Jamais un nombre négatif : `jours` doit être un entier positif
// ou nul, sinon rien n'est dit.
export function libelleDecompte(decompte) {
  const { etat, jours } = decompte || {};
  if (!Number.isInteger(jours) || jours < 0) return "";
  if (etat === "a-venir") {
    if (jours === 0) return "Aujourd'hui";
    if (jours === 1) return "Demain";
    return `Dans ${jours} jours`;
  }
  if (etat === "en-cours") {
    if (jours === 0) return "En cours, fin aujourd'hui";
    if (jours === 1) return "En cours, fin demain";
    return `En cours, fin dans ${jours} jours`;
  }
  return "";
}

// Numéro du lundi de la semaine d'un jour donné par son numéro (voir numeroDeJour) ; le lundi vient de lundiDe (js/dates.js).
const numeroDuLundi = (numero) => numeroDeJour(lundiDe(new Date(numero * MS_PAR_JOUR).toISOString().slice(0, 10)));

// « Promo Nîmes, mars 2026 · semaine 31 de formation » : la semaine 1 est celle du premier jour de la promo (du lundi au
// dimanche), la suivante commence le lundi. Pas de numéro quand il ne dirait rien de vrai : promo pas encore
// commencée, promo finie (après sa date de fin), dates absentes ou illisibles ; le nom seul alors, et rien sans
// nom (promo pas encore chargée). `promo` : la ligne de la promo (nom, date_debut, date_fin). `aujourdhui` :
// « AAAA-MM-JJ » ou une date.
export function lignePromo(promo, aujourdhui) {
  const nom = typeof promo?.nom === "string" ? promo.nom.trim() : "";
  if (!nom) return "";
  const debut = numeroDeJour(promo.date_debut);
  const fin = promo.date_fin ? numeroDeJour(promo.date_fin) : Infinity;
  const ce = numeroDeJour(aujourdhui);
  if (!(ce >= debut && ce <= fin)) return `Promo ${nom}`;
  return `Promo ${nom} · semaine ${1 + (numeroDuLundi(ce) - numeroDuLundi(debut)) / 7} de formation`;
}

// === Accueil du stagiaire (lot 2B) ===

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
  "septembre", "octobre", "novembre", "décembre"];

// « jeudi 5 novembre » : le jour d'un « AAAA-MM-JJ » existant. Le jour se lit en UTC, comme numeroDeJour : aucun
// fuseau ne le décale.
function jourEnToutesLettres(iso) {
  const d = new Date(numeroDeJour(iso) * MS_PAR_JOUR);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

// Le prochain rendez-vous de l'accueil : le premier examen ou stage qui n'est pas passé (un stage commencé compte :
// il est « en cours »), à défaut le premier événement qui n'est pas passé ; un jour férié n'est jamais un rendez-vous.
// `evenements` : les lignes de l'agenda (title, type, date_start, date_end), dans n'importe quel ordre. Un événement
// à la date illisible est laissé de côté plutôt que de masquer les autres. `date` : le jour de DÉBUT, en toutes lettres ;
// `libelle` : le décompte (libelleDecompte). Rien à venir : null.
export function prochainRendezVous(evenements, aujourdhui) {
  const restants = [];
  for (const e of Array.isArray(evenements) ? evenements : []) {
    if (!e || e.type === "ferie") continue;
    let decompte;
    try { decompte = etatEvenement({ debut: e.date_start, fin: e.date_end }, aujourdhui); }
    catch (err) { continue; }
    if (decompte.etat !== "passe") restants.push({ e, decompte, debut: numeroDeJour(e.date_start) });
  }
  // Tri stable par début : l'ordre de l'agenda départage les événements d'un même jour.
  restants.sort((a, b) => a.debut - b.debut);
  const choisi = restants.find((r) => r.e.type === "examen" || r.e.type === "stage") || restants[0];
  if (!choisi) return null;
  return { titre: choisi.e.title, date: jourEnToutesLettres(choisi.e.date_start), libelle: libelleDecompte(choisi.decompte) };
}

// Ce qu'il reste à faire au stagiaire, au plus 4 lignes, dans cet ordre :
//   1. un examen ouvert qu'il n'a pas passé (une tentative en mode « examen » le clôt ; un entraînement non) ;
//   2. le QCM d'un thème vu cette semaine au planning, jamais tenté (tout mode) ; le thème se retrouve par son titre
//      exact (`sujetsDeLaSemaine` : les titres déjà découpés, l'ordre du planning) ; un QCM qui a déjà sa ligne
//      d'examen n'en reçoit pas une seconde ;
//   3. le dossier professionnel tant que les 6 exemples ne sont pas remplis.
// `modules` : { qcm, dp } ; un module fermé (false) retire ses lignes. Une donnée qui n'a pas pu être lue
// (`exemplesDossier` nul) ne produit aucune ligne : mieux vaut se taire qu'inventer un travail.
// Chaque ligne : { cle, titre, detail, route, sousOnglet } ; la page en fait un lien.
export function aFaireStagiaire({ qcm, themes, tentatives, sujetsDeLaSemaine, exemplesDossier, modules, now } = {}) {
  const ouvert = (cle) => !modules || modules[cle] !== false;
  const lignes = [];
  const maintenant = now ?? Date.now();
  const liste = (v) => (Array.isArray(v) ? v : []);
  const passes = liste(tentatives);

  if (ouvert("qcm")) {
    const avecQuestions = liste(qcm).filter((q) => q && q.nb_questions > 0);
    const titreDuTheme = (q) => liste(themes).find((t) => t.id === q.theme_id)?.titre ?? q.titre;
    const dejaPasse = (q) => passes.some((t) => t.qcm_id === q.id && t.mode === "examen");
    const examens = avecQuestions.filter((q) => examenDemarrable(q, maintenant) && !dejaPasse(q));
    for (const q of examens) {
      const reste = tempsRestantMs(q, maintenant);
      lignes.push({
        cle: `examen-${q.id}`, titre: `Examen ouvert : ${titreDuTheme(q)}`,
        detail: reste == null ? "Sans limite de temps" : `Ferme dans ${formatTempsRestant(reste)}`,
        route: "themes", sousOnglet: "qcm",
      });
    }
    const vus = new Set(examens.map((q) => q.id));
    for (const sujet of liste(sujetsDeLaSemaine)) {
      const theme = liste(themes).find((t) => t.titre === sujet);
      const q = theme && avecQuestions.find((x) => x.theme_id === theme.id);
      if (!q || vus.has(q.id) || passes.some((t) => t.qcm_id === q.id)) continue;
      vus.add(q.id);
      lignes.push({
        cle: `qcm-${q.id}`, titre: `QCM du thème : ${theme.titre}`,
        detail: `Pas encore fait · ${pluriel(q.nb_questions, "question")}`,
        route: "themes", sousOnglet: "qcm",
      });
    }
  }
  if (ouvert("dp") && Number.isInteger(exemplesDossier) && exemplesDossier < 6) {
    lignes.push({
      cle: "dossier", titre: "Dossier professionnel", detail: `${pluriel(exemplesDossier, "exemple")} sur 6`,
      route: "mon-suivi", sousOnglet: "dp",
    });
  }
  // Le livret EPCF n'a pas de ligne : ce sont les formateurs qui le remplissent, le stagiaire le consulte en lecture seule
  // (audit du 09/11, A4). S'il devait un jour en remplir une part (question posée à Timy), la ligne reviendrait avec cette action.
  return lignes.slice(0, 4);
}

// La phrase d'une demi-journée de l'Accueil où le stagiaire n'est sur aucune carte du planning (ni au tableau, ni en voiture,
// ni en salle) : sans elle, la rangée liste les activités des autres sans lui dire où il est (audit du 09/11, A3). Seules les
// cartes de salle et de voiture nomment les stagiaires (estNominative, plus bas) ; un cours, un contrôle, une autre activité ou
// une autonomie qui ne nomme personne concerne toute la promo : leur présence suffit à taire la phrase. Rien non plus quand une carte le nomme, quand la demi-journée est
// vide (la page le dit déjà) ou sans fiche de stagiaire (`moi` nul, aperçu).
const CARTES_NOMINATIVES = ["salle", "voiture"];
export function sansPlaceDansLaDemi({ demi, cartes, moi } = {}) {
  const liste = (Array.isArray(cartes) ? cartes : []).filter(Boolean);
  if (moi == null || !liste.length || liste.some((c) => c.moi)) return null;
  if (!liste.every(estNominative)) return null;
  return (demi === "aprem" ? "Cet après-midi" : "Ce matin") + ", ton nom ne figure sur aucune activité du planning.";
}

// « À retenir » : les quatre règles courtes de l'app, lues par Mes préférences (section Informations). La dernière dit
// les pages par leur nom, celui de la barre (Notes n'est pas un onglet du stagiaire, les dates sont les Dates clés).
// `[{ gras, suite }]` : le début en gras, puis la suite de la phrase. `selon(tu, vous)` choisit le texte du public :
// Mes préférences, que l'équipe lit aussi, passe `selonPublic` de js/auth-admin.js (décision du 10/11 : les stagiaires
// tutoyés, l'équipe vouvoyée) ; sans lui, le tutoiement. Module pur : l'aiguilleur vient de l'appelant.
export function pointsARetenir(selon = (tu) => tu) {
  return [
    selon({ gras: "Ton identité est liée à ton e-mail.", suite: " Tes ajouts de passages et tes notes sont signés automatiquement." },
      { gras: "Votre identité est liée à votre e-mail.", suite: " Vos ajouts de passages et vos notes sont signés automatiquement." }),
    selon({ gras: "Tu ajoutes et corriges tes passages toi-même.", suite: " Pour en supprimer un, demande à un formateur." },
      { gras: "Les stagiaires ajoutent et corrigent leurs passages eux-mêmes.", suite: " Pour en supprimer un, ils s'adressent à un formateur." }),
    { gras: "Tout est tracé.", suite: " Chaque modification (passage, note, planning) est historisée avec son auteur." },
    { gras: "Ctrl + Z annule la dernière action.", suite: " Sur les notes, les passages, les thèmes et les dates clés." },
  ];
}

// « Bonjour » le matin, « Bon après-midi », « Bonsoir » de 18 h à 6 h : la salutation de l'Accueil, pour une heure locale (0 à 23).
export function salutationDe(heure) {
  if (heure < 6) return "Bonsoir";
  if (heure < 12) return "Bonjour";
  if (heure < 18) return "Bon après-midi";
  return "Bonsoir";
}

// La nature d'une carte pour savoir qui elle nomme : une salle ou une voiture « Groupe (autonomie) » (sans formateur) reste
// une salle ou une voiture ; son genre seul dirait « autonomie ».
const NATURE_DE_L_ACTIVITE = { "Pédagogie salle": "salle", "Voiture (conduite)": "voiture" };
function natureDe(c) {
  return NATURE_DE_L_ACTIVITE[c.activite] || c.genre;
}
function nommeQuelquUn(c) {
  return ["tableau", "eleves", "conducteurs"].some((k) => Array.isArray(c[k]) && c[k].length > 0);
}
// Une carte qui nomme ses stagiaires : une salle ou une voiture. Une salle ou une voiture en autonomie qui ne nomme personne
// est un temps de travail de toute la promo, comme un cours.
function estNominative(c) {
  if (!CARTES_NOMINATIVES.includes(natureDe(c))) return false;
  return c.genre !== "autonomie" || nommeQuelquUn(c);
}

// === La carte « Aujourd'hui » de l'Accueil du stagiaire ===
// Piste C, choisie par Timy le 11/11 sur maquettes (« j'ai du mal à savoir qui c'est qui passe au tableau, qui est l'élève »,
// la carte d'avant listait toute la promo) : une phrase par activité qui concerne le stagiaire, son rôle dit au verbe
// (« Tu passes au tableau », « Tu enseignes en voiture »), puis une ligne de détail qui nomme chacun par sa place
// (« à Emma L., élève bénévole, avec Marc »). Les salles et les voitures qui ne le nomment pas (la voiture des autres
// pendant qu'il est en salle) ne s'affichent pas : elles sont dans le Planning. Un cours, un contrôle, une autre activité
// ou une autonomie qui ne nomme personne concerne toute la promo : affiché.
// Sans fiche de stagiaire (`moi` nul, aperçu « Voir en tant que ») : toutes les activités, au neutre.
// Le libellé court « Toi au tableau » reste celui de la grille de la semaine (js/journee-rules.js), où la place est comptée.
// `cartes` : celles d'une demi-journée de journeeDuJour. Rend [{ id, genre, ico, titre, detail, aussi, note, moi }] :
// `aussi`, une phrase de plus (un second rôle sur la même carte, un autre stagiaire dans la même voiture) ou null ;
// `moi`, le rôle de la personne (« tableau », « eleve », « voiture ») ou null.
const ICONE_DU_GENRE = { salle: "presentation", voiture: "car", cours: "book", controle: "clipboard", autonomie: "users", autre: "calendar" };
const TITRE_NEUTRE = { salle: "Salle", voiture: "Voiture" };

function enumerer(noms) {
  const l = (noms || []).filter(Boolean);
  return l.length <= 1 ? (l[0] || "") : `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`;
}

// « tête · sujets, avec Claire et Marc » (« en autonomie » pour une salle ou une voiture sans formateur qui nomme ses stagiaires), chaque morceau
// seulement s'il existe ; null s'il ne reste rien.
function ligneDeDetail(tete, sujets, c) {
  const debut = [tete, (sujets || []).join(" · ")].filter(Boolean).join(" · ");
  const formateurs = c.formateurs || [];
  const enAutonomie = c.genre === "autonomie" && natureDe(c) !== "autonomie" && nommeQuelquUn(c);   // sinon le titre le dit
  const avec = formateurs.length ? `avec ${enumerer(formateurs)}` : (enAutonomie ? "en autonomie" : "");
  return [debut, avec].filter(Boolean).join(", ") || null;
}

function lesBenevoles(benevoles) {
  if (!benevoles || !benevoles.length) return "";
  return `${enumerer(benevoles)}, ${benevoles.length > 1 ? "élèves bénévoles" : "élève bénévole"}`;
}

// « Lina R. passe au tableau », « Lina R. et Léo B. passent au tableau » ; vide si personne.
function quiAuTableau(tableau) {
  const n = (tableau || []).map((t) => t.nom).filter(Boolean);
  if (!n.length) return "";
  return `${enumerer(n)} ${n.length > 1 ? "passent" : "passe"} au tableau`;
}

function momentEnSalle(c, moi, role, base) {
  const sujetsDes = (groupes) => (c.sujetsParGroupe ? groupes.flatMap((g) => c.sujetsParGroupe[g] || []) : c.sujets);
  const tableauDes = (groupes) => (c.tableau || []).filter((t) => groupes.includes(t.groupe) && t.id !== moi);
  const moiAuTableau = moi == null ? null : (c.tableau || []).find((t) => t.id === moi);
  // Les groupes où il est élève (en salle double, une vague chacun) ; le sien au tableau n'en fait pas partie.
  const groupesEleve = moi == null ? [] : [1, 2].filter((g) => ((c.elevesParGroupe && c.elevesParGroupe[g]) || []).includes(moi)
    && !(moiAuTableau && moiAuTableau.groupe === g));
  if (role === "tableau" && moiAuTableau) {
    // Pédagogue d'un groupe et élève de l'autre (deux vagues successives, permis par les règles de conflit) : les deux.
    const vague = [quiAuTableau(tableauDes(groupesEleve)), sujetsDes(groupesEleve).join(" · ")].filter(Boolean).join(" · ");
    const aussi = groupesEleve.length ? `Tu es aussi en salle${vague ? ` quand ${vague}` : " pour l'autre groupe"}.` : null;
    return { ...base, titre: "Tu passes au tableau", detail: ligneDeDetail("en salle", sujetsDes([moiAuTableau.groupe]), c), aussi };
  }
  if (role === "eleve") {
    const groupes = groupesEleve.length ? groupesEleve : [1, 2];
    return { ...base, titre: "Tu es en salle", detail: ligneDeDetail(quiAuTableau(tableauDes(groupes)), sujetsDes(groupes), c) };
  }
  const titre = c.genre === "autonomie" ? c.titre : TITRE_NEUTRE.salle;
  return { ...base, titre, detail: ligneDeDetail(quiAuTableau(c.tableau), c.sujets, c) };
}

function momentEnVoiture(c, moi, role, base) {
  const benevoles = lesBenevoles(c.benevoles);
  if (role === "voiture") {
    const autres = (c.conducteurs || []).filter((s) => s.id !== moi).map((s) => s.nom).filter(Boolean);
    const aussi = autres.length ? `${enumerer(autres)} ${autres.length > 1 ? "enseignent" : "enseigne"} aussi dans cette voiture.` : null;
    return { ...base, titre: "Tu enseignes en voiture", detail: ligneDeDetail(benevoles ? `à ${benevoles}` : "", c.sujets, c), aussi };
  }
  const conducteurs = (c.conducteurs || []).map((s) => s.nom).filter(Boolean);
  const tete = conducteurs.length
    ? `${enumerer(conducteurs)} ${conducteurs.length > 1 ? "enseignent" : "enseigne"}${benevoles ? ` à ${benevoles}` : ""}`
    : ["Aucun stagiaire en voiture", benevoles].filter(Boolean).join(" · ");
  const titre = c.genre === "autonomie" ? c.titre : TITRE_NEUTRE.voiture;
  return { ...base, titre, detail: ligneDeDetail(tete, c.sujets, c) };
}

function momentDeLaCarte(c, moi) {
  const role = c.moi ? c.moi.role : null;
  const nature = natureDe(c);
  // Une salle ou une voiture en autonomie où il a un rôle garde l'icône de son activité ; sinon, celle du genre.
  const ico = ICONE_DU_GENRE[role ? nature : c.genre] || "calendar";
  const base = { id: c.id, genre: c.genre, ico, note: c.notes || null, aussi: null, moi: role };
  if (nature === "salle") return momentEnSalle(c, moi, role, base);
  if (nature === "voiture") return momentEnVoiture(c, moi, role, base);
  if (c.genre === "cours") {
    return { ...base, titre: moi == null ? c.titre : "Tu suis le cours", detail: ligneDeDetail("", c.sujets, c) };
  }
  if (c.genre === "autre" && c.notes) {
    return { ...base, titre: c.notes, note: null, detail: ligneDeDetail("", c.sujets, c) };
  }
  return { ...base, titre: c.titre, detail: ligneDeDetail("", c.sujets, c) };
}

export function momentsDeLaDemi({ cartes, moi } = {}) {
  const liste = (Array.isArray(cartes) ? cartes : []).filter(Boolean);
  const miennes = moi == null ? liste : liste.filter((c) => c.moi || !estNominative(c));
  return miennes.map((c) => momentDeLaCarte(c, moi));
}
