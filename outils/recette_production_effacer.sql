-- Recette de l'espace contact contre la production, partie 3 : tout retirer (voir recette_production_creer.sql).
-- La demande d'essai (et par cascade ses destinataires, messages, envois et jetons), puis la fiche d'essai. Contrôle de fin : plus
-- aucune trace de l'essai ; si la production n'avait aucune autre demande, les tables de l'espace contact reviennent à zéro.
--   PGCLIENTENCODING=UTF8 bash <TP_ECSR_App>/outils/psql_prod.sh -X -q -1 -v ON_ERROR_STOP=1 -f outils/recette_production_effacer.sql
create temp table recette_demandes on commit drop as
  select distinct x.demande_id as id
    from demande_destinataires x join contacts c on c.id = x.fiche_id
   where c.prenom = 'Essai e-mail (coordination)' and c.lieu_id = 4;

delete from demandes where id in (select id from recette_demandes);
delete from contacts where prenom = 'Essai e-mail (coordination)' and lieu_id = 4;

do $controle$
begin
  if exists (select 1 from contacts where prenom = 'Essai e-mail (coordination)')
     or exists (select 1 from demandes where sujet = 'Essai de la coordination')
     or exists (select 1 from contact_envois e where e.demande_id in (select id from recette_demandes))
     or exists (select 1 from contact_jetons j where j.demande_id in (select id from recette_demandes)) then
    raise exception 'recette : une trace de l''essai reste ; tout est annulé';
  end if;
end $controle$;

select (select count(*) from recette_demandes) as demandes_retirees,
       (select count(*) from demandes) as demandes_restantes,
       (select count(*) from contact_envois) as envois_restants,
       (select count(*) from contact_jetons) as jetons_restants,
       (select count(*) from demande_messages) as messages_restants;
