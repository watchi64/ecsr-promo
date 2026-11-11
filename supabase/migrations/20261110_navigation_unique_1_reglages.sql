-- Navigation unique (10/11/2026) : l'ancienne navigation est retirée de l'app, son interrupteur avec elle.
-- 1. Le réglage `navigation_v2` n'a plus de lecteur : ses lignes partent, et la règle d'écriture de `settings` ne le
--    cite plus (seul `emargement_actif` reste réservé au fondateur).
-- À appliquer APRÈS la mise en ligne de l'app qui ne lit plus ces réglages.
set local lock_timeout = '3s';

delete from public.settings where key = 'navigation_v2';

drop policy if exists settings_ecriture on public.settings;
create policy settings_ecriture on public.settings
  for all to public
  using (
    promo_id = (select public.promo_courante())
    and case
      when key = 'emargement_actif' then (select public.est_fondateur())
      when key = 'modules' then (select public.equipe_courante())
      else (select public.formateur_courant())
    end
  )
  with check (
    promo_id = (select public.promo_courante())
    and case
      when key = 'emargement_actif' then (select public.est_fondateur())
      when key = 'modules' then (select public.equipe_courante())
      else (select public.formateur_courant())
    end
  );
