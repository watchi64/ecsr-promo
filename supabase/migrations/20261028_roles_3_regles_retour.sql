-- Marche arrière de 20261028_roles_3_regles.sql (étape 3 du lot 4 : règles par rôle et par portée).
-- Remet dans l'état relevé sur la production avant le lot 4 les règles de sécurité (RLS) des 47 tables de
-- public sous RLS et de storage.objects, ainsi que les droits d'insertion et de modification de user_profiles.
--
-- Fichier généré depuis la base de production le 2026-10-28, en lecture seule (113 règles : 107 dans public,
-- 6 dans storage), la dernière migration appliquée étant alors 20261028170407 (signalements_app) ; les
-- 46 autres sections, relevées le matin (après 20261027135732), étaient identiques le soir.
-- Pour chaque table : toutes les règles présentes sont supprimées, quel que soit leur nom
-- (la marche arrière doit marcher quel que soit l'état trouvé), puis les règles relevées sont recréées à
-- l'identique. Requête de relevé (texte de pg_policies, tel que la base le rend) :
--   select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
--     from pg_policies where schemaname in ('public', 'storage')
--    order by schemaname, tablename, policyname;
-- Chaque ligne devient : create policy <nom> on <schéma>.<table> as <permissive> for <commande> to <rôles>
-- using (<qual>) with check (<with_check>), sans la clause dont la valeur relevée est nulle.
-- Tables traitées : celles de public sous RLS (pg_class, relkind r ou p, relrowsecurity), plus storage.objects.
-- cours_chunks est sous RLS sans aucune règle : elle n'a que le bloc de suppression.
--
-- À passer avant 20261028_roles_2_fonctions_retour.sql, puis 20261028_roles_1_fondations_retour.sql.
-- Contrôle : après les retours 3, 2 et 1, tests/sql/roles-empreinte.sql redonne l'empreinte relevée juste avant
-- d'appliquer le lot (ou au début du bloc de répétition) ; après ce seul retour, la table affectations et le
-- vocabulaire de l'étape 1 la font encore différer.
-- Recette de génération, à rejouer si la production a bougé : tests/sql/roles-retours-recette.sql.
set local lock_timeout = '3s';

-- public.agenda_events : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'agenda_events' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy agenda_admin_writes on public.agenda_events
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy agenda_select_authenticated on public.agenda_events
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.auto_ecoles : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'auto_ecoles' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy auto_ecoles_delete_admin on public.auto_ecoles
  as permissive for delete to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy auto_ecoles_insert_admin on public.auto_ecoles
  as permissive for insert to authenticated
  with check ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy auto_ecoles_select_admin on public.auto_ecoles
  as permissive for select to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy auto_ecoles_update_admin on public.auto_ecoles
  as permissive for update to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))))
  with check ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));

-- public.benevole_suivi : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'benevole_suivi' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy benevole_suivi_delete_admin on public.benevole_suivi
  as permissive for delete to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy benevole_suivi_insert_admin on public.benevole_suivi
  as permissive for insert to authenticated
  with check ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy benevole_suivi_select_admin on public.benevole_suivi
  as permissive for select to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy benevole_suivi_update_admin on public.benevole_suivi
  as permissive for update to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))))
  with check ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));

-- public.benevoles : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'benevoles' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy benevoles_delete_admin on public.benevoles
  as permissive for delete to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy benevoles_insert_admin on public.benevoles
  as permissive for insert to authenticated
  with check ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy benevoles_select_admin on public.benevoles
  as permissive for select to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));
create policy benevoles_update_admin on public.benevoles
  as permissive for update to authenticated
  using ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))))
  with check ((is_admin() AND (lieu_id = ( SELECT lieu_courant() AS lieu_courant))));

-- public.chatbot_usage : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'chatbot_usage' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy chatbot_usage_select_own on public.chatbot_usage
  as permissive for select to authenticated
  using ((auth.uid() = user_id));

