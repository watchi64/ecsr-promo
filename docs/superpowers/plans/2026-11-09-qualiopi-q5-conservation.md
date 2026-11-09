# Dossier Qualiopi, lot Q5 : conservation à 3 ans et effacement en deux étapes, plan de mise en œuvre

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans, tâche par tâche. Les étapes se cochent (`- [ ]`).

**But :** les preuves d'une formation (noms, émargement signé, dossier professionnel, livret EPCF, réponses aux
questionnaires) sont gardées jusqu'au 31 décembre de la 3ᵉ année après la fin, le reste part à 12 mois ; l'effacement ne
touche plus `actif`, et l'effacement sur demande est immédiat.

**Architecture :** une migration (fiches, émargement, questionnaires) qui remplace `_anonymiser_stagiaire` et ses trois
fonctions d'appel par deux étapes datées par deux marques (`efface_le`, `anonymise_le`) et un effacement sur demande tracé au
journal ; les réponses des questionnaires sont figées en résultats regroupés au bout de 3 ans. Une section « Conservation des
données » de la page Qualiopi montre toutes les échéances et porte les boutons ; les indicateurs, les dossiers et les feuilles
d'émargement lisent les marques. Migration prouvée en local, NON appliquée sans l'accord de Timy.

**Technique :** modules ES sans build, `el()` de `js/utils.js`, Supabase par `js/db.js`, tests `node:assert/strict`,
PostgreSQL et RLS, preuves SQL rejouables (`tests/sql/`), banc à faux client (`_harness_supabase.js`, non versionné).

**Spec :** `docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md` (validée par Timy le 08/11/2026), § 3 (décisions 5 et
6), § 6, § 6.1, § 7, § 8, § 10, § 11.2 ; textes : `docs/superpowers/specs/2026-11-08-qualiopi-q3-textes.md` (point 9,
passages 5, 8 et 10, retouches G, H, I). Plans voisins : Q3 `docs/superpowers/plans/2026-11-08-qualiopi-q3-questionnaires.md`,
Q4 `docs/superpowers/plans/2026-11-09-qualiopi-q4-registre.md` (commit 9fac030 ; ses tâches 2 et 4 et sa question 3 sont
reprises en tâche 4 ci-dessous).

## À valider par Timy avant toute construction

Rien n'est construit avant ta réponse. Chaque ligne dit ce qui se passe aujourd'hui (avant) et ce que ce lot ferait (après).
Les dates prennent l'exemple de la promo « Nîmes, mars 2026 », finie le 11/12/2026. **Aucun effacement ne part tout seul** :
chaque échéance attend un clic du fondateur ; à la date dite, le bouton s'allume et un rappel arrive (question 9), mais tant
que personne ne clique, les données restent. Les dates des conditions d'utilisation sont donc tenues si le fondateur clique à
temps (question 10).

**(a) Ce qui change pour les utilisateurs**

| Qui | Sujet | Avant (aujourd'hui) | Après |
|---|---|---|---|
| Stagiaire | Dossier professionnel, livret EPCF | supprimés quand l'équipe clique « Anonymiser la promo », possible dès 12 mois après la fin (11/12/2027) | gardés jusqu'au 31/12 de la 3ᵉ année après la fin (31/12/2029), supprimés à partir du 01/01/2030 |
| Stagiaire | Nom et prénom sur sa fiche | remplacés par « Anonyme » et un numéro dès 12 mois | gardés jusqu'au 31/12/2029, remplacés à partir du 01/01/2030 |
| Stagiaire | Feuilles d'émargement | jamais effacées : signatures, adresses e-mail et observations gardées sans limite | observations et adresses e-mail effacées à 12 mois ; dessins des signatures effacés à partir du 01/01/2030 ; l'heure, la présence et le total d'heures restent |
| Stagiaire | Compte, e-mail, date de naissance, fiche de suivi, commentaires des notes, des passages et de l'EPCF | effacés à 12 mois | inchangé |
| Stagiaire | Commentaire libre écrit dans un questionnaire de satisfaction (nouveau avec les questionnaires) | aucune règle | effacé à 12 mois ; ses notes de 1 à 4 sont gardées jusqu'au 31/12/2029, puis seuls restent les pourcentages de la promo (s'il y a eu au moins 5 réponses) ; après 12 mois, le questionnaire ne peut plus être rouvert |
| Stagiaire | Demande d'effacement de ses données | il fallait d'abord la déclarer en abandon, ce qui la comptait comme abandon ; ses signatures restaient | tout est effacé tout de suite (dossier, livret, signatures compris), sans la déclarer en abandon ; le dossier de la formation écrit « fiche effacée à la demande de la personne » ; la fiche disparaît des listes de travail (planning à venir, notes, dés) et des feuilles d'émargement à venir, où elle ne peut plus signer ; sur les feuilles passées, elle reste en « Anonyme » et un numéro, signature effacée, comme preuve de présence |
| Stagiaire | Fiches anonymisées dans les listes | une fiche anonymisée disparaît des listes (elle passait en abandon) | inchangé à l'écran : une fiche sans nom disparaît des listes, mais elle n'est plus comptée en abandon |
| Stagiaire | Ce qu'on voit à l'écran | rien | rien de nouveau (sauf une nouvelle acceptation des conditions si une version suivante est nécessaire, partie (b)) |
| Formateur | Boutons « Anonymiser la promo » et « Effacer les données » des Paramètres | ouverts à l'équipe de la promo | réservés au fondateur, sur la page Qualiopi (question 3) ; Paramètres garde « Réactiver », la purge des élèves bénévoles et une phrase qui dit que la conservation est gérée par le fondateur |
| Formateur | Liste « qui a répondu » au questionnaire des formateurs | aucune règle | effacée à partir du 1ᵉʳ janvier de l'année suivante (on ne peut plus répondre au titre de l'année finie) |
| Formateur | Son commentaire libre à ce questionnaire | aucune règle | effacé le 31/12 de l'année suivante (année 2026 : 31/12/2027) |
| Formateur | Ses notes de 1 à 4 à ce questionnaire | aucune règle | gardées jusqu'au 31/12 de la 3ᵉ année (2026 : 31/12/2029), puis seuls restent les pourcentages du centre (s'il y a eu au moins 3 réponses) |
| Formateur | Son nom et sa signature sur les feuilles d'émargement | gardés sans limite | remplacés par « Formateur 1 », « Formateur 2 »… et dessin effacé, avec l'étape des 3 ans de la promo ; une demande d'effacement d'un formateur n'est pas prévue avant cette date (limite, question 11) |
| Fondateur | Où gérer la conservation | Paramètres > Données personnelles, promo par promo, un seul bouton à 12 mois | page Qualiopi, section « Conservation des données » : toutes les promos et tous les centres, chaque échéance avec sa date et son bouton |
| Fondateur | Tableau de bord, dossiers Qualiopi | une promo anonymisée voyait tous ses stagiaires comptés en abandon | le taux d'abandon ne bouge plus ; après 3 ans, les pièces disent « effacé au terme de la durée de conservation » et la satisfaction vient des pourcentages gardés |
| Fondateur | Fiche effacée à la demande, dans les chiffres | elle passait en abandon | proposition (question 12) : comptée parmi les inscrits, ni « en formation » ni abandon, sur une ligne à part (« effacée à la demande ») ; ses pièces (dossier, livret) ne sont pas comptées comme manquantes, au tableau de bord comme dans le dossier |
| Fondateur | Registre qualité (lot Q4) | n'existe pas encore | textes vidés 3 ans après la clôture d'une entrée, par le bouton du registre (lot Q4) ; chaque effacement noté au journal des effacements |

