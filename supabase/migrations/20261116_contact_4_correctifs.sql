-- Espace contact, migration 4 (tâche 4C, ruling R-ORD2) : correctifs relevés en relecture, après les migrations 1, 2 et 3 (appliquées
-- en production, gelées). Spec : docs/superpowers/specs/2026-11-09-espace-contact-design.md ; plan : docs/superpowers/plans/2026-11-14-espace-contact.md.
--   1. Le 429 durable de Resend : _contact_srv_resultat accepte l'issue « limite » (à retenter, la tentative n'est pas consommée) ; la
--      fonction serveur (supabase/functions/contact-envois/courriels.mjs) la rend quand un 429 persiste, puis arrête sa boucle. Un envoi
--      créé depuis plus de 24 heures qui reçoit encore « limite » passe en échec (raison « Resend 429 durable ») : il se voit (pastille
--      « E-mail non parti », « Relancer l'envoi ») au lieu d'être remis en file sans fin (relecture finale, I3).
--   2. reglages_contact() rend peut_modifier (l'écran masque « Enregistrer » et « Ajouter » quand c'est faux).
--   3. Fiches indisponibles : _contact_formateurs_du_jour et _contact_possibles écartent les fiches parties ou en congé (_contact_disponible) ;
--      en annexe d'une absence, un formateur du jour indisponible n'est pas prévenu et son nom figure en « non prévenu » (_contact_annexes).
--   4. Quota de l'équipe : 30 nouvelles conversations par jour et par fiche (ecrire_a, ecrire_au_stagiaire), nouvelle aide
--      _contact_quota_equipe(bigint), marqueur de la migration, et index demandes_auteur_fiche_cree (auteur_fiche_id, cree_le).
--   5. Absences : on conflict à l'insertion du pré-marquage ; regler_justificatif juge le droit avant le type ; prevenir_absence borne
--      le début à 120 jours ; le chemin du justificatif verrouille la feuille.
--   6. Annuaire : coordonnees_promo ignore les fiches effacées ; l'effacement vide stagiaires.delegue (et un rattrapage unique vide la marque
--      des stagiaires déjà effacés) ; ordonner_fiches ignore une fiche sans compte d'un autre centre (elle garde son ordre) ;
--      regler_financements verrouille avant de contrôler et de supprimer.
--   7. Demandes : ecrire_au_stagiaire tutoie un stagiaire ; l'effacement ne retire une demande que là où le stagiaire est principal.
--      (_contact_jours refuse déjà proprement une entrée scalaire ou tableau depuis la migration 2 : rien à changer.)
--   8. Liens d'e-mail : _contact_srv_jeton refuse le jeton d'une fiche partie (date de départ passée) : la personne sans compte qui a
--      quitté le centre ne lit plus la demande et ne fait plus le geste par un lien reçu avant son départ (relecture finale, M1).
-- Seize fonctions redéfinies par create or replace, signatures et colonnes de sortie inchangées, droits gardés ; chacune part du texte
-- de son dernier fichier de définition (migration 1, 2 ou 3), seules les lignes du correctif changent.
-- Toutes les dates passent par _contact_maintenant() et _contact_jour() (C-21).
-- Garde : les migrations 1, 2 et 3 sont appliquées, la 4 ne l'est pas (_contact_quota_equipe et son index absents), les seize fonctions
-- existent avec leur signature ; sinon rien ne change.
-- MISE EN LIGNE : appliquer cette migration AVANT de déployer la fonction serveur contact-envois de ce chantier (supabase/functions/
-- contact-envois : courriels.mjs envoie l'issue « limite ») ; sans la migration, la base refuse « limite », l'envoi reste en cours, il
-- est repris avec une tentative de plus et finit « interrompu » (perdu).
-- Marche arrière : 20261116_contact_4_correctifs_retour.sql, à jouer AVANT le retour 3 (voir son en-tête), et seulement après avoir
-- redéployé contact-envois dans sa version d'avant la migration 4 (commit 5e8acc38).
set local lock_timeout = '3s';

do $garde$
declare
  v_sig text;
begin
  if to_regclass('public.absences_annoncees') is null
     or to_regprocedure('public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[])') is null then
    raise exception 'contact_4 : la migration 3 (20261115_contact_3_absences.sql) n''est pas appliquée ; rien n''est changé';
  end if;
  if to_regprocedure('public.ecrire_au_centre(text, text, text, bigint[])') is null or to_regprocedure('public.annuaire_centre()') is null then
    raise exception 'contact_4 : la migration 1 ou 2 n''est pas appliquée ; rien n''est changé';
  end if;
  if to_regprocedure('public._contact_quota_equipe(bigint)') is not null then
    raise exception 'contact_4 : _contact_quota_equipe existe déjà, migration déjà appliquée ? rien n''est changé';
  end if;
  if to_regclass('public.demandes_auteur_fiche_cree') is not null then
    raise exception 'contact_4 : l''index demandes_auteur_fiche_cree existe déjà ; rien n''est changé';
  end if;
  foreach v_sig in array array[
      'public.coordonnees_promo()',
      'public.ordonner_fiches(bigint[])',
      'public.regler_financements(integer, jsonb)',
      'public._contact_formateurs_du_jour(integer, integer, jsonb)',
      'public._contact_possibles(integer, integer, jsonb)',
      'public.ecrire_a(bigint, text, text, text)',
      'public.ecrire_au_stagiaire(integer, text, text)',
      'public.reglages_contact(integer)',
      'public._contact_srv_resultat(bigint, text, text)',
      'public._contact_srv_jeton(text)',
      'public._contact_effacer_stagiaire()',
      'public._contact_annexes(integer, integer, jsonb, integer)',
      'public.prevenir_absence(date, date, text, text, text, text, text, text[], bigint[])',
      'public.regler_justificatif(bigint, text)',
      'public._contact_premarquer(bigint, integer)',
      'public._contact_emargement_absence()'] loop
    if to_regprocedure(v_sig) is null then
      raise exception 'contact_4 : la fonction % manque (signature changée ?) ; rien n''est changé', v_sig;
    end if;
  end loop;
end $garde$;

-- 4. Le quota de l'équipe : au plus 30 conversations créées par une fiche de l'équipe par jour de Paris (verrou par fiche : deux envois
--    simultanés ne passent pas tous deux). Les réponses dans une conversation existante ne créent pas de demande : elles ne comptent pas.
create function public._contact_quota_equipe(f bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  perform pg_advisory_xact_lock(hashtext('contact_equipe_du_jour'), hashtext(f::text));
  if (select count(*) from demandes d
       where d.auteur_fiche_id = f
         and (d.cree_le at time zone 'Europe/Paris')::date = _contact_jour()) >= 30 then
    raise exception 'contact: Vous avez atteint la limite de 30 nouveaux messages pour aujourd''hui.';
  end if;
end $fn$;
revoke all on function public._contact_quota_equipe(bigint) from public, anon, authenticated, service_role;
create index demandes_auteur_fiche_cree on public.demandes (auteur_fiche_id, cree_le) where auteur_fiche_id is not null;

-- 6b. Rattrapage unique : la marque de délégué des stagiaires déjà effacés avant cette migration est vidée (le déclencheur ne vide que
--     les effacements à venir ; l'index stagiaires_delegue_unique empêcherait sinon de nommer un remplaçant). Le retour 4 ne la rétablit
--     pas (données valides pour les deux textes).
update public.stagiaires set delegue = null where efface_le is not null and delegue is not null;

-- 6a. Annuaire : coordonnees_promo() ignore les fiches effacées (efface_le posé) : plus de ligne vide pour elles.
create or replace function public.coordonnees_promo()
returns table (stagiaire_id integer, telephone text, email text, financement_id bigint, financement text)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with ctx as (
    select promo_courante() as p, coalesce(geste_promo(promo_courante(), 'stagiaires.lire'), false) as lit, my_stagiaire_id() as moi
  )
  select s.id, sp.telephone,
         (select min(lower(up.email)) from user_profiles up where up.stagiaire_id = s.id),
         sp.financement_id, f.libelle
    from ctx x
    join stagiaires s on s.promo_id = x.p
    left join stagiaires_prive sp on sp.stagiaire_id = s.id
    left join contact_financements f on f.id = sp.financement_id
   where x.p is not null and (x.lit or s.id = x.moi) and s.efface_le is null
   order by s.ordre, s.id;
$fn$;

-- 6c. Annuaire : ordonner_fiches() ne range que les fiches du centre affiché : une fiche avec compte qui y est affectée, ou une fiche
--     sans compte qui y est née (lieu_id). Une fiche sans compte d'un autre centre, partagée avec celui-ci, est ignorée sans refus (R-4Ca) :
--     elle garde son ordre, et la liste entière de l'annuaire (que l'écran envoie, fiches partagées comprises) reste acceptée. Une fiche
--     inconnue ou hors du centre reste refusée, comme avant.
create or replace function public.ordonner_fiches(p_ids bigint[])
returns integer language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_l integer := lieu_courant();
  n integer;
begin
  if not coalesce(geste_promo(promo_courante(), 'fiches_internes.ecrire'), false) then
    raise exception 'contact: Réservé à qui écrit les fiches de ce centre.' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_ids, '{}'::bigint[])) x(id)
              where x.id is null or not exists (select 1 from contacts c where c.id = x.id and _contact_fiche_dans(c, v_l))) then
    raise exception 'contact: Une fiche n''est pas de ce centre.' using errcode = '42501';
  end if;
  update contacts c
     set sort_order = 10 * o.rang
    from (select u.id, row_number() over (order by min(u.o)) as rang
            from unnest(coalesce(p_ids, '{}'::bigint[])) with ordinality u(id, o) group by u.id) o
   where c.id = o.id and (c.compte_email is not null or c.lieu_id = v_l);
  get diagnostics n = row_count;
  return n;
