// Page Émargement (spec 2026-10-23), réservée aux formateurs : la semaine (dix
// demi-journées et leur état) ou une demi-journée (#/emargement/2026-10-26/matin) :
// ouvrir, faire signer, absences et observations, signature du formateur, clore,
// rouvrir, imprimer. Les règles d'accès et d'horodatage sont tenues par la base.

import {
  listStagiaires, listProfs, getPlanning, getHalfMetaForWeek, getJoursOff, getPromoCourante,
  listEmargementSeances, ouvrirEmargement, signerEmargement, signerEmargementFormateur,
  annoterEmargement, cloreEmargement, rouvrirEmargement, getEnteteEmargement, setEnteteEmargement,
} from "../db.js?v=20261111h";
import { el, clear, toast, isoDate, displayStagiaire } from "../utils.js?v=20261111h";
import { confirmer } from "../confirmer.js?v=20261111h";
import { icon } from "../icons.js?v=20261111h";
import { isAdmin, isEquipe, getProfile } from "../auth-admin.js?v=20261111h";
import {
  etatLigne, resumeSeance, resumeEnClair, etatSansFeuille, absentsDuPlanning, libelleCreneau, heureLocale, jourLocal, lireAdresseEmargement,
  adresseSeance, jourFerie, nomsFormateursProposes, DEMI_JOURNEES,
  demiVoisine, notesProposees, roleAuPlanning,
} from "../emargement-rules.js?v=20261111h";
import { lundiDe, jourDe, dayIndexDe } from "../dates.js?v=20261111h";
import { ouvrirSignature, signatureOuMention } from "../signature-pad.js?v=20261111h";
import {
  feuilleSeance, feuilleSemaine, imprimer, nomComplet, jourLong, DEMI_LONG, stagiairesDeFeuille,
} from "../emargement-feuilles.js?v=20261111h";
import { rafraichirBandeauEmargement } from "../emargement-bandeau.js?v=20261111h";
import { emargementActif } from "../emargement-etat.js?v=20261111h";
import { estAdresseAttestations } from "../attestations-rules.js?v=20261111h";
import { renderAttestations } from "./attestations.js?v=20261111h";
import { ouvrirModale } from "../nav-fenetre.js?v=20261111h";

// Horaires par défaut, comme DEFAULT_HALF_META du planning.
const HORAIRES_DEFAUT = { matin: { debut: "09:00", fin: "12:30" }, aprem: { debut: "13:30", fin: "17:00" } };
const RELECTURE_MS = 10000;

let minuteur = null;
function arreterRelecture() {
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
}

// Numéro du dernier affichage demandé : une lecture lente d'une page quittée entre-temps ne
// doit pas remplacer la page affichée depuis (deux changements de demi-journée rapprochés).
let rendu = 0;

// dansLeCentre : la semaine posée sous le résumé par promo de la direction (js/views/direction-centre.js), sans titre de page.
export async function renderEmargement(container, { dansLeCentre = false } = {}) {
  arreterRelecture();
  const jeton = ++rendu;
  clear(container);
  // Ouvrir une séance et lire la feuille : le formateur de la promo. La direction (isEquipe sans isAdmin, lot 5) lit les feuilles,
  // imprime les feuilles closes et les attestations, mais n'écrit jamais : la base refuserait, les gestes d'écriture sont masqués.
  const lecture = !isAdmin();
  if (lecture && !isEquipe()) {
    container.appendChild(el("p", { class: "muted" }, "L'émargement se gère par les formateurs de la promo."));
    return;
  }
  if (!emargementActif()) {
    container.appendChild(el("p", { class: "muted" }, "L'émargement n'est pas activé pour cette promo."));
    return;
  }
  if (estAdresseAttestations(location.hash)) {
    await renderAttestations(container, { estCourant: () => jeton === rendu, ouvrirEntete });
    return;
  }
  const { jour: jourAdresse, demi } = lireAdresseEmargement(location.hash);
  const aujourdhui = isoDate(new Date());
  const jour = jourAdresse || aujourdhui;
  const lundi = lundiDe(jour);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const [stagiairesTous, profs, entries, metas, joursOff, seances, entete] = await Promise.all([
    listStagiaires({ includeInactive: true }), listProfs(), getPlanning(lundi), getHalfMetaForWeek(lundi),
    getJoursOff(lundi), listEmargementSeances(lundi, jourDe(lundi, 4)), getEnteteEmargement(),
  ]);
  if (jeton !== rendu) return;
  const ctx = {
    jeton, lecture, dansLeCentre,
    container, jour, demi, lundi, aujourdhui, stagiairesTous, profs, entries, metas, joursOff, seances, entete,
    promo: getPromoCourante(),
  };
  dessiner(ctx);
}

