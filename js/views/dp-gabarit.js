// Gabarit du Dossier Professionnel : le HTML du document, reproduisant le modèle
// officiel du ministère chargé de l'emploi, version du 11/09/2017.
//
// Le gabarit ne décide pas des pages : il produit un FLUX de blocs, que
// js/dp-pagination.js répartit sur des feuilles A4. Aucun comportement ici.
//
// Sécurité : ce module produit du HTML par concaténation. La SEULE donnée saisie
// par le candidat qui y est injectée est l'intitulé d'une fiche d'exemple, repris
// au sommaire, et il passe obligatoirement par escapeHtml. Toutes les autres
// valeurs entrent par fillData, qui écrit en textContent.

import { rubriquesImprimees, rubriquesEdition, sommaire, cleExemple } from "../dp-rules.js?v=20260915b";

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const MENTION_VERSION_IMPAIRE = "DOSSIER PROFESSIONNEL - Version Traitement de texte - Version du 11/09/2017";
const MENTION_VERSION_PAIRE = "DOSSIER PROFESSIONNEL - Version du 11/09/2017";

// En-tête officiel. La couverture porte le logo du ministère et un titre plus
// grand ; les autres feuilles n'ont que le titre. C'est le partage du modèle,
// qui réserve son en-tête illustré à la première page.
export function entete(estCouverture) {
  const titre = `<div class="dp-entete-titre"><b>Dossier Professionnel</b> <span>(DP)</span></div>`;
  const bande = `<div class="dp-entete-bande"></div>`;
  if (!estCouverture) return `<div class="dp-entete">${bande}${titre}</div>`;
  return `<div class="dp-entete">
    <div class="dp-entete-logo">
      <img src="assets/dp/ministere-emploi.jpg" alt="Ministère chargé de l'emploi">
    </div>
    <div class="dp-entete-bloc">${bande}${titre}</div>
  </div>`;
}

// Pied officiel. Le modèle alterne la mention et le numéro selon la parité de la
// feuille, et ne donne jamais de nombre total de pages.
export function pied(numero) {
  const paire = numero % 2 === 0;
  const page = `<span>Page ${numero}</span>`;
  const mention = `<span>${paire ? MENTION_VERSION_PAIRE : MENTION_VERSION_IMPAIRE}</span>`;
  return `<div class="dp-pied">${paire ? page + mention : mention + page}</div>`;
}

// Une feuille A4 complète.
export function feuille(interieur, numero, estCouverture) {
  return `<section class="dp-feuille${estCouverture ? " dp-couverture" : ""}">`
       + entete(estCouverture)
       + `<div class="dp-corps">${interieur}</div>`
       + pied(numero)
       + `</section>`;
}

export const AT1_TITRE = "Former des apprenants conducteurs par des actions individuelles et collectives, dans le respect des cadres réglementaires en vigueur";
export const AT2_TITRE = "Sensibiliser l’ensemble des usagers de la route à l’adoption de comportements sûrs et respectueux de l’environnement";

const PH_TEXTE = "Cliquez ici pour taper du texte.";
const PH_DATE = "Cliquez ici pour choisir une date.";

// Champ d'une ligne. data-k = clé de sérialisation, inchangée depuis 2026-07-30.
function f(k, ph, extra = "") {
  const date = ph === PH_DATE ? " lv-date" : "";
  return `<span class="lv-f ${extra}${date}" data-k="${k}" data-ph="${ph || PH_TEXTE}"></span>`;
}
function cb(k, group) {
  return `<span class="lv-cb" data-k="${k}"${group ? ` data-x="${group}"` : ""} role="checkbox" tabindex="0"></span>`;
}

// Un bloc du flux. `cle` identifie la rubrique pour le sommaire, `ouvrant` force
// une feuille neuve, `nature` dit si le moteur a le droit de le couper.
function bloc(interieur, { cle, ouvrant = false, nature = "atomique", avecSuivant = false, classe = "" }) {
  return `<div class="dp-bloc ${classe}" data-cle="${cle}"`
       + (ouvrant ? ` data-ouvrant="1"` : "")
       + ` data-nature="${nature}"`
       + (avecSuivant ? ` data-avec-suivant="1"` : "")
       + `>${interieur}</div>`;
}

