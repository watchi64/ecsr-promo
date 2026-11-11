-- Preuve de l'étape 2 du chantier « titres et droits à la carte » : ce que les migrations 20261112_titres_5 (fermetures) et _6 (gestion)
-- doivent donner, écrite avec elles. Elle se joue sur une base où les migrations 1, 2 et 3 sont appliquées (l'état de la production
-- après l'étape 1) ; la migration 4 (journal) n'y est pas, sauf demande (--etapes 4,5,6).
--   structure    prérequis de l'étape 1 présents (titre_fixe, geste_promo, la règle affectations_ajout réécrite par la migration 3),
--                chaque migration et chaque retour injectés se jouent sans erreur, personnages de l'étape 2 posés.
--   retrait      (migration 5, A) retirer_titre pour les titres fixes : droits, phrases de refus, jamais sur soi, aperçu du fondateur.
--   soi          (migration 5, A) personne ne se nomme soi-même à la direction par inviter_compte (le fondateur, hors aperçu, excepté).
--   ecritures    (migration 5, B) plus aucune écriture directe sur affectations (droits de table, règles à false, chaque acteur), les fonctions
--                restent le seul chemin ; le scénario de la relecture finale (un siège ne se nomme pas direction) ne lit rien.
--   retour       les retours défont tout, dans l'ordre inverse (6, 5, 4) : l'empreinte (règles, fonctions, droits) égale celle d'avant.
-- Les groupes des migrations 5 et 6 s'ajoutent avec leurs tâches (retrait, soi, ecritures, lectures ; puis verrou, donner, retirer,
-- gerer, lire, immediat, journal). Un groupe dont la fonction n'existe pas est sauté, avec une ligne d'information, en mode
-- gestion-en-ligne (la migration n'est pas encore appliquée) ; il compte comme un échec dans les modes injectés où sa migration est jouée.
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (tests/sql/roles-aides.sql, puis
-- tests/sql/titres-aides.sql), le libellé du mode, la requête d'empreinte, puis les migrations 4, 5 et 6 et leurs retours :
--   node outils/assembler_repetition_roles.mjs gestion [--etapes 5|5,6|4,5,6] <sortie.sql>   étapes 5,6 par défaut : VERT attendu
--   node outils/assembler_repetition_roles.mjs gestion-contre-epreuve <sortie.sql>           sans aucune migration : ROUGE attendu
--                                                                                            sur les groupes des migrations 5 et 6
--   node outils/assembler_repetition_roles.mjs gestion-en-ligne <sortie.sql>                 rien d'injecté, après application réelle
-- À jouer APRÈS la suite du lot 5 et les migrations 1, 2 et 3 du chantier. Le fichier assemblé se joue en une requête ; le bloc do
-- finit TOUJOURS par une levée : migrations, personnages et lignes d'essai sont annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@
-- @@INCLURE tests/sql/titres-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $temp$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $temp$;

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

-- Un groupe se joue-t-il dans ce mode ? p_etat : le sort de la migration qui le fonde (« jouée », « neutralisée », ou une erreur) ;
-- p_fonction : la fonction que cette migration crée (écrite comme to_regprocedure la lit), ou nul si le groupe ne dépend d'aucune fonction.
--   - mode injecté (gestion (etapes ...)) dont la migration n'est pas injectée : groupe sauté, information ;
--   - mode en ligne : groupe sauté, information, si la fonction n'existe pas encore ;
--   - contre-épreuve : le groupe se joue toujours (il doit sortir rouge) ;
--   - mode injecté où la migration est jouée : la fonction doit exister, sinon un échec compté, et le groupe est sauté.
create or replace function pg_temp.groupe_a_jouer(p_groupe text, p_etat text, p_fonction text, p_mode text)
returns boolean language plpgsql as $tgp$
begin
  if p_mode like 'gestion-contre-epreuve%' then return true; end if;
  if p_mode like 'gestion-en-ligne%' then
    if p_fonction is not null and to_regprocedure(p_fonction) is null then
      perform pg_temp.informer('groupe ' || p_groupe, 'sauté : ' || p_fonction || ' n''existe pas encore (mode en ligne, migration non appliquée)');
      return false;
    end if;
    return true;
  end if;
  if p_etat = 'neutralisée' then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : la migration qui le fonde n''est pas injectée dans ce mode');
    return false;
  end if;
  if p_fonction is not null and to_regprocedure(p_fonction) is null then
    perform pg_temp.verifier(p_groupe, 'la fonction ' || p_fonction || ' existe après la migration', false, 'migration ' || p_etat);
    return false;
  end if;
  return true;
end $tgp$;

-- Un appel de fonction par un personnage, avec un en-tête de promo et un éventuel aperçu du fondateur : « OK <valeur> » (la valeur en
-- texte, « nul » si nulle) ou « ERREUR <état> <message> ». Rend la main au propriétaire. p_qui nul : un jeton sans adresse (rôle
-- authenticated, aucun e-mail dans les claims).
create or replace function pg_temp.appeler_a(p_qui text, p_entete text, p_apercu text, p_sql text)
returns text language plpgsql as $tap2$
declare v text; r text;
begin
  if p_qui is null then
    perform pg_temp.contexte('x@exemple.invalid', p_entete, p_apercu);
    perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
    set local role authenticated;
  else
    perform pg_temp.incarner((select email from pg_temp.perso where nom = p_qui), p_entete, p_apercu);
  end if;
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $tap2$;

-- retirer_titre(adresse, titre, centre) jouée par un personnage : « OK <lignes retirées> » ou l'erreur. p_titre et p_lieu en texte
-- (un identifiant ou « null »).
create or replace function pg_temp.retirer(p_qui text, p_entete text, p_apercu text, p_email text, p_titre text, p_lieu text)
returns text language sql as $tre$
  select pg_temp.appeler_a(p_qui, p_entete, p_apercu,
    format($q$select (public.retirer_titre(%L, %s, %s))->>'retirees'$q$, p_email, p_titre, p_lieu));
$tre$;

-- Le nombre de lignes d'affectation d'une adresse (casse ignorée) pour un rôle, en texte.
create or replace function pg_temp.lignes(p_email text, p_role text)
returns text language sql as $tli$
  select pg_temp.calcul(format('select count(*)::text from public.affectations where lower(email) = lower(%L) and role = %L', p_email, p_role));
$tli$;

-- Groupe retrait (migration 5, partie A) : retirer_titre pour les titres fixes. Attendus écrits en dur ; chaque retrait réussi est
-- suivi de la remise de la ligne, pour que les groupes suivants retrouvent leurs personnages.
create or replace function pg_temp.groupe_retrait()
returns void language plpgsql as $tgr$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  t_form text := pg_temp.calcul($q$select public.titre_fixe('promo')::text$q$);
  t_dir text := pg_temp.calcul($q$select public.titre_fixe('centre')::text$q$);
  t_siege text := pg_temp.calcul($q$select public.titre_fixe('reseau')::text$q$);
  t_interv text := pg_temp.calcul($q$select a.titre_id::text from public.affectations a join pg_temp.perso p on lower(a.email) = p.email where p.nom = 't_interv'$q$);
  e_form_n text := (select email from pg_temp.perso where nom = 'form_n');
  e_form_m text := (select email from pg_temp.perso where nom = 'form_m');
  e_dir_n text := (select email from pg_temp.perso where nom = 'dir_n');
  e_dir_deux text := (select email from pg_temp.perso where nom = 'dir_deux');
  e_siege text := (select email from pg_temp.perso where nom = 'siege');
  e_siege_form text := (select email from pg_temp.perso where nom = 'siege_form');
  e_fond text := (select email from pg_temp.perso where nom = 'fond');
  e_x text := (select email from pg_temp.perso where nom = 'x');
  e_interv text := (select email from pg_temp.perso where nom = 't_interv');
  v_l1t text := v_l1::text;
  v_l2t text := v_l2::text;
begin
  -- Le titre fixe de chaque niveau existe et les personnages portent bien leurs lignes (jamais un contrôle à vide).
  perform pg_temp.verifier('retrait', 'départ : form_n a une ligne formateur, dir_n une ligne direction, siege_form une ligne siège, et les titres existent',
    pg_temp.lignes(e_form_n, 'formateur') = '1' and pg_temp.lignes(e_dir_n, 'direction') = '1' and pg_temp.lignes(e_siege_form, 'siege') = '1'
    and t_form ~ '^[0-9]+$' and t_dir ~ '^[0-9]+$' and t_siege ~ '^[0-9]+$' and t_interv ~ '^[0-9]+$' and t_interv <> t_form,
    format('lignes %s/%s/%s ; titres %s %s %s %s', pg_temp.lignes(e_form_n, 'formateur'), pg_temp.lignes(e_dir_n, 'direction'),
      pg_temp.lignes(e_siege_form, 'siege'), t_form, t_dir, t_siege, t_interv));

  -- La direction retire un Formateur de son centre.
  perform pg_temp.attendre('retrait', 'dir_n retire Formateur de form_n (centre de la promo 1) : une ligne',
    pg_temp.retirer('dir_n', '1', null, e_form_n, t_form, v_l1t), 'OK 1');
  perform pg_temp.attendre('retrait', 'après ce retrait, form_n n''a plus de ligne formateur', pg_temp.lignes(e_form_n, 'formateur'), '0');
  perform pg_temp.affecter(e_form_n, 'formateur', 1, null, null);
  perform pg_temp.attendre('retrait', 'dir_n retire Formateur de form_n avec l''adresse écrite en majuscules (casse ignorée) : une ligne',
    pg_temp.retirer('dir_n', '1', null, upper(e_form_n), t_form, v_l1t), 'OK 1');
  perform pg_temp.affecter(e_form_n, 'formateur', 1, null, null);
  perform pg_temp.attendre('retrait', 'dir_n retire Formateur de form_m sur le centre de la promo 2 : refusé (42501), la ligne reste',
    pg_temp.retirer('dir_n', '1', null, e_form_m, t_form, v_l2t) || ' / ' || pg_temp.lignes(e_form_m, 'formateur'),
    'ERREUR 42501 titres: Réservé à la direction du centre. / 1');
  perform pg_temp.attendre('retrait', 'form_n se retire Formateur : refusé (42501, droit), sa ligne reste',
    pg_temp.retirer('form_n', '1', null, e_form_n, t_form, v_l1t) || ' / ' || pg_temp.lignes(e_form_n, 'formateur'),
    'ERREUR 42501 titres: Réservé à la direction du centre. / 1');
  -- La directrice qui forme : elle retire son propre Formateur.
  perform pg_temp.attendre('retrait', 'dir_n se donne Formateur sur la promo 1 (regler_affectations_formateur)',
    pg_temp.appeler_a('dir_n', '1', null, format($q$select (public.regler_affectations_formateur(%L, %s, '{1}'))->>'ajoutees'$q$, e_dir_n, v_l1t))
      || ' / ' || pg_temp.lignes(e_dir_n, 'formateur'), 'OK [1] / 1');
  perform pg_temp.attendre('retrait', 'dir_n se retire Formateur (la directrice qui forme) : permis, une ligne ; sa direction reste',
    pg_temp.retirer('dir_n', '1', null, e_dir_n, t_form, v_l1t) || ' / ' || pg_temp.lignes(e_dir_n, 'formateur') || ' / ' || pg_temp.lignes(e_dir_n, 'direction'),
    'OK 1 / 0 / 1');
  -- Direction de centre : le siège ; jamais sur soi.
  perform pg_temp.attendre('retrait', 'siege retire Direction de centre de dir_n : une ligne',
    pg_temp.retirer('siege', null, null, e_dir_n, t_dir, v_l1t) || ' / ' || pg_temp.lignes(e_dir_n, 'direction'), 'OK 1 / 0');
  perform pg_temp.affecter(e_dir_n, 'direction', null, v_l1, null);
  perform pg_temp.attendre('retrait', 'dir_n se retire Direction de centre : refusé (42501), la ligne reste',
    pg_temp.retirer('dir_n', '1', null, e_dir_n, t_dir, v_l1t) || ' / ' || pg_temp.lignes(e_dir_n, 'direction'),
    'ERREUR 42501 titres: Réservé au siège. / 1');
  perform pg_temp.attendre('retrait', 'dir_n retire la direction de dir_deux : refusé (42501), les deux lignes restent',
    pg_temp.retirer('dir_n', '1', null, e_dir_deux, t_dir, v_l1t) || ' / ' || pg_temp.lignes(e_dir_deux, 'direction'),
    'ERREUR 42501 titres: Réservé au siège. / 2');
  perform pg_temp.attendre('retrait', 'siege retire la direction du centre 1 de dir_deux : une ligne, celle du centre 2 reste',
    pg_temp.retirer('siege', null, null, e_dir_deux, t_dir, v_l1t) || ' / ' || pg_temp.lignes(e_dir_deux, 'direction'), 'OK 1 / 1');
  perform pg_temp.affecter(e_dir_deux, 'direction', null, v_l1, null);
  -- Jamais sur soi, sans exemption pour le siège : un siège qui tient aussi une direction ne s'en défait pas lui-même.
  perform pg_temp.affecter(e_siege, 'direction', null, v_l1, null);
  perform pg_temp.attendre('retrait', 'siege qui tient aussi une direction : se retirer cette Direction de centre est refusé (42501, jamais sur soi), la ligne reste',
    pg_temp.retirer('siege', null, null, e_siege, t_dir, v_l1t) || ' / ' || pg_temp.lignes(e_siege, 'direction'),
    'ERREUR 42501 titres: Vous ne pouvez pas retirer votre propre titre. / 1');
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L and role = ''direction''', e_siege));
  -- Siège : le fondateur seul ; le centre donné est ignoré au niveau du réseau.
  perform pg_temp.attendre('retrait', 'siege retire Siège de siege_form : refusé (42501), la ligne reste',
    pg_temp.retirer('siege', null, null, e_siege_form, t_siege, 'null') || ' / ' || pg_temp.lignes(e_siege_form, 'siege'),
    'ERREUR 42501 titres: Réservé au fondateur. / 1');
  perform pg_temp.attendre('retrait', 'fond retire Siège de siege_form (un centre quelconque donné, ignoré) : une ligne',
    pg_temp.retirer('fond', '1', null, e_siege_form, t_siege, v_l2t) || ' / ' || pg_temp.lignes(e_siege_form, 'siege'), 'OK 1 / 0');
  perform pg_temp.affecter(e_siege_form, 'siege', null, null, null);
  perform pg_temp.affecter(e_fond, 'siege', null, null, null);
  perform pg_temp.attendre('retrait', 'fond, qui tient une ligne Siège, se la retire : permis (le fondateur est excepté de « jamais sur soi »)',
    pg_temp.retirer('fond', '1', null, e_fond, t_siege, 'null') || ' / ' || pg_temp.lignes(e_fond, 'siege'), 'OK 1 / 0');
  -- Les phrases de refus, dans l'ordre des contrôles.
  perform pg_temp.attendre('retrait', 'un titre qui n''existe pas : « Titre introuvable. »',
    pg_temp.retirer('dir_n', '1', null, e_form_n, '999999999', v_l1t), 'ERREUR P0001 titres: Titre introuvable.');
  perform pg_temp.attendre('retrait', 'un titre de promo sans centre : « Le centre est requis. »',
    pg_temp.retirer('dir_n', '1', null, e_form_n, t_form, 'null'), 'ERREUR P0001 titres: Le centre est requis.');
  perform pg_temp.attendre('retrait', 'un titre de centre avec un centre qui n''existe pas : « Le centre est requis. »',
    pg_temp.retirer('siege', null, null, e_dir_n, t_dir, '999999999'), 'ERREUR P0001 titres: Le centre est requis.');
  perform pg_temp.attendre('retrait', 'une personne qui n''a pas ce titre : « Cette personne n''a pas ce titre ici. »',
    pg_temp.retirer('dir_n', '1', null, e_x, t_form, v_l1t), 'ERREUR P0001 titres: Cette personne n''a pas ce titre ici.');
  perform pg_temp.attendre('retrait', 'un Formateur d''un autre centre (form_m, centre 2) retiré par dir_n sur son propre centre : « Cette personne n''a pas ce titre ici. »',
    pg_temp.retirer('dir_n', '1', null, e_form_m, t_form, v_l1t), 'ERREUR P0001 titres: Cette personne n''a pas ce titre ici.');
  perform pg_temp.attendre('retrait', 'un titre non fixe (t_interv) : « Ce titre ne se retire pas encore ici. », la ligne reste',
    pg_temp.retirer('dir_n', '1', null, e_interv, t_interv, v_l1t) || ' / ' || pg_temp.lignes(e_interv, 'formateur'),
    'ERREUR P0001 titres: Ce titre ne se retire pas encore ici. / 1');
  perform pg_temp.attendre('retrait', 'un jeton sans adresse : « Connexion requise. » (42501)',
    pg_temp.retirer(null, '1', null, e_form_n, t_form, v_l1t), 'ERREUR 42501 titres: Connexion requise.');
  -- L'aperçu du fondateur : il vaut le rôle simulé, jamais plus.
  perform pg_temp.attendre('retrait', 'fond en aperçu direction sur la promo 1 retire Formateur de form_n : une ligne',
    pg_temp.retirer('fond', '1', 'direction', e_form_n, t_form, v_l1t), 'OK 1');
  perform pg_temp.affecter(e_form_n, 'formateur', 1, null, null);
  perform pg_temp.attendre('retrait', 'fond en aperçu direction retire Direction de centre : refusé (42501), la ligne reste',
    pg_temp.retirer('fond', '1', 'direction', e_dir_n, t_dir, v_l1t) || ' / ' || pg_temp.lignes(e_dir_n, 'direction'),
    'ERREUR 42501 titres: Réservé au siège. / 1');
  perform pg_temp.attendre('retrait', 'fond en aperçu siège retire Siège de siege_form : refusé (42501), la ligne reste',
    pg_temp.retirer('fond', null, 'siege', e_siege_form, t_siege, 'null') || ' / ' || pg_temp.lignes(e_siege_form, 'siege'),
    'ERREUR 42501 titres: Réservé au fondateur. / 1');
  perform pg_temp.attendre('retrait', 'fond en aperçu stagiaire ne retire rien : refusé (42501), la ligne reste',
    pg_temp.retirer('fond', '1', 'stagiaire', e_form_n, t_form, v_l1t) || ' / ' || pg_temp.lignes(e_form_n, 'formateur'),
    'ERREUR 42501 titres: Réservé à la direction du centre. / 1');
  perform pg_temp.attendre('retrait', 'form_n qui envoie un en-tête d''aperçu direction (qu''il n''a pas le droit d''envoyer) ne gagne rien : refusé (42501)',
    pg_temp.retirer('form_n', '1', 'direction', e_form_m, t_form, v_l1t), 'ERREUR 42501 titres: Réservé à la direction du centre.');
  perform pg_temp.attendre('retrait', 'les droits d''exécution : authenticated oui, anon non, PUBLIC non',
    pg_temp.calcul($q$select concat_ws('/', has_function_privilege('authenticated', 'public.retirer_titre(text, bigint, integer)', 'execute')::text,
      has_function_privilege('anon', 'public.retirer_titre(text, bigint, integer)', 'execute')::text,
      (select count(*) from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.retirer_titre(text, bigint, integer)'::regprocedure and a.grantee = 0)::text)$q$),
    'true/false/0');
end $tgr$;

-- Groupe soi (migration 5, partie A) : personne ne se nomme soi-même à la direction par inviter_compte (le fondateur, hors aperçu, excepté).
create or replace function pg_temp.groupe_soi()
returns void language plpgsql as $tgs$
declare
  v_l1t text := (select lieu_id::text from public.promos where id = 1);
  e_siege text := (select email from pg_temp.perso where nom = 'siege');
  e_x text := (select email from pg_temp.perso where nom = 'x');
  e_f2 text := 'preuve8.fond2@exemple.invalid';
  v_phrase constant text := 'ERREUR 42501 invitation: Vous ne pouvez pas vous nommer vous-même à la direction.';
begin
  -- Un fondateur sans fiche de stagiaire (le fondateur de la preuve précédente en a une, ce que inviter_compte refuse pour un autre motif).
  insert into pg_temp.perso (ordre, nom, email, role, fondateur) values (56, 'fond2', e_f2, 'prof', true);
  insert into public.user_profiles (email, role, is_admin, is_founder, stagiaire_id) values (e_f2, 'prof', true, true, null);
  perform pg_temp.attendre('soi', 'siege s''invite à la direction : refusé (42501, la phrase exacte), aucune ligne écrite',
    pg_temp.appeler_a('siege', null, null, format($q$select (public.inviter_compte(%L, 'direction', null, null, %s))->>'affecte'$q$, e_siege, v_l1t))
      || ' / ' || pg_temp.lignes(e_siege, 'direction'), v_phrase || ' / 0');
  perform pg_temp.attendre('soi', 'siege invite une autre adresse à la direction : une ligne écrite',
    pg_temp.appeler_a('siege', null, null, format($q$select (public.inviter_compte(%L, 'direction', null, null, %s))->>'affecte'$q$, e_x, v_l1t))
      || ' / ' || pg_temp.lignes(e_x, 'direction'), 'OK 1 / 1');
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L', e_x));
  perform pg_temp.essai(format('delete from public.user_profiles where lower(email) = %L', e_x));
  perform pg_temp.attendre('soi', 'fond2 (fondateur sans fiche) s''invite à la direction : permis, une ligne',
    pg_temp.appeler_a('fond2', '1', null, format($q$select (public.inviter_compte(%L, 'direction', null, null, %s))->>'affecte'$q$, e_f2, v_l1t))
      || ' / ' || pg_temp.lignes(e_f2, 'direction'), 'OK 1 / 1');
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L', e_f2));
  perform pg_temp.attendre('soi', 'fond2 en aperçu siège s''invite à la direction : refusé (42501), aucune ligne',
    pg_temp.appeler_a('fond2', null, 'siege', format($q$select (public.inviter_compte(%L, 'direction', null, null, %s))->>'affecte'$q$, e_f2, v_l1t))
      || ' / ' || pg_temp.lignes(e_f2, 'direction'), v_phrase || ' / 0');
  perform pg_temp.attendre('soi', 'fond2 en aperçu direction ne s''invite pas non plus (réservé au siège : 42501)',
    pg_temp.appeler_a('fond2', '1', 'direction', format($q$select (public.inviter_compte(%L, 'direction', null, null, %s))->>'affecte'$q$, e_f2, v_l1t))
      || ' / ' || pg_temp.lignes(e_f2, 'direction'), 'ERREUR 42501 invitation: Réservé au siège. / 0');
  perform pg_temp.attendre('soi', 'la casse ne contourne pas la règle : siege s''invite avec son adresse en majuscules, refusé (42501), aucune ligne',
    pg_temp.appeler_a('siege', null, null, format($q$select (public.inviter_compte(%L, 'direction', null, null, %s))->>'affecte'$q$, upper(e_siege), v_l1t))
      || ' / ' || pg_temp.lignes(e_siege, 'direction'), v_phrase || ' / 0');
  perform pg_temp.essai(format('delete from public.user_profiles where lower(email) = %L', e_f2));
  perform pg_temp.essai('delete from pg_temp.perso where nom = ''fond2''');
