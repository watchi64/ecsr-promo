/* Stub db.js du banc cours : magasin en mémoire, aucune base touchée. */
const MD_1 = `# THÈME 01 - Thème d'essai

> **L'essentiel en 6 lignes**
> Première affirmation.
> Deuxième affirmation.

## 1. Définition / Introduction

Un paragraphe d'introduction avec du **gras** et un [lien](https://exemple.fr).

## 2. Contenu du cours

### A. Sous-partie

Règle énoncée en une phrase.

Points importants à connaître :
- Point un du cours
- Point deux du cours

Étapes d'application :
1. Première étape
2. Deuxième étape

_Textes : R411-25_

:::signaux AB1
Une planche d'essai.
:::

## 3. Risques / Comportements / Sanctions

| Infraction | Article | Amende | Retrait points | Source |
|------------|---------|--------|----------------|--------|
| Essai | R413-14 | 135 € | **1 point** | [Légifrance](https://exemple.fr) |
`;

let magasin = [
  { id: "c1", numero: 1, titre: "Thème d'essai", corps_md: MD_1, published: false,
    updated_by: "import", updated_at: "2026-08-08T10:00:00.000Z",
    created_at: "2026-08-08T10:00:00.000Z" },
  { id: "c2", numero: 2, titre: "Deuxième essai", corps_md: MD_1.replace("01", "02"),
    published: true, updated_by: "import", updated_at: "2026-08-08T10:00:00.000Z",
    created_at: "2026-08-08T10:00:00.000Z" },
];

export async function listCoursIndex() {
  return magasin.map(({ corps_md, ...reste }) => reste);
}
export async function getCours(numero) {
  const c = magasin.find((x) => x.numero === Number(numero));
  if (!c) throw new Error("Cours introuvable");
  return { ...c };
}

let versions = [];  // { id, cours_id, titre, corps_md, saved_by, saved_at }

export async function saveCours(id, { titre, corps_md, who, ouvertA }) {
  const c = magasin.find((x) => x.id === id);
  if (!c) throw new Error("Cours introuvable");
  if (c.updated_at !== ouvertA) return { conflit: true, par: c.updated_by, quand: c.updated_at };
  versions.unshift({ id: "v" + (versions.length + 1), cours_id: id,
    titre: c.titre, corps_md: c.corps_md, saved_by: c.updated_by, saved_at: c.updated_at });
  Object.assign(c, { titre, corps_md, updated_by: who, updated_at: new Date().toISOString() });
  return { conflit: false, cours: { ...c } };
}
export async function listCoursVersions(coursId) {
  return versions.filter((v) => v.cours_id === coursId)
    .map(({ corps_md, titre, ...meta }) => meta);
}
export async function getCoursVersion(versionId) {
  const v = versions.find((x) => x.id === versionId);
  if (!v) throw new Error("Version introuvable");
  return { ...v };
}
export async function setCoursPublie(id, publie) {
  const c = magasin.find((x) => x.id === id);
  if (c) c.published = !!publie;
}
/** Levier de banc : simule une modification concurrente par « Hocine ». */
export function _simulerModifConcurrente(numero) {
  const c = magasin.find((x) => x.numero === Number(numero));
  if (c) { c.updated_by = "Hocine"; c.updated_at = new Date().toISOString(); }
}
