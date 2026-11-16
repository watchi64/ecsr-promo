-- Preuve de la partie 2 du chantier « espace contact » : les demandes, leurs réponses et les envois d'e-mail. Écrite avec les migrations
-- 20261115_contact_1_annuaire, 20261115_contact_2_demandes, jouée sur une base où l'état de la production est rejoué
-- (outils/base_locale : reconstruire.sh, puis rejouer_suite.sh --production).
--   structure    prérequis de l'état de départ présents (geste_promo, retirer_titre, donner_titre, contacts.lieu_id), personnages posés
--                (pg_temp.poser_contact), chaque migration et chaque retour injectés se jouent sans erreur.
--   parite       (partie A) la table de cas tests/fixtures/contact-routage.json, commune au test node de js/contact-rules.js : chaque cas
--                posé en propriétaire dans une sous-transaction annulée (règles, congés, relais, départ, planning, jour de création par
--                preuve.maintenant), puis _contact_destinataires et _contact_possibles comparés à l'attendu du cas.
--   creer        (partie A) sans règle, le stagiaire choisit parmi l'équipe de sa promo (formateurs à titre fixe, direction réelle),
--                formateurs du jour pré-cochés ; une règle : la demande part à qui elle désigne, aucun choix ; écrire à une fiche, à
--                un stagiaire ; destinataires, lignes d'envoi « nouvelle », horloge de la preuve, réponses toutes faites, purge (C-17).
--   garde_fous   (partie A) réservé aux stagiaires (aperçu, fondateur, équipe, siège refusés), dix demandes par jour, liste vide (rien
--                n'est écrit), délégué et stagiaires jamais destinataires principaux, aucun droit direct sur les tables, aides internes
--                fermées, entrées illisibles refusées.
--   retour       les retours défont tout, dans l'ordre inverse (2, 1b, 1) : l'empreinte (règles, fonctions, droits) égale celle d'avant.
--   lire         (partie B) liste_demandes et demande_detail selon le rôle : auteur, destinataire, délégué (colonnes réduites), direction
--                réelle du centre (toutes celles du centre) ; fondateur, aperçu, titre non fixe, siège, autre centre : rien de plus.
--   etats        (partie B) marquer_lue, réponses libres et toutes faites (prise, lue remise à nul, envois aux autres participants),
--                prendre_en_compte, annuler_demande, relancer_envoi, e-mail affichable d'une fiche vérifiée.
--   reglages     (partie B) qui reçoit quoi (une fiche du centre seulement), réponses toutes faites, lecture des réglages, alertes coupées.
--   conservation (partie B) purge à l'écriture, changement de promo, départ d'un auteur de l'équipe, effacement sur demande.
--   envois      (partie C) la file de la fonction serveur, en service_role : prendre (en cours, sans sujet ni texte), échec puis à
--                retenter puis échec, vu par l'équipe, relance, reprise d'un envoi en cours depuis plus de 10 minutes, envoyé, ignoré
--                (raison tronquée, sans adresse) ; aucune fonction _contact_srv_* pour l'API, aucune aide pour service_role.
--   jetons      (partie C) jetons hachés d'un envoi, lien en lecture seule, prise et réponse toute faite par lien une seule fois (message
--                par_lien, « non lue » remise, envois), voir, justificatif, jeton expiré, jeton d'une autre demande, stagiaire sans jeton.
-- L'horloge : après la migration 2, la preuve remplace _contact_maintenant() par une version qui lit le réglage preuve.maintenant (C-21) ;
-- tout est annulé à la fin. Les jours d'essai sont en 2031 : aucun planning réel n'y figure.
-- Modes : dans la contre-épreuve, chaque groupe se joue et doit être ROUGE ; en ligne, un groupe dont la migration n'est pas appliquée
-- est sauté (ligne d'information).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (roles-aides.sql, titres-aides.sql,
-- contact-aides.sql), le libellé du mode, la requête d'empreinte, la table de cas du routage, puis les migrations 1 à 2 et leurs retours :
--   node outils/assembler_repetition_roles.mjs contact-2 <sortie.sql>                 migrations injectées : VERT attendu
--   node outils/assembler_repetition_roles.mjs contact-2-contre-epreuve <sortie.sql>  la 2 et son retour neutralisés : ROUGE attendu
--                                                                                      sur les seuls contrôles de la partie 2
--   node outils/assembler_repetition_roles.mjs contact-2-en-ligne <sortie.sql>        rien d'injecté, après application réelle
-- À jouer sur la base locale : PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p <port> -U postgres -d postgres -X -q -f <sortie.sql>
-- Le bloc do finit TOUJOURS par une levée (verdict) : migrations, personnages et lignes d'essai sont annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@
-- @@INCLURE tests/sql/titres-aides.sql@@
-- @@INCLURE tests/sql/contact-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $temp$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $temp$;

-- L'adresse d'un personnage.
create or replace function pg_temp.email_de(p_qui text)
returns text language plpgsql as $cd_em$
begin
  return (select email from pg_temp.perso where nom = p_qui);
end $cd_em$;

-- Les fiches des personnages, par nom (pg_temp.cles) : fiche avec compte (compte_email), ou la fiche sans compte sec_n. Posée après la
-- migration 1 ; un personnage sans fiche n'y figure pas.
create or replace function pg_temp.poser_cles()
returns void language plpgsql as $cd_pc$
begin
  drop table if exists pg_temp.cles;
  create temp table cles (cle text primary key, fiche_id bigint not null);
  begin
    execute $cd_q$insert into pg_temp.cles (cle, fiche_id)
      select p.nom, c.id from pg_temp.perso p join public.contacts c on c.compte_email = lower(p.email)
      union all
      select p.nom, p.info::bigint from pg_temp.perso p where p.nom = 'sec_n'$cd_q$;
  exception when others then
    null; -- migration 1 absente : la table reste vide, les contrôles qui s'en servent sont rouges
  end;
end $cd_pc$;

-- La fiche d'un personnage (texte), ou « null ».
create or replace function pg_temp.fiche(p_cle text)
returns text language plpgsql as $cd_fi$
begin
  return coalesce((select fiche_id::text from pg_temp.cles where cle = p_cle), 'null');
end $cd_fi$;

-- La fiche stagiaire d'un personnage (texte), ou « null ».
create or replace function pg_temp.stag(p_qui text)
returns text language plpgsql as $cd_st$
begin
  return coalesce((select up.stagiaire_id::text from public.user_profiles up where up.email = pg_temp.email_de(p_qui)), 'null');
end $cd_st$;

-- Les personnages derrière une liste d'identifiants de fiches (« 1,2,3 »), triés : les fiches qui ne sont pas des personnages sont
-- comptées à part (« + n autres »). Une valeur illisible est rendue telle quelle.
create or replace function pg_temp.noms_de(p_ids text)
returns text language plpgsql as $cd_nd$
declare v text; n integer;
begin
  select string_agg(k.cle, ',' order by k.cle collate "C"), count(*) filter (where k.cle is null)
    into v, n
    from unnest(string_to_array(nullif(p_ids, ''), ',')::bigint[]) x(id) left join pg_temp.cles k on k.fiche_id = x.id;
  return coalesce(v, '') || case when n > 0 then format(' + %s autres', n) else '' end;
exception when others then
  return 'illisible : ' || coalesce(p_ids, 'nul');
end $cd_nd$;

-- Un appel de fonction par un personnage, en aperçu (x-apercu-role) : comme pg_temp.appeler.
create or replace function pg_temp.appeler_apercu(p_qui text, p_entete text, p_apercu text, p_sql text)
returns text language plpgsql as $cd_aa$
declare v text; r text;
begin
  perform pg_temp.incarner(pg_temp.email_de(p_qui), p_entete, p_apercu);
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $cd_aa$;

-- L'identifiant rendu par un appel réussi (« OK 12 » : 12), sinon « null » (le constat qui s'en sert est alors rouge).
create or replace function pg_temp.id_rendu(p_appel text)
returns text language sql as $cd_ir$
  select case when p_appel ~ '^OK [0-9]+$' then substr(p_appel, 4) else 'null' end;
$cd_ir$;

-- Les lignes des quatre tables écrites par une création (demandes, destinataires, messages, envois) : « d/x/m/e ».
create or replace function pg_temp.lignes_demandes()
returns text language sql as $cd_ld$
  select pg_temp.calcul($cd_q$select concat_ws('/', (select count(*) from public.demandes), (select count(*) from public.demande_destinataires),
    (select count(*) from public.demande_messages), (select count(*) from public.contact_envois))$cd_q$);
$cd_ld$;

-- Un cas de la table de parité, posé en propriétaire dans une sous-transaction TOUJOURS annulée. Rend ce qu'obtient la base, sous la
-- forme de l'attendu ({mode, principaux, source, possibles}, fiches nommées par leur personnage ; possibles restreints aux personnages),
-- ou {erreur} si la pose ou le calcul a échoué. Chaque fiche citée par la table porte une ligne profs à son nom (le nom affiché est alors
-- celui du personnage, ce que relais_de doit rendre) ; la colonne du_centre de la table est vérifiée, pas posée.
create or replace function pg_temp.jouer_cas(p_cas jsonb)
returns jsonb language plpgsql as $cd_jc$
declare
  e jsonb := p_cas -> 'entree';
  v_l integer := (select lieu_id from public.promos where id = 1);
  v_p integer := 1;
  v_j jsonb := coalesce(p_cas -> 'entree' -> 'jours', '[]'::jsonb);
  v_fin bigint;
  k record;
  f jsonb;
  r jsonb;
  x jsonb;
  v_n integer := 0;
  v_prof integer;
  v_obt jsonb;
  v_dest jsonb;
begin
  begin
    perform pg_temp.proprio();
    perform set_config('preuve.maintenant', (e ->> 'aujourdhui') || ' 10:00:00 Europe/Paris', true);
    if p_cas ->> 'centre' = 'vide' then
      insert into public.lieux (nom) values ('Preuve8 centre vide') returning id into v_l;
      insert into public.promos (nom, lieu_id, date_debut) values ('Preuve8 promo vide', v_l, date '2031-01-06') returning id into v_p;
    end if;
    -- Une ligne profs au nom de chaque personnage cité, rattachée à sa fiche.
    for k in select c.cle, c.fiche_id from pg_temp.cles c
              where c.cle in (select f2 ->> 'fiche_id' from jsonb_array_elements(e -> 'fiches') f2
                              union select jsonb_array_elements_text(e -> 'possibles')
                              union select jsonb_array_elements_text(e -> 'formateurs_du_jour')
                              union select r2 ->> 'fiche_id' from jsonb_array_elements(e -> 'regles') r2) loop
      insert into public.profs (nom, ordre) values (k.cle, 995) returning id into v_prof;
      update public.contacts set prof_id = v_prof where id = k.fiche_id;
    end loop;
    -- Les fiches : congé, départ, joignable (e-mail retiré à une fiche sans compte), relais ; du_centre vérifié.
    for f in select y from jsonb_array_elements(e -> 'fiches') y loop
      if not exists (select 1 from pg_temp.cles where cle = f ->> 'fiche_id') then
        raise exception 'cas mal posé : fiche % inconnue', f ->> 'fiche_id';
      end if;
      update public.contacts c
         set conge_du = (f ->> 'conge_du')::date, conge_au = (f ->> 'conge_au')::date, depart_le = (f ->> 'depart_le')::date,
             email = case when f ->> 'joignable' = 'false' then null else c.email end,
             relais_id = (select fiche_id from pg_temp.cles where cle = f ->> 'relais_id')
       where c.id = (select fiche_id from pg_temp.cles where cle = f ->> 'fiche_id');
      if (select public._contact_fiche_dans(c, v_l) from public.contacts c where c.id = (select fiche_id from pg_temp.cles where cle = f ->> 'fiche_id'))
         is distinct from coalesce((f ->> 'du_centre')::boolean, true) then
        raise exception 'cas mal posé : du_centre de % ne dit pas la base', f ->> 'fiche_id';
      end if;
    end loop;
    -- Les règles du centre : celles du cas, seules.
    delete from public.contact_regles where lieu_id = v_l;
    for r in select y from jsonb_array_elements(e -> 'regles') y loop
      insert into public.contact_regles (lieu_id, type, financement_id, cible, fiche_id)
        values (v_l, r ->> 'type',
                (select cf.id from public.contact_financements cf where cf.lieu_id = v_l and cf.libelle = r ->> 'financement_id'),
                r ->> 'cible', (select fiche_id from pg_temp.cles where cle = r ->> 'fiche_id'));
      if r ->> 'financement_id' is not null
         and not exists (select 1 from public.contact_financements cf where cf.lieu_id = v_l and cf.libelle = r ->> 'financement_id') then
        raise exception 'cas mal posé : financement % inconnu', r ->> 'financement_id';
      end if;
    end loop;
    if e ->> 'financement_id' is not null then
      select cf.id into v_fin from public.contact_financements cf where cf.lieu_id = v_l and cf.libelle = e ->> 'financement_id';
      if v_fin is null then raise exception 'cas mal posé : financement % inconnu', e ->> 'financement_id'; end if;
    end if;
    -- Le planning : chaque formateur du jour, à chaque demi-journée du cas.
    for x in select y from jsonb_array_elements(v_j) y loop
      for k in select c.cle, c.fiche_id from pg_temp.cles c where c.cle in (select jsonb_array_elements_text(e -> 'formateurs_du_jour')) loop
        v_n := v_n + 1;
        insert into public.planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, prof_id)
          select v_p, d.lundi, d.day_index, x ->> 'demi', 900 + v_n, (select prof_id from public.contacts where id = k.fiche_id)
            from pg_temp.demi((x ->> 'jour')::date, x ->> 'demi') d;
      end loop;
    end loop;
    -- Ce que rend la base.
    select coalesce(jsonb_agg(jsonb_build_object('fiche_id', c.cle, 'relais_de', d.relais_de) order by c.cle collate "C"), '[]'::jsonb),
           jsonb_build_object('n', count(*), 'sources', coalesce(jsonb_agg(distinct d.source), '[]'::jsonb),
                              'noms', bool_and(d.nom is not distinct from c.cle))
      into v_obt, v_dest
      from public._contact_destinataires(v_l, v_p, e ->> 'type', v_fin, v_j) d
      left join pg_temp.cles c on c.fiche_id = d.fiche_id;
    if (v_dest ->> 'n')::integer > 0 then
      v_obt := jsonb_build_object('mode', 'regle', 'principaux', v_obt,
                                  'source', case when jsonb_array_length(v_dest -> 'sources') = 1 then v_dest -> 'sources' -> 0 else v_dest -> 'sources' end,
                                  'possibles', '[]'::jsonb);
      if not (v_dest ->> 'noms')::boolean then
        v_obt := v_obt || jsonb_build_object('noms', 'un destinataire ne porte pas le nom de son personnage');
      end if;
    else
      v_obt := jsonb_build_object('mode', 'choix', 'principaux', '[]'::jsonb, 'source', null, 'possibles', coalesce((
        select jsonb_agg(jsonb_build_object('fiche_id', c.cle, 'pre_coche', p.pre_coche) order by c.cle collate "C")
          from public._contact_possibles(v_l, v_p, v_j) p join pg_temp.cles c on c.fiche_id = p.fiche_id), '[]'::jsonb));
    end if;
    raise exception using errcode = 'P0001', message = 'CAS ' || v_obt::text;
  exception when others then
    perform pg_temp.proprio();
    if sqlstate = 'P0001' and sqlerrm like 'CAS %' then
      return substr(sqlerrm, 5)::jsonb;
    end if;
    return jsonb_build_object('erreur', sqlstate || ' ' || left(sqlerrm, 200));
  end;
end $cd_jc$;

-- Groupe parite : chaque cas de la table, joué par la base.
create or replace function pg_temp.groupe_parite(p_cas jsonb)
returns void language plpgsql as $cd_gp$
declare c jsonb;
begin
  perform pg_temp.attendre('parite', 'la table de cas porte les treize cas demandés par le plan',
    (select count(*)::text from jsonb_array_elements(p_cas -> 'cas') x
      where x ->> 'nom' in ('mode_choix', 'absence_cpf', 'absence_sans_financement_defaut', 'absence_choix_precoche',
                            'retard_regle_formateurs_du_jour', 'retard_sans_regle_choix', 'retard_regle_planning_vide_defaut',
                            'type_sans_regle_defaut', 'titulaire_en_conge_relais', 'relais_en_conge_defaut',
                            'relais_et_defaut_en_conge_choix', 'relais_autre_centre', 'liste_vide')), '13');
  for c in select x from jsonb_array_elements(p_cas -> 'cas') x loop
    -- Un cas que la migration 4 change (fiche partie ou en congé écartée des possibles) porte aussi ce que rend la base sans elle.
    perform pg_temp.attendre('parite', 'cas ' || (c ->> 'nom'), pg_temp.jouer_cas(c)::text,
      coalesce(case when not pg_temp.migration_4() then c -> 'attendu_sans_migration_4' end, c -> 'attendu')::text);
  end loop;
end $cd_gp$;

