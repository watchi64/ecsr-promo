// Guide de l'app injecte dans le prompt systeme. Une entree par page/module.
// A tenir a jour quand l'app change (fichier texte, pas de logique).

export const AIDE_APP = `
PAGES DE L'APP (navigation par onglets en haut ; le logo ramène à l'espace perso « Mon suivi »)

- mon-suivi (Mon espace personnel) : page d'ouverture de l'app. Planning personnel à venir, résultats, graphe « Mon évolution », passages effectués (compteurs et historique), accès au livret EPCF et au Dossier Professionnel. La date de naissance du profil se règle ici (utile pour le livret officiel).
- dashboard (Priorités) : qui doit passer en priorité dans la promo, d'après les compteurs de passages. Vue promo, pas personnelle.
- planning : semaine de la promo, demi-journées matin et après-midi. En lecture pour tous ; le mode Modifier (admin/formateur) se déverrouille en haut à droite, Échap ou le bouton pour sortir. Bouton « Aujourd'hui » dans la barre du haut pour sauter à la journée en cours. Les semaines passées se verrouillent.
- calendrier : vue mensuelle des événements de la formation (jours off, événements d'agenda).
- ccp1 (CCP1, « Former des apprenants conducteurs ») : onglet à sous-onglets. Thèmes : les 57 thèmes officiels, chacun avec son cours complet (bouton de lecture, temps de lecture estimé) et ses QCM : entraînement (questions ratées reproposées en premier) et examen blanc (tirage aléatoire, seuil de réussite) ; les formateurs y gèrent aussi l'éditeur de cours, l'éditeur de QCM et les signalements de questions. Notes : évaluations sur 20 par thème, moyennes et synthèse de la classe. EPCF : examens blancs du CCP1 (consultation des grilles, vue classe). Livret EPCF et Dossier pro : documents officiels remplissables. Les anciennes adresses « themes » et « notes » mènent ici.
- ccp2 (CCP2, « Sensibiliser les usagers de la route ») : parcours guidé en 8 étapes (trouver un commanditaire, analyser la demande, construire l'action, animer la séance, analyser sa pratique, rédiger le dossier de 40 000 à 45 000 caractères, préparer l'oral, le jour de l'épreuve). Chaque étape donne ce que le jury regarde, des conseils, ce qu'il faut garder pour le dossier et des liens utiles ; les dates de stage et d'examen CCP2 viennent du calendrier de la promo.
- ressources : cartes de liens officiels (REMC, référentiels, ONISR, PDF hébergés par l'app).
- config (Paramètres) : thème sombre/clair, couleur d'accent ; les admins y gèrent les comptes (invitations) et réglages.
- nouveautes : journal des nouveautés de l'app, accessible depuis l'accueil (pastille sur l'onglet Accueil quand il y a du nouveau).

BOUTONS GLOBAUX (barre du haut) : logo = espace perso ; cible = Priorités ; calendrier pointé = aujourd'hui au planning ; flèche circulaire = actualiser les données.

QCM : en entraînement, les questions échouées reviennent en premier aux passages suivants. En examen, tirage de N questions et note sur 20 au seuil fixé par les formateurs. Chaque question a une explication sourcée. Un bouton de signalement permet de remonter une question douteuse aux formateurs.

LIVRET EPCF ET DOSSIER PROFESSIONNEL : documents officiels remplissables dans l'app puis imprimables au format officiel (impression via le bouton dédié, pas Ctrl+P depuis n'importe où).

ASSISTANT (toi) : bouton rond en bas à droite, disponible partout. Chacun dispose d'un quota de 30 questions par jour. Tu ne vois pas les données personnelles des stagiaires.
`;
