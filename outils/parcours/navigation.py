# -*- coding: utf-8 -*-
"""Comment une personne atteint chaque page, selon la navigation, son espace et son écran.

Deux navigations coexistent dans main : l'« ancienne » (une barre de 8 onglets, en icônes sur téléphone),
celle des promos de Nîmes et Montpellier, et la « nouvelle » (refonte : onglets du stagiaire, barre latérale
de l'équipe, barre du bas et « Plus » sur téléphone), allumée promo par promo. Chaque chemin est la suite
des clics la plus courte qu'offre l'écran ; le robot les compte contre le budget du parcours.

Après le lot 2B (Accueil, Aujourd'hui, planning en grille, sous-onglets QCM) : ajouter ici les destinations
neuves (par exemple « Aujourd'hui », « QCM ») pour la nouvelle navigation, puis les parcours qui s'en servent.
"""

# Réglages du banc communs à tous les parcours : un mercredi gelé à 10 h (émargement du matin ouvert),
# l'émargement allumé pour la promo 1.
PARAMS_COMMUNS = {"date": "2026-10-28", "emargement": "1"}

# Les liens de navigation, toutes formes confondues : onglets de l'ancienne barre, onglets du stagiaire,
# barre du bas, barre latérale, tiroir « Plus ».
_LIENS = "#tabs a.tab, a.nav-onglet, a.nav-case, a.nav-entree, a.nav-fenetre-lien"
SELECTEUR_LIENS = _LIENS
SELECTEUR_BARRE = ":is(#tabs a.tab, a.nav-onglet, a.nav-case, a.nav-entree):visible"

# Page de départ de chaque parcours, posée par l'adresse (sans clic) : une page de tous les rôles et des deux
# navigations, qui n'est la destination d'aucun parcours. Le budget se compte depuis là.
DEPART = "#/planning"


# Destinations qui ouvrent une fenêtre et non une page : pas de titre de page à comparer au nom de l'entrée.
FENETRES = ("Signaler un problème",)


def ouvre_une_page(selecteur):
    """Le clic ouvre-t-il une page à part entière (lien de la barre, tuile de l'Accueil, logo) ?"""
    return selecteur.startswith((":is(%s)" % _LIENS, "a.home-tile", "a.brand"))


def lien(route):
    return ":is(%s)[href=\"#/%s\"]" % (_LIENS, route)


def texte(nom, balises="a, button, [role=tab], [role=menuitem]"):
    """Un élément cliquable visible qui porte ce texte (tel que la personne le lit)."""
    return ":is(%s):visible:has-text(\"%s\")" % (balises, nom)


SOUS_ONGLET = "button.subtab, [role=tab], a.fiche-ligne"
PLUS = ("button.nav-plus", "« Plus »")
COMPTE_V1 = ("button.admin-badge", "le bouton du compte")
COMPTE_V2_STAGIAIRE = ("button.nav-compte", "le bouton du compte")


def dans_le_menu_du_compte(nom):
    """Une ligne du menu du compte de la nouvelle navigation (calque `data-nav-coquille="compte"`) : la page
    derrière peut porter le même texte (le pied de l'Accueil a un lien « mes préférences »)."""
    return "[data-nav-coquille=\"compte\"] :is(a, button):visible:has-text(\"%s\")" % nom


# Le lien de retour d'une sous-page (« ‹ Mon suivi », « ‹ Mon espace ») sur téléphone.
RETOUR = "#view a.fiche-retour"


def _plus_si_telephone(route, nom, telephone, barre_du_bas):
    if telephone and route not in barre_du_bas:
        return [PLUS, (lien(route), nom)]
    return [(lien(route), nom)]


BARRE_DU_BAS_EQUIPE = ("home", "planning", "stagiaires", "notes")


def chemin(destination, navigation, espace, telephone):
    """La liste des clics (sélecteur, ce que la personne touche) pour atteindre `destination`."""
    if navigation == "ancienne":
        onglets = {"Accueil": ("home", "l'onglet Accueil"), "Cours et QCM": ("themes", "l'onglet Cours"),
                   "La classe": ("notes", "l'onglet Notes"), "CCP2": ("ccp2", "l'onglet CCP2"),
                   "Documents": ("ressources", "l'onglet Ressources"), "Mes préférences": ("config", "l'onglet Paramètres"),
                   "Réglages": ("config", "l'onglet Paramètres"), "Planning": ("planning", "l'onglet Planning")}
        if destination in onglets:
            route, nom = onglets[destination]
            return [(lien(route), nom)]
        if destination == "Mon suivi":
            return [("a.brand", "le logo (Mon espace)")]
        if destination == "Signaler un problème":
            return [COMPTE_V1, (texte("Signaler un problème", "button"), "« Signaler un problème »")]
        tuiles = {"Émargement": ("emargement", "la tuile Émargement"), "Indicateurs": ("centre", "la tuile Tableau de bord"),
                  "Stagiaires": ("stagiaires", "la tuile Stagiaires")}
        if destination in tuiles:
            route, nom = tuiles[destination]
            return [(lien("home"), "l'onglet Accueil"), ("a.home-tile[href=\"#/%s\"]" % route, nom)]
        raise KeyError("destination inconnue pour l'ancienne navigation : %s" % destination)

    # Nouvelle navigation.
    if espace == "stagiaire":
        routes = {"Accueil": "home", "Planning": "planning", "Cours et QCM": "themes", "Mon suivi": "mon-suivi", "CCP2": "ccp2"}
        if destination in routes:
            return [(lien(routes[destination]), "« %s »" % destination)]
        if destination == "La classe":
            # Lot 2B : La classe est une vue de la partie Résultats (sélecteur « Moi » / « La classe »). Sur
            # ordinateur, Mon suivi s'ouvre sur Résultats ; sur téléphone, on passe par la ligne du sommaire.
            classe = (texte("La classe", ".vue-toggle button"), "« La classe »")
            if telephone:
                return [(lien("mon-suivi"), "« Mon suivi »"), (texte("Résultats", SOUS_ONGLET), "« Résultats »"), classe]
            return [(lien("mon-suivi"), "« Mon suivi »"), classe]
        if destination == "Documents":
            return [(lien("themes"), "« Cours et QCM »"), (texte("Documents", SOUS_ONGLET), "« Documents »")]
        if destination in ("Mes préférences", "Signaler un problème"):
            return [COMPTE_V2_STAGIAIRE, (dans_le_menu_du_compte(destination), "« %s »" % destination)]
        raise KeyError("destination inconnue pour le stagiaire (nouvelle navigation) : %s" % destination)

    routes = {"Accueil": "home", "Planning": "planning", "Émargement": "emargement", "Stagiaires": "stagiaires",
              "Notes et examens": "notes", "Cours et QCM": "themes", "CCP2": "ccp2", "Indicateurs": "centre", "Réglages": "config"}
    if destination in routes:
        return _plus_si_telephone(routes[destination], "« %s »" % destination, telephone, BARRE_DU_BAS_EQUIPE)
    if destination == "Signaler un problème":
        if telephone:
            return [PLUS, (texte("Signaler un problème", "button.nav-fenetre-lien"), "« Signaler un problème »")]
        return [("button.nav-cote-signaler", "« Signaler un problème »")]
    raise KeyError("destination inconnue pour l'équipe (nouvelle navigation) : %s" % destination)
