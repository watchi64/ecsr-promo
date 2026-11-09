# Qualiopi Q3 : textes à valider (questionnaires et conditions d'utilisation)

Document de relecture pour Timy. Rien n'est en base ni en ligne tant que ces textes ne sont pas validés. Les questions sont à l'écran avec le tutoiement ; les conditions s'adressent au lecteur avec le vouvoiement, comme le reste du texte existant.

Échelle commune aux questions notées : « Pas du tout » (1), « Plutôt non » (2), « Plutôt oui » (3), « Tout à fait » (4), « Sans avis ». Pas de point neutre. Le taux de satisfaction publié est la part des réponses 3 ou 4 à la question « globalement », parmi les avis notés (« Sans avis » exclu) ; il n'est publié qu'à partir de 5 avis notés.

**Questions de l'app et de la base.** Les identifiants, types, caractère facultatif, options et versions des questions
sont écrits deux fois : dans l'app (`js/questionnaires-data.js`) et dans la table `questionnaire_questions` de la
migration (`supabase/migrations/20261108_questionnaires.sql`). Toute retouche d'une question ou d'une option, après la
validation de ces textes, touche les deux fichiers ; le test `tests/questionnaires-data.test.mjs` compare les deux et
échoue sur le moindre écart (sinon la base refuserait l'envoi au dernier écran du questionnaire).

**Retouches du 09/11 pour la conservation à trois ans.** Six phrases des conditions ont changé pour tenir avec le
lot Q5 (conservation) et le lot Q4 (registre qualité) : section 7, en fin de document. Elles ne tranchent aucun des points
ci-dessous.

## Points à trancher

Dix questions restent ouvertes après la construction (relectures du 08 et du 09/11, relecture finale du 09/11). Les
textes des sections 1, 2 et 6 sont à jour de la relecture finale ; chaque retouche de cette relecture est donnée avant
et après en section 5. Chaque point dit ce qui est en place par défaut et ce qui changerait. Rien n'est appliqué en base
avant la réponse de Timy.

1. **Formes au masculin.** Plusieurs questions accordent au masculin : « Tu as été accompagné » (question 5 du
   questionnaire de fin de formation), « tu es satisfait » (question « globalement » des trois questionnaires),
   « L'application t'a aidé » (question 9), « t'a bien préparé » (question 3 du questionnaire à six mois). Par défaut :
   masculin générique. Autres choix : une tournure sans accord (par exemple « Tu as reçu de l'aide quand tu avais une
   difficulté », « Globalement, la formation te satisfait ») ou le point médian (« accompagné·e »). Changer un texte
   crée une version 2 du questionnaire, sans effet sur les réponses déjà données (aucune avant la mise en ligne).
2. **Questions doubles.** « La formation te prépare bien à l'examen et au métier d'enseignant de la conduite »
   (question 6 de fin de formation) mesure deux choses : une réponse « Plutôt non » ne dit pas laquelle. Par défaut :
   une seule question. Autre choix : deux questions (l'examen, le métier), soit onze questions au lieu de dix. Même
   remarque, moins forte, pour « expliquent clairement et répondent à tes questions » (question 3) et « clairs et
   réalistes » (question 1 des formateurs).
3. **Compte visible de la question facultative.** Sur la page Qualiopi, les résultats donnent le nombre de réponses
   de chaque question. Pour la question facultative « L'application t'a aidé dans ta formation », ce nombre montre
   combien de personnes l'ont passée (sans dire qui, et jamais sous 5 réponses). Par défaut : affiché. Autre choix :
   ne montrer que les pourcentages de cette question.
4. **Fondateur sans affectation hors du questionnaire des formateurs.** Le questionnaire des formateurs d'un centre est
   proposé à qui a une affectation de formateur sur une promo de ce centre (rôles et portées du lot 4). Le statut de
   fondateur ne suffit pas : si Timy forme sans affectation de formateur, le questionnaire ne lui est pas proposé.
   Par défaut : non proposé. Autre choix : lui donner une affectation de formateur sur une promo du centre (aucune
   modification du code).
5. **Affectation sans date de fin.** Une affectation du lot 4 n'a pas de date de fin. Un formateur affecté à une
   promo du centre, même finie depuis longtemps, reste concerné chaque année tant que la ligne d'affectation existe.
   Par défaut : accepté. Autre choix : retirer les affectations des promos terminées (direction du centre ou
   fondateur), ou une règle en base qui ne retient que les promos récentes.
6. **Année du questionnaire des formateurs, fenêtre sur deux années.** L'année d'un questionnaire des formateurs est
   celle du jour de la réponse (décision R8 du 08/11). La fenêtre de Nîmes va du 04/12/2026 au 10/01/2027 : un même
   formateur peut répondre une fois au titre de 2026 et une fois au titre de 2027. Par défaut : accepté, chaque année a
   son questionnaire. Autre choix : prendre l'année de la date de fin de la promo dont la fenêtre est ouverte.
7. **Sigle ECF.** Les conditions d'utilisation emploient « ECF » sans le développer, dès l'essentiel (ligne
   « Personne d'extérieur à la formation n'y accède... »). Par défaut : sigle seul. À donner par Timy : la forme
   développée à écrire à la première apparition.
8. **Lecteurs des commentaires dans le tableau « Qui voit quoi ».** Le paragraphe « Questionnaires de satisfaction »
   (section 4 des conditions) dit que les commentaires libres sont lus par l'éditeur et les personnes chargées de la
   qualité du centre, mais le tableau de la même section n'a pas de ligne pour les questionnaires. Par défaut : le
   paragraphe seul. Autre choix : une ligne « Questionnaires » au tableau (réponses regroupées, à partir du seuil ;
   commentaires : éditeur et qualité du centre). La nouvelle version des conditions n'est pas encore en ligne : la
   ligne peut y entrer sans demander une acceptation de plus.
9. **Ce que l'anonymat garantit vraiment.** La réponse est enregistrée sans nom, sans compte, sans date et sans numéro
   d'ordre, et les écrans comme les documents n'affichent rien sous le seuil (5 réponses, 3 pour les formateurs). Mais
   la note de participation (qui a répondu, pour refuser une deuxième réponse) garde le compte, et la migration écrit
   elle-même ce qui reste hors de portée de la base : qui lit les tables (l'éditeur SQL du projet Supabase, donc
   l'éditeur de l'application) relie l'unique participation d'une promo à son unique réponse (cas courant au début
   d'une fenêtre, et pour les formateurs d'un centre), ou déduit une réponse en comparant les tables avant et après
   elle ; les sauvegardes et le journal des transactions gardent l'historique. Les premiers textes promettaient
   « personne ne peut savoir qui a répondu quoi » et « pas même l'éditeur » : c'était faux. Par défaut (textes
   retouchés, section 5) : on dit ce qui est vrai (sans nom, sans compte, sans date ; dans l'application et ses
   documents, personne ne voit qui a répondu quoi ; résultats à partir du seuil), les conditions écrivent la limite
   technique dans un paragraphe « Limite de cet anonymat », et **proposent un engagement de l'éditeur : ne pas lire
   ces tables directement, ne consulter les réponses que par les écrans de l'application** (à accepter ou non par
   Timy). La durée « sans limite » des réponses, qui reposait sur leur anonymat, devient trois ans comme les preuves de
   la formation, puis seuls restent les résultats regroupés (taux et répartitions, à partir du seuil) : à mettre en
   œuvre au lot Q5. Autres choix : (a) écrire la limite sans prendre d'engagement ; (b) une mesure technique au lot Q5 :
   effacer les notes de participation d'une portée quand sa fenêtre se ferme (elles ne servent plus) ; après cela,
   même en lisant les tables, plus rien ne relie une réponse à un compte, et les réponses pourraient alors être
   gardées sans limite comme statistiques ; contrepartie : une réouverture manuelle de la fenêtre permettrait une
   deuxième réponse ; (c) ne garder les réponses d'une portée qu'une fois le seuil atteint (une table d'attente vidée
   à la fermeture si le seuil n'est pas atteint), ce qui protège les petites portées mais perd les avis d'une promo
   qui n'atteint pas 5 réponses.
10. **Formateurs sur l'ancienne barre.** Au démarrage, un formateur arrive sur la page Stagiaires, où il n'y a pas de
   bandeau : il ne voit le questionnaire qu'en ouvrant l'Accueil. Par défaut : rien de changé dans l'app. Autres
   choix : envoyer aussi le lien direct aux formateurs à l'ouverture
   (`https://watchi64.github.io/ecsr-promo/#/questionnaire/fin_formateur`), ou poser le bandeau sur la page Stagiaires
   (une modification de l'app).

## 1. Les trois questionnaires

### Ton avis sur la formation (clé `fin_stagiaire`)

- Qui répond : les stagiaires de la promo
- Bandeau affiché : de 7 jours avant la fin de la promo à 30 jours après
- Rien n'est montré sous 5 réponses
- Introduction affichée : « Ces questions portent sur ta formation. Ta réponse est enregistrée sans ton nom, sans ton compte et sans date ; dans l'application, personne ne peut voir qui a répondu quoi, et les résultats ne s'affichent qu'à partir de 5 réponses. Compte environ trois minutes. »

1. **Les objectifs de la formation t'ont été clairement présentés.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
2. **Les contenus correspondent à ce que tu attendais de la formation.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
3. **Les formateurs expliquent clairement et répondent à tes questions.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
4. **L'organisation (plannings, horaires, salles, informations reçues) te convient.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
5. **Tu as été accompagné quand tu avais une difficulté.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
6. **La formation te prépare bien à l'examen et au métier d'enseignant de la conduite.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
7. **Tu recommanderais cette formation à un proche.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
8. **Globalement, tu es satisfait de la formation.** (obligatoire, question « globalement » du taux de satisfaction)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
9. **L'application t'a aidé dans ta formation.** (facultative)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
10. **Si tu veux ajouter quelque chose, écris-le ici. Ne cite personne : parle de ce que tu as vécu, pas de qui.** (facultative)
   - Réponse : texte libre

### Six mois après, ton avis (clé `six_mois_stagiaire`)

- Qui répond : les stagiaires de la promo
- Bandeau affiché : de 6 mois à 7 mois après la fin de la promo
- Rien n'est montré sous 5 réponses
- Introduction affichée : « Quelques mois ont passé depuis la fin de ta formation. Ces questions nous disent ce qu'elle t'a apporté. Ta réponse est enregistrée sans ton nom, sans ton compte et sans date, et les résultats ne s'affichent qu'à partir de 5 réponses. Compte une minute ou deux. »

1. **Où en es-tu aujourd'hui ?** (obligatoire)
   - J'ai le titre et j'enseigne la conduite
   - J'ai le titre et je cherche un poste
   - Je n'ai pas encore le titre (examen à repasser ou à venir)
   - Je fais autre chose
2. **Ce que tu as appris en formation te sert dans ta situation actuelle.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
3. **Avec le recul, la formation t'a bien préparé au métier.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
4. **Globalement, avec le recul, tu es satisfait de la formation.** (obligatoire, question « globalement » du taux de satisfaction)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
5. **Si tu veux ajouter quelque chose, écris-le ici. Ne cite personne : parle de ce que tu as vécu, pas de qui.** (facultative)
   - Réponse : texte libre

### Ton avis de formateur (clé `fin_formateur`)

- Qui répond : les formateurs du centre
- Bandeau affiché : de 7 jours avant la fin de la promo à 30 jours après (un questionnaire par centre et par année civile)
- Rien n'est montré sous 3 réponses
- Introduction affichée : « Ces questions portent sur la formation telle que tu l'as animée cette année. Ta réponse est enregistrée sans ton nom, sans ton compte et sans date, et regroupée avec celles des autres formateurs du centre : les résultats ne s'affichent qu'à partir de 3 réponses. Compte trois minutes. »

1. **Les objectifs de la formation sont clairs et réalistes pour les stagiaires.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
2. **Les supports et les outils mis à ta disposition te permettent d'enseigner correctement.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
3. **L'organisation (plannings, salles, véhicules, informations reçues) te convient.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
4. **Le niveau des stagiaires correspond à ce que la formation demande.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
5. **Tu disposes des moyens de suivre chaque stagiaire et de l'aider en cas de difficulté.** (obligatoire)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
6. **Globalement, tu es satisfait des conditions dans lesquelles la formation se déroule.** (obligatoire, question « globalement » du taux de satisfaction)
   - Réponses : Pas du tout / Plutôt non / Plutôt oui / Tout à fait / Sans avis
7. **Si tu veux ajouter quelque chose, écris-le ici. Ne cite personne : parle de ce que tu as vécu, pas de qui.** (facultative)
   - Réponse : texte libre

## 2. Conditions d'utilisation : passages modifiés

Nouvelle version : **2026-11-08**. Chaque compte doit accepter de nouveau à sa prochaine connexion, une seule fois. Le reste du texte (16 sections) est inchangé. Chaque passage est donné avant et après ; les durées de trois ans seront mises en œuvre par les lots Q4 et Q5, avant la première anonymisation de la promo de Nîmes (fin le 11/12/2026, donc décembre 2027).

### Passage 1

Avant :

> passages, absences, livret, dossier professionnel.
> 

Après :

> passages, absences, livret, dossier professionnel, et vos réponses aux questionnaires de satisfaction, enregistrées sans votre nom.
> 

### Passage 2

Avant :

> > Douze mois après la formation, les données nominatives sont supprimées ou anonymisées.

Après :

> > Douze mois après la formation, les comptes et les textes libres disparaissent ; les preuves de la formation (résultats, heures, présences) sont gardées trois ans, puis rendues anonymes.

### Passage 3

Avant :

> | Historique | Qui a créé

Après :

> | Questionnaires | Vos réponses, enregistrées sans votre nom ni la date ; l'application note seulement que vous avez participé |
> | Historique | Qui a créé

### Passage 4

Avant :

> Les promos ne se voient pas entre elles : un stagiaire n'accède qu'à sa propre promo.
> 

Après :

> Les promos ne se voient pas entre elles : un stagiaire n'accède qu'à sa propre promo.
> 
> **Questionnaires de satisfaction.** La réponse est enregistrée sans nom, sans compte, sans date et sans numéro d'ordre, séparément de la note de participation (« a répondu » ou « n'a pas répondu »), qui sert seulement à ne pas redemander et à refuser une deuxième réponse. Dans l'application et dans les documents qu'elle produit, personne ne peut voir qui a répondu quoi : les résultats ne sont montrés que lorsqu'au moins cinq stagiaires ont répondu (trois formateurs pour le questionnaire des formateurs) ; les commentaires libres ne sont lus que par l'éditeur et les personnes chargées de la qualité du centre (dans ces conditions, « le centre » désigne ECF, l'organisme de formation), dans un ordre aléatoire, sous la même condition.
> 
> **Limite de cet anonymat.** L'éditeur administre la base de données et peut techniquement en lire les tables. Tant qu'une seule personne a répondu dans une promo (ou un seul formateur dans un centre), ou en comparant les tables avant et après une réponse, il pourrait y rapprocher une réponse de la note de participation de son auteur. L'éditeur s'engage à ne pas lire ces tables directement : il ne consulte les réponses que par les écrans de l'application, qui appliquent le seuil.
> 

### Passage 5

Avant :

> | Répondre à vos questions par l'assistant |

Après :

> | Recueillir votre avis sur la formation par des questionnaires enregistrés sans nom, et en produire un taux de satisfaction | Intérêt légitime de l'éditeur et du centre à mesurer et améliorer la formation, preuve que le centre doit pouvoir apporter à son certificateur |
> | Répondre à vos questions par l'assistant |

### Passage 6

Avant :

> **Statistiques anonymes.**

Après :

> **Documents du centre.** L'application produit des documents (dossier de la formation, dossier du centre, fiche de résultats) qu'ECF, qui forme les stagiaires, présente à son certificateur Qualiopi et à ses financeurs pour prouver ce qu'il fait. Ils reprennent des chiffres de l'application : heures, présences, résultats, taux de satisfaction. Le dossier de la formation est nominatif ; le dossier destiné au siège ne contient aucun nom. Aucun de ces documents ne contient une réponse individuelle à un questionnaire ni un commentaire libre. ECF les remet lui-même : l'éditeur ne les envoie à personne.
> 
> **Statistiques anonymes.**

### Passage 7

Avant :

> - Transmettre des données nominatives à d'autres que ECF.

Après :

> - Transmettre des données nominatives à d'autres que ECF. La présentation de documents par ECF à son certificateur et à ses financeurs (section 5) n'est pas une transmission par l'éditeur.

### Passage 8

Avant :

> | Données de formation (profil, notes, suivi, documents) | Toute la formation, puis douze mois pour permettre de retrouver son livret, son dossier ou ses résultats |
> | Historique des modifications | Même durée que la donnée concernée |

Après :

> | Compte, adresse e-mail, date de naissance, fiches de suivi, textes libres (observations, commentaires) | Toute la formation, puis douze mois |
> | Preuves de la formation : nom, résultats, heures, présences, feuilles d'émargement signées, dossier professionnel, livret | Toute la formation, puis trois ans (jusqu'au 31 décembre de la troisième année après la fin de la formation) : c'est la durée du cycle de certification Qualiopi. Ensuite les noms, les signatures, le dossier professionnel et le livret sont effacés ; les heures, présences et résultats restent sans nom |
> | Questionnaires de satisfaction | Les réponses, enregistrées sans nom, sont gardées trois ans comme les preuves de la formation (jusqu'au 31 décembre de la troisième année après la fin de la formation ; pour le questionnaire des formateurs, après l'année du questionnaire), puis supprimées : seuls restent les résultats regroupés (taux et répartitions, à partir du seuil). Les commentaires libres sont effacés douze mois après la fin de la formation (pour le questionnaire des formateurs, le 31 décembre de l'année suivante). La note de participation est supprimée avec le compte |
> | Registre qualité du centre (réclamations, difficultés, aléas, améliorations, risques) | Trois ans après la clôture de l'entrée, puis sa description et sa réponse sont vidées ; le type, les dates et l'état restent |
> | Historique des modifications | Même durée que la donnée concernée |

### Passage 9

Avant :

> Au terme de ces durées, les comptes sont fermés et les données nominatives sont supprimées ou anonymisées : les résultats restent dans les statistiques, les noms disparaissent.

Après :

> Au terme de ces durées, les comptes sont fermés et les données nominatives sont supprimées ou anonymisées : les résultats restent dans les statistiques, les noms disparaissent. Aucune donnée nominative n'est gardée plus de trois ans après la fin de la formation.

### Passage 10

Avant :

> La suppression des données nominatives n'affecte pas les statistiques anonymes déjà produites.

Après :

> La suppression des données nominatives n'affecte pas les statistiques anonymes déjà produites.
> 
> **Effacement sur demande.** Une demande d'effacement est exécutée sans attendre la fin des durées de la section 10, dans le délai d'un mois indiqué ci-dessus, même si cela retire des preuves de votre parcours : le dossier de la formation indique alors « fiche effacée à la demande de la personne ». Vos réponses aux questionnaires, enregistrées sans votre nom ni votre compte, ne peuvent pas être retrouvées pour être retirées une à une ; c'est la contrepartie de cet enregistrement sans nom.

## 3. Corrections du tour 1 : passages ajoutés

Décisions : le centre de formation, c'est ECF, l'exception « ECF » reste la seule et comprend la présentation des documents à son certificateur et à ses financeurs ; l'effacement sur demande se fait dans le délai d'un mois déjà promis ; les commentaires sont lus par l'éditeur et les personnes chargées de la qualité du centre (pas de deuxième acceptation quand la direction arrivera). Les passages ci-dessus (sections 4, 5, 6, 10 et 12) sont déjà à jour de ces décisions.

### Passage 11

Avant :

> Personne d'extérieur à la formation n'y accède, à une exception près : ECF peut consulter des résultats nominatifs.

Après :

> Personne d'extérieur à la formation n'y accède, à une exception près : ECF peut consulter des résultats nominatifs et présenter des documents de la formation à son certificateur Qualiopi et à ses financeurs.

### Passage 12

Avant :

> (rien : le tableau de la section 4 s'arrêtait à la ligne « Signalements de problème »)

Après :

> La colonne ECF comprend la présentation, par ECF à son certificateur Qualiopi et à ses financeurs, des documents décrits en section 5.

### Passage 13

Avant :

> - Publier des résultats nominatifs hors de l'application.

Après :

> - Rendre publics des résultats nominatifs (les publier hors de l'application).

## 4. Corrections du tour 2

Les passages ci-dessus sont à jour (définition de « le centre » dans la section 4, §6 reformulé). Passage ajouté :

### Passage 14

Avant :

> (aucune ligne pour la présentation des documents au certificateur dans le tableau de la section 5)

Après (nouvelle ligne du tableau, usage puis base légale) :

> | Permettre à ECF de présenter les documents de la formation à son certificateur Qualiopi et à ses financeurs | Obligation légale : la certification Qualiopi conditionne l'accès aux fonds publics et mutualisés de la formation professionnelle (code du travail, article L6316-1) |

## 5. Corrections de la relecture finale (09/11)

La relecture finale de la branche a trouvé que plusieurs textes promettaient plus que ce que la base garantit (point 9
ci-dessus). Les retouches ci-dessous sont des propositions, comme le reste du document : elles sont déjà dans l'app
(`js/questionnaires-data.js`, `js/nouveautes-data.js`, `js/legal-data.js`) et dans les sections 1, 2 et 6, et attendent la
validation de Timy. La version des conditions reste 2026-11-08 (pas encore en ligne) : une seule nouvelle acceptation.

### Retouche A : introduction « Ton avis sur la formation »

Avant :

> « Ces questions portent sur ta formation. Ta réponse est enregistrée sans ton nom et sans date : personne ne peut savoir qui a répondu quoi. Compte environ trois minutes. »

Après :

> « Ces questions portent sur ta formation. Ta réponse est enregistrée sans ton nom, sans ton compte et sans date ; dans l'application, personne ne peut voir qui a répondu quoi, et les résultats ne s'affichent qu'à partir de 5 réponses. Compte environ trois minutes. »

### Retouche B : introduction « Six mois après, ton avis »

Avant :

> « Quelques mois ont passé depuis la fin de ta formation. Ces questions nous disent ce qu'elle t'a apporté. Ta réponse est enregistrée sans ton nom et sans date. Compte une minute ou deux. »

Après :

> « Quelques mois ont passé depuis la fin de ta formation. Ces questions nous disent ce qu'elle t'a apporté. Ta réponse est enregistrée sans ton nom, sans ton compte et sans date, et les résultats ne s'affichent qu'à partir de 5 réponses. Compte une minute ou deux. »

### Retouche C : introduction « Ton avis de formateur »

Avant :

> « Ces questions portent sur la formation telle que tu l'as animée cette année. Ta réponse est enregistrée sans ton nom et sans date, et regroupée avec celles des autres formateurs du centre. Compte trois minutes. »

Après :

> « Ces questions portent sur la formation telle que tu l'as animée cette année. Ta réponse est enregistrée sans ton nom, sans ton compte et sans date, et regroupée avec celles des autres formateurs du centre : les résultats ne s'affichent qu'à partir de 3 réponses. Compte trois minutes. »

### Retouche D : entrée Nouveautés « Ton avis sur la formation, sans ton nom »

Avant :

> À la fin de la formation, un court questionnaire s'affiche en haut de l'Accueil : quelques questions sur la formation elle-même, à noter de 1 à 4, avec « Sans avis » quand tu ne sais pas. Ta réponse est enregistrée sans ton nom et sans date : personne ne peut savoir qui a répondu quoi. « Plus tard » le fait revenir le lendemain. Les formateurs ont leur propre questionnaire, et quelques questions reviendront six mois après la fin de la formation.

Après :

> À la fin de la formation, un court questionnaire s'affiche en haut de l'Accueil : quelques questions sur la formation elle-même, à noter de 1 à 4, avec « Sans avis » quand tu ne sais pas. Ta réponse est enregistrée sans ton nom, sans ton compte et sans date ; dans l'application, personne ne peut voir qui a répondu quoi, et les résultats n'apparaissent qu'à partir de 5 réponses. « Plus tard » le fait revenir le lendemain. Les formateurs ont leur propre questionnaire, et quelques questions reviendront six mois après la fin de la formation.

### Retouche E : conditions, l'essentiel (ligne 2, passage 1)

Avant :

> passages, absences, livret, dossier professionnel, et vos réponses aux questionnaires de satisfaction, qui sont anonymes.

Après :

> passages, absences, livret, dossier professionnel, et vos réponses aux questionnaires de satisfaction, enregistrées sans votre nom.

### Retouche F : conditions, section 4, paragraphe « Questionnaires de satisfaction » (passage 4)

Avant :

> **Questionnaires de satisfaction.** Ils sont anonymes : la réponse est enregistrée sans nom, sans date et sans numéro d'ordre, séparément de la note de participation (« a répondu » ou « n'a pas répondu »), qui sert seulement à ne pas redemander et à refuser une deuxième réponse. Personne ne peut relier une réponse à une personne, pas même l'éditeur. Les résultats ne sont montrés que lorsqu'au moins cinq stagiaires ont répondu (trois formateurs pour le questionnaire des formateurs) ; les commentaires libres ne sont lus que par l'éditeur et les personnes chargées de la qualité du centre (dans ces conditions, « le centre » désigne ECF, l'organisme de formation), dans un ordre aléatoire, sous la même condition.

Après (le paragraphe, puis un paragraphe neuf ; l'engagement de sa dernière phrase est une proposition, point 9) :

> **Questionnaires de satisfaction.** La réponse est enregistrée sans nom, sans compte, sans date et sans numéro d'ordre, séparément de la note de participation (« a répondu » ou « n'a pas répondu »), qui sert seulement à ne pas redemander et à refuser une deuxième réponse. Dans l'application et dans les documents qu'elle produit, personne ne peut voir qui a répondu quoi : les résultats ne sont montrés que lorsqu'au moins cinq stagiaires ont répondu (trois formateurs pour le questionnaire des formateurs) ; les commentaires libres ne sont lus que par l'éditeur et les personnes chargées de la qualité du centre (dans ces conditions, « le centre » désigne ECF, l'organisme de formation), dans un ordre aléatoire, sous la même condition.
> 
> **Limite de cet anonymat.** L'éditeur administre la base de données et peut techniquement en lire les tables. Tant qu'une seule personne a répondu dans une promo (ou un seul formateur dans un centre), ou en comparant les tables avant et après une réponse, il pourrait y rapprocher une réponse de la note de participation de son auteur. L'éditeur s'engage à ne pas lire ces tables directement : il ne consulte les réponses que par les écrans de l'application, qui appliquent le seuil.

### Retouche G : conditions, section 5, ligne des questionnaires (passage 5)

Avant :

> | Recueillir votre avis sur la formation par des questionnaires anonymes, et en produire un taux de satisfaction |

Après :

> | Recueillir votre avis sur la formation par des questionnaires enregistrés sans nom, et en produire un taux de satisfaction |

### Retouche H : conditions, section 10, durée des questionnaires (passage 8)

Avant :

> | Questionnaires de satisfaction | Les réponses, qui n'ont pas de nom, servent aux statistiques sans limite ; les commentaires libres sont effacés douze mois après la fin de la formation ; la note de participation est supprimée avec le compte |

Après (trois ans au lieu de « sans limite », point 9 ; date des commentaires des formateurs, qui n'ont pas de « fin de
formation » : leur portée est le centre et l'année) :

> | Questionnaires de satisfaction | Les réponses, enregistrées sans nom, sont gardées trois ans comme les preuves de la formation (jusqu'au 31 décembre de la troisième année après la fin de la formation ; pour le questionnaire des formateurs, après l'année du questionnaire), puis supprimées : seuls restent les résultats regroupés (taux et répartitions, à partir du seuil). Les commentaires libres sont effacés douze mois après la fin de la formation (pour le questionnaire des formateurs, le 31 décembre de l'année suivante). La note de participation est supprimée avec le compte |

### Retouche I : conditions, section 12, « Effacement sur demande » (passage 10, dernière phrase)

Avant :

> Vos réponses aux questionnaires, enregistrées sans votre nom, ne peuvent pas être retrouvées pour être retirées une à une ; c'est la contrepartie de leur anonymat.

Après :

> Vos réponses aux questionnaires, enregistrées sans votre nom ni votre compte, ne peuvent pas être retrouvées pour être retirées une à une ; c'est la contrepartie de cet enregistrement sans nom.

### Retouche J : message WhatsApp (section 6)

Avant (rapport de construction de la tâche 5) :

> Bonjour à tous ! La formation touche à sa fin et ton avis compte. Un court questionnaire t'attend dans l'app, sur l'Accueil : une dizaine de questions sur la formation, environ trois minutes. Ta réponse est enregistrée sans ton nom et sans date, personne ne peut savoir qui a répondu quoi. Le lien direct : https://watchi64.github.io/ecsr-promo/#/questionnaire/fin_stagiaire Merci d'avance !

Après (« vous » collectif, accordé à « Bonjour à tous », et la promesse ramenée à l'application et au seuil) :

> Bonjour à tous ! La formation touche à sa fin et votre avis compte. Un court questionnaire vous attend dans l'app, sur l'Accueil : une dizaine de questions sur la formation, environ trois minutes. Chaque réponse est enregistrée sans nom, sans compte et sans date ; dans l'app, personne ne peut voir qui a répondu quoi, et les résultats ne s'affichent qu'à partir de 5 réponses. Le lien direct : https://watchi64.github.io/ecsr-promo/#/questionnaire/fin_stagiaire Merci d'avance !

### Retouche K : satisfaction dans les documents du centre

Le taux se calcule sur les avis notés (« Sans avis » exclu). La pièce « appréciations », la fiche des résultats et la
méthode publique disaient « répondants » et « sous 5 réponses », alors que cinq réponses dont une « Sans avis » ne donnent
pas de taux.

Avant :

> 80 % de réponses favorables (7 répondants sur 10 inscrits) ; sous le seuil : « moins de 5 réponses » ; méthode publique : « Aucun résultat n'est publié sous 5 réponses. »

Après :

> 80 % de réponses favorables (7 avis notés sur 10 inscrits) ; sous le seuil : « moins de 5 avis notés » ; méthode publique : « Aucun résultat n'est publié sous 5 avis notés. »

## 6. Message WhatsApp prêt à coller (promo de Nîmes, à envoyer à l'ouverture)

Proposition, à valider avec le reste (point 10 pour un message aux formateurs) :

> Bonjour à tous ! La formation touche à sa fin et votre avis compte. Un court questionnaire vous attend dans l'app, sur l'Accueil : une dizaine de questions sur la formation, environ trois minutes. Chaque réponse est enregistrée sans nom, sans compte et sans date ; dans l'app, personne ne peut voir qui a répondu quoi, et les résultats ne s'affichent qu'à partir de 5 réponses. Le lien direct : https://watchi64.github.io/ecsr-promo/#/questionnaire/fin_stagiaire Merci d'avance !

## 7. Retouches pour la conservation à trois ans (09/11)

Le plan du lot Q5 (`docs/superpowers/plans/2026-11-09-qualiopi-q5-conservation.md`, branche `qualiopi-q4-q5-plans`,
tableau (b)) a relevé cinq phrases de la version 2026-11-08 qui deviendraient fausses une fois la conservation construite.
Corrigées maintenant, pendant que la version n'est pas en ligne, elles évitent une version suivante et donc une seconde
acceptation par chaque compte (question 4 du plan Q5, arbitrée « oui » le 09/11 par délégation de Timy, révisable). Une
sixième retouche aligne la ligne du registre qualité sur le plan du lot Q4. Elles sont dans `js/legal-data.js` et
vérifiées par `tests/questionnaires-data.test.mjs`. Les passages des sections 2 à 5 ci-dessus gardent leur ancienne
formulation : la section 7 l'emporte.

### Retouche L : l'essentiel, ligne 7 (passage 2)

Avant :

> Douze mois après la formation, les comptes et les textes libres disparaissent ; […]

Après (les commentaires des formateurs aux questionnaires vivent jusqu'au 31 décembre de l'année suivante, jusqu'à 24 mois) :

> Douze mois après la formation, les comptes et les textes libres des stagiaires disparaissent ; […]

### Retouche M : émargement dans les données enregistrées (section 3) et dans « Qui voit quoi » (section 4)

Avant : l'émargement n'était cité que dans les durées (section 10).

Après, une ligne neuve dans chaque tableau :

> | Émargement | Feuilles de présence de chaque demi-journée : votre signature dessinée, son heure, le compte qui l'a posée, présence ou absence, observation éventuelle du formateur ; signature et nom des formateurs |

> | Feuilles d'émargement | Oui, votre ligne | Non | Oui | Oui |

À vérifier par Timy : la colonne ECF. La base ne laisse lire une ligne qu'aux formateurs et au stagiaire concerné ; « Oui »
traduit la remise des feuilles par ECF à son certificateur et à ses financeurs (section 5), comme pour le livret.

### Retouche N : la phrase des trois ans (section 10, passage 9)

Avant :

> Aucune donnée nominative n'est gardée plus de trois ans après la fin de la formation. Un stagiaire qui quitte la formation en cours de route est traité de la même façon, à compter de son départ.

Après :

> Aucune donnée nominative n'est gardée au-delà du 31 décembre de la troisième année après la fin de la formation. Chaque effacement est fait dans le mois qui suit la date indiquée. Un stagiaire qui quitte la formation en cours de route est traité de la même façon, à compter de la fin de sa promo.

Pourquoi : la règle du 31 décembre garde jusqu'à près de quatre ans (3 ans et 20 jours pour Nîmes mars 2026) ; aucun
effacement ne part tout seul, chacun attend un clic du fondateur, d'où le mois de marge (question 10 du plan Q5) ; l'app
n'enregistre pas la date de départ d'un stagiaire, elle compte depuis la fin de sa promo.

### Retouche O : la note de participation (section 10, ligne des questionnaires, retouche H)

Avant :

> […] La note de participation est supprimée avec le compte |

Après (le compte d'un formateur n'est jamais supprimé ; celle d'un stagiaire est aussi rattachée à sa fiche, pour refuser
une deuxième réponse après un compte recréé) :

> […] La note de participation est supprimée douze mois après la fin de la formation (pour le questionnaire des formateurs, à la fin de l'année du questionnaire) |

### Retouche P : registre qualité (section 10, passage 8)

Avant :

> | Registre qualité du centre (réclamations, difficultés, aléas, améliorations, risques) | Trois ans après la clôture de l'entrée, puis sa description et sa réponse sont vidées ; le type, les dates et l'état restent |

Après (le plan du lot Q4 vide les quatre textes libres et garde aussi l'origine, la promo et le lieu) :

> | Registre qualité du centre (réclamations, difficultés, aléas, améliorations, risques) | Trois ans après la clôture de l'entrée, puis ses textes (description, réponse, action décidée, mesure de prévention) sont vidés ; le type, l'origine, la promo, le lieu, les dates et l'état restent |
