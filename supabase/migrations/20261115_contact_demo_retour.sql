-- Marche arrière de 20261115_contact_demo.sql : la fiche « Responsable pédagogique (fictif) » est supprimée (le relais d'« Accueil du
-- centre » se vide avec elle : relais_id est en on delete set null), « pour quoi me joindre » et « quand » des deux autres fiches fictives
-- redeviennent nuls. Le déclencheur d'horodatage est suspendu : updated_at ne bouge pas.
-- Garde : la fiche « Responsable pédagogique (fictif) » existe, une seule, dans le centre de démonstration. Garde d'ordre : à jouer AVANT le
-- retour de la migration 2 (puis celui de la 1b, puis celui de la 1) ; refusée si la migration 1 n'est plus appliquée. Sinon rien ne change.
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'pour_quoi') then
    raise exception 'contact_demo_retour : la migration 1 n''est plus appliquée (contacts.pour_quoi est absente) ; rien n''est changé';
  end if;
  if (select count(*) from public.contacts c join public.lieux l on l.id = c.lieu_id
       where l.demonstration and c.prenom = 'Responsable pédagogique (fictif)' and c.compte_email is null) <> 1
     or (select count(*) from public.contacts c where 'Responsable pédagogique (fictif)' in (c.prenom, c.nom, c.role)) <> 1 then
    raise exception 'contact_demo_retour : la fiche « Responsable pédagogique (fictif) » n''est pas là exactement une fois dans le centre de démonstration ; rien n''est changé';
  end if;
end $garde$;

alter table public.contacts disable trigger contacts_set_updated;

do $donnees$
declare
  v_lieu integer := (select id from public.lieux where demonstration);
begin
  delete from public.contacts where lieu_id = v_lieu and prenom = 'Responsable pédagogique (fictif)' and compte_email is null;
  update public.contacts set pour_quoi = null, quand = null
   where lieu_id = v_lieu and prenom in ('Accueil du centre', 'Secrétariat pédagogique') and compte_email is null;
end $donnees$;

alter table public.contacts enable trigger contacts_set_updated;
