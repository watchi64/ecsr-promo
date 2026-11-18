-- Espace contact, migration 5 (tâche 5C) : données sensibles, décision de Timy du 18/11 (« Oui, toutes »), après les migrations 1, 2, 3,
-- _demo et 4 (appliquées en production, gelées). Spec : docs/superpowers/specs/2026-11-09-espace-contact-design.md (§ 9, amendement du
-- 18/11) ; textes : docs/superpowers/plans/2026-11-14-espace-contact-textes-donnees.md.
--   1. « Santé » quitte la liste des motifs d'une absence, remplacé par « Raison personnelle » : transport, demarche, famille, personnel,
--      autre (dans cet ordre). La contrainte absences_annoncees_motif est refaite avec ces cinq codes ; prevenir_absence() (texte de la
--      migration 4) les accepte et dit « Choisis un motif : transport, démarche, famille, raison personnelle ou autre. »
--   2. La page du lien d'e-mail (sans connexion) : _contact_srv_lien() (texte de la migration 3) ne rend plus, pour une demande de type
--      absence, ni le motif, ni le mot, ni le texte, ni les messages ; les jours, le moment, l'état, l'auteur et ce qu'il faut pour agir
--      (action, réponse toute faite, déjà fait) restent. Le détail se lit dans l'app, après connexion : une fiche de l'équipe sans compte
--      ne lit donc jamais le motif (conséquence acceptée par Timy). Les autres types de demande ne changent pas (ruling R-5Ca).
--   3. Le motif est effacé à l'étape 1 de l'effacement d'un stagiaire (fin de formation + 12 mois, ou effacement sur demande), avec le
--      mot : _contact_effacer_stagiaire() (texte de la migration 4) le met à nul. Le déclencheur d'anonymisation de la migration 3
--      (_contact_anonymiser_stagiaire, étape 2) reste : il ne trouve plus de motif à effacer.
-- Trois fonctions redéfinies par create or replace, signatures et colonnes de sortie inchangées, droits gardés ; chacune part du texte de son
-- dernier fichier de définition (migration 3 ou 4), seules les lignes du changement diffèrent. Aucune fonction, table ni règle nouvelle.
-- Garde : les migrations 1, 2, 3, _demo et 4 sont appliquées, la 5 ne l'est pas (contrainte des motifs au texte de la migration 3), les
-- trois fonctions existent avec leur signature, aucune absence ne porte le motif « sante » ; sinon rien ne change. La table des absences est
-- verrouillée en écriture dès la garde : aucune absence « sante » ne peut arriver entre le contrôle et la nouvelle contrainte.
-- MISE EN LIGNE : appliquer cette migration AVANT de déployer la fonction serveur contact-envois (sans elle, le lien « Voir la demande »
-- d'une absence ouvrirait le motif et le mot sans connexion) et AVANT la recette de l'espace contact.
-- Marche arrière : 20261118_contact_5_donnees_sensibles_retour.sql. Ordre des retours : 5, 4, _demo, 3, 2, 1b, 1. Le retour 4 est gelé et
-- ne vérifie pas la 5 : jouer le retour 5 d'abord (sinon prevenir_absence reprendrait la liste avec « sante », que la contrainte refuse).
set local lock_timeout = '3s';

do $garde$
declare
  v_sig text;
  n integer;
begin
  if to_regclass('public.absences_annoncees') is null
     or to_regprocedure('public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[])') is null then
    raise exception 'contact_5 : la migration 3 (20261115_contact_3_absences.sql) n''est pas appliquée ; rien n''est changé';
  end if;
  if to_regprocedure('public.ecrire_au_centre(text, text, text, bigint[])') is null or to_regprocedure('public.annuaire_centre()') is null then
    raise exception 'contact_5 : la migration 1 ou 2 n''est pas appliquée ; rien n''est changé';
  end if;
  if not exists (select 1 from public.contacts c where 'Responsable pédagogique (fictif)' in (c.prenom, c.nom, c.role)) then
    raise exception 'contact_5 : la migration _demo (20261115_contact_demo.sql) n''est pas appliquée ; rien n''est changé';
  end if;
  if to_regprocedure('public._contact_quota_equipe(bigint)') is null then
    raise exception 'contact_5 : la migration 4 (20261116_contact_4_correctifs.sql) n''est pas appliquée ; rien n''est changé';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public.absences_annoncees'::regclass and c.conname = 'absences_annoncees_motif') like '%''personnel''%' then
    raise exception 'contact_5 : la contrainte absences_annoncees_motif admet déjà « personnel », migration déjà appliquée ? rien n''est changé';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public.absences_annoncees'::regclass and c.conname = 'absences_annoncees_motif')
     is distinct from 'CHECK ((motif = ANY (ARRAY[''sante''::text, ''transport''::text, ''demarche''::text, ''famille''::text, ''autre''::text])))' then
    raise exception 'contact_5 : la contrainte absences_annoncees_motif n''a pas son texte de la migration 3 ; rien n''est changé';
  end if;
  foreach v_sig in array array[
      'public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[])',
      'public._contact_srv_lien(text)',
      'public._contact_effacer_stagiaire()'] loop
    if to_regprocedure(v_sig) is null then
      raise exception 'contact_5 : la fonction % manque (signature changée ?) ; rien n''est changé', v_sig;
    end if;
  end loop;
  lock table public.absences_annoncees in exclusive mode;
  select count(*) into n from public.absences_annoncees where motif = 'sante';
  if n > 0 then
    raise exception 'contact_5 : % absence(s) portent encore le motif « sante » : décider avec Timy de leur nouveau motif (par exemple update public.absences_annoncees set motif = ''personnel'' where motif = ''sante'', dans la même transaction, avant cette migration), puis la rejouer ; rien n''est changé', n;
  end if;
end $garde$;

-- 1. Les motifs : « santé » retiré, « raison personnelle » (personnel) ajouté, avant « autre ».
alter table public.absences_annoncees drop constraint absences_annoncees_motif;
alter table public.absences_annoncees add constraint absences_annoncees_motif
  check (motif in ('transport', 'demarche', 'famille', 'personnel', 'autre'));

-- 1. prevenir_absence() : la nouvelle liste et sa phrase (le reste est le texte de la migration 4).
create or replace function public.prevenir_absence(p_du date, p_au date, p_quand text, p_debut text, p_fin text, p_motif text, p_mot text,
                                        p_sans text[] default '{}', p_choisis bigint[] default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  v_au date := coalesce(p_au, p_du);
  v_debut text;
  v_fin text;
  v_mot text;
  v_sans text[];
  v_p integer;
  v_l integer;
  v_j jsonb;
  v_dest jsonb;
  v_possibles jsonb;
  v_id bigint;
  x record;
begin
  if s is null then
    raise exception 'contact: Réservé aux stagiaires.' using errcode = '42501';
  end if;
  if p_du is null then
    raise exception 'contact: Choisis le jour de ton absence.';
  end if;
  if p_du < _contact_jour() then
    raise exception 'contact: Une absence passée se règle avec l''équipe.';
  end if;
  if p_du > _contact_jour() + 120 then
    raise exception 'contact: Une absence se prévient au plus tôt 120 jours à l''avance.';
  end if;
  if v_au < p_du then
    raise exception 'contact: Le dernier jour de ton absence précède le premier.';
  end if;
  if v_au - p_du > 30 then
    raise exception 'contact: Une absence annoncée couvre 31 jours au plus : au-delà, vois avec l''équipe.';
  end if;
  if p_quand is null or p_quand not in ('journee', 'matin', 'aprem', 'heures') then
    raise exception 'contact: Choisis quand : la journée, le matin, l''après-midi ou de telle heure à telle heure.';
  end if;
  if p_quand = 'heures' then
    if v_au <> p_du then
      raise exception 'contact: Une absence de quelques heures tient dans une seule journée.';
    end if;
    v_debut := btrim(p_debut);
    v_fin := btrim(p_fin);
    if coalesce(v_debut, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(v_fin, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or v_debut >= v_fin then
      raise exception 'contact: Indique l''heure de début et l''heure de fin (par exemple 10:00 et 11:00), le début avant la fin.';
    end if;
  end if;
  if p_motif is null or p_motif not in ('transport', 'demarche', 'famille', 'personnel', 'autre') then
    raise exception 'contact: Choisis un motif : transport, démarche, famille, raison personnelle ou autre.';
  end if;
  v_mot := nullif(btrim(coalesce(p_mot, '')), '');
  if char_length(v_mot) > 200 then
    raise exception 'contact: Ton mot compte 200 caractères au plus.';
  end if;
  if exists (select 1 from unnest(coalesce(p_sans, '{}'::text[])) k(v) where k.v is null or k.v not in ('formateurs', 'delegue')) then
    raise exception 'contact: Les envois à décocher sont illisibles.';
  end if;
  v_sans := array(select distinct k.v from unnest(coalesce(p_sans, '{}'::text[])) k(v) order by 1);
  select st.promo_id into v_p from stagiaires st where st.id = s;
  v_l := lieu_de_promo(v_p);
  v_j := _contact_jours_absence(v_p, p_du, v_au, p_quand, v_debut);
  if jsonb_array_length(v_j) = 0 then
    raise exception 'contact: Ces jours ne comptent aucune demi-journée de formation (ni le samedi ni le dimanche).';
  end if;
  perform _contact_quota(s);
  -- Les principaux : la règle du centre, sinon le choix du stagiaire (mêmes refus que ecrire_au_centre, Q8).
  select coalesce(jsonb_agg(jsonb_build_object('fiche_id', d.fiche_id, 'nom', d.nom, 'relais_de', d.relais_de) order by d.fiche_id), '[]'::jsonb)
    into v_dest
    from _contact_destinataires(v_l, v_p, 'absence', (select sp.financement_id from stagiaires_prive sp where sp.stagiaire_id = s), v_j) d;
  if jsonb_array_length(v_dest) > 0 then
    if coalesce(cardinality(p_choisis), 0) > 0 then
      raise exception 'contact: Ta demande part à la personne prévue par ton centre : aucun choix n''est possible.';
    end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object('fiche_id', x2.fiche_id, 'nom', x2.nom)), '[]'::jsonb)
      into v_possibles from _contact_possibles(v_l, v_p, v_j) x2;
    if jsonb_array_length(v_possibles) = 0 then
      raise exception 'contact: Personne ne peut recevoir ta demande dans ce centre : préviens ton formateur directement.';
    end if;
    if coalesce(cardinality(p_choisis), 0) = 0 then
      raise exception 'contact: Choisis au moins une personne à prévenir.';
    end if;
    if exists (select 1 from unnest(p_choisis) c(id)
                where c.id is null
                   or not exists (select 1 from jsonb_array_elements(v_possibles) y where (y ->> 'fiche_id')::bigint = c.id)) then
      raise exception 'contact: Cette personne ne peut pas recevoir ta demande.' using errcode = '42501';
    end if;
    select jsonb_agg(y order by (y ->> 'fiche_id')::bigint) into v_dest
      from jsonb_array_elements(v_possibles) y
     where (y ->> 'fiche_id')::bigint = any(p_choisis);
  end if;
  -- La demande (texte = le mot), ses principaux et leurs envois « nouvelle » ; puis l'absence (son déclencheur marque l'émargement).
  v_id := _contact_creer(v_l, v_p, s, null, _contact_nom_stagiaire(s), 'absence', null, v_mot, v_dest);
  insert into absences_annoncees (demande_id, stagiaire_id, promo_id, du, au, quand, heure_debut, heure_fin, motif, annexes_decochees)
    values (v_id, s, v_p, p_du, v_au, p_quand, v_debut, v_fin, p_motif, v_sans);
  -- Les envois annexes (« avis_absence ») ; un nom sans fiche est écrit, non prévenu, sans envoi.
  for x in
    select a.* from _contact_annexes(v_l, v_p, v_j, s) a
     where not (a.fiche_id is not null and a.fiche_id in (select (y ->> 'fiche_id')::bigint from jsonb_array_elements(v_dest) y))
       and not (a.annexe = 'formateur_du_jour' and 'formateurs' = any(v_sans))
       and not (a.annexe = 'delegue' and 'delegue' = any(v_sans))
  loop
    insert into demande_destinataires (demande_id, fiche_id, stagiaire_id, nom, principal, annexe, non_prevenu)
      values (v_id, x.fiche_id, x.stagiaire_id, x.nom, false, x.annexe, x.non_prevenu);
    if x.non_prevenu is null then
      perform _contact_envoyer(v_id, x.fiche_id, x.stagiaire_id, 'avis_absence');
    end if;
  end loop;
  return v_id;
end $fn$;

-- 2. _contact_srv_lien() : une absence ne montre plus, sans connexion, ni le motif, ni le mot, ni le texte, ni les messages (retirés de
--    l'objet « demande ») ; les autres types de demande rendent le même objet qu'avant (le reste est le texte de la migration 3).
create or replace function public._contact_srv_lien(p_hash text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  j contact_jetons%rowtype := _contact_srv_jeton(p_hash);
  d demandes%rowtype;
  a absences_annoncees%rowtype;
begin
  if j.hash is null then
    return jsonb_build_object('invalide', true);
  end if;
  select * into d from demandes x where x.id = j.demande_id;
  select * into a from absences_annoncees x where x.demande_id = d.id;
  return jsonb_build_object(
    'demande', jsonb_build_object('id', d.id, 'type', d.type, 'sujet', d.sujet, 'texte', d.texte, 'etat', d.etat, 'auteur_nom', d.auteur_nom,
                                  'cree_le', d.cree_le,
                                  'messages', coalesce((
                                    select jsonb_agg(jsonb_build_object('auteur_nom', m.auteur_nom, 'texte', m.texte, 'reponse', r.libelle,
                                                                        'par_lien', m.par_lien, 'cree_le', m.cree_le) order by m.cree_le, m.id)
                                      from demande_messages m left join contact_reponses r on r.id = m.reponse_id
                                     where m.demande_id = d.id), '[]'::jsonb),
                                  'jours', _contact_jours_demande(d.id),
                                  'motif', a.motif,
                                  'mot', case when a.demande_id is not null then d.texte end,
                                  'moment', case when a.demande_id is not null then
                                              jsonb_build_object('du', a.du, 'au', a.au, 'quand', a.quand, 'debut', a.heure_debut, 'fin', a.heure_fin)
                                            end)
               - case when d.type = 'absence' then array['texte', 'messages', 'motif', 'mot'] else '{}'::text[] end,
    'action', j.action,
    'libelle_reponse', (select r.libelle from contact_reponses r where r.id = j.reponse_id),
    'deja', _contact_srv_deja(j) or (j.action = 'justificatif' and (j.utilise_le is not null or coalesce(a.justificatif = 'recu', false))));
end $fn$;

-- 3. _contact_effacer_stagiaire() (déclencheur de l'étape 1 de l'effacement) : le motif des absences du stagiaire effacé est mis à nul,
--    comme son mot (le reste est le texte de la migration 4). La ligne d'absence reste (jours, moment, justificatif).
create or replace function public._contact_effacer_stagiaire()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  delete from demandes d
   where d.type is distinct from 'absence'
     and (d.auteur_stagiaire_id = new.id
          or exists (select 1 from demande_destinataires x where x.demande_id = d.id and x.stagiaire_id = new.id and x.principal));
  delete from demande_messages m using demandes d where m.demande_id = d.id and d.auteur_stagiaire_id = new.id;
  delete from contact_jetons j using demandes d where j.demande_id = d.id and d.auteur_stagiaire_id = new.id;
  delete from contact_envois e using demandes d where e.demande_id = d.id and d.auteur_stagiaire_id = new.id;
  update demandes d set texte = null, auteur_nom = 'Stagiaire anonyme' where d.auteur_stagiaire_id = new.id;
  update absences_annoncees a set motif = null where a.stagiaire_id = new.id and a.motif is not null;
  delete from demande_destinataires x where x.stagiaire_id = new.id;
  delete from contact_envois e where e.vers_stagiaire_id = new.id;
  update stagiaires set delegue = null where id = new.id and delegue is not null;
  return null;
end $fn$;

-- Contrôle de fin : la contrainte des motifs porte les cinq codes, sans « sante » ; les trois fonctions portent leur changement ;
-- prevenir_absence garde ses droits (authenticated, jamais anon), _contact_srv_lien reste à service_role seul (ni anon ni authenticated),
-- _contact_effacer_stagiaire sans aucun droit ; aucune aide _contact_* ne s'exécute par anon ni authenticated (sauf _contact_compte_equipe).
do $controle$
declare
  f record;
begin
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public.absences_annoncees'::regclass and c.conname = 'absences_annoncees_motif')
     is distinct from 'CHECK ((motif = ANY (ARRAY[''transport''::text, ''demarche''::text, ''famille''::text, ''personnel''::text, ''autre''::text])))' then
    raise exception 'contact_5 : la contrainte absences_annoncees_motif n''a pas les cinq codes attendus ; tout est annulé';
  end if;
  if (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
       and ((p.proname = 'prevenir_absence' and pg_get_functiondef(p.oid) like '%''famille'', ''personnel'', ''autre''%'
             and pg_get_functiondef(p.oid) like '%raison personnelle ou autre%' and pg_get_functiondef(p.oid) not like '%''sante''%')
            or (p.proname = '_contact_srv_lien' and pg_get_functiondef(p.oid) like '%array[''texte'', ''messages'', ''motif'', ''mot'']%')
            or (p.proname = '_contact_effacer_stagiaire'
                and pg_get_functiondef(p.oid) like '%update absences_annoncees a set motif = null where a.stagiaire_id = new.id%'))) <> 3 then
    raise exception 'contact_5 : une fonction redéfinie ne porte pas son changement ; tout est annulé';
  end if;
  if has_function_privilege('anon', 'public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[])', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[])', 'EXECUTE') then
    raise exception 'contact_5 : prevenir_absence n''a pas ses droits (authenticated seul) ; tout est annulé';
  end if;
  if not has_function_privilege('service_role', 'public._contact_srv_lien(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public._contact_srv_lien(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public._contact_srv_lien(text)', 'EXECUTE') then
    raise exception 'contact_5 : _contact_srv_lien n''a pas ses droits (service_role seul) ; tout est annulé';
  end if;
  if has_function_privilege('service_role', 'public._contact_effacer_stagiaire()', 'EXECUTE') then
    raise exception 'contact_5 : _contact_effacer_stagiaire s''exécute par service_role (aucun droit attendu) ; tout est annulé';
  end if;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname like '\_contact\_%' and p.proname <> '_contact_compte_equipe' loop
    if has_function_privilege('anon', f.sig, 'EXECUTE') or has_function_privilege('authenticated', f.sig, 'EXECUTE') then
      raise exception 'contact_5 : l''aide interne % s''exécute par anon ou authenticated ; tout est annulé', f.sig;
    end if;
  end loop;
end $controle$;
