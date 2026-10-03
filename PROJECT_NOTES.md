# PROJECT_NOTES.md — TP ECSR App

> **Fichier de reprise pour future session Claude.** Maintenu manuellement, à mettre à jour quand une décision structurante change. Daté : **2026-05-21**, backend mis à jour le 03/07/2026.

## TL;DR

Web app de suivi des promotions **TP ECSR** : depuis octobre 2026, plusieurs promos dans la même base (« Nîmes, mars 2026 » et « Nîmes, septembre 2026 », cf. § Multi-promo), mêmes formateurs (Hocine, Raphaël, Romain) + 1 admin watchi64. Stack : HTML/CSS/JS vanilla + Supabase + GitHub Pages.

- URL : **https://watchi64.github.io/ecsr-promo/**
- Repo : `github.com/watchi64/ecsr-promo` (public)
- Local : `C:\Users\watch\Dev\ECSR\TP_ECSR_App`
- Dossier formation (cours/QCM) : `C:\Users\watch\Dev\ECSR\` (séparé du repo app)

**Focus actuel** : que ça fonctionne parfaitement pour la promo CCP1+CCP2 2026. Long terme envisagé : vendre à d'autres centres TP ECSR (pas activé).

## Stack & infra

| | |
|---|---|
| Frontend | HTML/CSS/JS vanilla, modules ES, **pas de framework** (refus assumé) |
| Backend | Supabase Postgres, project `crpduennbqaemhfaywrz` (eu-west-3 Paris, org Timy Studio — migré le 17/06/2026 depuis dacqponglpeuscbgwfqn) |
| Edge Function | `invite-user` (deploy via MCP `mcp__800314df__deploy_edge_function`) |
| Hébergement | GitHub Pages, branche `main` |
| Typo | Canela (display, self-hosted .otf) + Outfit (Google Fonts body) + Geist Mono (numéros) |
| Logo | `assets/logo/tpecsr-logo.svg` (capsule TP) — SVG seul, le PNG a été supprimé |
| Palette | Mint éditorial unique (`:root`), accent vert `#6B7F4E`. Plus de switcher thème/accent |
| Cache-bust | **Automatique** : hook `pre-commit` → `scripts/cache-bust.js` pose un token `?v=AAAAMMJJx` uniforme sur `index.html` + tous les imports JS |
| Bootstrap admin | `misterwatchi@gmail.com` (compte admin + lié au stagiaire Timy id=15) |

## Auth & permissions — refonte du 18 mai

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
| `is_admin` | BOOLEAN | **orthogonal au rôle** — un stagiaire peut être aussi admin |
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
Priorités (`dashboard`, bouton en haut du Planning) et Nouveautés sont des pages sans onglet.
Cours garde la route `themes`. Voir « Barre simple et onglet CCP2 ». Les descriptions ci-dessous
datent de mai et juin : Thèmes, Priorités et Notes y sont décrits comme avant.

### Spécificités à connaître

