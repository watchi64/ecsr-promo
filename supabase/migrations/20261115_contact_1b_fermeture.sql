-- Espace contact, migration 1b : la lecture directe de contacts se ferme à qui n'écrit pas les fiches.
-- Jusqu'ici, tout compte connecté lisait par l'API les fiches sans compte du centre de la promo affichée (la page Documents de
-- l'ancienne app les lit ainsi). Désormais seuls ceux qui écrivent les fiches de la promo affichée (geste fiches_internes.ecrire :
-- formateur ou direction à titre fixe, fondateur hors aperçu) les lisent en direct, pour la fenêtre de modification ; tous les autres
-- lisent l'annuaire par la fonction annuaire_centre() (migration 1), qui masque ce qui doit l'être.
-- Appliquée en production juste APRÈS la fusion de l'app (qui ne lit plus contacts en direct hors de la modification) ; la migration 1
-- l'est AVANT. Seule la règle contacts_select_authenticated change (alter policy : nom, commande et rôles inchangés) ; la règle
-- restrictive contacts_meme_centre reste en « et ».
-- Garde : la migration 1 est appliquée (contacts.compte_email et annuaire_centre() existent) et contacts_select_authenticated existe
-- une fois avec le texte « true » ; sinon rien ne change.
-- Marche arrière : 20261115_contact_1b_fermeture_retour.sql.
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'contacts' and column_name = 'compte_email')
     or to_regprocedure('public.annuaire_centre()') is null then
    raise exception 'contact_1b : la migration 1 (20261115_contact_1_annuaire) n''est pas appliquée ; rien n''est changé';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'contacts'
         and policyname = 'contacts_select_authenticated' and qual = 'true') <> 1 then
    raise exception 'contact_1b : la règle contacts_select_authenticated est absente ou n''est plus « true » (déjà fermée ?) ; rien n''est changé';
  end if;
end $garde$;

alter policy contacts_select_authenticated on public.contacts
  using ((select public.geste_promo((select public.promo_courante()), 'fiches_internes.ecrire')));
