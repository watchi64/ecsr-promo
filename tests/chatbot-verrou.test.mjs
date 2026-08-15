import test from "node:test";
import assert from "node:assert/strict";
import {
  creerVerrou, autoriserNumero, pousserDelta, viderVerrou, MOTIF_ARTICLE,
} from "../supabase/functions/chatbot/verrou-articles.mjs";

const TAILLES = [1, 2, 3, 4, 5, 7, 11, 13, 16, 31, 64];

function rejouer(texte, taille, verrou) {
  let sortie = "";
  for (let i = 0; i < texte.length; i += taille) {
    sortie += pousserDelta(verrou, texte.slice(i, i + taille));
  }
  return sortie + viderVerrou(verrou);
}

// Oracle : le resultat en flux doit etre identique au masquage du texte entier.
function oracle(texte, autorises = []) {
  const propre = (n) => n.toUpperCase().replace(/[.\s]/g, "");
  const set = new Set(autorises.map(propre));
  MOTIF_ARTICLE.lastIndex = 0;
  return texte.replace(MOTIF_ARTICLE, (m) => (set.has(propre(m)) ? m : "[verification en cours]"));
}

function verifierToutesTailles(texte, autorises = []) {
  const attendu = oracle(texte, autorises);
  for (const taille of TAILLES) {
    const verrou = creerVerrou();
    for (const n of autorises) autoriserNumero(verrou, n);
    assert.equal(rejouer(texte, taille, verrou), attendu, `taille ${taille}`);
  }
  return attendu;
}

test("un numero non verifie est masque quel que soit le decoupage", () => {
  const attendu = verifierToutesTailles("L'article applicable est le R412-6-1 du code de la route.");
  assert.ok(!attendu.includes("R412-6-1"));
  assert.ok(attendu.includes("[verification en cours]"));
});

test("un numero verifie passe en clair, un autre reste masque", () => {
  const attendu = verifierToutesTailles("Selon R. 412-6-1, mais aussi R416-15.", ["R412-6-1"]);
  assert.ok(attendu.includes("R. 412-6-1"));
  assert.ok(!attendu.includes("R416-15"));
});

test("pas de faux positif sur une plage d'annees, a toutes les tailles", () => {
  const texte = "Plage l 2024-2025 et note 15-20 en hausse";
  assert.equal(verifierToutesTailles(texte), texte);
});

test("motif long et numero en toute fin de flux", () => {
  const attendu = verifierToutesTailles("Sanction prevue par L. 1234-123-12");
  assert.ok(!attendu.includes("1234-123-12"));
});

test("le texte sans motif traverse intact", () => {
  const texte = "Les feux de croisement eclairent a 30 m minimum.";
  assert.equal(verifierToutesTailles(texte), texte);
});
