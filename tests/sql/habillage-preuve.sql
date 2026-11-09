-- Preuve de la mémoire d'habillage sur le compte (migration 20261109_habillage.sql, lot 3).
-- Rejouable : tout se passe dans une transaction que le bloc final annule TOUJOURS en levant une
-- exception, qui porte le verdict (« VERT n/0 » ou « ROUGE » et la liste des échecs). La migration est
-- rejouée par EXECUTE en tête du bloc : la preuve ne dépend pas de son application préalable et
-- l'annulation finale la défait, quoi que fasse l'outil avec les transactions. Si la migration change,
-- recopier son contenu dans le EXECUTE ci-dessous.
-- Personnages choisis par requête (aucun courriel réel écrit ici, dépôt public) : A et B, deux
-- stagiaires avec compte ; « inconnu » est une adresse sans ligne de profil.
--
-- Essai LOCAL (base jetable, PGCLIENTENCODING=UTF8 pour les accents) :
--   createdb habillage_a
--   psql -d habillage_a -f tests/sql/habillage-schema-minimal.sql
--   psql -d habillage_a -f tests/sql/habillage-preuve.sql      -> ERROR: VERT n/0
-- Contre la base réelle, plus tard et seulement après l'accord du propriétaire : envoyer ce fichier
-- seul, en une requête ; l'exception finale annule tout, rien n'est écrit.

begin;
set local lock_timeout = '3s';

create temp table preuve (num serial, libelle text, etat text, detail text) on commit drop;

