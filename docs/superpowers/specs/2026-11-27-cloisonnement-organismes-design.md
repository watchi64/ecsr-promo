# Cloisonnement par organisme : design

Date : 27/11/2026. Branche `cloisonnement-organismes`, worktree `C:/Users/watch/Dev/ecsr-promo-cloisonnement`.
Inventaire détaillé (fonction par fonction, avec fichier et ligne) : notes partagées de la session,
`cloisonnement-inventaire.md` ; le résumé utile est en § 6.

## 1. Pourquoi

Jalonya doit être proposée à d'autres organismes de formation qu'ECF, dans la même base. Aujourd'hui la base ne connaît que
des centres (`lieux`) et des promos ; le rôle « siège » n'a aucune portée et vaut pour toute la base. Avec un deuxième client,
le siège d'ECF verrait ses centres, ses directions et ses chiffres, et réciproquement. Les conditions d'utilisation valables
pour tout centre (`docs/legal/conditions_tous_centres.md` du dépôt ECSR, section 4) ne sont vraies qu'une fois ce cloisonnement
en place.

**Réussi quand** : un siège, une direction, un formateur ou un stagiaire d'un organisme ne voit, ne compte et ne modifie
rien d'un autre organisme ; ECF ne voit aucune différence ; une preuve SQL rejouable le montre.

## 2. Décisions de Timy (27/11)

| Question | Décision |
|---|---|
| Unité de cloisonnement | **L'organisme** (l'entreprise cliente : responsable du traitement, titulaire Qualiopi, nom du livret). Un seul niveau ; un niveau « réseau » au-dessus pourra s'ajouter plus tard sans rien défaire. |
| Contenus communs (cours, QCM, référentiel) | **Un organisme rédacteur** : lus par tous, écrits seulement par les comptes d'un organisme marqué rédacteur (ECF Bouscaren). Les autres signalent. |
| Accès du fondateur (Timy) | **Rattaché à ECF au quotidien, accès support explicite** : sa liste de promos ne montre qu'ECF ; ouvrir un autre organisme est un geste volontaire, inscrit au journal. |
| Façon de construire | **Une seule base, cloisonnée par organisme** (et non une base Supabase par client). |
| Bornage du fondateur hors support | **Complet** : hors support, le fondateur ne lit et ne modifie rien d'un autre organisme, qualité et conservation comprises. Seule exception globale : les « Signaler un problème » de l'app, qui lui sont adressés par nature. |

## 3. Buts, non-buts, anti-buts

**Buts**
- Table des organismes ; chaque centre et chaque siège rattaché à un organisme.
- Tout droit de siège, toute lecture du personnel, tout partage d'annuaire, toute unicité de nom bornés à l'organisme.
- Écriture des contenus communs réservée à l'organisme rédacteur.
- Accès support du fondateur, borné dans le temps et journalisé.
- Le nom de l'organisme remplace les valeurs ECF en dur.
- Preuve rejouable « A ne voit rien de B » ; non-régression des preuves existantes ; robot des parcours vert.

**Non-buts (chantiers à part)**
- Confier la gestion Qualiopi à chaque organisme : registre qualité, questionnaires, conservation, effacements restent au
  fondateur (`peut_gerer_qualite()`), comme aujourd'hui, mais **bornés à son organisme actif** (§ 5.2) : pour le Qualiopi
  de B, il ouvre un accès support.
- Texte des conditions d'utilisation par organisme (session « Document neutre sur la confidentialité »).
- Écran de création d'un organisme : le premier client B se crée par une migration ou par le fondateur en SQL.
- Habillages propres à chaque organisme : la liste reste `ecsr` et `ecf` ; seul le réglage « habillage du réseau » devient
  celui de l'organisme.
- Quotas de l'assistant et de l'IA des QCM par organisme.

**Anti-buts (échec même si ça marche)**
- La moindre différence visible pour ECF (stagiaires, formateurs, direction, siège) en dehors du nom d'organisme affiché.
- Un droit d'ECF qui disparaît (en particulier : les formateurs d'ECF qui rédigent cours et QCM aujourd'hui gardent ce droit).
- Une fuite trouvée après la mise en ligne parce qu'une table ou une fonction n'était pas dans la preuve.
- Un accès support permanent ou silencieux.

