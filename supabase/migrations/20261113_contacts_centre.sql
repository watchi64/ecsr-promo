-- Contacts du centre : chaque contact appartient à un centre (lieu), et chacun ne voit ou n'écrit que ceux du centre de la
-- promo affichée. Avant, la table n'avait pas de centre et sa lecture était ouverte à tout compte connecté : la promo de
-- démonstration et Montpellier voyaient les contacts de Nîmes. Première brique de l'annuaire (spec de l'espace contact du 09/11).
--   1. Colonne lieu_id, obligatoire, par défaut le centre de la promo affichée (lieu_courant(), comme benevoles et auto_ecoles).
--      Les contacts existants sont rattachés au lieu 1 (Nîmes) : relevé du 11/11, trois contacts, tous créés le 19/05/2026,
--      avant le multi-promo (01/10). La colonne naît avec 1 pour défaut (aucune réécriture de la table, aucun déclencheur :
--      updated_at ne bouge pas), puis prend lieu_courant() pour défaut.
--   2. Une règle RESTRICTIVE, contacts_meme_centre : une règle restrictive s'ajoute en « et » à toutes les autres. Lecture et
--      écriture exigent lieu_id = lieu_courant(). Le centre courant n'existe que si la promo affichée est accessible au compte
--      (promo_courante() vérifie peut_acceder_promo) : stagiaire de la promo, son équipe, la direction du centre, le fondateur.
--      Le siège, qui n'affiche aucune promo, ne voit plus aucun contact. Les règles existantes restent telles quelles :
--      contacts_select_authenticated (lecture) et contacts_ecriture (geste fiches_internes.ecrire, chantier des titres),
--      dont la marche arrière ne peut donc pas rouvrir la fuite.
--   3. Le centre de démonstration (lieux.demonstration) reçoit deux contacts manifestement fictifs (numéros 01 99 00,
--      réservés à la fiction, adresses en demo.test).
-- Garde : la colonne ne doit pas exister ; le lieu 1 doit exister et ne pas être de démonstration.
-- Marche arrière : 20261113_contacts_centre_retour.sql.
set local lock_timeout = '3s';

do $garde$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id') then
    raise exception 'contacts_centre : la colonne contacts.lieu_id existe déjà, migration déjà appliquée ?';
  end if;
  if not exists (select 1 from public.lieux where id = 1 and not demonstration) then
    raise exception 'contacts_centre : le lieu 1 (Nîmes) est absent ou marqué comme démonstration';
  end if;
end $garde$;

alter table public.contacts add column lieu_id integer not null default 1 references public.lieux(id);
alter table public.contacts alter column lieu_id set default public.lieu_courant();
create index contacts_lieu_idx on public.contacts (lieu_id);

create policy contacts_meme_centre on public.contacts as restrictive for all to public
  using (lieu_id = (select public.lieu_courant()))
  with check (lieu_id = (select public.lieu_courant()));

insert into public.contacts (prenom, role, phone, email, note, category, sort_order, lieu_id)
select v.prenom, v.role, v.phone, v.email, v.note, 'admin', v.ordre, l.id
  from public.lieux l
 cross join (values
   ('Accueil du centre', 'Absences et retards', '01 99 00 00 01', 'accueil@demo.test', 'Contact fictif du centre de démonstration', 10),
   ('Secrétariat pédagogique', 'Justificatifs et attestations', '01 99 00 00 02', 'secretariat@demo.test', 'Contact fictif du centre de démonstration', 20)
 ) as v(prenom, role, phone, email, note, ordre)
 where l.demonstration;
