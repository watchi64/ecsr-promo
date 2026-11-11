# -*- coding: utf-8 -*-
"""Parcours de l'équipe (formateur, fondateur) : les tâches courantes de l'équipe.

En fin de fichier, les pages refaites par le lot 2B (« Aujourd'hui », planning en grille, sous-onglets Signalements
et Propositions IA) : elles n'existent que sous la nouvelle navigation.
"""
import re

from . import parcours
from .navigation import SOUS_ONGLET, texte
from .visite import BLOQUE, LISTE, DelaiDepasse

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
          banc={"centre": "1", "demo": "1"})
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
    """Le fondateur ouvre « Signaler un problème », puis « Voir les problèmes signalés » : la liste des problèmes signalés reçus."""
    v.aller("Signaler un problème")
    v.etape("ouvrir les problèmes signalés")
    v.toucher("a.sg-fondateur-lien", "« Voir les problèmes signalés »")
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
    """« Aujourd'hui », la ligne des questions contestées de « À traiter », puis « Question corrigée » : un message
    confirme le classement (noms du lot D, 10/11 : « Questions contestées », « Question corrigée », « Pas d'erreur »)."""
    v.aller("Aujourd'hui")
    v.etape("toucher la ligne des questions contestées")
    v.toucher("#view a.acc-ligne:has-text(\"contestée\")", "la ligne des questions contestées de « À traiter »")
    v.attendre("#view .qcm-signal-item", "la liste des questions contestées")
    v.etape("classer la première : « Question corrigée »")
    v.ecouter_messages()
    v.toucher("#view .qcm-signal-item button:text-is(\"Question corrigée\")", "« Question corrigée »", ecriture=True)
    # Le faux Supabase du banc ne garde pas le nouveau statut (la liste relue reste la même) : on juge la
    # confirmation, pas la liste. En ligne, le signalement classé quitte la liste des ouverts. Le banc (?signalements=1)
    # annonce aussi au démarrage qu'un signalement de l'app a avancé : ce message peut remplacer la confirmation.
    v.exiger_confirmation("« Question corrigée »", "Contestation classée : question corrigée")
    v.but("contestation classée")
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


@parcours("vider-les-placements", "Vider les placements de la semaine, puis annuler", role="formateur", budget=3,
          navigations=NOUVELLE, depart="#/home")
def vider_les_placements(v):
    """Planning, « Modifier », « Vider les placements » : la question s'ouvre dans une fenêtre de l'app (une boîte du
    navigateur serait un défaut) ; « Annuler » la referme et rien n'est vidé."""
    v.aller("Planning")
    v.attendre(".wsem", "la semaine en grille")
    v.etape("passer en édition")
    v.toucher(texte("Modifier", "#view button"), "« Modifier »")
    v.attendre("#view .p-day-card", "l'éditeur de la semaine")
    v.etape("« Vider les placements »")
    v.toucher("#view button.p-vider-btn", "« Vider les placements »")
    v.attendre('.modal-backdrop.confirmer-fond:has-text("Vider les placements de la semaine ?")',
               "la question « Vider les placements de la semaine ? »")
    v.but("question posée dans l'app")
    v.etape("« Annuler » : rien n'est vidé")
    v.ecouter_messages()
    v.toucher(texte("Annuler", ".modal-backdrop.confirmer-fond button"), "« Annuler »", compte=False)
    if v.voit(".modal-backdrop.confirmer-fond"):
        v.constat("D", BLOQUE, "la question reste ouverte après « Annuler »", capture=True)
    v.page.wait_for_timeout(600)
    if any("vidés" in m["texte"] for m in v._journal()):
        v.constat("E", BLOQUE, "« Annuler » a quand même vidé les placements", capture=True)
    v.toucher(texte("Quitter l'édition", "#view button"), "« Quitter l'édition »", compte=False)
    v.attendre(".wsem", "la grille après « Quitter l'édition »")
    v.terminer()


@parcours("desactiver-un-jour", "Désactiver un jour du planning, puis annuler", role="formateur", budget=3,
          navigations=NOUVELLE, depart="#/home")
