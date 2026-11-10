# PROJECT_NOTES.md - TP ECSR App

> **Fichier de reprise pour future session Claude.** Maintenu manuellement, à mettre à jour quand une décision structurante change. Daté : **2026-05-21**, backend mis à jour le 03/07/2026.

## TL;DR

Web app de suivi des promotions **TP ECSR** : depuis octobre 2026, plusieurs promos dans la même base (« Nîmes, mars 2026 » et « Montpellier, septembre 2026 », cf. § Multi-promo), mêmes formateurs (Hocine, Raphaël, Romain) + 1 admin watchi64. Stack : HTML/CSS/JS vanilla + Supabase + GitHub Pages.

- URL : **https://watchi64.github.io/ecsr-promo/**
- Repo : `github.com/watchi64/ecsr-promo` (public)
- Local : `C:\Users\watch\Dev\ECSR\TP_ECSR_App`
- Dossier formation (cours/QCM) : `C:\Users\watch\Dev\ECSR\` (séparé du repo app)

**Focus actuel** : que ça fonctionne parfaitement pour la promo CCP1+CCP2 2026. Long terme envisagé : vendre à d'autres centres TP ECSR (pas activé).

## Stack & infra

| | |
|---|---|
| Frontend | HTML/CSS/JS vanilla, modules ES, **pas de framework** (refus assumé) |
| Backend | Supabase Postgres, project `crpduennbqaemhfaywrz` (eu-west-3 Paris, org Timy Studio : migré le 17/06/2026 depuis dacqponglpeuscbgwfqn) |
| Edge Function | `invite-user` (deploy via MCP `mcp__800314df__deploy_edge_function`) |
| Hébergement | GitHub Pages, branche `main` |
| Typo | Canela (display, self-hosted .otf) + Outfit (Google Fonts body) + Geist Mono (numéros) |
| Logo | `assets/logo/tpecsr-logo.svg` (capsule TP) : SVG seul, le PNG a été supprimé |
| Palette | Mint éditorial unique (`:root`), accent vert `#6B7F4E`. Plus de switcher thème/accent |
| Cache-bust | **Automatique** : hook `pre-commit` → `scripts/cache-bust.js` pose un token `?v=AAAAMMJJx` uniforme sur `index.html` + tous les imports JS |
| Bootstrap admin | `misterwatchi@gmail.com` (compte admin + lié au stagiaire Timy id=15) |

## Auth & permissions - refonte du 18 mai

**Modèle actuel** : **email + mot de passe** pour tout le monde, whitelist côté serveur.

- **Plus de mot de passe partagé**, plus de magic link, plus de Google OAuth (essayés, retirés).
- Login : email + password classique (Supabase Auth `signInWithPassword`).
- Signup : email + password ; **trigger SQL `enforce_whitelist_signup`** sur `auth.users` bloque tout email absent de `user_profiles` et auto-confirme l'email pour bypass le mail de confirmation Supabase.
- Workflow d'invitation : admin va dans Paramètres → Accès & invitations → ajoute prénom + rôle + email → **aucun mail envoyé**, juste un ajout à la whitelist. Admin partage l'URL par ses propres moyens. La personne crée son compte elle-même.

### Table `user_profiles`

| Colonne | Type | Détail |
|---|---|---|
| `email` | TEXT PRIMARY KEY | identifiant principal |
| `role` | TEXT | `'stagiaire'` ou `'prof'` (l'option `'admin'` pur a été retirée du form) |
| `stagiaire_id` | INTEGER → stagiaires.id | si role=stagiaire |
| `prof_id` | INTEGER → profs.id | si role=prof |
| `is_admin` | BOOLEAN | **orthogonal au rôle** : un stagiaire peut être aussi admin |
| `anonymous_notes` | BOOLEAN | si TRUE, affiché « Anonyme » dans la matrice Notes pour les non-admins |
| `first_login_at`, `invited_at`, `invited_by_email` | TIMESTAMPTZ | audit |

**Permissions** dérivées :
- `isAuth()` = a une row user_profiles
- `isAdmin()` = `is_admin = true`
- `isProf()` / `isStagiaire()` = via `role`
- RLS : SELECT public, WRITE via `is_admin()` SECURITY DEFINER (lit `is_admin` colonne)
- Tous les `*_audit` : aucune écriture directe, uniquement via triggers
- RPC `set_my_anonymous_notes(val)` SECURITY DEFINER : permet à chacun de toggle son propre flag

## Pages (8 onglets) : état au 03/10/2026

```
Accueil · Planning · Calendrier · Cours · Notes · CCP2 · Ressources · Paramètres
```

CCP2 n'apparaît que lorsqu'un formateur ouvre le module pour la promo. Mon espace (`mon-suivi`),
Stagiaires (`stagiaires`, formateurs : tuile de l'Accueil et bouton du compte), Priorités
(`dashboard`, bouton en haut du Planning) et Nouveautés sont des pages sans onglet.
Cours garde la route `themes`. Voir « Barre simple et onglet CCP2 ». Les descriptions ci-dessous
datent de mai et juin : Thèmes, Priorités et Notes y sont décrits comme avant.

### Spécificités à connaître

- **Accueil** : refonte 19 mai. Salutation perso « Bonjour, V. Timy », pill date du jour, **bloc compteur J−N du prochain événement majeur** (examen/stage), 3 prochains événements (depuis agenda), 7 tuiles raccourcis, infos courtes (« Ctrl+Z annule », « ajout passage limité à 2 jours »…). Plus de mention mdp partagé / identité au 1er accès (obsolète).
- **Dashboard** : cards stagiaires compactes (215px), pill moyenne /20, badges priorité « À prioriser » / « Opportunité ratée » / « À jour » (PAS « Peut attendre »). Tri : priorité (défaut), alpha, note ↑/↓, passages ↓.
- **Planning** : jours empilés vertical, **jour en colonne gauche sticky** (78px), demi-journées avec horaires modulables. Lanes parallèles **alignées en colonnes** (lane index = grid-column). Cellule = strip header (activité bold + **multi-formateurs en chips** + delete) → sujet en **chips multi-thèmes** (autocomplete) → participants (Au tableau / Élèves) → notes discrètes. **Boutons 🎲** pour tirages aléatoires : 4 élèves auto en Pédagogie salle, 1-3 élèves en Voiture (popover 1/2/3), 1 pédagogue au tableau. Tous excluent les doublons dans la semaine. Print PDF 1 page. **Élèves bénévoles** (02/07/2026) : bouton « Bénévoles » (admin) dans la barre semaine → panneau banque (fiches, dispos hebdo, filtre « qui est dispo jeudi matin », tel cliquable, retrait doux) ; champ chips « Bénévoles » sur les cartes Voiture (dispos du jour en tête + badge « dispo », exclusion des cartes parallèles du même créneau) ; impression sous « Bénévoles : » en italique. Côté stagiaire : noms via RPC `benevoles_noms()` uniquement, banque et téléphones invisibles (RLS). **Auto-écoles partenaires + suivi** (05/07/2026) : le panneau a 2 onglets (Bénévoles / Auto-écoles), affiliation par select (+ création d'auto-école à la volée), fiche de suivi = venues déduites du planning avec commentaire par venue (table `benevole_suivi`), compteur de venues dans la liste. Fiche auto-école = gestion complète : bénévoles affiliés cliquables (ouvre leur fiche, retour à l'école), × pour désaffilier, select pour affilier un existant ou créer un bénévole déjà rattaché, « Retirer » (réversible) ET « Supprimer » (définitif, désaffilie ses bénévoles via `deleteAutoEcole`).
- **Calendrier** : 9 événements 2026 déjà insérés (Formation CCP1 30/03→21/09, stages 26/05, 03/08, Examens CCP1 22-25/09, Formation CCP2 28/09→07/12, stages 12/10, 26/10, 16/11, Examens CCP2 08-11/12). Types : examen/stage/formation/férié/autre, chacun couleur dédiée. Filtres « À venir » / « Tout ». Vue par mois.
- **Thèmes** : 4 sections en pills (Tout / Thèmes 57 / TP ECSR 12 / REMC 35 / Notions 2). Statut **binaire** (À faire ↔ Fait), pas « En cours ». Clic prénom titre = modal « Contenu à venir ». Date éditable côté admin via modale (force statut à Fait). Mobile : 2 lignes + corbeille (sur notions) en 4e col pour éviter chevauchement.
- **Passages** : table avec colonne « Ajouté par », filter, modal audit. Anti-backdating date ≥ J−2 pour non-admin (RLS + JS).
- **Notes** : vue matrice unique (stagiaires × Moy + C1 + C2 + REMC + GDE + 57 thèmes). Headers thèmes verticaux rotatés. Édition inline cellule (click → input, Enter sauve, Esc annule). Date globale en toolbar. **Save en place** (pas de re-render complet, n'écrase plus les autres inputs ouverts). Tri : défaut / alpha / moyenne ↑/↓ / nb notes ↓. **Synthèse classe** (KPI moyenne/médiane/saisies/notes<10 + Top 3 thèmes faibles/solides ; stagiaires en formation seulement, les notes des abandons ne comptent pas : décision du 23/10/2026, même règle que le tableau de bord du centre). **Graphiques tabs** : par stagiaire / par thème / distribution. **Mode anonyme** (toggle perso) : nom remplacé par « Anonyme » sauf pour admins. Couleurs notes pêche→vert (F1DBC8 / FBE5C1 / DBE9C4 / BFE0A6, pas de rouge vif : ressenti rabaissant). Tap sur prénom = modal détail vertical (utile mobile). Lignes alternées gris léger.
- **Ressources & contacts** : section **Contacts** (Myriam/Séverine/Fanny pré-remplis depuis procédure absences ECF + bouton « Ajouter un contact »), section **Ressources externes** (liens curés Légifrance/REMC/SRRR…). Tap-to-call (`tel:`) et tap-to-mail (`mailto:`).
- **Paramètres** : sections **Accès & invitations** (form invitation + liste avec pills rôle/admin), **Mes préférences** (toggle anonymat notes), **Promo** (stagiaires/profs CRUD admin), **Infos**. **Plus de section Apparence** (mint unique).

## Affichage stagiaires : nouveau format

Depuis 19 mai, table `stagiaires` a une colonne `nom` (nom de famille). Format d'affichage **partout dans l'app** : `<initiale du nom>. <prénom>` : ex : « V. Timy ». Helper `displayStagiaire(s)` dans `utils.js`. Tri alpha = par `nom` via `compareByNom(a, b)`.

Liste : ALEXER Audrick, ANKPRA Gaëlle, AQUILA Céline, BAILLY Mickael, BLANC Julie, BLANQUINQUE Valentin, BRUN Gaël, CHOULET Emilie, ERRAJI CHAHID Rita, KESSAL Lorie, LOPEZ Tatiana, MEDJANI Cassandre, MURRIGUIAN Aurélie, OULD ABDELKADER Anissa, VALDIVIA Timy.

## Base de données - état actuel

### Tables principales

| Table | Détail |
|---|---|
| `stagiaires` | 15 entries, `prenom` + **`nom`** + ordre |
| `profs` | 3 entries (Hocine, Raphaël, Romain) |
| `user_profiles` | whitelist email-based, multi-rôle (cf. § Auth) |
| `themes` | 57 officiels (type=theme, numero 1-57) + 12 compétences TP ECSR + 35 REMC + 2 notions (type=notion) |
| `competences` | C1-C4 (TP ECSR) + REMC + MGDE |
| `passages`, `passages_audit` | passages salle/voiture avec who tracking |
| `evaluations`, `evaluations_audit` | notes (type Thème/Compétence/Contrôle) |
| `planning_entries` | + nouvelle colonne **`prof_ids INTEGER[]`** (multi-formateurs). `prof_id` legacy conservé synchronisé au 1er. + **`benevoles_ids INTEGER[]`** (élèves bénévoles voiture, 02/07/2026). + **`absences JSONB`** `[{sid, rid}]` (absences de dernière minute, 19/07/2026 : cf. § Absences & comptage) |
| `benevoles` | banque d'élèves bénévoles (voiture conduite) : prénom (seul champ obligatoire), nom optionnel, **téléphone**, `niveau` = code compétence/sous-compétence REMC (« C1 », « C1.4 »... libellés résolus par `nivLabel()` dans benevoles.js), boîte, heures faites, **`auto_ecole_id` FK → auto_ecoles** (05/07/2026, le texte libre a été migré puis supprimé), `dispos jsonb` (grille hebdo LUNDI..VENDREDI x matin/aprem), `actif` (retrait doux). **RLS entièrement `is_admin()`** : invisible pour les stagiaires, téléphone jamais transmis. Seed 02/07/2026 : 9 bénévoles de la semaine du 6 juillet (Assiya, Chahinez + 7 via contact « Sophie ») liés aux cartes Voiture |
| `auto_ecoles` | partenaires (05/07/2026) : nom (obligatoire), référent, téléphone, email, adresse, notes, `actif`. RLS entièrement `is_admin()`. « Sophie » (06 16 14 75 14) = première fiche, migrée depuis le texte libre |
| `benevole_suivi` | commentaires de suivi par venue (05/07/2026) : `(benevole_id, semaine_lundi, day_index, half_day)` UNIQUE + commentaire. RLS `is_admin()`. ⚠️ Les venues ne sont PAS stockées : déduites de `planning_entries.benevoles_ids` (une demi-journée = une venue), seuls les commentaires vivent ici |
| `planning_half_meta` | horaires + pause par demi-journée par semaine |
| `ressources` | liens curés |
| `contacts` | admin/urgence/autre : pré-rempli Myriam/Séverine/Fanny |
| `agenda_events` | dates clés (examens, stages, formations) avec date_start + date_end optionnel |
| `settings` | KV générique (utilisé pour current_week_lundi) |
| `admins` | LEGACY conservée mais plus utilisée : la whitelist vit dans user_profiles |

### Fonctions / triggers Postgres notables

- `is_admin()` SECURITY DEFINER : lit `user_profiles.is_admin` via JWT email
- `enforce_whitelist_signup()` BEFORE INSERT ON auth.users : bloque si email pas dans user_profiles + auto-confirme email
- `set_my_anonymous_notes(val)` SECURITY DEFINER : RPC perso
- `benevoles_noms()` SECURITY DEFINER : seule surface bénévoles côté stagiaire : retourne uniquement `id` + `display` (« N. Prénom », inactifs compris pour que les vieilles semaines restent lisibles). Le planning l'utilise quand `isAdmin()` est faux
- Triggers `audit_passages`, `audit_evaluations` : INSERT/UPDATE/DELETE → row dans `*_audit`, identité depuis `auth.jwt()->>email`
- Trigger `agenda_touch_updated`, `contacts_touch_updated` : updated_at auto

### Edge Function `invite-user`

Vérifie le JWT de l'appelant, check `is_admin = true` en lecture service_role, upsert dans user_profiles. **Plus d'envoi de mail** (depuis v3 du 18 mai : l'app fait du signup classique côté navigateur).

## Absences & comptage des passages (19/07/2026)

Spec complète : `docs/specs/2026-07-19-absences-comptage-placement-design.md`.

- **Une Absence COMPTE** dans les compteurs d'équité du placement (tour consommé) ; **Bonus et Report ne comptent pas**. Règles centralisées dans `js/passage-rules.js` (`compteDansEquite`, `meilleurResultat`), testées par `node tests/passage-rules.test.mjs`. C'est l'INVERSE d'avant : casse le cercle vicieux des absents re-priorisés.
- **Absence de dernière minute** : marquée SUR la carte planning (⊘ à côté du tableau, clic sur le corps d'une chip élève voiture). Le prévu reste affiché barré ; un sélecteur « remplacé(e) par » propose TOUT le monde avec badge « occupé » en avertissement (pas d'exclusion dure). Stocké dans `planning_entries.absences` `[{sid, rid}]`.
- **Absence prévenue à l'avance** : pas de marquage : simple swap de chip, le remplaçant fait un passage normal. La frontière relève du jugement de l'admin.
- **Valider la semaine** : prévu non marqué → `Effectué` ; marqué → `Absence` (avec `remplacant_id`) + `Bonus` pour le remplaçant. Fusion au grain jour : `Effectué > Absence > Bonus`.
- **Placement auto en cascade** (dés + Placer la semaine) : 1) rien eu cette semaine → 2) type manquant (objectif 1 salle ET 1 voiture chacun) → 3) retard historique sur le type → 4) critères existants (plafond 2 voitures, anti-jours-consécutifs, avec-élève, variété formateur).

