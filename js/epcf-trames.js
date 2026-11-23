// Trames EPCF (grilles d'évaluation officielles d'Hocine, CCP1, 09/07/2026 ; CCP2 du 23/11/2026, critères de
// performance des compétences 8 à 11 du REAC TP-01303, assets/referentiels/REAC_TP_ECSR_2021.pdf, pages 33 à 39).
//
// VERSIONNAGE, règle stricte : une version publiée ne se modifie JAMAIS en place
// (des évals en base portent trame_version et doivent réafficher leur définition).
// Pour faire évoluer une grille : (1) copier l'objet actuel sous un export d'archive
// (ex. EPCF_TRAMES_V1), (2) créer la nouvelle définition avec version: 2,
// (3) faire résoudre le rendu par (trame, trame_version). Tant qu'il n'existe
// qu'une version, EPCF_TRAMES[trame] suffit.
//
// UNICITÉ DES CODES : les codes critères (EVAL1, BILEV2…) ne sont uniques que
// PAR trame, jamais globalement (EVAL4 salle ≠ EVAL4 véhicule). Tout helper de
// lookup doit prendre (trame, code), jamais un code seul.

export const NOTE_VALUES = { A: 2, R: 1, NA: 0 };
export const NOTE_LABELS = { A: "Acquis", R: "À renforcer", NA: "Non acquis" };

// Couleur par phase/bloc de compétence (clé = code de section). Sert à distinguer
// visuellement les blocs sur le radar et le détail. Teintes CHOISIES HORS
// vert/ambre/rouge pour ne pas entrer en conflit avec les notes A/R/NA.
export const EPCF_PHASE_COLORS = {
  PREP:  "#5E81AC",  // bleu       (salle, préparation)
  ANIM:  "#A3799F",  // mauve      (salle, animation)
  COND:  "#4F8FA6",  // bleu-canard(véhicule, animation conduite)
  EVAL:  "#8C6BB1",  // violet     (partagé salle/véhicule, évaluations)
  BILEV: "#6C88C4",  // bleu clair (partagé, bilan & objectif)
  BILAN: "#9C7B5A",  // taupe      (partagé, bilan final)
  PERC:  "#3F9C8E",  // teal       (véhicule, perception C7)
  DEM:   "#B07AA1",  // rose mauve (CCP2, analyse de la demande C8)
  CONS:  "#5B7FA3",  // bleu acier (CCP2, construction de l'action C9)
  SENS:  "#4E9A9A",  // canard     (CCP2, animation de la sensibilisation C10)
  PRAT:  "#8E7CC3",  // lavande    (CCP2, analyse de pratique C11)
};

// Les mêmes teintes assombries pour un texte (titre d'une rubrique, libellé du radar, rubrique du tableau de la classe) : 4,6:1 au
// moins sur les fonds clairs des deux habillages (lot 3, tâche 10 ; les teintes vives n'en tenaient que 2,8 à 3,6). La teinte
// vive reste celle des traits et des bords.
export const EPCF_PHASE_TEXTE = {
  PREP:  "#4B6A91",
  ANIM:  "#845B80",
  COND:  "#3D6E80",
  EVAL:  "#7C57A6",
  BILEV: "#4667AD",
  BILAN: "#7D6348",
  PERC:  "#2E7268",
  DEM:   "#8A5580",
  CONS:  "#46658A",
  SENS:  "#356F6F",
  PRAT:  "#6A56A8",
};

// Les épreuves, dans l'ordre de l'écran : CCP1 en salle et en véhicule, puis CCP2.
export const EPCF_TRAME_KEYS = ["salle", "vehicule", "ccp2"];

