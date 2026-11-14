-- Titres et droits à la carte, étape 3, migration 8 : l'aperçu du fondateur par titre, mes_titres en aperçu (M10), titres_ajustables et
-- journal_present (lectures des écrans). Aucun fichier de l'app ne change ; sans le nouvel en-tête, chaque réponse reste celle
-- d'aujourd'hui, pour tout compte.
--   A. Aperçu par titre. Un second en-tête, x-apercu-titre (l'identifiant d'un titre, chiffres seuls), lu par apercu_titre() pour le seul
--      fondateur, en aperçu formateur, direction ou siège, quand le titre existe, que son niveau est celui de l'aperçu (formateur : promo,
--      direction : centre, siège : réseau) et qu'il est du réseau ou du centre affiché ; nul sinon (tout autre compte, en-tête illisible,
--      titre d'un autre niveau ou d'un autre centre). Il ne fait que retirer : case_promo, case_centre et case_reseau donnent en aperçu
--      les cases de ce titre bornées au plafond (_case_apercu) au lieu du plafond ; formateur_fixe, direction_fixe et siege_fixe deviennent
--      faux pour un titre non fixe (_apercu_fixe). Les six fonctions sont modifiées par fragments (bloc de
--      outils/generer_fragments_titres_8.py : ne pas le modifier à la main), les trois aides nouvelles posées avant lui.
--      Limite connue, non corrigée : _cases_appelant (migration 6) lit les vraies affectations même en aperçu ; en aperçu Direction avec un
--      titre « Équipe : Modifier », la règle « jamais plus que soi » compare donc aux cases réelles du fondateur (aucune affectation : tout à
--      Non). Aucun droit n'est gagné ; l'aperçu peut refuser un geste que la personne simulée aurait.
--   B. mes_titres (M10), remplacée en entier après une garde de dérive (même bloc généré) : en aperçu stagiaire, aucune ligne ; en aperçu
--      formateur, direction ou siège, une ligne, le titre simulé (ou, sans en-tête de titre, le titre fixe du niveau), sur le centre affiché
--      et, pour un titre de promo, la promo affichée ; hors aperçu, le texte de la migration 6.
--   C. titres_ajustables(centre) : les titres que l'appelant peut ajuster et supprimer (l'écran n'offre « Ajuster » que là) ; même garde
--      de lecture que titres_visibles, puis, parmi les titres non fixes qu'elle rendrait, ceux qu'_refus_gestion permet (règles de la
--      migration 7, D1) et que l'appelant ne porte pas (ni le titre, ni sa racine, ni une de ses versions), comme ajuster_titre.
--      journal_present() : vrai quand la table du journal (migration 4) existe ; l'écran n'affiche la section Journal que là.
-- Toute fonction nouvelle : security definer, search_path public puis pg_temp ; les trois aides de l'aperçu n'ont aucun droit d'exécution
-- (elles ne sont appelées que par des fonctions security definer) ; titres_ajustables et journal_present : authenticated seul. Aucune
-- règle (policy) n'est touchée.
-- Le retour (20261115_titres_8_apercu_retour.sql) remet les fragments, le texte de mes_titres de la migration 6 (relu dans son fichier
-- par le même générateur) et retire les fonctions nouvelles.
-- À appliquer en une seule transaction, après la migration 7 : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_8_apercu.sql.
-- Jamais sans l'accord explicite de Timy.
set local lock_timeout = '3s';

-- A. Les aides de l'aperçu par titre (avant le bloc : case_promo, case_centre et case_reseau, en SQL, sont validées à leur création).

-- Le titre simulé par l'en-tête x-apercu-titre, lu comme apercu_role() lit x-apercu-role. Nul sauf pour le fondateur en aperçu formateur,
-- direction ou siège, un titre qui existe, de niveau promo, centre ou réseau respectivement, du réseau ou du centre affiché.
create function public.apercu_titre()
returns bigint
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  brut text := nullif(current_setting('request.headers', true), '');
  entete text;
  v_role text;
  v_id bigint;
begin
  -- En-têtes illisibles : aucun aperçu par titre (PostgREST envoie toujours un JSON valide).
  if brut is null or not pg_input_is_valid(brut, 'jsonb') then
    return null;
  end if;
  entete := brut::jsonb ->> 'x-apercu-titre';
  -- Chiffres seuls (au plus 18 : jamais de dépassement de bigint).
  if entete is null or entete !~ '^[0-9]{1,18}$' then
    return null;
  end if;
  v_role := apercu_role();
  if v_role is null or v_role not in ('formateur', 'direction', 'siege') or not coalesce(fondateur_reel(), false) then
    return null;
  end if;
  select t.id into v_id
    from titres t
   where t.id = entete::bigint
     and t.niveau = case v_role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end
     and (t.lieu_id is null or t.lieu_id = lieu_courant());
  return v_id;
end;
$f$;

