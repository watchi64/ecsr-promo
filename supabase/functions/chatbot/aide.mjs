// Guide de l'app injecte dans le prompt systeme. Une entree par page/module.
// A tenir a jour quand l'app change (fichier texte, pas de logique).

export const AIDE_APP = `
PAGES DE L'APP (navigation par onglets en haut ; le logo ramène à l'espace perso « Mon espace », ou à la page Stagiaires pour un formateur sans profil stagiaire)

- mon-suivi (Mon espace personnel) : page d'ouverture de l'app, la fiche de la personne connectée. Parties Passages (planning personnel à venir, passages effectués), EPCF, Évolution (graphe des notes), Livret (son livret officiel, en lecture ; la date de naissance s'y règle, reportée sur le livret) et Dossier pro. Sur ordinateur, des onglets ; sur téléphone, un sommaire avec l'état de chaque partie, puis la partie en plein écran (retour en haut à gauche ou geste retour).
- dashboard (Priorités) : qui doit passer en priorité dans la promo, d'après les compteurs de passages. Vue promo, pas personnelle. Plus d'onglet : bouton « Priorités » en haut du Planning.
- stagiaires (page Stagiaires, formateurs et admins) : la liste de la promo avec l'état de chacun (épreuves EPCF évaluées sur 2, livret, dossier pro), et la fiche d'un stagiaire avec les outils du formateur : saisie des grilles EPCF (Évaluer, Modifier, Nouvelle évaluation), livret EPCF en saisie, dossier pro. On l'ouvre par la tuile Stagiaires de l'Accueil ; un formateur sans profil stagiaire y arrive aussi par le bouton de son compte.
- planning : semaine de la promo, demi-journées matin et après-midi. En lecture pour tous ; le mode Modifier (admin/formateur) se déverrouille en haut à droite, Échap ou le bouton pour sortir. Bouton « Aujourd'hui » dans la barre du haut pour sauter à la journée en cours. Les semaines passées se verrouillent.
- calendrier : vue mensuelle des événements de la formation (jours off, événements d'agenda).
- themes (onglet Cours) : sous-onglets Thèmes (les 57 thèmes officiels et les QCM transversaux) et Compétences (compétences de l'enseignant, de conduite, notions pédagogiques). Chaque thème porte son cours complet (bouton de lecture, temps de lecture estimé) et ses QCM : entraînement (questions ratées reproposées en premier) et examen blanc (tirage aléatoire, seuil de réussite). Les formateurs y gèrent aussi l'éditeur de cours, l'éditeur de QCM et, dans un troisième sous-onglet, les signalements de questions. Le sous-onglet Compétences porte aussi les cours des compétences de conduite C1 à C4 du permis B, avec schémas animés, quiz et cartes d'autoévaluation.
- notes : la classe, pour tout le monde. Matrice des évaluations sur 20 par thème, moyennes, synthèse, et sous-onglet EPCF (moyennes de la classe). La saisie EPCF, le livret et le dossier de chacun sont dans sa fiche (page Stagiaires pour les formateurs).
- ccp2 (onglet CCP2, quand un formateur l'ouvre) : parcours guidé en 8 étapes (trouver un commanditaire, analyser la demande, construire l'action, animer la séance, analyser sa pratique, rédiger le dossier de 40 000 à 45 000 caractères, préparer l'oral, le jour de l'épreuve). Chaque étape donne ce que le jury regarde, des conseils, ce qu'il faut garder pour le dossier et des liens utiles ; les dates de stage et d'examen CCP2 viennent du calendrier de la promo.
- ressources : cartes de liens officiels (REMC, référentiels, ONISR, PDF hébergés par l'app).
- config (Paramètres) : thème sombre/clair, couleur d'accent ; les admins y gèrent les comptes (invitations) et réglages.
- nouveautes : journal des nouveautés de l'app, accessible depuis l'accueil (pastille sur l'onglet Accueil quand il y a du nouveau).

BOUTONS GLOBAUX (barre du haut) : logo = espace perso ; calendrier pointé = aujourd'hui au planning ; flèche circulaire = actualiser les données.

QCM : en entraînement, les questions échouées reviennent en premier aux passages suivants. En examen, tirage de N questions et note sur 20 au seuil fixé par les formateurs. Chaque question a une explication sourcée. Un bouton de signalement permet de remonter une question douteuse aux formateurs.

LIVRET EPCF ET DOSSIER PROFESSIONNEL : documents officiels remplissables dans l'app puis imprimables au format officiel (impression via le bouton dédié, pas Ctrl+P depuis n'importe où).

ASSISTANT (toi) : bouton rond en bas à droite, disponible partout. Chacun dispose d'un quota de 30 questions par jour. Tu ne vois pas les données personnelles des stagiaires.
`;
