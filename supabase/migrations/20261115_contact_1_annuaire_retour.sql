-- Marche arrière de 20261115_contact_1_annuaire.sql (espace contact, migration 1, partie A).
--   * Déclencheurs et fonctions de la migration retirés ; contacts_ecriture reprend le texte de 20261112_titres_3_regles.sql ; les
--     droits de authenticated sur contacts redeviennent ceux d'avant (ajout et modification sur toute la table), et ceux d'écriture
--     de anon (ajout, modification, suppression, vidage).
--   * Les fiches avec compte (fiches d'office) sont supprimées. Les copies fusionnées sont refaites : une ligne par centre de
--     lieux_partages, avec le contenu et les dates de la fiche gardée.
--   * Les colonnes ajoutées sont retirées, et ce qu'elles portaient avec elles (nom, « pour quoi », « quand », congé, relais,
--     rattachement à profs, date de départ, vérification) : un avis en donne le nombre de fiches touchées, sans aucun nom.
-- Gardes d'ordre : refusée si la migration 1b est appliquée (la défaire d'abord : 20261115_contact_1b_fermeture_retour.sql), si la
-- migration 2 est là (public.ecrire_au_centre existe) ou si la fiche fictive « Responsable pédagogique (fictif) » de
-- 20261115_contact_demo.sql existe. Garde d'entrée : la migration 1 est appliquée. Sinon rien ne change.
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'compte_email') then
    raise exception 'contact_1_retour : la migration 1 n''est pas appliquée (contacts.compte_email est absente) ; rien n''est changé';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contacts'
                and policyname = 'contacts_select_authenticated' and qual is distinct from 'true') then
    raise exception 'contact_1_retour : la migration 1b est appliquée, la défaire d''abord (20261115_contact_1b_fermeture_retour.sql) ; rien n''est changé';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'ecrire_au_centre') then
    raise exception 'contact_1_retour : la migration 2 est appliquée (ecrire_au_centre existe), la défaire d''abord ; rien n''est changé';
  end if;
  if exists (select 1 from public.contacts c
              where 'Responsable pédagogique (fictif)' in (c.prenom, c.nom, c.role)) then
    raise exception 'contact_1_retour : la fiche fictive de 20261115_contact_demo.sql existe, défaire d''abord cette migration ; rien n''est changé';
  end if;
end $garde$;

drop trigger contacts_avant_ecriture on public.contacts;
drop trigger affectations_fiche_contact on public.affectations;
drop trigger affectations_fiche_orpheline on public.affectations;
drop function public.annuaire_centre();
drop function public._contact_fiche_dans(public.contacts, integer);
drop function public._contact_fiche_d_office();
drop function public._contact_fiche_orpheline();
drop function public._contact_avant_ecriture();

alter policy contacts_ecriture on public.contacts
  using ((select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')))
  with check ((select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')));

-- Révoquer le droit de table retire aussi les droits de colonnes de la migration ; puis le droit de table d'avant.
revoke insert, update on public.contacts from authenticated;
grant insert, update on public.contacts to authenticated;
grant insert, update, delete, truncate on public.contacts to anon;

do $donnees$
declare
  v_office integer;
  v_copies integer;
  v_pertes integer;
begin
  select count(*) into v_pertes from public.contacts c
   where c.compte_email is null
     and (c.nom is not null or c.pour_quoi is not null or c.quand is not null or c.relais_id is not null or c.conge_du is not null
          or c.prof_id is not null or c.depart_le is not null or c.verifiee_le is not null);
  delete from public.contacts c where c.compte_email is not null;
  get diagnostics v_office = row_count;
  -- Aucun déclencheur ne joue à l'ajout (contacts_set_updated ne joue qu'à la modification) : les dates copiées restent.
  insert into public.contacts (prenom, role, phone, email, note, category, sort_order, created_at, updated_at, lieu_id)
  select c.prenom, c.role, c.phone, c.email, c.note, c.category, c.sort_order, c.created_at, c.updated_at, x.l
    from public.contacts c
   cross join lateral unnest(c.lieux_partages) as x(l)
   where c.compte_email is null
   order by c.id, x.l;
  get diagnostics v_copies = row_count;
  raise notice 'contact_1_retour : % fiche(s) d''office supprimée(s), % copie(s) refaite(s), % fiche(s) sans compte perdent des champs nouveaux',
    v_office, v_copies, v_pertes;
end $donnees$;

alter table public.contacts
  drop column compte_email,
  drop column nom,
  drop column pour_quoi,
  drop column quand,
  drop column verifiee_le,
  drop column relais_id,
  drop column conge_du,
  drop column conge_au,
  drop column prof_id,
  drop column lieux_partages,
  drop column depart_le;
alter table public.contacts alter column prenom set not null;
alter table public.contacts alter column lieu_id set not null;
