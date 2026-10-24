-- Retour de 20261023_emargement.sql : supprime les feuilles d'émargement, leurs signatures et
-- les fonctions. ATTENTION : efface toutes les signatures recueillies (preuves d'assiduité).
set local lock_timeout = '3s';

drop function if exists public.emargement_rouvrir(bigint);
drop function if exists public.emargement_clore(bigint);
drop function if exists public.emargement_annoter(bigint, integer, boolean, text);
drop function if exists public.emargement_signer_formateur(bigint, text, text);
drop function if exists public.emargement_signer(bigint, integer, text);
drop function if exists public.emargement_ouvrir(text, text, text);
drop function if exists public.emargement_feuille(bigint, boolean);
drop function if exists public.emargement_trace_valide(text);
drop function if exists public.emargement_jour_paris();
drop table if exists public.emargement_formateurs;
drop table if exists public.emargement_lignes;
drop table if exists public.emargement_seances;
drop function if exists public.emargement_signature_figee();
