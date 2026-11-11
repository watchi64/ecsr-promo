// Règles pures de la page Qualiopi (js/views/qualiopi.js, spec docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md,
// § 6.3 et 6.5) : les dates et les choix que la vue n'a pas à calculer elle-même. PUR : ni DOM ni réseau, testé en node
// (tests/qualiopi-page-rules.test.mjs).
//
// Le dossier du centre ne filtre pas lui-même les promos par période : la vue ne lui passe que celles que
// `promosDuCentre` retient (même lieu, dates qui chevauchent les 12 derniers mois).

import { SOURCE, CRITERES } from "./qualiopi-referentiel.js?v=20261111f";
import { jourDe, rempli } from "./qualiopi-preuves.js?v=20261111f";
import { LIBELLES_NIVEAU, nomFichierQualiopi } from "./qualiopi-documents.js?v=20261111f";
import { dateLongue } from "./dates.js?v=20261111f";
import { pluriel } from "./nombres.js?v=20261111f";

// Le référentiel appliqué, tel que la page l'écrit : « Décret n° 2026-728 du 1er août 2026, en vigueur le 1er novembre 2026 »
// (la source du référentiel, sans l'objet du décret).
export const REFERENTIEL_APPLIQUE = `${SOURCE.decret.replace(/ relatif .*$/, "")}, en vigueur le ${dateLongue(SOURCE.enVigueur)}`;
// La date d'entrée en vigueur seule, pour l'en-tête : « référentiel du 1er novembre 2026 ».
export const REFERENTIEL_DU = `référentiel du ${dateLongue(SOURCE.enVigueur)}`;

// Les 12 derniers mois jusqu'à aujourd'hui (« AAAA-MM-JJ »), bornes comprises : du lendemain du même jour de l'année
// précédente (le 28 février quand le jour est un 29 février) à aujourd'hui, soit 12 mois exactement : le 28/10/2026 donne
// du 29/10/2025 au 28/10/2026. Une date du jour illisible laisse la période ouverte.
export function periodeDouzeMois(aujourdhui) {
  const jour = jourDe(aujourdhui);
  if (jour === null) return { du: null, au: null };
  const [annee, mois, numero] = [Number(jour.slice(0, 4)), Number(jour.slice(5, 7)), Number(jour.slice(8, 10))];
  const lendemain = new Date(0);   // le jour dépasse parfois la fin du mois (31 + 1) : la date le reporte au mois suivant
  lendemain.setUTCFullYear(annee - 1, mois - 1, (mois === 2 && numero === 29 ? 28 : numero) + 1);
  return { du: lendemain.toISOString().slice(0, 10), au: jour };
}

// Les promos du dossier du centre : celles de `promos` (lignes de la RPC mes_promos, dans leur ordre) qui sont du lieu
// `lieuId` et dont les dates chevauchent la période [du, au], bornes comprises. Une promo sans date de fin court jusqu'à
// aujourd'hui (ou ne dure qu'un jour si elle ne commence qu'après) ; une date inconnue ou illisible laisse la borne
// ouverte (comme l'inventaire, js/qualiopi-preuves.js). Un lieu inconnu ne retient aucune promo : « le même centre » ne se
// détermine pas.
export function promosDuCentre(promos, { lieuId, du, au, aujourdhui }) {
  if (lieuId == null) return [];
  const [debutPeriode, finPeriode, jour] = [jourDe(du), jourDe(au), jourDe(aujourdhui)];
  return (Array.isArray(promos) ? promos : []).filter((promo) => {
    if (promo?.lieu_id == null || Number(promo.lieu_id) !== Number(lieuId)) return false;
    const debut = jourDe(promo.date_debut);
    // Sans date de fin : aujourd'hui, ou le jour du début si la promo ne commence qu'après (jamais un intervalle à l'envers).
    const fin = jourDe(promo.date_fin) ?? (jour !== null && debut !== null && debut > jour ? debut : jour);
    return (fin === null || debutPeriode === null || fin >= debutPeriode)
      && (debut === null || finPeriode === null || debut <= finPeriode);
  });
}

// Le nom d'une promo dans la page ; un mot s'il manque.
export const nomPromo = (promo) => (rempli(promo?.nom) ? promo.nom.trim() : "Promo sans nom");

// Libellé d'une promo dans le sélecteur : son nom, suivi du lieu dès que les promos accessibles en couvrent plusieurs
// (sinon deux promos de même nom dans deux centres se confondraient), sauf quand le nom le dit déjà (« Nîmes, mars 2026 »).
export function libelleOptionPromo(promo, promos = []) {
  const nom = nomPromo(promo);
  const lieu = rempli(promo?.lieu_nom) ? promo.lieu_nom.trim() : null;
  const lieux = new Set((Array.isArray(promos) ? promos : []).map((p) => p?.lieu_id));
  if (lieux.size <= 1 || lieu === null || nom.toLowerCase().includes(lieu.toLowerCase())) return nom;
  return `${nom} · ${lieu}`;
}

// Le résumé d'un critère, en nombres de niveaux : « 3 indicateurs : 1 prouvé, 2 en partie » (les niveaux à zéro ne sont pas
// écrits).
export function resumeNiveaux(indicateurs) {
  const liste = Array.isArray(indicateurs) ? indicateurs : [];
  if (!liste.length) return "aucun indicateur applicable";
  const nombre = (niveau) => liste.filter((i) => i.niveau === niveau).length;
  const parties = [
    [nombre("prouve"), (k) => `${LIBELLES_NIVEAU.prouve.toLowerCase()}${k > 1 ? "s" : ""}`],
    [nombre("partiel"), () => LIBELLES_NIVEAU.partiel.toLowerCase()],
    [nombre("hors"), () => LIBELLES_NIVEAU.hors.toLowerCase()],
  ].filter(([k]) => k > 0).map(([k, mot]) => `${k} ${mot(k)}`);
  return `${pluriel(liste.length, "indicateur")} : ${parties.join(", ")}`;
}

// Les 7 critères dans l'ordre du décret, chacun avec ses indicateurs applicables (ceux de l'inventaire, dans l'ordre des
// numéros) et son résumé. Un critère sans indicateur applicable reste dans la liste, avec une liste vide.
export function groupesParCritere(inv) {
  const indicateurs = Array.isArray(inv?.indicateurs) ? inv.indicateurs : [];
  return CRITERES.map(({ numero, titre }) => {
    const liste = indicateurs.filter((i) => i.critere === numero);
    return { numero, titre, indicateurs: liste, resume: resumeNiveaux(liste) };
  });
}

// Titre du document pendant l'impression, qui nomme le PDF enregistré : le nom de fichier de l'export, sans l'extension
// « .csv » que `nomFichierQualiopi` donne à tout nom.
export const titreImpression = (nature, nom, dateIso) => nomFichierQualiopi(nature, nom, dateIso).replace(/\.csv$/, "");
