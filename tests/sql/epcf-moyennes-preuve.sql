-- Preuve du k-anonymat des moyennes EPCF dans la base : seuil de 3 stagiaires (migration 20261110_epcf_moyennes_seuil_3,
-- qui remplace le seuil de 2 de 20261109_epcf_moyennes_anonymat).
-- Rejouable à volonté : le bloc lève TOUJOURS une exception à la fin, qui annule toutes les données de test et porte le
-- verdict (« VERT n/0 » ou « ROUGE n/k : ... »), suivi de l'empreinte md5 de la fonction telle que le bloc l'a vue.
-- Données 100 % fictives (adresses en example.invalid, promo 9997) : aucun compte réel ici.
--
-- Essai à blanc avant d'appliquer : remplacer la ligne « -- MIGRATION » ci-dessous par
--   execute $migration$ <le create or replace function de la migration> $migration$;
-- (outils/assembler_preuve_epcf.mjs le fait) ; la levée finale annule aussi la migration. Contre la fonction d'avant la
-- migration (seuil de 2), les contrôles des stagiaires sont ROUGES sur PREP2 et COND1 : c'est le cas que la migration
-- ferme. Après application, la preuve jouée telle quelle est VERTE et l'empreinte rendue égale celle de l'essai à blanc.
--
-- Le jeu : quatre stagiaires de la promo fictive. Salle : PREP1 évalué chez trois (A, NA, R : moyenne 1, effectif 3),
-- PREP2 chez deux (R, A : 1,5, effectif 2), PREP3 chez un seul (A : 2, effectif 1). Véhicule : COND1 chez deux (A, NA :
-- 1, effectif 2) ; l'auto-évaluation du troisième ne compte pas. L'équipe (formateur de la promo, direction du lieu)
-- lit tout ; un stagiaire, évalué ou non, ne lit que PREP1, comme l'équipe dans l'aperçu « Voir en tant que »
-- stagiaire ; un visiteur sans compte n'a pas le droit d'appeler la fonction.

set local lock_timeout = '3s';

do $preuve$
declare
  v_promo integer := 9997;
  v_lieu integer;
  e_s1 text := 'preuve.epcf.s1@example.invalid';            -- évalué partout
  e_s2 text := 'preuve.epcf.s2@example.invalid';            -- évalué en salle (PREP1, PREP2) et en véhicule
  e_s3 text := 'preuve.epcf.s3@example.invalid';            -- évalué en salle (PREP1), auto-évaluation en véhicule
  e_s4 text := 'preuve.epcf.s4@example.invalid';            -- pas évalué
  e_form text := 'preuve.epcf.formateur@example.invalid';   -- formateur de la promo
  e_dir text := 'preuve.epcf.direction@example.invalid';    -- direction du lieu
  s1 integer; s2 integer; s3 integer; s4 integer;
  r record; obtenu text; v text;
  ok integer := 0; ko text[] := '{}';
  equipe_salle constant text := 'PREP1:1.000:3,PREP2:1.500:2,PREP3:2.000:1';
  equipe_vehicule constant text := 'COND1:1.000:2';
  stagiaire_salle constant text := 'PREP1:1.000:3';
