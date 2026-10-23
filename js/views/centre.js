// Tableau de bord du centre (spec docs/superpowers/specs/2026-10-23-tableau-de-bord-centre-design.md).
// Réservé au personnel (porte dans main.js). Par promo : effectif, abandons, assiduité, passages,
// résultats, thèmes à retravailler, stagiaires à suivre ; comparaison des promos ; export PDF A4
// (impression du navigateur) et CSV de la matrice des notes. Les calculs vivent dans
// js/centre-stats.js et js/centre-csv.js (purs, testés) : ici, seulement l'affichage.

import { lireDonneesCentre, lireReferentielCentre, getMesPromos, getPromoCourante } from "../db.js?v=20261023d";
import { el, clear, isoDate, formatDate, displayStagiaire, toast } from "../utils.js?v=20261023d";
import { icon } from "../icons.js?v=20261023d";
import { indicateursPromo, ligneComparaison, METHODES } from "../centre-stats.js?v=20261023d";
import { matriceNotesCsv, nomFichierCsv } from "../centre-csv.js?v=20261023d";

let rendu = 0;   // un rendu plus récent rend caduc celui qui attend encore ses données

const pct = (x) => Math.round(x * 100) + " %";
const fr1 = (x) => x.toFixed(1).replace(".", ",");
const entier = (x) => Number(x).toLocaleString("fr-FR");
const pluriel = (nb, mot, motPluriel = mot + "s") => `${entier(nb)} ${nb > 1 ? motPluriel : mot}`;

const LIBELLES_COMPARAISON = [
  ["effectif", "Effectif"],
  ["abandon", "Taux d'abandon"],
  ["absences", "Absences aux passages prévus"],
  ["passages", "Passages réalisés"],
  ["reussiteQcm", "Réussite aux QCM d'entraînement"],
  ["examensQcm", "Examens QCM réussis"],
  ["notes", "Moyenne des notes"],
  ["epcf", "Critères EPCF acquis"],
];

const LIBELLES_METHODES = [
  ["effectif", "Effectif"], ["abandon", "Taux d'abandon"], ["valeurAbandons", "Valeur des parcours interrompus"],
  ["absences", "Absences aux passages prévus"], ["passages", "Passages réalisés"],
  ["activiteQcm", "Activité QCM"], ["reussiteQcm", "Réussite aux QCM d'entraînement"],
  ["examensQcm", "Examens QCM"], ["notes", "Notes"], ["epcf", "EPCF"], ["titre", "Réussite au titre"],
  ["themes", "Thèmes à retravailler"], ["aSuivre", "À suivre de près"],
];

function etiquette(nature, nuance) {
  const cls = nature === "estimé" ? "estime" : nature === "non mesuré" ? "non-mesure" : "mesure";
  const texte = nature.charAt(0).toUpperCase() + nature.slice(1) + (nuance ? ", " + nuance : "");
  return el("span", { class: "centre-nature " + cls }, texte);
}

function methode(cle) {
  return el("details", { class: "centre-methode" },
    el("summary", {}, "Méthode"),
    el("p", {}, METHODES[cle]));
}

// Carte d'un indicateur : valeur, détail, nature, méthode repliée.
function carte({ titre, valeur, detail, nature, nuance, cle }) {
  return el("article", { class: "centre-carte" },
    el("div", { class: "centre-carte-tete" }, el("h4", {}, titre), etiquette(nature, nuance)),
    el("p", { class: "centre-valeur" + (valeur == null ? " vide" : "") }, valeur ?? "Aucune donnée"),
    detail ? el("p", { class: "centre-detail" }, detail) : null,
    methode(cle));
}

