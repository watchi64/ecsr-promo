// Livret officiel EPCF — document ministère du travail TP-01303 (« Livret
// d'évaluations passées en cours de formation »), reproduit à l'identique.
// Demande d'Hocine (mail du 16/07/2026) : les formateurs le remplissent sur le
// site par stagiaire, et l'impression doit ressortir EXACTEMENT comme le
// document officiel Word. Principe : le document affiché est le document
// imprimé (champs contenteditable + cases à cocher dessinées en CSS), un
// livret par stagiaire stocké en jsonb plat (table epcf_livrets, RLS stricte).
//
// Rôles : formateur/admin = liste des stagiaires + remplissage ; stagiaire =
// consultation de SON livret en lecture seule (imposé par la RLS).

import { listStagiaires, listProfs, listEpcfLivrets, getEpcfLivret, upsertEpcfLivret } from "../db.js?v=20260723f";
import { el, clear, displayStagiaire, compareByNom, formatDate, toast } from "../utils.js?v=20260723f";
import { isAdmin, isProf, getProfile } from "../auth-admin.js?v=20260723f";
import { getCurrentWho } from "../identity.js?v=20260723f";

// ---------------------------------------------------------------------------
// Gabarit du document (contenu officiel, ne pas modifier sans nouveau modèle)
// ---------------------------------------------------------------------------

const AT1_TITRE = "Former des apprenants conducteurs par des actions individuelles et collectives, dans le respect des cadres réglementaires en vigueur";
const AT1_COMPETENCES = [
  "1. Construire et préparer le scénario d’une séance individuelle ou collective de formation",
  "2. Animer une séance collective de formation à la sécurité routière",
  "3. Animer une séance individuelle ou collective de formation à la conduite d’un véhicule léger",
  "4. Evaluer le degré d’acquisition des compétences des apprenants",
  "5. Encadrer et faciliter l’intervention d’un tiers dans une situation d’apprentissage",
  "6. Repérer les difficultés d’apprentissage et essayer d’y remédier",
  "7. Apprécier la dynamique de l’environnement routier et en identifier les risques potentiels",
];
const AT2_TITRE = "Sensibiliser l’ensemble des usagers de la route à l’adoption de comportements sûrs et respectueux de l’environnement";
const AT2_COMPETENCES = [
  "1. Analyser une demande relative à une prestation de sensibilisation",
  "2. Construire et préparer une action de sensibilisation",
  "3. Animer une séance de sensibilisation à la sécurité routière, au respect des usagers et de l’environnement",
  "4. Analyser ses pratiques professionnelles afin de les faire évoluer",
];

const PH_TEXTE = "Cliquez ici pour taper du texte.";
const PH_DATE = "Cliquez ici pour choisir une date.";
const PH_NOM = "Entrez le nom ici.";
const NB_PAGES = 10;

// Champ texte inline (une ligne) / bloc multi-lignes / case à cocher.
// data-k = clé de sérialisation ; data-x = groupe exclusif (Mme/M., OUI/NON…).
function f(k, ph, extra = "") {
  const date = ph === PH_DATE ? " lv-date" : "";
  return `<span class="lv-f ${extra}${date}" data-k="${k}" data-ph="${ph || PH_TEXTE}"></span>`;
}
function fblock(k, hmm, ph) {
  return `<div class="lv-f lv-s10" style="min-height:${hmm}mm" data-k="${k}" data-ph="${ph || PH_TEXTE}"></div>`;
}
function cb(k, group) {
  if (!k) return `<span class="lv-cb"></span>`;   // case décorative du gabarit (jamais cochée)
  return `<span class="lv-cb" data-k="${k}"${group ? ` data-x="${group}"` : ""} role="checkbox" tabindex="0"></span>`;
}

// Pied de page officiel (cartouche SIGLE), identique sur toutes les pages.
function foot(page) {
  return `<div class="lv-foot"><table>
    <colgroup><col style="width:19mm"><col style="width:63mm"><col style="width:17mm"><col style="width:15mm"><col style="width:30mm"><col style="width:27mm"><col style="width:11mm"></colgroup>
    <tr><td>SIGLE</td><td>Type de document</td><td>Code titre</td><td>Millésime</td><td>Date JO</td><td>Date de mise à jour</td><td>Page</td></tr>
    <tr><td>ECSR</td><td>Livret d’évaluations passées en cours de formation</td><td>TP-01303</td><td>02</td><td>31/01/2021</td><td>09/02/2021</td><td>${page}/${NB_PAGES}</td></tr>
  </table></div>`;
}

