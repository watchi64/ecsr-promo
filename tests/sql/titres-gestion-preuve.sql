-- Preuve de l'étape 2 du chantier « titres et droits à la carte » : ce que les migrations 20261112_titres_5 (fermetures) et _6 (gestion)
-- doivent donner, écrite avec elles. Elle se joue sur une base où les migrations 1, 2 et 3 sont appliquées (l'état de la production
-- après l'étape 1) ; la migration 4 (journal) n'y est pas, sauf demande (--etapes 4,5,6).
--   structure    prérequis de l'étape 1 présents (titre_fixe, geste_promo, la règle affectations_ajout réécrite par la migration 3),
--                chaque migration et chaque retour injectés se jouent sans erreur, personnages de l'étape 2 posés.
--   retrait      (migration 5, A) retirer_titre pour les titres fixes : droits, phrases de refus, jamais sur soi, aperçu du fondateur.
--   soi          (migration 5, A) personne ne se nomme soi-même à la direction par inviter_compte (le fondateur, hors aperçu, excepté).
--   ecritures    (migration 5, B) plus aucune écriture directe sur affectations (droits de table, règles à false, chaque acteur), les fonctions
--                restent le seul chemin ; le scénario de la relecture finale (un siège ne se nomme pas direction) ne lit rien.
--   lectures     (migration 5, C) les lectures qu'une case « Non » ferme (affectations, profils du personnel, roles_du_personnel, notes visibles),
--                en nombre de lignes ; les titres fixes lisent les mêmes nombres qu'avant la migration (relevé avant, comparé après).
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
  -- Un titre non fixe : la migration 5 le refuse (« ne se retire pas encore ici »), la migration 6 le retire (la ligne est alors remise).
  perform pg_temp.attendre('retrait', 'un titre non fixe (t_interv) : refusé avant la migration 6 (la ligne reste), retiré après (la ligne part)',
    pg_temp.retirer('dir_n', '1', null, e_interv, t_interv, v_l1t) || ' / ' || pg_temp.lignes(e_interv, 'formateur'),
    case when to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)') is null
         then 'ERREUR P0001 titres: Ce titre ne se retire pas encore ici. / 1' else 'OK 1 / 0' end);
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L and role = ''formateur''', e_interv));
  perform pg_temp.affecter(e_interv, 'formateur', 1, null, t_interv);
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

-- Le relevé des lectures des personnages dont les nombres ne doivent pas bouger, avant et après la migration.
drop table if exists pg_temp.releves;
create temp table releves (etape text, qui text, lecture text, valeur text);

-- Les lectures du groupe lectures : une requête par nom, jouée par un personnage, qui rend un nombre de lignes (en texte).
create or replace function pg_temp.lecture_sql(p_lecture text)
returns text language sql immutable as $tls$
  select case p_lecture
    when 'affectations' then 'select count(*)::text from public.affectations'
    when 'formateurs' then 'select count(*)::text from public.affectations where role = ''formateur'''
    when 'directions' then 'select count(*)::text from public.affectations where role = ''direction'''
    when 'sieges' then 'select count(*)::text from public.affectations where role = ''siege'''
    when 'personnel' then 'select count(*)::text from public.user_profiles where stagiaire_id is null and role <> ''stagiaire'''
    when 'roles_du_personnel' then 'select count(*)::text from public.roles_du_personnel()'
    when 'notes_visibles' then 'select count(*)::text from public.notes_stagiaires_visibles()'
  end;
$tls$;

-- Le relevé de toutes les lectures par les cinq personnages dont les nombres ne doivent pas bouger (stag_n, form_n, dir_n, siege, fond),
-- rangé dans pg_temp.releves sous le nom de l'étape ('avant' ou 'apres').
create or replace function pg_temp.releve(p_etape text)
returns void language plpgsql as $trel$
declare p record; l text;
begin
  for p in select * from (values ('stag_n', '1'), ('form_n', '1'), ('dir_n', '1'), ('siege', null), ('fond', '1')) x(qui, entete) loop
    foreach l in array array['affectations', 'formateurs', 'directions', 'sieges', 'personnel', 'roles_du_personnel', 'notes_visibles'] loop
      insert into pg_temp.releves (etape, qui, lecture, valeur) values (p_etape, p.qui, l, pg_temp.appeler_a(p.qui, p.entete, null, pg_temp.lecture_sql(l)));
    end loop;
  end loop;
end $trel$;

-- Une lecture d'un personnage, comparée à un nombre attendu écrit en dur : le libellé dit la lecture ; l'attendu est « OK <n> ».
create or replace function pg_temp.lire_n(p_libelle text, p_qui text, p_entete text, p_lecture text, p_attendu text)
returns void language sql as $tln$
  select pg_temp.attendre('lectures', p_libelle, pg_temp.appeler_a(p_qui, p_entete, null, pg_temp.lecture_sql(p_lecture)), 'OK ' || p_attendu);
$tln$;

-- Groupe lectures (migration 5, partie C) : les lectures qu'une case « Non » ferme. Titres non fixes posés en propriétaire (t_contenus,
-- t_qualite, t_interv, t_rh, t_secr, t_vide, et t_promos, posé ici : Promos Voir seulement). Les nombres sont ceux du propriétaire,
-- jugés non nuls quand ils servent d'attendu (jamais un contrôle à vide). p_compare : le relevé d'avant la migration est comparable.
create or replace function pg_temp.groupe_lectures(p_compare boolean)
returns void language plpgsql as $tgl$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  e_promos text := 'preuve8.t.promos@exemple.invalid';
  v_titre_promos text;
  n_dir text; n_form_l1 text; n_form_autre text; n_stag text; n_stag_vis text;
  r record;
  v_avant text; v_apres text;
begin
  -- Le relevé d'après, avant de poser quoi que ce soit de plus (t_promos, ci-dessous, s'ajouterait aux lignes lues).
  if p_compare then
    perform pg_temp.releve('apres');
  end if;
  -- Un titre de centre « Promos : Voir » seul (ni Équipe, ni Réglages), porté par t_promos, pour le geste promos.lire.
  insert into pg_temp.perso (ordre, nom, email, role) values (57, 't_promos', e_promos, 'prof');
  insert into public.user_profiles (email, role, is_admin) values (e_promos, 'prof', false);
  v_titre_promos := pg_temp.nouveau_titre('Preuve8 promos seules', 'centre', v_l1);
  perform pg_temp.essai(format('update public.titres set cases = %L::jsonb where id = %s', '{"promos":"voir"}', v_titre_promos));
  perform pg_temp.affecter(e_promos, 'direction', null, v_l1, v_titre_promos);
  -- Les nombres du propriétaire.
  n_dir := pg_temp.calcul($q$select count(*)::text from public.affectations where role = 'direction'$q$);
  n_form_l1 := pg_temp.calcul(format($q$select count(*)::text from public.affectations a join public.promos p on p.id = a.promo_id where a.role = 'formateur' and p.lieu_id = %s$q$, v_l1));
  n_form_autre := pg_temp.calcul(format($q$select count(*)::text from public.affectations a join public.promos p on p.id = a.promo_id where a.role = 'formateur' and p.lieu_id <> %s$q$, v_l1));
  n_stag := pg_temp.calcul($q$select count(*)::text from public.stagiaires where promo_id = 1$q$);
  -- Ce que lit stag_n (sans case Notes) : sa fiche et les fiches de la promo dont aucun profil n'a masqué les notes (règle d'anonymat).
  -- Le camarade anonyme est posé par poser_titres_gestion : la règle est jugée aussi sur la base locale.
  n_stag_vis := pg_temp.calcul($q$select count(*)::text from public.stagiaires s where s.promo_id = 1
    and (s.id = (select u.stagiaire_id from public.user_profiles u where u.email = 'preuve7.eq.stag.n@exemple.invalid')
         or not exists (select 1 from public.user_profiles u2 where u2.stagiaire_id = s.id and u2.anonymous_notes))$q$);
  perform pg_temp.verifier('lectures', 'un camarade de la promo 1 a masqué ses notes : stag_n en lit une de moins que le nombre de fiches (règle d''anonymat jugée)',
    n_stag_vis ~ '^[0-9]+$' and n_stag ~ '^[0-9]+$' and n_stag_vis::integer = n_stag::integer - 1, format('visibles %s, fiches %s', n_stag_vis, n_stag));
  perform pg_temp.verifier('lectures', 'départ : le propriétaire voit des directions, des formateurs dans le centre 1 et dans un autre centre, des stagiaires dans la promo 1',
    n_dir ~ '^[1-9][0-9]*$' and n_form_l1 ~ '^[1-9][0-9]*$' and n_form_autre ~ '^[1-9][0-9]*$' and n_stag ~ '^[1-9][0-9]*$',
    format('directions %s, formateurs du centre %s, formateurs ailleurs %s, stagiaires %s', n_dir, n_form_l1, n_form_autre, n_stag));
  -- t_contenus (réseau : Cours Modifier, Directions Non) : ni direction, ni profil du personnel, ni personne ; seule sa propre ligne.
  perform pg_temp.lire_n('t_contenus (Directions : Non) ne lit aucune affectation de direction', 't_contenus', null, 'directions', '0');
  perform pg_temp.lire_n('t_contenus (Directions : Non) ne lit aucune affectation de formateur', 't_contenus', null, 'formateurs', '0');
  perform pg_temp.lire_n('t_contenus lit sa propre ligne de siège et aucune autre', 't_contenus', null, 'sieges', '1');
  perform pg_temp.lire_n('t_contenus (Directions : Non) ne lit aucun profil du personnel autre que le sien', 't_contenus', null, 'personnel', '1');
  perform pg_temp.lire_n('t_contenus (Directions : Non) : roles_du_personnel() rend 0 ligne', 't_contenus', null, 'roles_du_personnel', '0');
  -- t_qualite (réseau : Directions Voir) : lit les directions, jamais les sièges des autres.
  perform pg_temp.lire_n('t_qualite (Directions : Voir) lit toutes les affectations de direction', 't_qualite', null, 'directions', n_dir);
  perform pg_temp.lire_n('t_qualite (Directions : Voir) ne lit que sa propre ligne de siège', 't_qualite', null, 'sieges', '1');
  perform pg_temp.lire_n('t_qualite (Directions : Voir) ne lit aucune affectation de formateur', 't_qualite', null, 'formateurs', '0');
  perform pg_temp.verifier('lectures', 't_qualite (Directions : Voir) : roles_du_personnel() rend au moins une ligne (geste directions.lire)',
    pg_temp.appeler_a('t_qualite', null, null, pg_temp.lecture_sql('roles_du_personnel')) ~ '^OK [1-9]', pg_temp.appeler_a('t_qualite', null, null, pg_temp.lecture_sql('roles_du_personnel')));
  -- t_dirs (réseau : Directions Modifier) : lit les directions, pas les sièges des autres.
  perform pg_temp.lire_n('t_dirs (Directions : Modifier) lit toutes les affectations de direction', 't_dirs', null, 'directions', n_dir);
  perform pg_temp.lire_n('t_dirs (Directions : Modifier) ne lit que sa propre ligne de siège', 't_dirs', null, 'sieges', '1');
  -- t_interv (promo : Réglages Non) : aucune affectation d'un autre formateur, roles_du_personnel() vide.
  perform pg_temp.lire_n('t_interv (Réglages : Non) : roles_du_personnel() rend 0 ligne', 't_interv', '1', 'roles_du_personnel', '0');
  perform pg_temp.lire_n('t_interv ne lit que sa propre ligne de formateur', 't_interv', '1', 'formateurs', '1');
  perform pg_temp.lire_n('t_interv ne lit aucune affectation de direction', 't_interv', '1', 'directions', '0');
  -- t_rh (centre : Promos Voir, Équipe Voir) : les formateurs des promos de son centre, aucun d'un autre centre ; la direction de son centre (Équipe).
  perform pg_temp.lire_n('t_rh (Promos : Voir) lit les affectations de formateur des promos de son centre, aucune d''un autre centre', 't_rh', '1', 'formateurs', n_form_l1);
  perform pg_temp.lire_n('t_rh ne lit aucune affectation de siège', 't_rh', '1', 'sieges', '0');
  -- t_promos (centre : Promos Voir seul) : le geste promos.lire ouvre les formateurs du centre, et rien d'autre.
  perform pg_temp.lire_n('t_promos (Promos : Voir seul) lit les affectations de formateur des promos de son centre (promos.lire)', 't_promos', '1', 'formateurs', n_form_l1);
  perform pg_temp.lire_n('t_promos (Équipe : Non) ne lit que sa propre direction', 't_promos', '1', 'directions', '1');
  perform pg_temp.lire_n('t_promos (Réglages : Non) : roles_du_personnel() rend 0 ligne', 't_promos', '1', 'roles_du_personnel', '0');
  -- t_vide (centre : tout Non) : ni formateur, ni autre direction que la sienne.
  perform pg_temp.lire_n('t_vide (Promos : Non, Équipe : Non) ne lit aucune affectation de formateur', 't_vide', '1', 'formateurs', '0');
  perform pg_temp.lire_n('t_vide (Équipe : Non) ne lit que sa propre direction', 't_vide', '1', 'directions', '1');
  perform pg_temp.lire_n('t_vide : roles_du_personnel() rend 0 ligne', 't_vide', '1', 'roles_du_personnel', '0');
  -- t_chef (centre : Promos Voir, Stagiaires Voir, Équipe Modifier) : la direction et les formateurs de son centre.
  perform pg_temp.lire_n('t_chef (Équipe : Modifier) lit les affectations de formateur des promos de son centre', 't_chef', '1', 'formateurs', n_form_l1);
  perform pg_temp.verifier('lectures', 't_chef (Équipe : Modifier) : roles_du_personnel() rend au moins une ligne',
    (select rr.valeur ~ '^OK [1-9]' from (select pg_temp.appeler_a('t_chef', '1', null, pg_temp.lecture_sql('roles_du_personnel')) as valeur) rr),
    pg_temp.appeler_a('t_chef', '1', null, pg_temp.lecture_sql('roles_du_personnel')));
  -- Les notes visibles : seuls les membres de la promo et les titres qui ont « Notes et examens » en lisent la liste.
  perform pg_temp.lire_n('t_secr rend 0 identifiant de notes visibles (pas de case Notes)', 't_secr', '1', 'notes_visibles', '0');
  perform pg_temp.lire_n('t_interv rend 0 identifiant de notes visibles', 't_interv', '1', 'notes_visibles', '0');
  perform pg_temp.lire_n('t_rh rend 0 identifiant de notes visibles', 't_rh', '1', 'notes_visibles', '0');
  perform pg_temp.lire_n('stag_n (membre de la promo 1) lit la liste de la promo sans les camarades qui ont masqué leurs notes', 'stag_n', '1', 'notes_visibles', n_stag_vis);
  perform pg_temp.lire_n('form_n (Notes et examens : Modifier) lit la liste de la promo', 'form_n', '1', 'notes_visibles', n_stag);
  -- Les titres fixes : mêmes nombres qu'avant la migration pour chaque lecture (relevé d'avant comparé au relevé d'après).
  if p_compare then
    for r in select a.qui, a.lecture, a.valeur as avant, b.valeur as apres
               from pg_temp.releves a join pg_temp.releves b on b.qui = a.qui and b.lecture = a.lecture and b.etape = 'apres'
              where a.etape = 'avant' order by a.qui collate "C", a.lecture collate "C" loop
      perform pg_temp.verifier('lectures', format('%s : %s rend le même nombre qu''avant la migration', r.qui, r.lecture), r.avant is not distinct from r.apres,
        format('avant %s ; après %s', r.avant, r.apres));
    end loop;
    perform pg_temp.verifier('lectures', 'le relevé d''avant porte 35 nombres, tous lus (jamais un contrôle à vide)',
      (select count(*) = 35 and bool_and(valeur ~ '^OK [0-9]+$') from pg_temp.releves where etape = 'avant'),
      (select string_agg(qui || '.' || lecture || '=' || valeur, ' ; ') from pg_temp.releves where etape = 'avant' and valeur !~ '^OK [0-9]+$'));
  else
    perform pg_temp.informer('lectures : même nombre qu''avant la migration', 'non jugeable (migration 5 non injectée dans ce mode)');
  end if;
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L', e_promos));
  perform pg_temp.essai(format('delete from public.user_profiles where lower(email) = %L', e_promos));
  perform pg_temp.essai(format('delete from public.titres where id = %s', v_titre_promos));
  perform pg_temp.essai('delete from pg_temp.perso where nom = ''t_promos''');