## Dossier Professionnel (DP) - 30/07/2026, branche `dp-dossier-professionnel`

Spec : `docs/specs/2026-07-30-dossier-professionnel-design.md` · plan : `docs/plans/2026-07-30-dossier-professionnel.md`
Modèle source : `docs/specs/2026-07-30-dp-modele-source.docx` (ministère chargé de l'emploi, version du 11/09/2017).

Chaque stagiaire remplit **son** DP dans l'app (Notes → sous-onglet « Dossier pro ») puis l'imprime ou l'enregistre en PDF au format officiel.

- **Noyau partagé `js/doc-officiel.js`** : la mécanique du livret EPCF (sérialisation `[data-k]`, `contentEditable`, clone d'impression, règle `@page` injectée puis retirée) en est extraite et sert aux DEUX documents. `epcf-livret.js` la consomme, son gabarit n'a pas bougé. Les classes techniques `.lv-f` / `.lv-cb` sont communes (préfixe historique, non renommé pour ne pas toucher un gabarit validé).
- **Un seul document officiel ouvert à la fois** (livret et DP sont deux sous-onglets de Notes). `teardownDocPrint()` remplace `teardownLivretPrint()` dans `main.js` et retire aussi la règle `@page portrait` : sans ça l'impression du planning perdrait son A4 paysage.
- **Table `dp_dossiers`** (jsonb plat, UNIQUE `stagiaire_id`). RLS **inversée par rapport au livret** : lecture `is_admin() OR is_prof() OR stagiaire_id = my_stagiaire_id()`, écriture `is_admin() OR stagiaire_id = my_stagiaire_id()`. Aucune politique d'écriture ne mentionne `is_prof()` : le DP appartient au candidat. `anon` révoqué explicitement (les default privileges du schéma public le lui avaient accordé à la création).
- **Composition dans `js/dp-rules.js`** (logique pure, `node tests/dp-rules.test.mjs`) : 4 rubriques d'ouverture, jusqu'a 6 fiches d'exemple, 2 rubriques de fin. Une fiche vide n'est pas imprimee, **sauf la n°1 de chaque activite-type** (un DP vierge doit rester imprimable). Les numeros de page ne sont plus calcules la : ils viennent de la pagination reelle.
- **Droits (revises le 16/09)** : les formateurs ECRIVENT dans le DP, pas seulement en lecture. `is_prof()` est dans les politiques INSERT et UPDATE de `dp_dossiers`. Le DP reste le document du candidat : `updated_by_who` trace la derniere main et la vue l'affiche. Retour arriere : rejouer les deux politiques sans `OR is_prof()`.
- **Derniere page (16/09)** : `js/main.js` memorise la route courante dans `localStorage` (cle `derniere-route`) et y revient au demarrage a froid, au lieu de forcer `mon-suivi`. Le sous-onglet, lui, se souvenait deja tout seul via `storageKey` de `js/subtabs.js`.
- **Pagination dans `js/dp-pagination.js`** : le gabarit produit un flux de blocs, le moteur les mesure et les repartit en feuilles A4, en coupant les zones de redaction entre deux lignes visuelles. En edition le flux n'est pas coupe, les coupures sont seulement materialisees : un champ reparti sur deux feuilles ne serait plus editable. Le document imprime est toujours le document compose, et il ne porte jamais de `data-k` : seul le flux d'edition est lu par `collectData`. Habillage releve dans le .docx officiel, voir `docs/specs/2026-09-14-dp-mise-en-page-officielle-design.md`.
- **Bancs du DP** : `_preview_dp.html` (document complet, sommaire, impression), `_preview_dp_moteur.html` (mecanique de composition, 21 controles dont deux scenarios eprouves par sabotage), `_preview_dp_vue.html` (la vraie vue avec modules factices, les deux roles). Couverture des cles : `node tests/dp-gabarit-cles.test.mjs`.
- **Piège résolu** : en édition, `buildDpFlux(data, { edition: true })` rend les **6** fiches, sinon le candidat n'aurait aucun champ où saisir sa 2e ou sa 3e. Les fiches vides portent `.dp-bloc-exclu` et leur mention, et sont absentes du flux d'impression, construit avec `edition: false`.
- **Re-rendu à pagination changeante** : remplir ou vider un exemple change sommaire et numérotation, donc le document est reconstruit. `wireDocEditing` pose ses écouteurs en **délégation** sur le conteneur : ils survivent au `innerHTML` et ne doivent être posés qu'une fois (drapeau `editionCablee`), sinon une frappe déclencherait N enregistrements. Seul `applyEditable(doc)` est ré-appliqué. Le curseur est replacé dans le champ actif après reconstruction.
- **Texte long jamais perdu** : une feuille a désormais une hauteur FIXE et le moteur répartit le texte sur autant de feuilles qu'il faut, en coupant les zones entre deux lignes visuelles. Conséquence à connaître : `corps.scrollHeight` vaut toujours `clientHeight` tant qu'il n'y a pas débordement, il ne mesure donc PAS la place consommée. La place restante se lit sur le bas du dernier élément posé. Un bloc insécable plus haut qu'une feuille est gardé entier et le corps reçoit `.dp-corps-deborde` : mieux vaut une feuille trop pleine qu'un texte rogné.
- **Deux entrées** : Notes → « Dossier pro » (liste pour les formateurs, son dossier pour un stagiaire) ET Mon suivi → sous-onglet « Dossier pro », qui ouvre le dossier de l'élève affiché via `renderDp(p, { stagiaireId })`. Édition si c'est le sien, consultation sinon. Un formateur **qui est aussi stagiaire** (cas `is_admin` + `stagiaire_id`, le compte du fondateur) voit sur sa propre ligne de la liste un bouton « Commencer / Remplir mon dossier » qui ouvre en édition : sans lui, il n'aurait aucun moyen de remplir son propre DP.
- **⚠️ `#dp-print { display: none }` hors `@media print`** : le clone d'impression vit en permanence dans le `<body>` tant qu'un dossier est ouvert. Sans cette règle, le document s'affiche **une seconde fois sous la vue**, en pleine largeur 210mm collé à gauche (symptôme constaté le 31/07). `livret.css` a la même règle pour `#livret-print`. La règle `body.dp-printable #dp-print { display: block !important }` de `@media print` la surcharge, l'impression n'est pas affectée.
- **Bancs d'essai** : `_preview_dp.html` (document seul, pagination, impression) et `_preview_dp_vue.html` (la vraie vue, `?role=stagiaire|formateur`, `?moi=1` pour le cas admin+stagiaire, `?dossier=<id>` pour l'entrée Mon suivi), via une **import map** qui substitue `_preview_stubs/db.js` et `_preview_stubs/auth-admin.js`. Aucune requête vers la prod.
- **⚠️ Piège de cache sur les branches de feature** : le hook ne re-versionne les tokens `?v=` que sur `main`, donc en local le navigateur resert indéfiniment l'ancien `dp.js?v=…` ET l'ancien `dp.css` (mesuré : 11 451 octets servis contre 12 294 sur le disque). Un rechargement forcé ne suffit pas toujours. Les deux bancs chargent donc leurs modules et leurs feuilles avec un `?cb=Date.now()`. Pour tester l'app elle-même : onglet privé, ou DevTools avec « Disable cache ».
- **Hors périmètre v1** : pièces jointes (pas de Storage), export `.docx`, signature électronique.

## Rubrique Nouveautés (01/08/2026, branche `nouveautes`)

Spec : `docs/specs/2026-08-01-nouveautes-design.md` · plan : `docs/plans/2026-08-01-nouveautes.md`

Où la promo retrouve les mises à jour de l'app, en complément du message WhatsApp qui reste le
canal de notification.

- **Contenu versionné**, pas de table Supabase : `js/nouveautes-data.js`. Écrire une nouveauté
  = ajouter un objet dans ce fichier, **dans le même commit que le code qu'elle annonce**.
- **Règles pures** dans `js/nouveautes.js` (`node tests/nouveautes.test.mjs`). Le test n'importe
  PAS le contenu réel : ajouter une entrée ne doit jamais casser une assertion.
- **Deux affichages, une seule carte** : 3 dernières dans Accueil (guide replié), toutes sur
  `#/nouveautes` (guide déplié). `carteNouveaute()` est exportée par `js/views/nouveautes.js`.
- **Route sans onglet**, comme `mon-suivi`. `ONGLET_POUR_ROUTE` dans `main.js` garde l'onglet
  Accueil allumé sur `#/nouveautes`.
- **Audience** : champ `pour` (`tous` ou `formateurs`), filtré à l'affichage ET dans le compte
  de la pastille. Reprise de juillet : 9 entrées, dont 3 réservées aux formateurs.
- **Non-lu** : `localStorage["ecsr_nouveautes_vues"]`, liste d'ids. Accueil ne marque que les
  entrées qu'il affiche, la page complète marque tout. La pastille se rafraîchit par l'événement
  `nouveautes-vues` (window), ce qui évite un import circulaire home.js ↔ main.js.
- **⚠️ Piège CSS** : le `@media (max-width: 760px)` masque les libellés d'onglets par
  `.tab span { display: none }`. La pastille doit être ciblée en `.tab .tab-badge` (spécificité
  0,0,2,0 contre 0,0,1,1), sinon elle est invisible sur téléphone, là où elle sert le plus.
  Vérifié au banc, ordre défavorable compris.
- **⚠️ Ordre dans Accueil** : le compteur J−N vise `.home-nouveautes` en priorité, sinon il
  s'insérerait sous les nouveautés puisqu'il ciblait `.home-tiles`, descendu d'un cran.
- **Deux bancs d'essai**, tous deux en `?role=stagiaire|formateur`, réutilisant le stub
  `_preview_stubs/auth-admin.js` du Dossier Professionnel :
  - `_preview_nouveautes.html` : la page complète (filtre d'audience, marquage, lien de sous-onglet).
  - `_preview_home.html` : fait tourner le vrai `renderHome` (base factice `_preview_stubs/db-home.js`)
    et **affiche un verdict OK/ECHEC** sur l'ordre des sections et le marquage partiel. Il existe
    parce que l'ordre d'Accueil est un couplage fragile que rien ne signale à l'écran.
- **⚠️ Un banc doit importer en dynamique avec `Date.now()`**, jamais `?cb=1`. Une constante est
  mise en cache par le navigateur : le banc resert alors la version d'avant la modification et
  valide du code qui n'est plus sur le disque. Constaté le 01/08 en réintroduisant volontairement
  la régression de l'ancre du compteur : le banc passait au vert. Les deux bancs ont été corrigés,
  et la régression est bien détectée depuis.

## Cours en base (09/08/2026, EN PROD)

Les 57 cours du dossier formation vivent dans Supabase (tables `cours` + `cours_versions`,
bucket `cours-images`) ; le depot `cours/theme_XX_*/` est l'archive figee de la version
verifiee d'origine, `cours_publies/` (depot ECSR) porte l'export sens unique
(`tools/export_cours.py`, lecture seule, cle service dans le `.env` racine ECSR).

- **Lecteur** (`js/views/cours-reader.js`) : ouvert depuis la page Themes (badge « Cours »,
  CTA « Lire le cours »), rendu markdown maison (fiche « L'essentiel », tableaux avec
  pastilles de couleur, planches `:::signaux` / `:::marquage`, sources repliees, images).
  RLS : un stagiaire ne voit que le publie ; formateurs et admin voient tout.
- **Editeur** (`js/views/cours-editeur.js`) : bouton « Modifier » (roles prof/admin),
  markdown + apercu partage avec le lecteur, garde-fou optimiste (bandeau conflit
  Ecraser/Abandonner), versions archivees a chaque enregistrement (restauration en un clic),
  Publier/Depublier, televersement d'images (reduction canvas 1600 px), Ctrl+Z natif
  preserve (execCommand), galerie de panneaux filtrable.
- **Catalogue de panneaux** : 384 SVG officiels (Wikimedia Commons, domaine public) dans
  `assets/signaux/catalogue/`, manifeste genere `js/signaux-catalogue.js` (intitules
  Wikipedia FR, 305/384), script rejouable `scripts/construire_catalogue_signaux.py`.
  Le registre verifie de `js/signaux.js` (20 codes + 4 familles) garde la priorite.
- **Etat au deploiement** : 57 cours en base (`published = false`, md5 57/57 identiques a
  l'origine), 57 versions d'origine. Publication = decision formateur, cours par cours.
- Banc : `_preview_cours.html` (git-exclu, stubs `_preview_stubs/db-cours.js` +
  `auth-admin.js`) ; attention au token `?v=` des cles d'import map apres cache-bust.

## Modules débloqués par les formateurs (chantier B, octobre 2026)

Spec : `docs/superpowers/specs/2026-10-01-modules-design.md` · plan :
`docs/superpowers/plans/2026-10-01-modules.md`

Les formateurs ouvrent les parties de l'app au fil de la progression d'une promo
(Paramètres › Modules de la promo).

- **État** : clé `modules` de `settings`, texte JSON `{v, depuis, ouverts: {clé: heure ISO}}`.
  Elle sera propre à chaque promo une fois le multi-promo (chantier A) en ligne : tant qu'il n'existe
  qu'une promo, il n'y a qu'une clé. Clé absente = **tout ouvert** (promo de mars). Lu et écrit
  **uniquement** par `js/modules-etat.js` (via `getSetting` / `setSetting`). Écritures mises en
  file, relecture juste avant d'écrire, lecture périmée ignorée ; « Partir de l'ensemble de départ »
  ne remplace jamais un réglage lisible déjà en base. Démarrage borné : au-delà de 3,5 s, la barre est
  dessinée d'après la copie de l'appareil (sinon tout ouvert) et la vraie réponse la redessine à son
  arrivée (`chargerModulesAuDemarrage`).
- **Catalogue** : `js/modules-data.js` (12 modules, groupes, parent, ensemble de départ, accords,
  textes d'annonce). Ajouter un module = une entrée + `module: "<clé>"` sur le sous-onglet, ou sa
  route dans `MODULE_DE_ROUTE`. Un module ajouté arrive **fermé** chez les promos réglées.
- **Règles pures** : `js/modules.js`, `node tests/modules.test.mjs` (contrôle aussi le catalogue
  réel et le rattachement des nouveautés écrites).
- **Masquage déclaratif** : `renderTabs` (main.js), `renderSubTabs` (champ `module`), garde dans
  `navigate()` (avec message) et `derniereRoute()` (silencieuse). Points explicites : colonnes
  Cours et QCM de Thèmes (`coursVisible`, `canSeeQcm` figé au chargement de l'index par
  `qcmAffiche`), note de matrice, date de naissance (Livret), anonymat (Notes), agenda d'Accueil
  (Calendrier), bulle (`appliquerModuleAssistant`), bouton « Aujourd'hui ».
- **Formateurs** : voient tout ; ce qui est fermé porte le repère « Masqué aux stagiaires »
  (`repereMasque()`, classe `module-masque`, œil `marque-masque`). Pièges : `.tab span
  { display: none }` sur mobile, d'où `.tab .marque-masque` en 0,2,0, posé en absolu sur le coin de
  l'icône (en flux, trois onglets repérés faisaient déborder la barre à 375 px) ; l'en-tête du
  tableau de Thèmes est masqué sous 720 px, d'où la bande `.a-repere` qui n'affiche que les
  colonnes repérées.
- **Nouveautés** : chaque ouverture postérieure à la mise en place devient une annonce (id
  `module-<clé>-<heure>`). Point unique : `nouveautesAffichables()` et `marquerLues(ids)` dans
  `modules-etat.js`, seuls appelants de `vuesEffectives` et `marquerVues` : la date d'amorce du
  multi-promo s'ajoute là. `purger()` épargne les ids `module-`. Le champ `module` d'une nouveauté
  écrite la masque aux stagiaires d'une promo où ce module est fermé.
- **Réglage réservé au fondateur** tant que `REGLAGE_OUVERT_AUX_FORMATEURS` vaut `false` : avant
  le multi-promo, un formateur fermerait des modules à la promo de mars.
- **Première bascule** d'une case sur une promo libre ou illisible : confirmation (elle fige un
  réglage pour tous les stagiaires, et l'app ne sait plus revenir à « aucun réglage »). Refus : la
  case revient, rien n'est écrit.
- **Avec le multi-promo (A)** : drapeau `REGLAGE_OUVERT_AUX_FORMATEURS` à `true` (entrée
  Nouveautés « formateurs » commune avec A), clé de copie de l'appareil propre à la promo
  (`cleCopie()` via `getPromoCourante()`), date d'amorce de A dans `nouveautesAffichables()`, et
  écriture de la clé `modules` couverte par la preuve de A (`tests/sql/multi-promo-preuve.sql`).
  La section « Modules de la promo » nomme la promo qu'elle règle (en-tête et confirmations).
  Reste à l'étape 4 de A : régler la promo de septembre (« Partir de l'ensemble de départ »,
  connecté sur cette promo) **avant** d'inviter ses stagiaires, sinon elle voit tout.
- **Marche arrière** vers l'état « aucun réglage » (tout ouvert) : l'app ne sait pas le faire, c'est
  une migration, `delete from public.settings where key = 'modules';` (avec la condition de promo
  une fois A en ligne).
- **Bancs** : `_harness.html` (app complète), `_harness_build.mjs` et `_harness_supabase.js` ne sont
  **pas versionnés** : ils vivent dans `C:/Users/watch/Dev/ECSR/TP_ECSR_App` (exclus de git). Leviers
  d'URL : `?modules=depart|notes|themes|enfant|illisible`, `?role=prof`, `?date=2026-10-20` (pour
  qu'une bascule soit postérieure au réglage factice du 05/10), `?lenteur=<ms>` (retarde chaque
  lecture du faux client : preuve du démarrage borné ; ajouter `&lenteur_tables=settings` pour ne
  pas retarder aussi l'ouverture de l'app). `_harness_build.mjs` génère la page et remappe
  chaque module vers une URL neuve : plus besoin de re-versionner une branche pour tester. Seuls
  `_preview_modules.html` (peint par le pane, `?fondateur=1`, fermé au réseau par sa CSP, jeton lu
  dans `index.html`) et ses doublures `_preview_stubs/` sont versionnés.
- **Preuve RLS** (02/10, avant multi-promo, transaction annulée) : un stagiaire ne peut pas écrire
  la clé `modules`, un formateur le peut. À rejouer avec l'en-tête `x-promo-id` une fois A en ligne.

## Multi-promo (octobre 2026)

Spec : `docs/superpowers/specs/2026-10-01-multi-promo-design.md` · plan : `docs/superpowers/plans/2026-10-01-multi-promo.md`.

- **Modèle** : table `lieux` (Nîmes 1, Montpellier 2) et `promos` : 1 = « Nîmes, mars 2026 », rattachée au lieu Nîmes (1) ; 2 = « Montpellier, septembre 2026 », rattachée au lieu Montpellier (2). `mes_promos()` donne aussi `nb_stagiaires`, que le choix de promo affiche avec les jours avant la fin. Les autres promos et lieux se créent par migration.
- **Contexte** : chaque requête vers `/rest/v1/` porte l'en-tête `x-promo-id` (ajouté par `fetchWithTimeout` de `db.js` ; jamais vers les fonctions Edge, l'auth ni le stockage). La base vérifie : `promo_courante()` (en-tête accessible ; absent : promo par défaut ; interdit ou fantaisiste : rien), `lieu_courant()`, `mes_promos()`, `peut_acceder_promo()`. Stagiaire : sa promo ; formateur, admin pur, fondateur : toutes. Défaut : la promo de la fiche, sinon la plus ancienne en cours.
- **Propre à une promo** (colonne `promo_id`, règle `promo_id = (select promo_courante())` ajoutée aux règles de rôle) : stagiaires, notes, passages et historiques, planning (cartes, horaires, jours off), calendrier, réglages (`settings` ; `chatbot_quota_jour` reste global, `promo_id` nulle), tentatives QCM, EPCF, livret, DP, fiches de suivi, `themes_progression` (fait, dates) et `qcm_examens` (examen ouvert, tirage gelé, échéance). Pour les tables liées à un stagiaire, un trigger impose la promo de la fiche.
- **Propre à un lieu** (`lieu_id`) : bénévoles, auto-écoles, suivi des venues. Les venues se lisent par la RPC `venues_benevoles()` (promos du même lieu ; réservée aux admins).
- **Commun** : référentiel des thèmes, compétences, cours, banque QCM, signalements, ressources, contacts, formateurs.
- **App** : règles pures `js/promo-rules.js` (`node tests/promo-rules.test.mjs`) ; contexte dans `db.js` (`chargerMesPromos`, `getPromoCourante`, `choisirPromo`, `avantChangementPromo`, `rechargerApresEnregistrements`) ; `getMyProfile()` renvoie le profil effectif (un compte stagiaire sans fiche dans la promo y est admin pur) ; pastille `js/promo-pastille.js` (au moins deux promos, dialogue accessible) ; choix mémorisé par appareil et par compte (`ecsr_promo:<email>`) ; la bascule attend les enregistrements du planning puis recharge. Si `mes_promos()` échoue deux fois : bandeau durable « Promos non chargées » (promo par défaut servie). Liste vide : session refusée, motif affiché sur la porte (événement `ecsr:refus-porte`, écouté par `gate.js`).
- **Preuve** : `tests/sql/multi-promo-preuve.sql`, à rejouer (via `execute_sql`) après toute migration qui touche aux règles d'accès : verdict dans le message de l'exception finale, rien n'est écrit. Les refus d'écriture s'y testent **sans** `RETURNING` de colonne (sinon la règle de lecture masque une règle d'écriture fautive). Répétition d'une migration : lot `begin;` + `tests/sql/multi-promo-photo.sql` + migration + preuve (la photo prouve la non-régression de mars).
- **Pièges** : une migration n'a pas de promo courante (insérer avec `promo_id` explicite) ; `settings` n'accepte une promo nulle que pour les clés globales prévues (CHECK `settings_globaux_prevus`) ; `getSetting`/`setSetting` sont propres à la promo ; une nouvelle table propre à une promo reçoit sa colonne, sa règle et une ligne dans le script de preuve ; ne jamais relire les anciennes colonnes de `themes` et `qcm` (supprimées à l'étape 5 du plan) ; les migrations commencent par `set local lock_timeout = '3s';` (échec propre plutôt qu'une app bloquée derrière un verrou).

