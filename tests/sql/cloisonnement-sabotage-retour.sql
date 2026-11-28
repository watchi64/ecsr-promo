-- Défait la règle relâchée de tests/sql/cloisonnement-sabotage.sql (mode cloisonnement-sabotage), avant le retour de l'étape 2c :
-- l'empreinte jugée par le groupe retour redevient celle d'avant les migrations.
drop policy sabotage_profs_lisibles on public.profs;