end $tgs$;

-- Une écriture directe sur affectations qui doit être refusée (42501) ou ne toucher aucune ligne (OK 0), sans jamais écrire ni retirer :
-- p_sql rend le nombre de lignes touchées ; p_lignes (jouée par le propriétaire) dit combien de lignes de la cible existent après, et
-- p_attendu combien il devait en rester.
create or replace function pg_temp.ecriture_refusee(p_libelle text, p_qui text, p_entete text, p_apercu text, p_sql text, p_lignes text, p_attendu text)
returns void language plpgsql as $ter$
declare r text; v_n text;
begin
  r := pg_temp.appeler_a(p_qui, p_entete, p_apercu, p_sql);
  v_n := pg_temp.calcul(p_lignes);
  perform pg_temp.verifier('ecritures', p_libelle, (r like 'ERREUR 42501%' or r = 'OK 0') and v_n = p_attendu,
    format('obtenu %s, lignes restantes %s ; attendu 42501 ou OK 0, lignes %s', left(r, 90), coalesce(v_n, 'nul'), p_attendu));
end $ter$;

-- Groupe ecritures (migration 5, partie B) : plus aucune écriture directe sur affectations, quel que soit l'acteur ; les fonctions
-- (inviter_compte, regler_affectations_formateur, retirer_titre) restent le seul chemin.
create or replace function pg_temp.groupe_ecritures()
returns void language plpgsql as $tge$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  e_x text := (select email from pg_temp.perso where nom = 'x');
  e_y text := (select email from pg_temp.perso where nom = 'y');
  e_form_n text := (select email from pg_temp.perso where nom = 'form_n');
  e_form_m text := (select email from pg_temp.perso where nom = 'form_m');
  e_dir_n text := (select email from pg_temp.perso where nom = 'dir_n');
  e_siege text := (select email from pg_temp.perso where nom = 'siege');
  e_siege_form text := (select email from pg_temp.perso where nom = 'siege_form');
  v_ligne_x text;
  v_acteurs text[][] := array[['dir_n', '1'], ['siege', null], ['form_n', '1'], ['stag_n', '1'], ['fond', '1']];
  v_a text[];
  v_sql text;
  v_depart text;
