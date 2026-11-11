import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AIDE_APP, consignesApp } from "../supabase/functions/chatbot/aide.mjs";
import { entreesNavigation, barreTelephone } from "../js/nav-rules.js";
import { LIBELLES_ESPACE } from "../js/espaces-rules.js";

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");
const NOUVELLE = consignesApp("stagiaire");
// Les anciens noms n'ont leur place que dans la section qui dit où ils sont passés.
const [avantAnciensNoms, anciensNoms] = NOUVELLE.split("ANCIENS NOMS");

test("une seule navigation : stagiaires, formateurs, espace absent ou inattendu ont le même guide", () => {
  assert.equal(NOUVELLE, AIDE_APP);
  assert.equal(consignesApp("equipe"), AIDE_APP);
  for (const v of [undefined, null, "", "nouvelle", "ancienne", 1, true, {}, ["stagiaire"]]) {
    assert.equal(consignesApp(v), AIDE_APP, JSON.stringify(v));
  }
  assert.equal(consignesApp(), AIDE_APP);
});

test("le guide est substantiel et sans tiret cadratin", () => {
  assert.ok(NOUVELLE.length > 1500);
  assert.ok(!NOUVELLE.includes("—"));
  assert.ok(!NOUVELLE.includes("Prof"));
});

test("nouvelle navigation : les noms de la barre, du compte et des sous-onglets", () => {
  for (const nom of ["Accueil", "Planning", "Semaine", "Dates clés", "Ordre de passage", "Cours et QCM", "Thèmes", "Compétences",
    "Documents", "Mon suivi", "La classe", "CCP2", "Émargement", "Stagiaires", "Élèves bénévoles", "Notes et examens",
    "Questions contestées", "Question corrigée", "Pas d'erreur", "Indicateurs", "Réglages", "Plus", "Assistant", "Nouveautés", "Contacts du centre", "Mes préférences",
    "Recharger les données", "Se déconnecter", "Signaler un problème"]) {
    assert.ok(avantAnciensNoms.includes(nom), nom);
  }
});

test("nouvelle navigation : le guide nomme chaque entrée des deux barres, dans leur ordre", () => {
  for (const espace of ["stagiaire", "equipe"]) {
    const entrees = entreesNavigation(espace, { routeVisible: () => true, emargementActif: true });
    const titre = espace === "equipe" ? "BARRE DES FORMATEURS" : "BARRE DES STAGIAIRES";
    const barre = avantAnciensNoms.split("\n").find((l) => l.startsWith(titre));
    let position = 0;
    for (const { libelle } of entrees) {
      const trouve = barre.indexOf(libelle, position);
      assert.ok(trouve >= 0, `${espace} : ${libelle}`);
      position = trouve + libelle.length;
    }
  }
});

test("nouvelle navigation : les anciens noms ne sont pas des destinations, ils renvoient à la nouvelle place", () => {
  for (const ancien of ["Mon espace", "Paramètres", "Calendrier", "Ressources", "Tableau de bord"]) {
    assert.ok(!avantAnciensNoms.includes(ancien), ancien);
    assert.ok(anciensNoms.includes(ancien), ancien);
  }
  assert.match(anciensNoms, /Calendrier[^\n]*Planning, Dates clés/);
  assert.match(anciensNoms, /Ressources[^\n]*Cours et QCM, Documents/);
  assert.match(anciensNoms, /Mon espace[^\n]*Mon suivi/);
  assert.match(anciensNoms, /Notes[^\n]*Mon suivi, Résultats/);
  assert.match(anciensNoms, /Tableau de bord[^\n]*Indicateurs/);
});

