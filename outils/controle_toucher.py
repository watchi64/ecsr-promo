#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Contrôle du toucher du robot des parcours (WebKit, téléphone) : à passer après toute retouche de
outils/parcours/visite.py, banc.py ou de la reprise dans robot_parcours.py.

Pourquoi : WebKit sous Windows recopie les touches Maj, Ctrl, Alt et Windows réellement enfoncées sur la machine
dans le clic qu'il fabrique après un toucher (constat du 09/11/2026). Un toucher fait pendant que quelqu'un tape
devient un Maj+clic : un lien ne s'ouvre pas, et le robot sortait rouge sans défaut de l'app. Le robot attend
donc un clavier libre avant de toucher, repère un geste faussé et rejoue le passage. Ce contrôle prouve que :

  A. un lien touché s'ouvre (le cas ordinaire) ;
  B. un bouton réellement sans effet bloque toujours (contre-épreuve : la reprise ne masque pas un vrai défaut) ;
  C. un toucher qui porte Maj est reconnu comme faussé, pas comme un défaut de l'app ;
  D. un passage faussé est rejoué, et seul le dernier essai compte ;
  F. un passage faussé à chaque essai est « non jugé » : le rapport n'est pas vert, le code de sortie vaut 2 ;
  E. (avec --clavier) avec la vraie touche Maj de la machine : le geste est reconnu faussé ; avec l'attente, le
     robot attend que Maj soit relâchée et le toucher marche. Cette partie appuie sur Maj quelques secondes :
     ne pas taper au clavier pendant ce temps.

C, D et F font porter Maj au toucher par Playwright (`tap(modifiers=["Shift"])`) : de vrais événements du
navigateur, notés par le vrai journal du banc, sans toucher au clavier de la machine.

Usage : python outils/controle_toucher.py [--clavier]     Code de sortie : 0 si tout passe, 1 sinon.
"""
import atexit
import contextlib
import datetime
import pathlib
import sys
import threading
import time
import types

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from playwright.sync_api import Locator, sync_playwright  # noqa: E402
from parcours import banc  # noqa: E402
from parcours.visite import Visite, Echec, Fausse, BLOQUE  # noqa: E402
import robot_parcours  # noqa: E402

ADRESSE = "http://essai.robot/page.html"
PAGE = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width, initial-scale=1">
<style>body{font:18px system-ui;margin:24px} a,button{display:block;margin:16px 0;padding:14px;font-size:18px}</style>
<a id=lien href="#/ailleurs">Un lien</a>
<button id=mort>Un bouton qui ne fait rien</button>"""
SC = {"moteur": "webkit", "format": "telephone", "navigation": "nouvelle", "habillage": "ecsr"}

resultats = []


def verifier(nom, ok, detail=""):
    resultats.append(ok)
    print("  %s %s%s" % ("ok   " if ok else "ÉCHEC", nom, (" : " + detail) if detail else ""), flush=True)


@contextlib.contextmanager
def maj_simulee():
    """Pendant le bloc, chaque toucher porte Maj, comme le produit le défaut de WebKit."""
    origine = Locator.tap
    Locator.tap = lambda self, **options: origine(self, **{**options, "modifiers": ["Shift"]})
    try:
        yield
    finally:
        Locator.tap = origine


def visite_sur_page(navigateur, dossier):
    contexte = banc.nouveau_contexte(navigateur, "telephone")
    page = contexte.new_page()
    page.route(ADRESSE, lambda route: route.fulfill(status=200, content_type="text/html; charset=utf-8", body=PAGE))
    page.goto(ADRESSE)
    p = types.SimpleNamespace(id="controle-toucher", role="formateur", budget=5, banc={}, depart=None, semis=())
    return contexte, Visite(page, SC, p, "", dossier, [])


def bloquants(v, critere=None):
    return [c for c in v.constats if c["gravite"] == BLOQUE and (critere is None or c["critere"] == critere)]


