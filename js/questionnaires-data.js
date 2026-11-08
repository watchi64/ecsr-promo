// Contenu des trois questionnaires anonymes (Qualiopi, indicateur 30). Les questions portent sur
// la FORMATION, pas sur l'application (sauf une question facultative en fin de formation).
// Texte soumis à Timy avant la migration. Versionné : une question modifiée crée une version 2,
// les réponses déjà données gardent la leur.
//
// Types : "echelle" (1 à 4 plus « sans avis »), "choix" (une option), "commentaire" (texte libre).
// Exactement une question `globale: true` par questionnaire : c'est elle qui donne le taux de
// satisfaction (part des réponses 3 ou 4 sur les répondants).

export const ECHELLE = [
  { valeur: 1, libelle: "Pas du tout" },
  { valeur: 2, libelle: "Plutôt non" },
  { valeur: 3, libelle: "Plutôt oui" },
  { valeur: 4, libelle: "Tout à fait" },
  { valeur: null, libelle: "Sans avis" },
];

const CONSIGNE_COMMENTAIRE = "Si tu veux ajouter quelque chose, écris-le ici. Ne cite personne : parle de ce que tu as vécu, pas de qui.";

export const QUESTIONNAIRES = {
  fin_stagiaire: {
    cle: "fin_stagiaire",
    public: "stagiaire",
    version: 1,
    titre: "Ton avis sur la formation",
    intro: "Ces questions portent sur ta formation. Ta réponse est enregistrée sans ton nom et sans date : personne ne peut savoir qui a répondu quoi. Compte environ trois minutes.",
    questions: [
      { id: "objectifs", type: "echelle", facultative: false, texte: "Les objectifs de la formation t'ont été clairement présentés." },
      { id: "contenus", type: "echelle", facultative: false, texte: "Les contenus correspondent à ce que tu attendais de la formation." },
      { id: "formateurs", type: "echelle", facultative: false, texte: "Les formateurs expliquent clairement et répondent à tes questions." },
      { id: "organisation", type: "echelle", facultative: false, texte: "L'organisation (plannings, horaires, salles, informations reçues) te convient." },
      { id: "accompagnement", type: "echelle", facultative: false, texte: "Tu as été accompagné quand tu avais une difficulté." },
      { id: "preparation", type: "echelle", facultative: false, texte: "La formation te prépare bien à l'examen et au métier d'enseignant de la conduite." },
      { id: "recommandation", type: "echelle", facultative: false, texte: "Tu recommanderais cette formation à un proche." },
      { id: "globalement", type: "echelle", facultative: false, globale: true, texte: "Globalement, tu es satisfait de la formation." },
      { id: "app", type: "echelle", facultative: true, texte: "L'application t'a aidé dans ta formation." },
      { id: "commentaire", type: "commentaire", facultative: true, texte: CONSIGNE_COMMENTAIRE },
    ],
  },

  six_mois_stagiaire: {
    cle: "six_mois_stagiaire",
    public: "stagiaire",
    version: 1,
    titre: "Six mois après, ton avis",
    intro: "Quelques mois ont passé depuis la fin de ta formation. Ces questions nous disent ce qu'elle t'a apporté. Ta réponse est enregistrée sans ton nom et sans date. Compte une minute ou deux.",
    questions: [
      { id: "situation", type: "choix", facultative: false, texte: "Où en es-tu aujourd'hui ?", options: ["J'ai le titre et j'enseigne la conduite", "J'ai le titre et je cherche un poste", "Je n'ai pas encore le titre (examen à repasser ou à venir)", "Je fais autre chose"] },
      { id: "utile", type: "echelle", facultative: false, texte: "Ce que tu as appris en formation te sert dans ta situation actuelle." },
      { id: "preparation", type: "echelle", facultative: false, texte: "Avec le recul, la formation t'a bien préparé au métier." },
      { id: "globalement", type: "echelle", facultative: false, globale: true, texte: "Globalement, avec le recul, tu es satisfait de la formation." },
      { id: "commentaire", type: "commentaire", facultative: true, texte: CONSIGNE_COMMENTAIRE },
    ],
  },

  fin_formateur: {
    cle: "fin_formateur",
    public: "formateur",
    version: 1,
    titre: "Ton avis de formateur",
    intro: "Ces questions portent sur la formation telle que tu l'as animée cette année. Ta réponse est enregistrée sans ton nom et sans date, et regroupée avec celles des autres formateurs du centre. Compte trois minutes.",
    questions: [
      { id: "objectifs", type: "echelle", facultative: false, texte: "Les objectifs de la formation sont clairs et réalistes pour les stagiaires." },
      { id: "supports", type: "echelle", facultative: false, texte: "Les supports et les outils mis à ta disposition te permettent d'enseigner correctement." },
      { id: "organisation", type: "echelle", facultative: false, texte: "L'organisation (plannings, salles, véhicules, informations reçues) te convient." },
      { id: "niveau", type: "echelle", facultative: false, texte: "Le niveau des stagiaires correspond à ce que la formation demande." },
      { id: "suivi", type: "echelle", facultative: false, texte: "Tu disposes des moyens de suivre chaque stagiaire et de l'aider en cas de difficulté." },
      { id: "globalement", type: "echelle", facultative: false, globale: true, texte: "Globalement, tu es satisfait des conditions dans lesquelles la formation se déroule." },
      { id: "commentaire", type: "commentaire", facultative: true, texte: CONSIGNE_COMMENTAIRE },
    ],
  },
};

// Seuil sous lequel rien n'est affiché : 5 réponses pour les stagiaires, 3 pour les formateurs
// (une équipe compte trois formateurs par promo : le résultat est regroupé par centre et par année).
export function seuilDe(publicCible) {
  return publicCible === "formateur" ? 3 : 5;
}