## 4. Contraintes

- Mêmes méthodes que les lots précédents (multi-promo, lot 4, titres) : migrations en étapes, chacune avec son `_retour.sql`,
  ses gardes (md5 du corps qu'elle remplace), sa preuve dans `tests/sql/`, répétée sur la base locale
  (`outils/base_locale/reconstruire.sh` puis `rejouer_suite.sh --production`) avant toute application.
- Rien en production sans l'accord de Timy ; la production est jouée par `outils/psql_prod.sh`, en une transaction, et
  seulement après accord. La fusion dans `main` revient à la session de coordination.
- Les iPhone en cache : une version ancienne de l'app doit continuer de fonctionner pendant la transition (aucune colonne
  ni fonction lue par l'app actuelle ne disparaît ou ne change de type à l'étape 1 et 2).
- Charte : jamais de tiret cadratin ; textes en français ; entrée Nouveautés à la mise en ligne de l'étape visible.

## 5. Le modèle

### 5.1 Tables et colonnes

- **`organismes`** : `id`, `nom` (raison sociale imprimée, ex. « ECF BOUSCAREN »), `redacteur boolean` (écrit les contenus
  communs), `habillage` (remplace la clé globale `settings.habillage_reseau`), `cree_le`. Lecture : les membres de
  l'organisme (personnel et stagiaires) et le fondateur ; aucune écriture directe.
- **`lieux.organisme_id`** non nul. `lieux.nom` n'est plus unique dans la base mais par organisme
  (`unique (organisme_id, lower(nom))`).
- **`affectations.organisme_id`** : renseigné pour le rôle `siege` (devient obligatoire pour lui), nul pour formateur et
  direction (leur organisme se lit par la promo ou le lieu). Contrainte `affectations_portee` réécrite en conséquence. *(Mon
  choix)* Un compte est siège d'un seul organisme au plus.
- **`titres.organisme_id`** pour les titres de niveau `reseau` non fixes ; les titres fixes (Formateur, Direction de centre,
  Siège) restent communs à la plateforme. Unicité des noms de titres réseau : par organisme.
- **`journal_droits`** : l'organisme de chaque ligne de niveau réseau (colonne ou lecture par le titre, au choix du
  constructeur), pour que `journal_des_droits` se borne.
- **`profs`** (fiches formateur du planning) : `organisme_id` ; `profs.nom` unique par organisme ; lecture et écriture
  bornées à l'organisme.
- **`acces_fondateur`** (le journal du fondateur) : `id`, `organisme_id`, `ouvert_le`, `ferme_le` (nul pour le
  rattachement), `motif` (obligatoire pour un support), `ouvert_par`. Une ligne sans fin = le rattachement (ECF) ; une ligne
  de support dure au plus 2 heures *(mon choix)*. Ajout par une fonction réservée au fondateur ; aucune modification ni
  suppression, sauf la fermeture anticipée d'un support. Lisible par le fondateur ; *(mon choix)* lisible aussi par le
  siège de l'organisme concerné, pour la transparence (pas d'écran dans ce chantier).

### 5.2 Le vocabulaire

- `organisme_de_lieu(l)`, `organisme_de_promo(p)`.
- **`organisme_actif_fondateur()`** : le support ouvert le plus récent non échu, sinon le rattachement. Le fondateur travaille
  dans un seul organisme à la fois.
- **`fondateur_sur(o)`** : `fondateur_reel()` et `o = organisme_actif_fondateur()`. Remplace `fondateur_reel()` dans
  `est_formateur(p)`, `est_direction(l)`, `est_siege()`, `peut_acceder_promo(p)` et les fonctions de cases (`case_promo`,
  `case_centre`, `case_reseau`), en prenant l'organisme de la promo ou du lieu en question.
  *(Mon choix, à vérifier par Timy)* : j'avais annoncé un support « seulement dans l'app ». Le borner dans la base coûte peu
  (ces quelques prédicats portent presque tous les droits du fondateur) et rend la promesse vraie même si quelqu'un appelle
  la base sans l'app.
