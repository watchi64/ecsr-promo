# Espace contact : textes des données personnelles (brouillons)

Date : 16/11/2026. Statut : **brouillons, à valider par Timy**. Rien n'est en ligne et `js/legal-data.js` n'est pas
touché : ce document est transmis à la coordination, qui regroupera ces textes avec l'étape 4 des titres.

> **Version regroupée avec l'étape 4 des titres (une seule acceptation) ; la mise en ligne de l'espace contact ne
> précède pas la publication de cette version** (décision du 14/11).

Forme reprise de `docs/superpowers/specs/2026-11-12-e-learning-textes-donnees.md`. Le texte de référence de
`CONDITIONS_MD` est celui de `origin/main` (relu le 16/11, version `2026-11-14`) ; la copie de la branche
`espace-contact` est identique octet pour octet aux fins de ligne près. Chaque « Ancre » ci-dessous est une ligne voisine
citée mot à mot : elle existe telle quelle dans `origin/main` (contrôle fait par script, voir le rapport de la tâche).

Ce que ces textes décrivent est ce que fait le code de la branche (migrations `20261115_contact_1` à `_3`,
`20261116_contact_4_correctifs.sql`, fonction `supabase/functions/contact-envois/`). La table de correspondance en fin de
document donne, pour chaque règle, le fichier et la fonction qui la rendent vraie.

## Points à trancher par Timy avant de publier

1. **Le motif d'une absence annoncée : quand disparaît-il ?** Le code fait deux choses différentes.
   - *Durée normale* : douze mois après la fin de la formation (étape 1 de la conservation), la demande d'absence perd son
     texte libre (« mot »), ses réponses, ses envois et ses liens, et son auteur devient « Stagiaire anonyme » ; **le
     motif (santé, transport, démarche, famille, autre) reste, rattaché à la fiche encore nommée**, jusqu'à l'étape 2
     (fin de la troisième année), où la fiche est rendue anonyme et où le motif est effacé. Les jours, le moment et l'état
     du justificatif restent sans nom, comme une présence.
   - *Effacement sur demande* : `effacer_sur_demande` joue les deux étapes d'un coup. Le motif est donc effacé **tout de
     suite**, avec le mot, les demandes hors absence et la signature ; seuls restent les jours, le moment et l'état du
     justificatif, sans nom.
   - Le brief disait « trois ans, puis rendue anonyme » : c'est exact pour le cas normal, pas pour l'effacement sur
     demande. Les textes ci-dessous écrivent les deux cas. **Question pour Timy** : garde-t-on un motif nominatif trois ans
     (preuve, comme l'émargement) ou veut-on l'effacer dès l'étape 1 avec le mot libre (minimisation) ? Changer cela
     demande une retouche de `_contact_effacer_stagiaire` (migration), pas du texte seulement.
2. **Le motif « santé » est-il une donnée de santé au sens de l'article 9 du RGPD ?** La liste est fermée et sans détail,
   mais le mot « santé » dit quelque chose de la personne. À confirmer avec le conseil de Timy ; si oui, le registre doit
   citer une base de l'article 9 (consentement explicite à l'envoi, ou nécessité en droit du travail et de la formation)
   et l'AIPD déjà prévue doit couvrir ce point. Les textes ci-dessous restent prudents (liste fermée, jamais dans un
   e-mail, jamais en observation) sans trancher.
3. **Lecture directe des tables par l'éditeur.** Comme pour les questionnaires, l'éditeur administre la base et pourrait
   techniquement lire les demandes et les motifs. Les textes n'ajoutent pas d'engagement de non-lecture ; à décider si
   l'on veut l'écrire (même formule que « Limite de cet anonymat »).

## Écarts entre le brief et le code (corrigés dans les textes)

