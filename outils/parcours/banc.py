# -*- coding: utf-8 -*-
"""Le banc d'essai vu du robot : serveur local, fichiers du banc, navigateurs, contextes.

Qui parle à qui :  robot (Playwright) -> navigateur sans fenêtre -> serveur local (ce module) -> fichiers du
dépôt ; l'app y croit parler à Supabase, mais `_harness.html` remplace le client par le faux Supabase
(`_harness_supabase.js`, données fictives en mémoire). Rien ne sort de la machine, la base n'est jamais lue.
"""
import functools
import http.server
import json
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


# Le clavier de la machine. WebKit sous Windows recopie les touches Maj, Ctrl, Alt et Windows réellement enfoncées
# sur la machine dans le clic qu'il fabrique après un toucher (constat du 09/11/2026 ; le clic d'ordinateur n'est
# pas touché) : un toucher fait pendant que quelqu'un tape devient un Maj+clic, et un lien ne s'ouvre pas. Le
# robot attend donc un clavier libre avant de toucher, et la page note toute touche portée par un geste reçu.
_TOUCHES = {0x10: "Maj", 0x11: "Ctrl", 0x12: "Alt", 0x5B: "Windows", 0x5C: "Windows"}


def touches_tenues():
    """Les touches de modification enfoncées en ce moment sur le clavier de la machine (Windows ; vide ailleurs)."""
    if os.name != "nt":
        return []
    import ctypes
    lire = ctypes.windll.user32.GetAsyncKeyState
    lire.restype = ctypes.c_short
    return sorted({nom for vk, nom in _TOUCHES.items() if lire(vk) & 0x8000})


# Plafond de l'attente, pour tout le processus : une touche coincée (bureau à distance, touche Windows bloquée) ne
# doit pas faire durer le robot des heures. Le plafond atteint, on n'attend plus : les gestes faussés sont repérés
# par le journal de la page et les passages finissent « non jugés ».
ATTENTE_CLAVIER_MAX = 120.0
_attente = {"restante": ATTENTE_CLAVIER_MAX}


def attendre_clavier_libre(maximum=20):
    """Attend (au plus `maximum` secondes, dans la limite du plafond du processus) qu'aucune touche de modification
    ne soit tenue sur la machine. Rend celles encore tenues au bout du délai (liste vide : clavier libre)."""
    t0 = time.time()
    fin = t0 + min(maximum, _attente["restante"])
    try:
        while True:
            tenues = touches_tenues()
            if not tenues or time.time() >= fin:
                return tenues
            time.sleep(0.05)
    finally:
        _attente["restante"] = max(0.0, _attente["restante"] - (time.time() - t0))


# Journal des touches portées par les gestes reçus. Seuls les événements de confiance comptent (fabriqués par le
# navigateur) ; le robot ne demande jamais de touche : une touche notée vient du clavier de la machine.
JS_JOURNAL_TOUCHES = r"""(() => {
  const noter = (e) => {
    if (!e.isTrusted) return;
    const t = [e.shiftKey && 'Maj', e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.metaKey && 'Windows'].filter(Boolean);
    if (t.length) (window.__robotModifs = window.__robotModifs || []).push(e.type + ' : ' + t.join('+'));
  };
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'auxclick', 'dblclick', 'contextmenu'])
    window.addEventListener(type, noter, { capture: true, passive: true });
})();"""


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


def nouveau_contexte(navigateur, format_, semis=(), habillage="ecsr"):
    reglages = dict(FORMATS[format_], locale="fr-FR", timezone_id="Europe/Paris")
    contexte = navigateur.new_context(**reglages)
    contexte.set_default_timeout(6000)
    contexte.add_init_script(JS_JOURNAL_TOUCHES)
    if habillage == "ecf":
        # Le levier de tout robot (comme outils/verifier_navigation.py) : l'appareil retient l'habillage avant le premier
        # chargement ; l'app pose data-skin elle-même. Posé une seule fois par onglet (garde en sessionStorage) pour
        # qu'un rechargement retrouve ce que l'app a écrit depuis. Pour « ecsr », rien : appareil vierge.
        contexte.add_init_script("try { if (!sessionStorage.getItem('vn_habillage_pose')) { localStorage.setItem('ecsr_habillage', %s);"
                                 " sessionStorage.setItem('vn_habillage_pose', '1'); } } catch (e) { /* stockage bloqué */ }"
                                 % json.dumps(json.dumps({"nom": "ecf"})))
    semis = list(semis)
    contexte.route("**/*", lambda route: _servir(route, semis))
    return contexte
