// Trames EPCF (grilles d'évaluation officielles d'Hocine, CCP1 — 09/07/2026).
// NE PAS modifier une version publiée : toute évolution de la grille = version++
// (les évals stockées portent trame_version et se réaffichent avec leur définition).

export const NOTE_VALUES = { A: 2, R: 1, NA: 0 };
export const NOTE_LABELS = { A: "Acquis", R: "À renforcer", NA: "Non acquis" };

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
        competenceTP: "1 — Construire et préparer le scénario d'une séance collective de formation",
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
        competenceTP: "2 — Animer une séance collective de formation à la sécurité routière",
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
        competenceTP: "4 — Évaluer le degré d'acquisition des compétences des apprenants",
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
        competenceTP: "6 — Repérer les difficultés d'apprentissage et essayer d'y remédier",
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
        competenceTP: "3 — Animer une séance individuelle de formation à la conduite d'un véhicule léger",
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
        titre: "Évaluation générale statique · Évaluation spécifique statique · Évaluation finale",
        competenceTP: "4 — Évaluer le degré d'acquisition des compétences des apprenants",
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
        competenceTP: "6 — Repérer les difficultés d'apprentissage et essayer d'y remédier",
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
        competenceTP: "7 — Apprécier la dynamique de l'environnement routier et identifier les risques potentiels",
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
};
