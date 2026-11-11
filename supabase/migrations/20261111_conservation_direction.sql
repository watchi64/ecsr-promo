-- Conservation des données (Qualiopi Q5) : les deux étapes datées s'ouvrent à la direction d'un centre, pour les promos de SON
-- centre (décision de Timy du 10/11 : la direction gère les données personnelles de son centre ; accord du 11/11 « Oui,
-- ouvre-les »). Q5 (20261110_conservation.sql) réservait les effacements au fondateur ; la direction avait perdu en intérim son
-- ancien bouton (anonymisation à 12 mois). Elle retrouve un bouton, branché sur les deux étapes de Q5.
--   1. _peut_conserver_centre(p_lieu) : LA condition de la direction, en un seul endroit, interne (aucun droit d'appel) :
--      geste_centre(p_lieu, 'donnees.purger'), le geste qui garde déjà la purge des élèves bénévoles du centre
--      (benevoles_a_purger(p_lieu), purger_benevoles(p_ids, p_lieu), titres et droits étape 1, en ligne le 11/11). Avec les seuls
--      titres fixes d'aujourd'hui, ce geste vaut direction_fixe(p_lieu) : vrai pour une affectation direction sur ce centre ; pour
--      le fondateur réel hors aperçu ; en aperçu, pour le seul aperçu direction et sur le seul centre affiché (lieu_courant()) ;
--      faux pour le siège, un formateur, un stagiaire, tout autre aperçu, un centre nul. Les titres et droits (étape suivante)
--      n'auront que cette fonction à remplacer.
--   2. _peut_conserver_promo(p_promo) : (peut_gerer_qualite() et peut_acceder_promo(p_promo), la garde de Q5) ou
--      _peut_conserver_centre(lieu de la promo). Faux pour une promo nulle ou inconnue. Interne.
--   2 bis. _activite_apres_fin(p_promo) : la dernière date d'activité de la promo postérieure à sa date de fin, nulle s'il n'y en
--      a pas (ou pas de date de fin). Relecture du 11/11 : la direction peut changer les dates d'une promo (modifier_dates_promo,
--      geste promos.gerer) ; reculer la fin d'une promo en cours (ou se tromper d'année) rendrait une étape « due ». Pour la
--      direction (hors fondateur), chaque étape exige donc en plus qu'aucune activité ne soit datée après la fin. Seules des dates
--      que la direction ne peut ni modifier ni supprimer (relu dans les règles des titres, 20261112_titres_3_regles.sql, et les
--      droits de la production) : voir le détail au-dessus de la fonction. La date de création des fiches n'est PAS lue : la
--      direction la modifie (geste stagiaires.gerer, règle stagiaires_modification). Ni l'agenda ni les jours off (une date
--      d'examen après la fin est normale). Jours de Paris pour les horodatages. Le fondateur garde la règle de Q5. Interne.
--   3. effacer_promo_etape1 et effacer_promo_etape2 : redéfinies à partir de leur définition en base au moment de l'exécution
--      (pg_get_functiondef), par remplacement de deux fragments, chacun attendu exactement une fois dans chacune : la garde, et la
--      ligne du verrou de la promo, suivie du contrôle des activités pour la direction (après le verrou : un changement de dates
--      simultané attend). Même corps, mêmes dates, même journal. Les refus de Q5 restent : « Réservé à la gestion de la qualité. »
--      pour qui n'est pas le fondateur, « Cette promo n'est pas dans votre périmètre. » pour le fondateur (promo nulle ou
--      inconnue) ; la direction reçoit en plus « Des activités de cette promo sont datées après sa date de fin (jusqu'au …) :
--      si cette date est fausse, corrigez-la ; sinon, demandez cet effacement au fondateur. ». Si un fragment n'est pas trouvé exactement
--      une fois, la migration s'arrête sans rien changer.
--   4. etat_conservation_centre(p_lieu) : la forme de etat_conservation(), restreinte aux promos du centre p_lieu où les étapes
--      sont permises à l'appelant (_peut_conserver_promo), plus une clé fin_contredite_le : pour la direction (hors fondateur), la
--      date rendue par _activite_apres_fin (l'écran n'allume alors aucun bouton et dit pourquoi) ; nulle pour le fondateur.
--      portees_formateurs vide, registre nul (ils restent au fondateur, page Qualiopi). Fondateur (peut_gerer_qualite()) ou
--      _peut_conserver_centre(p_lieu) ; sinon refus « conservation: Réservé à la direction du centre. ».
-- INCHANGÉS (fondateur seul) : etat_conservation(), effacer_sur_demande, les fonctions des questionnaires des formateurs, le
-- registre qualité. Aucune table, aucune règle de sécurité touchée.
-- Retour : 20261111_conservation_direction_retour.sql (remet la garde de Q5, retire les trois fonctions de ce lot). Preuve :
-- tests/sql/conservation-direction-preuve.sql. Jamais appliquée sans l'accord de Timy.
set local lock_timeout = '3s';

-- 1. et 2. Les conditions -------------------------------------------------------------------------------------------------
create function public._peut_conserver_centre(p_lieu integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select p_lieu is not null and coalesce(geste_centre(p_lieu, 'donnees.purger'), false);
$function$;

create function public._peut_conserver_promo(p_promo integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select p_promo is not null
     and exists (select 1 from promos pr where pr.id = p_promo)
     and ((peut_gerer_qualite() and peut_acceder_promo(p_promo))
          or _peut_conserver_centre(lieu_de_promo(p_promo)));
$function$;

-- Les dates lues, et pourquoi la direction (sans affectation de formateur sur la promo) ne peut ni les modifier ni les supprimer :
--   promos.created_at            : seul update (nom) est accordé (20261001_multi_promo_1_fondations.sql) ; creer_promo et
--                                  modifier_dates_promo n'écrivent que les dates.
--   emargement_seances.jour,     : lecture seule par règle (emargement_lignes_lecture, emargement.lire) ; toute écriture passe par
--   emargement_lignes.signe_le     les fonctions de l'émargement (feuille tenue par le formateur, emargement.tenir = case de promo).
--   planning_entries (lundi+jour): écriture par planning.modifier (case de promo : formateur seulement).
--   evaluations.date_eval,       : écriture et suppression par notes.saisir (case de promo : formateur seulement).
--   epcf_evaluations.date_eval,
--   qcm_attempts.finished_at,    : idem (notes.saisir) ; un stagiaire n'ajoute que ses propres essais.
--   epcf_livrets.updated_at      : idem (notes.saisir).
--   dp_dossiers.updated_at       : notes.saisir ou le stagiaire lui-même ; jamais la direction.
--   passages.date                : écriture et suppression par planning.modifier (formateur).
--   evaluations_audit.changed_at,: écrites par déclencheur, aucune règle d'écriture ni de suppression pour authenticated ; elles
--   passages_audit.changed_at      gardent la trace d'un ajout ou d'une suppression (supprimer une activité tardive ne lève pas le
--                                  refus). Seules les lignes « insert » et « delete » comptent : les étapes elles-mêmes modifient
--                                  des notes et des passages (textes libres, adresses), ce qui écrit des lignes « update ».
--   fiches_suivi.updated_at      : seulement si la table existe encore (retirée en production le 11/11) ; notes.saisir.
-- Une direction qui est aussi formatrice de la promo peut supprimer des créneaux, des notes ou des passages : les tables d'audit et
-- promos.created_at gardent alors la trace. Plpgsql et requête dynamique pour fiches_suivi : la fonction se crée même sans elle.
create function public._activite_apres_fin(p_promo integer)
returns date language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_fin date;
  v_cree timestamptz;
  v_max date;
  v_suivi date;
begin
  select pr.date_fin, pr.created_at into v_fin, v_cree from promos pr where pr.id = p_promo;
  if v_fin is null then
    return null;
  end if;
  select max(x.d) into v_max from (
    select (v_cree at time zone 'Europe/Paris')::date
    union all select es.jour from emargement_seances es where es.promo_id = p_promo
    union all select (el.signe_le at time zone 'Europe/Paris')::date from emargement_lignes el where el.promo_id = p_promo
    union all select pe.semaine_lundi + pe.day_index from planning_entries pe where pe.promo_id = p_promo
    union all select ev.date_eval from evaluations ev where ev.promo_id = p_promo
    union all select (ea.changed_at at time zone 'Europe/Paris')::date from evaluations_audit ea
               where ea.promo_id = p_promo and ea.action in ('insert', 'delete')
    union all select ee.date_eval from epcf_evaluations ee where ee.promo_id = p_promo
    union all select (q.finished_at at time zone 'Europe/Paris')::date from qcm_attempts q where q.promo_id = p_promo
    union all select (lv.updated_at at time zone 'Europe/Paris')::date from epcf_livrets lv where lv.promo_id = p_promo
    union all select (dp.updated_at at time zone 'Europe/Paris')::date from dp_dossiers dp where dp.promo_id = p_promo
    union all select pa.date from passages pa where pa.promo_id = p_promo
    union all select (pau.changed_at at time zone 'Europe/Paris')::date from passages_audit pau
               where pau.promo_id = p_promo and pau.action in ('insert', 'delete')) x(d)
   where x.d > v_fin;
  if to_regclass('public.fiches_suivi') is not null then
    execute 'select max((f.updated_at at time zone ''Europe/Paris'')::date) from public.fiches_suivi f where f.promo_id = $1'
      into v_suivi using p_promo;
    if v_suivi > v_fin and (v_max is null or v_suivi > v_max) then
      v_max := v_suivi;
    end if;
  end if;
  return v_max;
end;
$function$;

revoke all on function public._peut_conserver_centre(integer), public._peut_conserver_promo(integer),
  public._activite_apres_fin(integer) from public, anon, authenticated, service_role;

-- 3. Les deux étapes : la garde et le contrôle des activités ---------------------------------------------------------------
do $migration$
declare
  v_fonctions regprocedure[] := array[
    'public.effacer_promo_etape1(integer)'::regprocedure,
    'public.effacer_promo_etape2(integer)'::regprocedure];
  v_anciens_lf constant text[] := array[$ancien$
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_promo is null or not peut_acceder_promo(p_promo) then
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
$ancien$, $ancien$
  select * into p from promos where id = p_promo for no key update;
$ancien$];
  v_nouveaux_lf constant text[] := array[$nouveau$
  -- Fondateur (garde de Q5) ou direction du centre de la promo (_peut_conserver_promo) ; les refus restent ceux de Q5.
  if p_promo is null or not _peut_conserver_promo(p_promo) then
    if not peut_gerer_qualite() then
      raise exception 'conservation: Réservé à la gestion de la qualité.';
    end if;
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
$nouveau$, $nouveau$
  select * into p from promos where id = p_promo for no key update;
  -- Direction (hors fondateur) : la date de fin, qu'elle peut modifier, ne suffit pas. Aucune activité de la promo ne doit être
  -- datée après sa fin (_activite_apres_fin), relue après le verrou : un changement de dates simultané attend la fin de l'étape.
  if not (peut_gerer_qualite() and peut_acceder_promo(p_promo)) and _activite_apres_fin(p_promo) is not null then
    raise exception 'conservation: Des activités de cette promo sont datées après sa date de fin (jusqu''au %) : si cette date est fausse, corrigez-la ; sinon, demandez cet effacement au fondateur.', to_char(_activite_apres_fin(p_promo), 'DD/MM/YYYY');
  end if;
$nouveau$];
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : un fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..2 loop
    v_def := pg_get_functiondef(v_fonctions[f]);
    for i in 1..2 loop
      v_ancien := v_anciens_lf[i];
      v_nouveau := v_nouveaux_lf[i];
      -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : les fragments suivent.
      if position(E'\r' in v_def) > 0 then
        v_ancien := replace(v_ancien, E'\n', E'\r\n');
        v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
      end if;
      n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
      if n <> 1 then
        raise exception 'conservation_direction : le fragment % de Q5 attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f]::text, n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    -- create or replace (pg_get_functiondef) : droits d'exécution de Q5 gardés.
    execute v_def;
  end loop;
end
$migration$;

-- 4. État de la conservation d'un centre (Réglages du centre, section « Données personnelles ») ----------------------------
-- { jour, promos: [{ id, nom, lieu_nom, date_fin, etape1_du, etape2_du, a_effacer_etape1, a_effacer_etape2, comptes_equipe,
-- emargement_etape2, fin_contredite_le }], portees_formateurs: [], registre: null } : les clés et les calculs de etat_conservation(),
-- pour les promos du centre p_lieu où l'appelant peut lancer les étapes, plus fin_contredite_le (direction seulement : la dernière
-- activité datée après la fin, qui bloque ses étapes ; nulle pour le fondateur). Des nombres et des dates seulement, jamais un nom.
create function public.etat_conservation_centre(p_lieu integer)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_jour date := _questionnaire_jour();
begin
  if p_lieu is null or not (peut_gerer_qualite() or _peut_conserver_centre(p_lieu)) then
    raise exception 'conservation: Réservé à la direction du centre.';
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
               'emargement_etape2', c.emargement,
               'fin_contredite_le', case when not (peut_gerer_qualite() and peut_acceder_promo(pr.id))
                                         then _activite_apres_fin(pr.id) end) order by pr.id)
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
       where pr.lieu_id = p_lieu and _peut_conserver_promo(pr.id)), '[]'::jsonb),
    'portees_formateurs', '[]'::jsonb,
    'registre', null);
end;
$function$;

revoke all on function public.etat_conservation_centre(integer) from public, anon, authenticated, service_role;
grant execute on function public.etat_conservation_centre(integer) to authenticated, service_role;