-- Groupe creer : écrire au centre (choix, règle), à une fiche, à un stagiaire. Le jour : mardi 4 mars 2031, 10 h à Paris ; form_n est au
-- planning de la promo 1 ce matin-là.
create or replace function pg_temp.groupe_creer()
returns void language plpgsql as $cd_gc$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  f_form_n text := pg_temp.fiche('form_n');
  f_dir_n text := pg_temp.fiche('dir_n');
  f_sec_n text := pg_temp.fiche('sec_n');
  s_n text := pg_temp.stag('stag_n');
  s_m text := pg_temp.stag('stag_m');
  v_prof text;
  v text;
  v_id text;
  v_attendu text;
  c_ecrire constant text := 'select public.ecrire_au_centre(%L, %L, %L, %s)::text';
  c_dest constant text := $cd_q$select concat_ws(' ', (select count(*) from public.demande_destinataires x where x.demande_id = %1$s and x.principal),
      (select string_agg(coalesce(x.fiche_id::text, 's' || x.stagiaire_id), ',' order by x.id) from public.demande_destinataires x where x.demande_id = %1$s),
      (select string_agg(coalesce(e.vers_fiche_id::text, 's' || e.vers_stagiaire_id) || ':' || e.evenement || ':' || e.etat, ',' order by e.id)
         from public.contact_envois e where e.demande_id = %1$s))$cd_q$;
begin
  -- Le jour, et form_n au planning : une ligne profs rattachée à sa fiche.
  perform set_config('preuve.maintenant', '2031-03-04 10:00:00 Europe/Paris', true);
  perform pg_temp.essai(format('delete from public.contact_regles where lieu_id = %s', v_l1));
  v_prof := pg_temp.calcul($cd_q$insert into public.profs (nom, ordre) values ('Preuve8 form_n', 995) returning id::text$cd_q$);
  perform pg_temp.essai(format('update public.contacts set prof_id = %s where id = %s', v_prof, f_form_n));
  perform pg_temp.essai(format($cd_q$insert into public.planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, prof_id)
    values (1, date '2031-03-03', 1, 'matin', 950, %s)$cd_q$, v_prof));

  perform pg_temp.attendre('creer', 'horloge : _contact_jour() lit preuve.maintenant (jour de Paris)',
    pg_temp.calcul('select public._contact_jour()::text'), '2031-03-04');
  perform pg_temp.attendre('creer', 'réponses toutes faites : quatre par centre existant, dans l''ordre, la troisième demande le justificatif',
    pg_temp.calcul($cd_q$select (select count(*) from public.lieux l where (select count(*) from public.contact_reponses r where r.lieu_id = l.id) <> 4)::text
      || ' | ' || (select string_agg(libelle || ' ' || vaut_prise || ' ' || demande_justificatif, ', ' order by ordre) from public.contact_reponses
                    where lieu_id = (select lieu_id from public.promos where id = 1))$cd_q$),
    '0 | Bien reçu true false, Absence enregistrée true false, Absence enregistrée, pense à remettre ton justificatif true true, Merci de passer au secrétariat true false');
  perform pg_temp.essai($cd_q$insert into public.lieux (nom) values ('Preuve8 centre neuf')$cd_q$);
  perform pg_temp.attendre('creer', 'réponses toutes faites : un centre créé reçoit les siennes',
    pg_temp.calcul($cd_q$select count(*)::text from public.contact_reponses r join public.lieux l on l.id = r.lieu_id where l.nom = 'Preuve8 centre neuf'$cd_q$), '4');

  -- Sans règle : mode choix, l'équipe de la promo.
  v_attendu := pg_temp.calcul(format($cd_q$select string_agg(c.id::text, ',' order by c.id) from public.contacts c
      where c.compte_email in (select lower(a.email) from public.affectations a join public.titres t on t.id = a.titre_id
                                where t.fixe and ((a.role = 'formateur' and a.promo_id = 1) or (a.role = 'direction' and a.lieu_id = %s)))$cd_q$, v_l1));
  v := pg_temp.appeler('stag_n', '1', $cd_q$select (a ->> 'mode') || ' ' || jsonb_array_length(a -> 'principaux') || ' '
      || coalesce((select string_agg(x ->> 'fiche_id', ',' order by (x ->> 'fiche_id')::bigint) from jsonb_array_elements(a -> 'possibles') x), '')
      from (select public.apercu_envoi('administratif') a) s$cd_q$);
  perform pg_temp.attendre('creer', 'apercu_envoi(administratif) sans règle, par stag_n : mode choix, aucun principal, les fiches des formateurs à titre fixe de la promo 1 et de la direction réelle de Nîmes',
    v, 'OK choix 0 ' || coalesce(v_attendu, ''));
  perform pg_temp.attendre('creer', 'parmi les personnages : form_n, siege_form, dir_n, dir_form, dir_deux ; ni t_interv, ni t_secr, ni t_rh, ni cumul, ni l''autre centre',
    pg_temp.noms_de(split_part(v, ' ', 4)),
    pg_temp.noms_de(v_attendu) );
  perform pg_temp.attendre('creer', 'les personnages attendus sont exactement ceux-là',
    regexp_replace(pg_temp.noms_de(split_part(v, ' ', 4)), ' \+ [0-9]+ autres$', ''), 'dir_deux,dir_form,dir_n,form_n,siege_form');
  perform pg_temp.attendre('creer', 'destinataires_possibles(retard) par stag_n : la même liste, form_n (au planning ce matin) seul pré-coché',
    pg_temp.appeler('stag_n', '1', $cd_q$select count(*) || ' ' || coalesce(string_agg(fiche_id::text, ',') filter (where pre_coche), '') from public.destinataires_possibles('retard')$cd_q$),
    format('OK %s %s', coalesce(array_length(string_to_array(v_attendu, ','), 1), 0), f_form_n));
  perform pg_temp.attendre('creer', 'ecrire_au_centre sans choix : refusé',
    pg_temp.appeler('stag_n', '1', format(c_ecrire, 'administratif', 'Preuve sujet', 'Preuve texte', 'null')),
    'ERREUR P0001 contact: Choisis au moins une personne à prévenir.');
  v := pg_temp.appeler('stag_n', '1', format(c_ecrire, 'administratif', '  Preuve sujet  ', 'Preuve texte', format('array[%s]::bigint[]', f_form_n)));
  perform pg_temp.verifier('creer', 'ecrire_au_centre avec la fiche de form_n : OK', v ~ '^OK [0-9]+$', v);
  v_id := pg_temp.id_rendu(v);
  perform pg_temp.attendre('creer', 'la demande : un destinataire principal (form_n), une ligne d''envoi « nouvelle » à envoyer',
    pg_temp.calcul(format(c_dest, v_id)), format('1 %1$s %1$s:nouvelle:a_envoyer', f_form_n));
  perform pg_temp.attendre('creer', 'la demande : auteur stag_n (fiche et nom), centre et promo, type, sujet rogné, texte, envoyée, créée à l''heure de la preuve',
    pg_temp.calcul(format($cd_q$select concat_ws('|', auteur_stagiaire_id, (auteur_fiche_id is null)::text, auteur_nom, lieu_id, promo_id, type, sujet, texte, etat,
      (cree_le = timestamptz '2031-03-04 10:00:00 Europe/Paris')::text, (dernier_echange_le = cree_le)::text) from public.demandes where id = %s$cd_q$, v_id)),
    format('%s|true|Preuve7 stag_n PREUVE|%s|1|administratif|Preuve sujet|Preuve texte|envoyee|true|true', s_n, v_l1));
  perform pg_temp.attendre('creer', 'ecrire_au_centre avec la fiche de form_s (autre centre) : refusé',
    pg_temp.appeler('stag_n', '1', format(c_ecrire, 'administratif', 'Preuve', null, format('array[%s]::bigint[]', pg_temp.fiche('form_s')))),
    'ERREUR 42501 contact: Cette personne ne peut pas recevoir ta demande.');
  perform pg_temp.attendre('creer', 'ecrire_au_centre avec la fiche de form_n et une autre hors liste (t_interv) : refusé',
    pg_temp.appeler('stag_n', '1', format(c_ecrire, 'administratif', 'Preuve', null, format('array[%s, %s]::bigint[]', f_form_n, pg_temp.fiche('t_interv')))),
    'ERREUR 42501 contact: Cette personne ne peut pas recevoir ta demande.');

  -- Une règle « administratif : sec_n » (posée en propriétaire : l'écran des règles est une tâche à venir).
  perform pg_temp.essai(format($cd_q$insert into public.contact_regles (lieu_id, type, cible, fiche_id) values (%s, 'administratif', 'fiche', %s)$cd_q$, v_l1, f_sec_n));
  perform pg_temp.attendre('creer', 'règle administratif : sec_n : apercu_envoi en mode règle, sec_n seul, aucun possible ; destinataires_possibles vide',
    pg_temp.appeler('stag_n', '1', $cd_q$select (a ->> 'mode') || ' ' || (a -> 'principaux' -> 0 ->> 'fiche_id') || ' ' || jsonb_array_length(a -> 'principaux')
      || ' ' || jsonb_array_length(a -> 'possibles') || ' ' || (select count(*) from public.destinataires_possibles('administratif'))
      from (select public.apercu_envoi('administratif') a) s$cd_q$),
    format('OK regle %s 1 0 0', f_sec_n));
  perform pg_temp.attendre('creer', 'règle : un choix envoyé est refusé',
    pg_temp.appeler('stag_n', '1', format(c_ecrire, 'administratif', 'Preuve', null, format('array[%s]::bigint[]', f_form_n))),
    'ERREUR P0001 contact: Ta demande part à la personne prévue par ton centre : aucun choix n''est possible.');
  v := pg_temp.appeler('stag_n', '1', format(c_ecrire, 'administratif', 'Preuve règle', null, 'null'));
  perform pg_temp.attendre('creer', 'règle : sans choix, la demande part à sec_n (un principal, un envoi)',
    pg_temp.calcul(format(c_dest, pg_temp.id_rendu(v))), format('1 %1$s %1$s:nouvelle:a_envoyer', f_sec_n));
  perform pg_temp.attendre('creer', 'règle : les autres types restent en mode choix (retard)',
    pg_temp.appeler('stag_n', '1', $cd_q$select public.apercu_envoi('retard') ->> 'mode'$cd_q$), 'OK choix');

  -- Écrire à une fiche, à un stagiaire.
  v := pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, %L)::text', f_dir_n, 'autre', 'Preuve fiche', 'Bonjour'));
  perform pg_temp.attendre('creer', 'stag_n écrit à la fiche de dir_n (ecrire_a) : un principal, une ligne d''envoi « nouvelle »',
    pg_temp.calcul(format(c_dest, pg_temp.id_rendu(v))), format('1 %1$s %1$s:nouvelle:a_envoyer', f_dir_n));
  perform pg_temp.attendre('creer', 'stag_n écrit à la fiche de form_s (autre centre) : refusé ; sans type : refusé',
    pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', pg_temp.fiche('form_s'), 'autre', 'Preuve')) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve')),
    'ERREUR 42501 contact: Cette personne ne peut pas recevoir ta demande. / ERREUR P0001 contact: Type de demande inconnu.');
  v := pg_temp.appeler('form_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, %L)::text', s_n, 'Preuve stagiaire', 'Bonjour'));
  perform pg_temp.attendre('creer', 'form_n écrit à stag_n : un principal (le stagiaire), une ligne d''envoi « nouvelle » vers lui',
    pg_temp.calcul(format(c_dest, pg_temp.id_rendu(v))), format('1 s%1$s s%1$s:nouvelle:a_envoyer', s_n));
  perform pg_temp.attendre('creer', 'form_n écrit à stag_n : auteur la fiche de form_n, aucun type',
    pg_temp.calcul(format('select concat_ws(''|'', (auteur_stagiaire_id is null)::text, auteur_fiche_id, (type is null)::text, promo_id) from public.demandes where id = %s', pg_temp.id_rendu(v))),
    format('true|%s|true|1', f_form_n));
  perform pg_temp.attendre('creer', 'form_n écrit à stag_m (Montpellier, où il n''a pas de fiche) : refusé',
    pg_temp.appeler('form_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_m, 'Preuve')),
    'ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez.');
  -- R-T8a : l'équipe du même centre qui ne lit pas les stagiaires de la promo est refusée : t_rh (direction de Nîmes à titre non fixe,
  -- sans la case Stagiaires) et form_x (formateur d'une autre promo de Nîmes, posé ici).
  perform pg_temp.essai($cd_q$insert into public.user_profiles (email, role, is_admin) values ('preuve8.form.x@exemple.invalid', 'prof', true)$cd_q$);
  perform pg_temp.essai(format($cd_q$with p as (insert into public.promos (nom, lieu_id, date_debut) values ('Preuve8 autre promo', %s, date '2031-01-06') returning id)
    insert into public.affectations (email, role, promo_id) select 'preuve8.form.x@exemple.invalid', 'formateur', id from p$cd_q$, v_l1));
  perform pg_temp.essai($cd_q$insert into pg_temp.perso (ordre, nom, email, role) values (41, 'form_x', 'preuve8.form.x@exemple.invalid', 'prof')$cd_q$);
  perform pg_temp.attendre('creer', 'R-T8a : form_x a une fiche dans le centre de stag_n (le refus qui suit tient bien à la lecture des stagiaires)',
    pg_temp.calcul(format($cd_q$select public._contact_fiche_dans(c, %s)::text from public.contacts c where c.compte_email = 'preuve8.form.x@exemple.invalid'$cd_q$, v_l1)), 'true');
  perform pg_temp.attendre('creer', 'R-T8a : form_x (formateur d''une autre promo de Nîmes) et t_rh (titre non fixe sans Stagiaires) écrivent à stag_n : refusés, rien d''écrit',
    concat_ws(' / ',
      pg_temp.appeler('form_x', null, format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve')),
      pg_temp.appeler('t_rh', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve')),
      pg_temp.calcul($cd_q$select count(*)::text from public.demandes where sujet = 'Preuve' and auteur_fiche_id is not null and type is null$cd_q$)),
    'ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez. / ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez. / 0');
  v := pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve équipe'));
  perform pg_temp.attendre('creer', 'form_n écrit à la fiche de dir_n (équipe vers équipe) : OK, auteur sa fiche',
    pg_temp.calcul(format('select concat_ws(''|'', auteur_fiche_id, (select count(*) from public.contact_envois e where e.demande_id = d.id)) from public.demandes d where id = %s', pg_temp.id_rendu(v))),
    format('%s|1', f_form_n));
  perform pg_temp.attendre('creer', 'form_n : un type, ou sa propre fiche : refusés',
    pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'autre', 'Preuve')) || ' / '
      || pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_form_n, 'Preuve')),
    'ERREUR P0001 contact: Un message de l''équipe n''a pas de type. / ERREUR 42501 contact: Cette personne ne peut pas recevoir votre message.');

  -- Purge à l'écriture (C-17) : une demande entre membres de l'équipe vieille de 13 mois et un envoi de 4 mois partent ; une demande de
  -- l'équipe à un stagiaire du même âge reste.
  perform pg_temp.essai(format($cd_q$with d as (insert into public.demandes (lieu_id, promo_id, auteur_fiche_id, auteur_nom, sujet, cree_le, dernier_echange_le)
      values (%1$s, 1, %2$s, 'Preuve8 vieille', 'Preuve8 vieille équipe', timestamptz '2030-01-04 10:00 Europe/Paris', timestamptz '2030-02-01 10:00 Europe/Paris') returning id)
    insert into public.demande_destinataires (demande_id, fiche_id, nom, principal) select id, %3$s, 'dir_n', true from d$cd_q$, v_l1, f_form_n, f_dir_n));
  perform pg_temp.essai(format($cd_q$with d as (insert into public.demandes (lieu_id, promo_id, auteur_fiche_id, auteur_nom, sujet, cree_le, dernier_echange_le)
      values (%1$s, 1, %2$s, 'Preuve8 vieille', 'Preuve8 vieille stagiaire', timestamptz '2030-01-04 10:00 Europe/Paris', timestamptz '2030-02-01 10:00 Europe/Paris') returning id)
    insert into public.demande_destinataires (demande_id, stagiaire_id, nom, principal) select id, %3$s, 'stag_n', true from d$cd_q$, v_l1, f_form_n, s_n));
  perform pg_temp.essai($cd_q$insert into public.contact_envois (demande_id, vers_fiche_id, evenement, cree_le)
      select id, null, 'nouvelle', timestamptz '2030-11-01 10:00 Europe/Paris' from public.demandes where sujet = 'Preuve8 vieille stagiaire'$cd_q$);
  perform pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve purge'));
  perform pg_temp.attendre('creer', 'purge à l''écriture : la vieille demande d''équipe et le vieil envoi partis, la demande à un stagiaire gardée',
    pg_temp.calcul($cd_q$select concat_ws('/', (select count(*) from public.demandes where sujet = 'Preuve8 vieille équipe'),
      (select count(*) from public.demandes where sujet = 'Preuve8 vieille stagiaire'),
      (select count(*) from public.contact_envois where cree_le < timestamptz '2031-01-01'))$cd_q$),
    '0/1/0');
end $cd_gc$;

-- Groupe garde_fous : qui peut, combien, et rien d'écrit quand c'est refusé.
create or replace function pg_temp.groupe_garde_fous()
returns void language plpgsql as $cd_gg$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  f_form_n text := pg_temp.fiche('form_n');
  f_dir_n text := pg_temp.fiche('dir_n');
  s_n text := pg_temp.stag('stag_n');
  v_lv integer;
  v_pv integer;
  v_sv integer;
  v_avant text;
  v_n text;
  t text;
  c_apercu constant text := $cd_q$select public.apercu_envoi('administratif')::text$cd_q$;
  c_refus constant text := 'ERREUR 42501 contact: Réservé aux stagiaires.';
