-- Données « réelles » à poser sur une base locale AVANT tests/sql/conservation-preuve.sql (11/11/2026).
-- La base de production a désormais des entrées au registre qualité et des lignes au journal des effacements : la preuve
-- doit rester VERTE avec elles. Ce fichier les imite sur la base jetable, en visant ce qui faisait tomber l'ancienne
-- version : une entrée déjà due (l'effacement en vide 3, pas 2), une échéance plus proche que celle de RQ3, une entrée
-- ouverte, une entrée déjà vidée, et des lignes de journal de chaque type que la base accepte à ce moment (avant la
-- migration : stagiaire, promo, benevoles ; après : aussi etape1, etape2, demande, questionnaires, registre).
-- Jouer après le schéma minimal (et après la migration pour la variante « appliquée ») :
--   psql -p <port> -U postgres -d cs -v ON_ERROR_STOP=1 -f tests/sql/conservation-preuve-donnees-reelles.sql
-- Données fictives (exemple-reel.invalid, aucun nom). Base locale seulement : le déclencheur du registre pose clos_le à la
-- clôture, les dates anciennes se posent donc déclencheur muet (session_replication_role, comme dans la preuve).

begin;
set local session_replication_role = replica;
insert into registre_qualite (type, date_constat, origine, description, reponse, etat, clos_le)
values ('reclamation', current_date - 1300, 'stagiaire', 'Entrée réelle due', 'Réponse réelle', 'clos',
        now() - interval '3 years' - interval '5 days');
insert into registre_qualite (type, date_constat, origine, description, etat, clos_le)
values ('alea', current_date - 1200, 'formateur', 'Entrée réelle bientôt due', 'clos',
        now() - interval '3 years' + interval '10 days');
insert into registre_qualite (type, date_constat, origine, description, etat)
values ('amelioration', current_date - 20, 'equipe', 'Entrée réelle ouverte', 'ouvert');
insert into registre_qualite (type, date_constat, origine, description, etat)
values ('difficulte', current_date - 15, 'autre', 'Entrée réelle en cours', 'en_cours');
insert into registre_qualite (type, date_constat, origine, description, etat, clos_le)
values ('alea', current_date - 2000, 'equipe', 'Entrée réelle vidée', 'clos', now() - interval '5 years');
update registre_qualite set description = null, efface_le = now() - interval '2 years'
 where description = 'Entrée réelle vidée';
insert into registre_qualite (type, date_constat, origine, description, etat, clos_le)
values ('reclamation', current_date - 10, 'financeur', 'Entrée réelle close récemment', 'clos', now() - interval '2 days');
commit;

do $$
declare t text; n integer := 0;
begin
  foreach t in array array['stagiaire', 'promo', 'benevoles', 'etape1', 'etape2', 'demande', 'questionnaires', 'registre'] loop
    begin
      insert into effacements_journal (type, cible, fait_par_email, fait_le, details)
      values (t, case t when 'stagiaire' then 'stagiaire 1' when 'demande' then 'stagiaire 2'
                        when 'questionnaires' then 'lieu 1, année 2025' when 'registre' then 'registre' else 'promo 1' end,
              'direction@exemple-reel.invalid', now() - interval '30 days',
              case t when 'registre' then '{"entrees": 1}'::jsonb else '{}'::jsonb end);
      n := n + 1;
    exception when check_violation then
      null;  -- type pas encore accepté (base avant la migration)
    end;
  end loop;
  raise notice 'données réelles : % entrées au registre, % lignes au journal',
    (select count(*) from registre_qualite), n;
end $$;