-- public.competences : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'competences' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy competences_admin_writes on public.competences
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy competences_select_all on public.competences
  as permissive for select to authenticated
  using (true);

-- public.conditions_acceptations : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'conditions_acceptations' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy conditions_acceptations_select on public.conditions_acceptations
  as permissive for select to authenticated
  using (((lower(email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))) OR ( SELECT is_admin() AS is_admin)));

-- public.contacts : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'contacts' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy contacts_admin_writes on public.contacts
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy contacts_select_authenticated on public.contacts
  as permissive for select to authenticated
  using (true);

-- public.cours : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'cours' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy cours_select on public.cours
  as permissive for select to authenticated
  using ((published OR is_founder() OR ((code IS NULL) AND (is_admin() OR is_prof()))));
create policy cours_update on public.cours
  as permissive for update to authenticated
  using ((is_founder() OR ((is_admin() OR is_prof()) AND ((code IS NULL) OR published))))
  with check ((is_founder() OR ((is_admin() OR is_prof()) AND ((code IS NULL) OR published))));

-- public.cours_chunks : aucune règle (RLS active : table fermée à anon et authenticated)
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'cours_chunks' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

-- public.cours_versions : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'cours_versions' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy cours_versions_insert on public.cours_versions
  as permissive for insert to authenticated
  with check ((is_founder() OR ((is_admin() OR is_prof()) AND (EXISTS ( SELECT 1
   FROM cours c
  WHERE ((c.id = cours_versions.cours_id) AND ((c.code IS NULL) OR c.published)))))));
create policy cours_versions_select on public.cours_versions
  as permissive for select to authenticated
  using ((is_founder() OR ((is_admin() OR is_prof()) AND (EXISTS ( SELECT 1
   FROM cours c
  WHERE ((c.id = cours_versions.cours_id) AND ((c.code IS NULL) OR c.published)))))));

-- public.dp_dossiers : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'dp_dossiers' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy dp_dossiers_delete on public.dp_dossiers
  as permissive for delete to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy dp_dossiers_insert on public.dp_dossiers
  as permissive for insert to public
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof() OR (stagiaire_id = my_stagiaire_id()))));
create policy dp_dossiers_select on public.dp_dossiers
  as permissive for select to public
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof() OR (stagiaire_id = my_stagiaire_id()))));
create policy dp_dossiers_update on public.dp_dossiers
  as permissive for update to public
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof() OR (stagiaire_id = my_stagiaire_id()))))
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof() OR (stagiaire_id = my_stagiaire_id()))));

-- public.effacements_journal : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'effacements_journal' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy effacements_journal_select on public.effacements_journal
  as permissive for select to authenticated
  using (( SELECT is_admin() AS is_admin));

-- public.emargement_formateurs : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'emargement_formateurs' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy emargement_formateurs_select on public.emargement_formateurs
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (( SELECT is_admin() AS is_admin) OR ( SELECT is_prof() AS is_prof))));

-- public.emargement_lignes : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'emargement_lignes' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy emargement_lignes_select on public.emargement_lignes
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (( SELECT is_admin() AS is_admin) OR ( SELECT is_prof() AS is_prof) OR (stagiaire_id = ( SELECT my_stagiaire_id() AS my_stagiaire_id)))));

-- public.emargement_seances : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'emargement_seances' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy emargement_seances_select on public.emargement_seances
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.epcf_evaluations : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'epcf_evaluations' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy epcf_delete on public.epcf_evaluations
  as permissive for delete to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())));
create policy epcf_insert on public.epcf_evaluations
  as permissive for insert to authenticated
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())));
create policy epcf_select on public.epcf_evaluations
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof() OR (stagiaire_id = my_stagiaire_id()))));
create policy epcf_update on public.epcf_evaluations
  as permissive for update to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())))
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())));

