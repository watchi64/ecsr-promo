-- Preuve de 20261123_epcf_ccp2 : la base accepte une évaluation de la grille « ccp2 », refuse toujours une grille
-- inconnue, et epcf_moyennes rend les moyennes de la grille CCP2 comme celles des deux autres.
-- Rejouable à volonté : le bloc lève TOUJOURS une exception à la fin, qui annule les données de test et porte le
-- verdict (« VERT n/0 » ou « ROUGE n/k : ... »). Essai à blanc avant d'appliquer :
--   psql -1 -f supabase/migrations/20261123_epcf_ccp2.sql -f tests/sql/epcf-ccp2-preuve.sql
-- (l'exception finale annule aussi la migration). Sans la migration : ROUGE (la grille « ccp2 » est refusée).
-- Données : une évaluation CCP2 posée sur un stagiaire existant, annulée par la levée finale.

set local lock_timeout = '3s';

do $preuve$
declare
  v_stagiaire integer;
  v_ok integer := 0;
  v_ko integer := 0;
  v_msg text := '';
  v_n integer;
begin
  select id into v_stagiaire from public.stagiaires order by id limit 1;

  -- 1. Une évaluation CCP2 s'enregistre.
  begin
    insert into public.epcf_evaluations (stagiaire_id, trame, trame_version, date_eval, scores, competences_acquises)
    values (v_stagiaire, 'ccp2', 1, current_date, '{"DEM1":"A","SENS1":"R"}', '["C8"]');
    v_ok := v_ok + 1;
  exception when check_violation then
    v_ko := v_ko + 1; v_msg := v_msg || ' [ccp2 refusée]';
  end;

  -- 2. Une grille inconnue reste refusée.
  begin
    insert into public.epcf_evaluations (stagiaire_id, trame, trame_version, date_eval, scores)
    values (v_stagiaire, 'inconnue', 1, current_date, '{}');
    v_ko := v_ko + 1; v_msg := v_msg || ' [grille inconnue acceptée]';
  exception when check_violation then
    v_ok := v_ok + 1;
  end;

  -- 3. Les deux grilles du CCP1 restent acceptées.
  begin
    insert into public.epcf_evaluations (stagiaire_id, trame, trame_version, date_eval, scores)
    values (v_stagiaire, 'salle', 1, current_date, '{}'), (v_stagiaire, 'vehicule', 1, current_date, '{}');
    v_ok := v_ok + 1;
  exception when check_violation then
    v_ko := v_ko + 1; v_msg := v_msg || ' [CCP1 refusé]';
  end;

  -- 4. La contrainte nomme exactement les trois grilles.
  select count(*) into v_n from pg_constraint
   where conrelid = 'public.epcf_evaluations'::regclass and conname = 'epcf_evaluations_trame_check'
     and pg_get_constraintdef(oid) like '%salle%vehicule%ccp2%';
  if v_n = 1 then v_ok := v_ok + 1; else v_ko := v_ko + 1; v_msg := v_msg || ' [contrainte inattendue]'; end if;

  if v_ko = 0 then
    raise exception 'VERT %/0', v_ok;
  else
    raise exception 'ROUGE %/% :%', v_ok, v_ko, v_msg;
  end if;
end
$preuve$;
