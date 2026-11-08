# Dossier Qualiopi, lots Q3 à Q5 : questionnaires, registre qualité, conservation à 3 ans

Statut : choix par défaut acceptés par Timy le 08/11/2026 ; spec à relire par lui avant le plan.
Suite de `docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md` (§ 6.7, lots Q3, Q4, Q5). Q1 et Q2 sont en ligne
depuis le 08/11 (deed6c5).

## 1. Intention

Le centre doit prouver devant son auditeur qu'il recueille les appréciations (indicateur 30), qu'il traite les difficultés,
réclamations et aléas (31) et qu'il s'améliore en analysant ses risques (32). Il doit aussi garder ses preuves le temps du cycle
de certification (3 ans). Aujourd'hui l'app ne sait rien de tout cela : la satisfaction est « non mesurée », les difficultés
vivent dans des messages, et l'effacement à 12 mois emporterait des preuves que l'auditeur peut demander plus tard.

Nouvelle règle de Timy (08/11) : l'utilisateur au centre, une app claire et belle, une structure testée au niveau d'un grand
groupe. Ici, cela veut dire : répondre au questionnaire en moins de trois minutes sur un téléphone, un anonymat qu'on
n'a pas besoin de croire sur parole, un registre qu'on remplit en une minute.

## 2. Objectifs, non-objectifs, anti-objectifs

- **Objectifs** : un taux de satisfaction réel dans la fiche résultats et les dossiers, dès la promo de Nîmes (fin le 11/12/2026) ;
  un registre daté et exportable ; une conservation des preuves alignée sur le cycle d'audit, dite dans les conditions
  d'utilisation.
- **Non-objectifs** : avis des financeurs et des entreprises (hors de l'app en v1, l'indicateur 30 le dit « le cas échéant ») ;
  évaluation des enseignements par les apprenants de l'indicateur 33 (apprentissage seulement) ; la direction et le siège
  (lot 5 de la refonte).
- **Anti-objectifs** : une réponse qu'on pourrait relier à une personne, même par recoupement (heure, ordre, petit effectif) ;
  un signalement de violence ou de harcèlement recueilli par l'app sans circuit humain confidentiel (indicateur 12) ; une
  preuve effacée avant la fin du cycle d'audit ; une donnée gardée plus longtemps que ce que disent les conditions.

## 3. Décisions de Timy (08/11, choix par défaut)

1. Questions : texte proposé par Claude, validé par Timy avant la migration (voir § 4.2, correction du rédacteur).
2. Un commentaire libre facultatif, avec la consigne « ne cite personne » ; lu par le fondateur (puis la direction au lot 5)
   à partir de 5 réponses ; jamais dans la version sans noms.
3. Nîmes répond dans l'app si Q3 est en ligne au plus tard le 04/12/2026 ; sinon le formulaire Google sert de secours pour
   cette promo.
4. Le registre est écrit par le fondateur seul (la direction au lot 5), plus la conversion d'un signalement « Signaler un
   problème ». Les formateurs passent par « Signaler un problème ».
5. Une nouvelle version des conditions d'utilisation part avec Q3 et dit en une fois : l'usage des documents devant le
   certificateur et les financeurs, les questionnaires anonymes, la conservation à 3 ans. Une seule nouvelle acceptation.
6. Le dossier professionnel et le livret EPCF sont gardés 3 ans (preuves de l'indicateur 16), puis effacés avec les noms.

## 4. Q3 : questionnaires anonymes

### 4.1 Les trois questionnaires

| Clé | Qui répond | Quand le bandeau s'affiche | Questions |
|---|---|---|---|
| `fin_stagiaire` | stagiaires de la promo, en formation ou partis | de 7 jours avant `date_fin` à 30 jours après | 8 à 10 |
| `six_mois_stagiaire` | mêmes stagiaires | de 6 mois après `date_fin` à 7 mois après | 4 à 5 |
| `fin_formateur` | formateurs de la promo | de 7 jours avant `date_fin` à 30 jours après | 6 à 8 |

Une promo sans `date_fin` n'ouvre aucun questionnaire. Le fondateur peut ouvrir ou fermer un questionnaire à la main pour une
promo (cas de Nîmes, ou d'une fin de formation déplacée).

### 4.2 Le contenu des questions (correction du rédacteur)

Le choix par défaut n° 1 proposait de reprendre le formulaire Google du 15/10. Relecture faite, ce formulaire porte sur
**l'application** (fréquence d'usage, bénéfices, « très déçu si elle disparaissait ») et non sur **la formation** ; il ne prouve
pas l'indicateur 30. Le questionnaire Qualiopi interroge donc la formation : atteinte des objectifs, contenus, formateurs,
organisation et accompagnement, préparation à l'examen et au métier, recommandation, puis le commentaire libre. Une dernière
question facultative sur l'app peut reprendre une question du formulaire du 15/10. Échelle unique de 1 à 4 (pas de point
neutre), avec « sans avis ». Le texte exact est soumis à Timy avant la migration ; il est versionné (une question modifiée
crée une nouvelle version, les réponses gardent la leur).