end $fn$;

-- 6d. Annuaire : regler_financements() verrouille les financements du centre (for update) avant le contrôle « choisi pour un
--     stagiaire » et la suppression.
create or replace function public.regler_financements(p_lieu_id integer, p_liste jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  e jsonb;
  i bigint;
  k text;
  v_id bigint;
  v_lib text;
  v_ordre integer;
  v_retire boolean;
  v_ids bigint[] := '{}';
  v_lignes jsonb := '[]'::jsonb;
  n integer;
begin
  if p_lieu_id is null or not coalesce(geste_centre(p_lieu_id, 'reglages.modifier'), false) then
    raise exception 'contact: Réservé aux réglages du centre.' using errcode = '42501';
  end if;
  -- Les financements du centre, verrouillés d'abord : un choix de financement écrit en même temps (clé étrangère de stagiaires_prive)
  -- attend la fin de cet enregistrement, et le contrôle « choisi pour un stagiaire » voit tout ce qui est écrit.
  perform 1 from contact_financements f where f.lieu_id = p_lieu_id order by f.id for update;
  if jsonb_typeof(p_liste) is distinct from 'array' then
    raise exception 'contact: La liste des financements est illisible.';
  end if;
  for e, i in select t.e, t.o from jsonb_array_elements(p_liste) with ordinality t(e, o) loop
    if jsonb_typeof(e) <> 'object' then
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    for k in select jsonb_object_keys(e) order by 1 loop
      if k not in ('id', 'libelle', 'ordre', 'retire') then
        raise exception 'contact: Champ inconnu « % ».', k;
      end if;
    end loop;
    v_id := null;
    if jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id') ~ '^[0-9]{1,18}$' then
      v_id := (e ->> 'id')::bigint;
    elsif coalesce(jsonb_typeof(e -> 'id'), 'null') <> 'null' then
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    if v_id is not null and not exists (select 1 from contact_financements f where f.id = v_id and f.lieu_id = p_lieu_id) then
      raise exception 'contact: Financement inconnu dans ce centre.';
    end if;
    if v_id = any(v_ids) then
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    v_lib := case when jsonb_typeof(e -> 'libelle') = 'string' then btrim(regexp_replace(e ->> 'libelle', '\s+', ' ', 'g')) else '' end;
    if char_length(v_lib) not between 1 and 40 then
      raise exception 'contact: Le nom d''un financement compte de 1 à 40 caractères.';
    end if;
    if coalesce(jsonb_typeof(e -> 'ordre'), 'null') = 'null' then
      v_ordre := 10 * i;
    elsif jsonb_typeof(e -> 'ordre') = 'number' and (e ->> 'ordre') ~ '^-?[0-9]{1,9}$' then
      v_ordre := (e ->> 'ordre')::integer;
    else
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    if coalesce(jsonb_typeof(e -> 'retire'), 'null') = 'null' then
      v_retire := false;
    elsif jsonb_typeof(e -> 'retire') = 'boolean' then
      v_retire := (e ->> 'retire')::boolean;
    else
      raise exception 'contact: La liste des financements est illisible.';
    end if;
    if v_id is not null then v_ids := v_ids || v_id; end if;
    v_lignes := v_lignes || jsonb_build_object('id', v_id, 'libelle', v_lib, 'ordre', v_ordre, 'retire', v_retire);
  end loop;
  if exists (select 1 from jsonb_array_elements(v_lignes) r group by lower(r ->> 'libelle') having count(*) > 1) then
    raise exception 'contact: Deux financements portent le même nom.';
  end if;
  if exists (select 1 from contact_financements f
              where f.lieu_id = p_lieu_id and not (f.id = any(v_ids))
                and exists (select 1 from stagiaires_prive sp where sp.financement_id = f.id)) then
    raise exception 'contact: Un financement choisi pour un stagiaire ne se supprime pas : retirez-le.';
  end if;
  delete from contact_financements f where f.lieu_id = p_lieu_id and not (f.id = any(v_ids));
  begin
    update contact_financements f
       set libelle = r.libelle, ordre = r.ordre, retire = r.retire
      from jsonb_to_recordset(v_lignes) as r(id bigint, libelle text, ordre integer, retire boolean)
     where r.id is not null and f.id = r.id;
    insert into contact_financements (lieu_id, libelle, ordre, retire)
    select p_lieu_id, r.libelle, r.ordre, r.retire
      from jsonb_to_recordset(v_lignes) as r(id bigint, libelle text, ordre integer, retire boolean)
     where r.id is null;
  exception when unique_violation then
    -- Deux noms échangés dans le même enregistrement : la contrainte se juge ligne à ligne.
    raise exception 'contact: Deux financements portent le même nom.';
  end;
  select count(*) into n from contact_financements f where f.lieu_id = p_lieu_id;
  return n;
end $fn$;

-- 3. Fiches indisponibles : les formateurs du jour (pré-cochés en mode choix, envois annexes d'une absence) et ceux que le stagiaire
--    peut choisir écartent les fiches parties ou en congé, par _contact_disponible au jour de création (_contact_jour()), la règle des
--    destinataires principaux (_contact_destinataires, qui les filtrait déjà, ne change pas).
create or replace function public._contact_formateurs_du_jour(p_lieu integer, p_promo integer, p_jours jsonb)
returns setof bigint language sql stable security definer set search_path = public, pg_temp
as $fn$
  select distinct c.id
    from jsonb_array_elements(coalesce(p_jours, '[]'::jsonb)) e
    cross join lateral (select (e ->> 'jour')::date as d, e ->> 'demi' as demi) x
    join planning_entries pe on pe.promo_id = p_promo and pe.half_day = x.demi
                            and pe.semaine_lundi = x.d - (extract(isodow from x.d)::integer - 1)
                            and pe.day_index = extract(isodow from x.d)::integer - 1
    join contacts c on c.prof_id = pe.prof_id or c.prof_id = any(pe.prof_ids)
   where _contact_fiche_dans(c, p_lieu) and _contact_disponible(c, p_lieu, _contact_jour());
$fn$;

create or replace function public._contact_possibles(p_lieu integer, p_promo integer, p_jours jsonb)
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
     and _contact_disponible(c, p_lieu, _contact_jour())
   group by c.id
   order by 2, 1;
$fn$;

-- 4. Quota de l'équipe : 30 conversations créées par jour et par fiche (_contact_quota_equipe), dans ecrire_a (équipe) et
--    ecrire_au_stagiaire ; une réponse dans une conversation existante ne compte pas.
create or replace function public.ecrire_a(p_fiche_id bigint, p_type text, p_sujet text, p_texte text)
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
  else
    perform _contact_quota_equipe(v_moi);
  end if;
  return _contact_creer(v_l, v_p, s, v_moi,
                        case when s is not null then _contact_nom_stagiaire(s) else (select _contact_nom_fiche(m, v_l) from contacts m where m.id = v_moi) end,
                        p_type, v_sujet, v_texte,
                        jsonb_build_array(jsonb_build_object('fiche_id', c.id, 'nom', _contact_nom_fiche(c, v_l))));
end $fn$;

-- 7b. ecrire_au_stagiaire() appelée par un stagiaire : refus tutoyé (il n'écrit qu'à l'équipe), avant tout autre contrôle.
create or replace function public.ecrire_au_stagiaire(p_stagiaire_id integer, p_sujet text, p_texte text)
returns bigint language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_p integer;
  v_l integer;
  v_moi bigint;
  v_sujet text;
  v_texte text;
begin
  if _contact_stagiaire() is not null then
    raise exception 'contact: Tu ne peux écrire qu''à l''équipe de ton centre.' using errcode = '42501';
  end if;
  select st.promo_id into v_p from stagiaires st where st.id = p_stagiaire_id and st.efface_le is null;
  v_l := lieu_de_promo(v_p);
  v_moi := _contact_fiche_equipe(v_l);
  if v_p is null or v_moi is null or not coalesce(geste_promo(v_p, 'stagiaires.lire'), false) then
    raise exception 'contact: Vous ne pouvez écrire qu''aux stagiaires des promos que vous suivez.' using errcode = '42501';
  end if;
  v_sujet := _contact_sujet(p_sujet);
  v_texte := _contact_texte(p_texte);
  perform _contact_quota_equipe(v_moi);
  return _contact_creer(v_l, v_p, null, v_moi, (select _contact_nom_fiche(m, v_l) from contacts m where m.id = v_moi), null,
                        v_sujet, v_texte,
                        jsonb_build_array(jsonb_build_object('stagiaire_id', p_stagiaire_id,
                                                             'nom', coalesce(_contact_nom_stagiaire(p_stagiaire_id), 'Stagiaire'))));
end $fn$;

-- 2. reglages_contact() dit si l'on peut modifier : clé peut_modifier (geste_centre(l, 'reglages.modifier'), le droit des trois
--    fonctions d'écriture des réglages). La sortie reste un jsonb : une clé de plus, rien d'autre ne change.
create or replace function public.reglages_contact(p_lieu_id integer)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
begin
  if p_lieu_id is null or not coalesce(case_centre(p_lieu_id, 'reglages') >= 1, false) then
    raise exception 'contact: Réservé aux réglages du centre.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'peut_modifier', coalesce(geste_centre(p_lieu_id, 'reglages.modifier'), false),
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

-- 1. Le 429 durable de Resend : l'issue « limite » remet l'envoi « à retenter » dans 5 minutes SANS consommer de tentative
--    (tentatives revient à sa valeur d'avant la prise : _contact_srv_prendre l'avait augmentée de 1) et retire ses jetons (rien n'est
--    parti). Sauf pour un envoi créé depuis plus de 24 heures : « limite » le passe en échec, raison « Resend 429 durable : non parti
--    après 24 h » (tentative gardée), pour qu'il se voie ; « Relancer l'envoi » le remet en file. Les autres issues ne changent pas :
--    « envoye » ; « ignore » ; « echec » (à retenter dans 5 minutes à la première tentative, en échec ensuite). Un envoi qui n'est plus
--    « en cours » n'est pas touché.
create or replace function public._contact_srv_resultat(p_envoi_id bigint, p_issue text, p_raison text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_maintenant timestamptz := _contact_maintenant();
begin
  if p_issue is null or p_issue not in ('envoye', 'echec', 'ignore', 'limite') then
    raise exception 'contact: Issue d''envoi illisible.';
  end if;
  update contact_envois
     set etat = case when p_issue = 'limite' and cree_le <= v_maintenant - interval '24 hours' then 'echec'
                     when p_issue = 'limite' then 'a_retenter' when p_issue <> 'echec' then p_issue
                     when tentatives <= 1 then 'a_retenter' else 'echec' end,
         tentatives = case when p_issue = 'limite' and cree_le > v_maintenant - interval '24 hours' then greatest(tentatives - 1, 0)
                           else tentatives end,
         envoye_le = case when p_issue = 'envoye' then v_maintenant end,
         prochain_essai_le = case when (p_issue = 'limite' and cree_le > v_maintenant - interval '24 hours')
                                       or (p_issue = 'echec' and tentatives <= 1) then v_maintenant + interval '5 minutes' end,
         raison = case when p_issue = 'limite' and cree_le <= v_maintenant - interval '24 hours'
                       then 'Resend 429 durable : non parti après 24 h'
                       else left(nullif(btrim(p_raison), ''), 200) end
   where id = p_envoi_id and etat = 'en_cours';
  if found and p_issue <> 'envoye' then
    delete from contact_jetons x where x.envoi_id = p_envoi_id;
  end if;
end $fn$;

-- 8. _contact_srv_jeton : un jeton lisible est haché en hexadécimal, connu, non expiré, sa fiche encore dans le centre de la demande, ET
--    cette fiche n'est pas partie (date de départ passée ; le jour du départ compte encore, comme pour _contact_disponible). Nul sinon :
--    _contact_srv_lien et _contact_srv_agir rendent alors {invalide: true}.
create or replace function public._contact_srv_jeton(p_hash text)
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
                     where d.id = j.demande_id and _contact_fiche_dans(c, d.lieu_id)
                       and (c.depart_le is null or c.depart_le >= _contact_jour())) then
    return null;
  end if;
  return j;
end $fn$;

-- 6b et 7c. Effacement d'un stagiaire (efface_le posé) : ses demandes qui ne sont pas des absences disparaissent quand il en est
--     l'auteur ou le destinataire PRINCIPAL (une ligne annexe ne retire que sa ligne, jamais la demande d'un autre) ; sa marque de
--     délégué (stagiaires.delegue) est vidée.
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
  delete from demande_destinataires x where x.stagiaire_id = new.id;
  delete from contact_envois e where e.vers_stagiaire_id = new.id;
  update stagiaires set delegue = null where id = new.id and delegue is not null;
  return null;
end $fn$;

-- 3. Envois annexes d'une absence : un formateur du jour dont la fiche est indisponible (partie, en congé, sans adresse) n'est pas prévenu
--    mais son nom figure en « non prévenu », comme un formateur sans fiche (R-4Cb) ; les fiches disponibles restent prévenues.
create or replace function public._contact_annexes(l integer, p integer, p_jours jsonb, p_auteur integer)
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
               and not exists (select 1 from contacts c where c.prof_id = pf.id and _contact_disponible(c, l, _contact_jour()))) n
    union all
    select null::bigint, st.id, coalesce(_contact_nom_stagiaire(st.id), 'Délégué'), 'delegue', null::text
      from stagiaires st
     where st.promo_id = p and st.delegue is not null and st.id is distinct from p_auteur
       and st.actif and st.efface_le is null and st.anonymise_le is null
       and exists (select 1 from user_profiles up where up.stagiaire_id = st.id)
  )
  select * from tout order by annexe desc, nom, fiche_id, stagiaire_id;