function rubriqueCouverture() {
  const ligne = (label, k, haute) =>
    `<div class="dp-identite-ligne${haute ? " dp-identite-haute" : ""}">
       <span class="dp-identite-label">${label}</span><span class="dp-repere"></span>
       <span class="lv-f dp-identite-champ" data-k="${k}" data-ph="${PH_TEXTE}"></span>
     </div>`;
  return bloc(`
    <div class="dp-identite">
      ${ligne("Nom de naissance", "nom_naissance", false)}
      ${ligne("Nom d’usage", "nom_usage", false)}
      ${ligne("Prénom", "prenom", false)}
      ${ligne("Adresse", "adresse", true)}
    </div>
    <div class="dp-titre-vise-bloc">
      <div class="dp-bandeau">Titre professionnel visé</div>
      <div class="dp-filet-magenta"></div>
      <div class="dp-titre-vise">ENSEIGNANT DE LA CONDUITE ET DE LA SÉCURITÉ ROUTIÈRE</div>
      <div class="dp-cadre">
        <p class="dp-modalite-titre">Modalité d’accès :</p>
        <p class="dp-modalite-ligne">${cb("modalite_formation", "modalite")}Parcours de formation</p>
        <p class="dp-modalite-ligne">${cb("modalite_vae", "modalite")}Validation des Acquis de l’Expérience (VAE)</p>
      </div>
    </div>`, { cle: "couverture", ouvrant: true });
}

function rubriquePresentation() {
  return bloc(`
    <div class="dp-presentation-bloc">
      <div class="dp-bandeau">Présentation du dossier</div>
      <div class="dp-filet-magenta"></div>
      <div class="dp-cadre">
        <p>Le dossier professionnel (DP) constitue un élément du système de validation du titre professionnel.<br><b>Ce titre est délivré par le Ministère chargé de l’emploi.</b></p>
        <p>Le DP appartient au candidat. Il le conserve, l’actualise durant son parcours et le présente <b>obligatoirement à chaque session d’examen</b>.</p>
        <p>Pour rédiger le DP, le candidat peut être aidé par un formateur ou par un accompagnateur VAE.</p>
        <p>Il est consulté par le jury au moment de la session d’examen.</p>
        <p class="dp-intertitre">Pour prendre sa décision, le jury dispose :</p>
        <ul class="dp-liste">
          <li>des résultats de la mise en situation professionnelle complétés, éventuellement, du questionnaire professionnel ou de l’entretien professionnel ou de l’entretien technique ou du questionnement à partir de productions.</li>
          <li>du <b>Dossier Professionnel</b> (DP) dans lequel le candidat a consigné les preuves de sa pratique professionnelle.</li>
          <li>des résultats des évaluations passées en cours de formation lorsque le candidat évalué est issu d’un parcours de formation</li>
          <li>de l’entretien final (dans le cadre de la session titre).</li>
        </ul>
        <p class="dp-source">[Arrêté du 22 décembre 2015, relatif aux conditions de délivrance des titres professionnels du ministère chargé de l’Emploi]</p>
        <p class="dp-intertitre">Ce dossier comporte :</p>
        <ul class="dp-liste">
          <li>pour chaque activité-type du titre visé, un à trois exemples de pratique professionnelle ;</li>
          <li>un tableau à renseigner si le candidat souhaite porter à la connaissance du jury la détention d’un titre, d’un diplôme, d’un certificat de qualification professionnelle (CQP) ou des attestations de formation ;</li>
          <li>une déclaration sur l’honneur à compléter et à signer ;</li>
          <li>des documents illustrant la pratique professionnelle du candidat (facultatif)</li>
          <li>des annexes, si nécessaire.</li>
        </ul>
        <p class="dp-source">Pour compléter ce dossier, le candidat dispose d’un site web en accès libre sur le site.</p>
        <p class="dp-lien-officiel"><span class="dp-repere"></span><b>http://travail-emploi.gouv.fr/titres-professionnels</b></p>
      </div>
    </div>`, { cle: "presentation", ouvrant: true });
}

