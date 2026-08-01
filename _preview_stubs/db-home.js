// Stub minimal de js/db.js pour le banc d'Accueil (_preview_home.html).
// renderHome n'appelle qu'une seule fonction de la base, listAgendaEvents.
//
// Un événement majeur futur est fourni pour que le compteur J-N soit rendu :
// c'est sa POSITION qu'on vérifie. Il s'insère de façon asynchrone, après le
// premier rendu, et doit se placer au-dessus de la section Nouveautés. S'il
// n'y avait aucun événement majeur, le banc ne prouverait rien.
//
// Les dates sont volontairement lointaines pour rester futures longtemps.
export async function listAgendaEvents() {
  return [
    { id: 1, title: "Examens CCP2", type: "examen",
      date_start: "2026-12-08", date_end: "2026-12-11", location: "Nîmes" },
    { id: 2, title: "Stage en entreprise", type: "stage",
      date_start: "2026-11-16", date_end: null, location: null },
  ];
}
