#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vérification de la nouvelle navigation au banc d'essai (refonte, lot 1 : la coquille).

Usage
-----
    python outils/verifier_navigation.py [URL_DU_BANC] [options]

    python outils/verifier_navigation.py                              # tout, deux moteurs (environ 2 minutes)
    python outils/verifier_navigation.py --roles stagiaire --sans-menus   # coquille du stagiaire seule (Task 4)
    python outils/verifier_navigation.py --sans-assistant             # avant le câblage de l'assistant (Task 6)

Prérequis : le serveur du banc (configuration « maquette-nav », qui sert la racine du worktree) et un
`_harness.html` à jour (`node _harness_build.mjs` après toute modification d'index.html ; un banc
périmé est signalé par un échec « banc périmé »).

URL_DU_BANC : adresse de _harness.html (défaut http://127.0.0.1:8040/_harness.html). Une adresse en
`localhost` est réécrite en `127.0.0.1` quand elle répond : sur ce poste, `localhost` coûte ~0,2 s par
requête (essai de ::1 avant IPv4) et fait passer le démarrage de l'app de 0,3 s à 6 s ; `--garder-hote`
l'évite.

Sortie : les échecs groupés par type, les avertissements (dette connue, sans échec), puis, en dernière
ligne, « N vues, M échec(s) ». Code de sortie 1 s'il y a un échec, 2 si le banc ne répond pas.

Ce que le script joue
---------------------
Pour chaque moteur (Chromium, puis WebKit, par `executable_path` quand celui que Playwright attend
manque) :
  * Passe « allumé », rôles stagiaire, prof et fondateur, largeurs 1280, 1100, 900 et 375 px. Le
    fondateur et le stagiaire du banc (fondateur lui aussi) passent par l'aperçu de l'appareil
    (localStorage `ecsr_nav_v2` = "1", posé avant le chargement). Le formateur prof, qui n'est pas
    fondateur et n'a donc aucun aperçu, passe par le réglage de la promo (ligne `navigation_v2` de
    `settings`, semée dans le faux Supabase par une interception de `_harness_supabase.js` : le
    fichier du banc n'est jamais modifié). S'y ajoutent un stagiaire qui n'est pas fondateur (réglage
    de la promo, `is_founder` retiré : le cas de la plupart des vrais comptes), le stagiaire et le prof
    avec `?modules=depart` (modules fermés : pas de case vide, repères), et le « Voir en tant que » du
    fondateur (la coquille change d'espace sans recharger la page).
  * Passe « éteint » : aucun aperçu, rien ne doit changer par rapport à main (aucune coquille,
    l'ancienne barre d'onglets, pas de sous-onglets regroupés).
Dans chaque contexte : l'arrivée à froid, chaque entrée de la coquille (cliquée dans la coquille, ou
via « Plus » sur téléphone quand elle y est rangée ; la liste vient des règles de js/nav-rules.js,
lues dans la page), chaque sous-onglet des pages qui en ont (Planning, Cours, Mon espace, Notes...), puis
les menus (compte, « Plus », contexte, assistant).

Contrôles par vue
-----------------
  * rien ne défile de côté ni ne déborde de la fenêtre, hors `.matrice-wrap` (exception admise) ;
    tout défilement de côté dans la coquille ou dans une barre de sous-onglets est un échec ; ceux des
    conteneurs de page qui défilaient déjà sur main (DETTE_LOT_2, ruling R10) donnent un avertissement
    « dette du lot 2 », sans échec ;
  * une seule entrée allumée dans la coquille visible (celle que donne `entreeActive`) ;
  * zones à toucher : 44 px au moins sous 700 px (24 px au-delà) pour la coquille, les menus, les barres
    de sous-onglets et les cases des Paramètres ;
  * contraste du texte de la coquille et des menus (couleur et fond réels) : 4,5:1, 3:1 pour le grand texte ;
  * barre du bas (téléphone) : 5 entrées au plus, toutes nommées, libellés sur une ligne ;
  * la coquille et le contenu ne se recouvrent pas, tout ce qui est fixe reste dans la fenêtre, l'ancienne
    barre d'onglets est masquée ;
  * menus et tiroirs : entièrement dans l'écran, fermés par Échap (le retour du focus sur le bouton qui les
    a ouverts n'est qu'un avertissement) ;
  * aucune erreur de console ni de page.