export const EPCF_TRAMES = {
  salle: {
    version: 1,
    label: "Salle",
    competences: ["C1", "C2", "C4", "C6"],
    metaFields: [
      { key: "theme", label: "Thème" },
      { key: "duree", label: "Durée" },
    ],
    sections: [
      {
        code: "PREP", court: "Préparation",
        titre: "Préparation (de X minutes)",
        competenceTP: "1. Construire et préparer le scénario d'une séance collective de formation",
        criteres: [
          { code: "PREP1", libelle: "Les objectifs sont ciblés pour des élèves conducteurs." },
          { code: "PREP2", libelle: "Une hiérarchie des objectifs est établie suivant le parcours des élèves." },
          { code: "PREP3", libelle: "Les contenus sont adaptés aux objectifs définis." },
          { code: "PREP4", libelle: "Les animations prévues sont cohérentes avec les différents objectifs." },
          { code: "PREP5", libelle: "Les différents temps de la séance sont organisés." },
        ],
      },
      {
        code: "ANIM", court: "Animation",
        titre: "Cours, explication, application",
        competenceTP: "2. Animer une séance collective de formation à la sécurité routière",
        criteres: [
          { code: "ANIM1", libelle: "Le plan est en lien avec l'objectif." },
          { code: "ANIM2", libelle: "Utilise-t-il les connaissances des élèves ?" },
          { code: "ANIM3", libelle: "Méthodes et outils pédagogiques sont utilisés." },
          { code: "ANIM4", libelle: "Les contenus sont maîtrisés." },
          { code: "ANIM5", libelle: "Donne-t-il du sens à la règle ?" },
          { code: "ANIM6", libelle: "Communication positive (facilitant / confiance)." },
          { code: "ANIM7", libelle: "La durée de la séance est respectée." },
        ],
      },
      {
        code: "EVAL", court: "Évaluations",
        titre: "Évaluation générale statique · Évaluation spécifique statique · Évaluation finale",
        competenceTP: "4. Évaluer le degré d'acquisition des compétences des apprenants",
        criteres: [
          { code: "EVAL1", libelle: "Explique-t-il l'intérêt de l'évaluation ?" },
          { code: "EVAL2", libelle: "Cherche-t-il à connaître les élèves ?" },
          { code: "EVAL3", libelle: "L'évaluation est-elle en lien avec le thème / REMC ?" },
          { code: "EVAL4", libelle: "La restitution des résultats permet l'auto-évaluation et l'auto-réflexion ?" },
          { code: "EVAL5", libelle: "L'explication des résultats est claire pour les élèves." },
          { code: "EVAL6", libelle: "Les critères de l'évaluation finale sont déterminés." },
          { code: "EVAL7", libelle: "L'évaluation finale est réalisable." },
        ],
      },
      {
        code: "BILEV", court: "Bilan & objectif",
        titre: "Bilan des évaluations · Détermination de l'objectif",
        competenceTP: "6. Repérer les difficultés d'apprentissage et essayer d'y remédier",
        criteres: [
          { code: "BILEV1", libelle: "Repérer les difficultés d'apprentissage particulières des élèves." },
          { code: "BILEV2", libelle: "Identifier les difficultés d'apprentissage particulières des élèves." },
          { code: "BILEV3", libelle: "L'objectif déterminé correspond aux difficultés d'apprentissage." },
          { code: "BILEV4", libelle: "L'intérêt de l'objectif choisi est expliqué aux élèves." },
        ],
      },
      {
        code: "BILAN", court: "Bilan final",
        titre: "Bilan final",
        competenceTP: null,
        criteres: [
          { code: "BILAN1", libelle: "Une restitution du message de sécurité routière est évoquée." },
          { code: "BILAN2", libelle: "Une projection pour une prochaine séance est proposée (livret)." },
        ],
      },
    ],
  },

  vehicule: {
    version: 1,
    label: "Véhicule",
    competences: ["C3", "C4", "C6", "C7"],
    metaFields: [
      { key: "niveau_eleve", label: "Niveau de l'élève cobaye" },
      { key: "duree", label: "Durée" },
    ],
    sections: [
      {
        code: "COND", court: "Animation conduite",
        titre: "Explication, démonstration, guidage, autonomie, répétition",
        competenceTP: "3. Animer une séance individuelle de formation à la conduite d'un véhicule léger",
        criteres: [
          { code: "COND1", libelle: "L'objectif est-il respecté ? Les modifications sont-elles justifiées ?" },
          { code: "COND2", libelle: "Les choix d'itinéraire sont réalisables en fonction des impératifs." },
          { code: "COND3", libelle: "Les techniques pédagogiques sont adaptées à la conduite (démo…)." },
          { code: "COND4", libelle: "Les interventions sont pertinentes et motivées." },
          { code: "COND5", libelle: "Les contenus et procédures sont maîtrisés." },
          { code: "COND6", libelle: "Communication positive (facilitant / confiance / rassurant)." },
          { code: "COND7", libelle: "La durée de la séance est respectée." },
          { code: "COND8", libelle: "La sécurité pour tous est assurée." },
        ],
      },
      {
        code: "EVAL", court: "Évaluations",
        titre: "Évaluations statiques · Évaluation finale",
        competenceTP: "4. Évaluer le degré d'acquisition des compétences des apprenants",
        criteres: [
          { code: "EVAL1", libelle: "Explique-t-il l'intérêt de l'évaluation ?" },
          { code: "EVAL2", libelle: "Cherche-t-il à connaître l'apprenant ?" },
          { code: "EVAL3", libelle: "L'évaluation est-elle en lien avec l'objectif / livret ?" },
          { code: "EVAL4", libelle: "Le contexte d'évaluation est-il propice aux capacités de l'apprenant ?" },
          { code: "EVAL5", libelle: "La restitution des résultats permet l'auto-évaluation et l'auto-réflexion ?" },
          { code: "EVAL6", libelle: "Les critères de l'évaluation finale sont déterminés." },
          { code: "EVAL7", libelle: "L'évaluation finale est réalisable." },
        ],
      },
      {
        code: "BILEV", court: "Bilan & objectif",
        titre: "Bilan des évaluations · Détermination de l'objectif",
        competenceTP: "6. Repérer les difficultés d'apprentissage et essayer d'y remédier",
        criteres: [
          { code: "BILEV1", libelle: "Repérer les difficultés d'apprentissage particulières de l'élève." },
          { code: "BILEV2", libelle: "Identifier les difficultés d'apprentissage particulières de l'élève." },
          { code: "BILEV3", libelle: "L'objectif déterminé correspond aux difficultés d'apprentissage." },
          { code: "BILEV4", libelle: "L'intérêt de l'objectif choisi est expliqué à l'élève." },
          { code: "BILEV5", libelle: "Communication positive (empathie / écoute / posture professionnelle)." },
        ],
      },
      {
        code: "BILAN", court: "Bilan final",
        titre: "Bilan final",
        competenceTP: null,
        criteres: [
          { code: "BILAN1", libelle: "Une restitution du message de sécurité routière est évoquée." },
          { code: "BILAN2", libelle: "Une projection pour une prochaine séance est proposée (livret)." },
        ],
      },
      {
        code: "PERC", court: "Perception (C7)",
        titre: "Conduite commentée, guidage, démonstration",
        competenceTP: "7. Apprécier la dynamique de l'environnement routier et identifier les risques potentiels",
        criteres: [
          { code: "PERC1", libelle: "La prise d'information est riche et variée (CAHLLM)." },
          { code: "PERC2", libelle: "Les indices sont triés." },
          { code: "PERC3", libelle: "Les indices sont hiérarchisés." },
          { code: "PERC4", libelle: "Les prévisions sont pertinentes (risques)." },
          { code: "PERC5", libelle: "Les indices sont pris en compte pour anticiper le comportement de l'apprenant." },
          { code: "PERC6", libelle: "Les indices sont partagés et analysés avec l'apprenant." },
        ],
      },
    ],
  },

  // CCP2 « Sensibiliser l'ensemble des usagers de la route à l'adoption de comportements sûrs et respectueux de
  // l'environnement ». À l'examen : présentation d'une action menée en entreprise (30 min), entretien technique
  // (30 min), questionnement sur le dossier d'analyse de la demande (30 min). Les critères sont ceux du REAC, mot
  // pour mot.
  ccp2: {
    version: 1,
    label: "CCP2",
    competences: ["C8", "C9", "C10", "C11"],
    metaFields: [
      { key: "action", label: "Action et commanditaire" },
      { key: "public", label: "Public" },
      { key: "duree", label: "Durée" },
    ],
    sections: [
      {
        code: "DEM", court: "Analyse de la demande",
        titre: "Analyse de la demande",
        competenceTP: "8. Analyser une demande relative à une prestation de sensibilisation",
        criteres: [
          { code: "DEM1", libelle: "Les attentes spécifiques du commanditaire sont identifiées." },
          { code: "DEM2", libelle: "Le conseil est pertinent au regard de la demande." },
          { code: "DEM3", libelle: "La prestation envisagée correspond au besoin du commanditaire." },
          { code: "DEM4", libelle: "Les impératifs économiques, logistiques et organisationnels de l'établissement sont pris en compte." },
          { code: "DEM5", libelle: "Les prestations et l'expertise de l'établissement sont valorisées auprès du client." },
        ],
      },
      {
        code: "CONS", court: "Construction",
        titre: "Construction et préparation de l'action",
        competenceTP: "9. Construire et préparer une action de sensibilisation",
        criteres: [
          { code: "CONS1", libelle: "Le scénario de l'action intègre les exigences du cahier des charges." },
          { code: "CONS2", libelle: "Le rôle du co-animateur et les modalités de son intervention sont définis." },
          { code: "CONS3", libelle: "Le contenu et les ressources sont adaptés à l'objectif et au public." },
          { code: "CONS4", libelle: "Les activités d'apprentissage et les espaces de formation prévus sont en cohérence avec l'objectif." },
          { code: "CONS5", libelle: "Le scénario tient compte de la durée et des moyens matériels." },
        ],
      },
      {
        code: "SENS", court: "Animation",
        titre: "Animation de la séance de sensibilisation",
        competenceTP: "10. Animer une séance de sensibilisation à la sécurité routière, au respect des usagers et de l'environnement",
        criteres: [
          { code: "SENS1", libelle: "Les clauses du cahier des charges sont respectées." },
          { code: "SENS2", libelle: "Les techniques et supports pédagogiques sont adaptés." },
          { code: "SENS3", libelle: "Le langage et la communication sont adaptés au public." },
          { code: "SENS4", libelle: "Les contenus sont pertinents." },
          { code: "SENS5", libelle: "La durée de la séance est respectée." },
          { code: "SENS6", libelle: "La méthode favorise la participation du public." },
        ],
      },
      {
        code: "PRAT", court: "Ses pratiques",   // court : tient à gauche du radar (86 px)
        titre: "Analyse de sa pratique professionnelle",
        competenceTP: "11. Analyser ses pratiques professionnelles afin de les faire évoluer",
        criteres: [
          { code: "PRAT1", libelle: "La situation de formation est décrite et analysée de façon pertinente." },
          { code: "PRAT2", libelle: "Les propositions d'ajustement des pratiques sont pertinentes." },
          { code: "PRAT3", libelle: "Les facteurs d'efficacité et d'inefficacité des pratiques sont identifiés." },
          { code: "PRAT4", libelle: "Les pratiques professionnelles sont décrites et analysées de façon pertinente." },
          { code: "PRAT5", libelle: "Les sources d'information relatives à la sécurité routière sont connues et exploitées à bon escient." },
          { code: "PRAT6", libelle: "Le bilan des interventions est pertinent." },
          { code: "PRAT7", libelle: "Les axes d'amélioration sont réalistes." },
        ],
      },
    ],
  },
};
