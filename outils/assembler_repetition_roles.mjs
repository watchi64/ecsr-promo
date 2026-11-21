// Assembleur des répétitions du lot 4 (rôles et portées).
//
// Une preuve du lot se joue sur la vraie base dans un bloc do qui finit toujours par une levée : tout ce qu'elle fait
// est annulé. Les migrations y entrent sous forme de littéraux. Ce script fabrique le fichier à jouer à partir d'un
// gabarit (tests/sql/roles-*-preuve.sql) qui porte trois sortes de marqueurs, chacun seul sur sa ligne :
//   -- @@INJECTER <chemin>@@  remplacé par le texte du fichier, retours chariot retirés, en littéral dollar dont le
//                             délimiteur ne figure ni dans le gabarit ni dans aucun fichier assemblé ; le gabarit écrit
//                             avant le marqueur « execute » ou une affectation, et « ; » ou « into ...; » après ;
//   -- @@INCLURE <chemin>@@   remplacé par le texte du fichier, collé tel quel au niveau du script (aides communes) ;
//   -- @@MODE@@               remplacé par le libellé du mode en littéral simple (la preuve le dit dans son verdict).
//   -- @@CAS_ROUTAGE@@        remplacé par la table de cas du routage (tests/fixtures/contact-routage.json, sur une ligne) en
//                             littéral jsonb : la même table que joue le test node de js/contact-rules.js (parité, espace contact).
// Les chemins partent de la racine du dépôt. Un mode peut neutraliser des injections : le marqueur devient le littéral
// 'select 1' et le fichier n'est pas lu (preuve jouée sans la migration : ROUGE attendu).
// Tout écart arrête l'assemblage sur un message clair (code de sortie 1) : fichier absent, marqueur inconnu ou mal
// formé, délimiteur du gabarit présent dans un fichier injecté (le littéral fermerait le bloc qui l'entoure).
//
// Modes :
//   etape-1, etape-1-sans      preuve de l'étape 1 (tests/sql/roles-1-preuve.sql), avec ou sans la migration ;
//   repetition [--etapes 1,2]  preuve rôle par rôle (tests/sql/roles-preuve.sql) : migrations des étapes demandées
//                              (1, 2, 3 par défaut), contrôles, retours dans l'ordre inverse ; les étapes non demandées
//                              sont neutralisées ; une étape demandée dont un fichier manque arrête l'assemblage ;
//   contre-epreuve             la même preuve avec la seule étape 1 : ROUGE attendu là où les étapes 2 et 3 changent
//                              quelque chose, VERT sur la non-régression ;
//   en-ligne                   la même preuve sans aucune migration, après leur application réelle.
//   espaces                    preuve du lot 5, étapes 1 à 3 (tests/sql/espaces-preuve.sql) : les migrations du siège
//                              (20261108_espaces_1_siege), de l'équipe (20261108_espaces_2_equipe) et de l'habillage
//                              (20261108_espaces_3_habillage) avec leurs retours, la
//                              fixture commune et la requête d'empreinte injectées ;
//   espaces-contre-epreuve     la même preuve sans aucune des deux migrations ni leurs retours (neutralisés, non lus) : ROUGE
//                              attendu sur comptes_reseau, creer_centre, demonstration et l'équipe ;
//   espaces-contre-epreuve-2   la même preuve avec la migration du siège seule : ROUGE attendu sur les seuls contrôles de
//                              l'équipe et de l'habillage (migrations 2 et 3 et leurs retours neutralisés) ;
//   espaces-contre-epreuve-3   la même preuve avec les migrations du siège et de l'équipe seules : ROUGE attendu sur les seuls
//                              contrôles de l'habillage (migration 3 et son retour neutralisés) ;
//   espaces-en-ligne           la même preuve sans aucune migration, après leur application réelle (la fixture, elle, reste
//                              injectée) ;
//   donnees                    preuve de la suite du lot 5 (tests/sql/espaces-donnees-preuve.sql) : la migration
//                              20261111_espaces_4_donnees et son retour injectés (après les migrations 1 à 3 du lot) ;
//   donnees-contre-epreuve     la même sans la migration ni son retour : ROUGE attendu sur ses seules lignes ;
//   donnees-en-ligne           la même sans rien d'injecté, après l'application réelle de la migration.
//   titres [--etapes 1,2]      preuve du chantier « titres et droits à la carte » (tests/sql/titres-preuve.sql) : les
//                              migrations 20261112_titres_1 à _4 puis, dans l'ordre inverse (4, 3, 2, 1), leurs retours ;
//                              une étape dont la migration ou le retour manque est neutralisée (select 1) tant que sa tâche
//                              n'est pas faite ; --etapes (1 à 1,2,3,4) fixe les étapes injectées, et une étape demandée
//                              dont un fichier manque arrête l'assemblage ;
//   titres-contre-epreuve      la même preuve sans aucune migration ni retour (neutralisés, non lus) : ROUGE attendu sur
//                              chaque contrôle du groupe titres ;
//   titres-en-ligne            la même sans rien d'injecté, après l'application réelle des migrations.
//   gestion [--etapes 5|6|5,6|4,5,6]  preuve de l'étape 2 du chantier (tests/sql/titres-gestion-preuve.sql), jouée sur une base où
//                              les migrations 1, 2 et 3 sont appliquées (l'état de la production) : les migrations demandées
//                              (5 et 6 par défaut ; 4 seulement avec 5 et 6) puis, dans l'ordre inverse, leurs retours ; les
//                              étapes non demandées sont neutralisées et non lues ; une étape demandée dont un fichier manque
//                              arrête l'assemblage ; la 6 demande la 5, la 4 demande les deux ;
//   gestion-contre-epreuve     la même preuve sans aucune migration ni retour (neutralisés, non lus) : ROUGE attendu sur chaque
//                              groupe qui dépend de la migration 5 ou 6 ;
//   gestion-en-ligne           la même sans rien d'injecté, après l'application réelle (un groupe dont la fonction manque est
//                              sauté, avec une ligne d'information).
//   contact-1, contact-2, contact-3, contact-4, contact-5   preuve de la partie n du chantier « espace contact » (tests/sql/contact-annuaire-preuve.sql,
//                              contact-demandes-preuve.sql, contact-absences-preuve.sql, contact-correctifs-preuve.sql : la migration 4 de
//                              correctifs, 20261116_contact_4_correctifs ; contact-donnees-preuve.sql : la migration 5 des données sensibles,
//                              20261118_contact_5_donnees_sensibles, qui demande aussi la migration _demo (20261115_contact_demo, son
//                              préalable : injectée avant la 4 comme en production, son retour après le retour 4) ; aides communes : roles-aides.sql, titres-aides.sql
//                              puis contact-aides.sql) : les migrations 20261115_contact_1 à _n injectées dans l'ordre (l'étape 1 = la 1
//                              puis la 1b, fermeture de la lecture directe ; retours 1b puis 1), la preuve de la
//                              partie n jouée, puis les retours n à 1 ; le groupe retour compare l'empreinte d'après les retours à celle
//                              d'avant ; une étape demandée dont un fichier manque arrête l'assemblage (code 1, son nom) ;
//   contact-n-contre-epreuve   la même preuve avec les migrations 1 à n-1 injectées (et le préalable de la n : la _demo pour la 5), la n et
//                              son retour neutralisés (select 1, non lus) :
//                              ROUGE attendu sur les seuls contrôles de la partie n ;
//   contact-n-en-ligne         la même sans rien d'injecté, après l'application réelle des migrations 1 à n.
//   suite [--etapes 7|7,8|7,8,9|8|8,9|9|4,9|4]  preuve de l'étape 3 du chantier (tests/sql/titres-suite-preuve.sql), jouée sur la base de
//                              la production (outils/base_locale/rejouer_suite.sh --production : titres 1, 2, 3, 5, 6) : les migrations
//                              demandées (7, 8 et 9 par défaut ; 4,9 : le journal puis le catalogue, l'essai à blanc de l'étape 4)
//                              puis leurs retours (9, 8, 7, 4) ; la 4 s'injecte juste avant la 9. Les étapes non demandées sont
//                              neutralisées et non lues ; une étape demandée dont un fichier manque arrête l'assemblage ; une suite qui
//                              commence après la 7 suppose les précédentes déjà appliquées (la preuve le vérifie et refuse sinon) ;
//   suite-contre-epreuve       la même preuve sans aucune migration ni retour (neutralisés, non lus) : chaque groupe est joué, ROUGE
//                              attendu sur ceux dont la migration manque ;
//   suite-en-ligne             la même sans rien d'injecté, après l'application réelle (un groupe dont la migration manque est
//                              sauté, avec une ligne d'information).
//
// Option --compact (tous les modes) : retire du gabarit et des aides les lignes vides et les lignes de commentaire, pour
// une requête plus courte à transmettre (R27). Les textes injectés (migrations, retours, requête d'empreinte) restent
// intacts, octet pour octet, comme l'en-tête qui porte les md5 des fichiers. Le gabarit ne doit donc contenir ni ligne
// vide ni ligne de commentaire dans un littéral de données (le retrait changerait ce littéral) : un test le garde.
// L'assembleur affiche la longueur et le md5 du texte produit ; la preuve rend ceux de la requête qu'elle a reçue
// (suffixe de la passerelle MCP retiré), ce qui montre que la base a reçu exactement ce fichier.
//
// Usage : node outils/assembler_repetition_roles.mjs <mode> [--etapes 1,2] [--compact] <sortie.sql>
// La sortie, jetable, s'écrit hors du dépôt ; elle se joue ensuite en une requête (MCP execute_sql).
// Tests : tests/assembler-roles.test.mjs.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Racine du dépôt : le dossier parent de outils/. */
export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const GABARIT_1 = "tests/sql/roles-1-preuve.sql";
const GABARIT_ROLES = "tests/sql/roles-preuve.sql";
const GABARIT_ESPACES = "tests/sql/espaces-preuve.sql";
const GABARIT_DONNEES = "tests/sql/espaces-donnees-preuve.sql";
const GABARIT_TITRES = "tests/sql/titres-preuve.sql";
const GABARIT_GESTION = "tests/sql/titres-gestion-preuve.sql";
const GABARIT_SUITE = "tests/sql/titres-suite-preuve.sql";

