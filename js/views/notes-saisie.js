// Sous-onglet « Saisir » de Notes et examens (lot C de l'audit du 09/11) : la saisie thème par thème, pensée pour le
// téléphone. Étape 1, choisir ce qu'on note (les 4 compétences, puis les thèmes, avec une recherche et l'avancement
// « n sur N ») ; étape 2, une ligne par stagiaire avec un grand champ. La note s'enregistre quand on quitte le champ,
// par la même fonction que la matrice (enregistrerNote, js/views/notes.js), reçue dans le contexte `ctx` :
//   ctx.stagiaires()          les stagiaires de la matrice, dans l'ordre alphabétique
//   ctx.evaluations()         les notes chargées (le tableau vivant de notes.js)
//   ctx.themes                les thèmes officiels (numéro, titre)
//   ctx.nom(s)                le nom affiché d'un stagiaire
//   ctx.dateEval()            la date des notes (partagée avec la barre d'outils de la matrice)
//   ctx.changerDate(iso)      change cette date
//   ctx.enregistrer({...})    enregistrerNote
//   ctx.apresEnregistrement() rafraîchit les statistiques de la page
//   ctx.carteVide(contexte)   la carte de l'état vide, ou null (lot C, C2)
// Chaque champ porte l'identifiant de son stagiaire (data-stagiaire-id) : une note ne peut pas glisser d'une ligne
// à l'autre, même si la page se redessine pendant la saisie. Ce que dit la ligne après un envoi (une phrase, « Réessayer »
// si la connexion a lâché) vient d'etatDeLigne (js/notes-saisie-rules.js).

import { el, clear, toast } from "../utils.js?v=20261111f";
import { icon } from "../icons.js?v=20261111f";
import {
  ciblesDeSaisie, filtrerCibles, derniereNote, avancement, libelleAvancement, origineNote, etatDeLigne,
} from "../notes-saisie-rules.js?v=20261111f";
import { dateLongue } from "../dates.js?v=20261111f";

// Ce qui reste d'un rendu du panneau à l'autre (changer de sous-onglet puis revenir) : la cible ouverte, la recherche.
let cleOuverte = null;
let recherche = "";
// Les enregistrements partis et pas encore revenus : la liste recompte quand ils aboutissent (on peut toucher
// « Retour » pendant qu'une note part, à la perte du champ).
const enAttente = new Set();

function noteEnFrancais(n) {
  return String(n).replace(".", ",");
}

