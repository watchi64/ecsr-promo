# -*- coding: utf-8 -*-
"""Parcours de la conservation des données (Qualiopi Q5) : le fondateur lit les échéances, lance chaque étape dans une fenêtre
de l'app qui demande de taper EFFACER, efface une fiche à la demande ; le formateur et le stagiaire n'ont ni bouton ni page ;
la feuille d'émargement garde l'heure et la présence quand le dessin est effacé.

Le faux Supabase (`_harness_supabase.js`, `?conservation=1`) simule les fonctions de la migration 20261110_conservation.sql avec
les mêmes refus et un journal en mémoire (`window.__HARNESS_CONSERVATION`, appels dans `window.__HARNESS_CONSERVATION_APPELS`).
À la date gelée du robot (28/10/2026), sont dues : l'étape des 12 mois et l'étape des 3 ans de « Montpellier, mars 2021 »,
l'étape des 12 mois de « Nîmes, mars 2023 », le questionnaire des formateurs 2021 (liste, commentaires, figeage) ; à venir :
toutes les échéances de « Nîmes, mars 2026 ». Les confirmations sont des fenêtres de l'app, jamais la boîte du navigateur.
"""
from . import parcours
from .navigation import SOUS_ONGLET, texte
from .visite import BLOQUE, LISTE, DelaiDepasse

FENETRE = ".modal-backdrop .modal"
CHAMP = FENETRE + " .confirmer-champ input"
OUI = FENETRE + " button.btn.danger"
NON = FENETRE + " button.btn.ghost"
CARTE = "#view .cons-carte"
NAV2 = ("FIXTURES.settings.push({ key: 'navigation_v2', value: String(PARAMS_BANC.get('nav2') === '1'), promo_id: 7 });",)
BANC = {"conservation": "1", "centre": "1"}
BUDGET = 5   # ancienne navigation : Accueil, tuile, « Qualiopi », le sous-onglet, le bouton ; téléphone : « Plus » en plus


def carte(sorte, titre, type_echeance=None):
    """La carte d'une échéance : sa sorte (« Fiches : étape des 12 mois ») et son titre (la promo, ou l'année et le centre) ;
    `type_echeance` départage les cartes d'une même sorte (le questionnaire des formateurs en a trois par année)."""
    filtre = ":has(button[data-cons=\"%s\"])" % type_echeance if type_echeance else ""
    return "%s:has(.cons-sorte:text-is(\"%s\")):has(.cons-carte-titre:text-is(\"%s\"))%s" % (CARTE, sorte, titre, filtre)


def appels(v):
    """Les noms des fonctions de conservation appelées depuis le chargement de la page."""
    return v.page.evaluate("() => (window.__HARNESS_CONSERVATION_APPELS || []).map((a) => a.name)")


def ecritures_ou_etat(v):
    """Les appels d'effacement ou de lecture des échéances : tout sauf la liste des fiches effacées à la demande, que l'équipe
    et la page des stagiaires lisent pour leurs listes de travail."""
    return [nom for nom in appels(v) if nom != "fiches_effacees_sur_demande"]


def journal(v):
    return v.page.evaluate("() => JSON.parse(JSON.stringify(window.__HARNESS_CONSERVATION.journal))")


def ouvrir_conservation(v):
    v.aller("Qualiopi")
    v.etape("ouvrir le sous-onglet « Conservation des données »")
    v.toucher(texte("Conservation des données", SOUS_ONGLET), "« Conservation des données »")
    v.attendre(CARTE, "les cartes des échéances")


def ouvrir_la_fenetre(v, carte_cible, type_echeance, quoi):
    """Touche le bouton de l'échéance et attend la fenêtre de l'app, qui dit ce qui part et ce qui reste."""
    bouton = carte_cible + ' button[data-cons="%s"]' % type_echeance
    v.attendre(bouton, "le bouton de " + quoi)
    v.toucher(bouton, "le bouton de " + quoi)
    v.attendre(FENETRE + " .confirmer-liste", "la fenêtre qui dit ce qui part")
    return v.texte(FENETRE)


