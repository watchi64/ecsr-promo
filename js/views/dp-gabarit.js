// Gabarit du Dossier Professionnel : le HTML des blocs A4, reproduisant le
// modèle officiel du ministère chargé de l'emploi (version du 11/09/2017,
// docs/specs/2026-07-30-dp-modele-source.docx).
//
// Aucun comportement ici : la vue dp.js s'occupe des rôles, de l'édition et de
// l'enregistrement. Les champs portent les classes .lv-f / .lv-cb communes aux
// documents officiels (voir js/doc-officiel.js).
//
// Sécurité : ce module produit du HTML par concaténation. La SEULE donnée
// saisie par le candidat qui y est injectée est le titre d'un exemple, repris
// au sommaire, et il passe obligatoirement par escapeHtml. Toutes les autres
// valeurs entrent par fillData, qui écrit en textContent.

import { blocsImprimes, blocsEdition, sommaire, cleExemple } from "../dp-rules.js?v=20260811b";

export const AT1_TITRE = "Former des apprenants conducteurs par des actions individuelles et collectives, dans le respect des cadres réglementaires en vigueur";
export const AT2_TITRE = "Sensibiliser l’ensemble des usagers de la route à l’adoption de comportements sûrs et respectueux de l’environnement";

const PH_TEXTE = "Cliquez ici pour taper du texte.";
const PH_DATE = "Cliquez ici pour choisir une date.";

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Champ d'une ligne / zone de rédaction / case à cocher.
// data-k = clé de sérialisation, data-x = groupe exclusif.
function f(k, ph, extra = "") {
  const date = ph === PH_DATE ? " lv-date" : "";
  return `<span class="lv-f ${extra}${date}" data-k="${k}" data-ph="${ph || PH_TEXTE}"></span>`;
}
function zone(k, petite) {
  return `<div class="lv-f dp-zone${petite ? " dp-zone-petite" : ""}" data-k="${k}" data-ph="${PH_TEXTE}"></div>`
       + `<p class="dp-deborde-note">Ce texte dépasse la place prévue : il ne sera pas coupé, mais il décalera la mise en page.</p>`;
}
function cb(k, group) {
  return `<span class="lv-cb" data-k="${k}"${group ? ` data-x="${group}"` : ""} role="checkbox" tabindex="0"></span>`;
}

function head() {
  return `<div class="dp-head">Dossier Professionnel (DP)</div>`;
}
// n = null pour un bloc affiché mais non imprimé (exemple vide en édition).
function foot(n, total) {
  const droite = n === null
    ? `<span class="dp-foot-exclu">Exemple vide : cette page ne sera pas imprimée</span>`
    : `<span>Page ${n} / ${total}</span>`;
  return `<div class="dp-foot">
    <span>DOSSIER PROFESSIONNEL · Version du 11/09/2017</span>
    ${droite}
  </div>`;
}
function page(inner, n, total, cls = "") {
  const exclue = n === null ? " dp-page-exclue" : "";
  return `<section class="dp-page ${cls}${exclue}">${head()}${inner}${foot(n, total)}</section>`;
}

// ---------------------------------------------------------------------------
// Blocs
// ---------------------------------------------------------------------------

function blocCouverture(n, total) {
  return page(`
    <div class="dp-cover-logo"><img src="assets/dp/ministere-emploi.jpg" alt="Ministère chargé de l'emploi"></div>
    <p class="dp-h1">Dossier Professionnel</p>
    <table class="dp-cover-table">
      <tr><td class="dp-cover-label">Nom de naissance</td><td>${f("nom_naissance")}</td></tr>
      <tr><td class="dp-cover-label">Nom d’usage</td><td>${f("nom_usage")}</td></tr>
      <tr><td class="dp-cover-label">Prénom</td><td>${f("prenom")}</td></tr>
      <tr><td class="dp-cover-label">Adresse</td><td>${f("adresse")}</td></tr>
    </table>
    <p class="dp-h2" style="margin-top:10mm">Titre professionnel visé</p>
    <p class="lv-b">ENSEIGNANT DE LA CONDUITE ET DE LA SÉCURITÉ ROUTIÈRE</p>
    <p class="dp-h2" style="margin-top:10mm">Modalité d’accès</p>
    <p>${cb("modalite_formation", "modalite")} Parcours de formation</p>
    <p style="margin-top:2mm">${cb("modalite_vae", "modalite")} Validation des Acquis de l’Expérience (VAE)</p>
  `, n, total, "dp-p1");
}