-- public.epcf_livrets : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'epcf_livrets' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy epcf_livrets_delete on public.epcf_livrets
  as permissive for delete to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())));
create policy epcf_livrets_insert on public.epcf_livrets
  as permissive for insert to authenticated
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())));
create policy epcf_livrets_select on public.epcf_livrets
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof() OR (stagiaire_id = my_stagiaire_id()))));
create policy epcf_livrets_update on public.epcf_livrets
  as permissive for update to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())))
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR is_prof())));

-- public.evaluations : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'evaluations' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy evaluations_admin_writes on public.evaluations
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy evaluations_select on public.evaluations
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (( SELECT is_admin() AS is_admin) OR ( SELECT is_prof() AS is_prof) OR (stagiaire_id IN ( SELECT notes_stagiaires_visibles() AS notes_stagiaires_visibles)))));

-- public.evaluations_audit : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'evaluations_audit' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy evaluations_audit_select on public.evaluations_audit
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (( SELECT is_admin() AS is_admin) OR ( SELECT is_prof() AS is_prof) OR (evaluation_id IN ( SELECT e.id
   FROM evaluations e)))));

-- public.fiches_suivi : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'fiches_suivi' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy fiches_suivi_delete on public.fiches_suivi
  as permissive for delete to authenticated
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy fiches_suivi_insert on public.fiches_suivi
  as permissive for insert to authenticated
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (up.email = lower((auth.jwt() ->> 'email'::text))))))));
create policy fiches_suivi_select on public.fiches_suivi
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (( SELECT is_admin() AS is_admin) OR ( SELECT is_prof() AS is_prof) OR (stagiaire_id = ( SELECT my_stagiaire_id() AS my_stagiaire_id)))));
create policy fiches_suivi_update on public.fiches_suivi
  as permissive for update to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (up.email = lower((auth.jwt() ->> 'email'::text))))))))
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (up.email = lower((auth.jwt() ->> 'email'::text))))))));

-- public.lieux : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'lieux' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy lieux_select on public.lieux
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM promos p
  WHERE ((p.lieu_id = lieux.id) AND peut_acceder_promo(p.id)))));

-- public.passages : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'passages' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy passages_admin_all on public.passages
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy passages_insert_own on public.passages
  as permissive for insert to authenticated
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (is_admin() OR (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (lower(up.email) = lower(auth.email()))
 LIMIT 1)))));
create policy passages_select_all on public.passages
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));
create policy passages_update_own on public.passages
  as permissive for update to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (lower(up.email) = lower(auth.email()))
 LIMIT 1))))
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (lower(up.email) = lower(auth.email()))
 LIMIT 1))));

-- public.passages_audit : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'passages_audit' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy passages_audit_select on public.passages_audit
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.planning_entries : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'planning_entries' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy planning_entries_admin_writes on public.planning_entries
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy planning_entries_select_all on public.planning_entries
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.planning_half_meta : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'planning_half_meta' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy planning_half_meta_admin_writes on public.planning_half_meta
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy planning_half_meta_select_all on public.planning_half_meta
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.planning_jours_off : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'planning_jours_off' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy planning_jours_off_admin_writes on public.planning_jours_off
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy planning_jours_off_select_all on public.planning_jours_off
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.profs : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'profs' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy profs_admin_writes on public.profs
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy profs_select_all on public.profs
  as permissive for select to authenticated
  using (true);

-- public.promos : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'promos' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy promos_select on public.promos
  as permissive for select to authenticated
  using (peut_acceder_promo(id));
create policy promos_update_nom on public.promos
  as permissive for update to authenticated
  using ((is_admin() AND peut_acceder_promo(id)))
  with check ((is_admin() AND peut_acceder_promo(id)));

-- public.qcm : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_admin_all on public.qcm
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy qcm_select_connectes on public.qcm
  as permissive for select to authenticated
  using (true);
