"""Fabrique le code QR de la page d'installation : assets/installer/qr-installer.svg.

Le code vise <adresse de deploiement/site.json>installer. À relancer seulement si l'adresse de l'app change :
    python outils/generer_qr_installer.py
Demande le paquet Python « qrcode » (pip install qrcode). Couleurs de l'app : encre #1F2924 sur carte #FBFCFA.
"""
import json
import pathlib

import qrcode
from qrcode.constants import ERROR_CORRECT_M

RACINE = pathlib.Path(__file__).resolve().parent.parent
ENCRE, FOND = "#1F2924", "#FBFCFA"


def principal():
    adresse = json.loads((RACINE / "deploiement" / "site.json").read_text(encoding="utf-8"))["adresse"]
    cible = adresse.rstrip("/") + "/installer"
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, border=2)
    qr.add_data(cible)
    qr.make(fit=True)
    grille = qr.get_matrix()          # bordure comprise
    n = len(grille)
    # Un seul tracé : un carré par module noir, lignes fusionnées en bandes horizontales.
    d = []
    for y, ligne in enumerate(grille):
        x = 0
        while x < n:
            if ligne[x]:
                debut = x
                while x < n and ligne[x]:
                    x += 1
                d.append(f"M{debut} {y}h{x - debut}v1h-{x - debut}z")
            else:
                x += 1
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">'
           f'<title>{cible}</title><rect width="{n}" height="{n}" fill="{FOND}"/>'
           f'<path fill="{ENCRE}" d="{"".join(d)}"/></svg>\n')
    sortie = RACINE / "assets" / "installer" / "qr-installer.svg"
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(svg, encoding="utf-8", newline="\n")
    print(f"[qr] {sortie.relative_to(RACINE)} vers {cible} ({n} x {n} modules)")


if __name__ == "__main__":
    principal()
