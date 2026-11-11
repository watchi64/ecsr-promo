# -*- coding: utf-8 -*-
"""Défauts bloquants déjà présents sur main : ils ne bloquent pas la fusion d'un autre chantier.

Le robot sert de filet avant chaque fusion : il doit dire « vert » quand une branche n'ajoute aucun défaut.
Les défauts relevés sur main le 08/11/2026 (docs/qualite/echecs-main-2026-11-08.md) sont listés ici ; le
rapport les montre à part (« Défauts connus de main ») et ils ne changent pas le code de sortie. Un défaut
bloquant absent de cette liste est nouveau : il bloque.

Quand un chantier corrige un défaut, il retire sa ligne dans la même fusion. Le robot le rappelle : un défaut
connu qu'aucun passage n'a revu est signalé « peut-être corrigé, ligne à retirer ».
Chaque ligne : le parcours, le critère, un morceau du message (sans les nombres qui varient), et la raison.
"""

# `ou` (facultatif) : les dimensions où le défaut se voit (format, navigation, moteur, habillage : toute clé d'un passage) ;
# un défaut vu hors de ces dimensions est nouveau, et un défaut attendu qu'aucun passage n'a revu est « peut-être corrigé ».
# `depuis` : date d'entrée de la ligne ; `echeance` : date à laquelle le défaut doit être corrigé (ou sa ligne revue). Le
# rapport signale une ligne échue. Chaque ligne a sa tâche dans ROADMAP.md (audit du 10/11 : une ligne sans échéance
# reste pour toujours). Les lignes du 08/11 portent sur l'ancienne navigation, retirée d'ici la fin novembre.
DEFAUTS_CONNUS = [
    {"parcours": "indicateurs-du-centre", "critere": "G", "contient": "div.topbar-actions",
     "depuis": "2026-11-08", "echeance": "2026-11-30", "note": "n° 4 : ancienne barre à 1 280 px, boutons coupés avec un nom de promo long",
     "ou": {"format": ["ordinateur"], "navigation": ["ancienne"]}},
    # Le même défaut n° 4, vu par le parcours du fondateur sur la promo de démonstration (lot 5, P5) : son nom est long.
    {"parcours": "apercus-du-fondateur-promo-7", "critere": "G", "contient": "div.topbar-actions",
     "depuis": "2026-11-08", "echeance": "2026-11-30", "note": "n° 4 : ancienne barre à 1 280 px, boutons coupés avec le nom de la promo de démonstration",
     "ou": {"format": ["ordinateur"], "navigation": ["ancienne"]}},
    # Budgets de clics que l'ancienne navigation dépasse (la nouvelle les tient) : n° 5 de la liste des échecs.
    {"parcours": "indicateurs-du-centre", "critere": "B", "contient": "avant le but",
     "depuis": "2026-11-08", "echeance": "2026-11-30", "note": "n° 5 : Indicateurs passe par la tuile de l'Accueil", "ou": {"format": ["ordinateur"], "navigation": ["ancienne"]}},
    {"parcours": "emargement-du-jour", "critere": "B", "contient": "avant le but",
     "depuis": "2026-11-08", "echeance": "2026-11-30", "note": "n° 5 : Émargement passe par la tuile de l'Accueil", "ou": {"format": ["ordinateur"], "navigation": ["ancienne"]}},
    {"parcours": "signaler-un-probleme-formateur", "critere": "B", "contient": "avant le but",
     "depuis": "2026-11-08", "echeance": "2026-11-30", "note": "n° 5 : « Signaler » est dans le menu du compte", "ou": {"format": ["ordinateur"], "navigation": ["ancienne"]}},
    {"parcours": "problemes-signales", "critere": "B", "contient": "avant le but",
     "depuis": "2026-11-08", "echeance": "2026-11-30", "note": "n° 5 : « Signaler » est dans le menu du compte", "ou": {"format": ["ordinateur"], "navigation": ["ancienne"]}},
]


def attendu_dans(defaut, resultat):
    """Ce passage aurait-il dû montrer ce défaut connu ?"""
    if resultat["parcours"] != defaut["parcours"]:
        return False
    ou = defaut.get("ou", {})
    return all(resultat[cle] in valeurs for cle, valeurs in ou.items())


def connu(resultat, constat):
    """La ligne de DEFAUTS_CONNUS qui couvre ce constat bloquant de ce passage, ou None. Le même défaut vu dans
    un format ou une navigation que la ligne ne cite pas est nouveau : il bloque."""
    for d in DEFAUTS_CONNUS:
        if attendu_dans(d, resultat) and d["critere"] == constat["critere"] and d["contient"] in constat["message"]:
            return d
    return None


def echues(aujourdhui):
    """Les lignes dont l'échéance (AAAA-MM-JJ) est passée à cette date (AAAA-MM-JJ)."""
    return [d for d in DEFAUTS_CONNUS if d.get("echeance") and d["echeance"] < aujourdhui]