begin
  perform set_config('preuve.maintenant', '2031-03-04 10:00:00 Europe/Paris', true);
  -- Réservé aux stagiaires.
  perform pg_temp.attendre('garde_fous', 'fond en aperçu stagiaire de la promo 1 : refusé', pg_temp.appeler_apercu('fond', '1', 'stagiaire', c_apercu), c_refus);
  perform pg_temp.attendre('garde_fous', 'stag_n en aperçu stagiaire (en-tête posé) : refusé', pg_temp.appeler_apercu('stag_n', '1', 'stagiaire', c_apercu), c_refus);
  perform pg_temp.attendre('garde_fous', 'fond sans aperçu (fondateur, fiche en promo 1), cumul (fiche en promo 1 et formateur), form_n, siege : refusés',
    concat_ws(' / ', pg_temp.appeler('fond', '1', c_apercu), pg_temp.appeler('cumul', '1', c_apercu), pg_temp.appeler('form_n', '1', c_apercu),
              pg_temp.appeler('siege', null, c_apercu)),
    concat_ws(' / ', c_refus, c_refus, c_refus, c_refus));
  perform pg_temp.attendre('garde_fous', 'siège : chaque fonction refuse',
    concat_ws(' / ',
      pg_temp.appeler('siege', null, $cd_q$select count(*)::text from public.destinataires_possibles('administratif')$cd_q$),
      pg_temp.appeler('siege', null, format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'autre', 'Preuve', format('array[%s]::bigint[]', f_form_n))),
      pg_temp.appeler('siege', null, format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve')),
      pg_temp.appeler('siege', null, format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve'))),
    concat_ws(' / ', c_refus, c_refus, 'ERREUR 42501 contact: Réservé aux stagiaires et à l''équipe du centre.',
              'ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez.'));
  perform pg_temp.attendre('garde_fous', 'anon : aucune fonction de l''espace contact ne s''exécute',
    concat_ws(' / ', pg_temp.valeur(null, '1', null, c_apercu),
      pg_temp.valeur(null, '1', null, format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'autre', 'Preuve')),
      pg_temp.valeur(null, '1', null, format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve'))),
    'ERREUR 42501 / ERREUR 42501 / ERREUR 42501');
  -- Un stagiaire n'écrit jamais à un stagiaire : aucune fonction ne le permet, et aucun stagiaire n'a de fiche.
  -- La migration 4 tutoie ce refus (mode en ligne, joué après elle) ; sans elle, la phrase de l'équipe.
  perform pg_temp.attendre('garde_fous', 'stag_n vers un stagiaire (ecrire_au_stagiaire, stag_m et lui-même) : refusé',
    pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', pg_temp.stag('stag_m'), 'Preuve')) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve')),
    case when pg_temp.migration_4()
         then 'ERREUR 42501 contact: Tu ne peux écrire qu''à l''équipe de ton centre. / ERREUR 42501 contact: Tu ne peux écrire qu''à l''équipe de ton centre.'
         else 'ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez. / ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez.' end);
  perform pg_temp.attendre('garde_fous', 'aucun compte de stagiaire sans affectation n''a de fiche de contact (le délégué compris)',
    pg_temp.calcul($cd_q$select count(*)::text from public.contacts c join public.user_profiles up on lower(up.email) = c.compte_email
      where up.stagiaire_id is not null and not exists (select 1 from public.affectations a where lower(a.email) = c.compte_email)$cd_q$), '0');
  -- Le délégué n'est jamais principal : cumul, délégué titulaire de la promo 1, a une fiche (formateur à Montpellier) qui n'est pas
  -- dans la liste de la promo 1 ; la choisir est refusé.
  perform pg_temp.essai(format('update public.stagiaires set delegue = ''titulaire'' where id = %s', pg_temp.stag('cumul')));
  perform pg_temp.attendre('garde_fous', 'délégué (cumul) : sa fiche n''est pas dans la liste, la choisir est refusé',
    pg_temp.appeler('stag_n', '1', format('select count(*)::text from public.destinataires_possibles(''autre'') where fiche_id = %s', pg_temp.fiche('cumul'))) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'autre', 'Preuve', format('array[%s]::bigint[]', pg_temp.fiche('cumul')))),
    'OK 0 / ERREUR 42501 contact: Cette personne ne peut pas recevoir ta demande.');
  perform pg_temp.attendre('garde_fous', 'un choix nul est refusé',
    pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'autre', 'Preuve', format('array[%s, null]::bigint[]', f_form_n))),
    'ERREUR 42501 contact: Cette personne ne peut pas recevoir ta demande.');
  -- Entrées illisibles.
  perform pg_temp.attendre('garde_fous', 'type absence ou inconnu par ecrire_au_centre, sujet vide ou de 81 caractères, texte de 1001, jours illisibles (date illisible, sans jour, demi nulle, sans demi) : refusés',
    concat_ws(' / ',
      pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'absence', 'Preuve', format('array[%s]::bigint[]', f_form_n))),
      pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'urgent', 'Preuve', format('array[%s]::bigint[]', f_form_n))),
      pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'autre', '   ', format('array[%s]::bigint[]', f_form_n))),
      pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'autre', repeat('s', 81), format('array[%s]::bigint[]', f_form_n))),
      pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, %L, %s)::text', 'autre', 'Preuve', repeat('t', 1001), format('array[%s]::bigint[]', f_form_n))),
      pg_temp.appeler('stag_n', '1', $cd_q$select count(*)::text from public.destinataires_possibles('absence', '[{"jour": "demain", "demi": "matin"}]')$cd_q$),
      pg_temp.appeler('stag_n', '1', $cd_q$select count(*)::text from public.destinataires_possibles('absence', '[{"x": 1, "demi": "matin"}]')$cd_q$),
      pg_temp.appeler('stag_n', '1', $cd_q$select count(*)::text from public.destinataires_possibles('absence', '[{"jour": "2031-03-05", "demi": null}]')$cd_q$),
      pg_temp.appeler('stag_n', '1', $cd_q$select count(*)::text from public.destinataires_possibles('absence', '[{"jour": "2031-03-05"}]')$cd_q$)),
    concat_ws(' / ', 'ERREUR P0001 contact: Type de demande inconnu.', 'ERREUR P0001 contact: Type de demande inconnu.',
      'ERREUR P0001 contact: Le sujet compte de 1 à 80 caractères.', 'ERREUR P0001 contact: Le sujet compte de 1 à 80 caractères.',
      'ERREUR P0001 contact: Le message compte 1000 caractères au plus.', 'ERREUR P0001 contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée.',
      'ERREUR P0001 contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée.', 'ERREUR P0001 contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée.',
      'ERREUR P0001 contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée.'));
  -- Aucun droit direct ; aides internes fermées ; fonctions de l'app à authenticated seulement.
  foreach t in array array['demandes', 'demande_destinataires', 'demande_messages', 'contact_regles', 'contact_reponses', 'contact_envois', 'contact_jetons'] loop
    perform pg_temp.attendre('garde_fous', format('%s : aucun droit pour anon ni authenticated (TRUNCATE compris), RLS active', t),
      pg_temp.calcul(format($cd_q$select concat_ws('/', has_table_privilege('anon', 'public.%1$s', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')::text,
        has_table_privilege('authenticated', 'public.%1$s', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')::text,
        has_any_column_privilege('authenticated', 'public.%1$s', 'SELECT, INSERT, UPDATE, REFERENCES')::text,
        (select relrowsecurity from pg_class where oid = 'public.%1$s'::regclass)::text)$cd_q$, t)),
      'false/false/false/true');
  end loop;
  perform pg_temp.attendre('garde_fous', 'lecture directe de demandes par stag_n et form_n : refusée',
    pg_temp.valeur(pg_temp.email_de('stag_n'), '1', null, 'select count(*)::text from public.demandes') || ' / '
      || pg_temp.valeur(pg_temp.email_de('form_n'), '1', null, 'select count(*)::text from public.contact_regles'),
    'ERREUR 42501 / ERREUR 42501');
  perform pg_temp.attendre('garde_fous', 'aides internes de la migration 2 : aucune ne s''exécute par anon ni authenticated',
    pg_temp.calcul($cd_q$select count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
      || '/' || count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
       and p.proname in ('_contact_maintenant', '_contact_jour', '_contact_demi_courante', '_contact_jours', '_contact_nom_fiche', '_contact_disponible',
                         '_contact_direction_reelle_de', '_contact_formateurs_du_jour', '_contact_destinataires', '_contact_possibles',
                         '_contact_stagiaire', '_contact_fiche_equipe', '_contact_sujet', '_contact_texte', '_contact_quota', '_contact_purger',
                         '_contact_creer', '_contact_nom_stagiaire', '_contact_poser_reponses', '_contact_reponses_defaut')$cd_q$),
    '0/20');
  perform pg_temp.attendre('garde_fous', 'fonctions de l''app : authenticated oui, anon non',
    pg_temp.calcul($cd_q$select string_agg(p.proname || '=' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || has_function_privilege('anon', p.oid, 'EXECUTE'), ' ' order by p.proname)
      from pg_proc p where p.pronamespace = 'public'::regnamespace
       and p.proname in ('destinataires_possibles', 'apercu_envoi', 'ecrire_au_centre', 'ecrire_a', 'ecrire_au_stagiaire')$cd_q$),
    'apercu_envoi=truefalse destinataires_possibles=truefalse ecrire_a=truefalse ecrire_au_centre=truefalse ecrire_au_stagiaire=truefalse');

  -- Dix demandes par jour de Paris : complétées à dix en propriétaire, la onzième est refusée ; le lendemain, elle passe.
  v_n := pg_temp.calcul(format($cd_q$select count(*)::text from public.demandes where auteur_stagiaire_id = %s
    and (cree_le at time zone 'Europe/Paris')::date = date '2031-03-04'$cd_q$, s_n));
  perform pg_temp.essai(format($cd_q$insert into public.demandes (lieu_id, promo_id, auteur_stagiaire_id, auteur_nom, type, sujet, cree_le)
    select %s, 1, %s, 'Preuve8', 'autre', 'Preuve8 quota', timestamptz '2031-03-04 08:00 Europe/Paris' from generate_series(1, 10 - %s)$cd_q$, v_l1, s_n, v_n));
  perform pg_temp.attendre('garde_fous', 'onzième demande du jour (ecrire_a et ecrire_au_centre) : refusée',
    pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'autre', 'Preuve onze')) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'autre', 'Preuve onze', format('array[%s]::bigint[]', f_form_n))),
    'ERREUR P0001 contact: Tu as déjà envoyé 10 demandes aujourd''hui. Appelle le centre si c''est urgent. / ERREUR P0001 contact: Tu as déjà envoyé 10 demandes aujourd''hui. Appelle le centre si c''est urgent.');
  perform set_config('preuve.maintenant', '2031-03-05 00:30:00 Europe/Paris', true);
  perform pg_temp.verifier('garde_fous', 'le lendemain à 0 h 30 à Paris (le 4 encore en temps universel) : elle passe',
    pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'autre', 'Preuve lendemain')) ~ '^OK [0-9]+$');
  perform set_config('preuve.maintenant', '2031-03-04 10:00:00 Europe/Paris', true);

  -- Liste vide : un centre sans formateur, sans direction, sans règle ; un stagiaire y écrit au centre : refusé, rien n'est écrit (Q4).
  begin
    insert into public.lieux (nom) values ('Preuve8 centre sans équipe') returning id into v_lv;
    insert into public.promos (nom, lieu_id, date_debut) values ('Preuve8 promo sans équipe', v_lv, date '2031-01-06') returning id into v_pv;
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve8 stag_v', 'PREUVE', 990, v_pv) returning id into v_sv;
    insert into pg_temp.perso (ordre, nom, email, role) values (40, 'stag_v', 'preuve8.stag.v@exemple.invalid', 'stagiaire');
    insert into public.user_profiles (email, role, is_admin, stagiaire_id) values ('preuve8.stag.v@exemple.invalid', 'stagiaire', false, v_sv);
  exception when others then
    perform pg_temp.informer('liste vide', 'pose impossible : ' || sqlstate || ' ' || sqlerrm);
  end;
  v_avant := pg_temp.lignes_demandes();
  perform pg_temp.attendre('garde_fous', 'liste vide : apercu_envoi en mode choix, aucun possible',
    pg_temp.appeler('stag_v', v_pv::text, $cd_q$select (a ->> 'mode') || ' ' || jsonb_array_length(a -> 'possibles') from (select public.apercu_envoi('autre') a) s$cd_q$),
    'OK choix 0');
  perform pg_temp.attendre('garde_fous', 'liste vide : ecrire_au_centre sans choix, puis avec la fiche de form_n : refusé',
    pg_temp.appeler('stag_v', v_pv::text, format('select public.ecrire_au_centre(%L, %L, null, null)::text', 'autre', 'Preuve vide')) || ' / '
      || pg_temp.appeler('stag_v', v_pv::text, format('select public.ecrire_au_centre(%L, %L, null, %s)::text', 'autre', 'Preuve vide', format('array[%s]::bigint[]', f_form_n))),
    'ERREUR P0001 contact: Personne ne peut recevoir ta demande dans ce centre : préviens ton formateur directement. / ERREUR P0001 contact: Personne ne peut recevoir ta demande dans ce centre : préviens ton formateur directement.');
  perform pg_temp.attendre('garde_fous', 'liste vide : aucune ligne écrite dans demandes, demande_destinataires, demande_messages, contact_envois',
    pg_temp.lignes_demandes(), v_avant);
  perform pg_temp.verifier('garde_fous', 'liste vide : le décompte des lignes se lit (tables présentes)', v_avant ~ '^[0-9]+/[0-9]+/[0-9]+/[0-9]+$', v_avant);
end $cd_gg$;

-- ===== Partie B (tâche 9) : lire, états, réglages, conservation. Le jour : mardi 11 mars 2031 à Paris (stag_n a atteint son quota le
-- 4 mars, groupe garde_fous). Les demandes d'essai de la partie B sont rangées dans pg_temp.dem (nom, identifiant).
create or replace function pg_temp.poser_dem(p_nom text, p_appel text)
returns text language plpgsql as $cd_pd$
begin
  create temp table if not exists dem (nom text primary key, id bigint);
  delete from pg_temp.dem where nom = p_nom;
  if p_appel ~ '^OK [0-9]+$' then
    insert into pg_temp.dem values (p_nom, substr(p_appel, 4)::bigint);
  end if;
  return p_appel;
end $cd_pd$;

-- L'identifiant d'une demande d'essai (texte), ou « null ».
create or replace function pg_temp.dem(p_nom text)
returns text language plpgsql as $cd_dm$
begin
  return coalesce((select id::text from pg_temp.dem where nom = p_nom), 'null');
exception when others then
  return 'null';
end $cd_dm$;

-- Ce que liste_demandes(p_lieu) rend à un personnage, restreint aux demandes d'essai d1 et d2 : « d1:auteur,d2:direction » (vide : aucune).
create or replace function pg_temp.liste_d(p_qui text, p_entete text, p_lieu text)
returns text language plpgsql as $cd_ls$
begin
  return pg_temp.appeler(p_qui, p_entete, format($cd_q$select coalesce(string_agg(case l.id when %1$s then 'd1' when %2$s then 'd2' end || ':' || l.mon_role, ',' order by l.id), '')
    from public.liste_demandes(%3$s) l where l.id in (%1$s, %2$s)$cd_q$, pg_temp.dem('d1'), pg_temp.dem('d2'), p_lieu));
end $cd_ls$;

-- Les envois d'une demande nés après l'envoi p_apres : « vers:evenement:etat[:raison] », vers = la fiche, ou s suivi du stagiaire.
create or replace function pg_temp.envois_apres(p_demande text, p_apres text)
returns text language sql as $cd_ea$
  select pg_temp.calcul(format($cd_q$select coalesce(string_agg(coalesce(e.vers_fiche_id::text, 's' || e.vers_stagiaire_id) || ':' || e.evenement || ':' || e.etat
      || coalesce(':' || e.raison, ''), ',' order by e.id), '') from public.contact_envois e where e.demande_id = %s and e.id > %s$cd_q$, p_demande, p_apres));
$cd_ea$;

-- Le dernier envoi (identifiant en texte, 0 sans aucun).
create or replace function pg_temp.dernier_envoi()
returns text language sql as $cd_de$
  select pg_temp.calcul('select coalesce(max(id), 0)::text from public.contact_envois');
$cd_de$;

-- Groupe lire : qui voit quelle demande (liste_demandes, demande_detail, _contact_lecteur).
create or replace function pg_temp.groupe_lire()
returns void language plpgsql as $cd_gl$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l4 integer := (select lieu_id from public.promos where id = 7);
  f_dir_n text := pg_temp.fiche('dir_n');
  f_t_secr text := pg_temp.fiche('t_secr');
  s_n text := pg_temp.stag('stag_n');
  v_deleg integer;
  v text;
