-- Marche arrière de 20261114_autonomie_2_version.sql : remet la sentinelle '9999-12-31' dans _autonomie_version_conditions.
-- Plus aucune trace ne s'écrit ensuite (fermeture dure de _autonomie_permis), quelles que soient les acceptations ; les traces
-- déjà écrites restent, et restent lisibles tant que l'interrupteur de leur promo est allumé. Comme la migration, elle ne
-- change que le littéral (définition en place rejouée, droits retirés comme dans la migration 1, puis comparés). Sans effet si
-- la sentinelle est déjà là. Garde : la migration 1 doit être appliquée.
--   psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/20261114_autonomie_2_version_retour.sql
set local lock_timeout = '3s';

do $retour$
declare
  v_actuelle text;
  v_ancien text;
  v_neuf constant text := quote_literal('9999-12-31') || '::text';
  v_def_avant text; v_acl_avant text; v_proprio_avant oid; v_volatilite_avant "char";
  v_def_apres text; v_acl_apres text; v_proprio_apres oid; v_volatilite_apres "char";
begin
  if to_regprocedure('public._autonomie_version_conditions()') is null then
    raise exception 'autonomie_2 retour : migration 20261114_autonomie_1_traces absente, rien à défaire';
  end if;
  v_actuelle := public._autonomie_version_conditions();
  if v_actuelle = '9999-12-31' then
    raise notice 'autonomie_2 retour : la sentinelle est déjà en place, rien à faire';
    return;
  end if;

  select pg_get_functiondef(p.oid), coalesce(p.proacl::text, ''), p.proowner, p.provolatile
    into v_def_avant, v_acl_avant, v_proprio_avant, v_volatilite_avant
    from pg_proc p where p.oid = 'public._autonomie_version_conditions()'::regprocedure;
  v_ancien := quote_literal(v_actuelle) || '::text';
  if (length(v_def_avant) - length(replace(v_def_avant, v_ancien, ''))) / length(v_ancien) <> 1 then
    raise exception 'autonomie_2 retour : la définition en place ne porte pas une seule fois % : fonction modifiée à la main ?', v_ancien;
  end if;

  execute replace(v_def_avant, v_ancien, v_neuf);
  revoke all on function public._autonomie_version_conditions() from public, anon, authenticated, service_role;

  select pg_get_functiondef(p.oid), coalesce(p.proacl::text, ''), p.proowner, p.provolatile
    into v_def_apres, v_acl_apres, v_proprio_apres, v_volatilite_apres
    from pg_proc p where p.oid = 'public._autonomie_version_conditions()'::regprocedure;
  if v_def_apres <> replace(v_def_avant, v_ancien, v_neuf) or v_acl_apres <> v_acl_avant
     or v_proprio_apres <> v_proprio_avant or v_volatilite_apres <> v_volatilite_avant
     or public._autonomie_version_conditions() <> '9999-12-31' then
    raise exception 'autonomie_2 retour : la fonction a changé au-delà du littéral, ou ne rend pas la sentinelle';
  end if;
  raise notice 'autonomie_2 retour : sentinelle remise (version d''avant : « % »)', v_actuelle;
end $retour$;
