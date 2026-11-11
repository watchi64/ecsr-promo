-- Marche arrière de 20261112_titres_6_gestion.sql : défait les parties dans l'ordre inverse (D, C, B, A). Après ce retour, la base est dans
-- l'état d'avant la migration (empreinte des règles, des fonctions et des droits identique). Les titres non fixes, leur verrou et les
-- versions de centre créés entre-temps ne sont pas défaits : la ligne du verrou est effacée, les titres restent (une table que la
-- migration 1 a créée) ; seul le retour 1 les efface.
set local lock_timeout = '3s';

-- A. Le verrou et les aides de décision : les fonctions disparaissent, la ligne du verrou est effacée (la contrainte d'avant ne
-- l'admettrait plus) et la contrainte des réglages globaux est celle de 20261108_espaces_3_habillage.sql.
drop function if exists public._refus_titre(bigint, integer, text, text);
drop function if exists public._cases_appelant(text, integer);
drop function if exists public._depasse(jsonb, jsonb);
drop function if exists public._cases_effectives(bigint);
drop function if exists public.regler_titres_ouverts(boolean);
drop function if exists public.titres_ouverts();
delete from public.settings where promo_id is null and key = 'titres_ouverts';
alter table public.settings drop constraint if exists settings_globaux_prevus;
alter table public.settings add constraint settings_globaux_prevus
  check (promo_id is not null or key in ('chatbot_quota_jour', 'cohort_name', 'password_hash', 'habillage_reseau'));