begin
  perform set_config('preuve.maintenant', '2031-03-11 10:00:00 Europe/Paris', true);
  perform pg_temp.essai(format('delete from public.contact_regles where lieu_id = %s', v_l1));
  v := pg_temp.poser_dem('d1', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, %L)::text', f_dir_n, 'autre', 'Preuve9 lire', 'Bonjour')));
  perform pg_temp.verifier('lire', 'd1 : stag_n écrit à la fiche de dir_n', v ~ '^OK [0-9]+$', v);
  v := pg_temp.poser_dem('d2', pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, %L)::text', f_t_secr, 'Preuve9 collègue', 'Bonjour')));
  perform pg_temp.verifier('lire', 'd2 : form_n écrit à la fiche de t_secr (un collègue)', v ~ '^OK [0-9]+$', v);

  perform pg_temp.attendre('lire', 'liste_demandes() : d1 à stag_n (auteur) et à dir_n (principal), pas à form_n (seulement d2, dont il est l''auteur)',
    concat_ws(' / ', pg_temp.liste_d('stag_n', '1', 'null'), pg_temp.liste_d('dir_n', '1', 'null'), pg_temp.liste_d('form_n', '1', 'null')),
    'OK d1:auteur / OK d1:principal / OK d2:auteur');
  perform pg_temp.attendre('lire', 'liste_demandes(Nîmes) par dir_n (direction réelle) : d1 et la demande entre collègues',
    pg_temp.liste_d('dir_n', '1', v_l1::text), 'OK d1:principal,d2:direction');
  perform pg_temp.attendre('lire', 'fond (fondateur) : aucune demande où il n''a pas de rôle, avec ou sans centre, ni en aperçu direction',
    concat_ws(' / ', pg_temp.appeler('fond', '1', 'select count(*)::text from public.liste_demandes()'),
      pg_temp.appeler('fond', '1', format('select count(*)::text from public.liste_demandes(%s)', v_l1)),
      pg_temp.appeler_apercu('fond', '1', 'direction', format('select count(*)::text from public.liste_demandes(%s)', v_l1))),
    'OK 0 / OK 0 / OK 0');
  perform pg_temp.attendre('lire', 't_secr (titre de centre non fixe), liste_demandes(Nîmes) : les siennes seulement (d2, destinataire)',
    pg_temp.liste_d('t_secr', '1', v_l1::text) || ' | ' || pg_temp.appeler('t_secr', '1', format('select count(*)::text from public.liste_demandes(%s)', v_l1)),
    'OK d2:principal | OK 1');
  perform pg_temp.attendre('lire', 'siège : aucune ; dir_s (autre centre), sur Nîmes et sur le sien : aucune',
    concat_ws(' / ', pg_temp.appeler('siege', null, format('select count(*)::text from public.liste_demandes(%s)', v_l1)),
      pg_temp.liste_d('dir_s', '7', v_l1::text), pg_temp.liste_d('dir_s', '7', v_l4::text)),
    'OK 0 / OK / OK');
  perform pg_temp.attendre('lire', 'demande_detail(d1) par form_s et par form_n (aucun rôle) : refusé',
    pg_temp.appeler('form_s', '7', format('select public.demande_detail(%s)::text', pg_temp.dem('d1'))) || ' / '
      || pg_temp.appeler('form_n', '1', format('select public.demande_detail(%s)::text', pg_temp.dem('d1'))),
    'ERREUR 42501 contact: Demande introuvable. / ERREUR 42501 contact: Demande introuvable.');
  perform pg_temp.attendre('lire', 'demande_detail(d1) par stag_n : un destinataire, aucun envoi ni réponse toute faite, peut répondre et annuler, pas prendre',
    pg_temp.appeler('stag_n', '1', format($cd_q$select concat_ws(' ', r -> 'demande' ->> 'sujet', jsonb_array_length(r -> 'destinataires'), jsonb_array_length(r -> 'envois'),
      jsonb_array_length(r -> 'reponses_toutes_faites'), r -> 'peut' ->> 'repondre', r -> 'peut' ->> 'prendre', r -> 'peut' ->> 'annuler', r -> 'peut' ->> 'justificatif')
      from (select public.demande_detail(%s) r) x$cd_q$, pg_temp.dem('d1'))),
    'OK Preuve9 lire 1 0 0 true false true false');
  perform pg_temp.attendre('lire', 'demande_detail(d1) par dir_n : un envoi « nouvelle », quatre réponses toutes faites, peut répondre et prendre, pas annuler',
    pg_temp.appeler('dir_n', '1', format($cd_q$select concat_ws(' ', jsonb_array_length(r -> 'envois'), r -> 'envois' -> 0 ->> 'evenement', jsonb_array_length(r -> 'reponses_toutes_faites'),
      r -> 'peut' ->> 'repondre', r -> 'peut' ->> 'prendre', r -> 'peut' ->> 'annuler') from (select public.demande_detail(%s) r) x$cd_q$, pg_temp.dem('d1'))),
    'OK 1 nouvelle 4 true true false');
  perform pg_temp.attendre('lire', '_contact_lecteur(d1) : stag_n auteur, dir_n principal, form_n nul',
    concat_ws(' / ', pg_temp.valeur_proprio(pg_temp.email_de('stag_n'), '1', null, format('select public._contact_lecteur(%s)', pg_temp.dem('d1'))),
      pg_temp.valeur_proprio(pg_temp.email_de('dir_n'), '1', null, format('select public._contact_lecteur(%s)', pg_temp.dem('d1'))),
      coalesce(pg_temp.valeur_proprio(pg_temp.email_de('form_n'), '1', null, format('select public._contact_lecteur(%s)', pg_temp.dem('d1'))), 'nul')),
    'auteur / principal / nul');

  -- Le délégué : une ligne annexe posée en propriétaire (les avis d'absence viennent avec la partie C) pour deleg, stagiaire de la promo 1,
  -- et pour stag_n, auteur de d1 (l'ordre décide : il reste auteur).
  begin
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve9 deleg', 'PREUVE', 990, 1) returning id into v_deleg;
    insert into pg_temp.perso (ordre, nom, email, role) values (42, 'deleg', 'preuve9.deleg@exemple.invalid', 'stagiaire');
    insert into public.user_profiles (email, role, is_admin, stagiaire_id) values ('preuve9.deleg@exemple.invalid', 'stagiaire', false, v_deleg);
    execute format($cd_q$insert into public.demande_destinataires (demande_id, stagiaire_id, nom, principal, annexe)
      values (%1$s, %2$s, 'Preuve9 deleg', false, 'delegue'), (%1$s, %3$s, 'Preuve9 stag_n', false, 'delegue')$cd_q$, pg_temp.dem('d1'), v_deleg, s_n);
  exception when others then
    perform pg_temp.informer('délégué', 'pose impossible : ' || sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.attendre('lire', 'délégué : liste_demandes rend type, auteur, dates seulement ; demande_detail refusé',
    pg_temp.appeler('deleg', '1', $cd_q$select concat_ws('|', count(*), max(type), count(id), count(sujet), count(etat), count(non_lue), count(a_traiter), count(envoi_en_echec),
      max(auteur_nom), count(cree_le), count(dernier_echange_le), max(mon_role)) from public.liste_demandes()$cd_q$) || ' / '
      || pg_temp.appeler('deleg', '1', format('select public.demande_detail(%s)::text', pg_temp.dem('d1'))),
    -- Avec la migration 3 appliquée (mode en ligne après elle), le délégué ne lit plus que les absences non annulées, sans aucune date
    -- (tests/sql/contact-absences-preuve.sql, groupe delegue) : d1 (type autre) ne lui est plus rendue.
    case when to_regclass('public.absences_annoncees') is null
         then 'OK 1|autre|0|0|0|0|0|0|Preuve7 stag_n PREUVE|1|1|delegue / ERREUR 42501 contact: Demande introuvable.'
         else 'OK 0|0|0|0|0|0|0|0|0 / ERREUR 42501 contact: Demande introuvable.' end);
  perform pg_temp.attendre('lire', 'un délégué qui est aussi l''auteur reste auteur',
    pg_temp.liste_d('stag_n', '1', 'null'), 'OK d1:auteur');

  -- Le compte cumulé : fond est le fondateur, administrateur et stagiaire de la promo 1. Pour la base il n'est ni stagiaire (_contact_stagiaire
  -- exclut administrateur et fondateur) ni une fiche de l'équipe (aucune fiche) : il n'écrit rien, ne lit aucune demande (ni liste, ni suivi) et
  -- n'a aucun rôle, quel que soit l'espace de l'écran. En espace équipe, l'app lui montre donc Messages vide et dit la phrase de refus s'il écrit.
  perform pg_temp.attendre('lire', 'fond (cumul) : écrire à une fiche, au centre, à un stagiaire : refusé avec la phrase du centre ; demande_detail(d1) : introuvable',
    concat_ws(' / ',
      pg_temp.appeler('fond', '1', format('select public.ecrire_a(%s, %L, %L, %L)::text', f_dir_n, 'autre', 'Preuve13 cumul', 'Bonjour')),
      pg_temp.appeler('fond', '1', format('select public.ecrire_au_stagiaire(%s, %L, %L)::text', s_n, 'Preuve13 cumul', 'Bonjour')),
      pg_temp.appeler('fond', '1', format('select public.demande_detail(%s)::text', pg_temp.dem('d1')))),
    'ERREUR 42501 contact: Réservé aux stagiaires et à l''équipe du centre. / ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez. / ERREUR 42501 contact: Demande introuvable.');
  perform pg_temp.attendre('lire', 'fond (cumul) : liste_demandes() vide, sans centre et avec le centre de Nîmes ; _contact_lecteur(d1) nul',
    concat_ws(' / ', pg_temp.liste_d('fond', '1', 'null'), pg_temp.liste_d('fond', '1', v_l1::text),
      coalesce(pg_temp.valeur_proprio(pg_temp.email_de('fond'), '1', null, format('select public._contact_lecteur(%s)', pg_temp.dem('d1'))), 'nul')),
    'OK / OK / nul');
end $cd_gl$;

-- Groupe etats : lue, réponses (libres et toutes faites), prise en compte, annulation, relance d'un envoi, e-mail affichable.
create or replace function pg_temp.groupe_etats()
returns void language plpgsql as $cd_ge$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l4 integer := (select lieu_id from public.promos where id = 7);
  f_dir_n text := pg_temp.fiche('dir_n');
  s_n text := pg_temp.stag('stag_n');
  d1 text := pg_temp.dem('d1');
  v_m text;
  v text;
  v_rep text;
begin
  perform set_config('preuve.maintenant', '2031-03-11 11:00:00 Europe/Paris', true);
  -- Lue.
  perform pg_temp.appeler('dir_n', '1', format('select public.marquer_lue(%s)::text', d1));
  perform pg_temp.attendre('etats', 'marquer_lue par dir_n : lue_le et lue_par posés sur sa ligne',
    pg_temp.calcul(format('select concat_ws(''|'', (lue_le = timestamptz ''2031-03-11 11:00 Europe/Paris'')::text, (lue_par = nom)::text) from public.demande_destinataires where demande_id = %s and fiche_id = %s', d1, f_dir_n)),
    'true|true');
  perform pg_temp.attendre('etats', 'liste_demandes() par dir_n : d1 n''est plus non lue, et reste à traiter',
    pg_temp.appeler('dir_n', '1', format('select concat_ws(''|'', non_lue::text, a_traiter::text) from public.liste_demandes() where id = %s', d1)), 'OK false|true');
  perform pg_temp.attendre('etats', 'marquer_lue par stag_n (auteur) : rien (aucune ligne lue de plus)',
    pg_temp.appeler('stag_n', '1', format('select public.marquer_lue(%s)::text', d1)) || ' / '
      || pg_temp.calcul(format('select count(*)::text from public.demande_destinataires where demande_id = %s and lue_le is not null', d1)),
    'OK / 1');
  -- Réponse toute faite « Absence enregistrée » (vaut prise) par dir_n.
  v_rep := pg_temp.calcul(format($cd_q$select id::text from public.contact_reponses where lieu_id = %s and libelle = 'Absence enregistrée'$cd_q$, v_l1));
  v_m := pg_temp.dernier_envoi();
  v := pg_temp.appeler('dir_n', '1', format('select public.repondre_demande(%s, null, %s)::text', d1, v_rep));
  perform pg_temp.verifier('etats', 'réponse « Absence enregistrée » par dir_n : OK', v ~ '^OK [0-9]+$', v);
  perform pg_temp.attendre('etats', 'réponse « Absence enregistrée » : la demande passe à prise (par dir_n, à l''heure), une ligne d''envoi « prise » vers stag_n et rien d''autre (ni délégué, ni dir_n)',
    pg_temp.calcul(format($cd_q$select concat_ws('|', etat, (prise_par = (select nom from public.demande_destinataires where demande_id = d.id and fiche_id = %s))::text,
      (prise_le = timestamptz '2031-03-11 11:00 Europe/Paris')::text, (dernier_echange_le = prise_le)::text) from public.demandes d where id = %s$cd_q$, f_dir_n, d1))
      || ' ' || pg_temp.envois_apres(d1, v_m),
    format('prise|true|true|true s%s:prise:a_envoyer', s_n));
  perform pg_temp.attendre('etats', 'le message : la réponse toute faite, sans texte, au nom de dir_n',
    pg_temp.calcul(format('select concat_ws(''|'', reponse_id, coalesce(texte, ''aucun''), par_lien::text, (auteur_nom = (select nom from public.demande_destinataires where demande_id = m.demande_id and fiche_id = %s))::text) from public.demande_messages m where id = %s', f_dir_n, pg_temp.id_rendu(v))),
    v_rep || '|aucun|false|true');
  -- Réponse libre de stag_n.
  v_m := pg_temp.dernier_envoi();
  v := pg_temp.appeler('stag_n', '1', format('select public.repondre_demande(%s, %L)::text', d1, '  Merci  '));
  perform pg_temp.attendre('etats', 'réponse libre de stag_n : lue_le de dir_n remis à nul, un envoi « réponse » vers la fiche de dir_n et rien d''autre',
    pg_temp.calcul(format('select concat_ws(''|'', count(*) filter (where lue_le is not null), count(*) filter (where lue_par is not null)) from public.demande_destinataires where demande_id = %s', d1))
      || ' ' || pg_temp.envois_apres(d1, v_m),
    format('0|0 %s:reponse:a_envoyer', f_dir_n));
  perform pg_temp.attendre('etats', 'la réponse de stag_n : texte rogné, auteur nommé, dernier échange à l''heure ; d1 de nouveau non lue pour dir_n',
    pg_temp.calcul(format('select concat_ws(''|'', texte, auteur_nom, (select (dernier_echange_le = m.cree_le)::text from public.demandes where id = m.demande_id)) from public.demande_messages m where id = %s', pg_temp.id_rendu(v)))
      || ' ' || pg_temp.appeler('dir_n', '1', format('select non_lue::text from public.liste_demandes() where id = %s', d1)),
    'Merci|Preuve7 stag_n PREUVE|true OK true');
  -- Refus.
  perform pg_temp.attendre('etats', 'annuler_demande par dir_n (destinataire) : refusé ; par stag_n après la prise : refusé',
    pg_temp.appeler('dir_n', '1', format('select public.annuler_demande(%s)::text', d1)) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select public.annuler_demande(%s)::text', d1)),
    'ERREUR 42501 contact: Seule la personne qui a écrit la demande peut l''annuler. / ERREUR P0001 contact: Cette demande ne peut plus être annulée.');
  perform pg_temp.attendre('etats', 'réponse toute faite d''un autre centre, texte de 1001 caractères, réponse vide, stag_n avec une réponse toute faite : refusés',
    concat_ws(' / ',
      pg_temp.appeler('dir_n', '1', format('select public.repondre_demande(%s, null, %s)::text', d1,
        pg_temp.calcul(format($cd_q$select id::text from public.contact_reponses where lieu_id = %s and libelle = 'Bien reçu'$cd_q$, v_l4)))),
      pg_temp.appeler('dir_n', '1', format('select public.repondre_demande(%s, %L)::text', d1, repeat('t', 1001))),
      pg_temp.appeler('dir_n', '1', format('select public.repondre_demande(%s, %L)::text', d1, '   ')),
      pg_temp.appeler('stag_n', '1', format('select public.repondre_demande(%s, null, %s)::text', d1, v_rep))),
    concat_ws(' / ', 'ERREUR P0001 contact: Cette réponse toute faite n''existe pas dans ce centre.',
      'ERREUR P0001 contact: Le message compte 1000 caractères au plus.',
      'ERREUR P0001 contact: Écrivez votre réponse ou choisissez une réponse toute faite.',
      'ERREUR 42501 contact: Les réponses toutes faites sont celles de l''équipe qui reçoit la demande.'));
  perform pg_temp.attendre('etats', 'répondre : form_n (aucun rôle) et le délégué refusés, rien d''écrit',
    pg_temp.appeler('form_n', '1', format('select public.repondre_demande(%s, %L)::text', d1, 'Preuve')) || ' / '
      || pg_temp.appeler('deleg', '1', format('select public.repondre_demande(%s, %L)::text', d1, 'Preuve')) || ' / '
      || pg_temp.calcul(format('select count(*)::text from public.demande_messages where demande_id = %s', d1)),
    'ERREUR 42501 contact: Demande introuvable. / ERREUR 42501 contact: Demande introuvable. / 2');
  -- L'e-mail affichable de la fiche de dir_n : posé en propriétaire sans vérification, il reste caché ; vérifiée par dir_n, il se lit.
  perform pg_temp.essai(format($cd_q$update public.contacts set email = 'preuve9.dir.n.pro@exemple.invalid', verifiee_le = null where id = %s$cd_q$, f_dir_n));
  v := pg_temp.appeler('stag_n', '1', format($cd_q$select coalesce(public.demande_detail(%s) -> 'destinataires' -> 0 ->> 'email', 'aucun')$cd_q$, d1));
  perform pg_temp.appeler('dir_n', '1', $cd_q$select public.regler_ma_fiche('{}')::text$cd_q$);
  perform pg_temp.attendre('etats', 'demande_detail par stag_n : l''e-mail de dir_n n''apparaît qu''après qu''elle a vérifié sa fiche',
    v || ' / ' || pg_temp.appeler('stag_n', '1', format($cd_q$select coalesce(public.demande_detail(%s) -> 'destinataires' -> 0 ->> 'email', 'aucun')$cd_q$, d1)),
    'OK aucun / OK preuve9.dir.n.pro@exemple.invalid');

  -- Prendre en compte (d3), annuler (d4), relancer un envoi.
  perform pg_temp.poser_dem('d3', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'document', 'Preuve9 prendre')));
  perform pg_temp.attendre('etats', 'prendre_en_compte : stag_n refusé ; dir_n OK (prise, envoi « prise » vers stag_n) ; une seconde fois refusé',
    concat_ws(' / ', pg_temp.appeler('stag_n', '1', format('select public.prendre_en_compte(%s)::text', pg_temp.dem('d3'))),
      pg_temp.appeler('dir_n', '1', format('select public.prendre_en_compte(%s)::text', pg_temp.dem('d3'))),
      pg_temp.calcul(format('select etat from public.demandes where id = %s', pg_temp.dem('d3'))),
      pg_temp.envois_apres(pg_temp.dem('d3'), '0'),
      pg_temp.appeler('dir_n', '1', format('select public.prendre_en_compte(%s)::text', pg_temp.dem('d3')))),
    concat_ws(' / ', 'ERREUR 42501 contact: Seule l''équipe qui reçoit la demande la prend en compte.', 'OK', 'prise',
      format('%s:nouvelle:a_envoyer,s%s:prise:a_envoyer', f_dir_n, s_n), 'ERREUR P0001 contact: Cette demande est déjà prise en compte.'));
  perform pg_temp.poser_dem('d4', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'retard', 'Preuve9 annuler')));
  v_m := pg_temp.dernier_envoi();
  perform pg_temp.attendre('etats', 'annuler_demande par stag_n (auteur, envoyée) : annulée, envoi « annulation » vers dir_n ; répondre ensuite : refusé',
    concat_ws(' / ', pg_temp.appeler('stag_n', '1', format('select public.annuler_demande(%s)::text', pg_temp.dem('d4'))),
      pg_temp.calcul(format('select concat_ws(''|'', etat, annulee_par, (annulee_le is not null)::text) from public.demandes where id = %s', pg_temp.dem('d4'))),
      pg_temp.envois_apres(pg_temp.dem('d4'), v_m),
      pg_temp.appeler('dir_n', '1', format('select public.repondre_demande(%s, %L)::text', pg_temp.dem('d4'), 'Preuve'))),
    concat_ws(' / ', 'OK', 'annulee|Preuve7 stag_n PREUVE|true', format('%s:annulation:a_envoyer', f_dir_n),
      'ERREUR P0001 contact: Cette demande est annulée.'));
  v_m := pg_temp.calcul(format('select min(id)::text from public.contact_envois where demande_id = %s', pg_temp.dem('d4')));
  perform pg_temp.essai(format($cd_q$update public.contact_envois set etat = 'echec', raison = 'preuve', tentatives = 3 where id = %s$cd_q$, v_m));
  perform pg_temp.attendre('etats', 'liste_demandes : envoi_en_echec pour dir_n ; nul pour stag_n (l''équipe seulement)',
    pg_temp.appeler('dir_n', '1', format('select envoi_en_echec::text from public.liste_demandes() where id = %s', pg_temp.dem('d4'))) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select coalesce(envoi_en_echec::text, ''nul'') from public.liste_demandes() where id = %s', pg_temp.dem('d4'))),
    'OK true / OK nul');
  perform pg_temp.attendre('etats', 'relancer_envoi : stag_n et form_n refusés ; dir_n OK (à envoyer, compteurs remis) ; une seconde fois refusé',
    concat_ws(' / ', pg_temp.appeler('stag_n', '1', format('select public.relancer_envoi(%s)::text', v_m)),
      pg_temp.appeler('form_n', '1', format('select public.relancer_envoi(%s)::text', v_m)),
      pg_temp.appeler('dir_n', '1', format('select public.relancer_envoi(%s)::text', v_m)),
      pg_temp.calcul(format('select concat_ws(''|'', etat, coalesce(raison, ''aucune''), tentatives) from public.contact_envois where id = %s', v_m)),
      pg_temp.appeler('dir_n', '1', format('select public.relancer_envoi(%s)::text', v_m))),
    concat_ws(' / ', 'ERREUR 42501 contact: Envoi introuvable.', 'ERREUR 42501 contact: Envoi introuvable.', 'OK', 'a_envoyer|aucune|0',
      'ERREUR P0001 contact: Cet envoi n''est pas en échec.'));
  -- R-T9a : un geste refusé ne laisse aucune ligne d'envoi (annuler une demande prise, relancer un envoi qui n'est pas en échec).
  v_m := pg_temp.dernier_envoi();
  perform pg_temp.attendre('etats', 'R-T9a : annuler d1 (prise) puis relancer un envoi à envoyer : refusés, aucun envoi créé, l''envoi inchangé',
    concat_ws(' / ', pg_temp.appeler('stag_n', '1', format('select public.annuler_demande(%s)::text', d1)),
      pg_temp.appeler('dir_n', '1', format('select public.relancer_envoi(%s)::text', pg_temp.calcul(format('select min(id)::text from public.contact_envois where demande_id = %s', pg_temp.dem('d4'))))),
      pg_temp.calcul(format('select count(*)::text from public.contact_envois where id > %s', v_m)),
      pg_temp.calcul(format('select concat_ws(''|'', etat, tentatives) from public.contact_envois where id = (select min(id) from public.contact_envois where demande_id = %s)', pg_temp.dem('d4')))),
    'ERREUR P0001 contact: Cette demande ne peut plus être annulée. / ERREUR P0001 contact: Cet envoi n''est pas en échec. / 0 / a_envoyer|0');

  -- R-T8a (relecture de la tâche 9, I1) : les rôles de l'équipe se rejugent. d5 : stag_n écrit à form_n ; d6 : form_n écrit à stag_n.
  perform pg_temp.groupe_etats_deplace();