## Barre simple et onglet CCP2 (chantier D, octobre 2026)

Spec : `docs/superpowers/specs/2026-10-03-onglets-ccp-design.md` (version 2) · plan :
`docs/superpowers/plans/2026-10-03-onglets-ccp.md`. Une première version (onglet CCP1 regroupant
Thèmes, Notes, EPCF, Livret et Dossier pro) a été écartée par Timy le 03/10 : elle reste dans
l'historique git de la branche `onglets-ccp`.

Principes : un onglet ne déménage jamais (il peut seulement apparaître) ; une chose, un endroit,
selon qu'on est stagiaire ou formateur ; **Mon espace = ce qui est à moi, Notes = la classe**.

- **Barre** (`js/main.js`) : plus d'onglet Priorités ; Thèmes s'affiche « Cours » (icône `book`,
  route `themes` inchangée) ; onglet **CCP2** (icône `ccp2`, carré marqué 2) gouverné par le module
  `ccp2`. Huit onglets tiennent sur un iPhone de 375 px.
- **Priorités** : bouton dans l'en-tête du Planning (`routeVisible("dashboard")`, repère chez un
  formateur si le module est fermé) ; la page garde `#/dashboard`, `ONGLET_POUR_ROUTE` y allume
  l'onglet Planning, un bouton « Planning » ramène.
