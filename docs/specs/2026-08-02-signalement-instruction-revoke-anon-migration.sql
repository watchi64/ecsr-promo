-- Défense en profondeur : anon n'a aucune raison de toucher la table d'instruction.
-- RLS la protège déjà (aucune politique d'écriture, donc tout est refusé), mais les
-- privilèges par défaut du schéma laissent des GRANT de table inutiles.
-- Même durcissement que la migration revoke_anon_on_dp_dossiers du 2026-07-30.
revoke all on public.qcm_signalement_instruction from anon;