-- La case d'une page en aperçu : le plafond sans titre simulé ; sinon la case du titre simulé (Non 0, Voir 1, Modifier 2), bornée au plafond.
-- La borne du plafond est une défense en profondeur : la contrainte titres_cases_valides empêche déjà une case de dépasser le plafond de sa
-- page (la preuve ne peut donc pas l'éprouver) ; ne pas la retirer.
create function public._case_apercu(p_page text, p_plafond integer)
returns integer
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select case when a.id is null then p_plafond
              else least(p_plafond, case _cases_effectives(a.id) ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
         end
    from (select apercu_titre() as id) a;
$f$;

-- Vrai sans titre simulé, ou quand le titre simulé est fixe : les titres fixes en aperçu (formateur_fixe, direction_fixe, siege_fixe).
create function public._apercu_fixe()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce((select t.fixe from titres t where t.id = apercu_titre()), true);
$f$;

revoke all on function public.apercu_titre() from public, anon, authenticated, service_role;
revoke all on function public._case_apercu(text, integer) from public, anon, authenticated, service_role;
revoke all on function public._apercu_fixe() from public, anon, authenticated, service_role;

-- A. Les cases et les titres fixes en aperçu (fragments) ; B. mes_titres en aperçu (remplacée en entier) : bloc généré.
-- debut du bloc genere (outils/generer_fragments_titres_8.py aller)
-- public.mes_titres() : garde de dérive (le corps en vigueur est celui qu'on remplace), puis le texte nouveau.
do $garde_mes_titres$
declare
  v_corps text;
begin
  if to_regprocedure('public.mes_titres()') is null then
    raise exception 'titres_8_apercu : public.mes_titres() n''existe pas ; rien n''est changé';
  end if;
  select replace(p.prosrc, E'\r', '') into v_corps from pg_proc p where p.oid = to_regprocedure('public.mes_titres()');
  if v_corps is distinct from $attendu$
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
$attendu$ then
    raise exception 'titres_8_apercu : le corps de public.mes_titres() n''est pas celui attendu ; rien n''est changé';
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
$ancien$case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then pg.plafond else 0 end$ancien$,
$ancien$case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then pg.plafond else 0 end$ancien$,
$ancien$case when apercu.role = 'siege' then pg.plafond else 0 end$ancien$,
$ancien$when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false)
$ancien$,
$ancien$when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false)
$ancien$,
$ancien$when apercu.role is not null then apercu.role = 'siege'
$ancien$];
  v_nouveaux text[] := array[
$nouveau$case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then _case_apercu(p_page, pg.plafond) else 0 end$nouveau$,
$nouveau$case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then _case_apercu(p_page, pg.plafond) else 0 end$nouveau$,
$nouveau$case when apercu.role = 'siege' then _case_apercu(p_page, pg.plafond) else 0 end$nouveau$,
$nouveau$when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false) and _apercu_fixe()
$nouveau$,
$nouveau$when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false) and _apercu_fixe()
$nouveau$,
$nouveau$when apercu.role is not null then apercu.role = 'siege' and _apercu_fixe()
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
      raise exception 'titres_8_apercu : % n''existe pas ; rien n''est changé', v_fonctions[f];
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
        raise exception 'titres_8_apercu : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
-- fin du bloc genere

-- C. Les lectures des écrans ---------------------------------------------------------------------------------------------------------

-- Les titres que l'appelant peut ajuster et supprimer, dans un centre ou au réseau (centre nul). Même garde de lecture que
-- titres_visibles ; parmi les titres non fixes qu'elle rendrait, ceux pour lesquels _refus_gestion (migration 7, D1) ne dit rien, avec les
-- cases actuelles du titre (celles de la version du centre si elle existe), et que l'appelant ne porte pas (ni le titre, ni sa racine, ni
-- une de ses versions ; le fondateur, hors aperçu, excepté), comme ajuster_titre. Les titres du réseau visibles dans un centre en font
-- partie : les y ajuster crée la version du centre.
create function public.titres_ajustables(p_lieu_id integer)
returns table(id bigint)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
#variable_conflict use_column
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_fondateur boolean := coalesce(est_fondateur(), false);
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_lieu_id is not null then
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
  elsif not coalesce(geste_reseau('directions.lire'), false) then
    raise exception 'titres: Réservé au réseau.' using errcode = '42501';
  end if;
  return query
    select c.id
      from (select t.id, t.nom, t.niveau, t.lieu_id, coalesce(t.origine_id, t.id) as racine
              from titres t
             where not t.fixe
               and ((p_lieu_id is not null and t.niveau in ('promo', 'centre')
                     and (t.lieu_id = p_lieu_id
                          or (t.lieu_id is null and not exists (select 1 from titres v where v.origine_id = t.id and v.lieu_id = p_lieu_id))))
                    or (p_lieu_id is null and t.lieu_id is null))) c
     where _refus_gestion(c.niveau, case when c.niveau = 'reseau' then null else coalesce(c.lieu_id, p_lieu_id) end,
             _cases_effectives(coalesce((select v.id from titres v where v.origine_id = c.id and v.lieu_id = p_lieu_id), c.id))) is null
       and (v_fondateur or not exists (
             select 1 from affectations af join titres tt on tt.id = af.titre_id
              where lower(af.email) = v_moi and (tt.id = c.racine or tt.origine_id = c.racine)))
     order by case c.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, c.nom collate "C", c.id;
end;
$f$;

-- La table du journal (migration 4) existe-t-elle ? L'écran n'affiche la section Journal que si oui.
create function public.journal_present()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select to_regclass('public.journal_droits') is not null;
$f$;

revoke all on function public.titres_ajustables(integer) from public, anon, service_role;
grant execute on function public.titres_ajustables(integer) to authenticated;
revoke all on function public.journal_present() from public, anon, service_role;
grant execute on function public.journal_present() to authenticated;