function cartesCles(ind) {
  const ef = ind.effectif.detail;
  const ab = ind.abandon;
  const va = ind.valeurAbandons.valeur;
  const absd = ind.absences.detail;
  const pa = ind.passages.detail;
  const plage = (t) => (t.min === t.max ? `${t.min} chacun` : `${t.min} à ${t.max} par personne`);
  return [
    carte({ cle: "effectif", titre: "Effectif", nature: "mesuré",
      valeur: pluriel(ef.inscrits, "inscrit"),
      detail: `${pluriel(ef.enFormation, "en formation", "en formation")} · ${pluriel(ef.abandons, "abandon")}` }),
    carte({ cle: "abandon", titre: "Taux d'abandon", nature: "mesuré",
      valeur: ab.valeur == null ? null : pct(ab.valeur),
      detail: ab.valeur == null ? null : `${pluriel(ab.detail.abandons, "abandon")} sur ${pluriel(ab.detail.inscrits, "inscrit")}` }),
    carte({ cle: "valeurAbandons", titre: "Valeur des parcours interrompus", nature: "estimé",
      valeur: va == null ? null : (va[1] === 0 ? "0 €" : `${entier(va[0])} à ${entier(va[1])} €`),
      detail: va == null ? null : "Hypothèse : 3 500 à 5 000 € par parcours" }),
    carte({ cle: "absences", titre: "Absences aux passages prévus", nature: "mesuré", nuance: "partiel",
      valeur: ind.absences.valeur == null ? null : pct(ind.absences.valeur),
      detail: ind.absences.valeur == null ? null
        : `${pluriel(absd.absences, "absence")} de dernière minute sur ${pluriel(absd.prevus, "passage prévu", "passages prévus")}` }),
    carte({ cle: "passages", titre: "Passages réalisés", nature: "mesuré",
      valeur: ind.passages.valeur == null ? null : `${fr1(ind.passages.valeur)} par stagiaire`,
      detail: ind.passages.valeur == null ? null
        : `Salle : ${entier(pa.salle.total)} (${plage(pa.salle)}) · Voiture : ${entier(pa.voiture.total)} (${plage(pa.voiture)})` }),
  ];
}

function cartesResultats(ind) {
  const aq = ind.activiteQcm.detail;
  const rq = ind.reussiteQcm.detail;
  const ex = ind.examensQcm.detail;
  const no = ind.notes.detail;
  const ep = ind.epcf.detail;
  const grille = (nom, g) => (g.evalues
    ? `${nom} : ${g.evalues}/${g.enFormation} évalués, score ${pct(g.score)}`
    : `${nom} : aucune évaluation`);
  return [
    carte({ cle: "activiteQcm", titre: "Activité QCM", nature: "mesuré",
      valeur: ind.activiteQcm.valeur == null ? null : pct(ind.activiteQcm.valeur),
      detail: ind.activiteQcm.valeur == null ? null
        : `${aq.actifs} stagiaire${aq.actifs > 1 ? "s" : ""} sur ${aq.enFormation} · ${pluriel(aq.questions, "question répondue", "questions répondues")}` }),
    carte({ cle: "reussiteQcm", titre: "Réussite aux QCM d'entraînement", nature: "mesuré",
      valeur: ind.reussiteQcm.valeur == null ? null : pct(ind.reussiteQcm.valeur),
      detail: ind.reussiteQcm.valeur == null ? null
        : `${pluriel(rq.bonnes, "bonne réponse", "bonnes réponses")} sur ${entier(rq.questions)}` }),
    carte({ cle: "examensQcm", titre: "Examens QCM", nature: "mesuré",
      valeur: ind.examensQcm.valeur == null ? null : pct(ind.examensQcm.valeur),
      detail: ind.examensQcm.valeur == null ? "Aucun examen passé"
        : `${ex.reussis} réussi${ex.reussis > 1 ? "s" : ""} sur ${ex.passes} · moyenne ${fr1(ex.moyenne20)}/20` }),
    carte({ cle: "notes", titre: "Notes", nature: "mesuré",
      valeur: ind.notes.valeur == null ? null : `${fr1(ind.notes.valeur)}/20`,
      detail: ind.notes.valeur == null ? null
        : `${pluriel(no.n, "note")} · médiane ${fr1(no.mediane)} · ${entier(no.sous10)} sous 10` }),
    carte({ cle: "epcf", titre: "EPCF", nature: "mesuré",
      valeur: ind.epcf.valeur == null ? null : `${pct(ind.epcf.valeur)} acquis`,
      detail: ind.epcf.valeur == null ? null : `${grille("Salle", ep.salle)} · ${grille("Véhicule", ep.vehicule)}` }),
    carte({ cle: "titre", titre: "Réussite au titre", nature: "non mesuré",
      valeur: "Non mesuré", detail: "Résultats de jury non saisis dans l'app" }),
  ];
}

