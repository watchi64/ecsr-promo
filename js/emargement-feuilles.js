// Émargement (spec 2026-10-23) : feuilles A4 imprimables, par demi-journée (portrait) et par
// semaine (paysage). Construites hors écran puis clonées pour l'impression par le mécanisme
// des documents officiels (js/doc-officiel.js) : seul #emargement-print s'imprime.

import { el, compareByNom } from "./utils.js?v=20261028b";
import { bindDocPrint } from "./doc-officiel.js?v=20261028b";
import { rendreSignature } from "./signature-pad.js?v=20261028b";
import {
  etatLigne, libelleCreneau, heureLocale, jourLocal, dureeMinutes, libelleDuree, minutesPresence,
  jourDe, jourFerie, DEMI_JOURNEES,
} from "./emargement-rules.js?v=20261028b";

// Nom complet sur un document officiel : NOM en capitales, puis le prénom.
export function nomComplet(s) {
  if (!s) return "Stagiaire inconnu";
  return s.nom ? `${String(s.nom).toUpperCase()} ${s.prenom}` : s.prenom;
}

export function jourLong(jour, { annee = true } = {}) {
  const t = new Date(jour + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", ...(annee ? { year: "numeric" } : {}),
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const DEMI_LONG = { matin: "matin", aprem: "après-midi" };

// Date et heure d'un horodatage du serveur : « 26/10/2026 à 9h04 ».
function horodatage(iso) {
  if (!iso) return "";
  const [a, m, j] = jourLocal(iso).split("-");
  return `${j}/${m}/${a} à ${heureLocale(iso)}`;
}

// Stagiaires d'une feuille : une feuille close est figée sur ses lignes ; une feuille
// ouverte liste les stagiaires actifs, plus ceux qui ont déjà une ligne.
export function stagiairesDeFeuille(seance, stagiairesTous) {
  const ids = new Set((seance?.lignes || []).map((l) => l.stagiaire_id));
  return stagiairesTous
    .filter((s) => ids.has(s.id) || (seance?.statut !== "close" && s.actif))
    .sort(compareByNom);
}

// Bandeau de tête : logo, titre et ce dont parle la feuille, aux couleurs de l'app.
function bandeau(titre, sousTitre) {
  return el("div", { class: "emf-bandeau" },
    el("img", { class: "emf-logo", src: "assets/logo/tpecsr-logo.svg", alt: "" }),
    el("div", { class: "emf-bandeau-texte" },
      el("p", { class: "emf-titre" }, titre),
      el("p", { class: "emf-sous-titre" }, sousTitre)));
}

function infos(lignes) {
  return el("table", { class: "emf-infos" },
    el("tbody", {}, ...lignes.map(([k, v]) => el("tr", {}, el("th", {}, k), el("td", {}, v)))));
}

function mentionSignatures() {
  return "Signatures manuscrites recueillies sur écran dans l'application TP ECSR, horodatées par "
    + "le serveur (heure de Paris) et non modifiables après coup.";
}

// Heure de signature, avec la date si elle n'est pas celle de la feuille.
function heureSignature(iso, jour) {
  return jourLocal(iso) === jour ? heureLocale(iso) : horodatage(iso);
}

export function feuilleSeance({ entete, promo, seance, stagiairesTous, absentsPlanning = new Set() }) {
  const close = seance.statut === "close";
  const liste = stagiairesDeFeuille(seance, stagiairesTous);
  const parId = new Map(seance.lignes.map((l) => [l.stagiaire_id, l]));
  const duree = dureeMinutes(seance.debut, seance.fin);
  let presents = 0, absents = 0;

  const lignes = liste.map((s, i) => {
    const ligne = parId.get(s.id) || null;
    const etat = etatLigne({ ligne, absentPlanning: absentsPlanning.has(s.id), close });
    if (etat.code === "signe") presents++;
    if (etat.code === "absent") absents++;
    const obs = [];
    if (etat.code === "signe") {
      obs.push("Signé à " + heureSignature(ligne.signe_le, seance.jour)
        + (ligne.sur_appareil_formateur ? ", sur l'appareil du formateur" : ""));
    } else if (etat.code === "absent") obs.push(etat.libelle);
    else obs.push(etat.origine === "planning" ? "Noté absent au planning" : "Pas encore signé");
    if (ligne?.observation) obs.push(ligne.observation);
    return el("tr", { class: "emf-ligne emf-" + etat.code },
      el("td", { class: "emf-num" }, String(i + 1)),
      el("td", { class: "emf-nom" }, nomComplet(s)),
      el("td", { class: "emf-sig" }, etat.code === "signe"
        ? rendreSignature(ligne.trace, { titre: "Signature de " + nomComplet(s) })
        : el("span", { class: "emf-vide" }, etat.code === "absent" ? "Absent" : "")),
      el("td", { class: "emf-obs" }, ...obs.filter(Boolean).map((t) => el("div", {}, t))),
    );
  });

  const formateurs = seance.formateurs.length
    ? seance.formateurs.map((f) => el("tr", {},
        el("td", { class: "emf-nom" }, f.nom),
        el("td", { class: "emf-sig" }, rendreSignature(f.trace, { titre: "Signature de " + f.nom })),
        el("td", { class: "emf-obs" }, "Signé à " + heureSignature(f.signe_le, seance.jour))))
    : [el("tr", {}, el("td", { class: "emf-nom emf-manque", colspan: "3" }, "Aucune signature de formateur"))];

  const feuille = el("div", { class: "em-feuille em-feuille-seance" },
    el("header", { class: "emf-entete" },
      bandeau("Feuille d'émargement",
        `${jourLong(seance.jour)} · ${seance.demi_journee === "matin" ? "matin" : "après-midi"}, ${libelleCreneau(seance)}`),
      infos([
        ["Organisme de formation", entete.organisme],
        ["Formation", entete.intitule],
        ["Promotion", promo?.nom || ""],
        ["Date", jourLong(seance.jour)],
        ["Créneau", `${seance.demi_journee === "matin" ? "Matin" : "Après-midi"}, ${libelleCreneau(seance)} (${libelleDuree(duree)})`],
      ]),
    ),
    el("table", { class: "emf-table" },
      el("thead", {}, el("tr", {},
        el("th", { class: "emf-num" }, "N°"), el("th", { class: "emf-nom" }, "Stagiaire"),
        el("th", { class: "emf-sig" }, "Signature"), el("th", { class: "emf-obs" }, "Observations"))),
      el("tbody", {}, ...lignes),
    ),
    el("table", { class: "emf-table emf-formateurs" },
      el("thead", {}, el("tr", {},
        el("th", { class: "emf-nom" }, "Formateur"), el("th", { class: "emf-sig" }, "Signature"),
        el("th", { class: "emf-obs" }, "Heure"))),
      el("tbody", {}, ...formateurs),
    ),
    el("footer", { class: "emf-pied" },
      el("p", { class: "emf-totaux" },
        el("span", { class: "emf-total emf-total-ok" }, `Présents : ${presents}`),
        el("span", { class: "emf-total emf-total-ko" }, `Absents : ${absents}`),
        close ? null : el("span", { class: "emf-total" }, `Sans signature : ${liste.length - presents - absents}`)),
      el("p", {}, mentionSignatures()),
      el("p", {}, `Feuille ouverte le ${horodatage(seance.ouverte_le)}`
        + (close ? `, close le ${horodatage(seance.close_le)}.` : ", pas encore close.")),
    ),
  );
  // Hauteur des lignes : la feuille tient sur une page jusqu'à 20 stagiaires.
  feuille.style.setProperty("--emf-ligne", Math.max(7, Math.min(14, Math.floor(140 / Math.max(1, liste.length)))) + "mm");
  return feuille;
}

// Semaine : dix colonnes toujours présentes (lundi à vendredi, matin et après-midi).
export function feuilleSemaine({ entete, promo, lundi, seances, stagiairesTous, joursOff = [] }) {
  const colonnes = [];
  for (let d = 0; d < 5; d++) {
    for (const demi of DEMI_JOURNEES) {
      const jour = jourDe(lundi, d);
      const off = joursOff.find((j) => j.day_index === d);
      colonnes.push({
        jour, demi,
        seance: seances.find((s) => s.jour === jour && s.demi_journee === demi) || null,
        off: off ? (off.label || "Désactivé") : jourFerie(jour),
      });
    }
  }
  const ids = new Set(seances.flatMap((s) => s.lignes.map((l) => l.stagiaire_id)));
  const ouverte = seances.some((s) => s.statut !== "close");
  const liste = stagiairesTous.filter((s) => ids.has(s.id) || (ouverte && s.actif)).sort(compareByNom);
  const toutesLignes = seances.flatMap((s) => s.lignes);

  const enteteJours = el("tr", {},
    el("th", { class: "emf-nom", rowspan: "2" }, "Stagiaire"),
    ...[0, 1, 2, 3, 4].map((d) => el("th", { colspan: "2", class: "emf-jour" }, jourLong(jourDe(lundi, d), { annee: false }))),
    el("th", { class: "emf-heures", rowspan: "2" }, "Heures"));
  const enteteDemi = el("tr", {}, ...colonnes.map((c) => el("th", { class: "emf-demi" },
    c.demi === "matin" ? "Matin" : "Après-midi",
    el("span", { class: "emf-horaires" }, c.seance ? libelleCreneau(c.seance) : (c.off || "sans émargement")))));

  const cellule = (c, s) => {
    if (!c.seance) return el("td", { class: "emf-case emf-sans" });
    const ligne = c.seance.lignes.find((l) => l.stagiaire_id === s.id) || null;
    const etat = etatLigne({ ligne, close: c.seance.statut === "close" });
    if (etat.code === "signe") {
      return el("td", { class: "emf-case" },
        rendreSignature(ligne.trace, { titre: "Signature de " + nomComplet(s) }),
        el("span", { class: "emf-heure" }, heureSignature(ligne.signe_le, c.seance.jour)));
    }
    return el("td", { class: "emf-case emf-" + etat.code }, etat.code === "absent" ? "Absent" : "");
  };

  const lignes = liste.map((s) => el("tr", { class: "emf-ligne" },
    el("td", { class: "emf-nom" }, nomComplet(s)),
    ...colonnes.map((c) => cellule(c, s)),
    el("td", { class: "emf-heures" }, libelleDuree(minutesPresence(seances, toutesLignes, s.id))),
  ));
  const ligneFormateurs = el("tr", { class: "emf-ligne-formateurs" },
    el("td", { class: "emf-nom" }, "Formateur"),
    ...colonnes.map((c) => el("td", { class: "emf-case" + (c.seance ? "" : " emf-sans") },
      ...(c.seance?.formateurs || []).map((f) => el("div", { class: "emf-formateur" },
        rendreSignature(f.trace, { titre: "Signature de " + f.nom }),
        el("span", { class: "emf-heure" }, f.nom))))),
    el("td", { class: "emf-heures" }));

  const vendredi = jourDe(lundi, 4);
  return el("div", { class: "em-feuille em-feuille-semaine" },
    el("header", { class: "emf-entete" },
      bandeau("Feuille d'émargement de la semaine",
        `Du ${jourLong(lundi, { annee: false }).toLowerCase()} au ${jourLong(vendredi).toLowerCase()}`),
      infos([
        ["Organisme de formation", entete.organisme],
        ["Formation", entete.intitule],
        ["Promotion", promo?.nom || ""],
        ["Semaine", `du ${jourLong(lundi, { annee: false }).toLowerCase()} au ${jourLong(vendredi).toLowerCase()}`],
      ]),
    ),
    el("table", { class: "emf-table emf-table-semaine" },
      el("thead", {}, enteteJours, enteteDemi),
      el("tbody", {}, ...lignes, ligneFormateurs),
    ),
    el("footer", { class: "emf-pied" },
      el("p", {}, "Heures : durée des demi-journées signées. " + mentionSignatures()),
    ),
  );
}

// Imprime une feuille. `ancre` : élément de la page à l'écran ; s'il disparaît (changement
// de page), l'impression suivante n'emporte plus la feuille.
export function imprimer(feuille, { ancre, page = "A4 portrait" }) {
  bindDocPrint(ancre, { printId: "emargement-print", bodyClass: "emargement-printable", source: feuille, page });
  window.print();
}
