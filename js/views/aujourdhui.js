/**
 * Aujourd'hui du formateur (nouvelle navigation, lot 2B) : ce que la journée demande à l'équipe, dans l'ordre de la
 * maquette. Pastille de date et titre (la signature de l'app), puis cinq cartes : la feuille d'émargement, ce qui est à
 * traiter dans Cours et QCM, qui passe au tableau, qui est en voiture, qui est à suivre de près. Les Nouveautés n'y
 * sont pas : le compte les porte.
 * Chaque carte se charge à part : une lecture qui échoue laisse son message dans sa carte, jamais dans la page.
 * Une lecture qui revient après le départ de la page écrit dans un nœud détaché (isConnected) : rien n'est repeint.
 */
import {
  getPromoCourante, listStagiaires, listEmargementSeances, lireDonneesCentre, lireReferentielCentre,
} from "../db.js?v=20261110d";
import { el, clear, displayStagiaire } from "../utils.js?v=20261110d";
import { icon } from "../icons.js?v=20261110d";
import { monStagiaireId, isAdmin, getProfile, getViewAs } from "../auth-admin.js?v=20261110d";
import { libelleConnexion } from "../roles-rules.js?v=20261110d";
import { emargementActif } from "../emargement-etat.js?v=20261110d";
import { lignePromo } from "../accueil-rules.js?v=20261110d";
import { journeeDuJour } from "../journee-rules.js?v=20261110d";
import { indicateursPromo } from "../centre-stats.js?v=20261110d";
import { adresseSeance, heureLocale } from "../emargement-rules.js?v=20261110d";
import { signerSeance } from "../emargement-bandeau.js?v=20261110d";
import { chargerATraiter } from "../a-traiter.js?v=20261110d";
import { bandeauQuestionnaire } from "../questionnaire.js?v=20261110d";
import {
  titreSelonDemis, auTableauDuJour, enVoitureDuJour, feuilleDuJour, lignesATraiter, ligneDeLEnTete,
} from "../aujourdhui-rules.js?v=20261110d";
import {
  carte, plusLien, ligneLien, erreurAvecReessai, pastilleDuJour, reperesDuJour, semaineDeLaVisite, surveiller,
} from "./pages-cartes.js?v=20261110d";

const RELECTURE_SEANCES_MS = 60000;
const NB_A_SUIVRE = 5;


const DEMI_LONG = { matin: "Matin", aprem: "Après-midi" };
const SIGNER = { matin: "Signer pour ce matin", aprem: "Signer pour cet après-midi" };
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// Un message dans le corps d'une carte, au ton de la carte (« muted » pour une absence, erreur pour une panne).
function dire(corps, texte, classe = "muted") {
  clear(corps);
  corps.appendChild(el("p", { class: classe, role: classe === "acc-erreur" ? "alert" : null }, texte));
}

// === Émargement ===

// La séance que la personne doit signer (le fondateur qui a une fiche de stagiaire) : la première, le matin avant
// l'après-midi, où elle n'a ni signé ni été notée absente. Même règle que le bandeau.
function seanceASigner(seances, moi) {
  if (moi == null) return null;
  const ouvertes = seances.filter((s) => s.statut === "ouverte").sort((a, z) => (a.demi_journee === "matin" ? 0 : 1) - (z.demi_journee === "matin" ? 0 : 1));
  return ouvertes.find((s) => {
    const l = s.lignes.find((x) => x.stagiaire_id === moi);
    return !l || (!l.signe_le && !l.absent);
  }) || null;
}

