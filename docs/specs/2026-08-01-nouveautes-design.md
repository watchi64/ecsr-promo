# Rubrique « Nouveautés » : design

> Spec validée le 2026-08-01. Branche `nouveautes`, worktree `TP_ECSR_App-wt-nouveautes`.

## Pourquoi

Chaque nouveauté de l'app est aujourd'hui relayée à la main sur WhatsApp. Le message pousse
bien l'information sur le moment, mais elle se perd ensuite dans le fil du groupe. Un stagiaire
qui découvre une fonctionnalité en retard n'a aucun endroit où la retrouver.

La rubrique est **complémentaire du message WhatsApp, elle ne le remplace pas**. Le message
reste le canal de notification, la rubrique devient la mémoire.

Public : la promo TP ECSR, des adultes en reconversion. Pas de vocabulaire technique, pas de
numéro de version, pas de nom de fichier.

## Décisions de cadrage

| Question | Décision |
|---|---|
| Qui rédige, quand | Claude, **pendant la session de dev**, dans le même commit que le code |
| Publication | Par le déploiement, pas d'action séparée |
| Stockage | **Fichier versionné** dans le repo. Pas de table Supabase, pas de RLS, pas d'éditeur admin |
| Emplacement | Section dans **Accueil** (les 3 dernières) + page `#/nouveautes` (tout) |
| Signal | **Pastille sur l'onglet Accueil** de la barre de navigation |
| Mémoire du lu | `localStorage`, liste des identifiants vus. Pas de table de lecture par utilisateur |
| Contenu | Titre, date, résumé court, « Où le trouver » cliquable, guide en étapes facultatif |
| Audience | Champ `pour` : `tous` ou `formateurs`, filtré à l'affichage |
| Rétroactif | Oui, reprise des livraisons de juillet 2026 (9 entrées) |

### Pourquoi Accueil plutôt qu'un nouvel onglet

L'app ouvre sur `#/mon-suivi` et la barre compte déjà 8 onglets. Trois raisons ont fait pencher
la balance vers Accueil :

1. La barre d'onglets est `position: sticky`, donc **visible depuis n'importe quelle vue**. Une
   pastille posée là résout la découverte sans rien ajouter à la barre du haut.
2. Accueil est le **premier onglet**. Sur mobile la barre défile horizontalement, mais le premier
   onglet est toujours à l'écran sans défiler.
3. Ça **recycle un onglet sous-utilisé** au lieu d'en créer un neuvième. Accueil est aujourd'hui
   une page de raccourcis que personne n'ouvre, puisque l'app démarre sur Mon suivi.

Condition impérative : la pastille est sur **l'onglet**, pas seulement dans la page. Une pastille
posée dans Accueil ne serait vue que par ceux qui y sont déjà allés.