def desactiver_un_jour(v):
    """Planning, « Modifier », « Désactiver ce jour » sur le premier jour : le libellé se demande dans une fenêtre de l'app
    avec un champ (une boîte du navigateur serait un défaut), le champ a le focus et une valeur de départ ; « Annuler » la
    referme et le jour reste actif."""
    v.aller("Planning")
    v.attendre(".wsem", "la semaine en grille")
    v.etape("passer en édition")
    v.toucher(texte("Modifier", "#view button"), "« Modifier »")
    v.attendre("#view .p-day-card", "l'éditeur de la semaine")
    v.etape("« Désactiver ce jour »")
    v.toucher('#view button.p-day-toggle[aria-label="Désactiver ce jour"]', "« Désactiver ce jour »")
    fenetre = ".modal-backdrop.confirmer-fond"
    v.attendre(fenetre + " .confirmer-champ input", "le champ du libellé, dans une fenêtre de l'app")
    v.but("libellé demandé dans l'app")
    if not v.page.evaluate("() => document.activeElement && document.activeElement.matches('.confirmer-champ input')"):
        v.constat("F", LISTE, "le champ du libellé n'a pas le focus à l'ouverture", capture=True)
    if not v.page.locator(fenetre + " .confirmer-champ input").first.input_value().strip():
        v.constat("F", LISTE, "le champ du libellé s'ouvre vide (attendu : une valeur proposée)", capture=True)
    v.etape("« Annuler » : le jour reste actif")
    v.toucher(fenetre + ' button:text-is("Annuler")', "« Annuler »", compte=False)
    try:
        v.page.locator(fenetre).first.wait_for(state="hidden", timeout=2000)
    except DelaiDepasse:
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après « Annuler »", capture=True)
    v.attendre('#view button.p-day-toggle[aria-label="Désactiver ce jour"]', "le jour toujours actif")
    v.toucher(texte("Quitter l'édition", "#view button"), "« Quitter l'édition »", compte=False)
    v.attendre(".wsem", "la grille après « Quitter l'édition »")
    v.terminer()


# --- Notes et examens (lot C de l'audit du 09/11) ----------------------------------------------------------


THEME_22 = '#view button.saisie-cible[data-cle="T22"]'
# « Enregistrée » exactement, hors erreur : `:has-text` ignore les majuscules et cherche un morceau de texte, il
# reconnaîtrait aussi « Pas enregistrée : ... ».
ENREGISTREE = ' .saisie-etat:not(.erreur):text-is("Enregistrée")'


def _ouvrir_le_theme_22(v):
    """Notes et examens, « Saisir » (la page s'y ouvre sur téléphone), puis le thème 22."""
    v.aller("Notes et examens")
    if not v.voit("#view button.saisie-cible"):
        v.etape("ouvrir le sous-onglet « Saisir »")
        v.toucher(texte("Saisir", SOUS_ONGLET), "« Saisir »")
    v.etape("choisir le thème 22")
    v.toucher(THEME_22, "le thème 22")


def _un_stagiaire_sans_note(v):
    """Le champ d'un stagiaire sans note au thème 22, et sa ligne, par l'identifiant du stagiaire : la ligne reste la même
    une fois la note posée (le champ prend alors data-note)."""
    v.attendre("#view input.saisie-champ:not([data-note])", "le champ d'un stagiaire sans note")
    sid = v.page.locator("#view input.saisie-champ:not([data-note])").first.get_attribute("data-stagiaire-id")
    champ = '#view input.saisie-champ[data-stagiaire-id="%s"]' % sid
    return champ, '#view .saisie-ligne:has(input[data-stagiaire-id="%s"])' % sid


