// Guide de l'app injecte dans le prompt systeme. Une entree par page/module.
// A tenir a jour quand l'app change (fichier texte, pas de logique).

// Ce qui ne depend pas de la barre affichee.
const AIDE_COMMUNE = `QCM : en entraînement, les questions échouées reviennent en premier aux passages suivants. En examen, tirage de N questions et note sur 20 au seuil fixé par les formateurs. Chaque question a une explication sourcée. Un bouton de signalement permet de remonter une question douteuse aux formateurs.

LIVRET EPCF ET DOSSIER PROFESSIONNEL : documents officiels remplissables dans l'app puis imprimables au format officiel (impression via le bouton dédié, pas Ctrl+P depuis n'importe où).`;

// Ancienne navigation.
export const AIDE_APP = `
PAGES DE L'APP (navigation par onglets en haut ; le logo ramène à l'espace perso « Mon espace », ou à la page Stagiaires pour un formateur sans profil stagiaire)

- mon-suivi (Mon espace personnel) : page d'ouverture de l'app, la fiche de la personne connectée. Parties Passages (planning personnel à venir, passages effectués), EPCF, Évolution (graphe des notes), Livret (son livret officiel, en lecture ; la date de naissance s'y règle, reportée sur le livret) et Dossier pro. Sur ordinateur, des onglets ; sur téléphone, un sommaire avec l'état de chaque partie, puis la partie en plein écran (retour en haut à gauche ou geste retour).
- dashboard (Priorités) : qui doit passer en priorité dans la promo, d'après les compteurs de passages. Vue promo, pas personnelle. Plus d'onglet : bouton « Priorités » en haut du Planning.
- stagiaires (page Stagiaires, formateurs et admins) : la liste de la promo avec l'état de chacun (épreuves EPCF évaluées sur 2, livret, dossier pro), et la fiche d'un stagiaire avec les outils du formateur : saisie des grilles EPCF (Évaluer, Modifier, Nouvelle évaluation), livret EPCF en saisie, dossier pro. On l'ouvre par la tuile Stagiaires de l'Accueil ; un formateur sans profil stagiaire y arrive aussi par le bouton de son compte.
- planning : semaine de la promo, demi-journées matin et après-midi. En lecture pour tous ; le mode Modifier (admin/formateur) se déverrouille par le bouton Modifier, au-dessus de la semaine, Échap ou le bouton pour sortir. Bouton « Aujourd'hui » dans la barre du haut pour sauter à la journée en cours. Les semaines passées se verrouillent.
- calendrier : liste des dates importantes de la formation (examens, stages, formations, fériés), à venir ou toutes.
- themes (onglet Cours) : sous-onglets Thèmes (les 57 thèmes officiels et les QCM transversaux) et Compétences (compétences de l'enseignant, de conduite, notions pédagogiques). Chaque thème porte son cours complet (bouton de lecture, temps de lecture estimé) et ses QCM : entraînement (questions ratées reproposées en premier) et examen blanc (tirage aléatoire, seuil de réussite). Les formateurs y gèrent aussi l'éditeur de cours, l'éditeur de QCM et, dans un troisième sous-onglet, les signalements de questions. Dans l'éditeur de QCM d'un thème, « Proposer avec l'IA » rédige des brouillons de questions à partir du seul cours vérifié du thème : le formateur relit, corrige, accepte ou rejette chaque brouillon ; rien n'est visible des stagiaires avant acceptation, et une question acceptée porte la mention « IA · validée par » suivie du nom du formateur. Le sous-onglet Compétences accueille aussi, au fil de leur publication par les formateurs, les cours des compétences de conduite C1 à C4 du permis B, avec schémas animés, quiz et cartes d'autoévaluation.
- notes : la classe, pour tout le monde. Matrice des évaluations sur 20 par thème, moyennes, synthèse, et sous-onglet EPCF (moyennes de la classe). La saisie EPCF, le livret et le dossier de chacun sont dans sa fiche (page Stagiaires pour les formateurs).
- ccp2 (onglet CCP2, quand un formateur l'ouvre) : parcours guidé en 8 étapes (trouver un commanditaire, analyser la demande, construire l'action, animer la séance, analyser sa pratique, rédiger le dossier de 40 000 à 45 000 caractères, préparer l'oral, le jour de l'épreuve). Chaque étape donne ce que le jury regarde, des conseils, ce qu'il faut garder pour le dossier et des liens utiles ; les dates de stage et d'examen CCP2 viennent du calendrier de la promo.
- centre (Tableau de bord, formateurs) : tuile « Tableau de bord » de l'Accueil. Les chiffres d'une promo (effectif, abandons, absences aux passages, passages réalisés, QCM, examens, notes, EPCF), les thèmes à retravailler et les stagiaires à suivre, avec pour chaque chiffre sa méthode de calcul ; comparaison des promos, export PDF et matrice des notes en CSV.
- ressources (Ressources & contacts) : les contacts de l'administration du centre (pour prévenir d'une absence) et des cartes de liens officiels (REMC, référentiels, ONISR, PDF hébergés par l'app).
- config (Paramètres) : les préférences de la personne (anonymat dans les notes de la classe) ; les admins y gèrent les comptes (invitations) et réglages.
- nouveautes : journal des nouveautés de l'app, accessible depuis l'accueil (pastille sur l'onglet Accueil quand il y a du nouveau).

BOUTONS GLOBAUX (barre du haut) : logo = espace perso ; calendrier pointé = aujourd'hui au planning ; flèche circulaire = actualiser les données.

${AIDE_COMMUNE}

ASSISTANT (toi) : bouton rond en bas à droite, disponible partout. Chacun dispose d'un quota de 30 questions par jour. Tu ne vois pas les données personnelles des stagiaires.
`;

