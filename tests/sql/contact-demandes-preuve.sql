-- Preuve de la partie 2 du chantier « espace contact » : les demandes, leurs réponses et les envois d'e-mail. Écrite avec les migrations
-- 20261115_contact_1_annuaire, 20261115_contact_2_demandes, jouée sur une base où l'état de la production est rejoué
-- (outils/base_locale : reconstruire.sh, puis rejouer_suite.sh --titres 1,2,3,5,6 --autonomie --autonomie-version 2026-11-14).
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
-- Les groupes des parties B et C s'ajoutent avec leurs tâches, entre les migrations et les retours (repère « 4. GROUPES » plus bas).
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
    perform pg_temp.attendre('parite', 'cas ' || (c ->> 'nom'), pg_temp.jouer_cas(c)::text, (c -> 'attendu')::text);
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
  perform pg_temp.attendre('garde_fous', 'stag_n vers un stagiaire (ecrire_au_stagiaire, stag_m et lui-même) : refusé',
    pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', pg_temp.stag('stag_m'), 'Preuve')) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', s_n, 'Preuve')),
    'ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez. / ERREUR 42501 contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez.');
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
  perform set_config('preuve.maintenant', '', true);
  -- 4b. Partie B (tâche 9) : à ajouter ici.
  -- 4c. Partie C (tâche 10) : à ajouter ici.

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
