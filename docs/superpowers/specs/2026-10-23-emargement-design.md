# Émargement numérique signé : conception

Date : 23/10/2026. Demande : session « Émargement » lancée par la session de préparation du
rendez-vous ECF (Gaëlle et un responsable de projet, semaine du 26/10/2026). Timy a répondu
« pars sur tes choix » : les choix ci-dessous sont ceux de la proposition, complétés par le
rédacteur (marqués « choix du rédacteur »).

## 1. Intention

Remplacer la feuille d'émargement papier par une signature au doigt dans l'app, et produire
la feuille A4 que demande un audit Qualiopi (critère 3, indicateur 11 : assiduité). Les
documents commerciaux annoncent l'émargement « à venir » : il doit être démontrable sur la
promo de démonstration (id 7) pendant le rendez-vous.

Ce qui compte pour Timy et les centres :

- le formateur garde la main : c'est lui qui ouvre et clôt une demi-journée ;
- un stagiaire signe en quelques secondes, sur son propre téléphone ;
- rien n'est ressaisi : les absences déjà notées au planning sont reprises ;
- la feuille imprimée se suffit à elle-même devant un auditeur.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

1. Par demi-journée, le formateur ouvre l'émargement ; chaque stagiaire présent signe au
   doigt ; le formateur signe ; le formateur clôt.