@parcours("saisir-une-note", "Saisir une note (thème par thème)", role="formateur", budget=3, navigations=NOUVELLE)
def saisir_une_note(v):
    """Notes et examens, « Saisir » (la page s'y ouvre sur téléphone), le thème 22, puis 14 dans le champ d'un stagiaire
    sans note et Tab : « Enregistrée » s'affiche sous son nom. « abc » : la ligne dit « Pas enregistrée » ; 14 de nouveau
    (la note en place) : l'erreur s'efface, la ligne redit d'où vient la note. Puis le champ vidé et Tab : la question
    « Effacer la note de … ? » s'ouvre dans une fenêtre de l'app (une boîte du navigateur serait un défaut), « Effacer la
    note » : « Note effacée »."""
    _ouvrir_le_theme_22(v)
    champ, ligne = _un_stagiaire_sans_note(v)
    v.etape("taper 14, puis passer au champ suivant")
    v.remplir(champ, "14", "le champ de note")
    v.page.keyboard.press("Tab")
    v.attendre(ligne + ENREGISTREE, "« Enregistrée » sous le nom")
    v.but("note enregistrée")
    v.etape("une saisie refusée, puis la note déjà en place : l'erreur s'efface")
    v.remplir(champ, "abc", "le champ de note")
    v.page.keyboard.press("Tab")
    v.attendre(ligne + ' .saisie-etat.erreur:has-text("Pas enregistrée")', "« Pas enregistrée » sous le nom")
    v.remplir(champ, "14", "le champ de note")
    v.page.keyboard.press("Tab")
    v.attendre(ligne + ' .saisie-etat:not(.erreur):has-text("Saisie le")', "l'origine de la note, sans erreur")
    v.etape("effacer la note : vider le champ, puis passer au champ suivant")
    v.remplir(champ, "", "le champ de note")
    v.page.keyboard.press("Tab")
    v.attendre('.modal:has-text("Effacer la note de")', "la question « Effacer la note de … ? »")
    v.toucher(texte("Effacer la note", ".modal button"), "« Effacer la note »", compte=False, ecriture=True)
    v.attendre(ligne + ' .saisie-etat:has-text("Note effacée")', "« Note effacée » sous le nom")
    v.terminer()


@parcours("saisir-une-note-en-panne", "Saisir une note quand la connexion lâche", role="formateur", budget=3,
          navigations=NOUVELLE)
def saisir_une_note_en_panne(v):
    """« Saisir », le thème 22, et la connexion lâche : 14 et Tab, la ligne dit « Pas enregistrée » et offre
    « Réessayer ». La connexion revient, « Réessayer » : « Enregistrée », et « Réessayer » disparaît."""
    _ouvrir_le_theme_22(v)
    champ, ligne = _un_stagiaire_sans_note(v)
    v.etape("la connexion lâche : taper 14, puis passer au champ suivant")
    v.panne()
    avant = v.messages_visibles()
    v.remplir(champ, "14", "le champ de note")
    v.page.keyboard.press("Tab")
    v.exiger_message("une note qui ne part pas", avant)
    v.attendre(ligne + ' .saisie-etat:has-text("Pas enregistrée")', "« Pas enregistrée » sous le nom")
    v.attendre(ligne + " button.saisie-reessayer", "« Réessayer » sur la ligne")
    v.but("échec dit sur la ligne, avec « Réessayer »")
    v.etape("la connexion revient : « Réessayer »")
    v.retablir()
    v.toucher(ligne + " button.saisie-reessayer", "« Réessayer »", compte=False, ecriture=True)
    v.attendre(ligne + ENREGISTREE, "« Enregistrée » après « Réessayer »")
    if v.voit(ligne + " button.saisie-reessayer"):
        v.constat("E", BLOQUE, "« Réessayer » reste affiché après un enregistrement réussi", capture=True)
    v.terminer()


@parcours("saisir-puis-retour", "Revenir à la liste pendant qu'une note part", role="formateur", budget=3,
          navigations=NOUVELLE, banc={"lenteur_ecriture": "600"})
def saisir_puis_retour(v):
    """La connexion est lente (0,6 s par écriture). Thème 22 : 14 dans le champ d'un stagiaire sans note, puis « Retour »
    aussitôt : la liste revient, et l'avancement du thème 22 compte la note quand l'envoi aboutit. Puis la même chose
    quand l'envoi échoue : un message le dit (la ligne n'est plus à l'écran)."""
    _ouvrir_le_theme_22(v)
    champ, _ = _un_stagiaire_sans_note(v)
    compte = re.match(r"(\d+) sur (\d+)", v.texte("#view .saisie-compteur"))
    if not compte:
        v.echec("le compteur du thème 22 ne dit pas « n sur N »")
    n, total = int(compte.group(1)), int(compte.group(2))
    v.etape("taper 14, puis « Retour » pendant l'envoi")
    v.remplir(champ, "14", "le champ de note")
    v.toucher("#view button.saisie-retour", "« Retour »", compte=False)
    v.attendre(THEME_22, "la liste des thèmes")
    v.but("retour à la liste pendant l'envoi")
    v.attendre(THEME_22 + ' .saisie-cible-avancement:has-text("%d sur %d")' % (n + 1, total),
               "l'avancement du thème 22 qui compte la note partie")
    v.etape("rouvrir le thème 22 ; la connexion lâche : 15, puis « Retour » pendant l'envoi")
    v.toucher(THEME_22, "le thème 22", compte=False)
    champ, _ = _un_stagiaire_sans_note(v)
    v.panne()
    avant = v.messages_visibles()
    v.remplir(champ, "15", "le champ de note")
    v.toucher("#view button.saisie-retour", "« Retour »", compte=False)
    v.exiger_message("une note qui ne part pas après « Retour »", avant)
    v.retablir()
    v.terminer()


