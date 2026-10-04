-- Marche arrière de 20261004_confidentialite_1_preparation (à jouer seulement si l'étape 2
-- n'est pas appliquée). Les dates saisies entre-temps sont déjà dans stagiaires.date_naissance
-- (écriture double), rien n'est perdu.

create or replace function public.set_date_naissance(p_stagiaire_id integer, p_date date)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Non autorise : ce stagiaire n''appartient pas a la promo affichee';
  end if;
  if not (is_admin() or is_prof() or p_stagiaire_id = my_stagiaire_id()) then
    raise exception 'Non autorise : seul le stagiaire concerne ou un formateur peut modifier cette date';
  end if;
  update stagiaires set date_naissance = p_date where id = p_stagiaire_id;
end;
$function$;

drop function if exists public.notes_stats_groupe();
drop function if exists public.notes_stagiaires_visibles();
drop table if exists public.stagiaires_prive;