const nomTheme = (t) => (t.num != null ? `Thème ${String(t.num).padStart(2, "0")} · ${t.titre}` : t.titre);

function sectionThemes(themes) {
  const liste = (titre, lignes, vide, valeur) => el("div", { class: "centre-themes-liste" },
    el("h4", {}, titre),
    lignes.length
      ? el("ol", {}, ...lignes.map((t) => el("li", {},
          el("span", { class: "centre-theme-nom" }, nomTheme(t)),
          el("span", { class: "centre-theme-val" }, valeur(t)))))
      : el("p", { class: "muted" }, vide));
  const cellule = (v) => el("td", { class: "num" }, v);
  const tableau = el("details", { class: "centre-themes-tout" },
    el("summary", {}, `Tous les thèmes (${themes.complet.length})`),
    el("div", { class: "centre-defile" }, el("table", { class: "centre-table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Thème"), el("th", {}, "QCM"), el("th", {}, "Réponses"),
        el("th", {}, "Notes"), el("th", {}, "Nb de notes"))),
      el("tbody", {}, ...themes.complet.map((t) => el("tr", {},
        el("td", {}, nomTheme(t)),
        cellule(t.qcmTaux == null ? "" : pct(t.qcmTaux)), cellule(t.qcmN ? entier(t.qcmN) : ""),
        cellule(t.notesMoy == null ? "" : fr1(t.notesMoy)), cellule(t.notesN || "")))))));
  return el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Thèmes à retravailler"), etiquette("mesuré")),
    el("div", { class: "centre-themes" },
      liste("D'après les QCM", themes.qcm, "Pas encore assez de réponses (20 par thème au minimum).",
        (t) => `${pct(t.taux)} · ${pluriel(t.n, "réponse")}`),
      liste("D'après les notes", themes.notes, "Pas encore assez de notes (3 par thème au minimum).",
        (t) => `${fr1(t.moyenne)}/20 · ${pluriel(t.n, "note")}`)),
    themes.complet.length ? tableau : null,
    methode("themes"));
}

function sectionASuivre(aSuivre) {
  return el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "À suivre de près"), etiquette("estimé")),
    el("p", { class: "centre-intro" },
      "Stagiaires qui cumulent au moins deux signaux. Un repère pour en parler avec eux, pas une prédiction."),
    aSuivre.length
      ? el("ul", { class: "centre-suivre" }, ...aSuivre.map((x) => el("li", {},
          el("a", { class: "centre-suivre-nom", href: "#/stagiaires/" + x.stagiaire.id }, displayStagiaire(x.stagiaire)),
          el("span", { class: "centre-signaux" }, ...x.signaux.map((s) => el("span", { class: "chip centre-signal" }, s.texte))))))
      : el("p", { class: "muted" }, "Personne ne cumule deux signaux."),
    methode("aSuivre"));
}

