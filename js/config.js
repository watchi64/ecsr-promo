export const SUPABASE_URL = "https://dacqponglpeuscbgwfqn.supabase.co";
export const SUPABASE_KEY = "sb_publishable_1V70A1UAFFGPigcgYkOcdw_sZAE_yCn";

export const TYPES = ["Salle", "Voiture"];
export const RESULTATS = [
  { value: "Effectué", icon: "✅", color: "effectue" },
  { value: "Absence",  icon: "❌", color: "absence" },
  { value: "Bonus",    icon: "⭐", color: "bonus" },
  { value: "Report",   icon: "⏸",  color: "report" },
];

export const ACTIVITES = [
  "Cours",
  "Pédagogie salle",
  "Voiture (conduite)",
  "Contrôle",
  "Autre",
];

// Champs affichés selon le type d'activité.
// Ordre = ordre d'affichage. Les champs absents sont masqués pour ce slot.
export const ACTIVITY_SHAPES = {
  // activité non choisie : affichage minimal pour inviter à sélectionner
  "":                   ["activite", "prof", "sujet", "notes"],
  "Cours":              ["activite", "prof", "sujet", "notes"],
  "Pédagogie salle":    ["activite", "prof", "sujet", "pedagogue", "eleves", "notes"],
  "Voiture (conduite)": ["activite", "prof", "sujet", "eleves", "notes"],
  "Contrôle":           ["activite", "prof", "sujet", "notes"],
  "Autre":              ["activite", "prof", "sujet", "pedagogue", "eleves", "notes"],
};

export const JOURS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"];
export const HALF_DAYS = [
  { key: "matin", label: "9h00 — 12h30", short: "MATIN" },
  { key: "aprem", label: "13h30 — 17h00", short: "APRÈS-MIDI" },
];
