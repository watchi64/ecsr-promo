-- Titres et droits à la carte, étape 4, migration 9 : le catalogue de six titres du réseau (spec § 6.2), et la lecture des titres d'un
-- centre par le siège (spec § 11, page Directions de centre).
--   A. Six titres du réseau (centre nul, non fixes, origine nulle), créés par la migration, utilisables tels quels dans tous les centres,
--      chacun avec une case écrite pour chaque page de son niveau :
--        Responsable pédagogique  centre  Promos Modifier, Stagiaires Modifier, Émargement Voir, Notes Voir, Équipe Voir, Réglages Non
--        Secrétariat              centre  Promos Voir, Stagiaires Modifier, Émargement Voir, Notes Non, Équipe Voir, Réglages Non
--        Ressources humaines      centre  Promos Voir, Stagiaires Non, Émargement Non, Notes Non, Équipe Voir, Réglages Non
--        Intervenant              promo   Planning Voir, Émargement Modifier, Stagiaires Voir, Notes Non, Cours Voir, CCP2 Non,
--                                         Indicateurs Non, Réglages Non
--        Contenus pédagogiques    réseau  Cours Modifier, Directions de centre Non, Réglages Non
--        Qualité                  réseau  Cours Voir, Directions de centre Voir, Réglages Non
--      Gardes (rien n'est créé si l'une manque) : la migration 6 est là ; aucun titre d'origine nulle, avec ou sans centre, ne porte déjà
--      l'un des six noms (casse ignorée ; la liste titre et centre est dans l'erreur : une direction a pu créer « Secrétariat » dans son
--      centre depuis l'étape 3) ; chaque jeu de cases passe _cases_valides.
--   B. titres_visibles(centre) : le siège FIXE (siege_fixe() : titre fixe Siège, ou fondateur, ou aperçu siège sans titre non fixe simulé)
--      lit les titres d'un centre, en lecture seule, comme l'équipe du centre : mêmes lignes, et « donnable » tel que la base le juge pour
--      lui. Seul le contrôle d'accès change (un fragment, trouvé exactement une fois, après une garde sur le corps attendu) ; la phrase de
--      refus, les paramètres, le retour et les droits d'exécution restent ceux de la migration 6. Aucune autre fonction ne change.
-- Aucune règle (policy) n'est touchée. Le retour (20261115_titres_9_catalogue_retour.sql) remet le contrôle d'accès d'avant et retire les
-- six titres.
-- À appliquer en une seule transaction, après les migrations 7 et 8 : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_9_catalogue.sql.
-- Jamais sans l'accord explicite de Timy.
set local lock_timeout = '3s';

-- A. Le catalogue.
do $catalogue$
declare
  v_doublons text;
  r record;
begin
  if to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)') is null then
    raise exception 'titres_9_catalogue : la migration 6 (20261112_titres_6_gestion) n''est pas appliquée ; rien n''est changé';
  end if;
  -- Verrou de la table des titres jusqu'à la fin de la transaction : aucun titre ne naît entre la garde des noms et la création.
  lock table public.titres in share row exclusive mode;
  select string_agg(format('« %s » (%s)', t.nom, coalesce(l.nom, 'réseau')), ', ' order by t.nom collate "C", t.id)
    into v_doublons
    from public.titres t
    left join public.lieux l on l.id = t.lieu_id
   where t.origine_id is null
     and lower(t.nom) in ('responsable pédagogique', 'secrétariat', 'ressources humaines', 'intervenant', 'contenus pédagogiques', 'qualité');
  if v_doublons is not null then
    raise exception 'titres_9_catalogue : des titres portent déjà un nom du catalogue : % ; les renommer ou les supprimer d''abord ; rien n''est changé', v_doublons;
  end if;
  for r in select * from (values
      ('Responsable pédagogique', 'centre', '{"promos":"modifier","stagiaires":"modifier","emargement":"voir","notes":"voir","equipe":"voir","reglages":"non"}'),
      ('Secrétariat', 'centre', '{"promos":"voir","stagiaires":"modifier","emargement":"voir","notes":"non","equipe":"voir","reglages":"non"}'),
      ('Ressources humaines', 'centre', '{"promos":"voir","stagiaires":"non","emargement":"non","notes":"non","equipe":"voir","reglages":"non"}'),
      ('Intervenant', 'promo', '{"planning":"voir","emargement":"modifier","stagiaires":"voir","notes":"non","cours":"voir","ccp2":"non","indicateurs":"non","reglages":"non"}'),
      ('Contenus pédagogiques', 'reseau', '{"cours":"modifier","directions":"non","reglages":"non"}'),
      ('Qualité', 'reseau', '{"cours":"voir","directions":"voir","reglages":"non"}')
    ) c(nom, niveau, cases)
  loop
    if not public._cases_valides(r.niveau, r.cases::jsonb) then
      raise exception 'titres_9_catalogue : les cases de « % » ne sont pas admissibles ; rien n''est changé', r.nom;
    end if;
    -- Chaque page du niveau a sa case, aucune autre.
    if (select array_agg(p.page order by p.page collate "C") from public._pages_du_niveau(r.niveau) p)
       is distinct from (select array_agg(k order by k collate "C") from jsonb_object_keys(r.cases::jsonb) k) then
      raise exception 'titres_9_catalogue : les cases de « % » ne couvrent pas exactement les pages de son niveau ; rien n''est changé', r.nom;
    end if;
    insert into public.titres (nom, niveau, lieu_id, fixe, origine_id, cases, cree_par)
      values (r.nom, r.niveau, null, false, null, r.cases::jsonb, 'migration 20261115_titres_9_catalogue');
  end loop;
end $catalogue$;

-- B. Le siège fixe lit les titres d'un centre : garde sur le corps attendu de titres_visibles (texte de la migration 6, retours chariot
-- retirés), puis un fragment remplacé, trouvé exactement une fois.
do $siege_lit$
declare
  v_oid regprocedure := to_regprocedure('public.titres_visibles(integer)');
  v_def text;
  v_ancien text := $ancien$    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';$ancien$;
  v_nouveau text := $nouveau$    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) and not coalesce(siege_fixe(), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';$nouveau$;
  n integer;
begin
  if v_oid is null then
    raise exception 'titres_9_catalogue : public.titres_visibles(integer) n''existe pas ; rien n''est changé';
  end if;
  if (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = v_oid) <> '169f6c52fae3d766de23404823b88dd2' then
    raise exception 'titres_9_catalogue : le corps de public.titres_visibles(integer) n''est pas celui de la migration 6 ; rien n''est changé';
  end if;
  v_def := pg_get_functiondef(v_oid);
  -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : le fragment les suit.
  if position(E'\r' in v_def) > 0 then
    v_ancien := replace(v_ancien, E'\n', E'\r\n');
    v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
  end if;
  n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
  if n <> 1 then
    raise exception 'titres_9_catalogue : le contrôle d''accès attendu dans public.titres_visibles(integer) est présent % fois (une seule attendue) ; rien n''est changé', n;
  end if;
  execute replace(v_def, v_ancien, v_nouveau);
end $siege_lit$;
