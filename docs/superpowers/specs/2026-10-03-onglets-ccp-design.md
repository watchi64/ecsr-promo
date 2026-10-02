# Onglets CCP1 et CCP2 : design

> Chantier D du dispatch du 01/10/2026. Branche `onglets-ccp`, worktree
> `C:/Users/watch/Dev/ecsr-promo-onglets-ccp` (hors du dossier ECSR, comme A et B).
> Trois décisions prises avec Timy le 02/10/2026 (parcours guidé, découpage en 8 étapes,
> contenu de l'onglet CCP1). Les autres ont été tranchées en autonomie dans la nuit du 02 au
> 03/10, à sa demande (« avance le plus possible en autonomie jusqu'à demain matin ») : elles
> sont marquées **à valider** dans la section 2. Rien n'est fusionné dans `main` avant sa
> relecture.
> Dépendance : chantier B (modules), en production depuis le 02/10 (`7d2ab74`). Chantier A
> (multi-promo) en cours, non fusionné : voir section 9.

## 1. Objectif

Ranger l'app selon les deux certificats du titre professionnel ECSR :

- **CCP1** (« Former des apprenants conducteurs ») réunit ce qui existe déjà et sert surtout au
  premier certificat : thèmes avec cours et QCM, matrice des notes, EPCF, livret EPCF, dossier
  professionnel.
- **CCP2** (« Sensibiliser l'ensemble des usagers de la route ») est nouveau : un parcours guidé
  en 8 étapes, du choix du commanditaire au jour de l'épreuve.

La barre d'onglets garde 8 onglets : sur iPhone, où elle n'affiche que les icônes, elle tient
toujours sur la largeur de l'écran (375 px) sans défiler.

## 2. Décisions

| Question | Décision | Origine |
|---|---|---|
| Ce qu'apporte l'onglet CCP2 | Parcours guidé : ce qui est attendu, conseils, documents et liens, dates. Même contenu pour tous, rien à saisir | Timy, 02/10 |
| Découpage du parcours | 8 étapes (section 4.2) | Timy, 02/10 |
| Ce qui déménage dans CCP1 | Thèmes (avec cours et QCM), Notes, EPCF, Livret EPCF, Dossier pro | Timy, 02/10 |
| Barre d'onglets | Accueil, Priorités, Planning, Calendrier, CCP1, CCP2, Ressources, Paramètres : Thèmes et Notes quittent la barre | à valider |
| CCP1 et CCP2 sur iPhone | Deux icônes chiffrées (un carré arrondi portant « 1 » ou « 2 ») : les libellés sont masqués sur téléphone | à valider |
| Anciennes adresses `#/themes` et `#/notes` | Redirigées vers le bon sous-onglet de CCP1 (favoris, raccourcis d'écran d'accueil, dernière page mémorisée) | à valider |
| CCP1 et les modules | Pas de module propre : l'onglet apparaît dès qu'une de ses parties est ouverte | à valider |
| CCP2 et les modules | Un module `ccp2`, groupe « CCP2 » : fermé chez une promo réglée tant qu'un formateur ne l'ouvre pas, ouvert chez la promo de mars (aucun réglage) | à valider |
| Rangement du réglage des modules | Les groupes suivent les onglets : « CCP1 » réunit Thèmes, Cours, QCM, Notes, EPCF, Livret EPCF, Dossier pro ; nouveau groupe « CCP2 » | à valider |
| Où vit le texte du parcours | Dans le code, comme les Nouveautés (`js/ccp2-parcours-data.js`) : pas de table, pas d'éditeur | à valider |
| Dates dans le parcours | Les événements du Calendrier de la promo dont le titre contient « CCP2 » (formation, stages, examen), si le Calendrier est ouvert | à valider |
| Mon espace | Inchangé (Passages, EPCF, Évolution, Dossier pro) | à valider |
| Dossier pro dans le parcours | Lien de l'étape 8 vers Mon espace, sous-onglet Dossier pro | à valider |
| Livraison | Un seul lot : CCP1 et CCP2 ensemble, puisque la barre n'a de la place pour les deux que si Thèmes et Notes y entrent | à valider |
| Assistant | Son guide de l'app est mis à jour dans le code ; le redéploiement de la fonction reste un geste de Timy | à valider |

## 3. Navigation

### 3.1 La barre

| Avant | Après |
|---|---|
| Accueil, Priorités, Planning, Calendrier, **Thèmes**, **Notes**, Ressources, Paramètres | Accueil, Priorités, Planning, Calendrier, **CCP1**, **CCP2**, Ressources, Paramètres |

Mon espace (`mon-suivi`) et Nouveautés restent des pages sans onglet, comme aujourd'hui.

Les deux nouvelles icônes suivent le style du jeu existant (`js/icons.js` : trait de 1,6 sur
une grille de 24) : carré aux coins arrondis, chiffre tracé au trait. Sur téléphone c'est le
chiffre qui distingue les deux onglets.

### 3.2 L'onglet CCP1 (route `ccp1`)

En-tête : surtitre « Titre professionnel ECSR », titre « CCP1 », sous-titre « Former des
apprenants conducteurs : thèmes et cours, notes, examens blancs, livret et dossier
professionnel. »

Sous-onglets, dans cet ordre (mémorisés sous la clé `ecsr_ccp1_subtab`, premier ouvert par
défaut : Thèmes) :

| Clé | Libellé | Module | Contenu |
|---|---|---|---|
| `themes` | Thèmes | `themes` | la vue Thèmes actuelle, avec ses colonnes Cours et QCM ; chez un formateur, sa barre interne « Thèmes, Signalements » reste |
| `notes` | Notes | `notes` | la matrice, la synthèse et les graphiques de l'onglet Notes actuel |
| `epcf` | EPCF | `epcf` | l'actuel sous-onglet EPCF de Notes |
| `livret` | Livret EPCF | `livret` | l'actuel sous-onglet Livret EPCF de Notes |
| `dp` | Dossier pro | `dp` | l'actuel sous-onglet Dossier pro de Notes |

Les vues Thèmes et Notes sont rendues **embarquées** : sans leur grand titre (l'onglet CCP1 a
déjà le sien), en gardant leur ligne de compteur (« 31 / 57 thèmes officiels terminés »,
« 384 notes enregistrées ») et leurs boutons (« Ajouter une notion » chez un formateur).
L'onglet Notes perd sa propre barre de sous-onglets : ses sous-onglets EPCF, Livret EPCF et
Dossier pro sont désormais ceux de CCP1.

Un rendu embarqué ne touche à son panneau que s'il est encore le sous-onglet affiché (jeton
`isActive` de `renderSubTabs`, comme le font déjà EPCF, Livret et Dossier pro) : sans cela, une
liste de thèmes qui finit de charger après un passage sur Notes écrirait dans le panneau de
Notes.

S'il ne reste qu'un sous-onglet visible (promo qui n'a ouvert que les Thèmes), la barre
disparaît et le contenu s'affiche directement : c'est déjà le comportement de `renderSubTabs`.

### 3.3 L'onglet CCP2 (route `ccp2`)

En-tête : surtitre « Titre professionnel ECSR », titre « CCP2 », sous-titre « Sensibiliser les
usagers de la route : ton parcours en 8 étapes, du commanditaire au jour de l'épreuve. »

Puis, de haut en bas :

1. **L'épreuve en bref** : une carte qui résume ce qui attend le candidat (section 4.3), avec les
   liens vers le référentiel d'évaluation, le référentiel emploi activités compétences (PDF déjà
   hébergés par l'app) et la boîte à outils numérique CCP2.
2. **Tes dates** : les événements CCP2 du Calendrier (section 4.4). Absent si le Calendrier est
   fermé pour la promo ou si aucun événement ne correspond.
3. **Les 8 étapes** : une carte repliable par étape (élément `<details>` natif, donc utilisable
   au clavier sans code d'ouverture). Le résumé montre le numéro, le titre et la phrase « en
   bref » ; le corps déplie les rubriques de l'étape (section 4.1). La dernière étape ouverte
   est mémorisée sur l'appareil (`ecsr_ccp2_etape`) et se rouvre au retour sur l'onglet.

Le parcours ne contient aucun contrôle d'édition : rien à ajouter au groupe `.read-only`.

### 3.4 Anciennes adresses

| Adresse | Devient |
|---|---|
| `#/themes` | `#/ccp1`, sous-onglet Thèmes |
| `#/notes` | `#/ccp1`, sous-onglet Notes |

La conversion se fait au début de `navigate()` : elle écrit le sous-onglet visé dans la mémoire
de `renderSubTabs`, puis remplace l'adresse (`history.replaceState`, sans entrée d'historique
parasite). La garde de B s'applique avant : un stagiaire dont la promo n'a pas ouvert le module
visé reçoit le message « Cette partie n'est pas encore ouverte pour ta promo. » et revient sur
Mon espace. Une dernière page mémorisée `themes` ou `notes` suit le même chemin au démarrage.

Pourquoi garder ces adresses : des favoris, des raccourcis d'écran d'accueil d'iPhone et la
dernière page mémorisée (`derniere-route`) les portent encore.

### 3.5 Accueil

Les tuiles Thèmes et Notes sont remplacées par :

| Tuile | Texte |
|---|---|
| CCP1 | Thèmes, notes, EPCF, dossier pro |
| CCP2 | Ton parcours en 8 étapes |

Ordre : Priorités, Planning, Calendrier, CCP1, CCP2, Ressources. Les tuiles suivent la même
règle de visibilité et de repère que les onglets (section 5).

### 3.6 Ce qui ne change pas

Mon espace et ses sous-onglets (Passages, EPCF, Évolution, Dossier pro), Priorités, Planning,
Calendrier, Ressources (la carte de la boîte à outils CCP2 y reste), Paramètres, le lecteur de
cours et les QCM (fenêtres posées par-dessus la page), l'impression du livret et du dossier pro.

## 4. Le parcours CCP2

### 4.1 Une étape

Chaque étape est un objet de `js/ccp2-parcours-data.js` :

| Champ | Rôle |
|---|---|
| `num` | 1 à 8 |
| `cle` | identifiant stable (`commanditaire`, `demande`, `construire`, `animer`, `analyser`, `dossier`, `oral`, `epreuve`) |
| `titre` | titre de la carte |
| `enBref` | une phrase sous le titre |
| `attendus` | rubrique « Ce que le jury regarde » : les critères officiels de la compétence (REAC), ou ce que le référentiel d'évaluation exige pour une production ou l'épreuve |
| `conseils` | rubrique « Comment t'y prendre » : 4 à 8 conseils pratiques |
| `aGarder` | facultatif, rubrique « À garder pour ton dossier » : les traces à conserver au fil de l'étape |
| `liens` | facultatif, rubrique « Utile » : lien externe (`href`) ou interne (`route`, `sousOnglet`, `module`) |
| `source` | ligne de source en bas de carte (« REAC, compétence 8 », « Référentiel d'évaluation, CCP2 ») |

Un lien interne qui vise un module fermé pour la promo n'est pas affiché à un stagiaire (même
règle que les sous-onglets). Ton : tutoiement, phrases courtes, sans jargon ; un terme métier
(commanditaire, cahier des charges, scénario pédagogique) est défini à sa première apparition.
Aucun tiret cadratin, vérifié par le test.

### 4.2 Les 8 étapes

Sources : REAC TP-01303 du 05/02/2021 (fiches compétences 8 à 11) et référentiel d'évaluation
du 31/01/2021 (CCP « Sensibiliser l'ensemble des usagers de la route », obligations
réglementaires), tous deux dans `assets/referentiels/`.

| # | Titre | Ce que le jury regarde | Comment t'y prendre (thèmes) |
|---|---|---|---|
| 1 | Trouver un commanditaire | une action réelle, menée en autonomie pendant une période en entreprise ; au moins 140 heures de période en entreprise pour le CCP2 | choisir un public, prendre contact, présenter l'établissement, noter d'emblée la structure, son activité, l'interlocuteur et la date |
| 2 | Analyser la demande | les 5 critères de la compétence 8 (attentes identifiées, conseil pertinent, prestation adaptée au besoin, impératifs de l'établissement, valorisation de l'établissement) | entretien, questions, écoute, reformulation, durée estimée, cahier des charges, critères d'évaluation, courriel de confirmation, compte rendu au responsable |
| 3 | Construire l'action | les 5 critères de la compétence 9 (cahier des charges intégré, rôle du co-animateur, contenus adaptés, activités cohérentes, durée et moyens) | REMC, sources fiables, méthodes adaptées au public, scénario écrit, outil d'évaluation, matériel et salle |
| 4 | Animer la séance | les 6 critères de la compétence 10 (cahier des charges, techniques adaptées, langage adapté, contenus pertinents, durée, participation) | faire émerger les représentations, faire analyser ses pratiques d'usager, adapter le scénario, tenir le temps, co-animer, évaluer en fin de séance |
| 5 | Analyser sa pratique | les 7 critères de la compétence 11 (situation décrite et analysée, ajustements, facteurs d'efficacité, pratiques analysées, sources exploitées, bilan, axes réalistes) | séparer faits, opinions et émotions, exploiter l'évaluation, échanger avec ses pairs, axes réalistes, organiser sa veille |
| 6 | Rédiger le dossier | 40 000 à 45 000 caractères espaces compris, hors annexes ; les 5 contenus exigés (transcription de la demande, enjeux et démarche, adéquation de la réponse, analyse de pratique, veille) | écrire au fil des étapes, compter les caractères, mettre les supports en annexe, relire |
| 7 | Préparer l'oral | un support numérique projetable ; les 6 points de la présentation ; 30 minutes sans interruption ; posture d'enseignant face au jury | une idée par diapositive, répéter chronomètre en main, prévoir une copie du support |
| 8 | Le jour de l'épreuve | 1 h 30 en trois temps ; permis B et attestation sur l'honneur ; attestation du centre ; dossier professionnel ; entretien final sur le livret de certification en fin de session du dernier CCP | documents à apporter, enchaînement des trois temps, lien vers le dossier pro |

Le texte complet vit dans `js/ccp2-parcours-data.js` : il se relit dans l'app (ou dans le
fichier) plutôt que dans cette spec, pour qu'il n'en existe qu'une version.

### 4.3 L'épreuve en bref

- 1 h 30 devant le jury, en trois temps qui s'enchaînent : présentation de ton action (30 min,
  sans interruption), entretien technique sur cette présentation (30 min), questions sur ton
  dossier écrit (30 min). Pas de questionnaire professionnel au CCP2.
- Deux productions à remettre avant la session : le dossier écrit (40 000 à 45 000 caractères)
  et le support projetable.
- Au moins 140 heures de période en entreprise, attestées par le centre de formation.

### 4.4 Tes dates

Lecture : `listAgendaEvents()` (la même fonction que l'agenda d'Accueil ; le multi-promo la
rendra propre à la promo courante sans changer de signature). Filtre : titre contenant « CCP2 »
(casse et espace ignorés, `/ccp\s*2/i`) et type `formation`, `stage` ou `examen`. Tri par date de
début. Un événement terminé est atténué et marqué « passé ». En base aujourd'hui : Formation
CCP2, trois stages en entreprise CCP2, Examens CCP2.

Convention à transmettre aux formateurs quand ils créent les dates d'une nouvelle promo : le
titre d'un stage ou d'un examen du CCP2 contient « CCP2 ».

## 5. Modules (branchement sur B)

### 5.1 Catalogue (`js/modules-data.js`)

- **Nouveau module** `ccp2` : nom « CCP2 », accord `ms`, groupe « CCP2 », explication
  « Parcours guidé en 8 étapes, du commanditaire à l'épreuve. », annonce « L'onglet CCP2 est
  ouvert » (résumé tutoyé, lien vers `ccp2`).
- **Groupes** : `GROUPES = ["Démarrage", "Suivi de la formation", "CCP1", "CCP2", "Outils"]`.
  Thèmes, Cours, QCM, Notes et Dossier pro rejoignent le groupe CCP1, où se trouvaient déjà
  EPCF et Livret EPCF. « Suivi de la formation » garde Priorités. Le groupe CCP1 porte une
  phrase sous son intitulé : « L'onglet CCP1 apparaît aux stagiaires dès qu'une de ces parties
  est ouverte. »
- **Ordre** (celui du réglage) : planning, calendrier, ressources, priorites, themes, cours, qcm,
  notes, epcf, livret, dp, ccp2, assistant. Les parents restent avant leurs enfants.
- **Livret EPCF** perd son parent `notes` : il n'est plus rangé dans Notes mais à côté, dans CCP1.
  Un formateur peut donc l'ouvrir sans ouvrir la matrice des notes.
- **Textes** : les explications et annonces qui disaient « dans Notes » ou « Thèmes, colonne
  QCM » pointent vers CCP1 (« CCP1, sous-onglet Notes », « CCP1, Thèmes, colonne QCM »…).
  Les annonces étant fabriquées à l'affichage, les anciennes suivent.
- **Onglet regroupé** : `ONGLETS_REGROUPES = { ccp1: ["themes", "notes", "epcf", "livret",
  "dp"] }`.
- `MODULE_DE_ROUTE` gagne `ccp2: "ccp2"` et garde `themes` et `notes` (les anciennes adresses
  en dépendent pour leur garde).
- `MODULE_DE_SOUS_ONGLET` : l'entrée `notes` disparaît (Notes n'a plus de sous-onglets), une
  entrée `ccp1` reprend les cinq sous-onglets.

### 5.2 Règles (`js/modules.js`, pures)

- `modulesDeRoute(route, ref)` : les modules d'une route regroupée, sinon son module, sinon
  aucun (socle).
- `routeOuverte(route, etat, ref)` : vraie pour le socle, sinon si **au moins un** de ses
  modules est ouvert.

`routeVisible` et `routeMasquee` (`js/modules-etat.js`) passent par elles. Pour une route
simple, rien ne change.

### 5.3 Ce que voit chacun

| Endroit | Stagiaire | Formateur |
|---|---|---|
| Onglet et tuile CCP1 | présents si au moins une des cinq parties est ouverte | toujours présents ; repère « Masqué aux stagiaires » si les cinq sont fermées |
| Sous-onglets de CCP1 | seulement les parties ouvertes | toutes, repère sur les parties fermées |
| Onglet et tuile CCP2 | présents si `ccp2` est ouvert | toujours ; repère si fermé |
| Tes dates (CCP2) | si le Calendrier est ouvert | toujours |
| Liens internes du parcours | si leur module est ouvert | toujours |

Conséquences : la promo de mars, sans réglage, voit tout (rien à faire). Une promo réglée voit
CCP2 fermé jusqu'à ce qu'un formateur l'ouvre : c'est voulu pour septembre, qui commence le
CCP1.

### 5.4 Nouveautés et liens « Où le trouver »

- `STORAGE_SOUS_ONGLET` (`js/nouveautes.js`) : `notes` est remplacé par
  `ccp1: "ecsr_ccp1_subtab"`.
- Les nouveautés déjà écrites qui menaient à Thèmes ou à Notes sont mises à jour vers CCP1 (le
  lien dit où trouver la chose aujourd'hui). Leur rattachement aux modules ne change pas.
- Deux nouveautés « tous » annoncent le chantier : « Thèmes, Notes et EPCF réunis dans l'onglet
  CCP1 » (module `themes`) et « Nouvel onglet CCP2 : ton parcours en 8 étapes » (module `ccp2`).
  Date : celle de la fusion.

## 6. Architecture

| Fichier | Changement |
|---|---|
| `js/views/ccp1.js` | nouveau : en-tête et sous-onglets (rend Thèmes, Notes, EPCF, Livret, Dossier pro) |
| `js/views/ccp2.js` | nouveau : en-tête, épreuve en bref, dates, étapes |
| `js/ccp2-parcours-data.js` | nouveau : contenu des 8 étapes et de l'épreuve en bref, sans import (lu par les tests node) |
| `js/ccp-rules.js` | nouveau, pur : anciennes adresses (`ANCIENNES_ROUTES`, `ancienneRoute`), sélection des dates CCP2 (`datesCcp2`) |
| `js/main.js` | barre (`TABS`), routes `ccp1` et `ccp2`, conversion des anciennes adresses, dernière page |
| `js/views/notes.js` | option `embedded` ; la barre de sous-onglets part dans `ccp1.js` |
| `js/views/themes.js` | option `embedded` et jeton `isActive` |
| `js/views/home.js` | tuiles CCP1 et CCP2 |
| `js/modules-data.js`, `js/modules.js`, `js/modules-etat.js` | section 5 |
| `js/views/modules-reglage.js` | phrase sous le groupe CCP1 |
| `js/nouveautes.js`, `js/nouveautes-data.js` | section 5.4 |
| `js/icons.js` | icônes `ccp1` et `ccp2` |
| `css/style.css` | bloc en **fin de fichier** : parcours, en-têtes embarqués, sous-onglets serrés sous 760 px |
| `supabase/functions/chatbot/aide.mjs` | pages CCP1 et CCP2 dans le guide de l'app (non redéployé) |
| `PROJECT_NOTES.md` | section « Onglets CCP1 et CCP2 », liste des pages à jour |

Qui parle à qui : `main.js` (routeur) → `views/ccp1.js` → vues existantes (Thèmes, Notes, EPCF,
Livret, Dossier pro) ; `main.js` → `views/ccp2.js` → `ccp2-parcours-data.js` (texte) et
`db.js` (dates du Calendrier). Les deux onglets demandent à `modules-etat.js` ce qui est visible.
Aucune table, aucune migration, aucune règle d'accès nouvelle.

## 7. Sécurité

Aucune donnée nouvelle, aucune écriture nouvelle : les vues embarquées gardent leurs gardes
(`isAdmin()`, règles d'accès en base). Le parcours est du texte public pour tout connecté. Le
masquage par module reste une progression pédagogique, pas une protection (spec B, section 1).

## 8. Tests et preuves

- `node tests/modules.test.mjs` : `modulesDeRoute`, `routeOuverte` (onglet regroupé ouvert si
  une partie l'est, fermé si toutes le sont), catalogue réel (onglet regroupé hors socle et hors
  `MODULE_DE_ROUTE`, modules connus, sous-onglets de `ccp1` identiques à `ONGLETS_REGROUPES.ccp1`,
  `ccp2` joignable), nouveautés existantes toujours rattachées au bon module.
- `node tests/ccp-rules.test.mjs` (nouveau) : anciennes adresses, sélection et tri des dates,
  intégrité du parcours (8 étapes numérotées 1 à 8, clés uniques, champs obligatoires, liens
  vers des routes connues, aucun tiret cadratin).
- Tous les tests existants restent verts.
- Banc d'essai (`_harness.html`, base factice) : barre de 8 onglets ; CCP1 et ses sous-onglets
  pour un formateur et un stagiaire ; promo réglée avec seulement Thèmes ouvert (onglet CCP1
  sans barre de sous-onglets, CCP2 absent) ; `#/notes` et `#/themes` redirigés ; parcours
  CCP2 (8 cartes, dates, mémoire de l'étape ouverte) ; retour d'un QCM sur la liste des thèmes.
- iPhone (375 px) : barre sans défilement, sous-onglets de CCP1 lisibles, aucune largeur qui
  déborde de la page.
- Aucun tiret cadratin dans les fichiers touchés (`grep $'\xe2\x80\x94'`).

## 9. Coordination avec A (multi-promo)

A modifie aussi `main.js`, `views/home.js`, `nouveautes.js` et `views/config.js`. Le second à
fusionner reprend `main` et résout. Rien dans D ne dépend de A : les dates passent par
`listAgendaEvents()`, que A rend propre à la promo sans en changer l'appel, et l'état des
modules passe par `modules-etat.js`, déjà prévu pour A.

Une fois A en ligne, ouvrir CCP2 pour la promo de mars n'est pas nécessaire (elle reste sans
réglage tant que personne ne la règle) ; pour une promo réglée, l'ouvrir d'un clic dans
Paramètres, Modules de la promo.

## 10. Livraison

1. Relecture de cette spec et du parcours par Timy (les points « à valider »).
2. Fusion dans `main` : `git -C TP_ECSR_App merge --no-ff --no-commit onglets-ccp` puis commit
   normal (le hook re-tokenise le cache), nouveautés dans le même commit, contrôle que le diff
   hors jetons ne contient que la branche.
3. Vérification navigateur du `main` fusionné, iPhone compris ; push par Timy.
4. Redéploiement de la fonction de l'assistant par Timy (guide de l'app à jour).
5. Fermeture : worktree et branche supprimés, `PROJECT_NOTES.md` et mémoire à jour, message
   WhatsApp prêt à copier.

## 11. Hors périmètre

- Suivi des étapes par stagiaire (cases « fait », vue d'avancement pour les formateurs) :
  possible en second temps, avec une table.
- Édition du parcours par les formateurs dans l'app.
- Parcours en étapes pour le CCP1.
- Rédaction du dossier CCP2 ou du support d'oral dans l'app.
- Ouverture étape par étape du parcours (un seul module `ccp2`).