begin
  -- MIGRATION

  -- Données fictives ------------------------------------------------------------------
  select id into v_lieu from lieux order by id limit 1;
  insert into promos (id, lieu_id, nom, date_debut) values (v_promo, v_lieu, 'Preuve moyennes EPCF', current_date);
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveS1', 'EPCF', 991, v_promo, true) returning id into s1;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveS2', 'EPCF', 992, v_promo, true) returning id into s2;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveS3', 'EPCF', 993, v_promo, true) returning id into s3;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveS4', 'EPCF', 994, v_promo, true) returning id into s4;
  insert into user_profiles (email, role, stagiaire_id) values
    (e_s1, 'stagiaire', s1), (e_s2, 'stagiaire', s2), (e_s3, 'stagiaire', s3), (e_s4, 'stagiaire', s4);
  insert into user_profiles (email, role, is_admin) values (e_form, 'prof', true), (e_dir, 'prof', false);
  insert into affectations (email, role, promo_id) values (e_form, 'formateur', v_promo);
  insert into affectations (email, role, lieu_id) values (e_dir, 'direction', v_lieu);
  insert into epcf_evaluations (stagiaire_id, trame, date_eval, scores, auto_eval, promo_id) values
    (s1, 'salle', current_date - 3, '{"PREP1": "A", "PREP2": "R", "PREP3": "A"}', false, v_promo),
    (s2, 'salle', current_date - 2, '{"PREP1": "NA", "PREP2": "A"}', false, v_promo),
    (s3, 'salle', current_date - 1, '{"PREP1": "R"}', false, v_promo),
    (s1, 'vehicule', current_date - 2, '{"COND1": "A"}', false, v_promo),
    (s2, 'vehicule', current_date - 1, '{"COND1": "NA"}', false, v_promo),
    (s3, 'vehicule', current_date, '{"COND1": "A"}', true, v_promo);

  -- Ce que chaque personnage reçoit, épreuve par épreuve (critère:moyenne:effectif, triés) --
  for r in select * from (values
    (e_form, 'salle', '', equipe_salle), (e_form, 'vehicule', '', equipe_vehicule),
    (e_dir, 'salle', '', equipe_salle), (e_dir, 'vehicule', '', equipe_vehicule),
    (e_s1, 'salle', '', stagiaire_salle), (e_s1, 'vehicule', '', ''),
    (e_s2, 'salle', '', stagiaire_salle), (e_s2, 'vehicule', '', ''),
    (e_s3, 'salle', '', stagiaire_salle), (e_s3, 'vehicule', '', ''),
    (e_s4, 'salle', '', stagiaire_salle), (e_s4, 'vehicule', '', ''),
    (e_form, 'salle', 'stagiaire', stagiaire_salle), (e_form, 'vehicule', 'stagiaire', ''),
    (e_dir, 'salle', 'stagiaire', stagiaire_salle), (e_dir, 'vehicule', 'stagiaire', '')
  ) as t(email, trame, apercu, attendu)
  loop
    perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
    perform set_config('request.headers', (case when r.apercu = '' then json_build_object('x-promo-id', v_promo::text)
      else json_build_object('x-promo-id', v_promo::text, 'x-apercu-role', r.apercu) end)::text, true);
    set local role authenticated;
    begin
      select coalesce(string_agg(m.critere || ':' || m.moyenne || ':' || m.effectif, ',' order by m.critere), '')
        into obtenu from public.epcf_moyennes(r.trame) m;
    exception when others then obtenu := 'erreur ' || sqlerrm;
    end;
    reset role;
    if obtenu = r.attendu then ok := ok + 1;
    else ko := ko || format('%s%s, %s : « %s », attendu « %s »', split_part(r.email, '@', 1),
      case when r.apercu = '' then '' else ' (aperçu ' || r.apercu || ')' end, r.trame, obtenu, r.attendu);
    end if;
  end loop;

  -- Un visiteur sans compte : refusé -------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
  set local role anon;
  begin
    perform public.epcf_moyennes('salle');
    v := 'exécutée';
  exception when insufficient_privilege then v := 'refusée';
  when others then v := 'erreur ' || sqlstate;
  end;
  reset role;
  if v = 'refusée' then ok := ok + 1; else ko := ko || ('moyennes par un visiteur : ' || v); end if;

  v := md5(pg_get_functiondef('public.epcf_moyennes(text)'::regprocedure));
  if cardinality(ko) = 0 then
    raise exception 'VERT %/0 (empreinte %)', ok, v;
  else
    raise exception 'ROUGE %/% (empreinte %) : %', ok, cardinality(ko), v, array_to_string(ko, ' | ');
  end if;
end $preuve$;
