import { listStagiaires, listPassages, getPlanning, getJoursOff } from "../db.js?v=20261112b";
import { el, clear, displayStagiaire, isoDate, addDays } from "../utils.js?v=20261112b";
import { lundiEnCours } from "../journee-rules.js?v=20261112b";
import { jourFerie } from "../emargement-rules.js?v=20261112b";
import { isAdmin, isStagiaire, monStagiaireId } from "../auth-admin.js?v=20261112b";
import { ordreDePassage, placesDeLaSemaine, maSituation, TYPES } from "../ordre-passage-rules.js?v=20261112b";
import { rolesPourEntry } from "../creneaux-rules.js?v=20261112b";
import { icon } from "../icons.js?v=20261112b";
import { renderPassages } from "./passages.js?v=20261112b";

// Ordre de passage (sous-onglet de Planning, js/views/planning-espace.js), refonte du 11/11
// (docs/superpowers/specs/2026-11-11-ordre-passage-resultats-design.md) : chacun sa vue. Le stagiaire voit sa situation
// et son prochain passage, jamais les retards des autres ; l'équipe voit qui placer cette semaine, file par file.
// Comptage unique : celui du placement (js/ordre-passage-rules.js).

const NOMS_TYPE = { Salle: "Salle", Voiture: "Voiture" };
const ICONE_TYPE = { Salle: () => icon.presentation(), Voiture: () => icon.car() };

function jourLong(lundi, dayIndex) {
  return addDays(new Date(lundi + "T00:00:00"), dayIndex).toLocaleDateString("fr-FR", { weekday: "long" });
}

// Jours désactivés ou fériés d'une semaine (day_index), comme le planning et Mon suivi.
function joursFermes(lundi, joursOff) {
  const set = new Set((joursOff || []).map((j) => j.day_index));
  for (let i = 0; i < 7; i++) {
    if (jourFerie(isoDate(addDays(new Date(lundi + "T00:00:00"), i)))) set.add(i);
  }
  return set;
}

function enTete(lundi, sousTitre) {
  return el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Semaine du " + new Date(lundi + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })),
      el("h2", {}, "Ordre de passage"),
      el("p", { class: "subtitle" }, sousTitre),
    ));
}

function retardTexte(n) {
  return n > 0 ? (n + " de retard") : "À jour";
}

function explication(objectif, tu) {
  return el("details", { class: "dash-explain" },
    el("summary", {}, tu ? "Comment la priorité est calculée ?" : "Comment la priorité est calculée"),
    el("div", { class: "dash-explain-body" },
      el("p", {}, `Objectif = la moyenne de la classe : ${objectif.Salle} en salle, ${objectif.Voiture} en voiture. `
        + "En dessous, on passe en priorité ; plus le retard est grand, plus on passe tôt."),
      el("p", {}, "Comptent les passages enregistrés depuis le début de la formation : un passage fait, ou une absence "
        + "de dernière minute (le tour est consommé). Un remplacement au pied levé ne compte pas."),
      el("p", {}, "Placer quelqu'un dans le planning ne compte pas tant que la semaine n'est pas validée."),
    ));
}

// Prochain passage du stagiaire : premier créneau où il passe (au tableau, au volant), aujourd'hui compris.
function prochainPassage(semaines, id, aujourdhuiIso) {
  const items = [];
  semaines.forEach(({ lundi, entries, fermes }) => {
    (entries || []).forEach((e) => {
      if (fermes.has(e.day_index)) return;
      rolesPourEntry(e, id).forEach((r) => {
        if (r.role !== "passage") return;
        const iso = isoDate(addDays(new Date(lundi + "T00:00:00"), e.day_index));
        if (iso >= aujourdhuiIso) items.push({ iso, half: e.half_day, type: r.type, lundi, day: e.day_index });
      });
    });
  });
  items.sort((a, b) => a.iso.localeCompare(b.iso) || (a.half === "matin" ? -1 : 1));
  return items[0] || null;
}

