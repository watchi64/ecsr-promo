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
--   _autonomie_stagiaire()|54bd2eab1403ed9546cde33fccfa387e
--   _cases_appelant(p_niveau text, p_lieu_id integer)|c6573357160d5fe1c2e4625e972af14f
--   _contact_avant_ecriture()|4d3063d4385706142c250b2c667d2d77
--   _contact_compte_equipe()|ccc518f8ace92a25097a3474f6bbe805
--   _contact_direction_reelle(l integer)|b30fd55559aeb37b04e2a48ea1c975c5
--   _contact_fiche_dans(c contacts, l integer)|2f962cb7b9080259b8bb5e7fdacc9dbd
--   _contact_relais_possibles(p_email text)|a5d5935c97a7427a25bbd768fd36dbcf
--   _contact_stagiaire()|259798f07e5cffc4cc0c73b9b7b3fba5
--   _effacer_etape1(p_id integer)|1c14551ba645f42d91d9cef2a8a1d850
--   _effacer_etape2(p_id integer)|a95848a0821e8d0cc4b17e1253d3d77a
--   _effacer_textes_libres(p_id integer)|6a4c50f20965838120bf9b069169f6a0
--   _orphelin_en_personnel(p_email text, p_admin boolean, p_prof_id integer, p_par text)|54f318e538b04e5895c7a369e232c2e1
--   _peut_conserver_promo(p_promo integer)|f8a60593723efd16d8e8785bd3f8caa8
--   _refus_gestion(p_niveau text, p_lieu_id integer, p_cases jsonb)|bf980228d24af834235454eee2e7c170
--   _refus_titre(p_titre_id bigint, p_lieu_id integer, p_cible text, p_action text, OUT etat text, OUT phrase text)|63c4cb800d8dd8a5aa8166a7eaafafb0
--   a_une_affectation(p_email text)|99b01188993c66efaa99615580acfef9
--   ajuster_titre(p_titre_id bigint, p_lieu_id integer, p_nom text, p_cases jsonb)|e6f3e7df3365ce9194e547bd157dda65
--   annuaire_centre()|9c715c63764095643164ba01c67aff7a
--   apercu_role()|20cda94e10ec18d8819e91f781a3b5b0
--   apercu_titre()|080e2f48cf473e2012f5d59444b0ac89
--   autonomie_opposer(p_stagiaire integer)|e6f98da007ba0ff9b0246417281bb797
--   case_centre(l integer, p_page text)|e58ca5c12442fa9bc542f4f50e3f2a67
--   case_promo(p integer, p_page text)|6813c2590ca70b7ba6f29b74a3c5d23b
--   case_reseau(p_page text)|b391fab933133cb95e5c9660b50e09c5
--   clore_annee_formateurs(p_lieu integer, p_annee integer)|02191250df20a8063a756ac4e51ad158
--   commentaires_questionnaire(p_cle text, p_portee jsonb)|e1c32dda810a19c4277a6978ffc65ae2
--   compter_signalements_app()|ebe02a4ea22eeeac2b48d13c5d315897
--   comptes_reseau()|8ae4d15b047be60a41262f71588d9c6e
--   creer_centre(p_nom text)|4e9d0c1d5ca2f3b5eb4d337298a52f4f
--   creer_titre(p_depuis bigint, p_nom text, p_lieu_id integer)|3e3fd1f08b778808ee74b32ae5254d0e
--   direction_courante()|0d2e43d51d4cff194569e21744edbf40
--   direction_fixe(l integer)|ea6724aa3010a32222ee39442e235f9e
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
--   etat_conservation_centre(p_lieu integer)|2785426a551869f0eaefd7a02efb1b65
--   fiches_effacees_sur_demande(p_promo_ids integer[])|02ef19faa63152b5b265f49c45a4a5d3
--   figer_questionnaire_formateurs(p_lieu integer, p_annee integer)|8747319fa06590e1e852929b43a6da4c
--   fondateur_reel()|c275a072a60fafffbab944893dd500cf
--   fondateur_sur|ABSENTE
--   formateur_courant()|65415f512c6d29a409e3708a59ab28f2
--   formateur_fixe(p integer)|6d16a8d31657cd2a1c8e8300fc3df31f
--   geste_centre(l integer, p_geste text)|14cc691cf0d9049e9c9a052140372da4
--   geste_promo(p integer, p_geste text)|195a0bf62a5b9b73c66ac9d9ea1dcc9d
--   geste_reseau(p_geste text)|d746b4c94ef274ea02fbf281d10e5b89
--   habillage_par_defaut()|dee4765b89c9172ab8f3ecd29214e156
--   inviter_compte(p_email text, p_role text, p_stagiaire_id integer, p_prof_id integer, p_lieu_id integer)|24f821676b1f684032daa933d4e1c047
--   is_admin()|2714cd66c76a003b4862c15dc9e0b6d6
--   is_founder()|2526be6797c37034b1956fc026e93bbe
--   journal_des_droits(p_lieu_id integer)|17963970c02087faf44700ca0b27a2fc
--   lieu_courant()|d236b2e6184caecd392e5962511c82dc
--   ma_fiche_contact()|4e865d5f67243c0759ce6a9a307e8a1d
--   membre_stagiaire(p integer)|dc7162627759c52ad3504ea5622c365a
--   mes_promos()|b540f3a474efd33c6da96a43e98a9fd5
--   notes_stats_groupe()|1faaa0473e1488de3c8c0e5a05f440c5
--   organisme_actif_fondateur|ABSENTE
--   organisme_courant|ABSENTE
--   organisme_de_lieu|ABSENTE
--   organisme_de_promo|ABSENTE
--   organisme_redacteur_courant|ABSENTE
--   ouvrir_questionnaire(p_cle text, p_portee jsonb, p_ouvert boolean)|132ef01a091fd771453fa2ae4fffa586
--   personnes_et_titres(p_lieu_id integer, p_promo_id integer)|a5591645b931f8ed98c9cb8cc52987fd
--   peut_acceder_promo(p integer)|0c90a1bcda2393f7d190838bf58a3f70
--   peut_gerer_qualite()|2526be6797c37034b1956fc026e93bbe
--   promo_courante()|d07581de1d2d7ba6df2d45d82a86ea85
--   promo_par_defaut()|314acd28b779a8e4b2433c78f629332e
--   redacteur_contenus()|833b3ad8e185157e5da9df53db4414a3
--   regler_habillage_reseau(p_habillage text)|06d644ff242e341696def1dad643725f
--   regler_titres_ouverts(p_ouvert boolean)|c22da0a548e3fbc5a487ccc41d717ebf
--   resultats_questionnaire(p_cle text, p_portee jsonb)|c0fcd430eac37e441a15ae841d14017d
--   retirer_titre(p_email text, p_titre_id bigint, p_lieu_id integer)|d5c7744a979877f6901bb2b7e42f9144
--   roles_du_personnel()|6aebfdfadaf9bd6970241f560033a38c
--   siege_fixe()|039f4850e6b6faa010d5df1a0304dc5c
--   signaler_probleme(p_message text, p_contexte jsonb, p_capture text)|e7a0a20104a75df5e33337c50df0fcf9
--   supprimer_titre(p_titre_id bigint)|6a4691b579d690515eeee7fb7c74f5c3
--   titres_ajustables(p_lieu_id integer)|bc6019c3f5767fdc9209899f811e0545
--   titres_visibles(p_lieu_id integer)|c2f054834867e2db46dbb9e5e50b9860
--   traiter_signalement_app(p_id bigint, p_statut text, p_reponse text)|11b9bf5cfe6d9af4d6e9fba74e8131af
--   venues_benevoles()|49fa8705c0979a73c74b37f81b700ede
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
