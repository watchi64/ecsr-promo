-- Schéma minimal pour jouer la preuve du registre qualité (tests/sql/registre-qualite-preuve.sql) sur une base Postgres
-- LOCALE jetable (jamais en prod). Reprend de la prod ce dont 20261109_registre_qualite.sql dépend :
--   1. Le schéma minimal des questionnaires (tests/sql/questionnaires-schema-minimal.sql), chargé tel quel : rôles
--      Supabase, auth.users, auth.jwt() / auth.uid(), lieux, promos, stagiaires, user_profiles, et le lot 4 (étape 1
--      rejouée, quatre fonctions de l'étape 2 extraites du fichier ; voir son en-tête).
--   2. Ce que lit signaler_probleme() et qui manque au point 1 : la table profs (id, nom) et user_profiles.prof_id
--      (supabase/migrations/20261028_signalements_app.sql, ligne 122).
--   3. Les deux migrations en production dont dépend le registre, rejouées telles quelles :
--      20261028_signalements_app.sql (signalements_app, signaler_probleme et sa purge à 12 mois) et
--      20261108_questionnaires.sql (peut_gerer_qualite(), que le registre lit sans la recréer).
-- Lancement (psql lit les fichiers par \ir, le serveur lit l'étape 2 du lot 4 par pg_read_file : superutilisateur
-- local) :
--   psql -p <port> -U postgres -d rq -v ON_ERROR_STOP=1 \
--        -v lot4_fonctions=<chemin absolu de supabase/migrations/20261028_roles_2_fonctions.sql> \
--        -f tests/sql/registre-qualite-schema-minimal.sql
-- Puis la preuve : voir l'en-tête de tests/sql/registre-qualite-preuve.sql.

-- 1. Le schéma minimal des questionnaires (il exige -v lot4_fonctions) ---------------------------------------------
\ir questionnaires-schema-minimal.sql

-- 2. Ce que lit signaler_probleme() -----------------------------------------------------------------------------------
create table public.profs (id serial primary key, nom text not null);
alter table public.user_profiles add column prof_id integer references public.profs(id);

-- 3. Les deux migrations en production, rejouées telles quelles ----------------------------------------------------
\ir ../../supabase/migrations/20261028_signalements_app.sql
\ir ../../supabase/migrations/20261108_questionnaires.sql
