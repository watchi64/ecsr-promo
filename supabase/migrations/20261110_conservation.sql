-- Conservation des données à 3 ans (Qualiopi, lot Q5), partie fiches et émargement (tâche 2 du plan
-- docs/superpowers/plans/2026-11-09-qualiopi-q5-conservation.md ; spec docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md,
-- § 6, § 6.1, § 10). Les tâches 3 (questionnaires) et 4 (registre qualité) complètent ce fichier.
-- Retour : 20261110_conservation_retour.sql. Preuve : tests/sql/conservation-preuve.sql (schéma minimal :
-- tests/sql/conservation-schema-minimal.sql). NON APPLIQUÉE : attend l'accord de Timy.
--
-- Avant ce lot, _anonymiser_stagiaire faisait tout d'un coup, 12 mois après la fin de la promo, et passait la fiche en
-- abandon (actif = false). Ce lot la remplace par deux étapes datées et un effacement sur demande :
--   - Étape 1 (à partir de date_fin + 12 mois) : compte, e-mails, date de naissance, fiche de suivi, textes libres,
--     observations de l'émargement et e-mails de la personne sur l'émargement. Le nom, les résultats, le dossier
--     professionnel, le livret et les tracés des signatures restent. Marque : stagiaires.efface_le.
--   - Étape 2 (à partir du 1er janvier de l'année date_fin + 4, soit après le 31/12 de la 3e année) : l'étape 1 si elle
--     manque, puis dossier professionnel, livret, tracés des signatures, nom (prénom « Anonyme <id> », nom nul). Marque :
--     stagiaires.anonymise_le, qui garde son sens (plus aucun nom). Pour les feuilles d'émargement de la promo : les
--     formateurs deviennent « Formateur 1 », « Formateur 2 »… par feuille dans l'ordre de leur signature, sans fiche
--     formateur ni tracé ; les e-mails des feuilles (ouverture, clôture, signataires, mises à jour) deviennent « anonyme ».
--     L'heure, la présence et le total d'heures restent : une ligne dont le tracé est effacé reste signée (signe_le).
--   - Sur demande de la personne : les deux étapes tout de suite, sans condition de date ni d'abandon. La demande se lit au
--     journal (type « demande », cible « stagiaire <id> »), jamais dans une colonne de stagiaires que toute la promo lit.
-- Aucune étape n'écrit actif : l'abandon reste une décision de l'équipe. Aucun effacement ne part tout seul : chaque
-- fonction est un clic du fondateur, rejouable (un second appel ne change rien et n'écrit rien au journal). Une fiche
-- reliée à un compte d'équipe (affectation, is_admin, is_founder) n'est jamais effacée : les étapes de promo la sautent
-- et la comptent, l'effacement sur demande la refuse.
-- Droits : chaque fonction appelable exige peut_gerer_qualite() (le fondateur réel, hors aperçu, lot Q3) ET l'accès à
-- la promo (peut_acceder_promo), pour que l'élargissement du lot 5 à la direction ne laisse pas un centre effacer un
-- autre ; etat_conservation() ne liste que les promos accessibles. Les deux fonctions internes n'ont aucun droit
-- d'appel pour les rôles de l'API. Le jour est celui de Paris (_questionnaire_jour(), lot Q3).
-- Émargement : sa protection (déclencheur emargement_signature_figee) se lève par set_config('emargement.effacement',
-- 'on', true), remis à vide juste après chaque écriture. Une fiche sans nom ne signe plus, n'est plus annotée et ne
-- reçoit plus d'absence à la clôture.
-- Les anciennes fonctions anonymiser_promo, anonymiser_stagiaire, etat_anonymisation_promo et _anonymiser_stagiaire sont
-- supprimées (le retour les recrée). Une fiche déjà anonymisée par l'ancien bouton reçoit efface_le = anonymise_le.
-- Refus en « conservation: <phrase> », la phrase étant montrée telle quelle par l'app.
set local lock_timeout = '3s';

-- 1. Marques et contraintes ----------------------------------------------------------------------------------------
alter table public.stagiaires add column efface_le timestamptz;
update public.stagiaires set efface_le = anonymise_le where anonymise_le is not null and efface_le is null;
alter table public.stagiaires
  add constraint stagiaires_efface_avant_anonyme check (anonymise_le is null or efface_le is not null);

-- Émargement : un tracé effacé laisse l'heure et le signataire (« anonyme »), et dit quand il a été effacé.
alter table public.emargement_lignes add column signature_effacee_le timestamptz;
alter table public.emargement_lignes drop constraint emargement_lignes_check;
alter table public.emargement_lignes add constraint emargement_lignes_signature check (
  (signe_le is null) = (signe_par is null)
  and case when signature_effacee_le is null then (trace is null) = (signe_le is null)
           else trace is null and signe_le is not null end);
alter table public.emargement_formateurs add column signature_effacee_le timestamptz;
alter table public.emargement_formateurs alter column trace drop not null;
alter table public.emargement_formateurs add constraint emargement_formateurs_signature
  check ((trace is null) = (signature_effacee_le is not null));

-- Journal : types des étapes de ce lot (questionnaires : tâche 3 ; registre : tâche 4).
alter table public.effacements_journal drop constraint effacements_journal_type_check;
alter table public.effacements_journal add constraint effacements_journal_type_check
  check (type in ('stagiaire', 'promo', 'benevoles', 'etape1', 'etape2', 'demande', 'questionnaires', 'registre'));

-- 2. Anciennes fonctions supprimées --------------------------------------------------------------------------------
drop function public.anonymiser_promo();
drop function public.anonymiser_stagiaire(integer);
drop function public.etat_anonymisation_promo();
drop function public._anonymiser_stagiaire(integer);

-- 3. Étape 1 d'une fiche (interne) ---------------------------------------------------------------------------------
-- Ce que faisait _anonymiser_stagiaire, SAUF le dossier professionnel, le livret, le nom et actif ; EN PLUS : observations
-- de l'émargement de la fiche, e-mails de la personne sur l'émargement. Les participations aux questionnaires partent
-- avec le compte (clé étrangère en cascade, lot Q3). Rejouée : { deja: true }.
create function public._effacer_etape1(p_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare
  s record;
  v_emails text[];
  v_noms text[];          -- formes sous lesquelles la personne apparaît dans les champs « qui »
  v_remplace constant text := 'Stagiaire anonyme';
  v_n jsonb := '{}'::jsonb;
  n integer;
  x text;
begin
  select * into s from stagiaires where id = p_id for update;
  if not found then raise exception 'conservation: Fiche introuvable.'; end if;
  if s.efface_le is not null then return jsonb_build_object('deja', true); end if;

  if exists (select 1 from user_profiles u where u.stagiaire_id = p_id
                and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
    raise exception 'conservation: Cette fiche est reliée à un compte d''équipe : elle n''est jamais effacée.';
  end if;

  select coalesce(array_agg(distinct lower(email)), '{}') into v_emails
    from user_profiles where stagiaire_id = p_id;
  -- Nom affiché dans l'app (« V. Timy », cf. displayStagiaire) et e-mails (repli de getProfileWho).
  v_noms := array[case when coalesce(trim(s.nom), '') <> ''
                       then upper(left(trim(s.nom), 1)) || '. ' || s.prenom else s.prenom end]
            || v_emails;

  -- Données privées : supprimées (le dossier professionnel et le livret restent jusqu'à l'étape 2).
  delete from stagiaires_prive where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('date_naissance', n);
  delete from fiches_suivi where stagiaire_id = p_id;     get diagnostics n = row_count; v_n := v_n || jsonb_build_object('fiche_suivi', n);

  -- Résultats conservés, textes libres vidés (ils peuvent contenir un prénom, une santé…).
  -- (epcf_evaluations.contexte n'est pas un texte libre : c'est un code, « EPCF ».)
  update epcf_evaluations set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('epcf_textes', n);
  update evaluations set observation = null where stagiaire_id = p_id and observation is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('observations', n);
  update passages set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('commentaires_passages', n);

  -- Émargement : observations de la fiche ; e-mails de la personne (elle a signé ou été notée sous son adresse).
  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set observation = null where stagiaire_id = p_id and observation is not null;
  get diagnostics n = row_count;
  perform set_config('emargement.effacement', '', true);
  v_n := v_n || jsonb_build_object('emargement_observations', n);
  if cardinality(v_emails) > 0 then
    perform set_config('emargement.effacement', 'on', true);
    update emargement_lignes set signe_par = 'anonyme' where lower(signe_par) = any(v_emails);
    perform set_config('emargement.effacement', '', true);
    perform set_config('emargement.effacement', 'on', true);
    update emargement_lignes set maj_par = 'anonyme' where lower(maj_par) = any(v_emails);
    perform set_config('emargement.effacement', '', true);
  end if;

  -- E-mails de la personne, partout où ils servent de signature.
  if cardinality(v_emails) > 0 then
    update evaluations set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update evaluations set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update evaluations_audit set changed_by_email = 'anonyme' where lower(changed_by_email) = any(v_emails);
    update agenda_events set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update qcm_signalements set email = 'anonyme' where lower(email) = any(v_emails);
    update themes set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update themes_progression set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update user_profiles set invited_by_email = 'anonyme' where lower(invited_by_email) = any(v_emails);
    delete from conditions_acceptations where lower(email) = any(v_emails);
  end if;

  -- Champs « qui a fait la modification » (nom affiché ou e-mail).
  update passages set created_by_who = v_remplace where created_by_who = any(v_noms);
  update passages set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update passages_audit set changed_by_who = v_remplace where changed_by_who = any(v_noms);
  update epcf_evaluations set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update planning_jours_off set created_by_who = v_remplace where created_by_who = any(v_noms);

  -- Historiques : les mêmes valeurs dans les instantanés JSON (valeurs exactes entre guillemets).
  foreach x in array v_noms loop
    update passages_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
    update evaluations_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
  end loop;

  -- Les historiques gardent une copie des lignes : on y vide aussi les textes libres.
  update evaluations_audit
     set before_data = case when before_data ? 'observation' then jsonb_set(before_data, '{observation}', 'null') else before_data end,
         after_data  = case when after_data  ? 'observation' then jsonb_set(after_data,  '{observation}', 'null') else after_data end
   where (before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id;
  update passages_audit
     set before_data = case when before_data ? 'commentaire' then jsonb_set(before_data, '{commentaire}', 'null') else before_data end,
         after_data  = case when after_data  ? 'commentaire' then jsonb_set(after_data,  '{commentaire}', 'null') else after_data end
   where (before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id;

  -- Compte : profil puis compte de connexion (sessions, compteur de l'assistant et participations aux questionnaires
  -- en cascade).
  delete from user_profiles where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('profils', n);
  if cardinality(v_emails) > 0 then
    delete from auth.users where lower(email) = any(v_emails); get diagnostics n = row_count;
    v_n := v_n || jsonb_build_object('comptes', n);
  end if;

  -- Ni le nom ni actif : la marque seule (date_naissance, déjà vide sur la fiche, est gardée vide).
  update stagiaires set date_naissance = null, efface_le = now() where id = p_id;

  return v_n;
end;
$function$;

-- 4. Étape 2 d'une fiche (interne) ---------------------------------------------------------------------------------
-- L'étape 1 si elle manque (fondateur en retard : pas de refus), puis dossier professionnel, livret, tracés des
-- signatures de la fiche (heure gardée, signataire « anonyme »), nom. Rejouée : { deja: true }.
create function public._effacer_etape2(p_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  s record;
  v_n jsonb := '{}'::jsonb;
  n integer;
begin
  select * into s from stagiaires where id = p_id for update;
  if not found then raise exception 'conservation: Fiche introuvable.'; end if;
  if s.anonymise_le is not null then return jsonb_build_object('deja', true); end if;

  if exists (select 1 from user_profiles u where u.stagiaire_id = p_id
                and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
    raise exception 'conservation: Cette fiche est reliée à un compte d''équipe : elle n''est jamais effacée.';
  end if;

  if s.efface_le is null then
    v_n := _effacer_etape1(p_id);
  end if;

  delete from dp_dossiers where stagiaire_id = p_id;  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('dossier_pro', n);
  delete from epcf_livrets where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('livret', n);

  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set trace = null, signe_par = 'anonyme', signature_effacee_le = now()
   where stagiaire_id = p_id and trace is not null;
  get diagnostics n = row_count;
  perform set_config('emargement.effacement', '', true);
  v_n := v_n || jsonb_build_object('signatures', n);

  update stagiaires set prenom = 'Anonyme ' || p_id, nom = null, anonymise_le = now() where id = p_id;

  return v_n;
end;
$function$;

revoke all on function public._effacer_etape1(integer), public._effacer_etape2(integer)
  from public, anon, authenticated, service_role;

-- 5. État de la conservation (page Qualiopi) -----------------------------------------------------------------------
-- { jour, promos: [{ id, nom, lieu_nom, date_fin, etape1_du, etape2_du, a_effacer_etape1, a_effacer_etape2,
-- comptes_equipe, emargement_etape2 }], portees_formateurs: [] (tâche 3), registre: null (tâche 4) }. Les promos
-- accessibles seulement ; les nombres « à effacer » ne comptent jamais les comptes d'équipe. emargement_etape2 : les
-- signatures de formateurs et les tracés de fiches déjà sans nom qui restent à effacer à l'étape 2.
create function public.etat_conservation()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_jour date := _questionnaire_jour();
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  return jsonb_build_object(
    'jour', v_jour,
    'promos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'nom', pr.nom,
               'lieu_nom', l.nom,
               'date_fin', pr.date_fin,
               'etape1_du', (pr.date_fin + interval '12 months')::date,
               'etape2_du', make_date(extract(year from pr.date_fin)::integer + 4, 1, 1),
               'a_effacer_etape1', c.etape1,
               'a_effacer_etape2', c.etape2,
               'comptes_equipe', c.equipe,
               'emargement_etape2', c.emargement) order by pr.id)
        from promos pr
        join lieux l on l.id = pr.lieu_id
        cross join lateral (
          select count(*) filter (where s.efface_le is null and not e.equipe) as etape1,
                 count(*) filter (where s.anonymise_le is null and not e.equipe) as etape2,
                 count(*) filter (where s.anonymise_le is null and e.equipe) as equipe,
                 (select count(*) from emargement_formateurs f
                   where f.promo_id = pr.id and f.signature_effacee_le is null)
                 + (select count(*) from emargement_lignes el join stagiaires sa on sa.id = el.stagiaire_id
                     where el.promo_id = pr.id and el.trace is not null and sa.anonymise_le is not null) as emargement
            from stagiaires s
            cross join lateral (
              select exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                               and (u.is_admin or u.is_founder
                                    or exists (select 1 from affectations a where lower(a.email) = lower(u.email))))
                     as equipe) e
           where s.promo_id = pr.id) c
       where peut_acceder_promo(pr.id)), '[]'::jsonb),
    'portees_formateurs', '[]'::jsonb,
    'registre', null);
end;
$function$;

-- 6. Étape 1 d'une promo -------------------------------------------------------------------------------------------
create function public.effacer_promo_etape1(p_promo integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  p record;
  s record;
  v_du date;
  v jsonb;
  v_somme jsonb := '{}'::jsonb;
  v_faits integer := 0;
  v_equipe integer := 0;
  k text;
  x jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_promo is null or not peut_acceder_promo(p_promo) then
    raise exception 'conservation: Cette promo n''est pas dans ton périmètre.';
  end if;
  -- Deux appels simultanés sur la même promo passent l'un après l'autre.
  select * into p from promos where id = p_promo for no key update;
  if p.date_fin is null then
    raise exception 'conservation: Renseigne d''abord la date de fin de cette promo.';
  end if;
  v_du := (p.date_fin + interval '12 months')::date;
  if _questionnaire_jour() < v_du then
    raise exception 'conservation: Possible à partir du %.', to_char(v_du, 'DD/MM/YYYY');
  end if;
  for s in select id from stagiaires where promo_id = p.id and efface_le is null order by id loop
    if exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                  and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
      v_equipe := v_equipe + 1;
      continue;
    end if;
    v := _effacer_etape1(s.id);
    if coalesce((v ->> 'deja')::boolean, false) then continue; end if;
    v_faits := v_faits + 1;
    for k, x in select e.key, e.value from jsonb_each(v) e loop
      v_somme := v_somme || jsonb_build_object(k, coalesce((v_somme ->> k)::integer, 0) + x::text::integer);
    end loop;
  end loop;
  v := jsonb_build_object('fiches', v_faits, 'comptes_equipe', v_equipe) || v_somme;
  if v_faits > 0 then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('etape1', 'promo ' || p.id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;

-- 7. Étape 2 d'une promo -------------------------------------------------------------------------------------------
create function public.effacer_promo_etape2(p_promo integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  p record;
  s record;
  v_du date;
  v jsonb;
  v_somme jsonb := '{}'::jsonb;
  v_faits integer := 0;
  v_equipe integer := 0;
  v_formateurs integer;
  v_traces integer;
  v_emails integer := 0;
  n integer;
  k text;
  x jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_promo is null or not peut_acceder_promo(p_promo) then
    raise exception 'conservation: Cette promo n''est pas dans ton périmètre.';
  end if;
  select * into p from promos where id = p_promo for no key update;
  if p.date_fin is null then
    raise exception 'conservation: Renseigne d''abord la date de fin de cette promo.';
  end if;
  v_du := make_date(extract(year from p.date_fin)::integer + 4, 1, 1);
  if _questionnaire_jour() < v_du then
    raise exception 'conservation: Possible à partir du %.', to_char(v_du, 'DD/MM/YYYY');
  end if;

  -- Fiches : étape 2 (l'étape 1 d'abord quand elle manque).
  for s in select id from stagiaires where promo_id = p.id and anonymise_le is null order by id loop
    if exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                  and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
      v_equipe := v_equipe + 1;
      continue;
    end if;
    v := _effacer_etape2(s.id);
    if coalesce((v ->> 'deja')::boolean, false) then continue; end if;
    v_faits := v_faits + 1;
    for k, x in select e.key, e.value from jsonb_each(v) e loop
      v_somme := v_somme || jsonb_build_object(k, coalesce((v_somme ->> k)::integer, 0) + x::text::integer);
    end loop;
  end loop;

  -- Feuilles de la promo. Formateurs : un nom provisoire d'abord (l'index unique sur le nom par feuille interdirait
  -- deux « Formateur 1 » le temps de l'écriture), puis « Formateur n » dans l'ordre des signatures.
  perform set_config('emargement.effacement', 'on', true);
  update emargement_formateurs set nom = '#' || id
   where promo_id = p.id and signature_effacee_le is null;
  get diagnostics v_formateurs = row_count;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_formateurs f
     set nom = 'Formateur ' || r.rang, prof_id = null, trace = null, signe_par = 'anonyme', signature_effacee_le = now()
    from (select id, row_number() over (partition by seance_id order by signe_le, id) as rang
            from emargement_formateurs where promo_id = p.id) r
   where f.id = r.id and f.signature_effacee_le is null;
  perform set_config('emargement.effacement', '', true);
  -- Tracés des fiches déjà sans nom (anonymisées avant ce lot, ou dont les lignes sont sur une feuille de cette promo).
  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes l set trace = null, signe_par = 'anonyme', signature_effacee_le = now()
    from stagiaires sa
   where sa.id = l.stagiaire_id and l.promo_id = p.id and l.trace is not null and sa.anonymise_le is not null;
  get diagnostics v_traces = row_count;
  perform set_config('emargement.effacement', '', true);
  -- E-mails des feuilles (formateurs qui ont ouvert, clos, signé sur leur appareil ou mis à jour).
  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set signe_par = 'anonyme' where promo_id = p.id and signe_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set maj_par = 'anonyme' where promo_id = p.id and maj_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_seances set ouverte_par = 'anonyme' where promo_id = p.id and ouverte_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_seances set close_par = 'anonyme' where promo_id = p.id and close_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);

  v := jsonb_build_object('fiches', v_faits, 'comptes_equipe', v_equipe) || v_somme
       || jsonb_build_object('signatures', coalesce((v_somme ->> 'signatures')::integer, 0) + v_traces,
                             'signatures_formateurs', v_formateurs, 'emargement_emails', v_emails);
  if v_faits + v_formateurs + v_traces + v_emails > 0 then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('etape2', 'promo ' || p.id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;

-- 8. Effacement sur demande de la personne -------------------------------------------------------------------------
-- Les deux étapes tout de suite, sans condition de date ni d'abandon (actif n'est pas touché).
create function public.effacer_sur_demande(p_stagiaire_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_promo integer;
  v jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  select promo_id into v_promo from stagiaires where id = p_stagiaire_id;
  if not found then
    raise exception 'conservation: Fiche introuvable.';
  end if;
  if not peut_acceder_promo(v_promo) then
    raise exception 'conservation: Cette fiche n''est pas dans ton périmètre.';
  end if;
  v := _effacer_etape2(p_stagiaire_id);
  if not coalesce((v ->> 'deja')::boolean, false) then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('demande', 'stagiaire ' || p_stagiaire_id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;

revoke all on function public.etat_conservation(), public.effacer_promo_etape1(integer),
  public.effacer_promo_etape2(integer), public.effacer_sur_demande(integer) from public, anon, authenticated, service_role;
grant execute on function public.etat_conservation(), public.effacer_promo_etape1(integer),
  public.effacer_promo_etape2(integer), public.effacer_sur_demande(integer) to authenticated, service_role;

-- 9. Émargement : une fiche sans nom ne signe plus, n'est plus annotée, ne reçoit plus d'absence ------------------
-- create or replace : droits d'exécution du 23/10 gardés. emargement_signer : version du lot 4 (formateur_courant),
-- emargement_annoter et emargement_clore : versions du 23/10 ; seule la condition sur la fiche change.
CREATE OR REPLACE FUNCTION public.emargement_signer(p_seance bigint, p_stagiaire integer, p_trace text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, false);
  v_appareil boolean;
  v_quand timestamptz;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: La feuille est close.';
  end if;
  if s.jour <> emargement_jour_paris() then
    raise exception 'emargement: Une feuille ne se signe que le jour même.';
  end if;
  if p_stagiaire is not null and p_stagiaire = my_stagiaire_id() then
    v_appareil := false;
  elsif formateur_courant() then
    v_appareil := true;
  else
    raise exception 'emargement: Tu ne peux signer que pour toi.';
  end if;
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id and actif
                    and anonymise_le is null) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if not emargement_trace_valide(p_trace) then
    raise exception 'emargement: Signature illisible, recommence.';
  end if;
  if exists (select 1 from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire and absent) then
    raise exception 'emargement: Noté absent : un formateur doit d''abord retirer l''absence.';
  end if;
  insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par,
                                 sur_appareil_formateur, maj_par)
  values (s.id, s.promo_id, p_stagiaire, p_trace, now(), v_email, v_appareil, v_email)
  on conflict (seance_id, stagiaire_id) do update
    set trace = excluded.trace, signe_le = excluded.signe_le, signe_par = excluded.signe_par,
        sur_appareil_formateur = excluded.sur_appareil_formateur, maj_le = now(), maj_par = excluded.maj_par
    where emargement_lignes.trace is null and not emargement_lignes.absent
  returning signe_le into v_quand;
  if v_quand is null then
    raise exception 'emargement: Déjà signé.';
  end if;
  return v_quand;
end;
$function$;

CREATE OR REPLACE FUNCTION public.emargement_annoter(p_seance bigint, p_stagiaire integer, p_absent boolean, p_observation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  l emargement_lignes;
  v_obs text := nullif(btrim(p_observation), '');
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id and anonymise_le is null) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if length(v_obs) > 200 then
    raise exception 'emargement: Observation trop longue (200 caractères au plus).';
  end if;
  select * into l from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire for update;
  if p_absent is not null then
    if s.statut <> 'ouverte' then
      raise exception 'emargement: La feuille est close : rouvre-la pour changer une absence.';
    end if;
    if p_absent and l.trace is not null then
      raise exception 'emargement: Déjà signé : ajoute plutôt une observation.';
    end if;
  end if;
  if l.id is null then
    if p_absent is not true and v_obs is null then
      return;  -- rien à noter
    end if;
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, observation, maj_par)
    values (s.id, s.promo_id, p_stagiaire, coalesce(p_absent, false),
            case when p_absent then 'formateur' end, v_obs, v_email);
    return;
  end if;
  update emargement_lignes
     set absent = coalesce(p_absent, absent),
         absence_origine = case when p_absent is null then absence_origine
                                when p_absent then 'formateur' end,
         observation = case when p_observation is null then observation else v_obs end,
         maj_le = now(), maj_par = v_email
   where id = l.id;
  delete from emargement_lignes
   where id = l.id and trace is null and not absent and observation is null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.emargement_clore(p_seance bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  v_jour_index integer;
  v_n integer;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: Cette feuille est déjà close.';
  end if;
  if not exists (select 1 from emargement_formateurs where seance_id = s.id) then
    raise exception 'emargement: Il manque la signature du formateur.';
  end if;
  v_jour_index := extract(isodow from s.jour)::integer - 1;
  with planning as (
    select distinct case when (a ->> 'sid') ~ '^[0-9]{1,9}$' then (a ->> 'sid')::integer end as sid
      from planning_entries pe
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(pe.absences) = 'array' then pe.absences else '[]'::jsonb end) a
     where pe.promo_id = s.promo_id
       and pe.semaine_lundi = s.jour - v_jour_index
       and pe.day_index = v_jour_index
       and pe.half_day = s.demi_journee
  ), absents as (
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, maj_par)
    select s.id, s.promo_id, st.id, true,
           case when st.id in (select sid from planning where sid is not null) then 'planning' else 'non_signe' end,
           v_email
      from stagiaires st
     where st.promo_id = s.promo_id and st.actif and st.anonymise_le is null
    on conflict (seance_id, stagiaire_id) do update
      set absent = true, absence_origine = excluded.absence_origine, maj_le = now(), maj_par = excluded.maj_par
      where emargement_lignes.trace is null and not emargement_lignes.absent
    returning 1
  )
  select count(*) into v_n from absents;
  update emargement_seances set statut = 'close', close_le = now(), close_par = v_email where id = s.id;
  return v_n;
end;
$function$;