// `etat` : { feuille, seances, moi } ; `feuille` : le résultat de feuilleDuJour, ou null (aucune feuille aujourd'hui).
function dessinerEmargement(carteEm, etat) {
  const { corps, titre } = carteEm;
  const { feuille, seances, moi } = etat;
  clear(corps);
  if (!feuille) {
    titre.textContent = "Émargement";
    corps.appendChild(el("p", { class: "acc-kpi acc-kpi-vide" }, "Pas encore ouverte"));
    corps.appendChild(el("div", { class: "acc-actions" },
      el("a", { class: "btn small", href: "#/emargement" }, "Aller à l'émargement")));
    return;
  }
  titre.textContent = feuille.titre;
  const ouverte = feuille.statut === "ouverte";
  const part = feuille.total ? Math.round((feuille.signes / feuille.total) * 100) : 0;
  corps.appendChild(el("div", { class: "acc-em-tete" },
    el("p", { class: "acc-kpi" }, `${feuille.signes} sur ${feuille.total}`, el("span", { class: "muted" }, " ont signé")),
    el("span", { class: "acc-repere" + (ouverte ? " acc-repere-ok" : "") }, ouverte ? "Ouverte" : "Close"),
  ));
  corps.appendChild(el("div", {
    class: "acc-jauge", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(feuille.total),
    "aria-valuenow": String(feuille.signes), "aria-label": `${feuille.signes} signatures sur ${feuille.total}`,
  }, el("i", { style: `width:${part}%` })));
  if (feuille.enAttente.length) {
    corps.appendChild(el("p", { class: "acc-attente" }, "En attente : " + feuille.enAttente.join(", ")));
  }
  // Ceux qui n'attendent pas parce qu'absents (prévus au planning ou notés) : avec les signés et l'attente, ils font le total (A1).
  if (feuille.absents.length) {
    corps.appendChild(el("p", { class: "acc-attente" }, (feuille.absents.length > 1 ? "Absents : " : "Absent : ") + feuille.absents.join(", ")));
  }

  // Le fondateur qui a une fiche de stagiaire signe comme les autres : le bandeau ne le propose plus sur cette page.
  const aSigner = seanceASigner(seances, moi);
  const maLigne = moi == null ? null : feuille.seance.lignes.find((x) => x.stagiaire_id === moi);
  const actions = el("div", { class: "acc-actions" },
    el("a", { class: "btn small", href: adresseSeance(feuille.seance.jour, feuille.seance.demi_journee) }, "Voir la feuille"));
  if (aSigner) {
    actions.appendChild(el("button", {
      type: "button", class: "btn small primary",
      onClick: () => signerSeance(aSigner, moi),   // « emargement-signe » relit la carte
    }, icon.check(), SIGNER[aSigner.demi_journee]));
  }
  corps.appendChild(actions);
  if (!aSigner && maLigne?.signe_le) {
    corps.appendChild(el("p", { class: "acc-signe" }, icon.check(), `Signé à ${heureLocale(maLigne.signe_le)}`));
  }
}

async function chargerEmargement(carteEm, jour, indexJour, semaine, moi) {
  const { corps } = carteEm;
  const etat = { feuille: null, seances: [], moi, lu: false };
  const redessiner = () => { if (corps.isConnected) dessinerEmargement(carteEm, etat); };

  async function lire() {
    try {
      const [seances, stagiaires, planning] = await Promise.all([
        listEmargementSeances(jour, jour),
        // Les inactifs aussi : un abandon qui a une ligne sur la feuille compte dans le total, il doit être nommé (A1).
        listStagiaires({ includeInactive: true }),
        // Le planning ne sert qu'aux absents notés : sa panne ne cache pas la feuille.
        indexJour < 5 ? semaine().catch(() => null) : null,
      ]);
      etat.seances = seances;
      etat.feuille = feuilleDuJour({ seances, stagiaires, entries: planning?.entries || [] });
      etat.lu = true;
      redessiner();
    } catch (e) {
      console.error("Aujourd'hui : émargement illisible", e);
      // Une relecture qui échoue garde ce qui est déjà à l'écran ; seule la première lecture dit l'erreur.
      if (!etat.lu && corps.isConnected) erreurAvecReessai(corps, "La feuille d'émargement n'a pas pu être lue.", lire);
    }
  }
  await lire();
  // Une feuille ouverte ou une signature faite pendant la visite met la carte à jour.
  surveiller(corps, lire, RELECTURE_SEANCES_MS);
}

// === À traiter ===

const ICONE_A_TRAITER = { signalements: "signaler", ia: "quiz" };

async function chargerATraiterCarte(corps) {
  const comptes = await chargerATraiter();   // ne rejette jamais ; un compte illisible vaut null
  if (!corps.isConnected) return;
  const lignes = lignesATraiter(comptes);
  const illisibles = [
    comptes.signalements == null ? "Le décompte des signalements n'a pas pu être lu." : null,
    comptes.propositionsIA == null ? "Le décompte des questions proposées par l'IA n'a pas pu être lu." : null,
  ].filter(Boolean);
  clear(corps);
  if (lignes.length) {
    corps.appendChild(el("div", { class: "acc-lignes" },
      ...lignes.map((l) => ligneLien({ route: "themes", sousOnglet: l.sousOnglet, ico: ICONE_A_TRAITER[l.cle], titre: l.titre }))));
    // Un compte lu n'efface pas la panne de l'autre : sans cette ligne, « 2 questions proposées par l'IA » laisserait croire
    // qu'aucun signalement n'attend, alors que sa lecture a échoué.
    illisibles.forEach((t) => corps.appendChild(el("p", { class: "acc-erreur", role: "alert" }, t)));
    return;
  }
  // « Rien à traiter » seulement si les deux comptes ont bien été lus.
  if (illisibles.length) dire(corps, "Le décompte n'a pas pu être lu.", "acc-erreur");
  else dire(corps, "Rien à traiter.");
}

