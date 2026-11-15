-- Espace contact, migration 2 (parties A, B et C) : les demandes, leur routage, leur création, leur suivi.
-- Spec : docs/superpowers/specs/2026-11-09-espace-contact-design.md ; plan : docs/superpowers/plans/2026-11-14-espace-contact.md
-- (tâches 8 à 10, choix C-5, C-8, C-9, C-17, C-21 à C-23, décisions de Timy du 14/11 : Q4, Q8).
--   Partie A (tâche 8) :
--   1. Les tables (RLS active, aucune règle, aucun droit pour anon et authenticated, C-9 : lectures et écritures par fonctions) :
--      demandes, demande_destinataires, demande_messages, contact_regles, contact_reponses (quatre réponses toutes faites livrées
--      à chaque centre, puis à chaque centre créé), contact_envois, contact_jetons.
--   2. L'horloge remplaçable (C-21) : _contact_maintenant(), _contact_jour() (jour de Paris) ; les jours d'une demande (C-22).
--   3. Le routage (C-8 amendé par Q8) : _contact_destinataires() (règle type et financement, règle type, personne par défaut ; une
--      fiche indisponible passe à son relais, sinon à la personne par défaut ; zéro ligne = mode choix) et _contact_possibles()
--      (formateurs à titre fixe de la promo, direction réelle du centre ; formateurs du jour pré-cochés). Miroir : js/contact-rules.js,
--      table de cas commune tests/fixtures/contact-routage.json.
--   4. La création : destinataires_possibles(), apercu_envoi() (lectures du stagiaire), ecrire_au_centre() (règle ou choix du
--      stagiaire), ecrire_a() (une fiche du centre), ecrire_au_stagiaire() (l'équipe vers un stagiaire de son centre). Chacune écrit
--      la demande, ses destinataires et une ligne d'envoi « nouvelle » par destinataire dans la même transaction, et purge (C-17).
--      Garde-fous : stagiaire de la promo affichée sans affectation ni droit d'administration ; dix demandes par jour de Paris ;
--      liste vide en mode choix : refus, rien n'est écrit (Q4) ; un choisi hors liste : refus ; jamais de stagiaire vers stagiaire.
--   Partie B (tâche 9) :
--   5. Les alertes par e-mail : user_profiles.alertes_email, regler_mes_alertes() ; _contact_envoyer(), seule écriture d'un envoi (un
--      compte qui a coupé ses alertes : envoi « ignore », raison « alertes coupees »).
--   6. Qui lit une demande : _contact_direction_reelle(), _contact_ma_fiche(), _contact_role(), _contact_lecteur() (auteur, principal,
--      annexe_formateur, delegue, direction ; l'ordre décide), _contact_peut() (seule source des gestes permis).
--   7. Les lectures : liste_demandes() (les siennes ; avec un centre, toutes celles du centre pour sa direction réelle ; le délégué ne voit
--      que le type, l'auteur, les dates et les jours), demande_detail(), marquer_lue() (C-15).
--   8. Les gestes : repondre_demande(), prendre_en_compte(), annuler_demande(), relancer_envoi() ; une seule écriture de la réponse et de
--      la prise (_contact_appliquer_reponse, _contact_appliquer_prise), que la partie C appelle aussi depuis un lien d'e-mail.
--   9. Les réglages du centre : reglages_contact(), regler_qui_recoit_quoi() (une règle ne vise qu'une fiche de ce centre),
--      regler_reponses().
--   10. La conservation : déclencheur stagiaires_contact_effacer (fiche effacée : ses demandes hors absence supprimées, ses absences
--      vidées de leur texte, de leurs réponses, envois et jetons) ; purges à l'écriture (C-17) par _contact_purger (section 4).
--   Partie C (tâche 10) :
--   11. La file des envois et les liens d'e-mail, pour la fonction serveur contact-envois (service_role seul) : _contact_srv_prendre()
--       (envois à faire passés « en cours », sans sujet, texte ni motif), _contact_srv_jetons() (hachés sha256, 14 jours),
--       _contact_srv_resultat() (envoyé, ignoré, à retenter puis échec), _contact_srv_lien() (lecture, n'écrit rien), _contact_srv_agir()
--       (prise ou réponse toute faite au nom de la fiche du jeton, une seule fois) ; aides _contact_srv_jeton(), _contact_srv_deja().
-- Garde : la migration 1 est appliquée (ma_fiche_contact, contact_financements, _contact_fiche_dans) ; rien de la migration 2 n'existe
-- (ni ses tables, ni ecrire_au_centre, ni liste_demandes, ni user_profiles.alertes_email) ; sinon rien ne change.
-- Marche arrière : 20261115_contact_2_demandes_retour.sql (refusée tant que la migration 3 est appliquée).
set local lock_timeout = '3s';

do $garde$
begin
  if to_regprocedure('public.ma_fiche_contact()') is null or to_regclass('public.contact_financements') is null
     or to_regprocedure('public._contact_fiche_dans(public.contacts, integer)') is null then
    raise exception 'contact_2 : la migration 1 (20261115_contact_1_annuaire.sql) n''est pas appliquée ; rien n''est changé';
  end if;
  if to_regclass('public.demandes') is not null or to_regclass('public.demande_destinataires') is not null
     or to_regclass('public.demande_messages') is not null or to_regclass('public.contact_regles') is not null
     or to_regclass('public.contact_reponses') is not null or to_regclass('public.contact_envois') is not null
     or to_regclass('public.contact_jetons') is not null
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('ecrire_au_centre', 'liste_demandes'))
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'alertes_email') then
    raise exception 'contact_2 : une table ou une fonction de la migration 2 existe déjà, migration déjà appliquée ? rien n''est changé';
  end if;
end $garde$;

-- ===== Partie A : demandes, routage, création =====

-- 1. Les tables.
create table public.demandes (
  id bigint generated by default as identity primary key,
  lieu_id integer not null references public.lieux (id),
  promo_id integer references public.promos (id),
  auteur_stagiaire_id integer references public.stagiaires (id) on delete cascade,
  -- La fiche d'un auteur de l'équipe peut disparaître avec sa dernière affectation (C-5) : le nom reste dans auteur_nom.
  auteur_fiche_id bigint references public.contacts (id) on delete set null,
  auteur_nom text not null,
  type text constraint demandes_type check (type in ('absence', 'retard', 'administratif', 'document', 'autre')),
  sujet text constraint demandes_sujet check (char_length(sujet) between 1 and 80),
  texte text constraint demandes_texte check (char_length(texte) <= 1000),
  etat text not null default 'envoyee' constraint demandes_etat check (etat in ('envoyee', 'prise', 'annulee')),
  cree_le timestamptz not null default now(),
  prise_le timestamptz,
  prise_par text,
  annulee_le timestamptz,
  annulee_par text,
  dernier_echange_le timestamptz not null default now(),
  constraint demandes_un_auteur check (num_nonnulls(auteur_stagiaire_id, auteur_fiche_id) <= 1)
);
create index demandes_lieu_echange on public.demandes (lieu_id, dernier_echange_le);
create index demandes_auteur_stagiaire on public.demandes (auteur_stagiaire_id, cree_le);

create table public.demande_destinataires (
  id bigint generated by default as identity primary key,
  demande_id bigint not null references public.demandes (id) on delete cascade,
  fiche_id bigint references public.contacts (id) on delete set null,
  stagiaire_id integer references public.stagiaires (id) on delete cascade,
  nom text not null,
  principal boolean not null,
  annexe text constraint demande_destinataires_annexe check (annexe in ('formateur_du_jour', 'delegue')),
  relais_de text,
  non_prevenu text,
  lue_le timestamptz,
  lue_par text,
  constraint demande_destinataires_principal check (principal = (annexe is null))
);
create index demande_destinataires_demande on public.demande_destinataires (demande_id);
create index demande_destinataires_fiche on public.demande_destinataires (fiche_id);
create index demande_destinataires_stagiaire on public.demande_destinataires (stagiaire_id);

create table public.contact_reponses (
  id bigint generated by default as identity primary key,
  lieu_id integer not null references public.lieux (id) on delete cascade,
  libelle text not null constraint contact_reponses_libelle check (char_length(libelle) between 1 and 80),
  vaut_prise boolean not null default true,
  demande_justificatif boolean not null default false,
  ordre integer not null default 0,
  retire boolean not null default false
);
create index contact_reponses_lieu on public.contact_reponses (lieu_id);

-- Le texte initial vit dans demandes.texte (C-23) : demande_messages ne porte que les réponses, un texte ou une réponse toute faite.
create table public.demande_messages (
  id bigint generated by default as identity primary key,
  demande_id bigint not null references public.demandes (id) on delete cascade,
  auteur_email text,
  auteur_nom text not null,
  texte text constraint demande_messages_texte check (char_length(texte) between 1 and 1000),
  reponse_id bigint references public.contact_reponses (id),
  par_lien boolean not null default false,
  cree_le timestamptz not null default now(),
  constraint demande_messages_contenu check (texte is not null or reponse_id is not null)
);
create index demande_messages_demande on public.demande_messages (demande_id, cree_le);

-- Qui reçoit quoi : une règle par (centre, type, financement) ; type « defaut » : la personne par défaut du centre (une fiche, sans
-- financement). « formateurs_du_jour » : absence et retard seulement. Une fiche supprimée emporte ses règles.
create table public.contact_regles (
  id bigint generated by default as identity primary key,
  lieu_id integer not null references public.lieux (id) on delete cascade,
  type text not null constraint contact_regles_type
    check (type in ('absence', 'retard', 'administratif', 'document', 'autre', 'defaut')),
  financement_id bigint references public.contact_financements (id) on delete cascade,
  cible text not null constraint contact_regles_cible check (cible in ('fiche', 'formateurs_du_jour')),
  fiche_id bigint references public.contacts (id) on delete cascade,
  constraint contact_regles_fiche check ((cible = 'fiche') = (fiche_id is not null)),
  constraint contact_regles_formateurs_du_jour check (cible <> 'formateurs_du_jour' or type in ('absence', 'retard')),
  constraint contact_regles_defaut check (type <> 'defaut' or financement_id is null)
);
create unique index contact_regles_unique on public.contact_regles (lieu_id, type, financement_id) nulls not distinct;
create index contact_regles_fiche on public.contact_regles (fiche_id);

create table public.contact_envois (
  id bigint generated by default as identity primary key,
  demande_id bigint not null references public.demandes (id) on delete cascade,
  vers_fiche_id bigint references public.contacts (id) on delete set null,
  vers_stagiaire_id integer references public.stagiaires (id) on delete cascade,
  evenement text not null constraint contact_envois_evenement
    check (evenement in ('nouvelle', 'reponse', 'prise', 'annulation', 'avis_absence', 'annulation_absence', 'justificatif_recu')),
  etat text not null default 'a_envoyer' constraint contact_envois_etat
    check (etat in ('a_envoyer', 'en_cours', 'envoye', 'a_retenter', 'echec', 'ignore')),
  raison text,
  tentatives integer not null default 0,
  prochain_essai_le timestamptz,
  envoye_le timestamptz,
  cree_le timestamptz not null default now()
);
create index contact_envois_demande on public.contact_envois (demande_id);
create index contact_envois_etat on public.contact_envois (etat, prochain_essai_le);

-- Un jeton par envoi et par action : seul le haché est en base (C-11).
create table public.contact_jetons (
  hash bytea primary key,
  envoi_id bigint references public.contact_envois (id) on delete cascade,
  demande_id bigint not null references public.demandes (id) on delete cascade,
  fiche_id bigint not null references public.contacts (id) on delete cascade,
  action text not null constraint contact_jetons_action check (action in ('voir', 'prise', 'reponse', 'justificatif')),
  reponse_id bigint references public.contact_reponses (id),
  expire_le timestamptz not null,
  utilise_le timestamptz
);
create index contact_jetons_envoi on public.contact_jetons (envoi_id);
create index contact_jetons_demande on public.contact_jetons (demande_id);

alter table public.demandes enable row level security;
alter table public.demande_destinataires enable row level security;
alter table public.demande_messages enable row level security;
alter table public.contact_regles enable row level security;
alter table public.contact_reponses enable row level security;
alter table public.contact_envois enable row level security;
alter table public.contact_jetons enable row level security;
revoke all on public.demandes, public.demande_destinataires, public.demande_messages, public.contact_regles, public.contact_reponses,
              public.contact_envois, public.contact_jetons from public, anon, authenticated;
revoke all on sequence public.demandes_id_seq, public.demande_destinataires_id_seq, public.demande_messages_id_seq,
                       public.contact_regles_id_seq, public.contact_reponses_id_seq, public.contact_envois_id_seq
  from public, anon, authenticated;

-- Les réponses toutes faites livrées d'office, à chaque centre existant puis à chaque centre créé.
create function public._contact_poser_reponses(l integer)
returns void language sql security definer set search_path = public, pg_temp
as $fn$
  insert into contact_reponses (lieu_id, libelle, vaut_prise, demande_justificatif, ordre)
  select l, d.libelle, true, d.justificatif, d.ordre
    from (values ('Bien reçu', false, 10), ('Absence enregistrée', false, 20),
                 ('Absence enregistrée, pense à remettre ton justificatif', true, 30),
                 ('Merci de passer au secrétariat', false, 40)) d(libelle, justificatif, ordre)
   where not exists (select 1 from contact_reponses r where r.lieu_id = l);
$fn$;

create function public._contact_reponses_defaut()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  perform _contact_poser_reponses(new.id);
  return null;
end $fn$;

do $reponses$
begin
  perform public._contact_poser_reponses(l.id) from public.lieux l;
end $reponses$;

create trigger lieux_reponses_defaut after insert on public.lieux
  for each row execute function public._contact_reponses_defaut();

-- 2. L'horloge (C-21) : seule source du « maintenant » de l'espace contact ; une preuve la remplace dans sa transaction.
create function public._contact_maintenant()
returns timestamptz language sql stable security definer set search_path = public, pg_temp
as $fn$
  select now();
$fn$;

create function public._contact_jour()
returns date language sql stable security definer set search_path = public, pg_temp
as $fn$
  select (public._contact_maintenant() at time zone 'Europe/Paris')::date;
$fn$;

-- La demi-journée en cours dans la promo p, au jour de Paris : l'après-midi commence à l'heure saisie au planning ce jour-là
-- (planning_half_meta, aprem), sinon à 13:30 (C-24).
create function public._contact_demi_courante(p integer)
returns text language sql stable security definer set search_path = public, pg_temp
as $fn$
  with x as (select _contact_jour() as j, (_contact_maintenant() at time zone 'Europe/Paris')::time as h)
  select case when x.h >= coalesce((select hm.start_time::time from planning_half_meta hm
                                     where hm.promo_id = p and hm.half_day = 'aprem'
                                       and hm.semaine_lundi = x.j - (extract(isodow from x.j)::integer - 1)
                                       and hm.day_index = extract(isodow from x.j)::integer - 1
                                       and pg_input_is_valid(hm.start_time, 'time')
                                     limit 1), time '13:30')
              then 'aprem' else 'matin' end
    from x;
$fn$;

-- Les jours d'une demande (C-22), sous leur seule forme [{"jour":"AAAA-MM-JJ","demi":"matin"|"aprem"}] : absence, ceux qu'on donne
-- (62 demi-journées au plus, sans doublon) ; retard, le jour de création et la demi-journée en cours ; tout autre type, aucun.
create function public._contact_jours(p_type text, p_jours jsonb, p integer)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  e jsonb;
begin
  if p_type = 'retard' then
    return jsonb_build_array(jsonb_build_object('jour', _contact_jour()::text, 'demi', _contact_demi_courante(p)));
  end if;
  if p_type is distinct from 'absence' or p_jours is null or p_jours = 'null'::jsonb then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_jours) <> 'array' or jsonb_array_length(p_jours) > 62 then
    raise exception 'contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée.';
  end if;
  for e in select x from jsonb_array_elements(p_jours) x loop
    -- Chaque entrée : un objet de deux clés exactement, jour (une date lisible) et demi (matin ou aprem). Toute valeur absente ou nulle
    -- rend la condition vraie (coalesce) : jamais d'entrée acceptée par défaut.
    if coalesce(jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'jour') <> 'string' or not pg_input_is_valid(e ->> 'jour', 'date')
                or (e ->> 'demi') not in ('matin', 'aprem') or (select count(*) from jsonb_object_keys(e)) <> 2, true) then
      raise exception 'contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée.';
    end if;
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('jour', d.jour::text, 'demi', d.demi) order by d.jour, d.demi desc), '[]'::jsonb)
            from (select distinct (x ->> 'jour')::date as jour, x ->> 'demi' as demi from jsonb_array_elements(p_jours) x) d);