function dessiner(ctx) {
  clear(ctx.container);
  const page = el("section", { class: "em-page" });
  ctx.page = page;
  ctx.container.appendChild(page);
  if (ctx.demi) dessinerSeance(ctx); else dessinerSemaine(ctx);
}

// Relit les feuilles et le planning de la semaine (absences), puis redessine.
async function recharger(ctx) {
  const [seances, entries] = await Promise.all([
    listEmargementSeances(ctx.lundi, jourDe(ctx.lundi, 4)), getPlanning(ctx.lundi),
  ]);
  if (ctx.jeton !== rendu) return;
  ctx.seances = seances;
  ctx.entries = entries;
  dessiner(ctx);
}

function seanceDe(ctx, jour, demi) {
  return ctx.seances.find((s) => s.jour === jour && s.demi_journee === demi) || null;
}

function horairesDe(ctx, jour, demi) {
  const m = ctx.metas.find((x) => x.day_index === dayIndexDe(jour) && x.half_day === demi);
  return m ? { debut: m.start_time, fin: m.end_time } : HORAIRES_DEFAUT[demi];
}

function jourOff(ctx, jour) {
  const manuel = ctx.joursOff.find((j) => j.day_index === dayIndexDe(jour));
  if (manuel) return manuel.label || "Jour désactivé";
  return jourFerie(jour);
}

function stagiaireIdsActifs(ctx) {
  return ctx.stagiairesTous.filter((s) => s.actif && !s.anonymise_le).map((s) => s.id);
}

function enErreur(e) {
  toast(e?.message || String(e), "error", 4000);
}

// ===================================================================== Semaine

