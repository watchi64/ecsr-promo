-- Marche arrière de 20261028_roles_1_fondations.sql (étape 1 du lot 4 : table des affectations et vocabulaire des
-- rôles). Supprime la table affectations (ses règles, ses index, ses droits, sa séquence et l'amorce partent avec
-- elle), puis les douze fonctions du vocabulaire.
-- Aucun cascade : si une étape suivante dépend encore de la table ou d'une fonction par un lien que PostgreSQL
-- enregistre (règle, vue, valeur par défaut), la suppression échoue au lieu d'emporter ce qui en dépend. Le corps
-- d'une fonction écrit en texte (comme ici et à l'étape 2) n'enregistre pas ses appels : l'ordre des retours reste
-- donc obligatoire, et l'empreinte le contrôle.
-- À passer après 20261028_roles_3_regles_retour.sql et 20261028_roles_2_fonctions_retour.sql.
-- Contrôle : après les retours 3, 2 et 1, tests/sql/roles-empreinte.sql redonne l'empreinte relevée juste avant
-- d'appliquer le lot (ou au début du bloc de répétition). Les valeurs de référence du 28/10 ne valent que tant que la
-- production n'a pas bougé : une migration passée depuis les change, sans que le lot soit en cause.
set local lock_timeout = '3s';

drop table public.affectations;

drop function public.redacteur_contenus();
drop function public.equipe_courante();
drop function public.direction_courante();
drop function public.formateur_courant();
drop function public.lieu_de_promo(integer);
drop function public.roles_reels(integer);
drop function public.est_siege();
drop function public.est_direction(integer);
drop function public.est_formateur(integer);
drop function public.est_fondateur();
drop function public.apercu_role();
drop function public.fondateur_reel();
