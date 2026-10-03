-- Multi-promo, bascule (étape 3), à appliquer APRÈS la mise en ligne de la nouvelle
-- version : les anciennes unicités sans promo disparaissent, septembre peut écrire son
-- planning et ses réglages. Une version ancienne de l'app ne sait plus enregistrer le
-- planning ni les réglages ensuite (erreur visible) : prévenir les formateurs.
-- Marche arrière : 20261001_multi_promo_3_bascule_retour.sql
-- Un verrou qui tarde fait échouer la migration (rien n'est appliqué, on relance) au lieu de
-- faire attendre l'app derrière elle.
set local lock_timeout = '3s';
alter table public.planning_entries   drop constraint if exists planning_entries_unique;
alter table public.planning_half_meta drop constraint if exists planning_half_meta_semaine_lundi_day_index_half_day_key;
alter table public.planning_jours_off drop constraint if exists planning_jours_off_semaine_lundi_day_index_key;
alter table public.stagiaires         drop constraint if exists stagiaires_prenom_key;
alter table public.settings           drop constraint if exists settings_pkey;
alter table public.settings           add constraint settings_pkey primary key (id);