begin
  -- y a un profil et aucune ligne : la cible des insertions (sans profil, la clé étrangère répondrait avant les droits).
  insert into public.user_profiles (email, role, is_admin, stagiaire_id) values (e_y, 'prof', false, null);
  v_ligne_x := format('select count(*)::text from public.affectations where lower(email) = lower(%L)', e_y);
  perform pg_temp.verifier('ecritures', 'départ : y (profil seul) n''a aucune ligne, form_m en a une, siege_form une, dir_n une direction',
    pg_temp.calcul(v_ligne_x) = '0' and pg_temp.lignes(e_form_m, 'formateur') = '1' and pg_temp.lignes(e_siege_form, 'siege') = '1' and pg_temp.lignes(e_dir_n, 'direction') = '1',
    format('y %s, form_m %s, siege_form %s, dir_n %s', pg_temp.calcul(v_ligne_x), pg_temp.lignes(e_form_m, 'formateur'), pg_temp.lignes(e_siege_form, 'siege'), pg_temp.lignes(e_dir_n, 'direction')));
  -- Les droits de la table : plus d'insertion ni de suppression pour authenticated, la lecture reste.
  perform pg_temp.attendre('ecritures', 'authenticated : pas d''insertion, pas de suppression, pas de modification, la lecture reste',
    pg_temp.calcul($q$select concat_ws('/', has_table_privilege('authenticated', 'public.affectations', 'insert')::text,
      has_table_privilege('authenticated', 'public.affectations', 'delete')::text, has_table_privilege('authenticated', 'public.affectations', 'update')::text,
      has_table_privilege('authenticated', 'public.affectations', 'select')::text)$q$), 'false/false/false/true');
  perform pg_temp.attendre('ecritures', 'aucune colonne d''affectations n''est insérable ni modifiable par authenticated',
    pg_temp.calcul($q$select count(*)::text from pg_attribute a where a.attrelid = 'public.affectations'::regclass and a.attnum > 0 and not a.attisdropped
      and (has_column_privilege('authenticated', a.attrelid, a.attnum, 'insert') or has_column_privilege('authenticated', a.attrelid, a.attnum, 'update'))$q$), '0');
  perform pg_temp.attendre('ecritures', 'anon : ni insertion, ni suppression, ni lecture',
    pg_temp.calcul($q$select concat_ws('/', has_table_privilege('anon', 'public.affectations', 'insert')::text, has_table_privilege('anon', 'public.affectations', 'delete')::text,
      has_table_privilege('anon', 'public.affectations', 'select')::text)$q$), 'false/false/false');
  perform pg_temp.attendre('ecritures', 'les deux règles d''écriture refusent tout (with check false, using false) et gardent leurs noms et leurs commandes',
    pg_temp.calcul($q$select string_agg(policyname || ':' || cmd || ':' || coalesce(with_check, qual), ',' order by policyname collate "C") from pg_policies
      where schemaname = 'public' and tablename = 'affectations' and policyname in ('affectations_ajout', 'affectations_retrait')$q$),
    'affectations_ajout:INSERT:false,affectations_retrait:DELETE:false');
  -- Chaque acteur, une insertion et une suppression : jamais une ligne écrite ni retirée.
  foreach v_a slice 1 in array v_acteurs loop
    v_sql := case v_a[1]
      when 'siege' then format('with i as (insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s) returning 1) select count(*)::text from i', e_y, v_l1)
      when 'fond' then format('with i as (insert into public.affectations (email, role) values (%L, ''siege'') returning 1) select count(*)::text from i', e_y)
      else format('with i as (insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', 1) returning 1) select count(*)::text from i', e_y)
    end;
    perform pg_temp.ecriture_refusee(v_a[1] || ' n''insère aucune ligne dans affectations', v_a[1], v_a[2], null, v_sql, v_ligne_x, '0');
  end loop;
  perform pg_temp.ecriture_refusee('dir_n ne retire pas le formateur form_n de son centre', 'dir_n', '1', null,
    format('with d as (delete from public.affectations where lower(email) = %L and role = ''formateur'' returning 1) select count(*)::text from d', e_form_n),
    format('select count(*)::text from public.affectations where lower(email) = %L and role = ''formateur''', e_form_n), '1');
  perform pg_temp.ecriture_refusee('siege ne retire pas la direction de dir_n', 'siege', null, null,
    format('with d as (delete from public.affectations where lower(email) = %L and role = ''direction'' returning 1) select count(*)::text from d', e_dir_n),
    format('select count(*)::text from public.affectations where lower(email) = %L and role = ''direction''', e_dir_n), '1');
  perform pg_temp.ecriture_refusee('fond ne retire pas le siège de siege_form', 'fond', '1', null,
    format('with d as (delete from public.affectations where lower(email) = %L and role = ''siege'' returning 1) select count(*)::text from d', e_siege_form),
    format('select count(*)::text from public.affectations where lower(email) = %L and role = ''siege''', e_siege_form), '1');
  perform pg_temp.ecriture_refusee('form_n ne retire pas sa propre ligne', 'form_n', '1', null,
    format('with d as (delete from public.affectations where lower(email) = %L and role = ''formateur'' returning 1) select count(*)::text from d', e_form_n),
    format('select count(*)::text from public.affectations where lower(email) = %L and role = ''formateur''', e_form_n), '1');
  perform pg_temp.ecriture_refusee('stag_n ne retire aucune ligne', 'stag_n', '1', null,
    format('with d as (delete from public.affectations where lower(email) = %L returning 1) select count(*)::text from d', e_form_m),
    format('select count(*)::text from public.affectations where lower(email) = %L', e_form_m), '1');
  perform pg_temp.ecriture_refusee('fond en aperçu direction n''insère rien non plus', 'fond', '1', 'direction',
    format('with i as (insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', 1) returning 1) select count(*)::text from i', e_y), v_ligne_x, '0');
  -- Le scénario de la relecture finale (I4) : un siège ne se nomme pas direction par écriture directe, puis ne lit pas les stagiaires.
  perform pg_temp.ecriture_refusee('I4 : siege insère une ligne direction à sa propre adresse sur le centre de la promo 1 : refusé, aucune ligne', 'siege', '1', null,
    format('with i as (insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s) returning 1) select count(*)::text from i', e_siege, v_l1),
    format('select count(*)::text from public.affectations where lower(email) = %L and role = ''direction''', e_siege), '0');
  perform pg_temp.attendre('ecritures', 'I4 : siege, sous l''en-tête de la promo 1, ne lit aucun stagiaire',
    pg_temp.appeler_a('siege', '1', null, 'select count(*)::text from public.stagiaires'), 'OK 0');
  -- Les fonctions écrivent toujours (security definer) : c'est le seul chemin.
  perform pg_temp.attendre('ecritures', 'inviter_compte écrit encore : dir_n invite x comme formateur de la promo 1, une ligne',
    pg_temp.appeler_a('dir_n', '1', null, format($q$select (public.inviter_compte(%L, 'formateur'))->>'affecte'$q$, e_x)) || ' / ' || pg_temp.lignes(e_x, 'formateur'),
    'OK 1 / 1');
  perform pg_temp.attendre('ecritures', 'regler_affectations_formateur écrit encore : dir_n retire x de la promo 1 (liste vide), une ligne retirée',
    pg_temp.appeler_a('dir_n', '1', null, format($q$select (public.regler_affectations_formateur(%L, %s, '{}'))->>'retirees'$q$, e_x, v_l1)) || ' / ' || pg_temp.lignes(e_x, 'formateur'),
    'OK [1] / 0');
  perform pg_temp.essai(format('delete from public.user_profiles where lower(email) in (%L, %L)', e_x, e_y));
