import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AIDE_APP, consignesApp } from "../supabase/functions/chatbot/aide.mjs";
import { entreesNavigation } from "../js/nav-rules.js";

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");
const NOUVELLE = consignesApp("nouvelle");
// Les anciens noms n'ont leur place que dans la section qui dit où ils sont passés.
const [avantAnciensNoms, anciensNoms] = NOUVELLE.split("ANCIENS NOMS");

test("ancienne navigation : le texte de l'ancienne barre", () => {
  assert.equal(consignesApp("ancienne"), AIDE_APP);
});

test("un champ absent ou inconnu garde l'ancienne barre : une app en cache sur un téléphone reste juste", () => {
  for (const v of [undefined, null, "", "NOUVELLE", "nouvelle ", 1, true, {}, ["nouvelle"]]) {
    assert.equal(consignesApp(v), AIDE_APP, JSON.stringify(v));
  }
  assert.equal(consignesApp(), AIDE_APP);
});

test("les deux textes sont distincts, substantiels et sans tiret cadratin", () => {
  assert.notEqual(NOUVELLE, AIDE_APP);
  assert.ok(NOUVELLE.length > 1500);
  assert.ok(!NOUVELLE.includes("—"));
  assert.ok(!NOUVELLE.includes("Prof"));
});

test("nouvelle navigation : les noms de la barre, du compte et des sous-onglets", () => {
  for (const nom of ["Accueil", "Planning", "Semaine", "Dates clés", "Priorités", "Cours et QCM", "Thèmes", "Compétences",
    "Documents", "Mon suivi", "La classe", "CCP2", "Émargement", "Stagiaires", "Élèves bénévoles", "Notes et examens",
    "Signalements", "Indicateurs", "Réglages", "Plus", "Assistant", "Nouveautés", "Contacts du centre", "Mes préférences",
    "Actualiser", "Se déconnecter", "Signaler un problème"]) {
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

test("la fonction choisit les consignes d'après le champ navigation de la requête", () => {
  const source = lire("../supabase/functions/chatbot/index.ts");
  assert.ok(source.includes("aide: consignesApp(corps.navigation)"));
  assert.ok(!source.includes("aide: AIDE_APP"));
});

test("l'app envoie la barre affichée avec chaque question", () => {
  const source = lire("../js/chatbot.js");
  assert.match(source, /corpsRequete\(histo, location\.hash, navigationV2Active\(\)\)/);
});

test("l'ancien guide ne bouge pas d'un octet (empreinte du 08/11, lot 2B)", () => {
  assert.equal(createHash("sha256").update(AIDE_APP).digest("hex"),
    "3b0c64b96dd0496a2c3f6d88713469364743ba0279f4cf66c7906211da292bb1");
});

test("lot 2B : le nouveau guide décrit Aujourd'hui, l'Accueil, la grille, les sous-onglets et Mon suivi", () => {
  for (const nom of ["Aujourd'hui", "À traiter", "À suivre de près", "Propositions IA", "Résultats", "Grille", "Liste",
    "le bouton « Ouvrir »", "Signer pour ce matin", "Signer pour cet après-midi", "À faire", "Prochain rendez-vous",
    "L'épreuve en bref", "EPCF : 0 sur 2", "Dossier pro : 2 exemples sur 6", "Moi"]) {
    assert.ok(avantAnciensNoms.includes(nom), nom);
  }
  assert.match(avantAnciensNoms, /bandeau en haut de l'app propose aussi « Signer » tant que la feuille du jour est ouverte/);
  assert.match(anciensNoms, /Accueil[^\n]*Aujourd'hui/);
  assert.match(anciensNoms, /Évolution[^\n]*Résultats/);
  assert.ok(!avantAnciensNoms.includes("Évolution (graphe"), "Évolution n'est plus une partie");
});
