#!/usr/bin/env python3
"""Captures de l'app dans ses deux habillages (« ECSR Promo » par défaut, « Couleurs ECF »), et comparaison au pixel.

Pourquoi : le lot 3 remplace chaque couleur écrite en dur par une variable CSS. La preuve que l'habillage par défaut
ne bouge pas d'un seul pixel, c'est ce script : on photographie les mêmes vues avant et après chaque étape, puis on
compare les deux jeux image par image.

    python outils/captures_habillages.py [BANC] --sortie DOSSIER
        [--habillages ecsr,ecf] [--moteurs chromium,webkit] [--largeurs 1280,375] [--roles stagiaire,prof,fondateur]
        [--jobs N] [--comparer DOSSIER_AVANT] [--seulement-comparer]

  * BANC : adresse de _harness.html (défaut http://127.0.0.1:8060/_harness.html).
  * Levier d'habillage, le même pour tout robot : avant le chargement, `localStorage.ecsr_habillage = JSON.stringify({ nom })`
    (nom : « ecsr » ou « ecf »). Le script d'avant-peinture de l'app (js/habillage-avant-peinture.js) pose alors
    `data-skin` lui-même : plus rien n'est forcé depuis le robot.
  * Vues, par rôle (la nouvelle navigation est allumée comme dans outils/verifier_navigation.py, dont les aides sont
    réutilisées : aucun chemin de page n'est écrit ici) : chaque entrée de la coquille et chacun de ses sous-onglets,
    le menu du compte ouvert, le tiroir « Plus » (téléphone, équipe), Mes préférences, Nouveautés, la feuille
    d'émargement en aperçu d'impression (équipe), la page Qualiopi (fondateur) ; et, hors rôle, l'écran de connexion
    (`?role=anon`).
  * Sortie : DOSSIER/<moteur>/<habillage>/<role>-<largeur>-<vue>.png (page entière), et DOSSIER/planche.html : pour
    chaque vue, les deux habillages côte à côte, téléphone et ordinateur (chemins relatifs : le dossier s'ouvre tel quel).
  * `--comparer AVANT` : le dossier qui vient d'être produit contre AVANT, image par image. Une vue absente d'un côté
    compte comme différente. Code de sortie 1 s'il y a la moindre différence ou la moindre vue absente.
  * `--seulement-comparer` : ne photographie rien, compare deux dossiers déjà là (--sortie contre --comparer).
  * `--documents` : à la place des vues ci-dessus, la preuve que les documents imprimés ne bougent pas avec l'habillage
    (lot 3, décision H5) : chaque document (feuille d'émargement, dossier Qualiopi) est photographié seul, sous le média
    « print », avec `data-skin` forcé en « ecsr » puis en « ecf », et les deux images sont comparées au pixel. Ils doivent
    être identiques. Les certificats et attestations ne se montent qu'à l'impression réelle : ils ne sont pas photographiés
    ici (leur règle de garde, la règle 6 du test des jetons, couvre leur CSS). Code de sortie 1 au moindre écart.

Ce qui rend les captures répétables : date du banc figée (?date=), animations coupées, mouvement réduit, curseur de
saisie caché, polices et images attendues, et une même suite de vues dans un même ordre pour chaque contexte.
"""

import argparse
import concurrent.futures
import html
import json
import pathlib
import re
import sys
import time
import unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import verifier_navigation as vn   # noqa: E402  (le chemin ci-dessus doit précéder l'import)
from verifier_navigation import (   # noqa: E402
    CLE_APERCU, HAUTEUR, attendre, charger, nouveau_contexte, ouvrir_entree, regles_de_la_page,
)
from playwright.sync_api import Error as ErreurPlaywright   # noqa: E402
from playwright.sync_api import TimeoutError as DelaiDepasse   # noqa: E402
from playwright.sync_api import sync_playwright   # noqa: E402

