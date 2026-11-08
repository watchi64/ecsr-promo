# -*- coding: utf-8 -*-
"""Robot des parcours réels : le registre des parcours.

Un parcours est une fonction qui reçoit une `Visite` (voir visite.py) et joue une tâche réelle, du premier
écran jusqu'au résultat visible, comme une personne le ferait : en cliquant sur ce qu'elle voit. Il se
déclare par le décorateur `@parcours(...)` dans l'un des modules de ce dossier (stagiaire.py, equipe.py) ;
le robot (outils/robot_parcours.py) le joue alors dans chaque moteur, chaque format et chaque navigation
qu'il accepte. Ajouter un parcours = écrire une fonction décorée, rien d'autre.
"""
from dataclasses import dataclass, field

PARCOURS = {}


@dataclass
class Parcours:
    id: str                      # identifiant court, en minuscules avec des traits d'union
    titre: str                   # la tâche, dans les mots de l'utilisateur
    role: str                    # stagiaire, formateur ou fondateur (le levier ?role= du banc)
    budget: int                  # clics (ou touchers) au plus jusqu'au but (référentiel, § 1)
    fonction: object
    banc: dict = field(default_factory=dict)          # paramètres d'adresse du banc en plus des réglages communs
    navigations: tuple = ("ancienne", "nouvelle")     # la navigation des onglets (ancienne) et la refonte (nouvelle)
    formats: tuple = ("ordinateur", "telephone")
    semis: tuple = ()            # lignes JavaScript ajoutées au faux Supabase pour ce parcours (données de départ)
    note: str = ""               # ce que le parcours prouve, en une phrase (repris dans le rapport)


def parcours(id, titre, role, budget, banc=None, navigations=("ancienne", "nouvelle"),
             formats=("ordinateur", "telephone"), semis=(), note=""):
    def enregistrer(fonction):
        if id in PARCOURS:
            raise ValueError("parcours en double : %s" % id)
        PARCOURS[id] = Parcours(id, titre, role, budget, fonction, dict(banc or {}), tuple(navigations),
                                tuple(formats), tuple(semis), note or (fonction.__doc__ or "").strip().split("\n")[0])
        return fonction
    return enregistrer


def charger_tous():
    """Importe les modules de parcours (l'import les enregistre) et rend le registre, dans l'ordre d'écriture."""
    from . import stagiaire, equipe  # noqa: F401  (l'import suffit)
    return PARCOURS
