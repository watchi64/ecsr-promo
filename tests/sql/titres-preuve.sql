-- Preuve du chantier « titres et droits à la carte » : ce que chaque migration 20261112_titres_<n> doit donner, écrite avec elle.
--   structure   chaque migration injectée se joue sans erreur ; chaque retour aussi.
--   titres      (migration 1) trois titres fixes, un par niveau ; chaque affectation porte le titre fixe de son niveau ; plafonds
--               des pages ; _cases_valides (valeurs, plafonds, Réglages, noms de stagiaires § 5.4) ; contraintes de la table ;
--               unicité du nom par portée (casse ignorée) ; aucun droit pour anon ni authenticated.
--   affectation (migration 1) le déclencheur : titre fixe posé d'office, niveau, centre et « un titre de promo par centre ».
--   retour      les retours défont tout, dans l'ordre inverse (4, 3, 2, 1) : l'empreinte (règles, fonctions, droits) égale celle d'avant.
--   equivalence (migration 2, partie A) chaque geste (geste_promo, geste_centre, geste_reseau) égale l'ancien prédicat du lot 4, pour chaque
--               personnage (stagiaires, formateurs, direction, siège, fondateur, cumul, direction qui forme, comptes sans rôle) dans chaque
--               contexte (en-tête promo 1, 2, 7 ou aucun ; aperçu du fondateur ; aperçu refusé à un autre compte) : 0 écart.
--   gestes      (migration 2, partie A) attendus écrits en dur pour des titres non fixes (secrétariat, intervenant, ressources humaines,
--               contenus), la direction fixe, le siège ; sans promo affichée tout geste de promo est faux, jamais nul ; code inconnu : 22023.
-- Les groupes des migrations 2 (partie B) à 4 s'ajoutent ici, avec leurs tâches.
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (tests/sql/roles-aides.sql),
-- le libellé du mode, la requête d'empreinte, puis les migrations 1 à 4 et leurs retours :
--   node outils/assembler_repetition_roles.mjs titres [--etapes 1,2] <sortie.sql>   les étapes dont les fichiers existent
--                                                                                   (ou celles demandées) : VERT attendu
--   node outils/assembler_repetition_roles.mjs titres-contre-epreuve <sortie.sql>   sans aucune migration : ROUGE attendu sur
--                                                                                   chaque contrôle du groupe titres
--   node outils/assembler_repetition_roles.mjs titres-en-ligne <sortie.sql>         rien d'injecté, après application réelle
-- À jouer APRÈS la suite du lot 5 (jusqu'à 20261111_espaces_4_donnees). Le fichier assemblé se joue en une requête ; le bloc do
-- finit TOUJOURS par une levée : migrations, personnages et lignes d'essai sont annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $temp$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $temp$;

-- Une migration ou un retour, joué tel quel dans une sous-transaction : « jouée », « neutralisée » (le littéral 'select 1'
-- que l'assembleur met à la place d'un fichier non injecté), ou l'erreur (état SQL, jamais le message).
create or replace function pg_temp.jouer(p_nom text, p_sql text)
returns text language plpgsql as $tj$
begin
  if p_sql = 'select 1' then return 'neutralisée'; end if;
  perform pg_temp.informer(format('md5 du texte joué : %s', p_nom), md5(p_sql));
  begin
    execute p_sql;
    return 'jouée';
  exception when others then
    return 'ERREUR ' || sqlstate;
  end;
end $tj$;

-- Le sort d'une migration ou d'un retour : une information si elle est neutralisée, sinon un contrôle de la structure.
create or replace function pg_temp.etape(p_nom text, p_etat text, p_mode text)
returns void language plpgsql as $te$
begin
  if p_etat = 'neutralisée' then
    perform pg_temp.informer(p_nom, 'non injecté (' || p_mode || ')');
  else
    perform pg_temp.verifier('structure', p_nom || ' jouée sans erreur', p_etat = 'jouée', p_etat);
  end if;
end $te$;

-- Un ordre jeté en propriétaire : « OK » ou « ERREUR <état> ». Ce que l'ordre a réussi reste fait (la preuve annule tout à la fin).
create or replace function pg_temp.essai(p_sql text)
returns text language plpgsql as $tes$
begin
  perform pg_temp.proprio();
  execute p_sql;
  return 'OK';
exception when others then
  return 'ERREUR ' || sqlstate;
end $tes$;

-- Un titre créé en propriétaire : son identifiant en texte, ou « incalculable (...) ».
create or replace function pg_temp.nouveau_titre(p_nom text, p_niveau text, p_lieu integer)
returns text language sql as $tn$
  select pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (%L, %L, %s, ''{}'', ''preuve'') returning id::text',
    p_nom, p_niveau, coalesce(p_lieu::text, 'null')));
$tn$;

-- Une ligne d'affectation posée en propriétaire. p_titre est le texte d'un identifiant (ou 'null' pour un titre nul explicite),
-- ou nul pour ne pas citer la colonne. Rend « OK » ou « ERREUR <état> ».
create or replace function pg_temp.affecter(p_email text, p_role text, p_promo integer, p_lieu integer, p_titre text)
returns text language sql as $ta$
  select pg_temp.essai(format('insert into public.affectations (email, role, promo_id, lieu_id%s) values (%L, %L, %s, %s%s)',
    case when p_titre is null then '' else ', titre_id' end, p_email, p_role,
    coalesce(p_promo::text, 'null'), coalesce(p_lieu::text, 'null'), case when p_titre is null then '' else ', ' || p_titre end));
$ta$;

-- Un jeu de cases jugé par _cases_valides : vrai ou faux attendu.
create or replace function pg_temp.cases(p_niveau text, p_json text, p_attendu boolean)
returns void language sql as $tc$
  select pg_temp.attendre('cases', format('_cases_valides(%s, %s)', p_niveau, p_json),
    pg_temp.calcul(format('select public._cases_valides(%L, %L::jsonb)::text', p_niveau, p_json)), p_attendu::text);
$tc$;

-- Verdict : lève TOUJOURS une exception, qui annule tout. Les échecs d'abord, puis les comptes par groupe, puis chaque contrôle réussi.
create or replace function pg_temp.verdict_titres(p_mode text, p_debut timestamptz)
returns void language plpgsql as $tv$
declare v_ok integer; v_ko integer; v_groupes text; v_echecs text; v_reussis text; v_infos text; v_msg text; v_duree text;
begin
  v_duree := to_char(extract(epoch from clock_timestamp() - p_debut), 'FM990.0') || ' s';
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat = 'échec') into v_ok, v_ko from preuve;
  select string_agg(format('%s %s/%s', groupe, ok, n), ' ; ' order by premier) into v_groupes
    from (select groupe, count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where etat <> 'info' group by groupe) g;
  select string_agg(format('- [%s] %s', groupe, libelle) || coalesce(' : ' || nullif(left(detail, 200), ''), ''), E'\n' order by num)
    into v_echecs from preuve where etat = 'échec';
  select string_agg(format('- [%s] %s', groupe, libelle), E'\n' order by num) into v_reussis from preuve where etat = 'ok';
  select string_agg('- ' || libelle || coalesce(' : ' || nullif(detail, ''), ''), E'\n' order by num) into v_infos
    from preuve where etat = 'info';
  if v_ko = 0 and v_ok > 0 then
    v_msg := format(E'VERT %s/0 (tout est annulé) ; mode %s ; durée %s\npar groupe (réussis/joués) : %s\ncontrôles :\n%s',
      v_ok, p_mode, v_duree, v_groupes, coalesce(v_reussis, '- aucun'));
  else
    v_msg := format(E'ROUGE %s/%s (tout est annulé) ; mode %s ; durée %s\néchecs d''abord :\n%s\npar groupe (réussis/joués) : %s\ncontrôles réussis :\n%s',
      v_ok, v_ko, p_mode, v_duree, coalesce(v_echecs, '- aucun'), coalesce(v_groupes, 'aucun contrôle joué'),
      coalesce(v_reussis, '- aucun'));
  end if;
  if v_infos is not null then
    v_msg := v_msg || E'\nà titre d''information (jamais compté) :\n' || v_infos;
  end if;
  raise exception using message = v_msg;
end $tv$;

