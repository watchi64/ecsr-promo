// « Prévenir d'une absence » (espace contact, tâche 15) : #/absence. Le stagiaire dit quel jour, quand et pourquoi (un motif
// d'une liste sans « santé », aucune précision médicale ; le mot ne doit en porter aucune), voit qui sera prévenu (encadré
// « Sera envoyé à » : le centre a réglé qui reçoit, ou le stagiaire coche au moins une personne), puis suit sa demande. Règles pures : js/contact-absences-rules.js et js/contact-rules.js ; la base juge tout et ses refus se
// disent par leur phrase. Réservé aux stagiaires (espace du compte, vueStagiaire), tutoiement. Aucun défilement de côté.

import { apercuAbsence, prevenirAbsence } from "../db.js?v=20261128c";
import { el, clear, toast } from "../utils.js?v=20261128c";
import { icon } from "../icons.js?v=20261128c";
import { vueStagiaire } from "../auth-admin.js?v=20261128c";
import { jourParis, jourDe } from "../dates.js?v=20261128c";
import { lignesEncadre, libelleDestinataire, phraseContact, basculerCoche } from "../contact-rules.js?v=20261128c";
import { demiJourneesDe, verifierAbsence, phraseCasesDecochees, LIBELLES_MOTIF } from "../contact-absences-rules.js?v=20261128c";
import { routeDesDemandes } from "./contact-ecrire.js?v=20261128c";

const JOURS = [["aujourdhui", "Aujourd'hui"], ["demain", "Demain"], ["autre", "Choisir"]];
const MOMENTS = [["journee", "Journée"], ["matin", "Matin"], ["aprem", "Après-midi"], ["heures", "De ... à ..."]];
const MOTIFS = Object.entries(LIBELLES_MOTIF);
const PHRASE_ECHEC_ENCADRE = "Les personnes à prévenir n'ont pas pu être chargées.";
const PHRASE_ECHEC_ENVOI = "Ton absence n'a pas été enregistrée. Réessaie dans un instant.";
const PHRASE_CHOIX = "Choisis le jour et le moment : on te dit alors qui sera prévenu.";

let rendu = 0;

// Un groupe de boutons ronds (un seul choix) : des cases d'option de 44 px au moins.
function groupeChoix(nom, legende, choix, surChoix) {
  const boutons = choix.map(([valeur, libelle]) => {
    const id = `abs-${nom}-${valeur}`;
    const saisie = el("input", { type: "radio", name: `abs-${nom}`, id, value: valeur });
    saisie.addEventListener("change", () => { if (saisie.checked) surChoix(valeur); });
    return el("label", { class: "abs-choix", for: id }, saisie, el("span", {}, libelle));
  });
  return el("fieldset", { class: "abs-groupe" }, el("legend", {}, legende), el("div", { class: "abs-choix-liste" }, ...boutons));
}

