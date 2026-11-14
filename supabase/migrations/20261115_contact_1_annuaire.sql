-- Espace contact, migration 1 (parties A et B) : l'annuaire du centre, une fiche par personne ; coordonnées, financements, délégué.
-- Spec : docs/superpowers/specs/2026-11-09-espace-contact-design.md ; plan : docs/superpowers/plans/2026-11-14-espace-contact.md
-- (tâches 2 et 3, choix C-1 à C-6, décisions de Timy du 14/11).
--   1. contacts s'étend. Une fiche SANS compte (secrétariat, accueil...) garde son centre d'attache (lieu_id) et peut être partagée
--      avec d'autres centres (lieux_partages). Une fiche AVEC compte (compte_email, en minuscules) appartient à une personne de
--      l'équipe : lieu_id nul, elle s'affiche dans chaque centre où la personne a une affectation de formateur ou de direction.
--      Colonnes nouvelles : nom, pour_quoi et quand (80 caractères au plus), verifiee_le, relais_id (une autre fiche), congé (du, au),
--      prof_id (la ligne profs rattachée, une seule fiche par ligne), lieux_partages, depart_le (date de départ d'une personne sans
--      compte : passée, la fiche disparaît de l'annuaire pour qui ne l'écrit pas ; la suppression reste à la main, choix C-16).
--      Les colonnes d'avant (prenom, role, phone, email, note, category, sort_order) ne changent ni de nom ni de contenu.
--   2. Les copies faites par 20261113_contacts_centre_2_montpellier et restées identiques (prénom, rôle, téléphone, e-mail, note,
--      catégorie, ordre) sont fusionnées dans la plus ancienne, qui gagne leur centre dans lieux_partages (C-2). Une copie qui a
--      changé reste à part. Un avis donne les nombres, sans aucun nom.
--   3. Une fiche d'office par adresse qui a une affectation de formateur ou de direction, puis deux déclencheurs sur affectations :
--      la fiche naît avec la première affectation et disparaît avec la dernière (C-5). Une fiche d'office reprend la ligne profs du
--      compte (user_profiles.prof_id) quand aucune autre fiche ne l'a déjà ; une fiche sans compte se rattache à la main.
--   4. Lecture par fonction : annuaire_centre() rend les fiches du centre de la promo affichée, masque les coordonnées d'une fiche
--      avec compte tant que la personne ne l'a pas vérifiée, et ne rend les champs d'édition qu'à qui peut l'écrire.
--   5. Écriture directe : seulement les fiches sans compte (contacts_ecriture), seulement les colonnes permises (droits de colonnes :
--      ni compte_email, ni verifiee_le, ni lieu_id en modification ; anon n'écrit rien), et un déclencheur qui juge le partage, le
--      relais et le rattachement à profs (jamais la ligne d'un compte de l'équipe ; une ligne du planning d'un des centres).
--   Partie B (tâche 3) :
--   6. Ma fiche : ma_fiche_contact() et regler_ma_fiche() (le premier enregistrement vaut vérification, C-4) ; ordonner_fiches().
--   7. Financements de chaque centre (contact_financements, liste livrée d'office, aussi à chaque centre créé) : financements_du_centre(),
--      regler_financements() (réglages du centre ; un financement porté par un stagiaire se retire, il ne se supprime pas).
--   8. Coordonnées privées des stagiaires (stagiaires_prive.telephone et .financement_id) : regler_coordonnees_stagiaire(),
--      coordonnees_promo().
--   9. Le délégué de la promo (stagiaires.delegue : titulaire, suppléant, au plus un de chaque par promo), par les règles existantes.
--   10. Les profils du personnel ne se lisent plus par un compte sans affectation (stagiaires) ni en aperçu stagiaire
--      (user_profiles_lecture, clause du personnel : _contact_compte_equipe()).
--   La lecture directe de contacts (contacts_select_authenticated) n'est PAS touchée ici : sa fermeture est la migration 1b
--   (20261115_contact_1b_fermeture.sql), appliquée après la fusion de l'app. Entre les deux, la lecture directe ne montre rien de
--   nouveau : une fiche d'office a lieu_id nul (la règle restrictive contacts_meme_centre la cache), et les colonnes nouvelles des
--   fiches sans compte sont vides (lieux_partages excepté, qui ne dit qu'un numéro de centre).
-- Garde : contacts.lieu_id existe, contacts.compte_email n'existe pas, donner_titre existe, contacts_ecriture a exactement le texte
-- de 20261112_titres_3_regles.sql, contacts_select_authenticated existe une fois avec le texte « true », contacts_meme_centre existe
-- une fois, restrictive, avec le texte de 20261113_contacts_centre.sql ; stagiaires_prive existe, ni contact_financements, ni
-- stagiaires_prive.telephone, .financement_id, ni stagiaires.delegue n'existent ; user_profiles_lecture a exactement le texte de
-- 20261112_titres_5_fermetures.sql (promo_par_defaut() une seule fois) ; sinon rien ne change.
-- Marche arrière : 20261115_contact_1_annuaire_retour.sql (refusée tant que la 1b est appliquée).
set local lock_timeout = '3s';

do $garde$
declare
  v_attendu constant text := '(SELECTgeste_promo((SELECTpromo_courante()ASpromo_courante),''fiches_internes.ecrire''::text)ASgeste_promo)';
  v_centre constant text := '(lieu_id=(SELECTlieu_courant()ASlieu_courant))';
  v_profils constant text := '((lower(email)=lower((SELECT(auth.jwt()->>''email''::text))))OR((stagiaire_idISNULL)AND(role<>''stagiaire''::text)AND(((SELECTpromo_par_defaut()ASpromo_par_defaut)ISNOTNULL)OR(SELECTgeste_reseau(''directions.lire''::text)ASgeste_reseau)OR(SELECTest_fondateur()ASest_fondateur)))OR((stagiaire_idISNULL)AND(role=''stagiaire''::text)AND((SELECTest_fondateur()ASest_fondateur)OR(lower(invited_by_email)=lower((SELECT(auth.jwt()->>''email''::text))))))OR((stagiaire_idIN(SELECTs.idFROMstagiairessWHERE(s.promo_id=(SELECTpromo_courante()ASpromo_courante))))AND(SELECTgeste_promo((SELECTpromo_courante()ASpromo_courante),''stagiaires.lire''::text)ASgeste_promo)))';
  v_qual text;
  v_check text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id') then
    raise exception 'contact_1 : la colonne contacts.lieu_id est absente (20261113_contacts_centre) ; rien n''est changé';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'contacts' and column_name = 'compte_email') then
    raise exception 'contact_1 : la colonne contacts.compte_email existe déjà, migration déjà appliquée ? rien n''est changé';
  end if;
  if to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)') is null then
    raise exception 'contact_1 : donner_titre(text, bigint, integer, integer[], integer) est absente (titres, migration 6) ; rien n''est changé';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'contacts' and policyname = 'contacts_ecriture') <> 1 then
    raise exception 'contact_1 : la règle contacts_ecriture est absente ; rien n''est changé';
  end if;
  select regexp_replace(replace(p.qual, 'public.', ''), '\s', '', 'g'), regexp_replace(replace(p.with_check, 'public.', ''), '\s', '', 'g')
    into v_qual, v_check
    from pg_policies p where p.schemaname = 'public' and p.tablename = 'contacts' and p.policyname = 'contacts_ecriture';
  if v_qual is distinct from v_attendu or v_check is distinct from v_attendu then
    raise exception 'contact_1 : la règle contacts_ecriture n''a plus le texte de 20261112_titres_3_regles.sql ; rien n''est changé';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'contacts'
         and policyname = 'contacts_select_authenticated' and qual = 'true') <> 1 then
    raise exception 'contact_1 : la règle contacts_select_authenticated est absente ou n''est plus « true » ; rien n''est changé';
  end if;
  -- La sûreté de l'intervalle entre la 1 et la 1b repose sur la règle restrictive du centre (une fiche avec compte a lieu_id nul).
  if (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'contacts'
         and p.policyname = 'contacts_meme_centre' and p.permissive = 'RESTRICTIVE' and p.cmd = 'ALL'
         and regexp_replace(replace(p.qual, 'public.', ''), '\s', '', 'g') = v_centre
         and regexp_replace(replace(p.with_check, 'public.', ''), '\s', '', 'g') = v_centre) <> 1 then
    raise exception 'contact_1 : la règle restrictive contacts_meme_centre est absente ou n''a plus le texte de 20261113_contacts_centre.sql ; rien n''est changé';
  end if;
  -- Partie B : rien de ce qu'elle pose n'existe encore, et user_profiles_lecture a exactement le texte de 20261112_titres_5_fermetures.sql
  -- (une autre session peut la réécrire : on s'arrête plutôt que de défaire sa retouche sans bruit).
  if to_regclass('public.stagiaires_prive') is null then
    raise exception 'contact_1 : la table stagiaires_prive est absente ; rien n''est changé';
  end if;
  if to_regclass('public.contact_financements') is not null
     or exists (select 1 from information_schema.columns where table_schema = 'public'
                  and ((table_name = 'stagiaires_prive' and column_name in ('telephone', 'financement_id'))
                       or (table_name = 'stagiaires' and column_name = 'delegue'))) then
    raise exception 'contact_1 : contact_financements, stagiaires_prive.telephone, .financement_id ou stagiaires.delegue existe déjà ; rien n''est changé';
  end if;
  select p.qual into v_qual from pg_policies p
   where p.schemaname = 'public' and p.tablename = 'user_profiles' and p.policyname = 'user_profiles_lecture';
  if v_qual is null
     or (length(v_qual) - length(replace(v_qual, 'promo_par_defaut()', ''))) / length('promo_par_defaut()') <> 1
     or regexp_replace(replace(v_qual, 'public.', ''), '\s', '', 'g') is distinct from v_profils then
    raise exception 'contact_1 : la règle user_profiles_lecture est absente ou n''a plus le texte de 20261112_titres_5_fermetures.sql ; rien n''est changé';
  end if;
end $garde$;

-- 1. Les colonnes et leurs contraintes.
alter table public.contacts
  add column compte_email text,
  add column nom text,
  add column pour_quoi text,
  add column quand text,
  add column verifiee_le timestamptz,
  add column relais_id bigint references public.contacts (id) on delete set null,
  add column conge_du date,
  add column conge_au date,
  add column prof_id integer references public.profs (id) on delete set null,
  add column lieux_partages integer[] not null default '{}',
  add column depart_le date;
alter table public.contacts alter column prenom drop not null;
alter table public.contacts alter column lieu_id drop not null;
alter table public.contacts
  add constraint contacts_compte_minuscules check (compte_email = lower(compte_email)),
  add constraint contacts_compte_ou_centre check ((compte_email is null) = (lieu_id is not null)),
  add constraint contacts_compte_ou_prenom check (compte_email is not null or prenom is not null),
  add constraint contacts_pour_quoi_court check (char_length(pour_quoi) <= 80),
  add constraint contacts_quand_court check (char_length(quand) <= 80),
  add constraint contacts_relais_autre check (relais_id <> id),
  add constraint contacts_conge_dates check ((conge_du is null and conge_au is null)
                                             or (conge_du is not null and conge_au is not null and conge_du <= conge_au)),
  add constraint contacts_partage_sans_compte check (compte_email is null or lieux_partages = '{}'),
  add constraint contacts_depart_sans_compte check (compte_email is null or depart_le is null);
create unique index contacts_compte_email_unique on public.contacts (lower(compte_email)) where compte_email is not null;
create unique index contacts_prof_unique on public.contacts (prof_id) where prof_id is not null;

-- 2. Fusion des copies restées identiques (C-2). Le déclencheur contacts_set_updated est suspendu le temps de la fusion : la fiche
--    gardée garde ses dates (la marche arrière refait les copies avec elles).
do $fusion$
declare
  v_fusionnees integer;
  v_a_part integer;
begin
  create temp table _contact_copies as
    select c.id, first_value(c.id) over w as garde, c.lieu_id
      from public.contacts c
     window w as (partition by c.prenom, c.role, c.phone, c.email, c.note, c.category, c.sort_order
                  order by c.created_at, c.id);
  -- Une copie : une ligne d'un AUTRE centre que la fiche gardée (deux lignes identiques d'un même centre ne sont pas des copies).
  delete from _contact_copies x
   where x.id = x.garde or x.lieu_id = (select g.lieu_id from public.contacts g where g.id = x.garde);
  alter table public.contacts disable trigger contacts_set_updated;
  update public.contacts g
     set lieux_partages = (select array_agg(distinct x.lieu_id order by x.lieu_id) from _contact_copies x where x.garde = g.id)
   where g.id in (select x.garde from _contact_copies x);
  alter table public.contacts enable trigger contacts_set_updated;
  delete from public.contacts c where c.id in (select x.id from _contact_copies x);
  get diagnostics v_fusionnees = row_count;
  drop table _contact_copies;
  -- Restées à part : une ligne née au même instant qu'une ligne plus ancienne d'un autre centre (la copie a gardé ses dates), et
  -- dont le contenu a divergé.
  select count(*) into v_a_part
    from public.contacts c
   where exists (select 1 from public.contacts d where d.id < c.id and d.created_at = c.created_at and d.lieu_id <> c.lieu_id);
  raise notice 'contact_1 : % copie(s) fusionnée(s) dans leur fiche d''origine, % copie(s) restée(s) à part (contenu modifié)',
    v_fusionnees, v_a_part;