function vueStagiaire(container, o, id, prochain, lundi) {
  container.appendChild(enTete(lundi, "Ta place dans l'ordre de passage, par rapport à la moyenne de la classe."));
  const moi = o.parId[id];
  if (!moi) {
    container.appendChild(el("p", { class: "muted" }, "Ta fiche n'est pas dans la promo en formation."));
    return;
  }
  const lignes = TYPES.map((t) => el("div", { class: "op-ligne" },
    el("span", { class: "op-ligne-type" }, ICONE_TYPE[t](), NOMS_TYPE[t]),
    el("span", { class: "op-etat" + (moi.retard[t] > 0 ? " retard" : "") }, retardTexte(moi.retard[t]))));
  const carte = el("section", { class: "op-carte op-cle", "aria-label": "Mes passages" },
    el("h3", { class: "op-carte-titre" }, "Mes passages"), ...lignes);
  container.appendChild(carte);
  container.appendChild(el("p", { class: "op-phrase" }, maSituation(moi.retard)));
  if (prochain) {
    const date = new Date(prochain.iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    container.appendChild(el("p", { class: "op-prochain" }, icon.calendar(),
      `Prochain passage : ${date}, ${prochain.half === "matin" ? "matin" : "après-midi"}, ${prochain.type === "Salle" ? "au tableau" : "en voiture"}.`));
  }
  container.appendChild(explication(o.objectif, true));
}

function chiffre(valeur, libelle) {
  return el("div", { class: "op-chiffre" }, el("span", { class: "op-chiffre-val" }, String(valeur)), el("span", { class: "op-chiffre-lib" }, libelle));
}

function file(type, items, lundi) {
  const titre = el("h3", { class: "op-carte-titre" }, ICONE_TYPE[type](), NOMS_TYPE[type]);
  if (!items.length) {
    return el("section", { class: "op-carte" }, titre,
      el("p", { class: "op-vide" }, type === "Salle" ? "Tout le monde est à jour en salle." : "Tout le monde est à jour en voiture."));
  }
  const liste = el("ol", { class: "op-file" });
  items.forEach((x, i) => {
    liste.appendChild(el("li", { class: "op-ligne" },
      el("span", { class: "op-nom" }, el("span", { class: "op-rang" }, String(i + 1)), displayStagiaire(x.s)),
      el("span", { class: "op-ligne-fin" },
        x.placeLe != null ? el("span", { class: "op-place" }, "placé " + jourLong(lundi, x.placeLe)) : null,
        el("span", { class: "op-etat retard" }, retardTexte(x.retard)))));
  });
  return el("section", { class: "op-carte" }, titre, liste);
}

function vueEquipe(container, o, lundi) {
  container.appendChild(enTete(lundi, "Qui faire passer en priorité, par rapport à la moyenne de la classe."));
  container.appendChild(el("div", { class: "op-chiffres op-cle" },
    chiffre(o.resume.aPlacer, "À placer cette semaine"),
    chiffre(o.resume.dejaPlaces, "Déjà placés"),
    chiffre(o.resume.aJour, "À jour partout")));
  const files = el("div", { class: "op-files" }, file("Salle", o.files.Salle, lundi), file("Voiture", o.files.Voiture, lundi));
  container.appendChild(files);
  if (o.aJour.length) {
    container.appendChild(el("details", { class: "op-ajour" },
      el("summary", {}, o.aJour.length === 1 ? "1 stagiaire à jour partout" : `${o.aJour.length} stagiaires à jour partout`),
      el("p", {}, o.aJour.map((s) => displayStagiaire(s)).join(", ") + ".")));
  }
  if (isAdmin()) {
    container.appendChild(el("div", { class: "op-actions" },
      // Le sous-onglet Semaine du Planning (wrap.activer, js/subtabs.js), où se trouve « Placer la semaine ».
      el("button", { type: "button", class: "btn primary", onClick: () => {
        const onglets = container.closest(".subtabs");
        if (onglets && onglets.activer) { onglets.activer("semaine"); window.scrollTo(0, 0); }
      } }, "Ouvrir la semaine")));
  }
  container.appendChild(explication(o.objectif, false));
}

export async function renderDashboard(container) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const lundi = lundiEnCours(new Date());
  const suivant = isoDate(addDays(new Date(lundi + "T00:00:00"), 7));
  const vueEleve = isStagiaire();
  const id = monStagiaireId();

  const [stagiaires, rows, entries, off, entries2, off2] = await Promise.all([
    listStagiaires(), listPassages(), getPlanning(lundi), getJoursOff(lundi),
    vueEleve ? getPlanning(suivant) : Promise.resolve([]), vueEleve ? getJoursOff(suivant) : Promise.resolve([]),
  ]);
  const fermes = joursFermes(lundi, off);
  const o = ordreDePassage(stagiaires, rows, placesDeLaSemaine(entries, fermes));

  clear(container);
  if (vueEleve) {
    if (id == null) {
      container.appendChild(enTete(lundi, "Ta place dans l'ordre de passage."));
      container.appendChild(el("p", { class: "muted" }, "Aucun profil stagiaire n'est relié à ce compte."));
    } else {
      const prochain = prochainPassage([
        { lundi, entries, fermes },
        { lundi: suivant, entries: entries2, fermes: joursFermes(suivant, off2) },
      ], id, isoDate(new Date()));
      vueStagiaire(container, o, id, prochain, lundi);
    }
  } else {
    vueEquipe(container, o, lundi);
  }

  // Historique des passages : inchangé, sous l'ordre de passage.
  const passagesSection = el("section", { class: "op-historique" });
  container.appendChild(passagesSection);
  await renderPassages(passagesSection);
}
