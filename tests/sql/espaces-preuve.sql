-- Preuve du lot 5, étape 1 (siège) : ce que la migration 20261108_espaces_1_siege.sql doit donner, écrite avant elle.
--   lieux.demonstration (vrai pour le lieu 4 seulement, aucune écriture directe), la séquence de lieux.id recalée,
--   comptes_reseau() (comptes additifs par centre, sans nom, sans détail par promo, masqués sous 5 stagiaires en
--   formation, réservés au siège) et creer_centre(p_nom) (réservée au siège).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes du lot 4
-- (tests/sql/roles-aides.sql), y écrit le libellé du mode et y injecte en littéraux la requête d'empreinte, la fixture
-- commune (tests/fixtures/comptes-promo.json, la même que celle du test node), la migration et son retour :
--   node outils/assembler_repetition_roles.mjs espaces <sortie.sql>                   la migration injectée : VERT attendu
--   node outils/assembler_repetition_roles.mjs espaces-contre-epreuve <sortie.sql>    sans la migration : ROUGE attendu
--                                                                                     sur les contrôles comptes_reseau,
--                                                                                     creer_centre et demonstration, rien d'autre
--   node outils/assembler_repetition_roles.mjs espaces-en-ligne <sortie.sql>          rien d'injecté, après application réelle
--   ... --compact <sortie.sql>   retire du gabarit et des aides les lignes vides et de commentaire (textes injectés intacts).
-- Le fichier assemblé se joue en une requête. Tout se passe dans le bloc do final, qui finit TOUJOURS par une levée :
-- migration, personnages, centres et données d'essai sont annulés, rien ne reste (sauf l'état de la séquence de lieux.id,
-- que le bloc remet lui-même comme il l'a trouvé : une séquence n'est pas transactionnelle).
--
-- Déroulé : empreinte avant ; migration ; personnages et centres fictifs (« fixture » : la promo de la fixture, avec ses
-- identifiants d'origine ; « petit » : 4 stagiaires en formation ; « fini » : une promo terminée ; « cinq » : deux promos
-- en cours de 3 et 2 stagiaires plus une promo terminée) ; contrôles ; retour ; empreinte après.
--
-- Contrôles (chacun nommé au verdict, échecs d'abord), par groupe :
--   comptes_reseau  droits (siège, fondateur, fondateur en aperçu siège permis ; direction, formateur, stagiaire, compte sans
--                   rôle, fondateur en aperçu direction et formateur refusés 42501 ; anon sans droit d'exécution), forme (aucun
--                   nom de personne, e-mail, identifiant de stagiaire ou de promo), une ligne par centre, la ligne « fixture »
--                   égale à l'attendu de la fixture champ par champ (les parasites n'ont rien changé), « petit » et « fini »
--                   masqués et vides, « cinq » juste au seuil et somme de ses deux promos en cours.
--   creer_centre    droits, nom nettoyé, nom vide, nom en double (casse différente), identifiant plus grand que tous les
--                   identifiants existants, séquence recalée.
--   demonstration   colonne, vrai pour le lieu 4 seulement, aucune écriture directe par le siège ni par la direction.
--   retour          empreintes égales à celles d'avant, plus de colonne ni de fonction du lot.
--   structure       migration et retour joués sans erreur, personnages et lignes d'essai posés.
--
-- Fixture : ses identifiants (990001...) ne rencontrent aucune ligne réelle. Écarts avec le schéma réel, tous sans effet
-- sur l'attendu : les QCM et thèmes qu'elle cite reçoivent des identifiants neufs (les siens existent déjà : thèmes 1 à 3 et
-- QCM 10 à 12 sont ceux de la vraie base), la tentative d'entraînement sans note_20 reçoit 0 (colonne non nulle), la ligne
-- EPCF sans date_eval n'est pas posée (colonne non nulle ; l'attendu l'exclut de toute façon) et auto_eval nul devient faux
-- (colonne non nulle ; « auto_eval is not true » les traite pareil), le stagiaire 990099 (hors promo) est posé comme fiche
-- d'une autre promo. Les deux déclencheurs qui imposent promo_id d'après la fiche sont suspendus le temps de poser les
-- lignes parasites (promo_id qui ne correspond pas à la fiche), puis rétablis.

-- @@INCLURE tests/sql/roles-aides.sql@@

-- Empreinte de la base (regles, fonctions, droits) : tests/sql/roles-empreinte.sql, injecté tel quel.
create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $empreinte$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $empreinte$;

-- Une migration ou un retour, joué tel quel dans une sous-transaction : « jouée », « neutralisée » (le littéral 'select 1'
-- que l'assembleur met à la place d'un fichier non demandé), ou l'erreur (état SQL et noms de contrainte, de table et de
-- colonne, jamais le message). Le md5 du texte joué va au verdict (information).
create or replace function pg_temp.jouer(p_nom text, p_sql text)
returns text language plpgsql as $fx$
declare v_contrainte text; v_table text; v_colonne text;
begin
  if p_sql = 'select 1' then return 'neutralisée'; end if;
  perform pg_temp.informer(format('md5 du texte joué : %s', p_nom), md5(p_sql));
  begin
    execute p_sql;
    return 'jouée';
  exception when others then
    get stacked diagnostics v_contrainte = constraint_name, v_table = table_name, v_colonne = column_name;
    return 'ERREUR ' || sqlstate || coalesce(' contrainte ' || nullif(v_contrainte, ''), '')
           || coalesce(' table ' || nullif(v_table, ''), '') || coalesce(' colonne ' || nullif(v_colonne, ''), '');
  end;
end $fx$;

-- Un appel fait par un personnage : « OK <valeur> » ou « ERREUR <état> <message> » (le message est celui de nos
-- levées, jamais une valeur de donnée ; coupé à 120 caractères). Rend la main au propriétaire.
create or replace function pg_temp.appeler(p_email text, p_promo text, p_apercu text, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  perform pg_temp.incarner(p_email, p_promo, p_apercu);
  begin
    execute p_sql into v;
    v := 'OK ' || coalesce(v, 'nul');
  exception when others then
    v := 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 120);
  end;
  perform pg_temp.proprio();
  return v;