-- Groupes equivalence et gestes (migration 2, partie A) : les personnages du lot 4 (reprise, adresses fictives de cette preuve), puis les
-- gestes comparés un à un à leur ancien prédicat, dans la même incarnation (pg_temp.valeur).
-- Les personnages : une ligne par personnage dans pg_temp.perso ; fiches, profils et affectations posés en propriétaire.
create or replace function pg_temp.poser_perso()
returns void language plpgsql as $tpp$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l4 integer := (select lieu_id from public.promos where id = 7);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  r record; n integer;
begin
  drop table if exists pg_temp.perso;
  create temp table perso (ordre integer primary key, nom text not null, email text not null, role text not null,
    is_admin boolean not null default false, fondateur boolean not null default false, promo_fiche integer, info text);
  insert into perso (ordre, nom, email, role, is_admin, fondateur, promo_fiche) values
    (1, 'stag_n', 'preuve7.eq.stag.n@exemple.invalid', 'stagiaire', false, false, 1),
    (2, 'stag_m', 'preuve7.eq.stag.m@exemple.invalid', 'stagiaire', false, false, 2),
    (3, 'form_n', 'preuve7.eq.form.n@exemple.invalid', 'prof', true, false, null),
    (4, 'form_m', 'preuve7.eq.form.m@exemple.invalid', 'prof', true, false, null),
    (5, 'dir_n', 'preuve7.eq.dir.n@exemple.invalid', 'prof', false, false, null),
    (6, 'siege', 'preuve7.eq.siege@exemple.invalid', 'prof', false, false, null),
    (7, 'fond', 'preuve7.eq.fond@exemple.invalid', 'stagiaire', true, true, 1),
    (8, 'sans_role', 'preuve7.eq.sans.role@exemple.invalid', 'stagiaire', false, false, null),
    (9, 'ancien_form', 'preuve7.eq.ancien.form@exemple.invalid', 'prof', true, false, null),
    (10, 'cumul', 'preuve7.eq.cumul@exemple.invalid', 'stagiaire', false, false, 1),
    (11, 'dir_form', 'preuve7.eq.dir.form@exemple.invalid', 'prof', false, false, null),
    (12, 'stag_s', 'preuve7.eq.stag.s@exemple.invalid', 'stagiaire', false, false, 7),
    (13, 'form_s', 'preuve7.eq.form.s@exemple.invalid', 'prof', true, false, null),
    (14, 'dir_s', 'preuve7.eq.dir.s@exemple.invalid', 'prof', false, false, null),
    (15, 'dir_deux', 'preuve7.eq.dir.deux@exemple.invalid', 'prof', false, false, null),
    (16, 'siege_form', 'preuve7.eq.siege.form@exemple.invalid', 'prof', true, false, null);
  for r in select * from perso order by ordre loop
    n := null;
    if r.promo_fiche is not null then
      insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve7 ' || r.nom, 'PREUVE', 990, r.promo_fiche) returning id into n;
    end if;
    insert into public.user_profiles (email, role, is_admin, is_founder, stagiaire_id) values (r.email, r.role, r.is_admin, r.fondateur, n);
  end loop;
  -- cumul : fiche de la promo 1 et formateur de la promo 2 ; dir_form : direction du centre de la promo 1 et formateur de la promo 2.
  insert into public.affectations (email, role, promo_id, lieu_id)
    select p.email, 'formateur', x.promo, null::integer
      from perso p join (values ('form_n', 1), ('form_m', 2), ('form_s', 7), ('cumul', 2), ('dir_form', 2), ('siege_form', 1)) x(nom, promo) on x.nom = p.nom
    union all
    select p.email, 'direction', null::integer, x.lieu
      from perso p join (values ('dir_n', v_l1), ('dir_form', v_l1), ('dir_s', v_l4), ('dir_deux', v_l1), ('dir_deux', v_l2)) x(nom, lieu) on x.nom = p.nom
    union all
    select p.email, 'siege', null::integer, null::integer from perso p where p.nom in ('siege', 'siege_form');
end $tpp$;

-- Les personnages des titres non fixes (spec § 5) et une direction d'un centre sans promo. Les titres se posent en propriétaire ; si
-- la table des titres manque (contre-épreuve), la pose échoue en silence et les contrôles qui en dépendent sont rouges.
create or replace function pg_temp.poser_titres_gestes()
returns void language plpgsql as $tpt$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_vide integer;
  v_secr text; v_interv text; v_rh text; v_contenus text;
begin
  insert into perso (ordre, nom, email, role) values
    (20, 't_secr', 'preuve7.eq.t.secr@exemple.invalid', 'prof'),
    (21, 't_interv', 'preuve7.eq.t.interv@exemple.invalid', 'prof'),
    (22, 't_rh', 'preuve7.eq.t.rh@exemple.invalid', 'prof'),
    (23, 't_contenus', 'preuve7.eq.t.contenus@exemple.invalid', 'prof'),
    (24, 'dir_vide', 'preuve7.eq.dir.vide@exemple.invalid', 'prof');
  insert into public.user_profiles (email, role, is_admin) select email, role, false from perso where ordre >= 20;
  v_secr := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve7 secrétariat'', ''centre'', %s, %L::jsonb, ''preuve'') returning id::text',
    v_l1, '{"promos":"voir","stagiaires":"modifier","emargement":"voir","equipe":"voir"}'));
  v_interv := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve7 intervenant'', ''promo'', %s, %L::jsonb, ''preuve'') returning id::text',
    v_l1, '{"planning":"voir","emargement":"modifier","stagiaires":"voir","cours":"voir"}'));
  v_rh := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve7 ressources humaines'', ''centre'', %s, %L::jsonb, ''preuve'') returning id::text',
    v_l1, '{"promos":"voir","equipe":"voir"}'));
  v_contenus := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve7 contenus'', ''reseau'', null, %L::jsonb, ''preuve'') returning id::text',
    '{"cours":"modifier"}'));
  perform pg_temp.affecter((select email from perso where nom = 't_secr'), 'direction', null, v_l1, v_secr);
  perform pg_temp.affecter((select email from perso where nom = 't_interv'), 'formateur', 1, null, v_interv);
  perform pg_temp.affecter((select email from perso where nom = 't_rh'), 'direction', null, v_l1, v_rh);
  perform pg_temp.affecter((select email from perso where nom = 't_contenus'), 'siege', null, null, v_contenus);
  insert into public.lieux (nom) values ('Preuve7 centre sans promo') returning id into v_vide;
  update perso set info = v_vide::text where nom = 'dir_vide';
  insert into public.affectations (email, role, promo_id, lieu_id) values ((select email from perso where nom = 'dir_vide'), 'direction', null, v_vide);
end $tpt$;

-- La requête de l'équivalence : pour chaque geste, « code|forme=nouveau/ancien », jouée d'un trait par un personnage. {p} est la promo
-- (celle de la requête, ou 1, 2, 7), l le centre (celui de la requête, ou 1, 2, 4). L'ancien prédicat est celui du lot 4 :
-- F formateur, E équipe (formateur ou direction du centre), R rédacteur (formateur ou siège), P toute promo accessible.
create or replace function pg_temp.requete_equivalence()
returns text language plpgsql as $teq$
declare
  r text[] := '{}'; g record; pf text; lf text;
  v_f constant text := 'est_formateur({p})';
  v_e constant text := '(est_formateur({p}) or est_direction(lieu_de_promo({p})))';
  v_r constant text := '(est_formateur({p}) or est_siege())';
begin
  for g in select * from (values
      (1, 'planning.lire', null, v_e),
      (2, 'planning.modifier', null, v_f),
      (3, 'emargement.lire', null, v_e),
      (4, 'emargement.tenir', null, v_f),
      (5, 'stagiaires.lire', null, v_e),
      (6, 'stagiaires.gerer', null, v_e),
      (7, 'stagiaires.supprimer', null, v_f),
      (8, 'anonymiser', null, v_e),
      (9, 'benevoles.lire', null, v_e),
      (10, 'benevoles.gerer', null, v_f),
      (11, 'benevoles.purger', null, v_f),
      (12, 'notes.lire', null, v_e),
      (13, 'notes.saisir', null, v_f),
      (14, 'contenus.lire_internes', null, '(est_formateur({p}) or est_direction(lieu_de_promo({p})) or est_siege())'),
      (15, 'contenus.rediger', null, v_r),
      (16, 'referentiel.modifier', null, v_f),
      (17, 'contenus.traiter', null, v_f),
      (18, 'reglages.modifier', null, v_f),
      (19, 'modules.modifier', null, v_e),
      (20, 'promo.renommer', null, v_e),
      (21, 'fiches_internes.ecrire', null, v_e)
    ) v(ordre, code, nouveau, ancien) order by ordre loop
    foreach pf in array array['promo_courante()', '1', '2', '7'] loop
      r := r || format('%L || coalesce((%s)::text, ''nul'') || ''/'' || coalesce((%s)::text, ''nul'')',
        g.code || '|p:' || pf || '=',
        replace(coalesce(g.nouveau, format('geste_promo({p}, %L)', g.code)), '{p}', pf),
        replace(g.ancien, '{p}', pf));
    end loop;
  end loop;
  -- Lecture « P » (toute promo accessible, y compris par sa fiche) : le geste ou le stagiaire de la promo, contre la promo affichée.
  r := r || format('%L || coalesce((geste_promo(promo_courante(), ''planning.lire'') or membre_stagiaire(promo_courante()))::text, ''nul'') || ''/'' || coalesce((promo_courante() is not null)::text, ''nul'')',
    'planning.lire+membre|p:promo_courante()=');
  foreach lf in array array['stagiaires.lire', 'emargement.lire', 'notes.lire'] loop
    r := r || format('%L || coalesce((geste_promo(promo_courante(), %L) or membre_stagiaire(promo_courante()))::text, ''nul'') || ''/'' || coalesce((promo_courante() is not null)::text, ''nul'')',
      lf || '+membre|p:promo_courante()=', lf);
  end loop;
  for g in select * from (values ('promos.gerer'), ('reglages.modifier'), ('donnees.purger'), ('formateurs.nommer'), ('equipe.lire')) v(code) loop
    foreach lf in array array['lieu_courant()', '1', '2', '4'] loop
      r := r || format('%L || coalesce((geste_centre(%s, %L))::text, ''nul'') || ''/'' || coalesce((est_direction(%s))::text, ''nul'')',
        g.code || '|l:' || lf || '=', lf, g.code, lf);
    end loop;
  end loop;
  for g in select * from (values ('centres.creer'), ('directions.nommer'), ('directions.lire'), ('reglages.modifier')) v(code) loop
    r := r || format('%L || coalesce((geste_reseau(%L))::text, ''nul'') || ''/'' || coalesce((est_siege())::text, ''nul'')',
      g.code || '|r=', g.code);
  end loop;
  return 'select ' || array_to_string(r, ' || '','' || ');