end $fn$;

-- 3. Le routage.
-- Le nom d'une fiche dans le centre l : la ligne profs rattachée, sinon prénom et nom, sinon le libellé d'une fiche sans compte, sinon les
-- titres de la personne dans ce centre (C-6).
create function public._contact_nom_fiche(c public.contacts, l integer)
returns text language sql stable security definer set search_path = public, pg_temp
as $fn$
  select coalesce((select pf.nom from profs pf where pf.id = c.prof_id), nullif(btrim(concat_ws(' ', c.prenom, c.nom)), ''),
                  case when c.compte_email is null then c.role end,
                  (select string_agg(distinct ti.nom, ', ' order by ti.nom) from affectations a join titres ti on ti.id = a.titre_id
                    where lower(a.email) = c.compte_email
                      and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = l))
                           or (a.role = 'direction' and a.lieu_id = l))));
$fn$;

-- Une fiche peut-elle recevoir une demande dans le centre l au jour j ? Du centre, joignable (un compte ou un e-mail), pas en congé, pas
-- partie (date de départ passée).
create function public._contact_disponible(c public.contacts, l integer, j date)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select c.id is not null and _contact_fiche_dans(c, l)
     and (c.compte_email is not null or c.email is not null)
     and not coalesce(c.conge_du <= j and j <= c.conge_au, false)
     and (c.depart_le is null or c.depart_le >= j);
$fn$;

