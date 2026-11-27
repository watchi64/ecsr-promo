-- Cloisonnement par organisme : empreinte md5 du corps de chaque fonction de l'inventaire (spec 2026-11-27, § 5.2 et § 5.3), pour que
-- chaque migration du chantier puisse garder son create or replace par une garde « le corps actuel est celui-ci » (une fonction
-- changée entre-temps, par une autre migration, arrête la migration au lieu d'être écrasée en silence).
-- Sortie : une ligne `nom(signature)|md5` par fonction ; `nom|ABSENTE` pour un nom de l'inventaire qui n'existe pas encore
-- (les fonctions que le chantier crée : organisme_*, fondateur_sur, est_siege_de...). L'empreinte est celle du corps (prosrc)
-- privé des retours chariot, comme les autres preuves (un fichier CRLF et un fichier LF donnent la même empreinte).
-- Lecture seule. À jouer sur la base locale rejouée par `rejouer_suite.sh --production-2711`, jamais sur la production sans accord :
--   psql -h 127.0.0.1 -p 55447 -U postgres -d postgres -X -q -A -t -f tests/sql/cloisonnement-empreinte-corps.sql
--
-- Sortie de départ, état de la production du 27/11 (base locale `--production-2711`, 41 migrations) :
--   _cases_appelant(p_niveau text, p_lieu_id integer)|c6573357160d5fe1c2e4625e972af14f
--   _contact_avant_ecriture()|4d3063d4385706142c250b2c667d2d77
--   _contact_compte_equipe()|ccc518f8ace92a25097a3474f6bbe805
--   _contact_fiche_dans(c contacts, l integer)|2f962cb7b9080259b8bb5e7fdacc9dbd
--   _contact_relais_possibles(p_email text)|a5d5935c97a7427a25bbd768fd36dbcf
--   _refus_gestion(p_niveau text, p_lieu_id integer, p_cases jsonb)|bf980228d24af834235454eee2e7c170
--   _refus_titre(p_titre_id bigint, p_lieu_id integer, p_cible text, p_action text, OUT etat text, OUT phrase text)|63c4cb800d8dd8a5aa8166a7eaafafb0
--   ajuster_titre(p_titre_id bigint, p_lieu_id integer, p_nom text, p_cases jsonb)|e6f3e7df3365ce9194e547bd157dda65
--   annuaire_centre()|9c715c63764095643164ba01c67aff7a
--   case_centre(l integer, p_page text)|e58ca5c12442fa9bc542f4f50e3f2a67
--   case_promo(p integer, p_page text)|6813c2590ca70b7ba6f29b74a3c5d23b
--   case_reseau(p_page text)|b391fab933133cb95e5c9660b50e09c5
--   clore_annee_formateurs(p_lieu integer, p_annee integer)|02191250df20a8063a756ac4e51ad158
--   comptes_reseau()|8ae4d15b047be60a41262f71588d9c6e
--   creer_centre(p_nom text)|4e9d0c1d5ca2f3b5eb4d337298a52f4f
--   creer_titre(p_depuis bigint, p_nom text, p_lieu_id integer)|3e3fd1f08b778808ee74b32ae5254d0e
--   donner_titre(p_email text, p_titre_id bigint, p_lieu_id integer, p_promo_ids integer[], p_prof_id integer)|27a8bf6ec0d2a25cbd3685a68ab3c7cd
--   effacer_adresse_journal(p_email text)|d8f34687359c635bac30c1e6511fa2b0
--   effacer_commentaires_formateurs(p_lieu integer, p_annee integer)|e8f5ef16dfa63768a397d206b7f8104f
--   effacer_promo_etape1(p_promo integer)|6e0a9f1a9aa03e2bac0d386f187cc7ef
--   effacer_promo_etape2(p_promo integer)|f75ec7edf416aaa0980449b8c96f8c8e
--   effacer_registre_qualite()|597b3ce90c81b7b0bbe9a1dd2bcfe404
--   effacer_sur_demande(p_stagiaire_id integer)|c0bf12d08a11f96cfa5f618dfdedc52e
--   epcf_moyennes(p_trame text)|07397828cd6472ce99cc65d9773ed812
--   est_direction(l integer)|dfa48397194177014a8ed6c76f963ff9
--   est_fondateur()|87f35299949ab3db2d8c686e4665f263
--   est_formateur(p integer)|5918683c9b989897f178d8678538cf3c
--   est_siege()|2d3e4bde728f661ca100c27eaed213e0
--   est_siege_de|ABSENTE
--   etat_conservation()|9afef22527ac8f7c84b5cd0c6f443ee4
--   fondateur_reel()|c275a072a60fafffbab944893dd500cf
--   fondateur_sur|ABSENTE
--   geste_centre(l integer, p_geste text)|14cc691cf0d9049e9c9a052140372da4
--   geste_promo(p integer, p_geste text)|195a0bf62a5b9b73c66ac9d9ea1dcc9d
--   geste_reseau(p_geste text)|d746b4c94ef274ea02fbf281d10e5b89
--   habillage_par_defaut()|dee4765b89c9172ab8f3ecd29214e156
--   inviter_compte(p_email text, p_role text, p_stagiaire_id integer, p_prof_id integer, p_lieu_id integer)|24f821676b1f684032daa933d4e1c047
--   is_admin()|2714cd66c76a003b4862c15dc9e0b6d6
--   journal_des_droits(p_lieu_id integer)|17963970c02087faf44700ca0b27a2fc
--   lieu_courant()|d236b2e6184caecd392e5962511c82dc
--   ma_fiche_contact()|4e865d5f67243c0759ce6a9a307e8a1d
--   mes_promos()|b540f3a474efd33c6da96a43e98a9fd5
--   notes_stats_groupe()|1faaa0473e1488de3c8c0e5a05f440c5
--   organisme_actif_fondateur|ABSENTE
--   organisme_courant|ABSENTE
--   organisme_de_lieu|ABSENTE
--   organisme_de_promo|ABSENTE
--   organisme_redacteur_courant|ABSENTE
--   personnes_et_titres(p_lieu_id integer, p_promo_id integer)|a5591645b931f8ed98c9cb8cc52987fd
--   peut_acceder_promo(p integer)|0c90a1bcda2393f7d190838bf58a3f70
--   peut_gerer_qualite()|2526be6797c37034b1956fc026e93bbe
--   promo_par_defaut()|314acd28b779a8e4b2433c78f629332e
--   regler_habillage_reseau(p_habillage text)|06d644ff242e341696def1dad643725f
--   retirer_titre(p_email text, p_titre_id bigint, p_lieu_id integer)|d5c7744a979877f6901bb2b7e42f9144
--   roles_du_personnel()|6aebfdfadaf9bd6970241f560033a38c
--   siege_fixe()|039f4850e6b6faa010d5df1a0304dc5c
--   supprimer_titre(p_titre_id bigint)|6a4691b579d690515eeee7fb7c74f5c3
--   titres_ajustables(p_lieu_id integer)|bc6019c3f5767fdc9209899f811e0545
--   titres_visibles(p_lieu_id integer)|c2f054834867e2db46dbb9e5e50b9860
with inventaire(nom) as (
  values
  -- 5.2 vocabulaire : les fonctions du chantier (absentes au départ) et les prédicats qu'il borne
  ('organisme_de_lieu'), ('organisme_de_promo'), ('organisme_actif_fondateur'), ('fondateur_sur'), ('organisme_courant'),
  ('est_siege_de'), ('organisme_redacteur_courant'),
  ('fondateur_reel'), ('est_fondateur'), ('est_formateur'), ('est_direction'), ('est_siege'), ('peut_acceder_promo'),
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
  where n.nspname = 'public' and p.proname like 'effacer\_%'
)
select coalesce(f.sig, c.nom || '|ABSENTE') as ligne
from cibles c
left join lateral (
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || md5(replace(p.prosrc, chr(13), '')) as sig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = c.nom
) f on true
order by 1;
