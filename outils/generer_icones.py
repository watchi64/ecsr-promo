"""Icônes de l'app Jalonya, tirées d'une seule source : assets/logo/jalonya-icone.svg.

La source est un carré de 100 unités : un fond (<rect id="fond">, coins arrondis pour l'onglet du navigateur)
et la marque (<g id="marque">). Le script en tire les fichiers que citent index.html et le manifeste :

  icon-192.png, icon-512.png      fond plein, coins carrés (Android pose son propre masque)
  icon-maskable-512.png           marque réduite à 80 % pour rester dans la zone sûre (cercle de 80 % du côté)
  apple-touch-icon.png (180)      fond plein et opaque : iOS arrondit lui-même et rend la transparence en noir

Rendu par Chrome sans tête (déjà utilisé pour les PDF de l'app), aucun paquet à installer.
Usage : python outils/generer_icones.py
"""
from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
LOGO = RACINE / "assets" / "logo"
SOURCE = LOGO / "jalonya-icone.svg"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")

SORTIES = [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-maskable-512.png", 512, True),
    ("apple-touch-icon.png", 180, False),
]


def variante(svg: str, px: int, masquable: bool) -> str:
    """La source sans coins arrondis, à la taille voulue ; marque réduite autour du centre si masquable."""
    svg = re.sub(r'(<rect id="fond"[^>]*?)\s+rx="[^"]*"', r"\1", svg)
    svg = re.sub(r'<svg([^>]*?)\swidth="[^"]*"', r"<svg\1", svg)
    svg = re.sub(r'<svg([^>]*?)\sheight="[^"]*"', r"<svg\1", svg)
    svg = svg.replace("<svg", f'<svg width="{px}" height="{px}"', 1)
    if masquable:
        svg = svg.replace('<g id="marque"', '<g id="marque" transform="translate(10 10) scale(0.8)"', 1)
    return svg


def rendre(svg: str, px: int, sortie: Path, dossier: Path) -> None:
    page = dossier / "icone.html"
    page.write_text(
        "<!doctype html><meta charset='utf-8'><style>html,body{margin:0;background:transparent}"
        f"svg{{display:block}}</style>{svg}",
        encoding="utf-8",
    )
    subprocess.run(
        [str(CHROME), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
         "--default-background-color=00000000", f"--window-size={px},{px}", f"--screenshot={sortie}",
         page.as_uri()],
        check=True, capture_output=True,
    )


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        for nom, px, masquable in SORTIES:
            rendre(variante(source, px, masquable), px, LOGO / nom, Path(tmp))
            print(f"{nom} : {px} px")


if __name__ == "__main__":
    main()
