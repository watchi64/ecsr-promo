// Doublure de js/db.js pour le banc des modules (_preview_modules.html) : le
// réglage « modules » vit en mémoire le temps de la page, aucun appel réseau.
// ?modules=<scénario> choisit l'état de départ (mêmes scénarios que le banc
// complet). window.__ecritures garde la trace des écritures ;
// window.__ECHEC_ECRITURE = "message" fait échouer les suivantes.
const T0 = "2026-10-05T08:00:00.000Z";
const T1 = "2026-10-12T13:30:00.000Z";
const DEPART = { planning: T0, calendrier: T0, ressources: T0 };
const SCENARIOS = {
  depart: { v: 1, depuis: T0, ouverts: { ...DEPART } },
  notes: { v: 1, depuis: T0, ouverts: { ...DEPART, notes: T1 } },
  themes: { v: 1, depuis: T0, ouverts: { ...DEPART, notes: T1, themes: T1 } },
  enfant: { v: 1, depuis: T0, ouverts: { ...DEPART, qcm: T1 } },
  illisible: "{pas du json",
};

const reglages = new Map();
const scenario = new URLSearchParams(location.search).get("modules");
if (scenario && scenario in SCENARIOS) {
  const v = SCENARIOS[scenario];
  reglages.set("modules", typeof v === "string" ? v : JSON.stringify(v));
}
window.__ecritures = [];

export async function getSetting(key) {
  return reglages.has(key) ? reglages.get(key) : null;
}

export async function setSetting(key, value) {
  if (window.__ECHEC_ECRITURE) throw new Error(String(window.__ECHEC_ECRITURE));
  reglages.set(key, value);
  window.__ecritures.push({ key, value });
}
