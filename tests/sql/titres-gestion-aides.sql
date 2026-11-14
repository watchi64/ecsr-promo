-- Aides des preuves de l'étape 2 et de l'étape 3 du chantier « titres et droits à la carte » (tests/sql/titres-gestion-preuve.sql,
-- tests/sql/titres-suite-preuve.sql) : les personnages de l'étape 2 (pg_temp.poser_titres_gestion, sortie telle quelle de la preuve de
-- gestion) et le retrait des titres non fixes qui précède les retours (pg_temp.retirer_titres_non_fixes).
-- INCLUSION : l'assembleur (outils/assembler_repetition_roles.mjs) colle ce fichier tel quel, après tests/sql/roles-aides.sql et
-- tests/sql/titres-aides.sql (il appelle calcul, affecter et la table perso de ces deux fichiers) ; il ne porte donc aucun marqueur
-- d'assemblage. Ne se joue pas seul.

-- Les personnages de l'étape 2, posés en propriétaire après ceux de titres-aides.sql (poser_perso, poser_titres_gestes) : une promo
-- « Preuve8 promo A » dans le centre de la promo 1 ; quatre titres non fixes (t_chef et t_vide au centre de la promo 1, t_qualite et
-- t_dirs au réseau), chacun porté par un compte ; cinq adresses libres (x, y, z, u, v : ni profil ni affectation) et un orphelin (profil
-- de stagiaire sans fiche). Le champ info de pg_temp.perso porte l'identifiant du titre pour les quatre premiers.
create or replace function pg_temp.poser_titres_gestion()
returns void language plpgsql as $tpgs$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_chef text; v_vide text; v_qualite text; v_dirs text;
begin
  insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values (990801, v_l1, 'Preuve8 promo A', current_date - 20, null);
  insert into perso (ordre, nom, email, role) values
    (40, 't_chef', 'preuve8.t.chef@exemple.invalid', 'prof'),
    (41, 't_vide', 'preuve8.t.vide@exemple.invalid', 'prof'),
    (42, 't_qualite', 'preuve8.t.qualite@exemple.invalid', 'prof'),
    (43, 't_dirs', 'preuve8.t.dirs@exemple.invalid', 'prof'),
    (50, 'x', 'preuve8.x@exemple.invalid', 'prof'),
    (51, 'y', 'preuve8.y@exemple.invalid', 'prof'),
    (52, 'z', 'preuve8.z@exemple.invalid', 'prof'),
    (53, 'u', 'preuve8.u@exemple.invalid', 'prof'),
    (54, 'v', 'preuve8.v@exemple.invalid', 'prof'),
    (55, 'orphelin', 'preuve8.orphelin@exemple.invalid', 'stagiaire');
  insert into public.user_profiles (email, role, is_admin, stagiaire_id)
    select email, role, false, null from perso where nom in ('t_chef', 't_vide', 't_qualite', 't_dirs', 'orphelin');
  -- Un camarade de la promo 1 qui a masqué ses notes (anonymous_notes), posé en propriétaire.
  declare v_fiche_anon integer;
  begin
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve8 anonyme', 'PREUVE', 991, 1) returning id into v_fiche_anon;
    insert into public.user_profiles (email, role, is_admin, stagiaire_id, anonymous_notes)
      values ('preuve8.anonyme@exemple.invalid', 'stagiaire', false, v_fiche_anon, true);
  end;
  v_chef := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve8 chef de centre'', ''centre'', %s, %L::jsonb, ''preuve'') returning id::text',
    v_l1, '{"promos":"voir","stagiaires":"voir","equipe":"modifier"}'));
  v_vide := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve8 titre vide'', ''centre'', %s, %L::jsonb, ''preuve'') returning id::text',
    v_l1, '{}'));
  v_qualite := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve8 qualité'', ''reseau'', null, %L::jsonb, ''preuve'') returning id::text',
    '{"cours":"voir","directions":"voir"}'));
  v_dirs := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve8 directions'', ''reseau'', null, %L::jsonb, ''preuve'') returning id::text',
    '{"cours":"voir","directions":"modifier"}'));
  update perso set info = case nom when 't_chef' then v_chef when 't_vide' then v_vide when 't_qualite' then v_qualite else v_dirs end
    where nom in ('t_chef', 't_vide', 't_qualite', 't_dirs');
  perform pg_temp.affecter((select email from perso where nom = 't_chef'), 'direction', null, v_l1, v_chef);
  perform pg_temp.affecter((select email from perso where nom = 't_vide'), 'direction', null, v_l1, v_vide);
  perform pg_temp.affecter((select email from perso where nom = 't_qualite'), 'siege', null, null, v_qualite);
  perform pg_temp.affecter((select email from perso where nom = 't_dirs'), 'siege', null, null, v_dirs);
end $tpgs$;

-- Avant les retours : en propriétaire, les affectations dont le titre n'est pas fixe partent. Chaque retour de 6, 7, 8 et 9 commence par
-- une garde (D5) qui refuse de se jouer tant qu'une personne porte un titre non fixe ; la preuve les retire donc juste avant le premier
-- retour. Les titres eux-mêmes restent. Rend le nombre de lignes retirées.
create or replace function pg_temp.retirer_titres_non_fixes()
returns integer language plpgsql as $trnf$
declare v_n integer;
begin
  perform pg_temp.proprio();
  delete from public.affectations a using public.titres t where t.id = a.titre_id and not t.fixe;
  get diagnostics v_n = row_count;
  return v_n;
end $trnf$;