end $cd_ge$;

-- Suite du groupe etats : form_n muté à Montpellier, puis form_n sans la case Stagiaires de la promo 1 (chacun dans une sous-transaction
-- annulée) ; avant, il liste, lit, répond, prend en compte et relance (sous-transaction annulée aussi).
create or replace function pg_temp.groupe_etats_deplace()
returns void language plpgsql as $cd_gd$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  f_form_n text := pg_temp.fiche('form_n');
  s_n text := pg_temp.stag('stag_n');
  e_form_n text := pg_temp.email_de('form_n');
  d5 text;
  d6 text;
  v_envoi text;
  v_titre text;
  c_liste constant text := $cd_q$select coalesce(string_agg(case l.id when %1$s then 'd5' when %2$s then 'd6' end || ':' || l.mon_role, ',' order by l.id), '')
    from public.liste_demandes() l where l.id in (%1$s, %2$s)$cd_q$;
  r_avant text;
  r_mute text;
  r_case text;
  r_case2 text;
  v_avant text;
begin
  d5 := pg_temp.id_rendu(pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, %L)::text', f_form_n, 'autre', 'Preuve9 déplacé', 'Motif')));
  d6 := pg_temp.id_rendu(pg_temp.appeler('form_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve9 ouverte')));
  v_envoi := pg_temp.calcul(format('select min(id)::text from public.contact_envois where demande_id = %s', d5));
  perform pg_temp.essai(format($cd_q$update public.contact_envois set etat = 'echec' where id = %s$cd_q$, v_envoi));
  v_avant := pg_temp.calcul($cd_q$select concat_ws('/', (select count(*) from public.demande_messages), (select count(*) from public.contact_envois),
    (select count(*) from public.demandes where etat = 'prise'))$cd_q$);
  -- Avant : tout lui est permis.
  begin
    r_avant := concat_ws(' / ', pg_temp.appeler('form_n', '1', format(c_liste, d5, d6)),
      regexp_replace(pg_temp.appeler('form_n', '1', format($cd_q$select public.demande_detail(%s) -> 'demande' ->> 'texte'$cd_q$, d5)), '[0-9]+', 'n'),
      regexp_replace(pg_temp.appeler('form_n', '1', format('select public.repondre_demande(%s, %L)::text', d5, 'Preuve')), '[0-9]+', 'n'),
      pg_temp.appeler('form_n', '1', format('select public.prendre_en_compte(%s)::text', d5)),
      pg_temp.appeler('form_n', '1', format('select public.relancer_envoi(%s)::text', v_envoi)),
      regexp_replace(pg_temp.appeler('form_n', '1', format('select public.repondre_demande(%s, %L)::text', d6, 'Preuve')), '[0-9]+', 'n'));
    raise exception using errcode = 'P0001', message = 'ANNULE';
  exception when others then
    perform pg_temp.proprio();
    if sqlerrm <> 'ANNULE' then r_avant := 'pose impossible : ' || sqlstate || ' ' || sqlerrm; end if;
  end;
  perform pg_temp.attendre('etats', 'R-T8a : avant tout déplacement, form_n liste d5 et d6, lit le motif, répond, prend en compte, relance',
    r_avant, 'OK d5:principal,d6:auteur / OK Motif / OK n / OK / OK / OK n');
  -- Muté : une affectation de formateur à Montpellier (promo 2), puis celle de la promo 1 retirée (sa fiche reste, hors de Nîmes).
  begin
    insert into public.affectations (email, role, promo_id) values (e_form_n, 'formateur', 2);
    delete from public.affectations where lower(email) = lower(e_form_n) and promo_id = 1;
    r_mute := concat_ws(' / ', pg_temp.calcul(format('select count(*)::text from public.contacts c where c.id = %s and not public._contact_fiche_dans(c, %s)', f_form_n, v_l1)),
      pg_temp.appeler('form_n', '2', format(c_liste, d5, d6)),
      pg_temp.appeler('form_n', '2', format('select public.demande_detail(%s)::text', d5)),
      pg_temp.appeler('form_n', '2', format('select public.repondre_demande(%s, %L)::text', d5, 'Preuve')),
      pg_temp.appeler('form_n', '2', format('select public.prendre_en_compte(%s)::text', d5)),
      pg_temp.appeler('form_n', '2', format('select public.relancer_envoi(%s)::text', v_envoi)),
      pg_temp.appeler('form_n', '2', format('select public.demande_detail(%s)::text', d6)),
      pg_temp.appeler('form_n', '2', format('select public.repondre_demande(%s, %L)::text', d6, 'Preuve')));
    raise exception using errcode = 'P0001', message = 'ANNULE';
  exception when others then
    perform pg_temp.proprio();
    if sqlerrm <> 'ANNULE' then r_mute := 'pose impossible : ' || sqlstate || ' ' || sqlerrm; end if;
  end;
  perform pg_temp.attendre('etats', 'R-T8a : form_n muté à Montpellier : plus rien sur d5 ni d6 (liste vide ; détail, réponse, prise, relance refusés)',
    r_mute, concat_ws(' / ', '1', 'OK', 'ERREUR 42501 contact: Demande introuvable.', 'ERREUR 42501 contact: Demande introuvable.',
      'ERREUR 42501 contact: Demande introuvable.', 'ERREUR 42501 contact: Envoi introuvable.', 'ERREUR 42501 contact: Demande introuvable.',
      'ERREUR 42501 contact: Demande introuvable.'));
  -- Sans la case Stagiaires : son affectation de la promo 1 passe à un titre de promo qui ne l'ouvre pas ; il reste dans le centre.
  begin
    v_titre := pg_temp.nouveau_titre('Preuve9 sans stagiaires', 'promo', v_l1);
    update public.titres set cases = '{"cours":"voir"}'::jsonb where id = v_titre::bigint;
    update public.affectations set titre_id = v_titre::bigint where lower(email) = lower(e_form_n) and promo_id = 1;
    r_case := concat_ws(' / ', pg_temp.valeur_proprio(e_form_n, '1', null, $cd_q$select public.geste_promo(1, 'stagiaires.lire')::text$cd_q$),
      pg_temp.appeler('form_n', '1', format(c_liste, d5, d6)),
      pg_temp.appeler('form_n', '1', format('select public.demande_detail(%s)::text', d6)),
      pg_temp.appeler('form_n', '1', format('select public.repondre_demande(%s, %L)::text', d6, 'Preuve')));
    r_case2 := pg_temp.appeler('form_n', '1', format($cd_q$select public.demande_detail(%s) -> 'demande' ->> 'texte'$cd_q$, d5));
    raise exception using errcode = 'P0001', message = 'ANNULE';
  exception when others then
    perform pg_temp.proprio();
    if sqlerrm <> 'ANNULE' then r_case := 'pose impossible : ' || sqlstate || ' ' || sqlerrm; end if;
  end;
  perform pg_temp.attendre('etats', 'R-T8a : form_n sans la case Stagiaires de la promo 1 : la conversation qu''il a ouverte (d6) lui est fermée ; la demande reçue (d5) reste lisible',
    r_case || ' / ' || coalesce(r_case2, 'nul'),
    'false / OK d5:principal / ERREUR 42501 contact: Demande introuvable. / ERREUR 42501 contact: Demande introuvable. / OK Motif');
  perform pg_temp.attendre('etats', 'R-T8a : les essais annulés n''ont rien laissé (messages, envois, demandes prises)',
    pg_temp.calcul($cd_q$select concat_ws('/', (select count(*) from public.demande_messages), (select count(*) from public.contact_envois),
      (select count(*) from public.demandes where etat = 'prise'))$cd_q$), v_avant);
end $cd_gd$;

-- Groupe reglages : qui reçoit quoi, réponses toutes faites, alertes.
create or replace function pg_temp.groupe_reglages()
returns void language plpgsql as $cd_gr$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l4 integer := (select lieu_id from public.promos where id = 7);
  f_sec_n text := pg_temp.fiche('sec_n');
  f_form_n text := pg_temp.fiche('form_n');
  s_n text := pg_temp.stag('stag_n');
  v_cpf text;
  v_regle text;
  c_apercu constant text := $cd_q$select (a ->> 'mode') || coalesce(' ' || (a -> 'principaux' -> 0 ->> 'fiche_id'), '')
    from (select public.apercu_envoi('absence', '[{"jour": "2031-03-12", "demi": "matin"}]') a) x$cd_q$;
  c_financer constant text := $cd_q$insert into public.stagiaires_prive (stagiaire_id, financement_id) values (%s, %s)
    on conflict (stagiaire_id) do update set financement_id = excluded.financement_id$cd_q$;
  v_av text;
  v_ap text;
  v_reg text;