function dessinerSemaine(ctx) {
  const { page, lundi, aujourdhui } = ctx;
  const vendredi = jourDe(lundi, 4);
  const titre = `Semaine du ${jourLong(lundi, { annee: false }).toLowerCase()} au ${jourLong(vendredi).toLowerCase()}`;
  const aller = (j) => { location.hash = adresseSeance(j, null); };

  // La page porte le nom de son entrée, « Émargement », avec la promo en surtitre, comme les autres pages de l'équipe.
  if (!ctx.dansLeCentre) {
    page.appendChild(el("div", { class: "view-header" },
      el("div", { class: "view-header-text" },
        ctx.promo ? el("p", { class: "eyebrow" }, ctx.promo.nom) : null,
        el("h2", {}, "Émargement"),
        el("p", { class: "subtitle" }, ctx.lecture
          ? "Les feuilles de la promo, en lecture. Vous pouvez imprimer les feuilles closes et les attestations."
          : "Ouvrez la feuille de la demi-journée en cours : chaque stagiaire signe sur son téléphone, "
            + "puis vous signez et vous la clôturez. Les absences notées au planning sont reprises."),
      ),
    ));
  }

  const prev = el("button", { class: "btn small icon-only", type: "button", "aria-label": "Semaine précédente",
    onClick: () => aller(jourDe(lundi, -7)) }, icon.chevronLeft());
  const next = el("button", { class: "btn small icon-only", type: "button", "aria-label": "Semaine suivante",
    onClick: () => aller(jourDe(lundi, 7)) }, icon.chevronRight());
  const cette = el("button", { class: "btn small", type: "button", onClick: () => aller(aujourdhui) }, "Aujourd'hui");
  // Calendrier natif, comme la date de la page Notes : n'importe quel jour mène à sa semaine.
  const choixDate = el("input", { type: "date", class: "em-date", value: ctx.jour, "aria-label": "Aller à une date" });
  choixDate.addEventListener("change", () => { if (choixDate.value) aller(choixDate.value); });
  // Direction (lecture) : l'impression des feuilles et les attestations sont offertes sur ordinateur (spec lot 5, § 4.2 et § 4.3).
  const surOrdinateur = ctx.lecture ? " solo-ordinateur" : "";
  const imprimerSemaine = el("button", { class: "btn small" + surOrdinateur, type: "button",
    onClick: () => imprimer(feuilleSemaine({
      entete: ctx.entete, promo: ctx.promo, lundi, seances: ctx.seances,
      stagiairesTous: ctx.stagiairesTous, joursOff: ctx.joursOff,
    }), { ancre: page, page: "A4 landscape" }) },
    icon.list(), "Feuille de la semaine");
  const reglerEntete = el("button", { class: "btn small", type: "button", onClick: () => ouvrirEntete(ctx) },
    "En-tête");
  const attestations = el("a", { class: "btn small" + surOrdinateur, href: "#/emargement/attestations" },
    icon.clipboard(), "Attestations");
  // La base n'accepte l'écriture des réglages que d'un administrateur : le bouton « En-tête » suit.
  page.appendChild(el("div", { class: "em-barre" },
    el("div", { class: "em-barre-nav" }, el("span", { class: "em-barre-titre" }, titre), prev, choixDate, next, cette),
    el("div", { class: "em-barre-actions" }, imprimerSemaine, attestations, isAdmin() ? reglerEntete : null),
  ));

  const actifs = stagiaireIdsActifs(ctx);
  const grille = el("div", { class: "em-semaine" });
  for (let d = 0; d < 5; d++) {
    const jour = jourDe(lundi, d);
    const off = jourOff(ctx, jour);
    const colonne = el("div", { class: "em-jour" + (jour === aujourdhui ? " em-aujourdhui" : "") },
      el("p", { class: "em-jour-titre" }, jourLong(jour, { annee: false }), jour === aujourdhui ? el("span", { class: "em-pastille" }, "Aujourd'hui") : null));
    for (const demi of DEMI_JOURNEES) {
      const s = seanceDe(ctx, jour, demi);
      const h = s || horairesDe(ctx, jour, demi);
      let etat, classe;
      if (s && s.statut === "ouverte") {
        const r = resumeSeance(s.lignes, stagiairesDeFeuille(s, ctx.stagiairesTous).map((x) => x.id), false);
        etat = `Ouverte · ${r.signes} sur ${r.total} signés`;
        classe = "ouverte";
      } else if (s) {
        const r = resumeSeance(s.lignes, stagiairesDeFeuille(s, ctx.stagiairesTous).map((x) => x.id), true);
        etat = `Close · ${r.signes} présent${r.signes > 1 ? "s" : ""}, ${r.absents} absent${r.absents > 1 ? "s" : ""}`;
        classe = "close";
      } else if (off) {
        etat = off; classe = "off";
      } else if (jour === aujourdhui) {
        etat = ctx.lecture ? "Pas de feuille" : "À ouvrir"; classe = ctx.lecture ? "vide" : "a-ouvrir";
      } else {
        // Passée, une demi-journée de cours sans feuille se voit (« Feuille non faite ») ; sans cours, « Rien de prévu ».
        ({ etat, classe } = etatSansFeuille({ jour, aujourdhui, demi, entries: ctx.entries, feuillesDeLaSemaine: ctx.seances.length }));
      }
      colonne.appendChild(el("a", { class: "em-case em-case-" + classe, href: adresseSeance(jour, demi) },
        el("span", { class: "em-case-demi" }, demi === "matin" ? "Matin" : "Après-midi"),
        el("span", { class: "em-case-heures" }, libelleCreneau(h)),
        el("span", { class: "em-case-etat" }, etat),
      ));
    }
    grille.appendChild(colonne);
  }
  page.appendChild(grille);
  // Sur téléphone, les jours s'empilent : la journée en cours est amenée à l'écran.
  const auj = grille.querySelector(".em-aujourdhui");
  if (auj && window.matchMedia("(max-width: 760px)").matches) {
    requestAnimationFrame(() => auj.scrollIntoView({ block: "start", behavior: "auto" }));
  }
  if (actifs.length === 0) {
    page.appendChild(el("p", { class: "muted" }, "Aucun stagiaire actif dans cette promo."));
  }
}