Contrat de balisage de la coquille (Tasks 4 et 5)
-------------------------------------------------
Le script ne connaît la coquille que par ces crochets ; une coquille qui les respecte passe sans autre
réglage. Tant qu'elle n'existe pas, chaque contexte échoue avec « coquille absente » (une fois par
contexte) et les contrôles de la page sont joués quand même.
  * `body[data-nav="v2"]` et `body[data-espace="stagiaire" | "equipe"]`.
  * Tout élément racine de la coquille (barre du haut, barre latérale, barre du bas, tiroir, fenêtre du
    compte...) porte l'attribut `data-nav-coquille` ; « dans la coquille » veut dire « sous un élément
    `[data-nav-coquille]` ».
  * Une entrée est un lien `a[href="#/route"]` de la coquille ; `aria-current="page"` sur l'entrée de la
    page affichée (sur « Plus » quand cette entrée est rangée dans le tiroir).
  * Téléphone (moins de 700 px) : la barre du bas est un élément fixe collé au bas de la fenêtre, sur toute
    la largeur, dont les liens et boutons visibles sont les entrées (« Plus » compris), chacune avec un
    libellé visible.
  * Ouvreurs de menus : tout bouton de la coquille qui porte `aria-haspopup` ou `data-nav-action`
    (« compte », « plus », « assistant » ; « replier » est ignoré). Leur fenêtre est un `role="dialog"` ou
    `role="menu"` (le panneau de l'assistant : `#chatbot-panel`).
  * Une entrée sans libellé visible (colonne d'icônes) porte `aria-label` et `title`.

Options utiles pendant le développement : `--roles`, `--moteurs`, `--largeurs`, `--passes`,
`--sans-menus` (boutons du compte et de « Plus » pas encore câblés, avant la Task 5), `--sans-assistant`
(bouton « Assistant » pas encore câblé, avant la Task 6), `--tout` (liste chaque échec), `--captures
DOSSIER` (une capture par vue en échec), `--jobs N` (processus en parallèle, deux par moteur par défaut).
"""
import argparse
import concurrent.futures
import itertools
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, replace

from playwright.sync_api import Error as ErreurPlaywright
from playwright.sync_api import TimeoutError as DelaiDepasse
from playwright.sync_api import sync_playwright

# --------------------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------------------

BANC_PAR_DEFAUT = "http://127.0.0.1:8040/_harness.html"
MOTEURS = ("chromium", "webkit")
ROLES = ("stagiaire", "prof", "fondateur")
LARGEURS = (1280, 1100, 900, 375)
HAUTEUR = {1280: 800, 1100: 800, 900: 800, 375: 812}
SEUIL_TELEPHONE = 700          # largeur de fenêtre sous laquelle la coquille passe en mode téléphone
DATE_DU_BANC = "2026-10-27"    # « aujourd'hui » figé (même date que les autres vérifications du lot)
CLE_APERCU = "ecsr_nav_v2"     # aperçu du fondateur, propre à l'appareil (js/nav-etat-regles.js)
CLE_REGLAGE = "navigation_v2"  # réglage de la promo, ligne de `settings` (js/nav-etat-regles.js)

# Ruling R10 : conteneurs de page qui défilaient déjà de côté sur main. Un défilement qui s'y
# produit n'est qu'un avertissement (dette du lot 2) ; partout ailleurs hors coquille il échoue.
DETTE_LOT_2 = (".passages-table-wrap", ".epcf-table-wrap", ".dashboard-meta", ".cours-table-wrap",
               ".centre-defile", ".cours-sommaire", ".ms-chart-wrap", ".notes-chart-svg-wrap")
EXCEPTION_ADMISE = ".matrice-wrap"  # la matrice des notes : seule exception admise, sans avertissement
# Constaté au banc, interrupteur éteint (donc déjà sur main), et absent de la liste R10 : dans Cours,
# Signalements (formateur), un lien Légifrance sans coupure dépasse de 66 px à 375 px
# (`p.qcm-signal-instr-ligne > a`, rogné par le body). Même traitement que la liste R10 (avertissement),
# affiché à part pour que le contrôleur tranche ; l'ôter de ce tuple en fait un échec.
DETTE_CONSTATEE_HORS_R10 = (".qcm-signal-instr-ligne",)

# Entrées de repli si les règles de navigation de l'app ne se lisent pas dans la page.
ENTREES_REPLI = {
    "stagiaire": ("home", "planning", "themes", "mon-suivi", "ccp2"),
    "equipe": ("home", "planning", "emargement", "stagiaires", "notes", "themes", "ccp2", "centre", "config"),
}

# --------------------------------------------------------------------------------------
# Code injecté dans la page (une fois par page, sous window.__verifNav)
# --------------------------------------------------------------------------------------

JS_OUTILS = r"""
(() => {
if (window.__verifNav) return;

const SEL_INTERACTIF = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="link"], input:not([type="hidden"]), select, textarea, summary';
const SEL_POPUP = '[role="dialog"], [role="menu"], [aria-modal="true"], #chatbot-panel';
const SEL_CACHE = '[aria-hidden="true"], [hidden], [inert]';

const style = (e) => getComputedStyle(e);
const rect = (e) => e.getBoundingClientRect();
const largeur = () => document.documentElement.clientWidth;
const hauteur = () => window.innerHeight;
const dixieme = (x) => Math.round(x * 10) / 10;

const visible = (e) => {
  const r = rect(e);
  if (r.width <= 0 || r.height <= 0) return false;
  const s = style(e);
  return s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.01;
};
const nom = (e) => {
  if (!e || !e.tagName) return "?";
  let s = e.tagName.toLowerCase();
  if (e.id) s += "#" + e.id;
  const c = (e.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (c.length) s += "." + c.join(".");
  const href = e.getAttribute("href"), action = e.getAttribute("data-nav-action"), role = e.getAttribute("role");
  if (href && href.startsWith("#/")) s += '[href="' + href + '"]';
  else if (action) s += "[data-nav-action=" + action + "]";
  else if (role && !c.length) s += "[role=" + role + "]";
  return s;
};
const texte = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
const nomAcc = (e) => {
  const img = e.querySelector ? e.querySelector("img[alt]") : null;
  return (e.getAttribute("aria-label") || texte(e) || (img && img.getAttribute("alt")) || e.getAttribute("title") || "")
    .replace(/\s+/g, " ").trim();
};
// Plage des diacritiques combinants (U+0300 à U+036F), construite par code pour ne pas dépendre d'une séquence d'échappement.
const DIACRITIQUES = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");
const sansAccent = (s) => (s || "").normalize("NFD").replace(DIACRITIQUES, "").toLowerCase();

const racines = () => [...document.querySelectorAll("[data-nav-coquille]")];
const actifs = (liste) => liste.filter((e) => !e.disabled && e.getAttribute("aria-disabled") !== "true");
function interactifsDe(racine) {
  const s = new Set();
  if (racine.matches(SEL_INTERACTIF)) s.add(racine);
  racine.querySelectorAll(SEL_INTERACTIF).forEach((e) => s.add(e));
  return actifs([...s]);
}
function interactifsCoquille() {
  const s = new Set();
  racines().forEach((r) => interactifsDe(r).forEach((e) => s.add(e)));
  return [...s];
}

// ---- Règles de navigation de l'app, lues dans la page (le script n'en recopie rien) ----
async function regles() {
  try {
    const cartes = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const charger = (n) => {
      const cle = Object.keys(cartes).find((k) => k.startsWith("./js/" + n + ".js?v="));
      if (!cle) throw new Error("module introuvable : " + n);
      return import(new URL(cle, document.baseURI).href);
    };
    const [rules, mods, em, auth, etat] = await Promise.all(
      ["nav-rules", "modules-etat", "emargement-etat", "auth-admin", "nav-etat"].map(charger));
    const espace = rules.espaceDe({ formateur: auth.isAdmin() || auth.isProf() });
    const entrees = rules.entreesNavigation(espace, { routeVisible: mods.routeVisible, emargementActif: em.emargementActif() });
    const tel = rules.barreTelephone(espace, entrees);
    return {
      espace, entrees, barre: tel.barre.map((e) => e.id), plus: tel.plus.map((e) => e.id),
      lit: (route) => rules.entreeActive(route, entrees),
      actif: etat.navigationV2Active(), fondateur: auth.isFounder(), profilStagiaire: auth.monStagiaireId() != null,
      setViewAs: auth.setViewAs,
    };
  } catch (e) { return { erreur: String((e && e.message) || e) }; }
}
async function reglesSimples() {
  const r = await regles();
  if (r.erreur) return { erreur: r.erreur };
  return { espace: r.espace, entrees: r.entrees.map((e) => ({ id: e.id, route: e.route, libelle: e.libelle, court: e.court })),
    barre: r.barre, plus: r.plus, actif: r.actif, fondateur: r.fondateur, profilStagiaire: r.profilStagiaire };
}
async function voirEnTantQue(role) {
  const r = await regles();
  if (r.erreur) return r.erreur;
  r.setViewAs(role);
  return null;
}

// ---- Couleurs et contraste ----
function analyser(c) {
  let m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : Number(x)));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  m = /^color\(srgb ([^)]+)\)$/.exec(c);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : Number(x)));
    return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
  }
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
  const d = cx.getImageData(0, 0, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
}
const sur = (haut, bas, a) => ({ r: haut.r * a + bas.r * (1 - a), g: haut.g * a + bas.g * (1 - a), b: haut.b * a + bas.b * (1 - a) });
const luminance = (c) => {
  const v = [c.r, c.g, c.b].map((x) => { const y = x / 255; return y <= 0.03928 ? y / 12.92 : Math.pow((y + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const rapport = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = (c) => "#" + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");
// Fond réel d'un élément : les fonds unis des ancêtres, superposés jusqu'au premier opaque.
function fondDe(e) {
  const couches = [];
  for (let n = e; n; n = n.parentElement) {
    const s = style(n);
    if (s.backgroundImage && s.backgroundImage !== "none") return null;   // dégradé ou image : indéterminé
    const c = analyser(s.backgroundColor);
    if (c.a > 0) { couches.push(c); if (c.a >= 1) break; }
  }
  let base = { r: 255, g: 255, b: 255 };
  for (let i = couches.length - 1; i >= 0; i--) base = sur(couches[i], base, couches[i].a);
  return base;
}
function mesurerContrastes(portees, echecs, avert) {
  const W = largeur(), H = hauteur(), deja = new Set();
  let indetermines = 0;
  portees.forEach((racine) => {
    [racine, ...racine.querySelectorAll("*")].forEach((e) => {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      if (!visible(e) || e.closest(SEL_CACHE) || e.closest("button:disabled, [aria-disabled='true']")) return;
      const r = rect(e);
      if (r.right <= 0 || r.left >= W || r.bottom <= 0 || r.top >= H) return;
      const s = style(e);
      let opacite = 1;
      for (let n = e; n && n !== document.body; n = n.parentElement) opacite *= parseFloat(style(n).opacity);
      const fond = fondDe(e);
      if (!fond) { indetermines++; return; }
      const c = analyser(s.color);
      const texteCouleur = sur(c, fond, c.a * opacite);
      const taille = parseFloat(s.fontSize), gras = parseInt(s.fontWeight, 10) >= 700;
      const seuil = (taille >= 24 || (taille >= 18.66 && gras)) ? 3 : 4.5;
      const ratio = rapport(texteCouleur, fond);
      if (ratio >= seuil) return;
      const cle = nom(e) + "|" + hex(texteCouleur) + "|" + hex(fond);
      if (deja.has(cle)) return;
      deja.add(cle);
      echecs.push(["contraste", `${ratio.toFixed(2)}:1 (minimum ${seuil}) ${hex(texteCouleur)} sur ${hex(fond)} : ${nom(e)} « ${texte(e).slice(0, 24)} »`]);
    });
  });
  if (indetermines) avert.push(["contraste indéterminé", `${indetermines} texte(s) de la coquille sur un fond en image ou en dégradé, non mesurés`]);
}

// ---- Zones à toucher ----
function mesurerCibles(elements, min, echecs, type) {
  const champ = 'textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])';
  elements.filter((e) => !e.matches(champ)).filter(visible).forEach((e) => {
    const r = rect(e);
    if (r.width < min - 0.5 || r.height < min - 0.5) {
      echecs.push([type, `${Math.round(r.width)}x${Math.round(r.height)} px (minimum ${min}) : ${nom(e)} « ${nomAcc(e).slice(0, 30)} »`]);
    }
  });
}

// ---- Défilements et débordements de côté ----
// Une zone qui défile de côté, ou un élément qui dépasse de la fenêtre sans être rogné par un
// ancêtre. body et html rognent (overflow-x: clip) : ce rognage est justement le débordement.
function debordements(o) {
  const W = largeur();
  const trouves = [];
  const caches = new Map();
  const infos = (e) => {
    let v = caches.get(e);
    if (!v) { const s = style(e); v = { ox: s.overflowX, pos: s.position, vis: s.visibility, r: null }; caches.set(e, v); }
    return v;
  };
  const rc = (e) => { const v = infos(e); if (!v.r) v.r = rect(e); return v.r; };
  const categorie = (e) => {
    if (e.closest(o.exception)) return "ignore";
    if (e.closest("[data-nav-coquille]")) return "coquille";
    if (e.closest(".subtabs-bar")) return "sous-onglets";
    const d = e.closest(o.dette.join(", "));
    if (d) return "dette:" + o.dette.find((s) => d.matches(s));
    return "page";
  };
  const vus = new Set();
  [document.getElementById("view"), ...racines()].filter(Boolean).forEach((racine) => {
    [racine, ...racine.querySelectorAll("*")].forEach((e) => {
      if (vus.has(e)) return;
      vus.add(e);
      const v = infos(e);
      if ((v.ox === "auto" || v.ox === "scroll") && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1) {
        trouves.push({ genre: "zone", cat: categorie(e), nom: nom(e),
          detail: `défile de côté (${e.scrollWidth} px de contenu pour ${e.clientWidth} px) : ${nom(e)}` });
      }
      const r = rc(e);
      if (r.width <= 1 || r.height <= 1 || v.vis === "hidden" || e.closest(SEL_CACHE)) return;
      let g = r.left, d = r.right;
      if (v.pos !== "fixed") {
        for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
          const va = infos(a);
          if (va.ox !== "visible") { const ra = rc(a); g = Math.max(g, ra.left); d = Math.min(d, ra.right); }
          if (va.pos === "fixed") break;
        }
      }
      if (d > W + 1 || g < -1) {
        const de = d > W + 1 ? `dépasse de ${Math.round(d - W)} px à droite` : `dépasse de ${Math.round(-g)} px à gauche`;
        trouves.push({ genre: "hors", cat: categorie(e), nom: nom(e), detail: `${de} de la fenêtre : ${nom(e)}` });
      }
    });
  });
  return trouves;
}

// ---- Éléments fixes de la coquille : barres, colonne, tiroirs ----
function fixesCoquille() {
  const fixes = [];
  racines().forEach((r) => [r, ...r.querySelectorAll("*")].forEach((e) => {
    const p = style(e).position;
    if ((p === "fixed" || p === "sticky") && visible(e)) fixes.push(e);
  }));
  return fixes.filter((e) => !fixes.some((f) => f !== e && f.contains(e)));
}
function genreDeBarre(e) {
  const r = rect(e), W = largeur(), H = hauteur();
  if (r.left <= 1 && r.width < W * 0.5 && r.height >= H * 0.8) return "gauche";
  if (r.width >= W * 0.9 && r.height <= 160 && r.height >= 36) {
    if (r.bottom >= H - 1) return "bas";
    if (r.top <= 1) return "haut";
  }
  return null;
}
// Étendue de ce que la page affiche (les enfants visibles de #view, hors éléments sortis du flux) :
// les marges et remplissages de #view, qui servent justement à faire de la place, n'en font pas partie.
function etenduDuContenu() {
  const vue = document.getElementById("view");
  const rs = [...vue.children].filter((c) => visible(c) && !["fixed", "absolute"].includes(style(c).position)).map(rect);
  if (!rs.length) return null;
  return { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)) };
}
// Lien visible d'une entrée, balisé pour que Playwright le clique (vrai clic, avec test de recouvrement).
function chercherLien(route, libelle, court) {
  document.querySelectorAll("[data-vn-cible]").forEach((e) => e.removeAttribute("data-vn-cible"));
  const liens = [...document.querySelectorAll('[data-nav-coquille] a[href="#/' + route + '"]')];
  const vis = liens.filter(visible);
  const bon = (a) => { const n = sansAccent(nomAcc(a)); return n.includes(sansAccent(libelle)) || n.includes(sansAccent(court)); };
  const choix = vis.find(bon) || vis[0] || null;
  if (choix) choix.setAttribute("data-vn-cible", "1");
  return { total: liens.length, visibles: vis.length };
}
function chercherPlus() {
  document.querySelectorAll("[data-vn-cible]").forEach((e) => e.removeAttribute("data-vn-cible"));
  const c = interactifsCoquille().filter(visible).filter((e) => e.tagName !== "A" || !e.getAttribute("href").startsWith("#/"))
    .find((e) => e.getAttribute("data-nav-action") === "plus" || /^plus$/i.test(nomAcc(e)));
  if (c) c.setAttribute("data-vn-cible", "1");
  return !!c;
}

// ---- Mesure d'une vue ----
async function mesurer(o) {
  const echecs = [], dettes = [], avert = [];
  const W = largeur(), H = hauteur();
  const tel = W < o.seuilTelephone;
  const allume = o.passe === "allume";
  const route = (location.hash || "").replace(/^#\//, "").split("/")[0];
  window.scrollTo(0, 0);
  const vue = document.getElementById("view");

  // Page : ni vide, ni en erreur.
  const boite = vue && vue.querySelector(".view-error-box");
  if (boite) echecs.push(["page en erreur", texte(boite).slice(0, 120)]);
  else if (!vue || !vue.children.length) echecs.push(["page vide", "#view n'a aucun contenu"]);

  // Défilements et débordements de côté.
  const trouves = debordements(o);
  trouves.forEach((t) => {
    if (t.cat === "ignore") return;
    if (!allume) { dettes.push([(t.genre === "zone" ? "zone qui défile de côté : " : "élément qui déborde de la fenêtre : ") + t.nom, t.detail]); return; }
    if (t.cat === "coquille") echecs.push(["défilement de côté dans la coquille", t.detail]);
    else if (t.cat === "sous-onglets") echecs.push(["défilement de côté d'une barre de sous-onglets", t.detail]);
    else if (t.cat.startsWith("dette:")) dettes.push([t.cat.slice(6), t.detail]);
    else echecs.push([t.genre === "zone" ? "zone de page qui défile de côté" : "élément de page qui déborde de la fenêtre", t.detail]);
  });

  // Barres de sous-onglets : une seule allumée ; zones à toucher sous la nouvelle navigation.
  const barres = [...document.querySelectorAll(".subtabs-bar")].filter(visible);
  barres.forEach((b) => {
    const n = b.querySelectorAll(".subtab.active").length;
    if (n !== 1) echecs.push(["sous-onglet allumé", `${n} sous-onglet(s) allumé(s) dans ${nom(b)}`]);
  });
  if (allume) {
    const min = tel ? 44 : 24;
    mesurerCibles([...document.querySelectorAll(".subtabs-bar .subtab")], min, echecs, "zone à toucher (sous-onglet)");
    mesurerCibles([...document.querySelectorAll(".invite-admin-toggle")], min, echecs, "zone à toucher (case de réglage)");
  }

  if (allume && o.coquille) mesurerCoquille(o, route, W, H, tel, echecs, avert, await regles());
  if (!allume) mesurerAncienne(route, echecs, barres);
  window.scrollTo(0, 0);
  return { route, echecs, dettes, avert };
}

function mesurerAncienne(route, echecs, barres) {
  if (document.body.dataset.nav || document.body.dataset.espace) echecs.push(["coquille présente, interrupteur éteint", `body[data-nav] = ${document.body.dataset.nav}, body[data-espace] = ${document.body.dataset.espace}`]);
  if (racines().length) echecs.push(["coquille présente, interrupteur éteint", `${racines().length} élément(s) [data-nav-coquille]`]);
  const onglets = [...document.querySelectorAll("#tabs .tab")].filter(visible);
  if (!onglets.length) echecs.push(["ancienne barre absente", "aucun onglet visible dans #tabs"]);
  const allumes = onglets.filter((t) => t.getAttribute("aria-current") === "page");
  if (allumes.length > 1) echecs.push(["entrée allumée", `${allumes.length} onglets allumés dans l'ancienne barre`]);
  // L'interrupteur éteint garde les pages de main : pas de regroupement en sous-onglets.
  const libelles = [...document.querySelectorAll("#view .subtab, #view .fiche-ligne")].map((e) => sansAccent(texte(e)));
  if (route === "planning" && barres.length) echecs.push(["page regroupée, interrupteur éteint", "le Planning montre des sous-onglets"]);
  if (route === "themes" && libelles.some((l) => l.startsWith("documents"))) echecs.push(["page regroupée, interrupteur éteint", "Cours montre un sous-onglet Documents"]);
  if (route === "mon-suivi" && libelles.some((l) => l.startsWith("la classe"))) echecs.push(["page regroupée, interrupteur éteint", "Mon espace montre la partie La classe"]);
}

function mesurerCoquille(o, route, W, H, tel, echecs, avert, R) {
  const vue = document.getElementById("view");
  if (document.body.dataset.nav !== "v2") echecs.push(["coquille disparue", `body[data-nav] = ${document.body.dataset.nav || "absent"}`]);
  if (document.body.dataset.espace !== o.espace) echecs.push(["espace de la coquille", `attendu ${o.espace}, body[data-espace] = ${document.body.dataset.espace || "absent"}`]);
  const visibles = racines().filter(visible);
  if (!visibles.length) echecs.push(["coquille invisible", `${racines().length} racine(s) [data-nav-coquille], aucune visible`]);

  // L'ancienne barre d'onglets ne reste pas affichée.
  const anciens = [...document.querySelectorAll("#tabs .tab")].filter(visible);
  if (anciens.length) echecs.push(["ancienne barre visible", `${anciens.length} onglet(s) de #tabs encore visible(s)`]);

  // Une seule entrée allumée, celle que donne entreeActive.
  const allumees = [...document.querySelectorAll('[data-nav-coquille] [aria-current="page"], [data-nav-coquille][aria-current="page"]')].filter(visible);
  const attendue = R.erreur ? undefined : R.lit(route);
  const attendu = attendue === undefined ? null : (attendue ? 1 : 0);
  if (attendu !== null ? allumees.length !== attendu : allumees.length > 1) {
    echecs.push(["entrée allumée", `${allumees.length} entrée(s) allumée(s) pour #/${route} (attendu ${attendu === null ? "1 au plus" : attendu + (attendue ? " : " + attendue : "")}) : ${allumees.map((a) => nom(a) + " « " + nomAcc(a).slice(0, 18) + " »").join(", ")}`]);
  } else if (attendue && allumees.length === 1 && allumees[0].tagName === "A") {
    const lien = (allumees[0].getAttribute("href") || "").replace(/^#\//, "");
    if (lien !== attendue) echecs.push(["entrée allumée", `#/${route} doit allumer « ${attendue} », c'est le lien « ${lien} » qui l'est`]);
  }

  // Éléments fixes : dans la fenêtre, sans recouvrir le contenu.
  const fixes = fixesCoquille();
  const contenu = etenduDuContenu();
  fixes.forEach((f) => {
    const r = rect(f);
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) {
      echecs.push(["barre hors de l'écran", `${nom(f)} : x ${Math.round(r.left)} à ${Math.round(r.right)} (fenêtre ${W}), y ${Math.round(r.top)} à ${Math.round(r.bottom)} (fenêtre ${H})`]);
    }
    const genre = genreDeBarre(f);
    if (contenu && genre === "gauche" && contenu.left < r.right - 1) echecs.push(["contenu sous la coquille", `le contenu commence à x ${Math.round(contenu.left)}, la barre latérale va jusqu'à x ${Math.round(r.right)}`]);
    if (contenu && genre === "haut" && contenu.top < r.bottom - 1) echecs.push(["contenu sous la coquille", `le contenu commence à y ${Math.round(contenu.top)}, la barre du haut va jusqu'à y ${Math.round(r.bottom)}`]);
  });
  const basses = fixes.filter((f) => genreDeBarre(f) === "bas");
  if (basses.length) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const fin = etenduDuContenu();
    basses.forEach((f) => {
      const top = rect(f).top;
      if (fin && fin.bottom > top + 1) echecs.push(["contenu sous la coquille", `le bas de la page (y ${Math.round(fin.bottom)}) passe sous la barre du bas (y ${Math.round(top)}) : marge basse manquante`]);
    });
    window.scrollTo(0, 0);
  }

  // Téléphone : une barre du bas de 5 entrées au plus, toutes nommées. Au-delà : pas de barre du bas.
  const barre = basses.map((f) => ({ f, n: interactifsDe(f).filter(visible) })).sort((a, b) => b.n.length - a.n.length)[0];
  if (tel && !barre) echecs.push(["barre du bas absente", `aucun élément fixe de la coquille collé au bas de la fenêtre (${W} px de large)`]);
  if (!tel && barre) echecs.push(["barre du bas sur grand écran", `${nom(barre.f)} est affiché à ${W} px de large`]);
  if (tel && barre) {
    const items = barre.n;
    if (items.length > 5) echecs.push(["barre du bas", `${items.length} entrées (5 au plus)`]);
    if (!R.erreur) {
      const attenduN = R.espace === "equipe" ? R.barre.length + (R.plus.length ? 1 : 0) : R.entrees.length;
      if (items.length !== attenduN) echecs.push(["barre du bas", `${items.length} entrée(s) affichée(s), les règles en donnent ${attenduN}`]);
    }
    items.forEach((it) => {
      if (!texte(it)) echecs.push(["barre du bas", `entrée sans libellé visible : ${nom(it)} « ${nomAcc(it).slice(0, 20)} »`]);
      const rI = rect(it);
      [...it.querySelectorAll("*")].filter((x) => [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).forEach((lib) => {
        const rl = rect(lib), lh = parseFloat(style(lib).lineHeight) || 16;
        if (lib.scrollWidth > lib.clientWidth + 1 || rl.height > lh * 1.5 || rl.left < rI.left - 1 || rl.right > rI.right + 1) {
          echecs.push(["libellé de la barre du bas coupé", `« ${texte(lib).slice(0, 20)} » : ${Math.round(rl.width)}x${Math.round(rl.height)} px dans une entrée de ${Math.round(rI.width)} px`]);
        }
      });
    });
  }

  // Zones à toucher, noms accessibles, infobulles des entrées sans libellé.
  const dedans = interactifsCoquille();
  mesurerCibles(dedans, tel ? 44 : 24, echecs, "zone à toucher (coquille)");
  dedans.filter(visible).forEach((e) => {
    if (!nomAcc(e)) echecs.push(["sans nom accessible", `${nom(e)} n'a ni libellé, ni aria-label, ni title`]);
    else if (e.tagName === "A" && (e.getAttribute("href") || "").startsWith("#/") && !texte(e) && !e.getAttribute("title")) {
      echecs.push(["entrée sans infobulle", `${nom(e)} (${e.getAttribute("href")}) n'a pas de title : sans libellé visible, elle en a besoin`]);
    }
  });

  // Contraste du texte de la coquille.
  mesurerContrastes(racines().filter(visible), echecs, avert);

  // Éléments fixes extérieurs qui recouvrent la coquille (traités par la Task 6) : avertissement.
  const barresFixes = fixes.filter((f) => genreDeBarre(f));
  if (barresFixes.length) {
    const exterieurs = [...document.querySelectorAll("body *")].filter((e) => !e.closest("[data-nav-coquille]") && style(e).position === "fixed" && visible(e));
    exterieurs.filter((e) => !exterieurs.some((x) => x !== e && x.contains(e))).forEach((e) => {
      const r = rect(e);
      barresFixes.forEach((f) => {
        const b = rect(f);
        if (Math.min(r.right, b.right) - Math.max(r.left, b.left) > 4 && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 4 && r.width < W * 0.95) {
          avert.push(["recouvrement de la coquille", `${nom(e)} recouvre ${nom(f)} (${genreDeBarre(f)})`]);
        }
      });
    });
  }
}

// ---- Menus et tiroirs ----
function ouvreurs() {
  document.querySelectorAll("[data-vn-i]").forEach((e) => e.removeAttribute("data-vn-i"));
  const liste = [];
  interactifsCoquille().filter(visible).forEach((e) => {
    const action = e.getAttribute("data-nav-action") || "";
    const popup = e.getAttribute("aria-haspopup");
    if (e.tagName === "A" && (e.getAttribute("href") || "").startsWith("#/") && !action && !popup) return;
    const n = nomAcc(e);
    const estOuvreur = (popup && popup !== "false") || action || /^(plus|compte|mon compte|menu)$/i.test(n);
    if (!estOuvreur || /repli|deplie|déplie|reduire|réduire|agrandir/i.test(n + " " + action)) return;
    e.setAttribute("data-vn-i", String(liste.length));
    liste.push({ i: liste.length, action, nom: n });
  });
  return liste;
}
const popupsVisibles = () => [...document.querySelectorAll(SEL_POPUP)].filter(visible);
function marquerPopups(ouvreur) {
  document.querySelectorAll("[data-vn-avant]").forEach((e) => e.removeAttribute("data-vn-avant"));
  popupsVisibles().forEach((e) => e.setAttribute("data-vn-avant", "1"));
  document.querySelectorAll("[data-vn-ouvreur]").forEach((e) => e.removeAttribute("data-vn-ouvreur"));
  const o = document.querySelector('[data-vn-i="' + ouvreur + '"]');
  if (o) o.setAttribute("data-vn-ouvreur", "1");
}
function mesurerPopups(o) {
  const W = largeur(), H = hauteur(), tel = W < o.seuilTelephone;
  const nouveaux = popupsVisibles().filter((e) => !e.hasAttribute("data-vn-avant"));
  const echecs = [], avert = [];
  nouveaux.forEach((p) => {
    const r = rect(p);
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) {
      echecs.push(["menu hors de l'écran", `${nom(p)} : x ${Math.round(r.left)} à ${Math.round(r.right)} (fenêtre ${W}), y ${Math.round(r.top)} à ${Math.round(r.bottom)} (fenêtre ${H})`]);
    }
    mesurerCibles(interactifsDe(p), tel ? 44 : 24, echecs, "zone à toucher (menu)");
    mesurerContrastes([p], echecs, avert);
    const liens = [...p.querySelectorAll("a[href]")].filter(visible);
    liens.forEach((a) => { if (!nomAcc(a)) echecs.push(["sans nom accessible", `${nom(a)} dans ${nom(p)}`]); });
  });
  return { nouveaux: nouveaux.length, noms: nouveaux.map(nom), echecs, avert };
}
const popupsEncoreOuverts = () => popupsVisibles().filter((e) => !e.hasAttribute("data-vn-avant")).map(nom);
const focusSurOuvreur = () => !!(document.activeElement && document.activeElement.closest("[data-vn-ouvreur]"));

window.__verifNav = { mesurer, regles: reglesSimples, voirEnTantQue, chercherLien, chercherPlus, ouvreurs, marquerPopups, mesurerPopups,
  popupsEncoreOuverts, focusSurOuvreur, popupsVisibles: () => popupsVisibles().length };
})();
"""

# Attente d'une page posée : vue présente et sans « Chargement », puis un moment de calme (aucune
# mutation du DOM), les animations en cours terminées et les polices chargées. Les mesures de
# largeur et de position en dépendent.
JS_ATTENTE = r"""async (o) => {
  const t0 = performance.now();
  const pret = () => { const v = document.getElementById("view"); return !!v && v.children.length > 0 && !v.querySelector(".loading"); };
  await new Promise((resolve) => {
    let dernier = performance.now();
    const obs = new MutationObserver(() => { dernier = performance.now(); });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    const tic = () => {
      const t = performance.now();
      if ((pret() && t - dernier >= o.calme) || t - t0 > o.max) { obs.disconnect(); resolve(); return; }
      setTimeout(tic, 20);
    };
    tic();
  });
  // Animations finies seulement : une animation sans fin (la pastille qui pulse) ne se termine jamais.
  const finies = document.getAnimations().filter((a) => { const t = a.effect && a.effect.getComputedTiming(); return t && Number.isFinite(t.endTime); });
  await Promise.race([Promise.all(finies.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 400))]);
  try { await document.fonts.ready; } catch (e) { /* polices indisponibles */ }
  return pret();
}"""

# --------------------------------------------------------------------------------------
# Scénarios et résultats
# --------------------------------------------------------------------------------------


@dataclass
class Scenario:
    moteur: str
    passe: str                  # "allume" ou "eteint"
    role: str                   # valeur de ?role= dans le banc
    largeur: int
    allumage: str = "aucun"     # "apercu" (localStorage), "reglage" (réglage de la promo) ou "aucun"
    espace: str = ""            # espace attendu de la coquille : "stagiaire" ou "equipe"
    sans_droits: bool = False   # le profil du banc perd is_founder (vrai compte de stagiaire)
    modules: str = ""           # ?modules= (scénario de modules fermés)
    voir_en_tant_que: bool = False

    @property
    def nom(self):
        variante = "-sans-droits" if self.sans_droits else ""
        variante += ("-" + self.modules) if self.modules else ""
        variante += "-voir-en-tant-que" if self.voir_en_tant_que else ""
        return "%s/%s/%s%s@%d" % (self.moteur, self.passe, self.role, variante, self.largeur)


class Resultat:
    """Ce qu'un scénario a constaté : vues jouées, échecs, avertissements."""

    def __init__(self, scenario):
        self.scenario = scenario
        self.vues = 0
        self.echecs = []        # (type, vue, détail)
        self.avert = []         # (catégorie, clé, vue, détail)
        self.clics = {1: 0, 2: 0}
        self.coquille = False   # la coquille est montée : ses contrôles sont joués
        self.console = []       # erreurs de console et de page, vidées à chaque vue
        self.deja_vues = set()  # erreurs de console déjà signalées dans ce scénario
        self.duree = 0.0

    def echec(self, type_, vue, detail):
        self.echecs.append((type_, vue, detail))

    def avertir(self, categorie, cle, vue, detail):
        self.avert.append((categorie, cle, vue, detail))

    def en_dict(self):
        return {"nom": self.scenario.nom, "vues": self.vues, "echecs": self.echecs, "avert": self.avert,
                "clics": self.clics, "duree": self.duree}


