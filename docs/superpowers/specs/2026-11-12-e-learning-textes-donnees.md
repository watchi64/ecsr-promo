# E-learning, lot 1 : textes des données personnelles (brouillons)

Date : 12/11/2026. Statut : **brouillons, à valider par Timy**. Rien n'est en ligne. Ces textes accompagnent le lot 1 de
la spec `2026-11-12-e-learning-design.md` (lecture des cours et temps actif), qui ajoute une collecte de données
personnelles. Ils s'appliquent en deux endroits :

- les **conditions d'utilisation** affichées dans l'app (`js/legal-data.js`), avec une nouvelle version que chaque
  personne accepte de nouveau ;
- le **registre des traitements**, document interne (`docs/legal/registre_traitements.md` du dépôt principal).

## Un point à trancher par Timy avant de publier

**Combien de temps garder ces traces ?** Deux durées existent déjà dans les conditions : « toute la formation, puis
douze mois » (fiches de suivi) et « toute la formation, puis trois ans » (preuves de la formation : heures, présences,
résultats). **Recommandation suivie dans les brouillons : douze mois.** Raisons : c'est la durée la plus courte qui
serve le but du lot 1 (suivre et aider pendant la formation) ; la preuve durable est le relevé de formation en PDF
(lot 4), que le centre archive lui-même. Si le lot 6 fait un jour compter des heures à distance dans l'assiduité, ces
heures deviendront des « preuves de la formation » et passeront à trois ans, avec une nouvelle version des conditions.

## 1. Conditions d'utilisation : ce qui change

Nouvelle version : la date du jour de la mise en ligne (`VERSION_CONDITIONS`). C'est une modification substantielle
(nouvelle donnée, nouvel usage) : toutes les personnes l'acceptent de nouveau, comme le prévoit la section 16.

### Section 3, « Les données enregistrées » : une ligne ajoutée au tableau, après « Suivi »

| Catégorie | Contenu |
|-----------|---------|
| Travail en autonomie | Quand votre centre a activé ce suivi pour votre promo : les cours que vous avez ouverts et lus, avec leur date, l'endroit où vous vous êtes arrêté, et le temps que vous passez à lire les cours et à vous entraîner aux QCM, compté par jour. Ce temps n'est compté que lorsque la page du cours ou du QCM est affichée et que vous êtes actif ; l'application ne mesure rien sur ses autres pages |

Et la phrase qui suit le tableau devient :

> L'application ne collecte ni géolocalisation, ni contacts du téléphone, ni données de navigation à des fins
> publicitaires. Elle n'enregistre ni vos gestes un par un, ni ce que vous faites en dehors d'elle.

### Section 4, « Qui voit quoi » : une ligne ajoutée au tableau, après « Livret, dossier professionnel, EPCF »

| Donnée | Vous | Autres stagiaires | Formateurs | Direction de votre centre | Siège d'ECF |
|--------|------|-------------------|------------|---------------------------|--------------|
| Travail en autonomie (cours lus, temps passé) | Oui, dans Mon suivi | Non | Oui | Oui | Non |

Et un paragraphe ajouté après « Absences » :

> **Travail en autonomie.** Ce suivi n'existe que si votre centre l'a activé pour votre promo. Vous voyez dans Mon
> suivi exactement ce que vos formateurs et la direction de votre centre voient de vous : rien de plus ne leur est
> montré. Les autres stagiaires n'y ont pas accès, et l'application n'établit aucun classement. Ce suivi ne déclenche
> aucune décision automatique : il sert à vous repérer dans votre travail et à permettre à vos formateurs de vous
> accompagner.

### Section 5, « À quoi servent les données, et sur quelle base » : une ligne ajoutée au tableau

| Usage | Base légale |
|-------|-------------|
| Suivre le travail en autonomie (cours lus, temps passé sur les cours et les QCM d'entraînement), pour vous aider à vous repérer et permettre à vos formateurs de vous accompagner | Intérêt légitime de l'organisme de formation à suivre la progression de ses stagiaires et à vérifier que les ressources mises à disposition sont utilisées (indicateur 19 du référentiel Qualiopi) ; vous pouvez vous y opposer (section 12) |

### Section 10, « Combien de temps » : la première ligne du tableau complétée

| Données | Durée |
|---------|-------|
| Compte, adresse e-mail, date de naissance, fiches de suivi, **travail en autonomie (cours lus, temps passé)**, textes libres (observations, commentaires) | Toute la formation, puis douze mois |

### Section 13, « Cookies et stockage dans le navigateur » : rien à changer

Le repère « cours déjà ouvert sur cet appareil » reste dans le navigateur quand le suivi n'est pas activé.

## 2. Registre des traitements : section 1 complétée

Dernière mise à jour : la date de la mise en ligne, avec la mention « travail en autonomie (lecture des cours, temps
actif), section 1 ».

Dans le tableau de la section 1, « Suivi de la formation dans l'application », les rubriques deviennent :

| Rubrique | Ajout |
|----------|-------|
| Finalité | … ; suivi du travail en autonomie, activé promo par promo par l'éditeur à la demande du centre : cours ouverts et lus, temps actif sur les cours et les QCM d'entraînement |
| Base légale | … ; travail en autonomie : intérêt légitime de l'organisme de formation (suivi de la progression, vérification de l'appropriation des ressources, indicateur 19 de Qualiopi), avec droit d'opposition |
| Données | … ; pour chaque stagiaire d'une promo activée : cours ouvert (première et dernière date), cours lu (date), dernière section vue, secondes de temps actif par jour et par ressource (cours ou QCM) |
| Destinataires | … ; travail en autonomie : le stagiaire, les formateurs de sa promo, la direction de son centre ; jamais les autres stagiaires ; le siège n'y accède pas |
| Durée | … ; travail en autonomie : formation + 12 mois, puis suppression (avec la fiche du stagiaire) |
| Sécurité | … ; travail en autonomie : écriture par deux fonctions de la base seulement, qui refusent tout compte non stagiaire, toute promo non activée et tout compte qui n'a pas accepté la version des conditions décrivant cette collecte ; durées bornées (60 s par envoi, 8 h par jour) ; preuve rejouable `tests/sql/autonomie-preuve.sql` |

Ligne à ajouter dans « Actions de mise en conformité » :

- Travail en autonomie : avant d'activer une vraie promo, vérifier que les stagiaires ont été informés par leur centre
  (information orale ou écrite en plus des conditions), et que l'analyse d'impact (AIPD) déjà prévue « avant la vente »
  couvre ce suivi (c'est un suivi de l'activité de personnes en formation).

## 3. Ce que ces textes engagent dans le produit

Chaque phrase ci-dessus correspond à une règle du plan du lot 1
(`docs/superpowers/plans/2026-11-12-e-learning-lot-1-lecture-temps-actif.md`) : interrupteur par promo, aucune écriture
avant l'acceptation de la nouvelle version, même page pour le stagiaire et pour l'équipe, aucune lecture par les autres
stagiaires ni par le siège, aucune mesure hors du lecteur de cours et du QCM en entraînement, suppression avec la fiche
du stagiaire. Si une règle du plan change, le texte change avec elle.

**Droit d'opposition** : les conditions (section 12) le prévoient déjà de façon générale. Le lot 1 ne construit pas de
bouton « ne pas me suivre », mais la base sait arrêter le suivi d'une personne : l'éditeur inscrit le stagiaire dans une
liste d'oppositions (plan du lot 1, tâche 2), ses traces sont effacées et plus rien n'est écrit pour lui.
*Choix de Claude, à relire par Timy* : si les demandes se répètent, un réglage dans Mes préférences sera la bonne suite.