create function pg_temp.verifier(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into preuve (libelle, etat, detail)
  values (p_libelle, case when coalesce(p_ok, false) then 'ok' else 'échec' end, coalesce(p_detail, ''));
$f$;

create function pg_temp.incarner(p_email text)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then '' else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  if p_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

create function pg_temp.proprio()
returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $f$;

-- Instruction jouée par un personnage. Une réussite est GARDÉE ; un échec est annulé (sous-transaction).
-- Rend « OK <valeur> » ou « REFUS <code> <message> ».
create function pg_temp.essai(p_email text, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  begin
    perform pg_temp.incarner(p_email);
    execute p_sql into v;
    perform pg_temp.proprio();
    return 'OK ' || coalesce(v, '');
  exception when others then
    perform pg_temp.proprio();
    return 'REFUS ' || sqlstate || ' ' || sqlerrm;
  end;
end $f$;

-- Même chose avec un jeton connecté mais SANS courriel.
create function pg_temp.essai_sans_courriel(p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    set local role authenticated;
    execute p_sql into v;
    perform pg_temp.proprio();
    return 'OK ' || coalesce(v, '');
  exception when others then
    perform pg_temp.proprio();
    return 'REFUS ' || sqlstate || ' ' || sqlerrm;
  end;
end $f$;

do $preuve$
declare
  a text; b text; r text;
  inconnu constant text := 'inconnu.habillage@exemple.invalid';
  v_ok int; v_ko int; v_liste text;
begin
  -- 0. La migration, rejouée (contenu de 20261109_habillage.sql).
  execute $m$
    alter table public.user_profiles
      add column if not exists habillage text check (habillage is null or habillage in ('ecsr', 'ecf'));

    create or replace function public.set_my_habillage(val text) returns text
        language plpgsql security definer
        set search_path to 'public', 'pg_temp'
        as $$
    declare
      caller_email text;
    begin
      caller_email := lower(auth.jwt() ->> 'email');
      if caller_email is null then
        raise exception 'Not authenticated';
      end if;

      if not exists (select 1 from user_profiles where lower(email) = caller_email) then
        raise exception 'Profil introuvable';
      end if;

      update user_profiles set habillage = val where lower(email) = caller_email;
      if not found then raise exception 'Habillage non enregistré'; end if;
      return val;
    end;
    $$;

    revoke all on function public.set_my_habillage(text) from public, anon;
    grant execute on function public.set_my_habillage(text) to authenticated;
  $m$;

  -- Garde : sans la migration (colonne ou fonction absentes), le verdict est rouge d'emblée.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'habillage')
     or to_regprocedure('public.set_my_habillage(text)') is null then
    raise exception using message = 'ROUGE : migration absente (colonne habillage ou fonction set_my_habillage introuvables)';
  end if;

  -- Personnages.
  select up.email into a from user_profiles up where up.role = 'stagiaire' and not coalesce(up.is_admin, false) order by up.email limit 1;
  select up.email into b from user_profiles up where up.role = 'stagiaire' and not coalesce(up.is_admin, false) and up.email <> a order by up.email limit 1;
  perform pg_temp.verifier('personnages trouvés (A, B)', a is not null and b is not null);
  if a is null or b is null then
    raise exception using message = 'REPORTÉ : il faut deux stagiaires avec compte';
  end if;
  perform pg_temp.verifier('colonne habillage présente',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'habillage'));
  perform pg_temp.verifier('départ : A et B n''ont aucun choix enregistré',
    (select habillage from user_profiles where email = a) is null and (select habillage from user_profiles where email = b) is null);

  -- 1. Droits : exécutable par authenticated seulement ; update direct toujours impossible.
  perform pg_temp.verifier('anon n''a pas le droit d''exécuter la fonction',
    not has_function_privilege('anon', 'public.set_my_habillage(text)', 'EXECUTE'));
  perform pg_temp.verifier('authenticated a le droit d''exécuter la fonction',
    has_function_privilege('authenticated', 'public.set_my_habillage(text)', 'EXECUTE'));
  r := pg_temp.essai(a, format('update public.user_profiles set habillage = %L where email = %L returning habillage', 'ecf', a));
  perform pg_temp.verifier('update direct de la colonne refusé à un stagiaire', r like 'REFUS 42501%', r);

  -- 2. A choisit ecf : la fonction rend la valeur, la ligne de A seule change.
  r := pg_temp.essai(a, $q$select public.set_my_habillage('ecf')$q$);
  perform pg_temp.verifier('A choisit ecf : la fonction rend ecf', r = 'OK ecf', r);
  perform pg_temp.verifier('A choisit ecf : la ligne de A porte ecf',
    (select habillage from user_profiles where email = a) = 'ecf');
  perform pg_temp.verifier('A choisit ecf : la ligne de B est intacte',
    (select habillage from user_profiles where email = b) is null);
  perform pg_temp.verifier('A choisit ecf : aucune autre ligne ne change',
    (select count(*) from user_profiles where habillage is not null) = 1);

  -- 3. Un stagiaire relit sa colonne par la lecture de son profil (RLS).
  r := pg_temp.essai(a, format('select habillage from public.user_profiles where email = %L', a));
  perform pg_temp.verifier('A relit sa colonne par la lecture de son profil', r = 'OK ecf', r);
  -- Qui lit la ligne d'un autre ne dépend pas de cette migration : c'est la règle de lecture du lot 4
  -- (user_profiles_lecture), qui laisse un stagiaire lire les profils de sa promo en cours. La colonne
  -- habillage suit cette règle telle quelle ; la preuve ne la teste donc pas (elle échouerait sur la base
  -- réelle, où A et B sont de la même promo, alors que le schéma minimal ne garde que la branche « ma ligne »).

  -- 4. B choisit ecsr : A reste sur ecf.
  r := pg_temp.essai(b, $q$select public.set_my_habillage('ecsr')$q$);
  perform pg_temp.verifier('B choisit ecsr', r = 'OK ecsr', r);
  perform pg_temp.verifier('B choisit ecsr : A reste sur ecf',
    (select habillage from user_profiles where email = a) = 'ecf'
    and (select habillage from user_profiles where email = b) = 'ecsr');

  -- 5. null remet à zéro (la fonction rend null).
  r := pg_temp.essai(a, $q$select public.set_my_habillage(null)$q$);
  perform pg_temp.verifier('null : la fonction réussit et rend null', r = 'OK ', r);
  perform pg_temp.verifier('null : la ligne de A est remise à zéro, celle de B reste',
    (select habillage from user_profiles where email = a) is null
    and (select habillage from user_profiles where email = b) = 'ecsr');

  -- 6. Valeur hors liste.
  r := pg_temp.essai(a, $q$select public.set_my_habillage('violet')$q$);
  perform pg_temp.verifier('violet refusé par la contrainte', r like 'REFUS 23514%', r);
  perform pg_temp.verifier('violet : la ligne de A n''a pas bougé', (select habillage from user_profiles where email = a) is null);

  -- 7. Sans identité, sans courriel, sans profil.
  r := pg_temp.essai(null, $q$select public.set_my_habillage('ecf')$q$);
  perform pg_temp.verifier('anon refusé', r like 'REFUS 42501%', r);
  r := pg_temp.essai_sans_courriel($q$select public.set_my_habillage('ecf')$q$);
  perform pg_temp.verifier('jeton sans courriel refusé (Not authenticated)', r like 'REFUS P0001%Not authenticated%', r);
  r := pg_temp.essai(inconnu, $q$select public.set_my_habillage('ecf')$q$);
  perform pg_temp.verifier('courriel sans ligne de profil : Profil introuvable', r like 'REFUS P0001%Profil introuvable%', r);

  -- Verdict.
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat <> 'ok'),
         string_agg(case when etat <> 'ok' then num || '. ' || libelle || ' [' || detail || ']' end, ' | ' order by num)
    into v_ok, v_ko, v_liste from preuve;
  if v_ko = 0 then
    raise exception using message = format('VERT %s/0', v_ok);
  end if;
  raise exception using message = format('ROUGE %s ok, %s échecs : %s', v_ok, v_ko, v_liste);
end $preuve$;