def construire_scenarios(moteurs, roles, largeurs, passes):
    """Les contextes à jouer, dans l'ordre : par moteur, la passe allumée puis la passe éteinte."""
    espace_de = {"stagiaire": "stagiaire", "prof": "equipe", "fondateur": "equipe"}
    # Le fondateur et le stagiaire du banc (fondateur lui aussi) ont l'aperçu de l'appareil ; le
    # formateur prof, qui n'est pas fondateur, n'en a pas : le réglage de la promo l'allume.
    allumage_de = {"stagiaire": "apercu", "prof": "reglage", "fondateur": "apercu"}
    etroit = [l for l in (1280, 375) if l in largeurs]
    scenarios = []
    for moteur in moteurs:
        if "allume" in passes:
            for role in roles:
                for l in largeurs:
                    scenarios.append(Scenario(moteur, "allume", role, l, allumage_de[role], espace_de[role]))
            if "stagiaire" in roles:
                for l in etroit:
                    scenarios.append(Scenario(moteur, "allume", "stagiaire", l, "reglage", "stagiaire", sans_droits=True))
                    scenarios.append(Scenario(moteur, "allume", "stagiaire", l, "apercu", "stagiaire", modules="depart"))
            if "prof" in roles:
                for l in etroit:
                    scenarios.append(Scenario(moteur, "allume", "prof", l, "reglage", "equipe", modules="depart"))
            if "fondateur" in roles:
                for l in etroit:
                    scenarios.append(Scenario(moteur, "allume", "fondateur", l, "apercu", "equipe", voir_en_tant_que=True))
        if "eteint" in passes:
            for role in roles:
                for l in largeurs:
                    scenarios.append(Scenario(moteur, "eteint", role, l))
    return scenarios