create policy qcm_select_founder on public.qcm
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((lower(up.email) = lower(auth.email())) AND up.is_founder))));
create policy qcm_update_formateur on public.qcm
  as permissive for update to authenticated
  using ((is_admin() OR is_prof()))
  with check ((is_admin() OR is_prof()));

-- public.qcm_attempts : 3 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_attempts' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_attempts_admin_all on public.qcm_attempts
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy qcm_attempts_insert_own on public.qcm_attempts
  as permissive for insert to authenticated
  with check (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (lower(up.email) = lower(auth.email()))
 LIMIT 1)) AND ((mode = 'entrainement'::text) OR ((mode = 'examen'::text) AND qcm_exam_remise_toleree(qcm_id)))));
create policy qcm_attempts_select_own on public.qcm_attempts
  as permissive for select to authenticated
  using (((promo_id = ( SELECT promo_courante() AS promo_courante)) AND (stagiaire_id = ( SELECT up.stagiaire_id
   FROM user_profiles up
  WHERE (lower(up.email) = lower(auth.email()))
 LIMIT 1))));

-- public.qcm_examens : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_examens' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_examens_delete on public.qcm_examens
  as permissive for delete to authenticated
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy qcm_examens_insert on public.qcm_examens
  as permissive for insert to authenticated
  with check (((is_admin() OR is_prof()) AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy qcm_examens_select on public.qcm_examens
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));
create policy qcm_examens_update on public.qcm_examens
  as permissive for update to authenticated
  using (((is_admin() OR is_prof()) AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check (((is_admin() OR is_prof()) AND (promo_id = ( SELECT promo_courante() AS promo_courante))));

-- public.qcm_ia_brouillons : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_ia_brouillons' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_ia_brouillons_select on public.qcm_ia_brouillons
  as permissive for select to authenticated
  using (is_admin());

-- public.qcm_ia_usage : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_ia_usage' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_ia_usage_select_own on public.qcm_ia_usage
  as permissive for select to authenticated
  using ((auth.uid() = user_id));

-- public.qcm_options : 3 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_options' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_options_admin_all on public.qcm_options
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy qcm_options_select_connectes on public.qcm_options
  as permissive for select to authenticated
  using (true);
create policy qcm_options_select_founder on public.qcm_options
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((lower(up.email) = lower(auth.email())) AND up.is_founder))));

-- public.qcm_questions : 3 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_questions' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_questions_admin_all on public.qcm_questions
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy qcm_questions_select_connectes on public.qcm_questions
  as permissive for select to authenticated
  using (true);
create policy qcm_questions_select_founder on public.qcm_questions
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((lower(up.email) = lower(auth.email())) AND up.is_founder))));

-- public.qcm_signalement_instruction : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_signalement_instruction' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_signalement_instruction_select on public.qcm_signalement_instruction
  as permissive for select to authenticated
  using ((is_admin() OR is_prof()));

-- public.qcm_signalements : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'qcm_signalements' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy qcm_signalements_delete on public.qcm_signalements
  as permissive for delete to authenticated
  using (is_admin());
create policy qcm_signalements_insert on public.qcm_signalements
  as permissive for insert to authenticated
  with check ((lower(email) = lower(auth.email())));
create policy qcm_signalements_select on public.qcm_signalements
  as permissive for select to authenticated
  using ((is_admin() OR is_prof() OR (lower(email) = lower(auth.email()))));
create policy qcm_signalements_update on public.qcm_signalements
  as permissive for update to authenticated
  using ((is_admin() OR is_prof()))
  with check ((is_admin() OR is_prof()));

-- public.ressources : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'ressources' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy ressources_admin_writes on public.ressources
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy ressources_select_all on public.ressources
  as permissive for select to authenticated
  using (true);

-- public.settings : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'settings' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy settings_admin_writes on public.settings
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy settings_select_all on public.settings
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.signalements_app : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'signalements_app' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy signalements_app_delete on public.signalements_app
  as permissive for delete to authenticated
  using (( SELECT is_founder() AS is_founder));
