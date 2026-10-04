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

| Couleur | Signification | Emploi |
|---------|---------------|--------|
| **Blanc** | Marquage permanent | Usage général |
| **Jaune** | Marquage temporaire | Chantiers, ou arrêt et stationnement interdits |
| Bleu | Stationnement à durée limitée | Zone bleue |
| Blanche est la couleur la plus fréquente du marquage en France | Phrase longue : pas de pastille attendue | aucun |

_Textes : R411-25_

:::signaux AB1
Une planche d'essai.
:::

## 3. Risques / Comportements / Sanctions

| Infraction | Article | Amende | Retrait points | Source |
|------------|---------|--------|----------------|--------|
| Essai | R413-14 | 135 € | **1 point** | [Légifrance](https://exemple.fr) |
| Essai sans retrait | R412-1 | 35 € | aucune | [Légifrance](https://exemple.fr) |
| Essai avec précision | R417-9 | 35 € | 0 ; immobilisation possible | [Légifrance](https://exemple.fr) |
`;

let magasin = [
  { id: "c1", numero: 1, titre: "Thème d'essai", corps_md: MD_1, published: false,
    updated_by: "import", updated_at: "2026-08-08T10:00:00.000Z",
    created_at: "2026-08-08T10:00:00.000Z" },
  { id: "c2", numero: 2, titre: "Deuxième essai", corps_md: MD_1.replace("01", "02"),
    published: true, updated_by: "import", updated_at: "2026-08-08T10:00:00.000Z",
    created_at: "2026-08-08T10:00:00.000Z" },
];

// Cours de compétences d'essai : liens entre cours, cours suivant, mise en page compacte.
const MD_C2 = `# C2 - Appréhender la route

> **L'essentiel**
> Ouverture d'essai.

## Les sous-compétences

- [C2.4 : tourner](cours:C2.4)
- [Thème 1](cours:1)
- [Thème absent](cours:57)
- [Lien mal formé](cours:C2.10)
`;
const MD_C24 = `# C2.4 - Tourner à droite et à gauche en agglomération

> **L'essentiel**
> Cours d'essai du banc : tous les blocs.

## Pourquoi

Paragraphe d'essai.

## Comment

Texte collé à un bloc.
:::scene tourner-droite
Contrôler et mettre le clignotant
Serrer à droite, **sans se coller au trottoir**
Réduire l'allure avant le virage
Balayer l'intersection du regard
Contrôler l'angle mort droit
Tourner en regardant la sortie
Céder le passage au piéton
Repartir une fois le passage dégagé
:::

## Je m'évalue

:::cartes
Q : Question d'essai ?
R : Réponse d'essai.
:::

:::quiz ordre
? Remettre les étapes dans l'ordre
Contrôle et clignotant
Serrer à **droite**
Tourner
:::

:::quiz vrai-faux
Le clignotant se met avant de serrer à droite. | vrai | On prévient, puis on se place.
:::

:::quiz choix
? Avant de tourner à droite, le regard va vers…
- le compteur
- [x] la voie de **sortie** et le [trottoir](https://exemple.fr)
> Le danger vient du côté du [trottoir](https://exemple.fr).
:::

:::scene inconnue
Une étape
:::

:::quiz ordre
Seul
:::
`;
magasin.push(
  { id: "k2", numero: null, code: "C2", titre: "Appréhender la route", corps_md: MD_C2, published: true,
    updated_by: "import", updated_at: "2026-10-03T10:00:00.000Z", created_at: "2026-10-03T10:00:00.000Z" },
  { id: "k24", numero: null, code: "C2.4", titre: "Tourner à droite et à gauche en agglomération", corps_md: MD_C24,
    published: true, updated_by: "import", updated_at: "2026-10-03T10:00:00.000Z", created_at: "2026-10-03T10:00:00.000Z" },
);

export async function listCoursIndex() {
  return magasin.map(({ corps_md, ...reste }) => reste);
}
export async function getCours(cle) {
  const c = typeof cle === "string"
    ? magasin.find((x) => x.code === cle)
    : magasin.find((x) => x.numero === Number(cle));
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
export async function uploadCoursImage(blob, chemin) {
  // Une URL de données suffit au banc : l'image s'affiche vraiment dans l'aperçu.
  return await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });
}
/** Levier de banc : simule une modification concurrente par « Hocine ». */
export function _simulerModifConcurrente(numero) {
  const c = magasin.find((x) => x.numero === Number(numero));
  if (c) { c.updated_by = "Hocine"; c.updated_at = new Date().toISOString(); }
}
