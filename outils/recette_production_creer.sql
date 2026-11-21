-- Recette de l'espace contact contre la production (plan 2026-11-14-espace-contact.md, dossier, étape 6), partie 1 : le faux dossier.
-- Crée au centre de démonstration (lieu 4, promo 7, données fictives) une fiche d'essai sans compte, portant l'adresse donnée à
-- la ligne de commande, une demande « administratif » d'un stagiaire fictif vers cette fiche, et l'envoi « nouvelle » à traiter.
-- L'adresse n'est jamais écrite dans ce fichier : elle arrive par -v adresse=... (coordination, psql en une transaction) :
--   PGCLIENTENCODING=UTF8 bash <TP_ECSR_App>/outils/psql_prod.sh -X -q -1 -v ON_ERROR_STOP=1 -v adresse=<adresse> -f outils/recette_production_creer.sql
-- Ensuite (partie 2) : un compte connecté appelle contact-envois { op: "etat" } puis { op: "traiter" } ; l'e-mail arrive ; le jeton du
-- bouton « Prise en compte » sert à { op: "lien" }, puis { op: "agir" } deux fois ({ fait: true }, puis { deja: true }).
-- Enfin recette_production_effacer.sql retire tout. Gardes : la file doit être vide, aucun essai ne doit être déjà en place.
\if :{?adresse}
\else
  \echo 'recette : -v adresse=... manque ; rien n''est fait'
  \quit
\endif

select set_config('recette.adresse', :'adresse', true);

do $garde$
begin
  if current_setting('recette.adresse') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'recette : adresse illisible ; rien n''est fait';
  end if;
  if not exists (select 1 from lieux where id = 4 and demonstration) or not exists (select 1 from promos where id = 7 and lieu_id = 4) then
    raise exception 'recette : centre ou promo de démonstration introuvable ; rien n''est fait';
  end if;
  if exists (select 1 from contact_envois where etat in ('a_envoyer', 'a_retenter', 'en_cours')) then
    raise exception 'recette : la file contient déjà des envois en attente ; rien n''est fait';
  end if;
  if exists (select 1 from contacts where prenom = 'Essai e-mail (coordination)') then
    raise exception 'recette : une fiche d''essai existe déjà (lancer recette_production_effacer.sql) ; rien n''est fait';
  end if;
end $garde$;

with fiche as (
  insert into contacts (lieu_id, prenom, email, note)
  values (4, 'Essai e-mail (coordination)', current_setting('recette.adresse'), 'Fiche de recette, retirée à la fin de l''essai.')
  returning id
), auteur as (
  select s.id, btrim(s.prenom || coalesce(' ' || left(nullif(btrim(s.nom), ''), 1) || '.', '')) as nom
    from stagiaires s where s.promo_id = 7 order by s.id limit 1
), demande as (
  insert into demandes (lieu_id, promo_id, auteur_stagiaire_id, auteur_nom, type, sujet, texte)
  select 4, 7, a.id, a.nom, 'administratif', 'Essai de la coordination',
         'TEXTE SECRET DE RECETTE : ce texte ne doit jamais figurer dans l''e-mail.'
    from auteur a
  returning id
), destinataire as (
  insert into demande_destinataires (demande_id, fiche_id, nom, principal)
  select d.id, f.id, 'Essai e-mail (coordination)', true from demande d, fiche f
  returning demande_id
)
insert into contact_envois (demande_id, vers_fiche_id, evenement)
select d.id, f.id, 'nouvelle' from demande d, fiche f, destinataire;

-- Ce que verra la fonction : une ligne en attente, vers la fiche d'essai, qui peut prendre en compte (bouton « Prise en compte »).
select e.id as envoi, e.etat, d.id as demande, d.auteur_nom,
       _contact_role(d.id, null, e.vers_fiche_id) as role_de_la_fiche,
       (_contact_peut(d.id, _contact_role(d.id, null, e.vers_fiche_id), true) ->> 'prendre') as peut_prendre,
       (select count(*) from contact_reponses r where r.lieu_id = 4 and not r.retire) as reponses_toutes_faites
  from contact_envois e join demandes d on d.id = e.demande_id
 where e.vers_fiche_id = (select id from contacts where prenom = 'Essai e-mail (coordination)');
