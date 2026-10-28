// Accueil (refonte, lot 2A) : les règles seulement. Où en est un événement par rapport à aujourd'hui
// (à venir, en cours, passé), le texte qui le dit, et la ligne « Promo <nom> · semaine <n> » sous la
// salutation. Module pur, sans DOM ni stockage : testé en node. La carte « Prochain événement majeur »
// de l'accueil les lit ; le prochain rendez-vous de l'accueil du lot 2B les lira de même.

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

// Numéro d'un jour de calendrier (jours écoulés depuis le 01/01/1970) : « AAAA-MM-JJ », ou une date dont on
// lit le jour LOCAL. Les jours se comptent entre numéros entiers : ni l'heure ni un changement d'heure (jour
// de 23 h ou de 25 h) ne décalent un résultat. NaN quand la valeur n'est pas un jour qui existe.
function numeroDeJour(valeur) {
  if (valeur instanceof Date) {
    return Date.UTC(valeur.getFullYear(), valeur.getMonth(), valeur.getDate()) / MS_PAR_JOUR;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof valeur === "string" ? valeur : "");
  if (!m) return NaN;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(annee, mois - 1, jour);
  const relu = new Date(ms);   // 2026-02-30 ou 2026-13-01 ne sont pas des jours : Date.UTC les reporterait
  return relu.getUTCFullYear() === annee && relu.getUTCMonth() === mois - 1 && relu.getUTCDate() === jour ? ms / MS_PAR_JOUR : NaN;
}

// Où en est un événement un jour donné. `debut` et `fin` : « AAAA-MM-JJ » ; `fin` absente (ou nulle, ou vide)
// vaut `debut`, un événement d'un seul jour. `aujourdhui` : « AAAA-MM-JJ », ou une date (son jour local).
//   « a-venir » : il n'a pas commencé, ou commence aujourd'hui ; `jours` : les jours jusqu'à son début (0 : aujourd'hui) ;
//   « en-cours » : commencé avant aujourd'hui et pas fini ; `jours` : les jours jusqu'à sa fin (0 : il finit aujourd'hui) ;
//   « passe » : fini avant aujourd'hui ; `jours` : négatif (les jours jusqu'à sa fin), jamais montré.
// Le premier jour d'un événement de plusieurs jours se dit donc « Aujourd'hui », le lendemain « En cours ».
// Une date illisible lève une TypeError : mieux vaut un échec visible qu'un décompte inventé.
export function etatEvenement({ debut, fin }, aujourdhui) {
  const premier = numeroDeJour(debut);
  const dernier = fin ? numeroDeJour(fin) : premier;
  const ce = numeroDeJour(aujourdhui);
  if ([premier, dernier, ce].some(Number.isNaN)) {
    throw new TypeError(`etatEvenement : date illisible (début ${debut}, fin ${fin}, jour ${aujourdhui})`);
  }
  if (ce > dernier) return { etat: "passe", jours: dernier - ce };
  if (ce > premier) return { etat: "en-cours", jours: dernier - ce };
  return { etat: "a-venir", jours: premier - ce };
}

// Le texte d'un état d'événement (le résultat d'etatEvenement). Un événement passé n'a pas de texte : l'accueil
// montre le premier événement qui n'est pas passé. Jamais un nombre négatif : `jours` doit être un entier positif
// ou nul, sinon rien n'est dit.
export function libelleDecompte(decompte) {
  const { etat, jours } = decompte || {};
  if (!Number.isInteger(jours) || jours < 0) return "";
  if (etat === "a-venir") {
    if (jours === 0) return "Aujourd'hui";
    if (jours === 1) return "Demain";
    return `Dans ${jours} jours`;
  }
  if (etat === "en-cours") {
    if (jours === 0) return "En cours, fin aujourd'hui";
    if (jours === 1) return "En cours, fin demain";
    return `En cours, fin dans ${jours} jours`;
  }
  return "";
}

// Lundi de la semaine d'un jour (son numéro, voir numeroDeJour) : le 01/01/1970, jour 0, était un jeudi.
const lundiDe = (numero) => numero - (((numero + 3) % 7) + 7) % 7;

// « Promo Nîmes, mars 2026 · semaine 31 » : la semaine 1 est celle du premier jour de la promo (du lundi au
// dimanche), la suivante commence le lundi. Pas de numéro quand il ne dirait rien de vrai : promo pas encore
// commencée, promo finie (après sa date de fin), dates absentes ou illisibles ; le nom seul alors, et rien sans
// nom (promo pas encore chargée). `promo` : la ligne de la promo (nom, date_debut, date_fin). `aujourdhui` :
// « AAAA-MM-JJ » ou une date.
export function lignePromo(promo, aujourdhui) {
  const nom = typeof promo?.nom === "string" ? promo.nom.trim() : "";
  if (!nom) return "";
  const debut = numeroDeJour(promo.date_debut);
  const fin = promo.date_fin ? numeroDeJour(promo.date_fin) : Infinity;
  const ce = numeroDeJour(aujourdhui);
  if (!(ce >= debut && ce <= fin)) return `Promo ${nom}`;
  return `Promo ${nom} · semaine ${1 + (lundiDe(ce) - lundiDe(debut)) / 7}`;
}
