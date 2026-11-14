-- Aides des preuves de l'étape 2 et de l'étape 3 du chantier « titres et droits à la carte » (tests/sql/titres-gestion-preuve.sql,
-- tests/sql/titres-suite-preuve.sql) : les personnages de l'étape 2 (pg_temp.poser_titres_gestion, sortie telle quelle de la preuve de
-- gestion), le retrait des titres non fixes qui précède les retours (pg_temp.retirer_titres_non_fixes) et le groupe d5 commun aux deux
-- preuves (pg_temp.groupe_d5 : la garde D5 des retours 6 et 7).
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

-- Garde D5 (étape 3) : l'état que la preuve compare avant et après un retour, en texte : le md5 des définitions des fonctions données
-- (« absente » pour une fonction qui n'existe pas), triées collate "C", puis la présence de l'index titres_version_unique (migration 7).
create or replace function pg_temp.etat_des_fonctions(p_fonctions text[])
returns text language sql as $tgef$
  select md5(string_agg(coalesce(pg_get_functiondef(to_regprocedure(s)), 'absente ' || s), E'\n' order by s collate "C"))
         || ' / ' || coalesce(to_regclass('public.titres_version_unique')::text, 'sans index')
    from unnest(p_fonctions) s;
$tgef$;

-- Un retour joué en propriétaire dans une sous-transaction TOUJOURS annulée : « passe » (puis une levée défait tout ce qu'il a fait)
-- ou « ERREUR <état> <message> ». apres : l'état des fonctions juste après le retour, pris avant l'annulation quand il passe (il le
-- change) ; quand il est refusé, pris après l'annulation de la sous-transaction, donc toujours l'état de départ, où que soit la garde
-- dans le texte (sa place se contrôle à part, sur le texte, dans pg_temp.groupe_d5). p_retirer : les affectations des titres non fixes partent d'abord (dans la même sous-transaction,
-- donc annulées elles aussi). Rien ne reste : les personnages gardent leurs titres pour les groupes suivants.
create or replace function pg_temp.essayer_retour(p_texte text, p_fonctions text[], p_retirer boolean,
  out etat text, out apres text, out retirees integer)
language plpgsql as $tger$
begin
  retirees := 0;
  perform pg_temp.proprio();
  begin
    if p_retirer then
      retirees := pg_temp.retirer_titres_non_fixes();
    end if;
    execute p_texte;
    etat := 'passe';
    apres := pg_temp.etat_des_fonctions(p_fonctions);
    raise exception 'preuve d5 : essai annulé';
  exception when others then
    if etat is null then
      etat := 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 300);
      apres := pg_temp.etat_des_fonctions(p_fonctions);
    end if;
  end;
  perform pg_temp.proprio();
end $tger$;

-- Groupe d5 (preuve de gestion : retour 6 ; preuve de la suite : retour 7) : tant qu'une affectation porte un titre non fixe, le retour
-- s'arrête dès sa première instruction avec la phrase D5 et rien n'est changé ; les affectations retirées, il passe. p_prefixe : le nom
-- de la migration dans la phrase (titres_6_gestion_retour, titres_7_correctifs_retour) ; p_fonctions : les fonctions que le retour réécrit.
create or replace function pg_temp.groupe_d5(p_nom text, p_texte text, p_prefixe text, p_fonctions text[])
returns void language plpgsql as $tgd5$
declare
  v_n integer;
  v_avant text;
  r record;
  v_premieres text[];
begin
  perform pg_temp.proprio();
  -- 0. La garde est la première instruction qui agit : hors lignes vides et commentaires, le texte commence par le lock_timeout (qui ne
  --    change aucun état) puis par le bloc de la garde (délimiteur écrit en morceaux : il ne doit pas figurer tel quel dans ce fichier).
  v_premieres := array(select s.l from (select btrim(x) as l, n from unnest(string_to_array(p_texte, E'\n')) with ordinality u(x, n)) s
                        where s.l <> '' and s.l not like '--%' order by s.n limit 2);
  perform pg_temp.attendre('d5', p_nom || ' : la garde D5 est la première instruction qui agit (seul le lock_timeout la précède)',
    array_to_string(v_premieres, ' | '), 'set local lock_timeout = ''3s''; | do $' || 'garde_d5' || '$');
  select count(*) into v_n from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe;
  perform pg_temp.verifier('d5', 'départ : des affectations portent un titre non fixe (jamais un contrôle à vide)', v_n > 0, v_n::text);
  v_avant := pg_temp.etat_des_fonctions(p_fonctions);
  perform pg_temp.verifier('d5', 'départ : les fonctions réécrites par le ' || p_nom || ' existent', v_avant not like '%absente%', v_avant);
  -- 1. Joué tant qu'ils sont portés : refusé avec la phrase D5, rien n'est changé.
  select * into r from pg_temp.essayer_retour(p_texte, p_fonctions, false);
  perform pg_temp.attendre('d5', p_nom || ' joué tant qu''un titre non fixe est porté : refusé avec la phrase D5', r.etat,
    format('ERREUR P0001 %s : %s affectation(s) portent un titre non fixe ; les retirer d''abord (page Équipe ou Directions de centre) ; rien n''est changé',
      p_prefixe, v_n));
  perform pg_temp.attendre('d5', p_nom || ' refusé : la sous-transaction annulée, définitions et index sont ceux de départ (md5)', r.apres, v_avant);
  -- 2. Les affectations des titres non fixes retirées (en propriétaire), le même retour passe et défait la migration.
  select * into r from pg_temp.essayer_retour(p_texte, p_fonctions, true);
  perform pg_temp.attendre('d5', 'retirer_titres_non_fixes() puis ' || p_nom || ' : passe, après le retrait de toutes les affectations',
    r.etat || ' / ' || r.retirees, 'passe / ' || v_n);
  perform pg_temp.verifier('d5', p_nom || ' passé : les définitions ont changé (la migration est défaite)', r.apres is distinct from v_avant,
    'avant ' || v_avant || ' ; après ' || coalesce(r.apres, 'nul'));
  -- 3. L'essai est annulé : affectations et fonctions comme au départ (les groupes suivants les retrouvent).
  perform pg_temp.attendre('d5', 'essais annulés : affectations des titres non fixes et fonctions comme au départ',
    (select count(*) from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe)::text || ' / '
      || pg_temp.etat_des_fonctions(p_fonctions), v_n::text || ' / ' || v_avant);
end $tgd5$;
