-- Multi-promo : un compte stagiaire dont la fiche a été supprimée (stagiaire_id remis à nul
-- par la clé étrangère, ON DELETE SET NULL) n'est plus lu comme un compte du personnel : il
-- n'est plus visible des stagiaires des autres promos, seulement des admins (qui le nettoient).
-- Les règles d'écriture de user_profiles ne changent pas.
-- Marche arrière : 20261003_multi_promo_compte_orphelin_retour.sql
set local lock_timeout = '3s';

drop policy if exists user_profiles_select_authenticated on public.user_profiles;
create policy user_profiles_select_authenticated on public.user_profiles for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (stagiaire_id is null and (role <> 'stagiaire' or (select is_admin())))
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select promo_courante()))
  );