BANC_PAR_DEFAUT = "http://127.0.0.1:8060/_harness.html"
HABILLAGES = ("ecsr", "ecf")
NOMS_HABILLAGES = {"ecsr": "ECSR Promo", "ecf": "Couleurs ECF"}
MOTEURS = ("chromium", "webkit")
ROLES = ("stagiaire", "prof", "fondateur")
LARGEURS = (1280, 375)
HAUTEUR_MAX = 12000       # px CSS : la hauteur au-delà de laquelle une capture est coupée
CLE_HABILLAGE = "ecsr_habillage"   # localStorage : { "nom": "ecsr" | "ecf" }

# Le même rôle et le même allumage que construire_scenarios du vérificateur : le fondateur et le stagiaire du banc ont
# l'aperçu de l'appareil, le formateur (qui n'est pas fondateur) a le réglage de la promo.
ESPACE_DE = {"stagiaire": "stagiaire", "prof": "equipe", "fondateur": "equipe"}
ALLUMAGE_DE = {"stagiaire": "apercu", "prof": "reglage", "fondateur": "apercu"}

# Attend que toute image de la page soit décodée : une image arrivée tard ferait deux captures différentes.
JS_PRET = """async () => {
  await document.fonts.ready;
  const images = [...document.images];
  await Promise.all(images.map((i) => i.complete ? null : new Promise((ok) => { i.addEventListener('load', ok); i.addEventListener('error', ok); setTimeout(ok, 4000); })));
  await Promise.all(images.map((i) => i.decode ? i.decode().catch(() => null) : null));
  // Les transitions en cours (fond d'un bouton survolé ou ciblé : 0,15 s) donnent, à la capture, un dernier pixel
  // d'anticrénelage qui varie d'un passage à l'autre : on attend la fin de toute animation finie, puis deux images peintes.
  const finies = () => document.getAnimations().filter((a) => {
    if (a.playState !== 'running' && a.playState !== 'pending') return false;
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
    return !t || Number.isFinite(t.endTime);
  });
  const fin = Date.now() + 2000;
  while (finies().length && Date.now() < fin) await new Promise((ok) => setTimeout(ok, 40));
  // Le contour de focus arrondi du bouton du compte (menu latéral, resté ciblé après « Échap ») est tramé de deux façons
  // selon l'historique de peinture du contexte : trois pixels d'anticrénelage à la page des préférences, un contexte
  // sur huit environ. Rendre le focus à son élément (même contour, même place) le repeint toujours de la même façon :
  // 8 contextes de suite identiques, là où les autres tentatives de repeinture (couche composée, masquage de la page)
  // gardaient la variation ou la déplaçaient. Les champs de saisie ne sont pas touchés (le curseur est caché de toute façon).
  const cible = document.activeElement;
  if (cible && cible !== document.body && cible.matches(':focus-visible') && !/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) {
    cible.blur();
    cible.focus({ focusVisible: true });
  }
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  return true;
}"""

# Le bouton d'impression de la feuille ne doit pas ouvrir la boîte d'impression du navigateur.
JS_SANS_IMPRESSION = "window.print = () => {};"


def js_habillage(nom):
    """Le script d'initialisation : le levier d'habillage, rien d'autre (l'app pose data-skin elle-même)."""
    return "try { localStorage.setItem(%s, %s); } catch (e) { /* stockage bloqué */ }" % (
        json.dumps(CLE_HABILLAGE), json.dumps(json.dumps({"nom": nom})))


