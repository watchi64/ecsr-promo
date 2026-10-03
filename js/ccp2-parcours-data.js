// Parcours guidé du CCP2 (chantier D) : le texte affiché par l'onglet CCP2
// (js/views/ccp2.js), et rien d'autre.
//
// Sources : REAC TP-01303 du 05/02/2021 (fiches compétences 8 à 11) et
// référentiel d'évaluation du 31/01/2021 (CCP « Sensibiliser l'ensemble des
// usagers de la route » et obligations réglementaires), servis par l'app dans
// assets/referentiels/. Les attendus des étapes 2 à 5 reprennent mot pour mot
// les critères de performance du REAC : ne pas les reformuler.
//
// Public : les stagiaires. Tutoiement, phrases courtes, sans jargon ; un terme
// métier est défini à sa première apparition. Aucun tiret cadratin.
// tests/ccp-rules.test.mjs contrôle la forme de chaque étape.
//
// Champs d'une étape : num, cle (stable), titre, enBref, titreAttendus
// (facultatif, « Ce que le jury regarde » par défaut), attendus, conseils,
// aGarder (facultatif), liens (facultatif : { label, href } pour un fichier ou
// un site, { label, route, sousOnglet, module } pour une page de l'app), source.
// Aucun import : le fichier est lu tel quel par les tests node.

const RE = "assets/referentiels/RE_TP_ECSR_2021.pdf";
const REAC = "assets/referentiels/REAC_TP_ECSR_2021.pdf";
const BOITE_A_OUTILS = "assets/guides/boite-a-outils-ccp2.html";

export const EPREUVE = {
  titre: "L'épreuve en bref",
  points: [
    "1 h 30 devant le jury, en trois temps qui s'enchaînent : la présentation de ton action "
      + "(30 minutes, sans interruption), un entretien technique sur cette présentation "
      + "(30 minutes), puis des questions sur ton dossier écrit (30 minutes).",
    "Deux productions à préparer avant la session : ton dossier écrit, de 40 000 à 45 000 "
      + "caractères, et ton support de présentation projetable.",
    "Pas de questionnaire professionnel au CCP2.",
    "Au moins 140 heures de période en entreprise, attestées par ton centre de formation.",
  ],
  liens: [
    { label: "Référentiel d'évaluation (PDF)", href: RE },
    { label: "Référentiel emploi, activités, compétences (PDF)", href: REAC },
    { label: "Boîte à outils numérique CCP2", href: BOITE_A_OUTILS },
  ],
};

