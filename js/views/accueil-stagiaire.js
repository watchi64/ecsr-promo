/**
 * Accueil du stagiaire (nouvelle navigation, lot 2B) : ce qui sert aujourd'hui, dans l'ordre de la maquette.
 * Pastille de date et salutation (la signature de l'app), la journée avec sa signature d'émargement, ce qu'il
 * reste à faire, le prochain rendez-vous, une Nouveauté, puis le pied de liens.
 * Chaque carte se charge à part : une lecture qui échoue laisse son message dans sa carte, jamais dans la page.
 * Une lecture qui revient après le départ de la page écrit dans un nœud détaché (isConnected) : rien n'est repeint.
 */
import {
  listAgendaEvents, getPromoCourante, listQcmIndex, listMyQcmAttempts, listThemes, getDpDossier,
} from "../db.js?v=20261111f";
import { el, clear } from "../utils.js?v=20261111f";
import { icon } from "../icons.js?v=20261111f";
import { getProfileWho, monStagiaireId, getProfile, getViewAs, getProfileNom } from "../auth-admin.js?v=20261111f";
import { libelleConnexion } from "../roles-rules.js?v=20261111f";
import { nouveautesAffichables, marquerLues, routeVisible, moduleVisible } from "../modules-etat.js?v=20261111f";
import { carteNouveaute } from "./nouveautes.js?v=20261111f";
import { prenomDe } from "../nav-rules.js?v=20261111f";
import { lignePromo, prochainRendezVous, aFaireStagiaire, salutationDe, sansPlaceDansLaDemi, ligneBenevoles } from "../accueil-rules.js?v=20261111f";
import { journeeDuJour } from "../journee-rules.js?v=20261111f";
import { effSujets, sujetsDe } from "../planning-roles.js?v=20261111f";
import { exemplesRemplis } from "../dp-rules.js?v=20261111f";
import { heureLocale } from "../emargement-rules.js?v=20261111f";
import { seancesDuJour, signerSeance } from "../emargement-bandeau.js?v=20261111f";
import { ouvrirSignalement } from "../signalement.js?v=20261111f";
import { carte, lienVers, plusLien, ligneLien, pastilleDuJour, reperesDuJour, semaineDeLaVisite, surveiller } from "./pages-cartes.js?v=20261111f";
import { bandeauQuestionnaire } from "../questionnaire.js?v=20261111f";

const RELECTURE_SEANCES_MS = 60000;

// Heures de ma signature du jour, retenues d'une lecture à l'autre : la séance quitte la liste des séances
// ouvertes quand un formateur la ferme, et « Signé à 8 h 52 » doit rester dit jusqu'à la fin de la visite.
const signeesDuJour = new Map();   // "<stagiaire>:AAAA-MM-JJ:matin" -> "8 h 52"


// « 09:00 » et « 12:30 » d'une séance -> « 9 h à 12 h 30 » : l'écriture des horaires du planning (journee-rules).
function horaireDeSeance({ debut, fin }) {
  const lisible = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  };
  return `${lisible(debut)} à ${lisible(fin)}`;
}

// === La journée ===

const DEMI = {
  matin: { titre: "Matin", signer: "Signer pour ce matin" },
  aprem: { titre: "Après-midi", signer: "Signer pour cet après-midi" },
};

function rangeeCarte(c) {
  const sujets = c.sujets.length ? ` : ${c.sujets.join(" · ")}` : "";
  const equipe = c.formateurs.length ? `Avec ${c.formateurs.join(", ")}.` : "";
  // Étiquette « Tu passes au tableau » : le texte de la journée (journee-rules), l'accent de la grille de la semaine.
  const etiquette = c.moi ? el("span", { class: "acc-puce", "data-moi": c.moi.role }, c.moi.texte) : null;
  return el("div", { class: "acc-carte-jour" },
    el("b", {}, c.titre + sujets),
    equipe ? el("p", {}, equipe) : null,
    ligneBenevoles(c.benevoles) ? el("p", {}, ligneBenevoles(c.benevoles)) : null,
    c.notes ? el("p", { class: "acc-note" }, c.notes) : null,
    etiquette,
  );
}

