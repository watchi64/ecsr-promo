# Certificat de réalisation et attestation d'assiduité : conception

Date : 24/10/2026. Demande : session « Attestations » lancée par la session de préparation du
rendez-vous ECF (semaine du 26/10/2026), suite annoncée au § 9 de la spec de l'émargement
(`2026-10-23-emargement-design.md`). Choix validés par Timy au cadrage ; les points marqués
« choix du rédacteur » sont les siens à relire.

## 1. Intention

Tirer des feuilles d'émargement signées, pour chaque stagiaire, les deux pièces que réclament
les financeurs et un auditeur Qualiopi (critère 3, indicateur 11 : assiduité) : le certificat de
réalisation au modèle du ministère du Travail et une attestation d'assiduité détaillée. Personne
ne les réclame encore (réponse de Timy) : l'enjeu immédiat est la démonstration sur la promo 7,
mais les pièces doivent tenir devant un vrai financeur.

Ce qui compte :

- aucun chiffre saisi à la main : tout vient des feuilles closes, et chaque heure se retrouve
  sur une feuille datée ;
- le certificat reprend le modèle officiel mot pour mot, sans rien inventer ;
- le formateur sort une pièce en deux gestes, ou celles de toute la promo d'un coup.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

1. Par stagiaire et pour une période choisie : heures prévues, réalisées, d'absence, taux.
2. Certificat de réalisation A4 au modèle officiel, imprimable (PDF par le navigateur).
3. Attestation d'assiduité A4 : résumé, détail par semaine, liste des absences et des notes.
4. Impression une à une ou pour toute la promo (tous les certificats, toutes les attestations).
5. Cloisonné par promo comme le reste ; aucune écriture en base hors un réglage d'en-tête.

**Non-objectifs (v1)**

- Retards et départs anticipés retranchés : une demi-journée signée compte en entier (décision
  de Timy du 24/10) ; la note reste visible dans l'attestation.
