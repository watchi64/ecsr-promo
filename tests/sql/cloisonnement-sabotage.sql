-- Contre-épreuve du cloisonnement (mode cloisonnement-sabotage, outils/assembler_repetition_roles.mjs) : une règle volontairement
-- relâchée, posée après l'étape 2c, qui rend les fiches profs lisibles par tout compte connecté. La preuve doit rougir sur les groupes
-- planning et matrice, et seulement eux. Défaite par tests/sql/cloisonnement-sabotage-retour.sql avant le retour de l'étape 2c.
-- Jamais jouée hors de la preuve (la transaction de la preuve est toujours annulée).
create policy sabotage_profs_lisibles on public.profs for select to authenticated using (true);