begin
  perform set_config('preuve.maintenant', '2031-03-11 12:00:00 Europe/Paris', true);
  v_cpf := pg_temp.calcul(format($cd_q$select id::text from public.contact_financements where lieu_id = %s and libelle = 'CPF'$cd_q$, v_l1));
  v_regle := format('[{"type": "absence", "financement_id": %s, "cible": "fiche", "fiche_id": %s}]', v_cpf, f_sec_n);
  perform pg_temp.attendre('reglages', 'dir_n règle « absence, CPF : fiche sec_n » : OK (une règle)',
    pg_temp.appeler('dir_n', '1', format('select public.regler_qui_recoit_quoi(%s, %L)::text', v_l1, v_regle)) || ' / '
      || pg_temp.calcul(format('select string_agg(concat_ws('':'', type, financement_id, cible, fiche_id), '','') from public.contact_regles where lieu_id = %s', v_l1)),
    format('OK 1 / absence:%s:fiche:%s', v_cpf, f_sec_n));
  perform pg_temp.attendre('reglages', 'une fiche de Montpellier (form_m), un financement d''un autre centre, deux règles du même type et financement : refusés, rien ne change',
    concat_ws(' / ',
      pg_temp.appeler('dir_n', '1', format('select public.regler_qui_recoit_quoi(%s, %L)::text', v_l1,
        format('[{"type": "absence", "financement_id": null, "cible": "fiche", "fiche_id": %s}]', pg_temp.fiche('form_m')))),
      pg_temp.appeler('dir_n', '1', format('select public.regler_qui_recoit_quoi(%s, %L)::text', v_l1,
        format('[{"type": "absence", "financement_id": %s, "cible": "fiche", "fiche_id": %s}]',
          pg_temp.calcul(format($cd_q$select id::text from public.contact_financements where lieu_id = %s and libelle = 'CPF'$cd_q$, v_l4)), f_sec_n))),
      pg_temp.appeler('dir_n', '1', format('select public.regler_qui_recoit_quoi(%s, %L)::text', v_l1,
        format('[{"type": "retard", "cible": "formateurs_du_jour"}, {"type": "retard", "financement_id": null, "cible": "fiche", "fiche_id": %s}]', f_sec_n))),
      pg_temp.calcul(format('select count(*)::text from public.contact_regles where lieu_id = %s', v_l1))),
    concat_ws(' / ', 'ERREUR P0001 contact: Une règle ne vise qu''une personne de ce centre.',
      'ERREUR P0001 contact: Ce financement n''existe pas dans ce centre.',
      'ERREUR P0001 contact: Une seule règle par type et par financement.', '1'));
  perform pg_temp.attendre('reglages', 'form_n (sans les réglages du centre) : réglages refusés, lecture comprise',
    concat_ws(' / ', pg_temp.appeler('form_n', '1', format('select public.regler_qui_recoit_quoi(%s, %L)::text', v_l1, v_regle)),
      pg_temp.appeler('form_n', '1', format('select public.regler_reponses(%s, %L)::text', v_l1, '[]')),
      pg_temp.appeler('form_n', '1', format('select public.reglages_contact(%s)::text', v_l1))),
    concat_ws(' / ', 'ERREUR 42501 contact: Réservé aux réglages du centre.', 'ERREUR 42501 contact: Réservé aux réglages du centre.',
      'ERREUR 42501 contact: Réservé aux réglages du centre.'));
  perform pg_temp.attendre('reglages', 'reglages_contact(Nîmes) par dir_n : la règle, quatre réponses, sept financements, sec_n joignable parmi les fiches du centre, pas form_m',
    pg_temp.appeler('dir_n', '1', format($cd_q$select concat_ws(' ', jsonb_array_length(r -> 'regles'), r -> 'regles' -> 0 ->> 'fiche_id', jsonb_array_length(r -> 'reponses'),
      jsonb_array_length(r -> 'financements'),
      (select concat_ws(':', f ->> 'du_centre', f ->> 'joignable') from jsonb_array_elements(r -> 'fiches') f where (f ->> 'fiche_id')::bigint = %s),
      (select count(*) from jsonb_array_elements(r -> 'fiches') f where (f ->> 'fiche_id')::bigint = %s))
      from (select public.reglages_contact(%s) r) x$cd_q$, f_sec_n, pg_temp.fiche('form_m'), v_l1)),
    format('OK 1 %s 4 7 true:true 0', f_sec_n));
  -- L'aperçu d'un stagiaire CPF, puis sans financement.
  perform pg_temp.essai(format(c_financer, s_n, v_cpf));
  v_av := pg_temp.appeler('stag_n', '1', c_apercu);
  perform pg_temp.essai(format(c_financer, s_n, 'null'));
  perform pg_temp.attendre('reglages', 'apercu_envoi(absence) : stag_n en CPF, mode règle vers sec_n ; sans financement, mode choix',
    v_av || ' / ' || pg_temp.appeler('stag_n', '1', c_apercu), format('OK regle %s / OK choix', f_sec_n));
  -- La fiche sec_n supprimée (dans une sous-transaction annulée : la partie C s'en sert) : sa règle part avec elle.
  begin
    perform pg_temp.essai(format(c_financer, s_n, v_cpf));
    delete from public.contacts where id = f_sec_n::bigint;
    v_reg := pg_temp.calcul(format('select count(*)::text from public.contact_regles where lieu_id = %s', v_l1));
    v_ap := pg_temp.appeler('stag_n', '1', c_apercu);
    raise exception using errcode = 'P0001', message = 'ANNULE';
  exception when others then
    perform pg_temp.proprio();
    if sqlerrm <> 'ANNULE' then v_ap := 'pose impossible : ' || sqlstate || ' ' || sqlerrm; end if;
  end;
  perform pg_temp.attendre('reglages', 'la fiche sec_n supprimée : sa règle part avec elle, le stagiaire CPF repasse en choix',
    coalesce(v_reg, 'nul') || ' / ' || coalesce(v_ap, 'nul'), '0 / OK choix');
  -- Les réponses toutes faites.
  v_av := pg_temp.calcul(format('select string_agg(id::text, '','' order by ordre) from public.contact_reponses where lieu_id = %s', v_l1));
  perform pg_temp.attendre('reglages', 'regler_reponses par dir_n : la première renommée, une nouvelle, « Absence enregistrée » (utilisée) retirée, les deux autres supprimées',
    pg_temp.appeler('dir_n', '1', format('select public.regler_reponses(%s, %L)::text', v_l1,
      format('[{"id": %s, "libelle": "Bien reçu, merci", "vaut_prise": false}, {"libelle": "Vu", "demande_justificatif": true}]', split_part(v_av, ',', 1))))
      || ' / ' || pg_temp.calcul(format('select string_agg(concat_ws('':'', libelle, vaut_prise::text, demande_justificatif::text, retire::text), '','' order by retire, ordre, id) from public.contact_reponses where lieu_id = %s', v_l1)),
    'OK 2 / Bien reçu, merci:false:false:false,Vu:true:true:false,Absence enregistrée:true:false:true');
  perform pg_temp.attendre('reglages', 'regler_reponses : une réponse d''un autre centre, un libellé vide : refusés',
    pg_temp.appeler('dir_n', '1', format('select public.regler_reponses(%s, %L)::text', v_l1,
      format('[{"id": %s, "libelle": "Vu"}]', pg_temp.calcul(format('select min(id)::text from public.contact_reponses where lieu_id = %s', v_l4))))) || ' / '
      || pg_temp.appeler('dir_n', '1', format('select public.regler_reponses(%s, %L)::text', v_l1, '[{"libelle": "  "}]')),
    'ERREUR P0001 contact: Réponse toute faite inconnue. / ERREUR P0001 contact: Une réponse toute faite compte de 1 à 80 caractères.');
  -- Les alertes.
  v_av := pg_temp.appeler('form_n', '1', 'select public.regler_mes_alertes(false)::text');
  v_ap := pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_form_n, 'autre', 'Preuve9 alertes'));
  perform pg_temp.attendre('reglages', 'regler_mes_alertes(false) par form_n : l''envoi suivant vers lui naît « ignore », raison « alertes coupees »',
    v_av || ' / ' || pg_temp.envois_apres(pg_temp.id_rendu(v_ap), '0'), format('OK false / %s:nouvelle:ignore:alertes coupees', f_form_n));
  perform pg_temp.attendre('reglages', 'regler_mes_alertes(true) : rallumées ; anon refusé',
    pg_temp.appeler('form_n', '1', 'select public.regler_mes_alertes(true)::text') || ' / '
      || pg_temp.calcul(format('select bool_and(alertes_email)::text from public.user_profiles where email = %L', pg_temp.email_de('form_n'))) || ' / '
      || coalesce(pg_temp.valeur(null, '1', null, 'select public.regler_mes_alertes(false)::text'), 'nul'),
    'OK true / true / ERREUR 42501');
end $cd_gr$;

-- Groupe conservation : purge à l'écriture, changement de promo, départ d'un auteur de l'équipe, effacement sur demande.
create or replace function pg_temp.groupe_conservation()
returns void language plpgsql as $cd_gk$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  f_form_n text := pg_temp.fiche('form_n');
  f_dir_n text := pg_temp.fiche('dir_n');
  s_n text := pg_temp.stag('stag_n');
  c_vieille constant text := $cd_q$with d as (insert into public.demandes (lieu_id, promo_id, auteur_fiche_id, auteur_nom, sujet, cree_le, dernier_echange_le)
      values (%1$s, 1, %2$s, 'Preuve9 vieille', %4$L, timestamptz %5$L, timestamptz %5$L) returning id)
    insert into public.demande_destinataires (demande_id, fiche_id, nom, principal) select id, %3$s, 'dir_n', true from d$cd_q$;
  v_dx text;
  v_titre text;
  r1 text; r2 text; r3 text; r4 text;
  v_absence bigint;
  v_ids text;
begin
  perform set_config('preuve.maintenant', '2031-03-11 14:00:00 Europe/Paris', true);
  -- Purge (C-17) : 13 mois sans échange, partie à la création suivante ; 11 mois, gardée.
  perform pg_temp.essai(format(c_vieille, v_l1, f_form_n, f_dir_n, 'Preuve9 treize mois', '2030-02-10 10:00 Europe/Paris'));
  perform pg_temp.essai(format(c_vieille, v_l1, f_form_n, f_dir_n, 'Preuve9 onze mois', '2030-04-11 10:00 Europe/Paris'));
  perform pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve9 purge'));
  perform pg_temp.attendre('conservation', 'une demande d''équipe de 13 mois disparaît à la création suivante, une de 11 mois reste',
    pg_temp.calcul($cd_q$select concat_ws('/', (select count(*) from public.demandes where sujet = 'Preuve9 treize mois'),
      (select count(*) from public.demandes where sujet = 'Preuve9 onze mois'))$cd_q$), '0/1');
  -- stag_n passe dans la promo 2 : ses demandes restent celles de Nîmes, lues par dir_n et par lui.
  perform pg_temp.essai(format('update public.stagiaires set promo_id = 2 where id = %s', s_n));
  perform pg_temp.attendre('conservation', 'stag_n passé dans la promo 2 : d1 reste de Nîmes, lue par dir_n (principal) et par lui (auteur), ouverte par lui',
    concat_ws(' / ', pg_temp.calcul(format('select lieu_id::text from public.demandes where id = %s', pg_temp.dem('d1'))),
      pg_temp.appeler('dir_n', '1', format('select mon_role from public.liste_demandes() where id = %s', pg_temp.dem('d1'))),
      pg_temp.appeler('stag_n', '2', format('select mon_role from public.liste_demandes() where id = %s', pg_temp.dem('d1'))),
      pg_temp.appeler('stag_n', '2', format($cd_q$select public.demande_detail(%s) -> 'demande' ->> 'sujet'$cd_q$, pg_temp.dem('d1')))),
    format('%s / OK principal / OK auteur / OK Preuve9 lire', v_l1));
  perform pg_temp.essai(format('update public.stagiaires set promo_id = 1 where id = %s', s_n));
  -- La dernière affectation de form_n retirée (sous-transaction annulée) : sa fiche part, ses demandes restent, au nom gardé (E05).
  v_dx := pg_temp.id_rendu(pg_temp.appeler('form_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve9 avant départ')));
  v_titre := pg_temp.calcul(format('select string_agg(titre_id::text, '','') from public.affectations where lower(email) = %L', pg_temp.email_de('form_n')));
  begin
    r1 := pg_temp.appeler('fond', '1', format('select public.retirer_titre(%L, %s, %s) ->> ''retirees''', pg_temp.email_de('form_n'), v_titre, v_l1));
    r2 := pg_temp.calcul(format('select concat_ws(''|'', count(*), count(auteur_fiche_id), max(auteur_nom)) from public.demandes where id = %s', v_dx));
    r3 := pg_temp.calcul(format('select count(*)::text from public.contacts where id = %s', f_form_n));
    raise exception using errcode = 'P0001', message = 'ANNULE';
  exception when others then
    perform pg_temp.proprio();
    if sqlerrm <> 'ANNULE' then r1 := 'pose impossible : ' || sqlstate || ' ' || sqlerrm; end if;
  end;
  perform pg_temp.attendre('conservation', 'retirer_titre de la dernière affectation de form_n (après une demande à stag_n) : OK, sa fiche part, la demande reste, auteur_fiche_id nul, auteur_nom gardé',
    concat_ws(' / ', (v_titre ~ '^[0-9]+$')::text, r1, r2, r3),
    format('true / OK 1 / 1|0|%s / 0', pg_temp.calcul(format('select auteur_nom from public.demandes where id = %s', v_dx))));
  -- Effacement sur demande de stag_n (sous-transaction annulée) : une absence posée en propriétaire (la partie C les créera), avec un texte,
  -- une réponse, un envoi et un jeton.
  begin
    insert into public.demandes (lieu_id, promo_id, auteur_stagiaire_id, auteur_nom, type, sujet, texte)
      values (v_l1, 1, s_n::integer, 'Preuve7 stag_n PREUVE', 'absence', 'Absence', 'Preuve9 motif') returning id into v_absence;
    insert into public.demande_destinataires (demande_id, fiche_id, nom, principal) values (v_absence, f_dir_n::bigint, 'dir_n', true);
    insert into public.demande_messages (demande_id, auteur_nom, texte) values (v_absence, 'dir_n', 'Preuve9 réponse');
    insert into public.contact_envois (demande_id, vers_fiche_id, evenement) values (v_absence, f_dir_n::bigint, 'avis_absence');
    insert into public.contact_jetons (hash, envoi_id, demande_id, fiche_id, action, expire_le)
      select '\x0909'::bytea, max(id), v_absence, f_dir_n::bigint, 'voir', timestamptz '2031-03-25 10:00 Europe/Paris' from public.contact_envois where demande_id = v_absence;
    select string_agg(d.id::text, ',') into v_ids from public.demandes d
     where d.type is distinct from 'absence'
       and (d.auteur_stagiaire_id = s_n::integer or exists (select 1 from public.demande_destinataires x where x.demande_id = d.id and x.stagiaire_id = s_n::integer));
    r1 := pg_temp.calcul(format('select concat_ws(''|'', (count(*) > 2)::text, (select (count(*) > 0)::text from public.contact_envois where demande_id in (%1$s))) from public.demandes where id in (%1$s)', v_ids));
    r2 := pg_temp.appeler('fond', '1', format('select (public.effacer_sur_demande(%s) is not null)::text', s_n));
    r3 := pg_temp.calcul(format('select concat_ws(''|'', count(*), (select count(*) from public.contact_envois where demande_id in (%1$s)), (select count(*) from public.demande_destinataires where stagiaire_id = %2$s)) from public.demandes where id in (%1$s)', v_ids, s_n));
    r4 := pg_temp.calcul(format($cd_q$select concat_ws('|', count(*), max(coalesce(texte, 'aucun')), max(auteur_nom),
      (select count(*) from public.demande_messages where demande_id = %1$s), (select count(*) from public.contact_envois where demande_id = %1$s),
      (select count(*) from public.contact_jetons where demande_id = %1$s), (select count(*) from public.demande_destinataires where demande_id = %1$s))
      from public.demandes where id = %1$s$cd_q$, v_absence));
    raise exception using errcode = 'P0001', message = 'ANNULE';
  exception when others then
    perform pg_temp.proprio();
    if sqlerrm <> 'ANNULE' then r1 := 'pose impossible : ' || sqlstate || ' ' || sqlerrm; end if;
  end;
  perform pg_temp.attendre('conservation', 'effacer_sur_demande(stag_n) par le fondateur : ses demandes non absence (auteur ou destinataire) et leurs envois disparaissent',
    concat_ws(' / ', r1, r2, r3), 'true|true / OK true / 0|0|0');
  perform pg_temp.attendre('conservation', 'son absence reste : sans texte, sans réponse, sans envoi ni jeton, sans son nom ; son destinataire gardé',
    r4, '1|aucun|Stagiaire anonyme|0|0|0|1');
end $cd_gk$;

-- ===== Partie C (tâche 10) : la file des envois et les jetons des liens d'e-mail, appelés comme la fonction serveur contact-envois
-- (service_role, aucun jeton de session). Les jours : jeudi 12 et vendredi 13 mars 2031 à Paris. Hachés d'essai : 64 caractères
-- hexadécimaux fixes (la base ne voit jamais un jeton nu).

-- Un appel en service_role : la valeur jsonb rendue, ou {"erreur": "<état> <message>"}. Rend la main au propriétaire.
create or replace function pg_temp.srv(p_sql text)
returns jsonb language plpgsql as $cd_sv$
declare
  v jsonb;
