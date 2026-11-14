-- Espace contact, migration 1 (partie A) : l'annuaire du centre, une fiche par personne.
-- Spec : docs/superpowers/specs/2026-11-09-espace-contact-design.md ; plan : docs/superpowers/plans/2026-11-14-espace-contact.md
-- (tâche 2, choix C-1 à C-6, décisions de Timy du 14/11).
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
--      ni compte_email, ni verifiee_le, ni lieu_id en modification), et un déclencheur qui juge le partage et le relais.
--   La lecture directe de contacts (contacts_select_authenticated) n'est PAS touchée ici : sa fermeture est la migration 1b
--   (20261115_contact_1b_fermeture.sql), appliquée après la fusion de l'app. Entre les deux, la lecture directe ne montre rien de
--   nouveau : une fiche d'office a lieu_id nul (la règle restrictive contacts_meme_centre la cache), et les colonnes nouvelles des
--   fiches sans compte sont vides (lieux_partages excepté, qui ne dit qu'un numéro de centre).
-- Garde : contacts.lieu_id existe, contacts.compte_email n'existe pas, donner_titre existe, contacts_ecriture a exactement le texte
-- de 20261112_titres_3_regles.sql, contacts_select_authenticated existe une fois avec le texte « true » ; sinon rien ne change.
-- Marche arrière : 20261115_contact_1_annuaire_retour.sql (refusée tant que la 1b est appliquée).
set local lock_timeout = '3s';

do $garde$
declare
  v_attendu constant text := '(SELECTgeste_promo((SELECTpromo_courante()ASpromo_courante),''fiches_internes.ecrire''::text)ASgeste_promo)';
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

create function public._contact_fiche_d_office()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  insert into contacts (compte_email, lieu_id, prof_id)
  values (lower(new.email), null,
          (select up.prof_id from user_profiles up
            where lower(up.email) = lower(new.email) and up.prof_id is not null
              and not exists (select 1 from contacts c where c.prof_id = up.prof_id)
            order by up.email limit 1))
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

-- Droits des fonctions : l'annuaire à tout compte connecté ; les aides internes à personne.
revoke all on function public.annuaire_centre() from public, anon, service_role;
grant execute on function public.annuaire_centre() to authenticated;
revoke all on function public._contact_fiche_dans(public.contacts, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_fiche_d_office() from public, anon, authenticated, service_role;
revoke all on function public._contact_fiche_orpheline() from public, anon, authenticated, service_role;
revoke all on function public._contact_avant_ecriture() from public, anon, authenticated, service_role;

-- Contrôle de fin : les droits de colonnes sont bien ceux voulus (un droit de table resté en place les rendrait vains).
do $controle$
begin
  if has_column_privilege('authenticated', 'public.contacts', 'compte_email', 'INSERT')
     or has_column_privilege('authenticated', 'public.contacts', 'compte_email', 'UPDATE')
     or has_column_privilege('authenticated', 'public.contacts', 'verifiee_le', 'UPDATE')
     or has_column_privilege('authenticated', 'public.contacts', 'lieu_id', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.contacts', 'prenom', 'UPDATE') then
    raise exception 'contact_1 : les droits de colonnes de contacts ne sont pas ceux attendus ; tout est annulé';
  end if;
end $controle$;