// La partie « signature » d'une rangée, pour la séance ouverte de la demi-journée : le bouton, ou « Signé à ».
// `redessiner` : redessine la carte sans relire (la relecture des séances part de l'événement « emargement-signe »).
function signature(jour, demi, seance, moi, redessiner) {
  if (moi == null) return null;
  const cle = `${moi}:${jour}:${demi}`;
  const ligne = seance && seance.lignes.find((x) => x.stagiaire_id === moi);
  if (ligne && ligne.signe_le) signeesDuJour.set(cle, heureLocale(ligne.signe_le));
  const heure = signeesDuJour.get(cle);
  if (heure) return el("p", { class: "acc-signe" }, icon.check(), `Signé à ${heure}`);
  if (!seance || (ligne && ligne.absent)) return null;   // pas de feuille ouverte, ou noté absent : le bandeau le dit
  return el("div", { class: "acc-actions" },
    el("button", {
      type: "button", class: "btn primary",
      onClick: async () => {
        if (!(await signerSeance(seance, moi))) return;
        signeesDuJour.set(cle, heureLocale(new Date().toISOString()));
        redessiner();
      },
    }, icon.check(), DEMI[demi].signer));
}

// Dessine la carte de la journée. `etat` : { jour, moi, journee, erreur, seances, ouvert }
//   journee : le résultat de journeeDuJour, ou null (planning pas lu, ou module fermé) ;
//   seances : les séances ouvertes du jour (peut être vide) ; ouvert : le module Planning est-il ouvert pour la promo ?
function dessinerJournee(corps, etat, relirePlanning, redessiner) {
  const { jour, moi, journee, erreur, seances, ouvert } = etat;
  clear(corps);
  const demis = journee && !journee.repos ? journee.demis : [];
  const planningRempli = demis.some((d) => d.cartes.length > 0);
  const rangees = ["matin", "aprem"].map((demi) => {
    const plan = demis.find((d) => d.demi === demi);
    const seance = seances.find((s) => s.demi_journee === demi);
    const sign = signature(jour, demi, seance, moi, redessiner);
    // Une rangée existe quand le planning de la journée a du contenu, ou quand la signature l'appelle : sans
    // planning lu, ou sans planning du tout, la rangée de la séance reste.
    if (!planningRempli && !sign) return null;
    const cartes = plan ? plan.cartes : [];
    const horaire = plan ? plan.horaire : (seance ? horaireDeSeance(seance) : "");
    // Aucune carte ne le nomme : la rangée le lui dit avant les activités des autres (audit du 09/11, A3).
    const sansPlace = sansPlaceDansLaDemi({ demi, cartes, moi });
    return el("div", { class: "acc-creneau", "data-demi": demi },
      el("div", { class: "acc-quand" }, el("b", {}, DEMI[demi].titre), horaire ? el("span", {}, horaire) : null),
      el("div", { class: "acc-quoi" },
        sansPlace ? el("p", { class: "muted acc-sans-place" }, sansPlace) : null,
        cartes.length ? cartes.map(rangeeCarte) : (journee && !journee.repos ? el("p", { class: "muted" }, "Rien de prévu au planning.") : null),
        sign,
      ),
    );
  }).filter(Boolean);

  if (erreur) {
    corps.appendChild(el("p", { class: "acc-erreur", role: "alert" },
      "Le planning du jour n'a pas pu être lu. ",
      el("button", { type: "button", class: "acc-reessayer", onClick: relirePlanning }, "Réessayer")));
  } else if (!ouvert && !rangees.length) {
    corps.appendChild(el("p", { class: "muted" }, "Le planning n'est pas encore ouvert pour ta promo."));
    return;
  } else if (!rangees.length) {
    corps.appendChild(el("p", { class: "acc-vide" }, "Pas de formation aujourd'hui."));
    // Un jour férié ou un jour désactivé a un nom ; « Samedi » et « Dimanche » sont déjà dits par la pastille de date.
    if (journee?.repos && !/^(Samedi|Dimanche)$/.test(journee.repos)) corps.appendChild(el("p", { class: "muted" }, journee.repos));
    return;
  }
  if (rangees.length) corps.appendChild(el("div", { class: "acc-journee" }, ...rangees));
}

async function chargerJournee(corps, jour, indexJour, semaine, moi) {
  const ouvert = routeVisible("planning");
  const etat = { jour, moi, journee: null, erreur: false, seances: [], ouvert };
  const redessiner = () => { if (corps.isConnected) dessinerJournee(corps, etat, () => relirePlanning(true), redessiner); };

  // Les séances à part du planning : la rangée de la signature ne dépend pas de lui. Sans fiche de stagiaire
  // (aperçu « Voir en tant que »), aucune signature n'est proposée, donc rien à lire.
  async function relireSeances() {
    if (moi == null) return;
    try { etat.seances = await seancesDuJour(); } catch (e) { /* un rappel de plus ne vaut pas une erreur */ }
    redessiner();
  }
  async function relirePlanning(neuve = false) {
    etat.erreur = false;
    if (indexJour >= 5) {
      // Samedi et dimanche : repos, rien à lire.
      etat.journee = journeeDuJour({ entries: [], metas: [], joursOff: [], jour, moi, noms: {} });
    } else if (ouvert) {
      try {
        const s = await semaine(neuve);
        etat.journee = journeeDuJour({ entries: s.entries, metas: s.metas, joursOff: s.joursOff, jour, moi, noms: s.noms });
      } catch (e) {
        console.error("Accueil : planning du jour illisible", e);
        etat.erreur = true;
      }
    }
    redessiner();
  }

  await Promise.all([relirePlanning(), relireSeances()]);
  // Une feuille ouverte par un formateur pendant la visite fait apparaître le bouton (le bandeau ne le porte plus sur
  // cette page), une signature faite se redessine.
  if (moi != null) surveiller(corps, relireSeances, RELECTURE_SEANCES_MS);
}