// Tableau bordé « Description des évaluations mises en œuvre » (3 évaluations,
// cases compétences 1-9 comme le gabarit officiel, quel que soit l'AT).
// labels = numéros affichés dans la 1re colonne (le gabarit officiel affiche
// « 1, 2, 4 » sur les complémentaires AT2 : on reproduit tel quel).
// extraRows = rangées de cases supplémentaires du gabarit sur le dernier bloc
// (présentes dans le document officiel AT2, jamais cochées).
function evalTable(prefix, labels, extraRows = 0, rowMm = 7) {
  const rowsFor = (i, label) => {
    const k = `${prefix}.e${i}`;
    let html = `<tr style="height:${rowMm}mm">
      <td rowspan="${3 + (i === labels.length - 1 ? extraRows : 0)}" class="lv-center lv-b lv-s10">${label}</td>
      <td rowspan="${3 + (i === labels.length - 1 ? extraRows : 0)}">${fblock(`${k}.desc`, 16)}</td>
      <td rowspan="${3 + (i === labels.length - 1 ? extraRows : 0)}" class="lv-center">${f(`${k}.date`, PH_DATE, "lv-s10 lv-date-short")}</td>
      <td class="lv-s10">1 ${cb(`${k}.c1`)}</td><td class="lv-s10">4 ${cb(`${k}.c4`)}</td><td class="lv-s10">7 ${cb(`${k}.c7`)}</td></tr>
    <tr style="height:${rowMm}mm"><td class="lv-s10">2 ${cb(`${k}.c2`)}</td><td class="lv-s10">5 ${cb(`${k}.c5`)}</td><td class="lv-s10">8 ${cb(`${k}.c8`)}</td></tr>
    <tr style="height:${rowMm}mm"><td class="lv-s10">3 ${cb(`${k}.c3`)}</td><td class="lv-s10">6 ${cb(`${k}.c6`)}</td><td class="lv-s10">9 ${cb(`${k}.c9`)}</td></tr>`;
    if (i === labels.length - 1) {
      for (let r = 0; r < extraRows / 2; r++) {
        html += `<tr style="height:${rowMm}mm"><td class="lv-s10">2 ${cb()}</td><td class="lv-s10">5 ${cb()}</td><td class="lv-s10">8 ${cb()}</td></tr>
                 <tr style="height:${rowMm}mm"><td class="lv-s10">3 ${cb()}</td><td class="lv-s10">6 ${cb()}</td><td class="lv-s10">9 ${cb()}</td></tr>`;
      }
    }
    return html;
  };
  return `<table class="lv-tbl-borders" style="width:172.7mm">
    <colgroup><col style="width:5mm"><col style="width:121mm"><col style="width:16.7mm"><col style="width:10mm"><col style="width:10mm"><col style="width:10mm"></colgroup>
    <tr style="height:8mm"><td colspan="2" class="lv-b lv-s10">Description des évaluations mises en œuvre</td>
      <td class="lv-center lv-b lv-s10">Dates</td>
      <td colspan="3"><span class="lv-b lv-s10">Compétences évaluées </span><span class="lv-i lv-s8">(cochez)</span></td></tr>
    ${labels.map((label, i) => rowsFor(i, label)).join("")}
  </table>`;
}

// Intro du bloc résultat (satisfait / pas satisfait). Commune fiches + complémentaires.
function resultIntro(prefix) {
  return `<div style="margin-top:4mm">
    <p class="lv-b lv-s10">Lors de l’évaluation ou des évaluations passée(s) en cours de formation, le/la candidat(e) est considéré(e) :</p>
    <table style="width:180mm;margin-top:1mm">
      <colgroup><col style="width:6mm"><col style="width:174mm"></colgroup>
      <tr style="height:6.5mm"><td>${cb(`${prefix}.ok`, `${prefix}.res`)}</td><td class="lv-s10">Avoir satisfait aux critères issus des référentiels du titre professionnel attendus pour la réalisation de cette activité-type.</td></tr>
      <tr style="height:6.5mm"><td>${cb(`${prefix}.ko`, `${prefix}.res`)}</td><td class="lv-s10">Ne pas avoir satisfait aux critères issus des référentiels du titre professionnel.</td></tr>
    </table>
  </div>`;
}

function formateurRow(k) {
  return `<tr style="height:10mm">
    <td class="lv-i lv-s12">Nom</td><td class="lv-s6" style="vertical-align:middle">►</td><td>${f(`${k}.nom`, PH_NOM, "lv-name")}</td>
    <td class="lv-i lv-s12">Date</td><td class="lv-s6" style="vertical-align:middle">►</td><td class="lv-center">${f(`${k}.date`, PH_DATE)}</td>
    <td></td></tr>`;
}