-- Une affectation de direction à titre fixe sur le centre l pour cette adresse : la direction réelle (un titre non fixe n'en est pas).
create function public._contact_direction_reelle_de(p_email text, l integer)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select exists (select 1 from affectations a join titres t on t.id = a.titre_id
                  where lower(a.email) = lower(p_email) and a.role = 'direction' and a.lieu_id = l and t.fixe);
$fn$;

-- Les fiches du centre l rattachées (profs) aux formateurs du planning de la promo p, aux demi-journées de p_jours (déjà lus).
create function public._contact_formateurs_du_jour(p_lieu integer, p_promo integer, p_jours jsonb)
returns setof bigint language sql stable security definer set search_path = public, pg_temp
as $fn$
  select distinct c.id
    from jsonb_array_elements(coalesce(p_jours, '[]'::jsonb)) e
    cross join lateral (select (e ->> 'jour')::date as d, e ->> 'demi' as demi) x
    join planning_entries pe on pe.promo_id = p_promo and pe.half_day = x.demi
                            and pe.semaine_lundi = x.d - (extract(isodow from x.d)::integer - 1)
                            and pe.day_index = extract(isodow from x.d)::integer - 1
    join contacts c on c.prof_id = pe.prof_id or c.prof_id = any(pe.prof_ids)
   where _contact_fiche_dans(c, p_lieu);
$fn$;

-- Les destinataires principaux d'une demande (C-8, Q8). Source : regle_type_financement, regle_type ou defaut. Le jour de création
-- (_contact_jour) juge le congé et le départ. Zéro ligne : mode choix.
create function public._contact_destinataires(p_lieu integer, p_promo integer, p_type text, p_financement bigint, p_jours jsonb)
returns table (fiche_id bigint, nom text, relais_de text, source text)
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
#variable_conflict use_column
declare
  v_jour date := _contact_jour();
  r contact_regles%rowtype;
  d contact_regles%rowtype;
  t contacts%rowtype;
  v_source text;
begin
  if p_financement is not null then
    select * into r from contact_regles x where x.lieu_id = p_lieu and x.type = p_type and x.financement_id = p_financement;
    if found then v_source := 'regle_type_financement'; end if;
  end if;
  if v_source is null then
    select * into r from contact_regles x where x.lieu_id = p_lieu and x.type = p_type and x.financement_id is null;
    if found then v_source := 'regle_type'; end if;
  end if;
  select * into d from contact_regles x where x.lieu_id = p_lieu and x.type = 'defaut' and x.financement_id is null;
  if v_source is null and d.id is not null then
    r := d;
    v_source := 'defaut';
  end if;
  if v_source is null then
    return;
  end if;
  if r.cible = 'formateurs_du_jour' then
    return query
      select c.id, _contact_nom_fiche(c, p_lieu), null::text, v_source
        from contacts c
       where c.id in (select f from _contact_formateurs_du_jour(p_lieu, p_promo, p_jours) f)
         and _contact_disponible(c, p_lieu, v_jour)
       order by c.id;
    if found then return; end if;
  else
    select * into t from contacts c where c.id = r.fiche_id;
    if _contact_disponible(t, p_lieu, v_jour) then
      return query select t.id, _contact_nom_fiche(t, p_lieu), null::text, v_source;
      return;
    end if;
    return query
      select c.id, _contact_nom_fiche(c, p_lieu), _contact_nom_fiche(t, p_lieu), v_source
        from contacts c
       where c.id = t.relais_id and _contact_disponible(c, p_lieu, v_jour);
    if found then return; end if;
  end if;
  return query
    select c.id, _contact_nom_fiche(c, p_lieu), null::text, 'defaut'::text
      from contacts c
     where d.id is not null and c.id = d.fiche_id and _contact_disponible(c, p_lieu, v_jour);
end $fn$;

-- Ceux que le stagiaire peut choisir en mode choix : les fiches des comptes à titre fixe Formateur de la promo et à titre fixe
-- Direction de centre du centre (direction réelle) ; pré-cochés : les formateurs du jour de p_jours (absence et retard).
create function public._contact_possibles(p_lieu integer, p_promo integer, p_jours jsonb)
returns table (fiche_id bigint, nom text, titre text, pre_coche boolean)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with equipe as (
    select lower(a.email) as email, t.nom as titre
      from affectations a join titres t on t.id = a.titre_id
     where t.fixe and a.role = 'formateur' and a.promo_id = p_promo
    union
    select lower(a.email), t.nom
      from affectations a join titres t on t.id = a.titre_id
     where t.fixe and a.role = 'direction' and a.lieu_id = p_lieu and _contact_direction_reelle_de(a.email, p_lieu)
  ), fdj as (
    select f from _contact_formateurs_du_jour(p_lieu, p_promo, p_jours) f
  )
  select c.id, _contact_nom_fiche(c, p_lieu), string_agg(distinct e.titre, ', ' order by e.titre),
         c.id in (select f from fdj)
    from contacts c
    join equipe e on e.email = c.compte_email
   where p_promo is not null and p_lieu is not null and lieu_de_promo(p_promo) = p_lieu
   group by c.id
   order by 2, 1;
$fn$;

-- 4. La création.
-- Le stagiaire appelant : sa fiche dans la promo affichée, non effacée, hors aperçu, et un compte sans affectation, ni administration, ni
-- fondateur. Nul sinon.
create function public._contact_stagiaire()
returns integer language sql stable security definer set search_path = public, pg_temp
as $fn$
  select s.id
    from user_profiles up
    join stagiaires s on s.id = up.stagiaire_id
   where lower(up.email) = lower(auth.jwt() ->> 'email')
     and s.promo_id = promo_courante() and s.efface_le is null
     and apercu_role() is null and not fondateur_reel()
     and not coalesce(up.is_admin, false) and not coalesce(up.is_founder, false)
     and not exists (select 1 from user_profiles autre where lower(autre.email) = lower(up.email)
                      and (coalesce(autre.is_admin, false) or coalesce(autre.is_founder, false)))
     and not exists (select 1 from affectations a where lower(a.email) = lower(up.email))
   order by s.id
   limit 1;
$fn$;

-- La fiche de l'équipe de l'appelant, si elle est dans le centre l, hors aperçu. Nulle sinon.
create function public._contact_fiche_equipe(l integer)
returns bigint language sql stable security definer set search_path = public, pg_temp
as $fn$
  select c.id from contacts c
   where c.compte_email = lower(auth.jwt() ->> 'email') and apercu_role() is null and _contact_fiche_dans(c, l);
$fn$;

-- Sujet et texte d'une demande : espaces de bord retirés ; sujet de 1 à 80 caractères ; texte de 1000 au plus (vide : aucun).
create function public._contact_sujet(p_sujet text)
returns text language plpgsql immutable security definer set search_path = public, pg_temp
as $fn$
declare
  v text := btrim(coalesce(p_sujet, ''));
begin
  if char_length(v) not between 1 and 80 then
    raise exception 'contact: Le sujet compte de 1 à 80 caractères.';
  end if;
  return v;
end $fn$;

create function public._contact_texte(p_texte text)
returns text language plpgsql immutable security definer set search_path = public, pg_temp
as $fn$
declare
  v text := nullif(btrim(coalesce(p_texte, '')), '');
begin
  if char_length(v) > 1000 then
    raise exception 'contact: Le message compte 1000 caractères au plus.';
  end if;
  return v;
end $fn$;

-- Au plus dix demandes créées par un stagiaire par jour de Paris (verrou par stagiaire : deux envois simultanés ne passent pas tous deux).
create function public._contact_quota(s integer)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  perform pg_advisory_xact_lock(hashtext('contact_demandes_du_jour'), s);
  if (select count(*) from demandes d
       where d.auteur_stagiaire_id = s
         and (d.cree_le at time zone 'Europe/Paris')::date = _contact_jour()) >= 10 then
    raise exception 'contact: Tu as déjà envoyé 10 demandes aujourd''hui. Appelle le centre si c''est urgent.';
  end if;
end $fn$;

-- Purge à l'écriture (C-17) : les demandes entre membres de l'équipe (aucun stagiaire auteur ni destinataire) 12 mois après le dernier
-- échange ; les envois 3 mois après leur création, les jetons 3 mois après leur expiration.
create function public._contact_purger()
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
begin
  delete from demandes d
   where d.auteur_stagiaire_id is null
     and d.dernier_echange_le < v_maintenant - interval '12 months'
     and not exists (select 1 from demande_destinataires x where x.demande_id = d.id and x.stagiaire_id is not null);
  delete from contact_envois e where e.cree_le < v_maintenant - interval '3 months';
  delete from contact_jetons j where j.expire_le < v_maintenant - interval '3 months';
end $fn$;

-- Une demande et ses destinataires principaux ([{fiche_id, stagiaire_id, nom, relais_de}]), avec une ligne d'envoi « nouvelle » par
-- destinataire (_contact_envoyer, section 5), dans la même transaction. Rend l'identifiant de la demande.
create function public._contact_creer(p_lieu integer, p_promo integer, p_stagiaire integer, p_fiche bigint, p_auteur text, p_type text,
                                      p_sujet text, p_texte text, p_destinataires jsonb)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
  v_id bigint;
  e jsonb;
begin
  if jsonb_typeof(p_destinataires) <> 'array' or jsonb_array_length(p_destinataires) = 0 then
    raise exception 'contact_2 : une demande sans destinataire ne se crée pas';
  end if;
  perform _contact_purger();
  insert into demandes (lieu_id, promo_id, auteur_stagiaire_id, auteur_fiche_id, auteur_nom, type, sujet, texte, cree_le, dernier_echange_le)
    values (p_lieu, p_promo, p_stagiaire, p_fiche, coalesce(nullif(btrim(p_auteur), ''), 'Sans nom'), p_type, p_sujet, p_texte,
            v_maintenant, v_maintenant)
    returning id into v_id;
  for e in select x from jsonb_array_elements(p_destinataires) x loop
    insert into demande_destinataires (demande_id, fiche_id, stagiaire_id, nom, principal, relais_de)
      values (v_id, (e ->> 'fiche_id')::bigint, (e ->> 'stagiaire_id')::integer, coalesce(nullif(e ->> 'nom', ''), 'Sans nom'), true,
              e ->> 'relais_de');
    perform _contact_envoyer(v_id, (e ->> 'fiche_id')::bigint, (e ->> 'stagiaire_id')::integer, 'nouvelle');
  end loop;
  return v_id;
end $fn$;

-- Le nom d'un stagiaire (prénom et nom de sa fiche).
create function public._contact_nom_stagiaire(s integer)
returns text language sql stable security definer set search_path = public, pg_temp
as $fn$
  select nullif(btrim(concat_ws(' ', st.prenom, st.nom)), '') from stagiaires st where st.id = s;
$fn$;

-- La lecture de la liste par le stagiaire de la promo affichée : en mode règle, aucune ligne (il ne choisit pas) ; en mode choix, ceux
-- qu'il peut cocher (pré-cochés : formateurs du jour, pour une absence ou un retard).
create function public.destinataires_possibles(p_type text, p_jours jsonb default null)
returns table (fiche_id bigint, nom text, titre text, pre_coche boolean)
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
#variable_conflict use_column
declare
  s integer := _contact_stagiaire();
  v_p integer;
  v_l integer;
  v_j jsonb;
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
  if exists (select 1 from _contact_destinataires(v_l, v_p, p_type,
                                                  (select sp.financement_id from stagiaires_prive sp where sp.stagiaire_id = s), v_j)) then
    return;
  end if;
  return query select x.fiche_id, x.nom, x.titre, x.pre_coche from _contact_possibles(v_l, v_p, v_j) x;
end $fn$;

-- Ce qui partira, sans rien écrire : {mode: "regle"|"choix", principaux: [{fiche_id, nom, relais_de}], possibles: [{fiche_id, nom,
-- titre, pre_coche}]} ; en mode choix, possibles vide : la demande sera refusée (l'écran le dit d'avance).
create function public.apercu_envoi(p_type text, p_jours jsonb default null)
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

-- Écrire au centre (stagiaire) : retard, administratif, document ou autre (l'absence a sa fonction, migration 3). Mode règle : la
-- demande part à qui la règle désigne, aucun choix permis ; mode choix : au moins un choisi, chacun dans la liste ; liste vide : refus,
-- rien n'est écrit (Q4).
create function public.ecrire_au_centre(p_type text, p_sujet text, p_texte text, p_choisis bigint[] default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  v_p integer;
  v_l integer;
  v_j jsonb;
  v_sujet text;
  v_texte text;
  v_dest jsonb;
  v_possibles jsonb;
begin
  if s is null then
    raise exception 'contact: Réservé aux stagiaires.' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('retard', 'administratif', 'document', 'autre') then
    raise exception 'contact: Type de demande inconnu.';
  end if;
  v_sujet := _contact_sujet(p_sujet);
  v_texte := _contact_texte(p_texte);
  select st.promo_id into v_p from stagiaires st where st.id = s;
  v_l := lieu_de_promo(v_p);
  perform _contact_quota(s);
  v_j := _contact_jours(p_type, null, v_p);
  select coalesce(jsonb_agg(jsonb_build_object('fiche_id', d.fiche_id, 'nom', d.nom, 'relais_de', d.relais_de) order by d.fiche_id), '[]'::jsonb)
    into v_dest
    from _contact_destinataires(v_l, v_p, p_type, (select sp.financement_id from stagiaires_prive sp where sp.stagiaire_id = s), v_j) d;
  if jsonb_array_length(v_dest) > 0 then
    if coalesce(cardinality(p_choisis), 0) > 0 then
      raise exception 'contact: Ta demande part à la personne prévue par ton centre : aucun choix n''est possible.';
    end if;
  else
    select coalesce(jsonb_agg(jsonb_build_object('fiche_id', x.fiche_id, 'nom', x.nom)), '[]'::jsonb)
      into v_possibles from _contact_possibles(v_l, v_p, v_j) x;
    if jsonb_array_length(v_possibles) = 0 then
      raise exception 'contact: Personne ne peut recevoir ta demande dans ce centre : préviens ton formateur directement.';
    end if;
    if coalesce(cardinality(p_choisis), 0) = 0 then
      raise exception 'contact: Choisis au moins une personne à prévenir.';
    end if;
    if exists (select 1 from unnest(p_choisis) c(id)
                where c.id is null
                   or not exists (select 1 from jsonb_array_elements(v_possibles) x where (x ->> 'fiche_id')::bigint = c.id)) then
      raise exception 'contact: Cette personne ne peut pas recevoir ta demande.' using errcode = '42501';
    end if;
    select jsonb_agg(x order by (x ->> 'fiche_id')::bigint) into v_dest
      from jsonb_array_elements(v_possibles) x
     where (x ->> 'fiche_id')::bigint = any(p_choisis);
  end if;
  return _contact_creer(v_l, v_p, s, null, _contact_nom_stagiaire(s), p_type, v_sujet, v_texte, v_dest);
end $fn$;

-- Écrire à une fiche du centre affiché, stagiaire (type obligatoire : retard, administratif, document ou autre) ou équipe (aucun type ;
-- sa propre fiche dans ce centre). Le destinataire reste celui qu'on a choisi (ni règle, ni relais).
create function public.ecrire_a(p_fiche_id bigint, p_type text, p_sujet text, p_texte text)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  v_p integer;
  v_l integer;
  v_moi bigint;
  v_sujet text;
  v_texte text;
  c contacts%rowtype;
begin
  if s is not null then
    if p_type is null or p_type not in ('retard', 'administratif', 'document', 'autre') then
      raise exception 'contact: Type de demande inconnu.';
    end if;
    select st.promo_id into v_p from stagiaires st where st.id = s;
    v_l := lieu_de_promo(v_p);
  else
    v_p := promo_courante();
    v_l := lieu_courant();
    v_moi := _contact_fiche_equipe(v_l);
    if v_moi is null then
      raise exception 'contact: Réservé aux stagiaires et à l''équipe du centre.' using errcode = '42501';
    end if;
    if p_type is not null then
      raise exception 'contact: Un message de l''équipe n''a pas de type.';
    end if;
  end if;
  v_sujet := _contact_sujet(p_sujet);
  v_texte := _contact_texte(p_texte);
  select * into c from contacts x where x.id = p_fiche_id;
  if c.id is null or c.id = v_moi or not _contact_fiche_dans(c, v_l) or (c.compte_email is null and c.email is null)
     or (c.depart_le is not null and c.depart_le < _contact_jour()) then
    if s is not null then
      raise exception 'contact: Cette personne ne peut pas recevoir ta demande.' using errcode = '42501';
    end if;
    raise exception 'contact: Cette personne ne peut pas recevoir votre message.' using errcode = '42501';
  end if;
  if s is not null then
    perform _contact_quota(s);
  end if;
  return _contact_creer(v_l, v_p, s, v_moi,
                        case when s is not null then _contact_nom_stagiaire(s) else (select _contact_nom_fiche(m, v_l) from contacts m where m.id = v_moi) end,
                        p_type, v_sujet, v_texte,
                        jsonb_build_array(jsonb_build_object('fiche_id', c.id, 'nom', _contact_nom_fiche(c, v_l))));
end $fn$;

-- Écrire à un stagiaire (équipe) : sa fiche est dans le centre de la promo du stagiaire, et il lit les stagiaires de cette promo
-- (stagiaires.lire, ruling R-T8a). Stagiaire introuvable, effacé, d'un autre centre ou d'une promo qu'on ne lit pas : même refus
-- (rien ne dit qu'une fiche existe).
create function public.ecrire_au_stagiaire(p_stagiaire_id integer, p_sujet text, p_texte text)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_p integer;
  v_l integer;
  v_moi bigint;
  v_sujet text;
  v_texte text;
begin
  select st.promo_id into v_p from stagiaires st where st.id = p_stagiaire_id and st.efface_le is null;
  v_l := lieu_de_promo(v_p);
  v_moi := _contact_fiche_equipe(v_l);
  if v_p is null or v_moi is null or not coalesce(geste_promo(v_p, 'stagiaires.lire'), false) then
    raise exception 'contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez.' using errcode = '42501';
  end if;
  v_sujet := _contact_sujet(p_sujet);
  v_texte := _contact_texte(p_texte);
  return _contact_creer(v_l, v_p, null, v_moi, (select _contact_nom_fiche(m, v_l) from contacts m where m.id = v_moi), null,
                        v_sujet, v_texte,
                        jsonb_build_array(jsonb_build_object('stagiaire_id', p_stagiaire_id,
                                                             'nom', coalesce(_contact_nom_stagiaire(p_stagiaire_id), 'Stagiaire'))));
end $fn$;

-- ===== Partie B (tâche 9) : lire, répondre, prendre en compte, annuler, régler le centre, conservation =====

-- 5. Les alertes par e-mail : chaque compte peut couper les siennes (une fiche sans compte les reçoit toujours). Aucun droit d'écriture
--    nouveau : regler_mes_alertes() seule l'écrit.
alter table public.user_profiles add column alertes_email boolean not null default true;

-- Une ligne d'envoi vers une fiche ou un stagiaire : « à envoyer », ou « ignore » (raison « alertes coupees ») quand le compte de la
-- personne a coupé ses alertes. Seule écriture d'un envoi (création, réponse, prise, annulation).
create function public._contact_envoyer(p_demande bigint, p_fiche bigint, p_stagiaire integer, p_evenement text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_coupe boolean;
begin
  v_coupe := (p_fiche is not null
              and exists (select 1 from contacts c join user_profiles up on lower(up.email) = c.compte_email
                           where c.id = p_fiche and not up.alertes_email))
          or (p_stagiaire is not null
              and exists (select 1 from user_profiles up where up.stagiaire_id = p_stagiaire and not up.alertes_email));
  insert into contact_envois (demande_id, vers_fiche_id, vers_stagiaire_id, evenement, etat, raison, cree_le)
    values (p_demande, p_fiche, p_stagiaire, p_evenement, case when v_coupe then 'ignore' else 'a_envoyer' end,
            case when v_coupe then 'alertes coupees' end, _contact_maintenant());
end $fn$;

-- 6. Qui lit une demande.
-- La direction réelle du centre l : une affectation de direction à titre fixe sur l pour l'adresse du jeton, hors aperçu, ni fondateur.
create function public._contact_direction_reelle(l integer)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select apercu_role() is null and not fondateur_reel()
     and coalesce(_contact_direction_reelle_de(lower(auth.jwt() ->> 'email'), l), false);
$fn$;

-- La fiche de l'équipe de l'appelant, où qu'elle soit (une fiche par personne, C-1), hors aperçu. Nulle sinon.
create function public._contact_ma_fiche()
returns bigint language sql stable security definer set search_path = public, pg_temp
as $fn$
  select c.id from contacts c where c.compte_email = lower(auth.jwt() ->> 'email') and apercu_role() is null;
$fn$;

-- Le rôle sur une demande d'un stagiaire s ou d'une fiche f, dans cet ordre : auteur, principal, annexe_formateur, delegue, direction
-- (direction réelle du centre de la demande, celui de sa création) ; nul sinon. Les rôles de l'équipe se rejugent à chaque appel (R-T8a) :
-- la fiche doit être encore dans le centre de la demande ; l'auteur d'une conversation ouverte avec un stagiaire doit encore lire les
-- stagiaires de la promo de création (geste_promo, stagiaires.lire). Un destinataire principal répond aux demandes reçues tant qu'il est
-- dans le centre.
create function public._contact_role(p_demande bigint, s integer, f bigint)
returns text language sql stable security definer set search_path = public, pg_temp
as $fn$
  select case
           when (s is not null and d.auteur_stagiaire_id = s)
             or (k.f_ici and d.auteur_fiche_id = f
                 and (not exists (select 1 from demande_destinataires x where x.demande_id = d.id and x.stagiaire_id is not null)
                      or coalesce(geste_promo(d.promo_id, 'stagiaires.lire'), false))) then 'auteur'
           when exists (select 1 from demande_destinataires x
                         where x.demande_id = d.id and x.principal
                           and ((s is not null and x.stagiaire_id = s) or (k.f_ici and x.fiche_id = f))) then 'principal'
           when k.f_ici and exists (select 1 from demande_destinataires x
                                     where x.demande_id = d.id and x.annexe = 'formateur_du_jour' and x.fiche_id = f) then 'annexe_formateur'
           when s is not null and exists (select 1 from demande_destinataires x
                                           where x.demande_id = d.id and x.annexe = 'delegue' and x.stagiaire_id = s) then 'delegue'
           when _contact_direction_reelle(d.lieu_id) then 'direction'
         end
    from demandes d
   cross join lateral (select f is not null and exists (select 1 from contacts c where c.id = f and _contact_fiche_dans(c, d.lieu_id)) as f_ici) k
   where d.id = p_demande;
$fn$;

-- Le rôle de l'appelant (stagiaire de la promo affichée, ou fiche de l'équipe).
create function public._contact_lecteur(p_demande bigint)
returns text language sql stable security definer set search_path = public, pg_temp
as $fn$
  select _contact_role(p_demande, _contact_stagiaire(), _contact_ma_fiche());
$fn$;

-- Ce que l'appelant peut faire d'une demande, selon son rôle (p_equipe : il n'est pas le stagiaire). Seule source des gestes : l'écran
-- lit « peut », les fonctions le vérifient. toutes_faites : les réponses toutes faites lui sont proposées (pas rendu à l'écran tel quel).
create function public._contact_peut(p_demande bigint, p_role text, p_equipe boolean)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $fn$
  select jsonb_build_object(
           'repondre', coalesce(p_role in ('auteur', 'principal', 'direction') and d.etat <> 'annulee', false),
           'prendre', coalesce(p_equipe and p_role in ('principal', 'direction') and d.etat = 'envoyee' and d.auteur_stagiaire_id is not null,
                               false),
           -- L'absence s'annule par sa fonction (partie C).
           'annuler', coalesce(p_role = 'auteur' and d.etat = 'envoyee' and d.type is distinct from 'absence', false),
           -- « Envoyer mon justificatif » : partie C (C-18).
           'justificatif', false,
           'toutes_faites', coalesce(p_equipe and p_role in ('principal', 'direction') and d.etat <> 'annulee', false))
    from demandes d
   where d.id = p_demande;
$fn$;

-- 7. Les lectures.
-- Les demandes où l'appelant a un rôle ; avec p_lieu_id, pour la direction réelle de ce centre, toutes celles du centre (rôle
-- « direction » quand elle n'en a pas d'autre). Un délégué ne voit que le type, l'auteur, les dates et les jours. jours : nul tant que
-- la migration 3 n'existe pas (C-22). a_traiter : une demande d'un stagiaire encore envoyée, pour un destinataire principal de l'équipe.
-- envoi_en_echec : à l'équipe seulement.
create function public.liste_demandes(p_lieu_id integer default null)
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

-- Une demande en entier, pour qui y a un rôle (le délégué excepté : sa version passe par liste_demandes). email d'un destinataire :
-- l'adresse affichable de sa fiche (vérifiée, ou fiche sans compte), nulle sinon (C-18). Les envois : à l'équipe seulement.
create function public.demande_detail(p_id bigint)
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

-- Lue (C-15) : la ligne de l'appelant, destinataire principal (fiche ou stagiaire) ou formateur du jour en annexe ; rien pour les autres.
create function public.marquer_lue(p_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  f bigint := _contact_ma_fiche();
begin
  update demande_destinataires x
     set lue_le = _contact_maintenant(), lue_par = x.nom
   where x.demande_id = p_id
     and ((f is not null and x.fiche_id = f and (x.principal or x.annexe = 'formateur_du_jour'))
          or (s is not null and x.stagiaire_id = s and x.principal));
end $fn$;

-- 8. Les gestes. Une seule écriture de chacun (E11) : la réponse et la prise, communes à l'app (droit vérifié par le jeton de session) et
--    au lien d'un e-mail (_contact_srv_agir, partie C, droit vérifié par le jeton du lien).
-- Passer une demande à « prise » (si elle est encore envoyée) ; l'auteur en est prévenu. p_par_lien : la prise vient du bouton de prise
-- d'un e-mail (_contact_srv_agir) ; sa trace est un message « Prise en compte. » marqué par_lien, au nom de qui prend. Une prise née d'une
-- réponse toute faite passe ici sans p_par_lien : sa trace est déjà le message de la réponse (par_lien).
create function public._contact_appliquer_prise(p_demande bigint, p_nom text, p_par_lien boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
  v_stagiaire integer;
  v_fiche bigint;
begin
  update demandes
     set etat = 'prise', prise_le = v_maintenant, prise_par = coalesce(nullif(btrim(p_nom), ''), 'Sans nom'), dernier_echange_le = v_maintenant
   where id = p_demande and etat = 'envoyee'
  returning auteur_stagiaire_id, auteur_fiche_id into v_stagiaire, v_fiche;
  if not found then
    return;
  end if;
  if coalesce(p_par_lien, false) then
    insert into demande_messages (demande_id, auteur_nom, texte, par_lien, cree_le)
      values (p_demande, coalesce(nullif(btrim(p_nom), ''), 'Sans nom'), 'Prise en compte.', true, v_maintenant);
  end if;
  if num_nonnulls(v_stagiaire, v_fiche) = 1 then
    perform _contact_envoyer(p_demande, v_fiche, v_stagiaire, 'prise');
  end if;
end $fn$;

-- Une réponse (texte, réponse toute faite, ou les deux) de la fiche p_fiche_id ou du stagiaire p_stagiaire_id : le message, le dernier
-- échange, « non lue » pour les autres destinataires (C-15), la prise si la réponse toute faite la vaut, et un envoi « réponse » à
-- chaque autre participant (l'auteur et les destinataires principaux ; jamais les annexes ; l'auteur prévenu de la prise ne reçoit pas
-- la réponse en plus). L'effet de demande_justificatif vient avec les absences (partie C). Rend l'identifiant du message.
create function public._contact_appliquer_reponse(p_demande bigint, p_fiche_id bigint, p_stagiaire_id integer, p_nom text, p_email text,
                                                  p_texte text, p_reponse_id bigint, p_par_lien boolean)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
  d demandes%rowtype;
  v_id bigint;
  v_prise boolean := false;
  v_cible record;
begin
  select * into d from demandes where id = p_demande for update;
  if d.id is null then
    raise exception 'contact: Demande introuvable.' using errcode = '42501';
  end if;
  if d.etat = 'annulee' then
    raise exception 'contact: Cette demande est annulée.';
  end if;
  insert into demande_messages (demande_id, auteur_email, auteur_nom, texte, reponse_id, par_lien, cree_le)
    values (p_demande, lower(p_email), coalesce(nullif(btrim(p_nom), ''), 'Sans nom'), p_texte, p_reponse_id, coalesce(p_par_lien, false),
            v_maintenant)
    returning id into v_id;
  update demandes set dernier_echange_le = v_maintenant where id = p_demande;
  update demande_destinataires x set lue_le = null, lue_par = null
   where x.demande_id = p_demande and x.lue_le is not null
     and not coalesce((p_fiche_id is not null and x.fiche_id = p_fiche_id) or (p_stagiaire_id is not null and x.stagiaire_id = p_stagiaire_id), false);
  if d.etat = 'envoyee' and d.auteur_stagiaire_id is not null
     and coalesce((select r.vaut_prise from contact_reponses r where r.id = p_reponse_id), false) then
    -- La trace d'un lien est le message ci-dessus (par_lien) : la prise n'en écrit pas une seconde.
    perform _contact_appliquer_prise(p_demande, p_nom, false);
    v_prise := true;
  end if;
  for v_cible in
    select distinct p.fiche_id, p.stagiaire_id
      from (select d.auteur_fiche_id as fiche_id, d.auteur_stagiaire_id as stagiaire_id, true as auteur
            union all
            select y.fiche_id, y.stagiaire_id, false from demande_destinataires y where y.demande_id = p_demande and y.principal) p
     where num_nonnulls(p.fiche_id, p.stagiaire_id) = 1
       and not coalesce(p.fiche_id = p_fiche_id or p.stagiaire_id = p_stagiaire_id, false)
       and not (v_prise and p.auteur)
     order by p.fiche_id nulls last, p.stagiaire_id
  loop
    perform _contact_envoyer(p_demande, v_cible.fiche_id, v_cible.stagiaire_id, 'reponse');
  end loop;
  return v_id;
end $fn$;

-- Répondre : l'auteur, les destinataires principaux et la direction réelle ; un texte (1000 caractères au plus) ou une réponse toute
-- faite du centre de la demande (l'équipe qui la reçoit seulement). Rend l'identifiant du message.
create function public.repondre_demande(p_id bigint, p_texte text, p_reponse_id bigint default null)
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

-- Prendre en compte la demande d'un stagiaire : un destinataire principal de l'équipe ou la direction réelle, tant qu'elle est envoyée.
create function public.prendre_en_compte(p_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  f bigint := _contact_ma_fiche();
  v_role text;
  v_etat text;
  v_lieu integer;
begin
  perform 1 from demandes d where d.id = p_id for update;
  v_role := _contact_role(p_id, s, f);
  if v_role is null or v_role = 'delegue' then
    raise exception 'contact: Demande introuvable.' using errcode = '42501';
  end if;
  if not (_contact_peut(p_id, v_role, s is null) ->> 'prendre')::boolean then
    select d.etat into v_etat from demandes d where d.id = p_id;
    if s is null and v_role in ('principal', 'direction') and v_etat = 'prise' then
      raise exception 'contact: Cette demande est déjà prise en compte.';
    end if;
    if s is null and v_role in ('principal', 'direction') and v_etat = 'annulee' then
      raise exception 'contact: Cette demande est annulée.';
    end if;
    raise exception 'contact: Seule l''équipe qui reçoit la demande la prend en compte.' using errcode = '42501';
  end if;
  select d.lieu_id into v_lieu from demandes d where d.id = p_id;
  perform _contact_appliquer_prise(p_id, (select _contact_nom_fiche(c, v_lieu) from contacts c where c.id = f), false);
end $fn$;

-- Annuler sa demande : l'auteur, tant qu'elle est envoyée (l'absence : partie C) ; les destinataires principaux en sont prévenus.
create function public.annuler_demande(p_id bigint)
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

-- Relancer un envoi en échec : l'équipe qui lit la demande ; il repasse « à envoyer », compteurs remis.
create function public.relancer_envoi(p_envoi_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  s integer := _contact_stagiaire();
  f bigint := _contact_ma_fiche();
  e contact_envois%rowtype;
  v_role text;
begin
  select * into e from contact_envois x where x.id = p_envoi_id for update;
  if e.id is not null then
    v_role := _contact_role(e.demande_id, s, f);
  end if;
  if v_role is null or s is not null then
    raise exception 'contact: Envoi introuvable.' using errcode = '42501';
  end if;
  if e.etat <> 'echec' then
    raise exception 'contact: Cet envoi n''est pas en échec.';
  end if;
  update contact_envois set etat = 'a_envoyer', raison = null, tentatives = 0, prochain_essai_le = null
   where id = p_envoi_id and etat = 'echec';
  if not found then
    raise exception 'contact: Cet envoi n''est pas en échec.';
  end if;
end $fn$;

-- Couper ou rallumer ses alertes par e-mail (toutes les lignes de profil de l'adresse du jeton). Rend la valeur enregistrée.
create function public.regler_mes_alertes(p_actives boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
begin
  if v_moi is null then
    raise exception 'contact: Connexion requise.' using errcode = '42501';
  end if;
  if p_actives is null then
    raise exception 'contact: Choix des alertes illisible.';
  end if;
  update user_profiles set alertes_email = p_actives where lower(email) = v_moi;
  if not found then
    raise exception 'contact: Connexion requise.' using errcode = '42501';
  end if;
  return p_actives;
end $fn$;

-- 9. Les réglages du centre : qui reçoit quoi et les réponses toutes faites. Lecture : la case Réglages du centre (voir) ; écriture :
--    geste_centre(l, 'reglages.modifier').
-- {regles: [{type, financement_id, cible, fiche_id}], reponses: [{id, libelle, vaut_prise, demande_justificatif, ordre, retire}],
--  financements: [{id, libelle, ordre, retire}], fiches: [{fiche_id, nom, du_centre, joignable, conge_du, conge_au, depart_le, relais_id}]}.
-- fiches : celles du centre, de quoi faire tourner routerDemande (js/contact-rules.js) sur les seules règles.
create function public.reglages_contact(p_lieu_id integer)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
begin
  if p_lieu_id is null or not coalesce(case_centre(p_lieu_id, 'reglages') >= 1, false) then
    raise exception 'contact: Réservé aux réglages du centre.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'regles', coalesce((select jsonb_agg(jsonb_build_object('type', r.type, 'financement_id', r.financement_id, 'cible', r.cible,
                                                            'fiche_id', r.fiche_id) order by r.type, r.financement_id nulls first)
                          from contact_regles r where r.lieu_id = p_lieu_id), '[]'::jsonb),
    'reponses', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'libelle', r.libelle, 'vaut_prise', r.vaut_prise,
                                                              'demande_justificatif', r.demande_justificatif, 'ordre', r.ordre,
                                                              'retire', r.retire) order by r.retire, r.ordre, r.id)
                            from contact_reponses r where r.lieu_id = p_lieu_id), '[]'::jsonb),
    'financements', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'libelle', x.libelle, 'ordre', x.ordre, 'retire', x.retire)
                                               order by x.ordre, x.libelle collate "C", x.id)
                                from contact_financements x where x.lieu_id = p_lieu_id), '[]'::jsonb),
    'fiches', coalesce((select jsonb_agg(jsonb_build_object('fiche_id', c.id, 'nom', _contact_nom_fiche(c, p_lieu_id), 'du_centre', true,
                                                            'joignable', c.compte_email is not null or c.email is not null,
                                                            'conge_du', c.conge_du, 'conge_au', c.conge_au, 'depart_le', c.depart_le,
                                                            'relais_id', c.relais_id) order by c.id)
                          from contacts c where _contact_fiche_dans(c, p_lieu_id)), '[]'::jsonb));