Le taux de satisfaction publié est la part des réponses 3 ou 4 à la question « globalement », sur les répondants (pas sur
les inscrits) ; il s'affiche avec le nombre de répondants et le nombre d'inscrits.

### 4.3 L'anonymat, par construction

- La réponse est écrite par une fonction `security definer` dans une transaction qui fait deux choses : une ligne dans
  `questionnaire_reponses` (identifiant tiré au hasard, questionnaire, version, promo, réponses, commentaire), et une ligne
  dans `questionnaire_participations` (questionnaire, utilisateur, jour) qui sert à éteindre le bandeau et à refuser une
  deuxième réponse.
- `questionnaire_reponses` n'a ni utilisateur, ni heure, ni numéro séquentiel ; personne ne la lit directement (aucune
  politique de lecture). Les résultats sortent par une fonction qui ne rend que des comptes par question, et rien sous
  5 réponses ; les commentaires sortent par une autre fonction, réservée au fondateur, dans un ordre aléatoire, à partir de
  5 réponses.
- Rien sous 5 réponses vaut aussi pour les formateurs : une équipe de 3 formateurs n'aura donc pas de résultat publié, le
  document le dit (« moins de 5 réponses »).

### 4.4 L'interface

- Bandeau sur l'accueil (ancienne et nouvelle navigation), sur le modèle de l'enquête d'avis du 15/10 (`js/avis-rules.js`) :
  « Répondre » ouvre le questionnaire dans une fenêtre, une question par écran sur téléphone, barre de progression, retour
  possible, envoi en fin. « Plus tard » le remet au lendemain.
- Lien direct `#/questionnaire/<clé>` à envoyer par WhatsApp (en stage, peu de stagiaires ouvrent l'app) ; un message prêt à
  coller est fourni.
- Après l'envoi : « Merci, ta réponse est enregistrée sans ton nom. »
- Côté fondateur, sur la page Qualiopi : état de chaque questionnaire par promo (ouvert, fermé, nombre de réponses), et
  résultats question par question quand il y en a au moins 5.

### 4.5 Branchements

La fiche résultats affiche la satisfaction (fin de formation) avec sa période, ses répondants et sa méthode publique ; le
dossier de la formation remplit sa section « Appréciations » ; le dossier du centre en donne les taux par promo ; l'inventaire
rend « présente » la pièce des appréciations pour les indicateurs 30 et 32.

## 5. Q4 : registre qualité

- Une entrée : type (réclamation, difficulté, aléa, amélioration, risque), date, origine (stagiaire, formateur, entreprise,
  financeur, équipe, autre), promo (facultative), description, réponse et date de réponse, action décidée, état (ouvert, en
  cours, clos). Un risque porte en plus sa mesure de prévention.
- Page « Registre qualité » au fondateur (sous-onglet de la page Qualiopi) : liste filtrée par état et type, ajout en une
  fenêtre courte, export CSV.
- « Ajouter au registre » depuis un signalement de « Signaler un problème » (`signalements_app`) : l'entrée garde le lien, la
  description est préremplie, la personne n'est pas recopiée (origine seulement).
- Le formulaire rappelle que les violences, le harcèlement et les discriminations passent par le référent et la procédure du
  centre, jamais par le registre.
- Dossiers : décompte par type et par état, délai médian de réponse ; la version sans noms ne garde que les nombres.

## 6. Q5 : conservation à 3 ans

| Moment | Ce qui part | Ce qui reste |
|---|---|---|
| 12 mois après `date_fin` (comme aujourd'hui, manuel) | comptes, e-mails, dates de naissance, fiches de suivi, textes libres (observations, commentaires) | noms, résultats, heures, feuilles d'émargement, dossier professionnel, livret EPCF |
| 31 décembre de la 3ᵉ année après `date_fin` | noms et prénoms, tracés des signatures, noms des signataires et observations de l'émargement, dossier professionnel, livret EPCF | heures, présences, résultats, anonymes |

- `anonymiser_promo()` est scindée en deux étapes ; la seconde est aussi manuelle, ouverte à la date ci-dessus.
- L'émargement (en ligne depuis le 23/10, après la migration d'effacement du 05/10) n'est touché aujourd'hui par aucune étape :
  la seconde étape le couvre, la première y efface déjà les observations libres.
- Une fiche anonymisée n'est plus comptée comme abandon : une marque distincte de `actif` dit « fin de parcours effacée », et les
  indicateurs (tableau de bord, Qualiopi) la lisent.
- Conditions d'utilisation (version publiée avec Q3, § 3.5) et registre des traitements (`docs/legal/registre_traitements.md`
  du dépôt ECSR) mis à jour.

