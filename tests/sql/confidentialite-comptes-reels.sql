-- Confidentialité des notes : contrôle sur TOUS les vrais comptes, dans chaque promo qu'ils
-- peuvent ouvrir. Pour chacun, ce qu'il lit (notes, historique, fiches de suivi, dates de
-- naissance) est comparé à ce que la règle de la spec autorise, calculé sans les règles
-- d'accès ; et les moyennes du serveur doivent être les mêmes pour tous dans une promo.
-- Ne sort que des compteurs (aucun email). Lève TOUJOURS une exception : rien n'est écrit.
-- Répétition : envoyer dans une seule requête 20261004_confidentialite_2_fermeture.sql puis
-- ce fichier.

set local lock_timeout = '3s';

do $verif$
declare
  r record; t text; n bigint; att bigint; st jsonb;
  v_sid integer; v_anon boolean; v_staff boolean;
  ok integer := 0; ko text[] := '{}'; nb_comptes integer := 0;
  ref jsonb; stats_ref jsonb := '{}'::jsonb;
begin
  for r in
    select up.email, up.is_admin, up.role, p.id as promo
      from user_profiles up cross join promos p
  loop
    -- La promo est-elle accessible à ce compte ? (même test que promo_courante)
    perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
    if not peut_acceder_promo(r.promo) then continue; end if;
    nb_comptes := nb_comptes + 1;

    v_staff := coalesce(r.is_admin, false) or r.role = 'prof';
    select s.id into v_sid from user_profiles up join stagiaires s on s.id = up.stagiaire_id
     where lower(up.email) = lower(r.email) and s.promo_id = r.promo limit 1;
    select coalesce(bool_or(anonymous_notes), false) into v_anon
      from user_profiles where lower(email) = lower(r.email);

    foreach t in array array['evaluations', 'evaluations_audit', 'fiches_suivi', 'stagiaires_prive'] loop
      -- Attendu, calculé en propriétaire.
      if t = 'evaluations' then
        select count(*) into att from evaluations e where e.promo_id = r.promo
           and (v_staff or e.stagiaire_id = v_sid
                or (not v_anon and e.stagiaire_id is not null
                    and not exists (select 1 from user_profiles x where x.stagiaire_id = e.stagiaire_id and x.anonymous_notes)));
      elsif t = 'evaluations_audit' then
        select count(*) into att from evaluations_audit a where a.promo_id = r.promo
           and (v_staff or a.evaluation_id in (select e.id from evaluations e where e.promo_id = r.promo
                and (e.stagiaire_id = v_sid
                     or (not v_anon and e.stagiaire_id is not null
                         and not exists (select 1 from user_profiles x where x.stagiaire_id = e.stagiaire_id and x.anonymous_notes)))));
      elsif t = 'fiches_suivi' then
        select count(*) into att from fiches_suivi where promo_id = r.promo and (v_staff or stagiaire_id = v_sid);
      else
        select count(*) into att from stagiaires_prive p join stagiaires s on s.id = p.stagiaire_id
         where s.promo_id = r.promo and (v_staff or p.stagiaire_id = v_sid);
      end if;

      -- Obtenu, en incarnant le compte.
      perform set_config('request.headers', json_build_object('x-promo-id', r.promo::text)::text, true);
      set local role authenticated;
      begin
        if t = 'stagiaires_prive' then
          select count(*) into n from stagiaires_prive p join stagiaires s on s.id = p.stagiaire_id where s.promo_id = r.promo;
        else
          execute format('select count(*) from public.%I where promo_id = $1', t) into n using r.promo;
        end if;
      exception when others then n := -1;
      end;
      reset role;
      if n = att then ok := ok + 1;
      else ko := ko || format('compte %s (%s), promo %s, %s : lu %s, attendu %s',
                              nb_comptes, case when v_staff then 'personnel' else 'stagiaire' end, r.promo, t, n, att);
      end if;
    end loop;

    -- Moyennes du serveur : les mêmes pour tous les comptes d'une promo.
    set local role authenticated;
    begin st := notes_stats_groupe(); exception when others then st := null; end;
    reset role;
    ref := stats_ref -> r.promo::text;
    if st is null then
      ko := ko || format('compte %s, promo %s : statistiques en erreur', nb_comptes, r.promo);
    elsif ref is null then
      stats_ref := stats_ref || jsonb_build_object(r.promo::text, st); ok := ok + 1;
    elsif ref = st then ok := ok + 1;
    else ko := ko || format('compte %s, promo %s : statistiques différentes des autres comptes', nb_comptes, r.promo);
    end if;
  end loop;

  -- Les statistiques correspondent au calcul direct sur toutes les notes de la promo.
  for r in select id from promos loop
    if stats_ref ? r.id::text then
      select count(*) into n from evaluations where promo_id = r.id and note is not null and note_max is not null and note_max <> 0;
      if (stats_ref -> r.id::text ->> 'n')::bigint = n then ok := ok + 1;
      else ko := ko || format('promo %s : %s notes comptées, %s en base', r.id, stats_ref -> r.id::text ->> 'n', n);
      end if;
    end if;
  end loop;

  if cardinality(ko) = 0 then
    raise exception 'VERT %/0 (% couples compte × promo)', ok, nb_comptes;
  else
    raise exception 'ROUGE %/% (% couples) : %', ok, cardinality(ko), nb_comptes, array_to_string(ko[1:15], ' | ');
  end if;
end $verif$;