export async function renderPrevenirAbsence(container) {
  const jeton = ++rendu;
  clear(container);
  const racine = el("div", { class: "contacts-page absence-page" });
  container.appendChild(racine);
  const entete = el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("h2", { tabindex: "-1" }, "Prévenir d'une absence"),
      el("p", { class: "subtitle" }, "Le centre est prévenu tout de suite. Tu pourras suivre ta demande et remettre ton justificatif ensuite.")));
  racine.appendChild(entete);

  if (!vueStagiaire()) {
    racine.appendChild(el("p", { class: "muted" }, "Cet écran est réservé aux stagiaires."));
    return;
  }

  const aujourdhui = jourParis(new Date());
  const etat = { jour: null, date: "", jusqua: "", quand: null, debut: "", fin: "", motif: null, mot: "" };
  let apercu = null;            // la réponse d'apercu_envoi pour les demi-journées choisies
  let cleApercu = null;         // les demi-journées pour lesquelles `apercu` a été lu
  let erreurApercu = null;
  let coches = null;            // null : les cases pré-cochées par la base ; sinon l'ensemble des cases cochées
  const decochees = new Set();  // les envois annexes décochés : "formateurs", "delegue"
  let envoi = false;
  let appel = 0;

  const champs = () => ({
    du: etat.jour === "aujourdhui" ? aujourdhui : etat.jour === "demain" ? jourDe(aujourdhui, 1) : etat.jour === "autre" && etat.date ? etat.date : null,
    au: etat.quand === "heures" || !etat.jusqua ? null : etat.jusqua,
    quand: etat.quand, debut: etat.debut || null, fin: etat.fin || null,
  });
  const probleme = () => verifierAbsence({ ...champs(), motif: etat.motif, mot: etat.mot, aujourdhui });
  // Ce qui manque ou ne va pas pour lire l'aperçu (le jour et le moment seulement : le motif n'y change rien).
  const problemeJours = () => verifierAbsence({ ...champs(), motif: "autre", mot: "", aujourdhui });

  const encadre = el("div", { class: "contact-encadre abs-encadre", role: "group", "aria-live": "polite", "aria-label": "Sera envoyé à" });
  const aide = el("p", { class: "contact-aide abs-aide", "aria-live": "polite" });
  const general = el("p", { class: "contact-champ-erreur contact-erreur-general", role: "alert" });
  let bouton = null;

  // Les cases annexes : les formateurs du jour qui ne sont pas destinataires principaux, et le délégué. Un formateur du jour décoché
  // en mode choix reste prévenu en copie tant que « formateurs » n'est pas décoché : la base le fait ainsi.
  function annexes(l) {
    const a = apercu?.annexes ?? {};
    const noms = (a.formateurs ?? []).map((x) => x.nom);
    if (l.mode === "choix") for (const c of l.cases) if (!c.coche && (apercu.possibles ?? []).find((p) => p.fiche_id === c.fiche_id)?.pre_coche) noms.push(c.nom);
    const lignes = [];
    if (noms.length) lignes.push({ cle: "formateurs", libelle: `Formateurs du jour en copie : ${noms.join(", ")}` });
    if ((a.delegues ?? []).length) lignes.push({ cle: "delegue", libelle: `Ton délégué en copie : ${a.delegues.map((x) => x.nom).join(", ")}` });
    return { lignes, nonPrevenus: (a.non_prevenus ?? []).map((x) => libelleDestinataire({ nom: x.nom, non_prevenu: true })) };
  }

  function dessinerEncadre() {
    clear(encadre);
    if (erreurApercu) {
      encadre.appendChild(el("p", { role: "alert" }, erreurApercu));
      encadre.appendChild(el("button", { class: "btn small", type: "button", onClick: () => chargerApercu(true) }, "Réessayer"));
      return;
    }
    if (apercu == null) {
      encadre.appendChild(el("p", { class: "contact-aide" }, problemeJours() ? PHRASE_CHOIX : "Chargement des personnes à prévenir"));
      return;
    }
    const l = lignesEncadre(apercu, coches);
    encadre.appendChild(el("p", {}, el("b", {}, "Sera envoyé à : "),
      l.mode === "regle" ? (apercu.principaux ?? []).map((p) => libelleDestinataire({ nom: p.nom, relais_de: p.relais_de })).join(", ") : null));
    if (l.mode === "choix") {
      encadre.appendChild(el("p", { class: "contact-aide" }, l.phrase));
      const liste = el("div", { class: "ecrire-cases" });
      for (const c of l.cases) {
        const id = "abs-dest-" + c.fiche_id;
        const saisie = el("input", { type: "checkbox", id, value: String(c.fiche_id), checked: c.coche });
        saisie.addEventListener("change", () => {
          // L'ensemble courant (celui de l'écran à cet instant), jamais celui du dessin : les clics successifs se cumulent.
          const courants = lignesEncadre(apercu, coches).cases.filter((x) => x.coche).map((x) => x.fiche_id);
          coches = basculerCoche(courants, c.fiche_id, saisie.checked);
          redessinerEncadre();
          majBouton();
        });
        liste.appendChild(el("label", { class: "contact-case", for: id }, saisie, el("span", {}, c.titre ? `${c.nom} (${c.titre})` : c.nom)));
      }
      if (l.cases.length) encadre.appendChild(liste);
    }
    const x = annexes(l);
    if (x.lignes.length) {
      const liste = el("div", { class: "ecrire-cases abs-annexes" });
      for (const a of x.lignes) {
        const id = "abs-annexe-" + a.cle;
        const saisie = el("input", { type: "checkbox", id, checked: !decochees.has(a.cle) });
        saisie.addEventListener("change", () => {
          if (saisie.checked) decochees.delete(a.cle); else decochees.add(a.cle);
          redessinerEncadre();
        });
        liste.appendChild(el("label", { class: "contact-case", for: id }, saisie, el("span", {}, a.libelle)));
      }
      encadre.appendChild(liste);
      const phrase = phraseCasesDecochees(x.lignes.filter((a) => decochees.has(a.cle)).map((a) => a.cle));
      if (phrase) encadre.appendChild(el("p", { class: "contact-aide" }, phrase));
    }
    for (const ligne of x.nonPrevenus) encadre.appendChild(el("p", { class: "contact-aide" }, ligne));
  }

  // Redessine l'encadré sans faire perdre la case au clavier : le focus revient sur la case qui porte le même identifiant.
  function redessinerEncadre() {
    const id = document.activeElement?.id;
    dessinerEncadre();
    if (id) document.getElementById(id)?.focus({ preventScroll: true });
  }

  function majBouton() {
    const p = probleme();
    const l = apercu ? lignesEncadre(apercu, coches) : null;
    const pret = !p && l != null && l.envoyable && !envoi;
    if (bouton) bouton.disabled = !pret;
    aide.textContent = p || (l && !l.envoyable ? l.phrase : "");
  }

  // L'aperçu dépend des demi-journées choisies seulement : taper des minutes ne le relit pas.
  async function chargerApercu(force = false) {
    const c = champs();
    if (problemeJours()) {
      appel++;
      apercu = null; cleApercu = null; erreurApercu = null; coches = null;
      dessinerEncadre(); majBouton();
      return;
    }
    const cle = JSON.stringify(demiJourneesDe(c).map((x) => [x.jour, x.demi]));
    if (!force && cle === cleApercu) { majBouton(); return; }
    const mien = ++appel;
    apercu = null; cleApercu = null; erreurApercu = null; coches = null;
    decochees.clear();
    dessinerEncadre(); majBouton();
    try {
      const a = await apercuAbsence(c);
      if (mien !== appel || jeton !== rendu) return;
      apercu = a;
      cleApercu = cle;
    } catch (e) {
      console.error("aperçu de l'absence", e);
      if (mien !== appel || jeton !== rendu) return;
      erreurApercu = phraseContact(e, PHRASE_ECHEC_ENCADRE);
    }
    dessinerEncadre(); majBouton();
  }

  const surChangement = () => { majFormulaire(); chargerApercu(); };

  // --- Le formulaire
  const date = el("input", { type: "date", id: "abs-date", min: aujourdhui });
  date.addEventListener("input", () => { etat.date = date.value; surChangement(); });
  const jusqua = el("input", { type: "date", id: "abs-jusqua", min: aujourdhui });
  jusqua.addEventListener("input", () => { etat.jusqua = jusqua.value; surChangement(); });
  const debut = el("input", { type: "time", id: "abs-debut" });
  debut.addEventListener("input", () => { etat.debut = debut.value; surChangement(); });
  const fin = el("input", { type: "time", id: "abs-fin" });
  fin.addEventListener("input", () => { etat.fin = fin.value; surChangement(); });
  const mot = el("textarea", { id: "abs-mot", rows: "3", maxlength: "200", "aria-describedby": "abs-mot-aide" });
  mot.addEventListener("input", () => { etat.mot = mot.value; majBouton(); });

  const champDate = el("div", { class: "field" }, el("label", { for: "abs-date" }, "Le jour"), date);
  const champJusqua = el("div", { class: "field" }, el("label", { for: "abs-jusqua" }, "Jusqu'au (facultatif)"), jusqua);
  const champHeures = el("div", { class: "abs-heures" },
    el("div", { class: "field" }, el("label", { for: "abs-debut" }, "De"), debut),
    el("div", { class: "field" }, el("label", { for: "abs-fin" }, "à"), fin));

  function majFormulaire() {
    champDate.hidden = etat.jour !== "autre";
    champJusqua.hidden = etat.jour == null || etat.quand === "heures";
    champHeures.hidden = etat.quand !== "heures";
    jusqua.min = champs().du || aujourdhui;
  }

  const formulaire = el("form", { class: "abs-formulaire", novalidate: "novalidate" },
    groupeChoix("jour", "Quel jour", JOURS, (v) => { etat.jour = v; surChangement(); }),
    champDate, champJusqua,
    groupeChoix("quand", "Quand", MOMENTS, (v) => { etat.quand = v; surChangement(); }),
    champHeures,
    groupeChoix("motif", "Motif", MOTIFS, (v) => { etat.motif = v; majBouton(); }),
    el("p", { class: "contact-aide" }, "Aucune précision médicale n'est demandée."),
    el("div", { class: "field" }, el("label", { for: "abs-mot" }, "Un mot (facultatif, 200 caractères au plus)"), mot),
    el("p", { class: "contact-aide", id: "abs-mot-aide" }, "N'y mets aucune information sur ta santé."),
    encadre, aide, general);
  formulaire.addEventListener("submit", (e) => e.preventDefault());

  async function envoyer() {
    general.textContent = "";
    if (probleme() || !apercu) return;
    const l = lignesEncadre(apercu, coches);
    if (!l.envoyable) return;
    const montrees = annexes(l).lignes.map((a) => a.cle);
    envoi = true;
    majBouton();
    try {
      const id = await prevenirAbsence({
        ...champs(), motif: etat.motif, mot: etat.mot.trim(),
        sans: montrees.filter((k) => decochees.has(k)),
        choisis: l.mode === "choix" ? l.cases.filter((c) => c.coche).map((c) => c.fiche_id) : null,
      });
      toast("Absence signalée.", "success", 2200);
      location.hash = `#/${routeDesDemandes()}/${id}`;
    } catch (e) {
      console.error("prévenir d'une absence", e);
      general.textContent = phraseContact(e, PHRASE_ECHEC_ENVOI);
      envoi = false;
      majBouton();
    }
  }

  bouton = el("button", { class: "btn primary", type: "button", disabled: true, onClick: envoyer }, icon.check(), "Envoyer");
  racine.appendChild(formulaire);
  racine.appendChild(el("div", { class: "contact-gestes-fiche abs-envoi" }, bouton,
    el("a", { class: "btn ghost", href: "#/home" }, "Annuler")));
  majFormulaire();
  dessinerEncadre();
  majBouton();
}
