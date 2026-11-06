#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vérification de « Signaler un problème » au banc d'essai (spec 2026-10-28).

Usage
-----
    python outils/verifier_signalement.py [URL_DU_BANC] [--moteurs chromium,webkit] [--captures DOSSIER]

URL_DU_BANC : adresse de _harness.html (défaut http://127.0.0.1:8060/_harness.html, configuration
« banc-signalement » du launch.json de Dev/ECSR). Prérequis : `node _harness_build.mjs` après toute
modification d'index.html. Le banc ne parle jamais à la base réelle (faux Supabase).

Ce que le script joue, dans chaque moteur : stagiaire et formateur (non fondateurs) et fondateur, dans
l'ancienne navigation et la nouvelle (`?nav2=1`), à 1 280, 900 et 375 px :
  * les entrées du § 5.1 de la spec : présentes là où elles doivent l'être, absentes ailleurs (pas de
    ligne dans le menu du compte de l'équipe), 44 px au moins sur téléphone ; chacune ouvre la fenêtre,
    Échap la ferme et le focus revient au bon bouton (jamais sur body) ;
  * à 1 280 et 375 px, l'envoi : un double clic n'envoie qu'une fois, avec le contexte (adresse, version,
    appareil, navigateur, erreurs) ; un refus de la base garde le texte et le dit ; une image de
    4 000 × 3 000 générée dans la page part en JPEG de 700 000 caractères au plus ;
  * le fondateur : bloc « Problèmes signalés » dans la fenêtre, page #/problemes (sous-onglets, statut,
    réponse, capture, suppression) ; en aperçu Stagiaire, ni bloc ni page ; les autres rôles sont ramenés
    hors de #/problemes ;
  * partout : aucun défilement de côté, contraste AA des textes ajoutés, aucune erreur de console ;
  * une fois : aucun tiret cadratin dans les fichiers modifiés par la branche.
