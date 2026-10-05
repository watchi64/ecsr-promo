// Textes légaux de l'application : conditions d'utilisation (avec la politique de données)
// et mentions légales. Source unique : la page Informations légales les affiche, la fenêtre
// d'acceptation renvoie vers elles.
//
// VERSION_CONDITIONS : à changer UNIQUEMENT pour une modification substantielle (nouvel usage
// des données, nouveau destinataire, nouveau prestataire qui voit des données, durée allongée).
// Chaque compte doit alors accepter de nouveau à sa prochaine connexion. Une correction de
// forme (faute, tournure) ne change pas la version.
//

export const VERSION_CONDITIONS = "2026-10-04";

export const CONDITIONS_MD = `# Conditions d'utilisation et données personnelles

> **L'essentiel en 8 lignes**
> L'application accompagne la formation au Titre professionnel ECSR. Elle est éditée par Timy Studio, la micro-entreprise de Timy Valdivia.
> Elle enregistre ce qui sert à la formation : profil, notes, QCM, passages, absences, livret, dossier professionnel.
> Vos notes sont visibles des autres stagiaires de votre promo, sauf si vous choisissez de les masquer.
> Personne d'extérieur à la formation n'y accède, à une exception près : ECF peut consulter des résultats nominatifs.
> La base de données est hébergée en France ; l'assistant passe par Mistral AI, entreprise française.
> Rien n'est vendu, rien ne sert à la publicité, aucun traceur publicitaire ni mesure d'audience.
> Douze mois après la formation, les données nominatives sont supprimées ou anonymisées.
> Chacun peut consulter, corriger ou faire supprimer ses données, et saisir la CNIL.

## 1. Qui édite l'application

L'application est éditée par **Timy Studio**, entreprise individuelle de Timy Valdivia, stagiaire de la promo ECSR (« l'éditeur »). L'éditeur est **responsable du traitement** des données personnelles au sens du RGPD : c'est lui qui décide de ce qui est collecté et pourquoi. Ses coordonnées complètes figurent dans les mentions légales.

**Contact pour toute question sur vos données : contact@timy-studio.fr.**

L'application n'est pas éditée par ECF. C'est un outil d'accompagnement, pas un support officiel de la formation. Les cours et les QCM sont rédigés avec soin et sourcés, mais ne remplacent ni les supports officiels ni les textes en vigueur : en cas de doute, les référentiels officiels et Légifrance font foi.

## 2. Le compte et l'accès

L'accès est réservé aux stagiaires des promos ECSR et aux personnes associées à leur formation (formateurs, ECF). Chaque compte est personnel : on ne partage pas ses identifiants et on n'utilise pas le compte d'un autre.

L'usage de l'application suppose d'accepter les présentes conditions. L'acceptation est enregistrée avec sa date et la version du texte.

## 3. Les données enregistrées

| Catégorie | Contenu |
|-----------|---------|
| Profil | Nom, prénom, adresse e-mail, rôle, promo, date de naissance (reportée sur le livret officiel) |
| Résultats | Notes et évaluations, tentatives et scores aux QCM, examens blancs (EPCF) |
| Suivi | Passages en voiture, absences, placements au planning, souhaits de séances |
| Documents | Livret d'évaluation, dossier professionnel |
| Contributions | Signalements d'erreur sur les QCM |
| Historique | Qui a créé ou modifié une note ou un passage, et quand |
| Assistant | Nombre de messages envoyés par jour (le contenu des échanges n'est pas conservé, voir section 9) |

L'application ne collecte ni géolocalisation, ni contacts du téléphone, ni données de navigation à des fins publicitaires.

## 4. Qui voit quoi

| Donnée | Vous | Autres stagiaires | Formateurs | ECF |
|--------|------|-------------------|------------|-----|
| Notes et évaluations | Oui | Oui, sauf si masquées | Oui | Oui |
| Moyennes du groupe | Oui | Oui, sans nom | Oui | Oui |
| Planning, passages, absences | Oui | Oui | Oui | Non |
| Date de naissance, souhaits de séances | Oui | Non | Oui | Non |
| Livret, dossier professionnel, EPCF | Oui | Non | Oui | Oui |

« Autres stagiaires » : ceux de votre promo seulement. Le planning leur est visible parce qu'il organise la formation de tous.

**Masquer ses notes.** Depuis vos préférences, vous pouvez masquer vos notes : les autres stagiaires ne voient plus ni votre prénom ni vos notes, qui restent comptées dans les moyennes du groupe. En contrepartie, vous ne voyez plus que votre ligne et les moyennes du groupe. Ce masquage est garanti par la base de données elle-même, pas seulement par l'affichage. Pour éviter les allers-retours, après un changement (annulable dans les deux minutes), le réglage reste fixe pendant 24 heures.

Les promos ne se voient pas entre elles : un stagiaire n'accède qu'à sa propre promo.

## 5. À quoi servent les données, et sur quelle base

| Usage | Base légale |
|-------|-------------|
| Faire fonctionner l'application : afficher votre suivi, vos notes, votre planning, vos documents | Intérêt légitime de l'éditeur à fournir un outil d'aide à la formation, que vous avez choisi d'utiliser |
| Montrer les notes aux autres stagiaires de la promo | Intérêt légitime (émulation, repères de progression) ; vous pouvez vous y opposer à tout moment en masquant vos notes |
| Permettre à ECF de consulter des résultats nominatifs | Intérêt légitime de l'organisme de formation à suivre ses stagiaires |
| Produire des statistiques anonymes pour améliorer l'application et les contenus | Intérêt légitime de l'éditeur |
| Envoyer les e-mails du compte (invitation, mot de passe oublié) | Nécessaire au fonctionnement du compte |
| Répondre à vos questions par l'assistant | Intérêt légitime ; l'assistant n'est utilisé que si vous lui écrivez |

**Statistiques anonymes.** Elles décrivent la promo, jamais une personne (par exemple « 80 % de réussite sur le thème 12 »). Elles peuvent être conservées sans limite de durée, partagées à l'extérieur, notamment avec ECF, et servir à développer et présenter l'outil. Une fois anonymisée, une donnée ne permet plus de remonter à quelqu'un.

## 6. Ce que l'éditeur ne fait jamais

- Vendre ou louer des données, à quiconque.
- Utiliser les données à des fins publicitaires.
- Publier des résultats nominatifs hors de l'application.
- Transmettre des données nominatives à d'autres que ECF.
- Croiser les données avec des services extérieurs à la formation.

## 7. Les personnes sans compte : élèves bénévoles et auto-écoles partenaires

Pour organiser les séances de conduite, les formateurs enregistrent les **élèves bénévoles** (prénom, nom, téléphone, niveau, type de boîte, disponibilités, venues) et les **référents des auto-écoles partenaires** (nom, téléphone, e-mail, adresse de l'auto-école).

- Ces données ne sont visibles que des formateurs du lieu de formation concerné. Les stagiaires ne voient, dans le planning, que le prénom d'un élève et l'initiale de son nom.
- Elles servent uniquement à organiser les séances et à joindre la personne.
- Elles sont conservées tant que la personne participe, puis supprimées au plus tard douze mois après sa dernière venue, ou plus tôt sur simple demande.
- Pour un élève mineur, on enregistre de préférence le numéro d'un parent, avec son accord.
- La personne est informée de cet enregistrement lors de sa première venue, et peut exercer les mêmes droits que les stagiaires (section 12).

## 8. Où vivent les données : les prestataires

| Prestataire | Rôle | Ce qu'il voit | Où |
|-------------|------|---------------|----|
| Supabase | Base de données et comptes | L'ensemble des données de l'application | Union européenne (région de Paris) |
| GitHub (GitHub Pages) | Hébergement des pages de l'application | L'adresse IP de connexion, conservée pour la sécurité | États-Unis |
| Mistral AI | Moteur de l'assistant | Les messages envoyés à l'assistant | France, Union européenne |
| Resend | Envoi des e-mails du compte | L'adresse e-mail du destinataire et le contenu de l'e-mail | États-Unis |
| esm.sh | Diffusion d'une bibliothèque technique utilisée par l'application | L'adresse IP de connexion | Réseau mondial |

Les transferts vers les États-Unis (GitHub, Resend) sont encadrés par le cadre de protection des données UE-États-Unis (Data Privacy Framework) et par les clauses contractuelles types de la Commission européenne.

## 9. L'assistant intégré

L'assistant est une **intelligence artificielle** : ses réponses sont générées automatiquement et peuvent contenir des erreurs. Elles s'appuient sur les cours de l'application et, pour les articles de loi, sur Légifrance ; elles ne remplacent ni un formateur ni les textes officiels.

- Vos messages sont transmis à Mistral AI le temps de générer la réponse. L'option qui permettrait à Mistral d'utiliser ces messages pour entraîner ses modèles est désactivée.
- L'application ne conserve pas vos échanges sur ses serveurs : l'historique reste dans votre navigateur et disparaît à la fermeture de l'onglet. Seul le nombre de messages du jour est compté, pour appliquer la limite quotidienne.
- N'écrivez pas à l'assistant d'informations sensibles sur vous ou sur autrui (santé, vie privée).

## 10. Combien de temps

| Données | Durée |
|---------|-------|
| Données de formation (profil, notes, suivi, documents) | Toute la formation, puis douze mois pour permettre de retrouver son livret, son dossier ou ses résultats |
| Historique des modifications | Même durée que la donnée concernée |
| Élèves bénévoles, référents d'auto-école | Douze mois au plus après la dernière venue ou le dernier contact |
| Statistiques anonymes | Sans limite (elles n'identifient personne) |

Au terme de ces durées, les comptes sont fermés et les données nominatives sont supprimées ou anonymisées : les résultats restent dans les statistiques, les noms disparaissent. Un stagiaire qui quitte la formation en cours de route est traité de la même façon, à compter de son départ.

## 11. Sécurité et incidents

Les données sont protégées par des droits d'accès par rôle appliqués par la base de données elle-même (un stagiaire ne peut techniquement pas lire ce qui ne lui est pas destiné), des connexions chiffrées, et des mots de passe que le prestataire des comptes conserve sous une forme illisible, y compris pour l'éditeur.

En cas de violation de données présentant un risque pour les personnes, l'éditeur la notifie à la CNIL dans les 72 heures et informe sans tarder les personnes concernées lorsque le risque est élevé.

## 12. Vos droits

Conformément au RGPD, chacun peut :

- **accéder** aux données qui le concernent (l'essentiel est déjà visible dans l'application) et en obtenir une copie ;
- **faire corriger** une donnée inexacte ;
- **faire supprimer** ses données nominatives ;
- **s'opposer** à un usage particulier ou en demander la **limitation** ;
- **récupérer** ses données dans un format courant (portabilité).

Pour exercer ces droits : contact@timy-studio.fr, ou directement auprès de l'éditeur. La réponse intervient dans un délai d'un mois au plus. La suppression des données nominatives n'affecte pas les statistiques anonymes déjà produites.

Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la **CNIL** (www.cnil.fr).

## 13. Cookies et stockage dans le navigateur

L'application n'utilise **aucun cookie publicitaire ni outil de mesure d'audience**. Elle conserve dans votre navigateur uniquement ce qui est nécessaire à son fonctionnement : votre session de connexion et quelques préférences d'affichage (dernier onglet ouvert, tri choisi, nouveautés déjà lues). Ces éléments sont dispensés de consentement.

## 14. Propriété intellectuelle

L'application (code, design, fonctionnalités) et les contenus pédagogiques qu'a rédigés l'éditeur (cours, QCM, fiches, illustrations) sont sa propriété. Les contenus apportés par des formateurs ou issus de supports d'ECF restent la propriété de leurs auteurs. Utiliser l'application ne confère aucun droit sur ces éléments : on ne les copie pas, on ne les rediffuse pas et on ne les exploite pas en dehors de l'application sans accord.

Les signalements et suggestions des utilisateurs peuvent être utilisés librement pour corriger et améliorer l'application ; ils ne donnent lieu à aucune contrepartie.

## 15. Bon usage

L'application repose sur la confiance au sein de la promo. Chacun s'engage à :

- ne pas tenter d'accéder aux données d'autrui hors des écrans prévus ;
- ne pas diffuser à l'extérieur des données personnelles vues dans l'application ;
- pour les formateurs : n'écrire dans les champs de commentaire aucune information de santé ni de vie privée (une absence se note « absent », sans motif médical) ;
- signaler à l'éditeur tout dysfonctionnement touchant aux données.

L'éditeur maintient l'application sans garantie de disponibilité.

## 16. Modification des conditions et évolution de l'outil

Ces conditions peuvent évoluer, notamment si l'application change ou si un nouvel usage des données est envisagé. Toute modification substantielle est présentée à la connexion et doit être acceptée de nouveau. La version en vigueur et sa date sont consultables à tout moment dans l'application.

Un engagement en particulier : si l'application devenait un service commercial proposé à d'autres organismes ou changeait d'exploitant, les données nominatives ne seraient pas transférées dans ce nouveau cadre sans l'accord explicite de chacun. Seules les statistiques anonymes pourraient accompagner l'outil dans son évolution.
`;

export const MENTIONS_MD = `# Mentions légales

## Éditeur

- **Timy Studio**, entreprise individuelle (micro-entreprise) de Timy Valdivia
- SIRET : 106 264 021 00010
- Adresse : rue Marcel Pagnol, 30000 Nîmes
- Contact : contact@timy-studio.fr
- Directeur de la publication : Timy Valdivia

## Hébergement

Pages de l'application : **GitHub, Inc.** (service GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.

Base de données et comptes : **Supabase**, centre de données de la région de Paris (Union européenne).

## Données personnelles

Le traitement des données personnelles est décrit dans les conditions d'utilisation, sections 3 à 13. Contact : contact@timy-studio.fr. Réclamation possible auprès de la CNIL (www.cnil.fr).

## Propriété intellectuelle

L'application et les contenus rédigés par l'éditeur sont protégés par le droit d'auteur. Toute reproduction ou rediffusion hors de l'application suppose l'accord de l'éditeur. Les textes officiels cités (Code de la route, référentiels) proviennent de sources publiques, notamment Légifrance.
`;
