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
--   fonctions   (migration 2, partie B) les 29 fonctions de l'app qui décidaient d'un droit passent par les gestes : pour chacune, un cas qu'une
--               case refuse et, quand un titre non fixe peut l'ouvrir, un cas qu'elle ouvre (attendus et phrases de refus écrits en dur) ;
--               les gestes définitifs et les droits sans page restent aux titres fixes ; après la migration les 29 définitions ont changé,
--               après son retour chacune retrouve exactement son empreinte d'avant.
--   cases       (migration 3) les 93 règles passent par les gestes : lectures en nombre de lignes, écritures par leur refus (0 ligne ou 42501),
--               pour des titres fictifs (secrétariat, intervenant, ressources humaines, contenus), un stagiaire membre de la promo, un cumul,
--               une direction qui forme ; « Non » ferme la lecture des données de la page, « Voir » ferme l'écriture, un titre non fixe
--               n'ouvre aucun geste définitif ni aucune fiche interne.
-- Le groupe de la migration 4 s'ajoutera ici, avec sa tâche.
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

-- Groupe fonctions (migration 2, partie B) : les 29 fonctions de l'app qui décident d'un droit passent par les gestes.
-- Les vingt-neuf, avec leur signature : une seule liste, pour l'empreinte avant et après.
create or replace function pg_temp.fonctions_b()
returns regprocedure[] language sql as $tfb$
  select array[
    'public.a_une_affectation(text)'::regprocedure, 'public.accepter_brouillon_ia(bigint, text, text, text, jsonb)'::regprocedure,
    'public.rejeter_brouillon_ia(bigint)'::regprocedure, 'public.anonymiser_promo()'::regprocedure,
    'public.etat_anonymisation_promo()'::regprocedure, 'public.anonymiser_stagiaire(integer)'::regprocedure,
    'public.anonymiser_promo(integer)'::regprocedure, 'public.etat_anonymisation_promo(integer)'::regprocedure,
    'public.benevoles_a_purger()'::regprocedure, 'public.benevoles_a_purger(integer)'::regprocedure,
    'public.purger_benevoles(integer[])'::regprocedure, 'public.purger_benevoles(integer[], integer)'::regprocedure,
    'public.venues_benevoles()'::regprocedure, 'public.notes_stagiaires_visibles()'::regprocedure,
    'public.epcf_moyennes(text)'::regprocedure, 'public.notes_stats_groupe()'::regprocedure,
    'public.set_date_naissance(integer, date)'::regprocedure, 'public.emargement_feuille(bigint, boolean)'::regprocedure,
    'public.emargement_ouvrir(text, text, text)'::regprocedure, 'public.emargement_signer(bigint, integer, text)'::regprocedure,
    'public.is_admin()'::regprocedure, 'public.is_prof()'::regprocedure, 'public.creer_promo(integer, text, date, date)'::regprocedure,
    'public.modifier_dates_promo(integer, date, date)'::regprocedure, 'public.regler_habillage_centre(integer, text, boolean)'::regprocedure,
    'public.regler_habillage_reseau(text)'::regprocedure, 'public.creer_centre(text)'::regprocedure,
    'public.regler_affectations_formateur(text, integer, integer[], integer)'::regprocedure,
    'public.inviter_compte(text, text, integer, integer, integer)'::regprocedure];
$tfb$;

-- Un appel de fonction par un personnage : « OK <valeur> » (la valeur en texte, « nul » si nulle) ou « ERREUR <état> <message> ».
-- Ce que l'appel a réussi reste fait (la preuve annule tout à la fin) ; un appel refusé ne laisse rien.
create or replace function pg_temp.appeler(p_qui text, p_entete text, p_sql text)
returns text language plpgsql as $tap$
declare v text; r text;
begin
  perform pg_temp.incarner((select email from pg_temp.perso where nom = p_qui), p_entete, null);
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $tap$;

-- Même appel, avec un en-tête d'aperçu du fondateur (x-apercu-role).
create or replace function pg_temp.cas_apercu(p_libelle text, p_qui text, p_entete text, p_apercu text, p_sql text, p_attendu text)
returns void language plpgsql as $tca$
declare v text; r text;
begin
  perform pg_temp.incarner((select email from pg_temp.perso where nom = p_qui), p_entete, p_apercu);
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  perform pg_temp.attendre('fonctions', p_libelle, r, p_attendu);
end $tca$;

-- Un cas du groupe fonctions : qui, avec quel en-tête de promo, appelle quoi, et ce qu'il doit obtenir (écrit en dur).
create or replace function pg_temp.cas(p_libelle text, p_qui text, p_entete text, p_sql text, p_attendu text)
returns void language sql as $tcs$
  select pg_temp.attendre('fonctions', p_libelle, pg_temp.appeler(p_qui, p_entete, p_sql), p_attendu);
$tcs$;