Sortie : les échecs, puis « N vues, M échec(s) » ; code 1 en cas d'échec, 2 si le banc ne répond pas.
Avec --captures : fenêtre ouverte pour le stagiaire et le formateur, ordinateur et téléphone, dans les deux
navigations, et la page du fondateur à 1 280 et 375 px (moteur Chromium).
"""

import argparse
import base64
import pathlib
import subprocess
import sys
import time
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verifier_navigation import lancer_navigateur  # noqa: E402

RACINE = pathlib.Path(__file__).resolve().parent.parent
LARGEURS = (1280, 900, 375)
TEXTES_AJOUTES = (".signalement-fenetre *, .sg-page *, .chatbot-signaler, .chatbot-signaler *, "
                  "[data-sg-entree], .nav-cote-signaler, [data-nav-coquille] [data-nav-action='signaler']")

CONTRASTE_JS = """(sel) => {
  const lire = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const rel = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fond = (e) => { for (let n = e; n; n = n.parentElement) { const c = lire(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const ko = [];
  document.querySelectorAll(sel).forEach((e) => {
    if (!e.getClientRects().length) return;
    const texte = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!texte) return;
    const cs = getComputedStyle(e); const c = lire(cs.color); if (!c) return;
    const l1 = rel(c), l2 = rel(fond(e)); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const taille = parseFloat(cs.fontSize), gras = parseInt(cs.fontWeight, 10) >= 700;
    if (ratio < ((taille >= 24 || (gras && taille >= 18.66)) ? 3 : 4.5)) ko.push(texte.slice(0, 40) + ' : ' + ratio.toFixed(2));
  });
  return ko;
}"""

IMAGE_JS = """() => new Promise((ok) => {
  const c = document.createElement('canvas'); c.width = 4000; c.height = 3000;
  const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 4000, 3000);
  grad.addColorStop(0, '#5B6C42'); grad.addColorStop(1, '#F1F4F0'); g.fillStyle = grad; g.fillRect(0, 0, 4000, 3000);
  for (let i = 0; i < 2500; i++) { g.fillStyle = 'hsl(' + (i * 37 % 360) + ',60%,' + (30 + i % 50) + '%)';
    g.fillRect((i * 997) % 4000, (i * 613) % 3000, 40 + i % 160, 30 + i % 120); }
  c.toBlob((b) => { const r = new FileReader(); r.onload = () => ok(r.result.split(',')[1]); r.readAsDataURL(b); }, 'image/png');
})"""


class Resultat:
    def __init__(self):
        self.vues = 0
        self.echecs = []

    def vue(self):
        self.vues += 1

    def echec(self, vue, detail):
        self.echecs.append("%s : %s" % (vue, detail))


def ouvrir_page(navigateur, base, role, nav2, largeur, apercu=None):
    contexte = navigateur.new_context(viewport={"width": largeur, "height": 812 if largeur < 700 else 900},
                                      has_touch=largeur < 700)
    if apercu:
        contexte.add_init_script("try { localStorage.setItem('ecsr_view_as', '%s'); } catch (e) {}" % apercu)
    page = contexte.new_page()
    erreurs = []
    page.on("console", lambda m: erreurs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    params = {"cb": str(time.time_ns()), "role": role, "signalements": "1"}
    if role != "fondateur":
        params["fondateur"] = "0"
    if nav2:
        params["nav2"] = "1"
    page.goto(base + "?" + urllib.parse.urlencode(params) + "#/mon-suivi")
    page.wait_for_function("() => !document.getElementById('app')?.classList.contains('hidden')"
                           " && (document.querySelector('[data-nav-coquille]') || document.querySelector('#tabs .tab'))",
                           timeout=20000)
    page.wait_for_timeout(700)
    return contexte, page, erreurs


def visible(page, sel):
    return page.evaluate("(s) => [...document.querySelectorAll(s)].some((e) => e.getClientRects().length > 0)", sel)


def hauteur(page, sel):
    return page.evaluate("(s) => { const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length);"
                         " return e ? e.getBoundingClientRect().height : 0; }", sel)


AVERTISSEMENTS = set()


def cliquer(page, sel):
    cible = page.locator(sel).locator("visible=true").first
    if sel != ".admin-badge":
        cible.click(timeout=4000)
        page.wait_for_timeout(250)
        return
    try:
        cible.click(timeout=4000)
    except Exception:
        # Hors de l'écran : le badge du nom de l'ancienne barre dépasse le bord à 900 px (dette connue de
        # main, rulings R10 et R11 du lot 1). Cliqué par script, signalé en avertissement. Tout autre clic
        # qui n'aboutit pas (élément recouvert, hors de l'écran) est un échec.
        AVERTISSEMENTS.add("%s hors de l'écran à %d px : cliqué par script" % (sel, page.evaluate("innerWidth")))
        cible.evaluate("(e) => e.click()")
    page.wait_for_timeout(250)


def fenetre_ouverte(page):
    return visible(page, "[data-nav-coquille='signaler'] .signalement-fenetre")


def fermer_par_echap(page, res, vue, focus_attendu):
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)
    if fenetre_ouverte(page):
        res.echec(vue, "Échap ne ferme pas la fenêtre")
        return
    sur = page.evaluate("(s) => { const a = document.activeElement; if (!a || a === document.body) return 'body';"
                        " return a.matches(s) ? 'ok' : (a.className || a.tagName); }", focus_attendu)
    if sur != "ok":
        res.echec(vue, "focus après Échap sur %s au lieu de %s" % (sur, focus_attendu))


def ouvrir_par(page, res, vue, gestes, focus_attendu, cible_44=None):
    """Joue les clics `gestes` (sélecteurs), attend la fenêtre, contrôle 44 px, puis Échap et le focus."""
    for sel in gestes:
        if not visible(page, sel):
            res.echec(vue, "entrée absente ou cachée : %s" % sel)
            return False
        if cible_44 == sel and hauteur(page, sel) < 44:
            res.echec(vue, "cible de moins de 44 px : %s (%.0f px)" % (sel, hauteur(page, sel)))
        cliquer(page, sel)
    if not fenetre_ouverte(page):
        res.echec(vue, "la fenêtre ne s'ouvre pas après %s" % " > ".join(gestes))
        return False
    page.wait_for_timeout(300)
    fermer_par_echap(page, res, vue, focus_attendu)
    return True


def gestes_de_l_entree(nav2, role, largeur):
    """L'entrée principale de la personne (spec § 5.1) : gestes, focus attendu au retour, cible de 44 px."""
    equipe = role in ("prof", "fondateur")
    if not nav2:
        return [".admin-badge", "[data-sg-entree='compte']"], ".admin-badge", "[data-sg-entree='compte']"
    if not equipe:
        compte = "[data-nav-coquille] button[data-nav-action='compte']"
        return [compte, "[data-nav-coquille='compte'] [data-nav-action='signaler']"], compte, \
            "[data-nav-coquille='compte'] [data-nav-action='signaler']"
    if largeur < 700:
        plus = "[data-nav-coquille='bas'] [data-nav-action='plus']"
        return [plus, "[data-nav-coquille='plus'] [data-nav-action='signaler']"], plus, \
            "[data-nav-coquille='plus'] [data-nav-action='signaler']"
    pied = "[data-nav-coquille='cote'] [data-nav-action='signaler']"
    return [pied], pied, None


def verifier_entrees(page, res, vue, nav2, role, largeur):
    gestes, focus, cible = gestes_de_l_entree(nav2, role, largeur)
    if nav2 != (page.evaluate("document.body.dataset.nav") == "v2"):
        res.echec(vue, "navigation inattendue (data-nav = %s)" % page.evaluate("document.body.dataset.nav"))
        return
    ouvrir_par(page, res, vue, gestes, focus, cible if largeur < 700 else None)
    # Le menu du compte de l'équipe (nouvelle navigation) n'a pas la ligne : le pied de barre la porte.
    if nav2 and role in ("prof", "fondateur"):
        compte = "[data-nav-coquille] button[data-nav-action='compte']"
        cliquer(page, compte)
        if visible(page, "[data-nav-coquille='compte'] [data-nav-action='signaler']"):
            res.echec(vue, "ligne « Signaler un problème » dans le menu du compte de l'équipe")
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
    # Fenêtre « Mon compte » de l'ancienne barre : « Problèmes signalés » chez le fondateur seulement.
    if not nav2:
        if page.get_attribute(".admin-badge", "aria-haspopup") != "dialog":
            res.echec(vue, "badge du nom sans aria-haspopup=dialog")
        cliquer(page, ".admin-badge")
        a_problemes = visible(page, "[data-sg-entree='problemes']")
        if a_problemes != (role == "fondateur"):
            res.echec(vue, "bouton « Problèmes signalés » %s" % ("présent" if a_problemes else "absent"))
        page.keyboard.press("Escape")
        page.evaluate("document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove())")
    # Panneau de l'Assistant (sauf l'équipe sur téléphone, où l'Assistant est dans « Plus »).
    if nav2 and role in ("prof", "fondateur") and largeur < 700:
        return
    bouton = "[data-nav-coquille] [data-nav-action='assistant']" if nav2 else "#chatbot-fab"
    if not visible(page, bouton):
        res.echec(vue, "bouton de l'Assistant introuvable (%s)" % bouton)
        return
    cliquer(page, bouton)
    lien = ".chatbot-signaler-btn"
    if page.get_attribute(lien, "aria-haspopup") != "dialog":
        res.echec(vue, "lien de l'Assistant sans aria-haspopup=dialog")
    ouvrir_par(page, res, vue + " (Assistant)", [lien], lien, lien if largeur < 700 else None)
    if not visible(page, "#chatbot-panel"):
        res.echec(vue, "le panneau de l'Assistant s'est fermé avec la fenêtre")
    page.evaluate("document.querySelector('#chatbot-panel .chatbot-close')?.click()")


def ouvrir_fenetre(page, nav2, role, largeur):
    gestes, _, _ = gestes_de_l_entree(nav2, role, largeur)
    for sel in gestes:
        cliquer(page, sel)
    page.wait_for_selector("[data-nav-coquille='signaler'] #sg-message", timeout=5000)
    page.wait_for_timeout(350)


def verifier_envoi(page, res, vue, nav2, role, largeur, captures, nom_capture):
    ouvrir_fenetre(page, nav2, role, largeur)
    if captures:
        # Le message du démarrage (6 s) masquerait une partie de la vue : retiré pour la capture seulement.
        page.evaluate("document.getElementById('toast')?.classList.add('hidden')")
        page.screenshot(path=str(captures / ("%s.png" % nom_capture)))
    for ko in page.evaluate(CONTRASTE_JS, TEXTES_AJOUTES):
        res.echec(vue, "contraste sous AA : %s" % ko)
    if page.evaluate("document.getElementById('sg-message').hasAttribute('maxlength')"):
        res.echec(vue, "le champ porte une limite technique (maxlength) qui coupe un collage sans le dire")
    resume_long = ".sg-mes .sg-mien-message summary"
    if largeur < 700 and visible(page, resume_long) and hauteur(page, resume_long) < 44:
        res.echec(vue, "résumé dépliable de « Mes signalements » sous 44 px (%.0f px)" % hauteur(page, resume_long))
    page.fill("#sg-message", "Le bouton Enregistrer ne réagit pas.")
    page.locator("[data-sg='envoyer']").dblclick()
    page.wait_for_timeout(600)
    envoyes = page.evaluate("window.__HARNESS_SIGNALEMENTS_ENVOYES || []")
    if len(envoyes) != 1:
        res.echec(vue, "%d envoi(s) après un double clic" % len(envoyes))
    else:
        ctx = envoyes[0].get("p_contexte") or {}
        manque = [k for k in ("adresse", "version", "appareil", "navigateur", "erreurs") if k not in ctx]
        if manque:
            res.echec(vue, "contexte sans %s" % ", ".join(manque))
    if fenetre_ouverte(page):
        res.echec(vue, "la fenêtre reste ouverte après l'envoi")
    # Refus de la base : texte gardé, raison dite.
    page.evaluate("window.__HARNESS_SIGNALER_FAIL = \"Tu as déjà envoyé 10 signalements aujourd'hui. Réessaie demain.\"")
    ouvrir_fenetre(page, nav2, role, largeur)
    page.fill("#sg-message", "Deuxième essai, refusé.")
    cliquer(page, "[data-sg='envoyer']")
    page.wait_for_timeout(400)
    erreur = page.evaluate("document.querySelector('.sg-erreur')?.textContent || ''")
    if "10 signalements" not in erreur or "Ton texte est gardé" not in erreur:
        res.echec(vue, "refus mal dit : « %s »" % erreur)
    if page.input_value("#sg-message") != "Deuxième essai, refusé.":
        res.echec(vue, "texte perdu après un refus")
    page.evaluate("window.__HARNESS_SIGNALER_FAIL = null")
    # Capture : une grande image part réduite, en JPEG.
    donnees = page.evaluate(IMAGE_JS)
    page.set_input_files(".sg-fichier", files=[{"name": "photo.png", "mimeType": "image/png",
                                                 "buffer": base64.b64decode(donnees)}])
    try:
        page.wait_for_selector(".sg-miniature img", timeout=15000)
    except Exception:
        res.echec(vue, "capture non préparée : %s" % page.evaluate("document.querySelector('.sg-erreur')?.textContent"))
        page.keyboard.press("Escape")
        return
    cliquer(page, "[data-sg='envoyer']")
    page.wait_for_timeout(600)
    dernier = (page.evaluate("window.__HARNESS_SIGNALEMENTS_ENVOYES || []") or [{}])[-1]
    capture = dernier.get("p_capture") or ""
    if not capture.startswith("data:image/jpeg;base64,") or len(capture) > 700000:
        res.echec(vue, "capture envoyée hors format (%d caractères)" % len(capture))
    # Fenêtre fermée (Échap) pendant un envoi qui échoue : la raison et le texte reviennent à la réouverture.
    page.evaluate("window.__HARNESS_SIGNALER_DELAI = 1200; window.__HARNESS_SIGNALER_FAIL = 'Réessaie dans un instant.'")
    ouvrir_fenetre(page, nav2, role, largeur)
    page.fill("#sg-message", "Envoi interrompu par Échap.")
    page.locator("[data-sg='envoyer']").click()
    page.keyboard.press("Escape")
    page.wait_for_timeout(1700)
    page.evaluate("window.__HARNESS_SIGNALER_FAIL = null")
    ouvrir_fenetre(page, nav2, role, largeur)
    erreur = page.evaluate("document.querySelector('.sg-erreur')?.textContent || ''")
    if "Réessaie dans un instant." not in erreur:
        res.echec(vue, "raison d'un échec perdue après Échap pendant l'envoi (« %s »)" % erreur)
    if page.input_value("#sg-message") != "Envoi interrompu par Échap.":
        res.echec(vue, "texte perdu après Échap pendant l'envoi")
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)


