-- Retour de 20261110_navigation_unique_1_reglages.sql : la règle d'écriture de `settings` réserve de nouveau
-- `navigation_v2` au fondateur, comme le 28/10 (20261028_roles_3_regles.sql). Les lignes `navigation_v2` supprimées ne sont
-- pas recréées : l'app de la navigation unique ne les lit plus ; une app d'avant le 11/11 qui en aurait besoin se remet en
-- nouvelle navigation par `insert into public.settings (key, value, promo_id) values ('navigation_v2', 'true', <promo>)`.
set local lock_timeout = '3s';

drop policy if exists settings_ecriture on public.settings;
create policy settings_ecriture on public.settings
  for all to public
  using (
    promo_id = (select public.promo_courante())
    and case
      when key in ('navigation_v2', 'emargement_actif') then (select public.est_fondateur())
      when key = 'modules' then (select public.equipe_courante())
      else (select public.formateur_courant())
    end
  )
  with check (
    promo_id = (select public.promo_courante())
    and case
      when key in ('navigation_v2', 'emargement_actif') then (select public.est_fondateur())
      when key = 'modules' then (select public.equipe_courante())
      else (select public.formateur_courant())
    end
  );
