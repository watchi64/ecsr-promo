#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Construit le catalogue complet des panneaux routiers français pour la galerie
de l'éditeur ECSR : télécharge les SVG (domaine public) depuis Wikimedia
Commons et récupère les intitulés français depuis Wikipédia FR.

Rejouable : ne retélécharge pas un fichier déjà présent dans
assets/signaux/catalogue/. Ne touche jamais aux 21 SVG existants de
assets/signaux/ ni au registre SIGNAUX de js/signaux.js (ce catalogue est un
fichier séparé, js/signaux-catalogue.js, utilisé par la galerie de l'éditeur).

Usage :
    python scripts/construire_catalogue_signaux.py --date 2026-08-09

Sources :
    - Wikimedia Commons, API action=query&list=allimages (domaine public,
      fichiers "France road sign <CODE>.svg").
    - Wikipédia FR, API action=parse&prop=wikitext, pages dédiées à chaque
      famille de panneaux (voir PAGES_WIKIPEDIA ci-dessous).
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "ECSR-promo-catalogue/1.0 (misterwatchi@gmail.com)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php"
CADENCE = 0.4  # secondes entre deux requêtes réseau
TAILLE_MAX_OCTETS = 300 * 1024

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER_CATALOGUE = os.path.join(RACINE, "assets", "signaux", "catalogue")
FICHIER_JS = os.path.join(RACINE, "js", "signaux-catalogue.js")

# Séries ECSR retenues, dans l'ordre de préséance pour la détection du
# préfixe (les préfixes les plus spécifiques d'abord : AB et AK avant A,
# CE avant C, EB avant E).
SERIES = [
    ("AB", "priorites"),
    ("AK", "temporaire"),
    ("A", "danger"),
    ("CE", "services"),
    ("C", "indication"),
    ("B", "prescription"),
    ("EB", "agglomeration"),
    ("E", "localisation"),
    ("G", "passage-niveau"),
    ("J", "balisage"),
    ("M", "panonceaux"),
]

# Pages Wikipédia FR dépouillées pour les intitulés, dans l'ordre de
# préséance (une page listée en premier l'emporte si un même code apparaît
# sur plusieurs pages). Les pages "Liste des signaux..." sont des listes
# dédiées, plus propres que les pages de synthèse par famille.
PAGES_WIKIPEDIA = [
    "Liste des signaux routiers de danger en France",
    "Liste des signaux routiers de prescription en France",
    "Liste des signaux routiers d'indication en France",
    "Liste des signaux routiers de services en France",
    "Liste des panonceaux de signalisation routière en France",
    "Panneau de signalisation routière de danger en France",
    "Panneau de signalisation routière de priorité en France",
    "Panneau de signalisation routière de prescription en France",
    "Panneau de signalisation routière d'indication en France",
    "Panneau de signalisation routière de services en France",
    "Panneau de signalisation routière de localisation en France",
    "Panneau d'entrée ou de sortie d'agglomération en France",
    "Panneau de signalisation routière d'un passage à niveau en France",
    "Balise de signalisation routière en France",
    "Panneau de signalisation routière temporaire en France",
    "Panonceau de signalisation routière en France",
]

# Corrections manuelles ponctuelles : cas où le wikitexte des pages
# ci-dessus ne porte l'intitulé que dans une formulation trop irrégulière
# pour l'extraction automatique (vérifié à la main sur les pages listées).
CORRECTIONS_MANUELLES = {
    "EB10": "Entrée d'agglomération",
    "EB20": "Sortie d'agglomération",
}

CODE_MOTIF = r"[A-Z]{1,2}[0-9]{1,3}(?:-[0-9]{1,2})?[a-z]?[0-9]?(?:\s+bis)?"


# ---------------------------------------------------------------------------
# Étape 1 : liste des fichiers Commons et sélection des variantes
# ---------------------------------------------------------------------------

def requete_json(url, tentatives=5):
    """GET JSON avec User-Agent obligatoire, reprise en cas de 429."""
    attente = CADENCE
    for essai in range(tentatives):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as reponse:
                return json.loads(reponse.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and essai < tentatives - 1:
                print(f"  429 reçu, pause {attente:.1f}s puis reprise...")
                time.sleep(attente)
                attente *= 2
                continue
            raise
    raise RuntimeError("Blocage persistant de l'API après plusieurs tentatives")


def lister_fichiers_commons():
    """Interroge allimages avec pagination, retourne la liste brute des
    fichiers dont le titre commence par 'France road sign '."""
    fichiers = []
    aicontinue = None
    while True:
        params = {
            "action": "query",
            "list": "allimages",
            "aiprefix": "France road sign ",
            "aiprop": "url|size",
            "ailimit": "500",
            "format": "json",
        }
        if aicontinue:
            params["aicontinue"] = aicontinue
        url = COMMONS_API + "?" + urllib.parse.urlencode(params)
        data = requete_json(url)
        fichiers.extend(data.get("query", {}).get("allimages", []))
        aicontinue = data.get("continue", {}).get("aicontinue")
        print(f"  {len(fichiers)} fichiers listés...")
        time.sleep(CADENCE)
        if not aicontinue:
            break
    return fichiers


TITRE_MOTIF = re.compile(
    r"^France road sign ([A-Za-z0-9_-]+?)(?:\s*\(([^)]*)\))?\.svg$", re.IGNORECASE
)


def code_serie(code):
    """Retourne (prefixe, serie) pour un code donné, ou (None, None) si le
    code n'appartient à aucune des séries ECSR retenues."""
    for prefixe, serie in SERIES:
        if code.startswith(prefixe):
            reste = code[len(prefixe):]
            # Le préfixe doit être suivi d'un chiffre (pas d'une autre
            # lettre de famille collée, ex. éviter que "EB" ne matche "E"
            # avant, déjà géré par l'ordre de SERIES, mais on vérifie aussi
            # qu'il reste bien un chiffre après le préfixe).
            if reste[:1].isdigit():
                return prefixe, serie
    return None, None


def choisir_variantes(fichiers):
    """Applique les règles de filtrage et de sélection de variante décrites
    dans la consigne. Retourne un dict code -> entrée Commons retenue."""
    par_base = {}
    for f in fichiers:
        titre = f["title"]
        if not titre.startswith("File:"):
            continue
        nom = titre[len("File:"):]
        if "+" in nom:
            continue
        m = TITRE_MOTIF.match(nom)
        if not m:
            continue
        code_brut = m.group(1)
        variante = m.group(2)
        prefixe, serie = code_serie(code_brut)
        if not serie:
            continue
        par_base.setdefault(code_brut, {})
        cle_variante = "" if not variante else variante
        par_base[code_brut][cle_variante] = f

    retenus = {}
    for code_brut, variantes in par_base.items():
        if "" in variantes:
            retenus[code_brut] = variantes[""]
        else:
            premiere = sorted(variantes.keys())[0]
            retenus[code_brut] = variantes[premiere]
    return retenus


def nom_fichier_sur(code):
    return re.sub(r"[^A-Za-z0-9_-]", "-", code) + ".svg"


def telecharger_fichiers(retenus, rapport):
    """Télécharge chaque SVG retenu vers assets/signaux/catalogue/. Reprend
    sans retélécharger les fichiers déjà présents."""
    os.makedirs(DOSSIER_CATALOGUE, exist_ok=True)
    telecharges = {}
    for i, (code, entree) in enumerate(sorted(retenus.items()), start=1):
        nom_fichier = nom_fichier_sur(code)
        chemin = os.path.join(DOSSIER_CATALOGUE, nom_fichier)
        taille = entree.get("size", 0)
        if taille > TAILLE_MAX_OCTETS:
            rapport["ignores_trop_lourds"].append((code, taille))
            print(f"  [{i}/{len(retenus)}] {code} : ignoré, {taille} octets > {TAILLE_MAX_OCTETS}")
            continue
        if os.path.exists(chemin) and os.path.getsize(chemin) > 0:
            telecharges[code] = nom_fichier
            continue
        contenu = telecharger_avec_reprise(entree["url"], code, rapport)
        if contenu is None:
            continue
        with open(chemin, "wb") as f:
            f.write(contenu)
        telecharges[code] = nom_fichier
        print(f"  [{i}/{len(retenus)}] {code} téléchargé ({len(contenu)} octets)")
        time.sleep(CADENCE)
    return telecharges


def telecharger_avec_reprise(url, code, rapport, tentatives=6):
    """Télécharge un fichier avec reprise et ralentissement en cas de 429,
    comme demandé par la consigne ('si blocage, ralentir et reprendre')."""
    attente = 2.0
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for essai in range(tentatives):
        try:
            with urllib.request.urlopen(req, timeout=30) as reponse:
                return reponse.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and essai < tentatives - 1:
                print(f"  429 reçu pour {code}, pause {attente:.1f}s puis reprise...")
                time.sleep(attente)
                attente = min(attente * 2, 30)
                continue
            print(f"  ÉCHEC {code} : {exc}")
            rapport["echecs"].append(code)
            return None
        except Exception as exc:
            print(f"  ÉCHEC {code} : {exc}")
            rapport["echecs"].append(code)
            return None
    rapport["echecs"].append(code)
    return None


# ---------------------------------------------------------------------------
# Étape 2 : intitulés français depuis Wikipédia FR
# ---------------------------------------------------------------------------

REF_RE = re.compile(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", re.DOTALL)
HTML_RE = re.compile(r"<[^>]+>")
LINK_RE = re.compile(r"\[\[([^\]|]*\|)?([^\]]*)\]\]")


def nettoyer_wikitexte(texte, garder_gras=False):
    """Nettoie liens, références et gabarits. Le gras ('''...''') est
    conservé par défaut car il sert de repère au motif "* '''CODES''' :
    description" (balises, passages à niveau) ; les autres motifs
    l'ignorent en passant garder_gras=False."""
    texte = REF_RE.sub("", texte)
    for _ in range(4):
        nouveau = re.sub(r"\{\{[^{}]*\}\}", "", texte)
        if nouveau == texte:
            break
        texte = nouveau
    texte = LINK_RE.sub(lambda m: m.group(2), texte)
    # Remplacer par une espace (pas une suppression) : "60px<br>CE1" ne doit
    # pas devenir "60pxCE1", ce qui masquerait la frontière du code.
    texte = HTML_RE.sub(" ", texte)
    if not garder_gras:
        texte = texte.replace("'''", "").replace("''", "")
    return texte


def normaliser_code(code):
    return code.replace(" ", "")


def recuperer_wikitexte(titre):
    url = WIKIPEDIA_API + "?" + urllib.parse.urlencode(
        {"action": "parse", "page": titre, "prop": "wikitext", "format": "json"}
    )
    try:
        data = requete_json(url)
    except Exception as exc:
        print(f"  page indisponible '{titre}' : {exc}")
        return None
    if "error" in data:
        print(f"  page absente '{titre}' : {data['error'].get('info')}")
        return None
    return data["parse"]["wikitext"]["*"]


DESC_SEP_RE = re.compile(
    r"(?<![A-Za-z0-9])(" + CODE_MOTIF + r")[ \t]*(?:ancien)?[ \t]*[.:\-–][ \t]+"
    r"([^\n\[\]{}|=]{3,220}?)(?=[.;\n]|\]\]|$)"
)

BOLD_BULLET_RE = re.compile(
    r"\*\s*'''([^']{2,90})'''\s*:?\s*\n+\s*([^\n]{5,300})"
)

ROW_HEADER_RE = re.compile(
    r'!\s*scope="row"\s*\|\s*(?:\[\[[^\]|]*\|)?([^\]\n]{1,40}?)\]{0,2}\s*\n\|\s*([^\n]{3,300})'
)

TABLE_PIPE_RE = re.compile(
    r"(?<![A-Za-z0-9])(" + CODE_MOTIF + r")\s*\|\|\s*(.+)$", re.MULTILINE
)


def extraire_designations(texte, codes_recherches, resultats):
    """Applique les motifs d'extraction sur le wikitexte d'une page et
    remplit `resultats` (dict code -> désignation) pour les codes encore
    manquants parmi `codes_recherches`."""
    manquants = [c for c in codes_recherches if c not in resultats]
    if not manquants:
        return
    texte_propre = nettoyer_wikitexte(texte)
    texte_avec_gras = nettoyer_wikitexte(texte, garder_gras=True)
    manquants_norm = {normaliser_code(c): c for c in manquants}

    # 1) motif "CODE || cellule" (tableaux triables) : on prend la première
    #    cellule qui n'est pas un simple gabarit d'image (ex. "60px").
    for m in TABLE_PIPE_RE.finditer(texte_propre):
        code = normaliser_code(m.group(1).strip())
        if code not in manquants_norm or manquants_norm[code] in resultats:
            continue
        cellules = m.group(2).split("||")
        for cellule in cellules:
            cellule = cellule.strip()
            if not cellule or re.match(r"^\d+\s*px$", cellule):
                continue
            code_reel = manquants_norm[code]
            resultats[code_reel] = cellule
            break

    # 2) motif "* '''CODE1 et CODE2''' : description" (bulletins à codes
    #    groupés, ex. balises J, panneaux G). Le gras doit être conservé
    #    jusqu'ici pour repérer les bornes de l'en-tête.
    for m in BOLD_BULLET_RE.finditer(texte_avec_gras):
        entete, description = m.group(1), m.group(2).strip()
        for code_brut in re.findall(CODE_MOTIF, entete):
            code = normaliser_code(code_brut)
            if code in manquants_norm and manquants_norm[code] not in resultats:
                resultats[manquants_norm[code]] = description

    # 3) motif tableau à en-tête de ligne (balises J) : code sur la ligne
    #    d'en-tête, description sur la ligne suivante.
    for m in ROW_HEADER_RE.finditer(texte_propre):
        entete, description = m.group(1).strip(), m.group(2).strip()
        for code_brut in re.findall(CODE_MOTIF, entete):
            code = normaliser_code(code_brut)
            if code in manquants_norm and manquants_norm[code] not in resultats:
                resultats[manquants_norm[code]] = description

    # 4) motif générique "CODE - description" / "CODE : description" /
    #    "CODE. description" (légendes de galerie, listes à puces).
    for m in DESC_SEP_RE.finditer(texte_propre):
        code = normaliser_code(m.group(1).strip())
        description = m.group(2).strip()
        if code in manquants_norm and manquants_norm[code] not in resultats and not description.startswith("="):
            resultats[manquants_norm[code]] = description


def nettoyer_designation(texte):
    texte = texte.strip().strip(".,;: ")
    texte = re.sub(r"\s+", " ", texte)
    texte = texte.replace("—", ",")  # tiret cadratin interdit
    texte = texte.replace("–", ",")  # tiret demi-cadratin, par prudence
    if texte:
        texte = texte[0].upper() + texte[1:]
    if len(texte) > 140:
        coupe = texte[:140].rsplit(" ", 1)[0]
        texte = coupe + "..."
    return texte


def construire_designations(codes, rapport):
    resultats = {}
    for titre in PAGES_WIKIPEDIA:
        manquants_avant = len([c for c in codes if c not in resultats])
        if manquants_avant == 0:
            break
        texte = recuperer_wikitexte(titre)
        time.sleep(CADENCE)
        if texte is None:
            continue
        rapport["pages_utilisees"].append(titre)
        extraire_designations(texte, codes, resultats)

    for code, correction in CORRECTIONS_MANUELLES.items():
        if code in codes and code not in resultats:
            resultats[code] = correction

    designations = {}
    replis = []
    for code in codes:
        if code in resultats:
            designations[code] = nettoyer_designation(resultats[code])
        else:
            prefixe = "Panonceau" if code_serie(code)[1] == "panonceaux" else "Panneau"
            designations[code] = f"{prefixe} {code}"
            replis.append(code)
    return designations, replis


# ---------------------------------------------------------------------------
# Étape 3 : génération de js/signaux-catalogue.js
# ---------------------------------------------------------------------------

def echapper_js(texte):
    return texte.replace("\\", "\\\\").replace('"', '\\"')


def generer_js(catalogue, date_generation):
    lignes = []
    lignes.append("/*")
    lignes.append(" * Promo ECSR : Application propriétaire.")
    lignes.append(" * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.")
    lignes.append(" *")
    lignes.append(" * Catalogue complet des panneaux routiers français, pour la galerie de")
    lignes.append(" * l'éditeur de cours (sélection visuelle par famille).")
    lignes.append(" *")
    lignes.append(" * Fichiers SVG : Wikimedia Commons, domaine public (fichiers")
    lignes.append(" * \"France road sign <code>.svg\"), copiés dans assets/signaux/catalogue/.")
    lignes.append(" * Intitulés : Wikipédia FR, pages consacrées à chaque famille de panneaux.")
    lignes.append(" *")
    lignes.append(f" * Généré par scripts/construire_catalogue_signaux.py le {date_generation}.")
    lignes.append(" * Rejouable : ne modifie pas les 21 SVG de assets/signaux/ ni le registre")
    lignes.append(" * SIGNAUX de js/signaux.js, réservés aux illustrations des cours.")
    lignes.append(" */")
    lignes.append("")
    lignes.append("export const CATALOGUE = {")
    for code in sorted(catalogue.keys()):
        entree = catalogue[code]
        lignes.append(
            f'  "{echapper_js(code)}": {{ fichier: "{echapper_js(entree["fichier"])}", '
            f'nom: "{echapper_js(entree["nom"])}", serie: "{echapper_js(entree["serie"])}" }},'
        )
    lignes.append("};")
    lignes.append("")
    return "\n".join(lignes)


# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True, help="Date à inscrire dans l'en-tête du fichier généré (AAAA-MM-JJ)")
    args = parser.parse_args()

    rapport = {
        "ignores_trop_lourds": [],
        "echecs": [],
        "pages_utilisees": [],
    }

    print("Étape 1/3 : liste des fichiers sur Wikimedia Commons...")
    fichiers = lister_fichiers_commons()
    print(f"  {len(fichiers)} fichiers 'France road sign *' trouvés au total.")

    retenus = choisir_variantes(fichiers)
    print(f"  {len(retenus)} codes retenus après filtrage des séries ECSR et des variantes.")

    print("Étape 2/3 : téléchargement des SVG...")
    telecharges = telecharger_fichiers(retenus, rapport)
    print(f"  {len(telecharges)} fichiers présents dans {DOSSIER_CATALOGUE}.")

    print("Étape 3/3 : intitulés français depuis Wikipédia...")
    designations, replis = construire_designations(list(telecharges.keys()), rapport)
    print(f"  {len(telecharges) - len(replis)} intitulés trouvés, {len(replis)} replis 'Panneau <code>'.")

    catalogue = {}
    for code, nom_fichier in telecharges.items():
        _, serie = code_serie(code)
        catalogue[code] = {
            "fichier": nom_fichier,
            "nom": designations[code],
            "serie": serie,
        }

    js = generer_js(catalogue, args.date)
    with open(FICHIER_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(js)
    print(f"Fichier généré : {FICHIER_JS} ({len(catalogue)} entrées).")

    if rapport["ignores_trop_lourds"]:
        print("Fichiers ignorés (trop lourds) :")
        for code, taille in rapport["ignores_trop_lourds"]:
            print(f"  - {code} : {taille} octets")
    if rapport["echecs"]:
        print("Échecs de téléchargement :")
        for code in rapport["echecs"]:
            print(f"  - {code}")

    # Sauvegarde du rapport brut pour l'étape de rédaction du rapport final.
    chemin_rapport = os.path.join(RACINE, "scripts", "_rapport_catalogue_signaux.json")
    with open(chemin_rapport, "w", encoding="utf-8") as f:
        json.dump(
            {
                "nb_codes_commons": len(retenus),
                "nb_telecharges": len(telecharges),
                "replis": sorted(replis),
                "pages_utilisees": rapport["pages_utilisees"],
                "ignores_trop_lourds": rapport["ignores_trop_lourds"],
                "echecs": rapport["echecs"],
                "catalogue": catalogue,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"Rapport brut : {chemin_rapport}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