// Exporté pour la page Attestations, qui règle le même en-tête (signataire, lieu).
export function ouvrirEntete(ctx, { apres = null } = {}) {
  const champ = (k, max, attrs = {}) => el("input", { type: "text", value: ctx.entete[k] || "", maxlength: String(max), ...attrs });
  const organisme = champ("organisme", 120);
  const intitule = champ("intitule", 200);
  const adresse1 = champ("adresse1", 120, { placeholder: "Rue" });
  const adresse2 = champ("adresse2", 120, { placeholder: "Code postal et ville" });
  const signataire = champ("signataire", 80, { placeholder: "Prénom et nom" });
  const qualite = champ("qualite", 80, { placeholder: "Directeur, responsable pédagogique…" });
  const lieu = champ("lieu", 60, { placeholder: ctx.promo?.lieu_nom || "" });
  let modale = null;   // la fenêtre, une fois ouverte (ouvrirModale, js/nav-fenetre.js)
  const fermer = () => modale.fermer();
  const enregistrer = el("button", { class: "btn primary", type: "button", onClick: async () => {
    enregistrer.disabled = true;
    try {
      await setEnteteEmargement({
        organisme: organisme.value, intitule: intitule.value, adresse1: adresse1.value, adresse2: adresse2.value,
        signataire: signataire.value, qualite: qualite.value, lieu: lieu.value,
      });
      ctx.entete = await getEnteteEmargement();
      toast("En-tête enregistré pour cette promo.", "success");
      fermer();
      if (apres) apres(ctx.entete);
    } catch (e) { enregistrer.disabled = false; enErreur(e); }
  } }, "Enregistrer");
  modale = ouvrirModale(el("div", { class: "modal em-modal-entete", role: "dialog", "aria-modal": "true", "aria-label": "En-tête des documents" },
    el("h3", {}, "En-tête des documents"),
    el("div", { class: "modal-form" },
      el("label", {}, "Organisme de formation", organisme),
      el("label", {}, "Intitulé de la formation", intitule),
      el("p", { class: "muted em-note" }, "Imprimés en haut des feuilles, des certificats et des attestations de cette promo."),
      el("label", {}, "Adresse de l'organisme", adresse1, adresse2),
      el("label", {}, "Signataire des certificats", signataire),
      el("label", {}, "Qualité du signataire", qualite),
      el("label", {}, "Fait à", lieu),
      el("p", { class: "muted em-note" },
        "Facultatifs : laissés vides, ils s'impriment en pointillés à compléter à la main. "
        + "Sans lieu, le certificat porte celui de la promo."),
    ),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: fermer }, "Annuler"), enregistrer),
  ), { fermerAuVoile: false, focus: organisme, avantFermeture: () => !enregistrer.disabled });
}

// ===================================================================== Demi-journée

