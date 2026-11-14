-- Marche arrière de 20261115_contact_1b_fermeture.sql : la lecture directe de contacts redevient ouverte à tout compte connecté du
-- centre de la promo affichée (contacts_select_authenticated reprend le texte « true », seul texte écrit dans le dépôt :
-- 20261028_roles_3_regles_retour.sql ; la règle restrictive contacts_meme_centre limite toujours au centre affiché).
-- Garde : la règle porte le texte de la migration 1b (elle cite fiches_internes.ecrire) ; sinon rien ne change.
set local lock_timeout = '3s';

do $garde$
declare
  v_attendu constant text := '(SELECTgeste_promo((SELECTpromo_courante()ASpromo_courante),''fiches_internes.ecrire''::text)ASgeste_promo)';
begin
  if (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'contacts'
         and p.policyname = 'contacts_select_authenticated'
         and regexp_replace(replace(p.qual, 'public.', ''), '\s', '', 'g') = v_attendu) <> 1 then
    raise exception 'contact_1b_retour : la règle contacts_select_authenticated n''a pas le texte de la migration 1b ; rien n''est changé';
  end if;
end $garde$;

alter policy contacts_select_authenticated on public.contacts
  using (true);
