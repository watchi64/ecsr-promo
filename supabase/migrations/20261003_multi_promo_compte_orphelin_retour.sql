-- Marche arrière du correctif « compte orphelin » : règle de lecture de user_profiles telle
-- que posée à l'étape 2 (une ligne à stagiaire_id nul y est lisible par tout connecté).
set local lock_timeout = '3s';

drop policy if exists user_profiles_select_authenticated on public.user_profiles;
create policy user_profiles_select_authenticated on public.user_profiles for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or stagiaire_id is null
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))
  );