export function renderSaisie(panel, ctx) {
  const zone = el("div", { class: "saisie" });
  panel.appendChild(zone);
  const cibles = () => ciblesDeSaisie(ctx.themes);

  function dessiner() {
    clear(zone);
    const cible = cleOuverte && cibles().find((c) => c.cle === cleOuverte);
    if (cible) ecranCible(cible); else { cleOuverte = null; ecranListe(); }
  }

  // --- Étape 1 : choisir ce qu'on note ---
  function ecranListe() {
    const vide = ctx.carteVide ? ctx.carteVide("equipe-saisir") : null;
    if (vide) zone.appendChild(vide);
    zone.appendChild(el("h3", { class: "saisie-titre" }, "Choisissez ce que vous notez"));
    const champ = el("input", {
      type: "search", class: "saisie-recherche", value: recherche,
      placeholder: "Numéro ou titre", "aria-label": "Chercher une compétence ou un thème", autocomplete: "off",
    });
    const liste = el("div", { class: "saisie-liste" });
    champ.addEventListener("input", () => { recherche = champ.value; remplirListe(liste); });
    zone.appendChild(champ);
    zone.appendChild(liste);
    remplirListe(liste);
    if (enAttente.size) {
      Promise.allSettled([...enAttente]).then(() => { if (liste.isConnected) remplirListe(liste); });
    }
  }

  function remplirListe(liste) {
    clear(liste);
    const ids = ctx.stagiaires().map((s) => s.id);
    const evs = ctx.evaluations();
    const trouvees = filtrerCibles(cibles(), recherche);
    if (trouvees.length === 0) {
      liste.appendChild(el("p", { class: "muted saisie-aucune" }, `Rien ne correspond à « ${recherche.trim()} ».`));
      return;
    }
    const bouton = (c) => {
      const av = avancement(evs, ids, c);
      return el("button", {
        type: "button", class: "saisie-cible" + (av.n === av.total && av.total > 0 ? " complete" : ""),
        "data-cle": c.cle,
        onClick: () => { cleOuverte = c.cle; dessiner(); },
      },
        el("span", { class: "saisie-cible-num" }, c.numero),
        el("span", { class: "saisie-cible-titre" }, c.libelle),
        el("span", { class: "saisie-cible-avancement" }, libelleAvancement(av)),
      );
    };
    const competences = trouvees.filter((c) => c.type === "Compétence");
    const themes = trouvees.filter((c) => c.type === "Thème");
    if (competences.length) {
      liste.appendChild(el("h4", { class: "saisie-section" }, "Compétences"));
      competences.forEach((c) => liste.appendChild(bouton(c)));
    }
    if (themes.length) {
      liste.appendChild(el("h4", { class: "saisie-section" }, "Thèmes"));
      themes.forEach((c) => liste.appendChild(bouton(c)));
    }
  }

  // --- Étape 2 : une ligne par stagiaire ---
  function ecranCible(cible) {
    const stagiaires = ctx.stagiaires();
    const compteur = el("p", { class: "saisie-compteur", "aria-live": "polite" });
    const majCompteur = () => {
      const { n, total } = avancement(ctx.evaluations(), stagiaires.map((s) => s.id), cible);
      compteur.textContent = `${n} sur ${total} enregistrée${n > 1 ? "s" : ""}`;
    };
    majCompteur();

    const retour = el("button", { type: "button", class: "btn ghost saisie-retour",
      onClick: () => { cleOuverte = null; dessiner(); } }, icon.chevronLeft(), "Retour");

    // La date des notes : une ligne, et « Changer » qui ouvre le sélecteur.
    const dateTexte = el("strong", {}, dateLongue(ctx.dateEval()));
    const dateChamp = el("input", { type: "date", value: ctx.dateEval(), "aria-label": "Date des notes", hidden: true });
    const changer = el("button", { type: "button", class: "lien-bouton saisie-changer-date",
      onClick: () => { dateChamp.hidden = false; changer.hidden = true; dateChamp.focus(); } }, "Changer");
    dateChamp.addEventListener("change", () => {
      if (!dateChamp.value) return;
      ctx.changerDate(dateChamp.value);
      dateTexte.textContent = dateLongue(dateChamp.value);
    });

    zone.appendChild(el("div", { class: "saisie-entete" },
      retour,
      el("h3", { class: "saisie-titre" }, `${cible.numero} · ${cible.libelle}`),
      compteur,
      el("p", { class: "saisie-date" }, "Date des notes : ", dateTexte, " ", changer, dateChamp),
    ));

    const lignes = el("div", { class: "saisie-lignes" });
    const champs = [];
    stagiaires.forEach((s) => {
      const nom = ctx.nom(s);
      const existante = derniereNote(ctx.evaluations(), s.id, cible);
      const etat = el("span", { class: "saisie-etat", "aria-live": "polite" }, existante ? origineNote(existante) : "");
      // La ligne dit une erreur (ou un nouvel essai) : un résultat « inchangée » doit la remettre d'aplomb.
      let ligneAReprendre = false;
      // « Réessayer » : seulement quand la connexion a lâché (etatDeLigne) ; renvoie ce qui est dans le champ.
      const reessayer = el("button", { type: "button", class: "saisie-reessayer", hidden: true,
        "aria-label": `Réessayer d'enregistrer la note de ${nom}`,
        onClick: () => {
          reessayer.hidden = true;
          etat.classList.remove("erreur");
          etat.textContent = "Nouvel essai…";
          enregistrer();
        } }, "Réessayer");
      const champ = el("input", {
        type: "text", inputmode: "decimal", autocomplete: "off", class: "saisie-champ",
        "data-stagiaire-id": String(s.id), "aria-label": `Note de ${nom} sur 20`, placeholder: "/20",
        value: existante?.note != null ? noteEnFrancais(existante.note) : "",
      });
      if (existante?.note != null) champ.setAttribute("data-note", String(existante.note));
      champs.push(champ);

      // Un seul enregistrement à la fois par champ. Une correction tapée pendant qu'il part (réseau lent) n'est pas
      // perdue : elle repart dès qu'il revient, et le résultat du premier n'écrase pas ce qui a été retapé.
      let enCours = false;
      let relancer = false;
      async function enregistrer() {
        if (enCours) { relancer = true; return; }
        enCours = true;
        const id = Number(champ.getAttribute("data-stagiaire-id"));
        const avant = derniereNote(ctx.evaluations(), id, cible);
        const saisie = champ.value;
        try {
          const envoi = ctx.enregistrer({ stagiaireId: id, cible, saisie, nom });
          enAttente.add(envoi);
          const r = await envoi.finally(() => enAttente.delete(envoi));
          const aJour = champ.value === saisie;   // rien n'a été retapé pendant l'envoi
          // Une erreur affichée s'efface aussi quand on remet la note déjà en base (résultat « inchangée »).
          const ligne = etatDeLigne(r, avant, ligneAReprendre);
          if (r.etat === "enregistree") {
            if (aJour) champ.value = noteEnFrancais(r.note);
            champ.setAttribute("data-note", String(r.note));
          } else if (r.etat === "effacee") {
            if (aJour) champ.value = "";
            champ.removeAttribute("data-note");
          } else if (r.etat === "gardee" || r.etat === "inchangee") {
            if (aJour) champ.value = avant?.note != null ? noteEnFrancais(avant.note) : "";
          }
          if (ligne) {
            etat.textContent = ligne.texte;
            etat.classList.toggle("erreur", ligne.erreur);
            reessayer.hidden = !ligne.reessayer;
            ligneAReprendre = ligne.erreur;
          }
          // On a quitté l'écran pendant l'envoi (« Retour », Échap, un autre sous-onglet) : la ligne d'état n'est plus
          // affichée, un échec se dit donc dans un message, avec le nom, pour ne rien perdre en silence.
          if (!etat.isConnected && (r.etat === "invalide" || r.etat === "erreur")) {
            toast(`Note de ${nom} pas enregistrée : ${r.message}. Rouvrez le thème pour la saisir de nouveau.`, "error", 6000);
          }
          if (r.etat === "enregistree" || r.etat === "effacee") {
            majCompteur();
            ctx.apresEnregistrement();
          }
        } finally {
          enCours = false;
          if (relancer) {
            relancer = false;
            if (champ.value !== saisie) enregistrer();
          }
        }
      }
      champ.addEventListener("blur", enregistrer);
      champ.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const suivant = champs[champs.indexOf(champ) + 1];
        if (suivant) suivant.focus(); else champ.blur();
      });

      lignes.appendChild(el("div", { class: "saisie-ligne" },
        el("div", { class: "saisie-qui" }, el("span", { class: "saisie-nom" }, nom),
          el("div", { class: "saisie-etat-ligne" }, etat, reessayer)),
        champ,
      ));
    });
    if (champs.length) champs[champs.length - 1].setAttribute("enterkeyhint", "done");
    champs.slice(0, -1).forEach((c) => c.setAttribute("enterkeyhint", "next"));
    zone.appendChild(lignes);
  }

  // Échap ramène à la liste (sur ordinateur) ; la note en cours s'enregistre d'abord, à la perte du champ.
  zone.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !cleOuverte) return;
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    cleOuverte = null;
    dessiner();
  });

  dessiner();
}
