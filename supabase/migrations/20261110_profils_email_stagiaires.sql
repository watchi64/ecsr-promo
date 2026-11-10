-- Profils des comptes : un stagiaire ne lit plus le profil des autres stagiaires de sa promo, adresse e-mail comprise
-- (10/11/2026, arbitrage délégué par Timy ; constat de la spec de l'espace contact, § 2 et § 11).
--
-- Par où passait la lecture : la règle user_profiles_lecture (lot 4) donnait à tout membre de la promo affichée,
-- stagiaires compris, le profil de chaque stagiaire de la promo (sa dernière clause). Aucune vue ni fonction ne rend
-- l'adresse d'un stagiaire à un autre (inventaire du 10/11 : tables à colonne d'adresse, vues, fonctions exécutables).
-- L'app ne montrait pas ces adresses ; un stagiaire pouvait les lire par les outils du navigateur.
--
-- Ce que l'app demandait vraiment à ces profils : qui a masqué ses notes (anonymous_notes), pour retirer son prénom de
-- la vue Notes des autres stagiaires. Cette information passe désormais par fiches_notes_masquees(), qui ne rend que
-- des numéros de fiche. Ce que voit un stagiaire ne change pas.
--
-- 1. fiches_notes_masquees() : les fiches de la promo affichée dont le compte a masqué ses notes (même portée que la
--    clause retirée : la promo affichée ; même réponse pour l'équipe et pour les stagiaires).
-- 2. user_profiles_lecture : la dernière clause (les profils des stagiaires de la promo affichée) est réservée à
--    l'équipe de cette promo (equipe_courante() : son formateur, la direction de son lieu, le fondateur hors aperçu).
--    Les trois autres clauses sont inchangées : son propre profil, les profils du personnel, les invitations de
--    stagiaires sans fiche (fondateur et auteur de l'invitation).
-- Preuve : tests/sql/profils-email-preuve.sql (outils/assembler_preuve_profils.mjs). Retour :
-- 20261110_profils_email_stagiaires_retour.sql.

set local lock_timeout = '3s';

create function public.fiches_notes_masquees()
returns setof integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select up.stagiaire_id
    from user_profiles up
    join stagiaires s on s.id = up.stagiaire_id
   where up.anonymous_notes
     and s.promo_id = promo_courante();
$$;
revoke all on function public.fiches_notes_masquees() from public, anon;
grant execute on function public.fiches_notes_masquees() to authenticated, service_role;

alter policy user_profiles_lecture on public.user_profiles
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (stagiaire_id is null and role <> 'stagiaire'
        and ((select public.promo_par_defaut()) is not null or (select public.est_siege()) or (select public.est_fondateur())))
    or (stagiaire_id is null and role = 'stagiaire'
        and ((select public.est_fondateur()) or lower(invited_by_email) = lower((select auth.jwt() ->> 'email'))))
    or (stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))
        and (select public.equipe_courante()))
  );