| Brief | Code de la branche | Texte écrit |
|-------|--------------------|-------------|
| Absence « trois ans, puis rendue anonyme : le motif est effacé » | Vrai en durée normale ; en effacement sur demande le motif part tout de suite (point 1) | Les deux cas, § 10 |
| Formateurs : « avec le motif pour les destinataires » | Le motif est lu par les formateurs principaux **et** par les formateurs du jour prévenus en annexe, et par la direction du centre (`_contact_role`, `demande_detail`) | Tableau du § 4 et paragraphe |
| E-mail : « type de demande, nom du stagiaire, jour et moment » | Vrai ; le nom du destinataire figure aussi dans la formule d'appel ; l'avis du délégué porte les jours mais ni le nom de l'auteur ni le motif ; les e-mails de l'équipe portent des boutons d'action à jeton (valables 14 jours, sans connexion) | § 8 et paragraphe du § 4 |
| « quatorze jours pour un lien, trois mois pour le journal » | Le lien est valable 14 jours ; sa trace hachée est supprimée trois mois **après son expiration** ; le journal des envois trois mois après sa création ; les deux purges se déclenchent à l'écriture d'une nouvelle demande | § 10 |
| « Envoyer les e-mails du compte » gagne « et les alertes des demandes » (base « nécessaire au fonctionnement du compte ») | Les alertes des demandes relèvent de l'intérêt légitime (ligne neuve), pas de la nécessité du compte | § 5, base précisée |
| Fiches de l'équipe : « sans compte » seulement | Une fiche d'office est aussi créée pour chaque compte de l'équipe (formateur, direction) ; ses coordonnées sont masquées tant que la personne n'a pas enregistré sa fiche | Phrase supplémentaire au § 7 (proposée, hors brief) |
| « Direction : Oui, toutes celles du centre » | Vrai, y compris les échanges entre membres de l'équipe (rôle `direction` de `_contact_role`) | Tableau du § 4 |

## 1. Conditions d'utilisation : ce qui change