// Nouvelle navigation : memes noms que la barre (js/nav-rules.js) et que la Nouveaute de lancement.
export const AIDE_APP_V2 = `
L'APP A DEUX BARRES, celle des stagiaires et celle des formateurs. Quand la réponse dépend du rôle et que tu ne connais pas celui de la personne, donne les deux réponses en nommant le rôle. Emploie toujours les noms affichés, jamais les noms internes des pages (le mot avant la parenthèse dans la liste PAGES).

BARRE DES STAGIAIRES : Accueil, Planning, Cours et QCM, Mon suivi, CCP2. Sur ordinateur, des onglets en haut ; sur téléphone, une barre en bas de l'écran. Le logo, en haut à gauche, ramène à l'Accueil. En haut à droite : le bouton Assistant et les initiales de la personne, qui ouvrent son compte.

BARRE DES FORMATEURS : sur ordinateur, une barre à gauche, avec la promo en tête ; un bouton en haut de la barre la replie en colonne d'icônes et l'app s'en souvient (sur tablette, elle reste en colonne d'icônes). Entrées : Aujourd'hui, Planning, Émargement (quand il est activé pour la promo), Stagiaires, Notes et examens, Cours et QCM, CCP2, puis, sous le titre Promo, Indicateurs et Réglages. En bas de cette barre : Assistant, Signaler un problème et le compte. Sur téléphone : Aujourd'hui, Planning, Stagiaires et Notes en bas de l'écran ; « Plus » ouvre les autres pages (Émargement, Cours et QCM, CCP2, Indicateurs, Réglages), l'Assistant, Signaler un problème et le compte ; en haut de l'écran, la promo, le bouton Assistant et le compte.

CE QUI S'OUVRE AU FIL DE LA FORMATION : les formateurs choisissent ce que voit la promo (Réglages, Ce que voient les stagiaires). Si un stagiaire ne trouve pas une page ou une partie citée ici, elle n'est peut-être pas encore ouverte pour sa promo.

COMPTE (initiales en haut à droite ; formateurs sur ordinateur : en bas de la barre de gauche) : Nouveautés (un point sur les initiales signale celles qui ne sont pas lues, leur nombre est dans le menu), Contacts du centre (pour prévenir d'une absence), Mes préférences, Actualiser (relit les données de l'app), Signaler un problème (stagiaires), Informations légales et Se déconnecter. Une personne qui a une fiche de stagiaire et la barre des formateurs y retrouve aussi Mon suivi.

PAGES

- home (Accueil pour un stagiaire, Aujourd'hui pour les formateurs) : la date du jour et la promo.
  Accueil du stagiaire : la journée, matin et après-midi, avec ce qui le concerne (au tableau, en voiture) ; le bouton « Signer pour ce matin » ou « Signer pour cet après-midi » quand une feuille d'émargement est ouverte ; « À faire » (examen ouvert, QCM d'un thème vu cette semaine, dossier professionnel, livret) ; « Prochain rendez-vous » ; une Nouveauté ; en pied de page, Contacts du centre, Mes préférences et Signaler un problème.
  Aujourd'hui des formateurs : l'émargement du jour, qui est au tableau, qui est en voiture, « À traiter » (les signalements de QCM et les questions proposées par l'IA) et « À suivre de près » (les stagiaires qui cumulent au moins deux signaux : absences, notes basses, inactivité sur les QCM, retard de passages). La liste complète est dans Indicateurs.
- planning (Planning) : sous-onglets Semaine, Dates clés et Priorités.
  Semaine : semaine de la promo, demi-journées matin et après-midi, qui s'ouvre sur la semaine en cours. Elle s'affiche en grille (les jours en colonnes, le matin et l'après-midi en lignes ; sur téléphone, une bande de jours puis le jour choisi) ou en liste, avec la bascule « Grille » (« Jour » sur téléphone) ou « Liste ». En lecture pour tous ; le mode Modifier (formateurs) se déverrouille par le bouton Modifier, au-dessus de la semaine, Échap ou le bouton pour sortir. Le bouton « Aujourd'hui », en tête de la page, amène à la journée en cours. Les semaines passées se verrouillent.
  Dates clés : liste des dates importantes de la formation (examens, stages, formations, fériés), à venir ou toutes.
  Priorités : qui doit passer en priorité dans la promo, d'après les compteurs de passages. Vue promo, pas personnelle.
- emargement (Émargement, formateurs, quand il est activé pour la promo) : la semaine en dix demi-journées ; ouvrir une feuille, faire signer, noter absences et observations, signer, clore, rouvrir, imprimer. Le stagiaire n'a pas de page : son Accueil lui propose « Signer pour ce matin » ou « Signer pour cet après-midi » quand la feuille est ouverte. Sur les autres pages, un bandeau en haut de l'app propose aussi « Signer » tant que la feuille du jour est ouverte.
- stagiaires (Stagiaires, formateurs) : sous-onglets Stagiaires et Élèves bénévoles (ce dernier pour les formateurs administrateurs). Stagiaires : la liste de la promo avec l'état de chacun (épreuves EPCF évaluées sur 2, livret, dossier pro), et la fiche d'un stagiaire avec les outils du formateur : saisie des grilles EPCF (Évaluer, Modifier, Nouvelle évaluation), livret EPCF en saisie, dossier pro.
- notes (Notes et examens, formateurs ; Notes sur la barre du téléphone) : sous-onglets Matrice (évaluations sur 20 par thème, moyennes, synthèse) et EPCF (moyennes de la classe). La saisie EPCF, le livret et le dossier de chacun sont dans sa fiche, page Stagiaires. Les stagiaires voient les notes de la classe dans Mon suivi, Résultats, La classe.
- themes (Cours et QCM) : sous-onglets Thèmes (les 57 thèmes officiels et les QCM transversaux), Compétences (compétences de l'enseignant, de conduite, notions pédagogiques) et Documents ; pour un stagiaire, un sous-onglet QCM de plus (ses QCM, sa dernière note, le bouton « S'entraîner ») ; pour les formateurs, Signalements (les questions de QCM signalées) et Propositions IA (les questions proposées par l'IA à relire, ouvertes dans l'éditeur du QCM). Chaque thème porte son cours complet (bouton de lecture, temps de lecture estimé) et ses QCM : entraînement (questions ratées reproposées en premier) et examen blanc (tirage aléatoire, seuil de réussite). Les formateurs y gèrent aussi l'éditeur de cours et l'éditeur de QCM. Dans l'éditeur de QCM d'un thème, « Proposer avec l'IA » rédige des brouillons de questions à partir du seul cours vérifié du thème : le formateur relit, corrige, accepte ou rejette chaque brouillon ; rien n'est visible des stagiaires avant acceptation, et une question acceptée porte la mention « IA · validée par » suivie du nom du formateur. Le sous-onglet Compétences accueille aussi, au fil de leur publication par les formateurs, les cours des compétences de conduite C1 à C4 du permis B, avec schémas animés, quiz et cartes d'autoévaluation.
  Documents : les contacts du centre (pour prévenir d'une absence) et des cartes de liens officiels (REMC, référentiels, ONISR, PDF hébergés par l'app).
- mon-suivi (Mon suivi) : la fiche de la personne connectée. Parties Résultats (deux volets : « Moi », ses notes et leur évolution en graphe, et « La classe », les notes de la classe, anonymes : matrice, moyennes, moyennes EPCF), Passages (planning personnel à venir, passages effectués), EPCF, Livret (son livret officiel, en lecture ; la date de naissance s'y règle, reportée sur le livret) et Dossier pro. Sur ordinateur, des onglets ; sur téléphone, un sommaire qui dit l'état de chaque partie (« EPCF : 0 sur 2 », « Dossier pro : 2 exemples sur 6 »), puis la partie en plein écran (retour en haut à gauche ou geste retour).
- ccp2 (CCP2, quand un formateur l'ouvre) : parcours guidé en 8 étapes (trouver un commanditaire, analyser la demande, construire l'action, animer la séance, analyser sa pratique, rédiger le dossier de 40 000 à 45 000 caractères, préparer l'oral, le jour de l'épreuve). L'onglet s'ouvre sur les dates et les 8 étapes ; « L'épreuve en bref » est replié en bas. Chaque étape donne ce que le jury regarde, des conseils, ce qu'il faut garder pour le dossier et des liens utiles ; les dates de stage et d'examen CCP2 viennent des dates clés de la promo.
- centre (Indicateurs, formateurs) : les chiffres d'une promo (effectif, abandons, absences aux passages, passages réalisés, QCM, examens, notes, EPCF), les thèmes à retravailler et les stagiaires à suivre, avec pour chaque chiffre sa méthode de calcul ; comparaison des promos, export PDF et matrice des notes en CSV.
- config (Réglages, formateurs) : les réglages de la promo : Ce que voient les stagiaires, Promo, Accès et invitations, Données personnelles.
- preferences (Mes préférences, menu du compte) : les réglages de la personne : son anonymat dans les notes de la classe, si elle a une fiche de stagiaire, et les informations sur l'app.
- nouveautes (Nouveautés) : journal des nouveautés de l'app, depuis l'Accueil et le menu du compte.

${AIDE_COMMUNE}

SIGNALER UN PROBLÈME : pour un bug ou quelque chose de pas clair dans l'app. Stagiaires : menu du compte ; formateurs : en bas de la barre de gauche, dans « Plus » sur téléphone ; pour tous, un lien dans le panneau de l'assistant. On écrit son message, on peut ajouter une capture d'écran, et la réponse s'affiche au même endroit. À ne pas confondre avec le signalement d'une question de QCM, qui part aux formateurs.

ASSISTANT (toi) : bouton Assistant en haut de l'écran ; formateurs sur ordinateur : en bas de la barre de gauche ; il est aussi dans « Plus » sur le téléphone des formateurs. Chacun dispose d'un quota de 30 questions par jour. Tu ne vois pas les données personnelles des stagiaires.

ANCIENS NOMS (où sont passées les pages de l'ancienne barre) :
- Accueil de l'équipe : Aujourd'hui (le stagiaire garde « Accueil »).
- Calendrier : Planning, Dates clés.
- Priorités : Planning, Priorités.
- Cours : Cours et QCM.
- Ressources : Cours et QCM, Documents ; les contacts du centre aussi par le menu du compte.
- Notes : pour un stagiaire, Mon suivi, Résultats, La classe ; pour un formateur, Notes et examens.
- Paramètres : Mes préférences dans le menu du compte ; pour les formateurs, les réglages de la promo sont dans Réglages.
- Mon espace (ou Mon espace personnel) : Mon suivi.
- Évolution et La classe de Mon suivi : réunies dans Résultats (« Moi » et « La classe »).
- Tableau de bord : Indicateurs.
- Élèves bénévoles (bouton du Planning, qui y mène encore, sauf sur une semaine verrouillée) : Stagiaires, Élèves bénévoles.
- Bouton « Aujourd'hui » de la barre : Planning, Semaine, en tête de la page.
- Flèche pour actualiser : Actualiser, dans le menu du compte.
- Bulle ronde de l'assistant : bouton Assistant.
`;

// Le guide de la barre que voit la personne. Tout ce qui n'est pas "nouvelle" (champ absent d'une
// app en cache, valeur inattendue) garde l'ancienne barre.
export function consignesApp(navigation) {
  return navigation === "nouvelle" ? AIDE_APP_V2 : AIDE_APP;
}