-- Quatre personnages de plus, aux titres non fixes qui ouvrent ce que les trois premiers ne couvrent pas (notes, cours, promos et
-- réglages d'un centre, directions et réglages du réseau). Si la table des titres manque, la pose échoue en silence.
create or replace function pg_temp.poser_titres_fonctions()
returns void language plpgsql as $tpf$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_notes text; v_cours text; v_promos text; v_reseau text;
begin
  insert into pg_temp.perso (ordre, nom, email, role) values
    (25, 't_notes', 'preuve7.eq.t.notes@exemple.invalid', 'prof'),
    (26, 't_cours', 'preuve7.eq.t.cours@exemple.invalid', 'prof'),
    (27, 't_promos', 'preuve7.eq.t.promos@exemple.invalid', 'prof'),
    (28, 't_reseau', 'preuve7.eq.t.reseau@exemple.invalid', 'prof');
  insert into public.user_profiles (email, role, is_admin) select email, role, false from pg_temp.perso where ordre >= 25;
  v_notes := pg_temp.nouveau_titre('Preuve7 notes', 'promo', v_l1);
  v_cours := pg_temp.nouveau_titre('Preuve7 cours', 'promo', v_l1);
  v_promos := pg_temp.nouveau_titre('Preuve7 promos et réglages', 'centre', v_l1);
  v_reseau := pg_temp.nouveau_titre('Preuve7 directions et réglages', 'reseau', null);
  perform pg_temp.essai(format('update public.titres set cases = %L::jsonb where id = %s', '{"notes":"voir","stagiaires":"voir"}', v_notes));
  perform pg_temp.essai(format('update public.titres set cases = %L::jsonb where id = %s', '{"cours":"modifier"}', v_cours));
  perform pg_temp.essai(format('update public.titres set cases = %L::jsonb where id = %s', '{"promos":"modifier","reglages":"modifier"}', v_promos));
  perform pg_temp.essai(format('update public.titres set cases = %L::jsonb where id = %s', '{"directions":"modifier","reglages":"modifier"}', v_reseau));
  perform pg_temp.affecter((select email from pg_temp.perso where nom = 't_notes'), 'formateur', 1, null, v_notes);
  perform pg_temp.affecter((select email from pg_temp.perso where nom = 't_cours'), 'formateur', 1, null, v_cours);
  perform pg_temp.affecter((select email from pg_temp.perso where nom = 't_promos'), 'direction', null, v_l1, v_promos);
  perform pg_temp.affecter((select email from pg_temp.perso where nom = 't_reseau'), 'siege', null, null, v_reseau);
end $tpf$;

-- Le groupe : pour chaque fonction, un cas qu'une case refuse et, quand un titre non fixe peut l'ouvrir, un cas qu'elle ouvre ;
-- les gestes définitifs et les droits sans page restent refusés aux titres non fixes (les phrases de refus ne changent pas).
create or replace function pg_temp.groupe_fonctions()
returns void language plpgsql as $tgf$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_stag integer := (select u.stagiaire_id from public.user_profiles u where u.email = 'preuve7.eq.stag.n@exemple.invalid');
  v_stag_email constant text := 'preuve7.eq.stag.n@exemple.invalid';
  v_stag_m integer := (select u.stagiaire_id from public.user_profiles u where u.email = 'preuve7.eq.stag.m@exemple.invalid');
  v_fiche integer; v_b1 integer; v_b2 integer; v_b3 integer; v_seance_m text;
  v_refus_form constant text := 'ERREUR P0001 emargement: Réservé aux formateurs.';
  v_refus_admin constant text := 'ERREUR P0001 Réservé aux administrateurs';
  v_refus_promo constant text := 'ERREUR 42501 Réservé à la direction du centre ou au formateur de la promo';
  v_refus_naiss constant text := 'ERREUR P0001 Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
begin
  perform pg_temp.poser_titres_fonctions();
  -- Les données d'essai, posées en propriétaire.
  delete from public.settings where promo_id = 1 and key = 'emargement_actif';
  insert into public.settings (key, value, promo_id) values ('emargement_actif', 'true', 1);
  insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve7 invitee', 'PREUVE', 991, 1) returning id into v_fiche;
  insert into public.benevoles (prenom, lieu_id, created_at) values ('Preuve7 b1', v_l1, now() - interval '2 years') returning id into v_b1;
  insert into public.benevoles (prenom, lieu_id, created_at) values ('Preuve7 b2', v_l1, now() - interval '2 years') returning id into v_b2;
  insert into public.benevoles (prenom, lieu_id) values ('Preuve7 b3', v_l1) returning id into v_b3;
  insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, promo_id, sujet, benevoles_ids)
    values (current_date - 7, 0, 'matin', 91, 1, 'preuve7 venue', array[v_b3]);
  update public.user_profiles set anonymous_notes = true where lower(email) = v_stag_email;
  insert into public.epcf_evaluations (stagiaire_id, trame, scores, promo_id) values (v_stag, 'salle', '{"preuve7_critere":"A"}'::jsonb, 1);

  -- is_admin() et is_prof() : la case Cours en Modifier (contenus.traiter), pas le titre fixe de formateur seul.
  perform pg_temp.cas('is_admin() : t_cours (Cours : Modifier) vrai', 't_cours', '1', 'select public.is_admin()::text', 'OK true');
  perform pg_temp.cas('is_admin() : t_interv (Cours : Voir) faux', 't_interv', '1', 'select public.is_admin()::text', 'OK false');
  perform pg_temp.cas('is_admin() : form_n vrai', 'form_n', '1', 'select public.is_admin()::text', 'OK true');
  perform pg_temp.cas('is_admin() : dir_n faux', 'dir_n', '1', 'select public.is_admin()::text', 'OK false');
  perform pg_temp.cas('is_admin() : stag_n faux', 'stag_n', '1', 'select public.is_admin()::text', 'OK false');
  perform pg_temp.cas('is_prof() : t_cours vrai', 't_cours', '1', 'select public.is_prof()::text', 'OK true');
  perform pg_temp.cas('is_prof() : t_interv faux', 't_interv', '1', 'select public.is_prof()::text', 'OK false');
  perform pg_temp.cas('is_prof() : form_n vrai', 'form_n', '1', 'select public.is_prof()::text', 'OK true');
  -- rejeter_brouillon_ia et accepter_brouillon_ia : la même case ; le brouillon -1 n'existe pas, donc passer la garde mène à la
  -- phrase suivante de la fonction.
  perform pg_temp.cas('rejeter_brouillon_ia : t_interv refusé (la phrase ne change pas)', 't_interv', '1',
    'select public.rejeter_brouillon_ia(-1)::text', 'ERREUR 42501 Réservé aux formateurs');
  perform pg_temp.cas('rejeter_brouillon_ia : t_cours passe la garde (brouillon déjà traité ou introuvable)', 't_cours', '1',
    'select public.rejeter_brouillon_ia(-1)::text', 'ERREUR P0001 Ce brouillon a déjà été traité');
  perform pg_temp.cas('accepter_brouillon_ia : t_interv refusé (la phrase ne change pas)', 't_interv', '1',
    $q$select public.accepter_brouillon_ia(-1, 's', 'e', 'x', '[]'::jsonb)::text$q$, 'ERREUR 42501 Réservé aux formateurs');
  perform pg_temp.cas('accepter_brouillon_ia : form_n passe la garde (brouillon introuvable)', 'form_n', '1',
    $q$select public.accepter_brouillon_ia(-1, 's', 'e', 'x', '[]'::jsonb)::text$q$, 'ERREUR P0001 Brouillon introuvable');

  -- Émargement : la case Émargement en Modifier (emargement.tenir). t_interv ouvre, tient et signe ; t_secr (Émargement : Voir) non.
  perform pg_temp.cas('emargement_ouvrir : t_secr refusé (la phrase ne change pas)', 't_secr', '1',
    $q$select public.emargement_ouvrir('matin', '08:30', '12:00')::text$q$, v_refus_form);
  perform pg_temp.cas('emargement_ouvrir : t_interv (Émargement : Modifier) ouvre la feuille du matin', 't_interv', '1',
    $q$select (public.emargement_ouvrir('matin', '08:30', '12:00') is not null)::text$q$, 'OK true');
  perform pg_temp.cas('emargement_ouvrir : form_n ouvre celle de l''après-midi', 'form_n', '1',
    $q$select (public.emargement_ouvrir('aprem', '13:30', '17:00') is not null)::text$q$, 'OK true');
  v_seance_m := pg_temp.calcul('select id::text from public.emargement_seances where promo_id = 1 and demi_journee = ''matin'' order by id desc limit 1');
  perform pg_temp.cas('emargement_feuille(..., formateur) : t_secr refusé (la phrase ne change pas)', 't_secr', '1',
    format('select (public.emargement_feuille(%s, true)).id::text', v_seance_m), v_refus_form);
  perform pg_temp.cas('emargement_feuille(..., formateur) : t_interv obtient la feuille', 't_interv', '1',
    format('select ((public.emargement_feuille(%s, true)).id = %s)::text', v_seance_m, v_seance_m), 'OK true');
  perform pg_temp.cas('emargement_feuille(..., stagiaire) : t_secr (Émargement : Voir) obtient la feuille sans la tenir', 't_secr', '1',
    format('select ((public.emargement_feuille(%s, false)).id = %s)::text', v_seance_m, v_seance_m), 'OK true');
  perform pg_temp.cas('emargement_signer : t_secr ne signe pas pour un stagiaire', 't_secr', '1',
    format($q$select public.emargement_signer(%s, %s, 'M10 10L20 20')::text$q$, v_seance_m, v_stag), 'ERREUR P0001 emargement: Tu ne peux signer que pour toi.');
  perform pg_temp.cas('emargement_signer : t_interv signe sur l''appareil du formateur', 't_interv', '1',
    format($q$select (public.emargement_signer(%s, %s, 'M10 10L20 20') is not null)::text$q$, v_seance_m, v_stag), 'OK true');
  perform pg_temp.cas('emargement_ouvrir : dir_n (direction fixe) ne tient pas la feuille', 'dir_n', '1',
    $q$select public.emargement_ouvrir('matin', '08:30', '12:00')::text$q$, v_refus_form);
  perform pg_temp.cas('emargement_feuille(..., formateur) : dir_n refusé', 'dir_n', '1',
    format('select (public.emargement_feuille(%s, true)).id::text', v_seance_m), v_refus_form);
  perform pg_temp.cas('emargement_signer : dir_n ne signe pas comme formateur', 'dir_n', '1',
    format($q$select public.emargement_signer(%s, %s, 'M10 10L20 20')::text$q$, v_seance_m, v_stag), 'ERREUR P0001 emargement: Tu ne peux signer que pour toi.');

  -- Stagiaires : la case Stagiaires en Modifier, sur la promo ou sur le centre (stagiaires.gerer).
  perform pg_temp.cas('set_date_naissance : t_secr (Stagiaires : Modifier du centre) peut', 't_secr', '1',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag), 'OK');
  perform pg_temp.cas('set_date_naissance : t_interv (Stagiaires : Voir) refusé (la phrase ne change pas)', 't_interv', '1',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag), v_refus_naiss);
  perform pg_temp.cas('set_date_naissance : t_rh refusé', 't_rh', '1',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag), v_refus_naiss);
  perform pg_temp.cas('set_date_naissance : dir_n (Stagiaires : Modifier du centre) peut', 'dir_n', '1',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag), 'OK');
  perform pg_temp.cas('set_date_naissance : form_n refusé sur un stagiaire d''une autre promo', 'form_n', '1',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag_m), 'ERREUR P0001 Non autorise : ce stagiaire n''appartient pas a la promo affichee');
  perform pg_temp.cas_apercu('set_date_naissance : le fondateur en aperçu stagiaire sur une promo sans sa fiche est refusé (le trou d''avant)', 'fond', '2', 'stagiaire',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag_m), v_refus_naiss);
  perform pg_temp.cas_apercu('set_date_naissance : le fondateur en aperçu formateur sur la promo 2 peut', 'fond', '2', 'formateur',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag_m), 'OK');
  perform pg_temp.cas_apercu('purger_benevoles(ids) : le fondateur en aperçu formateur passe la garde', 'fond', '1', 'formateur',
    'select public.purger_benevoles(array[-1])::text', 'OK 0');
  perform pg_temp.cas_apercu('purger_benevoles(ids) : le fondateur en aperçu direction refusé (fonction de formateur seul)', 'fond', '1', 'direction',
    'select public.purger_benevoles(array[-1])::text', v_refus_admin);
  perform pg_temp.cas_apercu('emargement_ouvrir : le fondateur en aperçu direction refusé', 'fond', '1', 'direction',
    $q$select public.emargement_ouvrir('matin', '08:30', '12:00')::text$q$, v_refus_form);
  perform pg_temp.cas('set_date_naissance : stag_n pour lui-même', 'stag_n', '1',
    format('select public.set_date_naissance(%s, date ''2000-01-02'')::text', v_stag), 'OK');
  perform pg_temp.cas('a_une_affectation : t_secr (peut gérer les stagiaires) : un compte sans affectation reste faux', 't_secr', '1',
    format('select public.a_une_affectation(%L)::text', v_stag_email), 'OK false');
  perform pg_temp.cas('a_une_affectation : t_interv (ne gère pas) : toujours vrai', 't_interv', '1',
    format('select public.a_une_affectation(%L)::text', v_stag_email), 'OK true');
  perform pg_temp.cas('a_une_affectation : form_n faux', 'form_n', '1', format('select public.a_une_affectation(%L)::text', v_stag_email), 'OK false');
  perform pg_temp.cas('inviter_compte (stagiaire) : t_interv refusé (la phrase ne change pas)', 't_interv', '1',
    format($q$select (public.inviter_compte('preuve7.fn.invite.a@exemple.invalid', 'stagiaire', %s))->>'role'$q$, v_fiche),
    'ERREUR 42501 invitation: Pas de droit sur la promo de ce stagiaire.');
  perform pg_temp.cas('inviter_compte (stagiaire) : t_rh refusé', 't_rh', '1',
    format($q$select (public.inviter_compte('preuve7.fn.invite.a@exemple.invalid', 'stagiaire', %s))->>'role'$q$, v_fiche),
    'ERREUR 42501 invitation: Pas de droit sur la promo de ce stagiaire.');
  perform pg_temp.cas('inviter_compte (stagiaire) : t_secr (Stagiaires : Modifier du centre) invite', 't_secr', '1',
    format($q$select (public.inviter_compte('preuve7.fn.invite.a@exemple.invalid', 'stagiaire', %s))->>'role'$q$, v_fiche), 'OK stagiaire');

  -- Effacements : les gestes définitifs restent aux titres fixes (anonymiser, benevoles.purger, donnees.purger).
  perform pg_temp.cas('anonymiser_stagiaire : t_secr refusé (la phrase ne change pas)', 't_secr', '1',
    format('select public.anonymiser_stagiaire(%s)::text', v_stag), v_refus_admin);
  perform pg_temp.cas('anonymiser_stagiaire : t_interv refusé', 't_interv', '1', format('select public.anonymiser_stagiaire(%s)::text', v_stag), v_refus_admin);
  perform pg_temp.cas('anonymiser_stagiaire : form_n passe la garde (le stagiaire est encore actif)', 'form_n', '1',
    format('select public.anonymiser_stagiaire(%s)::text', v_stag), 'ERREUR P0001 Marquez d''abord ce stagiaire en abandon');
  perform pg_temp.cas('anonymiser_stagiaire : dir_n passe la garde', 'dir_n', '1',
    format('select public.anonymiser_stagiaire(%s)::text', v_stag), 'ERREUR P0001 Marquez d''abord ce stagiaire en abandon');
  perform pg_temp.cas('anonymiser_promo() : t_secr refusé', 't_secr', '990701', 'select public.anonymiser_promo()::text', v_refus_admin);
  perform pg_temp.cas('anonymiser_promo() : dir_n passe la garde (promo sans date de fin)', 'dir_n', '990701', 'select public.anonymiser_promo()::text',
    'ERREUR P0001 Date de fin de promo non renseignée');
  perform pg_temp.cas('etat_anonymisation_promo() : t_interv refusé', 't_interv', '1', 'select (public.etat_anonymisation_promo())->>''promo_id''', v_refus_admin);
  perform pg_temp.cas('etat_anonymisation_promo() : form_n obtient l''état de la promo 1', 'form_n', '1', 'select (public.etat_anonymisation_promo())->>''promo_id''', 'OK 1');
  perform pg_temp.cas('etat_anonymisation_promo() : dir_n obtient l''état de la promo A', 'dir_n', '990701', 'select (public.etat_anonymisation_promo())->>''promo_id''', 'OK 990701');
  perform pg_temp.cas('anonymiser_promo(p) : t_secr refusé (la phrase ne change pas)', 't_secr', '1', 'select public.anonymiser_promo(990701)::text', v_refus_promo);
  perform pg_temp.cas('anonymiser_promo(p) : t_interv refusé sur sa propre promo', 't_interv', '1', 'select public.anonymiser_promo(1)::text', v_refus_promo);
  perform pg_temp.cas('anonymiser_promo(p) : dir_n passe la garde', 'dir_n', '1', 'select public.anonymiser_promo(990701)::text', 'ERREUR P0001 Date de fin de promo non renseignée');
  perform pg_temp.cas('etat_anonymisation_promo(p) : t_secr refusé', 't_secr', '1', 'select (public.etat_anonymisation_promo(990701))->>''promo_id''', v_refus_promo);
  perform pg_temp.cas('etat_anonymisation_promo(p) : t_rh refusé', 't_rh', '1', 'select (public.etat_anonymisation_promo(990701))->>''promo_id''', v_refus_promo);
  perform pg_temp.cas('etat_anonymisation_promo(p) : dir_n obtient l''état', 'dir_n', '1', 'select (public.etat_anonymisation_promo(990701))->>''promo_id''', 'OK 990701');
  perform pg_temp.cas('etat_anonymisation_promo(p) : form_n obtient l''état de sa promo', 'form_n', '1', 'select (public.etat_anonymisation_promo(1))->>''promo_id''', 'OK 1');

  -- Élèves bénévoles : lire (benevoles.lire), purger (benevoles.purger du formateur ; donnees.purger de la direction).
  perform pg_temp.cas('venues_benevoles : t_interv (Stagiaires : Voir) lit les venues', 't_interv', '1',
    $q$select count(*)::text from public.venues_benevoles() where sujet = 'preuve7 venue'$q$, 'OK 1');
  perform pg_temp.cas('venues_benevoles : t_secr (case du centre seulement) n''en lit aucune', 't_secr', '1',
    $q$select count(*)::text from public.venues_benevoles() where sujet = 'preuve7 venue'$q$, 'OK 0');
  perform pg_temp.cas('venues_benevoles : t_rh n''en lit aucune', 't_rh', '1',
    $q$select count(*)::text from public.venues_benevoles() where sujet = 'preuve7 venue'$q$, 'OK 0');
  perform pg_temp.cas('venues_benevoles : dir_n (direction fixe) les lit', 'dir_n', '1',
    $q$select count(*)::text from public.venues_benevoles() where sujet = 'preuve7 venue'$q$, 'OK 1');
  perform pg_temp.cas('venues_benevoles : form_n les lit', 'form_n', '1',
    $q$select count(*)::text from public.venues_benevoles() where sujet = 'preuve7 venue'$q$, 'OK 1');
  perform pg_temp.cas('benevoles_a_purger() : t_interv n''en voit aucun', 't_interv', '1',
    format('select count(*)::text from public.benevoles_a_purger() where id = %s', v_b1), 'OK 0');
  perform pg_temp.cas('benevoles_a_purger() : dir_n (pas formateur) n''en voit aucun', 'dir_n', '1',
    format('select count(*)::text from public.benevoles_a_purger() where id = %s', v_b1), 'OK 0');
  perform pg_temp.cas('benevoles_a_purger() : form_n voit le bénévole sans venue depuis deux ans', 'form_n', '1',
    format('select count(*)::text from public.benevoles_a_purger() where id = %s', v_b1), 'OK 1');
  perform pg_temp.cas('purger_benevoles(ids) : t_secr refusé (la phrase ne change pas)', 't_secr', '1',
    format('select public.purger_benevoles(array[%s])::text', v_b1), v_refus_admin);
  perform pg_temp.cas('purger_benevoles(ids) : t_interv refusé', 't_interv', '1', format('select public.purger_benevoles(array[%s])::text', v_b1), v_refus_admin);
  perform pg_temp.cas('purger_benevoles(ids) : form_n purge le bénévole', 'form_n', '1', format('select public.purger_benevoles(array[%s])::text', v_b1), 'OK 1');
  perform pg_temp.cas('benevoles_a_purger(centre) : t_secr refusé (la phrase ne change pas)', 't_secr', '1',
    format('select count(*)::text from public.benevoles_a_purger(%s) where id = %s', v_l1, v_b2), 'ERREUR 42501 Réservé à la direction du centre');
  perform pg_temp.cas('benevoles_a_purger(centre) : t_promos refusé', 't_promos', '1',
    format('select count(*)::text from public.benevoles_a_purger(%s) where id = %s', v_l1, v_b2), 'ERREUR 42501 Réservé à la direction du centre');
  perform pg_temp.cas('benevoles_a_purger(centre) : dir_n voit le bénévole', 'dir_n', '1',
    format('select count(*)::text from public.benevoles_a_purger(%s) where id = %s', v_l1, v_b2), 'OK 1');
  perform pg_temp.cas('purger_benevoles(ids, centre) : t_secr refusé', 't_secr', '1',
    format('select public.purger_benevoles(array[%s], %s)::text', v_b2, v_l1), 'ERREUR 42501 Réservé à la direction du centre');
  perform pg_temp.cas('purger_benevoles(ids, centre) : form_n refusé', 'form_n', '1',
    format('select public.purger_benevoles(array[%s], %s)::text', v_b2, v_l1), 'ERREUR 42501 Réservé à la direction du centre');
  perform pg_temp.cas('purger_benevoles(ids, centre) : dir_n purge', 'dir_n', '1', format('select public.purger_benevoles(array[%s], %s)::text', v_b2, v_l1), 'OK 1');

  -- Notes : la case Notes et examens (notes.lire). t_notes (Notes : Voir) lit ; t_interv et t_secr non.
  perform pg_temp.cas('notes_stagiaires_visibles : t_notes voit le stagiaire aux notes anonymes', 't_notes', '1',
    format('select count(*)::text from public.notes_stagiaires_visibles() v where v = %s', v_stag), 'OK 1');
  perform pg_temp.cas('notes_stagiaires_visibles : t_interv ne le voit pas', 't_interv', '1',
    format('select count(*)::text from public.notes_stagiaires_visibles() v where v = %s', v_stag), 'OK 0');
  perform pg_temp.cas('notes_stagiaires_visibles : t_secr ne le voit pas', 't_secr', '1',
    format('select count(*)::text from public.notes_stagiaires_visibles() v where v = %s', v_stag), 'OK 0');
  perform pg_temp.cas('notes_stagiaires_visibles : form_n le voit', 'form_n', '1',
    format('select count(*)::text from public.notes_stagiaires_visibles() v where v = %s', v_stag), 'OK 1');
  perform pg_temp.cas('notes_stagiaires_visibles : dir_n le voit', 'dir_n', '1',
    format('select count(*)::text from public.notes_stagiaires_visibles() v where v = %s', v_stag), 'OK 1');
  perform pg_temp.cas('epcf_moyennes : t_notes obtient un critère à un seul effectif', 't_notes', '1',
    $q$select count(*)::text from public.epcf_moyennes('salle') where critere = 'preuve7_critere'$q$, 'OK 1');
  perform pg_temp.cas('epcf_moyennes : t_interv n''en obtient aucun (effectif sous 3)', 't_interv', '1',
    $q$select count(*)::text from public.epcf_moyennes('salle') where critere = 'preuve7_critere'$q$, 'OK 0');
  perform pg_temp.cas('epcf_moyennes : t_secr n''en obtient aucun', 't_secr', '1',
    $q$select count(*)::text from public.epcf_moyennes('salle') where critere = 'preuve7_critere'$q$, 'OK 0');
  perform pg_temp.cas('epcf_moyennes : form_n en obtient un', 'form_n', '1',
    $q$select count(*)::text from public.epcf_moyennes('salle') where critere = 'preuve7_critere'$q$, 'OK 1');
  perform pg_temp.cas('epcf_moyennes : dir_n en obtient un', 'dir_n', '1',
    $q$select count(*)::text from public.epcf_moyennes('salle') where critere = 'preuve7_critere'$q$, 'OK 1');
  perform pg_temp.cas('notes_stats_groupe : t_notes obtient les chiffres', 't_notes', '1', 'select (public.notes_stats_groupe() is null)::text', 'OK false');
  perform pg_temp.cas('notes_stats_groupe : t_interv obtient nul (garde ajoutée)', 't_interv', '1', 'select (public.notes_stats_groupe() is null)::text', 'OK true');
  perform pg_temp.cas('notes_stats_groupe : t_secr obtient nul', 't_secr', '1', 'select (public.notes_stats_groupe() is null)::text', 'OK true');
  perform pg_temp.cas('notes_stats_groupe : t_cours obtient nul', 't_cours', '1', 'select (public.notes_stats_groupe() is null)::text', 'OK true');
  perform pg_temp.cas('notes_stats_groupe : form_n obtient les chiffres', 'form_n', '1', 'select (public.notes_stats_groupe() is null)::text', 'OK false');
  perform pg_temp.cas('notes_stats_groupe : dir_n obtient les chiffres', 'dir_n', '1', 'select (public.notes_stats_groupe() is null)::text', 'OK false');
  perform pg_temp.cas('notes_stats_groupe : stag_n, membre de la promo, obtient les chiffres', 'stag_n', '1', 'select (public.notes_stats_groupe() is null)::text', 'OK false');
  perform pg_temp.cas('notes_stats_groupe : le siège sans promo affichée obtient nul', 'siege', null, 'select (public.notes_stats_groupe() is null)::text', 'OK true');

  -- Équipe : l'invitation d'un formateur et l'affectation aux promos restent à la direction fixe (formateurs.nommer).
  perform pg_temp.cas('inviter_compte (formateur) : t_secr refusé (la phrase ne change pas)', 't_secr', '1',
    $q$select (public.inviter_compte('preuve7.fn.invite.f@exemple.invalid', 'formateur'))->>'role'$q$, 'ERREUR 42501 invitation: Réservé à la direction du centre.');
  perform pg_temp.cas('inviter_compte (formateur) : t_promos refusé', 't_promos', '1',
    $q$select (public.inviter_compte('preuve7.fn.invite.f@exemple.invalid', 'formateur'))->>'role'$q$, 'ERREUR 42501 invitation: Réservé à la direction du centre.');
  perform pg_temp.cas('inviter_compte (formateur) : form_n refusé', 'form_n', '1',
    $q$select (public.inviter_compte('preuve7.fn.invite.f@exemple.invalid', 'formateur'))->>'role'$q$, 'ERREUR 42501 invitation: Réservé à la direction du centre.');
  perform pg_temp.cas('inviter_compte (formateur) : dir_n invite', 'dir_n', '1',
    $q$select (public.inviter_compte('preuve7.fn.invite.f@exemple.invalid', 'formateur'))->>'role'$q$, 'OK formateur');
  perform pg_temp.cas('regler_affectations_formateur : t_secr refusé (la phrase ne change pas)', 't_secr', '1',
    format($q$select (public.regler_affectations_formateur('preuve7.fn.reg@exemple.invalid', %s, array[1]))->>'email'$q$, v_l1), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.cas('regler_affectations_formateur : t_rh refusé', 't_rh', '1',
    format($q$select (public.regler_affectations_formateur('preuve7.fn.reg@exemple.invalid', %s, array[1]))->>'email'$q$, v_l1), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.cas('regler_affectations_formateur : dir_n règle', 'dir_n', '1',
    format($q$select (public.regler_affectations_formateur('preuve7.fn.reg@exemple.invalid', %s, array[1]))->>'email'$q$, v_l1), 'OK preuve7.fn.reg@exemple.invalid');
  perform pg_temp.cas('inviter_compte (direction) : t_contenus refusé (la phrase ne change pas)', 't_contenus', null,
    format($q$select (public.inviter_compte('preuve7.fn.invite.d@exemple.invalid', 'direction', null, null, %s))->>'role'$q$, v_l1), 'ERREUR 42501 invitation: Réservé au siège.');
  perform pg_temp.cas('inviter_compte (direction) : t_reseau (Directions : Modifier) refusé, nommer est un geste du siège fixe', 't_reseau', null,
    format($q$select (public.inviter_compte('preuve7.fn.invite.d@exemple.invalid', 'direction', null, null, %s))->>'role'$q$, v_l1), 'ERREUR 42501 invitation: Réservé au siège.');
  perform pg_temp.cas('inviter_compte (direction) : dir_n refusé', 'dir_n', '1',
    format($q$select (public.inviter_compte('preuve7.fn.invite.d@exemple.invalid', 'direction', null, null, %s))->>'role'$q$, v_l1), 'ERREUR 42501 invitation: Réservé au siège.');
  perform pg_temp.cas('inviter_compte (direction) : le siège invite', 'siege', null,
    format($q$select (public.inviter_compte('preuve7.fn.invite.d@exemple.invalid', 'direction', null, null, %s))->>'role'$q$, v_l1), 'OK direction');
  perform pg_temp.cas('inviter_compte (siège) : le siège refusé, le fondateur seul (inchangé)', 'siege', null,
    $q$select (public.inviter_compte('preuve7.fn.invite.s@exemple.invalid', 'siege'))->>'role'$q$, 'ERREUR 42501 invitation: Réservé au fondateur.');

  -- Promos et réglages d'un centre : les cases Promos et Réglages du centre en Modifier (promos.gerer, reglages.modifier).
  perform pg_temp.cas('creer_promo : t_rh (Promos : Voir) refusé (la phrase ne change pas)', 't_rh', '1',
    format($q$select public.creer_promo(%s, 'Preuve7 fn promo', current_date, null)::text$q$, v_l1), 'ERREUR 42501 promo: Réservé à la direction du centre.');
  perform pg_temp.cas('creer_promo : t_secr (Promos : Voir) refusé', 't_secr', '1',
    format($q$select public.creer_promo(%s, 'Preuve7 fn promo', current_date, null)::text$q$, v_l1), 'ERREUR 42501 promo: Réservé à la direction du centre.');
  perform pg_temp.cas('creer_promo : t_promos (Promos : Modifier) crée', 't_promos', '1',
    format($q$select (public.creer_promo(%s, 'Preuve7 fn promo', current_date, null) > 0)::text$q$, v_l1), 'OK true');
  perform pg_temp.cas('creer_promo : dir_n crée', 'dir_n', '1',
    format($q$select (public.creer_promo(%s, 'Preuve7 fn promo bis', current_date, null) > 0)::text$q$, v_l1), 'OK true');
  perform pg_temp.cas('modifier_dates_promo : t_rh refusé', 't_rh', '1',
    $q$select public.modifier_dates_promo(990701, current_date - 20, current_date + 20)::text$q$, 'ERREUR 42501 promo: Réservé à la direction du centre.');
  perform pg_temp.cas('modifier_dates_promo : t_promos modifie', 't_promos', '1',
    $q$select public.modifier_dates_promo(990701, current_date - 20, current_date + 20)::text$q$, 'OK');
  perform pg_temp.cas('regler_habillage_centre : t_secr (Réglages : Non) refusé', 't_secr', '1',
    format('select (public.regler_habillage_centre(%s, ''ecf'', false))->>''habillage''', v_l1), 'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.cas('regler_habillage_centre : t_promos (Réglages : Modifier) règle', 't_promos', '1',
    format('select (public.regler_habillage_centre(%s, ''ecf'', false))->>''habillage''', v_l1), 'OK ecf');
  perform pg_temp.cas('regler_habillage_centre : dir_n règle', 'dir_n', '1',
    format('select (public.regler_habillage_centre(%s, ''ecsr'', false))->>''habillage''', v_l1), 'OK ecsr');

  -- Réseau : creer_centre (Directions : Modifier) et regler_habillage_reseau (Réglages : Modifier).
  perform pg_temp.cas('creer_centre : t_contenus (Cours seulement) refusé (la phrase ne change pas)', 't_contenus', null,
    $q$select public.creer_centre('Preuve7 fn centre a')::text$q$, 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.cas('creer_centre : dir_n refusé', 'dir_n', '1', $q$select public.creer_centre('Preuve7 fn centre a')::text$q$, 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.cas('creer_centre : t_reseau (Directions : Modifier) crée', 't_reseau', null,
    $q$select (public.creer_centre('Preuve7 fn centre a') > 0)::text$q$, 'OK true');
  perform pg_temp.cas('creer_centre : le siège crée', 'siege', null, $q$select (public.creer_centre('Preuve7 fn centre b') > 0)::text$q$, 'OK true');
  perform pg_temp.cas('regler_habillage_reseau : t_contenus refusé (la phrase ne change pas)', 't_contenus', null,
    $q$select (public.regler_habillage_reseau('ecf'))->>'habillage'$q$, 'ERREUR 42501 habillage: Réservé au siège.');
  perform pg_temp.cas('regler_habillage_reseau : t_reseau (Réglages : Modifier) règle', 't_reseau', null,
    $q$select (public.regler_habillage_reseau('ecf'))->>'habillage'$q$, 'OK ecf');
  perform pg_temp.cas('regler_habillage_reseau : le siège règle', 'siege', null, $q$select (public.regler_habillage_reseau('ecsr'))->>'habillage'$q$, 'OK ecsr');
end $tgf$;

-- Groupe cases (migration 3) : les règles passent par les gestes. Les lectures se comptent en lignes (le nombre attendu est celui du
-- propriétaire, jugé non nul pour que le contrôle ne passe jamais à vide), les écritures par leur refus (0 ligne ou 42501) ou par ce
-- qu'elles touchent. Titres fictifs des gestes : t_secr (centre : Promos Voir, Stagiaires Modifier, Émargement Voir, Équipe Voir),
-- t_interv (promo : Planning Voir, Émargement Modifier, Stagiaires Voir, Cours Voir), t_rh (centre : Promos Voir, Équipe Voir),
-- t_contenus (réseau : Cours Modifier).
create or replace function pg_temp.cas_lecture(p_libelle text, p_qui text, p_entete text, p_table text, p_ou text, p_tout boolean)
returns void language plpgsql as $tcl$
declare v_n text;
begin
  v_n := pg_temp.calcul(format('select count(*)::text from %s where %s', p_table, p_ou));
  if p_tout then
    perform pg_temp.verifier('cases', p_libelle || ' : lignes d''essai présentes (jamais un contrôle à vide)', v_n ~ '^[0-9]+$' and v_n::integer > 0, 'lignes du propriétaire : ' || coalesce(v_n, 'nul'));
    perform pg_temp.attendre('cases', p_libelle, pg_temp.appeler(p_qui, p_entete, format('select count(*)::text from %s where %s', p_table, p_ou)), 'OK ' || v_n);
  else
    perform pg_temp.verifier('cases', p_libelle || ' : lignes d''essai présentes (jamais un contrôle à vide)', v_n ~ '^[0-9]+$' and v_n::integer > 0, 'lignes du propriétaire : ' || coalesce(v_n, 'nul'));
    perform pg_temp.attendre('cases', p_libelle, pg_temp.appeler(p_qui, p_entete, format('select count(*)::text from %s where %s', p_table, p_ou)), 'OK 0');
  end if;
end $tcl$;

-- Une écriture qui doit être refusée : 0 ligne touchée ou état 42501.
create or replace function pg_temp.cas_refus(p_libelle text, p_qui text, p_entete text, p_sql text)
returns void language plpgsql as $tcr$
declare v_r text;
begin
  v_r := pg_temp.appeler(p_qui, p_entete, p_sql);
  perform pg_temp.verifier('cases', p_libelle, v_r = 'OK 0' or v_r like 'ERREUR 42501%', 'obtenu ' || v_r || ' ; attendu 0 ligne ou 42501');
end $tcr$;

create or replace function pg_temp.groupe_cases()
returns void language plpgsql as $tgc$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_s1 integer := (select min(id) from public.stagiaires where promo_id = 1);
  v_q integer := (select min(id) from public.qcm_questions);
  v_tout constant text := 'promo_id = 1';
begin
  -- Plus aucune règle (public et storage) ne cite un ancien prédicat de droit : joué aussi en production, où une règle absente des
  -- fichiers de migration resterait sinon ouverte à tout compte affecté, quel que soit son titre. Exceptions voulues, sans appel à ces
  -- prédicats : affectations_lecture, lieux_lecture et la clause « personnel » de user_profiles_lecture citent encore est_siege,
  -- est_formateur ou est_direction (plan § 1.3 : navigation, étiquettes, lecture du personnel).
  perform pg_temp.attendre('cases', 'aucune règle ne cite plus formateur_courant, equipe_courante, direction_courante, redacteur_contenus, is_admin ni is_prof',
    pg_temp.calcul($q$select coalesce(string_agg(schemaname || '.' || policyname, ',' order by schemaname || '.' || policyname collate "C"), 'aucune')
      from pg_policies where schemaname in ('public', 'storage')
       and coalesce(qual, '') || coalesce(with_check, '') ~ '(formateur_courant|equipe_courante|direction_courante|redacteur_contenus|is_admin|is_prof)\('$q$), 'aucune');
  perform pg_temp.attendre('cases', 'les seules règles qui citent encore est_siege, est_formateur ou est_direction sont les trois voulues par le plan',
    pg_temp.calcul($q$select coalesce(string_agg(schemaname || '.' || policyname, ',' order by schemaname || '.' || policyname collate "C"), 'aucune')
      from pg_policies where schemaname in ('public', 'storage')
       and coalesce(qual, '') || coalesce(with_check, '') ~ '(est_siege|est_formateur|est_direction)\('$q$),
    'public.affectations_lecture,public.lieux_lecture,public.user_profiles_lecture');
  -- Donnée d'essai posée en propriétaire : le cours du thème 57 repasse en brouillon (un cours de thème non publié).
  update public.cours set published = false where numero = 57;
  -- t_rh (Promos Voir, Équipe Voir) : « Non » ferme la lecture des données de la page.
  perform pg_temp.cas_lecture('t_rh ne lit aucune fiche de stagiaire', 't_rh', '1', 'public.stagiaires', v_tout, false);
  perform pg_temp.cas_lecture('t_rh ne lit aucune fiche privée', 't_rh', '1', 'public.stagiaires_prive', 'true', false);
  perform pg_temp.cas_lecture('t_rh ne lit aucun passage', 't_rh', '1', 'public.passages', v_tout, false);
  perform pg_temp.cas_lecture('t_rh ne lit aucune note', 't_rh', '1', 'public.evaluations', v_tout, false);
  perform pg_temp.cas_lecture('t_rh ne lit aucune ligne d''émargement', 't_rh', '1', 'public.emargement_lignes', v_tout, false);
  perform pg_temp.cas_lecture('t_rh ne lit pas le planning', 't_rh', '1', 'public.planning_entries', v_tout, false);
  perform pg_temp.cas_lecture('t_rh ne lit aucun profil de stagiaire (adresses fermées)', 't_rh', '1', 'public.user_profiles', 'stagiaire_id is not null', false);
  -- t_secr (Stagiaires Modifier, Émargement Voir, ni Planning ni Notes).
  perform pg_temp.cas_lecture('t_secr lit les fiches de stagiaires', 't_secr', '1', 'public.stagiaires', v_tout, true);
  perform pg_temp.cas_lecture('t_secr lit les passages', 't_secr', '1', 'public.passages', v_tout, true);
  perform pg_temp.cas_lecture('t_secr ne lit aucune note', 't_secr', '1', 'public.evaluations', v_tout, false);
  perform pg_temp.cas_lecture('t_secr ne lit pas le planning', 't_secr', '1', 'public.planning_entries', v_tout, false);
  perform pg_temp.cas_lecture('t_secr ne lit aucun bénévole', 't_secr', '1', 'public.benevoles', format('lieu_id = %s', v_l1), false);
  perform pg_temp.cas_refus('t_secr ne supprime aucune fiche (geste définitif)', 't_secr', '1',
    'with d as (delete from public.stagiaires where promo_id = 1 returning 1) select count(*)::text from d');
  perform pg_temp.attendre('cases', 't_secr modifie les fiches de stagiaires (Stagiaires Modifier au centre)',
    pg_temp.appeler('t_secr', '1', 'with u as (update public.stagiaires set ordre = ordre where promo_id = 1 returning 1) select (count(*) > 0)::text from u'), 'OK true');
  -- t_interv (Planning Voir, Émargement Modifier, Stagiaires Voir, Cours Voir).
  perform pg_temp.cas_lecture('t_interv lit le planning', 't_interv', '1', 'public.planning_entries', v_tout, true);
  perform pg_temp.cas_refus('t_interv n''ajoute pas au planning (Voir ferme l''écriture)', 't_interv', '1',
    'with i as (insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, promo_id) values (''2031-02-03'', 0, ''matin'', 9, 1) returning 1) select count(*)::text from i');
  perform pg_temp.cas_refus('t_interv ne modifie pas le planning', 't_interv', '1',
    'with u as (update public.planning_entries set slot = slot where promo_id = 1 returning 1) select count(*)::text from u');
  perform pg_temp.cas_lecture('t_interv lit les lignes d''émargement', 't_interv', '1', 'public.emargement_lignes', v_tout, true);
  perform pg_temp.cas_lecture('t_interv lit les fiches de stagiaires', 't_interv', '1', 'public.stagiaires', v_tout, true);
  perform pg_temp.cas_lecture('t_interv ne lit aucune note', 't_interv', '1', 'public.evaluations', v_tout, false);
  perform pg_temp.cas_refus('t_interv n''ajoute aucune note', 't_interv', '1',
    format('with i as (insert into public.evaluations (stagiaire_id, type, note, promo_id) values (%s, ''Thème'', 10, 1) returning 1) select count(*)::text from i', v_s1));
  perform pg_temp.cas_refus('t_interv ne modifie aucune fiche de stagiaire (Voir ferme l''écriture)', 't_interv', '1',
    'with u as (update public.stagiaires set ordre = ordre where promo_id = 1 returning 1) select count(*)::text from u');
  perform pg_temp.cas_refus('t_interv ne supprime aucune fiche (geste définitif)', 't_interv', '1',
    'with d as (delete from public.stagiaires where promo_id = 1 returning 1) select count(*)::text from d');
  perform pg_temp.cas_refus('t_interv ne supprime aucun bénévole (geste définitif)', 't_interv', '1',
    'with d as (delete from public.benevoles returning 1) select count(*)::text from d');
  perform pg_temp.cas_refus('t_interv n''écrit pas dans les formateurs (fiche interne)', 't_interv', '1',
    'with i as (insert into public.profs (nom) values (''Preuve7 formateur'') returning 1) select count(*)::text from i');
  perform pg_temp.cas_refus('t_interv n''écrit pas dans les contacts (fiche interne)', 't_interv', '1',
    'with i as (insert into public.contacts (prenom) values (''Preuve7 contact'') returning 1) select count(*)::text from i');
  perform pg_temp.cas_lecture('t_interv lit les cours de thème non publiés', 't_interv', '1', 'public.cours', 'numero = 57', true);
  perform pg_temp.cas_refus('t_interv ne modifie pas un cours de thème', 't_interv', '1',
    'with u as (update public.cours set corps_md = ''y'' where numero = 57 returning 1) select count(*)::text from u');
  -- t_contenus (réseau : Cours Modifier).
  perform pg_temp.attendre('cases', 't_contenus modifie une question de QCM', pg_temp.appeler('t_contenus', '1',
    format('with u as (update public.qcm_questions set ordre = ordre where id = %s returning 1) select count(*)::text from u', v_q)), 'OK 1');
  perform pg_temp.attendre('cases', 't_contenus modifie un cours de thème', pg_temp.appeler('t_contenus', '1',
    'with u as (update public.cours set corps_md = corps_md where numero = 57 returning 1) select count(*)::text from u'), 'OK 1');
  perform pg_temp.cas_refus('t_contenus n''écrit pas dans les QCM (référentiel)', 't_contenus', '1',
    'with u as (update public.qcm set titre = titre returning 1) select count(*)::text from u');
  perform pg_temp.cas_refus('t_contenus n''écrit pas dans les thèmes (référentiel)', 't_contenus', '1',
    'with u as (update public.themes set titre = titre returning 1) select count(*)::text from u');
  -- Un stagiaire de la promo 1 lit toujours le planning, les séances, la liste, les examens et la progression (membre de la promo).
  perform pg_temp.cas_lecture('stag_n lit le planning de sa promo', 'stag_n', '1', 'public.planning_entries', v_tout, true);
  perform pg_temp.cas_lecture('stag_n lit les séances d''émargement de sa promo', 'stag_n', '1', 'public.emargement_seances', v_tout, true);
  perform pg_temp.cas_lecture('stag_n lit la liste de sa promo', 'stag_n', '1', 'public.stagiaires', v_tout, true);
  perform pg_temp.cas_lecture('stag_n lit les examens de sa promo', 'stag_n', '1', 'public.qcm_examens', v_tout, true);
  perform pg_temp.cas_lecture('stag_n lit la progression des thèmes de sa promo', 'stag_n', '1', 'public.themes_progression', v_tout, true);
  perform pg_temp.cas_refus('stag_n n''écrit pas au planning', 'stag_n', '1',
    'with u as (update public.planning_entries set slot = slot where promo_id = 1 returning 1) select count(*)::text from u');
  -- Le cumul : fiche dans la promo 1 (membre) et formateur de la promo 2 ; la lecture par membre et la lecture par geste ne se masquent pas.
  perform pg_temp.cas_lecture('cumul lit le planning de la promo 1 (membre)', 'cumul', '1', 'public.planning_entries', v_tout, true);
  perform pg_temp.cas_lecture('cumul lit le planning de la promo 2 (formateur)', 'cumul', '2', 'public.planning_entries', 'promo_id = 2', true);
  -- Une direction qui forme (direction du centre de la promo 1, formateur de la promo 2).
  perform pg_temp.cas_lecture('dir_form lit les notes de la promo 1 (direction)', 'dir_form', '1', 'public.evaluations', v_tout, true);
  perform pg_temp.cas_lecture('dir_form lit les notes de la promo 2 (formateur)', 'dir_form', '2', 'public.evaluations', 'promo_id = 2', true);
end $tgc$;

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
  v_etat text; v_etat1 text; v_etat2 text; v_retour text; v_retour1 text;
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
  drop table if exists pg_temp.fn_av;
  create temp table fn_av as select p.oid::regprocedure::text as sig, md5(pg_get_functiondef(p.oid)) as h from pg_proc p where p.oid = any (pg_temp.fonctions_b());
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
  v_etat2 := v_etat;
  perform pg_temp.etape('migration 2', v_etat, v_mode);
  if v_en_ligne or v_etat <> 'jouée' then
    perform pg_temp.informer('fonctions : empreinte avant/après', 'non jugeable (migration 2 non injectée ou déjà appliquée)');
  else
    perform pg_temp.attendre('fonctions', 'après la migration 2 : les 29 fonctions ont une définition nouvelle (aucune n''est restée telle quelle)',
      (select count(*)::text || '/' || cardinality(pg_temp.fonctions_b())::text from pg_temp.fn_av a
         where md5(pg_get_functiondef(a.sig::regprocedure)) <> a.h), '29/29');
  end if;
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

  -- 8 quater. Groupe fonctions : les 29 fonctions de l'app (migration 2, partie B).
  perform pg_temp.groupe_fonctions();

  -- 8 quinquies. Groupe cases : les 93 règles passent par les gestes (migration 3).
  perform pg_temp.groupe_cases();

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
  if v_en_ligne or v_etat2 <> 'jouée' or v_retour <> 'jouée' then
    perform pg_temp.informer('fonctions : empreinte après le retour 2', 'non jugeable (migration 2 ou son retour non injectés, ou déjà appliquée)');
  else
    perform pg_temp.attendre('fonctions', 'après le retour 2 : chacune des 29 fonctions retrouve exactement son empreinte d''avant la migration',
      (select count(*)::text || '/' || cardinality(pg_temp.fonctions_b())::text from pg_temp.fn_av a
         where md5(pg_get_functiondef(a.sig::regprocedure)) = a.h), '29/29');
  end if;
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
