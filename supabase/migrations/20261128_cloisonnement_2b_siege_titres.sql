-- Cloisonnement par organisme, étape 2b : le siège et les titres (spec docs/superpowers/specs/2026-11-27-cloisonnement-organismes-design.md,
-- § 5.2 bornage complet, § 5.3 lignes « Siège » et « Titres » ; plan, tâche 4). Mêmes signatures, mêmes droits d'exécution
-- (create or replace), security definer et chemin de recherche gardés. Avec un seul organisme (ECF aujourd'hui), rien ne change
-- pour l'app : les preuves existantes gardent leur verdict.
-- Ce qu'elle change :
--   * Siège : comptes_reseau() ne compte que les centres de organisme_courant() (mêmes 19 colonnes) ; creer_centre(p_nom) crée dans
--     l'organisme courant, sous le verrou consultatif (2026110801, organisme), et juge le doublon dans l'organisme ; l'unicité globale
--     de lieux.nom (lieux_nom_key) est retirée (reste lieux_organisme_nom, posée à l'étape 1) ; regler_habillage_reseau(text) écrit
--     organismes.habillage de l'organisme courant, et toujours la clé settings.habillage_reseau quand c'est l'organisme 1 (iPhone en
--     cache) ; habillage_par_defaut() lit organismes.habillage ; roles_du_personnel(), lieux_lecture et affectations_lecture ne
--     rendent que le personnel et les centres de l'organisme courant ; inviter_compte : branche direction, un centre de l'organisme
--     courant ; branche siège, le siège de l'organisme actif du fondateur.
--   * organismes.habillage devient facultatif (nul : aucun habillage réglé, comme l'absence de la clé globale) ; l'organisme 1 reprend
--     la valeur valide de settings.habillage_reseau, et le déclencheur habillage_reseau_miroir la lui recopie à chaque écriture de
--     cette clé (jusqu'à l'étape de ménage).
--   * Titres : tout titre du réseau non fixe (sans centre, de niveau promo, centre ou réseau) porte l'organisme qui l'a créé
--     (l'existant sur l'organisme unique, le déclencheur organisme_par_defaut l'étend à ces titres) ; l'unicité titres_portee_nom
--     devient (organisme_id, lieu_id, lower(nom)) nulls not distinct ; titres_visibles, titres_ajustables, personnes_et_titres,
--     journal_des_droits (filtré par journal_droits.organisme_id), _cases_appelant('reseau'), _refus_titre, _refus_gestion,
--     donner_titre, retirer_titre, creer_titre, ajuster_titre, supprimer_titre : seulement les titres du réseau, les centres et
--     les sièges de l'organisme jugé. Un titre du réseau d'un autre organisme répond « Titre introuvable. ». Un titre réseau donné
--     crée une affectation siège sur l'organisme du titre (le titre fixe Siège : sur l'organisme courant). Le nom d'un titre fixe
--     reste réservé dans toute la base ; le verrou titres_ouverts reste global.
--   * Bornage complet du fondateur : chaque contournement « si fondateur » de ces fonctions et règles passe par
--     fondateur_sur(organisme de la ligne jugée) ; apercu_titre() n'accepte qu'un titre fixe ou un titre de l'organisme actif du
--     fondateur.
--   * dans_mon_organisme(p_organisme, p_lieu, p_promo) : l'organisme d'une ligne (donné, sinon celui du centre, sinon celui de la
--     promo) est l'organisme courant de l'appelant. Ouverte à authenticated : les règles lieux_lecture et affectations_lecture
--     l'appellent avec les droits de l'appelant.
-- Garde : étapes 1 et 2a en place ; le corps (md5, retours chariot retirés) de chaque fonction remplacée et de chaque fonction dont
-- le sens est repris tel quel, le texte des deux règles, l'index titres_portee_nom, la contrainte lieux_nom_key et le déclencheur
-- des titres sont ceux de l'état de la production du 27/11 avec les étapes 1 et 2a ; aucun objet de l'étape 2b n'existe ; les
-- titres du réseau sans organisme ne se remplissent que s'il n'y a qu'un organisme. Sinon rien n'est changé.
-- Preuve : tests/sql/cloisonnement-preuve.sql, groupes siege, titres, noms
-- (node outils/assembler_repetition_roles.mjs cloisonnement --etapes 1,2a,2b <sortie>).
-- Retour : 20261128_cloisonnement_2b_siege_titres_retour.sql (après celui de l'étape 2c, avant celui de l'étape 2a).
-- À appliquer en une seule transaction, après les étapes 1 et 2a :
--   psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261128_cloisonnement_2b_siege_titres.sql

set local lock_timeout = '3s';

do $garde$
declare
  v_liste text;
begin
  select string_agg(f, ', ') into v_liste
    from unnest(array['public.organisme_de_lieu(integer)', 'public.organisme_de_promo(integer)', 'public.organisme_actif_fondateur()',
                      'public.fondateur_sur(integer)', 'public.organisme_courant()', 'public.est_siege_de(integer)']) f
   where to_regprocedure(f) is null;
  if v_liste is not null or to_regclass('public.organismes') is null then
    raise exception 'cloisonnement_2b : étape 1 absente (%) ; rien n''est changé', coalesce(v_liste, 'table organismes');
  end if;
  select string_agg(x.f || ' (md5 ' || coalesce(md5(replace(p.prosrc, chr(13), '')), 'absente') || ')', ', ') into v_liste
    from (values
      -- Remplacées.
      ('public._organisme_par_defaut()', 'f5d7871edd2b0073c3a8fb37ef35db26'),
      ('public.comptes_reseau()', '8ae4d15b047be60a41262f71588d9c6e'),
      ('public.creer_centre(text)', '4e9d0c1d5ca2f3b5eb4d337298a52f4f'),
      ('public.regler_habillage_reseau(text)', '06d644ff242e341696def1dad643725f'),
      ('public.habillage_par_defaut()', 'dee4765b89c9172ab8f3ecd29214e156'),
      ('public.inviter_compte(text, text, integer, integer, integer)', '24f821676b1f684032daa933d4e1c047'),
      ('public.roles_du_personnel()', '6aebfdfadaf9bd6970241f560033a38c'),
      ('public._cases_appelant(text, integer)', 'c6573357160d5fe1c2e4625e972af14f'),
      ('public._refus_gestion(text, integer, jsonb)', 'bf980228d24af834235454eee2e7c170'),
      ('public._refus_titre(bigint, integer, text, text)', '63c4cb800d8dd8a5aa8166a7eaafafb0'),
      ('public.donner_titre(text, bigint, integer, integer[], integer)', '27a8bf6ec0d2a25cbd3685a68ab3c7cd'),
      ('public.retirer_titre(text, bigint, integer)', 'd5c7744a979877f6901bb2b7e42f9144'),
      ('public.creer_titre(bigint, text, integer)', '3e3fd1f08b778808ee74b32ae5254d0e'),
      ('public.ajuster_titre(bigint, integer, text, jsonb)', 'e6f3e7df3365ce9194e547bd157dda65'),
      ('public.supprimer_titre(bigint)', '6a4691b579d690515eeee7fb7c74f5c3'),
      ('public.titres_visibles(integer)', 'c2f054834867e2db46dbb9e5e50b9860'),
      ('public.titres_ajustables(integer)', 'bc6019c3f5767fdc9209899f811e0545'),
      ('public.personnes_et_titres(integer, integer)', 'a5591645b931f8ed98c9cb8cc52987fd'),
      ('public.journal_des_droits(integer)', '17963970c02087faf44700ca0b27a2fc'),
      ('public.apercu_titre()', '080e2f48cf473e2012f5d59444b0ac89'),
      -- Gardées telles quelles : leur sens est celui des étapes 1 et 2a.
      ('public.est_siege()', '03ab8d1c738827dc5ab5157b92218ce7'),
      ('public.case_reseau(text)', '1394175eafc6b032c74c08b34bfa723d'),
      ('public.siege_fixe()', '322b0828ae90625915e5675f0cf89649'),
      ('public.geste_reseau(text)', 'd746b4c94ef274ea02fbf281d10e5b89'),
      ('public.geste_centre(integer, text)', '14cc691cf0d9049e9c9a052140372da4'),
      ('public.geste_promo(integer, text)', '195a0bf62a5b9b73c66ac9d9ea1dcc9d'),
      ('public.lieu_courant()', 'd236b2e6184caecd392e5962511c82dc'),
      ('public.est_fondateur()', '87f35299949ab3db2d8c686e4665f263'),
      ('public.fondateur_reel()', 'c275a072a60fafffbab944893dd500cf'),
      ('public.fondateur_sur(integer)', 'fa4e97d9eb5de319506fbddac3a866e8'),
      ('public.organisme_actif_fondateur()', '0f7abfe5bd52d0b35883ce4a85eb2bf9'),
      ('public.organisme_courant()', '2cbbdb71f71728154793265d0d3a559d'),
      ('public.organisme_de_lieu(integer)', '55169ae2b914a4237344b938ff549a28'),
      ('public.organisme_de_promo(integer)', 'd0dba3837386f9e74cf300f1480b359e'),
      ('public._affectations_titre()', '8d28bacbba0eeaf24cdc18d476a25f5f'),
      ('public._journal_droits_organisme()', 'f40a9d9601750184645f05910abc3a2a')) x(f, attendu)
    left join pg_proc p on p.oid = to_regprocedure(x.f)
   where md5(replace(p.prosrc, chr(13), '')) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2b : corps inattendu(s) : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(x.r, ', ') into v_liste
    from (values ('lieux_lecture', '44eeded029e17cf5a5a4f3b945aa5f70'), ('affectations_lecture', '6a780b6275975a37fe57b99c1033b373')) x(r, attendu)
   where (select md5(p.qual) from pg_policies p where p.schemaname = 'public' and p.policyname = x.r) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2b : règle(s) inattendue(s) : % ; rien n''est changé', v_liste;
  end if;
  if to_regprocedure('public.dans_mon_organisme(integer, integer, integer)') is not null
     or to_regprocedure('public._habillage_reseau_miroir()') is not null
     or exists (select 1 from pg_trigger where tgrelid = 'public.settings'::regclass and tgname = 'habillage_reseau_miroir') then
    raise exception 'cloisonnement_2b : un objet de l''étape 2b existe déjà ; rien n''est changé';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.lieux'::regclass and conname = 'lieux_nom_key')
     or to_regclass('public.lieux_organisme_nom') is null
     or (select pg_get_indexdef('public.titres_portee_nom'::regclass))
        is distinct from 'CREATE UNIQUE INDEX titres_portee_nom ON public.titres USING btree (lieu_id, lower(nom)) NULLS NOT DISTINCT'
     or (select md5(pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid = 'public.titres'::regclass and t.tgname = 'organisme_par_defaut')
        is distinct from 'e57971e8835b3dad4a1127ae0e09b743'
     or not (select a.attnotnull from pg_attribute a where a.attrelid = 'public.organismes'::regclass and a.attname = 'habillage') then
    raise exception 'cloisonnement_2b : index, contrainte, déclencheur ou colonne inattendu (lieux_nom_key, lieux_organisme_nom, titres_portee_nom, organisme_par_defaut des titres, organismes.habillage) ; rien n''est changé';
  end if;
  if exists (select 1 from public.titres t where t.lieu_id is null and not t.fixe and t.organisme_id is null)
     and (select count(*) from public.organismes) <> 1 then
    raise exception 'cloisonnement_2b : des titres du réseau sans organisme et plusieurs organismes : à qui sont-ils ? rien n''est changé';
  end if;
end $garde$;

-- 1. Les noms : uniques dans un organisme, plus dans toute la base.
alter table public.lieux drop constraint lieux_nom_key;
drop index public.titres_portee_nom;
-- Les titres du réseau non fixes de niveau promo ou centre (créés avant l'étape 2b) rejoignent l'organisme unique.
update public.titres set organisme_id = (select min(o.id) from public.organismes o)
 where lieu_id is null and not fixe and organisme_id is null;
create unique index titres_portee_nom on public.titres (organisme_id, lieu_id, lower(nom)) nulls not distinct;

-- 2. Tout titre du réseau non fixe porte son organisme (le remplissage des insertions sans organisme_id couvre tous les niveaux).
create or replace function public._organisme_par_defaut()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_o integer;
  v_n integer;
begin
  if new.organisme_id is not null then
    return new;
  end if;
  if tg_table_name = 'affectations' then
    if new.role is distinct from 'siege' then
      return new;
    end if;
    -- Un titre réseau d'un organisme fait siège de cet organisme.
    select t.organisme_id into v_o from titres t where t.id = new.titre_id;
  elsif tg_table_name = 'titres' then
    -- Tout titre du réseau non fixe (sans centre, quel que soit son niveau) appartient à un organisme.
    if new.lieu_id is not null or new.fixe then
      return new;
    end if;
  end if;
  v_o := coalesce(v_o, organisme_courant());
  if v_o is null then
    -- Un seul organisme en base : celui-là, quel que soit l'appelant (rien de ce qui passait avant l'étape 1 n'est refusé).
    select min(o.id), count(*) into v_o, v_n from organismes o;
    if v_n <> 1 then
      v_o := null;
    end if;
  end if;
  if v_o is null then
    raise exception 'Organisme introuvable pour cette ligne.' using errcode = '22023';
  end if;
  new.organisme_id := v_o;
  return new;
end;
$function$;
drop trigger organisme_par_defaut on public.titres;
create trigger organisme_par_defaut before insert or update on public.titres
  for each row when (new.organisme_id is null and new.lieu_id is null and not new.fixe) execute function public._organisme_par_defaut();

-- 3. L'habillage du réseau devient celui de l'organisme ; nul : aucun. L'organisme 1 reprend la clé globale (valeur valide, sinon
--    nul), et le déclencheur la lui recopie à chaque écriture, d'où qu'elle vienne, jusqu'à l'étape de ménage.
alter table public.organismes alter column habillage drop not null;
update public.organismes
   set habillage = (select s.value from public.settings s where s.promo_id is null and s.key = 'habillage_reseau' and s.value in ('ecsr', 'ecf'))
 where id = 1;

create function public._habillage_reseau_miroir()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.promo_id is null and new.key = 'habillage_reseau' then
    update organismes set habillage = case when new.value in ('ecsr', 'ecf') then new.value end where id = 1;
  elsif tg_op in ('UPDATE', 'DELETE') and old.promo_id is null and old.key = 'habillage_reseau' then
    update organismes set habillage = null where id = 1;
  end if;
  return null;
end;
$function$;

create trigger habillage_reseau_miroir after insert or update or delete on public.settings
  for each row execute function public._habillage_reseau_miroir();

-- 4. L'organisme d'une ligne est-il celui de l'appelant ? (règles de lecture des centres et des affectations)
create function public.dans_mon_organisme(p_organisme integer, p_lieu integer, p_promo integer)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(coalesce(p_organisme, organisme_de_lieu(p_lieu), organisme_de_promo(p_promo)) = organisme_courant(), false);
$function$;

-- 5. Les fonctions du siège et des titres.
create or replace function public.comptes_reseau()
 returns table(lieu_id integer, lieu_nom text, demonstration boolean, promos_en_cours integer, masque boolean, inscrits integer, en_formation integer, abandons integer, absences integer, prevus integer, qcm_bonnes integer, qcm_questions integer, examens_passes integer, examens_reussis integer, notes_n integer, notes_somme numeric, notes_sous10 integer, epcf_acquis integer, epcf_renseignes integer)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_o integer;
begin
  if not coalesce((select est_siege()), false) then
    raise exception 'reseau: Réservé au siège.' using errcode = '42501';
  end if;
  -- Les centres de l'organisme courant seulement (celui du siège ; le fondateur : son organisme actif).
  v_o := organisme_courant();
  return query
  with en_cours as (
    select pr.id as pid, pr.lieu_id as lid
      from promos pr
      join lieux lo on lo.id = pr.lieu_id and lo.organisme_id = v_o
     where pr.date_debut <= current_date and (pr.date_fin is null or pr.date_fin >= current_date)
  ),
  fiches as (
    select s.id as sid, s.promo_id as pid, s.actif as actif, e.lid as lid
      from stagiaires s join en_cours e on e.pid = s.promo_id
  ),
  actives as (select f.sid, f.pid, f.lid from fiches f where f.actif),
  par_promos as (
    select e.lid, count(*) as promos from en_cours e group by e.lid
  ),
  par_fiches as (
    select f.lid, count(*) as inscrits, count(*) filter (where f.actif) as en_formation
      from fiches f group by f.lid
  ),
  par_passages as (
    select a.lid,
           count(*) filter (where p.resultat = 'Absence') as absences,
           count(*) filter (where p.resultat in ('Effectué', 'Absence')) as prevus
      from passages p join actives a on a.sid = p.stagiaire_id and a.pid = p.promo_id
     where p.type in ('Salle', 'Voiture')
     group by a.lid
  ),
  par_tentatives as (
    select a.lid,
           coalesce(sum(coalesce(t.score, 0)) filter (where t.mode = 'entrainement'), 0) as bonnes,
           coalesce(sum(coalesce(t.total, 0)) filter (where t.mode = 'entrainement'), 0) as questions,
           count(*) filter (where t.mode = 'examen') as passes,
           count(*) filter (where t.mode = 'examen' and t.note_20 >= coalesce(q.exam_pass_20, 15)) as reussis
      from qcm_attempts t
      join actives a on a.sid = t.stagiaire_id and a.pid = t.promo_id
      left join qcm q on q.id = t.qcm_id
     group by a.lid
  ),
  par_notes as (
    select a.lid, count(*) as n, sum(ev.note / ev.note_max * 20) as somme,
           count(*) filter (where ev.note / ev.note_max * 20 < 10) as sous10
      from evaluations ev join actives a on a.sid = ev.stagiaire_id and a.pid = ev.promo_id
     where ev.note is not null and coalesce(ev.note_max, 0) <> 0
     group by a.lid
  ),
  dernieres as (
    select distinct on (a.sid, x.trame) a.lid, a.sid, x.trame, x.scores
      from epcf_evaluations x join actives a on a.sid = x.stagiaire_id and a.pid = x.promo_id
     where x.trame in ('salle', 'vehicule', 'ccp2') and x.contexte = 'EPCF' and x.auto_eval is not true and x.date_eval is not null
     order by a.sid, x.trame, x.date_eval desc, x.id desc
  ),
  criteres as (
    select d.lid, d.sid, d.trame, v.value
      from dernieres d
     cross join lateral jsonb_each_text(case when jsonb_typeof(d.scores) = 'object' then d.scores else '{}'::jsonb end) v
     where v.value in ('A', 'R', 'NA')
  ),
  par_grille as (
    select c.lid, c.trame, count(distinct c.sid) as evalues,
           count(*) filter (where c.value = 'A') as acquis, count(*) as renseignes
      from criteres c group by c.lid, c.trame
  ),
  par_epcf as (
    select g.lid, sum(g.acquis) as acquis, sum(g.renseignes) as renseignes
      from par_grille g
     where g.trame <> 'ccp2' or g.evalues >= 3
     group by g.lid
  ),
  centres as (
    select l.id as lid, l.nom as nom, l.demonstration as demo,
           coalesce(pp.promos, 0)::integer as promos_en_cours,
           coalesce(pf.en_formation, 0) < 5 as masque,
           coalesce(pf.inscrits, 0)::integer as inscrits, coalesce(pf.en_formation, 0)::integer as en_formation,
           coalesce(ps.absences, 0)::integer as absences, coalesce(ps.prevus, 0)::integer as prevus,
           coalesce(pt.bonnes, 0)::integer as bonnes, coalesce(pt.questions, 0)::integer as questions,
           coalesce(pt.passes, 0)::integer as passes, coalesce(pt.reussis, 0)::integer as reussis,
           coalesce(pn.n, 0)::integer as notes_n, coalesce(pn.somme, 0)::numeric as notes_somme,
           coalesce(pn.sous10, 0)::integer as sous10,
           coalesce(pe.acquis, 0)::integer as acquis, coalesce(pe.renseignes, 0)::integer as renseignes
      from lieux l
      left join par_promos pp on pp.lid = l.id
      left join par_fiches pf on pf.lid = l.id
      left join par_passages ps on ps.lid = l.id
      left join par_tentatives pt on pt.lid = l.id
      left join par_notes pn on pn.lid = l.id
      left join par_epcf pe on pe.lid = l.id
     where l.organisme_id = v_o
  )
  select c.lid, c.nom, c.demo, c.promos_en_cours, c.masque,
         case when c.masque then null else c.inscrits end,
         case when c.masque then null else c.en_formation end,
         case when c.masque then null else c.inscrits - c.en_formation end,
         case when c.masque then null else c.absences end,
         case when c.masque then null else c.prevus end,
         case when c.masque then null else c.bonnes end,
         case when c.masque then null else c.questions end,
         case when c.masque then null else c.passes end,
         case when c.masque then null else c.reussis end,
         case when c.masque then null else c.notes_n end,
         case when c.masque then null else c.notes_somme end,
         case when c.masque then null else c.sous10 end,
         case when c.masque then null else c.acquis end,
         case when c.masque then null else c.renseignes end
    from centres c
   order by c.lid;
end;
$function$;

create or replace function public.creer_centre(p_nom text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_nom text := btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g'));
  v_id integer;
  v_o integer;
begin
  if not coalesce((select geste_reseau('centres.creer')), false) then
    raise exception 'centre: Réservé au siège.' using errcode = '42501';
  end if;
  if v_nom = '' then
    raise exception 'centre: Le nom est requis.';
  end if;
  -- Le centre naît dans l'organisme courant (celui du siège ; le fondateur : son organisme actif).
  v_o := organisme_courant();
  if v_o is null then
    raise exception 'centre: Réservé au siège.' using errcode = '42501';
  end if;
  -- Deux créations simultanées (« Foo » et « FOO ») dans un même organisme ne passent pas le contrôle de doublon en même temps :
  -- la seconde attend la fin de la première, puis voit son centre. Verrou de transaction propre à l'organisme, relâché au commit.
  perform pg_advisory_xact_lock(2026110801, v_o);
  -- Le doublon se juge dans l'organisme : un autre organisme peut avoir un centre du même nom.
  if exists (select 1 from lieux l where l.organisme_id = v_o and lower(l.nom) = lower(v_nom)) then
    raise exception 'centre: Ce centre existe déjà.';
  end if;
  begin
    insert into lieux (nom, organisme_id) values (v_nom, v_o) returning id into v_id;
  exception when unique_violation then
    raise exception 'centre: Ce centre existe déjà.';
  end;
  return v_id;
end;
$function$;

create or replace function public.regler_habillage_reseau(p_habillage text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_o integer;
begin
  if auth.jwt() ->> 'email' is null or not geste_reseau('reglages.modifier') then
    raise exception 'habillage: Réservé au siège.' using errcode = '42501';
  end if;
  if p_habillage is not null and p_habillage not in ('ecsr', 'ecf') then
    raise exception 'habillage: Cet habillage n''existe pas.';
  end if;
  -- L'habillage de l'organisme courant (celui du siège ; le fondateur : son organisme actif) ; nul : aucun.
  v_o := organisme_courant();
  if v_o is null then
    raise exception 'habillage: Réservé au siège.' using errcode = '42501';
  end if;
  update organismes set habillage = p_habillage where id = v_o;
  -- Organisme 1 (ECF) : la clé globale reste écrite pour les iPhone en cache (elle part à l'étape de ménage) ; le déclencheur
  -- habillage_reseau_miroir la recopie aussi dans organismes.
  if v_o = 1 then
    if p_habillage is null then
      delete from settings where promo_id is null and key = 'habillage_reseau';
    else
      insert into settings (key, value, promo_id) values ('habillage_reseau', p_habillage, null)
      on conflict (promo_id, key) do update set value = excluded.value, updated_at = now();
    end if;
  end if;
  return jsonb_build_object('habillage', p_habillage);
end;
$function$;

create or replace function public.habillage_par_defaut()
 returns table(centre text, libre boolean, reseau text)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_lieu integer;
begin
  if v_moi is null then
    raise exception 'habillage: Connexion requise.' using errcode = '42501';
  end if;
  v_lieu := lieu_courant();
  if v_lieu is null then
    select min(coalesce(af.lieu_id, lieu_de_promo(af.promo_id))) into v_lieu
      from affectations af where lower(af.email) = v_moi;
  end if;
  return query
    select l.habillage, coalesce(l.habillage_libre, true),
           -- Le réseau : l'habillage de l'organisme courant (un compte sans organisme : l'organisme unique, s'il n'y en a qu'un).
           (select o.habillage from organismes o
             where o.id = coalesce(organisme_courant(), (select min(x.id) from organismes x having count(*) = 1)))
      from (select 1) un
      left join lieux l on l.id = v_lieu;
end;
$function$;

create or replace function public.inviter_compte(p_email text, p_role text, p_stagiaire_id integer DEFAULT NULL::integer, p_prof_id integer DEFAULT NULL::integer, p_lieu_id integer DEFAULT NULL::integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_role text := case when p_role = 'prof' then 'formateur' else p_role end;
  v_promo integer;
  v_promo_fiche integer;
  v_anonymise timestamptz;
  v_prof integer;
  v_n bigint;
  v_aff bigint := 0;
  v_transforme boolean := false;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'invitation: Connexion requise.' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('stagiaire', 'formateur', 'direction', 'siege') then
    raise exception 'invitation: Rôle inconnu.';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'invitation: Adresse e-mail invalide.';
  end if;

  if v_role = 'stagiaire' then
    -- Formateur ou direction de la promo de la fiche.
    select s.promo_id, s.anonymise_le into v_promo_fiche, v_anonymise from stagiaires s where s.id = p_stagiaire_id;
    if v_promo_fiche is null or not geste_promo(v_promo_fiche, 'stagiaires.gerer') then
      raise exception 'invitation: Pas de droit sur la promo de ce stagiaire.' using errcode = '42501';
    end if;
    if v_anonymise is not null then
      raise exception 'invitation: Cette fiche est anonymisée.';
    end if;
    -- Une fiche n'a qu'un compte : celui qui tiendrait une seconde adresse signerait et écrirait comme le stagiaire.
    if exists (select 1 from user_profiles u where u.stagiaire_id = p_stagiaire_id and lower(u.email) <> v_email) then
      raise exception 'invitation: Cette fiche est déjà reliée à un autre compte.';
    end if;
    insert into user_profiles (email, role, is_admin, stagiaire_id, invited_by_email)
    values (v_email, 'stagiaire', false, p_stagiaire_id, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;

  elsif v_role = 'formateur' then
    -- Direction du centre de la promo affichée, ou fondateur : l'affectation porte sur la promo affichée.
    v_promo := promo_courante();
    if v_promo is null or not geste_centre(lieu_de_promo(v_promo), 'formateurs.nommer') then
      raise exception 'invitation: Réservé à la direction du centre.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté comme formateur.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel, avec la fiche formateur si elle est libre.
    v_transforme := _orphelin_en_personnel(v_email, true, p_prof_id, v_moi);
    -- Le profil (et sa fiche formateur, si elle est libre) est créé par la fonction interne, commune avec
    -- regler_affectations_formateur.
    v_n := case when _profil_formateur(v_email, p_prof_id, v_moi) then 1 else 0 end;
    insert into affectations (email, role, promo_id)
    values (v_email, 'formateur', v_promo)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  elsif v_role = 'direction' then
    -- Siège ou fondateur ; le centre est donné.
    if not geste_reseau('directions.nommer') then
      raise exception 'invitation: Réservé au siège.' using errcode = '42501';
    end if;
    -- Un centre de l'organisme courant : un centre d'un autre organisme est traité comme absent.
    if p_lieu_id is null or not exists (select 1 from lieux l where l.id = p_lieu_id and l.organisme_id = organisme_courant()) then
      raise exception 'invitation: Le centre est requis.';
    end if;
    -- Personne ne se nomme soi-même à la direction (le fondateur, hors aperçu et sur l'organisme du centre, excepté).
    if v_email = v_moi and not (est_fondateur() and fondateur_sur(organisme_de_lieu(p_lieu_id))) then
      raise exception 'invitation: Vous ne pouvez pas vous nommer vous-même à la direction.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, lieu_id)
    values (v_email, 'direction', p_lieu_id)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  else
    -- Siège : le fondateur seul, dans son organisme actif (rattachement, ou accès support ouvert) ; le siège invité est celui de
    -- cet organisme.
    v_o := organisme_actif_fondateur();
    if not (est_fondateur() and fondateur_sur(v_o)) then
      raise exception 'invitation: Réservé au fondateur.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté au siège.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, organisme_id)
    values (v_email, 'siege', v_o)
    on conflict do nothing;
    get diagnostics v_aff = row_count;
  end if;

  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff, 'transforme', v_transforme);
end;
$function$;

create or replace function public.roles_du_personnel()
 returns table(email text, role text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select distinct lower(a.email)::text, a.role::text
    from affectations a
   cross join (select organisme_courant() as o) moi
   where a.role in ('direction', 'siege')
     -- Le personnel de l'organisme courant seulement : une direction par son centre, un siège par son affectation.
     and coalesce(case a.role when 'siege' then a.organisme_id else organisme_de_lieu(a.lieu_id) end = moi.o, false)
     and (geste_promo(promo_courante(), 'reglages.modifier') or geste_centre(lieu_de_promo(promo_courante()), 'equipe.lire') or geste_reseau('directions.lire')
          or (est_fondateur() and fondateur_sur(moi.o)))
   order by 1, 2;
$function$;

create or replace function public._cases_appelant(p_niveau text, p_lieu_id integer)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_object_agg(x.page, case x.rang when 2 then 'modifier' when 1 then 'voir' else 'non' end)
    from (
      select pg.page,
             coalesce((select max(case _cases_effectives(t.id) ->> pg.page when 'modifier' then 2 when 'voir' then 1 else 0 end)
                         from affectations af
                         join titres t on t.id = af.titre_id
                        where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                          and ((p_niveau = 'centre' and af.role = 'direction' and af.lieu_id = p_lieu_id)
                            or (p_niveau = 'reseau' and af.role = 'siege' and af.organisme_id = organisme_courant()))), 0) as rang
        from _pages_du_niveau(p_niveau) pg
    ) x;
$function$;

create or replace function public._refus_gestion(p_niveau text, p_lieu_id integer, p_cases jsonb)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_page text;
  -- L'organisme jugé : celui du centre du titre, sinon (titre du réseau) l'organisme courant de l'appelant.
  v_o integer := case when p_lieu_id is not null then organisme_de_lieu(p_lieu_id) else organisme_courant() end;
  v_siege boolean;
begin
  -- 1. Le fondateur, hors aperçu, sur l'organisme jugé : permis.
  if coalesce(est_fondateur(), false) and fondateur_sur(v_o) then
    return null;
  end if;
  -- Le siège fixe ne vaut que dans son organisme courant.
  v_siege := coalesce(siege_fixe(), false) and coalesce(v_o = organisme_courant(), false);
  if p_lieu_id is not null and p_niveau in ('promo', 'centre') then
    if p_niveau = 'promo' then
      -- 2. Titre d'un centre, niveau promo : Équipe sur Modifier dans ce centre.
      if case_centre(p_lieu_id, 'equipe') <> 2 then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
    else
      -- 3. Titre d'un centre, niveau centre : Équipe sur Modifier dans ce centre, ou le siège fixe ; des cases au plus égales à celles de
      --    l'appelant, sauf direction fixe du centre ou siège fixe. Un titre non fixe du réseau (Directions de centre : Modifier) n'y
      --    touche plus : il donne et retire les titres existants, il ne les crée ni ne les ajuste.
      if case_centre(p_lieu_id, 'equipe') <> 2 and not v_siege then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
      if not coalesce(direction_fixe(p_lieu_id), false) and not v_siege then
        v_page := _depasse(p_cases, _cases_appelant('centre', p_lieu_id));
      end if;
    end if;
  elsif p_niveau in ('promo', 'centre') then
    -- 4. Titre du réseau de niveau promo ou centre (sans centre), créé, ajusté ou supprimé : le siège fixe seul.
    if not v_siege then
      return 'titres: Réservé au siège.';
    end if;
  else
    -- 5. Titre du réseau de niveau réseau : Directions de centre sur Modifier ; des cases au plus égales à celles de l'appelant, sauf
    --    siège fixe.
    if case_reseau('directions') <> 2 then
      return 'titres: Réservé au réseau.';
    end if;
    if not v_siege then
      v_page := _depasse(p_cases, _cases_appelant('reseau', null));
    end if;
  end if;
  if v_page is not null then
    return 'titres: Ce titre ouvre plus que le vôtre (' || v_page || ').';
  end if;
  return null;
end;
$function$;

create or replace function public._refus_titre(p_titre_id bigint, p_lieu_id integer, p_cible text, p_action text, OUT etat text, OUT phrase text)
 returns record
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  t record;
  v_moi text := lower(auth.jwt() ->> 'email');
  v_cible text := lower(trim(coalesce(p_cible, '')));
  v_lieu integer := p_lieu_id;
  v_page text;
  v_o integer;
  v_ici boolean;
  v_fondateur boolean;
begin
  if p_action is null or p_action not in ('donner', 'retirer') then
    raise exception 'titres: action inconnue « % »', p_action using errcode = '22023';
  end if;
  select ti.niveau, ti.fixe, ti.lieu_id as lieu_du_titre, ti.organisme_id as organisme_du_titre into t from titres ti where ti.id = p_titre_id;
  -- 1. Le titre, le centre.
  if t.niveau is null then
    etat := 'P0001'; phrase := 'titres: Titre introuvable.'; return;
  end if;
  if t.niveau = 'reseau' then
    v_lieu := null; -- un titre du réseau ne porte sur aucun centre : le centre donné est ignoré
  elsif v_lieu is null or not exists (select 1 from lieux l where l.id = v_lieu) then
    etat := 'P0001'; phrase := 'titres: Le centre est requis.'; return;
  end if;
  if t.lieu_du_titre is not null and t.lieu_du_titre is distinct from v_lieu then
    etat := 'P0001'; phrase := 'titres: Ce titre appartient à un autre centre.'; return;
  end if;
  -- 1 bis. L'organisme jugé : celui du centre, ou l'organisme courant pour un titre de niveau réseau. Un titre du réseau d'un autre
  -- organisme n'existe pas ici (ni au réseau, ni dans un centre de cet organisme).
  v_o := case when t.niveau = 'reseau' then organisme_courant() else organisme_de_lieu(v_lieu) end;
  if t.organisme_du_titre is not null and v_o is not null and t.organisme_du_titre <> v_o then
    etat := 'P0001'; phrase := 'titres: Titre introuvable.'; return;
  end if;
  -- Les droits du siège ne valent que dans son organisme courant ; le fondateur, hors aperçu, n'est exempté que sur l'organisme jugé.
  v_ici := coalesce(v_o = organisme_courant(), false);
  v_fondateur := coalesce(est_fondateur(), false) and fondateur_sur(v_o);
  -- 2. Le verrou.
  if p_action = 'donner' and not t.fixe and not coalesce(titres_ouverts(), false) then
    etat := 'P0001'; phrase := 'titres: Ce titre ne peut pas encore être donné.'; return;
  end if;
  -- 3. Le droit.
  if not v_fondateur then
    if t.fixe then
      if t.niveau = 'promo' then
        if not coalesce(geste_centre(v_lieu, 'formateurs.nommer'), false) then
          etat := '42501'; phrase := 'titres: Réservé à la direction du centre.'; return;
        end if;
      elsif t.niveau = 'centre' then
        if not (coalesce(geste_reseau('directions.nommer'), false) and v_ici) then
          etat := '42501'; phrase := 'titres: Réservé au siège.'; return;
        end if;
      else
        etat := '42501'; phrase := 'titres: Réservé au fondateur.'; return;
      end if;
    elsif t.niveau = 'reseau' then
      if case_reseau('directions') <> 2 or not v_ici then
        etat := '42501'; phrase := 'titres: Réservé au réseau.'; return;
      end if;
    elsif t.niveau = 'promo' then
      if case_centre(v_lieu, 'equipe') <> 2 then
        etat := '42501'; phrase := 'titres: Réservé à l''équipe du centre.'; return;
      end if;
    else
      if case_centre(v_lieu, 'equipe') <> 2 and (case_reseau('directions') <> 2 or not v_ici) then
        etat := '42501'; phrase := 'titres: Réservé à l''équipe du centre.'; return;
      end if;
    end if;
  end if;
  -- 4. Jamais plus que soi : un titre de centre non fixe, par qui tient son droit de son titre de centre (ni la direction fixe du
  -- centre, ni la case Directions de centre du réseau) ; un titre du réseau non fixe, par qui n'a pas le titre fixe du siège.
  if not t.fixe and t.niveau = 'centre' and not coalesce(direction_fixe(v_lieu), false) and (case_reseau('directions') <> 2 or not v_ici) then
    v_page := _depasse(_cases_effectives(p_titre_id), _cases_appelant('centre', v_lieu));
  elsif not t.fixe and t.niveau = 'reseau' and not (coalesce(siege_fixe(), false) and v_ici) then
    v_page := _depasse(_cases_effectives(p_titre_id), _cases_appelant('reseau', null));
  end if;
  if v_page is not null then
    etat := '42501'; phrase := 'titres: Ce titre ouvre plus que le vôtre (' || v_page || ').'; return;
  end if;
  -- 5. Jamais sur soi.
  if p_cible is not null and v_moi is not null and v_cible = v_moi and not v_fondateur
     and not (t.niveau = 'promo' and t.fixe and coalesce(direction_fixe(v_lieu), false)) then
    etat := '42501';
    phrase := case when p_action = 'retirer' then 'titres: Vous ne pouvez pas retirer votre propre titre.'
                   else 'titres: Vous ne pouvez pas changer vos propres titres.' end;
    return;
  end if;
  -- 6. Aucun titre du personnel à un compte stagiaire.
  if p_action = 'donner' and p_cible is not null
     and exists (select 1 from user_profiles u where lower(u.email) = v_cible and u.stagiaire_id is not null) then
    etat := 'P0001'; phrase := 'titres: Cette adresse est celle d''un compte stagiaire.'; return;
  end if;
end;
$function$;

create or replace function public.donner_titre(p_email text, p_titre_id bigint, p_lieu_id integer, p_promo_ids integer[] DEFAULT NULL::integer[], p_prof_id integer DEFAULT NULL::integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_titre_id bigint := p_titre_id;
  t record;
  v_lieu integer;
  v_etat text;
  v_phrase text;
  v_liste integer[] := '{}';
  v_cible text;
  v_cree boolean := false;
  v_transforme boolean := false;
  v_anciens bigint[];
  v_ancien bigint;
  v_remplace bigint;
  v_ajoutees integer[] := '{}';
  v_retirees integer[] := '{}';
  v_n bigint;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'titres: Adresse e-mail invalide.';
  end if;
  -- Un titre du réseau (niveau promo ou centre, sans centre) qui a une version dans ce centre se donne sous sa version.
  -- D4 : un don attend l'ajustement en cours du même titre (et inversement), puis voit sa version.
  perform 1 from titres where id = p_titre_id for share;
  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id
   where r.id = p_titre_id and r.lieu_id is null and r.niveau in ('promo', 'centre') and not r.fixe;
  if v_ancien is not null then
    v_titre_id := v_ancien;
  end if;
  select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(v_titre_id, p_lieu_id, v_email, 'donner') r;
  if v_etat is not null then
    raise exception '%', v_phrase using errcode = v_etat;
  end if;
  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;
  -- M4 : une fiche formateur ne se relie qu'au titre fixe Formateur.
  if p_prof_id is not null and not (t.niveau = 'promo' and t.fixe) then
    raise exception 'titres: Une fiche formateur ne se relie qu''au titre Formateur.';
  end if;
  v_lieu := case when t.niveau = 'reseau' then null else p_lieu_id end;
  -- Les promos d'un titre de promo : au moins une, toutes du centre.
  if t.niveau = 'promo' then
    select coalesce(array_agg(distinct x order by x), '{}') into v_liste from unnest(coalesce(p_promo_ids, '{}')) x where x is not null;
    if cardinality(v_liste) = 0 then
      raise exception 'titres: Choisissez au moins une promo.';
    end if;
    if exists (select 1 from unnest(v_liste) x where not exists (select 1 from promos p where p.id = x and p.lieu_id = v_lieu)) then
      raise exception 'titres: Une promo choisie n''est pas dans ce centre.';
    end if;
  end if;
  -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel ; un profil manquant est créé.
  -- M4, M5 : seul le titre fixe Formateur fait un compte de formateur (is_admin vrai, fiche reliée).
  v_transforme := _orphelin_en_personnel(v_email, t.niveau = 'promo' and t.fixe, case when t.niveau = 'promo' and t.fixe then p_prof_id end, v_moi);
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
  if v_cible is null then
    if t.niveau = 'promo' and t.fixe then
      v_cree := _profil_formateur(v_email, p_prof_id, v_moi);
    else
      insert into user_profiles (email, role, is_admin, invited_by_email) values (v_email, 'prof', false, v_moi)
      on conflict (email) do nothing;
      get diagnostics v_n = row_count;
      v_cree := v_n > 0;
    end if;
    v_cible := v_email;
  end if;
  -- Un titre par niveau et par centre (ou au réseau) : l'ancien titre, s'il y en a un, est retiré, et il obéit aux règles du retrait.
  if t.niveau = 'promo' then
    select array_agg(distinct a.titre_id) into v_anciens from affectations a join promos p on p.id = a.promo_id
     where lower(a.email) = lower(v_cible) and a.role = 'formateur' and p.lieu_id = v_lieu and a.titre_id <> v_titre_id;
  elsif t.niveau = 'centre' then
    select array_agg(distinct a.titre_id) into v_anciens from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'direction' and a.lieu_id = v_lieu and a.titre_id <> v_titre_id;
  else
    -- Le siège d'un organisme : celui du titre (titre du réseau non fixe), sinon l'organisme courant (titre fixe Siège). Une
    -- affectation siège d'un autre organisme n'est ni lue ni retirée ici.
    v_o := coalesce((select ti.organisme_id from titres ti where ti.id = v_titre_id), organisme_courant());
    select array_agg(distinct a.titre_id) into v_anciens from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'siege' and a.titre_id <> v_titre_id and a.organisme_id is not distinct from v_o;
  end if;
  foreach v_ancien in array coalesce(v_anciens, '{}') loop
    select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(v_ancien, v_lieu, v_cible, 'retirer') r;
    if v_etat is not null then
      raise exception '%', v_phrase using errcode = v_etat;
    end if;
    v_remplace := coalesce(v_remplace, v_ancien);
  end loop;
  -- Les lignes de l'ancien titre sont supprimées, puis les nouvelles posées (le déclencheur refuse un changement de titre en place).
  if t.niveau = 'promo' then
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'formateur' and a.titre_id = any (coalesce(v_anciens, '{}'))
       and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu);
    with retire as (
      delete from affectations a
       where lower(a.email) = lower(v_cible) and a.role = 'formateur' and a.titre_id = v_titre_id
         and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu)
         and not (a.promo_id = any (v_liste))
      returning a.promo_id)
    select coalesce(array_agg(r.promo_id order by r.promo_id), '{}') into v_retirees from retire r;
    with ajoute as (
      insert into affectations (email, role, promo_id, titre_id)
      select v_cible, 'formateur', x, v_titre_id from unnest(v_liste) x
      on conflict do nothing
      returning promo_id)
    select coalesce(array_agg(a.promo_id order by a.promo_id), '{}') into v_ajoutees from ajoute a;
  elsif t.niveau = 'centre' then
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'direction' and a.lieu_id = v_lieu and a.titre_id = any (coalesce(v_anciens, '{}'));
    insert into affectations (email, role, lieu_id, titre_id) values (v_cible, 'direction', v_lieu, v_titre_id)
    on conflict do nothing;
  else
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'siege' and a.titre_id = any (coalesce(v_anciens, '{}'))
       and a.organisme_id is not distinct from v_o;
    insert into affectations (email, role, titre_id, organisme_id) values (v_cible, 'siege', v_titre_id, v_o)
    on conflict do nothing;
  end if;
  return jsonb_build_object('email', v_cible, 'titre_id', v_titre_id, 'cree', v_cree, 'transforme', v_transforme,
                            'remplace', v_remplace, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
end;
$function$;

create or replace function public.retirer_titre(p_email text, p_titre_id bigint, p_lieu_id integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_niveau text;
  v_fixe boolean;
  v_lieu integer := p_lieu_id;
  v_n integer;
  v_etat text;
  v_phrase text;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select t.niveau, t.fixe, t.organisme_id into v_niveau, v_fixe, v_o from titres t where t.id = p_titre_id;
  if v_niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  -- Un titre du réseau ne porte sur aucun centre : le centre donné est ignoré.
  if v_niveau = 'reseau' then
    v_lieu := null;
  elsif v_lieu is null or not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est requis.';
  end if;
  -- Les règles du § 7 (titre d'un autre centre, droit, jamais plus que soi, jamais sur soi) sont celles de donner_titre : une seule aide.
  -- Retirer obéit aux mêmes règles que donner : on ne retire que ce qu'on pourrait donner (le verrou des titres non fixes mis à part).
  select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(p_titre_id, v_lieu, v_email, 'retirer') r;
  if v_etat is not null then
    raise exception '%', v_phrase using errcode = v_etat;
  end if;
  -- L'effet : les lignes de l'adresse (casse ignorée) qui portent ce titre, sur les promos du centre, sur le centre ou sans portée.
  if v_niveau = 'promo' then
    delete from affectations a
     where lower(a.email) = v_email and a.role = 'formateur' and a.titre_id = p_titre_id
       and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu);
  elsif v_niveau = 'centre' then
    delete from affectations a
     where lower(a.email) = v_email and a.role = 'direction' and a.titre_id = p_titre_id and a.lieu_id = v_lieu;
  else
    -- Le siège de l'organisme du titre (titre fixe Siège : l'organisme courant), jamais celui d'un autre organisme.
    v_o := coalesce(v_o, organisme_courant());
    delete from affectations a
     where lower(a.email) = v_email and a.role = 'siege' and a.titre_id = p_titre_id and a.organisme_id is not distinct from v_o;
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'titres: Cette personne n''a pas ce titre ici.';
  end if;
  return jsonb_build_object('email', v_email, 'titre_id', p_titre_id, 'lieu_id', v_lieu, 'retirees', v_n);
end;
$function$;

create or replace function public.creer_titre(p_depuis bigint, p_nom text, p_lieu_id integer)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_nom text := trim(coalesce(p_nom, ''));
  src record;
  v_lieu integer;
  v_cases jsonb;
  v_phrase text;
  v_id bigint;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select ti.niveau, ti.lieu_id as lieu_source, coalesce(ti.organisme_id, organisme_de_lieu(ti.lieu_id)) as organisme_source
    into src from titres ti where ti.id = p_depuis;
  if src.niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  if v_nom = '' then
    raise exception 'titres: Le nom est requis.';
  end if;
  if exists (select 1 from titres f where f.fixe and lower(f.nom) = lower(v_nom)) then
    raise exception 'titres: Ce nom est réservé à un titre fixe.';
  end if;
  -- Un titre du réseau (niveau réseau) n'a pas de centre ; un titre de promo ou de centre sans centre est un titre du réseau.
  v_lieu := case when src.niveau = 'reseau' then null else p_lieu_id end;
  if v_lieu is not null and not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est introuvable.';
  end if;
  -- L'organisme du nouveau titre : celui du centre, sinon (titre du réseau) l'organisme courant. Un titre d'origine d'un autre
  -- organisme n'existe pas ici.
  v_o := case when v_lieu is not null then organisme_de_lieu(v_lieu) else organisme_courant() end;
  if src.organisme_source is not null and v_o is not null and src.organisme_source <> v_o then
    raise exception 'titres: Titre introuvable.';
  end if;
  -- Le titre d'origine ne se lit que depuis son centre ou depuis le réseau de son organisme.
  if src.lieu_source is not null and src.lieu_source is distinct from v_lieu
     and not (coalesce(geste_centre(src.lieu_source, 'equipe.lire'), false)
              or (coalesce(geste_reseau('directions.lire'), false) and coalesce(organisme_de_lieu(src.lieu_source) = organisme_courant(), false))) then
    raise exception 'titres: Ce titre appartient à un autre centre.' using errcode = '42501';
  end if;
  v_cases := _cases_effectives(p_depuis);
  v_phrase := _refus_gestion(src.niveau, v_lieu, v_cases);
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  -- M7 : un nom ne reprend pas celui d'un titre de l'autre portée (après le droit : un appelant sans droit n'apprend pas qu'un nom
  -- existe). Un titre de centre : aucun titre du réseau non fixe ne porte ce nom ; un titre du réseau : aucun titre créé par un centre.
  -- Le tout dans l'organisme du nouveau titre : un autre organisme peut porter les mêmes noms.
  if v_lieu is not null then
    if exists (select 1 from titres r where r.lieu_id is null and not r.fixe and r.organisme_id = v_o and lower(r.nom) = lower(v_nom)) then
      raise exception 'titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';
    end if;
  elsif exists (select 1 from titres c where c.lieu_id is not null and c.origine_id is null and organisme_de_lieu(c.lieu_id) = v_o
                  and lower(c.nom) = lower(v_nom)) then
    raise exception 'titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';
  end if;
  begin
    insert into titres (nom, niveau, lieu_id, cases, cree_par, organisme_id)
    values (v_nom, src.niveau, v_lieu, v_cases, v_moi, case when v_lieu is null then v_o end) returning id into v_id;
  exception when unique_violation then
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return v_id;
end;
$function$;

create or replace function public.ajuster_titre(p_titre_id bigint, p_lieu_id integer, p_nom text, p_cases jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_nom text := case when p_nom is null then null else trim(p_nom) end;
  t record;
  v_lieu integer;
  v_phrase text;
  v_version bigint;
  v_cible bigint;
  v_creee boolean := false;
  v_emails text[];
  v_promos integer[];
  v_bascules integer := 0;
  v_contrainte text;
  i integer;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select ti.niveau, ti.fixe, ti.nom, ti.lieu_id as lieu_du_titre, coalesce(ti.origine_id, ti.id) as racine,
         coalesce(ti.organisme_id, organisme_de_lieu(ti.lieu_id)) as organisme_du_titre
    into t from titres ti where ti.id = p_titre_id;
  if t.niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  -- L'organisme jugé : celui du centre en jeu, sinon (titre ajusté au réseau) l'organisme courant. Un titre d'un autre organisme
  -- n'existe pas ici.
  v_o := case when t.niveau <> 'reseau' and coalesce(t.lieu_du_titre, p_lieu_id) is not null
              then organisme_de_lieu(coalesce(t.lieu_du_titre, p_lieu_id)) else organisme_courant() end;
  if t.organisme_du_titre is not null and v_o is not null and t.organisme_du_titre <> v_o then
    raise exception 'titres: Titre introuvable.';
  end if;
  if t.fixe then
    raise exception 'titres: Un titre fixe ne se modifie pas.';
  end if;
  if v_nom = '' then
    raise exception 'titres: Le nom est requis.';
  end if;
  if v_nom is not null and exists (select 1 from titres f where f.fixe and lower(f.nom) = lower(v_nom)) then
    raise exception 'titres: Ce nom est réservé à un titre fixe.';
  end if;
  if not coalesce(_cases_valides(t.niveau, p_cases), false) then
    raise exception 'titres: Ces cases ne sont pas valides.';
  end if;
  -- Le centre en jeu : celui du titre ; un titre du réseau (niveau promo ou centre) ajusté depuis un centre y aura sa version.
  if t.lieu_du_titre is not null and p_lieu_id is not null and p_lieu_id <> t.lieu_du_titre then
    raise exception 'titres: Ce titre appartient à un autre centre.';
  end if;
  v_lieu := case when t.niveau = 'reseau' then null else coalesce(t.lieu_du_titre, p_lieu_id) end;
  if v_lieu is not null and not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est introuvable.';
  end if;
  -- Jamais sur soi : ni le titre qu'on porte, ni sa version, ni le titre du réseau dont il est la version (le fondateur, hors aperçu et
  -- sur l'organisme jugé, excepté).
  if not (coalesce(est_fondateur(), false) and fondateur_sur(v_o)) and exists (
       select 1 from affectations af join titres tt on tt.id = af.titre_id
        where lower(af.email) = v_moi and (tt.id = t.racine or tt.origine_id = t.racine)) then
    raise exception 'titres: Vous ne pouvez pas modifier un titre que vous portez.' using errcode = '42501';
  end if;
  v_phrase := _refus_gestion(t.niveau, v_lieu, p_cases);
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  -- On n'ajuste que ce qu'on pourrait donner : les cases ACTUELLES du titre (celles de la version du centre si elle existe, sinon celles du
  -- titre du réseau que les personnes du centre portent) obéissent à la même règle que les nouvelles. Sans cela, abaisser un titre plus fort
  -- que le sien permettrait ensuite de le retirer.
  -- D4 : un seul ajustement à la fois par titre ; le second attend, puis voit la version que le premier a créée.
  perform 1 from titres where id = p_titre_id for update;
  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
    select ti.id into v_version from titres ti where ti.origine_id = p_titre_id and ti.lieu_id = v_lieu;
  end if;
  v_phrase := _refus_gestion(t.niveau, v_lieu, _cases_effectives(coalesce(v_version, p_titre_id)));
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  -- M7 : un nom nouveau ne reprend pas celui d'un titre de l'autre portée. Le nom se pose dans un centre (titre de centre, ou version d'un
  -- titre du réseau) : aucun titre du réseau non fixe ne le porte ; au réseau : aucun titre créé par un centre. Le titre lui-même, sa racine
  -- et ses versions sont écartés (une version garde le nom de son titre du réseau).
  if v_nom is not null then
    if v_lieu is not null then
      if exists (select 1 from titres r where r.lieu_id is null and not r.fixe and r.organisme_id = v_o and lower(r.nom) = lower(v_nom)
                    and coalesce(r.origine_id, r.id) <> t.racine) then
        raise exception 'titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';
      end if;
    elsif exists (select 1 from titres c where c.lieu_id is not null and c.origine_id is null and organisme_de_lieu(c.lieu_id) = v_o
                     and lower(c.nom) = lower(v_nom)
                     and coalesce(c.origine_id, c.id) <> t.racine) then
      raise exception 'titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';
    end if;
  end if;
  begin
    if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
      if v_version is null then
        -- La version du centre, avec le même nom ; les personnes de ce centre qui portaient le titre du réseau y passent.
        insert into titres (nom, niveau, lieu_id, origine_id, cases, cree_par)
        values (coalesce(v_nom, t.nom), t.niveau, v_lieu, p_titre_id, p_cases, v_moi) returning id into v_version;
        v_creee := true;
        if t.niveau = 'promo' then
          select array_agg(a.email order by a.promo_id), array_agg(a.promo_id order by a.promo_id) into v_emails, v_promos
            from affectations a join promos p on p.id = a.promo_id
           where a.role = 'formateur' and a.titre_id = p_titre_id and p.lieu_id = v_lieu;
          select count(distinct lower(e)) into v_bascules from unnest(coalesce(v_emails, '{}')) e;
          delete from affectations a using promos p
           where p.id = a.promo_id and a.role = 'formateur' and a.titre_id = p_titre_id and p.lieu_id = v_lieu;
          for i in 1..coalesce(cardinality(v_emails), 0) loop
            insert into affectations (email, role, promo_id, titre_id) values (v_emails[i], 'formateur', v_promos[i], v_version);
          end loop;
        else
          select array_agg(a.email) into v_emails from affectations a
           where a.role = 'direction' and a.titre_id = p_titre_id and a.lieu_id = v_lieu;
          v_bascules := coalesce(cardinality(v_emails), 0);
          delete from affectations a where a.role = 'direction' and a.titre_id = p_titre_id and a.lieu_id = v_lieu;
          for i in 1..coalesce(cardinality(v_emails), 0) loop
            insert into affectations (email, role, lieu_id, titre_id) values (v_emails[i], 'direction', v_lieu, v_version);
          end loop;
        end if;
      else
        update titres set nom = coalesce(v_nom, nom), cases = p_cases, modifie_le = now(), modifie_par = v_moi where id = v_version;
      end if;
      v_cible := v_version;
    else
      update titres set nom = coalesce(v_nom, nom), cases = p_cases, modifie_le = now(), modifie_par = v_moi where id = p_titre_id;
      v_cible := p_titre_id;
    end if;
  exception when unique_violation then
    -- D4 : la version du centre posée entre-temps par un autre chemin (index titres_version_unique) n'est pas un nom en double.
    get stacked diagnostics v_contrainte = constraint_name;
    if v_contrainte = 'titres_version_unique' then
      raise exception 'titres: Ce titre vient d''être ajusté pour ce centre par une autre personne : rouvrez-le, puis réessayez.';
    end if;
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object('titre_id', v_cible, 'version_creee', v_creee, 'porteurs_bascules', v_bascules);
end;
$function$;

create or replace function public.supprimer_titre(p_titre_id bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  t record;
  v_phrase text;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select ti.niveau, ti.fixe, ti.lieu_id as lieu_du_titre, ti.organisme_id as organisme_du_titre into t from titres ti where ti.id = p_titre_id;
  if t.niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  -- Un titre du réseau d'un autre organisme n'existe pas ici.
  v_o := case when t.lieu_du_titre is not null then organisme_de_lieu(t.lieu_du_titre) else organisme_courant() end;
  if t.organisme_du_titre is not null and v_o is not null and t.organisme_du_titre <> v_o then
    raise exception 'titres: Titre introuvable.';
  end if;
  if t.fixe then
    raise exception 'titres: Un titre fixe ne se supprime pas.';
  end if;
  v_phrase := _refus_gestion(t.niveau, t.lieu_du_titre, _cases_effectives(p_titre_id));
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  if exists (select 1 from affectations a where a.titre_id = p_titre_id) then
    raise exception 'titres: Ce titre est encore porté : retirez-le d''abord.';
  end if;
  delete from titres where id = p_titre_id;
end;
$function$;

create or replace function public.titres_visibles(p_lieu_id integer)
 returns table(id bigint, nom text, niveau text, lieu_id integer, fixe boolean, origine_id bigint, cases jsonb, porteurs integer, donnable boolean)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_o integer;
begin
  if auth.jwt() ->> 'email' is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_lieu_id is not null then
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) and not coalesce(siege_fixe(), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
    -- Le siège fixe ne lit que les centres de son organisme courant.
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) and not coalesce(organisme_de_lieu(p_lieu_id) = organisme_courant(), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
    v_o := organisme_de_lieu(p_lieu_id);
    -- Les titres fixes de promo et de centre, ceux du centre, et ceux du réseau (de son organisme) de niveau promo ou centre que le
    -- centre n'a pas remplacés par sa version.
    return query
      select t.id, t.nom, t.niveau, t.lieu_id, t.fixe, t.origine_id, _cases_effectives(t.id),
             (select count(distinct lower(a.email))::integer from affectations a
               where a.titre_id = t.id
                 and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = p_lieu_id))
                      or (a.role = 'direction' and a.lieu_id = p_lieu_id))),
             (select r.etat is null from _refus_titre(t.id, p_lieu_id, null, 'donner') r)
        from titres t
       where t.niveau in ('promo', 'centre')
         and (t.fixe or t.lieu_id = p_lieu_id
              or (t.lieu_id is null and t.organisme_id = v_o and not exists (select 1 from titres v where v.origine_id = t.id and v.lieu_id = p_lieu_id)))
       order by case t.niveau when 'promo' then 0 else 1 end, t.fixe desc, t.nom collate "C", t.id;
  else
    if not coalesce(geste_reseau('directions.lire'), false) then
      raise exception 'titres: Réservé au réseau.' using errcode = '42501';
    end if;
    -- Le réseau de l'organisme courant : les titres fixes et ses titres du réseau ; les porteurs comptés dans cet organisme seulement.
    v_o := organisme_courant();
    return query
      select t.id, t.nom, t.niveau, t.lieu_id, t.fixe, t.origine_id, _cases_effectives(t.id),
             (select count(distinct lower(a.email))::integer from affectations a
               where a.titre_id = t.id and coalesce(a.organisme_id, organisme_de_lieu(a.lieu_id), organisme_de_promo(a.promo_id)) = v_o),
             (select r.etat is null from _refus_titre(t.id, null, null, 'donner') r)
        from titres t
       where t.lieu_id is null and (t.fixe or t.organisme_id = v_o)
       order by case t.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, t.fixe desc, t.nom collate "C", t.id;
  end if;
end;
$function$;

create or replace function public.titres_ajustables(p_lieu_id integer)
 returns table(id bigint)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_fondateur boolean;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_lieu_id is not null then
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
  elsif not coalesce(geste_reseau('directions.lire'), false) then
    raise exception 'titres: Réservé au réseau.' using errcode = '42501';
  end if;
  -- L'organisme jugé : celui du centre, sinon l'organisme courant ; le fondateur, hors aperçu, n'y est exempté que sur cet organisme.
  v_o := case when p_lieu_id is not null then organisme_de_lieu(p_lieu_id) else organisme_courant() end;
  v_fondateur := coalesce(est_fondateur(), false) and fondateur_sur(v_o);
  return query
    select c.id
      from (select t.id, t.nom, t.niveau, t.lieu_id, coalesce(t.origine_id, t.id) as racine
              from titres t
             where not t.fixe
               and ((p_lieu_id is not null and t.niveau in ('promo', 'centre')
                     and (t.lieu_id = p_lieu_id
                          or (t.lieu_id is null and t.organisme_id = v_o and not exists (select 1 from titres v where v.origine_id = t.id and v.lieu_id = p_lieu_id))))
                    or (p_lieu_id is null and t.lieu_id is null and t.organisme_id = v_o))) c
     where _refus_gestion(c.niveau, case when c.niveau = 'reseau' then null else coalesce(c.lieu_id, p_lieu_id) end,
             _cases_effectives(coalesce((select v.id from titres v where v.origine_id = c.id and v.lieu_id = p_lieu_id), c.id))) is null
       and (v_fondateur or not exists (
             select 1 from affectations af join titres tt on tt.id = af.titre_id
              where lower(af.email) = v_moi and (tt.id = c.racine or tt.origine_id = c.racine)))
     order by case c.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, c.nom collate "C", c.id;
end;
$function$;

create or replace function public.personnes_et_titres(p_lieu_id integer DEFAULT NULL::integer, p_promo_id integer DEFAULT NULL::integer)
 returns table(email text, titre_id bigint, titre_nom text, niveau text, lieu_id integer, promo_ids integer[])
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_l integer;
  v_o integer;
begin
  if auth.jwt() ->> 'email' is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_promo_id is not null then
    -- Une promo : ses titres de promo et les titres de centre de son centre.
    v_l := lieu_de_promo(p_promo_id);
    if v_l is null or not (coalesce(geste_promo(p_promo_id, 'reglages.modifier'), false) or coalesce(geste_centre(v_l, 'equipe.lire'), false)) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
    return query
      select q.email, q.titre_id, q.titre_nom, q.niveau, q.lieu_id, q.promo_ids
        from (select lower(a.email) as email, t.id as titre_id, t.nom as titre_nom, t.niveau, v_l as lieu_id, array[a.promo_id] as promo_ids
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'formateur' and a.promo_id = p_promo_id
              union all
              select lower(a.email), t.id, t.nom, t.niveau, v_l, null::integer[]
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'direction' and a.lieu_id = v_l) q
       order by q.email collate "C", q.niveau, q.titre_nom collate "C";
  elsif p_lieu_id is not null then
    -- Un centre : ses titres de promo (promos groupées) et de centre.
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
    return query
      select q.email, q.titre_id, q.titre_nom, q.niveau, q.lieu_id, q.promo_ids
        from (select lower(a.email) as email, t.id as titre_id, t.nom as titre_nom, t.niveau, p_lieu_id as lieu_id,
                     array_agg(a.promo_id order by a.promo_id) as promo_ids
                from affectations a join promos pr on pr.id = a.promo_id join titres t on t.id = a.titre_id
               where a.role = 'formateur' and pr.lieu_id = p_lieu_id
               group by lower(a.email), t.id, t.nom, t.niveau
              union all
              select lower(a.email), t.id, t.nom, t.niveau, p_lieu_id, null::integer[]
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'direction' and a.lieu_id = p_lieu_id) q
       order by q.email collate "C", q.niveau, q.titre_nom collate "C";
  else
    -- Le réseau : les titres de centre (tous les centres) et du réseau, jamais ceux d'une promo.
    if not coalesce(geste_reseau('directions.lire'), false) then
      raise exception 'titres: Réservé au réseau.' using errcode = '42501';
    end if;
    -- Les directions des centres et les sièges de l'organisme courant seulement.
    v_o := organisme_courant();
    return query
      select q.email, q.titre_id, q.titre_nom, q.niveau, q.lieu_id, q.promo_ids
        from (select lower(a.email) as email, t.id as titre_id, t.nom as titre_nom, t.niveau, a.lieu_id as lieu_id, null::integer[] as promo_ids
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'direction' and organisme_de_lieu(a.lieu_id) = v_o
              union all
              select lower(a.email), t.id, t.nom, t.niveau, null::integer, null::integer[]
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'siege' and a.organisme_id = v_o) q
       order by q.email collate "C", q.niveau, q.titre_nom collate "C";
  end if;
end;
$function$;

create or replace function public.journal_des_droits(p_lieu_id integer DEFAULT NULL::integer)
 returns table(quand timestamp with time zone, par text, action text, pour text, titre_nom text, niveau text, lieu_id integer, promo_id integer, avant jsonb, apres jsonb)
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  if auth.jwt() ->> 'email' is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_lieu_id is not null then
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
  elsif not coalesce(geste_reseau('directions.lire'), false) then
    raise exception 'titres: Réservé au réseau.' using errcode = '42501';
  end if;
  -- La migration 4 (journal) peut ne pas être appliquée : aucune ligne, aucune erreur.
  if to_regclass('public.journal_droits') is null then
    return;
  end if;
  -- Un centre : les lignes de ce centre. Le réseau : les lignes de l'organisme courant, de niveau centre et réseau, jamais celles d'une
  -- promo ; le fondateur (hors aperçu, dans son organisme actif) lit toutes celles de cet organisme.
  return query execute
    'select j.quand, j.par, j.action, j.pour, j.titre_nom, j.niveau, j.lieu_id, j.promo_id, j.avant, j.apres
       from public.journal_droits j
      where j.quand >= now() - interval ''3 years''
        and (($1 is not null and j.lieu_id = $1)
             or ($1 is null and j.organisme_id = $3 and ($2 or j.niveau in (''centre'', ''reseau''))))
      order by j.quand desc, j.id desc'
    using p_lieu_id, coalesce(est_fondateur(), false) and fondateur_sur(organisme_courant()), organisme_courant();
end;
$function$;

create or replace function public.apercu_titre()
 returns bigint
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  brut text := nullif(current_setting('request.headers', true), '');
  entete text;
  v_role text;
  v_id bigint;
begin
  -- En-têtes illisibles : aucun aperçu par titre (PostgREST envoie toujours un JSON valide).
  if brut is null or not pg_input_is_valid(brut, 'jsonb') then
    return null;
  end if;
  entete := brut::jsonb ->> 'x-apercu-titre';
  -- Chiffres seuls (au plus 18 : jamais de dépassement de bigint).
  if entete is null or entete !~ '^[0-9]{1,18}$' then
    return null;
  end if;
  v_role := apercu_role();
  if v_role is null or v_role not in ('formateur', 'direction', 'siege') or not coalesce(fondateur_reel(), false) then
    return null;
  end if;
  select t.id into v_id
    from titres t
   where t.id = entete::bigint
     and t.niveau = case v_role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end
     and (t.lieu_id is null or t.lieu_id = lieu_courant())
     -- Un titre fixe, ou un titre de l'organisme actif du fondateur ; jamais celui d'un autre organisme.
     and (t.fixe or coalesce(t.organisme_id, organisme_de_lieu(t.lieu_id)) = organisme_actif_fondateur());
  return v_id;
end;
$function$;
-- 6. Les règles de lecture des centres et des affectations : le siège et le fondateur dans l'organisme de la ligne seulement.
alter policy lieux_lecture on public.lieux
  using ((exists (select 1 from public.promos p where p.lieu_id = lieux.id and peut_acceder_promo(p.id)))
         or est_direction(id)
         or ((select est_siege()) and dans_mon_organisme(organisme_id, null, null)));
alter policy affectations_lecture on public.affectations
  using ((lower(email) = lower((select auth.jwt() ->> 'email')))
         or ((select est_fondateur()) and dans_mon_organisme(organisme_id, lieu_id, promo_id))
         or (role = 'formateur' and (formateur_fixe(promo_id) or geste_centre(lieu_de_promo(promo_id), 'equipe.lire')
                                     or geste_centre(lieu_de_promo(promo_id), 'promos.lire')))
         or (role = 'direction' and (geste_centre(lieu_id, 'equipe.lire')
                                     or ((select geste_reseau('directions.lire')) and dans_mon_organisme(null, lieu_id, null))))
         or (role = 'siege' and (select siege_fixe()) and dans_mon_organisme(organisme_id, null, null)));

-- 7. Les droits des deux fonctions nouvelles : dans_mon_organisme pour les règles ; le déclencheur, aucun.
revoke all on function public.dans_mon_organisme(integer, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.dans_mon_organisme(integer, integer, integer) to authenticated;
revoke all on function public._habillage_reseau_miroir() from public, anon, authenticated, service_role;