begin
  perform pg_temp.proprio();
  set local role service_role;
  begin
    execute p_sql into v;
  exception when others then
    v := jsonb_build_object('erreur', sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.proprio();
  return coalesce(v, 'null'::jsonb);
end $cd_sv$;

-- Un appel en service_role d'une fonction sans valeur : « OK », ou « ERREUR <état> <message> ».
create or replace function pg_temp.srv_faire(p_sql text)
returns text language plpgsql as $cd_sf$
declare
  r text := 'OK';
begin
  perform pg_temp.proprio();
  set local role service_role;
  begin
    execute p_sql;
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $cd_sf$;

-- Les envois rendus par _contact_srv_prendre, triés (« 12,13 » ; vide : aucun ; autre chose qu'une liste : « pas une liste »).
create or replace function pg_temp.srv_ids(p jsonb)
returns text language sql as $cd_si$
  select case when jsonb_typeof(p) = 'array'
              then coalesce((select string_agg(x ->> 'envoi_id', ',' order by (x ->> 'envoi_id')::bigint) from jsonb_array_elements(p) x), '')
              else 'pas une liste ' || coalesce(p::text, 'nul') end;
$cd_si$;

-- L'élément de l'envoi p_envoi dans ce que rend _contact_srv_prendre (nul s'il n'y est pas).
create or replace function pg_temp.srv_item(p jsonb, p_envoi text)
returns jsonb language sql as $cd_it$
  select x from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) x where x ->> 'envoi_id' = p_envoi;
$cd_it$;

-- Les clés d'un objet jsonb, triées (« a,b,c »), ou « pas un objet ».
create or replace function pg_temp.cles_de(p jsonb)
returns text language sql as $cd_cl$
  select case when jsonb_typeof(p) = 'object' then (select string_agg(k, ',' order by k) from jsonb_object_keys(p) k) else 'pas un objet' end;
$cd_cl$;

-- Les libellés d'une liste de réponses toutes faites ([{id, libelle}]), dans l'ordre, ou « pas une liste ».
create or replace function pg_temp.libelles_de(p jsonb)
returns text language sql as $cd_lb$
  select case when jsonb_typeof(p) = 'array' then coalesce((select string_agg(x ->> 'libelle', ',' order by o) from jsonb_array_elements(p) with ordinality t(x, o)), '')
              else 'pas une liste' end;
$cd_lb$;

-- L'état d'un envoi : « etat|tentatives|raison|prochain essai (heure de Paris) ».
create or replace function pg_temp.etat_envoi(p_envoi text)
returns text language sql as $cd_ee$
  select pg_temp.calcul(format($cd_q$select concat_ws('|', etat, tentatives, coalesce(raison, 'aucune'),
      coalesce(to_char(prochain_essai_le at time zone 'Europe/Paris', 'HH24:MI'), 'aucun')) from public.contact_envois where id = %s$cd_q$, p_envoi));
$cd_ee$;

-- Groupe envois : la file (prendre, résultat, reprise), l'échec vu par l'équipe, la relance, l'adresse absente, les droits.
create or replace function pg_temp.groupe_envois()
returns void language plpgsql as $cd_gv$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  f_dir_n text := pg_temp.fiche('dir_n');
  c_vider constant text := $cd_q$update public.contact_envois set etat = 'envoye' where etat in ('a_envoyer', 'a_retenter', 'en_cours')$cd_q$;
  c_prendre constant text := 'select public._contact_srv_prendre(20)';
  v text;
  d text;
  e text;
  v_m text;
  r jsonb;
  it jsonb;
begin
  perform set_config('preuve.maintenant', '2031-03-12 10:00:00 Europe/Paris', true);
  perform pg_temp.essai(c_vider);
  v_m := pg_temp.dernier_envoi();
  v := pg_temp.poser_dem('v1', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, %L)::text', f_dir_n, 'retard',
         'Preuve10 sujet secret', 'Preuve10 texte secret')));
  perform pg_temp.verifier('envois', 'v1 : stag_n écrit (retard) à la fiche de dir_n', v ~ '^OK [0-9]+$', v);
  d := pg_temp.dem('v1');
  perform pg_temp.attendre('envois', 'la demande crée sa ligne d''envoi « à envoyer » vers dir_n', pg_temp.envois_apres(d, v_m),
    format('%s:nouvelle:a_envoyer', f_dir_n));
  e := pg_temp.calcul(format('select max(id)::text from public.contact_envois where demande_id = %s', d));

  r := pg_temp.srv(c_prendre);
  it := pg_temp.srv_item(r, e);
  perform pg_temp.attendre('envois', '_contact_srv_prendre : cet envoi seul, passé « en cours » (une tentative, repris à 10 h 10 s''il n''aboutit pas)',
    pg_temp.srv_ids(r) || ' ' || pg_temp.etat_envoi(e), e || ' en_cours|1|aucune|10:10');
  perform pg_temp.attendre('envois', 'l''élément : la demande sans sujet ni texte (id, type, auteur, jours, création), l''adresse du compte de dir_n, prise possible ; rien de « secret » dans tout le rendu',
    concat_ws('|', pg_temp.cles_de(it -> 'demande'), it ->> 'evenement', it -> 'demande' ->> 'type', it -> 'demande' ->> 'auteur_nom',
              coalesce(it -> 'demande' ->> 'jours', 'nul'), it -> 'destinataire' ->> 'email', it -> 'destinataire' ->> 'avec_compte',
              it -> 'destinataire' ->> 'stagiaire', it -> 'destinataire' ->> 'peut_prendre', (position('secret' in coalesce(r::text, 'secret')) = 0)::text),
    concat_ws('|', 'auteur_nom,cree_le,id,jours,type', 'nouvelle', 'retard',
              pg_temp.calcul(format('select auteur_nom from public.demandes where id = %s', d)), 'nul', lower(pg_temp.email_de('dir_n')),
              'true', 'false', 'true', 'true'));
  perform pg_temp.attendre('envois', 'l''élément : les réponses toutes faites actives du centre, dans l''ordre',
    pg_temp.libelles_de(it -> 'reponses'),
    pg_temp.calcul(format('select string_agg(libelle, '','' order by ordre, id) from public.contact_reponses where lieu_id = %s and not retire', v_l1)));
  perform pg_temp.attendre('envois', 'reprendre aussitôt : rien (l''envoi en cours n''est pas échu)', pg_temp.srv_ids(pg_temp.srv(c_prendre)), '');

  -- Premier échec : à retenter dans 5 minutes ; les jetons posés pour cet envoi partent.
  v := pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"%s","action":"voir"}]')$cd_q$, e, repeat('1f', 32)));
  v := v || ' ' || pg_temp.calcul(format('select count(*)::text from public.contact_jetons where envoi_id = %s', e));
  v := v || ' ' || pg_temp.srv_faire(format($cd_q$select public._contact_srv_resultat(%s, 'echec', 'Resend 500')$cd_q$, e));
  perform pg_temp.attendre('envois', 'un jeton posé, puis un premier échec : « à retenter » à 10 h 05, raison gardée, le jeton retiré',
    v || ' ' || pg_temp.etat_envoi(e) || ' ' || pg_temp.calcul(format('select count(*)::text from public.contact_jetons where envoi_id = %s', e)),
    'OK 1 OK a_retenter|1|Resend 500|10:05 0');
  perform set_config('preuve.maintenant', '2031-03-12 10:04:00 Europe/Paris', true);
  perform pg_temp.attendre('envois', 'à 10 h 04 : pas encore repris', pg_temp.srv_ids(pg_temp.srv(c_prendre)), '');
  perform set_config('preuve.maintenant', '2031-03-12 10:06:00 Europe/Paris', true);
  perform pg_temp.attendre('envois', 'à 10 h 06 : repris (deuxième tentative)', pg_temp.srv_ids(pg_temp.srv(c_prendre)) || ' ' || pg_temp.etat_envoi(e),
    e || ' en_cours|2|aucune|10:16');
  v := pg_temp.srv_faire(format($cd_q$select public._contact_srv_resultat(%s, 'echec', 'Resend 500')$cd_q$, e));
  perform pg_temp.attendre('envois', 'second échec : « échec », plus de nouvel essai', v || ' ' || pg_temp.etat_envoi(e), 'OK echec|2|Resend 500|aucun');
  perform pg_temp.attendre('envois', 'liste_demandes : envoi_en_echec vrai pour dir_n (équipe), nul pour stag_n',
    pg_temp.appeler('dir_n', '1', format('select envoi_en_echec::text from public.liste_demandes() where id = %s', d)) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select envoi_en_echec::text from public.liste_demandes() where id = %s', d)),
    'OK true / OK nul');
  perform pg_temp.attendre('envois', 'relancer_envoi par dir_n : « à envoyer », compteurs remis',
    pg_temp.appeler('dir_n', '1', format('select public.relancer_envoi(%s)::text', e)) || ' ' || pg_temp.etat_envoi(e), 'OK a_envoyer|0|aucune|aucun');

  -- Un envoi resté « en cours » plus de 10 minutes est repris, sa tentative comptée ; interrompu une deuxième fois, il passe en échec.
  perform set_config('preuve.maintenant', '2031-03-12 10:10:00 Europe/Paris', true);
  perform pg_temp.attendre('envois', 'à 10 h 10 : pris (en cours jusqu''à 10 h 20)', pg_temp.srv_ids(pg_temp.srv(c_prendre)) || ' ' || pg_temp.etat_envoi(e),
    e || ' en_cours|1|aucune|10:20');
  perform set_config('preuve.maintenant', '2031-03-12 10:21:00 Europe/Paris', true);
  perform pg_temp.attendre('envois', 'à 10 h 21 (11 minutes) : l''envoi en cours est repris, deuxième tentative',
    pg_temp.srv_ids(pg_temp.srv(c_prendre)) || ' ' || pg_temp.etat_envoi(e), e || ' en_cours|2|aucune|10:31');
  perform set_config('preuve.maintenant', '2031-03-12 10:32:00 Europe/Paris', true);
  perform pg_temp.attendre('envois', 'à 10 h 32 : interrompu une deuxième fois, il passe en échec sans être rendu',
    pg_temp.srv_ids(pg_temp.srv(c_prendre)) || ' ' || pg_temp.etat_envoi(e), ' echec|2|interrompu|aucun');

  -- Envoyé ; un résultat sur un envoi qui n'est plus en cours ne change rien.
  perform set_config('preuve.maintenant', '2031-03-12 10:40:00 Europe/Paris', true);
  v := pg_temp.poser_dem('v2', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'autre', 'Preuve10 envoyée')));
  e := pg_temp.calcul(format('select max(id)::text from public.contact_envois where demande_id = %s', pg_temp.dem('v2')));
  v := pg_temp.srv_ids(pg_temp.srv(c_prendre));
  v := v || ' ' || pg_temp.srv_faire(format($cd_q$select public._contact_srv_resultat(%s, 'envoye', null)$cd_q$, e));
  v := v || ' ' || pg_temp.srv_faire(format($cd_q$select public._contact_srv_resultat(%s, 'echec', 'trop tard')$cd_q$, e));
  perform pg_temp.attendre('envois', 'envoyé : « envoye » à l''heure, sans raison ; un échec rapporté ensuite ne change rien',
    v || ' ' || pg_temp.etat_envoi(e) || ' '
      || pg_temp.calcul(format($cd_q$select (envoye_le = timestamptz '2031-03-12 10:40 Europe/Paris')::text from public.contact_envois where id = %s$cd_q$, e)),
    e || ' OK OK envoye|1|aucune|aucun true');

  -- Ignoré (adresse fictive) avec une raison trop longue : 200 caractères gardés ; une issue inconnue est refusée.
  v := pg_temp.poser_dem('v3', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'autre', 'Preuve10 ignorée')));
  e := pg_temp.calcul(format('select max(id)::text from public.contact_envois where demande_id = %s', pg_temp.dem('v3')));
  v := pg_temp.srv_ids(pg_temp.srv(c_prendre));
  v := v || ' ' || substr(pg_temp.srv_faire(format($cd_q$select public._contact_srv_resultat(%s, 'perdu', null)$cd_q$, e)), 1, 60);
  v := v || ' ' || pg_temp.srv_faire(format($cd_q$select public._contact_srv_resultat(%s, 'ignore', repeat('x', 300))$cd_q$, e));
  perform pg_temp.attendre('envois', 'issue inconnue refusée ; « ignore » avec une raison de 300 caractères : 200 gardés',
    v || ' ' || pg_temp.calcul(format($cd_q$select concat_ws('|', etat, char_length(raison)) from public.contact_envois where id = %s$cd_q$, e)),
    e || ' ERREUR P0001 contact: Issue d''envoi illisible. OK ignore|200');

  -- Sans adresse : ignoré, jamais rendu.
  perform pg_temp.essai(format($cd_q$insert into public.contact_envois (demande_id, evenement, cree_le) values (%s, 'reponse', timestamptz '2031-03-12 10:45 Europe/Paris')$cd_q$, d));
  e := pg_temp.calcul(format('select max(id)::text from public.contact_envois where demande_id = %s', d));
  perform pg_temp.attendre('envois', 'un envoi vers personne (fiche supprimée) : « ignore », raison « sans adresse », non rendu',
    pg_temp.srv_ids(pg_temp.srv(c_prendre)) || ' ' || pg_temp.etat_envoi(e), ' ignore|0|sans adresse|aucun');

  -- Droits : service_role seul exécute les cinq fonctions de la fonction serveur ; ni l'API (authenticated, anon) ni service_role les aides.
  perform pg_temp.attendre('envois', 'authenticated (form_n) et anon : aucune des cinq fonctions _contact_srv_* ne s''exécute',
    concat_ws(' / ',
      pg_temp.valeur(pg_temp.email_de('form_n'), '1', null, 'select public._contact_srv_prendre(1)::text'),
      pg_temp.valeur(pg_temp.email_de('form_n'), '1', null, format('select public._contact_srv_jetons(%s, ''[]'')::text', e)),
      pg_temp.valeur(pg_temp.email_de('form_n'), '1', null, format('select public._contact_srv_resultat(%s, ''envoye'', null)::text', e)),
      pg_temp.valeur(pg_temp.email_de('form_n'), '1', null, format('select public._contact_srv_lien(%L)::text', repeat('0', 64))),
      pg_temp.valeur(pg_temp.email_de('form_n'), '1', null, format('select public._contact_srv_agir(%L)::text', repeat('0', 64))),
      pg_temp.valeur(null, '1', null, 'select public._contact_srv_prendre(1)::text'),
      pg_temp.valeur(null, '1', null, format('select public._contact_srv_jetons(%s, ''[]'')::text', e)),
      pg_temp.valeur(null, '1', null, format('select public._contact_srv_resultat(%s, ''envoye'', null)::text', e)),
      pg_temp.valeur(null, '1', null, format('select public._contact_srv_lien(%L)::text', repeat('0', 64))),
      pg_temp.valeur(null, '1', null, format('select public._contact_srv_agir(%L)::text', repeat('0', 64)))),
    'ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501 / ERREUR 42501');
  perform pg_temp.attendre('envois', 'service_role : les aides (_contact_srv_jeton, _contact_appliquer_prise, _contact_appliquer_reponse) refusées',
    concat_ws(' / ',
      substr(pg_temp.srv_faire(format('select public._contact_srv_jeton(%L)', repeat('0', 64))), 1, 12),
      substr(pg_temp.srv_faire(format('select public._contact_appliquer_prise(%s, %L, true)', d, 'Preuve')), 1, 12),
      substr(pg_temp.srv_faire(format('select public._contact_appliquer_reponse(%s, %s, null, %L, null, %L, null, true)', d, f_dir_n, 'Preuve', 'Preuve')), 1, 12)),
    'ERREUR 42501 / ERREUR 42501 / ERREUR 42501');
end $cd_gv$;

-- Groupe jetons : les jetons d'un envoi, le lien (lecture seule), le geste (prise, réponse toute faite) une seule fois, au nom de la fiche
-- du jeton ; voir, justificatif, jeton expiré, jeton d'une autre demande.
create or replace function pg_temp.groupe_jetons()
returns void language plpgsql as $cd_gt$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  f_dir_n text := pg_temp.fiche('dir_n');
  f_form_n text := pg_temp.fiche('form_n');
  s_n text := pg_temp.stag('stag_n');
  c_vider constant text := $cd_q$update public.contact_envois set etat = 'envoye' where etat in ('a_envoyer', 'a_retenter', 'en_cours')$cd_q$;
  c_prendre constant text := 'select public._contact_srv_prendre(20)';
  h_voir constant text := repeat('a1', 32);
  h_prise constant text := repeat('b2', 32);
  h_rep constant text := repeat('c3', 32);
  h_autre constant text := repeat('d4', 32);
  h_vieux constant text := repeat('e5', 32);
  h_justif constant text := repeat('f6', 32);
  v_rep text;
  v_nom_dir text;
  da text;
  db text;
  dc text;
  e_dir text;
  e_s text;
  v text;
  v_m text;
  r jsonb;
  it jsonb;
