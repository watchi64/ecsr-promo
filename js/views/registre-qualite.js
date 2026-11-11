// Sous-onglet « Registre qualité » de la page Qualiopi (Q4, indicateurs 31 et 32) : réclamations, difficultés, aléas,
// améliorations et risques de tout l'organisme (le choix de promo de la page ne le filtre pas). Filtres par état et par
// type, « Ajouter », une carte par entrée (toucher une carte l'ouvre en modification, sauf une entrée effacée, en lecture
// seule), « Exporter en tableau (CSV) » de la liste filtrée, et « Effacer les textes » quand des entrées closes ont passé leurs
// 3 ans. Page de l'équipe : ses textes vouvoient (règle du 10/11).
// Une liste de cartes, jamais un tableau, sur téléphone comme sur ordinateur. La page lit le registre (js/views/qualiopi.js) :
// `lire()` rend la lecture en cours ou faite ({ etat: "lue", entrees } | { etat: "absente" } | { etat: "non_lue" }),
// `surChangement()` la refait (après un enregistrement, un effacement, ou « Réessayer ») et rend la nouvelle.

import { el, clear, toast } from "../utils.js?v=20261111f";
import { getMesPromos, effacerRegistreQualite } from "../db.js?v=20261111f";
import { TYPES, ORIGINES, ETATS, filtrerRegistre, registreCsv, nomFichierRegistre, aEffacer } from "../registre-rules.js?v=20261111f";
import { jourParis } from "../questionnaires-gestion-rules.js?v=20261111f";
import { nomPromo } from "../qualiopi-page-rules.js?v=20261111f";
import { nb } from "../qualiopi-preuves.js?v=20261111f";
import { confirmer } from "../confirmer.js?v=20261111f";
import { telecharger } from "./centre.js?v=20261111f";
import { ouvrirFenetreRegistre, lieuxDesPromos } from "../registre-fenetre.js?v=20261111f";

export const REGISTRE_ABSENT = "Le registre sera disponible après la mise à jour de la base.";
const FILTRES_ETAT = [["tous", "Tous"], ["ouvert", "Ouverts"], ["en_cours", "En cours"], ["clos", "Clos"]];

// Les filtres survivent au redessin et au passage d'un sous-onglet à l'autre, le temps de la page.
const filtres = { etat: "tous", type: "tous" };

const jour = (v) => (v ? String(v).slice(0, 10) : "");
const enFrancais = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "date inconnue");
const estEfface = (e) => e?.efface_le != null;

// « Réponse en 4 jours », « Réponse le jour même », « Sans réponse ».
function delaiEnMots(e) {
  if (!e.date_reponse) return "Sans réponse";
  const [d, r] = [jour(e.date_constat), jour(e.date_reponse)];
  const jours = Math.round((Date.parse(r + "T00:00:00Z") - Date.parse(d + "T00:00:00Z")) / 86400000);
  if (!Number.isFinite(jours)) return "Réponse le " + enFrancais(r);
  return jours <= 0 ? "Réponse le jour même" : `Réponse en ${nb(jours, "jour")}`;
}

// Où se range l'entrée : sa promo, sinon son centre, sinon tout l'organisme.
function rangement(e, nomsPromos, nomsLieux) {
  if (e.promo_id != null) return nomsPromos.get(Number(e.promo_id)) ?? `Promo n° ${e.promo_id}`;
  if (e.lieu_id != null) return nomsLieux.get(Number(e.lieu_id)) ?? `Centre n° ${e.lieu_id}`;
  return "Tout l'organisme";
}

function contenuCarte(e, nomsPromos, nomsLieux) {
  const efface = estEfface(e);
  return [
    el("span", { class: "rg-carte-tete" },
      el("span", { class: "rg-carte-type" }, TYPES[e.type] ?? e.type),
      el("span", { class: "rg-carte-etat " + (e.etat || "") }, ETATS[e.etat] ?? e.etat)),
    el("span", { class: "rg-carte-meta" },
      [enFrancais(jour(e.date_constat)), ORIGINES[e.origine] ?? e.origine, rangement(e, nomsPromos, nomsLieux)].join(" · "),
      e.issu_signalement ? el("span", { class: "rg-carte-marque" }, "issue d'un problème signalé") : null),
    efface
      ? el("span", { class: "rg-carte-efface" }, `Textes effacés le ${enFrancais(jourParis(e.efface_le) || "")}`)
      : el("span", { class: "rg-carte-desc" }, e.description || ""),
    el("span", { class: "rg-carte-delai" }, delaiEnMots(e)),
  ];
}

