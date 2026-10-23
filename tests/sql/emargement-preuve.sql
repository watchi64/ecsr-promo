-- Preuve de l'émargement (spec docs/superpowers/specs/2026-10-23-emargement-design.md).
-- Rejouable : tout se passe dans une transaction que le bloc final annule TOUJOURS en levant une
-- exception, qui porte le verdict (« VERT n/0 » ou « ROUGE » et la liste des échecs).
-- Personnages choisis par requête : aucun email réel n'est écrit ici (dépôt public).
--   F : formateur admin (role prof) ; A, B : stagiaires avec compte d'une même promo P ;
--   C : un autre stagiaire actif de P (avec ou sans compte) ; O : stagiaire d'une autre promo Q.
-- Les séances sont ouvertes par les fonctions serveur, donc le jour même (heure de Paris).

begin;
set local lock_timeout = '3s';

create temp table preuve (num serial, libelle text, etat text, detail text) on commit drop;

create function pg_temp.verifier(p_libelle text, p_ok boolean, p_detail text default '')
returns void language sql as $f$
  insert into preuve (libelle, etat, detail)
  values (p_libelle, case when coalesce(p_ok, false) then 'ok' else 'échec' end, coalesce(p_detail, ''));
$f$;

create function pg_temp.incarner(p_email text, p_promo integer)
returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_email is null then '' else json_build_object('email', p_email, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_promo is null then '' else json_build_object('x-promo-id', p_promo::text)::text end, true);
  if p_email is null then set local role anon; else set local role authenticated; end if;
end $f$;

-- Retour au propriétaire, sans identité.
create function pg_temp.proprio()
returns void language plpgsql as $f$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
end $f$;