def exiger_la_saisie(v):
    """Le bouton du geste reste inactif tant que le mot n'est pas tapé exactement."""
    oui = v.page.locator(OUI).first
    if oui.is_enabled():
        v.constat("E", BLOQUE, "le bouton du geste est actif avant toute saisie du mot de confirmation", capture=True)
    v.remplir(CHAMP, "EFFACE", "un mot incomplet")
    if oui.is_enabled():
        v.constat("E", BLOQUE, "le bouton du geste est actif avec un mot incomplet", capture=True)
    v.remplir(CHAMP, "EFFACER", "le mot de confirmation")
    if not oui.is_enabled():
        v.constat("E", BLOQUE, "le bouton du geste reste inactif après le mot de confirmation", capture=True)


def lancer_une_etape(v, sorte, titre, type_echeance, appel, quoi, titre_fenetre, attendu, journal_type, retirees=1):
    """Le chemin complet d'une échéance due : fenêtre, mot de confirmation, confirmation à l'écran, carte disparue, une ligne
    de journal sans nom. `retirees` : le nombre de cartes qui disparaissent (l'étape des 3 ans fait d'abord l'étape des 12 mois qui
    manque, donc emporte aussi la carte de celle-ci)."""
    c = carte(sorte, titre, type_echeance)
    ouvrir_conservation(v)
    avant = v.page.locator(CARTE).count()
    v.etape("ouvrir la fenêtre de " + quoi)
    texte_fenetre = ouvrir_la_fenetre(v, c, type_echeance, quoi)
    v.but("fenêtre de confirmation ouverte")
    if titre_fenetre not in texte_fenetre:
        v.constat("F", BLOQUE, "la fenêtre ne porte pas le titre attendu « %s »" % titre_fenetre, capture=True)
    for morceau in ("Ce qui est effacé", "Ce qui reste", "Irréversible"):
        if morceau not in texte_fenetre:
            v.constat("F", BLOQUE, "la fenêtre ne dit pas « %s »" % morceau, capture=True)
    v.controler_ecran("fenêtre de confirmation de " + quoi)
    v.etape("taper le mot de confirmation")
    exiger_la_saisie(v)
    v.ecouter_messages()
    v.toucher(OUI, "le bouton du geste", compte=False, ecriture=True)
    v.exiger_confirmation(quoi, attendu)
    try:
        v.page.locator(FENETRE).wait_for(state="hidden", timeout=2000)
    except DelaiDepasse:
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après la confirmation", capture=True)
    try:
        v.page.locator(c).wait_for(state="detached", timeout=3000)
    except DelaiDepasse:
        v.constat("E", BLOQUE, "la carte de l'échéance reste affichée après son effacement", capture=True)
    apres = v.page.locator(CARTE).count()
    if apres != avant - retirees:
        v.constat("E", BLOQUE, "la liste compte %d échéances après l'effacement au lieu de %d" % (apres, avant - retirees))
    if appel not in appels(v):
        v.constat("E", BLOQUE, "la fonction %s n'a pas été appelée" % appel)
    lignes = journal(v)
    if len(lignes) != 1 or lignes[0]["type"] != journal_type:
        v.constat("E", BLOQUE, "le journal devrait porter une ligne de type %s, il porte : %s" % (journal_type, [j["type"] for j in lignes]))
    v.but("échéance effacée")
    v.terminer()


@parcours("conservation-etape-des-12-mois", "Effacer les comptes et les textes d'une promo à l'échéance des 12 mois (fondateur)",
          role="fondateur", budget=BUDGET, banc=BANC, semis=NAV2)
def etape_des_12_mois(v):
    """Qualiopi, « Conservation des données » : la carte « Fiches : étape des 12 mois » de Montpellier, mars 2021 ; la fenêtre
    liste ce qui part et ce qui reste, le bouton n'agit qu'après EFFACER, un message confirme, la carte disparaît."""
    lancer_une_etape(v, "Fiches : étape des 12 mois", "Montpellier, mars 2021", "etape1", "effacer_promo_etape1",
                     "l'étape des 12 mois", "Effacer les comptes et les textes de", "fiches traitées", "promo")


@parcours("conservation-etape-des-3-ans", "Effacer les noms et les preuves d'une promo à l'échéance des 3 ans (fondateur)",
          role="fondateur", budget=BUDGET, banc=BANC, semis=NAV2)
def etape_des_3_ans(v):
    """Même écran, carte « Fiches : étape des 3 ans » de Montpellier, mars 2021 : la fenêtre dit que les noms et les preuves
    partent, un message confirme (les résultats et les heures restent), la carte disparaît."""
    lancer_une_etape(v, "Fiches : étape des 3 ans", "Montpellier, mars 2021", "etape2", "effacer_promo_etape2",
                     "l'étape des 3 ans", "Effacer les noms et les preuves de", "Les résultats et les heures restent", "promo", retirees=2)


