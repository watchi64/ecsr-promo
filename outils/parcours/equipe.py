# -*- coding: utf-8 -*-
"""Parcours de l'équipe (formateur, fondateur) : les tâches courantes de l'équipe.

En fin de fichier, les pages refaites par le lot 2B (« Aujourd'hui », planning en grille, sous-onglets Signalements
et Propositions IA) : elles n'existent que sous la nouvelle navigation.
"""
from . import parcours
from .navigation import texte
from .visite import BLOQUE, LISTE

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
    v.attendre("#view .centre-carte", "les cartes des indicateurs")
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


@parcours("problemes-signales", "Lire les problèmes signalés (fondateur)", role="fondateur", budget={"ordinateur": 2, "telephone": 3},
          banc={"signalements": "1"})
def problemes_signales(v):
    """Le fondateur ouvre « Signaler un problème », puis « Ouvrir » : la liste des signalements reçus."""
    v.aller("Signaler un problème")
    v.etape("ouvrir les problèmes signalés")
    v.toucher("a.sg-fondateur-lien", "« Ouvrir » (problèmes signalés)")
    v.attendre("#view button:has-text(\"À traiter\")", "la liste des problèmes signalés")
    v.but("problèmes signalés affichés")
    v.terminer()


# --- Pages refaites par le lot 2B (nouvelle navigation seulement) ------------------------------------------
NOUVELLE = ("nouvelle",)
CARTES_AUJOURDHUI = ("Émargement", "À traiter", "Au tableau", "En voiture", "À suivre")


@parcours("aujourdhui-du-formateur", "Voir la journée de la promo (Aujourd'hui)", role="formateur", budget=1,
          navigations=NOUVELLE, banc={"signalements": "1", "benevoles": "1"})
def aujourdhui(v):
    """Ouvrir « Aujourd'hui » : émargement, à traiter, au tableau, en voiture, à suivre ; « Voir la feuille » mène à
    la feuille d'émargement."""
    v.aller("Aujourd'hui")
    v.attendre("#view .auj-grille .acc-carte", "les cartes de la journée")
    v.but("journée de la promo affichée")
    page = v.texte("#view")
    for carte in CARTES_AUJOURDHUI:
        if carte not in page:
            v.constat("F", LISTE, "« Aujourd'hui » ne montre pas la carte « %s »" % carte, capture=True)
    v.etape("ouvrir la feuille d'émargement")
    v.toucher(texte("Voir la feuille", "#view a"), "« Voir la feuille »", compte=False)
    v.attendre("#view :is(table, ul, ol)", "la feuille d'émargement")
    v.terminer()


@parcours("traiter-un-signalement", "Traiter un signalement de QCM (depuis Aujourd'hui)", role="formateur", budget=3,
          navigations=NOUVELLE, banc={"signalements": "1"})
def traiter_un_signalement(v):
    """« Aujourd'hui », la ligne des signalements de « À traiter », puis « Corrigé » : un message confirme le
    classement."""
    v.aller("Aujourd'hui")
    v.etape("toucher la ligne des signalements")
    v.toucher("#view a.acc-ligne:has-text(\"signalement\")", "la ligne des signalements de « À traiter »")
    v.attendre("#view .qcm-signal-item", "la liste des signalements")
    v.etape("classer le premier : « Corrigé »")
    v.ecouter_messages()
    v.toucher("#view .qcm-signal-item button:has-text(\"Corrigé\")", "« Corrigé »", ecriture=True)
    # Le faux Supabase du banc ne garde pas le nouveau statut (la liste relue reste la même) : on juge la
    # confirmation, pas la liste. En ligne, le signalement classé quitte la liste des ouverts. Le banc (?signalements=1)
    # annonce aussi au démarrage qu'un signalement de l'app a avancé : ce message peut remplacer la confirmation.
    v.exiger_confirmation("« Corrigé »", "classé comme corrigé")
    v.but("signalement classé")
    v.terminer()


@parcours("modifier-le-planning", "Modifier le planning de la semaine", role="formateur", budget=3,
          navigations=NOUVELLE, depart="#/home")
def modifier_le_planning(v):
    """Planning (en grille), « Modifier » : l'éditeur de la semaine remplace la grille ; « Quitter l'édition » rend la grille."""
    v.aller("Planning")
    v.attendre(".wsem", "la semaine en grille")
    v.etape("passer en édition")
    v.toucher(texte("Modifier", "#view button"), "« Modifier »")
    v.attendre("#view .p-day-card", "l'éditeur de la semaine")
    if v.voit(".wsem"):
        v.constat("C", LISTE, "la grille reste affichée en mode « Modifier »", capture=True)
    v.but("semaine en édition")
    v.etape("terminer l'édition")
    v.toucher(texte("Quitter l'édition", "#view button"), "« Quitter l'édition »", compte=False)
    v.attendre(".wsem", "la grille après « Quitter l'édition »")
    v.terminer()


@parcours("propositions-ia", "Relire les questions proposées par l'IA (fondateur)", role="fondateur",
          budget={"ordinateur": 2, "telephone": 3}, navigations=NOUVELLE, banc={"propositions": "1"})
def propositions_ia(v):
    """Cours et QCM, Propositions IA : les QCM qui ont des questions à relire ; « Relire » ouvre l'éditeur du QCM, qui
    se referme."""
    v.aller("Propositions IA")
    v.attendre("#view .acc-ligne:has-text(\"à relire\")", "les questions à relire")
    v.but("questions à relire affichées")
    v.etape("ouvrir l'éditeur du QCM")
    v.toucher(texte("Relire", "#view button"), "« Relire »", compte=False)
    v.attendre(".qcm-overlay", "l'éditeur du QCM")
    v.controler_ecran("éditeur du QCM")
    v.etape("refermer l'éditeur")
    v.fermer_par_echap(".qcm-overlay", "l'éditeur du QCM")
    if v.voit(".qcm-overlay"):
        v.toucher("button.qcm-close", "« Fermer » (éditeur du QCM)", compte=False)
    v.terminer()
