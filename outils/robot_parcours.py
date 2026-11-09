#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Robot des parcours réels : le filet de qualité à passer avant chaque fusion dans main.

Usage
-----
    python outils/robot_parcours.py                      # tout : environ 3 minutes
    python outils/robot_parcours.py --parcours passer-un-qcm,lire-un-cours --moteurs chromium
    python outils/robot_parcours.py --habillages ecsr,ecf   # rejoue aussi en « Couleurs ECF » (défaut : ecsr seul)
    python outils/robot_parcours.py --liste              # les parcours connus, sans rien jouer

Ce qu'il fait : il sert l'app sur un port libre de la machine (banc d'essai, faux Supabase, données
fictives, aucune requête vers la base), ouvre Chromium et WebKit (le moteur de Safari, donc de l'iPhone)
sans fenêtre, en iPhone (375 px, tactile) et en ordinateur (1 280 px), dans l'ancienne et la nouvelle
navigation, et joue chaque parcours (outils/parcours/stagiaire.py, equipe.py) comme une personne : en
cliquant sur ce qu'elle voit. Il compte les clics, chronomètre l'affichage, et contrôle chaque écran
selon le référentiel (docs/qualite/referentiel.md).

Sortie : une ligne par passage, puis le rapport (rapport.md, planche.html des écrans de fin pour juger
l'attrait visuel, resultats.json, captures) dans outils/robot_rapports/<date-heure>/ (ignoré par git :
les captures montrent les données fictives du banc). Code de sortie : 0 (vert) si aucun défaut bloquant
nouveau, 1 (rouge) s'il y en a, 2 si le robot n'a pas pu juger : option inconnue, aucun passage joué, banc
ou moteur qui ne démarre pas, passage manquant ou non jugé.

Clavier : ne pas taper pendant que le robot tourne. Dans WebKit sous Windows, une touche Maj, Ctrl ou Alt tenue sur
la machine fausse les touchers du format téléphone (un lien ne s'ouvre plus). Le robot attend un clavier libre
avant de toucher et rejoue un passage faussé ; s'il l'est encore trois fois de suite, le passage est « non jugé ».
Contrôle de ce mécanisme : python outils/controle_toucher.py [--clavier].

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
from parcours.visite import Visite, Echec, Fausse, CRITERES, BLOQUE, LISTE  # noqa: E402
from parcours.connus import connu, attendu_dans, DEFAUTS_CONNUS  # noqa: E402

MOTEURS = ("chromium", "webkit")
FORMATS = ("ordinateur", "telephone")
NAVIGATIONS = ("ancienne", "nouvelle")
HABILLAGES = ("ecsr", "ecf")    # data-skin de <html> ; « ecsr » est le défaut, l'appareil vierge
CLES_SCENARIO = ("moteur", "format", "navigation", "habillage")
NOMS = {"chromium": "Chromium", "webkit": "WebKit", "ordinateur": "ordinateur", "telephone": "téléphone",
        "ancienne": "ancienne navigation", "nouvelle": "nouvelle navigation"}

JS_CLIQUABLES = r"""() => [...document.querySelectorAll('a[href], button, [role=tab], input, select, textarea')]
  .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; })
  .slice(0, 40).map((e) => (e.getAttribute('aria-label') || e.innerText || e.value || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 50))
  .filter(Boolean)"""


def libelle(sc):
    base = "%s · %s · %s" % (NOMS[sc["moteur"]], NOMS[sc["format"]], NOMS[sc["navigation"]])
    # Seul « ecf » ajoute une mention : les lignes du défaut restent identiques à celles d'avant la dimension.
    return base + " · Couleurs ECF" if sc.get("habillage", "ecsr") == "ecf" else base


ESSAIS_MAX = 3   # un passage faussé par le clavier de la machine trois fois de suite est « non jugé »


def jouer_un(navigateur, p, sc, base_url, dossier):
    """Joue un parcours ; rend le résultat (dictionnaire sérialisable). Un passage dont un geste a été faussé par le
    clavier de la machine (visite.Fausse) ne dit rien de l'app : il est rejoué dans un contexte neuf, clavier libre,
    et seul le dernier essai compte. Faussé ESSAIS_MAX fois de suite, il est « non jugé » : ni vert ni rouge."""
    reprises = []
    for _ in range(ESSAIS_MAX):
        if sc["moteur"] == "webkit" and sc["format"] == "telephone":
            banc.attendre_clavier_libre(30)
        r = _jouer_une_fois(navigateur, p, sc, base_url, dossier)
        if "fausse" not in r:
            r["reprises"] = reprises
            return r
        reprises.append(r["fausse"])
    return {"parcours": p.id, **sc, "abouti": False, "non_juge": "geste faussé %d fois par le clavier de la machine (dernier : %s)"
            % (len(reprises), reprises[-1]), "reprises": reprises, "clics": 0, "clics_au_but": None, "budget": None, "duree": 0,
            "ouverture_ms": None, "etapes": [], "constats": [], "capture_finale": None}


def _jouer_une_fois(navigateur, p, sc, base_url, dossier):
    """Un essai du parcours dans un contexte neuf. Rend {"fausse": raison} si un geste a été faussé."""
    erreurs = []
    contexte = banc.nouveau_contexte(navigateur, sc["format"], p.semis, sc.get("habillage", "ecsr"))
    contexte.set_default_timeout(10000)    # aucun geste ne reste pendu plus de 10 s
    page = contexte.new_page()
    page.on("pageerror", lambda e: erreurs.append("erreur de page : %s" % str(e).splitlines()[0][:200]))
    page.on("console", lambda m: erreurs.append("console : %s" % m.text[:200]) if m.type == "error" else None)
    page.on("dialog", lambda d: (erreurs.append("boîte de dialogue inattendue : %s" % d.message[:120]), d.dismiss()))
    v = Visite(page, sc, p, base_url, dossier, erreurs)
    t0 = time.perf_counter()
    abouti, raison = True, None
    try:
        v.ouvrir()
        # Le levier est posé avant le chargement, l'app écrit data-skin elle-même : on vérifie qu'elle l'a fait.
        lu = page.evaluate("() => document.documentElement.dataset.skin || ''")
        attendu = sc.get("habillage", "ecsr")
        if lu != attendu:
            raise Echec("habillage non appliqué : attendu %s, lu %s" % (attendu, lu or "(aucun)"))
        p.fonction(v)
        if not v.but_atteint:
            raise Echec("le parcours s'est terminé sans atteindre son but")
    except Fausse as e:
        try:
            contexte.close()
        except Exception:
            pass
        return {"fausse": str(e)}
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
            "duree": round(duree, 1), "ouverture_ms": v.temps.get("ouverture"), "etapes": v.etapes, "vues": len(v._vues_controlees), "constats": v.constats,
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
            try:
                r = jouer_un(navigateur, registre[sc["parcours"]], {k: sc[k] for k in CLES_SCENARIO}, base_url, dossier)
            except Exception as e:     # le navigateur lui-même a lâché : le passage compte comme raté
                r = {"parcours": sc["parcours"], **{k: sc[k] for k in CLES_SCENARIO}, "abouti": False,
                     "clics": 0, "clics_au_but": None, "budget": None, "duree": 0, "ouverture_ms": None, "etapes": [],
                     "capture_finale": None, "constats": [{"critere": "A", "gravite": BLOQUE, "etape": "lancement",
                                                           "message": "erreur du navigateur : %s" % str(e).splitlines()[0][:200]}]}
            resultats.append(r)
            if r.get("non_juge"):
                print("  ?    %-32s %-34s non jugé : %s" % (r["parcours"], libelle(r), r["non_juge"]), flush=True)
                continue
            bloquants = [c for c in r["constats"] if c["gravite"] == BLOQUE]
            nouveaux = [c for c in bloquants if not connu(r, c)]
            marque = "ÉCHEC" if nouveaux or not r["abouti"] else ("connu" if bloquants else "ok  ")
            print("  %s %-32s %-34s %s/%s clics  %4.1f s%s" % (marque, r["parcours"], libelle(r), r["clics_au_but"] if r["clics_au_but"] is not None else "-",
                                                          r["budget"], r["duree"],
                                                          "  (rejoué : clavier de la machine)" if r.get("reprises") else ""), flush=True)
        navigateur.close()
    return {"erreur": None, "resultats": resultats}


def ecarts_entre_moteurs(resultats):
    """Critère H : un parcours qui aboutit dans un moteur et pas dans l'autre, à format, navigation et habillage égaux."""
    par_cle = {}
    for r in resultats:
        par_cle.setdefault((r["parcours"], r["format"], r["navigation"], r.get("habillage", "ecsr")), {})[r["moteur"]] = r
    for (pid, fmt, nav, hab), m in par_cle.items():
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


def ecrire_rapport(dossier, resultats, registre, debut, duree, erreurs_moteurs, attendus, non_juges=()):
    branche, tete = git_info()
    tous_bloquants = [(r, c) for r in resultats for c in r["constats"] if c["gravite"] == BLOQUE]
    # Un défaut déjà présent sur main (parcours/connus.py) est montré à part et ne bloque pas.
    bloquants = [(r, c) for r, c in tous_bloquants if not connu(r, c)]
    deja_connus = [(r, c, connu(r, c)) for r, c in tous_bloquants if connu(r, c)]
    a_lister = [(r, c) for r in resultats for c in r["constats"] if c["gravite"] == LISTE]
    manquants = attendus - len(resultats)
    vert = not bloquants and not erreurs_moteurs and manquants == 0 and len(resultats) > 0
    L = []
    L.append("# Robot des parcours : rapport du %s" % debut.strftime("%d/%m/%Y à %H:%M"))
    L.append("")
    L.append("Banc : `%s`, branche `%s`, dernier commit `%s`. %d passages (%d parcours), %.1f min." % (
        banc.RACINE, branche, tete, len(resultats), len({r["parcours"] for r in resultats}), duree / 60))
    L.append("")
    L.append("**Résultat : %s** : %d défaut(s) bloquant(s) nouveau(x) dans %d passage(s) ; %d défaut(s) connu(s) de main "
             "(ne bloquent pas) ; %d constat(s) distinct(s) à corriger par lot." % (
        "VERT" if vert else ("ROUGE" if bloquants else "INCOMPLET"), len(bloquants), len({id(r) for r, _ in bloquants}),
        len({d["contient"] for _, _, d in deja_connus}), len({(c["critere"], c["message"]) for _, c in a_lister})))
    for e in erreurs_moteurs:
        L.append("")
        L.append("**Moteur indisponible** : %s" % e)
    if manquants - len(non_juges):
        L.append("")
        L.append("**%d passage(s) prévu(s) n'ont pas été joués** : le résultat ne peut pas être vert." % (manquants - len(non_juges)))
    for r in non_juges:
        L.append("")
        L.append("**Passage non jugé** : %s (%s), %s. Le résultat ne peut pas être vert : relancer le robot sans taper au "
                 "clavier pendant qu'il tourne." % (r["parcours"], libelle(r), r["non_juge"]))
    rejoues = [r for r in resultats if r.get("reprises")]
    if rejoues:
        L.append("")
        L.append("%d passage(s) rejoué(s) : un geste y avait reçu une touche (Maj, Ctrl, Alt) tenue sur le clavier de la machine, "
                 "ce qui fausse un toucher dans WebKit ; seul le dernier essai, clavier libre, compte (%s)." % (
                     len(rejoues), ", ".join("%s, %s" % (r["parcours"], libelle(r)) for r in rejoues)))
    L.append("")
    L.append("Dimensions jouées : moteurs %s ; formats %s ; navigations %s ; habillages %s." % tuple(
        ", ".join(sorted({r[k] for r in resultats})) for k in CLES_SCENARIO))
    L.append("")
    L.append("## Parcours")
    L.append("")
    L.append("Clics jusqu'au but, par navigation (ancienne / nouvelle) et par format (ordinateur, téléphone). « x » : le parcours n'aboutit pas.")
    L.append("")
    L.append("| Parcours | Rôle | Budget (ord. / tél.) | Ordinateur | Téléphone | Habillages | Aboutit | Bloquants nouveaux |")
    L.append("|---|---|---|---|---|---|---|---|")
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
        nb = len({(c["critere"], c["message"]) for r, c in bloquants if r["parcours"] == pid})
        habs = ", ".join(sorted({r["habillage"] for r in rs}))
        L.append("| %s (`%s`) | %s | %s / %s | %s | %s | %s | %d sur %d | %s |" % (p.titre, pid, p.role, b["ordinateur"], b["telephone"],
                                                                          clics("ordinateur"), clics("telephone"), habs, ok, len(rs), nb or "aucun"))
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
    L.append("## Défauts connus de main (ne bloquent pas)")
    L.append("")
    L.append("Listés dans `outils/parcours/connus.py` ; un chantier qui en corrige un retire sa ligne dans la même fusion.")
    L.append("")
    for d in DEFAUTS_CONNUS:
        occ = [(r, c) for r, c, dd in deja_connus if dd is d]
        if occ:
            L.append("- **%s** (%s, %s) : vu dans %d passage(s) : %s." % (d["parcours"], d["critere"], d["note"], len(occ),
                     ", ".join(sorted({libelle(r) for r, _ in occ}))))
        elif any(attendu_dans(d, r) for r in resultats):
            L.append("- **%s** (%s, %s) : **revu dans aucun passage : peut-être corrigé, ligne à retirer**." % (d["parcours"], d["critere"], d["note"]))
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
            ctx = sorted({"%s %s%s" % (NOMS[r["format"]], r["navigation"], " Couleurs ECF" if r["habillage"] == "ecf" else "") for r, _ in occ})
            ou = ", ".join(pids) if len(pids) <= 3 else "%d parcours dont %s" % (len(pids), ", ".join(pids[:2]))
            L.append("- %s (%d fois ; %s ; %s)" % (msg, len(occ), ou, ", ".join(ctx)))
        L.append("")
    (dossier / "rapport.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    (dossier / "resultats.json").write_text(json.dumps(list(resultats) + list(non_juges), ensure_ascii=False, indent=1), encoding="utf-8")
    # Planche : l'écran de fin de chaque passage, pour juger l'attrait visuel (critère K) à l'œil.
    cartes = []
    for r in sorted(resultats, key=lambda r: (r["parcours"], r["navigation"], r["format"], r["moteur"], r["habillage"])):
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
    ap.add_argument("--habillages", default="ecsr", help="ecsr (défaut), ecf, ou ecsr,ecf : le filet double avec les deux")
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
    choix = {}
    for nom, valeur, permis in (("moteurs", a.moteurs, MOTEURS), ("formats", a.formats, FORMATS), ("navigations", a.navigations, NAVIGATIONS),
                                   ("habillages", a.habillages, HABILLAGES)):
        valeurs = [x.strip() for x in valeur.split(",") if x.strip()]
        fautes = [x for x in valeurs if x not in permis]
        if fautes or not valeurs:
            # Une faute de frappe ne doit jamais donner « 0 passage, vert ».
            print("--%s : %s inconnu(s) ; valeurs permises : %s" % (nom, ", ".join(fautes) or "(vide)", ", ".join(permis)))
            return 2
        choix[nom] = valeurs
    moteurs, formats, navigations, habillages = choix["moteurs"], choix["formats"], choix["navigations"], choix["habillages"]

    debut = datetime.datetime.now()
    dossier = pathlib.Path(a.sortie) if a.sortie else banc.RACINE / "outils" / "robot_rapports" / debut.strftime("%Y-%m-%d_%H%M%S")
    (dossier / "captures").mkdir(parents=True, exist_ok=True)
    try:
        for m in banc.preparer_fichiers():
            print("banc : " + m, flush=True)
    except SystemExit as e:
        print(e)
        return 2

    lots = {}
    for pid in voulus:
        p = registre[pid]
        for m in moteurs:
            for f in formats:
                if f not in p.formats:
                    continue
                for n in navigations:
                    if n in p.navigations:
                        for h in habillages:
                            lots.setdefault((m, f), []).append({"parcours": pid, "moteur": m, "format": f, "navigation": n, "habillage": h})
    total = sum(len(v) for v in lots.values())
    if not total:
        print("Aucun passage à jouer avec ces options (formats ou navigations que ces parcours n'acceptent pas).")
        return 2
    # Les habillages ne sont nommés que s'ils ne sont pas le seul défaut : la ligne du défaut reste celle d'avant.
    suite = "" if habillages == ["ecsr"] else ", " + "+".join(habillages)
    print("%d passages : %d parcours, %s, %s, %s%s\n" % (total, len(voulus), "+".join(moteurs), "+".join(formats), "+".join(navigations), suite), flush=True)

    resultats, erreurs_moteurs = [], []
    serveur, base_url = banc.demarrer_serveur()
    print("Banc servi sur %s ; rapport dans %s" % (base_url, dossier), flush=True)
    t0 = time.perf_counter()
    try:
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
    finally:
        serveur.shutdown()        # le port est rendu même si le robot est interrompu
        serveur.server_close()
    duree = time.perf_counter() - t0

    resultats, non_juges = separer_non_juges(resultats)
    ecarts_entre_moteurs(resultats)
    vert, nb = ecrire_rapport(dossier, resultats, registre, debut, duree, erreurs_moteurs, total, non_juges)
    incomplet = erreurs_moteurs or len(resultats) < total
    print("\n%d passages sur %d en %.1f min. %s" % (len(resultats), total, duree / 60,
          "VERT : aucun défaut bloquant nouveau." if vert else
          ("INCOMPLET : %d passage(s) non joué(s) ou non jugé(s)." % (total - len(resultats)) if incomplet and not nb
           else "ROUGE : %d défaut(s) bloquant(s)." % nb)))
    print("Rapport : %s" % (dossier / "rapport.md"))
    print("Planche des écrans de fin : %s" % (dossier / "planche.html"))
    return code_de_sortie(vert, nb)


def separer_non_juges(resultats):
    """(passages jugés, passages non jugés). Un passage non jugé (geste faussé par le clavier de la machine à chaque
    essai) ne compte ni comme vert ni comme rouge : il manque aux passages jugés, et le résultat est incomplet."""
    return [r for r in resultats if not r.get("non_juge")], [r for r in resultats if r.get("non_juge")]


def code_de_sortie(vert, nb):
    """0 vert ; 1 rouge (défaut bloquant nouveau) ; 2 le robot n'a pas pu juger (passage manquant ou non jugé)."""
    if vert:
        return 0
    return 1 if nb else 2


if __name__ == "__main__":
    sys.exit(main())