end $fusion$;

-- 3. Les fiches d'office : une par adresse qui a une affectation de formateur ou de direction. La ligne profs du compte est reprise
--    si aucune autre fiche ne l'a ; deux comptes rattachés à la même ligne : le premier par ordre d'adresse.
insert into public.contacts (compte_email, lieu_id, prof_id)
select x.email, null,
       case when row_number() over (partition by u.prof_id order by x.email) = 1
             and not exists (select 1 from public.contacts c where c.prof_id = u.prof_id)
            then u.prof_id end
  from (select distinct lower(a.email) as email from public.affectations a where a.role in ('formateur', 'direction')) x
  left join lateral (select up.prof_id from public.user_profiles up
                      where lower(up.email) = x.email order by (up.prof_id is null), up.email limit 1) u on true
on conflict do nothing;

-- À la naissance de la fiche d'office, la ligne profs du compte lui revient, sauf si une autre fiche AVEC compte l'a déjà (deux comptes
-- sur une même ligne : le premier la garde). Une fiche SANS compte qui l'avait (rattachée à la main avant que la personne ait une
-- affectation) la rend : c'est la même personne, et sa fiche est désormais celle de son compte.
create function public._contact_fiche_d_office()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_prof integer;
begin
  if exists (select 1 from contacts c where c.compte_email = lower(new.email)) then
    return null;
  end if;
  select up.prof_id into v_prof from user_profiles up
   where lower(up.email) = lower(new.email) and up.prof_id is not null
     and not exists (select 1 from contacts c where c.prof_id = up.prof_id and c.compte_email is not null)
   order by up.email limit 1;
  if v_prof is not null then
    update contacts set prof_id = null where prof_id = v_prof and compte_email is null;
  end if;
  insert into contacts (compte_email, lieu_id, prof_id) values (lower(new.email), null, v_prof)
  on conflict do nothing;
  return null;