def verifier_fondateur(page, res, vue, largeur, captures, nom_capture):
    cliquer(page, ".admin-badge")
    cliquer(page, "[data-sg-entree='compte']")
    page.wait_for_selector("[data-nav-coquille='signaler'] #sg-message", timeout=5000)
    if not visible(page, ".sg-fondateur"):
        res.echec(vue, "bloc « Problèmes signalés » absent chez le fondateur")
    page.keyboard.press("Escape")
    page.evaluate("location.hash = '#/problemes'")
    page.wait_for_selector(".sg-page .sg-carte", timeout=8000)
    page.wait_for_timeout(400)
    onglets = page.evaluate("[...document.querySelectorAll('.sg-page .subtabs-bar button')].map((b) => b.textContent)")
    if onglets != ["À traiter (2)", "Réglés (1)", "Tous (3)"]:
        res.echec(vue, "sous-onglets : %s" % onglets)
    if captures:
        page.evaluate("document.getElementById('toast')?.classList.add('hidden')")
        page.screenshot(path=str(captures / ("%s.png" % nom_capture)), full_page=False)
    for ko in page.evaluate(CONTRASTE_JS, TEXTES_AJOUTES):
        res.echec(vue, "contraste sous AA (page) : %s" % ko)
    # Une réponse tapée sans être enregistrée part avec le statut et reste dans la carte redessinée.
    page.fill("[data-sg-id='101'] .sg-carte-reponse", "Réponse en cours")
    cliquer(page, "[data-sg-id='101'] [data-sg-statut='en_cours']")
    page.wait_for_timeout(400)
    if page.evaluate("document.querySelector(\"[data-sg-id='101'] [aria-pressed='true']\")?.dataset.sgStatut") != "en_cours":
        res.echec(vue, "statut non mis à jour sur la carte")
    statut = [a for a in page.evaluate("(window.__HARNESS_SIGNALEMENTS_APPELS || [])"
                                       ".filter((a) => a.name === 'traiter_signalement_app')")
              if (a.get("params") or {}).get("p_statut") == "en_cours"]
    if not statut or statut[-1]["params"].get("p_reponse") != "Réponse en cours":
        res.echec(vue, "la réponse tapée n'est pas partie avec le statut")
    if page.input_value("[data-sg-id='101'] .sg-carte-reponse") != "Réponse en cours":
        res.echec(vue, "la réponse tapée a disparu au clic sur un statut")
    capture = "[data-sg-id='101'] [data-sg='voir-capture']"
    if largeur < 700 and hauteur(page, capture) < 44:
        res.echec(vue, "« Voir la capture » sous 44 px (%.0f px)" % hauteur(page, capture))
    cliquer(page, "[data-sg-id='101'] [data-sg='voir-capture']")
    try:
        page.wait_for_selector("[data-sg-id='101'] img.sg-carte-capture", timeout=5000)
    except Exception:
        res.echec(vue, "capture non affichée")
    agrandir = "[data-sg-id='101'] [data-sg='agrandir']"
    if not visible(page, agrandir):
        res.echec(vue, "pas de bouton pour agrandir la capture")
    else:
        page.focus(agrandir)
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        if page.get_attribute(agrandir, "aria-pressed") != "true":
            res.echec(vue, "la capture ne s'agrandit pas au clavier")
    page.fill("[data-sg-id='102'] .sg-carte-reponse", "Corrigé, merci !")
    cliquer(page, "[data-sg-id='102'] [data-sg='repondre']")
    page.wait_for_timeout(400)
    appels = page.evaluate("(window.__HARNESS_SIGNALEMENTS_APPELS || []).filter((a) => a.name === 'traiter_signalement_app')")
    if not any((a.get("params") or {}).get("p_reponse") == "Corrigé, merci !" for a in appels):
        res.echec(vue, "réponse non transmise")
    page.evaluate("document.querySelector('.sg-page .subtabs-bar button:last-child')?.click()")
    page.wait_for_timeout(300)
    page.evaluate("window.__HARNESS_SUPPRESSION_VIDE = true")
    page.once("dialog", lambda d: d.accept())
    cliquer(page, "[data-sg-id='103'] [data-sg='supprimer']")
    page.wait_for_timeout(400)
    if not visible(page, "[data-sg-id='103']"):
        res.echec(vue, "carte retirée alors que rien n'a été supprimé")
    elif not page.evaluate("document.querySelector(\"[data-sg-id='103'] .sg-erreur\")?.textContent"):
        res.echec(vue, "suppression sans effet non signalée")
    page.evaluate("window.__HARNESS_SUPPRESSION_VIDE = false")
    page.once("dialog", lambda d: d.accept())
    cliquer(page, "[data-sg-id='103'] [data-sg='supprimer']")
    page.wait_for_timeout(400)
    if visible(page, "[data-sg-id='103']"):
        res.echec(vue, "carte supprimée toujours affichée")