function formateursTable(prefix, titre) {
  return `<table style="width:180mm;margin-top:5mm">
    <colgroup><col style="width:13mm"><col style="width:6mm"><col style="width:57mm"><col style="width:13mm"><col style="width:5mm"><col style="width:28mm"><col style="width:58mm"></colgroup>
    <tr><td colspan="6" class="lv-b lv-i lv-s12">${titre}</td><td class="lv-center lv-b lv-i lv-s12">Visa</td></tr>
    ${formateurRow(`${prefix}.f1`)}
    ${formateurRow(`${prefix}.f2`)}
  </table>`;
}

// Fiche de résultats d'une activité-type : 2 pages.
// Page A : en-tête + compétences + tableau d'évaluations + résultat (cases).
// Page B : entièrement dédiée aux zones à rédiger (points d'attention +
// compétences à réévaluer) → grande hauteur de saisie (retour utilisateur
// 19/07 : sous le tableau, les points d'attention manquaient de place).
function fichePages(pageA, num, titre, competences, prefix, opts = {}) {
  const a = `<div class="lv-page">
    <table style="width:172.5mm">
      <colgroup><col style="width:40mm"><col style="width:132.5mm"></colgroup>
      <tr><td colspan="2" class="lv-banner">Fiche de résultats des évaluations</td></tr>
      <tr><td class="lv-right lv-b lv-s16 lv-magenta" style="padding-top:2mm">Activité-type ${num}</td>
          <td class="lv-b lv-s14" style="padding-top:2mm">${titre}</td></tr>
    </table>
    <p class="lv-b lv-s14" style="margin-top:6mm">Compétences :</p>
    <div class="lv-s10 lv-just" style="margin-top:2mm;line-height:1.5">${competences.map((c) => `<p>${c}</p>`).join("")}</div>
    <div style="margin-top:5mm">${evalTable(prefix, opts.labels || ["1", "2", "3"], opts.extraRows || 0, opts.rowMm || 7)}</div>
    ${resultIntro(prefix)}
    ${foot(pageA)}
  </div>`;
  const b = `<div class="lv-page">
    <p class="lv-b lv-s11" style="margin-top:4mm">Si le candidat n’a pas satisfait aux critères issus des référentiels, notez ci-dessous les points d’attention et précisions éventuelles.</p>
    ${fblock(`${prefix}.attention`, opts.h1 ?? 105)}
    <p style="margin-top:3mm"><span class="lv-b lv-s11">Compétences à réévaluer : </span><span class="lv-i" style="color:#7F7F7F">(Voir évaluations complémentaires ci-après.)</span></p>
    ${fblock(`${prefix}.reeval`, opts.h2 ?? 62)}
    ${formateursTable(prefix, "Formateur(s) évaluateur(s)")}
    ${foot(pageA + 1)}
  </div>`;
  return a + b;
}

// Page « Evaluations complémentaires (si nécessaire) ».
function complPage(page, prefix, opts = {}) {
  return `<div class="lv-page">
    <p style="margin-top:4mm"><span class="lv-b lv-s16">Evaluations complémentaires </span><span class="lv-i lv-s10">(si nécessaire)</span></p>
    <div style="margin-top:5mm">${evalTable(prefix, opts.labels || ["1", "2", "3"], 0)}</div>
    ${resultIntro(prefix)}
    <p class="lv-b lv-s11" style="margin-top:4mm">Observations</p>
    ${fblock(`${prefix}.obs`, opts.h1 ?? 50)}
    ${formateursTable(prefix, "Formateur(s) évaluateur(s)")}
    ${foot(page)}
  </div>`;
}

function synthActiviteRows(num, titre, competences, key) {
  return `<tr style="height:17.6mm">
      <td class="lv-center lv-b lv-s10" style="vertical-align:middle">${titre}</td>
      <td colspan="2" class="lv-s10" style="line-height:1.35">${competences.map((c) => `<p>${c}</p>`).join("")}</td></tr>
    <tr style="height:6mm">
      <td class="lv-s11">L’activité ${num} est maîtrisée :</td>
      <td class="lv-s11">OUI ${cb(`syn.at${num}.oui`, key)}</td>
      <td class="lv-s11">NON ${cb(`syn.at${num}.non`, key)}</td></tr>`;
}