/** Chantier « espace contact » : cinq migrations (annuaire, demandes, absences, correctifs, données sensibles), chacune avec son retour, et la preuve de chaque partie. */
export const ETAPES_CONTACT = {
  // L'étape 1 porte deux migrations : la 1 (annuaire) puis la 1b (fermeture de la lecture directe de contacts, appliquée en production
  // après la fusion de l'app) ; les gabarits injectent la 1 puis la 1b, et les retours 1b puis 1. Elles vont toujours ensemble dans les
  // modes : injectées toutes deux, ou neutralisées toutes deux.
  1: { migration: "supabase/migrations/20261115_contact_1_annuaire.sql",
       retour: "supabase/migrations/20261115_contact_1_annuaire_retour.sql",
       suite: { migration: "supabase/migrations/20261115_contact_1b_fermeture.sql",
                retour: "supabase/migrations/20261115_contact_1b_fermeture_retour.sql" },
       gabarit: "tests/sql/contact-annuaire-preuve.sql" },
  2: { migration: "supabase/migrations/20261115_contact_2_demandes.sql",
       retour: "supabase/migrations/20261115_contact_2_demandes_retour.sql",
       gabarit: "tests/sql/contact-demandes-preuve.sql" },
  3: { migration: "supabase/migrations/20261115_contact_3_absences.sql",
       retour: "supabase/migrations/20261115_contact_3_absences_retour.sql",
       gabarit: "tests/sql/contact-absences-preuve.sql" },
  4: { migration: "supabase/migrations/20261116_contact_4_correctifs.sql",
       retour: "supabase/migrations/20261116_contact_4_correctifs_retour.sql",
       gabarit: "tests/sql/contact-correctifs-preuve.sql" },
  // La 5 demande la migration _demo (appliquée en production entre la 3 et la 4, données fictives seulement) : son préalable, injecté
  // par le gabarit de la 5 avant la 4 (retour après le retour 4). La contre-épreuve de la 5 l'injecte aussi (état de la production) ;
  // le mode en ligne le neutralise avec le reste.
  5: { migration: "supabase/migrations/20261118_contact_5_donnees_sensibles.sql",
       retour: "supabase/migrations/20261118_contact_5_donnees_sensibles_retour.sql",
       prealable: { migration: "supabase/migrations/20261115_contact_demo.sql",
                    retour: "supabase/migrations/20261115_contact_demo_retour.sql" },
       gabarit: "tests/sql/contact-donnees-preuve.sql" },
};
const NUMEROS_CONTACT = [1, 2, 3, 4, 5];
/** Le préalable d'une étape du chantier contact (la _demo pour la 5) : sa migration et son retour, ou rien. */
const prealableContact = (n) => (ETAPES_CONTACT[n].prealable ? [ETAPES_CONTACT[n].prealable.migration, ETAPES_CONTACT[n].prealable.retour] : []);
/** Les fichiers d'une liste d'étapes du chantier contact, étape par étape : la migration, son retour, ceux de sa suite (1b), puis ceux
 *  de son préalable (_demo). */