end $fn$;

create function public._contact_fiche_orpheline()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  delete from contacts c
   where c.compte_email = lower(old.email)
     and not exists (select 1 from affectations a
                      where lower(a.email) = lower(old.email) and a.role in ('formateur', 'direction'));
  return null;
end $fn$;

create trigger affectations_fiche_contact after insert on public.affectations
  for each row when (new.role in ('formateur', 'direction')) execute function public._contact_fiche_d_office();
create trigger affectations_fiche_orpheline after delete on public.affectations
  for each row when (old.role in ('formateur', 'direction')) execute function public._contact_fiche_orpheline();

-- 4. Une fiche est-elle dans le centre l ? Sans compte : son centre d'attache ou un centre de partage. Avec compte : une affectation
--    de formateur sur une promo de l, ou de direction sur l (quel que soit le titre).
create function public._contact_fiche_dans(c public.contacts, l integer)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select case
           when l is null then false
           when c.compte_email is null then coalesce(l = c.lieu_id or l = any(c.lieux_partages), false)
           else exists (select 1 from affectations a
                         where lower(a.email) = c.compte_email
                           and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = l))
                                or (a.role = 'direction' and a.lieu_id = l)))
         end;
$fn$;

-- L'annuaire du centre de la promo affichée (aucune promo : aucune ligne). Nom affiché : la ligne profs rattachée, sinon prénom et
-- nom, sinon les titres (C-6). Une fiche avec compte non vérifiée ne montre ni « pour quoi », ni « quand », ni téléphone, ni e-mail.
-- ecrivable : fiche sans compte de ce centre, et l'appelant écrit les fiches de la promo affichée ; prénom, nom, centres de partage,
-- catégorie et date de départ ne sont rendus qu'à lui. Une fiche sans compte dont la date de départ est passée (jour de Paris)
-- n'est rendue qu'à qui peut l'écrire.
create function public.annuaire_centre()
returns table (id bigint, avec_compte boolean, nom_affiche text, titres jsonb, libelle text, pour_quoi text, note text, quand text,
               telephone text, email text, verifiee boolean, conge_du date, conge_au date, relais_id bigint, prof_id integer,
               ordre integer, moi boolean, ecrivable boolean, joignable boolean, prenom text, nom text, lieux_partages integer[],
               categorie text, depart_le date)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with ctx as (
    select lieu_courant() as l,
           coalesce(geste_promo(promo_courante(), 'fiches_internes.ecrire'), false) as ecrit,
           lower(auth.jwt() ->> 'email') as moi,
           (now() at time zone 'Europe/Paris')::date as jour
  ), f as (
    select c.*, x.l as centre, x.moi as appelant,
           (c.compte_email is null and c.lieu_id = x.l and x.ecrit) as peut_ecrire,
           (c.compte_email is null or c.verifiee_le is not null) as verif,
           (c.depart_le is not null and c.depart_le < x.jour) as parti
      from ctx x
      join contacts c on _contact_fiche_dans(c, x.l)
     where x.l is not null
  )
  , r as (
  select f.id,
         f.compte_email is not null as avec_compte,
         coalesce(pf.nom, nullif(btrim(concat_ws(' ', f.prenom, f.nom)), ''), t.noms) as nom_affiche,
         coalesce(t.titres, '[]'::jsonb),
         case when f.compte_email is null then f.role end,
         case when f.verif then f.pour_quoi end,
         f.note,
         case when f.verif then f.quand end,
         case when f.verif then f.phone end,
         case when f.verif then f.email end,
         f.verif,
         f.conge_du, f.conge_au, f.relais_id, f.prof_id, f.sort_order as ordre,
         coalesce(f.compte_email = f.appelant, false),
         f.peut_ecrire,
         f.compte_email is not null or f.email is not null,
         case when f.peut_ecrire then f.prenom end,
         case when f.peut_ecrire then f.nom end,
         case when f.peut_ecrire then f.lieux_partages end,
         case when f.peut_ecrire then f.category end,
         case when f.peut_ecrire then f.depart_le end
    from f
    left join profs pf on pf.id = f.prof_id
    left join lateral (
      select jsonb_agg(jsonb_build_object('nom', g.nom, 'niveau', g.niveau, 'promos', g.promos) order by g.nom collate "C") as titres,
             string_agg(g.nom, ', ' order by g.nom collate "C") as noms
        from (select ti.nom, ti.niveau,
                     coalesce(jsonb_agg(distinct a.promo_id) filter (where a.promo_id is not null), '[]'::jsonb) as promos
                from affectations a
                join titres ti on ti.id = a.titre_id
               where f.compte_email is not null and lower(a.email) = f.compte_email
                 and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = f.centre))
                      or (a.role = 'direction' and a.lieu_id = f.centre))
               group by ti.id, ti.nom, ti.niveau) g
    ) t on true
   where not f.parti or f.peut_ecrire
  )
  select r.* from r order by r.ordre, r.nom_affiche collate "C", r.id;
