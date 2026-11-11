-- Marche arrière de 20261113_contacts_centre_2_montpellier.sql : retire de Montpellier (lieu 2) les copies des contacts de
-- Nîmes, reconnues à leurs champs identiques (prénom, rôle, téléphone, e-mail, note, catégorie, ordre). Un contact ajouté
-- ou modifié depuis à Montpellier reste. Garde : la colonne lieu_id doit exister.
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id') then
    raise exception 'contacts_centre_2 retour : la colonne contacts.lieu_id est absente, rien à défaire';
  end if;
end $garde$;

delete from public.contacts m
 where m.lieu_id = 2
   and exists (select 1 from public.contacts n
                where n.lieu_id = 1 and n.prenom = m.prenom and n.role is not distinct from m.role
                  and n.phone is not distinct from m.phone and n.email is not distinct from m.email
                  and n.note is not distinct from m.note and n.category is not distinct from m.category
                  and n.sort_order is not distinct from m.sort_order);
