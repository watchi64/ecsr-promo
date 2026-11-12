-- Aides communes des preuves du chantier « titres et droits à la carte » (étape 1 : tests/sql/titres-preuve.sql ; étape 2 : tests/sql/titres-gestion-preuve.sql).
-- Fonctions pg_temp sans groupe de contrôles : jouer une migration, un ordre en propriétaire, créer un titre ou une affectation, juger
-- des cases, appeler une fonction en tant que personnage, poser les personnages de l'étape 1 et rendre le verdict. Chaque fonction
-- garde le corps qu'elle avait dans titres-preuve.sql.
-- INCLUSION : l'assembleur (outils/assembler_repetition_roles.mjs) colle ce fichier tel quel, après tests/sql/roles-aides.sql ; il ne
-- porte donc aucun marqueur d'assemblage. Ne se joue pas seul.

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
    return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 300);
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
