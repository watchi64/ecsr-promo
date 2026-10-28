// État des pastilles « Signaler un problème » (spec 2026-10-28, § 5.2) : les signalements nouveaux (que
// la base ne compte que pour le fondateur) et ceux de la personne qui ont avancé sans être vus. Relu au
// démarrage, à « Actualiser », au changement de rôle, après un envoi et après une action du fondateur ;
// les entrées qui portent une pastille s'y abonnent. Quel nombre montrer (nouveaux ou suivis) se décide à
// l'affichage, selon que la personne est le fondateur hors aperçu (pastilleSignalement).

import { compterSignalementsApp } from "./db.js?v=20261028a";

let etat = { nouveaux: 0, suivis: 0 };
const abonnes = new Set();

export function etatSignalements() {
  return { ...etat };
}

export function poserEtatSignalements(nouvel) {
  const suivant = { nouveaux: Number(nouvel?.nouveaux) || 0, suivis: Number(nouvel?.suivis) || 0 };
  if (suivant.nouveaux === etat.nouveaux && suivant.suivis === etat.suivis) return;
  etat = suivant;
  abonnes.forEach((cb) => cb({ ...etat }));
}

// Une lecture ratée garde l'état précédent : la pastille n'est qu'un repère.
export async function chargerEtatSignalements() {
  try {
    poserEtatSignalements(await compterSignalementsApp());
  } catch (e) {
    console.warn("Signalements : compteurs non relus.", e);
  }
  return etatSignalements();
}

// cb(etat) à chaque changement ; renvoie de quoi se désabonner.
export function onSignalementsChange(cb) {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}