- **Accueil** : refonte 19 mai. Salutation perso « Bonjour, V. Timy », pill date du jour, **bloc compteur J−N du prochain événement majeur** (examen/stage), 3 prochains événements (depuis agenda), 7 tuiles raccourcis, infos courtes (« Ctrl+Z annule », « ajout passage limité à 2 jours »…). Plus de mention mdp partagé / identité au 1er accès (obsolète).
- **Dashboard** : cards stagiaires compactes (215px), pill moyenne /20, badges priorité « À prioriser » / « Opportunité ratée » / « À jour » (PAS « Peut attendre »). Tri : priorité (défaut), alpha, note ↑/↓, passages ↓.
- **Planning** : jours empilés vertical, **jour en colonne gauche sticky** (78px), demi-journées avec horaires modulables. Lanes parallèles **alignées en colonnes** (lane index = grid-column). Cellule = strip header (activité bold + **multi-formateurs en chips** + delete) → sujet en **chips multi-thèmes** (autocomplete) → participants (Au tableau / Élèves) → notes discrètes. **Boutons 🎲** pour tirages aléatoires : 4 élèves auto en Pédagogie salle, 1-3 élèves en Voiture (popover 1/2/3), 1 pédagogue au tableau. Tous excluent les doublons dans la semaine. Print PDF 1 page. **Élèves bénévoles** (02/07/2026) : bouton « Bénévoles » (admin) dans la barre semaine → panneau banque (fiches, dispos hebdo, filtre « qui est dispo jeudi matin », tel cliquable, retrait doux) ; champ chips « Bénévoles » sur les cartes Voiture (dispos du jour en tête + badge « dispo », exclusion des cartes parallèles du même créneau) ; impression sous « Bénévoles : » en italique. Côté stagiaire : noms via RPC `benevoles_noms()` uniquement, banque et téléphones invisibles (RLS). **Auto-écoles partenaires + suivi** (05/07/2026) : le panneau a 2 onglets (Bénévoles / Auto-écoles), affiliation par select (+ création d'auto-école à la volée), fiche de suivi = venues déduites du planning avec commentaire par venue (table `benevole_suivi`), compteur de venues dans la liste. Fiche auto-école = gestion complète : bénévoles affiliés cliquables (ouvre leur fiche, retour à l'école), × pour désaffilier, select pour affilier un existant ou créer un bénévole déjà rattaché, « Retirer » (réversible) ET « Supprimer » (définitif, désaffilie ses bénévoles via `deleteAutoEcole`).
- **Calendrier** : 9 événements 2026 déjà insérés (Formation CCP1 30/03→21/09, stages 26/05, 03/08, Examens CCP1 22-25/09, Formation CCP2 28/09→07/12, stages 12/10, 26/10, 16/11, Examens CCP2 08-11/12). Types : examen/stage/formation/férié/autre, chacun couleur dédiée. Filtres « À venir » / « Tout ». Vue par mois.
- **Thèmes** : 4 sections en pills (Tout / Thèmes 57 / TP ECSR 12 / REMC 35 / Notions 2). Statut **binaire** (À faire ↔ Fait), pas « En cours ». Clic prénom titre = modal « Contenu à venir ». Date éditable côté admin via modale (force statut à Fait). Mobile : 2 lignes + corbeille (sur notions) en 4e col pour éviter chevauchement.
- **Passages** : table avec colonne « Ajouté par », filter, modal audit. Anti-backdating date ≥ J−2 pour non-admin (RLS + JS).
- **Notes** : vue matrice unique (stagiaires × Moy + C1 + C2 + REMC + GDE + 57 thèmes). Headers thèmes verticaux rotatés. Édition inline cellule (click → input, Enter sauve, Esc annule). Date globale en toolbar. **Save en place** (pas de re-render complet, n'écrase plus les autres inputs ouverts). Tri : défaut / alpha / moyenne ↑/↓ / nb notes ↓. **Synthèse classe** (KPI moyenne/médiane/saisies/notes<10 + Top 3 thèmes faibles/solides). **Graphiques tabs** : par stagiaire / par thème / distribution. **Mode anonyme** (toggle perso) : nom remplacé par « Anonyme » sauf pour admins. Couleurs notes pêche→vert (F1DBC8 / FBE5C1 / DBE9C4 / BFE0A6, pas de rouge vif — ressenti rabaissant). Tap sur prénom = modal détail vertical (utile mobile). Lignes alternées gris léger.
- **Ressources & contacts** : section **Contacts** (Myriam/Séverine/Fanny pré-remplis depuis procédure absences ECF + bouton « Ajouter un contact »), section **Ressources externes** (liens curés Légifrance/REMC/SRRR…). Tap-to-call (`tel:`) et tap-to-mail (`mailto:`).
- **Paramètres** : sections **Accès & invitations** (form invitation + liste avec pills rôle/admin), **Mes préférences** (toggle anonymat notes), **Promo** (stagiaires/profs CRUD admin), **Infos**. **Plus de section Apparence** (mint unique).

## Affichage stagiaires : nouveau format

Depuis 19 mai, table `stagiaires` a une colonne `nom` (nom de famille). Format d'affichage **partout dans l'app** : `<initiale du nom>. <prénom>` — ex : « V. Timy ». Helper `displayStagiaire(s)` dans `utils.js`. Tri alpha = par `nom` via `compareByNom(a, b)`.

Liste : ALEXER Audrick, ANKPRA Gaëlle, AQUILA Céline, BAILLY Mickael, BLANC Julie, BLANQUINQUE Valentin, BRUN Gaël, CHOULET Emilie, ERRAJI CHAHID Rita, KESSAL Lorie, LOPEZ Tatiana, MEDJANI Cassandre, MURRIGUIAN Aurélie, OULD ABDELKADER Anissa, VALDIVIA Timy.

## Base de données — état actuel

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
| `planning_entries` | + nouvelle colonne **`prof_ids INTEGER[]`** (multi-formateurs). `prof_id` legacy conservé synchronisé au 1er. + **`benevoles_ids INTEGER[]`** (élèves bénévoles voiture, 02/07/2026). + **`absences JSONB`** `[{sid, rid}]` (absences de dernière minute, 19/07/2026 — cf. § Absences & comptage) |
| `benevoles` | banque d'élèves bénévoles (voiture conduite) : prénom (seul champ obligatoire), nom optionnel, **téléphone**, `niveau` = code compétence/sous-compétence REMC (« C1 », « C1.4 »... libellés résolus par `nivLabel()` dans benevoles.js), boîte, heures faites, **`auto_ecole_id` FK → auto_ecoles** (05/07/2026, le texte libre a été migré puis supprimé), `dispos jsonb` (grille hebdo LUNDI..VENDREDI x matin/aprem), `actif` (retrait doux). **RLS entièrement `is_admin()`** : invisible pour les stagiaires, téléphone jamais transmis. Seed 02/07/2026 : 9 bénévoles de la semaine du 6 juillet (Assiya, Chahinez + 7 via contact « Sophie ») liés aux cartes Voiture |
| `auto_ecoles` | partenaires (05/07/2026) : nom (obligatoire), référent, téléphone, email, adresse, notes, `actif`. RLS entièrement `is_admin()`. « Sophie » (06 16 14 75 14) = première fiche, migrée depuis le texte libre |
| `benevole_suivi` | commentaires de suivi par venue (05/07/2026) : `(benevole_id, semaine_lundi, day_index, half_day)` UNIQUE + commentaire. RLS `is_admin()`. ⚠️ Les venues ne sont PAS stockées : déduites de `planning_entries.benevoles_ids` (une demi-journée = une venue), seuls les commentaires vivent ici |
| `planning_half_meta` | horaires + pause par demi-journée par semaine |
| `ressources` | liens curés |
| `contacts` | admin/urgence/autre — pré-rempli Myriam/Séverine/Fanny |
| `agenda_events` | dates clés (examens, stages, formations) avec date_start + date_end optionnel |
| `settings` | KV générique (utilisé pour current_week_lundi) |
| `admins` | LEGACY conservée mais plus utilisée — la whitelist vit dans user_profiles |

### Fonctions / triggers Postgres notables

- `is_admin()` SECURITY DEFINER : lit `user_profiles.is_admin` via JWT email
- `enforce_whitelist_signup()` BEFORE INSERT ON auth.users : bloque si email pas dans user_profiles + auto-confirme email
- `set_my_anonymous_notes(val)` SECURITY DEFINER : RPC perso
- `benevoles_noms()` SECURITY DEFINER : seule surface bénévoles côté stagiaire — retourne uniquement `id` + `display` (« N. Prénom », inactifs compris pour que les vieilles semaines restent lisibles). Le planning l'utilise quand `isAdmin()` est faux
- Triggers `audit_passages`, `audit_evaluations` : INSERT/UPDATE/DELETE → row dans `*_audit`, identité depuis `auth.jwt()->>email`
- Trigger `agenda_touch_updated`, `contacts_touch_updated` : updated_at auto

### Edge Function `invite-user`

Vérifie le JWT de l'appelant, check `is_admin = true` en lecture service_role, upsert dans user_profiles. **Plus d'envoi de mail** (depuis v3 du 18 mai — l'app fait du signup classique côté navigateur).

## Absences & comptage des passages (19/07/2026)

Spec complète : `docs/specs/2026-07-19-absences-comptage-placement-design.md`.

- **Une Absence COMPTE** dans les compteurs d'équité du placement (tour consommé) ; **Bonus et Report ne comptent pas**. Règles centralisées dans `js/passage-rules.js` (`compteDansEquite`, `meilleurResultat`), testées par `node tests/passage-rules.test.mjs`. C'est l'INVERSE d'avant : casse le cercle vicieux des absents re-priorisés.
- **Absence de dernière minute** : marquée SUR la carte planning (⊘ à côté du tableau, clic sur le corps d'une chip élève voiture). Le prévu reste affiché barré ; un sélecteur « remplacé(e) par » propose TOUT le monde avec badge « occupé » en avertissement (pas d'exclusion dure). Stocké dans `planning_entries.absences` `[{sid, rid}]`.
- **Absence prévenue à l'avance** : pas de marquage — simple swap de chip, le remplaçant fait un passage normal. La frontière relève du jugement de l'admin.
- **Valider la semaine** : prévu non marqué → `Effectué` ; marqué → `Absence` (avec `remplacant_id`) + `Bonus` pour le remplaçant. Fusion au grain jour : `Effectué > Absence > Bonus`.
- **Placement auto en cascade** (dés + Placer la semaine) : 1) rien eu cette semaine → 2) type manquant (objectif 1 salle ET 1 voiture chacun) → 3) retard historique sur le type → 4) critères existants (plafond 2 voitures, anti-jours-consécutifs, avec-élève, variété formateur).