Nouvelle version : celle de l'étape 4 des titres (une seule acceptation). C'est une modification substantielle (nouvelles
données : téléphone, financement, demandes, absences annoncées avec motif ; nouvel usage : routage et alertes par e-mail ;
nouvel affichage : annuaire de l'équipe), comme le prévoit la section 16.

### L'essentiel (ligne 2 et ligne 7)

Ancre, ligne 2 (remplacée) :

```text
> Elle enregistre ce qui sert à la formation : profil, notes, QCM, passages, absences, livret, dossier professionnel, et vos réponses aux questionnaires de satisfaction, enregistrées sans votre nom.
```

Devient :

```text
> Elle enregistre ce qui sert à la formation : profil (dont téléphone facultatif et financement), notes, QCM, passages, absences, demandes au centre et absences annoncées, livret, dossier professionnel, et vos réponses aux questionnaires de satisfaction, enregistrées sans votre nom.
```

Ligne 5 (prestataires) : inchangée. Ancre, ligne 7 (remplacée) :

```text
> Douze mois après la formation, les comptes et les textes libres des stagiaires disparaissent ; les preuves de la formation (résultats, heures, présences) sont gardées trois ans, puis rendues anonymes.
```

Devient :

```text
> Douze mois après la formation, les comptes et les textes libres des stagiaires (observations, commentaires, demandes et leurs messages) disparaissent ; les preuves de la formation (résultats, heures, présences) sont gardées trois ans, puis rendues anonymes.
```

### Section 3, « Les données enregistrées »

Ancre, ligne « Profil » (remplacée) :

```text
| Profil | Nom, prénom, adresse e-mail, rôle, promo, date de naissance (reportée sur le livret officiel) |
```

Devient :

```text
| Profil | Nom, prénom, adresse e-mail, rôle, promo, date de naissance (reportée sur le livret officiel), téléphone (facultatif), financement de la formation (renseigné par le centre), délégué ou suppléant de la promo |
```

Ancre : ligne ajoutée juste après

```text
| Suivi | Passages en voiture, absences, placements au planning, souhaits de séances |
```

```text
| Demandes et messages | Les demandes que vous adressez au centre ou qu'il vous adresse (type, sujet, messages, état : envoyée, prise en compte, annulée ; chaque destinataire est noté « lue » quand il ouvre la demande dans l'application), et pour une absence annoncée : les jours, le moment, le motif choisi dans une liste (santé, transport, démarche, famille, autre), un mot facultatif de 200 caractères au plus et l'état du justificatif (à remettre, reçu). Aucun document ni certificat ne passe par l'application |
```

La phrase qui suit le tableau (« L'application ne collecte ni géolocalisation… ») ne change pas.

### Section 4, « Qui voit quoi »

Ancre : lignes ajoutées juste après

```text
| Souhaits de séances | Oui | Non | Oui | Oui | Non |
```

```text
| Téléphone, e-mail et financement d'un stagiaire | Oui | Non | Oui | Oui | Non |
```

Ancre : lignes ajoutées juste après

```text
| Travail en autonomie (cours lus, temps passé) | Oui, dans Mon suivi | Non | Oui | Oui | Non |
```

```text
| Demandes et messages | Oui, les vôtres | Non | Oui, celles qui leur sont adressées | Oui, toutes celles du centre | Non |
| Absence annoncée : jours et moment | Oui | Oui, « absent » au planning ; votre délégué voit en plus votre nom et les jours | Oui | Oui | Non |
| Absence annoncée : motif et mot facultatif | Oui | Non, délégué compris | Oui, pour les formateurs destinataires ou prévenus | Oui | Non |
```

Ancre : paragraphe ajouté juste après (dernière phrase citée)

```text
Ce suivi ne déclenche aucune décision automatique : il sert à vous repérer dans votre travail et à permettre à vos formateurs de vous accompagner.
```

```text
**Demandes et absences annoncées.** Une demande part vers les personnes que votre centre a désignées pour ce type de demande, selon votre financement quand le centre l'a prévu. Quand le centre n'a rien réglé pour ce type de demande, vous choisissez vous-même qui la reçoit, parmi vos formateurs et la direction de votre centre ; pour une absence ou un retard, vos formateurs du jour sont déjà cochés. Une demande est lue par ses destinataires, et la direction de votre centre peut lire toutes les demandes du centre. Une absence que vous annoncez prévient aussi vos formateurs du jour et le délégué de la promo ; vous pouvez décocher ces envois, l'absence apparaît alors quand même au planning. Le délégué ne reçoit que les jours et le moment : ni le motif, ni votre mot, et il ne peut pas ouvrir la demande. Le mot facultatif est un texte libre : n'y écrivez aucune information de santé. La mention « lue » ne se pose que lorsqu'un destinataire ouvre la demande dans l'application : les e-mails ne contiennent ni image ni lien de suivi, et ouvrir un e-mail ne marque rien. Chaque compte peut couper ses alertes par e-mail dans ses préférences ; les fiches sans compte les reçoivent toujours. Les e-mails adressés à l'équipe portent des boutons (prise en compte, réponse toute faite, justificatif reçu) qui fonctionnent sans connexion pendant quatorze jours : ils ne doivent pas être transférés.
```

Ancre, paragraphe « Absences » (remplacé) :

```text
**Absences.** L'application ne prévoit aucun champ pour le motif d'une absence : un passage est marqué « Absence », une feuille d'émargement « absent ». Les formateurs s'engagent à ne pas en écrire dans une observation libre (section 15). L'observation d'un passage est lue comme le passage lui-même (vos camarades de promo, vos formateurs, la direction de votre centre) ; celle d'une feuille d'émargement, par vous, vos formateurs et la direction de votre centre.
```

Devient (réécriture mot à mot) :

```text
**Absences.** Pour un passage et pour l'émargement, l'application ne prévoit aucun champ pour le motif d'une absence : un passage est marqué « Absence », une feuille d'émargement « absent ». Le seul endroit où un motif existe est l'absence que vous annoncez vous-même (paragraphe « Demandes et absences annoncées »), où vous le choisissez dans une liste, sans détail. Une absence annoncée pré-remplit la feuille d'émargement par « absent » et l'observation « Absence prévenue » ou « Absence justifiée », jamais par le motif. Les formateurs s'engagent à ne pas écrire de motif dans une observation libre (section 15). L'observation d'un passage est lue comme le passage lui-même (vos camarades de promo, vos formateurs, la direction de votre centre) ; celle d'une feuille d'émargement, par vous, vos formateurs et la direction de votre centre.
```

### Section 5, « À quoi servent les données »

Ancre, ligne « e-mails du compte » (remplacée) :

```text
| Envoyer les e-mails du compte (invitation, mot de passe oublié) | Nécessaire au fonctionnement du compte |
```

Devient :

```text
| Envoyer les e-mails du compte (invitation, mot de passe oublié) et les alertes des demandes | Nécessaire au fonctionnement du compte pour l'invitation et le mot de passe oublié ; intérêt légitime (ligne suivante) pour les alertes des demandes, que vous pouvez couper |
```

Ancre : ligne ajoutée juste après

```text
| Suivre le travail en autonomie (cours lus, temps passé sur les cours et les QCM d'entraînement), pour vous aider à vous repérer et permettre à vos formateurs de vous accompagner | Intérêt légitime de l'organisme de formation à suivre la progression de ses stagiaires et à vérifier que les ressources mises à disposition sont utilisées (indicateur 19 du référentiel Qualiopi) ; vous pouvez vous y opposer (section 12) |
```

```text
| Organiser la formation et joindre les personnes : annuaire de l'équipe, demandes, absences annoncées, alertes par e-mail | Intérêt légitime de l'organisme de formation à organiser la formation et à joindre les personnes |
```

### Section 7, « Les personnes sans compte »

Ancre, titre (remplacé) :

```text
## 7. Les personnes sans compte : élèves bénévoles et auto-écoles partenaires
```

Devient :

```text
## 7. Les personnes sans compte : élèves bénévoles, auto-écoles partenaires, personnes de l'équipe sans compte
```

Ancre : paragraphe ajouté juste après la dernière puce de la section

```text
- La personne est informée de cet enregistrement lors de sa première venue, et peut exercer les mêmes droits que les stagiaires (section 12).
```

```text
**Personnes de l'équipe sans compte.** L'annuaire du centre peut contenir des fiches de personnes de l'équipe qui n'ont pas de compte (secrétariat, accueil) : nom, titre, e-mail et téléphone professionnels, pour quoi et quand les joindre. Ces fiches sont visibles des stagiaires et de l'équipe du centre, et des centres avec lesquels elles sont partagées. Une fiche disparaît de l'annuaire à la date de départ de la personne et est supprimée ensuite ; elle l'est aussi sur simple demande. Les personnes de l'équipe qui ont un compte ont également une fiche dans l'annuaire ; leurs coordonnées n'y sont montrées qu'une fois qu'elles ont enregistré leur fiche.
```

La dernière phrase (fiches des comptes de l'équipe) n'est pas dans le brief : elle décrit ce que fait l'annuaire
(`annuaire_centre`). Timy peut la retirer si ce point est déjà couvert ailleurs.

### Section 8, « Où vivent les données : les prestataires »

Ancre, ligne Supabase (remplacée) :

```text
| Supabase | Base de données et comptes | L'ensemble des données de l'application | Union européenne (région de Paris) |
```

Devient :

```text
| Supabase | Base de données, comptes et fonction d'envoi des alertes | L'ensemble des données de l'application | Union européenne (région de Paris) |
```

Ancre, ligne Resend (remplacée) :

```text
| Resend | Envoi des e-mails du compte | L'adresse e-mail du destinataire et le contenu de l'e-mail | États-Unis |
```

Devient :

```text
| Resend | Envoi des e-mails du compte et des alertes des demandes | L'adresse e-mail et le nom du destinataire, et le contenu de l'e-mail : type de demande, nom de la personne qui écrit, jours et moment d'une absence, boutons d'action ; jamais le motif ni un message | États-Unis |
```

### Section 10, « Combien de temps »

Ancre : lignes ajoutées juste après

```text
| Signalements de problème | Douze mois au plus, et jamais au-delà de la fermeture du compte |
```

```text
| Demandes et messages | Toute la formation, puis douze mois ; entre membres de l'équipe : douze mois après le dernier échange |
| Absence annoncée (jours, moment, justificatif) | Comme les preuves de la formation : trois ans, puis sans nom. Le mot facultatif, les réponses et les envois sont effacés douze mois après la fin de la formation |
| Motif d'une absence annoncée | Trois ans comme les preuves de la formation, puis effacé quand la fiche est rendue anonyme ; effacé tout de suite en cas d'effacement sur demande (section 12) |
| Liens des e-mails et journal des envois | Un lien cesse de fonctionner au bout de quatorze jours et sa trace est supprimée trois mois plus tard ; le journal des envois (qui a été prévenu, de quoi, sans texte ni motif) est supprimé trois mois après l'envoi |
| Fiches de l'équipe sans compte | Jusqu'au départ de la personne, ou sur demande |
| Téléphone et financement d'un stagiaire | Comme le compte |
```

*Point ouvert (voir en tête) : la ligne « Motif d'une absence annoncée » décrit le code actuel. Si Timy choisit d'effacer le
motif avec le mot libre, elle devient « Douze mois après la fin de la formation » et la migration change.*

### Section 12, « Vos droits » : rien à changer

Le paragraphe « Effacement sur demande » reste vrai : l'effacement sur demande efface déjà les demandes hors absence, le
mot, le motif et les envois.

### Section 15, « Bon usage »

Ancre (remplacée) :

```text
- pour les formateurs : n'écrire dans les champs de commentaire aucune information de santé ni de vie privée (une absence se note « absent », sans motif médical) ;
```

Devient :

```text
- pour les formateurs : n'écrire dans les champs de commentaire ni dans les réponses aux demandes aucune information de santé ni de vie privée (une absence se note « absent », sans motif médical) ;
```

### Sections 1, 2, 6, 9, 11, 13, 14, 16 : rien à changer

Section 6 reste vraie : rien n'est vendu, aucun transfert nominatif hors d'ECF ; Resend ne reçoit que ce que décrit
la section 8. Section 13 : aucun cookie ni stockage supplémentaire.

## 2. Registre des traitements : section « Demandes et absences » (nouvelle)

Dernière mise à jour : la date de la mise en ligne, avec la mention « espace contact (annuaire, demandes, absences
annoncées, alertes par e-mail) ».

| Rubrique | Contenu |
|----------|---------|
| Traitement | Demandes au centre, absences annoncées, annuaire de l'équipe, alertes par e-mail |
| Finalité | Joindre les bonnes personnes du centre sans passer par une messagerie personnelle ; prévenir d'une absence ou d'un retard ; tenir à jour l'annuaire de l'équipe ; alerter par e-mail qu'une demande attend |
| Base légale | Intérêt légitime de l'organisme de formation à organiser la formation et à joindre les personnes ; alertes : même base, avec possibilité de les couper ; **motif d'absence : à confirmer (article 9 du RGPD, voir point 2 en tête)** |
| Personnes concernées | Stagiaires ; personnes de l'équipe (formateurs, direction) avec ou sans compte |
| Données | Stagiaire : téléphone (facultatif), financement (renseigné par le centre), délégué ou suppléant ; demande : type, sujet (80 caractères au plus), texte, messages, état, date, destinataires et leur « lue » ; absence : jours, moment (journée, matin, après-midi, heures), motif d'une liste fermée de cinq valeurs, mot facultatif de 200 caractères au plus, état du justificatif (aucun document n'est déposé) ; équipe : nom, titre, e-mail et téléphone professionnels, pour quoi et quand joindre, relais et congé ; envoi : événement, destinataire, état, raison d'échec abrégée |
| Destinataires | Stagiaire : lui-même ; formateurs et direction du centre selon le routage (voir le tableau du § 4 des conditions) ; délégué : jours et moment seulement ; autres stagiaires : « absent » au planning ; siège d'ECF : rien. Prestataires : Supabase (base et fonction d'envoi, Union européenne), Resend (États-Unis : adresse et nom du destinataire, type, nom de l'auteur, jours et moment, boutons, jamais motif ni message) |
| Durée | Demandes d'un stagiaire : formation + 12 mois (étape 1 de la conservation) ; entre membres de l'équipe : 12 mois après le dernier échange ; absence : jours, moment, justificatif gardés trois ans puis sans nom ; motif : effacé à l'étape 2 (trois ans) ou tout de suite sur demande d'effacement (**point ouvert**) ; mot facultatif, réponses, envois et liens : formation + 12 mois ; liens d'e-mail : valables 14 jours, traces supprimées 3 mois après expiration ; journal des envois : 3 mois ; fiches sans compte : au départ ou sur demande ; téléphone et financement : comme le compte. Les purges d'envois, de liens et d'échanges d'équipe se déclenchent à l'écriture d'une nouvelle demande |
| Sécurité | Tables sans aucun droit d'accès direct pour les rôles de l'API (lecture et écriture par fonctions de la base seulement) ; rôle de lecture jugé par la base (`_contact_role`, `_contact_peut`) ; liens d'e-mail : jeton aléatoire, **seul son haché sha256 est en base**, usage unique, 14 jours, résultats de lecture sans écriture ; fonctions serveur `_contact_srv_*` réservées à la fonction d'envoi ; clé Resend en secret serveur, jamais dans le code ; e-mails sans motif, sans sujet et sans texte, sans pixel espion ; aucun envoi vers une adresse fictive ; preuves rejouables `tests/sql/contact-annuaire-preuve.sql`, `contact-demandes-preuve.sql`, `contact-absences-preuve.sql` |
| Limites posées (minimisation, sécurité) | Dix demandes par jour et par stagiaire ; trente nouvelles conversations par jour et par fiche de l'équipe (migration 4) ; absence de 31 jours au plus, annoncée au plus 120 jours à l'avance, jamais dans le passé (migration 4) ; un justificatif n'est qu'un état, jamais un document |

Actions de mise en conformité à ajouter :

- **Information des équipes avant la fusion** : l'annuaire crée d'office une fiche pour chaque compte de l'équipe
  (formateur, direction) ; les coordonnées n'en sont montrées qu'après l'enregistrement de la fiche par la personne. Informer
  les équipes avant la mise en ligne.
- **Clé Resend « envoi seul »** : créer la clé avec le droit d'envoi uniquement (aucun droit de lecture des e-mails ni de
  gestion du domaine), la poser comme secret de la fonction `contact-envois`, ne jamais l'écrire ailleurs.
- **Motif d'absence** : trancher le point 2 en tête (article 9) et inscrire le résultat dans l'AIPD déjà prévue.
- **Point ouvert chez Timy** : durée du motif (point 1 en tête).

## 3. Table de correspondance : phrase, règle, code

| Phrase des textes | Ce qui la rend vraie |
|-------------------|----------------------|
| Téléphone facultatif, financement renseigné par le centre | `regler_coordonnees_stagiaire` (téléphone : la personne ou qui gère ; financement : qui gère seulement), colonnes de `stagiaires_prive` (migration 1, § 8) |
| Lisible par le stagiaire, les formateurs, la direction ; pas par les autres stagiaires | `coordonnees_promo`, règle de lecture de `stagiaires_prive` (migration 1, § 8) |
| Délégué ou suppléant de la promo | `stagiaires.delegue`, au plus un titulaire et un suppléant par promo (migration 1, § 9) |
| Demande : type, sujet, messages, états envoyée, prise en compte, annulée | tables `demandes` (`demandes_etat`), `demande_messages` (migration 2, § 1) ; `ecrire_au_centre`, `ecrire_a`, `ecrire_au_stagiaire` |
| « Lue » par destinataire, dans l'application seulement | `marquer_lue` ; `_contact_srv_lien` « n'écrit rien » ; aucune image dans `construireCourriel` (`courriels.mjs`) |
| Routage par règles du centre, sinon choix du stagiaire, formateurs du jour pré-cochés | `_contact_destinataires`, `_contact_possibles`, `apercu_envoi`, `_contact_formateurs_du_jour` (migration 2, § 3) |
| Un choisi hors de la liste est refusé ; liste vide : refus | `ecrire_au_centre`, `prevenir_absence` (décision Q8 du 14/11) |
| La direction lit toutes les demandes du centre ; les formateurs celles qui leur sont adressées ou dont ils sont prévenus | `_contact_role` (auteur, principal, annexe_formateur, delegue, direction), `liste_demandes`, `demande_detail` |
| Le délégué ne voit que nom, jours et moment, ne peut pas ouvrir la demande | `liste_demandes` (rôle delegue : colonnes nulles), `demande_detail` (refus `42501`), `_contact_annexes` (migration 3) |
| Les autres stagiaires voient « absent » au planning | `absences_annoncees_semaine` (jamais le motif), `marqueAbsence` (`js/contact-absences-rules.js`) |
| Absence : jours, moment, motif d'une liste, mot de 200 caractères au plus, justificatif à remettre ou reçu | `prevenir_absence`, `absences_annoncees` (contraintes `absences_annoncees_motif`, `_justificatif`), `regler_justificatif` (migration 3) |
| Aucun document ne passe par l'application | le justificatif n'est qu'une colonne d'état (`absences_annoncees.justificatif`) ; aucun stockage de fichier dans les migrations de l'espace contact |
| Feuille d'émargement pré-remplie : « Absence prévenue » ou « Absence justifiée », jamais le motif | `_contact_premarquer`, `_contact_observation_nous` (migration 3, § 6) |
| E-mail : type, nom de l'auteur, jours et moment, jamais le motif ni un message | `phrases` et `construireCourriel` (`courriels.mjs`), `_contact_srv_prendre` (« jamais le sujet, le texte ni le motif ») |
| E-mail du délégué : jours, sans nom ni motif | `phrases` (cas `avis_absence`, branche stagiaire), `_contact_srv_prendre` |
| Expéditeur « Promo ECSR », envoi par Resend, aucun envoi vers une adresse fictive | `envoyerParResend`, `adresseFictive`, `EXPEDITEUR_DEFAUT` (`index.ts`) |
| Boutons de l'e-mail à l'équipe : sans connexion, 14 jours, usage unique, ne pas transférer | `_contact_srv_jetons` (`interval '14 days'`, haché sha256), `_contact_srv_agir` (« une seule fois »), `jetons.mjs` |
| Alertes coupables par compte ; les fiches sans compte les reçoivent toujours | `user_profiles.alertes_email`, `regler_mes_alertes`, `_contact_envoyer` (migration 2, § 5) |
| Demandes d'un stagiaire effacées douze mois après la formation | `_contact_effacer_stagiaire` (déclencheur `stagiaires_contact_effacer`, migration 2, § 10), `_effacer_etape1` (`20261110_conservation.sql`) |
| Absence : mot, réponses, envois, liens effacés à l'étape 1, auteur « Stagiaire anonyme », lignes gardées | `_contact_effacer_stagiaire` (migration 2, § 10) |
| Motif effacé à l'étape 2, ou tout de suite sur demande | `_contact_anonymiser_stagiaire` (déclencheur `stagiaires_contact_anonymiser`, migration 3, § 7), `_effacer_etape2`, `effacer_sur_demande` |
| Échanges entre membres de l'équipe : douze mois après le dernier échange | `_contact_purger` (demandes sans stagiaire, `interval '12 months'`) |
| Journal des envois : trois mois ; trace des liens : trois mois après expiration | `_contact_purger` (`contact_envois`, `contact_jetons`) ; purge à l'écriture, appelée par `_contact_creer` |
| Téléphone et financement : comme le compte | supprimés à l'étape 1 (commentaire de la migration 1, § 8 ; `_effacer_etape1`) |
| Dix demandes par jour pour un stagiaire | `_contact_quota` (migration 2) |
| Trente nouveaux messages par jour pour l'équipe | `_contact_quota_equipe` (migration 4, § 4) |
| Absence : 31 jours au plus, 120 jours à l'avance au plus | `absences_annoncees_duree`, `prevenir_absence` (migration 4, § 5 : `_contact_jour() + 120`) |
| Fiches de l'équipe sans compte : visibles des stagiaires et de l'équipe du centre ; départ puis suppression | `annuaire_centre`, `contacts_ecriture`, `lieux_partages`, `depart_le` (migration 1, § 1, § 4, § 5) |
| Fiche d'office pour chaque compte de l'équipe, coordonnées masquées avant vérification | déclencheurs sur `affectations`, `ma_fiche_contact`, `regler_ma_fiche` (premier enregistrement = vérification), `annuaire_centre` (migration 1, § 3, § 4, § 6) |
| Tables sans accès direct, lecture et écriture par fonctions | `revoke all` et contrôle de fin des migrations 2 et 3 ; `tests/sql/contact-*-preuve.sql` |
| Rien pour le siège d'ECF | aucune fonction de l'espace contact n'ouvre de lecture au rôle réseau (`_contact_direction_reelle` : direction du centre seulement) |
