-- Marche arrière de l'étape 2 : rétablit la liste relevée le 03/10/2026, ligne 98 et sa
-- progression de la promo de mars comprises. La progression est écrite directement dans
-- themes_progression : le retour vaut avant comme après le ménage multi-promo, qui retire
-- de themes les colonnes héritées et leurs déclencheurs. À jouer avant l'import des cours de
-- compétence : il vide themes.code, que cours.code ne référence pas par une clé étrangère.
-- Les intitulés d'origine portaient un tiret cadratin : il est produit par chr(8212), jamais
-- écrit dans ce fichier.

do $$
begin
  assert not exists (select 1 from public.qcm q join public.themes t on t.id = q.theme_id
                     where t.code in ('C3.7', 'C3.9')),
    'un QCM est rattaché à C3.7 ou C3.9 : la suppression l''emporterait';
end $$;

delete from public.themes where code in ('C3.7', 'C3.9') and categorie = 'Compétence conduite (REMC)';

insert into public.themes (id, titre, categorie, type, ordre)
values (98, 'REMC C2.8 ' || chr(8212) || ' Franchir les différents types d''intersection et y changer de direction',
        'Compétence conduite (REMC)', 'notion', 218);

insert into public.themes_progression (promo_id, theme_id, statut, date_fait, updated_by_email)
values (1, 98, 'Fait', '2026-05-04', 'misterwatchi@gmail.com')
on conflict (promo_id, theme_id) do update
  set statut = excluded.statut, date_fait = excluded.date_fait, updated_by_email = excluded.updated_by_email;

update public.themes as t set code = null, ordre = v.ordre, titre = 'REMC ' || v.ancien || ' ' || chr(8212) || ' ' || v.titre
from (values
  (80,  'C1',   200, 'Maîtriser le maniement du véhicule dans un trafic faible ou nul'),
  (81,  'C1.1', 201, 'Connaître les principaux organes et commandes, vérifications intérieures/extérieures'),
  (82,  'C1.2', 202, 'Entrer, s''installer au poste de conduite et en sortir'),
  (83,  'C1.3', 203, 'Tenir, tourner le volant et maintenir la trajectoire'),
  (84,  'C1.4', 204, 'Démarrer et s''arrêter'),
  (85,  'C1.5', 205, 'Doser l''accélération et le freinage à diverses allures'),
  (86,  'C1.6', 206, 'Utiliser la boîte de vitesses'),
  (87,  'C1.7', 207, 'Diriger la voiture en avant, en ligne droite et en courbe (allure et trajectoire)'),
  (88,  'C1.8', 208, 'Regarder autour de soi et avertir'),
  (89,  'C1.9', 209, 'Effectuer une marche arrière et un demi-tour en sécurité'),
  (90,  'C2',   210, 'Appréhender la route et circuler dans des conditions normales'),
  (91,  'C2.1', 211, 'Connaître les principales règles de circulation et la signalisation'),
  (92,  'C2.2', 212, 'Tenir compte de la signalisation verticale et horizontale'),
  (93,  'C2.3', 213, 'Rechercher les indices utiles'),
  (94,  'C2.4', 214, 'Utiliser toutes les commandes'),
  (95,  'C2.5', 215, 'Adapter sa vitesse aux situations'),
  (96,  'C2.6', 216, 'Choisir la voie de circulation'),
  (97,  'C2.7', 217, 'Maintenir les distances de sécurité'),
  (99,  'C3',   220, 'Circuler dans des conditions difficiles et partager la route'),
  (100, 'C3.1', 221, 'Évaluer et maintenir les distances de sécurité'),
  (101, 'C3.2', 222, 'Croiser, dépasser, être dépassé'),
  (102, 'C3.3', 223, 'Passer les virages et conduire en déclivité'),
  (103, 'C3.4', 224, 'Connaître et respecter les autres usagers (respect et courtoisie)'),
  (104, 'C3.5', 225, 'S''insérer, circuler et sortir d''une voie rapide'),
  (105, 'C3.6', 226, 'Conduire dans une file de véhicule et dans une circulation dense'),
  (106, 'C3.7', 227, 'Conduire quand l''adhérence et la visibilité sont réduites'),
  (107, 'C4',   230, 'Pratiquer une conduite autonome, sûre et économique'),
  (108, 'C4.1', 231, 'Suivre un itinéraire de façon autonome'),
  (109, 'C4.2', 232, 'Préparer et effectuer un voyage longue distance en autonomie'),
  (110, 'C4.3', 233, 'Connaître les principaux facteurs de risque au volant et recommandations'),
  (111, 'C4.4', 234, 'Comportements en cas d''accident : protéger, alerter, secourir'),
  (112, 'C4.5', 235, 'Faire l''expérience des aides à la conduite (régulateur, limiteur, ABS, navigation)'),
  (113, 'C4.6', 236, 'Notions sur l''entretien, le dépannage et les situations d''urgence'),
  (114, 'C4.7', 237, 'Pratiquer l''éco-conduite')
) as v(id, ancien, ordre, titre)
where t.id = v.id;

-- Contrôles de sortie, valables avant comme après le ménage multi-promo : si l'un échoue,
-- tout le retour est annulé plutôt que de laisser une liste à moitié rétablie.
do $$
begin
  assert (select count(*) from public.themes where categorie = 'Compétence conduite (REMC)') = 35,
    'retour : 35 lignes REMC attendues';
  assert not exists (select 1 from public.themes where categorie = 'Compétence conduite (REMC)' and code is not null),
    'retour : codes restants';
  assert (select count(*) from public.themes
          where categorie = 'Compétence conduite (REMC)' and titre like 'REMC C%') = 35,
    'retour : intitulés d''origine non rétablis';
  assert (select statut from public.themes_progression where theme_id = 98 and promo_id = 1) = 'Fait',
    'retour : progression de la ligne 98';
end $$;
