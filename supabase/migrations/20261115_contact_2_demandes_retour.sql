-- Marche arrière de 20261115_contact_2_demandes.sql (espace contact, migration 2 ; partie A pour l'instant).
--   * Parties C puis B (tâches 10 et 9) : défaites ici d'abord, quand elles existeront (repères plus bas).
--   * Partie A : fonctions de l'app et aides internes retirées ; déclencheur lieux_reponses_defaut retiré ; tables contact_jetons,
--     contact_envois, demande_messages, demande_destinataires, demandes, contact_regles et contact_reponses supprimées, avec ce
--     qu'elles portaient : un avis en donne le nombre de lignes, sans aucun nom ni texte.
--   Aucun droit n'est rendu (les tables n'en donnaient aucun à anon ni authenticated ; TRUNCATE en particulier n'est jamais rendu).
-- Garde d'ordre : refusée si la migration 3 est appliquée (public.absences_annoncees existe). Garde d'entrée : la migration 2 est
-- appliquée (public.ecrire_au_centre existe). Sinon rien ne change.
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'ecrire_au_centre') then
    raise exception 'contact_2_retour : la migration 2 n''est pas appliquée (ecrire_au_centre est absente) ; rien n''est changé';
  end if;
  if to_regclass('public.absences_annoncees') is not null
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'absences_annoncees') then
    raise exception 'contact_2_retour : la migration 3 est appliquée (absences_annoncees existe), la défaire d''abord ; rien n''est changé';
  end if;
end $garde$;

-- ===== Partie C (tâche 10) : à défaire ici =====

-- ===== Partie B (tâche 9) : à défaire ici =====

-- ===== Partie A =====
do $avis$
begin
  raise notice 'contact_2_retour : supprimées : % demande(s), % destinataire(s), % réponse(s) écrite(s), % règle(s), % réponse(s) toute(s) faite(s), % envoi(s), % jeton(s)',
    (select count(*) from public.demandes), (select count(*) from public.demande_destinataires), (select count(*) from public.demande_messages),
    (select count(*) from public.contact_regles), (select count(*) from public.contact_reponses), (select count(*) from public.contact_envois),
    (select count(*) from public.contact_jetons);
end $avis$;

drop function public.destinataires_possibles(text, jsonb);
drop function public.apercu_envoi(text, jsonb);
drop function public.ecrire_au_centre(text, text, text, bigint[]);
drop function public.ecrire_a(bigint, text, text, text);
drop function public.ecrire_au_stagiaire(integer, text, text);
drop function public._contact_creer(integer, integer, integer, bigint, text, text, text, text, jsonb);
drop function public._contact_purger();
drop function public._contact_quota(integer);
drop function public._contact_texte(text);
drop function public._contact_sujet(text);
drop function public._contact_fiche_equipe(integer);
drop function public._contact_stagiaire();
drop function public._contact_nom_stagiaire(integer);
drop function public._contact_possibles(integer, integer, jsonb);
drop function public._contact_destinataires(integer, integer, text, bigint, jsonb);
drop function public._contact_formateurs_du_jour(integer, integer, jsonb);
drop function public._contact_direction_reelle_de(text, integer);
drop function public._contact_disponible(public.contacts, integer, date);
drop function public._contact_nom_fiche(public.contacts, integer);
drop function public._contact_jours(text, jsonb, integer);
drop function public._contact_demi_courante(integer);
drop function public._contact_jour();
drop function public._contact_maintenant();
drop trigger lieux_reponses_defaut on public.lieux;
drop function public._contact_reponses_defaut();
drop function public._contact_poser_reponses(integer);
drop table public.contact_jetons;
drop table public.contact_envois;
drop table public.demande_messages;
drop table public.demande_destinataires;
drop table public.demandes;
drop table public.contact_regles;
drop table public.contact_reponses;

-- Contrôle de fin : plus rien de la partie A.
do $controle$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('destinataires_possibles', 'apercu_envoi', 'ecrire_au_centre', 'ecrire_a', 'ecrire_au_stagiaire',
                               '_contact_maintenant', '_contact_jour', '_contact_destinataires', '_contact_possibles',
                               '_contact_direction_reelle_de', '_contact_stagiaire'))
     or to_regclass('public.demandes') is not null or to_regclass('public.contact_regles') is not null
     or to_regclass('public.contact_reponses') is not null then
    raise exception 'contact_2_retour : il reste un objet de la migration 2 ; tout est annulé';
  end if;
end $controle$;
