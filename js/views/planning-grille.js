/**
 * La semaine du planning en grille (nouvelle navigation, lot 2B) : jours en colonnes, Matin et Après-midi en lignes.
 * Sur téléphone, cinq colonnes seraient illisibles : une bande de cinq jours, puis le jour choisi en carte. Les deux
 * formes sont dans le DOM et le CSS (css/pages.css) n'en montre qu'une, pour suivre une rotation d'écran sans rien
 * reconstruire. Les cartes viennent de semaineEnGrille (js/journee-rules.js) : ce module ne calcule aucune règle, il
 * dessine. Les classes sont celles de la maquette (wgrid, wg-*, daystrip, vue-toggle).
 */
import { el } from "../utils.js?v=20261110e";
import { icon, deco } from "../icons.js?v=20261110e";
import { etiquetteSemaine, alerteDeCarte } from "../journee-rules.js?v=20261110e";

// Mémoire de l'appareil : la forme choisie (js/journee-rules.js, vuePlanningInitiale).
export const CLE_VUE_PLANNING = "planning.vue";

// Les lignes de texte sous l'étiquette d'une carte. Stagiaire : qui est sur la carte (au tableau en salle, au volant en
// voiture) et avec quel formateur. Équipe : le ou les formateurs, puis les prénoms de qui passe au tableau, de qui conduit
// et des élèves bénévoles (audit du 09/11, lot B, B4 : « 2 en voiture · 2 élèves » obligeait à chercher ailleurs qui monte
// en voiture).
function lignesDeCarte(c, equipe) {
  if (equipe) {
    const noms = (liste) => liste.map((x) => (typeof x === "string" ? x : x.nom)).filter(Boolean).join(", ");
    const lignes = [];
    if (c.formateurs.length) lignes.push(c.formateurs.join(", "));
    if (noms(c.tableau)) lignes.push("Au tableau : " + noms(c.tableau));
    if (noms(c.conducteurs)) lignes.push("En voiture : " + noms(c.conducteurs));
    if (noms(c.benevoles)) lignes.push((c.benevoles.length > 1 ? "Élèves bénévoles : " : "Élève bénévole : ") + noms(c.benevoles));
    return lignes;
  }
  const lignes = [];
  const qui = (c.tableau.length ? c.tableau : c.conducteurs).map((x) => x.nom).filter(Boolean);
  if (qui.length) lignes.push(qui.join(", "));
  if (c.formateurs.length) lignes.push("Avec " + c.formateurs.join(", "));
  return lignes;
}

function carteDeGrille(c, equipe) {
  const etiquette = equipe ? null : etiquetteSemaine(c.moi);
  const alerte = alerteDeCarte(c);
  return el("div", { class: "wg-carte" },
    el("span", { class: "wg-tag wg-genre-" + c.genre }, c.titre),
    c.sujets.length ? el("b", {}, c.sujets.join(" · ")) : null,
    alerte ? el("span", { class: "wg-sub wg-alerte" }, alerte) : null,
    ...lignesDeCarte(c, equipe).map((l) => el("span", { class: "wg-sub" }, l)),
    etiquette ? el("span", { class: "wg-moi", "data-moi": c.moi.role }, etiquette) : null,
  );
}

function contenuDeDemi(demi, equipe) {
  return demi.cartes.length
    ? demi.cartes.map((c) => carteDeGrille(c, equipe))
    : [el("span", { class: "wg-vide" }, "Rien de prévu")];
}

function moisDe(jour) {
  return jour.long.split(" ").slice(2).join(" ");
}

function formeOrdinateur(jours, equipe) {
  const grille = el("div", { class: "wgrid" }, el("div", { class: "wg-coin" }));
  jours.forEach((j, k) => {
    const entete = el("div", { class: "wg-day" + (j.aujourdhui ? " auj" : ""), "aria-current": j.aujourdhui ? "date" : null },
      el("small", {}, j.court), `${j.numero} ${moisDe(j)}`);
    entete.style.gridColumn = String(k + 2);
    entete.style.gridRow = "1";
    grille.appendChild(entete);
  });
  ["Matin", "Après-midi"].forEach((titre, h) => {
    const libelle = el("div", { class: "wg-half" }, titre);
    libelle.style.gridColumn = "1";
    libelle.style.gridRow = String(h + 2);
    grille.appendChild(libelle);
  });
  jours.forEach((j, k) => {
    if (j.repos) {
      // Un jour de repos tient en une seule case sur les deux lignes.
      const repos = el("div", { class: "wg-cell wg-repos" + (j.aujourdhui ? " auj" : "") }, j.repos);
      repos.style.gridColumn = String(k + 2);
      repos.style.gridRow = "2 / span 2";
      grille.appendChild(repos);
      return;
    }
    j.demis.forEach((demi, h) => {
      const cellule = el("div", { class: "wg-cell" + (j.aujourdhui ? " auj" : "") }, ...contenuDeDemi(demi, equipe));
      cellule.style.gridColumn = String(k + 2);
      cellule.style.gridRow = String(h + 2);
      grille.appendChild(cellule);
    });
  });
  return grille;
}