- **Cours** (`js/views/themes.js`) : en-tête commun (progression des 57 thèmes, tenue par
  `ligneProgression` car elle est hors du panneau), sous-onglets Thèmes et Compétences
  (`ENSEMBLES` : thèmes officiels + QCM transversaux ; compétences formateur, conduite, notions,
  filet), plus Signalements pour les formateurs ; pastille active mémorisée par sous-onglet
  (`familleActive`) ; pastilles masquées s'il n'y a qu'une famille.
- **Notes** : Matrice et EPCF pour tous ; Livret EPCF et Dossier pro réservés aux formateurs
  (remplacés au lot 2 par la page Stagiaires, section suivante).
- **Mon espace** : sous-onglet **Livret EPCF** ; `renderEpcfLivret(p, { stagiaireId })` ouvre le
  livret de l'élève affiché, en saisie pour un formateur ; un stagiaire voit le sien en lecture.
- **CCP2** (`js/views/ccp2.js`) : texte versionné dans `js/ccp2-parcours-data.js` (critères du REAC
  mot pour mot, exigences du référentiel d'évaluation), dates tirées de `listAgendaEvents()`
  (titre contenant « CCP2 », types formation, stage, examen, si le Calendrier est ouvert), dernière
  étape ouverte mémorisée (`ecsr_ccp2_etape`), nombres insécables (`insecables`, `js/ccp-rules.js`).
- **Modules** : groupe « CCP2 » et module `ccp2` ; noms affichés « Cours » (clé `themes`) et
  « Lecture des cours » (clé `cours`) ; Livret EPCF n'a plus Notes pour parent ;
  `STORAGE_SOUS_ONGLET.themes` pour les liens « Où le trouver » vers un sous-onglet de Cours.
- **Tests** : `node tests/modules.test.mjs`, `node tests/ccp-rules.test.mjs` (texte du parcours :
  forme, liens, aucun cadratin, jamais « prof »).
- **Convention pour les formateurs** : le titre d'un stage ou d'un examen du CCP2 contient
  « CCP2 », sinon il n'apparaît pas dans le parcours.
- **Assistant** : `aide.mjs` décrit la nouvelle barre ; fonction `chatbot` redéployée le 03/10
  (version 8).
- **Banc** : après chaque `node _harness_build.mjs`, ouvrir `_harness.html` avec un paramètre
  neuf (`?cb=…`) : le navigateur garde la page en cache avec l'ancien jeton, donc les anciens
  modules, et un test peut passer au vert sur du code qui n'est plus sur le disque.

## Page Stagiaires et fiche en sommaire (chantier D, lot 2, octobre 2026)

Spec : `docs/superpowers/specs/2026-10-03-espace-stagiaires-design.md` · plan :
`docs/superpowers/plans/2026-10-03-espace-stagiaires.md`.

- **Adresses à segments** : `#/<route>/<id>/<partie>` (`js/route-rules.js`, pur). Le routeur
  choisit la page sur le premier segment ; la page lit le reste. Parties d'une fiche : `passages`,
  `epcf`, `evolution`, `livret`, `dp`.
- **Mise à jour sur place** (`js/navigation.js`) : une page s'inscrit avec
  `surChangementAdresse(route, fn)` ; quand seule la fin de l'adresse change, `navigate()`
  l'appelle au lieu de reconstruire la vue. `navigate({ force: true })` (Actualiser, changement de
  rôle, Réessayer) reconstruit toujours.