export function renderRegistreQualite(panneau, { lire, surChangement }) {
  const racine = el("section", { class: "rg-registre", "aria-labelledby": "rg-titre-registre" });
  panneau.appendChild(racine);
  const vivant = () => racine.isConnected;
  let occupe = false;

  // `focus` : après un enregistrement, la carte de l'entrée (son numéro), ou « ajouter » ; sinon rien.
  async function afficher(lecture, focus = null) {
    clear(racine);
    racine.append(
      el("h3", { class: "qualiopi-titre", id: "rg-titre-registre" }, "Registre qualité"),
      el("p", { class: "qualiopi-intro" },
        "Réclamations, difficultés, aléas, améliorations et risques de tout l'organisme (indicateurs 31 et 32). "
        + "Le choix de promo de la page ne filtre pas ce registre."),
      el("div", { class: "loading" }, "Chargement"));
    let registre;
    try {
      registre = await lecture;
    } catch (e) {
      console.error(e);
      registre = { etat: "non_lue" };
    }
    if (!vivant()) return;
    racine.lastChild.remove();
    if (!registre || registre.etat === "non_lue") {
      racine.appendChild(el("div", { class: "centre-erreur qualiopi-erreur", role: "alert" },
        el("p", {}, "Le registre n'a pas pu être lu."),
        el("button", { class: "btn small", type: "button", onClick: () => afficher(surChangement()) }, "Réessayer")));
      return;
    }
    if (registre.etat === "absente") {
      racine.appendChild(el("p", { class: "qualiopi-vide" }, REGISTRE_ABSENT));
      return;
    }
    dessiner(registre.entrees || [], focus);
  }

  function dessiner(entrees, focus) {
    const promos = getMesPromos();
    const nomsPromos = new Map(promos.map((p) => [Number(p.id), nomPromo(p)]));
    const nomsLieux = new Map(lieuxDesPromos(promos).map((l) => [l.id, l.nom]));
    const zone = el("div", { class: "rg-zone" });
    racine.appendChild(zone);

    // Après un enregistrement ou un effacement : relire, redessiner, et rendre le focus.
    async function apresChangement(focusApres) {
      await afficher(surChangement(), focusApres);
    }

    const ouvrir = (ancre, entree = null) => ouvrirFenetreRegistre({
      entree, promos, ancre, surEnregistre: (enregistree) => {
        if (vivant()) apresChangement(enregistree?.id ?? (entree ? entree.id : "ajouter"));
      },
    });

    const boutonAjouter = el("button", { class: "btn primary", type: "button", "data-rg": "ajouter" }, "Ajouter");
    boutonAjouter.addEventListener("click", () => ouvrir(boutonAjouter));
    const boutonExporter = el("button", { class: "btn", type: "button", "data-rg": "exporter" }, "Exporter en tableau (CSV)");

    // --- Effacement à 3 ans ---
    const dus = aEffacer(entrees, new Date());
    let blocEffacement = null;
    if (dus.length) {
      const boutonEffacer = el("button", { class: "btn", type: "button", "data-rg": "effacer" }, "Effacer les textes");
      boutonEffacer.addEventListener("click", async () => {
        if (occupe) return;
        const oui = await confirmer({
          titre: `Effacer les textes de ${nb(dus.length, "entrée")} ?`,
          phrase: "La description, la réponse, l'action décidée et la mesure de prévention sont vidées pour de bon. Le type, "
            + "l'origine, la promo, le centre, les dates et l'état restent.",
          oui: "Effacer les textes",
        });
        if (!oui || !vivant()) return;
        occupe = true;
        boutonEffacer.disabled = true;
        try {
          const n = await effacerRegistreQualite();
          toast(n ? `${nb(n, "entrée effacée", "entrées effacées")}` : "Aucune entrée à effacer", "success");
          if (vivant()) await apresChangement("ajouter");
        } catch (e) {
          console.error(e);
          if (vivant()) {
            statut.textContent = e.message || "L'effacement n'a pas abouti.";
            boutonEffacer.disabled = false;
          }
        } finally {
          occupe = false;
        }
      });
      blocEffacement = el("div", { class: "rg-effacement" },
        el("p", {}, `${nb(dus.length, "entrée close", "entrées closes")} depuis plus de 3 ans : leurs textes sont à effacer.`),
        boutonEffacer);
    }

    // --- Filtres ---
    const boutonsEtat = FILTRES_ETAT.map(([cle, libelle]) => {
      const b = el("button", { class: "rg-filtre", type: "button", "data-etat": cle, "aria-pressed": filtres.etat === cle ? "true" : "false" }, libelle);
      b.addEventListener("click", () => {
        filtres.etat = cle;
        boutonsEtat.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
        majListe();
      });
      return b;
    });
    const choixType = el("select", { id: "rg-filtre-type", class: "qualiopi-select rg-filtre-type" },
      el("option", { value: "tous" }, "Tous les types"),
      ...Object.entries(TYPES).map(([cle, libelle]) => el("option", { value: cle }, libelle)));
    choixType.value = filtres.type;
    choixType.addEventListener("change", () => { filtres.type = choixType.value; majListe(); });

    const statut = el("p", { class: "rg-statut", role: "status" });
    const liste = el("ul", { class: "rg-cartes" });
    let filtrees = [];

    function carte(e) {
      if (estEfface(e)) {
        return el("li", {}, el("article", { class: "rg-carte rg-carte-lecture", "data-id": String(e.id), "aria-label": `Entrée n° ${e.id}, textes effacés` },
          ...contenuCarte(e, nomsPromos, nomsLieux)));
      }
      const bouton = el("button", { type: "button", class: "rg-carte", "data-id": String(e.id) }, ...contenuCarte(e, nomsPromos, nomsLieux));
      bouton.addEventListener("click", () => ouvrir(bouton, e));
      return el("li", {}, bouton);
    }

    function majListe() {
      filtrees = filtrerRegistre(entrees, filtres);
      clear(liste);
      liste.append(...filtrees.map(carte));
      statut.textContent = entrees.length === 0
        ? "Aucune entrée au registre pour l'instant."
        : filtrees.length === entrees.length
          ? nb(entrees.length, "entrée")
          : `${nb(filtrees.length, "entrée")} sur ${entrees.length}`;
    }

    boutonExporter.addEventListener("click", () => {
      try {
        const nomsP = Object.fromEntries(nomsPromos);
        const nomsL = Object.fromEntries(nomsLieux);
        telecharger(nomFichierRegistre(jourParis(new Date())), registreCsv(filtrees, nomsP, nomsL));
        toast("Registre téléchargé", "success");
      } catch (e) {
        console.error(e);
        statut.textContent = "Le registre n'a pas pu être téléchargé. Rechargez la page, puis réessayez.";
      }
    });

    zone.append(...[
      el("div", { class: "qualiopi-boutons rg-actions-page" }, boutonAjouter, boutonExporter),
      el("p", { class: "qualiopi-aide" }, "L'export reprend la liste filtrée. Le fichier contient les descriptions : ne le transmettez qu'à l'auditeur."),
      blocEffacement,
      el("div", { class: "rg-filtres" },
        el("div", { class: "rg-filtres-etat", role: "group", "aria-label": "Filtrer par état" }, ...boutonsEtat),
        el("div", { class: "rg-filtre-type-bloc" },
          el("label", { for: "rg-filtre-type", class: "rg-filtre-etiquette" }, "Type"),
          choixType)),
      statut,
      liste,
    ].filter(Boolean));
    majListe();

    if (focus === "ajouter") boutonAjouter.focus();
    else if (focus != null) (liste.querySelector(`[data-id="${focus}"]`) || boutonAjouter).focus();
  }

  afficher(lire());
}
