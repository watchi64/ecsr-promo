-- Lot 5, étape 2 : la direction règle les promos de ses formateurs.
--   1. _profil_formateur : la création du profil formateur, sortie d'inviter_compte (fonction interne, aucun droit
--      d'exécution), pour qu'une seule règle la porte quel que soit le chemin ;
--   2. inviter_compte : redéfinie à partir de sa définition en base au moment de l'exécution (pg_get_functiondef), seules
--      différences : l'appel à _profil_formateur à la place de la création de profil, et le refus d'une adresse de compte
--      stagiaire (le lot 4 ne le faisait pas). Si le fragment attendu n'est pas trouvé exactement une fois, la migration
--      s'arrête sans rien changer : jamais une copie périmée par-dessus une définition qui aurait bougé ;
--   3. regler_affectations_formateur : donne à un compte exactement les promos choisies du centre, en une transaction.
-- Marche arrière : 20261108_espaces_2_equipe_retour.sql (remet la définition du lot 4, gardée dans le retour).
-- Aucune table, aucune règle RLS touchée. Jamais appliquée sans l'accord de Timy.
set local lock_timeout = '3s';

-- 1. _profil_formateur ---------------------------------------------------------------------------------------------

-- Crée le profil d'un formateur invité s'il n'existe pas (role 'prof', is_admin vrai, invité par p_par) ; la fiche formateur
-- p_prof_id n'est posée que si elle existe et n'est reliée à aucun compte. Un profil existant n'est jamais modifié. Rend
-- vrai si le profil vient d'être créé. Interne : appelée par inviter_compte et regler_affectations_formateur seulement.
create function public._profil_formateur(p_email text, p_prof_id integer, p_par text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_prof integer;
  v_n bigint;
begin
  -- La fiche formateur n'est posée que si elle existe et n'est reliée à aucun compte.
  select pf.id into v_prof from profs pf
   where pf.id = p_prof_id and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
  insert into user_profiles (email, role, is_admin, prof_id, invited_by_email)
  values (p_email, 'prof', true, v_prof, p_par)
  on conflict (email) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$function$;

revoke all on function public._profil_formateur(text, integer, text) from public, anon, authenticated, service_role;

-- 2. inviter_compte : appel à _profil_formateur et refus d'une adresse de compte stagiaire --------------------------

do $migration$
declare
  v_def text;
  v_ancien text := $ancien$
    -- La fiche formateur n'est posée que si elle existe et n'est reliée à aucun compte.
    select pf.id into v_prof from profs pf
     where pf.id = p_prof_id and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
    insert into user_profiles (email, role, is_admin, prof_id, invited_by_email)
    values (v_email, 'prof', true, v_prof, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
$ancien$;
  v_nouveau text := $nouveau$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté comme formateur.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le profil (et sa fiche formateur, si elle est libre) est créé par la fonction interne, commune avec
    -- regler_affectations_formateur.
    v_n := case when _profil_formateur(v_email, p_prof_id, v_moi) then 1 else 0 end;
$nouveau$;
  n integer;
begin
  v_def := pg_get_functiondef('public.inviter_compte(text, text, integer, integer, integer)'::regprocedure);
  -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : les fragments suivent.
  if position(E'\r' in v_def) > 0 then
    v_ancien := replace(v_ancien, E'\n', E'\r\n');
    v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
  end if;
  n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
  if n <> 1 then
    raise exception 'espaces_2_equipe : le fragment de création de profil attendu dans inviter_compte est présent % fois (une seule attendue) ; rien n''est changé', n;
  end if;
  execute replace(v_def, v_ancien, v_nouveau);
end
$migration$;

-- 3. regler_affectations_formateur ----------------------------------------------------------------------------------

-- Donne au compte p_email exactement les promos p_promo_ids du centre p_lieu_id comme formateur : retire ses lignes
-- formateur de ce centre hors liste, ajoute les manquantes, ne touche à rien d'autre (autres centres, lignes direction
-- et siège). Le profil est créé s'il manque (p_prof_id : fiche formateur à relier, si libre). Rend { email, cree,
-- ajoutees, retirees } (tableaux d'identifiants de promo). Direction du centre, ou fondateur.
create function public.regler_affectations_formateur(p_email text, p_lieu_id integer, p_promo_ids integer[],
                                                     p_prof_id integer default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_liste integer[];
  v_cible text;
  v_cree boolean := false;
  v_ajoutees integer[];
  v_retirees integer[];
begin
  if v_moi is null or not coalesce(est_direction(p_lieu_id), false) then
    raise exception 'equipe: Réservé à la direction du centre.' using errcode = '42501';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'equipe: Adresse e-mail invalide.';
  end if;
  if not exists (select 1 from lieux l where l.id = p_lieu_id) then
    raise exception 'equipe: Centre introuvable.';
  end if;
  -- La liste choisie, sans doublon ni valeur nulle.
  select coalesce(array_agg(distinct x order by x), '{}') into v_liste
    from unnest(coalesce(p_promo_ids, '{}')) x where x is not null;
  if exists (select 1 from unnest(v_liste) x where not exists (select 1 from promos p where p.id = x and p.lieu_id = p_lieu_id)) then
    raise exception 'equipe: Une promo choisie n''est pas dans ce centre.';
  end if;
  -- Un compte qui a une fiche de stagiaire n'est jamais affecté.
  if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
    raise exception 'equipe: Cette adresse est celle d''un compte stagiaire.';
  end if;
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
  if v_cible is null then
    if cardinality(v_liste) = 0 then
      raise exception 'equipe: Choisis au moins une promo.';
    end if;
    v_cree := _profil_formateur(v_email, p_prof_id, v_moi);
    v_cible := v_email;
  end if;
  with retire as (
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'formateur'
       and a.promo_id in (select p.id from promos p where p.lieu_id = p_lieu_id)
       and not (a.promo_id = any (v_liste))
    returning a.promo_id)
  select coalesce(array_agg(r.promo_id order by r.promo_id), '{}') into v_retirees from retire r;
  with ajoute as (
    insert into affectations (email, role, promo_id)
    select v_cible, 'formateur', x from unnest(v_liste) x
    on conflict do nothing
    returning promo_id)
  select coalesce(array_agg(a.promo_id order by a.promo_id), '{}') into v_ajoutees from ajoute a;
  return jsonb_build_object('email', v_cible, 'cree', v_cree, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
end;
$function$;

revoke all on function public.regler_affectations_formateur(text, integer, integer[], integer) from public, anon, service_role;
grant execute on function public.regler_affectations_formateur(text, integer, integer[], integer) to authenticated;