function dessinerSeance(ctx) {
  const { page, jour, demi, aujourdhui } = ctx;
  const s = seanceDe(ctx, jour, demi);
  const h = s || horairesDe(ctx, jour, demi);
  const off = jourOff(ctx, jour);
  const libelleStatut = s ? (s.statut === "ouverte" ? "Ouverte" : "Close") : "Pas ouverte";

  // Navigation de la demi-journée : retour à la semaine, précédente et suivante (sans week-end),
  // calendrier, matin ou après-midi, retour à aujourd'hui.
  const voisine = (sens) => { const v = demiVoisine(jour, demi, sens); location.hash = adresseSeance(v.jour, v.demi); };
  const choixDate = el("input", { type: "date", class: "em-date", value: jour, "aria-label": "Aller à une date" });
  choixDate.addEventListener("change", () => { if (choixDate.value) location.hash = adresseSeance(choixDate.value, demi); });
  const bascule = (d, libelle) => el("a", { class: "em-demi" + (d === demi ? " actif" : ""), href: adresseSeance(jour, d),
    "aria-current": d === demi ? "page" : null }, libelle);
  const demiDuMoment = new Date().getHours() * 60 + new Date().getMinutes() < 12 * 60 + 45 ? "matin" : "aprem";
  page.appendChild(el("div", { class: "em-nav-seance" },
    el("a", { class: "em-retour", href: adresseSeance(jour, null) }, icon.chevronLeft(), "Semaine"),
    el("div", { class: "em-nav-groupe" },
      el("button", { class: "btn small icon-only", type: "button", "aria-label": "Demi-journée précédente",
        onClick: () => voisine(-1) }, icon.chevronLeft()),
      choixDate,
      el("div", { class: "em-demis", role: "group", "aria-label": "Demi-journée" }, bascule("matin", "Matin"), bascule("aprem", "Après-midi")),
      el("button", { class: "btn small icon-only", type: "button", "aria-label": "Demi-journée suivante",
        onClick: () => voisine(1) }, icon.chevronRight()),
      jour !== aujourdhui || demi !== demiDuMoment
        ? el("a", { class: "btn small", href: adresseSeance(aujourdhui, demiDuMoment) }, "Maintenant")
        : null,
    ),
  ));
  page.appendChild(el("div", { class: "view-header" },
    el("div", { class: "view-header-text" },
      el("p", { class: "eyebrow" }, "Émargement" + (ctx.promo ? " · " + ctx.promo.nom : "")),
      el("h2", {}, `${jourLong(jour)}, ${DEMI_LONG[demi]}`),
      el("p", { class: "subtitle" }, libelleCreneau(h), " · ",
        el("span", { class: "em-statut em-statut-" + (s ? s.statut : "aucune") }, libelleStatut)),
    ),
  ));

  if (!s) {
    dessinerOuverture(ctx, { off });
    return;
  }

  const absentsPlanning = absentsDuPlanning(ctx.entries, dayIndexDe(jour), demi);
  const ouverte = s.statut === "ouverte";
  const duJour = jour === aujourdhui;
  const liste = stagiairesDeFeuille(s, ctx.stagiairesTous);
  const r = resumeSeance(s.lignes, liste.map((x) => x.id), !ouverte, absentsPlanning);

  // Signés, marqués absents, en attente et absents prévus au planning : la même lecture que la carte d'« Aujourd'hui » (A1).
  page.appendChild(el("div", { class: "em-resume" },
    el("span", { class: "em-resume-chiffre" }, `${r.signes} sur ${r.total}`), resumeEnClair(r, { ouverte }),
  ));
  if (ouverte && !duJour && !ctx.lecture) {
    page.appendChild(el("p", { class: "em-alerte" },
      "Cette feuille date d'un autre jour : les stagiaires ne peuvent plus la signer. Signez-la si ce n'est pas fait, puis clôturez-la."));
  }

  const ul = el("ul", { class: "em-liste" });
  const parId = new Map(s.lignes.map((l) => [l.stagiaire_id, l]));
  for (const st of liste) {
    const ligne = parId.get(st.id) || null;
    const etat = etatLigne({ ligne, absentPlanning: absentsPlanning.has(st.id), close: !ouverte });
    const actions = el("div", { class: "em-ligne-actions" });
    if (ctx.lecture) { /* lecture : aucun geste d'écriture */ } else {
    if (ouverte && duJour && etat.code === "attente") {
      actions.appendChild(el("button", { class: "btn small primary", type: "button",
        onClick: () => faireSigner(ctx, s, st) }, "Faire signer ici"));
    }
    if (ouverte && etat.code === "attente") {
      actions.appendChild(el("button", { class: "btn small", type: "button",
        onClick: () => ouvrirAbsence(ctx, s, st) }, "Absent"));
    }
    if (ouverte && etat.code === "absent") {
      actions.appendChild(el("button", { class: "btn small", type: "button",
        onClick: () => annoter(ctx, s, st, { absent: false }, "Absence retirée.") }, "Retirer l'absence"));
    }
    actions.appendChild(el("button", { class: "btn small ghost", type: "button",
      onClick: () => ouvrirObservation(ctx, s, st, ligne) }, ligne?.observation ? "Modifier la remarque" : "Remarque"));
    }
    ul.appendChild(el("li", { class: "em-ligne em-ligne-" + etat.code },
      el("div", { class: "em-ligne-sig" }, etat.code === "signe" ? signatureOuMention(ligne, "Signature de " + displayStagiaire(st)) : null),
      el("div", { class: "em-ligne-corps" },
        el("span", { class: "em-ligne-nom" }, displayStagiaire(st)),
        el("span", { class: "em-ligne-etat" }, etat.libelle,
          etat.code === "signe" && ligne.sur_appareil_formateur ? " · sur l'appareil du formateur" : ""),
        ligne?.observation ? el("span", { class: "em-ligne-obs" }, ligne.observation) : null,
      ),
      actions,
    ));
  }
  page.appendChild(ul);

  dessinerFormateurs(ctx, s, { ouverte });

  const pied = el("div", { class: "em-pied" });
  pied.appendChild(el("button", { class: "btn" + (ctx.lecture ? " solo-ordinateur" : ""), type: "button",
    onClick: () => imprimer(feuilleSeance({ entete: ctx.entete, promo: ctx.promo, seance: s,
      stagiairesTous: ctx.stagiairesTous, absentsPlanning }), { ancre: page, page: "A4 portrait" }) },
    icon.list(), "Imprimer la feuille"));
  if (ctx.lecture) {
    /* lecture : ni clôture ni réouverture */
  } else if (ouverte) {
    const sansFormateur = s.formateurs.length === 0;
    const clore = el("button", { class: "btn primary", type: "button", disabled: sansFormateur ? "disabled" : null,
      onClick: () => cloreFeuille(ctx, s, r.attente) }, "Clore l'émargement");
    pied.appendChild(clore);
    if (sansFormateur) pied.appendChild(el("p", { class: "muted em-note" }, "Il manque la signature du formateur pour clore."));
  } else if (duJour) {
    pied.appendChild(el("button", { class: "btn", type: "button", onClick: async () => {
      try {
        await rouvrirEmargement(s.id);
        toast("Feuille rouverte : les absences posées à la clôture sont retirées.", "success");
        rafraichirBandeauEmargement();
        await recharger(ctx);
      } catch (e) { enErreur(e); }
    } }, "Rouvrir"));
  }
  page.appendChild(pied);

  if (ouverte) lancerRelecture(ctx);
}