$fn$;

-- 5. Écriture directe : fiches sans compte seulement (le reste du texte est celui de 20261112_titres_3_regles.sql).
alter policy contacts_ecriture on public.contacts
  using (compte_email is null and (select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')))
  with check (compte_email is null and (select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')));

-- Droits de colonnes : ni compte_email ni verifiee_le (écrits par la base), lieu_id seulement à l'ajout (contacts_meme_centre
-- l'impose au centre affiché). Révoquer le droit de table retire aussi les droits de colonnes.
revoke insert, update on public.contacts from authenticated;
-- anon n'écrit rien (aucune règle ne le lui permettait déjà : la règle d'écriture demande un jeton) ; le droit lui est retiré aussi.
revoke insert, update, delete, truncate on public.contacts from anon;
grant insert (prenom, nom, role, phone, email, note, category, sort_order, pour_quoi, quand, relais_id, conge_du, conge_au, prof_id,
              lieux_partages, lieu_id, depart_le) on public.contacts to authenticated;
grant update (prenom, nom, role, phone, email, note, category, sort_order, pour_quoi, quand, relais_id, conge_du, conge_au, prof_id,
              lieux_partages, depart_le) on public.contacts to authenticated;

-- Avant chaque écriture : les centres de partage (sans doublon, sans le centre d'attache, tous existants) ; un centre ajouté ou retiré
-- demande d'écrire les fiches d'une promo de ce centre (le fondateur hors aperçu et le propriétaire sans jeton sont libres) ; un
-- relais doit être une fiche d'un des centres de la fiche (même phrase que regler_ma_fiche).
create function public._contact_avant_ecriture()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_avant integer[] := case when tg_op = 'UPDATE' then old.lieux_partages else '{}'::integer[] end;
  v_x integer;
begin
  new.lieux_partages := coalesce(array(select distinct x from unnest(new.lieux_partages) x
                                         where x is not null and x is distinct from new.lieu_id order by x), '{}'::integer[]);
  if exists (select 1 from unnest(new.lieux_partages) x where not exists (select 1 from lieux li where li.id = x)) then
    raise exception 'contact: Centre inconnu.';
  end if;
  if lower(auth.jwt() ->> 'email') is not null and not est_fondateur() then
    for v_x in select d.x from ((select unnest(new.lieux_partages) except select unnest(v_avant))
                                union (select unnest(v_avant) except select unnest(new.lieux_partages))) d(x) loop
      if not exists (select 1 from promos p where p.lieu_id = v_x and geste_promo(p.id, 'fiches_internes.ecrire')) then
        raise exception 'contact: Vous ne pouvez partager une fiche qu''avec un centre où vous écrivez les fiches.' using errcode = '42501';
      end if;
    end loop;
  end if;
  -- Le rattachement d'une fiche sans compte à une ligne profs (formateurs du jour, partie C) : jamais la ligne d'un compte de l'équipe
  -- (elle revient à sa fiche d'office), et une ligne qui figure au planning d'une promo d'un des centres de la fiche.
  if new.prof_id is not null and new.compte_email is null and lower(auth.jwt() ->> 'email') is not null
     and (tg_op = 'INSERT' or new.prof_id is distinct from old.prof_id) then
    if exists (select 1 from user_profiles up
                where up.prof_id = new.prof_id
                  and exists (select 1 from affectations a
                               where lower(a.email) = lower(up.email) and a.role in ('formateur', 'direction'))) then
      raise exception 'contact: Ce formateur a un compte : sa fiche est celle de son compte.' using errcode = '42501';
    end if;
    if not exists (select 1 from planning_entries pe join promos p on p.id = pe.promo_id
                    where (pe.prof_id = new.prof_id or new.prof_id = any(pe.prof_ids))
                      and (p.lieu_id = new.lieu_id or p.lieu_id = any(new.lieux_partages))) then
      raise exception 'contact: Ce formateur ne figure pas au planning de ce centre.' using errcode = '42501';
    end if;
  end if;
  if new.relais_id is not null and (tg_op = 'INSERT' or new.relais_id is distinct from old.relais_id) then
    if not exists (
      select 1 from contacts r
       where r.id = new.relais_id
         and exists (select 1
                       from (select new.lieu_id as l
                             union select unnest(new.lieux_partages)
                             union select p.lieu_id from affectations a join promos p on p.id = a.promo_id
                                    where a.role = 'formateur' and lower(a.email) = new.compte_email
                             union select a.lieu_id from affectations a
                                    where a.role = 'direction' and lower(a.email) = new.compte_email) s
                      where s.l is not null and _contact_fiche_dans(r, s.l))) then
      raise exception 'contact: Le relais doit être une personne de l''équipe de votre centre.';
    end if;
  end if;
  return new;
end $fn$;

create trigger contacts_avant_ecriture before insert or update on public.contacts
  for each row execute function public._contact_avant_ecriture();

-- ===== Partie B : ma fiche, coordonnées des stagiaires, financements du centre, délégué, profils du personnel =====

-- 6. Ma fiche de contact. Les relais possibles d'une personne : les fiches des centres où elle a une affectation de formateur ou de
--    direction, la sienne exclue, hors fiches sans compte dont la date de départ est passée (jour de Paris). Le nom : la ligne profs
--    rattachée, sinon prénom et nom, sinon le libellé d'une fiche sans compte, sinon les titres de la personne dans ce centre.
create function public._contact_relais_possibles(p_email text)
returns table (id bigint, nom text, centre integer)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with centres as (
    select p.lieu_id as l from affectations a join promos p on p.id = a.promo_id
     where a.role = 'formateur' and lower(a.email) = lower(p_email)
    union
    select a.lieu_id from affectations a where a.role = 'direction' and lower(a.email) = lower(p_email) and a.lieu_id is not null
  )
  select distinct on (c.id) c.id,
         coalesce(pf.nom, nullif(btrim(concat_ws(' ', c.prenom, c.nom)), ''), c.role,
                  (select string_agg(distinct ti.nom, ', ' order by ti.nom) from affectations a join titres ti on ti.id = a.titre_id
                    where lower(a.email) = c.compte_email
                      and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = x.l))
                           or (a.role = 'direction' and a.lieu_id = x.l)))),
         x.l
    from centres x
    join contacts c on _contact_fiche_dans(c, x.l)
    left join profs pf on pf.id = c.prof_id
   where c.compte_email is distinct from lower(p_email)
     and (c.depart_le is null or c.depart_le >= (now() at time zone 'Europe/Paris')::date)
   order by c.id, x.l;
$fn$;

-- La fiche de l'appelant (nulle sans affectation de formateur ou de direction, et en aperçu : un aperçu ne fait que retirer des droits),
-- l'adresse de son compte (proposée comme e-mail professionnel au premier enregistrement), ses centres et ses relais possibles.
create function public.ma_fiche_contact()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_fiche jsonb;
begin
  if v_moi is not null and apercu_role() is null then
    select jsonb_build_object('id', c.id, 'prenom', c.prenom, 'nom', c.nom, 'prof_id', c.prof_id, 'nom_planning', pf.nom,
                              'email', c.email, 'telephone', c.phone, 'pour_quoi', c.pour_quoi, 'quand', c.quand,
                              'relais_id', c.relais_id, 'conge_du', c.conge_du, 'conge_au', c.conge_au,
                              'verifiee', c.verifiee_le is not null, 'verifiee_le', c.verifiee_le)
      into v_fiche
      from contacts c left join profs pf on pf.id = c.prof_id
     where c.compte_email = v_moi;
  end if;
  return jsonb_build_object(
    'fiche', v_fiche,
    'email_compte', v_moi,
    'centres', case when v_fiche is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', li.id, 'nom', li.nom) order by li.nom collate "C", li.id)
        from lieux li
       where li.id in (select p.lieu_id from affectations a join promos p on p.id = a.promo_id
                        where a.role = 'formateur' and lower(a.email) = v_moi
                       union
                       select a.lieu_id from affectations a where a.role = 'direction' and lower(a.email) = v_moi)), '[]'::jsonb) end,
    'relais_possibles', case when v_fiche is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nom', r.nom, 'centre', r.centre) order by r.nom collate "C", r.id)
        from _contact_relais_possibles(v_moi) r), '[]'::jsonb) end);
