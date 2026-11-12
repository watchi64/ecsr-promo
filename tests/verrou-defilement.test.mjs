// Un écran plein cadre (lecteur de cours, Informations légales, éditeur, QCM, signature) fige la page derrière lui. Le
// verrou ne peut pas se poser sur <body> seul : <html> porte `overflow-x: clip` (css/style.css, pour le collage du
// planning), et dès que <html> a un overflow autre que `visible`, c'est lui, et non plus <body>, qui donne son overflow à
// la fenêtre (règle de propagation de CSS). `body { overflow: hidden }` ne fige alors que <body>, et la page derrière
// continue de défiler sous l'écran ouvert. Sur iPhone (Safari), le geste allait à la page au lieu du cours : en haut de
// la page Cours et QCM, impossible de faire défiler le cours ouvert (signalé par Timy le 11/11/2026).
// Ce test exige, pour chaque classe de verrou posée sur <body>, la règle qui fige aussi <html>.
// Lancer : node --test tests/verrou-defilement.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { sansCommentaires } from "./aides-css.mjs";

const feuilles = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css"));
const css = feuilles.map((f) => sansCommentaires(readFileSync(new URL("../css/" + f, import.meta.url), "utf8"))).join("\n");

// Règles « sélecteurs { déclarations } » de premier niveau ou dans un @media : CSS plat, sans imbrication de règles.
function regles(texte) {
  const sortie = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(texte))) sortie.push({ selecteur: m[1].trim(), corps: m[2] });
  return sortie;
}
const toutes = regles(css);
const figeTout = (corps) => /(^|;)\s*overflow\s*:\s*hidden\s*(;|$)/.test(corps.trim());

// Les classes de verrou : `body.x { overflow: hidden }`.
const verrous = toutes
  .filter((r) => figeTout(r.corps))
  .flatMap((r) => r.selecteur.split(",").map((s) => s.trim()))
  .map((s) => /^body\.([\w-]+)$/.exec(s))
  .filter(Boolean)
  .map((m) => m[1]);

test("la prémisse tient : <html> porte un overflow-x autre que visible", () => {
  const html = toutes.filter((r) => r.selecteur.split(",").some((s) => s.trim() === "html"));
  assert.ok(html.some((r) => /overflow-x\s*:\s*clip/.test(r.corps)), "html { overflow-x: clip } introuvable");
});

test("les verrous connus sont bien relevés", () => {
  for (const c of ["cours-open", "qcm-open", "sig-ouverte"]) assert.ok(verrous.includes(c), `body.${c} non relevé`);
});

test("chaque verrou posé sur <body> fige aussi <html>, donc la fenêtre", () => {
  const html = toutes.filter((r) => figeTout(r.corps)).flatMap((r) => r.selecteur.split(",").map((s) => s.replace(/\s+/g, "")));
  for (const c of verrous) {
    assert.ok(html.includes(`html:has(>body.${c})`), `aucune règle html:has(> body.${c}) { overflow: hidden }`);
  }
});