function sectionComparaison(promos, courante, indCourant) {
  const ordre = [courante, ...promos.filter((p) => p.id !== courante.id)];
  const cases = new Map();   // `${promoId}:${cle}` → td
  const table = el("table", { class: "centre-table centre-comparaison" },
    el("thead", {}, el("tr", {}, el("th", {}, "Indicateur"), ...ordre.map((p) => el("th", { scope: "col" }, p.nom)))),
    el("tbody", {}, ...LIBELLES_COMPARAISON.map(([cle, libelle]) => el("tr", {},
      el("th", { scope: "row" }, libelle),
      ...ordre.map((p) => {
        const td = el("td", { class: "num" + (p.id === courante.id ? " courante" : "") }, "chargement…");
        cases.set(p.id + ":" + cle, td);
        return td;
      })))));
  const remplir = (promoId, ligne) => LIBELLES_COMPARAISON.forEach(([cle]) => {
    const td = cases.get(promoId + ":" + cle);
    if (td) td.textContent = ligne ? ligne[cle] : "non chargée";
  });
  remplir(courante.id, ligneComparaison(indCourant));
  const section = el("section", { class: "centre-section" },
    el("div", { class: "centre-section-tete" }, el("h3", {}, "Comparer les promos"), etiquette("mesuré")),
    el("p", { class: "centre-intro" }, "Mêmes méthodes pour chaque promo, sans aucun nom."),
    el("div", { class: "centre-defile" }, table));
  return { section, autres: ordre.slice(1), remplir };
}

function sectionMethodes() {
  return el("section", { class: "centre-section" },
    el("details", { class: "centre-methodes" },
      el("summary", {}, "Méthodes de calcul"),
      el("p", { class: "centre-intro" },
        "Mesuré : compté dans les données de l'app. Estimé : hypothèse ou signal. Non mesuré : l'app ne le sait pas."),
      el("dl", {}, ...LIBELLES_METHODES.flatMap(([cle, libelle]) => [el("dt", {}, libelle), el("dd", {}, METHODES[cle])]))));
}

// --- Export PDF : impression du navigateur, A4 portrait, méthodes dépliées ---
const ID_PAGE = "centre-page-style";
let detailsRefermer = [];

export function teardownCentrePrint() {
  document.getElementById(ID_PAGE)?.remove();
  document.body.classList.remove("centre-printable");
  detailsRefermer.forEach((d) => { d.open = false; });
  detailsRefermer = [];
}

function imprimer(racine) {
  teardownCentrePrint();
  const st = document.createElement("style");
  st.id = ID_PAGE;
  st.textContent = "@page { size: A4 portrait; margin: 12mm; }";
  document.head.appendChild(st);
  document.body.classList.add("centre-printable");
  detailsRefermer = [...racine.querySelectorAll("details:not([open])")];
  detailsRefermer.forEach((d) => { d.open = true; });
  const fin = () => { window.removeEventListener("afterprint", fin); teardownCentrePrint(); };
  window.addEventListener("afterprint", fin);
  window.print();
}

// --- Export CSV ---
function telecharger(nomFichier, texte) {
  const url = URL.createObjectURL(new Blob([texte], { type: "text/csv;charset=utf-8" }));
  const a = el("a", { href: url, download: nomFichier, style: "display:none" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ouvrirExportCsv(promo, donnees) {
  const fond = el("div", { class: "modal-backdrop" });
  const caseAnon = el("input", { type: "checkbox", id: "centre-csv-anon" });
  const fermer = () => fond.remove();
  const valider = () => {
    const anonymiser = caseAnon.checked;
    const texte = matriceNotesCsv({ stagiaires: donnees.stagiaires, evaluations: donnees.evaluations, anonymiser });
    telecharger(nomFichierCsv(promo?.nom || "promo", isoDate(new Date())), texte);
    toast(anonymiser ? "Matrice anonyme téléchargée" : "Matrice des notes téléchargée", "success");
    fermer();
  };
  fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });
  fond.appendChild(el("div", { class: "modal centre-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "centre-csv-titre" },
    el("h3", { id: "centre-csv-titre" }, "Matrice des notes (CSV)"),
    el("p", {}, "Une ligne par stagiaire en formation, une colonne par compétence et par thème : la dernière note, ramenée sur 20, et la moyenne de toutes les notes. Le fichier s'ouvre dans Excel."),
    el("p", { class: "centre-avertissement" }, "Le fichier contient des notes nominatives : il reste dans l'équipe pédagogique. Pour le transmettre au-delà, remplacez les noms par des numéros."),
    el("label", { class: "centre-case", for: "centre-csv-anon" }, caseAnon, "Remplacer les noms par des numéros"),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: fermer }, "Annuler"),
      el("button", { class: "btn primary", type: "button", onClick: valider }, "Télécharger"))));
  document.body.appendChild(fond);
}

