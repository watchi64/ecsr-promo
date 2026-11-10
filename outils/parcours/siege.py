# -*- coding: utf-8 -*-
"""Parcours du siège du réseau (lot 5, Task 16) : P4 et la part du siège de P10.

Le compte `siege` du banc n'a aucune promo : il lit des comptes par centre (`comptes_reseau()`), jamais un nom ni un chiffre par promo.
Nouvelle navigation seulement. La page de départ est Directions de centre : la Vue d'ensemble du réseau est à 1 clic.
"""
from . import parcours
from .direction import NOUVELLE, attendre_page, aucun_nom_de_stagiaire, exiger_une_phrase_dans_la_fenetre, fermer_la_fenetre
from .navigation import texte
from .visite import BLOQUE, LISTE

DEPART = "#/directions"
PHRASE_CHIFFRES = "Les chiffres du réseau n'ont pas pu être chargés."
# Le banc : Nîmes (6 en formation), Montpellier (12), Alès (3, donc masqué), le centre de démonstration (hors totaux).
BANC_SIEGE = {"compte": "siege"}


@parcours("siege-tour-du-reseau", "P4 · Le siège fait le tour du réseau (chiffres, centres, directions, cours)", role="siege", budget=1,
          banc=BANC_SIEGE, navigations=NOUVELLE, depart=DEPART)
def tour_du_reseau(v):
    """Vue d'ensemble en 1 clic, la fiche d'un centre, le CSV, Directions (inviter, retirer), Ajouter un centre, Cours et QCM : aucun
    nom de stagiaire à l'écran, le petit centre masqué et hors du total."""
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    v.attendre("#view .centre-grille .centre-carte", "les chiffres du réseau")
    v.but("vue d'ensemble du réseau")
    aucun_nom_de_stagiaire(v, "la vue d'ensemble")

    v.etape("le petit centre est masqué et hors du total")
    page = v.texte("#view")
    if "Moins de 5 stagiaires en formation" not in page:
        v.constat("E", BLOQUE, "le centre de moins de 5 stagiaires ne dit pas que ses chiffres sont masqués", capture=True)
    if "18 stagiaires" not in page:
        v.constat("E", BLOQUE, "le total du réseau n'est pas la somme des centres de 5 stagiaires et plus (18 attendus)", capture=True)
    if "21 stagiaires" in page:
        v.constat("E", BLOQUE, "le total du réseau compte le petit centre (21 stagiaires au lieu de 18)", capture=True)

    v.etape("la fiche d'un centre")
    v.toucher(texte("Nîmes", "#view a.reseau-lien"), "le centre de Nîmes", compte=False)
    v.attendre('#view h2:has-text("Nîmes")', "la fiche du centre de Nîmes")
    v.attendre("#view .centre-carte", "les chiffres du centre")
    aucun_nom_de_stagiaire(v, "la fiche d'un centre")
    v.toucher("#view a.fiche-retour", "« Vue d'ensemble » (retour)", compte=False)
    attendre_page(v, "Vue d'ensemble")
    v.etape("la fiche du petit centre")
    v.toucher(texte("Alès", "#view a.reseau-lien"), "le centre d'Alès", compte=False)
    v.attendre('#view h2:has-text("Alès")', "la fiche du centre d'Alès")
    if v.voit("#view .centre-carte"):
        v.constat("E", BLOQUE, "la fiche du petit centre montre des chiffres", capture=True)
    if "Moins de 5 stagiaires en formation" not in v.texte("#view"):
        v.constat("E", BLOQUE, "la fiche du petit centre ne dit pas pourquoi elle n'a pas de chiffres", capture=True)
    v.toucher("#view a.fiche-retour", "« Vue d'ensemble » (retour)", compte=False)
    attendre_page(v, "Vue d'ensemble")

    if not v.telephone:
        v.etape("exporter le tableau (CSV)")
        v.ecouter_messages()
        v.toucher(texte("Exporter le tableau (CSV)", "#view button"), "« Exporter le tableau (CSV) »", compte=False)
        v.exiger_confirmation("l'export du tableau", "téléchargé")

    v.etape("Directions de centre : inviter une direction")
    v.aller("Directions de centre")
    attendre_page(v, "Directions de centre")
    aucun_nom_de_stagiaire(v, "les directions")
    v.toucher(texte("Inviter une direction", "#view button.btn.primary, #view .view-header button"), "« Inviter une direction »", compte=False)
    v.remplir("#direction-email", "nouvelle.direction@exemple.invalid", "l'adresse de la direction")
    v._premier_visible(v.page.locator("#direction-centre"), "le choix du centre").select_option(label="Alès")
    v.ecouter_messages()
    v.toucher(texte("Inviter", ".modal button[type=submit]"), "« Inviter »", compte=False, ecriture=True)
    v.exiger_confirmation("l'invitation de la direction", "liste des invitations")
    v.attendre('#view :has-text("nouvelle.direction@exemple.invalid")', "la nouvelle direction dans la liste")

    v.etape("Directions de centre : retirer une direction")
    v.toucher('#view button[aria-label^="Retirer nouvelle.direction@exemple.invalid"]', "« Retirer » (la direction invitée)", compte=False)
    v.ecouter_messages()
    v.toucher(texte("Retirer", ".modal button[type=submit]"), "« Retirer »", compte=False, ecriture=True)
    v.exiger_confirmation("le retrait de la direction", "Direction retirée")

    v.etape("Ajouter un centre")
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    v.toucher(texte("Ajouter un centre", "#view button"), "« Ajouter un centre »", compte=False)
    v.remplir("#centre-nom", "Centre de Béziers", "le nom du centre")
    v.ecouter_messages()
    v.toucher(texte("Ajouter", ".modal button[type=submit]"), "« Ajouter »", compte=False, ecriture=True)
    v.exiger_confirmation("la création du centre", "Centre créé")
    # Le centre créé propose d'inviter sa direction (fenêtre) : on la ferme, le centre est dans la liste.
    v.attendre(".modal:has-text(\"Inviter une direction\")", "la proposition d'inviter la direction du nouveau centre")
    v.fermer_par_echap(".modal", "la fenêtre d'invitation")
    if v.voit(".modal"):
        v.toucher(texte("Annuler", ".modal button"), "« Annuler »", compte=False)
    v.attendre('#view a.reseau-lien:has-text("Béziers")', "le nouveau centre dans le tableau")

    v.etape("Cours et QCM")
    v.aller("Cours et QCM")
    attendre_page(v, "Cours et QCM")
    aucun_nom_de_stagiaire(v, "Cours et QCM")
    for interdit in ("Signalements", "Propositions IA"):
        if v.voit(texte(interdit, "#view button, #view [role=tab]")):
            v.constat("D", BLOQUE, "le siège voit « %s » dans Cours et QCM (D13)" % interdit, capture=True)
    v.terminer()


