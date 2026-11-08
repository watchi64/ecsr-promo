#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Robot des parcours réels : le filet de qualité à passer avant chaque fusion dans main.

Usage
-----
    python outils/robot_parcours.py                      # tout : environ 5 minutes
    python outils/robot_parcours.py --parcours passer-un-qcm,lire-un-cours --moteurs chromium
    python outils/robot_parcours.py --liste              # les parcours connus, sans rien jouer

Ce qu'il fait : il sert l'app sur un port libre de la machine (banc d'essai, faux Supabase, données
fictives, aucune requête vers la base), ouvre Chromium et WebKit (le moteur de Safari, donc de l'iPhone)
sans fenêtre, en iPhone (375 px, tactile) et en ordinateur (1 280 px), dans l'ancienne et la nouvelle
navigation, et joue chaque parcours (outils/parcours/stagiaire.py, equipe.py) comme une personne : en
cliquant sur ce qu'elle voit. Il compte les clics, chronomètre l'affichage, et contrôle chaque écran
selon le référentiel (docs/qualite/referentiel.md).

Sortie : une ligne par passage, puis le rapport (rapport.md, planche.html des écrans de fin pour juger
l'attrait visuel, resultats.json, captures) dans outils/robot_rapports/<date-heure>/ (ignoré par git :
les captures montrent les données fictives du banc). Code de sortie : 0 si aucun défaut bloquant,
1 s'il y en a, 2 si le banc ou un moteur ne démarre pas.

Prérequis : Python avec Playwright (pip install playwright), node (pour régénérer _harness.html), et les
fichiers du banc (_harness_build.mjs, _harness_supabase.js, _banc_*.js), exclus de git : recopiés tout
seuls depuis C:/Users/watch/Dev/ECSR/TP_ECSR_App quand ils manquent (worktree neuf).

Ajouter un parcours : une fonction décorée par @parcours dans outils/parcours/ (voir son __init__.py) ;
une page neuve : sa destination dans outils/parcours/navigation.py.
"""
import argparse
import concurrent.futures
import datetime
import html
import json
import os
import pathlib
import subprocess
import sys
import time
import traceback

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from parcours import charger_tous  # noqa: E402
from parcours import banc  # noqa: E402
from parcours.visite import Visite, Echec, CRITERES, BLOQUE, LISTE  # noqa: E402

MOTEURS = ("chromium", "webkit")
FORMATS = ("ordinateur", "telephone")
NAVIGATIONS = ("ancienne", "nouvelle")
NOMS = {"chromium": "Chromium", "webkit": "WebKit", "ordinateur": "ordinateur", "telephone": "téléphone",
        "ancienne": "ancienne navigation", "nouvelle": "nouvelle navigation"}

JS_CLIQUABLES = r"""() => [...document.querySelectorAll('a[href], button, [role=tab], input, select, textarea')]
  .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; })
  .slice(0, 40).map((e) => (e.getAttribute('aria-label') || e.innerText || e.value || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 50))
  .filter(Boolean)"""


def libelle(sc):
    return "%s · %s · %s" % (NOMS[sc["moteur"]], NOMS[sc["format"]], NOMS[sc["navigation"]])


def jouer_un(navigateur, p, sc, base_url, dossier):
    """Joue un parcours dans un contexte neuf ; rend le résultat (dictionnaire sérialisable)."""
    erreurs = []
    contexte = banc.nouveau_contexte(navigateur, sc["format"], p.semis)
    page = contexte.new_page()
    page.on("pageerror", lambda e: erreurs.append("erreur de page : %s" % str(e).splitlines()[0][:200]))
    page.on("console", lambda m: erreurs.append("console : %s" % m.text[:200]) if m.type == "error" else None)
    page.on("dialog", lambda d: (erreurs.append("boîte de dialogue inattendue : %s" % d.message[:120]), d.dismiss()))
    v = Visite(page, sc, p, base_url, dossier, erreurs)
    t0 = time.perf_counter()
    abouti, raison = True, None
    try:
        v.ouvrir()
        p.fonction(v)
        if not v.but_atteint:
            raise Echec("le parcours s'est terminé sans atteindre son but")
    except Echec as e:
        abouti, raison = False, str(e)
    except Exception as e:  # une erreur du robot lui-même : on la montre comme telle
        abouti, raison = False, "erreur du robot : %s" % (traceback.format_exception_only(type(e), e)[-1].strip()[:300])
    if not abouti:
        c = v.constat("A", BLOQUE, raison, capture=True)
        try:
            c["cliquables"] = page.evaluate(JS_CLIQUABLES)
        except Exception:
            pass
    for e in dict.fromkeys(erreurs):
        v.constat("J", BLOQUE, e)
    duree = time.perf_counter() - t0
    try:
        contexte.close()
    except Exception:
        pass
    return {"parcours": p.id, **sc, "abouti": abouti, "clics": v.clics, "clics_au_but": v.clics_au_but, "budget": v.budget,
            "duree": round(duree, 1), "ouverture_ms": v.temps.get("ouverture"), "etapes": v.etapes, "constats": v.constats,
            "capture_finale": getattr(v, "capture_finale", None)}


def travailleur(moteur, format_, scenarios, base_url, dossier):
    """Un processus par moteur et par format : un navigateur, un contexte neuf par passage."""
    from playwright.sync_api import sync_playwright
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    registre = charger_tous()
    dossier = pathlib.Path(dossier)
    resultats = []
    with sync_playwright() as pw:
        navigateur, raison = banc.lancer_navigateur(pw, moteur)
        if not navigateur:
            return {"erreur": "%s ne démarre pas : %s" % (moteur, raison), "resultats": []}
        for sc in scenarios:
            r = jouer_un(navigateur, registre[sc["parcours"]], {k: sc[k] for k in ("moteur", "format", "navigation")}, base_url, dossier)
            resultats.append(r)
            marque = "ok  " if r["abouti"] and not any(c["gravite"] == BLOQUE for c in r["constats"]) else "ÉCHEC"
            print("  %s %-32s %-34s %s/%s clics  %4.1f s" % (marque, r["parcours"], libelle(r), r["clics_au_but"] if r["clics_au_but"] is not None else "-",
                                                        r["budget"], r["duree"]), flush=True)
        navigateur.close()
    return {"erreur": None, "resultats": resultats}


def ecarts_entre_moteurs(resultats):
    """Critère H : un parcours qui aboutit dans un moteur et pas dans l'autre, à format et navigation égaux."""
    par_cle = {}
    for r in resultats:
        par_cle.setdefault((r["parcours"], r["format"], r["navigation"]), {})[r["moteur"]] = r
    for (pid, fmt, nav), m in par_cle.items():
        if len(m) == 2 and m["chromium"]["abouti"] != m["webkit"]["abouti"]:
            perdant = m["webkit"] if m["chromium"]["abouti"] else m["chromium"]
            gagnant = "Chromium" if m["chromium"]["abouti"] else "WebKit"
            perdant["constats"].append({"critere": "H", "gravite": BLOQUE, "etape": "comparaison des moteurs",
                                        "message": "aboutit dans %s mais pas ici" % gagnant})


