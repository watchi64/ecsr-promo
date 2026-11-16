-- Marche arrière de 20261115_titres_8_apercu.sql : défait les parties dans l'ordre inverse. Après ce retour, la base est dans l'état
-- d'avant la migration (empreinte des règles, des fonctions et des droits identique).
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_8_apercu_retour.sql.
set local lock_timeout = '3s';

-- D5 (décision de Timy du 12/11) : tant qu'une personne porte un titre non fixe, le retour s'arrête ici, avant tout changement (les
-- fonctions d'avant la migration ne savent pas le retirer correctement). Retirer d'abord ces titres depuis l'app.
do $garde_d5$
declare
  v_n integer;
begin
  -- Verrou partagé tenu jusqu'à la fin de la transaction : aucun don ni retrait ne passe entre le compte et la fin du retour.
  lock table public.affectations in share mode;
  select count(*) into v_n from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe;
  if v_n > 0 then
    raise exception 'titres_8_apercu_retour : % affectation(s) portent un titre non fixe ; les retirer d''abord (page Équipe ou Directions de centre) ; rien n''est changé', v_n;
  end if;
end $garde_d5$;

-- C. Les lectures des écrans partent.
drop function public.journal_present();
drop function public.titres_ajustables(integer);

-- B. mes_titres retrouve le texte de la migration 6 ; A. les cases et les titres fixes en aperçu, leurs fragments d'avant (bloc généré).
-- debut du bloc genere (outils/generer_fragments_titres_8.py retour)
-- public.mes_titres() : garde de dérive (le corps en vigueur est celui qu'on remplace), puis le texte de la migration 6.
do $garde_mes_titres$
declare
  v_corps text;
begin
  if to_regprocedure('public.mes_titres()') is null then
    raise exception 'titres_8_apercu_retour : public.mes_titres() n''existe pas ; rien n''est changé';
  end if;
  select replace(p.prosrc, E'\r', '') into v_corps from pg_proc p where p.oid = to_regprocedure('public.mes_titres()');
  if v_corps is distinct from $attendu$
#variable_conflict use_column
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_apercu text;
  v_niveau text;
  v_titre bigint;
  v_lieu integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  -- En aperçu (M10) : le titre simulé, jamais les vrais titres de la personne. Aperçu stagiaire : aucun titre. Aperçu formateur,
  -- direction ou siège : une ligne, le titre choisi par l'en-tête x-apercu-titre (apercu_titre) ou, sans lui, le titre fixe du niveau, sur
  -- le centre affiché (aucun au réseau) et, pour un titre de promo, la promo affichée.
  v_apercu := apercu_role();
  if v_apercu = 'stagiaire' then
    return;
  end if;
  if v_apercu in ('formateur', 'direction', 'siege') then
    v_niveau := case v_apercu when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end;
    v_titre := coalesce(apercu_titre(), titre_fixe(v_niveau));
    v_lieu := case when v_niveau = 'reseau' then null else lieu_courant() end;
    return query
      select t.id, t.nom, t.niveau, v_lieu, l.nom,
             case when v_niveau = 'promo' then array_remove(array[promo_courante()], null) end, _cases_effectives(t.id)
        from titres t
        left join lieux l on l.id = v_lieu
       where t.id = v_titre;
    return;
  end if;
  return query
    select g.titre_id, t.nom, t.niveau, g.lieu, l.nom, g.promos, _cases_effectives(t.id)
      from (select x.titre_id, x.lieu,
                   case when x.role = 'formateur' then array_agg(x.promo_id order by x.promo_id) end as promos
              from (select a.titre_id, a.role, a.promo_id,
                           case a.role when 'formateur' then (select p.lieu_id from promos p where p.id = a.promo_id)
                                       when 'direction' then a.lieu_id end as lieu
                      from affectations a
                     where lower(a.email) = v_moi) x
             group by x.titre_id, x.role, x.lieu) g
      join titres t on t.id = g.titre_id
      left join lieux l on l.id = g.lieu
     order by case t.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, l.nom collate "C", t.nom collate "C", t.id;
end;
$attendu$ then
    raise exception 'titres_8_apercu_retour : le corps de public.mes_titres() n''est pas celui attendu ; rien n''est changé';
  end if;
end $garde_mes_titres$;

create or replace function public.mes_titres()
returns table(titre_id bigint, nom text, niveau text, lieu_id integer, lieu_nom text, promo_ids integer[], cases jsonb)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
#variable_conflict use_column
declare
  v_moi text := lower(auth.jwt() ->> 'email');
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  return query
    select g.titre_id, t.nom, t.niveau, g.lieu, l.nom, g.promos, _cases_effectives(t.id)
      from (select x.titre_id, x.lieu,
                   case when x.role = 'formateur' then array_agg(x.promo_id order by x.promo_id) end as promos
              from (select a.titre_id, a.role, a.promo_id,
                           case a.role when 'formateur' then (select p.lieu_id from promos p where p.id = a.promo_id)
                                       when 'direction' then a.lieu_id end as lieu
                      from affectations a
                     where lower(a.email) = v_moi) x
             group by x.titre_id, x.role, x.lieu) g
      join titres t on t.id = g.titre_id
      left join lieux l on l.id = g.lieu
     order by case t.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, l.nom collate "C", t.nom collate "C", t.id;
end;
$f$;

do $migration$
declare
  v_fonctions text[] := array[
    'public.case_promo(integer, text)',
    'public.case_centre(integer, text)',
    'public.case_reseau(text)',
    'public.formateur_fixe(integer)',
    'public.direction_fixe(integer)',
    'public.siege_fixe()'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 2, 3, 4, 5, 6];
  v_anciens text[] := array[
$ancien$case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then _case_apercu(p_page, pg.plafond) else 0 end$ancien$,
$ancien$case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then _case_apercu(p_page, pg.plafond) else 0 end$ancien$,
$ancien$case when apercu.role = 'siege' then _case_apercu(p_page, pg.plafond) else 0 end$ancien$,
$ancien$when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false) and _apercu_fixe()
$ancien$,
$ancien$when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false) and _apercu_fixe()
$ancien$,
$ancien$when apercu.role is not null then apercu.role = 'siege' and _apercu_fixe()
$ancien$];
  v_nouveaux text[] := array[
$nouveau$case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then pg.plafond else 0 end$nouveau$,
$nouveau$case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then pg.plafond else 0 end$nouveau$,
$nouveau$case when apercu.role = 'siege' then pg.plafond else 0 end$nouveau$,
$nouveau$when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false)
$nouveau$,
$nouveau$when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false)
$nouveau$,
$nouveau$when apercu.role is not null then apercu.role = 'siege'
$nouveau$];
  f integer;
  i integer;
  v_oid regprocedure;
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : une fonction absente, un fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..cardinality(v_fonctions) loop
    v_oid := to_regprocedure(v_fonctions[f]);
    if v_oid is null then
      raise exception 'titres_8_apercu_retour : % n''existe pas ; rien n''est changé', v_fonctions[f];
    end if;
    v_def := pg_get_functiondef(v_oid);
    for i in 1..cardinality(v_de) loop
      if v_de[i] <> f then continue; end if;
      v_ancien := v_anciens[i];
      v_nouveau := v_nouveaux[i];
      -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : les fragments suivent.
      if position(E'\r' in v_def) > 0 then
        v_ancien := replace(v_ancien, E'\n', E'\r\n');
        v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
      end if;
      n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
      if n <> 1 then
        raise exception 'titres_8_apercu_retour : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
-- fin du bloc genere

-- A. Les aides de l'aperçu par titre partent en dernier (plus aucune fonction ne les appelle).
drop function public._apercu_fixe();
drop function public._case_apercu(text, integer);
drop function public.apercu_titre();
