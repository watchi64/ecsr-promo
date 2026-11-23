-- EPCF du CCP2 (demande de Timy du 23/11/2026) : la colonne trame accepte une troisième grille, « ccp2 », à côté de
-- « salle » et « vehicule » (CCP1). La grille elle-même vit dans js/epcf-trames.js (critères de performance des
-- compétences 8 à 11 du REAC) ; la base ne connaît que son nom. Règles d'accès, moyennes de la classe
-- (epcf_moyennes, qui prend la trame en paramètre) et k-anonymat inchangés.
-- Preuve : tests/sql/epcf-ccp2-preuve.sql. Retour : 20261123_epcf_ccp2_retour.sql.

set local lock_timeout = '3s';

alter table public.epcf_evaluations drop constraint if exists epcf_evaluations_trame_check;
alter table public.epcf_evaluations add constraint epcf_evaluations_trame_check
  check (trame = any (array['salle'::text, 'vehicule'::text, 'ccp2'::text]));