## Architecture

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `js/nouveautes-data.js` | Le contenu, et rien d'autre. Un tableau d'objets. Écrire une nouveauté, c'est éditer ce seul fichier |
| `js/nouveautes.js` | Logique : tri, filtre d'audience, calcul du non-lu, marquage. Le cœur reçoit ses entrées en argument, donc testable sans DOM ni `localStorage` |
| `js/views/nouveautes.js` | La page complète `#/nouveautes` |
| `tests/nouveautes.test.mjs` | Test Node, sur le modèle de `dp-rules.test.mjs` |
| `_preview_nouveautes.html` | Banc d'essai, `?role=stagiaire\|formateur`, `auth-admin.js` substitué par import map |
| `_preview_stubs/auth-admin-role.js` | Module factice pour le banc (le stub existant sert au DP, on n'y touche pas) |

### Fichiers modifiés

- `js/views/home.js` : la section Nouveautés
- `js/main.js` : route `nouveautes`, pastille sur l'onglet Accueil, onglet actif sur cette route
- `css/style.css` : cartes, puces, pastille d'onglet

Aucune migration Supabase, aucune RLS, aucun droit `anon` à révoquer.

### Séparation des responsabilités

`nouveautes-data.js` ne connaît que du contenu. `nouveautes.js` ne connaît que des règles et
ignore d'où viennent les données. `views/nouveautes.js` et la section d'Accueil ne connaissent
que du rendu. On peut donc tester les règles sans navigateur, et réécrire l'affichage sans
toucher aux règles.

## Forme d'une entrée

```js
{
  id: "2026-07-31-dossier-professionnel",
  date: "2026-07-31",
  pour: "tous",                        // "tous" | "formateurs"
  titre: "Ton Dossier Professionnel se remplit dans l'app",
  resume: "Le dossier que tu présentes au jury se saisit directement ici et "
        + "s'imprime au format officiel. Tes réponses sont enregistrées au fur "
        + "et à mesure, tu peux y revenir autant de fois que tu veux.",
  ou: { label: "Mon espace personnel → Dossier pro",   // facultatif
        route: "mon-suivi", sousOnglet: "dp" },
  guide: [                                             // facultatif
    "Ouvre ton espace personnel (le logo en haut à gauche).",
    "Va sur le sous-onglet « Dossier pro ».",
    "Remplis tes exemples, puis clique « Imprimer ».",
  ],
}
```

**`id`** porte la date en préfixe pour rester lisible et unique, mais **le tri se fait sur le
champ `date`**, pas sur l'ordre du tableau. Impossible d'insérer une entrée au mauvais endroit
par distraction. À date égale, l'ordre du tableau départage (tri stable).

**`ou`** et **`guide`** sont facultatifs. Une entrée sans `ou` n'affiche pas la ligne, une entrée
sans `guide` n'affiche pas le dépliant.

**`sousOnglet`** résout un vrai défaut : un lien « Notes → Dossier pro » qui atterrit sur le
premier sous-onglet de Notes est une déception. `renderSubTabs` mémorise déjà l'onglet actif dans
`localStorage`. Le lien écrit cette clé avant de naviguer, et la vue s'ouvre au bon endroit. La
correspondance route vers clé vit dans `nouveautes.js` :

```js
const STORAGE_SOUS_ONGLET = {
  "mon-suivi": "ecsr_monsuivi_subtab",
  notes:       "ecsr_notes_subtab",
};
```

Si la route n'est pas dans la table, `sousOnglet` est ignoré et le lien navigue normalement. Pas
d'erreur, juste un atterrissage moins précis.

## Règles

### Visibilité

Une entrée est visible si `pour === "tous"`, ou si la personne est formateur ou admin
(`isAdmin() || isProf()`). Le module de règles ne connaît pas l'authentification : il reçoit un
booléen `formateur`. C'est ce qui le rend testable.

Le compte de la pastille respecte évidemment ce filtre. Un stagiaire ne voit jamais qu'il existe
des entrées qui ne lui sont pas destinées.

### Non-lu

`localStorage["ecsr_nouveautes_vues"]` contient un tableau JSON d'identifiants déjà vus. Une
entrée est nouvelle si son id n'y figure pas.

C'est plus robuste que mémoriser une date de dernière visite : une entrée ajoutée rétroactivement
est correctement détectée. À l'écriture, on purge les ids absents des données courantes, donc la
liste ne gonfle pas indéfiniment.

Premier accès (rien en mémoire) : tout est nouveau. C'est le comportement voulu au lancement, et
pour un stagiaire qui arriverait plus tard.

### Marquage

- Ouvrir **Accueil** marque les entrées **réellement affichées** (les 3 dernières visibles).
- Ouvrir **`#/nouveautes`** marque **tout** ce que la personne peut voir.

Au lancement la pastille affichera **9 pour un formateur et 6 pour un stagiaire** (3 des 9 entrées
de reprise sont réservées aux formateurs), tombera de 3 après un passage par Accueil, puis à 0
après « Tout voir ». En régime normal il y aura une ou deux nouveautés, toutes visibles dans
Accueil, donc la pastille tombera à 0 du premier coup. Le raffinement ne se paye que lors d'une
longue absence, et il invite précisément à ouvrir la liste complète.

`localStorage` peut échouer (mode privé, quota). Toute lecture et toute écriture sont enveloppées
dans un `try/catch`, comme le fait déjà `subtabs.js`. En cas d'échec, tout paraît nouveau à chaque
visite : dégradation acceptable, jamais d'erreur visible.

## Affichage

### La pastille

**Piège identifié dans le CSS** : sur mobile, `.tab span { display: none }` masque le libellé des
onglets. Une pastille écrite dans un `<span>` serait donc invisible sur téléphone, là où elle
compte le plus. Elle porte sa propre classe avec une règle explicite :

- **Desktop** : chiffre, plafonné à « 9+ ».
- **Mobile (max-width: 760px)** : point coloré sur l'icône, sans chiffre (illisible à cette taille).

Mise à jour par une fonction dédiée qui modifie l'élément **sur place**. Surtout pas de
`renderTabs()` complet, qui reconstruirait la barre et perdrait la classe `active` posée par
`navigate()`. Appelée au démarrage, sur `onAdminChange` (l'audience peut changer) et après chaque
marquage.

Sur `#/nouveautes`, l'onglet Accueil reste allumé, par une correspondance route vers onglet dans
`navigate()`. Aujourd'hui `#/mon-suivi` laisse la barre sans onglet actif, ce qui est assumé pour
l'espace perso mais serait déroutant ici, puisqu'on arrive de l'onglet Accueil.

### Dans Accueil

La section se place **après le compteur J−N et avant les tuiles de raccourcis** : quelqu'un qui
arrive en cliquant sur la pastille doit tomber dessus sans défiler.

En-tête « ✨ Nouveautés » aligné sur les autres en-têtes de la page (📅 Prochains événements,
📌 À retenir), avec un lien « Tout voir → » à droite, comme celui de l'agenda.

Trois cartes au maximum : date, titre, résumé, ligne « Où le trouver », puce « Nouveau » si non
lue, puce « Formateurs » si l'entrée est réservée. **Le guide est replié** derrière un
« Comment faire », pour que la section reste courte et ne repousse pas les raccourcis les jours
où il n'y a rien de neuf.

Si aucune entrée n'est visible (cas théorique), la section n'est pas rendue du tout.

### La page `#/nouveautes`

Les mêmes cartes, toutes les entrées visibles par la personne, de la plus récente à la plus
ancienne, **guides dépliés** (la page a la place). Route ajoutée à `routes` sans entrée dans
`TABS`, exactement comme `mon-suivi`.

### Conventions respectées

Français partout. **Aucun em-dash** dans les libellés. « Formateur », jamais « Prof ». Vanilla JS
en modules ES. Palette mint, accent `#6B7F4E`, pas de couleur nouvelle. Pas de gamification :
la puce « Nouveau » signale, elle ne récompense pas, et il n'y a ni compteur de lecture ni série.

## Contenu de reprise (9 entrées)

Dates réelles de mise en production, relevées dans `git log`.

| Date | Entrée | Pour |
|---|---|---|
| 2026-07-31 | Les QCM d'entraînement sont ouverts à toute la promo (57 thèmes, entraînement adaptatif qui remet tes erreurs en premier) | tous |
| 2026-07-31 | Signaler une erreur dans un QCM depuis la question elle-même | tous |
| 2026-07-31 | Le Dossier Professionnel se remplit dans l'app et s'imprime au format officiel | tous |
| 2026-07-23 | L'app ouvre sur ton espace personnel, « Priorités » remplace le tableau de bord, tes passages effectués y sont comptés | tous |
| 2026-07-21 | Verrou de semaine et mode Modifier : le planning s'ouvre en lecture seule, vue compacte une fois la semaine validée | formateurs |
| 2026-07-20 | Absences et comptage des passages : une absence consomme ton tour, un passage bonus non | tous |
| 2026-07-19 | Le livret officiel TP-01303 se remplit et s'imprime depuis ton espace personnel | tous |
| 2026-07-05 | Auto-écoles partenaires et suivi des venues des bénévoles | formateurs |
| 2026-07-02 | Banque d'élèves bénévoles avec disponibilités hebdomadaires | formateurs |

Les livraisons antérieures à juillet ne sont pas reprises : elles décrivent l'app telle qu'elle a
toujours été pour la promo actuelle.

**Note de rédaction** : le résumé et le guide sont écrits du point de vue du stagiaire, à la
deuxième personne, comme le reste de l'app. Pas de « nous avons ajouté ». Aucun détail
d'implémentation, aucun nom de table ni de fichier.

## Vérification

1. `node tests/nouveautes.test.mjs` : tri par date décroissante, stabilité à date égale, filtre
   d'audience dans les deux sens, calcul du non-lu, purge des ids obsolètes, plafond « 9+ ».
2. Banc `_preview_nouveautes.html` en `?role=stagiaire` puis `?role=formateur` : les deux entrées
   formateurs disparaissent côté stagiaire, la pastille décroît au bon rythme, le dépliant
   « Comment faire » fonctionne, le lien vers un sous-onglet écrit bien la clé attendue.
3. App réelle **en navigation privée**. Sur une branche de feature le token `?v=` n'est pas
   re-versionné, donc le navigateur resert l'ancien JS **et l'ancien CSS**. Un rechargement forcé
   ne suffit pas toujours.
4. Contrôle mobile (largeur 375) : la pastille est visible sur l'icône Accueil sans défiler dans
   la barre d'onglets.

**Ne pas lancer `scripts/cache-bust.js` sur cette branche.** Les imports des nouveaux fichiers
portent le token courant écrit à la main. Le re-versionnage se fait au merge sur `main`, par le
hook.

## Hors périmètre

- Édition depuis l'app. Une entrée s'écrit dans le repo, en session de dev.
- Table Supabase, RLS, éditeur admin.
- Notification poussée (mail, push, bandeau bloquant). Le message WhatsApp reste le canal de
  notification.
- Recherche, filtres, catégories, archivage. Neuf entrées aujourd'hui, une trentaine dans six
  mois : une liste antéchronologique suffit.
- Génération automatique du message WhatsApp. Le `resume` et le `guide` se recopient tels quels,
  c'est déjà l'essentiel du gain.
