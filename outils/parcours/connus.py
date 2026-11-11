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

# `ou` (facultatif) : les formats et navigations où le défaut se voit ; sert seulement à dire qu'un défaut
# connu n'a pas été revu alors que le passage l'aurait montré (donc qu'il est peut-être corrigé).
DEFAUTS_CONNUS = [
    # Les défauts n° 4 (boutons de l'ancienne barre coupés à 1 280 px) et n° 5 (budgets de clics dépassés par l'ancienne
    # navigation) sont partis avec l'ancienne barre, retirée le 10/11 : plus aucun défaut connu.
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