def cas_a_b_c(navigateur, dossier):
    # A. Un lien touché s'ouvre, sans constat bloquant.
    contexte, v = visite_sur_page(navigateur, dossier)
    try:
        v.toucher("#lien", "le lien")
        h = v.page.evaluate("location.hash")
        verifier("A. un lien touché s'ouvre", h == "#/ailleurs" and not bloquants(v), "adresse %s, bloquants %s" % (h, bloquants(v)))
    except (Echec, Fausse) as e:
        verifier("A. un lien touché s'ouvre", False, "%s : %s" % (type(e).__name__, e))
    contexte.close()

    # B. Contre-épreuve : un bouton sans effet bloque (critère E, deux essais), il n'est pas pris pour un geste faussé.
    contexte, v = visite_sur_page(navigateur, dossier)
    try:
        v.toucher("#mort", "le bouton mort")
        verifier("B. un bouton sans effet bloque toujours", False, "aucun échec levé")
    except Fausse as e:
        verifier("B. un bouton sans effet bloque toujours", False, "pris pour un geste faussé : %s" % e)
    except Echec as e:
        e_bloque = [c["message"] for c in bloquants(v, "E")]
        verifier("B. un bouton sans effet bloque toujours", any("deux essais" in m for m in e_bloque), "%s ; constats E : %s" % (e, e_bloque))
    contexte.close()

    # C. Un toucher qui porte Maj est faussé (à rejouer), sans constat sur l'app.
    contexte, v = visite_sur_page(navigateur, dossier)
    try:
        with maj_simulee():
            v.toucher("#lien", "le lien")
        verifier("C. un toucher qui porte Maj est reconnu faussé", False, "aucune exception (adresse %s)" % v.page.evaluate("location.hash"))
    except Fausse as e:
        verifier("C. un toucher qui porte Maj est reconnu faussé", "Maj" in str(e) and not bloquants(v), str(e))
    except Echec as e:
        verifier("C. un toucher qui porte Maj est reconnu faussé", False, "pris pour un défaut de l'app : %s" % e)
    contexte.close()


def parcours_d_essai(id_, avec_maj):
    """Un parcours sur le banc : toucher un lien ajouté à la page, qui mène aux réglages. `avec_maj(n)` dit si le
    n-ième essai touche avec Maj."""
    appels = []

    def fonction(v):
        appels.append(1)
        v.page.evaluate("""() => { const a = document.createElement('a'); a.id = 'essai-robot'; a.href = '#/config';
          a.textContent = 'Essai du robot'; a.style.cssText = 'position:fixed;left:20px;top:300px;z-index:99999;padding:20px;background:#fff';
          document.body.appendChild(a); }""")
        with (maj_simulee() if avec_maj(len(appels)) else contextlib.nullcontext()):
            v.toucher("#essai-robot", "le lien d'essai")
        if v.page.evaluate("location.hash") != "#/config":
            v.echec("le lien d'essai ne s'ouvre pas")
        v.but("lien d'essai suivi")

    p = types.SimpleNamespace(id=id_, titre=id_, role="formateur", budget=5, banc={}, depart=None, semis=(), fonction=fonction)
    return p, appels


def cas_d_f(navigateur, base_url, dossier):
    # D. Faussé au premier essai seulement : rejoué une fois, le second essai compte.
    p, appels = parcours_d_essai("controle-reprise", lambda n: n == 1)
    r = robot_parcours.jouer_un(navigateur, p, SC, base_url, dossier)
    bl = [c for c in r["constats"] if c["gravite"] == BLOQUE and c["critere"] in "AE"]
    verifier("D. un passage faussé est rejoué, seul le dernier essai compte",
             r["abouti"] and len(appels) == 2 and len(r.get("reprises", [])) == 1 and not bl and not r.get("non_juge"),
             "abouti %s, joué %d fois, reprises %d, bloquants %s" % (r["abouti"], len(appels), len(r.get("reprises", [])), [c["message"] for c in bl]))

    # F. Faussé à chaque essai : non jugé ; le rapport n'est pas vert et le robot sort avec le code 2.
    p, appels = parcours_d_essai("controle-non-juge", lambda n: True)
    r = robot_parcours.jouer_un(navigateur, p, SC, base_url, dossier)
    if not r.get("non_juge"):
        verifier("F. un passage faussé à chaque essai est non jugé (ni vert ni rouge, code 2)", False,
                 "joué %d fois, pas non jugé (abouti %s, reprises %d)" % (len(appels), r["abouti"], len(r.get("reprises", []))))
        return
    # Le verdict, comme dans main() : un passage propre seul est vert ; le même avec le passage non jugé ne l'est plus.
    propre = {"parcours": "controle-propre", **SC, "abouti": True, "clics": 1, "clics_au_but": 1, "budget": 5, "duree": 1.0,
              "ouverture_ms": 100, "etapes": [], "constats": [], "capture_finale": None, "reprises": []}
    verdicts = {}
    for nom, tous in (("propre seul", [propre]), ("propre et non jugé", [propre, r])):
        sortie = dossier / ("rapport_" + nom.replace(" ", "_"))
        sortie.mkdir(exist_ok=True)
        juges, non_juges = robot_parcours.separer_non_juges(tous)
        vert, nb = robot_parcours.ecrire_rapport(sortie, juges, {}, datetime.datetime.now(), 1.0, [], len(tous), non_juges)
        verdicts[nom] = (vert, robot_parcours.code_de_sortie(vert, nb), (sortie / "rapport.md").read_text(encoding="utf-8"))
    (v1, c1, _), (v2, c2, rapport) = verdicts["propre seul"], verdicts["propre et non jugé"]
    verifier("F. un passage faussé à chaque essai est non jugé (ni vert ni rouge, code 2)",
             len(appels) == robot_parcours.ESSAIS_MAX and v1 and c1 == 0 and not v2 and c2 == 2
             and "Passage non jugé" in rapport and "INCOMPLET" in rapport,
             "joué %d fois ; propre seul : vert %s, code %d ; avec le non jugé : vert %s, code %d" % (len(appels), v1, c1, v2, c2))


