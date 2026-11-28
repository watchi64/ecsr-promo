-- Aides du chantier « cloisonnement par organisme » (spec docs/superpowers/specs/2026-11-27-cloisonnement-organismes-design.md,
-- § 5.6) : l'organisme B fictif et ses personnages, les personnages d'ECF, et les appels joués par un personnage. Réutilisées par
-- toutes les tâches du chantier (preuve tests/sql/cloisonnement-preuve.sql).
-- INCLUSION : l'assembleur (outils/assembler_repetition_roles.mjs) colle ce fichier tel quel, après tests/sql/roles-aides.sql et
-- tests/sql/titres-aides.sql ; il ne porte donc aucun marqueur d'assemblage. Ne se joue pas seul.
-- Rien de ce qui sort d'ici ne porte d'adresse : les détails rendent des identifiants, des états SQL et des messages de refus.
-- Les objets de B sont posés en propriétaire, avec leur organisme_id écrit en clair (le siège de B ne peut pas se trouver un
-- organisme avant d'avoir son affectation). Tant qu'une unicité de nom globale existe (lieux.nom, titres_portee_nom, profs.nom),
-- le centre, le titre réseau et la fiche profs de B prennent un nom distinct de celui d'ECF ; les mêmes noms se prouvent quand
-- l'unicité devient propre à l'organisme (tâche 4, groupe noms ; tâche 5 pour profs).
-- Sans la migration (contre-épreuve), tout ce qui demande organismes ou organisme_id échoue en silence : les contrôles qui en
-- dépendent sont rouges, aucun ne passe à vide.

drop table if exists pg_temp.clo_perso;
create temp table clo_perso (nom text primary key, email text, org text not null, promo text, role text not null);
drop table if exists pg_temp.clo_obj;
create temp table clo_obj (cle text primary key, valeur text);

-- Un objet posé (identifiant en texte, ou « incalculable (...) » si sa pose a échoué).
create or replace function pg_temp.clo(p_cle text)
returns text language sql as $cc$
  select (select valeur from pg_temp.clo_obj where cle = p_cle);
$cc$;

-- Une unicité de nom globale sur une table de public : un index unique qui porte nom (ou lower(nom)) sans organisme_id.
create or replace function pg_temp.nom_unique_global(p_table text)
returns boolean language sql as $cng$
  select exists (select 1 from pg_index i
                  where i.indrelid = to_regclass('public.' || p_table) and i.indisunique
                    and substring(pg_get_indexdef(i.indexrelid) from ' USING .*$') ~ '\mnom\M'
                    and pg_get_indexdef(i.indexrelid) !~ 'organisme_id');
$cng$;

-- Une colonne organisme_id présente sur une table (la migration 1 l'ajoute ; la contre-épreuve ne l'a pas).
create or replace function pg_temp.a_organisme(p_table text)
returns boolean language sql as $cao$
  select exists (select 1 from pg_attribute a
                  where a.attrelid = to_regclass('public.' || p_table) and a.attname = 'organisme_id' and not a.attisdropped);
$cao$;

-- Les personnages et l'organisme B. ECF : siège, direction (centre de la promo 1), formateur et stagiaire (promo 1), et le
-- fondateur réel (le premier compte is_founder dont l'adresse n'est pas fictive : c'est lui que la migration rattache). B : « Organisme B fictif » (non rédacteur),
-- un centre, une promo (992801) en cours, deux stagiaires, un siège, une direction, un formateur, un titre réseau, une fiche
-- d'annuaire (posée d'office par l'affectation de la direction), une fiche profs, un signalement de QCM, une carte Ressources.
-- clo_perso.promo est l'en-tête x-promo-id du personnage (nul : sans en-tête).
create or replace function pg_temp.poser_cloisonnement()
returns void language plpgsql as $cpc$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_promo_b constant integer := 992801;
  v_org_a text; v_org_b text; v_lieu_b text; v_x text; v_nom text; v_s_a integer; v_s1 text; v_s2 text;
begin
  perform pg_temp.proprio();
  delete from pg_temp.clo_perso;
  delete from pg_temp.clo_obj;
  insert into pg_temp.clo_perso (nom, email, org, promo, role) values
    ('siege_a', 'preuve.clo.siege.a@exemple.invalid', 'A', null, 'siege'),
    ('dir_a', 'preuve.clo.dir.a@exemple.invalid', 'A', '1', 'direction'),
    ('form_a', 'preuve.clo.form.a@exemple.invalid', 'A', '1', 'formateur'),
    ('stag_a', 'preuve.clo.stag.a@exemple.invalid', 'A', '1', 'stagiaire'),
    ('fond_a', (select lower(up.email) from public.user_profiles up where up.is_founder
                 order by lower(up.email) like '%@exemple.invalid', lower(up.email) limit 1), 'A', null, 'fondateur'),
    ('siege_b', 'preuve.clo.siege.b@exemple.invalid', 'B', null, 'siege'),
    ('dir_b', 'preuve.clo.dir.b@exemple.invalid', 'B', v_promo_b::text, 'direction'),
    ('form_b', 'preuve.clo.form.b@exemple.invalid', 'B', v_promo_b::text, 'formateur'),
    ('stag_b1', 'preuve.clo.stag.b1@exemple.invalid', 'B', v_promo_b::text, 'stagiaire'),
    ('stag_b2', 'preuve.clo.stag.b2@exemple.invalid', 'B', v_promo_b::text, 'stagiaire');

  -- ECF : personnages fictifs (le fondateur est le compte réel, déjà là).
  v_org_a := pg_temp.calcul($q$select id::text from public.organismes where nom = 'ECF BOUSCAREN'$q$);
  insert into pg_temp.clo_obj values ('org_a', v_org_a), ('lieu_a', v_l1::text), ('promo_a', '1'), ('promo_b', v_promo_b::text);
  insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve clo A', 'PREUVE', 990, 1) returning id into v_s_a;
  insert into public.user_profiles (email, role, is_admin, stagiaire_id)
    select p.email, case when p.role = 'stagiaire' then 'stagiaire' else 'prof' end, p.role = 'formateur',
           case when p.nom = 'stag_a' then v_s_a end
      from pg_temp.clo_perso p where p.org = 'A' and p.nom <> 'fond_a';
  insert into public.affectations (email, role, promo_id, lieu_id) values
    ('preuve.clo.form.a@exemple.invalid', 'formateur', 1, null),
    ('preuve.clo.dir.a@exemple.invalid', 'direction', null, v_l1);
  if pg_temp.a_organisme('affectations') and v_org_a ~ '^[0-9]+$' then
    perform pg_temp.essai(format('insert into public.affectations (email, role, organisme_id) values (%L, ''siege'', %s)',
      'preuve.clo.siege.a@exemple.invalid', v_org_a));
  else
    insert into public.affectations (email, role) values ('preuve.clo.siege.a@exemple.invalid', 'siege');
  end if;

  -- B : l'organisme, puis tout ce qui s'y rattache (organisme_id écrit en clair).
  v_org_b := pg_temp.calcul($q$insert into public.organismes (nom, redacteur, habillage) values ('Organisme B fictif', false, 'ecsr') returning id::text$q$);
  insert into pg_temp.clo_obj values ('org_b', v_org_b);
  v_nom := (select l.nom from public.lieux l where l.id = v_l1);
  if pg_temp.nom_unique_global('lieux') then v_nom := v_nom || ' (organisme B)'; end if;
  v_lieu_b := case when v_org_b ~ '^[0-9]+$'
    then pg_temp.calcul(format('insert into public.lieux (nom, organisme_id) values (%L, %s) returning id::text', v_nom, v_org_b))
    else 'non posé (organisme B absent)' end;
  insert into pg_temp.clo_obj values ('lieu_b', v_lieu_b);
  if v_lieu_b ~ '^[0-9]+$' then
    insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values (v_promo_b, v_lieu_b::integer, 'Preuve clo promo B', current_date - 20, null);
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve clo B1', 'PREUVE', 990, v_promo_b) returning id::text into v_s1;
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve clo B2', 'PREUVE', 991, v_promo_b) returning id::text into v_s2;
  end if;
  insert into pg_temp.clo_obj values ('stag_b1', v_s1), ('stag_b2', v_s2);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id)
    select p.email, case when p.role = 'stagiaire' then 'stagiaire' else 'prof' end, p.role = 'formateur',
           case p.nom when 'stag_b1' then v_s1::integer when 'stag_b2' then v_s2::integer end
      from pg_temp.clo_perso p where p.org = 'B';
  if v_org_b ~ '^[0-9]+$' then
    perform pg_temp.essai(format('insert into public.affectations (email, role, organisme_id) values (%L, ''siege'', %s)',
      'preuve.clo.siege.b@exemple.invalid', v_org_b));
  end if;
  if v_lieu_b ~ '^[0-9]+$' then
    insert into public.affectations (email, role, promo_id, lieu_id) values
      ('preuve.clo.dir.b@exemple.invalid', 'direction', null, v_lieu_b::integer),
      ('preuve.clo.form.b@exemple.invalid', 'formateur', v_promo_b, null);
  end if;
  insert into pg_temp.clo_obj values ('fiche_b',
    (select c.id::text from public.contacts c where c.compte_email = 'preuve.clo.dir.b@exemple.invalid'));

  -- Titre réseau, fiche profs, signalement et carte de B : au nom d'un objet d'ECF quand l'unicité le permet.
  v_nom := (select t.nom from public.titres t where t.niveau = 'reseau' and not t.fixe order by t.id limit 1);
  if v_nom is null or pg_temp.nom_unique_global('titres') then v_nom := coalesce(v_nom, 'Preuve clo titre') || ' (organisme B)'; end if;
  insert into pg_temp.clo_obj values ('titre_b', case when v_org_b ~ '^[0-9]+$' then pg_temp.calcul(format(
    'insert into public.titres (nom, niveau, lieu_id, cases, cree_par, organisme_id) values (%L, ''reseau'', null, ''{}'', ''preuve'', %s) returning id::text',
    v_nom, v_org_b)) else 'non posé (organisme B absent)' end);
  v_nom := (select p.nom from public.profs p order by p.id limit 1);
  if v_nom is null or pg_temp.nom_unique_global('profs') then v_nom := coalesce(v_nom, 'Preuve clo') || ' (organisme B)'; end if;
  insert into pg_temp.clo_obj values ('prof_b', case when v_org_b ~ '^[0-9]+$' then pg_temp.calcul(format(
    'insert into public.profs (nom, ordre, organisme_id) values (%L, 990, %s) returning id::text', v_nom, v_org_b))
    else 'non posé (organisme B absent)' end);
  insert into pg_temp.clo_obj values ('sig_b', case when v_org_b ~ '^[0-9]+$' and v_s1 is not null then pg_temp.calcul(format(
    'insert into public.qcm_signalements (question_id, email, stagiaire_id, motif, commentaire, organisme_id) values ((select min(q.id) from public.qcm_questions q), %L, %s, ''autre'', ''Preuve clo signalement B'', %s) returning id::text',
    'preuve.clo.stag.b1@exemple.invalid', v_s1, v_org_b)) else 'non posé (organisme B absent)' end);
  insert into pg_temp.clo_obj values ('res_b', case when v_org_b ~ '^[0-9]+$' then pg_temp.calcul(format(
    'insert into public.ressources (titre, url, categorie, organisme_id) values (''Preuve clo carte B'', ''https://exemple.invalid/b'', ''docs'', %s) returning id::text',
    v_org_b)) else 'non posé (organisme B absent)' end);
end $cpc$;

-- L'organisme attendu d'un personnage : celui d'ECF (A) ou de B, en texte.
create or replace function pg_temp.clo_org(p_nom text)
returns text language sql as $cog$
  select case p.org when 'A' then pg_temp.clo('org_a') else pg_temp.clo('org_b') end from pg_temp.clo_perso p where p.nom = p_nom;
$cog$;

-- Une lecture jouée par un personnage (jeton, en-tête de sa promo ; aperçu facultatif) : « OK <valeur> » ou « ERREUR <état> <message> ».
-- p_proprio : jouée par le propriétaire avec le contexte du personnage (fonctions internes, tables sans droit). p_nom nul : le
-- propriétaire sans contexte.
create or replace function pg_temp.clo_lire(p_nom text, p_sql text, p_proprio boolean default false, p_apercu text default null)
returns text language plpgsql as $cl$
declare v text; r text; v_email text; v_promo text;
begin
  select p.email, p.promo into v_email, v_promo from pg_temp.clo_perso p where p.nom = p_nom;
  if p_nom is null then
    perform pg_temp.proprio();
  elsif p_proprio then
    perform pg_temp.contexte(v_email, v_promo, p_apercu);
  else
    perform pg_temp.incarner(v_email, v_promo, p_apercu);
  end if;
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $cl$;

-- Une écriture jouée par un personnage, de la même façon (rien n'est annulé : la preuve annule tout à la fin) : « OK <lignes> »
-- ou « ERREUR <état> <message> ».
create or replace function pg_temp.clo_ecrire(p_nom text, p_sql text, p_proprio boolean default false)
returns text language plpgsql as $ce$
declare n bigint; r text; v_email text; v_promo text;
begin
  select p.email, p.promo into v_email, v_promo from pg_temp.clo_perso p where p.nom = p_nom;
  if p_nom is null then
    perform pg_temp.proprio();
  elsif p_proprio then
    perform pg_temp.contexte(v_email, v_promo, null);
  else
    perform pg_temp.incarner(v_email, v_promo, null);
  end if;
  begin
    execute p_sql;
    get diagnostics n = row_count;
    r := 'OK ' || n;
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $ce$;
