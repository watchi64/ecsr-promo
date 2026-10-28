// Référentiel national qualité (Qualiopi) en données : les 7 critères et les 33 indicateurs de
// l'annexe du code du travail en vigueur le 1er novembre 2026 (décret n° 2026-728 du 1er août 2026).
// PUR : aucun import, ni DOM ni réseau ; testé en node (tests/qualiopi-referentiel.test.mjs).
// Spec : docs/superpowers/specs/2026-10-28-dossier-qualiopi-design.md (§ 2 et § 6.1).
//
// `texte` et les titres des critères sont recopiés tels quels de la source : les reformuler serait
// citer un texte qui n'existe pas. `court` (le libellé d'écran) et `changement2026` (ce que 2026
// change, après comparaison mot à mot avec l'annexe de 2021) sont de notre main.
//
// Champs d'un indicateur :
//   numero, critere    de 1 à 33, de 1 à 7.
//   categories         les actions qu'il vise (article L. 6313-1) : formation, bilan de compétences, VAE,
//                      apprentissage. Un centre qui prépare un titre en formation continue relève de
//                      `formation`.
//   conditionnel       la condition d'application de l'indicateur entier, qui ouvre son texte (« Lorsque... »
//                      ou « Pour les formations en alternance »), telle quelle ; null sinon. Une condition
//                      qui ne vise qu'une phrase de l'indicateur (19, 20) n'est pas retenue.
//   majeureSeulement   ne peut donner lieu qu'à une non-conformité majeure.
//   surveillance       revu à chaque audit de surveillance (le 3, pour les organismes concernés).
//   nouvelEntrant      pour un nouvel entrant (première année d'activité, ou nouvelle catégorie d'actions),
//                      la formalisation est vérifiée à l'audit initial, la mise en œuvre à l'audit de
//                      surveillance.
//   changement2026     ce que le décret change par rapport à 2021, en une phrase ; null si inchangé.
// Les trois drapeaux d'audit viennent des articles 5, 2 et 1 de l'arrêté du 6 juin 2019, dans sa version
// consolidée au 10/07/2025 (lue le 28/10/2026) : il n'est pas encore modifié pour le nouveau référentiel,
// à reprendre quand il le sera.

// Source du référentiel et date d'entrée en vigueur.
export const SOURCE = {
  decret: "Décret n° 2026-728 du 1er août 2026 relatif au référentiel national sur la qualité des actions concourant au développement des compétences",
  nor: "TRSD2619632D",
  enVigueur: "2026-11-01",
  annexe: "LEGIARTI000054612711",
  arreteAudit: "Arrêté du 6 juin 2019 relatif aux modalités d'audit associées au référentiel national mentionné à l'article D. 6316-1-1 du code du travail",
};

// Titres de l'article R6316-1 du code du travail, qui sont aussi ceux de l'annexe.
export const CRITERES = [
  { numero: 1, titre: "Les conditions d'information du public sur les prestations proposées, les délais pour y accéder et les résultats obtenus" },
  { numero: 2, titre: "L'identification précise des objectifs des prestations proposées et l'adaptation de ces prestations aux publics bénéficiaires, lors de la conception des prestations" },
  { numero: 3, titre: "L'adaptation aux publics bénéficiaires des prestations et des modalités d'accueil, d'accompagnement, de suivi et d'évaluation mises en œuvre" },
  { numero: 4, titre: "L'adéquation des moyens pédagogiques, techniques et d'encadrement aux prestations mises en œuvre" },
  { numero: 5, titre: "La qualification et le développement des connaissances et compétences des personnels chargés de mettre en œuvre les prestations" },
  { numero: 6, titre: "L'inscription et l'investissement du prestataire dans son environnement professionnel" },
  { numero: 7, titre: "Le recueil et la prise en compte des appréciations et des réclamations formulées par les parties prenantes aux prestations délivrées" },
];