def verifier_contexte_forge(page, res, vue):
    """Un contexte trafiqué (envoyé à la main, hors de l'app) ne fait pas tomber la page du fondateur."""
    page.evaluate("""async () => {
      const v = (document.querySelector('script[type=importmap]')?.textContent.match(/banc\\d+/) || [])[0];
      const db = await import('./js/db.js?v=' + v);
      await db.signalerProbleme({ message: 'Contexte forgé', contexte: { appareil: 'x', navigateur: 5, erreurs: [null, 'x'] } });
    }""")
    page.evaluate("location.hash = '#/problemes'")
    page.wait_for_timeout(1200)
    if visible(page, ".view-error-box") or not visible(page, ".sg-page"):
        res.echec(vue, "la page tombe sur un contexte forgé")
    elif "Contexte forgé" not in page.evaluate("document.querySelector('.sg-page')?.textContent || ''"):
        res.echec(vue, "le signalement au contexte forgé n'est pas affiché")


def verifier_global(page, res, vue, erreurs):
    if page.evaluate("document.documentElement.scrollWidth > window.innerWidth"):
        res.echec(vue, "défilement de côté (%d > %d)" % (page.evaluate("document.documentElement.scrollWidth"),
                                                        page.evaluate("window.innerWidth")))
    propres = [e for e in erreurs if "favicon" not in e]
    if propres:
        res.echec(vue, "erreur de console : %s" % propres[0][:160])