end $tge$;

do $tprg$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_etat4 text; v_etat5 text; v_etat6 text; v_retour text; v_retour4 text; v_retour5 text; v_retour6 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_regle text; v_jouees integer;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'gestion-en-ligne%';

  -- 1. Avant les migrations : l'empreinte de la base, puis les prérequis de l'étape 1.
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  perform pg_temp.verifier('structure', 'prérequis : titre_fixe(text) existe (migration 1 de l''étape 1)',
    to_regprocedure('public.titre_fixe(text)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : geste_promo(integer, text) existe (migration 2 de l''étape 1)',
    to_regprocedure('public.geste_promo(integer, text)') is not null);
  select coalesce(with_check, '') into v_regle from pg_policies where schemaname = 'public' and tablename = 'affectations' and policyname = 'affectations_ajout';
  perform pg_temp.verifier('structure', 'prérequis : la règle affectations_ajout existe, réécrite par la migration 3 (elle cite geste_centre) ou déjà fermée (false)',
    v_regle like '%geste_centre%' or v_regle = 'false', 'with check : ' || coalesce(left(v_regle, 120), 'règle absente'));

  -- 2. Les migrations, dans l'ordre d'application (neutralisées dans les modes sans elles) : 4 (journal), 5 (fermetures), 6 (gestion).
  v_etat4 := pg_temp.jouer('migration 4',
-- @@INJECTER supabase/migrations/20261112_titres_4_journal.sql@@
  );
  perform pg_temp.etape('migration 4', v_etat4, v_mode);
  v_etat5 := pg_temp.jouer('migration 5',
-- @@INJECTER supabase/migrations/20261112_titres_5_fermetures.sql@@
  );
  perform pg_temp.etape('migration 5', v_etat5, v_mode);
  v_etat6 := pg_temp.jouer('migration 6',
-- @@INJECTER supabase/migrations/20261112_titres_6_gestion.sql@@
  );
  perform pg_temp.etape('migration 6', v_etat6, v_mode);

  -- 3. Les personnages : ceux de l'étape 1 (titres-aides.sql), puis ceux de l'étape 2.
  perform pg_temp.poser_perso();
  perform pg_temp.poser_titres_gestes();
  perform pg_temp.poser_titres_gestion();
  perform pg_temp.attendre('structure', 'les personnages de l''étape 2 sont posés (4 titres non fixes portés, 5 adresses libres, un orphelin, une promo)',
    pg_temp.calcul($q$select concat_ws('/',
      (select count(*) from perso where nom in ('t_chef', 't_vide', 't_qualite', 't_dirs') and info ~ '^[0-9]+$')::text,
      (select count(*) from perso p where p.nom in ('x', 'y', 'z', 'u', 'v') and not exists (select 1 from public.user_profiles u where u.email = p.email)
         and not exists (select 1 from public.affectations a where lower(a.email) = p.email))::text,
      (select count(*) from perso p join public.user_profiles u on u.email = p.email where p.nom = 'orphelin' and u.role = 'stagiaire' and u.stagiaire_id is null)::text,
      (select count(*) from public.promos where id = 990801 and nom = 'Preuve8 promo A')::text,
      (select count(*) from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe and a.email like 'preuve8.t.%')::text)$q$),
    '4/5/1/1/4');

  -- 4. Les groupes de la migration 5 (fermetures), puis de la migration 6 (gestion), avec leurs tâches.
  if pg_temp.groupe_a_jouer('retrait', v_etat5, 'public.retirer_titre(text, bigint, integer)', v_mode) then
    perform pg_temp.groupe_retrait();
  end if;
  if pg_temp.groupe_a_jouer('soi', v_etat5, 'public.retirer_titre(text, bigint, integer)', v_mode) then
    perform pg_temp.groupe_soi();
  end if;
  if pg_temp.groupe_a_jouer('ecritures', v_etat5, 'public.retirer_titre(text, bigint, integer)', v_mode) then
    perform pg_temp.groupe_ecritures();
  end if;

  -- 5. Les retours, dans l'ordre inverse (6, 5, 4).
  v_retour6 := pg_temp.jouer('retour 6',
-- @@INJECTER supabase/migrations/20261112_titres_6_gestion_retour.sql@@
  );
  perform pg_temp.etape('retour 6', v_retour6, v_mode);
  v_retour5 := pg_temp.jouer('retour 5',
-- @@INJECTER supabase/migrations/20261112_titres_5_fermetures_retour.sql@@
  );
  perform pg_temp.etape('retour 5', v_retour5, v_mode);
  v_retour4 := pg_temp.jouer('retour 4',
-- @@INJECTER supabase/migrations/20261112_titres_4_journal_retour.sql@@
  );
  perform pg_temp.etape('retour 4', v_retour4, v_mode);
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  v_jouees := (v_etat4 = 'jouée')::integer + (v_etat5 = 'jouée')::integer + (v_etat6 = 'jouée')::integer;
  if v_en_ligne or v_jouees = 0 then
    perform pg_temp.informer('retours', format('non jugeables (aucune migration injectée, ou déjà appliquées) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tprg$;