// Les 33 indicateurs, dans l'ordre des numéros, regroupés par critère.
export const INDICATEURS = [
  // Critère 1
  {
    numero: 1, critere: 1,
    court: "Information publique détaillée, sans mention trompeuse",
    texte: "Le prestataire diffuse une information accessible au public, détaillée et vérifiable sur les prestations proposées : prérequis, objectifs, type de reconnaissance de la formation délivrée, durée, modalités pédagogiques et de financements, délais d'accès, tarifs, contacts, méthodes mobilisées et modalités d'évaluation, accessibilité aux personnes en situation de handicap. Sa communication ne comporte aucune mention de nature à induire le public en erreur, notamment sur les conditions d'accès, le contenu, les modalités pédagogiques, le financement des formations, les droits ou l'absence de droits de poursuite d'études conférés par la formation préparée.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: true, nouvelEntrant: false,
    changement2026: "L'information porte aussi sur le type de reconnaissance et sur les modalités de financement, et la communication ne doit comporter aucune mention trompeuse.",
  },
  {
    numero: 2, critere: 1,
    court: "Résultats publiés avec leur mode de calcul",
    texte: "Le prestataire diffuse des indicateurs de résultats adaptés à la nature des prestations mises en œuvre et des publics accueillis en précisant de manière transparente leurs modalités de calcul ou en s'appuyant sur des dispositifs existants.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: true,
    changement2026: "Les résultats publiés précisent de manière transparente leurs modalités de calcul, ou s'appuient sur des dispositifs existants.",
  },
  {
    numero: 3, critere: 1,
    court: "Taux d'obtention, blocs, passerelles, poursuites, débouchés",
    texte: "Lorsque le prestataire met en œuvre des prestations conduisant à une certification professionnelle, il informe sur les taux d'obtention des certifications préparées, les possibilités de valider un/ ou des blocs de compétences, ainsi que sur les équivalences, passerelles, suites de parcours, en particulier les poursuites d'études, et les débouchés.",
    categories: { formation: true, bilan: false, vae: true, apprentissage: true },
    conditionnel: "Lorsque le prestataire met en œuvre des prestations conduisant à une certification professionnelle",
    majeureSeulement: false, surveillance: true, nouvelEntrant: true,
    changement2026: "L'information porte aussi sur les poursuites d'études.",
  },
  // Critère 2
  {
    numero: 4, critere: 2,
    court: "Analyse du besoin avec l'entreprise ou le financeur",
    texte: "Le prestataire analyse le besoin du bénéficiaire en lien avec l'entreprise et/ ou le financeur concerné (s).",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 5, critere: 2,
    court: "Objectifs opérationnels et évaluables",
    texte: "Le prestataire définit les objectifs opérationnels et évaluables de la prestation.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 6, critere: 2,
    court: "Contenus et modalités adaptés",
    texte: "Le prestataire établit les contenus et les modalités de mise en œuvre de la prestation, adaptés aux objectifs définis et aux publics bénéficiaires.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 7, critere: 2,
    court: "Contenus conformes au titre, capacité à le délivrer",
    texte: "Lorsque le prestataire met en œuvre des prestations conduisant à une certification professionnelle, il s'assure de l'adéquation du ou des contenus de la prestation aux exigences de la certification visée et peut prouver sa capacité à assurer cette certification, y compris en qualité d'organisme habilité.",
    categories: { formation: true, bilan: false, vae: false, apprentissage: true },
    conditionnel: "Lorsque le prestataire met en œuvre des prestations conduisant à une certification professionnelle",
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: "Le prestataire doit pouvoir prouver sa capacité à assurer la certification, y compris en qualité d'organisme habilité.",
  },
  {
    numero: 8, critere: 2,
    court: "Positionnement à l'entrée",
    texte: "Le prestataire détermine les procédures de positionnement et d'évaluation des acquis à l'entrée de la prestation.",
    categories: { formation: true, bilan: false, vae: false, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  // Critère 3
  {
    numero: 9, critere: 3,
    court: "Informer sur le déroulement",
    texte: "Le prestataire informe les publics bénéficiaires sur les conditions de déroulement de la prestation.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 10, critere: 3,
    court: "Adapter l'accompagnement et le suivi",
    texte: "Le prestataire met en œuvre et adapte la prestation, l'accompagnement et le suivi aux publics bénéficiaires.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 11, critere: 3,
    court: "Évaluer l'atteinte des objectifs",
    texte: "Le prestataire évalue l'atteinte par les publics bénéficiaires des objectifs de la prestation.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: true,
    changement2026: null,
  },
  {
    numero: 12, critere: 3,
    court: "Engagement, ruptures, violences et discriminations",
    texte: "Le prestataire décrit et met en œuvre les mesures pour favoriser l'engagement des bénéficiaires et prévenir les ruptures de parcours. Il s'assure de la prévention et du traitement de toute situation de violence, dont les violences sexistes et sexuelles, de harcèlement ou de discrimination dans le cadre de leur formation.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: "S'ajoute l'obligation de s'assurer de la prévention et du traitement des violences (dont sexistes et sexuelles), du harcèlement et des discriminations.",
  },
  {
    numero: 13, critere: 3,
    court: "Alternance (si le centre en fait)",
    texte: "Pour les formations en alternance, le prestataire, en lien avec l'entreprise, anticipe avec l'apprenant les missions confiées, à court, moyen et long terme, et assure la coordination et la progressivité des apprentissages réalisés en centre de formation et en entreprise.",
    categories: { formation: true, bilan: false, vae: false, apprentissage: true },
    conditionnel: "Pour les formations en alternance",
    majeureSeulement: false, surveillance: false, nouvelEntrant: true,
    changement2026: null,
  },
  {
    numero: 14, critere: 3,
    court: "Accompagnement socio-professionnel et traitement des ruptures",
    texte: "Le prestataire met en œuvre un accompagnement socio-professionnel, éducatif et relatif à l'exercice de la citoyenneté. Il dispose d'une procédure de traitement sans délai des situations de rupture liées à des difficultés, violences ou discriminations subies par l'apprenant en formation ou dans l'entreprise d'accueil.",
    categories: { formation: false, bilan: false, vae: false, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: true,
    changement2026: "Apprentissage seulement : s'ajoute une procédure de traitement sans délai des ruptures liées à des difficultés, violences ou discriminations.",
  },
  {
    numero: 15, critere: 3,
    court: "Droits des apprentis, sécurité, prévention et signalement",
    texte: "Le prestataire informe les apprentis de leurs droits et devoirs en tant qu'apprentis et salariés ainsi que des règles applicables en matière de santé et de sécurité en milieu professionnel, de manière renforcée lorsqu'ils sont mineurs. Il les informe des dispositifs d'accompagnement, de prévention et de signalement des situations de violences, de harcèlement moral ou sexuel, d'agissements sexistes et de discriminations, ainsi que des interlocuteurs susceptibles de les accompagner. Il communique les coordonnées du médiateur de l'apprentissage et veille à signaler les dysfonctionnements à l'inspection du travail.",
    categories: { formation: false, bilan: false, vae: false, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: "Apprentissage seulement : s'ajoutent une information renforcée pour les mineurs, les dispositifs de signalement des violences et des discriminations, et le médiateur de l'apprentissage.",
  },
  {
    numero: 16, critere: 3,
    court: "Présentation à l'examen conforme",
    texte: "Lorsque le prestataire met en œuvre des formations conduisant à une certification professionnelle, il s'assure que les conditions de présentation des bénéficiaires à la certification respectent les exigences formelles de l'autorité de certification.",
    categories: { formation: true, bilan: false, vae: true, apprentissage: true },
    conditionnel: "Lorsque le prestataire met en œuvre des formations conduisant à une certification professionnelle",
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  // Critère 4
  {
    numero: 17, critere: 4,
    court: "Moyens humains et techniques",
    texte: "Le prestataire met à disposition ou s'assure de la mise à disposition des moyens humains et techniques adaptés et d'un environnement approprié (conditions, locaux, équipements, plateaux techniques …).",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: true, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 18, critere: 4,
    court: "Coordonner les intervenants",
    texte: "Le prestataire mobilise et coordonne les différents intervenants internes et/ ou externes (pédagogiques, administratifs, logistiques, commerciaux …).",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 19, critere: 4,
    court: "Ressources pédagogiques et leur appropriation",
    texte: "Le prestataire met à disposition du bénéficiaire des ressources pédagogiques et permet à celui-ci de se les approprier. Lorsque des modules pédagogiques sont réalisés à distance, le prestataire vérifie l'effectivité de leur suivi par les apprenants. Au-delà d'un nombre d'intervenants par formation, fixé par arrêté du ministre chargé de la formation professionnelle, le prestataire dispose d'un référent pédagogique par formation chargé d'assurer la coordination pédagogique entre les intervenants.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: true, nouvelEntrant: true,
    changement2026: "Le prestataire vérifie le suivi effectif des modules à distance et dispose d'un référent pédagogique au-delà d'un nombre d'intervenants fixé par arrêté.",
  },
  {
    numero: 20, critere: 4,
    court: "Mobilité, référent handicap, conseil de perfectionnement, gouvernance",
    texte: "Le prestataire dispose d'un personnel dédié à l'appui à la mobilité nationale et internationale, d'un référent handicap et d'un conseil de perfectionnement. Il s'assure de la qualité du pilotage de la formation, de la participation des apprentis, formateurs et entreprises à sa gouvernance. Lorsque la proportion d'heures d'enseignement réalisées par des intervenants permanents est inférieure à un seuil fixé par arrêté du ministre chargé de la formation professionnelle, le prestataire s'assure de la mise en œuvre de modalités renforcées de supervision pédagogique et de contrôle de la qualité des interventions.",
    categories: { formation: false, bilan: false, vae: false, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: "Apprentissage seulement : s'ajoutent la qualité du pilotage, la participation des apprentis, formateurs et entreprises à la gouvernance, et une supervision renforcée sous un seuil d'heures d'enseignement assurées par des intervenants permanents.",
  },
  // Critère 5
  {
    numero: 21, critere: 5,
    court: "Compétences des intervenants",
    texte: "Le prestataire détermine, mobilise et évalue les compétences des différents intervenants internes et/ ou externes, adaptées aux prestations.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 22, critere: 5,
    court: "Développement des compétences des salariés",
    texte: "Le prestataire entretient et développe les compétences de ses salariés, adaptées aux prestations qu'il délivre.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: true,
    changement2026: null,
  },
  // Critère 6
  {
    numero: 23, critere: 6,
    court: "Veille légale et réglementaire, exploitée",
    texte: "Le prestataire réalise une veille légale et réglementaire sur le champ de la formation professionnelle et en exploite les enseignements.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 24, critere: 6,
    court: "Veille métiers, compétences, emplois",
    texte: "Le prestataire réalise une veille sur les évolutions des compétences, des métiers et des emplois dans ses secteurs d'intervention et en exploite les enseignements.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: true,
    changement2026: null,
  },
  {
    numero: 25, critere: 6,
    court: "Veille innovations pédagogiques et technologiques",
    texte: "Le prestataire réalise une veille sur les innovations pédagogiques et technologiques permettant une évolution de ses prestations et en exploite les enseignements.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: true,
    changement2026: null,
  },
  {
    numero: 26, critere: 6,
    court: "Handicap",
    texte: "Le prestataire mobilise les expertises, outils et réseaux nécessaires pour accueillir, accompagner/ former ou orienter les publics en situation de handicap.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: true,
    changement2026: null,
  },
  {
    numero: 27, critere: 6,
    court: "Sous-traitance (s'il y en a)",
    texte: "Lorsque le prestataire fait appel à la sous-traitance ou au portage salarial, il s'assure du respect de la conformité au présent référentiel et en assure la traçabilité dans les contrats de sous-traitance.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: "Lorsque le prestataire fait appel à la sous-traitance ou au portage salarial",
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: "Le respect de la conformité au référentiel doit aussi être tracé dans les contrats de sous-traitance.",
  },
  {
    numero: 28, critere: 6,
    court: "Stages : réseau de partenaires",
    texte: "Lorsque les prestations dispensées au bénéficiaire comprennent des périodes de formation en situation de travail, le prestataire mobilise son réseau de partenaires socio-économiques pour co-construire l'ingénierie de formation et favoriser l'accueil en entreprise.",
    categories: { formation: true, bilan: false, vae: false, apprentissage: true },
    conditionnel: "Lorsque les prestations dispensées au bénéficiaire comprennent des périodes de formation en situation de travail",
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  {
    numero: 29, critere: 6,
    court: "Insertion professionnelle et poursuite d'études",
    texte: "Le prestataire développe des actions qui concourent à l'insertion professionnelle ou la poursuite d'étude par la voie de l'apprentissage ou par toute autre voie permettant de développer leurs connaissances et leurs compétences.",
    categories: { formation: false, bilan: false, vae: false, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: null,
  },
  // Critère 7
  {
    numero: 30, critere: 7,
    court: "Recueillir les appréciations",
    texte: "Le prestataire recueille les appréciations des parties prenantes : bénéficiaires, financeurs (le cas échéant), équipes pédagogiques et entreprises concernées.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: "Les appréciations des financeurs ne sont recueillies que « le cas échéant ».",
  },
  {
    numero: 31, critere: 7,
    court: "Traiter difficultés, réclamations, aléas",
    texte: "Le prestataire met en œuvre des modalités de traitement des difficultés rencontrées par les parties prenantes, des réclamations exprimées par ces dernières ainsi que des aléas survenus en cours de prestation.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: false,
    changement2026: "Simple reformulation : « ainsi que » introduit les aléas survenus en cours de prestation, déjà visés auparavant.",
  },
  {
    numero: 32, critere: 7,
    court: "Amélioration continue et analyse des risques",
    texte: "Le prestataire met en place une démarche d'amélioration continue à partir de l'analyse des appréciations et des réclamations, ainsi qu'une analyse des risques sur la qualité des formations délivrées.",
    categories: { formation: true, bilan: true, vae: true, apprentissage: true },
    conditionnel: null,
    majeureSeulement: true, surveillance: false, nouvelEntrant: true,
    changement2026: "Une démarche d'amélioration continue remplace les mesures d'amélioration, et le prestataire analyse aussi les risques sur la qualité des formations délivrées.",
  },
  {
    numero: 33, critere: 7,
    court: "Évaluation des contenus et des enseignements par les apprenants",
    texte: "Le prestataire met en place un dispositif d'évaluation des contenus et des enseignements par les apprenants, distinct du recueil général de satisfaction, dont les résultats sont partagés avec les équipes pédagogiques et donnent lieu à la formalisation d'une démarche d'amélioration continue, dont il mesure périodiquement l'efficacité.",
    categories: { formation: false, bilan: false, vae: false, apprentissage: true },
    conditionnel: null,
    majeureSeulement: false, surveillance: false, nouvelEntrant: false,
    changement2026: "Nouvel indicateur, apprentissage seulement : évaluation des contenus et des enseignements par les apprenants, distincte du recueil général de satisfaction.",
  },
];

// Les indicateurs d'un centre de formation continue (catégorie « action de formation »), dans l'ordre
// des numéros : 27, ou 28 avec l'alternance, qui ajoute l'indicateur 13. Tableau neuf à chaque appel :
// le trier ne change pas INDICATEURS.
const ALTERNANCE = 13;

export function indicateursApplicables({ alternance = false } = {}) {
  return INDICATEURS
    .filter((i) => i.categories.formation && (alternance || i.numero !== ALTERNANCE))
    .sort((a, b) => a.numero - b.numero);
}
