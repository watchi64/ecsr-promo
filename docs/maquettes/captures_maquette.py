"""Captures et tests de la maquette de navigation, dans Chromium et WebKit (Safari).

Usage : python docs/maquettes/captures_maquette.py <dossier_de_sortie> [url]
L'url par défaut vise le serveur local du worktree (configuration « maquette-nav »).
- Joue tests_maquette.js dans chaque moteur et affiche le résumé.
- Enregistre une capture par état listé dans ETATS (ordinateur 1440x900, iPhone 390x844).
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ICI = pathlib.Path(__file__).resolve().parent
URL = "http://localhost:8040/docs/maquettes/refonte-navigation.local.html"

# (nom, appareil, rôle, page, sous-onglet, habillage, calque, replié)
ETATS = [
    ("01-stagiaire-accueil-ordi", "ordi", "stagiaire", "accueil", None, "ecsr", None, False),
    ("02-stagiaire-accueil-iphone", "iphone", "stagiaire", "accueil", None, "ecsr", None, False),
    ("03-stagiaire-accueil-iphone-ecf", "iphone", "stagiaire", "accueil", None, "ecf", None, False),
    ("04-stagiaire-compte-iphone", "iphone", "stagiaire", "accueil", None, "ecsr", "account", False),
    ("05-stagiaire-cours-ordi", "ordi", "stagiaire", "cours", "themes", "ecsr", None, False),
    ("06-stagiaire-suivi-iphone", "iphone", "stagiaire", "suivi", "resultats", "ecsr", None, False),
    ("07-formateur-aujourdhui-ordi", "ordi", "formateur", "aujourdhui", None, "ecsr", None, False),
    ("08-formateur-aujourdhui-iphone", "iphone", "formateur", "aujourdhui", None, "ecsr", None, False),
    ("09-formateur-plus-iphone", "iphone", "formateur", "aujourdhui", None, "ecsr", "menu", False),
    ("10-formateur-stagiaires-ordi-replie", "ordi", "formateur", "stagiaires", None, "ecsr", None, True),
    ("11-formateur-promo-ordi", "ordi", "formateur", "aujourdhui", None, "ecf", "ctx", False),
    ("12-direction-ensemble-ordi-ecf", "ordi", "direction", "ensemble", None, "ecf", None, False),
    ("13-direction-ensemble-iphone-ecf", "iphone", "direction", "ensemble", None, "ecf", None, False),
    ("14-direction-compte-ordi", "ordi", "direction", "ensemble", None, "ecsr", "account", False),
    ("15-siege-ensemble-ordi-ecf", "ordi", "siege", "ensemble", None, "ecf", None, False),
    ("16-siege-qualiopi-ordi", "ordi", "siege", "qualiopi", None, "ecsr", None, False),
    ("17-signalement-ordi", "ordi", "formateur", "notes", "matrice", "ecsr", "signal", False),
]

POSER = """([role, page, sous, habillage, calque, replie]) => {
  const M = window.__maquette, S = M.S;
  S.view = 'maquette'; S.role = role; S.skin = habillage; S.collapsed = replie; S.page = {}; S.sub = {};
  M.render(); window.dispatchEvent(new Event('resize'));
  M.go(page, sous || undefined);
  if (calque) M.open(calque);
  return S.size;
}"""


def main():
    sortie = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ICI / "captures")
    url = sys.argv[2] if len(sys.argv) > 2 else URL
    sortie.mkdir(parents=True, exist_ok=True)
    tests = (ICI / "tests_maquette.js").read_text(encoding="utf-8")
    with sync_playwright() as p:
        for nom_moteur, moteur in (("chromium", p.chromium), ("webkit", p.webkit)):
            try:
                navigateur = moteur.launch()
            except Exception:
                # Le WebKit attendu par cette version de Playwright peut manquer : on prend
                # celui déjà installé sur la machine plutôt que d'en télécharger un.
                installes = sorted(pathlib.Path.home().glob("AppData/Local/ms-playwright/%s-*/Playwright.exe" % nom_moteur))
                if not installes:
                    print(nom_moteur, ": aucun moteur installé, ignoré")
                    continue
                navigateur = moteur.launch(executable_path=str(installes[-1]))
            erreurs = []
            page = navigateur.new_page(viewport={"width": 1440, "height": 900})
            page.on("pageerror", lambda e: erreurs.append(str(e)))
            page.goto(url + "?moteur=" + nom_moteur)
            page.wait_for_function("window.__maquette !== undefined")
            resultat = json.loads(page.evaluate("() => { " + tests.replace("JSON.stringify(", "return JSON.stringify(", 1) + " }"))
            print(nom_moteur, ":", resultat["resume"], "| erreurs JS :", len(erreurs))
            for e in resultat["echecs"][:12]:
                print("   ", e)
            page.close()
            if nom_moteur != "chromium":
                navigateur.close()
                continue
            for nom, appareil, role, page_id, sous, habillage, calque, replie in ETATS:
                if appareil == "ordi":
                    contexte = navigateur.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
                else:
                    contexte = navigateur.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
                onglet = contexte.new_page()
                onglet.goto(url + "?c=" + nom)
                onglet.wait_for_function("window.__maquette !== undefined")
                onglet.evaluate("document.fonts.ready")
                taille = onglet.evaluate(POSER, [role, page_id, sous, habillage, calque, replie])
                onglet.wait_for_timeout(250)
                onglet.screenshot(path=str(sortie / (nom + ".png")))
                print("capture", nom, "(" + taille + ")")
                contexte.close()
            # Le volet « Proposition », sur ordinateur puis sur iPhone
            for nom, vue in (("18-proposition-ordi", {"width": 1440, "height": 900}), ("19-proposition-iphone", {"width": 390, "height": 844})):
                contexte = navigateur.new_context(viewport=vue, device_scale_factor=1 if vue["width"] > 500 else 2)
                onglet = contexte.new_page()
                onglet.goto(url + "?c=" + nom + "#proposition")
                onglet.wait_for_function("window.__maquette !== undefined")
                onglet.evaluate("document.fonts.ready")
                onglet.wait_for_timeout(250)
                onglet.screenshot(path=str(sortie / (nom + ".png")))
                contexte.close()
            navigateur.close()


if __name__ == "__main__":
    main()
