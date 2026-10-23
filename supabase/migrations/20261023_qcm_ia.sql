-- Questions QCM proposees par l'IA (chantier du 2026-10-23).
-- Spec : docs/superpowers/specs/2026-10-23-questions-ia-design.md
-- qcm_questions est lisible de tout connecte (entrainement libre) : un brouillon n'y entre
-- donc qu'a l'acceptation par un formateur. D'ici la, il vit dans qcm_ia_brouillons.

-- 1. Brouillons : lecture formateur, aucune ecriture directe cote client (la fonction
--    qcm-ia ecrit en service role, l'acceptation et le rejet passent par les rpc ci-dessous).
create table if not exists public.qcm_ia_brouillons (
  id bigint generated always as identity primary key,
  qcm_id bigint not null references public.qcm(id) on delete cascade,
  cours_id uuid references public.cours(id) on delete set null,
  demande_par_email text not null,
  partie_visee text,
  section text,
  enonce text not null,
  options jsonb not null default '[]'::jsonb,
  explication text,
  partie_cours text,
  statut text not null default 'a_relire'
    check (statut in ('a_relire', 'acceptee', 'rejetee', 'ecartee')),
  motif text,
  traite_par_email text,
  traite_le timestamptz,
  modele text,
  created_at timestamptz not null default now()
);
create index if not exists qcm_ia_brouillons_qcm_idx on public.qcm_ia_brouillons (qcm_id, statut);

alter table public.qcm_ia_brouillons enable row level security;
drop policy if exists qcm_ia_brouillons_select on public.qcm_ia_brouillons;
create policy qcm_ia_brouillons_select on public.qcm_ia_brouillons
  for select to authenticated using (is_admin());

-- 2. Trace sur la question acceptee : « proposee par l'IA, validee par X le JJ/MM ».
--    Le nom est lu en base a l'acceptation, jamais fourni par le navigateur.
alter table public.qcm_questions
  add column if not exists ia_brouillon_id bigint references public.qcm_ia_brouillons(id) on delete set null,
  add column if not exists ia_validee_par text,
  add column if not exists ia_validee_le timestamptz;

-- 3. Quota journalier par formateur (copie du quota de l'assistant, heure de Paris).
create table if not exists public.qcm_ia_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour date not null default (now() at time zone 'Europe/Paris')::date,
  nb integer not null default 0,
  primary key (user_id, jour)
);
alter table public.qcm_ia_usage enable row level security;
drop policy if exists qcm_ia_usage_select_own on public.qcm_ia_usage;
create policy qcm_ia_usage_select_own on public.qcm_ia_usage
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.qcm_ia_consommer(uid uuid, limite integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into qcm_ia_usage (user_id, jour, nb)
  values (uid, (now() at time zone 'Europe/Paris')::date, 1)
  on conflict (user_id, jour) do update
    set nb = qcm_ia_usage.nb + 1
    where qcm_ia_usage.nb < limite
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke execute on function public.qcm_ia_consommer(uuid, integer) from public, anon, authenticated;

-- 4. Accepter un brouillon : la question, ses options et la trace en une transaction.
--    Le contenu est celui que le formateur a relu (il a pu corriger le brouillon).
create or replace function public.accepter_brouillon_ia(
  p_brouillon_id bigint, p_section text, p_enonce text, p_explication text, p_options jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  b qcm_ia_brouillons%rowtype;
  v_qid bigint;
  v_nom text;
  v_nb integer;
  v_bonnes integer;
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if not is_admin() then
    raise exception 'Réservé aux formateurs' using errcode = '42501';
  end if;
  select * into b from qcm_ia_brouillons where id = p_brouillon_id for update;
  if not found then raise exception 'Brouillon introuvable'; end if;
  if b.statut <> 'a_relire' then raise exception 'Ce brouillon a déjà été traité'; end if;
  if coalesce(trim(p_enonce), '') = '' then raise exception 'L''énoncé est requis'; end if;
  if jsonb_typeof(coalesce(p_options, 'null'::jsonb)) <> 'array' then
    raise exception 'Réponses illisibles';
  end if;

  select count(*), count(*) filter (where coalesce((e->>'is_correct')::boolean, false))
    into v_nb, v_bonnes
    from jsonb_array_elements(p_options) e
   where coalesce(trim(e->>'texte'), '') <> '';
  if v_nb < 2 then raise exception 'Ajoute au moins deux réponses'; end if;
  if v_bonnes < 1 then raise exception 'Coche au moins une bonne réponse'; end if;

  select coalesce(p.nom, s.prenom, up.email) into v_nom
    from user_profiles up
    left join profs p on p.id = up.prof_id
    left join stagiaires s on s.id = up.stagiaire_id
   where lower(up.email) = v_email
   limit 1;

  insert into qcm_questions (qcm_id, section, enonce, explication, ordre,
                             ia_brouillon_id, ia_validee_par, ia_validee_le)
  values (b.qcm_id, nullif(trim(p_section), ''), trim(p_enonce), nullif(trim(p_explication), ''),
          (select coalesce(max(ordre) + 1, 0) from qcm_questions where qcm_id = b.qcm_id),
          b.id, coalesce(v_nom, v_email), now())
  returning id into v_qid;

  insert into qcm_options (question_id, texte, is_correct, ordre)
  select v_qid, trim(e.value->>'texte'), coalesce((e.value->>'is_correct')::boolean, false),
         (row_number() over (order by e.n) - 1)::integer
    from jsonb_array_elements(p_options) with ordinality as e(value, n)
   where coalesce(trim(e.value->>'texte'), '') <> '';

  update qcm_ia_brouillons
     set statut = 'acceptee', traite_par_email = v_email, traite_le = now()
   where id = b.id;
  return v_qid;
end $$;
revoke execute on function public.accepter_brouillon_ia(bigint, text, text, text, jsonb) from public, anon;
grant execute on function public.accepter_brouillon_ia(bigint, text, text, text, jsonb) to authenticated;

-- 5. Rejeter un brouillon (il reste au journal).
create or replace function public.rejeter_brouillon_ia(p_brouillon_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Réservé aux formateurs' using errcode = '42501';
  end if;
  update qcm_ia_brouillons
     set statut = 'rejetee', traite_par_email = lower(auth.jwt() ->> 'email'), traite_le = now()
   where id = p_brouillon_id and statut = 'a_relire';
  if not found then raise exception 'Ce brouillon a déjà été traité'; end if;
end $$;
revoke execute on function public.rejeter_brouillon_ia(bigint) from public, anon;
grant execute on function public.rejeter_brouillon_ia(bigint) to authenticated;

-- Pas de ligne de reglage : la contrainte settings_globaux_prevus n'admet un reglage sans
-- promo que pour une liste fermee de cles. Le quota vaut 10 par defaut (fonction qcm-ia) ;
-- une ligne qcm_ia_quota_jour posee plus tard (dans une promo) le remplace.
