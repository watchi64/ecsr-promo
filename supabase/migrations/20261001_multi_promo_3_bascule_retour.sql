-- Marche arrière de la bascule. Échoue si septembre a déjà une carte, un horaire, un jour
-- off, un prénom ou une clé de réglage qui existe aussi en mars : corriger en avant.
alter table public.settings           drop constraint if exists settings_pkey;
alter table public.settings           add constraint settings_pkey primary key (key);
alter table public.stagiaires         add constraint stagiaires_prenom_key unique (prenom);
alter table public.planning_jours_off add constraint planning_jours_off_semaine_lundi_day_index_key
  unique (semaine_lundi, day_index);
alter table public.planning_half_meta add constraint planning_half_meta_semaine_lundi_day_index_half_day_key
  unique (semaine_lundi, day_index, half_day);
alter table public.planning_entries   add constraint planning_entries_unique
  unique (semaine_lundi, day_index, half_day, slot, lane);
