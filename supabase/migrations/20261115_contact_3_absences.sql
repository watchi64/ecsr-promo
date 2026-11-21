-- Espace contact, migration 3 (partie C, tâche 14) : l'absence annoncée.
-- Spec : docs/superpowers/specs/2026-11-09-espace-contact-design.md (§ 6.2, § 8, § 13) ; plan : docs/superpowers/plans/2026-11-14-espace-contact.md
-- (tâche 14, choix C-13, C-21, C-22, C-24 ; décision Q8 de Timy du 14/11 : le délégué n'est jamais destinataire principal).
--   1. La table absences_annoncees : une ligne par demande d'absence (RLS active, aucune règle, aucun droit, C-9).
--   2. Les jours d'une absence (C-22 : jours ouvrés seulement ; C-24 : une plage appartient à la demi-journée de son heure de début) et
--      son début (C-13 : la première demi-journée, ou l'heure de début d'une plage) : _contact_debut_demi, _contact_jours_absence,
--      _contact_jours_demande, _contact_absence_debut.
--   3. Prévenir : prevenir_absence(). Principaux par le routage de la migration 2 (règle) ou par le choix du stagiaire (mode choix, Q8) ;
--      envois annexes (_contact_annexes) : formateurs du jour qui ne sont pas déjà principaux, noms de ceux qui n'ont pas de fiche
--      (non_prevenu), délégués de la promo qui ont un compte (jamais l'auteur, jamais principaux), moins les cases décochées.
--   4. Les gestes de l'absence : _contact_absence_gestes (annuler, justificatif : seule source), _contact_annuler_absence (C-13),
--      regler_justificatif() et _contact_appliquer_justificatif (seule écriture du justificatif, app et lien d'e-mail),
--      _contact_absence_reponse (une réponse toute faite qui demande le justificatif le pose « à remettre ») ; lectures :
--      mes_justificatifs_a_remettre(), absences_annoncees_semaine() (jamais le motif).
--   5. Huit fonctions de la migration 2 redéfinies, signatures et colonnes de sortie inchangées : apercu_envoi (annexes d'une absence),
--      liste_demandes (jours ; le délégué ne lit que le nom, les jours et les demi-journées d'une absence non annulée), demande_detail
--      (absence, peut.annuler et peut.justificatif d'une absence), annuler_demande (l'absence), repondre_demande (réponse qui demande le
--      justificatif), _contact_srv_prendre (jours, jamais le motif), _contact_srv_lien (motif, mot, jours, moment), _contact_srv_agir
--      (justificatif : reçu). La fonction serveur contact-envois n'est pas retouchée (actionsDe produit déjà le jeton justificatif).
--   6. L'émargement : origine « annoncee » ; _contact_premarquer() et ses déclencheurs (feuille créée, absence créée, absence annulée) ;
--      le justificatif ne change que l'observation ; une feuille close ne bouge jamais (R-T14a). Une ligne signée n'est jamais touchée ; une observation d'un formateur n'est jamais
--      remplacée. emargement_ouvrir, _clore, _rouvrir et _annoter ne changent pas.
--   7. La conservation : stagiaires_contact_anonymiser (fiche rendue anonyme : le motif de ses absences est effacé, la ligne reste) ;
--      stagiaires_contact_effacer (migration 2) garde déjà la ligne d'absence.
-- Toutes les dates et heures passent par _contact_maintenant() et _contact_jour() (C-21).
-- Garde : la migration 2 est appliquée ; rien de la migration 3 n'existe ; la contrainte d'origine de l'émargement a son texte du 23/10
-- (20261023_emargement.sql) ; sinon rien ne change.
-- Marche arrière : 20261115_contact_3_absences_retour.sql (remet les huit fonctions au texte du fichier de la migration 2).
set local lock_timeout = '3s';

do $garde$
begin
  if to_regprocedure('public.ecrire_au_centre(text, text, text, bigint[])') is null or to_regprocedure('public.liste_demandes(integer)') is null
     or to_regprocedure('public._contact_srv_agir(text)') is null then
    raise exception 'contact_3 : la migration 2 (20261115_contact_2_demandes.sql) n''est pas appliquée ; rien n''est changé';
  end if;
  if to_regclass('public.absences_annoncees') is not null
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                 and proname in ('prevenir_absence', 'regler_justificatif', 'mes_justificatifs_a_remettre', 'absences_annoncees_semaine',
                                 '_contact_premarquer')) then
    raise exception 'contact_3 : une table ou une fonction de la migration 3 existe déjà, migration déjà appliquée ? rien n''est changé';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public.emargement_lignes'::regclass and c.conname = 'emargement_lignes_absence_origine_check')
     is distinct from 'CHECK ((absence_origine = ANY (ARRAY[''formateur''::text, ''planning''::text, ''non_signe''::text])))' then
    raise exception 'contact_3 : emargement_lignes_absence_origine_check n''a pas son texte du 23/10 (20261023_emargement.sql) ; rien n''est changé';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stagiaires' and column_name = 'delegue')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'planning_entries' and column_name = 'prof_autre') then
    raise exception 'contact_3 : stagiaires.delegue (migration 1) ou planning_entries.prof_autre manque ; rien n''est changé';
  end if;
end $garde$;

-- 1. La table. Le mot du stagiaire vit dans demandes.texte (C-23) ; le jour de création, l'auteur et l'état, dans demandes.
create table public.absences_annoncees (
  demande_id bigint primary key references public.demandes (id) on delete cascade,
  stagiaire_id integer not null references public.stagiaires (id) on delete cascade,
  -- La promo de la création : l'absence reste au planning de cette promo si le stagiaire en change.
  promo_id integer not null,
  du date not null,
  au date not null,
  quand text not null constraint absences_annoncees_quand check (quand in ('journee', 'matin', 'aprem', 'heures')),
  heure_debut text,
  heure_fin text,
  motif text constraint absences_annoncees_motif check (motif in ('sante', 'transport', 'demarche', 'famille', 'autre')),
  justificatif text constraint absences_annoncees_justificatif check (justificatif in ('a_remettre', 'recu')),
  justificatif_le timestamptz,
  annexes_decochees text[] not null default '{}'
    constraint absences_annoncees_decochees check (annexes_decochees <@ array['formateurs', 'delegue']),
  constraint absences_annoncees_duree check (au >= du and au - du <= 30),
  constraint absences_annoncees_heures check (
    case when quand = 'heures'
         then coalesce(du = au and heure_debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and heure_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                       and heure_debut < heure_fin, false)
         else heure_debut is null and heure_fin is null end),
  constraint absences_annoncees_justificatif_le check ((justificatif is null) = (justificatif_le is null))
);
create index absences_annoncees_promo_du on public.absences_annoncees (promo_id, du);
create index absences_annoncees_stagiaire on public.absences_annoncees (stagiaire_id);
alter table public.absences_annoncees enable row level security;
revoke all on public.absences_annoncees from public, anon, authenticated;

-- 2. Les jours d'une absence.
-- Le début d'une demi-journée de la promo p au jour j (C-13) : l'heure saisie au planning ce jour-là (planning_half_meta), sinon 09:00 le
-- matin et 13:30 l'après-midi (DEFAULT_HALF_META, js/journee-rules.js).
create function public._contact_debut_demi(p integer, j date, p_demi text)
returns time language sql stable security definer set search_path = public, pg_temp
as $fn$
  select coalesce((select hm.start_time::time from planning_half_meta hm
                    where hm.promo_id = p and hm.half_day = p_demi
                      and hm.semaine_lundi = j - (extract(isodow from j)::integer - 1)
                      and hm.day_index = extract(isodow from j)::integer - 1
                      and pg_input_is_valid(hm.start_time, 'time')
                    limit 1),
                  case when p_demi = 'aprem' then time '13:30' else time '09:00' end);
$fn$;

-- Les jours d'une absence de la promo p (C-22) : [{"jour":"AAAA-MM-JJ","demi":"matin"|"aprem"}], jours ouvrés du premier au dernier
-- (samedi et dimanche exclus) ; journée : matin et après-midi ; matin ou après-midi : celle-là ; heures : la seule demi-journée qui
-- contient l'heure de début (C-24 : l'après-midi commence à l'heure saisie au planning, sinon à 13:30). Valeurs déjà lues par l'appelant.
create function public._contact_jours_absence(p integer, p_du date, p_au date, p_quand text, p_debut text)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $fn$
  select coalesce(jsonb_agg(jsonb_build_object('jour', x.j::text, 'demi', x.demi) order by x.j, x.demi desc), '[]'::jsonb)
    from (select g.j, m.demi
            from (select d::date as j
                    from generate_series(p_du::timestamp, (case when p_quand = 'heures' then p_du else p_au end)::timestamp, interval '1 day') d) g
            cross join lateral unnest(case p_quand
                                        when 'journee' then array['matin', 'aprem']
                                        when 'matin' then array['matin']
                                        when 'aprem' then array['aprem']
                                        when 'heures' then array[case when p_debut::time >= _contact_debut_demi(p, g.j, 'aprem') then 'aprem'
                                                                      else 'matin' end]
                                        else array[]::text[] end) m(demi)
           where extract(isodow from g.j) <= 5) x;
$fn$;

-- Les jours d'une demande : ceux de son absence, nuls pour tout autre type (C-22).
create function public._contact_jours_demande(p_demande bigint)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $fn$
  select _contact_jours_absence(a.promo_id, a.du, a.au, a.quand, a.heure_debut) from absences_annoncees a where a.demande_id = p_demande;
$fn$;

-- Le début d'une absence (C-13) : l'heure de début d'une plage, sinon le début de sa première demi-journée, à l'heure de Paris.
create function public._contact_absence_debut(p_demande bigint)
returns timestamptz language sql stable security definer set search_path = public, pg_temp
as $fn$
  select case when a.quand = 'heures' then (a.du + a.heure_debut::time) at time zone 'Europe/Paris'
              else ((x.premier ->> 'jour')::date + _contact_debut_demi(a.promo_id, (x.premier ->> 'jour')::date, x.premier ->> 'demi'))
                   at time zone 'Europe/Paris' end
    from absences_annoncees a
   cross join lateral (select _contact_jours_absence(a.promo_id, a.du, a.au, a.quand, a.heure_debut) -> 0 as premier) x
   where a.demande_id = p_demande;
$fn$;

-- 3. Prévenir.
-- Les envois annexes d'une absence de la promo p du centre l aux jours p_jours (déjà lus), pour le stagiaire p_auteur :
--   formateurs du jour : les fiches du centre rattachées (profs) à un formateur du planning de ces demi-journées (comme
--   _contact_formateurs_du_jour) ; non prévenus : un nom saisi à la main au planning (prof_autre) ou une ligne profs sans fiche dans le
--   centre (fiche_id nul, non_prevenu = le nom) ; délégués : titulaire et suppléant de la promo qui ont un compte, ni effacés ni rendus
--   anonymes, jamais l'auteur. L'appelant retire ceux qui sont déjà principaux et les cases décochées.
create function public._contact_annexes(l integer, p integer, p_jours jsonb, p_auteur integer)
returns table (fiche_id bigint, stagiaire_id integer, nom text, annexe text, non_prevenu text)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with demis as (
    select (e ->> 'jour')::date as d, e ->> 'demi' as demi from jsonb_array_elements(coalesce(p_jours, '[]'::jsonb)) e
  ), pe as (
    select x.prof_id, x.prof_ids, x.prof_autre
      from demis
      join planning_entries x on x.promo_id = p and x.half_day = demis.demi
                             and x.semaine_lundi = demis.d - (extract(isodow from demis.d)::integer - 1)
                             and x.day_index = extract(isodow from demis.d)::integer - 1
  ), profs_du_jour as (
    select distinct u.id from pe cross join lateral unnest(array[pe.prof_id] || pe.prof_ids) u(id) where u.id is not null
  ), fiches as (
    select f as id from _contact_formateurs_du_jour(l, p, p_jours) f
  ), tout as (
    select c.id as fiche_id, null::integer as stagiaire_id, _contact_nom_fiche(c, l) as nom, 'formateur_du_jour' as annexe, null::text as non_prevenu
      from contacts c where c.id in (select id from fiches)
    union all
    select null::bigint, null::integer, n.nom, 'formateur_du_jour', n.nom
      from (select btrim(pe.prof_autre) as nom from pe where nullif(btrim(pe.prof_autre), '') is not null
            union
            select coalesce(nullif(btrim(pf.nom), ''), 'Formateur') from profs pf
             where pf.id in (select id from profs_du_jour)
               and not exists (select 1 from contacts c where c.prof_id = pf.id and _contact_fiche_dans(c, l))) n
    union all
    select null::bigint, st.id, coalesce(_contact_nom_stagiaire(st.id), 'Délégué'), 'delegue', null::text
      from stagiaires st
     where st.promo_id = p and st.delegue is not null and st.id is distinct from p_auteur
       and st.actif and st.efface_le is null and st.anonymise_le is null
       and exists (select 1 from user_profiles up where up.stagiaire_id = st.id)
  )
  select * from tout order by annexe desc, nom, fiche_id, stagiaire_id;
$fn$;

-- Prévenir d'une absence (stagiaire de la promo affichée) : du p_du (aujourd'hui ou plus tard) au p_au (nul : le même jour, 31 jours au
-- plus) ; quand : journee, matin, aprem, ou heures (un seul jour, p_debut et p_fin en HH:MM) ; motif : sante, transport, demarche,
-- famille ou autre ; un mot de 200 caractères au plus ; p_sans : les envois annexes décochés (formateurs, delegue) ; p_choisis : les
-- principaux choisis en mode choix (mêmes règles que ecrire_au_centre). Garde des 10 demandes par jour. Rend l'identifiant de la demande.
create function public.prevenir_absence(p_du date, p_au date, p_quand text, p_debut text, p_fin text, p_motif text, p_mot text,
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
  if p_motif is null or p_motif not in ('sante', 'transport', 'demarche', 'famille', 'autre') then
    raise exception 'contact: Choisis un motif : santé, transport, démarche, famille ou autre.';
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

-- 4. Les gestes de l'absence.
-- Un formateur à titre fixe de la promo p (adresse du jeton), hors aperçu.
create function public._contact_formateur_de(p integer)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select apercu_role() is null
     and exists (select 1 from affectations a join titres t on t.id = a.titre_id
                  where lower(a.email) = lower(auth.jwt() ->> 'email') and a.role = 'formateur' and a.promo_id = p and t.fixe);
$fn$;

-- Ce que l'appelant peut faire d'une absence (seule source, lue par demande_detail, annuler_demande, regler_justificatif et le lien
-- d'e-mail) : p_stagiaire, le stagiaire appelant (nul pour l'équipe) ; p_role, son rôle (_contact_role, nul s'il n'en a pas).
--   annuler : l'auteur tant que l'absence n'a pas commencé (C-13) ; l'équipe : un destinataire principal, la direction réelle, ou qui
--             modifie le planning de la promo (hors aperçu), même après le début ; jamais une absence annulée.
--   justificatif : l'auteur (« Envoyer mon justificatif ») tant qu'il n'est pas reçu ; l'équipe (régler son état) : un destinataire
--             principal, la direction réelle, un formateur à titre fixe de la promo ; jamais une absence annulée.
create function public._contact_absence_gestes(p_demande bigint, p_role text, p_stagiaire integer)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $fn$
  select jsonb_build_object(
           'annuler', coalesce(d.etat <> 'annulee'
                               and case when p_stagiaire is not null
                                        then p_role = 'auteur' and _contact_maintenant() < _contact_absence_debut(d.id)
                                        else p_role in ('principal', 'direction')
                                             or (apercu_role() is null and coalesce(geste_promo(d.promo_id, 'planning.modifier'), false)) end,
                               false),
           'justificatif', coalesce(d.etat <> 'annulee'
                                    and case when p_stagiaire is not null then p_role = 'auteur' and a.justificatif is distinct from 'recu'
                                             else p_role in ('principal', 'direction') or _contact_formateur_de(d.promo_id) end,
                                    false))
    from demandes d join absences_annoncees a on a.demande_id = d.id
   where d.id = p_demande;
$fn$;

-- Annuler une absence (appelée par annuler_demande, la demande déjà verrouillée ; s : le stagiaire appelant, f : sa fiche de l'équipe).
-- Envois : « annulation » aux destinataires principaux, « annulation_absence » aux annexes prévenues (jamais à qui annule), et
-- « annulation » à l'auteur quand c'est l'équipe qui annule. Le déclencheur de demandes rend les lignes d'émargement.
create function public._contact_annuler_absence(p_id bigint, s integer, f bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
  d demandes%rowtype;
  v_role text;
  x record;
begin
  select * into d from demandes y where y.id = p_id for update;
  v_role := _contact_role(p_id, s, f);
  if d.id is null or v_role = 'delegue'
     or (v_role is null and (s is not null or apercu_role() is not null or not coalesce(geste_promo(d.promo_id, 'planning.modifier'), false))) then
    raise exception 'contact: Demande introuvable.' using errcode = '42501';
  end if;
  if not coalesce((_contact_absence_gestes(p_id, v_role, s) ->> 'annuler')::boolean, false) then
    if d.etat = 'annulee' then
      raise exception 'contact: Cette absence est déjà annulée.';
    end if;
    if s is not null and v_role = 'auteur' then
      raise exception 'contact: L''absence a commencé : demande à l''équipe de la corriger.';
    end if;
    raise exception 'contact: Seules l''équipe qui reçoit l''absence et la direction du centre peuvent l''annuler.' using errcode = '42501';
  end if;
  update demandes y
     set etat = 'annulee', annulee_le = v_maintenant, dernier_echange_le = v_maintenant,
         annulee_par = coalesce(case when s is not null then _contact_nom_stagiaire(s)
                                     else (select _contact_nom_fiche(c, y.lieu_id) from contacts c where c.id = f) end, 'L''équipe du centre')
   where y.id = p_id and y.etat <> 'annulee';
  if not found then
    raise exception 'contact: Cette absence est déjà annulée.';
  end if;
  for x in select y.fiche_id, y.stagiaire_id, y.principal from demande_destinataires y
            where y.demande_id = p_id and y.non_prevenu is null and num_nonnulls(y.fiche_id, y.stagiaire_id) = 1
              and not coalesce(y.fiche_id = f, false) and not coalesce(y.stagiaire_id = s, false)
            order by y.principal desc, y.id loop
    perform _contact_envoyer(p_id, x.fiche_id, x.stagiaire_id, case when x.principal then 'annulation' else 'annulation_absence' end);
  end loop;
  if d.auteur_stagiaire_id is not null and s is distinct from d.auteur_stagiaire_id then
    perform _contact_envoyer(p_id, null, d.auteur_stagiaire_id, 'annulation');
  end if;
end $fn$;

-- L'état du justificatif d'une absence (seule écriture, app et lien d'e-mail) : « a_remettre », « recu » ou nul. Reçu : l'auteur en est
-- prévenu (« justificatif_recu »). Rend vrai si l'état a changé. Le déclencheur de l'absence tient l'observation de l'émargement.
create function public._contact_appliquer_justificatif(p_demande bigint, p_etat text)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
  v_stagiaire integer;
begin
  update absences_annoncees
     set justificatif = p_etat, justificatif_le = case when p_etat is not null then v_maintenant end
   where demande_id = p_demande and justificatif is distinct from p_etat
  returning stagiaire_id into v_stagiaire;
  if not found then
    return false;
  end if;
  update demandes set dernier_echange_le = v_maintenant where id = p_demande;
  if p_etat = 'recu' then
    perform _contact_envoyer(p_demande, null, v_stagiaire, 'justificatif_recu');
  end if;
  return true;
end $fn$;

-- Une réponse toute faite qui demande le justificatif, sur une absence qui n'en a pas encore : « à remettre ». Appelée après
-- _contact_appliquer_reponse, depuis l'app (repondre_demande) et depuis un lien d'e-mail (_contact_srv_agir).
create function public._contact_absence_reponse(p_demande bigint, p_reponse_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if exists (select 1 from contact_reponses r where r.id = p_reponse_id and r.demande_justificatif)
     and exists (select 1 from absences_annoncees a where a.demande_id = p_demande and a.justificatif is null) then
    perform _contact_appliquer_justificatif(p_demande, 'a_remettre');
  end if;
end $fn$;

-- Régler le justificatif d'une absence (« a_remettre », « recu », ou nul pour l'effacer) : l'équipe seulement (_contact_absence_gestes).
create function public.regler_justificatif(p_id bigint, p_etat text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  f bigint := _contact_ma_fiche();
  d demandes%rowtype;
  v_role text;
begin
  select * into d from demandes x where x.id = p_id for update;
  v_role := _contact_role(p_id, s, f);
  if d.id is null or v_role = 'delegue' or (v_role is null and not coalesce(_contact_formateur_de(d.promo_id), false)) then
    raise exception 'contact: Demande introuvable.' using errcode = '42501';
  end if;
  if d.type is distinct from 'absence' then
    raise exception 'contact: Seule une absence a un justificatif.';
  end if;
  if s is not null then
    raise exception 'contact: Le justificatif se règle par l''équipe du centre.' using errcode = '42501';
  end if;
  if p_etat is not null and p_etat not in ('a_remettre', 'recu') then
    raise exception 'contact: État du justificatif inconnu.';
  end if;
  if not coalesce((_contact_absence_gestes(p_id, v_role, s) ->> 'justificatif')::boolean, false) then
    if d.etat = 'annulee' then
      raise exception 'contact: Cette absence est annulée.';
    end if;
    raise exception 'contact: Seuls les destinataires de l''absence, la direction du centre et les formateurs de la promo règlent le justificatif.'
      using errcode = '42501';
  end if;
  perform _contact_appliquer_justificatif(p_id, p_etat);
end $fn$;

-- Les justificatifs que le stagiaire appelant doit remettre (absences non annulées), pour le rappel de l'Accueil. Aucune ligne pour un
-- compte qui n'est pas un stagiaire de la promo affichée.
create function public.mes_justificatifs_a_remettre()
returns table (demande_id bigint, du date, au date, quand text, debut text, fin text)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select a.demande_id, a.du, a.au, a.quand, a.heure_debut, a.heure_fin
    from absences_annoncees a join demandes d on d.id = a.demande_id
   where a.stagiaire_id = _contact_stagiaire() and a.justificatif = 'a_remettre' and d.etat <> 'annulee'
   order by a.du, a.demande_id;
$fn$;

-- Les absences annoncées de la semaine du lundi p_lundi dans la promo affichée, une ligne par demi-journée (day_index 0 lundi ... 4
-- vendredi) : entiere (journée, matin, après-midi) ou la plage (debut, fin). Jamais le motif ; absences annulées exclues. Pour qui lit le
-- planning de la promo (stagiaire de la promo, planning.lire) ; aucune ligne sinon.
create function public.absences_annoncees_semaine(p_lundi date)
returns table (stagiaire_id integer, day_index integer, half_day text, entiere boolean, debut text, fin text)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with p as (select promo_courante() as id, p_lundi - (extract(isodow from p_lundi)::integer - 1) as lundi)
  select a.stagiaire_id, (j.jour - p.lundi)::integer, j.demi, a.quand <> 'heures',
         case when a.quand = 'heures' then a.heure_debut end, case when a.quand = 'heures' then a.heure_fin end
    from p
    join absences_annoncees a on a.promo_id = p.id and a.du <= p.lundi + 4 and a.au >= p.lundi
    join demandes d on d.id = a.demande_id and d.etat <> 'annulee'
   cross join lateral (select (e ->> 'jour')::date as jour, e ->> 'demi' as demi
                         from jsonb_array_elements(_contact_jours_absence(a.promo_id, a.du, a.au, a.quand, a.heure_debut)) e) j
   where p.id is not null and (membre_stagiaire(p.id) or geste_promo(p.id, 'planning.lire'))
     and j.jour between p.lundi and p.lundi + 4
   order by 2, 3 desc, 1;
$fn$;

-- 5. Les huit fonctions de la migration 2 redéfinies (texte de la migration 2 et ajouts de l'absence ; signatures inchangées).
-- apercu_envoi : pour une absence, les envois annexes en plus ({formateurs: [{fiche_id, nom}], non_prevenus: [{nom}], delegues: [{nom}]}).
-- Un formateur du jour déjà principal (mode règle) ou qu'on peut cocher (mode choix : pré-coché) n'y est pas : s'il n'est pas coché à
-- l'envoi, prevenir_absence le prévient en annexe.
create or replace function public.apercu_envoi(p_type text, p_jours jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  v_p integer;
  v_l integer;
  v_j jsonb;
  v_principaux jsonb;
  v_sortie jsonb;
  v_exclus bigint[];
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
    v_sortie := jsonb_build_object('mode', 'regle', 'principaux', v_principaux, 'possibles', '[]'::jsonb);
  else
    v_sortie := jsonb_build_object('mode', 'choix', 'principaux', '[]'::jsonb, 'possibles', coalesce((
      select jsonb_agg(jsonb_build_object('fiche_id', x.fiche_id, 'nom', x.nom, 'titre', x.titre, 'pre_coche', x.pre_coche)
                       order by x.nom, x.fiche_id)
        from _contact_possibles(v_l, v_p, v_j) x), '[]'::jsonb));
  end if;
  if p_type <> 'absence' then
    return v_sortie;
  end if;
  v_exclus := array(select (x ->> 'fiche_id')::bigint from jsonb_array_elements(v_sortie -> 'principaux') x
                    union
                    select (x ->> 'fiche_id')::bigint from jsonb_array_elements(v_sortie -> 'possibles') x);
  return v_sortie || jsonb_build_object('annexes', (
    select jsonb_build_object(
             'formateurs', coalesce(jsonb_agg(jsonb_build_object('fiche_id', a.fiche_id, 'nom', a.nom) order by a.nom, a.fiche_id)
                                      filter (where a.annexe = 'formateur_du_jour' and a.fiche_id is not null), '[]'::jsonb),
             'non_prevenus', coalesce(jsonb_agg(jsonb_build_object('nom', a.nom) order by a.nom) filter (where a.non_prevenu is not null),
                                      '[]'::jsonb),
             'delegues', coalesce(jsonb_agg(jsonb_build_object('nom', a.nom) order by a.nom) filter (where a.annexe = 'delegue'), '[]'::jsonb))
      from _contact_annexes(v_l, v_p, v_j, s) a
     where a.fiche_id is null or not (a.fiche_id = any(v_exclus))));
end $fn$;

-- liste_demandes : jours d'une absence (C-22) ; le délégué ne lit que le type, le nom du stagiaire, son rôle et les jours d'une absence
-- non annulée (aucune date de création ni d'échange, aucun état, aucun motif : jamais de sujet ni de texte).
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
       and (r.role <> 'delegue' or (r.type = 'absence' and r.etat <> 'annulee'))
  )
  select case when l.role = 'delegue' then null else l.id end,
         l.type,
         case when l.role = 'delegue' then null else l.sujet end,
         case when l.role = 'delegue' then null else l.etat end,
         l.auteur_nom,
         case when l.role = 'delegue' then null else l.cree_le end,
         case when l.role = 'delegue' then null else l.dernier_echange_le end,
         case when l.role = 'delegue' then null else l.role in ('principal', 'annexe_formateur') and l.pas_lue end,
         l.role,
         case when l.role = 'delegue' then null
              else l.role = 'principal' and l.moi_f is not null and l.etat = 'envoyee' and l.auteur_stagiaire_id is not null end,
         case when l.role = 'delegue' or l.moi_s is not null then null
              else exists (select 1 from contact_envois e where e.demande_id = l.id and e.etat = 'echec') end,
         _contact_jours_demande(l.id)
    from l
   order by 10 desc nulls last, l.dernier_echange_le desc, l.id desc;
$fn$;

-- demande_detail : jours et absence ({du, au, quand, debut, fin, motif, mot, justificatif}, nulle hors absence) ; pour une absence,
-- peut.annuler et peut.justificatif viennent de _contact_absence_gestes (l'écran ne lit que ces booléens).
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
  if d.type = 'absence' then
    v_peut := v_peut || coalesce(_contact_absence_gestes(p_id, v_role, s), '{}'::jsonb);
  end if;
  return jsonb_build_object(
    'demande', jsonb_build_object('id', d.id, 'type', d.type, 'sujet', d.sujet, 'texte', d.texte, 'etat', d.etat, 'auteur_nom', d.auteur_nom,
                                  'cree_le', d.cree_le, 'prise_le', d.prise_le, 'prise_par', d.prise_par, 'annulee_le', d.annulee_le,
                                  'annulee_par', d.annulee_par, 'dernier_echange_le', d.dernier_echange_le,
                                  'jours', _contact_jours_demande(d.id), 'mon_role', v_role),
    'absence', (select jsonb_build_object('du', a.du, 'au', a.au, 'quand', a.quand, 'debut', a.heure_debut, 'fin', a.heure_fin,
                                          'motif', a.motif, 'mot', d.texte, 'justificatif', a.justificatif)
                  from absences_annoncees a where a.demande_id = d.id),
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

-- annuler_demande : une absence passe par _contact_annuler_absence (C-13 : l'auteur avant son début, l'équipe ensuite) ; les autres
-- demandes, comme dans la migration 2.
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
  if exists (select 1 from demandes d where d.id = p_id and d.type = 'absence') then
    perform _contact_annuler_absence(p_id, s, f);
    return;
  end if;
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

-- repondre_demande : comme dans la migration 2, puis une réponse toute faite qui demande le justificatif d'une absence le pose « à
-- remettre » (_contact_absence_reponse).
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
  v_message bigint;
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
  v_message := _contact_appliquer_reponse(p_id, case when s is null then f end, s, v_nom, lower(auth.jwt() ->> 'email'), v_texte, p_reponse_id,
                                          false);
  perform _contact_absence_reponse(p_id, p_reponse_id);
  return v_message;
end $fn$;

-- _contact_srv_prendre : les jours d'une absence (C-22) dans l'élément rendu ; jamais le sujet, le texte ni le motif.
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
      'demande', jsonb_build_object('id', d.id, 'type', d.type, 'auteur_nom', d.auteur_nom, 'jours', _contact_jours_demande(d.id),
                                    'cree_le', d.cree_le),
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

-- _contact_srv_lien : pour une absence, le motif, le mot, les jours et le moment ({du, au, quand, debut, fin}) en plus (la page ouverte
-- par le lien d'une fiche de l'équipe les montre ; aucun stagiaire n'a de jeton, C-12). Justificatif : déjà fait quand le jeton a servi
-- ou que le justificatif est déjà reçu.
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
                                            end),
    'action', j.action,
    'libelle_reponse', (select r.libelle from contact_reponses r where r.id = j.reponse_id),
    'deja', _contact_srv_deja(j) or (j.action = 'justificatif' and (j.utilise_le is not null or coalesce(a.justificatif = 'recu', false))));
end $fn$;

-- _contact_srv_agir : en plus de la migration 2, l'action justificatif (« Justificatif reçu ») d'une absence non annulée, par un
-- destinataire principal de l'équipe (la direction n'est jamais reconnue par un lien) : _contact_appliquer_justificatif(recu) ; déjà
-- fait (rien d'écrit) si le jeton a servi ou si le justificatif est déjà reçu. Une réponse toute faite par lien pose aussi « à remettre »
-- (_contact_absence_reponse).
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
  if j.hash is null or j.action not in ('prise', 'reponse', 'justificatif') then
    return jsonb_build_object('invalide', true);
  end if;
  select * into d from demandes x where x.id = j.demande_id for update;
  select * into j from contact_jetons x where x.hash = j.hash for update;
  if _contact_srv_deja(j)
     or (j.action = 'justificatif'
         and (j.utilise_le is not null or exists (select 1 from absences_annoncees a where a.demande_id = d.id and a.justificatif = 'recu'))) then
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
  elsif j.action = 'justificatif' then
    if v_role <> 'principal' or d.type is distinct from 'absence'
       or not coalesce((_contact_absence_gestes(d.id, v_role, null) ->> 'justificatif')::boolean, false) then
      return jsonb_build_object('invalide', true);
    end if;
    perform _contact_appliquer_justificatif(d.id, 'recu');
  else
    if not (v_peut ->> 'toutes_faites')::boolean
       or not exists (select 1 from contact_reponses r where r.id = j.reponse_id and r.lieu_id = d.lieu_id and not r.retire) then
      return jsonb_build_object('invalide', true);
    end if;
    perform _contact_appliquer_reponse(d.id, c.id, null, _contact_nom_fiche(c, d.lieu_id),
                                       case when c.compte_email is not null then c.compte_email else c.email end, null, j.reponse_id, true);
    perform _contact_absence_reponse(d.id, j.reponse_id);
  end if;
  update contact_jetons x set utilise_le = _contact_maintenant() where x.hash = j.hash;
  return jsonb_build_object('fait', true);
end $fn$;

-- 6. L'émargement.
alter table public.emargement_lignes drop constraint emargement_lignes_absence_origine_check;
alter table public.emargement_lignes add constraint emargement_lignes_absence_origine_check
  check (absence_origine in ('formateur', 'planning', 'non_signe', 'annoncee'));

-- L'observation d'une absence de quelques heures : « Absent de 10 h à 11 h, prévenu » (« 9 h 30 » pour 09:30).
create function public._contact_observation_heures(p_debut text, p_fin text)
returns text language sql immutable security definer set search_path = public, pg_temp
as $fn$
  select 'Absent de ' || string_agg(split_part(h, ':', 1)::integer::text || ' h'
                                    || case when split_part(h, ':', 2) = '00' then '' else ' ' || split_part(h, ':', 2) end, ' à ' order by n)
         || ', prévenu'
    from unnest(array[p_debut, p_fin]) with ordinality u(h, n)
  having count(h) = 2;
$fn$;

-- Une observation posée par l'espace contact (jamais celle d'un formateur) : « Absence prévenue », « Absence justifiée », ou celle d'une
-- absence de quelques heures.
create function public._contact_observation_nous(p_observation text)
returns boolean language sql immutable security definer set search_path = public, pg_temp
as $fn$
  select coalesce(p_observation in ('Absence prévenue', 'Absence justifiée')
                  or p_observation ~ '^Absent de [0-9]{1,2} h( [0-5][0-9])? à [0-9]{1,2} h( [0-5][0-9])?, prévenu$', false);
$fn$;

-- Pré-marquer la feuille p_seance (pour le seul stagiaire p_stagiaire s'il est donné) d'après les absences annoncées qui couvrent sa
-- demi-journée, dans la promo de la feuille :
--   absence entière en cours (journée, matin, après-midi) : la ligne passe absente, origine « annoncee » (une origine planning ou
--     non_signe devient annoncee, celle d'un formateur reste), observation « Absence prévenue » ou « Absence justifiée » (reçu) ; une ligne
--     dont un formateur a retiré l'absence annoncée (non absente, notre observation) garde sa correction ;
--   sinon, une absence de quelques heures en cours : seulement l'observation « Absent de 10 h à 11 h, prévenu » (aucune absence posée) ;
--   sinon (absences annulées) : une ligne « annoncee » redevient présente, notre observation est retirée, une ligne vide disparaît.
-- Une feuille close n'est jamais touchée (ni pour poser ni pour retirer : ni l'état, ni l'origine, ni l'observation) : la corriger reste
-- un geste du formateur, qui la rouvre (ruling R-T14a). La feuille est verrouillée en partage le temps du pré-marquage (emargement_clore la
-- verrouille pour la clore).
-- Une ligne signée (ou dont la signature a été effacée) n'est jamais touchée ; une observation d'un formateur n'est jamais remplacée.
-- Une ligne n'est créée que pour un stagiaire encore actif dans la promo de la feuille. maj_par reste nul (écriture de l'espace contact :
-- l'adresse de qui a déclenché, un stagiaire parfois, n'y est jamais écrite).
create function public._contact_premarquer(p_seance bigint, p_stagiaire integer default null)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s emargement_seances%rowtype;
  x record;
  l emargement_lignes%rowtype;
  v_obs text;
  v_absent boolean;
  v_origine text;
  v_observation text;
begin
  select * into s from emargement_seances y where y.id = p_seance for share;
  if s.id is null or s.statut <> 'ouverte' then
    return;
  end if;
  for x in
    select a.stagiaire_id,
           coalesce(bool_or(d.etat <> 'annulee' and a.quand <> 'heures'), false) as entiere,
           coalesce(bool_or(d.etat <> 'annulee' and a.quand <> 'heures' and a.justificatif = 'recu'), false) as justifiee,
           (array_agg(_contact_observation_heures(a.heure_debut, a.heure_fin) order by a.heure_debut, a.demande_id)
              filter (where d.etat <> 'annulee' and a.quand = 'heures'))[1] as heures,
           bool_and(st.promo_id = s.promo_id and st.actif and st.efface_le is null and st.anonymise_le is null) as present
      from absences_annoncees a
      join demandes d on d.id = a.demande_id
      join stagiaires st on st.id = a.stagiaire_id
     where a.promo_id = s.promo_id and (p_stagiaire is null or a.stagiaire_id = p_stagiaire)
       and s.jour between a.du and a.au
       and _contact_jours_absence(a.promo_id, a.du, a.au, a.quand, a.heure_debut)
           @> jsonb_build_array(jsonb_build_object('jour', s.jour::text, 'demi', s.demi_journee))
     group by a.stagiaire_id
     order by a.stagiaire_id
  loop
    l := null;
    select * into l from emargement_lignes y where y.seance_id = s.id and y.stagiaire_id = x.stagiaire_id for update;
    if l.trace is not null or l.signe_le is not null then
      continue;
    end if;
    v_obs := case when x.entiere then case when x.justifiee then 'Absence justifiée' else 'Absence prévenue' end else x.heures end;
    if l.id is null then
      if x.present and v_obs is not null then
        insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, observation, maj_par)
          values (s.id, s.promo_id, x.stagiaire_id, x.entiere, case when x.entiere then 'annoncee' end, v_obs, null);
      end if;
      continue;
    end if;
    if x.entiere and not l.absent and l.observation in ('Absence prévenue', 'Absence justifiée') then
      -- Un formateur a retiré l'absence annoncée (le stagiaire est venu) : sa correction tient, seule l'observation suit.
      v_absent := false;
      v_origine := l.absence_origine;
      v_observation := v_obs;
    elsif x.entiere then
      v_absent := true;
      v_origine := case when not l.absent or l.absence_origine in ('planning', 'non_signe') then 'annoncee' else l.absence_origine end;
      v_observation := case when l.observation is null or _contact_observation_nous(l.observation) then v_obs else l.observation end;
    else
      v_absent := case when l.absence_origine = 'annoncee' then false else l.absent end;
      v_origine := case when l.absence_origine = 'annoncee' then null else l.absence_origine end;
      v_observation := case when l.observation is null or _contact_observation_nous(l.observation) then v_obs else l.observation end;
    end if;
    if (v_absent, v_origine, v_observation) is distinct from (l.absent, l.absence_origine, l.observation) then
      update emargement_lignes set absent = v_absent, absence_origine = v_origine, observation = v_observation, maj_le = now(), maj_par = null
       where id = l.id;
      delete from emargement_lignes where id = l.id and trace is null and signe_le is null and not absent and observation is null;
    end if;
  end loop;
end $fn$;

-- Une feuille créée (emargement_ouvrir) : pré-marquée d'après les absences annoncées. Un échec du pré-marquage n'empêche jamais
-- d'ouvrir la feuille (l'émargement passe avant) : il est annulé seul et signalé par un avertissement.
create function public._contact_emargement_seance()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  begin
    perform _contact_premarquer(new.id);
  exception when others then
    raise warning 'contact_3 : pré-marquage de la feuille % impossible (%)', new.id, sqlstate;
  end;
  return null;
end $fn$;

-- Une absence créée : les feuilles déjà ouvertes de ses demi-journées sont pré-marquées à l'instant pour son stagiaire (une feuille close
-- ne bouge pas, _contact_premarquer). Son justificatif changé : seule l'observation des lignes encore absentes d'une feuille ouverte suit
-- (« Absence prévenue » ou « Absence justifiée ») ; aucune absence n'est reposée sur une ligne qu'un formateur a corrigée entre-temps.
create function public._contact_emargement_absence()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  x record;
  v_obs text;
begin
  if tg_op = 'UPDATE' then
    if old.justificatif is not distinct from new.justificatif or new.quand = 'heures'
       or not exists (select 1 from demandes d where d.id = new.demande_id and d.etat <> 'annulee') then
      return null;
    end if;
    v_obs := case when new.justificatif = 'recu' then 'Absence justifiée' else 'Absence prévenue' end;
    update emargement_lignes l set observation = v_obs, maj_le = now(), maj_par = null
      from emargement_seances s
     where s.id = l.seance_id and s.promo_id = new.promo_id and s.statut = 'ouverte' and l.stagiaire_id = new.stagiaire_id
       and l.absent and l.trace is null and l.signe_le is null
       and l.observation in ('Absence prévenue', 'Absence justifiée') and l.observation <> v_obs
       and s.jour between new.du and new.au
       and _contact_jours_absence(new.promo_id, new.du, new.au, new.quand, new.heure_debut)
           @> jsonb_build_array(jsonb_build_object('jour', s.jour::text, 'demi', s.demi_journee));
    return null;
  end if;
  for x in select s.id from emargement_seances s where s.promo_id = new.promo_id and s.jour between new.du and new.au order by s.id loop
    perform _contact_premarquer(x.id, new.stagiaire_id);
  end loop;
  return null;
end $fn$;

-- Une absence annulée : ses feuilles ouvertes sont reprises pour son stagiaire (lignes « annoncee » rendues, observations retirées) ; une
-- feuille close garde sa ligne telle quelle (_contact_premarquer).
create function public._contact_emargement_annulation()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  a absences_annoncees%rowtype;
  x record;
begin
  select * into a from absences_annoncees y where y.demande_id = new.id;
  if a.demande_id is null then
    return null;
  end if;
  for x in select s.id from emargement_seances s where s.promo_id = a.promo_id and s.jour between a.du and a.au order by s.id loop
    perform _contact_premarquer(x.id, a.stagiaire_id);
  end loop;
  return null;
end $fn$;

create trigger emargement_seances_annoncees after insert on public.emargement_seances
  for each row execute function public._contact_emargement_seance();
create trigger absences_annoncees_emargement after insert or update on public.absences_annoncees
  for each row execute function public._contact_emargement_absence();
create trigger absences_annoncees_emargement after update of etat on public.demandes
  for each row when (new.type = 'absence' and new.etat = 'annulee' and old.etat is distinct from 'annulee')
  execute function public._contact_emargement_annulation();

-- 7. La conservation : une fiche rendue anonyme (anonymise_le posé, étape 2 de la conservation ou effacement sur demande) perd le motif
--    de ses absences ; la ligne (jours, moment, justificatif) reste, preuve de présence comme l'émargement.
create function public._contact_anonymiser_stagiaire()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  update absences_annoncees set motif = null where stagiaire_id = new.id and motif is not null;
  return null;
end $fn$;

create trigger stagiaires_contact_anonymiser after update of anonymise_le on public.stagiaires
  for each row when (old.anonymise_le is null and new.anonymise_le is not null) execute function public._contact_anonymiser_stagiaire();

-- Droits : les fonctions de l'app à tout compte connecté ; les aides internes et les fonctions de déclencheur à personne. Les huit
-- fonctions redéfinies gardent leurs droits (create or replace).
revoke all on function public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[]) from public, anon, service_role;
grant execute on function public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[]) to authenticated;
revoke all on function public.regler_justificatif(bigint, text) from public, anon, service_role;
grant execute on function public.regler_justificatif(bigint, text) to authenticated;
revoke all on function public.mes_justificatifs_a_remettre() from public, anon, service_role;
grant execute on function public.mes_justificatifs_a_remettre() to authenticated;
revoke all on function public.absences_annoncees_semaine(date) from public, anon, service_role;
grant execute on function public.absences_annoncees_semaine(date) to authenticated;
revoke all on function public._contact_debut_demi(integer, date, text) from public, anon, authenticated, service_role;
revoke all on function public._contact_jours_absence(integer, date, date, text, text) from public, anon, authenticated, service_role;
revoke all on function public._contact_jours_demande(bigint) from public, anon, authenticated, service_role;
revoke all on function public._contact_absence_debut(bigint) from public, anon, authenticated, service_role;
revoke all on function public._contact_annexes(integer, integer, jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_formateur_de(integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_absence_gestes(bigint, text, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_annuler_absence(bigint, integer, bigint) from public, anon, authenticated, service_role;
revoke all on function public._contact_appliquer_justificatif(bigint, text) from public, anon, authenticated, service_role;
revoke all on function public._contact_absence_reponse(bigint, bigint) from public, anon, authenticated, service_role;
revoke all on function public._contact_observation_heures(text, text) from public, anon, authenticated, service_role;
revoke all on function public._contact_observation_nous(text) from public, anon, authenticated, service_role;
revoke all on function public._contact_premarquer(bigint, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_emargement_seance() from public, anon, authenticated, service_role;
revoke all on function public._contact_emargement_absence() from public, anon, authenticated, service_role;
revoke all on function public._contact_emargement_annulation() from public, anon, authenticated, service_role;
revoke all on function public._contact_anonymiser_stagiaire() from public, anon, authenticated, service_role;

-- Contrôle de fin : la table n'a aucun droit pour l'API ; aucune aide _contact_* ne s'exécute par anon ni authenticated (sauf
-- _contact_compte_equipe, migration 1) ; les quatre fonctions de l'app et les cinq redéfinies de l'app s'exécutent par authenticated et
-- jamais par anon (les _contact_srv_* par service_role, toujours sept) ; la contrainte d'origine admet « annoncee » ; les quatre déclencheurs sont là.
do $controle$
declare
  f record;
begin
  if has_table_privilege('anon', 'public.absences_annoncees', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_table_privilege('authenticated', 'public.absences_annoncees', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_any_column_privilege('anon', 'public.absences_annoncees', 'SELECT, INSERT, UPDATE, REFERENCES')
     or has_any_column_privilege('authenticated', 'public.absences_annoncees', 'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'contact_3 : la table absences_annoncees garde un droit pour anon ou authenticated ; tout est annulé';
  end if;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname like '\_contact\_%' and p.proname <> '_contact_compte_equipe' loop
    if has_function_privilege('anon', f.sig, 'EXECUTE') or has_function_privilege('authenticated', f.sig, 'EXECUTE') then
      raise exception 'contact_3 : l''aide interne % s''exécute par anon ou authenticated ; tout est annulé', f.sig;
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('prevenir_absence', 'regler_justificatif', 'mes_justificatifs_a_remettre', 'absences_annoncees_semaine',
                                'apercu_envoi', 'liste_demandes', 'demande_detail', 'annuler_demande', 'repondre_demande') loop
    if has_function_privilege('anon', f.sig, 'EXECUTE') or not has_function_privilege('authenticated', f.sig, 'EXECUTE') then
      raise exception 'contact_3 : la fonction % n''a pas ses droits (authenticated seul) ; tout est annulé', f.sig;
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in ('_contact_srv_prendre', '_contact_srv_lien', '_contact_srv_agir') loop
    if not has_function_privilege('service_role', f.sig, 'EXECUTE') then
      raise exception 'contact_3 : la fonction % ne s''exécute pas par service_role ; tout est annulé', f.sig;
    end if;
  end loop;
  if (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like '\_contact\_srv\_%') <> 7 then
    raise exception 'contact_3 : les sept fonctions _contact_srv_* ne sont pas toutes là ; tout est annulé';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public.emargement_lignes'::regclass and c.conname = 'emargement_lignes_absence_origine_check')
     not like '%''annoncee''%' then
    raise exception 'contact_3 : la contrainte d''origine de l''émargement n''admet pas « annoncee » ; tout est annulé';
  end if;
  if (select count(*) from pg_trigger where not tgisinternal
       and (tgrelid, tgname) in (('public.emargement_seances'::regclass::oid, 'emargement_seances_annoncees'),
                                 ('public.absences_annoncees'::regclass::oid, 'absences_annoncees_emargement'),
                                 ('public.demandes'::regclass::oid, 'absences_annoncees_emargement'),
                                 ('public.stagiaires'::regclass::oid, 'stagiaires_contact_anonymiser'))) <> 4 then
    raise exception 'contact_3 : un des quatre déclencheurs manque ; tout est annulé';
  end if;
end $controle$;
