# Fenêtre d'ouverture des examens QCM : design

> Spec validée le 2026-08-01. Branche `examen-fenetre`, worktree `TP_ECSR_App-wt-examen-fenetre`.

## Le besoin

Un stagiaire ne doit pas pouvoir passer un examen quand il le décide. Il s'entraîne librement,
et il ne passe l'examen que **lorsqu'un formateur l'ouvre, pour une durée limitée**.

## Ce qui a été constaté le 2026-08-01

Trois problèmes distincts, dont deux déjà corrigés.

**1. `published` portait deux sens (corrigé le 31/07 à 23h13).** Le drapeau signifiait à la fois
« la promo peut lire ce QCM » et « l'examen est ouvert ». Ouvrir les QCM à la promo ouvrait donc
mécaniquement les 65 examens. La migration `qcm_lecture_independante_de_la_publication` a détaché
la lecture : `qcm`, `qcm_questions` et `qcm_options` sont désormais lisibles par tout utilisateur
connecté (`qual: true`), et l'entraînement ne dépend plus de `published`.

**2. Les 65 examens n'avaient pas été refermés (corrigé le 01/08).** Le commit `05239d7` annonçait
« les 65 examens sont refermés », mais aucune donnée n'avait bougé : `updated_at` le plus récent
de la table `qcm` datait du 28/07, et les 65 lignes étaient toujours à `published = true`. Tous
les stagiaires voyaient donc « Passer l'examen » sur les 57 thèmes. Corrigé par un `update`.

**3. Aucun contrôle côté serveur (garde-fou temporaire posé le 01/08, à remplacer par cette spec).**
La politique `qcm_attempts_insert_own` ne vérifiait que le `stagiaire_id`. Ni le `mode`, ni l'état
du QCM visé. Un stagiaire pouvait insérer une tentative `mode = 'examen'` **sur n'importe quel
QCM, ouvert ou fermé**, en dehors de l'interface. Et le trigger `mirror_exam_to_evaluations`
(SECURITY DEFINER) transforme toute tentative d'examen en **note officielle dans `evaluations`**,
type « Thème », observation « QCM examen ». Autrement dit, chacun pouvait se noter lui-même sur
les 57 thèmes.

Aucune tentative en mode examen n'a jamais été enregistrée : le problème n'a pas été exploité,
il n'y a rien à réparer dans les données.

Le garde-fou du 01/08 (`qcm_attempts_bloquer_examen_libre`) interdit purement et simplement toute
tentative d'examen par un non-admin. **Cette spec le remplace** par la règle de fenêtre : tant
qu'il est en place, aucun examen n'est passable, même ouvert par un formateur.

### La leçon

Le contrôle vivait uniquement dans le JavaScript. Une garde d'affichage n'est pas un contrôle
d'accès : elle décide de ce qu'on montre, pas de ce qu'on autorise. Toute règle qui protège une
note doit être exprimée en base.

## Décisions

| Question | Décision |
|---|---|
| Portée de l'ouverture | Un QCM, pour toute la promo. Pas d'ouverture ciblée par stagiaire |
| Fermeture | Le formateur ouvre en choisissant une durée, ferme à la main quand il veut, et la durée referme toute seule |
| Durée sans limite | Possible (le formateur devra refermer lui-même) |
| Qui ouvre | `is_admin() OR is_prof()` |
| Passe en cours à la fermeture | La fenêtre gouverne le **démarrage**, pas la remise. Marge calculée sur le chrono du QCM |
| Autorité | La base. Le JavaScript ne fait que de l'affichage |

### Pourquoi pas d'ouverture ciblée par stagiaire

La règle « une seule passe » existe déjà : un stagiaire qui a passé l'examen tombe sur l'écran
« Tu as déjà passé cet examen », et seul un formateur peut réinitialiser sa tentative. Rouvrir le
thème 8 la semaine suivante pour un absent **ne permet donc pas aux autres de le repasser**. Une
ouverture par liste de stagiaires serait de la complexité sans contrepartie.

### Pourquoi la fenêtre ne gouverne que le démarrage

Un formateur ouvre 30 minutes, un stagiaire lance l'examen à la 29e minute. Le chrono tourne, la
fenêtre se referme, il remet sa copie et la base la rejette : il perd son travail sans avoir rien
fait de mal. La tolérance de remise se calcule à partir du chrono du QCM lui-même, donc elle est
exacte et ne demande aucune colonne supplémentaire :

```
tolérance = exam_ferme_a + (nombre de questions de l'examen × exam_seconds_per_question)
```

Personne ne peut démarrer après la fermeture. Quiconque a démarré à temps peut finir.

## Modèle de données

**Une seule colonne ajoutée** sur `qcm` :

| Colonne | Type | Sens |
|---|---|---|
| `exam_ferme_a` | `timestamptz` nul | Échéance de fermeture. Nul = pas d'échéance, fermeture manuelle uniquement |

`published` conserve son rôle actuel d'interrupteur « examen ouvert », tel que le commit `05239d7`
l'a redéfini.

> ⚠️ **Le nom `published` ment.** Il ne dit plus « publié » mais « examen ouvert ». La lecture des
> QCM et l'entraînement n'en dépendent plus depuis le 31/07. Renommer la colonne toucherait le
> code et plusieurs politiques pour un gain cosmétique, donc on ne le fait pas ici, mais c'est
> exactement l'ambiguïté qui a produit l'incident du 31/07. Quiconque lit cette table doit le
> savoir.

**Prédicat d'ouverture** : `published AND (exam_ferme_a IS NULL OR now() < exam_ferme_a)`.

Un examen refermé à la main remet `published` à faux et `exam_ferme_a` à nul, pour que l'état ne
garde pas d'échéance fantôme.