end $fn$;

-- Enregistrer sa fiche. Une clé absente ne change rien, une clé à null efface ; prénom et nom ne s'écrivent que sans ligne profs
-- rattachée (le nom vient alors du planning) ; tout enregistrement vaut vérification (C-4). Rend ma_fiche_contact() à jour.
create function public.regler_ma_fiche(p_champs jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_champs jsonb := coalesce(p_champs, '{}'::jsonb);
  c contacts%rowtype;
  k text;
  v text;
  j jsonb;
begin
  if v_moi is not null and apercu_role() is null then
    select * into c from contacts where compte_email = v_moi;
  end if;
  if c.id is null then
    raise exception 'contact: Vous n''avez pas de fiche de contact.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_champs) <> 'object' then
    raise exception 'contact: Champ inconnu « % ».', jsonb_typeof(v_champs);
  end if;
  for k in select jsonb_object_keys(v_champs) order by 1 loop
    if k not in ('prenom', 'nom', 'email', 'telephone', 'pour_quoi', 'quand', 'relais_id', 'conge_du', 'conge_au') then
      raise exception 'contact: Champ inconnu « % ».', k;
    end if;
  end loop;
  -- Les textes : espaces de bord retirés, vide = effacé, 80 caractères au plus.
  foreach k in array array['prenom', 'nom', 'email', 'telephone', 'pour_quoi', 'quand'] loop
    continue when not v_champs ? k;
    v := nullif(btrim(v_champs ->> k), '');
    if char_length(v) > 80 then
      raise exception 'contact: Ce texte est trop long (80 caractères au plus).';
    end if;
    case k
      when 'prenom' then if c.prof_id is null then c.prenom := v; end if;
      when 'nom' then if c.prof_id is null then c.nom := v; end if;
      when 'email' then
        if v is not null and v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
          raise exception 'contact: Adresse e-mail invalide.';
        end if;
        c.email := lower(v);
      when 'telephone' then
        if v is not null and v !~ '^[0-9 +().-]{6,20}$' then
          raise exception 'contact: Numéro de téléphone invalide.';
        end if;
        c.phone := v;
      when 'pour_quoi' then c.pour_quoi := v;
      when 'quand' then c.quand := v;
    end case;
  end loop;
  -- Le relais : une fiche de l'équipe d'un de ses centres (relais possibles), jamais la sienne.
  if v_champs ? 'relais_id' then
    j := v_champs -> 'relais_id';
    if jsonb_typeof(j) = 'null' then
      c.relais_id := null;
    elsif (jsonb_typeof(j) = 'number' or jsonb_typeof(j) = 'string') and (j #>> '{}') ~ '^[0-9]{1,18}$'
          and exists (select 1 from _contact_relais_possibles(v_moi) r where r.id = (j #>> '{}')::bigint) then
      c.relais_id := (j #>> '{}')::bigint;
    else
      raise exception 'contact: Le relais doit être une personne de l''équipe de votre centre.';
    end if;
  end if;
  -- Le congé : deux dates qui se suivent, ou aucune.
  foreach k in array array['conge_du', 'conge_au'] loop
    continue when not v_champs ? k;
    j := v_champs -> k;
    if jsonb_typeof(j) <> 'null' and not (jsonb_typeof(j) = 'string' and pg_input_is_valid(j #>> '{}', 'date')) then
      raise exception 'contact: Les dates du congé ne se suivent pas.';
    end if;
    if k = 'conge_du' then c.conge_du := (j #>> '{}')::date; else c.conge_au := (j #>> '{}')::date; end if;
  end loop;
  if (c.conge_du is null) <> (c.conge_au is null) or c.conge_du > c.conge_au then
    raise exception 'contact: Les dates du congé ne se suivent pas.';
  end if;
  update contacts
     set prenom = c.prenom, nom = c.nom, email = c.email, phone = c.phone, pour_quoi = c.pour_quoi, quand = c.quand,
         relais_id = c.relais_id, conge_du = c.conge_du, conge_au = c.conge_au, verifiee_le = now()
   where id = c.id;
  return public.ma_fiche_contact();
end $fn$;

-- L'ordre des fiches du centre affiché, pour qui écrit les fiches de la promo affichée : rang 1, 2, 3... devient 10, 20, 30...
-- L'ordre est celui de la personne, partout (C-1).
create function public.ordonner_fiches(p_ids bigint[])
returns integer language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_l integer := lieu_courant();
  n integer;
begin
  if not coalesce(geste_promo(promo_courante(), 'fiches_internes.ecrire'), false) then
    raise exception 'contact: Réservé à qui écrit les fiches de ce centre.' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_ids, '{}'::bigint[])) x(id)
              where x.id is null or not exists (select 1 from contacts c where c.id = x.id and _contact_fiche_dans(c, v_l))) then
    raise exception 'contact: Une fiche n''est pas de ce centre.' using errcode = '42501';
  end if;
  update contacts c
     set sort_order = 10 * o.rang
    from (select u.id, row_number() over (order by min(u.o)) as rang
            from unnest(coalesce(p_ids, '{}'::bigint[])) with ordinality u(id, o) group by u.id) o
   where c.id = o.id;
  get diagnostics n = row_count;
  return n;
end $fn$;

-- 7. Les financements de chaque centre : une liste livrée d'office (à chaque centre existant, puis à chaque centre créé), que le centre
--    ajuste dans ses réglages. Aucune règle, aucun droit : lecture et écriture par fonctions.
create table public.contact_financements (
  id bigint generated by default as identity primary key,
  lieu_id integer not null references public.lieux (id) on delete cascade,
  libelle text not null constraint contact_financements_libelle_court check (char_length(libelle) between 1 and 40),
  ordre integer not null default 0,
  retire boolean not null default false
);
create unique index contact_financements_libelle_unique on public.contact_financements (lieu_id, lower(libelle));
alter table public.contact_financements enable row level security;
revoke all on public.contact_financements from public, anon, authenticated;
revoke all on sequence public.contact_financements_id_seq from public, anon, authenticated;

create function public._contact_poser_financements(l integer)
returns void language sql security definer set search_path = public, pg_temp
as $fn$
  insert into contact_financements (lieu_id, libelle, ordre)
  select l, d.libelle, d.ordre
    from (values ('CPF', 10), ('Région', 20), ('France Travail', 30), ('Contrat de professionnalisation', 40), ('Entreprise', 50),
                 ('Personnel', 60), ('Autre', 70)) d(libelle, ordre)
  on conflict do nothing;
$fn$;

create function public._contact_financements_defaut()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  perform _contact_poser_financements(new.id);
  return null;
end $fn$;

do $financements$
begin
  perform public._contact_poser_financements(l.id) from public.lieux l;
end $financements$;

create trigger lieux_financements_defaut after insert on public.lieux
  for each row execute function public._contact_financements_defaut();

-- Ceux du centre de la promo affichée, retirés compris (un stagiaire peut encore en porter un), pour tout compte qui y accède.
create function public.financements_du_centre()
returns table (id bigint, libelle text, ordre integer, retire boolean)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select f.id, f.libelle, f.ordre, f.retire
    from contact_financements f
   where f.lieu_id = lieu_courant()
   order by f.ordre, f.libelle collate "C", f.id;
$fn$;

-- La liste entière d'un centre, par qui modifie ses réglages : [{id (null : nouveau), libelle, ordre, retire}]. Un financement absent
-- de la liste est supprimé, sauf s'il est choisi pour un stagiaire : il se retire alors (retire), il ne se supprime pas. Rend le
-- nombre de financements du centre après l'enregistrement.
create function public.regler_financements(p_lieu_id integer, p_liste jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  e jsonb;
  i bigint;
  k text;
  v_id bigint;
  v_lib text;
  v_ordre integer;
  v_retire boolean;
  v_ids bigint[] := '{}';
  v_lignes jsonb := '[]'::jsonb;
  n integer;
begin
  if p_lieu_id is null or not coalesce(geste_centre(p_lieu_id, 'reglages.modifier'), false) then
    raise exception 'contact: Réservé aux réglages du centre.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_liste) is distinct from 'array' then
    raise exception 'contact: La liste des financements est illisible.';
  end if;
  for e, i in select t.e, t.o from jsonb_array_elements(p_liste) with ordinality t(e, o) loop
    if jsonb_typeof(e) <> 'object' then
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    for k in select jsonb_object_keys(e) order by 1 loop
      if k not in ('id', 'libelle', 'ordre', 'retire') then
        raise exception 'contact: Champ inconnu « % ».', k;
      end if;
    end loop;
    v_id := null;
    if jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id') ~ '^[0-9]{1,18}$' then
      v_id := (e ->> 'id')::bigint;
    elsif coalesce(jsonb_typeof(e -> 'id'), 'null') <> 'null' then
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    if v_id is not null and not exists (select 1 from contact_financements f where f.id = v_id and f.lieu_id = p_lieu_id) then
      raise exception 'contact: Financement inconnu dans ce centre.';
    end if;
    if v_id = any(v_ids) then
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    v_lib := case when jsonb_typeof(e -> 'libelle') = 'string' then btrim(regexp_replace(e ->> 'libelle', '\s+', ' ', 'g')) else '' end;
    if char_length(v_lib) not between 1 and 40 then
      raise exception 'contact: Le nom d''un financement compte de 1 à 40 caractères.';
    end if;
    if coalesce(jsonb_typeof(e -> 'ordre'), 'null') = 'null' then
      v_ordre := 10 * i;
    elsif jsonb_typeof(e -> 'ordre') = 'number' and (e ->> 'ordre') ~ '^-?[0-9]{1,9}$' then
      v_ordre := (e ->> 'ordre')::integer;
    else
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    if coalesce(jsonb_typeof(e -> 'retire'), 'null') = 'null' then
      v_retire := false;
    elsif jsonb_typeof(e -> 'retire') = 'boolean' then
      v_retire := (e ->> 'retire')::boolean;
    else
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    if v_id is not null then v_ids := v_ids || v_id; end if;
    v_lignes := v_lignes || jsonb_build_object('id', v_id, 'libelle', v_lib, 'ordre', v_ordre, 'retire', v_retire);
  end loop;
  if exists (select 1 from jsonb_array_elements(v_lignes) r group by lower(r ->> 'libelle') having count(*) > 1) then
    raise exception 'contact: Deux financements portent le même nom.';
  end if;
  if exists (select 1 from contact_financements f
              where f.lieu_id = p_lieu_id and not (f.id = any(v_ids))
                and exists (select 1 from stagiaires_prive sp where sp.financement_id = f.id)) then
    raise exception 'contact: Un financement choisi pour un stagiaire ne se supprime pas : retirez-le.';
  end if;
  delete from contact_financements f where f.lieu_id = p_lieu_id and not (f.id = any(v_ids));
  begin
    update contact_financements f
       set libelle = r.libelle, ordre = r.ordre, retire = r.retire
      from jsonb_to_recordset(v_lignes) as r(id bigint, libelle text, ordre integer, retire boolean)
     where r.id is not null and f.id = r.id;
    insert into contact_financements (lieu_id, libelle, ordre, retire)
    select p_lieu_id, r.libelle, r.ordre, r.retire
      from jsonb_to_recordset(v_lignes) as r(id bigint, libelle text, ordre integer, retire boolean)
     where r.id is null;
  exception when unique_violation then
    -- Deux noms échangés dans le même enregistrement : la contrainte se juge ligne à ligne.
    raise exception 'contact: Deux financements portent le même nom.';
  end;
  select count(*) into n from contact_financements f where f.lieu_id = p_lieu_id;
  return n;
end $fn$;

-- 8. Coordonnées privées d'un stagiaire (stagiaires_prive : lecture par sa fiche ou par stagiaires.lire, aucune écriture directe ;
--    supprimées avec le reste à l'étape 1 de la conservation) : son téléphone, son financement (dans la liste du centre de sa promo).
alter table public.stagiaires_prive
  add column telephone text constraint stagiaires_prive_telephone_format check (telephone is null or telephone ~ '^[0-9 +().-]{6,20}$'),
  add column financement_id bigint references public.contact_financements (id) on delete set null;

-- Téléphone : la personne elle-même ou qui gère les stagiaires de la promo affichée ; financement : qui gère seulement, un financement
-- du centre de la promo, non retiré (celui déjà porté se garde). Une clé absente ne change rien, une clé à null efface.
create function public.regler_coordonnees_stagiaire(p_stagiaire_id integer, p_champs jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_p integer := promo_courante();
  v_champs jsonb := coalesce(p_champs, '{}'::jsonb);
  v_gere boolean;
  k text;
  v_tel text;
  v_fin bigint;
  j jsonb;
begin
  if v_p is null or p_stagiaire_id is null
     or not exists (select 1 from stagiaires s where s.id = p_stagiaire_id and s.promo_id = v_p and s.efface_le is null) then
    raise exception 'contact: Stagiaire introuvable dans cette promo.';
  end if;
  if jsonb_typeof(v_champs) <> 'object' then
    raise exception 'contact: Champ inconnu « % ».', jsonb_typeof(v_champs);
  end if;
  for k in select jsonb_object_keys(v_champs) order by 1 loop
    if k not in ('telephone', 'financement_id') then
      raise exception 'contact: Champ inconnu « % ».', k;
    end if;
  end loop;
  if v_champs = '{}'::jsonb then
    return;
  end if;
  v_gere := coalesce(geste_promo(v_p, 'stagiaires.gerer'), false);
  if v_champs ? 'telephone' then
    if not (v_gere or p_stagiaire_id is not distinct from my_stagiaire_id()) then
      raise exception 'contact: Réservé à l''équipe.' using errcode = '42501';
    end if;
    v_tel := nullif(btrim(v_champs ->> 'telephone'), '');
    if v_tel is not null and v_tel !~ '^[0-9 +().-]{6,20}$' then
      raise exception 'contact: Numéro de téléphone invalide.';
    end if;
  end if;
  if v_champs ? 'financement_id' then
    if not v_gere then
      raise exception 'contact: Réservé à l''équipe.' using errcode = '42501';
    end if;
    j := v_champs -> 'financement_id';
    if jsonb_typeof(j) <> 'null' then
      if not ((jsonb_typeof(j) = 'number' or jsonb_typeof(j) = 'string') and (j #>> '{}') ~ '^[0-9]{1,18}$') then
        raise exception 'contact: Financement inconnu dans ce centre.';
      end if;
      v_fin := (j #>> '{}')::bigint;
      if not exists (select 1 from contact_financements f
                      where f.id = v_fin and f.lieu_id = lieu_de_promo(v_p)
                        and (not f.retire
                             or exists (select 1 from stagiaires_prive sp where sp.stagiaire_id = p_stagiaire_id and sp.financement_id = f.id))) then
        raise exception 'contact: Financement inconnu dans ce centre.';
      end if;
    end if;
  end if;
  insert into stagiaires_prive (stagiaire_id, telephone, financement_id) values (p_stagiaire_id, v_tel, v_fin)
  on conflict (stagiaire_id) do update
     set telephone = case when v_champs ? 'telephone' then excluded.telephone else stagiaires_prive.telephone end,
         financement_id = case when v_champs ? 'financement_id' then excluded.financement_id else stagiaires_prive.financement_id end,
         updated_at = now();
end $fn$;

-- Les coordonnées des stagiaires de la promo affichée : toutes pour qui lit les stagiaires (stagiaires.lire), sinon la sienne seule.
-- L'e-mail est celui du compte de la fiche.
create function public.coordonnees_promo()
returns table (stagiaire_id integer, telephone text, email text, financement_id bigint, financement text)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with ctx as (
    select promo_courante() as p, coalesce(geste_promo(promo_courante(), 'stagiaires.lire'), false) as lit, my_stagiaire_id() as moi
  )
  select s.id, sp.telephone,
         (select min(lower(up.email)) from user_profiles up where up.stagiaire_id = s.id),
         sp.financement_id, f.libelle
    from ctx x
    join stagiaires s on s.promo_id = x.p
    left join stagiaires_prive sp on sp.stagiaire_id = s.id
    left join contact_financements f on f.id = sp.financement_id
   where x.p is not null and (x.lit or s.id = x.moi)
   order by s.ordre, s.id;
$fn$;

-- 9. Le délégué de la promo (titulaire, suppléant : au plus un de chaque par promo). Écrit par la règle stagiaires_modification
--    (stagiaires.gerer), lu par stagiaires_select_all (les stagiaires de la promo le voient) ; aucun droit à changer.
alter table public.stagiaires
  add column delegue text constraint stagiaires_delegue_valeur check (delegue in ('titulaire', 'suppleant'));
create unique index stagiaires_delegue_unique on public.stagiaires (promo_id, delegue) where delegue is not null;

-- 10. Les profils du personnel ne se lisent plus par un compte sans affectation ni par l'aperçu stagiaire : la clause du personnel de
--     user_profiles_lecture (texte de 20261112_titres_5_fermetures.sql) passe de « a une promo » (promo_par_defaut() non nulle, vrai
--     pour tout stagiaire) à « compte de l'équipe ». Le reste de la règle est inchangé.
--     Compte de l'équipe : hors aperçu stagiaire, une affectation (ou le fondateur réel), ET toujours une promo (promo_par_defaut()) :
--     la clause ne fait que se resserrer, elle n'ouvre le personnel à personne qui ne le lisait pas (un compte du siège ou d'un centre
--     sans promo, sans « Directions », ne le lit toujours pas : garantie de tests/sql/titres-gestion-preuve.sql).
create function public._contact_compte_equipe()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select public.apercu_role() is distinct from 'stagiaire'
     and public.promo_par_defaut() is not null
     and (exists (select 1 from affectations a where lower(a.email) = lower(auth.jwt() ->> 'email')) or public.fondateur_reel());
$fn$;

alter policy user_profiles_lecture on public.user_profiles
  using (lower(email) = lower((select auth.jwt() ->> 'email')) or (stagiaire_id is null and role <> 'stagiaire' and ((select public._contact_compte_equipe()) or (select public.geste_reseau('directions.lire')) or (select public.est_fondateur()))) or (stagiaire_id is null and role = 'stagiaire' and ((select public.est_fondateur()) or lower(invited_by_email) = lower((select auth.jwt() ->> 'email')))) or (stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.lire'))));

-- Droits des fonctions : l'annuaire à tout compte connecté ; les aides internes à personne.
revoke all on function public.annuaire_centre() from public, anon, service_role;
grant execute on function public.annuaire_centre() to authenticated;
revoke all on function public._contact_fiche_dans(public.contacts, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_fiche_d_office() from public, anon, authenticated, service_role;
revoke all on function public._contact_fiche_orpheline() from public, anon, authenticated, service_role;
revoke all on function public._contact_avant_ecriture() from public, anon, authenticated, service_role;
-- Partie B : les fonctions de l'app à tout compte connecté (chacune juge l'appelant) ; les aides internes à personne, sauf
-- _contact_compte_equipe(), citée par la règle user_profiles_lecture, qui s'évalue avec les droits de l'appelant.
revoke all on function public.ma_fiche_contact() from public, anon, service_role;
grant execute on function public.ma_fiche_contact() to authenticated;
revoke all on function public.regler_ma_fiche(jsonb) from public, anon, service_role;
grant execute on function public.regler_ma_fiche(jsonb) to authenticated;
revoke all on function public.ordonner_fiches(bigint[]) from public, anon, service_role;
grant execute on function public.ordonner_fiches(bigint[]) to authenticated;
revoke all on function public.financements_du_centre() from public, anon, service_role;
grant execute on function public.financements_du_centre() to authenticated;
revoke all on function public.regler_financements(integer, jsonb) from public, anon, service_role;
grant execute on function public.regler_financements(integer, jsonb) to authenticated;
revoke all on function public.regler_coordonnees_stagiaire(integer, jsonb) from public, anon, service_role;
grant execute on function public.regler_coordonnees_stagiaire(integer, jsonb) to authenticated;
revoke all on function public.coordonnees_promo() from public, anon, service_role;
grant execute on function public.coordonnees_promo() to authenticated;
revoke all on function public._contact_compte_equipe() from public, anon, service_role;
grant execute on function public._contact_compte_equipe() to authenticated;
revoke all on function public._contact_relais_possibles(text) from public, anon, authenticated, service_role;
revoke all on function public._contact_poser_financements(integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_financements_defaut() from public, anon, authenticated, service_role;

-- Contrôle de fin : les droits de colonnes sont bien ceux voulus (un droit de table resté en place les rendrait vains), et anon n'écrit rien.
do $controle$
begin
  if has_column_privilege('authenticated', 'public.contacts', 'compte_email', 'INSERT')
     or has_column_privilege('authenticated', 'public.contacts', 'compte_email', 'UPDATE')
     or has_column_privilege('authenticated', 'public.contacts', 'verifiee_le', 'UPDATE')
     or has_column_privilege('authenticated', 'public.contacts', 'lieu_id', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.contacts', 'prenom', 'UPDATE')
     or has_any_column_privilege('anon', 'public.contacts', 'INSERT')
     or has_any_column_privilege('anon', 'public.contacts', 'UPDATE')
     or has_table_privilege('anon', 'public.contacts', 'DELETE')
     or has_table_privilege('anon', 'public.contacts', 'TRUNCATE') then
    raise exception 'contact_1 : les droits de colonnes de contacts ne sont pas ceux attendus ; tout est annulé';
  end if;
  -- Partie B : la table des financements n'a aucun droit pour l'API (ni lecture, ni écriture, ni vidage).
  if has_table_privilege('anon', 'public.contact_financements', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_table_privilege('authenticated', 'public.contact_financements', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_any_column_privilege('anon', 'public.contact_financements', 'SELECT, INSERT, UPDATE, REFERENCES')
     or has_any_column_privilege('authenticated', 'public.contact_financements', 'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'contact_1 : la table contact_financements garde un droit pour anon ou authenticated ; tout est annulé';
  end if;
end $controle$;
