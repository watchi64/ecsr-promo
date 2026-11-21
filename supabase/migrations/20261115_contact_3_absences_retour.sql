-- Marche arrière de 20261115_contact_3_absences.sql (espace contact, migration 3 : l'absence annoncée).
--   * Déclencheurs retirés (emargement_seances_annoncees, absences_annoncees_emargement sur absences_annoncees et sur demandes,
--     stagiaires_contact_anonymiser) avec leurs fonctions.
--   * Les huit fonctions de la migration 2 que la migration 3 redéfinit sont remises au texte du fichier
--     20261115_contact_2_demandes.sql : chaque bloc ci-dessous y est copié tel quel (outil d'extraction, jamais réécrit de mémoire), seul
--     « create function » y devient « create or replace function » ; leurs droits ne changent pas. La preuve
--     (tests/sql/contact-absences-preuve.sql, groupe retour) compare md5(pg_get_functiondef) avant la migration 3 et après ce retour.
--   * Fonctions de l'app et aides internes de la migration 3 retirées.
--   * Contrainte d'origine de l'émargement remise à son texte du 23/10 (20261023_emargement.sql).
--   * Table absences_annoncees supprimée, avec ses lignes (un avis en donne le nombre, sans nom ni motif) ; les demandes d'absence
--     restent (migration 2), sans leurs jours.
-- Garde d'entrée : la migration 3 est appliquée (public.absences_annoncees existe) ; aucune ligne d'émargement n'a l'origine « annoncee »
-- (la contrainte du 23/10 la refuserait : corriger ces lignes d'abord). Sinon rien ne change.
-- Ordre : une migration postérieure qui redéfinit l'une de ces huit fonctions se défait avant ce retour (il remet le texte de la 2).
set local lock_timeout = '3s';

do $garde$
begin
  if to_regclass('public.absences_annoncees') is null then
    raise exception 'contact_3_retour : la migration 3 n''est pas appliquée (absences_annoncees est absente) ; rien n''est changé';
  end if;
  if exists (select 1 from public.emargement_lignes where absence_origine = 'annoncee') then
    raise exception 'contact_3_retour : % ligne(s) d''émargement ont l''origine « annoncee » (absence annoncée) ; la contrainte du 23/10 les refuserait, rien n''est changé',
      (select count(*) from public.emargement_lignes where absence_origine = 'annoncee');
  end if;
end $garde$;

do $avis$
begin
  raise notice 'contact_3_retour : % absence(s) annoncée(s) perdue(s) (jours, moment, motif, justificatif) ; les demandes restent',
    (select count(*) from public.absences_annoncees);
end $avis$;

drop trigger stagiaires_contact_anonymiser on public.stagiaires;
drop trigger absences_annoncees_emargement on public.demandes;
drop trigger absences_annoncees_emargement on public.absences_annoncees;
drop trigger emargement_seances_annoncees on public.emargement_seances;
drop function public._contact_anonymiser_stagiaire();
drop function public._contact_emargement_annulation();
drop function public._contact_emargement_absence();
drop function public._contact_emargement_seance();

-- Les huit fonctions, au texte du fichier de la migration 2 (blocs copiés).

create or replace function public.apercu_envoi(p_type text, p_jours jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  v_p integer;
  v_l integer;
  v_j jsonb;
  v_principaux jsonb;
begin
  if s is null then
    raise exception 'contact: Réservé aux stagiaires.' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('absence', 'retard', 'administratif', 'document', 'autre') then
    raise exception 'contact: Type de demande inconnu.';
  end if;
  select st.promo_id into v_p from stagiaires st where st.id = s;
  v_l := lieu_de_promo(v_p);
  v_j := _contact_jours(p_type, p_jours, v_p);
  select coalesce(jsonb_agg(jsonb_build_object('fiche_id', d.fiche_id, 'nom', d.nom, 'relais_de', d.relais_de) order by d.nom, d.fiche_id),
                  '[]'::jsonb)
    into v_principaux
    from _contact_destinataires(v_l, v_p, p_type, (select sp.financement_id from stagiaires_prive sp where sp.stagiaire_id = s), v_j) d;
  if jsonb_array_length(v_principaux) > 0 then
    return jsonb_build_object('mode', 'regle', 'principaux', v_principaux, 'possibles', '[]'::jsonb);
  end if;
  return jsonb_build_object('mode', 'choix', 'principaux', '[]'::jsonb, 'possibles', coalesce((
    select jsonb_agg(jsonb_build_object('fiche_id', x.fiche_id, 'nom', x.nom, 'titre', x.titre, 'pre_coche', x.pre_coche)
                     order by x.nom, x.fiche_id)
      from _contact_possibles(v_l, v_p, v_j) x), '[]'::jsonb));
end $fn$;

create or replace function public.liste_demandes(p_lieu_id integer default null)
returns table (id bigint, type text, sujet text, etat text, auteur_nom text, cree_le timestamptz, dernier_echange_le timestamptz,
               non_lue boolean, mon_role text, a_traiter boolean, envoi_en_echec boolean, jours jsonb)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with moi as (
    select _contact_stagiaire() as s, _contact_ma_fiche() as f,
           coalesce(p_lieu_id is not null and _contact_direction_reelle(p_lieu_id), false) as centre
  ), cand as (
    select d.id from demandes d, moi
     where (moi.s is not null and d.auteur_stagiaire_id = moi.s) or (moi.f is not null and d.auteur_fiche_id = moi.f)
    union
    select x.demande_id from demande_destinataires x, moi
     where (moi.s is not null and x.stagiaire_id = moi.s) or (moi.f is not null and x.fiche_id = moi.f)
    union
    select d.id from demandes d, moi where moi.centre and d.lieu_id = p_lieu_id
  ), r as (
    select d.*, _contact_role(d.id, moi.s, moi.f) as role, moi.s as moi_s, moi.f as moi_f
      from cand join demandes d on d.id = cand.id cross join moi
  ), l as (
    select r.*,
           exists (select 1 from demande_destinataires x
                    where x.demande_id = r.id and x.lue_le is null and (x.principal or x.annexe = 'formateur_du_jour')
                      and ((r.moi_s is not null and x.stagiaire_id = r.moi_s) or (r.moi_f is not null and x.fiche_id = r.moi_f))) as pas_lue
      from r
     where r.role is not null and (r.role <> 'direction' or r.lieu_id = p_lieu_id)
  )
  select case when l.role = 'delegue' then null else l.id end,
         l.type,
         case when l.role = 'delegue' then null else l.sujet end,
         case when l.role = 'delegue' then null else l.etat end,
         l.auteur_nom, l.cree_le, l.dernier_echange_le,
         case when l.role = 'delegue' then null else l.role in ('principal', 'annexe_formateur') and l.pas_lue end,
         l.role,
         case when l.role = 'delegue' then null
              else l.role = 'principal' and l.moi_f is not null and l.etat = 'envoyee' and l.auteur_stagiaire_id is not null end,
         case when l.role = 'delegue' or l.moi_s is not null then null
              else exists (select 1 from contact_envois e where e.demande_id = l.id and e.etat = 'echec') end,
         null::jsonb
    from l
   order by 10 desc nulls last, l.dernier_echange_le desc, l.id desc;
$fn$;

create or replace function public.demande_detail(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  f bigint := _contact_ma_fiche();
  v_role text := _contact_role(p_id, s, f);
  v_peut jsonb;
  d demandes%rowtype;
begin
  if v_role is null or v_role = 'delegue' then
    raise exception 'contact: Demande introuvable.' using errcode = '42501';
  end if;
  select * into d from demandes x where x.id = p_id;
  v_peut := _contact_peut(p_id, v_role, s is null);
  return jsonb_build_object(
    'demande', jsonb_build_object('id', d.id, 'type', d.type, 'sujet', d.sujet, 'texte', d.texte, 'etat', d.etat, 'auteur_nom', d.auteur_nom,
                                  'cree_le', d.cree_le, 'prise_le', d.prise_le, 'prise_par', d.prise_par, 'annulee_le', d.annulee_le,
                                  'annulee_par', d.annulee_par, 'dernier_echange_le', d.dernier_echange_le, 'jours', null, 'mon_role', v_role),
    'destinataires', coalesce((
      select jsonb_agg(jsonb_build_object('nom', x.nom, 'principal', x.principal, 'annexe', x.annexe, 'relais_de', x.relais_de,
                                          'non_prevenu', x.non_prevenu, 'lue_le', x.lue_le,
                                          'email', case when c.compte_email is null or c.verifiee_le is not null then c.email end)
                       order by x.principal desc, x.id)
        from demande_destinataires x left join contacts c on c.id = x.fiche_id
       where x.demande_id = p_id), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('auteur_nom', m.auteur_nom, 'texte', m.texte, 'reponse', r.libelle, 'par_lien', m.par_lien,
                                          'cree_le', m.cree_le, 'moi', coalesce(m.auteur_email = lower(auth.jwt() ->> 'email'), false))
                       order by m.cree_le, m.id)
        from demande_messages m left join contact_reponses r on r.id = m.reponse_id
       where m.demande_id = p_id), '[]'::jsonb),
    'reponses_toutes_faites', case when (v_peut ->> 'toutes_faites')::boolean then coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'libelle', r.libelle, 'vaut_prise', r.vaut_prise,
                                          'demande_justificatif', r.demande_justificatif) order by r.ordre, r.id)
        from contact_reponses r where r.lieu_id = d.lieu_id and not r.retire), '[]'::jsonb) else '[]'::jsonb end,
    'envois', case when s is null then coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'vers', coalesce(
                         (select x.nom from demande_destinataires x
                           where x.demande_id = p_id and (x.fiche_id = e.vers_fiche_id or x.stagiaire_id = e.vers_stagiaire_id)
                           order by x.principal desc, x.id limit 1),
                         case when e.vers_fiche_id = d.auteur_fiche_id or e.vers_stagiaire_id = d.auteur_stagiaire_id then d.auteur_nom end,
                         'Sans nom'),
                                          'evenement', e.evenement, 'etat', e.etat) order by e.id)
        from contact_envois e where e.demande_id = p_id), '[]'::jsonb) else '[]'::jsonb end,
    'peut', v_peut - 'toutes_faites');