@parcours("ouvrir-un-examen", "Ouvrir un examen depuis la liste des thèmes", role="formateur",
          budget={"ordinateur": 4, "telephone": 5}, navigations=NOUVELLE)
def ouvrir_un_examen(v):
    """Cours et QCM, « … » sur la ligne du thème 23 (son QCM est fermé au banc), « Ouvrir l'examen aux stagiaires », puis
    « 1 heure » : un message confirme et la ligne porte « Examen ouvert ». Puis « … », « Fermer l'examen », confirmé dans la
    fenêtre de l'app : le repère quitte la ligne. Depuis le 11/11, l'examen passe par « … » (liste compacte) : un toucher de plus."""
    v.aller("Cours et QCM")
    ligne = '#view .theme-row[data-id="2"]'
    v.etape("ouvrir l'examen du thème 23")
    v.toucher(ligne + " button.theme-menu", "« … » du thème 23")
    v.toucher(".theme-actions button.examen-ouvrir", "« Ouvrir l'examen aux stagiaires »")
    v.ecouter_messages()
    v.toucher(texte("1 heure", ".modal button"), "« 1 heure »", ecriture=True)
    v.exiger_confirmation("l'ouverture de l'examen", "Examen ouvert")
    v.attendre(ligne + " .theme-qcm-exam-on", "« Examen ouvert » sur la ligne")
    v.but("examen ouvert depuis la liste")
    v.etape("refermer l'examen")
    v.toucher(ligne + " button.theme-menu", "« … » du thème 23", compte=False)
    v.toucher(".theme-actions button.examen-fermer", "« Fermer l'examen » de la fiche", compte=False)
    v.attendre(".modal:has-text(\"Fermer l'examen du thème 23\")", "la demande de confirmation")
    v.ecouter_messages()
    v.toucher(texte("Fermer l'examen", ".modal button"), "« Fermer l'examen » de la confirmation", compte=False, ecriture=True)
    v.exiger_confirmation("la fermeture de l'examen", "Examen fermé")
    if v.voit(ligne + " .theme-qcm-exam-on"):
        v.echec("« Examen ouvert » reste sur la ligne après « Fermer l'examen »")
    v.terminer()


@parcours("evaluer-depuis-l-epcf-vide", "Évaluer un stagiaire depuis les moyennes EPCF vides", role="formateur",
          budget={"ordinateur": 3, "telephone": 4}, navigations=NOUVELLE)
def evaluer_depuis_l_epcf_vide(v):
    """Notes et examens, sous-onglet EPCF : sans moyenne montrable (le banc n'en sert aucune), une carte, l'avancement
    pour l'équipe et « Évaluer un stagiaire », qui ouvre la page Stagiaires sur la liste, même quand la page s'était
    refermée sur les élèves bénévoles (le bouton « Bénévoles » du Planning mémorise ce sous-onglet)."""
    v.page.evaluate("() => { try { localStorage.setItem('stagiaires.subtab', 'benevoles'); } catch (e) { /* stockage bloqué */ } }")
    v.aller("Notes et examens")
    carte = "#view .epcf-vide"
    v.etape("ouvrir le sous-onglet « Évaluations EPCF »")
    v.toucher(texte("Évaluations EPCF", SOUS_ONGLET), "« Évaluations EPCF »")
    v.attendre(carte, "la carte des moyennes EPCF vides")
    v.etape("évaluer un stagiaire")
    v.toucher(texte("Évaluer un stagiaire", carte + " a"), "« Évaluer un stagiaire »")
    v.attendre("#view .stg-liste", "la liste des stagiaires")
    if v.voit("#view .bnv-page"):
        v.constat("A", BLOQUE, "« Évaluer un stagiaire » ouvre les élèves bénévoles au lieu de la liste des stagiaires", capture=True)
    v.but("liste des stagiaires ouverte")
    v.terminer()