const fichiersContact = (etapes) => etapes.flatMap((n) => {
  const e = ETAPES_CONTACT[n];
  return [e.migration, e.retour, ...(e.suite ? [e.suite.migration, e.suite.retour] : []), ...prealableContact(n)];
});

/** Lot 5, étape 1 : la migration du siège et son retour. */
export const MIGRATION_ESPACES = { migration: "supabase/migrations/20261108_espaces_1_siege.sql",
                                   retour: "supabase/migrations/20261108_espaces_1_siege_retour.sql" };

/** Lot 5, étape 2 : la migration de l'équipe et son retour. */
export const MIGRATION_ESPACES_2 = { migration: "supabase/migrations/20261108_espaces_2_equipe.sql",
                                     retour: "supabase/migrations/20261108_espaces_2_equipe_retour.sql" };

/** Lot 5, étape 3 : la migration de l'habillage par défaut du centre et du réseau, et son retour. */
export const MIGRATION_ESPACES_3 = { migration: "supabase/migrations/20261108_espaces_3_habillage.sql",
                                     retour: "supabase/migrations/20261108_espaces_3_habillage_retour.sql" };

/** Lot 5, suite (étape 4) : l'ancien stagiaire invité au personnel et les données personnelles de la direction, avec le retour. */
export const MIGRATION_ESPACES_4 = { migration: "supabase/migrations/20261111_espaces_4_donnees.sql",
                                     retour: "supabase/migrations/20261111_espaces_4_donnees_retour.sql" };

/** Les trois étapes du lot : la migration et son retour. */
export const ETAPES = {
  1: { migration: "supabase/migrations/20261028_roles_1_fondations.sql",
       retour: "supabase/migrations/20261028_roles_1_fondations_retour.sql" },
  2: { migration: "supabase/migrations/20261028_roles_2_fonctions.sql",
       retour: "supabase/migrations/20261028_roles_2_fonctions_retour.sql" },
  3: { migration: "supabase/migrations/20261028_roles_3_regles.sql",
       retour: "supabase/migrations/20261028_roles_3_regles_retour.sql" },
};

/** Chantier titres et droits à la carte : les quatre migrations du chantier, chacune avec son retour. */
export const ETAPES_TITRES = {
  1: { migration: "supabase/migrations/20261112_titres_1_tables.sql",
       retour: "supabase/migrations/20261112_titres_1_tables_retour.sql" },
  2: { migration: "supabase/migrations/20261112_titres_2_gestes.sql",
       retour: "supabase/migrations/20261112_titres_2_gestes_retour.sql" },
  3: { migration: "supabase/migrations/20261112_titres_3_regles.sql",
       retour: "supabase/migrations/20261112_titres_3_regles_retour.sql" },
  4: { migration: "supabase/migrations/20261112_titres_4_journal.sql",
       retour: "supabase/migrations/20261112_titres_4_journal_retour.sql" },
};
const NB_ETAPES_TITRES = 4;
const TOUS_TITRES = Object.values(ETAPES_TITRES).flatMap((e) => [e.migration, e.retour]);

/** Étape 2 du chantier : la preuve de gestion peut injecter la migration 4 (journal), la 5 (fermetures) et la 6 (gestion). */
export const ETAPES_GESTION = {
  4: ETAPES_TITRES[4],
  5: { migration: "supabase/migrations/20261112_titres_5_fermetures.sql",
       retour: "supabase/migrations/20261112_titres_5_fermetures_retour.sql" },
  6: { migration: "supabase/migrations/20261112_titres_6_gestion.sql",
       retour: "supabase/migrations/20261112_titres_6_gestion_retour.sql" },
};
const NUMEROS_GESTION = [4, 5, 6];
/** Les suites admises : la 6 s'appuie sur la 5, la 4 sur les deux autres (ordre d'application : 5, 6, puis 4 avec les conditions). */
const SUITES_GESTION = [[5], [6], [5, 6], [4, 5, 6]];
const SUITE_PAR_DEFAUT_GESTION = [5, 6];
const TOUS_GESTION = NUMEROS_GESTION.flatMap((n) => [ETAPES_GESTION[n].migration, ETAPES_GESTION[n].retour]);

/** Étape 3 du chantier : la preuve de la suite injecte les migrations 7 (correctifs), 8 (aperçu par titre), 9 (catalogue) et,
 *  pour l'essai à blanc de l'étape 4, la 4 (journal), juste avant la 9. */
export const ETAPES_SUITE = {
  4: ETAPES_TITRES[4],
  7: { migration: "supabase/migrations/20261115_titres_7_correctifs.sql",
       retour: "supabase/migrations/20261115_titres_7_correctifs_retour.sql" },
  8: { migration: "supabase/migrations/20261115_titres_8_apercu.sql",
       retour: "supabase/migrations/20261115_titres_8_apercu_retour.sql" },
  9: { migration: "supabase/migrations/20261115_titres_9_catalogue.sql",
       retour: "supabase/migrations/20261115_titres_9_catalogue_retour.sql" },
};
const NUMEROS_SUITE = [7, 8, 4, 9]; // l'ordre d'application : la 4 juste avant la 9
/** Les suites admises : 7, 8, 9 s'appliquent dans cet ordre (une suite qui commence après la 7 suppose les précédentes en place) ;
 *  4,9 est l'essai à blanc de l'étape 4 (journal, puis catalogue), sur une base où 7 et 8 sont appliquées. */
const SUITES_SUITE = [[7], [7, 8], [7, 8, 9], [8], [8, 9], [9], [4, 9], [4]];
const SUITE_PAR_DEFAUT = [7, 8, 9];
const TOUS_SUITE = NUMEROS_SUITE.flatMap((n) => [ETAPES_SUITE[n].migration, ETAPES_SUITE[n].retour]);

/** Les modes : le gabarit et, soit les injections à neutraliser (preuve de l'étape 1), soit les étapes à injecter
 *  (preuve rôle par rôle, les autres étapes étant neutralisées). */
