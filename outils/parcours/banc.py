# -*- coding: utf-8 -*-
"""Le banc d'essai vu du robot : serveur local, fichiers du banc, navigateurs, contextes.

Qui parle à qui :  robot (Playwright) -> navigateur sans fenêtre -> serveur local (ce module) -> fichiers du
dépôt ; l'app y croit parler à Supabase, mais `_harness.html` remplace le client par le faux Supabase
(`_harness_supabase.js`, données fictives en mémoire). Rien ne sort de la machine, la base n'est jamais lue.
"""
import functools
import http.server
import os
import pathlib
import shutil
import socketserver
import subprocess
import threading
import time
import urllib.parse

from playwright.sync_api import Error as ErreurPlaywright

RACINE = pathlib.Path(__file__).resolve().parents[2]          # la racine de l'app (worktree ou dépôt)
DEPOT_PRINCIPAL = pathlib.Path("C:/Users/watch/Dev/ECSR/TP_ECSR_App")
# Fichiers du banc, exclus de git (.git/info/exclude) : absents d'un worktree neuf, recopiés du dépôt principal.
FICHIERS_DU_BANC = ("_harness_build.mjs", "_harness_supabase.js", "_banc_centre_demo.js",
                    "_banc_emargement_demo.js", "_banc_qualiopi_demo.js")

FORMATS = {
    # iPhone : 375 x 812, tactile, écran de densité 2 ; ordinateur de la salle : 1 280 x 800.
    "telephone": {"viewport": {"width": 375, "height": 812}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2},
    "ordinateur": {"viewport": {"width": 1280, "height": 800}, "device_scale_factor": 1},
}


class _Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        # Le banc n'est jamais mis en cache par le navigateur : chaque passage relit les fichiers du disque.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def preparer_fichiers():
    """Vérifie les fichiers du banc ; recopie ceux qui manquent depuis le dépôt principal ; régénère
    `_harness.html` quand index.html ou le constructeur sont plus récents (un banc périmé teste un vieux balisage).
    Rend la liste des messages à afficher."""
    messages = []
    for nom in FICHIERS_DU_BANC:
        cible = RACINE / nom
        if not cible.exists():
            source = DEPOT_PRINCIPAL / nom
            if not source.exists():
                if nom.startswith("_banc_"):
                    messages.append("absent : %s (les parcours qui en ont besoin échoueront)" % nom)
                    continue
                raise SystemExit("Fichier du banc introuvable : %s (ni ici ni dans %s)" % (nom, DEPOT_PRINCIPAL))
            shutil.copy2(source, cible)
            messages.append("recopié du dépôt principal : %s" % nom)
    page = RACINE / "_harness.html"
    sources = [RACINE / "index.html", RACINE / "_harness_build.mjs"]
    if not page.exists() or page.stat().st_mtime < max(s.stat().st_mtime for s in sources):
        r = subprocess.run(["node", "_harness_build.mjs"], cwd=RACINE, capture_output=True, text=True, encoding="utf-8")
        if r.returncode != 0:
            raise SystemExit("node _harness_build.mjs a échoué :\n" + r.stdout + r.stderr)
        messages.append("banc régénéré : " + r.stdout.strip().splitlines()[-1][:120])
    return messages


def demarrer_serveur():
    """Sert la racine de l'app sur un port libre de 127.0.0.1 (jamais `localhost` : sur ce poste, il essaie
    d'abord ::1 et coûte 0,2 s par requête). Rend (serveur, adresse de base)."""
    gestionnaire = functools.partial(_Silencieux, directory=str(RACINE))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    socketserver.ThreadingTCPServer.request_queue_size = 64
    serveur = socketserver.ThreadingTCPServer(("127.0.0.1", 0), gestionnaire)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur, "http://127.0.0.1:%d/" % serveur.server_address[1]


def moteur_installe(moteur):
    """Le moteur déjà présent dans ms-playwright quand celui qu'attend cette version de Playwright manque
    (WebKit sur ce poste : Playwright attend un numéro, la machine en a un autre)."""
    racines = []
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH") not in (None, "", "0"):
        racines.append(pathlib.Path(os.environ["PLAYWRIGHT_BROWSERS_PATH"]))
    maison = pathlib.Path.home()
    racines += [maison / "AppData/Local/ms-playwright", maison / ".cache/ms-playwright", maison / "Library/Caches/ms-playwright"]
    motifs = {"webkit": ["webkit-*/Playwright.exe", "webkit-*/pw_run.sh"],
              "chromium": ["chromium_headless_shell-*/chrome-headless-shell-win*/chrome-headless-shell.exe",
                           "chromium-*/chrome-win*/chrome.exe", "chromium-*/chrome-linux*/chrome"]}[moteur]
    for racine in racines:
        for motif in motifs:
            trouves = sorted(racine.glob(motif))
            if trouves:
                return str(trouves[-1])
    return None


def lancer_navigateur(p, moteur):
    """(navigateur, None) ou (None, raison)."""
    genre = getattr(p, moteur)
    try:
        return genre.launch(), None
    except ErreurPlaywright as e:
        premiere = str(e).strip().splitlines()[0][:160]
    chemin = moteur_installe(moteur)
    if not chemin:
        return None, "%s ; aucun autre %s dans ms-playwright" % (premiere, moteur)
    try:
        return genre.launch(executable_path=chemin), None
    except ErreurPlaywright as e:
        return None, "%s ; repli sur %s : %s" % (premiere, chemin, str(e).strip().splitlines()[0][:160])


STATIQUES = ("/js/", "/css/", "/assets/", "/vendor/", "/scripts/", "/_harness_supabase.js", "/_banc_")
CACHE = {}


def _servir(route, semis):
    """Fichiers statiques lus une fois par processus puis servis de la mémoire (plus rapide, et le serveur
    n'est pas noyé quand plusieurs pages chargent ensemble). Le semis du parcours s'ajoute en fin du faux
    Supabase pour ce contexte seulement : le fichier du banc n'est jamais modifié sur le disque."""
    requete = route.request
    chemin = urllib.parse.urlparse(requete.url).path
    if requete.method != "GET" or not chemin.startswith(STATIQUES):
        route.continue_()
        return
    if requete.url not in CACHE:
        for essai in range(4):
            try:
                r = route.fetch()
                entetes = {k: v for k, v in r.headers.items() if k.lower() not in ("content-length", "content-encoding")}
                CACHE[requete.url] = (r.status, entetes, r.body())
                break
            except ErreurPlaywright:
                time.sleep(0.3 * (essai + 1))
        else:
            route.abort()
            return
    statut, entetes, corps = CACHE[requete.url]
    if semis and chemin == "/_harness_supabase.js":
        corps += ("\ntry { " + "\n".join(semis) + " } catch (e) { console.error('[robot] semis du banc impossible : ' + e); }\n").encode("utf-8")
    route.fulfill(status=statut, headers=entetes, body=corps)


def nouveau_contexte(navigateur, format_, semis=()):
    reglages = dict(FORMATS[format_], locale="fr-FR", timezone_id="Europe/Paris")
    contexte = navigateur.new_context(**reglages)
    contexte.set_default_timeout(6000)
    semis = list(semis)
    contexte.route("**/*", lambda route: _servir(route, semis))
    return contexte