def git_info():
    try:
        tete = subprocess.run(["git", "log", "-1", "--format=%h %s"], cwd=banc.RACINE, capture_output=True, text=True, encoding="utf-8").stdout.strip()
        branche = subprocess.run(["git", "branch", "--show-current"], cwd=banc.RACINE, capture_output=True, text=True, encoding="utf-8").stdout.strip()
        return branche, tete
    except Exception:
        return "?", "?"


def ecrire_rapport(dossier, resultats, registre, debut, duree, erreurs_moteurs):
    branche, tete = git_info()
    bloquants = [(r, c) for r in resultats for c in r["constats"] if c["gravite"] == BLOQUE]
    a_lister = [(r, c) for r in resultats for c in r["constats"] if c["gravite"] == LISTE]
    vert = not bloquants and not erreurs_moteurs
    L = []
    L.append("# Robot des parcours : rapport du %s" % debut.strftime("%d/%m/%Y à %H:%M"))
    L.append("")
    L.append("Banc : `%s`, branche `%s`, dernier commit `%s`. %d passages (%d parcours), %.1f min." % (
        banc.RACINE, branche, tete, len(resultats), len({r["parcours"] for r in resultats}), duree / 60))
    L.append("")
    L.append("**Résultat : %s** : %d défaut(s) bloquant(s) dans %d passage(s) ; %d constat(s) à corriger par lot." % (
        "VERT" if vert else "ROUGE", len(bloquants), len({id(r) for r, _ in bloquants}), len(a_lister)))
    for e in erreurs_moteurs:
        L.append("")
        L.append("**Moteur indisponible** : %s" % e)
    L.append("")
    L.append("## Parcours")
    L.append("")
    L.append("Clics jusqu'au but, par navigation (ancienne / nouvelle) et par format (ordinateur, téléphone). « x » : le parcours n'aboutit pas.")
    L.append("")
    L.append("| Parcours | Rôle | Budget (ord. / tél.) | Ordinateur | Téléphone | Aboutit |")
    L.append("|---|---|---|---|---|---|")
    for pid, p in registre.items():
        rs = [r for r in resultats if r["parcours"] == pid]
        if not rs:
            continue
        def clics(fmt):
            morceaux = []
            for nav in NAVIGATIONS:
                vals = sorted({("x" if not r["abouti"] else str(r["clics_au_but"])) for r in rs if r["format"] == fmt and r["navigation"] == nav})
                if vals:
                    morceaux.append("/".join(vals))
                else:
                    morceaux.append("aucun")
            return " / ".join(morceaux)
        b = p.budget if isinstance(p.budget, dict) else {"ordinateur": p.budget, "telephone": p.budget}
        ok = sum(1 for r in rs if r["abouti"])
        L.append("| %s (`%s`) | %s | %s / %s | %s | %s | %d sur %d |" % (p.titre, pid, p.role, b["ordinateur"], b["telephone"],
                                                                     clics("ordinateur"), clics("telephone"), ok, len(rs)))
    L.append("")
    L.append("## Défauts bloquants")
    L.append("")
    if not bloquants:
        L.append("Aucun.")
    groupes = {}
    for r, c in bloquants:
        groupes.setdefault((c["critere"], r["parcours"], c["message"]), []).append((r, c))
    for crit in sorted({k[0] for k in groupes}):
        L.append("### %s. %s" % (crit, CRITERES[crit]))
        L.append("")
        for (cr, pid, msg), occ in groupes.items():
            if cr != crit:
                continue
            ou = ", ".join(sorted({libelle(r) for r, _ in occ}))
            etape = occ[0][1]["etape"]
            capture = next((c.get("capture") for _, c in occ if c.get("capture")), None)
            L.append("- **%s**, étape « %s » : %s. Dans : %s.%s" % (pid, etape, msg, ou, (" Capture : `captures/%s`." % capture) if capture else ""))
            cliq = next((c.get("cliquables") for _, c in occ if c.get("cliquables")), None)
            if cliq:
                L.append("  Visible à ce moment : %s." % " | ".join(cliq[:25]))
        L.append("")
    L.append("## À corriger par lot")
    L.append("")
    if not a_lister:
        L.append("Rien.")
    groupes = {}
    for r, c in a_lister:
        groupes.setdefault((c["critere"], c["message"]), []).append((r, c))
    for crit in sorted({k[0] for k in groupes}):
        L.append("### %s. %s" % (crit, CRITERES[crit]))
        L.append("")
        lignes = sorted(groupes.items(), key=lambda kv: (-len(kv[1]), kv[0][1]))
        for (cr, msg), occ in lignes:
            if cr != crit:
                continue
            pids = sorted({r["parcours"] for r, _ in occ})
            ctx = sorted({"%s %s" % (NOMS[r["format"]], r["navigation"]) for r, _ in occ})
            ou = ", ".join(pids) if len(pids) <= 3 else "%d parcours dont %s" % (len(pids), ", ".join(pids[:2]))
            L.append("- %s (%d fois ; %s ; %s)" % (msg, len(occ), ou, ", ".join(ctx)))
        L.append("")
    (dossier / "rapport.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    (dossier / "resultats.json").write_text(json.dumps(resultats, ensure_ascii=False, indent=1), encoding="utf-8")
    # Planche : l'écran de fin de chaque passage, pour juger l'attrait visuel (critère K) à l'œil.
    cartes = []
    for r in sorted(resultats, key=lambda r: (r["parcours"], r["navigation"], r["format"], r["moteur"])):
        if r.get("capture_finale"):
            cartes.append('<figure><img loading="lazy" src="captures/%s" alt=""><figcaption><b>%s</b><br>%s</figcaption></figure>' % (
                html.escape(r["capture_finale"]), html.escape(registre[r["parcours"]].titre), html.escape(libelle(r))))
    (dossier / "planche.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Planche des parcours</title><style>body{font:14px system-ui;margin:16px;background:#f3f4f1}"
        "main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}figure{margin:0;background:#fff;padding:8px;border-radius:8px}"
        "img{width:100%;height:auto;border:1px solid #ddd}figcaption{margin-top:6px;color:#333}</style><h1>Écrans de fin des parcours</h1><main>"
        + "".join(cartes) + "</main>", encoding="utf-8")
    return vert, len(bloquants)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Robot des parcours réels (filet avant fusion).")
    ap.add_argument("--parcours", help="identifiants séparés par des virgules (défaut : tous)")
    ap.add_argument("--moteurs", default=",".join(MOTEURS))
    ap.add_argument("--formats", default=",".join(FORMATS))
    ap.add_argument("--navigations", default=",".join(NAVIGATIONS))
    ap.add_argument("--sortie", help="dossier du rapport (défaut : outils/robot_rapports/<date-heure>)")
    ap.add_argument("--liste", action="store_true", help="liste les parcours et s'arrête")
    ap.add_argument("--processus", type=int, default=4, help="processus en parallèle (défaut 4)")
    a = ap.parse_args(argv)

    registre = charger_tous()
    if a.liste:
        for pid, p in registre.items():
            print("%-32s %-10s budget %-28s %s" % (pid, p.role, p.budget, p.titre))
        return 0
    voulus = [x.strip() for x in a.parcours.split(",")] if a.parcours else list(registre)
    inconnus = [x for x in voulus if x not in registre]
    if inconnus:
        print("Parcours inconnus : %s (voir --liste)" % ", ".join(inconnus))
        return 2
    moteurs = [m for m in a.moteurs.split(",") if m in MOTEURS]
    formats = [f for f in a.formats.split(",") if f in FORMATS]
    navigations = [n for n in a.navigations.split(",") if n in NAVIGATIONS]

    debut = datetime.datetime.now()
    dossier = pathlib.Path(a.sortie) if a.sortie else banc.RACINE / "outils" / "robot_rapports" / debut.strftime("%Y-%m-%d_%H%M%S")
    (dossier / "captures").mkdir(parents=True, exist_ok=True)
    for m in banc.preparer_fichiers():
        print("banc : " + m, flush=True)
    serveur, base_url = banc.demarrer_serveur()
    print("Banc servi sur %s ; rapport dans %s" % (base_url, dossier), flush=True)

    lots = {}
    for pid in voulus:
        p = registre[pid]
        for m in moteurs:
            for f in formats:
                if f not in p.formats:
                    continue
                for n in navigations:
                    if n in p.navigations:
                        lots.setdefault((m, f), []).append({"parcours": pid, "moteur": m, "format": f, "navigation": n})
    total = sum(len(v) for v in lots.values())
    print("%d passages : %d parcours, %s, %s, %s\n" % (total, len(voulus), "+".join(moteurs), "+".join(formats), "+".join(navigations)), flush=True)

    resultats, erreurs_moteurs = [], []
    t0 = time.perf_counter()
    with concurrent.futures.ProcessPoolExecutor(max_workers=max(1, min(a.processus, len(lots)))) as ex:
        futurs = [ex.submit(travailleur, m, f, scs, base_url, str(dossier / "captures")) for (m, f), scs in lots.items()]
        for fu in concurrent.futures.as_completed(futurs):
            try:
                r = fu.result()
            except Exception as e:
                erreurs_moteurs.append("un processus s'est arrêté : %s" % e)
                continue
            if r["erreur"]:
                erreurs_moteurs.append(r["erreur"])
            resultats.extend(r["resultats"])
    duree = time.perf_counter() - t0
    serveur.shutdown()

    ecarts_entre_moteurs(resultats)
    vert, nb = ecrire_rapport(dossier, resultats, registre, debut, duree, erreurs_moteurs)
    print("\n%d passages en %.1f min. %s" % (len(resultats), duree / 60,
          "VERT : aucun défaut bloquant." if vert else "ROUGE : %d défaut(s) bloquant(s)." % nb))
    print("Rapport : %s" % (dossier / "rapport.md"))
    print("Planche des écrans de fin : %s" % (dossier / "planche.html"))
    if erreurs_moteurs and not resultats:
        return 2
    return 0 if vert else 1


if __name__ == "__main__":
    sys.exit(main())