function dessinerOuverture(ctx, { off }) {
  const { page, jour, demi, aujourdhui } = ctx;
  if (ctx.lecture && jour === aujourdhui) {
    page.appendChild(el("p", { class: "em-vide" }, "Aucune feuille n'est ouverte pour cette demi-journée."));
    return;
  }
  if (jour !== aujourdhui) {
    page.appendChild(el("p", { class: "em-vide" }, jour < aujourdhui
      ? "Aucune feuille d'émargement pour cette demi-journée."
      : ctx.lecture ? "Pas encore de feuille ce jour-là." : "La feuille s'ouvrira le jour même."));
    return;
  }
  const h = horairesDe(ctx, jour, demi);
  const debut = el("input", { type: "time", value: h.debut, step: "300" });
  const fin = el("input", { type: "time", value: h.fin, step: "300" });
  const ouvrir = el("button", { class: "btn primary", type: "button", onClick: async () => {
    ouvrir.disabled = true;
    try {
      await ouvrirEmargement(demi, debut.value, fin.value);
      toast("Émargement ouvert : les stagiaires peuvent signer sur leur téléphone.", "success", 3500);
      rafraichirBandeauEmargement();
      await recharger(ctx);
    } catch (e) { ouvrir.disabled = false; enErreur(e); }
  } }, "Ouvrir l'émargement");
  page.appendChild(el("div", { class: "em-ouvrir" },
    off ? el("p", { class: "em-alerte" }, `Jour marqué « ${off} » au planning.`) : null,
    el("p", {}, "Horaires imprimés sur la feuille (repris du planning) :"),
    el("div", { class: "em-horaires" }, el("label", {}, "Début", debut), el("label", {}, "Fin", fin)),
    ouvrir,
    el("p", { class: "muted em-note" }, "Dès l'ouverture, un bandeau « Signer » apparaît dans l'app de chaque stagiaire. "
      + "Pour un stagiaire sans téléphone, « Faire signer ici » sur votre appareil."),
  ));
}

