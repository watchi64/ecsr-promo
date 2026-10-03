-- Cours des compétences de conduite, étape 1 : structure (spec ECSR
-- docs/superpowers/specs/2026-10-03-cours-competences-remc-design.md, section 3).
-- Additive pour l'app en ligne : aucune donnée modifiée, les 57 cours gardent leur numéro.
-- Marche arrière : 20261003_cours_competences_1_structure_retour.sql

-- 1. Référentiel : un code pour les compétences de conduite (C1 à C4.9).
alter table public.themes add column code text;
alter table public.themes add constraint themes_code_key unique (code);

-- 2. Cours : un numéro (les 57 thèmes) ou un code (les compétences), jamais les deux.
alter table public.cours add column code text;
alter table public.cours add constraint cours_code_key unique (code);
alter table public.cours add constraint cours_code_format
  check (code is null or code ~ '^C[1-4](\.[1-9])?$');
alter table public.cours alter column numero drop not null;
alter table public.cours add constraint cours_numero_ou_code
  check ((numero is null) <> (code is null));

-- 3. Index de l'assistant : le code suit le cours.
alter table public.cours_chunks add column code text;
alter table public.cours_chunks alter column numero drop not null;

create or replace function public.rechunk_cours()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  delete from cours_chunks where cours_id = new.id;
  insert into cours_chunks (cours_id, numero, code, titre, section, contenu, ordre)
  select new.id, new.numero, new.code, new.titre, s.section, s.contenu, s.ordre
  from decoupe_markdown(new.corps_md) as s
  where length(trim(s.contenu)) > 0;
  return new;
end $function$;

drop trigger cours_rechunk on public.cours;
create trigger cours_rechunk after insert or update of corps_md, titre, numero, code
  on public.cours for each row execute function public.rechunk_cours();

-- 4. Recherche de l'assistant : renvoie aussi le code. Le type de retour change,
-- d'où la suppression puis la recréation ; droits rejoués à l'identique
-- (relevé du 03/10 : EXECUTE pour postgres et service_role seulement).
drop function public.chercher_cours(text, integer, integer);
create function public.chercher_cours(q text, ntheme integer default null, limite integer default 5)
returns table(numero integer, code text, titre text, section text, contenu text, rang real)
language sql stable security definer set search_path to 'public'
as $function$
  select ck.numero, ck.code, ck.titre, ck.section, ck.contenu,
         ts_rank(ck.tsv, websearch_to_tsquery('french', q)) as rang
  from cours_chunks ck
  where ck.tsv @@ websearch_to_tsquery('french', q)
    and (ntheme is null or ck.numero = ntheme)
  order by rang desc
  limit least(coalesce(limite, 5), 8);
$function$;
revoke all on function public.chercher_cours(text, integer, integer) from public, anon, authenticated;
grant execute on function public.chercher_cours(text, integer, integer) to service_role;
