// Nouvelle navigation (refonte, lot 1) : interrupteur par promo, éteint par défaut. Même
// mécanique que l'émargement (js/emargement-etat.js) : un réglage `settings` propre à la promo,
// que le seul fondateur règle dans Paramètres. S'y ajoute l'aperçu du fondateur, propre à son
// appareil (localStorage), pour essayer la nouvelle navigation avant d'allumer la promo.
// Les règles pures (clés, décision) vivent dans js/nav-etat-regles.js, que node sait lire :
// ce module-ci touche au DOM et à la base, node ne peut pas l'importer.

import { getSetting, setSetting, getPromoCourante } from "./db.js?v=20261027a";
import { el, toast } from "./utils.js?v=20261027a";
import { icon } from "./icons.js?v=20261027a";
import { isFounder } from "./auth-admin.js?v=20261027a";
import {
  CLE_REGLAGE, CLE_APERCU, decideNavigationV2, reglageAllume, cleMemoire, navigationAttendue,
} from "./nav-etat-regles.js?v=20261027a";

export { decideNavigationV2 };

// Même borne que les modules et l'émargement : au-delà, l'app démarre sans la nouvelle navigation.
const DELAI_LECTURE_MS = 3500;

// Réglage de la promo affichée : true ou false une fois lu, null tant qu'il ne l'est pas ou
// quand il est illisible. Éteint dans les deux cas (voir decideNavigationV2).
let reglage = null;

// Navigation de la session : une seule décision, prise par chargerNavigationV2() au démarrage
// et rendue telle quelle par navigationV2Active(). Éteinte avant tout chargement.
let decision = false;

// Lu au démarrage (la promo courante est connue), avant le premier rendu. Une lecture qui échoue
// ou qui dépasse le délai laisse éteint, et une réponse arrivée après le délai est ignorée : la
// navigation ne bascule pas en cours de session, sous une coquille déjà posée. Fixe la décision
// de la session (aperçu du fondateur compris) et la rend.
export async function chargerNavigationV2() {
  let lu = null;
  let minuteur;
  // Une réponse arrivée après le délai ne change pas la session, mais l'appareil la garde pour la suivante.
  const lecture = getSetting(CLE_REGLAGE).then((v) => { lu = reglageAllume(v); memoriserReglage(lu); }, () => {});
  const delai = new Promise((r) => { minuteur = setTimeout(r, DELAI_LECTURE_MS); });
  await Promise.race([lecture, delai]);
  clearTimeout(minuteur);
  reglage = lu;
  decision = decisionDuMoment();
  return decision;
}

// Aperçu du fondateur sur cet appareil : "1", "0" ou null. Un stockage inaccessible (navigation
// privée, données bloquées) vaut « pas d'aperçu ».
function lireApercu() {
  try { return localStorage.getItem(CLE_APERCU); } catch (e) { return null; }
}

// Dernier réglage lu de la promo affichée, gardé sur l'appareil (ruling R17) : à l'ouverture suivante,
// l'ancienne barre attend la décision sans se peindre quand la coquille doit la remplacer. Seul « allumé »
// laisse une trace ; une lecture ratée ne fait rien oublier.
function memoriserReglage(allume) {
  const cle = cleMemoire(getPromoCourante()?.id);
  if (!cle) return;
  try {
    if (allume) localStorage.setItem(cle, "1");
    else localStorage.removeItem(cle);
  } catch (e) { /* stockage bloqué : l'ancienne barre se peindra avant la coquille, comme avant */ }
}

// À l'ouverture, avant toute lecture : la nouvelle navigation est-elle attendue ? Le dernier réglage lu
// de la promo sur cet appareil, ou l'aperçu du fondateur (navigationAttendue). Ne décide rien pour la
// session : seul chargerNavigationV2() le fait.
export function navigationV2Attendue() {
  const cle = cleMemoire(getPromoCourante()?.id);
  let memoire = null;
  try { memoire = cle ? localStorage.getItem(cle) : null; } catch (e) { memoire = null; }
  return navigationAttendue({ memoire, apercu: lireApercu(), fondateur: isFounder() });
}

// Pose l'aperçu, ou le retire avec null (l'appareil suit de nouveau le réglage de la promo).
// Rend faux si le stockage refuse l'écriture.
function ecrireApercu(valeur) {
  try {
    if (valeur === null) localStorage.removeItem(CLE_APERCU);
    else localStorage.setItem(CLE_APERCU, valeur);
    return true;
  } catch (e) { return false; }
}

