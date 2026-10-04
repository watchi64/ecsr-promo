-- Confidentialité des notes, étape 2 sur 2 : fermeture des lectures.
-- À appliquer APRÈS la mise en ligne de l'app qui lit stagiaires_prive et notes_stats_groupe().
-- Spec : docs/superpowers/specs/2026-10-04-confidentialite-notes-design.md
--
-- Avant : tout connecté de la promo lisait toutes les notes (profils anonymes compris), leur
-- historique, les fiches de suivi et les dates de naissance de chacun.
-- Après : un stagiaire lit ses notes et celles des stagiaires non anonymes (s'il ne l'est pas
-- lui-même), sa fiche de suivi et sa date de naissance ; le personnel garde tout.

-- Notes
drop policy if exists evaluations_select_all on public.evaluations;
create policy evaluations_select on public.evaluations
  for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.is_admin()) or (select public.is_prof())
         or stagiaire_id in (select public.notes_stagiaires_visibles()))
  );

-- Historique des notes : visible quand la note l'est (la sous-requête passe par la règle
-- ci-dessus) ; l'historique d'une note supprimée reste au personnel.
drop policy if exists evaluations_audit_select on public.evaluations_audit;
create policy evaluations_audit_select on public.evaluations_audit
  for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.is_admin()) or (select public.is_prof())
         or evaluation_id in (select e.id from public.evaluations e))
  );

-- Fiches de suivi (souhaits, besoins)
drop policy if exists fiches_suivi_select on public.fiches_suivi;
create policy fiches_suivi_select on public.fiches_suivi
  for select to authenticated
  using (
    promo_id = (select public.promo_courante())
    and ((select public.is_admin()) or (select public.is_prof())
         or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- Dates de naissance : l'ancienne colonne est vidée (copie faite à l'étape 1, rattrapée
-- ici pour toute date saisie entre-temps), set_date_naissance n'écrit plus que la table privée.
insert into public.stagiaires_prive (stagiaire_id, date_naissance)
select id, date_naissance from public.stagiaires where date_naissance is not null
on conflict (stagiaire_id) do update set date_naissance = excluded.date_naissance, updated_at = now();

update public.stagiaires set date_naissance = null where date_naissance is not null;

create or replace function public.set_date_naissance(p_stagiaire_id integer, p_date date)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Non autorise : ce stagiaire n''appartient pas a la promo affichee';
  end if;
  if not (is_admin() or is_prof() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  insert into stagiaires_prive (stagiaire_id, date_naissance, updated_at)
  values (p_stagiaire_id, p_date, now())
  on conflict (stagiaire_id) do update set date_naissance = excluded.date_naissance, updated_at = now();
end;
$function$;

-- Garde-fou : plus rien ne doit réécrire l'ancienne colonne (ménage : la supprimer plus tard).
alter table public.stagiaires add constraint stagiaires_date_naissance_videe
  check (date_naissance is null);