// === À faire ===

function ligneAFaire(l) {
  const ico = l.cle === "dossier" ? "clipboard" : "quiz";
  return ligneLien({ route: l.route, sousOnglet: l.sousOnglet, ico, titre: l.titre, detail: l.detail });
}

async function chargerAFaire(corps, indexJour, semaine, moi) {
  // Sans fiche de stagiaire (aperçu), rien de personnel à dire : ni tentative ni dossier à lire.
  if (moi == null) {
    if (corps.isConnected) { clear(corps); corps.appendChild(el("p", { class: "muted" }, "Rien à faire pour le moment.")); }
    return;
  }
  const modules = { qcm: moduleVisible("qcm"), dp: moduleVisible("dp") };
  const lire = (ouvert, lecture) => (ouvert ? lecture() : Promise.resolve(null));
  const [qcm, themes, tentatives, dossier, lecturePlanning] = await Promise.allSettled([
    lire(modules.qcm, listQcmIndex),
    lire(modules.qcm, listThemes),
    lire(modules.qcm, listMyQcmAttempts),
    lire(modules.dp, () => getDpDossier(moi)),
    // Les thèmes de la semaine ne servent qu'aux QCM : pas de lecture du planning si le module est fermé.
    lire(modules.qcm && routeVisible("planning"), () => semaine()),
  ]);
  if (!corps.isConnected) return;
  const valeur = (r) => (r.status === "fulfilled" ? r.value : null);

  // Les thèmes vus du lundi à aujourd'hui compris, dans l'ordre du planning. Un week-end : toute la semaine.
  const s = valeur(lecturePlanning);
  const titres = s ? s.noms.titres : [];
  const sujetsDeLaSemaine = s
    ? s.entries.filter((e) => e.day_index <= indexJour).flatMap((e) => effSujets(e).flatMap((v) => sujetsDe(v, titres)))
    : [];

  const lignes = aFaireStagiaire({
    qcm: valeur(qcm) || [], themes: valeur(themes) || [], tentatives: valeur(tentatives) || [],
    sujetsDeLaSemaine,
    exemplesDossier: dossier.status === "fulfilled" && modules.dp ? exemplesRemplis(dossier.value?.data) : null,
    modules, now: Date.now(),
  });

  clear(corps);
  if (lignes.length) {
    corps.appendChild(el("div", { class: "acc-lignes" }, ...lignes.map(ligneAFaire)));
    return;
  }
  // Rien à montrer : « tout est fait » seulement si rien n'a échoué.
  const echec = [qcm, themes, tentatives, dossier].some((r) => r.status === "rejected");
  if (echec) {
    console.error("Accueil : lecture de l'à-faire incomplète", [qcm, themes, tentatives, dossier].filter((r) => r.status === "rejected").map((r) => r.reason));
  }
  corps.appendChild(el("p", { class: echec ? "acc-erreur" : "muted", role: echec ? "alert" : null },
    echec ? "Ton à-faire n'a pas pu être lu en entier. Recharge la page pour réessayer." : "Rien à faire pour le moment."));
}

// === Prochain rendez-vous ===

async function chargerRendezVous(corps, jour) {
  let evenements = null;
  try { evenements = await listAgendaEvents(); }
  catch (e) {
    console.error("Accueil : agenda illisible", e);
    if (corps.isConnected) { clear(corps); corps.appendChild(el("p", { class: "acc-erreur", role: "alert" }, "Impossible de charger les événements.")); }
    return;
  }
  if (!corps.isConnected) return;
  const rdv = prochainRendezVous(evenements, jour);
  clear(corps);
  if (!rdv) { corps.appendChild(el("p", { class: "muted" }, "Aucun rendez-vous à venir.")); return; }
  corps.appendChild(el("p", { class: "acc-rdv" }, el("b", {}, rdv.titre), ", " + rdv.date));
  corps.appendChild(el("p", { class: "acc-rdv-decompte" }, rdv.libelle));
}

