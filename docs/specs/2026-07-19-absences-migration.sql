-- Marquage des absences de dernière minute sur les cartes planning
-- (spec 2026-07-19-absences-comptage-placement-design.md, §3).
-- Format : [{ "sid": <id stagiaire absent>, "rid": <id remplaçant | null> }, ...]
-- La personne prévue RESTE dans son champ de rôle ; sid s'y réfère.
-- Application PROD : Task 8 uniquement (MCP apply_migration, nom add_absences_planning_entries).
ALTER TABLE planning_entries
  ADD COLUMN IF NOT EXISTS absences jsonb NOT NULL DEFAULT '[]'::jsonb;
