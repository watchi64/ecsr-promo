-- Retour de 20261124_epcf_ccp2_reseau : comptes_reseau() telle que 20261108_espaces_1_siege l'a posée (CCP1 seul, md5
-- d3264862c795668c0ed918c4cc99ea94). Aucune donnée n'est touchée.

set local lock_timeout = '3s';

do $garde$
declare
  v_oid regprocedure := to_regprocedure('public.comptes_reseau()');
begin
  if v_oid is null then
    raise exception 'epcf_ccp2_reseau_retour : public.comptes_reseau() n''existe pas ; rien n''est changé';
  end if;
  if (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = v_oid) <> '8ae4d15b047be60a41262f71588d9c6e' then
    raise exception 'epcf_ccp2_reseau_retour : le corps de public.comptes_reseau() n''est pas celui de 20261124_epcf_ccp2_reseau ; rien n''est changé';
  end if;
end $garde$;

create or replace function public.comptes_reseau()
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