end $f$;

-- Un champ d'une ligne du résultat de comptes_reseau (texte, ou nul si le centre ou le champ manque) ; et « vrai » quand la
-- clé est présente avec la valeur JSON null (une colonne masquée est présente et vide, jamais absente).
create or replace function pg_temp.champ(p_lignes jsonb, p_lieu text, p_champ text)
returns text language sql as $f$
  select r ->> p_champ from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) r where r ->> 'lieu_nom' = p_lieu;
$f$;
create or replace function pg_temp.champ_nul(p_lignes jsonb, p_lieu text, p_champ text)
returns boolean language sql as $f$
  select coalesce(bool_and(jsonb_typeof(r -> p_champ) = 'null'), false)
    from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) r where r ->> 'lieu_nom' = p_lieu;
$f$;

-- Verdict : lève TOUJOURS une exception, qui annule tout. Les échecs d'abord (chacun avec son groupe et son détail), puis
-- les comptes par groupe, puis la liste de chaque contrôle réussi ; « VERT n/0 » nomme chaque contrôle.
create or replace function pg_temp.verdict_espaces(p_mode text, p_debut timestamptz)
returns void language plpgsql as $f$
declare v_ok integer; v_ko integer; v_groupes text; v_echecs text; v_reussis text; v_infos text; v_msg text; v_duree text;
begin
  v_duree := to_char(extract(epoch from clock_timestamp() - p_debut), 'FM990.0') || ' s';
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat = 'échec') into v_ok, v_ko from preuve;
  select string_agg(format('%s %s/%s', groupe, ok, n), ' ; ' order by premier) into v_groupes
    from (select groupe, count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where etat <> 'info' group by groupe) g;
  select string_agg(format('- [%s] %s', groupe, libelle) || coalesce(' : ' || nullif(left(detail, 200), ''), ''), E'\n' order by num)
    into v_echecs from preuve where etat = 'échec';
  select string_agg(format('- [%s] %s', groupe, libelle), E'\n' order by num) into v_reussis from preuve where etat = 'ok';
  select string_agg('- ' || libelle || coalesce(' : ' || nullif(detail, ''), ''), E'\n' order by num) into v_infos
    from preuve where etat = 'info';
  if v_ko = 0 and v_ok > 0 then
    v_msg := format(E'VERT %s/0 (tout est annulé) ; mode %s ; durée %s\npar groupe (réussis/joués) : %s\ncontrôles :\n%s',
      v_ok, p_mode, v_duree, v_groupes, coalesce(v_reussis, '- aucun'));
  else
    v_msg := format(E'ROUGE %s/%s (tout est annulé) ; mode %s ; durée %s\néchecs d''abord :\n%s\npar groupe (réussis/joués) : %s\ncontrôles réussis :\n%s',
      v_ok, v_ko, p_mode, v_duree, coalesce(v_echecs, '- aucun'), coalesce(v_groupes, 'aucun contrôle joué'),
      coalesce(v_reussis, '- aucun'));
  end if;
  if v_infos is not null then
    v_msg := v_msg || E'\nà titre d''information (jamais compté) :\n' || v_infos;
  end if;
  raise exception using message = v_msg;
end $f$;

-- Correspondance entre les clés de l'attendu de la fixture (JS) et les colonnes de comptes_reseau.
drop table if exists pg_temp.champs;
create temp table champs (ordre integer primary key, cle text not null, colonne text not null);
insert into champs (ordre, cle, colonne) values
  (1, 'inscrits', 'inscrits'), (2, 'enFormation', 'en_formation'), (3, 'abandons', 'abandons'), (4, 'absences', 'absences'),
  (5, 'prevus', 'prevus'), (6, 'qcmBonnes', 'qcm_bonnes'), (7, 'qcmQuestions', 'qcm_questions'),
  (8, 'examensPasses', 'examens_passes'), (9, 'examensReussis', 'examens_reussis'), (10, 'notesN', 'notes_n'),
  (11, 'notesSomme', 'notes_somme'), (12, 'notesSous10', 'notes_sous10'), (13, 'epcfAcquis', 'epcf_acquis'),
  (14, 'epcfRenseignes', 'epcf_renseignes');

drop table if exists pg_temp.qcm_fixture;
create temp table qcm_fixture (cle integer primary key, id bigint not null);