# --- Registre qualité (Qualiopi Q4) : le fondateur seul --------------------------------------------------------
# Le faux Supabase simule la table `registre_qualite` (`_harness_supabase.js`, `?registre=1` : six entrées dont une
# issue du signalement 101 et deux closes depuis plus de 3 ans). Le tableau de bord du centre (`centre=1&demo=1`)
# porte le lien « Qualiopi ». L'export est un téléchargement, que le robot ne gère pas : il vérifie seulement que
# « Exporter en tableau (CSV) » est présent et actif (le contenu du fichier est prouvé par les tests de `registreCsv`).
FENETRE_REGISTRE = ".registre-fenetre"
CARTES_REGISTRE = "#view .rg-cartes .rg-carte"
BANC_REGISTRE = {"registre": "1", "centre": "1"}


@parcours("registre-qualite", "Tenir le registre qualité : filtrer les entrées closes, ajouter une amélioration (fondateur)",
          role="fondateur", budget={"ordinateur": 4, "telephone": 4}, banc=BANC_REGISTRE)
def registre_qualite(v):
    """Indicateurs, « Qualiopi », sous-onglet « Registre qualité » : les entrées en cartes ; le filtre « Clos » ne garde que
    les closes ; « Exporter en tableau (CSV) » est actif ; « Ajouter » ouvre la fenêtre de saisie (rappel violences compris), une
    amélioration enregistrée apparaît dans la liste."""
    v.aller("Qualiopi")
    v.etape("ouvrir le sous-onglet « Registre qualité »")
    v.toucher(texte("Registre qualité", SOUS_ONGLET), "« Registre qualité »")
    v.attendre(CARTES_REGISTRE, "les cartes du registre")
    v.but("registre affiché")
    total = v.page.locator(CARTES_REGISTRE).count()
    if total < 5:
        v.echec("le registre du banc devrait montrer au moins 5 entrées, il en montre %d" % total)
    if "à effacer" not in v.texte(".qualiopi-rappel-registre"):
        v.constat("F", LISTE, "le rappel en tête de la page Qualiopi ne signale pas les entrées closes depuis plus de 3 ans", capture=True)
    exporter = v.attendre('#view button[data-rg="exporter"]', "« Exporter en tableau (CSV) »")
    if exporter.is_disabled():
        v.constat("E", BLOQUE, "« Exporter en tableau (CSV) » est inactif alors que le registre a des entrées", capture=True)
    v.etape("filtrer sur « Clos »")
    v.toucher('#view button.rg-filtre[data-etat="clos"]', "le filtre « Clos »", compte=False)
    etats = v.page.locator("#view .rg-cartes .rg-carte-etat").all_inner_texts()
    if not etats or any(e.strip().lower() != "clos" for e in etats):
        v.constat("E", BLOQUE, "le filtre « Clos » montre d'autres états : %s" % sorted(set(e.strip().lower() for e in etats)), capture=True)
    v.toucher('#view button.rg-filtre[data-etat="tous"]', "le filtre « Tous »", compte=False)
    v.etape("ajouter une amélioration")
    v.toucher('#view button[data-rg="ajouter"]', "« Ajouter »", compte=False)
    v.attendre(FENETRE_REGISTRE + " .rg-rappel", "la fenêtre de saisie et son rappel")
    if "référent" not in v.texte(FENETRE_REGISTRE + " .rg-rappel"):
        v.constat("F", BLOQUE, "le rappel de la fenêtre ne renvoie pas au référent du centre pour les violences", capture=True)
    v.toucher(FENETRE_REGISTRE + ' .rg-type-choix[data-type="amelioration"]', "le type « Amélioration »", compte=False)
    v.page.locator(FENETRE_REGISTRE + " #rg-origine").select_option("equipe")
    v.remplir(FENETRE_REGISTRE + " #rg-description", "Essai du robot : afficher le planning de la semaine à l'entrée de la salle.", "la description")
    v.controler_ecran("fenêtre du registre")
    v.ecouter_messages()
    v.toucher(FENETRE_REGISTRE + " button.rg-enregistrer", "« Enregistrer »", compte=False, ecriture=True)
    v.exiger_confirmation("l'ajout au registre", "ajoutée au registre")
    if v.voit(FENETRE_REGISTRE):
        v.constat("E", BLOQUE, "la fenêtre du registre reste ouverte après l'enregistrement", capture=True)
    v.attendre(CARTES_REGISTRE + ':has-text("Essai du robot")', "la nouvelle entrée dans la liste")
    apres = v.page.locator(CARTES_REGISTRE).count()
    if apres != total + 1:
        v.constat("E", BLOQUE, "après l'ajout, la liste compte %d entrées au lieu de %d" % (apres, total + 1))
    v.terminer()