// --- Page ---
export async function renderCentre(container) {
  const jeton = ++rendu;
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const promo = getPromoCourante();
  let referentiel, donnees;
  try {
    [referentiel, donnees] = await Promise.all([lireReferentielCentre(), lireDonneesCentre(promo?.id ?? null)]);
  } catch (e) {
    console.error(e);
    if (jeton !== rendu) return;
    clear(container);
    container.appendChild(el("div", { class: "centre-erreur" },
      el("p", {}, "Le tableau de bord n'a pas pu être chargé."),
      el("button", { class: "btn small", type: "button", onClick: () => renderCentre(container) }, "Réessayer")));
    return;
  }
  if (jeton !== rendu) return;
  const aujourdhui = isoDate(new Date());
  const ind = indicateursPromo(donnees, referentiel, { aujourdhui });

  clear(container);
  const racine = el("div", { class: "centre" });
  container.appendChild(racine);

  const periode = promo
    ? [promo.date_debut ? "Du " + formatDate(promo.date_debut) : null,
       promo.date_fin ? "au " + formatDate(promo.date_fin) : (promo.date_debut ? "(fin non fixée)" : null)]
        .filter(Boolean).join(" ")
    : "";
  racine.appendChild(el("div", { class: "view-header centre-entete" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Tableau de bord du centre"),
      el("h2", {}, promo?.nom || "Promo courante"),
      el("p", { class: "subtitle" }, [periode, promo?.lieu_nom ? "Lieu : " + promo.lieu_nom : null,
        "Édité le " + formatDate(aujourdhui)].filter(Boolean).join(" · "))),
    el("div", { class: "centre-actions" },
      el("button", { class: "btn small", type: "button", onClick: () => imprimer(racine) }, "Exporter en PDF"),
      el("button", { class: "btn small", type: "button", onClick: () => ouvrirExportCsv(promo, donnees) },
        "Matrice des notes (CSV)"))));

  racine.appendChild(el("p", { class: "centre-legende" },
    etiquette("mesuré"), " compté dans l'app · ", etiquette("estimé"), " hypothèse ou signal · Chaque chiffre a sa méthode."));

  racine.appendChild(el("section", { class: "centre-section" },
    el("h3", {}, "Assiduité et abandons"),
    el("div", { class: "centre-grille" }, ...cartesCles(ind))));
  racine.appendChild(el("section", { class: "centre-section" },
    el("h3", {}, "Résultats"),
    el("div", { class: "centre-grille" }, ...cartesResultats(ind))));
  racine.appendChild(sectionThemes(ind.themes));
  racine.appendChild(sectionASuivre(ind.aSuivre));

  const promos = getMesPromos();
  let comparaison = null;
  if (promo && promos.length >= 2) {
    comparaison = sectionComparaison(promos, promo, ind);
    racine.appendChild(comparaison.section);
  }
  racine.appendChild(sectionMethodes());

  // Les autres promos se chargent après le premier rendu, l'une après l'autre.
  if (comparaison) {
    for (const p of comparaison.autres) {
      let ligne = null;
      try {
        ligne = ligneComparaison(indicateursPromo(await lireDonneesCentre(p.id), referentiel, { aujourdhui }));
      } catch (e) { console.error("tableau de bord : promo " + p.id, e); }
      if (jeton !== rendu) return;
      comparaison.remplir(p.id, ligne);
    }
  }
}
