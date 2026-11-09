-- Preuve du lot 5, étapes 1 (siège), 2 (équipe) et 3 (habillage) : ce que les migrations 20261108_espaces_1_siege.sql,
-- 20261108_espaces_2_equipe.sql et 20261108_espaces_3_habillage.sql doivent donner, écrite avant elles.
--   Étape 1 : lieux.demonstration (vrai pour le lieu 4 seulement, aucune écriture directe), la séquence de lieux.id recalée,
--   comptes_reseau() (comptes additifs par centre, sans nom, sans détail par promo, masqués sous 5 stagiaires en
--   formation, réservés au siège) et creer_centre(p_nom) (réservée au siège).
--   Étape 3 : lieux.habillage et lieux.habillage_libre, la clé globale habillage_reseau admise par la contrainte de réglages,
--   habillage_par_defaut() (lisible de tout compte connecté), regler_habillage_centre (direction du centre ou fondateur) et
--   regler_habillage_reseau (siège ou fondateur).
--   Étape 2 : regler_affectations_formateur (la direction du centre donne à un compte exactement les promos choisies de son
--   centre), _profil_formateur (interne) et inviter_compte redéfinie (même profil qu'au lot 4, adresse de stagiaire refusée).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes du lot 4
-- (tests/sql/roles-aides.sql), y écrit le libellé du mode et y injecte en littéraux la requête d'empreinte, la fixture
-- commune (tests/fixtures/comptes-promo.json, la même que celle du test node), les deux migrations et leurs retours :
--   node outils/assembler_repetition_roles.mjs espaces <sortie.sql>                   les migrations injectées : VERT attendu
--   node outils/assembler_repetition_roles.mjs espaces-contre-epreuve <sortie.sql>    sans aucune migration : ROUGE attendu
--                                                                                     sur les contrôles comptes_reseau,
--                                                                                     creer_centre, demonstration et equipe
--   node outils/assembler_repetition_roles.mjs espaces-contre-epreuve-2 <sortie.sql>  avec la seule migration du siège : ROUGE
--                                                                                     attendu sur les contrôles de l'équipe et de
--                                                                                     l'habillage
--   node outils/assembler_repetition_roles.mjs espaces-contre-epreuve-3 <sortie.sql>  avec les migrations du siège et de l'équipe :
--                                                                                     ROUGE attendu sur les seuls contrôles habillage
--   node outils/assembler_repetition_roles.mjs espaces-en-ligne <sortie.sql>          rien d'injecté, après application réelle
--   ... --compact <sortie.sql>   retire du gabarit et des aides les lignes vides et de commentaire (textes injectés intacts).
-- Le fichier assemblé se joue en une requête. Tout se passe dans le bloc do final, qui finit TOUJOURS par une levée :
-- migration, personnages, centres et données d'essai sont annulés, rien ne reste (sauf l'état de la séquence de lieux.id,
-- que le bloc remet lui-même comme il l'a trouvé : une séquence n'est pas transactionnelle).
--
-- Déroulé : empreinte avant ; migration 1 ; personnages et centres fictifs (« fixture » : la promo de la fixture, avec ses
-- identifiants d'origine ; « petit » : 4 stagiaires en formation ; « fini » : une promo terminée ; « cinq » : deux promos
-- en cours de 3 et 2 stagiaires plus une promo terminée) ; un formateur invité par inviter_compte du lot 4 (référence) ;
-- migration 2 ; contrôles ; retour 2 puis retour 1 ; empreinte après.
--
-- Contrôles (chacun nommé au verdict, échecs d'abord), par groupe :
--   comptes_reseau  droits (siège, fondateur, fondateur en aperçu siège permis ; direction, formateur, stagiaire, compte sans
--                   rôle, fondateur en aperçu direction et formateur refusés 42501 ; anon sans droit d'exécution), forme (aucun
--                   nom de personne, e-mail, identifiant de stagiaire ou de promo), une ligne par centre, la ligne « fixture »
--                   égale à l'attendu de la fixture champ par champ (les parasites n'ont rien changé), « petit » et « fini »
--                   masqués et vides, « cinq » juste au seuil et somme de ses deux promos en cours.
--   creer_centre    droits, nom nettoyé, nom vide, nom en double (casse différente), identifiant plus grand que tous les
--                   identifiants existants, séquence recalée.
--   demonstration   colonne, vrai pour le lieu 4 seulement, aucune écriture directe par le siège ni par la direction.
--   retour          empreintes égales à celles d'avant, plus de colonne ni de fonction du lot.
--   equipe          regler_affectations_formateur (droits par personnage et par portée, refus de chaque sorte sans aucune ligne
--                   changée, ajout, retrait, cumul, création de profil, compte stagiaire refusé), inviter_compte (même profil
--                   qu'au lot 4, champ par champ ; différences de texte limitées à la branche formateur ; adresse de stagiaire
--                   refusée), fonction interne sans droit d'exécution, retour (texte d'inviter_compte d'origine, md5).
--   invitations     (lot G) inviter_compte refuse l'adresse d'un compte stagiaire dans les branches direction et siège (même phrase
--                   que pour un formateur, avant toute écriture, refus de droit prioritaire), une adresse neuve reste acceptée.
--   personnel       (lot G) roles_du_personnel : droits d'exécution, forme (email, role), lecture par l'équipe de la promo affichée,
--                   le siège et le fondateur, rien pour un stagiaire, un compte sans rôle ni anon.
--   habillage       structure (colonnes, contrainte de réglages, droits d'exécution), droits par personnage et par portée de
--                   chaque réglage (refus 42501 avec la phrase, aucune ligne changée), valeurs refusées, écriture directe sans
--                   effet, lecture au démarrage (centre de la promo affichée, premier centre des affectations, réseau seul).
--   structure       migrations et retours joués sans erreur, personnages et lignes d'essai posés.
--
-- Fixture : ses identifiants (990001...) ne rencontrent aucune ligne réelle. Écarts avec le schéma réel, tous sans effet
-- sur l'attendu : les QCM et thèmes qu'elle cite reçoivent des identifiants neufs (les siens existent déjà : thèmes 1 à 3 et
-- QCM 10 à 12 sont ceux de la vraie base), la tentative d'entraînement sans note_20 reçoit 0 (colonne non nulle), la ligne
-- EPCF sans date_eval n'est pas posée (colonne non nulle ; l'attendu l'exclut de toute façon) et auto_eval nul devient faux
-- (colonne non nulle ; « auto_eval is not true » les traite pareil), le stagiaire 990099 (hors promo) est posé comme fiche
-- d'une autre promo. Les deux déclencheurs qui imposent promo_id d'après la fiche sont suspendus le temps de poser les
-- lignes parasites (promo_id qui ne correspond pas à la fiche), puis rétablis.

-- @@INCLURE tests/sql/roles-aides.sql@@

-- Empreinte de la base (regles, fonctions, droits) : tests/sql/roles-empreinte.sql, injecté tel quel.
create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $empreinte$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $empreinte$;

-- Une migration ou un retour, joué tel quel dans une sous-transaction : « jouée », « neutralisée » (le littéral 'select 1'
-- que l'assembleur met à la place d'un fichier non demandé), ou l'erreur (état SQL et noms de contrainte, de table et de
-- colonne, jamais le message). Le md5 du texte joué va au verdict (information).
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

-- Un appel fait par un personnage : « OK <valeur> » ou « ERREUR <état> <message> » (le message est celui de nos
-- levées, jamais une valeur de donnée ; coupé à 120 caractères). Rend la main au propriétaire.
create or replace function pg_temp.appeler(p_email text, p_promo text, p_apercu text, p_sql text)
returns text language plpgsql as $f$
declare v text;
begin
  perform pg_temp.incarner(p_email, p_promo, p_apercu);
  begin
    execute p_sql into v;
    v := 'OK ' || coalesce(v, 'nul');
  exception when others then
    v := 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 120);
  end;
  perform pg_temp.proprio();
  return v;
end $f$;

-- Un champ d'une ligne du résultat de comptes_reseau (texte, ou nul si le centre ou le champ manque) ; et « vrai » quand la
-- clé est présente avec la valeur JSON null (une colonne masquée est présente et vide, jamais absente).
create or replace function pg_temp.champ(p_lignes jsonb, p_lieu text, p_champ text)
returns text language sql as $f$
  select r ->> p_champ from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) r where r ->> 'lieu_nom' = p_lieu;
$f$;
create or replace function pg_temp.champ_nul(p_lignes jsonb, p_lieu text, p_champ text)
returns boolean language sql as $f$
  select coalesce(bool_and(jsonb_typeof(r -> p_champ) = 'null'), false)
    from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) r where r ->> 'lieu_nom' = p_lieu;
$f$;

-- Étape 2 : les promos de formateur d'un compte (identifiants triés, séparés par des virgules), un instantané de toutes les
-- affectations, le nombre de lignes direction et siège, et l'appel de regler_affectations_formateur par un personnage.
create or replace function pg_temp.formateur_de(p_email text)
returns text language sql as $f$
  select coalesce(string_agg(a.promo_id::text, ',' order by a.promo_id), 'aucune')
    from public.affectations a where lower(a.email) = lower(p_email) and a.role = 'formateur';
$f$;
create or replace function pg_temp.instantane()
returns text language sql as $f$
  select md5(coalesce(string_agg(format('%s|%s|%s|%s|%s', a.id, a.email, a.role, a.promo_id, a.lieu_id), ';' order by a.id), ''))
         || '/' || (select count(*) from public.user_profiles)
    from public.affectations a;
$f$;
create or replace function pg_temp.nb_direction_siege()
returns integer language sql as $f$
  select count(*)::integer from public.affectations a where a.role in ('direction', 'siege');
$f$;
create or replace function pg_temp.regler(p_qui text, p_apercu text, p_cible text, p_lieu integer, p_promos text,
                                          p_fiche text default 'null', p_entete text default '1')
returns text language sql as $f$
  select pg_temp.appeler(p_qui, p_entete, p_apercu,
    format('select public.regler_affectations_formateur(%L, %s, %s::integer[], %s)::text', p_cible, p_lieu, p_promos, p_fiche));
$f$;
-- Le jsonb rendu par un appel réussi (« OK {...} »), ou nul.
create or replace function pg_temp.reponse(p_appel text)
returns jsonb language sql as $f$
  select case when p_appel like 'OK {%' then substr(p_appel, 4)::jsonb end;
$f$;
-- Le profil d'un compte, sans son adresse ni sa date d'invitation, la fiche formateur réduite à « posée ou non », et ses
-- affectations : de quoi comparer deux invitations de formateur faites par deux versions d'inviter_compte.
create or replace function pg_temp.profil(p_email text)
returns jsonb language sql as $f$
  select (to_jsonb(u) - 'email' - 'invited_at' - 'prof_id')
         || jsonb_build_object('fiche_posee', u.prof_id is not null)
         || jsonb_build_object('affectations', (select coalesce(jsonb_agg(jsonb_build_object('role', a.role, 'promo_id', a.promo_id,
                 'lieu_id', a.lieu_id, 'cree_par', a.cree_par) order by a.role, a.promo_id), '[]'::jsonb)
               from public.affectations a where a.email = u.email))
    from public.user_profiles u where u.email = p_email;
$f$;
-- Les lignes d'un texte sans retour chariot, numérotées par occurrence : la différence (dans les deux sens) entre deux
-- définitions de fonction.
create or replace function pg_temp.diff_lignes(p_a text, p_b text, out retirees text, out nb_retirees integer, out ajoutees text, out nb_ajoutees integer)
language sql as $f$
  with a as (select t, row_number() over (partition by t order by o) as k from unnest(string_to_array(replace(p_a, E'\r', ''), E'\n')) with ordinality as x(t, o)),
       b as (select t, row_number() over (partition by t order by o) as k from unnest(string_to_array(replace(p_b, E'\r', ''), E'\n')) with ordinality as x(t, o)),
       r as (select t from (select t, k from a except select t, k from b) z),
       n as (select t from (select t, k from b except select t, k from a) z)
  select (select string_agg(trim(t), ' / ') from r), (select count(*)::integer from r),
         (select string_agg(trim(t), ' / ') from n), (select count(*)::integer from n);
$f$;

-- Verdict : lève TOUJOURS une exception, qui annule tout. Les échecs d'abord (chacun avec son groupe et son détail), puis
-- les comptes par groupe, puis la liste de chaque contrôle réussi ; « VERT n/0 » nomme chaque contrôle.
create or replace function pg_temp.verdict_espaces(p_mode text, p_debut timestamptz)
returns void language plpgsql as $f$
declare v_ok integer; v_ko integer; v_groupes text; v_echecs text; v_reussis text; v_infos text; v_msg text; v_duree text;
begin
  v_duree := to_char(extract(epoch from clock_timestamp() - p_debut), 'FM990.0') || ' s';
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat = 'échec') into v_ok, v_ko from preuve;
  select string_agg(format('%s %s/%s', groupe, ok, n), ' ; ' order by premier) into v_groupes
    from (select groupe, count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where etat <> 'info' group by groupe) g;
  select string_agg(format('- [%s] %s', groupe, libelle) || coalesce(' : ' || nullif(left(detail, 200), ''), ''), E'\n' order by num)
    into v_echecs from preuve where etat = 'échec';
  select string_agg(format('- [%s] %s', groupe, libelle), E'\n' order by num) into v_reussis from preuve where etat = 'ok';
  select string_agg('- ' || libelle || coalesce(' : ' || nullif(detail, ''), ''), E'\n' order by num) into v_infos
    from preuve where etat = 'info';
  if v_ko = 0 and v_ok > 0 then
    v_msg := format(E'VERT %s/0 (tout est annulé) ; mode %s ; durée %s\npar groupe (réussis/joués) : %s\ncontrôles :\n%s',
      v_ok, p_mode, v_duree, v_groupes, coalesce(v_reussis, '- aucun'));
  else
    v_msg := format(E'ROUGE %s/%s (tout est annulé) ; mode %s ; durée %s\néchecs d''abord :\n%s\npar groupe (réussis/joués) : %s\ncontrôles réussis :\n%s',
      v_ok, v_ko, p_mode, v_duree, coalesce(v_echecs, '- aucun'), coalesce(v_groupes, 'aucun contrôle joué'),
      coalesce(v_reussis, '- aucun'));
  end if;
  if v_infos is not null then
    v_msg := v_msg || E'\nà titre d''information (jamais compté) :\n' || v_infos;
  end if;
  raise exception using message = v_msg;