create policy signalements_app_select on public.signalements_app
  as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_founder() AS is_founder)));

-- public.signalements_app_captures : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'signalements_app_captures' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy signalements_app_captures_select on public.signalements_app_captures
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM signalements_app s
  WHERE ((s.id = signalements_app_captures.signalement_id) AND ((s.user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_founder() AS is_founder))))));

-- public.stagiaires : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'stagiaires' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy stagiaires_admin_writes on public.stagiaires
  as permissive for all to public
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy stagiaires_select_all on public.stagiaires
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));

-- public.stagiaires_prive : 1 règle
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'stagiaires_prive' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy stagiaires_prive_select on public.stagiaires_prive
  as permissive for select to authenticated
  using (((EXISTS ( SELECT 1
   FROM stagiaires s
  WHERE ((s.id = stagiaires_prive.stagiaire_id) AND (s.promo_id = ( SELECT promo_courante() AS promo_courante))))) AND (( SELECT is_admin() AS is_admin) OR ( SELECT is_prof() AS is_prof) OR (stagiaire_id = ( SELECT my_stagiaire_id() AS my_stagiaire_id)))));

-- public.themes : 2 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'themes' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy themes_admin_writes on public.themes
  as permissive for all to public
  using (is_admin())
  with check (is_admin());
create policy themes_select_all on public.themes
  as permissive for select to authenticated
  using (true);

-- public.themes_progression : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'themes_progression' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy themes_progression_delete on public.themes_progression
  as permissive for delete to authenticated
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy themes_progression_insert on public.themes_progression
  as permissive for insert to authenticated
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));
create policy themes_progression_select on public.themes_progression
  as permissive for select to authenticated
  using ((promo_id = ( SELECT promo_courante() AS promo_courante)));
create policy themes_progression_update on public.themes_progression
  as permissive for update to authenticated
  using ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))))
  with check ((is_admin() AND (promo_id = ( SELECT promo_courante() AS promo_courante))));

-- public.user_profiles : 4 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename = 'user_profiles' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy "user_profiles delete admin" on public.user_profiles
  as permissive for delete to public
  using ((is_admin() AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))))));
create policy "user_profiles insert admin" on public.user_profiles
  as permissive for insert to public
  with check ((is_admin() AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))))));
create policy "user_profiles update admin" on public.user_profiles
  as permissive for update to public
  using ((is_admin() AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))))))
  with check ((is_admin() AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))))));
create policy user_profiles_select_authenticated on public.user_profiles
  as permissive for select to authenticated
  using (((lower(email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))) OR ((stagiaire_id IS NULL) AND ((role <> 'stagiaire'::text) OR ( SELECT is_admin() AS is_admin))) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante))))));

-- L'étape 3 retire l'insertion et la modification de user_profiles à anon et authenticated
-- (fonctions serveur seulement) : on les redonne.
grant insert, update on public.user_profiles to anon, authenticated;

-- storage.objects : 6 règles
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;

create policy cours_images_ecriture on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = 'cours-images'::text) AND (is_admin() OR is_prof())));
create policy cours_images_lecture on storage.objects
  as permissive for select to public
  using ((bucket_id = 'cours-images'::text));
create policy qcm_images_admin_delete on storage.objects
  as permissive for delete to authenticated
  using (((bucket_id = 'qcm-images'::text) AND is_admin()));
create policy qcm_images_admin_insert on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = 'qcm-images'::text) AND is_admin()));
create policy qcm_images_admin_update on storage.objects
  as permissive for update to authenticated
  using (((bucket_id = 'qcm-images'::text) AND is_admin()))
  with check (((bucket_id = 'qcm-images'::text) AND is_admin()));
create policy qcm_images_read on storage.objects
  as permissive for select to anon, authenticated
  using ((bucket_id = 'qcm-images'::text));