test("nouvelle navigation : plus de bulle ronde, de logo vers l'espace perso ni de boutons de l'ancienne barre", () => {
  assert.ok(!avantAnciensNoms.includes("bouton rond"));
  assert.ok(!avantAnciensNoms.includes("barre du haut"));
  assert.ok(!avantAnciensNoms.includes("flèche circulaire"));
  assert.match(NOUVELLE, /logo, en haut à gauche, ramène à l'Accueil/);
});

test("les deux textes : le calendrier est une liste, les contacts sont là, le thème n'existe plus, Modifier est au-dessus de la semaine", () => {
  for (const texte of [AIDE_APP, NOUVELLE]) {
    assert.ok(!texte.includes("vue mensuelle"));
    assert.ok(!texte.includes("en haut à droite, Échap"));
    assert.ok(!texte.includes("thème sombre"));
    assert.ok(!texte.includes("couleur d'accent"));
    assert.match(texte, /[Cc]ontacts/);
    assert.match(texte, /absence/);
  }
});

test("le quota et la limite sur les données personnelles restent dans les deux textes", () => {
  for (const texte of [AIDE_APP, NOUVELLE]) {
    assert.ok(texte.includes("quota de 30 questions par jour"));
    assert.ok(texte.includes("Tu ne vois pas les données personnelles des stagiaires."));
  }
});

test("la fonction prend toujours le guide de la nouvelle barre, choisi par l'espace ; elle ne lit plus le champ navigation", () => {
  const source = lire("../supabase/functions/chatbot/index.ts");
  assert.ok(source.includes("aide: consignesApp(corps.espace), page, espace: corps.espace"));
  assert.ok(!source.includes("corps.navigation"));
  assert.ok(!source.includes("aide: AIDE_APP"));
});

test("l'app envoie l'espace avec chaque question, plus la navigation", () => {
  const source = lire("../js/chatbot.js");
  assert.match(source, /corpsRequete\(histo, location\.hash, getEspace\(\)\)/);
  assert.ok(!source.includes("navigationV2Active"));
});

test("lot 2B : le nouveau guide décrit Aujourd'hui, l'Accueil, la grille, les sous-onglets et Mon suivi", () => {
  for (const nom of ["Aujourd'hui", "À traiter", "À suivre de près", "Propositions IA", "Résultats", "Grille", "Liste",
    "le bouton « Voir le QCM »", "Signer pour ce matin", "Signer pour cet après-midi", "À faire", "Prochain rendez-vous",
    "L'épreuve en bref", "Évaluations EPCF : 0 épreuve sur 2", "Livret EPCF (son livret officiel", "Dossier professionnel : 2 exemples sur 6", "Moi"]) {
    assert.ok(avantAnciensNoms.includes(nom), nom);
  }
  assert.match(avantAnciensNoms, /bandeau en haut de l'app propose aussi « Signer » tant que la feuille du jour est ouverte/);
  assert.match(anciensNoms, /Accueil[^\n]*Aujourd'hui/);
  assert.match(anciensNoms, /Évolution[^\n]*Résultats/);
  assert.ok(!avantAnciensNoms.includes("Évolution (graphe"), "Évolution n'est plus une partie");
});

// === Lot 5 : l'assistant connaît les espaces de la direction et du siège ===
const DIRECTION = consignesApp("direction");
const SIEGE = consignesApp("siege");
const OPTIONS = { routeVisible: () => true, emargementActif: true, emargementDansLeCentre: true, reglagesEspace: true };

test("lot 5 : le guide est choisi par l'espace reçu ; un client sans espace garde les guides d'avant", () => {
  assert.notEqual(DIRECTION, NOUVELLE);
  assert.notEqual(SIEGE, NOUVELLE);
  assert.notEqual(DIRECTION, SIEGE);
  // Une app en cache envoie encore un champ navigation : il est ignoré (le guide ne dépend que de l'espace).
  // Formateur et stagiaire : le guide de leur barre, comme avant.
  assert.equal(consignesApp("equipe"), NOUVELLE);
  assert.equal(consignesApp("stagiaire"), NOUVELLE);
  // Une app en cache n'envoie pas d'espace : le comportement d'aujourd'hui.
  assert.equal(consignesApp(), AIDE_APP);
  // Une valeur inattendue ne choisit jamais un guide de pilotage.
  for (const v of ["Direction", "SIEGE", "direction ", "", 1, true, {}, ["direction"], "admin"]) {
    assert.equal(consignesApp(v), NOUVELLE, JSON.stringify(v));
  }
});

test("lot 5 : chaque guide nomme chaque entrée de sa barre, dans l'ordre, puis celles du téléphone, dans l'ordre", () => {
  for (const [espace, guide, titre] of [
    ["direction", DIRECTION, "BARRE DE LA DIRECTION"],
    ["siege", SIEGE, "BARRE DU SIÈGE"],
  ]) {
    const entrees = entreesNavigation(espace, OPTIONS);
    const ligne = guide.split("\n").find((l) => l.startsWith(titre));
    assert.ok(ligne, titre);
    let position = 0;
    for (const { libelle } of entrees) {
      const trouve = ligne.indexOf(libelle, position);
      assert.ok(trouve >= 0, `${espace} : ${libelle}`);
      position = trouve + libelle.length;
    }
    const { barre, plus } = barreTelephone(espace, entrees);
    const tel = guide.split("\n").find((l) => l.startsWith("SUR TÉLÉPHONE"));
    assert.ok(tel, `${espace} : SUR TÉLÉPHONE`);
    position = 0;
    for (const { court } of barre) {
      const trouve = tel.indexOf(court, position);
      assert.ok(trouve >= 0, `${espace} téléphone, barre : ${court}`);
      position = trouve + court.length;
    }
    assert.ok(tel.indexOf("Plus", position) >= 0, `${espace} : Plus, après la barre`);
    for (const { court } of plus) assert.ok(tel.indexOf(court, position) >= 0, `${espace} téléphone, Plus : ${court}`);
  }
});

test("lot 5 : les mots des écrans de la direction (plan, tâches 7 à 10 et 14)", () => {
  for (const mot of ["Vue d'ensemble", "Centre de", "À suivre de près", "Thèmes les moins réussis", "Exporter le tableau (CSV)",
    "Ce centre n'a pas encore de promo", "Créer une promo", "Réessayer", "Modifier", "Modules", "Gérer cette promo",
    "Voir les feuilles", "Voir la matrice", "Inviter un formateur", "Retirer du centre",
    "Compte créé. La personne crée son mot de passe avec cette adresse, onglet Créer mon compte.",
    "Habillage par défaut du centre", "Laisser chacun choisir le sien", "Promos mises à jour."]) {
    assert.ok(DIRECTION.includes(mot), mot);
  }
});

test("suite du lot 5 : les données personnelles de la direction et l'ancien stagiaire transformé", () => {
  for (const mot of ["Données personnelles", "Conservation des fiches", "la conservation des fiches est gérée par le fondateur",
    "Élèves bénévoles sans venue depuis 12 mois", "Supprimer",
    "ancien stagiaire", "Le compte de cet ancien stagiaire est devenu un compte de formateur."]) {
    assert.ok(DIRECTION.includes(mot), mot);
  }
  assert.ok(!DIRECTION.includes(String.fromCharCode(0x2014)), "aucun tiret cadratin");
  // Réconciliation avec Q5 : la direction n'anonymise plus (conservation au fondateur, page Qualiopi).
  assert.ok(!/Anonymiser la promo|ANONYMISER|« Effacer les données »/.test(DIRECTION), "plus de bouton « Anonymiser la promo » ni « Effacer les données » chez la direction");
});

test("lot 5 : les mots des écrans du siège (plan, tâches 11 à 14)", () => {
  for (const mot of ["Vue d'ensemble", "Réseau", "Chiffres agrégés par centre, sans données nominatives", "Exporter le tableau (CSV)",
    "Centre de démonstration (données fictives, hors totaux)", "moins de 5 stagiaires en formation",
    "Moins de 5 stagiaires en formation : chiffres non affichés.", "Ajouter un centre", "Inviter une direction", "Retirer",
    "Thèmes", "Compétences", "QCM", "Documents", "Réessayer"]) {
    assert.ok(SIEGE.includes(mot), mot);
  }
  assert.match(SIEGE, /aucun nom/);
  assert.match(SIEGE, /habillage par défaut du réseau/i);
});

test("lot 5 : la direction et le siège ne décrivent ni les barres ni les gestes des autres espaces", () => {
  for (const [nom, guide] of [["direction", DIRECTION], ["siège", SIEGE]]) {
    assert.ok(!guide.includes("BARRE DES STAGIAIRES") && !guide.includes("BARRE DES FORMATEURS"), nom);
    assert.ok(!guide.includes("Signer pour ce matin") && !guide.includes("bouton rond"), nom);
    assert.ok(!guide.includes("Qualiopi"), `${nom} : Qualiopi est hors du lot (D12)`);
  }
  // Ni Planning ni Cours et QCM dans la barre de la direction (D15) : elle les exerce depuis son espace Formateur.
  const barreDirection = DIRECTION.split("\n").find((l) => l.startsWith("BARRE DE LA DIRECTION"));
  assert.ok(!barreDirection.includes("Planning") && !barreDirection.includes("Cours et QCM"));
  assert.match(DIRECTION, /espace Formateur/);
  assert.ok(!SIEGE.includes("Planning"));
});

test("lot 5 : le menu du compte propose Espace, et les guides gardent les règles communes", () => {
  for (const guide of [DIRECTION, SIEGE, NOUVELLE]) {
    assert.ok(guide.includes("« Espace »"), "le menu du compte porte la section Espace");
    assert.ok(!guide.includes(String.fromCharCode(0x2014)) && !/\bProf\b/.test(guide), "ni tiret cadratin ni Prof");
    assert.ok(guide.includes("quota de 30 questions par jour"));
    assert.ok(guide.includes("Tu ne vois pas les données personnelles des stagiaires."));
    for (const nom of ["Signaler un problème", "Assistant", "Nouveautés", "Mes préférences", "Se déconnecter"]) {
      assert.ok(guide.includes(nom), nom);
    }
  }
  for (const espace of ["direction", "siege", "equipe"]) {
    assert.ok(NOUVELLE.includes(LIBELLES_ESPACE[espace]), `le guide des formateurs nomme l'espace ${LIBELLES_ESPACE[espace]}`);
  }
});
