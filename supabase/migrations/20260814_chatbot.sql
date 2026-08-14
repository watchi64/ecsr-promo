-- Chatbot assistant : sections de cours (FTS francais), quota journalier, RPC.

-- 1. Decoupage d'un cours markdown en sections (titres ## et ###)
create or replace function public.decoupe_markdown(md text)
returns table(section text, contenu text, ordre integer)
language plpgsql immutable as $$
declare
  ligne text;
  h2 text := '';
  h3 text := '';
  buf text := '';
  n integer := 0;
begin
  foreach ligne in array string_to_array(coalesce(md, ''), E'\n') loop
    if ligne like '## %' or ligne like '### %' then
      if length(trim(buf)) > 0 then
        n := n + 1;
        section := case when h2 = '' then h3
                        when h3 = '' then h2
                        else h2 || ' > ' || h3 end;
        contenu := trim(buf);
        ordre := n;
        return next;
      end if;
      buf := '';
      if ligne like '### %' then
        h3 := trim(substr(ligne, 5));
      else
        h2 := trim(substr(ligne, 4));
        h3 := '';
      end if;
    else
      buf := buf || ligne || E'\n';
    end if;
  end loop;
  if length(trim(buf)) > 0 then
    n := n + 1;
    section := case when h2 = '' then h3
                    when h3 = '' then h2
                    else h2 || ' > ' || h3 end;
    contenu := trim(buf);
    ordre := n;
    return next;
  end if;
end $$;

-- 2. Table des sections indexees
create table if not exists public.cours_chunks (
  id bigint generated always as identity primary key,
  cours_id uuid not null references public.cours(id) on delete cascade,
  numero integer not null,
  titre text not null,
  section text not null default '',
  contenu text not null,
  ordre integer not null,
  tsv tsvector generated always as (
    to_tsvector('french', coalesce(section, '') || ' ' || contenu)
  ) stored
);
create index if not exists cours_chunks_tsv_idx on public.cours_chunks using gin (tsv);
create index if not exists cours_chunks_cours_idx on public.cours_chunks (cours_id);

alter table public.cours_chunks enable row level security;
drop policy if exists cours_chunks_select_auth on public.cours_chunks;
create policy cours_chunks_select_auth on public.cours_chunks
  for select to authenticated using (true);
-- pas de policy d'ecriture : seule la service role (bypass RLS) ecrit, via le trigger security definer

-- 3. Redecoupage automatique quand un cours change
create or replace function public.rechunk_cours() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from cours_chunks where cours_id = new.id;
  insert into cours_chunks (cours_id, numero, titre, section, contenu, ordre)
  select new.id, new.numero, new.titre, s.section, s.contenu, s.ordre
  from decoupe_markdown(new.corps_md) as s
  where length(trim(s.contenu)) > 0;
  return new;
end $$;

drop trigger if exists cours_rechunk on public.cours;
create trigger cours_rechunk
  after insert or update of corps_md, titre, numero on public.cours
  for each row execute function public.rechunk_cours();

-- 4. Population initiale
delete from public.cours_chunks;
insert into public.cours_chunks (cours_id, numero, titre, section, contenu, ordre)
select c.id, c.numero, c.titre, s.section, s.contenu, s.ordre
from public.cours c, lateral public.decoupe_markdown(c.corps_md) s
where length(trim(s.contenu)) > 0;

-- 5. Recherche plein-texte avec rang (appelee par l'Edge Function en service role)
-- Pas de filtre sur cours.published : decision utilisateur du 2026-08-14.
-- Le fond des 57 cours est deja controle ; la publication in-app ne gouverne que le lecteur.
create or replace function public.chercher_cours(q text, ntheme integer default null, limite integer default 5)
returns table(numero integer, titre text, section text, contenu text, rang real)
language sql stable security definer set search_path = public as $$
  select ck.numero, ck.titre, ck.section, ck.contenu,
         ts_rank(ck.tsv, websearch_to_tsquery('french', q)) as rang
  from cours_chunks ck
  where ck.tsv @@ websearch_to_tsquery('french', q)
    and (ntheme is null or ck.numero = ntheme)
  order by rang desc
  limit least(coalesce(limite, 5), 8);
$$;
revoke execute on function public.chercher_cours(text, integer, integer) from public, anon;

-- 6. Quota journalier (increment atomique, heure de Paris)
create table if not exists public.chatbot_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour date not null default (now() at time zone 'Europe/Paris')::date,
  nb integer not null default 0,
  primary key (user_id, jour)
);
alter table public.chatbot_usage enable row level security;
drop policy if exists chatbot_usage_select_own on public.chatbot_usage;
create policy chatbot_usage_select_own on public.chatbot_usage
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.chatbot_consommer(uid uuid, limite integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into chatbot_usage (user_id, jour, nb)
  values (uid, (now() at time zone 'Europe/Paris')::date, 1)
  on conflict (user_id, jour) do update
    set nb = chatbot_usage.nb + 1
    where chatbot_usage.nb < limite
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke execute on function public.chatbot_consommer(uuid, integer) from public, anon, authenticated;

-- 7. Reglage du quota (modifiable dans l'app sans redeploiement)
insert into public.settings (key, value)
values ('chatbot_quota_jour', '30')
on conflict (key) do nothing;