# --------------------------------------------------------------------------------------
# Navigateur, contexte, page
# --------------------------------------------------------------------------------------


def moteur_installe(moteur):
    """Le moteur déjà installé sur la machine quand celui qu'attend cette version de Playwright
    manque (cas de WebKit ici) : on le prend plutôt que d'en télécharger un."""
    racines = []
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH") not in (None, "", "0"):
        racines.append(pathlib.Path(os.environ["PLAYWRIGHT_BROWSERS_PATH"]))
    home = pathlib.Path.home()
    racines += [home / "AppData/Local/ms-playwright", home / ".cache/ms-playwright", home / "Library/Caches/ms-playwright"]
    motifs = {"webkit": ["webkit-*/Playwright.exe", "webkit-*/pw_run.sh"],
              "chromium": ["chromium-*/chrome-win*/chrome.exe", "chromium-*/chrome-linux*/chrome"]}[moteur]
    for racine in racines:
        for motif in motifs:
            trouves = sorted(racine.glob(motif))
            if trouves:
                return str(trouves[-1])
    return None


def lancer_navigateur(p, moteur):
    genre = getattr(p, moteur)
    try:
        return genre.launch()
    except ErreurPlaywright:
        chemin = moteur_installe(moteur)
        if not chemin:
            return None
        return genre.launch(executable_path=chemin)


