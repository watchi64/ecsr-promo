-- Cloisonnement par organisme : empreinte md5 du corps de chaque fonction de l'inventaire (spec 2026-11-27, § 5.2 et § 5.3), pour que
-- chaque migration du chantier puisse garder son create or replace par une garde « le corps actuel est celui-ci » (une fonction
-- changée entre-temps, par une autre migration, arrête la migration au lieu d'être écrasée en silence).
-- Règle de l'inventaire (complétude par construction) : la liste nommée ci-dessous (§ 5.2 et § 5.3), plus TOUTE fonction du schéma public
-- dont le corps (prosrc) mentionne fondateur_reel, est_fondateur, is_founder, peut_gerer_qualite, est_siege, case_reseau, geste_reseau,
-- siege_fixe, est_formateur, est_direction ou peut_acceder_promo (les fonctions que le bornage complet du fondateur remplacera),
-- plus toutes les effacer_* et _effacer_*. `regler_titres_ouverts` (le verrou titres_ouverts) et les fonctions de `signalements_app`
-- restent globales selon la spec ; elles figurent dans la sortie pour leur md5 quand le corps les désigne, sans être bornées.
-- Sortie : une ligne `nom(signature)|md5` par fonction ; `nom|ABSENTE` pour un nom de la liste nommée qui n'existe pas encore
-- (les fonctions que le chantier crée : organisme_*, fondateur_sur, est_siege_de...). L'empreinte est celle du corps (prosrc)
-- privé des retours chariot, comme les autres preuves (un fichier CRLF et un fichier LF donnent la même empreinte).
-- Lecture seule. À jouer sur la base locale rejouée par `rejouer_suite.sh --production-2711`, jamais sur la production sans accord :
--   psql -h 127.0.0.1 -p 55447 -U postgres -d postgres -X -q -A -t -f tests/sql/cloisonnement-empreinte-corps.sql
--
-- Sortie de départ, état de la production du 27/11 (base locale `--production-2711`, 41 migrations) :
-- @@SORTIE@@
with inventaire(nom) as (
  values
  -- 5.2 vocabulaire : les fonctions du chantier (absentes au départ) et les prédicats qu'il borne
  ('organisme_de_lieu'), ('organisme_de_promo'), ('organisme_actif_fondateur'), ('fondateur_sur'), ('organisme_courant'),
  ('est_siege_de'), ('organisme_redacteur_courant'),
  ('fondateur_reel'), ('est_fondateur'), ('is_founder'), ('est_formateur'), ('est_direction'), ('est_siege'), ('peut_acceder_promo'),
  ('mes_promos'), ('promo_par_defaut'), ('peut_gerer_qualite'), ('lieu_courant'), ('is_admin'),
  -- 5.3 siège
  ('comptes_reseau'), ('creer_centre'), ('regler_habillage_reseau'), ('habillage_par_defaut'), ('inviter_compte'),
  ('roles_du_personnel'),
  -- 5.3 titres
  ('siege_fixe'), ('case_reseau'), ('case_centre'), ('case_promo'), ('geste_reseau'), ('geste_centre'), ('geste_promo'),
  ('_cases_appelant'), ('_refus_titre'), ('_refus_gestion'), ('donner_titre'), ('retirer_titre'), ('creer_titre'),
  ('ajuster_titre'), ('supprimer_titre'), ('titres_visibles'), ('titres_ajustables'), ('personnes_et_titres'),
  ('journal_des_droits'), ('effacer_adresse_journal'),
  -- 5.3 annuaire
  ('_contact_compte_equipe'), ('_contact_avant_ecriture'), ('_contact_fiche_dans'), ('annuaire_centre'),
  ('_contact_relais_possibles'), ('ma_fiche_contact'),
  -- 5.2 qualité et conservation
  ('etat_conservation'), ('clore_annee_formateurs'),
  -- 5.3 déjà bornées à la promo ou au centre (ne doivent pas changer)
  ('epcf_moyennes'), ('notes_stats_groupe')
), cibles as (
  select nom from inventaire
  union
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'effacer\_%' or p.proname like '\_effacer\_%'
    or p.prosrc ~ '(fondateur_reel|est_fondateur|is_founder|peut_gerer_qualite|est_siege|case_reseau|geste_reseau|siege_fixe|est_formateur|est_direction|peut_acceder_promo)')
)
select coalesce(f.sig, c.nom || '|ABSENTE') as ligne
from cibles c
left join lateral (
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || md5(replace(p.prosrc, chr(13), '')) as sig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = c.nom
) f on true
order by 1;
