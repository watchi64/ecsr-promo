-- Retour de 20261111_conservation_direction.sql : les deux étapes de conservation redeviennent réservées au fondateur (versions
-- de Q5, 20261110_conservation.sql, recréées à l'identique : les deux fragments de ce lot, la garde et le contrôle des activités
-- après le verrou, sont remplacés par ceux de Q5 dans la définition en base, chacun attendu exactement une fois ; sinon rien
-- n'est changé), puis etat_conservation_centre, _activite_apres_fin, _peut_conserver_promo et _peut_conserver_centre sont
-- retirées.
-- Procédure : retirer d'abord de l'app le commit qui appelle etat_conservation_centre (section « Données personnelles » des
-- Réglages du centre) et remettre en ligne la version d'avant, PUIS jouer ce fichier (psql -1, PGCLIENTENCODING=UTF8). À jouer
-- avant tout retour de Q5.
-- Toujours possible, même après une étape lancée par une direction : ce retour ne fait que retirer un droit, il ne recrée
-- aucune donnée et n'en efface aucune. (Le retour de Q5, lui, reste refusé dès qu'une étape a laissé une trace au journal,
-- quelle que soit la personne qui l'a lancée.)
set local lock_timeout = '3s';

do $retour$
declare
  v_fonctions regprocedure[] := array[
    'public.effacer_promo_etape1(integer)'::regprocedure,
    'public.effacer_promo_etape2(integer)'::regprocedure];
  v_q5_lf constant text[] := array[$q5$
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_promo is null or not peut_acceder_promo(p_promo) then
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
$q5$, $q5$
  select * into p from promos where id = p_promo for no key update;
$q5$];
  v_lot_lf constant text[] := array[$lot$
  -- Fondateur (garde de Q5) ou direction du centre de la promo (_peut_conserver_promo) ; les refus restent ceux de Q5.
  if p_promo is null or not _peut_conserver_promo(p_promo) then
    if not peut_gerer_qualite() then
      raise exception 'conservation: Réservé à la gestion de la qualité.';
    end if;
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
$lot$, $lot$
  select * into p from promos where id = p_promo for no key update;
  -- Direction (hors fondateur) : la date de fin, qu'elle peut modifier, ne suffit pas. Aucune activité de la promo ne doit être
  -- datée après sa fin (_activite_apres_fin), relue après le verrou : un changement de dates simultané attend la fin de l'étape.
  if not (peut_gerer_qualite() and peut_acceder_promo(p_promo)) and _activite_apres_fin(p_promo) is not null then
    raise exception 'conservation: Des activités de cette promo sont datées après sa date de fin (jusqu''au %) : vérifiez la date de fin de la promo, ou demandez cet effacement au fondateur.', to_char(_activite_apres_fin(p_promo), 'DD/MM/YYYY');
  end if;
$lot$];
  v_def text;
  v_q5 text;
  v_lot text;
  n integer;
begin
  for f in 1..2 loop
    v_def := pg_get_functiondef(v_fonctions[f]);
    -- Le fragment du verrou de ce lot contient celui de Q5 : on remplace d'abord celui de ce lot (2), puis la garde (1).
    for i in reverse 2..1 loop
      v_q5 := v_q5_lf[i];
      v_lot := v_lot_lf[i];
      if position(E'\r' in v_def) > 0 then
        v_q5 := replace(v_q5, E'\n', E'\r\n');
        v_lot := replace(v_lot, E'\n', E'\r\n');
      end if;
      n := (length(v_def) - length(replace(v_def, v_lot, ''))) / length(v_lot);
      if n <> 1 then
        raise exception 'conservation_direction (retour) : le fragment % de ce lot attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f]::text, n;
      end if;
      v_def := replace(v_def, v_lot, v_q5);
    end loop;
    execute v_def;
  end loop;
end
$retour$;

drop function public.etat_conservation_centre(integer);
drop function public._activite_apres_fin(integer);
drop function public._peut_conserver_promo(integer);
drop function public._peut_conserver_centre(integer);