def relacher_maj():
    import ctypes
    ctypes.windll.user32.keybd_event(0x10, 0x2A, 2, 0)


@contextlib.contextmanager
def maj_tenue(duree):
    """Appuie sur la vraie touche Maj de la machine pendant `duree` secondes (fil à part). Le relâchement est
    garanti : à la fin du fil, en sortie du bloc quoi qu'il arrive, et à la sortie du programme."""
    import ctypes
    atexit.register(relacher_maj)
    ctypes.windll.user32.keybd_event(0x10, 0x2A, 0, 0)
    fil = threading.Thread(target=lambda: (time.sleep(duree), relacher_maj()))
    fil.start()
    time.sleep(0.3)
    try:
        yield
    finally:
        fil.join()
        relacher_maj()


def cas_e(navigateur, dossier):
    """E. La vraie touche Maj : le défaut de WebKit est repéré ; l'attente du clavier libre l'évite."""
    contexte, v = visite_sur_page(navigateur, dossier)
    v.attente_clavier = 0          # on touche sans attendre : le geste doit être faussé et reconnu comme tel
    try:
        with maj_tenue(3):
            v.toucher("#lien", "le lien")
        verifier("E1. Maj tenue sans attente : geste reconnu faussé", False,
                 "aucune exception (adresse %s : WebKit ne recopie plus Maj ?)" % v.page.evaluate("location.hash"))
    except Fausse as e:
        verifier("E1. Maj tenue sans attente : geste reconnu faussé", "Maj" in str(e), str(e))
    except Echec as e:
        verifier("E1. Maj tenue sans attente : geste reconnu faussé", False, "pris pour un défaut de l'app : %s" % e)
    finally:
        contexte.close()

    contexte, v = visite_sur_page(navigateur, dossier)
    try:
        with maj_tenue(2):
            t0 = time.perf_counter()
            v.toucher("#lien", "le lien")
            attente = time.perf_counter() - t0
        h = v.page.evaluate("location.hash")
        verifier("E2. Maj tenue avec l'attente : le robot attend, puis le lien s'ouvre", h == "#/ailleurs" and attente > 1.2,
                 "adresse %s après %.1f s" % (h, attente))
    except (Echec, Fausse) as e:
        verifier("E2. Maj tenue avec l'attente : le robot attend, puis le lien s'ouvre", False, "%s : %s" % (type(e).__name__, e))
    finally:
        contexte.close()


def main():
    clavier = "--clavier" in sys.argv[1:]
    dossier = pathlib.Path(__file__).resolve().parent / "robot_rapports" / "controle_toucher"
    dossier.mkdir(parents=True, exist_ok=True)
    banc.preparer_fichiers()
    serveur, base_url = banc.demarrer_serveur()
    print("Contrôle du toucher (WebKit, téléphone)%s" % (" avec la vraie touche Maj" if clavier else ""), flush=True)
    try:
        with sync_playwright() as pw:
            navigateur, raison = banc.lancer_navigateur(pw, "webkit")
            if not navigateur:
                print("WebKit ne démarre pas : %s" % raison)
                return 2
            cas_a_b_c(navigateur, dossier)
            cas_d_f(navigateur, base_url, dossier)
            if clavier:
                if sys.platform != "win32":
                    print("  --clavier : Windows seulement, partie E sautée")
                else:
                    cas_e(navigateur, dossier)
            navigateur.close()
    finally:
        serveur.shutdown()
        serveur.server_close()
    ok = all(resultats)
    print("%s : %d contrôle(s) sur %d" % ("TOUT PASSE" if ok else "ÉCHEC", sum(resultats), len(resultats)))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