## Dossier Professionnel (DP) — 30/07/2026, branche `dp-dossier-professionnel`

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

- **Modèle** : table `lieux` (Nîmes 1, Montpellier 2) et `promos` (1 = « Nîmes, mars 2026 », 2 = « Nîmes, septembre 2026 », toutes deux à Nîmes). Les autres promos et lieux se créent par migration.
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
  (jusqu'au lot 2, espace stagiaires des formateurs).
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
- **Assistant** : `aide.mjs` décrit la nouvelle barre ; il faut redéployer la fonction `chatbot`.
- **Banc** : après chaque `node _harness_build.mjs`, ouvrir `_harness.html` avec un paramètre
  neuf (`?cb=…`) : le navigateur garde la page en cache avec l'ancien jeton, donc les anciens
  modules, et un test peut passer au vert sur du code qui n'est plus sur le disque.

## Décisions UX importantes (à respecter)

- ❌ **Pas d'em-dashes (—)** dans les libellés UI. Régression à éviter.
- ✅ Format affichage stagiaires : **« V. Timy »** (initiale + prénom)
- ✅ Layout planning : jour à gauche (sticky), demi-journées empilées avec lanes alignées en colonnes
- ✅ Édition inline matrice Notes (pas de modal pour les saisies simples, mais modal détail au tap du prénom)
- ✅ Headers tableau matrice : titres rotatés vertical (-90°)
- ✅ Couleurs notes/cellules : pêche → vert (4 paliers, pas de rouge vif — ressenti rabaissant pour les stagiaires)
- ✅ Activité « Autre » : minimal (activité + formateur + note seulement)
- ✅ Vert mint **partout** (un seul thème, un seul accent)
- ✅ Cache-bust **automatique** (hook `pre-commit`) : token `?v=AAAAMMJJx` uniforme sur `index.html` + tous les imports JS
- ❌ Pas de gamification (badges, XP) — public adulte
- ❌ Pas de framework — vanilla suffit
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
3. **Edge Functions via MCP `deploy_edge_function`** — nécessite confirmation user explicite
4. **Communication FR**, récap court après chaque livraison, tableaux markdown, gras sur l'essentiel
5. **AskUserQuestion** uniquement pour les décisions structurantes (nouvelle table, refonte vue, choix d'archi). Sinon **trancher seul** et avancer
6. **Cache-bust automatique** : le hook `pre-commit` pose le token `?v=` sur index.html + tous les modules JS, rien à bumper manuellement
7. **Vérifier `git log`** pour les derniers commits avant d'attaquer
8. **Pour les bugs « ça marche pas »**, vérifier d'abord avec `curl` ce qui est servi en prod avant d'accuser le code

## Roadmap (non décidé)

- Émargement signature canvas + PDF (Qualiopi indicateur 11)
- Attestations + certificat réalisation format réglementaire
- Export BPF annuel
- Questionnaires satisfaction auto J+1 / J+180
- PWA installable (manifest + SW)
- Export CSV/PDF complet matrice Notes
- Multi-tenant (promo_id partout) — si un jour vente à d'autres centres
- Génération QCM auto via API Claude depuis les 57 thèmes (différenciant pitch ECF)
- Connexion possible des stagiaires côté formation-ecsr (cours/QCM unifiés ?)
