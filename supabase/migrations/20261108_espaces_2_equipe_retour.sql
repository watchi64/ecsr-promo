-- Marche arrière de 20261108_espaces_2_equipe.sql (lot 5, étape 2) : remet inviter_compte telle que le lot 4 l'a posée
-- (texte repris à l'identique de 20261028_roles_2_fonctions.sql, source de ce que la production exécute), puis retire
-- roles_du_personnel, regler_affectations_formateur et _profil_formateur. Les droits d'exécution d'inviter_compte ne bougent pas
-- (create or replace les garde). Après ce retour, pg_get_functiondef('inviter_compte') redonne le texte d'avant. Le texte
-- est joué par un bloc do qui lui rend les retours chariot de la définition qu'il remplace, si elle en avait (fichier posé
-- depuis Windows) : le texte rendu est alors celui d'origine, octet pour octet.
set local lock_timeout = '3s';

do $retour$
declare
  v_texte text := $texte$
CREATE OR REPLACE FUNCTION public.inviter_compte(p_email text, p_role text, p_stagiaire_id integer DEFAULT NULL::integer, p_prof_id integer DEFAULT NULL::integer, p_lieu_id integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_role text := case when p_role = 'prof' then 'formateur' else p_role end;
  v_promo integer;
  v_promo_fiche integer;
  v_anonymise timestamptz;
  v_prof integer;
  v_n bigint;
  v_aff bigint := 0;
begin
  if v_moi is null then
    raise exception 'invitation: Connexion requise.' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('stagiaire', 'formateur', 'direction', 'siege') then
    raise exception 'invitation: Rôle inconnu.';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'invitation: Adresse e-mail invalide.';
  end if;

  if v_role = 'stagiaire' then
    -- Formateur ou direction de la promo de la fiche.
    select s.promo_id, s.anonymise_le into v_promo_fiche, v_anonymise from stagiaires s where s.id = p_stagiaire_id;
    if v_promo_fiche is null or not (est_formateur(v_promo_fiche) or est_direction(lieu_de_promo(v_promo_fiche))) then
      raise exception 'invitation: Pas de droit sur la promo de ce stagiaire.' using errcode = '42501';
    end if;
    if v_anonymise is not null then
      raise exception 'invitation: Cette fiche est anonymisée.';
    end if;
    -- Une fiche n'a qu'un compte : celui qui tiendrait une seconde adresse signerait et écrirait comme le stagiaire.
    if exists (select 1 from user_profiles u where u.stagiaire_id = p_stagiaire_id and lower(u.email) <> v_email) then
      raise exception 'invitation: Cette fiche est déjà reliée à un autre compte.';
    end if;
    insert into user_profiles (email, role, is_admin, stagiaire_id, invited_by_email)
    values (v_email, 'stagiaire', false, p_stagiaire_id, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;

  elsif v_role = 'formateur' then
    -- Direction du centre de la promo affichée, ou fondateur : l'affectation porte sur la promo affichée.
    v_promo := promo_courante();
    if v_promo is null or not est_direction(lieu_de_promo(v_promo)) then
      raise exception 'invitation: Réservé à la direction du centre.' using errcode = '42501';
    end if;
    -- La fiche formateur n'est posée que si elle existe et n'est reliée à aucun compte.
    select pf.id into v_prof from profs pf
     where pf.id = p_prof_id and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
    insert into user_profiles (email, role, is_admin, prof_id, invited_by_email)
    values (v_email, 'prof', true, v_prof, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, promo_id)
    values (v_email, 'formateur', v_promo)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  elsif v_role = 'direction' then
    -- Siège ou fondateur ; le centre est donné.
    if not est_siege() then
      raise exception 'invitation: Réservé au siège.' using errcode = '42501';
    end if;
    if p_lieu_id is null or not exists (select 1 from lieux l where l.id = p_lieu_id) then
      raise exception 'invitation: Le centre est requis.';
    end if;
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, lieu_id)
    values (v_email, 'direction', p_lieu_id)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  else
    -- Siège : le fondateur seul.
    if not est_fondateur() then
      raise exception 'invitation: Réservé au fondateur.' using errcode = '42501';
    end if;
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role)
    values (v_email, 'siege')
    on conflict do nothing;
    get diagnostics v_aff = row_count;
  end if;

  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff);
end;
$function$;
$texte$;
begin
  if position(E'\r' in pg_get_functiondef('public.inviter_compte(text, text, integer, integer, integer)'::regprocedure)) > 0 then
    v_texte := replace(v_texte, E'\n', E'\r\n');
  end if;
  execute v_texte;
end
$retour$;

drop function if exists public.roles_du_personnel();
drop function if exists public.regler_affectations_formateur(text, integer, integer[], integer);
drop function if exists public._profil_formateur(text, integer, text);