2. Absences du planning reprises (champ `absences` des cartes de la demi-journée).
3. Feuille A4 imprimable (PDF par l'impression du navigateur) par demi-journée et par
   semaine : organisme, intitulé de la formation, promotion, date, créneau et horaires, nom et
   signature de chaque stagiaire et du formateur, heure de chaque signature.
4. Signatures horodatées par le serveur, impossibles à modifier après coup par quiconque
   passant par l'app (ni stagiaire, ni formateur).
5. Cloisonné par promo comme le reste (multi-promo), démontrable sur la promo 7 et effacé
   avec elle.

**Non-objectifs (v1)**

- Attestations d'assiduité ou certificats de réalisation (feuille seulement ; le total
  d'heures de la semaine prépare la suite).
- Émargement des stages en entreprise (pas de séance ouverte ces semaines-là).
- Code ou QR de séance prouvant la présence physique (choix du rédacteur : le formateur
  voit en direct qui a signé et clôt ; une séance ne se signe que le jour même).
- Export autre que l'impression du navigateur (pas de génération de PDF côté serveur).
- Durée de conservation et mention dans les conditions d'utilisation : suite à traiter à
  part (voir § 9).

**Anti-objectifs (ce qui serait un échec même si ça marche)**

- Une signature modifiable ou supprimable depuis l'app, ou datée par l'appareil.
- Un stagiaire qui voit la signature d'un autre.
- Une feuille qui mélange deux promos, ou qui change après sa clôture parce que le planning
  a bougé.
- Un écran de signature pénible au doigt sur un iPhone de 375 px (zone trop petite, page qui
  défile pendant le tracé).

## 3. Contraintes

- App sans framework, sans build, servie par GitHub Pages depuis `main` ; base Supabase de
  production unique : aucun essai d'écriture en prod, essais sur le banc et sur une base
  Postgres locale ; migration appliquée seulement avec l'accord de Timy.
- Multi-promo : `promo_id` sur chaque table, règle `promo_id = (select promo_courante())`,
  rôles par `is_admin()`, `is_prof()`, `my_stagiaire_id()` (fonctions existantes).
- Les trois formateurs réels sont `is_admin` ; « formateur » se lit `is_admin() or is_prof()`.
- Pas de tiret cadratin ; entrée Nouveautés dans le commit de mise en ligne ; vérification au
  navigateur, 375 px compris.

## 4. Ce qui est décidé

### 4.1 Déroulé

1. **Ouvrir** (formateur, page Émargement) : seulement la demi-journée du jour. Horaires
   repris du planning (`planning_half_meta`, sinon 9h00 à 12h30 et 13h30 à 17h00),
   modifiables à l'ouverture.
2. **Signer** (stagiaire) : un bandeau apparaît en haut de l'app, quelle que soit la page :
   « Émargement du matin ouvert : signer ». Il ouvre une fenêtre plein écran : phrase
   d'attestation, zone de signature, « Effacer », « Valider ma signature ». Une signature
   validée ne se refait pas.
3. **Faire signer ici** (formateur, secours) : sur l'appareil du formateur, pour un stagiaire
   sans téléphone ou sans batterie. La signature est marquée « sur l'appareil du formateur »
   (choix du rédacteur). C'est aussi ce qui rend la démonstration possible : les stagiaires
   fictifs de la promo 7 n'ont pas de compte.
4. **Absences** : un stagiaire noté absent sur une carte du planning de la demi-journée porte
   l'étiquette « absent au planning » mais peut encore signer tant que la feuille est ouverte
   (l'absence du planning concerne un passage). Le formateur peut marquer absent ou retirer
   l'absence, et ajouter une observation libre (« Arrivé à 9h40 », « Absence justifiée »)
   sur n'importe quelle ligne, même après clôture.
5. **Signature du formateur** : nom proposé (son nom s'il est formateur de l'app, sinon les
   formateurs de la demi-journée au planning, y compris les noms libres), puis tracé.
   Plusieurs formateurs peuvent signer.
6. **Clore** : exige au moins une signature de formateur. Tout stagiaire actif sans
   signature devient absent, avec l'origine « noté au planning » ou « non signé ». La feuille
   est alors figée (sa liste ne dépend plus du planning ni des fiches).
7. **Rouvrir** : le jour même seulement ; les absences posées par la clôture s'effacent, les
   autres restent.

Règle de temps : un stagiaire ne signe que le jour de la séance (heure de Paris) ; l'heure
enregistrée est toujours celle du serveur. Exception (relecture du 23/10) : le formateur peut
encore signer une feuille oubliée un autre jour, à l'heure réelle imprimée avec sa date, pour
pouvoir la clore.

### 4.2 Base (migration `20261023_emargement.sql`)

Trois tables, toutes avec `promo_id` :

- `emargement_seances` : `jour`, `demi_journee` (`matin` | `aprem`, comme le planning),
  `debut` / `fin` (texte `HH:MM`, comme `planning_half_meta`), `statut` (`ouverte` |
  `close`), qui et quand pour l'ouverture et la clôture ; unique `(promo_id, jour,
  demi_journee)`.
- `emargement_lignes` : une ligne au plus par stagiaire et par séance : `trace` (tracé),
  `signe_le`, `signe_par` (compte), `sur_appareil_formateur`, `absent`, `absence_origine`
  (`formateur` | `planning` | `non_signe`), `observation`, `maj_le`, `maj_par`.
- `emargement_formateurs` : `nom`, `prof_id` (si connu), `trace`, `signe_le`, `signe_par` ;
  unique `(seance_id, lower(nom))`.

Clé étrangère vers `stagiaires` **sans cascade** : une fiche qui a signé ne se supprime pas
par erreur (aucun écran ne supprime de fiche aujourd'hui ; l'effacement anonymise).
Séance supprimée : ses lignes et signatures suivent (cascade), ce qui sert au ménage de la
promo 7.

**Écritures uniquement par fonctions serveur** (`security definer`), aucun droit d'écriture
direct pour `authenticated` : `emargement_ouvrir`, `emargement_signer`,
`emargement_signer_formateur`, `emargement_annoter`, `emargement_clore`, `emargement_rouvrir`.
Chacune vérifie le rôle, la promo courante, l'état de la séance et le jour.

**Inaltérabilité** : un déclencheur refuse toute modification du tracé, de l'heure ou de
l'auteur d'une signature déjà posée, et toute modification d'une signature de formateur,
même par une fonction serveur fautive.

**Lecture** : séances lisibles de toute la promo ; lignes lisibles des formateurs et du
stagiaire concerné seulement ; signatures de formateurs lisibles des formateurs.

**Tracé** : chemin SVG fait de commandes `M x y` et `L x y` en entiers, dans un repère fixe
de 400 x 160 quel que soit l'écran, simplifié (un point tous les 2 unités au moins).
Validé à l'identique côté app et côté serveur (expression régulière, 20 000 caractères au
plus) : quelques kilo-octets par signature, net à l'impression.

### 4.3 App

- **Page Émargement** `#/emargement` (formateurs ; un stagiaire est renvoyé vers Mon espace),
  route du socle comme `stagiaires`, donc pas un module (choix du rédacteur : rien n'apparaît
  aux stagiaires tant qu'aucun formateur n'ouvre de feuille, un module n'aurait rien à
  masquer). Accès : tuile d'Accueil et bouton dans l'en-tête du Planning, à côté de
  Priorités. Adresse d'une séance : `#/emargement/2026-10-26/matin`.
- Vue semaine : les cinq jours, matin et après-midi, avec leur état (pas ouverte, ouverte
  avec le compte des signatures, close avec présents et absents ; jour férié ou désactivé
  grisé). Boutons « Feuille de la semaine » et « En-tête de la feuille ».
- Vue séance : liste des stagiaires (état, heure, mini-signature, observation), actions par
  ligne, bloc formateur, « Clore » ou « Rouvrir », « Imprimer la feuille ». Pendant une
  séance ouverte, la liste se relit toutes les 10 secondes.
- **En-tête** de la feuille propre à la promo (réglage `emargement_entete` : organisme,
  intitulé). Valeurs par défaut : « ECF BOUSCAREN » (celle du livret EPCF) et « Titre
  professionnel Enseignant de la conduite et de la sécurité routière (ECSR) ».
- **Bandeau** (`js/emargement-bandeau.js`) : relu au démarrage, à chaque changement de page,
  au retour au premier plan et toutes les 60 secondes tant que l'app est visible. Pour un
  stagiaire : signer. Pour un formateur : rappel de la séance ouverte (« 6 sur 10 ont
  signé : voir »). Le fondateur, stagiaire et formateur, voit d'abord l'invitation à signer.
- **Zone de signature** : canvas aux évènements de pointeur, `touch-action: none`, page
  bloquée pendant le tracé, tracé trop court refusé (« Signature trop courte »).
- **Feuilles** : demi-journée en A4 portrait (une ligne par stagiaire : nom, signature,
  observations avec heure de signature ; bloc formateur ; pied « signatures recueillies dans
  l'application et horodatées par le serveur ; feuille close le … par … ») ; semaine en A4
  paysage (stagiaires en lignes, dix demi-journées en colonnes, signature et heure dans
  chaque case, ligne des formateurs, colonne du total d'heures de présence). Impression par
  le mécanisme des documents officiels (`doc-officiel.js`), qui accepte désormais le format
  de page.

### 4.4 Démonstration

Migration séparée `20261023_emargement_demo.sql`, gardée par l'existence de la promo 7 :
semaines du 12/10 et du 19/10 closes (dix demi-journées chacune), signatures fictives
générées (une forme par stagiaire, légère variation à chaque séance), quelques absences
(dont Kevin, le « décrocheur »), un retard noté, formateurs fictifs Claire et Marc. Le jour
du rendez-vous, Timy ouvre la demi-journée en direct et fait signer sur son appareil.
Ménage après les rendez-vous : `delete from emargement_seances where promo_id = 7` (les
lignes suivent), à ajouter à la liste de suppression de la promo 7.

## 5. Laissé au constructeur

Disposition fine des écrans, libellés exacts, découpage en modules, détail du banc.

## 6. Vérification

- Règles pures testées en node (`tests/emargement-rules.test.mjs`).
- Base locale (Postgres 18 du poste) : fonctions de contexte de prod recopiées, migration
  appliquée, preuve `tests/sql/emargement-preuve.sql` (refus et acceptations par rôle et par
  promo, inaltérabilité, jour, clôture). La même preuve se rejoue en prod après application
  (elle annule tout et rend son verdict dans l'exception finale).
- Banc (`_harness.html`) : parcours complet formateur et stagiaire avec la fausse base qui
  joue les fonctions serveur en mémoire ; feuilles imprimées ; 375 px.

## 7. Mise en ligne

Fusion dans `main` après mise à jour, entrée Nouveautés « formateurs », poussée (geste
validé par Timy), migration puis preuve en prod, migration de démonstration, vérification de
la page servie.

## 8. Risques

- Signature au doigt sur Android ancien ou iPhone : couvert par les évènements de pointeur,
  à vérifier sur un vrai téléphone par Timy.
- Fuseau : le serveur compte en heure de Paris, l'app en heure de l'appareil ; un appareil
  réglé ailleurs ne peut pas signer hors du jour de la séance.

## 9. Suites hors périmètre

- Durée de conservation des feuilles (preuve exigée par les financeurs et Qualiopi) face à
  l'anonymisation à 12 mois, et mention dans les conditions d'utilisation et le registre.
- Attestation d'assiduité et certificat de réalisation tirés des feuilles.
- L'assistant ne connaît pas encore la page Émargement (`aide.mjs`).