STATIQUES = ("/js/", "/css/", "/assets/", "/vendor/", "/scripts/", "/_harness_supabase.js")
CACHE = {}   # url -> (statut, en-têtes, corps) : propre au processus, vide au démarrage


def servir_depuis_le_cache(route, lignes):
    """Les fichiers de l'app sont demandés une fois par processus, un à la fois, puis servis de la
    mémoire : le serveur du banc (ThreadingTCPServer, file d'attente de 5 connexions) refuse des
    connexions quand plusieurs navigateurs le chargent ensemble. Le document du banc passe tel quel.
    Pour ce contexte seulement, `lignes` s'ajoute à la fin du faux Supabase (le semis du réglage ou
    du profil) : le fichier du banc n'est jamais modifié sur le disque."""
    requete = route.request
    chemin = urllib.parse.urlparse(requete.url).path
    if requete.method != "GET" or not chemin.startswith(STATIQUES):
        route.continue_()
        return
    if requete.url not in CACHE:
        for essai in range(4):
            try:
                reponse = route.fetch()
                entetes = {k: v for k, v in reponse.headers.items() if k.lower() not in ("content-length", "content-encoding")}
                CACHE[requete.url] = (reponse.status, entetes, reponse.body())
                break
            except ErreurPlaywright:
                time.sleep(0.3 * (essai + 1))
        else:
            route.abort()
            return
    statut, entetes, corps = CACHE[requete.url]
    if lignes and chemin == "/_harness_supabase.js":
        corps += ("\ntry { " + " ".join(lignes) + " } catch (e) { console.error('[verifier_navigation] semis du banc impossible : ' + e); }\n").encode("utf-8")
    route.fulfill(status=statut, headers=entetes, body=corps)


def nouveau_contexte(navigateur, sc, options):
    mobile = sc.largeur < SEUIL_TELEPHONE
    reglages = {"viewport": {"width": sc.largeur, "height": HAUTEUR[sc.largeur]}, "locale": "fr-FR",
                "timezone_id": "Europe/Paris", "device_scale_factor": 2 if mobile else 1}
    if mobile:
        reglages.update(is_mobile=True, has_touch=True)
    contexte = navigateur.new_context(**reglages)
    contexte.set_default_timeout(8000)
    if sc.allumage == "apercu":
        contexte.add_init_script("try { localStorage.setItem('%s', '1'); } catch (e) { /* stockage bloqué */ }" % CLE_APERCU)
    lignes = []
    if sc.allumage == "reglage":
        lignes.append("FIXTURES.settings.push({ key: '%s', value: 'true', promo_id: 1 });" % CLE_REGLAGE)
    if sc.sans_droits:
        lignes.append("FIXTURES.user_profiles[0].is_founder = false;")
    contexte.route("**/*", lambda route: servir_depuis_le_cache(route, lignes))
    if options.get("script_init"):
        contexte.add_init_script(path=options["script_init"])
    return contexte


