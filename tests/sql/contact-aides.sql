-- Aides communes des preuves du chantier « espace contact » (annuaire, demandes et e-mails, absences, correctifs, données sensibles) :
-- tests/sql/contact-annuaire-preuve.sql, contact-demandes-preuve.sql, contact-absences-preuve.sql, contact-correctifs-preuve.sql et
-- contact-donnees-preuve.sql.
-- INCLUSION : l'assembleur (outils/assembler_repetition_roles.mjs) colle ce fichier tel quel, APRES tests/sql/roles-aides.sql et
-- tests/sql/titres-aides.sql (les gabarits portent les trois marqueurs d'inclusion, dans cet ordre) ; il ne porte donc aucun marqueur
-- d'assemblage. Ne se joue pas seul.
-- Rien d'autre que des fonctions pg_temp : elles vivent le temps de la session, la levée finale de la preuve les annule.

-- Les personnages du chantier : ceux du lot 4 (pg_temp.poser_perso) et des titres non fixes (pg_temp.poser_titres_gestes), puis sec_n,
-- une fiche SANS COMPTE du centre de Nîmes (promo 1) : « Preuve Secrétariat », adresse preuve.sec@exemple.invalid. La fiche est une ligne
-- de public.contacts posée en propriétaire (aucun profil, aucune affectation) ; elle figure dans pg_temp.perso (ordre 17, un rang libre
-- sous ceux qui créent des profils) avec l'identifiant de la ligne en texte dans info. Les colonnes écrites existent avant la
-- migration 1 du chantier : la pose se joue donc avant comme après elle.
create or replace function pg_temp.poser_contact()
returns void language plpgsql as $tpc$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_fiche bigint;
begin
  perform pg_temp.poser_perso();
  perform pg_temp.poser_titres_gestes();
  insert into public.contacts (prenom, role, email, note, category, sort_order, lieu_id)
    values ('Preuve Secrétariat', 'Secrétariat', 'preuve.sec@exemple.invalid', 'fiche d''essai sans compte', 'admin', 990, v_l1)
    returning id into v_fiche;
  insert into pg_temp.perso (ordre, nom, email, role, info) values (17, 'sec_n', 'preuve.sec@exemple.invalid', 'prof', v_fiche::text);
end $tpc$;

-- Une demi-journée du planning : le lundi de la semaine du jour donné et son rang dans la semaine (0 lundi ... 4 vendredi), comme les
-- colonnes semaine_lundi et day_index de planning_entries et planning_half_meta. p_demi : « matin » ou « aprem » (vérifié, il ne change pas le
-- résultat). Un samedi ou un dimanche est refusé : le planning ne compte que cinq jours.
create or replace function pg_temp.demi(p_jour date, p_demi text)
returns table (lundi date, day_index integer) language plpgsql as $tdm$
declare v_rang integer := extract(isodow from p_jour)::integer - 1;
begin
  if p_demi is distinct from 'matin' and p_demi is distinct from 'aprem' then
    raise exception 'demi : « matin » ou « aprem » attendu, reçu %', coalesce(p_demi, 'nul');
  end if;
  if v_rang > 4 then
    raise exception 'demi : % est un week-end, le planning compte cinq jours', p_jour;
  end if;
  return query select p_jour - v_rang, v_rang;
end $tdm$;

-- La migration 4 (20261116_contact_4_correctifs) est-elle appliquée ? Sa marque : l'aide _contact_quota_equipe(bigint). Les preuves des
-- parties 1 à 3 s'en servent pour les seuls attendus que la migration 4 change (modes en ligne, joués après elle).
create or replace function pg_temp.migration_4()
returns boolean language sql as $tm4$
  select to_regprocedure('public._contact_quota_equipe(bigint)') is not null;
$tm4$;

-- La migration 5 (20261118_contact_5_donnees_sensibles) est-elle appliquée ? Sa marque : la contrainte absences_annoncees_motif admet
-- « personnel » (aucune fonction nouvelle). Les preuves des parties 3 et 4 s'en servent pour les seuls attendus que la migration 5 change
-- (phrase du motif, page du lien d'une absence, motif à l'étape 1 de l'effacement) ; la preuve de la 5, pour sauter ses groupes en ligne.
create or replace function pg_temp.migration_5()
returns boolean language sql as $tm5$
  select coalesce((select pg_get_constraintdef(c.oid) like '%''personnel''%' from pg_constraint c
                    where c.conrelid = to_regclass('public.absences_annoncees') and c.conname = 'absences_annoncees_motif'), false);
$tm5$;

-- Écarte, pour la durée de la preuve (tout est annulé à la levée finale), ce que la promo p porte de RÉEL et que les preuves lisent sans
-- l'avoir posé : son planning (planning_entries, planning_half_meta : une vraie fiche de formateur au planning d'un jour d'essai devient
-- formateur du jour, donc annexe et destinataire d'un avis, et fausse les comptes) et ses délégués (stagiaires.delegue : un délégué réel
-- serait une annexe de plus, et l'index unique par promo refuserait les délégués d'essai). À appeler AVANT de poser les personnages et le
-- planning d'essai : la preuve ne compare alors que des lignes qu'elle a créées, en production comme sur la base locale. Les règles du
-- centre, que les preuves effacent déjà, ne sont pas concernées. La colonne delegue vient de la migration 1 : sa remise à nul n'est tentée
-- que si elle existe (contre-épreuve, avant la migration 1).
create or replace function pg_temp.ecarter_donnees_reelles(p_promo integer)
returns void language plpgsql as $tev$
begin
  delete from public.planning_entries where promo_id = p_promo;
  delete from public.planning_half_meta where promo_id = p_promo;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stagiaires' and column_name = 'delegue') then
    execute format('update public.stagiaires set delegue = null where promo_id = %s and delegue is not null', p_promo);
  end if;
end $tev$;