end $fn$;

create or replace function public.repondre_demande(p_id bigint, p_texte text, p_reponse_id bigint default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  f bigint := _contact_ma_fiche();
  v_role text;
  v_peut jsonb;
  v_texte text;
  v_lieu integer;
  v_nom text;
begin
  perform 1 from demandes d where d.id = p_id for update;
  v_role := _contact_role(p_id, s, f);
  if v_role is null or v_role = 'delegue' then
    raise exception 'contact: Demande introuvable.' using errcode = '42501';
  end if;
  if v_role not in ('auteur', 'principal', 'direction') then
    raise exception 'contact: Seuls l''auteur et les destinataires de la demande y répondent.' using errcode = '42501';
  end if;
  v_peut := _contact_peut(p_id, v_role, s is null);
  if not (v_peut ->> 'repondre')::boolean then
    raise exception 'contact: Cette demande est annulée.';
  end if;
  v_texte := _contact_texte(p_texte);
  select d.lieu_id into v_lieu from demandes d where d.id = p_id;
  if p_reponse_id is not null then
    if not (v_peut ->> 'toutes_faites')::boolean then
      raise exception 'contact: Les réponses toutes faites sont celles de l''équipe qui reçoit la demande.' using errcode = '42501';
    end if;
    if not exists (select 1 from contact_reponses r where r.id = p_reponse_id and r.lieu_id = v_lieu and not r.retire) then
      raise exception 'contact: Cette réponse toute faite n''existe pas dans ce centre.';
    end if;
  end if;
  if v_texte is null and p_reponse_id is null then
    if s is not null then
      raise exception 'contact: Écris ta réponse.';
    end if;
    raise exception 'contact: Écrivez votre réponse ou choisissez une réponse toute faite.';
  end if;
  v_nom := case when s is not null then _contact_nom_stagiaire(s) else (select _contact_nom_fiche(c, v_lieu) from contacts c where c.id = f) end;
  return _contact_appliquer_reponse(p_id, case when s is null then f end, s, v_nom, lower(auth.jwt() ->> 'email'), v_texte, p_reponse_id, false);
end $fn$;

create or replace function public.annuler_demande(p_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  f bigint := _contact_ma_fiche();
  v_role text;
  v_maintenant timestamptz := _contact_maintenant();
  x record;
begin
  perform 1 from demandes d where d.id = p_id for update;
  v_role := _contact_role(p_id, s, f);
  if v_role is null or v_role = 'delegue' then
    raise exception 'contact: Demande introuvable.' using errcode = '42501';
  end if;
  if v_role <> 'auteur' then
    raise exception 'contact: Seule la personne qui a écrit la demande peut l''annuler.' using errcode = '42501';
  end if;
  if not (_contact_peut(p_id, v_role, s is null) ->> 'annuler')::boolean then
    raise exception 'contact: Cette demande ne peut plus être annulée.';
  end if;
  update demandes d
     set etat = 'annulee', annulee_le = v_maintenant, dernier_echange_le = v_maintenant,
         annulee_par = coalesce(case when s is not null then _contact_nom_stagiaire(s)
                                     else (select _contact_nom_fiche(c, d.lieu_id) from contacts c where c.id = f) end, 'Sans nom')
   where d.id = p_id and d.etat = 'envoyee';
  if not found then
    raise exception 'contact: Cette demande ne peut plus être annulée.';
  end if;
  for x in select y.fiche_id, y.stagiaire_id from demande_destinataires y
            where y.demande_id = p_id and y.principal and num_nonnulls(y.fiche_id, y.stagiaire_id) = 1 order by y.id loop
    perform _contact_envoyer(p_id, x.fiche_id, x.stagiaire_id, 'annulation');
  end loop;
end $fn$;

create or replace function public._contact_srv_prendre(p_limite integer default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
  e contact_envois%rowtype;
  d demandes%rowtype;
  c contacts%rowtype;
  v_sortie jsonb := '[]'::jsonb;
  v_email text;
  v_nom text;
  v_role text;
  v_peut jsonb;
begin
  for e in
    select x.* from contact_envois x
     where x.etat = 'a_envoyer' or (x.etat in ('a_retenter', 'en_cours') and x.prochain_essai_le <= v_maintenant)
     order by x.id
     limit greatest(1, least(coalesce(p_limite, 20), 100))
     for update skip locked
  loop
    if e.etat = 'en_cours' and e.tentatives >= 2 then
      update contact_envois set etat = 'echec', raison = 'interrompu', prochain_essai_le = null where id = e.id;
      continue;
    end if;
    select * into d from demandes x where x.id = e.demande_id;
    c := null;
    v_email := null;
    v_nom := null;
    v_peut := null;
    if e.vers_fiche_id is not null then
      select * into c from contacts x where x.id = e.vers_fiche_id;
      v_email := case when c.compte_email is not null then c.compte_email else c.email end;
      v_nom := coalesce((select x.nom from demande_destinataires x where x.demande_id = d.id and x.fiche_id = c.id
                          order by x.principal desc, x.id limit 1),
                        _contact_nom_fiche(c, d.lieu_id));
      -- Le rôle de la fiche, sans jeton de session : la branche « direction » de _contact_role n'est jamais prise ici.
      v_role := _contact_role(d.id, null, c.id);
      if v_role is not null then
        v_peut := _contact_peut(d.id, v_role, true);
      end if;
    elsif e.vers_stagiaire_id is not null then
      v_email := (select lower(up.email) from user_profiles up where up.stagiaire_id = e.vers_stagiaire_id and up.email is not null
                   order by up.email limit 1);
      v_nom := _contact_nom_stagiaire(e.vers_stagiaire_id);
    end if;
    v_email := nullif(btrim(v_email), '');
    if v_email is null then
      update contact_envois set etat = 'ignore', raison = 'sans adresse', prochain_essai_le = null where id = e.id;
      continue;
    end if;
    update contact_envois set etat = 'en_cours', tentatives = tentatives + 1, raison = null,
                              prochain_essai_le = v_maintenant + interval '10 minutes'
     where id = e.id;
    v_sortie := v_sortie || jsonb_build_array(jsonb_build_object(
      'envoi_id', e.id,
      'evenement', e.evenement,
      'demande', jsonb_build_object('id', d.id, 'type', d.type, 'auteur_nom', d.auteur_nom, 'jours', null, 'cree_le', d.cree_le),
      'destinataire', jsonb_build_object('email', v_email, 'nom', coalesce(v_nom, 'Sans nom'),
                                         'avec_compte', e.vers_stagiaire_id is not null or c.compte_email is not null,
                                         'stagiaire', e.vers_stagiaire_id is not null,
                                         'peut_prendre', coalesce((v_peut ->> 'prendre')::boolean, false)),
      'reponses', case when e.evenement in ('nouvelle', 'reponse') and coalesce((v_peut ->> 'toutes_faites')::boolean, false) then coalesce((
                    select jsonb_agg(jsonb_build_object('id', r.id, 'libelle', r.libelle) order by r.ordre, r.id)
                      from contact_reponses r where r.lieu_id = d.lieu_id and not r.retire), '[]'::jsonb)
                  else '[]'::jsonb end));
  end loop;
  return v_sortie;
end $fn$;

create or replace function public._contact_srv_lien(p_hash text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  j contact_jetons%rowtype := _contact_srv_jeton(p_hash);
  d demandes%rowtype;
begin
  if j.hash is null then
    return jsonb_build_object('invalide', true);
  end if;
  select * into d from demandes x where x.id = j.demande_id;
  return jsonb_build_object(
    'demande', jsonb_build_object('id', d.id, 'type', d.type, 'sujet', d.sujet, 'texte', d.texte, 'etat', d.etat, 'auteur_nom', d.auteur_nom,
                                  'cree_le', d.cree_le,
                                  'messages', coalesce((
                                    select jsonb_agg(jsonb_build_object('auteur_nom', m.auteur_nom, 'texte', m.texte, 'reponse', r.libelle,
                                                                        'par_lien', m.par_lien, 'cree_le', m.cree_le) order by m.cree_le, m.id)
                                      from demande_messages m left join contact_reponses r on r.id = m.reponse_id
                                     where m.demande_id = d.id), '[]'::jsonb)),
    'action', j.action,
    'libelle_reponse', (select r.libelle from contact_reponses r where r.id = j.reponse_id),
    'deja', _contact_srv_deja(j));
end $fn$;

create or replace function public._contact_srv_agir(p_hash text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  j contact_jetons%rowtype := _contact_srv_jeton(p_hash);
  d demandes%rowtype;
  c contacts%rowtype;
  v_role text;
  v_peut jsonb;
begin
  if j.hash is null or j.action not in ('prise', 'reponse') then
    return jsonb_build_object('invalide', true);
  end if;
  select * into d from demandes x where x.id = j.demande_id for update;
  select * into j from contact_jetons x where x.hash = j.hash for update;
  if _contact_srv_deja(j) then
    return jsonb_build_object('deja', true);
  end if;
  select * into c from contacts x where x.id = j.fiche_id;
  v_role := _contact_role(d.id, null, c.id);
  if v_role is null then
    return jsonb_build_object('invalide', true);
  end if;
  v_peut := _contact_peut(d.id, v_role, true);
  if j.action = 'prise' then
    if not (v_peut ->> 'prendre')::boolean then
      return jsonb_build_object('invalide', true);
    end if;
    perform _contact_appliquer_prise(d.id, _contact_nom_fiche(c, d.lieu_id), true);
  else
    if not (v_peut ->> 'toutes_faites')::boolean
       or not exists (select 1 from contact_reponses r where r.id = j.reponse_id and r.lieu_id = d.lieu_id and not r.retire) then
      return jsonb_build_object('invalide', true);
    end if;
    perform _contact_appliquer_reponse(d.id, c.id, null, _contact_nom_fiche(c, d.lieu_id),
                                       case when c.compte_email is not null then c.compte_email else c.email end, null, j.reponse_id, true);
  end if;
  update contact_jetons x set utilise_le = _contact_maintenant() where x.hash = j.hash;
  return jsonb_build_object('fait', true);
end $fn$;

-- Les fonctions de la migration 3.
drop function public._contact_premarquer(bigint, integer);
drop function public._contact_observation_nous(text);
drop function public._contact_observation_heures(text, text);
drop function public.absences_annoncees_semaine(date);
drop function public.mes_justificatifs_a_remettre();
drop function public.regler_justificatif(bigint, text);
drop function public._contact_absence_reponse(bigint, bigint);
drop function public._contact_appliquer_justificatif(bigint, text);
drop function public._contact_annuler_absence(bigint, integer, bigint);
drop function public._contact_absence_gestes(bigint, text, integer);
drop function public._contact_formateur_de(integer);
drop function public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[]);
drop function public._contact_annexes(integer, integer, jsonb, integer);
drop function public._contact_absence_debut(bigint);
drop function public._contact_jours_demande(bigint);
drop function public._contact_jours_absence(integer, date, date, text, text);
drop function public._contact_debut_demi(integer, date, text);

-- La contrainte d'origine, au texte du 23/10.
alter table public.emargement_lignes drop constraint emargement_lignes_absence_origine_check;
alter table public.emargement_lignes add constraint emargement_lignes_absence_origine_check
  check (absence_origine in ('formateur', 'planning', 'non_signe'));

drop table public.absences_annoncees;

-- Contrôle de fin : plus rien de la migration 3 ; la contrainte a son texte du 23/10 ; les huit fonctions ne citent plus les absences.
do $controle$
begin
  if to_regclass('public.absences_annoncees') is not null
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                 and proname in ('prevenir_absence', 'regler_justificatif', 'mes_justificatifs_a_remettre', 'absences_annoncees_semaine',
                                 '_contact_debut_demi', '_contact_jours_absence', '_contact_jours_demande', '_contact_absence_debut',
                                 '_contact_annexes', '_contact_formateur_de', '_contact_absence_gestes', '_contact_annuler_absence',
                                 '_contact_appliquer_justificatif', '_contact_absence_reponse', '_contact_observation_heures',
                                 '_contact_observation_nous', '_contact_premarquer', '_contact_emargement_seance',
                                 '_contact_emargement_absence', '_contact_emargement_annulation', '_contact_anonymiser_stagiaire'))
     or exists (select 1 from pg_trigger where not tgisinternal
                 and tgname in ('emargement_seances_annoncees', 'absences_annoncees_emargement', 'stagiaires_contact_anonymiser'))
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                 and proname in ('apercu_envoi', 'liste_demandes', 'demande_detail', 'annuler_demande', 'repondre_demande',
                                 '_contact_srv_prendre', '_contact_srv_lien', '_contact_srv_agir')
                 and prosrc like '%absences_annoncees%') then
    raise exception 'contact_3_retour : il reste un objet de la migration 3 ; tout est annulé';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public.emargement_lignes'::regclass and c.conname = 'emargement_lignes_absence_origine_check')
     is distinct from 'CHECK ((absence_origine = ANY (ARRAY[''formateur''::text, ''planning''::text, ''non_signe''::text])))' then
    raise exception 'contact_3_retour : la contrainte d''origine de l''émargement n''a pas son texte du 23/10 ; tout est annulé';
  end if;
end $controle$;