@parcours("conservation-liste-des-formateurs", "Effacer la liste des formateurs qui ont répondu au questionnaire (fondateur)",
          role="fondateur", budget=BUDGET, banc=BANC, semis=NAV2)
def liste_des_formateurs(v):
    """Même écran, carte « Questionnaire des formateurs » 2021, Montpellier (la liste de ceux qui ont répondu) : la fenêtre,
    EFFACER, un message qui ne cite aucun nombre de répondants, la carte disparaît."""
    lancer_une_etape(v, "Questionnaire des formateurs", "2021, Montpellier", "cloture_formateurs", "clore_annee_formateurs",
                     "l'effacement de la liste des répondants", "Effacer la liste des répondants pour", "", "questionnaires")


@parcours("conservation-annuler", "Renoncer à un effacement : Annuler et Échap ne touchent à rien (fondateur)",
          role="fondateur", budget=BUDGET, banc=BANC, semis=NAV2)
def annuler(v):
    """Ouvrir la fenêtre d'une étape due puis « Annuler » : la fenêtre se ferme, la carte reste, aucune fonction d'effacement
    n'est appelée et le journal reste vide ; même chose par Échap."""
    c = carte("Fiches : étape des 12 mois", "Montpellier, mars 2021")
    ouvrir_conservation(v)
    avant = v.page.locator(CARTE).count()
    v.etape("ouvrir la fenêtre puis annuler")
    ouvrir_la_fenetre(v, c, "etape1", "l'étape des 12 mois")
    v.but("fenêtre de confirmation ouverte")
    v.toucher(NON, "« Annuler »", compte=False)
    try:
        v.page.locator(FENETRE).wait_for(state="hidden", timeout=2000)
    except DelaiDepasse:
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après « Annuler »", capture=True)
    v.etape("rouvrir la fenêtre puis Échap")
    v.toucher(c + ' button[data-cons="etape1"]', "le bouton de l'étape des 12 mois", compte=False)
    v.attendre(FENETRE + " .confirmer-liste", "la fenêtre")
    if v.telephone:   # pas de clavier sur téléphone : la fenêtre se ferme par « Annuler »
        v.toucher(NON, "« Annuler »", compte=False)
    else:
        v.fermer_par_echap(FENETRE, "la fenêtre de confirmation")
    try:
        v.page.locator(FENETRE).wait_for(state="hidden", timeout=2000)
    except DelaiDepasse:
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après le refus", capture=True)
    if v.page.locator(CARTE).count() != avant:
        v.constat("E", BLOQUE, "des échéances ont disparu alors que rien n'a été confirmé", capture=True)
    if any(nom.startswith("effacer_") for nom in appels(v)) or journal(v):
        v.constat("E", BLOQUE, "un effacement a été lancé ou noté au journal alors que la fenêtre a été refusée")
    v.terminer()


@parcours("conservation-date-manquante", "Lire les échéances : à faire, à venir et promo sans date de fin (fondateur)",
          role="fondateur", budget=BUDGET, banc=BANC, semis=NAV2)
def lire_les_echeances(v):
    """Les échéances dues sont sous « À faire maintenant » avec un bouton, celles de Nîmes mars 2026 sous « À venir » sans
    bouton ; la promo sans date de fin le dit ; le rappel en tête de page renvoie à la section."""
    ouvrir_conservation(v)
    v.but("échéances affichées")
    corps = v.texte("#view").lower()   # les titres de rangée sont en capitales à l'écran
    for morceau in ("À faire maintenant", "À venir", "Renseigne la date de fin"):
        if morceau.lower() not in corps:
            v.constat("F", BLOQUE, "la section ne montre pas « %s »" % morceau, capture=True)
    futur = carte("Fiches : étape des 12 mois", "Nîmes, mars 2026")
    if not v.voit(futur):
        v.constat("F", BLOQUE, "l'étape des 12 mois de Nîmes, mars 2026 manque dans les échéances")
    elif v.voit(futur + " button[data-cons]"):
        v.constat("E", BLOQUE, "une échéance à venir porte un bouton d'effacement", capture=True)
    sans_date = carte("Fiches : date de fin manquante", "Nîmes, septembre 2026")
    if not v.voit(sans_date):
        v.constat("F", BLOQUE, "la promo sans date de fin n'est pas signalée")
    elif v.voit(sans_date + " button[data-cons]"):
        v.constat("E", BLOQUE, "la promo sans date de fin porte un bouton d'effacement", capture=True)
    if "échéances de conservation" not in v.texte(".cons-rappel").lower():
        v.constat("F", LISTE, "le rappel en tête de la page ne parle pas des échéances de conservation", capture=True)
    v.controler_ecran("échéances de conservation")
    v.terminer()


