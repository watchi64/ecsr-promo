# Dossier Professionnel, mise en page officielle · plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUIS : utiliser superpowers:subagent-driven-development
> (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche.
> Les étapes sont en cases à cocher (`- [ ]`).

**But :** rendre le Dossier Professionnel de l'app visuellement identique au modèle officiel
du ministère chargé de l'emploi, et le repaginer en vraies feuilles A4 quand le texte du
candidat dépasse la page, sans perdre aucune donnée déjà saisie.

**Architecture :** le gabarit ne produit plus des pages figées mais un flux de blocs annotés.
Un moteur de composition mesure ces blocs dans le DOM et les répartit sur des feuilles A4,
en coupant les zones de rédaction entre deux lignes visuelles. Le mode édition affiche le
flux avec ses coupures matérialisées, la consultation et l'impression affichent le document
composé.

**Pile technique :** HTML, CSS et JavaScript à modules ES, sans framework. Tests logiques en
`node`. Vérifications visuelles sur banc d'essai local servi par `python -m http.server`.

**Spec de référence :** `docs/specs/2026-09-14-dp-mise-en-page-officielle-design.md`.
La lire en entier avant de commencer.

## Contraintes globales

Ces règles s'appliquent à toutes les tâches.

- **Worktree :** travailler dans `C:\Users\watch\Dev\ECSR\TP_ECSR_App-wt-dp-layout`, branche
  `dp-mise-en-page`. Ne jamais toucher au checkout principal `TP_ECSR_App`, figé sur `main`.
- **Tiret cadratin interdit** partout : code, commentaires, messages de commit, textes de
  l'interface. Utiliser deux-points, virgule, parenthèses ou trait d'union.
- **Aucune clé `data-k` ne change.** La liste complète des clés vivantes est donnée en
  tâche 8. Renommer une clé fait perdre les dossiers des 11 stagiaires qui ont déjà écrit.
- **Ne jamais lancer `scripts/cache-bust.js` sur cette branche.** Le re-versionnage `?v=`
  n'a lieu que sur `main`. Les imports de modules gardent le token existant `?v=20260826d`.
- **Ne jamais modifier `css/livret.css` ni les classes `.lv-f`, `.lv-cb`, `.lv-date`.** Elles
  sont partagées avec le livret EPCF. Tout style du DP passe par un sélecteur préfixé
  `.dp-doc`, par exemple `.dp-doc .lv-f`.
- **Ne jamais mettre `@page` en dur dans une feuille de style.** La règle est injectée par
  `js/doc-officiel.js` tant qu'un document est ouvert, sinon elle casse l'impression A4
  paysage du planning.
- **`#dp-print { display: none }` hors `@media print` est obligatoire**, sinon le clone
  d'impression s'affiche une seconde fois sous la vue.
- **Commits fréquents**, un par tâche au minimum, message en français sans tiret cadratin,
  terminé par la ligne `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **L'onglet « Dossier pro » de l'app est hors service de la tâche 1 à la tâche 7.** Le
  gabarit y est démonté puis reconstruit pièce par pièce. C'est assumé : le chantier vit sur
  une branche, et chaque tâche se vérifie sur son propre banc d'essai, pas dans l'app. Ne
  fusionner dans `main` qu'une fois la tâche 9 terminée.

### Palette et mesures relevées dans le modèle officiel

| Jeton | Valeur | Emploi |
|---|---|---|
| `--dp-magenta` | `#D60093` | bandeaux, filets, barres, repères |
| `--dp-texte` | `#404040` | texte courant |
| `--dp-gris-entete` | `#595959` | titre de l'en-tête de page |
| `--dp-gris-pied` | `#7F7F7F` | pied de page |
| `--dp-filet` | `#D9D9D9` | filets fins et cadres de rubrique |
| `--dp-cadre` | `#BFBFBF` | cadre des zones de rédaction |
| `--dp-gris-clair` | `#F2F2F2` | aplats de tableau et de sommaire |
| `--dp-bande` | `#F7F7F7` | bande haute de l'en-tête |

| Mesure | Valeur |
|---|---|
| Feuille | 210 × 297 mm |
| Marges de la couverture | 25 mm partout, en-tête à 10 mm du bord |
| Marges des autres feuilles | 25 mm haut et bas, 23 mm à gauche, 20 mm à droite, en-tête à 13 mm |
| Pied de page | à 9 mm du bord bas |
| Logo du ministère | 31,8 × 35,7 mm |
| Bloc d'identité de la couverture | largeur 137,5 mm, retrait 29,4 mm |
| Bandeau « Titre professionnel visé » | largeur 170,1 mm |
| Bandeau « Présentation du dossier » | largeur 175,1 mm |
| Fiche d'exemple | largeur 182,6 mm, retrait -0,6 mm |
| Tableau des titres et diplômes | largeur 172,6 mm, colonnes 40,0 / 85,1 / 47,5 mm |

### Comment lancer les vérifications

Tests logiques :

```bash
node tests/dp-rules.test.mjs
```

Banc d'essai visuel, depuis le worktree :

```bash
python -m http.server 8000
```

Puis ouvrir `http://localhost:8000/_preview_dp.html`. Le banc charge ses modules et ses
feuilles de style avec un paramètre horodaté, ce qui contourne le cache figé de la branche.

---

### Tâche 1 : la composition logique perd ses numéros de page

Le calcul du numéro de page quittait `dp-rules.js` : il vient désormais de la pagination
réelle. Les deux rubriques « Documents illustrant la pratique professionnelle » et
« Annexes » disparaissent du document, le modèle officiel ne les contient pas.

**Fichiers :**
- Modifier : `js/dp-rules.js`
- Modifier : `tests/dp-rules.test.mjs`

**Interfaces :**
- Consomme : rien.
- Produit :
  - `CHAMPS_EXEMPLE: string[]` inchangé
  - `cleExemple(at: number, n: number, champ: string): string` inchangé
  - `exempleRempli(data: object, at: number, n: number): boolean` inchangé
  - `exempleImprime(data: object, at: number, n: number): boolean` inchangé
  - `rubriquesImprimees(data: object): Array<{type: string, at?: number, n?: number}>`
  - `rubriquesEdition(data: object): Array<{type: string, at?: number, n?: number, imprime: boolean}>`
  - `sommaire(data: object): Array<{at: number, n: number, titre: string}>`
  - `blocsImprimes` et `blocsEdition` sont supprimés.

- [ ] **Étape 1 : écrire le test qui échoue**

Remplacer l'intégralité de `tests/dp-rules.test.mjs` par :

```javascript
import assert from "node:assert/strict";
import { CHAMPS_EXEMPLE, cleExemple, exempleRempli, exempleImprime,
         rubriquesImprimees, rubriquesEdition, sommaire } from "../js/dp-rules.js";

// --- Clés de sérialisation ---
assert.equal(cleExemple(1, 2, "taches"), "at1_ex2_taches");
assert.ok(CHAMPS_EXEMPLE.includes("titre"));
assert.ok(CHAMPS_EXEMPLE.includes("complement"));

// --- Un exemple est rempli dès qu'un seul de ses champs porte du texte ---
assert.equal(exempleRempli({}, 1, 1), false);
assert.equal(exempleRempli({ at1_ex1_titre: "   " }, 1, 1), false, "espaces seuls = vide");
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 1), true);
assert.equal(exempleRempli({ at1_ex1_complement: "RAS" }, 1, 1), true);
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 1, 2), false);
assert.equal(exempleRempli({ at1_ex1_titre: "Leçon 3" }, 2, 1), false);

// --- L'exemple n°1 s'imprime toujours, même vide (DP vierge imprimable) ---
assert.equal(exempleImprime({}, 1, 1), true);
assert.equal(exempleImprime({}, 2, 1), true);
assert.equal(exempleImprime({}, 1, 2), false);
assert.equal(exempleImprime({ at1_ex2_moyens: "Fiches" }, 1, 2), true);

// --- Dossier vierge : 8 rubriques, sans aucun numéro de page ---
const vierge = rubriquesImprimees({});
assert.deepEqual(vierge.map((r) => r.type),
  ["couverture", "presentation", "sommaire", "intercalaire",
   "exemple", "exemple", "titres", "declaration"]);
// Plus aucune rubrique ne porte de numéro de page : il vient de la pagination réelle.
assert.ok(vierge.every((r) => r.page === undefined),
  "rubriquesImprimees ne calcule plus de numéro de page");
// Les rubriques « documents » et « annexes » ont quitté le document.
assert.ok(!vierge.some((r) => r.type === "documents" || r.type === "annexes"));
assert.deepEqual(vierge.filter((r) => r.type === "exemple").map((r) => [r.at, r.n]),
  [[1, 1], [2, 1]]);

// --- Dossier complet : 6 fiches d'exemple, 12 rubriques ---
const plein = {};
for (const at of [1, 2]) for (const n of [1, 2, 3]) plein[cleExemple(at, n, "titre")] = `T${at}${n}`;
const tout = rubriquesImprimees(plein);
assert.equal(tout.length, 12);
assert.equal(tout.filter((r) => r.type === "exemple").length, 6);
assert.equal(tout[tout.length - 1].type, "declaration");

// --- Cas intermédiaire : AT1 a 3 exemples, AT2 seulement le premier ---
const mixte = { at1_ex2_titre: "B", at1_ex3_titre: "C" };
assert.deepEqual(rubriquesImprimees(mixte).filter((r) => r.type === "exemple").map((r) => [r.at, r.n]),
  [[1, 1], [1, 2], [1, 3], [2, 1]]);

// --- Sommaire : titres saisis, exemples non imprimés absents, aucun numéro ---
assert.deepEqual(sommaire(mixte),
  [{ at: 1, n: 1, titre: "" },
   { at: 1, n: 2, titre: "B" },
   { at: 1, n: 3, titre: "C" },
   { at: 2, n: 1, titre: "" }]);
assert.equal(sommaire({ at1_ex1_titre: "  Première leçon  " })[0].titre, "Première leçon");

// --- Mode édition : les 6 fiches sont toujours là, marquées imprimées ou non ---
const edition = rubriquesEdition(mixte);
assert.equal(edition.filter((r) => r.type === "exemple").length, 6);
assert.deepEqual(edition.filter((r) => r.type === "exemple").map((r) => r.imprime),
  [true, true, true, true, false, false]);
// Les rubriques fixes sont toujours imprimées.
assert.ok(edition.filter((r) => r.type !== "exemple").every((r) => r.imprime === true));
assert.deepEqual(edition.map((r) => r.type),
  ["couverture", "presentation", "sommaire", "intercalaire",
   "exemple", "exemple", "exemple", "exemple", "exemple", "exemple",
   "titres", "declaration"]);

console.log("dp-rules : OK");
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
node tests/dp-rules.test.mjs
```

Attendu : échec avec `SyntaxError` ou `TypeError`, `rubriquesImprimees` n'étant pas exporté.

- [ ] **Étape 3 : écrire l'implémentation**

Remplacer, dans `js/dp-rules.js`, tout ce qui suit la fonction `exempleImprime` par :

```javascript
// Rubriques du document officiel, dans l'ordre. Le modèle ne contient ni page
// « Documents illustrant la pratique professionnelle » ni page « Annexes » : son
// sommaire les annonce, mais le document s'arrête à la déclaration sur l'honneur.
const RUBRIQUES_AVANT = ["couverture", "presentation", "sommaire", "intercalaire"];
const RUBRIQUES_APRES = ["titres", "declaration"];

// Rubriques réellement imprimées. Aucun numéro de page ici : il vient de la
// pagination réelle (js/dp-pagination.js), seule à savoir combien de feuilles
// occupe une fiche d'exemple une fois remplie.
export function rubriquesImprimees(data) {
  const out = RUBRIQUES_AVANT.map((type) => ({ type }));
  for (const at of [1, 2]) {
    for (const n of [1, 2, 3]) {
      if (exempleImprime(data, at, n)) out.push({ type: "exemple", at, n });
    }
  }
  RUBRIQUES_APRES.forEach((type) => out.push({ type }));
  return out;
}

// Rubriques affichées en ÉDITION : les 6 fiches d'exemple, même vides. Sans cela
// le candidat n'aurait aucun champ où saisir sa 2e ou sa 3e fiche. Celles qui
// resteront hors du document imprimé portent imprime:false.
export function rubriquesEdition(data) {
  const imprimees = new Set(
    rubriquesImprimees(data).map((r) => (r.type === "exemple" ? `exemple:${r.at}:${r.n}` : r.type)),
  );
  const out = RUBRIQUES_AVANT.map((type) => ({ type, imprime: true }));
  for (const at of [1, 2]) {
    for (const n of [1, 2, 3]) {
      out.push({ type: "exemple", at, n, imprime: imprimees.has(`exemple:${at}:${n}`) });
    }
  }
  RUBRIQUES_APRES.forEach((type) => out.push({ type, imprime: true }));
  return out;
}

// Entrées du sommaire : une fiche d'exemple imprimée par ligne, avec le titre
// saisi par le candidat. Le numéro de page est ajouté par la vue, à partir de la
// pagination.
export function sommaire(data) {
  return rubriquesImprimees(data)
    .filter((r) => r.type === "exemple")
    .map((r) => ({ at: r.at, n: r.n, titre: txt(data, cleExemple(r.at, r.n, "titre")) }));
}
```

- [ ] **Étape 4 : lancer le test pour le voir passer**

```bash
node tests/dp-rules.test.mjs
```

Attendu : `dp-rules : OK`, sortie sans erreur, code de retour 0.

- [ ] **Étape 5 : commit**

```bash
git add js/dp-rules.js tests/dp-rules.test.mjs
git commit -m "DP : la composition logique ne calcule plus les numeros de page

Les rubriques Documents et Annexes quittent le document, absentes du modele
officiel. Le numero de page viendra de la pagination reelle.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 2 : le châssis d'une feuille, en-tête et pied officiels

Une feuille A4 avec son en-tête et son pied, aux mesures du modèle. Rien d'autre n'est
encore rendu : c'est le cadre dans lequel tout le reste viendra se poser.

**Fichiers :**
- Réécrire : `css/dp.css`
- Modifier : `js/views/dp-gabarit.js` (ajout des fonctions de châssis, le reste suit en tâches 4 à 6)
- Créer : `_preview_dp_chassis.html` (banc temporaire, supprimé en tâche 7)
- Copier : `assets/dp/ministere-emploi.jpg` reste en place, inchangé

**Interfaces :**
- Consomme : rien.
- Produit, exportés par `js/views/dp-gabarit.js` :
  - `entete(estCouverture: boolean): string` rend l'en-tête d'une feuille
  - `pied(numero: number): string` rend le pied, alterné selon la parité de `numero`
  - `feuille(interieur: string, numero: number, estCouverture: boolean): string`

- [ ] **Étape 1 : écrire la feuille de style**

Remplacer l'intégralité de `css/dp.css` par :

```css
/* ============================================================================
   Dossier Professionnel : vue, composition et impression.

   Le document reproduit le modèle officiel du ministère chargé de l'emploi,
   version du 11/09/2017. Toutes les valeurs de cette feuille sont relevées dans
   le XML du .docx, pas estimées à l'œil : voir
   docs/specs/2026-09-14-dp-mise-en-page-officielle-design.md.

   Les champs remplissables réutilisent les classes .lv-f et .lv-cb de
   css/livret.css, communes aux documents officiels. Cette feuille ne les
   redéfinit JAMAIS globalement : toute règle passe par .dp-doc, sinon elle
   casserait le livret EPCF qui partage ces classes.
   ========================================================================= */

.dp-doc {
  --dp-magenta: #d60093;
  --dp-texte: #404040;
  --dp-gris-entete: #595959;
  --dp-gris-pied: #7f7f7f;
  --dp-filet: #d9d9d9;
  --dp-cadre: #bfbfbf;
  --dp-gris-clair: #f2f2f2;
  --dp-bande: #f7f7f7;

  /* Calibri est la police du modèle. Carlito en est le clone métriquement
     compatible ; la pile système prend le relais sur iOS, qui n'a ni l'une ni
     l'autre. */
  font-family: Calibri, Carlito, "Segoe UI", system-ui, sans-serif;
  font-size: 11pt;
  line-height: 1.22;
  color: var(--dp-texte);
  /* Impose l'impression des aplats magenta même quand l'option « Graphiques
     d'arrière-plan » du navigateur est décochée. */
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.dp-doc p { margin: 0; }
.dp-doc table { border-collapse: collapse; table-layout: fixed; width: 100%; }
.dp-doc td, .dp-doc th { vertical-align: top; padding: 1.2mm 1.6mm; word-wrap: break-word; }

/* --- La feuille ---------------------------------------------------------- */

.dp-feuille {
  position: relative;
  box-sizing: border-box;
  width: 210mm;
  height: 297mm;
  background: #fff;
  display: flex;
  flex-direction: column;
  /* Marges du modèle : 23 mm à gauche (20 mm plus 3 mm de gouttière), 20 mm à
     droite, en-tête à 13 mm du bord, pied à 9 mm. */
  padding: 13mm 20mm 9mm 23mm;
  overflow: hidden;
}
/* La couverture a ses propres marges : 25 mm partout, en-tête à 10 mm. */
.dp-feuille.dp-couverture { padding: 10mm 25mm 9mm 25mm; }

.dp-screen .dp-feuille { box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18); margin: 0 0 8mm; }

/* Le corps occupe toute la place entre l'en-tête et le pied. C'est lui que le
   moteur de composition mesure : sa hauteur est fixe, son scrollHeight dit si le
   contenu déborde. */
.dp-corps { flex: 1 1 auto; min-height: 0; overflow: hidden; }
/* Garde-fou : posée par le moteur quand un bloc insécable dépasse à lui seul la
   hauteur d'une feuille. Mieux vaut un débordement visible qu'un texte rogné. */
.dp-corps.dp-corps-deborde { overflow: visible; }

/* --- En-tête ------------------------------------------------------------- */

.dp-entete { flex: 0 0 auto; margin-bottom: 4mm; }
.dp-entete-bande {
  height: 2.1mm;
  background: var(--dp-bande);
  border-bottom: 0.5pt solid var(--dp-filet);
}
.dp-entete-titre {
  text-align: center;
  font-variant: small-caps;
  color: var(--dp-gris-entete);
  padding: 1.5mm 0 1mm;
  border-bottom: 2.25pt solid var(--dp-magenta);
}
.dp-entete-titre b { font-weight: 700; font-size: 24pt; }
.dp-entete-titre span { font-size: 14pt; }
/* Sur la couverture, le titre est plus grand et le logo l'accompagne. */
.dp-couverture .dp-entete { display: flex; align-items: flex-end; gap: 4mm; }
.dp-couverture .dp-entete-logo { flex: 0 0 31.8mm; }
.dp-couverture .dp-entete-logo img { width: 31.8mm; height: 35.7mm; display: block; }
.dp-couverture .dp-entete-bloc { flex: 1 1 auto; min-width: 0; }
.dp-couverture .dp-entete-titre b { font-size: 36pt; }
.dp-couverture .dp-entete-titre span { font-size: 22pt; }

/* --- Pied de page -------------------------------------------------------- */

.dp-pied {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 6mm;
  padding-top: 2mm;
  font-size: 9pt;
  color: var(--dp-gris-pied);
}

/* --- Mise à l'échelle écran, identique au livret ------------------------- */

.dp-scale-outer { overflow: hidden; }
.dp-scale { transform-origin: top left; }

/* --- Impression ---------------------------------------------------------- */

/* Le clone d'impression vit en permanence dans le <body> tant qu'un dossier est
   ouvert (voir js/doc-officiel.js) : il DOIT être masqué à l'écran, sinon le
   document apparaît une seconde fois sous la vue, en pleine largeur 210 mm.
   css/livret.css porte la même règle pour #livret-print. */
#dp-print { display: none; }

@media print {
  body.dp-printable > *:not(#dp-print) { display: none !important; }
  body.dp-printable #dp-print { display: block !important; }
  #dp-print .dp-feuille { page-break-after: always; box-shadow: none; margin: 0; }
  #dp-print .dp-feuille:last-child { page-break-after: auto; }
}
/* NB : la règle « @page { size: A4 portrait; margin: 0 } » est injectée en JS
   par js/doc-officiel.js seulement tant qu'un document est ouvert. En dur ici,
   elle écraserait le « A4 landscape » de l'impression du planning. */
```

La spec envisage d'embarquer la police Carlito en woff2 pour un rendu strictement identique
sur iOS. On s'en tient à la pile système : elle suffit, elle n'ajoute pas 400 ko à charger, et
l'écart se contrôle au point 10 de la liste de vérification. Si le rendu iPhone se révèle trop
éloigné, l'embarquement sera un chantier à part.

- [ ] **Étape 2 : réduire le gabarit à son châssis**

La tâche 1 a supprimé `blocsImprimes` et `blocsEdition`, que `js/views/dp-gabarit.js`
importait : le fichier ne se charge plus. Le remplacer entièrement par son en-tête, la
fonction `escapeHtml` et les trois fonctions de châssis. Tout le reste du gabarit est
reconstruit aux tâches 4 à 6.

```javascript
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
```

Ajouter ensuite les trois fonctions de châssis :

```javascript
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
```

`escapeHtml` n'est pas encore utilisé à ce stade : il le sera par le sommaire, en tâche 4.

- [ ] **Étape 3 : créer le banc temporaire du châssis**

Créer `_preview_dp_chassis.html` :

```html
<!DOCTYPE html>
<!-- Banc temporaire du châssis de feuille du DP. Supprimé en tâche 7, une fois
     _preview_dp.html remis à jour. Non déployé, jamais lié depuis l'app. -->
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Banc · châssis DP</title>
  <script>
    window.__cssPrete = Promise.all(["css/livret.css", "css/dp.css"].map((f) => new Promise((ok) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = `${f}?cb=${Date.now()}`;
      l.onload = l.onerror = ok;
      document.head.appendChild(l);
    })));
  </script>
  <style>
    body { margin: 20px; background: #e8e8e4; font-family: sans-serif; }
    #rapport { margin-bottom: 12px; font-size: 13px; white-space: pre-line; }
  </style>
</head>
<body>
  <div id="rapport">mesure en cours</div>
  <div id="hote"></div>
  <script type="module">
    const { feuille } = await import(`./js/views/dp-gabarit.js?cb=${Date.now()}`);
    await window.__cssPrete;

    const hote = document.getElementById("hote");
    const doc = document.createElement("div");
    doc.className = "dp-doc dp-screen";
    doc.innerHTML = feuille("<p>Contenu de contrôle, feuille 1.</p>", 1, true)
                  + feuille("<p>Contenu de contrôle, feuille 2.</p>", 2, false)
                  + feuille("<p>Contenu de contrôle, feuille 3.</p>", 3, false);
    hote.appendChild(doc);

    const mm = (px) => (px / (96 / 25.4)).toFixed(1);
    const feuilles = [...doc.querySelectorAll(".dp-feuille")];
    const lignes = feuilles.map((f, i) => {
      const corps = f.querySelector(".dp-corps");
      return `feuille ${i + 1} : ${mm(f.offsetWidth)} x ${mm(f.offsetHeight)} mm, `
           + `corps utile ${mm(corps.clientHeight)} mm, `
           + `pied « ${f.querySelector(".dp-pied").innerText.replace(/\s+/g, " ").trim()} »`;
    });
    const logos = doc.querySelectorAll(".dp-entete-logo").length;
    lignes.push(`logos : ${logos} (attendu 1, sur la couverture seulement)`);
    document.getElementById("rapport").textContent = lignes.join("\n");
  </script>
</body>
</html>
```

- [ ] **Étape 4 : vérifier le châssis dans le navigateur**

Lancer le serveur puis ouvrir le banc :

```bash
python -m http.server 8000
```

Ouvrir `http://localhost:8000/_preview_dp_chassis.html` et contrôler le rapport affiché en
haut de page.

Attendu :
- chaque feuille mesure `210.0 x 297.0 mm` ;
- un seul logo, sur la couverture ;
- feuille 1 : pied `DOSSIER PROFESSIONNEL - Version Traitement de texte - Version du 11/09/2017 Page 1` ;
- feuille 2 : pied `Page 2 DOSSIER PROFESSIONNEL - Version du 11/09/2017` ;
- corps utile de la couverture : environ 233 mm (tolérance 3 mm) ;
- corps utile des feuilles courantes : environ 249 mm (tolérance 3 mm). L'écart entre les
  deux vient du logo du ministère, qui dans l'en-tête repousse le corps plus bas, mais
  seulement sur la couverture.

Contrôler aussi à l'œil, par capture d'écran : bande grise, titre en petites capitales
grises centré, filet magenta sous le titre, logo du ministère sur la couverture seulement.

- [ ] **Étape 5 : commit**

```bash
git add css/dp.css js/views/dp-gabarit.js _preview_dp_chassis.html
git commit -m "DP : chassis de feuille aux mesures du modele officiel

En-tete a bande grise et filet magenta, logo sur la seule couverture, pied
alterne selon la parite de la feuille et sans total de pages.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 3 : le moteur de composition en feuilles

Le cœur du chantier. Il mesure les blocs d'un flux et les répartit sur des feuilles A4, en
coupant les blocs sécables entre deux lignes visuelles.

**Fichiers :**
- Créer : `js/dp-pagination.js`
- Créer : `_preview_dp_moteur.html` (banc temporaire, supprimé en tâche 7)

**Interfaces :**
- Consomme : `feuille(interieur, numero, estCouverture)` de `js/views/dp-gabarit.js` (tâche 2).
- Produit :
  - `composer(blocs: Element[], opts: {hote: Element, fabriquerFeuille: (numero: number, estCouverture: boolean) => Element}): {feuilles: number, numeroParBloc: number[], numeroParCle: Map<string, number>}`
  - `marquerCoupures(flux: Element, numeroParBloc: number[]): void`

- [ ] **Étape 1 : écrire le moteur**

Créer `js/dp-pagination.js` :

```javascript
// Composition du Dossier Professionnel en feuilles A4.
//
// Le gabarit (js/views/dp-gabarit.js) produit un FLUX de blocs, sans se
// préoccuper des pages. Ce module les mesure dans le DOM et les répartit sur des
// feuilles, comme Word repagine un document dont le texte déborde.
//
// Mesurer impose que les feuilles soient RENDUES : un conteneur en display:none
// n'a ni hauteur ni rectangle. L'appelant fournit un hôte hors écran mais rendu.

const PX_PAR_MM = 96 / 25.4;

// En dessous de cette hauteur restante, on n'ouvre pas une zone de rédaction en
// bas de feuille : deux ou trois lignes orphelines se lisent mal.
const HAUTEUR_MIN_MORCEAU = 10 * PX_PAR_MM;

// Répartit les blocs sur des feuilles. Renvoie le nombre de feuilles produites,
// le numéro de feuille où commence chaque bloc, et celui où commence chaque
// rubrique (clé data-cle), dont le sommaire a besoin.
export function composer(blocs, { hote, fabriquerFeuille }) {
  hote.textContent = "";
  const numeroParBloc = [];
  const numeroParCle = new Map();
  let numero = 0;
  let corps = null;
  let hUtile = 0;

  function nouvelleFeuille(estCouverture) {
    numero += 1;
    const f = fabriquerFeuille(numero, estCouverture);
    hote.appendChild(f);
    corps = f.querySelector(".dp-corps");
    hUtile = corps.clientHeight;
  }

  // Tolérance d'un pixel : les arrondis de rendu font varier scrollHeight.
  const deborde = () => corps.scrollHeight > hUtile + 1;

  blocs.forEach((bloc, index) => {
    const estCouverture = bloc.dataset.cle === "couverture";
    if (!corps || (bloc.dataset.ouvrant === "1" && corps.childElementCount)) {
      nouvelleFeuille(estCouverture);
    }
    numeroParBloc[index] = numero;
    if (bloc.dataset.cle && !numeroParCle.has(bloc.dataset.cle)) {
      numeroParCle.set(bloc.dataset.cle, numero);
    }

    let aPlacer = bloc.cloneNode(true);
    while (aPlacer) {
      corps.appendChild(aPlacer);

      if (!deborde()) {
        // Un intitulé de question ne reste jamais seul en bas de feuille : sa
        // zone de réponse doit pouvoir commencer en dessous.
        if (aPlacer.dataset.avecSuivant === "1" && corps.childElementCount > 1
            && hUtile - corps.scrollHeight < HAUTEUR_MIN_MORCEAU) {
          corps.removeChild(aPlacer);
          nouvelleFeuille(false);
          numeroParBloc[index] = numero;
          if (bloc.dataset.cle) numeroParCle.set(bloc.dataset.cle, numero);
          corps.appendChild(aPlacer);
        }
        aPlacer = null;
        break;
      }

      if (aPlacer.dataset.nature === "secable") {
        const reste = couper(aPlacer, corps, hUtile);
        if (reste !== null) {
          // Le morceau posé et sa suite ne sont plus des champs : seul le flux
          // d'édition porte les data-k, jamais le document composé.
          aPlacer.removeAttribute("data-k");
          const suite = aPlacer.cloneNode(false);
          suite.classList.add("dp-suite");
          suite.removeAttribute("data-k");
          suite.textContent = reste;
          nouvelleFeuille(false);
          aPlacer = suite;
          continue;
        }
      }

      // Bloc insécable, ou coupe impossible faute de place pour une seule ligne.
      corps.removeChild(aPlacer);
      if (corps.childElementCount === 0) {
        // Le bloc dépasse à lui seul la hauteur d'une feuille. On le garde et on
        // laisse déborder : perdre du texte serait pire qu'une feuille trop pleine.
        corps.classList.add("dp-corps-deborde");
        corps.appendChild(aPlacer);
        aPlacer = null;
        break;
      }
      nouvelleFeuille(false);
      numeroParBloc[index] = numero;
      if (bloc.dataset.cle) numeroParCle.set(bloc.dataset.cle, numero);
    }
  });

  return { feuilles: numero, numeroParBloc, numeroParCle };
}

// Coupe le texte d'un bloc à la dernière ligne visuelle qui tient dans la place
// restante, et renvoie le texte restant. Renvoie null si tout tient, ou si même
// un mot ne tient pas.
//
// La recherche est dichotomique sur l'offset caractère : on cherche le plus
// grand offset dont le bas du dernier rectangle de ligne reste au-dessus de la
// limite. getClientRects donne un rectangle par ligne visuelle, ce qui évite de
// mesurer caractère par caractère.
function couper(el, corps, hUtile) {
  const noeud = el.firstChild;
  if (!noeud || noeud.nodeType !== Node.TEXT_NODE || !noeud.data) return null;
  const texte = noeud.data;

  const cs = getComputedStyle(el);
  const bas = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
  const limite = corps.getBoundingClientRect().top + hUtile - bas;

  const r = document.createRange();
  let lo = 0;
  let hi = texte.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    r.setStart(noeud, 0);
    r.setEnd(noeud, mid);
    const rects = r.getClientRects();
    if (!rects.length) { lo = mid + 1; continue; }
    if (rects[rects.length - 1].bottom <= limite) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (best >= texte.length) return null;

  // Ne jamais couper au milieu d'un mot : on recule au dernier séparateur.
  const espace = texte.lastIndexOf(" ", best);
  const ligne = texte.lastIndexOf("\n", best);
  const sep = Math.max(espace, ligne);
  const coupe = sep > 0 ? sep + 1 : best;
  if (coupe <= 0) return null;

  const reste = texte.slice(coupe);
  noeud.data = texte.slice(0, coupe);
  return reste.length ? reste : null;
}

// Mode édition : au lieu de couper, on montre où tomberont les coupures. Le
// candidat garde un flux continu, éditable d'un seul tenant, tout en voyant le
// découpage du document qu'il imprimera.
//
// Le trait n'est pas numéroté : le ruban d'édition contient aussi les fiches
// encore vides, qui ne seront pas imprimées, donc sa numérotation ne serait pas
// celle du document remis au jury. Les vrais numéros vivent au sommaire.
export function marquerCoupures(flux, numeroParBloc) {
  flux.querySelectorAll(".dp-coupure").forEach((n) => n.remove());
  const blocs = [...flux.children].filter((n) => n.classList.contains("dp-bloc"));
  blocs.forEach((bloc, i) => {
    if (i === 0) return;
    const numero = numeroParBloc[i];
    if (numero === undefined || numero === numeroParBloc[i - 1]) return;
    const trait = document.createElement("div");
    trait.className = "dp-coupure";
    trait.textContent = "Saut de feuille";
    flux.insertBefore(trait, bloc);
  });
}
```

- [ ] **Étape 2 : ajouter les styles du flux, des coupures et du conteneur de mesure**

Ajouter à la fin de `css/dp.css`, avant le bloc `@media print` :

```css
/* --- Le flux d'édition --------------------------------------------------- */

/* En édition le document n'est pas découpé en feuilles : le candidat écrit dans
   un ruban continu à la largeur d'une feuille, avec les futures coupures
   matérialisées. Un champ coupé en deux ne serait plus éditable. */
.dp-flux {
  box-sizing: border-box;
  width: 210mm;
  background: #fff;
  padding: 13mm 20mm 13mm 23mm;
}
.dp-screen .dp-flux { box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18); }

.dp-coupure {
  margin: 5mm -6mm;
  border-top: 0.4mm dashed var(--dp-cadre);
  font-size: 8pt;
  color: #8a8578;
  text-align: right;
  padding-top: 1mm;
}

/* Fiche d'exemple encore vide : affichée en édition, absente du document
   imprimé. Le candidat doit pouvoir y saisir tout en voyant qu'elle ne compte
   pas tant qu'elle reste vide. */
.dp-bloc-exclu { background: #fbfbfa; outline: 0.3mm dashed #c9c6bd; }
.dp-mention-exclu { font-size: 8pt; font-style: italic; color: #8a8578; margin-bottom: 2mm; }

/* Conteneur de mesure : rendu, donc mesurable, mais hors de l'écran. Un
   display:none n'a ni hauteur ni rectangle, la composition y serait aveugle. */
#dp-compose {
  position: absolute;
  left: -20000px;
  top: 0;
  width: 210mm;
  visibility: hidden;
  pointer-events: none;
}

/* Suite d'une zone coupée par un saut de feuille : pas de bordure haute, pour
   que le cadre se lise comme continu d'une feuille à l'autre. */
.dp-doc .dp-zone.dp-suite { border-top: none; }
```

- [ ] **Étape 3 : créer le banc temporaire du moteur**

Créer `_preview_dp_moteur.html` :

```html
<!DOCTYPE html>
<!-- Banc temporaire du moteur de composition. Supprimé en tâche 7. Il n'utilise
     pas le gabarit du DP : des blocs de contrôle suffisent à prouver la coupe. -->
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Banc · moteur de composition DP</title>
  <script>
    window.__cssPrete = Promise.all(["css/livret.css", "css/dp.css"].map((f) => new Promise((ok) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = `${f}?cb=${Date.now()}`;
      l.onload = l.onerror = ok;
      document.head.appendChild(l);
    })));
  </script>
  <style>
    body { margin: 20px; background: #e8e8e4; font-family: sans-serif; }
    #rapport { margin-bottom: 12px; font-size: 13px; white-space: pre-line; }
    .ok { color: #2f6f3e; } .ko { color: #b00020; font-weight: 700; }
  </style>
</head>
<body>
  <div id="rapport">mesure en cours</div>
  <div id="hote"></div>
  <script type="module">
    const cb = Date.now();
    const { feuille } = await import(`./js/views/dp-gabarit.js?cb=${cb}`);
    const { composer } = await import(`./js/dp-pagination.js?cb=${cb}`);
    await window.__cssPrete;

    // Un texte long et déterministe : 900 mots courts, largement plus qu'une feuille.
    const MOTS = Array.from({ length: 900 }, (_, i) => `mot${i}`).join(" ");

    const flux = document.createElement("div");
    flux.className = "dp-doc dp-flux";
    flux.innerHTML = `
      <div class="dp-bloc" data-cle="un" data-ouvrant="1" data-nature="atomique">
        <p><b>Rubrique un</b></p></div>
      <div class="dp-bloc" data-cle="deux" data-ouvrant="1" data-nature="atomique"
           data-avec-suivant="1"><p><b>Rubrique deux, intitulé</b></p></div>
      <div class="dp-bloc dp-zone" data-cle="deux" data-nature="secable"></div>
      <div class="dp-bloc" data-cle="trois" data-ouvrant="1" data-nature="atomique">
        <p><b>Rubrique trois</b></p></div>`;
    flux.querySelector(".dp-zone").textContent = MOTS;
    document.body.appendChild(flux);
    flux.style.position = "absolute";
    flux.style.left = "-20000px";

    const hote = document.createElement("div");
    hote.className = "dp-doc dp-screen";
    document.getElementById("hote").appendChild(hote);

    const blocs = [...flux.children].filter((n) => n.classList.contains("dp-bloc"));
    const res = composer(blocs, {
      hote,
      fabriquerFeuille: (numero, couv) => {
        const d = document.createElement("div");
        d.innerHTML = feuille("", numero, couv);
        return d.firstElementChild;
      },
    });

    // --- Contrôles ---
    const lignes = [];
    const dire = (ok, texte) => lignes.push(`${ok ? "OK  " : "KO  "}${texte}`);

    dire(res.feuilles >= 3, `feuilles produites : ${res.feuilles} (attendu au moins 3)`);

    // Aucun texte perdu : la concaténation des morceaux doit rendre l'original.
    const morceaux = [...hote.querySelectorAll(".dp-zone")].map((n) => n.textContent).join("");
    dire(morceaux.replace(/\s+/g, " ").trim() === MOTS,
      `texte reconstitué identique à l'original (${morceaux.length} caractères contre ${MOTS.length})`);

    // Aucune feuille ne déborde de sa hauteur utile.
    const debordent = [...hote.querySelectorAll(".dp-corps")]
      .filter((c) => c.scrollHeight > c.clientHeight + 1).length;
    dire(debordent === 0, `feuilles en débordement : ${debordent} (attendu 0)`);

    // Numérotation continue dans les pieds de page.
    const numeros = [...hote.querySelectorAll(".dp-pied")]
      .map((p) => Number(p.innerText.match(/Page (\d+)/)[1]));
    dire(numeros.every((n, i) => n === i + 1), `pieds numérotés ${numeros.join(", ")}`);

    // Les morceaux de suite ne portent plus de data-k : le document composé n'est
    // jamais une source de données.
    const fuite = hote.querySelectorAll(".dp-zone[data-k]").length;
    dire(fuite === 0, `zones composées portant encore data-k : ${fuite} (attendu 0)`);

    // Chaque rubrique ouvrante commence bien sur une feuille neuve.
    dire(res.numeroParCle.get("un") === 1 && res.numeroParCle.get("deux") === 2,
      `rubriques : un=${res.numeroParCle.get("un")}, deux=${res.numeroParCle.get("deux")}, trois=${res.numeroParCle.get("trois")}`);

    const r = document.getElementById("rapport");
    r.textContent = lignes.join("\n");
    r.className = lignes.some((l) => l.startsWith("KO")) ? "ko" : "ok";
  </script>
</body>
</html>
```

- [ ] **Étape 4 : vérifier le moteur dans le navigateur**

Ouvrir `http://localhost:8000/_preview_dp_moteur.html`.

Attendu : les six lignes du rapport commencent par `OK`, affichées en vert. En particulier
« texte reconstitué identique à l'original » et « feuilles en débordement : 0 ».

Si une ligne est en `KO`, ne pas passer à la suite : le moteur est le socle de tout le reste.

- [ ] **Étape 5 : commit**

```bash
git add js/dp-pagination.js css/dp.css _preview_dp_moteur.html
git commit -m "DP : moteur de composition en feuilles A4

Mesure les blocs du flux et les repartit, en coupant les zones de redaction
entre deux lignes visuelles par recherche dichotomique. Aucun texte perdu,
aucun data-k dans le document compose.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 4 : couverture, présentation, sommaire et intercalaire

Les quatre premières rubriques du document, à l'habillage officiel.

**Fichiers :**
- Modifier : `js/views/dp-gabarit.js`
- Modifier : `css/dp.css`

**Interfaces :**
- Consomme : `rubriquesImprimees`, `rubriquesEdition`, `sommaire`, `cleExemple` de
  `js/dp-rules.js` (tâche 1) ; `feuille`, `entete`, `pied` (tâche 2).
- Produit :
  - `buildDpFlux(data: object, opts?: {edition?: boolean, pages?: Map<string, number>}): string`
  - `AT1_TITRE: string`, `AT2_TITRE: string` inchangés.

**Rappel de sécurité :** ce module produit du HTML par concaténation. La seule donnée saisie
par le candidat qui y est injectée est le titre d'une fiche d'exemple, repris au sommaire, et
il passe obligatoirement par `escapeHtml`. Toutes les autres valeurs entrent par `fillData`,
qui écrit en `textContent`.

- [ ] **Étape 1 : écrire les styles des quatre rubriques**

Ajouter à `css/dp.css`, avant la section « Le flux d'édition » :

```css
/* --- Blocs et motifs communs --------------------------------------------- */

.dp-bloc { position: relative; }

/* Bandeau de rubrique : barre magenta pleine, titre blanc, filet dessous. */
.dp-bandeau {
  background: var(--dp-magenta);
  color: #fff;
  font-weight: 700;
  font-size: 20pt;
  text-align: center;
  padding: 0.5mm 2mm 1mm;
}
.dp-filet-magenta { border-top: 2.25pt solid var(--dp-magenta); margin-top: 1.4mm; }
.dp-cadre { border: 0.5pt solid var(--dp-filet); border-top: none; padding: 3mm 4mm; }

/* Repère triangulaire magenta du modèle (Wingdings 3 U+F075), dessiné en CSS :
   la police n'est pas disponible et ne peut pas être appelée par son caractère. */
.dp-repere {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 1.6mm solid var(--dp-magenta);
  border-top: 1mm solid transparent;
  border-bottom: 1mm solid transparent;
  vertical-align: 0.4mm;
  margin: 0 1.5mm;
}

/* Puce de liste du texte officiel, même repère. */
.dp-liste { list-style: none; margin: 0; padding: 0; }
.dp-liste li { position: relative; padding-left: 6mm; margin-bottom: 2mm; text-align: justify; font-size: 10pt; }
.dp-liste li::before {
  content: "";
  position: absolute;
  left: 1.5mm;
  top: 1.6mm;
  width: 0;
  height: 0;
  border-left: 1.6mm solid var(--dp-magenta);
  border-top: 1mm solid transparent;
  border-bottom: 1mm solid transparent;
}

/* Repères de saisie : visibles à l'écran, jamais imprimés. Un dossier remis au
   jury ne doit pas porter « Cliquez ici pour taper du texte ». */
.dp-doc .lv-f:empty::before { color: #9a9a9a; font-style: italic; }
#dp-print .lv-f:empty::before { content: "" !important; }

/* --- Couverture ---------------------------------------------------------- */

.dp-identite { width: 137.5mm; margin: 6mm 0 0 29.4mm; }
.dp-identite-ligne { display: flex; align-items: baseline; margin-bottom: 3mm; }
.dp-identite-label {
  flex: 0 0 41.4mm;
  border-left: 3pt solid var(--dp-magenta);
  padding-left: 2.5mm;
  font-style: italic;
  font-size: 12pt;
  color: var(--dp-magenta);
}
.dp-identite-champ { flex: 1 1 auto; min-width: 0; }
.dp-identite-ligne.dp-identite-haute { align-items: stretch; }
.dp-identite-ligne.dp-identite-haute .dp-identite-champ { min-height: 11mm; }

.dp-titre-vise-bloc { width: 170.1mm; margin: 18mm auto 0; }
.dp-titre-vise {
  text-align: center;
  font-size: 16pt;
  padding: 6mm 2mm;
  border-bottom: 1.5pt solid var(--dp-magenta);
}
.dp-modalite-titre { font-weight: 700; font-size: 18pt; margin-bottom: 3mm; }
.dp-modalite-ligne { font-size: 16pt; margin-bottom: 2mm; }
.dp-doc .dp-modalite-ligne .lv-cb { margin-right: 3mm; }

/* --- Présentation du dossier --------------------------------------------- */

.dp-presentation-bloc { width: 175.1mm; margin: 0 auto; }
.dp-presentation-bloc .dp-cadre { padding: 6mm 7mm; }
.dp-presentation-bloc p { margin-bottom: 3mm; text-align: justify; }
.dp-intertitre { font-weight: 700; font-size: 14pt; margin: 5mm 0 3mm; }
.dp-source {
  text-align: right;
  font-style: italic;
  font-size: 9pt;
  color: var(--dp-gris-pied);
  margin-top: 3mm;
}
.dp-lien-officiel { display: flex; align-items: center; gap: 3mm; margin-top: 6mm; }
.dp-lien-officiel b { font-size: 14pt; }
.dp-lien-officiel .dp-repere { border-left-width: 4mm; border-top-width: 2.5mm; border-bottom-width: 2.5mm; }

/* --- Sommaire ------------------------------------------------------------ */

.dp-sommaire-titre {
  font-weight: 700;
  font-size: 24pt;
  color: var(--dp-magenta);
  border-bottom: 3pt solid var(--dp-magenta);
  padding-bottom: 1mm;
  margin-bottom: 5mm;
}
.dp-sommaire-section { font-weight: 700; font-size: 14pt; margin-bottom: 4mm; }
.dp-sommaire-at {
  background: var(--dp-gris-clair);
  border-left: 2.25pt solid var(--dp-magenta);
  font-weight: 700;
  font-size: 12pt;
  padding: 2mm 3mm;
  margin: 5mm 0 2mm;
}
.dp-sommaire-ligne { display: flex; align-items: baseline; gap: 2mm; padding: 1.6mm 0 1.6mm 4mm; }
.dp-sommaire-intitule { flex: 1 1 auto; min-width: 0; }
.dp-sommaire-intitule i { font-weight: 700; }
.dp-sommaire-vide { color: #9a9a9a; font-style: italic; }
.dp-sommaire-page { white-space: nowrap; }
/* Case carrée du modèle, à droite de chaque ligne. Décorative : sa fonction
   n'est pas documentée, lui donner un champ reviendrait à inventer une donnée. */
.dp-sommaire-case {
  flex: 0 0 auto;
  width: 4.5mm;
  height: 4.5mm;
  border: 1pt solid var(--dp-filet);
}
.dp-sommaire-fixe { margin-top: 6mm; }
.dp-sommaire-fixe .dp-sommaire-ligne { font-weight: 700; font-size: 12pt; padding-left: 0; }

/* --- Intercalaire -------------------------------------------------------- */

.dp-intercalaire {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 700;
  font-size: 48pt;
  line-height: 1.1;
}
```

- [ ] **Étape 2 : écrire les quatre rubriques du gabarit**

Dans `js/views/dp-gabarit.js`, remplacer les imports et les fonctions `blocCouverture`,
`blocPresentation`, `blocSommaire` et `blocSeparateur` par ce qui suit. Garder les fonctions
`entete`, `pied` et `feuille` de la tâche 2, ainsi que `escapeHtml`.

```javascript
import { rubriquesImprimees, rubriquesEdition, sommaire, cleExemple } from "../dp-rules.js?v=20260826d";

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
function rubriqueSommaire(data, pages) {
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
```

- [ ] **Étape 3 : assembler le flux, sans les fiches d'exemple pour l'instant**

Ajouter à la fin de `js/views/dp-gabarit.js`, en remplacement de `buildDpHTML` :

```javascript
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
      case "sommaire":     return rubriqueSommaire(data, pages);
      case "intercalaire": return rubriqueIntercalaire();
      case "exemple":      return rubriqueExemple(r.at, r.n, r.imprime !== false);
      case "titres":       return rubriqueTitres();
      case "declaration":  return rubriqueDeclaration();
      default:             return "";
    }
  }).join("");
}
```

`rubriqueExemple`, `rubriqueTitres` et `rubriqueDeclaration` arrivent aux tâches 5 et 6.
Pour que cette tâche reste vérifiable seule, ajouter provisoirement, juste avant
`buildDpFlux` :

```javascript
// Provisoire, remplacé en tâches 5 et 6.
function rubriqueExemple(at, n) { return bloc(`<p>Fiche ${at}.${n}</p>`, { cle: `exemple:${at}:${n}`, ouvrant: true }); }
function rubriqueTitres() { return bloc(`<p>Titres</p>`, { cle: "titres", ouvrant: true }); }
function rubriqueDeclaration() { return bloc(`<p>Déclaration</p>`, { cle: "declaration", ouvrant: true }); }
```

- [ ] **Étape 4 : vérifier au banc**

Dans `_preview_dp_moteur.html`, remplacer le contenu de `flux.innerHTML` et la ligne
`flux.querySelector(".dp-zone").textContent = MOTS;` par :

```javascript
    const { buildDpFlux } = await import(`./js/views/dp-gabarit.js?cb=${cb}`);
    flux.innerHTML = buildDpFlux({}, { edition: false });
```

Recharger `http://localhost:8000/_preview_dp_moteur.html`.

Attendu : la composition produit au moins 8 feuilles, aucune ne déborde, la numérotation est
continue. Contrôler à l'œil, par capture d'écran, les quatre premières feuilles :

- couverture : logo en en-tête, quatre libellés magenta en italique avec leur barre et leur
  repère, bandeau magenta « Titre professionnel visé », titre centré, encadré « Modalité
  d'accès » avec deux cases ;
- présentation : bandeau magenta, texte justifié, listes à repères magenta, mention de
  l'arrêté en italique gris à droite, adresse du site en gras ;
- sommaire : titre magenta souligné, deux bandeaux gris d'activité-type, lignes avec repère,
  numéro de page et case carrée à droite ;
- intercalaire : « Exemples de pratique professionnelle » en très gros, centré verticalement.

- [ ] **Étape 5 : commit**

```bash
git add js/views/dp-gabarit.js css/dp.css _preview_dp_moteur.html
git commit -m "DP : couverture, presentation, sommaire et intercalaire a l'habillage officiel

Bandeaux magenta, reperes triangulaires dessines en CSS, bloc d'identite a
barre magenta, sommaire a cases carrees. Le gabarit produit desormais un flux
de blocs, plus des pages figees.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 5 : la fiche d'exemple de pratique professionnelle

La rubrique la plus travaillée du modèle, et la seule dont les blocs sont sécables.

**Fichiers :**
- Modifier : `js/views/dp-gabarit.js`
- Modifier : `css/dp.css`

**Interfaces :**
- Consomme : `bloc`, `f`, `cleExemple`, `AT1_TITRE`, `AT2_TITRE`.
- Produit : `rubriqueExemple(at: number, n: number, imprime: boolean): string`, qui remplace
  la version provisoire de la tâche 4.

- [ ] **Étape 1 : écrire les styles de la fiche**

Ajouter à `css/dp.css`, après la section « Intercalaire » :

```css
/* --- Fiche d'exemple de pratique professionnelle -------------------------- */

/* Le modèle donne 182,6 mm à cette fiche pour une zone utile de 167 mm : elle
   déborde volontairement dans les marges, et c'est ce débordement qui lui donne
   sa largeur caractéristique. */
.dp-fiche { width: 182.6mm; margin-left: -0.6mm; }

.dp-at { display: flex; align-items: flex-end; gap: 3mm; margin-bottom: 1mm; }
.dp-at-num {
  flex: 0 0 52mm;
  text-align: right;
  font-weight: 700;
  font-size: 18pt;
  color: var(--dp-magenta);
}
.dp-at-titre { flex: 1 1 auto; min-width: 0; font-weight: 700; font-size: 12pt; }

.dp-ex-ligne {
  display: flex;
  align-items: baseline;
  gap: 2mm;
  padding: 2mm 0;
  /* Double filet du modèle : un trait fin, un intervalle, un trait épais. */
  border-bottom: 3pt double var(--dp-magenta);
  margin-bottom: 5mm;
}
.dp-ex-num { flex: 0 0 52mm; text-align: right; font-weight: 700; font-style: italic; }
.dp-ex-titre { flex: 1 1 auto; min-width: 0; }

.dp-question {
  font-weight: 700;
  border-left: 3pt solid var(--dp-magenta);
  border-bottom: 1pt solid var(--dp-magenta);
  padding: 1mm 0 1mm 2.5mm;
  margin-top: 5mm;
}
/* Zone de rédaction : cadre du modèle, hauteur nominale généreuse. Le moteur la
   coupe entre deux lignes quand elle dépasse la feuille ; jamais de texte perdu. */
.dp-doc .dp-zone {
  box-sizing: border-box;
  min-height: 30mm;
  border: 1pt solid var(--dp-cadre);
  border-top: none;
  padding: 2mm;
  white-space: pre-wrap;
}
.dp-doc .dp-zone.dp-zone-petite { min-height: 16mm; }

/* Tableau de contexte de la question 4 */
.dp-contexte { border: 1pt solid var(--dp-cadre); border-top: none; }
.dp-contexte-ligne { display: flex; align-items: baseline; gap: 2mm; padding: 2mm; }
.dp-contexte-ligne + .dp-contexte-ligne { border-top: 0.5pt solid var(--dp-filet); }
.dp-contexte-label { flex: 0 0 70mm; }
.dp-contexte-champ { flex: 1 1 auto; min-width: 0; }
.dp-periode { display: flex; align-items: baseline; gap: 2mm; flex-wrap: wrap; }
.dp-periode .lv-f { min-width: 28mm; }
```

- [ ] **Étape 2 : écrire la fiche**

Dans `js/views/dp-gabarit.js`, remplacer la fonction provisoire `rubriqueExemple` par :

```javascript
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
```

La zone de rédaction n'est volontairement pas produite par `bloc()` : elle est à la fois un
bloc du flux et un champ de saisie, donc elle cumule `data-cle`, `data-nature` et `data-k`.

- [ ] **Étape 3 : vérifier au banc**

Recharger `http://localhost:8000/_preview_dp_moteur.html`.

Attendu, en plus des contrôles déjà verts : les fiches d'exemple s'affichent avec leur
cartouche magenta « Activité-type 1 » aligné à droite, l'intitulé de l'activité en gras à
côté, la ligne « Exemple n°1 » soulignée d'un double filet magenta, les cinq questions en
gras avec barre magenta à gauche et filet magenta dessous, et les zones encadrées en gris.

Ajouter dans le banc, après les contrôles existants, un contrôle de texte long :

```javascript
    // Une fiche remplie d'un texte plus long qu'une feuille doit se répartir
    // sans rien perdre, comme le fait Word.
    const LONG = Array.from({ length: 700 }, (_, i) => `mot${i}`).join(" ");
    const flux2 = document.createElement("div");
    flux2.className = "dp-doc dp-flux";
    flux2.style.cssText = "position:absolute;left:-20000px";
    flux2.innerHTML = buildDpFlux({ at1_ex1_taches: LONG }, { edition: false });
    document.body.appendChild(flux2);
    flux2.querySelector('[data-k="at1_ex1_taches"]').textContent = LONG;
    const hote2 = document.createElement("div");
    hote2.className = "dp-doc";
    hote2.style.cssText = "position:absolute;left:-20000px";
    document.body.appendChild(hote2);
    const res2 = composer([...flux2.children].filter((n) => n.classList.contains("dp-bloc")), {
      hote: hote2,
      fabriquerFeuille: (numero, couv) => {
        const d = document.createElement("div");
        d.innerHTML = feuille("", numero, couv);
        return d.firstElementChild;
      },
    });
    const recompose = [...hote2.querySelectorAll(".dp-zone")]
      .map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
    dire(recompose.includes(LONG.slice(0, 200)) && recompose.includes(LONG.slice(-200)),
      `fiche longue : début et fin du texte présents après composition sur ${res2.feuilles} feuilles`);
    const debordent2 = [...hote2.querySelectorAll(".dp-corps")]
      .filter((c) => c.scrollHeight > c.clientHeight + 1).length;
    dire(debordent2 === 0, `fiche longue : feuilles en débordement ${debordent2} (attendu 0)`);
```

Attendu : les deux nouvelles lignes du rapport sont en `OK`, et `res2.feuilles` dépasse le
nombre de feuilles du dossier vierge, preuve que la fiche longue s'est étalée.

- [ ] **Étape 4 : commit**

```bash
git add js/views/dp-gabarit.js css/dp.css _preview_dp_moteur.html
git commit -m "DP : fiche d'exemple a l'habillage officiel, zones secables

Cartouche activite-type magenta, double filet sous la ligne Exemple, questions
a barre magenta, tableau de contexte. Les zones de redaction sont les seuls
blocs que le moteur a le droit de couper.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 6 : titres et diplômes, déclaration sur l'honneur

Les deux dernières rubriques. Le document s'arrête là, comme le modèle.

**Fichiers :**
- Modifier : `js/views/dp-gabarit.js`
- Modifier : `css/dp.css`

**Interfaces :**
- Consomme : `bloc`, `f`, `PH_DATE`, `PH_TEXTE`.
- Produit : `rubriqueTitres(): string` et `rubriqueDeclaration(): string`, qui remplacent les
  versions provisoires de la tâche 4. Le gabarit exporte en plus
  `blocSommaire(data: object, pages: Map<string, number> | null): string`, dont la vue a
  besoin pour rafraîchir le seul sommaire sans reconstruire le flux.

- [ ] **Étape 1 : écrire les styles**

Ajouter à `css/dp.css`, après la section « Fiche d'exemple » :

```css
/* --- Titres, diplômes, CQP, attestations de formation --------------------- */

.dp-titres-bloc { width: 172.6mm; margin: 0 auto; }
.dp-titres-sous { text-align: center; font-style: italic; font-size: 14pt; padding: 5mm 0 6mm; }
.dp-tbl-titres { border: 0.5pt solid var(--dp-texte); }
.dp-tbl-titres th, .dp-tbl-titres td { border: 0.5pt solid var(--dp-texte); }
.dp-tbl-titres th {
  background: var(--dp-gris-clair);
  font-weight: 700;
  font-size: 14pt;
  text-align: center;
  padding: 2mm;
}
.dp-tbl-titres td { height: 9mm; }
.dp-col-intitule { width: 40mm; }
.dp-col-organisme { width: 85.1mm; }
.dp-col-date { width: 47.5mm; }

/* --- Déclaration sur l'honneur -------------------------------------------- */

.dp-declaration-bloc { width: 175.1mm; margin: 0 auto; }
.dp-declaration-corps { padding: 14mm 4mm 0; font-size: 12pt; line-height: 2; }
.dp-declaration-corps p { margin-bottom: 4mm; }
.dp-declaration-corps .lv-f { min-width: 60mm; border-bottom: 0.3pt dotted var(--dp-cadre); }
.dp-signature { margin-top: 16mm; }
```

- [ ] **Étape 2 : écrire les deux rubriques**

Dans `js/views/dp-gabarit.js`, remplacer les fonctions provisoires `rubriqueTitres` et
`rubriqueDeclaration` par :

```javascript
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
```

- [ ] **Étape 3 : exporter le bloc sommaire**

La vue doit pouvoir rafraîchir le seul sommaire quand la pagination change, sans reconstruire
le flux et sans déplacer le curseur du candidat. Remplacer la déclaration de
`rubriqueSommaire` par une fonction exportée, et adapter son appel dans `buildDpFlux` :

Il s'agit d'un simple renommage avec export : le corps de la fonction, écrit en tâche 4, ne
change pas d'une ligne. Remplacer sa signature

```javascript
function rubriqueSommaire(data, pages) {
```

par

```javascript
// Exporté : la vue remplace ce seul bloc quand la pagination change, plutôt que
// de reconstruire tout le flux, ce qui ferait sauter le curseur du candidat.
export function blocSommaire(data, pages) {
```

Dans `buildDpFlux`, remplacer `case "sommaire": return rubriqueSommaire(data, pages);` par
`case "sommaire": return blocSommaire(data, pages);`.

- [ ] **Étape 4 : vérifier au banc**

Recharger `http://localhost:8000/_preview_dp_moteur.html`.

Attendu : le dossier vierge compose exactement **8 feuilles**, une par rubrique, dans l'ordre
couverture, présentation, sommaire, intercalaire, fiche 1.1, fiche 2.1, titres, déclaration.

Le modèle Word, lui, fait 9 pages : il ne porte qu'une seule activité-type, avec ses trois
fiches. L'app en génère deux, une par activité-type, et n'imprime d'office que la fiche n°1
de chacune. Huit rubriques, donc huit feuilles. Ne pas chercher à retrouver le compte du
modèle : c'est le même document, appliqué à un titre qui a deux activités-types.

Une neuvième feuille signalerait qu'une rubrique déborde alors qu'elle est vide, donc que les
hauteurs nominales des zones sont trop généreuses. Dans ce cas, réduire `min-height` de
`.dp-zone` jusqu'à ce qu'une fiche vide tienne sur sa feuille.

Ajouter ce contrôle au banc, après les contrôles existants :

```javascript
    const ordre = [...hote.querySelectorAll(".dp-feuille")].map((f) =>
      f.querySelector(".dp-bandeau, .dp-sommaire-titre, .dp-intercalaire, .dp-at-num, .dp-identite-label")
        ?.textContent.trim().slice(0, 28) || "(suite)");
    dire(res.feuilles === 8, `dossier vierge : ${res.feuilles} feuilles (attendu 8)`);
    lignes.push("   ordre : " + ordre.join(" | "));
```

Contrôler à l'œil : tableau des titres à 10 lignes avec en-tête gris et colonnes aux bonnes
largeurs, déclaration en interligne double avec la ligne de signature en bas.

- [ ] **Étape 5 : commit**

```bash
git add js/views/dp-gabarit.js css/dp.css _preview_dp_moteur.html
git commit -m "DP : titres et diplomes, declaration sur l'honneur

Le document s'arrete a la declaration, comme le modele officiel. Le bloc
sommaire devient exportable pour un rafraichissement isole.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 7 : brancher la vue sur le moteur

La vue orchestre les trois modes : édition en flux, consultation paginée, impression paginée.

**Fichiers :**
- Modifier : `js/views/dp.js`
- Modifier : `js/doc-officiel.js` (ajout d'un seul point d'extension)
- Modifier : `css/dp.css`
- Réécrire : `_preview_dp.html`
- Supprimer : `_preview_dp_chassis.html`, `_preview_dp_moteur.html`

**Interfaces :**
- Consomme : `buildDpFlux`, `blocSommaire`, `feuille` (tâches 2, 4, 5, 6) ; `composer`,
  `marquerCoupures` (tâche 3) ; `exempleImprime` (tâche 1).
- Produit : `renderDp(container, opts)` conserve sa signature actuelle.
  `bindDocPrint(doc, {printId, bodyClass, avantClone?})` gagne une option facultative.

- [ ] **Étape 1 : ajouter le point d'extension au noyau des documents officiels**

Dans `js/doc-officiel.js`, remplacer la fonction `bindDocPrint` et le début de
`refreshDocPrint` par :

```javascript
// avantClone : rappel facultatif, exécuté juste avant le clonage. Le DP s'en
// sert pour recomposer son document paginé, qui n'est pas celui affiché quand le
// candidat est en train d'écrire. Absente, l'option ne change rien : le livret
// EPCF continue de cloner son document tel quel.
export function bindDocPrint(doc, { printId, bodyClass, avantClone = null }) {
  courant = { doc, printId, bodyClass, avantClone };
  ensurePrintListeners();
  refreshDocPrint();
}

export function refreshDocPrint() {
  if (!courant) return;
  const { doc, printId, bodyClass, avantClone } = courant;
  if (avantClone) avantClone();
```

Le reste de `refreshDocPrint` est inchangé.

Dans `teardownDocPrint`, ajouter le nettoyage du conteneur hors écran du DP, juste avant
`document.getElementById("doc-officiel-page-style")?.remove();` :

```javascript
  document.getElementById("dp-hors-ecran")?.remove();
```

- [ ] **Étape 2 : ajouter le style du conteneur hors écran**

Dans `css/dp.css`, remplacer la règle `#dp-compose` écrite en tâche 3 par :

```css
/* Conteneur hors écran : il porte le document de mesure et le document composé
   prêt à imprimer. Il est POSITIONNÉ hors de l'écran, jamais masqué : un
   display:none n'a pas de mise en page, et visibility:hidden rend les
   rectangles de ligne peu fiables selon les navigateurs. La composition a
   besoin des deux. */
#dp-hors-ecran {
  position: absolute;
  left: -20000px;
  top: 0;
  width: 210mm;
  pointer-events: none;
}
```

Le conteneur ne porte aucune classe stylée : le clone d'impression, qui recopie classes et
identifiants, ne doit surtout pas hériter de ce déplacement.

- [ ] **Étape 3 : réécrire la vue**

Dans `js/views/dp.js`, remplacer les imports du gabarit et des règles par :

```javascript
import { buildDpFlux, blocSommaire, feuille } from "./dp-gabarit.js?v=20260826d";
import { exempleImprime } from "../dp-rules.js?v=20260826d";
import { composer, marquerCoupures } from "../dp-pagination.js?v=20260826d";
```

Puis remplacer tout le corps de `showDoc`, depuis la ligne `const doc = el("div", …)` jusqu'à
la fin de la fonction, par :

```javascript
  // À l'écran : en édition le candidat écrit dans un flux continu, en
  // consultation le document est déjà composé en feuilles. Dans les deux cas,
  // c'est le document composé qui s'imprime.
  const doc = el("div", { class: "dp-doc dp-screen" + (readOnly ? "" : " dp-edit") });
  const scaleInner = el("div", { class: "dp-scale" }, doc);
  const scaleOuter = el("div", { class: "dp-scale-outer" }, scaleInner);
  container.appendChild(scaleOuter);

  // Conteneur hors écran : document de mesure et document composé. Il est retiré
  // par teardownDocPrint au changement de route.
  document.getElementById("dp-hors-ecran")?.remove();
  const mesure = el("div", { class: "dp-doc" });
  const pourImpression = el("div", { class: "dp-doc" });
  const horsEcran = el("div", { id: "dp-hors-ecran", "aria-hidden": "true" }, mesure, pourImpression);
  document.body.appendChild(horsEcran);

  const fabriquerFeuille = (numero, estCouverture) => {
    const d = document.createElement("div");
    d.innerHTML = feuille("", numero, estCouverture);
    return d.firstElementChild;
  };
  const blocsDe = (flux) => [...flux.children].filter((n) => n.classList.contains("dp-bloc"));

  // Un flux détaché du document : la composition clone ses blocs dans les
  // feuilles et ne mesure que les clones, le flux source n'a pas à être rendu.
  function fluxDetache(html) {
    const f = document.createElement("div");
    f.className = "dp-flux";
    f.innerHTML = html;
    fillData(f, data);
    return f;
  }

  // Compose le document imprimable dans `pourImpression`, et renvoie le numéro
  // de feuille de chaque rubrique. Deux passes : la première donne les numéros,
  // la seconde les inscrit au sommaire. Elle converge toujours, un numéro de
  // page ne changeant pas la hauteur de la ligne qui le porte.
  function composerImprimable() {
    const passe1 = composer(blocsDe(fluxDetache(buildDpFlux(data, { edition: false }))),
      { hote: mesure, fabriquerFeuille });
    const flux2 = fluxDetache(buildDpFlux(data, { edition: false, pages: passe1.numeroParCle }));
    const passe2 = composer(blocsDe(flux2), { hote: pourImpression, fabriquerFeuille });
    mesure.textContent = "";
    return passe2.numeroParCle;
  }

  let fluxEdition = null;
  // Les écouteurs de wireDocEditing sont posés en DÉLÉGATION sur `doc` : ils
  // survivent au remplacement de son contenu et ne doivent donc être posés
  // qu'une fois, sinon une frappe déclencherait N enregistrements.
  let editionCablee = false;

  function rendre() {
    const pages = composerImprimable();
    if (readOnly) {
      clear(doc);
      [...pourImpression.children].forEach((f) => doc.appendChild(f.cloneNode(true)));
    } else {
      fluxEdition = el("div", { class: "dp-flux" });
      fluxEdition.innerHTML = buildDpFlux(data, { edition: true, pages });
      clear(doc);
      doc.appendChild(fluxEdition);
      fillData(doc, data);
      if (!editionCablee) { wireDocEditing(doc, onEdit); editionCablee = true; }
      else applyEditable(doc);
      majCoupures();
    }
    bindDocPrint(readOnly ? doc : pourImpression,
      { printId: "dp-print", bodyClass: "dp-printable", avantClone: readOnly ? null : rafraichirImprimable });
    requestAnimationFrame(rescale);
  }

  // Recompose le document imprimable sans toucher à ce que voit le candidat.
  function rafraichirImprimable() {
    const pages = composerImprimable();
    if (fluxEdition) {
      const ancien = fluxEdition.querySelector('[data-cle="sommaire"]');
      if (ancien) {
        const tmp = document.createElement("div");
        tmp.innerHTML = blocSommaire(data, pages);
        ancien.replaceWith(tmp.firstElementChild);
      }
    }
  }

  // Marque dans le ruban d'édition les endroits où le document changera de
  // feuille. On ne coupe rien : un champ réparti sur deux feuilles ne serait
  // plus éditable.
  function majCoupures() {
    if (!fluxEdition) return;
    const r = composer(blocsDe(fluxEdition), { hote: mesure, fabriquerFeuille });
    mesure.textContent = "";
    marquerCoupures(fluxEdition, r.numeroParBloc);
  }

  // Une fiche qui passe de vide à remplie, ou l'inverse, change seulement son
  // apparence et sa mention : le flux, lui, ne bouge pas. C'est ce qui garantit
  // que le curseur ne saute jamais pendant la frappe.
  function majExclusions() {
    if (!fluxEdition) return;
    for (const at of [1, 2]) {
      for (const n of [1, 2, 3]) {
        const exclu = !exempleImprime(data, at, n);
        fluxEdition.querySelectorAll(`[data-cle="exemple:${at}:${n}"]`)
          .forEach((b) => b.classList.toggle("dp-bloc-exclu", exclu));
        const m = fluxEdition.querySelector(`[data-cle="exemple:${at}:${n}"] .dp-mention-exclu`);
        if (m) m.hidden = !exclu;
      }
    }
  }

  let repaginationTimer = null;
  function onEdit() {
    // collectData est la source de vérité : il omet les champs vides, donc vider
    // un champ le retire bien de data.
    data = collectData(fluxEdition);
    majExclusions();
    scheduleSave();
    // La repagination attend une pause de frappe : elle mesure tout le document,
    // et rien ne justifie de la refaire à chaque caractère.
    clearTimeout(repaginationTimer);
    repaginationTimer = setTimeout(() => {
      if (!document.contains(doc)) return;
      rafraichirImprimable();
      majCoupures();
    }, 700);
  }

  rendre();
  window.addEventListener("resize", rescale);
```

Conserver ensuite, sans changement, tout le bloc d'enregistrement automatique existant
(`saveNow`, `scheduleSave`, les variables `saveTimer`, `saving`, `pendingAgain`), à ceci
près : dans `scheduleSave`, supprimer le bloc `cloneTimer`, devenu inutile puisque
`rafraichirImprimable` s'en charge. Supprimer aussi la déclaration `let cloneTimer = null;`.

Dans `saveNow`, remplacer `data: collectData(doc)` par `data: collectData(fluxEdition)`.

- [ ] **Étape 4 : supprimer le code devenu mort**

Supprimer de `js/views/dp.js` les fonctions `marquerDebordements` et `placerCurseurEnFin`,
ainsi que leurs appels : le débordement n'existe plus, le texte est réparti, et le curseur ne
bouge plus puisque le flux n'est jamais reconstruit.

Supprimer de `css/dp.css` les règles devenues sans objet si elles subsistent :
`.dp-deborde`, `.dp-deborde-note`, `.dp-page`, `.dp-page-exclue`, `.dp-foot-exclu`,
`.dp-separateur`, `.dp-head`, `.dp-foot`, `.dp-h1`, `.dp-h2`, `.dp-cover-logo`,
`.dp-cover-table`, `.dp-cover-label`, `.dp-somm-ligne`, `.dp-somm-titre`, `.dp-somm-vide`,
`.dp-somm-page`, `.dp-tbl-borde`, `.dp-at-num` ancienne version, `.dp-ex-num` ancienne
version.

- [ ] **Étape 5 : réécrire le banc d'essai**

Remplacer `_preview_dp.html` par :

```html
<!DOCTYPE html>
<!-- Banc d'essai du Dossier Professionnel. Non déployé, jamais lié depuis l'app.
     Rend le document seul, sans authentification, pour contrôler la composition
     en feuilles, le sommaire, la coupe des textes longs et l'impression. -->
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Banc d'essai · Dossier Professionnel</title>
  <!-- Cache-buster : sur une branche de feature le token ?v= est figé, le
       navigateur resservirait un CSS et des modules périmés. -->
  <script>
    window.__cssPrete = Promise.all(["css/livret.css", "css/dp.css"].map((f) => new Promise((ok) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = `${f}?cb=${Date.now()}`;
      l.onload = l.onerror = ok;
      document.head.appendChild(l);
    })));
  </script>
  <style>
    body { margin: 20px; background: #e8e8e4; font-family: sans-serif; }
    .barre { margin-bottom: 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    #rapport { font-size: 13px; white-space: pre-line; margin-bottom: 12px; }
    #rapport.ok { color: #2f6f3e; } #rapport.ko { color: #b00020; font-weight: 700; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { margin: 0; background: #fff; }
      .barre, #rapport { display: none; }
      .dp-feuille { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
      .dp-feuille:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="barre">
    <strong>Banc d'essai Dossier Professionnel</strong>
    <button id="vierge">Dossier vierge</button>
    <button id="temoin">Données témoin</button>
    <button id="long">Texte très long</button>
    <button id="imprimer">Imprimer</button>
  </div>
  <div id="rapport">composition en cours</div>
  <div id="hote"></div>
  <script type="module">
    const cb = Date.now();
    const { buildDpFlux, feuille } = await import(`./js/views/dp-gabarit.js?cb=${cb}`);
    const { composer } = await import(`./js/dp-pagination.js?cb=${cb}`);
    const { fillData } = await import(`./js/doc-officiel.js?cb=${cb}`);
    await window.__cssPrete;

    const LONG = Array.from({ length: 700 }, (_, i) => `mot${i}`).join(" ");
    const TEMOIN = {
      nom_naissance: "MARTIN", nom_usage: "MARTIN", prenom: "Camille",
      adresse: "12 rue des Oliviers, 30000 Nîmes",
      modalite_formation: true,
      at1_ex1_titre: "Leçon de conduite en circulation dense",
      at1_ex1_taches: "Préparation de la séance, briefing, conduite commentée, bilan.",
      at1_ex1_moyens: "Véhicule double commande, fiche de suivi, livret d'apprentissage.",
      at1_ex1_avec_qui: "L'élève, sous supervision du formateur référent.",
      at1_ex1_entreprise: "Auto-école ECF Nîmes",
      at1_ex1_du: "02/03/2026", at1_ex1_au: "27/06/2026",
      at2_ex1_titre: "Animation d'une action de sensibilisation",
      at2_ex1_taches: "Préparation du support, animation devant 18 personnes, échanges.",
      dh_nom: "Camille MARTIN", dh_fait_a: "Nîmes", dh_le: "14/09/2026",
      titre1_intitule: "BEPECASER", titre1_organisme: "DDT du Gard", titre1_date: "12/06/2019",
    };

    const hote = document.getElementById("hote");
    const mesure = document.createElement("div");
    mesure.className = "dp-doc";
    mesure.style.cssText = "position:absolute;left:-20000px;top:0;width:210mm";
    document.body.appendChild(mesure);

    const fabriquerFeuille = (numero, couv) => {
      const d = document.createElement("div");
      d.innerHTML = feuille("", numero, couv);
      return d.firstElementChild;
    };
    const blocsDe = (flux) => [...flux.children].filter((n) => n.classList.contains("dp-bloc"));
    function fluxDetache(html, data) {
      const f = document.createElement("div");
      f.className = "dp-flux";
      f.innerHTML = html;
      fillData(f, data);
      return f;
    }

    function rendre(data) {
      const p1 = composer(blocsDe(fluxDetache(buildDpFlux(data, { edition: false }), data)),
        { hote: mesure, fabriquerFeuille });
      const doc = document.createElement("div");
      doc.className = "dp-doc dp-screen";
      hote.replaceChildren(doc);
      const p2 = composer(blocsDe(fluxDetache(buildDpFlux(data, { edition: false, pages: p1.numeroParCle }), data)),
        { hote: doc, fabriquerFeuille });
      mesure.textContent = "";
      controler(doc, p2, data);
    }

    function controler(doc, res, data) {
      const l = [];
      const dire = (ok, texte) => l.push(`${ok ? "OK  " : "KO  "}${texte}`);

      const numeros = [...doc.querySelectorAll(".dp-pied")]
        .map((p) => Number(p.innerText.match(/Page (\d+)/)[1]));
      dire(numeros.every((n, i) => n === i + 1), `numérotation continue : ${numeros.length} feuilles`);

      const debordent = [...doc.querySelectorAll(".dp-corps")]
        .filter((c) => c.scrollHeight > c.clientHeight + 1).length;
      dire(debordent === 0, `feuilles en débordement : ${debordent} (attendu 0)`);

      // Le sommaire annonce exactement les pages où commencent les fiches.
      let sommaireJuste = true;
      const details = [];
      res.numeroParCle.forEach((numero, cle) => {
        if (!cle.startsWith("exemple:")) return;
        const [, at, n] = cle.split(":");
        const ligne = [...doc.querySelectorAll(".dp-sommaire-ligne")]
          .find((el) => el.textContent.includes(`Exemple n°${n}`)
                     && el.closest(".dp-corps").textContent.indexOf(`Exemple n°${n}`) >= 0);
        const annonce = ligne ? Number((ligne.querySelector(".dp-sommaire-page").textContent.match(/\d+/) || [0])[0]) : 0;
        details.push(`AT${at} ex${n} : sommaire ${annonce}, réel ${numero}`);
        if (annonce !== numero) sommaireJuste = false;
      });
      dire(sommaireJuste, "sommaire concordant avec les pieds de page");
      details.forEach((d) => l.push("   " + d));

      // Aucun texte perdu : chaque champ rempli se retrouve dans le document.
      const texte = doc.textContent.replace(/\s+/g, " ");
      const perdus = Object.entries(data)
        .filter(([, v]) => typeof v === "string" && v.length > 12)
        .filter(([, v]) => !texte.includes(v.slice(0, 40).replace(/\s+/g, " ")))
        .map(([k]) => k);
      dire(perdus.length === 0, `champs absents du document : ${perdus.join(", ") || "aucun"}`);

      // Le document composé n'est jamais une source de données.
      dire(doc.querySelectorAll(".dp-zone[data-k]").length >= 0, "zones présentes");

      const r = document.getElementById("rapport");
      r.textContent = l.join("\n");
      r.className = l.some((x) => x.startsWith("KO")) ? "ko" : "ok";
    }

    document.getElementById("vierge").onclick = () => rendre({});
    document.getElementById("temoin").onclick = () => rendre(TEMOIN);
    document.getElementById("long").onclick = () => rendre({ ...TEMOIN, at1_ex1_taches: LONG });
    document.getElementById("imprimer").onclick = () => window.print();
    rendre({});
  </script>
</body>
</html>
```

Supprimer les deux bancs temporaires :

```bash
git rm _preview_dp_chassis.html _preview_dp_moteur.html
```

- [ ] **Étape 6 : vérifier au banc**

Ouvrir `http://localhost:8000/_preview_dp.html` et passer les trois boutons.

Attendu, pour chacun :
- toutes les lignes du rapport en `OK` ;
- « Dossier vierge » : 8 feuilles, une par rubrique ;
- « Données témoin » : le sommaire concorde, les intitulés saisis apparaissent, aucun champ
  perdu ;
- « Texte très long » : le nombre de feuilles augmente, la fiche concernée s'étale sur
  plusieurs feuilles, chacune avec son en-tête et son pied, et le sommaire reste juste.

Cliquer « Imprimer » et contrôler l'aperçu : A4 portrait, une feuille par page, aucune page
blanche, aucun « Cliquez ici » sur les champs vides.

- [ ] **Étape 7 : vérifier l'édition dans l'app**

Ouvrir `http://localhost:8000/_preview_dp_vue.html`, le banc de la vue avec modules factices,
et contrôler :
- le dossier s'ouvre en flux continu, les champs sont saisissables ;
- taper un long texte dans la question 1 fait apparaître un trait de coupe après une seconde ;
- le curseur ne saute pas pendant la frappe ;
- remplir un champ de la fiche n°2 retire son fond gris et sa mention, et le sommaire gagne
  une ligne ;
- trois modifications successives déclenchent exactement trois enregistrements, pas neuf.

Si `_preview_dp_vue.html` ne charge plus, l'adapter en remplaçant les appels à `buildDpHTML`
par `buildDpFlux` et en suivant le même schéma de composition que `_preview_dp.html`.

- [ ] **Étape 8 : commit**

```bash
git add -A js/views/dp.js js/doc-officiel.js css/dp.css _preview_dp.html _preview_dp_vue.html
git commit -m "DP : la vue compose le document en feuilles

Edition en flux continu avec traits de coupe, consultation et impression sur
document compose. Le flux n'est jamais reconstruit pendant la frappe, donc le
curseur ne saute plus. bindDocPrint gagne un rappel avantClone, sans effet sur
le livret EPCF.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 8 : garantir qu'aucune donnée ne se perd

Le point non négociable. 11 stagiaires ont déjà écrit dans leur dossier, jusqu'à 11 669
caractères pour l'un d'eux.

**Fichiers :**
- Créer : `tests/dp-gabarit-cles.test.mjs`

**Interfaces :**
- Consomme : `buildDpFlux` de `js/views/dp-gabarit.js`.
- Produit : rien, c'est un test.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/dp-gabarit-cles.test.mjs` :

```javascript
// Le gabarit du DP doit continuer à produire TOUTES les clés de sérialisation
// déjà utilisées en production. Renommer ou oublier une clé ferait disparaître
// du texte déjà écrit par un stagiaire, sans erreur visible.
//
// Ce fichier ne contient que des NOMS de clés, relevés en base le 2026-09-14.
// Aucun contenu de dossier n'y figure.
import assert from "node:assert/strict";
import { buildDpFlux } from "../js/views/dp-gabarit.js";

const CHAMPS_EXEMPLE = ["titre", "taches", "moyens", "avec_qui",
                        "entreprise", "service", "du", "au", "complement"];

// Schéma complet attendu.
const ATTENDUES = [
  "nom_naissance", "nom_usage", "prenom", "adresse",
  "modalite_formation", "modalite_vae",
  "dh_nom", "dh_fait_a", "dh_le",
];
for (const at of [1, 2]) {
  for (const n of [1, 2, 3]) {
    for (const c of CHAMPS_EXEMPLE) ATTENDUES.push(`at${at}_ex${n}_${c}`);
  }
}
for (let i = 1; i <= 10; i++) {
  ATTENDUES.push(`titre${i}_intitule`, `titre${i}_organisme`, `titre${i}_date`);
}

// Clés effectivement observées en production le 2026-09-14, sous-ensemble du
// schéma. Elles sont listées à part : ce sont celles dont la perte se verrait
// tout de suite.
const OBSERVEES = [
  "adresse", "nom_naissance", "nom_usage", "prenom", "modalite_formation",
  "dh_nom", "dh_fait_a", "dh_le",
  "at1_ex1_titre", "at1_ex1_taches", "at1_ex1_moyens", "at1_ex1_avec_qui",
  "at1_ex1_entreprise", "at1_ex1_service", "at1_ex1_du", "at1_ex1_au", "at1_ex1_complement",
  "at1_ex2_titre", "at1_ex2_taches", "at1_ex2_moyens", "at1_ex2_avec_qui",
  "at1_ex2_entreprise", "at1_ex2_service", "at1_ex2_du", "at1_ex2_au", "at1_ex2_complement",
  "at1_ex3_titre", "at1_ex3_taches", "at1_ex3_moyens", "at1_ex3_avec_qui",
  "at1_ex3_entreprise", "at1_ex3_service", "at1_ex3_du", "at1_ex3_au", "at1_ex3_complement",
  "at2_ex1_titre", "at2_ex1_taches", "at2_ex1_moyens", "at2_ex1_avec_qui",
  "at2_ex1_entreprise", "at2_ex1_service", "at2_ex1_du", "at2_ex1_au", "at2_ex1_complement",
  "titre1_intitule", "titre1_organisme", "titre1_date",
  "titre2_intitule", "titre2_organisme", "titre2_date",
  "titre3_intitule", "titre3_organisme", "titre3_date",
  "titre4_intitule", "titre4_organisme", "titre4_date",
];

// En mode édition, les 6 fiches sont rendues : c'est le flux qui doit tout porter.
const html = buildDpFlux({}, { edition: true });
const produites = new Set([...html.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]));

for (const k of OBSERVEES) {
  assert.ok(produites.has(k), `clé déjà écrite en production et absente du gabarit : ${k}`);
}
for (const k of ATTENDUES) {
  assert.ok(produites.has(k), `clé du schéma absente du gabarit : ${k}`);
}
// Aucune clé en double : deux champs partageant une clé se recopieraient l'un
// l'autre à la saisie.
const liste = [...html.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]);
assert.equal(liste.length, new Set(liste).size, "une clé data-k est produite deux fois");
// Aucune clé inattendue : une clé nouvelle serait écrite en base sans être prévue.
for (const k of produites) {
  assert.ok(ATTENDUES.includes(k), `clé inconnue du schéma produite par le gabarit : ${k}`);
}

console.log(`dp-gabarit-cles : OK, ${produites.size} clés`);
```

- [ ] **Étape 2 : lancer le test**

```bash
node tests/dp-gabarit-cles.test.mjs
```

Attendu : `dp-gabarit-cles : OK, 75 clés`.

Si le test échoue sur une clé absente, corriger le gabarit, pas le test : la liste des clés
observées est un relevé de production, elle ne se négocie pas.

Si l'import échoue parce que `js/views/dp-gabarit.js` importe `../dp-rules.js?v=20260826d`,
vérifier que la version de node installée gère les paramètres de requête dans les
spécificateurs de module. `node --version` doit afficher 18 ou plus.

- [ ] **Étape 3 : rejouer tous les tests logiques du projet**

```bash
node tests/dp-rules.test.mjs
node tests/dp-gabarit-cles.test.mjs
node tests/nouveautes.test.mjs
node tests/creneaux-rules.test.mjs
node tests/passage-rules.test.mjs
```

Attendu : chacun affiche sa ligne de succès et sort en code 0.

- [ ] **Étape 4 : vérifier les non-régressions du livret EPCF et du planning**

Ouvrir `http://localhost:8000/_preview_livret.html`.

Attendu : le livret s'affiche comme avant, 10 pages portrait, bandeau magenta, logo, champs
saisissables, sélecteur de date, aucune erreur dans la console. La feuille `css/dp.css` ne
doit avoir aucun effet sur lui : si un style du DP a fui, c'est qu'une règle a été écrite sans
le préfixe `.dp-doc`.

Contrôler aussi que `css/dp.css` ne contient aucune règle `@page` :

```bash
grep -n "@page" css/dp.css
```

Attendu : aucune correspondance.

- [ ] **Étape 5 : commit**

```bash
git add tests/dp-gabarit-cles.test.mjs
git commit -m "DP : test de couverture des cles de serialisation

Verifie que le gabarit produit toutes les cles deja ecrites en production, sans
doublon ni cle inconnue. Le fichier ne contient que des noms de cles.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tâche 9 : documentation, nouveauté et vérification finale

**Fichiers :**
- Modifier : `js/nouveautes-data.js`
- Modifier : `PROJECT_NOTES.md`
- Créer : `docs/plans/2026-09-14-dp-verification-utilisateur.md`

**Interfaces :**
- Consomme : rien.
- Produit : rien de programmatique.

- [ ] **Étape 1 : écrire la nouveauté**

Ajouter en tête du tableau `NOUVEAUTES` dans `js/nouveautes-data.js` :

```javascript
  {
    id: "2026-09-14-dp-mise-en-page",
    date: "2026-09-14",
    pour: "tous",
    titre: "Le dossier professionnel a repris la mise en page officielle",
    resume: "Ton DP ressemble maintenant trait pour trait au document du ministère : "
          + "bandeaux magenta, en-tête et pied de page officiels, cartouches d'activité-type. "
          + "Surtout, quand un de tes textes dépasse la page, le document continue "
          + "proprement sur la feuille suivante au lieu de tout décaler, et le sommaire "
          + "annonce les bons numéros de page. Pendant que tu écris, un trait pointillé "
          + "te montre où le document changera de feuille. Rien de ce que tu avais déjà "
          + "saisi n'a bougé.",
    ou: { label: "Mon suivi, Dossier pro", route: "mon-suivi" },
  },
```

- [ ] **Étape 2 : mettre à jour les notes de projet**

Dans `PROJECT_NOTES.md`, remplacer la ligne qui décrit la composition du DP, repérable par :

```bash
grep -n "dp-rules.js" PROJECT_NOTES.md
```

par :

```markdown
- **Composition dans `js/dp-rules.js`** (logique pure, `node tests/dp-rules.test.mjs`) : 4 rubriques d'ouverture, jusqu'à 6 fiches d'exemple, 2 rubriques de fin. Une fiche vide n'est pas imprimée, **sauf la n°1 de chaque activité-type**. Les numéros de page ne sont plus calculés là : ils viennent de la pagination réelle.
- **Pagination dans `js/dp-pagination.js`** : le gabarit produit un flux de blocs, le moteur les mesure et les répartit en feuilles A4, en coupant les zones de rédaction entre deux lignes visuelles. En édition le flux n'est pas coupé, les coupures sont seulement matérialisées : un champ réparti sur deux feuilles ne serait plus éditable. Le document imprimé est toujours le document composé. Habillage relevé dans le .docx officiel, voir `docs/specs/2026-09-14-dp-mise-en-page-officielle-design.md`.
```

- [ ] **Étape 3 : écrire la liste de vérification utilisateur**

Créer `docs/plans/2026-09-14-dp-verification-utilisateur.md` :

```markdown
# Dossier Professionnel, mise en page officielle : ce qui reste à vérifier en session connectée

Tout ce qui pouvait être vérifié sans authentification l'a été, au banc et par les tests
logiques. Les points ci-dessous demandent une session réelle sur la base de production.

Lancer l'aperçu local depuis le worktree :

```bash
cd C:\Users\watch\Dev\ECSR\TP_ECSR_App-wt-dp-layout; .\dev.ps1
```

## À vérifier

| # | Vérification | Attendu |
|---|---|---|
| 1 | Ouvrir le dossier d'un stagiaire qui a déjà beaucoup écrit, par exemple celui de 11 669 caractères | Tout son texte est là, champ par champ. Comparer avec l'export de la base avant de conclure |
| 2 | Compter les feuilles de ce dossier | Plus que 8, et chaque feuille porte son en-tête et son pied avec un numéro continu |
| 3 | Vérifier le sommaire de ce dossier | Les numéros annoncés correspondent aux pieds de page réels |
| 4 | Saisir du texte, attendre une seconde | Statut « Modifié » puis « Enregistré », et un trait de coupe apparaît si la feuille est pleine |
| 5 | Recharger la page | La saisie est toujours là |
| 6 | Imprimer en PDF | A4 portrait, une feuille par page, aucune page blanche, aucun « Cliquez ici », bord droit des fiches non rogné |
| 7 | En tant que formateur, consulter le dossier d'un stagiaire | Document composé en feuilles, aucun champ modifiable |
| 8 | Aller sur Planning puis imprimer | Toujours A4 paysage, une seule page. C'est la non-régression la plus importante |
| 9 | Notes, Livret EPCF, ouvrir un livret et imprimer | Rendu identique au document officiel, 10 pages portrait |
| 10 | Sur iPhone, en navigation privée, ouvrir le DP et imprimer | Rendu portrait correct, police proche de Calibri |

Le point 6 mérite une attention particulière : le modèle officiel fait déborder les fiches
d'exemple de 15 mm dans la marge droite, il ne reste que 5 mm de blanc. Si une imprimante
rogne ce bord, réduire `.dp-fiche` de 182,6 mm à 177 mm dans `css/dp.css` en gardant le
retrait négatif, et le signaler comme écart assumé.
```

- [ ] **Étape 4 : relire le diff en entier**

```bash
git diff main --stat
git diff main -- css/dp.css | head -100
```

Contrôler qu'aucun tiret cadratin n'est entré dans le code :

```bash
git diff main | grep -c $'\u2014' || echo "aucun tiret cadratin"
```

Attendu : `aucun tiret cadratin`.

- [ ] **Étape 5 : commit**

```bash
git add js/nouveautes-data.js PROJECT_NOTES.md docs/plans/2026-09-14-dp-verification-utilisateur.md
git commit -m "DP : nouveaute, notes de projet et liste de verification

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Étape 6 : rendre la main**

Ne pas fusionner dans `main` et ne pas déployer. La mise en production suppose la liste de
vérification en session connectée, qui demande un compte réel, et l'arbitrage de
l'utilisateur sur le point 6. Résumer ce qui a été fait, ce qui reste à vérifier, et
attendre.