// === Au tableau, en voiture ===

function ligneStagiaire(s, detail) {
  return ligneLien({ route: "stagiaires", adresse: "#/stagiaires/" + s.id, ico: "user", titre: s.nom, detail });
}

function dessinerTableau(c, journee) {
  const gens = auTableauDuJour(journee);
  c.titre.textContent = titreSelonDemis("Au tableau", gens.map((g) => g.demi));
  if (!gens.length) { dire(c.corps, journee?.repos ? "Pas de formation aujourd'hui." : "Personne n'est au tableau."); return; }
  const deuxDemis = new Set(gens.map((g) => g.demi)).size > 1;
  clear(c.corps);
  c.corps.appendChild(el("div", { class: "acc-lignes" },
    ...gens.map((g) => ligneStagiaire({ id: g.id, nom: g.nom },
      [deuxDemis ? DEMI_LONG[g.demi] : null, g.sujet].filter(Boolean).join(" · ")))));
}

function dessinerVoiture(c, journee) {
  const v = enVoitureDuJour(journee);
  c.titre.textContent = titreSelonDemis("En voiture", v.demis);
  if (!v.stagiaires.length && !v.benevoles.length) {
    dire(c.corps, journee?.repos ? "Pas de formation aujourd'hui." : "Personne n'est en voiture.");
    return;
  }
  clear(c.corps);
  const lignes = [];
  if (v.stagiaires.length) {
    lignes.push(ligneLien({ route: "planning", ico: "car", titre: pluriel(v.stagiaires.length, "stagiaire"), detail: v.stagiaires.map((s) => s.nom).join(", ") }));
  }
  if (v.benevoles.length) {
    lignes.push(ligneLien({
      route: "stagiaires", sousOnglet: "benevoles", ico: "users",
      titre: v.benevoles.length > 1 ? `${v.benevoles.length} élèves bénévoles` : "1 élève bénévole", detail: v.benevoles.join(", "),
    }));
  }
  c.corps.appendChild(el("div", { class: "acc-lignes" }, ...lignes));
}

async function chargerPlanning(tableau, voiture, indexJour, jour, semaine, moi) {
  async function lire(neuve = false) {
    let journee;
    if (indexJour >= 5) {
      // Samedi et dimanche : repos, rien à lire.
      journee = journeeDuJour({ entries: [], metas: [], joursOff: [], jour, moi, noms: {} });
    } else {
      try {
        const s = await semaine(neuve);
        journee = journeeDuJour({ entries: s.entries, metas: s.metas, joursOff: s.joursOff, jour, moi, noms: s.noms });
      } catch (e) {
        console.error("Aujourd'hui : planning du jour illisible", e);
        if (tableau.corps.isConnected) {
          const relire = () => lire(true);
          erreurAvecReessai(tableau.corps, "Le planning du jour n'a pas pu être lu.", relire);
          erreurAvecReessai(voiture.corps, "Le planning du jour n'a pas pu être lu.", relire);
        }
        return;
      }
    }
    if (!tableau.corps.isConnected) return;
    dessinerTableau(tableau, journee);
    dessinerVoiture(voiture, journee);
  }
  await lire();
}

// === À suivre de près ===

async function chargerASuivre(corps, jour, promoId) {
  let ind;
  try {
    const [referentiel, donnees] = await Promise.all([lireReferentielCentre(), lireDonneesCentre(promoId)]);
    ind = indicateursPromo(donnees, referentiel, { aujourdhui: jour });
  } catch (e) {
    console.error("Aujourd'hui : indicateurs illisibles", e);
    if (corps.isConnected) dire(corps, "Les indicateurs n'ont pas pu être lus. Recharge la page pour réessayer.", "acc-erreur");
    return;
  }
  if (!corps.isConnected) return;
  if (!ind.aSuivre.length) { dire(corps, "Personne ne cumule deux signaux."); return; }
  clear(corps);
  corps.appendChild(el("div", { class: "acc-lignes" },
    ...ind.aSuivre.slice(0, NB_A_SUIVRE).map((x) => ligneLien({
      route: "stagiaires", adresse: "#/stagiaires/" + x.stagiaire.id, ico: "user", titre: displayStagiaire(x.stagiaire),
      detail: x.signaux.map((s) => s.texte).join(" · "),
      fin: el("span", { class: "acc-repere acc-repere-suivre" }, "À suivre"),
    }))));
}