- **`organisme_courant()`** : l'organisme de la promo affichée ; sans promo (siège), celui de l'affectation siège de
  l'appelant ; pour le fondateur, `organisme_actif_fondateur()`. En aperçu, celui de la promo affichée ou, en aperçu siège,
  l'organisme actif du fondateur.
- **`est_siege()`** garde sa signature (l'app l'appelle) mais signifie « siège de `organisme_courant()` » ; une variante
  `est_siege_de(o)` sert aux fonctions qui jugent une ligne précise.
- **`organisme_redacteur_courant()`** : l'organisme de la promo affichée (ou du siège) est rédacteur.
- **Bornage complet du fondateur** (décision de Timy) : tout usage de `est_fondateur()` ou `fondateur_reel()` qui ouvre des
  données ou des gestes d'un organisme passe par `fondateur_sur(o)`, avec `o` l'organisme de la ligne jugée. Liste relevée
  par la relecture (à compléter par le constructeur, la preuve faisant foi) :
  - lectures : `user_profiles_lecture` (personnel et invitations), `conditions_acceptations_lecture`,
    `effacements_journal_lecture`, `qcm_signalements` (lecture, modification, suppression) ;
  - gestes : `user_profiles_suppression`, contournements « si fondateur » de `donner_titre`, `_refus_titre`, `creer_titre`,
    `_refus_gestion`, `retirer_titre`, `journal_des_droits`, `inviter_compte`, `_contact_avant_ecriture` ;
  - qualité et conservation : `peut_gerer_qualite()` et ses appelants (registre, questionnaires, `etat_conservation`,
    `effacer_*`, `clore_annee_formateurs`...), jugés sur l'organisme de la promo, du lieu ou de la ligne ; une ligne du
    registre sans promo ni lieu prend l'organisme de son auteur *(au constructeur : colonne `organisme_id` si nécessaire)*.
  - **Restent globaux** : `signalements_app` (lecture, suppression, captures), le verrou `titres_ouverts`, l'écriture des
    contenus communs (cours, QCM : ils n'appartiennent à aucun client), `effacer_adresse_journal`, et `inviter_compte` pour
    le rôle siège (il crée le siège d'un organisme : il prend l'organisme en paramètre, borné à l'organisme actif).
  - Un profil de compte appartient à l'organisme de ses affectations, ou à celui de la promo de sa fiche stagiaire ; un
    compte sans l'un ni l'autre (invitation en cours) à celui de son invitation *(au constructeur : où lire cet organisme)*.

### 5.3 Ce qui se borne (résumé de l'inventaire)

| Famille | Objets | Règle après |
|---|---|---|
| Siège | `comptes_reseau()`, `creer_centre()` (doublon et verrou par organisme), `regler_habillage_reseau()`, `habillage_par_defaut()`, `inviter_compte` (branche direction), `roles_du_personnel()`, `lieux_lecture`, `affectations_lecture` | Les centres, directions et sièges de l'organisme courant seulement. |
| Titres | `siege_fixe`, `case_reseau`, `geste_reseau`, `_cases_appelant('reseau')`, `_refus_titre`, `_refus_gestion`, `donner_titre`, `retirer_titre`, `creer_titre`, `ajuster_titre`, `supprimer_titre`, `titres_visibles`, `titres_ajustables`, `personnes_et_titres`, `journal_des_droits` | Titres réseau de l'organisme ; centres de l'organisme ; un titre réseau donné crée une affectation siège sur l'organisme du titre. |
| Personnel | `user_profiles_lecture` (clause du personnel, `_contact_compte_equipe`), `roles_du_personnel` | On ne lit que le personnel qui partage un organisme avec soi. |
| Annuaire | `_contact_avant_ecriture` (centres de partage), `_contact_fiche_dans`, `annuaire_centre`, `_contact_relais_possibles`, `ma_fiche_contact` | Partage et relais limités aux centres du même organisme. La fiche d'une personne de l'équipe reste unique par adresse ; elle ne paraît que dans un organisme, puisque le personnel n'appartient qu'à un seul (§ 5.7). |
| Planning | `profs` | Bornée à l'organisme (lecture, écriture, fiches libres de `lireFichesFormateurLibres`). |
| Contenus communs | `geste_promo` pour `contenus.rediger`, `contenus.lire_internes`, `contenus.traiter`, `referentiel.modifier` ; `case_reseau('cours')` ; règles des cours, versions, questions, options, images, qcm, themes, competences, ressources ; `qcm_signalement_instruction_lecture`, `qcm_ia_brouillons_lecture`, signalements sans fiche | Écriture et traitement : seulement depuis une promo ou un siège d'un organisme rédacteur. Lecture des contenus publiés : tous. Un signalement d'un stagiaire de B est traité par le rédacteur sans que l'identité du stagiaire lui soit lisible *(à vérifier par le constructeur : comportement actuel des règles de `qcm_signalements`)*. |
| Fondateur | `est_formateur`, `est_direction`, `est_siege`, `peut_acceder_promo`, `mes_promos`, `promo_par_defaut`, cases | Bornés à `organisme_actif_fondateur()`. |
| Réglages globaux | `settings.habillage_reseau` | Devient `organismes.habillage` ; la clé globale disparaît à l'étape de ménage. |
| Fonctions serveur | `qcm-ia` (droit `is_admin()`), `contact-envois` | À relire : `is_admin()` borné par l'organisme si ses données le demandent ; rien d'autre ne traverse les organismes. |

Les autres fonctions déjà bornées à la promo ou au centre (`epcf_moyennes`, `notes_stats_groupe`, tableau de bord du centre,
questionnaires) ne changent pas : la promo et le centre appartiennent à un seul organisme.

### 5.4 L'app

- **Sélecteur de promos** : rien à faire pour les comptes ordinaires (la base ne rend que leurs promos). Pour le fondateur,
  la base ne rend que l'organisme actif.
- **Accès support** (fondateur seulement) : dans ses réglages, la liste des organismes, un bouton « Ouvrir un accès support »
  avec motif obligatoire, puis un bandeau permanent « Accès support : <organisme>, jusqu'à HH h MM » avec « Fermer ». À
  l'échéance, retour à ECF au prochain chargement.
- **Nom de l'organisme** au lieu des valeurs ECF : défaut de l'en-tête d'émargement (`js/db.js` `ENTETE_EMARGEMENT_DEFAUT`),
  organisme du livret EPCF (`js/views/epcf-livret.js` l. 435), aperçu des attestations ; l'exemple « Centre ECF Pau » du
  calendrier devient « Ex. Centre de formation de Pau ». Une fonction `mon_organisme()` (nom, rédacteur, habillage) les
  alimente.
- **Écrans du siège** (`siege-reseau.js`, `siege-directions.js`, réglages de l'habillage, titres) : inchangés à l'écran ; ils
  lisent déjà par la base, qui les borne. Le libellé « réseau » reste (pour l'utilisateur, « le réseau » = ses centres).
- **Assistant** (`chatbot/aide.mjs`) : relire les guides qui parlent d'« un seul réseau » ; redéploiement à la mise en ligne.

### 5.5 Étapes

1. **Fondations, invisible** : tables et colonnes, `organismes` n° 1 « ECF BOUSCAREN » rédacteur, tous les lieux, sièges,
   titres réseau, `profs` et l'habillage rattachés ; le rattachement du fondateur ; fonctions de vocabulaire posées mais pas
   encore appelées. Aucune règle ne change.
2. **Fonctions et règles bornées** : tout le § 5.3. Invisible pour ECF (un seul organisme), ce que la preuve de
   non-régression montre.
3. **App** : accès support, nom de l'organisme, exemples neutres ; Nouveautés ; assistant.
4. **Ménage** (plus tard, une fois les iPhone à jour) : clé `habillage_reseau`, `redacteur_contenus()` qui n'est plus citée.

### 5.6 La preuve

`tests/sql/cloisonnement-preuve.sql`, assemblée comme les précédentes, jouée sur la base locale puis (après accord) en
production dans une transaction annulée :
- crée dans la transaction un organisme B fictif : un centre au même nom qu'un centre d'ECF, une promo, des stagiaires, un
  siège, une direction, un formateur, un titre réseau au même nom qu'un titre d'ECF, une fiche d'annuaire, une fiche `profs` ;
- **matrice d'isolement** : pour chaque rôle de A (siège, direction, formateur, stagiaire, fondateur hors support) et de B,
  chaque table de données et chaque fonction de l'inventaire : zéro ligne de l'autre organisme, refus d'écriture (testé sans
  `RETURNING`), refus de partage, de nomination, de création de centre hors de son organisme ;
- **contenus** : B lit cours et QCM, ne les écrit pas ; A (rédacteur) les écrit ;
- **support** : le fondateur ne voit pas B sans support, dans aucune table ni fonction de la matrice (seule exception :
  `signalements_app`) ; avec support ouvert, il voit B et plus A ; après échéance, plus B ;
  le journal garde la ligne et refuse toute modification ;
- **sabotage** : une règle volontairement relâchée fait rougir la preuve (contre-épreuve) ;
- **non-régression** : les preuves existantes (rôles, espaces, titres, contacts, EPCF, conservation) restent vertes après
  les étapes 1 et 2.

Puis robot des parcours vert (skill `robot-des-parcours`) sur le banc après l'étape 3.

### 5.7 Réponses à la relecture du constructeur (27/11)

- **Un membre du personnel appartient à un seul organisme** *(mon choix)*. Toutes les affectations d'une adresse
  (formateur, direction, siège) sont dans le même organisme : refus à l'invitation et contrainte en base. Un ancien stagiaire
  d'un organisme peut devenir formateur d'un autre (son lien de stagiaire reste sur l'ancienne promo) : c'est le cas réel
  d'un diplômé embauché ailleurs. Conséquences : `organisme_courant()` n'a jamais à arbitrer pour le personnel ;
  `user_profiles.prof_id` reste unique ; la fiche d'annuaire n'apparaît que dans un organisme (le choix 5 du § 7 tombe). Le
  refus d'invitation dit seulement « Cette adresse ne peut pas être invitée ici » ; il révèle qu'elle sert ailleurs, comme
  le refus actuel d'un compte stagiaire : risque résiduel accepté.
- **`ressources`** *(mon choix)* : colonne `organisme_id`, nulle pour une carte commune (écrite par le rédacteur), sinon
  carte propre à un organisme (écrite par son équipe avec `referentiel.modifier`, lue par ses seuls membres). Toutes les
  cartes existantes sont rattachées à ECF : B ne voit rien tant que Timy n'a pas marqué une carte « commune ».
- **Signalements de QCM** *(mon choix)* : `qcm_signalements.organisme_id`, posé à l'écriture d'après la promo affichée (ou
  l'organisme du personnel). L'équipe d'un organisme lit et traite les signalements de ses promos et de son personnel, comme
  aujourd'hui pour sa promo. La correction du contenu reste au rédacteur et au fondateur. `qcm_signalement_instruction` et
  `qcm_ia_brouillons` (brouillons de questions) : réservés au rédacteur.

## 6. Laissé au constructeur

- Le découpage exact des migrations de l'étape 2 (une ou plusieurs), tant que chacune a son retour et sa garde.
- Le stockage de l'organisme dans `journal_droits` (colonne ou jointure).
- La manière de faire passer `organisme_courant()` à un compte siège de l'app (il n'a pas de promo) : l'affectation unique
  suffit, sans nouvel en-tête.
- Les textes exacts de l'écran support et du bandeau, dans le ton de l'app.
- Où ranger le centre de démonstration (lieu 4) : *(mon choix)* il reste dans l'organisme ECF, comme aujourd'hui.

## 7. Mes choix à vérifier en lisant

1. Le support est borné dans la base (pas seulement dans l'app), ce qui touche les prédicats centraux du fondateur (la
   décision « Complet » le rend de toute façon nécessaire).
2. Un support dure au plus 2 heures ; le fondateur travaille dans un seul organisme à la fois.
3. Le siège de l'organisme peut lire le journal des accès support qui le concernent.
4. Un compte est siège d'un seul organisme au plus.
5. Un membre du personnel appartient à un seul organisme (§ 5.7).
6. Le centre de démonstration reste rattaché à ECF.
7. Les cartes de Ressources existantes sont toutes rattachées à ECF jusqu'à ce que Timy en marque une « commune ».
8. Les signalements de QCM se lisent par l'équipe de l'organisme qui les a émis ; brouillons IA et instructions au rédacteur.