-- Instruction jouée par un personnage. Une réussite est GARDÉE (la suite du scénario en dépend) ;
-- un échec est annulé (sous-transaction). Rend « OK <valeur> » ou « REFUS <code> <message> ».
create function pg_temp.essai(p_email text, p_promo integer, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  begin
    perform pg_temp.incarner(p_email, p_promo);
    execute p_sql into v;
    perform pg_temp.proprio();
    return 'OK ' || coalesce(v, '');
  exception when others then
    perform pg_temp.proprio();
    return 'REFUS ' || sqlstate || ' ' || sqlerrm;
  end;
end $f$;

-- Nombre de lignes vues par un personnage (-1 si la lecture échoue).
create function pg_temp.compter(p_email text, p_promo integer, p_sql text)
returns bigint language plpgsql as $f$
declare n bigint;
begin
  begin
    perform pg_temp.incarner(p_email, p_promo);
    execute p_sql into n;
    perform pg_temp.proprio();
    return n;
  exception when others then
    perform pg_temp.proprio();
    return -1;
  end;
end $f$;

do $preuve$
declare
  f text; a text; b text; o text;
  a_sid int; b_sid int; c_sid int; inactif_sid int;
  p int; q int;
  s1 bigint; s2 bigint;
  r text; n bigint; v_ok int; v_ko int; v_liste text;
  v_effacement boolean := false; v_message text := '';
  t_ok constant text := 'M10 80L60 40L120 90L180 30L240 100L300 50L360 70';
  aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  demi text;
begin
  -- 0. Les tables existent.
  perform pg_temp.verifier('tables émargement présentes',
    to_regclass('public.emargement_seances') is not null and to_regclass('public.emargement_lignes') is not null
    and to_regclass('public.emargement_formateurs') is not null);
  if to_regclass('public.emargement_seances') is null then
    raise exception using message = 'ROUGE : migration absente (tables émargement introuvables)';
  end if;

  -- Personnages.
  select up.email into f from user_profiles up where up.is_admin and up.role = 'prof' order by up.email limit 1;
  select s.promo_id into p from user_profiles up join stagiaires s on s.id = up.stagiaire_id
    where up.role = 'stagiaire' and not up.is_admin and s.actif
    group by s.promo_id having count(*) >= 2 order by s.promo_id limit 1;
  select up.email, s.id into a, a_sid from user_profiles up join stagiaires s on s.id = up.stagiaire_id
    where s.promo_id = p and up.role = 'stagiaire' and not up.is_admin and s.actif order by s.id limit 1;
  select up.email, s.id into b, b_sid from user_profiles up join stagiaires s on s.id = up.stagiaire_id
    where s.promo_id = p and up.role = 'stagiaire' and not up.is_admin and s.actif and s.id <> a_sid order by s.id limit 1;
  select s.id into c_sid from stagiaires s where s.promo_id = p and s.actif and s.id not in (a_sid, b_sid) order by s.id limit 1;
  select s.id into inactif_sid from stagiaires s where s.promo_id = p and not s.actif order by s.id limit 1;
  select pr.id into q from promos pr where pr.id <> p order by pr.id limit 1;
  select up.email into o from user_profiles up join stagiaires s on s.id = up.stagiaire_id
    where s.promo_id = q and up.role = 'stagiaire' and not up.is_admin order by s.id limit 1;
  perform pg_temp.verifier('personnages trouvés (F, A, B, C, P, Q)',
    f is not null and a is not null and b is not null and c_sid is not null and p is not null and q is not null,
    format('promo %s, autre promo %s', p, q));
  -- Une demi-journée du jour encore sans feuille dans P (en prod, ne jamais toucher une vraie feuille).
  select d into demi from unnest(array['matin', 'aprem']) d
    where not exists (select 1 from emargement_seances s where s.promo_id = p and s.jour = aujourdhui and s.demi_journee = d)
    order by d desc limit 1;
  if demi is null then
    raise exception using message = 'REPORTÉ : les deux demi-journées du jour ont déjà une feuille dans la promo ' || p;
  end if;

  -- 1. Droits de table : aucune écriture directe, rien pour le visiteur.
  perform pg_temp.verifier('authenticated : ni insert, ni update, ni delete sur les trois tables',
    not (has_table_privilege('authenticated', 'public.emargement_seances', 'INSERT')
      or has_table_privilege('authenticated', 'public.emargement_seances', 'UPDATE')
      or has_table_privilege('authenticated', 'public.emargement_seances', 'DELETE')
      or has_table_privilege('authenticated', 'public.emargement_lignes', 'INSERT')
      or has_table_privilege('authenticated', 'public.emargement_lignes', 'UPDATE')
      or has_table_privilege('authenticated', 'public.emargement_lignes', 'DELETE')
      or has_table_privilege('authenticated', 'public.emargement_formateurs', 'INSERT')
      or has_table_privilege('authenticated', 'public.emargement_formateurs', 'UPDATE')
      or has_table_privilege('authenticated', 'public.emargement_formateurs', 'DELETE')));
  perform pg_temp.verifier('anon : aucune lecture des trois tables',
    not (has_table_privilege('anon', 'public.emargement_seances', 'SELECT')
      or has_table_privilege('anon', 'public.emargement_lignes', 'SELECT')
      or has_table_privilege('anon', 'public.emargement_formateurs', 'SELECT')));
  perform pg_temp.verifier('anon : aucune fonction d''émargement exécutable',
    not (has_function_privilege('anon', 'public.emargement_ouvrir(text,text,text)', 'EXECUTE')
      or has_function_privilege('anon', 'public.emargement_signer(bigint,integer,text)', 'EXECUTE')
      or has_function_privilege('anon', 'public.emargement_clore(bigint)', 'EXECUTE')));
  r := pg_temp.essai(a, p, format('insert into public.emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par) values (%s, %L, %L, %L, %L, %L) returning id', p, aujourdhui, demi, '09:00', '12:30', a));
  perform pg_temp.verifier('stagiaire : insertion directe d''une séance refusée', r like 'REFUS 42501%', r);

  -- 2. Ouverture.
  r := pg_temp.essai(a, p, format('select public.emargement_ouvrir(%L, %L, %L)::text', demi, '09:00', '12:30'));
  perform pg_temp.verifier('stagiaire : ouverture refusée', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_ouvrir(%L, %L, %L)::text', demi, '12:30', '09:00'));
  perform pg_temp.verifier('formateur : horaires à l''envers refusés', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_ouvrir(%L, %L, %L)::text', 'soir', '09:00', '12:30'));
  perform pg_temp.verifier('formateur : demi-journée inconnue refusée', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_ouvrir(%L, %L, %L)::text', demi, '09:00', '12:30'));
  perform pg_temp.verifier('formateur : ouverture du jour', r ~ '^OK [0-9]+$', r);
  s1 := nullif(substring(r from '^OK ([0-9]+)$'), '')::bigint;
  r := pg_temp.essai(f, p, format('select public.emargement_ouvrir(%L, %L, %L)::text', demi, '09:00', '12:30'));
  perform pg_temp.verifier('formateur : seconde ouverture rend la même séance', r = 'OK ' || s1, r);
  perform pg_temp.verifier('séance ouverte le jour même, dans la promo P',
    exists (select 1 from emargement_seances where id = s1 and promo_id = p and jour = aujourdhui and statut = 'ouverte'));

  -- 3. Signatures de stagiaires.
  r := pg_temp.essai(a, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, b_sid, t_ok));
  perform pg_temp.verifier('stagiaire : signer pour un autre refusé', r like 'REFUS P0001%', r);
  r := pg_temp.essai(a, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, a_sid, 'M1 1<script>'));
  perform pg_temp.verifier('stagiaire : tracé invalide refusé', r like 'REFUS P0001%', r);
  r := pg_temp.essai(a, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, a_sid, 'M1 1' || repeat('L2 2', 5000)));
  perform pg_temp.verifier('stagiaire : tracé trop long refusé', r like 'REFUS P0001%', r);
  r := pg_temp.essai(a, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, a_sid, t_ok));
  perform pg_temp.verifier('stagiaire : signe pour lui-même', r like 'OK 2%', r);
  r := pg_temp.essai(a, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, a_sid, 'M5 5L300 100'));
  perform pg_temp.verifier('stagiaire : seconde signature refusée', r like 'REFUS P0001%sign%', r);
  perform pg_temp.verifier('signature de A : horodatée, par son compte, tracé d''origine',
    exists (select 1 from emargement_lignes where seance_id = s1 and stagiaire_id = a_sid and trace = t_ok
      and signe_par = lower(a) and not sur_appareil_formateur and signe_le is not null and promo_id = p));
  r := pg_temp.essai(f, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, c_sid, t_ok));
  perform pg_temp.verifier('formateur : fait signer C sur son appareil', r like 'OK 2%', r);
  perform pg_temp.verifier('signature de C marquée « sur l''appareil du formateur »',
    exists (select 1 from emargement_lignes where seance_id = s1 and stagiaire_id = c_sid
      and sur_appareil_formateur and signe_par = lower(f)));
  if inactif_sid is not null then
    r := pg_temp.essai(f, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, inactif_sid, t_ok));
    perform pg_temp.verifier('formateur : signer pour un stagiaire inactif refusé', r like 'REFUS P0001%', r);
  end if;

  -- 4. Lectures.
  n := pg_temp.compter(a, p, format('select count(*) from public.emargement_lignes where seance_id = %s', s1));
  perform pg_temp.verifier('A ne voit que sa ligne', n = 1, n::text);
  n := pg_temp.compter(b, p, format('select count(*) from public.emargement_lignes where seance_id = %s', s1));
  perform pg_temp.verifier('B ne voit aucune ligne des autres', n = 0, n::text);
  n := pg_temp.compter(f, p, format('select count(*) from public.emargement_lignes where seance_id = %s', s1));
  perform pg_temp.verifier('F voit toutes les lignes de la séance', n = 2, n::text);
  n := pg_temp.compter(a, p, format('select count(*) from public.emargement_seances where id = %s', s1));
  perform pg_temp.verifier('A voit la séance de sa promo', n = 1, n::text);
  n := pg_temp.compter(f, q, format('select count(*) from public.emargement_lignes where seance_id = %s', s1));
  perform pg_temp.verifier('F dans l''autre promo ne voit pas les lignes de P', n = 0, n::text);
  n := pg_temp.compter(f, q, format('select count(*) from public.emargement_seances where id = %s', s1));
  perform pg_temp.verifier('F dans l''autre promo ne voit pas la séance de P', n = 0, n::text);
  n := pg_temp.compter(null, null, 'select count(*) from public.emargement_seances');
  perform pg_temp.verifier('visiteur : lecture refusée', n = -1, n::text);
  if o is not null then
    n := pg_temp.compter(o, q, format('select count(*) from public.emargement_seances where id = %s', s1));
    perform pg_temp.verifier('O (autre promo) ne voit pas la séance de P', n = 0, n::text);
    r := pg_temp.essai(o, q, format('select public.emargement_signer(%s, %s, %L)::text', s1, a_sid, t_ok));
    perform pg_temp.verifier('O ne peut pas signer dans P', r like 'REFUS P0001%', r);
  end if;
  r := pg_temp.essai(f, q, format('select public.emargement_signer(%s, %s, %L)::text', s1, b_sid, t_ok));
  perform pg_temp.verifier('F dans l''autre promo : séance de P introuvable', r like 'REFUS P0001%', r);

  -- 5. Absences et observations.
  r := pg_temp.essai(b, p, format('select public.emargement_annoter(%s, %s, true, null)::text', s1, b_sid));
  perform pg_temp.verifier('stagiaire : annoter refusé', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_annoter(%s, %s, true, null)::text', s1, b_sid));
  perform pg_temp.verifier('formateur : marque B absent', r like 'OK%', r);
  r := pg_temp.essai(b, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, b_sid, t_ok));
  perform pg_temp.verifier('B absent ne peut pas signer', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_annoter(%s, %s, false, null)::text', s1, b_sid));
  perform pg_temp.verifier('formateur : retire l''absence de B', r like 'OK%', r);
  perform pg_temp.verifier('ligne vide de B supprimée',
    not exists (select 1 from emargement_lignes where seance_id = s1 and stagiaire_id = b_sid));
  r := pg_temp.essai(f, p, format('select public.emargement_annoter(%s, %s, true, null)::text', s1, a_sid));
  perform pg_temp.verifier('formateur : marquer absent un signataire refusé', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_annoter(%s, %s, null, %L)::text', s1, a_sid, 'Arrivé à 9h40'));
  perform pg_temp.verifier('formateur : observation sur une ligne signée', r like 'OK%', r);
  perform pg_temp.verifier('observation posée, signature intacte',
    exists (select 1 from emargement_lignes where seance_id = s1 and stagiaire_id = a_sid
      and observation = 'Arrivé à 9h40' and trace = t_ok));
  r := pg_temp.essai(f, p, format('select public.emargement_annoter(%s, %s, null, %L)::text', s1, a_sid, repeat('x', 201)));
  perform pg_temp.verifier('observation de plus de 200 caractères refusée', r like 'REFUS P0001%', r);

  -- 6. Signature du formateur et clôture.
  r := pg_temp.essai(f, p, format('select public.emargement_clore(%s)::text', s1));
  perform pg_temp.verifier('clôture sans signature de formateur refusée', r like 'REFUS P0001%', r);
  r := pg_temp.essai(a, p, format('select public.emargement_signer_formateur(%s, %L, %L)::text', s1, 'Romain', t_ok));
  perform pg_temp.verifier('stagiaire : signature de formateur refusée', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_signer_formateur(%s, %L, %L)::text', s1, '  ', t_ok));
  perform pg_temp.verifier('formateur : nom vide refusé', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_signer_formateur(%s, %L, %L)::text', s1, 'Romain', t_ok));
  perform pg_temp.verifier('formateur : signe', r like 'OK 2%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_signer_formateur(%s, %L, %L)::text', s1, 'romain', t_ok));
  perform pg_temp.verifier('formateur : seconde signature du même nom refusée', r like 'REFUS P0001%', r);
  n := pg_temp.compter(a, p, format('select count(*) from public.emargement_formateurs where seance_id = %s', s1));
  perform pg_temp.verifier('A ne voit pas les signatures de formateurs', n = 0, n::text);
  n := pg_temp.compter(f, p, format('select count(*) from public.emargement_formateurs where seance_id = %s', s1));
  perform pg_temp.verifier('F voit la signature de formateur', n = 1, n::text);

  -- Absence de B au planning de la demi-journée (carte posée en propriétaire).
  insert into planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite, absences, promo_id)
  values (aujourdhui - (extract(isodow from aujourdhui)::int - 1), extract(isodow from aujourdhui)::int - 1, demi,
          90, 90, 'Voiture (conduite)', jsonb_build_array(jsonb_build_object('sid', b_sid, 'rid', null)), p);

  r := pg_temp.essai(f, p, format('select public.emargement_clore(%s)::text', s1));
  select count(*) into n from stagiaires where promo_id = p and actif and id not in (a_sid, c_sid);
  perform pg_temp.verifier('clôture : rend le nombre d''absents posés', r = 'OK ' || n, r || ' attendu ' || n);
  perform pg_temp.verifier('B absent, origine planning',
    exists (select 1 from emargement_lignes where seance_id = s1 and stagiaire_id = b_sid and absent and absence_origine = 'planning'));
  perform pg_temp.verifier('les autres non signés : origine non_signe',
    not exists (select 1 from stagiaires s where s.promo_id = p and s.actif and s.id not in (a_sid, b_sid, c_sid)
      and not exists (select 1 from emargement_lignes l where l.seance_id = s1 and l.stagiaire_id = s.id
        and l.absent and l.absence_origine = 'non_signe')));
  perform pg_temp.verifier('séance close, avec auteur et heure',
    exists (select 1 from emargement_seances where id = s1 and statut = 'close' and close_le is not null and close_par = lower(f)));
  r := pg_temp.essai(f, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, b_sid, t_ok));
  perform pg_temp.verifier('séance close : signature refusée', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_annoter(%s, %s, false, null)::text', s1, b_sid));
  perform pg_temp.verifier('séance close : absence non modifiable', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_annoter(%s, %s, null, %L)::text', s1, b_sid, 'Absence justifiée'));
  perform pg_temp.verifier('séance close : observation encore possible', r like 'OK%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_clore(%s)::text', s1));
  perform pg_temp.verifier('seconde clôture refusée', r like 'REFUS P0001%', r);

  -- 7. Inaltérabilité (en propriétaire : le déclencheur tient même sans les droits).
  begin
    update emargement_lignes set trace = 'M1 1L2 2' where seance_id = s1 and stagiaire_id = a_sid;
    perform pg_temp.verifier('propriétaire : modifier un tracé refusé', false, 'modification acceptée');
  exception when others then
    perform pg_temp.verifier('propriétaire : modifier un tracé refusé', sqlerrm like 'emargement:%', sqlerrm);
  end;
  begin
    update emargement_lignes set signe_le = signe_le - interval '1 hour' where seance_id = s1 and stagiaire_id = a_sid;
    perform pg_temp.verifier('propriétaire : antidater une signature refusé', false, 'modification acceptée');
  exception when others then
    perform pg_temp.verifier('propriétaire : antidater une signature refusé', sqlerrm like 'emargement:%', sqlerrm);
  end;
  begin
    update emargement_formateurs set nom = 'Autre' where seance_id = s1;
    perform pg_temp.verifier('propriétaire : modifier une signature de formateur refusé', false, 'modification acceptée');
  exception when others then
    perform pg_temp.verifier('propriétaire : modifier une signature de formateur refusé', sqlerrm like 'emargement:%', sqlerrm);
  end;
  -- Porte réservée à une future migration d'effacement : permise, puis annulée.
  perform set_config('emargement.effacement', 'on', true);
  begin
    update emargement_lignes set signe_par = 'efface' where seance_id = s1 and stagiaire_id = a_sid;
    v_effacement := true;
    raise exception 'annuler';
  exception when others then
    if sqlerrm <> 'annuler' then v_effacement := false; v_message := sqlerrm; end if;
  end;
  perform set_config('emargement.effacement', '', true);
  perform pg_temp.verifier('effacement explicite (emargement.effacement) permis', v_effacement, v_message);
  perform pg_temp.verifier('signature de A toujours d''origine',
    exists (select 1 from emargement_lignes where seance_id = s1 and stagiaire_id = a_sid and trace = t_ok and signe_par = lower(a)));

  -- 8. Réouverture.
  r := pg_temp.essai(a, p, format('select public.emargement_rouvrir(%s)::text', s1));
  perform pg_temp.verifier('stagiaire : réouverture refusée', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_rouvrir(%s)::text', s1));
  perform pg_temp.verifier('formateur : réouverture le jour même', r like 'OK%', r);
  perform pg_temp.verifier('réouverture : absences de clôture retirées, observation gardée',
    exists (select 1 from emargement_lignes where seance_id = s1 and stagiaire_id = b_sid and not absent
      and absence_origine is null and observation = 'Absence justifiée')
    and not exists (select 1 from emargement_lignes where seance_id = s1 and absence_origine in ('planning', 'non_signe')));
  perform pg_temp.verifier('réouverture : signatures intactes',
    (select count(*) from emargement_lignes where seance_id = s1 and trace is not null) = 2
    and exists (select 1 from emargement_seances where id = s1 and statut = 'ouverte' and close_le is null));
  r := pg_temp.essai(b, p, format('select public.emargement_signer(%s, %s, %L)::text', s1, b_sid, t_ok));
  perform pg_temp.verifier('après réouverture, B peut signer', r like 'OK 2%', r);

  -- 9. Règle du jour : une séance d'un autre jour ne se signe pas et ne se rouvre pas.
  insert into emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par)
  values (p, aujourdhui - 1, demi, '09:00', '12:30', lower(f)) returning id into s2;
  r := pg_temp.essai(a, p, format('select public.emargement_signer(%s, %s, %L)::text', s2, a_sid, t_ok));
  perform pg_temp.verifier('séance de la veille : signature du stagiaire refusée', r like 'REFUS P0001%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_signer(%s, %s, %L)::text', s2, c_sid, t_ok));
  perform pg_temp.verifier('séance de la veille : signature sur l''appareil du formateur refusée', r like 'REFUS P0001%', r);
  -- Feuille oubliée : le formateur peut encore la signer (heure réelle, imprimée avec sa date)
  -- puis la clore ; sans cela elle resterait ouverte pour toujours.
  r := pg_temp.essai(f, p, format('select public.emargement_signer_formateur(%s, %L, %L)::text', s2, 'Romain', t_ok));
  perform pg_temp.verifier('séance de la veille : le formateur peut encore signer', r like 'OK 2%', r);
  perform pg_temp.verifier('séance de la veille : signature du formateur à l''heure réelle',
    exists (select 1 from emargement_formateurs where seance_id = s2 and (signe_le at time zone 'Europe/Paris')::date = aujourdhui));
  r := pg_temp.essai(f, p, format('select public.emargement_clore(%s)::text', s2));
  perform pg_temp.verifier('séance de la veille oubliée : clôture permise', r like 'OK%', r);
  r := pg_temp.essai(f, p, format('select public.emargement_rouvrir(%s)::text', s2));
  perform pg_temp.verifier('séance de la veille : réouverture refusée', r like 'REFUS P0001%', r);

  -- 10. Ménage de la promo de démonstration : supprimer la séance emporte lignes et signatures.
  delete from emargement_seances where id in (s1, s2);
  perform pg_temp.verifier('suppression d''une séance : lignes et signatures suivent',
    not exists (select 1 from emargement_lignes where seance_id in (s1, s2))
    and not exists (select 1 from emargement_formateurs where seance_id in (s1, s2)));

  -- Verdict.
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat <> 'ok'),
         string_agg(case when etat <> 'ok' then num || '. ' || libelle || ' [' || detail || ']' end, ' | ' order by num)
    into v_ok, v_ko, v_liste from preuve;
  if v_ko = 0 then
    raise exception using message = format('VERT %s/0', v_ok);
  end if;
  raise exception using message = format('ROUGE %s ok, %s échecs : %s', v_ok, v_ko, v_liste);
end $preuve$;