## 7. Contraintes

- Migrations prouvées en SQL avant application (méthode de la mémoire « Répétition de migration dans la preuve SQL »),
  appliquées seulement avec l'accord de Timy ; fichier de retour fourni.
- Contraste AA, cibles de 44 px, aucun défilement de côté, aucun tiret cadratin, « Formateur », tutoiement à l'écran, documents
  impersonnels. Parcours prouvés au banc pour chaque rôle (stagiaire, formateur, fondateur), téléphone et ordinateur,
  Chromium et WebKit.
- Une entrée Nouveautés par mise en ligne visible des stagiaires (Q3) ; la conversion du registre est au seul fondateur, sans
  entrée.
- Droits écrits avec une seule fonction (« peut gérer la qualité ») que le lot 4 (rôles) et le lot 5 (direction) étendront.

## 8. Découpage et calendrier

| Lot | Contenu | Migration | Cible |
|---|---|---|---|
| Q3a | questionnaires (tables, fonctions, bandeau, page, lien), conditions d'utilisation | oui | en ligne au plus tard le 04/12/2026 |
| Q3b | branchements Qualiopi (fiche, dossiers, inventaire) | non | avec Q3a ou juste après |
| Q4 | registre qualité | oui | après Q3 |
| Q5 | conservation en deux étapes, marque de fin de parcours | oui | avant le lot 5, au plus tard le 30/11/2027 |

## 9. Laissé au constructeur

Noms des tables et fonctions, mise en page du questionnaire et du registre, colonnes du CSV, phrases d'aide, détail du banc.

## 10. Choix du rédacteur après relecture (08/11)

Un relecteur a lu la spec comme s'il devait la construire. Ses questions, tranchées ici sauf deux posées à Timy (§ 11) :

- **Formateurs d'une promo** : ceux qui figurent au planning de la promo (`prof_ids`), hors jours désactivés. Aucune table à
  remplir à la main.
- **Q5 réécrit l'étape existante.** `_anonymiser_stagiaire` supprime aujourd'hui, dès 12 mois, le dossier professionnel, le
  livret et le nom, et passe `actif` à faux. L'étape 1 est donc réécrite (ces trois éléments restent jusqu'à l'étape 2). Aucune
  anonymisation n'a encore été faite en base (journal vide, 08/11) : aucune preuve n'est perdue.
- **Marques** : `efface_le` (nouvelle colonne) date l'étape 1 ; `anonymise_le` garde son sens actuel (plus aucun nom) et date
  l'étape 2 ; l'abandon reste `actif = false` décidé par l'équipe, et aucune étape d'effacement ne touche `actif`.
- **Participations sans date** : `questionnaire_participations` ne garde que (questionnaire, promo, utilisateur), sans jour ni
  heure, pour qu'aucune réponse ne se recoupe par la date.
- **Seuil de 5** : par promo et par questionnaire, question par question (une version nouvelle ne dilue pas les questions
  inchangées). Le dossier du centre donne les taux promo par promo, jamais de cumul (règle du § 6.8 de la spec Q1-Q2). Sous le
  seuil, le document écrit « moins de 5 réponses ».
- **Q3b** : la satisfaction remplace la valeur « non mesurée » déjà prévue dans `ficheResultats` ; même chemin pour la section
  « Appréciations » du dossier et la pièce de l'inventaire.
- **Conditions d'utilisation** : texte rédigé par Claude, soumis à Timy avec les questions du § 4.2 ; l'acceptation passe par la
  fenêtre existante (`exigerAcceptation`), un clic à la connexion suivante ; elle fait partie de Q3a.
- **Droit** : une fonction SQL `peut_gerer_qualite()`, qui vaut `is_founder()` aujourd'hui ; toutes les politiques de Q3 à Q5 la
  lisent, le lot 4 l'élargira en un seul endroit.
- **Ouverture manuelle** : elle prime sur les dates, dans les deux sens ; les inscrits comptés sont ceux de la promo à la date
  de la réponse.
- **Registre et données personnelles** : une entrée close garde sa description et sa réponse 3 ans après sa clôture, puis
  elles sont vidées (le type, les dates et l'état restent) ; dit dans les conditions.

## 11. Questions posées à Timy (08/11)

1. **Questionnaire des formateurs** : une promo compte 3 formateurs (Nîmes et Montpellier, planning du 08/11). Avec le seuil de
   5, leurs résultats ne s'afficheraient jamais. Proposition par défaut : questionnaire formateurs par centre et par année
   civile (toutes les promos du lieu), anonyme, seuil de 3, et la mention « moins de 3 réponses » sinon.
2. **Effacement sur demande** : une personne qui demande l'effacement de ses données (droit prévu par les conditions)
   l'obtient tout de suite, même si cela retire des preuves de son parcours ; le dossier Qualiopi indique alors « fiche
   effacée à la demande de la personne ». Proposition par défaut : oui.