// pages : Map de clé de rubrique vers numéro de feuille, issue de la première
// passe de pagination. Absente à la première passe, les numéros restent vides.
// Exporte : la vue remplace ce seul bloc quand la pagination change, plutot que
// de reconstruire tout le flux, ce qui ferait sauter le curseur du candidat.
export function blocSommaire(data, pages) {
  const num = (cle) => (pages && pages.get(cle) !== undefined ? `p. ${pages.get(cle)}` : "p.");
  const lignesAt = (at) => sommaire(data).filter((e) => e.at === at).map((e) => `
    <div class="dp-sommaire-ligne">
      <span class="dp-repere"></span>
      <span class="dp-sommaire-intitule"><i>Exemple n°${e.n}</i> ${e.titre
        ? escapeHtml(e.titre)
        : `<span class="dp-sommaire-vide">intitulé à renseigner</span>`}</span>
      <span class="dp-sommaire-page">${num(`exemple:${at}:${e.n}`)}</span>
      <span class="dp-sommaire-case"></span>
    </div>`).join("");
  const ligneFixe = (label, cle) => `
    <div class="dp-sommaire-ligne">
      <span class="dp-sommaire-intitule">${label}</span>
      <span class="dp-sommaire-page">${cle ? num(cle) : "p."}</span>
      <span class="dp-sommaire-case"></span>
    </div>`;
  return bloc(`
    <div class="dp-sommaire-titre">Sommaire</div>
    <div class="dp-sommaire-section">Exemples de pratique professionnelle</div>
    <div class="dp-sommaire-at">${AT1_TITRE}</div>
    ${lignesAt(1)}
    <div class="dp-sommaire-at">${AT2_TITRE}</div>
    ${lignesAt(2)}
    <div class="dp-sommaire-fixe">
      ${ligneFixe("Titres, diplômes, CQP, attestations de formation <i>(facultatif)</i>", "titres")}
      ${ligneFixe("Déclaration sur l’honneur", "declaration")}
      ${ligneFixe("Documents illustrant la pratique professionnelle <i>(facultatif)</i>", null)}
      ${ligneFixe("Annexes <i>(si le RC le prévoit)</i>", null)}
    </div>`, { cle: "sommaire", ouvrant: true });
}

function rubriqueIntercalaire() {
  return bloc(`<div class="dp-intercalaire">Exemples de pratique<br>professionnelle</div>`,
    { cle: "intercalaire", ouvrant: true });
}

// Une fiche d'exemple. Ses zones de rédaction sont les seuls blocs sécables du
// document : ce sont elles que le candidat remplit, et elles seules peuvent
// dépasser la feuille.
//
// imprime : faux pour une fiche encore vide affichée en édition. Elle reste
// saisissable, mais porte sa mention et son fond, et n'existe pas dans le flux
// d'impression, construit sans elle.
function rubriqueExemple(at, n, imprime) {
  const k = (champ) => cleExemple(at, n, champ);
  // La mention est TOUJOURS dans le DOM, simplement masquée quand la fiche
  // compte : la vue bascule l'exclusion sans reconstruire le flux, ce qui est ce
  // qui garantit que le curseur du candidat ne saute pas pendant la frappe.
  const classe = imprime ? "" : "dp-bloc-exclu";
  const mention = `<p class="dp-mention-exclu"${imprime ? " hidden" : ""}>Fiche encore vide : elle ne sera pas imprimée.</p>`;

  const tete = bloc(`${mention}
    <div class="dp-fiche">
      <div class="dp-at">
        <div class="dp-at-num">Activité-type ${at}</div>
        <div class="dp-at-titre">${at === 1 ? AT1_TITRE : AT2_TITRE}</div>
      </div>
      <div class="dp-ex-ligne">
        <span class="dp-ex-num">Exemple n°${n}</span><span class="dp-repere"></span>
        <span class="lv-f dp-ex-titre" data-k="${k("titre")}" data-ph="${PH_TEXTE}"></span>
      </div>
    </div>`, { cle: `exemple:${at}:${n}`, ouvrant: true, classe });

  const question = (texte, champ, petite) =>
    bloc(`<div class="dp-fiche"><p class="dp-question">${texte}</p></div>`,
      { cle: `exemple:${at}:${n}`, avecSuivant: true, classe })
    // La zone est à la fois un bloc du flux et un champ : la classe lv-f est
    // indispensable, collectData et fillData ne regardant que .lv-f[data-k].
    + `<div class="dp-bloc dp-fiche lv-f dp-zone${petite ? " dp-zone-petite" : ""} ${classe}"`
    + ` data-cle="exemple:${at}:${n}" data-nature="secable"`
    + ` data-k="${k(champ)}" data-ph="${PH_TEXTE}"></div>`;

  const contexte = bloc(`
    <div class="dp-fiche">
      <p class="dp-question">4. Contexte</p>
      <div class="dp-contexte">
        <div class="dp-contexte-ligne">
          <span class="dp-contexte-label">Nom de l’entreprise, organisme ou association<span class="dp-repere"></span></span>
          <span class="lv-f dp-contexte-champ" data-k="${k("entreprise")}" data-ph="${PH_TEXTE}"></span>
        </div>
        <div class="dp-contexte-ligne">
          <span class="dp-contexte-label">Chantier, atelier, service<span class="dp-repere"></span></span>
          <span class="lv-f dp-contexte-champ" data-k="${k("service")}" data-ph="${PH_TEXTE}"></span>
        </div>
        <div class="dp-contexte-ligne">
          <span class="dp-contexte-label">Période d’exercice<span class="dp-repere"></span></span>
          <span class="dp-periode">Du : ${f(k("du"), PH_DATE)} au : ${f(k("au"), PH_DATE)}</span>
        </div>
      </div>
    </div>`, { cle: `exemple:${at}:${n}`, classe });

  return tete
    + question("1. Décrivez les tâches ou opérations que vous avez effectuées, et dans quelles conditions :", "taches", false)
    + question("2. Précisez les moyens utilisés :", "moyens", false)
    + question("3. Avec qui avez-vous travaillé ?", "avec_qui", true)
    + contexte
    + question("5. Informations complémentaires (facultatif)", "complement", true);
}

