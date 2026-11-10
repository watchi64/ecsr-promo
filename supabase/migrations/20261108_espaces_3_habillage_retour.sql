-- Marche arrière de 20261108_espaces_3_habillage.sql (lot 5, étape 3) : retire les trois fonctions et les deux colonnes,
-- efface la ligne globale « habillage_reseau » (la contrainte d'avant ne l'admet plus) et remet la contrainte d'origine.
-- L'habillage par défaut du centre et du réseau est perdu ; le choix de chaque personne (user_profiles.habillage, lot 3)
-- n'est pas touché. Après ce retour, tests/sql/roles-empreinte.sql redonne l'empreinte d'avant la migration.
set local lock_timeout = '3s';

drop function if exists public.regler_habillage_reseau(text);
drop function if exists public.regler_habillage_centre(integer, text, boolean);
drop function if exists public.habillage_par_defaut();
delete from public.settings where promo_id is null and key = 'habillage_reseau';
alter table public.settings drop constraint if exists settings_globaux_prevus;
alter table public.settings add constraint settings_globaux_prevus
  check (promo_id is not null or key in ('chatbot_quota_jour', 'cohort_name', 'password_hash'));
alter table public.lieux drop column if exists habillage_libre;
alter table public.lieux drop column if exists habillage;
