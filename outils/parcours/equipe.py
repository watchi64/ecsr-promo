# -*- coding: utf-8 -*-
"""Parcours de l'équipe (formateur, fondateur) : les tâches courantes des pages que le lot 2B ne refait pas.

Les parcours d'« Aujourd'hui », du planning en grille et des sous-onglets QCM et Propositions IA
s'ajouteront ici après la fusion du lot 2B.
"""
from . import parcours
from .navigation import texte

# Sur téléphone, l'équipe passe par « Plus » pour tout ce qui n'est pas dans la barre du bas : 1 clic de plus.
UN_CLIC = {"ordinateur": 1, "telephone": 2}


@parcours("emargement-du-jour", "Ouvrir et suivre l'émargement du jour", role="formateur", budget={"ordinateur": 2, "telephone": 3})
def emargement_du_jour(v):
    """Ouvrir Émargement, puis la feuille de ce matin : la liste des stagiaires et de leurs signatures."""
    v.aller("Émargement")
    v.etape("ouvrir la feuille de ce matin")
    v.toucher("#view a[href=\"#/emargement/2026-10-28/matin\"]", "la feuille de ce matin")
    v.attendre("#view :is(table, ul, ol)", "la liste des signatures")
    v.but("feuille du matin affichée")
    v.terminer()


@parcours("indicateurs-du-centre", "Voir les indicateurs (tableau de bord du centre)", role="formateur", budget=UN_CLIC,
          banc={"centre": "1", "demo": "1"},
          semis=("FIXTURES.settings.push({ key: 'navigation_v2', value: String(PARAMS_BANC.get('nav2') === '1'), promo_id: 7 });",))
def indicateurs(v):
    """Ouvrir Indicateurs (tableau de bord du centre) sur la promo de démonstration : chiffres et sections."""
    v.aller("Indicateurs")
    v.attendre("#view section, #view .card", "les indicateurs")
    v.but("indicateurs affichés")
    v.terminer()


@parcours("reglages-de-la-promo", "Ouvrir les réglages de la promo (modules)", role="formateur", budget=UN_CLIC)
def reglages(v):
    """Ouvrir Réglages : la section des modules ouverts aux stagiaires est là, sans mot d'informaticien."""
    v.aller("Réglages")
    v.attendre("#view h2, #view h1", "le titre des réglages")
    page = v.texte("#view").lower()
    if "module" not in page and "ce que voient les stagiaires" not in page:
        v.echec("aucune section des modules (ce que voient les stagiaires) dans les réglages")
    v.but("réglages affichés")
    v.terminer()


@parcours("signaler-un-probleme-formateur", "Signaler un problème (formateur)", role="formateur", budget=UN_CLIC)
def signaler_formateur(v):
    """Ouvrir « Signaler un problème » depuis l'espace de l'équipe : le formulaire s'ouvre."""
    v.aller("Signaler un problème")
    v.attendre("#sg-message", "le champ du signalement")
    v.but("formulaire ouvert")
    v.fermer_par_echap("#sg-message", "la fenêtre « Signaler un problème »")
    if v.voit("#sg-message"):
        v.toucher(texte("Fermer", "button"), "« Fermer »", compte=False)
    v.terminer()


@parcours("problemes-signales", "Lire les problèmes signalés (fondateur)", role="fondateur", budget=3,
          banc={"signalements": "1"})
def problemes_signales(v):
    """Le fondateur ouvre « Signaler un problème », puis « Ouvrir » : la liste des signalements reçus."""
    v.aller("Signaler un problème")
    v.etape("ouvrir les problèmes signalés")
    v.toucher("a.sg-fondateur-lien", "« Ouvrir » (problèmes signalés)")
    v.attendre("#view button:has-text(\"À traiter\")", "la liste des problèmes signalés")
    v.but("problèmes signalés affichés")
    v.terminer()
