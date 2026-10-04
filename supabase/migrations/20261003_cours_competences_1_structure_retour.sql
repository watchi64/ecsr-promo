-- Marche arrière de l'étape 1. À n'appliquer qu'AVANT l'import de cours à code :
-- après, supprimer d'abord ces cours (numero not null échouerait).
--
-- Trois points à connaître avant de la jouer, surtout dans l'urgence :
-- 1. Dès que le code de l'app qui lit cours.code (listCoursIndex, js/db.js) est en ligne, ce retour
--    fait échouer la requête de l'index des cours : les 57 boutons « Cours » disparaissent. Ne le
--    jouer qu'avant la mise en ligne de ce code, ou remettre d'abord en ligne le code précédent de l'app.
-- 2. Après l'import des cours de compétence : supprimer d'abord leurs versions (cours_versions
--    référence cours sans cascade, NO ACTION), puis les cours à code (cours_chunks suit en cascade) :
--      delete from public.cours_versions
--        where cours_id in (select id from public.cours where code is not null);
--      delete from public.cours where code is not null;
-- 3. Les marches arrière se jouent dans l'ordre inverse des étapes : la 3
--    (20261003_cours_competences_3_assistant_publie_retour.sql), puis la 2
--    (20261003_cours_competences_2_liste_retour.sql), puis celle-ci, la 1.
drop function public.chercher_cours(text, integer, integer);
create function public.chercher_cours(q text, ntheme integer default null, limite integer default 5)
returns table(numero integer, titre text, section text, contenu text, rang real)
language sql stable security definer set search_path to 'public'
as $function$
  select ck.numero, ck.titre, ck.section, ck.contenu,
         ts_rank(ck.tsv, websearch_to_tsquery('french', q)) as rang
  from cours_chunks ck
  where ck.tsv @@ websearch_to_tsquery('french', q)
    and (ntheme is null or ck.numero = ntheme)
  order by rang desc
  limit least(coalesce(limite, 5), 8);
$function$;
revoke all on function public.chercher_cours(text, integer, integer) from public, anon, authenticated;
grant execute on function public.chercher_cours(text, integer, integer) to service_role;

drop trigger cours_rechunk on public.cours;
create or replace function public.rechunk_cours()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  delete from cours_chunks where cours_id = new.id;
  insert into cours_chunks (cours_id, numero, titre, section, contenu, ordre)
  select new.id, new.numero, new.titre, s.section, s.contenu, s.ordre
  from decoupe_markdown(new.corps_md) as s
  where length(trim(s.contenu)) > 0;
  return new;
end $function$;
create trigger cours_rechunk after insert or update of corps_md, titre, numero
  on public.cours for each row execute function public.rechunk_cours();

alter table public.cours_chunks alter column numero set not null;
alter table public.cours_chunks drop column code;
alter table public.cours drop constraint cours_numero_ou_code;
alter table public.cours alter column numero set not null;
alter table public.cours drop constraint cours_code_format;
alter table public.cours drop constraint cours_code_key;
alter table public.cours drop column code;
alter table public.themes drop constraint themes_code_key;
alter table public.themes drop column code;
