-- Retour de 20261128_cloisonnement_1_fondations : retire les déclencheurs, le journal du fondateur, les colonnes organisme_id, le
-- vocabulaire et la table organismes. Rend exactement l'empreinte d'avant la migration (tests/sql/roles-empreinte.sql : règles,
-- fonctions, droits). Les rattachements des centres, sièges, titres, fiches, cartes et signalements sont perdus avec les colonnes, et
-- le journal du fondateur avec sa table : à ne jouer qu'avant toute mise en service d'un autre organisme qu'ECF, et après les
-- retours des étapes 2c, 2b et 2a.
-- Garde : les objets de l'étape 1 sont tous là, et aucune étape plus tardive n'est en place (aucune autre fonction ni règle que
-- celles de l'étape 1 ne cite le vocabulaire du cloisonnement) ; sinon rien n'est changé. Aucun corps de fonction existant n'est
-- remis : l'étape 1 n'en remplace aucun.
-- Preuve : tests/sql/cloisonnement-preuve.sql, groupe retour.
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261128_cloisonnement_1_fondations_retour.sql.

set local lock_timeout = '3s';

do $garde$
declare
  v_liste text;
begin
  if to_regclass('public.organismes') is null or to_regclass('public.acces_fondateur') is null then
    raise exception 'cloisonnement_1_retour : la table organismes ou acces_fondateur manque ; rien n''est changé';
  end if;
  select string_agg(t, ', ') into v_liste
    from unnest(array['lieux', 'affectations', 'titres', 'journal_droits', 'profs', 'ressources', 'qcm_signalements']) t
   where not exists (select 1 from pg_attribute a
                      where a.attrelid = to_regclass('public.' || t) and a.attname = 'organisme_id' and not a.attisdropped);
  if v_liste is not null then
    raise exception 'cloisonnement_1_retour : colonne organisme_id absente de : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(f, ', ') into v_liste
    from unnest(array['public.organisme_de_lieu(integer)', 'public.organisme_de_promo(integer)', 'public.organisme_actif_fondateur()',
                      'public.fondateur_sur(integer)', 'public.organisme_courant()', 'public.est_siege_de(integer)',
                      'public.organisme_redacteur_courant()', 'public.mon_organisme()', 'public.organismes_pour_support()',
                      'public.ouvrir_acces_support(integer, text, interval)', 'public.fermer_acces_support()',
                      'public._organisme_par_defaut()', 'public._journal_droits_organisme()', 'public._acces_fondateur_journal()',
                      'public._rattachement_fondateur()']) f
   where to_regprocedure(f) is null;
  if v_liste is not null then
    raise exception 'cloisonnement_1_retour : fonction(s) absente(s) : % ; rien n''est changé', v_liste;
  end if;
  -- Une étape plus tardive (2a, 2b, 2c) en place : une fonction ou une règle hors de l'étape 1 cite le vocabulaire du cloisonnement
  -- (les corps de l'étape 2a appellent fondateur_sur, organisme_courant... : les retirer les laisserait en panne).
  select string_agg(x.objet, ', ' order by x.objet) into v_liste
    from (select 'fonction ' || p.proname as objet
            from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.prosrc ~ '\m(organisme_de_lieu|organisme_de_promo|organisme_actif_fondateur|fondateur_sur|organisme_courant|est_siege_de|organisme_redacteur_courant|mon_organisme|dans_mon_organisme|organismes|organisme_id|acces_fondateur)\M'
             and p.proname <> all (array[
               -- étape 1
               'organisme_de_lieu', 'organisme_de_promo', 'organisme_actif_fondateur', 'fondateur_sur', 'organisme_courant', 'est_siege_de',
               'organisme_redacteur_courant', 'mon_organisme', 'organismes_pour_support', 'ouvrir_acces_support', 'fermer_acces_support',
               '_organisme_par_defaut', '_journal_droits_organisme', '_acces_fondateur_journal', '_rattachement_fondateur'])
          union all
          select 'règle ' || r.tablename || '.' || r.policyname
            from pg_policies r
           where r.schemaname in ('public', 'storage')
             and coalesce(r.qual, '') || ' ' || coalesce(r.with_check, '') ~ '\m(organisme_de_lieu|organisme_de_promo|organisme_actif_fondateur|fondateur_sur|organisme_courant|est_siege_de|organisme_redacteur_courant|mon_organisme|dans_mon_organisme|organismes|organisme_id|acces_fondateur)\M'
             and r.policyname <> 'acces_fondateur_lecture') x;
  if v_liste is not null then
    raise exception 'cloisonnement_1_retour : une étape plus tardive est en place (%) : jouer d''abord son retour ; rien n''est changé', v_liste;
  end if;
end $garde$;

drop trigger organisme_par_defaut on public.lieux;
drop trigger organisme_par_defaut on public.profs;
drop trigger organisme_par_defaut on public.ressources;
drop trigger organisme_par_defaut on public.qcm_signalements;
drop trigger organisme_par_defaut on public.affectations;
drop trigger organisme_par_defaut on public.titres;
drop trigger journal_droits_organisme on public.journal_droits;
drop trigger rattachement_fondateur on public.user_profiles;

-- ouvrir_acces_support rend une ligne du journal : elle part avant la table. La table emporte sa règle et ses déclencheurs.
drop function public.ouvrir_acces_support(integer, text, interval);
drop table public.acces_fondateur;

alter table public.lieux drop column organisme_id;
alter table public.affectations drop column organisme_id;
alter table public.titres drop column organisme_id;
alter table public.journal_droits drop column organisme_id;
alter table public.profs drop column organisme_id;
alter table public.ressources drop column organisme_id;
alter table public.qcm_signalements drop column organisme_id;

drop function public.fermer_acces_support();
drop function public.organismes_pour_support();
drop function public.mon_organisme();
drop function public.organisme_redacteur_courant();
drop function public.est_siege_de(integer);
drop function public.organisme_courant();
drop function public.fondateur_sur(integer);
drop function public.organisme_actif_fondateur();
drop function public.organisme_de_promo(integer);
drop function public.organisme_de_lieu(integer);
drop function public._acces_fondateur_journal();
drop function public._journal_droits_organisme();
drop function public._organisme_par_defaut();
drop function public._rattachement_fondateur();

drop table public.organismes;