end $f$;

-- Correspondance entre les clés de l'attendu de la fixture (JS) et les colonnes de comptes_reseau.
drop table if exists pg_temp.champs;
create temp table champs (ordre integer primary key, cle text not null, colonne text not null);
insert into champs (ordre, cle, colonne) values
  (1, 'inscrits', 'inscrits'), (2, 'enFormation', 'en_formation'), (3, 'abandons', 'abandons'), (4, 'absences', 'absences'),
  (5, 'prevus', 'prevus'), (6, 'qcmBonnes', 'qcm_bonnes'), (7, 'qcmQuestions', 'qcm_questions'),
  (8, 'examensPasses', 'examens_passes'), (9, 'examensReussis', 'examens_reussis'), (10, 'notesN', 'notes_n'),
  (11, 'notesSomme', 'notes_somme'), (12, 'notesSous10', 'notes_sous10'), (13, 'epcfAcquis', 'epcf_acquis'),
  (14, 'epcfRenseignes', 'epcf_renseignes');

drop table if exists pg_temp.qcm_fixture;
create temp table qcm_fixture (cle integer primary key, id bigint not null);

do $preuve$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_fx constant jsonb := (
-- @@INJECTER tests/fixtures/comptes-promo.json@@
  )::jsonb;
  v_promo constant integer := (v_fx ->> 'promo_id')::integer;
  c_fix constant text := 'Preuve centre fixture';
  c_petit constant text := 'Preuve centre petit';
  c_fini constant text := 'Preuve centre fini';
  c_cinq constant text := 'Preuve centre cinq';
  c_siege constant text := 'preuve5.siege@exemple.invalid';
  c_dir_n constant text := 'preuve5.dir.n@exemple.invalid';
  c_dir_m constant text := 'preuve5.dir.m@exemple.invalid';
  c_form_n constant text := 'preuve5.form.n@exemple.invalid';
  c_form_m constant text := 'preuve5.form.m@exemple.invalid';
  c_stag_n constant text := 'preuve5.stag.n@exemple.invalid';
  c_sans_role constant text := 'preuve5.sans.role@exemple.invalid';
  c_colonnes constant text[] := array['lieu_id', 'lieu_nom', 'demonstration', 'promos_en_cours', 'masque', 'inscrits',
    'en_formation', 'abandons', 'absences', 'prevus', 'qcm_bonnes', 'qcm_questions', 'examens_passes', 'examens_reussis',
    'notes_n', 'notes_somme', 'notes_sous10', 'epcf_acquis', 'epcf_renseignes'];
  c_lire constant text := 'select jsonb_agg(to_jsonb(r) order by r.lieu_id)::text from public.comptes_reseau() r';
  c_compter constant text := 'select count(*)::text from public.comptes_reseau()';
  v_en_ligne boolean;
  v_etat text; v_retour text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_seq text; v_seq_last bigint; v_seq_called boolean; v_requete text; v_seq_ok boolean; v_seq_detail text;
  v_fond text; v_lieu1 integer; v_lieu2 integer; v_max_avant integer; v_nb_lieux integer;
  v_l_fix integer; v_l_petit integer; v_l_fini integer; v_l_cinq integer;
  v_p_petit integer; v_p_fini integer; v_p_a integer; v_p_b integer; v_p_c integer;
  v_theme integer; v_qcm bigint; v_x record; v_fiche_n integer; v_fiche_p1 integer;
  v_json text; v_lignes jsonb; v_obt text; v_att text; v_txt text; v_cols text[]; v_mauvaises text;
  v_ids integer[]; n integer; v_id_a integer; v_id_b integer; v_id_c integer;
  v_etat3 text; v_retour3 text; v_hs text; v_l_vide integer;
  c_dir_vide constant text := 'preuve5.dir.vide@exemple.invalid';
  c_hab_lieux constant text := 'select string_agg(id || '':'' || coalesce(habillage, ''nul'') || '':'' || habillage_libre, '','' order by id) from public.lieux where id in (%s, %s)';
  c_hab_reseau constant text := 'select count(*) || '' '' || coalesce(max(value), ''nul'') from public.settings where promo_id is null and key = ''habillage_reseau''';
  c_hab_lire constant text := 'select count(*) || '' ; '' || coalesce(max(centre), ''nul'') || '' ; '' || coalesce(bool_and(libre)::text, ''nul'') || '' ; '' || coalesce(max(reseau), ''nul'') from public.habillage_par_defaut()';
  v_etat2 text; v_retour2 text; v_ic_def0 text; v_ic_def1 text; v_ic_md5 text;
  c_avant constant text := 'preuve5.invite.avant@exemple.invalid';
  c_apres constant text := 'preuve5.invite.apres@exemple.invalid';
  c_nouveau constant text := 'preuve5.nouveau.c@exemple.invalid';
  c_majuscule constant text := 'Preuve5.Nouveau.D@Exemple.Invalid';
  c_absent constant text := 'preuve5.absent@exemple.invalid';
  c_inv_dir constant text := 'preuve5.invite.direction@exemple.invalid';
  c_inv_siege constant text := 'preuve5.invite.siege@exemple.invalid';
  c_roles constant text := 'select string_agg(r.email || '':'' || r.role, '','' order by r.email, r.role) from public.roles_du_personnel() r where r.email like ''preuve5.%''';
  v_fa integer; v_fb integer; v_fc integer; v_fl integer; v_pn integer; v_l1 integer;
  v_avant_profil jsonb; v_avant_rep jsonb; v_apres_rep jsonb; v_snap text; v_dsn integer; v_np integer; v_aff_id bigint; v_diff record;
  v_r jsonb; v_rep text;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'espaces-en-ligne%';

  -- 1. Avant la migration : requête reçue, empreinte, séquence, centres existants, fondateur choisi par requête.
  v_requete := regexp_replace(current_query(), E'\n\n-- source:[^\n]*(\n-- [^\n]*)*[[:space:]]*$', '');
  perform pg_temp.informer('requête reçue par la base, suffixe de la passerelle retiré (md5, caractères)',
    format('%s, %s', md5(v_requete), length(v_requete)));
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  v_ic_def0 := pg_get_functiondef('public.inviter_compte(text, text, integer, integer, integer)'::regprocedure);
  v_ic_md5 := md5(v_ic_def0);
  select s.last_value, s.is_called into v_seq_last, v_seq_called from public.lieux_id_seq s;
  v_seq := format('lieux_id_seq %s/%s', v_seq_last, v_seq_called);
  select max(id), count(*) into v_max_avant, v_nb_lieux from public.lieux;
  v_lieu1 := (select lieu_id from public.promos where id = 1);
  v_lieu2 := (select lieu_id from public.promos where id = 2);
  select up.email into v_fond from public.user_profiles up where up.is_founder order by up.email limit 1;
  perform pg_temp.verifier('structure', 'un fondateur trouvé par requête (adresse jamais affichée), les promos 1 et 2 et leurs centres',
    v_fond is not null and v_lieu1 is not null and v_lieu2 is not null and v_lieu1 <> v_lieu2,
    format('fondateur %s ; centres des promos 1 et 2 : %s et %s', case when v_fond is null then 'absent' else 'trouvé' end,
           coalesce(v_lieu1::text, 'nul'), coalesce(v_lieu2::text, 'nul')));

  -- 1 bis. Deux préparations de la migration 1 (sauf en ligne, où elle est déjà appliquée pour de bon) : un « lieu 3 » (les lieux
  -- 3 et 4 ont été posés hors migration en production ; sur une base sans lieu 3, une migration qui en marquerait un autre que
  -- le 4 comme démonstration passerait inaperçue) et la séquence de lieux.id remise sous le plus grand identifiant (sans la
  -- recalage de la migration, le contrôle « séquence recalée » devient rouge). Le bloc remet la séquence comme trouvée à la fin.
  if not v_en_ligne then
    if not exists (select 1 from public.lieux where id = 3) then
      insert into public.lieux (id, nom) values (3, 'Preuve lieu trois');
    end if;
    perform setval('public.lieux_id_seq', 1, false);
  end if;

  -- 2. La migration, injectée telle quelle (neutralisée dans les modes sans elle).
  v_etat := pg_temp.jouer('migration',
-- @@INJECTER supabase/migrations/20261108_espaces_1_siege.sql@@
  );
  if v_etat = 'neutralisée' then
    perform pg_temp.informer('migration', 'non injectée (' || v_mode || ')');
    -- Sans la migration, rien ne recale la séquence : la remettre comme trouvée, pour que la suite (centres fictifs) se joue.
    perform setval('public.lieux_id_seq', v_seq_last, v_seq_called);
  else
    perform pg_temp.verifier('structure', 'migration jouée sans erreur', v_etat = 'jouée', v_etat);
  end if;
  -- La séquence de lieux.id, jugée ici (elle était remise sous le plus grand identifiant avant la migration) ; puis, si la
  -- migration ne l'a pas recalée, poussée au maximum pour que la suite se joue (le contrôle reste rouge).
  select s.last_value >= (select max(id) from public.lieux), format('séquence %s ; plus grand id %s', s.last_value, (select max(id) from public.lieux))
    into v_seq_ok, v_seq_detail from public.lieux_id_seq s;
  perform setval('public.lieux_id_seq', greatest((select last_value from public.lieux_id_seq), (select max(id) from public.lieux)));

  -- 3. Personnages fictifs, centres fictifs, fixture et lignes parasites, en propriétaire.
  insert into public.lieux (nom) values (c_fix) returning id into v_l_fix;
  insert into public.lieux (nom) values (c_petit) returning id into v_l_petit;
  insert into public.lieux (nom) values (c_fini) returning id into v_l_fini;
  insert into public.lieux (nom) values (c_cinq) returning id into v_l_cinq;
  v_p_petit := v_promo + 1; v_p_fini := v_promo + 2; v_p_a := v_promo + 3; v_p_b := v_promo + 4; v_p_c := v_promo + 5;
  -- Promos : en cours = date_debut <= aujourd'hui et (date_fin nulle ou >= aujourd'hui). Dates relatives à aujourd'hui, pour
  -- que la preuve reste juste avec le temps ; « petit » commence et finit aujourd'hui (le dernier jour compte).
  insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values
    (v_promo, v_l_fix, 'Preuve promo fixture', current_date - 30, null),
    (v_p_petit, v_l_petit, 'Preuve promo petit', current_date, current_date),
    (v_p_fini, v_l_fini, 'Preuve promo finie', current_date - 100, current_date - 1),
    (v_p_a, v_l_cinq, 'Preuve promo cinq A', current_date - 20, current_date + 20),
    (v_p_b, v_l_cinq, 'Preuve promo cinq B', current_date - 5, null),
    (v_p_c, v_l_cinq, 'Preuve promo cinq C finie', current_date - 200, current_date - 10);
  -- QCM et thèmes cités par la fixture : identifiants neufs (numero nul : aucun miroir d'examen vers les évaluations).
  for v_x in select (q ->> 'id')::integer as cle, q ->> 'titre' as titre, (q ->> 'exam_pass_20')::numeric as seuil
               from jsonb_array_elements(v_fx -> 'referentiel' -> 'qcm') q loop
    insert into public.themes (titre, type, ordre) values ('Preuve thème ' || v_x.titre, 'notion', 9999) returning id into v_theme;
    insert into public.qcm (theme_id, titre, exam_pass_20) values (v_theme, 'Preuve ' || v_x.titre, coalesce(v_x.seuil, 15))
      returning id into v_qcm;
    insert into qcm_fixture (cle, id) values (v_x.cle, v_qcm);
  end loop;
  -- Fiches de la fixture, puis celles qu'elle cite sans les décrire (le stagiaire hors promo) : fiches d'une autre promo.
  insert into public.stagiaires (id, prenom, nom, ordre, actif, anonymise_le, promo_id)
    select x.id, x.prenom, x.nom, x.ordre, x.actif, x.anonymise_le, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'stagiaires')
           as x(id integer, prenom text, nom text, ordre integer, actif boolean, anonymise_le timestamptz, promo_id integer);
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id)
    select o.sid, 'Hors', 'PREUVE', 99, true, v_p_petit
      from (select (l ->> 'stagiaire_id')::integer as sid
              from jsonb_each(v_fx -> 'donnees') e, jsonb_array_elements(e.value) l where e.key <> 'stagiaires'
            except select (l ->> 'id')::integer from jsonb_array_elements(v_fx -> 'donnees' -> 'stagiaires') l) o;
  -- « petit » : 3 stagiaires en formation (le stagiaire hors promo, fiche d'une autre promo, y est aussi : 4 au total, moins
  -- de 5), et une absence ; « fini » : 6 fiches dans une promo terminée ; « cinq » : promo A (3 en formation, 1 abandon),
  -- promo B (2 en formation), promo C terminée (4 fiches).
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id)
    select 990100 + i, 'Petit' || i, 'PREUVE', i, true, v_p_petit from generate_series(1, 3) i
    union all select 990200 + i, 'Fini' || i, 'PREUVE', i, true, v_p_fini from generate_series(1, 6) i
    union all select 990400 + i, 'CinqA' || i, 'PREUVE', i, i <= 3, v_p_a from generate_series(1, 4) i
    union all select 990410 + i, 'CinqB' || i, 'PREUVE', i, true, v_p_b from generate_series(1, 2) i
    union all select 990420 + i, 'CinqC' || i, 'PREUVE', i, true, v_p_c from generate_series(1, 4) i;
  -- Les déclencheurs qui imposent promo_id d'après la fiche sont suspendus pour poser les lignes dont le promo_id ne
  -- correspond pas à la fiche (le passage du stagiaire hors promo, et les deux parasites).
  alter table public.passages disable trigger trg_promo_du_stagiaire;
  alter table public.evaluations disable trigger trg_promo_du_stagiaire;
  alter table public.qcm_attempts disable trigger trg_promo_du_stagiaire;
  alter table public.epcf_evaluations disable trigger trg_promo_du_stagiaire;
  insert into public.passages (id, stagiaire_id, type, resultat, date, promo_id)
    select x.id, x.stagiaire_id, x.type, x.resultat, x."date", x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'passages')
           as x(id integer, stagiaire_id integer, type text, resultat text, "date" date, promo_id integer);
  insert into public.evaluations (id, stagiaire_id, type, theme_numero, competence_code, controle_libelle, note, note_max, date_eval, promo_id)
    select x.id, x.stagiaire_id, x.type, x.theme_numero, x.competence_code, x.controle_libelle, x.note, x.note_max, x.date_eval, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'evaluations')
           as x(id integer, stagiaire_id integer, type text, theme_numero integer, competence_code text, controle_libelle text,
                note numeric, note_max numeric, date_eval date, promo_id integer);
  insert into public.qcm_attempts (id, qcm_id, stagiaire_id, mode, score, total, note_20, finished_at, promo_id)
    select x.id, m.id, x.stagiaire_id, x.mode, x.score, x.total, coalesce(x.note_20, 0), x.finished_at, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'tentatives')
           as x(id bigint, qcm_id integer, stagiaire_id integer, mode text, score integer, total integer, note_20 numeric,
                finished_at timestamptz, promo_id integer)
      join qcm_fixture m on m.cle = x.qcm_id;
  insert into public.epcf_evaluations (id, stagiaire_id, trame, contexte, auto_eval, date_eval, scores, promo_id)
    overriding system value
    select x.id, x.stagiaire_id, x.trame, x.contexte, coalesce(x.auto_eval, false), x.date_eval, x.scores, x.promo_id
      from jsonb_to_recordset(v_fx -> 'donnees' -> 'epcf')
           as x(id bigint, stagiaire_id integer, trame text, contexte text, auto_eval boolean, date_eval date, scores jsonb,
                promo_id integer)
     where x.date_eval is not null;
  -- Parasites : un passage d'un stagiaire de la fixture dont le promo_id est la promo 1 ; une évaluation d'un stagiaire de
  -- la promo 1 dont le promo_id est la promo de la fixture. Ni l'un ni l'autre ne compte.
  insert into public.passages (id, stagiaire_id, type, resultat, date, promo_id)
    values (v_promo + 900, (v_fx -> 'donnees' -> 'stagiaires' -> 0 ->> 'id')::integer, 'Salle', 'Absence', current_date, 1);
  select s.id into v_fiche_p1 from public.stagiaires s where s.promo_id = 1 and s.actif order by s.id limit 1;
  insert into public.evaluations (id, stagiaire_id, type, theme_numero, note, note_max, date_eval, promo_id)
    values (v_promo + 900, v_fiche_p1, 'Thème', 1, 1, 20, current_date, v_promo);
  -- Les mêmes parasites pour les stagiaires de « cinq » (centre non masqué, dont le compte attendu est zéro partout) : une
  -- note, une tentative d'examen et une évaluation EPCF d'un stagiaire de sa promo A dont le promo_id est la promo de la
  -- fixture. Si le promo_id n'était pas confronté à la promo de la fiche, elles s'ajouteraient au centre « cinq ».
  insert into public.evaluations (id, stagiaire_id, type, theme_numero, note, note_max, date_eval, promo_id)
    values (v_promo + 901, 990401, 'Thème', 1, 12, 20, current_date, v_promo);
  insert into public.qcm_attempts (id, qcm_id, stagiaire_id, mode, score, total, note_20, finished_at, promo_id)
    values (v_promo + 900, (select min(id) from qcm_fixture), 990401, 'examen', 20, 20, 20, now(), v_promo),
           (v_promo + 901, (select min(id) from qcm_fixture), 990401, 'entrainement', 9, 10, 0, now(), v_promo);
  insert into public.epcf_evaluations (id, stagiaire_id, trame, contexte, auto_eval, date_eval, scores, promo_id)
    overriding system value
    values (v_promo + 900, 990401, 'salle', 'EPCF', false, current_date, '{"a": "A", "b": "A"}'::jsonb, v_promo);
  alter table public.passages enable trigger trg_promo_du_stagiaire;
  alter table public.evaluations enable trigger trg_promo_du_stagiaire;
  alter table public.qcm_attempts enable trigger trg_promo_du_stagiaire;
  alter table public.epcf_evaluations enable trigger trg_promo_du_stagiaire;
  insert into public.passages (id, stagiaire_id, type, resultat, date, promo_id) values
    (v_promo + 800, 990101, 'Salle', 'Absence', current_date, v_p_petit),
    (v_promo + 801, 990401, 'Salle', 'Effectué', current_date, v_p_a),
    (v_promo + 802, 990402, 'Voiture', 'Absence', current_date, v_p_a),
    (v_promo + 803, 990411, 'Salle', 'Effectué', current_date, v_p_b),
    (v_promo + 804, 990421, 'Salle', 'Absence', current_date, v_p_c);
  -- Personnages : le siège, les deux directions, les deux formateurs, un stagiaire de la promo 1, un compte sans rôle.
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id) values (990301, 'Preuve5 stagiaire', 'PREUVE', 1, true, 1);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id) values
    (c_siege, 'prof', false, null), (c_dir_n, 'prof', false, null), (c_dir_m, 'prof', false, null),
    (c_form_n, 'prof', true, null), (c_form_m, 'prof', true, null), (c_stag_n, 'stagiaire', false, 990301),
    (c_sans_role, 'stagiaire', false, null);
  insert into public.affectations (email, role, promo_id, lieu_id) values
    (c_siege, 'siege', null, null), (c_dir_n, 'direction', null, v_lieu1), (c_dir_m, 'direction', null, v_lieu2),
    (c_form_n, 'formateur', 1, null), (c_form_m, 'formateur', 2, null);
  perform pg_temp.verifier('structure', 'lignes d''essai posées : fiches, passages, notes, tentatives et EPCF de la fixture (EPCF sans date écartée), parasites compris',
    (select count(*) from public.stagiaires where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'stagiaires')
    and (select count(*) from public.passages where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'passages')
    and (select count(*) from public.evaluations where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'evaluations') + 2
    and (select count(*) from public.qcm_attempts where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'tentatives') + 2
    and (select count(*) from public.epcf_evaluations where promo_id = v_promo) = jsonb_array_length(v_fx -> 'donnees' -> 'epcf') - 1 + 1,
    format('fiches %s, passages %s, notes %s, tentatives %s, EPCF %s',
      (select count(*) from public.stagiaires where promo_id = v_promo), (select count(*) from public.passages where promo_id = v_promo),
      (select count(*) from public.evaluations where promo_id = v_promo), (select count(*) from public.qcm_attempts where promo_id = v_promo),
      (select count(*) from public.epcf_evaluations where promo_id = v_promo)));

  -- 3 bis. Étape 2. Trois fiches formateur libres, une fiche déjà reliée à un compte, une promo en plus dans le centre de
  --        dir_n ; un formateur invité par inviter_compte TEL QUE LE LOT 4 LE FAIT (référence du profil créé), puis la
  --        migration 2, injectée telle quelle (neutralisée dans les modes sans elle).
  v_l1 := v_lieu1;
  insert into public.profs (nom) values ('Preuve fiche libre A') returning id into v_fa;
  insert into public.profs (nom) values ('Preuve fiche libre B') returning id into v_fb;
  insert into public.profs (nom) values ('Preuve fiche libre C') returning id into v_fc;
  select min(u.prof_id) into v_fl from public.user_profiles u where u.prof_id is not null;
  v_pn := v_promo + 6;
  insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values (v_pn, v_l1, 'Preuve promo N2', current_date - 3, null);
  v_rep := pg_temp.appeler(c_dir_n, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, %s, null)::text', c_avant, v_fa));
  v_avant_rep := pg_temp.reponse(v_rep) - 'email';
  v_avant_profil := pg_temp.profil(c_avant);
  perform pg_temp.verifier('structure', 'référence : inviter_compte (version en base avant la migration 2) a invité un formateur par la direction de la promo 1',
    v_avant_rep is not null and v_avant_profil is not null, left(v_rep, 120));
  v_etat2 := pg_temp.jouer('migration 2',
-- @@INJECTER supabase/migrations/20261108_espaces_2_equipe.sql@@
  );
  if v_etat2 = 'neutralisée' then
    perform pg_temp.informer('migration 2', 'non injectée (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'migration 2 jouée sans erreur', v_etat2 = 'jouée', v_etat2);
  end if;
  v_ic_def1 := pg_get_functiondef('public.inviter_compte(text, text, integer, integer, integer)'::regprocedure);

  -- 3 ter. Étape 3 : la migration 3 (habillage par défaut du centre et du réseau), injectée telle quelle (neutralisée dans les
  --        modes sans elle).
  v_etat3 := pg_temp.jouer('migration 3',
-- @@INJECTER supabase/migrations/20261108_espaces_3_habillage.sql@@
  );
  if v_etat3 = 'neutralisée' then
    perform pg_temp.informer('migration 3', 'non injectée (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'migration 3 jouée sans erreur', v_etat3 = 'jouée', v_etat3);
  end if;

  -- 3 quater. Habillage : structure, droits, valeurs, lecture au démarrage. Tout passe par du SQL dynamique (appeler, valeur,
  --        calcul) : sans la migration, le contrôle est rouge au lieu de faire échouer la preuve entière.
  perform pg_temp.verifier('habillage', 'les trois fonctions existent',
    to_regprocedure('public.habillage_par_defaut()') is not null
    and to_regprocedure('public.regler_habillage_centre(integer, text, boolean)') is not null
    and to_regprocedure('public.regler_habillage_reseau(text)') is not null, '');
  perform pg_temp.attendre('habillage', 'lieux.habillage : texte, peut être nul, nul par défaut',
    (select format('%s %s %s', a.udt_name, a.is_nullable, coalesce(a.column_default, 'sans défaut')) from information_schema.columns a
      where a.table_schema = 'public' and a.table_name = 'lieux' and a.column_name = 'habillage'), 'text YES sans défaut');
  perform pg_temp.attendre('habillage', 'lieux.habillage_libre : booléen, non nul, vrai par défaut',
    (select format('%s %s %s', a.udt_name, a.is_nullable, a.column_default) from information_schema.columns a
      where a.table_schema = 'public' and a.table_name = 'lieux' and a.column_name = 'habillage_libre'), 'bool NO true');
  perform pg_temp.attendre('habillage', 'avant tout réglage, les centres 1 et 2 n''ont aucun habillage et laissent le choix',
    pg_temp.calcul(format(c_hab_lieux, v_lieu1, v_lieu2)),
    case when v_lieu1 < v_lieu2 then format('%s:nul:true,%s:nul:true', v_lieu1, v_lieu2) else format('%s:nul:true,%s:nul:true', v_lieu2, v_lieu1) end);
  perform pg_temp.attendre('habillage', 'la contrainte de la colonne refuse un habillage inconnu (23514)',
    pg_temp.valeur_proprio(null, null, null, format('update public.lieux set habillage = ''rose'' where id = %s returning 1', v_lieu1)), 'ERREUR 23514');
  perform pg_temp.verifier('habillage', 'la contrainte de réglages admet la clé globale habillage_reseau',
    coalesce((select pg_get_constraintdef(c.oid) like '%habillage_reseau%' from pg_constraint c
               where c.conrelid = 'public.settings'::regclass and c.conname = 'settings_globaux_prevus'), false), '');
  perform pg_temp.attendre('habillage', 'la contrainte de réglages refuse toujours une autre clé globale (23514)',
    pg_temp.valeur_proprio(null, null, null, 'insert into public.settings (key, value, promo_id) values (''preuve_autre_cle'', ''x'', null) returning 1'), 'ERREUR 23514');
  for v_x in select * from (values ('habillage_par_defaut()'), ('regler_habillage_centre(integer, text, boolean)'), ('regler_habillage_reseau(text)')) t(sig) loop
    perform pg_temp.attendre('habillage', format('droit d''exécution de %s : authenticated oui ; anon et service_role non', v_x.sig),
      pg_temp.calcul(format('select concat_ws('','', has_function_privilege(''authenticated'', ''public.%1$s'', ''execute''), has_function_privilege(''anon'', ''public.%1$s'', ''execute''), has_function_privilege(''service_role'', ''public.%1$s'', ''execute''))', v_x.sig)),
      't,f,f');
  end loop;

  -- Réglage d'un centre. Le texte des refus est celui de la base ; un refus ne change aucune ligne.
  perform pg_temp.attendre('habillage', 'la direction règle l''habillage de son centre',
    pg_temp.appeler(c_dir_n, '1', null, format('select public.regler_habillage_centre(%s, ''ecf'', false)::text', v_lieu1)),
    format('OK {"libre": false, "lieu_id": %s, "habillage": "ecf"}', v_lieu1));
  perform pg_temp.attendre('habillage', 'le réglage est écrit sur son centre seulement (ecf, pas libre)',
    pg_temp.calcul(format(c_hab_lieux, v_lieu1, v_lieu2)),
    case when v_lieu1 < v_lieu2 then format('%s:ecf:false,%s:nul:true', v_lieu1, v_lieu2) else format('%s:nul:true,%s:ecf:false', v_lieu2, v_lieu1) end);
  v_hs := pg_temp.calcul(format(c_hab_lieux, v_lieu1, v_lieu2));
  perform pg_temp.attendre('habillage', 'la direction d''un autre centre est refusée (42501)',
    pg_temp.appeler(c_dir_n, '1', null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu2)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'la direction du centre 2 visant le centre 1 est refusée (42501)',
    pg_temp.appeler(c_dir_m, '2', null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'un formateur est refusé (42501)',
    pg_temp.appeler(c_form_n, '1', null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'le siège est refusé (42501) : il règle le réseau, pas un centre',
    pg_temp.appeler(c_siege, null, null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'un stagiaire est refusé (42501)',
    pg_temp.appeler(c_stag_n, '1', null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'un compte sans rôle est refusé (42501)',
    pg_temp.appeler(c_sans_role, null, null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'anon est refusé (42501)',
    left(pg_temp.appeler(null, null, null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)), 12), 'ERREUR 42501');
  perform pg_temp.attendre('habillage', 'le fondateur en aperçu formateur est refusé (42501)',
    pg_temp.appeler(v_fond, '1', 'formateur', format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'le fondateur en aperçu siège est refusé (42501)',
    pg_temp.appeler(v_fond, null, 'siege', format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu1)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'le fondateur en aperçu direction du centre 1 est refusé sur le centre 2 (42501)',
    pg_temp.appeler(v_fond, '1', 'direction', format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu2)),
    'ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'aucun de ces refus n''a changé une ligne de lieux', pg_temp.calcul(format(c_hab_lieux, v_lieu1, v_lieu2)), v_hs);
  perform pg_temp.attendre('habillage', 'un habillage inconnu est refusé par la phrase de la base, le refus de droit passant avant',
    concat_ws(' | ',
      pg_temp.appeler(c_dir_n, '1', null, format('select public.regler_habillage_centre(%s, ''rose'', true)::text', v_lieu1)),
      pg_temp.appeler(c_dir_n, '1', null, format('select public.regler_habillage_centre(%s, '''', true)::text', v_lieu1)),
      pg_temp.appeler(c_dir_m, '2', null, format('select public.regler_habillage_centre(%s, ''rose'', true)::text', v_lieu1))),
    'ERREUR P0001 habillage: Cet habillage n''existe pas. | ERREUR P0001 habillage: Cet habillage n''existe pas. | ERREUR 42501 habillage: Réservé à la direction du centre.');
  perform pg_temp.attendre('habillage', 'libre nul est refusé par la phrase de la base',
    pg_temp.appeler(c_dir_n, '1', null, format('select public.regler_habillage_centre(%s, ''ecsr'', null)::text', v_lieu1)),
    'ERREUR P0001 habillage: Dis si chacun peut choisir le sien.');
  perform pg_temp.attendre('habillage', 'un refus de valeur ne change aucune ligne', pg_temp.calcul(format(c_hab_lieux, v_lieu1, v_lieu2)), v_hs);
  perform pg_temp.attendre('habillage', 'le fondateur vise un centre inexistant : refus par la phrase de la base',
    pg_temp.appeler(v_fond, null, null, 'select public.regler_habillage_centre(2147483000, ''ecsr'', true)::text'),
    'ERREUR P0001 habillage: Centre introuvable.');
  perform pg_temp.attendre('habillage', 'le fondateur règle un centre (hors aperçu) : ecsr, libre',
    pg_temp.appeler(v_fond, null, null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu2)),
    format('OK {"libre": true, "lieu_id": %s, "habillage": "ecsr"}', v_lieu2));
  perform pg_temp.attendre('habillage', 'le fondateur en aperçu direction règle le centre de la promo affichée (promo 1) : ecf, pas libre',
    pg_temp.appeler(v_fond, '1', 'direction', format('select public.regler_habillage_centre(%s, ''ecf'', false)::text', v_lieu1)),
    format('OK {"libre": false, "lieu_id": %s, "habillage": "ecf"}', v_lieu1));
  perform pg_temp.attendre('habillage', 'nul retire l''habillage du centre',
    pg_temp.appeler(c_dir_n, '1', null, format('select public.regler_habillage_centre(%s, null, true)::text', v_lieu1)),
    format('OK {"libre": true, "lieu_id": %s, "habillage": null}', v_lieu1));
  for v_x in select * from (values ('siège', c_siege), ('direction', c_dir_n), ('formateur', c_form_n)) t(nom, email) loop
    v_obt := pg_temp.ecrire(v_x.email, '1', null, format('update public.lieux set habillage = ''ecf'', habillage_libre = false where id = %s', v_lieu1));
    perform pg_temp.verifier('habillage', format('aucune écriture directe de l''habillage d''un centre par %s (refus 42501 ou 0 ligne)', v_x.nom),
      v_obt in ('REFUS 42501', 'OK 0'), v_obt);
  end loop;
  perform pg_temp.attendre('habillage', 'aucune de ces écritures directes n''a changé le centre 1',
    pg_temp.calcul(format('select (habillage is null and habillage_libre)::text from public.lieux where id = %s', v_lieu1)), 'true');

  -- Réglage du réseau.
  perform pg_temp.attendre('habillage', 'le siège règle l''habillage du réseau',
    pg_temp.appeler(c_siege, null, null, 'select public.regler_habillage_reseau(''ecf'')::text'), 'OK {"habillage": "ecf"}');
  perform pg_temp.attendre('habillage', 'une seule ligne globale, valeur ecf', pg_temp.calcul(c_hab_reseau), '1 ecf');
  perform pg_temp.attendre('habillage', 'le fondateur règle le réseau (la ligne est remplacée, jamais doublée)',
    pg_temp.appeler(v_fond, null, null, 'select public.regler_habillage_reseau(''ecsr'')::text') || ' | ' || pg_temp.calcul(c_hab_reseau),
    'OK {"habillage": "ecsr"} | 1 ecsr');
  perform pg_temp.attendre('habillage', 'le fondateur en aperçu siège règle le réseau',
    pg_temp.appeler(v_fond, null, 'siege', 'select public.regler_habillage_reseau(''ecf'')::text') || ' | ' || pg_temp.calcul(c_hab_reseau),
    'OK {"habillage": "ecf"} | 1 ecf');
  for v_x in select * from (values ('une direction', c_dir_n, '1', null), ('un formateur', c_form_n, '1', null), ('un stagiaire', c_stag_n, '1', null),
                                   ('un compte sans rôle', c_sans_role, null, null), ('le fondateur en aperçu direction', v_fond, '1', 'direction'),
                                   ('le fondateur en aperçu formateur', v_fond, '1', 'formateur')) t(nom, email, promo, apercu) loop
    perform pg_temp.attendre('habillage', format('%s est refusé(e) sur le réseau (42501), rien ne change', v_x.nom),
      pg_temp.appeler(v_x.email, v_x.promo, v_x.apercu, 'select public.regler_habillage_reseau(''ecsr'')::text') || ' | ' || pg_temp.calcul(c_hab_reseau),
      'ERREUR 42501 habillage: Réservé au siège. | 1 ecf');
  end loop;
  perform pg_temp.attendre('habillage', 'anon est refusé sur le réseau (42501)',
    left(pg_temp.appeler(null, null, null, 'select public.regler_habillage_reseau(''ecsr'')::text'), 12), 'ERREUR 42501');
  perform pg_temp.attendre('habillage', 'un habillage inconnu est refusé sur le réseau, rien ne change',
    pg_temp.appeler(c_siege, null, null, 'select public.regler_habillage_reseau(''rose'')::text') || ' | ' || pg_temp.calcul(c_hab_reseau),
    'ERREUR P0001 habillage: Cet habillage n''existe pas. | 1 ecf');

  -- Lecture au démarrage : le centre de la promo affichée (ecf, pas libre), le réseau (ecf) ; le centre 2 : ecsr, libre.
  perform pg_temp.appeler(c_dir_n, '1', null, format('select public.regler_habillage_centre(%s, ''ecf'', false)::text', v_lieu1));
  perform pg_temp.appeler(v_fond, null, null, format('select public.regler_habillage_centre(%s, ''ecsr'', true)::text', v_lieu2));
  perform pg_temp.attendre('habillage', 'un stagiaire de la promo 1 lit les valeurs de son centre et du réseau, en une seule ligne',
    pg_temp.appeler(c_stag_n, '1', null, c_hab_lire), 'OK 1 ; ecf ; false ; ecf');
  perform pg_temp.attendre('habillage', 'un formateur de la promo 2 lit les valeurs de son centre, pas de celui d''à côté',
    pg_temp.appeler(c_form_m, '2', null, c_hab_lire), 'OK 1 ; ecsr ; true ; ecf');
  perform pg_temp.attendre('habillage', 'la direction lit celles de son centre',
    pg_temp.appeler(c_dir_n, '1', null, c_hab_lire), 'OK 1 ; ecf ; false ; ecf');
  perform pg_temp.attendre('habillage', 'sans promo affichée, une direction lit le centre de ses affectations',
    pg_temp.appeler(c_dir_n, null, null, c_hab_lire) || ' / ' || pg_temp.appeler(c_dir_m, null, null, c_hab_lire),
    'OK 1 ; ecf ; false ; ecf / OK 1 ; ecsr ; true ; ecf');
  perform pg_temp.attendre('habillage', 'sans promo affichée, un formateur lit le centre de sa promo',
    pg_temp.appeler(c_form_n, null, null, c_hab_lire), 'OK 1 ; ecf ; false ; ecf');
  perform pg_temp.attendre('habillage', 'le siège (aucun centre) lit le réseau seul : centre nul, libre vrai',
    pg_temp.appeler(c_siege, null, null, c_hab_lire), 'OK 1 ; nul ; true ; ecf');
  perform pg_temp.attendre('habillage', 'un compte sans rôle ni centre lit le réseau seul',
    pg_temp.appeler(c_sans_role, null, null, c_hab_lire), 'OK 1 ; nul ; true ; ecf');
  perform pg_temp.attendre('habillage', 'le fondateur en aperçu direction lit le centre de la promo affichée',
    pg_temp.appeler(v_fond, '1', 'direction', c_hab_lire), 'OK 1 ; ecf ; false ; ecf');
  perform pg_temp.attendre('habillage', 'anon ne lit rien (42501)', left(pg_temp.appeler(null, null, null, c_hab_lire), 12), 'ERREUR 42501');
  perform pg_temp.attendre('habillage', 'une valeur de réseau abîmée en base est lue comme absente',
    pg_temp.calcul('update public.settings set value = ''rose'' where promo_id is null and key = ''habillage_reseau'' returning ''ok''')
      || ' / ' || pg_temp.appeler(c_stag_n, '1', null, c_hab_lire), 'ok / OK 1 ; ecf ; false ; nul');
  perform pg_temp.attendre('habillage', 'le siège retire l''habillage du réseau (nul) : plus aucune ligne, lecture nulle',
    pg_temp.appeler(c_siege, null, null, 'select public.regler_habillage_reseau(null)::text') || ' | ' || pg_temp.calcul(c_hab_reseau)
      || ' | ' || pg_temp.appeler(c_stag_n, '1', null, c_hab_lire),
    'OK {"habillage": null} | 0 nul | OK 1 ; ecf ; false ; nul');
  -- Une direction dont le centre n'a aucune promo (aucune promo affichée) lit le centre de son affectation ; un jeton sans
  -- adresse (rôle connecté, aucune adresse) est refusé.
  insert into public.lieux (nom) values ('Preuve centre sans promo') returning id into v_l_vide;
  insert into public.user_profiles (email, role, is_admin) values (c_dir_vide, 'prof', false);
  insert into public.affectations (email, role, promo_id, lieu_id) values (c_dir_vide, 'direction', null, v_l_vide);
  perform pg_temp.appeler(v_fond, null, null, format('select public.regler_habillage_centre(%s, ''ecf'', true)::text', v_l_vide));
  perform pg_temp.attendre('habillage', 'une direction dont le centre n''a aucune promo lit le réglage de ce centre',
    pg_temp.appeler(c_dir_vide, null, null, c_hab_lire), 'OK 1 ; ecf ; true ; nul');
  delete from public.affectations where email = c_dir_vide;
  delete from public.user_profiles where email = c_dir_vide;
  delete from public.lieux where id = v_l_vide;
  perform pg_temp.contexte(null, null, null);
  set local role authenticated;
  begin
    execute c_hab_lire into v_obt;
    v_obt := 'OK ' || coalesce(v_obt, 'nul');
  exception when others then
    v_obt := 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 120);
  end;
  perform pg_temp.proprio();
  perform pg_temp.attendre('habillage', 'un jeton connecté sans adresse ne lit rien (42501)', v_obt, 'ERREUR 42501 habillage: Connexion requise.');
  -- Le réseau est remis à ecf : le retour 3 doit effacer cette ligne pour rétablir la contrainte d'origine.
  perform pg_temp.appeler(c_siege, null, null, 'select public.regler_habillage_reseau(''ecf'')::text');

  -- 4. comptes_reseau : droits.
  perform pg_temp.verifier('comptes_reseau', 'la fonction comptes_reseau() existe', to_regprocedure('public.comptes_reseau()') is not null,
    '');
  perform pg_temp.attendre('comptes_reseau', 'permis au siège (une ligne par centre)',
    pg_temp.appeler(c_siege, null, null, c_compter), 'OK ' || (select count(*) from public.lieux));
  perform pg_temp.attendre('comptes_reseau', 'permis au fondateur hors aperçu',
    pg_temp.appeler(v_fond, null, null, c_compter), 'OK ' || (select count(*) from public.lieux));
  perform pg_temp.attendre('comptes_reseau', 'permis au fondateur en aperçu siège',
    pg_temp.appeler(v_fond, null, 'siege', c_compter), 'OK ' || (select count(*) from public.lieux));
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à la direction d''un centre',
    pg_temp.appeler(c_dir_n, null, null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à la direction d''un autre centre',
    pg_temp.appeler(c_dir_m, null, null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un formateur',
    pg_temp.appeler(c_form_n, '1', null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un formateur d''une autre promo',
    pg_temp.appeler(c_form_m, '2', null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un stagiaire',
    pg_temp.appeler(c_stag_n, '1', null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) à un compte sans fiche ni affectation',
    pg_temp.appeler(c_sans_role, null, null, c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) au fondateur en aperçu direction',
    pg_temp.appeler(v_fond, null, 'direction', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) au fondateur en aperçu formateur',
    pg_temp.appeler(v_fond, null, 'formateur', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'refusé (42501) au fondateur en aperçu stagiaire',
    pg_temp.appeler(v_fond, null, 'stagiaire', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'un en-tête d''aperçu siège envoyé par un compte qui n''est pas le fondateur ne lui ouvre rien',
    pg_temp.appeler(c_dir_n, null, 'siege', c_compter), 'ERREUR 42501 reseau: Réservé au siège.');
  perform pg_temp.attendre('comptes_reseau', 'non exécutable par anon (42501, aucun droit d''exécution)',
    left(pg_temp.appeler(null, null, null, c_compter), 12), 'ERREUR 42501');
  perform pg_temp.attendre('comptes_reseau', 'droit d''exécution : authenticated oui ; anon, service_role et public non (catalogue)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public.comptes_reseau()'', ''execute''), has_function_privilege(''anon'', ''public.comptes_reseau()'', ''execute''), has_function_privilege(''service_role'', ''public.comptes_reseau()'', ''execute''))'),
    't,f,f');

  -- 5. comptes_reseau : forme. Les colonnes, dans l'ordre, et aucune qui nomme une personne, une adresse, un stagiaire
  --    ou une promo.
  select array_agg(u.n order by u.o) into v_cols
    from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as u(n, m, o)
   where p.oid = to_regprocedure('public.comptes_reseau()') and u.m = 't';
  perform pg_temp.attendre('comptes_reseau', 'forme : les 19 colonnes attendues, dans l''ordre', array_to_string(v_cols, ','),
    array_to_string(c_colonnes, ','));
  select string_agg(k.cnom, ', ') into v_mauvaises from unnest(coalesce(v_cols, '{}')) as k(cnom)
   where (k.cnom like '%nom%' and k.cnom <> 'lieu_nom') or k.cnom like '%email%' or k.cnom like '%stagiaire%'
      or k.cnom like '%promo_id%' or k.cnom like '%prenom%' or k.cnom like '%mail%';
  perform pg_temp.verifier('comptes_reseau', 'forme : aucune colonne dont le nom contient nom (hors lieu_nom), email, stagiaire ou promo_id',
    v_cols is not null and v_mauvaises is null, coalesce(v_mauvaises, ''));

  -- 6. comptes_reseau : les lignes, lues par le siège (une seule lecture), avant toute création de centre.
  v_json := pg_temp.appeler(c_siege, null, null, c_lire);
  v_lignes := case when v_json like 'OK %' and v_json <> 'OK nul' then substr(v_json, 4)::jsonb end;
  perform pg_temp.verifier('comptes_reseau', 'la lecture du siège rend un tableau de lignes', v_lignes is not null and jsonb_typeof(v_lignes) = 'array',
    case when v_lignes is null then left(v_json, 60) else '' end);
  perform pg_temp.attendre('comptes_reseau', 'une ligne par centre, tout centre compris',
    (select count(*) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)))::text, (select count(*) from public.lieux)::text);
  perform pg_temp.attendre('comptes_reseau', 'les centres de la base figurent tous (identifiants rendus = identifiants de lieux)',
    (select string_agg(r ->> 'lieu_id', ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r),
    (select string_agg(id::text, ',' order by id) from public.lieux));
  -- Centre fixture : champ par champ, l'attendu de la fixture ; les parasites n'ont rien changé.
  perform pg_temp.attendre('comptes_reseau', 'ligne « fixture » : une promo en cours', pg_temp.champ(v_lignes, c_fix, 'promos_en_cours'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « fixture » : 6 en formation, donc non masquée (seuil 5)', pg_temp.champ(v_lignes, c_fix, 'masque'), 'false');
  for v_x in select * from champs order by ordre loop
    v_att := v_fx -> 'attendu' ->> v_x.cle;
    v_obt := pg_temp.champ(v_lignes, c_fix, v_x.colonne);
    if v_x.colonne = 'notes_somme' then
      perform pg_temp.verifier('comptes_reseau', format('ligne « fixture » : %s égal à l''attendu de la fixture (%s), à 1e-9 près', v_x.colonne, v_att),
        v_obt is not null and abs(v_obt::numeric - v_att::numeric) < 0.000000001, format('obtenu %s ; attendu %s', coalesce(v_obt, 'nul'), v_att));
    else
      perform pg_temp.attendre('comptes_reseau', format('ligne « fixture » : %s égal à l''attendu de la fixture (%s)', v_x.colonne, v_att), v_obt, v_att);
    end if;
  end loop;
  perform pg_temp.attendre('comptes_reseau', 'ligne « fixture » : le nom du centre est le seul nom rendu (lieu_nom)', pg_temp.champ(v_lignes, c_fix, 'lieu_nom'), c_fix);
  -- Centre petit : une promo en cours (qui finit aujourd'hui), 4 en formation : masqué, tout ce qui suit masque est nul.
  perform pg_temp.attendre('comptes_reseau', 'ligne « petit » : une promo en cours (son dernier jour compte)', pg_temp.champ(v_lignes, c_petit, 'promos_en_cours'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « petit » : 4 en formation, masqué', pg_temp.champ(v_lignes, c_petit, 'masque'), 'true');
  perform pg_temp.verifier('comptes_reseau', 'ligne « petit » : toutes les colonnes après masque sont nulles (présentes, vides)',
    (select coalesce(bool_and(pg_temp.champ_nul(v_lignes, c_petit, c)), false) from unnest(c_colonnes[6:19]) c),
    (select string_agg(c, ', ') from unnest(c_colonnes[6:19]) c where not pg_temp.champ_nul(v_lignes, c_petit, c)));
  -- Centre fini : aucune promo en cours, masqué, vide, malgré 6 fiches dans sa promo terminée.
  perform pg_temp.attendre('comptes_reseau', 'ligne « fini » : aucune promo en cours (promo terminée hier)', pg_temp.champ(v_lignes, c_fini, 'promos_en_cours'), '0');
  perform pg_temp.attendre('comptes_reseau', 'ligne « fini » : masqué', pg_temp.champ(v_lignes, c_fini, 'masque'), 'true');
  perform pg_temp.verifier('comptes_reseau', 'ligne « fini » : toutes les colonnes après masque sont nulles (6 fiches dans la promo terminée ne comptent pas)',
    (select coalesce(bool_and(pg_temp.champ_nul(v_lignes, c_fini, c)), false) from unnest(c_colonnes[6:19]) c),
    (select string_agg(c, ', ') from unnest(c_colonnes[6:19]) c where not pg_temp.champ_nul(v_lignes, c_fini, c)));
  -- Centre cinq : deux promos en cours de 3 et 2 en formation, plus un abandon et une promo terminée de 4 fiches. Juste au seuil.
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : deux promos en cours (la terminée ne compte pas)', pg_temp.champ(v_lignes, c_cinq, 'promos_en_cours'), '2');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 5 en formation, non masqué (le seuil est « moins de 5 »)', pg_temp.champ(v_lignes, c_cinq, 'masque'), 'false');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 6 inscrits, somme des deux promos en cours', pg_temp.champ(v_lignes, c_cinq, 'inscrits'), '6');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 5 en formation, somme des deux promos en cours', pg_temp.champ(v_lignes, c_cinq, 'en_formation'), '5');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : 1 abandon', pg_temp.champ(v_lignes, c_cinq, 'abandons'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : absences des promos en cours seulement (1)', pg_temp.champ(v_lignes, c_cinq, 'absences'), '1');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : passages prévus des promos en cours seulement (3)', pg_temp.champ(v_lignes, c_cinq, 'prevus'), '3');
  perform pg_temp.attendre('comptes_reseau', 'ligne « cinq » : sans tentative ni note ni EPCF, des zéros (non masqué : jamais nul)',
    concat_ws(',', pg_temp.champ(v_lignes, c_cinq, 'qcm_bonnes'), pg_temp.champ(v_lignes, c_cinq, 'examens_passes'),
              pg_temp.champ(v_lignes, c_cinq, 'notes_n'), pg_temp.champ(v_lignes, c_cinq, 'notes_somme'), pg_temp.champ(v_lignes, c_cinq, 'epcf_renseignes')),
    '0,0,0,0,0');
  -- Les centres réels figurent aussi, avec leur nom de centre et une promo en cours à partir de leurs dates réelles.
  perform pg_temp.attendre('comptes_reseau', 'centres réels : promos_en_cours égal au nombre de promos en cours de chaque centre',
    (select string_agg(r ->> 'lieu_id' || '=' || (r ->> 'promos_en_cours'), ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r),
    (select string_agg(l.id || '=' || (select count(*) from public.promos p where p.lieu_id = l.id and p.date_debut <= current_date
                                         and (p.date_fin is null or p.date_fin >= current_date)), ',' order by l.id) from public.lieux l));
  perform pg_temp.attendre('comptes_reseau', 'masque vrai pour tout centre de moins de 5 en formation sur ses promos en cours (centres réels compris)',
    (select string_agg(r ->> 'lieu_id' || '=' || (r ->> 'masque'), ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r),
    (select string_agg(l.id || '=' || ((select count(*) from public.stagiaires s join public.promos p on p.id = s.promo_id
                                         where p.lieu_id = l.id and s.actif and p.date_debut <= current_date
                                           and (p.date_fin is null or p.date_fin >= current_date)) < 5), ',' order by l.id) from public.lieux l));

  -- 7. demonstration : la colonne, sa valeur, et l'absence d'écriture directe.
  perform pg_temp.attendre('demonstration', 'la colonne lieux.demonstration existe (boolean, non nulle, faux par défaut)',
    (select format('%s %s %s', a.udt_name, a.is_nullable, a.column_default) from information_schema.columns a
      where a.table_schema = 'public' and a.table_name = 'lieux' and a.column_name = 'demonstration'),
    'bool NO false');
  perform pg_temp.attendre('demonstration', 'vrai pour le lieu 4 seulement (centre de démonstration)',
    pg_temp.calcul('select string_agg(id::text, '','' order by id) from public.lieux where demonstration'), '4');
  perform pg_temp.attendre('demonstration', 'comptes_reseau rend demonstration vrai pour le lieu 4 seulement',
    (select string_agg(r ->> 'lieu_id', ',' order by (r ->> 'lieu_id')::integer) from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) r
      where r ->> 'demonstration' = 'true'), '4');
  perform pg_temp.attendre('demonstration', 'le siège lit la colonne (lieu 4)',
    pg_temp.appeler(c_siege, null, null, 'select demonstration::text from public.lieux where id = 4'), 'OK true');
  perform pg_temp.attendre('demonstration', 'la direction du centre lit la colonne de son centre (faux)',
    pg_temp.appeler(c_dir_n, null, null, format('select demonstration::text from public.lieux where id = %s', v_lieu1)), 'OK false');
  for v_x in select * from (values ('siège', c_siege), ('direction', c_dir_n), ('formateur', c_form_n)) t(nom, email) loop
    v_obt := pg_temp.ecrire(v_x.email, null, null, 'update public.lieux set demonstration = true');
    perform pg_temp.verifier('demonstration', format('aucune écriture directe de demonstration par %s (modification : refus 42501 ou 0 ligne)', v_x.nom),
      v_obt in ('REFUS 42501', 'OK 0'), v_obt);
  end loop;
  v_obt := pg_temp.ecrire(c_siege, null, null, 'insert into public.lieux (nom, demonstration) values (''Preuve écriture directe'', true)');
  perform pg_temp.verifier('demonstration', 'aucun ajout direct de centre par le siège (refus 42501 ou 0 ligne)', v_obt in ('REFUS 42501', 'OK 0'), v_obt);
  v_obt := pg_temp.ecrire(c_dir_n, null, null, 'insert into public.lieux (nom, demonstration) values (''Preuve écriture directe'', true)');
  perform pg_temp.verifier('demonstration', 'aucun ajout direct de centre par la direction (refus 42501 ou 0 ligne)', v_obt in ('REFUS 42501', 'OK 0'), v_obt);

  -- 8. creer_centre.
  perform pg_temp.verifier('creer_centre', 'la fonction creer_centre(text) existe', to_regprocedure('public.creer_centre(text)') is not null, '');
  perform pg_temp.verifier('creer_centre', 'la séquence de lieux.id est recalée sur le plus grand identifiant (dernière valeur >= plus grand id, jugée juste après la migration)',
    v_seq_ok, v_seq_detail);
  select max(id) into v_max_avant from public.lieux;
  perform pg_temp.attendre('creer_centre', 'avant toute création, ce bloc ne tient aucun verrou consultatif',
    (select count(*) from pg_locks where locktype = 'advisory' and pid = pg_backend_pid())::text, '0');
  v_obt := pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''Preuve nouveau centre siege'')::text');
  perform pg_temp.attendre('creer_centre', 'une création prend un verrou consultatif de transaction (créations simultanées sérialisées : « Foo » et « FOO » ne passent pas ensemble)',
    (select count(*) from pg_locks where locktype = 'advisory' and pid = pg_backend_pid())::text, '1');
  v_id_a := case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end;
  perform pg_temp.verifier('creer_centre', 'le siège crée un centre : identifiant rendu, plus grand que tous les identifiants existants',
    v_id_a is not null and v_id_a > v_max_avant, format('rendu %s ; plus grand id avant %s', coalesce(v_id_a::text, left(v_obt, 80)), v_max_avant));
  perform pg_temp.attendre('creer_centre', 'le siège crée un centre : la ligne, lue en propriétaire, porte le nom donné et demonstration faux',
    pg_temp.calcul(format('select format(''%%s %%s'', nom, demonstration::text) from public.lieux where id = %s', coalesce(v_id_a::text, 'null'))),
    'Preuve nouveau centre siege false');
  select max(id) into v_max_avant from public.lieux;
  v_obt := pg_temp.appeler(v_fond, null, null, 'select public.creer_centre(''Preuve nouveau centre fondateur'')::text');
  v_id_b := case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end;
  perform pg_temp.verifier('creer_centre', 'le fondateur crée un centre : identifiant rendu, plus grand que tous les identifiants existants',
    v_id_b is not null and v_id_b > v_max_avant, format('rendu %s ; plus grand id avant %s', coalesce(v_id_b::text, left(v_obt, 80)), v_max_avant));
  perform pg_temp.attendre('creer_centre', 'le fondateur crée un centre : la ligne porte le nom donné',
    (select l.nom from public.lieux l where l.id = v_id_b), 'Preuve nouveau centre fondateur');
  select max(id) into v_max_avant from public.lieux;
  v_obt := pg_temp.appeler(v_fond, null, 'siege', 'select public.creer_centre(''Preuve nouveau centre aperçu'')::text');
  v_id_c := case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end;
  perform pg_temp.verifier('creer_centre', 'le fondateur en aperçu siège crée un centre : identifiant plus grand que les existants',
    v_id_c is not null and v_id_c > v_max_avant, format('rendu %s ; plus grand id avant %s', coalesce(v_id_c::text, left(v_obt, 80)), v_max_avant));
  select count(*) into n from public.lieux;
  perform pg_temp.attendre('creer_centre', 'le fondateur en aperçu direction est refusé (42501)',
    pg_temp.appeler(v_fond, null, 'direction', 'select public.creer_centre(''Preuve refusé direction'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'le fondateur en aperçu formateur est refusé (42501)',
    pg_temp.appeler(v_fond, null, 'formateur', 'select public.creer_centre(''Preuve refusé formateur'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'la direction est refusée (42501)',
    pg_temp.appeler(c_dir_n, null, null, 'select public.creer_centre(''Preuve refusé dir'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'un formateur est refusé (42501)',
    pg_temp.appeler(c_form_n, '1', null, 'select public.creer_centre(''Preuve refusé form'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'un stagiaire est refusé (42501)',
    pg_temp.appeler(c_stag_n, '1', null, 'select public.creer_centre(''Preuve refusé stag'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'un compte sans fiche ni affectation est refusé (42501)',
    pg_temp.appeler(c_sans_role, null, null, 'select public.creer_centre(''Preuve refusé sans rôle'')::text'), 'ERREUR 42501 centre: Réservé au siège.');
  perform pg_temp.attendre('creer_centre', 'anon n''a aucun droit d''exécution (42501)',
    left(pg_temp.appeler(null, null, null, 'select public.creer_centre(''Preuve refusé anon'')::text'), 12), 'ERREUR 42501');
  perform pg_temp.attendre('creer_centre', 'droit d''exécution : authenticated oui ; anon, service_role et public non (catalogue)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public.creer_centre(text)'', ''execute''), has_function_privilege(''anon'', ''public.creer_centre(text)'', ''execute''), has_function_privilege(''service_role'', ''public.creer_centre(text)'', ''execute''))'),
    't,f,f');
  perform pg_temp.attendre('creer_centre', 'un nom vide est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre('''')::text'), 'ERREUR P0001 centre: Le nom est requis.');
  perform pg_temp.attendre('creer_centre', 'un nom d''espaces est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''   '')::text'), 'ERREUR P0001 centre: Le nom est requis.');
  perform pg_temp.attendre('creer_centre', 'un nom nul est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(null)::text'), 'ERREUR P0001 centre: Le nom est requis.');
  perform pg_temp.attendre('creer_centre', 'un nom en double, casse différente, est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''PREUVE NOUVEAU CENTRE SIEGE'')::text'), 'ERREUR P0001 centre: Ce centre existe déjà.');
  perform pg_temp.attendre('creer_centre', 'un nom en double, espaces autour, est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''  preuve nouveau centre siege  '')::text'), 'ERREUR P0001 centre: Ce centre existe déjà.');
  perform pg_temp.attendre('creer_centre', 'un nom en double d''un centre réel est refusé avec la phrase',
    pg_temp.appeler(c_siege, null, null, format('select public.creer_centre(upper((select nom from public.lieux where id = %s)))::text', v_lieu1)),
    'ERREUR P0001 centre: Ce centre existe déjà.');
  v_obt := pg_temp.appeler(c_siege, null, null, 'select public.creer_centre(''  Preuve   centre   nettoyé  '')::text');
  perform pg_temp.attendre('creer_centre', 'le nom est nettoyé : espaces de bord retirés, espaces internes réduits à un',
    (select l.nom from public.lieux l where l.id = case when v_obt like 'OK %' and substr(v_obt, 4) ~ '^\d+$' then substr(v_obt, 4)::integer end),
    'Preuve centre nettoyé');
  perform pg_temp.attendre('creer_centre', 'les refus n''ont créé aucun centre (3 créations réussies avant, 1 de plus après le nom nettoyé)',
    (select count(*) from public.lieux)::text, (n + 1)::text);
  perform pg_temp.attendre('demonstration', 'après les créations, demonstration reste vrai pour le lieu 4 seulement (centres créés : faux)',
    pg_temp.calcul('select string_agg(id::text, '','' order by id) from public.lieux where demonstration'), '4');

  -- 8 bis. Étape 2 : regler_affectations_formateur, inviter_compte, _profil_formateur. dir_n dirige le centre de la promo 1
  --         (lieu v_l1) ; form_m est formateur de la promo 2 (autre centre) ; v_pn est une promo en plus du centre de dir_n.
  perform pg_temp.verifier('equipe', 'les fonctions regler_affectations_formateur et _profil_formateur existent',
    to_regprocedure('public.regler_affectations_formateur(text, integer, integer[], integer)') is not null
    and to_regprocedure('public._profil_formateur(text, integer, text)') is not null, '');
  perform pg_temp.attendre('equipe', 'droits d''exécution de regler_affectations_formateur : authenticated oui ; anon, service_role non (catalogue)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public.regler_affectations_formateur(text, integer, integer[], integer)'', ''execute''), has_function_privilege(''anon'', ''public.regler_affectations_formateur(text, integer, integer[], integer)'', ''execute''), has_function_privilege(''service_role'', ''public.regler_affectations_formateur(text, integer, integer[], integer)'', ''execute''))'),
    't,f,f');
  perform pg_temp.attendre('equipe', 'droits d''exécution de _profil_formateur (interne) : ni authenticated, ni anon, ni service_role (catalogue)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public._profil_formateur(text, integer, text)'', ''execute''), has_function_privilege(''anon'', ''public._profil_formateur(text, integer, text)'', ''execute''), has_function_privilege(''service_role'', ''public._profil_formateur(text, integer, text)'', ''execute''))'),
    'f,f,f');
  perform pg_temp.attendre('equipe', '_profil_formateur n''est pas appelable par la direction (42501)',
    left(pg_temp.appeler(c_dir_n, '1', null, format('select public._profil_formateur(%L, null, %L)::text', c_absent, c_dir_n)), 12), 'ERREUR 42501');
  perform pg_temp.attendre('equipe', 'form_m part de sa seule promo 2 (un autre centre)', pg_temp.formateur_de(c_form_m), '2');
  v_dsn := pg_temp.nb_direction_siege();
  v_np := (select count(*) from public.user_profiles);
  select a.id into v_aff_id from public.affectations a where a.email = c_form_m and a.role = 'formateur' and a.promo_id = 2;

  -- Droits : qui peut, qui ne peut pas (chaque refus ne change aucune ligne).
  v_snap := pg_temp.instantane();
  perform pg_temp.attendre('equipe', 'dir_n sur le centre de la promo 2 : refus 42501 avec la phrase',
    pg_temp.regler(c_dir_n, null, c_form_m, v_lieu2, 'array[2]'), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'dir_m (direction de l''autre centre) sur le centre de la promo 1 : refus 42501 avec la phrase',
    pg_temp.regler(c_dir_m, null, c_form_m, v_l1, 'array[1]'), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'un formateur (form_n) : refus 42501 avec la phrase',
    pg_temp.regler(c_form_n, null, c_form_m, v_l1, 'array[1]'), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'le siège (affectation siège) : refus 42501 avec la phrase',
    pg_temp.regler(c_siege, null, c_form_m, v_l1, 'array[1]'), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'un stagiaire : refus 42501 avec la phrase',
    pg_temp.regler(c_stag_n, null, c_form_m, v_l1, 'array[1]'), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'un compte sans fiche ni affectation : refus 42501 avec la phrase',
    pg_temp.regler(c_sans_role, null, c_form_m, v_l1, 'array[1]'), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'anon : refus 42501',
    left(pg_temp.regler(null, null, c_form_m, v_l1, 'array[1]'), 12), 'ERREUR 42501');
  perform pg_temp.attendre('equipe', 'le fondateur en aperçu formateur, stagiaire ou siège : refus 42501',
    concat_ws(' ; ', left(pg_temp.regler(v_fond, 'formateur', c_form_m, v_l1, 'array[1]'), 12),
              left(pg_temp.regler(v_fond, 'stagiaire', c_form_m, v_l1, 'array[1]'), 12),
              left(pg_temp.regler(v_fond, 'siege', c_form_m, v_l1, 'array[1]'), 12)),
    'ERREUR 42501 ; ERREUR 42501 ; ERREUR 42501');
  perform pg_temp.attendre('equipe', 'le fondateur en aperçu direction sur la promo 1, centre de la promo 2 : refus 42501',
    pg_temp.regler(v_fond, 'direction', c_form_m, v_lieu2, 'array[2]'), 'ERREUR 42501 equipe: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'les refus de droit n''ont changé aucune ligne (affectations et profils)', pg_temp.instantane(), v_snap);

  -- dir_n règle form_m : ajout de deux promos, retrait, ligne de l'autre centre intacte.
  v_rep := pg_temp.regler(c_dir_n, null, c_form_m, v_l1, format('array[1,%s]', v_pn));
  v_r := pg_temp.reponse(v_rep);
  perform pg_temp.attendre('equipe', 'dir_n règle form_m sur les promos 1 et N2 : email, cree faux, ajoutees [1, N2], retirees []',
    concat_ws(' ; ', v_r ->> 'email', v_r ->> 'cree', (v_r -> 'ajoutees')::text, (v_r -> 'retirees')::text),
    concat_ws(' ; ', c_form_m, 'false', format('[1, %s]', v_pn), '[]'));
  perform pg_temp.attendre('equipe', 'form_m a maintenant ses deux promos du centre de dir_n et sa promo 2 intacte', pg_temp.formateur_de(c_form_m), format('1,2,%s', v_pn));
  v_rep := pg_temp.regler(c_dir_n, null, c_form_m, v_l1, 'array[1]');
  v_r := pg_temp.reponse(v_rep);
  perform pg_temp.attendre('equipe', 'dir_n retire N2 en gardant la promo 1 : ajoutees [], retirees [N2]',
    concat_ws(' ; ', (v_r -> 'ajoutees')::text, (v_r -> 'retirees')::text), format('[] ; [%s]', v_pn));
  perform pg_temp.attendre('equipe', 'la ligne de la promo N2 est partie, celles des promos 1 et 2 restent', pg_temp.formateur_de(c_form_m), '1,2');
  v_rep := pg_temp.regler(c_dir_n, null, c_form_m, v_l1, 'array[1,1,1]');
  v_r := pg_temp.reponse(v_rep);
  perform pg_temp.attendre('equipe', 'la même liste redonnée (avec doublons) ne change rien : ajoutees [], retirees []',
    concat_ws(' ; ', (v_r -> 'ajoutees')::text, (v_r -> 'retirees')::text), '[] ; []');

  -- Refus de contenu : aucune ligne changée.
  v_snap := pg_temp.instantane();
  perform pg_temp.attendre('equipe', 'une promo d''un autre centre dans la liste : refus avec la phrase',
    pg_temp.regler(c_dir_n, null, c_form_m, v_l1, format('array[%s,2]', v_pn)), 'ERREUR P0001 equipe: Une promo choisie n''est pas dans ce centre.');
  perform pg_temp.attendre('equipe', 'une promo qui n''existe pas dans la liste : refus avec la phrase',
    pg_temp.regler(c_dir_n, null, c_form_m, v_l1, 'array[999999]'), 'ERREUR P0001 equipe: Une promo choisie n''est pas dans ce centre.');
  perform pg_temp.attendre('equipe', 'une adresse invalide : refus avec la phrase',
    pg_temp.regler(c_dir_n, null, 'pas une adresse', v_l1, 'array[1]'), 'ERREUR P0001 equipe: Adresse e-mail invalide.');
  perform pg_temp.attendre('equipe', 'un centre qui n''existe pas, demandé par le fondateur : refus avec la phrase',
    pg_temp.regler(v_fond, null, c_form_m, 999999, 'array[]::integer[]'), 'ERREUR P0001 equipe: Centre introuvable.');
  perform pg_temp.attendre('equipe', 'aucun de ces refus n''a changé une ligne (aucune ligne ajoutée ni retirée, aucun profil créé)', pg_temp.instantane(), v_snap);

  -- Le fondateur, et le fondateur en aperçu direction.
  v_r := pg_temp.reponse(pg_temp.regler(v_fond, null, c_form_m, v_l1, format('array[1,%s]', v_pn)));
  perform pg_temp.attendre('equipe', 'le fondateur règle form_m sur le centre de la promo 1 : ajoutees [N2]',
    concat_ws(' ; ', (v_r -> 'ajoutees')::text, (v_r -> 'retirees')::text), format('[%s] ; []', v_pn));
  v_r := pg_temp.reponse(pg_temp.regler(v_fond, 'direction', c_form_m, v_l1, 'array[1]'));
  perform pg_temp.attendre('equipe', 'le fondateur en aperçu direction sur la promo 1 règle le centre de la promo 1 : retirees [N2]',
    concat_ws(' ; ', (v_r -> 'ajoutees')::text, (v_r -> 'retirees')::text), format('[] ; [%s]', v_pn));
  perform pg_temp.attendre('equipe', 'le fondateur en aperçu direction sur la promo 2 règle le centre de la promo 2 (sa promo 2 redonnée : rien ne change)',
    (pg_temp.reponse(pg_temp.regler(v_fond, 'direction', c_form_m, v_lieu2, 'array[2]', 'null', '2')) -> 'retirees')::text, '[]');
  perform pg_temp.attendre('equipe', 'le fondateur en aperçu direction sur la promo 2 ne règle pas le centre de la promo 1 (refus 42501)',
    left(pg_temp.regler(v_fond, 'direction', c_form_m, v_l1, 'array[1]', 'null', '2'), 12), 'ERREUR 42501');
  perform pg_temp.informer('limite documentée (D3) : le fondateur en aperçu direction sous l''en-tête de la promo 2 lit la table affectations',
    pg_temp.valeur(v_fond, '2', 'direction', format('select count(*) filter (where role = ''formateur'' and promo_id in (select id from public.promos where lieu_id = %s))::text || '' lignes formateur du centre de la promo 1 visibles, '' || count(*)::text || '' lignes au total'' from public.affectations', v_l1)));

  -- Compte stagiaire : refusé par regler_affectations_formateur ET par inviter_compte.
  v_snap := pg_temp.instantane();
  perform pg_temp.attendre('equipe', 'l''adresse d''un compte stagiaire est refusée par regler_affectations_formateur (avec la phrase)',
    pg_temp.regler(c_dir_n, null, c_stag_n, v_l1, 'array[1]'), 'ERREUR P0001 equipe: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('equipe', 'la même adresse en majuscules, avec espaces, est refusée de même',
    pg_temp.regler(c_dir_n, null, '  ' || upper(c_stag_n) || ' ', v_l1, 'array[1]'), 'ERREUR P0001 equipe: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('equipe', 'une liste vide pour l''adresse d''un compte stagiaire est refusée de même',
    pg_temp.regler(c_dir_n, null, c_stag_n, v_l1, 'array[]::integer[]'), 'ERREUR P0001 equipe: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('equipe', 'l''adresse d''un compte stagiaire est refusée par inviter_compte(..., formateur, ...) (avec la phrase)',
    pg_temp.appeler(c_dir_n, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', c_stag_n)),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('equipe', 'ces refus n''ont changé aucune ligne (aucune affectation donnée au stagiaire)', pg_temp.instantane(), v_snap);

  -- Nouveaux comptes : profil créé par la fonction commune.
  v_rep := pg_temp.regler(c_dir_n, null, c_nouveau, v_l1, 'array[1]', v_fc::text);
  v_r := pg_temp.reponse(v_rep);
  perform pg_temp.attendre('equipe', 'un nouvel e-mail : cree vrai, ajoutees [1], retirees []',
    concat_ws(' ; ', v_r ->> 'email', v_r ->> 'cree', (v_r -> 'ajoutees')::text, (v_r -> 'retirees')::text),
    concat_ws(' ; ', c_nouveau, 'true', '[1]', '[]'));
  perform pg_temp.attendre('equipe', 'le profil créé : role prof, is_admin vrai, invité par l''appelant, fiche formateur posée (libre), aucune fiche de stagiaire',
    (select concat_ws(' ; ', u.role, u.is_admin::text, u.invited_by_email, coalesce((u.prof_id = v_fc)::text, 'fiche absente'), coalesce(u.stagiaire_id::text, 'aucune'), u.is_founder::text)
       from public.user_profiles u where u.email = c_nouveau),
    concat_ws(' ; ', 'prof', 'true', c_dir_n, 'true', 'aucune', 'false'));
  perform pg_temp.attendre('equipe', 'l''affectation créée : formateur de la promo 1, posée par l''appelant, aucune portée de centre',
    (select string_agg(format('%s:%s:%s:%s', a.role, a.promo_id, coalesce(a.lieu_id::text, 'aucun'), a.cree_par), ',') from public.affectations a where a.email = c_nouveau),
    format('formateur:1:aucun:%s', c_dir_n));
  v_r := pg_temp.reponse(pg_temp.regler(c_dir_n, null, c_nouveau, v_l1, 'array[1]'));
  perform pg_temp.attendre('equipe', 'le même appel répété : cree faux, rien ajouté ni retiré, profil inchangé (une seule ligne de profil)',
    concat_ws(' ; ', v_r ->> 'cree', (v_r -> 'ajoutees')::text, (v_r -> 'retirees')::text, (select count(*) from public.user_profiles where email = c_nouveau)::text),
    'false ; [] ; [] ; 1');
  v_r := pg_temp.reponse(pg_temp.regler(c_dir_n, null, c_majuscule, v_l1, 'array[1]', v_fl::text));
  perform pg_temp.attendre('equipe', 'une adresse en majuscules est enregistrée en minuscules ; une fiche formateur déjà reliée n''est pas posée',
    (select concat_ws(' ; ', v_r ->> 'cree', u.email, (u.prof_id is null)::text) from public.user_profiles u where lower(u.email) = lower(c_majuscule)),
    concat_ws(' ; ', 'true', lower(c_majuscule), 'true'));
  perform pg_temp.attendre('equipe', 'une fiche formateur donnée à un compte qui existe déjà n''est pas posée (profil existant jamais modifié)',
    (select concat_ws(' ; ', (pg_temp.reponse(pg_temp.regler(c_dir_n, null, c_nouveau, v_l1, 'array[1]', v_fb::text)) ->> 'cree'), coalesce((u.prof_id = v_fc)::text, 'fiche absente')) from public.user_profiles u where u.email = c_nouveau),
    'false ; true');
  -- Un profil dont l'adresse a des majuscules (comptes anciens) : retrouvé sans tenir compte de la casse, la ligne
  -- d'affectation et la réponse portent l'adresse du profil.
  insert into public.user_profiles (email, role, is_admin) values ('Preuve5.Mixte@Exemple.Invalid', 'prof', true);
  v_r := pg_temp.reponse(pg_temp.regler(c_dir_n, null, 'preuve5.mixte@exemple.invalid', v_l1, 'array[1]'));
  perform pg_temp.attendre('equipe', 'un profil à adresse mixte est retrouvé sans tenir compte de la casse : pas de second profil, affectation et réponse à son adresse',
    concat_ws(' ; ', v_r ->> 'cree', v_r ->> 'email', (select count(*) from public.user_profiles where lower(email) = 'preuve5.mixte@exemple.invalid')::text,
              (select string_agg(a.email, ',') from public.affectations a where lower(a.email) = 'preuve5.mixte@exemple.invalid')),
    'false ; Preuve5.Mixte@Exemple.Invalid ; 1 ; Preuve5.Mixte@Exemple.Invalid');
  -- Liste vide.
  v_np := (select count(*) from public.user_profiles);
  perform pg_temp.attendre('equipe', 'liste vide pour un compte absent : refus avec la phrase',
    pg_temp.regler(c_dir_n, null, c_absent, v_l1, 'array[]::integer[]'), 'ERREUR P0001 equipe: Choisis au moins une promo.');
  perform pg_temp.attendre('equipe', 'liste nulle pour un compte absent : refus avec la phrase',
    pg_temp.regler(c_dir_n, null, c_absent, v_l1, 'null'), 'ERREUR P0001 equipe: Choisis au moins une promo.');
  perform pg_temp.attendre('equipe', 'ce refus n''a créé aucun profil', (select count(*) from public.user_profiles)::text, v_np::text);
  perform pg_temp.regler(c_dir_n, null, c_form_m, v_l1, format('array[1,%s]', v_pn));
  v_r := pg_temp.reponse(pg_temp.regler(c_dir_n, null, c_form_m, v_l1, 'array[]::integer[]'));
  perform pg_temp.attendre('equipe', 'liste vide pour form_m : ses lignes du centre de dir_n partent (retirees [1, N2])',
    (v_r -> 'retirees')::text, format('[1, %s]', v_pn));
  perform pg_temp.attendre('equipe', 'liste vide pour form_m : la ligne de la promo 2 (autre centre) reste, et c''est la même ligne', pg_temp.formateur_de(c_form_m), '2');
  perform pg_temp.attendre('equipe', 'la ligne de form_m sur la promo 2 a gardé son identifiant (jamais supprimée puis recréée)',
    (select a.id::text from public.affectations a where a.email = c_form_m and a.role = 'formateur' and a.promo_id = 2), v_aff_id::text);
  -- Cumul : la direction se donne une promo.
  v_r := pg_temp.reponse(pg_temp.regler(c_dir_n, null, c_dir_n, v_l1, 'array[1]'));
  perform pg_temp.attendre('equipe', 'dir_n se donne à lui-même la promo 1 (cumul) : ajoutees [1], cree faux',
    concat_ws(' ; ', (v_r -> 'ajoutees')::text, v_r ->> 'cree'), '[1] ; false');
  perform pg_temp.attendre('equipe', 'dir_n garde sa ligne direction et gagne sa ligne formateur',
    (select string_agg(format('%s:%s', a.role, coalesce(a.promo_id, a.lieu_id)), ',' order by a.role) from public.affectations a where a.email = c_dir_n),
    format('direction:%s,formateur:1', v_l1));
  -- Aucune ligne direction ni siège touchée dans tout le bloc d'essais de la fonction.
  perform pg_temp.attendre('equipe', 'aucune ligne direction ou siège ajoutée ni retirée par tous ces appels', pg_temp.nb_direction_siege()::text, v_dsn::text);

  -- inviter_compte : même profil qu'au lot 4, champ par champ ; différences de texte limitées à la branche formateur.
  v_rep := pg_temp.appeler(c_dir_n, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, %s, null)::text', c_apres, v_fb));
  v_apres_rep := pg_temp.reponse(v_rep) - 'email';
  perform pg_temp.attendre('equipe', 'inviter_compte d''un nouveau formateur : même réponse qu''au lot 4 (role, cree, affecte)', v_apres_rep::text, v_avant_rep::text);
  perform pg_temp.attendre('equipe', 'inviter_compte d''un nouveau formateur : même profil et mêmes affectations qu''au lot 4, champ par champ', pg_temp.profil(c_apres)::text, v_avant_profil::text);
  perform pg_temp.attendre('equipe', 'inviter_compte : le profil porte bien la fiche formateur libre (fiche posée), rôle prof, is_admin vrai',
    (select concat_ws(' ; ', coalesce((u.prof_id = v_fb)::text, 'fiche absente'), u.role, u.is_admin::text, u.invited_by_email) from public.user_profiles u where u.email = c_apres),
    concat_ws(' ; ', 'true', 'prof', 'true', c_dir_n));
  perform pg_temp.attendre('equipe', 'inviter_compte du lot 4 conservé : un formateur d''un autre centre ne peut pas inviter (42501, même phrase)',
    pg_temp.appeler(c_dir_m, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', c_absent)),
    'ERREUR 42501 invitation: Réservé à la direction du centre.');
  perform pg_temp.attendre('equipe', 'inviter_compte du lot 4 conservé : un compte existant n''est pas modifié et ne reçoit que l''affectation (cree faux, affecte 1)',
    (select concat_ws(' ; ', r ->> 'cree', r ->> 'affecte') from (select pg_temp.reponse(pg_temp.appeler(c_dir_n, '1', null, format('select public.inviter_compte(%L, ''formateur'', null, null, null)::text', c_form_m))) as r) z),
    'false ; 1');
  select * into v_diff from pg_temp.diff_lignes(v_ic_def0, v_ic_def1);
  if v_en_ligne then
    perform pg_temp.informer('inviter_compte : différences de texte avec le lot 4', 'non jugeable en ligne (le texte d''avant la migration 2 n''est plus en base)');
  else
    perform pg_temp.verifier('equipe', 'inviter_compte : le texte ne diffère de celui du lot 4 que de 7 lignes retirées (création de profil) et 15 ajoutées (refus de stagiaire dans les trois branches, appel à _profil_formateur)',
      v_diff.nb_retirees = 7 and v_diff.nb_ajoutees = 15 and v_diff.retirees like '%insert into user_profiles (email, role, is_admin, prof_id, invited_by_email)%'
        and v_diff.ajoutees like '%_profil_formateur(v_email, p_prof_id, v_moi)%' and v_diff.ajoutees like '%Cette adresse est celle d''''un compte stagiaire%',
      format('retirées %s ; ajoutées %s', v_diff.nb_retirees, v_diff.nb_ajoutees));
  end if;
  perform pg_temp.attendre('equipe', 'inviter_compte garde ses droits d''exécution (authenticated oui ; anon, service_role non)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public.inviter_compte(text, text, integer, integer, integer)'', ''execute''), has_function_privilege(''anon'', ''public.inviter_compte(text, text, integer, integer, integer)'', ''execute''), has_function_privilege(''service_role'', ''public.inviter_compte(text, text, integer, integer, integer)'', ''execute''))'),
    't,f,f');

  -- 8 ter. Lot G : les invitations de direction et de siège refusent l'adresse d'un compte stagiaire (comme celle d'un
  --        formateur), avant toute écriture ; une adresse neuve reste acceptée. Le siège invite la direction, le fondateur
  --        (hors aperçu) invite le siège.
  insert into public.stagiaires (id, prenom, nom, ordre, actif, promo_id) values (990302, 'Preuve5 stagiaire mixte', 'PREUVE', 2, true, 1);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id) values ('Preuve5.StagMixte@Exemple.Invalid', 'stagiaire', false, 990302);
  v_snap := pg_temp.instantane();
  perform pg_temp.attendre('invitations', 'le siège qui invite comme direction l''adresse d''un compte stagiaire : refus avec la phrase',
    pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', c_stag_n, v_lieu2)),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('invitations', 'la même adresse en majuscules, avec espaces, est refusée de même (direction)',
    pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', '  ' || upper(c_stag_n) || ' ', v_lieu2)),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('invitations', 'le fondateur qui invite comme direction l''adresse d''un compte stagiaire : refus avec la phrase',
    pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', c_stag_n, v_lieu1)),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('invitations', 'le fondateur qui invite comme siège l''adresse d''un compte stagiaire : refus avec la phrase',
    pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', c_stag_n)),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('invitations', 'la même adresse en majuscules, avec espaces, est refusée de même (siège)',
    pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', '  ' || upper(c_stag_n) || ' ')),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  -- Un compte stagiaire dont l'adresse a été enregistrée avec des majuscules (comptes anciens) est reconnu de même.
  perform pg_temp.attendre('invitations', 'un compte stagiaire à adresse mixte est refusé en direction',
    pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', 'preuve5.stagmixte@exemple.invalid', v_lieu2)),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('invitations', 'un compte stagiaire à adresse mixte est refusé en siège',
    pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', 'preuve5.stagmixte@exemple.invalid')),
    'ERREUR P0001 invitation: Cette adresse est celle d''un compte stagiaire.');
  perform pg_temp.attendre('invitations', 'ces refus n''ont écrit aucune ligne : ni profil, ni affectation (instantané des affectations et nombre de profils)',
    pg_temp.instantane(), v_snap);
  perform pg_temp.attendre('invitations', 'le compte stagiaire n''a toujours aucune affectation',
    (select count(*)::text from public.affectations a where lower(a.email) = lower(c_stag_n)), '0');
  -- Les refus de droit passent avant : un formateur qui invite l'adresse d'un stagiaire ne l'apprend pas.
  perform pg_temp.attendre('invitations', 'un formateur qui invite en direction l''adresse d''un stagiaire reçoit le refus de droit (42501), pas celui du compte',
    pg_temp.appeler(c_form_n, '1', null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', c_stag_n, v_lieu1)),
    'ERREUR 42501 invitation: Réservé au siège.');
  perform pg_temp.attendre('invitations', 'la direction qui invite en siège l''adresse d''un stagiaire reçoit le refus de droit (42501), pas celui du compte',
    pg_temp.appeler(c_dir_n, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', c_stag_n)),
    'ERREUR 42501 invitation: Réservé au fondateur.');
  -- Une adresse neuve reste acceptée dans les deux branches.
  v_r := pg_temp.reponse(pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', c_inv_dir, v_lieu2)));
  perform pg_temp.attendre('invitations', 'le siège qui invite une adresse neuve comme direction : accepté (role direction, cree vrai, affecte 1)',
    concat_ws(' ; ', v_r ->> 'role', v_r ->> 'cree', v_r ->> 'affecte'), 'direction ; true ; 1');
  perform pg_temp.attendre('invitations', 'la direction invitée : profil rôle prof sans droit d''administration, affectation direction du centre donné',
    (select concat_ws(' ; ', u.role, u.is_admin::text, (select string_agg(format('%s:%s', a.role, a.lieu_id), ',') from public.affectations a where a.email = u.email))
       from public.user_profiles u where u.email = c_inv_dir),
    format('prof ; false ; direction:%s', v_lieu2));
  v_r := pg_temp.reponse(pg_temp.appeler(v_fond, '1', null, format('select public.inviter_compte(%L, ''siege'', null, null, null)::text', c_inv_siege)));
  perform pg_temp.attendre('invitations', 'le fondateur qui invite une adresse neuve comme siège : accepté (role siege, cree vrai, affecte 1)',
    concat_ws(' ; ', v_r ->> 'role', v_r ->> 'cree', v_r ->> 'affecte'), 'siege ; true ; 1');
  perform pg_temp.attendre('invitations', 'le compte siège invité : profil rôle prof sans droit d''administration, affectation siège',
    (select concat_ws(' ; ', u.role, u.is_admin::text, (select string_agg(a.role, ',') from public.affectations a where a.email = u.email))
       from public.user_profiles u where u.email = c_inv_siege),
    'prof ; false ; siege');
  perform pg_temp.attendre('invitations', 'un compte déjà direction (sans fiche de stagiaire) réinvité comme direction reste accepté (cree faux, affecte 0)',
    (select concat_ws(' ; ', r ->> 'cree', r ->> 'affecte') from (select pg_temp.reponse(pg_temp.appeler(c_siege, null, null, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', c_inv_dir, v_lieu2))) as r) z),
    'false ; 0');

  -- 8 quater. Lot G : roles_du_personnel(), le vrai rôle (direction ou siège) des comptes du personnel, pour l'équipe de la promo
  --           affichée, le siège et le fondateur ; rien pour les autres.
  perform pg_temp.verifier('personnel', 'la fonction roles_du_personnel existe et ne rend que (email text, role text)',
    to_regprocedure('public.roles_du_personnel()') is not null
    and coalesce(pg_get_function_result(to_regprocedure('public.roles_du_personnel()')), '') = 'TABLE(email text, role text)', '');
  perform pg_temp.attendre('personnel', 'droit d''exécution de roles_du_personnel : authenticated oui ; anon et service_role non (catalogue)',
    pg_temp.calcul('select concat_ws('','', has_function_privilege(''authenticated'', ''public.roles_du_personnel()'', ''execute''), has_function_privilege(''anon'', ''public.roles_du_personnel()'', ''execute''), has_function_privilege(''service_role'', ''public.roles_du_personnel()'', ''execute''))'),
    't,f,f');
  -- Deux cas de forme : une direction de deux centres (une seule ligne rendue) et une adresse à majuscules (rendue en minuscules).
  insert into public.affectations (email, role, lieu_id) values (c_dir_n, 'direction', v_lieu2), ('Preuve5.Mixte@Exemple.Invalid', 'direction', v_lieu1);
  v_hs := 'preuve5.dir.m@exemple.invalid:direction,preuve5.dir.n@exemple.invalid:direction,preuve5.invite.direction@exemple.invalid:direction,preuve5.invite.siege@exemple.invalid:siege,preuve5.mixte@exemple.invalid:direction,preuve5.siege@exemple.invalid:siege';
  perform pg_temp.attendre('personnel', 'un formateur de la promo affichée lit les rôles direction et siège des comptes du personnel (et eux seuls)',
    pg_temp.appeler(c_form_n, '1', null, c_roles), 'OK ' || v_hs);
  perform pg_temp.attendre('personnel', 'la direction du centre de la promo affichée les lit aussi',
    pg_temp.appeler(c_dir_n, '1', null, c_roles), 'OK ' || v_hs);
  perform pg_temp.attendre('personnel', 'le siège les lit',
    pg_temp.appeler(c_siege, null, null, c_roles), 'OK ' || v_hs);
  perform pg_temp.attendre('personnel', 'le fondateur les lit',
    pg_temp.appeler(v_fond, '1', null, c_roles), 'OK ' || v_hs);
  perform pg_temp.attendre('personnel', 'le fondateur en aperçu formateur les lit (il a les droits du rôle simulé)',
    pg_temp.appeler(v_fond, '1', 'formateur', c_roles), 'OK ' || v_hs);
  perform pg_temp.attendre('personnel', 'aucun rôle formateur n''est rendu : un compte à la fois direction et formateur n''apparaît que comme direction',
    pg_temp.appeler(c_form_n, '1', null, 'select count(*) filter (where r.role not in (''direction'', ''siege''))::text || '' '' || count(*) filter (where r.email = ''preuve5.dir.n@exemple.invalid'' and r.role = ''direction'') from public.roles_du_personnel() r'),
    'OK 0 1');
  perform pg_temp.attendre('personnel', 'une direction d''un autre centre en lit autant : elle est l''équipe de la promo 2',
    pg_temp.appeler(c_dir_m, '2', null, c_roles), 'OK ' || v_hs);
  perform pg_temp.attendre('personnel', 'une direction d''un autre centre qui affiche la promo 1 (qu''elle ne dirige pas) ne lit rien',
    pg_temp.appeler(c_dir_m, '1', null, 'select count(*)::text from public.roles_du_personnel()'), 'OK 0');
  perform pg_temp.attendre('personnel', 'un stagiaire ne lit rien (aucune ligne, pas d''erreur)',
    pg_temp.appeler(c_stag_n, '1', null, 'select count(*)::text from public.roles_du_personnel()'), 'OK 0');
  perform pg_temp.attendre('personnel', 'un compte sans rôle ne lit rien',
    pg_temp.appeler(c_sans_role, null, null, 'select count(*)::text from public.roles_du_personnel()'), 'OK 0');
  perform pg_temp.attendre('personnel', 'le fondateur en aperçu stagiaire ne lit rien',
    pg_temp.appeler(v_fond, '1', 'stagiaire', 'select count(*)::text from public.roles_du_personnel()'), 'OK 0');
  perform pg_temp.attendre('personnel', 'anon est refusé (42501)',
    left(pg_temp.appeler(null, null, null, 'select count(*)::text from public.roles_du_personnel()'), 12), 'ERREUR 42501');
  perform pg_temp.attendre('personnel', 'seules deux colonnes sortent, sans centre ni promo (forme de la ligne)',
    pg_temp.appeler(c_form_n, '1', null, 'select string_agg(distinct k, '','') from public.roles_du_personnel() r, jsonb_object_keys(to_jsonb(r)) k'), 'OK email,role');

  -- 9 ter. Le retour 3 (avant le retour 2) : colonnes, fonctions, ligne globale et contrainte d'origine.
  v_retour3 := pg_temp.jouer('retour 3',
-- @@INJECTER supabase/migrations/20261108_espaces_3_habillage_retour.sql@@
  );
  if v_retour3 = 'neutralisée' then
    perform pg_temp.informer('retour 3', 'non injecté (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'retour 3 joué sans erreur', v_retour3 = 'jouée', v_retour3);
  end if;
  if not v_en_ligne and v_etat3 <> 'neutralisée' then
    perform pg_temp.attendre('retour', 'après le retour 3 : plus de colonne habillage ni habillage_libre, plus de fonction d''habillage',
      (select format('%s %s',
         (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'lieux' and column_name in ('habillage', 'habillage_libre')),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
            and proname in ('habillage_par_defaut', 'regler_habillage_centre', 'regler_habillage_reseau')))), '0 0');
    perform pg_temp.attendre('retour', 'après le retour 3 : plus de ligne globale habillage_reseau, la contrainte de réglages d''origine est revenue',
      (select format('%s %s',
         (select count(*) from public.settings where key = 'habillage_reseau'),
         (select (pg_get_constraintdef(c.oid) like '%habillage_reseau%')::text from pg_constraint c
           where c.conrelid = 'public.settings'::regclass and c.conname = 'settings_globaux_prevus'))), '0 false');
    perform pg_temp.attendre('retour', 'après le retour 3 : la clé habillage_reseau est de nouveau refusée sans promo (23514)',
      pg_temp.valeur_proprio(null, null, null, 'insert into public.settings (key, value, promo_id) values (''habillage_reseau'', ''ecf'', null) returning 1'), 'ERREUR 23514');
  end if;

  -- 9 bis. Le retour 2 (avant le retour 1) : le texte d'inviter_compte d'origine, jugé par son md5.
  v_retour2 := pg_temp.jouer('retour 2',
-- @@INJECTER supabase/migrations/20261108_espaces_2_equipe_retour.sql@@
  );
  if v_retour2 = 'neutralisée' then
    perform pg_temp.informer('retour 2', 'non injecté (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'retour 2 joué sans erreur', v_retour2 = 'jouée', v_retour2);
  end if;
  if not v_en_ligne and v_etat2 <> 'neutralisée' then
    perform pg_temp.attendre('retour', 'après le retour 2 : inviter_compte a le texte exact d''avant la migration 2 (md5 de pg_get_functiondef)',
      md5(pg_get_functiondef('public.inviter_compte(text, text, integer, integer, integer)'::regprocedure)), v_ic_md5);
    perform pg_temp.attendre('retour', 'après le retour 2 : plus de fonction regler_affectations_formateur, _profil_formateur ni roles_du_personnel',
      (select format('%s %s %s', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'regler_affectations_formateur'),
                             (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = '_profil_formateur'),
                             (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'roles_du_personnel'))), '0 0 0');
  end if;

  -- 9. Le retour, puis l'empreinte : elle doit égaler celle d'avant. La séquence est remise comme trouvée.
  v_retour := pg_temp.jouer('retour',
-- @@INJECTER supabase/migrations/20261108_espaces_1_siege_retour.sql@@
  );
  if v_retour = 'neutralisée' then
    perform pg_temp.informer('retour', 'non injecté (' || v_mode || ')');
  else
    perform pg_temp.verifier('structure', 'retour joué sans erreur', v_retour = 'jouée', v_retour);
  end if;
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  if v_en_ligne or v_etat = 'neutralisée' then
    perform pg_temp.informer('retour', format('non jugeable (migration non injectée) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après le retour : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après le retour : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après le retour : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
    perform pg_temp.attendre('retour', 'après le retour : plus de colonne lieux.demonstration ni de fonction comptes_reseau ou creer_centre',
      (select format('%s %s %s',
         (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'lieux' and column_name = 'demonstration'),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'comptes_reseau'),
         (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'creer_centre'))),
      '0 0 0');
  end if;
  perform setval('public.lieux_id_seq', v_seq_last, v_seq_called);
  perform pg_temp.attendre('structure', 'séquence de lieux.id remise comme trouvée (une séquence n''est pas annulée par la levée)',
    (select format('lieux_id_seq %s/%s', s.last_value, s.is_called) from public.lieux_id_seq s), v_seq);
  perform pg_temp.informer('durée du bloc (verrous de la migration tenus jusqu''à la levée)',
    to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_espaces(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $preuve$;