let compteur = 0;

// La bande de cinq jours puis le jour choisi. `choisir` est appelée à chaque jour touché.
function formeTelephone(jours, equipe, jourChoisi, onChoisirJour) {
  const id = "wg-tel-" + (++compteur);
  const panneau = el("div", { class: "wg-jour", role: "tabpanel", id: id + "-p" });
  const bouton = [];
  let courant = Math.min(Math.max(jourChoisi | 0, 0), jours.length - 1);

  function dessiner() {
    const j = jours[courant];
    panneau.setAttribute("aria-labelledby", `${id}-${courant}`);
    panneau.replaceChildren(
      el("div", { class: "wg-jour-tete" },
        el("h3", {}, j.long),
        j.aujourdhui ? el("span", { class: "wg-auj" }, "Aujourd'hui") : null),
      ...(j.repos
        ? [el("p", { class: "wg-repos-tel" }, j.repos)]
        : j.demis.map((demi) => el("section", { class: "wg-demi" },
            el("h4", {}, demi.titre, demi.horaire ? el("span", {}, demi.horaire) : null),
            ...contenuDeDemi(demi, equipe)))),
    );
    bouton.forEach((b, k) => {
      b.setAttribute("aria-selected", k === courant ? "true" : "false");
      b.tabIndex = k === courant ? 0 : -1;
    });
  }

  function choisir(k, { focus = false } = {}) {
    if (k === courant && !focus) return;
    courant = k;
    dessiner();
    if (focus) bouton[k].focus();
    onChoisirJour(k);
  }

  const bande = el("div", { class: "daystrip", role: "tablist", "aria-label": "Jours de la semaine" },
    ...jours.map((j, k) => {
      const b = el("button", {
        type: "button", role: "tab", id: `${id}-${k}`, "aria-controls": id + "-p",
        class: j.aujourdhui ? "auj" : "",
        "aria-label": j.long + (j.repos ? ", " + j.repos.toLowerCase() : "") + (j.aujourdhui ? ", aujourd'hui" : ""),
        onClick: () => choisir(k),
        onKeydown: (ev) => {
          const pas = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
          if (pas) { ev.preventDefault(); choisir((k + pas + jours.length) % jours.length, { focus: true }); }
        },
      }, el("small", {}, j.court), String(j.numero));
      bouton.push(b);
      return b;
    }));
  dessiner();
  return el("div", { class: "wtel" }, bande, panneau);
}

// `jours` : semaineEnGrille. `equipe` : la vue du formateur (effectifs) plutôt que celle du stagiaire (noms et « Toi »).
// `jourChoisi` : l'index du jour montré sur téléphone. `onChoisirJour(index)` : prévenu quand un jour est touché.
export function grilleSemaine({ jours, equipe = false, jourChoisi = 0, onChoisirJour = () => {} }) {
  return el("div", { class: "wsem" },
    formeOrdinateur(jours, equipe),
    formeTelephone(jours, equipe, jourChoisi, onChoisirJour));
}

// Le groupe « Grille » ou « Liste ». Sur téléphone, le premier bouton s'appelle « Jour » (la grille y est une bande de
// jours) : les deux mots sont dans le bouton, le CSS n'en montre qu'un.
export function bascule({ vue, onChange }) {
  const bouton = (cible, ico, ...contenu) => el("button", {
    type: "button", "data-vue": cible, "aria-pressed": vue === cible ? "true" : "false",
    onClick: () => { if (vue !== cible) onChange(cible); },
  }, deco(icon[ico]()), ...contenu);
  return el("div", { class: "vue-toggle", role: "group", "aria-label": "Affichage du planning" },
    bouton("grille", "columns", el("span", { class: "vue-long" }, "Grille"), el("span", { class: "vue-court" }, "Jour")),
    bouton("liste", "list", "Liste"));
}
