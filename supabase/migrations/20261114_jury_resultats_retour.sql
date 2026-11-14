-- Marche arrière de 20261114_jury_resultats.sql : la table des résultats du jury disparaît, avec ses lignes, ses règles et son
-- déclencheur. Les résultats saisis sont PERDUS : relever la table avant (copie en CSV) si elle contient des lignes réelles.
-- Garde : la table doit exister.
set local lock_timeout = '3s';

do $garde$
begin
  if to_regclass('public.jury_resultats') is null then
    raise exception 'jury_resultats_retour : la table est absente, rien à défaire';
  end if;
end $garde$;

drop table public.jury_resultats;