end $tgl$;

-- Aides de l'étape 2b. L'adresse d'un personnage ; l'identifiant (en texte) du premier titre qu'il porte ; le verrou des titres non fixes
-- ouvert ou fermé en propriétaire (le groupe verrou, lui, le règle par la fonction du fondateur).
create or replace function pg_temp.e(p_nom text)
returns text language plpgsql as $tg15a$
begin
  return (select email from pg_temp.perso where nom = p_nom);
end $tg15a$;

create or replace function pg_temp.titre_de(p_nom text)
returns text language sql as $tg15b$
  select pg_temp.calcul(format('select a.titre_id::text from public.affectations a join pg_temp.perso p on lower(a.email) = p.email where p.nom = %L order by a.id limit 1', p_nom));
$tg15b$;

create or replace function pg_temp.verrou(p_ouvert boolean)
returns text language plpgsql as $tg15c$
begin
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  if p_ouvert then
    return pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('titres_ouverts', 'oui', null)$q$);
  end if;
  return 'OK';
end $tg15c$;

-- Groupe verrou (migration 6, partie A) : le verrou des titres non fixes (réglé par le fondateur seul) et les aides de décision
-- (_cases_effectives, _depasse), jugées ici une à une ; leurs règles sont jugées par les groupes donner, retirer et gerer.
create or replace function pg_temp.groupe_verrou()
returns void language plpgsql as $tgvr$
declare
  t_form text := pg_temp.calcul($q$select public.titre_fixe('promo')::text$q$);
  t_dir text := pg_temp.calcul($q$select public.titre_fixe('centre')::text$q$);
  t_siege text := pg_temp.calcul($q$select public.titre_fixe('reseau')::text$q$);
  t_interv text := pg_temp.titre_de('t_interv');
  t_secr text := pg_temp.titre_de('t_secr');
  t_rh text := pg_temp.titre_de('t_rh');
  t_contenus text := pg_temp.titre_de('t_contenus');
  t_chef text := pg_temp.titre_de('t_chef');
  t_vide text := pg_temp.titre_de('t_vide');
  t_qualite text := pg_temp.titre_de('t_qualite');
  t_dirs text := pg_temp.titre_de('t_dirs');
  c_form constant text := '{"planning":"modifier","emargement":"modifier","stagiaires":"modifier","notes":"modifier","cours":"modifier","ccp2":"voir","indicateurs":"voir","reglages":"modifier"}';
  c_dir constant text := '{"promos":"modifier","stagiaires":"modifier","emargement":"voir","notes":"voir","equipe":"modifier","reglages":"modifier"}';
  c_siege constant text := '{"cours":"modifier","directions":"modifier","reglages":"modifier"}';
  c_interv constant text := '{"planning":"voir","emargement":"modifier","stagiaires":"voir","notes":"non","cours":"voir","ccp2":"non","indicateurs":"non","reglages":"non"}';
  c_rh constant text := '{"promos":"voir","stagiaires":"non","emargement":"non","notes":"non","equipe":"voir","reglages":"non"}';
  c_vide constant text := '{"promos":"non","stagiaires":"non","emargement":"non","notes":"non","equipe":"non","reglages":"non"}';
