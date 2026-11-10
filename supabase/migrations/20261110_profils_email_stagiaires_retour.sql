-- Marche arrière de 20261110_profils_email_stagiaires : la règle user_profiles_lecture du lot 4 (20261028_roles_3_regles,
-- empreinte md5 de sa condition d90cf698ac907218e5548b9c71e41666 relevée en ligne le 10/11) et plus de
-- fiches_notes_masquees(). Attention : ce retour rouvre la fuite (chaque stagiaire relit le profil, adresse e-mail
-- comprise, des autres stagiaires de sa promo). L'app reste juste : sans la fonction, elle relit l'anonymat dans les
-- profils, comme avant.

set local lock_timeout = '3s';

alter policy user_profiles_lecture on public.user_profiles
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or (stagiaire_id is null and role <> 'stagiaire'
        and ((select public.promo_par_defaut()) is not null or (select public.est_siege()) or (select public.est_fondateur())))
    or (stagiaire_id is null and role = 'stagiaire'
        and ((select public.est_fondateur()) or lower(invited_by_email) = lower((select auth.jwt() ->> 'email'))))
    or stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante()))
  );
drop function public.fiches_notes_masquees();