// === Nouveauté ===

// La plus récente, marquée lue. « neuve » se calcule AVANT le marquage, sinon plus rien n'aurait sa puce.
function carteDeLaNouveaute() {
  const { entrees, neuves } = nouveautesAffichables();
  if (!entrees.length) return null;
  const derniere = entrees[0];
  const c = carte({ titre: "Nouveauté", ico: "bell", classe: "acc-nouveaute", zone: "nouveaute", plus: plusLien("nouveautes", "Tout voir") });
  clear(c.corps);
  c.corps.appendChild(carteNouveaute(derniere, { neuve: neuves.has(derniere.id) }));
  marquerLues([derniere.id]);
  window.dispatchEvent(new CustomEvent("nouveautes-vues"));
  return c.noeud;
}

// === La page ===

export function renderAccueilStagiaire(container) {
  clear(container);
  const maintenant = new Date();
  const { jour, indexJour, lundi } = reperesDuJour(maintenant);
  const moi = monStagiaireId();
  const semaine = semaineDeLaVisite(lundi);
  const who = getProfileNom();
  const prenom = prenomDe(who) || who || "stagiaire";
  const ligne = lignePromo(getPromoCourante(), jour);

  container.appendChild(el("section", { class: "home-hero-v2" },
    pastilleDuJour(maintenant),
    // Une page, un nom (décision du 10/11) : le titre est celui de l'entrée, « Accueil » ; la salutation passe dessous.
    el("h1", { class: "home-title-v2" }, "Accueil"),
    el("p", { class: "home-salut-v2" }, salutationDe(maintenant.getHours()) + ", ", el("em", {}, prenom)),
    ligne ? el("p", { class: "home-lead-v2" }, ligne) : null,
  ));
  // Questionnaire anonyme à remplir (Qualiopi), sous la salutation et avant les cartes : l'emplacement est posé tout de
  // suite et se remplit à l'arrivée de la liste lue en base (vide : rien ne s'affiche).
  container.appendChild(bandeauQuestionnaire());

  const journee = carte({
    titre: "Aujourd'hui", ico: "sun", classe: "acc-heros", zone: "aujourdhui",
    plus: routeVisible("planning") ? plusLien("planning", "Ouvrir le planning") : null,
  });
  const afaire = carte({ titre: "À faire", ico: "inbox", zone: "afaire" });
  const cartes = [journee, afaire];
  const rdv = routeVisible("calendrier")
    ? carte({ titre: "Prochain rendez-vous", ico: "calendar", zone: "rendez-vous", plus: plusLien("calendrier", "Dates clés") })
    : null;
  if (rdv) cartes.push(rdv);
  const nouveaute = carteDeLaNouveaute();

  // L'ordre du DOM est celui du téléphone (la journée, puis ce qu'il y a à faire) ; la grille de css/pages.css
  // replace les cartes sur tablette et ordinateur.
  container.appendChild(el("div", { class: "acc-grille" },
    ...cartes.map((c) => c.noeud), nouveaute));

  // Pied de liens : ce qu'on cherche rarement mais qu'on doit trouver sans deviner.
  const signaler = el("button", { type: "button", class: "acc-lien-pied",
    onClick: (ev) => ouvrirSignalement({ ancre: ev.currentTarget }) }, icon.signaler(), "Signaler un problème");
  container.appendChild(el("nav", { class: "acc-liens", "aria-label": "Liens utiles" },
    routeVisible("ressources") ? lienVers("ressources", null, "acc-lien-pied", icon.users(), "Contacts du centre") : null,
    lienVers("preferences", null, "acc-lien-pied", icon.settings(), "Mes préférences"),
    signaler,
  ));

  const nomPromo = getPromoCourante()?.nom || "";
  container.appendChild(el("footer", { class: "home-footer-v2" },
    el("p", {}, "TP ECSR App · " + (nomPromo ? "Promo " + nomPromo + " · " : ""), el("span", { class: "footer-role" },
      "connecté en tant que " + (libelleConnexion({ profil: getProfile(), promo: getPromoCourante(), apercu: getViewAs() }) || "stagiaire"))),
    // Plus de lien « code source » : décision de Timy du 09/11, le code reste discret.
  ));

  // Chaque carte se charge seule ; la page rend la main quand toutes ont fini (réussi ou non).
  return Promise.allSettled([
    chargerJournee(journee.corps, jour, indexJour, semaine, moi),
    chargerAFaire(afaire.corps, indexJour, semaine, moi),
    rdv ? chargerRendezVous(rdv.corps, jour) : null,
  ]).then(() => undefined);
}