$fn$;

-- 5. Absences. prevenir_absence() refuse une absence qui commence plus de 120 jours après aujourd'hui (_contact_jour()).
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

-- 5. regler_justificatif() juge le droit avant le type : sans droit, « Demande introuvable. » quelle que soit la demande.
create or replace function public.regler_justificatif(p_id bigint, p_etat text)
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
  -- Le droit d'abord : sans rôle sur la demande, seul un formateur de la promo la voit ici, et seulement si c'est une absence ;
  -- pour tout autre, « introuvable », quelle que soit la demande (rien ne dit qu'elle existe ni de quel type elle est).
  if d.id is null or v_role = 'delegue'
     or (v_role is null and (d.type is distinct from 'absence' or not coalesce(_contact_formateur_de(d.promo_id), false))) then
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

-- 5. _contact_premarquer() : l'insertion d'une ligne d'émargement cède à une ligne écrite au même instant (une signature) :
--    on conflict (seance_id, stagiaire_id) do nothing ; la ligne déjà là n'est pas touchée.
create or replace function public._contact_premarquer(p_seance bigint, p_stagiaire integer default null)
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
          values (s.id, s.promo_id, x.stagiaire_id, x.entiere, case when x.entiere then 'annoncee' end, v_obs, null)
          on conflict (seance_id, stagiaire_id) do nothing;
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

-- 5. Le chemin du justificatif (déclencheur d'update de absences_annoncees) lit les feuilles de l'absence sous verrou partagé avant
--    de toucher une ligne.
create or replace function public._contact_emargement_absence()
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
    -- Les feuilles de ses jours, lues sous verrou partagé avant de toucher une ligne : une feuille ne se clôt pas pendant que
    -- l'observation change (emargement_clore la verrouille pour la clore), et son statut lu ci-dessous est celui du moment.
    perform 1 from emargement_seances s where s.promo_id = new.promo_id and s.jour between new.du and new.au order by s.id for share;
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

-- Contrôle de fin : la marque de la migration et son index sont là, sans aucun droit ; aucun stagiaire effacé n'est délégué ; aucune aide _contact_* ne s'exécute par anon ni authenticated
-- (sauf _contact_compte_equipe, migration 1) ; les fonctions de l'app redéfinies gardent leurs droits (authenticated, jamais anon) ;
-- _contact_srv_resultat reste à service_role seul, _contact_srv_jeton sans aucun droit ; les fonctions retouchées portent leur correctif.
do $controle$
declare
  f record;
begin
  if to_regprocedure('public._contact_quota_equipe(bigint)') is null then
    raise exception 'contact_4 : _contact_quota_equipe manque ; tout est annulé';
  end if;
  if to_regclass('public.demandes_auteur_fiche_cree') is null
     or exists (select 1 from public.stagiaires where efface_le is not null and delegue is not null) then
    raise exception 'contact_4 : index du quota absent ou délégué effacé restant ; tout est annulé';
  end if;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname like '\_contact\_%' and p.proname <> '_contact_compte_equipe' loop
    if has_function_privilege('anon', f.sig, 'EXECUTE') or has_function_privilege('authenticated', f.sig, 'EXECUTE') then
      raise exception 'contact_4 : l''aide interne % s''exécute par anon ou authenticated ; tout est annulé', f.sig;
    end if;
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('coordonnees_promo', 'ordonner_fiches', 'regler_financements', 'ecrire_a', 'ecrire_au_stagiaire',
                                'reglages_contact', 'prevenir_absence', 'regler_justificatif') loop
    if has_function_privilege('anon', f.sig, 'EXECUTE') or not has_function_privilege('authenticated', f.sig, 'EXECUTE') then
      raise exception 'contact_4 : la fonction % n''a pas ses droits (authenticated seul) ; tout est annulé', f.sig;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public._contact_srv_resultat(bigint, text, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public._contact_srv_resultat(bigint, text, text)', 'EXECUTE') then
    raise exception 'contact_4 : _contact_srv_resultat n''a pas ses droits (service_role seul) ; tout est annulé';
  end if;
  if has_function_privilege('service_role', 'public._contact_srv_jeton(text)', 'EXECUTE') then
    raise exception 'contact_4 : _contact_srv_jeton s''exécute par service_role (aucun droit attendu) ; tout est annulé';
  end if;
  if (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
       and ((p.proname = '_contact_srv_resultat' and pg_get_functiondef(p.oid) like '%''limite''%'
             and pg_get_functiondef(p.oid) like '%Resend 429 durable%')
            or (p.proname = '_contact_srv_jeton' and pg_get_functiondef(p.oid) like '%c.depart_le >= _contact_jour()%')
            or (p.proname = 'reglages_contact' and pg_get_functiondef(p.oid) like '%peut_modifier%')
            or (p.proname in ('ecrire_a', 'ecrire_au_stagiaire') and pg_get_functiondef(p.oid) like '%_contact_quota_equipe(v_moi)%')
            or (p.proname = '_contact_premarquer' and pg_get_functiondef(p.oid) like '%on conflict (seance_id, stagiaire_id) do nothing%')
            or (p.proname = 'prevenir_absence' and pg_get_functiondef(p.oid) like '%_contact_jour() + 120%')
            or (p.proname = 'ordonner_fiches' and pg_get_functiondef(p.oid) like '%c.lieu_id = v_l);%')
            or (p.proname = '_contact_annexes' and pg_get_functiondef(p.oid) like '%_contact_disponible(c, l, _contact_jour())%'))) <> 9 then
    raise exception 'contact_4 : une fonction redéfinie ne porte pas son correctif ; tout est annulé';
  end if;
end $controle$;
