-- Confidentialité des notes, étape 1 sur 2 : préparation, sans effet visible.
-- Spec : docs/superpowers/specs/2026-10-04-confidentialite-notes-design.md
--
-- 1. Table privée des dates de naissance (lisible du stagiaire lui-même et du personnel).
--    Pendant la transition, set_date_naissance écrit aux deux endroits : les téléphones
--    qui ont encore l'ancienne version de l'app lisent toujours stagiaires.date_naissance.
-- 2. notes_stagiaires_visibles() : de qui le connecté peut lire les notes (anonymat et
--    réciprocité, comme la page Notes). Utilisée par les règles de l'étape 2.
-- 3. notes_stats_groupe() : les moyennes du groupe calculées par le serveur, anonymes
--    comprises, pour que les stagiaires n'aient plus besoin de lire toutes les notes.

-- 1. Dates de naissance -------------------------------------------------------------------

create table public.stagiaires_prive (
  stagiaire_id integer primary key references public.stagiaires(id) on delete cascade,
  date_naissance date,
  updated_at timestamptz not null default now()
);

alter table public.stagiaires_prive enable row level security;

create policy stagiaires_prive_select on public.stagiaires_prive
  for select to authenticated
  using (
    exists (select 1 from public.stagiaires s
             where s.id = stagiaire_id and s.promo_id = (select public.promo_courante()))
    and ((select public.is_admin()) or (select public.is_prof())
         or stagiaire_id = (select public.my_stagiaire_id()))
  );

-- Aucune écriture directe : tout passe par set_date_naissance.
revoke all on public.stagiaires_prive from anon, public;
revoke insert, update, delete, truncate, references, trigger on public.stagiaires_prive from authenticated;
grant select on public.stagiaires_prive to authenticated;

insert into public.stagiaires_prive (stagiaire_id, date_naissance)
select id, date_naissance from public.stagiaires where date_naissance is not null;

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
  -- Transition : retiré à l'étape 2.
  update stagiaires set date_naissance = p_date where id = p_stagiaire_id;
end;
$function$;

-- 2. De qui le connecté peut lire les notes ----------------------------------------------
-- Personnel (admin, formateur) : tout le monde. Stagiaire : lui-même ; les autres seulement
-- si ni lui ni eux n'ont masqué leurs notes (réciprocité de l'anonymat renforcé).

create or replace function public.notes_stagiaires_visibles()
returns setof integer language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with moi as (
    select coalesce(bool_or(up.anonymous_notes), false) as anonyme
      from user_profiles up
     where lower(up.email) = lower((select auth.jwt() ->> 'email'))
  )
  select s.id
    from stagiaires s, moi
   where s.promo_id = promo_courante()
     and (
       is_admin() or is_prof()
       or s.id = my_stagiaire_id()
       or (not moi.anonyme
           and not exists (select 1 from user_profiles up2
                            where up2.stagiaire_id = s.id and up2.anonymous_notes))
     );
$function$;

revoke all on function public.notes_stagiaires_visibles() from anon, public;
grant execute on function public.notes_stagiaires_visibles() to authenticated;

-- 3. Moyennes du groupe -------------------------------------------------------------------
-- Mêmes définitions que la page Notes (js/notes-stats.js) : une note compte si elle et son
-- barème sont renseignés (barème non nul) ; score sur 20 = note / barème × 20 ; toutes les
-- évaluations de la promo, abandons compris. Aucune donnée nominative en sortie.

create or replace function public.notes_stats_groupe()
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with notes as (
    select e.stagiaire_id, e.type, e.theme_numero, e.competence_code,
           (e.note::numeric / e.note_max::numeric) * 20 as s
      from evaluations e
     where e.promo_id = promo_courante()
       and e.note is not null and e.note_max is not null and e.note_max <> 0
  ),
  -- Moyennes individuelles des stagiaires actifs (comme la liste de la page Notes).
  par_stagiaire as (
    select avg(n.s) as moy from notes n
      join stagiaires st on st.id = n.stagiaire_id and st.actif
     group by n.stagiaire_id
  )
  select jsonb_build_object(
    'n_lignes', (select count(*) from evaluations where promo_id = promo_courante()),
    'n', (select count(*) from notes),
    'somme', (select coalesce(sum(s), 0) from notes),
    'mediane', (select percentile_cont(0.5) within group (order by s) from notes),
    'sous_10', (select count(*) from notes where s < 10),
    'repartition', jsonb_build_array(
      (select count(*) from notes where s >= 0 and s < 4),
      (select count(*) from notes where s >= 4 and s < 8),
      (select count(*) from notes where s >= 8 and s < 12),
      (select count(*) from notes where s >= 12 and s < 16),
      (select count(*) from notes where s >= 16 and s < 20.01)),
    'themes', coalesce((select jsonb_agg(jsonb_build_object(
        'num', theme_numero, 'n', n, 'somme', somme, 'mediane', mediane) order by theme_numero)
      from (select theme_numero, count(*) as n, sum(s) as somme,
                   percentile_cont(0.5) within group (order by s) as mediane
              from notes where type = 'Thème' and theme_numero is not null
             group by theme_numero) t), '[]'::jsonb),
    'competences', coalesce((select jsonb_agg(jsonb_build_object(
        'code', competence_code, 'n', n, 'somme', somme) order by competence_code)
      from (select competence_code, count(*) as n, sum(s) as somme
              from notes where type = 'Compétence' and competence_code is not null
             group by competence_code) c), '[]'::jsonb),
    'moy_stagiaire_max', (select max(moy) from par_stagiaire),
    'moy_stagiaire_min', (select min(moy) from par_stagiaire)
  );
$function$;

revoke all on function public.notes_stats_groupe() from anon, public;
grant execute on function public.notes_stats_groupe() to authenticated;