**(b) Ce qui demande une nouvelle version des conditions d'utilisation**

Ce lot se construit après la mise en ligne des questionnaires (lot Q3), qui publie la version 2026-11-08 des conditions.
Tout ce qui n'est pas corrigé dans cette version avant sa mise en ligne demandera une version suivante, donc une nouvelle
acceptation par chaque compte. Recommandation : faire entrer maintenant les corrections marquées « à corriger » dans la
2026-11-08, qui n'est pas encore en ligne (question 4).

| Point | Version en ligne (2026-10-23) | Version 2026-11-08 (proposée, non validée) | Ce que ce lot fait | Nouvelle version ? |
|---|---|---|---|---|
| Durée des preuves (nom, résultats, heures, dossier, livret) | 12 mois pour tout | jusqu'au 31/12 de la 3ᵉ année | les deux étapes | non : couvert par la 2026-11-08 |
| Comptes, e-mails, textes libres des stagiaires | 12 mois | 12 mois | étape des 12 mois | non |
| Émargement (dessins de signature, heure, observations) | n'en parle pas | cité dans la durée des preuves, absent de la liste des données collectées et du tableau « Qui voit quoi » | effacé en deux étapes | à corriger : une ligne « Émargement » dans ces deux tableaux |
| « Aucune donnée nominative n'est gardée plus de trois ans après la fin de la formation » | absente | présente | jusqu'au 31/12 de la 3ᵉ année : 3 ans et 20 jours pour Nîmes mars 2026, près de 4 ans pour une promo finie en janvier ; le registre garde 3 ans après la clôture d'une entrée | à corriger : « au-delà du 31 décembre de la troisième année après la fin de la formation » |
| « Douze mois après la formation, les comptes et les textes libres disparaissent » (l'essentiel) | absente | présente | les commentaires des formateurs vivent jusqu'au 31/12 de l'année suivante (jusqu'à 24 mois) | à corriger : « les comptes et les textes libres des stagiaires » |
| « Un stagiaire qui quitte la formation en cours de route est traité de la même façon, à compter de son départ » | présente | présente | l'app n'enregistre pas la date de départ : ce lot compte depuis la fin de la promo | à corriger : « à compter de la fin de sa promo » |
| « La note de participation est supprimée avec le compte » (la liste « qui a répondu ») | absente | présente | stagiaires : rattachée aussi à la fiche, pour refuser une deuxième réponse après un compte recréé, et supprimée à 12 mois ; formateurs : leur compte n'est jamais supprimé, la note part le 1ᵉʳ janvier suivant | à corriger : « supprimée douze mois après la fin de la formation (pour les formateurs, à la fin de l'année du questionnaire) » |
| Réponses aux questionnaires : notes 3 ans puis pourcentages seulement ; commentaires 12 mois (formateurs : 31/12 de l'année suivante) | absent | présent (proposition, question 1) | tâche 3 | non, si tu valides la proposition ; une autre option de la question 1 réécrit ce passage |
| Registre qualité vidé 3 ans après la clôture | absent | présent | lot Q4, journal ajouté ici | non ; une entrée jamais close reste (question 5) |
| Effacement sur demande immédiat, « fiche effacée à la demande de la personne » | absent (procédure interne : abandon d'abord) | présent | tâche 2 | non |
| Délai des effacements manuels | dates fermes | dates fermes | un clic du fondateur à partir de la date | à décider : ajouter « dans le mois qui suit » (question 10) |
| Pourcentages gardés sans limite | « statistiques anonymes sans limite » | idem | table des résultats gardés | non |

Registre des traitements (`C:\Users\watch\Dev\ECSR\docs\legal\registre_traitements.md`, autre dépôt) : durée de la section 1
(« Formation + 12 mois ») remplacée par les deux étapes ; émargement, questionnaires et registre qualité ajoutés s'ils n'y sont
pas ; procédure « Demandes d'exercice des droits » réécrite (plus d'abandon préalable, bouton sur la page Qualiopi) ; limite
des formateurs (question 11) ; limite d'une demande en cours de formation : les stagiaires de la promo, qui lisent les fiches,
voient la fiche devenir « Anonyme » avant la date des 3 ans et peuvent en déduire une demande (choix : la limite est écrite ;
pas de nouvelle règle de lecture sur `stagiaires`, que les notes et la confidentialité du 04/10 utilisent, et la fiche disparaît
de toute façon des listes) ; ligne datée dans « Actions de mise en conformité » (tâche 9).

**Questions ouvertes (réponse par défaut entre parenthèses)**

1. Anonymat des questionnaires. Par défaut : l'éditeur s'engage par écrit à ne pas lire les tables de réponses directement ;
   les notes sont gardées 3 ans, puis seuls restent les pourcentages. Autres choix : (a) la même chose sans engagement écrit ;
   (b) en plus, effacer la liste « qui a répondu » d'une promo dès que son questionnaire ferme : plus personne, même
   l'éditeur, ne peut alors relier une réponse à une personne, mais rouvrir le questionnaire permettrait de répondre deux
   fois (tâche 5) ; (c) ne garder les réponses d'une promo que si elle atteint 5 réponses, sinon elles sont perdues (non
   planifiée). (par défaut)
