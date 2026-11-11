-- Contacts du centre, suite (11/11) : Nîmes et Montpellier partagent le même secrétariat (précision de Timy). Les contacts de
-- Nîmes sont copiés au lieu 2 (Montpellier), dates de création et de modification comprises. Chaque centre garde ensuite sa
-- propre liste : un contact modifié dans l'un ne change pas dans l'autre. Les contacts sont copiés depuis la base, sans
-- qu'aucun nom ni numéro n'apparaisse ici.
-- Garde : la migration 20261113_contacts_centre doit être appliquée ; Montpellier (lieu 2, hors démonstration) ne doit avoir
-- encore aucun contact.
-- Marche arrière : 20261113_contacts_centre_2_montpellier_retour.sql.
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id') then
    raise exception 'contacts_centre_2 : la colonne contacts.lieu_id est absente, appliquer d''abord 20261113_contacts_centre';
  end if;
  if not exists (select 1 from public.lieux where id = 2 and not demonstration) then
    raise exception 'contacts_centre_2 : le lieu 2 (Montpellier) est absent ou marqué comme démonstration';
  end if;
  if exists (select 1 from public.contacts where lieu_id = 2) then
    raise exception 'contacts_centre_2 : Montpellier a déjà des contacts, copie déjà faite ?';
  end if;
end $garde$;

-- Le déclencheur contacts_set_updated ne joue qu'à la modification : l'insertion garde les dates copiées.
insert into public.contacts (prenom, role, phone, email, note, category, sort_order, created_at, updated_at, lieu_id)
select prenom, role, phone, email, note, category, sort_order, created_at, updated_at, 2
  from public.contacts
 where lieu_id = 1
 order by id;
