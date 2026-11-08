"""Assemble la maquette de navigation : polices Canela intégrées en base64.

Sorties :
- refonte-navigation.html : la page publiée en artefact (sans <html>/<head>/<body>,
  la plateforme pose elle-même le squelette) ;
- refonte-navigation.local.html : la même page dans un squelette équivalent, pour
  la tester dans le navigateur local (sans doctype, le navigateur passerait en mode
  de compatibilité et le rendu ne serait pas celui publié).

Lancer depuis la racine du dépôt : python docs/maquettes/assembler_maquette.py
"""
import base64
import pathlib

RACINE = pathlib.Path(__file__).resolve().parents[2]
ICI = pathlib.Path(__file__).resolve().parent
POLICES = [(300, "canela_light.otf"), (400, "canela_roman.otf"), (700, "canela_bold.otf")]
CADRATIN = chr(0x2014)


def polices_canela():
    blocs = []
    for graisse, nom in POLICES:
        donnees = base64.b64encode((RACINE / "css" / "fonts" / nom).read_bytes()).decode("ascii")
        blocs.append(
            '@font-face{font-family:"Canela";src:url(data:font/otf;base64,%s) format("opentype");'
            "font-weight:%d;font-style:normal;font-display:swap}" % (donnees, graisse)
        )
    return "\n".join(blocs)


def main():
    source = (ICI / "refonte-navigation.src.html").read_text(encoding="utf-8")
    if CADRATIN in source:
        raise SystemExit("Tiret cadratin présent dans la source : à remplacer avant d'assembler.")
    page = source.replace("/*@@CANELA@@*/", polices_canela())
    (ICI / "refonte-navigation.html").write_text(page, encoding="utf-8")
    squelette = (
        "<!doctype html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
        "body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n"
        "</head>\n<body>\n@@PAGE@@\n</body>\n</html>\n"
    )
    (ICI / "refonte-navigation.local.html").write_text(squelette.replace("@@PAGE@@", page), encoding="utf-8")
    print("Maquette assemblée :", len(page) // 1024, "Ko")


if __name__ == "__main__":
    main()