@parcours("ajouter-au-registre", "Verser un problème signalé au registre qualité (fondateur)", role="fondateur",
          budget={"ordinateur": 3, "telephone": 3}, banc={"signalements": "1", "registre": "1"})
def ajouter_au_registre(v):
    """« Signaler un problème », « Voir les problèmes signalés » : sur un signalement pas encore au registre, « Ajouter au registre » ouvre la
    fenêtre préremplie ; « Enregistrer » la referme, un message confirme et le bouton devient « Au registre » (inactif)."""
    v.aller("Signaler un problème")
    v.etape("ouvrir les problèmes signalés")
    v.toucher("a.sg-fondateur-lien", "« Voir les problèmes signalés »")
    bouton = '#view button[data-sg="registre"]:not([aria-disabled="true"])'
    v.attendre(bouton, "« Ajouter au registre » sur un signalement")
    v.but("signalements affichés, avec « Ajouter au registre »")
    v.etape("ajouter au registre")
    v.toucher(bouton, "« Ajouter au registre »", compte=False)
    v.attendre(FENETRE_REGISTRE + " #rg-description", "la fenêtre du registre préremplie")
    if len(v.page.locator(FENETRE_REGISTRE + " #rg-description").first.input_value().strip()) < 3:
        v.constat("F", BLOQUE, "la description n'est pas préremplie depuis le signalement", capture=True)
    v.controler_ecran("fenêtre du registre (depuis un signalement)")
    v.ecouter_messages()
    v.toucher(FENETRE_REGISTRE + " button.rg-enregistrer", "« Enregistrer »", compte=False, ecriture=True)
    v.exiger_confirmation("l'ajout au registre", "ajoutée au registre")
    v.attendre('#view button[data-sg="registre"][aria-disabled="true"]:has-text("Au registre")', "le bouton « Au registre »")
    v.terminer()


@parcours("qualiopi-absent-pour-le-formateur", "Qualiopi n'existe pas pour un formateur", role="formateur", budget={"ordinateur": 2, "telephone": 2},
          banc={"centre": "1", "registre": "1", "signalements": "1"})
def qualiopi_absent_formateur(v):
    """Indicateurs : le bouton « Qualiopi » n'y est pas ; l'adresse #/qualiopi tapée à la main ramène à l'accueil, sans
    registre."""
    v.aller("Indicateurs")
    v.attendre("#view .centre-carte", "les cartes des indicateurs")
    v.but("indicateurs affichés")
    if v.voit("a.centre-lien-qualiopi") or v.voit(texte("Qualiopi", "#view a, #view button")):
        v.constat("F", BLOQUE, "un formateur voit le bouton « Qualiopi »", capture=True)
    v.etape("taper l'adresse #/qualiopi")
    v.page.evaluate("() => { location.hash = '#/qualiopi'; }")
    v.page.wait_for_timeout(800)
    if v.page.evaluate("location.hash") == "#/qualiopi" or v.voit("#view .rg-registre") or v.voit("#view .qualiopi-titre"):
        v.constat("D", BLOQUE, "un formateur atteint la page Qualiopi par son adresse", capture=True)
    v.terminer()


@parcours("qualiopi-absent-pour-le-stagiaire", "Qualiopi n'existe pas pour un stagiaire", role="stagiaire", budget=1,
          banc={"registre": "1", "signalements": "1"}, depart="#/mon-suivi")
def qualiopi_absent_stagiaire(v):
    """L'adresse #/qualiopi tapée à la main ramène le stagiaire à l'accueil : ni page Qualiopi, ni registre."""
    v.attendre("#view", "la page d'ouverture")
    v.but("page ouverte")
    v.etape("taper l'adresse #/qualiopi")
    v.page.evaluate("() => { location.hash = '#/qualiopi'; }")
    v.page.wait_for_timeout(800)
    if v.page.evaluate("location.hash") == "#/qualiopi" or v.voit("#view .rg-registre") or v.voit("#view .qualiopi-titre"):
        v.constat("D", BLOQUE, "un stagiaire atteint la page Qualiopi par son adresse", capture=True)
    if v.voit('button[data-sg="registre"]'):
        v.constat("F", BLOQUE, "un stagiaire voit « Ajouter au registre »", capture=True)
    v.terminer()