export const ETAPES = [
  {
    num: 1,
    cle: "commanditaire",
    titre: "Trouver un commanditaire",
    enBref: "Une structure qui te confie une action de sensibilisation à la sécurité routière : "
          + "école, collège, association, entreprise, résidence pour seniors.",
    titreAttendus: "Ce qu'exige le référentiel",
    attendus: [
      "Ton épreuve repose sur une action réelle, que tu as menée en autonomie pendant une "
        + "période en entreprise.",
      "Le CCP2 demande au moins 140 heures de période en entreprise : le jury vérifie que ton "
        + "dossier contient l'attestation.",
      "Ton dossier doit permettre d'identifier le commanditaire, son activité et la date de sa "
        + "demande.",
    ],
    conseils: [
      "Le commanditaire est la structure qui te demande l'action, pas forcément le public qui "
        + "y assiste : par exemple la directrice d'une école, pour une classe de CM2.",
      "Choisis un public que tu as envie de sensibiliser et une structure que tu peux joindre "
        + "vite : les périodes de stage sont courtes.",
      "Présente-toi au nom de ton établissement de stage et explique ce qu'il propose : c'est "
        + "lui qui répond à la demande, avec toi.",
      "Parles-en à ton tuteur avant de t'engager : l'action se fait dans le cadre de "
        + "l'établissement.",
      "Dès le premier contact, note le nom de la structure, son activité, ton interlocuteur "
        + "et la date.",
    ],
    aGarder: [
      "Les coordonnées et l'activité du commanditaire, et la date du premier contact.",
      "Les échanges écrits (courriels, messages) : ils serviront à transcrire sa demande.",
    ],
    liens: [
      { label: "Boîte à outils numérique CCP2 (Canva pour une affiche, Drive pour ranger tes documents)",
        href: BOITE_A_OUTILS },
    ],
    source: "Référentiel d'évaluation : CCP2 et obligations réglementaires",
  },
  {
    num: 2,
    cle: "demande",
    titre: "Analyser la demande",
    enBref: "Comprendre ce que veut vraiment le commanditaire, puis vous mettre d'accord sur un "
          + "cahier des charges.",
    attendus: [
      "Les attentes spécifiques du commanditaire sont identifiées.",
      "Le conseil est pertinent au regard de la demande.",
      "La prestation envisagée correspond au besoin du commanditaire.",
      "Les impératifs économiques, logistiques et organisationnels de l'établissement sont pris "
        + "en compte.",
      "Les prestations et l'expertise de l'établissement sont valorisées auprès du client.",
    ],
    conseils: [
      "Mène un entretien, en face à face ou à distance : pose des questions ouvertes, écoute, "
        + "puis reformule pour vérifier que tu as bien compris.",
      "Fais préciser le public (âge, nombre, ce qu'il sait déjà), le lieu, la date, le temps "
        + "disponible et ce que le commanditaire espère voir changer.",
      "Estime la durée nécessaire selon l'objectif, et dis-le si le temps prévu ne suffit pas : "
        + "conseiller fait partie de ton rôle.",
      "Formalisez ensemble le cahier des charges, le document qui fixe ce que l'action doit "
        + "respecter : public, objectifs, durée, lieu, moyens, contraintes.",
      "Convenez des critères qui diront si l'action a atteint son objectif.",
      "Confirme par un courriel professionnel ce qui a été convenu, et rends compte à ton "
        + "tuteur.",
    ],
    aGarder: [
      "La demande telle que le commanditaire l'a formulée, avec ses mots : ton dossier commence "
        + "par sa transcription.",
      "Le cahier des charges validé et les critères d'évaluation convenus.",
    ],
    source: "REAC, compétence 8 : analyser une demande relative à une prestation de sensibilisation",
  },
  {
    num: 3,
    cle: "construire",
    titre: "Construire l'action",
    enBref: "Écrire le scénario de la séance et préparer tout ce qu'il faut pour l'animer.",
    attendus: [
      "Le scénario de l'action intègre les exigences du cahier des charges.",
      "Le rôle du co-animateur et les modalités de son intervention sont définis.",
      "Le contenu et les ressources sont adaptés à l'objectif et au public.",
      "Les activités d'apprentissage et les espaces de formation prévus sont en cohérence avec "
        + "l'objectif.",
      "Le scénario tient compte de la durée et des moyens matériels.",
    ],
    conseils: [
      "Écris ton scénario pédagogique, c'est-à-dire le déroulé de la séance phase par phase : "
        + "objectif, durée, activité, support et rôle de chacun.",
      "Appuie-toi sur le REMC (référentiel pour l'éducation à une mobilité citoyenne) pour "
        + "situer ton action dans le continuum éducatif, l'éducation routière qui va de l'école "
        + "à l'après-permis.",
      "Prends tes informations à des sources fiables : chiffres de l'accidentalité, "
        + "réglementation, publications de la Sécurité routière.",
      "Choisis des méthodes qui font participer et qui conviennent à l'âge et aux "
        + "connaissances du public.",
      "Prépare l'outil d'évaluation de l'action (questionnaire, quiz, tour de table), en lien "
        + "avec l'objectif.",
      "Si vous animez à deux, répartissez les rôles par écrit.",
      "Prépare le matériel et les documents en nombre suffisant, et prévois l'aménagement de la "
        + "salle.",
      "En cas de difficulté, préviens ton tuteur sans attendre.",
    ],
    aGarder: [
      "Le scénario daté, tes supports et l'outil d'évaluation : ils iront en annexe de ton "
        + "dossier.",
    ],
    liens: [
      { label: "Les cours des 57 thèmes, pour vérifier une règle ou un chiffre",
        route: "themes", sousOnglet: "themes", module: "cours" },
      { label: "Boîte à outils numérique CCP2 (Forms pour un questionnaire, Canva pour un support)",
        href: BOITE_A_OUTILS },
    ],
    source: "REAC, compétence 9 : construire et préparer une action de sensibilisation",
  },
  {
    num: 4,
    cle: "animer",
    titre: "Animer la séance",
    enBref: "Conduire la séance devant le public, en restant fidèle au cahier des charges.",
    attendus: [
      "Les clauses du cahier des charges sont respectées.",
      "Les techniques et supports pédagogiques sont adaptés.",
      "Le langage et la communication sont adaptés au public.",
      "Les contenus sont pertinents.",
      "La durée de la séance est respectée.",
      "La méthode favorise la participation du public.",
    ],
    conseils: [
      "Fais d'abord émerger les représentations du public, ce qu'il pense déjà du risque "
        + "routier, et pars de là.",
      "Amène les participants à analyser leurs propres pratiques d'usagers de la route, plutôt "
        + "que de leur réciter des règles.",
      "Adapte ton scénario si le public réagit autrement que prévu, sans perdre ton objectif.",
      "Garde un œil sur l'heure : la durée convenue fait partie du cahier des charges.",
      "En co-animation, respecte le rôle de chacun tel que vous l'avez prévu.",
      "Termine par l'outil d'évaluation prévu.",
    ],
    aGarder: [
      "Les résultats de l'évaluation et tes notes prises à chaud, juste après la séance.",
      "Des photos pour ton support, seulement avec l'accord des personnes, et celui des "
        + "parents pour des mineurs.",
    ],
    source: "REAC, compétence 10 : animer une séance de sensibilisation à la sécurité routière, "
          + "au respect des usagers et de l'environnement",
  },
  {
    num: 5,
    cle: "analyser",
    titre: "Analyser ta pratique",
    enBref: "Prendre du recul sur ta séance : ce qui a marché, ce qui n'a pas marché, et comment "
          + "progresser.",
    attendus: [
      "La situation de formation est décrite et analysée de façon pertinente.",
      "Les propositions d'ajustement des pratiques sont pertinentes.",
      "Les facteurs d'efficacité et d'inefficacité des pratiques sont identifiés.",
      "Les pratiques professionnelles sont décrites et analysées de façon pertinente.",
      "Les sources d'information relatives à la sécurité routière sont connues et exploitées à "
        + "bon escient.",
      "Le bilan des interventions est pertinent.",
      "Les axes d'amélioration sont réalistes.",
    ],
    conseils: [
      "Décris d'abord ce qui s'est passé, en séparant les faits de tes opinions et de tes "
        + "émotions.",
      "Pars des résultats de l'évaluation et des retours du commanditaire.",
      "Cherche pourquoi un moment a fonctionné ou non : la méthode, le support, le temps, le "
        + "public.",
      "Échange avec ton tuteur, tes formateurs ou d'autres stagiaires : le regard des pairs "
        + "nourrit l'analyse.",
      "Retiens deux ou trois axes d'amélioration réalistes, applicables dès ta prochaine séance.",
      "Organise ta veille : quelles sources tu suis (Sécurité routière, ONISR pour les chiffres, "
        + "Légifrance pour les textes) et à quel rythme.",
    ],
    aGarder: [
      "Ton bilan écrit, avec tes points forts, tes points faibles et tes axes d'amélioration : "
        + "c'est une partie exigée du dossier.",
      "La liste de tes sources de veille et la façon dont tu les suis.",
    ],
    source: "REAC, compétence 11 : analyser ses pratiques professionnelles afin de les faire évoluer",
  },
  {
    num: 6,
    cle: "dossier",
    titre: "Rédiger le dossier",
    enBref: "Le document écrit sur lequel le jury te questionne pendant 30 minutes.",
    titreAttendus: "Ce qu'exige le référentiel",
    attendus: [
      "Entre 40 000 et 45 000 caractères, espaces compris, sans compter les annexes.",
      "La transcription de la demande formulée, avec ce qui identifie le commanditaire, son "
        + "activité et la date de la demande.",
      "Les enjeux, le contexte et la finalité de l'action, ta méthode d'analyse de la demande, "
        + "la construction de ta réponse, les outils et techniques pédagogiques utilisés et ta "
        + "posture d'enseignant.",
      "La démonstration que ta réponse correspond à la demande du commanditaire et au public "
        + "visé.",
      "Ton analyse de pratique : les points forts et les points faibles de ta démarche, et tes "
        + "axes d'amélioration.",
      "La façon dont tu assures ta veille sur le secteur professionnel et la réglementation.",
    ],
    conseils: [
      "Écris au fil des étapes, à partir de tes notes, plutôt que tout à la fin.",
      "Suis l'ordre des contenus exigés : le jury retrouvera plus vite ce qu'il cherche.",
      "Surveille le compte : dans Google Docs, le menu Outils, Nombre de mots (Ctrl + Maj + C) "
        + "affiche les caractères, espaces compris.",
      "Mets le cahier des charges, le scénario, les supports et l'outil d'évaluation en annexe : "
        + "ils ne comptent pas dans les caractères.",
      "Fais relire par quelqu'un qui ne connaît pas ton action : s'il comprend, le jury "
        + "comprendra.",
      "Remets-le dans les délais fixés par ton centre : il est produit avant la session.",
    ],
    liens: [
      { label: "Boîte à outils numérique CCP2 (Google Docs et Drive)", href: BOITE_A_OUTILS },
    ],
    source: "Référentiel d'évaluation, CCP2 : analyse d'une demande d'action de sensibilisation "
          + "et réponse à cette demande",
  },
  {
    num: 7,
    cle: "oral",
    titre: "Préparer l'oral",
    enBref: "Un support projetable et 30 minutes pour présenter ton action, sans être "
          + "interrompu.",
    titreAttendus: "Ce qu'exige le référentiel",
    attendus: [
      "Un support numérique projetable, préparé avant la session.",
      "Six points à présenter : le commanditaire ; le contexte de l'action ; l'analyse de la "
        + "demande et la structuration de ta réponse ; le contenu de ta réponse ; l'analyse de "
        + "ta prestation ; la façon dont tu fais ta veille sur le secteur professionnel et la "
        + "réglementation.",
      "30 minutes de présentation : le jury n'intervient pas pendant ce temps.",
      "Une démarche de pédagogue : tu te places en posture d'enseignant face au jury.",
    ],
    conseils: [
      "Construis ton support dans l'ordre des six points.",
      "Une idée par diapositive et peu de texte : le support appuie ta parole, il ne la "
        + "remplace pas.",
      "Répète à voix haute, chronomètre en main, jusqu'à tenir les 30 minutes sans courir.",
      "Prépare les questions qu'on pourrait te poser sur tes choix pédagogiques : l'entretien "
        + "technique suit immédiatement.",
      "Garde une copie de ton support sur une clé USB et une autre en ligne.",
    ],
    liens: [
      { label: "Boîte à outils numérique CCP2 (Canva pour le support)", href: BOITE_A_OUTILS },
    ],
    source: "Référentiel d'évaluation, CCP2 : présentation d'un projet réalisé en amont de la "
          + "session",
  },
  {
    num: 8,
    cle: "epreuve",
    titre: "Le jour de l'épreuve",
    enBref: "1 h 30 face au jury, en trois temps qui s'enchaînent.",
    titreAttendus: "Comment se déroule l'épreuve",
    attendus: [
      "Présentation de ton action : 30 minutes, à partir de ton support, sans interruption du "
        + "jury.",
      "Entretien technique : 30 minutes, juste après, sur ta présentation.",
      "Questions sur ton dossier écrit : 30 minutes, juste après l'entretien.",
      "Le jury vérifie que ton dossier contient l'attestation de période en entreprise. Il "
        + "dispose aussi de ton dossier professionnel et des résultats de tes évaluations en "
        + "cours de formation.",
      "Pour obtenir le titre par les CCP, un entretien avec le jury, au vu de ton livret de "
        + "certification, a lieu en fin de session du dernier CCP.",
    ],
    conseils: [
      "À l'ouverture de la session, présente ton permis B avec l'attestation sur l'honneur "
        + "signée, et l'attestation de ton centre de formation.",
      "Vérifie avant le jour J que ton dossier professionnel est à jour pour le CCP2.",
      "Apporte ton support sur une clé USB, avec une copie en ligne.",
    ],
    liens: [
      { label: "Ton dossier professionnel (Mon espace, sous-onglet Dossier pro)",
        route: "mon-suivi", sousOnglet: "dp", module: "dp" },
      { label: "Référentiel d'évaluation (PDF)", href: RE },
    ],
    source: "Référentiel d'évaluation : modalités du CCP2, obligations réglementaires et accès "
          + "au titre par capitalisation des CCP",
  },
];