function blocPresentation(n, total) {
  return page(`
    <p class="dp-h1">Présentation du dossier</p>
    <p class="lv-just">Le dossier professionnel (DP) constitue un élément du système de validation du titre professionnel. Ce titre est délivré par le Ministère chargé de l’emploi.</p>
    <p class="lv-just" style="margin-top:3mm">Le DP appartient au candidat. Il le conserve, l’actualise durant son parcours et le présente obligatoirement à chaque session d’examen.</p>
    <p class="lv-just" style="margin-top:3mm">Pour rédiger le DP, le candidat peut être aidé par un formateur ou par un accompagnateur VAE. Il est consulté par le jury au moment de la session d’examen.</p>
    <p style="margin-top:5mm">Pour prendre sa décision, le jury dispose :</p>
    <ul>
      <li>des résultats de la mise en situation professionnelle complétés, éventuellement, du questionnaire professionnel ou de l’entretien professionnel ou de l’entretien technique ou du questionnement à partir de productions ;</li>
      <li>du Dossier Professionnel (DP) dans lequel le candidat a consigné les preuves de sa pratique professionnelle ;</li>
      <li>des résultats des évaluations passées en cours de formation lorsque le candidat évalué est issu d’un parcours de formation ;</li>
      <li>de l’entretien final (dans le cadre de la session titre).</li>
    </ul>
    <p class="lv-i lv-s9" style="margin-top:3mm">[Arrêté du 22 décembre 2015, relatif aux conditions de délivrance des titres professionnels du ministère chargé de l’Emploi]</p>
    <p style="margin-top:5mm">Ce dossier comporte :</p>
    <ul>
      <li>pour chaque activité-type du titre visé, un à trois exemples de pratique professionnelle ;</li>
      <li>un tableau à renseigner si le candidat souhaite porter à la connaissance du jury la détention d’un titre, d’un diplôme, d’un certificat de qualification professionnelle (CQP) ou des attestations de formation ;</li>
      <li>une déclaration sur l’honneur à compléter et à signer ;</li>
      <li>des documents illustrant la pratique professionnelle du candidat (facultatif) ;</li>
      <li>des annexes, si nécessaire.</li>
    </ul>
  `, n, total);
}

function blocSommaire(data, n, total) {
  const lignes = (at) => sommaire(data).filter((e) => e.at === at).map((e) => `
    <div class="dp-somm-ligne">
      <span class="dp-somm-titre">Exemple n°${e.n} ${e.titre
        ? `: ${escapeHtml(e.titre)}`
        : `<span class="dp-somm-vide">titre à renseigner</span>`}</span>
      <span class="dp-somm-page">p. ${e.page}</span>
    </div>`).join("");
  const fixe = (label, type) => {
    const b = blocsImprimes(data).find((x) => x.type === type);
    return `<div class="dp-somm-ligne"><span class="dp-somm-titre">${label}</span><span class="dp-somm-page">p. ${b.page}</span></div>`;
  };
  return page(`
    <p class="dp-h1">Sommaire</p>
    <p class="dp-h2">Exemples de pratique professionnelle</p>
    <p class="lv-b lv-s10" style="margin-top:4mm">${AT1_TITRE}</p>
    ${lignes(1)}
    <p class="lv-b lv-s10" style="margin-top:6mm">${AT2_TITRE}</p>
    ${lignes(2)}
    <div style="margin-top:8mm">
      ${fixe("Titres, diplômes, CQP, attestations de formation (facultatif)", "titres")}
      ${fixe("Déclaration sur l’honneur", "declaration")}
      ${fixe("Documents illustrant la pratique professionnelle (facultatif)", "documents")}
      ${fixe("Annexes", "annexes")}
    </div>
  `, n, total);
}

function blocSeparateur(titre, n, total) {
  return page(`<div class="dp-separateur">${titre}</div>`, n, total);
}