begin
  -- Le départ : aucune ligne, verrou fermé pour tous.
  perform pg_temp.attendre('verrou', 'départ : aucune ligne titres_ouverts dans les réglages',
    pg_temp.calcul($q$select count(*)::text from public.settings where promo_id is null and key = 'titres_ouverts'$q$), '0');
  perform pg_temp.attendre('verrou', 'titres_ouverts() est faux au départ (propriétaire)', pg_temp.calcul('select public.titres_ouverts()::text'), 'false');
  perform pg_temp.attendre('verrou', 'titres_ouverts() est faux au départ (dir_n)', pg_temp.appeler_a('dir_n', '1', null, 'select public.titres_ouverts()::text'), 'OK false');
  -- Seul le fondateur le règle.
  perform pg_temp.attendre('verrou', 'dir_n ne lève pas le verrou : refusé (42501)',
    pg_temp.appeler_a('dir_n', '1', null, 'select public.regler_titres_ouverts(true)::text'), 'ERREUR 42501 titres: Réservé au fondateur.');
  perform pg_temp.attendre('verrou', 'siege ne lève pas le verrou : refusé (42501)',
    pg_temp.appeler_a('siege', null, null, 'select public.regler_titres_ouverts(true)::text'), 'ERREUR 42501 titres: Réservé au fondateur.');
  perform pg_temp.attendre('verrou', 't_dirs (Directions : Modifier) ne lève pas le verrou : refusé (42501)',
    pg_temp.appeler_a('t_dirs', null, null, 'select public.regler_titres_ouverts(true)::text'), 'ERREUR 42501 titres: Réservé au fondateur.');
  perform pg_temp.attendre('verrou', 'un jeton sans adresse ne règle pas le verrou : refusé (42501)',
    pg_temp.appeler_a(null, null, null, 'select public.regler_titres_ouverts(true)::text'), 'ERREUR 42501 titres: Réservé au fondateur.');
  perform pg_temp.attendre('verrou', 'le fondateur en aperçu siège ne règle pas le verrou : refusé (42501)',
    pg_temp.appeler_a('fond', null, 'siege', 'select public.regler_titres_ouverts(true)::text'), 'ERREUR 42501 titres: Réservé au fondateur.');
  perform pg_temp.attendre('verrou', 'le fondateur en aperçu direction ne le règle pas non plus',
    pg_temp.appeler_a('fond', '1', 'direction', 'select public.regler_titres_ouverts(true)::text'), 'ERREUR 42501 titres: Réservé au fondateur.');
  perform pg_temp.attendre('verrou', 'les refus n''ont rien écrit : le verrou est toujours fermé',
    pg_temp.calcul('select public.titres_ouverts()::text'), 'false');
  -- Le fondateur lève puis ferme le verrou.
  perform pg_temp.attendre('verrou', 'le fondateur lève le verrou : vrai',
    pg_temp.appeler_a('fond', '1', null, 'select public.regler_titres_ouverts(true)::text'), 'OK true');
  perform pg_temp.attendre('verrou', 'après sa levée, titres_ouverts() est vrai pour tous (dir_n)',
    pg_temp.appeler_a('dir_n', '1', null, 'select public.titres_ouverts()::text'), 'OK true');
  perform pg_temp.attendre('verrou', 'la levée est une seule ligne globale (sans promo)',
    pg_temp.calcul($q$select count(*)::text || '/' || min(value) from public.settings where promo_id is null and key = 'titres_ouverts'$q$), '1/oui');
  perform pg_temp.attendre('verrou', 'lever deux fois ne double pas la ligne',
    pg_temp.appeler_a('fond', '1', null, 'select public.regler_titres_ouverts(true)::text') || ' / '
      || pg_temp.calcul($q$select count(*)::text from public.settings where promo_id is null and key = 'titres_ouverts'$q$), 'OK true / 1');
  perform pg_temp.attendre('verrou', 'le fondateur ferme le verrou : faux',
    pg_temp.appeler_a('fond', '1', null, 'select public.regler_titres_ouverts(false)::text'), 'OK false');
  perform pg_temp.attendre('verrou', 'après sa fermeture, la ligne a disparu et titres_ouverts() est faux',
    pg_temp.calcul($q$select count(*)::text from public.settings where promo_id is null and key = 'titres_ouverts'$q$) || ' / '
      || pg_temp.calcul('select public.titres_ouverts()::text'), '0 / false');
  perform pg_temp.attendre('verrou', 'regler_titres_ouverts(nul) vaut fermer',
    pg_temp.appeler_a('fond', '1', null, 'select public.regler_titres_ouverts(null)::text'), 'OK false');
  -- La contrainte des réglages globaux : la clé du verrou est admise sans promo, une clé inconnue reste refusée.
  perform pg_temp.attendre('verrou', 'une ligne titres_ouverts sans promo est admise par la contrainte des réglages globaux',
    pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('titres_ouverts', 'oui', null)$q$), 'OK');
  perform pg_temp.attendre('verrou', 'la ligne posée à la main ouvre le verrou : titres_ouverts() est vrai',
    pg_temp.calcul('select public.titres_ouverts()::text'), 'true');
  perform pg_temp.verrou(false);
  perform pg_temp.attendre('verrou', 'une clé globale inconnue reste refusée (23514)',
    pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('cle_inconnue_preuve8', 'oui', null)$q$), 'ERREUR 23514');
  perform pg_temp.attendre('verrou', 'une clé d''avant reste admise sans promo (habillage_reseau)',
    pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('habillage_reseau', 'ecsr', null)$q$), 'OK');
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'habillage_reseau'$q$);
  -- Les droits d'exécution : le verrou à authenticated seul, les aides à personne.
  perform pg_temp.attendre('verrou', 'droits : titres_ouverts et regler_titres_ouverts pour authenticated, pas pour anon',
    pg_temp.calcul($q$select concat_ws('/',
      has_function_privilege('authenticated', 'public.titres_ouverts()', 'execute')::text,
      has_function_privilege('authenticated', 'public.regler_titres_ouverts(boolean)', 'execute')::text,
      has_function_privilege('anon', 'public.titres_ouverts()', 'execute')::text,
      has_function_privilege('anon', 'public.regler_titres_ouverts(boolean)', 'execute')::text)$q$), 'true/true/false/false');
  perform pg_temp.attendre('verrou', 'droits : les aides internes existent et n''ont aucun droit d''exécution (authenticated, anon, service_role)',
    pg_temp.calcul($q$select count(*)::text from (values ('public._cases_effectives(bigint)'), ('public._depasse(jsonb, jsonb)'),
      ('public._refus_titre(bigint, integer, text, text)'), ('public._cases_appelant(text, integer)')) f(sig)
      cross join (values ('authenticated'), ('anon'), ('service_role')) r(nom)
      where to_regprocedure(f.sig) is null or has_function_privilege(r.nom, f.sig, 'execute')$q$), '0');

  -- _cases_effectives : un titre fixe est au plafond de chaque page de son niveau, un titre non fixe donne ses cases (pages absentes à non).
  perform pg_temp.attendre('verrou', '_cases_effectives(Formateur) : huit pages au plafond',
    pg_temp.calcul(format($q$select (public._cases_effectives(%s) = %L::jsonb)::text$q$, t_form, c_form)), 'true');
  perform pg_temp.attendre('verrou', '_cases_effectives(Direction de centre) : six pages au plafond',
    pg_temp.calcul(format($q$select (public._cases_effectives(%s) = %L::jsonb)::text$q$, t_dir, c_dir)), 'true');
  perform pg_temp.attendre('verrou', '_cases_effectives(Siège) : trois pages à Modifier',
    pg_temp.calcul(format($q$select (public._cases_effectives(%s) = %L::jsonb)::text$q$, t_siege, c_siege)), 'true');
  perform pg_temp.attendre('verrou', '_cases_effectives(Intervenant) : ses quatre cases, les quatre autres pages à non',
    pg_temp.calcul(format($q$select (public._cases_effectives(%s) = %L::jsonb)::text$q$, t_interv, c_interv)), 'true');
  perform pg_temp.attendre('verrou', '_cases_effectives(titre de t_rh) : six pages, Promos et Équipe à Voir, le reste à non',
    pg_temp.calcul(format($q$select (public._cases_effectives(%s) = %L::jsonb)::text$q$, t_rh, c_rh)), 'true');
  perform pg_temp.attendre('verrou', '_cases_effectives(titre vide de t_vide) : six pages, toutes à non',
    pg_temp.calcul(format($q$select (public._cases_effectives(%s) = %L::jsonb)::text$q$, t_vide, c_vide)), 'true');
  perform pg_temp.attendre('verrou', '_cases_effectives(titre inconnu) : nul', pg_temp.calcul('select public._cases_effectives(-1)::text'), null);
  -- _depasse : la première page, dans l'ordre des pages du niveau, où les cases ouvrent plus que la limite.
  perform pg_temp.attendre('verrou', '_depasse(Secrétariat, titre de t_chef) : stagiaires (Modifier contre Voir), avant émargement',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_secr, t_chef)), 'stagiaires');
  perform pg_temp.attendre('verrou', '_depasse(titre de t_chef, Secrétariat) : equipe (Modifier contre Voir)',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_chef, t_secr)), 'equipe');
  perform pg_temp.attendre('verrou', '_depasse(titre de t_rh, titre de t_chef) : nul (au plus égal)',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_rh, t_chef)), null);
  perform pg_temp.attendre('verrou', '_depasse(un titre, lui-même) : nul',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_secr, t_secr)), null);
  perform pg_temp.attendre('verrou', '_depasse(Contenus, titre de t_dirs) : cours (Modifier contre Voir), au réseau',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_contenus, t_dirs)), 'cours');
  perform pg_temp.attendre('verrou', '_depasse(Qualité, titre de t_dirs) : nul',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_qualite, t_dirs)), null);
  perform pg_temp.attendre('verrou', '_depasse(Intervenant, Formateur) : nul (un titre fixe est au plafond)',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_interv, t_form)), null);
  perform pg_temp.attendre('verrou', '_depasse(Formateur, Intervenant) : planning (la première page de l''ordre du niveau)',
    pg_temp.calcul(format('select public._depasse(public._cases_effectives(%s), public._cases_effectives(%s))', t_form, t_interv)), 'planning');
  perform pg_temp.attendre('verrou', '_depasse : des cases partielles (pages absentes = non) se jugent comme les autres',
    pg_temp.calcul(format($q$select public._depasse('{"promos":"voir","equipe":"modifier"}'::jsonb, public._cases_effectives(%s))$q$, t_rh)), 'equipe');
  perform pg_temp.attendre('verrou', '_depasse : une page de plus que la limite ne dit rien d''une page absente des deux côtés',
    pg_temp.calcul(format($q$select public._depasse('{"promos":"voir","notes":"non"}'::jsonb, public._cases_effectives(%s))$q$, t_rh)), null);
end $tgvr$;

-- donner_titre(adresse, titre, centre, promos) jouée par un personnage : « OK cree=…/transforme=…/remplace=…/ajoutees=…/retirees=… » ou l'erreur.
-- p_titre, p_lieu et p_promos en texte SQL (un identifiant ou « null » ; « '{1,2}'::integer[] » ou « null »).
create or replace function pg_temp.donner(p_qui text, p_entete text, p_apercu text, p_email text, p_titre text, p_lieu text, p_promos text)
returns text language sql as $tg16a$
  select pg_temp.appeler_a(p_qui, p_entete, p_apercu, format(
    $q$select concat_ws('/', 'cree=' || (r->>'cree'), 'transforme=' || (r->>'transforme'), 'remplace=' || coalesce(r->>'remplace', 'nul'),
         'ajoutees=' || (r->>'ajoutees'), 'retirees=' || (r->>'retirees'))
       from (select public.donner_titre(%L, %s, %s, %s) as r) q$q$, p_email, p_titre, p_lieu, p_promos));
$tg16a$;

-- Le texte d'une réponse de donner_titre qui réussit.
create or replace function pg_temp.reponse_donner(p_cree boolean, p_transforme boolean, p_remplace text, p_ajoutees text, p_retirees text)
returns text language sql as $tg16b$
  select format('OK cree=%s/transforme=%s/remplace=%s/ajoutees=%s/retirees=%s', p_cree::text, p_transforme::text, coalesce(p_remplace, 'nul'), p_ajoutees, p_retirees);
$tg16b$;

-- Le compte du personnel d'un personnage libre (x, y, z, u, v), posé en propriétaire.
create or replace function pg_temp.personnel(p_nom text)
returns text language sql as $tg16c$
  select pg_temp.essai(format('insert into public.user_profiles (email, role, is_admin) values (%L, ''prof'', false) on conflict (email) do nothing', pg_temp.e(p_nom)));
$tg16c$;

-- Les cinq adresses libres redeviennent libres : le profil part, ses affectations avec lui (suppression en cascade).
create or replace function pg_temp.liberer()
returns void language plpgsql as $tg16d$
begin
  perform pg_temp.essai(format('delete from public.user_profiles where lower(email) in (%L, %L, %L, %L, %L)',
    pg_temp.e('x'), pg_temp.e('y'), pg_temp.e('z'), pg_temp.e('u'), pg_temp.e('v')));
end $tg16d$;

-- Le profil d'un personnage, en texte : « role/is_admin/invité par (oui/non d'après une adresse donnée) ».
create or replace function pg_temp.profil(p_nom text)
returns text language sql as $tg16e$
  select coalesce(pg_temp.calcul(format('select role || ''/'' || is_admin::text || ''/'' || coalesce(lower(invited_by_email), ''nul'') from public.user_profiles where lower(email) = lower(%L)', pg_temp.e(p_nom))), 'aucun');
$tg16e$;