end $teq$;

-- Un personnage dans chaque contexte (sans en-tête, en-tête promo 1, 2, 7 ; puis chaque aperçu avec l'en-tête 1 et 2) : un contrôle,
-- qui nomme les écarts (contexte, code, forme de p ou de l, nouveau/ancien). p_email nul : l'acteur anonyme.
create or replace function pg_temp.equivalence_de(p_nom text, p_email text, p_requete text)
returns void language plpgsql as $teq2$
declare
  ctx record; v_res text; tok text; v_nctx integer := 0; v_ncmp integer := 0; v_necart integer := 0; v_ecarts text := '';
begin
  for ctx in
    select h.e, null::text as a from (values (null::text), ('1'), ('2'), ('7')) h(e)
    union all
    select h.e, a.a from (values ('1'), ('2')) h(e) cross join (values ('stagiaire'), ('formateur'), ('direction'), ('siege')) a(a)
  loop
    v_nctx := v_nctx + 1;
    v_res := pg_temp.valeur(p_email, ctx.e, ctx.a, p_requete);
    if v_res is null or v_res like 'ERREUR %' then
      v_necart := v_necart + 1;
      v_ecarts := v_ecarts || format('%s/%s : %s ; ', coalesce(ctx.e, 'sans'), coalesce(ctx.a, 'aucun'), coalesce(v_res, 'nul'));
      continue;
    end if;
    for tok in select regexp_split_to_table(v_res, ',') loop
      v_ncmp := v_ncmp + 1;
      if split_part(split_part(tok, '=', 2), '/', 1) is distinct from split_part(split_part(tok, '=', 2), '/', 2)
         or split_part(split_part(tok, '=', 2), '/', 1) not in ('true', 'false') then
        v_necart := v_necart + 1;
        if length(v_ecarts) < 400 then
          v_ecarts := v_ecarts || format('%s/%s : %s ; ', coalesce(ctx.e, 'sans'), coalesce(ctx.a, 'aucun'), tok);
        end if;
      end if;
    end loop;
  end loop;
  perform pg_temp.verifier('equivalence', format('%s : chaque geste égale son ancien prédicat, dans %s contextes', p_nom, v_nctx),
    v_necart = 0 and v_ncmp > 0, left(format('%s écart(s) sur %s comparaisons ; %s', v_necart, v_ncmp, v_ecarts), 400));
  perform pg_temp.informer('équivalence ' || p_nom, format('%s contextes, %s comparaisons', v_nctx, v_ncmp));
end $teq2$;

-- Les trois listes de codes.
create or replace function pg_temp.codes_promo()
returns text[] language sql as $tcp$
  select array['planning.lire', 'planning.modifier', 'emargement.lire', 'emargement.tenir', 'stagiaires.lire', 'stagiaires.gerer',
    'stagiaires.supprimer', 'anonymiser', 'benevoles.lire', 'benevoles.gerer', 'benevoles.purger', 'notes.lire', 'notes.saisir',
    'contenus.lire_internes', 'contenus.rediger', 'referentiel.modifier', 'contenus.traiter', 'reglages.modifier', 'modules.modifier',
    'promo.renommer', 'fiches_internes.ecrire'];
$tcp$;
create or replace function pg_temp.codes_centre()
returns text[] language sql as $tcc$
  select array['promos.gerer', 'reglages.modifier', 'donnees.purger', 'formateurs.nommer', 'equipe.lire'];
$tcc$;
create or replace function pg_temp.codes_reseau()
returns text[] language sql as $tcr$
  select array['centres.creer', 'directions.nommer', 'directions.lire', 'reglages.modifier'];
$tcr$;

-- Les gestes d'un personnage, attendus écrits en dur : la liste (séparée par des virgules) de ceux qui doivent être vrais, tous les
-- autres faux, aucun nul. p_expr : la promo (ou le centre) en SQL, évaluée par le personnage, avec l'en-tête promo p_entete.
create or replace function pg_temp.attendus(p_niveau text, p_qui text, p_entete text, p_expr text, p_vrais text)
returns void language plpgsql as $tat$
declare
  v_email text := (select email from pg_temp.perso where nom = p_qui);
  v_codes text[] := case p_niveau when 'promo' then pg_temp.codes_promo() when 'centre' then pg_temp.codes_centre() else pg_temp.codes_reseau() end;
  v_req text; v_res text; tok text; v_ecart text := ''; v_att text;
begin
  select 'select ' || string_agg(format('%L || coalesce((%s)::text, ''nul'')', c || '=',
           case p_niveau when 'promo' then format('geste_promo(%s, %L)', p_expr, c)
                         when 'centre' then format('geste_centre(%s, %L)', p_expr, c)
                         else format('geste_reseau(%L)', c) end), ' || '','' || ')
    into v_req from unnest(v_codes) c;
  v_res := pg_temp.valeur(v_email, p_entete, null, v_req);
  if v_res is null or v_res like 'ERREUR %' then
    v_ecart := coalesce(v_res, 'nul');
  else
    for tok in select regexp_split_to_table(v_res, ',') loop
      v_att := case when split_part(tok, '=', 1) = any (string_to_array(p_vrais, ',')) then 'true' else 'false' end;
      if split_part(tok, '=', 2) is distinct from v_att then
        v_ecart := v_ecart || format('%s (attendu %s, obtenu %s) ; ', split_part(tok, '=', 1), v_att, split_part(tok, '=', 2));
      end if;
    end loop;
  end if;
  perform pg_temp.attendre('gestes', format('%s%s : %s gestes de %s sur %s comme attendu', p_qui,
    coalesce(', en-tête ' || p_entete, ''), cardinality(v_codes), p_niveau,
    case p_niveau when 'reseau' then 'le réseau' else regexp_replace(p_expr, '\(select [^)]*\)', 'son centre vide') end), v_ecart, '');
end $tat$;

-- Une valeur attendue (texte) d'une requête jouée par un personnage dans un contexte.
create or replace function pg_temp.attendu_geste(p_libelle text, p_qui text, p_entete text, p_apercu text, p_sql text, p_attendu text)
returns void language plpgsql as $tag$
begin
  perform pg_temp.attendre('gestes', p_libelle,
    pg_temp.valeur((select email from pg_temp.perso where nom = p_qui), p_entete, p_apercu, p_sql), p_attendu);
end $tag$;

do $tprv$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  c_a constant text := 'preuve7.form.a@exemple.invalid';
  c_b constant text := 'preuve7.form.b@exemple.invalid';
  c_c constant text := 'preuve7.form.c@exemple.invalid';
  c_dir constant text := 'preuve7.dir.un@exemple.invalid';
  c_dir2 constant text := 'preuve7.dir.deux@exemple.invalid';
  c_siege constant text := 'preuve7.siege@exemple.invalid';
  c_auth constant text := 'preuve7.compte@exemple.invalid';
  v_pa constant integer := 990701; v_pb constant integer := 990702; v_pc constant integer := 990703;
  v_en_ligne boolean;
  v_etat text; v_etat1 text; v_retour text; v_retour1 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_lieu1 integer; v_lieu2 integer;
  s_form constant text := 'preuve7.seed.form@exemple.invalid';
  s_dir constant text := 'preuve7.seed.dir@exemple.invalid';
  s_siege constant text := 'preuve7.seed.siege@exemple.invalid';
  c_x constant text := 'preuve7.form.x@exemple.invalid';
  v_n_juge text;
  v_c1 text; v_c2 text; v_p1 text; v_p2 text; v_r1 text; v_x text;
  v_p record; v_req_eq text;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'titres-en-ligne%';

  -- 1. Avant les migrations : empreinte de la base, centres des promos 1 et 2.
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  v_lieu1 := (select lieu_id from public.promos where id = 1);
  v_lieu2 := (select lieu_id from public.promos where id = 2);
  perform pg_temp.verifier('structure', 'les promos 1 et 2 sont dans deux centres différents',
    v_lieu1 is not null and v_lieu2 is not null and v_lieu1 <> v_lieu2,
    format('centres des promos 1 et 2 : %s et %s', coalesce(v_lieu1::text, 'nul'), coalesce(v_lieu2::text, 'nul')));

  -- 1 bis. Des lignes d'affectation d'avant la migration (un formateur, une direction, un siège) : le remplissage se juge sur elles.
  insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values
    (v_pa, v_lieu1, 'Preuve7 promo A', current_date - 20, null),
    (v_pb, v_lieu1, 'Preuve7 promo B', current_date - 20, null),
    (v_pc, v_lieu2, 'Preuve7 promo C', current_date - 20, null);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id, prof_id) values
    (s_form, 'prof', true, null, null), (s_dir, 'prof', false, null, null), (s_siege, 'prof', false, null, null);
  insert into public.affectations (email, role, promo_id, lieu_id) values
    (s_form, 'formateur', v_pa, null), (s_dir, 'direction', null, v_lieu1), (s_siege, 'siege', null, null);

  -- 2. Les migrations, dans l'ordre (neutralisées dans les modes sans elles).
  v_etat := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261112_titres_1_tables.sql@@
  );
  v_etat1 := v_etat;
  perform pg_temp.etape('migration 1', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 2',
-- @@INJECTER supabase/migrations/20261112_titres_2_gestes.sql@@
  );
  perform pg_temp.etape('migration 2', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 3',
-- @@INJECTER supabase/migrations/20261112_titres_3_regles.sql@@
  );
  perform pg_temp.etape('migration 3', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 4',
-- @@INJECTER supabase/migrations/20261112_titres_4_journal.sql@@
  );
  perform pg_temp.etape('migration 4', v_etat, v_mode);

  -- 3. Groupe titres : les lignes que la migration 1 pose d'elle-même, avant tout essai.
  perform pg_temp.attendre('titres', 'trois titres fixes, un par niveau',
    pg_temp.calcul($q$select string_agg(niveau || ':' || nom, ',' order by niveau collate "C") from public.titres where fixe$q$),
    'centre:Direction de centre,promo:Formateur,reseau:Siège');
  perform pg_temp.attendre('titres', 'chaque affectation porte le titre fixe de son niveau',
    pg_temp.calcul($q$select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe or t.niveau <> case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end$q$), '0');
  perform pg_temp.attendre('titres', 'le remplissage, ligne à ligne : le formateur, la direction et le siège d''avant la migration ont le titre de leur niveau',
    pg_temp.calcul(format('select string_agg(a.email || ''>'' || t.nom, '','' order by a.email collate "C") from public.affectations a join public.titres t on t.id = a.titre_id where a.email in (%L, %L, %L)', s_form, s_dir, s_siege)),
    format('%s>Direction de centre,%s>Formateur,%s>Siège', s_dir, s_form, s_siege));
  v_n_juge := pg_temp.calcul($q$select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id where t.fixe and t.niveau = case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end$q$);
  perform pg_temp.informer('lignes d''affectation jugées (titre fixe de leur niveau)', v_n_juge);
  perform pg_temp.attendre('titres', 'au moins trois lignes jugées (une de chaque rôle), jamais un contrôle à vide',
    (v_n_juge ~ '^[0-9]+$' and v_n_juge::integer >= 3)::text, 'true');
  perform pg_temp.attendre('titres', 'aucune affectation sans titre',
    pg_temp.calcul($q$select count(*)::text from public.affectations where titre_id is null$q$), '0');
  perform pg_temp.attendre('titres', 'les titres fixes ont des cases vides, aucun centre, la marque de la migration',
    pg_temp.calcul($q$select string_agg(distinct (cases = '{}'::jsonb)::text || '/' || coalesce(lieu_id::text, 'sans') || '/' || cree_par, ',') from public.titres where fixe$q$),
    'true/sans/migration 20261112_titres_1');
  perform pg_temp.attendre('titres', 'les pages du niveau promo (nombre)',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('promo')$q$), '8');
  perform pg_temp.attendre('titres', 'les pages du niveau centre (nombre)',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('centre')$q$), '6');
  perform pg_temp.attendre('titres', 'les pages du niveau reseau (nombre)',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('reseau')$q$), '3');
  perform pg_temp.attendre('titres', 'plafonds du niveau promo',
    pg_temp.calcul($q$select string_agg(page || ':' || plafond, ',' order by page collate "C") from public._pages_du_niveau('promo')$q$),
    'ccp2:1,cours:2,emargement:2,indicateurs:1,notes:2,planning:2,reglages:2,stagiaires:2');
  perform pg_temp.attendre('titres', 'plafonds du niveau centre',
    pg_temp.calcul($q$select string_agg(page || ':' || plafond, ',' order by page collate "C") from public._pages_du_niveau('centre')$q$),
    'emargement:1,equipe:2,notes:1,promos:2,reglages:2,stagiaires:2');
  perform pg_temp.attendre('titres', 'plafonds du niveau reseau',
    pg_temp.calcul($q$select string_agg(page || ':' || plafond, ',' order by page collate "C") from public._pages_du_niveau('reseau')$q$),
    'cours:2,directions:2,reglages:2');
  perform pg_temp.attendre('titres', 'un niveau inconnu n''a aucune page',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('autre')$q$), '0');

  -- 4. Groupe cases : _cases_valides.
  perform pg_temp.cases('promo', '{}', true);
  perform pg_temp.cases('promo', '{"notes":"voir"}', false);
  perform pg_temp.cases('promo', '{"notes":"voir","stagiaires":"voir"}', true);
  perform pg_temp.cases('promo', '{"planning":"modifier","stagiaires":"voir"}', true);
  perform pg_temp.cases('promo', '{"emargement":"voir"}', false);
  perform pg_temp.cases('promo', '{"indicateurs":"voir"}', false);
  perform pg_temp.cases('promo', '{"indicateurs":"voir","stagiaires":"non"}', false);
  perform pg_temp.cases('promo', '{"cours":"modifier"}', true);
  perform pg_temp.cases('promo', '{"ccp2":"voir"}', true);
  perform pg_temp.cases('promo', '{"ccp2":"modifier"}', false);
  perform pg_temp.cases('promo', '{"indicateurs":"modifier","stagiaires":"voir"}', false);
  perform pg_temp.cases('promo', '{"reglages":"voir"}', false);
  perform pg_temp.cases('promo', '{"reglages":"modifier"}', true);
  perform pg_temp.cases('promo', '{"reglages":"non"}', true);
  perform pg_temp.cases('promo', '{"inconnue":"voir"}', false);
  perform pg_temp.cases('promo', '{"cours":"peut-etre"}', false);
  perform pg_temp.cases('promo', '{"cours":2}', false);
  perform pg_temp.cases('promo', '[]', false);
  perform pg_temp.cases('promo', '"voir"', false);
  perform pg_temp.cases('centre', '{"emargement":"voir"}', false);
  perform pg_temp.cases('centre', '{"emargement":"voir","stagiaires":"voir"}', true);
  perform pg_temp.cases('centre', '{"notes":"voir","stagiaires":"modifier"}', true);
  perform pg_temp.cases('centre', '{"emargement":"modifier","stagiaires":"voir"}', false);
  perform pg_temp.cases('centre', '{"notes":"modifier","stagiaires":"voir"}', false);
  perform pg_temp.cases('centre', '{"promos":"modifier","equipe":"voir"}', true);
  perform pg_temp.cases('centre', '{"planning":"voir"}', false);
  perform pg_temp.cases('centre', '{"reglages":"voir"}', false);
  perform pg_temp.cases('reseau', '{"cours":"modifier","directions":"voir","reglages":"modifier"}', true);
  perform pg_temp.cases('reseau', '{"stagiaires":"voir"}', false);
  perform pg_temp.cases('reseau', '{"reglages":"voir"}', false);
  perform pg_temp.cases('autre', '{}', false);

  -- 5. Personnages d'essai, en propriétaire.
  insert into public.user_profiles (email, role, is_admin, stagiaire_id, prof_id) values
    (c_x, 'prof', true, null, null), (c_a, 'prof', true, null, null), (c_b, 'prof', true, null, null), (c_c, 'prof', true, null, null),
    (c_dir, 'prof', false, null, null), (c_dir2, 'prof', false, null, null), (c_siege, 'prof', false, null, null),
    (c_auth, 'prof', false, null, null);

  -- 6. Groupe titres, suite : les contraintes de la table et l'unicité des noms.
  v_r1 := pg_temp.nouveau_titre('Preuve7 Qualité', 'reseau', null);
  v_c1 := pg_temp.nouveau_titre('Preuve7 centre un', 'centre', v_lieu1);
  v_c2 := pg_temp.nouveau_titre('Preuve7 centre deux', 'centre', v_lieu2);
  v_p1 := pg_temp.nouveau_titre('Preuve7 promo un', 'promo', v_lieu1);
  v_p2 := pg_temp.nouveau_titre('Preuve7 promo deux', 'promo', v_lieu1);
  perform pg_temp.attendre('titres', 'cinq titres d''essai créés (un du réseau, deux de centre, deux de promo)',
    (select count(*)::text from unnest(array[v_r1, v_c1, v_c2, v_p1, v_p2]) x where x ~ '^[0-9]+$'), '5');
  perform pg_temp.attendre('titres', 'deux titres du réseau « Qualité » et « qualité » : refusé (23505)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 qualité', 'reseau')$q$), 'ERREUR 23505');
  perform pg_temp.attendre('titres', 'un titre de centre du même nom qu''un titre du réseau : permis',
    pg_temp.essai($q$insert into public.titres (nom, niveau, lieu_id) values ('PREUVE7 QUALITÉ', 'centre', $q$ || v_lieu1 || ')'), 'OK');
  perform pg_temp.attendre('titres', 'le même nom dans deux centres : permis',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id) values (''Preuve7 commun'', ''promo'', %s), (''Preuve7 commun'', ''promo'', %s)', v_lieu1, v_lieu2)), 'OK');
  perform pg_temp.attendre('titres', 'le même nom (casse ignorée) deux fois dans un centre : refusé (23505)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id) values (''preuve7 COMMUN'', ''promo'', %s)', v_lieu1)), 'ERREUR 23505');
  perform pg_temp.attendre('titres', 'un second titre fixe dans un niveau : refusé (23505)',
    pg_temp.essai($q$insert into public.titres (nom, niveau, fixe) values ('Preuve7 autre fixe', 'promo', true)$q$), 'ERREUR 23505');
  perform pg_temp.attendre('titres', 'un titre fixe rattaché à un centre : refusé (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, fixe, lieu_id) values (''Preuve7 fixe centre'', ''centre'', true, %s)', v_lieu1)), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'un titre du réseau rattaché à un centre : refusé (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id) values (''Preuve7 reseau centre'', ''reseau'', %s)', v_lieu1)), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'une origine sur un titre sans centre : refusé (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, origine_id) values (''Preuve7 origine'', ''reseau'', %s)', coalesce(v_r1, 'null'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'la version d''un centre d''un titre du réseau (origine + centre) : permise',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id, origine_id) values (''Preuve7 version'', ''centre'', %s, %s)', v_lieu1, coalesce(v_r1, 'null'))), 'OK');
  perform pg_temp.attendre('titres', 'un niveau inconnu : refusé (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 niveau', 'autre')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases inadmissibles (page inconnue) : refusées (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau, cases) values ('Preuve7 cases', 'reseau', '{"inconnue":"voir"}')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases qui trahissent § 5.4 : refusées (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id, cases) values (''Preuve7 cases deux'', ''promo'', %s, ''{"notes":"voir"}'')', v_lieu1)), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases admissibles : permises',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id, cases) values (''Preuve7 cases trois'', ''promo'', %s, ''{"notes":"voir","stagiaires":"voir"}'')', v_lieu1)), 'OK');
  perform pg_temp.attendre('titres', 'un titre non fixe de promo sans centre : refusé (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 promo sans centre', 'promo')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'un titre non fixe de centre sans centre : refusé (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 centre sans centre', 'centre')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases modifiées en cases inadmissibles : refusées (23514)',
    pg_temp.essai($q$update public.titres set cases = '{"ccp2":"modifier"}' where nom = 'Preuve7 cases trois'$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'supprimer le titre d''origine laisse la version du centre sans origine',
    pg_temp.essai(format('delete from public.titres where id = %s', coalesce(v_r1, '0'))) || ' ' ||
    pg_temp.calcul($q$select count(*)::text from public.titres where nom = 'Preuve7 version' and origine_id is null$q$), 'OK 1');

  -- 7. Groupe affectation : le déclencheur.
  perform pg_temp.attendre('affectation', 'un ajout en propriétaire sans titre_id reçoit le titre fixe de promo (formateur)',
    pg_temp.calcul(format('insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', %s) returning (titre_id = public.titre_fixe(''promo''))::text', c_a, v_pa)), 'true');
  perform pg_temp.attendre('affectation', 'un ajout sans titre_id reçoit le titre fixe de centre (direction)',
    pg_temp.calcul(format('insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s) returning (titre_id = public.titre_fixe(''centre''))::text', c_dir, v_lieu1)), 'true');
  perform pg_temp.attendre('affectation', 'un ajout sans titre_id reçoit le titre fixe du réseau (siège)',
    pg_temp.calcul(format('insert into public.affectations (email, role) values (%L, ''siege'') returning (titre_id = public.titre_fixe(''reseau''))::text', c_siege)), 'true');
  perform pg_temp.attendre('affectation', 'un titre_id nul cité explicitement reçoit aussi le titre fixe',
    pg_temp.calcul(format('insert into public.affectations (email, role, promo_id, titre_id) values (%L, ''formateur'', %s, null) returning (titre_id = public.titre_fixe(''promo''))::text', c_b, v_pb)), 'true');
  perform pg_temp.attendre('affectation', 'après ces ajouts, chaque affectation porte encore le titre fixe de son niveau',
    pg_temp.calcul($q$select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe or t.niveau <> case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end$q$), '0');
  perform pg_temp.attendre('affectation', 'un titre de niveau centre sur une ligne formateur : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pa, null, v_c1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de niveau promo sur une ligne direction : refusé (23514)',
    pg_temp.affecter(c_dir2, 'direction', null, v_lieu2, v_p1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de centre d''un autre centre : refusé (23514)',
    pg_temp.affecter(c_dir2, 'direction', null, v_lieu2, v_c1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'le titre du bon centre : permis',
    pg_temp.affecter(c_dir2, 'direction', null, v_lieu2, v_c2), 'OK');
  perform pg_temp.attendre('affectation', 'un titre de promo d''un autre centre que celui de la promo : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pc, null, v_p1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de centre sur une ligne siège : refusé (23514)',
    pg_temp.affecter(c_auth, 'siege', null, null, v_c1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de promo (non fixe) sur une première promo : permis',
    pg_temp.affecter(c_c, 'formateur', v_pa, null, v_p1), 'OK');
  perform pg_temp.attendre('affectation', 'un autre titre de promo dans le même centre : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pb, null, v_p2), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'le titre fixe, qui est un autre titre de promo, dans le même centre : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pb, null, 'public.titre_fixe(''promo'')'), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'le même titre sur une seconde promo du centre : permis',
    pg_temp.affecter(c_c, 'formateur', v_pb, null, v_p1), 'OK');
  perform pg_temp.attendre('affectation', 'une ligne dans un autre centre, sans titre cité : permise, avec le titre fixe',
    pg_temp.affecter(c_c, 'formateur', v_pc, null, null) || ' ' ||
    pg_temp.calcul(format('select (titre_id = public.titre_fixe(''promo''))::text from public.affectations where lower(email) = %L and promo_id = %s', c_c, v_pc)), 'OK true');
  perform pg_temp.attendre('affectation', 'la même adresse écrite en majuscules compte pour la même personne : refusé (23514)',
    pg_temp.affecter(upper(c_c), 'formateur', v_pb, null, v_p2), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'changer le titre d''une ligne alors qu''une autre ligne du centre garde l''ancien : refusé (23514)',
    pg_temp.essai(format('update public.affectations set titre_id = %s where lower(email) = %L and promo_id = %s', coalesce(v_p2, 'null'), c_c, v_pa)), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'retirer l''autre ligne du centre, puis changer le titre de la dernière : permis',
    pg_temp.essai(format('delete from public.affectations where lower(email) = %L and promo_id = %s', c_c, v_pb)) || ' ' ||
    pg_temp.essai(format('update public.affectations set titre_id = %s where lower(email) = %L and promo_id = %s', coalesce(v_p2, 'null'), c_c, v_pa)), 'OK OK');
  perform pg_temp.attendre('affectation', 'une ligne dont l''adresse change vers une personne qui a déjà un autre titre de promo dans le centre : refusé (23514)',
    pg_temp.affecter(c_x, 'formateur', v_pb, null, null) || ' ' ||
    pg_temp.essai(format('update public.affectations set email = %L where email = %L', c_c, c_x)), 'OK ERREUR 23514');
  perform pg_temp.attendre('affectation', 'une promo changée vers un autre centre avec un titre du premier centre : refusé (23514)',
    pg_temp.essai(format('update public.affectations set promo_id = %s where lower(email) = %L and promo_id = %s', v_pc, c_c, v_pa)), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre qui n''existe pas : refusé par la clé étrangère (23503)',
    pg_temp.affecter(c_auth, 'formateur', v_pa, null, '999999999'), 'ERREUR 23503');
  perform pg_temp.attendre('affectation', 'supprimer un titre encore porté : refusé (23001, restrict)',
    pg_temp.essai(format('delete from public.titres where id = %s', coalesce(v_p2, '0'))), 'ERREUR 23001');
  perform pg_temp.attendre('affectation', 'supprimer un titre fixe encore porté : refusé (23001, restrict)',
    pg_temp.essai($q$delete from public.titres where fixe and niveau = 'promo'$q$), 'ERREUR 23001');

  -- 7 bis. Un titre porté (ou fixe) ne change ni de niveau, ni de centre, ni de caractère fixe.
  perform pg_temp.attendre('titres', 'titre porté : changer son niveau est refusé (23514)',
    pg_temp.essai(format('update public.titres set niveau = ''centre'' where id = %s', coalesce(v_p2, '0'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre porté : changer son centre est refusé (23514)',
    pg_temp.essai(format('update public.titres set lieu_id = %s where id = %s', v_lieu2, coalesce(v_p2, '0'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre porté : le rendre fixe est refusé (23514)',
    pg_temp.essai(format('update public.titres set fixe = true, lieu_id = null where id = %s', coalesce(v_p2, '0'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre fixe : changer son niveau est refusé (23514)',
    pg_temp.essai($q$update public.titres set niveau = 'reseau' where fixe and niveau = 'promo'$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre fixe : le rendre non fixe est refusé (23514)',
    pg_temp.essai($q$update public.titres set fixe = false where fixe and niveau = 'centre'$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre porté : le nom et les cases se modifient (OK OK)',
    pg_temp.essai(format('update public.titres set nom = ''Preuve7 promo deux bis'' where id = %s', coalesce(v_p2, '0'))) || ' ' ||
    pg_temp.essai(format('update public.titres set cases = ''{"cours":"voir"}'' where id = %s', coalesce(v_p2, '0'))), 'OK OK');
  perform pg_temp.attendre('titres', 'titre non porté : son centre peut changer',
    pg_temp.essai(format('update public.titres set lieu_id = %s where id = %s', v_lieu2, coalesce(v_c1, '0'))), 'OK');

  -- 8. Groupe droits : aucun accès direct aux titres, jamais de titre_id choisi par un client.
  perform pg_temp.attendre('droits', 'authenticated ne lit pas titres (42501)',
    pg_temp.valeur(c_auth, null, null, 'select count(*)::text from public.titres'), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'anon ne lit pas titres (42501)',
    pg_temp.valeur(null, null, null, 'select count(*)::text from public.titres'), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'authenticated n''écrit pas dans titres (42501)',
    pg_temp.valeur(c_auth, null, null, $q$insert into public.titres (nom, niveau) values ('Preuve7 client', 'reseau') returning id::text$q$), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'anon n''écrit pas dans titres (42501)',
    pg_temp.valeur(null, null, null, $q$insert into public.titres (nom, niveau) values ('Preuve7 anonyme', 'reseau') returning id::text$q$), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'authenticated ne modifie ni ne supprime les titres (42501)',
    pg_temp.valeur(c_auth, null, null, $q$update public.titres set nom = 'x' returning id::text$q$) || ' ' ||
    pg_temp.valeur(c_auth, null, null, $q$delete from public.titres returning id::text$q$), 'ERREUR 42501 ERREUR 42501');
  perform pg_temp.attendre('droits', 'aucun droit de table sur titres pour anon ni authenticated (PUBLIC compris, par héritage)',
    pg_temp.calcul($q$select count(*)::text from (select unnest(array['select','insert','update','delete','truncate','references','trigger']) p) x, unnest(array['anon','authenticated']) r where has_table_privilege(r, 'public.titres', x.p)$q$), '0');
  perform pg_temp.attendre('droits', 'authenticated n''insère pas titre_id dans affectations (droit de colonne)',
    pg_temp.calcul($q$select has_column_privilege('authenticated', 'public.affectations', 'titre_id', 'insert')::text$q$), 'false');
  perform pg_temp.attendre('droits', 'anon n''insère pas titre_id dans affectations (droit de colonne)',
    pg_temp.calcul($q$select has_column_privilege('anon', 'public.affectations', 'titre_id', 'insert')::text$q$), 'false');
  perform pg_temp.attendre('droits', 'un client qui cite titre_id à l''ajout : refusé (42501)',
    pg_temp.valeur(c_auth, null, null, format('insert into public.affectations (email, role, promo_id, titre_id) values (%L, ''formateur'', %s, 1) returning id::text', c_auth, v_pa)), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'le droit d''insertion par colonne des affectations garde ses quatre colonnes',
    pg_temp.calcul($q$select string_agg(a.attname, ',' order by a.attname collate "C") from pg_attribute a where a.attrelid = 'public.affectations'::regclass and a.attnum > 0 and not a.attisdropped and has_column_privilege('authenticated', a.attrelid, a.attnum, 'insert')$q$),
    'email,lieu_id,promo_id,role');
  perform pg_temp.attendre('droits', 'titres : sécurité par ligne active, et aucune règle (la lecture passera par des fonctions)',
    pg_temp.calcul($q$select (c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'titres'))::text from pg_class c where c.oid = 'public.titres'::regclass$q$), 'true');
  perform pg_temp.attendre('droits', 'les cinq fonctions de la migration 1 n''ont aucun droit d''exécution pour anon ni authenticated',
    pg_temp.calcul($q$select count(*)::text from unnest(array['public._pages_du_niveau(text)', 'public._cases_valides(text, jsonb)', 'public.titre_fixe(text)', 'public._affectations_titre()', 'public._titres_stable()']) f, unnest(array['anon','authenticated']) r where has_function_privilege(r, f, 'execute')$q$), '0');

  -- 8 bis. Groupe equivalence : chaque geste vaut l'ancien prédicat du lot 4, pour chaque personnage et chaque contexte (en-tête promo,
  -- aperçu du fondateur, aperçu refusé à un compte qui n'est pas le fondateur). Les personnages sont posés ici, en propriétaire.
  perform pg_temp.poser_perso();
  v_req_eq := pg_temp.requete_equivalence();
  for v_p in select nom, email from pg_temp.perso order by ordre loop
    perform pg_temp.equivalence_de(v_p.nom, v_p.email, v_req_eq);
  end loop;
  perform pg_temp.equivalence_de('anonyme (sans jeton)', null, v_req_eq);

  -- 8 ter. Groupe gestes : attendus écrits en dur. Titres non fixes posés en propriétaire sur la promo 1 et son centre.
  perform pg_temp.poser_titres_gestes();
  -- Les titres fixes d'aujourd'hui. dir_n : la direction ne tient pas la feuille, ne saisit aucune note, ne supprime aucune fiche.
  perform pg_temp.attendus('promo', 'dir_n', '1', 'promo_courante()',
    'planning.lire,emargement.lire,stagiaires.lire,stagiaires.gerer,anonymiser,benevoles.lire,notes.lire,contenus.lire_internes,modules.modifier,promo.renommer,fiches_internes.ecrire');
  perform pg_temp.attendus('centre', 'dir_n', '1', 'lieu_de_promo(1)', 'promos.gerer,reglages.modifier,donnees.purger,formateurs.nommer,equipe.lire');
  perform pg_temp.attendus('centre', 'dir_n', '1', 'lieu_de_promo(2)', '');
  perform pg_temp.attendus('reseau', 'dir_n', '1', null, '');
  perform pg_temp.attendus('promo', 'form_n', '1', 'promo_courante()',
    'planning.lire,planning.modifier,emargement.lire,emargement.tenir,stagiaires.lire,stagiaires.gerer,stagiaires.supprimer,anonymiser,benevoles.lire,benevoles.gerer,benevoles.purger,notes.lire,notes.saisir,contenus.lire_internes,contenus.rediger,referentiel.modifier,contenus.traiter,reglages.modifier,modules.modifier,promo.renommer,fiches_internes.ecrire');
  perform pg_temp.attendus('centre', 'form_n', '1', 'lieu_de_promo(1)', '');
  perform pg_temp.attendus('reseau', 'form_n', '1', null, '');
  perform pg_temp.attendus('promo', 'siege', null, '1', 'contenus.lire_internes,contenus.rediger');
  perform pg_temp.attendus('promo', 'siege', '1', 'promo_courante()', 'contenus.lire_internes,contenus.rediger');
  perform pg_temp.attendus('centre', 'siege', null, 'lieu_de_promo(1)', '');
  perform pg_temp.attendus('reseau', 'siege', null, null, 'centres.creer,directions.nommer,directions.lire,reglages.modifier');
  -- Les titres non fixes.
  perform pg_temp.attendus('promo', 't_interv', '1', 'promo_courante()',
    'planning.lire,emargement.lire,emargement.tenir,stagiaires.lire,benevoles.lire,contenus.lire_internes');
  perform pg_temp.attendus('centre', 't_interv', '1', 'lieu_de_promo(1)', '');
  perform pg_temp.attendus('reseau', 't_interv', '1', null, '');
  perform pg_temp.attendus('promo', 't_secr', '1', 'promo_courante()', 'emargement.lire,stagiaires.lire,stagiaires.gerer');
  perform pg_temp.attendus('centre', 't_secr', '1', 'lieu_de_promo(1)', 'equipe.lire');
  perform pg_temp.attendus('reseau', 't_secr', '1', null, '');
  perform pg_temp.attendus('promo', 't_rh', '1', 'promo_courante()', '');
  perform pg_temp.attendus('centre', 't_rh', '1', 'lieu_de_promo(1)', 'equipe.lire');
  perform pg_temp.attendus('promo', 't_contenus', null, '1', 'contenus.lire_internes,contenus.rediger');
  perform pg_temp.attendus('centre', 't_contenus', null, 'lieu_de_promo(1)', '');
  perform pg_temp.attendus('reseau', 't_contenus', null, null, '');
  -- Sans promo affichée : le siège, une direction d'un centre sans promo, un formateur sous l'en-tête d'une promo inaccessible. Chaque geste
  -- de promo rend faux (jamais nul, jamais une erreur), sauf la partie réseau des contenus communs pour le siège (voir ci-dessus).
  perform pg_temp.attendus('promo', 'dir_vide', null, 'promo_courante()', '');
  perform pg_temp.attendus('centre', 'dir_vide', null, (select info from pg_temp.perso where nom = 'dir_vide'),
    'promos.gerer,reglages.modifier,donnees.purger,formateurs.nommer,equipe.lire');
  perform pg_temp.attendus('centre', 'dir_vide', null, 'lieu_de_promo(1)', '');
  perform pg_temp.attendus('promo', 'form_n', '2', 'promo_courante()', '');
  perform pg_temp.attendus('promo', 'form_n', '2', '2', '');
  -- Erreurs et valeurs limites.
  perform pg_temp.attendu_geste('geste_promo(1, un code inconnu) : ERREUR 22023', 'form_n', '1', null, $q$select public.geste_promo(1, 'inexistant')::text$q$, 'ERREUR 22023');
  perform pg_temp.attendu_geste('geste_centre(1, un code inconnu) : ERREUR 22023', 'dir_n', '1', null, $q$select public.geste_centre(1, 'inexistant')::text$q$, 'ERREUR 22023');
  perform pg_temp.attendu_geste('geste_reseau(un code inconnu) : ERREUR 22023', 'siege', null, null, $q$select public.geste_reseau('inexistant')::text$q$, 'ERREUR 22023');
  perform pg_temp.attendu_geste('un code inconnu échoue aussi quand la promo est nulle : ERREUR 22023', 'siege', null, null, $q$select public.geste_promo(null, 'inexistant')::text$q$, 'ERREUR 22023');
  perform pg_temp.attendu_geste('un code nul : ERREUR 22023', 'form_n', '1', null, $q$select public.geste_promo(1, null)::text$q$, 'ERREUR 22023');
  perform pg_temp.attendu_geste('fond : geste_promo(nul, planning.modifier) rend faux (pas nul)', 'fond', '1', null, $q$select public.geste_promo(null, 'planning.modifier')::text$q$, 'false');
  perform pg_temp.attendu_geste('fond : geste_centre(nul, promos.gerer) rend faux (pas nul)', 'fond', '1', null, $q$select public.geste_centre(null, 'promos.gerer')::text$q$, 'false');
  perform pg_temp.attendu_geste('fond : geste_reseau(centres.creer) vrai', 'fond', '1', null, $q$select public.geste_reseau('centres.creer')::text$q$, 'true');
  perform pg_temp.attendre('gestes', 'anonyme : geste_promo(1, planning.lire), geste_centre(1, promos.gerer) et geste_reseau(centres.creer) rendent faux',
    pg_temp.valeur(null, null, null, $q$select public.geste_promo(1, 'planning.lire')::text || ' ' || public.geste_centre(1, 'promos.gerer')::text || ' ' || public.geste_reseau('centres.creer')::text$q$),
    'false false false');
  -- Les cases (0 Non, 1 Voir, 2 Modifier) et les titres fixes seuls.
  perform pg_temp.attendu_geste('case_promo : t_interv a planning 1, emargement 2, notes 0, ccp2 0, une page inconnue 0', 't_interv', '1', null,
    $q$select concat_ws(' ', (public.case_promo(1, 'planning'))::text, (public.case_promo(1, 'emargement'))::text, (public.case_promo(1, 'notes'))::text, (public.case_promo(1, 'ccp2'))::text, (public.case_promo(1, 'inconnue'))::text)$q$, '1 2 0 0 0');
  perform pg_temp.attendu_geste('case_promo : t_interv n''a aucune case sur la promo 2 ni sur une promo nulle', 't_interv', '1', null,
    $q$select concat_ws(' ', (public.case_promo(2, 'planning'))::text, (public.case_promo(null, 'planning'))::text)$q$, '0 0');
  perform pg_temp.attendu_geste('case_promo : le titre fixe donne le plafond (ccp2 1, indicateurs 1, cours 2, une page de centre 0)', 'form_n', '1', null,
    $q$select concat_ws(' ', (public.case_promo(1, 'ccp2'))::text, (public.case_promo(1, 'indicateurs'))::text, (public.case_promo(1, 'cours'))::text, (public.case_promo(1, 'promos'))::text)$q$, '1 1 2 0');
  perform pg_temp.attendu_geste('case_centre : la direction fixe a le plafond (emargement 1, notes 1, promos 2, equipe 2)', 'dir_n', '1', null,
    $q$select concat_ws(' ', (public.case_centre(public.lieu_de_promo(1), 'emargement'))::text, (public.case_centre(public.lieu_de_promo(1), 'notes'))::text, (public.case_centre(public.lieu_de_promo(1), 'promos'))::text, (public.case_centre(public.lieu_de_promo(1), 'equipe'))::text)$q$, '1 1 2 2');
  perform pg_temp.attendu_geste('case_centre : t_secr a promos 1, stagiaires 2, emargement 1, equipe 1, notes 0, reglages 0', 't_secr', '1', null,
    $q$select concat_ws(' ', (public.case_centre(public.lieu_de_promo(1), 'promos'))::text, (public.case_centre(public.lieu_de_promo(1), 'stagiaires'))::text, (public.case_centre(public.lieu_de_promo(1), 'emargement'))::text, (public.case_centre(public.lieu_de_promo(1), 'equipe'))::text, (public.case_centre(public.lieu_de_promo(1), 'notes'))::text, (public.case_centre(public.lieu_de_promo(1), 'reglages'))::text)$q$, '1 2 1 1 0 0');
  perform pg_temp.attendu_geste('case_reseau : le siège fixe a le plafond (cours 2, directions 2, reglages 2)', 'siege', null, null,
    $q$select concat_ws(' ', (public.case_reseau('cours'))::text, (public.case_reseau('directions'))::text, (public.case_reseau('reglages'))::text)$q$, '2 2 2');
  perform pg_temp.attendu_geste('case_reseau : t_contenus a cours 2, directions 0, reglages 0', 't_contenus', null, null,
    $q$select concat_ws(' ', (public.case_reseau('cours'))::text, (public.case_reseau('directions'))::text, (public.case_reseau('reglages'))::text)$q$, '2 0 0');
  perform pg_temp.attendu_geste('formateur_fixe, direction_fixe, siege_fixe : form_n oui/non/non', 'form_n', '1', null,
    $q$select concat_ws(' ', (public.formateur_fixe(1))::text, (public.direction_fixe(public.lieu_de_promo(1)))::text, (public.siege_fixe())::text)$q$, 'true false false');
  perform pg_temp.attendu_geste('formateur_fixe, direction_fixe, siege_fixe : t_interv (titre non fixe) non/non/non', 't_interv', '1', null,
    $q$select concat_ws(' ', (public.formateur_fixe(1))::text, (public.direction_fixe(public.lieu_de_promo(1)))::text, (public.siege_fixe())::text)$q$, 'false false false');
  perform pg_temp.attendu_geste('formateur_fixe, direction_fixe, siege_fixe : t_secr (titre non fixe) non/non/non', 't_secr', '1', null,
    $q$select concat_ws(' ', (public.formateur_fixe(1))::text, (public.direction_fixe(public.lieu_de_promo(1)))::text, (public.siege_fixe())::text)$q$, 'false false false');
  perform pg_temp.attendu_geste('formateur_fixe, direction_fixe, siege_fixe : dir_n non/oui/non', 'dir_n', '1', null,
    $q$select concat_ws(' ', (public.formateur_fixe(1))::text, (public.direction_fixe(public.lieu_de_promo(1)))::text, (public.siege_fixe())::text)$q$, 'false true false');
  perform pg_temp.attendu_geste('formateur_fixe, direction_fixe, siege_fixe : siege non/non/oui', 'siege', null, null,
    $q$select concat_ws(' ', (public.formateur_fixe(1))::text, (public.direction_fixe(public.lieu_de_promo(1)))::text, (public.siege_fixe())::text)$q$, 'false false true');
  perform pg_temp.attendu_geste('formateur_fixe, direction_fixe, siege_fixe : t_contenus (titre non fixe) non/non/non', 't_contenus', null, null,
    $q$select concat_ws(' ', (public.formateur_fixe(1))::text, (public.direction_fixe(public.lieu_de_promo(1)))::text, (public.siege_fixe())::text)$q$, 'false false false');
  perform pg_temp.attendu_geste('formateur_fixe, direction_fixe, siege_fixe : un nul rend faux', 'fond', '1', null,
    $q$select concat_ws(' ', (public.formateur_fixe(null))::text, (public.direction_fixe(null))::text)$q$, 'false false');
  -- Le stagiaire de la promo (ce que lit aujourd'hui un stagiaire), le cumul, l'aperçu stagiaire.
  perform pg_temp.attendu_geste('membre_stagiaire : stag_n de la promo 1 oui, de la promo 2 non', 'stag_n', '1', null,
    $q$select concat_ws(' ', (public.membre_stagiaire(1))::text, (public.membre_stagiaire(2))::text, (public.membre_stagiaire(null))::text)$q$, 'true false false');
  perform pg_temp.attendu_geste('membre_stagiaire : cumul (fiche de la promo 1, formateur de la promo 2) oui en 1, non en 2', 'cumul', null, null,
    $q$select concat_ws(' ', (public.membre_stagiaire(1))::text, (public.membre_stagiaire(2))::text)$q$, 'true false');
  perform pg_temp.attendu_geste('cumul : formateur de la promo 2 (planning.modifier vrai), seulement membre de la promo 1 (faux)', 'cumul', null, null,
    $q$select concat_ws(' ', (public.geste_promo(1, 'planning.modifier'))::text, (public.geste_promo(2, 'planning.modifier'))::text, (public.geste_promo(1, 'planning.lire'))::text, (public.membre_stagiaire(1))::text)$q$, 'false true false true');
  perform pg_temp.attendu_geste('dir_form : direction du centre de la promo 1 et formateur de la promo 2 (emargement.tenir faux en 1, vrai en 2)', 'dir_form', null, null,
    $q$select concat_ws(' ', (public.geste_promo(1, 'emargement.tenir'))::text, (public.geste_promo(2, 'emargement.tenir'))::text, (public.geste_promo(1, 'emargement.lire'))::text)$q$, 'false true true');
  perform pg_temp.attendu_geste('membre_stagiaire : form_n en aperçu stagiaire sur la promo 1 oui, sur la promo 2 non', 'form_n', '1', 'stagiaire',
    $q$select concat_ws(' ', (public.membre_stagiaire(1))::text, (public.membre_stagiaire(2))::text, (public.geste_promo(1, 'planning.modifier'))::text)$q$, 'true false false');
  perform pg_temp.attendu_geste('membre_stagiaire en aperçu stagiaire : t_rh (titre de centre non fixe) n''y gagne rien, ni le planning', 't_rh', '1', 'stagiaire',
    $q$select concat_ws(' ', (public.membre_stagiaire(1))::text, (public.geste_promo(1, 'planning.lire'))::text, (public.geste_promo(1, 'stagiaires.lire'))::text)$q$, 'false false false');
  perform pg_temp.attendu_geste('membre_stagiaire en aperçu stagiaire : t_interv (titre de promo non fixe) n''y gagne rien', 't_interv', '1', 'stagiaire',
    $q$select concat_ws(' ', (public.membre_stagiaire(1))::text, (public.geste_promo(1, 'planning.lire'))::text, (public.geste_promo(1, 'notes.lire'))::text)$q$, 'false false false');
  perform pg_temp.attendu_geste('membre_stagiaire en aperçu stagiaire : stag_n (vraie fiche) oui', 'stag_n', '1', 'stagiaire',
    $q$select (public.membre_stagiaire(1))::text$q$, 'true');
  perform pg_temp.attendu_geste('membre_stagiaire en aperçu stagiaire : dir_n (direction fixe) oui', 'dir_n', '1', 'stagiaire',
    $q$select (public.membre_stagiaire(1))::text$q$, 'true');
  perform pg_temp.attendu_geste('membre_stagiaire en aperçu stagiaire : fond oui', 'fond', '1', 'stagiaire',
    $q$select (public.membre_stagiaire(1))::text$q$, 'true');
  perform pg_temp.attendu_geste('cumuls : dir_deux (direction de deux centres) a la direction des deux promos, siege_form (siège + formateur de la promo 1) forme la promo 1 seulement', 'dir_deux', null, null,
    $q$select concat_ws(' ', (public.geste_promo(1, 'anonymiser'))::text, (public.geste_promo(2, 'anonymiser'))::text, (public.geste_promo(7, 'anonymiser'))::text, (public.geste_promo(1, 'planning.modifier'))::text)$q$, 'true true false false');
  perform pg_temp.attendu_geste('cumuls : siege_form a les gestes du réseau et ceux de formateur sur la promo 1 seulement', 'siege_form', null, null,
    $q$select concat_ws(' ', (public.geste_reseau('centres.creer'))::text, (public.geste_promo(1, 'planning.modifier'))::text, (public.geste_promo(2, 'planning.modifier'))::text, (public.geste_promo(1, 'anonymiser'))::text)$q$, 'true true false true');
  perform pg_temp.attendu_geste('aperçu siège refusé à form_n (qui n''est pas le fondateur) : il garde ses droits de formateur et rien de plus', 'form_n', '1', 'siege',
    $q$select concat_ws(' ', (public.geste_promo(1, 'planning.modifier'))::text, (public.geste_reseau('centres.creer'))::text)$q$, 'true false');
  perform pg_temp.attendu_geste('fond en aperçu direction : emargement.tenir faux, anonymiser vrai ; en aperçu stagiaire : tout faux', 'fond', '1', 'direction',
    $q$select concat_ws(' ', (public.geste_promo(1, 'emargement.tenir'))::text, (public.geste_promo(1, 'anonymiser'))::text, (public.geste_centre(public.lieu_de_promo(1), 'promos.gerer'))::text)$q$, 'false true true');
  perform pg_temp.attendu_geste('fond en aperçu stagiaire : aucun geste', 'fond', '1', 'stagiaire',
    $q$select concat_ws(' ', (public.geste_promo(1, 'planning.lire'))::text, (public.geste_promo(1, 'notes.lire'))::text, (public.geste_centre(public.lieu_de_promo(1), 'promos.gerer'))::text, (public.geste_reseau('centres.creer'))::text, (public.membre_stagiaire(1))::text)$q$, 'false false false false true');
  perform pg_temp.attendu_geste('fond en aperçu siège : les gestes du réseau seulement', 'fond', '1', 'siege',
    $q$select concat_ws(' ', (public.geste_promo(1, 'planning.lire'))::text, (public.geste_centre(public.lieu_de_promo(1), 'promos.gerer'))::text, (public.geste_reseau('centres.creer'))::text)$q$, 'false false true');
  -- Droits d'exécution des dix fonctions : anon et authenticated, jamais PUBLIC.
  perform pg_temp.attendre('gestes', 'les dix fonctions des cases et des gestes : exécution pour anon et authenticated, aucune pour PUBLIC',
    pg_temp.calcul($q$select count(*)::text || '/' || (select count(*) from pg_proc pr where pr.pronamespace = 'public'::regnamespace
        and pr.proname in ('case_promo', 'case_centre', 'case_reseau', 'formateur_fixe', 'direction_fixe', 'siege_fixe', 'membre_stagiaire', 'geste_promo', 'geste_centre', 'geste_reseau')
        and pr.prosecdef and pr.provolatile = 's' and not exists (select 1 from aclexplode(pr.proacl) a where a.grantee = 0))::text
      from pg_proc pr where pr.pronamespace = 'public'::regnamespace
        and pr.proname in ('case_promo', 'case_centre', 'case_reseau', 'formateur_fixe', 'direction_fixe', 'siege_fixe', 'membre_stagiaire', 'geste_promo', 'geste_centre', 'geste_reseau')
        and has_function_privilege('anon', pr.oid, 'execute') and has_function_privilege('authenticated', pr.oid, 'execute')$q$), '10/10');

  -- 9. Les retours, dans l'ordre inverse (4, 3, 2, 1).
  v_retour := pg_temp.jouer('retour 4',
-- @@INJECTER supabase/migrations/20261112_titres_4_journal_retour.sql@@
  );
  perform pg_temp.etape('retour 4', v_retour, v_mode);
  v_retour := pg_temp.jouer('retour 3',
-- @@INJECTER supabase/migrations/20261112_titres_3_regles_retour.sql@@
  );
  perform pg_temp.etape('retour 3', v_retour, v_mode);
  v_retour := pg_temp.jouer('retour 2',
-- @@INJECTER supabase/migrations/20261112_titres_2_gestes_retour.sql@@
  );
  perform pg_temp.etape('retour 2', v_retour, v_mode);
  v_retour := pg_temp.jouer('retour 1',
-- @@INJECTER supabase/migrations/20261112_titres_1_tables_retour.sql@@
  );
  v_retour1 := v_retour;
  perform pg_temp.etape('retour 1', v_retour, v_mode);
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  if v_en_ligne or v_etat1 = 'neutralisée' or v_retour1 = 'neutralisée' then
    perform pg_temp.informer('retours', format('non jugeables (migration 1 ou son retour non injectés) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : plus de table titres, plus de colonne titre_id, plus de déclencheur',
      pg_temp.calcul($q$select concat_ws('/', coalesce(to_regclass('public.titres')::text, 'sans table'),
        (select count(*) from pg_attribute where attrelid = 'public.affectations'::regclass and attname = 'titre_id' and not attisdropped)::text,
        (select count(*) from pg_trigger where tgrelid = 'public.affectations'::regclass and tgname = 'affectations_titre')::text)$q$),
      'sans table/0/0');
    perform pg_temp.attendre('retour', 'après les retours : les cinq fonctions de la migration 1 ont disparu',
      pg_temp.calcul($q$select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname in ('_pages_du_niveau', '_cases_valides', 'titre_fixe', '_affectations_titre', '_titres_stable')$q$), '0');
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tprv$;