// Exporté pour le banc d'essai visuel (_preview_livret.html), sans effet en prod.
export function buildDocHTML() {
  const p1 = `<div class="lv-page lv-p1">
    <div class="lv-head">
      <div class="lv-head-logo"><img src="assets/livret/ministere-travail.png" alt="Ministère du Travail, de l'Emploi et de l'Insertion"></div>
      <div class="lv-head-right">
        <div class="lv-head-title">Livret d’Évaluations passÉes<br>en cours de formation</div>
        <div class="lv-head-band"><span class="lv-tri"></span></div>
      </div>
    </div>
    <table style="width:172.5mm">
      <tr><td class="lv-banner lv-center">Titre professionnel</td></tr>
      <tr><td style="height:2mm"></td></tr>
      <tr><td class="lv-center"><span class="lv-s16" style="color:#000">Enseignant de la conduite et de la sécurité routière</span><br><span class="lv-b lv-s12">Niveau 5</span></td></tr>
      <tr><td style="height:4mm"></td></tr>
    </table>
    <table style="width:172.5mm">
      <colgroup><col style="width:83mm"><col style="width:89.5mm"></colgroup>
      <tr><td class="lv-right lv-s12" style="padding-right:4mm">Arrêté du :</td><td class="lv-s16">26/01/2021</td></tr>
      <tr><td class="lv-right lv-s12" style="padding-right:4mm">J.O. du :</td><td class="lv-s16">31/01/2021</td></tr>
      <tr><td class="lv-right lv-s12" style="padding-right:4mm">Date d’effet au :</td><td class="lv-s16">29/04/2021</td></tr>
    </table>
    <table style="width:172.5mm;margin-top:12mm">
      <colgroup><col style="width:52.5mm"><col style="width:5mm"><col style="width:115mm"></colgroup>
      <tr style="height:8mm"><td class="lv-i lv-s12">Organisme de formation</td><td class="lv-s6" style="vertical-align:middle">►</td><td>${f("organisme", "Entrez l’organisme ici.")}</td></tr>
      <tr style="height:8mm"><td class="lv-i lv-s12">Lieu de formation</td><td class="lv-s6" style="vertical-align:middle">►</td><td>${f("lieu", "Entrez le lieu de formation ici.")}</td></tr>
    </table>
    <table style="width:172.5mm;margin-top:12mm">
      <colgroup><col style="width:52.5mm"><col style="width:5mm"><col style="width:27mm"><col style="width:88mm"></colgroup>
      <tr style="height:8mm"><td class="lv-b lv-i lv-s12 lv-magenta">Candidat(e) :</td><td></td>
        <td class="lv-s11">Mme ${cb("civ.mme", "civ")}</td><td class="lv-s11">M. ${cb("civ.m", "civ")}</td></tr>
      <tr style="height:8mm"><td class="lv-i lv-s12 lv-magenta">Nom</td><td class="lv-s6 lv-magenta" style="vertical-align:middle">►</td><td colspan="2">${f("nom", " ")}</td></tr>
      <tr style="height:8mm"><td class="lv-i lv-s12 lv-magenta">Prénom</td><td class="lv-s6 lv-magenta" style="vertical-align:middle">►</td><td colspan="2">${f("prenom", " ")}</td></tr>
      <tr style="height:8mm"><td class="lv-i lv-s12 lv-magenta">Date de naissance</td><td class="lv-s6 lv-magenta" style="vertical-align:middle">►</td><td colspan="2">${f("naissance", " ", "lv-date")}</td></tr>
    </table>
    ${foot(1)}
  </div>`;

  const p2 = `<div class="lv-page">
    <table style="width:172.5mm">
      <tr><td class="lv-banner lv-center">Présentation du dossier</td></tr>
    </table>
    <p class="lv-s10 lv-just" style="margin-top:12mm;line-height:1.45">Les évaluations passées en cours de formation décrites dans les fiches qui suivent ont été mises en œuvre en référence aux critères issus des référentiels du titre professionnel, pour les sessions d’examen «&nbsp;Titre&nbsp;», «&nbsp;CCP&nbsp;» et «&nbsp;CCS&nbsp;» telles que prévues par l’arrêté du 22 décembre 2015 relatif aux conditions de délivrance du titre professionnel du ministère chargé de l’emploi.</p>
    <p class="lv-s10" style="margin-top:8mm;color:#000">Le <span class="lv-b lv-i">Guide de mise en œuvre</span> des Evaluations passées en cours de formation est à télécharger sur le site du ministère de l’emploi : <span style="color:#0563C1;text-decoration:underline">http://travail-emploi.gouv.fr/</span> (rubrique Documents techniques).</p>
    <p class="lv-s10" style="margin-top:3mm;color:#000">Il comporte un mode d’emploi du présent Livret d’évaluations passées en cours de formation.</p>
    ${foot(2)}
  </div>`;

  const p34 = fichePages(3, 1, AT1_TITRE, AT1_COMPETENCES, "at1");
  const p5 = complPage(5, "at1c");
  // AT2 : le gabarit officiel comporte 4 rangées de cases supplémentaires sur le
  // bloc 3 (particularité du document ministère, reproduite à l'identique). Le
  // tableau retrouve des lignes normales : les zones à rédiger sont désormais en
  // page B, donc la page A n'est plus contrainte.
  const p67 = fichePages(6, 2, AT2_TITRE, AT2_COMPETENCES, "at2", { extraRows: 4 });
  const p8 = complPage(8, "at2c", { labels: ["1", "2", "4"] });

  const p9 = `<div class="lv-page">
    <p class="lv-center lv-b lv-s22" style="margin-top:4mm;line-height:1.3">SYNTHESE DES RESULTATS OBTENUS PAR LE CANDIDAT<br>A L’ISSUE DU PARCOURS DE FORMATION</p>
    <div class="lv-band" style="margin-top:4mm"><span class="lv-tri lv-tri-small"></span></div>
    <table style="width:180mm;margin-top:8mm">
      <colgroup><col style="width:52.5mm"><col style="width:15mm"><col style="width:112.5mm"></colgroup>
      <tr style="height:6mm"><td class="lv-b lv-s12" style="background:#F2F2F2">Intitulé de l’activité type</td>
          <td colspan="2" class="lv-b lv-s12" style="background:#F2F2F2">Compétences professionnelles</td></tr>
      ${synthActiviteRows(1, AT1_TITRE, AT1_COMPETENCES, "syn.at1")}
      <tr style="height:4mm"><td colspan="3"></td></tr>
      ${synthActiviteRows(2, AT2_TITRE, AT2_COMPETENCES, "syn.at2")}
    </table>
    ${foot(9)}
  </div>`;

  const p10 = `<div class="lv-page">
    <p class="lv-b lv-s11" style="margin-top:6mm">Observations</p>
    ${fblock("syn.obs", 50)}
    <table style="width:180mm;margin-top:10mm">
      <colgroup><col style="width:13mm"><col style="width:6mm"><col style="width:57mm"><col style="width:13mm"><col style="width:5mm"><col style="width:28mm"><col style="width:58mm"></colgroup>
      <tr><td colspan="6" class="lv-b lv-i lv-s12">Formateur(s) / Evaluateur(s)</td><td class="lv-center lv-b lv-i lv-s12">Visa</td></tr>
      ${formateurRow("syn.f1")}
      ${formateurRow("syn.f2")}
      <tr style="height:12mm"><td colspan="6" class="lv-b lv-i lv-s12" style="vertical-align:bottom">Représentant de l’organisme de formation</td><td></td></tr>
      ${formateurRow("syn.rep")}
    </table>
    <p class="lv-s11" style="margin-top:10mm">Un exemplaire du livret a été remis au candidat pour information par l’organisme de formation contre signature le ${f("syn.remise", PH_DATE)}</p>
    <p class="lv-b lv-s11" style="margin-top:6mm">Signature du candidat pour information :</p>
    ${foot(10)}
  </div>`;

  return p1 + p2 + p34 + p5 + p67 + p8 + p9 + p10;
}

