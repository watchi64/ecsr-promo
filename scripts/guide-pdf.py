"""Régénère le PDF imprimable du guide « Boîte à outils numérique CCP2 ».

À relancer après chaque modification de assets/guides/boite-a-outils-ccp2.html,
puis committer le HTML et le PDF ensemble (le bouton de la page pointe sur le PDF).
Usage : python scripts/guide-pdf.py
"""
import pathlib, subprocess

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
racine = pathlib.Path(__file__).resolve().parent.parent
html = racine / "assets" / "guides" / "boite-a-outils-ccp2.html"
pdf = html.with_suffix(".pdf")

subprocess.run([
    CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--allow-file-access-from-files", "--virtual-time-budget=8000",
    f"--print-to-pdf={pdf}", html.as_uri() + "?pdf",
], check=True, capture_output=True)
print(pdf, pdf.stat().st_size // 1024, "Ko")