def jouer_vue(navigateur, base, res, vue, role, nav2, largeur, controles, apercu=None):
    """Ouvre la page, joue `controles(page, erreurs)` ; une exception (ouverture lente comprise) est un échec
    noté pour cette vue, jamais un arrêt du script."""
    res.vue()
    contexte = None
    try:
        contexte, page, erreurs = ouvrir_page(navigateur, base, role, nav2, largeur, apercu)
        controles(page, erreurs)
    except Exception as e:  # une vue qui casse ne doit pas arrêter les autres
        res.echec(vue, "exception : %s" % str(e).splitlines()[0][:200])
    finally:
        if contexte:
            contexte.close()


def jouer_moteur(p, moteur, base, res, captures):
    navigateur, raison = lancer_navigateur(p, moteur)
    if not navigateur:
        res.echec(moteur, "navigateur indisponible : %s" % raison)
        return
    try:
        for nav2 in (False, True):
            for role in ("stagiaire", "prof", "fondateur"):
                for largeur in LARGEURS:
                    vue = "%s %s %s %d" % (moteur, "nouvelle" if nav2 else "ancienne", role, largeur)

                    def controles(page, erreurs, vue=vue, nav2=nav2, role=role, largeur=largeur):
                        verifier_entrees(page, res, vue, nav2, role, largeur)
                        if largeur != 900:
                            dossier = captures if (captures and moteur == "chromium" and role != "fondateur") else None
                            verifier_envoi(page, res, vue, nav2, role, largeur, dossier,
                                           "%s-%s-%d" % ("nouvelle" if nav2 else "ancienne", role, largeur))
                        # Les autres rôles sont ramenés hors de la page du fondateur.
                        if role != "fondateur":
                            page.evaluate("location.hash = '#/problemes'")
                            page.wait_for_timeout(500)
                            if page.evaluate("location.hash") == "#/problemes":
                                res.echec(vue, "page #/problemes ouverte hors fondateur")
                        verifier_global(page, res, vue, erreurs)

                    jouer_vue(navigateur, base, res, vue, role, nav2, largeur, controles)
        for largeur in (1280, 375):
            vue = "%s ancienne fondateur page %d" % (moteur, largeur)

            def controles(page, erreurs, vue=vue, largeur=largeur):
                dossier = captures if (captures and moteur == "chromium") else None
                verifier_fondateur(page, res, vue, largeur, dossier, "fondateur-page-%d" % largeur)
                verifier_global(page, res, vue, erreurs)

            jouer_vue(navigateur, base, res, vue, "fondateur", False, largeur, controles)
        vue = "%s contexte forgé" % moteur
        jouer_vue(navigateur, base, res, vue, "fondateur", False, 1280,
                  lambda page, erreurs, vue=vue: verifier_contexte_forge(page, res, vue))

        # Fondateur en aperçu Stagiaire : ni bloc ni page.
        vue = "%s aperçu Stagiaire" % moteur

        def apercu(page, erreurs, vue=vue):
            cliquer(page, ".admin-badge")
            if visible(page, "[data-sg-entree='problemes']"):
                res.echec(vue, "« Problèmes signalés » visible en aperçu")
            cliquer(page, "[data-sg-entree='compte']")
            page.wait_for_selector("[data-nav-coquille='signaler'] #sg-message", timeout=5000)
            if visible(page, ".sg-fondateur"):
                res.echec(vue, "bloc du fondateur visible en aperçu")
            page.keyboard.press("Escape")
            page.evaluate("location.hash = '#/problemes'")
            page.wait_for_timeout(500)
            if page.evaluate("location.hash") == "#/problemes":
                res.echec(vue, "page #/problemes ouverte en aperçu")

        jouer_vue(navigateur, base, res, vue, "fondateur", False, 1280, apercu, apercu="stagiaire")
        vue2 = "%s aperçu Stagiaire nouvelle" % moteur

        def apercu_nouvelle(page, erreurs, vue=vue2):
            cliquer(page, "[data-nav-coquille] button[data-nav-action='compte']")
            ligne = "[data-nav-coquille='compte'] [data-nav-action='signaler']"
            if not visible(page, ligne):
                res.echec(vue, "ligne « Signaler un problème » absente du menu en aperçu Stagiaire")
                return
            cliquer(page, ligne)
            page.wait_for_selector("[data-nav-coquille='signaler'] #sg-message", timeout=5000)
            if visible(page, ".sg-fondateur"):
                res.echec(vue, "bloc du fondateur visible en aperçu")
            page.keyboard.press("Escape")
            page.evaluate("location.hash = '#/problemes'")
            page.wait_for_timeout(500)
            if page.evaluate("location.hash") == "#/problemes":
                res.echec(vue, "page #/problemes ouverte en aperçu")

        jouer_vue(navigateur, base, res, vue2, "fondateur", True, 1280, apercu_nouvelle, apercu="stagiaire")
    finally:
        navigateur.close()