export const MODES = {
  "etape-1": { gabarit: GABARIT_1, neutres: [] },
  "etape-1-sans": { gabarit: GABARIT_1, neutres: [ETAPES[1].migration, ETAPES[1].retour] },
  "repetition": { gabarit: GABARIT_ROLES, etapes: [1, 2, 3], etapesAuChoix: true },
  "contre-epreuve": { gabarit: GABARIT_ROLES, etapes: [1], libelle: "contre-epreuve (étape 1 seule)" },
  "en-ligne": { gabarit: GABARIT_ROLES, etapes: [], libelle: "en-ligne (aucune migration injectée)" },
  // Lot 5 : les migrations se neutralisent comme à l'étape 1 de la preuve du lot 4 ; le gabarit porte un marqueur de mode,
  // d'où un libellé (sans apostrophe : il s'écrit en littéral SQL).
  "espaces": { gabarit: GABARIT_ESPACES, neutres: [], libelle: "espaces (migrations siège, équipe et habillage injectées)" },
  "espaces-contre-epreuve": { gabarit: GABARIT_ESPACES,
                              neutres: [MIGRATION_ESPACES.migration, MIGRATION_ESPACES.retour, MIGRATION_ESPACES_2.migration, MIGRATION_ESPACES_2.retour,
                                        MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                              libelle: "espaces-contre-epreuve (aucune migration injectée)" },
  "espaces-contre-epreuve-2": { gabarit: GABARIT_ESPACES, neutres: [MIGRATION_ESPACES_2.migration, MIGRATION_ESPACES_2.retour, MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                                libelle: "espaces-contre-epreuve-2 (migrations équipe et habillage non injectées)" },
  "espaces-contre-epreuve-3": { gabarit: GABARIT_ESPACES, neutres: [MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                                libelle: "espaces-contre-epreuve-3 (migration habillage non injectée)" },
  // Lot 5, suite : preuve à part (tests/sql/espaces-donnees-preuve.sql), jouée après les migrations 1 à 3 du lot 5.
  "donnees": { gabarit: GABARIT_DONNEES, neutres: [], libelle: "donnees (migration 4 injectee)" },
  "donnees-contre-epreuve": { gabarit: GABARIT_DONNEES, neutres: [MIGRATION_ESPACES_4.migration, MIGRATION_ESPACES_4.retour],
                              libelle: "donnees-contre-epreuve (migration 4 non injectee)" },
  "donnees-en-ligne": { gabarit: GABARIT_DONNEES, neutres: [MIGRATION_ESPACES_4.migration, MIGRATION_ESPACES_4.retour],
                        libelle: "donnees-en-ligne (aucune migration injectee)" },
  // Chantier titres : preuve à part, jouée après la suite du lot 5. Le mode « titres » décide des étapes injectées selon les
  // fichiers présents (ou --etapes) ; les deux autres neutralisent tout.
  "titres": { gabarit: GABARIT_TITRES, titres: true, etapesAuChoix: true },
  "titres-contre-epreuve": { gabarit: GABARIT_TITRES, neutres: TOUS_TITRES, libelle: "titres-contre-epreuve (aucune migration injectee)" },
  "titres-en-ligne": { gabarit: GABARIT_TITRES, neutres: TOUS_TITRES, libelle: "titres-en-ligne (aucune migration injectee)" },
  // Étape 2 du chantier : preuve à part (tests/sql/titres-gestion-preuve.sql), jouée sur la base de la production (migrations 1, 2, 3).
  "gestion": { gabarit: GABARIT_GESTION, gestion: true, etapesAuChoix: true },
  "gestion-contre-epreuve": { gabarit: GABARIT_GESTION, neutres: TOUS_GESTION, libelle: "gestion-contre-epreuve (aucune migration injectee)" },
  "gestion-en-ligne": { gabarit: GABARIT_GESTION, neutres: TOUS_GESTION, libelle: "gestion-en-ligne (aucune migration injectee)" },
  // Chantier « espace contact » : la preuve de la partie n injecte les migrations 1 à n (variante plein), 1 à n-1 (contre-épreuve : la n
  // et son retour sont neutralisés) ou aucune (en ligne). Libellés sans apostrophe ni dollar : ils s'écrivent en littéral SQL.
  ...Object.fromEntries(NUMEROS_CONTACT.flatMap((n) => [
    [`contact-${n}`, { gabarit: ETAPES_CONTACT[n].gabarit, contact: n, variante: "plein" }],
    [`contact-${n}-contre-epreuve`, { gabarit: ETAPES_CONTACT[n].gabarit, contact: n, variante: "contre" }],
    [`contact-${n}-en-ligne`, { gabarit: ETAPES_CONTACT[n].gabarit, contact: n, variante: "en-ligne" }],
  ])),
  // Étape 3 du chantier : preuve à part (tests/sql/titres-suite-preuve.sql), jouée sur la base de la production (rejouer_suite.sh --production).
  "suite": { gabarit: GABARIT_SUITE, suite: true, etapesAuChoix: true },
  "suite-contre-epreuve": { gabarit: GABARIT_SUITE, neutres: TOUS_SUITE, libelle: "suite-contre-epreuve (aucune migration injectee)" },
  "suite-en-ligne": { gabarit: GABARIT_SUITE, neutres: TOUS_SUITE, libelle: "suite-en-ligne (aucune migration injectee)" },
  "espaces-en-ligne": { gabarit: GABARIT_ESPACES,
                        neutres: [MIGRATION_ESPACES.migration, MIGRATION_ESPACES.retour, MIGRATION_ESPACES_2.migration, MIGRATION_ESPACES_2.retour,
                                  MIGRATION_ESPACES_3.migration, MIGRATION_ESPACES_3.retour],
                        libelle: "espaces-en-ligne (aucune migration injectée)" },
};

export const USAGE = `node outils/assembler_repetition_roles.mjs <mode> [--etapes 1,2] [--compact] <sortie.sql>   (modes : ${Object.keys(MODES).join(", ")})`;

/** Ce qui remplace une injection neutralisée : un littéral inoffensif, que execute joue sans effet. */
export const NEUTRE = "'select 1'";

const LIGNE_MARQUEUR = /^(\s*)--\s*@@(.*)$/; // une ligne de commentaire qui commence par @@ : un marqueur
const FORME = /^(INJECTER|INCLURE) (\S+)@@\s*$/; // la forme admise d'une injection ou d'une inclusion
const FORME_MODE = /^MODE@@\s*$/; // la forme admise du marqueur de mode
const FORME_CAS = /^CAS_ROUTAGE@@\s*$/; // la forme admise du marqueur de la table de cas du routage (espace contact)
const MOTS = ["INJECTER", "INCLURE", "MODE", "CAS_ROUTAGE"];
const MOT_CLE = /@@(?:INJECTER|INCLURE|MODE|CAS_ROUTAGE)\b/; // un mot-clé de marqueur ailleurs dans une ligne : marqueur mal placé
/** La table de cas du routage des demandes (espace contact), commune au test node et à la preuve SQL : le marqueur
 *  -- @@CAS_ROUTAGE@@ devient son texte JSON (sur une ligne) en littéral jsonb. */
export const CAS_ROUTAGE = "tests/fixtures/contact-routage.json";
const DELIMITEUR = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/g; // délimiteurs dollar ($$, $tag$)
const LIBELLE = /^[\p{L}\p{N} ,()'.:_-]+$/u; // un libellé de mode : une ligne de texte simple, sans dollar
const VIDE_OU_COMMENTAIRE = /^\s*(?:--.*)?$/; // une ligne vide, ou qui ne porte qu'un commentaire (--)

const sansRetourChariot = (texte) => texte.replace(/\r/g, "");

/** md5 hexadécimal d'un texte (UTF-8), celui que rend md5() en SQL. */
export const md5 = (texte) => createHash("md5").update(texte, "utf8").digest("hex");

/** Les lignes d'un texte, sans les lignes vides ni les lignes de commentaire : le compactage d'un gabarit ou d'aides. */
export const sansVidesNiCommentaires = (texte) => texte.split("\n").filter((ligne) => !VIDE_OU_COMMENTAIRE.test(ligne));

/** Un chemin depuis la racine du dépôt : relatif, en barres obliques, sans segment vide, « . » ni « .. ». */
function cheminValide(chemin) {
  return /^[A-Za-z0-9_.\-/]+$/.test(chemin) && !isAbsolute(chemin)
    && chemin.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** Le délimiteur des littéraux : $injection$, ou $injection_1$, $injection_2$… s'il figure déjà dans le gabarit ou dans
 *  un fichier assemblé, ou si un texte injecté se terminait de façon à le former avec le délimiteur fermant. */
function choisirDelimiteur(textes, injectes) {
  for (let k = 0; ; k++) {
    const d = k === 0 ? "$injection$" : `$injection_${k}$`;
    if (textes.some((t) => t.includes(d))) continue;
    if (injectes.some((t) => (t + d).indexOf(d) !== t.length)) continue;
    return d;
  }
}

/** Les fichiers des étapes données, étape par étape : la migration, puis son retour. */
export function lireEtapes(etapes) {
  return etapes.flatMap((n) => [ETAPES[n].migration, ETAPES[n].retour]);
}

/** Les étapes admises : chacune s'appuie sur la précédente (1 ; 1, 2 ; 1, 2, 3 ; au plus `max`). */
function etapesValides(etapes, max = 3) {
  return Array.isArray(etapes) && etapes.length >= 1 && etapes.length <= max && etapes.every((n, i) => n === i + 1);
}

/** Les fichiers des étapes du chantier titres, étape par étape : la migration, puis son retour. */
export function lireEtapesTitres(etapes) {
  return etapes.flatMap((n) => [ETAPES_TITRES[n].migration, ETAPES_TITRES[n].retour]);
}

/**
 * Ce qu'un mode assemble : { gabarit, neutres, etapes, mode, requis }. `mode` est le libellé écrit à la place du
 * marqueur de mode (nul pour les modes de l'étape 1), `requis` les fichiers qui doivent exister. Lève une Error au
 * message clair pour un mode inconnu ou des étapes refusées.
 */
export function decrireMode(mode, { etapes } = {}) {
  const d = MODES[mode];
  if (!d) throw new Error(`Mode inconnu « ${mode} » (modes : ${Object.keys(MODES).join(", ")}).`);
  if (etapes !== undefined && !d.etapesAuChoix) {
    throw new Error(`--etapes ne vaut que pour le mode repetition, titres, gestion ou suite (mode demandé : ${mode}).`);
  }
  if (d.contact) {
    const n = d.contact;
    const injectees = d.variante === "plein" ? NUMEROS_CONTACT.slice(0, n) : d.variante === "contre" ? NUMEROS_CONTACT.slice(0, n - 1) : [];
    const libelle = d.variante === "plein" ? `${mode} (migrations 1 a ${n} injectees)`
      : d.variante === "contre" ? `${mode} (migration ${n} non injectee)`
      : `${mode} (aucune migration injectee)`;
    // La contre-épreuve garde le préalable de la n injecté (l'état de la production d'avant la n) ; le mode en ligne neutralise tout.
    const garde = d.variante === "contre" ? prealableContact(n) : [];
    return { gabarit: d.gabarit, contact: n, injectees,
             neutres: fichiersContact(NUMEROS_CONTACT.slice(0, n).filter((k) => !injectees.includes(k))).filter((f) => !garde.includes(f)),
             etapes: null, mode: libelle, requis: [] };
  }
  if (d.gestion) {
    const choisies = etapes ?? SUITE_PAR_DEFAUT_GESTION;
    if (!SUITES_GESTION.some((suite) => suite.join(",") === choisies.join(","))) {
      throw new Error(`étapes refusées : « ${choisies.join(",")} » (attendu : 5, 6, 5,6 ou 4,5,6 ; la 6 seule suppose la 5 déjà appliquée sur la base, la 4 demande la 5 et la 6).`);
    }
    return { gabarit: d.gabarit, gestion: true, etapesGestion: choisies, neutres: [], etapes: null, mode: null, requis: [] };
  }
  if (d.suite) {
    const choisies = etapes ?? SUITE_PAR_DEFAUT;
    if (!SUITES_SUITE.some((suite) => suite.join(",") === choisies.join(","))) {
      throw new Error(`étapes refusées : « ${choisies.join(",")} » (attendu : 7, 7,8, 7,8,9, 8, 8,9, 9, 4,9 ou 4 ; 7, 8 et 9 s'appliquent dans cet ordre, une suite qui commence après la 7 suppose les précédentes déjà appliquées sur la base ; 4,9 : le journal puis le catalogue ; 4 seule : le journal sur une base où la 9 est déjà appliquée).`);
    }
    return { gabarit: d.gabarit, suite: true, etapesSuite: choisies, neutres: [], etapes: null, mode: null, requis: [] };
  }
  if (d.titres) {
    if (etapes !== undefined && !etapesValides(etapes, NB_ETAPES_TITRES)) {
      throw new Error(`étapes refusées : « ${etapes.join(",")} » (attendu : 1, 1,2, 1,2,3 ou 1,2,3,4 ; chaque étape s'appuie sur la précédente).`);
    }
    // Les fichiers présents se jugent sur le disque, dans assemblerMode : ici, seulement ce que l'appelant a demandé.
    return { gabarit: d.gabarit, titres: true, etapesTitres: etapes ?? [1, 2, 3, 4], neutres: [], etapes: null, mode: null, requis: [] };
  }
  if (!d.etapes) return { gabarit: d.gabarit, neutres: d.neutres, etapes: null, mode: d.libelle ?? null, requis: [] };
  const choisies = etapes ?? d.etapes;
  if (etapes !== undefined && !etapesValides(choisies)) {
    throw new Error(`étapes refusées : « ${choisies.join(",")} » (attendu : 1, 1,2 ou 1,2,3 ; chaque étape s'appuie sur la précédente).`);
  }
  const absentes = [1, 2, 3].filter((n) => !choisies.includes(n));
  const libelle = d.libelle ?? `${mode} (${choisies.length === 1 ? "étape" : "étapes"} ${choisies.join(", ")})`;
  return { gabarit: d.gabarit, neutres: lireEtapes(absentes), etapes: choisies, mode: libelle, requis: lireEtapes(choisies) };
}

/**
 * Assemble un gabarit. Pure : aucune lecture de disque, `lire(chemin)` rend le texte d'un fichier (chemin depuis la
 * racine du dépôt) ou null s'il n'existe pas. `nom` désigne le gabarit dans les messages ; `neutres` liste les chemins
 * dont les injections deviennent le littéral 'select 1' (le fichier n'est pas lu) ; `mode` est le libellé écrit à la
 * place du marqueur de mode (obligatoire si le gabarit en porte un, interdit sinon) ; `compact` retire du gabarit et des
 * fichiers inclus les lignes vides et les lignes de commentaire (les marqueurs, eux, sont traités d'abord ; les textes
 * injectés restent intacts, l'en-tête aussi, avec une ligne de plus qui dit le compactage).
 * Le marqueur -- @@CAS_ROUTAGE@@ (au plus un) devient le texte de CAS_ROUTAGE, sur une ligne, en littéral jsonb.
 * Rend { texte, injections: [{ chemin, delimiteur, md5 }], inclusions: [{ chemin, md5 }], neutralises: [chemin], mode, cas,
 * compact, longueur (caractères), octets (UTF-8), md5 (du texte produit) }, dans l'ordre du gabarit ; lève une Error au
 * message clair sur tout écart.
 */
export function assembler(gabarit, lire, { nom = "gabarit", neutres = [], mode = null, compact = false } = {}) {
  const modele = sansRetourChariot(gabarit);
  const lignes = modele.split("\n");

  // 1. Les marqueurs : seuls sur leur ligne, d'une forme connue, vers un chemin du dépôt.
  const marqueurs = new Map();
  let ligneMode = null;
  let ligneCas = null;
  lignes.forEach((ligne, i) => {
    const m = LIGNE_MARQUEUR.exec(ligne);
    if (!m) {
      if (MOT_CLE.test(ligne)) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur mal placé, il doit être seul sur sa ligne (-- @@INJECTER <chemin>@@).`);
      }
      return;
    }
    if (FORME_MODE.test(m[2])) {
      if (ligneMode !== null) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur de mode en double (déjà ligne ${ligneMode + 1}).`);
      }
      ligneMode = i;
      marqueurs.set(i, { retrait: m[1], sorte: "MODE" });
      return;
    }
    if (FORME_CAS.test(m[2])) {
      if (ligneCas !== null) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur de la table de cas en double (déjà ligne ${ligneCas + 1}).`);
      }
      ligneCas = i;
      marqueurs.set(i, { retrait: m[1], sorte: "CAS" });
      return;
    }
    const forme = FORME.exec(m[2]);
    if (!forme) {
      const mot = /^\w*/.exec(m[2])[0];
      if (!MOTS.includes(mot)) {
        throw new Error(`${nom}, ligne ${i + 1} : marqueur inconnu « @@${mot} » (connus : -- @@INJECTER <chemin>@@, -- @@INCLURE <chemin>@@, -- @@MODE@@ et -- @@CAS_ROUTAGE@@).`);
      }
      const attendu = mot === "MODE" || mot === "CAS_ROUTAGE" ? `-- @@${mot}@@` : `-- @@${mot} <chemin>@@`;
      throw new Error(`${nom}, ligne ${i + 1} : marqueur mal formé « ${ligne.trim()} » (attendu : ${attendu}, seul sur sa ligne).`);
    }
    const [, sorte, chemin] = forme;
    if (!cheminValide(chemin)) {
      throw new Error(`${nom}, ligne ${i + 1} : chemin « ${chemin} » refusé (relatif à la racine du dépôt, sans « . » ni « .. »).`);
    }
    marqueurs.set(i, { retrait: m[1], sorte, chemin });
  });
  if (ligneMode !== null && mode == null) {
    throw new Error(`${nom}, ligne ${ligneMode + 1} : marqueur de mode, mais aucun mode donné (le libellé du mode s'écrit à sa place).`);
  }
  if (mode != null && ligneMode === null) {
    throw new Error(`Mode mal décrit : ${nom} n'a pas de marqueur -- @@MODE@@ ; le mode « ${mode} » n'aurait nulle part où s'écrire.`);
  }
  if (mode != null && !LIBELLE.test(mode)) {
    throw new Error(`libellé de mode refusé « ${mode} » : une ligne de lettres, chiffres, espaces et ponctuation simple, sans dollar.`);
  }
  const liste = [...marqueurs.values()].filter((m) => m.sorte !== "MODE" && m.sorte !== "CAS");
  for (const chemin of neutres) {
    if (!liste.some((m) => m.sorte === "INJECTER" && m.chemin === chemin)) {
      throw new Error(`Mode mal décrit : ${chemin} est à neutraliser, mais ${nom} ne l'injecte nulle part.`);
    }
  }

  // 2. Les fichiers, lus une fois chacun, retours chariot retirés (les neutralisés ne sont pas lus).
  const textes = new Map();
  for (const m of liste) {
    if (textes.has(m.chemin) || (m.sorte === "INJECTER" && neutres.includes(m.chemin))) continue;
    const texte = lire(m.chemin);
    if (texte == null) throw new Error(`Fichier introuvable : ${m.chemin} (marqueur @@${m.sorte} de ${nom}).`);
    textes.set(m.chemin, sansRetourChariot(texte));
  }
  const injectes = liste.filter((m) => m.sorte === "INJECTER" && !neutres.includes(m.chemin));
  const inclus = liste.filter((m) => m.sorte === "INCLURE");

  // 3. Un fichier inclus est collé tel quel : un marqueur y resterait sans être traité.
  for (const m of inclus) {
    const ligne = textes.get(m.chemin).split("\n").findIndex((l) => LIGNE_MARQUEUR.test(l) || MOT_CLE.test(l));
    if (ligne >= 0) {
      throw new Error(`${m.chemin}, ligne ${ligne + 1} : marqueur dans un fichier inclus ; les marqueurs ne se traitent que dans le gabarit.`);
    }
  }

  // 4. Collisions : un délimiteur du gabarit présent dans un texte injecté fermerait le bloc qui entoure le littéral.
  const delimiteursGabarit = new Set(modele.match(DELIMITEUR) ?? []);
  for (const m of injectes) {
    for (const d of delimiteursGabarit) {
      if (textes.get(m.chemin).includes(d)) {
        throw new Error(`Collision de délimiteur : ${d} figure dans ${m.chemin} et dans ${nom} ; injecté, le texte fermerait le bloc qui l'entoure.`);
      }
    }
  }
  // 4 bis. La table de cas du routage : lue, jugée (du JSON), récrite sur une ligne ; elle ne doit fermer aucun bloc du gabarit.
  let cas = null;
  if (ligneCas !== null) {
    const brut = lire(CAS_ROUTAGE);
    if (brut == null) throw new Error(`Fichier introuvable : ${CAS_ROUTAGE} (marqueur @@CAS_ROUTAGE de ${nom}).`);
    let lu;
    try {
      lu = JSON.parse(brut);
    } catch (e) {
      throw new Error(`${CAS_ROUTAGE} : JSON illisible (${e.message}).`);
    }
    const ligne = JSON.stringify(lu);
    for (const d of delimiteursGabarit) {
      if (ligne.includes(d)) throw new Error(`Collision de délimiteur : ${d} figure dans ${CAS_ROUTAGE} et dans ${nom}.`);
    }
    cas = { chemin: CAS_ROUTAGE, ligne, md5: md5(sansRetourChariot(brut)) };
  }
  const delimiteur = choisirDelimiteur([modele, ...textes.values(), ...(cas ? [cas.ligne] : [])],
    [...injectes.map((m) => textes.get(m.chemin)), ...(cas ? [cas.ligne] : [])]);

  // 5. L'assemblage, précédé d'un en-tête qui dit d'où il vient (md5 des textes, pour rapprocher un verdict d'un état
  //    du dépôt).
  const injections = [];
  const inclusions = [];
  const neutralises = [];
  const corps = [];
  lignes.forEach((ligne, i) => {
    const m = marqueurs.get(i);
    if (!m) {
      if (!compact || !VIDE_OU_COMMENTAIRE.test(ligne)) corps.push(ligne);
      return;
    }
    if (m.sorte === "MODE") {
      corps.push(`${m.retrait}'${mode.replace(/'/g, "''")}'`);
    } else if (m.sorte === "CAS") {
      corps.push(`${m.retrait}${delimiteur}${cas.ligne}${delimiteur}::jsonb`);
    } else if (m.sorte === "INCLURE") {
      inclusions.push({ chemin: m.chemin, md5: md5(textes.get(m.chemin)) });
      if (!compact) {
        corps.push(textes.get(m.chemin));
      } else {
        const gardees = sansVidesNiCommentaires(textes.get(m.chemin));
        if (gardees.length > 0) corps.push(gardees.join("\n"));
      }
    } else if (neutres.includes(m.chemin)) {
      neutralises.push(m.chemin);
      corps.push(m.retrait + NEUTRE);
    } else {
      const texte = textes.get(m.chemin);
      injections.push({ chemin: m.chemin, delimiteur, md5: md5(texte) });
      corps.push(m.retrait + delimiteur + texte + delimiteur);
    }
  });
  const entete = [
    `-- Fichier assemblé par outils/assembler_repetition_roles.mjs depuis ${nom} : ne pas le modifier, le réassembler.`,
    ...(mode != null ? [`-- mode : ${mode}`] : []),
    ...(compact ? ["-- compact : lignes vides et de commentaire du gabarit et des aides retirées, textes injectés intacts"] : []),
    ...inclusions.map((x) => `-- inclus : ${x.chemin} (md5 ${x.md5})`),
    ...injections.map((x) => `-- injecté : ${x.chemin} (md5 ${x.md5})`),
    ...neutralises.map((chemin) => `-- neutralisé : ${chemin} (remplacé par un select 1 sans effet)`),
    ...(cas ? [`-- cas de routage : ${cas.chemin} (md5 ${cas.md5})`] : []),
  ];
  const texte = [...entete, ...corps].join("\n");
  return {
    texte, injections, inclusions, neutralises, mode, compact, cas: cas ? { chemin: cas.chemin, md5: cas.md5 } : null,
    longueur: Array.from(texte).length, // en caractères (points de code), comme length() en SQL
    octets: Buffer.byteLength(texte, "utf8"), md5: md5(texte),
  };
}

/**
 * Assemble le gabarit d'un mode, en lisant les fichiers sous `racine` (la racine du dépôt par défaut), ou par
 * `lire(chemin)` s'il est donné (tests). `etapes` : les étapes du mode repetition (1, 2, 3 par défaut). Une étape
 * demandée dont la migration ou le retour manque arrête l'assemblage, en disant quoi jouer en attendant. `compact` :
 * voir assembler().
 */
export function assemblerMode(mode, racine = RACINE, { etapes, lire, compact = false } = {}) {
  const decrit = decrireMode(mode, { etapes });
  const lireFichier = lire ?? ((chemin) => {
    const fichier = resolve(racine, chemin);
    return existsSync(fichier) ? readFileSync(fichier, "utf8") : null;
  });
  for (const n of decrit.etapes ?? []) {
    for (const chemin of lireEtapes([n])) {
      if (lireFichier(chemin) == null) {
        const pretes = [1, 2, 3].filter((k) => k < n);
        throw new Error(`Étape ${n} demandée (${mode}) : ${chemin} n'existe pas encore. En attendant : mode contre-epreuve, ou repetition --etapes ${pretes.join(",")}.`);
      }
    }
  }
  let { neutres, mode: libelle } = decrit;
  if (decrit.contact) {
    // Les étapes injectées se lisent : un fichier manquant (migration ou retour) arrête l'assemblage. Les autres sont neutralisées, non lues.
    for (const n of decrit.injectees) {
      for (const chemin of fichiersContact([n])) {
        if (lireFichier(chemin) == null) {
          throw new Error(`Étape ${n} demandée (${mode}) : ${chemin} n'existe pas encore. En attendant : mode contact-${decrit.contact}-en-ligne (rien d'injecté), ou la partie dont les fichiers existent.`);
        }
      }
    }
  }
  if (decrit.gestion) {
    // Les étapes demandées se lisent (un fichier manquant arrête l'assemblage) ; les autres sont neutralisées et ne sont jamais lues.
    for (const n of decrit.etapesGestion) {
      for (const chemin of [ETAPES_GESTION[n].migration, ETAPES_GESTION[n].retour]) {
        if (lireFichier(chemin) == null) {
          const pretes = NUMEROS_GESTION.filter((k) => k < n && k !== 4);
          throw new Error(`Étape ${n} demandée (${mode}) : ${chemin} n'existe pas encore. En attendant : mode gestion-contre-epreuve${pretes.length ? `, ou gestion --etapes ${pretes.join(",")}` : ""}.`);
        }
      }
    }
    neutres = NUMEROS_GESTION.filter((n) => !decrit.etapesGestion.includes(n)).flatMap((n) => [ETAPES_GESTION[n].migration, ETAPES_GESTION[n].retour]);
    libelle = decrit.etapesGestion.join(",") === "6"
      ? "gestion (etape 6 seule, la 5 en place)" // essai à blanc : la 5 est DÉJÀ appliquée sur la base, la preuve le vérifie et refuse sinon
      : `gestion (${decrit.etapesGestion.length === 1 ? "etape" : "etapes"} ${decrit.etapesGestion.join(", ")} injectees)`;
  }
  if (decrit.suite) {
    // Comme gestion : les étapes demandées se lisent (un fichier manquant arrête l'assemblage), les autres sont neutralisées sans être lues.
    for (const n of decrit.etapesSuite) {
      for (const chemin of [ETAPES_SUITE[n].migration, ETAPES_SUITE[n].retour]) {
        if (lireFichier(chemin) == null) {
          throw new Error(`Étape ${n} demandée (${mode}) : ${chemin} n'existe pas encore. En attendant : mode suite-contre-epreuve, ou suite-en-ligne sur une base où elle est appliquée.`);
        }
      }
    }
    neutres = NUMEROS_SUITE.filter((n) => !decrit.etapesSuite.includes(n)).flatMap((n) => [ETAPES_SUITE[n].migration, ETAPES_SUITE[n].retour]);
    libelle = `suite (${decrit.etapesSuite.length === 1 ? "etape" : "etapes"} ${decrit.etapesSuite.join(", ")} injectees)`;
  }
  if (decrit.titres) {
    // Étapes injectées : celles qu'on a demandées (un fichier manquant arrête alors l'assemblage), sinon celles dont la
    // migration et le retour existent déjà ; les autres sont neutralisées, sans être lues.
    const injectees = [];
    for (let n = 1; n <= NB_ETAPES_TITRES; n++) {
      const fichiers = lireEtapesTitres([n]);
      if (decrit.etapesTitres) {
        if (!decrit.etapesTitres.includes(n)) continue;
        for (const chemin of fichiers) {
          if (lireFichier(chemin) == null) {
            const pretes = [1, 2, 3, 4].filter((k) => k < n);
            throw new Error(`Étape ${n} demandée (${mode}) : ${chemin} n'existe pas encore. En attendant : mode titres-contre-epreuve, ou titres${pretes.length ? ` --etapes ${pretes.join(",")}` : ""}.`);
          }
        }
        injectees.push(n);
      } else if (fichiers.every((chemin) => lireFichier(chemin) != null)) {
        injectees.push(n);
      }
    }
    neutres = lireEtapesTitres([1, 2, 3, 4].filter((n) => !injectees.includes(n)));
    libelle = injectees.length === 0 ? "titres (aucune etape injectee)"
      : `titres (${injectees.length === 1 ? "etape" : "etapes"} ${injectees.join(", ")} injectees)`;
  }
  const gabarit = lireFichier(decrit.gabarit);
  if (gabarit == null) throw new Error(`Gabarit introuvable : ${decrit.gabarit}.`);
  return assembler(gabarit, lireFichier, { nom: decrit.gabarit, neutres, mode: libelle, compact });
}

/** Une liste d'étapes écrite en ligne de commande (« 1,2 ») ; la validité se juge dans decrireMode. */
function lireListeEtapes(texte) {
  if (!/^\d+(,\d+)*$/.test(texte ?? "")) {
    throw new Error(`étapes refusées : « ${texte ?? ""} » (attendu : 1, 1,2 ou 1,2,3 ; chaque étape s'appuie sur la précédente).`);
  }
  return texte.split(",").map(Number);
}

/** La ligne de commande : rend le code de sortie (0 si le fichier est écrit, 1 sinon). */
export function principal(argv, { racine = RACINE, journal = console.log, erreur = console.error } = {}) {
  const positionnels = [];
  let etapesTexte;
  let compact = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--etapes") {
      if (i + 1 >= argv.length) {
        erreur(`Usage : ${USAGE}`);
        return 1;
      }
      etapesTexte = argv[++i];
    } else if (a.startsWith("--etapes=")) {
      etapesTexte = a.slice("--etapes=".length);
    } else if (a === "--compact") {
      compact = true;
    } else {
      positionnels.push(a);
    }
  }
  if (positionnels.length !== 2 || positionnels.some((a) => a.startsWith("--"))) {
    erreur(`Usage : ${USAGE}`);
    return 1;
  }
  const [mode, sortie] = positionnels;
  try {
    const etapes = etapesTexte === undefined ? undefined : lireListeEtapes(etapesTexte);
    const cible = resolve(sortie);
    const chemin = relative(racine, cible);
    if (chemin === "" || (!isAbsolute(chemin) && chemin !== ".." && !chemin.startsWith(`..${sep}`))) {
      throw new Error(`sortie dans le dépôt refusée (${sortie}) : le fichier assemblé est jetable, l'écrire hors du dépôt.`);
    }
    if (!existsSync(dirname(cible))) throw new Error(`dossier de sortie introuvable : ${dirname(cible)}.`);
    const r = assemblerMode(mode, racine, { etapes, compact });
    writeFileSync(cible, r.texte);
    journal(`${mode} : ${cible}`);
    if (r.mode != null) journal(`  mode        ${r.mode}`);
    for (const x of r.inclusions) journal(`  inclus      ${x.chemin}  md5 ${x.md5}`);
    for (const x of r.injections) journal(`  injecté     ${x.chemin}  md5 ${x.md5}`);
    for (const chemin of r.neutralises) journal(`  neutralisé  ${chemin}`);
    if (r.cas) journal(`  cas         ${r.cas.chemin}  md5 ${r.cas.md5}`);
    // La taille et l'empreinte du texte produit : celles que la preuve doit rendre pour la requête qu'elle a reçue (la
    // passerelle MCP y ajoute un suffixe, que la preuve retire avant de hacher).
    if (compact) {
      const complet = assemblerMode(mode, racine, { etapes });
      journal(`  compact     ${r.longueur} caractères au lieu de ${complet.longueur} (lignes vides et de commentaire du gabarit et des aides retirées)`);
    }
    journal(`  texte       ${r.longueur} caractères, ${r.octets} octets, md5 ${r.md5}`);
    return 0;
  } catch (e) {
    erreur(`Assemblage refusé : ${e.message}`);
    return 1;
  }
}

const lance = process.argv[1] ? resolve(process.argv[1]) : "";
if (lance.toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  process.exitCode = principal(process.argv.slice(2));
}