2. Commentaires libres des formateurs effacés le 31/12 de l'année qui suit l'année du questionnaire ? (oui).
3. Effacements réservés au fondateur, sur la page Qualiopi, au lieu de l'équipe de la promo dans les Paramètres ? (oui : une
   seule place, et la spec met tout ce lot sous le droit de gestion de la qualité).
4. Les corrections « à corriger » de la partie (b) entrent dans la version 2026-11-08 avant sa mise en ligne ? (oui).
5. Entrées du registre jamais closes : même question que la question 3 du plan Q4, une seule réponse pour les deux lots.
   Proposition du lot Q4 : pas d'effacement sans clôture ; une entrée ouverte depuis plus de 3 ans est signalée « à clore »
   en tête de la page Qualiopi. (proposition du lot Q4 ; si tu préfères les vider quand même, la tâche 4 retouche le lot Q4)
6. Un formateur dont le compte est supprimé puis recréé dans la même année pourrait répondre deux fois au questionnaire des
   formateurs (pas de fiche pour l'en empêcher) : limite acceptée et écrite ? (oui ; réglé pour les stagiaires).
7. Fiches déjà anonymisées par l'ancien bouton avant ce lot (aucune le 08/11) : l'ancien bouton les a passées en abandon et on
   ne sait plus si elles l'étaient vraiment. Tu tranches fiche par fiche à la mise en ligne ? (oui).
8. Une promo sans date de fin n'ouvre aucune étape (« Nîmes, septembre 2026 » n'en avait pas au 01/10) : la section le
   signale. Suffisant ? (oui).
9. Rappel des échéances : une ligne en tête de la page Qualiopi, et une alerte en lecture seule dans le rapport de la veille
   réglementaire du lundi (autre dépôt). (oui aux deux).