def verifier_tirets(res):
    noms = subprocess.run(["git", "diff", "--name-only", "main...HEAD"], cwd=RACINE, capture_output=True,
                          text=True, encoding="utf-8").stdout.split()
    for nom in noms:
        chemin = RACINE / nom
        # Le tiret cadratin par son code : ce fichier ne doit pas le contenir non plus.
        if chemin.is_file() and chr(0x2014) in chemin.read_text(encoding="utf-8", errors="ignore"):
            res.echec("fichiers", "tiret cadratin dans %s" % nom)
    res.vue()


def main(argv=None):
    global LARGEURS
    parseur = argparse.ArgumentParser(description="Vérifie « Signaler un problème » au banc d'essai.")
    parseur.add_argument("url", nargs="?", default="http://127.0.0.1:8060/_harness.html")
    parseur.add_argument("--moteurs", default="chromium,webkit")
    parseur.add_argument("--captures", default=None)
    parseur.add_argument("--largeurs", default=",".join(str(l) for l in LARGEURS),
                         help="largeurs jouées, par exemple 375 (défaut : 1280,900,375)")
    args = parseur.parse_args(argv)
    LARGEURS =tuple(int(l) for l in args.largeurs.split(",") if l.strip())
    try:
        urllib.request.urlopen(args.url, timeout=5).read(64)
    except Exception as e:
        print("Le banc ne répond pas (%s) : %s" % (args.url, e))
        return 2
    captures = None
    if args.captures:
        captures = pathlib.Path(args.captures)
        captures.mkdir(parents=True, exist_ok=True)
    res = Resultat()
    verifier_tirets(res)
    with sync_playwright() as p:
        for moteur in [m.strip() for m in args.moteurs.split(",") if m.strip()]:
            jouer_moteur(p, moteur, args.url, res, captures)
    for a in sorted(AVERTISSEMENTS):
        print("AVERTISSEMENT " + a)
    for e in res.echecs:
        print("ÉCHEC " + e)
    print("%d vues, %d échec(s)" % (res.vues, len(res.echecs)))
    return 1 if res.echecs else 0


if __name__ == "__main__":
    sys.exit(main())