@parcours("conservation-sur-demande", "Effacer les données d'une personne à sa demande (fondateur)", role="fondateur",
          budget=BUDGET, banc=BANC, semis=NAV2)
def sur_demande(v):
    """Qualiopi, « Conservation des données », liste des fiches de la promo : « Effacer à la demande » sur une fiche ouvre une
    fenêtre qui demande son prénom ; le bouton n'agit qu'après la saisie, un message confirme, la fiche devient « Anonyme »,
    sans bouton ; la ligne du journal est de type demande et ne porte pas son nom."""
    ouvrir_conservation(v)
    ligne = "#view .cons-fiche"
    v.attendre(ligne, "les fiches de la promo")
    cible = ligne + ':has(.cons-fiche-nom:text-is("Anissa O.")) button[data-cons="demande"]'
    v.attendre(cible, "« Effacer à la demande » sur la fiche d'Anissa")
    v.toucher(cible, "« Effacer à la demande »")
    v.attendre(FENETRE + " .confirmer-liste", "la fenêtre de confirmation")
    v.but("fenêtre de confirmation ouverte")
    fenetre = v.texte(FENETRE)
    if "sans la déclarer en abandon" not in fenetre.replace("\n", " "):
        v.constat("F", BLOQUE, "la fenêtre ne dit pas que la personne n'est pas déclarée en abandon", capture=True)
    v.controler_ecran("fenêtre d'effacement à la demande")
    v.etape("taper le prénom")
    oui = v.page.locator(OUI).first
    if oui.is_enabled():
        v.constat("E", BLOQUE, "le bouton du geste est actif avant toute saisie du prénom", capture=True)
    v.remplir(CHAMP, "Lorie", "le prénom d'une autre personne")
    if oui.is_enabled():
        v.constat("E", BLOQUE, "le bouton du geste est actif avec le prénom d'une autre personne", capture=True)
    v.remplir(CHAMP, "Anissa", "le prénom de la personne")
    if not oui.is_enabled():
        v.constat("E", BLOQUE, "le bouton du geste reste inactif après le bon prénom", capture=True)
    v.ecouter_messages()
    v.toucher(OUI, "le bouton du geste", compte=False, ecriture=True)
    v.exiger_confirmation("l'effacement à la demande", "")
    try:
        v.page.locator(FENETRE).wait_for(state="hidden", timeout=2000)
    except DelaiDepasse:
        v.constat("D", BLOQUE, "la fenêtre reste ouverte après la confirmation", capture=True)
    sans_nom = ligne + ':has(.cons-fiche-nom:text-is("Anonyme 2"))'
    v.attendre(sans_nom, "la fiche devenue « Anonyme 2 »")
    if v.voit(sans_nom + " button[data-cons]"):
        v.constat("E", BLOQUE, "la fiche effacée garde son bouton d'effacement", capture=True)
    if v.voit(ligne + ':has-text("Anissa")'):
        v.constat("E", BLOQUE, "le prénom reste affiché après l'effacement", capture=True)
    lignes = journal(v)
    if len(lignes) != 1 or lignes[0]["type"] != "demande" or "Anissa" in str(lignes[0]):
        v.constat("E", BLOQUE, "le journal devrait porter une ligne « demande » sans nom : %s" % lignes)
    if "effacer_sur_demande" not in appels(v):
        v.constat("E", BLOQUE, "effacer_sur_demande n'a pas été appelée")
    v.but("fiche effacée")
    v.terminer()


@parcours("conservation-absente-pour-le-formateur", "La conservation n'a ni bouton ni page pour un formateur",
          role="formateur", budget={"ordinateur": 1, "telephone": 2}, banc=BANC, semis=NAV2)