function blocExemple(at, num, n, total) {
  const k = (champ) => cleExemple(at, num, champ);
  return page(`
    <div class="dp-at">
      <div class="dp-at-num">Activité-type ${at}</div>
      <div class="dp-at-titre">${at === 1 ? AT1_TITRE : AT2_TITRE}</div>
    </div>
    <p class="dp-ex-num">Exemple n°${num}</p>
    <p>Intitulé : ${f(k("titre"))}</p>

    <p class="dp-question">1. Décrivez les tâches ou opérations que vous avez effectuées, et dans quelles conditions :</p>
    ${zone(k("taches"))}

    <p class="dp-question">2. Précisez les moyens utilisés :</p>
    ${zone(k("moyens"))}

    <p class="dp-question">3. Avec qui avez-vous travaillé ?</p>
    ${zone(k("avec_qui"), true)}

    <p class="dp-question">4. Contexte</p>
    <table class="dp-tbl-borde">
      <tr><td class="dp-cover-label">Nom de l’entreprise, organisme ou association</td><td>${f(k("entreprise"))}</td></tr>
      <tr><td class="dp-cover-label">Chantier, atelier, service</td><td>${f(k("service"))}</td></tr>
      <tr><td class="dp-cover-label">Période d’exercice</td><td>Du : ${f(k("du"), PH_DATE)} au : ${f(k("au"), PH_DATE)}</td></tr>
    </table>

    <p class="dp-question">5. Informations complémentaires (facultatif)</p>
    ${zone(k("complement"), true)}
  `, n, total);
}

function blocTitres(n, total) {
  const lignes = Array.from({ length: 10 }, (_, i) => `
    <tr>
      <td>${f(`titre${i + 1}_intitule`)}</td>
      <td>${f(`titre${i + 1}_organisme`)}</td>
      <td>${f(`titre${i + 1}_date`, PH_DATE)}</td>
    </tr>`).join("");
  return page(`
    <p class="dp-h1">Titres, diplômes, CQP, attestations de formation</p>
    <p class="lv-center lv-i" style="margin-bottom:6mm">(facultatif)</p>
    <table class="dp-tbl-borde">
      <tr><th>Intitulé</th><th>Autorité ou organisme</th><th class="dp-col-date">Date</th></tr>
      ${lignes}
    </table>
  `, n, total);
}

function blocDeclaration(n, total) {
  return page(`
    <p class="dp-h1">Déclaration sur l’honneur</p>
    <p style="margin-top:10mm">Je soussigné(e) ${f("dh_nom")},</p>
    <p class="lv-just" style="margin-top:4mm">déclare sur l’honneur que les renseignements fournis dans ce dossier sont exacts et que je suis l’auteur(e) des réalisations jointes.</p>
    <p style="margin-top:10mm">Fait à ${f("dh_fait_a")} le ${f("dh_le", PH_DATE)}</p>
    <p style="margin-top:2mm">pour faire valoir ce que de droit.</p>
    <p style="margin-top:14mm">Signature :</p>
  `, n, total);
}

// Document complet.
//
// En consultation (edition: false), seuls les blocs imprimés sont rendus : les
// exemples vides hors n°1 sont absents du document ET du sommaire.
//
// En édition (edition: true), les 6 exemples sont rendus, sinon le candidat
// n'aurait aucun champ où saisir son 2e ou 3e exemple. Ceux qui resteront hors
// du document imprimé portent la classe .dp-page-exclue, masquée à l'impression
// par css/dp.css, et leur pied de page l'annonce au lieu d'un numéro.
export function buildDpHTML(data, { edition = false } = {}) {
  const blocs = edition ? blocsEdition(data) : blocsImprimes(data);
  const total = blocsImprimes(data).length;
  return blocs.map((b) => {
    switch (b.type) {
      case "couverture":   return blocCouverture(b.page, total);
      case "presentation": return blocPresentation(b.page, total);
      case "sommaire":     return blocSommaire(data, b.page, total);
      case "intercalaire": return blocSeparateur("Exemples de pratique professionnelle", b.page, total);
      case "exemple":      return blocExemple(b.at, b.n, b.page, total);
      case "titres":       return blocTitres(b.page, total);
      case "declaration":  return blocDeclaration(b.page, total);
      case "documents":    return blocSeparateur("Documents illustrant la pratique professionnelle", b.page, total);
      case "annexes":      return blocSeparateur("Annexes", b.page, total);
      default:             return "";
    }
  }).join("");
}