10. Conditions : ajouter « dans le mois qui suit » aux dates d'effacement, puisque l'effacement est un clic ? (oui, avec la
    question 4 ; sinon les dates restent fermes et c'est au fondateur de cliquer le jour même).
11. Un formateur qui demande l'effacement de son nom et de ses signatures sur les feuilles d'émargement : limite écrite au
    registre des traitements (le nom reste jusqu'à l'étape des 3 ans, comme preuve de la formation) ? (oui).
12. Une fiche effacée à la demande, dans le tableau de bord et les dossiers : comptée parmi les inscrits, ni « en
    formation » ni abandon, sur une ligne à part, et ses documents effacés ne comptent pas comme manquants ? (oui ; autre
    choix : la compter comme abandon, mais seule l'équipe décide d'un abandon).

## Contraintes communes

- Aucun tiret cadratin (U+2014) nulle part ; dans un test, `String.fromCharCode(0x2014)` ; contrôle final en Python avec
  `chr(0x2014)`. « Formateur », jamais « prof » à l'écran. Tutoiement à l'écran, documents impersonnels.
- Contraste AA, cibles de 44 px, aucun défilement de côté ; l'utilisateur au centre, clair et beau.
- `actif` n'est jamais écrit par une étape d'effacement (spec § 10) ; l'abandon reste une décision de l'équipe. Les listes de
  travail (planning à venir, notes, dés, feuille d'émargement ouverte et sa clôture) excluent les fiches sans nom
  (`anonymise_le` posé), et la base refuse de les faire signer ou annoter ; les affichages du passé (feuilles closes, semaines
  passées du planning) les gardent en « Anonyme n » ; les indicateurs les comptent.
- Marques : `efface_le` date l'étape 1 ; `anonymise_le` garde son sens (plus aucun nom) et date l'étape 2 ; la demande se lit
  au journal (`effacements_journal`, type `demande`, lisible du fondateur et de l'équipe seulement), jamais dans une colonne
  de `stagiaires` que toute la promo lit.
- Dates (jour à l'heure de Paris, `_questionnaire_jour()`) : étape 1 à partir de `date_fin + interval '12 months'` ; étape 2
  et figeage des stagiaires à partir du 01/01 de `extract(year from date_fin) + 4` (gardé jusqu'au 31/12 de la 3ᵉ année) ;
  formateurs : participations à partir du 01/01 de `annee + 1`, commentaires à partir du 31/12 de `annee + 1`, figeage à partir
  du 01/01 de `annee + 4`.
- Un compte d'équipe (affectation, `is_admin`, `is_founder`) n'est jamais effacé (garde-fou du lot 4 repris tel quel), et
  n'est pas compté comme « reste à effacer ».
- Droits : chaque fonction appelable exige `peut_gerer_qualite()` ET l'accès à la promo (`peut_acceder_promo(p_promo)`) ou à
  une promo du lieu, pour que l'élargissement du lot 5 à la direction ne laisse pas un centre effacer un autre. Ordre des lots :
  ce lot avant le lot 5 (spec § 8). `etat_conservation()` ne liste que les promos et lieux accessibles. Notes pour le lot 5 :
  `effacer_registre_qualite` (lot Q4) n'a pas de limite de lieu alors que le registre porte `lieu_id` ; la règle de lecture
  du journal suit `promo_courante()` et non l'en-tête de lecture d'une autre promo (sans effet pour le fondateur, qui lit tout,
  mais `lireEffacementsSurDemande(promoId)` ne verrait rien pour une direction). Fonctions internes (`_effacer_etape1`, `_effacer_etape2`, `_questionnaire_rebrasser`,
  `_questionnaire_comptes`, `_questionnaire_effacer_commentaires`, `_questionnaire_figer`) : `revoke all ... from public, anon,
  authenticated, service_role` (Supabase accorde l'exécution par défaut).
- Questionnaires : aucun droit direct pour les rôles de l'API ; réécriture par lot avec rebrassage, sous le même verrou par
  portée que `repondre_questionnaire` (`pg_advisory_xact_lock(hashtext('questionnaire:' || ...))`) ; rien sous le seuil (5, 3).
- Émargement : écritures sous `set_config('emargement.effacement', 'on', true)`, remis à vide juste après chaque écriture.
- Base de production : lecture seule pendant la construction ; migration écrite, répétée et prouvée en local, retour fourni,
  appliquée seulement avec l'accord de Timy ; chaque effacement laisse une ligne dans `effacements_journal`, sans nom.
- Jeton `?v=` aligné sur celui de `main` au moment de la tâche (`20261109d` le 09/11) ; commit local par tâche.
- Parcours prouvés au banc (fondateur, formateur, stagiaire ; téléphone et ordinateur ; Chromium et WebKit) ;
  `outils/robot_parcours.py` (avec un parcours dédié à la conservation) et `outils/verifier_navigation.py` sans échec propre à
  la branche avant toute fusion.
- Ordre : Q3 en ligne, puis Q4, puis ce lot, puis le lot 5 ; en ligne au plus tard le 30/11/2027, avant le premier effacement
  promis (étape 1 et commentaires de Nîmes mars 2026 : 11/12/2027 ; commentaires des formateurs 2026 : 31/12/2027).

## Points de vigilance

1. **Étape 2 avant l'étape 1** (fondateur en retard) : l'étape 2 fait d'abord l'étape 1 sur les fiches qui ne l'ont pas eue,
   sans refus. Preuve en tâche 2.
2. **Double clic, deux onglets** : chaque fonction est rejouable ; un second appel ne change rien et n'écrit pas de seconde
   ligne de journal. Preuve en tâches 2 et 3.
3. **Seuil au moment de figer** : 4 réponses de stagiaires (2 de formateurs) ne figent aucun compte, seulement la marque
   « sous le seuil » ; 5 (3) figent les comptes question par question, comme `resultats_questionnaire`. Preuve en tâche 3.
4. **Heures après l'étape 2** : une ligne signée dont le dessin est effacé reste « signée » (heure, présence, total d'heures),
   à l'écran et sur la feuille imprimée, qui écrit « Signature effacée (durée de conservation) ». Test en tâche 8.
5. **Deux formateurs sur une feuille** : l'index unique sur le nom par feuille interdit deux « Formateur » ; l'étape 2 écrit
   « Formateur 1 », « Formateur 2 » dans l'ordre de `signe_le`. Preuve en tâche 2.

---

### Tâche 1 : règles d'affichage de la conservation

**Fichiers :** modifier `js/effacement-rules.js`, `tests/effacement-rules.test.mjs`.

**Étape 0 (préalables, sans commit, lecture seule sur la base réelle) :** Q3 en ligne sur `main` ; ce qui a été construit du
lot Q4 (tâche 4 en dépend) ; `select count(*) from effacements_journal` et `select count(*) from stagiaires where anonymise_le
is not null` (attendu 0, sinon question 7 avant la tâche 2) ; doublons de fiche : `select stagiaire_id, count(*) from
user_profiles where stagiaire_id is not null group by 1 having count(*) > 1` et participations de stagiaires qui
retomberaient sur la même fiche (attendu 0 ; sinon la tâche 3 garde une participation par fiche et le rapport les liste) ;
jeton de `main`.

**Interfaces :**
- Consomme : la sortie de `etat_conservation()` (tâches 2 et 3) : `{ jour, promos: [{ id, nom, lieu_nom, date_fin, etape1_du,
  etape2_du, a_effacer_etape1, a_effacer_etape2, comptes_equipe }], portees_formateurs: [{ lieu_id, lieu_nom, annee,
  participations, cloture_du, commentaires, commentaires_du, reponses, fige, figeage_du }], registre: { a_effacer, du } | null }`,
  les nombres « à effacer » ne comptant jamais les comptes d'équipe.
- Produit : `echeancesConservation(etat)` → `[{ type: "etape1" | "etape2" | "cloture_formateurs" | "commentaires_formateurs" |
  "figeage_formateurs" | "registre" | "date_fin_manquante", cible, du, due, restant, texte, bouton }]`, échéances passées
  d'abord, puis par date ; une échéance sans rien à faire n'est pas listée, même s'il reste des comptes d'équipe (le texte
  de l'étape suivante les mentionne) ; `statutFiche(fiche, terminee, surDemande)` → « En formation », « Formation suivie »,
  « Abandon » ou « Fiche effacée à la demande de la personne » (la demande prime) ; `resumeEffacement(details)` étendu aux
  clés `emargement_observations`, `signatures`, `commentaires_questionnaires`. `etatFinDePromo` est supprimée.
- [ ] **Étape 1 : tests qui échouent** : Nîmes `date_fin` 2026-12-11, `etape1_du` 2027-12-11 : `due` faux le 2027-12-10, vrai le
  2027-12-11 ; `etape2_du` 2030-01-01 ; `date_fin` nulle → une seule échéance `date_fin_manquante`, sans bouton ; portée
  formateurs 2026 → 2027-01-01, 2027-12-31, 2030-01-01 ; `a_effacer_etape1: 0, comptes_equipe: 1` → aucune échéance d'étape 1 ;
  tri ; `statutFiche({ actif: false }, true, true)` → demande ; aucun U+2014, aucun « prof » dans les textes.
- [ ] **Étape 2 :** échec constaté. **Étape 3 :** code. **Étape 4 :** `node --test tests/effacement-rules.test.mjs` vert.
- [ ] **Étape 5 : commit** « Conservation : règles d'affichage des échéances ».

### Tâche 2 : migration, partie fiches et émargement (avec retour et preuve)

**Fichiers :** créer `supabase/migrations/<AAAAMMJJ>_conservation.sql`, `..._conservation_retour.sql`,
`tests/sql/conservation-schema-minimal.sql`, `tests/sql/conservation-preuve.sql` ; en-têtes de `tests/sql/effacement-preuve.sql`,
`tests/sql/roles-preuve.sql`, `tests/sql/roles-retours-recette.sql`.

**Schéma minimal** (modèle : `tests/sql/questionnaires-schema-minimal.sql`, droits par défaut de Supabase compris) : lot 4
(étape 1 rejouée, fonctions de l'étape 2 extraites, dont les quatre d'effacement, `emargement_feuille`, `emargement_ouvrir`,
`emargement_signer`) ; `20261005_effacement_donnees.sql` pour `effacements_journal` et sa contrainte de type (l. 18 à 24) ;
la règle de lecture du journal de `20261028_roles_3_regles.sql` (l. 621 à 631) ; `20261023_emargement.sql` rejouée telle quelle
après `profs`, `settings`, `planning_entries`, `is_admin()`, `is_prof()`, `my_stagiaire_id()` qu'elle demande ;
`20261108_questionnaires.sql` telle quelle ; les seules colonnes des tables que touche `_anonymiser_stagiaire`, relevées en
lecture seule sur la base réelle.

**Interfaces :**
- Part de la dernière version de `_anonymiser_stagiaire`, `anonymiser_promo`, `anonymiser_stagiaire`,
  `etat_anonymisation_promo` (`supabase/migrations/20261028_roles_2_fonctions.sql`, l. 326 à 522) ; les quatre sont supprimées.
- `stagiaires.efface_le timestamptz`, contrainte `anonymise_le is null or efface_le is not null` ; une fiche déjà anonymisée
  reçoit `efface_le = anonymise_le`.
- Émargement : `emargement_lignes.signature_effacee_le` et `emargement_formateurs.signature_effacee_le` (timestamptz) ; la
  contrainte « tracé, heure et signataire ensemble » (`20261023_emargement.sql` l. 44, nom relevé dans `pg_constraint`) accepte
  un tracé nul quand `signature_effacee_le` est posé ; `emargement_formateurs.trace` devient nullable sous la même condition ;
  `signe_par` reste obligatoire et vaut `anonyme`, jamais nul. `emargement_signer` (version du lot 4, `20261028_roles_2_fonctions.sql` l. 277, qui ne vérifie que `actif`) et
  `emargement_annoter` (version du 23/10) réécrites : refus d'une fiche sans nom (« emargement: Stagiaire introuvable dans
  cette promo. »). `emargement_clore` (version du 23/10) réécrite : n'ajoute pas
  d'absence aux fiches sans nom.
- `effacements_journal.type` accepte en plus `etape1`, `etape2`, `demande`, `questionnaires`, `registre`.
- `_effacer_etape1(p_id integer) returns jsonb` : ce que fait `_anonymiser_stagiaire`, SAUF suppression du dossier
  professionnel et du livret, changement de nom et `actif` ; EN PLUS : `emargement_lignes.observation` nulle, `signe_par` et
  `maj_par` égaux à un e-mail de la personne → `anonyme` ; participations de la fiche supprimées (tâche 3) ; `efface_le = now()`.
  Rejouée : `{ deja: true }`.
- `_effacer_etape2(p_id integer) returns jsonb` : `_effacer_etape1` si `efface_le` est nul, puis suppression du dossier
  professionnel et du livret, tracés de la fiche effacés (`signature_effacee_le`), `prenom = 'Anonyme ' || id`, `nom = null`,
  `anonymise_le = now()`.
- `etat_conservation() returns jsonb` (forme : tâche 1), `effacer_promo_etape1(p_promo integer) returns jsonb`,
  `effacer_promo_etape2(p_promo integer) returns jsonb` (en plus, pour les feuilles de la promo : formateurs renommés
  « Formateur 1 », « Formateur 2 »… par feuille dans l'ordre de `signe_le`, `prof_id` nul, tracé effacé, `signe_par =
  'anonyme'` ; `ouverte_par`, `close_par`, `signe_par`, `maj_par` des lignes → `anonyme`), `effacer_sur_demande(p_stagiaire_id
  integer) returns jsonb` (étapes 1 et 2 tout de suite, sans condition sur `actif` ni sur la date, journal de type `demande`).
  Droits et refus : contraintes communes ; refus en « conservation: <phrase> », avant la date « conservation: Possible à partir
  du JJ/MM/AAAA. » ; comptes d'équipe ignorés et comptés ; une ligne de journal par appel effectif (cible « promo n » ou
  « stagiaire n », jamais un nom).
- Retour : réversible seulement avant toute étape. Il commence par refuser (exception) dès qu'une ligne de type `etape1`,
  `etape2`, `demande`, `questionnaires` ou `registre` est au journal ou qu'une portée est figée ; sinon il recrée les quatre
  fonctions à l'identique (`_anonymiser_stagiaire` avec le `revoke` de `20261005_effacement_donnees.sql` l. 134), les
  contraintes, `emargement_signer` (version du lot 4), `emargement_annoter` et `emargement_clore` (versions du 23/10), et les
  fonctions des tâches 3 et 4 dans leurs versions Q3 et Q4. Procédure écrite en tête : retirer d'abord le commit de l'app, puis jouer le retour.
- Anciennes preuves : `effacement-preuve.sql` est remplacée par la preuve de ce lot (en-tête : historique, à ne plus jouer après
  ce lot) ; dans `roles-preuve.sql`, les quatre cas des l. 1819 à 1838 passent sur `effacer_sur_demande` et
  `effacer_promo_etape1` pour le mode « en-ligne » (mêmes attentes), et l'en-tête dit que le mode répétition, qui rejoue l'étape 2
  d'origine, ne se joue plus sur une base où ce lot est appliqué ; `roles-retours-recette.sql` (l. 69 à 71) : en-tête qui dit que
  le retour de l'étape 2 du lot 4 recréerait les quatre fonctions supprimées, donc à ne jouer qu'après le retour de ce lot.
- [ ] **Étape 1 : preuve qui échoue** (méthode de la mémoire « Répétition de migration dans la preuve SQL » : migration et
  retour par `EXECUTE` dans le `DO`, empreintes md5 du schéma, droits compris (`proacl`), et des données avant et après, levée
  finale « VERT n/0 » ou « ROUGE ok/ko : cas ») : la migration seule n'efface rien (comptes de lignes et de valeurs non nulles
  identiques avant et après) ; aucun droit d'appel des six fonctions internes pour `anon`, `authenticated`, `service_role` ;
  étape 1 refusée la veille, acceptée le jour ; après l'étape 1, compte, e-mails, date de naissance, fiche de suivi, textes
  libres et observations d'émargement absents, nom, dossier, livret et tracés présents, `actif` inchangé (vrai et faux) ; étape 2
  refusée le 31/12 de la 3ᵉ année, acceptée le 01/01 ; après, plus de nom, de dossier, de livret ni de tracé, `signe_le` et
  présences intacts, `actif` inchangé ; feuille à deux formateurs ; étape 2 sur une fiche sans étape 1 ; second appel sans effet
  ni journal ; compte d'équipe ignoré ; demande sur une fiche active ; après une demande, signature et annotation de la fiche
  refusées sur une feuille ouverte, et feuille close sans absence ajoutée ;
  formateur, stagiaire, fondateur en aperçu et direction d'un autre centre refusés ; promo sans date refusée ; date de fin
  déplacée après l'étape 1 : rien n'est défait ; `emargement.effacement` vide après chaque fonction ; journal sans nom ni e-mail ;
  retour refusé après une étape. Contre-épreuves : chaque garde retirée tour à tour (date, droit, lieu, équipe, `actif` écrit,
  `revoke`) rend ROUGE.
- [ ] **Étape 2 :** migration, retour, en-têtes des anciennes preuves. **Étape 3 :** preuve VERTE en local
  (`PGCLIENTENCODING=UTF8`, base jetable comme dans l'en-tête de la preuve Q3), contre-épreuves ROUGES, retour joué hors preuve
  (empreinte identique) ; résultats en en-tête.
- [ ] **Étape 4 : commit** « Conservation : deux étapes, effacement sur demande, émargement (non appliqué) ».

### Tâche 3 : migration, partie questionnaires

**Fichiers :** compléter la migration, le retour, le schéma minimal et la preuve de la tâche 2 ; adapter
`tests/sql/questionnaires-preuve.sql`.

**Interfaces :**
- `_questionnaire_rebrasser(p_cle text, p_promo integer, p_lieu integer, p_annee integer) returns void` : la boucle de
  brassage de `repondre_questionnaire` (l. 405 à 416 de `20261108_questionnaires.sql`), extraite telle quelle.
- `_questionnaire_comptes(p_cle text, p_promo integer, p_lieu integer, p_annee integer) returns jsonb` → `{ reponses, questions }`
  : le calcul de `resultats_questionnaire`, extrait tel quel (seuil question par question).
- Table `questionnaire_resultats_figes` (`cle`, portée comme les réponses avec `on delete restrict`, `seuil`, `reponses integer`
  nul sous le seuil, `questions jsonb`, `fige_le date`), unique sans distinction des nuls sur (cle, portée) ; RLS active, aucun
  droit pour les rôles de l'API. Le retour refuse si elle a une ligne (seule copie des pourcentages).
- `_questionnaire_effacer_commentaires(...) returns integer` (commentaires nuls, puis rebrassage) ; `_questionnaire_figer(...)
  returns jsonb` (comptes au seuil seulement dans la table figée, puis suppression des réponses et des participations de la
  portée). Les deux prennent le verrou par portée de `repondre_questionnaire` (l. 355).
- `resultats_questionnaire` réécrite (même signature) : la ligne figée si elle existe (`fige: true, fige_le`), sinon le calcul
  vivant ; `satisfactionDe` (Q3b) la lit sans changement. `repondre_questionnaire` réécrite (même signature) : appelle
  `_questionnaire_rebrasser`, écrit `stagiaire_id`. `_questionnaire_ouvert` réécrite : fermée, ouverture manuelle comprise, à
  partir de la date de l'étape 1 de la promo (stagiaires), et pour une année de formateurs dont la clôture est faite (la
  manuelle ne prime plus, ce qui retire aussi l'année de `questionnaires_a_remplir`, l. 306) ; `ouvrir_questionnaire` refuse
  alors l'ouverture. La clôture est notée par portée (journal de type `questionnaires` et table ou colonne au choix du
  constructeur, lue par `_questionnaire_ouvert`).
- `questionnaire_participations` : `stagiaire_id integer references stagiaires(id) on delete cascade` (rempli depuis
  `user_profiles`, une ligne par fiche si l'étape 0 a trouvé des doublons), unique (cle, promo_id, stagiaire_id) pour les clés des
  stagiaires ; `user_id` passe en `on delete set null` et l'unicité existante (`nulls not distinct`) ne porte plus que sur les
  lignes qui ont un compte. `_effacer_etape1` et `effacer_sur_demande` suppriment les participations de la fiche.
- `effacer_promo_etape1` efface aussi les commentaires de `fin_stagiaire` et `six_mois_stagiaire` de la promo ;
  `effacer_promo_etape2` fige ces deux questionnaires. Formateurs : `clore_annee_formateurs(p_lieu integer, p_annee integer)
  returns integer` (participations de la portée supprimées), `effacer_commentaires_formateurs(p_lieu integer, p_annee integer)
  returns integer`, `figer_questionnaire_formateurs(p_lieu integer, p_annee integer) returns jsonb` (dates : contraintes
  communes). Limite restante (formateur au compte recréé dans l'année, question 6) écrite dans l'en-tête de la migration, à la
  place de celle de Q3. `etat_conservation()` gagne `portees_formateurs`. Journal de type `questionnaires`.
- [ ] **Étape 1 : preuve qui échoue** : commentaires nuls et notes intactes après l'étape 1, identifiants tous changés ;
  ouverture manuelle et envoi refusés après la date de l'étape 1 ; 4 réponses figées → aucun compte, marque sous le seuil ; 5 →
  comptes égaux à ceux d'avant ; formateurs 2 et 3 ; après figeage, `resultats_questionnaire` rend la ligne figée, réponses et
  participations de la portée absentes ; compte supprimé puis recréé sur la même fiche : deuxième réponse refusée ;
  participations des formateurs refusées à effacer le 31/12 de l'année, acceptées le 01/01 ; après la clôture d'une année,
  ouverture manuelle de cette année refusée, rien proposé, envoi refusé (pas de deuxième réponse) ; second effacement ou second figeage
  sans effet ni journal ; aucune lecture directe de la table figée ; contre-épreuves (seuil, rebrassage, verrou, date retirés).
- [ ] **Étape 2 : adapter la preuve Q3** : les colonnes attendues des participations (l. 285 à 288) deviennent
  `annee,cle,lieu_id,promo_id,stagiaire_id,user_id`, le cas « aucune colonne commune hors portée » reste ; la fiche X anonymisée
  sans `efface_le` (l. 232 à 236) reçoit `efface_le` en même temps ; attendu : VERT sur une base où ce lot est appliqué, avec
  le nombre de cas noté en en-tête.
- [ ] **Étape 3 :** code. **Étape 4 :** preuves de ce lot et Q3 VERTES, contre-épreuves ROUGES, retour à empreinte identique.
- [ ] **Étape 5 : commit** « Conservation : commentaires, réponses figées, participations (non appliqué) ».

### Tâche 4 : registre qualité (lot Q4)

Le lot Q4 (commit 9fac030, tâches 2 et 4) construit l'effacement à 3 ans : `effacer_registre_qualite()` vide les textes des
entrées closes depuis 3 ans, son déclencheur refuse `efface_le` hors de ce cas, et son sous-onglet porte le bouton « Effacer les
textes » et le rappel en tête de la page Qualiopi. Cette tâche part de ce qui aura été construit, noms relus, jamais devinés.
**Si le lot Q4 ne l'a pas construit, ce lot le porte**, à l'identique de la tâche 2 du plan Q4.
- Un seul bouton : celui du registre ; la section de la tâche 7 montre l'échéance (`etat_conservation()`, `registre`) et y
  renvoie, sans second bouton.
- Journal : `effacer_registre_qualite` réécrite (même signature, mêmes droits) pour écrire une ligne de type `registre` (cible
  « registre », nombre d'entrées) quand elle vide au moins une entrée.
- Si Timy répond à la question 5 qu'une entrée jamais close doit être vidée : retouche du déclencheur et de la fonction du lot Q4
  (entrée ouverte dont la date d'entrée a plus de 3 ans), preuve et conditions dans le même commit.
- Retour : `registre` fait partie des types qui le font refuser (tâche 2) ; avant tout effacement, il recrée la version Q4 de
  `effacer_registre_qualite` (et du déclencheur s'il a été retouché).
- [ ] **Étapes** : preuve (journal écrit une fois, rien avant l'échéance, droits, retour refusé après un effacement du registre),
  code, VERT ; preuve du lot Q4 rejouée sur la base où ce lot est appliqué (VERT attendu, nombre de cas noté) ; commit
  « Conservation : journal du registre qualité ».

### Tâche 5 (seulement si Timy retient l'option (b) de la question 1) : liste « qui a répondu » effacée à la fermeture

- Stagiaires : `effacer_participations(p_cle text, p_portee jsonb) returns integer` (droits des contraintes communes), possible
  seulement fenêtre close ; la portée est alors close pour de bon (`ouvrir_questionnaire` et `repondre_questionnaire`
  refusent) ; échéance ajoutée à `etat_conservation()` et à la section de la tâche 7.
- Conditions (passages 4 et 8 du document des textes) réécrites avec Timy dans le même commit ; Timy dit si le figeage à 3 ans
  reste (par défaut : oui).
- [ ] **Étapes** : preuve (fenêtre ouverte refusée, réouverture refusée après, plus aucune ligne reliant un compte), code, VERT,
  commit « Questionnaires : liste des participants effacée à la fermeture ».

### Tâche 6 : accès depuis l'app et banc

**Fichiers :** modifier `js/db.js` ; `_harness_supabase.js` (hors dépôt, levier `&conservation=1`, décrit dans le rapport).
**Interfaces :** `lireEtatConservation()`, `effacerPromoEtape1(promoId)`, `effacerPromoEtape2(promoId)`,
`effacerSurDemande(stagiaireId)`, `cloreAnneeFormateurs(lieuId, annee)`, `effacerCommentairesFormateurs(lieuId, annee)`,
`figerQuestionnaireFormateurs(lieuId, annee)`, `lireEffacementsSurDemande(promoIds)` → `Set` d'identifiants de fiche (type
`demande` du journal), lu par une fonction de la base `fiches_effacees_sur_demande(p_promo_ids uuid[])` (`security definer`,
ne rend que les fiches des promos que l'appelant peut lire, `peut_acceder_promo`, sans le texte du journal ; ajoutée à la
migration de la tâche 2, à sa preuve et à son retour) : la règle de lecture du journal suit la seule promo affichée
(`20261028_roles_3_regles.sql:622-631`), si bien qu'une lecture directe laisserait vides les lignes des autres promos du
tableau de bord pour un Formateur ; erreurs « conservation: » rendues en phrase lisible ; `anonymiserStagiaire`, `anonymiserPromo`,
`etatAnonymisationPromo` retirées ; `listStagiaires` (liste active) exclut `anonymise_le` posé ; les chargements avec
`includeInactive` (`js/views/emargement.js` l. 65, `js/planning-lecture.js` l. 33) gardent les fiches sans nom pour le passé, et
chaque liste de choix qu'ils alimentent (dés, placement, feuille ouverte) les retire ; `lireDonneesCentre` lit en plus
`efface_le` ; commentaire de `listEmargementPresences` (l. 1952) : une ligne est signée quand `signe_le` est posé, même si le
dessin est effacé.
- [ ] **Étapes** : écrire, `node --check js/db.js`, suite `node --test tests/` verte, commit « Conservation : lecture et actions ».

### Tâche 7 : section « Conservation des données » (page Qualiopi) et Paramètres allégé

**Fichiers :** modifier `js/views/qualiopi.js`, `css/qualiopi.css`, `js/views/config.js`, `js/nouveautes-data.js`, et leurs tests
de câblage (`tests/qualiopi-page.test.mjs`).
**Comportement :** une section (ou un sous-onglet, à la forme que le lot Q4 aura donnée à la page) liste
`echeancesConservation` : date, ce qui part, ce qui reste, bouton quand l'échéance est passée ; confirmation par saisie, comme
aujourd'hui (`confirmationValide`), avec la liste exacte de ce qui part ; une ligne en tête de la page quand une échéance est
passée. « Effacer à la demande » sur chaque fiche de la promo choisie. Paramètres : le bloc des abandons garde « Réactiver » et
exclut les fiches effacées (`efface_le`) ; la section « Données personnelles » reste (attendue par `outils/verifier_navigation.py`,
l. 2359 et 2360) : purge des élèves bénévoles pour qui y a droit, et la phrase « La conservation des fiches est gérée par le
fondateur, sur la page Qualiopi. », avec un lien pour le fondateur seulement. Entrée Nouveautés `pour: "formateurs"`.
- [ ] **Étapes** : tests de câblage (fondateur seul, pas de lien pour un membre d'équipe, 44 px, aucun U+2014), vue, suite verte,
  commit « Qualiopi : conservation des données ».

### Tâche 8 : indicateurs, dossiers et feuilles d'émargement lisent les marques

**Fichiers :** modifier `js/emargement-rules.js` (`etatLigne` l. 99 et `minutesPresence` l. 285 : signé quand `signe_le` est
posé, ou le tracé, ou `signature_effacee_le` ; `stagiairesDeFeuille` l. 40 : une feuille ouverte ne liste pas une fiche sans
nom, une feuille close garde ses lignes), `js/emargement-feuilles.js` et `js/views/emargement.js` (« Signature effacée (durée
de conservation) » à la place du dessin), `js/centre-stats.js` (`indicateursPromo(donnees, referentiel, { aujourdhui, demandes })`,
`demandes` : le `Set` de `lireEffacementsSurDemande` ; une fiche de `demandes` est comptée parmi les inscrits, ni en formation ni
en abandon, avec `effectif.detail.surDemande` ; phrase de méthode de l'abandon : seule la décision de l'équipe compte),
`js/qualiopi-preuves.js` (même `Set` dans `donnees.demandes` : les pièces `dossierPro` et `evaluations` ne comptent pas ces fiches
comme manquantes ; après l'étape 2, raison fixe « effacé au terme de la durée de conservation », jamais « aucun dossier
enregistré » ; satisfaction figée lue comme la vivante), `js/qualiopi-documents.js` (statut par `statutFiche`, même `Set`), et
leurs tests. Appelants de `indicateursPromo` à mettre à jour, chacun avec l'ensemble des demandes de ses promos (lu une
fois par écran) : `js/views/centre.js:283` et `:336`, `js/views/aujourdhui.js:228`, `js/views/qualiopi.js:627`, `:659` et
`:756`, `js/qualiopi-preuves.js:456` ; `demandes` absent vaut un ensemble vide (aucun appelant oublié ne casse), et un test
vérifie par lecture du texte que chaque appel passe `demandes`. Si Timy répond autrement à la question 12, seule la règle de
comptage de `indicateursPromo` change.
- [ ] **Étapes** : tests (heures intactes après l'étape 2 : `minutesPresence` et total de la feuille imprimée égaux avant et
  après ; feuille ouverte sans la fiche effacée à la demande, feuille close qui la garde en « Anonyme n » ; promo effacée à
  l'étape 1 : abandons inchangés ; étape 2 : pièces et statut ; demande : même effectif au tableau de bord et au dossier,
  pièce non manquante, phrase exacte ; aucune fuite de nom dans la version sans noms), code, vert, commit « Qualiopi et
  émargement : marques de conservation ».

### Tâche 9 : conditions, registre des traitements, rappel, notes

- [ ] **Étape 1 :** si Timy a fait entrer les corrections de la partie (b) dans la 2026-11-08 avant la mise en ligne de Q3 :
  rien à faire dans `js/legal-data.js`. Sinon : version suivante (`VERSION_CONDITIONS` du jour), passages soumis à Timy avant la
  migration, `tests/legal-rules.test.mjs` vert.
- [ ] **Étape 2 :** dans `C:\Users\watch\Dev\ECSR\docs\legal\registre_traitements.md` (autre dépôt, commit dans ce dépôt-là, rien
  ici) : partie (b), dernier paragraphe.
- [ ] **Étape 3 :** rappel (question 9), dans le dépôt ECSR : la veille du lundi (`tools/veille/`) lit en lecture seule
  `promos.date_fin` et `effacements_journal`, et écrit dans son rapport les échéances passées ou à moins de 30 jours ; test de
  l'outil de veille, commit dans ce dépôt-là.
- [ ] **Étape 4 :** `PROJECT_NOTES.md`, section « Conservation » (marques, dates, droits, retour, banc, ce qui attend Timy) ;
  commit « Conservation : notes de projet ».

### Tâche 10 : banc, robot, répétition et mise en ligne

- [ ] **Étape 1 :** banc (`&conservation=1`) : fondateur qui lit les échéances, lance chaque étape, efface une fiche à la demande ;
  formateur sans bouton ; stagiaire inchangé ; feuille imprimée après l'étape 2 ; 375 px et ordinateur, Chromium et WebKit ;
  parcours robot « conservation » ajouté (`outils/parcours/`), `outils/robot_parcours.py` et `outils/verifier_navigation.py`
  sans échec propre à la branche.
- [ ] **Étape 2 :** suite node complète ; preuves de ce lot et Q3 rejouées ; contrôle Python : aucun `chr(0x2014)` dans les
  fichiers touchés.
- [ ] **Étape 3 : répétition sur données réalistes**, en local : base jetable chargée du schéma minimal et de données fictives aux
  volumes relevés en lecture seule sur la base réelle (fiches, lignes d'émargement, réponses) ; migration, étapes 1 et 2, retour
  avant et après une étape ; durées et empreintes dans le rapport.
- [ ] **Étape 4 : à Timy** : partie « À valider », migration, preuves, répétition. Avec son accord seulement : répétition dans
  une transaction annulée sur la base réelle, puis application en une transaction (`PGCLIENTENCODING=UTF8 psql -1 -v
  ON_ERROR_STOP=1 -f ...`), contrôle sur la base réelle (`etat_conservation()`, aucune ligne de journal nouvelle), fusion et
  poussée. Aucune étape d'effacement n'est lancée sur la base réelle par l'agent.