function dessinerFormateurs(ctx, s, { ouverte }) {
  const bloc = el("div", { class: "em-formateurs" }, el("h3", {}, "Formateur"));
  for (const f of s.formateurs) {
    bloc.appendChild(el("div", { class: "em-formateur" },
      el("div", { class: "em-ligne-sig" }, signatureOuMention(f, "Signature de " + f.nom)),
      el("div", { class: "em-ligne-corps" },
        el("span", { class: "em-ligne-nom" }, f.nom),
        el("span", { class: "em-ligne-etat" }, jourLocal(f.signe_le) === s.jour
          ? "Signé à " + heureLocale(f.signe_le)
          : "Signé le " + jourLong(jourLocal(f.signe_le), { annee: false }).toLowerCase() + " à " + heureLocale(f.signe_le)))));
  }
  // Le formateur peut signer une feuille oubliée un autre jour (heure réelle) : sans cela
  // elle ne pourrait jamais être close.
  if (ouverte && !ctx.lecture) {
    const profil = getProfile();
    const monNom = ctx.profs.find((p) => p.id === profil?.prof_id)?.nom || null;
    const entries = ctx.entries.filter((e) => e.day_index === dayIndexDe(s.jour) && e.half_day === s.demi_journee);
    const deja = new Set(s.formateurs.map((f) => f.nom.toLowerCase()));
    const noms = nomsFormateursProposes({ entries, profs: ctx.profs, monNom }).filter((n) => !deja.has(n.toLowerCase()));
    const idListe = "em-noms-formateurs";
    const nom = el("input", { type: "text", list: idListe, value: noms[0] || "", maxlength: "80",
      placeholder: "Nom du formateur", "aria-label": "Nom du formateur" });
    bloc.appendChild(el("datalist", { id: idListe }, ...noms.map((n) => el("option", { value: n }))));
    bloc.appendChild(el("div", { class: "em-signer-formateur" }, nom,
      el("button", { class: "btn small primary", type: "button", onClick: async () => {
        const n = nom.value.trim();
        if (!n) { toast("Indiquez le nom du formateur.", "error"); nom.focus(); return; }
        const ok = await ouvrirSignature({
          titre: "Signature du formateur",
          attestation: `${n} atteste avoir assuré la formation du ${jourLong(s.jour).toLowerCase()}, ${DEMI_LONG[s.demi_journee]} (${libelleCreneau(s)}).`,
          libelleValider: "Valider la signature",
          valider: (trace) => signerEmargementFormateur(s.id, n, trace),
        });
        if (ok) { toast("Signature du formateur enregistrée.", "success"); await recharger(ctx).catch(enErreur); }
      } }, "Signer")));
  } else if (s.formateurs.length === 0) {
    bloc.appendChild(el("p", { class: "muted" }, "Aucune signature de formateur."));
  }
  ctx.page.appendChild(bloc);
}

async function faireSigner(ctx, s, st) {
  const ok = await ouvrirSignature({
    titre: "Signature de " + displayStagiaire(st),
    // L'attestation engage la personne : nom complet, comme sur la feuille imprimée (décision du 10/11).
    attestation: `${nomComplet(st)} atteste sa présence à la formation du ${jourLong(s.jour).toLowerCase()}, `
      + `${DEMI_LONG[s.demi_journee]} (${libelleCreneau(s)}). Signature recueillie sur l'appareil du formateur.`,
    libelleValider: "Valider la signature",
    valider: (trace) => signerEmargement(s.id, st.id, trace),
  });
  if (ok) {
    toast("Signature enregistrée.", "success");
    await recharger(ctx).catch(enErreur);
  }
}

async function annoter(ctx, s, st, changement, message) {
  try {
    await annoterEmargement(s.id, st.id, changement);
    toast(message, "success");
    await recharger(ctx);
  } catch (e) { enErreur(e); }
}

// Remarques déjà écrites sur les feuilles de la semaine affichée : proposées en un clic.
function notesDeLaSemaine(ctx) {
  return notesProposees(ctx.seances.flatMap((x) => x.lignes.map((l) => l.observation)),
    heureLocale(new Date().toISOString()));
}

function pucesDeNotes(notes, choisir) {
  return el("div", { class: "em-puces" }, ...notes.map((t) =>
    el("button", { type: "button", class: "em-puce", onClick: () => choisir(t) }, t)));
}

// Marquer absent : la raison en un clic (ou une précision libre). Si le stagiaire est prévu au
// planning de la demi-journée, rappel de le remplacer sur sa carte.
function ouvrirAbsence(ctx, s, st) {
  const precision = el("input", { type: "text", maxlength: "200", placeholder: "Autre précision (facultatif)" });
  let modale = null;   // la fenêtre, une fois ouverte (ouvrirModale, js/nav-fenetre.js)
  const fermer = () => modale.fermer();
  const marquer = async (observation) => {
    fermer();
    await annoter(ctx, s, st, { absent: true, observation: observation || null }, `${displayStagiaire(st)} marqué absent.`);
  };
  const role = roleAuPlanning(ctx.entries, dayIndexDe(s.jour), s.demi_journee, st.id);
  modale = ouvrirModale(el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Marquer absent" },
    el("h3", {}, "Absent : " + displayStagiaire(st)),
    role ? el("p", { class: "em-alerte" }, `Prévu ${role} sur le planning de cette demi-journée : pensez à le remplacer sur sa carte. `,
      el("a", { href: "#/planning" }, "Ouvrir le planning")) : null,
    el("div", { class: "modal-form" },
      pucesDeNotes(["Absence injustifiée", "Absence justifiée", "Rendez-vous médical"], marquer),
      el("label", {}, "Ou une autre précision", precision)),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: fermer }, "Annuler"),
      el("button", { class: "btn primary", type: "button", onClick: () => marquer(precision.value.trim()) },
        "Marquer absent")),
  ), { fermerAuVoile: false });
}