- **Garde de saisie** (`js/navigation.js`) : `poserGardeSortie({ estSale, message })` ;
  `navigate`, Actualiser, Aujourd'hui, les sous-onglets et la fermeture de la page la consultent.
  La grille EPCF est la seule vue à en poser une (le livret et le dossier s'enregistrent seuls).
- **La fiche** (`renderFiche`, exportée par `js/views/mon-suivi.js`) : onglets sur ordinateur,
  sommaire puis partie en plein écran sur iPhone (760 px et moins, disposition choisie à
  l'affichage). États calculés par `js/fiche-rules.js` (pur). Mon espace = sa propre fiche ; la
  page Stagiaires (`js/views/stagiaires.js`) = liste + fiche d'un stagiaire. Sur ordinateur, la
  fiche choisie par défaut est inscrite dans l'adresse (Précédent revient à la fiche d'avant).
- **États sans relecture** : le livret et le dossier émettent `document-enregistre` après un
  enregistrement ; une évaluation EPCF enregistrée remonte par `onEpcfEnregistre`.
- **Accès** : `pagePersonnelle()` ; un formateur sans profil stagiaire est conduit de
  `#/mon-suivi` à `#/stagiaires`, un stagiaire de `#/stagiaires` à `#/mon-suivi`.
  `monStagiaireId()` traite l'aperçu « Formateur » du fondateur comme un vrai formateur.
- **Notes** : Matrice et moyennes EPCF pour tous ; la saisie EPCF, le livret et le dossier sont
  dans la fiche.
- **Aucune règle d'accès nouvelle** : vérifié en production le 03/10 (`pg_policies`), les
  formateurs lisent et écrivent EPCF, livrets et dossiers de leur promo.
- **Banc** : `?ecritures=1` garde en mémoire les insertions et upserts (EPCF, livret, dossier)
  le temps de la page, pour vérifier qu'un état se met à jour après un enregistrement.

## Cours des compétences de conduite (programme B, C1 à C4)

Spec et plans dans le dépôt ECSR : `docs/superpowers/specs/2026-10-03-cours-competences-remc-design.md`,
`docs/superpowers/plans/2026-10-03-cours-competences-remc-plan-1.md`, `docs/superpowers/plans/2026-10-07-cours-competences-remc-plan-2-c1.md` (lot C1).

- **Clé de cours** : un cours porte un numéro (les 57 thèmes) ou un code (`C2.4`), jamais les deux
  (contrainte `cours_numero_ou_code`). `cleCours()` dans `js/cours-rules.js` ; `getCours(cle)`.
  Le référentiel (`themes`) porte la même colonne `code` pour les 36 lignes REMC.
- **Blocs** (`js/cours-blocs-rules.js` pour l'analyse, `js/cours-blocs.js` pour le DOM) : `:::scene <code>`,
  `:::quiz ordre | vrai-faux | choix`, `:::cartes`. Un bloc mal formé s'affiche en texte brut ; l'erreur
  n'apparaît que dans l'aperçu de l'éditeur (encadré « À corriger dans les blocs »).
- **Scènes** : données dans `js/scenes.js`, géométrie pure dans `js/scene-geometrie.js` (mètres, repère
  écran, cap croissant à droite), décors dans `js/scene-decors.js` (dimensions de l'IISR 7e partie),
  regard dans `js/scene-regard.js`, aides de rendu pures dans `js/scene-rendu.js`, rendu dans
  `js/scene-moteur.js`. **Règle : une scène qu'on ne sait pas rendre exacte n'est pas dessinée.**
  `node tests/scenes.test.mjs` passe chaque scène aux contrôles automatiques (`js/scene-controles.js`) :
  trottoirs, contacts, vitesse, accélérations, clignotant, priorités. Si un contrôle refuse, on corrige la
  géométrie, jamais le seuil. Le clignotement se compte depuis l'allumage du clignotant.
- **Lot C1 (plan 2, 08/10/2026)** : cinq scènes de plus (`regard-intersection` C1.8, `trajectoire-courbe` C1.7,
  `demarrer-arreter` C1.4, `marche-arriere` et `demi-tour` C1.9) et ce qu'elles demandaient au moteur :
  - **Marche arrière** : `trajet(x, y, cap, { arriere })`, `inverser()` (rebroussement sur place), `rebroussements(chemin)`
    fait foi ; la caisse ne pivote pas au rebroussement ; `etatActeur(...).marche` ; `feuxDeRecul(e)`.
  - **Essieu arrière** : `trajet(..., { essieu: GABARITS.voiture.essieu })` (1,45 m) : les segments décrivent le milieu
    de l'essieu arrière, `pointA` rend le centre ; abscisses et allures (donc les contrôles de vitesse) sont celles de
    l'essieu ; `trajet().position` rend l'essieu. Défaut inchangé (le pilote pivote au centre).
  - **Regards** : `{ tour: true }` (0 à -360, au moins 4 s ; quatre cônes sur image figée) ; `{ vers: [x, y] }`
    (dirigé vers un point du monde, recalculé à chaque instant).
  - **Feux** : `feuxStop(acteur, e)` ; une voiture posée `stationne: true` ne les allume jamais.
  - **Contrôles** : allure de recul (`SEUILS.vitesseMarcheArriere`, 6 km/h, message au pic), arrêt à chaque
    rebroussement, clignotants datés pendant un arrêt (`{ cote, de, a, delai, delaiFin }`, « le dernier allumé
    l'emporte »), instants de bascule contrôlés dans l'arc et dans les 2 s d'avance, `pasDeDeceleration`.
  - **Décors** : `rue({ longueur, largeurTrottoir, largeurVoie, stationnement })`, `routeVirages`.
  - **Repères des animations réduites** : une seule règle des places (`placeRepereLibre`, prédicat `libre`) : jeu de
    0,3 m autour des acteurs posés, aucun acteur posé entre l'élève et son repère, cônes du tour figé protégés ;
    quatre numéros consécutifs ou plus s'écrivent en plage (`libelleRepere` : « 10-15 »).
  - Mineures restantes du lot C1 : `.superpowers/sdd/p2-mineures-ouvertes.md` du dépôt ECSR.
- **Lot D1 (plan 3, octobre 2026) : dessins des cours de compétences** (24 blocs `:::dessin` et `:::scene` pour C1.1 à
  C1.3). Moteurs, registres et dessins se chargent à la demande, au premier bloc qui en a besoin (`chargerModule` de
  `js/cours-blocs.js`, table `CHARGEURS`) ; les sources des scènes et des dessins vivent dans `sources/`, jamais
  chargées par l'app. **Octets de JavaScript au démarrage** (mesure du 15/10/2026 : l'app entière sur le banc
  `_harness.html`, Chrome à 375 px, chaque module demandé jusqu'au silence du réseau, rôles stagiaire et formateur,
  octets des blobs git, fins de ligne LF comme sur Pages) : avant le lot (`7c95cbf`), 77 modules, 1 334 487 octets
  (412 434 en gzip), dont les sept modules des scènes ; après (`cours-remc`), 71 modules, 1 086 510 octets (340 643 en
  gzip), aucun moteur, registre ni dessin, `js/catalogue-blocs.js` en plus : **-247 977 octets (-18,6 %), -71 791 en
  gzip (-17,4 %)**. Le test `tests/chargement.test.mjs` garde le graphe des imports statiques depuis `js/main.js`.
- **Tests** : sous Node 24, `node --test tests/` échoue (dossier chargé comme un module) ; lancer
  `node --test "tests/*.test.mjs"`.
- **Bancs** : `_preview_cours.html?cle=C2.4` (lecteur et éditeur), `_preview_scenes.html` (planche de revue,
  `?reduit=1`), servis sans cache par `_serveur_banc.py` (non versionnés).
- **Assistant** : `chercher_cours` renvoie `code` ; l'étiquette devient « Competence C2.4 ».
- **Visibilité** (migration `20261005_cours_competences_4_fondateur.sql`) : un cours de compétence non publié
  n'est visible et modifiable que du fondateur (`is_founder()`, un seul compte) ; Timy vérifie chaque cours, un par un,
  puis le publie lui-même. Publié, il suit les règles des autres cours. L'assistant ne cite que les cours publiés.

## Tableau de bord du centre (23/10/2026)

Spec : `docs/superpowers/specs/2026-10-23-tableau-de-bord-centre-design.md` · plan :
`docs/superpowers/plans/2026-10-23-tableau-de-bord-centre.md`.

- **Page** `#/centre` (`js/views/centre.js`), personnel seulement (même porte que Stagiaires), tuile
  « Tableau de bord » de l'Accueil, `ONGLET_POUR_ROUTE.centre = "home"`. Aucune migration.
- **Calculs purs** : `js/centre-stats.js` (indicateurs `{ valeur, detail, nature, methode, n }`, thèmes,
  signaux ; `node tests/centre-stats.test.mjs`) et `js/centre-csv.js` (matrice des notes pour Excel ;
  `node tests/centre-csv.test.mjs`). Les textes de méthode sont dans `METHODES` : les modifier là.
  Tout sauf l'effectif et les abandons porte sur les stagiaires en formation (fiches actives).
- **Lire une autre promo** : `lireDonneesCentre(promoId)` pose l'en-tête INTERNE `x-promo-lecture` ;
  `fetchWithTimeout` le retire toujours et, par `promoDeLaRequete` (`js/promo-rules.js`), le traduit en
  `x-promo-id` pour une lecture vers une promo de `mes_promos()`. Écriture ou promo hors liste : refus,
  jamais de repli sur la promo courante. La base reste juge (`promo_courante()`).
- **PDF** : `@page A4 portrait` injectée au clic et retirée à `afterprint` et dans `navigate()`
  (`teardownCentrePrint`), comme les documents officiels.
- **Banc** : `_harness.html?role=prof&centre=1&demo=1` charge la promo de démonstration (données fictives
  exportées en lecture seule dans `_banc_centre_demo.js`, non versionné) ; `&abandon=<id>` passe une
  fiche en abandon, `&fragile=<id>` lui donne deux absences et trois notes basses. Le faux client honore
  `setHeader("x-promo-lecture")` et `.range()`.
- **Limites dites sur la page** : pas de date d'abandon en base ; absences = seulement les passages
  prévus (l'émargement couvrira la présence) ; réussite au titre non saisie.

## Dossier Qualiopi (octobre-novembre 2026, branche `qualiopi`)

Spec : `docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md` · plan :
`docs/superpowers/plans/2026-10-28-dossier-qualiopi-q1-q2.md`. Aucune migration, aucune écriture en base. État au 06/11/2026 :
la branche n'est pas fusionnée dans `main`.

- **Page** `#/qualiopi` (`js/views/qualiopi.js`, `css/qualiopi.css`), chargée à la demande (`import()` dans `main.js`,
  boîte d'erreur lisible si le module ne vient pas). **Garde : `fondateurHorsApercu()`**, comme la page Problèmes :
  un autre profil, ou le fondateur en aperçu « Voir en tant que », est ramené à `#/home` sans un mot. Aucune entrée
  de barre ; seul le bouton « Qualiopi » du tableau de bord (`js/views/centre.js`) y mène.
- **Modules purs** (un test node chacun) : `js/qualiopi-referentiel.js` (33 indicateurs du décret n° 2026-728, dont 27
  applicables à un centre de formation continue, 28 avec l'alternance ; textes recopiés tels quels, empreinte épinglée), `js/qualiopi-preuves.js` (inventaire : ce que l'app prouve, par
  indicateur et par promo), `js/qualiopi-documents.js` (dossier de la formation, dossier du centre avec ou sans noms,
  CSV), `js/qualiopi-resultats.js` (fiche des résultats à publier, texte à copier), `js/qualiopi-page-rules.js` (règles
  de la page). `js/qualiopi-impression.js` n'est pas un module pur : il touche le DOM (montage et nettoyage de l'impression),
  testé avec un faux document, et c'est le seul module Qualiopi chargé au démarrage.
- **Lecture** : `lireDonneesQualiopi(promoId)` (`js/db.js`) lit les tables par `toutesLesLignes` (PostgREST rend 1 000 lignes
  au plus), avec l'en-tête interne `x-promo-lecture` ; promo nulle : erreur, jamais de repli sur la promo courante. Tables
  communes (signalements, cours, versions, formateurs) lues sans en-tête ; jamais `email`, `corps_md`, `saved_by`.
- **Version sans noms** : agrégats seulement ; bénévoles et auto-écoles en nombres dans toutes les versions ; ni nom
  d'« Autre », ni sujet de séance, ni titre d'événement.
- **Impression** : `@page` A4 portrait injectée au clic, retirée à `afterprint` et dans `navigate()`
  (`teardownQualiopiPrint`) ; `html:has(body.qualiopi-printable)` blanc pour que le bas d'une fiche courte ne prenne pas
  le fond de l'app. **Copie du texte** : `navigator.clipboard.write` avec un `ClipboardItem` d'une promesse, appelé dans le
  geste du clic avant toute lecture (Safari, Firefox) ; repli `writeText` après les lectures.
- **Banc** : `_harness.html?centre=1&qualiopi=1[&demo=1][&date=AAAA-MM-JJ][&qualiopi_noms=1]` (fondateur, sans `role`).
  `_banc_qualiopi_demo.js` (non versionné, relevé en lecture seule le 06/11/2026) porte le planning, le calendrier, le
  livret, le dossier pro, les auto-écoles, les formateurs, les cours et leurs versions de la promo 7 ; `qualiopi_noms=1`
  inscrit des formateurs au planning et met un prénom dans un sujet pour éprouver la version sans noms. La promo 7 finit le
  10/12/2026 : pour une fiche « publiable », geler la date après (`?date=2026-12-15`). Vérifié au 06/11 : chiffres de la
  promo 7 égaux aux requêtes de lecture, trois documents et deux fiches en PDF A4 (Chromium), 375 px sans défilement de côté.
- **Règles de comptage** : le déroulé réalisé ne compte que les jours de la promo jusqu'à la plus proche de sa fin et d'aujourd'hui,
  sans jour férié ni jour désactivé (`lignesDuPlanning`) ; sujets et bénévoles suivent la forme de l'activité, comme le planning ;
  la colonne du niveau s'intitule « Apport de l'application » (légende `PHRASE_NIVEAU`, absente du CSV pour garder 1 + 27 lignes) ;
  les annonces `navigation: "nouvelle"` ne sont ni comptées ni citées tant que la nouvelle barre est éteinte.
- **Limites connues** : émargement pas encore branché (l'assiduité reste « pas encore branché ») ; résultats de jury non
  saisis (« non saisi ») ; population « stagiaires en formation » (fiches actives) pour passages, notes, QCM, EPCF, livrets ;
  WebKit joué par Playwright (montage, nettoyage, largeur) sauf la pagination PDF, vue dans Chromium seulement ; page
  réservée au fondateur jusqu'à la refonte du lot 5.

## Questionnaires anonymes (Qualiopi Q3, novembre 2026, branche `qualiopi-q3`)

Spec : `docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md` (§ 4) · plan :
`docs/superpowers/plans/2026-11-08-qualiopi-q3-questionnaires.md` · textes à valider :
`docs/superpowers/specs/2026-11-08-qualiopi-q3-textes.md` (section « Points à trancher » en tête). **En ligne le
09/11/2026** : migration appliquée avec l'accord de Timy (essai à blanc sur la base réelle VERT 209/0, puis VERT 207/0),
Nouveauté datée du 09/11, branche fusionnée dans `main`.

- **Trois questionnaires** (`js/questionnaires-data.js`, versionnés) : fin de formation (stagiaires, de J-7 à J+30 de la
  fin de la promo), six mois après (de +6 à +7 mois), formateurs (par centre et par année civile). Échelle de 1 à 4 plus
  « Sans avis » (null), une question « globalement » qui donne le taux de satisfaction (réponses 3 ou 4 parmi les notes).
- **Écran** (`js/questionnaire.js`, règles pures `js/questionnaire-ecran-rules.js`) : bandeau sous la salutation de
  l'Accueil (ancienne navigation : `js/views/home.js` ; nouvelle : « Ta journée » des stagiaires, `js/views/accueil-stagiaire.js`,
  et « Aujourd'hui » de l'équipe, `js/views/aujourdhui.js`, avant les cartes) et dans Mon espace (ancienne navigation seulement : dans la nouvelle, Mon suivi garde son sommaire au-dessus
  de la barre du bas) ; le lien direct
  survit au démarrage à froid (exception dans `bootApp`, qui sinon replie sur la dernière page ou `home` en nouvelle
  navigation), « Plus tard » remis au lendemain (mémoire de l'appareil, par compte et par portée),
  fenêtre à une question par écran sur la mécanique de `js/nav-fenetre.js` (focus, Tab gardé, Échap ; progression
  annoncée en `aria-live` ; focus rendu au point de retour quand « Répondre » manque), lien direct
  `#/questionnaire/<clé>` (ouvre la fenêtre sur l'Accueil, ou un mot doux ; rien si la personne a quitté l'Accueil avant
  l'arrivée de la liste). Brouillon en mémoire de la session seulement, propre au compte : `memoireDeSession()` le vide
  (avec la liste des envoyés) quand le compte change sans rechargement (`onAdminChange`), et ferme la fenêtre ouverte.
- **Gestion** : section « Questionnaires de satisfaction » de la page Qualiopi (`js/views/qualiopi.js`, règles
  `js/questionnaires-gestion-rules.js`) : état (selon les dates, au jour de Paris comme la base, ou ouvert ou fermé à la
  main), résultats question par question, commentaires (écran seulement, masqués par « Sans aucun nom », jamais
  imprimés). Branchements Qualiopi (`js/qualiopi-preuves.js`, `-documents.js`, `-resultats.js`) : pièce
  « appréciations » (indicateurs 30 et 32), taux par promo ; une lecture en échec dit « non lue », seule la fonction absente
  (migration non appliquée) dit « pas encore en service » (décision R9).
- **Anonymat par construction** (migration `supabase/migrations/20261108_questionnaires.sql`) : la réponse n'a ni compte,
  ni date, ni numéro d'ordre ; la participation (compte et portée, sans date) est une table à part qui sert seulement à
  refuser une deuxième réponse. Aucune politique de lecture sur les réponses : tout passe par des fonctions. Contre le
  recoupement par l'ordre ou par la transaction (xmin) : chaque réponse réécrit toutes celles de sa portée dans un ordre
  aléatoire avec de nouveaux identifiants (rebrassage), sous un **verrou consultatif par portée** (deux envois simultanés
  ne laissent pas l'un hors du rebrassage), et le commentaire est recopié (`commentaire || ''`) pour qu'un texte long,
  rangé à part (TOAST), ne garde pas le xmin de son envoi. Limite écrite : un compte supprimé puis recréé pourrait répondre
  deux fois (repris avec la conservation, lot Q5). **Ce n'est pas un anonymat face à qui lit les tables** (éditeur SQL) :
  une portée à une seule participation, ou deux relevés des tables, relient une réponse à son auteur. Les textes ne
  promettent donc que l'application et le seuil (point 9 du document des textes, relecture finale I1).
- **Catalogue et base** : `js/questionnaires-data.js` et la table `questionnaire_questions` de la migration disent les mêmes
  ids, types, facultatives, options et versions ; `tests/questionnaires-data.test.mjs` relit l'insert de la migration et
  échoue sur le moindre écart. Une question retouchée touche les deux.
- **Seuils** : rien sous 5 réponses de stagiaires, 3 de formateurs (`seuilDe`), ni taux, ni compte, ni commentaire, à
  l'écran, dans un document ou dans le CSV ; la base applique le seuil elle-même. Commentaires : fondateur seul, ordre
  aléatoire, à partir du seuil.
- **Droits (lot 4)** : stagiaire = sa fiche (non anonymisée) dans la promo, hors aperçu ou en aperçu stagiaire sur la
  promo affichée ; formateur = hors aperçu, sans fiche, rôle formateur (`roles_reels`) sur au moins une promo du centre
  (décision R1 : le planning ne relie pas les formateurs aux comptes) ; gestion = `peut_gerer_qualite()`, qui vaut
  `est_fondateur()` (fondateur réel, hors aperçu) ; commentaires = `est_fondateur()`. La direction et le siège attendent
  le lot 5, qui élargira `peut_gerer_qualite()` en un seul endroit.
- **Banc** (faux Supabase `_harness_supabase.js`, non versionné, section « Questionnaires anonymes ») : les cinq fonctions
  simulées avec les mêmes refus et les mêmes droits (aperçu lu dans `ecsr_view_as`). Leviers :
  `questionnaires=absent` (migration non appliquée), `questionnaires_jour=AAAA-MM-JJ` (jour de la base, défaut
  2026-12-05), `questionnaires_n` et `questionnaires_n_formateur` (réponses semées), `questionnaires_ouverture=ferme|ouvert`,
  `questionnaires_panne=lecture|ouvrir|commentaires|droit`, `questionnaires_lenteur=<ms>` (liste en retard),
  `fiche=<id>` avec `centre=1&role=stagiaire&fondateur=0` (stagiaire de la promo de démonstration 7, par exemple 1634).
  Fondateur : `centre=1&demo=1&qualiopi=1&role=fondateur&questionnaires_n=8` puis `#/qualiopi`. Robot : parcours
  `repondre-au-questionnaire` (`outils/parcours/questionnaires.py`).
- **Preuve locale** (`tests/sql/questionnaires-preuve.sql`, recette dans son en-tête) : Postgres jetable de scoop, schéma
  minimal du lot 4 (`tests/sql/questionnaires-schema-minimal.sql`, `-v lot4_fonctions=`), migration et retour joués par
  `EXECUTE` entre deux empreintes, levée finale qui annule tout. Attendu : VERT 209/0 (207/0 sur une base où la migration
  est déjà appliquée). **Piège** : appliquer la migration par `psql -f` sous Windows sans `PGCLIENTENCODING=UTF8`
  enregistre les messages d'erreur en mauvais encodage (chaque lettre accentuée devient deux caractères), et l'app
  les montre tels quels.
- **Fait le 09/11/2026** : textes arbitrés (dix points, conditions 2026-11-08), migration appliquée, preuve rejouée sur la
  base réelle, Nouveauté datée du jour. Pour rejouer la preuve sur la base réelle : remplacer les deux `pg_read_file` par
  le texte des fichiers (les comptes fictifs sont déjà créés après leurs profils, à cause de la liste blanche). Tant que la
  migration n'est pas appliquée, l'app ne montre rien et n'affiche aucune erreur (décision R2) : fusion et poussée après
  l'application seulement.
- **Mise en ligne, dans cet ordre** (après l'accord de Timy sur les textes et sur la migration) :
  1. Appliquer la migration `20261108_questionnaires.sql` en production d'abord. Par `psql` sous Windows, toujours avec
     `PGCLIENTENCODING=UTF8` (sinon les messages de refus sont enregistrés en mauvais encodage).
  2. Rejouer la preuve `tests/sql/questionnaires-preuve.sql` sur la base réelle, telle quelle : tout se passe dans son
     bloc `DO` qui finit toujours par une levée, donc rien ne reste écrit. Attendu : VERT 207/0 (migration déjà là).
     Hors de la base locale, `pg_read_file` n'est pas permis : remplacer ses deux appels par le texte des fichiers (en-tête
     de la preuve).
  3. Corriger la date de l'entrée Nouveautés (`js/nouveautes-data.js`, id et date `2026-12-04`) au jour réel de mise en
     ligne, et son test (`tests/nouveautes.test.mjs`, qui fige cette date) : sinon une Nouveauté datée dans le futur part.
  4. Puis seulement fusionner dans `main` et pousser. **Jamais de poussée avant la migration** : « aucune erreur à
     l'écran » (décision R2) ne vaut pas permission, car le navigateur inscrit lui-même dans la console un 404 de
     PostgREST à chaque rendu de l'Accueil et de Mon espace, et le lien direct affiche son mot doux. Le banc (faux
     client) ne peut pas le montrer.

## Registre qualité (Qualiopi Q4, en ligne le 10/11/2026)

Plan : `docs/superpowers/plans/2026-11-09-qualiopi-q4-registre.md`. Migration `20261109_registre_qualite.sql` appliquée en production le 10/11/2026 avec l'accord de Timy.

- **Page** : sous-onglets « Inventaire et documents » et « Registre qualité » de `#/qualiopi` (`js/views/qualiopi.js`,
  `js/views/registre-qualite.js`) ; fenêtre de saisie `js/registre-fenetre.js` (`ouvrirFenetreRegistre`), partagée avec
  « Problèmes signalés » ; styles dans `css/qualiopi.css` (chargé partout).
- **`avantFermeture` de `js/nav-fenetre.js`** : une fenêtre peut refuser une fermeture demandée par un geste (« Fermer »,
  voile, Échap, `demanderFermeture()`) ; celle du registre demande « Fermer sans enregistrer ? » par `confirmer()` et se
  ferme elle-même sur oui. **Limite connue** : l'adresse qui change (`hashchange`, geste retour, la page a déjà changé) et une
  fermeture par le programme (`fermerFenetre()`, barre remontée dans `js/nav-shell.js`, autre fenêtre ouverte par-dessus)
  ferment la fenêtre **sans demander** : une saisie modifiée s'y perd.
- **Banc** : `_harness.html?centre=1&demo=1&qualiopi=1&registre=1` puis `#/qualiopi` (six entrées, deux à effacer) ;
  `registre=absent`, `registre_panne=lecture|ecriture`.
- **Droits** : une seule règle, `peut_gerer_qualite()` (créée par Q3, vaut `est_fondateur()` : le fondateur réel, hors
  aperçu). Q4 la lit, ne la recrée pas et ne la retire pas dans son retour. Lecture, ajout et modification sous cette
  fonction ; aucune suppression (le registre est une preuve : une erreur se clôt avec une réponse qui le dit) ; `anon` n'a
  rien. Un formateur ou un stagiaire qui tape `#/qualiopi` revient à l'accueil sans un mot (porte de `js/main.js`).
- **Lien vers le signalement qui tombe à nul** : `signalement_id` est `on delete set null` (unique). `signaler_probleme()`
  purge les signalements de plus de 12 mois, chez la personne qui signale, et la fermeture d'un compte les efface en
  cascade : le déclencheur laisse donc passer cette mise à nul seule, pour tout compte et même sur une entrée effacée, sans
  rien changer d'autre (`modifie_le` compris). La marque `issu_signalement` garde la trace. Aucun nom, aucun e-mail n'est
  recopié d'un signalement : l'origine seulement.
- **Effacement manuel à 3 ans** : `effacer_registre_qualite()` (fonction du fondateur, rien ne tourne seul). Une entrée
  close dont `clos_le + interval '3 years' < now()` perd ses quatre textes libres (description, réponse, action décidée,
  mesure de prévention) ; type, origine, promo, lieu, dates et état restent. Une seule échéance, écrite à l'identique dans
  le déclencheur (qui refuse aussi un effacement par écriture directe avant l'échéance), la fonction et `aEffacer()` de
  `js/registre-rules.js`. Une entrée jamais close ne s'efface jamais : elle est signalée « à clore » après 3 ans. L'effacement
  dû se rappelle en tête de la page Qualiopi, quel que soit le sous-onglet.
- **Banc** (`_harness_supabase.js`, section « Registre qualité », non versionné) : `?registre=1` sème six entrées (un de
  chaque type, deux closes depuis plus de 3 ans, une issue du signalement 101) ; `registre=absent` (migration non
  appliquée : PGRST205 et PGRST202) ; `registre_panne=lecture|ecriture`. Hors fondateur ou sous un aperçu : lecture vide,
  ajout refusé. Fondateur : `_harness.html?centre=1&registre=1&role=fondateur` puis `#/qualiopi` (ajouter `&demo=1&qualiopi=1`
  pour les données du dossier). Le robot (`outils/parcours/banc.py`) ne recopie un fichier du banc depuis le dépôt
  principal que s'il manque : il joue donc le banc du worktree tel qu'il est. **Le banc du dépôt principal n'a pas cette
  section** : au moment de la fusion, la reporter par ajout dans `C:\Users\watch\Dev\ECSR\TP_ECSR_App\_harness_supabase.js`
  (jamais en écrasant), puis rejouer le robot depuis `main`.
- **Robot** (`outils/parcours/equipe.py`, destination « Qualiopi » dans `navigation.py`, par le lien du tableau de bord du
  centre) : `registre-qualite` (sous-onglet, filtre « Clos », « Exporter (CSV) » présent et actif, ajout d'une amélioration ;
  le contenu du CSV est prouvé par les tests de `registreCsv`, le robot ne gère pas les téléchargements),
  `ajouter-au-registre` (depuis « Problèmes signalés », le bouton devient « Au registre »), et deux refus
  (`qualiopi-absent-pour-le-formateur`, `qualiopi-absent-pour-le-stagiaire`). Budgets : 3 clics pour `ajouter-au-registre` et
  2 pour le refus formateur sur ordinateur, parce que l'ancienne navigation passe par la tuile de l'Accueil. Connu et sans
  gravité : le robot signale un `textarea.rg-champ.rg-texte` « sans nom » sur ordinateur (les champs Réponse et Action décidée,
  dans le `<details>` replié, qu'il croit visibles et dont l'étiquette n'a pas de texte rendu) ; le champ Description a son
  étiquette.
- **Preuves du 10/11/2026** : preuve SQL `tests/sql/registre-qualite-preuve.sql` VERT 131/0 (Postgres local jetable, recette
  dans son en-tête, `PGCLIENTENCODING=UTF8`) ; suite node 1 529 verts (`node --test tests/*.test.mjs` : sur Node 24,
  `node --test tests/` seul échoue) ; Couleurs ECF : contraste AA vérifié sur les pastilles d'état (plus bas 4,88:1) et le
  texte du registre et de la fenêtre.
- **Fait le 10/11/2026** : essai à blanc sur la base réelle VERT 131/0 (la commande `set local
  session_replication_role` passe par `execute` : Supabase refuse ce réglage par `set_config()`), migration appliquée
  (accents vérifiés), preuve rejouée VERT 128/0 deux fois, rien laissé ; fusion dans `main` et poussée.
- **Historique, avant la mise en ligne** : (1) la migration `supabase/migrations/20261109_registre_qualite.sql` (et son retour
  `20261109_registre_qualite_retour.sql`) n'est pas appliquée : à jouer sur la base réelle avec son accord, `psql` avec
  `PGCLIENTENCODING=UTF8`, puis la preuve rejouée telle quelle (remplacer ses deux `pg_read_file` par le texte des
  fichiers) ; table vide, règles présentes, `peut_gerer_qualite()` inchangée à contrôler ; fusion et poussée seulement après.
  Jamais de poussée avant la migration : l'onglet dirait « registre non disponible ». (2) Les six arbitrages du 09/11
  (rappel violences, effacement des quatre textes, entrées jamais closes, CSV complet, dossiers sans texte libre, pas de
  suppression) sont révisables avant la première échéance (2029). Pas d'entrée Nouveautés : fonctionnalité du fondateur.
- **Point connu tant que le lot 5 n'est pas dans `main`** : la preuve des droits du lot 4 (`tests/sql/roles-preuve.sql`)
  sort rouge sur la couverture de `registre_qualite` (comme sur les tables des questionnaires) ; la ligne de la table est
  déjà écrite sur la branche du lot 5. Ce n'est pas un défaut de Q4.

## Conservation (Qualiopi Q5, novembre 2026, branche `qualiopi-q5`, NON en ligne)

Plan : `docs/superpowers/plans/2026-11-09-qualiopi-q5-conservation.md` ; spec `docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md`
(§ 3, § 6, § 6.1, § 7, § 8, § 10, § 11.2). Migration `supabase/migrations/20261110_conservation.sql` (retour :
`20261110_conservation_retour.sql`), **écrite, répétée et prouvée en local, jamais appliquée à la base réelle**. Registre
des traitements et rappel de la veille : livrés en fichiers pour le dépôt ECSR (tâche 9), rien n'y est commité d'ici.

- **Deux étapes, deux marques sur `stagiaires`.** `efface_le` date l'étape 1 (12 mois après `promos.date_fin` : compte, e-mails,
  date de naissance, fiche de suivi, textes libres, observations et e-mails de l'émargement, participations aux
  questionnaires) ; `anonymise_le` garde son sens (plus aucun nom) et date l'étape 2 (à partir du 1er janvier de
  `extract(year from date_fin) + 4`, donc après le 31 décembre de la 3ᵉ année : dossier professionnel, livret, tracés des
  signatures, nom, formateurs de l'émargement renommés « Formateur 1 », « Formateur 2 »). L'étape 2 fait l'étape 1 qui manque.
  Seules les fonctions de conservation écrivent les marques (déclencheur `stagiaires_marques_conservation`). **`actif` n'est
  jamais écrit** : l'abandon reste une décision de l'équipe. Contrainte : pas d'`anonymise_le` sans `efface_le`.
- **Dates (jour de Paris, `_questionnaire_jour()`)** : exemple de la promo finie le 11/12/2026 : étape 1 à partir du
  11/12/2027, étape 2 à partir du 01/01/2030. Formateurs (portée lieu + année) : liste « qui a répondu » effacée et année
  close à partir du 01/01 de `annee + 1`, commentaires à partir du 31/12 de `annee + 1`, figeage à partir du 01/01 de
  `annee + 4`. Registre qualité : 3 ans après la clôture (Q4), journal ajouté ici. Une promo sans date de fin n'ouvre aucune
  étape (la section le dit). Aucune étape ne part toute seule : chaque échéance est un clic du fondateur, rejouable
  (second appel : rien de changé, rien écrit au journal).
- **Droits.** Page Qualiopi, troisième sous-onglet « Conservation des données » (`js/views/conservation.js`, règles dans
  `js/effacement-rules.js`, lecture dans `js/db.js`), réservé au fondateur : chaque fonction exige `peut_gerer_qualite()` ET
  l'accès à la promo (`peut_acceder_promo`), pour que le lot 5 puisse élargir le droit à la direction sans qu'un centre
  efface un autre. Paramètres perd « Anonymiser la promo » et « Effacer les données » et garde « Réactiver », la purge des
  bénévoles et une phrase qui renvoie au fondateur. Un compte d'équipe n'est jamais effacé.
- **Effacement sur demande** (`effacer_sur_demande(stagiaire)`) : les deux étapes tout de suite, sans abandon préalable ; la
  demande se lit au journal (`effacements_journal`, type `demande`, cible « stagiaire n »), jamais dans une colonne de
  `stagiaires` que toute la promo lit. La fiche sort des listes de travail et des feuilles à venir ; sur les feuilles passées
  elle reste « Anonyme n », signature effacée, comme preuve de présence.
- **Marques lues partout.** Listes de travail (planning à venir, notes, dés, feuille d'émargement ouverte) excluent les
  fiches sans nom ; les affichages du passé les gardent en « Anonyme n » ; les indicateurs les comptent. Tableau de bord et
  dossiers Qualiopi : taux d'abandon inchangé, ligne à part « effacée à la demande » (ni abandon ni « en formation »), pièces
  « effacé au terme de la durée de conservation » après l'étape 2 (`statutFiche`). Heures de présence des dossiers lues sur
  les feuilles d'émargement (`js/qualiopi-presence.js`) : l'heure, la présence et le total d'heures survivent à l'effacement
  du tracé, et la feuille imprimée écrit « Signature effacée (durée de conservation) ».
- **Questionnaires (tâche 3).** Commentaires effacés à l'étape 1, réponses rebrassées, comptes figés dans
  `questionnaire_resultats_figes` à l'étape 2 (seuils 5 stagiaires, 3 formateurs ; rien sous le seuil, seulement la marque).
  La question 1 (option « effacer la liste des répondants à la fermeture ») est restée à la réponse par défaut : la tâche 5
  n'est pas construite. Limites écrites au registre des traitements : la réponse anonyme d'un questionnaire (commentaire libre
  compris) reste jusqu'à l'étape 1 après une demande ; dans un lieu à un seul formateur, la marque « il reste à faire » montre
  au fondateur qu'il a répondu ; un formateur dont le compte est recréé la même année peut répondre deux fois.
- **Indépendance vis-à-vis de `fiches_suivi` et de `themes.updated_by_email`** (correctif `16735486`) : `_effacer_etape1` et
  le retour ne citent ces objets que s'ils existent (`to_regclass` / `information_schema`, SQL dynamique), parce que la branche
  navigation-unique les retire. Preuve jouée avec et sans (VERT 227/0 complète, 228/0 sans les objets, contre-épreuves
  ROUGES). Si navigation-unique arrive après un retour de Q5 joué sur une base complète, la fonction recréée cite à nouveau les
  deux objets : à traiter par navigation-unique.
- **Retour** (`20261110_conservation_retour.sql`). Procédure : **retirer d'abord de l'app le commit des tâches 6-7** (les boutons
  appellent les nouvelles fonctions) et remettre en ligne la version d'avant, PUIS jouer le retour (`psql -1`,
  `PGCLIENTENCODING=UTF8`), avant tout retour de Q3. Il refuse tout seul (exception, rien n'est touché) dès qu'un effacement a
  eu lieu : ligne `etape1`, `etape2`, `demande`, `questionnaires` ou `registre` au journal, fiche marquée, signature effacée,
  résultat figé ou année des formateurs close. Un effacement ne se défait pas : le retour n'existe que tant que rien n'est parti.
- **Banc** (`_harness_supabase.js`, non versionné ; `node _harness_build.mjs` rejoué pour le banc compilé) :
  `_harness.html?role=fondateur&centre=1&demo=1&qualiopi=1&conservation=1` puis `#/qualiopi`, sous-onglet « Conservation des
  données ». Leviers : `&conservation=absent` (fonctions absentes, PGRST202), `&conservation=droit` (42501 pour un
  non-fondateur), `&conservation_panne=1`, `&emargement=1` (la fiche 8 a une ligne signée), `&signature=effacee` (dessins
  effacés, mention imprimée), `&date=AAAA-MM-JJ` (le jour du navigateur simule les échéances ; la base, elle, lit
  `_questionnaire_jour()`). **Le robot des parcours n'a pas encore de parcours dédié à la conservation** (prévu au plan avant fusion : à ajouter, puis `outils/robot_parcours.py` et `outils/verifier_navigation.py` sans échec propre à la branche). Comme pour Q4, le banc du dépôt principal
  n'a pas ces sections : à reporter par ajout au moment de la fusion, jamais en écrasant.
- **Preuves.** `tests/sql/conservation-preuve.sql` (schéma minimal : `conservation-schema-minimal.sql`), méthode de la mémoire :
  migration et retour par EXECUTE dans le DO, empreinte md5 du schéma et des données avant et après, contre-épreuves ROUGES.
  Suite node : `for f in tests/*.test.mjs` (`node --test tests/` seul échoue sur Node 24). **Point connu :**
  `tests/sql/roles-preuve.sql` ne se rejoue que sur la base réelle, **après** la migration (il passe aussi sur les nouvelles
  fonctions : `effacer_sur_demande`, `effacer_promo_etape1`, `etat_conservation`) ; il est aussi modifié par la branche du
  lot 5 (conflit de fichier à résoudre par le second arrivé dans `main`). `tests/sql/effacement-preuve.sql` est historique.
- **Conditions d'utilisation** : rien à changer. La version 2026-11-08 en ligne contient déjà les corrections (ligne
  « Émargement », « au-delà du 31 décembre de la troisième année », « dans le mois qui suit », liste « qui a répondu »).
- **Ce qui attend Timy.** (1) L'accord pour appliquer la migration à la base réelle : essai à blanc, application, preuve
  rejouée, puis fusion et poussée **dans la même fenêtre** (les boutons des Paramètres de l'ancienne app appellent des
  fonctions que la migration supprime). Jamais de poussée avant la migration. (2) Aucune étape d'effacement n'est lancée par
  un agent : la première échéance réelle est le 11/12/2027 (Nîmes, mars 2026), les commentaires des formateurs 2026 le
  31/12/2027 ; la mise en ligne est attendue au plus tard le 30/11/2027. (3) Les arbitrages du 09/11 (douze réponses par
  défaut) restent révisables sans perte jusque-là. (4) Appliquer au dépôt ECSR le registre des traitements et le rappel de la
  veille : fichiers, diffs et `LISEZMOI.md` dans `C:\Users\watch\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_ef2fa5b2-7428-4bd7-a3e4-5d2676c41680\archive-qualiopi-q5\` (le skill `veille-reglementaire` est aussi à compléter, ligne proposée dans le `LISEZMOI.md`). (5) Mineurs reportés à revoir avant la fusion, dans
  `.superpowers/sdd/2026-11-09-qualiopi-q5-conservation/progress.md` (lignes « à revoir avant fusion » : textes de
  confirmation, e-mail de `maj_par` sur demande, fiche sans prénom).

## Émargement signé (octobre 2026)

Spec : `docs/superpowers/specs/2026-10-23-emargement-design.md` · plan :
`docs/superpowers/plans/2026-10-23-emargement.md`.

- **Déroulé** : le formateur ouvre la demi-journée du jour (page `#/emargement`, tuile d'Accueil, bouton
  du Planning) ; chaque stagiaire signe au doigt depuis le bandeau « Signer » (`js/emargement-bandeau.js`,
  relu au changement de page, au retour au premier plan et toutes les 60 s) ; « Faire signer ici » sur
  l'appareil du formateur en secours (c'est aussi ce qui sert à la démonstration) ; le formateur signe puis
  clôt : tout stagiaire actif sans signature devient absent (origine « planning » s'il est noté absent sur
  une carte de la demi-journée, sinon « non signé »). Rouvrir : le jour même seulement.
- **Base** (migration `20261023_emargement.sql`) : `emargement_seances`, `emargement_lignes`,
  `emargement_formateurs`, toutes à `promo_id`. **Aucun droit d'écriture direct** : six fonctions
  `emargement_*` (security definer) vérifient rôle, promo courante, état, jour (heure de Paris) et
  horodatent. Un déclencheur fige toute signature posée ; seule porte : `set_config('emargement.effacement',
  'on', true)` pour une future migration d'effacement. Lecture : un stagiaire ne voit que sa ligne.
- **Tracé** : chemin SVG `M x y L x y` en entiers dans un repère 400 x 160, validé à l'identique par
  `js/emargement-rules.js` et par la base (20 000 caractères au plus) ; environ 1,3 Ko par signature.
- **Feuilles** (`js/emargement-feuilles.js`) : demi-journée en A4 portrait, semaine en A4 paysage (une page
  jusqu'à 16 stagiaires), imprimées par `doc-officiel.js` (option `page` de `bindDocPrint`). En-tête propre à
  la promo : réglage `emargement_entete` (organisme, intitulé ; défaut « ECF BOUSCAREN »).
- **Interrupteur par promo** (décision de Timy du 23/10) : réglage `emargement_actif` de `settings`,
  basculé par le seul fondateur (Paramètres › Émargement, `js/emargement-etat.js`), lu au démarrage avec
  les modules. **Éteint partout, allumé pour la promo de démonstration (7)** à la mise en ligne. Éteint :
  ni tuile, ni bouton, ni bandeau (aucune lecture périodique), page renvoyée à l'Accueil, et
  `emargement_ouvrir` refuse. Pas un module (route du socle) : les modules ne cachent rien aux formateurs.
- **Nouveautés** : aucune entrée tant qu'aucune vraie promo n'est allumée ; texte prêt dans la spec (§ 4.4).
- **Preuve** : `tests/sql/emargement-preuve.sql` (73 contrôles, verdict dans l'exception finale, rien
  n'est écrit ; rougit si l'on retire la règle de lecture, le déclencheur ou un refus d'écriture).
- **Démonstration** : `20261023_emargement_demo.sql` (généré par `node scripts/emargement-demo.mjs`) pose
  les feuilles fictives des semaines du 12 et du 19 octobre de la promo 7 et allume son interrupteur.
  Ménage : supprimer les feuilles `promo_id = 7` (lignes et signatures suivent) et les réglages de la promo,
  ou `..._demo_retour.sql`.
- **Banc** : `?emargement=1` (interrupteur allumé, semaine précédente close, matin du jour ouvert) ; les six
  fonctions sont jouées en mémoire par `_harness_supabase.js` avec les mêmes règles et messages.

### Certificats de réalisation et attestations d'assiduité (octobre 2026)

Spec : `docs/superpowers/specs/2026-10-24-attestations-design.md` · plan :
`docs/superpowers/plans/2026-10-26-attestations.md`.

- **Page** `#/emargement/attestations` (bouton « Attestations » de la semaine), mêmes portes que
  l'Émargement (formateurs, interrupteur allumé) : période (toute la formation par défaut, un bouton par
  mois), heures par stagiaire, certificat et attestation un à un ou pour toute la promo.
- **Calcul** (`js/attestations-rules.js`, testé) : seules les feuilles **closes** comptent ; prévues = durée
  des feuilles où le stagiaire a une ligne, réalisées = lignes signées (`signe_le`), une demi-journée signée
  compte en entier (décision de Timy du 24/10). Feuilles ouvertes et demi-journées sans feuille : signalées
  à l'écran, jamais comptées. Lecture légère sans tracés : `listEmargementPresences` (`js/db.js`).
- **Certificat** (`js/attestations-documents.js`) : texte du modèle du ministère du Travail (version au
  1er juin 2020) mot pour mot, sur l'en-tête de l'organisme, sans logo ; dates = premier et dernier jour
  signés ; durée = heures réalisées ; champs inconnus (employeur, signataire) en pointillés. Bouton grisé
  pour un stagiaire sans demi-journée signée.
- **Attestation** : résumé (prévues, réalisées, absences, taux), détail par semaine, chaque absence et
  chaque note avec sa date.
- **En-tête** : le réglage `emargement_entete` gagne adresse (deux lignes), signataire, qualité, lieu
  « Fait à » (défaut : lieu de la promo). Aucune migration.
- **Impression** : marge de page 0, comme les feuilles (une marge `@page` laisserait Chrome imprimer
  l'adresse de l'app et la date, case cochée par défaut). L'attestation, qui peut courir sur plusieurs
  pages, porte ses marges dans l'en-tête et le pied d'un tableau que l'impression répète sur chaque page
  (`avecMarges`). Preuve du 08/11 : Chrome sans tête, réglages par défaut, sur `_apercu_attestations.html`
  (non versionné : 30 semaines, 300 demi-journées) : 6 pages d'attestation marges comprises, puis le
  certificat sur une page, aucune adresse ni date ajoutée.
- **Robustesse** (relecture du 26/10) : la saisie d'une date au clavier ne redessine jamais les champs
  (seule la partie sous les dates) et ignore les années hors 2000-2099 ; une lecture plus ancienne
  arrivée après une plus récente est ignorée ; rien n'est peint si l'on a quitté la page. Bouton
  « En-tête et signataire » réservé aux administrateurs (seuls à pouvoir écrire un réglage en base).
- **Nouveautés** : aucune entrée (même règle que l'émargement) ; texte prêt dans la spec (§ 8).
- **Banc** : `?role=prof&centre=1&demo=1&emargement=7` charge les 20 feuilles de la promo 7, relevées en
  lecture seule (`_banc_emargement_demo.js`, non versionné). Contrôle du 26/10 : MERCIER Kevin 59 h 30 sur
  70 h (85 %), LAURENT Sarah 63 h (90 %), les huit autres 70 h, conformes au recomptage sur la base.

## Décisions UX importantes (à respecter)

- ❌ **Pas de tiret cadratin (U+2014)** dans les libellés UI. Régression à éviter.
- ✅ Format affichage stagiaires : **« V. Timy »** (initiale + prénom)
- ✅ Layout planning : jour à gauche (sticky), demi-journées empilées avec lanes alignées en colonnes
- ✅ Édition inline matrice Notes (pas de modal pour les saisies simples, mais modal détail au tap du prénom)
- ✅ Headers tableau matrice : titres rotatés vertical (-90°)
- ✅ Couleurs notes/cellules : pêche → vert (4 paliers, pas de rouge vif : ressenti rabaissant pour les stagiaires)
- ✅ Activité « Autre » : minimal (activité + formateur + note seulement)
- ✅ Vert mint **partout** (un seul thème, un seul accent)
- ✅ Cache-bust **automatique** (hook `pre-commit`) : token `?v=AAAAMMJJx` uniforme sur `index.html` + tous les imports JS
- ❌ Pas de gamification (badges, XP) : public adulte
- ❌ Pas de framework : vanilla suffit
- ❌ Pas de Google OAuth (testé, retiré, jugé non nécessaire)
- ❌ Pas de magic link mail (testé, retiré : friction + rate-limit Supabase)

## Patterns techniques importants

### Save sans casser les autres inputs ouverts (Notes et Planning)

**Bug récurrent corrigé** : un `loadPlanning()` ou `reload()` après save détruit les inputs en cours d'édition dans d'autres cellules. Solutions appliquées :

- **Notes (matrice)** : save met à jour la cellule + l'array `evaluations` en local, `refreshAnalyticsInPlace()` re-rend uniquement Synthèse + Graphiques (`.replaceWith(...)`).
- **Planning** : `saveEntry()` retourne sa promesse, stockée dans `pendingSaves` (Set global). Avant `addSlotEnd()` / `addLaneInSlot()`, appel à `flushPendingInputs()` qui : (1) blur le champ actif → déclenche les saves restants → (2) `await Promise.all([...pendingSaves])`. Garantit que la DB est à jour avant le full reload.
- **Sujet** : auto-commit on blur si texte non commité (`input.value.trim()` non vide).
- **Notes input** : save immédiat on blur (en plus du debounce 500ms).

### Système d'undo Ctrl+Z

`js/undo.js` : stack 30 actions max, en mémoire. Couverture :
- Notes : add/update/delete eval
- Passages : add/delete
- Thèmes : statut + date_fait
- Calendrier : add/update/delete event
- Contacts : add/update/delete

Câblé via `recordUndo(label, undoFn)` après chaque écriture. Sur Ctrl+Z, déclenche `hashchange` pour rafraîchir la vue. Inputs natifs (sauf number) gardent leur undo Browser.

### Cache-bust des modules ES (automatisé le 21 mai)

**Problème résolu** : `index.html` ne versionnait que `main.js`. Les ~19 modules importés (`import ... from "./db.js"`…) n'avaient pas de `?v=`, donc restaient en cache jusqu'à ~10 min après un deploy (max-age GitHub Pages). Import map écartée : inline → bloquée par le CSP `script-src` (pas de `'unsafe-inline'`) ; externe → pas fiable sur iOS Safari.

**Solution** : `scripts/cache-bust.js` (Node, zéro dépendance) pose un token `?v=AAAAMMJJx` **uniforme** sur `index.html` + tous les imports relatifs de `js/`. Token unique par passage : indispensable, sinon un module importé sous deux `?v=` différents serait chargé deux fois (état dupliqué).

**Déclenchement automatique** : le hook `.githooks/pre-commit` (activé via `git config core.hooksPath .githooks`) lance le script dès qu'un fichier `js/` ou `css/` entre dans un commit, puis re-stage les fichiers. Plus rien à bumper à la main.

- Lancement manuel : `node scripts/cache-bust.js` (token imposé possible : `node scripts/cache-bust.js 20260521b`).
- Après un `git clone` neuf : refaire `git config core.hooksPath .githooks` (le hook est versionné, pas la config git locale).
- Court-circuiter ponctuellement : `git commit --no-verify`.

## Comment travailler sur ce projet (workflow)

1. **Toujours commit + push après chaque feature significative** (le user n'aime pas les pauses « tu veux que je commit ? »)
2. **Migrations Supabase via MCP `mcp__800314df__apply_migration`** (project_id `crpduennbqaemhfaywrz`), JAMAIS de SQL en local
3. **Edge Functions via MCP `deploy_edge_function`** : nécessite confirmation user explicite
4. **Communication FR**, récap court après chaque livraison, tableaux markdown, gras sur l'essentiel
5. **AskUserQuestion** uniquement pour les décisions structurantes (nouvelle table, refonte vue, choix d'archi). Sinon **trancher seul** et avancer
6. **Cache-bust automatique** : le hook `pre-commit` pose le token `?v=` sur index.html + tous les modules JS, rien à bumper manuellement
7. **Vérifier `git log`** pour les derniers commits avant d'attaquer
8. **Pour les bugs « ça marche pas »**, vérifier d'abord avec `curl` ce qui est servi en prod avant d'accuser le code

## Roadmap

La roadmap du projet est tenue hors de ce dépôt public.
