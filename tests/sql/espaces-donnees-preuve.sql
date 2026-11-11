-- Preuve de la suite du lot 5 (étape 4) : ce que la migration 20261111_espaces_4_donnees.sql doit donner, écrite avec elle.
--   Orphelin    le compte d'un ancien stagiaire (profil de rôle stagiaire sans fiche reliée) invité comme formateur, direction
--               ou siège, ou affecté par regler_affectations_formateur, devient un compte du personnel (rôle prof, is_admin
--               vrai pour un formateur, faux pour la direction et le siège, fiche formateur libre posée pour un formateur,
--               affectation posée, « transforme » vrai dans le jsonb rendu). Un profil relié à une fiche de stagiaire reste
--               refusé (même phrase) ; le fondateur, un compte affecté ou un profil du personnel ne changent pas.
--   Données     etat_anonymisation_promo(p_promo) et anonymiser_promo(p_promo) : formateur de la promo, direction du lieu de la
--               promo, fondateur (hors aperçu siège) ; refus 42501 pour une promo d'un autre lieu, un formateur d'une autre
--               promo, le siège, un stagiaire, anon ; garde des 12 mois ; comptes du personnel gardés ; journal.
--               benevoles_a_purger(p_lieu) et purger_benevoles(p_ids, p_lieu) : la direction du lieu, jamais un autre lieu.
--   Retour      les deux fonctions redéfinies ont le texte d'avant (md5), les nouvelles n'existent plus, les versions sans
--               argument n'ont jamais bougé, l'empreinte (règles, fonctions, droits) égale celle d'avant.
--   Q5          la conservation à 3 ans (20261110_conservation.sql, Qualiopi Q5) retire _anonymiser_stagiaire, les deux versions
--               sans argument (etat_anonymisation_promo(), anonymiser_promo()) et les deux versions à argument de cette
--               migration : la conservation des fiches est au fondateur, sur la page Qualiopi. Les cas de l'anonymisation ne se
--               jouent que si ces fonctions existent (base sans Q5) ; base où Q5 est appliquée (effacer_sur_demande existe), mode
--               donnees-en-ligne : un cas vérifie leur absence à toutes, et la purge des bénévoles reste prouvée.
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (tests/sql/roles-aides.sql),
-- le libellé du mode, la requête d'empreinte et la migration 4 avec son retour :
--   node outils/assembler_repetition_roles.mjs donnees <sortie.sql>                 la migration injectée : VERT attendu
--   node outils/assembler_repetition_roles.mjs donnees-contre-epreuve <sortie.sql>  sans la migration : ROUGE attendu sur les
--                                                                                   seules lignes de la migration 4
--   node outils/assembler_repetition_roles.mjs donnees-en-ligne <sortie.sql>        rien d'injecté, après application réelle
-- À jouer APRÈS les migrations 20261108_espaces_1_siege, _2_equipe et _3_habillage (la 4 s'appuie sur la 2). Le fichier
-- assemblé se joue en une requête ; le bloc do finit TOUJOURS par une levée : migration, personnages et lignes d'essai sont
-- annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $empreinte$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $empreinte$;

-- Une migration ou un retour, joué tel quel dans une sous-transaction : « jouée », « neutralisée » (le littéral 'select 1'
-- que l'assembleur met à la place d'un fichier non demandé), ou l'erreur (état SQL, jamais le message).
create or replace function pg_temp.jouer(p_nom text, p_sql text)
returns text language plpgsql as $fx$
begin
  if p_sql = 'select 1' then return 'neutralisée'; end if;
  perform pg_temp.informer(format('md5 du texte joué : %s', p_nom), md5(p_sql));
  begin
    execute p_sql;
    return 'jouée';
  exception when others then
    return 'ERREUR ' || sqlstate;
  end;
end $fx$;

-- Un appel fait par un personnage : « OK <valeur> » ou « ERREUR <état> <message> » (message coupé à 120 caractères).
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

-- Le jsonb rendu par un appel réussi (« OK {...} »), ou nul.
create or replace function pg_temp.reponse(p_appel text)
returns jsonb language sql as $f$
  select case when p_appel like 'OK {%' then substr(p_appel, 4)::jsonb end;
$f$;

-- Le profil d'un compte, résumé : rôle, is_admin, fiche formateur posée, fiche de stagiaire, invité par.
create or replace function pg_temp.profil(p_email text)
returns text language sql as $f$
  select concat_ws(' ; ', u.role, u.is_admin::text, (u.prof_id is not null)::text, coalesce(u.stagiaire_id::text, 'sans fiche'),
                   coalesce(u.invited_by_email, 'nul'))
    from public.user_profiles u where lower(u.email) = lower(p_email);
$f$;
-- Les affectations d'un compte, « role:promo:lieu » triées.
create or replace function pg_temp.affectations_de(p_email text)
returns text language sql as $f$
  select coalesce(string_agg(format('%s:%s:%s', a.role, coalesce(a.promo_id::text, '-'), coalesce(a.lieu_id::text, '-')), ',' order by a.role, a.promo_id, a.lieu_id), 'aucune')
    from public.affectations a where lower(a.email) = lower(p_email);
$f$;
-- Un instantané de toutes les affectations et du nombre de profils.
create or replace function pg_temp.instantane()
returns text language sql as $f$
  select md5(coalesce(string_agg(format('%s|%s|%s|%s|%s', a.id, a.email, a.role, a.promo_id, a.lieu_id), ';' order by a.id), ''))
         || '/' || (select count(*) from public.user_profiles)
    from public.affectations a;
$f$;

-- Verdict : lève TOUJOURS une exception, qui annule tout. Les échecs d'abord, puis les comptes par groupe, puis chaque contrôle réussi.
create or replace function pg_temp.verdict_donnees(p_mode text, p_debut timestamptz)
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

do $preuve$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  c_siege constant text := 'preuve6.siege@exemple.invalid';
  c_dir1 constant text := 'preuve6.dir.un@exemple.invalid';
  c_dir2 constant text := 'preuve6.dir.deux@exemple.invalid';
  c_form_a constant text := 'preuve6.form.a@exemple.invalid';
  c_form_b constant text := 'preuve6.form.b@exemple.invalid';
  c_stag constant text := 'preuve6.stag@exemple.invalid';
  c_sans constant text := 'preuve6.sans.role@exemple.invalid';
  o_form constant text := 'preuve6.orphelin.formateur@exemple.invalid';
  o_form2 constant text := 'preuve6.orphelin.formateur.deux@exemple.invalid';
  o_dir constant text := 'preuve6.orphelin.direction@exemple.invalid';
  o_siege constant text := 'preuve6.orphelin.siege@exemple.invalid';
  o_regler constant text := 'preuve6.orphelin.regler@exemple.invalid';
  o_vide constant text := 'preuve6.orphelin.vide@exemple.invalid';
  o_mixte constant text := 'Preuve6.Orphelin.Mixte@Exemple.Invalid';
  o_fonda constant text := 'preuve6.orphelin.fondateur@exemple.invalid';
  o_refus constant text := 'preuve6.orphelin.refus@exemple.invalid';
  o_aff constant text := 'preuve6.orphelin.affecte@exemple.invalid';
  o_admin constant text := 'preuve6.orphelin.admin@exemple.invalid';
  o_double constant text := 'preuve6.orphelin.double@exemple.invalid';
  c_autre_par constant text := 'preuve6.autre.invitant@exemple.invalid';
  c_neuf constant text := 'preuve6.neuf@exemple.invalid';
  c_exec constant text := 'select concat_ws('','', has_function_privilege(''authenticated'', ''%1$s'', ''execute''), has_function_privilege(''anon'', ''%1$s'', ''execute''), has_function_privilege(''service_role'', ''%1$s'', ''execute''))';
  c_phrase_stag constant text := 'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.';
  c_refus_promo constant text := 'ERREUR 42501 Réservé à la direction du centre ou au formateur de la promo';
  c_refus_centre constant text := 'ERREUR 42501 Réservé à la direction du centre';
  v_en_ligne boolean;
  -- Qualiopi Q5 appliquée (voir l'en-tête) : les fonctions d'anonymisation n'existent plus.
  v_q5 constant boolean := to_regprocedure('public.effacer_sur_demande(integer)') is not null;
  v_etat text; v_retour text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_ic_md5 text; v_rg_md5 text; v_anciennes text;
  v_fond text; v_lieu1 integer; v_lieu2 integer;
  v_pf1 constant integer := 990501; v_pr1 constant integer := 990502; v_pe1 constant integer := 990503;
  v_pf2 constant integer := 990504; v_pg1 constant integer := 990505;
  v_fiche_libre integer; v_fiche_libre2 integer; v_fiche_prise integer;
  v_r jsonb; v_snap text; v_profil_avant text;
  v_b1 integer; v_b2 integer; v_b3 integer; v_b4 integer; v_b5 integer;
  v_ids text;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'donnees-en-ligne%';

  -- 1. Avant la migration : empreinte, textes des fonctions qui vont changer, textes des versions sans argument.
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  v_ic_md5 := md5(pg_get_functiondef('public.inviter_compte(text, text, integer, integer, integer)'::regprocedure));
  v_rg_md5 := md5(pg_get_functiondef('public.regler_affectations_formateur(text, integer, integer[], integer)'::regprocedure));
  v_anciennes := (select string_agg(coalesce(md5(pg_get_functiondef(to_regprocedure(x))), 'absente'), ',' order by x)
                    from unnest(array['public.etat_anonymisation_promo()', 'public.anonymiser_promo()',
                                      'public.benevoles_a_purger()', 'public.purger_benevoles(integer[])']) x);
  v_lieu1 := (select lieu_id from public.promos where id = 1);
  v_lieu2 := (select lieu_id from public.promos where id = 2);
  select up.email into v_fond from public.user_profiles up where up.is_founder order by up.email limit 1;
  perform pg_temp.verifier('structure', 'un fondateur trouvé par requête (adresse jamais affichée), les promos 1 et 2 et leurs centres',
    v_fond is not null and v_lieu1 is not null and v_lieu2 is not null and v_lieu1 <> v_lieu2,
    format('centres des promos 1 et 2 : %s et %s', coalesce(v_lieu1::text, 'nul'), coalesce(v_lieu2::text, 'nul')));
  perform pg_temp.verifier('structure', 'les trois fonctions d''avant la migration 4 existent (étape 2 jouée ; etat_anonymisation_promo() retirée si Q5 est appliquée)',
    to_regprocedure('public._profil_formateur(text, integer, text)') is not null
    and to_regprocedure('public.regler_affectations_formateur(text, integer, integer[], integer)') is not null
    and (v_q5 or to_regprocedure('public.etat_anonymisation_promo()') is not null), '');
  perform pg_temp.informer('Qualiopi Q5', case when v_q5 then 'appliquée : cas de l''anonymisation remplacés par le contrôle de son absence'
                                              else 'absente : cas de l''anonymisation joués' end);

  -- 2. La migration, injectée telle quelle (neutralisée dans les modes sans elle).
  v_etat := pg_temp.jouer('migration 4',
-- @@INJECTER supabase/migrations/20261111_espaces_4_donnees.sql@@
  );
  if v_etat = 'neutralisée' then
    perform pg_temp.informer('migration 4', 'non injectée (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'migration 4 jouée sans erreur', v_etat = 'jouée', v_etat);
  end if;

  -- 3. Personnages et lignes d'essai, en propriétaire.
  insert into public.profs (nom) values ('Preuve6 fiche libre') returning id into v_fiche_libre;
  insert into public.profs (nom) values ('Preuve6 fiche libre deux') returning id into v_fiche_libre2;
  insert into public.profs (nom) values ('Preuve6 fiche prise') returning id into v_fiche_prise;
  insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values
    (v_pf1, v_lieu1, 'Preuve6 promo finie un', current_date - 600, current_date - 400),
    (v_pr1, v_lieu1, 'Preuve6 promo finie récente', current_date - 300, current_date - 30),
    (v_pe1, v_lieu1, 'Preuve6 promo en cours', current_date - 20, null),
    (v_pf2, v_lieu2, 'Preuve6 promo finie deux', current_date - 600, current_date - 400),
    (v_pg1, v_lieu1, 'Preuve6 promo finie autre', current_date - 600, current_date - 400);
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id) values
    (990601, 'Preuve6 un', 'PREUVE', 1, true, v_pf1),
    (990602, 'Preuve6 deux', 'PREUVE', 2, true, v_pf1),
    (990603, 'Preuve6 trois', 'PREUVE', 1, true, v_pf2),
    (990604, 'Preuve6 quatre', 'PREUVE', 1, true, v_pr1),
    (990605, 'Preuve6 cinq', 'PREUVE', 1, true, 1);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id, prof_id) values
    (c_siege, 'prof', false, null, null), (c_dir1, 'prof', false, null, null), (c_dir2, 'prof', false, null, null),
    (c_form_a, 'prof', true, null, v_fiche_prise), (c_form_b, 'prof', true, null, null),
    (c_stag, 'stagiaire', false, 990605, null), (c_sans, 'stagiaire', false, null, null),
    ('preuve6.stag.admin@exemple.invalid', 'stagiaire', true, 990602, null),
    (o_form, 'stagiaire', false, null, null), (o_form2, 'stagiaire', false, null, null), (o_dir, 'stagiaire', false, null, null),
    (o_siege, 'stagiaire', false, null, null), (o_regler, 'stagiaire', false, null, null), (o_vide, 'stagiaire', false, null, null),
    (o_mixte, 'stagiaire', false, null, null), (o_refus, 'stagiaire', false, null, null);
  insert into public.user_profiles (email, role, is_admin, is_founder, stagiaire_id) values (o_fonda, 'stagiaire', false, true, null);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id, invited_by_email) values
    (o_aff, 'stagiaire', false, null, c_autre_par), (o_admin, 'stagiaire', true, null, null),
    (o_double, 'stagiaire', false, null, null), (upper(o_double), 'stagiaire', false, null, null);
  insert into public.affectations (email, role, promo_id, lieu_id) values (o_aff, 'direction', null, v_lieu2);
  insert into public.affectations (email, role, promo_id, lieu_id) values
    (c_siege, 'siege', null, null), (c_dir1, 'direction', null, v_lieu1), (c_dir2, 'direction', null, v_lieu2),
    (c_form_a, 'formateur', v_pf1, null), (c_form_b, 'formateur', v_pg1, null);
  perform pg_temp.verifier('structure', 'personnages, promos, fiches et orphelins posés',
    (select count(*) from public.user_profiles where email like 'preuve6.%' or lower(email) like 'preuve6.%') = 21
    and (select count(*) from public.promos where id between v_pf1 and v_pg1) = 5
    and (select count(*) from public.stagiaires where id between 990601 and 990605) = 5, '');
  v_snap := pg_temp.instantane();

  -- 4. Orphelin : le compte d'un ancien stagiaire invité au personnel est transformé.
  -- 4.1 Formateur : la direction du lieu 1 invite un orphelin (promo 1 affichée), avec une fiche formateur libre.
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, %s, null)::text', o_form, v_fiche_libre)));
  perform pg_temp.attendre('orphelin', 'inviter un orphelin comme formateur : transforme vrai, cree faux, affecte 1',
    concat_ws(' ; ', v_r ->> 'role', v_r ->> 'transforme', v_r ->> 'cree', v_r ->> 'affecte'), 'formateur ; true ; false ; 1');
  perform pg_temp.attendre('orphelin', 'l''orphelin devient formateur : rôle prof, droit d''administration, fiche formateur posée, sans fiche de stagiaire, invité par la direction',
    pg_temp.profil(o_form), format('prof ; true ; true ; sans fiche ; %s', c_dir1));
  perform pg_temp.attendre('orphelin', 'la fiche formateur libre est bien celle demandée',
    (select (u.prof_id = v_fiche_libre)::text from public.user_profiles u where u.email = o_form), 'true');
  perform pg_temp.attendre('orphelin', 'son affectation formateur est posée sur la promo affichée',
    pg_temp.affectations_de(o_form), 'formateur:1:-');
  -- 4.2 Une fiche formateur déjà reliée à un compte n'est pas reprise.
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, %s, null)::text', o_form2, v_fiche_prise)));
  perform pg_temp.attendre('orphelin', 'orphelin invité avec une fiche formateur déjà prise : transformé, mais sans fiche',
    concat_ws(' ; ', v_r ->> 'transforme', pg_temp.profil(o_form2)), format('true ; prof ; true ; false ; sans fiche ; %s', c_dir1));
  -- 4.3 Adresse à majuscules (profil enregistré en majuscules) et adresse en minuscules avec espaces.
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', '  ' || lower(o_mixte) || ' ')));
  perform pg_temp.attendre('orphelin', 'orphelin à adresse mixte (profil en majuscules) : transformé de même',
    concat_ws(' ; ', v_r ->> 'transforme', pg_temp.profil(o_mixte)), format('true ; prof ; true ; false ; sans fiche ; %s', c_dir1));
  perform pg_temp.attendre('orphelin', 'sans doublon : un seul profil à cette adresse (casse ignorée)',
    (select count(*)::text from public.user_profiles where lower(email) = lower(o_mixte)), '1');
  -- 4.4 Direction : le siège invite un orphelin comme direction du lieu 2.
  v_r := pg_temp.reponse(pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', o_dir, v_lieu2)));
  perform pg_temp.attendre('orphelin', 'inviter un orphelin comme direction : transforme vrai, cree faux, affecte 1',
    concat_ws(' ; ', v_r ->> 'role', v_r ->> 'transforme', v_r ->> 'cree', v_r ->> 'affecte'), 'direction ; true ; false ; 1');
  perform pg_temp.attendre('orphelin', 'l''orphelin devient direction : rôle prof sans droit d''administration ni fiche formateur, affectation direction du lieu',
    concat_ws(' ; ', pg_temp.profil(o_dir), pg_temp.affectations_de(o_dir)), format('prof ; false ; false ; sans fiche ; %s ; direction:-:%s', c_siege, v_lieu2));
  -- 4.5 Siège : le fondateur invite un orphelin comme siège.
  v_r := pg_temp.reponse(pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', o_siege)));
  perform pg_temp.attendre('orphelin', 'inviter un orphelin comme siège : transforme vrai, cree faux, affecte 1',
    concat_ws(' ; ', v_r ->> 'role', v_r ->> 'transforme', v_r ->> 'cree', v_r ->> 'affecte'), 'siege ; true ; false ; 1');
  perform pg_temp.attendre('orphelin', 'l''orphelin devient siège : rôle prof sans droit d''administration, affectation siège',
    concat_ws(' ; ', (select concat_ws('/', u.role, u.is_admin::text, (u.prof_id is not null)::text) from public.user_profiles u where u.email = o_siege), pg_temp.affectations_de(o_siege)),
    'prof/false/false ; siege:-:-');
  -- 4.6 regler_affectations_formateur sur un orphelin.
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.regler_affectations_formateur(%L, %s, array[%s]::integer[], %s)::text', o_regler, v_lieu1, v_pf1, v_fiche_libre2)));
  perform pg_temp.attendre('orphelin', 'regler_affectations_formateur sur un orphelin : transforme vrai, cree faux, une promo ajoutée',
    concat_ws(' ; ', v_r ->> 'transforme', v_r ->> 'cree', v_r -> 'ajoutees', v_r ->> 'email'), format('true ; false ; [%s] ; %s', v_pf1, o_regler));
  perform pg_temp.attendre('orphelin', 'l''orphelin réglé devient formateur : rôle prof, droit d''administration, fiche posée, affectation sur la promo choisie',
    concat_ws(' ; ', pg_temp.profil(o_regler), pg_temp.affectations_de(o_regler)), format('prof ; true ; true ; sans fiche ; %s ; formateur:%s:-', c_dir1, v_pf1));
  -- Liste vide : rien n'est transformé (il faut au moins une promo pour un compte neuf, et rien n'est retiré à un orphelin).
  v_profil_avant := pg_temp.profil(o_vide);
  perform pg_temp.appeler(c_dir1, '1', null, format('select public.regler_affectations_formateur(%L, %s, array[]::integer[], null)::text', o_vide, v_lieu1));
  perform pg_temp.attendre('orphelin', 'regler_affectations_formateur avec une liste vide ne transforme pas l''orphelin',
    pg_temp.profil(o_vide) || ' ; ' || pg_temp.affectations_de(o_vide), v_profil_avant || ' ; aucune');
  -- 4.7 Un compte neuf, un compte du personnel et un compte déjà transformé.
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', c_neuf)));
  perform pg_temp.attendre('orphelin', 'une adresse neuve : cree vrai, transforme faux, profil formateur comme avant',
    concat_ws(' ; ', v_r ->> 'cree', v_r ->> 'transforme', pg_temp.profil(c_neuf)), format('true ; false ; prof ; true ; false ; sans fiche ; %s', c_dir1));
  v_profil_avant := pg_temp.profil(c_form_a);
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, %s, null)::text', c_form_a, v_fiche_libre2)));
  perform pg_temp.attendre('orphelin', 'un formateur déjà en place réinvité : transforme faux, profil inchangé',
    concat_ws(' ; ', v_r ->> 'transforme', (pg_temp.profil(c_form_a) = v_profil_avant)::text), 'false ; true');
  v_profil_avant := pg_temp.profil(o_form);
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', o_form)));
  perform pg_temp.attendre('orphelin', 'l''orphelin déjà transformé réinvité : transforme faux, profil inchangé',
    concat_ws(' ; ', v_r ->> 'transforme', (pg_temp.profil(o_form) = v_profil_avant)::text), 'false ; true');
  v_profil_avant := pg_temp.profil(o_dir);
  v_r := pg_temp.reponse(pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', o_dir, v_lieu2)));
  perform pg_temp.attendre('orphelin', 'la direction déjà transformée réinvitée : transforme faux, profil inchangé',
    concat_ws(' ; ', v_r ->> 'transforme', (pg_temp.profil(o_dir) = v_profil_avant)::text), 'false ; true');
  -- 4.8 Le fondateur (profil is_founder) n'est jamais transformé.
  v_profil_avant := (select concat_ws(' ; ', u.role, u.is_admin::text, u.is_founder::text) from public.user_profiles u where u.email = o_fonda);
  perform pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', o_fonda));
  perform pg_temp.attendre('orphelin', 'un profil fondateur sans fiche n''est pas transformé (rôle et droits inchangés)',
    (select concat_ws(' ; ', u.role, u.is_admin::text, u.is_founder::text) from public.user_profiles u where u.email = o_fonda), v_profil_avant);
  -- 4.8 bis Un orphelin déjà affecté est réparé sans rien perdre : is_admin ne baisse jamais, invited_by n'est jamais réécrit.
  v_r := pg_temp.reponse(pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', o_aff)));
  perform pg_temp.attendre('orphelin', 'orphelin déjà direction d''un autre centre, invité formateur : transformé (rôle prof, is_admin vrai), invité par inchangé, ses deux affectations',
    concat_ws(' ; ', v_r ->> 'transforme', pg_temp.profil(o_aff), pg_temp.affectations_de(o_aff)),
    format('true ; prof ; true ; false ; sans fiche ; %s ; direction:-:%s,formateur:1:-', c_autre_par, v_lieu2));
  v_r := pg_temp.reponse(pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', o_admin, v_lieu2)));
  perform pg_temp.attendre('orphelin', 'orphelin à is_admin vrai invité direction : transformé, is_admin reste vrai (jamais rétrogradé)',
    concat_ws(' ; ', v_r ->> 'transforme', pg_temp.profil(o_admin)), format('true ; prof ; true ; false ; sans fiche ; %s', c_siege));
  -- Deux profils à la même adresse à la casse près : phrase claire, rien n'est changé.
  v_snap := pg_temp.instantane();
  perform pg_temp.attendre('orphelin', 'deux orphelins à la même adresse (casse différente) : phrase claire, pas de message technique',
    pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', o_double)),
    'ERREUR P0001 invitation: Deux comptes existent pour cette adresse (écrite avec des majuscules sur l''un) : à régler par le fondateur.');
  perform pg_temp.attendre('orphelin', 'ce refus n''a rien changé (profils, affectations)',
    pg_temp.instantane() || ' ' || (select string_agg(u.role || ':' || u.email, ',' order by u.email collate "C") from public.user_profiles u where lower(u.email) = o_double),
    v_snap || ' stagiaire:' || upper(o_double) || ',stagiaire:' || o_double);
  -- 4.9 Un profil relié à une fiche de stagiaire reste refusé, dans les quatre chemins, sans rien écrire.
  v_snap := pg_temp.instantane();
  perform pg_temp.attendre('orphelin', 'formateur : l''adresse d''un compte stagiaire (avec fiche) reste refusée, même phrase',
    pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', c_stag)), c_phrase_stag);
  perform pg_temp.attendre('orphelin', 'direction : l''adresse d''un compte stagiaire (avec fiche) reste refusée, même phrase',
    pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', c_stag, v_lieu1)), c_phrase_stag);
  perform pg_temp.attendre('orphelin', 'siège : l''adresse d''un compte stagiaire (avec fiche) reste refusée, même phrase',
    pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', c_stag)), c_phrase_stag);
  perform pg_temp.attendre('orphelin', 'regler_affectations_formateur : l''adresse d''un compte stagiaire (avec fiche) reste refusée',
    pg_temp.appeler(c_dir1, '1', null, format('select public.regler_affectations_formateur(%L, %s, array[%s]::integer[], null)::text', c_stag, v_lieu1, v_pf1)),
    'ERREUR P0001 equipe: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('orphelin', 'ces refus n''ont écrit aucune ligne (affectations et nombre de profils) et le compte stagiaire est resté stagiaire',
    pg_temp.instantane() || ' ' || pg_temp.profil(c_stag), v_snap || ' ' || 'stagiaire ; false ; false ; 990605 ; nul');
  -- 4.10 Les refus de droit passent avant : l'orphelin n'est pas transformé par qui n'en a pas le droit.
  v_profil_avant := pg_temp.profil(o_refus);
  perform pg_temp.attendre('orphelin', 'un formateur qui invite un orphelin comme direction reçoit le refus de droit, l''orphelin reste stagiaire',
    pg_temp.appeler(c_form_a, '1', null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', o_refus, v_lieu1)),
    'ERREUR 42501 invitation: Réservé au siège.');
  perform pg_temp.attendre('orphelin', 'la direction qui invite un orphelin comme siège reçoit le refus de droit, l''orphelin reste stagiaire',
    pg_temp.appeler(c_dir1, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', o_refus)),
    'ERREUR 42501 invitation: Réservé au fondateur.');
  perform pg_temp.attendre('orphelin', 'la direction d''un autre lieu qui règle les promos d''un orphelin dans le lieu 1 reçoit le refus de droit',
    pg_temp.appeler(c_dir2, '1', null, format('select public.regler_affectations_formateur(%L, %s, array[%s]::integer[], null)::text', o_refus, v_lieu1, v_pf1)),
    'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('orphelin', 'l''orphelin refusé n''a pas bougé (profil et affectations)',
    pg_temp.profil(o_refus) || ' ; ' || pg_temp.affectations_de(o_refus), v_profil_avant || ' ; aucune');
  perform pg_temp.attendre('orphelin', 'la fonction interne _orphelin_en_personnel existe, sans droit d''exécution pour authenticated, anon ni service_role',
    case when to_regprocedure('public._orphelin_en_personnel(text, boolean, integer, text)') is null then 'absente'
         else pg_temp.calcul(format(c_exec, 'public._orphelin_en_personnel(text, boolean, integer, text)')) end, 'f,f,f');

  -- 5. Données personnelles : état et anonymisation d'une promo, par la direction du centre.
  perform pg_temp.attendre('donnees', 'droit d''exécution de benevoles_a_purger(integer) : authenticated oui, anon et service_role non',
    case when to_regprocedure('public.benevoles_a_purger(integer)') is null then 'absente'
         else pg_temp.calcul(format(c_exec, 'public.benevoles_a_purger(integer)')) end, 't,f,f');
  perform pg_temp.attendre('donnees', 'droit d''exécution de purger_benevoles(integer[], integer) : authenticated oui, anon et service_role non',
    case when to_regprocedure('public.purger_benevoles(integer[], integer)') is null then 'absente'
         else pg_temp.calcul(format(c_exec, 'public.purger_benevoles(integer[], integer)')) end, 't,f,f');
  perform pg_temp.attendre('donnees', 'les versions sans argument sont intactes (md5 des quatre définitions d''avant ; « absente » des deux d''anonymisation si Q5 est appliquée)',
    (select string_agg(coalesce(md5(pg_get_functiondef(to_regprocedure(x))), 'absente'), ',' order by x)
       from unnest(array['public.etat_anonymisation_promo()', 'public.anonymiser_promo()',
                         'public.benevoles_a_purger()', 'public.purger_benevoles(integer[])']) x), v_anciennes);
  if v_q5 then
    -- Q5 appliquée : plus aucune anonymisation, ni pour l'équipe ni pour la direction (la conservation est au fondateur).
    perform pg_temp.attendre('donnees', 'Q5 appliquée : les versions à argument et sans argument de l''anonymisation et _anonymiser_stagiaire n''existent plus',
      (select string_agg(x || ':' || (to_regprocedure(x) is null)::text, ',' order by x)
         from unnest(array['public.etat_anonymisation_promo(integer)', 'public.anonymiser_promo(integer)', 'public.etat_anonymisation_promo()',
                           'public.anonymiser_promo()', 'public._anonymiser_stagiaire(integer)']) x),
      'public._anonymiser_stagiaire(integer):true,public.anonymiser_promo():true,public.anonymiser_promo(integer):true,'
      || 'public.etat_anonymisation_promo():true,public.etat_anonymisation_promo(integer):true');
  else
    perform pg_temp.attendre('donnees', 'droit d''exécution de etat_anonymisation_promo(integer) : authenticated oui, anon et service_role non',
      case when to_regprocedure('public.etat_anonymisation_promo(integer)') is null then 'absente'
           else pg_temp.calcul(format(c_exec, 'public.etat_anonymisation_promo(integer)')) end, 't,f,f');
    perform pg_temp.attendre('donnees', 'droit d''exécution de anonymiser_promo(integer) : authenticated oui, anon et service_role non',
      case when to_regprocedure('public.anonymiser_promo(integer)') is null then 'absente'
           else pg_temp.calcul(format(c_exec, 'public.anonymiser_promo(integer)')) end, 't,f,f');
    -- 5.1 Lecture de l'état par la direction du lieu 1, promo 1 affichée (donc pas la promo lue).
    perform pg_temp.attendre('donnees', 'la direction du lieu 1 lit l''état d''une promo finie depuis plus de 12 mois qui n''est pas la promo affichée (anonymisable, 2 restants, 1 compte du personnel, 0 anonymisé)',
      pg_temp.appeler(c_dir1, '1', null, format('select concat_ws('' '', r->>''anonymisable'', r->>''restants'', r->>''comptes_admin'', r->>''anonymises'') from (select public.etat_anonymisation_promo(%s) r) z', v_pf1)),
      'OK true 2 1 0');
    perform pg_temp.attendre('donnees', 'la même, avec une autre promo affichée (promo 2, d''un autre lieu) : l''en-tête ne change rien',
      pg_temp.appeler(c_dir1, '2', null, format('select concat_ws('' '', r->>''anonymisable'', r->>''restants'') from (select public.etat_anonymisation_promo(%s) r) z', v_pf1)),
      'OK true 2');
    perform pg_temp.attendre('donnees', 'promo finie depuis moins de 12 mois : pas anonymisable, date de possibilité rendue',
      pg_temp.appeler(c_dir1, '1', null, format('select concat_ws('' '', r->>''anonymisable'', r->>''restants'', ((r->>''anonymisable_le'')::date = (current_date - 30 + interval ''12 months'')::date)::text) from (select public.etat_anonymisation_promo(%s) r) z', v_pr1)),
      'OK false 1 true');
    perform pg_temp.attendre('donnees', 'promo sans date de fin : pas anonymisable, pas de date',
      pg_temp.appeler(c_dir1, '1', null, format('select concat_ws('' '', r->>''anonymisable'', coalesce(r->>''anonymisable_le'', ''nul'')) from (select public.etat_anonymisation_promo(%s) r) z', v_pe1)),
      'OK false nul');
    perform pg_temp.attendre('donnees', 'le formateur de la promo lit son état',
      pg_temp.appeler(c_form_a, '1', null, format('select (public.etat_anonymisation_promo(%s)->>''promo_id'')', v_pf1)), 'OK ' || v_pf1);
    perform pg_temp.attendre('donnees', 'la direction du lieu 2 lit l''état de la promo de son lieu',
      pg_temp.appeler(c_dir2, '2', null, format('select (public.etat_anonymisation_promo(%s)->>''restants'')', v_pf2)), 'OK 1');
    perform pg_temp.attendre('donnees', 'le fondateur lit l''état d''une promo quelconque',
      pg_temp.appeler(v_fond, '1', null, format('select (public.etat_anonymisation_promo(%s)->>''restants'')', v_pf2)), 'OK 1');
    perform pg_temp.attendre('donnees', 'promo inconnue : le fondateur reçoit nul, sans erreur',
      pg_temp.appeler(v_fond, '1', null, 'select public.etat_anonymisation_promo(990999)::text'), 'OK nul');
    -- 5.2 Refus de l'état.
    perform pg_temp.attendre('donnees', 'la direction du lieu 1 ne lit pas l''état d''une promo du lieu 2 (42501, avec la phrase)',
      pg_temp.appeler(c_dir1, '1', null, format('select public.etat_anonymisation_promo(%s)::text', v_pf2)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'la direction du lieu 2 ne lit pas l''état d''une promo du lieu 1',
      left(pg_temp.appeler(c_dir2, '2', null, format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), 12), 'ERREUR 42501');
    perform pg_temp.attendre('donnees', 'un formateur d''une autre promo (même lieu) ne lit pas l''état',
      pg_temp.appeler(c_form_b, '1', null, format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'le siège (sans être direction) ne lit pas l''état',
      pg_temp.appeler(c_siege, null, null, format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'un stagiaire ne lit pas l''état',
      pg_temp.appeler(c_stag, '1', null, format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'un compte sans rôle ne lit pas l''état',
      left(pg_temp.appeler(c_sans, null, null, format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), 12), 'ERREUR 42501');
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu siège ne lit pas l''état (droits du rôle simulé)',
      left(pg_temp.appeler(v_fond, '1', 'siege', format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), 12), 'ERREUR 42501');
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu stagiaire ne lit pas l''état',
      left(pg_temp.appeler(v_fond, '1', 'stagiaire', format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), 12), 'ERREUR 42501');
    perform pg_temp.attendre('donnees', 'anon est refusé (42501, pas de droit d''exécution)',
      left(pg_temp.appeler(null, null, null, format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), 12), 'ERREUR 42501');
    -- 5.3 Anonymisation : refus d'abord (rien ne doit bouger).
    perform pg_temp.attendre('donnees', 'la direction du lieu 1 n''anonymise pas une promo du lieu 2 (42501)',
      pg_temp.appeler(c_dir1, '1', null, format('select public.anonymiser_promo(%s)::text', v_pf2)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'un formateur d''une autre promo n''anonymise pas',
      pg_temp.appeler(c_form_b, '1', null, format('select public.anonymiser_promo(%s)::text', v_pf1)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'le siège n''anonymise pas',
      pg_temp.appeler(c_siege, null, null, format('select public.anonymiser_promo(%s)::text', v_pf1)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'un stagiaire n''anonymise pas',
      pg_temp.appeler(c_stag, '1', null, format('select public.anonymiser_promo(%s)::text', v_pf1)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu siège n''anonymise pas',
      left(pg_temp.appeler(v_fond, '1', 'siege', format('select public.anonymiser_promo(%s)::text', v_pf1)), 12), 'ERREUR 42501');
    perform pg_temp.attendre('donnees', 'anon n''anonymise pas',
      left(pg_temp.appeler(null, null, null, format('select public.anonymiser_promo(%s)::text', v_pf1)), 12), 'ERREUR 42501');
    perform pg_temp.attendre('donnees', 'avant 12 mois : refus avec la date de possibilité',
      pg_temp.appeler(c_dir1, '1', null, format('select public.anonymiser_promo(%s)::text', v_pr1)),
      'ERREUR P0001 Anonymisation possible à partir du ' || to_char((current_date - 30 + interval '12 months')::date, 'DD/MM/YYYY'));
    perform pg_temp.attendre('donnees', 'sans date de fin : refus',
      pg_temp.appeler(c_dir1, '1', null, format('select public.anonymiser_promo(%s)::text', v_pe1)), 'ERREUR P0001 Date de fin de promo non renseignée');
    perform pg_temp.attendre('donnees', 'promo inconnue : refus pour la direction (42501), erreur claire pour le fondateur',
      left(pg_temp.appeler(c_dir1, '1', null, 'select public.anonymiser_promo(990999)::text'), 12) || ' / ' || pg_temp.appeler(v_fond, '1', null, 'select public.anonymiser_promo(990999)::text'),
      'ERREUR 42501 / ERREUR P0001 Promo introuvable');
    perform pg_temp.attendre('donnees', 'aucun refus n''a anonymisé quelqu''un ni écrit au journal',
      (select format('%s %s', (select count(*) from public.stagiaires where id between 990601 and 990604 and anonymise_le is not null),
                             (select count(*) from public.effacements_journal where type = 'promo' and cible in ('promo ' || v_pf1, 'promo ' || v_pf2, 'promo ' || v_pr1, 'promo ' || v_pe1)))), '0 0');
    -- 5.3 bis Le fondateur en aperçu : les droits du rôle simulé seulement, promo 1 affichée (lieu 1).
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu direction (promo 1 affichée) ne lit pas l''état d''une promo du lieu 2',
      pg_temp.appeler(v_fond, '1', 'direction', format('select public.etat_anonymisation_promo(%s)::text', v_pf2)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu direction n''anonymise pas une promo du lieu 2',
      pg_temp.appeler(v_fond, '1', 'direction', format('select public.anonymiser_promo(%s)::text', v_pf2)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu direction lit l''état d''une promo du lieu affiché',
      pg_temp.appeler(v_fond, '1', 'direction', format('select (public.etat_anonymisation_promo(%s)->>''restants'')', v_pf1)), 'OK 2');
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu formateur (promo 1 affichée) ne lit pas l''état d''une autre promo, même du lieu affiché',
      pg_temp.appeler(v_fond, '1', 'formateur', format('select public.etat_anonymisation_promo(%s)::text', v_pf1)), c_refus_promo);
    perform pg_temp.attendre('donnees', 'le fondateur en aperçu formateur n''anonymise pas une autre promo que l''affichée',
      pg_temp.appeler(v_fond, '1', 'formateur', format('select public.anonymiser_promo(%s)::text', v_pf1)), c_refus_promo);
    -- 5.4 Anonymisation réussie par la direction du lieu 1, promo 1 affichée.
    perform pg_temp.attendre('donnees', 'la direction du lieu 1 anonymise une promo de son lieu qui n''est pas la promo affichée (1 anonymisé, 1 compte du personnel gardé)',
      pg_temp.appeler(c_dir1, '1', null, format('select concat_ws('' '', r->>''anonymises'', r->>''comptes_admin_ignores'') from (select public.anonymiser_promo(%s) r) z', v_pf1)),
      'OK 1 1');
    perform pg_temp.attendre('donnees', 'les fiches : la fiche simple est anonymisée, celle du compte du personnel est gardée, les autres promos ne bougent pas',
      (select string_agg(format('%s:%s', s.id, (s.anonymise_le is not null)::text), ' ' order by s.id) from public.stagiaires s where s.id between 990601 and 990604),
      '990601:true 990602:false 990603:false 990604:false');
    perform pg_temp.attendre('donnees', 'le journal des effacements note la promo, la direction qui l''a faite et les comptes',
      (select format('%s %s %s', count(*), min(j.fait_par_email), min(j.details::text)) from public.effacements_journal j where j.type = 'promo' and j.cible = 'promo ' || v_pf1),
      format('1 %s {"anonymises": 1, "comptes_admin_ignores": 1}', c_dir1));
    perform pg_temp.attendre('donnees', 'rejouée, l''anonymisation ne refait rien (0 anonymisé, le compte du personnel toujours gardé)',
      pg_temp.appeler(c_dir1, '1', null, format('select concat_ws('' '', r->>''anonymises'', r->>''comptes_admin_ignores'') from (select public.anonymiser_promo(%s) r) z', v_pf1)),
      'OK 0 1');
    perform pg_temp.attendre('donnees', 'l''état après coup : 1 restant, 1 compte du personnel, 1 anonymisé',
      pg_temp.appeler(c_dir1, '1', null, format('select concat_ws('' '', r->>''restants'', r->>''comptes_admin'', r->>''anonymises'') from (select public.etat_anonymisation_promo(%s) r) z', v_pf1)),
      'OK 1 1 1');
    perform pg_temp.attendre('donnees', 'le formateur de la promo anonymise la sienne (rien à faire de plus ici : état lu)',
      pg_temp.appeler(c_form_a, '1', null, format('select concat_ws('' '', r->>''anonymises'', r->>''comptes_admin_ignores'') from (select public.anonymiser_promo(%s) r) z', v_pf1)),
      'OK 0 1');
    perform pg_temp.attendre('donnees', 'la direction du lieu 2 anonymise la promo de son lieu',
      pg_temp.appeler(c_dir2, '2', null, format('select concat_ws('' '', r->>''anonymises'', r->>''comptes_admin_ignores'') from (select public.anonymiser_promo(%s) r) z', v_pf2)),
      'OK 1 0');

  end if;

  -- 6. Élèves bénévoles d'un centre.
  insert into public.benevoles (prenom, nom, lieu_id, created_at) values ('Preuve6 un', 'BENEVOLE', v_lieu1, now() - interval '400 days') returning id into v_b1;
  insert into public.benevoles (prenom, nom, lieu_id, created_at) values ('Preuve6 deux', 'BENEVOLE', v_lieu1, now() - interval '10 days') returning id into v_b2;
  insert into public.benevoles (prenom, nom, lieu_id, created_at) values ('Preuve6 trois', 'BENEVOLE', v_lieu2, now() - interval '400 days') returning id into v_b3;
  insert into public.benevoles (prenom, nom, lieu_id, created_at) values ('Preuve6 quatre', 'BENEVOLE', v_lieu1, now() - interval '10 days') returning id into v_b4;
  insert into public.benevoles (prenom, nom, lieu_id, created_at) values ('Preuve6 cinq', 'BENEVOLE', v_lieu1, now() - interval '400 days') returning id into v_b5;
  -- b4 est venu il y a longtemps (seul), b2 et b5 sont venus il y a trois jours.
  insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, promo_id, benevoles_ids) values
    (current_date - 500, 0, 'matin', 0, v_pe1, array[v_b4]), (current_date - 3, 0, 'matin', 1, v_pe1, array[v_b2, v_b5]);
  v_ids := array_to_string(array[v_b1, v_b2, v_b3, v_b4, v_b5], ',');
  perform pg_temp.attendre('benevoles', 'la direction du lieu 1 lit les bénévoles à purger de son lieu (jamais venus et anciens, ou venus il y a plus de 12 mois), et eux seuls',
    pg_temp.appeler(c_dir1, '1', null, format('select string_agg(a.id::text, '','' order by a.id) from public.benevoles_a_purger(%s) a where a.id in (%s)', v_lieu1, v_ids)),
    format('OK %s,%s', v_b1, v_b4));
  perform pg_temp.attendre('benevoles', 'la liste ne contient aucun bénévole d''un autre lieu (ni même ceux du lieu 2 qui seraient éligibles)',
    pg_temp.appeler(c_dir1, '1', null, format('select count(*)::text from public.benevoles_a_purger(%s) a where a.id = %s', v_lieu1, v_b3)), 'OK 0');
  perform pg_temp.attendre('benevoles', 'la direction du lieu 1 ne lit pas la liste du lieu 2 (42501, avec la phrase)',
    pg_temp.appeler(c_dir1, '1', null, format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu2)), c_refus_centre);
  perform pg_temp.attendre('benevoles', 'un formateur (sans être direction), le siège, un stagiaire et anon ne lisent pas la liste',
    concat_ws(' / ', left(pg_temp.appeler(c_form_a, '1', null, format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu1)), 12),
      left(pg_temp.appeler(c_siege, null, null, format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu1)), 12),
      left(pg_temp.appeler(c_stag, '1', null, format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu1)), 12),
      left(pg_temp.appeler(null, null, null, format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu1)), 12)),
    'ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501');
  perform pg_temp.attendre('benevoles', 'le fondateur lit la liste d''un lieu quelconque',
    pg_temp.appeler(v_fond, '1', null, format('select string_agg(a.id::text, '','') from public.benevoles_a_purger(%s) a where a.id = %s', v_lieu2, v_b3)), 'OK ' || v_b3);
  perform pg_temp.attendre('benevoles', 'le fondateur en aperçu direction (promo 1 affichée) ne lit ni ne purge le lieu 2',
    concat_ws(' / ', left(pg_temp.appeler(v_fond, '1', 'direction', format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu2)), 12),
      left(pg_temp.appeler(v_fond, '1', 'direction', format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b3, v_lieu2)), 12)),
    'ERREUR 42501 / ERREUR 42501');
  perform pg_temp.attendre('benevoles', 'le fondateur en aperçu direction lit la liste du lieu affiché',
    pg_temp.appeler(v_fond, '1', 'direction', format('select string_agg(a.id::text, '','' order by a.id) from public.benevoles_a_purger(%s) a where a.id in (%s)', v_lieu1, v_ids)),
    format('OK %s,%s', v_b1, v_b4));
  perform pg_temp.attendre('benevoles', 'le fondateur en aperçu siège ou formateur ne lit ni ne purge',
    concat_ws(' / ', left(pg_temp.appeler(v_fond, '1', 'siege', format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu1)), 12),
      left(pg_temp.appeler(v_fond, '1', 'siege', format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b1, v_lieu1)), 12),
      left(pg_temp.appeler(v_fond, '1', 'formateur', format('select count(*)::text from public.benevoles_a_purger(%s)', v_lieu1)), 12)),
    'ERREUR 42501 / ERREUR 42501 / ERREUR 42501');
  -- Purge : refus d'abord.
  v_snap := (select count(*)::text from public.benevoles where id in (v_b1, v_b2, v_b3, v_b4, v_b5));
  perform pg_temp.attendre('benevoles', 'la direction du lieu 1 ne purge pas dans le lieu 2 (42501)',
    pg_temp.appeler(c_dir1, '1', null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b3, v_lieu2)), c_refus_centre);
  perform pg_temp.attendre('benevoles', 'purger un bénévole du lieu 2 en nommant le lieu 1 ne supprime rien (0)',
    pg_temp.appeler(c_dir1, '1', null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b3, v_lieu1)), 'OK 0');
  perform pg_temp.attendre('benevoles', 'un formateur, le siège, un stagiaire et anon ne purgent pas',
    concat_ws(' / ', left(pg_temp.appeler(c_form_a, '1', null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b1, v_lieu1)), 12),
      left(pg_temp.appeler(c_siege, null, null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b1, v_lieu1)), 12),
      left(pg_temp.appeler(c_stag, '1', null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b1, v_lieu1)), 12),
      left(pg_temp.appeler(null, null, null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b1, v_lieu1)), 12)),
    'ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501');
  perform pg_temp.attendre('benevoles', 'aucun de ces refus n''a supprimé quelqu''un (5 bénévoles d''essai toujours là)',
    (select count(*)::text from public.benevoles where id in (v_b1, v_b2, v_b3, v_b4, v_b5)), '5');
  -- Purge réussie : seuls les éligibles du lieu, même si la liste en nomme d'autres.
  perform pg_temp.attendre('benevoles', 'la direction du lieu 1 purge son lieu en nommant aussi des non éligibles et un bénévole d''un autre lieu : 2 supprimés (b1 et b4)',
    pg_temp.appeler(c_dir1, '1', null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_ids, v_lieu1)), 'OK 2');
  perform pg_temp.attendre('benevoles', 'restent b2, b3 et b5 ; b1 et b4 sont partis',
    (select string_agg(id::text, ',' order by id) from public.benevoles where id in (v_b1, v_b2, v_b3, v_b4, v_b5)),
    format('%s,%s,%s', v_b2, v_b3, v_b5));
  perform pg_temp.attendre('benevoles', 'le planning : b4 retiré de la vieille entrée (liste vide), l''entrée récente intacte',
    (select string_agg(pe.benevoles_ids::text, ' ' order by pe.semaine_lundi) from public.planning_entries pe where pe.promo_id = v_pe1),
    format('{} {%s,%s}', v_b2, v_b5));
  perform pg_temp.attendre('benevoles', 'le journal des effacements note le lieu, la direction et le nombre',
    (select format('%s %s %s', count(*), min(j.fait_par_email), min(j.details::text)) from public.effacements_journal j
      where j.type = 'benevoles' and j.cible = 'lieu ' || v_lieu1 and j.fait_par_email = c_dir1),
    format('1 %s {"supprimes": 2}', c_dir1));
  perform pg_temp.attendre('benevoles', 'la direction du lieu 2 purge son bénévole (1), le lieu 1 n''en perd aucun de plus',
    pg_temp.appeler(c_dir2, '2', null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_b3, v_lieu2)), 'OK 1');
  perform pg_temp.attendre('benevoles', 'rejouée, la purge ne supprime plus rien',
    pg_temp.appeler(c_dir1, '1', null, format('select public.purger_benevoles(array[%s]::integer[], %s)::text', v_ids, v_lieu1)), 'OK 0');
  perform pg_temp.attendre('benevoles', 'liste nulle : 0 supprimé, sans erreur',
    pg_temp.appeler(c_dir1, '1', null, format('select public.purger_benevoles(null, %s)::text', v_lieu1)), 'OK 0');

  -- 7. Le retour : les textes d'avant, les fonctions du lot retirées, l'empreinte égale.
  v_retour := pg_temp.jouer('retour 4',
-- @@INJECTER supabase/migrations/20261111_espaces_4_donnees_retour.sql@@
  );
  if v_retour = 'neutralisée' then
    perform pg_temp.informer('retour 4', 'non injecté (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'retour 4 joué sans erreur', v_retour = 'jouée', v_retour);
  end if;
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  if v_en_ligne or v_etat = 'neutralisée' then
    perform pg_temp.informer('retour 4', format('non jugeable (migration non injectée) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après le retour : inviter_compte a le texte exact d''avant la migration 4 (md5 de pg_get_functiondef)',
      md5(pg_get_functiondef('public.inviter_compte(text, text, integer, integer, integer)'::regprocedure)), v_ic_md5);
    perform pg_temp.attendre('retour', 'après le retour : regler_affectations_formateur a le texte exact d''avant la migration 4',
      md5(pg_get_functiondef('public.regler_affectations_formateur(text, integer, integer[], integer)'::regprocedure)), v_rg_md5);
    perform pg_temp.attendre('retour', 'après le retour : plus de _orphelin_en_personnel, ni des quatre signatures avec promo ou lieu',
      (select format('%s %s %s %s %s',
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = '_orphelin_en_personnel'),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'etat_anonymisation_promo' and pronargs = 1),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'anonymiser_promo' and pronargs = 1),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'benevoles_a_purger' and pronargs = 1),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'purger_benevoles' and pronargs = 2))), '0 0 0 0 0');
    perform pg_temp.attendre('retour', 'après le retour : les versions sans argument sont toujours là, intactes (md5)',
      (select string_agg(coalesce(md5(pg_get_functiondef(to_regprocedure(x))), 'absente'), ',' order by x)
         from unnest(array['public.etat_anonymisation_promo()', 'public.anonymiser_promo()',
                           'public.benevoles_a_purger()', 'public.purger_benevoles(integer[])']) x), v_anciennes);
    perform pg_temp.attendre('retour', 'après le retour : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après le retour : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après le retour : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_donnees(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $preuve$;