def absente_formateur(v):
    """Réglages : la phrase « gérée par le fondateur » est là, sans « Anonymiser la promo », sans « Effacer les données » et
    sans lien vers Qualiopi ; l'adresse #/qualiopi tapée à la main ramène à l'accueil, sans appel des fonctions de conservation."""
    v.aller("Réglages")
    v.attendre("#view [data-conservation]", "le bloc « Conservation des fiches »")
    v.but("réglages affichés")
    if "gérée par le fondateur" not in v.texte("#view [data-conservation]"):
        v.constat("F", BLOQUE, "les réglages ne disent pas que la conservation est gérée par le fondateur", capture=True)
    for nom in ("Anonymiser la promo", "Effacer les données", "Effacer à la demande"):
        if v.voit(texte(nom, "#view button, #view a")):
            v.constat("F", BLOQUE, "un formateur voit « %s »" % nom, capture=True)
    if v.voit("#view [data-lien-conservation]"):
        v.constat("F", BLOQUE, "un formateur voit le lien vers la page Qualiopi", capture=True)
    v.etape("taper l'adresse #/qualiopi")
    v.page.evaluate("() => { location.hash = '#/qualiopi'; }")
    v.page.wait_for_function("() => location.hash !== '#/qualiopi'", timeout=3000)
    if v.voit("#view .cons") or v.voit("#view .qualiopi-titre") or v.voit(CARTE):
        v.constat("D", BLOQUE, "un formateur atteint la conservation par l'adresse de la page", capture=True)
    if ecritures_ou_etat(v):
        v.constat("D", BLOQUE, "un formateur déclenche des fonctions de conservation : %s" % ecritures_ou_etat(v))
    v.terminer()


@parcours("conservation-absente-pour-le-stagiaire", "La conservation n'existe pas pour un stagiaire", role="stagiaire", budget=1,
          banc=BANC, depart="#/mon-suivi")
def absente_stagiaire(v):
    """L'adresse #/qualiopi tapée à la main ramène le stagiaire ailleurs : ni page, ni échéances, aucune fonction de conservation
    appelée ; sa fiche ne porte aucune mention d'effacement."""
    v.attendre("#view", "la page d'ouverture")
    v.but("page ouverte")
    v.etape("taper l'adresse #/qualiopi")
    v.page.evaluate("() => { location.hash = '#/qualiopi'; }")
    v.page.wait_for_function("() => location.hash !== '#/qualiopi'", timeout=3000)
    if v.voit("#view .cons") or v.voit("#view .qualiopi-titre") or v.voit(CARTE):
        v.constat("D", BLOQUE, "un stagiaire atteint la conservation par l'adresse de la page", capture=True)
    if v.voit('#view button[data-cons]'):
        v.constat("F", BLOQUE, "un stagiaire voit un bouton d'effacement", capture=True)
    if ecritures_ou_etat(v):
        v.constat("D", BLOQUE, "un stagiaire déclenche des fonctions de conservation : %s" % ecritures_ou_etat(v))
    v.terminer()


@parcours("feuille-apres-l-etape-des-3-ans", "Lire une feuille d'émargement dont une signature est effacée", role="fondateur",
          budget={"ordinateur": 3, "telephone": 4}, banc={"conservation": "1", "signature": "effacee"}, navigations=("nouvelle",))
def feuille_apres_etape_3_ans(v):
    """Émargement, une feuille de la semaine passée : la fiche effacée reste en « Anonyme 8 », signée (heure et présence
    gardées), avec « Signature effacée (durée de conservation) » à la place du dessin."""
    v.aller("Émargement")
    v.toucher('#view button[aria-label="Semaine précédente"]', "« Semaine précédente »")
    lien = '#view a[href="#/emargement/2026-10-19/matin"]'
    v.attendre(lien, "la feuille du lundi 19 octobre")
    v.toucher(lien, "la feuille du lundi 19 octobre")
    v.attendre("#view :is(table, ul, ol)", "la liste des signatures")
    v.but("feuille affichée")
    corps = v.texte("#view")
    if "Anonyme 8" not in corps:
        v.constat("F", BLOQUE, "la feuille passée ne garde pas la fiche sans nom en « Anonyme 8 »", capture=True)
    if "Signature effacée (durée de conservation)" not in corps:
        v.constat("F", BLOQUE, "la feuille ne dit pas « Signature effacée (durée de conservation) » à la place du dessin", capture=True)
    v.controler_ecran("feuille d'émargement, signature effacée")
    v.terminer()
