-- Lot 5 (direction et siège), étape 3 : l'habillage par défaut du centre et du réseau.
--   1. lieux.habillage (« ecsr », « ecf » ou nul) et lieux.habillage_libre (vrai : chacun garde le droit de choisir le sien ;
--      faux : l'habillage du centre s'impose à tous ses comptes). Aucune écriture directe : la table lieux n'a, pour
--      authenticated, que le droit de lecture.
--   2. La clé globale « habillage_reseau » est admise dans settings (la contrainte settings_globaux_prevus ne laissait passer,
--      sans promo, que trois clés) : l'habillage par défaut de tout le réseau.
--   3. habillage_par_defaut() : ce que l'app lit au démarrage, pour tout compte connecté. Le centre est celui de la promo
--      affichée, à défaut le premier centre des affectations du compte (identifiant le plus petit) ; sans centre, centre nul
--      et libre vrai. Le réseau est la clé « habillage_reseau », nulle si absente.
--   4. regler_habillage_centre(p_lieu_id, p_habillage, p_libre) : direction de ce centre, ou fondateur. Rend { lieu_id,
--      habillage, libre }.
--   5. regler_habillage_reseau(p_habillage) : siège, ou fondateur. Nul retire la ligne. Rend { habillage }.
-- Une valeur hors « ecsr » et « ecf » est refusée (nul admis : pas d'habillage par défaut). Refus : « habillage: <phrase> »,
-- code 42501 pour un droit manquant.
-- Aucune table nouvelle, aucune règle RLS modifiée, aucune donnée écrite par la migration.
-- Marche arrière : 20261108_espaces_3_habillage_retour.sql. Preuve : tests/sql/espaces-preuve.sql. Jamais appliquée sans
-- l'accord de Timy.
set local lock_timeout = '3s';

-- 1. Les deux colonnes du centre ---------------------------------------------------------------------------------------

alter table public.lieux
  add column habillage text check (habillage is null or habillage in ('ecsr', 'ecf')),
  add column habillage_libre boolean not null default true;

-- 2. La clé globale du réseau --------------------------------------------------------------------------------------------

alter table public.settings drop constraint settings_globaux_prevus;
alter table public.settings add constraint settings_globaux_prevus
  check (promo_id is not null or key in ('chatbot_quota_jour', 'cohort_name', 'password_hash', 'habillage_reseau'));

-- 3. habillage_par_defaut ------------------------------------------------------------------------------------------------

create function public.habillage_par_defaut()
 returns table(centre text, libre boolean, reseau text)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_lieu integer;
begin
  if v_moi is null then
    raise exception 'habillage: Connexion requise.' using errcode = '42501';
  end if;
  v_lieu := lieu_courant();
  if v_lieu is null then
    select min(coalesce(af.lieu_id, lieu_de_promo(af.promo_id))) into v_lieu
      from affectations af where lower(af.email) = v_moi;
  end if;
  return query
    select l.habillage, coalesce(l.habillage_libre, true),
           (select s.value from settings s where s.promo_id is null and s.key = 'habillage_reseau'
               and s.value in ('ecsr', 'ecf'))
      from (select 1) un
      left join lieux l on l.id = v_lieu;
end;
$function$;

revoke all on function public.habillage_par_defaut() from public, anon, service_role;
grant execute on function public.habillage_par_defaut() to authenticated;

-- 4. regler_habillage_centre ---------------------------------------------------------------------------------------------

create function public.regler_habillage_centre(p_lieu_id integer, p_habillage text, p_libre boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.jwt() ->> 'email' is null or not coalesce(est_direction(p_lieu_id), false) then
    raise exception 'habillage: Réservé à la direction du centre.' using errcode = '42501';
  end if;
  if p_habillage is not null and p_habillage not in ('ecsr', 'ecf') then
    raise exception 'habillage: Cet habillage n''existe pas.';
  end if;
  if p_libre is null then
    raise exception 'habillage: Dis si chacun peut choisir le sien.';
  end if;
  update lieux set habillage = p_habillage, habillage_libre = p_libre where id = p_lieu_id;
  if not found then
    raise exception 'habillage: Centre introuvable.';
  end if;
  return jsonb_build_object('lieu_id', p_lieu_id, 'habillage', p_habillage, 'libre', p_libre);
end;
$function$;

revoke all on function public.regler_habillage_centre(integer, text, boolean) from public, anon, service_role;
grant execute on function public.regler_habillage_centre(integer, text, boolean) to authenticated;

-- 5. regler_habillage_reseau ---------------------------------------------------------------------------------------------

create function public.regler_habillage_reseau(p_habillage text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.jwt() ->> 'email' is null or not coalesce(est_siege(), false) then
    raise exception 'habillage: Réservé au siège.' using errcode = '42501';
  end if;
  if p_habillage is not null and p_habillage not in ('ecsr', 'ecf') then
    raise exception 'habillage: Cet habillage n''existe pas.';
  end if;
  if p_habillage is null then
    delete from settings where promo_id is null and key = 'habillage_reseau';
  else
    insert into settings (key, value, promo_id) values ('habillage_reseau', p_habillage, null)
    on conflict (promo_id, key) do update set value = excluded.value, updated_at = now();
  end if;
  return jsonb_build_object('habillage', p_habillage);
end;
$function$;

revoke all on function public.regler_habillage_reseau(text) from public, anon, service_role;
grant execute on function public.regler_habillage_reseau(text) to authenticated;