def nouvelle_page(contexte, res):
    page = contexte.new_page()
    page.on("pageerror", lambda e: res.console.append("erreur de page : %s" % e))
    page.on("console", lambda m: res.console.append("console.error : %s" % m.text) if m.type == "error" else None)
    page.on("dialog", lambda d: (res.console.append("boîte de dialogue inattendue : %s" % d.message), d.accept()))
    return page


COMPTEUR = itertools.count(1)


def charger(page, url, sc):
    cb = "%d-%d-%d" % (int(time.time() * 1000), os.getpid(), next(COMPTEUR))
    adresse = "%s?cb=%s&role=%s&date=%s&emargement=1" % (url, cb, sc.role, DATE_DU_BANC)
    if sc.modules:
        adresse += "&modules=" + sc.modules
    page.goto(adresse, wait_until="load", timeout=20000)
    page.evaluate(JS_OUTILS)
    attendre(page, calme=250, maximum=8000)


def attendre(page, calme=100, maximum=4000):
    """Attend la page posée ; une page pas prête (vide ou en « Chargement ») est attendue une fois de plus."""
    if not page.evaluate(JS_ATTENTE, {"calme": calme, "max": maximum}):
        page.evaluate(JS_ATTENTE, {"calme": 300, "max": 8000})


def aller_a(page, adresse):
    page.evaluate("(a) => { location.hash = a; }", adresse)
    page.wait_for_timeout(60)


def motif_du_clic(erreur):
    """Pourquoi un clic n'aboutit pas : l'élément qui recouvre la cible quand Playwright le nomme."""
    lignes = str(erreur).strip().splitlines()
    for ligne in lignes:
        if "intercepts pointer events" in ligne:
            return re.sub(r"\s+", " ", ligne).strip(" -")[:170]
    return lignes[0][:140] if lignes else "échec du clic"


def cliquer(page, res, vue, selecteur, quoi):
    """Vrai clic de souris (avec contrôle de recouvrement). Faux, et un échec, s'il n'aboutit pas."""
    try:
        page.locator(selecteur).first.click(timeout=4000)
        page.wait_for_timeout(60)
        return True
    except (DelaiDepasse, ErreurPlaywright) as e:
        res.echec("clic impossible", vue, "%s : %s" % (quoi, motif_du_clic(e)))
        return False


# --------------------------------------------------------------------------------------
# Une vue
# --------------------------------------------------------------------------------------


def verifier_vue(page, res, sc, titre, options):
    """Attend la page, la mesure, range échecs et avertissements."""
    attendre(page)
    res.vues += 1
    o = {"passe": sc.passe, "espace": sc.espace, "coquille": res.coquille, "seuilTelephone": SEUIL_TELEPHONE,
         "dette": list(DETTE_LOT_2 + DETTE_CONSTATEE_HORS_R10), "exception": EXCEPTION_ADMISE}
    avant = len(res.echecs)
    try:
        m = page.evaluate("(o) => window.__verifNav.mesurer(o)", o)
    except ErreurPlaywright as e:
        res.echec("mesure impossible", "%s/%s" % (sc.nom, titre), str(e).strip().splitlines()[0][:160])
        return
    vue = "%s/%s" % (sc.nom, titre)
    for type_, detail in m["echecs"]:
        res.echec(type_, vue, detail)
    for cle, detail in m["dettes"]:
        if sc.passe == "eteint":
            categorie = "ancienne navigation"
        else:
            categorie = "dette du lot 2, hors liste R10" if cle in DETTE_CONSTATEE_HORS_R10 else "dette du lot 2"
        res.avertir(categorie, cle, vue, detail)
    for type_, detail in m["avert"]:
        res.avertir(type_, detail, vue, detail)
    vider_console(res, vue)
    if options.get("captures") and len(res.echecs) > avant:
        dossier = pathlib.Path(options["captures"])
        dossier.mkdir(parents=True, exist_ok=True)
        try:
            page.screenshot(path=str(dossier / (re.sub(r"[^A-Za-z0-9@._-]+", "_", vue) + ".png")))
        except ErreurPlaywright:
            pass


def vider_console(res, vue):
    for message in res.console:
        cle = message[:200]
        if cle not in res.deja_vues:
            res.deja_vues.add(cle)
            res.echec("erreur de console", vue, cle)
    res.console.clear()


def route_courante(page):
    return page.evaluate("() => (location.hash || '').replace(/^#\\//, '').split('/')[0]")


def sous_vues(page, res, sc, route, options):
    """Chaque sous-onglet de la première barre de la page, ou chaque ligne du sommaire de Mon
    espace sur téléphone (la partie s'ouvre alors par son adresse)."""
    libelles = page.evaluate("""() => {
        const b = document.querySelector('#view .subtabs-bar');
        if (!b) return [];
        return [...b.querySelectorAll(':scope > .subtab')].map((x) => (x.childNodes[0] ? x.childNodes[0].textContent : x.textContent).trim());
    }""")
    for i, libelle in enumerate(libelles):
        titre = "%s/%s" % (route, libelle)
        try:
            page.locator("#view .subtabs-bar").first.locator(":scope > .subtab").nth(i).click(timeout=4000)
            page.wait_for_timeout(60)
        except (DelaiDepasse, ErreurPlaywright) as e:
            res.echec("clic impossible", "%s/%s" % (sc.nom, titre), "sous-onglet « %s » : %s" % (libelle, motif_du_clic(e)))
            continue
        verifier_vue(page, res, sc, titre, options)
    adresses = page.evaluate("() => [...document.querySelectorAll('#view nav.fiche-sommaire a.fiche-ligne')].map((a) => a.getAttribute('href'))")
    base = page.evaluate("() => location.hash")
    for adresse in adresses:
        aller_a(page, adresse)
        verifier_vue(page, res, sc, "%s/%s" % (route, adresse.rsplit("/", 1)[-1]), options)
    if adresses:
        aller_a(page, base)


# --------------------------------------------------------------------------------------
# Entrées de la coquille et menus
# --------------------------------------------------------------------------------------


def chercher_lien(page, entree):
    libelle = entree.get("libelle") or entree["route"]
    return page.evaluate("(a) => window.__verifNav.chercherLien(a[0], a[1], a[2])", [entree["route"], libelle, entree.get("court") or libelle])


def ouvrir_entree(page, res, sc, entree):
    """Ouvre une entrée comme la personne le ferait : un clic dans la coquille, deux par « Plus »
    sur téléphone quand l'entrée y est rangée. Sans coquille, par l'adresse."""
    route = entree["route"]
    vue = "%s/%s" % (sc.nom, route)
    if not res.coquille:
        aller_a(page, "#/" + route)
        return
    libelle = entree.get("libelle") or route
    infos = chercher_lien(page, entree)
    clics = 1
    if not infos["visibles"] and sc.largeur < SEUIL_TELEPHONE and page.evaluate("() => window.__verifNav.chercherPlus()"):
        if not cliquer(page, res, vue, '[data-vn-cible="1"]', "bouton « Plus »"):
            aller_a(page, "#/" + route)   # l'échec du clic sur « Plus » est déjà noté : pas de second échec pour la même cause
            return
        page.wait_for_timeout(250)
        infos = chercher_lien(page, entree)
        clics = 2
    if not infos["visibles"]:
        res.echec("entrée introuvable", vue, "« %s » (#/%s) n'est cliquable ni dans la coquille ni derrière « Plus » (%d lien(s) dans la coquille, aucun visible)"
                  % (libelle, route, infos["total"]))
        aller_a(page, "#/" + route)
        return
    if not cliquer(page, res, vue, '[data-vn-cible="1"]', "entrée « %s »" % libelle):
        aller_a(page, "#/" + route)
        return
    res.clics[clics] += 1
    if clics == 2:
        attendre(page, calme=150)
        if page.evaluate("() => window.__verifNav.popupsVisibles()"):
            # Le tiroir « Plus » doit se refermer quand on choisit une entrée.
            res.avertir("tiroir resté ouvert", "le tiroir reste ouvert après le choix d'une entrée", vue, "le tiroir reste ouvert après le choix de « %s »" % libelle)
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)


