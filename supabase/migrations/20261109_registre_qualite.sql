-- Registre qualité (Qualiopi, indicateurs 31 et 32), lot Q4 du chantier du 2026-11-08.
-- Spec : docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md (§ 3 décision 4, § 5, § 7, § 8, § 10). Plan :
-- docs/superpowers/plans/2026-11-09-qualiopi-q4-registre.md (tâche 2). Règles pures reprises ici : js/registre-rules.js
-- (echeanceEffacement, aEffacer). Retour : 20261109_registre_qualite_retour.sql. Preuve :
-- tests/sql/registre-qualite-preuve.sql. Appliquée en production le 10/11/2026, avec l'accord de Timy
-- (psql -1, PGCLIENTENCODING=UTF8, accents vérifiés) : essai à blanc VERT 131/0, puis preuve VERT 128/0 deux fois.
--
-- Une entrée : type, date du constat, origine (jamais le nom d'une personne), promo et lieu facultatifs, description,
-- réponse et sa date, action décidée, état, mesure de prévention (risque seulement), lien facultatif vers un signalement
-- « Signaler un problème ». Lecture et écriture directes par l'app, au seul gestionnaire de la qualité.
--
-- Droits : peut_gerer_qualite() (créée par Q3, 20261108_questionnaires.sql : le fondateur réel, hors aperçu), lue ici,
-- ni recréée ni retirée. Lecture, ajout et modification sous cette fonction ; aucune suppression (le registre est une
-- preuve : une erreur se clôt avec une réponse qui le dit). anon n'a rien ; service_role garde les droits par défaut
-- de Supabase (outils du serveur), le déclencheur s'applique aussi à lui.
--
-- Le déclencheur pose ce que l'app ne fournit jamais : cree_le, modifie_le, issu_signalement (vrai si l'entrée naît d'un
-- signalement, figé ensuite), clos_le (posé au passage à clos, remis à nul à la réouverture), lieu_id d'après la promo.
-- Lien vers le signalement : signaler_probleme() purge les signalements de plus de 12 mois (la purge tourne chez la
-- personne qui signale) et la fermeture d'un compte efface les siens en cascade. Le lien est donc « on delete set
-- null » : cette mise à nul seule passe toujours, pour tout compte et même sur une entrée effacée, sans rien changer
-- d'autre (modifie_le compris) ; issu_signalement en garde la trace.
--
-- Effacement à 3 ans (spec § 10, arbitrage du 09/11) : une entrée close dont clos_le + interval '3 years' < now()
-- perd ses quatre textes (description, réponse, action décidée, mesure de prévention) ; type, origine, promo, lieu,
-- dates et état restent. Une seule échéance, écrite à l'identique dans le déclencheur et dans
-- effacer_registre_qualite(), comme aEffacer() de js/registre-rules.js. Une entrée jamais close ne s'efface jamais.
-- Une entrée effacée ne se modifie plus.
-- Refus en « registre: <phrase> », la phrase étant montrée telle quelle par l'app (js/registre-erreurs.js).

-- 1. La table ------------------------------------------------------------------------------------------------------
create table public.registre_qualite (
  id bigint generated always as identity primary key,
  type text not null check (type in ('reclamation', 'difficulte', 'alea', 'amelioration', 'risque')),
  date_constat date not null,
  origine text not null check (origine in ('stagiaire', 'formateur', 'entreprise', 'financeur', 'equipe', 'autre')),
  -- Les entrées sont des preuves Qualiopi : supprimer une promo ou un lieu qui en porte est refusé.
  promo_id integer references public.promos(id) on delete restrict,
  lieu_id integer references public.lieux(id) on delete restrict,
  description text check (description is null or char_length(description) between 3 and 2000),
  reponse text check (reponse is null or char_length(reponse) between 1 and 2000),
  date_reponse date,
  action_decidee text check (action_decidee is null or char_length(action_decidee) between 1 and 2000),
  etat text not null default 'ouvert' check (etat in ('ouvert', 'en_cours', 'clos')),
  mesure_prevention text check (mesure_prevention is null or char_length(mesure_prevention) between 1 and 2000),
  signalement_id bigint unique references public.signalements_app(id) on delete set null,
  issu_signalement boolean not null default false,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  clos_le timestamptz,
  efface_le timestamptz,
  constraint registre_qualite_description check (description is not null or efface_le is not null),
  constraint registre_qualite_date_reponse check (date_reponse is null or reponse is not null or efface_le is not null),
  constraint registre_qualite_date_reponse_ordre check (date_reponse is null or date_reponse >= date_constat),
  constraint registre_qualite_mesure_hors_risque check (type = 'risque' or mesure_prevention is null),
  constraint registre_qualite_risque_clos
    check (type <> 'risque' or etat <> 'clos' or mesure_prevention is not null or efface_le is not null),
  constraint registre_qualite_clos check ((etat = 'clos') = (clos_le is not null)),
  constraint registre_qualite_efface_clos check (efface_le is null or etat = 'clos')
);

-- 2. Le déclencheur ------------------------------------------------------------------------------------------------
create function public._registre_qualite_avant()
returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_lieu integer;
  v_textes constant text[] := array['description', 'reponse', 'action_decidee', 'mesure_prevention'];