begin
  perform set_config('preuve.maintenant', '2031-03-13 10:00:00 Europe/Paris', true);
  perform pg_temp.essai(format('delete from public.contact_regles where lieu_id = %s', v_l1));
  perform pg_temp.essai(c_vider);
  v_rep := pg_temp.calcul(format('select id::text from public.contact_reponses where lieu_id = %s and not retire order by ordre, id limit 1', v_l1));
  v := pg_temp.poser_dem('ja', pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_centre(%L, %L, %L, array[%s, %s]::bigint[])::text',
         'retard', 'Preuve10 sujet du lien', 'Preuve10 texte du lien', f_form_n, f_dir_n)));
  perform pg_temp.verifier('jetons', 'ja : stag_n écrit (retard) à form_n et dir_n, qu''il choisit', v ~ '^OK [0-9]+$', v);
  da := pg_temp.dem('ja');
  v := pg_temp.poser_dem('jb', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'autre', 'Preuve10 autre demande')));
  db := pg_temp.dem('jb');
  v := pg_temp.poser_dem('jc', pg_temp.appeler('stag_n', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'document', 'Preuve10 vieillie')));
  dc := pg_temp.dem('jc');
  v_nom_dir := pg_temp.calcul(format('select nom from public.demande_destinataires where demande_id = %s and fiche_id = %s', da, f_dir_n));
  r := pg_temp.srv(c_prendre);
  perform pg_temp.attendre('jetons', 'les quatre envois « nouvelle » (ja vers form_n et dir_n, jb, jc) pris ensemble', pg_temp.srv_ids(r),
    pg_temp.calcul(format('select string_agg(id::text, '','' order by id) from public.contact_envois where demande_id in (%s, %s, %s)', da, db, dc)));
  e_dir := pg_temp.calcul(format('select id::text from public.contact_envois where demande_id = %s and vers_fiche_id = %s', da, f_dir_n));

  -- Les jetons.
  v := pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"%s","action":"voir"},{"hash":"%s","action":"prise"},{"hash":"%s","action":"reponse","reponse_id":%s}]')$cd_q$,
         e_dir, h_voir, h_prise, h_rep, v_rep));
  perform pg_temp.attendre('jetons', 'trois jetons sur l''envoi de dir_n : hachés (32 octets), sa fiche, sa demande, valables jusqu''au 27 mars, inutilisés',
    v || ' ' || pg_temp.calcul(format($cd_q$select concat_ws('|', count(*), string_agg(action, ',' order by action),
        bool_and(fiche_id = %s and demande_id = %s and expire_le = timestamptz '2031-03-27 10:00 Europe/Paris' and utilise_le is null)::text,
        bool_and(octet_length(hash) = 32)::text) from public.contact_jetons where envoi_id = %s$cd_q$, f_dir_n, da, e_dir)),
    'OK 3|prise,reponse,voir|true|true');
  perform pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"%s","action":"prise"}]')$cd_q$,
    pg_temp.calcul(format('select id::text from public.contact_envois where demande_id = %s', db)), h_autre));
  perform pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"%s","action":"prise"},{"hash":"%s","action":"justificatif"}]')$cd_q$,
    pg_temp.calcul(format('select id::text from public.contact_envois where demande_id = %s', dc)), h_vieux, h_justif));
  perform pg_temp.attendre('jetons', 'jetons illisibles refusés (haché court, réponse sans réponse toute faite, action inconnue) ; rien de plus en base',
    concat_ws(' / ',
      substr(pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"abc","action":"voir"}]')$cd_q$, e_dir)), 1, 12),
      substr(pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"%s","action":"reponse"}]')$cd_q$, e_dir, repeat('9', 64))), 1, 12),
      substr(pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"%s","action":"tout"}]')$cd_q$, e_dir, repeat('9', 64))), 1, 12),
      pg_temp.calcul(format('select count(*)::text from public.contact_jetons where demande_id in (%s, %s, %s)', da, db, dc))),
    'ERREUR P0001 / ERREUR P0001 / ERREUR P0001 / 6');

  -- Le lien : il montre la demande (sujet et texte) et n'écrit rien.
  r := pg_temp.srv(format('select public._contact_srv_lien(%L)', h_prise));
  perform pg_temp.attendre('jetons', '_contact_srv_lien (prise) : sujet et texte de ja, envoyée, action prise, pas encore faite ; aucun message, aucun envoi écrit',
    concat_ws('|', r -> 'demande' ->> 'sujet', r -> 'demande' ->> 'texte', r -> 'demande' ->> 'etat', r ->> 'action', r ->> 'deja',
              pg_temp.calcul(format('select count(*)::text from public.demande_messages where demande_id = %s', da)),
              pg_temp.calcul(format('select count(*)::text from public.contact_envois where demande_id = %s and evenement <> ''nouvelle''', da))),
    'Preuve10 sujet du lien|Preuve10 texte du lien|envoyee|prise|false|0|0');
  r := pg_temp.srv(format('select public._contact_srv_lien(%L)', h_rep));
  perform pg_temp.attendre('jetons', '_contact_srv_lien (réponse) : action reponse, libellé de la réponse toute faite',
    concat_ws('|', r ->> 'action', r ->> 'libelle_reponse', r ->> 'deja'),
    concat_ws('|', 'reponse', pg_temp.calcul(format('select libelle from public.contact_reponses where id = %s', v_rep)), 'false'));
  perform pg_temp.attendre('jetons', '_contact_srv_lien : un haché illisible ou inconnu est invalide',
    pg_temp.srv(format('select public._contact_srv_lien(%L)', 'zz'))::text || ' ' || pg_temp.srv(format('select public._contact_srv_lien(%L)', repeat('0', 64)))::text,
    '{"invalide": true} {"invalide": true}');

  -- Un jeton d'une autre demande ne touche pas celle-ci.
  r := pg_temp.srv(format('select public._contact_srv_agir(%L)', h_autre));
  perform pg_temp.attendre('jetons', 'le jeton de jb : fait sur jb seule ; ja reste envoyée, sans message',
    concat_ws('|', r::text, pg_temp.calcul(format('select etat from public.demandes where id = %s', db)),
              pg_temp.calcul(format('select etat from public.demandes where id = %s', da)),
              pg_temp.calcul(format('select count(*)::text from public.demande_messages where demande_id = %s', da))),
    '{"fait": true}|prise|envoyee|0');

  -- La prise par lien, une seule fois.
  v_m := pg_temp.dernier_envoi();
  r := pg_temp.srv(format('select public._contact_srv_agir(%L)', h_prise));
  perform pg_temp.attendre('jetons', '_contact_srv_agir (prise) : fait ; ja prise à l''heure au nom de dir_n ; un message « Prise en compte. » par lien à son nom ; un envoi « prise » vers stag_n',
    concat_ws(' ', r::text,
      pg_temp.calcul(format($cd_q$select concat_ws('|', etat, (prise_par = %L)::text, (prise_le = timestamptz '2031-03-13 10:00 Europe/Paris')::text)
        from public.demandes where id = %s$cd_q$, v_nom_dir, da)),
      pg_temp.calcul(format($cd_q$select concat_ws('|', count(*), string_agg(texte, ','), bool_and(par_lien)::text, bool_and(reponse_id is null)::text, bool_and(auteur_nom = %L)::text)
        from public.demande_messages where demande_id = %s$cd_q$, v_nom_dir, da)),
      pg_temp.envois_apres(da, v_m),
      pg_temp.calcul(format('select (utilise_le is not null)::text from public.contact_jetons where hash = decode(%L, ''hex'')', h_prise))),
    format('{"fait": true} prise|true|true 1|Prise en compte.|true|true|true s%s:prise:a_envoyer true', s_n));
  v_m := pg_temp.dernier_envoi();
  r := pg_temp.srv(format('select public._contact_srv_agir(%L)', h_prise));
  perform pg_temp.attendre('jetons', 'le même lien touché une seconde fois : déjà fait, aucune ligne de plus',
    concat_ws('|', r::text, pg_temp.calcul(format('select count(*)::text from public.demande_messages where demande_id = %s', da)),
              pg_temp.envois_apres(da, v_m)),
    '{"deja": true}|1|');
  perform pg_temp.attendre('jetons', 'son lien le dit déjà fait', pg_temp.srv(format('select public._contact_srv_lien(%L)', h_prise)) ->> 'deja', 'true');

  -- L'avis de prise à stag_n : un stagiaire n'a ni réponse toute faite, ni prise, ni jeton (C-12).
  r := pg_temp.srv(c_prendre);
  e_s := pg_temp.calcul(format('select id::text from public.contact_envois where demande_id = %s and vers_stagiaire_id = %s and evenement = ''prise''', da, s_n));
  it := pg_temp.srv_item(r, e_s);
  perform pg_temp.attendre('jetons', 'l''avis de prise vers stag_n : l''adresse de son profil, stagiaire, aucune réponse toute faite, pas de prise ; aucun jeton possible',
    concat_ws('|', it ->> 'evenement', it -> 'destinataire' ->> 'email', it -> 'destinataire' ->> 'stagiaire', it -> 'destinataire' ->> 'peut_prendre',
              coalesce((it -> 'reponses')::text, 'nul'),
              pg_temp.srv_faire(format($cd_q$select public._contact_srv_jetons(%s, '[{"hash":"%s","action":"voir"}]')$cd_q$, e_s, repeat('7', 64)))),
    concat_ws('|', 'prise', lower(pg_temp.email_de('stag_n')), 'true', 'false', '[]', 'ERREUR P0001 contact: Cet envoi ne reçoit pas de jeton.'));

  -- La réponse toute faite par lien : le message, « non lue » pour form_n, les envois aux autres participants.
  perform pg_temp.appeler('form_n', '1', format('select public.marquer_lue(%s)::text', da));
  perform pg_temp.attendre('jetons', 'form_n a lu ja', pg_temp.calcul(format('select count(*)::text from public.demande_destinataires where demande_id = %s and lue_le is not null', da)), '1');
  v_m := pg_temp.dernier_envoi();
  r := pg_temp.srv(format('select public._contact_srv_agir(%L)', h_rep));
  perform pg_temp.attendre('jetons', '_contact_srv_agir (réponse) : fait ; le message porte la réponse toute faite, par lien, au nom de dir_n ; lue_le de form_n remis à nul ; une « réponse » à form_n et à stag_n',
    concat_ws(' ', r::text,
      pg_temp.calcul(format($cd_q$select concat_ws('|', reponse_id, coalesce(texte, 'aucun'), par_lien::text, (auteur_nom = %L)::text)
        from public.demande_messages where demande_id = %s order by id desc limit 1$cd_q$, v_nom_dir, da)),
      pg_temp.calcul(format('select count(*)::text from public.demande_destinataires where demande_id = %s and lue_le is not null', da)),
      pg_temp.envois_apres(da, v_m)),
    format('{"fait": true} %s|aucun|true|true 0 %s:reponse:a_envoyer,s%s:reponse:a_envoyer', v_rep, f_form_n, s_n));
  r := pg_temp.srv(format('select public._contact_srv_agir(%L)', h_rep));
  perform pg_temp.attendre('jetons', 'la même réponse touchée une seconde fois : déjà faite, aucun message de plus',
    r::text || ' ' || pg_temp.calcul(format('select count(*)::text from public.demande_messages where demande_id = %s', da)), '{"deja": true} 2');

  -- voir et justificatif n'agissent pas ; un jeton expiré n'ouvre ni n'agit.
  r := pg_temp.srv(format('select public._contact_srv_lien(%L)', h_voir));
  perform pg_temp.attendre('jetons', 'jeton voir : le lien s''ouvre (action voir), agir est invalide ; jeton justificatif (avant la migration 3) : invalide, jc reste envoyée',
    concat_ws('|', r ->> 'action', r ->> 'deja', pg_temp.srv(format('select public._contact_srv_agir(%L)', h_voir))::text,
              pg_temp.srv(format('select public._contact_srv_agir(%L)', h_justif))::text,
              pg_temp.calcul(format('select etat from public.demandes where id = %s', dc))),
    'voir|false|{"invalide": true}|{"invalide": true}|envoyee');
  perform set_config('preuve.maintenant', '2031-03-28 10:00:00 Europe/Paris', true);
  perform pg_temp.attendre('jetons', 'quinze jours plus tard : le jeton de prise de jc est invalide au lien comme au geste ; jc reste envoyée ; le lien voir de ja aussi',
    concat_ws('|', pg_temp.srv(format('select public._contact_srv_lien(%L)', h_vieux))::text,
              pg_temp.srv(format('select public._contact_srv_agir(%L)', h_vieux))::text,
              pg_temp.calcul(format('select etat from public.demandes where id = %s', dc)),
              pg_temp.srv(format('select public._contact_srv_lien(%L)', h_voir))::text),
    '{"invalide": true}|{"invalide": true}|envoyee|{"invalide": true}');
end $cd_gt$;

-- Un groupe se joue-t-il dans ce mode ? Contre-épreuve : toujours (il doit être rouge). En ligne : seulement si p_condition (la
-- migration qui le fonde est appliquée), sinon une ligne d'information. Migrations injectées : toujours.
create or replace function pg_temp.groupe_a_jouer(p_groupe text, p_mode text, p_condition boolean, p_raison text)
returns boolean language plpgsql as $cd_gj$
begin
  if p_mode like 'contact-2-en-ligne%' and not coalesce(p_condition, false) then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : ' || p_raison || ' (mode en ligne)');
    return false;
  end if;
  return true;
end $cd_gj$;

do $tpc2$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  c_cas constant jsonb :=
-- @@CAS_ROUTAGE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_etat1 text; v_etat1b text; v_etat2 text; v_retour2 text; v_retour1b text; v_retour1 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_jouees integer;
  v_partie_a boolean;
  v_partie_b boolean;
  v_partie_c boolean;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'contact-2-en-ligne%';

  -- 1. Avant les migrations : l'empreinte de la base, puis les prérequis de l'état de départ (la production du 14/11).
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  perform pg_temp.verifier('structure', 'prérequis : geste_promo(integer, text) existe (titres, migration 2)',
    to_regprocedure('public.geste_promo(integer, text)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : retirer_titre(text, bigint, integer) existe (titres, migration 5)',
    to_regprocedure('public.retirer_titre(text, bigint, integer)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : donner_titre(text, bigint, integer, integer[], integer) existe (titres, migration 6)',
    to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : contacts.lieu_id existe (20261113_contacts_centre)',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id'));

  -- 2. Les personnages, posés AVANT les migrations (comme les comptes de la production) : ceux du lot 4, des titres et la fiche sec_n.
  perform pg_temp.poser_contact();
  perform pg_temp.attendre('structure', 'les personnages sont posés (16 du lot 4, 5 des titres, la fiche sans compte sec_n)',
    pg_temp.calcul($q$select concat_ws('/',
      (select count(*) from perso where ordre between 1 and 16)::text,
      (select count(*) from perso where ordre between 20 and 24)::text,
      (select count(*) from perso p join public.contacts c on c.id = p.info::bigint
         where p.nom = 'sec_n' and c.email = 'preuve.sec@exemple.invalid' and c.prenom = 'Preuve Secrétariat'
           and c.lieu_id = (select lieu_id from public.promos where id = 1))::text)$q$),
    '16/5/1');

  -- 3. Les migrations, dans l'ordre d'application (neutralisées dans les modes sans elles).
  v_etat1 := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261115_contact_1_annuaire.sql@@
  );
  perform pg_temp.etape('migration 1', v_etat1, v_mode);
  v_etat1b := pg_temp.jouer('migration 1b',
-- @@INJECTER supabase/migrations/20261115_contact_1b_fermeture.sql@@
  );
  perform pg_temp.etape('migration 1b', v_etat1b, v_mode);
  v_etat2 := pg_temp.jouer('migration 2',
-- @@INJECTER supabase/migrations/20261115_contact_2_demandes.sql@@
  );
  perform pg_temp.etape('migration 2', v_etat2, v_mode);

  -- 4. GROUPES de contrôles de la partie 2, chacun sauté avec une ligne d'information quand la migration qui le fonde n'est pas encore
  --    appliquée (mode en ligne) ; dans la contre-épreuve, ils se jouent et doivent être rouges.
  perform pg_temp.poser_cles();
  -- L'horloge de la preuve (C-21) : _contact_maintenant() lit preuve.maintenant (annulé avec le reste).
  if to_regprocedure('public._contact_maintenant()') is not null then
    execute $q$create or replace function public._contact_maintenant() returns timestamptz language sql stable security definer
      set search_path = public, pg_temp as 'select coalesce(nullif(current_setting(''preuve.maintenant'', true), '''')::timestamptz, now())'$q$;
  end if;
  v_partie_a := to_regprocedure('public.ecrire_au_centre(text, text, text, bigint[])') is not null;
  -- 4a. Partie A (tâche 8) : routage et création.
  if pg_temp.groupe_a_jouer('parite', v_mode, v_partie_a, 'la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_parite(c_cas);
  end if;
  if pg_temp.groupe_a_jouer('creer', v_mode, v_partie_a, 'la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_creer();
  end if;
  if pg_temp.groupe_a_jouer('garde_fous', v_mode, v_partie_a, 'la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_garde_fous();
  end if;
  -- 4b. Partie B (tâche 9) : lire, états, réglages, conservation.
  v_partie_b := to_regprocedure('public.liste_demandes(integer)') is not null;
  if pg_temp.groupe_a_jouer('lire', v_mode, v_partie_b, 'la partie B de la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_lire();
  end if;
  if pg_temp.groupe_a_jouer('etats', v_mode, v_partie_b, 'la partie B de la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_etats();
  end if;
  if pg_temp.groupe_a_jouer('reglages', v_mode, v_partie_b, 'la partie B de la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_reglages();
  end if;
  if pg_temp.groupe_a_jouer('conservation', v_mode, v_partie_b, 'la partie B de la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_conservation();
  end if;
  -- 4c. Partie C (tâche 10) : la file des envois et les jetons, appelés en service_role.
  v_partie_c := to_regprocedure('public._contact_srv_prendre(integer)') is not null;
  if pg_temp.groupe_a_jouer('envois', v_mode, v_partie_c, 'la partie C de la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_envois();
  end if;
  if pg_temp.groupe_a_jouer('jetons', v_mode, v_partie_c, 'la partie C de la migration 2 n''est pas appliquée') then
    perform pg_temp.groupe_jetons();
  end if;
  perform set_config('preuve.maintenant', '', true);

  -- 5. Les retours, dans l'ordre inverse (2, 1b, 1).
  v_retour2 := pg_temp.jouer('retour 2',
-- @@INJECTER supabase/migrations/20261115_contact_2_demandes_retour.sql@@
  );
  perform pg_temp.etape('retour 2', v_retour2, v_mode);
  v_retour1b := pg_temp.jouer('retour 1b',
-- @@INJECTER supabase/migrations/20261115_contact_1b_fermeture_retour.sql@@
  );
  perform pg_temp.etape('retour 1b', v_retour1b, v_mode);
  v_retour1 := pg_temp.jouer('retour 1',
-- @@INJECTER supabase/migrations/20261115_contact_1_annuaire_retour.sql@@
  );
  perform pg_temp.etape('retour 1', v_retour1, v_mode);
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  v_jouees := (v_etat1 = 'jouée')::integer + (v_etat2 = 'jouée')::integer;
  if v_en_ligne or v_jouees = 0 then
    perform pg_temp.informer('retours', format('non jugeables (aucune migration injectée, ou déjà appliquées) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tpc2$;