@parcours("panne-siege-chiffres-du-reseau", "P10 · Base en panne : les chiffres du réseau", role="siege", budget=1,
          banc={"compte": "siege", "panne": "comptes_reseau"}, navigations=NOUVELLE, depart=DEPART)
def panne_chiffres(v):
    """comptes_reseau en panne : la Vue d'ensemble dit que les chiffres n'ont pas pu être chargés et propose « Réessayer » ; la base
    revenue, « Réessayer » affiche les chiffres. Les autres pages du siège restent ouvertes."""
    v.console_attendue("TypeError: Failed to fetch", 3)      # trois lignes observées (la lecture de la Vue d'ensemble et ses relances)
    v.aller("Vue d'ensemble")
    attendre_page(v, "Vue d'ensemble")
    v.attendre('#view .centre-erreur[role="alert"]', "la phrase d'échec des chiffres")
    v.but("phrase d'échec")
    phrase = v.texte("#view .centre-erreur p").strip()
    if phrase != PHRASE_CHIFFRES:
        v.constat("E", BLOQUE, "la phrase d'échec des chiffres est « %s » au lieu de « %s »" % (phrase[:70], PHRASE_CHIFFRES), capture=True)
    v.etape("« Réessayer » avec la base toujours en panne : la lecture est relancée")
    avant = v.page.evaluate("() => (window.__HARNESS_PANNES_VUES || {}).comptes_reseau || 0")
    v.toucher(texte("Réessayer", "#view button"), "« Réessayer »", compte=False, attendu_effet=False)
    try:
        v.page.wait_for_function("(n) => ((window.__HARNESS_PANNES_VUES || {}).comptes_reseau || 0) > n", arg=avant, timeout=3000)
    except Exception:
        v.constat("E", BLOQUE, "« Réessayer » ne relance pas la lecture des chiffres (aucune nouvelle requête)", capture=True)
    v.attendre('#view .centre-erreur[role="alert"]', "la phrase d'échec après « Réessayer »")
    v.etape("la base revient")
    v.page.evaluate("() => { window.__HARNESS_PANNE_FONCTIONS = []; }")
    v.toucher(texte("Réessayer", "#view button"), "« Réessayer »", compte=False)
    v.attendre("#view .centre-grille .centre-carte", "les chiffres du réseau")
    v.etape("les autres pages restent ouvertes")
    v.aller("Directions de centre")
    attendre_page(v, "Directions de centre")
    v.terminer()


@parcours("panne-siege-inviter-une-direction", "P10 · Base en panne : inviter une direction", role="siege", budget=1,
          banc={"compte": "siege", "panne": "inviter_compte"}, navigations=NOUVELLE, depart=DEPART)
def panne_inviter_direction(v):
    """inviter_compte en panne : la fenêtre reste ouverte avec sa saisie et dit que l'invitation n'a pas abouti."""
    v.console_attendue("La connexion a échoué")        # inviteUser écrit sa phrase française dans la console
    attendre_page(v, "Directions de centre")        # la page de départ
    v.but("page Directions de centre")
    v.toucher(texte("Inviter une direction", "#view button.btn.primary, #view .view-header button"), "« Inviter une direction »", compte=False)
    v.remplir("#direction-email", "nouvelle.direction@exemple.invalid", "l'adresse de la direction")
    v._premier_visible(v.page.locator("#direction-centre"), "le choix du centre").select_option(label="Alès")
    v.toucher(texte("Inviter", ".modal button[type=submit]"), "« Inviter »", compte=False, ecriture=True)
    phrase = exiger_une_phrase_dans_la_fenetre(v, "l'invitation de direction en panne")
    v.etape("la saisie est gardée")
    if v.page.locator("#direction-email").input_value() != "nouvelle.direction@exemple.invalid":
        v.constat("E", BLOQUE, "l'adresse saisie est perdue après l'échec de l'invitation", capture=True)
    v.etape("phrase : " + phrase[:60])
    fermer_la_fenetre(v, "la fenêtre d'invitation")
    v.terminer()
