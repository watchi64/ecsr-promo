-- Lot 3 « Couleurs ECF » : mémoire du choix d'habillage sur le compte.
-- NON APPLIQUÉE : attend l'accord du propriétaire du projet. Preuve : tests/sql/habillage-preuve.sql.
-- Retour : 20261109_habillage_retour.sql.
--
-- Le choix est déjà gardé sur l'appareil ; cette colonne le suit d'un appareil à l'autre. Null = pas de
-- choix (l'app prend l'habillage par défaut).

alter table public.user_profiles
  add column if not exists habillage text check (habillage is null or habillage in ('ecsr', 'ecf'));

-- Depuis le lot 4, authenticated n'a plus update sur user_profiles et chacun ne lit que sa ligne :
-- l'écriture passe donc par cette fonction security definer, qui ne touche que la ligne de l'appelant
-- (courriel lu dans le jeton, jamais passé en paramètre). Modèle : set_my_anonymous_notes.
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

  -- Une valeur hors liste est refusée par la contrainte check de la colonne.
  update user_profiles set habillage = val where lower(email) = caller_email;
  if not found then raise exception 'Habillage non enregistré'; end if;
  return val;
end;
$$;

revoke all on function public.set_my_habillage(text) from public, anon;
grant execute on function public.set_my_habillage(text) to authenticated;