function rubriqueTitres() {
  const lignes = Array.from({ length: 10 }, (_, i) => `
    <tr>
      <td>${f(`titre${i + 1}_intitule`)}</td>
      <td>${f(`titre${i + 1}_organisme`)}</td>
      <td>${f(`titre${i + 1}_date`, PH_DATE)}</td>
    </tr>`).join("");
  return bloc(`
    <div class="dp-titres-bloc">
      <div class="dp-bandeau">Titres, diplômes, CQP, attestations de formation</div>
      <div class="dp-filet-magenta"></div>
      <div class="dp-titres-sous">(facultatif)</div>
      <table class="dp-tbl-titres">
        <tr>
          <th class="dp-col-intitule">Intitulé</th>
          <th class="dp-col-organisme">Autorité ou organisme</th>
          <th class="dp-col-date">Date</th>
        </tr>
        ${lignes}
      </table>
    </div>`, { cle: "titres", ouvrant: true });
}

function rubriqueDeclaration() {
  return bloc(`
    <div class="dp-declaration-bloc">
      <div class="dp-bandeau">Déclaration sur l’honneur</div>
      <div class="dp-filet-magenta"></div>
      <div class="dp-declaration-corps">
        <p>Je soussigné(e) ${f("dh_nom")},</p>
        <p>déclare sur l’honneur que les renseignements fournis dans ce dossier sont exacts et que je suis l’auteur(e) des réalisations jointes.</p>
        <p>Fait à ${f("dh_fait_a")} le ${f("dh_le", PH_DATE)}</p>
        <p>pour faire valoir ce que de droit.</p>
        <p class="dp-signature">Signature :</p>
      </div>
    </div>`, { cle: "declaration", ouvrant: true });
}

// Document complet, sous forme de FLUX de blocs. Le découpage en feuilles est le
// travail de js/dp-pagination.js, pas celui du gabarit.
//
// edition : rend les 6 fiches d'exemple, même vides, sinon le candidat n'aurait
// aucun champ où saisir sa 2e ou sa 3e fiche. Celles qui resteront hors du
// document imprimé sont signalées.
// pages : Map de clé de rubrique vers numéro de feuille, pour le sommaire.
export function buildDpFlux(data, { edition = false, pages = null } = {}) {
  const rubriques = edition ? rubriquesEdition(data) : rubriquesImprimees(data);
  return rubriques.map((r) => {
    switch (r.type) {
      case "couverture":   return rubriqueCouverture();
      case "presentation": return rubriquePresentation();
      case "sommaire":     return blocSommaire(data, pages);
      case "intercalaire": return rubriqueIntercalaire();
      case "exemple":      return rubriqueExemple(r.at, r.n, r.imprime !== false);
      case "titres":       return rubriqueTitres();
      case "declaration":  return rubriqueDeclaration();
      default:             return "";
    }
  }).join("");
}
