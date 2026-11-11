-- Marche arrière de 20261113_contacts_centre.sql : retire les contacts fictifs du centre de démonstration, la règle
-- restrictive contacts_meme_centre, l'index et la colonne lieu_id. La lecture redevient ouverte à tout compte connecté
-- (état d'avant, avec la fuite entre centres). Gardes : la colonne doit exister ; aucun contact ne doit appartenir à un autre
-- centre que Nîmes, hors des deux fictifs de démonstration (sinon le retour le rendrait lisible par tous : le rattacher ou
-- le supprimer d'abord).
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id') then
    raise exception 'contacts_centre retour : la colonne contacts.lieu_id est absente, rien à défaire';
  end if;
  if exists (select 1 from public.contacts c join public.lieux l on l.id = c.lieu_id
              where c.lieu_id <> 1 and not (l.demonstration and c.email in ('accueil@demo.test', 'secretariat@demo.test'))) then
    raise exception 'contacts_centre retour : des contacts appartiennent à un autre centre que Nîmes, le retour les rendrait lisibles par tous';
  end if;
end $garde$;

delete from public.contacts c
 using public.lieux l
 where l.id = c.lieu_id and l.demonstration and c.email in ('accueil@demo.test', 'secretariat@demo.test');
drop policy contacts_meme_centre on public.contacts;
drop index public.contacts_lieu_idx;
alter table public.contacts drop column lieu_id;
