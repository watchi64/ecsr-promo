-- Marche arrière de 20261108_espaces_1_siege.sql (lot 5, étape 1) : retire les deux fonctions et la colonne.
-- La séquence de lieux.id, recalée par la migration, n'est pas remise en arrière : elle suit le plus grand identifiant
-- et ne gêne aucun ajout. Après ce retour, tests/sql/roles-empreinte.sql redonne l'empreinte d'avant la migration.
set local lock_timeout = '3s';

drop function if exists public.creer_centre(text);
drop function if exists public.comptes_reseau();
alter table public.lieux drop column if exists demonstration;