def slug(texte):
    t = unicodedata.normalize("NFD", texte or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-") or "vue"


# --------------------------------------------------------------------------------------
# Prise des vues
# --------------------------------------------------------------------------------------


class Prise:
    """Les vues d'un contexte : une page, un rôle, une largeur, un habillage."""

    def __init__(self, page, dossier, prefixe):
        self.page = page
        self.dossier = dossier
        self.prefixe = prefixe       # « stagiaire-1280 »
        self.faites = []
        self.erreurs = []

    def photographier(self, vue, apres=None, element=None):
        """Attend la page posée, puis la photographie en entier. `vue` : l'identifiant du nom de fichier.
        `element` : un sélecteur ; la capture ne porte alors que cet élément (un document imprimé, sans la page autour)."""
        p = self.page
        try:
            attendre(p, calme=150)
            p.evaluate(JS_PRET)
            p.wait_for_timeout(120)
            if apres:
                apres()
            if vue in self.faites:
                # Deux vues de même identifiant s'écraseraient en silence : une comparaison qui ne verrait que la dernière.
                self.erreurs.append((vue, "identifiant de vue déjà pris dans ce contexte"))
                return
            fichier = self.dossier / ("%s-%s.png" % (self.prefixe, vue))
            if element:
                p.locator(element).first.screenshot(path=str(fichier), animations="disabled", caret="hide", timeout=8000)
                self.faites.append(vue)
                return
            # Une page très longue (Nouveautés sur téléphone) dépasse la limite de WebKit (32 767 px de l'image) : au-delà
            # de HAUTEUR_MAX px CSS, on garde le haut de la page, pour les deux moteurs.
            dims = p.evaluate("() => ({ l: Math.max(document.documentElement.scrollWidth, innerWidth), h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) })")
            if dims["h"] > HAUTEUR_MAX:
                p.screenshot(path=str(fichier), clip={"x": 0, "y": 0, "width": dims["l"], "height": HAUTEUR_MAX}, full_page=True,
                             animations="disabled", caret="hide")
            else:
                p.screenshot(path=str(fichier), full_page=True, animations="disabled", caret="hide")
            self.faites.append(vue)
        except (DelaiDepasse, ErreurPlaywright) as e:
            self.erreurs.append((vue, str(e).strip().splitlines()[0][:160]))


def sous_vues(prise, res, sc, route):
    """Chaque sous-onglet de la première barre de la page, ou chaque ligne du sommaire de Mon espace sur téléphone."""
    p = prise.page
    libelles = p.evaluate("""() => {
        const b = document.querySelector('#view .subtabs-bar');
        if (!b) return [];
        return [...b.querySelectorAll(':scope > .subtab')].map((x) => (x.childNodes[0] ? x.childNodes[0].textContent : x.textContent).trim());
    }""")
    for i, libelle in enumerate(libelles):
        try:
            p.locator("#view .subtabs-bar").first.locator(":scope > .subtab").nth(i).click(timeout=4000)
            p.wait_for_timeout(80)
        except (DelaiDepasse, ErreurPlaywright) as e:
            prise.erreurs.append(("%s--%s" % (route, slug(libelle)), "clic impossible : " + str(e).strip().splitlines()[0][:120]))
            continue
        prise.photographier("%s--%s" % (route, slug(libelle)))
    adresses = p.evaluate("() => [...document.querySelectorAll('#view nav.fiche-sommaire a.fiche-ligne')].map((a) => a.getAttribute('href'))")
    base = p.evaluate("() => location.hash")
    for adresse in adresses:
        vn.aller_a(p, adresse)
        prise.photographier("%s--%s" % (route, slug(adresse.rsplit("/", 1)[-1])))
    if adresses:
        vn.aller_a(p, base)


def menus(prise):
    """Le menu du compte ouvert, le tiroir « Plus » (téléphone, équipe) : chaque ouvreur de la coquille, photographié ouvert."""
    p = prise.page
    for ouvreur in p.evaluate("() => window.__verifNav.ouvreurs()"):
        nom = {"compte": "menu-compte", "plus": "tiroir-plus"}.get(ouvreur["action"] or "", "menu-" + slug(ouvreur["nom"]))
        p.evaluate("(i) => window.__verifNav.marquerPopups(i)", ouvreur["i"])
        try:
            p.locator('[data-vn-i="%d"]' % ouvreur["i"]).first.click(timeout=4000)
        except (DelaiDepasse, ErreurPlaywright) as e:
            prise.erreurs.append((nom, "clic impossible : " + str(e).strip().splitlines()[0][:120]))
            continue
        p.wait_for_timeout(300)
        prise.photographier(nom)
        p.keyboard.press("Escape")
        p.wait_for_timeout(300)
        if p.evaluate("() => window.__verifNav.popupsEncoreOuverts()"):
            # Échap n'a pas refermé la fenêtre : on rebascule le bouton, la suite des vues ne doit pas la porter.
            try:
                p.locator('[data-vn-i="%d"]' % ouvreur["i"]).first.click(timeout=4000)
            except (DelaiDepasse, ErreurPlaywright):
                pass
            p.wait_for_timeout(250)


def feuille_d_emargement(prise, sc, element=None):
    """La feuille d'une séance ouverte, en aperçu d'impression : le bouton « Imprimer la feuille » monte le document
    imprimable dans la page (window.print est neutralisé), puis on photographie sous le média « print »."""
    p = prise.page
    p.evaluate(JS_SANS_IMPRESSION)
    vn.aller_a(p, "#/emargement")
    attendre(p, calme=150)
    # Une case de la semaine porte la séance du jour ouverte (le banc ouvre le matin) : « Ouverte · N sur M signés ».
    cases = p.locator("a.em-case-ouverte")
    if cases.count() == 0:
        prise.erreurs.append(("feuille-emargement", "aucune séance ouverte sur la semaine du banc : vue ignorée"))
        return
    try:
        cases.first.click(timeout=4000)
        p.wait_for_timeout(150)
        attendre(p, calme=200)
        p.get_by_role("button", name="Imprimer la feuille").first.click(timeout=4000)
        p.wait_for_timeout(200)
    except (DelaiDepasse, ErreurPlaywright) as e:
        prise.erreurs.append(("feuille-emargement", "ouverture impossible : " + str(e).strip().splitlines()[0][:120]))
        return
    p.emulate_media(media="print", reduced_motion="reduce")
    try:
        prise.photographier("feuille-emargement", element=element)
    finally:
        p.emulate_media(media="screen", reduced_motion="reduce")


def jouer_role(navigateur, url, tache, dossier):
    """Toutes les vues d'un rôle à une largeur et dans un habillage ; la liste (faites, erreurs)."""
    moteur, habillage, role, largeur = tache["moteur"], tache["habillage"], tache["role"], tache["largeur"]
    sortie = pathlib.Path(dossier) / moteur / habillage
    sortie.mkdir(parents=True, exist_ok=True)
    if role == "anon":
        sc = vn.Scenario(moteur, "eteint", "anon", largeur)
    else:
        sc = vn.Scenario(moteur, "allume", role, largeur, ALLUMAGE_DE[role], ESPACE_DE[role])
    prise = Prise(None, sortie, "%s-%d" % (role, largeur))
    res = vn.Resultat(sc)
    contexte = None
    try:
        contexte = nouveau_contexte(navigateur, sc, {})
        contexte.add_init_script(js_habillage(habillage))
        page = vn.nouvelle_page(contexte, res)
        page.emulate_media(reduced_motion="reduce")
        prise.page = page
        charger(page, url, sc)
        if role == "anon":
            prise.photographier("connexion")
            return prise.faites, prise.erreurs
        regles = regles_de_la_page(page, res, sc)
        res.profil_stagiaire = bool(regles.get("profilStagiaire"))
        vn.preparer_coquille(page, res, sc, regles)
        if not res.coquille:
            prise.erreurs.append(("coquille", "la nouvelle navigation n'est pas allumée dans ce contexte"))
        entrees = regles["entrees"]
        for entree in entrees:
            ouvrir_entree(page, res, sc, entree)
            prise.photographier(entree["route"])
            sous_vues(prise, res, sc, entree["route"])
        # Les menus avant la rubrique Nouveautés : l'ouvrir marque tout comme lu, et le point du compte s'éteindrait.
        vn.aller_a(page, "#/home")
        menus(prise)
        routes = [e["route"] for e in entrees]
        for route in (["mon-suivi"] if res.profil_stagiaire else []) + ["preferences", "nouveautes"]:
            if route not in routes:
                vn.aller_a(page, "#/" + route)
                prise.photographier(route)
                sous_vues(prise, res, sc, route)
        if ESPACE_DE[role] == "equipe":
            feuille_d_emargement(prise, sc)
        if role == "fondateur":
            vn.aller_a(page, "#/qualiopi")
            prise.photographier("qualiopi")
    except (DelaiDepasse, ErreurPlaywright) as e:
        prise.erreurs.append(("script", str(e).strip().splitlines()[0][:200]))
    except Exception as e:   # une erreur du script lui-même : dite, et les autres contextes continuent
        prise.erreurs.append(("script", "%s : %s" % (type(e).__name__, e)))
    finally:
        # Ce que les aides du vérificateur ont consigné (clic d'entrée impossible, coquille absente...) est une erreur de la prise.
        for type_, vue, detail in res.echecs:
            prise.erreurs.append((vue, "%s : %s" % (type_, detail)))
        if contexte:
            try:
                contexte.unroute_all(behavior="wait")
                contexte.close()
            except ErreurPlaywright:
                pass
    return prise.faites, prise.erreurs


def jouer_documents(navigateur, url, moteur, habillage, dossier):
    """Les documents imprimés dans un habillage forcé : la feuille d'émargement (formateur) et le dossier de la formation
    Qualiopi (fondateur), chacun seul, sous le média « print ». La liste (faites, erreurs)."""
    sortie = pathlib.Path(dossier) / "documents" / moteur / habillage
    sortie.mkdir(parents=True, exist_ok=True)
    faites, erreurs = [], []
    for role, document in (("prof", "feuille-emargement"), ("fondateur", "qualiopi-dossier")):
        sc = vn.Scenario(moteur, "allume", role, 1280, ALLUMAGE_DE[role], ESPACE_DE[role])
        prise = Prise(None, sortie, "%s-1280" % role)
        res = vn.Resultat(sc)
        contexte = None
        try:
            contexte = nouveau_contexte(navigateur, sc, {})
            contexte.add_init_script(js_habillage(habillage))
            page = vn.nouvelle_page(contexte, res)
            page.emulate_media(reduced_motion="reduce")
            prise.page = page
            charger(page, url, sc)
            regles = regles_de_la_page(page, res, sc)
            vn.preparer_coquille(page, res, sc, regles)
            if document == "feuille-emargement":
                feuille_d_emargement(prise, sc, element="#emargement-print")
            else:
                page.evaluate(JS_SANS_IMPRESSION)
                vn.aller_a(page, "#/qualiopi")
                attendre(page, calme=200)
                page.wait_for_function("() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Dossier de la formation'); return b && !b.disabled; }", timeout=8000)
                page.get_by_role("button", name="Dossier de la formation").first.click(timeout=4000)
                page.wait_for_selector("#qualiopi-print .qdoc", state="attached", timeout=8000)
                page.emulate_media(media="print", reduced_motion="reduce")
                prise.photographier("qualiopi-dossier", element="#qualiopi-print")
        except (DelaiDepasse, ErreurPlaywright) as e:
            prise.erreurs.append((document, str(e).strip().splitlines()[0][:200]))
        except Exception as e:
            prise.erreurs.append((document, "%s : %s" % (type(e).__name__, e)))
        finally:
            for type_, vue, detail in res.echecs:
                prise.erreurs.append((vue, "%s : %s" % (type_, detail)))
            if contexte:
                try:
                    contexte.unroute_all(behavior="wait")
                    contexte.close()
                except ErreurPlaywright:
                    pass
        faites += prise.faites
        erreurs += prise.erreurs
    return faites, erreurs


def photographier_documents(url, dossier, moteurs):
    """Photographie les documents imprimés en « ecsr » et en « ecf » (data-skin forcé), puis les compare. Vrai si identiques."""
    problemes = []
    with sync_playwright() as p:
        for moteur in moteurs:
            navigateur, raison = vn.lancer_navigateur(p, moteur)
            if navigateur is None:
                problemes.append("moteur %s indisponible : %s" % (moteur, raison))
                continue
            try:
                for habillage in HABILLAGES:
                    faites, erreurs = jouer_documents(navigateur, url, moteur, habillage, dossier)
                    print("%s / %s : %d document(s) photographié(s)" % (moteur, habillage, len(faites)), flush=True)
                    problemes += ["%s/%s %s : %s" % (moteur, habillage, vue, raison) for vue, raison in erreurs]
            finally:
                navigateur.close()
    for pb in problemes:
        print("  ! " + pb)
    ok = not problemes
    racine = pathlib.Path(dossier) / "documents"
    for moteur in moteurs:
        a, b = racine / moteur / "ecsr", racine / moteur / "ecf"
        if not a.is_dir() or not b.is_dir() or not images_de(a) or not images_de(b):
            print("Comparaison impossible pour %s : aucun document photographié." % moteur)
            ok = False
            continue
        print("Documents imprimés, %s : ecsr contre ecf" % moteur)
        ok = comparer(a, b) and ok
    return ok


def executer_lot(lot):
    """Un moteur, une liste de tâches (exécuté dans un processus à part)."""
    moteur = lot["moteur"]
    sortie = {"moteur": moteur, "indisponible": None, "taches": []}
    with sync_playwright() as p:
        navigateur, raison = vn.lancer_navigateur(p, moteur)
        if navigateur is None:
            sortie["indisponible"] = raison
            return sortie
        try:
            for tache in lot["taches"]:
                faites, erreurs = jouer_role(navigateur, lot["url"], tache, lot["dossier"])
                sortie["taches"].append({"tache": tache, "faites": faites, "erreurs": erreurs})
        finally:
            navigateur.close()
    return sortie


def photographier_tout(url, dossier, moteurs, habillages, largeurs, roles, jobs):
    taches = []
    for moteur in moteurs:
        for habillage in habillages:
            for largeur in largeurs:
                for role in list(roles) + ["anon"]:
                    taches.append({"moteur": moteur, "habillage": habillage, "role": role, "largeur": largeur})
    par_moteur = max(1, (jobs or 2 * len(moteurs)) // len(moteurs))
    lots = []
    for moteur in moteurs:
        propres = [t for t in taches if t["moteur"] == moteur]
        for i in range(par_moteur):
            if propres[i::par_moteur]:
                lots.append({"moteur": moteur, "taches": propres[i::par_moteur], "url": url, "dossier": str(dossier)})
    print("%d contexte(s) sur %s, %d processus, banc %s" % (len(taches), " et ".join(moteurs), len(lots), url), flush=True)
    debut = time.time()
    sorties = []
    if len(lots) == 1:
        sorties.append(executer_lot(lots[0]))
    else:
        with concurrent.futures.ProcessPoolExecutor(max_workers=len(lots)) as pool:
            for futur in concurrent.futures.as_completed([pool.submit(executer_lot, lot) for lot in lots]):
                sorties.append(futur.result())
                print("  lot %s terminé (%.0f s)" % (sorties[-1]["moteur"], time.time() - debut), flush=True)
    vues = 0
    problemes = []
    for s in sorties:
        if s["indisponible"]:
            problemes.append("moteur %s indisponible : %s" % (s["moteur"], s["indisponible"]))
        for t in s["taches"]:
            vues += len(t["faites"])
            k = t["tache"]
            for vue, raison in t["erreurs"]:
                problemes.append("%s/%s/%s-%d %s : %s" % (k["moteur"], k["habillage"], k["role"], k["largeur"], vue, raison))
    print("%d vue(s) photographiée(s) en %.0f s" % (vues, time.time() - debut), flush=True)
    for pb in sorted(problemes):
        print("  ! " + pb)
    return not problemes


# --------------------------------------------------------------------------------------
# Planche
# --------------------------------------------------------------------------------------

PAT_FICHIER = re.compile(r"^(?P<role>[a-z]+)-(?P<largeur>\d+)-(?P<vue>.+)\.png$")
NOMS_DE_ROLES = {"stagiaire": "Stagiaire", "prof": "Formateur", "fondateur": "Fondateur", "anon": "Non connecté"}


def titre_de_vue(vue):
    """Le nom en clair d'un identifiant de vue : « planning--dates-cles » devient « planning, dates cles »."""
    return vue.replace("--", ", ").replace("-", " ")


def ecrire_planche(dossier):
    dossier = pathlib.Path(dossier)
    jeu = {}   # (moteur, role, vue) -> {(habillage, largeur): chemin relatif}
    largeurs = set()
    for moteur in sorted(d.name for d in dossier.iterdir() if d.is_dir()):
        for habillage in sorted(d.name for d in (dossier / moteur).iterdir() if d.is_dir()):
            for f in sorted((dossier / moteur / habillage).glob("*.png")):
                m = PAT_FICHIER.match(f.name)
                if not m:
                    continue
                largeurs.add(int(m["largeur"]))
                jeu.setdefault((moteur, m["role"], m["vue"]), {})[(habillage, int(m["largeur"]))] = "%s/%s/%s" % (moteur, habillage, f.name)
    largeurs = sorted(largeurs, reverse=True)
    habillages = sorted({h for v in jeu.values() for (h, _) in v}, key=lambda h: HABILLAGES.index(h) if h in HABILLAGES else 9)
    lignes = ["<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><title>Planche des habillages</title>",
              "<style>body{font:14px system-ui,sans-serif;margin:16px;background:#f4f4f4;color:#222}h1{font-size:20px}h2{font-size:17px;margin:28px 0 4px}"
              "h3{font-size:14px;margin:14px 0 4px}table{border-collapse:collapse}td{vertical-align:top;padding:4px 8px 4px 0}"
              "figure{margin:0}figcaption{font-size:12px;color:#555;margin-bottom:2px}img{border:1px solid #bbb;background:#fff;display:block}"
              "img.large{width:480px}img.etroit{width:187px}.absent{color:#a00;font-size:12px}</style>",
              "<h1>Planche des habillages</h1>"]
    for moteur in sorted({k[0] for k in jeu}):
        lignes.append("<h2>Moteur : %s</h2>" % html.escape(moteur))
        for role in [r for r in ("stagiaire", "prof", "fondateur", "anon") if any(k[:2] == (moteur, r) for k in jeu)]:
            lignes.append("<h2>%s</h2>" % html.escape(NOMS_DE_ROLES.get(role, role)))
            vues = sorted({k[2] for k in jeu if k[:2] == (moteur, role)})
            for vue in vues:
                lignes.append("<h3>%s</h3><table><tr>" % html.escape(titre_de_vue(vue)))
                for largeur in largeurs:
                    for h in habillages:
                        chemin = jeu[(moteur, role, vue)].get((h, largeur))
                        legende = "%s, %s (%d px)" % (NOMS_HABILLAGES.get(h, h), "téléphone" if largeur < 700 else "ordinateur", largeur)
                        if chemin:
                            classe = "etroit" if largeur < 700 else "large"
                            lignes.append("<td><figure><figcaption>%s</figcaption><a href=\"%s\"><img class=\"%s\" loading=\"lazy\" src=\"%s\" alt=\"%s\"></a></figure></td>"
                                          % (html.escape(legende), html.escape(chemin), classe, html.escape(chemin), html.escape(legende)))
                        else:
                            lignes.append("<td><figure><figcaption>%s</figcaption><span class=\"absent\">absente</span></figure></td>" % html.escape(legende))
                lignes.append("</tr></table>")
    (dossier / "planche.html").write_text("\n".join(lignes) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------------------
# Comparaison
# --------------------------------------------------------------------------------------


def images_de(dossier):
    dossier = pathlib.Path(dossier)
    return {f.relative_to(dossier).as_posix(): f for f in dossier.rglob("*.png")}


def difference(a, b):
    """La zone où deux images ouvertes diffèrent (None si identiques). Comparées en RGB : sur une image RGBA, getbbox()
    ne regarde que le canal alpha, et deux captures opaques de couleurs différentes sembleraient identiques."""
    from PIL import ImageChops
    return ImageChops.difference(a.convert("RGB"), b.convert("RGB")).getbbox()


def verifier_difference():
    """Auto-contrôle de la comparaison : une image, la même, puis la même avec un seul pixel de couleur changé."""
    from PIL import Image
    a = Image.new("RGBA", (20, 20), (10, 20, 30, 255))
    b = a.copy()
    if difference(a, b) is not None:
        raise RuntimeError("deux images identiques déclarées différentes")
    b.putpixel((7, 3), (11, 20, 30, 255))
    if difference(a, b) != (7, 3, 8, 4):
        raise RuntimeError("un pixel de couleur différente n'est pas vu : %s" % (difference(a, b),))


def comparer(sortie, avant):
    """Compare image par image ; imprime le bilan. Vrai quand tout est identique et rien ne manque."""
    from PIL import Image
    verifier_difference()
    ici, la = images_de(sortie), images_de(avant)
    for dossier, images in ((sortie, ici), (avant, la)):
        if not images:
            print("Comparaison impossible : aucune image dans %s." % dossier)
            return False
    identiques, differentes = 0, []
    for nom in sorted(set(ici) | set(la)):
        if nom not in la:
            differentes.append((nom, "absente de %s" % avant))
        elif nom not in ici:
            differentes.append((nom, "absente de %s" % sortie))
        else:
            with Image.open(ici[nom]) as a, Image.open(la[nom]) as b:
                if a.size != b.size:
                    differentes.append((nom, "tailles différentes : %dx%d contre %dx%d" % (a.size + b.size)))
                else:
                    zone = difference(a, b)
                    if zone is None:
                        identiques += 1
                    else:
                        differentes.append((nom, "pixels différents dans la zone %s" % (zone,)))
    print("%d vues identiques, %d différentes" % (identiques, len(differentes)))
    for nom, raison in differentes:
        print("  %s : %s" % (nom, raison))
    return not differentes


def liste_de(texte, permis, nom, convertir=str):
    valeurs = [convertir(x) for x in texte.split(",") if x.strip()]
    for v in valeurs:
        if v not in permis:
            raise SystemExit("--%s : « %s » inconnu (choix : %s)" % (nom, v, ", ".join(str(p) for p in permis)))
    return valeurs


def main(argv=None):
    ap = argparse.ArgumentParser(description="Photographie l'app dans ses habillages et compare deux jeux de captures au pixel.")
    ap.add_argument("url", nargs="?", default=BANC_PAR_DEFAUT, help="adresse de _harness.html (défaut %s)" % BANC_PAR_DEFAUT)
    ap.add_argument("--sortie", required=True, metavar="DOSSIER", help="dossier des captures (hors dépôt)")
    ap.add_argument("--habillages", default=",".join(HABILLAGES))
    ap.add_argument("--moteurs", default=",".join(MOTEURS))
    ap.add_argument("--largeurs", default=",".join(str(l) for l in LARGEURS))
    ap.add_argument("--roles", default=",".join(ROLES))
    ap.add_argument("--jobs", type=int, default=0, help="processus en parallèle (défaut : deux par moteur)")
    ap.add_argument("--comparer", metavar="DOSSIER_AVANT", help="compare le dossier produit à celui-ci")
    ap.add_argument("--seulement-comparer", action="store_true", help="ne photographie rien : compare --sortie à --comparer")
    ap.add_argument("--documents", action="store_true", help="photographie les documents imprimés seuls en ecsr et en ecf (forcés) et les compare : ils doivent être identiques")
    args = ap.parse_args(argv)

    if args.seulement_comparer and not args.comparer:
        raise SystemExit("--seulement-comparer demande --comparer")
    ok = True
    if args.documents:
        moteurs = liste_de(args.moteurs, MOTEURS, "moteurs")
        if not vn.repond(args.url):
            print("Le banc ne répond pas à %s." % args.url)
            return 2
        pathlib.Path(args.sortie).mkdir(parents=True, exist_ok=True)
        return 0 if photographier_documents(args.url, args.sortie, moteurs) else 1
    if not args.seulement_comparer:
        moteurs = liste_de(args.moteurs, MOTEURS, "moteurs")
        habillages = liste_de(args.habillages, HABILLAGES, "habillages")
        largeurs = liste_de(args.largeurs, tuple(HAUTEUR), "largeurs", int)
        roles = liste_de(args.roles, ROLES, "roles")
        url = args.url
        if not vn.repond(url):
            print("Le banc ne répond pas à %s." % url)
            return 2
        dossier = pathlib.Path(args.sortie)
        dossier.mkdir(parents=True, exist_ok=True)
        ok = photographier_tout(url, dossier, moteurs, habillages, largeurs, roles, args.jobs)
        ecrire_planche(dossier)
        print("Planche : %s" % (dossier / "planche.html"))
    if args.comparer:
        ok = comparer(args.sortie, args.comparer) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    for flux in (sys.stdout, sys.stderr):
        flux.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
