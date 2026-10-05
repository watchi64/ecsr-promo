-- Marche arrière de l'étape 3 : rétablit la recherche de l'étape 1, qui cite tous les
-- cours, publiés ou non. Sans effet sur les données, valable avant comme après l'import
-- des cours de compétence (après l'import, l'assistant citerait de nouveau des cours de
-- compétence non publiés).

create or replace function public.chercher_cours(q text, ntheme integer default null, limite integer default 5)
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