// ---------------------------------------------------------------------------
// Sérialisation <-> DOM
// ---------------------------------------------------------------------------

export function collectData(doc) {
  const out = {};
  doc.querySelectorAll(".lv-f[data-k]").forEach((n) => {
    const v = n.innerText.replace(/ /g, " ").trim();
    if (v) out[n.dataset.k] = v;
  });
  doc.querySelectorAll(".lv-cb[data-k].on").forEach((n) => { out[n.dataset.k] = true; });
  return out;
}

export function fillData(doc, data) {
  doc.querySelectorAll(".lv-f[data-k]").forEach((n) => {
    const v = data[n.dataset.k];
    n.textContent = typeof v === "string" ? v : "";
  });
  doc.querySelectorAll(".lv-cb[data-k]").forEach((n) => {
    n.classList.toggle("on", data[n.dataset.k] === true);
  });
}

// Rend le document éditable : champs contenteditable en texte brut, cases à
// cocher cliquables (groupes exclusifs via data-x). onChange est appelé à
// chaque modification. Exporté pour le banc d'essai (_preview_livret.html).
export function wireDocEditing(doc, onChange, opts = {}) {
  const names = Array.isArray(opts.names) ? opts.names : [];
  doc.querySelectorAll(".lv-f[data-k]").forEach((n) => {
    n.contentEditable = "plaintext-only";
    if (n.contentEditable !== "plaintext-only") n.contentEditable = "true";
  });
  // Collage : toujours en texte brut (sinon du HTML copié casserait le gabarit).
  doc.addEventListener("paste", (e) => {
    const t = e.target.closest?.(".lv-f[data-k]");
    if (!t) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });
  const toggleCb = (n) => {
    const on = !n.classList.contains("on");
    if (on && n.dataset.x) {
      doc.querySelectorAll(`.lv-cb[data-x="${n.dataset.x}"]`).forEach((o) => o.classList.remove("on"));
    }
    n.classList.toggle("on", on);
    onChange();
  };
  doc.addEventListener("click", (e) => {
    const n = e.target.closest?.(".lv-cb[data-k]");
    if (n) toggleCb(n);
  });
  doc.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && e.target.classList?.contains("lv-cb")) {
      e.preventDefault();
      toggleCb(e.target);
    }
  });
  doc.addEventListener("input", () => onChange());

  // Mini-sélecteur sur les champs date : « Aujourd'hui » en un clic, ou une
  // date au choix (input natif). On peut toujours taper au clavier à la place.
  const closePicker = () => doc.querySelectorAll(".lv-datepick").forEach((n) => n.remove());
  // short : année sur 2 chiffres (colonne « Dates » étroite du tableau officiel).
  const frDate = (iso, short) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${short ? y.slice(2) : y}`;
  };
  doc.addEventListener("click", (e) => {
    const field = e.target.closest?.(".lv-f.lv-date[data-k]");
    if (!field) { if (!e.target.closest?.(".lv-datepick")) closePicker(); return; }
    if (field.parentElement.querySelector(".lv-datepick")) return;   // déjà ouvert
    closePicker();
    const today = new Date();
    const todayIso = [today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")].join("-");
    const short = field.classList.contains("lv-date-short");
    const apply = (iso) => {
      field.textContent = frDate(iso, short);
      closePicker();
      field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    };
    const inp = el("input", { type: "date", value: todayIso });
    inp.addEventListener("change", () => { if (inp.value) apply(inp.value); });
    const pick = el("div", { class: "lv-datepick" },
      el("button", { type: "button", class: "lv-dp-today", onClick: () => apply(todayIso) },
        "Aujourd'hui (" + frDate(todayIso, short) + ")"),
      inp,
      el("button", { type: "button", onClick: () => { field.textContent = ""; closePicker(); field.dispatchEvent(new InputEvent("input", { bubbles: true })); } }, "Effacer"),
    );
    const cell = field.parentElement;
    if (getComputedStyle(cell).position === "static") cell.style.position = "relative";
    cell.appendChild(pick);
  });

  // Auto-complétion des noms de formateurs / évaluateurs : au clic sur un champ
  // « Nom » de visa, liste des formateurs (filtrée par ce qui est déjà tapé) ;
  // clic = remplit. La saisie libre reste possible (évaluateur externe).
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const closeNamePick = () => doc.querySelectorAll(".lv-namepick").forEach((n) => n.remove());
  function openNamePick(field) {
    closeNamePick();
    if (!names.length) return;
    const q = norm(field.textContent);
    const matches = names.filter((n) => norm(n).includes(q));
    // Rien à proposer, ou le champ contient déjà exactement un nom de la liste.
    if (!matches.length || (matches.length === 1 && norm(matches[0]) === q)) return;
    const pick = el("div", { class: "lv-namepick" });
    matches.forEach((name) => {
      // mousedown (pas click) : sélectionne avant que le blur du champ ne ferme la liste.
      pick.appendChild(el("button", { type: "button", class: "lv-namepick-item",
        onMousedown: (e) => {
          e.preventDefault();
          field.textContent = name;
          closeNamePick();
          onChange();
        } }, name));
    });
    const cell = field.parentElement;
    if (getComputedStyle(cell).position === "static") cell.style.position = "relative";
    cell.appendChild(pick);
  }
  doc.addEventListener("click", (e) => {
    const field = e.target.closest?.(".lv-f.lv-name[data-k]");
    if (field) { closePicker(); openNamePick(field); }
    else if (!e.target.closest?.(".lv-namepick")) closeNamePick();
  });
  doc.addEventListener("input", (e) => {
    const field = e.target.closest?.(".lv-f.lv-name[data-k]");
    if (field) openNamePick(field);
  });
}

// ---------------------------------------------------------------------------
// Impression : clone du document dans #livret-print (enfant direct de <body>),
// même architecture éprouvée que l'impression du planning (pas de setTimeout,
// rafraîchi avant chaque impression). Le clone est en lecture pure.
// ---------------------------------------------------------------------------

let printListenersReady = false;

function refreshPrintClone(doc) {
  // Format de page du livret (A4 portrait, marges gérées par le document).
  // Injecté seulement tant qu'un livret est ouvert : une règle @page en dur
  // dans livret.css écraserait le « A4 landscape » de l'impression du planning.
  if (!document.getElementById("livret-page-style")) {
    const st = document.createElement("style");
    st.id = "livret-page-style";
    st.textContent = "@page { size: A4 portrait; margin: 0; }";
    document.head.appendChild(st);
  }
  let c = document.getElementById("livret-print");
  if (!c) {
    c = document.createElement("div");
    c.id = "livret-print";
    document.body.appendChild(c);
  }
  clear(c);
  const clone = doc.cloneNode(true);
  clone.classList.remove("lv-screen", "lv-edit");
  clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  clone.querySelectorAll("[tabindex]").forEach((n) => n.removeAttribute("tabindex"));
  clone.querySelectorAll(".lv-datepick, .lv-namepick").forEach((n) => n.remove());
  c.appendChild(clone);
  document.body.classList.add("livret-printable");
}

export function teardownLivretPrint() {
  document.getElementById("livret-print")?.remove();
  document.getElementById("livret-page-style")?.remove();
  document.body.classList.remove("livret-printable");
}

// Si le document n'est plus à l'écran (sous-onglet changé…), on ne doit surtout
// pas intercepter l'impression d'autre chose.
function ensurePrintListeners() {
  if (printListenersReady) return;
  printListenersReady = true;
  const beforePrint = () => {
    const doc = getLivretDocNode();
    if (doc && document.contains(doc)) refreshPrintClone(doc);
    else teardownLivretPrint();
  };
  window.addEventListener("beforeprint", beforePrint);
  // iOS Safari n'émet pas beforeprint : matchMedia est son seul signal.
  const mm = window.matchMedia("print");
  const onMm = (e) => { if (e.matches) beforePrint(); };
  if (mm.addEventListener) mm.addEventListener("change", onMm);
  else if (mm.addListener) mm.addListener(onMm);
}

let currentDocNode = null;
function getLivretDocNode() { return currentDocNode; }

// ---------------------------------------------------------------------------
// Vue
// ---------------------------------------------------------------------------

let stagiaires = [];
let livretsIndex = [];   // [{stagiaire_id, updated_at}] pour les statuts de liste
let profNames = [];      // noms des formateurs, pour l'auto-complétion des visas

export async function renderEpcfLivret(container, opts = {}) {
  clear(container);
  container.appendChild(el("div", { class: "loading" }, "Chargement"));
  const formateur = isAdmin() || isProf();

  if (!formateur) {
    // Stagiaire : la RLS ne renvoie que son livret. On l'affiche en lecture seule.
    let rows = [];
    try { rows = await listEpcfLivrets(); } catch (e) { console.error(e); }
    if (opts.isActive && !opts.isActive()) return;
    clear(container);
    // La RLS ne renvoie que le sien à un vrai stagiaire ; le filtre par
    // stagiaire_id du profil couvre le fondateur en « Voir en tant que »
    // (session réelle admin → la RLS renvoie tout).
    const myId = getProfile()?.stagiaire_id ?? null;
    const mine = (myId != null && rows.find((r) => r.stagiaire_id === myId)) || rows[0];
    if (!mine) {
      container.appendChild(el("p", { class: "muted" },
        "Ton livret officiel EPCF n'a pas encore été créé par les formateurs."));
      return;
    }
    showDoc(container, null, mine, { readOnly: true });
    return;
  }

  const [stagiairesData, livretsData, profsData] = await Promise.all([
    listStagiaires(), listEpcfLivrets(), listProfs(),
  ]);
  if (opts.isActive && !opts.isActive()) return;
  stagiaires = stagiairesData.slice().sort(compareByNom);
  livretsIndex = livretsData;
  profNames = (profsData || []).map((p) => p.nom).filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fr"));
  clear(container);
  showListe(container);
}

function showListe(container) {
  clear(container);
  teardownLivretPrint();
  container.appendChild(el("p", { class: "lv-hint" },
    "Livret officiel « Évaluations passées en cours de formation » (ministère du travail, TP-01303). ",
    "Un livret par stagiaire, imprimable à l'identique du document officiel."));
  const table = el("table", { class: "lv-liste-table" });
  table.appendChild(el("thead", {}, el("tr", {},
    el("th", {}, "Stagiaire"), el("th", {}, "Livret"))));
  const tbody = el("tbody");
  stagiaires.forEach((s) => {
    const row = livretsIndex.find((l) => l.stagiaire_id === s.id);
    const cell = el("td", {});
    if (row) {
      // updated_at est un timestamptz ISO complet : parseDate (formats jour) ne
      // sait pas le lire, on passe par Date directement.
      cell.appendChild(el("span", { class: "lv-statut ok" }, "rempli · màj " + formatDate(new Date(row.updated_at))));
    } else {
      cell.appendChild(el("span", { class: "lv-statut" }, "vierge"));
    }
    cell.appendChild(el("button", {
      class: "btn small " + (row ? "ghost" : "primary"),
      style: "margin-left:10px",
      onClick: async () => {
        let full = null;
        if (row) {
          try { full = await getEpcfLivret(s.id); } catch (e) { console.error(e); toast(e?.message || String(e), "error"); return; }
        }
        showDoc(container, s, full, { readOnly: false, back: () => renderReload(container) });
      },
    }, row ? "Ouvrir" : "Créer"));
    tbody.appendChild(el("tr", {},
      el("td", {}, el("div", { class: "lv-name-cell" }, el("span", {}, displayStagiaire(s)))),
      cell));
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function renderReload(container) {
  try { livretsIndex = await listEpcfLivrets(); } catch (e) { console.error(e); }
  showListe(container);
}

// Ouvre le document d'un stagiaire. stagiaire=null en mode stagiaire connecté
// (row déjà chargée). readOnly force la consultation pure.
function showDoc(container, stagiaire, row, { readOnly, back } = {}) {
  clear(container);
  const data = row?.data || {};
  const stagiaireId = stagiaire ? stagiaire.id : row.stagiaire_id;

  // --- Barre d'outils écran ---
  const status = el("span", { class: "lv-status" }, readOnly ? "Lecture seule" : "");
  const toolbar = el("div", { class: "lv-toolbar" });
  if (back) toolbar.appendChild(el("button", { class: "btn small ghost", onClick: () => { teardownLivretPrint(); back(); } }, "← Retour"));
  toolbar.appendChild(el("h3", {}, "Livret EPCF" + (stagiaire ? " — " + displayStagiaire(stagiaire) : "")));
  toolbar.appendChild(status);
  toolbar.appendChild(el("button", { class: "btn small primary", onClick: async () => {
    if (!readOnly) await saveNow();
    refreshPrintClone(doc);
    window.print();
  } }, "Imprimer / PDF"));
  container.appendChild(toolbar);
  if (!readOnly) {
    container.appendChild(el("p", { class: "lv-hint" },
      "Clique dans les zones en pointillés pour remplir, sur les cases pour cocher. Enregistrement automatique."));
  }

  // --- Document ---
  const doc = el("div", { class: "lv-doc lv-screen" + (readOnly ? "" : " lv-edit") });
  doc.innerHTML = buildDocHTML();
  // Valeurs par défaut du gabarit ECF (comme le Word transmis par Hocine),
  // pré-remplissage du candidat depuis la fiche stagiaire.
  const defaults = { organisme: "ECF BOUSCAREN" };
  if (stagiaire) {
    defaults.nom = (stagiaire.nom || "").toUpperCase();
    defaults.prenom = stagiaire.prenom || "";
    // Date de naissance du profil (Mon suivi / saisie stagiaire) : pré-remplit
    // le livret tant que le champ n'y a pas été saisi à la main.
    if (stagiaire.date_naissance) defaults.naissance = formatDate(new Date(stagiaire.date_naissance));
  }
  fillData(doc, { ...defaults, ...data });

  if (!readOnly) wireDocEditing(doc, () => scheduleSave(), { names: profNames });

  // Mise à l'échelle écran : le document (210mm ≈ 794px) est réduit pour tenir
  // dans la colonne, verrou de hauteur pour ne pas laisser de vide dessous.
  const scaleInner = el("div", { class: "lv-scale" }, doc);
  const scaleOuter = el("div", { class: "lv-scale-outer" }, scaleInner);
  container.appendChild(scaleOuter);
  const rescale = () => {
    if (!document.contains(scaleOuter)) return;
    const w = scaleOuter.clientWidth;
    if (!w) return;
    const docW = doc.offsetWidth || 794;
    const scale = Math.min(1, w / docW);
    scaleInner.style.transform = `scale(${scale})`;
    scaleOuter.style.height = doc.offsetHeight * scale + "px";
  };
  window.addEventListener("resize", rescale);
  requestAnimationFrame(rescale);

  currentDocNode = doc;
  ensurePrintListeners();
  refreshPrintClone(doc);

  // --- Autosave (débouncé) ---
  let saveTimer = null;
  let saving = false;
  let pendingAgain = false;
  async function saveNow() {
    if (readOnly) return;
    if (saving) { pendingAgain = true; return; }
    saving = true;
    clearTimeout(saveTimer);
    status.textContent = "Enregistrement…";
    status.className = "lv-status saving";
    try {
      await upsertEpcfLivret({
        stagiaire_id: stagiaireId,
        data: collectData(doc),
        updated_by_who: getCurrentWho(),
      });
      status.textContent = "Enregistré ✓";
      status.className = "lv-status";
    } catch (e) {
      console.error(e);
      status.textContent = "Non enregistré !";
      status.className = "lv-status error";
      toast("Enregistrement du livret impossible : " + (e?.message || e), "error");
    } finally {
      saving = false;
      if (pendingAgain) { pendingAgain = false; saveNow(); }
    }
  }
  function scheduleSave() {
    status.textContent = "Modifié…";
    status.className = "lv-status saving";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
    refreshPrintCloneSoon();
  }
  // Le clone d'impression suit les éditions sans re-cloner à chaque frappe.
  let cloneTimer = null;
  function refreshPrintCloneSoon() {
    clearTimeout(cloneTimer);
    cloneTimer = setTimeout(() => { if (document.contains(doc)) refreshPrintClone(doc); }, 1200);
  }
}