// === La page ===

export function renderAujourdhui(container) {
  clear(container);
  const maintenant = new Date();
  const { jour, indexJour, lundi } = reperesDuJour(maintenant);
  const moi = monStagiaireId();   // le fondateur qui a une fiche de stagiaire signe aussi
  const semaine = semaineDeLaVisite(lundi);
  const promo = getPromoCourante();
  const lignePromoDuJour = lignePromo(promo, jour);

  // La ligne sous le titre n'est posée que si elle dit quelque chose : sans promo ni compte lu, pas de paragraphe vide.
  const texteEnTete = ligneDeLEnTete(lignePromoDuJour, null);
  const ligne = el("p", { class: "home-lead-v2" }, texteEnTete);
  const entete = el("section", { class: "home-hero-v2" },
    pastilleDuJour(maintenant),
    el("h1", { class: "home-title-v2" }, "Aujourd'hui"),
    texteEnTete ? ligne : null,
  );
  container.appendChild(entete);
  // Questionnaire anonyme des formateurs (Qualiopi), sous le titre et avant les cartes, comme sur l'Accueil des
  // stagiaires : vide (direction, siège, rien à remplir), rien ne s'affiche.
  container.appendChild(bandeauQuestionnaire());

  // Émargement et À traiter : les formateurs de la promo seulement (isAdmin, « écrit comme un formateur »), les mêmes
  // conditions que l'entrée Émargement de la barre et que les sous-onglets Signalements et Propositions IA. La direction
  // et le siège lisent la page sans ces deux cartes : elles mèneraient à des pages qui ne sont pas pour eux.
  const avecFeuille = emargementActif() && isAdmin();
  const avecATraiter = isAdmin();
  const emargement = avecFeuille ? carte({ titre: "Émargement", ico: "clipboard", zone: "emargement" }) : null;
  const atraiter = avecATraiter ? carte({ titre: "À traiter", ico: "inbox", zone: "a-traiter" }) : null;
  const tableau = carte({ titre: "Au tableau aujourd'hui", ico: "presentation", zone: "tableau" });
  const voiture = carte({ titre: "En voiture aujourd'hui", ico: "car", zone: "voiture" });
  const asuivre = carte({ titre: "À suivre de près", ico: "info", zone: "a-suivre", plus: plusLien("centre", "Tout voir") });

  // L'ordre du DOM est celui du téléphone (ce qui demande une action avant ce qui informe) ; la grille de
  // css/pages.css replace les cartes sur tablette et ordinateur.
  container.appendChild(el("div", { class: "acc-grille auj-grille" + (avecFeuille ? "" : " auj-sans-feuille") + (avecATraiter ? "" : " auj-sans-traiter") },
    ...[emargement, atraiter, tableau, voiture, asuivre].filter(Boolean).map((c) => c.noeud)));

  // Pied de page : celui de l'Accueil d'avant, pour l'équipe.
  const nomPromo = promo?.nom || "";
  container.appendChild(el("footer", { class: "home-footer-v2" },
    el("p", {}, "TP ECSR App · " + (nomPromo ? "Promo " + nomPromo + " · " : ""), el("span", { class: "footer-role" }, "connecté comme " + (libelleConnexion({ profil: getProfile(), promo, apercu: getViewAs() }) || "formateur"))),
    // Plus de lien « code source » : décision de Timy du 09/11, le code reste discret.
    el("p", { class: "muted", style: "margin-top:0.3rem;font-size:0.78rem" },
      el("a", { href: "#/config" }, "réglages")),
  ));

  // « N stagiaires en formation » rejoint la ligne dès qu'il est lu ; une lecture qui échoue la laisse sans lui.
  const enFormation = listStagiaires().then((liste) => {
    const texte = ligneDeLEnTete(lignePromoDuJour, liste.length);
    if (!entete.isConnected || !texte) return;
    ligne.textContent = texte;
    if (!ligne.isConnected) entete.appendChild(ligne);
  }).catch((e) => console.error("Aujourd'hui : stagiaires illisibles", e));

  // Chaque carte se charge seule ; la page rend la main quand toutes ont fini (réussi ou non).
  return Promise.allSettled([
    emargement ? chargerEmargement(emargement, jour, indexJour, semaine, moi) : null,
    atraiter ? chargerATraiterCarte(atraiter.corps) : null,
    chargerPlanning(tableau, voiture, indexJour, jour, semaine, moi),
    chargerASuivre(asuivre.corps, jour, promo?.id ?? null),
    enFormation,
  ]).then(() => undefined);
}