end $fn$;

-- Remplacer toutes les règles du centre : [{type, financement_id|null, cible, fiche_id|null}]. Une règle ne vise qu'une fiche de ce
-- centre, un financement de ce centre. Rend le nombre de règles.
create function public.regler_qui_recoit_quoi(p_lieu_id integer, p_regles jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  e jsonb;
  v_type text;
  v_cible text;
  v_fin bigint;
  v_fiche bigint;
  v_cles text[] := '{}';
  v_lues jsonb := '[]'::jsonb;
  v_n integer := 0;
begin
  if p_lieu_id is null or not coalesce(geste_centre(p_lieu_id, 'reglages.modifier'), false) then
    raise exception 'contact: Réservé aux réglages du centre.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_regles) is distinct from 'array' then
    raise exception 'contact: Les règles sont illisibles.';
  end if;
  for e in select x from jsonb_array_elements(p_regles) x loop
    if jsonb_typeof(e) <> 'object' or exists (select 1 from jsonb_object_keys(e) k where k not in ('type', 'financement_id', 'cible', 'fiche_id'))
       or coalesce(e ->> 'type', '') not in ('absence', 'retard', 'administratif', 'document', 'autre', 'defaut')
       or coalesce(e ->> 'cible', '') not in ('fiche', 'formateurs_du_jour')
       or coalesce(jsonb_typeof(e -> 'financement_id') not in ('null', 'number', 'string') or (e ->> 'financement_id') !~ '^[0-9]{1,18}$', false)
       or coalesce(jsonb_typeof(e -> 'fiche_id') not in ('null', 'number', 'string') or (e ->> 'fiche_id') !~ '^[0-9]{1,18}$', false) then
      raise exception 'contact: Les règles sont illisibles.';
    end if;
    v_type := e ->> 'type';
    v_cible := e ->> 'cible';
    v_fin := (e ->> 'financement_id')::bigint;
    v_fiche := (e ->> 'fiche_id')::bigint;
    if v_fin is not null and not exists (select 1 from contact_financements x where x.id = v_fin and x.lieu_id = p_lieu_id) then
      raise exception 'contact: Ce financement n''existe pas dans ce centre.';
    end if;
    if v_type = 'defaut' and v_fin is not null then
      raise exception 'contact: La personne par défaut ne dépend d''aucun financement.';
    end if;
    if v_cible = 'formateurs_du_jour' then
      if v_type not in ('absence', 'retard') then
        raise exception 'contact: « Formateurs du jour » ne vaut que pour une absence ou un retard.';
      end if;
      if v_fiche is not null then
        raise exception 'contact: Les règles sont illisibles.';
      end if;
    elsif v_fiche is null or not exists (select 1 from contacts c where c.id = v_fiche and _contact_fiche_dans(c, p_lieu_id)) then
      raise exception 'contact: Une règle ne vise qu''une personne de ce centre.';
    end if;
    if v_type || ':' || coalesce(v_fin::text, '') = any(v_cles) then
      raise exception 'contact: Une seule règle par type et par financement.';
    end if;
    v_cles := v_cles || (v_type || ':' || coalesce(v_fin::text, ''));
    v_lues := v_lues || jsonb_build_object('type', v_type, 'financement_id', v_fin, 'cible', v_cible, 'fiche_id', v_fiche);
  end loop;
  delete from contact_regles where lieu_id = p_lieu_id;
  insert into contact_regles (lieu_id, type, financement_id, cible, fiche_id)
    select p_lieu_id, r.type, r.financement_id, r.cible, r.fiche_id
      from jsonb_to_recordset(v_lues) r(type text, financement_id bigint, cible text, fiche_id bigint);
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

-- Remplacer les réponses toutes faites du centre : la liste des réponses actives, dans l'ordre ([{id|null, libelle, vaut_prise,
-- demande_justificatif}], 20 au plus). Une réponse absente de la liste est supprimée, ou retirée si elle a servi (message ou lien).
-- Rend le nombre de réponses actives.
create function public.regler_reponses(p_lieu_id integer, p_reponses jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  e jsonb;
  v_rang integer := 0;
  v_id bigint;
  v_libelle text;
  v_gardes bigint[] := '{}';
begin
  if p_lieu_id is null or not coalesce(geste_centre(p_lieu_id, 'reglages.modifier'), false) then
    raise exception 'contact: Réservé aux réglages du centre.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_reponses) is distinct from 'array' then
    raise exception 'contact: Les réponses toutes faites sont illisibles.';
  end if;
  if jsonb_array_length(p_reponses) > 20 then
    raise exception 'contact: 20 réponses toutes faites au plus.';
  end if;
  for e in select x from jsonb_array_elements(p_reponses) x loop
    if jsonb_typeof(e) <> 'object'
       or exists (select 1 from jsonb_object_keys(e) k where k not in ('id', 'libelle', 'vaut_prise', 'demande_justificatif'))
       or coalesce(jsonb_typeof(e -> 'id') not in ('null', 'number', 'string') or (e ->> 'id') !~ '^[0-9]{1,18}$', false)
       or coalesce(jsonb_typeof(e -> 'vaut_prise') not in ('null', 'boolean'), false)
       or coalesce(jsonb_typeof(e -> 'demande_justificatif') not in ('null', 'boolean'), false) then
      raise exception 'contact: Les réponses toutes faites sont illisibles.';
    end if;
    v_rang := v_rang + 1;
    v_id := (e ->> 'id')::bigint;
    v_libelle := btrim(coalesce(e ->> 'libelle', ''));
    if char_length(v_libelle) not between 1 and 80 then
      raise exception 'contact: Une réponse toute faite compte de 1 à 80 caractères.';
    end if;
    if v_id is not null then
      if v_id = any(v_gardes) or not exists (select 1 from contact_reponses r where r.id = v_id and r.lieu_id = p_lieu_id) then
        raise exception 'contact: Réponse toute faite inconnue.';
      end if;
      update contact_reponses
         set libelle = v_libelle, vaut_prise = coalesce((e ->> 'vaut_prise')::boolean, true),
             demande_justificatif = coalesce((e ->> 'demande_justificatif')::boolean, false), ordre = v_rang * 10, retire = false
       where id = v_id;
    else
      insert into contact_reponses (lieu_id, libelle, vaut_prise, demande_justificatif, ordre)
        values (p_lieu_id, v_libelle, coalesce((e ->> 'vaut_prise')::boolean, true), coalesce((e ->> 'demande_justificatif')::boolean, false),
                v_rang * 10)
        returning id into v_id;
    end if;
    v_gardes := v_gardes || v_id;
  end loop;
  update contact_reponses r set retire = true
   where r.lieu_id = p_lieu_id and not (r.id = any(v_gardes))
     and (exists (select 1 from demande_messages m where m.reponse_id = r.id) or exists (select 1 from contact_jetons j where j.reponse_id = r.id));
  delete from contact_reponses r where r.lieu_id = p_lieu_id and not (r.id = any(v_gardes)) and not r.retire;
  return cardinality(v_gardes);
end $fn$;

-- 10. La conservation. Une fiche de stagiaire effacée (efface_le posé) : ses demandes qui ne sont pas des absences, dont il est l'auteur
--     ou un destinataire, sont supprimées (destinataires, réponses, envois et jetons partent avec elles) ; ses absences restent (partie
--     C) sans texte, sans réponse, sans envoi ni jeton, et sans son nom ; ailleurs (délégué prévenu d'une absence), sa ligne et les envois
--     vers lui partent. Les purges à l'écriture (C-17) sont celles de _contact_purger, appelée par _contact_creer.
create function public._contact_effacer_stagiaire()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  delete from demandes d
   where d.type is distinct from 'absence'
     and (d.auteur_stagiaire_id = new.id
          or exists (select 1 from demande_destinataires x where x.demande_id = d.id and x.stagiaire_id = new.id));
  delete from demande_messages m using demandes d where m.demande_id = d.id and d.auteur_stagiaire_id = new.id;
  delete from contact_jetons j using demandes d where j.demande_id = d.id and d.auteur_stagiaire_id = new.id;
  delete from contact_envois e using demandes d where e.demande_id = d.id and d.auteur_stagiaire_id = new.id;
  update demandes d set texte = null, auteur_nom = 'Stagiaire anonyme' where d.auteur_stagiaire_id = new.id;
  delete from demande_destinataires x where x.stagiaire_id = new.id;
  delete from contact_envois e where e.vers_stagiaire_id = new.id;
  return null;
end $fn$;

create trigger stagiaires_contact_effacer after update of efface_le on public.stagiaires
  for each row when (old.efface_le is null and new.efface_le is not null) execute function public._contact_effacer_stagiaire();


-- ===== Partie C (tâche 10) : la file des envois, les jetons hachés, les liens d'e-mail =====
-- 11. Les fonctions de la fonction serveur contact-envois (Resend) : exécution par service_role seul (C-9, C-10, C-11). Les hachés
--     circulent en hexadécimal (sha256, 64 caractères) ; la base ne voit jamais un jeton nu. Aucun e-mail ne porte de motif, de sujet ni
--     de texte : _contact_srv_prendre ne les rend pas ; seul le lien ouvert (_contact_srv_lien) montre la demande, à qui tient le jeton.
--     Un envoi pris passe « en cours » pour 10 minutes (prochain_essai_le = la fin du délai) : au-delà, il est repris et sa tentative
--     compte ; une deuxième tentative interrompue le passe en échec.

-- La file : les envois « à envoyer », les « à retenter » échus et les « en cours » dont le délai est passé, verrouillés (skip locked :
-- deux traitements simultanés ne prennent pas le même), passés « en cours ». Rend, pour chacun, de quoi bâtir l'e-mail : jamais le sujet,
-- le texte ni le motif. Adresse : compte_email d'une fiche avec compte, email d'une sans compte, l'adresse du profil d'un stagiaire ;
-- sans adresse, l'envoi est « ignore » (raison « sans adresse ») et n'est pas rendu. reponses : les réponses toutes faites que la fiche
-- peut choisir par lien (_contact_peut, toutes_faites) ; peut_prendre : le bouton de prise a un sens (_contact_peut, prendre).
create function public._contact_srv_prendre(p_limite integer default 20)
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

-- Les jetons d'un envoi en cours ([{hash, action, reponse_id}], hachés en hexadécimal), valables 14 jours (C-11). Un jeton par envoi et
-- par action : ceux d'une tentative précédente du même envoi sont remplacés. Seule une fiche en reçoit, jamais un stagiaire (C-12).
create function public._contact_srv_jetons(p_envoi_id bigint, p_jetons jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  e contact_envois%rowtype;
  v_lieu integer;
  j jsonb;
  v_action text;
  v_reponse bigint;
begin
  select * into e from contact_envois x where x.id = p_envoi_id for update;
  if e.id is null or e.etat <> 'en_cours' or e.vers_fiche_id is null then
    raise exception 'contact: Cet envoi ne reçoit pas de jeton.';
  end if;
  if jsonb_typeof(p_jetons) is distinct from 'array' then
    raise exception 'contact: Jetons illisibles.';
  end if;
  select d.lieu_id into v_lieu from demandes d where d.id = e.demande_id;
  delete from contact_jetons x where x.envoi_id = e.id;
  for j in select x from jsonb_array_elements(p_jetons) x loop
    v_action := j ->> 'action';
    if coalesce(j ->> 'hash', '') !~ '^[0-9a-f]{64}$' or coalesce(j ->> 'reponse_id', '0') !~ '^[0-9]+$'
       or v_action is null or v_action not in ('voir', 'prise', 'reponse', 'justificatif') then
      raise exception 'contact: Jetons illisibles.';
    end if;
    v_reponse := (j ->> 'reponse_id')::bigint;
    if (v_action = 'reponse') <> (v_reponse is not null) then
      raise exception 'contact: Jetons illisibles.';
    end if;
    if v_action = 'reponse' and not exists (select 1 from contact_reponses r where r.id = v_reponse and r.lieu_id = v_lieu and not r.retire) then
      raise exception 'contact: Réponse toute faite inconnue.';
    end if;
    insert into contact_jetons (hash, envoi_id, demande_id, fiche_id, action, reponse_id, expire_le)
      values (decode(j ->> 'hash', 'hex'), e.id, e.demande_id, e.vers_fiche_id, v_action, v_reponse, _contact_maintenant() + interval '14 days');
  end loop;
end $fn$;

-- L'issue d'un envoi en cours : « envoye » ; « ignore » (adresse fictive) ; « echec » : à retenter dans 5 minutes à la première
-- tentative, en échec ensuite (l'équipe le relance par relancer_envoi). Un envoi qui n'est pas parti perd ses jetons. p_raison : 200
-- caractères au plus (la fonction serveur n'y met jamais la clé). Un envoi qui n'est plus « en cours » n'est pas touché.
create function public._contact_srv_resultat(p_envoi_id bigint, p_issue text, p_raison text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
begin
  if p_issue is null or p_issue not in ('envoye', 'echec', 'ignore') then
    raise exception 'contact: Issue d''envoi illisible.';
  end if;
  update contact_envois
     set etat = case when p_issue <> 'echec' then p_issue when tentatives <= 1 then 'a_retenter' else 'echec' end,
         envoye_le = case when p_issue = 'envoye' then v_maintenant end,
         prochain_essai_le = case when p_issue = 'echec' and tentatives <= 1 then v_maintenant + interval '5 minutes' end,
         raison = left(nullif(btrim(p_raison), ''), 200)
   where id = p_envoi_id and etat = 'en_cours';
  if found and p_issue <> 'envoye' then
    delete from contact_jetons x where x.envoi_id = p_envoi_id;
  end if;
end $fn$;

-- Un jeton lisible : haché en hexadécimal, connu, non expiré, et sa fiche encore dans le centre de la demande. Nul sinon.
create function public._contact_srv_jeton(p_hash text)
returns public.contact_jetons language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  j contact_jetons%rowtype;
begin
  if coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into j from contact_jetons x where x.hash = decode(p_hash, 'hex');
  if j.hash is null or j.expire_le <= _contact_maintenant()
     or not exists (select 1 from demandes d join contacts c on c.id = j.fiche_id
                     where d.id = j.demande_id and _contact_fiche_dans(c, d.lieu_id)) then
    return null;
  end if;
  return j;
end $fn$;

-- L'action d'un jeton est-elle déjà faite ? Prise : le jeton a servi, ou la demande est déjà prise ; réponse : le jeton a servi.
create function public._contact_srv_deja(j public.contact_jetons)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select case j.action
           when 'prise' then j.utilise_le is not null or exists (select 1 from demandes d where d.id = j.demande_id and d.etat = 'prise')
           when 'reponse' then j.utilise_le is not null
           else false
         end;
$fn$;

-- Ce que montre un lien d'e-mail (demande.html#j=...) : la demande (sujet et texte compris, pour qui tient le jeton), ses réponses (jamais
-- une adresse), l'action du jeton, le libellé de sa réponse toute faite, et si elle est déjà faite. Ouvrir le lien n'écrit rien (un
-- filtre de messagerie qui l'ouvre ne fait rien). Jeton inconnu, expiré, ou fiche partie du centre : {invalide: true}.
create function public._contact_srv_lien(p_hash text)
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

-- Le geste d'un lien d'e-mail, au nom de la fiche du jeton (aucun compte connecté : la fiche est celle à qui l'e-mail est parti).
-- _contact_role lit le jeton de session pour reconnaître la direction réelle : il n'y en a pas ici, la direction n'est donc jamais
-- reconnue par un lien, et seul un destinataire principal de l'équipe agit (_contact_peut, comme dans l'app). prise :
-- _contact_appliquer_prise ; reponse : _contact_appliquer_reponse, p_par_lien vrai (E11 : aucune logique de réponse ni de prise ici).
-- {fait: true} ; {deja: true} quand l'action est déjà faite (rien d'écrit) ; {invalide: true} sinon (voir ; justificatif jusqu'à la
-- migration 3 ; jeton inconnu ou expiré ; geste qui n'est plus permis).
create function public._contact_srv_agir(p_hash text)
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

-- Droits des fonctions : celles de l'app à tout compte connecté ; les aides internes à personne.
revoke all on function public.destinataires_possibles(text, jsonb) from public, anon, service_role;
grant execute on function public.destinataires_possibles(text, jsonb) to authenticated;
revoke all on function public.apercu_envoi(text, jsonb) from public, anon, service_role;
grant execute on function public.apercu_envoi(text, jsonb) to authenticated;
revoke all on function public.ecrire_au_centre(text, text, text, bigint[]) from public, anon, service_role;
grant execute on function public.ecrire_au_centre(text, text, text, bigint[]) to authenticated;
revoke all on function public.ecrire_a(bigint, text, text, text) from public, anon, service_role;
grant execute on function public.ecrire_a(bigint, text, text, text) to authenticated;
revoke all on function public.ecrire_au_stagiaire(integer, text, text) from public, anon, service_role;
grant execute on function public.ecrire_au_stagiaire(integer, text, text) to authenticated;
revoke all on function public._contact_poser_reponses(integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_reponses_defaut() from public, anon, authenticated, service_role;
revoke all on function public._contact_maintenant() from public, anon, authenticated, service_role;
revoke all on function public._contact_jour() from public, anon, authenticated, service_role;
revoke all on function public._contact_demi_courante(integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_jours(text, jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_nom_fiche(public.contacts, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_disponible(public.contacts, integer, date) from public, anon, authenticated, service_role;
revoke all on function public._contact_direction_reelle_de(text, integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_formateurs_du_jour(integer, integer, jsonb) from public, anon, authenticated, service_role;
revoke all on function public._contact_destinataires(integer, integer, text, bigint, jsonb) from public, anon, authenticated, service_role;
revoke all on function public._contact_possibles(integer, integer, jsonb) from public, anon, authenticated, service_role;
revoke all on function public._contact_stagiaire() from public, anon, authenticated, service_role;
revoke all on function public._contact_fiche_equipe(integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_sujet(text) from public, anon, authenticated, service_role;
revoke all on function public._contact_texte(text) from public, anon, authenticated, service_role;
revoke all on function public._contact_quota(integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_purger() from public, anon, authenticated, service_role;
revoke all on function public._contact_creer(integer, integer, integer, bigint, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public._contact_nom_stagiaire(integer) from public, anon, authenticated, service_role;
revoke all on function public.liste_demandes(integer) from public, anon, service_role;
grant execute on function public.liste_demandes(integer) to authenticated;
revoke all on function public.demande_detail(bigint) from public, anon, service_role;
grant execute on function public.demande_detail(bigint) to authenticated;
revoke all on function public.marquer_lue(bigint) from public, anon, service_role;
grant execute on function public.marquer_lue(bigint) to authenticated;
revoke all on function public.repondre_demande(bigint, text, bigint) from public, anon, service_role;
grant execute on function public.repondre_demande(bigint, text, bigint) to authenticated;
revoke all on function public.prendre_en_compte(bigint) from public, anon, service_role;
grant execute on function public.prendre_en_compte(bigint) to authenticated;
revoke all on function public.annuler_demande(bigint) from public, anon, service_role;
grant execute on function public.annuler_demande(bigint) to authenticated;
revoke all on function public.relancer_envoi(bigint) from public, anon, service_role;
grant execute on function public.relancer_envoi(bigint) to authenticated;
revoke all on function public.regler_mes_alertes(boolean) from public, anon, service_role;
grant execute on function public.regler_mes_alertes(boolean) to authenticated;
revoke all on function public.reglages_contact(integer) from public, anon, service_role;
grant execute on function public.reglages_contact(integer) to authenticated;
revoke all on function public.regler_qui_recoit_quoi(integer, jsonb) from public, anon, service_role;
grant execute on function public.regler_qui_recoit_quoi(integer, jsonb) to authenticated;
revoke all on function public.regler_reponses(integer, jsonb) from public, anon, service_role;
grant execute on function public.regler_reponses(integer, jsonb) to authenticated;
revoke all on function public._contact_envoyer(bigint, bigint, integer, text) from public, anon, authenticated, service_role;
revoke all on function public._contact_direction_reelle(integer) from public, anon, authenticated, service_role;
revoke all on function public._contact_ma_fiche() from public, anon, authenticated, service_role;
revoke all on function public._contact_role(bigint, integer, bigint) from public, anon, authenticated, service_role;
revoke all on function public._contact_lecteur(bigint) from public, anon, authenticated, service_role;
revoke all on function public._contact_peut(bigint, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public._contact_appliquer_prise(bigint, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public._contact_appliquer_reponse(bigint, bigint, integer, text, text, text, bigint, boolean) from public, anon, authenticated, service_role;
revoke all on function public._contact_effacer_stagiaire() from public, anon, authenticated, service_role;
-- Partie C : les fonctions de la fonction serveur contact-envois, à service_role seul ; leurs aides à personne.
revoke all on function public._contact_srv_prendre(integer) from public, anon, authenticated;
grant execute on function public._contact_srv_prendre(integer) to service_role;
revoke all on function public._contact_srv_jetons(bigint, jsonb) from public, anon, authenticated;
grant execute on function public._contact_srv_jetons(bigint, jsonb) to service_role;
revoke all on function public._contact_srv_resultat(bigint, text, text) from public, anon, authenticated;
grant execute on function public._contact_srv_resultat(bigint, text, text) to service_role;
revoke all on function public._contact_srv_lien(text) from public, anon, authenticated;
grant execute on function public._contact_srv_lien(text) to service_role;
revoke all on function public._contact_srv_agir(text) from public, anon, authenticated;
grant execute on function public._contact_srv_agir(text) to service_role;
revoke all on function public._contact_srv_jeton(text) from public, anon, authenticated, service_role;
revoke all on function public._contact_srv_deja(public.contact_jetons) from public, anon, authenticated, service_role;

-- Contrôle de fin : aucune table de la migration n'a de droit pour l'API (ni lecture, ni écriture, ni vidage) ; aucune aide interne ne
-- s'exécute par anon ni authenticated ; les fonctions de l'app s'exécutent par authenticated seul ; alertes_email ne s'écrit pas en direct ;
-- les fonctions de la fonction serveur (partie C) s'exécutent par service_role (et, comme toute aide _contact_*, jamais par l'API).
do $controle$
declare
  t text;
  f record;
begin
  foreach t in array array['demandes', 'demande_destinataires', 'demande_messages', 'contact_regles', 'contact_reponses',
                           'contact_envois', 'contact_jetons'] loop
    if has_table_privilege('anon', 'public.' || t, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       or has_table_privilege('authenticated', 'public.' || t, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       or has_any_column_privilege('anon', 'public.' || t, 'SELECT, INSERT, UPDATE, REFERENCES')
       or has_any_column_privilege('authenticated', 'public.' || t, 'SELECT, INSERT, UPDATE, REFERENCES') then
      raise exception 'contact_2 : la table % garde un droit pour anon ou authenticated ; tout est annulé', t;
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname like '\_contact\_%' and p.proname <> '_contact_compte_equipe' loop
    if has_function_privilege('anon', f.sig, 'EXECUTE') or has_function_privilege('authenticated', f.sig, 'EXECUTE') then
      raise exception 'contact_2 : l''aide interne % s''exécute par anon ou authenticated ; tout est annulé', f.sig;
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('destinataires_possibles', 'apercu_envoi', 'ecrire_au_centre', 'ecrire_a', 'ecrire_au_stagiaire',
                                'liste_demandes', 'demande_detail', 'marquer_lue', 'repondre_demande', 'prendre_en_compte',
                                'annuler_demande', 'relancer_envoi', 'regler_mes_alertes', 'reglages_contact', 'regler_qui_recoit_quoi',
                                'regler_reponses') loop
    if has_function_privilege('anon', f.sig, 'EXECUTE') or not has_function_privilege('authenticated', f.sig, 'EXECUTE') then
      raise exception 'contact_2 : la fonction % n''a pas ses droits (authenticated seul) ; tout est annulé', f.sig;
    end if;
  end loop;
  if has_column_privilege('authenticated', 'public.user_profiles', 'alertes_email', 'INSERT, UPDATE')
     or has_column_privilege('anon', 'public.user_profiles', 'alertes_email', 'INSERT, UPDATE') then
    raise exception 'contact_2 : user_profiles.alertes_email s''écrit sans regler_mes_alertes ; tout est annulé';
  end if;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('_contact_srv_prendre', '_contact_srv_jetons', '_contact_srv_resultat', '_contact_srv_lien', '_contact_srv_agir') loop
    if not has_function_privilege('service_role', f.sig, 'EXECUTE') then
      raise exception 'contact_2 : la fonction % ne s''exécute pas par service_role ; tout est annulé', f.sig;
    end if;
  end loop;
  if (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like '\_contact\_srv\_%') <> 7 then
    raise exception 'contact_2 : les sept fonctions _contact_srv_* ne sont pas toutes là ; tout est annulé';
  end if;
end $controle$;
