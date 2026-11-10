// Règles pures de l'espace du siège (lot 5, Task 12). Sans DOM ni réseau, testées en node (tests/siege-rules.test.mjs).

// lieux : [{ id, nom, demonstration }] ; directions : [{ id, email, nom, lieu_id }] (lireDirectionsDuReseau).
// Rend un élément par centre, triés par nom, le centre de démonstration en dernier (sa fiche `centre.demonstration` est vraie : la
// page l'affiche à part). Un centre sans direction est compris (`directions` vide). Une direction dont le centre n'est pas dans
// `lieux` est écartée. Chaque direction porte `libelle` : le nom de la fiche formateur liée, sinon l'adresse.
export function directionsParCentre(lieux, directions) {
  const dirs = Array.isArray(directions) ? directions : [];
  const centres = (Array.isArray(lieux) ? lieux : []).map((centre) => ({
    centre,
    directions: dirs.filter((d) => d.lieu_id === centre.id)
      .map((d) => ({ ...d, libelle: d.nom && String(d.nom).trim() ? d.nom : d.email }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
  }));
  const ordinaires = centres.filter((x) => !x.centre.demonstration).sort((a, b) => a.centre.nom.localeCompare(b.centre.nom, "fr"));
  return [...ordinaires, ...centres.filter((x) => x.centre.demonstration)];
}