def verifier_menus(page, res, sc, options):
    """Chaque ouvreur de la coquille : sa fenêtre s'ouvre, tient dans l'écran, se ferme par Échap."""
    if options.get("sans_menus"):
        return
    ouvreurs = page.evaluate("() => window.__verifNav.ouvreurs()")
    vue = "%s/menus" % sc.nom
    if not ouvreurs:
        res.echec("aucun menu", vue, "aucun bouton de la coquille ne porte aria-haspopup ou data-nav-action : ni compte, ni « Plus »")
        return
    for ouvreur in ouvreurs:
        if ouvreur["action"] == "assistant" and options.get("sans_assistant"):
            continue
        quoi = "« %s »%s" % (ouvreur["nom"], (" (" + ouvreur["action"] + ")") if ouvreur["action"] else "")
        page.evaluate("(i) => window.__verifNav.marquerPopups(i)", ouvreur["i"])
        if not cliquer(page, res, vue, '[data-vn-i="%d"]' % ouvreur["i"], "ouvreur " + quoi):
            continue
        page.wait_for_timeout(300)
        m = page.evaluate("(o) => window.__verifNav.mesurerPopups(o)", {"seuilTelephone": SEUIL_TELEPHONE})
        if not m["nouveaux"]:
            res.echec("le menu ne s'ouvre pas", vue, "%s n'ouvre aucune fenêtre (role=dialog ou role=menu)" % quoi)
            continue
        for type_, detail in m["echecs"]:
            res.echec(type_, vue, "%s : %s" % (quoi, detail))
        for type_, detail in m["avert"]:
            res.avertir(type_, detail, vue, detail)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        restes = page.evaluate("() => window.__verifNav.popupsEncoreOuverts()")
        if restes:
            res.echec("Échap ne ferme pas", vue, "%s : %s reste ouvert" % (quoi, ", ".join(restes)))
            cliquer(page, res, vue, '[data-vn-i="%d"]' % ouvreur["i"], "ouvreur " + quoi)   # on le referme
            page.wait_for_timeout(250)
        elif not page.evaluate("() => window.__verifNav.focusSurOuvreur()"):
            res.avertir("focus non rendu", "%s : le focus ne revient pas sur le bouton qui a ouvert la fenêtre" % quoi, vue, "")
        vider_console(res, vue)


# --------------------------------------------------------------------------------------
# Jeu d'un contexte
# --------------------------------------------------------------------------------------


def regles_de_la_page(page, res, sc):
    r = page.evaluate("() => window.__verifNav.regles()")
    if "erreur" in r:
        res.echec("règles illisibles", sc.nom, "impossible de lire les règles de navigation de l'app dans la page (%s) : entrées de repli utilisées" % r["erreur"])
        entrees = [{"id": x, "route": x, "libelle": x, "court": x} for x in ENTREES_REPLI[sc.espace]]
        return {"entrees": entrees, "profilStagiaire": False, "espace": sc.espace, "actif": True, "plus": [], "barre": []}
    return r


def preparer_coquille(page, res, sc, regles):
    """Vérifie l'interrupteur et la présence de la coquille, une fois par contexte."""
    if not regles.get("actif"):
        res.echec("interrupteur", sc.nom, "la nouvelle navigation n'est pas allumée dans ce contexte (navigationV2Active() est faux) : l'allumage du banc a échoué")
    if regles.get("espace") != sc.espace:
        res.echec("espace du banc", sc.nom, "les règles donnent l'espace « %s », le scénario attendait « %s »" % (regles.get("espace"), sc.espace))
    if sc.sans_droits and regles.get("fondateur"):
        res.echec("profil du banc", sc.nom, "le profil « sans droits » est resté fondateur : le semis de is_founder dans le faux Supabase n'a pas pris")
    etat = page.evaluate("() => ({ nav: document.body.dataset.nav || null, espace: document.body.dataset.espace || null, coquilles: document.querySelectorAll('[data-nav-coquille]').length })")
    res.coquille = etat["nav"] == "v2" and etat["coquilles"] > 0
    if not res.coquille:
        res.echec("coquille absente", sc.nom, "body[data-nav] = %s, body[data-espace] = %s, %d élément(s) [data-nav-coquille] : les contrôles de la coquille sont ignorés"
                  % (etat["nav"], etat["espace"], etat["coquilles"]))


def parcourir_entrees(page, res, sc, entrees, options, avec_sous_vues=True):
    for entree in entrees:
        ouvrir_entree(page, res, sc, entree)
        verifier_vue(page, res, sc, entree["route"], options)
        if avec_sous_vues:
            sous_vues(page, res, sc, entree["route"], options)


def jouer_allume(page, res, sc, options):
    regles = regles_de_la_page(page, res, sc)
    preparer_coquille(page, res, sc, regles)
    if sc.voir_en_tant_que:
        jouer_voir_en_tant_que(page, res, sc, options)
        return
    verifier_vue(page, res, sc, "ouverture/" + route_courante(page), options)
    entrees = regles["entrees"]
    parcourir_entrees(page, res, sc, entrees, options)
    # Mon espace pour qui a un profil stagiaire sans entrée à ce nom (le fondateur : menu du compte).
    if regles.get("profilStagiaire") and "mon-suivi" not in [e["route"] for e in entrees]:
        aller_a(page, "#/mon-suivi")
        verifier_vue(page, res, sc, "mon-suivi", options)
        sous_vues(page, res, sc, "mon-suivi", options)
    if res.coquille:
        aller_a(page, "#/home")
        verifier_menus(page, res, sc, options)


def jouer_voir_en_tant_que(page, res, sc, options):
    """Le fondateur bascule « Voir en tant que » : la coquille change d'espace sans recharger la
    page, et l'entrée allumée suit la page affichée. Chaque espace voit toutes ses entrées."""
    if not res.coquille:
        return
    page.evaluate("() => { window.__vnMarqueur = 'avant'; }")
    for vu, espace in (("stagiaire", "stagiaire"), ("prof", "equipe"), (None, "equipe")):
        nom_vu = "voir-en-tant-que-%s" % (vu or "role-reel")
        erreur = page.evaluate("(r) => window.__verifNav.voirEnTantQue(r)", vu)
        if erreur:
            res.echec("règles illisibles", "%s/%s" % (sc.nom, nom_vu), erreur)
            return
        attendre(page, calme=250)
        sc_vu = replace(sc, espace=espace)
        if page.evaluate("() => window.__vnMarqueur") != "avant":
            res.echec("rechargement", "%s/%s" % (sc.nom, nom_vu), "la page a été rechargée par « Voir en tant que » (la coquille doit changer d'espace sur place)")
            return
        regles = regles_de_la_page(page, res, sc_vu)
        if regles.get("espace") != espace:
            res.echec("espace du banc", "%s/%s" % (sc.nom, nom_vu), "les règles donnent l'espace « %s », attendu « %s »" % (regles.get("espace"), espace))
        verifier_vue(page, res, sc_vu, "%s/ouverture/%s" % (nom_vu, route_courante(page)), options)
        parcourir_entrees(page, res, sc_vu, regles["entrees"], options, avec_sous_vues=False)


def jouer_eteint(page, res, sc, options):
    verifier_vue(page, res, sc, "ouverture/" + route_courante(page), options)
    routes = page.evaluate("""() => [...document.querySelectorAll('#tabs .tab')].filter((t) => t.getBoundingClientRect().width > 0)
        .map((t) => t.dataset.route)""")
    for route in dict.fromkeys(routes + ["mon-suivi"]):
        aller_a(page, "#/" + route)
        verifier_vue(page, res, sc, route, options)
        sous_vues(page, res, sc, route, options)


def jouer_scenario(navigateur, url, sc, options):
    res = Resultat(sc)
    debut = time.time()
    contexte = None
    try:
        contexte = nouveau_contexte(navigateur, sc, options)
        page = nouvelle_page(contexte, res)
        charger(page, url, sc)
        if sc.passe == "allume":
            jouer_allume(page, res, sc, options)
        else:
            jouer_eteint(page, res, sc, options)
    except (DelaiDepasse, ErreurPlaywright) as e:
        res.echec("le script n'a pas pu continuer", sc.nom, str(e).strip().splitlines()[0][:200])
    except Exception as e:   # une erreur du script lui-même : visible, et les autres scénarios continuent
        res.echec("erreur du script", sc.nom, "%s : %s" % (type(e).__name__, e))
    finally:
        if contexte:
            try:
                # Les fichiers encore en cours de lecture pour le cache se terminent avant la fermeture (sinon, du bruit).
                contexte.unroute_all(behavior="wait")
                contexte.close()
            except ErreurPlaywright:
                pass
    res.duree = time.time() - debut
    return res


def executer_lot(lot):
    """Un moteur, une liste de scénarios (exécuté dans un processus à part quand il y a plusieurs lots)."""
    moteur, url, options = lot["moteur"], lot["url"], lot["options"]
    scenarios = [Scenario(**s) for s in lot["scenarios"]]
    with sync_playwright() as p:
        navigateur = lancer_navigateur(p, moteur)
        if navigateur is None:
            return {"moteur": moteur, "indisponible": True, "resultats": []}
        try:
            resultats = [jouer_scenario(navigateur, url, sc, options).en_dict() for sc in scenarios]
        finally:
            navigateur.close()
    return {"moteur": moteur, "indisponible": False, "resultats": resultats}


# --------------------------------------------------------------------------------------
# Rapport
# --------------------------------------------------------------------------------------


def regrouper(elements, cle, vue):
    """[(clé, nombre d'occurrences, première vue)] du plus fréquent au plus rare."""
    comptes = {}
    for e in elements:
        k = cle(e)
        if k in comptes:
            comptes[k][0] += 1
        else:
            comptes[k] = [1, vue(e)]
    return sorted(((k, n, v) for k, (n, v) in comptes.items()), key=lambda x: -x[1])


