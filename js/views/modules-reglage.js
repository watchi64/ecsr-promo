// Paramètres › « Modules de la promo » (chantier B) : ouvrir ou fermer, pour la
// promo courante, les parties de l'app que voient les stagiaires.
//
// Réservé aux formateurs, chacun pour la promo affichée (REGLAGE_OUVERT_AUX_FORMATEURS,
// js/modules-data.js, ouvert avec le multi-promo). La section se
// redessine elle-même après chaque écriture, réussie ou non (voir redessiner) :
// pas de rechargement de toute la page Paramètres.
import { el, toast } from "../utils.js?v=20261005a";
import { icon } from "../icons.js?v=20261005a";
import { MODULES, GROUPES } from "../modules-data.js?v=20261005a";
import { estReglee, estOuvert, jourParis, accorder } from "../modules.js?v=20261005a";
import {
  etatModules, peutRegler, basculerModule, appliquerEnsembleDeDepart,
} from "../modules-etat.js?v=20261005a";
import { getPromoCourante } from "../db.js?v=20261005a";

// La section règle la promo AFFICHÉE (pastille) : on la nomme partout, pour qu'un formateur
// arrivé par défaut sur une promo ne règle jamais l'autre par mégarde.
function nomPromo() {
  return getPromoCourante()?.nom || "promo par défaut (promos non chargées)";
}
function laPromo() {
  const nom = getPromoCourante()?.nom;
  return nom ? `la promo « ${nom} »` : "la promo affichée";
}

const SOCLE = "Toujours ouverts : Accueil, Mon espace personnel (Passages), Paramètres, Nouveautés.";

// Demandée avant la première bascule d'une case sur une promo libre ou illisible : cette
// bascule fige un réglage pour tous les stagiaires de la promo, et l'état « aucun réglage »
// ne se retrouve plus ensuite. Le bouton « Partir de l'ensemble de départ » a la sienne.
const confirmationPremierReglage = () => `Pour ${laPromo()}, aucun réglage n'existe encore : `
  + "tout est ouvert. Changer une case crée un réglage qui s'applique à tous ses stagiaires, "
  + "et on ne pourra plus revenir à l'état « aucun réglage ». Continuer ?";

function nomDe(cle) {
  return MODULES.find((m) => m.cle === cle)?.nom || cle;
}

// « 12/10 » : jour d'ouverture en heure de Paris.
function jourCourt(iso) {
  const j = jourParis(iso);
  return j ? `${j.slice(8, 10)}/${j.slice(5, 7)}` : "";
}

// « Planning, Calendrier et Ressources »
function enumerer(noms) {
  if (noms.length < 2) return noms.join("");
  return noms.slice(0, -1).join(", ") + " et " + noms[noms.length - 1];
}

// Redessine la section qui est ACTUELLEMENT à l'écran, jamais celle d'où est parti le
// clic. Deux cases cochées coup sur coup lancent deux écritures, exécutées l'une après
// l'autre (file de js/modules-etat.js) : la première, en finissant, remplace la section
// par une neuve ; la seconde, en finissant, doit redessiner cette neuve. Viser l'ancienne,
// déjà retirée de la page, ne ferait rien (remplacer un nœud détaché est sans effet) et
// l'écran resterait celui d'avant la seconde écriture. On cherche donc la section dans la
// page à chaque redessin (par sa classe « modules-reglage »), et la neuve repart toujours
// de l'état réel des modules : après un échec, la case revient d'elle-même à son état,
// sans remise en état à part.
//
// `idACibler` : id de la case actionnée. Elle est grisée pendant l'écriture, donc perd le
// focus, et le redessin la remplace : sans cela, un formateur au clavier repartirait du
// début de la page. Le focus revient à la case qui l'a (si le formateur est déjà passé à la
// suivante, c'est elle : lui rendre la case actionnée ferait basculer celle-ci à la touche
// Espace), à défaut à la case actionnée. S'il est ailleurs dans la page (un champ d'une
// autre section), on n'y touche pas : on ne lui vole pas ce qu'il est en train de saisir.
function redessiner(idACibler) {
  const affichee = document.querySelector(".modules-reglage");
  if (!affichee) return;   // la page Paramètres n'est plus à l'écran
  const actif = document.activeElement;
  const dansSection = !!actif && affichee.contains(actif);
  const focusAilleurs = !!actif && actif !== document.body && !dansSection;
  const idFocus = (dansSection && actif.id) || idACibler;
  const suivante = renderModulesSection();
  if (suivante) affichee.replaceWith(suivante);
  else affichee.remove();
  if (suivante && idFocus && !focusAilleurs) suivante.querySelector("#" + idFocus)?.focus({ preventScroll: true });
}