## Contrôle en base

Deux fonctions `STABLE`, dans le schéma public :

- `qcm_exam_demarrable(p_qcm_id)` : le prédicat d'ouverture ci-dessus.
- `qcm_exam_remise_toleree(p_qcm_id)` : ouverture, ou fenêtre expirée depuis moins que le budget
  chrono de la passe. Le nombre de questions vient de `exam_question_ids` s'il est gelé, sinon du
  décompte des questions du QCM.

La politique d'insertion des tentatives remplace le garde-fou temporaire :

```sql
create policy qcm_attempts_insert_own on public.qcm_attempts
for insert to authenticated
with check (
  stagiaire_id = my_stagiaire_id()
  and (
    mode = 'entrainement'
    or (mode = 'examen' and qcm_exam_remise_toleree(qcm_id))
  )
);
```

L'entraînement reste libre et illimité, sans condition.

**Ouverture et fermeture** : une politique `UPDATE` sur `qcm` en `is_admin() OR is_prof()`.
Aujourd'hui les 3 formateurs ont `is_admin = true`, donc ça ne change rien dans l'immédiat ; c'est
une correction de principe, pour qu'un formateur ajouté sans le drapeau admin ne se retrouve pas
devant un bouton sans effet.

## Interface

### Formateur

Dans le panneau « Examen (formateur) » déjà présent sur la fiche du QCM :

- Fermé : bouton **« Ouvrir l'examen »**, qui demande la durée (30 minutes, 1 heure, 2 heures,
  jusqu'à ce soir, sans limite).
- Ouvert : bandeau **« Examen ouvert, ferme à 11h30 »** (ou « sans limite ») et bouton
  **« Fermer maintenant »**.

Dans la liste des thèmes, une pastille **« Examen ouvert »** sur la cellule QCM, pour repérer d'un
coup d'œil ce qui est ouvert sans entrer dans chaque fiche. C'est le filet contre l'oubli quand
l'ouverture est sans limite.

### Stagiaire

- Fermé : **pas de bouton**, une ligne discrète « L'examen s'ouvre quand un formateur le décide. »
  Un bouton grisé n'apporte rien, il invite à cliquer pour rien.
- Ouvert : le bouton **« Passer l'examen »** avec le temps restant.
- Déjà passé : l'écran existant, inchangé.

Le libellé « L'entraînement, lui, est illimité » posé par le commit `05239d7` est conservé : c'est
le message important pour un stagiaire qui trouve porte close.

## Découpage

| Fichier | Rôle |
|---|---|
| `js/qcm-exam-rules.js` | État d'ouverture et budget chrono, fonctions pures recevant `now` en argument |
| `tests/qcm-exam-rules.test.mjs` | Test Node, sur le modèle de `passage-rules.test.mjs` |
| `js/views/themes.js` | Panneau formateur (ouvrir avec durée, fermer, bandeau), pastille dans la liste, bloc stagiaire conditionnel |
| `js/views/qcm.js` | Garde au démarrage de l'examen, message clair si la fenêtre s'est refermée entre-temps |
| `js/db.js` | Ouverture et fermeture d'un examen |

La règle existe donc en deux endroits, SQL et JavaScript. Ce n'est pas une duplication accidentelle
mais une redondance assumée : **la base est l'autorité**, le JavaScript ne sert qu'à ne pas
proposer un bouton qui échouerait. Le test verrouille la version JavaScript.

## Pièges identifiés

**L'horloge du navigateur peut être fausse.** Le temps restant affiché est indicatif : la base
tranche à la remise. Un téléphone qui avance de dix minutes montrera un compte à rebours faux,
mais son porteur ne sera ni bloqué à tort ni autorisé à tort, puisque la décision ne dépend pas
de lui.

**La fenêtre peut se refermer pendant qu'une fiche est ouverte.** L'état est relu au démarrage de
l'examen, pas seulement au rendu de la fiche. Sinon un stagiaire ayant laissé la modale ouverte
démarrerait après la fermeture et se ferait rejeter à la remise, après avoir tout composé.

**Le garde-fou temporaire doit être retiré dans la même migration** que l'ajout de la nouvelle
politique. Tant qu'il est là, aucun examen n'est passable même ouvert. C'est la première chose à
vérifier si « ça ne marche pas » après déploiement.

**Cache-bust** : ne pas lancer `scripts/cache-bust.js` sur cette branche. Les imports des nouveaux
fichiers portent le token courant écrit à la main, le re-versionnage se fait au merge sur `main`.

## Vérification

1. `node tests/qcm-exam-rules.test.mjs` : fermé, ouvert sans limite, ouvert avec échéance future,
   échéance passée, échéance passée mais dans la marge de remise, marge dépassée, QCM à
   `exam_question_ids` gelé et non gelé.
2. En base, sous un vrai compte stagiaire (pas l'aperçu, qui ne simule pas la RLS) : tentative
   d'insertion d'une tentative `mode = 'examen'` sur un QCM fermé, doit être refusée ; sur un QCM
   ouvert, doit passer. C'est le test qui compte, celui qui manquait.
3. Interface : ouvrir un examen 30 minutes sur un thème, vérifier l'apparition du bouton côté
   stagiaire et de la pastille dans la liste, fermer, vérifier la disparition.
4. App réelle **en navigation privée** (sur une branche de feature le token `?v=` n'est pas
   re-versionné, le navigateur resert l'ancien JS et l'ancien CSS).

## Hors périmètre

- Renommage de `published`.
- Ouverture ciblée par stagiaire.
- Ouverture programmée à l'avance (date et heure posées la veille).
- Notification à la promo quand un examen s'ouvre. Le formateur annonce en salle.
- Refonte de la réinitialisation d'une tentative, qui existe déjà et ne change pas.