def lister(groupes, limite):
    montres = groupes if limite is None else groupes[:limite]
    for cle, n, premiere in montres:
        print("    - %s%s" % (cle, "" if n == 1 else "  [%d fois, ex. %s]" % (n, premiere)))
    if len(montres) < len(groupes):
        print("    - ... et %d autre(s) cas (--tout pour les lister)" % (len(groupes) - len(montres)))


ENTETES_AVERTISSEMENTS = {
    "dette du lot 2": "dette du lot 2 : défilement de côté dans des conteneurs de page qui défilaient déjà sur main (ruling R10 : le lot 1 ne touche pas aux pages)",
    "dette du lot 2, hors liste R10": "dette du lot 2, hors liste R10 : débordement constaté sur main (passe éteinte), à confirmer par le contrôleur",
    "ancienne navigation": "ancienne navigation (interrupteur éteint) : défilements et débordements hérités de main, rien à faire dans le lot 1",
}


def imprimer_rapport(resultats, globaux, tout, debut):
    echecs = [e for r in resultats for e in r["echecs"]] + list(globaux)
    avert = [a for r in resultats for a in r["avert"]]
    vues = sum(r["vues"] for r in resultats)
    limite = None if tout else 3
    print()
    if echecs:
        print("ÉCHECS : %d, dont %d cas distinct(s)" % (len(echecs), len({(t, d) for t, _, d in echecs})))
        par_type = {}
        for e in echecs:
            par_type.setdefault(e[0], []).append(e)
        for type_, liste in sorted(par_type.items(), key=lambda kv: -len(kv[1])):
            print("  %s (%d)" % (type_, len(liste)))
            lister(regrouper(liste, lambda e: e[2], lambda e: e[1]), limite)
    else:
        print("ÉCHECS : aucun")
    if avert:
        print()
        print("AVERTISSEMENTS (sans échec)")
        par_categorie = {}
        for a in avert:
            par_categorie.setdefault(a[0], []).append(a)
        for categorie, liste in par_categorie.items():
            print("  %s" % ENTETES_AVERTISSEMENTS.get(categorie, categorie))
            lister([(k, n, v) for k, n, v in regrouper(liste, lambda a: a[1], lambda a: a[2])], limite)
    c1 = sum(r["clics"][1] for r in resultats)
    c2 = sum(r["clics"][2] for r in resultats)
    if c1 or c2:
        print()
        print("entrées de la coquille ouvertes en cliquant : %d à 1 clic, %d à 2 clics (par « Plus »)" % (c1, c2))
    print("durée : %.0f s" % (time.time() - debut))
    print("%d vues, %d échec(s)" % (vues, len(echecs)))
    return len(echecs)


# --------------------------------------------------------------------------------------
# Programme
# --------------------------------------------------------------------------------------


def repond(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError, ValueError):
        return False


def banc_perime(url):
    """Les fichiers CSS et JS d'index.html que le banc ne charge pas. _harness.html se régénère par
    `node _harness_build.mjs` après toute modification d'index.html : un banc périmé fait jouer l'ancienne
    page (coquille sans sa feuille de style...) et rend le résultat trompeur."""
    index = pathlib.Path(__file__).resolve().parent.parent / "index.html"
    if not index.exists():
        return []
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            banc = r.read().decode("utf-8", "replace")
    except (urllib.error.URLError, OSError):
        return []
    fichiers = lambda texte: set(re.findall(r'(?:href|src)="((?:css|js)/[^"?]+)', texte))
    return sorted(fichiers(index.read_text(encoding="utf-8", errors="replace")) - fichiers(banc))


def adresse_du_banc(demandee, garder_hote):
    url = urllib.parse.urlparse(demandee or BANC_PAR_DEFAUT)
    if url.path in ("", "/"):
        url = url._replace(path="/_harness.html")
    if url.hostname == "localhost" and not garder_hote:
        voisine = url._replace(netloc="127.0.0.1" + (":%d" % url.port if url.port else ""))
        if repond(urllib.parse.urlunparse(voisine)):
            print("(localhost réécrit en 127.0.0.1 : le banc y répond sans le délai d'IPv6 ; --garder-hote pour l'éviter)")
            url = voisine
    return urllib.parse.urlunparse(url)


def liste_de(texte, permis, nom, convertir=str):
    valeurs = [convertir(x) for x in texte.split(",") if x.strip()]
    for v in valeurs:
        if v not in permis:
            raise SystemExit("--%s : « %s » inconnu (choix : %s)" % (nom, v, ", ".join(str(p) for p in permis)))
    return valeurs


def main(argv=None):
    ap = argparse.ArgumentParser(description="Vérifie la nouvelle navigation au banc d'essai (Chromium et WebKit).")
    ap.add_argument("url", nargs="?", help="adresse de _harness.html (défaut %s)" % BANC_PAR_DEFAUT)
    ap.add_argument("--moteurs", default=",".join(MOTEURS))
    ap.add_argument("--roles", default=",".join(ROLES))
    ap.add_argument("--largeurs", default=",".join(str(l) for l in LARGEURS))
    ap.add_argument("--passes", default="allume,eteint")
    ap.add_argument("--sans-menus", action="store_true", help="ne joue pas les menus (boutons du compte et de « Plus » pas encore câblés)")
    ap.add_argument("--sans-assistant", action="store_true", help="ne joue pas le bouton « Assistant » (pas encore câblé)")
    ap.add_argument("--tout", action="store_true", help="liste chaque échec et chaque avertissement")
    ap.add_argument("--captures", metavar="DOSSIER", help="une capture d'écran par vue en échec")
    ap.add_argument("--jobs", type=int, default=0, help="processus en parallèle (défaut : deux par moteur)")
    ap.add_argument("--garder-hote", action="store_true", help="n'écrit pas localhost en 127.0.0.1")
    ap.add_argument("--script-init", metavar="FICHIER.js", help="code JavaScript injecté au démarrage de chaque page (mise au point d'une coquille de prototype)")
    args = ap.parse_args(argv)

    moteurs = liste_de(args.moteurs, MOTEURS, "moteurs")
    roles = liste_de(args.roles, ROLES, "roles")
    largeurs = liste_de(args.largeurs, LARGEURS, "largeurs", int)
    passes = liste_de(args.passes, ("allume", "eteint"), "passes")
    scenarios = construire_scenarios(moteurs, roles, largeurs, passes)
    if not scenarios:
        raise SystemExit("rien à jouer avec ces options")

    url = adresse_du_banc(args.url, args.garder_hote)
    if not repond(url):
        print("Le banc ne répond pas à %s (lancer le serveur « maquette-nav » du worktree)." % url)
        return 2
    absents = banc_perime(url)
    options = {"sans_menus": args.sans_menus, "sans_assistant": args.sans_assistant or args.sans_menus,
               "captures": args.captures, "script_init": os.path.abspath(args.script_init) if args.script_init else None}

    # Les scénarios d'un moteur sont répartis en autant de lots que de processus demandés.
    par_moteur = max(1, (args.jobs or 2 * len(moteurs)) // len(moteurs))
    lots = []
    for moteur in moteurs:
        propres = [asdict(sc) for sc in scenarios if sc.moteur == moteur]
        for i in range(par_moteur):
            if propres[i::par_moteur]:
                lots.append({"moteur": moteur, "scenarios": propres[i::par_moteur], "url": url, "options": options})
    print("%d scénario(s) sur %s, %d processus, banc %s" % (len(scenarios), " et ".join(moteurs), len(lots), url), flush=True)
    debut = time.time()
    sorties = []
    if len(lots) == 1:
        sorties.append(executer_lot(lots[0]))
    else:
        with concurrent.futures.ProcessPoolExecutor(max_workers=len(lots)) as pool:
            for futur in concurrent.futures.as_completed([pool.submit(executer_lot, lot) for lot in lots]):
                sorties.append(futur.result())
                print("  %s : %d scénario(s) joué(s) (%.0f s)" % (sorties[-1]["moteur"], len(sorties[-1]["resultats"]), time.time() - debut), flush=True)
    resultats, globaux = [], []   # globaux : échecs qui ne tiennent à aucune vue
    if absents:
        # Un banc périmé rend tout le reste trompeur : un échec à lui seul.
        globaux.append(("banc périmé", "banc", "_harness.html ne charge pas %s, qu'index.html charge : relancer `node _harness_build.mjs`" % ", ".join(absents)))
    for sortie in sorties:
        if sortie["indisponible"]:
            globaux.append(("moteur indisponible", sortie["moteur"], "aucun moteur %s installé : ses vues n'ont pas été jouées (l'écarter avec --moteurs)" % sortie["moteur"]))
        else:
            resultats.extend(sortie["resultats"])
    ordre = {sc.nom: i for i, sc in enumerate(scenarios)}
    resultats.sort(key=lambda r: ordre[r["nom"]])
    for r in resultats:
        print("  %-60s %4d vues, %3d échec(s), %5.1f s" % (r["nom"], r["vues"], len(r["echecs"]), r["duree"]))
    return 1 if imprimer_rapport(resultats, globaux, args.tout, debut) else 0


if __name__ == "__main__":
    for flux in (sys.stdout, sys.stderr):
        flux.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
