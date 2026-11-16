-- Marche arrière de 20261115_titres_9_catalogue.sql : garde D5, garde des versions de centre, puis les parties dans l'ordre inverse.
-- Après ce retour, la base est dans l'état d'avant la migration (empreinte des règles, des fonctions et des droits identique ; titres_visibles a le corps de la migration 6).
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_9_catalogue_retour.sql.
set local lock_timeout = '3s';

-- D5 (décision de Timy du 12/11) : tant qu'une personne porte un titre non fixe, le retour s'arrête ici, avant tout changement (les
-- titres du catalogue portés ne peuvent pas disparaître). Retirer d'abord ces titres depuis l'app.
do $garde_d5$
declare
  v_n integer;
begin
  -- Verrou partagé tenu jusqu'à la fin de la transaction : aucun don ni retrait ne passe entre le compte et la fin du retour.
  lock table public.affectations in share mode;
  select count(*) into v_n from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe;
  if v_n > 0 then
    raise exception 'titres_9_catalogue_retour : % affectation(s) portent un titre non fixe ; les retirer d''abord (page Équipe ou Directions de centre) ; rien n''est changé', v_n;
  end if;
end $garde_d5$;

-- A. Garde : aucun centre n'a sa version d'un titre du catalogue (il garde sa version, et ses porteurs) ; sinon arrêt avec la liste.
do $garde_versions$
declare
  v_versions text;
begin
  select string_agg(format('« %s » (%s)', v.nom, coalesce(l.nom, v.lieu_id::text)), ', ' order by v.nom collate "C", v.id)
    into v_versions
    from public.titres v
    join public.titres c on c.id = v.origine_id
    left join public.lieux l on l.id = v.lieu_id
   where c.cree_par = 'migration 20261115_titres_9_catalogue';
  if v_versions is not null then
    raise exception 'titres_9_catalogue_retour : des centres ont leur version d''un titre du catalogue : % ; les supprimer d''abord ; rien n''est changé', v_versions;
  end if;
end $garde_versions$;

-- B. titres_visibles retrouve le contrôle d'accès de la migration 6 : garde sur le corps attendu (celui que pose la migration 9, retours
-- chariot retirés), puis le fragment remis, trouvé exactement une fois.
do $siege_lit$
declare
  v_oid regprocedure := to_regprocedure('public.titres_visibles(integer)');
  v_def text;
  v_ancien text := $ancien$    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) and not coalesce(siege_fixe(), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';$ancien$;
  v_nouveau text := $nouveau$    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';$nouveau$;
  n integer;
begin
  if v_oid is null then
    raise exception 'titres_9_catalogue_retour : public.titres_visibles(integer) n''existe pas ; rien n''est changé';
  end if;
  v_def := pg_get_functiondef(v_oid);
  if position(E'\r' in v_def) > 0 then
    v_ancien := replace(v_ancien, E'\n', E'\r\n');
    v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
  end if;
  n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
  if n <> 1 then
    raise exception 'titres_9_catalogue_retour : le contrôle d''accès de la migration 9 dans public.titres_visibles(integer) est présent % fois (une seule attendue) ; rien n''est changé', n;
  end if;
  execute replace(v_def, v_ancien, v_nouveau);
  if (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = v_oid) <> '169f6c52fae3d766de23404823b88dd2' then
    raise exception 'titres_9_catalogue_retour : le corps rétabli de public.titres_visibles(integer) n''est pas celui de la migration 6 ; rien n''est changé';
  end if;
end $siege_lit$;

-- A. Le catalogue part : les six titres, par nom et auteur.
do $catalogue$
declare
  v_n integer;
begin
  delete from public.titres
   where cree_par = 'migration 20261115_titres_9_catalogue' and lieu_id is null and not fixe and origine_id is null
     and nom in ('Responsable pédagogique', 'Secrétariat', 'Ressources humaines', 'Intervenant', 'Contenus pédagogiques', 'Qualité');
  get diagnostics v_n = row_count;
  if v_n <> 6 then
    raise exception 'titres_9_catalogue_retour : % titre(s) du catalogue trouvés (six attendus) ; rien n''est changé', v_n;
  end if;
end $catalogue$;
