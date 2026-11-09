-- Retour de 20261108_questionnaires.sql : les fonctions, puis les tables (réponses, participations et ouvertures
-- partent avec elles), puis le droit de gestion de la qualité. Aucun autre objet n'est touché.
-- Si un lot suivant (Q4, Q5) s'appuie déjà sur peut_gerer_qualite(), le retirer avant de jouer ce retour.
drop function if exists public.ouvrir_questionnaire(text, jsonb, boolean);
drop function if exists public.commentaires_questionnaire(text, jsonb);
drop function if exists public.resultats_questionnaire(text, jsonb);
drop function if exists public.repondre_questionnaire(text, jsonb, integer, jsonb, text);
drop function if exists public.questionnaires_a_remplir();
drop function if exists public._questionnaire_ouvert(text, integer, integer, integer);
drop function if exists public._questionnaire_fenetre(text, date);
drop function if exists public._questionnaire_ayant_droit(text, integer, integer);
drop function if exists public._questionnaire_portee(text, jsonb);
drop function if exists public._questionnaire_version(text);
drop function if exists public._questionnaire_seuil(text);
drop function if exists public._questionnaire_public(text);
drop function if exists public._questionnaire_jour();
drop table if exists public.questionnaire_reponses;
drop table if exists public.questionnaire_participations;
drop table if exists public.questionnaire_ouvertures;
drop table if exists public.questionnaire_questions;
drop function if exists public.peut_gerer_qualite();
