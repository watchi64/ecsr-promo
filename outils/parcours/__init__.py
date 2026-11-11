# -*- coding: utf-8 -*-
"""Robot des parcours réels : le registre des parcours.

Un parcours est une fonction qui reçoit une `Visite` (voir visite.py) et joue une tâche réelle, du premier
écran jusqu'au résultat visible, comme une personne le ferait : en cliquant sur ce qu'elle voit. Il se
déclare par le décorateur `@parcours(...)` dans un module de ce dossier (stagiaire.py, equipe.py, ou un
module neuf : il est chargé tout seul) ; le robot (outils/robot_parcours.py) le joue alors dans chaque moteur et chaque format
qu'il accepte. Ajouter un parcours = écrire une fonction décorée, rien d'autre.
"""
from dataclasses import dataclass, field

PARCOURS = {}

# Les rôles qu'un parcours joue : le levier ?role= du banc (formateur, fondateur, stagiaire) et, depuis le lot 5, la direction d'un
# centre et le siège du réseau (le compte est alors choisi par `banc={"compte": ...}`, voir direction.py et siege.py).
ROLES = ("stagiaire", "formateur", "fondateur", "direction", "siege")


@dataclass
class Parcours:
    id: str                      # identifiant court, en minuscules avec des traits d'union
    titre: str                   # la tâche, dans les mots de l'utilisateur
    role: str                    # stagiaire, formateur, fondateur, direction ou siege (l'espace où le parcours commence)
    budget: int                  # clics (ou touchers) au plus jusqu'au but (référentiel, § 1)
    fonction: object
    banc: dict = field(default_factory=dict)          # paramètres d'adresse du banc en plus des réglages communs
    navigations: tuple = ("nouvelle",)                # une seule navigation depuis le 10/11 (l'ancienne barre est retirée)
    formats: tuple = ("ordinateur", "telephone")
    semis: tuple = ()            # lignes JavaScript ajoutées au faux Supabase pour ce parcours (données de départ)
    note: str = ""               # ce que le parcours prouve, en une phrase (repris dans le rapport)
    depart: str = ""             # page de départ (une adresse #/...) ; vide : navigation.DEPART, le Planning
    ouverture: str = "app"       # « app » : le parcours commence dans l'app (barre de navigation) ; « porte » : sur la porte de connexion


def parcours(id, titre, role, budget, banc=None, navigations=("nouvelle",),
             formats=("ordinateur", "telephone"), semis=(), note="", depart="", ouverture="app"):
    def enregistrer(fonction):
        if id in PARCOURS:
            raise ValueError("parcours en double : %s" % id)
        if role not in ROLES:
            raise ValueError("rôle inconnu pour %s : %s (permis : %s)" % (id, role, ", ".join(ROLES)))
        PARCOURS[id] = Parcours(id, titre, role, budget, fonction, dict(banc or {}), tuple(navigations),
                                tuple(formats), tuple(semis), note or (fonction.__doc__ or "").strip().split("\n")[0], depart, ouverture)
        return fonction
    return enregistrer


def charger_tous():
    """Importe tous les modules de parcours du dossier (l'import les enregistre) et rend le registre."""
    import importlib
    import pkgutil
    # Le stagiaire d'abord (l'ordre du rapport), puis les autres modules par ordre alphabétique.
    for m in sorted(pkgutil.iter_modules(__path__), key=lambda m: (m.name != "stagiaire", m.name)):
        if m.name not in OUTILS:
            importlib.import_module("%s.%s" % (__name__, m.name))
    return PARCOURS


OUTILS = {"banc", "connus", "navigation", "visite"}   # les modules du robot, qui ne déclarent aucun parcours
