-- Lot 5 (direction et siège), étape 1 : ce dont le siège a besoin en base.
--   1. lieux.demonstration : le centre de démonstration (lieu 4) se reconnaît à une colonne, pour que le total du réseau
--      l'écarte. Aucune écriture directe : la table lieux n'a, pour authenticated, que le droit de lecture.
--   2. La séquence de lieux.id est recalée sur le plus grand identifiant : les lieux 3 et 4 ont été posés à la main, hors
--      migration, sans faire avancer la séquence ; sans ce recalage, le prochain centre créé prendrait l'identifiant 3 ou 4.
--   3. comptes_reseau() : une ligne par centre, des comptes additifs sur ses promos en cours, calculés ici. Ni nom de
--      personne, ni adresse, ni identifiant de stagiaire ou de promo, ni chiffre par promo. Un centre qui a moins de 5
--      stagiaires en formation sur ses promos en cours est masqué : toutes les colonnes après « masque » sont nulles.
--      Réservée au siège (le fondateur hors aperçu, ou en aperçu siège, y est compris : est_siege()).
--   4. creer_centre(p_nom) : crée un centre, réservée au siège ; rend son identifiant.
-- Les définitions sont celles de js/centre-stats.js (METHODES) et js/comptes-reseau.js, que la fixture
-- tests/fixtures/comptes-promo.json fait jouer des deux côtés. Pour chaque promo en cours, une ligne de donnée compte si
-- son promo_id est cette promo ET si son stagiaire est une fiche active de cette promo.
--   Promo en cours : date_debut <= aujourd'hui et (date_fin nulle ou >= aujourd'hui).
--   Passages : type Salle ou Voiture ; absences = résultat Absence ; prévus = Effectué ou Absence.
--   QCM : entraînement = somme de score et de total ; examens = tentatives en mode examen, réussies quand note_20 atteint
--   le seuil du QCM (15 s'il n'en a pas). Notes : note non nulle, barème non nul, ramenées sur 20. EPCF : par stagiaire et
--   par trame (salle, véhicule), la dernière évaluation de contexte EPCF qui n'est pas une auto-évaluation et qui a une
--   date (date_eval décroissante, puis id décroissant) ; acquis = scores A, renseignés = scores A, R ou NA.
-- Aucune table nouvelle, aucune règle de sécurité modifiée, aucune donnée écrite sauf demonstration du lieu 4.
-- Marche arrière : 20261108_espaces_1_siege_retour.sql (la séquence recalée n'est pas remise : elle ne gêne rien).
-- Preuve : tests/sql/espaces-preuve.sql.
set local lock_timeout = '3s';

-- 1. lieux.demonstration -------------------------------------------------------------------------------------------

alter table public.lieux add column demonstration boolean not null default false;

do $garde$
declare n integer;
begin
  update public.lieux set demonstration = true where id = 4;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'espaces_1_siege : le lieu 4 (centre de démonstration) doit exister, exactement une ligne, % trouvée(s)', n;
  end if;
end
$garde$;

-- 2. Séquence de lieux.id ------------------------------------------------------------------------------------------

-- Jamais en arrière : le plus grand de la valeur actuelle de la séquence et du plus grand identifiant.
select setval(pg_get_serial_sequence('public.lieux', 'id'),
              greatest((select last_value from public.lieux_id_seq), (select coalesce(max(id), 1) from public.lieux)));

-- 3. comptes_reseau() ----------------------------------------------------------------------------------------------

create function public.comptes_reseau()
 returns table(lieu_id integer, lieu_nom text, demonstration boolean, promos_en_cours integer, masque boolean,
               inscrits integer, en_formation integer, abandons integer, absences integer, prevus integer,
               qcm_bonnes integer, qcm_questions integer, examens_passes integer, examens_reussis integer,
               notes_n integer, notes_somme numeric, notes_sous10 integer, epcf_acquis integer, epcf_renseignes integer)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  if not coalesce((select est_siege()), false) then
    raise exception 'reseau: Réservé au siège.' using errcode = '42501';
  end if;
  return query
  with en_cours as (
    select pr.id as pid, pr.lieu_id as lid
      from promos pr
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
    select distinct on (a.sid, x.trame) a.lid, x.scores
      from epcf_evaluations x join actives a on a.sid = x.stagiaire_id and a.pid = x.promo_id
     where x.trame in ('salle', 'vehicule') and x.contexte = 'EPCF' and x.auto_eval is not true and x.date_eval is not null
     order by a.sid, x.trame, x.date_eval desc, x.id desc
  ),
  par_epcf as (
    select d.lid,
           count(*) filter (where v.value = 'A') as acquis,
           count(*) filter (where v.value in ('A', 'R', 'NA')) as renseignes
      from dernieres d
     cross join lateral jsonb_each_text(case when jsonb_typeof(d.scores) = 'object' then d.scores else '{}'::jsonb end) v
     group by d.lid
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

revoke all on function public.comptes_reseau() from public, anon, service_role;
grant execute on function public.comptes_reseau() to authenticated;

-- 4. creer_centre(p_nom) -------------------------------------------------------------------------------------------

create function public.creer_centre(p_nom text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_nom text := btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g'));
  v_id integer;
begin
  if not coalesce((select est_siege()), false) then
    raise exception 'centre: Réservé au siège.' using errcode = '42501';
  end if;
  if v_nom = '' then
    raise exception 'centre: Le nom est requis.';
  end if;
  -- Deux créations simultanées (« Foo » et « FOO ») ne passent pas le contrôle de doublon en même temps : la seconde
  -- attend la fin de la première, puis voit son centre. Verrou de transaction, relâché au commit.
  perform pg_advisory_xact_lock(2026110801);
  if exists (select 1 from lieux l where lower(l.nom) = lower(v_nom)) then
    raise exception 'centre: Ce centre existe déjà.';
  end if;
  begin
    insert into lieux (nom) values (v_nom) returning id into v_id;
  exception when unique_violation then
    raise exception 'centre: Ce centre existe déjà.';
  end;
  return v_id;
end;
$function$;

revoke all on function public.creer_centre(text) from public, anon, service_role;
grant execute on function public.creer_centre(text) to authenticated;
