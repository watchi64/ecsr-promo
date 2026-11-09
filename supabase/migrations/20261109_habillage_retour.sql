-- Retour de 20261109_habillage.sql : la fonction d'abord (elle écrit dans la colonne), puis la colonne.
-- Le choix d'habillage gardé sur l'appareil n'est pas touché ; seule la copie sur le compte disparaît.

drop function if exists public.set_my_habillage(text);
alter table public.user_profiles drop column if exists habillage;
