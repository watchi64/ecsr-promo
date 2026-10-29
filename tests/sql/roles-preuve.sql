-- Preuve rôle par rôle du lot 4 : ce que les étapes 2 (fonctions) et 3 (règles) doivent donner, écrite avant elles
-- (plan du lot 4, Task 3, première partie : machinerie, non-régression des comptes réels, matrice des droits, siège,
-- couverture, aller-retour ; la seconde partie y ajoutera aperçu, R32, comptes, invitations, promos, fonctions serveur,
-- contenus et compatibilité).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes
-- (tests/sql/roles-aides.sql), y écrit le libellé du mode et y injecte en littéraux la requête d'empreinte, les
-- migrations des étapes 1, 2, 3 et leurs retours 3, 2, 1 :
--   node outils/assembler_repetition_roles.mjs repetition <sortie.sql>                les trois étapes : VERT attendu
--   node outils/assembler_repetition_roles.mjs repetition --etapes 1,2 <sortie.sql>   sans l'étape 3 (Task 4)
--   node outils/assembler_repetition_roles.mjs contre-epreuve <sortie.sql>            la seule étape 1 : ROUGE là où les
--                                                                                     étapes 2 et 3 changent un droit
--   node outils/assembler_repetition_roles.mjs en-ligne <sortie.sql>                  rien d'injecté, après application
--   ... --compact <sortie.sql>   (avec n'importe quel mode) retire du gabarit et des aides les lignes vides et de
--                                commentaire ; les textes injectés restent intacts. C'est la copie à transmettre à la base
--                                (R27) ; l'assembleur en affiche la longueur et le md5, que la preuve rend à son tour.
-- Le fichier assemblé se joue en une requête (MCP execute_sql). Tout se passe dans le bloc do final, qui finit TOUJOURS
-- par une levée : migrations, personnages fictifs, données d'essai, écritures et retours sont annulés, rien ne reste.
-- Le verdict est le message de la levée : « VERT n/0 » ou « ROUGE réussis/échecs », le mode, la durée, les contrôles
-- par groupe, chaque contrôle hors matrice nommé, puis les échecs (hors matrice en détail ; matrice en carte : pour
-- chaque personnage, les tables qui échouent sur les mêmes opérations dans les mêmes contextes, sur une ligne).
--
-- Déroulé : empreinte avant ; photo avant des comptes réels ; migrations 1, 2, 3 ; photo après et non-régression ;
-- personnages fictifs et données d'essai ; matrice ; contrôles ciblés ; siège ; couverture ; retours 3, 2, 1 ; empreinte
-- après.
--
-- Groupes de contrôles (chacun nommé au verdict) :
--   non-régression  chaque compte réel (profils hors @exemple.invalid, choisis par requête, jamais nommés : « compte
--                   réel 4 ») dans chaque contexte (en-tête x-promo-id 1, 2, 7, et sans en-tête), sur chaque table de
--                   public sous RLS et storage.objects : mêmes lignes visibles avant et après les migrations (nombre et
--                   empreinte des ctid) ; mêmes role, is_admin, is_founder, stagiaire_id ; mêmes mes_promos() (colonnes
--                   d'avant l'étape 2 : la nouvelle colonne roles est mise à part). En mode en-ligne, rien n'est
--                   injecté : non jugeable, une ligne d'information le dit.
--   matrice         chaque personnage fictif (stagiaires, formateurs, direction, siège, fondateur, stagiaire qui masque
--                   ses notes) et l'acteur anonyme (sans jeton), chaque contexte, chaque table de la section 1 du plan
--                   (table matrice ci-dessous) : lignes visibles = lignes attendues (nombre et empreinte des ctid), et
--                   ajout, modification, suppression acceptés ou refusés comme elle le dit ; sur trois tables de promo, le
--                   déplacement de promo_id vers une autre promo (condition d'écriture sur la ligne nouvelle) est refusé.
--   signalements    le signalement de problème d'essai appartient au jeton de stag_n (identifiant d'un compte réel non
--                   fondateur, choisi par requête) : seuls lui et le fondateur le voient, avec sa capture ; seul le
--                   fondateur le supprime. Attendus écrits en dur, indépendants du modèle.
--   comptes         ni le compte « cumul » (fiche de la promo 1, formateur de la promo 2) ni l'orphelin affecté (siège) ne
--                   sont supprimables, par aucun personnage ni par l'acteur anonyme. Attendus écrits en dur.
--   anonymat        un stagiaire qui masque ses notes ne voit que les siennes (une seule évaluation), les autres stagiaires
--                   ne voient pas les siennes, l'équipe les voit. Attendus écrits en dur.
--   siège           le siège fictif ne voit aucune ligne d'une table de promo ou de lieu, aucun profil de stagiaire.
--   couverture      toute table de public sous RLS figure dans la matrice ; aucune table de public n'est sans RLS ; aucune
--                   règle ne cite plus is_admin(, is_prof( ou is_founder( (étape 3 appliquée).
--   retour          après les retours 3, 2, 1, les trois empreintes égalent celles d'avant (R15 : les valeurs
--                   relevées le 29/10 ne sont qu'une information).
--   structure       migrations et retours joués sans erreur, personnages et données d'essai posés.
--
-- Le modèle d'attendus (R23) ne rappelle jamais le vocabulaire testé : il part de la définition de chaque personnage
-- (sa fiche, ses affectations, écrites dans la table personnages) et de promos.lieu_id lu par requête.
--   Promos accessibles : celle de sa fiche, celles dont il est formateur, celles du lieu dont il est direction (le
--   fondateur : toutes ; le siège : aucune).
--   Promo affichée P : sans en-tête, sa promo par défaut (celle de sa fiche, sinon la première accessible non finie
--   par date_debut puis id, sinon la dernière accessible) ; avec un en-tête, cette promo si elle est accessible, sinon
--   nulle (comportement de promo_courante() relevé le 28/10, que l'étape 2 garde : section 0 du plan).
--   L le lieu de P ; F formateur de P ; D direction de L ; E = F ou D ; S siège ; R = F ou S ; Fo fondateur ; M sa
--   ligne (sa fiche quand elle est dans P, son email, son identifiant de jeton).
-- Chaque attendu se calcule en propriétaire, en SQL direct sur les données, à partir de ces drapeaux ; un attendu
-- qui ne se calcule pas fait échouer son contrôle.
--
-- Écritures (même méthode que tests/sql/multi-promo-preuve.sql) : chacune dans une sous-transaction annulée aussitôt,
-- le résultat constaté en propriétaire dans la même sous-transaction. Un ajout se tente sans RETURNING ; l'attendu
-- d'un ajout est la règle appliquée à la ligne même, écrite d'abord en propriétaire puis annulée. Modification et
-- suppression portent sur toute la table, sans citer de colonne (valeur constante, ni WHERE ni RETURNING) : la
-- règle de lecture ne s'y ajoute pas et ne peut donc pas masquer une règle d'écriture qui aurait perdu sa condition.
-- Un refus vaut 0 ligne touchée, qu'il vienne d'une règle (0 ligne) ou d'un droit retiré (42501).
-- Une suppression peut d'abord lever, en propriétaire, un obstacle sans rapport avec la règle testée (clé étrangère
-- sans cascade, garde du stockage) : colonne prep_suppr de la matrice.
--
-- Durée et verrous : les migrations posent leurs verrous jusqu'à la levée finale ; la durée du bloc est donnée en
-- information. Garde-fou : passé 90 secondes, la matrice s'arrête (contrôle en échec) pour que le verdict arrive
-- avant la limite de 2 minutes des requêtes. Jouer la preuve hors des heures de cours, quelques fois au plus.

-- @@INCLURE tests/sql/roles-aides.sql@@

-- Empreinte de la base (regles, fonctions, droits) : tests/sql/roles-empreinte.sql, injecté tel quel.
create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $empreinte$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $empreinte$;

-- Une migration ou un retour, joué tel quel dans une sous-transaction : « jouée », « neutralisée » (le littéral
-- 'select 1' que l'assembleur met à la place d'une étape non demandée), ou l'erreur, notée sans être propagée. Le md5
-- du texte joué va au verdict (information) : égal à celui de l'en-tête du fichier assemblé, il montre que le texte
-- reçu par la base est celui du dépôt. L'erreur ne rend jamais son message (il pourrait citer une valeur, donc un
-- email réel) : l'état SQL et les noms de contrainte, de table et de colonne en cause, seulement.
create or replace function pg_temp.jouer(p_nom text, p_sql text)
returns text language plpgsql as $fx$
declare v_contrainte text; v_table text; v_colonne text;
begin
  if p_sql = 'select 1' then return 'neutralisée'; end if;
  perform pg_temp.informer(format('md5 du texte joué : %s', p_nom), md5(p_sql));
  begin
    execute p_sql;
    return 'jouée';
  exception when others then
    get stacked diagnostics v_contrainte = constraint_name, v_table = table_name, v_colonne = column_name;
    return 'ERREUR ' || sqlstate || coalesce(' contrainte ' || nullif(v_contrainte, ''), '')
           || coalesce(' table ' || nullif(v_table, ''), '') || coalesce(' colonne ' || nullif(v_colonne, ''), '');
  end;
end $fx$;

-- Comptes réels, numérotés par email (jamais affiché), et photos de ce qu'ils voient.
drop table if exists pg_temp.comptes;
create temp table comptes (num integer primary key, email text not null, etiquette text not null);
drop table if exists pg_temp.photos;
create temp table photos (moment text, compte integer, ctx text, tbl text, valeur text, primary key (moment, compte, ctx, tbl));

-- Photo des comptes réels : pour chaque compte, chaque contexte et chaque table, « lignes:somme des empreintes des
-- ctid » (hashtext, sans tri : une ligne remplacée par une autre se verrait) ; puis mes_promos() (colonnes d'avant
-- l'étape 2, sans roles) et les colonnes role, is_admin, is_founder, stagiaire_id de son profil (lues en
-- propriétaire). Une requête par compte et par contexte ; si elle échoue, chaque table est relue seule et son erreur
-- notée.
create or replace function pg_temp.photo(p_moment text, p_tables text[], p_contextes text[])
returns void language plpgsql as $fx$
declare
  v_c record; v_ctx text; v_vals text[]; v_toutes text;
  c_vue constant text := $pv$(select count(*)::text || ':' || coalesce(sum(hashtext(ctid::text)::bigint), 0)::text from %s)$pv$;
begin
  v_toutes := 'select array[' || (select string_agg(format(c_vue, t), ', ' order by o)
                                    from unnest(p_tables) with ordinality u(t, o)) || ']';
  for v_c in select * from comptes order by num loop
    foreach v_ctx in array p_contextes loop
      v_vals := null;
      begin
        perform pg_temp.incarner(v_c.email, v_ctx, null);
        execute v_toutes into v_vals;
      exception when others then
        v_vals := null;
      end;
      perform pg_temp.proprio();
      if v_vals is null then
        v_vals := array(select coalesce(pg_temp.valeur(v_c.email, v_ctx, null, 'select ' || format(c_vue, t)), 'nul')
                          from unnest(p_tables) with ordinality u(t, o) order by o);
      end if;
      insert into photos (moment, compte, ctx, tbl, valeur)
        select p_moment, v_c.num, coalesce(v_ctx, 'sans'), t, v_vals[o] from unnest(p_tables) with ordinality u(t, o);
    end loop;
    insert into photos (moment, compte, ctx, tbl, valeur) values
      (p_moment, v_c.num, 'sans', 'mes_promos()', coalesce(pg_temp.valeur(v_c.email, null, null,
         $pv$select count(*)::text || ':' || coalesce(md5(string_agg(concat_ws('|', id, nom, lieu_id, lieu_nom, date_debut,
              coalesce(date_fin::text, 'nul'), par_defaut, coalesce(stagiaire_id::text, 'nul'), nb_stagiaires), ';' order by id)), '-')
              from public.mes_promos()$pv$), 'nul')),
      (p_moment, v_c.num, 'sans', 'profil',
       coalesce((select concat_ws('|', up.role, up.is_admin, up.is_founder, coalesce(up.stagiaire_id::text, 'nul'))
                   from public.user_profiles up where up.email = v_c.email), 'absent'));
  end loop;
end $fx$;

-- Personnages fictifs (R22) : leur définition, d'où le modèle tire leurs drapeaux. La fiche est posée dans le bloc
-- (colonne fiche) ; le lieu de la direction est celui de la promo 1, lu en base. Le fondateur est fait comme le vrai
-- (role stagiaire, is_admin, fiche dans la promo 1) : rien n'interdit deux fondateurs (aucune contrainte ni index sur
-- is_founder, aucun déclencheur sur user_profiles, relevé en lecture seule le 29/10). stag_masque masque ses notes
-- (réciprocité de l'anonymat) : sa matrice ne porte que sur les tables où l'anonymat joue (colonne tables : null
-- veut dire toutes), pour le reste il est semblable à stag_n et ne ferait que rallonger la preuve. stag_n porte
-- l'identifiant de jeton d'un compte réel non fondateur (voir plus bas) : les sept autres n'en ont pas.
drop table if exists pg_temp.personnages;
create temp table personnages (ordre integer primary key, nom text not null, email text not null, role text not null,
  is_admin boolean not null, promo_fiche integer, formateur_de integer[] not null, direction_de integer[] not null,
  siege boolean not null, fondateur boolean not null default false, anonyme boolean not null default false,
  tables text[], fiche integer);
insert into personnages (ordre, nom, email, role, is_admin, promo_fiche, formateur_de, direction_de, siege) values
  (1, 'stag_n', 'preuve.stag.n@exemple.invalid', 'stagiaire', false, 1, '{}', '{}', false),
  (2, 'stag_m', 'preuve.stag.m@exemple.invalid', 'stagiaire', false, 2, '{}', '{}', false),
  (3, 'form_n', 'preuve.form.n@exemple.invalid', 'prof', true, null, '{1}', '{}', false),
  (4, 'form_m', 'preuve.form.m@exemple.invalid', 'prof', true, null, '{2}', '{}', false),
  (5, 'dir_n', 'preuve.dir.n@exemple.invalid', 'prof', false, null, '{}',
     coalesce(array[(select pr.lieu_id from public.promos pr where pr.id = 1)], '{}'), false),
  (6, 'siege', 'preuve.siege@exemple.invalid', 'prof', false, null, '{}', '{}', true);
insert into personnages (ordre, nom, email, role, is_admin, promo_fiche, formateur_de, direction_de, siege, fondateur, anonyme, tables) values
  (7, 'fond', 'preuve.fond@exemple.invalid', 'stagiaire', true, 1, '{}', '{}', false, true, false, null),
  (8, 'stag_masque', 'preuve.masque@exemple.invalid', 'stagiaire', false, 1, '{}', '{}', false, false, true,
     array['public.evaluations', 'public.evaluations_audit']);

-- La matrice des droits (section 1 du plan), écrite en données : pour chaque table, la condition de lecture et celles
-- d'ajout, de modification et de suppression, sur une ligne r de la table, avec les jetons du contexte : {P}, {L},
-- {F}, {D}, {E}, {R}, {S}, {Fo}, {moi} (email du jeton), {sub} (son identifiant), {fiche} (fiche du compte),
-- {fiche_p} (sa fiche si elle est dans P), {anonyme} (notes masquées), {acces} (promos accessibles), {form_de}
-- (promos où il est formateur), {dir_de} (lieux où il est direction). maj : la modification jouée sur toute la
-- table (une colonne, une valeur constante qui n'existe nulle part). prep_suppr : obstacle levé en propriétaire avant
-- la suppression. « false » : aucune écriture depuis l'app (fonction serveur, déclencheur, droit retiré).
drop table if exists pg_temp.matrice;
create temp table matrice (tbl text primary key, lecture text not null, ajout text not null, modif text not null,
  suppr text not null, maj text not null, prep_suppr text);
insert into matrice (tbl, lecture, ajout, modif, suppr, maj, prep_suppr) values
-- Agenda et planning : P (inchangé) ; écriture P et F.
('public.agenda_events', $mx$r.promo_id = {P}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$location = 'PreuveMaj'$mx$, null),
('public.planning_entries', $mx$r.promo_id = {P}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$notes = 'PreuveMaj'$mx$, null),
('public.planning_half_meta', $mx$r.promo_id = {P}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$pause_start = 'PreuveMaj'$mx$, null),
('public.planning_jours_off', $mx$r.promo_id = {P}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$label = 'PreuveMaj'$mx$, null),
-- Stagiaires : P (inchangé) ; écriture P et E. Avant la suppression : les émargements (clé sans cascade) sont retirés,
-- et les remplaçants des passages détachés (leur remise à nul relance l'imposition de la promo sur un passage dont la
-- fiche part dans la même instruction : 23502, sans rapport avec la règle).
('public.stagiaires', $mx$r.promo_id = {P}$mx$, $mx$r.promo_id = {P} and {E}$mx$, $mx$r.promo_id = {P} and {E}$mx$,
  $mx$r.promo_id = {P} and {E}$mx$, $mx$ordre = 424242$mx$,
  $mx$delete from public.emargement_lignes; update public.passages set remplacant_id = null where remplacant_id is not null$mx$),
-- Données privées : fiche de P, et (E ou M) ; écriture par set_date_naissance seulement.
('public.stagiaires_prive',
  $mx$exists (select 1 from public.stagiaires s where s.id = r.stagiaire_id and s.promo_id = {P}) and ({E} or r.stagiaire_id = {fiche_p})$mx$,
  'false', 'false', 'false', $mx$updated_at = '2031-01-06 00:00:00+00'$mx$, null),
-- Réglages : P (inchangé) ; écriture P et, selon la clé, Fo (navigation_v2, emargement_actif), E (modules), F (autres).
('public.settings', $mx$r.promo_id = {P}$mx$,
  $mx$r.promo_id = {P} and case when r.key in ('navigation_v2', 'emargement_actif') then {Fo} when r.key = 'modules' then {E} else {F} end$mx$,
  $mx$r.promo_id = {P} and case when r.key in ('navigation_v2', 'emargement_actif') then {Fo} when r.key = 'modules' then {E} else {F} end$mx$,
  $mx$r.promo_id = {P} and case when r.key in ('navigation_v2', 'emargement_actif') then {Fo} when r.key = 'modules' then {E} else {F} end$mx$,
  $mx$value = 'PreuveMaj'$mx$, null),
-- Notes : P et (E ou fiche dans notes_stagiaires_visibles(), réécrite ici : sa fiche, ou les fiches de P dont aucun
-- profil ne masque ses notes, s'il ne masque pas les siennes) ; écriture P et F.
('public.evaluations',
  $mx$r.promo_id = {P} and ({E} or r.stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = {P}
     and (s.id = {fiche_p} or (not {anonyme} and not exists (select 1 from public.user_profiles x
                                                            where x.stagiaire_id = s.id and x.anonymous_notes)))))$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$observation = 'PreuveMaj'$mx$, null),
-- Historique des notes : P et (E ou évaluation visible) ; déclencheur seulement.
('public.evaluations_audit',
  $mx$r.promo_id = {P} and ({E} or r.evaluation_id in (select e.id from public.evaluations e where e.promo_id = {P}
     and e.stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = {P}
       and (s.id = {fiche_p} or (not {anonyme} and not exists (select 1 from public.user_profiles x
                                                              where x.stagiaire_id = s.id and x.anonymous_notes))))))$mx$,
  'false', 'false', 'false', $mx$changed_by_email = 'PreuveMaj'$mx$, null),
-- EPCF : P et (E ou M) ; écriture P et F.
('public.epcf_evaluations', $mx$r.promo_id = {P} and ({E} or r.stagiaire_id = {fiche_p})$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$commentaire = 'PreuveMaj'$mx$, null),
('public.epcf_livrets', $mx$r.promo_id = {P} and ({E} or r.stagiaire_id = {fiche_p})$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$updated_by_who = 'PreuveMaj'$mx$, null),
-- Dossier professionnel et fiche de suivi : P et (E ou M) ; ajout et modification P et (F ou M) ; suppression P et F.
('public.dp_dossiers', $mx$r.promo_id = {P} and ({E} or r.stagiaire_id = {fiche_p})$mx$,
  $mx$r.promo_id = {P} and ({F} or r.stagiaire_id = {fiche_p})$mx$, $mx$r.promo_id = {P} and ({F} or r.stagiaire_id = {fiche_p})$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$updated_by_who = 'PreuveMaj'$mx$, null),
('public.fiches_suivi', $mx$r.promo_id = {P} and ({E} or r.stagiaire_id = {fiche_p})$mx$,
  $mx$r.promo_id = {P} and ({F} or r.stagiaire_id = {fiche_p})$mx$, $mx$r.promo_id = {P} and ({F} or r.stagiaire_id = {fiche_p})$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$updated_by_who = 'PreuveMaj'$mx$, null),
-- Passages : P (inchangé) ; P et F, plus l'ajout et la modification des siens (fiche du profil, inchangé).
('public.passages', $mx$r.promo_id = {P}$mx$,
  $mx$r.promo_id = {P} and ({F} or r.stagiaire_id = {fiche})$mx$, $mx$r.promo_id = {P} and ({F} or r.stagiaire_id = {fiche})$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$commentaire = 'PreuveMaj'$mx$, null),
('public.passages_audit', $mx$r.promo_id = {P}$mx$, 'false', 'false', 'false', $mx$changed_by_who = 'PreuveMaj'$mx$, null),
-- Tentatives de QCM : P et (E ou M) ; P et F, plus l'ajout des siennes en entraînement (inchangé ; l'examen, borné
-- par qcm_exam_remise_toleree, n'est pas joué ici).
('public.qcm_attempts', $mx$r.promo_id = {P} and ({E} or r.stagiaire_id = {fiche})$mx$,
  $mx$r.promo_id = {P} and ({F} or (r.stagiaire_id = {fiche} and r.mode = 'entrainement'))$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$answers = '{"preuve": "maj"}'::jsonb$mx$, null),
-- Examens et progression des thèmes : P (inchangé) ; écriture P et F.
('public.qcm_examens', $mx$r.promo_id = {P}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$published_by_email = 'preuve.maj@exemple.invalid'$mx$, null),
('public.themes_progression', $mx$r.promo_id = {P}$mx$, $mx$r.promo_id = {P} and {F}$mx$, $mx$r.promo_id = {P} and {F}$mx$,
  $mx$r.promo_id = {P} and {F}$mx$, $mx$notes = 'PreuveMaj'$mx$, null),
-- Émargement : séances P (inchangé), lignes P et (E ou M), formateurs P et E ; écriture par fonctions serveur.
('public.emargement_seances', $mx$r.promo_id = {P}$mx$, 'false', 'false', 'false', $mx$close_par = 'PreuveMaj'$mx$, null),
('public.emargement_lignes', $mx$r.promo_id = {P} and ({E} or r.stagiaire_id = {fiche_p})$mx$, 'false', 'false', 'false',
  $mx$maj_par = 'PreuveMaj'$mx$, null),
('public.emargement_formateurs', $mx$r.promo_id = {P} and {E}$mx$, 'false', 'false', 'false', $mx$signe_par = 'PreuveMaj'$mx$, null),
-- Banque du lieu : L et E ; écriture L et F. Les bénévoles affiliés sont détachés avant la suppression des auto-écoles.
('public.auto_ecoles', $mx$r.lieu_id = {L} and {E}$mx$, $mx$r.lieu_id = {L} and {F}$mx$, $mx$r.lieu_id = {L} and {F}$mx$,
  $mx$r.lieu_id = {L} and {F}$mx$, $mx$notes = 'PreuveMaj'$mx$,
  $mx$update public.benevoles set auto_ecole_id = null where auto_ecole_id is not null$mx$),
('public.benevoles', $mx$r.lieu_id = {L} and {E}$mx$, $mx$r.lieu_id = {L} and {F}$mx$, $mx$r.lieu_id = {L} and {F}$mx$,
  $mx$r.lieu_id = {L} and {F}$mx$, $mx$notes = 'PreuveMaj'$mx$, null),
('public.benevole_suivi', $mx$r.lieu_id = {L} and {E}$mx$, $mx$r.lieu_id = {L} and {F}$mx$, $mx$r.lieu_id = {L} and {F}$mx$,
  $mx$r.lieu_id = {L} and {F}$mx$, $mx$commentaire = 'PreuveMaj'$mx$, null),
-- Promos : accessibles (peut_acceder_promo, réécrite ici) ; nom : formateur de la promo ou direction de son lieu ;
-- création et dates par fonctions serveur (droit de modification limité à nom).
('public.promos', $mx$r.id = any({acces})$mx$, 'false', $mx$r.id = any({form_de}) or r.lieu_id = any({dir_de})$mx$, 'false',
  $mx$nom = 'PreuveMaj'$mx$, null),
-- Lieux : celui d'une promo accessible, ou dont il est direction, ou tous pour le siège ; aucune écriture.
('public.lieux',
  $mx$r.id in (select pr.lieu_id from public.promos pr where pr.id = any({acces})) or r.id = any({dir_de}) or {S}$mx$,
  'false', 'false', 'false', $mx$nom = 'PreuveMaj'$mx$, null),
-- Affectations (R17) : les siennes ; tout pour Fo ; formateurs d'une promo où il est formateur ou direction ;
-- directions de son lieu ; directions et siège pour le siège. Ajout et retrait : formateur par la direction du lieu de
-- la promo, direction par le siège, siège par Fo ; aucune modification.
('public.affectations',
  $mx$lower(r.email) = {moi} or {Fo}
     or (r.role = 'formateur' and (r.promo_id = any({form_de})
                                   or (select pr.lieu_id from public.promos pr where pr.id = r.promo_id) = any({dir_de})))
     or (r.role = 'direction' and r.lieu_id = any({dir_de})) or (r.role in ('direction', 'siege') and {S})$mx$,
  $mx$(r.role = 'formateur' and (select pr.lieu_id from public.promos pr where pr.id = r.promo_id) = any({dir_de}))
     or (r.role = 'direction' and {S}) or (r.role = 'siege' and {Fo})$mx$,
  'false',
  $mx$(r.role = 'formateur' and (select pr.lieu_id from public.promos pr where pr.id = r.promo_id) = any({dir_de}))
     or (r.role = 'direction' and {S}) or (r.role = 'siege' and {Fo})$mx$,
  $mx$cree_par = 'PreuveMaj'$mx$, null),
-- Comptes : le sien ; le personnel (sans fiche, role <> 'stagiaire') ; les orphelins si E ; les stagiaires de P.
-- Ajout et modification retirés (fonctions serveur) ; suppression jamais du fondateur ni d'un compte affecté :
-- stagiaire de P ou orphelin si E, personnel si Fo.
('public.user_profiles',
  $mx$lower(r.email) = {moi} or (r.stagiaire_id is null and (r.role <> 'stagiaire' or {E}))
     or r.stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = {P})$mx$,
  'false', 'false',
  $mx$not r.is_founder and not exists (select 1 from public.affectations a where a.email = r.email)
     and (((r.stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = {P})
            or (r.stagiaire_id is null and r.role = 'stagiaire')) and {E})
          or (r.stagiaire_id is null and r.role <> 'stagiaire' and {Fo}))$mx$,
  $mx$invited_by_email = 'preuve.maj@exemple.invalid'$mx$, null),
-- Cours : publié, ou Fo, ou cours de thème (code nul) pour F, D, S ; modification Fo, ou (F ou S) sur un cours de
-- thème ou publié ; ni ajout ni suppression.
('public.cours', $mx$r.published or {Fo} or (r.code is null and ({F} or {D} or {S}))$mx$, 'false',
  $mx${Fo} or (({F} or {S}) and (r.code is null or r.published))$mx$, 'false', $mx$updated_by = 'PreuveMaj'$mx$, null),
('public.cours_versions',
  $mx${Fo} or (({F} or {D} or {S}) and exists (select 1 from public.cours c where c.id = r.cours_id and (c.code is null or c.published)))$mx$,
  $mx${Fo} or (({F} or {S}) and exists (select 1 from public.cours c where c.id = r.cours_id and (c.code is null or c.published)))$mx$,
  'false', 'false', $mx$saved_by = 'PreuveMaj'$mx$, null),
('public.cours_chunks', 'false', 'false', 'false', 'false', $mx$section = 'PreuveMaj'$mx$, null),
-- Questions et réponses des QCM : tous les connectés (inchangé) ; écriture R.
('public.qcm_questions', 'true', $mx${R}$mx$, $mx${R}$mx$, $mx${R}$mx$, $mx$section = 'PreuveMaj'$mx$, null),
('public.qcm_options', 'true', $mx${R}$mx$, $mx${R}$mx$, $mx${R}$mx$, $mx$texte = 'PreuveMaj'$mx$, null),
-- QCM, thèmes, compétences, ressources : tous les connectés (inchangé) ; écriture F.
('public.qcm', 'true', $mx${F}$mx$, $mx${F}$mx$, $mx${F}$mx$, $mx$description = 'PreuveMaj'$mx$, null),
('public.themes', 'true', $mx${F}$mx$, $mx${F}$mx$, $mx${F}$mx$, $mx$categorie = 'PreuveMaj'$mx$, null),
('public.competences', 'true', $mx${F}$mx$, $mx${F}$mx$, $mx${F}$mx$, $mx$libelle = 'PreuveMaj'$mx$, null),
('public.ressources', 'true', $mx${F}$mx$, $mx${F}$mx$, $mx${F}$mx$, $mx$description = 'PreuveMaj'$mx$, null),
-- Contacts et formateurs (profs) : tous les connectés (inchangé) ; écriture E. Les passages et EPCF qui citent un
-- formateur (clés sans cascade) en sont détachés avant la suppression.
('public.contacts', 'true', $mx${E}$mx$, $mx${E}$mx$, $mx${E}$mx$, $mx$note = 'PreuveMaj'$mx$, null),
('public.profs', 'true', $mx${E}$mx$, $mx${E}$mx$, $mx${E}$mx$, $mx$ordre = 424242$mx$,
  $mx$update public.passages set prof_id = null where prof_id is not null;
     update public.epcf_evaluations set evaluateur_prof_id = null where evaluateur_prof_id is not null$mx$),
-- Signalements de questions : F ou M ; ajout du sien (inchangé) ; traitement et suppression F.
('public.qcm_signalements', $mx${F} or lower(r.email) = {moi}$mx$, $mx$lower(r.email) = {moi}$mx$, $mx${F}$mx$, $mx${F}$mx$,
  $mx$commentaire = 'PreuveMaj'$mx$, null),
('public.qcm_signalement_instruction', $mx${F}$mx$, 'false', 'false', 'false', $mx$analyse_auto = 'PreuveMaj'$mx$, null),
('public.qcm_ia_brouillons', $mx${F}$mx$, 'false', 'false', 'false', $mx$motif = 'PreuveMaj'$mx$, null),
-- Acceptations des conditions : M ou E ; journal des effacements : E ; fonctions serveur.
('public.conditions_acceptations', $mx$lower(r.email) = {moi} or {E}$mx$, 'false', 'false', 'false',
  $mx$version = 'PreuveMaj'$mx$, null),
('public.effacements_journal', $mx${E}$mx$, 'false', 'false', 'false', $mx$cible = 'PreuveMaj'$mx$, null),
-- Compteurs de l'assistant et de l'IA, morceaux de cours : inchangés (les siens, par l'identifiant du jeton ; rien).
('public.chatbot_usage', $mx$r.user_id = {sub}$mx$, 'false', 'false', 'false', $mx$nb = 424242$mx$, null),
('public.qcm_ia_usage', $mx$r.user_id = {sub}$mx$, 'false', 'false', 'false', $mx$nb = 424242$mx$, null),
-- Signaler un problème (arrivée de main le 28/10) : M ou Fo ; suppression Fo ; le reste par fonctions serveur.
('public.signalements_app', $mx$r.user_id = {sub} or {Fo}$mx$, 'false', 'false', $mx${Fo}$mx$,
  $mx$traite_par_email = 'PreuveMaj'$mx$, null),
('public.signalements_app_captures',
  $mx$exists (select 1 from public.signalements_app s where s.id = r.signalement_id and (s.user_id = {sub} or {Fo}))$mx$,
  'false', 'false', 'false', $mx$image = 'data:image/jpeg;base64,UHJldXZl'$mx$, null),
-- Stockage : lecture publique (inchangée) ; écriture R, sur les commandes qui ont une règle aujourd'hui (R5) : ajout
-- dans les deux seaux, modification et suppression dans qcm-images. La garde du stockage (suppression directe
-- interdite hors de l'API) est levée avant la suppression, comme le fait l'API.
('storage.objects', $mx$r.bucket_id in ('cours-images', 'qcm-images')$mx$,
  $mx$r.bucket_id in ('cours-images', 'qcm-images') and {R}$mx$, $mx$r.bucket_id = 'qcm-images' and {R}$mx$,
  $mx$r.bucket_id = 'qcm-images' and {R}$mx$, $mx$user_metadata = '{"preuve": "maj"}'::jsonb$mx$,
  $mx$select set_config('storage.allow_delete_query', 'true', true)$mx$);

-- Les ajouts tentés, table par table. sorte : promo (promo affichée, autre promo), lieu (lieu affiché, autre lieu),
-- stagiaire (sa fiche, autre fiche de la promo affichée, fiche d'une autre promo), benevole (du lieu affiché, d'un
-- autre lieu), reglage (quatre clés, promo affichée et autre promo), unique (une fois). Jetons en plus de ceux du
-- contexte : {c_promo}, {c_lieu}, {c_stag}, {c_benevole}, {c_cle} (la cible), {qcm_a}, {qcm_b}, {theme_b}, {theme_c},
-- {question_a}, {cours_theme} (un cours de thème réel), {cours_comp} et {cours_pub} (deux cours de compétence fictifs,
-- non publié et publié), {personnel}, {lieu_promo1}, {lieu_promo2} (données d'essai). marque : retrouve la ligne
-- ajoutée. prep : fait de la place avant l'ajout (une ligne unique par fiche ou par promo).
drop table if exists pg_temp.ajouts;
create temp table ajouts (ordre serial primary key, tbl text not null, sorte text not null, libelle text,
  modele text not null, marque text not null, prep text);
insert into ajouts (tbl, sorte, libelle, modele, marque, prep) values
('public.agenda_events', 'promo', null,
  $aj$insert into public.agenda_events (date_start, title, promo_id) values ('2031-01-06', 'PreuveAjout', {c_promo})$aj$,
  $aj$r.title = 'PreuveAjout'$aj$, null),
('public.planning_entries', 'promo', null,
  $aj$insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite, notes, promo_id)
      values ('2031-01-06', 0, 'matin', 7, 7, 'Cours', 'PreuveAjout', {c_promo})$aj$, $aj$r.notes = 'PreuveAjout'$aj$, null),
('public.planning_half_meta', 'promo', null,
  $aj$insert into public.planning_half_meta (semaine_lundi, day_index, half_day, start_time, end_time, pause_start, promo_id)
      values ('2031-01-06', 1, 'aprem', '13:30', '17:00', 'PreuveAjout', {c_promo})$aj$, $aj$r.pause_start = 'PreuveAjout'$aj$, null),
('public.planning_jours_off', 'promo', null,
  $aj$insert into public.planning_jours_off (semaine_lundi, day_index, label, promo_id) values ('2031-01-06', 3, 'PreuveAjout', {c_promo})$aj$,
  $aj$r.label = 'PreuveAjout'$aj$, null),
('public.stagiaires', 'promo', null,
  $aj$insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('PreuveAjout', 'PREUVE', 996, {c_promo})$aj$,
  $aj$r.prenom = 'PreuveAjout'$aj$, null),
('public.stagiaires_prive', 'stagiaire', null,
  $aj$insert into public.stagiaires_prive (stagiaire_id, date_naissance) values ({c_stag}, '2000-01-01')$aj$,
  $aj$r.stagiaire_id = {c_stag} and r.date_naissance = '2000-01-01'$aj$, $aj$delete from public.stagiaires_prive where stagiaire_id = {c_stag}$aj$),
('public.settings', 'reglage', null,
  $aj$insert into public.settings (key, value, promo_id) values ({c_cle}, 'PreuveAjout', {c_promo})$aj$,
  $aj$r.value = 'PreuveAjout'$aj$, $aj$delete from public.settings where promo_id = {c_promo} and key = {c_cle}$aj$),
('public.evaluations', 'stagiaire', null,
  $aj$insert into public.evaluations (stagiaire_id, type, theme_numero, note, observation) values ({c_stag}, 'Thème', 1, 10, 'PreuveAjout')$aj$,
  $aj$r.observation = 'PreuveAjout'$aj$, null),
('public.evaluations_audit', 'promo', null,
  $aj$insert into public.evaluations_audit (action, changed_by_email, promo_id) values ('insert', 'PreuveAjout', {c_promo})$aj$,
  $aj$r.changed_by_email = 'PreuveAjout'$aj$, null),
('public.epcf_evaluations', 'stagiaire', null,
  $aj$insert into public.epcf_evaluations (stagiaire_id, trame, commentaire) values ({c_stag}, 'salle', 'PreuveAjout')$aj$,
  $aj$r.commentaire = 'PreuveAjout'$aj$, null),
('public.epcf_livrets', 'stagiaire', null,
  $aj$insert into public.epcf_livrets (stagiaire_id, updated_by_who) values ({c_stag}, 'PreuveAjout')$aj$,
  $aj$r.updated_by_who = 'PreuveAjout'$aj$, $aj$delete from public.epcf_livrets where stagiaire_id = {c_stag}$aj$),
('public.dp_dossiers', 'stagiaire', null,
  $aj$insert into public.dp_dossiers (stagiaire_id, updated_by_who) values ({c_stag}, 'PreuveAjout')$aj$,
  $aj$r.updated_by_who = 'PreuveAjout'$aj$, $aj$delete from public.dp_dossiers where stagiaire_id = {c_stag}$aj$),
('public.fiches_suivi', 'stagiaire', null,
  $aj$insert into public.fiches_suivi (stagiaire_id, besoins) values ({c_stag}, 'PreuveAjout')$aj$,
  $aj$r.besoins = 'PreuveAjout'$aj$, $aj$delete from public.fiches_suivi where stagiaire_id = {c_stag}$aj$),
('public.passages', 'stagiaire', null,
  $aj$insert into public.passages (date, stagiaire_id, type, resultat, commentaire) values ('2031-01-06', {c_stag}, 'Salle', 'Effectué', 'PreuveAjout')$aj$,
  $aj$r.commentaire = 'PreuveAjout'$aj$, null),
('public.passages_audit', 'promo', null,
  $aj$insert into public.passages_audit (action, changed_by_who, promo_id) values ('insert', 'PreuveAjout', {c_promo})$aj$,
  $aj$r.changed_by_who = 'PreuveAjout'$aj$, null),
('public.qcm_attempts', 'stagiaire', null,
  $aj$insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values ({qcm_a}, {c_stag}, 'entrainement', 1, 4242, 10)$aj$,
  $aj$r.total = 4242$aj$, null),
('public.qcm_examens', 'promo', null,
  $aj$insert into public.qcm_examens (promo_id, qcm_id, published_by_email) values ({c_promo}, {qcm_b}, 'preuve.ajout@exemple.invalid')$aj$,
  $aj$r.published_by_email = 'preuve.ajout@exemple.invalid'$aj$, $aj$delete from public.qcm_examens where promo_id = {c_promo} and qcm_id = {qcm_b}$aj$),
('public.themes_progression', 'promo', null,
  $aj$insert into public.themes_progression (promo_id, theme_id, statut, notes) values ({c_promo}, {theme_b}, 'En cours', 'PreuveAjout')$aj$,
  $aj$r.notes = 'PreuveAjout'$aj$, $aj$delete from public.themes_progression where promo_id = {c_promo} and theme_id = {theme_b}$aj$),
('public.emargement_seances', 'promo', null,
  $aj$insert into public.emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par) values ({c_promo}, '2031-01-06', 'matin', '08:00', '12:00', 'PreuveAjout')$aj$,
  $aj$r.ouverte_par = 'PreuveAjout'$aj$, null),
('public.emargement_lignes', 'unique', null,
  $aj$insert into public.emargement_lignes (seance_id, promo_id, stagiaire_id, maj_par) values (0, 1, 0, 'PreuveAjout')$aj$,
  $aj$r.maj_par = 'PreuveAjout'$aj$, null),
('public.emargement_formateurs', 'unique', null,
  $aj$insert into public.emargement_formateurs (seance_id, promo_id, nom, trace, signe_par) values (0, 1, 'PreuveAjout', 'M1 1', 'PreuveAjout')$aj$,
  $aj$r.nom = 'PreuveAjout'$aj$, null),
('public.auto_ecoles', 'lieu', null,
  $aj$insert into public.auto_ecoles (nom, lieu_id) values ('PreuveAjout', {c_lieu})$aj$, $aj$r.nom = 'PreuveAjout'$aj$, null),
('public.benevoles', 'lieu', null,
  $aj$insert into public.benevoles (prenom, lieu_id) values ('PreuveAjout', {c_lieu})$aj$, $aj$r.prenom = 'PreuveAjout'$aj$, null),
('public.benevole_suivi', 'benevole', null,
  $aj$insert into public.benevole_suivi (benevole_id, semaine_lundi, day_index, half_day, commentaire, lieu_id)
      values ({c_benevole}, '2031-01-06', 2, 'aprem', 'PreuveAjout', {c_lieu})$aj$, $aj$r.commentaire = 'PreuveAjout'$aj$, null),
('public.promos', 'unique', null,
  $aj$insert into public.promos (lieu_id, nom, date_debut) values ({lieu_promo1}, 'PreuveAjout', '2031-01-06')$aj$,
  $aj$r.nom = 'PreuveAjout'$aj$, null),
('public.lieux', 'unique', null,
  $aj$insert into public.lieux (nom) values ('PreuveAjout')$aj$, $aj$r.nom = 'PreuveAjout'$aj$, null),
('public.affectations', 'unique', 'formateur de la promo 1',
  $aj$insert into public.affectations (email, role, promo_id) values ({personnel}, 'formateur', 1)$aj$,
  $aj$r.email = {personnel}$aj$, null),
('public.affectations', 'unique', 'formateur de la promo 2',
  $aj$insert into public.affectations (email, role, promo_id) values ({personnel}, 'formateur', 2)$aj$,
  $aj$r.email = {personnel}$aj$, null),
('public.affectations', 'unique', 'direction du lieu de la promo 1',
  $aj$insert into public.affectations (email, role, lieu_id) values ({personnel}, 'direction', {lieu_promo1})$aj$,
  $aj$r.email = {personnel}$aj$, null),
('public.affectations', 'unique', 'direction du lieu de la promo 2',
  $aj$insert into public.affectations (email, role, lieu_id) values ({personnel}, 'direction', {lieu_promo2})$aj$,
  $aj$r.email = {personnel}$aj$, null),
('public.affectations', 'unique', 'siège',
  $aj$insert into public.affectations (email, role) values ({personnel}, 'siege')$aj$, $aj$r.email = {personnel}$aj$, null),
('public.user_profiles', 'stagiaire', null,
  $aj$insert into public.user_profiles (email, role, stagiaire_id) values ('preuve.ajout@exemple.invalid', 'stagiaire', {c_stag})$aj$,
  $aj$r.email = 'preuve.ajout@exemple.invalid'$aj$, null),
('public.user_profiles', 'unique', 'personnel',
  $aj$insert into public.user_profiles (email, role) values ('preuve.ajout@exemple.invalid', 'prof')$aj$,
  $aj$r.email = 'preuve.ajout@exemple.invalid'$aj$, null),
('public.cours', 'unique', null,
  $aj$insert into public.cours (titre, corps_md, numero) values ('PreuveAjout', 'x', 1)$aj$, $aj$r.titre = 'PreuveAjout'$aj$, null),
('public.cours_versions', 'unique', 'cours de thème',
  $aj$insert into public.cours_versions (cours_id, titre, corps_md, saved_by) values ({cours_theme}, 'PreuveAjout', 'x', 'PreuveAjout')$aj$,
  $aj$r.saved_by = 'PreuveAjout'$aj$, null),
('public.cours_versions', 'unique', 'cours de compétence non publié',
  $aj$insert into public.cours_versions (cours_id, titre, corps_md, saved_by) values ({cours_comp}, 'PreuveAjout', 'x', 'PreuveAjout')$aj$,
  $aj$r.saved_by = 'PreuveAjout'$aj$, null),
('public.cours_versions', 'unique', 'cours de compétence publié',
  $aj$insert into public.cours_versions (cours_id, titre, corps_md, saved_by) values ({cours_pub}, 'PreuveAjout', 'x', 'PreuveAjout')$aj$,
  $aj$r.saved_by = 'PreuveAjout'$aj$, null),
('public.cours_chunks', 'unique', null,
  $aj$insert into public.cours_chunks (cours_id, titre, contenu, ordre) values ({cours_theme}, 'PreuveAjout', 'x', 0)$aj$,
  $aj$r.titre = 'PreuveAjout'$aj$, null),
('public.qcm_questions', 'unique', null,
  $aj$insert into public.qcm_questions (qcm_id, enonce, section) values ({qcm_a}, 'PreuveAjout', 'PreuveAjout')$aj$,
  $aj$r.enonce = 'PreuveAjout'$aj$, null),
('public.qcm_options', 'unique', null,
  $aj$insert into public.qcm_options (question_id, texte) values ({question_a}, 'PreuveAjout')$aj$, $aj$r.texte = 'PreuveAjout'$aj$, null),
('public.qcm', 'unique', null,
  $aj$insert into public.qcm (theme_id, titre) values ({theme_c}, 'PreuveAjout')$aj$, $aj$r.titre = 'PreuveAjout'$aj$, null),
('public.themes', 'unique', null,
  $aj$insert into public.themes (titre, type, ordre) values ('PreuveAjout', 'notion', 9999)$aj$, $aj$r.titre = 'PreuveAjout'$aj$, null),
('public.competences', 'unique', null,
  $aj$insert into public.competences (code, libelle) values ('PREUVE', 'PreuveAjout')$aj$, $aj$r.libelle = 'PreuveAjout'$aj$, null),
('public.ressources', 'unique', null,
  $aj$insert into public.ressources (titre, url, categorie, description) values ('PreuveAjout', 'https://exemple.invalid', 'preuve', 'PreuveAjout')$aj$,
  $aj$r.titre = 'PreuveAjout'$aj$, null),
('public.contacts', 'unique', null,
  $aj$insert into public.contacts (prenom, note) values ('PreuveAjout', 'PreuveAjout')$aj$, $aj$r.prenom = 'PreuveAjout'$aj$, null),
('public.profs', 'unique', null,
  $aj$insert into public.profs (nom) values ('PreuveAjout')$aj$, $aj$r.nom = 'PreuveAjout'$aj$, null),
('public.qcm_signalements', 'unique', 'à son nom',
  $aj$insert into public.qcm_signalements (question_id, email, commentaire) values ({question_a}, {moi}, 'PreuveAjout')$aj$,
  $aj$r.commentaire = 'PreuveAjout'$aj$, null),
('public.qcm_signalements', 'unique', 'au nom d''un autre',
  $aj$insert into public.qcm_signalements (question_id, email, commentaire) values ({question_a}, {personnel}, 'PreuveAjout')$aj$,
  $aj$r.commentaire = 'PreuveAjout'$aj$, null),
('public.qcm_signalement_instruction', 'unique', null,
  $aj$insert into public.qcm_signalement_instruction (signalement_id, verdict_auto, analyse_auto) values (0, 'ambigu', 'PreuveAjout')$aj$,
  $aj$r.analyse_auto = 'PreuveAjout'$aj$, null),
('public.qcm_ia_brouillons', 'unique', null,
  $aj$insert into public.qcm_ia_brouillons (qcm_id, demande_par_email, enonce) values ({qcm_a}, 'PreuveAjout', 'PreuveAjout')$aj$,
  $aj$r.enonce = 'PreuveAjout'$aj$, null),
('public.conditions_acceptations', 'unique', null,
  $aj$insert into public.conditions_acceptations (email, version) values ({moi}, 'PreuveAjout')$aj$,
  $aj$r.version = 'PreuveAjout'$aj$, null),
('public.effacements_journal', 'unique', null,
  $aj$insert into public.effacements_journal (type, cible, fait_par_email) values ('stagiaire', 'PreuveAjout', 'PreuveAjout')$aj$,
  $aj$r.cible = 'PreuveAjout'$aj$, null),
('public.chatbot_usage', 'unique', null,
  $aj$insert into public.chatbot_usage (user_id, jour, nb) values ('00000000-0000-0000-0000-000000000000', '2031-01-06', 424242)$aj$,
  $aj$r.nb = 424242$aj$, null),
('public.qcm_ia_usage', 'unique', null,
  $aj$insert into public.qcm_ia_usage (user_id, jour, nb) values ('00000000-0000-0000-0000-000000000000', '2031-01-06', 424242)$aj$,
  $aj$r.nb = 424242$aj$, null),
('public.signalements_app', 'unique', null,
  $aj$insert into public.signalements_app (user_id, email, role, message) values ('00000000-0000-0000-0000-000000000000', 'PreuveAjout', 'stagiaire', 'PreuveAjout')$aj$,
  $aj$r.message = 'PreuveAjout'$aj$, null),
('public.signalements_app_captures', 'unique', null,
  $aj$insert into public.signalements_app_captures (signalement_id, image) values (0, 'data:image/jpeg;base64,UHJldXZl')$aj$,
  $aj$r.signalement_id = 0$aj$, null),
('storage.objects', 'unique', 'image de cours',
  $aj$insert into storage.objects (bucket_id, name) values ('cours-images', 'preuve/ajout.png')$aj$,
  $aj$r.name = 'preuve/ajout.png'$aj$, null),
('storage.objects', 'unique', 'image de QCM',
  $aj$insert into storage.objects (bucket_id, name) values ('qcm-images', 'preuve/ajout.png')$aj$,
  $aj$r.name = 'preuve/ajout.png'$aj$, null);

-- Les cibles d'un ajout dans un contexte : (libellé, jetons). p_jetons porte P, L et fiche du contexte, et les données
-- d'essai (cibles et bénévoles par promo et par lieu, tables cibles et benevoles_essai).
drop table if exists pg_temp.cibles;
create temp table cibles (promo integer primary key, fiche integer not null);
drop table if exists pg_temp.benevoles_essai;
create temp table benevoles_essai (lieu integer primary key, benevole integer not null);

create or replace function pg_temp.cibles_ajout(p_sorte text, p_jetons jsonb, p_promos integer[], p_lieux integer[])
returns table (libelle text, jetons jsonb) language plpgsql as $fx$
declare
  v_p integer := nullif(p_jetons ->> 'P', 'null')::integer;
  v_l integer := nullif(p_jetons ->> 'L', 'null')::integer;
  v_fiche integer := nullif(p_jetons ->> 'fiche', 'null')::integer;
  v_autre integer := (select x from unnest(p_promos) with ordinality u(x, o) where x is distinct from v_p order by o limit 1);
  v_autre_lieu integer := (select x from unnest(p_lieux) with ordinality u(x, o) where x is distinct from v_l order by o limit 1);
  k text;
begin
  if p_sorte = 'promo' then
    if v_p is not null then return query select 'promo affichée'::text, jsonb_build_object('c_promo', v_p::text); end if;
    return query select 'autre promo'::text, jsonb_build_object('c_promo', v_autre::text);
  elsif p_sorte = 'lieu' then
    if v_l is not null then return query select 'lieu affiché'::text, jsonb_build_object('c_lieu', v_l::text); end if;
    return query select 'autre lieu'::text, jsonb_build_object('c_lieu', v_autre_lieu::text);
  elsif p_sorte = 'stagiaire' then
    if v_fiche is not null then return query select 'sa fiche'::text, jsonb_build_object('c_stag', v_fiche::text); end if;
    if v_p is not null then
      return query select 'autre fiche de la promo affichée'::text,
                          jsonb_build_object('c_stag', (select c.fiche from cibles c where c.promo = v_p)::text);
    end if;
    return query select 'fiche d''une autre promo'::text,
                        jsonb_build_object('c_stag', (select c.fiche from cibles c where c.promo = v_autre)::text);
  elsif p_sorte = 'benevole' then
    if v_l is not null then
      return query select 'bénévole du lieu affiché'::text,
        jsonb_build_object('c_benevole', (select b.benevole from benevoles_essai b where b.lieu = v_l)::text, 'c_lieu', v_l::text);
    end if;
    return query select 'bénévole d''un autre lieu'::text,
      jsonb_build_object('c_benevole', (select b.benevole from benevoles_essai b where b.lieu = v_autre_lieu)::text,
                         'c_lieu', v_autre_lieu::text);
  elsif p_sorte = 'reglage' then
    foreach k in array array['preuve_ecriture', 'modules', 'navigation_v2', 'emargement_actif'] loop
      if v_p is not null then
        return query select format('clé %s, promo affichée', k), jsonb_build_object('c_promo', v_p::text, 'c_cle', quote_literal(k));
      end if;
      return query select format('clé %s, autre promo', k), jsonb_build_object('c_promo', v_autre::text, 'c_cle', quote_literal(k));
    end loop;
  else
    return query select null::text, '{}'::jsonb;
  end if;
end $fx$;

-- Verdict de cette preuve : lève TOUJOURS une exception, qui annule tout. Première ligne : VERT ou ROUGE, réussis et
-- échecs, mode, durée ; puis les contrôles par groupe, la matrice par personnage et par table, chaque contrôle hors
-- matrice nommé (une ligne chacun, avec ses réussis/joués ; les contrôles de non-régression, un par compte réel, sont
-- regroupés sur une ligne), et les lignes d'information (jamais comptées). S'il y a des échecs, ils suivent : ceux hors
-- matrice en détail (60 au plus), la carte des échecs de la matrice (pour chaque personnage, une ligne par signature :
-- L lecture, A ajout, M modification, S suppression, D déplacement de promo, suivis des contextes en échec, puis les
-- tables qui la partagent : toute case rouge y figure), puis les 12 premiers en détail. Sans aucun contrôle joué, le
-- verdict est ROUGE.
create or replace function pg_temp.verdict_roles(p_mode text, p_debut timestamptz)
returns void language plpgsql as $fx$
declare v_ok integer; v_ko integer; v_txt text; v_msg text; v_n integer;
begin
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat = 'échec') into v_ok, v_ko from preuve;
  v_msg := format(E'%s %s/%s (tout est annulé) ; mode %s ; durée %s s',
    case when v_ko = 0 and v_ok > 0 then 'VERT' else 'ROUGE' end, v_ok, v_ko, p_mode,
    to_char(extract(epoch from clock_timestamp() - p_debut), 'FM990.0'));
  select string_agg(format('%s %s/%s', groupe, ok, n), ' ; ' order by premier) into v_txt
    from (select groupe, count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where etat <> 'info' group by groupe) g;
  v_msg := v_msg || E'\npar groupe (réussis/joués) : ' || coalesce(v_txt, 'aucun contrôle joué');
  select string_agg(format('%s %s/%s', qui, ok, n), ' ; ' order by premier) into v_txt
    from (select qui, count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where groupe = 'matrice' and qui is not null group by qui) q;
  v_msg := v_msg || E'\nmatrice par personnage (réussis/joués) : ' || coalesce(v_txt, 'aucune case jouée');
  select string_agg(format('%s %s/%s', regexp_replace(tbl, '^public\.', ''), ok, n), ' ; ' order by tbl) into v_txt
    from (select tbl, count(*) as n, count(*) filter (where etat = 'ok') as ok
            from preuve where groupe = 'matrice' and qui is not null group by tbl) t;
  v_msg := v_msg || E'\nmatrice par table (réussis/joués) : ' || coalesce(v_txt, 'aucune case jouée');
  select string_agg(format('- [%s] %s : %s/%s%s', c.groupe, c.l, c.ok, c.n, case when c.ok < c.n then ' ÉCHEC' else '' end),
                    E'\n' order by c.premier)
    into v_txt
    from (select groupe,
                 case when groupe = 'non-régression'
                      then regexp_replace(libelle, '^compte réel [0-9]+ \([^)]*\)', 'chaque compte réel')
                      else libelle end as l,
                 count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where etat <> 'info' and qui is null group by 1, 2) c;
  v_msg := v_msg || E'\ncontrôles hors matrice, un par ligne (réussis/joués) :\n' || coalesce(v_txt, '- aucun');
  select string_agg('- ' || libelle || coalesce(' : ' || nullif(detail, ''), ''), E'\n' order by num) into v_txt
    from preuve where etat = 'info';
  if v_txt is not null then
    v_msg := v_msg || E'\nà titre d''information (jamais compté) :\n' || v_txt;
  end if;
  if v_ko > 0 or v_ok = 0 then
    select count(*) into v_n from preuve where etat = 'échec' and qui is null;
    if v_n > 0 then
      select string_agg(format('- %s. [%s] %s', e.num, e.groupe, e.libelle) || coalesce(' : ' || nullif(left(e.detail, 420), ''), ''),
                        E'\n' order by e.num)
        into v_txt from (select * from preuve where etat = 'échec' and qui is null order by num limit 60) e;
      v_msg := v_msg || format(E'\néchecs hors matrice (%s premiers sur %s) :\n%s', least(v_n, 60), v_n, v_txt);
    end if;
    select count(*) into v_n from preuve where etat = 'échec' and qui is not null;
    if v_n > 0 then
      with e as (
        select p.qui, p.tbl, p.ctx, p.num,
               case when p.op = 'lecture' then 'L' when p.op like 'ajout%' then 'A' when p.op = 'modification' then 'M'
                    when p.op = 'déplacement' then 'D' else 'S' end as lettre,
               case when p.op = 'lecture' then 1 when p.op like 'ajout%' then 2 when p.op = 'modification' then 3
                    when p.op = 'déplacement' then 5 else 4 end as rang
          from preuve p where p.etat = 'échec' and p.qui is not null),
      l as (select e.qui, e.tbl, e.lettre, e.rang, string_agg(distinct e.ctx, ',' order by e.ctx) as ctxs
              from e group by e.qui, e.tbl, e.lettre, e.rang),
      t as (select l.qui, l.tbl, string_agg(l.lettre || ' ' || l.ctxs, ' ; ' order by l.rang) as ops
              from l group by l.qui, l.tbl),
      s as (select t.qui, t.ops, string_agg(regexp_replace(t.tbl, '^public\.', ''), ', ' order by t.tbl) as tables
              from t group by t.qui, t.ops),
      q as (select e.qui, min(e.num) as premier from e group by e.qui)
      select string_agg(format('- %s, %s : %s', s.qui, s.ops, s.tables), E'\n' order by q.premier, s.ops)
        into v_txt from s join q on q.qui = s.qui;
      v_msg := v_msg || format(E'\nmatrice, carte des %s cases en échec, par personnage et signature (L lecture, A ajout, M modification, S suppression, D déplacement de promo ; contextes 1, 2, 7, sans en-tête) :\n%s',
        v_n, v_txt);
      select string_agg(format('- %s', e.libelle) || coalesce(' : ' || nullif(left(e.detail, 200), ''), ''), E'\n' order by e.num)
        into v_txt from (select * from preuve where etat = 'échec' and qui is not null order by num limit 12) e;
      v_msg := v_msg || format(E'\nmatrice, %s premiers échecs en détail :\n%s', least(v_n, 12), v_txt);
    end if;
  end if;
  raise exception using message = v_msg;
end $fx$;

do $preuve$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  c_contextes constant text[] := array['1', '2', '7', null];
  c_promos constant integer[] := array[1, 2, 7];
  v_lieux integer[];
  v_tables text[];
  v_en_ligne boolean;
  v_etat text[] := array[null, null, null];
  v_retour text[] := array[null, null, null];
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_globaux jsonb; v_sequences text; v_jalons text := '';
  v_qcm_a bigint; v_qcm_b bigint; v_theme_a integer; v_theme_b integer; v_theme_c integer; v_question_a bigint;
  v_cours_theme uuid; v_cours_comp uuid; v_cours_pub uuid; v_seance bigint;
  v_fiche_cumul integer; v_sub_porteur text; v_sig bigint; v_vers integer; v_requete text; v_codes text[];
  c_personnel constant text := 'preuve.personnel@exemple.invalid';
  c_cumul constant text := 'preuve.cumul@exemple.invalid';
  c_orphelin_affecte constant text := 'preuve.orphelin.affecte@exemple.invalid';
  c_deplacables constant text[] := array['public.agenda_events', 'public.planning_entries', 'public.themes_progression'];
  v_r record; v_p record; v_c record; v_m0 record; v_m record; v_a record; v_k record;
  v_acces integer[]; v_defaut integer; v_pr integer; v_lieu integer; v_f boolean; v_d boolean; v_ctx text;
  v_txt text; v_obt text; v_att text; v_sql text; v_prep text; v_marque text; v_mes text; v_res text[];
  v_permis boolean; v_ok boolean; n integer; n2 integer; v_attendus text[];
  -- Ce que voit un personnage : « lignes:somme des empreintes des ctid » ; l'attendu, calculé en propriétaire dans
  -- la même lecture de la table : la même chose pour les lignes que la règle de lecture laisse voir, puis le nombre
  -- de lignes que modification et suppression doivent toucher, et le total.
  c_vue constant text := $pv$select count(*)::text || ':' || coalesce(sum(hashtext(ctid::text)::bigint), 0)::text from %s$pv$;
  c_attendus constant text := $pv$select array[count(*) filter (where l)::text || ':' || coalesce(sum(hashtext(t_id::text)::bigint) filter (where l), 0)::text,
      count(*) filter (where m)::text, count(*) filter (where s)::text, count(*)::text]
      from (select r.ctid as t_id, coalesce((%s), false) as l, coalesce((%s), false) as m, coalesce((%s), false) as s
              from %s r) x$pv$;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'en-ligne%';
  v_lieux := array(select l.id from public.lieux l order by l.id);

  -- 1. Avant les migrations : empreinte, comptes réels et leurs jetons, tables à photographier, photo. La requête
  --    reçue par la base est résumée d'abord (md5 et longueur, à rapprocher du fichier transmis en une requête) : la
  --    passerelle MCP ajoute à la fin de la requête un suffixe « \n\n-- source: ... -- user: ... -- date: ... » (108
  --    caractères le 29/10, un identifiant d'utilisateur y figure : il n'est pas relu ici), retiré avant de hacher.
  v_requete := regexp_replace(current_query(), E'\n\n-- source:[^\n]*(\n-- [^\n]*)*[[:space:]]*$', '');
  perform pg_temp.informer('requête reçue par la base, suffixe de la passerelle retiré (md5, caractères, début), à rapprocher du fichier transmis',
    format('%s, %s, « %s »%s', md5(v_requete), length(v_requete), left(v_requete, 60),
           case when v_requete = current_query() then ' (aucun suffixe de passerelle)' else '' end));
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  perform pg_temp.informer('empreinte d''avant égale aux valeurs relevées sur la production le 29/10 (R15 : information)',
    case when v_av_regles = '7bebc7c741946940910bcec3d0a54201' and v_av_fonctions = '8daa39271f710e51c5eb1f93f0d9de65'
              and v_av_droits = '43eb26d5856fe86d741e334b229e8617' then 'oui'
         else format('non (dérive de la production depuis le 29/10) : regles %s, fonctions %s, droits %s',
                     v_av_regles, v_av_fonctions, v_av_droits) end);
  insert into comptes (num, email, etiquette)
    select row_number() over (order by up.email), up.email,
           case when up.is_founder then 'fondateur'
                when up.role = 'prof' and up.is_admin then 'formateur'
                when up.role = 'stagiaire' then 'stagiaire' || coalesce(', promo ' || s.promo_id, ', sans fiche')
                else 'autre (' || up.role || ')' end
      from public.user_profiles up left join public.stagiaires s on s.id = up.stagiaire_id
     where lower(up.email) not like '%@exemple.invalid';
  begin
    insert into jetons (email, sub)
      select distinct on (lower(c.email)) lower(c.email), u.id::text
        from comptes c join auth.users u on lower(u.email) = lower(c.email)
       order by lower(c.email), u.id;
  exception when others then
    perform pg_temp.informer('identifiants des jetons des comptes réels', 'auth.users illisible (' || sqlstate || ') : sans sub');
  end;
  perform pg_temp.verifier('structure', 'comptes réels trouvés par requête (profils hors @exemple.invalid), avec l''identifiant de leur jeton',
    (select count(*) from comptes) > 0,
    format('%s compte(s) : %s ; %s identifiant(s) de jeton', (select count(*) from comptes),
           (select string_agg(format('%s %s', e.nb, e.etiquette), ', ' order by e.etiquette)
              from (select c.etiquette, count(*) as nb from comptes c group by c.etiquette) e),
           (select count(*) from jetons)));
  -- stag_n porte l'identifiant de jeton d'un compte réel non fondateur (signalements_app renvoie à auth.users, aucun
  -- identifiant fictif n'y tient) : celui qui a le plus de lignes dans chatbot_usage puis dans qcm_ia_usage, pour que
  -- les branches « la sienne » de ces deux tables aient des lignes à voir ; à défaut le plus petit identifiant. L'identifiant
  -- n'est ni affiché ni gardé ailleurs que dans la table temporaire jetons.
  select j.sub into v_sub_porteur
    from jetons j join comptes c on lower(c.email) = j.email
   where c.etiquette <> 'fondateur'
   order by (select count(*) from public.chatbot_usage u where u.user_id::text = j.sub) desc,
            (select count(*) from public.qcm_ia_usage u where u.user_id::text = j.sub) desc, j.sub
   limit 1;
  if v_sub_porteur is not null then
    insert into jetons (email, sub) select lower(p.email), v_sub_porteur from personnages p where p.nom = 'stag_n';
  end if;
  v_tables := array(select format('%I.%I', ns.nspname, c.relname) from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
                     where ns.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity order by c.relname)
              || array['storage.objects'];
  v_sequences := (select format('lieux %s, promos %s',
                                (select last_value || '/' || is_called from public.lieux_id_seq),
                                (select last_value || '/' || is_called from public.promos_id_seq)));
  if v_en_ligne then
    perform pg_temp.informer('non-régression des comptes réels',
      'non jugeable en mode en-ligne : rien n''est injecté, l''avant et l''après seraient les mêmes règles');
  else
    perform pg_temp.photo('avant', v_tables, c_contextes);
  end if;

  v_jalons := v_jalons || format(' ; photo avant %s s', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0'));
  -- 2. Les migrations, injectées telles quelles, dans l'ordre (une étape non demandée est neutralisée).
  v_etat[1] := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261028_roles_1_fondations.sql@@
  );
  v_etat[2] := pg_temp.jouer('migration 2',
-- @@INJECTER supabase/migrations/20261028_roles_2_fonctions.sql@@
  );
  v_etat[3] := pg_temp.jouer('migration 3',
-- @@INJECTER supabase/migrations/20261028_roles_3_regles.sql@@
  );
  for n in 1 .. 3 loop
    if v_etat[n] = 'neutralisée' then
      perform pg_temp.informer(format('migration %s', n), 'non injectée (' || v_mode || ')');
    else
      perform pg_temp.verifier('structure', format('migration %s jouée sans erreur', n), v_etat[n] = 'jouée', v_etat[n]);
    end if;
  end loop;

  v_jalons := v_jalons || format(' ; migrations %s s', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0'));
  -- 3. Non-régression : la photo d'après, avant toute donnée d'essai, comparée à celle d'avant.
  if not v_en_ligne then
    perform pg_temp.photo('après', v_tables, c_contextes);
    for v_r in
      select c.num, c.etiquette,
             count(*) filter (where a.tbl not in ('mes_promos()', 'profil')) as n_cases,
             count(*) filter (where a.tbl not in ('mes_promos()', 'profil') and b.valeur is distinct from a.valeur) as n_diff,
             string_agg(format('%s %s : %s > %s', a.ctx, regexp_replace(a.tbl, '^public\.', ''), split_part(a.valeur, ':', 1),
                               coalesce(split_part(b.valeur, ':', 1), 'absent')
                               || case when split_part(a.valeur, ':', 1) = split_part(b.valeur, ':', 1)
                                       then ' (autres lignes)' else '' end), ' ; ' order by a.ctx, a.tbl)
               filter (where a.tbl not in ('mes_promos()', 'profil') and b.valeur is distinct from a.valeur) as diff,
             max(a.valeur) filter (where a.tbl = 'profil') as profil_avant, max(b.valeur) filter (where a.tbl = 'profil') as profil_apres,
             max(a.valeur) filter (where a.tbl = 'mes_promos()') as mes_avant, max(b.valeur) filter (where a.tbl = 'mes_promos()') as mes_apres
        from comptes c
        left join photos a on a.moment = 'avant' and a.compte = c.num
        left join photos b on b.moment = 'après' and b.compte = a.compte and b.ctx = a.ctx and b.tbl = a.tbl
       group by c.num, c.etiquette order by c.num
    loop
      perform pg_temp.verifier('non-régression',
        format('compte réel %s (%s) : mêmes lignes visibles sur chacune des %s tables, contextes 1, 2, 7 et sans en-tête',
               v_r.num, v_r.etiquette, cardinality(v_tables)),
        v_r.n_cases = cardinality(v_tables) * cardinality(c_contextes) and v_r.n_diff = 0,
        format('%s case(s) comparée(s), %s différente(s)%s', v_r.n_cases, v_r.n_diff, coalesce(' : ' || v_r.diff, '')));
      perform pg_temp.verifier('non-régression',
        format('compte réel %s (%s) : mêmes role, is_admin, is_founder, stagiaire_id', v_r.num, v_r.etiquette),
        v_r.profil_avant is not null and v_r.profil_avant = v_r.profil_apres,
        case when v_r.profil_avant = v_r.profil_apres then '' else 'le profil a changé' end);
      perform pg_temp.verifier('non-régression',
        format('compte réel %s (%s) : mêmes mes_promos() (colonne roles mise à part)', v_r.num, v_r.etiquette),
        v_r.mes_avant is not null and v_r.mes_avant = v_r.mes_apres,
        format('avant %s promo(s), après %s', split_part(v_r.mes_avant, ':', 1), coalesce(split_part(v_r.mes_apres, ':', 1), 'absent'))
          || case when v_r.mes_avant = v_r.mes_apres then '' else ' (contenu différent)' end);
    end loop;
  end if;

  v_jalons := v_jalons || format(' ; photo après et comparaison %s s', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0'));
  -- 4. Personnages fictifs et données d'essai, en propriétaire, après la photo d'après (ils n'y entrent pas).
  --    Déclencheurs de stagiaires et user_profiles relus d'abord (lecture seule) : rien d'autre ne doit s'y déclencher.
  perform pg_temp.informer('déclencheurs de stagiaires et user_profiles, relus avant de poser les personnages',
    coalesce((select string_agg(format('%s.%s', c.relname, t.tgname), ', ' order by 1)
                from pg_trigger t join pg_class c on c.oid = t.tgrelid
               where c.oid in ('public.stagiaires'::regclass, 'public.user_profiles'::regclass) and not t.tgisinternal),
             'aucun'));
  -- Fiches des stagiaires fictifs (les personnages qui en ont une, dont le fondateur et celui qui masque ses notes),
  -- cibles des ajouts (une par promo, sans compte ni dossier), témoins (une par promo, avec une ligne dans chaque table
  -- d'une fiche), et la fiche du compte « cumul » (promo 1).
  for v_p in select * from personnages where promo_fiche is not null order by ordre loop
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve ' || v_p.nom, 'PREUVE', 990, v_p.promo_fiche)
      returning id into n;
    update personnages set fiche = n where ordre = v_p.ordre;
  end loop;
  foreach v_pr in array c_promos loop
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve cible', 'PREUVE', 991, v_pr) returning id into n;
    insert into cibles (promo, fiche) values (v_pr, n);
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve témoin', 'PREUVE', 992, v_pr);
  end loop;
  insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve cumul', 'PREUVE', 994, 1) returning id into v_fiche_cumul;
  -- Comptes : les personnages (le fondateur avec is_founder, celui qui masque ses notes avec anonymous_notes), un compte
  -- « cumul » (stagiaire de la promo 1 qui est aussi formateur de la promo 2), un compte orphelin (role stagiaire, sans
  -- fiche), un orphelin affecté (au siège) et un compte du personnel sans affectation (cible des ajouts d'affectation et
  -- des signalements « au nom d'un autre »). Les deux comptes affectés vérifient la règle « jamais la suppression d'un
  -- compte qui a une affectation » : leurs affectations (promo 2, siège) échappent à la vue des formateurs de la promo 1
  -- et de la direction du lieu 1, qu'une sous-requête sous RLS ne verrait donc pas.
  insert into public.user_profiles (email, role, is_admin, is_founder, anonymous_notes, stagiaire_id)
    select p.email, p.role, p.is_admin, p.fondateur, p.anonyme, p.fiche from personnages p order by p.ordre;
  insert into public.user_profiles (email, role, stagiaire_id) values (c_cumul, 'stagiaire', v_fiche_cumul);
  insert into public.user_profiles (email, role) values ('preuve.orpheline@exemple.invalid', 'stagiaire'),
    (c_orphelin_affecte, 'stagiaire'), (c_personnel, 'prof');
  insert into public.affectations (email, role, promo_id, lieu_id)
    select p.email, 'formateur', x, null from personnages p cross join unnest(p.formateur_de) x
    union all select p.email, 'direction', null, x from personnages p cross join unnest(p.direction_de) x
    union all select p.email, 'siege', null, null from personnages p where p.siege
    union all select c_cumul, 'formateur', 2, null
    union all select c_orphelin_affecte, 'siege', null, null;
  -- Thèmes et QCM d'essai : A porte les tentatives, les examens et la progression ; B sert aux ajouts d'examens et de
  -- progression (ses lignes recopiées par déclencheur sont retirées) ; C, sans QCM, aux ajouts de QCM.
  insert into public.themes (titre, type, ordre) values ('Preuve thème A', 'notion', 9999) returning id into v_theme_a;
  insert into public.themes (titre, type, ordre) values ('Preuve thème B', 'notion', 9999) returning id into v_theme_b;
  insert into public.themes (titre, type, ordre) values ('Preuve thème C', 'notion', 9999) returning id into v_theme_c;
  insert into public.qcm (theme_id, titre) values (v_theme_a, 'Preuve QCM A') returning id into v_qcm_a;
  insert into public.qcm (theme_id, titre) values (v_theme_b, 'Preuve QCM B') returning id into v_qcm_b;
  delete from public.qcm_examens where qcm_id = v_qcm_b;
  delete from public.themes_progression where theme_id in (v_theme_b, v_theme_c);
  insert into public.qcm_questions (qcm_id, enonce) values (v_qcm_a, 'Preuve question A') returning id into v_question_a;
  insert into public.qcm_options (question_id, texte, is_correct) values (v_question_a, 'Preuve oui', true), (v_question_a, 'Preuve non', false);
  -- Lignes d'essai dans chaque portée : chaque promo (1, 2, 7) a au moins une ligne dans chaque table de promo, chaque
  -- lieu dans chaque table de lieu ; chaque fiche d'essai (stagiaires fictifs, témoins) une ligne dans chaque table
  -- d'une fiche (les lignes M des stagiaires fictifs).
  foreach v_pr in array c_promos loop
    insert into public.agenda_events (date_start, title, promo_id) values ('2030-01-07', 'Preuve', v_pr);
    insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, lane, activite, promo_id)
      values ('2030-01-07', 0, 'matin', 9, 9, 'Cours', v_pr);
    insert into public.planning_half_meta (semaine_lundi, day_index, half_day, start_time, end_time, promo_id)
      values ('2030-01-07', 0, 'matin', '08:30', '12:00', v_pr);
    insert into public.planning_jours_off (semaine_lundi, day_index, label, promo_id) values ('2030-01-07', 4, 'Preuve', v_pr);
    insert into public.settings (key, value, promo_id)
      select k, 'PreuveEssai', v_pr from unnest(array['preuve_cle', 'modules', 'navigation_v2', 'emargement_actif']) k
      on conflict (promo_id, key) do nothing;
    insert into public.qcm_examens (promo_id, qcm_id) values (v_pr, v_qcm_a) on conflict (promo_id, qcm_id) do nothing;
    insert into public.themes_progression (promo_id, theme_id, statut) values (v_pr, v_theme_a, 'En cours')
      on conflict (promo_id, theme_id) do nothing;
    insert into public.evaluations_audit (action, changed_by_email, promo_id) values ('insert', 'preuve@exemple.invalid', v_pr);
    insert into public.passages_audit (action, changed_by_who, promo_id) values ('insert', 'preuve', v_pr);
    insert into public.emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par)
      values (v_pr, '2030-01-07', 'matin', '08:30', '12:00', 'preuve@exemple.invalid') returning id into v_seance;
    insert into public.emargement_formateurs (seance_id, promo_id, nom, trace, signe_par)
      values (v_seance, v_pr, 'Preuve formateur', 'M1 1L2 2', 'preuve@exemple.invalid');
    for v_r in select s.id from public.stagiaires s
                where s.promo_id = v_pr and (s.prenom = 'Preuve témoin' or s.id in (select p.fiche from personnages p)) loop
      insert into public.stagiaires_prive (stagiaire_id, date_naissance) values (v_r.id, '2000-01-01');
      insert into public.evaluations (stagiaire_id, type, theme_numero, note, observation) values (v_r.id, 'Thème', 1, 12, 'Preuve');
      insert into public.epcf_evaluations (stagiaire_id, trame, commentaire) values (v_r.id, 'salle', 'Preuve');
      insert into public.epcf_livrets (stagiaire_id) values (v_r.id);
      insert into public.dp_dossiers (stagiaire_id) values (v_r.id);
      insert into public.fiches_suivi (stagiaire_id) values (v_r.id);
      insert into public.passages (date, stagiaire_id, type, resultat, commentaire) values ('2030-01-07', v_r.id, 'Salle', 'Effectué', 'Preuve');
      insert into public.qcm_attempts (qcm_id, stagiaire_id, mode, score, total, note_20) values (v_qcm_a, v_r.id, 'entrainement', 1, 2, 10);
      insert into public.emargement_lignes (seance_id, promo_id, stagiaire_id) values (v_seance, v_pr, v_r.id);
    end loop;
  end loop;
  foreach v_lieu in array v_lieux loop
    insert into public.auto_ecoles (nom, lieu_id) values ('Preuve auto-école', v_lieu);
    insert into public.benevoles (prenom, lieu_id) values ('Preuve bénévole', v_lieu) returning id into n;
    insert into benevoles_essai (lieu, benevole) values (v_lieu, n);
    insert into public.benevole_suivi (benevole_id, semaine_lundi, day_index, half_day, commentaire, lieu_id)
      values (n, '2030-01-07', 0, 'matin', 'Preuve', v_lieu);
  end loop;
  -- Lignes M des personnages (signalements et acceptations à leur nom), journal des effacements, un signalement de
  -- problème au nom du porteur du jeton de stag_n (le compte réel choisi plus haut : seul son identifiant sert, rien
  -- n'est affiché), avec sa capture.
  insert into public.qcm_signalements (question_id, email, stagiaire_id, motif, commentaire)
    select v_question_a, p.email, p.fiche, 'autre', 'Preuve' from personnages p;
  insert into public.conditions_acceptations (email, version) select p.email, 'preuve' from personnages p;
  insert into public.effacements_journal (type, cible, fait_par_email) values ('stagiaire', 'preuve', 'preuve@exemple.invalid');
  if v_sub_porteur is not null then
    insert into public.signalements_app (user_id, email, role, message)
      values (v_sub_porteur::uuid, 'preuve@exemple.invalid', 'stagiaire', 'Preuve signalement')
      returning id into v_sig;
    insert into public.signalements_app_captures (signalement_id, image) values (v_sig, 'data:image/jpeg;base64,UHJldXZl');
  end if;
  -- Cours : un cours de thème réel (les 57 numéros sont pris, aucun cours de thème fictif n'est possible) comme cible
  -- des ajouts de versions et de morceaux ; deux cours de compétence fictifs (un non publié, un publié) sous des codes
  -- libres (la cible des versions ne dépend d'aucun cours de compétence réel, publié ou non : les 36 cours réels sont
  -- publiés un à un par Timy, l'ensemble des cours non publiés change donc). Le déclencheur cours_rechunk fait les morceaux.
  select c.id into v_cours_theme from public.cours c where c.code is null order by c.numero nulls last, c.id limit 1;
  v_codes := array(select 'C' || a || '.' || b from generate_series(1, 4) a cross join generate_series(1, 9) b
                    where not exists (select 1 from public.cours x where x.code = 'C' || a || '.' || b)
                    order by b desc, a desc limit 2);
  if cardinality(v_codes) = 2 then
    insert into public.cours (titre, corps_md, code, published) values ('Preuve compétence non publiée', 'x', v_codes[1], false)
      returning id into v_cours_comp;
    insert into public.cours (titre, corps_md, code, published) values ('Preuve compétence publiée', 'x', v_codes[2], true)
      returning id into v_cours_pub;
  end if;
  v_globaux := jsonb_build_object(
    'qcm_a', v_qcm_a::text, 'qcm_b', v_qcm_b::text, 'theme_b', v_theme_b::text, 'theme_c', v_theme_c::text,
    'question_a', v_question_a::text, 'personnel', quote_literal(c_personnel),
    'cours_theme', coalesce(quote_literal(v_cours_theme::text), 'null'), 'cours_comp', coalesce(quote_literal(v_cours_comp::text), 'null'),
    'cours_pub', coalesce(quote_literal(v_cours_pub::text), 'null'),
    'lieu_promo1', coalesce((select pr.lieu_id from public.promos pr where pr.id = 1)::text, 'null'),
    'lieu_promo2', coalesce((select pr.lieu_id from public.promos pr where pr.id = 2)::text, 'null'));
  perform pg_temp.verifier('structure', 'personnages fictifs et données d''essai posés',
    (select count(*) from personnages) = 8 and (select count(*) from personnages where promo_fiche is not null and fiche is null) = 0
    and (select count(*) from cibles) = cardinality(c_promos) and v_cours_theme is not null and v_cours_comp is not null
    and v_cours_pub is not null and v_fiche_cumul is not null,
    format('%s personnage(s) ; cibles par promo : %s ; cours de thème %s, cours de compétence fictifs : %s',
           (select count(*) from personnages), (select count(*) from cibles),
           case when v_cours_theme is null then 'absent' else 'trouvé' end,
           case when v_cours_comp is null or v_cours_pub is null then 'absents (moins de deux codes libres)' else 'posés (un non publié, un publié)' end));
  perform pg_temp.verifier('structure',
    'comptes affectés posés (cumul : fiche de la promo 1 et formateur de la promo 2 ; orphelin affecté : siège), et leurs affectations invisibles à form_n et dir_n',
    (select count(*) from public.affectations where email in (c_cumul, c_orphelin_affecte)) = 2
    and (select count(*) from public.user_profiles where email in (c_cumul, c_orphelin_affecte)) = 2
    and (select p.lieu_id from public.promos p where p.id = 2) is distinct from (select p.lieu_id from public.promos p where p.id = 1),
    format('%s affectation(s) sur %s profil(s) ; lieu de la promo 2 %s de celui de la promo 1',
           (select count(*) from public.affectations where email in (c_cumul, c_orphelin_affecte)),
           (select count(*) from public.user_profiles where email in (c_cumul, c_orphelin_affecte)),
           case when (select p.lieu_id from public.promos p where p.id = 2) is distinct from (select p.lieu_id from public.promos p where p.id = 1)
                then 'différent' else 'identique' end));
  if v_sub_porteur is null then
    perform pg_temp.informer('signalement de problème d''essai', 'non posé : aucun identifiant de jeton réel non fondateur (auth.users illisible ou sans compte), les contrôles « signalements » sont non jugeables');
  else
    perform pg_temp.verifier('structure',
      'signalement de problème d''essai posé au nom du jeton de stag_n (compte réel non fondateur), avec sa capture',
      (select count(*) from public.signalements_app s where s.id = v_sig and s.user_id::text = v_sub_porteur) = 1
      and (select count(*) from public.signalements_app_captures c where c.signalement_id = v_sig) = 1
      and exists (select 1 from jetons j join personnages p on lower(p.email) = j.email where p.nom = 'stag_n' and j.sub = v_sub_porteur),
      format('lignes de ce compte : %s dans chatbot_usage, %s dans qcm_ia_usage',
             (select count(*) from public.chatbot_usage u where u.user_id::text = v_sub_porteur),
             (select count(*) from public.qcm_ia_usage u where u.user_id::text = v_sub_porteur)));
  end if;

  v_jalons := v_jalons || format(' ; personnages et données %s s', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0'));
  -- 5. Le modèle : pour chaque personnage et chaque contexte, ses drapeaux tirés de sa définition (R23).
  drop table if exists pg_temp.contextes;
  create temp table contextes (ordre integer, rang integer, qui text, email text, ctx text, hdr text, jetons jsonb,
    tables text[]);
  for v_p in select * from personnages order by ordre loop
    v_acces := array(select pr.id from public.promos pr
                      where v_p.fondateur or pr.id = v_p.promo_fiche or pr.id = any(v_p.formateur_de)
                         or pr.lieu_id = any(v_p.direction_de)
                      order by pr.id);
    v_defaut := coalesce(v_p.promo_fiche,
      (select pr.id from public.promos pr where pr.id = any(v_acces) and (pr.date_fin is null or pr.date_fin >= current_date)
        order by pr.date_debut, pr.id limit 1),
      (select pr.id from public.promos pr where pr.id = any(v_acces) order by pr.date_debut desc, pr.id desc limit 1));
    for n in 1 .. cardinality(c_contextes) loop
      v_ctx := c_contextes[n];
      v_pr := case when v_ctx is null then v_defaut when v_ctx::integer = any(v_acces) then v_ctx::integer end;
      v_lieu := (select pr.lieu_id from public.promos pr where pr.id = v_pr);
      v_f := v_pr is not null and (v_p.fondateur or v_pr = any(v_p.formateur_de));
      v_d := v_pr is not null and (v_p.fondateur or v_lieu = any(v_p.direction_de));
      insert into contextes (ordre, rang, qui, email, ctx, hdr, tables, jetons) values (v_p.ordre, n, v_p.nom, v_p.email,
        coalesce(v_ctx, 'sans'), v_ctx, v_p.tables,
        jsonb_build_object(
          'P', coalesce(v_pr::text, 'null'), 'L', coalesce(v_lieu::text, 'null'),
          'F', v_f::text, 'D', v_d::text, 'E', (v_f or v_d)::text, 'S', (v_p.siege or v_p.fondateur)::text,
          'R', (v_f or v_p.siege or v_p.fondateur)::text, 'Fo', v_p.fondateur::text,
          'moi', quote_literal(lower(v_p.email)),
          'sub', coalesce((select quote_literal(j.sub) || '::uuid' from jetons j where j.email = lower(v_p.email)), 'null'),
          'fiche', coalesce(v_p.fiche::text, 'null'),
          'fiche_p', coalesce(case when v_p.promo_fiche = v_pr then v_p.fiche end::text, 'null'),
          'anonyme', v_p.anonyme::text,
          'acces', quote_literal(v_acces::text) || '::integer[]',
          'form_de', quote_literal((case when v_p.fondateur then array(select pr.id from public.promos pr order by pr.id)
                                         else v_p.formateur_de end)::text) || '::integer[]',
          'dir_de', quote_literal((case when v_p.fondateur then v_lieux else v_p.direction_de end)::text) || '::integer[]'));
    end loop;
  end loop;
  -- L'acteur anonyme (R22 : requête sans jeton, rôle anon) : aucun drapeau, aucune promo, aucune fiche, aucun email ni
  -- identifiant. Il ne voit aucune ligne, sauf ce que la section 1 ouvre à tous (les deux seaux publics du stockage),
  -- et n'écrit nulle part. Deux contextes (en-tête x-promo-id 1, et sans en-tête) suffisent : l'en-tête ne lui donne rien.
  for n in 1 .. 2 loop
    insert into contextes (ordre, rang, qui, email, ctx, hdr, jetons) values (9, n, 'anon', null,
      case n when 1 then '1' else 'sans' end, case n when 1 then '1' end,
      jsonb_build_object('P', 'null', 'L', 'null', 'F', 'false', 'D', 'false', 'E', 'false', 'S', 'false', 'R', 'false',
        'Fo', 'false', 'moi', 'null', 'sub', 'null', 'fiche', 'null', 'fiche_p', 'null', 'anonyme', 'false',
        'acces', '''{}''::integer[]', 'form_de', '''{}''::integer[]', 'dir_de', '''{}''::integer[]'));
  end loop;

  -- 6. La matrice : pour chaque table, chaque personnage et chaque contexte, la lecture (nombre et empreinte des ctid),
  --    la modification et la suppression sur toute la table, puis les ajouts. Table par table, les tables mères d'une
  --    cascade d'abord (thèmes, QCM, questions, réponses, tentatives, fiches...) : leurs suppressions parcourent des
  --    tables filles pas encore alourdies par les versions mortes des modifications annulées.
  for v_m0 in select m.* from matrice m
                order by array_position(array['public.themes', 'public.qcm', 'public.qcm_questions', 'public.qcm_options',
                                              'public.qcm_attempts', 'public.stagiaires', 'public.competences', 'public.profs',
                                              'public.benevoles', 'public.auto_ecoles', 'public.signalements_app',
                                              'public.qcm_signalements', 'public.user_profiles'], m.tbl) nulls last, m.tbl loop
   if clock_timestamp() - v_debut > interval '90 seconds' then
     perform pg_temp.verifier('matrice', 'matrice interrompue : plus de 90 secondes écoulées (garde-fou de durée)', false,
       format('arrêt avant la table %s', v_m0.tbl));
     exit;
   end if;
   for v_c in select * from contextes order by ordre, rang loop
    continue when v_c.tables is not null and v_m0.tbl <> all(v_c.tables);
    -- L'acteur anonyme ne lit rien, sauf les seaux publics du stockage (la condition de lecture de la matrice) : pour
    -- lui, « tous les connectés » ne vaut pas « tous ».
    for v_m in select v_m0.tbl,
                      case when v_c.qui = 'anon' and v_m0.tbl <> 'storage.objects' then 'false'
                           else pg_temp.remplir(v_m0.lecture, v_c.jetons) end as lecture,
                      pg_temp.remplir(v_m0.ajout, v_c.jetons) as ajout, pg_temp.remplir(v_m0.modif, v_c.jetons) as modif,
                      pg_temp.remplir(v_m0.suppr, v_c.jetons) as suppr, v_m0.maj, v_m0.prep_suppr loop
      -- Les attendus de la case, en une lecture de la table en propriétaire : {lecture, à modifier, à supprimer, total}
      -- (nul si le calcul échoue : la case échoue alors, jamais ne passe).
      v_txt := pg_temp.calcul(format(c_attendus, v_m.lecture, v_m.modif, v_m.suppr, v_m.tbl));
      v_attendus := case when v_txt like '{%' then v_txt::text[] end;
      -- Lecture : mêmes lignes (nombre et empreinte des ctid).
      v_obt := pg_temp.valeur(v_c.email, v_c.hdr, null, format(c_vue, v_m.tbl));
      v_att := v_attendus[1];
      -- (L'acteur anonyme n'a le droit de lire qu'un petit nombre de tables : sur les autres, le refus de droit, 42501,
      -- vaut « aucune ligne ».)
      perform pg_temp.verifier_m('matrice', v_c.qui, v_c.ctx, v_m.tbl, 'lecture',
        v_obt = v_att or (v_c.qui = 'anon' and v_obt = 'ERREUR 42501' and split_part(v_att, ':', 1) = '0'),
        format('vu %s, attendu %s', coalesce(split_part(v_obt, ':', 1), 'nul'), coalesce(split_part(v_att, ':', 1), v_txt))
        || case when split_part(v_obt, ':', 1) = split_part(v_att, ':', 1) and v_obt <> v_att then ' (autres lignes)' else '' end);
      -- Modification de toute la table, valeur constante : « OK n n 0 » (n lignes attendues, toutes marquées, aucune
      -- hors de la règle) ; un refus de droit vaut 0.
      v_res := pg_temp.tenter(v_c.email, v_c.hdr, null, null, null,
        format('update %s set %s', v_m.tbl, v_m.maj),
        format('select count(*) filter (where r.%1$s)::text || '' '' || count(*) filter (where r.%1$s and not coalesce((%2$s), false))::text from %3$s r',
               v_m.maj, v_m.modif, v_m.tbl));
      perform pg_temp.verifier_m('matrice', v_c.qui, v_c.ctx, v_m.tbl, 'modification',
        v_attendus is not null
        and (v_res[2] = format('OK %s %s 0', v_attendus[2], v_attendus[2]) or (v_attendus[2] = '0' and v_res[2] = 'REFUS 42501')),
        format('obtenu %s, attendu OK %s', v_res[2], coalesce(v_attendus[2], 'incalculable')));
      -- Suppression de toute la table : « OK n reste 0 » (n lignes attendues, total moins n restantes, aucune de la règle).
      v_res := pg_temp.tenter(v_c.email, v_c.hdr, null, v_m.prep_suppr, null,
        format('delete from %s', v_m.tbl),
        format('select count(*)::text || '' '' || count(*) filter (where coalesce((%s), false))::text from %s r', v_m.suppr, v_m.tbl));
      v_att := case when v_attendus is not null
                    then format('OK %s %s 0', v_attendus[3], v_attendus[4]::bigint - v_attendus[3]::bigint) end;
      perform pg_temp.verifier_m('matrice', v_c.qui, v_c.ctx, v_m.tbl, 'suppression',
        v_res[2] = v_att or (v_attendus[3] = '0' and v_res[2] = 'REFUS 42501'),
        format('obtenu %s, attendu %s', v_res[2], coalesce(v_att, 'incalculable')));
      -- Déplacement : sur trois tables de promo, faire passer promo_id vers une autre promo n'est permis à personne. La
      -- condition d'écriture porte aussi sur la ligne nouvelle (WITH CHECK) : une règle qui ne la contrôlerait plus
      -- laisserait un formateur vider sa promo dans une autre. Attendu : refus (42501) ou aucune ligne touchée, et le
      -- nombre de lignes de la promo cible n'a pas bougé.
      if v_m.tbl = any(c_deplacables) then
        v_vers := (select x from unnest(c_promos) x where x is distinct from nullif(v_c.jetons ->> 'P', 'null')::integer
                    order by x limit 1);
        v_res := pg_temp.tenter(v_c.email, v_c.hdr, null, null,
          format('select count(*)::text from %s where promo_id = %s', v_m.tbl, v_vers),
          format('update %s set promo_id = %s', v_m.tbl, v_vers),
          format('select count(*)::text from %s where promo_id = %s', v_m.tbl, v_vers));
        perform pg_temp.verifier_m('matrice', v_c.qui, v_c.ctx, v_m.tbl, 'déplacement',
          v_res[2] = 'REFUS 42501' or (v_res[1] is not null and v_res[2] = 'OK 0 ' || v_res[1]),
          format('obtenu %s, attendu REFUS 42501 ou OK 0 %s (lignes de la promo %s avant : %s)', v_res[2], coalesce(v_res[1], 'incalculable'),
                 v_vers, coalesce(v_res[1], 'incalculable')));
      end if;
    end loop;
    -- Ajouts : l'attendu est la règle appliquée à la ligne même, écrite en propriétaire puis annulée (une règle
    -- « false » se passe de cet essai, comme l'acteur anonyme, à qui rien n'est permis) ; « OK 1 1 » si permis,
    -- « REFUS 42501 » sinon.
    for v_a in select a.*, v_m0.ajout as ajout from ajouts a where a.tbl = v_m0.tbl order by a.ordre loop
      for v_k in select * from pg_temp.cibles_ajout(v_a.sorte, v_c.jetons, c_promos, v_lieux) loop
        v_sql := pg_temp.remplir(v_a.modele, v_c.jetons || v_globaux || v_k.jetons);
        v_marque := pg_temp.remplir(v_a.marque, v_c.jetons || v_globaux || v_k.jetons);
        v_prep := pg_temp.remplir(v_a.prep, v_c.jetons || v_globaux || v_k.jetons);
        if v_a.ajout = 'false' or v_c.qui = 'anon' then
          v_permis := false; v_mes := 'aucune règle';
        else
          v_mes := pg_temp.essai_proprio(v_c.email, v_c.hdr, null, v_prep, v_sql,
            format('select coalesce(bool_and(coalesce((%s), false)), false)::text || '' '' || count(*)::text from %s r where %s',
                   pg_temp.remplir(v_a.ajout, v_c.jetons), v_a.tbl, v_marque));
          v_permis := case v_mes when 'true 1' then true when 'false 1' then false end;
        end if;
        v_att := case when v_permis then 'OK 1 1' when not v_permis then 'REFUS 42501'
                      else 'incalculable (essai en propriétaire : ' || coalesce(v_mes, 'nul') || ')' end;
        v_res := pg_temp.tenter(v_c.email, v_c.hdr, null, v_prep, null, v_sql,
          format('select count(*)::text from %s r where %s', v_a.tbl, v_marque));
        perform pg_temp.verifier_m('matrice', v_c.qui, v_c.ctx, v_a.tbl,
          'ajout' || coalesce(' (' || coalesce(v_a.libelle, v_k.libelle) || ')', ''),
          v_res[2] = v_att, format('obtenu %s, attendu %s', v_res[2], v_att));
      end loop;
    end loop;
   end loop;
  end loop;

  v_jalons := v_jalons || format(' ; matrice %s s', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0'));
  -- 7. Contrôles ciblés, aux attendus écrits en dur : aucun ne lit le modèle de la matrice, un modèle faux ne peut donc pas
  --    les faire passer. Les acteurs sont les huit personnages et l'acteur anonyme.
  --    a) Le signalement de problème d'essai appartient au jeton de stag_n : lui et le fondateur le voient (avec sa
  --       capture), les autres non ; le fondateur seul le supprime.
  if v_sig is null then
    perform pg_temp.informer('signalements de problème (contrôles ciblés)', 'non jugeables : aucun signalement d''essai posé (voir la structure)');
  else
    v_obt := ''; v_att := '';
    for v_p in select * from (select p.nom, p.email, p.fondateur, p.ordre, exists (select 1 from jetons j where j.email = lower(p.email)) as porteur
                                from personnages p union all select 'anon', null, false, 99, false) u order by u.ordre loop
      v_res := pg_temp.tenter(v_p.email, '1', null, null, null, format('delete from public.signalements_app where id = %s', v_sig), null);
      -- (un refus de droit, 42501, vaut « aucune ligne » : l'acteur anonyme n'a le droit de lire aucune de ces deux tables)
      v_obt := v_obt || format('%s %s/%s/%s ; ', v_p.nom,
        replace(coalesce(pg_temp.valeur(v_p.email, '1', null, format('select count(*)::text from public.signalements_app where id = %s', v_sig)), 'nul'), 'ERREUR 42501', '0'),
        replace(coalesce(pg_temp.valeur(v_p.email, '1', null, format('select count(*)::text from public.signalements_app_captures where signalement_id = %s', v_sig)), 'nul'), 'ERREUR 42501', '0'),
        case when v_res[2] like 'OK %' then split_part(v_res[2], ' ', 2) when v_res[2] = 'REFUS 42501' then '0' else v_res[2] end);
      v_att := v_att || format('%s %s/%s/%s ; ', v_p.nom, case when v_p.porteur or v_p.fondateur then 1 else 0 end,
        case when v_p.porteur or v_p.fondateur then 1 else 0 end, case when v_p.fondateur then 1 else 0 end);
    end loop;
    perform pg_temp.attendre('signalements',
      'signalement de problème d''essai, par acteur « lu/capture lue/supprimé » : le porteur du jeton (stag_n) et le fondateur le lisent, le fondateur seul le supprime',
      v_obt, v_att);
  end if;
  --    b) Ni le compte « cumul » (fiche de la promo 1, formateur de la promo 2) ni l'orphelin affecté (siège) ne se
  --       suppriment, quel que soit l'acteur : « jamais un compte qui a une affectation ». Leurs affectations échappent
  --       aux formateurs de la promo 1 et à la direction du lieu 1 : une sous-requête sous RLS les supprimerait.
  v_txt := '';
  for v_p in select * from (select p.nom, p.email, p.ordre from personnages p union all select 'anon', null, 99) u order by u.ordre loop
    foreach v_ctx in array array['1', '2', null] loop
      v_res := pg_temp.tenter(v_p.email, v_ctx, null, null, null,
        format('delete from public.user_profiles where email in (%L, %L)', c_cumul, c_orphelin_affecte),
        format('select count(*)::text from public.user_profiles where email in (%L, %L)', c_cumul, c_orphelin_affecte));
      if v_res[2] is distinct from 'OK 0 2' and v_res[2] is distinct from 'REFUS 42501' then
        v_txt := v_txt || format('%s (contexte %s) : %s ; ', v_p.nom, coalesce(v_ctx, 'sans'), coalesce(v_res[2], 'nul'));
      end if;
    end loop;
  end loop;
  perform pg_temp.verifier('comptes',
    'ni le compte cumul ni l''orphelin affecté ne se suppriment, par aucun acteur (contextes 1, 2, sans en-tête)',
    v_txt = '', 'supprimés ou en erreur : ' || v_txt);
  --    c) Anonymat des notes (réciprocité) : stag_masque, dont le profil masque les notes, ne voit que les siennes (une
  --       seule évaluation) ; stag_n ne voit pas les siennes mais celles d'un autre ; l'équipe (form_n) les voit.
  select p.fiche into n from personnages p where p.nom = 'stag_masque';
  select p.fiche into n2 from personnages p where p.nom = 'stag_n';
  perform pg_temp.attendre('anonymat',
    'notes masquées : stag_masque ne voit que ses notes, stag_n ne voit pas les siennes mais celles d''un autre, form_n les voit',
    format('masqué voit %s ; stag_n voit celles du masqué %s ; stag_n voit celles d''un autre %s ; form_n voit celles du masqué %s',
      coalesce(pg_temp.valeur('preuve.masque@exemple.invalid', '1', null,
        format('select count(*)::text || ''/'' || count(*) filter (where stagiaire_id = %s)::text from public.evaluations', n)), 'nul'),
      coalesce(pg_temp.valeur('preuve.stag.n@exemple.invalid', '1', null,
        format('select count(*)::text from public.evaluations where stagiaire_id = %s', n)), 'nul'),
      coalesce(pg_temp.valeur('preuve.stag.n@exemple.invalid', '1', null,
        format('select (count(*) filter (where stagiaire_id not in (%s, %s)) > 0)::text from public.evaluations', n, n2)), 'nul'),
      coalesce(pg_temp.valeur('preuve.form.n@exemple.invalid', '1', null,
        format('select count(*)::text from public.evaluations where stagiaire_id = %s', n)), 'nul')),
    'masqué voit 1/1 ; stag_n voit celles du masqué 0 ; stag_n voit celles d''un autre true ; form_n voit celles du masqué 1');

  v_jalons := v_jalons || format(' ; contrôles ciblés %s s', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0'));
  -- 8. Siège : aucune ligne d'une table de promo ou de lieu (colonne promo_id ou lieu_id, sauf affectations, dont les
  --    lignes de direction et de siège lui sont lisibles, R17), ni des données privées, ni aucun profil de stagiaire.
  for n in 1 .. cardinality(c_contextes) loop
    select string_agg(format('%s %s', regexp_replace(t, '^public\.', ''), v), ', ' order by t) into v_txt
      from (select t, pg_temp.valeur('preuve.siege@exemple.invalid', c_contextes[n], null, format('select count(*)::text from %s', t)) as v
              from (select distinct format('public.%I', c.relname) as t
                      from pg_attribute a join pg_class c on c.oid = a.attrelid
                     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
                       and a.attname in ('promo_id', 'lieu_id') and c.relname <> 'affectations'
                    union select 'public.stagiaires_prive') l) x
     where v is distinct from '0';
    v_obt := pg_temp.valeur('preuve.siege@exemple.invalid', c_contextes[n], null,
      'select count(*)::text from public.user_profiles where stagiaire_id is not null');
    perform pg_temp.verifier('siège',
      format('siège fictif, contexte %s : 0 ligne des tables d''une promo ou d''un lieu, 0 profil de stagiaire',
             coalesce(c_contextes[n], 'sans en-tête')),
      v_txt is null and v_obt = '0',
      concat_ws(' ; ', 'tables : ' || v_txt, case when v_obt is distinct from '0' then 'profils de stagiaire : ' || coalesce(v_obt, 'nul') end));
  end loop;

  -- 9. Couverture : toute table de public sous RLS est dans la matrice ; aucune table de public n'est sans RLS (une
  --    table sans RLS serait lisible et modifiable par tous, la matrice ne la verrait pas) ; plus aucune règle ne cite
  --    les anciennes fonctions (vrai une fois l'étape 3 appliquée).
  select string_agg(x.t, ', ' order by x.t) into v_txt
    from (select format('%I.%I', ns.nspname, c.relname) as t from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
           where ns.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity) x
   where x.t not in (select m.tbl from matrice m);
  perform pg_temp.verifier('couverture', 'toute table de public sous RLS figure dans la matrice (une table ajoutée la fait rougir)',
    v_txt is null, coalesce('hors matrice : ' || v_txt, ''));
  select string_agg(c.relname, ', ' order by c.relname) into v_txt from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity;
  perform pg_temp.verifier('couverture', 'aucune table de public sans RLS (une table créée sans RLS la fait rougir)',
    v_txt is null, coalesce('sans RLS : ' || v_txt, ''));
  select count(*), string_agg(format('%s.%s', p.tablename, p.policyname), ', ' order by p.tablename, p.policyname)
    into n, v_txt
    from pg_policies p
   where p.schemaname in ('public', 'storage')
     and (coalesce(p.qual, '') ~ '\m(is_admin|is_prof|is_founder)\(' or coalesce(p.with_check, '') ~ '\m(is_admin|is_prof|is_founder)\(');
  perform pg_temp.verifier('couverture', 'aucune règle (public, stockage) ne cite plus is_admin(, is_prof( ou is_founder( (étape 3 appliquée)',
    n = 0, format('%s règle(s) : %s', n, left(coalesce(v_txt, ''), 600)));

  v_jalons := v_jalons || format(' ; siège et couverture %s s', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0'));
  -- 10. Les retours, dans l'ordre inverse, puis l'empreinte : elle doit égaler celle d'avant.
  v_retour[3] := pg_temp.jouer('retour 3',
-- @@INJECTER supabase/migrations/20261028_roles_3_regles_retour.sql@@
  );
  v_retour[2] := pg_temp.jouer('retour 2',
-- @@INJECTER supabase/migrations/20261028_roles_2_fonctions_retour.sql@@
  );
  v_retour[1] := pg_temp.jouer('retour 1',
-- @@INJECTER supabase/migrations/20261028_roles_1_fondations_retour.sql@@
  );
  for n in reverse 3 .. 1 loop
    if v_retour[n] = 'neutralisée' then
      perform pg_temp.informer(format('retour %s', n), 'non injecté (' || v_mode || ')');
    else
      perform pg_temp.verifier('structure', format('retour %s joué sans erreur', n), v_retour[n] = 'jouée', v_retour[n]);
    end if;
  end loop;
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  if v_en_ligne then
    perform pg_temp.informer('retour', format('non jugeable en mode en-ligne (rien n''est injecté) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours 3, 2, 1 : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours 3, 2, 1 : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours 3, 2, 1 : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;

  perform pg_temp.attendre('structure', 'identités de lieux et de promos non consommées (aucun ajout réussi dans ces tables)',
    (select format('lieux %s, promos %s', (select last_value || '/' || is_called from public.lieux_id_seq),
                   (select last_value || '/' || is_called from public.promos_id_seq))), v_sequences);
  perform pg_temp.informer('jalons (secondes écoulées depuis le début du bloc, à la fin de chaque partie)', substr(v_jalons, 4));
  perform pg_temp.informer('durée du bloc (verrous des migrations tenus jusqu''à la levée)',
    to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_roles(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $preuve$;