-- Groupe donner (migration 6, partie B) : donner_titre, avec les règles du § 7 une par une. Verrou fermé au départ, ouvert en propriétaire
-- après le premier cas ; il reste ouvert pour les groupes suivants.
create or replace function pg_temp.groupe_donner()
returns void language plpgsql as $tgdo$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_l1t text; v_l2t text;
  v_a constant text := '990801';
  t_form text := pg_temp.calcul($q$select public.titre_fixe('promo')::text$q$);
  t_dir text := pg_temp.calcul($q$select public.titre_fixe('centre')::text$q$);
  t_siege text := pg_temp.calcul($q$select public.titre_fixe('reseau')::text$q$);
  t_interv text := pg_temp.titre_de('t_interv');
  t_secr text := pg_temp.titre_de('t_secr');
  t_rh text := pg_temp.titre_de('t_rh');
  t_contenus text := pg_temp.titre_de('t_contenus');
  t_chef text := pg_temp.titre_de('t_chef');
  t_vide text := pg_temp.titre_de('t_vide');
  t_qualite text := pg_temp.titre_de('t_qualite');
  e_x text := pg_temp.e('x'); e_y text := pg_temp.e('y'); e_z text := pg_temp.e('z');
  e_form_n text := pg_temp.e('form_n'); e_dir_n text := pg_temp.e('dir_n'); e_siege text := pg_temp.e('siege');
  e_stag_n text := pg_temp.e('stag_n'); e_orph text := pg_temp.e('orphelin'); e_chef text := pg_temp.e('t_chef'); e_secr text := pg_temp.e('t_secr');
  v_promos_1 constant text := '''{1}''::integer[]';
begin
  v_l1t := v_l1::text; v_l2t := v_l2::text;
  perform pg_temp.liberer();
  perform pg_temp.verrou(false);
  perform pg_temp.verifier('donner', 'départ : les titres de la preuve existent et les cinq adresses libres le sont',
    t_form ~ '^[0-9]+$' and t_interv ~ '^[0-9]+$' and t_secr ~ '^[0-9]+$' and t_rh ~ '^[0-9]+$' and t_chef ~ '^[0-9]+$' and t_vide ~ '^[0-9]+$'
    and t_qualite ~ '^[0-9]+$' and t_contenus ~ '^[0-9]+$' and pg_temp.profil('x') = 'aucun' and pg_temp.profil('y') = 'aucun'
    and pg_temp.lignes(e_dir_n, 'formateur') = '0' and pg_temp.lignes(e_form_n, 'formateur') = '1' and v_l1 <> v_l2,
    format('titres %s %s %s %s %s %s ; dir_n formateur %s ; form_n formateur %s', t_form, t_interv, t_secr, t_rh, t_chef, t_vide,
      pg_temp.lignes(e_dir_n, 'formateur'), pg_temp.lignes(e_form_n, 'formateur')));

  -- 1. Le verrou fermé : un titre non fixe ne se donne pas encore ; rien n'est écrit.
  perform pg_temp.attendre('donner', 'verrou fermé : dir_n donne Intervenant à x (promo 1) : refusé, aucun profil créé',
    pg_temp.donner('dir_n', '1', null, e_x, t_interv, v_l1t, v_promos_1) || ' / ' || pg_temp.profil('x'),
    'ERREUR P0001 titres: Ce titre ne peut pas encore être donné. / aucun');
  perform pg_temp.attendre('donner', 'verrou fermé : t_chef donne le titre de t_rh à x (centre) : refusé de même',
    pg_temp.donner('t_chef', '1', null, e_x, t_rh, v_l1t, 'null') || ' / ' || pg_temp.profil('x'),
    'ERREUR P0001 titres: Ce titre ne peut pas encore être donné. / aucun');
  perform pg_temp.verrou(true);

  -- 2. Les titres fixes se donnent comme aujourd'hui.
  perform pg_temp.attendre('donner', 'dir_n se donne Formateur (promo 1) : permis, une ligne (la directrice qui forme)',
    pg_temp.donner('dir_n', '1', null, e_dir_n, t_form, v_l1t, v_promos_1) || ' / ' || pg_temp.lignes(e_dir_n, 'formateur'),
    pg_temp.reponse_donner(false, false, null, '[1]', '[]') || ' / 1');
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L and role = ''formateur''', e_dir_n));
  perform pg_temp.attendre('donner', 'dir_n donne Direction de centre à x : refusé (42501), réservé au siège',
    pg_temp.donner('dir_n', '1', null, e_x, t_dir, v_l1t, 'null') || ' / ' || pg_temp.profil('x'),
    'ERREUR 42501 titres: Réservé au siège. / aucun');
  perform pg_temp.attendre('donner', 'siege se donne Direction de centre (centre 1) : refusé (42501), jamais sur soi',
    pg_temp.donner('siege', null, null, e_siege, t_dir, v_l1t, 'null') || ' / ' || pg_temp.lignes(e_siege, 'direction'),
    'ERREUR 42501 titres: Vous ne pouvez pas changer vos propres titres. / 0');
  perform pg_temp.attendre('donner', 'la casse ne contourne pas la règle : siege se donne Direction de centre avec son adresse en majuscules',
    pg_temp.donner('siege', null, null, upper(e_siege), t_dir, v_l1t, 'null') || ' / ' || pg_temp.lignes(e_siege, 'direction'),
    'ERREUR 42501 titres: Vous ne pouvez pas changer vos propres titres. / 0');
  perform pg_temp.attendre('donner', 'siege donne Direction de centre à x (centre 1) : permis, profil créé (cree vrai)',
    pg_temp.donner('siege', null, null, e_x, t_dir, v_l1t, 'null') || ' / ' || pg_temp.lignes(e_x, 'direction'),
    pg_temp.reponse_donner(true, false, null, '[]', '[]') || ' / 1');
  perform pg_temp.attendre('donner', 'le profil créé est un compte du personnel sans droit d''administrateur, invité par le siège',
    pg_temp.profil('x'), 'prof/false/' || lower(e_siege));
  perform pg_temp.attendre('donner', 'siege donne Siège à x : refusé (42501), réservé au fondateur',
    pg_temp.donner('siege', null, null, e_x, t_siege, 'null', 'null') || ' / ' || pg_temp.lignes(e_x, 'siege'),
    'ERREUR 42501 titres: Réservé au fondateur. / 0');
  perform pg_temp.attendre('donner', 'fond (fondateur) se donne Direction de centre : aucun titre à un compte stagiaire (il a une fiche)',
    pg_temp.donner('fond', '1', null, pg_temp.e('fond'), t_dir, v_l1t, 'null'),
    'ERREUR P0001 titres: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('donner', 'le fondateur en aperçu siège se donne Direction de centre : refusé (42501)',
    pg_temp.donner('fond', null, 'siege', pg_temp.e('fond'), t_dir, v_l1t, 'null'),
    'ERREUR 42501 titres: Vous ne pouvez pas changer vos propres titres.');
  perform pg_temp.attendre('donner', 'le fondateur en aperçu direction ne donne pas Direction de centre (réservé au siège)',
    pg_temp.donner('fond', '1', 'direction', e_z, t_dir, v_l1t, 'null') || ' / ' || pg_temp.profil('z'),
    'ERREUR 42501 titres: Réservé au siège. / aucun');
  perform pg_temp.attendre('donner', 'le fondateur donne le titre Siège à z : permis (profil créé), la seule voie ouverte au siège fixe',
    pg_temp.donner('fond', '1', null, e_z, t_siege, 'null', 'null') || ' / ' || pg_temp.lignes(e_z, 'siege'),
    pg_temp.reponse_donner(true, false, null, '[]', '[]') || ' / 1');
  perform pg_temp.liberer();

  -- 3. Un titre de promo non fixe : l'équipe du centre (Équipe : Modifier) le donne sur les promos de son centre.
  perform pg_temp.attendre('donner', 't_chef donne Intervenant à y (promos 1 et A) : permis, profil créé, deux lignes',
    pg_temp.donner('t_chef', '1', null, e_y, t_interv, v_l1t, format('''{1,%s}''::integer[]', v_a)) || ' / ' || pg_temp.lignes(e_y, 'formateur'),
    pg_temp.reponse_donner(true, false, null, '[1, ' || v_a || ']', '[]') || ' / 2');
  perform pg_temp.attendre('donner', 'le profil d''un titre de promo est celui d''un formateur (administrateur), invité par t_chef',
    pg_temp.profil('y'), 'prof/true/' || lower(e_chef));
  perform pg_temp.attendre('donner', 't_chef redonne Intervenant à y (promo A seule) : la promo 1 est retirée',
    pg_temp.donner('t_chef', '1', null, e_y, t_interv, v_l1t, format('''{%s}''::integer[]', v_a)) || ' / ' || pg_temp.lignes(e_y, 'formateur'),
    pg_temp.reponse_donner(false, false, null, '[]', '[1]') || ' / 1');
  perform pg_temp.attendre('donner', 'les lignes d''y portent le titre Intervenant',
    pg_temp.calcul(format('select count(*)::text from public.affectations where lower(email) = lower(%L) and role = ''formateur'' and titre_id = %s', e_y, t_interv)), '1');
  perform pg_temp.attendre('donner', 't_chef donne Intervenant à y sur la promo 2 (autre centre) : refusé, rien ne bouge',
    pg_temp.donner('t_chef', '1', null, e_y, t_interv, v_l1t, '''{2}''::integer[]') || ' / ' || pg_temp.lignes(e_y, 'formateur'),
    'ERREUR P0001 titres: Une promo choisie n''est pas dans ce centre. / 1');
  perform pg_temp.attendre('donner', 't_chef donne Intervenant à y sans promo (liste vide) : refusé',
    pg_temp.donner('t_chef', '1', null, e_y, t_interv, v_l1t, '''{}''::integer[]'), 'ERREUR P0001 titres: Choisissez au moins une promo.');
  perform pg_temp.attendre('donner', 't_chef donne Intervenant à y sans promo (nul) : refusé',
    pg_temp.donner('t_chef', '1', null, e_y, t_interv, v_l1t, 'null'), 'ERREUR P0001 titres: Choisissez au moins une promo.');
  perform pg_temp.attendre('donner', 't_chef donne Formateur à y : refusé (42501), réservé à la direction du centre',
    pg_temp.donner('t_chef', '1', null, e_y, t_form, v_l1t, v_promos_1), 'ERREUR 42501 titres: Réservé à la direction du centre.');
  perform pg_temp.attendre('donner', 't_chef donne le titre de t_secr (Stagiaires : Modifier) à y : refusé (42501), plus que le sien',
    pg_temp.donner('t_chef', '1', null, e_y, t_secr, v_l1t, 'null'), 'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (stagiaires).');
  perform pg_temp.attendre('donner', 't_chef donne le titre de t_rh à y : permis (au plus égal au sien), une ligne de direction',
    pg_temp.donner('t_chef', '1', null, e_y, t_rh, v_l1t, 'null') || ' / ' || pg_temp.lignes(e_y, 'direction') || ' / ' || pg_temp.lignes(e_y, 'formateur'),
    pg_temp.reponse_donner(false, false, null, '[]', '[]') || ' / 1 / 1');
  perform pg_temp.attendre('donner', 't_chef se donne le titre de t_rh : refusé (42501), jamais sur soi',
    pg_temp.donner('t_chef', '1', null, e_chef, t_rh, v_l1t, 'null'), 'ERREUR 42501 titres: Vous ne pouvez pas changer vos propres titres.');
  perform pg_temp.attendre('donner', 't_rh (Équipe : Voir) donne le titre de t_rh à z : refusé (42501), réservé à l''équipe du centre',
    pg_temp.donner('t_rh', '1', null, e_z, t_rh, v_l1t, 'null') || ' / ' || pg_temp.profil('z'),
    'ERREUR 42501 titres: Réservé à l''équipe du centre. / aucun');
  perform pg_temp.attendre('donner', 't_vide (titre sans case) donne Intervenant à z : refusé (42501)',
    pg_temp.donner('t_vide', '1', null, e_z, t_interv, v_l1t, v_promos_1), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('donner', 'un titre du centre 1 ne se donne pas dans le centre 2 (t_chef n''y a aucun droit : refusé sans rien écrire)',
    pg_temp.donner('t_chef', '1', null, e_z, t_rh, v_l2t, 'null') || ' / ' || pg_temp.profil('z'),
    'ERREUR P0001 titres: Ce titre appartient à un autre centre. / aucun');

  -- 4. Un seul titre par niveau et par centre : donner un autre titre au même niveau remplace l'ancien, qui obéit aux règles du retrait.
  perform pg_temp.attendre('donner', 't_chef donne Intervenant à form_n (Formateur, promo 1) : refusé (42501), remplacer c''est retirer Formateur',
    pg_temp.donner('t_chef', '1', null, e_form_n, t_interv, v_l1t, v_promos_1) || ' / ' || pg_temp.lignes(e_form_n, 'formateur'),
    'ERREUR 42501 titres: Réservé à la direction du centre. / 1');
  perform pg_temp.attendre('donner', 'dir_n donne Intervenant à form_n (promo 1) : permis, Formateur remplacé',
    pg_temp.donner('dir_n', '1', null, e_form_n, t_interv, v_l1t, v_promos_1) || ' / ' || pg_temp.lignes(e_form_n, 'formateur'),
    pg_temp.reponse_donner(false, false, t_form, '[1]', '[]') || ' / 1');
  perform pg_temp.attendre('donner', 'form_n porte maintenant Intervenant, plus Formateur',
    pg_temp.calcul(format('select count(*)::text from public.affectations where lower(email) = lower(%L) and role = ''formateur'' and titre_id = %s', e_form_n, t_interv))
      || '/' || pg_temp.calcul(format('select count(*)::text from public.affectations where lower(email) = lower(%L) and titre_id = %s', e_form_n, t_form)), '1/0');
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L and role = ''formateur''', e_form_n));
  perform pg_temp.affecter(e_form_n, 'formateur', 1, null, null);
  perform pg_temp.attendre('donner', 't_chef donne le titre vide de t_vide à y : l''ancien titre de centre (celui de t_rh) est remplacé',
    pg_temp.donner('t_chef', '1', null, e_y, t_vide, v_l1t, 'null') || ' / ' || pg_temp.lignes(e_y, 'direction'),
    pg_temp.reponse_donner(false, false, t_rh, '[]', '[]') || ' / 1');
  perform pg_temp.attendre('donner', 't_chef donne le titre de t_rh à t_secr (qui porte Secrétariat) : refusé (42501), remplacer c''est retirer plus que le sien',
    pg_temp.donner('t_chef', '1', null, e_secr, t_rh, v_l1t, 'null') || ' / ' || pg_temp.titre_de('t_secr'),
    'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (stagiaires). / ' || t_secr);
  perform pg_temp.attendre('donner', 'une adresse écrite en majuscules désigne la même personne : pas de second profil, ses promos sont recalculées',
    pg_temp.donner('t_chef', '1', null, upper(e_y), t_interv, v_l1t, v_promos_1) || ' / '
      || pg_temp.calcul(format('select count(*)::text from public.user_profiles where lower(email) = lower(%L)', e_y)),
    pg_temp.reponse_donner(false, false, null, '[1]', '[' || v_a || ']') || ' / 1');

  -- 5. Aucun titre à un compte stagiaire, quel que soit le niveau ; le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
  perform pg_temp.attendre('donner', 't_chef donne Intervenant à stag_n : refusé, cette adresse est celle d''un compte stagiaire',
    pg_temp.donner('t_chef', '1', null, e_stag_n, t_interv, v_l1t, v_promos_1) || ' / ' || pg_temp.lignes(e_stag_n, 'formateur'),
    'ERREUR P0001 titres: Cette adresse est celle d''un compte stagiaire. / 0');
  perform pg_temp.attendre('donner', 't_chef donne le titre de t_rh à stag_n (niveau centre) : refusé de même, même en majuscules',
    pg_temp.donner('t_chef', '1', null, upper(e_stag_n), t_rh, v_l1t, 'null') || ' / ' || pg_temp.lignes(e_stag_n, 'direction'),
    'ERREUR P0001 titres: Cette adresse est celle d''un compte stagiaire. / 0');
  perform pg_temp.attendre('donner', 'siege donne Direction de centre à stag_m : refusé de même',
    pg_temp.donner('siege', null, null, pg_temp.e('stag_m'), t_dir, v_l2t, 'null') || ' / ' || pg_temp.lignes(pg_temp.e('stag_m'), 'direction'),
    'ERREUR P0001 titres: Cette adresse est celle d''un compte stagiaire. / 0');
  perform pg_temp.attendre('donner', 'le fondateur donne Siège à stag_m : refusé de même (le niveau du réseau aussi)',
    pg_temp.donner('fond', '1', null, pg_temp.e('stag_m'), t_siege, 'null', 'null') || ' / ' || pg_temp.lignes(pg_temp.e('stag_m'), 'siege'),
    'ERREUR P0001 titres: Cette adresse est celle d''un compte stagiaire. / 0');
  perform pg_temp.attendre('donner', 't_chef donne Intervenant à un orphelin (compte stagiaire sans fiche) : transformé en compte du personnel',
    pg_temp.donner('t_chef', '1', null, e_orph, t_interv, v_l1t, v_promos_1) || ' / ' || pg_temp.profil('orphelin'),
    pg_temp.reponse_donner(false, true, null, '[1]', '[]') || ' / prof/true/' || lower(e_chef));
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L', e_orph));
  perform pg_temp.essai(format('update public.user_profiles set role = ''stagiaire'', is_admin = false, invited_by_email = null where lower(email) = %L', e_orph));

  -- 6. Le niveau du réseau : le siège (Directions : Modifier) donne les titres du réseau au plus égaux au sien.
  perform pg_temp.attendre('donner', 't_dirs donne le titre de t_qualite (Cours : Voir, Directions : Voir) à z : permis',
    pg_temp.donner('t_dirs', null, null, e_z, t_qualite, 'null', 'null') || ' / ' || pg_temp.lignes(e_z, 'siege'),
    pg_temp.reponse_donner(true, false, null, '[]', '[]') || ' / 1');
  perform pg_temp.attendre('donner', 't_dirs donne le titre de t_contenus (Cours : Modifier) à z : refusé (42501), plus que le sien',
    pg_temp.donner('t_dirs', null, null, e_z, t_contenus, 'null', 'null'), 'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (cours).');
  perform pg_temp.attendre('donner', 't_dirs donne le titre de t_secr dans le centre 2 : refusé, ce titre est celui d''un autre centre',
    pg_temp.donner('t_dirs', null, null, e_z, t_secr, v_l2t, 'null'), 'ERREUR P0001 titres: Ce titre appartient à un autre centre.');
  perform pg_temp.attendre('donner', 't_dirs donne Direction de centre à z : refusé (42501), réservé au siège',
    pg_temp.donner('t_dirs', null, null, e_z, t_dir, v_l1t, 'null'), 'ERREUR 42501 titres: Réservé au siège.');
  perform pg_temp.attendre('donner', 't_qualite (Directions : Voir) donne le titre de t_qualite à u : refusé (42501), réservé au réseau',
    pg_temp.donner('t_qualite', null, null, pg_temp.e('u'), t_qualite, 'null', 'null') || ' / ' || pg_temp.profil('u'),
    'ERREUR 42501 titres: Réservé au réseau. / aucun');
  perform pg_temp.attendre('donner', 'siege (titre fixe) donne le titre de t_contenus à z : permis, il remplace celui de t_qualite',
    pg_temp.donner('siege', null, null, e_z, t_contenus, 'null', 'null') || ' / ' || pg_temp.lignes(e_z, 'siege'),
    pg_temp.reponse_donner(false, false, t_qualite, '[]', '[]') || ' / 1');
  perform pg_temp.attendre('donner', 't_dirs se donne le titre de t_qualite : refusé (42501), jamais sur soi',
    pg_temp.donner('t_dirs', null, null, pg_temp.e('t_dirs'), t_qualite, 'null', 'null'), 'ERREUR 42501 titres: Vous ne pouvez pas changer vos propres titres.');
  perform pg_temp.attendre('donner', 't_dirs (Directions : Modifier) donne le titre de t_rh à u au centre 1 : permis, sans comparaison de cases',
    pg_temp.donner('t_dirs', null, null, pg_temp.e('u'), t_rh, v_l1t, 'null') || ' / ' || pg_temp.lignes(pg_temp.e('u'), 'direction'),
    pg_temp.reponse_donner(true, false, null, '[]', '[]') || ' / 1');

  -- 7. Les entrées de la fonction.
  perform pg_temp.attendre('donner', 'une adresse invalide est refusée', pg_temp.donner('t_chef', '1', null, 'pas-une-adresse', t_interv, v_l1t, v_promos_1),
    'ERREUR P0001 titres: Adresse e-mail invalide.');
  perform pg_temp.attendre('donner', 'un titre inconnu est refusé', pg_temp.donner('t_chef', '1', null, e_x, '-1', v_l1t, v_promos_1),
    'ERREUR P0001 titres: Titre introuvable.');
  perform pg_temp.attendre('donner', 'un titre de promo sans centre est refusé', pg_temp.donner('t_chef', '1', null, e_x, t_interv, 'null', v_promos_1),
    'ERREUR P0001 titres: Le centre est requis.');
  perform pg_temp.attendre('donner', 'un jeton sans adresse est refusé (42501)', pg_temp.donner(null, null, null, e_x, t_interv, v_l1t, v_promos_1),
    'ERREUR 42501 titres: Connexion requise.');
  perform pg_temp.attendre('donner', 'droits : donner_titre pour authenticated seul (ni anon ni service_role)',
    pg_temp.calcul($q$select concat_ws('/',
      has_function_privilege('authenticated', 'public.donner_titre(text, bigint, integer, integer[], integer)', 'execute')::text,
      has_function_privilege('anon', 'public.donner_titre(text, bigint, integer, integer[], integer)', 'execute')::text,
      has_function_privilege('service_role', 'public.donner_titre(text, bigint, integer, integer[], integer)', 'execute')::text)$q$), 'true/false/false');
  perform pg_temp.liberer();
end $tgdo$;

-- Groupe retirer (migration 6, partie B) : retirer_titre pour les titres non fixes (les mêmes règles que donner), et les titres fixes inchangés
-- (groupe retrait). Chaque retrait réussi est suivi de la remise de la ligne.
create or replace function pg_temp.groupe_retirer()
returns void language plpgsql as $tgre$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_l1t text; v_l2t text;
  t_interv text := pg_temp.titre_de('t_interv');
  t_secr text := pg_temp.titre_de('t_secr');
  t_rh text := pg_temp.titre_de('t_rh');
  t_contenus text := pg_temp.titre_de('t_contenus');
  t_chef text := pg_temp.titre_de('t_chef');
  t_qualite text := pg_temp.titre_de('t_qualite');
  t_dirs text := pg_temp.titre_de('t_dirs');
  t_dir text := pg_temp.calcul($q$select public.titre_fixe('centre')::text$q$);
  e_x text := pg_temp.e('x'); e_y text := pg_temp.e('y'); e_z text := pg_temp.e('z'); e_u text := pg_temp.e('u');
  e_dir_n text := pg_temp.e('dir_n'); e_secr text := pg_temp.e('t_secr'); e_chef text := pg_temp.e('t_chef'); e_dirs text := pg_temp.e('t_dirs');
begin
  v_l1t := v_l1::text; v_l2t := v_l2::text;
  perform pg_temp.liberer();
  perform pg_temp.verrou(true);
  -- Les personnages : y porte Intervenant (promo 1) et le titre de t_rh (centre 1), x la Direction de centre fixe, z Qualité, u Contenus.
  perform pg_temp.personnel('x'); perform pg_temp.personnel('y'); perform pg_temp.personnel('z'); perform pg_temp.personnel('u');
  perform pg_temp.affecter(e_y, 'formateur', 1, null, t_interv);
  perform pg_temp.affecter(e_y, 'direction', null, v_l1, t_rh);
  perform pg_temp.affecter(e_x, 'direction', null, v_l1, t_dir);
  perform pg_temp.affecter(e_z, 'siege', null, null, t_qualite);
  perform pg_temp.affecter(e_u, 'siege', null, null, t_contenus);
  perform pg_temp.verifier('retirer', 'départ : y a 1 ligne formateur et 1 de direction, x 1 de direction, z et u 1 de siège',
    pg_temp.lignes(e_y, 'formateur') = '1' and pg_temp.lignes(e_y, 'direction') = '1' and pg_temp.lignes(e_x, 'direction') = '1'
    and pg_temp.lignes(e_z, 'siege') = '1' and pg_temp.lignes(e_u, 'siege') = '1',
    format('%s %s %s %s %s', pg_temp.lignes(e_y, 'formateur'), pg_temp.lignes(e_y, 'direction'), pg_temp.lignes(e_x, 'direction'), pg_temp.lignes(e_z, 'siege'), pg_temp.lignes(e_u, 'siege')));

  perform pg_temp.attendre('retirer', 't_chef retire Intervenant de y (centre 1) : permis, la ligne part',
    pg_temp.retirer('t_chef', '1', null, e_y, t_interv, v_l1t) || ' / ' || pg_temp.lignes(e_y, 'formateur'), 'OK 1 / 0');
  perform pg_temp.affecter(e_y, 'formateur', 1, null, t_interv);
  perform pg_temp.attendre('retirer', 't_chef retire le titre de t_rh de y (centre 1) : permis',
    pg_temp.retirer('t_chef', '1', null, e_y, t_rh, v_l1t) || ' / ' || pg_temp.lignes(e_y, 'direction'), 'OK 1 / 0');
  perform pg_temp.affecter(e_y, 'direction', null, v_l1, t_rh);
  perform pg_temp.attendre('retirer', 'retirer ne dépend pas du verrou : fermé, t_chef retire encore le titre de t_rh de y',
    pg_temp.verrou(false) || ' ' || pg_temp.retirer('t_chef', '1', null, e_y, t_rh, v_l1t) || ' / ' || pg_temp.lignes(e_y, 'direction'), 'OK OK 1 / 0');
  perform pg_temp.verrou(true);
  perform pg_temp.affecter(e_y, 'direction', null, v_l1, t_rh);
  perform pg_temp.attendre('retirer', 'dir_n (direction fixe) retire Intervenant de y : permis',
    pg_temp.retirer('dir_n', '1', null, e_y, t_interv, v_l1t) || ' / ' || pg_temp.lignes(e_y, 'formateur'), 'OK 1 / 0');
  perform pg_temp.affecter(e_y, 'formateur', 1, null, t_interv);
  perform pg_temp.attendre('retirer', 'l''adresse écrite en majuscules désigne la même personne : t_chef retire Intervenant d''y',
    pg_temp.retirer('t_chef', '1', null, upper(e_y), t_interv, v_l1t) || ' / ' || pg_temp.lignes(e_y, 'formateur'), 'OK 1 / 0');
  perform pg_temp.affecter(e_y, 'formateur', 1, null, t_interv);

  perform pg_temp.attendre('retirer', 't_chef retire la Direction de centre de dir_n : refusé (42501), réservé au siège',
    pg_temp.retirer('t_chef', '1', null, e_dir_n, t_dir, v_l1t) || ' / ' || pg_temp.lignes(e_dir_n, 'direction'), 'ERREUR 42501 titres: Réservé au siège. / 1');
  perform pg_temp.attendre('retirer', 't_chef retire le titre de t_secr à t_secr : refusé (42501), plus que le sien (on ne retire que ce qu''on pourrait donner)',
    pg_temp.retirer('t_chef', '1', null, e_secr, t_secr, v_l1t) || ' / ' || pg_temp.lignes(e_secr, 'direction'),
    'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (stagiaires). / 1');
  perform pg_temp.attendre('retirer', 't_rh (Équipe : Voir) retire le titre de t_rh de y : refusé (42501)',
    pg_temp.retirer('t_rh', '1', null, e_y, t_rh, v_l1t) || ' / ' || pg_temp.lignes(e_y, 'direction'), 'ERREUR 42501 titres: Réservé à l''équipe du centre. / 1');
  perform pg_temp.attendre('retirer', 't_rh retire Intervenant d''y : refusé (42501) de même',
    pg_temp.retirer('t_rh', '1', null, e_y, t_interv, v_l1t) || ' / ' || pg_temp.lignes(e_y, 'formateur'), 'ERREUR 42501 titres: Réservé à l''équipe du centre. / 1');
  perform pg_temp.attendre('retirer', 't_chef se retire le sien : refusé (42501), jamais sur soi',
    pg_temp.retirer('t_chef', '1', null, e_chef, t_chef, v_l1t) || ' / ' || pg_temp.lignes(e_chef, 'direction'),
    'ERREUR 42501 titres: Vous ne pouvez pas retirer votre propre titre. / 1');
  -- La seule exception à « jamais sur soi » est le titre fixe Formateur de la direction : un Intervenant que dir_n se retirerait lui-même reste refusé.
  perform pg_temp.affecter(e_dir_n, 'formateur', 1, null, t_interv);
  perform pg_temp.attendre('retirer', 'dir_n porte Intervenant (posé en propriétaire) et se le retire : refusé (42501), seule l''exception du titre fixe Formateur existe',
    pg_temp.retirer('dir_n', '1', null, e_dir_n, t_interv, v_l1t) || ' / ' || pg_temp.lignes(e_dir_n, 'formateur'),
    'ERREUR 42501 titres: Vous ne pouvez pas retirer votre propre titre. / 1');
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L and role = ''formateur''', e_dir_n));
  perform pg_temp.attendre('retirer', 't_chef retire Intervenant d''y avec le centre 2 : refusé, ce titre est celui d''un autre centre',
    pg_temp.retirer('t_chef', '1', null, e_y, t_interv, v_l2t) || ' / ' || pg_temp.lignes(e_y, 'formateur'),
    'ERREUR P0001 titres: Ce titre appartient à un autre centre. / 1');
  perform pg_temp.attendre('retirer', 't_chef retire Intervenant de x, qui ne l''a pas : refusé, aucune ligne',
    pg_temp.retirer('t_chef', '1', null, e_x, t_interv, v_l1t), 'ERREUR P0001 titres: Cette personne n''a pas ce titre ici.');

  -- Le réseau.
  perform pg_temp.attendre('retirer', 't_dirs retire le titre de t_qualite de z : permis (au plus égal au sien)',
    pg_temp.retirer('t_dirs', null, null, e_z, t_qualite, 'null') || ' / ' || pg_temp.lignes(e_z, 'siege'), 'OK 1 / 0');
  perform pg_temp.affecter(e_z, 'siege', null, null, t_qualite);
  perform pg_temp.attendre('retirer', 't_dirs retire le titre de t_contenus de u : refusé (42501), plus que le sien',
    pg_temp.retirer('t_dirs', null, null, e_u, t_contenus, 'null') || ' / ' || pg_temp.lignes(e_u, 'siege'),
    'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (cours). / 1');
  perform pg_temp.attendre('retirer', 't_qualite (Directions : Voir) retire le titre de t_qualite de z : refusé (42501), réservé au réseau',
    pg_temp.retirer('t_qualite', null, null, e_z, t_qualite, 'null') || ' / ' || pg_temp.lignes(e_z, 'siege'), 'ERREUR 42501 titres: Réservé au réseau. / 1');
  perform pg_temp.attendre('retirer', 't_dirs se retire le sien : refusé (42501), jamais sur soi',
    pg_temp.retirer('t_dirs', null, null, e_dirs, t_dirs, 'null') || ' / ' || pg_temp.lignes(e_dirs, 'siege'),
    'ERREUR 42501 titres: Vous ne pouvez pas retirer votre propre titre. / 1');
  perform pg_temp.attendre('retirer', 'siege (titre fixe) retire le titre de t_contenus de u : permis',
    pg_temp.retirer('siege', null, null, e_u, t_contenus, 'null') || ' / ' || pg_temp.lignes(e_u, 'siege'), 'OK 1 / 0');
  perform pg_temp.attendre('retirer', 'un titre du réseau ignore le centre donné : siege retire le titre de t_qualite de z avec un centre quelconque',
    pg_temp.retirer('siege', null, null, e_z, t_qualite, v_l2t) || ' / ' || pg_temp.lignes(e_z, 'siege'), 'OK 1 / 0');

  -- Le retrait d'un retrait impossible ne change rien ailleurs : droits et phrases des titres fixes (groupe retrait) restent ceux d'avant.
  perform pg_temp.attendre('retirer', 'droits : retirer_titre pour authenticated seul',
    pg_temp.calcul($q$select concat_ws('/',
      has_function_privilege('authenticated', 'public.retirer_titre(text, bigint, integer)', 'execute')::text,
      has_function_privilege('anon', 'public.retirer_titre(text, bigint, integer)', 'execute')::text,
      has_function_privilege('service_role', 'public.retirer_titre(text, bigint, integer)', 'execute')::text)$q$), 'true/false/false');
  perform pg_temp.liberer();
end $tgre$;

-- Groupe immediat (migration 6, partie B) : retirer un titre prend effet à la demande suivante, sans reconnexion.
create or replace function pg_temp.groupe_immediat()
returns void language plpgsql as $tgim$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  t_interv text := pg_temp.titre_de('t_interv');
  e_v text := pg_temp.e('v');
  v_n text;
  v_refus_form constant text := 'ERREUR P0001 emargement: Réservé aux formateurs.';
begin
  perform pg_temp.liberer();
  perform pg_temp.verrou(true);
  -- Les données d'essai, posées en propriétaire : une ligne de planning de la promo 1 et l'émargement allumé.
  perform pg_temp.essai($q$delete from public.planning_entries where promo_id = 1 and slot = 9 and sujet = 'preuve8 immediat'$q$);
  perform pg_temp.essai($q$insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, promo_id, sujet) values ('2031-02-03', 0, 'matin', 9, 1, 'preuve8 immediat')$q$);
  perform pg_temp.essai($q$delete from public.settings where promo_id = 1 and key = 'emargement_actif'$q$);
  perform pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('emargement_actif', 'true', 1)$q$);
  v_n := pg_temp.calcul('select count(*)::text from public.planning_entries where promo_id = 1');
  perform pg_temp.verifier('immediat', 'départ : le planning de la promo 1 a des lignes et v n''a aucun titre',
    v_n ~ '^[0-9]+$' and v_n::integer > 0 and pg_temp.profil('v') = 'aucun', 'lignes ' || coalesce(v_n, 'nul'));
  perform pg_temp.attendre('immediat', 'v, sans titre, ne lit rien du planning de la promo 1',
    pg_temp.personnel('v') || ' ' || pg_temp.appeler_a('v', '1', null, 'select count(*)::text from public.planning_entries where promo_id = 1'), 'OK OK 0');
  perform pg_temp.attendre('immediat', 't_chef donne Intervenant à v (promo 1)',
    pg_temp.donner('t_chef', '1', null, e_v, t_interv, v_l1::text, '''{1}''::integer[]'), pg_temp.reponse_donner(false, false, null, '[1]', '[]'));
  perform pg_temp.attendre('immediat', 'dès que le titre est donné, v lit le planning de la promo 1',
    pg_temp.appeler_a('v', '1', null, 'select count(*)::text from public.planning_entries where promo_id = 1'), 'OK ' || v_n);
  perform pg_temp.attendre('immediat', 'v (Émargement : Modifier) ouvre une feuille',
    pg_temp.appeler_a('v', '1', null, $q$select (public.emargement_ouvrir('matin', '08:30', '12:00') is not null)::text$q$), 'OK true');
  perform pg_temp.attendre('immediat', 't_chef retire Intervenant à v',
    pg_temp.retirer('t_chef', '1', null, e_v, t_interv, v_l1::text), 'OK 1');
  perform pg_temp.attendre('immediat', 'la demande suivante de v, sans reconnexion : plus aucune ligne de planning',
    pg_temp.appeler_a('v', '1', null, 'select count(*)::text from public.planning_entries where promo_id = 1'), 'OK 0');
  perform pg_temp.attendre('immediat', 'la demande suivante de v : la feuille d''émargement est refusée',
    pg_temp.appeler_a('v', '1', null, $q$select (public.emargement_ouvrir('aprem', '13:30', '17:00') is not null)::text$q$), v_refus_form);
  perform pg_temp.liberer();
end $tgim$;

-- creer_titre, ajuster_titre et supprimer_titre jouées par un personnage (p_nom, p_cases et p_lieu en texte : « null » ou un littéral SQL).
create or replace function pg_temp.creer(p_qui text, p_entete text, p_depuis text, p_nom text, p_lieu text)
returns text language sql as $tg17a$
  select pg_temp.appeler_a(p_qui, p_entete, null, format('select public.creer_titre(%s, %L, %s)::text', p_depuis, p_nom, p_lieu));
$tg17a$;

create or replace function pg_temp.ajuster(p_qui text, p_entete text, p_titre text, p_lieu text, p_nom text, p_cases text)
returns text language sql as $tg17b$
  select pg_temp.appeler_a(p_qui, p_entete, null, format(
    $q$select concat_ws('/', r->>'titre_id', r->>'version_creee', r->>'porteurs_bascules') from (select public.ajuster_titre(%s, %s, %L, %L::jsonb) as r) q$q$,
    p_titre, p_lieu, p_nom, p_cases));
$tg17b$;

create or replace function pg_temp.supprimer(p_qui text, p_entete text, p_titre text)
returns text language sql as $tg17c$
  select pg_temp.appeler_a(p_qui, p_entete, null, format('select ''supprime'' from (select public.supprimer_titre(%s)) q', p_titre));
$tg17c$;

-- « true » si la réponse est « OK <identifiant> » (un titre créé).
create or replace function pg_temp.ok_id(p_reponse text)
returns text language sql as $tg17e$
  select (coalesce(p_reponse, '') ~ '^OK [0-9]+$')::text;
$tg17e$;

-- Les champs d'un titre, en texte : « niveau/centre/fixe/origine/créé par/cases égales à celles du titre p_modele ».
create or replace function pg_temp.fiche_titre(p_id text, p_modele text)
returns text language sql as $tg17d$
  select coalesce(pg_temp.calcul(format(
    $q$select niveau || '/' || coalesce(lieu_id::text, 'nul') || '/' || fixe::text || '/' || coalesce(origine_id::text, 'nul') || '/' || coalesce(cree_par, 'nul')
         || '/' || (cases = public._cases_effectives(%s))::text from public.titres where id = %s$q$, p_modele, p_id)), 'absent');
$tg17d$;

-- Groupe gerer (migration 6, partie C) : créer, ajuster, supprimer un titre ; la version de centre d'un titre du réseau ; l'effet immédiat
-- d'une case décochée.
create or replace function pg_temp.groupe_gerer()
returns void language plpgsql as $tggr$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_l1t text; v_l2t text;
  t_form text := pg_temp.calcul($q$select public.titre_fixe('promo')::text$q$);
  t_dir text := pg_temp.calcul($q$select public.titre_fixe('centre')::text$q$);
  t_interv text := pg_temp.titre_de('t_interv');
  t_secr text := pg_temp.titre_de('t_secr');
  t_rh text := pg_temp.titre_de('t_rh');
  t_contenus text := pg_temp.titre_de('t_contenus');
  t_chef text := pg_temp.titre_de('t_chef');
  e_chef text := pg_temp.e('t_chef'); e_siege text := pg_temp.e('siege'); e_dirs text := pg_temp.e('t_dirs');
  c_form constant text := '{"planning":"modifier","emargement":"modifier","stagiaires":"modifier","notes":"modifier","cours":"modifier","ccp2":"voir","indicateurs":"voir","reglages":"modifier"}';
  v_acc text; v_cat text; v_form text; v_r text; v_v text; v_r2 text; v_v2 text; v_autre text; v_feuille text; v_x text; v_r1 text;
  v_refus_form constant text := 'ERREUR P0001 emargement: Réservé aux formateurs.';
  v_ok text;
begin
  v_l1t := v_l1::text; v_l2t := v_l2::text;
  perform pg_temp.liberer();
  perform pg_temp.verrou(true);
  perform pg_temp.verifier('gerer', 'départ : aucun titre de la preuve n''est déjà créé',
    pg_temp.calcul($q$select count(*)::text from public.titres where nom like 'Preuve accueil%' or nom like 'Preuve catalogue%' or nom like 'Preuve formateur%'$q$) = '0', '');

  -- 1. Créer part d'un titre existant : même niveau, mêmes cases.
  perform pg_temp.attendre('gerer', 't_chef crée « Preuve accueil » depuis le titre de t_rh (centre 1)',
    pg_temp.ok_id(pg_temp.creer('t_chef', '1', t_rh, 'Preuve accueil', v_l1t)), 'true');
  v_acc := pg_temp.calcul($q$select id::text from public.titres where nom = 'Preuve accueil'$q$);
  perform pg_temp.attendre('gerer', 'le titre créé : niveau centre, centre 1, non fixe, sans origine, créé par t_chef, mêmes cases que celui de t_rh',
    pg_temp.fiche_titre(v_acc, t_rh), 'centre/' || v_l1t || '/false/nul/' || lower(e_chef) || '/true');
  perform pg_temp.attendre('gerer', 't_chef crée « Preuve formateur » depuis Formateur : niveau promo, huit cases au plafond',
    pg_temp.ok_id(pg_temp.creer('t_chef', '1', t_form, 'Preuve formateur', v_l1t)), 'true');
  v_form := pg_temp.calcul($q$select id::text from public.titres where nom = 'Preuve formateur'$q$);
  perform pg_temp.attendre('gerer', 'le titre créé depuis Formateur : niveau promo, centre 1, huit cases au plafond',
    pg_temp.calcul(format($q$select niveau || '/' || lieu_id || '/' || fixe::text || '/' || (cases = %L::jsonb)::text from public.titres where id = %s$q$, c_form, v_form)),
    'promo/' || v_l1t || '/false/true');
  perform pg_temp.attendre('gerer', 't_chef crée depuis le titre de t_secr (Stagiaires : Modifier) : refusé (42501), plus que le sien',
    pg_temp.creer('t_chef', '1', t_secr, 'Preuve secrétariat', v_l1t), 'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (stagiaires).');
  perform pg_temp.attendre('gerer', 'le même nom en majuscules : refusé (casse ignorée)',
    pg_temp.creer('t_chef', '1', t_rh, 'PREUVE ACCUEIL', v_l1t), 'ERREUR P0001 titres: Un titre de ce nom existe déjà ici.');
  perform pg_temp.attendre('gerer', 'un nom vide : refusé', pg_temp.creer('t_chef', '1', t_rh, '', v_l1t), 'ERREUR P0001 titres: Le nom est requis.');
  perform pg_temp.attendre('gerer', 'un nom d''espaces : refusé', pg_temp.creer('t_chef', '1', t_rh, '   ', v_l1t), 'ERREUR P0001 titres: Le nom est requis.');
  perform pg_temp.attendre('gerer', 't_rh (Équipe : Voir) crée : refusé (42501)',
    pg_temp.creer('t_rh', '1', t_rh, 'Preuve t_rh', v_l1t), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('gerer', 't_chef crée dans le centre 2 : refusé (42501), il n''y a aucun droit',
    pg_temp.creer('t_chef', '1', t_rh, 'Preuve ailleurs', v_l2t), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  v_autre := pg_temp.nouveau_titre('Preuve8 titre du centre 2', 'centre', v_l2);
  perform pg_temp.attendre('gerer', 't_chef crée depuis un titre du centre 2 : refusé (42501), ce titre est celui d''un autre centre',
    pg_temp.creer('t_chef', '1', v_autre, 'Preuve depuis ailleurs', v_l1t), 'ERREUR 42501 titres: Ce titre appartient à un autre centre.');
  perform pg_temp.attendre('gerer', 't_chef crée sans jeton d''adresse : refusé (42501)',
    pg_temp.creer(null, null, t_rh, 'Preuve sans jeton', v_l1t), 'ERREUR 42501 titres: Connexion requise.');
  perform pg_temp.attendre('gerer', 'un titre d''origine inconnu : refusé', pg_temp.creer('t_chef', '1', '-1', 'Preuve inconnu', v_l1t), 'ERREUR P0001 titres: Titre introuvable.');
  -- Le réseau.
  perform pg_temp.attendre('gerer', 't_dirs crée un titre du réseau depuis celui de t_contenus : refusé (42501), plus que le sien',
    pg_temp.creer('t_dirs', null, t_contenus, 'Preuve réseau', 'null'), 'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (cours).');
  perform pg_temp.attendre('gerer', 't_dirs crée un titre du réseau depuis celui de t_qualite (au plus égal) : permis',
    pg_temp.ok_id(pg_temp.creer('t_dirs', null, pg_temp.titre_de('t_qualite'), 'Preuve réseau qualité', 'null')), 'true');
  perform pg_temp.attendre('gerer', 't_qualite (Directions : Voir) crée un titre de centre du réseau : refusé (42501), réservé au réseau',
    pg_temp.creer('t_qualite', null, t_rh, 'Preuve qualité', 'null'), 'ERREUR 42501 titres: Réservé au réseau.');
  perform pg_temp.attendre('gerer', 'siege crée un titre de centre du réseau (sans centre) depuis celui de t_secr : permis, sans centre',
    pg_temp.ok_id(pg_temp.creer('siege', null, t_secr, 'Preuve catalogue', 'null')), 'true');
  v_cat := pg_temp.calcul($q$select id::text from public.titres where nom = 'Preuve catalogue'$q$);
  perform pg_temp.attendre('gerer', 'le titre du catalogue : niveau centre, sans centre, mêmes cases que celui de t_secr',
    pg_temp.fiche_titre(v_cat, t_secr), 'centre/nul/false/nul/' || lower(e_siege) || '/true');
  perform pg_temp.attendre('gerer', 't_dirs (Directions : Modifier) crée un titre de centre au centre 1 : permis (sans comparaison de cases)',
    pg_temp.ok_id(pg_temp.creer('t_dirs', null, t_rh, 'Preuve dirs au centre', v_l1t)), 'true');
  perform pg_temp.attendre('gerer', 'droits : les quatre fonctions pour authenticated seul, _refus_gestion pour personne',
    pg_temp.calcul($q$select concat_ws('/',
      has_function_privilege('authenticated', 'public.creer_titre(bigint, text, integer)', 'execute')::text,
      has_function_privilege('authenticated', 'public.ajuster_titre(bigint, integer, text, jsonb)', 'execute')::text,
      has_function_privilege('authenticated', 'public.supprimer_titre(bigint)', 'execute')::text,
      has_function_privilege('anon', 'public.creer_titre(bigint, text, integer)', 'execute')::text,
      has_function_privilege('anon', 'public.ajuster_titre(bigint, integer, text, jsonb)', 'execute')::text,
      has_function_privilege('anon', 'public.supprimer_titre(bigint)', 'execute')::text,
      has_function_privilege('authenticated', 'public._refus_gestion(text, integer, jsonb)', 'execute')::text)$q$), 'true/true/true/false/false/false/false');

  -- 2. Ajuster : les cases d'un titre non fixe, au plus égales à celles de l'appelant.
  perform pg_temp.attendre('gerer', 't_chef ajuste « Preuve accueil » en Promos, Équipe et Stagiaires à Voir : permis, aucune version',
    pg_temp.ajuster('t_chef', '1', v_acc, v_l1t, null, '{"promos":"voir","equipe":"voir","stagiaires":"voir"}'), 'OK ' || v_acc || '/false/0');
  perform pg_temp.attendre('gerer', 'les cases enregistrées sont celles demandées, modifié par t_chef',
    pg_temp.calcul(format($q$select (cases = '{"promos":"voir","equipe":"voir","stagiaires":"voir"}'::jsonb)::text || '/' || modifie_par from public.titres where id = %s$q$, v_acc)),
    'true/' || lower(e_chef));
  perform pg_temp.attendre('gerer', 't_chef ajuste avec Stagiaires à Modifier : refusé (42501), plus que le sien',
    pg_temp.ajuster('t_chef', '1', v_acc, v_l1t, null, '{"promos":"voir","stagiaires":"modifier"}'), 'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (stagiaires).');
  perform pg_temp.attendre('gerer', 't_chef ajuste avec Notes à Voir et Stagiaires à Non : refusé (cases non valides)',
    pg_temp.ajuster('t_chef', '1', v_acc, v_l1t, null, '{"notes":"voir"}'), 'ERREUR P0001 titres: Ces cases ne sont pas valides.');
  perform pg_temp.attendre('gerer', 't_chef ajuste une page qui n''existe pas : refusé (cases non valides)',
    pg_temp.ajuster('t_chef', '1', v_acc, v_l1t, null, '{"inconnue":"voir"}'), 'ERREUR P0001 titres: Ces cases ne sont pas valides.');
  perform pg_temp.attendre('gerer', 'ajuster Formateur : refusé, un titre fixe ne se modifie pas',
    pg_temp.ajuster('t_chef', '1', t_form, v_l1t, null, '{"planning":"voir"}'), 'ERREUR P0001 titres: Un titre fixe ne se modifie pas.');
  perform pg_temp.attendre('gerer', 'ajuster Direction de centre par le siège : refusé de même',
    pg_temp.ajuster('siege', null, t_dir, v_l1t, null, '{"promos":"voir"}'), 'ERREUR P0001 titres: Un titre fixe ne se modifie pas.');
  perform pg_temp.attendre('gerer', 't_chef ajuste son propre titre : refusé (42501), jamais sur soi',
    pg_temp.ajuster('t_chef', '1', t_chef, v_l1t, null, '{"promos":"voir"}'), 'ERREUR 42501 titres: Vous ne pouvez pas modifier un titre que vous portez.');
  perform pg_temp.attendre('gerer', 't_rh (Équipe : Voir) ajuste « Preuve accueil » : refusé (42501)',
    pg_temp.ajuster('t_rh', '1', v_acc, v_l1t, null, '{"promos":"voir"}'), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('gerer', 't_chef ajuste un titre du centre 2 : refusé, ce titre est celui d''un autre centre',
    pg_temp.ajuster('t_chef', '1', v_autre, v_l1t, null, '{"promos":"voir"}'), 'ERREUR P0001 titres: Ce titre appartient à un autre centre.');
  perform pg_temp.attendre('gerer', 't_chef ajuste un titre du centre 2 sans dire de centre : refusé (42501), aucun droit sur ce centre',
    pg_temp.ajuster('t_chef', '1', v_autre, 'null', null, '{"promos":"voir"}'), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('gerer', 'renommer en un nom déjà pris dans le centre : refusé',
    pg_temp.ajuster('t_chef', '1', v_acc, v_l1t, 'preuve FORMATEUR', '{"promos":"voir"}'), 'ERREUR P0001 titres: Un titre de ce nom existe déjà ici.');
  perform pg_temp.attendre('gerer', 'un nom vide : refusé', pg_temp.ajuster('t_chef', '1', v_acc, v_l1t, ' ', '{"promos":"voir"}'), 'ERREUR P0001 titres: Le nom est requis.');
  perform pg_temp.attendre('gerer', 'renommer : permis, le nom change',
    pg_temp.ajuster('t_chef', '1', v_acc, v_l1t, 'Preuve accueil 2', '{"promos":"voir"}') || ' / '
      || pg_temp.calcul(format('select nom from public.titres where id = %s', v_acc)), 'OK ' || v_acc || '/false/0 / Preuve accueil 2');
  perform pg_temp.attendre('gerer', 'un titre inconnu : refusé', pg_temp.ajuster('t_chef', '1', '-1', v_l1t, null, '{"promos":"voir"}'), 'ERREUR P0001 titres: Titre introuvable.');
  perform pg_temp.attendre('gerer', 'un jeton sans adresse : refusé (42501)', pg_temp.appeler_a(null, null, null,
    format($q$select public.ajuster_titre(%s, %s, null, '{"promos":"voir"}'::jsonb)::text$q$, v_acc, v_l1t)), 'ERREUR 42501 titres: Connexion requise.');

  -- 3. Un titre du réseau ajusté depuis un centre : la version du centre. u le porte au centre 1, v au centre 2.
  v_r := pg_temp.calcul($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve8 réseau R', 'centre', null, '{"promos":"voir","equipe":"voir"}', 'preuve') returning id::text$q$);
  perform pg_temp.personnel('u'); perform pg_temp.personnel('v');
  perform pg_temp.affecter(pg_temp.e('u'), 'direction', null, v_l1, v_r);
  perform pg_temp.affecter(pg_temp.e('v'), 'direction', null, v_l2, v_r);
  perform pg_temp.verifier('gerer', 'départ : le titre R du réseau (niveau centre, sans centre) est porté par u au centre 1 et par v au centre 2',
    v_r ~ '^[0-9]+$' and pg_temp.lignes(pg_temp.e('u'), 'direction') = '1' and pg_temp.lignes(pg_temp.e('v'), 'direction') = '1', 'R ' || coalesce(v_r, 'nul'));
  v_ok := pg_temp.ajuster('t_chef', '1', v_r, v_l1t, null, '{"promos":"voir","equipe":"voir"}');
  v_v := pg_temp.calcul(format('select id::text from public.titres where origine_id = %s and lieu_id = %s', v_r, v_l1t));
  perform pg_temp.attendre('gerer', 't_chef ajuste R depuis le centre 1 : la version du centre est créée, un porteur bascule',
    v_ok, 'OK ' || v_v || '/true/1');
  perform pg_temp.attendre('gerer', 'la version porte le même nom, l''origine R, le centre 1',
    pg_temp.calcul(format($q$select (v.nom = r.nom)::text || '/' || v.origine_id || '/' || v.lieu_id || '/' || v.niveau from public.titres v, public.titres r where v.id = %s and r.id = %s$q$, v_v, v_r)),
    'true/' || v_r || '/' || v_l1t || '/centre');
  perform pg_temp.attendre('gerer', 'u porte la version, v porte toujours R, R est inchangé',
    pg_temp.calcul(format($q$select (select titre_id::text from public.affectations where lower(email) = lower(%L)) || '/' || (select titre_id::text from public.affectations where lower(email) = lower(%L))
      || '/' || (select (cases = '{"promos":"voir","equipe":"voir"}'::jsonb)::text from public.titres where id = %s)$q$, pg_temp.e('u'), pg_temp.e('v'), v_r)),
    v_v || '/' || v_r || '/true');
  v_ok := pg_temp.ajuster('t_chef', '1', v_r, v_l1t, null, '{"promos":"voir"}');
  perform pg_temp.attendre('gerer', 'un second ajustement de R depuis le centre 1 modifie la version au lieu d''en créer une autre',
    v_ok || ' / ' || pg_temp.calcul(format('select count(*)::text from public.titres where origine_id = %s', v_r)) || ' / '
      || pg_temp.calcul(format($q$select (cases = '{"promos":"voir"}'::jsonb)::text from public.titres where id = %s$q$, v_v)),
    'OK ' || v_v || '/false/0 / 1 / true');
  perform pg_temp.attendre('gerer', 'ajuster la version elle-même, nommée par son identifiant, modifie la même ligne',
    pg_temp.ajuster('t_chef', '1', v_v, v_l1t, null, '{"promos":"voir","equipe":"voir"}'), 'OK ' || v_v || '/false/0');
  perform pg_temp.attendre('gerer', 'donner R au centre 1 donne la version (R a une version dans ce centre)',
    pg_temp.donner('t_chef', '1', null, pg_temp.e('z'), v_r, v_l1t, 'null') || ' / '
      || pg_temp.calcul(format('select titre_id::text from public.affectations where lower(email) = lower(%L)', pg_temp.e('z'))),
    pg_temp.reponse_donner(true, false, null, '[]', '[]') || ' / ' || v_v);
  -- Un titre de promo du réseau : toutes les lignes d'une personne passent à la version (suppression puis repose ligne par ligne).
  v_r2 := pg_temp.calcul($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve8 réseau R promo', 'promo', null, '{"planning":"voir","stagiaires":"voir"}', 'preuve') returning id::text$q$);
  perform pg_temp.personnel('x');
  perform pg_temp.affecter(pg_temp.e('x'), 'formateur', 1, null, v_r2);
  perform pg_temp.affecter(pg_temp.e('x'), 'formateur', 990801, null, v_r2);
  v_ok := pg_temp.ajuster('t_chef', '1', v_r2, v_l1t, null, '{"planning":"voir","stagiaires":"voir","cours":"voir"}');
  v_v2 := pg_temp.calcul(format('select id::text from public.titres where origine_id = %s and lieu_id = %s', v_r2, v_l1t));
  perform pg_temp.attendre('gerer', 'R promo ajusté depuis le centre 1 : une personne bascule, ses deux lignes passent à la version',
    v_ok || ' / ' || pg_temp.calcul(format($q$select count(*)::text from public.affectations where lower(email) = lower(%L) and titre_id = %s$q$, pg_temp.e('x'), v_v2))
      || ' / ' || pg_temp.calcul(format($q$select count(*)::text from public.affectations where titre_id = %s$q$, v_r2)),
    'OK ' || v_v2 || '/true/1 / 2 / 0');
  perform pg_temp.attendre('gerer', 'ajuster un titre du réseau (niveau promo) sans centre, par t_chef : refusé (42501), réservé au réseau',
    pg_temp.ajuster('t_chef', '1', v_r2, 'null', null, '{"planning":"voir","stagiaires":"voir"}'), 'ERREUR 42501 titres: Réservé au réseau.');
  perform pg_temp.attendre('gerer', 'siege ajuste R promo sans centre : permis, le titre du réseau lui-même change, aucune version de plus',
    pg_temp.ajuster('siege', null, v_r2, 'null', null, '{"planning":"voir","stagiaires":"voir"}') || ' / ' || pg_temp.calcul(format('select count(*)::text from public.titres where origine_id = %s', v_r2)),
    'OK ' || v_r2 || '/false/0 / 1');

  -- 4. Supprimer : un titre non fixe que personne ne porte.
  perform pg_temp.attendre('gerer', 'supprimer la version portée par u : refusé, retirez-le d''abord',
    pg_temp.supprimer('t_chef', '1', v_v), 'ERREUR P0001 titres: Ce titre est encore porté : retirez-le d''abord.');
  perform pg_temp.attendre('gerer', 'supprimer « Preuve accueil 2 » (personne ne le porte) : permis, la ligne disparaît',
    pg_temp.supprimer('t_chef', '1', v_acc) || ' / ' || pg_temp.calcul(format('select count(*)::text from public.titres where id = %s', v_acc)), 'OK supprime / 0');
  perform pg_temp.attendre('gerer', 'supprimer Formateur : refusé, un titre fixe ne se supprime pas',
    pg_temp.supprimer('siege', null, t_form), 'ERREUR P0001 titres: Un titre fixe ne se supprime pas.');
  perform pg_temp.attendre('gerer', 'supprimer « Preuve formateur » par t_rh : refusé (42501)',
    pg_temp.supprimer('t_rh', '1', v_form), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('gerer', 'supprimer le titre de t_secr par t_chef : refusé (42501), plus que le sien (avant même de dire qu''il est porté)',
    pg_temp.supprimer('t_chef', '1', t_secr), 'ERREUR 42501 titres: Ce titre ouvre plus que le vôtre (stagiaires).');
  perform pg_temp.attendre('gerer', 'supprimer un titre inconnu : refusé', pg_temp.supprimer('t_chef', '1', '-1'), 'ERREUR P0001 titres: Titre introuvable.');
  perform pg_temp.essai(format('delete from public.affectations where titre_id = %s', v_v));
  perform pg_temp.attendre('gerer', 'supprimer la version une fois retirée à u : permis, v porte toujours R',
    pg_temp.supprimer('t_chef', '1', v_v) || ' / ' || pg_temp.calcul(format($q$select titre_id::text from public.affectations where lower(email) = lower(%L)$q$, pg_temp.e('v'))),
    'OK supprime / ' || v_r);
  perform pg_temp.attendre('gerer', 'supprimer un titre du réseau (sans centre) par t_dirs : permis une fois qu''il n''est plus porté',
    pg_temp.supprimer('t_dirs', null, v_cat) || ' / ' || pg_temp.calcul(format('select count(*)::text from public.titres where id = %s', v_cat)), 'OK supprime / 0');

  -- 5. L'effet est immédiat : un titre de promo (Émargement : Modifier) donné à y ; t_chef décoche Émargement.
  perform pg_temp.essai($q$delete from public.settings where promo_id = 1 and key = 'emargement_actif'$q$);
  perform pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('emargement_actif', 'true', 1)$q$);
  perform pg_temp.attendre('gerer', 't_chef crée « Preuve feuille » depuis Intervenant puis règle Émargement : Modifier, Stagiaires : Voir',
    pg_temp.ok_id(pg_temp.creer('t_chef', '1', t_interv, 'Preuve feuille', v_l1t)), 'true');
  v_feuille := pg_temp.calcul($q$select id::text from public.titres where nom = 'Preuve feuille'$q$);
  perform pg_temp.attendre('gerer', 'réglage des cases de « Preuve feuille »',
    pg_temp.ajuster('t_chef', '1', v_feuille, v_l1t, null, '{"emargement":"modifier","stagiaires":"voir"}'), 'OK ' || v_feuille || '/false/0');
  perform pg_temp.attendre('gerer', 't_chef donne « Preuve feuille » à y (promo 1)',
    pg_temp.donner('t_chef', '1', null, pg_temp.e('y'), v_feuille, v_l1t, '''{1}''::integer[]'), pg_temp.reponse_donner(true, false, null, '[1]', '[]'));
  perform pg_temp.attendre('gerer', 'y ouvre une feuille d''émargement',
    pg_temp.appeler_a('y', '1', null, $q$select (public.emargement_ouvrir('matin', '08:30', '12:00') is not null)::text$q$), 'OK true');
  perform pg_temp.attendre('gerer', 't_chef passe Émargement à Voir',
    pg_temp.ajuster('t_chef', '1', v_feuille, v_l1t, null, '{"emargement":"voir","stagiaires":"voir"}'), 'OK ' || v_feuille || '/false/0');
  perform pg_temp.attendre('gerer', 'la demande suivante de y : la feuille est refusée, sans reconnexion',
    pg_temp.appeler_a('y', '1', null, $q$select (public.emargement_ouvrir('aprem', '13:30', '17:00') is not null)::text$q$), v_refus_form);
  perform pg_temp.attendre('gerer', 'y garde ce que la case Voir lui laisse : l''émargement est lisible',
    pg_temp.appeler_a('y', '1', null, 'select (count(*) >= 0)::text from public.emargement_seances where promo_id = 1'), 'OK true');
  -- Le ménage : plus aucune ligne portée par les cinq adresses libres, puis les titres créés ici (le retour 6 refuse de se jouer tant qu'un titre
  -- du réseau de niveau promo ou centre existe).
  perform pg_temp.liberer();
  perform pg_temp.essai($q$delete from public.titres where nom in ('Preuve accueil', 'Preuve accueil 2', 'Preuve formateur', 'Preuve réseau qualité', 'Preuve dirs au centre',
    'Preuve feuille', 'Preuve catalogue', 'Preuve8 réseau R', 'Preuve8 réseau R promo', 'Preuve8 titre du centre 2')
    or (not fixe and lieu_id is null and niveau <> 'reseau') or origine_id is not null$q$);
  perform pg_temp.verifier('gerer', 'ménage : plus aucun titre du réseau de niveau promo ou centre ni aucune version',
    pg_temp.calcul($q$select count(*)::text from public.titres where (not fixe and lieu_id is null and niveau <> 'reseau') or origine_id is not null$q$) = '0', '');
end $tggr$;

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

  -- 2. Les personnages, posés AVANT les migrations (comme les comptes de la production) : ceux de l'étape 1 (titres-aides.sql), puis ceux de l'étape 2.
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
  -- Le relevé de leurs lectures avant la migration (comparé après, groupe lectures).
  perform pg_temp.releve('avant');

  -- 3. Les migrations, dans l'ordre d'application (neutralisées dans les modes sans elles) : 4 (journal), 5 (fermetures), 6 (gestion).
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
  if pg_temp.groupe_a_jouer('lectures', v_etat5, 'public.retirer_titre(text, bigint, integer)', v_mode) then
    perform pg_temp.groupe_lectures(v_etat5 = 'jouée');
  end if;
  if pg_temp.groupe_a_jouer('verrou', v_etat6, 'public.regler_titres_ouverts(boolean)', v_mode) then
    perform pg_temp.groupe_verrou();
  end if;
  if pg_temp.groupe_a_jouer('donner', v_etat6, 'public.donner_titre(text, bigint, integer, integer[], integer)', v_mode) then
    perform pg_temp.groupe_donner();
  end if;
  if pg_temp.groupe_a_jouer('retirer', v_etat6, 'public.donner_titre(text, bigint, integer, integer[], integer)', v_mode) then
    perform pg_temp.groupe_retirer();
  end if;
  if pg_temp.groupe_a_jouer('immediat', v_etat6, 'public.donner_titre(text, bigint, integer, integer[], integer)', v_mode) then
    perform pg_temp.groupe_immediat();
  end if;
  if pg_temp.groupe_a_jouer('gerer', v_etat6, 'public.creer_titre(bigint, text, integer)', v_mode) then
    perform pg_temp.groupe_gerer();
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
