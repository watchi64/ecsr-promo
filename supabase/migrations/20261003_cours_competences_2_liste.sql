-- Cours des compétences de conduite, étape 2 : liste de référence alignée sur le livret
-- d'apprentissage B (arrêté du 29 juillet 2013, annexe III, version en vigueur depuis le
-- 27/01/2016 ; spec ECSR du 03/10/2026, section 2). À appliquer JUSTE APRÈS la mise en
-- ligne du code qui affiche la colonne code.
-- Marche arrière : 20261003_cours_competences_2_liste_retour.sql
--
-- Les gardes arrêtent tout, avant la moindre écriture, si l'état n'est plus celui relevé le
-- 03/10 : migration déjà appliquée, liste changée, QCM sur la ligne retirée, progression REMC
-- d'une autre promo que celle de mars (les codes réemployés changeraient le sens de ses
-- marques), séance du planning qui citerait un intitulé REMC (le planning garde ses sujets
-- par leur texte, le renommage couperait le lien sans bruit).

do $$
begin
  assert not exists (select 1 from public.themes where categorie = 'Compétence conduite (REMC)' and code is not null),
    'la liste REMC est déjà codée : migration déjà appliquée';
  assert (select count(*) from public.themes where categorie = 'Compétence conduite (REMC)') = 35,
    'la liste REMC a changé depuis le relevé du 03/10 : revoir la migration';
  assert (select count(*) from public.themes
          where categorie = 'Compétence conduite (REMC)' and id between 80 and 114) = 35,
    'identifiants REMC inattendus';
  assert not exists (select 1 from public.qcm where theme_id = 98), 'un QCM est rattaché à la ligne 98';
  assert not exists (select 1 from public.themes_progression p join public.themes t on t.id = p.theme_id
                     where t.categorie = 'Compétence conduite (REMC)' and p.promo_id <> 1),
    'une autre promo que celle de mars a une progression REMC : revoir la migration';
  assert not exists (select 1 from public.planning_entries where sujet like '%REMC C%' or sujet_2 like '%REMC C%'),
    'une séance du planning cite un intitulé REMC : revoir la migration';
end $$;

update public.themes as t set code = v.code, titre = v.titre, ordre = v.ordre
from (values
  (80,  'C1',   200, 'Maîtriser le maniement du véhicule dans un trafic faible ou nul'),
  (81,  'C1.1', 201, 'Connaître les principaux organes et commandes du véhicule, effectuer des vérifications intérieures et extérieures'),
  (82,  'C1.2', 202, 'Entrer, s''installer au poste de conduite et en sortir'),
  (83,  'C1.3', 203, 'Tenir, tourner le volant et maintenir la trajectoire'),
  (84,  'C1.4', 204, 'Démarrer et s''arrêter'),
  (85,  'C1.5', 205, 'Doser l''accélération et le freinage à diverses allures'),
  (86,  'C1.6', 206, 'Utiliser la boîte de vitesses'),
  (87,  'C1.7', 207, 'Diriger la voiture en avant en ligne droite et en courbe en adaptant allure et trajectoire'),
  (88,  'C1.8', 208, 'Regarder autour de soi et avertir'),
  (89,  'C1.9', 209, 'Effectuer une marche arrière et un demi-tour en sécurité'),
  (90,  'C2',   210, 'Appréhender la route et circuler dans des conditions normales'),
  (91,  'C2.1', 211, 'Rechercher la signalisation, les indices utiles et en tenir compte'),
  (92,  'C2.2', 212, 'Positionner le véhicule sur la chaussée et choisir la voie de circulation'),
  (93,  'C2.3', 213, 'Adapter l''allure aux situations'),
  (94,  'C2.4', 214, 'Tourner à droite et à gauche en agglomération'),
  (95,  'C2.5', 215, 'Détecter, identifier et franchir les intersections suivant le régime de priorité'),
  (96,  'C2.6', 216, 'Franchir les ronds-points et les carrefours à sens giratoire'),
  (97,  'C2.7', 217, 'S''arrêter et stationner en épi, en bataille et en créneau'),
  (99,  'C3',   220, 'Circuler dans des conditions difficiles et partager la route avec les autres usagers'),
  (100, 'C3.1', 221, 'Évaluer et maintenir les distances de sécurité'),
  (101, 'C3.2', 222, 'Croiser, dépasser, être dépassé'),
  (102, 'C3.3', 223, 'Passer des virages et conduire en déclivité'),
  (103, 'C3.4', 224, 'Connaître les caractéristiques des autres usagers et savoir se comporter à leur égard, avec respect et courtoisie'),
  (104, 'C3.5', 225, 'S''insérer, circuler et sortir d''une voie rapide'),
  (105, 'C3.6', 226, 'Conduire dans une file de véhicules et dans une circulation dense'),
  (106, 'C3.8', 228, 'Conduire quand l''adhérence et la visibilité sont réduites'),
  (107, 'C4',   230, 'Pratiquer une conduite autonome, sûre et économique'),
  (108, 'C4.1', 231, 'Suivre un itinéraire de manière autonome'),
  (109, 'C4.2', 232, 'Préparer et effectuer un voyage longue distance en autonomie'),
  (110, 'C4.3', 233, 'Connaître les principaux facteurs de risque au volant et les recommandations à appliquer'),
  (111, 'C4.4', 234, 'Connaître les comportements à adopter en cas d''accident : protéger, alerter, secourir'),
  (112, 'C4.5', 235, 'Faire l''expérience des aides à la conduite du véhicule (régulateur, limiteur de vitesse, ABS, aides à la navigation…)'),
  (113, 'C4.6', 236, 'Avoir des notions sur l''entretien, le dépannage et les situations d''urgence'),
  (114, 'C4.7', 237, 'Pratiquer l''écoconduite')
) as v(id, code, ordre, titre)
where t.id = v.id;

-- Ligne 98 (« Franchir les différents types d'intersection et y changer de direction ») :
-- absente du livret, retirée ; sa progression part avec elle (cascade).
delete from public.themes where id = 98;

-- Les deux sous-compétences ajoutées au livret en 2016.
insert into public.themes (titre, categorie, type, ordre, code) values
  ('Connaître les règles relatives à la circulation inter-files des motocyclistes. Savoir en tenir compte',
   'Compétence conduite (REMC)', 'notion', 227, 'C3.7'),
  ('Conduire à l''abord et dans la traversée d''ouvrages routiers tels que les tunnels, les ponts…',
   'Compétence conduite (REMC)', 'notion', 229, 'C3.9');

do $$
begin
  assert (select count(*) from public.themes where categorie = 'Compétence conduite (REMC)') = 36, 'il faut 36 lignes REMC';
  assert (select count(*) from public.themes where categorie = 'Compétence conduite (REMC)' and code is null) = 0, 'ligne REMC sans code';
  assert (select count(*) from public.themes where categorie = 'Compétence conduite (REMC)' and position(chr(8212) in titre) > 0) = 0,
    'tiret cadratin restant dans un intitulé';
end $$;