begin
  if tg_op = 'UPDATE' then
    -- Mise à nul seule du lien (purge à 12 mois, compte fermé, ou le gestionnaire) : passe toujours, rien d'autre ne
    -- bouge.
    if old.signalement_id is not null and new.signalement_id is null
       and (to_jsonb(new) - 'signalement_id') = (to_jsonb(old) - 'signalement_id') then
      return new;
    end if;
    if old.efface_le is not null then
      raise exception 'registre: Cette entrée est effacée : elle ne se modifie plus.';
    end if;
    if new.signalement_id is not null and new.signalement_id is distinct from old.signalement_id then
      raise exception 'registre: Le lien vers le signalement ne se change pas : tu peux seulement le retirer.';
    end if;
    new.cree_le := old.cree_le;
    new.issu_signalement := old.issu_signalement;
  else
    new.cree_le := now();
    new.issu_signalement := new.signalement_id is not null;
  end if;
  new.modifie_le := now();

  -- Clôture : posée au passage à clos, gardée tant que l'entrée reste close, remise à nul à la réouverture.
  if new.etat = 'clos' then
    new.clos_le := case when tg_op = 'UPDATE' and old.etat = 'clos' then old.clos_le else now() end;
  else
    new.clos_le := null;
  end if;

  -- Lieu : celui de la promo quand il y en a une, posé à la création, quand la promo change ou quand le lieu change. Un
  -- lieu fourni contraire est refusé ; à la modification, un lieu laissé tel quel suit la nouvelle promo. Promo et lieu
  -- inchangés : le lieu reste celui de l'entrée, même si la promo a changé de centre depuis (une promo l'a déjà fait,
  -- 20261003_multi_promo_montpellier.sql) : l'effacement et la mise à nul du lien ne s'y heurtent donc pas.
  if new.promo_id is not null
     and (tg_op = 'INSERT' or new.promo_id is distinct from old.promo_id or new.lieu_id is distinct from old.lieu_id) then
    select pr.lieu_id into v_lieu from promos pr where pr.id = new.promo_id;
    if found then
      if new.lieu_id is not null and new.lieu_id <> v_lieu
         and (tg_op = 'INSERT' or new.lieu_id is distinct from old.lieu_id) then
        raise exception 'registre: Le centre ne correspond pas à la promo choisie.';
      end if;
      new.lieu_id := v_lieu;
    end if;
  end if;

  -- Effacement : après l'échéance seulement, les quatre textes à nul, rien d'autre ne change.
  if new.efface_le is not null then
    if new.clos_le is null or not (new.clos_le + interval '3 years' < now()) then
      raise exception 'registre: Cette entrée ne peut pas encore être effacée : il faut attendre 3 ans après sa clôture.';
    end if;
    if new.description is not null or new.reponse is not null or new.action_decidee is not null
       or new.mesure_prevention is not null then
      raise exception 'registre: L''effacement vide les quatre textes (description, réponse, action décidée, mesure de prévention).';
    end if;
    if (to_jsonb(new) - v_textes - array['efface_le', 'modifie_le'])
       is distinct from (to_jsonb(old) - v_textes - array['efface_le', 'modifie_le']) then
      raise exception 'registre: L''effacement ne change que les textes.';
    end if;
    new.efface_le := now();
  end if;
  return new;
end;
$function$;

create trigger registre_qualite_avant
  before insert or update on public.registre_qualite
  for each row execute function public._registre_qualite_avant();
revoke all on function public._registre_qualite_avant() from public, anon, authenticated, service_role;

-- 3. Droits et règles ----------------------------------------------------------------------------------------------
-- Lecture, ajout et modification pour authenticated, filtrés par peut_gerer_qualite() ; aucune suppression ; rien pour
-- anon. L'identifiant vient de sa séquence sans droit sur elle (colonne d'identité) : la séquence reste fermée.
alter table public.registre_qualite enable row level security;
revoke all on public.registre_qualite from public, anon, authenticated;
grant select, insert, update on public.registre_qualite to authenticated;
revoke all on sequence public.registre_qualite_id_seq from public, anon, authenticated;

create policy registre_qualite_lecture on public.registre_qualite
  for select to authenticated using ((select peut_gerer_qualite()));
create policy registre_qualite_ajout on public.registre_qualite
  for insert to authenticated with check ((select peut_gerer_qualite()));
create policy registre_qualite_modification on public.registre_qualite
  for update to authenticated using ((select peut_gerer_qualite())) with check ((select peut_gerer_qualite()));

-- 4. Effacement à 3 ans (gestion), à la main : vide les entrées dues, rend leur nombre --------------------------------
create function public.effacer_registre_qualite()
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  n integer;
begin
  if not peut_gerer_qualite() then
    raise exception 'registre: Tu n''as pas accès au registre qualité.';
  end if;
  update registre_qualite
     set description = null, reponse = null, action_decidee = null, mesure_prevention = null, efface_le = now()
   where etat = 'clos' and efface_le is null and clos_le + interval '3 years' < now();
  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.effacer_registre_qualite() from public, anon;
grant execute on function public.effacer_registre_qualite() to authenticated;
