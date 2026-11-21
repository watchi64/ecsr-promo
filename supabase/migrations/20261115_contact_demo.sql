-- Espace contact : les fiches fictives du centre de démonstration (lieux.demonstration) se complètent, pour que la page Contacts, « Écrire
-- au centre » et la vidéo de démonstration montrent un annuaire vivant. Données fictives seulement (numéros 01 99 00, adresses en demo.test).
--   * « Accueil du centre » et « Secrétariat pédagogique » reçoivent « pour quoi me joindre » (pour_quoi) et « quand » ;
--   * une troisième fiche, « Responsable pédagogique (fictif) » (responsable@demo.test, 01 99 00 00 03), est ajoutée et devient le relais
--     de « Accueil du centre ».
-- Rien d'autre : ni règle de sécurité, ni réglage, ni fonction (exception écrite aux contraintes du chantier : aucune règle de sécurité
-- touchée, donc pas de contre-épreuve). Le déclencheur d'horodatage est suspendu le temps des écritures : updated_at ne bouge pas.
-- Garde : la migration 1 est appliquée, un seul lieu est de démonstration, ses deux fiches fictives sont là et la troisième n'y est pas.
-- Marche arrière : 20261115_contact_demo_retour.sql.
set local lock_timeout = '3s';

do $garde$
declare
  v_lieu integer;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'pour_quoi') then
    raise exception 'contact_demo : la migration 1 n''est pas appliquée (contacts.pour_quoi est absente) ; rien n''est changé';
  end if;
  if (select count(*) from public.lieux where demonstration) <> 1 then
    raise exception 'contact_demo : il faut exactement un lieu de démonstration ; rien n''est changé';
  end if;
  v_lieu := (select id from public.lieux where demonstration);
  if (select count(*) from public.contacts c
       where c.lieu_id = v_lieu and c.compte_email is null
         and ((c.prenom = 'Accueil du centre' and c.email = 'accueil@demo.test')
           or (c.prenom = 'Secrétariat pédagogique' and c.email = 'secretariat@demo.test'))) <> 2 then
    raise exception 'contact_demo : les deux fiches fictives du centre de démonstration ne sont pas telles que posées par 20261113_contacts_centre ; rien n''est changé';
  end if;
  if exists (select 1 from public.contacts c where 'Responsable pédagogique (fictif)' in (c.prenom, c.nom, c.role)) then
    raise exception 'contact_demo : la fiche « Responsable pédagogique (fictif) » existe déjà, migration déjà appliquée ? ; rien n''est changé';
  end if;
end $garde$;

alter table public.contacts disable trigger contacts_set_updated;

do $donnees$
declare
  v_lieu integer := (select id from public.lieux where demonstration);
  v_resp bigint;
begin
  update public.contacts set pour_quoi = 'Absences et retards', quand = 'Du lundi au vendredi, de 9 h à 12 h'
   where lieu_id = v_lieu and prenom = 'Accueil du centre' and compte_email is null;
  update public.contacts set pour_quoi = 'Justificatifs et attestations', quand = 'Le lundi et le jeudi après-midi'
   where lieu_id = v_lieu and prenom = 'Secrétariat pédagogique' and compte_email is null;
  insert into public.contacts (prenom, role, phone, email, note, category, sort_order, lieu_id, pour_quoi, quand)
    values ('Responsable pédagogique (fictif)', 'Questions sur la formation', '01 99 00 00 03', 'responsable@demo.test',
            'Contact fictif du centre de démonstration', 'admin', 30, v_lieu, 'Organisation de la formation et du planning', 'Le mardi et le vendredi')
    returning id into v_resp;
  update public.contacts set relais_id = v_resp
   where lieu_id = v_lieu and prenom = 'Accueil du centre' and compte_email is null;
end $donnees$;

alter table public.contacts enable trigger contacts_set_updated;