do $preuve$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_fx constant jsonb := (
-- @@INJECTER tests/fixtures/comptes-promo.json@@
  )::jsonb;
  v_promo constant integer := (v_fx ->> 'promo_id')::integer;
  c_fix constant text := 'Preuve centre fixture';
  c_petit constant text := 'Preuve centre petit';
  c_fini constant text := 'Preuve centre fini';
  c_cinq constant text := 'Preuve centre cinq';
  c_siege constant text := 'preuve5.siege@exemple.invalid';
  c_dir_n constant text := 'preuve5.dir.n@exemple.invalid';
  c_dir_m constant text := 'preuve5.dir.m@exemple.invalid';
  c_form_n constant text := 'preuve5.form.n@exemple.invalid';
  c_form_m constant text := 'preuve5.form.m@exemple.invalid';
  c_stag_n constant text := 'preuve5.stag.n@exemple.invalid';
  c_sans_role constant text := 'preuve5.sans.role@exemple.invalid';
  c_colonnes constant text[] := array['lieu_id', 'lieu_nom', 'demonstration', 'promos_en_cours', 'masque', 'inscrits',
    'en_formation', 'abandons', 'absences', 'prevus', 'qcm_bonnes', 'qcm_questions', 'examens_passes', 'examens_reussis',
    'notes_n', 'notes_somme', 'notes_sous10', 'epcf_acquis', 'epcf_renseignes'];
  c_lire constant text := 'select jsonb_agg(to_jsonb(r) order by r.lieu_id)::text from public.comptes_reseau() r';
  c_compter constant text := 'select count(*)::text from public.comptes_reseau()';
  v_en_ligne boolean;
  v_etat text; v_retour text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_seq text; v_seq_last bigint; v_seq_called boolean; v_requete text;
  v_fond text; v_lieu1 integer; v_lieu2 integer; v_max_avant integer; v_nb_lieux integer;
  v_l_fix integer; v_l_petit integer; v_l_fini integer; v_l_cinq integer;
  v_p_petit integer; v_p_fini integer; v_p_a integer; v_p_b integer; v_p_c integer;
  v_theme integer; v_qcm bigint; v_x record; v_fiche_n integer; v_fiche_p1 integer;
  v_json text; v_lignes jsonb; v_obt text; v_att text; v_txt text; v_cols text[]; v_mauvaises text;
  v_ids integer[]; n integer; v_id_a integer; v_id_b integer; v_id_c integer;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'espaces-en-ligne%';

  -- 1. Avant la migration : requête reçue, empreinte, séquence, centres existants, fondateur choisi par requête.
  v_requete := regexp_replace(current_query(), E'\n\n-- source:[^\n]*(\n-- [^\n]*)*[[:space:]]*$', '');
  perform pg_temp.informer('requête reçue par la base, suffixe de la passerelle retiré (md5, caractères)',
    format('%s, %s', md5(v_requete), length(v_requete)));
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  select s.last_value, s.is_called into v_seq_last, v_seq_called from public.lieux_id_seq s;
  v_seq := format('lieux_id_seq %s/%s', v_seq_last, v_seq_called);
  select max(id), count(*) into v_max_avant, v_nb_lieux from public.lieux;
  v_lieu1 := (select lieu_id from public.promos where id = 1);
  v_lieu2 := (select lieu_id from public.promos where id = 2);
  select up.email into v_fond from public.user_profiles up where up.is_founder order by up.email limit 1;
  perform pg_temp.verifier('structure', 'un fondateur trouvé par requête (adresse jamais affichée), les promos 1 et 2 et leurs centres',
    v_fond is not null and v_lieu1 is not null and v_lieu2 is not null and v_lieu1 <> v_lieu2,
    format('fondateur %s ; centres des promos 1 et 2 : %s et %s', case when v_fond is null then 'absent' else 'trouvé' end,
           coalesce(v_lieu1::text, 'nul'), coalesce(v_lieu2::text, 'nul')));

  -- 2. La migration, injectée telle quelle (neutralisée dans les modes sans elle).
  v_etat := pg_temp.jouer('migration',
-- @@INJECTER supabase/migrations/20261108_espaces_1_siege.sql@@
  );
  if v_etat = 'neutralisée' then
    perform pg_temp.informer('migration', 'non injectée (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'migration jouée sans erreur', v_etat = 'jouée', v_etat);
  end if;

  -- 3. Personnages fictifs, centres fictifs, fixture et lignes parasites, en propriétaire.
  insert into public.lieux (nom) values (c_fix) returning id into v_l_fix;
  insert into public.lieux (nom) values (c_petit) returning id into v_l_petit;
  insert into public.lieux (nom) values (c_fini) returning id into v_l_fini;
  insert into public.lieux (nom) values (c_cinq) returning id into v_l_cinq;
  v_p_petit := v_promo + 1; v_p_fini := v_promo + 2; v_p_a := v_promo + 3; v_p_b := v_promo + 4; v_p_c := v_promo + 5;
  -- Promos : en cours = date_debut <= aujourd'hui et (date_fin nulle ou >= aujourd'hui). Dates relatives à aujourd'hui, pour
  -- que la preuve reste juste avec le temps ; « petit » commence et finit aujourd'hui (le dernier jour compte).
  insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values
    (v_promo, v_l_fix, 'Preuve promo fixture', current_date - 30, null),
    (v_p_petit, v_l_petit, 'Preuve promo petit', current_date, current_date),
    (v_p_fini, v_l_fini, 'Preuve promo finie', current_date - 100, current_date - 1),
    (v_p_a, v_l_cinq, 'Preuve promo cinq A', current_date - 20, current_date + 20),
    (v_p_b, v_l_cinq, 'Preuve promo cinq B', current_date - 5, null),
    (v_p_c, v_l_cinq, 'Preuve promo cinq C finie', current_date - 200, current_date - 10);
  -- QCM et thèmes cités par la fixture : identifiants neufs (numero nul : aucun miroir d'examen vers les évaluations).
  for v_x in select (q ->> 'id')::integer as cle, q ->> 'titre' as titre, (q ->> 'exam_pass_20')::numeric as seuil
               from jsonb_array_elements(v_fx -> 'referentiel' -> 'qcm') q loop
    insert into public.themes (titre, type, ordre) values ('Preuve thème ' || v_x.titre, 'notion', 9999) returning id into v_theme;
    insert into public.qcm (theme_id, titre, exam_pass_20) values (v_theme, 'Preuve ' || v_x.titre, coalesce(v_x.seuil, 15))
      returning id into v_qcm;
    insert into qcm_fixture (cle, id) values (v_x.cle, v_qcm);
  end loop;
  -- Fiches de la fixture, puis celles qu'elle cite sans les décrire (le stagiaire hors promo) : fiches d'une autre promo.
  insert into public.stagiaires (id, prenom, nom, ordre, actif, anonymise_le, promo_id)
    select x.id, x.prenom, x.nom, x.ordre, x.actif, x.anonymise_le, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'stagiaires')
           as x(id integer, prenom text, nom text, ordre integer, actif boolean, anonymise_le timestamptz, promo_id integer);
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id)
    select o.sid, 'Hors', 'PREUVE', 99, true, v_p_petit
      from (select (l ->> 'stagiaire_id')::integer as sid
              from jsonb_each(v_fx -> 'donnees') e, jsonb_array_elements(e.value) l where e.key <> 'stagiaires'
            except select (l ->> 'id')::integer from jsonb_array_elements(v_fx -> 'donnees' -> 'stagiaires') l) o;
  -- « petit » : 3 stagiaires en formation (le stagiaire hors promo, fiche d'une autre promo, y est aussi : 4 au total, moins
  -- de 5), et une absence ; « fini » : 6 fiches dans une promo terminée ; « cinq » : promo A (3 en formation, 1 abandon),
  -- promo B (2 en formation), promo C terminée (4 fiches).
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id)
    select 990100 + i, 'Petit' || i, 'PREUVE', i, true, v_p_petit from generate_series(1, 3) i
    union all select 990200 + i, 'Fini' || i, 'PREUVE', i, true, v_p_fini from generate_series(1, 6) i
    union all select 990400 + i, 'CinqA' || i, 'PREUVE', i, i <= 3, v_p_a from generate_series(1, 4) i
    union all select 990410 + i, 'CinqB' || i, 'PREUVE', i, true, v_p_b from generate_series(1, 2) i
    union all select 990420 + i, 'CinqC' || i, 'PREUVE', i, true, v_p_c from generate_series(1, 4) i;
  -- Les déclencheurs qui imposent promo_id d'après la fiche sont suspendus pour poser les lignes dont le promo_id ne
  -- correspond pas à la fiche (le passage du stagiaire hors promo, et les deux parasites).
  alter table public.passages disable trigger trg_promo_du_stagiaire;
  alter table public.evaluations disable trigger trg_promo_du_stagiaire;
  alter table public.qcm_attempts disable trigger trg_promo_du_stagiaire;
  alter table public.epcf_evaluations disable trigger trg_promo_du_stagiaire;
  insert into public.passages (id, stagiaire_id, type, resultat, date, promo_id)
    select x.id, x.stagiaire_id, x.type, x.resultat, x."date", x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'passages')
           as x(id integer, stagiaire_id integer, type text, resultat text, "date" date, promo_id integer);
  insert into public.evaluations (id, stagiaire_id, type, theme_numero, competence_code, controle_libelle, note, note_max, date_eval, promo_id)
    select x.id, x.stagiaire_id, x.type, x.theme_numero, x.competence_code, x.controle_libelle, x.note, x.note_max, x.date_eval, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'evaluations')
           as x(id integer, stagiaire_id integer, type text, theme_numero integer, competence_code text, controle_libelle text,
                note numeric, note_max numeric, date_eval date, promo_id integer);
  insert into public.qcm_attempts (id, qcm_id, stagiaire_id, mode, score, total, note_20, finished_at, promo_id)
    select x.id, m.id, x.stagiaire_id, x.mode, x.score, x.total, coalesce(x.note_20, 0), x.finished_at, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'tentatives')
           as x(id bigint, qcm_id integer, stagiaire_id integer, mode text, score integer, total integer, note_20 numeric,
                finished_at timestamptz, promo_id integer)
      join qcm_fixture m on m.cle = x.qcm_id;
  insert into public.epcf_evaluations (id, stagiaire_id, trame, contexte, auto_eval, date_eval, scores, promo_id)
    overriding system value
    select x.id, x.stagiaire_id, x.trame, x.contexte, coalesce(x.auto_eval, false), x.date_eval, x.scores, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'epcf')
           as x(id bigint, stagiaire_id integer, trame text, contexte text, auto_eval boolean, date_eval date, scores jsonb,
                promo_id integer)
     where x.date_eval is not null;
  -- Parasites : un passage d'un stagiaire de la fixture dont le promo_id est la promo 1 ; une évaluation d'un stagiaire de
  -- la promo 1 dont le promo_id est la promo de la fixture. Ni l'un ni l'autre ne compte.
  insert into public.passages (id, stagiaire_id, type, resultat, date, promo_id)
    values (v_promo + 900, (v_fx -> 'donnees' -> 'stagiaires' -> 0 ->> 'id')::integer, 'Salle', 'Absence', current_date, 1);
  select s.id into v_fiche_p1 from public.stagiaires s where s.promo_id = 1 and s.actif order by s.id limit 1;
  insert into public.evaluations (id, stagiaire_id, type, theme_numero, note, note_max, date_eval, promo_id)
    values (v_promo + 900, v_fiche_p1, 'Thème', 1, 1, 20, current_date, v_promo);
  -- Les mêmes parasites pour les stagiaires de « cinq » (centre non masqué, dont le compte attendu est zéro partout) : une
  -- note, une tentative d'examen et une évaluation EPCF d'un stagiaire de sa promo A dont le promo_id est la promo de la
  -- fixture. Si le promo_id n'était pas confronté à la promo de la fiche, elles s'ajouteraient au centre « cinq ».
  insert into public.evaluations (id, stagiaire_id, type, theme_numero, note, note_max, date_eval, promo_id)
    values (v_promo + 901, 990401, 'Thème', 1, 12, 20, current_date, v_promo);
  insert into public.qcm_attempts (id, qcm_id, stagiaire_id, mode, score, total, note_20, finished_at, promo_id)
    values (v_promo + 900, (select min(id) from qcm_fixture), 990401, 'examen', 20, 20, 20, now(), v_promo),
           (v_promo + 901, (select min(id) from qcm_fixture), 990401, 'entrainement', 9, 10, 0, now(), v_promo);
  insert into public.epcf_evaluations (id, stagiaire_id, trame, contexte, auto_eval, date_eval, scores, promo_id)
    overriding system value
    values (v_promo + 900, 990401, 'salle', 'EPCF', false, current_date, '{"a": "A", "b": "A"}'::jsonb, v_promo);
  alter table public.passages enable trigger trg_promo_du_stagiaire;
  alter table public.evaluations enable trigger trg_promo_du_stagiaire;
  alter table public.qcm_attempts enable trigger trg_promo_du_stagiaire;
  alter table public.epcf_evaluations enable trigger trg_promo_du_stagiaire;
  insert into public.passages (id, stagiaire_id, type, resultat, date, promo_id) values
    (v_promo + 800, 990101, 'Salle', 'Absence', current_date, v_p_petit),
    (v_promo + 801, 990401, 'Salle', 'Effectué', current_date, v_p_a),
    (v_promo + 802, 990402, 'Voiture', 'Absence', current_date, v_p_a),
    (v_promo + 803, 990411, 'Salle', 'Effectué', current_date, v_p_b),
    (v_promo + 804, 990421, 'Salle', 'Absence', current_date, v_p_c);
  -- Personnages : le siège, les deux directions, les deux formateurs, un stagiaire de la promo 1, un compte sans rôle.
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id) values (990301, 'Preuve5 stagiaire', 'PREUVE', 1, true, 1);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id) values
    (c_siege, 'prof', false, null), (c_dir_n, 'prof', false, null), (c_dir_m, 'prof', false, null),
    (c_form_n, 'prof', true, null), (c_form_m, 'prof', true, null), (c_stag_n, 'stagiaire', false, 990301),
    (c_sans_role, 'stagiaire', false, null);
  insert into public.affectations (email, role, promo_id, lieu_id) values
    (c_siege, 'siege', null, null), (c_dir_n, 'direction', null, v_lieu1), (c_dir_m, 'direction', null, v_lieu2),
    (c_form_n, 'formateur', 1, null), (c_form_m, 'formateur', 2, null);
  perform pg_temp.verifier('structure', 'lignes d''essai posées : fiches, passages, notes, tentatives et EPCF de la fixture (EPCF sans date écartée), parasites compris',
    (select count(*) from public.stagiaires where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'stagiaires')
    and (select count(*) from public.passages where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'passages')
    and (select count(*) from public.evaluations where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'evaluations') + 2
    and (select count(*) from public.qcm_attempts where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'tentatives') + 2
    and (select count(*) from public.epcf_evaluations where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'epcf') - 1 + 1,
    format('fiches %s, passages %s, notes %s, tentatives %s, EPCF %s',
      (select count(*) from public.stagiaires where promo_id = v_promo), (select count(*) from public.passages where promo_id = v_promo),
      (select count(*) from public.evaluations where promo_id = v_promo), (select count(*) from public.qcm_attempts where promo_id = v_promo),
      (select count(*) from public.epcf_evaluations where promo_id = v_promo)));

  -- 4. comptes_reseau : droits.
  perform pg_temp.verifier('comptes_reseau', 'la fonction comptes_reseau() existe', to_regprocedure('public.comptes_reseau()') is not null,
    '');
  perform pg_temp.attendre('comptes_reseau', 'permis au siège (une ligne par centre)',
    pg_temp.appeler(c_siege, null, null, c_compter), 'OK ' || (select count(*) from public.lieux));
  perform pg_temp.attendre('comptes_reseau', 'permis au fondateur hors aperçu',
    pg_temp.appeler(v_fond, null, null, c_compter), 'OK ' || (select count(*) from public.lieux));
  perform pg_temp.attendre('comptes_reseau', 'permis au fondateur en aperçu siège',
    pg_temp.appeler(v_fond, null, 'siege', c_compter), 'OK ' || (select count(*) from public.lieux));
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à la direction d''un centre',
    pg_temp.appeler(c_dir_n, null, null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à la direction d''un autre centre',
    pg_temp.appeler(c_dir_m, null, null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un formateur',
    pg_temp.appeler(c_form_n, '1', null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un formateur d''une autre promo',
    pg_temp.appeler(c_form_m, '2', null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un stagiaire',
    pg_temp.appeler(c_stag_n, '1', null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un compte sans fiche ni affectation',
    pg_temp.appeler(c_sans_role, null, null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) au fondateur en aperçu direction',
    pg_temp.appeler(v_fond, null, 'direction', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) au fondateur en aperçu formateur',
    pg_temp.appeler(v_fond, null, 'formateur', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) au fondateur en aperçu stagiaire',
    pg_temp.appeler(v_fond, null, 'stagiaire', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'un en-tête d''aperçu siège envoyé par un compte qui n''est pas le fondateur ne lui ouvre rien',
    pg_temp.appeler(c_dir_n, null, 'siege', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'non exécutable par anon (42501, aucun droit d''exécution)',
    left(pg_temp.appeler(null, null, null, c_compter), 12), 'ERREUR 42501');
  perform pg_temp.attendre('comptes_reseau', 'droit d''exécution : authenticated oui ; anon, service_role et public non (catalogue)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public.comptes_reseau()'', ''execute''), has_function_privilege(''anon'', ''public.comptes_reseau()'', ''execute''), has_function_privilege(''service_role'', ''public.comptes_reseau()'', ''execute''))'),
    't,f,f');

  -- 5. comptes_reseau : forme. Les colonnes, dans l'ordre, et aucune qui nomme une personne, une adresse, un stagiaire
  --    ou une promo.
  select array_agg(u.n order by u.o) into v_cols
    from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as u(n, m, o)
   where p.oid = to_regprocedure('public.comptes_reseau()') and u.m = 't';
  perform pg_temp.attendre('comptes_reseau', 'forme : les 19 colonnes attendues, dans l''ordre', array_to_string(v_cols, ','),
    array_to_string(c_colonnes, ','));
  select string_agg(k.cnom, ', ') into v_mauvaises from unnest(coalesce(v_cols, '{}')) as k(cnom)
   where (k.cnom like '%nom%' and k.cnom <> 'lieu_nom') or k.cnom like '%email%' or k.cnom like '%stagiaire%'
      or k.cnom like '%promo_id%' or k.cnom like '%prenom%' or k.cnom like '%mail%';
  perform pg_temp.verifier('comptes_reseau', 'forme : aucune colonne dont le nom contient nom (hors lieu_nom), email, stagiaire ou promo_id',
    v_cols is not null and v_mauvaises is null, coalesce(v_mauvaises, ''));

  -- 6. comptes_reseau : les lignes, lues par le siège (une seule lecture), avant toute création de centre.
  v_json := pg_temp.appeler(c_siege, null, null, c_lire);
  v_lignes := case when v_json like 'OK %' and v_json <> 'OK nul' then substr(v_json, 4)::jsonb end;
  perform pg_temp.verifier('comptes_reseau', 'la lecture du siège rend un tableau de lignes', v_lignes is not null and jsonb_typeof(v_lignes) = 'array',
    case when v_lignes is null then left(v_json, 60) else '' end);
  perform pg_temp.attendre('comptes_reseau', 'une ligne par centre, tout centre compris',
    (select count(*) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)))::text, (select count(*) from public.lieux)::text);
  perform pg_temp.attendre('comptes_reseau', 'les centres de la base figurent tous (identifiants rendus = identifiants de lieux)',
    (select string_agg(r ->> 'lieu_id', ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r),
    (select string_agg(id::text, ',' order by id) from public.lieux));
  -- Centre fixture : champ par champ, l'attendu de la fixture ; les parasites n'ont rien changé.
  perform pg_temp.attendre('comptes_reseau', 'ligne « fixture » : une promo en cours', pg_temp.champ(v_lignes, c_fix, 'promos_en_cours'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « fixture » : 6 en formation, donc non masquée (seuil 5)', pg_temp.champ(v_lignes, c_fix, 'masque'), 'false');
  for v_x in select * from champs order by ordre loop
    v_att := v_fx -> 'attendu' ->> v_x.cle;
    v_obt := pg_temp.champ(v_lignes, c_fix, v_x.colonne);
    if v_x.colonne = 'notes_somme' then
      perform pg_temp.verifier('comptes_reseau', format('ligne « fixture » : %s égal à l''attendu de la fixture (%s), à 1e-9 près', v_x.colonne, v_att),
        v_obt is not null and abs(v_obt::numeric - v_att::numeric) < 0.000000001, format('obtenu %s ; attendu %s', coalesce(v_obt, 'nul'), v_att));
    else
      perform pg_temp.attendre('comptes_reseau', format('ligne « fixture » : %s égal à l''attendu de la fixture (%s)', v_x.colonne, v_att), v_obt, v_att);
    end if;
  end loop;
  perform pg_temp.attendre('comptes_reseau', 'ligne « fixture » : le nom du centre est le seul nom rendu (lieu_nom)', pg_temp.champ(v_lignes, c_fix, 'lieu_nom'), c_fix);
  -- Centre petit : une promo en cours (qui finit aujourd'hui), 4 en formation : masqué, tout ce qui suit masque est nul.
  perform pg_temp.attendre('comptes_reseau', 'ligne « petit » : une promo en cours (son dernier jour compte)', pg_temp.champ(v_lignes, c_petit, 'promos_en_cours'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « petit » : 4 en formation, masqué', pg_temp.champ(v_lignes, c_petit, 'masque'), 'true');
  perform pg_temp.verifier('comptes_reseau', 'ligne « petit » : toutes les colonnes après masque sont nulles (présentes, vides)',
    (select coalesce(bool_and(pg_temp.champ_nul(v_lignes, c_petit, c)), false) from unnest(c_colonnes[6:19]) c),
    (select string_agg(c, ', ') from unnest(c_colonnes[6:19]) c where not pg_temp.champ_nul(v_lignes, c_petit, c)));
  -- Centre fini : aucune promo en cours, masqué, vide, malgré 6 fiches dans sa promo terminée.
  perform pg_temp.attendre('comptes_reseau', 'ligne « fini » : aucune promo en cours (promo terminée hier)', pg_temp.champ(v_lignes, c_fini, 'promos_en_cours'), '0');
  perform pg_temp.attendre('comptes_reseau', 'ligne « fini » : masqué', pg_temp.champ(v_lignes, c_fini, 'masque'), 'true');
  perform pg_temp.verifier('comptes_reseau', 'ligne « fini » : toutes les colonnes après masque sont nulles (6 fiches dans la promo terminée ne comptent pas)',
    (select coalesce(bool_and(pg_temp.champ_nul(v_lignes, c_fini, c)), false) from unnest(c_colonnes[6:19]) c),
    (select string_agg(c, ', ') from unnest(c_colonnes[6:19]) c where not pg_temp.champ_nul(v_lignes, c_fini, c)));
  -- Centre cinq : deux promos en cours de 3 et 2 en formation, plus un abandon et une promo terminée de 4 fiches. Juste au seuil.
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : deux promos en cours (la terminée ne compte pas)', pg_temp.champ(v_lignes, c_cinq, 'promos_en_cours'), '2');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 5 en formation, non masqué (le seuil est « moins de 5 »)', pg_temp.champ(v_lignes, c_cinq, 'masque'), 'false');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 6 inscrits, somme des deux promos en cours', pg_temp.champ(v_lignes, c_cinq, 'inscrits'), '6');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 5 en formation, somme des deux promos en cours', pg_temp.champ(v_lignes, c_cinq, 'en_formation'), '5');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 1 abandon', pg_temp.champ(v_lignes, c_cinq, 'abandons'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : absences des promos en cours seulement (1)', pg_temp.champ(v_lignes, c_cinq, 'absences'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : passages prévus des promos en cours seulement (3)', pg_temp.champ(v_lignes, c_cinq, 'prevus'), '3');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : sans tentative ni note ni EPCF, des zéros (non masqué : jamais nul)',
    concat_ws(',', pg_temp.champ(v_lignes, c_cinq, 'qcm_bonnes'), pg_temp.champ(v_lignes, c_cinq, 'examens_passes'),
              pg_temp.champ(v_lignes, c_cinq, 'notes_n'), pg_temp.champ(v_lignes, c_cinq, 'notes_somme'), pg_temp.champ(v_lignes, c_cinq, 'epcf_renseignes')),
    '0,0,0,0,0');
  -- Les centres réels figurent aussi, avec leur nom de centre et une promo en cours à partir de leurs dates réelles.
  perform pg_temp.attendre('comptes_reseau', 'centres réels : promos_en_cours égal au nombre de promos en cours de chaque centre',
    (select string_agg(r ->> 'lieu_id' || '=' || (r ->> 'promos_en_cours'), ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r),
    (select string_agg(l.id || '=' || (select count(*) from public.promos p where p.lieu_id = l.id and p.date_debut <= current_date
                                         and (p.date_fin is null or p.date_fin >= current_date)), ',' order by l.id) from public.lieux l));
  perform pg_temp.attendre('comptes_reseau', 'masque vrai pour tout centre de moins de 5 en formation sur ses promos en cours (centres réels compris)',
    (select string_agg(r ->> 'lieu_id' || '=' || (r ->> 'masque'), ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r),
    (select string_agg(l.id || '=' || ((select count(*) from public.stagiaires s join public.promos p on p.id = s.promo_id
                                         where p.lieu_id = l.id and s.actif and p.date_debut <= current_date
                                           and (p.date_fin is null or p.date_fin >= current_date)) < 5), ',' order by l.id) from public.lieux l));

  -- 7. demonstration : la colonne, sa valeur, et l'absence d'écriture directe.
  perform pg_temp.attendre('demonstration', 'la colonne lieux.demonstration existe (boolean, non nulle, faux par défaut)',
    (select format('%s %s %s', a.udt_name, a.is_nullable, a.column_default) from information_schema.columns a
      where a.table_schema = 'public' and a.table_name = 'lieux' and a.column_name = 'demonstration'),
    'bool NO false');
  perform pg_temp.attendre('demonstration', 'vrai pour le lieu 4 seulement (centre de démonstration)',
    pg_temp.calcul('select string_agg(id::text, '','' order by id) from public.lieux where demonstration'), '4');
  perform pg_temp.attendre('demonstration', 'comptes_reseau rend demonstration vrai pour le lieu 4 seulement',
    (select string_agg(r ->> 'lieu_id', ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r
      where r ->> 'demonstration' = 'true'), '4');
  perform pg_temp.attendre('demonstration', 'le siège lit la colonne (lieu 4)',
    pg_temp.appeler(c_siege, null, null, 'select demonstration::text from public.lieux where id = 4'), 'OK true');
  perform pg_temp.attendre('demonstration', 'la direction du centre lit la colonne de son centre (faux)',
    pg_temp.appeler(c_dir_n, null, null, format('select demonstration::text from public.lieux where id = %s', v_lieu1)), 'OK false');
  for v_x in select * from (values ('siège', c_siege), ('direction', c_dir_n), ('formateur', c_form_n)) t(nom, email) loop
    v_obt := pg_temp.ecrire(v_x.email, null, null, 'update public.lieux set demonstration = true');
    perform pg_temp.verifier('demonstration', format('aucune écriture directe de demonstration par %s (modification : refus 42501 ou 0 ligne)', v_x.nom),
      v_obt in ('REFUS 42501', 'OK 0'), v_obt);
  end loop;
  v_obt := pg_temp.ecrire(c_siege, null, null, 'insert into public.lieux (nom, demonstration) values (''Preuve écriture directe'', true)');
  perform pg_temp.verifier('demonstration', 'aucun ajout direct de centre par le siège (refus 42501 ou 0 ligne)', v_obt in ('REFUS 42501', 'OK 0'), v_obt);
  v_obt := pg_temp.ecrire(c_dir_n, null, null, 'insert into public.lieux (nom, demonstration) values (''Preuve écriture directe'', true)');
  perform pg_temp.verifier('demonstration', 'aucun ajout direct de centre par la direction (refus 42501 ou 0 ligne)', v_obt in ('REFUS 42501', 'OK 0'), v_obt);

  -- 8. creer_centre.
  perform pg_temp.verifier('creer_centre', 'la fonction creer_centre(text) existe', to_regprocedure('public.creer_centre(text)') is not null, '');
  perform pg_temp.verifier('creer_centre', 'la séquence de lieux.id est recalée sur le plus grand identifiant (dernière valeur >= plus grand id)',
    (select s.last_value from public.lieux_id_seq s) >= (select max(id) from public.lieux),
    format('séquence %s ; plus grand id %s', (select s.last_value from public.lieux_id_seq s), (select max(id) from public.lieux)));
  select max(id) into v_max_avant from public.lieux;
  v_obt := pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''Preuve nouveau centre siege'')::text');
  v_id_a := case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end;
  perform pg_temp.verifier('creer_centre', 'le siège crée un centre : identifiant rendu, plus grand que tous les identifiants existants',
    v_id_a is not null and v_id_a > v_max_avant, format('rendu %s ; plus grand id avant %s', coalesce(v_id_a::text, left(v_obt, 80)), v_max_avant));
  perform pg_temp.attendre('creer_centre', 'le siège crée un centre : la ligne, lue en propriétaire, porte le nom donné et demonstration faux',
    pg_temp.calcul(format('select format(''%%s %%s'', nom, demonstration::text) from public.lieux where id = %s', coalesce(v_id_a::text, 'null'))),
    'Preuve nouveau centre siege false');
  select max(id) into v_max_avant from public.lieux;
  v_obt := pg_temp.appeler(v_fond, null, null, 'select public.creer_centre(''Preuve nouveau centre fondateur'')::text');
  v_id_b := case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end;
  perform pg_temp.verifier('creer_centre', 'le fondateur crée un centre : identifiant rendu, plus grand que tous les identifiants existants',
    v_id_b is not null and v_id_b > v_max_avant, format('rendu %s ; plus grand id avant %s', coalesce(v_id_b::text, left(v_obt, 80)), v_max_avant));
  perform pg_temp.attendre('creer_centre', 'le fondateur crée un centre : la ligne porte le nom donné',
    (select l.nom from public.lieux l where l.id = v_id_b), 'Preuve nouveau centre fondateur');
  select max(id) into v_max_avant from public.lieux;
  v_obt := pg_temp.appeler(v_fond, null, 'siege', 'select public.creer_centre(''Preuve nouveau centre aperçu'')::text');
  v_id_c := case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end;
  perform pg_temp.verifier('creer_centre', 'le fondateur en aperçu siège crée un centre : identifiant plus grand que les existants',
    v_id_c is not null and v_id_c > v_max_avant, format('rendu %s ; plus grand id avant %s', coalesce(v_id_c::text, left(v_obt, 80)), v_max_avant));
  select count(*) into n from public.lieux;
  perform pg_temp.attendre('creer_centre', 'le fondateur en aperçu direction est refusé (42501)',
    pg_temp.appeler(v_fond, null, 'direction', 'select public.creer_centre(''Preuve refusé direction'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'le fondateur en aperçu formateur est refusé (42501)',
    pg_temp.appeler(v_fond, null, 'formateur', 'select public.creer_centre(''Preuve refusé formateur'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'la direction est refusée (42501)',
    pg_temp.appeler(c_dir_n, null, null, 'select public.creer_centre(''Preuve refusé dir'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'un formateur est refusé (42501)',
    pg_temp.appeler(c_form_n, '1', null, 'select public.creer_centre(''Preuve refusé form'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'un stagiaire est refusé (42501)',
    pg_temp.appeler(c_stag_n, '1', null, 'select public.creer_centre(''Preuve refusé stag'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'un compte sans fiche ni affectation est refusé (42501)',
    pg_temp.appeler(c_sans_role, null, null, 'select public.creer_centre(''Preuve refusé sans rôle'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'anon n''a aucun droit d''exécution (42501)',
    left(pg_temp.appeler(null, null, null, 'select public.creer_centre(''Preuve refusé anon'')::text'), 12), 'ERREUR 42501');
  perform pg_temp.attendre('creer_centre', 'droit d''exécution : authenticated oui ; anon, service_role et public non (catalogue)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public.creer_centre(text)'', ''execute''), has_function_privilege(''anon'', ''public.creer_centre(text)'', ''execute''), has_function_privilege(''service_role'', ''public.creer_centre(text)'', ''execute''))'),
    't,f,f');
  perform pg_temp.attendre('creer_centre', 'un nom vide est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre('''')::text'), 'ERREUR P0001 centre: Le nom est requis.');
  perform pg_temp.attendre('creer_centre', 'un nom d''espaces est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''   '')::text'), 'ERREUR P0001 centre: Le nom est requis.');
  perform pg_temp.attendre('creer_centre', 'un nom nul est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(null)::text'), 'ERREUR P0001 centre: Le nom est requis.');
  perform pg_temp.attendre('creer_centre', 'un nom en double, casse différente, est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''PREUVE NOUVEAU CENTRE SIEGE'')::text'), 'ERREUR P0001 centre: Ce centre existe déjà.');
  perform pg_temp.attendre('creer_centre', 'un nom en double, espaces autour, est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''  preuve nouveau centre siege  '')::text'), 'ERREUR P0001 centre: Ce centre existe déjà.');
  perform pg_temp.attendre('creer_centre', 'un nom en double d''un centre réel est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, format('select public.creer_centre(upper((select nom from public.lieux where id = %s)))::text', v_lieu1)),
    'ERREUR P0001 centre: Ce centre existe déjà.');
  v_obt := pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''  Preuve   centre   nettoyé  '')::text');
  perform pg_temp.attendre('creer_centre', 'le nom est nettoyé : espaces de bord retirés, espaces internes réduits à un',
    (select l.nom from public.lieux l where l.id = case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end),
    'Preuve centre nettoyé');
  perform pg_temp.attendre('creer_centre', 'les refus n''ont créé aucun centre (3 créations réussies avant, 1 de plus après le nom nettoyé)',
    (select count(*) from public.lieux)::text, (n + 1)::text);
  perform pg_temp.attendre('demonstration', 'après les créations, demonstration reste vrai pour le lieu 4 seulement (centres créés : faux)',
    pg_temp.calcul('select string_agg(id::text, '','' order by id) from public.lieux where demonstration'), '4');

  -- 9. Le retour, puis l'empreinte : elle doit égaler celle d'avant. La séquence est remise comme trouvée.
  v_retour := pg_temp.jouer('retour',
-- @@INJECTER supabase/migrations/20261108_espaces_1_siege_retour.sql@@
  );
  if v_retour = 'neutralisée' then
    perform pg_temp.informer('retour', 'non injecté (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'retour joué sans erreur', v_retour = 'jouée', v_retour);
  end if;
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  if v_en_ligne or v_etat = 'neutralisée' then
    perform pg_temp.informer('retour', format('non jugeable (migration non injectée) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après le retour : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après le retour : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après le retour : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
    perform pg_temp.attendre('retour', 'après le retour : plus de colonne lieux.demonstration ni de fonction comptes_reseau ou creer_centre',
      (select format('%s %s %s',
         (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'lieux' and column_name = 'demonstration'),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'comptes_reseau'),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'creer_centre'))),
      '0 0 0');
  end if;
  perform setval('public.lieux_id_seq', v_seq_last, v_seq_called);
  perform pg_temp.attendre('structure', 'séquence de lieux.id remise comme trouvée (une séquence n''est pas annulée par la levée)',
    (select format('lieux_id_seq %s/%s', s.last_value, s.is_called) from public.lieux_id_seq s), v_seq);
  perform pg_temp.informer('durée du bloc (verrous de la migration tenus jusqu''à la levée)',
    to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_espaces(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $preuve$;
