-- E-learning, lot 1 : date la version des conditions d'utilisation qu'exige la base pour écrire une trace du travail en
-- autonomie. La migration 20261114_autonomie_1_traces est appliquée FERMÉE (sentinelle '9999-12-31' dans
-- _autonomie_version_conditions : aucune trace) ; celle-ci remplace la sentinelle par la date de publication des conditions qui
-- décrivent la collecte, le jour où elles sont publiées. NON APPLIQUÉE EN PRODUCTION (accord de Timy).
-- Retour : 20261114_autonomie_2_version_retour.sql (remet la sentinelle : tout se referme). Preuve :
-- tests/sql/autonomie-version-preuve.sql (son en-tête dit comment la rejouer).
--
-- Usage (une seule transaction, arrêt à la première erreur) :
--   psql ... -v ON_ERROR_STOP=1 -v version=AAAA-MM-JJ -1 -f supabase/migrations/20261114_autonomie_2_version.sql
--
-- La version est celle que l'app fait accepter (js/legal.js) et qu'enregistre accepter_conditions : une date AAAA-MM-JJ, avec
-- une lettre minuscule éventuelle pour une révision du même jour (« 2026-11-20b »). La lettre est acceptée parce que
-- _autonomie_permis compare la version ENTIÈRE (ordre binaire : 2026-11-20 < 2026-11-20b < 2026-11-21) : exiger
-- « 2026-11-20b » ne laisse écrire que ceux qui ont accepté cette révision ou une plus récente, et reste atteignable.
-- La migration s'arrête, sans rien changer, si :
--   - la migration 1 n'est pas appliquée ;
--   - la variable version manque, ou n'est pas de cette forme, ou n'est pas une vraie date (2026-02-30) ;
--   - la date est après aujourd'hui (heure de Paris) : des conditions pas encore publiées n'ont pu être acceptées (la sentinelle
--     elle-même est refusée par cette règle) ;
--   - la date est après la version publiée des conditions (conditions_version_publiee, depuis 20261114_restes_1_conditions) ;
--   - la version en place n'est pas la sentinelle et la nouvelle lui est antérieure (on ne recule pas ; la même version se
--     rejoue sans effet).
-- Elle remplace la fonction en ne changeant QUE le littéral : la définition en place (pg_get_functiondef) est rejouée avec la
-- nouvelle version à la place de l'ancienne, donc même propriétaire, même volatilité (immutable), même search_path ; les droits
-- sont retirés comme dans la migration 1, puis définition, droits et propriétaire sont comparés à ceux d'avant, littéral excepté.
\if :{?version}
select set_config('autonomie.version', :'version', true) is not null as version_lue;
\else
select set_config('autonomie.version', '', true) is not null as version_absente;
\endif
set local lock_timeout = '3s';

do $version$
declare
  v_nouvelle text := coalesce(current_setting('autonomie.version', true), '');
  v_aujourdhui text := to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD');
  v_actuelle text;
  v_publiee text;
  v_jour date;
  v_ancien text;
  v_neuf text;
  v_def_avant text; v_acl_avant text; v_proprio_avant oid; v_volatilite_avant "char";
  v_def_apres text; v_acl_apres text; v_proprio_apres oid; v_volatilite_apres "char";
begin
  if to_regprocedure('public._autonomie_version_conditions()') is null then
    raise exception 'autonomie_2 : migration 20261114_autonomie_1_traces absente, l''appliquer d''abord';
  end if;
  if v_nouvelle = '' then
    raise exception 'autonomie_2 : variable version absente (psql -v ON_ERROR_STOP=1 -v version=AAAA-MM-JJ -1 -f ...)';
  end if;
  if v_nouvelle !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[a-z]?$' then
    raise exception 'autonomie_2 : version « % » mal formée (attendu AAAA-MM-JJ, avec une lettre minuscule éventuelle : 2026-11-20 ou 2026-11-20b)', v_nouvelle;
  end if;
  begin
    v_jour := left(v_nouvelle, 10)::date;
  exception when others then
    v_jour := null;
  end;
  if v_jour is null or to_char(v_jour, 'YYYY-MM-DD') <> left(v_nouvelle, 10) then
    raise exception 'autonomie_2 : version « % » : « % » n''est pas une date', v_nouvelle, left(v_nouvelle, 10);
  end if;
  if left(v_nouvelle, 10) collate "C" > v_aujourdhui collate "C" then
    raise exception 'autonomie_2 : version « % » datée après aujourd''hui (%), des conditions pas encore publiées', v_nouvelle, v_aujourdhui;
  end if;
  -- Depuis 20261114_restes_1_conditions, la base ne laisse accepter que la version publiée : exiger une version postérieure
  -- fermerait l'autonomie à tout le monde, en silence.
  -- (Appel par EXECUTE : sans restes_1, la fonction n'existe pas, et PL/pgSQL analyserait l'appel même derrière le test.)
  if to_regprocedure('public.conditions_version_publiee()') is not null then
    execute 'select public.conditions_version_publiee()' into v_publiee;
    if v_nouvelle collate "C" > v_publiee collate "C" then
      raise exception 'autonomie_2 : version « % » postérieure à la version publiée des conditions (« % ») : personne ne pourrait l''accepter',
        v_nouvelle, v_publiee;
    end if;
  end if;
  v_actuelle := public._autonomie_version_conditions();
  if v_actuelle <> '9999-12-31' and v_nouvelle collate "C" < v_actuelle collate "C" then
    raise exception 'autonomie_2 : version « % » antérieure à la version en place (« % ») : on ne recule pas', v_nouvelle, v_actuelle;
  end if;

  select pg_get_functiondef(p.oid), coalesce(p.proacl::text, ''), p.proowner, p.provolatile
    into v_def_avant, v_acl_avant, v_proprio_avant, v_volatilite_avant
    from pg_proc p where p.oid = 'public._autonomie_version_conditions()'::regprocedure;
  v_ancien := quote_literal(v_actuelle) || '::text';
  v_neuf := quote_literal(v_nouvelle) || '::text';
  if (length(v_def_avant) - length(replace(v_def_avant, v_ancien, ''))) / length(v_ancien) <> 1 then
    raise exception 'autonomie_2 : la définition en place ne porte pas une seule fois % : fonction modifiée à la main ?', v_ancien;
  end if;

  execute replace(v_def_avant, v_ancien, v_neuf);
  revoke all on function public._autonomie_version_conditions() from public, anon, authenticated, service_role;

  select pg_get_functiondef(p.oid), coalesce(p.proacl::text, ''), p.proowner, p.provolatile
    into v_def_apres, v_acl_apres, v_proprio_apres, v_volatilite_apres
    from pg_proc p where p.oid = 'public._autonomie_version_conditions()'::regprocedure;
  if v_def_apres <> replace(v_def_avant, v_ancien, v_neuf) or v_acl_apres <> v_acl_avant
     or v_proprio_apres <> v_proprio_avant or v_volatilite_apres <> v_volatilite_avant then
    raise exception 'autonomie_2 : la fonction a changé au-delà du littéral (définition, droits, propriétaire ou volatilité)';
  end if;
  if public._autonomie_version_conditions() <> v_nouvelle then
    raise exception 'autonomie_2 : la fonction ne rend pas la version demandée';
  end if;
  raise notice 'autonomie_2 : version exigée des conditions « % » (avant : « % »)', v_nouvelle, v_actuelle;
end $version$;
