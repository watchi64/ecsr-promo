# Multi-promo : plan d'implémentation

> **Pour les agents :** sous-skill requis : `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases
> à cocher (`- [ ]`).

**But :** loger la promo « Nîmes, septembre 2026 » dans la même base que « Nîmes, mars 2026 »,
cloisonnée par la base elle-même, sans aucune régression pour mars ; ouvrir l'app aux formateurs,
puis, après la livraison du chantier B (modules), aux 8 stagiaires.

**Architecture :** la promo voyage avec chaque requête de données (en-tête `x-promo-id`) ; des
fonctions SQL (`promo_courante`, `lieu_courant`, `mes_promos`, `peut_acceder_promo`) vérifient le
droit ; chaque table propre à une promo (ou à un lieu) porte sa colonne et sa règle d'accès ; l'app
ne change que son point d'entrée réseau et ses lectures dans `js/db.js`, sa connexion, une pastille
de choix et quelques écrans.

**Tech :** PostgreSQL 17 (Supabase `crpduennbqaemhfaywrz`, migrations par l'outil MCP
`apply_migration`), PostgREST, JS vanilla en modules ES, tests `node` sans dépendance, banc d'essai
à import map.

**Spec :** `docs/superpowers/specs/2026-10-01-multi-promo-design.md` (référence pour toute
question de fond).

## Contraintes globales

- Worktree `C:/Users/watch/Dev/ecsr-promo-multi-promo`, branche `multi-promo`. Les commandes `git`
  et `node` s'y lancent (`cd /c/Users/watch/Dev/ecsr-promo-multi-promo && ...`) ; Write et Edit
  prennent des chemins absolus de ce dossier. `C:/Users/watch/Dev/ECSR/TP_ECSR_App` reste sur
  `main` : aucune édition de fichier, aucun checkout ; seule la fusion finale (Tâche 15) y lance
  des commandes `git`.
- Base de prod : migrations **uniquement** par `apply_migration` (`project_id =
  crpduennbqaemhfaywrz`), le texte passé étant celui du fichier versionné. `execute_sql` ne sert
  qu'à lire, vérifier ou répéter dans une transaction annulée. Annoncer à Timy chaque migration de
  prod avant de l'appliquer, rendre compte après.
- Dépôt public : aucune donnée personnelle (nom, email, téléphone) dans un fichier versionné ni
  dans un message de commit. Les scripts SQL choisissent leurs personnages par requête.
- Aucun tiret cadratin (U+2014) nulle part. Avant chaque commit :
  `grep -rn $'\xe2\x80\x94' <fichiers du commit>` doit être vide.
- Français partout (code, commentaires, libellés, commits). « Formateur », jamais « Prof », dans un
  libellé visible.
- Jeton de cache : tout nouvel import relatif porte le jeton déjà présent sur la branche
  (`?v=20261002b` au 02/10, après la livraison du chantier B ; le relever par
  `grep -o 'v=2026[0-9]*[a-z]' index.html | head -1`).
  Ne jamais lancer `scripts/cache-bust.js` sur la branche, ne jamais le piper : le hook
  re-tokenise à la fusion dans `main`.
- Nouveau bloc CSS : en FIN de `css/style.css`.
- Toute écriture atteignable par un stagiaire reste gardée côté client (`isAdmin()`) ou passe par
  une RPC ; un nouveau contrôle d'édition rejoint le groupe `.read-only` (la pastille n'en est pas
  un).
- Vérification dans le navigateur (banc) avant d'annoncer un résultat.
- Commits en français, terminés par la ligne `Co-Authored-By: Claude Opus 5.5
  <noreply@anthropic.com>`. Toujours `git add <fichiers précis>`, jamais `git add -A` (des fichiers
  de banc non versionnés traînent dans le worktree). La poussée (`git push origin main`) est le
  geste de Timy : la proposer, jamais la faire.
- Tests `node` : `node tests/<nom>.test.mjs` (scripts `assert`, ils affichent « ... OK »).
- Fichiers de travail (lots SQL composés) : dans le dossier scratchpad de la session, noté
  `$SCRATCH` ci-dessous (`SCRATCH=<chemin du scratchpad indiqué par la session>` avant les
  commandes), jamais dans le dépôt.
- Un script SQL de vérification se termine TOUJOURS par une exception : elle annule tout et porte le
  verdict. `execute_sql` renvoie donc une erreur dont le message commence par `VERDICT VERT` (succès)
  ou `VERDICT ROUGE` (liste des échecs). Toute autre erreur est un échec du script lui-même.

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261001_multi_promo_1_fondations.sql` (+ `_retour.sql`) | Étape 1 : lieux, promos, colonnes, fonctions de contexte, nouvelles tables, synchronisation |
| `supabase/migrations/20261001_multi_promo_2_cloisonnement.sql` (+ `_retour.sql`) | Étape 2 : règles d'accès et fonctions serveur par promo et par lieu |
| `supabase/migrations/20261001_multi_promo_3_bascule.sql` (+ `_retour.sql`) | Étape 3 : suppression des anciennes unicités |
| `supabase/migrations/20261001_multi_promo_5_menage.sql` | Étape 5 : suppression des anciennes colonnes et de la synchronisation |
| `tests/sql/multi-promo-1-verif.sql` | Vérification de l'étape 1 |
| `tests/sql/multi-promo-photo.sql` | Photo « avant » pour la non-régression (répétition de l'étape 2) |
| `tests/sql/multi-promo-preuve.sql` | Preuve du cloisonnement, rejouable |
| `scripts/verifier-embarquements.mjs` | Contrôle que les jointures PostgREST de l'app se résolvent |
| `js/promo-rules.js`, `tests/promo-rules.test.mjs` | Règles pures du multi-promo |
| `js/promo-pastille.js` | Pastille et choix de la promo |
| `js/db.js` | Contexte de promo, en-tête, profil effectif, lectures et écritures par promo |
| `js/auth-admin.js` | Démarrage (promos avant toute lecture), pastille dans la barre |
| `js/nouveautes.js`, `tests/nouveautes.test.mjs`, `js/modules-etat.js`, `js/modules-data.js` | Amorce des Nouveautés par promo ; suites du chantier B (clé de copie de l'état des modules propre à la promo, réglage des modules ouvert aux formateurs) |
| `js/nouveautes-data.js` | Entrée « formateurs » |
| `js/views/planning.js` | La bascule attend les enregistrements en cours |
| `js/views/config.js` | Nom et lieu de la promo, nom de famille des stagiaires |
| `js/views/benevoles.js` | Lieu dans le titre, venues des autres promos |
| `css/style.css` | Styles de la pastille et du choix |
| `PROJECT_NOTES.md` | Section multi-promo |
| Non versionnés : `_harness_supabase.js`, `_harness_build.mjs`, `_harness.html`, `.claude/launch.json` (exclus par `.git/info/exclude`), `_mesure_topbar.html` (non suivi, supprimé en fin de Tâche 13) | Banc d'essai |

---

# Partie A : la base (étapes 1 et 2)

### Tâche 1 : Étape 1 (fondations), écrire et répéter

**Fichiers :**
- Créer : `tests/sql/multi-promo-1-verif.sql`
- Créer : `supabase/migrations/20261001_multi_promo_1_fondations.sql`
- Créer : `supabase/migrations/20261001_multi_promo_1_fondations_retour.sql`

**Interfaces :**
- Consomme : rien.
- Produit : tables `public.lieux (id, nom, created_at)`, `public.promos (id, lieu_id, nom,
  date_debut, date_fin, created_at)`, `public.themes_progression`, `public.qcm_examens` ; colonnes
  `promo_id` et `lieu_id` ; fonctions `peut_acceder_promo(integer) → boolean`,
  `promo_par_defaut() → integer`, `promo_courante() → integer`, `lieu_courant() → integer`,
  `mes_promos() → table (id, nom, lieu_id, lieu_nom, date_debut, date_fin, par_defaut,
  stagiaire_id)`, `diag_entete_promo() → text` (sonde, supprimée à l'étape 2).

- [ ] **Étape 1 : sonder l'atomicité des lots de `execute_sql`**

Lancer avec `execute_sql` :

```sql
begin;
create table public.zz_sonde_atomicite (x integer);
select 1 / 0;
```

Puis, dans un second appel : `select to_regclass('public.zz_sonde_atomicite') is null as atomique;`

Attendu : `atomique = true` (l'erreur a tout annulé). Si `false` : lancer
`drop table public.zz_sonde_atomicite;`, ne PAS faire les répétitions des étapes 5 de cette tâche
et 2 de la Tâche 4, et signaler à Timy que les migrations seront appliquées directement, chacune
suivie de sa vérification, la migration retour étant prête.

- [ ] **Étape 2 : écrire le test qui doit échouer, `tests/sql/multi-promo-1-verif.sql`**

```sql
-- Vérification de l'étape 1 du multi-promo (fondations).
-- Ne laisse AUCUNE trace : le bloc final lève toujours une exception, qui annule les
-- écritures de test et porte le verdict (« VERDICT VERT » attendu).
-- Personnages choisis par requête : aucun email écrit ici (dépôt public).

create temp table if not exists verif (libelle text, ok boolean, detail text);
truncate verif;

create or replace function pg_temp.ok(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into verif values (p_libelle, coalesce(p_ok, false), coalesce(p_detail, ''));
$f$;

-- Pose le jeton et l'en-tête d'un personnage, sans changer de rôle : on teste ici les
-- fonctions et les défauts, pas encore les règles d'accès.
create or replace function pg_temp.contexte(p_email text, p_entete text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then ''
         else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_entete is null then ''
         else json_build_object('x-promo-id', p_entete)::text end, true);
end $f$;

do $verif$
declare
  v_stag1 text; v_form text; v_fond text; v_sid1 integer; v_sid_fond integer;
  v_table text; n bigint; m bigint; v_int integer; v_txt text; v_bool boolean;
  v_theme integer; v_theme2 integer; v_qcm bigint; v_ae integer;
  v_total integer; v_ko integer; v_liste text;
begin
  select up.email, s.id into v_stag1, v_sid1
    from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email, stagiaire_id into v_fond, v_sid_fond from user_profiles where is_founder order by email limit 1;
  perform pg_temp.ok('personnages trouvés', v_stag1 is not null and v_form is not null and v_fond is not null);

  -- 1. Les lignes existantes sont rattachées à mars (promo 1) et à Nîmes (lieu 1)
  foreach v_table in array array['stagiaires','evaluations','evaluations_audit','passages',
      'passages_audit','planning_entries','planning_half_meta','planning_jours_off','agenda_events',
      'qcm_attempts','epcf_evaluations','epcf_livrets','dp_dossiers','fiches_suivi'] loop
    execute format('select count(*), count(*) filter (where promo_id = 1) from public.%I', v_table) into n, m;
    perform pg_temp.ok('rattachement à mars : ' || v_table, n = m, n || ' lignes dont ' || m || ' en promo 1');
  end loop;
  -- Réglages : les trois clés globales sans promo, toutes les autres en mars (y compris une
  -- éventuelle clé « modules » posée avant la migration, cf. chantier B).
  select count(*) filter (where promo_id is null),
         count(*) filter (where promo_id is distinct from 1
                            and key not in ('chatbot_quota_jour', 'cohort_name', 'password_hash'))
    into n, m from settings;
  perform pg_temp.ok('réglages : 3 globaux, tous les autres en mars', n = 3 and m = 0,
    n || ' globaux, ' || m || ' hors mars');
  select count(*) into n from settings
   where promo_id is null and key not in ('chatbot_quota_jour', 'cohort_name', 'password_hash');
  perform pg_temp.ok('réglages globaux : seulement les trois prévus', n = 0, n || ' en trop');
  foreach v_table in array array['benevoles','auto_ecoles','benevole_suivi'] loop
    execute format('select count(*), count(*) filter (where lieu_id = 1) from public.%I', v_table) into n, m;
    perform pg_temp.ok('rattachement à Nîmes : ' || v_table, n = m, n || ' lignes dont ' || m || ' à Nîmes');
  end loop;
  select count(*) into n from promos where lieu_id = 1;
  perform pg_temp.ok('deux promos, à Nîmes', n = 2 and (select count(*) from promos) = 2, n || ' promo(s) à Nîmes');

  -- 2. Copies fidèles de la progression et de l'état des examens
  select count(*) into n from themes t
    left join themes_progression p on p.theme_id = t.id and p.promo_id = 1
   where p.theme_id is null or p.statut is distinct from t.statut
      or p.date_fait is distinct from t.date_fait or p.date_qcm is distinct from t.date_qcm
      or p.notes is distinct from t.notes or p.updated_by_email is distinct from t.updated_by_email;
  perform pg_temp.ok('progression de mars copiée à l''identique', n = 0, n || ' écart(s)');
  select count(*) into n from qcm q
    left join qcm_examens e on e.qcm_id = q.id and e.promo_id = 1
   where e.qcm_id is null or e.published is distinct from q.published
      or e.published_by_email is distinct from q.published_by_email
      or e.published_at is distinct from q.published_at
      or e.exam_nb_questions is distinct from q.exam_nb_questions
      or e.exam_question_ids is distinct from q.exam_question_ids
      or e.exam_draw_mode is distinct from q.exam_draw_mode
      or e.exam_seconds_per_question is distinct from q.exam_seconds_per_question
      or e.exam_ferme_a is distinct from q.exam_ferme_a;
  perform pg_temp.ok('examens de mars copiés à l''identique', n = 0, n || ' écart(s)');

  -- 3. Fonctions de contexte
  perform pg_temp.contexte(v_stag1, null);
  perform pg_temp.ok('stagiaire sans en-tête : mars', promo_courante() = 1, coalesce(promo_courante()::text, 'nul'));
  select count(*), bool_and(par_defaut), max(stagiaire_id) into n, v_bool, v_int from mes_promos();
  perform pg_temp.ok('stagiaire : une seule promo, la sienne, avec sa fiche', n = 1 and v_bool and v_int = v_sid1,
    n || ' promo(s), fiche ' || coalesce(v_int::text, 'nulle'));
  perform pg_temp.contexte(v_stag1, '1');
  perform pg_temp.ok('stagiaire en-tête 1 : mars', promo_courante() = 1, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_stag1, '2');
  perform pg_temp.ok('stagiaire en-tête 2 : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_form, null);
  perform pg_temp.ok('formateur sans en-tête : mars, plus ancienne en cours', promo_courante() = 1,
    coalesce(promo_courante()::text, 'nul'));
  select count(*), max(id) filter (where par_defaut), count(*) filter (where stagiaire_id is not null)
    into n, v_int, m from mes_promos();
  perform pg_temp.ok('formateur : deux promos, mars par défaut, aucune fiche', n = 2 and v_int = 1 and m = 0,
    n || ' promo(s), défaut ' || coalesce(v_int::text, 'nul'));
  perform pg_temp.contexte(v_form, '2');
  perform pg_temp.ok('formateur en-tête 2 : septembre', promo_courante() = 2, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.ok('formateur en-tête 2 : lieu Nîmes', lieu_courant() = 1, coalesce(lieu_courant()::text, 'nul'));
  perform pg_temp.contexte(v_form, 'abc');
  perform pg_temp.ok('en-tête fantaisiste : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_form, '99');
  perform pg_temp.ok('promo inexistante : rien', promo_courante() is null, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(v_fond, null);
  perform pg_temp.ok('fondateur sans en-tête : mars, sa fiche', promo_courante() = 1,
    coalesce(promo_courante()::text, 'nul'));
  select count(*), max(stagiaire_id) filter (where id = 1), count(*) filter (where id = 2 and stagiaire_id is null)
    into n, v_int, m from mes_promos();
  perform pg_temp.ok('fondateur : deux promos, fiche en mars seulement', n = 2 and v_int = v_sid_fond and m = 1,
    n || ' promo(s)');
  perform pg_temp.contexte(v_fond, '2');
  perform pg_temp.ok('fondateur en-tête 2 : septembre', promo_courante() = 2, coalesce(promo_courante()::text, 'nul'));
  perform pg_temp.contexte(null, null);
  perform pg_temp.ok('visiteur : aucune promo', promo_courante() is null and (select count(*) from mes_promos()) = 0);
  perform pg_temp.contexte(null, '1');
  perform pg_temp.ok('visiteur en-tête 1 : rien', promo_courante() is null);

  -- 4. Valeurs par défaut et triggers (chaque écriture est annulée par son sous-bloc)
  begin
    perform pg_temp.contexte(v_form, '2');
    insert into planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite)
      values ('2030-01-07', 0, 'matin', 0, 0, 'Cours') returning promo_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('défaut : carte ajoutée en contexte septembre, rangée en septembre', v_txt = 'sentinelle:2', v_txt);

  begin
    perform pg_temp.contexte(v_form, '2');
    insert into evaluations (stagiaire_id, type, theme_numero, note, promo_id)
      values (v_sid1, 'Thème', 1, 10, 2) returning promo_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('trigger : la note d''un stagiaire de mars reste en mars', v_txt = 'sentinelle:1', v_txt);

  begin
    perform pg_temp.contexte(v_form, '2');
    insert into benevoles (prenom) values ('Verif') returning lieu_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('défaut : bénévole créé depuis septembre, banque de Nîmes', v_txt = 'sentinelle:1', v_txt);

  begin
    insert into auto_ecoles (nom, lieu_id) values ('Verif Montpellier', 2) returning id into v_ae;
    insert into benevoles (prenom, lieu_id, auto_ecole_id) values ('Verif', 1, v_ae);
    raise exception 'sentinelle:accepté';
  exception when others then v_txt := sqlstate || ':' || sqlerrm; end;
  perform pg_temp.ok('trigger : pas d''affiliation à une auto-école d''un autre lieu', v_txt like '23514:%', v_txt);

  begin
    insert into benevoles (prenom, lieu_id) values ('Verif', 2) returning id into v_int;
    insert into benevole_suivi (benevole_id, semaine_lundi, day_index, half_day, lieu_id)
      values (v_int, '2030-01-07', 0, 'matin', 1) returning lieu_id into v_int;
    raise exception 'sentinelle:%', v_int;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('trigger : le suivi prend le lieu du bénévole', v_txt = 'sentinelle:2', v_txt);

  -- 5. Unicités
  begin
    insert into settings (promo_id, key, value) values (2, 'verif_cle', 'a')
      on conflict (promo_id, key) do update set value = excluded.value;
    insert into settings (promo_id, key, value) values (2, 'verif_cle', 'b')
      on conflict (promo_id, key) do update set value = excluded.value;
    select count(*), max(value) into n, v_txt from settings where promo_id = 2 and key = 'verif_cle';
    raise exception 'sentinelle:%:%', n, v_txt;
  exception when others then v_txt := sqlerrm; end;
  perform pg_temp.ok('réglages : la cible (promo_id, key) est reconnue par ON CONFLICT', v_txt = 'sentinelle:1:b', v_txt);

  begin
    insert into settings (promo_id, key, value) values (null, 'chatbot_quota_jour', '99');
    raise exception 'sentinelle:accepté';
  exception when others then v_txt := sqlstate; end;
  perform pg_temp.ok('réglages globaux : pas de doublon de clé', v_txt = '23505', v_txt);

  -- 6. Synchronisation de bascule (écritures annulées par la levée finale)
  select id into v_theme from themes order by id limit 1;
  select id into v_theme2 from themes order by id desc limit 1;
  select id into v_qcm from qcm order by id limit 1;
  update themes set statut = 'En cours' where id = v_theme;
  select statut into v_txt from themes_progression where promo_id = 1 and theme_id = v_theme;
  perform pg_temp.ok('synchro : ancienne colonne vers progression de mars', v_txt = 'En cours', coalesce(v_txt, 'nul'));
  update themes_progression set date_qcm = '2030-01-01' where promo_id = 1 and theme_id = v_theme;
  select date_qcm::text into v_txt from themes where id = v_theme;
  perform pg_temp.ok('synchro : progression de mars vers ancienne colonne', v_txt = '2030-01-01', coalesce(v_txt, 'nul'));
  select statut into v_txt from themes where id = v_theme2;
  insert into themes_progression (promo_id, theme_id, statut) values (2, v_theme2, 'En cours')
    on conflict (promo_id, theme_id) do update set statut = excluded.statut;
  perform pg_temp.ok('synchro : septembre ne touche pas les anciennes colonnes',
    (select statut from themes where id = v_theme2) = v_txt, v_txt);
  update qcm set exam_seconds_per_question = 41 where id = v_qcm;
  select exam_seconds_per_question into v_int from qcm_examens where promo_id = 1 and qcm_id = v_qcm;
  perform pg_temp.ok('synchro : ancien examen vers examens de mars', v_int = 41, coalesce(v_int::text, 'nul'));
  update qcm_examens set exam_seconds_per_question = 43 where promo_id = 1 and qcm_id = v_qcm;
  select exam_seconds_per_question into v_int from qcm where id = v_qcm;
  perform pg_temp.ok('synchro : examens de mars vers ancien examen', v_int = 43, coalesce(v_int::text, 'nul'));
  insert into qcm_examens (promo_id, qcm_id, exam_seconds_per_question) values (2, v_qcm, 57)
    on conflict (promo_id, qcm_id) do update set exam_seconds_per_question = excluded.exam_seconds_per_question;
  select exam_seconds_per_question into v_int from qcm where id = v_qcm;
  perform pg_temp.ok('synchro : un examen de septembre ne touche pas la banque', v_int = 43, coalesce(v_int::text, 'nul'));

  -- Verdict (annule tout)
  select count(*), count(*) filter (where not ok) into v_total, v_ko from verif;
  select string_agg('- ' || libelle || ' : ' || detail, E'\n') into v_liste from verif where not ok;
  raise exception E'VERDICT %\n% contrôles, % échec(s)%',
    case when v_ko = 0 then 'VERT' else 'ROUGE' end, v_total, v_ko, coalesce(E'\n' || v_liste, '');
end $verif$;
```

- [ ] **Étape 3 : le lancer avant la migration, il doit échouer**

Passer le contenu du fichier à `execute_sql`. Attendu : une erreur qui n'est PAS « VERDICT VERT »
(typiquement `column "promo_id" does not exist` ou `relation "promos" does not exist`).

- [ ] **Étape 4 : écrire `supabase/migrations/20261001_multi_promo_1_fondations.sql`**

```sql
-- Multi-promo, étape 1 : fondations (spec A et D.2). Purement additive : aucune règle
-- d'accès ne change, l'app actuelle fonctionne à l'identique.
-- Marche arrière : 20261001_multi_promo_1_fondations_retour.sql

-- 1. Lieux et promos -----------------------------------------------------------------
create table public.lieux (
  id integer generated by default as identity primary key,
  nom text not null unique,
  created_at timestamptz not null default now()
);
insert into public.lieux (id, nom) values (1, 'Nîmes'), (2, 'Montpellier');
alter table public.lieux alter column id restart with 3;

create table public.promos (
  id integer generated by default as identity primary key,
  lieu_id integer not null references public.lieux(id),
  nom text not null,
  date_debut date not null,
  date_fin date,
  created_at timestamptz not null default now()
);
insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values
  (1, 1, 'Nîmes, mars 2026', '2026-03-30', '2026-12-11'),
  (2, 1, 'Nîmes, septembre 2026', '2026-09-30', null);
alter table public.promos alter column id restart with 3;

alter table public.lieux enable row level security;
alter table public.promos enable row level security;
revoke all on public.lieux, public.promos from anon;
revoke insert, update, delete, truncate on public.lieux, public.promos from authenticated;
grant update (nom) on public.promos to authenticated;

-- 2. Colonnes promo_id et lieu_id. Une valeur constante d'abord : aucune réécriture,
--    aucun trigger déclenché, aucun updated_at touché. Les défauts dynamiques suivent en 4.
alter table public.stagiaires         add column promo_id integer not null default 1 references public.promos(id);
alter table public.evaluations        add column promo_id integer not null default 1 references public.promos(id);
alter table public.evaluations_audit  add column promo_id integer not null default 1 references public.promos(id);
alter table public.passages           add column promo_id integer not null default 1 references public.promos(id);
alter table public.passages_audit     add column promo_id integer not null default 1 references public.promos(id);
alter table public.planning_entries   add column promo_id integer not null default 1 references public.promos(id);
alter table public.planning_half_meta add column promo_id integer not null default 1 references public.promos(id);
alter table public.planning_jours_off add column promo_id integer not null default 1 references public.promos(id);
alter table public.agenda_events      add column promo_id integer not null default 1 references public.promos(id);
alter table public.qcm_attempts       add column promo_id integer not null default 1 references public.promos(id);
alter table public.epcf_evaluations   add column promo_id integer not null default 1 references public.promos(id);
alter table public.epcf_livrets       add column promo_id integer not null default 1 references public.promos(id);
alter table public.dp_dossiers        add column promo_id integer not null default 1 references public.promos(id);
alter table public.fiches_suivi       add column promo_id integer not null default 1 references public.promos(id);
-- Réglages : promo_id nulle = réglage global (quota de l'assistant et deux clés inutilisées).
alter table public.settings           add column promo_id integer default 1 references public.promos(id);
update public.settings set promo_id = null where key in ('chatbot_quota_jour', 'cohort_name', 'password_hash');

alter table public.benevoles      add column lieu_id integer not null default 1 references public.lieux(id);
alter table public.auto_ecoles    add column lieu_id integer not null default 1 references public.lieux(id);
alter table public.benevole_suivi add column lieu_id integer not null default 1 references public.lieux(id);

-- 3. Fonctions de contexte (spec B.2) ------------------------------------------------
create or replace function public.peut_acceder_promo(p integer)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from promos pr where pr.id = p)
     and exists (
       select 1 from user_profiles up
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and (   up.is_founder
              or up.role in ('prof', 'admin')
              or exists (select 1 from stagiaires s
                          where s.id = up.stagiaire_id and s.promo_id = p))
     );
$$;

-- Promo par défaut : celle de la fiche stagiaire ; pour le personnel, la plus ancienne
-- promo encore en cours, à défaut la plus récente. Nulle sans utilisateur.
create or replace function public.promo_par_defaut()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with moi as (
    select up.stagiaire_id, (up.is_founder or up.role in ('prof', 'admin')) as tout_voir
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id),
    (select pr.id from promos pr, moi
      where moi.tout_voir and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr, moi
      where moi.tout_voir
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$$;

-- Promo de la requête : l'en-tête x-promo-id s'il est accessible ; sans en-tête, la promo
-- par défaut ; en-tête interdit ou fantaisiste : nulle (aucune ligne, insertion refusée).
create or replace function public.promo_courante()
returns integer language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  entete text;
begin
  begin
    entete := nullif(current_setting('request.headers', true), '')::json ->> 'x-promo-id';
  exception when others then
    return null;
  end;
  if entete is null or entete = '' then
    return promo_par_defaut();
  end if;
  if entete ~ '^[0-9]{1,9}$' and peut_acceder_promo(entete::integer) then
    return entete::integer;
  end if;
  return null;
end;
$$;

create or replace function public.lieu_courant()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select pr.lieu_id from promos pr where pr.id = promo_courante();
$$;

create or replace function public.mes_promos()
returns table (id integer, nom text, lieu_id integer, lieu_nom text, date_debut date,
               date_fin date, par_defaut boolean, stagiaire_id integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select pr.id, pr.nom, pr.lieu_id, l.nom, pr.date_debut, pr.date_fin,
         coalesce(pr.id = d.pid, false),
         (select s.id from user_profiles up join stagiaires s on s.id = up.stagiaire_id
           where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = pr.id
           limit 1)
  from promos pr
  join lieux l on l.id = pr.lieu_id
  cross join (select promo_par_defaut() as pid) d
  where peut_acceder_promo(pr.id)
  order by pr.date_debut, pr.id;
$$;

-- Sonde (supprimée à l'étape 2) : renvoie l'en-tête reçu, pour prouver qu'il traverse
-- la passerelle. Elle ne lit aucune donnée.
create or replace function public.diag_entete_promo()
returns text language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> 'x-promo-id';
$$;

revoke all on function public.peut_acceder_promo(integer), public.promo_par_defaut(),
  public.promo_courante(), public.lieu_courant(), public.mes_promos(),
  public.diag_entete_promo() from public;
grant execute on function public.peut_acceder_promo(integer), public.promo_par_defaut(),
  public.promo_courante(), public.lieu_courant() to anon, authenticated, service_role;
grant execute on function public.mes_promos() to authenticated, service_role;
revoke execute on function public.mes_promos() from anon;
grant execute on function public.diag_entete_promo() to anon, authenticated;

-- 4. Valeurs par défaut dynamiques
alter table public.stagiaires         alter column promo_id set default public.promo_courante();
alter table public.planning_entries   alter column promo_id set default public.promo_courante();
alter table public.planning_half_meta alter column promo_id set default public.promo_courante();
alter table public.planning_jours_off alter column promo_id set default public.promo_courante();
alter table public.agenda_events      alter column promo_id set default public.promo_courante();
alter table public.settings           alter column promo_id set default public.promo_courante();
alter table public.benevoles          alter column lieu_id  set default public.lieu_courant();
alter table public.auto_ecoles        alter column lieu_id  set default public.lieu_courant();
-- Colonnes imposées par trigger : plus de défaut.
alter table public.evaluations        alter column promo_id drop default;
alter table public.evaluations_audit  alter column promo_id drop default;
alter table public.passages           alter column promo_id drop default;
alter table public.passages_audit     alter column promo_id drop default;
alter table public.qcm_attempts       alter column promo_id drop default;
alter table public.epcf_evaluations   alter column promo_id drop default;
alter table public.epcf_livrets       alter column promo_id drop default;
alter table public.dp_dossiers        alter column promo_id drop default;
alter table public.fiches_suivi       alter column promo_id drop default;
alter table public.benevole_suivi     alter column lieu_id  drop default;

-- 5. La promo d'une ligne de suivi est toujours celle de son stagiaire
create or replace function public.imposer_promo_du_stagiaire()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  select s.promo_id into new.promo_id from public.stagiaires s where s.id = new.stagiaire_id;
  return new;
end;
$$;
create trigger trg_promo_du_stagiaire before insert or update on public.evaluations
  for each row execute function public.imposer_promo_du_stagiaire();
create trigger trg_promo_du_stagiaire before insert or update on public.passages
  for each row execute function public.imposer_promo_du_stagiaire();
create trigger trg_promo_du_stagiaire before insert or update on public.qcm_attempts
  for each row execute function public.imposer_promo_du_stagiaire();
create trigger trg_promo_du_stagiaire before insert or update on public.epcf_evaluations
  for each row execute function public.imposer_promo_du_stagiaire();
create trigger trg_promo_du_stagiaire before insert or update on public.epcf_livrets
  for each row execute function public.imposer_promo_du_stagiaire();
create trigger trg_promo_du_stagiaire before insert or update on public.dp_dossiers
  for each row execute function public.imposer_promo_du_stagiaire();
create trigger trg_promo_du_stagiaire before insert or update on public.fiches_suivi
  for each row execute function public.imposer_promo_du_stagiaire();

create or replace function public.imposer_lieu_du_benevole()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  select b.lieu_id into new.lieu_id from public.benevoles b where b.id = new.benevole_id;
  return new;
end;
$$;
create trigger trg_lieu_du_benevole before insert or update on public.benevole_suivi
  for each row execute function public.imposer_lieu_du_benevole();

create or replace function public.verifier_affiliation_meme_lieu()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.auto_ecole_id is not null and not exists (
    select 1 from public.auto_ecoles a where a.id = new.auto_ecole_id and a.lieu_id = new.lieu_id
  ) then
    raise exception 'Cette auto-école appartient à un autre lieu.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger trg_affiliation_meme_lieu before insert or update on public.benevoles
  for each row execute function public.verifier_affiliation_meme_lieu();

-- 6. Historiques : la promo de la ligne auditée est recopiée
create or replace function public.audit_evaluations()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  who text := coalesce(auth.jwt()->>'email', 'anon');
begin
  if tg_op = 'INSERT' then
    insert into evaluations_audit(evaluation_id, action, after_data, changed_by_email, promo_id)
    values (new.id, 'insert', to_jsonb(new), who, new.promo_id);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into evaluations_audit(evaluation_id, action, before_data, after_data, changed_by_email, promo_id)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who, new.promo_id);
    return new;
  elsif tg_op = 'DELETE' then
    insert into evaluations_audit(evaluation_id, action, before_data, changed_by_email, promo_id)
    values (old.id, 'delete', to_jsonb(old), who, old.promo_id);
    return old;
  end if;
end;
$$;

create or replace function public.audit_passages()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  -- Le « who » client (prénom) est gardé, l'email du jeton le remplace s'il est présent.
  client_who text := coalesce(new.created_by_who, new.updated_by_who, old.created_by_who, old.updated_by_who, 'anon');
  jwt_email text := coalesce(auth.jwt()->>'email', null);
  who_trace text := case when jwt_email is null then client_who else jwt_email end;
begin
  if tg_op = 'INSERT' then
    insert into passages_audit(passage_id, action, after_data, changed_by_who, promo_id)
    values (new.id, 'insert', to_jsonb(new), who_trace, new.promo_id);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into passages_audit(passage_id, action, before_data, after_data, changed_by_who, promo_id)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who_trace, new.promo_id);
    return new;
  elsif tg_op = 'DELETE' then
    insert into passages_audit(passage_id, action, before_data, changed_by_who, promo_id)
    values (old.id, 'delete', to_jsonb(old), who_trace, old.promo_id);
    return old;
  end if;
end;
$$;

-- 7. Progression des thèmes et état des examens, propres à chaque promo
create table public.themes_progression (
  promo_id integer not null default public.promo_courante() references public.promos(id),
  theme_id integer not null references public.themes(id) on delete cascade,
  statut text not null default 'À faire' check (statut in ('À faire', 'En cours', 'Fait')),
  date_fait date,
  date_qcm date,
  notes text,
  updated_by_email text,
  updated_at timestamptz not null default now(),
  primary key (promo_id, theme_id)
);
create table public.qcm_examens (
  promo_id integer not null default public.promo_courante() references public.promos(id),
  qcm_id bigint not null references public.qcm(id) on delete cascade,
  published boolean not null default false,
  published_by_email text,
  published_at timestamptz,
  exam_nb_questions integer,
  exam_question_ids jsonb,
  exam_draw_mode text check (exam_draw_mode in ('random', 'manual')),
  exam_seconds_per_question integer not null default 30,
  exam_ferme_a timestamptz,
  updated_at timestamptz not null default now(),
  primary key (promo_id, qcm_id)
);
comment on column public.qcm_examens.published is
  'Examen ouvert pour la promo, PAS « QCM visible » : la lecture et l''entraînement n''en dépendent pas.';
alter table public.themes_progression enable row level security;
alter table public.qcm_examens enable row level security;
revoke all on public.themes_progression, public.qcm_examens from anon;
create trigger themes_progression_set_updated_at before update on public.themes_progression
  for each row execute function public.trigger_set_updated_at();
create trigger qcm_examens_set_updated_at before update on public.qcm_examens
  for each row execute function public.trigger_set_updated_at();

insert into public.themes_progression (promo_id, theme_id, statut, date_fait, date_qcm, notes, updated_by_email, updated_at)
select 1, t.id, t.statut, t.date_fait, t.date_qcm, t.notes, t.updated_by_email, coalesce(t.updated_at, now())
from public.themes t;
insert into public.qcm_examens (promo_id, qcm_id, published, published_by_email, published_at,
  exam_nb_questions, exam_question_ids, exam_draw_mode, exam_seconds_per_question, exam_ferme_a, updated_at)
select 1, q.id, q.published, q.published_by_email, q.published_at, q.exam_nb_questions,
  q.exam_question_ids, q.exam_draw_mode, q.exam_seconds_per_question, q.exam_ferme_a, q.updated_at
from public.qcm q;

-- 8. Synchronisation pendant la bascule (spec D.2), dans les deux sens, pour la promo 1
--    seulement. Supprimée à l'étape 5. Créée APRÈS la copie, qui ne doit rien déclencher.
create or replace function public.sync_themes_vers_progression()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  insert into themes_progression (promo_id, theme_id, statut, date_fait, date_qcm, notes, updated_by_email)
  values (1, new.id, new.statut, new.date_fait, new.date_qcm, new.notes, new.updated_by_email)
  on conflict (promo_id, theme_id) do update
    set statut = excluded.statut, date_fait = excluded.date_fait, date_qcm = excluded.date_qcm,
        notes = excluded.notes, updated_by_email = excluded.updated_by_email;
  return new;
end;
$$;
create trigger trg_sync_themes_progression
  after insert or update of statut, date_fait, date_qcm, notes, updated_by_email on public.themes
  for each row execute function public.sync_themes_vers_progression();

create or replace function public.sync_progression_vers_themes()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if pg_trigger_depth() > 1 or new.promo_id <> 1 then return new; end if;
  update themes set statut = new.statut, date_fait = new.date_fait, date_qcm = new.date_qcm,
                    notes = new.notes, updated_by_email = new.updated_by_email
   where id = new.theme_id;
  return new;
end;
$$;
create trigger trg_sync_progression_themes after insert or update on public.themes_progression
  for each row execute function public.sync_progression_vers_themes();

create or replace function public.sync_qcm_vers_examens()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  insert into qcm_examens (promo_id, qcm_id, published, published_by_email, published_at,
    exam_nb_questions, exam_question_ids, exam_draw_mode, exam_seconds_per_question, exam_ferme_a)
  values (1, new.id, new.published, new.published_by_email, new.published_at, new.exam_nb_questions,
    new.exam_question_ids, new.exam_draw_mode, new.exam_seconds_per_question, new.exam_ferme_a)
  on conflict (promo_id, qcm_id) do update
    set published = excluded.published, published_by_email = excluded.published_by_email,
        published_at = excluded.published_at, exam_nb_questions = excluded.exam_nb_questions,
        exam_question_ids = excluded.exam_question_ids, exam_draw_mode = excluded.exam_draw_mode,
        exam_seconds_per_question = excluded.exam_seconds_per_question,
        exam_ferme_a = excluded.exam_ferme_a;
  return new;
end;
$$;
create trigger trg_sync_qcm_examens
  after insert or update of published, published_by_email, published_at, exam_nb_questions,
    exam_question_ids, exam_draw_mode, exam_seconds_per_question, exam_ferme_a on public.qcm
  for each row execute function public.sync_qcm_vers_examens();

create or replace function public.sync_examens_vers_qcm()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if pg_trigger_depth() > 1 or new.promo_id <> 1 then return new; end if;
  update qcm set published = new.published, published_by_email = new.published_by_email,
    published_at = new.published_at, exam_nb_questions = new.exam_nb_questions,
    exam_question_ids = new.exam_question_ids, exam_draw_mode = new.exam_draw_mode,
    exam_seconds_per_question = new.exam_seconds_per_question, exam_ferme_a = new.exam_ferme_a
   where id = new.qcm_id;
  return new;
end;
$$;
create trigger trg_sync_examens_qcm after insert or update on public.qcm_examens
  for each row execute function public.sync_examens_vers_qcm();

revoke all on function public.imposer_promo_du_stagiaire(), public.imposer_lieu_du_benevole(),
  public.verifier_affiliation_meme_lieu(), public.sync_themes_vers_progression(),
  public.sync_progression_vers_themes(), public.sync_qcm_vers_examens(),
  public.sync_examens_vers_qcm() from public, anon, authenticated;

-- 9. Nouvelles unicités, À CÔTÉ des anciennes (supprimées à l'étape 3) et index
alter table public.planning_entries   add constraint planning_entries_promo_unique
  unique (promo_id, semaine_lundi, day_index, half_day, slot, lane);
alter table public.planning_half_meta add constraint planning_half_meta_promo_unique
  unique (promo_id, semaine_lundi, day_index, half_day);
alter table public.planning_jours_off add constraint planning_jours_off_promo_unique
  unique (promo_id, semaine_lundi, day_index);
alter table public.stagiaires         add constraint stagiaires_promo_prenom_unique
  unique (promo_id, prenom);
alter table public.settings add column id bigint generated always as identity;
alter table public.settings add constraint settings_promo_key_unique unique nulls not distinct (promo_id, key);

create index evaluations_promo_idx       on public.evaluations (promo_id);
create index evaluations_audit_promo_idx on public.evaluations_audit (promo_id);
create index passages_promo_idx          on public.passages (promo_id);
create index passages_audit_promo_idx    on public.passages_audit (promo_id);
create index agenda_events_promo_idx     on public.agenda_events (promo_id);
create index qcm_attempts_promo_idx      on public.qcm_attempts (promo_id);
create index epcf_evaluations_promo_idx  on public.epcf_evaluations (promo_id);
create index epcf_livrets_promo_idx      on public.epcf_livrets (promo_id);
create index dp_dossiers_promo_idx       on public.dp_dossiers (promo_id);
create index fiches_suivi_promo_idx      on public.fiches_suivi (promo_id);
create index benevoles_lieu_idx          on public.benevoles (lieu_id);
create index auto_ecoles_lieu_idx        on public.auto_ecoles (lieu_id);
create index benevole_suivi_lieu_idx     on public.benevole_suivi (lieu_id);
create index promos_lieu_idx             on public.promos (lieu_id);
create index themes_progression_theme_idx on public.themes_progression (theme_id);
create index qcm_examens_qcm_idx         on public.qcm_examens (qcm_id);
```

- [ ] **Étape 5 : écrire `supabase/migrations/20261001_multi_promo_1_fondations_retour.sql`**

```sql
-- Marche arrière de l'étape 1 : retire tout ce que la migration 1 a ajouté. Rien
-- d'existant n'avait été modifié, sauf les deux fonctions d'audit, rétablies d'abord.

create or replace function public.audit_evaluations()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  who text := coalesce(auth.jwt()->>'email', 'anon');
begin
  if tg_op = 'INSERT' then
    insert into evaluations_audit(evaluation_id, action, after_data, changed_by_email)
    values (new.id, 'insert', to_jsonb(new), who);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into evaluations_audit(evaluation_id, action, before_data, after_data, changed_by_email)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who);
    return new;
  elsif tg_op = 'DELETE' then
    insert into evaluations_audit(evaluation_id, action, before_data, changed_by_email)
    values (old.id, 'delete', to_jsonb(old), who);
    return old;
  end if;
end;
$$;

create or replace function public.audit_passages()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  client_who text := coalesce(new.created_by_who, new.updated_by_who, old.created_by_who, old.updated_by_who, 'anon');
  jwt_email text := coalesce(auth.jwt()->>'email', null);
  who_trace text := case when jwt_email is null then client_who else jwt_email end;
begin
  if tg_op = 'INSERT' then
    insert into passages_audit(passage_id, action, after_data, changed_by_who)
    values (new.id, 'insert', to_jsonb(new), who_trace);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into passages_audit(passage_id, action, before_data, after_data, changed_by_who)
    values (new.id, 'update', to_jsonb(old), to_jsonb(new), who_trace);
    return new;
  elsif tg_op = 'DELETE' then
    insert into passages_audit(passage_id, action, before_data, changed_by_who)
    values (old.id, 'delete', to_jsonb(old), who_trace);
    return old;
  end if;
end;
$$;

drop trigger if exists trg_sync_themes_progression on public.themes;
drop trigger if exists trg_sync_qcm_examens on public.qcm;
drop table if exists public.themes_progression;
drop table if exists public.qcm_examens;
drop trigger if exists trg_promo_du_stagiaire on public.evaluations;
drop trigger if exists trg_promo_du_stagiaire on public.passages;
drop trigger if exists trg_promo_du_stagiaire on public.qcm_attempts;
drop trigger if exists trg_promo_du_stagiaire on public.epcf_evaluations;
drop trigger if exists trg_promo_du_stagiaire on public.epcf_livrets;
drop trigger if exists trg_promo_du_stagiaire on public.dp_dossiers;
drop trigger if exists trg_promo_du_stagiaire on public.fiches_suivi;
drop trigger if exists trg_lieu_du_benevole on public.benevole_suivi;
drop trigger if exists trg_affiliation_meme_lieu on public.benevoles;

alter table public.settings drop constraint if exists settings_promo_key_unique;
alter table public.settings drop column if exists id;
alter table public.stagiaires         drop column if exists promo_id;
alter table public.evaluations        drop column if exists promo_id;
alter table public.evaluations_audit  drop column if exists promo_id;
alter table public.passages           drop column if exists promo_id;
alter table public.passages_audit     drop column if exists promo_id;
alter table public.planning_entries   drop column if exists promo_id;
alter table public.planning_half_meta drop column if exists promo_id;
alter table public.planning_jours_off drop column if exists promo_id;
alter table public.agenda_events      drop column if exists promo_id;
alter table public.qcm_attempts       drop column if exists promo_id;
alter table public.epcf_evaluations   drop column if exists promo_id;
alter table public.epcf_livrets       drop column if exists promo_id;
alter table public.dp_dossiers        drop column if exists promo_id;
alter table public.fiches_suivi       drop column if exists promo_id;
alter table public.settings           drop column if exists promo_id;
alter table public.benevoles          drop column if exists lieu_id;
alter table public.auto_ecoles        drop column if exists lieu_id;
alter table public.benevole_suivi     drop column if exists lieu_id;

drop function if exists public.sync_themes_vers_progression();
drop function if exists public.sync_progression_vers_themes();
drop function if exists public.sync_qcm_vers_examens();
drop function if exists public.sync_examens_vers_qcm();
drop function if exists public.imposer_promo_du_stagiaire();
drop function if exists public.imposer_lieu_du_benevole();
drop function if exists public.verifier_affiliation_meme_lieu();
drop function if exists public.mes_promos();
drop function if exists public.lieu_courant();
drop function if exists public.promo_courante();
drop function if exists public.promo_par_defaut();
drop function if exists public.peut_acceder_promo(integer);
drop function if exists public.diag_entete_promo();
drop table if exists public.promos;
drop table if exists public.lieux;
```

- [ ] **Étape 6 : répéter l'étape 1 dans une transaction annulée**

Composer le lot dans l'espace temporaire, puis passer son contenu à `execute_sql` :

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && { echo "begin;"; cat supabase/migrations/20261001_multi_promo_1_fondations.sql tests/sql/multi-promo-1-verif.sql; } > "$SCRATCH/repetition-etape1.sql" && wc -l "$SCRATCH/repetition-etape1.sql"
```

Attendu : une erreur dont le message
commence par `VERDICT VERT`. Si `VERDICT ROUGE` : corriger la migration ou le test selon la ligne
en échec, recommencer. Puis vérifier qu'il ne reste rien :
`select to_regclass('public.promos') is null as rien_ne_reste;` → `true`.

- [ ] **Étape 7 : répéter la marche arrière**

Lot : `begin;` + migration 1 + retour 1, puis la requête de contrôle suivante, suivie d'une levée
qui annule tout :

```sql
do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and column_name in ('promo_id', 'lieu_id');
  raise exception 'VERDICT % : % colonne(s) promo_id ou lieu_id restantes',
    case when n = 0 and to_regclass('public.promos') is null then 'VERT' else 'ROUGE' end, n;
end $$;
```

Attendu : `VERDICT VERT : 0 colonne(s) ...`.

- [ ] **Étape 8 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && grep -rn $'\xe2\x80\x94' supabase/migrations/20261001_multi_promo_1_fondations.sql supabase/migrations/20261001_multi_promo_1_fondations_retour.sql tests/sql/multi-promo-1-verif.sql; git add supabase/migrations/20261001_multi_promo_1_fondations.sql supabase/migrations/20261001_multi_promo_1_fondations_retour.sql tests/sql/multi-promo-1-verif.sql && git commit -q -m "Multi-promo, etape 1 : migration des fondations, marche arriere et verification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 2 : Appliquer l'étape 1 et la contrôler

**Fichiers :**
- Créer : `scripts/verifier-embarquements.mjs`

**Interfaces :**
- Consomme : migration 1 (Tâche 1).
- Produit : base en état « étape 1 », preuve que l'en-tête traverse la passerelle.

- [ ] **Étape 1 : annoncer à Timy l'application de l'étape 1** (invisible pour tous, marche arrière
  prête), puis appeler `apply_migration` avec `name = "multi_promo_1_fondations"` et pour `query`
  le contenu exact du fichier de migration.

- [ ] **Étape 2 : relancer la vérification**

Passer `tests/sql/multi-promo-1-verif.sql` seul à `execute_sql`. Attendu : `VERDICT VERT`.

- [ ] **Étape 3 : prouver que l'en-tête atteint la base**

```bash
URL=https://crpduennbqaemhfaywrz.supabase.co; KEY=$(grep -o 'sb_publishable_[A-Za-z0-9_]*' /c/Users/watch/Dev/ecsr-promo-multi-promo/js/config.js); \
curl -s -X POST "$URL/rest/v1/rpc/diag_entete_promo" -H "apikey: $KEY" -H "Content-Type: application/json" -H "x-promo-id: 2" -d '{}'; echo; \
curl -s -X POST "$URL/rest/v1/rpc/diag_entete_promo" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}'; echo
```

Attendu : `"2"` puis `null`. Si la première ligne n'est pas `"2"`, arrêter : l'architecture repose
sur ce passage (spec B.1), le signaler à Timy.

- [ ] **Étape 4 : écrire `scripts/verifier-embarquements.mjs`**

```js
// Vérifie que les jointures PostgREST de l'app se résolvent toujours : une relation
// devenue ambiguë après une migration casse une vue entière. Lecture seule, clé
// publique : les règles d'accès renvoient des listes vides ou un refus de droit, ce
// qui suffit. Seules les erreurs de relation (PGRST200, PGRST201) comptent comme échec.
// Usage : node scripts/verifier-embarquements.mjs
import { SUPABASE_URL, SUPABASE_KEY } from "../js/config.js";

const EXAMEN = "published, published_by_email, published_at, exam_nb_questions, "
  + "exam_question_ids, exam_draw_mode, exam_seconds_per_question, exam_ferme_a";

const REQUETES = [
  ["passages", "*, stagiaire:stagiaires!stagiaire_id(prenom), remplacant:stagiaires!remplacant_id(prenom)"],
  ["evaluations", "*, stagiaire:stagiaires!stagiaire_id(prenom), competence:competences!competence_code(libelle)"],
  ["epcf_evaluations", "*, evaluateur:profs!evaluateur_prof_id(nom), stagiaire:stagiaires!stagiaire_id(prenom, nom)"],
  ["qcm_attempts", "id, stagiaire_id, note_20, finished_at, stagiaire:stagiaires!stagiaire_id(prenom)"],
  ["qcm", "*, questions:qcm_questions(*, options:qcm_options(*))"],
  ["qcm_signalements", "*, question:qcm_questions!inner(id, qcm_id, enonce), "
    + "instruction:qcm_signalement_instruction(verdict_auto, analyse_auto, instruit_at)"],
  ["qcm_signalements", "*, question:qcm_questions!inner(id, qcm_id, enonce, ordre, "
    + "qcm:qcm!inner(id, titre, theme_id)), instruction:qcm_signalement_instruction(verdict_auto, analyse_auto, instruit_at)"],
  ["qcm_signalements", "question:qcm_questions!inner(qcm_id)"],
  // Formes de la nouvelle version (Tâche 8)
  ["themes", "*, progression:themes_progression(statut, date_fait, date_qcm, notes, updated_by_email)"],
  ["qcm", `id, theme_id, titre, exam_pass_20, qcm_questions(count), examen:qcm_examens(${EXAMEN})`],
  ["qcm", `*, questions:qcm_questions(*, options:qcm_options(*)), examen:qcm_examens(${EXAMEN})`],
];

let echecs = 0;
for (const [table, select] of REQUETES) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=0`;
  const rep = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  const corps = await rep.text();
  let code = "";
  try { code = JSON.parse(corps).code || ""; } catch (e) { /* liste vide */ }
  const casse = code === "PGRST200" || code === "PGRST201";
  if (casse) echecs++;
  console.log(`${casse ? "ÉCHEC" : "ok   "} ${rep.status} ${code || "-"} ${table} : ${select.slice(0, 70)}`);
}
console.log(echecs ? `${echecs} jointure(s) cassée(s)` : "Toutes les jointures se résolvent");
process.exit(echecs ? 1 : 0);
```

- [ ] **Étape 5 : le lancer**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node scripts/verifier-embarquements.mjs
```

Attendu : 11 lignes `ok`, puis `Toutes les jointures se résolvent`.

- [ ] **Étape 6 : alertes de sécurité**

Charger l'outil `get_advisors` (ToolSearch `select:mcp__800314df-e1fc-4fd4-889e-606ab840f6bc__get_advisors`),
type `security`. Seule alerte nouvelle admise : « RLS activé sans règle » sur `lieux`, `promos`,
`themes_progression`, `qcm_examens` (leurs règles arrivent à l'étape 2). Toute autre alerte nouvelle :
la corriger avant de continuer.

- [ ] **Étape 7 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git add scripts/verifier-embarquements.mjs && git commit -q -m "Multi-promo : script de controle des jointures PostgREST

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 3 : Preuve du cloisonnement, rouge avant l'étape 2

**Fichiers :**
- Créer : `tests/sql/multi-promo-photo.sql`
- Créer : `tests/sql/multi-promo-preuve.sql`

**Interfaces :**
- Consomme : état « étape 1 ».
- Produit : deux scripts rejoués aux Tâches 4, 5, 16 et 17. La preuve compare à la table
  temporaire `photo` (colonnes `personnage, table_nom, n`) si elle existe dans la session.

- [ ] **Étape 1 : écrire `tests/sql/multi-promo-photo.sql`**

```sql
-- Photo « avant » de la répétition de l'étape 2 (spec E.2) : ce que voient, table par
-- table et sans en-tête, les trois personnages réels de mars, sous les règles du moment.
-- À enchaîner dans le MÊME lot que la migration 2 puis la preuve (Tâche 4, étape 2).
create temp table if not exists photo (personnage text, table_nom text, n bigint);
truncate photo;

create or replace function pg_temp.incarner(p_email text, p_entete text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then ''
         else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_entete is null then ''
         else json_build_object('x-promo-id', p_entete)::text end, true);
  if p_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

-- Compte ce qu'un personnage voit. Un refus de droit (visiteur sur une table fermée)
-- compte 0 ; toute autre erreur rend -1, qui ne correspond à aucune attente.
create or replace function pg_temp.compter(p_email text, p_entete text, p_sql text)
returns bigint language plpgsql as $f$
declare n bigint;
begin
  perform pg_temp.incarner(p_email, p_entete);
  begin
    execute p_sql into n;
  exception
    when insufficient_privilege then n := 0;
    when others then n := -1;
  end;
  reset role;
  return n;
end $f$;

do $photo$
declare
  v_p record; v_t text; v_n bigint;
  v_stag1 text; v_form text; v_fond text;
  tables text[] := array['stagiaires','evaluations','evaluations_audit','passages','passages_audit',
    'planning_entries','planning_half_meta','planning_jours_off','agenda_events','settings',
    'qcm_attempts','epcf_evaluations','epcf_livrets','dp_dossiers','fiches_suivi','user_profiles',
    'benevoles','auto_ecoles','benevole_suivi','themes','qcm','qcm_questions','qcm_options',
    'qcm_signalements','cours','ressources','contacts','profs','competences','chatbot_usage'];
begin
  select up.email into v_stag1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif and s.promo_id = 1
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email into v_fond from user_profiles where is_founder order by email limit 1;
  for v_p in select * from (values ('stagiaire de mars', v_stag1), ('formateur', v_form),
                                   ('fondateur', v_fond)) as t(nom, email) loop
    foreach v_t in array tables loop
      v_n := pg_temp.compter(v_p.email, null, format('select count(*) from public.%I', v_t));
      insert into photo values (v_p.nom, v_t, v_n);
    end loop;
  end loop;
end $photo$;
```

- [ ] **Étape 2 : écrire `tests/sql/multi-promo-preuve.sql`**

```sql
-- Preuve du cloisonnement multi-promo (spec E.1 et E.2). Rejouable à volonté : le bloc
-- final lève TOUJOURS une exception, qui annule les données de test et porte le verdict.
-- Personnages réels choisis par requête : aucun email n'est écrit ici (dépôt public).
-- Si la table temporaire « photo » existe (répétition de l'étape 2), la non-régression de
-- mars est comparée à elle, avant toute donnée de test.

create temp table if not exists preuve (libelle text, ok boolean, detail text);
truncate preuve;

create or replace function pg_temp.verifier(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into preuve values (p_libelle, coalesce(p_ok, false), coalesce(p_detail, ''));
$f$;

create or replace function pg_temp.incarner(p_email text, p_entete text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then ''
         else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_entete is null then ''
         else json_build_object('x-promo-id', p_entete)::text end, true);
  if p_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

create or replace function pg_temp.compter(p_email text, p_entete text, p_sql text)
returns bigint language plpgsql as $f$
declare n bigint;
begin
  perform pg_temp.incarner(p_email, p_entete);
  begin
    execute p_sql into n;
  exception
    when insufficient_privilege then n := 0;
    when others then n := -1;
  end;
  reset role;
  return n;
end $f$;

-- Valeur scalaire lue par un personnage (en texte), ou « ERREUR <code> ».
create or replace function pg_temp.valeur(p_email text, p_entete text, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  perform pg_temp.incarner(p_email, p_entete);
  begin
    execute p_sql into v;
  exception when others then
    v := 'ERREUR ' || sqlstate;
  end;
  reset role;
  return v;
end $f$;

-- Écriture tentée par un personnage, TOUJOURS annulée. Rend « OK <lignes> <valeur
-- renvoyée> » ou « REFUS <code> ». p_sql se termine par RETURNING.
create or replace function pg_temp.ecrire(p_email text, p_entete text, p_sql text)
returns text language plpgsql as $f$
declare v text; n bigint;
begin
  begin
    perform pg_temp.incarner(p_email, p_entete);
    execute p_sql into v;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0001', message = 'OK ' || n || ' ' || coalesce(v, 'nul');
  exception when others then
    if sqlerrm like 'OK %' then return sqlerrm; end if;
    return 'REFUS ' || sqlstate;
  end;
end $f$;

-- Nombre de lignes qu'un personnage DOIT voir, calculé sans les règles d'accès.
create or replace function pg_temp.attendu(p_table text, p_email text, p_promo integer)
returns bigint language plpgsql as $f$
declare
  v_admin boolean := false; v_prof boolean := false; v_sid integer; v_lieu integer; n bigint;
begin
  if p_email is null then return 0; end if;
  select coalesce(up.is_admin, false), coalesce(up.role = 'prof', false),
         (select s.id from public.stagiaires s where s.id = up.stagiaire_id and s.promo_id = p_promo)
    into v_admin, v_prof, v_sid
    from public.user_profiles up where lower(up.email) = lower(p_email);
  if p_table = 'user_profiles' then
    select count(*) into n from public.user_profiles up
     where lower(up.email) = lower(p_email) or up.stagiaire_id is null
        or up.stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = p_promo);
    return n;
  end if;
  if p_promo is null then return 0; end if;
  select pr.lieu_id into v_lieu from public.promos pr where pr.id = p_promo;
  if p_table = 'qcm_attempts' then
    select count(*) into n from public.qcm_attempts
     where promo_id = p_promo and (v_admin or stagiaire_id = v_sid);
  elsif p_table in ('epcf_evaluations', 'epcf_livrets', 'dp_dossiers') then
    execute format('select count(*) from public.%I where promo_id = $1 and ($2 or $3 or stagiaire_id = $4)', p_table)
      into n using p_promo, v_admin, v_prof, v_sid;
  elsif p_table in ('benevoles', 'auto_ecoles', 'benevole_suivi') then
    if v_admin then
      execute format('select count(*) from public.%I where lieu_id = $1', p_table) into n using v_lieu;
    else
      n := 0;
    end if;
  else
    execute format('select count(*) from public.%I where promo_id = $1', p_table) into n using p_promo;
  end if;
  return n;
end $f$;

do $preuve$
declare
  v_stag1 text; v_form text; v_fond text; v_stag2 text;
  v_fictif text := 'preuve.fictif@example.invalid';
  v_sid1 integer; v_sid_fond integer; v_sid_fictif integer; v_mtp integer;
  v_theme integer; v_qcm bigint; v_ae_mtp integer; v_ae_nimes integer; v_bnv_mtp integer;
  v_p record; v_t text; v_vu bigint; v_att bigint; v_hors bigint; v_n bigint; v_lieu integer;
  v_txt text; v_contexte text; v_total integer; v_ko integer; v_liste text;
  tables_promo text[] := array['stagiaires','evaluations','evaluations_audit','passages',
    'passages_audit','planning_entries','planning_half_meta','planning_jours_off','agenda_events',
    'settings','qcm_attempts','epcf_evaluations','epcf_livrets','dp_dossiers','fiches_suivi',
    'themes_progression','qcm_examens'];
  tables_lieu text[] := array['benevoles','auto_ecoles','benevole_suivi'];
begin
  -- Personnages réels
  select up.email, s.id into v_stag1, v_sid1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif and s.promo_id = 1
   order by s.id limit 1;
  select email into v_form from user_profiles where role = 'prof' and not is_founder order by email limit 1;
  select email, stagiaire_id into v_fond, v_sid_fond from user_profiles where is_founder order by email limit 1;
  select up.email into v_stag2 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and s.promo_id = 2 order by s.id limit 1;
  perform pg_temp.verifier('personnages réels trouvés',
    v_stag1 is not null and v_form is not null and v_fond is not null);

  -- A. Non-régression de mars, si la photo « avant » est là (répétition de l'étape 2)
  if to_regclass('pg_temp.photo') is not null then
    for v_p in select ph.personnage, ph.table_nom, ph.n from photo ph order by 1, 2 loop
      v_txt := case v_p.personnage when 'stagiaire de mars' then v_stag1
                                   when 'formateur' then v_form else v_fond end;
      v_att := v_p.n - case when v_p.table_nom = 'settings'
                            then (select count(*) from settings where promo_id is null) else 0 end;
      v_vu := pg_temp.compter(v_txt, null, format('select count(*) from public.%I', v_p.table_nom));
      v_n := pg_temp.compter(v_txt, '1', format('select count(*) from public.%I', v_p.table_nom));
      perform pg_temp.verifier(format('non-régression : %s, %s', v_p.personnage, v_p.table_nom),
        v_vu = v_att and v_n = v_att,
        format('avant %s, après %s sans en-tête et %s en-tête 1', v_p.n, v_vu, v_n));
    end loop;
  end if;

  -- B. Données de test (annulées par la levée finale)
  insert into promos (lieu_id, nom, date_debut) values (2, 'Preuve, Montpellier', current_date)
    returning id into v_mtp;
  insert into stagiaires (prenom, nom, ordre, promo_id) values ('PreuveFictif', 'PREUVE', 999, 2)
    returning id into v_sid_fictif;
  insert into user_profiles (email, role, stagiaire_id) values (v_fictif, 'stagiaire', v_sid_fictif);
  select id into v_theme from themes order by id limit 1;
  select id into v_qcm from qcm order by id limit 1;
  select id into v_ae_nimes from auto_ecoles where lieu_id = 1 order by id limit 1;
  insert into planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, lane, activite)
    values (2, '2030-01-07', 0, 'matin', 0, 0, 'Cours');
  insert into planning_half_meta (promo_id, semaine_lundi, day_index, half_day, start_time, end_time)
    values (2, '2030-01-07', 0, 'matin', '08:30', '12:00');
  insert into planning_jours_off (promo_id, semaine_lundi, day_index, label) values (2, '2030-01-07', 4, 'Preuve');
  insert into agenda_events (promo_id, date_start, title) values (2, '2030-01-07', 'Preuve');
  insert into settings (promo_id, key, value) values (2, 'preuve_cle', 'x');
  insert into evaluations (stagiaire_id, type, theme_numero, note) values (v_sid_fictif, 'Thème', 1, 12);
  insert into passages (date, stagiaire_id, type, resultat) values ('2030-01-07', v_sid_fictif, 'Salle', 'Effectué');
  insert into qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20)
    values (v_qcm, v_sid_fictif, 'entrainement', 1, 2, 10);
  insert into epcf_evaluations (stagiaire_id, trame) values (v_sid_fictif, 'salle');
  insert into epcf_livrets (stagiaire_id) values (v_sid_fictif);
  insert into dp_dossiers (stagiaire_id) values (v_sid_fictif);
  insert into fiches_suivi (stagiaire_id) values (v_sid_fictif);
  insert into themes_progression (promo_id, theme_id, statut) values (2, v_theme, 'Fait');
  insert into qcm_examens (promo_id, qcm_id) values (2, v_qcm);
  insert into auto_ecoles (nom, lieu_id) values ('Preuve AE Montpellier', 2) returning id into v_ae_mtp;
  insert into benevoles (prenom, lieu_id, auto_ecole_id) values ('PreuveBenevole', 2, v_ae_mtp)
    returning id into v_bnv_mtp;
  insert into benevole_suivi (benevole_id, semaine_lundi, day_index, half_day)
    values (v_bnv_mtp, '2030-01-07', 0, 'matin');

  -- C. Matrice : chaque personnage, chaque contexte, chaque table
  create temp table if not exists personas (nom text, email text, entete text, promo integer);
  truncate personas;
  insert into personas values
    ('stagiaire de mars', v_stag1, null, 1), ('stagiaire de mars', v_stag1, '1', 1),
    ('stagiaire de mars', v_stag1, '2', null), ('stagiaire de mars', v_stag1, v_mtp::text, null),
    ('stagiaire de mars', v_stag1, 'abc', null),
    ('formateur', v_form, null, 1), ('formateur', v_form, '1', 1), ('formateur', v_form, '2', 2),
    ('formateur', v_form, v_mtp::text, v_mtp), ('formateur', v_form, 'abc', null),
    ('fondateur', v_fond, null, 1), ('fondateur', v_fond, '1', 1), ('fondateur', v_fond, '2', 2),
    ('fondateur', v_fond, v_mtp::text, v_mtp), ('fondateur', v_fond, 'abc', null),
    ('stagiaire fictif de septembre', v_fictif, null, 2), ('stagiaire fictif de septembre', v_fictif, '1', null),
    ('stagiaire fictif de septembre', v_fictif, '2', 2),
    ('stagiaire fictif de septembre', v_fictif, v_mtp::text, null),
    ('visiteur', null, null, null), ('visiteur', null, '1', null), ('visiteur', null, '2', null);
  if v_stag2 is not null then
    insert into personas values ('vrai stagiaire de septembre', v_stag2, null, 2),
      ('vrai stagiaire de septembre', v_stag2, '1', null), ('vrai stagiaire de septembre', v_stag2, '2', 2);
  end if;

  for v_p in select * from personas loop
    v_contexte := format('%s [%s]', v_p.nom, coalesce(v_p.entete, 'sans en-tête'));
    foreach v_t in array tables_promo loop
      v_vu := pg_temp.compter(v_p.email, v_p.entete, format('select count(*) from public.%I', v_t));
      v_att := pg_temp.attendu(v_t, v_p.email, v_p.promo);
      v_hors := pg_temp.compter(v_p.email, v_p.entete,
        format('select count(*) from public.%I where promo_id is distinct from %s', v_t,
               coalesce(v_p.promo::text, 'null')));
      perform pg_temp.verifier(format('%s %s : voit ce qu''il doit', v_contexte, v_t),
        v_vu = v_att, format('vu %s, attendu %s', v_vu, v_att));
      perform pg_temp.verifier(format('%s %s : rien d''une autre promo', v_contexte, v_t),
        v_hors = 0, format('%s ligne(s) hors promo', v_hors));
    end loop;
    v_lieu := null;
    select lieu_id into v_lieu from promos where id = v_p.promo;
    foreach v_t in array tables_lieu loop
      v_vu := pg_temp.compter(v_p.email, v_p.entete, format('select count(*) from public.%I', v_t));
      v_att := pg_temp.attendu(v_t, v_p.email, v_p.promo);
      v_hors := pg_temp.compter(v_p.email, v_p.entete,
        format('select count(*) from public.%I where lieu_id is distinct from %s', v_t,
               coalesce(v_lieu::text, 'null')));
      perform pg_temp.verifier(format('%s %s : voit sa banque', v_contexte, v_t),
        v_vu = v_att, format('vu %s, attendu %s', v_vu, v_att));
      perform pg_temp.verifier(format('%s %s : rien d''un autre lieu', v_contexte, v_t),
        v_hors = 0, format('%s ligne(s) hors lieu', v_hors));
    end loop;
    v_vu := pg_temp.compter(v_p.email, v_p.entete, 'select count(*) from public.user_profiles');
    v_att := pg_temp.attendu('user_profiles', v_p.email, v_p.promo);
    perform pg_temp.verifier(format('%s : comptes visibles', v_contexte), v_vu = v_att,
      format('vu %s, attendu %s', v_vu, v_att));
  end loop;

  -- D. Promos et lieux visibles (indépendants de l'en-tête)
  perform pg_temp.verifier('stagiaire de mars : voit sa seule promo',
    pg_temp.compter(v_stag1, null, 'select count(*) from public.promos') = 1);
  perform pg_temp.verifier('stagiaire fictif : voit septembre et rien d''autre',
    pg_temp.compter(v_fictif, null, 'select count(*) from public.promos') = 1
    and pg_temp.compter(v_fictif, null, 'select count(*) from public.promos where id = 2') = 1);
  perform pg_temp.verifier('formateur : voit toutes les promos',
    pg_temp.compter(v_form, null, 'select count(*) from public.promos') = (select count(*) from promos));
  perform pg_temp.verifier('formateur : voit les lieux qui ont une promo',
    pg_temp.compter(v_form, null, 'select count(*) from public.lieux') = (select count(distinct lieu_id) from promos));
  perform pg_temp.verifier('stagiaire de mars : voit Nîmes seulement',
    pg_temp.compter(v_stag1, null, 'select count(*) from public.lieux') = 1);
  perform pg_temp.verifier('visiteur : aucune promo',
    pg_temp.compter(null, null, 'select count(*) from public.promos') = 0);

  -- E. Emails d'une promo à l'autre
  perform pg_temp.verifier('le stagiaire fictif ne voit pas les comptes de mars',
    pg_temp.compter(v_fictif, '2', format('select count(*) from public.user_profiles where stagiaire_id = %s', v_sid1)) = 0);
  perform pg_temp.verifier('un stagiaire de mars ne voit pas les comptes de septembre',
    pg_temp.compter(v_stag1, null, format('select count(*) from public.user_profiles where lower(email) = %L', v_fictif)) = 0);

  -- F. Fonctions serveur
  perform pg_temp.verifier('fondateur en mars : sa fiche',
    pg_temp.valeur(v_fond, '1', 'select my_stagiaire_id()::text') = v_sid_fond::text);
  perform pg_temp.verifier('fondateur en septembre : aucune fiche',
    pg_temp.valeur(v_fond, '2', 'select my_stagiaire_id()::text') is null);
  perform pg_temp.verifier('stagiaire fictif : sa fiche',
    pg_temp.valeur(v_fictif, null, 'select my_stagiaire_id()::text') = v_sid_fictif::text);
  perform pg_temp.verifier('mes_promos du fondateur : toutes, mars par défaut',
    pg_temp.valeur(v_fond, null, 'select count(*)::text from mes_promos()') = (select count(*)::text from promos)
    and pg_temp.valeur(v_fond, null, 'select id::text from mes_promos() where par_defaut') = '1');
  perform pg_temp.verifier('mes_promos du stagiaire fictif : septembre seul',
    pg_temp.valeur(v_fictif, null, 'select string_agg(id::text, '','') from mes_promos()') = '2');
  perform pg_temp.verifier('noms des bénévoles depuis septembre : banque de Nîmes',
    pg_temp.valeur(v_fictif, '2', 'select count(*)::text from benevoles_noms()')
      = (select count(*)::text from benevoles where lieu_id = 1));
  perform pg_temp.verifier('noms des bénévoles depuis la promo de Montpellier : banque de Montpellier',
    pg_temp.valeur(v_form, v_mtp::text, 'select count(*)::text from benevoles_noms()') = '1');
  perform pg_temp.verifier('venues : rien pour un stagiaire',
    pg_temp.valeur(v_stag1, null, 'select count(*)::text from venues_benevoles()') = '0');
  perform pg_temp.verifier('venues : promos du lieu courant pour un formateur',
    pg_temp.valeur(v_form, '1', 'select count(*)::text from venues_benevoles()')
      = (select count(*)::text from planning_entries pe join promos pr on pr.id = pe.promo_id
          where pr.lieu_id = 1 and pe.benevoles_ids <> '{}'));
  perform pg_temp.verifier('moyennes EPCF : septembre ne compte que septembre',
    pg_temp.valeur(v_form, '2', 'select count(*)::text from epcf_moyennes(''salle'')') = '0');
  perform pg_temp.verifier('date de naissance : refusée hors de la promo affichée',
    pg_temp.valeur(v_form, '2', format(
      'select set_date_naissance(%s, (select date_naissance from public.stagiaires where id = %s))::text',
      v_sid1, v_sid1)) like 'ERREUR%');

  -- G. Examens propres à chaque promo
  update qcm_examens set published = true, exam_ferme_a = null where promo_id = 1 and qcm_id = v_qcm;
  perform pg_temp.verifier('examen ouvert en mars : démarrable pour mars',
    pg_temp.valeur(v_stag1, null, format('select qcm_exam_demarrable(%s)::text', v_qcm)) = 'true');
  perform pg_temp.verifier('examen ouvert en mars : fermé pour septembre',
    pg_temp.valeur(v_fictif, '2', format('select qcm_exam_demarrable(%s)::text', v_qcm)) = 'false');
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, '
    || 'score, total, note_20) values (%s, %s, ''examen'', 1, 2, 10) returning promo_id::text', v_qcm, v_sid_fictif));
  perform pg_temp.verifier('septembre ne passe pas un examen ouvert seulement en mars', v_txt like 'REFUS%', v_txt);
  update qcm_examens set published = true where promo_id = 2 and qcm_id = v_qcm;
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, '
    || 'score, total, note_20) values (%s, %s, ''examen'', 1, 2, 10) returning promo_id::text', v_qcm, v_sid_fictif));
  perform pg_temp.verifier('septembre passe son examen une fois ouvert pour septembre', v_txt = 'OK 1 2', v_txt);

  -- H. Écritures (toutes annulées)
  v_txt := pg_temp.ecrire(v_fictif, '2', 'insert into public.planning_entries (semaine_lundi, day_index, '
    || 'half_day, slot, lane, activite) values (''2030-01-14'', 0, ''matin'', 0, 0, ''Cours'') returning promo_id::text');
  perform pg_temp.verifier('un stagiaire ne crée pas de carte de planning', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.planning_entries (semaine_lundi, day_index, '
    || 'half_day, slot, lane, activite) values (''2030-01-14'', 0, ''matin'', 0, 0, ''Cours'') returning promo_id::text');
  perform pg_temp.verifier('formateur en septembre : la carte va en septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', 'insert into public.planning_entries (promo_id, semaine_lundi, day_index, '
    || 'half_day, slot, lane, activite) values (2, ''2030-01-14'', 1, ''matin'', 0, 0, ''Cours'') returning promo_id::text');
  perform pg_temp.verifier('formateur en mars : pas d''écriture forcée en septembre', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'update public.planning_entries set notes = notes where promo_id = 1 returning id::text');
  perform pg_temp.verifier('formateur en septembre : les cartes de mars sont hors d''atteinte', v_txt = 'OK 0 nul', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, format('insert into public.passages (date, stagiaire_id, type, resultat) '
    || 'values (current_date, %s, ''Salle'', ''Effectué'') returning promo_id::text', v_sid1));
  perform pg_temp.verifier('stagiaire de mars : ajoute son passage, en mars', v_txt = 'OK 1 1', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, format('insert into public.passages (date, stagiaire_id, type, resultat) '
    || 'values (current_date, %s, ''Salle'', ''Effectué'') returning promo_id::text', v_sid_fictif));
  perform pg_temp.verifier('stagiaire de mars : pas de passage pour un stagiaire de septembre', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.passages (date, stagiaire_id, type, resultat) '
    || 'values (current_date, %s, ''Salle'', ''Effectué'') returning promo_id::text', v_sid_fictif));
  perform pg_temp.verifier('stagiaire fictif : ajoute son passage, en septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('insert into public.evaluations (stagiaire_id, type, theme_numero, note) '
    || 'values (%s, ''Thème'', 1, 10) returning promo_id::text', v_sid1));
  perform pg_temp.verifier('formateur en septembre : pas de note pour un stagiaire de mars', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', format('insert into public.evaluations (stagiaire_id, type, theme_numero, note) '
    || 'values (%s, ''Thème'', 1, 10) returning promo_id::text', v_sid1));
  perform pg_temp.verifier('formateur en mars : note en mars', v_txt = 'OK 1 1', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.settings (key, value) values (''preuve_cle'', ''y'') '
    || 'on conflict (promo_id, key) do update set value = excluded.value returning promo_id::text');
  perform pg_temp.verifier('formateur en septembre : réglage de septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, 'update public.settings set value = value returning key');
  perform pg_temp.verifier('stagiaire : aucun réglage modifiable', v_txt = 'OK 0 nul' or v_txt like 'REFUS%', v_txt);
  -- Clé « modules » du chantier B : un formateur la règle pour la promo affichée, un stagiaire
  -- jamais. Avant la bascule, la clé primaire porte encore sur « key » : si mars a déjà sa clé
  -- « modules », l'écriture pour septembre attend la bascule (Tâche 16).
  if exists (select 1 from settings where key = 'modules' and promo_id = 1)
     and exists (select 1 from pg_constraint where conrelid = 'public.settings'::regclass
                  and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (key)') then
    perform pg_temp.verifier('modules (chantier B) : écriture par promo, à rejouer après la bascule', true,
      'clé primaire encore sur key');
  else
    v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.settings (key, value) values (''modules'', ''{}'') '
      || 'on conflict (promo_id, key) do update set value = excluded.value returning promo_id::text');
    perform pg_temp.verifier('modules (chantier B) : un formateur règle la promo affichée', v_txt = 'OK 1 2', v_txt);
  end if;
  v_txt := pg_temp.ecrire(v_fictif, '2', 'insert into public.settings (key, value) values (''modules'', ''{}'') '
    || 'on conflict (promo_id, key) do update set value = excluded.value returning promo_id::text');
  perform pg_temp.verifier('modules (chantier B) : un stagiaire ne règle rien', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.benevoles (prenom) values (''PreuveB'') returning lieu_id::text');
  perform pg_temp.verifier('bénévole créé depuis septembre : banque de Nîmes', v_txt = 'OK 1 1', v_txt);
  v_txt := pg_temp.ecrire(v_form, v_mtp::text, 'insert into public.benevoles (prenom) values (''PreuveB'') returning lieu_id::text');
  perform pg_temp.verifier('bénévole créé depuis Montpellier : banque de Montpellier', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, v_mtp::text, format('insert into public.benevoles (prenom, auto_ecole_id) '
    || 'values (''PreuveB'', %s) returning lieu_id::text', v_ae_nimes));
  perform pg_temp.verifier('pas d''affiliation à une auto-école d''un autre lieu', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', format('update public.benevoles set notes = notes where id = %s returning id::text', v_bnv_mtp));
  perform pg_temp.verifier('depuis Nîmes, la banque de Montpellier est hors d''atteinte', v_txt = 'OK 0 nul', v_txt);
  v_txt := pg_temp.ecrire(v_fictif, '2', format('insert into public.themes_progression (theme_id, statut) values (%s, ''Fait'') '
    || 'on conflict (promo_id, theme_id) do update set statut = excluded.statut returning promo_id::text', v_theme));
  perform pg_temp.verifier('un stagiaire ne coche pas un thème', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('insert into public.themes_progression (theme_id, statut) values (%s, ''En cours'') '
    || 'on conflict (promo_id, theme_id) do update set statut = excluded.statut returning promo_id::text', v_theme));
  perform pg_temp.verifier('formateur en septembre : progression de septembre', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'update public.promos set nom = nom where id = 2 returning id::text');
  perform pg_temp.verifier('formateur : renomme la promo', v_txt = 'OK 1 2', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'update public.promos set date_fin = date_fin where id = 2 returning id::text');
  perform pg_temp.verifier('formateur : ne touche que le nom de la promo', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', 'insert into public.promos (lieu_id, nom, date_debut) values (1, ''X'', current_date) returning id::text');
  perform pg_temp.verifier('aucune promo créée depuis l''app', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_stag1, null, 'update public.promos set nom = nom where id = 1 returning id::text');
  perform pg_temp.verifier('stagiaire : ne renomme pas sa promo', v_txt = 'OK 0 nul' or v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('delete from public.stagiaires where id = %s returning id::text', v_sid1));
  perform pg_temp.verifier('formateur en septembre : les stagiaires de mars sont hors d''atteinte', v_txt = 'OK 0 nul', v_txt);
  v_txt := pg_temp.ecrire(v_form, '2', format('insert into public.user_profiles (email, role, stagiaire_id) '
    || 'values (''preuve.invite@example.invalid'', ''stagiaire'', %s) returning email', v_sid1));
  perform pg_temp.verifier('formateur en septembre : pas d''accès donné à un stagiaire de mars', v_txt like 'REFUS%', v_txt);
  v_txt := pg_temp.ecrire(v_form, '1', format('insert into public.user_profiles (email, role, stagiaire_id) '
    || 'values (''preuve.invite@example.invalid'', ''stagiaire'', %s) returning email', v_sid1));
  perform pg_temp.verifier('formateur en mars : accès donné à un stagiaire de mars', v_txt like 'OK 1%', v_txt);

  -- I. Verdict (annule tout)
  select count(*), count(*) filter (where not ok) into v_total, v_ko from preuve;
  select string_agg('- ' || libelle || ' : ' || detail, E'\n') into v_liste
    from (select libelle, detail from preuve where not ok limit 60) x;
  raise exception E'VERDICT %\n% contrôles, % échec(s)%',
    case when v_ko = 0 then 'VERT' else 'ROUGE' end, v_total, v_ko, coalesce(E'\n' || v_liste, '');
end $preuve$;
```

- [ ] **Étape 3 : la lancer avant l'étape 2, elle doit être ROUGE**

Passer `tests/sql/multi-promo-preuve.sql` à `execute_sql`. Attendu : `VERDICT ROUGE`, avec entre
autres `stagiaire de mars [2] stagiaires : voit ce qu'il doit : vu ..., attendu 0` et
`venues : rien pour un stagiaire` (la fonction n'existe pas encore). Un `VERDICT VERT` ici
signifierait que le test ne teste rien : le corriger.

- [ ] **Étape 4 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && grep -rn $'\xe2\x80\x94' tests/sql/; git add tests/sql/multi-promo-photo.sql tests/sql/multi-promo-preuve.sql && git commit -q -m "Multi-promo : preuve du cloisonnement et photo de non-regression

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 4 : Étape 2 (cloisonnement), écrire, répéter, appliquer, prouver

**Fichiers :**
- Créer : `supabase/migrations/20261001_multi_promo_2_cloisonnement.sql`
- Créer : `supabase/migrations/20261001_multi_promo_2_cloisonnement_retour.sql`

**Interfaces :**
- Consomme : état « étape 1 », scripts de la Tâche 3.
- Produit : règles d'accès par promo et par lieu ; `my_stagiaire_id()` promo-consciente ;
  `venues_benevoles() → table (promo_id, promo_nom, semaine_lundi, day_index, half_day, sujet,
  eleves_ids, benevoles_ids)` réservée aux admins.

- [ ] **Étape 1 : écrire `supabase/migrations/20261001_multi_promo_2_cloisonnement.sql`**

```sql
-- Multi-promo, étape 2 : cloisonnement (spec B.3 à B.5). Chaque table propre à une promo
-- (ou à un lieu) ajoute la condition de promo (ou de lieu) à ses règles actuelles.
-- Marche arrière : 20261001_multi_promo_2_cloisonnement_retour.sql

drop function if exists public.diag_entete_promo();

-- ===== Tables propres à une promo, écriture réservée aux admins =====
drop policy if exists stagiaires_admin_writes on public.stagiaires;
create policy stagiaires_admin_writes on public.stagiaires for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists stagiaires_select_all on public.stagiaires;
create policy stagiaires_select_all on public.stagiaires for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists evaluations_admin_writes on public.evaluations;
create policy evaluations_admin_writes on public.evaluations for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists evaluations_select_all on public.evaluations;
create policy evaluations_select_all on public.evaluations for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists planning_entries_admin_writes on public.planning_entries;
create policy planning_entries_admin_writes on public.planning_entries for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists planning_entries_select_all on public.planning_entries;
create policy planning_entries_select_all on public.planning_entries for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists planning_half_meta_admin_writes on public.planning_half_meta;
create policy planning_half_meta_admin_writes on public.planning_half_meta for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists planning_half_meta_select_all on public.planning_half_meta;
create policy planning_half_meta_select_all on public.planning_half_meta for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists planning_jours_off_admin_writes on public.planning_jours_off;
create policy planning_jours_off_admin_writes on public.planning_jours_off for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists planning_jours_off_select_all on public.planning_jours_off;
create policy planning_jours_off_select_all on public.planning_jours_off for select to authenticated
  using (promo_id = (select promo_courante()));

drop policy if exists agenda_admin_writes on public.agenda_events;
create policy agenda_admin_writes on public.agenda_events for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists agenda_select_authenticated on public.agenda_events;
create policy agenda_select_authenticated on public.agenda_events for select to authenticated
  using (promo_id = (select promo_courante()));

-- Réglages : les lignes globales (promo_id nulle) ne sont plus ni lues ni écrites par l'app.
drop policy if exists settings_admin_writes on public.settings;
create policy settings_admin_writes on public.settings for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists settings_select_all on public.settings;
create policy settings_select_all on public.settings for select to authenticated
  using (promo_id = (select promo_courante()));

-- ===== Historiques (écrits par triggers seulement) =====
drop policy if exists evaluations_audit_select on public.evaluations_audit;
create policy evaluations_audit_select on public.evaluations_audit for select to authenticated
  using (promo_id = (select promo_courante()));
drop policy if exists passages_audit_select on public.passages_audit;
create policy passages_audit_select on public.passages_audit for select to authenticated
  using (promo_id = (select promo_courante()));

-- ===== Passages =====
drop policy if exists passages_admin_all on public.passages;
create policy passages_admin_all on public.passages for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists passages_insert_own on public.passages;
create policy passages_insert_own on public.passages for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1)));
drop policy if exists passages_select_all on public.passages;
create policy passages_select_all on public.passages for select to authenticated
  using (promo_id = (select promo_courante()));
drop policy if exists passages_update_own on public.passages;
create policy passages_update_own on public.passages for update to authenticated
  using (promo_id = (select promo_courante()) and stagiaire_id = (
    select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1))
  with check (promo_id = (select promo_courante()) and stagiaire_id = (
    select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1));

-- ===== Tentatives QCM =====
drop policy if exists qcm_attempts_admin_all on public.qcm_attempts;
create policy qcm_attempts_admin_all on public.qcm_attempts for all to public
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
drop policy if exists qcm_attempts_insert_own on public.qcm_attempts;
create policy qcm_attempts_insert_own on public.qcm_attempts for insert to authenticated
  with check (promo_id = (select promo_courante())
    and stagiaire_id = (select up.stagiaire_id from user_profiles up
                        where lower(up.email) = lower(auth.email()) limit 1)
    and (mode = 'entrainement' or (mode = 'examen' and qcm_exam_remise_toleree(qcm_id))));
drop policy if exists qcm_attempts_select_own on public.qcm_attempts;
create policy qcm_attempts_select_own on public.qcm_attempts for select to authenticated
  using (promo_id = (select promo_courante())
    and stagiaire_id = (select up.stagiaire_id from user_profiles up
                        where lower(up.email) = lower(auth.email()) limit 1));

-- ===== EPCF et livret =====
drop policy if exists epcf_select on public.epcf_evaluations;
create policy epcf_select on public.epcf_evaluations for select to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_insert on public.epcf_evaluations;
create policy epcf_insert on public.epcf_evaluations for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_update on public.epcf_evaluations;
create policy epcf_update on public.epcf_evaluations for update to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()))
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_delete on public.epcf_evaluations;
create policy epcf_delete on public.epcf_evaluations for delete to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()));

drop policy if exists epcf_livrets_select on public.epcf_livrets;
create policy epcf_livrets_select on public.epcf_livrets for select to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_livrets_insert on public.epcf_livrets;
create policy epcf_livrets_insert on public.epcf_livrets for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_livrets_update on public.epcf_livrets;
create policy epcf_livrets_update on public.epcf_livrets for update to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()))
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof()));
drop policy if exists epcf_livrets_delete on public.epcf_livrets;
create policy epcf_livrets_delete on public.epcf_livrets for delete to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof()));

-- ===== Dossier professionnel =====
drop policy if exists dp_dossiers_select on public.dp_dossiers;
create policy dp_dossiers_select on public.dp_dossiers for select to public
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_insert on public.dp_dossiers;
create policy dp_dossiers_insert on public.dp_dossiers for insert to public
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_update on public.dp_dossiers;
create policy dp_dossiers_update on public.dp_dossiers for update to public
  using (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()))
  with check (promo_id = (select promo_courante()) and (is_admin() or is_prof() or stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_delete on public.dp_dossiers;
create policy dp_dossiers_delete on public.dp_dossiers for delete to public
  using (is_admin() and promo_id = (select promo_courante()));

-- ===== Fiches de suivi =====
drop policy if exists fiches_suivi_select on public.fiches_suivi;
create policy fiches_suivi_select on public.fiches_suivi for select to authenticated
  using (promo_id = (select promo_courante()));
drop policy if exists fiches_suivi_insert on public.fiches_suivi;
create policy fiches_suivi_insert on public.fiches_suivi for insert to authenticated
  with check (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where up.email = lower((auth.jwt() ->> 'email'::text)))));
drop policy if exists fiches_suivi_update on public.fiches_suivi;
create policy fiches_suivi_update on public.fiches_suivi for update to authenticated
  using (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where up.email = lower((auth.jwt() ->> 'email'::text)))))
  with check (promo_id = (select promo_courante()) and (is_admin() or stagiaire_id = (
    select up.stagiaire_id from user_profiles up where up.email = lower((auth.jwt() ->> 'email'::text)))));
drop policy if exists fiches_suivi_delete on public.fiches_suivi;
create policy fiches_suivi_delete on public.fiches_suivi for delete to authenticated
  using (is_admin() and promo_id = (select promo_courante()));

-- ===== Progression des thèmes et examens (nouvelles tables) =====
create policy themes_progression_select on public.themes_progression for select to authenticated
  using (promo_id = (select promo_courante()));
create policy themes_progression_insert on public.themes_progression for insert to authenticated
  with check (is_admin() and promo_id = (select promo_courante()));
create policy themes_progression_update on public.themes_progression for update to authenticated
  using (is_admin() and promo_id = (select promo_courante()))
  with check (is_admin() and promo_id = (select promo_courante()));
create policy themes_progression_delete on public.themes_progression for delete to authenticated
  using (is_admin() and promo_id = (select promo_courante()));

create policy qcm_examens_select on public.qcm_examens for select to authenticated
  using (promo_id = (select promo_courante()));
create policy qcm_examens_insert on public.qcm_examens for insert to authenticated
  with check ((is_admin() or is_prof()) and promo_id = (select promo_courante()));
create policy qcm_examens_update on public.qcm_examens for update to authenticated
  using ((is_admin() or is_prof()) and promo_id = (select promo_courante()))
  with check ((is_admin() or is_prof()) and promo_id = (select promo_courante()));
create policy qcm_examens_delete on public.qcm_examens for delete to authenticated
  using (is_admin() and promo_id = (select promo_courante()));

-- ===== Promos et lieux =====
create policy promos_select on public.promos for select to authenticated
  using (peut_acceder_promo(id));
create policy promos_update_nom on public.promos for update to authenticated
  using (is_admin() and peut_acceder_promo(id))
  with check (is_admin() and peut_acceder_promo(id));
create policy lieux_select on public.lieux for select to authenticated
  using (exists (select 1 from public.promos p where p.lieu_id = lieux.id and peut_acceder_promo(p.id)));

-- ===== Banques par lieu =====
drop policy if exists benevoles_select_admin on public.benevoles;
create policy benevoles_select_admin on public.benevoles for select to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevoles_insert_admin on public.benevoles;
create policy benevoles_insert_admin on public.benevoles for insert to authenticated
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevoles_update_admin on public.benevoles;
create policy benevoles_update_admin on public.benevoles for update to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()))
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevoles_delete_admin on public.benevoles;
create policy benevoles_delete_admin on public.benevoles for delete to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));

drop policy if exists auto_ecoles_select_admin on public.auto_ecoles;
create policy auto_ecoles_select_admin on public.auto_ecoles for select to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists auto_ecoles_insert_admin on public.auto_ecoles;
create policy auto_ecoles_insert_admin on public.auto_ecoles for insert to authenticated
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists auto_ecoles_update_admin on public.auto_ecoles;
create policy auto_ecoles_update_admin on public.auto_ecoles for update to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()))
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists auto_ecoles_delete_admin on public.auto_ecoles;
create policy auto_ecoles_delete_admin on public.auto_ecoles for delete to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));

drop policy if exists benevole_suivi_select_admin on public.benevole_suivi;
create policy benevole_suivi_select_admin on public.benevole_suivi for select to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevole_suivi_insert_admin on public.benevole_suivi;
create policy benevole_suivi_insert_admin on public.benevole_suivi for insert to authenticated
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevole_suivi_update_admin on public.benevole_suivi;
create policy benevole_suivi_update_admin on public.benevole_suivi for update to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()))
  with check (is_admin() and lieu_id = (select lieu_courant()));
drop policy if exists benevole_suivi_delete_admin on public.benevole_suivi;
create policy benevole_suivi_delete_admin on public.benevole_suivi for delete to authenticated
  using (is_admin() and lieu_id = (select lieu_courant()));

-- ===== Comptes (spec B.4) =====
drop policy if exists user_profiles_select_authenticated on public.user_profiles;
create policy user_profiles_select_authenticated on public.user_profiles for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))
  );
drop policy if exists "user_profiles insert admin" on public.user_profiles;
create policy "user_profiles insert admin" on public.user_profiles for insert to public
  with check (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))));
drop policy if exists "user_profiles update admin" on public.user_profiles;
create policy "user_profiles update admin" on public.user_profiles for update to public
  using (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))))
  with check (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))));
drop policy if exists "user_profiles delete admin" on public.user_profiles;
create policy "user_profiles delete admin" on public.user_profiles for delete to public
  using (is_admin() and (stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))));

-- ===== Fonctions serveur (spec B.2 et B.5) =====
create or replace function public.my_stagiaire_id()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select up.stagiaire_id from user_profiles up
  join stagiaires s on s.id = up.stagiaire_id
  where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    and s.promo_id = promo_courante()
  limit 1;
$$;

create or replace function public.qcm_exam_demarrable(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select e.published and (e.exam_ferme_a is null or now() < e.exam_ferme_a)
     from qcm_examens e where e.qcm_id = p_qcm_id and e.promo_id = promo_courante()),
    false);
$$;

create or replace function public.qcm_exam_remise_toleree(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select e.published and (
      e.exam_ferme_a is null
      or now() < e.exam_ferme_a + make_interval(secs =>
           coalesce(e.exam_seconds_per_question, 30) * coalesce(
             case when jsonb_typeof(e.exam_question_ids) = 'array'
                  then jsonb_array_length(e.exam_question_ids) end,
             e.exam_nb_questions,
             (select count(*)::int from qcm_questions qq where qq.qcm_id = e.qcm_id),
             0))
    )
    from qcm_examens e where e.qcm_id = p_qcm_id and e.promo_id = promo_courante()), false);
$$;

create or replace function public.epcf_moyennes(p_trame text)
returns table(critere text, moyenne numeric, effectif integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with dernieres as (
    select distinct on (stagiaire_id) scores
    from epcf_evaluations
    where trame = p_trame and contexte = 'EPCF' and auto_eval = false
      and promo_id = promo_courante()
    order by stagiaire_id, date_eval desc, id desc
  ),
  notes as (
    select k.key as critere,
           case k.value when 'A' then 2 when 'R' then 1 when 'NA' then 0 end as val
    from dernieres d, jsonb_each_text(d.scores) k
    where k.value in ('A','R','NA')
  )
  select critere, round(avg(val)::numeric, 3) as moyenne, count(*)::integer as effectif
  from notes
  group by critere;
$$;

create or replace function public.set_date_naissance(p_stagiaire_id integer, p_date date)
returns void language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Non autorise : ce stagiaire n''appartient pas a la promo affichee';
  end if;
  if not (is_admin() or is_prof() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  update stagiaires set date_naissance = p_date where id = p_stagiaire_id;
end;
$$;

create or replace function public.benevoles_noms()
returns table(id integer, display text)
language sql stable security definer
set search_path to 'public'
as $$
  select b.id,
         case when coalesce(trim(b.nom), '') <> ''
              then upper(left(trim(b.nom), 1)) || '. ' || b.prenom
              else b.prenom
         end
  from public.benevoles b
  where b.lieu_id = public.lieu_courant();
$$;

-- Venues des bénévoles : cartes du planning de TOUTES les promos du lieu courant (la
-- banque est commune au lieu). Réservée aux admins.
create or replace function public.venues_benevoles()
returns table(promo_id integer, promo_nom text, semaine_lundi date, day_index integer,
              half_day text, sujet text, eleves_ids integer[], benevoles_ids integer[])
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select pe.promo_id, pr.nom, pe.semaine_lundi, pe.day_index, pe.half_day, pe.sujet,
         pe.eleves_ids, pe.benevoles_ids
  from planning_entries pe
  join promos pr on pr.id = pe.promo_id
  where is_admin()
    and pr.lieu_id = lieu_courant()
    and peut_acceder_promo(pe.promo_id)
    and pe.benevoles_ids <> '{}'
  order by pe.semaine_lundi desc, pe.day_index;
$$;
revoke all on function public.venues_benevoles() from public, anon;
grant execute on function public.venues_benevoles() to authenticated, service_role;
```

- [ ] **Étape 2 : écrire `supabase/migrations/20261001_multi_promo_2_cloisonnement_retour.sql`**

Il rétablit à l'identique les règles et fonctions relevées le 01/10, retire les règles des
nouvelles tables et la fonction `venues_benevoles`, et remet la sonde de l'étape 1.

```sql
-- Marche arrière de l'étape 2 : règles d'accès et fonctions telles que relevées le 01/10.

-- Règles des tables existantes
drop policy if exists stagiaires_admin_writes on public.stagiaires;
create policy stagiaires_admin_writes on public.stagiaires for all to public using (is_admin()) with check (is_admin());
drop policy if exists stagiaires_select_all on public.stagiaires;
create policy stagiaires_select_all on public.stagiaires for select to authenticated using (true);
drop policy if exists evaluations_admin_writes on public.evaluations;
create policy evaluations_admin_writes on public.evaluations for all to public using (is_admin()) with check (is_admin());
drop policy if exists evaluations_select_all on public.evaluations;
create policy evaluations_select_all on public.evaluations for select to authenticated using (true);
drop policy if exists planning_entries_admin_writes on public.planning_entries;
create policy planning_entries_admin_writes on public.planning_entries for all to public using (is_admin()) with check (is_admin());
drop policy if exists planning_entries_select_all on public.planning_entries;
create policy planning_entries_select_all on public.planning_entries for select to authenticated using (true);
drop policy if exists planning_half_meta_admin_writes on public.planning_half_meta;
create policy planning_half_meta_admin_writes on public.planning_half_meta for all to public using (is_admin()) with check (is_admin());
drop policy if exists planning_half_meta_select_all on public.planning_half_meta;
create policy planning_half_meta_select_all on public.planning_half_meta for select to authenticated using (true);
drop policy if exists planning_jours_off_admin_writes on public.planning_jours_off;
create policy planning_jours_off_admin_writes on public.planning_jours_off for all to public using (is_admin()) with check (is_admin());
drop policy if exists planning_jours_off_select_all on public.planning_jours_off;
create policy planning_jours_off_select_all on public.planning_jours_off for select to authenticated using (true);
drop policy if exists agenda_admin_writes on public.agenda_events;
create policy agenda_admin_writes on public.agenda_events for all to public using (is_admin()) with check (is_admin());
drop policy if exists agenda_select_authenticated on public.agenda_events;
create policy agenda_select_authenticated on public.agenda_events for select to authenticated using (true);
drop policy if exists settings_admin_writes on public.settings;
create policy settings_admin_writes on public.settings for all to public using (is_admin()) with check (is_admin());
drop policy if exists settings_select_all on public.settings;
create policy settings_select_all on public.settings for select to authenticated using (true);
drop policy if exists evaluations_audit_select on public.evaluations_audit;
create policy evaluations_audit_select on public.evaluations_audit for select to authenticated using (true);
drop policy if exists passages_audit_select on public.passages_audit;
create policy passages_audit_select on public.passages_audit for select to authenticated using (true);

drop policy if exists passages_admin_all on public.passages;
create policy passages_admin_all on public.passages for all to public using (is_admin()) with check (is_admin());
drop policy if exists passages_insert_own on public.passages;
create policy passages_insert_own on public.passages for insert to authenticated
  with check (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where lower(up.email) = lower(auth.email()) limit 1)));
drop policy if exists passages_select_all on public.passages;
create policy passages_select_all on public.passages for select to authenticated using (true);
drop policy if exists passages_update_own on public.passages;
create policy passages_update_own on public.passages for update to authenticated
  using (stagiaire_id = (select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1))
  with check (stagiaire_id = (select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1));

drop policy if exists qcm_attempts_admin_all on public.qcm_attempts;
create policy qcm_attempts_admin_all on public.qcm_attempts for all to public using (is_admin()) with check (is_admin());
drop policy if exists qcm_attempts_insert_own on public.qcm_attempts;
create policy qcm_attempts_insert_own on public.qcm_attempts for insert to authenticated
  with check ((stagiaire_id = (select up.stagiaire_id from user_profiles up
    where lower(up.email) = lower(auth.email()) limit 1))
    and ((mode = 'entrainement') or ((mode = 'examen') and qcm_exam_remise_toleree(qcm_id))));
drop policy if exists qcm_attempts_select_own on public.qcm_attempts;
create policy qcm_attempts_select_own on public.qcm_attempts for select to authenticated
  using (stagiaire_id = (select up.stagiaire_id from user_profiles up where lower(up.email) = lower(auth.email()) limit 1));

drop policy if exists epcf_select on public.epcf_evaluations;
create policy epcf_select on public.epcf_evaluations for select to authenticated
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_insert on public.epcf_evaluations;
create policy epcf_insert on public.epcf_evaluations for insert to authenticated with check (is_admin() or is_prof());
drop policy if exists epcf_update on public.epcf_evaluations;
create policy epcf_update on public.epcf_evaluations for update to authenticated
  using (is_admin() or is_prof()) with check (is_admin() or is_prof());
drop policy if exists epcf_delete on public.epcf_evaluations;
create policy epcf_delete on public.epcf_evaluations for delete to authenticated using (is_admin() or is_prof());
drop policy if exists epcf_livrets_select on public.epcf_livrets;
create policy epcf_livrets_select on public.epcf_livrets for select to authenticated
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists epcf_livrets_insert on public.epcf_livrets;
create policy epcf_livrets_insert on public.epcf_livrets for insert to authenticated with check (is_admin() or is_prof());
drop policy if exists epcf_livrets_update on public.epcf_livrets;
create policy epcf_livrets_update on public.epcf_livrets for update to authenticated
  using (is_admin() or is_prof()) with check (is_admin() or is_prof());
drop policy if exists epcf_livrets_delete on public.epcf_livrets;
create policy epcf_livrets_delete on public.epcf_livrets for delete to authenticated using (is_admin() or is_prof());

drop policy if exists dp_dossiers_select on public.dp_dossiers;
create policy dp_dossiers_select on public.dp_dossiers for select to public
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_insert on public.dp_dossiers;
create policy dp_dossiers_insert on public.dp_dossiers for insert to public
  with check (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_update on public.dp_dossiers;
create policy dp_dossiers_update on public.dp_dossiers for update to public
  using (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()))
  with check (is_admin() or is_prof() or (stagiaire_id = my_stagiaire_id()));
drop policy if exists dp_dossiers_delete on public.dp_dossiers;
create policy dp_dossiers_delete on public.dp_dossiers for delete to public using (is_admin());

drop policy if exists fiches_suivi_select on public.fiches_suivi;
create policy fiches_suivi_select on public.fiches_suivi for select to authenticated using (true);
drop policy if exists fiches_suivi_insert on public.fiches_suivi;
create policy fiches_suivi_insert on public.fiches_suivi for insert to authenticated
  with check (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where (up.email = lower((auth.jwt() ->> 'email'::text))))));
drop policy if exists fiches_suivi_update on public.fiches_suivi;
create policy fiches_suivi_update on public.fiches_suivi for update to authenticated
  using (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where (up.email = lower((auth.jwt() ->> 'email'::text))))))
  with check (is_admin() or (stagiaire_id = (select up.stagiaire_id from user_profiles up
    where (up.email = lower((auth.jwt() ->> 'email'::text))))));
drop policy if exists fiches_suivi_delete on public.fiches_suivi;
create policy fiches_suivi_delete on public.fiches_suivi for delete to authenticated using (is_admin());

drop policy if exists benevoles_select_admin on public.benevoles;
create policy benevoles_select_admin on public.benevoles for select to authenticated using (is_admin());
drop policy if exists benevoles_insert_admin on public.benevoles;
create policy benevoles_insert_admin on public.benevoles for insert to authenticated with check (is_admin());
drop policy if exists benevoles_update_admin on public.benevoles;
create policy benevoles_update_admin on public.benevoles for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists benevoles_delete_admin on public.benevoles;
create policy benevoles_delete_admin on public.benevoles for delete to authenticated using (is_admin());
drop policy if exists auto_ecoles_select_admin on public.auto_ecoles;
create policy auto_ecoles_select_admin on public.auto_ecoles for select to authenticated using (is_admin());
drop policy if exists auto_ecoles_insert_admin on public.auto_ecoles;
create policy auto_ecoles_insert_admin on public.auto_ecoles for insert to authenticated with check (is_admin());
drop policy if exists auto_ecoles_update_admin on public.auto_ecoles;
create policy auto_ecoles_update_admin on public.auto_ecoles for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists auto_ecoles_delete_admin on public.auto_ecoles;
create policy auto_ecoles_delete_admin on public.auto_ecoles for delete to authenticated using (is_admin());
drop policy if exists benevole_suivi_select_admin on public.benevole_suivi;
create policy benevole_suivi_select_admin on public.benevole_suivi for select to authenticated using (is_admin());
drop policy if exists benevole_suivi_insert_admin on public.benevole_suivi;
create policy benevole_suivi_insert_admin on public.benevole_suivi for insert to authenticated with check (is_admin());
drop policy if exists benevole_suivi_update_admin on public.benevole_suivi;
create policy benevole_suivi_update_admin on public.benevole_suivi for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists benevole_suivi_delete_admin on public.benevole_suivi;
create policy benevole_suivi_delete_admin on public.benevole_suivi for delete to authenticated using (is_admin());

drop policy if exists user_profiles_select_authenticated on public.user_profiles;
create policy user_profiles_select_authenticated on public.user_profiles for select to authenticated using (true);
drop policy if exists "user_profiles insert admin" on public.user_profiles;
create policy "user_profiles insert admin" on public.user_profiles for insert to public with check (is_admin());
drop policy if exists "user_profiles update admin" on public.user_profiles;
create policy "user_profiles update admin" on public.user_profiles for update to public using (is_admin()) with check (is_admin());
drop policy if exists "user_profiles delete admin" on public.user_profiles;
create policy "user_profiles delete admin" on public.user_profiles for delete to public using (is_admin());

-- Règles des nouvelles tables : retirées (état de l'étape 1)
drop policy if exists themes_progression_select on public.themes_progression;
drop policy if exists themes_progression_insert on public.themes_progression;
drop policy if exists themes_progression_update on public.themes_progression;
drop policy if exists themes_progression_delete on public.themes_progression;
drop policy if exists qcm_examens_select on public.qcm_examens;
drop policy if exists qcm_examens_insert on public.qcm_examens;
drop policy if exists qcm_examens_update on public.qcm_examens;
drop policy if exists qcm_examens_delete on public.qcm_examens;
drop policy if exists promos_select on public.promos;
drop policy if exists promos_update_nom on public.promos;
drop policy if exists lieux_select on public.lieux;

-- Fonctions telles que relevées le 01/10
create or replace function public.my_stagiaire_id()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select stagiaire_id from user_profiles
  where lower(email) = lower((select auth.jwt() ->> 'email'))
  limit 1;
$$;

create or replace function public.qcm_exam_demarrable(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select q.published and (q.exam_ferme_a is null or now() < q.exam_ferme_a)
     from qcm q where q.id = p_qcm_id),
    false);
$$;

create or replace function public.qcm_exam_remise_toleree(p_qcm_id bigint)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select q.published and (
      q.exam_ferme_a is null
      or now() < q.exam_ferme_a + make_interval(secs =>
           coalesce(q.exam_seconds_per_question, 30) * coalesce(
             case when jsonb_typeof(q.exam_question_ids) = 'array'
                  then jsonb_array_length(q.exam_question_ids) end,
             q.exam_nb_questions,
             (select count(*)::int from qcm_questions qq where qq.qcm_id = q.id),
             0))
    )
    from qcm q where q.id = p_qcm_id), false);
$$;

create or replace function public.epcf_moyennes(p_trame text)
returns table(critere text, moyenne numeric, effectif integer)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with dernieres as (
    select distinct on (stagiaire_id) scores
    from epcf_evaluations
    where trame = p_trame and contexte = 'EPCF' and auto_eval = false
    order by stagiaire_id, date_eval desc, id desc
  ),
  notes as (
    select k.key as critere,
           case k.value when 'A' then 2 when 'R' then 1 when 'NA' then 0 end as val
    from dernieres d, jsonb_each_text(d.scores) k
    where k.value in ('A','R','NA')
  )
  select critere, round(avg(val)::numeric, 3) as moyenne, count(*)::integer as effectif
  from notes
  group by critere;
$$;

create or replace function public.set_date_naissance(p_stagiaire_id integer, p_date date)
returns void language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not (is_admin() or is_prof() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  update stagiaires set date_naissance = p_date where id = p_stagiaire_id;
end;
$$;

create or replace function public.benevoles_noms()
returns table(id integer, display text)
language sql stable security definer
set search_path to 'public'
as $$
  select b.id,
         case when coalesce(trim(b.nom), '') <> ''
              then upper(left(trim(b.nom), 1)) || '. ' || b.prenom
              else b.prenom
         end
  from public.benevoles b;
$$;

drop function if exists public.venues_benevoles();

create or replace function public.diag_entete_promo()
returns text language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> 'x-promo-id';
$$;
grant execute on function public.diag_entete_promo() to anon, authenticated;
```

- [ ] **Étape 3 : répétition complète dans une transaction annulée**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && { echo "begin;"; cat tests/sql/multi-promo-photo.sql supabase/migrations/20261001_multi_promo_2_cloisonnement.sql tests/sql/multi-promo-preuve.sql; } > "$SCRATCH/repetition-etape2.sql" && wc -l "$SCRATCH/repetition-etape2.sql"
```

Passer le contenu à `execute_sql`. Attendu : `VERDICT VERT`, les contrôles « non-régression : ... »
compris (90 lignes de photo). En cas de `ROUGE` : lire chaque ligne, corriger la migration (ou le
calcul attendu s'il trahit la spec), recommencer. Ensuite, vérifier qu'il ne reste rien :
`select to_regprocedure('public.diag_entete_promo()') is not null as sonde_toujours_la;` → `true`.

- [ ] **Étape 4 : répétition de la marche arrière**

Lot : `begin;` + migration 2 + retour 2 + `tests/sql/multi-promo-1-verif.sql`. Attendu :
`VERDICT VERT` (on retrouve exactement l'état de l'étape 1).

- [ ] **Étape 5 : annoncer à Timy, puis appliquer**

`apply_migration` avec `name = "multi_promo_2_cloisonnement"` et le contenu exact du fichier.

- [ ] **Étape 6 : prouver sur la base réelle**

Passer `tests/sql/multi-promo-preuve.sql` seul à `execute_sql`. Attendu : `VERDICT VERT`. Puis
`node scripts/verifier-embarquements.mjs` → `Toutes les jointures se résolvent`. Puis
`get_advisors` (sécurité) : aucune alerte nouvelle.

- [ ] **Étape 7 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && grep -rn $'\xe2\x80\x94' supabase/migrations/20261001_multi_promo_2_*; git add supabase/migrations/20261001_multi_promo_2_cloisonnement.sql supabase/migrations/20261001_multi_promo_2_cloisonnement_retour.sql && git commit -q -m "Multi-promo, etape 2 : regles d'acces par promo et par lieu, marche arriere

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 5 : Migrations de bascule (étape 3) et de ménage (étape 5), écrites et répétées

**Fichiers :**
- Créer : `supabase/migrations/20261001_multi_promo_3_bascule.sql`
- Créer : `supabase/migrations/20261001_multi_promo_3_bascule_retour.sql`
- Créer : `supabase/migrations/20261001_multi_promo_5_menage.sql`

**Interfaces :**
- Consomme : état « étape 2 ». Noms de contraintes vérifiés le 01/10 : `planning_entries_unique`,
  `planning_half_meta_semaine_lundi_day_index_half_day_key`,
  `planning_jours_off_semaine_lundi_day_index_key`, `stagiaires_prenom_key`, `settings_pkey`
  (clé primaire sur `key`).
- Produit : fichiers versionnés, appliqués seulement aux Tâches 16 et 18.

- [ ] **Étape 1 : écrire `supabase/migrations/20261001_multi_promo_3_bascule.sql`**

```sql
-- Multi-promo, bascule (étape 3), à appliquer APRÈS la mise en ligne de la nouvelle
-- version : les anciennes unicités sans promo disparaissent, septembre peut écrire son
-- planning et ses réglages. Une version ancienne de l'app ne sait plus enregistrer le
-- planning ni les réglages ensuite (erreur visible) : prévenir les formateurs.
-- Marche arrière : 20261001_multi_promo_3_bascule_retour.sql
alter table public.planning_entries   drop constraint if exists planning_entries_unique;
alter table public.planning_half_meta drop constraint if exists planning_half_meta_semaine_lundi_day_index_half_day_key;
alter table public.planning_jours_off drop constraint if exists planning_jours_off_semaine_lundi_day_index_key;
alter table public.stagiaires         drop constraint if exists stagiaires_prenom_key;
alter table public.settings           drop constraint if exists settings_pkey;
alter table public.settings           add constraint settings_pkey primary key (id);
```

- [ ] **Étape 2 : écrire `supabase/migrations/20261001_multi_promo_3_bascule_retour.sql`**

```sql
-- Marche arrière de la bascule. Échoue si septembre a déjà une carte, un horaire, un jour
-- off, un prénom ou une clé de réglage qui existe aussi en mars : corriger en avant.
alter table public.settings           drop constraint if exists settings_pkey;
alter table public.settings           add constraint settings_pkey primary key (key);
alter table public.stagiaires         add constraint stagiaires_prenom_key unique (prenom);
alter table public.planning_jours_off add constraint planning_jours_off_semaine_lundi_day_index_key
  unique (semaine_lundi, day_index);
alter table public.planning_half_meta add constraint planning_half_meta_semaine_lundi_day_index_half_day_key
  unique (semaine_lundi, day_index, half_day);
alter table public.planning_entries   add constraint planning_entries_unique
  unique (semaine_lundi, day_index, half_day, slot, lane);
```

- [ ] **Étape 3 : écrire `supabase/migrations/20261001_multi_promo_5_menage.sql`**

```sql
-- Multi-promo, ménage (étape 5), quand plus aucun appareil ne tourne sur une version
-- antérieure à la Tâche 15 : la synchronisation de bascule et les anciennes colonnes de
-- progression et d'examen disparaissent. Pas de marche arrière utile : tout vit dans
-- themes_progression et qcm_examens.
drop trigger if exists trg_sync_themes_progression on public.themes;
drop trigger if exists trg_sync_progression_themes on public.themes_progression;
drop trigger if exists trg_sync_qcm_examens on public.qcm;
drop trigger if exists trg_sync_examens_qcm on public.qcm_examens;
drop function if exists public.sync_themes_vers_progression();
drop function if exists public.sync_progression_vers_themes();
drop function if exists public.sync_qcm_vers_examens();
drop function if exists public.sync_examens_vers_qcm();
alter table public.themes
  drop column if exists statut, drop column if exists date_fait, drop column if exists date_qcm,
  drop column if exists notes, drop column if exists updated_by_email;
alter table public.qcm
  drop column if exists published, drop column if exists published_by_email,
  drop column if exists published_at, drop column if exists exam_nb_questions,
  drop column if exists exam_question_ids, drop column if exists exam_draw_mode,
  drop column if exists exam_seconds_per_question, drop column if exists exam_ferme_a;
delete from public.settings where promo_id is null and key in ('cohort_name', 'password_hash');
```

- [ ] **Étape 4 : répéter la bascule et son retour**

Lot : `begin;` + bascule + le bloc suivant :

```sql
do $$
declare n integer; pk text;
begin
  select count(*) into n from pg_constraint where conname in ('planning_entries_unique',
    'planning_half_meta_semaine_lundi_day_index_half_day_key',
    'planning_jours_off_semaine_lundi_day_index_key', 'stagiaires_prenom_key');
  select pg_get_constraintdef(oid) into pk from pg_constraint
   where conrelid = 'public.settings'::regclass and contype = 'p';
  raise exception 'VERDICT % : % ancienne(s) unicité(s), clé de settings %',
    case when n = 0 and pk = 'PRIMARY KEY (id)' then 'VERT' else 'ROUGE' end, n, pk;
end $$;
```

Attendu : `VERDICT VERT : 0 ancienne(s) unicité(s), clé de settings PRIMARY KEY (id)`. Puis le lot
`begin;` + bascule + retour + `tests/sql/multi-promo-preuve.sql` → `VERDICT VERT`.

- [ ] **Étape 5 : répéter le ménage**

Lot : `begin;` + bascule + ménage + `tests/sql/multi-promo-preuve.sql`. Attendu : `VERDICT VERT`
(la preuve ne dépend pas des anciennes colonnes).

- [ ] **Étape 6 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && grep -rn $'\xe2\x80\x94' supabase/migrations/20261001_multi_promo_3_* supabase/migrations/20261001_multi_promo_5_*; git add supabase/migrations/20261001_multi_promo_3_bascule.sql supabase/migrations/20261001_multi_promo_3_bascule_retour.sql supabase/migrations/20261001_multi_promo_5_menage.sql && git commit -q -m "Multi-promo : migrations de bascule (etape 3) et de menage (etape 5), non appliquees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

# Partie B : l'application (étape 3)

### Tâche 6 : Règles pures `js/promo-rules.js`

**Fichiers :**
- Créer : `tests/promo-rules.test.mjs`
- Créer : `js/promo-rules.js`

**Interfaces :**
- Consomme : rien (module sans import).
- Produit : `ENTETE_PROMO` (`"x-promo-id"`), `doitPorterEntetePromo(url, supabaseUrl) → boolean`,
  `choisirPromoInitiale(promos, memorisee) → number|null`, `libelleCourtPromo(promo, promos) →
  string`, `profilEffectif(profil, promo) → object|null`, `CHAMPS_PROGRESSION`, `CHAMPS_EXAMEN`,
  `separerChamps(patch, champs) → { dans, hors }`, `fusionnerProgression(theme) → theme`,
  `fusionnerExamen(qcm) → qcm`. Une ligne de promo a la forme renvoyée par `mes_promos()` :
  `{ id, nom, lieu_id, lieu_nom, date_debut, date_fin, par_defaut, stagiaire_id }`.

- [ ] **Étape 1 : écrire le test `tests/promo-rules.test.mjs`**

```js
import assert from "node:assert/strict";
import {
  ENTETE_PROMO, doitPorterEntetePromo, choisirPromoInitiale, libelleCourtPromo, profilEffectif,
  CHAMPS_PROGRESSION, CHAMPS_EXAMEN, separerChamps, fusionnerProgression, fusionnerExamen,
} from "../js/promo-rules.js";

const SB = "https://exemple.supabase.co";

// En-tête : l'API de données oui, les fonctions Edge, l'auth et le stockage non.
assert.equal(ENTETE_PROMO, "x-promo-id");
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/planning_entries?select=*", SB), true);
assert.equal(doitPorterEntetePromo(SB + "/rest/v1/rpc/mes_promos", SB), true);
assert.equal(doitPorterEntetePromo(SB + "/functions/v1/chatbot", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/auth/v1/token?grant_type=password", SB), false);
assert.equal(doitPorterEntetePromo(SB + "/storage/v1/object/qcm-images/a.png", SB), false);
assert.equal(doitPorterEntetePromo("https://autre.example/rest/v1/x", SB), false);
assert.equal(doitPorterEntetePromo(undefined, SB), false);

const MARS = { id: 1, nom: "Nîmes, mars 2026", lieu_id: 1, lieu_nom: "Nîmes",
  date_debut: "2026-03-30", par_defaut: true, stagiaire_id: 15 };
const SEPT = { id: 2, nom: "Nîmes, septembre 2026", lieu_id: 1, lieu_nom: "Nîmes",
  date_debut: "2026-09-30", par_defaut: false, stagiaire_id: null };
const MTP = { id: 3, nom: "Montpellier, janvier 2027", lieu_id: 2, lieu_nom: "Montpellier",
  date_debut: "2027-01-11", par_defaut: false, stagiaire_id: null };

// Promo de départ : la mémorisée si elle est encore accessible, sinon celle par défaut.
assert.equal(choisirPromoInitiale([MARS, SEPT], "2"), 2);
assert.equal(choisirPromoInitiale([MARS, SEPT], 2), 2);
assert.equal(choisirPromoInitiale([MARS, SEPT], "7"), 1);
assert.equal(choisirPromoInitiale([MARS, SEPT], null), 1);
assert.equal(choisirPromoInitiale([MARS, SEPT], ""), 1);
assert.equal(choisirPromoInitiale([MARS, SEPT], "abc"), 1);
assert.equal(choisirPromoInitiale([SEPT], null), 2);
assert.equal(choisirPromoInitiale([], "1"), null);
assert.equal(choisirPromoInitiale(null, "1"), null);

// Libellé court : mois et année, précédé du lieu seulement si plusieurs lieux.
assert.equal(libelleCourtPromo(MARS, [MARS, SEPT]), "mars 2026");
assert.equal(libelleCourtPromo(SEPT, [MARS, SEPT]), "sept. 2026");
assert.equal(libelleCourtPromo(MTP, [MARS, SEPT, MTP]), "Montpellier · janv. 2027");
assert.equal(libelleCourtPromo(SEPT, [MARS, SEPT, MTP]), "Nîmes · sept. 2026");
assert.equal(libelleCourtPromo(null, [MARS]), "");

// Profil effectif dans la promo courante.
const FONDATEUR = { email: "f@example.test", role: "stagiaire", stagiaire_id: 15, is_admin: true, is_founder: true };
assert.deepEqual(profilEffectif(FONDATEUR, MARS), { ...FONDATEUR, stagiaire_id: 15, role: "stagiaire" });
assert.deepEqual(profilEffectif(FONDATEUR, SEPT), { ...FONDATEUR, stagiaire_id: null, role: "admin" });
const FORMATEUR = { email: "h@example.test", role: "prof", stagiaire_id: null, prof_id: 1, is_admin: true };
assert.deepEqual(profilEffectif(FORMATEUR, SEPT), { ...FORMATEUR, stagiaire_id: null, role: "prof" });
assert.deepEqual(profilEffectif(FONDATEUR, null), FONDATEUR);
assert.equal(profilEffectif(null, MARS), null);

// Séparation d'un patch.
assert.deepEqual(separerChamps({ statut: "Fait", date_fait: "2026-10-02", titre: "X" }, CHAMPS_PROGRESSION),
  { dans: { statut: "Fait", date_fait: "2026-10-02" }, hors: { titre: "X" } });
assert.deepEqual(separerChamps(undefined, CHAMPS_PROGRESSION), { dans: {}, hors: {} });
assert.deepEqual(separerChamps({ exam_seconds_per_question: 45, titre: "Q" }, CHAMPS_EXAMEN),
  { dans: { exam_seconds_per_question: 45 }, hors: { titre: "Q" } });

// Fusion de la progression : les anciennes colonnes du thème sont toujours écrasées.
const THEME = { id: 5, numero: 5, titre: "T", type: "theme", statut: "Fait", date_fait: "2026-05-01",
  date_qcm: "2026-05-02", notes: "vieux", updated_by_email: "vieux@example.test" };
assert.deepEqual(fusionnerProgression({ ...THEME, progression: [] }),
  { id: 5, numero: 5, titre: "T", type: "theme", statut: "À faire", date_fait: null, date_qcm: null,
    notes: null, updated_by_email: null });
assert.deepEqual(fusionnerProgression({ ...THEME, progression: [{ statut: "Fait", date_fait: "2026-10-05",
  date_qcm: null, notes: null, updated_by_email: "h@example.test" }] }),
  { id: 5, numero: 5, titre: "T", type: "theme", statut: "Fait", date_fait: "2026-10-05", date_qcm: null,
    notes: null, updated_by_email: "h@example.test" });
assert.equal(fusionnerProgression({ ...THEME }).statut, "À faire");

// Fusion de l'état d'examen : un QCM sans ligne d'examen dans la promo est fermé.
const QCM = { id: 50, theme_id: 5, titre: "Q", published: true, exam_seconds_per_question: 45,
  exam_ferme_a: "2026-09-01T10:00:00Z", qcm_questions: [{ count: 3 }] };
const ferme = fusionnerExamen({ ...QCM, examen: [] });
assert.equal(ferme.published, false);
assert.equal(ferme.exam_seconds_per_question, 30);
assert.equal(ferme.exam_ferme_a, null);
assert.deepEqual(ferme.qcm_questions, [{ count: 3 }]);
assert.equal("examen" in ferme, false);
const ouvert = fusionnerExamen({ ...QCM, examen: [{ published: true, published_by_email: "h@example.test",
  published_at: "2026-10-02T08:00:00Z", exam_nb_questions: 2, exam_question_ids: [1, 2],
  exam_draw_mode: "manual", exam_seconds_per_question: 20, exam_ferme_a: null }] });
assert.equal(ouvert.published, true);
assert.equal(ouvert.exam_seconds_per_question, 20);
assert.deepEqual(ouvert.exam_question_ids, [1, 2]);
assert.equal(ouvert.exam_draw_mode, "manual");
assert.deepEqual([...CHAMPS_EXAMEN].sort(), ["exam_draw_mode", "exam_ferme_a", "exam_nb_questions",
  "exam_question_ids", "exam_seconds_per_question", "published", "published_at", "published_by_email"]);

console.log("promo-rules : 43 assertions OK");
```

- [ ] **Étape 2 : le lancer, il doit échouer**

Run : `cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node tests/promo-rules.test.mjs`
Attendu : `ERR_MODULE_NOT_FOUND` (le module n'existe pas).

- [ ] **Étape 3 : écrire `js/promo-rules.js`**

```js
/*
 * Multi-promo : règles pures, sans réseau ni DOM (spec
 * docs/superpowers/specs/2026-10-01-multi-promo-design.md), testées par
 * `node tests/promo-rules.test.mjs`. L'autorité reste la base : ces fonctions décident
 * seulement de ce que l'app envoie (l'en-tête de promo) et de la façon dont elle
 * présente ce que la base renvoie.
 */

export const ENTETE_PROMO = "x-promo-id";

// L'en-tête ne part que vers l'API de données (tables et RPC). Les fonctions Edge le
// refusent en CORS ; l'authentification et le stockage n'en ont pas l'usage.
export function doitPorterEntetePromo(url, supabaseUrl) {
  return typeof url === "string" && !!supabaseUrl && url.startsWith(supabaseUrl + "/rest/v1/");
}

// Promo de départ : celle mémorisée sur l'appareil si elle est toujours accessible,
// sinon celle que la base marque par défaut, sinon la première de la liste.
export function choisirPromoInitiale(promos, memorisee) {
  if (!Array.isArray(promos) || promos.length === 0) return null;
  const voulue = Number(memorisee);
  if (memorisee != null && memorisee !== "" && Number.isInteger(voulue)
      && promos.some((p) => p.id === voulue)) {
    return voulue;
  }
  return (promos.find((p) => p.par_defaut) || promos[0]).id;
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// « sept. 2026 » ; précédé du lieu (« Nîmes · sept. 2026 ») dès que les promos
// accessibles couvrent plusieurs lieux, sinon deux promos du même mois se confondraient.
export function libelleCourtPromo(promo, promos = []) {
  if (!promo) return "";
  const [annee, mois] = String(promo.date_debut || "").split("-");
  const base = [MOIS_COURTS[Number(mois) - 1], annee].filter(Boolean).join(" ");
  const lieux = new Set((promos || []).map((p) => p.lieu_id));
  return lieux.size > 1 && promo.lieu_nom ? `${promo.lieu_nom} · ${base}` : base;
}

// Profil dans la promo courante : l'identité stagiaire vient de la promo (mes_promos),
// et un compte de rôle stagiaire sans fiche dans cette promo (cas du fondateur) y est un
// admin pur. Sans promo connue, le profil reste brut.
export function profilEffectif(profil, promo) {
  if (!profil) return null;
  if (!promo) return profil;
  const stagiaire_id = promo.stagiaire_id ?? null;
  const role = profil.role === "stagiaire" && stagiaire_id == null ? "admin" : profil.role;
  return { ...profil, stagiaire_id, role };
}

export const CHAMPS_PROGRESSION = ["statut", "date_fait", "date_qcm", "notes", "updated_by_email"];

const DEFAUTS_EXAMEN = {
  published: false,
  published_by_email: null,
  published_at: null,
  exam_nb_questions: null,
  exam_question_ids: null,
  exam_draw_mode: null,
  exam_seconds_per_question: 30,
  exam_ferme_a: null,
};
export const CHAMPS_EXAMEN = Object.keys(DEFAUTS_EXAMEN);

// Sépare un patch : les champs listés (propres à la promo) et les autres (communs).
export function separerChamps(patch, champs) {
  const dans = {};
  const hors = {};
  for (const [cle, valeur] of Object.entries(patch || {})) {
    (champs.includes(cle) ? dans : hors)[cle] = valeur;
  }
  return { dans, hors };
}

// Thème lu avec sa progression embarquée (`progression` : la ligne de la promo courante,
// ou rien). Les anciennes colonnes du thème sont TOUJOURS écrasées : pendant la bascule
// elles portent encore les valeurs de mars, qui ne doivent jamais apparaître ailleurs.
export function fusionnerProgression(theme) {
  const { progression, ...referentiel } = theme || {};
  const p = (Array.isArray(progression) ? progression[0] : progression) || {};
  return {
    ...referentiel,
    statut: p.statut ?? "À faire",
    date_fait: p.date_fait ?? null,
    date_qcm: p.date_qcm ?? null,
    notes: p.notes ?? null,
    updated_by_email: p.updated_by_email ?? null,
  };
}

// QCM lu avec l'état d'examen de la promo courante embarqué (`examen`). Même règle :
// les anciennes colonnes d'examen sont écrasées ; sans état dans la promo, l'examen est fermé.
export function fusionnerExamen(qcm) {
  const { examen, ...banque } = qcm || {};
  const e = (Array.isArray(examen) ? examen[0] : examen) || {};
  const sortie = { ...banque };
  for (const [cle, defaut] of Object.entries(DEFAUTS_EXAMEN)) sortie[cle] = e[cle] ?? defaut;
  return sortie;
}
```

- [ ] **Étape 4 : relancer le test**

Run : `cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node tests/promo-rules.test.mjs`
Attendu : `promo-rules : 43 assertions OK` (`grep -c "assert\." tests/promo-rules.test.mjs` doit
afficher 43 : si un `assert` est ajouté ou retiré, mettre le nombre du `console.log` à jour).

- [ ] **Étape 5 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && grep -n $'\xe2\x80\x94' js/promo-rules.js tests/promo-rules.test.mjs; git add js/promo-rules.js tests/promo-rules.test.mjs && git commit -q -m "Multi-promo : regles pures (en-tete, promo de depart, libelle, profil effectif, fusions)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 7 : `db.js`, contexte de promo, en-tête, profil effectif, bascule

**Fichiers :**
- Modifier : `js/db.js` (imports, `fetchWithTimeout`, nouvelle section, `getMyProfile`)
- Modifier : `js/views/planning.js` (inscription de l'attente des enregistrements)

**Interfaces :**
- Consomme : `js/promo-rules.js` (Tâche 6), RPC `mes_promos()` (Tâche 1).
- Produit (exports de `db.js`) : `chargerMesPromos(email) → Promise<Array<promo>>`,
  `getMesPromos() → Array<promo>`, `getPromoCourante() → promo|null`, `oublierPromo() → void`,
  `avantChangementPromo(fn) → () => void`, `choisirPromo(id) → Promise<void>` (recharge la page),
  `renommerPromo(id, nom) → Promise<void>`. `getMyProfile()` renvoie le profil effectif.

- [ ] **Étape 1 : imports et état, en tête de `js/db.js`**

Remplacer :

```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=20261002b";
import { compteDansEquite } from "./passage-rules.js?v=20261002b";
```

par :

```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=20261002b";
import { compteDansEquite } from "./passage-rules.js?v=20261002b";
import {
  ENTETE_PROMO, doitPorterEntetePromo, choisirPromoInitiale, profilEffectif,
  separerChamps, CHAMPS_PROGRESSION, CHAMPS_EXAMEN, fusionnerProgression, fusionnerExamen,
} from "./promo-rules.js?v=20261002b";

// Contexte de promo (spec multi-promo, C.1). La promo courante voyage dans l'en-tête
// x-promo-id de chaque requête de données ; la base vérifie le droit et filtre.
let mesPromos = [];          // lignes renvoyées par la RPC mes_promos()
let promoCouranteId = null;  // nulle tant que le contexte n'est pas chargé : pas d'en-tête
let cleMemoire = null;       // clé localStorage propre au compte
const avantBascule = new Set();
```

(Jeton : reprendre celui des imports voisins s'il a changé, cf. Contraintes globales.)

- [ ] **Étape 2 : l'en-tête dans `fetchWithTimeout`**

Remplacer :

```js
  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}
```

par :

```js
  // En-tête de promo : seulement vers l'API de données (cf. promo-rules.js).
  let options = init;
  const url = typeof input === "string" ? input : String(input?.url ?? input);
  if (promoCouranteId != null && doitPorterEntetePromo(url, SUPABASE_URL)) {
    const entetes = new Headers(init.headers || {});
    entetes.set(ENTETE_PROMO, String(promoCouranteId));
    options = { ...init, headers: entetes };
  }
  return fetch(input, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}
```

- [ ] **Étape 3 : la section « Contexte de promo »**

Insérer juste avant la ligne `// === Stagiaires & Profs ===` :

```js
// === Contexte de promo ===

// Charge les promos accessibles et fixe la promo courante : celle mémorisée sur cet
// appareil si elle est toujours accessible, sinon celle par défaut. Appelée à chaque
// événement d'authentification : la promo en cours est CONSERVÉE tant qu'elle reste
// accessible (un renouvellement de jeton ne doit jamais faire changer de promo, ni
// envoyer une requête sans en-tête pendant le rechargement de la liste).
export async function chargerMesPromos(email) {
  cleMemoire = email ? "ecsr_promo:" + String(email).trim().toLowerCase() : null;
  const { data, error } = await supabase.rpc("mes_promos");
  if (error) throw error;
  mesPromos = data || [];
  let memorisee = null;
  try { memorisee = cleMemoire ? localStorage.getItem(cleMemoire) : null; } catch (e) { /* navigation privée */ }
  const garder = mesPromos.some((p) => p.id === promoCouranteId) ? promoCouranteId : null;
  const nouvelle = garder ?? choisirPromoInitiale(mesPromos, memorisee);
  if (nouvelle !== promoCouranteId) invalidateCache();
  promoCouranteId = nouvelle;
  return mesPromos;
}

export function getMesPromos() { return mesPromos; }

export function getPromoCourante() {
  return mesPromos.find((p) => p.id === promoCouranteId) || null;
}

// Déconnexion : le contexte est oublié en mémoire (le choix mémorisé, propre au compte, reste).
export function oublierPromo() {
  mesPromos = [];
  promoCouranteId = null;
  cleMemoire = null;
  invalidateCache();
}

// Un module qui a des écritures en vol (le planning) s'inscrit ici : la bascule les attend.
export function avantChangementPromo(fn) {
  avantBascule.add(fn);
  return () => avantBascule.delete(fn);
}

// Bascule : attendre les enregistrements en cours, mémoriser, recharger. Le rechargement
// vide aussi les caches et la pile Ctrl+Z, qui ne doit jamais rejouer une action d'une
// promo dans une autre.
export async function choisirPromo(id) {
  if (id === promoCouranteId || !mesPromos.some((p) => p.id === id)) return;
  for (const attendre of avantBascule) {
    try { await attendre(); } catch (e) { console.error("bascule de promo : attente", e); }
  }
  try { if (cleMemoire) localStorage.setItem(cleMemoire, String(id)); } catch (e) { /* ignore */ }
  location.reload();
}

export async function renommerPromo(id, nom) {
  const { error } = await supabase.from("promos").update({ nom }).eq("id", id);
  if (error) throw error;
  const promo = mesPromos.find((p) => p.id === id);
  if (promo) promo.nom = nom;
}
```

- [ ] **Étape 4 : profil effectif**

Dans `getMyProfile`, remplacer :

```js
  if (error) throw error;
  return data;
}

export async function deleteUserProfile(email) {
```

par :

```js
  if (error) throw error;
  // Profil effectif dans la promo courante (spec multi-promo C.3).
  return profilEffectif(data, getPromoCourante());
}

export async function deleteUserProfile(email) {
```

- [ ] **Étape 5 : le planning inscrit son attente**

Dans `js/views/planning.js`, ajouter `avantChangementPromo,` à la liste importée depuis
`"../db.js?v=20261002b"` (par exemple après `getVoitureAggregats, listFiches, getSalleAggregats,`),
puis insérer juste après la fonction `flushPendingInputs` (après sa `}` fermante) :

```js
// Une bascule de promo attend les enregistrements en cours du planning : une case en train
// de se sauver ne doit pas partir dans l'autre promo (spec multi-promo C.1).
avantChangementPromo(() => flushPendingInputs());
```

- [ ] **Étape 6 : contrôles de syntaxe et tests**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node --check js/db.js && node --check js/views/planning.js && node tests/promo-rules.test.mjs && grep -n $'\xe2\x80\x94' js/db.js js/views/planning.js
```

Attendu : aucune sortie de `node --check`, `promo-rules : 43 assertions OK`, aucun cadratin.
(`node --check` ne voit ni doublons de déclarations ni résolution de modules : le banc de la
Tâche 13 fait foi.)

- [ ] **Étape 7 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git add js/db.js js/views/planning.js && git commit -q -m "Multi-promo : contexte de promo dans db.js (en-tete, bascule, profil effectif)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 8 : `db.js`, thèmes, QCM, planning, réglages, venues, nom de famille

**Fichiers :**
- Modifier : `js/db.js`

**Interfaces :**
- Consomme : `separerChamps`, `CHAMPS_PROGRESSION`, `CHAMPS_EXAMEN`, `fusionnerProgression`,
  `fusionnerExamen` (Tâche 6) ; tables `themes_progression`, `qcm_examens`, RPC
  `venues_benevoles()` (Tâches 1 et 4).
- Produit : mêmes signatures publiques qu'avant pour `listThemes`, `updateTheme`, `addTheme`,
  `listQcmIndex`, `getQcmFull`, `publishQcm`, `unpublishQcm`, `setExamDraw`, `updateExamConfig`,
  `upsertPlanningEntry`, `upsertHalfMeta`, `setJourOff`, `getSetting`, `setSetting`,
  `listVenuesBenevoles` (lignes + `promo_id`, `promo_nom`) ; `addStagiaire(prenom, nom = null)` ;
  nouvelle `updateStagiaireNom(id, nom)`.

- [ ] **Étape 1 : thèmes**

Remplacer les trois fonctions `listThemes`, `updateTheme`, `addTheme` (de
`export async function listThemes() {` jusqu'à la fin de `addTheme`) par :

```js
export async function listThemes() {
  return cachedQuery("themes", async () => {
    const { data, error } = await supabase
      .from("themes")
      .select("*, progression:themes_progression(statut, date_fait, date_qcm, notes, updated_by_email)")
      .order("type")    // theme avant notion
      .order("ordre");
    if (error) throw error;
    // La base ne renvoie que la progression de la promo courante ; « À faire » sinon.
    return (data || []).map(fusionnerProgression);
  });
}

// Progression de la promo courante (promo_id posé par la base).
async function ecrireProgression(themeId, champs) {
  const { error } = await supabase
    .from("themes_progression")
    .upsert({ theme_id: themeId, ...champs }, { onConflict: "promo_id,theme_id" });
  if (error) throw error;
}

// Fait, dates et auteur vont à la progression de la promo ; le reste au référentiel commun.
export async function updateTheme(id, patch) {
  const { dans: progression, hors: referentiel } = separerChamps(patch, CHAMPS_PROGRESSION);
  if (Object.keys(progression).length) await ecrireProgression(id, progression);
  if (Object.keys(referentiel).length) {
    const { error } = await supabase.from("themes").update(referentiel).eq("id", id);
    if (error) throw error;
  }
  invalidateCache("themes");
}

export async function addTheme(t) {
  const { dans: progression, hors: referentiel } = separerChamps(t, CHAMPS_PROGRESSION);
  const { data, error } = await supabase.from("themes").insert(referentiel).select("id").single();
  if (error) throw error;
  if (Object.keys(progression).length) await ecrireProgression(data.id, progression);
  invalidateCache("themes");
}
```

- [ ] **Étape 2 : QCM**

Remplacer `listQcmIndex` et `getQcmFull` par :

```js
const SELECT_EXAMEN = "examen:qcm_examens(" + CHAMPS_EXAMEN.join(", ") + ")";

// Index léger des QCM : un par thème, avec le nombre de questions et l'état d'examen de
// la promo courante (fermé s'il n'existe pas, spec multi-promo C.4).
export async function listQcmIndex() {
  return cachedQuery("qcm_index", async () => {
    const { data, error } = await supabase
      .from("qcm")
      .select(`id, theme_id, titre, exam_pass_20, qcm_questions(count), ${SELECT_EXAMEN}`);
    if (error) throw error;
    return (data || []).map((q) => ({
      ...fusionnerExamen(q),
      nb_questions: q.qcm_questions?.[0]?.count ?? 0,
    }));
  });
}

// QCM complet (questions + options) pour le player, trié par ordre.
export async function getQcmFull(qcmId) {
  const { data, error } = await supabase
    .from("qcm")
    .select(`*, questions:qcm_questions(*, options:qcm_options(*)), ${SELECT_EXAMEN}`)
    .eq("id", qcmId)
    .single();
  if (error) throw error;
  const qcm = fusionnerExamen(data);
  (qcm.questions || []).sort((a, b) => a.ordre - b.ordre);
  (qcm.questions || []).forEach((q) => (q.options || []).sort((a, b) => a.ordre - b.ordre));
  return qcm;
}
```

Remplacer `publishQcm`, `unpublishQcm`, `setExamDraw`, `updateExamConfig` par :

```js
// État d'examen de la promo courante (promo_id posé par la base).
async function ecrireExamen(qcmId, champs) {
  const { error } = await supabase
    .from("qcm_examens")
    .upsert({ qcm_id: qcmId, ...champs }, { onConflict: "promo_id,qcm_id" });
  if (error) throw error;
  invalidateCache("qcm_index");
}

// Publie l'examen d'un QCM pour la promo courante et gèle le tirage. email = auteur.
export async function publishQcm(qcmId, { examQuestionIds, drawMode, nbQuestions, secondsPerQuestion, email, fermeA = null }) {
  await ecrireExamen(qcmId, {
    published: true,
    published_by_email: email ?? null,
    published_at: new Date().toISOString(),
    exam_question_ids: examQuestionIds,
    exam_draw_mode: drawMode,
    exam_nb_questions: nbQuestions ?? null,
    exam_seconds_per_question: secondsPerQuestion ?? 30,
    exam_ferme_a: fermeA,
  });
}

// Ferme l'examen (conserve le tirage gelé). L'échéance est remise à nul pour qu'un
// examen fermé ne garde pas d'échéance fantôme, qui réapparaîtrait à la réouverture.
export async function unpublishQcm(qcmId) {
  await ecrireExamen(qcmId, { published: false, exam_ferme_a: null });
}

// Régénère le tirage gelé sans toucher à l'état de publication.
export async function setExamDraw(qcmId, { examQuestionIds, drawMode, nbQuestions }) {
  await ecrireExamen(qcmId, {
    exam_question_ids: examQuestionIds,
    exam_draw_mode: drawMode,
    exam_nb_questions: nbQuestions ?? null,
  });
}

// Met à jour la config d'examen sans changer l'état de publication. Un champ qui ne
// relève pas de l'examen (titre...) va à la banque commune.
export async function updateExamConfig(qcmId, patch) {
  const { dans: examen, hors: banque } = separerChamps(patch, CHAMPS_EXAMEN);
  if (Object.keys(examen).length) await ecrireExamen(qcmId, examen);
  if (Object.keys(banque).length) {
    const { error } = await supabase
      .from("qcm")
      .update({ ...banque, updated_at: new Date().toISOString() })
      .eq("id", qcmId);
    if (error) throw error;
    invalidateCache("qcm_index");
  }
}
```

(Effet de bord voulu : `listQcmIndex` renvoie désormais aussi `exam_ferme_a`, ce qui fait
enfin afficher « Examen échu » au panneau formateur des thèmes quand l'échéance est passée.)

- [ ] **Étape 3 : cibles d'unicité du planning et des réglages**

Dans `upsertPlanningEntry` : `{ onConflict: "semaine_lundi,day_index,half_day,slot,lane" }` devient
`{ onConflict: "promo_id,semaine_lundi,day_index,half_day,slot,lane" }`.

Dans `upsertHalfMeta` : `{ onConflict: "semaine_lundi,day_index,half_day" }` devient
`{ onConflict: "promo_id,semaine_lundi,day_index,half_day" }`.

Dans `setJourOff` : `{ onConflict: "semaine_lundi,day_index" }` devient
`{ onConflict: "promo_id,semaine_lundi,day_index" }`.

Remplacer `setSetting` par :

```js
// Réglage propre à la promo courante (promo_id posé par la base). Porte d'entrée unique
// des modules du chantier B : aucune autre écriture dans la table settings.
export async function setSetting(key, value) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "promo_id,key" });
  if (error) throw error;
}
```

Et ajouter au-dessus de `getSetting` le commentaire :
`// Réglage de la promo courante (la base ne renvoie que ceux-là), ou null.`

- [ ] **Étape 4 : venues des bénévoles**

Remplacer `listVenuesBenevoles` par :

```js
// Toutes les cartes portant au moins un bénévole, sur les promos du lieu courant (la
// banque est commune au lieu). RPC réservée aux formateurs ; chaque ligne porte aussi
// promo_id et promo_nom. Pas de cache : le planning bouge tout le temps.
export async function listVenuesBenevoles() {
  const { data, error } = await supabase.rpc("venues_benevoles");
  if (error) throw error;
  return data || [];
}
```

- [ ] **Étape 5 : nom de famille des stagiaires**

Remplacer `addStagiaire` par la version qui accepte le nom, et ajouter `updateStagiaireNom` juste
après `updateStagiaire` :

```js
export async function addStagiaire(prenom, nom = null) {
  const { data: max } = await supabase
    .from("stagiaires")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1);
  const ordre = (max?.[0]?.ordre || 0) + 1;
  const { error } = await supabase.from("stagiaires").insert({ prenom, nom: nom || null, ordre });
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}
```

```js
// Nom de famille : sert à l'affichage « V. Timy » et au tri alphabétique.
export async function updateStagiaireNom(id, nom) {
  const { error } = await supabase.from("stagiaires").update({ nom: nom || null }).eq("id", id);
  if (error) throw error;
  invalidateCache("stagiaires");
  invalidateCache("stagiaires_all");
}
```

- [ ] **Étape 6 : contrôles**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node --check js/db.js && grep -n "onConflict" js/db.js && node scripts/verifier-embarquements.mjs && grep -n $'\xe2\x80\x94' js/db.js
```

Attendu : les cibles `promo_id,...` pour planning, horaires, jours off et réglages ; les autres
(`stagiaire_id`, `email`, `benevole_id,...`) inchangées ; jointures toutes `ok`.

- [ ] **Étape 7 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git add js/db.js && git commit -q -m "Multi-promo : themes, examens, planning et reglages propres a la promo dans db.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 9 : Démarrage et pastille

**Fichiers :**
- Créer : `js/promo-pastille.js`
- Modifier : `js/auth-admin.js`
- Modifier : `css/style.css` (bloc en fin de fichier)

**Interfaces :**
- Consomme : `chargerMesPromos`, `oublierPromo`, `getMesPromos`, `getPromoCourante`,
  `choisirPromo` (Tâche 7) ; `libelleCourtPromo` (Tâche 6).
- Produit : `construirePastille() → HTMLElement|null` (`js/promo-pastille.js`).

- [ ] **Étape 1 : écrire `js/promo-pastille.js`**

```js
// Pastille de la promo affichée (spec multi-promo C.2) : visible seulement à qui a au
// moins deux promos (formateurs, fondateur). Un appui ouvre le choix ; choisir une autre
// promo attend les enregistrements en cours puis recharge la page (choisirPromo).
import { el } from "./utils.js?v=20261002b";
import { getMesPromos, getPromoCourante, choisirPromo } from "./db.js?v=20261002b";
import { libelleCourtPromo } from "./promo-rules.js?v=20261002b";

export function construirePastille() {
  const promos = getMesPromos();
  const courante = getPromoCourante();
  if (promos.length < 2 || !courante) return null;
  return el("button", {
    class: "promo-pastille", type: "button", "aria-haspopup": "dialog",
    title: "Promo affichée : " + courante.nom,
    onClick: ouvrirChoix,
  },
    el("span", { class: "promo-pastille-texte" }, libelleCourtPromo(courante, promos)),
    el("span", { class: "promo-pastille-fleche", "aria-hidden": "true" }, "▾"),
  );
}

function ouvrirChoix() {
  const promos = getMesPromos();
  const courante = getPromoCourante();
  const backdrop = el("div", { class: "modal-backdrop" });
  const liste = el("div", { class: "promo-choix-liste", role: "radiogroup", "aria-label": "Promo affichée" });
  promos.forEach((p) => {
    const active = p.id === courante?.id;
    liste.appendChild(el("button", {
      class: "promo-choix" + (active ? " active" : ""), type: "button", role: "radio",
      "aria-checked": active ? "true" : "false",
      onClick: async () => {
        if (active) { backdrop.remove(); return; }
        liste.classList.add("en-cours");
        await choisirPromo(p.id);
      },
    },
      el("span", { class: "promo-choix-puce", "aria-hidden": "true" }, active ? "●" : "○"),
      el("span", {}, p.nom),
    ));
  });
  const modal = el("div", { class: "modal promo-choix-modal" },
    el("h3", {}, "Promo affichée"),
    el("p", { class: "muted" }, "Ton choix est mémorisé sur cet appareil."),
    liste,
    el("div", { class: "modal-actions" },
      el("button", { class: "btn ghost", type: "button", onClick: () => backdrop.remove() }, "Fermer"),
    ),
  );
  backdrop.appendChild(modal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}
```

- [ ] **Étape 2 : imports de `js/auth-admin.js`**

Remplacer :

```js
import {
  getCurrentUser, signOut, onAuthChange,
  getMyProfile, listStagiaires, listProfs,
} from "./db.js?v=20261002b";
import { el, toast, displayStagiaire } from "./utils.js?v=20261002b";
import { icon } from "./icons.js?v=20261002b";
```

par :

```js
import {
  getCurrentUser, signOut, onAuthChange,
  getMyProfile, listStagiaires, listProfs,
  chargerMesPromos, oublierPromo,
} from "./db.js?v=20261002b";
import { el, toast, displayStagiaire } from "./utils.js?v=20261002b";
import { icon } from "./icons.js?v=20261002b";
import { construirePastille } from "./promo-pastille.js?v=20261002b";
```

- [ ] **Étape 3 : démarrage dans `js/auth-admin.js`**

Remplacer toute la fonction `initAuth` (de `export async function initAuth() {` à sa `}` fermante,
avant `export function onAdminChange`) par :

```js
// Contexte de promo AVANT toute lecture (spec multi-promo C.1). Faux si le compte n'a
// accès à aucune promo. Une panne réseau n'empêche pas d'entrer : sans en-tête, la base
// répond sur la promo par défaut de la personne.
async function chargerContextePromo(user) {
  try {
    const promos = await chargerMesPromos(user.email);
    return promos.length > 0;
  } catch (e) {
    console.error("mes_promos indisponible, promo par défaut", e);
    return true;
  }
}

const MESSAGE_SANS_PROMO = "Aucune promo n'est associée à ton compte. Demande à un formateur.";

export async function initAuth() {
  currentUser = await getCurrentUser();
  if (currentUser) {
    if (!(await chargerContextePromo(currentUser))) {
      await signOut();
      currentUser = null;
      toast(MESSAGE_SANS_PROMO, "error", 5000);
    } else {
      // Les annuaires ne sont lisibles qu'authentifié (RLS) → charger après l'auth.
      await loadDirectories();
      await refreshProfile();
      if (!currentProfile) {
        // Connecté mais pas dans user_profiles → kick out
        await signOut();
        currentUser = null;
        toast("Ton compte n'est plus autorisé. Demande une invitation.", "error", 5000);
      }
    }
  }

  onAuthChange(async (user) => {
    currentUser = user;
    if (user) {
      if (!(await chargerContextePromo(user))) {
        await signOut();
        currentUser = null;
        currentProfile = null;
        toast(MESSAGE_SANS_PROMO, "error", 5000);
      } else {
        await loadDirectories();
        await refreshProfile();
        if (!currentProfile) {
          await signOut();
          currentUser = null;
          toast("Email non invité. Demande à un admin de te whitelister.", "error", 5000);
        }
      }
    } else {
      currentProfile = null;
      oublierPromo();
    }
    listeners.forEach((cb) => cb(currentUser, currentProfile));
    updateBadge();
  });
  updateBadge();
}
```

- [ ] **Étape 4 : la pastille dans la barre**

Dans `updateBadge`, remplacer :

```js
  const who = getProfileWho() || currentUser.email;
```

par :

```js
  // Pastille de promo devant le badge (formateurs et fondateur, au moins deux promos).
  const pastille = construirePastille();
  if (pastille) slot.appendChild(pastille);
  slot.classList.toggle("avec-pastille", !!pastille);

  const who = getProfileWho() || currentUser.email;
```

- [ ] **Étape 5 : styles, en FIN de `css/style.css`**

```css
/* ===== Multi-promo : pastille de la promo affichée (2026-10) =====
   Devant le badge du nom ; visible seulement à qui a au moins deux promos. Sur
   téléphone, la flèche et la pastille de rôle du badge s'effacent pour tenir
   dans la barre. */
#admin-slot { display: flex; align-items: center; gap: 0.4rem; }
.promo-pastille {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(245, 232, 208, 0.25);
  background: rgba(245, 232, 208, 0.08);
  color: #F5E8D0;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.promo-pastille:hover { background: rgba(245, 232, 208, 0.16); }
.promo-pastille-fleche { font-size: 0.7rem; opacity: 0.7; }
.promo-choix-liste {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0.8rem 0;
}
.promo-choix {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--bg-elev);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.promo-choix.active { border-color: var(--accent); background: var(--bg-subtle); font-weight: 600; }
.promo-choix-puce { color: var(--accent); }
.promo-choix-liste.en-cours { opacity: 0.6; pointer-events: none; }
.config-list .config-nom { flex: 0 1 40%; }
@media (max-width: 760px) {
  .promo-pastille { padding: 0.35rem 0.5rem; font-size: 0.74rem; }
  .promo-pastille-fleche { display: none; }
  #admin-slot.avec-pastille .admin-role { display: none; }
}
```

- [ ] **Étape 6 : contrôles**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node --check js/promo-pastille.js && node --check js/auth-admin.js && grep -n $'\xe2\x80\x94' js/promo-pastille.js js/auth-admin.js css/style.css | tail -3
```

Attendu : aucune sortie (le `tail` de `css/style.css` ne doit montrer aucun cadratin nouveau ; le
fichier en est à zéro depuis le 09/08).

- [ ] **Étape 7 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git add js/promo-pastille.js js/auth-admin.js css/style.css && git commit -q -m "Multi-promo : promos chargees avant toute lecture, pastille de choix dans la barre

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 10 : Paramètres, promo affichée et nom de famille

**Fichiers :**
- Modifier : `js/views/config.js`

**Interfaces :**
- Consomme : `getPromoCourante`, `renommerPromo`, `addStagiaire(prenom, nom)`,
  `updateStagiaireNom` (Tâches 7 et 8).
- Produit : section « Promo » enrichie.

- [ ] **Étape 1 : imports**

Remplacer :

```js
  addStagiaire, updateStagiaire, deleteStagiaire, setStagiaireActif,
```

par :

```js
  addStagiaire, updateStagiaire, updateStagiaireNom, deleteStagiaire, setStagiaireActif,
  getPromoCourante, renommerPromo,
```

- [ ] **Étape 2 : bloc « Promo affichée »**

Dans `renderPromoSection`, juste après la ligne
`const stagiairesAbandon = allStagiaires.filter((s) => s.actif === false);`, insérer :

```js
  // Promo affichée : nom modifiable par les admins, lieu en lecture (spec multi-promo C.5).
  function renderPromoCourante() {
    const promo = getPromoCourante();
    if (!promo) return null;
    const wrap = el("div", { class: "param-block" });
    wrap.appendChild(el("div", { class: "block-head" },
      el("h4", {}, "Promo affichée"),
      el("span", { class: "count" }, "Lieu : " + (promo.lieu_nom || "non renseigné")),
    ));
    const nomPromo = el("input", { type: "text", value: promo.nom, "aria-label": "Nom de la promo",
      readonly: admin ? undefined : true });
    if (admin) {
      nomPromo.addEventListener("blur", async () => {
        const v = nomPromo.value.trim();
        if (!v || v === promo.nom) { nomPromo.value = promo.nom; return; }
        try {
          await renommerPromo(promo.id, v);
          toast("Nom de la promo mis à jour", "success");
        } catch (e) {
          nomPromo.value = promo.nom;
          toast(e.message, "error");
        }
      });
      nomPromo.addEventListener("keydown", (e) => { if (e.key === "Enter") nomPromo.blur(); });
    }
    wrap.appendChild(el("ul", { class: "config-list" }, el("li", {}, nomPromo)));
    return wrap;
  }
```

Puis remplacer :

```js
  section.appendChild(renderList(stagiairesActifs, "stagiaire"));
```

par :

```js
  const blocPromo = renderPromoCourante();
  if (blocPromo) section.appendChild(blocPromo);
  section.appendChild(renderList(stagiairesActifs, "stagiaire"));
```

- [ ] **Étape 3 : formateurs communs**

Remplacer :

```js
      el("h4", {}, type === "stagiaire" ? "Stagiaires" : "Formateurs"),
```

par :

```js
      el("h4", {}, type === "stagiaire" ? "Stagiaires" : "Formateurs (communs à toutes les promos)"),
```

- [ ] **Étape 4 : nom de famille dans la liste**

Remplacer :

```js
      list.appendChild(el("li", {}, input, actionBtn));
```

par :

```js
      // Stagiaire : nom de famille à côté du prénom (affichage « V. Timy », tri par nom).
      let nomInput = null;
      if (type === "stagiaire") {
        nomInput = el("input", { type: "text", class: "config-nom", value: it.nom || "",
          placeholder: "Nom", "aria-label": "Nom de famille de " + it.prenom,
          readonly: admin ? undefined : true });
        if (admin) {
          nomInput.addEventListener("blur", async () => {
            const v = nomInput.value.trim();
            if (v === (it.nom || "")) return;
            try {
              await updateStagiaireNom(it.id, v);
              it.nom = v || null;
              toast("Mis à jour", "success");
            } catch (e) { toast(e.message, "error"); }
          });
          nomInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nomInput.blur(); });
        }
      }
      list.appendChild(el("li", {}, input, nomInput, actionBtn));
```

- [ ] **Étape 5 : nom de famille à l'ajout**

Remplacer le bloc d'ajout (de `const addInput = el("input", { type: "text", placeholder: type === "stagiaire" ? "Prénom" : "Nom" });`
à `wrap.appendChild(el("div", { class: "config-add" }, addInput, addBtn));`) par :

```js
      const addInput = el("input", { type: "text", placeholder: type === "stagiaire" ? "Prénom" : "Nom" });
      const addNom = type === "stagiaire" ? el("input", { type: "text", placeholder: "Nom de famille" }) : null;
      const addBtn = el("button", { class: "btn accent", onClick: async () => {
        const v = addInput.value.trim();
        if (!v) return;
        try {
          if (type === "stagiaire") await addStagiaire(v, addNom.value.trim());
          else await addProf(v);
          addInput.value = "";
          if (addNom) addNom.value = "";
          toast("Ajouté", "success");
          rerender();
        } catch (e) { toast(e.message, "error"); }
      }}, icon.plus(), "Ajouter");
      addInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
      if (addNom) addNom.addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });
      wrap.appendChild(el("div", { class: "config-add" }, addInput, addNom, addBtn));
```

- [ ] **Étape 6 : contrôles et commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node --check js/views/config.js && grep -n $'\xe2\x80\x94' js/views/config.js; git add js/views/config.js && git commit -q -m "Multi-promo : Parametres, promo affichee (nom, lieu) et nom de famille des stagiaires

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 11 : Bénévoles, lieu dans le titre et venues des autres promos

**Fichiers :**
- Modifier : `js/views/benevoles.js`

**Interfaces :**
- Consomme : `getPromoCourante` (Tâche 7), `listVenuesBenevoles` (lignes avec `promo_id`,
  `promo_nom`, Tâche 8).

- [ ] **Étape 1 : import**

Ajouter `getPromoCourante,` à la liste importée depuis `"../db.js?v=20261002b"` (ligne
`listVenuesBenevoles, listSuiviBenevole, upsertSuiviBenevole, listStagiaires,`, à compléter en
`listVenuesBenevoles, listSuiviBenevole, upsertSuiviBenevole, listStagiaires, getPromoCourante,`).

- [ ] **Étape 2 : titre avec le lieu**

Dans `openBenevolesPanel`, juste après la fonction `stagiaireNom(id)`, insérer :

```js
  // Le lieu dans le titre : la banque affichée est celle du lieu de la promo courante.
  function titrePanneau() {
    const lieu = getPromoCourante()?.lieu_nom;
    return "Élèves bénévoles et partenaires" + (lieu ? " · " + lieu : "");
  }
```

Puis remplacer les DEUX occurrences de
`modal.appendChild(el("h3", {}, "Élèves bénévoles et partenaires"));` par
`modal.appendChild(el("h3", {}, titrePanneau()));` (Edit avec `replace_all`).

- [ ] **Étape 3 : venues d'une autre promo du même lieu**

Dans `venuesFor`, remplacer :

```js
        map.set(key, { semaine_lundi: e.semaine_lundi, day_index: e.day_index,
          half_day: e.half_day, eleves: new Set(), sujets: new Set() });
      }
      const vn = map.get(key);
```

par :

```js
        map.set(key, { semaine_lundi: e.semaine_lundi, day_index: e.day_index,
          half_day: e.half_day, eleves: new Set(), sujets: new Set(), autresPromos: new Set() });
      }
      const vn = map.get(key);
      // Venue d'une autre promo du même lieu : on dit laquelle ; ses élèves ne sont pas
      // nommables depuis la promo affichée (spec multi-promo C.4).
      if (e.promo_id != null && e.promo_id !== getPromoCourante()?.id && e.promo_nom) {
        vn.autresPromos.add(e.promo_nom);
      }
```

Puis remplacer :

```js
          if (noms) head.appendChild(el("span", { class: "bnv-venue-avec" }, "avec " + noms));
```

par :

```js
          if (noms) head.appendChild(el("span", { class: "bnv-venue-avec" }, "avec " + noms));
          if (vn.autresPromos.size) {
            head.appendChild(el("span", { class: "bnv-venue-avec" }, [...vn.autresPromos].join(", ")));
          }
```

- [ ] **Étape 4 : contrôles et commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node --check js/views/benevoles.js && grep -c "titrePanneau()" js/views/benevoles.js && grep -n $'\xe2\x80\x94' js/views/benevoles.js; git add js/views/benevoles.js && git commit -q -m "Multi-promo : banque de benevoles titree par lieu, venues des autres promos du lieu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

Attendu : `grep -c` affiche `3` (la définition et les deux appels).

---

### Tâche 12 : Nouveautés et modules, les suites du chantier B

Depuis la livraison du chantier B (02/10), les trois lecteurs des Nouveautés (`main.js`,
`views/home.js`, `views/nouveautes.js`) passent tous par `nouveautesAffichables()` de
`js/modules-etat.js`, seul appelant de `vuesEffectives`. B attend en outre trois gestes au
moment où le multi-promo est en ligne ; sa conversation étant close, A les prend dans la même
fusion (spec F).

**Fichiers :**
- Modifier : `tests/nouveautes.test.mjs`, `js/nouveautes.js`
- Modifier : `js/modules-etat.js` (amorce, clé de copie propre à la promo)
- Modifier : `js/modules-data.js` (réglage des modules ouvert aux formateurs)
- Modifier : `js/nouveautes-data.js` (entrée « formateurs »)

**Interfaces :**
- Consomme : `getPromoCourante` (Tâche 7).
- Produit : `amorcePour(dateDebutPromo) → "AAAA-MM-JJ"` ; `vuesEffectives(entrees, dateAmorce =
  MISE_EN_LIGNE)`.

- [ ] **Étape 1 : le test d'abord**

Dans `tests/nouveautes.test.mjs`, remplacer :

```js
  triees, visibles, nonLues, libellePastille, purger, ajouterVues, idsDeReprise,
```

par :

```js
  triees, visibles, nonLues, libellePastille, purger, ajouterVues, idsDeReprise, amorcePour,
```

et remplacer la dernière ligne `console.log("nouveautes : 18 assertions OK");` par :

```js
// Amorce par promo : une promo récente ne trouve pas des dizaines d'anciennes entrées
// « neuves » au premier passage ; une promo plus ancienne que la rubrique garde la date
// de mise en ligne.
assert.equal(amorcePour(undefined), "2026-08-01");
assert.equal(amorcePour("2026-03-30"), "2026-08-01");
assert.equal(amorcePour("2026-09-30"), "2026-09-30");

console.log("nouveautes : 21 assertions OK");
```

Run : `cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node tests/nouveautes.test.mjs`
Attendu : échec (`amorcePour` n'est pas exportée).

- [ ] **Étape 2 : `js/nouveautes.js`**

Remplacer :

```js
// État de lecture effectif. Au tout premier accès, amorce la mémoire avec les
// entrées de reprise : elles ne doivent pas s'afficher comme neuves.
export function vuesEffectives(entrees) {
  const stockees = lireVues();
  if (stockees) return stockees;
  const amorce = idsDeReprise(entrees, MISE_EN_LIGNE);
```

par :

```js
// Date d'amorce : la mise en ligne de la rubrique, ou le début de la promo s'il est plus
// tardif. Quelqu'un qui arrive avec une promo récente ne doit pas trouver des dizaines
// d'anciennes entrées « neuves » au premier passage (spec multi-promo C.6).
export function amorcePour(dateDebutPromo) {
  return dateDebutPromo && dateDebutPromo > MISE_EN_LIGNE ? dateDebutPromo : MISE_EN_LIGNE;
}

// État de lecture effectif. Au tout premier accès, amorce la mémoire avec les
// entrées de reprise : elles ne doivent pas s'afficher comme neuves.
export function vuesEffectives(entrees, dateAmorce = MISE_EN_LIGNE) {
  const stockees = lireVues();
  if (stockees) return stockees;
  const amorce = idsDeReprise(entrees, dateAmorce);
```

Run : `node tests/nouveautes.test.mjs` → `nouveautes : 21 assertions OK`.

- [ ] **Étape 3 : `js/modules-etat.js`**

Remplacer `import { getSetting, setSetting } from "./db.js?v=20261002b";` par
`import { getSetting, setSetting, getPromoCourante } from "./db.js?v=20261002b";`, et
`import { triees, visibles, nonLues, vuesEffectives, marquerVues } from "./nouveautes.js?v=20261002b";`
par
`import { triees, visibles, nonLues, vuesEffectives, marquerVues, amorcePour } from "./nouveautes.js?v=20261002b";`
(jetons : ceux du fichier au moment de l'édition).

Remplacer :

```js
  return "ecsr_modules:" + String(getAdminEmail() || "").toLowerCase();
```

par :

```js
  // Propre au compte ET à la promo : basculer de promo ne doit jamais ressortir l'état des
  // modules de l'autre (spec multi-promo, suites du chantier B).
  return "ecsr_modules:" + String(getAdminEmail() || "").toLowerCase()
    + ":" + (getPromoCourante()?.id ?? "");
```

Remplacer :

```js
  const neuves = new Set(nonLues(entrees, vuesEffectives(toutesLesNouveautes())).map((e) => e.id));
```

par :

```js
  // Amorce à la date de la promo affichée (spec multi-promo C.6).
  const vues = vuesEffectives(toutesLesNouveautes(), amorcePour(getPromoCourante()?.date_debut));
  const neuves = new Set(nonLues(entrees, vues).map((e) => e.id));
```

- [ ] **Étape 4 : `js/modules-data.js`, réglage ouvert aux formateurs**

Remplacer :

```js
// Tant que le multi-promo (chantier A) n'est pas en ligne, il n'existe qu'une
// promo : un formateur qui croirait préparer la nouvelle fermerait des modules
// à la promo actuelle. Le réglage reste alors réservé au fondateur. Passer à
// true quand l'app multi-promo est en ligne (étape 3 de A).
export const REGLAGE_OUVERT_AUX_FORMATEURS = false;
```

par :

```js
// Ouvert aux formateurs depuis le multi-promo (étape 3 de A) : chacun règle les modules de
// la promo affichée par la pastille, et d'elle seule. Avant, il n'existait qu'une promo et le
// réglage était réservé au fondateur.
export const REGLAGE_OUVERT_AUX_FORMATEURS = true;
```

- [ ] **Étape 5 : l'entrée « formateurs »**

En tête du tableau `NOUVEAUTES` de `js/nouveautes-data.js` (juste après `export const NOUVEAUTES = [`),
insérer l'objet suivant, où `DATE` est la date du jour au format `AAAA-MM-JJ` (`date +%F`) ; si la
fusion a lieu un autre jour, la Tâche 15 la met à jour :

```js
  {
    id: "DATE-deux-promos",
    date: "DATE",
    pour: "formateurs",
    titre: "Deux promos dans l'app, et des modules réglés promo par promo",
    resume: "La promo de septembre a sa place dans l'app, à côté de celle de mars. En haut de "
          + "l'écran, une pastille indique la promo affichée : touche-la pour changer. Chaque "
          + "appareil retient ton choix. Planning, calendrier, notes, passages, progression des "
          + "thèmes et examens QCM sont propres à chaque promo ; cours, banque de questions et "
          + "ressources restent communs. Les élèves bénévoles et les auto-écoles sont rangés par "
          + "lieu. Et la section « Modules de la promo » des Paramètres t'est ouverte : elle "
          + "règle les outils de la promo affichée, et d'elle seule.",
    ou: { label: "Pastille en haut, à côté de ton nom", route: "home" },
    guide: [
      "Touche la pastille « mars 2026 » en haut de l'écran.",
      "Choisis « Nîmes, septembre 2026 » : la page se recharge sur cette promo.",
      "Dans Paramètres, ajoute les stagiaires de la promo (prénom et nom de famille), puis "
        + "prépare le calendrier et le planning.",
      "Avant d'inviter les stagiaires de septembre : Paramètres, « Modules de la promo », "
        + "« Partir de l'ensemble de départ ».",
    ],
  },
```

- [ ] **Étape 6 : contrôles et commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node tests/nouveautes.test.mjs && node tests/modules.test.mjs && node --check js/modules-etat.js && node --check js/modules-data.js && node --check js/nouveautes.js && node --check js/nouveautes-data.js && grep -n $'\xe2\x80\x94' js/nouveautes.js js/nouveautes-data.js js/modules-etat.js js/modules-data.js tests/nouveautes.test.mjs; git add tests/nouveautes.test.mjs js/nouveautes.js js/modules-etat.js js/modules-data.js js/nouveautes-data.js && git commit -q -m "Multi-promo : Nouveautes amorcees a la date de la promo, modules par promo ouverts aux formateurs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Tâche 13 : Banc d'essai et vérifications navigateur

**Fichiers (non versionnés) :**
- Copier puis modifier : `_harness_supabase.js`, `_harness_build.mjs` (depuis `TP_ECSR_App`, où ils
  vivent ; ils portent déjà les leviers du chantier B : `?modules=`, `?role=prof`, `?lenteur=`)
- Générer : `_harness.html`
- Créer : `.claude/launch.json` du worktree (exclu), `_mesure_topbar.html` (non suivi, supprimé en fin de tâche)

**Interfaces :**
- Consomme : toute la Partie B.
- Produit : preuves navigateur de la spec E.4 ; copie enrichie du stub rapportée dans `TP_ECSR_App`.

- [ ] **Étape 1 : copier le banc et préparer le serveur**

```bash
cp /c/Users/watch/Dev/ECSR/TP_ECSR_App/_harness_supabase.js /c/Users/watch/Dev/ECSR/TP_ECSR_App/_harness_build.mjs /c/Users/watch/Dev/ecsr-promo-multi-promo/ && cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git status --short | head
```

Attendu : `git status` ne montre ni `_harness_supabase.js` ni `_harness_build.mjs` (exclus).

Créer `C:/Users/watch/Dev/ecsr-promo-multi-promo/.claude/launch.json` (exclu par `.git/info/exclude`) :

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "banc-multi-promo",
      "runtimeExecutable": "python",
      "runtimeArgs": [
        "-c",
        "import os,sys,functools,http.server,socketserver;p=int(os.environ.get('PORT','8020'));h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=sys.argv[1]);socketserver.ThreadingTCPServer.allow_reuse_address=True;print('serving',sys.argv[1],'on',p,flush=True);socketserver.ThreadingTCPServer(('',p),h).serve_forever()",
        "C:/Users/watch/Dev/ecsr-promo-multi-promo"
      ],
      "port": 8020,
      "autoPort": true
    }
  ]
}
```

Si `preview_start` ne trouve pas cette configuration (elle lit le `launch.json` du dossier de la
session), ajouter la même entrée à `C:/Users/watch/Dev/ECSR/.claude/worktrees/pression-influence-routiere-f8d239/.claude/launch.json`
et noter de la retirer en Tâche 16. `ThreadingTCPServer` est obligatoire (le serveur mono-fil se
bloque sur une connexion gardée ouverte par le pane).

- [ ] **Étape 2 : enrichir le stub `_harness_supabase.js`**

a) Juste avant la ligne `const RPC = {`, insérer :

```js
// --- Multi-promo (banc) ---
// Défaut : deux promos (mars, septembre). `?role=stagiaire` ou `?promos=1` : une seule.
// `?lieux=2` met septembre à Montpellier (libellé préfixé du lieu). La promo courante du
// banc est lue dans la même clé localStorage que l'app : le stub joue ainsi le filtrage par
// promo que la base fait sur l'en-tête. Une ligne sans promo_id appartient à mars.
const PARAMS_BANC = new URLSearchParams(location.search);
const MTP_BANC = PARAMS_BANC.get("lieux") === "2";
const PROMOS_BANC = [
  { id: 1, nom: "Nîmes, mars 2026", lieu_id: 1, lieu_nom: "Nîmes", date_debut: "2026-03-30",
    date_fin: "2026-12-11", par_defaut: true, stagiaire_id: PARAMS_BANC.get("role") === "prof" ? null : 1 },
  { id: 2, nom: MTP_BANC ? "Montpellier, septembre 2026" : "Nîmes, septembre 2026",
    lieu_id: MTP_BANC ? 2 : 1, lieu_nom: MTP_BANC ? "Montpellier" : "Nîmes",
    date_debut: "2026-09-30", date_fin: null, par_defaut: false, stagiaire_id: null },
];
function promosBanc() {
  return PARAMS_BANC.get("role") === "stagiaire" || PARAMS_BANC.get("promos") === "1"
    ? [PROMOS_BANC[0]] : PROMOS_BANC;
}
function promoBanc() {
  let v = null;
  try { v = Number(localStorage.getItem("ecsr_promo:banc@example.test")); } catch (e) { /* ignore */ }
  return promosBanc().some((p) => p.id === v) ? v : 1;
}
const TABLES_PROMO_BANC = new Set(["stagiaires", "evaluations", "evaluations_audit", "passages",
  "passages_audit", "planning_entries", "planning_half_meta", "planning_jours_off", "agenda_events",
  "settings", "qcm_attempts", "epcf_evaluations", "epcf_livrets", "dp_dossiers", "fiches_suivi"]);
```

b) Remplacer :

```js
const RPC = {
  epcf_moyennes: [],
  benevoles_noms: [],
};
```

par :

```js
const RPC = {
  epcf_moyennes: [],
  benevoles_noms: [],
  venues_benevoles: [],
};
```

c) Remplacer `export function createClient() {` par :

```js
export function createClient(url, key, options) {
  // Le banc expose le fetch personnalisé de db.js pour tester l'en-tête de promo.
  window.__HARNESS_GLOBAL_FETCH = options?.global?.fetch;
```

puis remplacer `    rpc: async (name) => {` par :

```js
    rpc: async (name) => {
      if (name === "mes_promos") return { data: promosBanc(), error: null };
```

d) Remplacer
`    const rows = applyFilters(FIXTURES[this.table] || [], this.filters);` par :

```js
    let rows = applyFilters(FIXTURES[this.table] || [], this.filters);
    // Joue le filtrage par promo de la base (une ligne sans promo_id appartient à mars).
    if (TABLES_PROMO_BANC.has(this.table)) rows = rows.filter((r) => (r.promo_id ?? 1) === promoBanc());
    rows = rows.map((r) => ({
      ...r,
      ...(Array.isArray(r.progression) ? { progression: r.progression.filter((p) => p.promo_id === promoBanc()) } : {}),
      ...(Array.isArray(r.examen) ? { examen: r.examen.filter((e) => e.promo_id === promoBanc()) } : {}),
    }));
```

e) Fixtures. Remplacer la ligne du thème 22 par
`    { id: 1, type: "theme", numero: 22, titre: "Feux du véhicule", ordre: 22, statut: "Fait", progression: [{ promo_id: 1, statut: "Fait", date_fait: "2026-07-01", date_qcm: null, notes: null, updated_by_email: null }] },`
et celle du thème 23 par
`    { id: 2, type: "theme", numero: 23, titre: "Pneumatiques", ordre: 23, statut: "Fait", progression: [] },`
(l'ancienne colonne « Fait » du thème 23 doit être IGNORÉE : il doit s'afficher « À faire »).
Remplacer `      qcm_questions: [{ count: 3 }],` par :

```js
      qcm_questions: [{ count: 3 }],
      examen: [{ promo_id: 1, published: true, published_by_email: null, published_at: null,
        exam_nb_questions: null, exam_question_ids: null, exam_draw_mode: null,
        exam_seconds_per_question: 30, exam_ferme_a: null }],
```

et `      qcm_questions: [{ count: 1 }],` par :

```js
      qcm_questions: [{ count: 1 }],
      examen: [],
```

f) Profil du fondateur réel (rôle stagiaire ET admin) : juste avant la ligne
`      return { id: 1, email: "banc@example.test", role: "admin", is_admin: true,` du tableau
`user_profiles`, insérer :

```js
      // `?role=fondateur` : le vrai cas du fondateur, rôle stagiaire ET admin (multi-promo).
      if (role === "fondateur") {
        return { id: 1, email: "banc@example.test", role: "stagiaire", is_admin: true,
                 is_founder: true, stagiaire_id: 1, prof_id: null };
      }
```

- [ ] **Étape 3 : générer et ouvrir le banc**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && node _harness_build.mjs && node --check _harness_supabase.js
```

(`_harness_build.mjs` remappe chaque module vers une URL neuve à chaque génération : pas de purge
de cache à faire, mais REGÉNÉRER après chaque modification de code.) `preview_start` avec
`name = "banc-multi-promo"`, puis naviguer vers `http://localhost:<port>/_harness.html?role=prof&bust=<horodatage>`.
Vérifier que le bandeau orange « BANC D'ESSAI » est présent et que les prénoms affichés sont les
factices.

- [ ] **Étape 4 : scénarios (chacun par `javascript_tool`, résultat attendu en commentaire)**

1. Formateur, mars (`?role=prof&bust=...`, après
   `localStorage.removeItem("ecsr_promo:banc@example.test")` et rechargement) :
   ```js
   ({ pastille: document.querySelector(".promo-pastille")?.textContent.trim(),
      slot: document.getElementById("admin-slot").className })
   // { pastille: "mars 2026▾", slot: "avec-pastille" }
   ```
2. Bascule vers septembre, attente d'écriture comprise :
   ```js
   const db = await import("./js/db.js?v=20261002b");
   db.avantChangementPromo(() => new Promise((r) => setTimeout(() => { sessionStorage.setItem("banc_attente", "faite"); r(); }, 300)));
   document.querySelector(".promo-pastille").click();
   [...document.querySelectorAll(".promo-choix")].find((b) => b.textContent.includes("septembre")).click();
   ```
   puis, après le rechargement :
   ```js
   ({ memo: localStorage.getItem("ecsr_promo:banc@example.test"),
      attente: sessionStorage.getItem("banc_attente"),
      pastille: document.querySelector(".promo-pastille")?.textContent.trim() })
   // { memo: "2", attente: "faite", pastille: "sept. 2026▾" }
   ```
   (Les imports dynamiques gardent le jeton des sources : l'import map du banc les redirige.)
3. Septembre vide : `location.hash = "#/planning"` puis
   `document.getElementById("view").textContent.includes("Théorie")` → `false` (la carte de mars
   n'apparaît pas). Revenir en mars par la pastille : la même expression → `true`.
4. Thèmes : en septembre, `location.hash = "#/themes"` puis
   `[...document.querySelectorAll(".theme-statut")].map((e) => e.textContent.trim())` → que des
   « À faire » ; en mars → « Fait » pour le thème 22 et « À faire » pour le thème 23.
5. En-tête : en septembre,
   ```js
   const appels = []; const vrai = window.fetch;
   window.fetch = (input, init) => {
     appels.push([String(input), new Headers(init?.headers).get("x-promo-id")]);
     return Promise.resolve(new Response("[]", { headers: { "Content-Type": "application/json" } }));
   };
   const f = window.__HARNESS_GLOBAL_FETCH;
   await f("https://crpduennbqaemhfaywrz.supabase.co/rest/v1/planning_entries?select=*", { headers: { apikey: "x" } });
   await f("https://crpduennbqaemhfaywrz.supabase.co/functions/v1/chatbot", { method: "POST", headers: { apikey: "x" } });
   await f("https://crpduennbqaemhfaywrz.supabase.co/auth/v1/user", { headers: { apikey: "x" } });
   window.fetch = vrai;
   appels.map((a) => a[1])
   // ["2", null, null]
   ```
6. Stagiaire (`?role=stagiaire&bust=...`) : `document.querySelector(".promo-pastille")` → `null`.
7. Fondateur (`?role=fondateur&bust=...`), en septembre :
   ```js
   const m = await import("./js/auth-admin.js?v=20261002b");
   ({ stagiaire: m.isStagiaire(), admin: m.isAdmin(), fiche: m.getProfile()?.stagiaire_id, role: m.getProfile()?.role })
   // { stagiaire: false, admin: true, fiche: null, role: "admin" }
   ```
   et en mars : `{ stagiaire: true, admin: true, fiche: 1, role: "stagiaire" }`.
8. Libellé avec lieu (`?role=prof&lieux=2&bust=...`, en septembre) : texte de la pastille
   `"Montpellier · sept. 2026▾"`.
9. Nouveautés sans arriéré (formateur, septembre) :
   `localStorage.removeItem("ecsr_nouveautes_vues"); location.reload();` puis
   `document.querySelector('.tab[data-route="home"] .tab-badge')?.textContent` doit valoir le nombre
   d'entrées postérieures au 30/09/2026 (à recompter dans `js/nouveautes-data.js`, `pour` compris),
   jamais `9+`.
10. Paramètres (formateur, septembre) : `location.hash = "#/config"` puis
    ```js
    ({ promo: document.querySelector('input[aria-label="Nom de la promo"]')?.value,
       lieu: [...document.querySelectorAll(".block-head .count")].map((e) => e.textContent).find((t) => t.startsWith("Lieu")),
       formateurs: [...document.querySelectorAll(".block-head h4")].map((e) => e.textContent).find((t) => t.startsWith("Formateurs")),
       modules: [...document.querySelectorAll(".param-section h3")].some((h) => h.textContent.includes("Modules")) })
    // { promo: "Nîmes, septembre 2026", lieu: "Lieu : Nîmes", formateurs: "Formateurs (communs à toutes les promos)", modules: true }
    ```
11. Modules par promo (`?role=prof&modules=depart&bust=...`, la fixture `modules` n'a pas de
    `promo_id` : elle est à mars) : en mars, la clé de copie porte l'id de promo
    (`Object.keys(localStorage).filter((k) => k.startsWith("ecsr_modules:"))` → une clé finissant
    par `:1`) ; en septembre, aucun module fermé (état libre) :
    `(await import("./js/modules-etat.js?v=20261002b")).moduleVisible("notes")` → `true`.
12. Console : `read_console_messages` avec `onlyErrors: true` → aucune erreur de module ou de
    syntaxe sur l'ensemble des scénarios.

- [ ] **Étape 5 : la barre du haut tient sur iPhone**

Créer `C:/Users/watch/Dev/ecsr-promo-multi-promo/_mesure_topbar.html` (page autonome : le pane la
peint, contrairement à l'app) :

```html
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="css/fonts.css"><link rel="stylesheet" href="css/style.css">
<title>Mesure barre du haut</title></head>
<body>
<header class="topbar">
  <a class="brand"><img class="brand-logo" src="assets/logo/tpecsr-logo.svg" alt=""></a>
  <nav class="tabs" id="tabs"></nav>
  <div class="topbar-actions">
    <div id="admin-slot" class="avec-pastille">
      <button class="promo-pastille" type="button"><span class="promo-pastille-texte">sept. 2026</span><span class="promo-pastille-fleche">▾</span></button>
      <button class="admin-badge" type="button"><span class="admin-dot stagiaire"></span><span class="admin-email">V. Timy</span><span class="admin-role">stagiaire</span></button>
    </div>
    <button class="ghost-btn" type="button">◷</button><button class="ghost-btn" type="button">↻</button>
  </div>
</header>
<script>
  // Huit onglets factices, construits en DOM (pas d'injection HTML, comme dans l'app).
  const nav = document.getElementById("tabs");
  const SVG = "http://www.w3.org/2000/svg";
  for (let i = 0; i < 8; i++) {
    const a = document.createElement("a");
    a.className = "tab";
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("viewBox", "0 0 16 16");
    const rond = document.createElementNS(SVG, "circle");
    rond.setAttribute("cx", "8"); rond.setAttribute("cy", "8"); rond.setAttribute("r", "7");
    rond.setAttribute("fill", "currentColor");
    svg.appendChild(rond);
    const libelle = document.createElement("span");
    libelle.textContent = "Onglet";
    a.append(svg, libelle);
    nav.appendChild(a);
  }
  window.mesurer = () => {
    const vw = document.documentElement.clientWidth;
    const a = document.querySelector(".topbar-actions").getBoundingClientRect();
    return { vw, droiteActions: Math.round(a.right), deborde: a.right > vw + 0.5 };
  };
</script>
</body></html>
```

Naviguer vers `/_mesure_topbar.html`, `resize_window` en `mobile` (375×812), puis
`javascript_tool` : `mesurer()` → `deborde: false`. Recommencer en largeur 320. Prendre une capture
d'écran pour Timy. Si ça déborde : réduire le libellé de la pastille sur mobile (règle du bloc CSS
de la Tâche 9) et recommencer. Puis `resize_window` preset `desktop`, et supprimer la page :
`rm /c/Users/watch/Dev/ecsr-promo-multi-promo/_mesure_topbar.html`.

- [ ] **Étape 6 : rapporter le stub enrichi dans `TP_ECSR_App`**

Le stub n'est pas versionné : ce qu'on y apprend meurt avec le worktree. Le recopier :

```bash
cp /c/Users/watch/Dev/ecsr-promo-multi-promo/_harness_supabase.js /c/Users/watch/Dev/ECSR/TP_ECSR_App/_harness_supabase.js
```

(fichier exclu du versionnement : aucun effet sur `git status` de `TP_ECSR_App`). Arrêter le
serveur (`preview_stop`). Rien à committer dans cette tâche.

---

### Tâche 14 : PROJECT_NOTES.md et revue de la branche

**Fichiers :**
- Modifier : `PROJECT_NOTES.md`

- [ ] **Étape 1 : TL;DR**

Remplacer la ligne qui commence par `Web app de suivi de promotion **TP ECSR Nîmes 2026**` par :

```markdown
Web app de suivi des promotions **TP ECSR** : depuis octobre 2026, plusieurs promos dans la même base (« Nîmes, mars 2026 » et « Nîmes, septembre 2026 », cf. § Multi-promo), mêmes formateurs (Hocine, Raphaël, Romain) + 1 admin watchi64. Stack : HTML/CSS/JS vanilla + Supabase + GitHub Pages.
```

- [ ] **Étape 2 : section, à insérer juste avant `## Décisions UX importantes (à respecter)`**

```markdown
## Multi-promo (octobre 2026)

Spec : `docs/superpowers/specs/2026-10-01-multi-promo-design.md` · plan : `docs/superpowers/plans/2026-10-01-multi-promo.md`.

- **Modèle** : table `lieux` (Nîmes 1, Montpellier 2) et `promos` (1 = « Nîmes, mars 2026 », 2 = « Nîmes, septembre 2026 », toutes deux à Nîmes). Les autres promos et lieux se créent par migration.
- **Contexte** : chaque requête vers `/rest/v1/` porte l'en-tête `x-promo-id` (ajouté par `fetchWithTimeout` de `db.js` ; jamais vers les fonctions Edge, l'auth ni le stockage). La base vérifie : `promo_courante()` (en-tête accessible ; absent : promo par défaut ; interdit ou fantaisiste : rien), `lieu_courant()`, `mes_promos()`, `peut_acceder_promo()`. Stagiaire : sa promo ; formateur, admin pur, fondateur : toutes. Défaut : la promo de la fiche, sinon la plus ancienne en cours.
- **Propre à une promo** (colonne `promo_id`, règle `promo_id = (select promo_courante())` ajoutée aux règles de rôle) : stagiaires, notes, passages et historiques, planning (cartes, horaires, jours off), calendrier, réglages (`settings` ; `chatbot_quota_jour` reste global, `promo_id` nulle), tentatives QCM, EPCF, livret, DP, fiches de suivi, `themes_progression` (fait, dates) et `qcm_examens` (examen ouvert, tirage gelé, échéance). Pour les tables liées à un stagiaire, un trigger impose la promo de la fiche.
- **Propre à un lieu** (`lieu_id`) : bénévoles, auto-écoles, suivi des venues. Les venues se lisent par la RPC `venues_benevoles()` (promos du même lieu).
- **Commun** : référentiel des thèmes, compétences, cours, banque QCM, signalements, ressources, contacts, formateurs.
- **App** : règles pures `js/promo-rules.js` (`node tests/promo-rules.test.mjs`) ; contexte dans `db.js` (`chargerMesPromos`, `getPromoCourante`, `choisirPromo`, `avantChangementPromo`) ; `getMyProfile()` renvoie le profil effectif (un compte stagiaire sans fiche dans la promo y est admin pur) ; pastille `js/promo-pastille.js` (au moins deux promos) ; choix mémorisé par appareil et par compte (`ecsr_promo:<email>`) ; la bascule attend les enregistrements du planning puis recharge.
- **Preuve** : `tests/sql/multi-promo-preuve.sql`, à rejouer (via `execute_sql`) après toute migration qui touche aux règles d'accès : verdict dans le message de l'exception finale, rien n'est écrit.
- **Pièges** : une migration n'a pas de promo courante (insérer avec `promo_id` explicite) ; `getSetting`/`setSetting` sont propres à la promo ; une nouvelle table propre à une promo reçoit sa colonne, sa règle et une ligne dans le script de preuve ; ne jamais relire les anciennes colonnes de `themes` et `qcm` (supprimées à l'étape 5 du plan).
```

- [ ] **Étape 3 : la liste de B dans PROJECT_NOTES**

Dans la section « Modules débloqués par les formateurs », remplacer le bloc qui commence par
`- **Quand le multi-promo (A) sera en ligne** :` (sept lignes, jusqu'à
`  - la date d'amorce de A s'ajoute dans `nouveautesAffichables()`.`) par :

```markdown
- **Avec le multi-promo (A)** : drapeau `REGLAGE_OUVERT_AUX_FORMATEURS` à `true` (entrée
  Nouveautés « formateurs » commune avec A), clé de copie de l'appareil propre à la promo
  (`cleCopie()` via `getPromoCourante()`), date d'amorce de A dans `nouveautesAffichables()`, et
  écriture de la clé `modules` couverte par la preuve de A (`tests/sql/multi-promo-preuve.sql`).
  Reste à l'étape 4 de A : régler la promo de septembre (« Partir de l'ensemble de départ »,
  connecté sur cette promo) **avant** d'inviter ses stagiaires, sinon elle voit tout.
```

- [ ] **Étape 4 : revue de la branche entière**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git diff --stat main...HEAD && for t in tests/*.test.mjs; do node "$t" || echo "ECHEC $t"; done && git diff main...HEAD -- js css index.html | grep -n $'\xe2\x80\x94' ; grep -rn "Prof\b" js/promo-pastille.js js/promo-rules.js; echo fin
```

Attendu : tous les tests « OK », aucun cadratin, aucun « Prof » visible. Relire le diff de `js/`
fichier par fichier contre la spec (C.1 à C.7). Puis demander une revue indépendante
(`superpowers:requesting-code-review`) sur la plage `main...multi-promo`, et traiter ses constats.

- [ ] **Étape 5 : commit**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git diff -U0 PROJECT_NOTES.md | grep -n $'\xe2\x80\x94'; git add PROJECT_NOTES.md && git commit -q -m "Multi-promo : section de reprise dans PROJECT_NOTES

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -1
```

(`PROJECT_NOTES.md` portait déjà des cadratins anciens : le contrôle ne porte que sur les lignes
ajoutées ; ne pas réécrire le reste du fichier.)

---

# Partie C : fusion et bascule (étape 3)

### Tâche 15 : Fusion dans `main`, poussée proposée à Timy

**Fichiers :** aucun nouveau.

- [ ] **Étape 1 : se coordonner**

`git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App log --oneline -5 main` et
`git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App branch -a` : noter si B (`modules`) ou C
(`cours-remc`) ont fusionné depuis le 01/10. Si C a touché `cours`, le signaler à Timy avant de
continuer (spec F).

- [ ] **Étape 2 : reprendre `main` dans la branche**

```bash
cd /c/Users/watch/Dev/ecsr-promo-multi-promo && git merge main
```

En cas de conflit : une ligne qui ne diffère que par le jeton `?v=` prend le côté `main` ; un vrai
conflit se résout à la main en gardant les deux intentions ; jamais de `checkout --ours/--theirs` de
fichier entier. Puis relancer tous les tests `node`, `node --check` sur les fichiers en conflit, et
les scénarios 1, 2, 5 et 7 du banc (Tâche 13) : `node --check` ne voit pas une déclaration en double.
Si la date de l'entrée Nouveautés « deux promos » n'est plus celle du jour, mettre à jour son `id` et
sa `date`, puis committer sur la branche.

- [ ] **Étape 3 : fusionner dans `main` (dans `TP_ECSR_App`, qui est sur `main`)**

```bash
cd /c/Users/watch/Dev/ECSR/TP_ECSR_App && git rev-parse --abbrev-ref HEAD && git status --short | head && git merge --no-commit multi-promo && git commit -m "Merge : multi-promo (promo de septembre, cloisonnement par la base, pastille de promo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && grep -o 'v=2026[0-9]*[a-z]' -h index.html js/*.js js/views/*.js | sort | uniq -c
```

Attendu : branche `main`, aucun fichier modifié avant la fusion (le fichier non suivi
`docs/superpowers/plans/2026-09-16-mdp-oublie-journal.md` n'est pas à nous : ne pas y toucher),
fusion sans conflit (tout a été résolu à l'étape 2), puis UN seul jeton listé (le hook l'a posé
pendant le commit). Vérifier aussi `grep -c "amorcePour" js/modules-etat.js` → au moins 1.

- [ ] **Étape 4 : proposer la poussée**

Donner à Timy, dans un bloc de commande, `git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App push origin main`,
en rappelant : la base est déjà prête (étapes 1 et 2), la pastille n'apparaîtra qu'aux formateurs
et à lui, les stagiaires de mars ne verront rien changer. Ne pas pousser soi-même.

---

### Tâche 16 : Après la poussée, contrôle en ligne et bascule

- [ ] **Étape 1 : la nouvelle version est servie**

```bash
curl -s https://watchi64.github.io/ecsr-promo/ | grep -o 'main.js?v=[^"]*'; grep -o 'main.js?v=[^"]*' /c/Users/watch/Dev/ECSR/TP_ECSR_App/index.html
```

Les deux jetons doivent être égaux (sinon attendre la fin du build Pages, ou le relancer :
`gh api -X POST repos/watchi64/ecsr-promo/pages/builds`).

- [ ] **Étape 2 : contrôle par Timy**

Lui demander, sur son iPhone, en navigation privée : la pastille « mars 2026 » est là ; la toucher,
choisir septembre ; le planning est vide, les thèmes « À faire » ; revenir en mars : tout est
intact. (Si une session fondateur existe dans Chrome sur `localhost:8000`, le même contrôle peut
être fait en lecture seule avec Claude in Chrome sur le worktree servi en 8000, avec son accord.)

- [ ] **Étape 3 : annoncer, puis appliquer la bascule**

`apply_migration` avec `name = "multi_promo_3_bascule"` et le contenu de
`supabase/migrations/20261001_multi_promo_3_bascule.sql`. Puis rejouer
`tests/sql/multi-promo-preuve.sql` → `VERDICT VERT`, et `node scripts/verifier-embarquements.mjs`.

- [ ] **Étape 4 : message pour les formateurs**

Donner à Timy, dans un bloc de code prêt à copier :

```
*Nouveauté pour les formateurs* 🗓️
La promo de septembre a maintenant sa place dans l'app, à côté de celle de mars.
En haut de l'écran, une *pastille* indique la promo affichée (« mars 2026 » ou « sept. 2026 ») : touchez-la pour changer. Chaque appareil retient votre choix.
Planning, calendrier, notes et passages sont séparés ; les cours et les QCM restent communs.
Pour préparer septembre : Paramètres (stagiaires, prénom et nom), puis calendrier et planning.
Si la pastille n'apparaît pas, ou si le planning refuse d'enregistrer : rafraîchissez la page (ou passez en navigation privée).
```

- [ ] **Étape 5 : fermer le chantier côté code**

Mémoire : mettre à jour `dispatch_chantiers_octobre2026.md` et créer une fiche projet
`multi_promo.md` (état : étapes 1 à 3 en prod, preuve verte, ouverture aux 8 en attente de B,
ménage à faire), avec sa ligne dans `MEMORY.md`. Puis, la branche étant fusionnée :

```bash
git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App branch --merged main | grep multi-promo && git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App worktree remove C:/Users/watch/Dev/ecsr-promo-multi-promo && git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App branch -d multi-promo && git -C C:/Users/watch/Dev/ECSR/TP_ECSR_App worktree list
```

(Sous Windows, `worktree remove` peut échouer sur « Permission denied » tout en ayant désenregistré
le worktree : supprimer alors le dossier à la main.) Retirer l'entrée `banc-multi-promo` du
`launch.json` de la session si elle y a été ajoutée.

---

# Partie D : ouverture aux 8 et ménage

### Tâche 17 : Ouverture aux 8 stagiaires

- [ ] **Étape 1 : préalable**

Les étapes 1 à 3 sont en ligne et la preuve est verte. Le chantier B (modules) est livré depuis le
02/10 ; Timy a choisi les outils à ouvrir pour septembre.

- [ ] **Étape 2 : régler les modules de septembre, AVANT toute invitation**

Un formateur (ou Timy) se place sur « Nîmes, septembre 2026 » par la pastille, ouvre Paramètres ›
Modules de la promo et clique « Partir de l'ensemble de départ », puis ouvre les outils voulus.
Sans ce geste, la clé `modules` est absente pour septembre et la promo voit tout (spec B §11.1).
Contrôle : `select promo_id, left(value, 60) from settings where key = 'modules';` (lecture par
`execute_sql`) montre une ligne `promo_id = 2`.

- [ ] **Étape 3 : saisie par Timy ou un formateur, dans l'app, en septembre**

Paramètres : les 8 stagiaires (prénom et nom de famille) ; Accès & invitations : l'email de chacun.
Aucune de ces données ne transite par le dépôt.

- [ ] **Étape 4 : preuve avec un vrai compte**

Dès qu'un premier compte de septembre est créé, rejouer `tests/sql/multi-promo-preuve.sql` : les
personnages « vrai stagiaire de septembre » s'ajoutent d'eux-mêmes. Attendu : `VERDICT VERT`.

- [ ] **Étape 5 : message de bienvenue pour les 8**

Rédiger pour Timy un message WhatsApp court (adresse de l'app, création du compte avec l'email
donné, ajouter l'app à l'écran d'accueil de l'iPhone, rafraîchir si quelque chose ne s'affiche pas),
au tutoiement, sans cadratin, en citant seulement les outils ouverts par le formateur.

### Tâche 18 : Ménage (étape 5)

- [ ] **Étape 1 : condition**

Au moins deux semaines après la Tâche 16, et Timy confirme que plus personne ne tourne sur
l'ancienne version (tout le monde a rafraîchi au moins une fois).

- [ ] **Étape 2 : appliquer**

Contrôle préalable : `tests/sql/multi-promo-1-verif.sql` n'est plus utile ; rejouer la preuve
(`VERT`), puis `apply_migration` avec `name = "multi_promo_5_menage"` et le contenu de
`supabase/migrations/20261001_multi_promo_5_menage.sql`, puis rejouer la preuve (`VERT`) et
`node scripts/verifier-embarquements.mjs`. Contrôle par Timy : thèmes et examens toujours justes
dans les deux promos.

- [ ] **Étape 3 : mémoire**

Fiche `multi_promo.md` : ménage fait, chantier clos. Proposer l'archivage de la session après le
message récapitulatif.