// Ce que montrerait une ouverture de l'app maintenant : le réglage lu et l'aperçu de l'appareil.
function decisionDuMoment() {
  return decideNavigationV2({ reglagePromo: reglage, apercu: lireApercu(), fondateur: isFounder() });
}

// La navigation de la session, fixée par le dernier chargerNavigationV2() : les pages la lisent
// à chaque rendu et doivent toutes donner la même réponse que la coquille. Une case cochée dans
// Paramètres compte donc à la prochaine ouverture, comme ses textes l'annoncent.
export function navigationV2Active() {
  return decision;
}

// Prévient (comme « emargement-actif » pour le bandeau) qu'une case cochée dans Paramètres vient
// de changer ce que montrera la prochaine ouverture (detail.actif) ; la session en cours garde sa
// navigation.
function annoncerChangement() {
  window.dispatchEvent(new CustomEvent("navigation-v2-change", { detail: { actif: decisionDuMoment() } }));
}

// Section de Paramètres, visible du seul fondateur : l'interrupteur de la promo affichée, puis
// l'aperçu de cet appareil.
export function renderNavigationReglage() {
  if (!isFounder()) return null;
  const nomPromo = getPromoCourante()?.nom || "cette promo";
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.signpost()),
    el("div", {},
      el("h3", {}, "Nouvelle navigation"),
      el("p", { class: "muted" }, "Réservé au fondateur. Le réglage est propre à la promo affichée, l'aperçu à cet appareil."),
    ),
  ));

  const blocPromo = el("div", { class: "param-block" });
  blocPromo.appendChild(el("h4", {}, "Promo affichée"));
  blocPromo.appendChild(el("p", { class: "muted" },
    "Allumée, les stagiaires et les formateurs de la promo passent à la nouvelle barre de navigation "
    + "à leur prochaine ouverture de l'app. Éteinte (réglage par défaut), la promo garde la barre actuelle."));
  const casePromo = el("input", { type: "checkbox", id: "navigation-v2-promo" });
  casePromo.checked = reglage === true;
  casePromo.addEventListener("change", async () => {
    const voulu = casePromo.checked;
    casePromo.disabled = true;
    try {
      await setSetting(CLE_REGLAGE, voulu ? "true" : "false");
      reglage = voulu;
      memoriserReglage(voulu);
      toast(voulu ? `Nouvelle navigation activée pour ${nomPromo}.` : `Nouvelle navigation désactivée pour ${nomPromo}.`, "success");
      annoncerChangement();
    } catch (e) {
      casePromo.checked = !voulu;
      toast("Erreur : " + (e?.message || e), "error");
    } finally {
      casePromo.disabled = false;
    }
  });
  blocPromo.appendChild(el("label", { for: "navigation-v2-promo", class: "invite-admin-toggle" },
    casePromo, ` Nouvelle navigation activée pour « ${nomPromo} »`));
  section.appendChild(blocPromo);

  const blocApercu = el("div", { class: "param-block" });
  blocApercu.appendChild(el("h4", {}, "Cet appareil"));
  blocApercu.appendChild(el("p", { class: "muted" },
    "Pour essayer avant d'allumer la promo. Coché, cet appareil affiche la nouvelle navigation quel que "
    + "soit le réglage de la promo ; décoché, il suit le réglage. Seul le fondateur dispose de cet aperçu, "
    + "pris en compte à la prochaine ouverture de l'app."));
  const caseApercu = el("input", { type: "checkbox", id: "navigation-v2-apercu" });
  caseApercu.checked = lireApercu() === "1";
  caseApercu.addEventListener("change", () => {
    const voulu = caseApercu.checked;
    if (!ecrireApercu(voulu ? "1" : null)) {
      caseApercu.checked = !voulu;
      toast("Cet appareil ne garde pas l'aperçu (stockage bloqué ou navigation privée).", "error");
      return;
    }
    toast(voulu ? "Aperçu activé sur cet appareil." : "Aperçu retiré de cet appareil.", "success");
    annoncerChangement();
  });
  blocApercu.appendChild(el("label", { for: "navigation-v2-apercu", class: "invite-admin-toggle" },
    caseApercu, " Aperçu sur cet appareil"));
  section.appendChild(blocApercu);
  return section;
}