// Protocole de toute écriture de la section (une case, le bouton de l'ensemble de départ) :
// l'écriture, un message de succès ou d'erreur, puis, dans tous les cas, le redessin de la
// section affichée. `ecriture` est une fonction qui renvoie une promesse.
async function ecrireEtRedessiner(ecriture, messageSucces, idACibler) {
  try {
    await ecriture();
    toast(messageSucces, "success");
  } catch (e) {
    console.error(e);
    toast("Erreur : " + (e?.message || e), "error");
  } finally {
    redessiner(idACibler);
  }
}

export function renderModulesSection() {
  if (!peutRegler()) return null;
  const etat = etatModules();

  // La classe « modules-reglage » sert à retrouver la section affichée (voir redessiner) :
  // ne pas la retirer.
  const section = el("section", { class: "param-section modules-reglage" });

  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.eyeOff()),
    el("div", {},
      el("h3", {}, "Modules de la promo"),
      el("p", {}, "Promo réglée : ", el("strong", {}, nomPromo())),
      el("p", { class: "muted" },
        "Ouvre les parties de l'app au fil de la formation. Une partie fermée est invisible "
        + "pour les stagiaires ; tu la vois toujours, avec le repère « Masqué aux stagiaires »."),
    ),
  ));

  if (!estReglee(etat)) section.appendChild(bandeauDepart(etat));
  section.appendChild(el("p", { class: "modules-socle muted" }, SOCLE));

  for (const groupe of GROUPES) {
    const membres = MODULES.filter((m) => m.groupe === groupe);
    if (membres.length === 0) continue;
    section.appendChild(el("div", { class: "param-block modules-groupe" },
      el("h4", {}, groupe),
      ...membres.map((m) => ligneModule(m, etat)),
    ));
  }
  return section;
}

function bandeauDepart(etat) {
  const noms = enumerer(MODULES.filter((m) => m.depart).map((m) => m.nom));
  const bouton = el("button", { class: "btn primary", type: "button" }, "Partir de l'ensemble de départ");
  bouton.addEventListener("click", async () => {
    if (!confirm(`Pour ${laPromo()}, seuls ${noms} resteront visibles pour les stagiaires. Continuer ?`)) return;
    bouton.disabled = true;
    // Message neutre : si la base portait déjà un réglage lisible (lecture de démarrage
    // ratée, autre formateur), appliquerEnsembleDeDepart le conserve.
    await ecrireEtRedessiner(appliquerEnsembleDeDepart, "Réglage des modules enregistré");
  });
  return el("div", { class: "modules-bandeau" },
    el("p", {}, etat.statut === "illisible"
      ? "Réglage illisible : tout est ouvert pour cette promo."
      : "Aucun réglage : tout est ouvert pour cette promo."),
    bouton,
  );
}

function ligneModule(m, etat) {
  const reglee = estReglee(etat);
  // La case montre l'état propre du module : un enfant reste coché quand son
  // parent est fermé (fermer un parent ne touche pas ses enfants).
  const coche = !reglee || Object.prototype.hasOwnProperty.call(etat.ouverts, m.cle);
  const parentFerme = !!m.parent && !estOuvert(m.parent, etat, MODULES);
  const id = "module-case-" + m.cle;

  const caseACocher = el("input", { type: "checkbox", id });
  caseACocher.checked = coche;
  caseACocher.disabled = parentFerme;
  caseACocher.addEventListener("change", async () => {
    const ouvrir = caseACocher.checked;
    // `reglee` est l'état AFFICHÉ, celui que le formateur a sous les yeux. Sur une promo libre
    // ou illisible, la première bascule fige un réglage : on la fait confirmer. Refus : la case
    // retrouve son état d'avant, sans écriture ni message (rien ne s'est passé).
    if (!reglee && !confirm(confirmationPremierReglage())) {
      caseACocher.checked = !ouvrir;
      return;
    }
    caseACocher.disabled = true;
    await ecrireEtRedessiner(
      () => basculerModule(m.cle, ouvrir),
      `${m.nom} ${accorder(ouvrir ? "ouvert" : "masqué", m.accord)} aux stagiaires`,
      id,
    );
  });

  const mention = m.parent
    ? el("span", { class: "modules-parent muted" },
        (parentFerme ? "s'ouvre avec " : "dans ") + nomDe(m.parent))
    : null;
  // La date n'a de sens que pour un module effectivement ouvert : un enfant coché dont le
  // parent est fermé n'est pas ouvert pour les stagiaires.
  const date = reglee && estOuvert(m.cle, etat, MODULES)
    ? el("span", { class: "modules-date" },
        `${accorder("ouvert", m.accord)} le ${jourCourt(etat.ouverts[m.cle])}`)
    : null;

  return el("div", { class: "modules-ligne" + (m.parent ? " enfant" : "") },
    caseACocher,
    el("label", { for: id, class: "modules-libelle" },
      el("span", { class: "modules-nom" }, m.nom),
      mention,
      el("span", { class: "modules-explication muted" }, m.explication),
      date,
    ),
  );
}
