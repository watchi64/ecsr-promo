-- Cours des compétences de conduite, étape 3 : l'assistant ne cite un cours de compétence
-- qu'une fois publié (un cours non publié n'a pas encore été relu par un formateur). Les
-- cours de thème gardent la règle du 14/08 : tous cités. À appliquer avant l'import des
-- cours de compétence.
-- Marche arrière : 20261003_cours_competences_3_assistant_publie_retour.sql

create or replace function public.chercher_cours(q text, ntheme integer default null, limite integer default 5)
returns table(numero integer, code text, titre text, section text, contenu text, rang real)
language sql stable security definer set search_path to 'public'
as $function$
  select ck.numero, ck.code, ck.titre, ck.section, ck.contenu,
         ts_rank(ck.tsv, websearch_to_tsquery('french', q)) as rang
  from cours_chunks ck
  where ck.tsv @@ websearch_to_tsquery('french', q)
    and (ntheme is null or ck.numero = ntheme)
    and (ck.code is null or exists (select 1 from cours c where c.id = ck.cours_id and c.published))
  order by rang desc
  limit least(coalesce(limite, 5), 8);
$function$;
revoke all on function public.chercher_cours(text, integer, integer) from public, anon, authenticated;
grant execute on function public.chercher_cours(text, integer, integer) to service_role;
