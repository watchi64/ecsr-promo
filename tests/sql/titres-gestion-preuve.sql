-- Preuve de l'étape 2 du chantier « titres et droits à la carte » : ce que les migrations 20261112_titres_5 (fermetures) et _6 (gestion)
-- doivent donner, écrite avec elles. Elle se joue sur une base où les migrations 1, 2 et 3 sont appliquées (l'état de la production
-- après l'étape 1) ; la migration 4 (journal) n'y est pas, sauf demande (--etapes 4,5,6).
--   structure    prérequis de l'étape 1 présents (titre_fixe, geste_promo, la règle affectations_ajout réécrite par la migration 3),
--                chaque migration et chaque retour injectés se jouent sans erreur, personnages de l'étape 2 posés.
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

  -- 4. Les groupes des migrations 5 et 6 s'ajoutent ici, avec leurs tâches.

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
