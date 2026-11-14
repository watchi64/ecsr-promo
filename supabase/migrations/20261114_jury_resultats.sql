-- Résultats du jury du titre professionnel : une ligne par stagiaire, pour le taux d'obtention du titre (tableau de bord du centre,
-- Vue d'ensemble de la direction, fiche résultats Qualiopi). Décisions de Timy du 14/11 (« Oui, les quatre ») :
--   1. saisie par stagiaire : date de la session et un résultat parmi quatre (titre obtenu, validation partielle avec le CCP acquis,
--      non obtenu, absent) ;
--   2. saisit qui saisit les notes (geste notes.saisir), lit qui lit les notes (geste notes.lire) ; le stagiaire ne lit rien, pas même
--      sa ligne (le jury lui notifie son résultat) ; le siège ne lit rien (il n'affiche aucune promo) ;
--   3. taux = titres obtenus / stagiaires présentés au jury (absents exclus) : calculé par l'app (js/centre-stats.js), pas ici ;
--   4. conditions d'utilisation : la ligne « Résultats » et une ligne de « Qui voit quoi » partent avec la version regroupée de l'étape 4
--      des titres, sans nouvelle acceptation d'ici là.
-- Une ligne par stagiaire (clé stagiaire_id) : le dernier passage devant le jury. Un rattrapage remplace la ligne.
-- Aucun texte libre, aucun auteur nominatif : la conservation (Q5) et l'effacement à la demande n'ont rien à y effacer. Le résultat
-- reste trois ans comme les autres résultats, puis sans nom quand la fiche est anonymisée ; une fiche supprimée emporte sa ligne
-- (on delete cascade, comme les notes).
-- Promo de la ligne : celle de la fiche, imposée par le déclencheur commun imposer_promo_du_stagiaire (comme evaluations).
-- Écriture directe par l'API (upsert de l'app), sous les règles ci-dessous ; la base refuse une date hors de 2020 à 2100 et une
-- validation partielle sans exactement un CCP acquis.
-- Garde : la table ne doit pas exister ; le déclencheur commun et les gestes doivent exister.
-- Marche arrière : 20261114_jury_resultats_retour.sql. Preuve : tests/sql/jury-preuve.sql (outils/assembler_preuve_jury.mjs).
set local lock_timeout = '3s';

do $garde$
begin
  if to_regclass('public.jury_resultats') is not null then
    raise exception 'jury_resultats : la table existe déjà, migration déjà appliquée ?';
  end if;
  if to_regprocedure('public.imposer_promo_du_stagiaire()') is null then
    raise exception 'jury_resultats : le déclencheur imposer_promo_du_stagiaire est absent';
  end if;
  if to_regprocedure('public.geste_promo(integer, text)') is null then
    raise exception 'jury_resultats : la fonction geste_promo (chantier des titres) est absente';
  end if;
end $garde$;

create table public.jury_resultats (
  stagiaire_id integer primary key references public.stagiaires(id) on delete cascade,
  promo_id integer not null references public.promos(id),
  session_le date not null check (session_le between date '2020-01-01' and date '2100-12-31'),
  resultat text not null check (resultat in ('obtenu', 'partiel', 'non_obtenu', 'absent')),
  ccp1 boolean not null default false,
  ccp2 boolean not null default false,
  saisi_le timestamptz not null default now(),
  check ((resultat = 'partiel') = (ccp1 <> ccp2)),
  check (resultat = 'partiel' or not (ccp1 or ccp2))
);
create index jury_resultats_promo_idx on public.jury_resultats (promo_id);

create trigger trg_promo_du_stagiaire before insert or update on public.jury_resultats
  for each row execute function public.imposer_promo_du_stagiaire();

alter table public.jury_resultats enable row level security;
revoke all on public.jury_resultats from public, anon, authenticated;
grant select, insert, update, delete on public.jury_resultats to authenticated;

create policy jury_resultats_lecture on public.jury_resultats for select to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.lire')));

create policy jury_resultats_ecriture on public.jury_resultats for all to authenticated
  using (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')))
  with check (promo_id = (select public.promo_courante()) and (select public.geste_promo((select public.promo_courante()), 'notes.saisir')));
