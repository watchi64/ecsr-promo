# Questions QCM proposées par l'IA : design

Date : 23/10/2026. Demande : démo aux responsables du réseau ECF (semaine du 26/10), argument
« l'IA au service de l'humain ». Choix validés par Timy (« pars sur tes choix »).

## Intention

Le formateur gagne du temps pour enrichir un QCM de thème, sans rien céder sur ce qui fait la
valeur de l'app : un contenu vérifié. L'IA **propose**, le formateur **décide**. Une question
générée n'existe pour les stagiaires qu'une fois relue et acceptée, et elle garde la trace de
sa naissance (« proposée par l'IA, validée par X le JJ/MM »).

## Objectifs

- Dans l'éditeur QCM d'un thème : un bouton « Proposer avec l'IA ». Le formateur choisit le
  nombre de questions (1 à 5, 3 par défaut) et la partie du cours visée (tout le cours ou une
  section `##` / `###`).
- Une Edge Function `qcm-ia` lit le cours vérifié du thème (table `cours`, ligne `numero` du
  thème, `code` nul) et demande des brouillons à Mistral, au gabarit de la banque : énoncé,
  5 options (992 des 1 062 questions en ont 5), une ou plusieurs bonnes réponses, explication,
  renvoi à la partie du cours.
- Les brouillons vivent dans une table à part (`qcm_ia_brouillons`), lisible des seuls
  formateurs. Le formateur relit chaque brouillon dans le formulaire de question habituel,
  corrige, accepte ou rejette.
- Accepter passe par une fonction en base (`accepter_brouillon_ia`) qui crée la question, ses
  options et la trace en une seule transaction ; le nom du validateur est lu en base, pas
  fourni par le navigateur.
- La carte d'une question issue de l'IA porte dans l'éditeur la mention « IA · validée par X le
  JJ/MM ».

## Règle d'or (non négociable)

- Côté serveur, tout numéro d'article cité dans un brouillon (énoncé, options, explication) qui
  n'apparaît pas dans le texte du cours est un motif de **rejet** : le brouillon est gardé en
  base avec le statut `ecartee` et son motif, jamais proposé à l'acceptation. Le formateur voit
  « 1 brouillon écarté : cite R413-99, absent du cours ».
- Détection plus large que le verrou de l'assistant : le motif `R/L/D 123-4` de
  `verrou-articles.mjs`, plus « article(s) 221-6 » sans lettre (Code pénal) et « art. ».
- Au moment d'accepter, si le formateur a lui-même ajouté un article absent du cours, l'app le
  lui signale et demande confirmation (c'est lui le validateur, comme dans la saisie manuelle).
- Seul le texte du cours et les énoncés déjà présents dans le QCM (pour éviter les doublons)
  partent chez Mistral : aucun nom, aucune note, aucune donnée de stagiaire.

## Contraintes

- Fournisseur : Mistral seul (même clé `MISTRAL_API_KEY` que l'assistant, hébergement en
  Europe), aucun secours hors Europe. Modèle `QCM_IA_MODEL`, sinon `MISTRAL_MODEL`, sinon
  `mistral-medium-latest`. Appel non streamé, réponse JSON imposée.
- Accès réservé aux formateurs (`user_profiles.is_admin`), vérifié par la fonction.
- Quota : 10 demandes par jour et par formateur (fuseau Paris), consommé seulement une fois la
  demande validée, avant l'appel à Mistral. Une ligne `qcm_ia_quota_jour` dans `settings` le
  remplace ; la migration n'en pose pas, car la contrainte `settings_globaux_prevus` n'admet
  qu'une liste fermée de réglages sans promo. Une demande dont l'appel à Mistral échoue compte
  quand même (simplicité, comme l'assistant).
- Délais : 65 s par tentative, une relance, pour rester sous les 150 s d'une Edge Function.
- Aucun brouillon n'atteint `qcm_questions` sans acceptation : la RLS de `qcm_questions` ouvre
  la lecture à tout connecté, c'est pourquoi les brouillons ont leur propre table.
- Typographie : jamais de tiret cadratin ; le serveur le remplace s'il en reçoit un.
- Nouveautés : une entrée « formateurs » dans le commit de mise en ligne.

## Non-objectifs

- Pas de génération pour les cours de compétences (C1 à C4) ni pour les QCM transversaux.
- Pas d'images, pas de publication d'examen, pas de modification du cours.
- Pas de trace visible des stagiaires (elle n'apparaît que dans l'éditeur).

## Anti-objectifs

- Une question qui entre dans un QCM publié sans clic d'acceptation d'un formateur.
- Un numéro d'article inventé qui atteint l'écran d'acceptation.
- Une donnée de stagiaire envoyée à l'IA.

## Données

- `qcm_ia_brouillons` : `qcm_id`, `cours_id`, `demande_par_email`, `partie_visee`,
  `section`, `enonce`, `options` (jsonb `[{texte, is_correct}]`), `explication`,
  `partie_cours`, `statut` (`a_relire` | `acceptee` | `rejetee` | `ecartee`), `motif`,
  `question_id`, `traite_par_email`, `traite_le`, `modele`, `created_at`. RLS : lecture et mise
  à jour par `is_admin()`, aucune insertion côté client (la fonction écrit en service role).
- `qcm_questions` : `ia_brouillon_id`, `ia_validee_par` (nom affiché), `ia_validee_le`.
- `qcm_ia_usage` + `qcm_ia_consommer(uid, limite)` : copie du quota de l'assistant.

## Choix laissés au constructeur (et faits)

- Brouillons persistants plutôt qu'éphémères : fermer l'éditeur ne perd rien, et le journal
  (acceptés, rejetés, écartés) sert la démo.
- Le renvoi au cours : le modèle choisit un titre dans la liste des titres réels du cours ; un
  titre inconnu est retiré, sans rejeter le brouillon.
- 5 options plutôt que 4 : c'est le gabarit réel de la banque.
