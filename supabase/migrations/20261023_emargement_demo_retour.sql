-- Retour de 20261023_emargement_demo.sql : retire les feuilles d'émargement fictives de la promo de
-- démonstration (id 7), son en-tête et son interrupteur. Lignes et signatures suivent la suppression
-- des feuilles.
set local lock_timeout = '3s';

delete from public.emargement_seances where promo_id = 7;
delete from public.settings where promo_id = 7 and key in ('emargement_entete', 'emargement_actif');
