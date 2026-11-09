// Émargement : interrupteur par promo (demande de Timy du 23/10). Éteint par défaut ; allumé,
// il fait apparaître la tuile d'Accueil, le bouton du Planning, la page et le bandeau. Seul le
// fondateur le règle (Paramètres). La base refuse aussi d'ouvrir une feuille quand il est éteint
// (migration 20261023_emargement, fonction emargement_ouvrir).

import { getSetting, setSetting, getPromoCourante, lireReglagePromo } from "./db.js?v=20261109a";
import { el, toast } from "./utils.js?v=20261109a";
import { icon } from "./icons.js?v=20261109a";
import { fondateurHorsApercu } from "./auth-admin.js?v=20261109a";
import { CLE_ACTIVATION, estActif } from "./emargement-rules.js?v=20261109a";

let actif = false;

// Lu au démarrage (la promo courante est connue) ; une lecture qui échoue laisse éteint.
// Bornée comme celle des modules : au-delà de 3,5 s, l'app démarre éteinte pour l'émargement.
export async function chargerEmargementActif() {
  const lecture = getSetting(CLE_ACTIVATION).then((v) => { actif = estActif(v); }, () => { actif = false; });
  await Promise.race([lecture, new Promise((r) => setTimeout(r, 3500))]);
  return actif;
}

export function emargementActif() { return actif; }

// --- Direction (lot 5, Task 7) : l'entrée Émargement de la barre s'allume quand une promo du centre a l'interrupteur. ---
// Lu une fois au démarrage (un réglage par promo du centre, par l'en-tête de lecture) et gardé : la barre se dessine de façon
// synchrone. Une lecture qui échoue ou dépasse 3,5 s laisse la promo éteinte (comme chargerEmargementActif).
let actifsDuCentre = new Set();

export async function chargerEmargementCentre(promos) {
  actifsDuCentre = new Set();
  const lectures = (promos || []).map((p) => lireReglagePromo(p.id, CLE_ACTIVATION)
    .then((v) => { if (estActif(v)) actifsDuCentre.add(p.id); }, () => { /* éteinte */ }));
  await Promise.race([Promise.all(lectures), new Promise((r) => setTimeout(r, 3500))]);
  return emargementDansLeCentre();
}

export function emargementDansLeCentre() { return actifsDuCentre.size > 0; }

// Section de Paramètres, visible du seul fondateur. Le bandeau suit par l'évènement
// « emargement-actif » (pas d'import du bandeau ici : il importe ce module).
export function renderEmargementReglage() {
  // Hors aperçu seulement : en aperçu, la base refuse l'écriture (est_fondateur faux), et le rôle simulé n'a pas ce réglage.
  if (!fondateurHorsApercu()) return null;
  const nomPromo = getPromoCourante()?.nom || "cette promo";
  const section = el("section", { class: "param-section" });
  section.appendChild(el("div", { class: "param-section-head" },
    el("div", { class: "param-icon" }, icon.clipboard()),
    el("div", {},
      el("h3", {}, "Émargement"),
      el("p", { class: "muted" }, "Réglage réservé au fondateur, propre à la promo affichée."),
    ),
  ));
  const bloc = el("div", { class: "param-block" });
  bloc.appendChild(el("p", { class: "muted" },
    "Allumé, l'émargement signé apparaît pour les formateurs de la promo (tuile d'Accueil, bouton du "
    + "Planning) et les stagiaires voient le bandeau « Signer » dès qu'une feuille est ouverte. "
    + "Éteint, plus aucune feuille ne peut s'ouvrir ; les feuilles déjà faites restent en base."));
  const caseActif = el("input", { type: "checkbox", id: "emargement-actif" });
  caseActif.checked = actif;
  caseActif.addEventListener("change", async () => {
    const voulu = caseActif.checked;
    caseActif.disabled = true;
    try {
      await setSetting(CLE_ACTIVATION, voulu ? "true" : "false");
      actif = voulu;
      toast(voulu ? `Émargement activé pour ${nomPromo}.` : `Émargement désactivé pour ${nomPromo}.`, "success");
      window.dispatchEvent(new CustomEvent("emargement-actif"));
    } catch (e) {
      caseActif.checked = !voulu;
      toast("Erreur : " + (e?.message || e), "error");
    } finally {
      caseActif.disabled = false;
    }
  });
  bloc.appendChild(el("label", { for: "emargement-actif", class: "invite-admin-toggle" },
    caseActif, ` Émargement activé pour « ${nomPromo} »`));
  section.appendChild(bloc);
  return section;
}