- Heures de stage en entreprise et heures prévues par une convention : pas de feuille, pas de
  chiffre (l'attestation le dit).
- Signature dessinée du responsable ou cachet numérique : le cadre reste vide, il se signe et se
  tamponne sur le papier imprimé.
- Envoi aux financeurs, archivage des pièces émises, numérotation.
- Pièces visibles des stagiaires.

**Anti-objectifs**

- Un chiffre qui ne se retrouve pas sur une feuille, ou qui compte une feuille encore ouverte.
- Un champ du certificat rempli par supposition (employeur, civilité, signataire).
- Des heures d'une autre promo.
- Une page lente ou bloquée sur une formation longue (des centaines de feuilles et leurs tracés).

## 3. Contraintes

Celles de l'émargement (spec du 23/10, § 3) : app sans build servie par GitHub Pages depuis
`main`, base de production unique (essais sur le banc seulement), multi-promo par
`promo_courante()`, formateur = `is_admin() or is_prof()`, pas de tiret cadratin, vérification
au navigateur à 375 px compris. L'interrupteur `emargement_actif` gouverne aussi cette page.

## 4. Ce qui est décidé

### 4.1 Modèle officiel du certificat (vérifié le 24/10)

Source : modèle « Certificat de réalisation » du ministère du Travail, version applicable au
1er juin 2020 (arrêté du 21 décembre 2018 pour le contrôle de service fait des OPCO). Le PDF
du ministère (`travail-emploi.gouv.fr/IMG/pdf/certificat_de_realisation.pdf`) est derrière un
contrôle anti-robot ; texte relevé sur la copie conforme publiée par l'OPCO Akto
(`akto.fr/modele_certificat_de_realisation-2/`). Texte à reprendre tel quel :

> CERTIFICAT DE REALISATION
> **Je soussigné(e)** *(prénom et nom)* … **représentant légal du dispensateur de l'action
> concourant au développement des compétences** *(raison sociale du dispensateur de formation ou
> de l'employeur en cas de formation interne)*, … **atteste que :**
> Mme/M. *(nom et prénom du bénéficiaire)* …
> salarié(e) de l'entreprise *(raison sociale)* …
> a suivi l'action *(intitulé)* …
> *Nature de l'action concourant au développement des compétences :*
> ☐ action de formation ¹ ☐ bilan de compétences ☐ action de VAE ☐ action de formation par
> apprentissage
> qui s'est déroulée du … au … *(dates)*
> pour une durée de … *(nombre d'heures réalisées ou, s'agissant d'une formation par
> apprentissage, nombre de mois réalisés)*. ²
> Sans préjudice des délais imposés par les règles fiscales, comptables ou commerciales, je
> m'engage à conserver l'ensemble des pièces justificatives qui ont permis d'établir le présent
> certificat pendant une durée de 3 ans à compter de la fin de l'année du dernier paiement. En
> cas de cofinancement des fonds européens la durée de conservation est étendue conformément aux
> obligations conventionnelles spécifiques.
> Fait à : … Le : …
> [Cadre] Cachet et signature du responsable du dispensateur de formation (nom, prénom, qualité
> du signataire)
> ¹ Lorsque l'action est mise en œuvre dans le cadre d'un projet de transition professionnelle,
> le certificat de réalisation doit être transmis mensuellement.
> ² Dans le cadre des formations à distance prendre en compte la réalisation des activités
> pédagogiques et le temps estimé pour les réaliser.

Mention du modèle : « A établir sur papier-en tête du dispensateur de formation ». Elle ne
s'imprime pas : elle dit où l'imprimer. Le logo du ministère ne s'imprime pas non plus.

Remplissage :

| Champ | Valeur |
|---|---|
| En-tête | Raison sociale de l'organisme, puis ses lignes d'adresse si renseignées (réglage) |
| Je soussigné(e) | Nom du signataire (réglage) ; pointillés s'il est vide |
| Raison sociale du dispensateur | Organisme de l'en-tête des feuilles |
| Mme/M. | Imprimé tel quel, suivi de NOM Prénom (aucune civilité devinée) |
| Salarié(e) de l'entreprise | Pointillés, à compléter à la main |
| A suivi l'action | Intitulé de l'en-tête des feuilles |
| Nature | « action de formation » cochée, les trois autres vides |
| Du … au … | Premier et dernier jour où ce stagiaire a **signé** une feuille close de la période (choix du rédacteur : ce sont les dates que les feuilles prouvent ; un stagiaire absent la première semaine ou parti avant la fin a ses propres dates) |
| Durée | Heures réalisées, écrites « 66 heures » ou « 66 heures 30 minutes » |
| Fait à | Lieu du réglage, sinon le lieu de la promo (Nîmes, Montpellier) (choix du rédacteur) |
| Le | Date du jour d'impression |
| Cadre | Nom et qualité du signataire s'ils sont renseignés, place libre pour cachet et signature |

Les mots en italique du modèle (consignes entre parenthèses) ne s'impriment pas quand le champ
est rempli ; ils restent sous les pointillés d'un champ vide, pour qu'il se complète à la main.

### 4.2 Calcul (module pur, testé en node)

Entrées : feuilles de la promo courante entre deux dates incluses, avec leurs lignes.

- Seules les feuilles **closes** comptent. Une feuille close est figée et porte une ligne par
  stagiaire de sa liste (la clôture pose « absent, non signé » sur les manquants).
- **Prévues** pour un stagiaire : durée (`fin - debut`) des feuilles closes où il a une ligne.
- **Réalisées** : durée des feuilles où sa ligne est signée (`signe_le` non nul ; la base
  garantit que tracé et heure vont ensemble).
- **Absences** : prévues moins réalisées. **Taux** : réalisées / prévues, arrondi à l'unité.
- **Par semaine** (lundi) : demi-journées prévues et signées, heures prévues et réalisées.
- **Absences et notes** : chaque ligne absente (date, demi-journée, créneau, durée, origine :
  « non signé », « noté au planning », « marqué par le formateur ») et chaque ligne signée qui
  porte une observation (« Arrivée à 9h40 »), avec cette observation.
- Feuilles **ouvertes** de la période : comptées à part et signalées (« 1 feuille encore
  ouverte, non comptée »), jamais additionnées.

Stagiaires listés : ceux qui ont au moins une ligne sur une feuille close de la période, actifs
ou non (un stagiaire parti a droit à son certificat pour ce qu'il a suivi), triés par nom.

Stagiaire sans aucune demi-journée signée sur la période (choix du rédacteur) : listé avec 0 h,
son bouton « Certificat » est désactivé (« aucune demi-journée signée ») et il est sauté par
« Tous les certificats » ; son attestation reste possible (elle montre 0 %).

Demi-journées sans feuille (choix du rédacteur) : le calcul ne lit que les feuilles, sans
croiser le planning. La page (pas les pièces) compte les demi-journées de semaine de la période,
hors jours fériés, qui n'ont aucune feuille, et l'écrit : « 12 demi-journées de la période sans
feuille d'émargement (stage, congés ou feuille oubliée) : non comptées ». L'attestation dit déjà
que les heures sans feuille ne sont pas comptées.

### 4.3 Page

- Adresse `#/emargement/attestations`, mêmes portes que la page Émargement (formateurs,
  interrupteur allumé). Accès : bouton « Attestations » dans la barre de la semaine.
- **Période** : deux dates (du, au). Par défaut, toute la formation : du début de la promo
  (`date_debut`) à aujourd'hui, ou à sa fin si elle est passée. Raccourcis : « Toute la
  formation » et un bouton par mois civil où il existe une feuille (certificat mensuel des
  projets de transition professionnelle).
- **Liste** : une ligne par stagiaire (nom, réalisées sur prévues, absences, taux) avec
  « Certificat » et « Attestation ». En tête : « Tous les certificats », « Toutes les
  attestations » (un document par page). Sur téléphone, les lignes deviennent des cartes.
- **Réglages de l'en-tête** : le dialogue « En-tête » de la page Émargement gagne quatre champs,
  tous facultatifs : adresse de l'organisme (deux lignes), signataire (prénom et nom), qualité du
  signataire, lieu « Fait à ». Même réglage `emargement_entete` (JSON), propre à la promo ;
  l'enregistrement garde les champs existants.
- Lecture **légère** : une requête dédiée sans les tracés (séances : id, jour, demi-journée,
  début, fin, statut ; lignes : stagiaire, signe_le, absent, absence_origine, observation,
  sur_appareil_formateur). Aucune signature n'est imprimée sur ces pièces.

### 4.4 Attestation d'assiduité (pas de modèle national)

A4 portrait, même en-tête d'organisme que le certificat. Contenu :

1. Titre « Attestation d'assiduité ».
2. Phrase : « Je soussigné(e) [signataire], [qualité], [organisme], atteste que [NOM Prénom] a
   suivi la formation [intitulé] (promotion [nom]), avec l'assiduité suivante, du [premier jour]
   au [dernier jour] de la période. » Les dates sont ici celles des feuilles closes où il figure
   (prévues), puisque l'attestation compte aussi les absences. (Pointillés pour un signataire
   vide.)
3. Résumé : heures prévues, réalisées, d'absence, taux d'assiduité ; demi-journées prévues et
   signées.
4. Tableau par semaine.
5. Tableau des absences et des notes (§ 4.2), ou « Aucune absence sur la période ».
6. Mention de source : « Établie à partir des [n] feuilles d'émargement closes de la période,
   signées dans l'application TP ECSR et horodatées par le serveur. Une demi-journée signée
   compte pour sa durée entière. Les heures sans feuille d'émargement (stage en entreprise) ne
   sont pas comptées. »
7. Fait à, le, cadre de signature (comme le certificat).

### 4.5 Impression

Mécanisme des feuilles (`imprimer` de `emargement-feuilles.js`, `bindDocPrint`), A4 portrait ;
plusieurs documents se suivent avec un saut de page entre chacun.

## 5. Laissé au constructeur

Découpage en modules, libellés exacts de la page, mise en page fine (typographie, marges) dans
le respect du texte officiel, détail du banc.

## 6. Vérification

- Règles de calcul en node (`tests/attestations-rules.test.mjs`) : feuille ouverte ignorée,
  absences par origine, observation sur ligne signée, semaines, période, autre promo exclue.
- Banc : les 20 feuilles de la promo de démonstration (7) exportées en lecture seule (sans
  tracés, signatures fictives refaites au banc) ; certificat et attestation d'un stagiaire tirés
  par un formateur, heures recomptées à la main sur ses feuilles (et par une requête SQL de
  lecture sur la base) ; « Tous les certificats » ; réglages d'en-tête ; 375 px sans débordement.

## 7. Mise en ligne

Aucune migration. Fusion dans `main` après mise à jour, poussée avec l'accord de Timy. Entrée
Nouveautés : voir § 8.

## 8. Nouveautés

Pas d'entrée (décision de Timy du 26/10, même logique que l'émargement du 23/10 : éteint pour les
vraies promos, une annonce sans bouton tromperait les formateurs). Texte prêt pour le jour où
l'émargement s'allume, à joindre à celui de l'émargement (pour : formateurs, lien
`emargement/attestations`) : « Certificats de réalisation et attestations d'assiduité. Depuis la
page Émargement, bouton Attestations : choisis une période, l'app compte pour chaque stagiaire
les heures prévues et réalisées d'après les feuilles closes, puis imprime le certificat de
réalisation au modèle du ministère du Travail et une attestation d'assiduité détaillée, un
stagiaire à la fois ou toute la promo. »