function ouvrirObservation(ctx, s, st, ligne) {
  const champ = el("input", { type: "text", value: ligne?.observation || "", maxlength: "200",
    placeholder: "Ex. : arrivé à 9 h 40, absence justifiée" });
  const puces = pucesDeNotes(notesDeLaSemaine(ctx), (t) => { champ.value = t; champ.focus(); });
  let modale = null;   // la fenêtre, une fois ouverte (ouvrirModale, js/nav-fenetre.js)
  const fermer = () => modale.fermer();
  const enregistrer = async (texte) => {
    try {
      await annoterEmargement(s.id, st.id, { observation: texte });
      fermer();
      toast(texte ? "Remarque enregistrée." : "Remarque effacée.", "success");
      await recharger(ctx);
    } catch (e) { enErreur(e); }
  };
  modale = ouvrirModale(el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Remarque sur la feuille" },
    el("h3", {}, "Remarque : " + displayStagiaire(st)),
    el("div", { class: "modal-form" },
      puces,
      el("label", {}, "Imprimée dans la colonne Observations de la feuille", champ)),
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: fermer }, "Annuler"),
      ligne?.observation ? el("button", { class: "btn", type: "button", onClick: () => enregistrer("") }, "Effacer") : null,
      el("button", { class: "btn primary", type: "button", onClick: () => enregistrer(champ.value.trim()) }, "Enregistrer")),
  ), { fermerAuVoile: false, focus: champ });
}

async function cloreFeuille(ctx, s, enAttente) {
  const phrase = enAttente
    ? `${enAttente} stagiaire${enAttente > 1 ? "s" : ""} sans signature ${enAttente > 1 ? "seront marqués" : "sera marqué"} absent${enAttente > 1 ? "s" : ""}.`
    : "Plus personne ne pourra la signer.";
  if (!(await confirmer({ titre: "Clore la feuille ?", phrase, oui: "Clore la feuille" }))) return;
  try {
    const n = await cloreEmargement(s.id);
    toast(`Feuille close${n ? ` : ${n} marqué${n > 1 ? "s" : ""} absent${n > 1 ? "s" : ""}` : ""}.`, "success");
    rafraichirBandeauEmargement();
    await recharger(ctx);
  } catch (e) { enErreur(e); }
}

// Pendant une feuille ouverte, les signatures arrivent des téléphones : relecture toutes les
// 10 secondes, suspendue pendant une saisie (fenêtre ouverte, champ actif), arrêtée dès
// qu'on quitte la demi-journée.
function lancerRelecture(ctx) {
  arreterRelecture();
  const adresse = adresseSeance(ctx.jour, ctx.demi);
  let empreinte = empreinteSemaine(ctx.seances);
  minuteur = setInterval(async () => {
    if (!location.hash.startsWith(adresse) || !ctx.page.isConnected) { arreterRelecture(); return; }
    if (document.hidden || document.querySelector(".modal-backdrop")) return;
    const actif = document.activeElement;
    if (actif && ctx.page.contains(actif) && actif.matches("input, textarea, select")) return;
    try {
      const seances = await listEmargementSeances(ctx.lundi, jourDe(ctx.lundi, 4));
      const nouvelle = empreinteSemaine(seances);
      if (nouvelle === empreinte || !location.hash.startsWith(adresse) || ctx.jeton !== rendu) return;
      empreinte = nouvelle;
      ctx.seances = seances;
      dessiner(ctx);
    } catch (e) { /* réseau : on retentera au prochain tour */ }
  }, RELECTURE_MS);
}

function empreinteSemaine(seances) {
  return JSON.stringify(seances.map((s) => [s.id, s.statut,
    s.lignes.map((l) => [l.stagiaire_id, l.signe_le, l.absent, l.observation]),
    s.formateurs.map((f) => f.id)]));
}
